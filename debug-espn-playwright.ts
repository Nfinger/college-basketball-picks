import { chromium } from 'playwright'
import * as cheerio from 'cheerio'

async function debug() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const url = 'https://www.espn.com/mens-college-basketball/stats/team/_/view/offensive/table/offensive/sort/avgPoints/dir/desc/page/1'

  console.log('Navigating to:', url)

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })

  console.log('Waiting for tbody tr...')
  await page.waitForSelector('tbody tr', { timeout: 10000 })

  const html = await page.content()
  const $ = cheerio.load(html)

  console.log('\nPage title:', await page.title())
  console.log('HTML length:', html.length)

  // Check for tables
  const tables = $('table')
  console.log(`\nFound ${tables.length} table(s)`)

  // Check for tbody
  const tbody = $('tbody')
  console.log(`Found ${tbody.length} tbody element(s)`)

  // Check for rows in each tbody
  tbody.each((i, tb) => {
    const rows = $(tb).find('tr')
    console.log(`  tbody ${i + 1}: ${rows.length} rows`)

    // Show first row details
    if (rows.length > 0) {
      const firstRow = rows.first()
      const cells = firstRow.find('td')
      console.log(`    First row has ${cells.length} cells`)

      if (cells.length > 0) {
        console.log('    First 5 cell texts:')
        cells.slice(0, 5).each((j, cell) => {
          console.log(`      Cell ${j + 1}: "${$(cell).text().trim()}"`)
        })
      }
    }
  })

  // Save full HTML for inspection
  const fs = await import('fs')
  fs.writeFileSync('/tmp/espn-playwright-debug.html', html)
  console.log('\nFull HTML saved to /tmp/espn-playwright-debug.html')

  // Look for team names in the HTML
  const hasTeamNames = html.includes('Kansas') || html.includes('Duke') || html.includes('Houston')
  console.log(`\nContains known team names: ${hasTeamNames}`)

  await browser.close()
}

debug().catch(console.error)
