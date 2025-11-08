import { inngest } from '../client'
import { BartTorvikScraper } from '../../lib/scrapers/barttorvik-scraper'

/**
 * Inngest function to scrape team stats from BartTorvik
 * Runs daily at 6am to get updated ratings
 */
export const scrapeBartTorvikStats = inngest.createFunction(
  {
    id: 'scrape-barttorvik-stats',
    name: 'Scrape BartTorvik Team Statistics',
  },
  { cron: '0 6 * * *' }, // Daily at 6 AM
  async ({ step }) => {
    // Step 1: Run the scraper
    const result = await step.run('scrape-and-save-stats', async () => {
      const scraper = new BartTorvikScraper()
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
