import { createClient } from '@supabase/supabase-js'

async function testInjuryFeature() {
  console.log('\n🏥 Testing Injury Reports Feature\n')

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Test 1: Check if injury_reports table exists
  console.log('1️⃣ Checking if injury_reports table exists...')
  const { data: tables, error: tableError } = await supabase
    .from('injury_reports')
    .select('id')
    .limit(1)

  if (tableError) {
    console.log('   ❌ Table does not exist or migration not applied')
    console.log(`   Error: ${tableError.message}`)
    console.log('\n   ⚠️  Please apply the migration first:')
    console.log('   - Run: supabase db push')
    console.log('   - OR copy supabase/migrations/20251104000001_create_injury_reports.sql')
    console.log('     to your Supabase SQL Editor and run it\n')
    return
  }

  console.log('   ✅ Table exists!\n')

  // Test 2: Check current injury count
  console.log('2️⃣ Checking current injury reports...')
  const { data: injuries, count } = await supabase
    .from('injury_reports')
    .select('*', { count: 'exact' })
    .eq('is_active', true)

  console.log(`   Found ${count || 0} active injury reports`)

  if (injuries && injuries.length > 0) {
    console.log('\n   Sample injuries:')
    injuries.slice(0, 3).forEach((injury: any) => {
      console.log(`   - ${injury.player_name} (${injury.status})`)
    })
  } else {
    console.log('   ℹ️  No injury data yet - scraper needs to run')
  }

  // Test 3: Test a simple insert/delete to verify permissions
  console.log('\n3️⃣ Testing database permissions...')
  const { data: testInsert, error: insertError } = await supabase
    .from('injury_reports')
    .insert({
      team_id: '00000000-0000-0000-0000-000000000000', // This will fail due to FK constraint, but that's ok
      player_name: 'Test Player',
      status: 'questionable',
      injury_type: 'Test',
      description: 'Test injury',
      is_active: true,
    })
    .select()

  if (insertError) {
    if (insertError.message.includes('violates foreign key')) {
      console.log('   ✅ Permissions work (FK constraint is expected)')
    } else {
      console.log(`   ⚠️  Unexpected error: ${insertError.message}`)
    }
  } else {
    console.log('   ✅ Can write to table')
    // Clean up test data
    if (testInsert && testInsert.length > 0) {
      await supabase.from('injury_reports').delete().eq('id', testInsert[0].id)
    }
  }

  // Test 4: Test the scraper function (fetch ESPN page)
  console.log('\n4️⃣ Testing ESPN injury page fetch...')
  try {
    const response = await fetch('https://www.espn.com/mens-college-basketball/injuries', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (response.ok) {
      console.log('   ✅ ESPN page accessible')
      console.log(`   Status: ${response.status}`)
      const html = await response.text()
      console.log(`   Page size: ${(html.length / 1024).toFixed(2)} KB`)
    } else {
      console.log(`   ⚠️  ESPN returned status: ${response.status}`)
    }
  } catch (error) {
    console.log(`   ❌ Failed to fetch ESPN: ${error}`)
  }

  // Test 5: Check teams in database
  console.log('\n5️⃣ Checking teams in database...')
  const { data: teams, count: teamCount } = await supabase
    .from('teams')
    .select('id, name, short_name', { count: 'exact' })
    .limit(5)

  console.log(`   Found ${teamCount || 0} teams in database`)
  if (teams && teams.length > 0) {
    console.log('   Sample teams:')
    teams.forEach((team: any) => {
      console.log(`   - ${team.name} (${team.short_name})`)
    })
  }

  console.log('\n✅ All tests complete!')
  console.log('\n📋 Next steps:')
  console.log('   1. Start your dev server: npm run dev')
  console.log('   2. Navigate to /injuries page')
  console.log('   3. Trigger the scraper via Inngest Dashboard')
  console.log('   4. Or wait for the cron to run (every 6 hours)\n')
}

testInjuryFeature().catch(console.error)
