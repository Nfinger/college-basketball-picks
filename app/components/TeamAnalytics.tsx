import { formatDistanceToNow } from 'date-fns'

interface TeamStat {
  label: string
  value: string | number
  rank?: number
  source?: string
  description?: string
}

interface TeamAnalyticsProps {
  teamId: string
  teamName: string
  stats?: any
  loading?: boolean
  error?: string
  compact?: boolean
}

/**
 * TeamAnalytics Component
 * Displays comprehensive team statistics from multiple sources
 * Optimized for pick-making decisions
 */
export function TeamAnalytics({
  teamId,
  teamName,
  stats,
  loading,
  error,
  compact = false
}: TeamAnalyticsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
        <p className="text-sm text-red-600">Failed to load analytics</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">No analytics available</p>
        <p className="text-xs text-gray-500 mt-1">Stats will be available after scrapers run</p>
      </div>
    )
  }

  const metrics: TeamStat[] = []

  // Add record
  if (stats.wins !== undefined && stats.losses !== undefined) {
    const winPct = (stats.wins / (stats.wins + stats.losses) * 100).toFixed(1)
    metrics.push({
      label: 'Record',
      value: `${stats.wins}-${stats.losses}`,
      description: `${winPct}% win rate • ${stats.games_played || stats.wins + stats.losses} games`
    })
  }

  // Add efficiency metrics (tempo-free analytics)
  if (stats.offensive_efficiency) {
    metrics.push({
      label: 'Offensive Efficiency',
      value: stats.offensive_efficiency.toFixed(1),
      rank: stats.offensive_efficiency_rank,
      source: stats.offensive_efficiency_source,
      description: 'Points per 100 possessions (higher is better)'
    })
  }

  if (stats.defensive_efficiency) {
    metrics.push({
      label: 'Defensive Efficiency',
      value: stats.defensive_efficiency.toFixed(1),
      rank: stats.defensive_efficiency_rank,
      source: stats.defensive_efficiency_source,
      description: 'Points allowed per 100 possessions (lower is better)'
    })
  }

  if (stats.tempo) {
    metrics.push({
      label: 'Tempo',
      value: stats.tempo.toFixed(1),
      source: stats.tempo_source,
      description: 'Possessions per 40 minutes'
    })
  }

  // Net efficiency (offensive - defensive)
  if (stats.offensive_efficiency && stats.defensive_efficiency) {
    const netEff = (stats.offensive_efficiency - stats.defensive_efficiency).toFixed(1)
    const sign = Number(netEff) > 0 ? '+' : ''
    metrics.push({
      label: 'Net Efficiency',
      value: `${sign}${netEff}`,
      description: 'Point differential per 100 possessions'
    })
  }

  if (stats.strength_of_schedule && stats.strength_of_schedule !== 0) {
    metrics.push({
      label: 'Strength of Schedule',
      value: stats.strength_of_schedule.toFixed(2),
      rank: stats.strength_of_schedule_rank || undefined,
      source: stats.sos_source,
      description: 'Opponent quality rating'
    })
  }

  // Luck/WAB (Wins Above Bubble) from raw_stats
  if (stats.raw_stats?.luck) {
    const luckValue = (stats.raw_stats.luck * 100).toFixed(1)
    const sign = Number(luckValue) > 0 ? '+' : ''
    metrics.push({
      label: 'Luck Rating',
      value: `${sign}${luckValue}%`,
      source: 'barttorvik',
      description: 'Wins above/below expected based on game control'
    })
  }

  // Add traditional stats if available
  if (stats.points_per_game) {
    metrics.push({
      label: 'Points Per Game',
      value: stats.points_per_game.toFixed(1),
      source: stats.traditional_stats_source,
      description: 'Scoring average'
    })
  }

  if (stats.points_allowed_per_game) {
    metrics.push({
      label: 'Points Allowed',
      value: stats.points_allowed_per_game.toFixed(1),
      source: stats.traditional_stats_source,
      description: 'Defensive average'
    })
  }

  if (stats.field_goal_pct) {
    metrics.push({
      label: 'Field Goal %',
      value: `${(stats.field_goal_pct * 100).toFixed(1)}%`,
      source: stats.traditional_stats_source,
      description: 'Shooting efficiency'
    })
  }

  if (stats.three_point_pct) {
    metrics.push({
      label: 'Three Point %',
      value: `${(stats.three_point_pct * 100).toFixed(1)}%`,
      source: stats.traditional_stats_source,
      description: 'Outside shooting'
    })
  }

  if (stats.free_throw_pct) {
    metrics.push({
      label: 'Free Throw %',
      value: `${(stats.free_throw_pct * 100).toFixed(1)}%`,
      source: stats.traditional_stats_source,
      description: 'FT shooting'
    })
  }

  if (stats.rebounds_per_game) {
    metrics.push({
      label: 'Rebounds',
      value: stats.rebounds_per_game.toFixed(1),
      source: stats.traditional_stats_source,
      description: 'Per game'
    })
  }

  if (stats.assists_per_game) {
    metrics.push({
      label: 'Assists',
      value: stats.assists_per_game.toFixed(1),
      source: stats.traditional_stats_source,
      description: 'Per game'
    })
  }

  if (stats.turnovers_per_game) {
    metrics.push({
      label: 'Turnovers',
      value: stats.turnovers_per_game.toFixed(1),
      source: stats.traditional_stats_source,
      description: 'Per game'
    })
  }

  if (compact) {
    // Compact view - show only key metrics
    const keyMetrics = metrics.slice(0, 4)
    return (
      <div className="grid grid-cols-2 gap-2">
        {keyMetrics.map((metric, idx) => (
          <StatCardCompact key={idx} stat={metric} />
        ))}
      </div>
    )
  }

  // Full view
  return (
    <div className="space-y-4">
      {/* Header with overall rank */}
      {stats.overall_rank && (
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h3 className="text-lg font-semibold">{teamName}</h3>
            <p className="text-sm text-gray-600">
              Ranked #{stats.overall_rank}
              {stats.rank_source && (
                <span className="text-xs text-gray-500 ml-1">
                  ({stats.rank_source})
                </span>
              )}
            </p>
          </div>
          {stats.sources_used && stats.sources_used.length > 0 && (
            <DataSourceBadge sources={stats.sources_used} />
          )}
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {metrics.map((metric, idx) => (
          <StatCard key={idx} stat={metric} />
        ))}
      </div>

      {/* Data freshness */}
      {stats.lastUpdated && (
        <DataFreshness timestamp={stats.lastUpdated} />
      )}
    </div>
  )
}

function StatCard({ stat }: { stat: TeamStat }) {
  return (
    <div className="p-3 border rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-1">
        <span className="text-sm text-gray-600">{stat.label}</span>
        {stat.source && (
          <span className="text-xs text-gray-400 uppercase">{stat.source}</span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{stat.value}</span>
        {stat.rank && (
          <span className="text-sm text-gray-500">#{stat.rank}</span>
        )}
      </div>
      {stat.description && (
        <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
      )}
    </div>
  )
}

function StatCardCompact({ stat }: { stat: TeamStat }) {
  return (
    <div className="p-2 border rounded">
      <div className="text-xs text-gray-600 mb-1">{stat.label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold">{stat.value}</span>
        {stat.rank && (
          <span className="text-xs text-gray-500">#{stat.rank}</span>
        )}
      </div>
    </div>
  )
}

function DataSourceBadge({ sources }: { sources: string[] }) {
  const sourceColors: Record<string, string> = {
    kenpom: 'bg-purple-100 text-purple-700',
    barttorvik: 'bg-blue-100 text-blue-700',
    espn: 'bg-orange-100 text-orange-700'
  }

  return (
    <div className="flex gap-1">
      {sources.map(source => (
        <span
          key={source}
          className={`px-2 py-1 rounded text-xs font-medium ${
            sourceColors[source] || 'bg-gray-100 text-gray-700'
          }`}
          title={`Data from ${source}`}
        >
          {source}
        </span>
      ))}
    </div>
  )
}

function DataFreshness({ timestamp }: { timestamp: string }) {
  const date = new Date(timestamp)
  const isStale = Date.now() - date.getTime() > 24 * 60 * 60 * 1000 // 24 hours

  return (
    <div
      className={`text-xs text-center py-2 rounded ${
        isStale ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-600'
      }`}
    >
      {isStale && '⚠️ '}
      Last updated {formatDistanceToNow(date, { addSuffix: true })}
    </div>
  )
}
