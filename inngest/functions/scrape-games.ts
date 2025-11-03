import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'
import { normalizeTeamName } from './team-mapping'

// Helper function to get or create the Independent conference
async function getIndependentConference(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('conferences')
    .select('id')
    .eq('short_name', 'IND')
    .single()

  if (error || !data) {
    throw new Error('Independent conference not found. Please run seed data.')
  }

  return data
}

// Helper function to generate a short name from a full name
function generateShortName(fullName: string): string {
  // Split by spaces and handle common patterns
  const words = fullName.split(' ')

  // If it's already short (e.g., "UAB", "UConn"), use it as is
  if (fullName.length <= 5 && fullName === fullName.toUpperCase()) {
    return fullName
  }

  // For multi-word names, create an acronym
  if (words.length >= 2) {
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 5)
  }

  // For single words, truncate to 5 chars
  return fullName.slice(0, 5).toUpperCase()
}

// Helper function to find or create a team
async function findOrCreateTeam(
  supabase: ReturnType<typeof createClient>,
  apiTeamName: string,
  normalizedTeamName: string,
  independentConferenceId: string
): Promise<{ id: string; name: string; created: boolean }> {
  // First try to find the team
  const { data: existingTeam } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', normalizedTeamName)
    .single()

  if (existingTeam) {
    return { ...existingTeam, created: false }
  }

  // Team doesn't exist, create it
  const shortName = generateShortName(normalizedTeamName)

  const { data: newTeam, error } = await supabase
    .from('teams')
    .insert({
      name: normalizedTeamName,
      short_name: shortName,
      conference_id: independentConferenceId,
      external_id: apiTeamName, // Store original API name for reference
    })
    .select('id, name')
    .single()

  if (error) {
    // Handle race condition - another process might have just created it
    if (error.code === '23505') { // Unique constraint violation
      const { data: racedTeam } = await supabase
        .from('teams')
        .select('id, name')
        .eq('name', normalizedTeamName)
        .single()

      if (racedTeam) {
        return { ...racedTeam, created: false }
      }
    }
    throw new Error(`Failed to create team: ${error.message}`)
  }

  return { ...newTeam!, created: true }
}

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
      const teamsCreated: string[] = []

      // Get the Independent conference once for all auto-created teams
      const independentConf = await getIndependentConference(supabase)

      for (const game of games) {
        try {
          // Extract game data
          const homeTeam = game.home_team
          const awayTeam = game.away_team
          const gameDate = new Date(game.commence_time)

          // Normalize team names from API format to database format
          const normalizedHomeTeam = normalizeTeamName(homeTeam)
          const normalizedAwayTeam = normalizeTeamName(awayTeam)

          // Find or create teams in database
          const homeTeamData = await findOrCreateTeam(
            supabase,
            homeTeam,
            normalizedHomeTeam,
            independentConf.id
          )

          const awayTeamData = await findOrCreateTeam(
            supabase,
            awayTeam,
            normalizedAwayTeam,
            independentConf.id
          )

          // Log if teams were created
          if (homeTeamData.created) {
            teamsCreated.push(
              `Created home team: "${normalizedHomeTeam}" from API: "${homeTeam}"`
            )
          }
          if (awayTeamData.created) {
            teamsCreated.push(
              `Created away team: "${normalizedAwayTeam}" from API: "${awayTeam}"`
            )
          }

          // Extract spread from bookmakers          
          const spread = game.bookmakers?.[0]?.markets?.find(
            (m: { key: string }) => m.key === 'spreads'
          )?.outcomes?.find((o: { point: number }) => o.point < 0)?.point


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
        teamsCreated,
        errors,
      }
    })

    return result
  }
)
