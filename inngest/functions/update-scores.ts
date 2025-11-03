import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'

export const updateScores = inngest.createFunction(
  {
    id: 'update-game-scores',
    name: 'Update Game Scores and Pick Results',
  },
  // Optimized for 500 API calls/month limit:
  // - Every 30 minutes (not 5) = 2 calls/hour
  // - 5pm-6am UTC = 12pm-1am EST (covers afternoon/evening games)
  // - Nov-Mar only (basketball season)
  // - Smart query below ensures API only called when games are active
  // Estimated: ~300 calls/month during season
  { cron: '*/30 17-23,0-5 * 11,12,1-3 *' }
  async ({ step }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Step 1: Get in-progress and scheduled games from today
    // SMART GATEKEEPER: Only fetch games that are:
    // - Already in_progress, OR
    // - Scheduled to start in next 30 minutes
    // This prevents API calls when no games are actively happening
    const games = await step.run('fetch-active-games', async () => {
      const now = new Date()
      // Window: 6 hours ago to 30 minutes from now
      // Catches in-progress games and imminent starts; ignores stale games
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
      const thirtyMinutesFromNow = new Date(
        now.getTime() + 30 * 60 * 1000
      ).toISOString()

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .filter('game_date', 'gte', sixHoursAgo)
        .or(
          'status.eq.in_progress,' +
            `and(status.eq.scheduled,game_date.lte.${thirtyMinutesFromNow})`
        )

      if (error) {
        throw new Error(`Failed to fetch games: ${error.message}`)
      }

      return data || []
    })

    if (games.length === 0) {
      return { message: 'No active games to update' }
    }

    // Step 2: Fetch scores from API (The Odds API or ESPN)
    const scores = await step.run('fetch-scores', async () => {
      const apiKey = process.env.ODDS_API_KEY
      if (!apiKey) {
        throw new Error('ODDS_API_KEY not configured')
      }

      // The Odds API provides scores endpoint
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores?apiKey=${apiKey}&daysFrom=1`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Odds API error: ${response.statusText}`)
      }

      return await response.json()
    })

    // Step 3: Update game scores and status
    const updateResults = await step.run('update-game-scores', async () => {
      let gamesUpdated = 0
      let errors: string[] = []

      for (const game of games) {
        try {
          const scoreData = scores.find((s: any) => s.id === game.external_id)

          if (!scoreData) {
            continue
          }

          // Determine status
          let status: 'scheduled' | 'in_progress' | 'completed' = 'scheduled'
          if (scoreData.completed) {
            status = 'completed'
          } else if (new Date(scoreData.commence_time) < new Date()) {
            status = 'in_progress'
          }

          // Extract scores
          const homeScore = scoreData.scores?.find(
            (s: any) => s.name === scoreData.home_team
          )?.score
          const awayScore = scoreData.scores?.find(
            (s: any) => s.name === scoreData.away_team
          )?.score

          // Update game
          const { error } = await supabase
            .from('games')
            .update({
              home_score: homeScore ? parseInt(homeScore) : null,
              away_score: awayScore ? parseInt(awayScore) : null,
              status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', game.id)

          if (error) {
            errors.push(`Failed to update game ${game.id}: ${error.message}`)
          } else {
            gamesUpdated++
          }
        } catch (error: any) {
          errors.push(`Error processing game ${game.id}: ${error.message}`)
        }
      }

      return { gamesUpdated, errors }
    })

    // Step 4: Update pick results for completed games
    const pickResults = await step.run('update-pick-results', async () => {
      const { error } = await supabase.rpc('update_pick_results')

      if (error) {
        throw new Error(`Failed to update pick results: ${error.message}`)
      }

      return { success: true }
    })

    return {
      totalGames: games.length,
      ...updateResults,
      pickResultsUpdated: pickResults.success,
    }
  }
)
