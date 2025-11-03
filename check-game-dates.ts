import { createClient } from '@supabase/supabase-js'

async function checkGameDates() {
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

  // Group games by date
  const gamesByDate: Record<string, any[]> = {}

  for (const game of games) {
    const gameDate = new Date(game.commence_time)
    const dateStr = gameDate.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: '2-digit',
      day: '2-digit'
    })

    if (!gamesByDate[dateStr]) {
      gamesByDate[dateStr] = []
    }
    gamesByDate[dateStr].push({
      away: game.away_team,
      home: game.home_team,
      time: gameDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })
    })
  }

  // Show games by date
  console.log('📅 Games by Date:\n')
  for (const [date, games] of Object.entries(gamesByDate).sort()) {
    console.log(`${date} (${games.length} games):`)
    for (const game of games) {
      console.log(`  ${game.time}: ${game.away} @ ${game.home}`)
    }
    console.log('')
  }

  // Check today's date
  const today = new Date()
  console.log(`\n⏰ Current time (ET): ${today.toLocaleString('en-US', { timeZone: 'America/New_York' })}`)

  // Check what's in the database for today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const { data: dbGames, count } = await supabase
    .from('games')
    .select('id, game_date, home_team_id, away_team_id', { count: 'exact' })
    .gte('game_date', todayStart.toISOString())
    .lte('game_date', todayEnd.toISOString())

  console.log(`\n📊 Games in DB for today: ${count}`)

  // Check tomorrow too
  const tomorrowStart = new Date()
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  tomorrowStart.setHours(0, 0, 0, 0)
  const tomorrowEnd = new Date()
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)
  tomorrowEnd.setHours(23, 59, 59, 999)

  const { count: tomorrowCount } = await supabase
    .from('games')
    .select('id', { count: 'exact' })
    .gte('game_date', tomorrowStart.toISOString())
    .lte('game_date', tomorrowEnd.toISOString())

  console.log(`📊 Games in DB for tomorrow: ${tomorrowCount}`)
}

checkGameDates().catch(console.error)
