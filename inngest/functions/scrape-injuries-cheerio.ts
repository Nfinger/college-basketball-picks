import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'
import { normalizeTeamName } from './team-mapping'
import * as cheerio from 'cheerio'

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

export const scrapeInjuriesCheerio = inngest.createFunction(
  {
    id: 'scrape-injury-reports-cheerio',
    name: 'Scrape College Basketball Injury Reports (Cheerio)',
  },
  { cron: '0 */6 * * *' }, // Every 6 hours
  async ({ step }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Step 1: Fetch and parse injury data from ESPN
    const injuries = await step.run('fetch-espn-injuries', async () => {
      try {
        const response = await fetch('https://www.espn.com/mens-college-basketball/injuries', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        })

        if (!response.ok) {
          throw new Error(`ESPN fetch failed: ${response.statusText}`)
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        const injuryData: InjuryData[] = []

        // ESPN's injury page structure - adjust selectors based on actual HTML
        // This is a generic approach that may need adjustment
        $('.ResponsiveTable, .injuries, [class*="InjuryTable"]').each((_, section) => {
          try {
            // Get team name from section header
            const teamName = $(section)
              .find('.TeamName, .team-name, h2, h3, [class*="TeamName"]')
              .first()
              .text()
              .trim()

            if (!teamName) return

            // Get injury rows
            $(section)
              .find('tr, .injury-row, [class*="InjuryRow"]')
              .each((_, row) => {
                try {
                  const cells = $(row).find('td, .cell, [class*="Cell"]')
                  if (cells.length < 3) return

                  const playerName = $(cells[0]).text().trim()
                  const injuryInfo = $(cells[1]).text().trim()
                  const statusText = $(cells[2]).text().trim()

                  if (!playerName || !statusText) return

                  const injuryType = injuryInfo.split(',')[0]?.trim() || 'Unknown'

                  injuryData.push({
                    teamName,
                    playerName,
                    injuryType,
                    status: mapInjuryStatus(statusText),
                    description: injuryInfo
                  })
                } catch (rowError) {
                  console.error('Error parsing injury row:', rowError)
                }
              })
          } catch (sectionError) {
            console.error('Error parsing injury section:', sectionError)
          }
        })

        return injuryData
      } catch (error) {
        console.error('Error fetching ESPN injuries:', error)
        return []
      }
    })

    // Step 2: Mark all existing injuries as inactive
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
            .eq('is_active', false)
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
                source_url: 'https://www.espn.com/mens-college-basketball/injuries'
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
                source_url: 'https://www.espn.com/mens-college-basketball/injuries'
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
