import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'

interface NewsCardProps {
  article: {
    id?: string
    title: string
    url: string
    source: string
    published_at: string
    content?: string | null
    image_url?: string | null
    categories: string[]
  }
}

// Format category names for display
function formatCategory(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Get color variant for categories
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    recruiting: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    analysis: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    game_recap: 'bg-green-500/10 text-green-700 dark:text-green-400',
    injuries: 'bg-red-500/10 text-red-700 dark:text-red-400',
    transfers: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    rankings: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    conference_news: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
    coaching: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
    general: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  }
  return colors[category] || colors.general
}

export function NewsCard({ article }: NewsCardProps) {
  const publishedDate = new Date(article.published_at)
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60))

  let timeAgo = ''
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60))
    timeAgo = `${diffInMinutes}m ago`
  } else if (diffInHours < 24) {
    timeAgo = `${diffInHours}h ago`
  } else {
    const diffInDays = Math.floor(diffInHours / 24)
    timeAgo = `${diffInDays}d ago`
  }

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-transform hover:scale-[1.02]"
    >
      <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow">
        {article.image_url && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={article.image_url}
              alt={article.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <CardHeader>
          <div className="flex flex-wrap gap-2 mb-2">
            {article.categories.map((cat) => (
              <Badge
                key={cat}
                variant="secondary"
                className={getCategoryColor(cat)}
              >
                {formatCategory(cat)}
              </Badge>
            ))}
          </div>
          <CardTitle className="line-clamp-2 text-base">
            {article.title}
          </CardTitle>
          <CardDescription className="flex items-center gap-2 text-xs">
            <span>{article.source}</span>
            <span>•</span>
            <span>{timeAgo}</span>
          </CardDescription>
        </CardHeader>

        {article.content && (
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {article.content}
            </p>
          </CardContent>
        )}

        <CardFooter>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            <span>Read full article</span>
          </div>
        </CardFooter>
      </Card>
    </a>
  )
}
