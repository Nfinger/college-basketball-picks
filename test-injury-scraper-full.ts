import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { normalizeTeamName } from './inngest/functions/team-mapping'

interface InjuryData {
  teamName: string
  playerName: string
  injuryType: string
  status: 'out' | 'questionable' | 'doubtful' | 'day-to-day' | 'probable'
  description: string
}

// Map ESPN status strings to our enum values
function mapInjuryStatus(status: string): 'out' | 'questionable' | 'doubtful' | 'day-to-day' | 'probable' {
  const normalizedStatus = status.toLowerCase().trim()

  if (normalizedStatus.includes('out')) return 'out'
  if (normalizedStatus.includes('questionable')) return 'questionable'
  if (normalizedStatus.includes('doubtful')) return 'doubtful'
  if (normalizedStatus.includes('probable')) return 'probable'
  if (normalizedStatus.includes('day-to-day') || normalizedStatus.includes('dtd')) return 'day-to-day'

  // Default to questionable if we can't determine
  return 'questionable'
}

/**
 * Full integration test that scrapes RotoWire and saves to database
 * This mimics the actual Inngest function but runs locally for testing
 */
async function testFullPipeline() {
  console.log('\n🏥 Testing Full Injury Scraper Pipeline\n')
  console.log('=' .repeat(60))

  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // STEP 1: Scrape RotoWire
  console.log('\n📥 STEP 1: Scraping RotoWire for injury data...\n')

  const browser = await chromium.launch({ headless: true })
  let injuries: InjuryData[] = []

  try {
    const page = await browser.newPage()

    await page.goto('https://www.rotowire.com/cbasketball/injury-report.php', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })

    // Wait for table
    const tableSelectors = [
      '.webix_dtable',
      '.webix_ss_body',
      '[view_id*="datatable"]',
      '.webix_view.webix_datatable'
    ]

    let tableFound = false
    for (const selector of tableSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 })
        tableFound = true
        console.log(`   ✅ Found table with selector: ${selector}`)
        break
      } catch (e) {
        continue
      }
    }

    if (!tableFound) {
      console.error('   ❌ Could not find Webix DataTable on page')
      await browser.close()
      return
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForSelector('.webix_cell', { timeout: 5000 }).catch(() => {})

    // Extract data from Webix
    const webixData = await page.evaluate(() => {
      // @ts-ignore
      if (typeof webix !== 'undefined' && typeof $$ === 'function') {
        // @ts-ignore
        const views = webix.ui.views
        for (const viewId in views) {
          const view = views[viewId]
          if (view && view.config && view.config.view === 'datatable') {
            try {
              const data: any[] = []
              view.eachRow((rowId: any) => {
                const item = view.getItem(rowId)
                if (item) {
                  data.push({
                    player: item.player || item.Player || '',
                    team: item.team || item.Team || '',
                    injury: item.injury || item.Injury || '',
                    status: item.status || item.Status || ''
                  })
                }
              })
              if (data.length > 0) {
                return { success: true, data }
              }
            } catch (e) {
              console.error('Error extracting from Webix instance:', e)
            }
          }
        }
      }
      return { success: false, data: [] }
    })

    if (webixData.success && webixData.data.length > 0) {
      console.log(`   ✅ Extracted ${webixData.data.length} injuries from Webix\n`)
      for (const item of webixData.data) {
        if (item.player && item.team && item.status) {
          if (item.player.toLowerCase().includes('player') ||
              item.team.toLowerCase().includes('team')) {
            continue
          }

          injuries.push({
            teamName: item.team.trim(),
            playerName: item.player.trim(),
            injuryType: item.injury?.trim() || 'Unknown',
            status: mapInjuryStatus(item.status),
            description: item.injury?.trim() || ''
          })
        }
      }
    }

    console.log(`   📊 Successfully parsed ${injuries.length} valid injuries`)
  } finally {
    await browser.close()
  }

  // STEP 2: Load teams from database
  console.log('\n💾 STEP 2: Loading teams from database...\n')

  const { data: teamsData, error: teamsError } = await supabase
    .from('teams')
    .select('id, name')

  if (teamsError) {
    console.error('   ❌ Error fetching teams:', teamsError)
    return
  }

  const teamsMap: Record<string, string> = {}
  teamsData.forEach((team: { id: string; name: string }) => {
    teamsMap[team.name] = team.id
  })

  console.log(`   ✅ Loaded ${Object.keys(teamsMap).length} teams into memory`)

  // STEP 3: Prepare injury records for upsert
  console.log('\n🔄 STEP 3: Mapping injuries to database records...\n')

  const teamsNotFound = new Set<string>()
  const injuryUpserts: any[] = []

  for (const injury of injuries) {
    const normalizedTeamName = normalizeTeamName(injury.teamName)
    const teamId = teamsMap[normalizedTeamName]

    if (!teamId) {
      teamsNotFound.add(injury.teamName)
      continue
    }

    injuryUpserts.push({
      team_id: teamId,
      player_name: injury.playerName,
      injury_type: injury.injuryType,
      status: injury.status,
      description: injury.description,
      reported_date: new Date().toISOString(),
      is_active: true,
      source_url: 'https://www.rotowire.com/cbasketball/injury-report.php'
    })
  }

  console.log(`   ✅ Prepared ${injuryUpserts.length} injuries for upsert`)
  if (teamsNotFound.size > 0) {
    console.log(`   ⚠️  ${teamsNotFound.size} teams not found in database:`)
    Array.from(teamsNotFound).slice(0, 5).forEach(team => {
      console.log(`      - ${team}`)
    })
    if (teamsNotFound.size > 5) {
      console.log(`      ... and ${teamsNotFound.size - 5} more`)
    }
  }

  // STEP 4: Batch upsert to database
  console.log('\n💿 STEP 4: Saving injuries to database...\n')

  if (injuryUpserts.length === 0) {
    console.log('   ⚠️  No injuries to save')
    return
  }

  const { data: upsertData, error: upsertError } = await supabase
    .from('injury_reports')
    .upsert(injuryUpserts, {
      onConflict: 'team_id, player_name',
      ignoreDuplicates: false
    })
    .select()

  if (upsertError) {
    console.error('   ❌ Error during batch upsert:', upsertError)
    return
  }

  console.log(`   ✅ Successfully upserted ${upsertData?.length || injuryUpserts.length} injury reports`)

  // STEP 5: Deactivate old injuries
  console.log('\n🧹 STEP 5: Cleaning up old injury reports...\n')

  const activePlayerKeys = injuryUpserts.map(i => `${i.team_id}:${i.player_name}`)

  const { data: currentActive } = await supabase
    .from('injury_reports')
    .select('id, team_id, player_name')
    .eq('is_active', true)

  if (currentActive) {
    const idsToDeactivate = currentActive
      .filter(injury => !activePlayerKeys.includes(`${injury.team_id}:${injury.player_name}`))
      .map(injury => injury.id)

    if (idsToDeactivate.length > 0) {
      const { error: deactivateError } = await supabase
        .from('injury_reports')
        .update({ is_active: false })
        .in('id', idsToDeactivate)

      if (deactivateError) {
        console.error('   ❌ Error deactivating old injuries:', deactivateError)
      } else {
        console.log(`   ✅ Deactivated ${idsToDeactivate.length} old injury reports`)
      }
    } else {
      console.log('   ℹ️  No old injuries to deactivate')
    }
  }

  // STEP 6: Verify results
  console.log('\n✅ STEP 6: Verification...\n')

  const { data: activeInjuries, count } = await supabase
    .from('injury_reports')
    .select('*, teams!inner(name)', { count: 'exact' })
    .eq('is_active', true)
    .order('reported_date', { ascending: false })
    .limit(10)

  console.log(`   📊 Total active injuries in database: ${count}`)
  console.log('\n   Recent injuries:')
  activeInjuries?.forEach((injury: any) => {
    console.log(`   - ${injury.player_name} (${injury.teams.name}): ${injury.injury_type} - ${injury.status}`)
  })

  console.log('\n' + '='.repeat(60))
  console.log('🎉 Pipeline test completed successfully!')
  console.log('='.repeat(60))
  console.log('\n📋 Summary:')
  console.log(`   • Scraped: ${injuries.length} injuries from RotoWire`)
  console.log(`   • Mapped: ${injuryUpserts.length} to database teams`)
  console.log(`   • Active in DB: ${count}`)
  console.log(`   • Teams not found: ${teamsNotFound.size}`)
  console.log('')
}

testFullPipeline().catch(console.error)
