import { useState, useMemo, useEffect } from 'react'
import { useLoaderData, useNavigation, useActionData } from 'react-router'
import type { Route } from './+types/_index'
import { requireAuth } from '~/lib/auth.server'
import { AppLayout } from '~/components/AppLayout'
import { GameCard } from '~/components/GameCard'
import { GameCardSkeleton } from '~/components/GameCardSkeleton'
import { GameFilters, type FilterState } from '~/components/GameFilters'
import { Card, CardContent } from '~/components/ui/card'
import { toast } from 'sonner'

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase, headers } = await requireAuth(request)

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]

  // Fetch today's games with user picks
  const { data: games, error } = await supabase
    .from('games')
    .select(`
      *,
      home_team:teams!games_home_team_id_fkey(id, name, short_name),
      away_team:teams!games_away_team_id_fkey(id, name, short_name),
      conference:conferences(id, name, short_name, is_power_conference),
      picks(id, picked_team_id, spread_at_pick_time, result, locked_at)
    `)
    .gte('game_date', `${today}T00:00:00`)
    .lt('game_date', `${today}T23:59:59`)
    .eq('picks.user_id', user.id)
    .order('game_date', { ascending: true })

  if (error) {
    console.error('Error fetching games:', error)
  }

  // Fetch all conferences for filtering
  const { data: conferences } = await supabase
    .from('conferences')
    .select('id, name, short_name, is_power_conference')
    .order('name', { ascending: true })

  return { user, games: games || [], conferences: conferences || [], headers }
}

export async function action({ request }: Route.ActionArgs) {
  const { user, supabase, headers } = await requireAuth(request)

  const formData = await request.formData()
  const gameId = formData.get('gameId') as string
  const pickedTeamId = formData.get('pickedTeamId') as string
  const spread = formData.get('spread') as string

  if (!gameId || !pickedTeamId) {
    return { error: 'Missing required fields', headers }
  }

  // Check if game has started (locked)
  const { data: game } = await supabase
    .from('games')
    .select('game_date, status')
    .eq('id', gameId)
    .single()

  if (!game) {
    return { error: 'Game not found', headers }
  }

  if (game.status !== 'scheduled' || new Date(game.game_date) < new Date()) {
    return { error: 'Game has already started', headers }
  }

  // Upsert pick (update if exists, insert if not)
  const { error } = await supabase
    .from('picks')
    .upsert({
      user_id: user.id,
      game_id: gameId,
      picked_team_id: pickedTeamId,
      spread_at_pick_time: parseFloat(spread) || 0,
      result: 'pending',
    }, {
      onConflict: 'user_id,game_id'
    })

  if (error) {
    console.error('Error saving pick:', error)
    return { error: error.message, headers }
  }

  return { success: true, headers }
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Today's Games - College Basketball Picks" },
    { name: 'description', content: 'Make your picks for today\'s college basketball games' },
  ]
}

export default function Index() {
  const { user, games, conferences } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const actionData = useActionData<typeof action>()
  const [filterState, setFilterState] = useState<FilterState | null>(null)

  const isLoading = navigation.state === 'loading'
  const isSubmitting = navigation.state === 'submitting'

  // Show toast notifications for pick results
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        toast.success('Pick saved successfully!')
      } else if (actionData.error) {
        toast.error(actionData.error)
      }
    }
  }, [actionData])

  // Apply filters to games
  const filteredGames = useMemo(() => {
    if (!filterState) return games

    return games.filter((game: any) => {
      // Search filter
      if (filterState.search) {
        const search = filterState.search.toLowerCase()
        const matchesHome = game.home_team.name.toLowerCase().includes(search)
        const matchesAway = game.away_team.name.toLowerCase().includes(search)
        if (!matchesHome && !matchesAway) return false
      }

      // Conference filter
      if (filterState.conferences.length > 0) {
        if (!filterState.conferences.includes(game.conference.id)) return false
      }

      // Power conference filter
      if (filterState.powerOnly && !game.conference.is_power_conference) {
        return false
      }

      // Mid-major filter
      if (filterState.midMajorOnly && game.conference.is_power_conference) {
        return false
      }

      // Picks only filter
      if (filterState.picksOnly && (!game.picks || game.picks.length === 0)) {
        return false
      }

      return true
    })
  }, [games, filterState])

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Today's Games
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Filters */}
        <GameFilters conferences={conferences} onFilterChange={setFilterState} />

        {isLoading ? (
          <div className="grid gap-4">
            <GameCardSkeleton />
            <GameCardSkeleton />
            <GameCardSkeleton />
          </div>
        ) : filteredGames.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  {games.length === 0
                    ? 'No games scheduled for today.'
                    : 'No games match your filters.'}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  {games.length === 0
                    ? 'Games will appear here once the scraping job is set up.'
                    : 'Try adjusting your filters.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                Showing {filteredGames.length} of {games.length} games
              </span>
            </div>
            <div className="grid gap-4">
              {filteredGames.map((game: any) => (
                <GameCard
                  key={game.id}
                  game={game}
                  userPick={game.picks?.[0]}
                  userId={user.id}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
