import type { Route } from './+types/api.stats.$teamId'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/stats/:teamId
 * Returns merged team statistics from multiple sources
 *
 * Query params:
 * - season: 2024, 2025, etc. (defaults to current season)
 * - source: 'kenpom', 'barttorvik', 'espn', or 'all' (defaults to 'all')
 *
 * Response prioritizes sources in order: kenpom > barttorvik > espn
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  const { teamId } = params
  const url = new URL(request.url)
  const seasonParam = url.searchParams.get('season')
  const sourceParam = url.searchParams.get('source') || 'all'

  // Determine current season
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const currentSeason = month >= 8 ? year + 1 : year
  const season = seasonParam ? parseInt(seasonParam) : currentSeason

  try {
    // Fetch stats based on source parameter
    let query = supabase
      .from('team_stats')
      .select('*')
      .eq('team_id', teamId)
      .eq('season', season)

    if (sourceParam !== 'all') {
      query = query.eq('source', sourceParam)
    }

    query = query.order('updated_at', { ascending: false })

    const { data: stats, error } = await query

    if (error) {
      console.error('Error fetching team stats:', error)
      return Response.json({ error: 'Failed to fetch team stats' }, { status: 500 })
    }

    if (!stats || stats.length === 0) {
      return Response.json({ error: 'No stats found for team' }, { status: 404 })
    }

    // If requesting all sources, merge them with priority: kenpom > barttorvik > espn
    if (sourceParam === 'all') {
      const merged = mergeTeamStats(stats)
      return Response.json({
        teamId,
        season,
        stats: merged,
        sources: stats.map(s => s.source),
        lastUpdated: stats[0]?.updated_at
      })
    }

    // Return single source
    return Response.json({
      teamId,
      season,
      stats: stats[0],
      source: sourceParam,
      lastUpdated: stats[0]?.updated_at
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Merge stats from multiple sources with prioritization
 * Priority: KenPom > BartTorvik > ESPN
 */
function mergeTeamStats(stats: any[]) {
  const sourcePriority = ['kenpom', 'barttorvik', 'espn']

  // Create a map of stats by source
  const statsBySource = new Map()
  stats.forEach(stat => {
    statsBySource.set(stat.source, stat)
  })

  // Start with an empty merged object
  const merged: any = {
    team_id: stats[0].team_id,
    season: stats[0].season,
    sources_used: []
  }

  // Merge fields with priority
  for (const source of sourcePriority) {
    const sourceStat = statsBySource.get(source)
    if (!sourceStat) continue

    merged.sources_used.push(source)

    // Efficiency metrics (prefer KenPom/BartTorvik)
    if (!merged.offensive_efficiency && sourceStat.offensive_efficiency) {
      merged.offensive_efficiency = sourceStat.offensive_efficiency
      merged.offensive_efficiency_source = source
    }
    if (!merged.defensive_efficiency && sourceStat.defensive_efficiency) {
      merged.defensive_efficiency = sourceStat.defensive_efficiency
      merged.defensive_efficiency_source = source
    }
    if (!merged.tempo && sourceStat.tempo) {
      merged.tempo = sourceStat.tempo
      merged.tempo_source = source
    }
    if (!merged.strength_of_schedule && sourceStat.strength_of_schedule) {
      merged.strength_of_schedule = sourceStat.strength_of_schedule
      merged.sos_source = source
    }

    // Rankings
    if (!merged.overall_rank && sourceStat.overall_rank) {
      merged.overall_rank = sourceStat.overall_rank
      merged.rank_source = source
    }
    if (!merged.offensive_efficiency_rank && sourceStat.offensive_efficiency_rank) {
      merged.offensive_efficiency_rank = sourceStat.offensive_efficiency_rank
    }
    if (!merged.defensive_efficiency_rank && sourceStat.defensive_efficiency_rank) {
      merged.defensive_efficiency_rank = sourceStat.defensive_efficiency_rank
    }

    // Record
    if (!merged.wins && sourceStat.wins) {
      merged.wins = sourceStat.wins
      merged.losses = sourceStat.losses
      merged.games_played = sourceStat.games_played
    }

    // Traditional stats (prefer ESPN)
    if (!merged.points_per_game && sourceStat.points_per_game) {
      merged.points_per_game = sourceStat.points_per_game
      merged.points_allowed_per_game = sourceStat.points_allowed_per_game
      merged.field_goal_pct = sourceStat.field_goal_pct
      merged.three_point_pct = sourceStat.three_point_pct
      merged.free_throw_pct = sourceStat.free_throw_pct
      merged.rebounds_per_game = sourceStat.rebounds_per_game
      merged.assists_per_game = sourceStat.assists_per_game
      merged.turnovers_per_game = sourceStat.turnovers_per_game
      merged.traditional_stats_source = source
    }
  }

  return merged
}
