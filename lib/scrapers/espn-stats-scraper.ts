import * as cheerio from 'cheerio'
import { chromium } from 'playwright'
import { BaseScraper } from './base-scraper'
import type { ScraperConfig, ValidationResult, ScraperRunResult } from './base-scraper'
import { TeamResolver } from './team-resolver'

interface ESPNRawTeamStats {
  teamName: string
  gamesPlayed: number
  wins: number
  losses: number
  pointsPerGame: number
  pointsAllowedPerGame: number
  fieldGoalPct: number
  threePointPct: number
  freeThrowPct: number
  reboundsPerGame: number
  assistsPerGame: number
  turnoversPerGame: number
  stealsPerGame: number
  blocksPerGame: number
}

interface TeamStatsRecord {
  team_id: string
  season: number
  games_played: number
  wins: number
  losses: number
  points_per_game: number
  points_allowed_per_game: number
  field_goal_pct: number
  three_point_pct: number
  free_throw_pct: number
  rebounds_per_game: number
  assists_per_game: number
  turnovers_per_game: number
  source: string
  source_url: string
  raw_stats: Record<string, any>
}

/**
 * Scraper for ESPN college basketball team statistics
 * Free source with traditional box score statistics
 */
export class ESPNStatsScraper extends BaseScraper<ESPNRawTeamStats, TeamStatsRecord> {
  protected config: ScraperConfig = {
    source: 'espn',
    rateLimit: 500, // 2 requests per second
    maxRetries: 3,
    timeout: 30000
  }

  private teamResolver = new TeamResolver(this.supabase)
  private currentSeason = this.getCurrentSeason()

  protected getJobType(): string {
    return 'team_stats'
  }

  private getCurrentSeason(): number {
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    // College basketball season runs from November to March
    // Use previous season's data until December (when current season is underway)
    // This avoids scraping empty data at the start of the season

    if (month >= 12) {
      // December onwards: use current academic year season (e.g., 2025-26 season = 2026)
      return month >= 8 ? year + 1 : year
    } else if (month >= 8) {
      // August-November: season hasn't started, use previous year
      return year
    } else {
      // January-July: use current academic year season
      return year
    }
  }

  /**
   * Scrape team stats from ESPN
   */
  protected async scrape(): Promise<ESPNRawTeamStats[]> {
    console.log(`[ESPN] Scraping team stats for ${this.currentSeason} season`)

    const allTeams: ESPNRawTeamStats[] = []

    // ESPN paginates their stats, typically 50 teams per page
    // We'll scrape multiple pages to get all teams
    const maxPages = 8 // ~400 teams / 50 per page

    for (let page = 1; page <= maxPages; page++) {
      console.log(`[ESPN] Scraping page ${page}/${maxPages}`)

      try {
        const teams = await this.scrapePage(page)
        allTeams.push(...teams)

        // If we get fewer than expected teams, we've reached the end
        if (teams.length < 40) {
          console.log(`[ESPN] Reached end of pages at page ${page}`)
          break
        }

        // Rate limiting between pages
        await this.throttle()
      } catch (error) {
        console.error(`[ESPN] Error scraping page ${page}:`, error)
        // Continue with next page
      }
    }

    return allTeams
  }

  /**
   * Scrape a single page of team stats using Playwright
   */
  private async scrapePage(page: number): Promise<ESPNRawTeamStats[]> {
    // ESPN team stats URL - use seasontype/2 for regular season
    const url = `https://www.espn.com/mens-college-basketball/stats/team/_/season/${this.currentSeason}/seasontype/2/page/${page}`

    const browser = await chromium.launch({ headless: true })
    const browserPage = await browser.newPage()

    try {
      // Navigate to the page
      await browserPage.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })

      // Wait for the stats table to be rendered
      // ESPN loads stats dynamically, so we need to wait for the content
      await browserPage.waitForSelector('tbody tr', { timeout: 10000 })

      // Wait a bit more for stats to load
      await browserPage.waitForTimeout(2000)

      // Get the HTML after JavaScript has rendered
      const html = await browserPage.content()

      return this.parseStatsPage(html)
    } finally {
      await browser.close()
    }
  }

  /**
   * Parse ESPN stats page HTML
   * ESPN uses two separate tbody elements:
   * - First tbody: team names
   * - Second tbody: stats (each cell has a div with the value)
   */
  private parseStatsPage(html: string): ESPNRawTeamStats[] {
    const $ = cheerio.load(html)
    const teams: ESPNRawTeamStats[] = []

    // ESPN uses TWO tbody elements side by side
    const tbodies = $('tbody')

    if (tbodies.length < 2) {
      console.warn('[ESPN] Could not find both tbody elements (teams and stats)')
      return teams
    }

    const teamTbody = tbodies.eq(0)
    const statsTbody = tbodies.eq(1)

    const teamRows = teamTbody.find('tr')
    const statsRows = statsTbody.find('tr')

    console.log(`[ESPN] Found ${teamRows.length} teams and ${statsRows.length} stat rows`)

    // Iterate through rows (should be same number of rows in both tbodies)
    const numRows = Math.min(teamRows.length, statsRows.length)

    for (let i = 0; i < numRows; i++) {
      try {
        // Get team name from first tbody
        const teamRow = teamRows.eq(i)
        let teamName = teamRow.text().trim()

        // Remove ranking number (e.g., "1Alabama Crimson Tide" -> "Alabama Crimson Tide")
        teamName = teamName.replace(/^\d+/, '').trim()

        if (!teamName) continue

        // Get stats from second tbody
        const statsRow = statsRows.eq(i)
        const statCells = statsRow.find('td')

        if (statCells.length < 10) {
          console.warn(`[ESPN] Row ${i} has insufficient stat cells (${statCells.length})`)
          continue
        }

        // Extract stat values from divs inside cells
        // ESPN structure: <td class="Table__TD"><div>VALUE</div></td>
        const getStatValue = (cellIndex: number): number => {
          const cell = statCells.eq(cellIndex)
          const divText = cell.find('div').first().text().trim()
          return parseFloat(divText) || 0
        }

        // Column order: GP, PPG, FGM, FGA, FG%, 3PM, 3PA, 3P%, FTM, FTA, FT%, RPG, APG, TPG, SPG, BPG
        const gamesPlayed = getStatValue(0)
        const pointsPerGame = getStatValue(1)
        const fieldGoalPct = getStatValue(4)
        const threePointPct = getStatValue(7)
        const freeThrowPct = getStatValue(10)
        const reboundsPerGame = getStatValue(11)
        const assistsPerGame = getStatValue(12)
        const turnoversPerGame = getStatValue(13)
        const stealsPerGame = getStatValue(14)
        const blocksPerGame = getStatValue(15)

        const team: ESPNRawTeamStats = {
          teamName,
          gamesPlayed: Math.floor(gamesPlayed),
          wins: 0, // Not available in this view
          losses: 0, // Not available in this view
          pointsPerGame,
          pointsAllowedPerGame: 0, // Need defensive stats page for this
          fieldGoalPct,
          threePointPct,
          freeThrowPct,
          reboundsPerGame,
          assistsPerGame,
          turnoversPerGame,
          stealsPerGame,
          blocksPerGame,
        }

        teams.push(team)
      } catch (error) {
        console.error(`[ESPN] Error parsing row ${i}:`, error)
      }
    }

    return teams
  }

  /**
   * Validate scraped data
   */
  protected validate(data: ESPNRawTeamStats[]): ValidationResult {
    const errors: string[] = []

    if (data.length === 0) {
      errors.push('No teams scraped from ESPN')
    }

    // Expect at least 300 D1 teams
    if (data.length < 300) {
      errors.push(`Only scraped ${data.length} teams, expected at least 300`)
    }

    // Validate stat ranges (percentages are in 0-100 format, not 0-1)
    const invalidTeams = data.filter(team => {
      return (
        team.pointsPerGame < 40 || team.pointsPerGame > 120 ||
        team.fieldGoalPct < 20 || team.fieldGoalPct > 70 ||
        team.threePointPct < 10 || team.threePointPct > 60
      )
    })

    if (invalidTeams.length > 0) {
      errors.push(`${invalidTeams.length} teams have invalid stat values`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Transform raw data to database format
   */
  protected async transform(data: ESPNRawTeamStats[]): Promise<TeamStatsRecord[]> {
    await this.teamResolver.initializeCache()

    const records: TeamStatsRecord[] = []
    const errors: string[] = []

    for (const team of data) {
      try {
        const resolution = await this.teamResolver.resolveTeamId(
          team.teamName,
          'espn',
          { autoCreate: true }
        )

        if (resolution.wasCreated) {
          console.log(`[ESPN] Created new team: ${team.teamName}`)
        }

        const record: TeamStatsRecord = {
          team_id: resolution.teamId,
          season: this.currentSeason,
          games_played: team.gamesPlayed,
          wins: team.wins,
          losses: team.losses,
          points_per_game: team.pointsPerGame,
          points_allowed_per_game: team.pointsAllowedPerGame,
          field_goal_pct: team.fieldGoalPct / 100, // Convert percentage to decimal
          three_point_pct: team.threePointPct / 100,
          free_throw_pct: team.freeThrowPct / 100,
          rebounds_per_game: team.reboundsPerGame,
          assists_per_game: team.assistsPerGame,
          turnovers_per_game: team.turnoversPerGame,
          source: 'espn',
          source_url: 'https://www.espn.com/mens-college-basketball/stats/team',
          raw_stats: {
            steals_per_game: team.stealsPerGame,
            blocks_per_game: team.blocksPerGame
          }
        }

        records.push(record)
      } catch (error) {
        errors.push(`Failed to transform ${team.teamName}: ${error}`)
      }
    }

    if (errors.length > 0) {
      console.warn(`[ESPN] Transform errors:`, errors.slice(0, 5))
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

    const { data: result, error } = await this.supabase
      .from('team_stats')
      .upsert(data, {
        onConflict: 'team_id, season, source',
        ignoreDuplicates: false
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

    recordsCreated = result?.length || data.length
    recordsUpdated = recordsCreated

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
