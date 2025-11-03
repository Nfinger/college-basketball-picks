import { useLoaderData, useSearchParams } from 'react-router'
import type { Route } from './+types/metrics'
import { requireAuth } from '~/lib/auth.server'
import { AppLayout } from '~/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { TrendingUp, TrendingDown, Trophy, Star } from 'lucide-react'

type UserStats = {
  user_id: string
  username: string
  total_picks: number
  wins: number
  losses: number
  win_rate: string
}

type ConferenceStats = {
  conference_id: string
  conference_short_name: string
  is_power_conference: boolean
  total_picks: number
  wins: number
  losses: number
  win_rate: string
}

type ComparisonStats = {
  user: { id: string; username: string }
  stats: UserStats
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase, headers } = await requireAuth(request)

  // Parse URL search parameters
  const url = new URL(request.url)
  const conferenceFilter = url.searchParams.get('conf') || 'all'

  // Get all stats in parallel for performance
  const [
    { data: overallStats },
    { data: conferenceStats },
    { data: streak },
    { data: allUsersStats },
    { data: potdStats },
    { data: potdStreak },
    { data: potdComparison },
  ] = await Promise.all([
    supabase.rpc('get_user_overall_stats', { user_uuid: user.id }),
    supabase.rpc('get_user_conference_stats', { user_uuid: user.id }),
    supabase.rpc('get_user_current_streak', { user_uuid: user.id }),
    supabase.rpc('get_all_users_overall_stats'),
    supabase.rpc('get_user_potd_stats', { user_uuid: user.id }),
    supabase.rpc('get_user_potd_streak', { user_uuid: user.id }),
    supabase.rpc('get_user_potd_comparison', { user_uuid: user.id }),
  ])

  // Filter out current user for comparison
  const comparisonStats = (allUsersStats || [])
    .filter((u: UserStats) => u.user_id !== user.id)
    .map((stats: UserStats) => ({
      user: { id: stats.user_id, username: stats.username },
      stats,
    }))

  // Apply conference filter server-side
  const filteredConferenceStats = (conferenceStats || []).filter((conf: ConferenceStats) => {
    if (conferenceFilter === 'power') return conf.is_power_conference
    if (conferenceFilter === 'midmajor') return !conf.is_power_conference
    return true
  })

  // Calculate power vs mid-major stats
  const powerStats = (conferenceStats || []).filter((c: ConferenceStats) => c.is_power_conference)
  const midMajorStats = (conferenceStats || []).filter((c: ConferenceStats) => !c.is_power_conference)

  const powerTotals = powerStats.reduce(
    (acc: { picks: number; wins: number; losses: number }, curr: ConferenceStats) => ({
      picks: acc.picks + Number(curr.total_picks),
      wins: acc.wins + Number(curr.wins),
      losses: acc.losses + Number(curr.losses),
    }),
    { picks: 0, wins: 0, losses: 0 }
  )

  const midMajorTotals = midMajorStats.reduce(
    (acc: { picks: number; wins: number; losses: number }, curr: ConferenceStats) => ({
      picks: acc.picks + Number(curr.total_picks),
      wins: acc.wins + Number(curr.wins),
      losses: acc.losses + Number(curr.losses),
    }),
    { picks: 0, wins: 0, losses: 0 }
  )

  const powerWinRate = powerTotals.picks
    ? ((powerTotals.wins / (powerTotals.wins + powerTotals.losses)) * 100).toFixed(2)
    : '0.00'

  const midMajorWinRate = midMajorTotals.picks
    ? ((midMajorTotals.wins / (midMajorTotals.wins + midMajorTotals.losses)) * 100).toFixed(2)
    : '0.00'

  // Sort comparison stats by win rate
  const sortedComparisonStats = comparisonStats.sort(
    (a: ComparisonStats, b: ComparisonStats) =>
      Number(b.stats.win_rate || 0) - Number(a.stats.win_rate || 0)
  )

  return {
    user,
    overallStats: overallStats?.[0] || null,
    conferenceStats: filteredConferenceStats,
    allConferenceStats: conferenceStats || [],
    powerTotals,
    midMajorTotals,
    powerWinRate,
    midMajorWinRate,
    streak: streak?.[0] || null,
    comparisonStats: sortedComparisonStats,
    potdStats: potdStats?.[0] || null,
    potdStreak: potdStreak?.[0] || null,
    potdComparison: potdComparison || [],
    headers,
  }
}

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Metrics - College Basketball Picks' },
    { name: 'description', content: 'View your picking statistics and performance' },
  ]
}

export default function Metrics() {
  const {
    user,
    overallStats,
    conferenceStats,
    allConferenceStats,
    powerTotals,
    midMajorTotals,
    powerWinRate,
    midMajorWinRate,
    streak,
    comparisonStats,
    potdStats,
    potdStreak,
    potdComparison,
  } = useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSearchParams()

  // Get current filter from URL params
  const conferenceFilter = searchParams.get('conf') || 'all'

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Your Performance
          </h1>
          <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-400">
            Track your picking accuracy and compare with others
          </p>
        </div>

        {/* Overall Stats */}
        
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/50 border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Total Picks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{overallStats.total_picks}</div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                Wins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600 dark:text-green-400 tabular-nums">{overallStats.wins}</div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
                Losses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-red-600 dark:text-red-400 tabular-nums">{overallStats.losses}</div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                Win Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-3">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {overallStats.win_rate || '0'}%
                </div>
                {overallStats.win_rate && Number(overallStats.win_rate) > 50 ? (
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Streak */}
        {streak && (
          <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-900 hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-amber-900 dark:text-amber-100">Current Streak</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                  <Trophy className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                    {streak.streak_count} {streak.streak_type === 'won' ? 'Wins' : 'Losses'}
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    Keep it going!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pick of the Day Stats */}
        {potdStats && potdStats.total_potd > 0 && (
          <>
            <div className="mt-8 mb-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 dark:from-yellow-400 dark:to-amber-400 bg-clip-text text-transparent flex items-center gap-2">
                <Star className="w-6 h-6 fill-yellow-500 text-yellow-600" />
                Pick of the Day Performance
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Track your performance on your most confident picks
              </p>
            </div>

            {/* POTD Stats Cards */}
            <div className="grid gap-6 md:grid-cols-4">
              <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-500" />
                    Total POTDs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-yellow-600 dark:text-yellow-400 tabular-nums">{potdStats.total_potd}</div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                    POTD Wins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400 tabular-nums">{potdStats.wins}</div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
                    POTD Losses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-red-600 dark:text-red-400 tabular-nums">{potdStats.losses}</div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                    POTD Win Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-3">
                    <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      {potdStats.win_rate || '0'}%
                    </div>
                    {potdStats.win_rate && Number(potdStats.win_rate) > 50 ? (
                      <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* POTD Streak */}
            {potdStreak && potdStreak.streak_count > 0 && (
              <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-900 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
                    <Star className="w-5 h-5 fill-yellow-500" />
                    Current POTD Streak
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
                      <Trophy className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                        {potdStreak.streak_count} {potdStreak.streak_type === 'won' ? 'Wins' : 'Losses'}
                      </div>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                        Your most confident picks streak!
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* POTD vs Regular Picks Comparison */}
            {potdComparison.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 fill-yellow-500 text-yellow-600" />
                    Pick of the Day vs Regular Picks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pick Type</TableHead>
                        <TableHead className="text-right">Total Picks</TableHead>
                        <TableHead className="text-right">Wins</TableHead>
                        <TableHead className="text-right">Losses</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {potdComparison.map((comp: { pick_type: string; total_picks: number; wins: number; losses: number; win_rate: string }) => (
                        <TableRow key={comp.pick_type} className={comp.pick_type === 'Pick of the Day' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {comp.pick_type === 'Pick of the Day' && <Star className="w-4 h-4 fill-yellow-500 text-yellow-600" />}
                              {comp.pick_type}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{comp.total_picks}</TableCell>
                          <TableCell className="text-right text-green-600">{comp.wins}</TableCell>
                          <TableCell className="text-right text-red-600">{comp.losses}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={Number(comp.win_rate) > 50 ? 'default' : 'secondary'}
                              className={comp.pick_type === 'Pick of the Day' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                            >
                              {comp.win_rate || '0'}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Power vs Mid-Major */}
        {(powerTotals.picks > 0 || midMajorTotals.picks > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Power Conferences vs Mid-Majors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Power Conferences</span>
                    <Badge variant="default">★</Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Picks:</span>
                      <span className="font-medium">{powerTotals.picks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Wins:</span>
                      <span className="font-medium text-green-600">{powerTotals.wins}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Losses:</span>
                      <span className="font-medium text-red-600">{powerTotals.losses}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Win Rate:</span>
                      <span>{powerWinRate}%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Mid-Majors</span>
                    <Badge variant="secondary">MM</Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Picks:</span>
                      <span className="font-medium">{midMajorTotals.picks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Wins:</span>
                      <span className="font-medium text-green-600">{midMajorTotals.wins}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Losses:</span>
                      <span className="font-medium text-red-600">{midMajorTotals.losses}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Win Rate:</span>
                      <span>{midMajorWinRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conference Breakdown */}
        {allConferenceStats.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Performance by Conference</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={conferenceFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams)
                      newParams.delete('conf')
                      setSearchParams(newParams, { replace: true })
                    }}
                  >
                    All
                  </Button>
                  <Button
                    variant={conferenceFilter === 'power' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams)
                      newParams.set('conf', 'power')
                      setSearchParams(newParams, { replace: true })
                    }}
                  >
                    Power
                  </Button>
                  <Button
                    variant={conferenceFilter === 'midmajor' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams)
                      newParams.set('conf', 'midmajor')
                      setSearchParams(newParams, { replace: true })
                    }}
                  >
                    Mid-Major
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conference</TableHead>
                    <TableHead className="text-right">Picks</TableHead>
                    <TableHead className="text-right">Wins</TableHead>
                    <TableHead className="text-right">Losses</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conferenceStats.map((conf: ConferenceStats) => (
                    <TableRow key={conf.conference_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {conf.conference_short_name}
                          {conf.is_power_conference && (
                            <Badge variant="outline" className="text-xs">★</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{conf.total_picks}</TableCell>
                      <TableCell className="text-right text-green-600">{conf.wins}</TableCell>
                      <TableCell className="text-right text-red-600">{conf.losses}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={Number(conf.win_rate) > 50 ? 'default' : 'secondary'}
                        >
                          {conf.win_rate || '0'}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Head-to-Head Comparison */}
        {comparisonStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Head-to-Head Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Total Picks</TableHead>
                    <TableHead className="text-right">Wins</TableHead>
                    <TableHead className="text-right">Losses</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Current user row */}
                  {overallStats && (
                    <TableRow className="bg-blue-50 dark:bg-blue-900/20">
                      <TableCell className="font-semibold">
                        You
                      </TableCell>
                      <TableCell className="text-right">{overallStats.total_picks}</TableCell>
                      <TableCell className="text-right text-green-600">{overallStats.wins}</TableCell>
                      <TableCell className="text-right text-red-600">{overallStats.losses}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="default">{overallStats.win_rate || '0'}%</Badge>
                      </TableCell>
                    </TableRow>
                  )}
                  {/* Other users */}
                  {comparisonStats
                    .filter((comp: ComparisonStats) => comp.stats)
                    .map((comp: ComparisonStats) => (
                      <TableRow key={comp.user.id}>
                        <TableCell>{comp.user.username}</TableCell>
                        <TableCell className="text-right">{comp.stats.total_picks}</TableCell>
                        <TableCell className="text-right text-green-600">{comp.stats.wins}</TableCell>
                        <TableCell className="text-right text-red-600">{comp.stats.losses}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{comp.stats.win_rate || '0'}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
