import { chromium } from 'playwright'

async function testPlaywrightRotoWire() {
  console.log('\n🎭 Testing RotoWire with Playwright\n')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    console.log('Loading page...')
    await page.goto('https://www.rotowire.com/cbasketball/injury-report.php', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })

    // Wait a bit more for JS to execute
    await page.waitForTimeout(5000)

    console.log('✅ Page loaded, waiting for data...\n')

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2000)

    console.log('🔍 Looking for injury data...\n')

    // Try to find Webix rows
    const webixRows = await page.$$('[role="row"]:not([section="header"])')
    console.log(`Found ${webixRows.length} webix rows`)

    // Try regular table rows
    const tableRows = await page.$$('tbody tr[role="row"]:not([section="header"])')
    console.log(`Found ${tableRows.length} data rows`)

    // Webix splits columns into sections - extract each column separately
    const playerCells = await page.$$('.webix_ss_left .webix_cell')
    const otherCells = await page.$$('.webix_ss_center .webix_cell')

    console.log(`Found ${playerCells.length} player cells in left section`)
    console.log(`Found ${otherCells.length} other cells in center section`)

    if (playerCells.length > 0 && otherCells.length > 0) {
      console.log('\n📋 Extracting injury data...\n')

      // Cells are organized by column: all team cells, then all pos cells, etc.
      // 5 columns: Team, Pos, Injury, Status, Est. Return
      const rowCount = playerCells.length
      const colsPerRow = Math.floor(otherCells.length / rowCount)
      console.log(`Found ${rowCount} injury entries with ${colsPerRow} columns\n`)

      // Calculate column start indices
      const colSize = rowCount
      const teamCells = otherCells.slice(0, colSize)
      const posCells = otherCells.slice(colSize, colSize * 2)
      const injuryCells = otherCells.slice(colSize * 2, colSize * 3)
      const statusCells = otherCells.slice(colSize * 3, colSize * 4)
      const returnCells = otherCells.slice(colSize * 4, colSize * 5)

      for (let i = 0; i < Math.min(5, rowCount); i++) {
        const player = await playerCells[i]?.textContent()
        const team = await teamCells[i]?.textContent()
        const pos = await posCells[i]?.textContent()
        const injury = await injuryCells[i]?.textContent()
        const status = await statusCells[i]?.textContent()
        const estReturn = await returnCells[i]?.textContent()

        console.log(`${i + 1}. ${player?.trim()} | ${team?.trim()} | ${pos?.trim()} | ${injury?.trim()} | ${status?.trim()} | ${estReturn?.trim()}`)
      }
    }

    // Save screenshot
    await page.screenshot({ path: '/tmp/rotowire-injuries.png', fullPage: true })
    console.log('\n📸 Screenshot saved to /tmp/rotowire-injuries.png')

    // Save HTML
    const html = await page.content()
    const fs = await import('fs')
    fs.writeFileSync('/tmp/rotowire-rendered.html', html)
    console.log('💾 Rendered HTML saved to /tmp/rotowire-rendered.html')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await browser.close()
  }
}

testPlaywrightRotoWire().catch(console.error)
