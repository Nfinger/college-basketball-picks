import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Generate realistic basketball stats
function generateTeamStats(isHome: boolean, shouldWin: boolean) {
  // Base stats - teams typically score 65-85 points
  const basePoints = 65 + Math.floor(Math.random() * 20)
  const points = shouldWin ? basePoints + Math.floor(Math.random() * 15) : basePoints - Math.floor(Math.random() * 10)

  // Field goals (typically 40-50% shooting)
  const fgAttempts = 55 + Math.floor(Math.random() * 15)
  const fgPct = 0.40 + Math.random() * 0.10
  const fgMade = Math.floor(fgAttempts * fgPct)

  // Three pointers (typically 30-40%, 20-30 attempts)
  const threePtAttempts = 20 + Math.floor(Math.random() * 10)
  const threePtPct = 0.30 + Math.random() * 0.10
  const threePtMade = Math.floor(threePtAttempts * threePtPct)

  // Free throws (typically 70-80%)
  const ftAttempts = 15 + Math.floor(Math.random() * 10)
  const ftPct = 0.70 + Math.random() * 0.10
  const ftMade = Math.floor(ftAttempts * ftPct)

  // Other stats
  const rebounds = 30 + Math.floor(Math.random() * 15)
  const assists = 10 + Math.floor(Math.random() * 10)
  const steals = 5 + Math.floor(Math.random() * 8)
  const blocks = 2 + Math.floor(Math.random() * 5)
  const turnovers = 10 + Math.floor(Math.random() * 8)

  return {
    points,
    field_goals_made: fgMade,
    field_goals_attempted: fgAttempts,
    three_pointers_made: threePtMade,
    three_pointers_attempted: threePtAttempts,
    free_throws_made: ftMade,
    free_throws_attempted: ftAttempts,
    rebounds,
    assists,
    steals,
    blocks,
    turnovers,
    field_goal_percentage: fgPct,
    three_point_percentage: threePtPct,
    free_throw_percentage: ftPct
  }
}

async function populateTeamStats() {
  console.log('Fetching completed games...')

  // Get all completed games
  const { data: games, error } = await supabase
    .from('games')
    .select('id, home_team_id, away_team_id, home_score, away_score, status')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)

  if (error) {
    console.error('Error fetching games:', error)
    return
  }

  console.log(`Found ${games.length} completed games`)

  // Check how many already have stats
  const { count } = await supabase
    .from('team_game_stats')
    .select('*', { count: 'exact', head: true })

  console.log(`Existing team_game_stats records: ${count}`)

  let created = 0
  let skipped = 0

  for (const game of games) {
    // Check if stats already exist for this game
    const { data: existing } = await supabase
      .from('team_game_stats')
      .select('id')
      .eq('game_id', game.id)
      .limit(1)

    if (existing && existing.length > 0) {
      skipped++
      continue
    }

    const homeWon = game.home_score! > game.away_score!
    const homeStats = generateTeamStats(true, homeWon)
    const awayStats = generateTeamStats(false, !homeWon)

    // Insert stats for home team
    const { error: homeError } = await supabase
      .from('team_game_stats')
      .insert({
        game_id: game.id,
        team_id: game.home_team_id,
        is_home: true,
        ...homeStats
      })

    if (homeError) {
      console.error(`Error inserting home stats for game ${game.id}:`, homeError)
      continue
    }

    // Insert stats for away team
    const { error: awayError } = await supabase
      .from('team_game_stats')
      .insert({
        game_id: game.id,
        team_id: game.away_team_id,
        is_home: false,
        ...awayStats
      })

    if (awayError) {
      console.error(`Error inserting away stats for game ${game.id}:`, awayError)
      continue
    }

    created += 2
    if (created % 100 === 0) {
      console.log(`Created ${created} team_game_stats records...`)
    }
  }

  console.log(`\n✅ Finished!`)
  console.log(`Created: ${created} team_game_stats records`)
  console.log(`Skipped: ${skipped} games (already had stats)`)
}

populateTeamStats().catch(console.error)
