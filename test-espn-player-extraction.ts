import { chromium } from 'playwright'
import * as cheerio from 'cheerio'

/**
 * Test extracting actual player data from ESPN
 */
async function testPlayerExtraction() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // Test with Duke (team ID 150)
    console.log('Fetching Duke player stats...\n')
    const statsUrl = 'https://www.espn.com/mens-college-basketball/team/stats/_/id/150'
    await page.goto(statsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('table', { timeout: 10000 })
    await page.waitForTimeout(2000)

    const html = await page.content()
    const $ = cheerio.load(html)

    // ESPN uses multiple tables for player stats
    // Based on exploration: Table 1 & 3 have names, Table 2 has per-game stats
    const tables = $('table')
    console.log(`Found ${tables.length} tables\n`)

    if (tables.length >= 2) {
      const nameTbody = tables.eq(0).find('tbody')
      const statsTbody = tables.eq(1).find('tbody')

      const nameRows = nameTbody.find('tr')
      const statsRows = statsTbody.find('tr')

      console.log(`Player rows: ${nameRows.length}`)
      console.log(`Stats rows: ${statsRows.length}\n`)

      // Extract players
      const players: any[] = []
      const numPlayers = Math.min(nameRows.length, statsRows.length)

      for (let i = 0; i < numPlayers && i < 5; i++) { // Just first 5 for testing
        const nameRow = nameRows.eq(i)
        const statsRow = statsRows.eq(i)

        // Get player name and position
        let playerText = nameRow.find('td').first().text().trim()
        // Format: "Isaiah Evans G" - name followed by position
        const match = playerText.match(/^(.+?)\s+([A-Z]{1,2})$/)
        const playerName = match ? match[1].trim() : playerText
        const position = match ? match[2] : ''

        // Get stats from cells
        const statCells = statsRow.find('td')
        const getStat = (index: number): string => {
          return statCells.eq(index).text().trim()
        }

        // Table 2 headers: GP, MIN, PTS, REB, AST, STL, BLK, TO, FG%, FT%, 3P%
        const player = {
          name: playerName,
          position: position,
          gamesPlayed: getStat(0),
          minutesPerGame: getStat(1),
          pointsPerGame: getStat(2),
          reboundsPerGame: getStat(3),
          assistsPerGame: getStat(4),
          stealsPerGame: getStat(5),
          blocksPerGame: getStat(6),
          turnoversPerGame: getStat(7),
          fieldGoalPct: getStat(8),
          freeThrowPct: getStat(9),
          threePointPct: getStat(10)
        }

        players.push(player)
        console.log(`${i + 1}. ${player.name} (${player.position})`)
        console.log(`   PPG: ${player.pointsPerGame}, RPG: ${player.reboundsPerGame}, APG: ${player.assistsPerGame}`)
        console.log(`   FG%: ${player.fieldGoalPct}, FT%: ${player.freeThrowPct}, 3P%: ${player.threePointPct}\n`)
      }

      // Now check if we can get more detailed stats from table 4
      if (tables.length >= 4) {
        console.log('\n=== Detailed Stats (Table 4) ===\n')
        const detailedStatsTbody = tables.eq(3).find('tbody')
        const detailedRows = detailedStatsTbody.find('tr')

        for (let i = 0; i < Math.min(3, detailedRows.length); i++) {
          const row = detailedRows.eq(i)
          const cells = row.find('td')

          // Table 4 headers: MIN, FGM, FGA, FTM, FTA, 3PM, 3PA, PTS, OR, DR, REB, AST, TO, STL, BLK
          console.log(`Player ${i + 1}:`)
          console.log(`  FGM/FGA: ${cells.eq(1).text()}/${cells.eq(2).text()}`)
          console.log(`  FTM/FTA: ${cells.eq(3).text()}/${cells.eq(4).text()}`)
          console.log(`  3PM/3PA: ${cells.eq(5).text()}/${cells.eq(6).text()}`)
          console.log(`  OR/DR: ${cells.eq(8).text()}/${cells.eq(9).text()}\n`)
        }
      }

      console.log(`\n✅ Successfully extracted ${players.length} players`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

testPlayerExtraction().catch(console.error)
