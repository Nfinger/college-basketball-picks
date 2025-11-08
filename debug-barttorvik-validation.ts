import * as cheerio from 'cheerio'
import { chromium } from 'playwright'

async function debugValidation() {
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

    console.log('Checking all teams for validation issues...\n')

    const invalidTeams: any[] = []

    table.find('tbody tr').each((index, row) => {
      const cells = $(row).find('td')
      if (cells.length < 15) return

      const teamText = cells.eq(1).text().trim()
      const teamName = teamText.split(/\s+(?:\(|\@)/)[0].trim()

      if (!teamName || teamName.toLowerCase().includes('d-i avg')) return

      const adjustedOffense = parseFloat(cells.eq(5).text().trim()) || 0
      const adjustedDefense = parseFloat(cells.eq(6).text().trim()) || 0
      const adjustedTempo = parseFloat(cells.eq(22).text().trim()) || 0

      const isInvalid = (
        adjustedOffense < 80 || adjustedOffense > 135 ||
        adjustedDefense < 70 || adjustedDefense > 125 ||
        adjustedTempo < 55 || adjustedTempo > 85
      )

      if (isInvalid) {
        invalidTeams.push({
          rank: index + 1,
          teamName,
          adjustedOffense,
          adjustedDefense,
          adjustedTempo
        })
      }
    })

    if (invalidTeams.length === 0) {
      console.log('No invalid teams found!')
    } else {
      console.log(`Found ${invalidTeams.length} invalid team(s):\n`)
      invalidTeams.forEach(team => {
        console.log(`Rank ${team.rank}: ${team.teamName}`)
        console.log(`  AdjOE: ${team.adjustedOffense} ${team.adjustedOffense < 80 || team.adjustedOffense > 135 ? '❌' : '✓'}`)
        console.log(`  AdjDE: ${team.adjustedDefense} ${team.adjustedDefense < 70 || team.adjustedDefense > 125 ? '❌' : '✓'}`)
        console.log(`  Tempo: ${team.adjustedTempo} ${team.adjustedTempo < 55 || team.adjustedTempo > 85 ? '❌' : '✓'}`)
        console.log()
      })
    }

  } finally {
    await browser.close()
  }
}

debugValidation().catch(console.error)
