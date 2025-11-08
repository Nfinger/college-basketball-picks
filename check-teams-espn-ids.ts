import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkTeams() {
  console.log('Checking teams with ESPN IDs...\n')

  // Get teams with ESPN IDs (stored in external_ids JSONB column)
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, external_ids')
    .not('external_ids->espn', 'is', null)
    .limit(10)

  if (error) {
    console.error('Error fetching teams:', error)
    return
  }

  // Get count
  const { count } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .not('external_ids->espn', 'is', null)

  console.log(`✅ Found teams with ESPN IDs\n`)

  console.log('Sample teams:')
  data?.forEach((team: any) => {
    console.log(`  - ${team.name}: ESPN ID ${team.external_ids.espn}`)
  })

  console.log(`\n📊 Query returned ${data?.length} sample teams (limited to 10)`)
  console.log(`📊 Total count: ${count} teams with ESPN IDs`)
}

checkTeams().catch(console.error)
