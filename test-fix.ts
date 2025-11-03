import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'

async function testFix() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const targetDate = new Date()
  const dateStr = format(targetDate, 'yyyy-MM-dd')

  // OLD METHOD (broken)
  const { count: oldCount } = await supabase
    .from('games')
    .select('id', { count: 'exact' })
    .gte('game_date', `${dateStr}T00:00:00`)
    .lt('game_date', `${dateStr}T23:59:59`)

  // NEW METHOD (fixed)
  const startOfDay = new Date(targetDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(targetDate)
  endOfDay.setHours(23, 59, 59, 999)

  const { count: newCount } = await supabase
    .from('games')
    .select('id', { count: 'exact' })
    .gte('game_date', startOfDay.toISOString())
    .lte('game_date', endOfDay.toISOString())

  console.log(`\n📊 Results for ${dateStr}:\n`)
  console.log(`❌ OLD METHOD: ${oldCount} games`)
  console.log(`✅ NEW METHOD: ${newCount} games`)
  console.log(`\n🎯 Fixed! Now showing ${(newCount || 0) - (oldCount || 0)} additional games!\n`)
}

testFix().catch(console.error)
