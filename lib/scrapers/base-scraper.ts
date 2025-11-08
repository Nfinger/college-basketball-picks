import { createClient } from '@supabase/supabase-js'

export interface ScraperConfig {
  source: string
  rateLimit: number // milliseconds between requests
  maxRetries: number
  timeout: number // request timeout in milliseconds
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface ScraperRunResult {
  success: boolean
  recordsProcessed: number
  recordsCreated?: number
  recordsUpdated?: number
  errors: string[]
  warnings: string[]
  metadata?: Record<string, any>
}

/**
 * Abstract base class for all scrapers
 * Provides retry logic, rate limiting, and error handling
 */
export abstract class BaseScraper<TRaw, TTransformed> {
  protected abstract config: ScraperConfig
  protected lastRequestTime: number = 0
  protected supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  /**
   * Main entry point - orchestrates the scraping workflow
   */
  async run(): Promise<ScraperRunResult> {
    const startTime = Date.now()
    const runId = crypto.randomUUID()

    console.log(`[${this.config.source}] Starting scraper run ${runId}`)

    try {
      // Mark run as started
      await this.logRunStart(runId)

      // Step 1: Scrape raw data
      const rawData = await this.scrape()
      console.log(`[${this.config.source}] Scraped ${rawData.length} records`)

      // Step 2: Validate data
      const validation = this.validate(rawData)
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }

      // Step 3: Transform data
      const transformed = await this.transform(rawData)
      console.log(`[${this.config.source}] Transformed ${transformed.length} records`)

      // Step 4: Save to database
      const saveResult = await this.save(transformed)
      console.log(`[${this.config.source}] Saved ${saveResult.recordsProcessed} records`)

      // Step 5: Log success
      const duration = Date.now() - startTime
      await this.logRunComplete(runId, 'success', saveResult, duration)

      return saveResult
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      console.error(`[${this.config.source}] Scraper failed:`, errorMessage)

      await this.logRunComplete(runId, 'failure', {
        recordsProcessed: 0,
        errors: [errorMessage],
        warnings: []
      }, duration)

      return {
        success: false,
        recordsProcessed: 0,
        errors: [errorMessage],
        warnings: []
      }
    }
  }

  /**
   * Fetch with retry logic and rate limiting
   */
  protected async fetchWithRetry(
    url: string,
    options?: RequestInit
  ): Promise<Response> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Rate limiting
        await this.throttle()

        // Make request with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // Handle rate limiting from server
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.calculateBackoff(attempt)
          console.warn(`[${this.config.source}] Rate limited, waiting ${delay}ms`)
          await this.sleep(delay)
          continue
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return response

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < this.config.maxRetries) {
          const delay = this.calculateBackoff(attempt)
          console.warn(
            `[${this.config.source}] Attempt ${attempt} failed, retrying in ${delay}ms:`,
            lastError.message
          )
          await this.sleep(delay)
        }
      }
    }

    throw new Error(
      `Failed after ${this.config.maxRetries} attempts: ${lastError?.message}`
    )
  }

  /**
   * Rate limiting - ensures minimum delay between requests
   */
  protected async throttle(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.config.rateLimit) {
      const delay = this.config.rateLimit - timeSinceLastRequest
      await this.sleep(delay)
    }

    this.lastRequestTime = Date.now()
  }

  /**
   * Exponential backoff calculation
   */
  protected calculateBackoff(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 30000) // Max 30 seconds
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Log scraper run start
   */
  protected async logRunStart(runId: string): Promise<void> {
    await this.supabase.from('scraper_runs').insert({
      id: runId,
      source: this.config.source,
      job_type: this.getJobType(),
      status: 'running',
      started_at: new Date().toISOString()
    })
  }

  /**
   * Log scraper run completion
   */
  protected async logRunComplete(
    runId: string,
    status: 'success' | 'failure' | 'partial',
    result: Partial<ScraperRunResult>,
    durationMs: number
  ): Promise<void> {
    await this.supabase
      .from('scraper_runs')
      .update({
        status,
        records_processed: result.recordsProcessed || 0,
        records_created: result.recordsCreated || 0,
        records_updated: result.recordsUpdated || 0,
        records_failed: result.errors?.length || 0,
        error_message: result.errors?.[0] || null,
        error_details: result.errors && result.errors.length > 0 ?
          { errors: result.errors } : null,
        warnings: result.warnings || [],
        duration_ms: durationMs,
        metadata: result.metadata || {},
        completed_at: new Date().toISOString()
      })
      .eq('id', runId)
  }

  // Abstract methods to be implemented by subclasses

  /**
   * Scrape raw data from source
   */
  protected abstract scrape(): Promise<TRaw[]>

  /**
   * Validate scraped data
   */
  protected abstract validate(data: TRaw[]): ValidationResult

  /**
   * Transform raw data to database format
   */
  protected abstract transform(data: TRaw[]): Promise<TTransformed[]>

  /**
   * Save transformed data to database
   */
  protected abstract save(data: TTransformed[]): Promise<ScraperRunResult>

  /**
   * Get job type for logging
   */
  protected abstract getJobType(): string
}
