import { chromium } from 'playwright'
import * as cheerio from 'cheerio'

async function debug() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto('https://www.espn.com/mens-college-basketball/stats/team/_/view/offensive/table/offensive/sort/avgPoints/dir/desc/page/1', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })

  await page.waitForSelector('tbody tr', { timeout: 10000 })

  const html = await page.content()
  const $ = cheerio.load(html)

  console.log('=== SECOND TBODY STRUCTURE ===\n')

  const secondTbody = $('tbody').eq(1)
  const firstRow = secondTbody.find('tr').first()

  console.log('First row HTML:')
  console.log(firstRow.html())

  console.log('\n\nFirst row children:')
  firstRow.children().each((i, child) => {
    console.log(`  ${i + 1}. Tag: ${child.tagName}, Class: ${$(child).attr('class')}`)
    console.log(`     Text: "${$(child).text().trim().substring(0, 100)}"`)
    console.log(`     Children: ${$(child).children().length}`)
  })

  // Check for divs instead of tds
  console.log('\n\nLooking for divs in first row:')
  const divs = firstRow.find('div')
  console.log(`Found ${divs.length} divs`)

  // Save first row HTML to file
  const fs = await import('fs')
  fs.writeFileSync('/tmp/espn-second-tbody-row.html', firstRow.html() || '')
  console.log('\nFirst row HTML saved to /tmp/espn-second-tbody-row.html')

  await browser.close()
}

debug().catch(console.error)
