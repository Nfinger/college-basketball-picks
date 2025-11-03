import { useFetcher } from 'react-router'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { format, isPast } from 'date-fns'
import { cn } from '~/lib/utils'
import { Loader2 } from 'lucide-react'

interface Team {
  id: string
  name: string
  short_name: string
}

interface Conference {
  id: string
  name: string
  short_name: string
  is_power_conference: boolean
}

interface Pick {
  id: string
  picked_team_id: string
  spread_at_pick_time: number
  result: 'won' | 'lost' | 'push' | 'pending' | null
  locked_at: string | null
}

interface Game {
  id: string
  game_date: string
  home_team: Team
  away_team: Team
  home_score: number | null
  away_score: number | null
  spread: number | null
  favorite_team_id: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled'
  conference: Conference
  picks?: Pick[]
}

interface GameCardProps {
  game: Game
  userPick?: Pick
  userId: string
}

export function GameCard({ game, userPick, userId }: GameCardProps) {
  const fetcher = useFetcher()
  const gameDate = new Date(game.game_date)
  const isLocked = game.status !== 'scheduled' || isPast(gameDate)
  const isCompleted = game.status === 'completed'

  // Optimistic UI: check if we're submitting a pick for this game
  const isSubmitting = fetcher.state === 'submitting'
  const optimisticPickedTeamId = fetcher.formData?.get('pickedTeamId') as string | undefined

  // Determine which team is the favorite
  const homeIsFavorite = game.favorite_team_id === game.home_team.id
  const awayIsFavorite = game.favorite_team_id === game.away_team.id

  // Format spread display
  const getSpreadDisplay = (teamId: string) => {
    if (!game.spread) return null

    if (teamId === game.favorite_team_id) {
      return `-${game.spread}`
    } else if (game.favorite_team_id) {
      return `+${game.spread}`
    }
    return null
  }

  // Check if user picked this team (with optimistic UI)
  const isUserPick = (teamId: string) => {
    if (isSubmitting && optimisticPickedTeamId) {
      return optimisticPickedTeamId === teamId
    }
    return userPick?.picked_team_id === teamId
  }

  // Get result badge color
  const getResultColor = (result: Pick['result']) => {
    switch (result) {
      case 'won':
        return 'bg-green-500 text-white'
      case 'lost':
        return 'bg-red-500 text-white'
      case 'push':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-blue-500 text-white'
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant={game.conference.is_power_conference ? 'default' : 'secondary'}>
            {game.conference.short_name}
          </Badge>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {format(gameDate, 'h:mm a')}
          </span>
        </div>
        {game.status !== 'scheduled' && (
          <Badge className={cn(
            'w-fit',
            game.status === 'completed' ? 'bg-gray-600' : 'bg-yellow-600'
          )}>
            {game.status === 'in_progress' ? 'LIVE' : game.status.toUpperCase()}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Away Team */}
        <div className={cn(
          'flex items-center justify-between p-3 rounded-lg transition-colors',
          isUserPick(game.away_team.id) && 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
        )}>
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="min-w-0">
              <div className="font-semibold text-base sm:text-lg truncate">{game.away_team.short_name}</div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {game.away_team.name}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            {isCompleted && game.away_score !== null && (
              <span className="text-2xl font-bold">{game.away_score}</span>
            )}
            {game.spread && (
              <Badge variant="outline" className={cn(
                'font-mono',
                awayIsFavorite && 'border-purple-500 text-purple-700 dark:text-purple-300'
              )}>
                {getSpreadDisplay(game.away_team.id)}
              </Badge>
            )}
            {!isLocked && (
              <fetcher.Form method="post">
                <input type="hidden" name="gameId" value={game.id} />
                <input type="hidden" name="pickedTeamId" value={game.away_team.id} />
                <input type="hidden" name="spread" value={game.spread || ''} />
                <Button
                  type="submit"
                  variant={isUserPick(game.away_team.id) ? 'default' : 'outline'}
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting && optimisticPickedTeamId === game.away_team.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    isUserPick(game.away_team.id) ? 'Picked' : 'Pick'
                  )}
                </Button>
              </fetcher.Form>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center">
          <span className="text-gray-400 dark:text-gray-600 text-sm font-medium">@</span>
        </div>

        {/* Home Team */}
        <div className={cn(
          'flex items-center justify-between p-3 rounded-lg transition-colors',
          isUserPick(game.home_team.id) && 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
        )}>
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="min-w-0">
              <div className="font-semibold text-base sm:text-lg truncate">{game.home_team.short_name}</div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {game.home_team.name}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            {isCompleted && game.home_score !== null && (
              <span className="text-2xl font-bold">{game.home_score}</span>
            )}
            {game.spread && (
              <Badge variant="outline" className={cn(
                'font-mono',
                homeIsFavorite && 'border-purple-500 text-purple-700 dark:text-purple-300'
              )}>
                {getSpreadDisplay(game.home_team.id)}
              </Badge>
            )}
            {!isLocked && (
              <fetcher.Form method="post">
                <input type="hidden" name="gameId" value={game.id} />
                <input type="hidden" name="pickedTeamId" value={game.home_team.id} />
                <input type="hidden" name="spread" value={game.spread || ''} />
                <Button
                  type="submit"
                  variant={isUserPick(game.home_team.id) ? 'default' : 'outline'}
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting && optimisticPickedTeamId === game.home_team.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    isUserPick(game.home_team.id) ? 'Picked' : 'Pick'
                  )}
                </Button>
              </fetcher.Form>
            )}
          </div>
        </div>

        {/* Pick Status */}
        {userPick && (
          <div className="pt-2 border-t">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Your pick: {
                  userPick.picked_team_id === game.home_team.id
                    ? game.home_team.short_name
                    : game.away_team.short_name
                } ({userPick.spread_at_pick_time > 0 ? '+' : ''}{userPick.spread_at_pick_time})
              </span>
              {userPick.result && userPick.result !== 'pending' && (
                <Badge className={getResultColor(userPick.result)}>
                  {userPick.result.toUpperCase()}
                </Badge>
              )}
              {isLocked && userPick.result === 'pending' && (
                <Badge variant="outline">Locked</Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
