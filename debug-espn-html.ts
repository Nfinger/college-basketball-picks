/**
 * Debug script to inspect ESPN stats page HTML
 */
async function main() {
  const url = 'https://www.espn.com/mens-college-basketball/stats/team/_/view/offensive/table/offensive/sort/avgPoints/dir/desc/page/1'

  console.log(`Fetching: ${url}\n`)

  const response = await fetch(url)
  const html = await response.text()

  console.log(`Response status: ${response.status}`)
  console.log(`HTML length: ${html.length} characters\n`)

  // Check for common selectors
  const hasTable = html.includes('class="Table"')
  const hasTbody = html.includes('<tbody')
  const hasStatsContainer = html.includes('stats')

  console.log(`Contains class="Table": ${hasTable}`)
  console.log(`Contains <tbody>: ${hasTbody}`)
  console.log(`Contains "stats": ${hasStatsContainer}\n`)

  // Find all class names that might be relevant
  const classMatches = html.match(/class="[^"]+"/g)
  const uniqueClasses = [...new Set(classMatches?.slice(0, 50) || [])]

  console.log('First 50 unique classes found:')
  uniqueClasses.forEach(c => console.log(`  ${c}`))

  // Save HTML to file for inspection
  const fs = await import('fs')
  const outputPath = '/tmp/espn-stats-page.html'
  fs.writeFileSync(outputPath, html)
  console.log(`\nFull HTML saved to: ${outputPath}`)

  // Check if it's a client-side rendered page (React/Angular/etc)
  const hasReactRoot = html.includes('id="root"') || html.includes('id="app"')
  const hasScript = html.includes('<script')
  console.log(`\nLooks like client-side rendered: ${hasReactRoot || !hasTbody}`)
  console.log(`Has script tags: ${hasScript}`)
}

main().catch(console.error)
