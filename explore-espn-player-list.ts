import { chromium } from 'playwright'
import * as cheerio from 'cheerio'

/**
 * Check if ESPN has a player stats listing page (like they do for teams)
 */
async function explorePlayerList() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  try {
    // Try the player stats URL (similar to team stats)
    const url = 'https://www.espn.com/mens-college-basketball/stats/player'
    console.log(`\nChecking: ${url}\n`)

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000) // Wait for page to load

    const html = await page.content()
    const $ = cheerio.load(html)

    console.log('Page title:', $('title').text())
    console.log('Number of tables:', $('table').length)

    if ($('table').length > 0) {
      console.log('\n✅ Found tables! Checking first few rows...\n')

      $('table').each((i, table) => {
        if (i < 2) { // Just first 2 tables
          console.log(`Table ${i + 1}:`)
          const headers = cheerio.load(table)('thead th').map((_, th) => cheerio.load(th).text().trim()).get()
          console.log('Headers:', headers.slice(0, 10))

          const firstRow = cheerio.load(table)('tbody tr').first()
          const cells = firstRow.find('td').map((_, td) => cheerio.load(td).text().trim()).get()
          console.log('First row:', cells.slice(0, 10))
          console.log()
        }
      })
    } else {
      console.log('❌ No tables found')
    }

    console.log('\nKeeping browser open for 5 seconds to inspect...')
    await page.waitForTimeout(5000)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

explorePlayerList().catch(console.error)
