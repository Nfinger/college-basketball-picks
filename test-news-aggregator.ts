import { createClient } from '@supabase/supabase-js'
import { fetchAllNews } from './app/lib/news/rss-fetcher'
import { categorizeArticles } from './app/lib/news/categorizer'
import { filterExistingArticles, storeArticles } from './app/lib/news/news-storage'

// Load environment variables
import 'dotenv/config'

async function main() {
  console.log('🚀 Starting news aggregation test...\n')

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables')
    console.error('   Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Step 1: Fetch news
  console.log('📰 Fetching news from RSS sources...')
  const articles = await fetchAllNews()
  console.log(`   Found ${articles.length} articles\n`)

  if (articles.length === 0) {
    console.log('❌ No articles fetched. Exiting.')
    return
  }

  // Step 2: Deduplicate
  console.log('🔍 Checking for existing articles...')
  const newArticles = await filterExistingArticles(supabase, articles)
  console.log(`   ${newArticles.length} new articles (${articles.length - newArticles.length} duplicates)\n`)

  if (newArticles.length === 0) {
    console.log('✅ All articles already exist in database.')
    return
  }

  // Step 3: Categorize
  console.log('🏷️  Categorizing articles...')
  const categorizedArticles = await categorizeArticles(newArticles)
  console.log(`   Categorized ${categorizedArticles.length} articles\n`)

  // Print some sample categorizations
  console.log('📋 Sample categorizations:')
  categorizedArticles.slice(0, 3).forEach(article => {
    console.log(`   - "${article.title.substring(0, 60)}..."`)
    console.log(`     Categories: ${article.categories.join(', ')}\n`)
  })

  // Step 4: Store
  console.log('💾 Storing articles in database...')
  const result = await storeArticles(supabase, categorizedArticles)
  console.log(`   ✅ Stored ${result.success} articles`)
  if (result.failed > 0) {
    console.log(`   ❌ Failed to store ${result.failed} articles`)
  }

  console.log('\n✨ News aggregation complete!')
}

main().catch(console.error)
