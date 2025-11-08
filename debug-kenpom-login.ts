import { chromium } from 'playwright'

/**
 * Debug script to inspect KenPom login page structure
 */
async function main() {
  console.log('Launching browser to inspect KenPom login page...\n')

  const browser = await chromium.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setViewportSize({ width: 1920, height: 1080 })

  console.log('Navigating to KenPom...')
  await page.goto('https://kenpom.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  })

  // Wait a bit for page to fully load
  await page.waitForTimeout(2000)

  // Check for logout link (indicates already logged in)
  const logoutLink = await page.$('a[href*="logout"]')
  if (logoutLink) {
    console.log('Already logged in!')
    await browser.close()
    return
  }

  // Find all input fields
  const inputs = await page.$$eval('input', (elements) => {
    return elements.map(el => ({
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      className: el.className
    }))
  })

  console.log('\nFound input fields:')
  console.log(JSON.stringify(inputs, null, 2))

  // Find all forms
  const forms = await page.$$eval('form', (elements) => {
    return elements.map(el => ({
      action: el.action,
      method: el.method,
      id: el.id,
      className: el.className
    }))
  })

  console.log('\nFound forms:')
  console.log(JSON.stringify(forms, null, 2))

  // Try to fill in the credentials
  const email = process.env.KENPOM_EMAIL || 'nfinger1020@gmail.com'
  const password = process.env.KENPOM_PASSWORD || 'Ilmfmtaitw102018'

  console.log(`\nAttempting login with email: ${email}`)

  try {
    // Try different possible selectors
    const emailSelector = await page.$('input[name="email"]') ||
                          await page.$('input[type="email"]') ||
                          await page.$('input[id*="email"]')

    const passwordSelector = await page.$('input[name="password"]') ||
                             await page.$('input[type="password"]')

    if (emailSelector && passwordSelector) {
      console.log('Found email and password fields, filling them in...')
      await page.fill('input[name="email"], input[type="email"]', email)
      await page.fill('input[name="password"], input[type="password"]', password)

      console.log('Looking for submit button...')
      const submitButton = await page.$('input[type="submit"]') ||
                          await page.$('button[type="submit"]') ||
                          await page.$('button:has-text("Login")') ||
                          await page.$('input[value*="Login"]')

      if (submitButton) {
        console.log('Found submit button, clicking...')
        await page.waitForTimeout(1000)

        // Click and wait for navigation
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
          submitButton.click()
        ])

        console.log('Login submitted, checking for success...')
        await page.waitForTimeout(2000)

        const logoutLinkAfter = await page.$('a[href*="logout"]')
        if (logoutLinkAfter) {
          console.log('✓ Login successful!')
        } else {
          console.log('✗ Login failed - no logout link found')

          // Take screenshot
          await page.screenshot({ path: '/tmp/kenpom-login-failed.png', fullPage: true })
          console.log('Screenshot saved to /tmp/kenpom-login-failed.png')
        }
      } else {
        console.log('✗ Could not find submit button')
      }
    } else {
      console.log('✗ Could not find email or password fields')
    }
  } catch (error) {
    console.error('Error during login attempt:', error)
    await page.screenshot({ path: '/tmp/kenpom-error.png', fullPage: true })
    console.log('Screenshot saved to /tmp/kenpom-error.png')
  }

  console.log('\nKeeping browser open for 30 seconds for inspection...')
  await page.waitForTimeout(30000)

  await browser.close()
}

main().catch(console.error)
