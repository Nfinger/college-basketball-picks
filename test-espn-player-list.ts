import { chromium } from 'playwright'
import * as cheerio from 'cheerio'

/**
 * Quick test to validate the refactored ESPN player list scraping
 */
async function testPlayerListScraping() {
  console.log('🏀 Testing ESPN Player List Scraping\n')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // Test page 1
    const url = 'https://www.espn.com/mens-college-basketball/stats/player/_/season/2025/seasontype/2/page/1'
    console.log(`Fetching: ${url}\n`)

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('tbody tr', { timeout: 10000 })
    await page.waitForTimeout(2000)

    const html = await page.content()
    const $ = cheerio.load(html)

    const tables = $('table')
    console.log(`Found ${tables.length} tables\n`)

    if (tables.length >= 2) {
      const nameTable = tables.eq(0)
      const statsTable = tables.eq(1)

      const nameRows = nameTable.find('tbody tr')
      const statsRows = statsTable.find('tbody tr')

      console.log(`Name rows: ${nameRows.length}`)
      console.log(`Stats rows: ${statsRows.length}\n`)

      console.log('Sample Players:\n')

      // Parse first 5 players
      for (let i = 0; i < Math.min(5, nameRows.length); i++) {
        const nameCell = nameRows.eq(i).find('td').eq(1)
        const nameText = nameCell.text().trim()

        // Extract name and team abbreviation
        const match = nameText.match(/^(.+?)([A-Z]{2,5})$/)
        if (!match) {
          console.log(`${i + 1}. Could not parse: ${nameText}`)
          continue
        }

        const playerName = match[1].trim()
        const teamAbbr = match[2]

        const statsRow = statsRows.eq(i)
        const statCells = statsRow.find('td')

        const position = statCells.eq(0).text().trim()
        const gp = statCells.eq(1).text().trim()
        const ppg = statCells.eq(3).text().trim()
        const rpg = statCells.eq(13).text().trim()
        const apg = statCells.eq(14).text().trim()

        console.log(`${i + 1}. ${playerName} (${teamAbbr}) - ${position}`)
        console.log(`   GP: ${gp}, PPG: ${ppg}, RPG: ${rpg}, APG: ${apg}\n`)
      }

      console.log('✅ Player list scraping works!')
    } else {
      console.log('❌ Not enough tables found')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await browser.close()
  }
}

testPlayerListScraping().catch(console.error)
