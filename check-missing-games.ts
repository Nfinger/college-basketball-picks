import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'

async function checkMissingGames() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const targetDate = new Date()
  const dateStr = format(targetDate, 'yyyy-MM-dd')

  console.log(`\n🔍 Checking games for ${dateStr}\n`)

  // Current broken query (from _index.tsx)
  const { data: gamesWithBrokenQuery, count: brokenCount } = await supabase
    .from('games')
    .select('id, game_date, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)', { count: 'exact' })
    .gte('game_date', `${dateStr}T00:00:00`)
    .lt('game_date', `${dateStr}T23:59:59`)

  console.log(`❌ Broken query (using .lt): ${brokenCount} games`)

  // Fixed query (using .lte)
  const { data: gamesWithFixedQuery, count: fixedCount } = await supabase
    .from('games')
    .select('id, game_date, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)', { count: 'exact' })
    .gte('game_date', `${dateStr}T00:00:00`)
    .lte('game_date', `${dateStr}T23:59:59.999`)

  console.log(`✅ Fixed query (using .lte): ${fixedCount} games\n`)

  // Show the difference
  if (brokenCount !== fixedCount) {
    console.log(`\n⚠️ MISSING ${(fixedCount || 0) - (brokenCount || 0)} GAMES with broken query!\n`)

    // Show games that are missed
    const brokenIds = new Set((gamesWithBrokenQuery || []).map((g: any) => g.id))
    const missingGames = (gamesWithFixedQuery || []).filter((g: any) => !brokenIds.has(g.id))

    console.log('Missing games:')
    missingGames.forEach((game: any) => {
      console.log(`  - ${game.away_team.name} @ ${game.home_team.name}`)
      console.log(`    Game date: ${game.game_date}\n`)
    })
  } else {
    console.log('✅ No games missing!')
  }
}

checkMissingGames().catch(console.error)
