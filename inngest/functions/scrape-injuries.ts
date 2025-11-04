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

    // Step 1: Scrape injury data from ESPN
    const injuries = await step.run('scrape-espn-injuries', async () => {
      const browser = await chromium.launch({ headless: true })
      const page = await browser.newPage()

      try {
        // Navigate to RotoWire's college basketball injuries page
        await page.goto('https://www.rotowire.com/cbasketball/injury-report.php', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })

        const injuryData: InjuryData[] = []

        // Wait for page to fully render
        await page.waitForTimeout(5000)
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(2000)

        // RotoWire uses Webix DataTable with split sections
        // Player names are in left section, other columns in center section
        const playerCells = await page.$$('.webix_ss_left .webix_cell')
        const otherCells = await page.$$('.webix_ss_center .webix_cell')

        if (playerCells.length === 0 || otherCells.length === 0) {
          console.log('No injury data found on page')
          await browser.close()
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

        await browser.close()
        return injuryData
      } catch (error) {
        await browser.close()
        throw error
      }
    })

    // Step 2: Mark all existing injuries as inactive (we'll reactivate or update them)
    await step.run('mark-injuries-inactive', async () => {
      const { error } = await supabase
        .from('injury_reports')
        .update({ is_active: false })
        .eq('is_active', true)

      if (error) {
        console.error('Error marking injuries inactive:', error)
      }
    })

    // Step 3: Upsert injury data to database
    const result = await step.run('upsert-injuries', async () => {
      let injuriesProcessed = 0
      let injuriesCreated = 0
      let injuriesUpdated = 0
      const errors: string[] = []
      const teamsNotFound: string[] = []

      for (const injury of injuries) {
        try {
          // Find the team in our database
          const team = await findTeamByName(supabase, injury.teamName)

          if (!team) {
            if (!teamsNotFound.includes(injury.teamName)) {
              teamsNotFound.push(injury.teamName)
            }
            continue
          }

          // Check if this injury already exists
          const { data: existingInjury } = await supabase
            .from('injury_reports')
            .select('id, status')
            .eq('team_id', team.id)
            .eq('player_name', injury.playerName)
            .eq('is_active', false) // Check recently inactive ones
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (existingInjury) {
            // Update existing injury
            const { error } = await supabase
              .from('injury_reports')
              .update({
                status: injury.status,
                injury_type: injury.injuryType,
                description: injury.description,
                reported_date: new Date().toISOString(),
                is_active: true,
                source_url: 'https://www.rotowire.com/cbasketball/injury-report.php'
              })
              .eq('id', existingInjury.id)

            if (error) {
              errors.push(`Failed to update injury for ${injury.playerName}: ${error.message}`)
            } else {
              injuriesUpdated++
              injuriesProcessed++
            }
          } else {
            // Create new injury report
            const { error } = await supabase
              .from('injury_reports')
              .insert({
                team_id: team.id,
                player_name: injury.playerName,
                injury_type: injury.injuryType,
                status: injury.status,
                description: injury.description,
                reported_date: new Date().toISOString(),
                is_active: true,
                source_url: 'https://www.rotowire.com/cbasketball/injury-report.php'
              })

            if (error) {
              errors.push(`Failed to create injury for ${injury.playerName}: ${error.message}`)
            } else {
              injuriesCreated++
              injuriesProcessed++
            }
          }
        } catch (error) {
          errors.push(`Error processing injury: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      return {
        totalInjuries: injuries.length,
        injuriesProcessed,
        injuriesCreated,
        injuriesUpdated,
        teamsNotFound,
        errors
      }
    })

    return result
  }
)
