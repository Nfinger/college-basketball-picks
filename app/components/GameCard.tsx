import { useFetcher } from 'react-router'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
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

export function GameCard({ game, userPick, userId: _userId }: GameCardProps) {
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
    <Card className="hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[180px] pb-0">
      <CardContent className="p-2 flex-1 flex flex-col">
        {/* Three Column Grid Layout */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 flex-1">
          {/* Left Column: Away Team */}
          <fetcher.Form
            method="post"
            onClick={(e) => {
              if (!isLocked && !isSubmitting) {
                e.currentTarget.requestSubmit()
              }
            }}
            className={cn(
              'flex flex-col items-center justify-center p-1.5 rounded-lg transition-all duration-200 h-full',
              !isLocked && 'cursor-pointer hover:scale-105 hover:shadow-md',
              isLocked && 'opacity-60 cursor-not-allowed',
              isUserPick(game.away_team.id) && 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 shadow-md',
              !isUserPick(game.away_team.id) && 'border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600'
            )}
            role={!isLocked ? 'button' : undefined}
            aria-label={!isLocked ? `Pick ${game.away_team.name}` : undefined}
            tabIndex={!isLocked ? 0 : undefined}
            onKeyDown={(e) => {
              if (!isLocked && !isSubmitting && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                e.currentTarget.requestSubmit()
              }
            }}
          >
            <input type="hidden" name="gameId" value={game.id} />
            <input type="hidden" name="pickedTeamId" value={game.away_team.id} />
            <input type="hidden" name="spread" value={game.spread || ''} />

            <div className="text-center space-y-0.5 w-full">
              <div className="flex items-baseline justify-center gap-1.5 min-h-[20px]">
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {game.away_team.short_name}
                </div>

                {game.spread && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-mono text-xs font-semibold px-1.5 py-0.5',
                      awayIsFavorite
                        ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300'
                        : 'border-slate-300 dark:border-slate-600'
                    )}
                  >
                    {getSpreadDisplay(game.away_team.id)}
                  </Badge>
                )}
              </div>

              {isCompleted && game.away_score !== null && (
                <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {game.away_score}
                </div>
              )}

              {isSubmitting && optimisticPickedTeamId === game.away_team.id && (
                <div className="flex items-center justify-center gap-1 text-xs text-slate-600 dark:text-slate-400 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="font-medium">Saving...</span>
                </div>
              )}
            </div>
          </fetcher.Form>

          {/* Center Column: Game Info */}
          <div className="flex flex-col items-center justify-center px-1 space-y-1.5 min-w-[40px] h-full">
            <span className="text-slate-400 dark:text-slate-600 text-sm font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
              @
            </span>

            {userPick && (
              <div className="flex flex-col items-center gap-1">
                {userPick.result && userPick.result !== 'pending' && (
                  <Badge className={cn(getResultColor(userPick.result), 'font-bold shadow-md text-xs px-1.5 py-0.5')}>
                    {userPick.result.toUpperCase()}
                  </Badge>
                )}
                {isLocked && userPick.result === 'pending' && (
                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5">
                    Locked
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Home Team */}
          <fetcher.Form
            method="post"
            onClick={(e) => {
              if (!isLocked && !isSubmitting) {
                e.currentTarget.requestSubmit()
              }
            }}
            className={cn(
              'flex flex-col items-center justify-center p-1.5 rounded-lg transition-all duration-200 h-full',
              !isLocked && 'cursor-pointer hover:scale-105 hover:shadow-md',
              isLocked && 'opacity-60 cursor-not-allowed',
              isUserPick(game.home_team.id) && 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 shadow-md',
              !isUserPick(game.home_team.id) && 'border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600'
            )}
            role={!isLocked ? 'button' : undefined}
            aria-label={!isLocked ? `Pick ${game.home_team.name}` : undefined}
            tabIndex={!isLocked ? 0 : undefined}
            onKeyDown={(e) => {
              if (!isLocked && !isSubmitting && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                e.currentTarget.requestSubmit()
              }
            }}
          >
            <input type="hidden" name="gameId" value={game.id} />
            <input type="hidden" name="pickedTeamId" value={game.home_team.id} />
            <input type="hidden" name="spread" value={game.spread || ''} />

            <div className="text-center space-y-0.5 w-full">
              <div className="flex items-baseline justify-center gap-1.5 min-h-[20px]">
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {game.home_team.short_name}
                </div>

                {game.spread && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-mono text-xs font-semibold px-1.5 py-0.5',
                      homeIsFavorite
                        ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300'
                        : 'border-slate-300 dark:border-slate-600'
                    )}
                  >
                    {getSpreadDisplay(game.home_team.id)}
                  </Badge>
                )}
              </div>

              {isCompleted && game.home_score !== null && (
                <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {game.home_score}
                </div>
              )}

              {isSubmitting && optimisticPickedTeamId === game.home_team.id && (
                <div className="flex items-center justify-center gap-1 text-xs text-slate-600 dark:text-slate-400 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="font-medium">Saving...</span>
                </div>
              )}
            </div>
          </fetcher.Form>
        </div>
      </CardContent>

      {/* Footer with Conference and Time */}
      <div className="px-2 pb-2 pt-1 border-t border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Badge
              variant={game.conference.is_power_conference ? 'default' : 'secondary'}
              className="font-semibold text-xs px-1.5 py-0.5"
            >
              {game.conference.short_name}
            </Badge>
            {game.status === 'in_progress' && (
              <Badge className="bg-red-600 text-white border-0 animate-pulse-soft shadow-lg shadow-red-600/50 text-xs px-1.5 py-0.5">
                <span className="inline-block w-1 h-1 rounded-full bg-white mr-1 animate-pulse"></span>
                LIVE
              </Badge>
            )}
            {game.status === 'completed' && (
              <Badge className="bg-slate-600 text-white border-0 text-xs px-1.5 py-0.5">
                FINAL
              </Badge>
            )}
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400" suppressHydrationWarning>
            {format(gameDate, 'h:mm a')}
          </span>
        </div>
      </div>
    </Card>
  )
}
