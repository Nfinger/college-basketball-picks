import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

async function cleanBettingArticles() {
  console.log('🧹 Cleaning betting/promotional articles from database...\n')

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Fetch all articles
  const { data: articles, error } = await supabase
    .from('news_articles')
    .select('*')

  if (error) {
    console.error('❌ Error fetching articles:', error)
    process.exit(1)
  }

  console.log(`📊 Found ${articles?.length || 0} total articles in database\n`)

  // Betting/gambling keywords
  const bettingKeywords = [
    'bonus code',
    'promo code',
    'bonus bets',
    'sportsline',
    'draftkings',
    'fanduel',
    'bet365',
    'caesars',
    'pointsbet',
    'barstool',
    'best bets',
    'computer model',
    'simulated',
  ]

  // Find articles to delete
  const articlesToDelete = articles?.filter(article => {
    const text = `${article.title} ${article.content}`.toLowerCase()

    // Check if title/content contains betting keywords
    const hasBettingKeywords = bettingKeywords.some(keyword => text.includes(keyword))

    // Check if it's a promotional article
    const isPromo =
      article.title.toLowerCase().startsWith('use ') ||
      article.title.toLowerCase().includes('get $') ||
      article.title.toLowerCase().includes('bonus bets')

    return hasBettingKeywords || isPromo
  }) || []

  console.log(`🎯 Found ${articlesToDelete.length} betting/promotional articles to delete:\n`)

  // Show sample of articles being deleted
  articlesToDelete.slice(0, 5).forEach(article => {
    console.log(`   - "${article.title.substring(0, 80)}..."`)
  })

  if (articlesToDelete.length > 5) {
    console.log(`   ... and ${articlesToDelete.length - 5} more\n`)
  }

  if (articlesToDelete.length === 0) {
    console.log('✅ No betting/promotional articles found. Database is clean!')
    return
  }

  // Delete articles
  const idsToDelete = articlesToDelete.map(a => a.id)

  const { error: deleteError } = await supabase
    .from('news_articles')
    .delete()
    .in('id', idsToDelete)

  if (deleteError) {
    console.error('❌ Error deleting articles:', deleteError)
    process.exit(1)
  }

  console.log(`\n✅ Successfully deleted ${articlesToDelete.length} betting/promotional articles!`)
  console.log(`📊 Remaining articles: ${(articles?.length || 0) - articlesToDelete.length}`)
}

cleanBettingArticles().catch(console.error)
