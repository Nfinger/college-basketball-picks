import { useTeamStats, getCurrentSeason } from '../hooks/useTeamStats'
import { TeamAnalytics } from './TeamAnalytics'

interface Game {
  id: string
  home_team_id: string
  away_team_id: string
  home_team?: {
    id: string
    name: string
    short_name: string
  }
  away_team?: {
    id: string
    name: string
    short_name: string
  }
}

interface GameAnalyticsProps {
  game: Game
  season?: number
  source?: 'kenpom' | 'barttorvik' | 'espn' | 'all'
  showComparison?: boolean
}

/**
 * GameAnalytics Component
 * Shows side-by-side team analytics for a game
 * Perfect for pick-making decisions
 */
export function GameAnalytics({
  game,
  season = getCurrentSeason(),
  source = 'all',
  showComparison = true
}: GameAnalyticsProps) {
  const homeStats = useTeamStats(game.home_team_id, { season, source })
  const awayStats = useTeamStats(game.away_team_id, { season, source })

  const homeTeamName = game.home_team?.name || 'Home Team'
  const awayTeamName = game.away_team?.name || 'Away Team'

  return (
    <div className="space-y-6">
      {/* Comparison Header */}
      {showComparison && (homeStats.stats || awayStats.stats) && (
        <TeamComparison
          homeStats={homeStats.stats}
          awayStats={awayStats.stats}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
        />
      )}

      {/* Side-by-side team analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Away Team */}
        <div className="border rounded-lg p-3 sm:p-4 lg:p-6">
          <div className="mb-4 pb-2 border-b">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{awayTeamName}</h3>
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">Away</span>
            </div>
          </div>
          <TeamAnalytics
            teamId={game.away_team_id}
            teamName={awayTeamName}
            stats={awayStats.stats}
            loading={awayStats.loading}
            error={awayStats.error || undefined}
          />
        </div>

        {/* Home Team */}
        <div className="border rounded-lg p-3 sm:p-4 lg:p-6">
          <div className="mb-4 pb-2 border-b">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{homeTeamName}</h3>
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">Home</span>
            </div>
          </div>
          <TeamAnalytics
            teamId={game.home_team_id}
            teamName={homeTeamName}
            stats={homeStats.stats}
            loading={homeStats.loading}
            error={homeStats.error || undefined}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * TeamComparison Component
 * Shows key metrics comparison with visual indicators
 */
function TeamComparison({
  homeStats,
  awayStats,
  homeTeamName,
  awayTeamName
}: {
  homeStats: any
  awayStats: any
  homeTeamName: string
  awayTeamName: string
}) {
  if (!homeStats || !awayStats) return null

  const comparisons = []

  // Overall Ranking (lower is better)
  if (homeStats.overall_rank && awayStats.overall_rank) {
    comparisons.push({
      metric: 'Overall Ranking',
      homeValue: homeStats.overall_rank,
      awayValue: awayStats.overall_rank,
      higherIsBetter: false,
      format: (v: number) => `#${Math.round(v)}`
    })
  }

  // Net Efficiency (offensive - defensive)
  if (homeStats.offensive_efficiency && awayStats.offensive_efficiency &&
      homeStats.defensive_efficiency && awayStats.defensive_efficiency) {
    const homeNet = homeStats.offensive_efficiency - homeStats.defensive_efficiency
    const awayNet = awayStats.offensive_efficiency - awayStats.defensive_efficiency
    comparisons.push({
      metric: 'Net Efficiency',
      homeValue: homeNet,
      awayValue: awayNet,
      higherIsBetter: true,
      format: (v: number) => {
        const sign = v > 0 ? '+' : ''
        return `${sign}${v.toFixed(1)}`
      }
    })
  }

  // Offensive Efficiency (higher is better)
  if (homeStats.offensive_efficiency && awayStats.offensive_efficiency) {
    comparisons.push({
      metric: 'Offensive Efficiency',
      homeValue: homeStats.offensive_efficiency,
      awayValue: awayStats.offensive_efficiency,
      higherIsBetter: true,
      format: (v: number) => v.toFixed(1)
    })
  }

  // Defensive Efficiency (lower is better)
  if (homeStats.defensive_efficiency && awayStats.defensive_efficiency) {
    comparisons.push({
      metric: 'Defensive Efficiency',
      homeValue: homeStats.defensive_efficiency,
      awayValue: awayStats.defensive_efficiency,
      higherIsBetter: false,
      format: (v: number) => v.toFixed(1)
    })
  }

  // Tempo
  if (homeStats.tempo && awayStats.tempo) {
    comparisons.push({
      metric: 'Tempo',
      homeValue: homeStats.tempo,
      awayValue: awayStats.tempo,
      higherIsBetter: null, // Neutral - just different styles
      format: (v: number) => v.toFixed(1)
    })
  }

  // Win %
  if (homeStats.wins !== undefined && awayStats.wins !== undefined) {
    const homeWinPct = homeStats.wins / (homeStats.wins + homeStats.losses)
    const awayWinPct = awayStats.wins / (awayStats.wins + awayStats.losses)

    comparisons.push({
      metric: 'Win Percentage',
      homeValue: homeWinPct,
      awayValue: awayWinPct,
      higherIsBetter: true,
      format: (v: number) => `${(v * 100).toFixed(1)}%`
    })
  }

  if (comparisons.length === 0) return null

  return (
    <div className="border rounded-lg p-3 sm:p-6 bg-gray-50">
      <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 text-gray-700">Key Matchup Metrics</h3>
      <div className="space-y-3 sm:space-y-4">
        {comparisons.map((comp, idx) => (
          <ComparisonRow
            key={idx}
            metric={comp.metric}
            homeValue={comp.homeValue}
            awayValue={comp.awayValue}
            homeLabel={homeTeamName}
            awayLabel={awayTeamName}
            higherIsBetter={comp.higherIsBetter}
            format={comp.format}
          />
        ))}
      </div>
    </div>
  )
}

function ComparisonRow({
  metric,
  homeValue,
  awayValue,
  homeLabel,
  awayLabel,
  higherIsBetter,
  format
}: {
  metric: string
  homeValue: number
  awayValue: number
  homeLabel: string
  awayLabel: string
  higherIsBetter: boolean | null
  format: (v: number) => string
}) {
  let homeAdvantage = false
  let awayAdvantage = false

  if (higherIsBetter === true) {
    homeAdvantage = homeValue > awayValue
    awayAdvantage = awayValue > homeValue
  } else if (higherIsBetter === false) {
    homeAdvantage = homeValue < awayValue
    awayAdvantage = awayValue < homeValue
  }

  // Calculate bar widths for visual comparison
  const maxValue = Math.max(homeValue, awayValue)
  const minValue = Math.min(homeValue, awayValue)
  const range = maxValue - minValue

  // Determine bar percentages (show relative strength)
  let homeBarWidth = 50
  let awayBarWidth = 50

  if (range > 0 && higherIsBetter !== null) {
    if (higherIsBetter) {
      homeBarWidth = (homeValue / maxValue) * 100
      awayBarWidth = (awayValue / maxValue) * 100
    } else {
      // For lower is better (defense), invert the calculation
      homeBarWidth = (1 - (homeValue / maxValue)) * 100 + 50
      awayBarWidth = (1 - (awayValue / maxValue)) * 100 + 50
    }
  }

  return (
    <div className="text-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1.5 gap-1">
        <span className="text-xs sm:text-sm font-medium text-gray-700">{metric}</span>
        {higherIsBetter !== null && (
          <span className="text-xs text-gray-500">
            {higherIsBetter ? '↑ Higher is better' : '↓ Lower is better'}
          </span>
        )}
      </div>

      {/* Visual comparison bars */}
      {higherIsBetter !== null && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="flex items-center gap-1">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  awayAdvantage ? 'bg-green-500' : 'bg-blue-400'
                }`}
                style={{ width: `${awayBarWidth}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  homeAdvantage ? 'bg-green-500' : 'bg-blue-400'
                }`}
                style={{ width: `${homeBarWidth}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 items-center text-xs sm:text-sm">
        {/* Away Team */}
        <div
          className={`text-right font-semibold ${
            awayAdvantage ? 'text-green-600' : 'text-gray-700'
          }`}
        >
          {format(awayValue)}
          {awayAdvantage && ' ✓'}
        </div>

        {/* VS divider */}
        <div className="text-center text-xs text-gray-400">vs</div>

        {/* Home Team */}
        <div
          className={`text-left font-semibold ${
            homeAdvantage ? 'text-green-600' : 'text-gray-700'
          }`}
        >
          {homeAdvantage && '✓ '}
          {format(homeValue)}
        </div>
      </div>
    </div>
  )
}

/**
 * Compact version for use in game cards
 */
export function GameAnalyticsCompact({ game }: { game: Game }) {
  const homeStats = useTeamStats(game.home_team_id, {
    season: getCurrentSeason(),
    source: 'all'
  })
  const awayStats = useTeamStats(game.away_team_id, {
    season: getCurrentSeason(),
    source: 'all'
  })

  // Show loading state
  if (homeStats.loading || awayStats.loading) {
    return (
      <div className="flex gap-4 text-xs text-gray-500">
        <div className="animate-pulse">Loading analytics...</div>
      </div>
    )
  }

  // Show key metrics if available
  if (!homeStats.stats || !awayStats.stats) return null

  return (
    <div className="grid grid-cols-2 gap-4 text-xs">
      {/* Home team key stats */}
      <div className="space-y-1">
        <div className="font-medium text-gray-700">
          {game.home_team?.short_name || 'Home'}
        </div>
        {homeStats.stats.overall_rank && (
          <div className="text-gray-600">Rank: #{homeStats.stats.overall_rank}</div>
        )}
        {homeStats.stats.offensive_efficiency && (
          <div className="text-gray-600">
            Off: {homeStats.stats.offensive_efficiency.toFixed(1)}
          </div>
        )}
      </div>

      {/* Away team key stats */}
      <div className="space-y-1">
        <div className="font-medium text-gray-700">
          {game.away_team?.short_name || 'Away'}
        </div>
        {awayStats.stats.overall_rank && (
          <div className="text-gray-600">Rank: #{awayStats.stats.overall_rank}</div>
        )}
        {awayStats.stats.offensive_efficiency && (
          <div className="text-gray-600">
            Off: {awayStats.stats.offensive_efficiency.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  )
}
