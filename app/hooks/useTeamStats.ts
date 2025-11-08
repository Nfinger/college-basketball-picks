import { useState, useEffect } from 'react'

interface UseTeamStatsOptions {
  season?: number
  source?: 'kenpom' | 'barttorvik' | 'espn' | 'all'
  enabled?: boolean
}

interface UseTeamStatsResult {
  stats: any | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * React hook to fetch team statistics from the API
 *
 * @param teamId - The team's UUID
 * @param options - Query options (season, source, enabled)
 * @returns Object with stats, loading, error, and refetch function
 *
 * @example
 * ```tsx
 * const { stats, loading, error } = useTeamStats(teamId, {
 *   season: 2025,
 *   source: 'all'
 * })
 * ```
 */
export function useTeamStats(
  teamId: string | null | undefined,
  options: UseTeamStatsOptions = {}
): UseTeamStatsResult {
  const { season, source = 'all', enabled = true } = options

  const [stats, setStats] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refetch = () => setRefreshKey(prev => prev + 1)

  useEffect(() => {
    // Skip if teamId is not provided or hook is disabled
    if (!teamId || !enabled) {
      setStats(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    // Build query params
    const params = new URLSearchParams()
    if (season) params.append('season', season.toString())
    if (source) params.append('source', source)

    const queryString = params.toString()
    const url = `/api/stats/${teamId}${queryString ? `?${queryString}` : ''}`

    fetch(url)
      .then(async response => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        if (!cancelled) {
          // Extract stats from response
          const statsData = data.stats || data
          setStats(statsData)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Error fetching team stats:', err)
          setError(err.message || 'Failed to fetch team stats')
          setStats(null)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [teamId, season, source, enabled, refreshKey])

  return {
    stats,
    loading,
    error,
    refetch
  }
}

/**
 * Hook to fetch stats for multiple teams at once
 * Useful for game comparisons
 */
export function useMultipleTeamStats(
  teamIds: (string | null | undefined)[],
  options: UseTeamStatsOptions = {}
): Record<string, UseTeamStatsResult> {
  const results: Record<string, UseTeamStatsResult> = {}

  teamIds.forEach(teamId => {
    // We can't use hooks conditionally, so we'll pass enabled: false for null IDs
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const result = useTeamStats(teamId, {
      ...options,
      enabled: options.enabled !== false && !!teamId
    })

    if (teamId) {
      results[teamId] = result
    }
  })

  return results
}

/**
 * Get current college basketball season
 * Season runs Nov-Apr, so use year of spring semester
 */
export function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()

  // If it's Aug-Dec, we're in fall of next season
  // If it's Jan-Jul, we're in spring of current season
  return month >= 8 ? year + 1 : year
}
