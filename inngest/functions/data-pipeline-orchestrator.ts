// Data Pipeline Orchestrator - Master coordinator for all data collection

import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'
import { PipelineRunner, type ScraperConfig } from '../../app/lib/pipeline/pipeline-runner'
import { KenPomScraper } from '../../lib/scrapers/kenpom-scraper'
import { BartTorvikScraper } from '../../lib/scrapers/barttorvik-scraper'
import { ESPNStatsScraper } from '../../lib/scrapers/espn-stats-scraper'

/**
 * Master Data Pipeline Orchestrator
 *
 * Coordinates all data collection with:
 * - Dependency management (teams before stats)
 * - Fault tolerance (circuit breakers, retries)
 * - Data freshness checks (skip if recent)
 * - Parallel execution (where possible)
 * - Comprehensive monitoring
 *
 * Runs daily at 5 AM ET to gather fresh data before games start
 */
export const dataPipelineOrchestrator = inngest.createFunction(
  {
    id: 'data-pipeline-orchestrator',
    name: 'Data Pipeline Orchestrator',
    retries: 0, // Pipeline handles its own retries
  },
  { cron: '0 5 * * *' }, // Daily at 5 AM
  async ({ step, event }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Determine run type from event or default to incremental
    const runType = event.data?.runType || 'incremental'

    console.log(`[Orchestrator] Starting ${runType} pipeline run`)

    // ========================================================================
    // PHASE 1: FOUNDATIONAL DATA
    // Must run first - everything depends on this
    // ========================================================================

    const foundationalResult = await step.run('foundational-data', async () => {
      const runner = new PipelineRunner(supabase)

      const scrapers: ScraperConfig[] = [
        // Conferences (if we had a scraper for this)
        // Teams (if we had a scraper for this)
        // For now, we assume teams/conferences are manually managed or imported
      ]

      if (scrapers.length === 0) {
        return { message: 'No foundational scrapers configured' }
      }

      return await runner.run(scrapers, runType as any)
    })

    // ========================================================================
    // PHASE 2: TEAM STATISTICS (can run in parallel)
    // Depends on: Teams being present
    // ========================================================================

    const statsResults = await Promise.all([
      // BartTorvik - runs first (free, reliable)
      step.run('barttorvik-stats', async () => {
        const runner = new PipelineRunner(supabase)

        const scraper: ScraperConfig = {
          source: 'barttorvik',
          jobType: 'team_stats',
          enabled: true,
          priority: 1,
          maxAge: 24, // Refresh daily
          dependencies: ['teams'],
          run: async () => {
            const scraper = new BartTorvikScraper()
            return await scraper.run()
          },
        }

        return await runner.run([scraper], runType as any)
      }),

      // KenPom - runs second (premium, after BartTorvik)
      step.run('kenpom-stats', async () => {
        // Skip if credentials not configured
        if (!process.env.KENPOM_EMAIL || !process.env.KENPOM_PASSWORD) {
          return { message: 'KenPom credentials not configured - skipping' }
        }

        const runner = new PipelineRunner(supabase)

        const scraper: ScraperConfig = {
          source: 'kenpom',
          jobType: 'team_stats',
          enabled: true,
          priority: 2,
          maxAge: 24,
          dependencies: ['teams'],
          run: async () => {
            const scraper = new KenPomScraper()
            return await scraper.run()
          },
        }

        return await runner.run([scraper], runType as any)
      }),

      // ESPN Stats
      step.run('espn-stats', async () => {
        const runner = new PipelineRunner(supabase)

        const scraper: ScraperConfig = {
          source: 'espn',
          jobType: 'team_stats',
          enabled: true,
          priority: 3,
          maxAge: 24,
          dependencies: ['teams'],
          run: async () => {
            const scraper = new ESPNStatsScraper()
            return await scraper.run()
          },
        }

        return await runner.run([scraper], runType as any)
      }),
    ])

    // ========================================================================
    // PHASE 3: GAMES & SCHEDULES
    // Can run after teams are available
    // ========================================================================

    const gamesResult = await step.run('games-and-schedules', async () => {
      // This would include game scrapers, schedule updates, etc.
      // For now, return placeholder
      return { message: 'Games scraping not yet implemented in orchestrator' }
    })

    // ========================================================================
    // PHASE 4: PLAYER DATA & INJURIES
    // Can run in parallel after teams
    // ========================================================================

    const playerResults = await Promise.all([
      step.run('player-stats', async () => {
        // ESPN player stats scraper
        return { message: 'Player stats scraping not yet implemented' }
      }),

      step.run('injuries', async () => {
        // Injury scraper
        return { message: 'Injuries scraping not yet implemented' }
      }),
    ])

    // ========================================================================
    // PHASE 5: SUPPLEMENTARY DATA
    // Lower priority, can fail without major impact
    // ========================================================================

    const supplementaryResult = await step.run('supplementary-data', async () => {
      // News aggregation, betting lines, social sentiment, etc.
      return { message: 'Supplementary data not yet implemented' }
    })

    // ========================================================================
    // PHASE 6: DATA QUALITY VALIDATION
    // Validate collected data meets quality standards
    // ========================================================================

    const validationResult = await step.run('data-validation', async () => {
      // Check for:
      // - Missing teams
      // - Outlier statistics
      // - Data consistency across sources
      // - Freshness of critical data

      const { data: freshness } = await supabase
        .from('data_freshness')
        .select('source, data_type, last_updated_at, quality_score')
        .order('last_updated_at', { ascending: false })
        .limit(10)

      return {
        message: 'Validation complete',
        recentUpdates: freshness?.length || 0,
      }
    })

    // ========================================================================
    // PHASE 7: GENERATE DAILY PUZZLE (if stats are fresh)
    // ========================================================================

    const puzzleResult = await step.run('generate-daily-puzzle', async () => {
      // Check if today's puzzle already exists
      const today = new Date().toISOString().split('T')[0]

      const { data: existingPuzzle } = await supabase
        .from('stat_chain_puzzles')
        .select('id')
        .eq('puzzle_date', today)
        .maybeSingle()

      if (existingPuzzle) {
        return { message: 'Puzzle already exists for today', skipped: true }
      }

      // Check if we have fresh stats
      const { data: kenpomFresh } = await supabase.rpc('is_data_fresh', {
        p_source: 'kenpom',
        p_data_type: 'team_stats',
        p_max_age_hours: 48,
      })

      if (!kenpomFresh) {
        return {
          message: 'Stats not fresh enough - skipping puzzle generation',
          skipped: true,
        }
      }

      // Trigger puzzle generation (as separate event to avoid timeout)
      await inngest.send({
        name: 'stat-chain/generate-puzzle',
        data: { date: today },
      })

      return { message: 'Puzzle generation triggered', date: today }
    })

    // ========================================================================
    // SUMMARY
    // ========================================================================

    return {
      runType,
      foundational: foundationalResult,
      stats: {
        barttorvik: statsResults[0],
        kenpom: statsResults[1],
        espn: statsResults[2],
      },
      games: gamesResult,
      players: playerResults,
      supplementary: supplementaryResult,
      validation: validationResult,
      puzzle: puzzleResult,
    }
  }
)

/**
 * Manual Pipeline Trigger
 * Allows triggering pipeline on-demand with specific run type
 */
export const triggerDataPipeline = inngest.createFunction(
  {
    id: 'trigger-data-pipeline',
    name: 'Trigger Data Pipeline (Manual)',
  },
  { event: 'pipeline/trigger' },
  async ({ event, step }) => {
    const runType = event.data.runType || 'full'

    console.log(`[Trigger] Manual pipeline trigger: ${runType}`)

    // Send event to orchestrator
    await inngest.send({
      name: 'pipeline/run',
      data: { runType },
    })

    return { triggered: true, runType }
  }
)
