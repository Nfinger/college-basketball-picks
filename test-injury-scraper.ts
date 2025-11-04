import { chromium } from 'playwright'

/**
 * Test script to verify the injury scraper can access and parse RotoWire
 * This is a standalone test that doesn't require Inngest or database
 */
async function testInjuryScraper() {
  console.log('\n🏥 Testing RotoWire Injury Scraper\n')

  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()

    console.log('1️⃣ Navigating to RotoWire...')
    await page.goto('https://www.rotowire.com/cbasketball/injury-report.php', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    console.log('   ✅ Page loaded\n')

    console.log('2️⃣ Waiting for table to load...')
    const tableSelectors = [
      '.webix_dtable',
      '.webix_ss_body',
      '[view_id*="datatable"]',
      '.webix_view.webix_datatable'
    ]

    let tableFound = false
    let foundSelector = ''
    for (const selector of tableSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 })
        tableFound = true
        foundSelector = selector
        break
      } catch (e) {
        continue
      }
    }

    if (!tableFound) {
      console.log('   ❌ Could not find Webix DataTable\n')
      console.log('   Available selectors on page:')
      const selectors = await page.evaluate(() => {
        const els = document.querySelectorAll('[class*="webix"]')
        return Array.from(els).slice(0, 5).map(el => el.className)
      })
      console.log('   ', selectors)
      return
    }

    console.log(`   ✅ Found table with selector: ${foundSelector}\n`)

    // Scroll and wait for cells
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForSelector('.webix_cell', { timeout: 5000 }).catch(() => {})

    console.log('3️⃣ Attempting to extract data from Webix instance...')
    const webixData = await page.evaluate(() => {
      // @ts-ignore
      if (typeof webix !== 'undefined' && typeof $$ === 'function') {
        // @ts-ignore
        const views = webix.ui.views
        for (const viewId in views) {
          const view = views[viewId]
          if (view && view.config && view.config.view === 'datatable') {
            try {
              const data: any[] = []
              view.eachRow((rowId: any) => {
                const item = view.getItem(rowId)
                if (item) {
                  data.push({
                    player: item.player || item.Player || '',
                    team: item.team || item.Team || '',
                    injury: item.injury || item.Injury || '',
                    status: item.status || item.Status || ''
                  })
                }
              })
              return { success: true, count: data.length, sample: data.slice(0, 3) }
            } catch (e: any) {
              return { success: false, error: e.message }
            }
          }
        }
      }
      return { success: false, error: 'Webix not found' }
    })

    if (webixData.success) {
      console.log(`   ✅ Successfully extracted ${webixData.count} injuries from Webix\n`)
      console.log('   Sample data:')
      webixData.sample.forEach((injury: any) => {
        console.log(`   - ${injury.player} (${injury.team}): ${injury.injury} - ${injury.status}`)
      })
    } else {
      console.log(`   ⚠️  Webix extraction failed: ${webixData.error}`)
      console.log('   Trying CSS selector fallback...\n')

      const playerCells = await page.$$('.webix_ss_left .webix_cell')
      const otherCells = await page.$$('.webix_ss_center .webix_cell')

      console.log(`   Found ${playerCells.length} player cells, ${otherCells.length} other cells`)

      if (playerCells.length > 0 && otherCells.length > 0) {
        const sample = []
        const rowCount = Math.min(3, playerCells.length)
        const colSize = playerCells.length

        const teamCells = otherCells.slice(0, colSize)
        const injuryCells = otherCells.slice(colSize * 2, colSize * 3)
        const statusCells = otherCells.slice(colSize * 3, colSize * 4)

        for (let i = 0; i < rowCount; i++) {
          const player = await playerCells[i]?.textContent()
          const team = await teamCells[i]?.textContent()
          const injury = await injuryCells[i]?.textContent()
          const status = await statusCells[i]?.textContent()

          sample.push({ player, team, injury, status })
        }

        console.log('   ✅ CSS selector approach working')
        console.log('   Sample data:')
        sample.forEach((injury) => {
          console.log(`   - ${injury.player} (${injury.team}): ${injury.injury} - ${injury.status}`)
        })
      } else {
        console.log('   ❌ CSS selector approach also failed')
      }
    }

    console.log('\n✅ Test complete!')
  } catch (error) {
    console.error('\n❌ Test failed:', error)
  } finally {
    await browser.close()
  }
}

testInjuryScraper().catch(console.error)
