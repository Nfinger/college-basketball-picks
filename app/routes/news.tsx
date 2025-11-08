import { useLoaderData } from 'react-router'
import type { Route } from './+types/news'
import { requireAuth } from '~/lib/auth.server'
import { getFavoriteTeamIds } from '~/lib/favorites.server'
import { getRecentNews, getNewsByTeams } from '~/lib/news/news-storage'
import { NewsCard } from '~/components/NewsCard'
import { NewsFilter } from '~/components/NewsFilter'
import { MyTeamsFilterToggle } from '~/components/MyTeamsFilterToggle'
import { Newspaper } from 'lucide-react'

type NewsArticle = {
  id?: string
  title: string
  url: string
  source: string
  publishedAt: Date
  content?: string
  imageUrl?: string
  categories: string[]
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase, headers } = await requireAuth(request)

  // Get URL search params
  const url = new URL(request.url)
  const category = url.searchParams.get('category') || undefined
  const myTeamsOnly = url.searchParams.get('myTeamsOnly') === 'true'

  // Get user's favorite teams
  const favoriteTeamIds = await getFavoriteTeamIds(supabase, user.id)

  let articles: NewsArticle[] = []

  // Fetch articles based on filter
  if (myTeamsOnly && favoriteTeamIds.length > 0) {
    // Fetch only articles related to user's teams
    articles = await getNewsByTeams(supabase, favoriteTeamIds, {
      category,
      limit: 50,
    })
  } else {
    // Fetch all articles
    articles = await getRecentNews(supabase, {
      category,
      limit: 50,
    })
  }

  // Transform articles to match NewsCard expected format
  const formattedArticles = articles.map(article => ({
    title: article.title,
    url: article.url,
    source: article.source,
    published_at: article.publishedAt.toISOString(),
    content: article.content || null,
    image_url: article.imageUrl || null,
    categories: article.categories,
  }))

  return {
    articles: formattedArticles,
    category: category || 'all',
    myTeamsOnly,
    hasFavoriteTeams: favoriteTeamIds.length > 0,
  }
}

export default function NewsPage() {
  const { articles, category, myTeamsOnly, hasFavoriteTeams } = useLoaderData<typeof loader>()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Newspaper className="h-8 w-8" />
          <h1 className="text-3xl font-bold">College Basketball News</h1>
        </div>
        <p className="text-muted-foreground">
          Latest news and updates from around the college basketball world
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <NewsFilter />
        {hasFavoriteTeams && <MyTeamsFilterToggle />}
      </div>

      {/* Articles Grid */}
      {articles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            {myTeamsOnly
              ? 'No articles found for your teams.'
              : 'No articles found for this category.'}
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            {myTeamsOnly
              ? 'Try selecting different teams or browse all news.'
              : 'Check back soon for the latest news!'}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {articles.length} {myTeamsOnly ? 'articles for your teams' : category === 'all' ? 'articles' : `${category.replace('_', ' ')} articles`}
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article, index) => (
              <NewsCard key={article.url || index} article={article} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
