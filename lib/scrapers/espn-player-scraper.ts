import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { ScraperConfig, ValidationResult, ScraperRunResult } from './base-scraper'
import { launchBrowser } from '../browser'

/**
 * Raw player data from ESPN
 */
interface ESPNRawPlayer {
  playerName: string
  teamAbbreviation: string // e.g., "OSU" from "Bruce ThorntonOSU"
  position: string
  gamesPlayed: number
  minutesPerGame: number
  pointsPerGame: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  fieldGoalPct: number
  threePointersMade: number
  threePointersAttempted: number
  threePointPct: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  freeThrowPct: number
  reboundsPerGame: number
  assistsPerGame: number
  stealsPerGame: number
  blocksPerGame: number
  turnoversPerGame: number
  foulsPerGame: number
}

/**
 * Transformed player data for database
 */
interface PlayerStatsRecord {
  player_name: string
  team_id: string
  season: number
  position: string
  games_played: number
  minutes_per_game: number
  points_per_game: number
  field_goals_made: number
  field_goals_attempted: number
  field_goal_pct: number
  three_pointers_made: number
  three_pointers_attempted: number
  three_point_pct: number
  free_throws_made: number
  free_throws_attempted: number
  free_throw_pct: number
  rebounds_per_game: number
  offensive_rebounds: number | null
  defensive_rebounds: number | null
  assists_per_game: number
  steals_per_game: number
  blocks_per_game: number
  turnovers_per_game: number
  fouls_per_game: number | null
  true_shooting_pct: number | null
  source: string
  source_url: string
  external_player_id: string | null
  raw_stats: Record<string, any>
}

/**
 * Scraper for ESPN college basketball player statistics
 * Fetches individual player stats for all teams
 */
export class ESPNPlayerScraper extends BaseScraper<ESPNRawPlayer, PlayerStatsRecord> {
  protected config: ScraperConfig = {
    source: 'espn',
    rateLimit: 1000, // 1 request per second to be gentle
    maxRetries: 3,
    timeout: 30000
  }

  private currentSeason = this.getCurrentSeason()

  protected getJobType(): string {
    return 'player_stats'
  }

  private getCurrentSeason(): number {
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    // College basketball season logic (same as team scraper)
    if (month >= 12) {
      return month >= 8 ? year + 1 : year
    } else if (month >= 8) {
      return year
    } else {
      return year
    }
  }

  /**
   * Main scraping method - scrape player stats from paginated list
   */
  protected async scrape(): Promise<ESPNRawPlayer[]> {
    console.log(`[ESPN Players] Scraping player stats for ${this.currentSeason} season`)

    const allPlayers: ESPNRawPlayer[] = []

    // ESPN paginates their player stats, typically 50 players per page
    // Similar to team stats scraper
    const maxPages = 100 // ~5000 players / 50 per page

    for (let page = 1; page <= maxPages; page++) {
      console.log(`[ESPN Players] Scraping page ${page}/${maxPages}`)

      try {
        const players = await this.scrapePage(page)
        allPlayers.push(...players)

        // If we get fewer than expected players, we've reached the end
        if (players.length < 40) {
          console.log(`[ESPN Players] Reached end of pages at page ${page}`)
          break
        }

        // Rate limiting between pages
        await this.throttle()
      } catch (error) {
        console.error(`[ESPN Players] Error scraping page ${page}:`, error)
        // Continue with next page
      }
    }

    console.log(`[ESPN Players] Scraped ${allPlayers.length} total players`)
    return allPlayers
  }

  /**
   * Scrape a single page of player stats using Playwright
   */
  private async scrapePage(page: number): Promise<ESPNRawPlayer[]> {
    // ESPN player stats URL - similar to team stats
    const url = `https://www.espn.com/mens-college-basketball/stats/player/_/season/${this.currentSeason}/seasontype/2/page/${page}`

    const browser = await launchBrowser()
    const browserPage = await browser.newPage()

    try {
      // Navigate to the page
      await browserPage.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })

      // Wait for the stats table to be rendered
      await browserPage.waitForSelector('tbody tr', { timeout: 10000 })

      // Wait a bit more for stats to load
      await browserPage.waitForTimeout(2000)

      // Get the HTML after JavaScript has rendered
      const html = await browserPage.content()

      return this.parsePlayersFromHTML(html)
    } finally {
      await browser.close()
    }
  }

  /**
   * Parse player stats from ESPN player list page HTML
   * ESPN uses two tables:
   * - Table 1: RK, Name (format: "Bruce ThorntonOSU" - name + team abbreviation)
   * - Table 2: POS, GP, MIN, PTS, FGM, FGA, FG%, 3PM, 3PA, 3P%, FTM, FTA, FT%, REB, AST, STL, BLK, TO, PF
   */
  private parsePlayersFromHTML(html: string): ESPNRawPlayer[] {
    const $ = cheerio.load(html)
    const players: ESPNRawPlayer[] = []

    const tables = $('table')
    if (tables.length < 2) {
      console.warn('[ESPN Players] Not enough tables found on page')
      return players
    }

    const nameTable = tables.eq(0)
    const statsTable = tables.eq(1)

    const nameRows = nameTable.find('tbody tr')
    const statsRows = statsTable.find('tbody tr')

    const numPlayers = Math.min(nameRows.length, statsRows.length)

    for (let i = 0; i < numPlayers; i++) {
      try {
        // Extract player name and team from name table
        const nameCell = nameRows.eq(i).find('td').eq(1) // Second column is Name
        let nameText = nameCell.text().trim()

        // Skip empty rows
        if (!nameText) continue

        // Format: "Bruce ThorntonOSU" - need to extract name and team abbreviation
        // Team abbreviations are typically 2-4 uppercase letters at the end
        const nameMatch = nameText.match(/^(.+?)([A-Z]{2,5})$/)
        if (!nameMatch) {
          console.warn(`[ESPN Players] Could not parse player/team from: ${nameText}`)
          continue
        }

        const playerName = nameMatch[1].trim()
        const teamAbbreviation = nameMatch[2]

        // Extract stats from stats table
        const statsRow = statsRows.eq(i)
        const statCells = statsRow.find('td')

        const getStat = (index: number): number => {
          const text = statCells.eq(index).text().trim()
          return parseFloat(text) || 0
        }

        // Table 2 columns: POS, GP, MIN, PTS, FGM, FGA, FG%, 3PM, 3PA, 3P%, FTM, FTA, FT%, REB, AST, STL, BLK, TO, PF
        const position = statCells.eq(0).text().trim()
        const gamesPlayed = getStat(1)
        const minutesPerGame = getStat(2)
        const pointsPerGame = getStat(3)
        const fieldGoalsMade = getStat(4)
        const fieldGoalsAttempted = getStat(5)
        const fieldGoalPct = getStat(6)
        const threePointersMade = getStat(7)
        const threePointersAttempted = getStat(8)
        const threePointPct = getStat(9)
        const freeThrowsMade = getStat(10)
        const freeThrowsAttempted = getStat(11)
        const freeThrowPct = getStat(12)
        const reboundsPerGame = getStat(13)
        const assistsPerGame = getStat(14)
        const stealsPerGame = getStat(15)
        const blocksPerGame = getStat(16)
        const turnoversPerGame = getStat(17)
        const foulsPerGame = getStat(18)

        const player: ESPNRawPlayer = {
          playerName,
          teamAbbreviation,
          position,
          gamesPlayed: Math.floor(gamesPlayed),
          minutesPerGame,
          pointsPerGame,
          fieldGoalsMade,
          fieldGoalsAttempted,
          fieldGoalPct,
          threePointersMade,
          threePointersAttempted,
          threePointPct,
          freeThrowsMade,
          freeThrowsAttempted,
          freeThrowPct,
          reboundsPerGame,
          assistsPerGame,
          stealsPerGame,
          blocksPerGame,
          turnoversPerGame,
          foulsPerGame
        }

        players.push(player)
      } catch (error) {
        console.error(`[ESPN Players] Error parsing player ${i}:`, error)
      }
    }

    return players
  }

  /**
   * Validate scraped player data
   */
  protected validate(data: ESPNRawPlayer[]): ValidationResult {
    const errors: string[] = []

    if (data.length === 0) {
      errors.push('No players scraped from ESPN')
    }

    // Should have at least a few thousand players across all D1 teams
    if (data.length < 1000) {
      errors.push(`Only scraped ${data.length} players, expected at least 1000`)
    }

    // Validate stat ranges
    const invalidPlayers = data.filter(player => {
      return (
        player.pointsPerGame < 0 || player.pointsPerGame > 50 ||
        player.fieldGoalPct < 0 || player.fieldGoalPct > 100 ||
        player.minutesPerGame < 0 || player.minutesPerGame > 45
      )
    })

    if (invalidPlayers.length > 0) {
      errors.push(`${invalidPlayers.length} players have invalid stat values`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Transform raw player data to database format
   */
  protected async transform(data: ESPNRawPlayer[]): Promise<PlayerStatsRecord[]> {
    const records: PlayerStatsRecord[] = []
    const errors: string[] = []

    // Get team ID mappings by abbreviation
    const teamIdMap = await this.getTeamAbbreviationMap()

    for (const player of data) {
      try {
        const teamId = teamIdMap.get(player.teamAbbreviation)

        if (!teamId) {
          errors.push(`No team_id found for abbreviation ${player.teamAbbreviation} (player: ${player.playerName})`)
          continue
        }

        // Calculate true shooting percentage
        // TS% = PTS / (2 * (FGA + 0.44 * FTA))
        let trueShootingPct: number | null = null
        if (player.gamesPlayed > 0) {
          const totalPoints = player.pointsPerGame * player.gamesPlayed
          const totalFGA = player.fieldGoalsMade * player.gamesPlayed // Total attempts already per-game
          const totalFTA = player.freeThrowsMade * player.gamesPlayed
          const denominator = 2 * (totalFGA + 0.44 * totalFTA)

          if (denominator > 0) {
            trueShootingPct = totalPoints / denominator
          }
        }

        const record: PlayerStatsRecord = {
          player_name: player.playerName,
          team_id: teamId,
          season: this.currentSeason,
          position: player.position || '',
          games_played: player.gamesPlayed,
          minutes_per_game: player.minutesPerGame,
          points_per_game: player.pointsPerGame,
          field_goals_made: player.fieldGoalsMade,
          field_goals_attempted: player.fieldGoalsAttempted,
          field_goal_pct: player.fieldGoalPct / 100, // Convert percentage to decimal
          three_pointers_made: player.threePointersMade,
          three_pointers_attempted: player.threePointersAttempted,
          three_point_pct: player.threePointPct / 100,
          free_throws_made: player.freeThrowsMade,
          free_throws_attempted: player.freeThrowsAttempted,
          free_throw_pct: player.freeThrowPct / 100,
          rebounds_per_game: player.reboundsPerGame,
          offensive_rebounds: null, // Not available in list view
          defensive_rebounds: null, // Not available in list view
          assists_per_game: player.assistsPerGame,
          steals_per_game: player.stealsPerGame,
          blocks_per_game: player.blocksPerGame,
          turnovers_per_game: player.turnoversPerGame,
          fouls_per_game: player.foulsPerGame,
          true_shooting_pct: trueShootingPct,
          source: 'espn',
          source_url: 'https://www.espn.com/mens-college-basketball/stats/player',
          external_player_id: null, // ESPN doesn't provide player IDs in this view
          raw_stats: {
            team_abbreviation: player.teamAbbreviation
          }
        }

        records.push(record)
      } catch (error) {
        errors.push(`Failed to transform ${player.playerName}: ${error}`)
      }
    }

    if (errors.length > 0) {
      console.warn(`[ESPN Players] Transform errors (showing first 10):`, errors.slice(0, 10))
    }

    console.log(`[ESPN Players] Transformed ${records.length} player records`)
    return records
  }

  /**
   * Get mapping of team abbreviations to database team IDs
   * Maps short_name (e.g., "OSU", "UNC", "DUKE") to team ID
   */
  private async getTeamAbbreviationMap(): Promise<Map<string, string>> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('id, short_name, name')

    if (error) {
      throw new Error(`Failed to fetch team abbreviation mappings: ${error.message}`)
    }

    const map = new Map<string, string>()
    for (const team of data || []) {
      // Map by short_name (primary)
      if (team.short_name) {
        map.set(team.short_name.toUpperCase(), team.id)
      }

      // Also try common abbreviations derived from name
      // E.g., "Ohio State" -> "OSU", "North Carolina" -> "UNC"
      const nameWords = team.name.split(' ')
      if (nameWords.length >= 2) {
        // Create abbreviation from first letters
        const abbr = nameWords.map((w: string) => w[0]).join('').toUpperCase()
        if (abbr.length >= 2 && abbr.length <= 5) {
          map.set(abbr, team.id)
        }
      }
    }

    console.log(`[ESPN Players] Created abbreviation map with ${map.size} entries`)
    return map
  }

  /**
   * Save player stats to database
   */
  protected async save(data: PlayerStatsRecord[]): Promise<ScraperRunResult> {
    const errors: string[] = []
    let recordsCreated = 0
    let recordsUpdated = 0

    // Batch upsert all player stats
    const { data: result, error } = await this.supabase
      .from('player_stats')
      .upsert(data, {
        onConflict: 'player_name, team_id, season, source',
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

    console.log(`[ESPN Players] Saved ${recordsCreated} player records to database`)

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
