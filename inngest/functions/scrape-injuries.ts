import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'
import { normalizeTeamName } from './team-mapping'
import { chromium } from 'playwright'

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

// Helper function to find team by name
async function findTeamByName(
  supabase: any,
  teamName: string
): Promise<{ id: string } | null> {
  const normalizedName = normalizeTeamName(teamName)

  const { data } = await supabase
    .from('teams')
    .select('id')
    .eq('name', normalizedName)
    .single()

  return data
}

export const scrapeInjuries = inngest.createFunction(
  {
    id: 'scrape-injury-reports',
    name: 'Scrape College Basketball Injury Reports',
  },
  { cron: '0 */6 * * *' }, // Every 6 hours
  async ({ step }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Step 1: Scrape injury data from RotoWire
    const injuries = await step.run('scrape-rotowire-injuries', async () => {
      const browser = await chromium.launch({ headless: true })

      try {
        const page = await browser.newPage()

        // Navigate to RotoWire's college basketball injuries page
        await page.goto('https://www.rotowire.com/cbasketball/injury-report.php', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })

        const injuryData: InjuryData[] = []

        // Wait for the Webix DataTable container to load (dynamic wait)
        // Try multiple possible selectors to be more resilient
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
            console.log(`Found table with selector: ${selector}`)
            break
          } catch (e) {
            // Try next selector
            continue
          }
        }

        if (!tableFound) {
          console.error('Could not find Webix DataTable on page')
          return injuryData
        }

        // Scroll to trigger any lazy loading
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

        // Wait for cells to be visible
        await page.waitForSelector('.webix_cell', { timeout: 5000 }).catch(() => {
          console.log('Warning: Could not find .webix_cell elements')
        })

        // Try to extract data directly from Webix DataTable instance if available
        const webixData = await page.evaluate(() => {
          // Try to find the Webix instance
          // @ts-ignore - webix and $$ are global browser variables
          if (typeof webix !== 'undefined' && typeof $$ === 'function') {
            // Look for datatable views
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
          console.log(`Extracted ${webixData.data.length} injuries from Webix instance`)
          for (const item of webixData.data) {
            if (item.player && item.team && item.status) {
              // Skip headers
              if (item.player.toLowerCase().includes('player') ||
                  item.team.toLowerCase().includes('team')) {
                continue
              }

              injuryData.push({
                teamName: item.team.trim(),
                playerName: item.player.trim(),
                injuryType: item.injury?.trim() || 'Unknown',
                status: mapInjuryStatus(item.status),
                description: item.injury?.trim() || ''
              })
            }
          }
        } else {
          // Fallback to CSS selector approach
          console.log('Falling back to CSS selector scraping')

          // RotoWire uses Webix DataTable with split sections
          // Player names are in left section, other columns in center section
          const playerCells = await page.$$('.webix_ss_left .webix_cell')
          const otherCells = await page.$$('.webix_ss_center .webix_cell')

          if (playerCells.length === 0 || otherCells.length === 0) {
            console.log('No injury data found using CSS selectors')
            return injuryData
          }

          // Cells are organized by column: all team cells, then all pos cells, etc.
          const rowCount = playerCells.length
          const colSize = rowCount
          const teamCells = otherCells.slice(0, colSize)
          const posCells = otherCells.slice(colSize, colSize * 2)
          const injuryCells = otherCells.slice(colSize * 2, colSize * 3)
          const statusCells = otherCells.slice(colSize * 3, colSize * 4)

          for (let i = 0; i < rowCount; i++) {
            try {
              const playerName = await playerCells[i]?.textContent()
              const teamName = await teamCells[i]?.textContent()
              const injuryType = await injuryCells[i]?.textContent()
              const statusText = await statusCells[i]?.textContent()

              if (!playerName || !teamName || !statusText) continue

              // Skip if it's a header or placeholder
              if (playerName.includes('Player') || teamName.includes('Team')) continue

              // Basic validation
              if (playerName.trim().length === 0 || teamName.trim().length === 0) continue

              injuryData.push({
                teamName: teamName.trim(),
                playerName: playerName.trim(),
                injuryType: injuryType?.trim() || 'Unknown',
                status: mapInjuryStatus(statusText),
                description: injuryType?.trim() || ''
              })
            } catch (rowError) {
              console.error('Error parsing injury row:', rowError)
              continue
            }
          }
        }

        console.log(`Successfully scraped ${injuryData.length} injuries from RotoWire`)
        return injuryData
      } catch (error) {
        console.error('Error during RotoWire scraping:', error)
        throw error
      } finally {
        // Always close the browser to prevent resource leaks
        await browser.close()
      }
    })

    // Step 2: Fetch all teams once to avoid N+1 queries
    const teamsMap = await step.run('fetch-teams', async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')

      if (error) {
        console.error('Error fetching teams:', error)
        throw new Error('Failed to fetch teams from database')
      }

      // Create a plain object for quick lookups: { 'Team Name': 'team_id' }
      // Use plain object instead of Map for better serialization with Inngest
      const teamMap: Record<string, string> = {}
      data.forEach((team: { id: string; name: string }) => {
        teamMap[team.name] = team.id
      })

      console.log(`Loaded ${Object.keys(teamMap).length} teams into memory`)
      return teamMap
    })

    // Step 3: Batch upsert injury data to database
    const result = await step.run('batch-upsert-injuries', async () => {
      const errors: string[] = []
      const teamsNotFound = new Set<string>()
      const injuryUpserts: any[] = []

      // Map injuries to database records
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

      console.log(`Prepared ${injuryUpserts.length} injuries for upsert (${teamsNotFound.size} teams not found)`)

      let injuriesProcessed = 0

      // Perform batch upsert if we have any injuries to process
      if (injuryUpserts.length > 0) {
        const { data, error } = await supabase
          .from('injury_reports')
          .upsert(injuryUpserts, {
            onConflict: 'team_id, player_name',
            ignoreDuplicates: false // Update existing records
          })
          .select()

        if (error) {
          console.error('Error during batch upsert:', error)
          errors.push(`Batch upsert failed: ${error.message}`)
        } else {
          injuriesProcessed = data?.length || injuryUpserts.length
          console.log(`Successfully upserted ${injuriesProcessed} injury reports`)
        }
      }

      // Step 4: Mark injuries not in the current scrape as inactive
      // Get list of player names we just upserted
      const activePlayerKeys = injuryUpserts.map(i => `${i.team_id}:${i.player_name}`)

      if (activePlayerKeys.length > 0) {
        // First, get all currently active injuries
        const { data: currentActive } = await supabase
          .from('injury_reports')
          .select('id, team_id, player_name')
          .eq('is_active', true)

        if (currentActive) {
          // Find injuries to deactivate (not in current scrape)
          const idsToDeactivate = currentActive
            .filter(injury => !activePlayerKeys.includes(`${injury.team_id}:${injury.player_name}`))
            .map(injury => injury.id)

          if (idsToDeactivate.length > 0) {
            const { error: deactivateError } = await supabase
              .from('injury_reports')
              .update({ is_active: false })
              .in('id', idsToDeactivate)

            if (deactivateError) {
              console.error('Error deactivating old injuries:', deactivateError)
            } else {
              console.log(`Deactivated ${idsToDeactivate.length} old injury reports`)
            }
          }
        }
      }

      return {
        totalInjuries: injuries.length,
        injuriesProcessed,
        teamsNotFound: Array.from(teamsNotFound),
        errors
      }
    })

    return result
  }
)
