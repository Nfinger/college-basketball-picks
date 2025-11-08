/**
 * Script to find ESPN's stats API endpoint
 * They likely have a JSON API that the page calls
 */
import { chromium } from 'playwright'

async function findAPI() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Track network requests to find the API endpoint
  const apiRequests: string[] = []

  page.on('response', async (response) => {
    const url = response.url()
    // Look for JSON responses that might contain stats data
    if (url.includes('stats') || url.includes('api') || url.includes('json')) {
      console.log(`API Request found: ${url}`)
      console.log(`Status: ${response.status()}`)
      apiRequests.push(url)

      try {
        const contentType = response.headers()['content-type']
        if (contentType?.includes('json')) {
          const data = await response.json()
          console.log('Response preview:', JSON.stringify(data).slice(0, 500))
          console.log('---')
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  })

  console.log('Loading ESPN stats page...\n')
  await page.goto('https://www.espn.com/mens-college-basketball/stats/team/_/view/offensive/table/offensive/sort/avgPoints/dir/desc/page/1', {
    waitUntil: 'networkidle'
  })

  // Wait a bit more for dynamic content
  await page.waitForTimeout(3000)

  console.log(`\nFound ${apiRequests.length} potential API endpoints:`)
  apiRequests.forEach(url => console.log(`  - ${url}`))

  await browser.close()
}

findAPI().catch(console.error)
