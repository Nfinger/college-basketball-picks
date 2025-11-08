import * as cheerio from 'cheerio'
import { chromium } from 'playwright'

async function debugColumns() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })
  const page = await context.newPage()

  try {
    await page.goto('https://barttorvik.com/trank.php', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('table', { timeout: 30000 })

    const html = await page.content()
    const $ = cheerio.load(html)
    const table = $('table').first()

    // Look for column headers - they might be in attributes or nearby text
    console.log('=== Analyzing Houston (rank #1) ===')
    const houstonRow = table.find('tbody tr').first()
    const cells = houstonRow.find('td')

    console.log('\nAll cell values for Houston:')
    cells.each((i, cell) => {
      const val = $(cell).text().trim()
      console.log(`[${i.toString().padStart(2)}]: ${val}`)
    })

    console.log('\n=== Analyzing Duke (rank #2) ===')
    const dukeRow = table.find('tbody tr').eq(1)
    const dukeCells = dukeRow.find('td')

    dukeCells.slice(0, 24).each((i, cell) => {
      const val = $(cell).text().trim()
      console.log(`[${i.toString().padStart(2)}]: ${val}`)
    })

    // Look at a mid-tier team for comparison
    console.log('\n=== Row 100 for comparison ===')
    const midRow = table.find('tbody tr').eq(99)
    const midCells = midRow.find('td')
    midCells.slice(0, 24).each((i, cell) => {
      const val = $(cell).text().trim()
      console.log(`[${i.toString().padStart(2)}]: ${val}`)
    })

  } finally {
    await browser.close()
  }
}

debugColumns().catch(console.error)
