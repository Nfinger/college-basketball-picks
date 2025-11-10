import type { Browser, Page } from 'playwright-core'
import { BaseScraper } from './base-scraper'
import type { ScraperConfig, ValidationResult, ScraperRunResult } from './base-scraper'
import { TeamResolver } from './team-resolver'
import { launchBrowser } from '../browser'

interface KenPomRawTeamStats {
  rank: number
  teamName: string
  conference: string
  wins: number
  losses: number
  adjustedEfficiencyMargin: number  // AdjEM
  adjustedOffensiveEfficiency: number  // AdjO
  adjustedOffensiveRank: number
  adjustedDefensiveEfficiency: number  // AdjD
  adjustedDefensiveRank: number
  adjustedTempo: number
  adjustedTempoRank: number
  luck: number
  strengthOfSchedule: number
  sosRank: number
  opponentAdjO: number
  opponentAdjD: number
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
 * Scraper for KenPom.com - Premium college basketball analytics
 * Requires subscription ($19.95/year) and authentication
 *
 * Setup:
 * 1. Subscribe at https://kenpom.com/subscribe.php
 * 2. Add to .env:
 *    KENPOM_EMAIL=your@email.com
 *    KENPOM_PASSWORD=yourpassword
 */
export class KenPomScraper extends BaseScraper<KenPomRawTeamStats, TeamStatsRecord> {
  protected config: ScraperConfig = {
    source: 'kenpom',
    rateLimit: 1500, // 1.5 seconds between requests (be respectful)
    maxRetries: 3,
    timeout: 45000 // 45 seconds for browser operations
  }

  private browser: Browser | null = null
  private page: Page | null = null
  private teamResolver = new TeamResolver(this.supabase)
  private currentSeason = this.getCurrentSeason()

  protected getJobType(): string {
    return 'team_stats'
  }

  private getCurrentSeason(): number {
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    return month >= 8 ? year + 1 : year
  }

  /**
   * Initialize browser and authenticate
   */
  private async initBrowser(): Promise<void> {
    console.log('[KenPom] Launching browser...')

    this.browser = await launchBrowser()

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    })

    this.page = await context.newPage()

    // Add script to mask automation
    await this.page.addInitScript(() => {
      // @ts-ignore
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      })
    })

    console.log('[KenPom] Authenticating...')
    await this.authenticate()
  }

  /**
   * Authenticate with KenPom
   */
  private async authenticate(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser page not initialized')
    }

    const email = process.env.KENPOM_EMAIL
    const password = process.env.KENPOM_PASSWORD

    if (!email || !password) {
      throw new Error(
        'KenPom credentials not configured. Set KENPOM_EMAIL and KENPOM_PASSWORD in .env'
      )
    }

    // Navigate to login page
    await this.page.goto('https://kenpom.com/', {
      waitUntil: 'networkidle',
      timeout: this.config.timeout
    })

    // Wait a bit for any Cloudflare challenges
    await this.page.waitForTimeout(3000)

    // Check if we're blocked by Cloudflare
    const isBlocked = await this.page.evaluate(() => {
      const bodyText = document.body.innerText
      return bodyText.includes('you have been blocked') ||
             bodyText.includes('Cloudflare') ||
             bodyText.includes('Just a moment')
    })

    if (isBlocked) {
      console.log('[KenPom] Waiting for Cloudflare challenge...')
      await this.page.waitForTimeout(10000) // Wait for potential auto-solve
    }

    // Check if already logged in (premium user)
    const isLoggedIn = await this.page.$('a[href*="logout"]')
    if (isLoggedIn) {
      console.log('[KenPom] Already authenticated')
      return
    }

    // Check if we can see the ratings table (another indicator of being logged in)
    const hasRatingsTable = await this.page.$('table#ratings-table')
    if (hasRatingsTable) {
      console.log('[KenPom] Already authenticated (ratings table visible)')
      return
    }

    // Find and fill login form
    // KenPom uses a simple form with email and password fields
    try {
      // Type slowly to appear more human
      await this.page.type('input[name="email"]', email, { delay: 100 })
      await this.page.waitForTimeout(500)
      await this.page.type('input[name="password"]', password, { delay: 100 })
      await this.page.waitForTimeout(1000)

      // Submit form
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
        this.page.click('input[type="submit"]')
      ])

      // Wait for page to settle
      await this.page.waitForTimeout(3000)

      // Check for Cloudflare block again
      const stillBlocked = await this.page.evaluate(() => {
        const bodyText = document.body.innerText
        return bodyText.includes('you have been blocked') ||
               bodyText.includes('Cloudflare')
      })

      if (stillBlocked) {
        throw new Error('Blocked by Cloudflare protection - try running in non-headless mode or from a different IP')
      }

      // Verify login success - check for ratings table instead of logout link
      const loginSuccess = await this.page.$('table#ratings-table')
      if (!loginSuccess) {
        // Try navigating to main page again
        await this.page.goto('https://kenpom.com/', {
          waitUntil: 'networkidle',
          timeout: this.config.timeout
        })
        await this.page.waitForTimeout(2000)

        const ratingsTableNow = await this.page.$('table#ratings-table')
        if (!ratingsTableNow) {
          throw new Error('Login failed - ratings table not found after login')
        }
      }

      console.log('[KenPom] Successfully authenticated')
    } catch (error) {
      throw new Error(`KenPom authentication failed: ${error}`)
    }
  }

  /**
   * Cleanup browser resources
   */
  private async closeBrowser(): Promise<void> {
    if (this.page) {
      await this.page.close()
      this.page = null
    }
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  /**
   * Main scrape method with browser lifecycle
   */
  async run(): Promise<ScraperRunResult> {
    try {
      await this.initBrowser()
      return await super.run()
    } finally {
      await this.closeBrowser()
    }
  }

  /**
   * Scrape team stats from KenPom
   */
  protected async scrape(): Promise<KenPomRawTeamStats[]> {
    if (!this.page) {
      throw new Error('Browser not initialized')
    }

    console.log(`[KenPom] Scraping team stats for ${this.currentSeason} season`)

    // Navigate to main ratings page
    await this.page.goto('https://kenpom.com/', {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout
    })

    // Wait for the ratings table to load
    await this.page.waitForSelector('table#ratings-table', { timeout: 10000 })

    // Extract data using page.evaluate
    const teams = await this.page.evaluate(() => {
      const table = document.querySelector('table#ratings-table')
      if (!table) return []

      const rows = Array.from(table.querySelectorAll('tbody tr'))
      const data: any[] = []

      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'))
        if (cells.length < 12) return // Skip incomplete rows

        // Parse team name (remove seed numbers if present)
        const teamCell = cells[1]
        const teamLink = teamCell.querySelector('a')
        const teamName = teamLink?.textContent?.trim() || ''

        // Remove seed number pattern (e.g., "Duke 1" -> "Duke")
        const cleanTeamName = teamName.replace(/\s+\d+$/, '').trim()

        // Parse record (e.g., "21-5" -> wins: 21, losses: 5)
        const recordText = cells[2]?.textContent?.trim() || '0-0'
        const [wins, losses] = recordText.split('-').map(n => parseInt(n) || 0)

        data.push({
          rank: parseInt(cells[0]?.textContent?.trim() || '0'),
          teamName: cleanTeamName,
          conference: cells[3]?.textContent?.trim() || '',
          wins,
          losses,
          adjustedEfficiencyMargin: parseFloat(cells[4]?.textContent?.trim() || '0'),
          adjustedOffensiveEfficiency: parseFloat(cells[5]?.textContent?.trim() || '0'),
          adjustedOffensiveRank: parseInt(cells[6]?.textContent?.trim() || '0'),
          adjustedDefensiveEfficiency: parseFloat(cells[7]?.textContent?.trim() || '0'),
          adjustedDefensiveRank: parseInt(cells[8]?.textContent?.trim() || '0'),
          adjustedTempo: parseFloat(cells[9]?.textContent?.trim() || '0'),
          adjustedTempoRank: parseInt(cells[10]?.textContent?.trim() || '0'),
          luck: parseFloat(cells[11]?.textContent?.trim() || '0'),
          strengthOfSchedule: parseFloat(cells[12]?.textContent?.trim() || '0'),
          sosRank: parseInt(cells[13]?.textContent?.trim() || '0'),
          opponentAdjO: parseFloat(cells[14]?.textContent?.trim() || '0'),
          opponentAdjD: parseFloat(cells[15]?.textContent?.trim() || '0')
        })
      })

      return data
    })

    console.log(`[KenPom] Extracted ${teams.length} teams`)
    return teams
  }

  /**
   * Validate scraped data
   */
  protected validate(data: KenPomRawTeamStats[]): ValidationResult {
    const errors: string[] = []

    if (data.length === 0) {
      errors.push('No teams scraped from KenPom')
    }

    // Expect at least 350 D1 teams
    if (data.length < 350) {
      errors.push(`Only scraped ${data.length} teams, expected at least 350`)
    }

    // Validate efficiency ranges (KenPom scale)
    const invalidTeams = data.filter(team => {
      return (
        team.adjustedOffensiveEfficiency < 70 || team.adjustedOffensiveEfficiency > 140 ||
        team.adjustedDefensiveEfficiency < 70 || team.adjustedDefensiveEfficiency > 140 ||
        team.adjustedTempo < 55 || team.adjustedTempo > 85
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
  protected async transform(data: KenPomRawTeamStats[]): Promise<TeamStatsRecord[]> {
    await this.teamResolver.initializeCache()

    const records: TeamStatsRecord[] = []
    const errors: string[] = []

    for (const team of data) {
      try {
        const resolution = await this.teamResolver.resolveTeamId(
          team.teamName,
          'kenpom',
          { autoCreate: true }
        )

        if (resolution.wasCreated) {
          console.log(`[KenPom] Created new team: ${team.teamName}`)
        }

        const record: TeamStatsRecord = {
          team_id: resolution.teamId,
          season: this.currentSeason,
          games_played: team.wins + team.losses,
          wins: team.wins,
          losses: team.losses,
          offensive_efficiency: team.adjustedOffensiveEfficiency,
          defensive_efficiency: team.adjustedDefensiveEfficiency,
          tempo: team.adjustedTempo,
          strength_of_schedule: team.strengthOfSchedule,
          offensive_efficiency_rank: team.adjustedOffensiveRank,
          defensive_efficiency_rank: team.adjustedDefensiveRank,
          overall_rank: team.rank,
          strength_of_schedule_rank: team.sosRank,
          source: 'kenpom',
          source_url: 'https://kenpom.com/',
          raw_stats: {
            conference: team.conference,
            adjusted_efficiency_margin: team.adjustedEfficiencyMargin,
            adjusted_tempo_rank: team.adjustedTempoRank,
            luck: team.luck,
            opponent_adj_o: team.opponentAdjO,
            opponent_adj_d: team.opponentAdjD
          }
        }

        records.push(record)
      } catch (error) {
        errors.push(`Failed to transform ${team.teamName}: ${error}`)
      }
    }

    if (errors.length > 0) {
      console.warn(`[KenPom] Transform errors:`, errors.slice(0, 5))
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
