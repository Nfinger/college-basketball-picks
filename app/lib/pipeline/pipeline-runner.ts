// Pipeline Runner - Orchestrates data collection with fault tolerance

import type { SupabaseClient } from '@supabase/supabase-js'
import { CircuitBreaker } from './circuit-breaker'
import { RetryHandler } from './retry-handler'

export type PipelineRunType = 'full' | 'incremental' | 'validation' | 'backfill'
export type PipelineStatus = 'running' | 'completed' | 'partial_success' | 'failed'

export type ScraperConfig = {
  source: string
  jobType: string
  enabled: boolean
  priority: number // Lower = higher priority
  maxAge: number // Hours before data is considered stale
  dependencies?: string[] // Other sources this depends on
  run: () => Promise<ScraperResult>
}

export type ScraperResult = {
  success: boolean
  recordsProcessed: number
  recordsCreated?: number
  recordsUpdated?: number
  recordsFailed?: number
  errors: string[]
  warnings: string[]
  metadata?: Record<string, any>
}

export type PipelineResult = {
  runId: string
  status: PipelineStatus
  sourcesAttempted: number
  sourcesSucceeded: number
  sourcesFailed: number
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  errors: string[]
  warnings: string[]
  metadata: Record<string, any>
}

export class PipelineRunner {
  private circuitBreaker: CircuitBreaker
  private runId: string | null = null

  constructor(private supabase: SupabaseClient) {
    this.circuitBreaker = new CircuitBreaker(supabase)
  }

  /**
   * Execute a complete pipeline run
   */
  async run(
    scrapers: ScraperConfig[],
    runType: PipelineRunType = 'incremental'
  ): Promise<PipelineResult> {
    // Create pipeline run record
    const { data: pipelineRun } = await this.supabase
      .from('pipeline_runs')
      .insert({
        run_type: runType,
        status: 'running',
      })
      .select()
      .single()

    this.runId = pipelineRun!.id

    console.log(`[Pipeline] Starting ${runType} run: ${this.runId}`)

    const result: PipelineResult = {
      runId: this.runId,
      status: 'running',
      sourcesAttempted: 0,
      sourcesSucceeded: 0,
      sourcesFailed: 0,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [],
      warnings: [],
      metadata: {},
    }

    // Filter and sort scrapers
    const enabledScrapers = scrapers
      .filter((s) => s.enabled)
      .sort((a, b) => a.priority - b.priority)

    // Execute scrapers respecting dependencies
    for (const scraper of enabledScrapers) {
      // Check dependencies
      if (scraper.dependencies && scraper.dependencies.length > 0) {
        const dependenciesMet = await this.checkDependencies(
          scraper.dependencies,
          scraper.maxAge
        )
        if (!dependenciesMet) {
          console.log(
            `[Pipeline] Skipping ${scraper.source} - dependencies not met`
          )
          result.warnings.push(
            `Skipped ${scraper.source}: dependencies not satisfied`
          )
          continue
        }
      }

      // Check if data is fresh enough (for incremental runs)
      if (runType === 'incremental') {
        const isFresh = await this.isDataFresh(
          scraper.source,
          scraper.jobType,
          scraper.maxAge
        )
        if (isFresh) {
          console.log(`[Pipeline] Skipping ${scraper.source} - data is fresh`)
          continue
        }
      }

      // Check circuit breaker
      const isAvailable = await this.circuitBreaker.isAvailable(scraper.source)
      if (!isAvailable) {
        console.log(
          `[Pipeline] Skipping ${scraper.source} - circuit breaker open`
        )
        result.warnings.push(
          `Skipped ${scraper.source}: circuit breaker is open`
        )
        continue
      }

      // Execute scraper
      result.sourcesAttempted++
      const scraperResult = await this.executeScraper(scraper)

      if (scraperResult.success) {
        result.sourcesSucceeded++
        result.recordsProcessed += scraperResult.recordsProcessed
        result.recordsCreated += scraperResult.recordsCreated || 0
        result.recordsUpdated += scraperResult.recordsUpdated || 0
        result.warnings.push(...scraperResult.warnings)

        await this.circuitBreaker.recordSuccess(scraper.source)
      } else {
        result.sourcesFailed++
        result.errors.push(...scraperResult.errors)

        await this.circuitBreaker.recordFailure(scraper.source)
      }
    }

    // Determine final status
    if (result.sourcesFailed === 0) {
      result.status = 'completed'
    } else if (result.sourcesSucceeded > 0) {
      result.status = 'partial_success'
    } else {
      result.status = 'failed'
    }

    // Update pipeline run
    await this.supabase
      .from('pipeline_runs')
      .update({
        status: result.status,
        completed_at: new Date().toISOString(),
        sources_attempted: result.sourcesAttempted,
        sources_succeeded: result.sourcesSucceeded,
        sources_failed: result.sourcesFailed,
        records_processed: result.recordsProcessed,
        records_created: result.recordsCreated,
        records_updated: result.recordsUpdated,
        errors: result.errors,
        warnings: result.warnings,
        metadata: result.metadata,
      })
      .eq('id', this.runId)

    console.log(
      `[Pipeline] Completed ${runType} run: ${result.status} (${result.sourcesSucceeded}/${result.sourcesAttempted} sources succeeded)`
    )

    return result
  }

  /**
   * Execute a single scraper with error handling
   */
  private async executeScraper(
    scraper: ScraperConfig
  ): Promise<ScraperResult> {
    // Create scraper run record
    const { data: scraperRun } = await this.supabase
      .from('scraper_runs')
      .insert({
        pipeline_run_id: this.runId,
        source: scraper.source,
        job_type: scraper.jobType,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    const runId = scraperRun!.id
    const startTime = Date.now()

    console.log(`[Pipeline] Running ${scraper.source}/${scraper.jobType}...`)

    let result: ScraperResult
    let retryCount = 0

    try {
      // Execute with retry logic
      result = await RetryHandler.withAutoRetry(() => scraper.run(), {
        onRetry: (attempt, error, errorType) => {
          retryCount = attempt
          console.log(
            `[Pipeline] ${scraper.source} retry ${attempt} (${errorType}): ${error.message}`
          )
        },
      })

      // Update scraper run record
      await this.supabase
        .from('scraper_runs')
        .update({
          status: result.success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          records_processed: result.recordsProcessed,
          records_created: result.recordsCreated || 0,
          records_updated: result.recordsUpdated || 0,
          records_failed: result.recordsFailed || 0,
          errors: result.errors,
          warnings: result.warnings,
          retry_count: retryCount,
          metadata: result.metadata || {},
        })
        .eq('id', runId)

      // Update data freshness
      if (result.success) {
        await this.supabase.rpc('update_data_freshness', {
          p_source: scraper.source,
          p_data_type: scraper.jobType,
          p_record_count: result.recordsProcessed,
        })
      }

      return result
    } catch (error) {
      // Final failure after retries
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      result = {
        success: false,
        recordsProcessed: 0,
        errors: [errorMessage],
        warnings: [],
      }

      // Update scraper run record
      await this.supabase
        .from('scraper_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          errors: [errorMessage],
          retry_count: retryCount,
        })
        .eq('id', runId)

      console.error(`[Pipeline] ${scraper.source} failed:`, errorMessage)

      return result
    }
  }

  /**
   * Check if dependencies are satisfied
   */
  private async checkDependencies(
    dependencies: string[],
    maxAge: number
  ): Promise<boolean> {
    for (const dep of dependencies) {
      const { data } = await this.supabase.rpc('is_data_fresh', {
        p_source: dep,
        p_data_type: 'teams', // Generic for now
        p_max_age_hours: maxAge,
      })

      if (!data) {
        return false
      }
    }
    return true
  }

  /**
   * Check if data is fresh enough
   */
  private async isDataFresh(
    source: string,
    dataType: string,
    maxAge: number
  ): Promise<boolean> {
    const { data } = await this.supabase.rpc('is_data_fresh', {
      p_source: source,
      p_data_type: dataType,
      p_max_age_hours: maxAge,
    })

    return data === true
  }
}
