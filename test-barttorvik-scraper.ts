import { BartTorvikScraper } from './lib/scrapers/barttorvik-scraper'

/**
 * Test script to manually run the BartTorvik scraper
 * Usage: npx tsx test-barttorvik-scraper.ts
 */
async function main() {
  console.log('Starting BartTorvik scraper test...\n')

  const scraper = new BartTorvikScraper()

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
