import { useState } from 'react'
import { useFetcher } from 'react-router'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { GameAnalytics } from './GameAnalytics'
import { MatchupAnalysis } from './MatchupAnalysis'
import { BarChart3, TrendingUp, Sparkles, Loader2 } from 'lucide-react'
import { format, isPast } from 'date-fns'
import { cn } from '~/lib/utils'

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
  result: "won" | "lost" | "push" | "pending" | null
  locked_at: string | null
  is_pick_of_day: boolean
  user_id: string
}

interface MatchupAnalysisData {
  id: string
  analysis_text: string
  prediction: {
    winner_team_id: string
    winner_name: string
    confidence: number
    predicted_spread?: number
  }
  key_insights: string[]
  analyzed_at: string
}

interface Game {
  id: string
  game_date: string
  home_team_id: string
  away_team_id: string
  home_team: Team
  away_team: Team
  home_score: number | null
  away_score: number | null
  spread: number | null
  favorite_team_id: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled'
  conference: Conference
  home_team_injury_count?: number
  away_team_injury_count?: number
  matchup_analysis?: MatchupAnalysisData | null
}

interface GameDetailsDialogProps {
  game: Game
  trigger?: React.ReactNode
  children?: React.ReactNode
  userPick?: Pick
  potdGameId?: string | null
  enablePicking?: boolean
}

/**
 * GameDetailsDialog Component
 * Modal/dialog that shows comprehensive team analytics for a game
 * Opens when user wants detailed stats before making a pick
 */
export function GameDetailsDialog({
  game,
  trigger,
  children,
  userPick,
  potdGameId = null,
  enablePicking = false
}: GameDetailsDialogProps) {
  const [open, setOpen] = useState(false)
  const fetcher = useFetcher()

  const gameDate = new Date(game.game_date)
  const formattedDate = format(gameDate, 'EEEE, MMMM d')
  const formattedTime = format(gameDate, 'h:mm a')

  const isLocked = game.status !== "scheduled" || isPast(gameDate)
  const isSubmitting = fetcher.state === "submitting"

  // Determine favorite/underdog
  const homeIsFavorite = game.favorite_team_id === game.home_team.id
  const awayIsFavorite = game.favorite_team_id === game.away_team.id

  const getSpreadDisplay = (teamId: string) => {
    if (!game.spread) return null
    if (teamId === game.favorite_team_id) {
      return `-${game.spread}`
    } else if (game.favorite_team_id) {
      return `+${game.spread}`
    }
    return null
  }

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs gap-1"
      title="View analytics"
    >
      <BarChart3 className="h-3 w-3" />
      <span>Analytics</span>
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>

      <DialogContent className="!w-[95vw] sm:!max-w-[95vw] lg:!max-w-[1600px] !max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {game.away_team.name} @ {game.home_team.name}
          </DialogTitle>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-600">
            <span>{formattedDate} at {formattedTime}</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              {game.conference.name}
              {game.conference.is_power_conference && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  Power
                </span>
              )}
            </span>
          </div>
        </DialogHeader>

        {/* Game Header - Spread and Status */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 py-3 sm:py-4 border-y">
          {/* Away Team */}
          {enablePicking && !isLocked ? (
            <fetcher.Form
              method="post"
              onClick={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.requestSubmit()
                }
              }}
              className={cn(
                "text-center p-3 rounded-lg transition-all duration-200 cursor-pointer hover:scale-105 hover:shadow-md",
                userPick?.picked_team_id === game.away_team.id &&
                  "ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md",
                !userPick?.picked_team_id || userPick?.picked_team_id !== game.away_team.id
                  ? "border-2 border-slate-200 hover:border-slate-300"
                  : ""
              )}
            >
              <input type="hidden" name="gameId" value={game.id} />
              <input type="hidden" name="pickedTeamId" value={game.away_team.id} />
              <input type="hidden" name="spread" value={game.spread || ""} />
              <input type="hidden" name="isPotd" value={userPick?.is_pick_of_day ? "true" : "false"} />

              <div className={cn(
                "font-semibold text-lg",
                userPick?.picked_team_id === game.away_team.id ? "text-slate-900" : "text-slate-100"
              )}>
                {game.away_team.short_name}
              </div>
              {game.spread && (
                <div className={cn(
                  "text-sm",
                  userPick?.picked_team_id === game.away_team.id
                    ? awayIsFavorite ? 'font-semibold text-blue-700' : 'text-slate-700'
                    : awayIsFavorite ? 'font-semibold text-blue-400' : 'text-slate-400'
                )}>
                  {getSpreadDisplay(game.away_team.id)}
                </div>
              )}
              {game.away_team_injury_count != null && game.away_team_injury_count > 0 && (
                <div className={cn(
                  "text-xs font-semibold mt-1",
                  userPick?.picked_team_id === game.away_team.id ? "text-orange-700" : "text-orange-500"
                )}>
                  {game.away_team_injury_count} {game.away_team_injury_count === 1 ? 'injury' : 'injuries'}
                </div>
              )}
              {isSubmitting && fetcher.formData?.get("pickedTeamId") === game.away_team.id && (
                <div className="flex items-center justify-center gap-1 text-xs text-slate-700 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
              )}
            </fetcher.Form>
          ) : (
            <div className="text-center">
              <div className="font-semibold text-lg">{game.away_team.short_name}</div>
              {game.spread && (
                <div className={`text-sm ${awayIsFavorite ? 'font-semibold text-blue-600' : 'text-gray-600'}`}>
                  {getSpreadDisplay(game.away_team.id)}
                </div>
              )}
              {game.away_team_injury_count != null && game.away_team_injury_count > 0 && (
                <div className="text-xs text-orange-600 mt-1">
                  {game.away_team_injury_count} {game.away_team_injury_count === 1 ? 'injury' : 'injuries'}
                </div>
              )}
            </div>
          )}

          {/* VS/Score */}
          <div className="text-center">
            {game.status === 'completed' && game.home_score !== null && game.away_score !== null ? (
              <div className="text-2xl font-bold">
                {game.away_score} - {game.home_score}
              </div>
            ) : (
              <div className="text-gray-400 text-lg">VS</div>
            )}
            <div className="text-xs text-gray-500 mt-1 capitalize">{game.status}</div>
          </div>

          {/* Home Team */}
          {enablePicking && !isLocked ? (
            <fetcher.Form
              method="post"
              onClick={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.requestSubmit()
                }
              }}
              className={cn(
                "text-center p-3 rounded-lg transition-all duration-200 cursor-pointer hover:scale-105 hover:shadow-md",
                userPick?.picked_team_id === game.home_team.id &&
                  "ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md",
                !userPick?.picked_team_id || userPick?.picked_team_id !== game.home_team.id
                  ? "border-2 border-slate-200 hover:border-slate-300"
                  : ""
              )}
            >
              <input type="hidden" name="gameId" value={game.id} />
              <input type="hidden" name="pickedTeamId" value={game.home_team.id} />
              <input type="hidden" name="spread" value={game.spread || ""} />
              <input type="hidden" name="isPotd" value={userPick?.is_pick_of_day ? "true" : "false"} />

              <div className={cn(
                "font-semibold text-lg",
                userPick?.picked_team_id === game.home_team.id ? "text-slate-900" : "text-slate-100"
              )}>
                {game.home_team.short_name}
              </div>
              {game.spread && (
                <div className={cn(
                  "text-sm",
                  userPick?.picked_team_id === game.home_team.id
                    ? homeIsFavorite ? 'font-semibold text-blue-700' : 'text-slate-700'
                    : homeIsFavorite ? 'font-semibold text-blue-400' : 'text-slate-400'
                )}>
                  {getSpreadDisplay(game.home_team.id)}
                </div>
              )}
              {game.home_team_injury_count != null && game.home_team_injury_count > 0 && (
                <div className={cn(
                  "text-xs font-semibold mt-1",
                  userPick?.picked_team_id === game.home_team.id ? "text-orange-700" : "text-orange-500"
                )}>
                  {game.home_team_injury_count} {game.home_team_injury_count === 1 ? 'injury' : 'injuries'}
                </div>
              )}
              {isSubmitting && fetcher.formData?.get("pickedTeamId") === game.home_team.id && (
                <div className="flex items-center justify-center gap-1 text-xs text-slate-700 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
              )}
            </fetcher.Form>
          ) : (
            <div className="text-center">
              <div className="font-semibold text-lg">{game.home_team.short_name}</div>
              {game.spread && (
                <div className={`text-sm ${homeIsFavorite ? 'font-semibold text-blue-600' : 'text-gray-600'}`}>
                  {getSpreadDisplay(game.home_team.id)}
                </div>
              )}
              {game.home_team_injury_count != null && game.home_team_injury_count > 0 && (
                <div className="text-xs text-orange-600 mt-1">
                  {game.home_team_injury_count} {game.home_team_injury_count === 1 ? 'injury' : 'injuries'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Matchup Analysis Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span>AI Matchup Analysis</span>
          </div>

          <MatchupAnalysis
            gameId={game.id}
            analysis={game.matchup_analysis || null}
            homeTeamName={game.home_team.short_name}
            awayTeamName={game.away_team.short_name}
          />
        </div>

        {/* Analytics Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <TrendingUp className="h-4 w-4" />
            <span>Team Analytics & Comparison</span>
          </div>

          <GameAnalytics
            game={game}
            showComparison={true}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Compact trigger button with icon only
 */
export function GameDetailsDialogCompact({
  game,
  userPick,
  potdGameId,
  enablePicking
}: {
  game: Game
  userPick?: Pick
  potdGameId?: string | null
  enablePicking?: boolean
}) {
  return (
    <GameDetailsDialog
      game={game}
      userPick={userPick}
      potdGameId={potdGameId}
      enablePicking={enablePicking}
      trigger={
        <button
          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          title="View analytics"
          type="button"
        >
          <BarChart3 className="h-4 w-4 text-gray-600" />
        </button>
      }
    />
  )
}
