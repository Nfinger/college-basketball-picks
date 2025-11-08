import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import { chromium } from 'playwright'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Quick test to validate ESPN player scraping logic
 * Tests with 3 specific teams without full database integration
 */
async function quickTest() {
  console.log('🏀 Quick ESPN Player Scraper Test\n')

  // Test teams: Duke, UNC, Kansas
  const testTeams = [
    { name: 'Duke', espnId: '150' },
    { name: 'UNC', espnId: '153' },
    { name: 'Kansas', espnId: '2305' }
  ]

  for (const team of testTeams) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing: ${team.name} (ESPN ID: ${team.espnId})`)
    console.log('='.repeat(60))

    try {
      const players = await scrapeTeamPlayers(team.espnId)

      console.log(`\n✅ Found ${players.length} players\n`)

      // Show first 5 players
      players.slice(0, 5).forEach((player, idx) => {
        console.log(`${idx + 1}. ${player.playerName} (${player.position})`)
        console.log(`   GP: ${player.gamesPlayed}, MIN: ${player.minutesPerGame}`)
        console.log(`   PPG: ${player.pointsPerGame}, RPG: ${player.reboundsPerGame}, APG: ${player.assistsPerGame}`)
        console.log(`   FG%: ${player.fieldGoalPct}, FT%: ${player.freeThrowPct}, 3P%: ${player.threePointPct}`)
        if (player.fieldGoalsMade > 0) {
          console.log(`   Totals: ${player.fieldGoalsMade}/${player.fieldGoalsAttempted} FG, ${player.threePointersMade}/${player.threePointersAttempted} 3P`)
        }
        console.log()
      })

      if (players.length > 5) {
        console.log(`... and ${players.length - 5} more players\n`)
      }

      // Validate data
      const issues: string[] = []

      if (players.length === 0) {
        issues.push('No players found!')
      }

      players.forEach(p => {
        if (!p.playerName) issues.push('Player missing name')
        if (p.pointsPerGame < 0 || p.pointsPerGame > 50) issues.push(`${p.playerName}: Invalid PPG (${p.pointsPerGame})`)
        if (p.fieldGoalPct < 0 || p.fieldGoalPct > 100) issues.push(`${p.playerName}: Invalid FG% (${p.fieldGoalPct})`)
      })

      if (issues.length > 0) {
        console.log('⚠️  Validation Issues:')
        issues.forEach(issue => console.log(`   - ${issue}`))
      } else {
        console.log('✅ All validation checks passed!')
      }

    } catch (error) {
      console.error(`❌ Error scraping ${team.name}:`, error)
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('✅ Quick test complete!')
  console.log('='.repeat(60))
}

/**
 * Scrape players for a single team (simplified version for testing)
 */
async function scrapeTeamPlayers(espnTeamId: string): Promise<any[]> {
  const url = `https://www.espn.com/mens-college-basketball/team/stats/_/id/${espnTeamId}`

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })

    await page.waitForSelector('table', { timeout: 10000 })
    await page.waitForTimeout(2000)

    const html = await page.content()
    return parsePlayersFromHTML(html)
  } finally {
    await browser.close()
  }
}

/**
 * Parse players from HTML (same logic as scraper)
 */
function parsePlayersFromHTML(html: string): any[] {
  const $ = cheerio.load(html)
  const players: any[] = []

  const tables = $('table')
  if (tables.length < 2) {
    return players
  }

  const nameTable = tables.eq(0)
  const perGameStatsTable = tables.eq(1)
  const detailedStatsTable = tables.length >= 4 ? tables.eq(3) : null

  const nameRows = nameTable.find('tbody tr')
  const statsRows = perGameStatsTable.find('tbody tr')
  const detailedRows = detailedStatsTable?.find('tbody tr')

  const numPlayers = Math.min(nameRows.length, statsRows.length)

  for (let i = 0; i < numPlayers; i++) {
    const nameCell = nameRows.eq(i).find('td').first()
    let playerText = nameCell.text().trim()

    const match = playerText.match(/^(.+?)\s+([A-Z]{1,2})$/)
    const playerName = match ? match[1].trim() : playerText
    const position = match ? match[2] : ''

    // Skip empty names and total rows
    if (!playerName || playerName.toLowerCase() === 'total') continue

    const statsRow = statsRows.eq(i)
    const statCells = statsRow.find('td')

    const getStat = (index: number): number => {
      const text = statCells.eq(index).text().trim()
      return parseFloat(text) || 0
    }

    const player: any = {
      playerName,
      position,
      gamesPlayed: Math.floor(getStat(0)),
      minutesPerGame: getStat(1),
      pointsPerGame: getStat(2),
      reboundsPerGame: getStat(3),
      assistsPerGame: getStat(4),
      stealsPerGame: getStat(5),
      blocksPerGame: getStat(6),
      turnoversPerGame: getStat(7),
      fieldGoalPct: getStat(8),
      freeThrowPct: getStat(9),
      threePointPct: getStat(10),
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      threePointersMade: 0,
      threePointersAttempted: 0,
      offensiveRebounds: 0,
      defensiveRebounds: 0
    }

    if (detailedRows && i < detailedRows.length) {
      const detailedRow = detailedRows.eq(i)
      const detailedCells = detailedRow.find('td')

      const getDetailedStat = (index: number): number => {
        const text = detailedCells.eq(index).text().trim()
        return parseFloat(text) || 0
      }

      player.fieldGoalsMade = getDetailedStat(1)
      player.fieldGoalsAttempted = getDetailedStat(2)
      player.freeThrowsMade = getDetailedStat(3)
      player.freeThrowsAttempted = getDetailedStat(4)
      player.threePointersMade = getDetailedStat(5)
      player.threePointersAttempted = getDetailedStat(6)
      player.offensiveRebounds = getDetailedStat(8)
      player.defensiveRebounds = getDetailedStat(9)
    }

    players.push(player)
  }

  return players
}

quickTest().catch(console.error)
