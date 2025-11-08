import { useNavigate, useSearchParams } from 'react-router'
import { Badge } from './ui/badge'
import { cn } from '~/lib/utils'

const CATEGORIES = [
  { value: 'all', label: 'All News' },
  { value: 'recruiting', label: 'Recruiting' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'game_recap', label: 'Game Recaps' },
  { value: 'injuries', label: 'Injuries' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'rankings', label: 'Rankings' },
  { value: 'conference_news', label: 'Conference News' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'general', label: 'General' },
]

export function NewsFilter() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentCategory = searchParams.get('category') || 'all'

  const handleCategoryChange = (category: string) => {
    if (category === 'all') {
      navigate('/news')
    } else {
      navigate(`/news?category=${category}`)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => handleCategoryChange(cat.value)}
          className="transition-all"
        >
          <Badge
            variant={currentCategory === cat.value ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer hover:bg-primary hover:text-primary-foreground',
              currentCategory === cat.value && 'bg-primary text-primary-foreground'
            )}
          >
            {cat.label}
          </Badge>
        </button>
      ))}
    </div>
  )
}
