import { chromium } from 'playwright'

/**
 * Debug script to verify KenPom authentication
 */
async function main() {
  console.log('Testing KenPom authentication...\n')

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setViewportSize({ width: 1920, height: 1080 })

  const email = process.env.KENPOM_EMAIL || 'nfinger1020@gmail.com'
  const password = process.env.KENPOM_PASSWORD || 'Ilmfmtaitw102018'

  console.log('Navigating to KenPom...')
  await page.goto('https://kenpom.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  })

  await page.waitForTimeout(2000)

  console.log(`\nAttempting login with: ${email}`)

  // Fill and submit login form
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {}),
    page.click('input[type="submit"]')
  ])

  await page.waitForTimeout(2000)

  // Check for various indicators of successful login
  console.log('\nChecking authentication status...')

  // 1. Check for logout link
  const logoutLink = await page.$('a[href*="logout"]')
  console.log(`Logout link found: ${!!logoutLink}`)

  // 2. Check for login form still present (means login failed)
  const loginForm = await page.$('form#login')
  console.log(`Login form still present: ${!!loginForm}`)

  // 3. Check for ratings table (premium feature)
  const ratingsTable = await page.$('table#ratings-table')
  console.log(`Ratings table found: ${!!ratingsTable}`)

  // 4. Check page HTML for "Login" or error messages
  const pageContent = await page.content()
  const hasLoginText = pageContent.includes('type="email"') && pageContent.includes('type="password"')
  console.log(`Login form in HTML: ${hasLoginText}`)

  // 5. Look for any text that says "Login failed" or similar
  const bodyText = await page.evaluate(() => document.body.innerText)
  const hasError = bodyText.toLowerCase().includes('invalid') ||
                   bodyText.toLowerCase().includes('incorrect') ||
                   bodyText.toLowerCase().includes('failed')
  console.log(`Error message detected: ${hasError}`)

  // 6. Check if we can see the table data
  if (ratingsTable) {
    const rowCount = await page.$$eval('table#ratings-table tbody tr', rows => rows.length)
    console.log(`Ratings table rows: ${rowCount}`)

    if (rowCount > 0) {
      console.log('\n✓ Authentication appears successful - can access ratings table')
    }
  }

  // Try finding logout link with different selectors
  const allLinks = await page.$$eval('a', links =>
    links.map(l => ({ href: l.href, text: l.textContent?.trim() }))
  )

  const logoutLinks = allLinks.filter(l =>
    l.href.includes('logout') ||
    l.text?.toLowerCase().includes('logout') ||
    l.text?.toLowerCase().includes('log out')
  )

  console.log(`\nAll logout-related links found: ${logoutLinks.length}`)
  if (logoutLinks.length > 0) {
    console.log(JSON.stringify(logoutLinks, null, 2))
  }

  // Take screenshot
  await page.screenshot({ path: '/tmp/kenpom-auth-check.png', fullPage: true })
  console.log('\nScreenshot saved to /tmp/kenpom-auth-check.png')

  await browser.close()
}

main().catch(console.error)
