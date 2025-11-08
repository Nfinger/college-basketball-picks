import { ESPNPlayerScraper } from './lib/scrapers/espn-player-scraper'

/**
 * Test script for ESPN player scraper
 * Tests with a few teams to validate functionality
 */
async function testESPNPlayerScraper() {
  console.log('🏀 Testing ESPN Player Scraper\n')
  console.log('=' .repeat(60))

  try {
    const scraper = new ESPNPlayerScraper()

    console.log('\n📊 Running full scraper (this will take a while)...\n')

    const result = await scraper.run()

    console.log('\n' + '='.repeat(60))
    console.log('📈 RESULTS')
    console.log('='.repeat(60))
    console.log(`✅ Success: ${result.success}`)
    console.log(`📦 Records Processed: ${result.recordsProcessed}`)
    console.log(`➕ Records Created: ${result.recordsCreated}`)
    console.log(`🔄 Records Updated: ${result.recordsUpdated}`)

    if (result.errors && result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`)
      result.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`))
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more`)
      }
    }

    if (result.warnings && result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${result.warnings.length}):`)
      result.warnings.slice(0, 10).forEach(warn => console.log(`  - ${warn}`))
      if (result.warnings.length > 10) {
        console.log(`  ... and ${result.warnings.length - 10} more`)
      }
    }

    console.log('\n' + '='.repeat(60))

    if (result.success) {
      console.log('\n✅ Test PASSED - Player scraper working correctly!')
    } else {
      console.log('\n❌ Test FAILED - See errors above')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n💥 Fatal error during test:', error)
    process.exit(1)
  }
}

// Run the test
testESPNPlayerScraper().catch(error => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
