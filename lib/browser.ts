import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'
import type { Browser } from 'playwright-core'

/**
 * Launch browser that works in both local development and serverless production
 * Uses @sparticuz/chromium for Lambda environments, falls back to local Playwright
 */
export async function launchBrowser(): Promise<Browser> {
  const isProduction = process.env.NODE_ENV === 'production'
  const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME

  if (isProduction || isLambda) {
    // Production/Lambda: Use @sparticuz/chromium
    console.log('[Browser] Launching Lambda-compatible Chromium')

    return await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  } else {
    // Development: Use local Playwright browser
    console.log('[Browser] Launching local Playwright Chromium')

    // Import regular playwright only in development
    const { chromium: devChromium } = await import('playwright')
    return await devChromium.launch({ headless: true })
  }
}
