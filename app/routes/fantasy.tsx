import { useLoaderData, useActionData, Form } from 'react-router'
// import type { Route } from './+types/fantasy'
import { requireAuth } from '~/lib/auth.server'

// Temporary type until route types are generated
type Route = {
  LoaderArgs: { request: Request }
  ActionArgs: { request: Request }
}
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'

type Team = {
  team_id: string
  team_name: string
  team_short_name: string
  conference_id: string
  conference_name: string
  conference_short_name: string
}

type FantasyWeek = {
  id: string
  week_number: number
  start_date: string
  end_date: string
  is_locked: boolean
}

type FantasySeason = {
  id: string
  name: string
  is_active: boolean
}

type ExistingLineup = {
  id: string
  teams: Array<{
    team_id: string
    team_name: string
    team_short_name: string
    slot_type: string
    conference_name: string
  }>
}

type LineupStats = {
  total_points: number
  total_rebounds: number
  total_assists: number
  total_steals: number
  total_blocks: number
  field_goal_percentage: number
  free_throw_percentage: number
  three_point_percentage: number
  total_wins: number
  total_games: number
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers, supabase } = await requireAuth(request)

  // Get active season
  const { data: season } = await supabase
    .from('fantasy_seasons')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!season) {
    return { user, season: null, currentWeek: null, powerTeams: [], midMajorTeams: [], existingLineup: null, headers }
  }

  // Get current week (first non-locked week)
  const { data: currentWeek } = await supabase
    .from('fantasy_weeks')
    .select('*')
    .eq('season_id', season.id)
    .eq('is_locked', false)
    .order('week_number', { ascending: true })
    .limit(1)
    .single()

  if (!currentWeek) {
    return { user, season, currentWeek: null, powerTeams: [], midMajorTeams: [], existingLineup: null, lineupStats: null, headers }
  }

  // Get existing lineup for this week
  const { data: existingLineupData } = await supabase
    .from('fantasy_lineups')
    .select(`
      id,
      fantasy_lineup_teams (
        team_id,
        slot_type,
        teams (
          name,
          short_name,
          conferences (
            name
          )
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('week_id', currentWeek.id)
    .single()

  let existingLineup: ExistingLineup | null = null
  if (existingLineupData) {
    existingLineup = {
      id: existingLineupData.id,
      teams: (existingLineupData.fantasy_lineup_teams as any[]).map((flt) => ({
        team_id: flt.team_id,
        team_name: flt.teams.name,
        team_short_name: flt.teams.short_name,
        slot_type: flt.slot_type,
        conference_name: flt.teams.conferences.name
      }))
    }
  }

  // Get available power conference teams (using helper function)
  const { data: powerTeams } = await supabase.rpc('get_available_teams_for_user', {
    p_user_id: user.id,
    p_week_id: currentWeek.id,
    p_is_power_conference: true
  })

  // Get available mid-major teams
  const { data: midMajorTeams } = await supabase.rpc('get_available_teams_for_user', {
    p_user_id: user.id,
    p_week_id: currentWeek.id,
    p_is_power_conference: false
  })

  // Get lineup stats if lineup exists
  let lineupStats: LineupStats | null = null
  if (existingLineup) {
    const { data: stats } = await supabase.rpc('calculate_lineup_weekly_stats', {
      p_lineup_id: existingLineup.id
    })

    if (stats && stats.length > 0) {
      lineupStats = stats[0]
    }
  }

  return {
    user,
    season,
    currentWeek,
    powerTeams: powerTeams || [],
    midMajorTeams: midMajorTeams || [],
    existingLineup,
    lineupStats,
    headers
  }
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers, supabase } = await requireAuth(request)
  const formData = await request.formData()

  const weekId = formData.get('week_id') as string
  const power1 = formData.get('power_1') as string
  const power2 = formData.get('power_2') as string
  const power3 = formData.get('power_3') as string
  const midMajor1 = formData.get('mid_major_1') as string
  const midMajor2 = formData.get('mid_major_2') as string
  const flex = formData.get('flex') as string

  // Validate all slots are filled
  if (!power1 || !power2 || !power3 || !midMajor1 || !midMajor2 || !flex) {
    return { error: 'Please select a team for all slots', headers }
  }

  // Validate no duplicates
  const teams = [power1, power2, power3, midMajor1, midMajor2, flex]
  if (new Set(teams).size !== teams.length) {
    return { error: 'Cannot select the same team multiple times', headers }
  }

  try {
    // Check if lineup already exists
    const { data: existingLineup } = await supabase
      .from('fantasy_lineups')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_id', weekId)
      .single()

    let lineupId: string

    if (existingLineup) {
      // Update existing lineup
      lineupId = existingLineup.id

      // Delete existing lineup teams
      await supabase
        .from('fantasy_lineup_teams')
        .delete()
        .eq('lineup_id', lineupId)
    } else {
      // Create new lineup
      const { data: newLineup, error: lineupError } = await supabase
        .from('fantasy_lineups')
        .insert({
          user_id: user.id,
          week_id: weekId
        })
        .select('id')
        .single()

      if (lineupError) throw lineupError
      lineupId = newLineup.id
    }

    // Insert lineup teams
    const lineupTeams = [
      { lineup_id: lineupId, team_id: power1, slot_type: 'power_1' },
      { lineup_id: lineupId, team_id: power2, slot_type: 'power_2' },
      { lineup_id: lineupId, team_id: power3, slot_type: 'power_3' },
      { lineup_id: lineupId, team_id: midMajor1, slot_type: 'mid_major_1' },
      { lineup_id: lineupId, team_id: midMajor2, slot_type: 'mid_major_2' },
      { lineup_id: lineupId, team_id: flex, slot_type: 'flex' }
    ]

    const { error: teamsError } = await supabase
      .from('fantasy_lineup_teams')
      .insert(lineupTeams)

    if (teamsError) throw teamsError

    // Get season_id for team usage tracking
    const { data: week } = await supabase
      .from('fantasy_weeks')
      .select('season_id')
      .eq('id', weekId)
      .single()

    if (!week) throw new Error('Week not found')

    // Track team usage (for burn rule)
    const teamUsage = lineupTeams.map(lt => ({
      season_id: week.season_id,
      user_id: user.id,
      team_id: lt.team_id,
      week_used_id: weekId,
      slot_type: lt.slot_type
    }))

    // Upsert team usage (handles both new and updated lineups)
    const { error: usageError } = await supabase
      .from('fantasy_team_usage')
      .upsert(teamUsage, {
        onConflict: 'season_id,user_id,team_id',
        ignoreDuplicates: false
      })

    if (usageError) throw usageError

    return { success: true, headers }
  } catch (error: any) {
    console.error('Error submitting lineup:', error)
    return { error: error.message || 'Failed to submit lineup', headers }
  }
}

export default function Fantasy() {
  const { season, currentWeek, powerTeams, midMajorTeams, existingLineup, lineupStats } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()

  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({
    power_1: existingLineup?.teams.find(t => t.slot_type === 'power_1')?.team_id || '',
    power_2: existingLineup?.teams.find(t => t.slot_type === 'power_2')?.team_id || '',
    power_3: existingLineup?.teams.find(t => t.slot_type === 'power_3')?.team_id || '',
    mid_major_1: existingLineup?.teams.find(t => t.slot_type === 'mid_major_1')?.team_id || '',
    mid_major_2: existingLineup?.teams.find(t => t.slot_type === 'mid_major_2')?.team_id || '',
    flex: existingLineup?.teams.find(t => t.slot_type === 'flex')?.team_id || ''
  })

  useEffect(() => {
    if (actionData?.success) {
      toast.success('Lineup submitted successfully!')
    }
    if (actionData?.error) {
      toast.error(actionData.error)
    }
  }, [actionData])

  if (!season || !currentWeek) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Fantasy League</CardTitle>
            <CardDescription>No active season or week available</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Get available teams for each slot type
  const getAvailableTeams = (slotType: string) => {
    const isPowerSlot = slotType.startsWith('power')
    const baseTeams = isPowerSlot ? powerTeams : midMajorTeams
    const selectedInOtherSlots = Object.entries(selectedTeams)
      .filter(([key]) => key !== slotType)
      .map(([, value]) => value)

    return baseTeams.filter((t: Team) => !selectedInOtherSlots.includes(t.team_id))
  }

  const allTeams = [...powerTeams, ...midMajorTeams]
  const flexAvailableTeams = allTeams.filter((t: Team) => {
    const selectedInOtherSlots = Object.entries(selectedTeams)
      .filter(([key]) => key !== 'flex')
      .map(([, value]) => value)
    return !selectedInOtherSlots.includes(t.team_id)
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">The Long Burn</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {season.name} - Week {currentWeek.week_number}
        </p>
      </div>

      <Tabs defaultValue="lineup" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lineup">Set Lineup</TabsTrigger>
          <TabsTrigger value="stats">My Stats</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
        </TabsList>

        <TabsContent value="lineup" className="space-y-6">
          {existingLineup && (
        <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30">
          <CardHeader>
            <CardTitle className="text-green-900 dark:text-green-100">Current Lineup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {existingLineup.teams.map(team => (
                <div key={team.team_id} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg">
                  <div>
                    <p className="font-medium">{team.team_name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{team.conference_name}</p>
                  </div>
                  <Badge variant="outline">
                    {team.slot_type.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Submit Lineup</CardTitle>
          <CardDescription>
            Select 6 teams: 3 Power Conference, 2 Mid-Major, 1 Flex
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-6">
            <input type="hidden" name="week_id" value={currentWeek.id} />

            {/* Power Conference Slots */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600">Power Conference</Badge>
                <span className="text-sm text-slate-600 dark:text-slate-400">3 slots required</span>
              </div>

              {['power_1', 'power_2', 'power_3'].map((slot, idx) => (
                <div key={slot} className="space-y-2">
                  <label className="text-sm font-medium">
                    Power Slot {idx + 1}
                  </label>
                  <Select
                    name={slot}
                    value={selectedTeams[slot]}
                    onValueChange={(value) => setSelectedTeams(prev => ({ ...prev, [slot]: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a power conference team" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableTeams(slot).map((team: Team) => (
                        <SelectItem key={team.team_id} value={team.team_id}>
                          {team.team_name} ({team.conference_short_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <Separator />

            {/* Mid-Major Slots */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-600">Mid-Major</Badge>
                <span className="text-sm text-slate-600 dark:text-slate-400">2 slots required</span>
              </div>

              {['mid_major_1', 'mid_major_2'].map((slot, idx) => (
                <div key={slot} className="space-y-2">
                  <label className="text-sm font-medium">
                    Mid-Major Slot {idx + 1}
                  </label>
                  <Select
                    name={slot}
                    value={selectedTeams[slot]}
                    onValueChange={(value) => setSelectedTeams(prev => ({ ...prev, [slot]: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a mid-major team" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableTeams(slot).map((team: Team) => (
                        <SelectItem key={team.team_id} value={team.team_id}>
                          {team.team_name} ({team.conference_short_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <Separator />

            {/* Flex Slot */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-600">Flex</Badge>
                <span className="text-sm text-slate-600 dark:text-slate-400">Any conference</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Flex Slot</label>
                <Select
                  name="flex"
                  value={selectedTeams.flex}
                  onValueChange={(value) => setSelectedTeams(prev => ({ ...prev, flex: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select any team" />
                  </SelectTrigger>
                  <SelectContent>
                    {flexAvailableTeams.map((team: Team) => (
                      <SelectItem key={team.team_id} value={team.team_id}>
                        {team.team_name} ({team.conference_short_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg">
              {existingLineup ? 'Update Lineup' : 'Submit Lineup'}
            </Button>
          </Form>
        </CardContent>
      </Card>

          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <p>• Each week, select 6 teams (3 Power + 2 Mid-Major + 1 Flex)</p>
              <p>• Once you use a team, you cannot use it again this season (burn rule)</p>
              <p>• Teams compete head-to-head in 9 categories</p>
              <p>• Win a category = 1 pt, Tie = 0.5 pt</p>
              <p>• Categories: Points, Rebounds, Assists, Steals, Blocks, FG%, FT%, 3P%, Wins</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          {!existingLineup ? (
            <Card>
              <CardHeader>
                <CardTitle>No Lineup Set</CardTitle>
                <CardDescription>Submit a lineup to see your stats</CardDescription>
              </CardHeader>
            </Card>
          ) : !lineupStats || lineupStats.total_games === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Games Played Yet</CardTitle>
                <CardDescription>Your teams haven't played any games this week yet</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Week {currentWeek.week_number} Performance</CardTitle>
                  <CardDescription>
                    Games played: {lineupStats.total_games} | Record: {lineupStats.total_wins}-{lineupStats.total_games - lineupStats.total_wins}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">Points</p>
                      <p className="text-2xl font-bold">{lineupStats.total_points}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">Rebounds</p>
                      <p className="text-2xl font-bold">{lineupStats.total_rebounds}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">Assists</p>
                      <p className="text-2xl font-bold">{lineupStats.total_assists}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">Steals</p>
                      <p className="text-2xl font-bold">{lineupStats.total_steals}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">Blocks</p>
                      <p className="text-2xl font-bold">{lineupStats.total_blocks}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">Wins</p>
                      <p className="text-2xl font-bold">{lineupStats.total_wins}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">FG%</p>
                      <p className="text-2xl font-bold">{(lineupStats.field_goal_percentage * 100).toFixed(1)}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">FT%</p>
                      <p className="text-2xl font-bold">{(lineupStats.free_throw_percentage * 100).toFixed(1)}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">3P%</p>
                      <p className="text-2xl font-bold">{(lineupStats.three_point_percentage * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="standings">
          <Card>
            <CardHeader>
              <CardTitle>Season Standings</CardTitle>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
