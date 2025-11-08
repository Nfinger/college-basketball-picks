import { chromium } from 'playwright'
import * as cheerio from 'cheerio'

/**
 * Quick exploration script to understand ESPN player pages structure
 */
async function exploreESPNPlayers() {
  const browser = await chromium.launch({ headless: false }) // Set to false to see what's happening
  const page = await browser.newPage()

  try {
    // Test with Duke (team ID 150)
    console.log('\n=== Exploring Roster Page ===')
    const rosterUrl = 'https://www.espn.com/mens-college-basketball/team/roster/_/id/150'
    await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('table', { timeout: 10000 })
    await page.waitForTimeout(2000) // Wait for JS to render

    const rosterHtml = await page.content()
    const $roster = cheerio.load(rosterHtml)

    console.log('\n📋 Roster Table Structure:')
    console.log('Number of tables:', $roster('table').length)

    $roster('table').each((i, table) => {
      console.log(`\nTable ${i + 1}:`)
      const headers = cheerio.load(table)('thead th').map((_, th) => cheerio.load(th).text().trim()).get()
      console.log('Headers:', headers)

      const firstRow = cheerio.load(table)('tbody tr').first()
      console.log('First row cells:', firstRow.find('td').map((_, td) => cheerio.load(td).text().trim()).get())

      // Check for player links
      const playerLinks = firstRow.find('a')
      if (playerLinks.length > 0) {
        console.log('Player link found:', playerLinks.first().attr('href'))
      }
    })

    // Now check the stats page
    console.log('\n\n=== Exploring Stats Page ===')
    const statsUrl = 'https://www.espn.com/mens-college-basketball/team/stats/_/id/150'
    await page.goto(statsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('table', { timeout: 10000 })
    await page.waitForTimeout(2000)

    const statsHtml = await page.content()
    const $stats = cheerio.load(statsHtml)

    console.log('\n📊 Stats Table Structure:')
    console.log('Number of tables:', $stats('table').length)

    $stats('table').each((i, table) => {
      console.log(`\nTable ${i + 1}:`)
      const headers = cheerio.load(table)('thead th').map((_, th) => cheerio.load(th).text().trim()).get()
      console.log('Headers:', headers)

      const firstRow = cheerio.load(table)('tbody tr').first()
      const cells = firstRow.find('td').map((_, td) => cheerio.load(td).text().trim()).get()
      console.log('First row cells:', cells.slice(0, 10)) // Just first 10 to avoid clutter

      // Check for structure similar to team stats (two tbodies)
      const tbodies = cheerio.load(table)('tbody')
      console.log('Number of tbody elements:', tbodies.length)
    })

    // Try to find a player profile page
    console.log('\n\n=== Looking for Player Profile ===')
    if ($stats('table tbody tr a').length > 0) {
      const playerLink = $stats('table tbody tr a').first().attr('href')
      if (playerLink) {
        const fullPlayerUrl = playerLink.startsWith('http') ? playerLink : `https://www.espn.com${playerLink}`
        console.log('Found player profile link:', fullPlayerUrl)

        await page.goto(fullPlayerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(2000)

        const playerHtml = await page.content()
        const $player = cheerio.load(playerHtml)

        console.log('\n👤 Player Profile Structure:')
        console.log('Number of tables:', $player('table').length)

        // Look for stats tables
        $player('table').each((i, table) => {
          if (i < 3) { // Just first 3 tables to keep output manageable
            const headers = cheerio.load(table)('thead th').map((_, th) => cheerio.load(th).text().trim()).get()
            console.log(`\nTable ${i + 1} headers:`, headers)
          }
        })
      }
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

exploreESPNPlayers().catch(console.error)
