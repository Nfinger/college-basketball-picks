import { chromium } from 'playwright'

async function debug() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  console.log('Loading ESPN stats page...')

  await page.goto('https://www.espn.com/mens-college-basketball/stats/team/_/view/offensive/table/offensive/sort/avgPoints/dir/desc/page/1')

  console.log('Waiting for tbody rows...')
  await page.waitForSelector('tbody tr', { timeout: 10000 })

  console.log('Waiting additional time for stats to load...')
  await page.waitForTimeout(5000)

  // Try to find any element with numbers (stats)
  console.log('Looking for stat numbers...')

  // Check if there are any table cells with numeric data
  const statCells = await page.$$eval('tbody td', (cells) => {
    return cells
      .map((cell, i) => ({
        index: i,
        text: cell.textContent?.trim() || '',
        class: cell.className
      }))
      .filter(cell => /\d/.test(cell.text)) // Has at least one digit
      .slice(0, 20) // First 20 matches
  })

  console.log(`Found ${statCells.length} cells with numbers:`)
  statCells.forEach(cell => {
    console.log(`  [${cell.index}] ${cell.class}: "${cell.text}"`)
  })

  // Take a screenshot
  await page.screenshot({ path: '/tmp/espn-stats-screenshot.png', fullPage: true })
  console.log('\nScreenshot saved to /tmp/espn-stats-screenshot.png')

  await browser.close()
}

debug().catch(console.error)
