import { createClient } from '@supabase/supabase-js'
import { addWeeks, format } from 'date-fns'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function seedFantasySeason() {
  console.log('Creating fantasy season...')

  // Create a season
  const seasonStartDate = new Date('2025-01-06') // Start of conference play
  const seasonEndDate = new Date('2025-03-09') // End of regular season

  // Check if season exists
  let { data: season } = await supabase
    .from('fantasy_seasons')
    .select()
    .eq('name', '2024-25 Conference Season')
    .single()

  if (!season) {
    const { data: newSeason, error: seasonError } = await supabase
      .from('fantasy_seasons')
      .insert({
        name: '2024-25 Conference Season',
        start_date: format(seasonStartDate, 'yyyy-MM-dd'),
        end_date: format(seasonEndDate, 'yyyy-MM-dd'),
        is_active: true
      })
      .select()
      .single()

    if (seasonError) {
      console.error('Error creating season:', seasonError)
      return
    }

    season = newSeason
  }

  console.log('Season ready:', season)

  // Create 10 weeks
  console.log('Creating weeks...')
  const weeks = []
  let currentWeekStart = seasonStartDate

  for (let i = 1; i <= 10; i++) {
    const weekEnd = addWeeks(currentWeekStart, 1)
    weekEnd.setDate(weekEnd.getDate() - 1) // End on Sunday

    weeks.push({
      season_id: season.id,
      week_number: i,
      start_date: format(currentWeekStart, 'yyyy-MM-dd'),
      end_date: format(weekEnd, 'yyyy-MM-dd'),
      is_locked: false
    })

    currentWeekStart = addWeeks(currentWeekStart, 1)
  }

  const { data: createdWeeks, error: weeksError } = await supabase
    .from('fantasy_weeks')
    .upsert(weeks, {
      onConflict: 'season_id,week_number'
    })
    .select()

  if (weeksError) {
    console.error('Error creating weeks:', weeksError)
    return
  }

  console.log(`Created ${createdWeeks.length} weeks`)

  console.log('\n✅ Fantasy season seeded successfully!')
  console.log(`Season: ${season.name}`)
  console.log(`Weeks: ${createdWeeks.length}`)
}

seedFantasySeason().catch(console.error)
