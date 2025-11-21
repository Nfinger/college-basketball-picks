// Generate Daily Stat Chain Puzzle - Inngest Function

import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'
import { PuzzleGenerator } from '../../app/lib/stat-chain/puzzle-generator'

/**
 * Generate Daily Stat Chain Puzzle
 *
 * Uses AI (Claude) to analyze team statistics and create creative connections
 * for the daily puzzle game.
 *
 * Triggered by:
 * - Manual event: stat-chain/generate-puzzle
 * - Orchestrator after data collection completes
 *
 * Prerequisites:
 * - Fresh team statistics in database
 * - ANTHROPIC_API_KEY configured
 */
export const generateDailyPuzzle = inngest.createFunction(
  {
    id: 'generate-daily-puzzle',
    name: 'Generate Daily Stat Chain Puzzle',
    retries: 2, // Retry on AI failures
  },
  { event: 'stat-chain/generate-puzzle' },
  async ({ event, step }) => {
    const puzzleDate = event.data.date || new Date().toISOString().split('T')[0]

    console.log(`[Puzzle Generator] Starting generation for ${puzzleDate}`)

    // Step 1: Check if puzzle already exists
    const existingCheck = await step.run('check-existing-puzzle', async () => {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: existing } = await supabase
        .from('stat_chain_puzzles')
        .select('id')
        .eq('puzzle_date', puzzleDate)
        .maybeSingle()

      if (existing) {
        throw new Error(`Puzzle already exists for ${puzzleDate}`)
      }

      return { exists: false }
    })

    // Step 2: Verify API key is configured
    await step.run('verify-api-key', async () => {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured')
      }
      return { configured: true }
    })

    // Step 3: Generate puzzle with AI
    const puzzleResult = await step.run('generate-with-ai', async () => {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const generator = new PuzzleGenerator(supabase, process.env.ANTHROPIC_API_KEY)

      const result = await generator.generatePuzzle()

      if (!result.success || !result.groups) {
        throw new Error(`AI generation failed: ${result.error}`)
      }

      return {
        groups: result.groups,
        reasoning: result.reasoning,
      }
    })

    // Step 4: Save to database
    const saveResult = await step.run('save-to-database', async () => {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const generator = new PuzzleGenerator(supabase, process.env.ANTHROPIC_API_KEY)

      const result = await generator.savePuzzle(puzzleResult.groups, puzzleDate)

      if (!result.success) {
        throw new Error(`Failed to save puzzle: ${result.error}`)
      }

      return {
        puzzleId: result.puzzleId,
        date: puzzleDate,
      }
    })

    // Step 5: Log success
    console.log(
      `[Puzzle Generator] Successfully generated puzzle ${saveResult.puzzleId} for ${puzzleDate}`
    )

    return {
      success: true,
      puzzleId: saveResult.puzzleId,
      date: puzzleDate,
      groupCount: puzzleResult.groups.length,
      reasoning: puzzleResult.reasoning,
    }
  }
)

/**
 * Backfill Historical Puzzles
 *
 * Generate puzzles for multiple dates (useful for testing or catching up)
 */
export const backfillPuzzles = inngest.createFunction(
  {
    id: 'backfill-puzzles',
    name: 'Backfill Historical Puzzles',
  },
  { event: 'stat-chain/backfill-puzzles' },
  async ({ event, step }) => {
    const { startDate, endDate } = event.data

    console.log(`[Backfill] Generating puzzles from ${startDate} to ${endDate}`)

    // Generate date range
    const dates: string[] = []
    let currentDate = new Date(startDate)
    const end = new Date(endDate)

    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Trigger generation for each date
    const results = await step.run('trigger-generations', async () => {
      const promises = dates.map((date) =>
        inngest.send({
          name: 'stat-chain/generate-puzzle',
          data: { date },
        })
      )

      await Promise.all(promises)

      return { triggered: dates.length }
    })

    return {
      success: true,
      dateRange: { start: startDate, end: endDate },
      puzzlesTriggered: results.triggered,
    }
  }
)
