import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { NewsArticle } from './types'

// Available news categories
export const NEWS_CATEGORIES = [
  'recruiting',
  'analysis',
  'game_recap',
  'injuries',
  'transfers',
  'rankings',
  'conference_news',
  'coaching',
  'general',
] as const

export type NewsCategory = typeof NEWS_CATEGORIES[number]

/**
 * Categorize a single article and extract team mentions using Claude
 */
async function categorizeArticle(article: NewsArticle): Promise<{ categories: string[], teams: string[] }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('Anthropic API key not configured, using fallback categorization')
    return {
      categories: fallbackCategorization(article),
      teams: []
    }
  }

  try {
    const prompt = `Analyze this college basketball article and:
1. Assign 1-3 relevant categories
2. Extract all college basketball team names mentioned

Title: ${article.title}
Description: ${article.content?.substring(0, 500) || 'No description'}

Available categories: ${NEWS_CATEGORIES.join(', ')}

Category descriptions:
- recruiting: player commitments, recruiting rankings, visits, recruiting news, high school prospects
- analysis: opinion pieces, game analysis, strategic breakdowns
- game_recap: game results, recaps, highlights, scores
- injuries: injury reports, player health updates
- transfers: transfer portal, player movement between schools
- rankings: polls, power rankings, team rankings
- conference_news: conference realignment, conference policies, conference tournaments
- coaching: coaching changes, coaching news, coaching hires/fires
- general: other college basketball news

Return ONLY a JSON object with this exact format:
{
  "categories": ["category1", "category2"],
  "teams": ["Duke", "North Carolina", ...]
}

For teams, use the official team name (e.g., "Duke", "North Carolina", "Kansas", "UCLA").
Do not include any other text.`

    const { text } = await generateText({
      model: anthropic('claude-3-haiku-20240307'),
      system: 'You are a sports news categorization assistant. Respond only with valid JSON.',
      prompt,
    })

    const response = text.trim()
    if (!response) {
      throw new Error('Empty response from Claude')
    }

    // Parse the JSON response
    const result = JSON.parse(response)

    if (!result.categories || !Array.isArray(result.categories)) {
      throw new Error('Invalid response format')
    }

    // Validate categories
    const validCategories = result.categories.filter((cat: string) =>
      NEWS_CATEGORIES.includes(cat as NewsCategory)
    )

    return {
      categories: validCategories.length > 0 ? validCategories : ['general'],
      teams: Array.isArray(result.teams) ? result.teams : []
    }

  } catch (error) {
    console.error('Failed to categorize article with Claude:', error)
    return {
      categories: fallbackCategorization(article),
      teams: []
    }
  }
}

/**
 * Fallback categorization using keyword matching
 */
function fallbackCategorization(article: NewsArticle): string[] {
  const text = `${article.title} ${article.content}`.toLowerCase()
  const categories: string[] = []

  // Keyword-based categorization
  if (
    text.includes('commit') ||
    text.includes('recruit') ||
    text.includes('visit') ||
    text.includes('signing')
  ) {
    categories.push('recruiting')
  }

  if (
    text.includes('injury') ||
    text.includes('injured') ||
    text.includes('out for') ||
    text.includes('questionable') ||
    text.includes('doubtful')
  ) {
    categories.push('injuries')
  }

  if (
    text.includes('transfer') ||
    text.includes('portal') ||
    text.includes('transferring')
  ) {
    categories.push('transfers')
  }

  if (
    text.includes('final score') ||
    text.includes('defeats') ||
    text.includes('beats') ||
    text.includes('wins') ||
    text.includes('game recap')
  ) {
    categories.push('game_recap')
  }

  if (
    text.includes('ranking') ||
    text.includes('poll') ||
    text.includes('top 25') ||
    text.includes('power ranking')
  ) {
    categories.push('rankings')
  }

  if (
    text.includes('coach') ||
    text.includes('coaching') ||
    text.includes('hired') ||
    text.includes('fired')
  ) {
    categories.push('coaching')
  }

  if (
    text.includes('conference') &&
    (text.includes('realignment') || text.includes('tournament') || text.includes('championship'))
  ) {
    categories.push('conference_news')
  }

  // If no categories matched, default to general
  return categories.length > 0 ? categories : ['general']
}

/**
 * Categorize multiple articles in batches and extract team mentions
 */
export async function categorizeArticles(
  articles: NewsArticle[],
  batchSize: number = 10
): Promise<NewsArticle[]> {
  console.log(`Categorizing ${articles.length} articles...`)

  const categorizedArticles: NewsArticle[] = []

  // Process articles in batches to avoid rate limits
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(
      batch.map(article => categorizeArticle(article))
    )

    batchResults.forEach((result, index) => {
      const article = batch[index]
      if (result.status === 'fulfilled') {
        categorizedArticles.push({
          ...article,
          categories: result.value.categories,
          teamNames: result.value.teams,
        })
      } else {
        console.error(`Failed to categorize article: ${article.title}`)
        categorizedArticles.push({
          ...article,
          categories: ['general'],
          teamNames: [],
        })
      }
    })

    // Brief delay between batches to avoid rate limits
    if (i + batchSize < articles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`✓ Categorized ${categorizedArticles.length} articles`)
  return categorizedArticles
}
