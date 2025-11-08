import { KenPomScraper } from './lib/scrapers/kenpom-scraper'

/**
 * Test script to manually run the KenPom scraper
 *
 * Prerequisites:
 * 1. KenPom subscription ($19.95/year): https://kenpom.com/subscribe.php
 * 2. Add credentials to .env:
 *    KENPOM_EMAIL=your@email.com
 *    KENPOM_PASSWORD=yourpassword
 *
 * Usage: npx tsx test-kenpom-scraper.ts
 */
async function main() {
  console.log('Starting KenPom scraper test...\n')

  // Check for credentials
  if (!process.env.KENPOM_EMAIL || !process.env.KENPOM_PASSWORD) {
    console.error('ERROR: KenPom credentials not configured')
    console.error('Please set KENPOM_EMAIL and KENPOM_PASSWORD in your .env file')
    console.error('\nTo subscribe: https://kenpom.com/subscribe.php')
    process.exit(1)
  }

  const scraper = new KenPomScraper()

  try {
    const result = await scraper.run()

    console.log('\n=== Scraper Results ===')
    console.log(`Success: ${result.success}`)
    console.log(`Records Processed: ${result.recordsProcessed}`)
    console.log(`Records Created: ${result.recordsCreated || 'N/A'}`)
    console.log(`Records Updated: ${result.recordsUpdated || 'N/A'}`)
    console.log(`Errors: ${result.errors.length}`)
    console.log(`Warnings: ${result.warnings.length}`)

    if (result.errors.length > 0) {
      console.log('\nErrors:')
      result.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`)
      })
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:')
      result.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`)
      })
    }

    console.log('\n=== Test Complete ===')
    process.exit(result.success ? 0 : 1)
  } catch (error) {
    console.error('\n=== Test Failed ===')
    console.error(error)
    process.exit(1)
  }
}

main()
