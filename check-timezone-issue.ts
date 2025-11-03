import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'

async function checkTimezoneIssue() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const targetDate = new Date()
  const dateStr = format(targetDate, 'yyyy-MM-dd')

  console.log(`\n🔍 Checking timezone handling for ${dateStr}\n`)
  console.log(`Current local time: ${targetDate.toLocaleString()}`)
  console.log(`Current UTC time: ${targetDate.toISOString()}\n`)

  // Get all games for today using current method
  const { data: todayGames, count: todayCount } = await supabase
    .from('games')
    .select('id, game_date, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)', { count: 'exact' })
    .gte('game_date', `${dateStr}T00:00:00`)
    .lte('game_date', `${dateStr}T23:59:59.999`)

  console.log(`❌ Current method (naive date filter): ${todayCount} games\n`)

  // Get all games, no date filter
  const { data: allGames } = await supabase
    .from('games')
    .select('id, game_date, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
    .order('game_date', { ascending: true })

  // Group by local date (converting UTC to local)
  const gamesByLocalDate: Record<string, any[]> = {}

  allGames?.forEach(game => {
    const gameDate = new Date(game.game_date)
    const localDateStr = format(gameDate, 'yyyy-MM-dd')

    if (!gamesByLocalDate[localDateStr]) {
      gamesByLocalDate[localDateStr] = []
    }
    gamesByLocalDate[localDateStr].push(game)
  })

  console.log(`📊 Games by LOCAL date (converting UTC to local):\n`)
  Object.entries(gamesByLocalDate).forEach(([date, games]) => {
    console.log(`${date}: ${games.length} games`)
    if (date === dateStr && games.length <= 5) {
      games.forEach(g => {
        console.log(`  - ${g.away_team.name} @ ${g.home_team.name}`)
        console.log(`    Stored as (UTC): ${g.game_date}`)
        console.log(`    Local time: ${new Date(g.game_date).toLocaleString('en-US', { timeZone: 'America/New_York' })}`)
      })
    }
  })

  console.log(`\n✅ Correct count for ${dateStr}: ${gamesByLocalDate[dateStr]?.length || 0} games`)
}

checkTimezoneIssue().catch(console.error)
