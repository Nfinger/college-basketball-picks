import * as cheerio from 'cheerio'
import { chromium } from 'playwright'

async function debugBartTorvikTable() {
  console.log('Fetching BartTorvik page with Playwright...\n')

  const url = 'https://barttorvik.com/trank.php'

  // Launch browser
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })
  const page = await context.newPage()

  try {
    console.log('Loading page...')
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

    // Wait for the table to appear
    console.log('Waiting for table...')
    await page.waitForSelector('table', { timeout: 30000 })

    const html = await page.content()
    console.log(`HTML loaded: ${html.length} bytes\n`)

    const $ = cheerio.load(html)
    const table = $('table').first()

    console.log('=== Table Structure ===')
    console.log('Table found:', table.length > 0)

    // Get header row
    const headerRow = table.find('thead tr').first()
    if (headerRow.length === 0) {
      console.log('No thead found, checking first tr...')
      const firstRow = table.find('tr').first()
      console.log('\nFirst row cells:')
      firstRow.find('th, td').each((i, cell) => {
        const text = $(cell).text().trim()
        console.log(`  [${i}]: ${text}`)
      })
    } else {
      console.log('\nHeader columns:')
      headerRow.find('th, td').each((i, cell) => {
        const text = $(cell).text().trim()
        console.log(`  [${i}]: ${text}`)
      })
    }

    // Get first few data rows
    console.log('\n=== First 3 Data Rows ===')
    table.find('tbody tr').slice(0, 3).each((rowIndex, row) => {
      console.log(`\nRow ${rowIndex + 1}:`)
      $(row).find('td').each((i, cell) => {
        const text = $(cell).text().trim()
        console.log(`  [${i}]: ${text}`)
      })
    })

  } finally {
    await browser.close()
  }
}

debugBartTorvikTable().catch(console.error)
