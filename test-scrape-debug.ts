import { createClient } from '@supabase/supabase-js'
import { normalizeTeamName } from './inngest/functions/team-mapping'

async function testScrape() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch games from The Odds API
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

  const games = await response.json()

  console.log(`\n🏀 Found ${games.length} games from API\n`)

  // Check each game
  for (const game of games) {
    const homeTeam = game.home_team
    const awayTeam = game.away_team
    const normalizedHome = normalizeTeamName(homeTeam)
    const normalizedAway = normalizeTeamName(awayTeam)

    console.log(`\n📋 Game: ${awayTeam} @ ${homeTeam}`)
    console.log(`   Normalized: ${normalizedAway} @ ${normalizedHome}`)

    // Check if teams exist
    const { data: homeTeamData, error: homeError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('name', normalizedHome)
      .single()

    const { data: awayTeamData, error: awayError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('name', normalizedAway)
      .single()

    if (homeError) {
      console.log(`   ❌ Home team "${normalizedHome}" NOT FOUND`)
    } else {
      console.log(`   ✓ Home team exists: ${homeTeamData.name}`)
    }

    if (awayError) {
      console.log(`   ❌ Away team "${normalizedAway}" NOT FOUND`)
    } else {
      console.log(`   ✓ Away team exists: ${awayTeamData.name}`)
    }

    // Check if game exists
    const { data: existingGame } = await supabase
      .from('games')
      .select('id')
      .eq('external_id', game.id)
      .single()

    if (existingGame) {
      console.log(`   ✓ Game already in database`)
    } else {
      console.log(`   ❌ Game NOT in database`)
    }
  }
}

testScrape().catch(console.error)
