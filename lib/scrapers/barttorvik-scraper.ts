import * as cheerio from 'cheerio'
import { chromium } from 'playwright'
import { BaseScraper } from './base-scraper'
import type { ScraperConfig, ValidationResult, ScraperRunResult } from './base-scraper'
import { TeamResolver } from './team-resolver'

interface BartTorvikRawTeamStats {
  rank: number
  teamName: string
  conference: string
  wins: number
  losses: number
  adjustedEfficiency: number
  adjustedOffense: number
  adjustedDefense: number
  adjustedTempo: number
  luck: number
  strengthOfSchedule: number
  sosRank: number
  offenseRank: number
  defenseRank: number
  nonConferenceSOS: number
}

interface TeamStatsRecord {
  team_id: string
  season: number
  games_played: number
  wins: number
  losses: number
  offensive_efficiency: number
  defensive_efficiency: number
  tempo: number
  strength_of_schedule: number
  offensive_efficiency_rank: number
  defensive_efficiency_rank: number
  overall_rank: number
  strength_of_schedule_rank: number
  source: string
  source_url: string
  raw_stats: Record<string, any>
}

/**
 * Scraper for BartTorvik.com team ratings and statistics
 * Free source with comprehensive tempo-free metrics
 */
export class BartTorvikScraper extends BaseScraper<BartTorvikRawTeamStats, TeamStatsRecord> {
  protected config: ScraperConfig = {
    source: 'barttorvik',
    rateLimit: 1000, // 1 request per second
    maxRetries: 3,
    timeout: 30000
  }

  private teamResolver = new TeamResolver(this.supabase)
  private currentSeason = this.getCurrentSeason()

  protected getJobType(): string {
    return 'team_stats'
  }

  /**
   * Get current college basketball season
   * Season runs Nov-Apr, so use year of the spring semester
   */
  private getCurrentSeason(): number {
    const now = new Date()
    const month = now.getMonth() + 1 // 1-12
    const year = now.getFullYear()

    // If it's Jan-Jul, we're in the spring semester of that season
    // If it's Aug-Dec, we're in the fall of the next season
    return month >= 8 ? year + 1 : year
  }

  /**
   * Scrape team stats from BartTorvik using Playwright
   * (BartTorvik uses Cloudflare protection requiring a real browser)
   */
  protected async scrape(): Promise<BartTorvikRawTeamStats[]> {
    console.log(`[BartTorvik] Scraping team stats for ${this.currentSeason} season`)

    const url = 'https://barttorvik.com/trank.php'

    // Launch browser
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    const page = await context.newPage()

    try {
      console.log('[BartTorvik] Loading page...')
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

      // Wait for the table to appear (after Cloudflare check)
      console.log('[BartTorvik] Waiting for table to load...')
      await page.waitForSelector('table', { timeout: 30000 })

      // Get the page HTML
      const html = await page.content()
      console.log(`[BartTorvik] Page loaded, HTML length: ${html.length}`)

      return this.parseHtml(html)
    } finally {
      await browser.close()
    }
  }

  /**
   * Parse HTML and extract team stats
   */
  private parseHtml(html: string): BartTorvikRawTeamStats[] {
    const $ = cheerio.load(html)
    const teams: BartTorvikRawTeamStats[] = []

    // BartTorvik uses a table with id 'trank-table' or similar
    // Find the main stats table
    const table = $('table').first()

    if (!table.length) {
      throw new Error('Could not find stats table on BartTorvik page')
    }

    // Parse table rows
    table.find('tbody tr').each((index, row) => {
      try {
        const cells = $(row).find('td')

        if (cells.length < 15) return // Skip incomplete rows

        // Team name is in column 1, but includes game info - extract just the team name
        const teamText = cells.eq(1).text().trim()
        // Extract team name (before any game info which starts with (H), (A), (N), @, or vs.)
        const teamName = teamText.split(/\s+(?:\(|\@|vs\.)/)[0].trim()

        // Skip header rows or empty rows
        if (!teamName || teamName.toLowerCase().includes('d-i avg')) return

        // Record is in format "W-L" in column 4
        const record = cells.eq(4).text().trim()
        const [winsStr, lossesStr] = record.split('-')
        const wins = parseInt(winsStr) || 0
        const losses = parseInt(lossesStr) || 0

        const team: BartTorvikRawTeamStats = {
          rank: parseInt(cells.eq(0).text().trim()) || index + 1,
          teamName,
          conference: cells.eq(2).text().trim(),
          wins,
          losses,
          adjustedEfficiency: 0, // Will calculate from offense and defense
          adjustedOffense: parseFloat(cells.eq(5).text().trim()) || 0,
          adjustedDefense: parseFloat(cells.eq(6).text().trim()) || 0,
          adjustedTempo: parseFloat(cells.eq(22).text().trim()) || 0,
          luck: parseFloat(cells.eq(23).text().trim().replace('+', '')) || 0,
          strengthOfSchedule: 0, // Not easily extractable from this table
          sosRank: 0, // Not easily extractable
          offenseRank: parseInt(cells.eq(8).text().trim()) || 0,
          defenseRank: parseInt(cells.eq(9).text().trim()) || 0,
          nonConferenceSOS: 0, // Not easily extractable
        }

        teams.push(team)
      } catch (error) {
        console.error('Error parsing BartTorvik row:', error)
      }
    })

    return teams
  }

  /**
   * Validate scraped data
   */
  protected validate(data: BartTorvikRawTeamStats[]): ValidationResult {
    const errors: string[] = []

    if (data.length === 0) {
      errors.push('No teams scraped from BartTorvik')
    }

    // Expect at least 300 D1 teams
    if (data.length < 300) {
      errors.push(`Only scraped ${data.length} teams, expected at least 300`)
    }

    // Validate data ranges
    // AdjOE typically ranges from 85-130 (points per 100 possessions)
    // AdjDE typically ranges from 75-120 (points allowed per 100 possessions)
    // Tempo typically ranges from 60-80, but can go up to 95 for very fast teams
    const invalidTeams = data.filter(team => {
      return (
        team.adjustedOffense < 80 || team.adjustedOffense > 135 ||
        team.adjustedDefense < 70 || team.adjustedDefense > 125 ||
        team.adjustedTempo < 55 || team.adjustedTempo > 95
      )
    })

    if (invalidTeams.length > 0) {
      errors.push(`${invalidTeams.length} teams have invalid efficiency/tempo values`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Transform raw data to database format
   */
  protected async transform(data: BartTorvikRawTeamStats[]): Promise<TeamStatsRecord[]> {
    // Initialize team resolver cache
    await this.teamResolver.initializeCache()

    const records: TeamStatsRecord[] = []
    const errors: string[] = []

    for (const team of data) {
      try {
        // Resolve team ID
        const resolution = await this.teamResolver.resolveTeamId(
          team.teamName,
          'barttorvik',
          { autoCreate: true }
        )

        if (resolution.wasCreated) {
          console.log(`[BartTorvik] Created new team: ${team.teamName}`)
        }

        const record: TeamStatsRecord = {
          team_id: resolution.teamId,
          season: this.currentSeason,
          games_played: team.wins + team.losses,
          wins: team.wins,
          losses: team.losses,
          offensive_efficiency: team.adjustedOffense,
          defensive_efficiency: team.adjustedDefense,
          tempo: team.adjustedTempo,
          strength_of_schedule: team.strengthOfSchedule,
          offensive_efficiency_rank: team.offenseRank,
          defensive_efficiency_rank: team.defenseRank,
          overall_rank: team.rank,
          strength_of_schedule_rank: team.sosRank,
          source: 'barttorvik',
          source_url: 'https://barttorvik.com/trank.php',
          raw_stats: {
            conference: team.conference,
            adjusted_efficiency: team.adjustedEfficiency,
            luck: team.luck,
            non_conference_sos: team.nonConferenceSOS
          }
        }

        records.push(record)
      } catch (error) {
        errors.push(`Failed to transform ${team.teamName}: ${error}`)
      }
    }

    if (errors.length > 0) {
      console.warn(`[BartTorvik] Transform errors:`, errors.slice(0, 5))
    }

    return records
  }

  /**
   * Save team stats to database
   */
  protected async save(data: TeamStatsRecord[]): Promise<ScraperRunResult> {
    const errors: string[] = []
    let recordsCreated = 0
    let recordsUpdated = 0

    // Batch upsert
    const { data: result, error } = await this.supabase
      .from('team_stats')
      .upsert(data, {
        onConflict: 'team_id, season, source',
        ignoreDuplicates: false // Update existing records
      })
      .select()

    if (error) {
      errors.push(`Database upsert failed: ${error.message}`)
      return {
        success: false,
        recordsProcessed: 0,
        errors,
        warnings: []
      }
    }

    // Check if records were created or updated
    // Note: Supabase doesn't tell us which were created vs updated
    // We'll assume they were all successful
    recordsCreated = result?.length || data.length
    recordsUpdated = recordsCreated // Conservative estimate

    return {
      success: true,
      recordsProcessed: data.length,
      recordsCreated,
      recordsUpdated,
      errors,
      warnings: []
    }
  }
}
