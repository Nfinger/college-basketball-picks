import * as cheerio from 'cheerio'

async function testRotoWireScrape() {
  console.log('\n🔍 Testing RotoWire Injury Page Structure\n')

  try {
    const response = await fetch('https://www.rotowire.com/cbasketball/injury-report.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      console.log(`❌ Failed to fetch: ${response.status} ${response.statusText}`)
      return
    }

    console.log('✅ Page fetched successfully')

    const html = await response.text()
    const $ = cheerio.load(html)

    console.log(`📄 Page size: ${(html.length / 1024).toFixed(2)} KB\n`)

    // Try to find injury tables/sections
    console.log('🔎 Looking for injury data structures...\n')

    // Common selectors for injury data
    const possibleSelectors = [
      'table',
      '.injury-table',
      '.injury-report',
      '[class*="injury"]',
      '[class*="player"]',
      'tbody tr',
    ]

    for (const selector of possibleSelectors) {
      const elements = $(selector)
      if (elements.length > 0) {
        console.log(`✓ Found ${elements.length} elements matching: ${selector}`)

        // Show first few examples
        if (selector === 'tbody tr' && elements.length > 0) {
          console.log('  Sample rows:')
          elements.slice(0, 3).each((i, el) => {
            const text = $(el).text().trim().substring(0, 100)
            if (text) console.log(`    ${i + 1}. ${text}...`)
          })
        }
      }
    }

    // Look for team names
    console.log('\n🏀 Looking for team names...')
    const teamElements = $('[class*="team"], h2, h3').slice(0, 5)
    teamElements.each((i, el) => {
      const text = $(el).text().trim()
      if (text && text.length < 50) {
        console.log(`  - ${text}`)
      }
    })

    // Try to find table headers to understand structure
    console.log('\n📊 Table headers found:')
    $('th, thead td').each((i, el) => {
      const text = $(el).text().trim()
      if (text) console.log(`  - ${text}`)
    })

    // Check for specific injury status indicators
    console.log('\n🏥 Looking for injury status indicators...')
    const statusKeywords = ['out', 'questionable', 'doubtful', 'probable', 'day-to-day', 'gtd']
    for (const keyword of statusKeywords) {
      const count = html.toLowerCase().split(keyword).length - 1
      if (count > 0) {
        console.log(`  ✓ Found "${keyword}" ${count} times`)
      }
    }

    // Look for JSON data in script tags
    console.log('\n📦 Looking for JSON data in page...')
    $('script').each((i, el) => {
      const scriptContent = $(el).html()
      if (scriptContent && (scriptContent.includes('injury') || scriptContent.includes('player'))) {
        const lines = scriptContent.substring(0, 500)
        if (lines.includes('{') || lines.includes('[')) {
          console.log(`  ✓ Found potential data in script tag ${i + 1}`)
          console.log(`    Preview: ${lines.substring(0, 200)}...`)
        }
      }
    })

    // Save a sample of the HTML for inspection
    console.log('\n💾 Saving HTML sample for inspection...')
    const fs = await import('fs')
    fs.writeFileSync('/tmp/rotowire-sample.html', html)
    console.log('  Saved to: /tmp/rotowire-sample.html')

    console.log('\n✅ Page analysis complete')
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testRotoWireScrape().catch(console.error)
