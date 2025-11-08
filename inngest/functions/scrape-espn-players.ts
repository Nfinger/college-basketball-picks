import { inngest } from '../client'
import { ESPNPlayerScraper } from '../../lib/scrapers/espn-player-scraper'

/**
 * Inngest function to scrape player stats from ESPN
 * Runs daily at 9am (after ESPN team stats at 8am)
 * Provides individual player statistics for all D1 players
 */
export const scrapeESPNPlayers = inngest.createFunction(
  {
    id: 'scrape-espn-players',
    name: 'Scrape ESPN Player Statistics',
  },
  { cron: '0 9 * * *' }, // Daily at 9 AM
  async ({ step }) => {
    // Step 1: Run the scraper
    const result = await step.run('scrape-and-save-stats', async () => {
      const scraper = new ESPNPlayerScraper()
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
