#!/usr/bin/env tsx
/**
 * Generate Daily Stat Chain Puzzle
 *
 * This script uses AI (Claude) to generate a daily puzzle by analyzing
 * team statistics from KenPom, Torvik, ESPN, and other sources.
 *
 * Prerequisites:
 * 1. Team statistics must be scraped first (run scrapers)
 * 2. ANTHROPIC_API_KEY must be set in .env
 * 3. Supabase connection configured
 *
 * Usage:
 *   # Generate puzzle for today
 *   npx tsx scripts/generate-daily-puzzle.ts
 *
 *   # Generate puzzle for specific date
 *   npx tsx scripts/generate-daily-puzzle.ts 2025-01-15
 *
 *   # Preview only (don't save to database)
 *   npx tsx scripts/generate-daily-puzzle.ts --preview
 */

import { createClient } from '@supabase/supabase-js'
import { PuzzleGenerator } from '../app/lib/stat-chain/puzzle-generator'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

async function main() {
  console.log('🏀 Stat Chain Daily Puzzle Generator\n')

  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase configuration')
    console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  if (!ANTHROPIC_API_KEY) {
    console.error('❌ Missing Anthropic API key')
    console.error('   Set ANTHROPIC_API_KEY in .env')
    console.error('   Get your key at: https://console.anthropic.com/')
    process.exit(1)
  }

  // Parse arguments
  const args = process.argv.slice(2)
  const previewMode = args.includes('--preview')
  const dateArg = args.find((arg) => !arg.startsWith('--'))
  const puzzleDate = dateArg || new Date().toISOString().split('T')[0]

  console.log(`📅 Date: ${puzzleDate}`)
  console.log(`👁️  Preview Mode: ${previewMode ? 'YES' : 'NO'}\n`)

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Check if puzzle already exists for this date
  if (!previewMode) {
    const { data: existing } = await supabase
      .from('stat_chain_puzzles')
      .select('id')
      .eq('puzzle_date', puzzleDate)
      .maybeSingle()

    if (existing) {
      console.log('⚠️  Puzzle already exists for this date!')
      console.log('   Delete it first or choose a different date.')
      process.exit(1)
    }
  }

  // Initialize generator
  console.log('🤖 Initializing AI puzzle generator...')
  const generator = new PuzzleGenerator(supabase, ANTHROPIC_API_KEY)

  // Generate puzzle
  console.log('🎲 Generating puzzle with AI...')
  console.log('   (This may take 30-60 seconds)\n')

  const result = await generator.generatePuzzle()

  if (!result.success || !result.groups) {
    console.error('❌ Failed to generate puzzle')
    console.error(`   Error: ${result.error}`)
    process.exit(1)
  }

  // Display generated puzzle
  console.log('✅ Puzzle generated successfully!\n')
  console.log('═══════════════════════════════════════════════════════\n')

  if (result.reasoning) {
    console.log('💭 AI Reasoning:')
    console.log(`   ${result.reasoning}\n`)
  }

  const difficultyEmojis = {
    easy: '🟡',
    medium: '🟢',
    hard: '🔵',
    expert: '🟣',
  }

  result.groups.forEach((group, idx) => {
    const emoji = difficultyEmojis[group.difficulty as keyof typeof difficultyEmojis]
    console.log(`${emoji} Group ${idx + 1}: ${group.title.toUpperCase()} (${group.difficulty})`)
    console.log(`   Teams: ${group.teamIds.join(', ')}`)
    console.log(`   Connection: ${group.explanation}`)
    console.log()
  })

  console.log('═══════════════════════════════════════════════════════\n')

  // Save to database
  if (previewMode) {
    console.log('👁️  Preview mode - not saving to database')
    console.log('   Run without --preview to save this puzzle')
  } else {
    console.log('💾 Saving puzzle to database...')

    const saveResult = await generator.savePuzzle(result.groups, puzzleDate)

    if (!saveResult.success) {
      console.error('❌ Failed to save puzzle')
      console.error(`   Error: ${saveResult.error}`)
      process.exit(1)
    }

    console.log('✅ Puzzle saved successfully!')
    console.log(`   Puzzle ID: ${saveResult.puzzleId}`)
    console.log(`   Date: ${puzzleDate}`)
    console.log(`   URL: /daily?date=${puzzleDate}`)
  }

  console.log('\n🎉 Done!')
}

main().catch((error) => {
  console.error('\n💥 Unexpected error:')
  console.error(error)
  process.exit(1)
})
