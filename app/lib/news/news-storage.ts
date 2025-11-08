import type { SupabaseClient } from '@supabase/supabase-js'
import type { NewsArticle } from './types'

/**
 * Match team names to team IDs in the database
 */
async function matchTeamNamesToIds(
  supabase: SupabaseClient,
  teamNames: string[]
): Promise<string[]> {
  if (teamNames.length === 0) {
    return []
  }

  // Fetch all teams to match against
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, short_name')

  if (error || !teams) {
    console.error('Error fetching teams:', error)
    return []
  }

  const matchedIds: string[] = []

  for (const teamName of teamNames) {
    const lowerName = teamName.toLowerCase()

    // Try to find a match by full name or short name
    const match = teams.find(team =>
      team.name.toLowerCase() === lowerName ||
      team.short_name.toLowerCase() === lowerName ||
      team.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(team.name.toLowerCase())
    )

    if (match && !matchedIds.includes(match.id)) {
      matchedIds.push(match.id)
    }
  }

  return matchedIds
}

/**
 * Check which articles already exist in the database
 */
export async function filterExistingArticles(
  supabase: SupabaseClient,
  articles: NewsArticle[]
): Promise<NewsArticle[]> {
  if (articles.length === 0) {
    return []
  }

  const urls = articles.map(a => a.url)

  // Query existing URLs
  const { data: existingArticles, error } = await supabase
    .from('news_articles')
    .select('url')
    .in('url', urls)

  if (error) {
    console.error('Error checking existing articles:', error)
    // On error, assume no articles exist to avoid losing data
    return articles
  }

  const existingUrls = new Set(existingArticles?.map(a => a.url) || [])
  const newArticles = articles.filter(article => !existingUrls.has(article.url))

  console.log(`Found ${newArticles.length} new articles out of ${articles.length} total`)

  return newArticles
}

/**
 * Store news articles in the database along with team associations
 */
export async function storeArticles(
  supabase: SupabaseClient,
  articles: NewsArticle[]
): Promise<{ success: number; failed: number }> {
  if (articles.length === 0) {
    console.log('No articles to store')
    return { success: 0, failed: 0 }
  }

  console.log(`Storing ${articles.length} articles...`)

  // Transform articles to match database schema
  const dbArticles = articles.map(article => ({
    title: article.title,
    url: article.url,
    source: article.source,
    published_at: article.publishedAt.toISOString(),
    content: article.content || null,
    image_url: article.imageUrl || null,
    categories: article.categories,
  }))

  // Insert articles (ignore duplicates with on_conflict)
  const { data, error } = await supabase
    .from('news_articles')
    .insert(dbArticles)
    .select()

  if (error) {
    console.error('Error storing articles:', error)
    return { success: 0, failed: articles.length }
  }

  const successCount = data?.length || 0
  const failedCount = articles.length - successCount

  console.log(`✓ Stored ${successCount} articles successfully`)
  if (failedCount > 0) {
    console.log(`✗ Failed to store ${failedCount} articles`)
  }

  // Store team associations if we have team names
  if (data && data.length > 0) {
    const teamAssociations: Array<{ news_article_id: string; team_id: string }> = []

    for (let i = 0; i < data.length; i++) {
      const article = articles[i]
      const storedArticle = data[i]

      if (article.teamNames && article.teamNames.length > 0) {
        const teamIds = await matchTeamNamesToIds(supabase, article.teamNames)

        for (const teamId of teamIds) {
          teamAssociations.push({
            news_article_id: storedArticle.id,
            team_id: teamId,
          })
        }
      }
    }

    if (teamAssociations.length > 0) {
      // Try to insert team associations (table might not exist yet)
      const { error: teamError } = await supabase
        .from('news_article_teams')
        .insert(teamAssociations)
        .select()

      if (teamError) {
        // Don't fail if table doesn't exist - just log it
        console.log(`Note: Could not store team associations (table may not exist yet)`)
      } else {
        console.log(`✓ Stored ${teamAssociations.length} team associations`)
      }
    }
  }

  return { success: successCount, failed: failedCount }
}

/**
 * Get recent news articles with optional category filter
 */
export async function getRecentNews(
  supabase: SupabaseClient,
  options: {
    category?: string
    limit?: number
    offset?: number
  } = {}
): Promise<NewsArticle[]> {
  const { category, limit = 50, offset = 0 } = options

  let query = supabase
    .from('news_articles')
    .select('*')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Filter by category if specified
  if (category && category !== 'all') {
    query = query.contains('categories', [category])
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching news:', error)
    return []
  }

  // Transform database records to NewsArticle format
  return (data || []).map(row => ({
    title: row.title,
    url: row.url,
    source: row.source,
    publishedAt: new Date(row.published_at),
    content: row.content || undefined,
    imageUrl: row.image_url || undefined,
    categories: row.categories || [],
  }))
}

/**
 * Get news articles filtered by user's favorite teams
 */
export async function getNewsByTeams(
  supabase: SupabaseClient,
  teamIds: string[],
  options: {
    category?: string
    limit?: number
    offset?: number
  } = {}
): Promise<NewsArticle[]> {
  if (teamIds.length === 0) {
    return []
  }

  const { category, limit = 50, offset = 0 } = options

  // Query articles that are associated with the user's teams
  let query = supabase
    .from('news_article_teams')
    .select(`
      news_article:news_articles(*)
    `)
    .in('team_id', teamIds)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching news by teams:', error)
    return []
  }

  // Extract articles and deduplicate
  const articlesMap = new Map<string, any>()
  data?.forEach((row: any) => {
    if (row.news_article) {
      articlesMap.set(row.news_article.id, row.news_article)
    }
  })

  let articles = Array.from(articlesMap.values())

  // Filter by category if specified
  if (category && category !== 'all') {
    articles = articles.filter(article =>
      article.categories?.includes(category)
    )
  }

  // Sort by published date
  articles.sort((a, b) =>
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  )

  // Apply limit and offset
  articles = articles.slice(offset, offset + limit)

  // Transform to NewsArticle format
  return articles.map(row => ({
    title: row.title,
    url: row.url,
    source: row.source,
    publishedAt: new Date(row.published_at),
    content: row.content || undefined,
    imageUrl: row.image_url || undefined,
    categories: row.categories || [],
  }))
}

/**
 * Get article count by category
 */
export async function getArticleCountsByCategory(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('news_articles')
    .select('categories')

  if (error) {
    console.error('Error fetching article counts:', error)
    return {}
  }

  const counts: Record<string, number> = {}

  data?.forEach(row => {
    const categories = row.categories || []
    categories.forEach((cat: string) => {
      counts[cat] = (counts[cat] || 0) + 1
    })
  })

  return counts
}
