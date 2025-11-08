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

  const tbodies = $('tbody')
  console.log(`Found ${tbodies.length} tbody elements\n`)

  tbodies.each((i, tbody) => {
    const rows = $(tbody).find('tr')
    console.log(`\n=== TBODY ${i + 1} ===`)
    console.log(`Rows: ${rows.length}`)

    const firstRow = rows.first()
    const cells = firstRow.find('td')
    console.log(`First row cells: ${cells.length}`)

    cells.each((j, cell) => {
      const text = $(cell).text().trim()
      console.log(`  Cell ${j + 1}: "${text.substring(0, 50)}"`)
    })
  })

  // Try to extract data from both tables
  console.log('\n=== EXTRACTING TEAM DATA ===')

  const teamRows = $('tbody').eq(0).find('tr')
  const statsRows = $('tbody').eq(1).find('tr')

  console.log(`Team rows: ${teamRows.length}`)
  console.log(`Stats rows: ${statsRows.length}`)

  for (let i = 0; i < Math.min(3, teamRows.length); i++) {
    const teamName = $(teamRows[i]).text().trim()
    const statsCells = $(statsRows[i]).find('td')

    console.log(`\nTeam ${i + 1}: ${teamName}`)
    console.log(`  Stats cells: ${statsCells.length}`)

    statsCells.slice(0, 10).each((j, cell) => {
      const text = $(cell).text().trim()
      console.log(`    Stat ${j + 1}: ${text}`)
    })
  }

  await browser.close()
}

debug().catch(console.error)
