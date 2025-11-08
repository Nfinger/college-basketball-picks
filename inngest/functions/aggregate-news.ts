import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'
import { fetchAllNews } from '../../app/lib/news/rss-fetcher'
import { categorizeArticles } from '../../app/lib/news/categorizer'
import { filterExistingArticles, storeArticles } from '../../app/lib/news/news-storage'

export const aggregateNews = inngest.createFunction(
  {
    id: 'aggregate-cbb-news',
    name: 'Aggregate College Basketball News',
  },
  { cron: '0 */2 * * *' }, // Every 2 hours
  async ({ step }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Step 1: Fetch news from all RSS sources
    const articles = await step.run('fetch-rss-feeds', async () => {
      console.log('Fetching news from RSS sources...')
      return await fetchAllNews()
    })

    if (articles.length === 0) {
      console.log('No articles fetched from any source')
      return {
        success: true,
        message: 'No new articles found',
        stats: {
          fetched: 0,
          new: 0,
          categorized: 0,
          stored: 0,
        },
      }
    }

    // Step 2: Filter out articles that already exist in the database
    const newArticles = await step.run('deduplicate-articles', async () => {
      console.log('Checking for existing articles...')
      // Rehydrate dates from strings (Inngest serializes Date -> string)
      const rehydratedArticles = articles.map(a => ({
        ...a,
        publishedAt: typeof a.publishedAt === 'string' ? new Date(a.publishedAt) : a.publishedAt
      }))
      return await filterExistingArticles(supabase, rehydratedArticles)
    })

    if (newArticles.length === 0) {
      console.log('All articles already exist in database')
      return {
        success: true,
        message: 'All articles already exist',
        stats: {
          fetched: articles.length,
          new: 0,
          categorized: 0,
          stored: 0,
        },
      }
    }

    // Step 3: Categorize new articles using AI
    const categorizedArticles = await step.run('categorize-articles', async () => {
      console.log('Categorizing articles with AI...')
      // Rehydrate dates from strings (Inngest serializes Date -> string)
      const rehydratedArticles = newArticles.map(a => ({
        ...a,
        publishedAt: typeof a.publishedAt === 'string' ? new Date(a.publishedAt) : a.publishedAt
      }))
      return await categorizeArticles(rehydratedArticles)
    })

    // Step 4: Store articles in database
    const storeResult = await step.run('store-articles', async () => {
      console.log('Storing articles in database...')
      // Rehydrate dates from strings (Inngest serializes Date -> string)
      const rehydratedArticles = categorizedArticles.map(a => ({
        ...a,
        publishedAt: typeof a.publishedAt === 'string' ? new Date(a.publishedAt) : a.publishedAt
      }))
      return await storeArticles(supabase, rehydratedArticles)
    })

    const stats = {
      fetched: articles.length,
      new: newArticles.length,
      categorized: categorizedArticles.length,
      stored: storeResult.success,
      failed: storeResult.failed,
    }

    console.log('News aggregation complete:', stats)

    return {
      success: true,
      message: `Successfully stored ${storeResult.success} new articles`,
      stats,
    }
  }
)
