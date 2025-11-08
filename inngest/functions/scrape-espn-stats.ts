import { inngest } from '../client'
import { ESPNStatsScraper } from '../../lib/scrapers/espn-stats-scraper'

/**
 * Inngest function to scrape team stats from ESPN
 * Runs daily at 8am (after BartTorvik and KenPom)
 * Provides complementary traditional statistics
 */
export const scrapeESPNStats = inngest.createFunction(
  {
    id: 'scrape-espn-stats',
    name: 'Scrape ESPN Team Statistics',
  },
  { cron: '0 8 * * *' }, // Daily at 8 AM
  async ({ step }) => {
    // Step 1: Run the scraper
    const result = await step.run('scrape-and-save-stats', async () => {
      const scraper = new ESPNStatsScraper()
      return await scraper.run()
    })

    // Step 2: Return results for Inngest dashboard
    return {
      success: result.success,
      recordsProcessed: result.recordsProcessed,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      errors: result.errors,
      warnings: result.warnings
    }
  }
)
