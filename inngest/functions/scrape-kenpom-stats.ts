import { inngest } from '../client'
import { KenPomScraper } from '../../lib/scrapers/kenpom-scraper'

/**
 * Inngest function to scrape team stats from KenPom
 * Runs daily at 7am (after BartTorvik at 6am)
 *
 * Prerequisites:
 * - KenPom subscription ($19.95/year)
 * - Environment variables: KENPOM_EMAIL, KENPOM_PASSWORD
 */
export const scrapeKenPomStats = inngest.createFunction(
  {
    id: 'scrape-kenpom-stats',
    name: 'Scrape KenPom Team Statistics (Premium)',
  },
  { cron: '0 7 * * *' }, // Daily at 7 AM
  async ({ step }) => {
    // Step 1: Run the scraper
    const result = await step.run('scrape-and-save-stats', async () => {
      const scraper = new KenPomScraper()
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
