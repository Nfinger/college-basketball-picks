import Parser from 'rss-parser'
import type { NewsArticle, RSSSource } from './types'

const parser = new Parser({
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
    ],
  },
})

// College basketball news RSS sources
export const NEWS_SOURCES: RSSSource[] = [
  {
    name: 'ESPN College Basketball',
    url: 'https://www.espn.com/espn/rss/ncb/news',
  },
  {
    name: 'CBS Sports College Basketball',
    url: 'https://www.cbssports.com/rss/headlines/college-basketball/',
  },
  {
    name: 'AP Top 25',
    url: 'http://hosted.ap.org/lineups/CBKTOP25.rss',
  },
]

/**
 * Check if an article is promotional/betting content
 */
function isBettingOrPromotionalContent(article: NewsArticle): boolean {
  const text = `${article.title} ${article.content}`.toLowerCase()

  // Betting/gambling keywords
  const bettingKeywords = [
    'bonus code',
    'promo code',
    'bonus bets',
    'sportsline',
    'odds',
    'betting',
    'parlay',
    'spread',
    'moneyline',
    'draftkings',
    'fanduel',
    'bet365',
    'caesars',
    'pointsbet',
    'barstool',
    'mgm',
    'best bets',
    'picks today',
    'expert picks',
    'computer model',
    'simulated',
    'prediction model',
    'prop bets',
    'over/under',
  ]

  // Check if title/content contains betting keywords
  const hasBettingKeywords = bettingKeywords.some(keyword => text.includes(keyword))

  // Check if it's a promotional article (titles that start with "Use" or contain specific promo phrases)
  const isPromo =
    article.title.toLowerCase().startsWith('use ') ||
    article.title.toLowerCase().includes('get $') ||
    article.title.toLowerCase().includes('bonus bets')

  return hasBettingKeywords || isPromo
}

/**
 * Calculate similarity between two strings (simple Levenshtein-like approach)
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const s1 = title1.toLowerCase().trim()
  const s2 = title2.toLowerCase().trim()

  // Exact match
  if (s1 === s2) return 1.0

  // Check if one title contains the other (after normalizing)
  const shorter = s1.length < s2.length ? s1 : s2
  const longer = s1.length < s2.length ? s2 : s1

  if (longer.includes(shorter) && shorter.length > 20) {
    return 0.9 // Very similar
  }

  // Simple word overlap check
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 3))
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 3))

  if (words1.size === 0 || words2.size === 0) return 0

  const intersection = new Set([...words1].filter(w => words2.has(w)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

/**
 * Remove duplicate articles based on URL and title similarity
 */
function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Map<string, NewsArticle>()
  const result: NewsArticle[] = []

  for (const article of articles) {
    // Check for exact URL match
    if (seen.has(article.url)) {
      continue
    }

    // Check for similar titles
    let isDuplicate = false
    for (const existing of result) {
      const similarity = calculateTitleSimilarity(article.title, existing.title)
      if (similarity > 0.85) {
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      seen.set(article.url, article)
      result.push(article)
    }
  }

  return result
}

/**
 * Fetch and parse a single RSS feed
 */
async function fetchRSSFeed(source: RSSSource): Promise<NewsArticle[]> {
  try {
    const feed = await parser.parseURL(source.url)

    const articles = (feed.items || []).map((item) => {
      // Extract image URL from various possible fields
      let imageUrl: string | undefined

      if (item.enclosure?.url) {
        imageUrl = item.enclosure.url
      } else if ((item as any).mediaThumbnail?.['$']?.url) {
        imageUrl = (item as any).mediaThumbnail['$'].url
      } else if ((item as any).mediaContent?.['$']?.url) {
        imageUrl = (item as any).mediaContent['$'].url
      }

      return {
        title: (item.title || 'Untitled').trim(),
        url: (item.link || item.guid || '').trim(),
        source: source.name,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        content: (item.contentSnippet || item.content || item.summary || '').trim(),
        imageUrl: imageUrl?.trim(),
        categories: [], // Will be filled by categorizer
      }
    })
    .filter(article => article.url) // Only include articles with URLs
    .filter(article => !isBettingOrPromotionalContent(article)) // Filter out betting/promo content

    return articles

  } catch (error) {
    console.error(`Failed to fetch RSS feed from ${source.name}:`, error)
    return []
  }
}

/**
 * Fetch articles from all news sources in parallel
 */
export async function fetchAllNews(): Promise<NewsArticle[]> {
  const results = await Promise.allSettled(
    NEWS_SOURCES.map(source => fetchRSSFeed(source))
  )

  const allArticles: NewsArticle[] = []
  let successCount = 0
  let failureCount = 0
  let filteredCount = 0

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const articleCount = result.value.length
      allArticles.push(...result.value)
      successCount++
      console.log(`✓ Fetched ${articleCount} articles from ${NEWS_SOURCES[index].name}`)
    } else {
      failureCount++
      console.error(`✗ Failed to fetch from ${NEWS_SOURCES[index].name}:`, result.reason)
    }
  })

  // Deduplicate articles across all sources
  const beforeDedup = allArticles.length
  const deduplicated = deduplicateArticles(allArticles)
  const duplicatesRemoved = beforeDedup - deduplicated.length

  console.log(`RSS Fetch Summary: ${successCount} sources succeeded, ${failureCount} sources failed`)
  console.log(`Articles: ${beforeDedup} fetched, ${duplicatesRemoved} duplicates removed, ${deduplicated.length} unique articles`)

  return deduplicated
}
