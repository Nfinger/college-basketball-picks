import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'
import { normalizeTeamName } from './team-mapping'

export const scrapeGames = inngest.createFunction(
  {
    id: 'scrape-daily-games',
    name: 'Scrape Daily College Basketball Games',
  },
  { cron: '0 6 * * *' }, // Daily at 6 AM
  async ({ step }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Step 1: Fetch games from The Odds API
    const games = await step.run('fetch-games-from-api', async () => {
      const apiKey = process.env.ODDS_API_KEY
      if (!apiKey) {
        throw new Error('ODDS_API_KEY not configured')
      }

      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds?apiKey=${apiKey}&regions=us&markets=spreads&oddsFormat=american`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Odds API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    })

    // Step 2: Process and upsert games to database
    const result = await step.run('upsert-games', async () => {
      let gamesProcessed = 0
      const errors: string[] = []

      for (const game of games) {
        try {
          // Extract game data
          const homeTeam = game.home_team
          const awayTeam = game.away_team
          const gameDate = new Date(game.commence_time)

          // Normalize team names from API format to database format
          const normalizedHomeTeam = normalizeTeamName(homeTeam)
          const normalizedAwayTeam = normalizeTeamName(awayTeam)

          // Find teams in database
          const { data: homeTeamData, error: homeError } = await supabase
            .from('teams')
            .select('id')
            .eq('name', normalizedHomeTeam)
            .single()

          const { data: awayTeamData, error: awayError } = await supabase
            .from('teams')
            .select('id')
            .eq('name', normalizedAwayTeam)
            .single()

          if (!homeTeamData || !awayTeamData) {
            errors.push(
              `Teams not found - API: "${homeTeam}" vs "${awayTeam}" | Normalized: "${normalizedHomeTeam}" vs "${normalizedAwayTeam}"`
            )
            continue
          }

          // Extract spread from bookmakers
          const spread = game.bookmakers?.[0]?.markets?.find(
            (m: { key: string }) => m.key === 'spreads'
          )?.outcomes?.[0]?.point

          // Determine favorite team (negative spread)
          let favoriteTeamId = null
          if (spread && spread < 0) {
            favoriteTeamId = homeTeamData.id
          } else if (spread && spread > 0) {
            favoriteTeamId = awayTeamData.id
          }

          // Get conference ID (assume both teams in same conference for now)
          const { data: homeTeamFull } = await supabase
            .from('teams')
            .select('conference_id')
            .eq('id', homeTeamData.id)
            .single()

          // Upsert game
          const { error } = await supabase.from('games').upsert(
            {
              external_id: game.id,
              game_date: gameDate.toISOString(),
              home_team_id: homeTeamData.id,
              away_team_id: awayTeamData.id,
              spread: spread ? Math.abs(spread) : null,
              favorite_team_id: favoriteTeamId,
              status: 'scheduled',
              conference_id: homeTeamFull?.conference_id,
              scraped_at: new Date().toISOString(),
            },
            {
              onConflict: 'external_id',
            }
          )

          if (error) {
            errors.push(`Failed to upsert game: ${error.message}`)
          } else {
            gamesProcessed++
          }
        } catch (error) {
          errors.push(`Error processing game: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      return {
        totalGames: games.length,
        gamesProcessed,
        errors,
      }
    })

    return result
  }
)
