import { chromium } from 'playwright'
import * as cheerio from 'cheerio'

async function captureTableInfo() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  })
  const page = await context.newPage()

  try {
    await page.goto('https://barttorvik.com/trank.php', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('table', { timeout: 30000 })

    // Take a screenshot of the table
    const table = await page.locator('table').first()
    await table.screenshot({ path: '/tmp/barttorvik-table.png' })
    console.log('Screenshot saved to /tmp/barttorvik-table.png')

    // Try to get column headers by looking at th elements or title attributes
    const html = await page.content()
    const $ = cheerio.load(html)

    console.log('\n=== Looking for column headers ===')
    const headerCells = $('table').first().find('thead th, thead td')
    console.log('Found', headerCells.length, 'header cells in thead')

    headerCells.each((i, cell) => {
      const text = $(cell).text().trim()
      const title = $(cell).attr('title') || ''
      const abbr = $(cell).find('abbr').attr('title') || ''
      console.log(`[${i}]: text="${text}" title="${title}" abbr="${abbr}"`)
    })

    // Also check if there are any sortable column headers with data attributes
    console.log('\n=== Checking for data attributes on headers ===')
    $('table').first().find('th').each((i, cell) => {
      const attrs = Object.keys(cell.attribs || {})
      if (attrs.length > 0) {
        console.log(`Column ${i} attributes:`, cell.attribs)
      }
    })

  } finally {
    await browser.close()
  }
}

captureTableInfo().catch(console.error)
