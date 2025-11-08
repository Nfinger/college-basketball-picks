import * as cheerio from 'cheerio'
import { chromium } from 'playwright'
import { BaseScraper } from './base-scraper'
import type { ScraperConfig, ValidationResult, ScraperRunResult } from './base-scraper'

/**
 * Raw player data from ESPN
 */
interface ESPNRawPlayer {
  playerName: string
  position: string
  espnTeamId: string
  gamesPlayed: number
  minutesPerGame: number
  pointsPerGame: number
  reboundsPerGame: number
  assistsPerGame: number
  stealsPerGame: number
  blocksPerGame: number
  turnoversPerGame: number
  fieldGoalPct: number
  freeThrowPct: number
  threePointPct: number
  // Detailed stats
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  offensiveRebounds: number
  defensiveRebounds: number
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
  offensive_rebounds: number
  defensive_rebounds: number
  assists_per_game: number
  steals_per_game: number
  blocks_per_game: number
  turnovers_per_game: number
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
   * Main scraping method - get all teams and scrape their players
   */
  protected async scrape(): Promise<ESPNRawPlayer[]> {
    console.log(`[ESPN Players] Scraping player stats for ${this.currentSeason} season`)

    // Get all teams with ESPN IDs from database
    const teams = await this.getTeamsWithESPNIds()
    console.log(`[ESPN Players] Found ${teams.length} teams with ESPN IDs`)

    const allPlayers: ESPNRawPlayer[] = []
    let teamsProcessed = 0

    for (const team of teams) {
      try {
        console.log(`[ESPN Players] Scraping ${team.name} (${teamsProcessed + 1}/${teams.length})`)

        const players = await this.scrapeTeamPlayers(team.espn_id)

        // Add team association to each player
        const playersWithTeam = players.map(p => ({
          ...p,
          espnTeamId: team.espn_id
        }))

        allPlayers.push(...playersWithTeam)
        teamsProcessed++

        console.log(`[ESPN Players] Found ${players.length} players for ${team.name}`)

        // Rate limiting
        await this.throttle()
      } catch (error) {
        console.error(`[ESPN Players] Error scraping ${team.name}:`, error)
        this.addError(`Failed to scrape ${team.name}: ${error}`)
        // Continue with next team
      }
    }

    console.log(`[ESPN Players] Scraped ${allPlayers.length} total players from ${teamsProcessed} teams`)
    return allPlayers
  }

  /**
   * Get all teams that have ESPN IDs from the database
   */
  private async getTeamsWithESPNIds(): Promise<Array<{ id: string; name: string; espn_id: string }>> {
    const { data, error } = await this.supabase
      .from('teams')
      .select(`
        id,
        name,
        team_external_ids!inner(espn_id)
      `)
      .not('team_external_ids.espn_id', 'is', null)

    if (error) {
      throw new Error(`Failed to fetch teams with ESPN IDs: ${error.message}`)
    }

    // Transform the nested structure
    return (data || []).map(team => ({
      id: team.id,
      name: team.name,
      espn_id: (team.team_external_ids as any).espn_id
    }))
  }

  /**
   * Scrape player stats for a single team
   */
  private async scrapeTeamPlayers(espnTeamId: string): Promise<ESPNRawPlayer[]> {
    const url = `https://www.espn.com/mens-college-basketball/team/stats/_/id/${espnTeamId}`

    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })

      // Wait for stats tables to load
      await page.waitForSelector('table', { timeout: 10000 })
      await page.waitForTimeout(2000) // Give time for JS to render

      const html = await page.content()
      return this.parsePlayersFromHTML(html)
    } finally {
      await browser.close()
    }
  }

  /**
   * Parse player stats from ESPN team stats page HTML
   * ESPN uses multiple tables:
   * - Table 1: Player names with positions
   * - Table 2: Per-game stats (GP, MIN, PTS, REB, AST, STL, BLK, TO, FG%, FT%, 3P%)
   * - Table 4: Detailed stats (FGM, FGA, FTM, FTA, 3PM, 3PA, OR, DR, etc.)
   */
  private parsePlayersFromHTML(html: string): ESPNRawPlayer[] {
    const $ = cheerio.load(html)
    const players: ESPNRawPlayer[] = []

    const tables = $('table')
    if (tables.length < 2) {
      console.warn('[ESPN Players] Not enough tables found on page')
      return players
    }

    // Get the three key tables
    const nameTable = tables.eq(0)
    const perGameStatsTable = tables.eq(1)
    const detailedStatsTable = tables.length >= 4 ? tables.eq(3) : null

    const nameRows = nameTable.find('tbody tr')
    const statsRows = perGameStatsTable.find('tbody tr')
    const detailedRows = detailedStatsTable?.find('tbody tr')

    const numPlayers = Math.min(nameRows.length, statsRows.length)

    for (let i = 0; i < numPlayers; i++) {
      try {
        // Extract player name and position
        const nameCell = nameRows.eq(i).find('td').first()
        let playerText = nameCell.text().trim()

        // Format: "Player Name POSITION" (e.g., "Isaiah Evans G")
        const match = playerText.match(/^(.+?)\s+([A-Z]{1,2})$/)
        const playerName = match ? match[1].trim() : playerText
        const position = match ? match[2] : ''

        // Skip empty names and total rows
        if (!playerName || playerName.toLowerCase() === 'total') continue

        // Extract per-game stats
        const statsRow = statsRows.eq(i)
        const statCells = statsRow.find('td')

        const getStat = (index: number): number => {
          const text = statCells.eq(index).text().trim()
          return parseFloat(text) || 0
        }

        // Table 2 columns: GP, MIN, PTS, REB, AST, STL, BLK, TO, FG%, FT%, 3P%
        const gamesPlayed = getStat(0)
        const minutesPerGame = getStat(1)
        const pointsPerGame = getStat(2)
        const reboundsPerGame = getStat(3)
        const assistsPerGame = getStat(4)
        const stealsPerGame = getStat(5)
        const blocksPerGame = getStat(6)
        const turnoversPerGame = getStat(7)
        const fieldGoalPct = getStat(8)
        const freeThrowPct = getStat(9)
        const threePointPct = getStat(10)

        // Extract detailed stats if available
        let fieldGoalsMade = 0
        let fieldGoalsAttempted = 0
        let freeThrowsMade = 0
        let freeThrowsAttempted = 0
        let threePointersMade = 0
        let threePointersAttempted = 0
        let offensiveRebounds = 0
        let defensiveRebounds = 0

        if (detailedRows && i < detailedRows.length) {
          const detailedRow = detailedRows.eq(i)
          const detailedCells = detailedRow.find('td')

          const getDetailedStat = (index: number): number => {
            const text = detailedCells.eq(index).text().trim()
            return parseFloat(text) || 0
          }

          // Table 4 columns: MIN, FGM, FGA, FTM, FTA, 3PM, 3PA, PTS, OR, DR, REB, AST, TO, STL, BLK
          fieldGoalsMade = getDetailedStat(1)
          fieldGoalsAttempted = getDetailedStat(2)
          freeThrowsMade = getDetailedStat(3)
          freeThrowsAttempted = getDetailedStat(4)
          threePointersMade = getDetailedStat(5)
          threePointersAttempted = getDetailedStat(6)
          offensiveRebounds = getDetailedStat(8)
          defensiveRebounds = getDetailedStat(9)
        }

        const player: ESPNRawPlayer = {
          playerName,
          position,
          espnTeamId: '', // Will be filled in by caller
          gamesPlayed: Math.floor(gamesPlayed),
          minutesPerGame,
          pointsPerGame,
          reboundsPerGame,
          assistsPerGame,
          stealsPerGame,
          blocksPerGame,
          turnoversPerGame,
          fieldGoalPct,
          freeThrowPct,
          threePointPct,
          fieldGoalsMade,
          fieldGoalsAttempted,
          freeThrowsMade,
          freeThrowsAttempted,
          threePointersMade,
          threePointersAttempted,
          offensiveRebounds,
          defensiveRebounds
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

    // Get team ID mappings for ESPN IDs
    const teamIdMap = await this.getTeamIdMap()

    for (const player of data) {
      try {
        const teamId = teamIdMap.get(player.espnTeamId)

        if (!teamId) {
          errors.push(`No team_id found for ESPN team ${player.espnTeamId}`)
          continue
        }

        // Calculate true shooting percentage
        // TS% = PTS / (2 * (FGA + 0.44 * FTA))
        let trueShootingPct: number | null = null
        if (player.gamesPlayed > 0 && player.fieldGoalsAttempted > 0) {
          const totalPoints = player.pointsPerGame * player.gamesPlayed
          const totalFGA = player.fieldGoalsAttempted
          const totalFTA = player.freeThrowsAttempted
          const denominator = 2 * (totalFGA + 0.44 * totalFTA)

          if (denominator > 0) {
            trueShootingPct = totalPoints / denominator
          }
        }

        const record: PlayerStatsRecord = {
          player_name: player.playerName,
          team_id: teamId,
          season: this.currentSeason,
          position: player.position || null,
          games_played: player.gamesPlayed,
          minutes_per_game: player.minutesPerGame,
          points_per_game: player.pointsPerGame,
          field_goals_made: player.fieldGoalsMade / Math.max(1, player.gamesPlayed),
          field_goals_attempted: player.fieldGoalsAttempted / Math.max(1, player.gamesPlayed),
          field_goal_pct: player.fieldGoalPct / 100, // Convert percentage to decimal
          three_pointers_made: player.threePointersMade / Math.max(1, player.gamesPlayed),
          three_pointers_attempted: player.threePointersAttempted / Math.max(1, player.gamesPlayed),
          three_point_pct: player.threePointPct / 100,
          free_throws_made: player.freeThrowsMade / Math.max(1, player.gamesPlayed),
          free_throws_attempted: player.freeThrowsAttempted / Math.max(1, player.gamesPlayed),
          free_throw_pct: player.freeThrowPct / 100,
          rebounds_per_game: player.reboundsPerGame,
          offensive_rebounds: player.offensiveRebounds / Math.max(1, player.gamesPlayed),
          defensive_rebounds: player.defensiveRebounds / Math.max(1, player.gamesPlayed),
          assists_per_game: player.assistsPerGame,
          steals_per_game: player.stealsPerGame,
          blocks_per_game: player.blocksPerGame,
          turnovers_per_game: player.turnoversPerGame,
          true_shooting_pct: trueShootingPct,
          source: 'espn',
          source_url: `https://www.espn.com/mens-college-basketball/team/stats/_/id/${player.espnTeamId}`,
          external_player_id: null, // ESPN doesn't provide player IDs in this view
          raw_stats: {
            field_goals_made_total: player.fieldGoalsMade,
            field_goals_attempted_total: player.fieldGoalsAttempted,
            free_throws_made_total: player.freeThrowsMade,
            free_throws_attempted_total: player.freeThrowsAttempted,
            three_pointers_made_total: player.threePointersMade,
            three_pointers_attempted_total: player.threePointersAttempted,
            offensive_rebounds_total: player.offensiveRebounds,
            defensive_rebounds_total: player.defensiveRebounds
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
   * Get mapping of ESPN team IDs to database team IDs
   */
  private async getTeamIdMap(): Promise<Map<string, string>> {
    const { data, error } = await this.supabase
      .from('team_external_ids')
      .select('team_id, espn_id')
      .not('espn_id', 'is', null)

    if (error) {
      throw new Error(`Failed to fetch team ID mappings: ${error.message}`)
    }

    const map = new Map<string, string>()
    for (const row of data || []) {
      if (row.espn_id) {
        map.set(row.espn_id, row.team_id)
      }
    }

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
