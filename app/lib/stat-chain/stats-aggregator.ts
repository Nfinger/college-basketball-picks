// Stats Aggregator - Fetches and combines statistics from multiple sources

import type { SupabaseClient } from '@supabase/supabase-js'

export type TeamWithStats = {
  id: string
  name: string
  shortName: string
  conference: string
  stats: {
    // Rankings
    kenpomRank?: number
    barttovikRank?: number
    overallRank?: number

    // Efficiency metrics
    offensiveEfficiency?: number
    defensiveEfficiency?: number
    tempo?: number

    // Traditional stats
    wins?: number
    losses?: number
    pointsPerGame?: number
    pointsAllowedPerGame?: number
    fieldGoalPct?: number
    threePointPct?: number
    freeThrowPct?: number
    reboundsPerGame?: number
    assistsPerGame?: number
    turnoversPerGame?: number

    // Advanced metrics
    strengthOfSchedule?: number
    adjEM?: number // Adjusted efficiency margin
    luck?: number // KenPom luck metric

    // Source-specific raw data
    kenpomRaw?: Record<string, any>
    barttovikRaw?: Record<string, any>
    espnRaw?: Record<string, any>
  }
}

export class StatsAggregator {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Fetch comprehensive statistics for a set of teams
   */
  async getTeamsWithStats(teamIds: string[], season?: number): Promise<TeamWithStats[]> {
    const currentSeason = season || this.getCurrentSeason()

    // Fetch teams with conference info
    const { data: teams, error: teamsError } = await this.supabase
      .from('teams')
      .select(`
        id,
        name,
        short_name,
        conference:conferences(name)
      `)
      .in('id', teamIds)

    if (teamsError) {
      throw new Error(`Failed to fetch teams: ${teamsError.message}`)
    }

    if (!teams || teams.length === 0) {
      return []
    }

    // Fetch all stats for these teams
    const { data: statsData, error: statsError } = await this.supabase
      .from('team_stats')
      .select('*')
      .in('team_id', teamIds)
      .eq('season', currentSeason)

    if (statsError) {
      throw new Error(`Failed to fetch stats: ${statsError.message}`)
    }

    // Aggregate stats by team
    const teamsWithStats: TeamWithStats[] = teams.map((team) => {
      const teamStats = statsData?.filter((s) => s.team_id === team.id) || []

      // Group by source
      const kenpomStats = teamStats.find((s) => s.source === 'kenpom')
      const barttovikStats = teamStats.find((s) => s.source === 'barttorvik')
      const espnStats = teamStats.find((s) => s.source === 'espn')

      return {
        id: team.id,
        name: team.name,
        shortName: team.short_name,
        conference: team.conference?.name || 'Unknown',
        stats: {
          // Use KenPom as primary source for rankings
          kenpomRank: kenpomStats?.overall_rank,
          barttovikRank: barttovikStats?.overall_rank,
          overallRank: kenpomStats?.overall_rank || barttovikStats?.overall_rank,

          // Efficiency metrics (prefer KenPom)
          offensiveEfficiency: kenpomStats?.offensive_efficiency || barttovikStats?.offensive_efficiency,
          defensiveEfficiency: kenpomStats?.defensive_efficiency || barttovikStats?.defensive_efficiency,
          tempo: kenpomStats?.tempo || barttovikStats?.tempo,

          // Traditional stats (prefer ESPN)
          wins: espnStats?.wins || kenpomStats?.wins,
          losses: espnStats?.losses || kenpomStats?.losses,
          pointsPerGame: espnStats?.points_per_game,
          pointsAllowedPerGame: espnStats?.points_allowed_per_game,
          fieldGoalPct: espnStats?.field_goal_pct,
          threePointPct: espnStats?.three_point_pct,
          freeThrowPct: espnStats?.free_throw_pct,
          reboundsPerGame: espnStats?.rebounds_per_game,
          assistsPerGame: espnStats?.assists_per_game,
          turnoversPerGame: espnStats?.turnovers_per_game,

          // Advanced metrics
          strengthOfSchedule: kenpomStats?.strength_of_schedule,
          adjEM: kenpomStats?.raw_stats?.adjustedEfficiencyMargin,
          luck: kenpomStats?.raw_stats?.luck,

          // Raw data for AI analysis
          kenpomRaw: kenpomStats?.raw_stats,
          barttovikRaw: barttovikStats?.raw_stats,
          espnRaw: espnStats?.raw_stats,
        },
      }
    })

    return teamsWithStats
  }

  /**
   * Get all teams with stats for puzzle generation
   */
  async getAllTeamsWithStats(season?: number): Promise<TeamWithStats[]> {
    const currentSeason = season || this.getCurrentSeason()

    // Fetch all teams
    const { data: teams, error: teamsError } = await this.supabase
      .from('teams')
      .select(`
        id,
        name,
        short_name,
        conference:conferences(name)
      `)
      .order('name')

    if (teamsError) {
      throw new Error(`Failed to fetch teams: ${teamsError.message}`)
    }

    if (!teams || teams.length === 0) {
      return []
    }

    const teamIds = teams.map((t) => t.id)
    return this.getTeamsWithStats(teamIds, season)
  }

  /**
   * Filter teams by conference
   */
  async getTeamsByConference(
    conferenceName: string,
    season?: number
  ): Promise<TeamWithStats[]> {
    const currentSeason = season || this.getCurrentSeason()

    const { data: teams, error: teamsError } = await this.supabase
      .from('teams')
      .select(`
        id,
        name,
        short_name,
        conference:conferences!inner(name)
      `)
      .eq('conferences.name', conferenceName)

    if (teamsError) {
      throw new Error(`Failed to fetch teams: ${teamsError.message}`)
    }

    if (!teams || teams.length === 0) {
      return []
    }

    const teamIds = teams.map((t) => t.id)
    return this.getTeamsWithStats(teamIds, season)
  }

  /**
   * Get teams filtered by statistical criteria
   */
  async getTeamsByStatRange(
    stat: string,
    min: number,
    max: number,
    season?: number
  ): Promise<TeamWithStats[]> {
    const currentSeason = season || this.getCurrentSeason()

    // Map stat name to column
    const columnMap: Record<string, string> = {
      'rank': 'overall_rank',
      'offEff': 'offensive_efficiency',
      'defEff': 'defensive_efficiency',
      'tempo': 'tempo',
      'ppg': 'points_per_game',
      'papg': 'points_allowed_per_game',
      'fgPct': 'field_goal_pct',
      '3pPct': 'three_point_pct',
      'ftPct': 'free_throw_pct',
      'rpg': 'rebounds_per_game',
      'apg': 'assists_per_game',
      'tpg': 'turnovers_per_game',
    }

    const column = columnMap[stat]
    if (!column) {
      throw new Error(`Unknown stat: ${stat}`)
    }

    const { data: stats, error: statsError } = await this.supabase
      .from('team_stats')
      .select('team_id')
      .eq('season', currentSeason)
      .gte(column, min)
      .lte(column, max)

    if (statsError) {
      throw new Error(`Failed to fetch stats: ${statsError.message}`)
    }

    if (!stats || stats.length === 0) {
      return []
    }

    const teamIds = [...new Set(stats.map((s) => s.team_id))]
    return this.getTeamsWithStats(teamIds, season)
  }

  private getCurrentSeason(): number {
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    // Season rolls over in August
    return month >= 8 ? year + 1 : year
  }
}
