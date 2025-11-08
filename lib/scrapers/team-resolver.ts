import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeTeamName } from '../../inngest/functions/team-mapping'

export interface Team {
  id: string
  name: string
  short_name: string
  conference_id: string
  external_ids: Record<string, string>
}

export interface TeamResolutionResult {
  teamId: string
  wasCreated: boolean
  confidence: 'exact' | 'fuzzy' | 'created'
}

/**
 * Enhanced team ID resolution system
 * Supports multiple data sources and fuzzy matching
 */
export class TeamResolver {
  private supabase: SupabaseClient
  private teamsCache: Map<string, Team> = new Map()
  private cacheInitialized: boolean = false

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Initialize the teams cache
   * Call this once at the start of a scraping job to avoid N+1 queries
   */
  async initializeCache(): Promise<void> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('id, name, short_name, conference_id, external_ids')

    if (error) {
      throw new Error(`Failed to load teams cache: ${error.message}`)
    }

    this.teamsCache.clear()
    data?.forEach(team => {
      this.teamsCache.set(team.id, team)
    })

    this.cacheInitialized = true
    console.log(`TeamResolver: Cached ${this.teamsCache.size} teams`)
  }

  /**
   * Resolve a team ID from external source identifier
   */
  async resolveTeamId(
    teamName: string,
    source: string,
    options?: {
      autoCreate?: boolean
      conferenceId?: string
    }
  ): Promise<TeamResolutionResult> {
    if (!this.cacheInitialized) {
      await this.initializeCache()
    }

    // Normalize the team name first
    const normalizedName = normalizeTeamName(teamName)

    // Step 1: Try exact match by external_id for this source
    const exactMatch = this.findByExternalId(source, teamName)
    if (exactMatch) {
      return {
        teamId: exactMatch.id,
        wasCreated: false,
        confidence: 'exact'
      }
    }

    // Step 2: Try exact match by normalized name
    const nameMatch = this.findByName(normalizedName)
    if (nameMatch) {
      // Update external_ids to include this source
      await this.updateExternalId(nameMatch.id, source, teamName)
      return {
        teamId: nameMatch.id,
        wasCreated: false,
        confidence: 'exact'
      }
    }

    // Step 3: Try fuzzy matching
    const fuzzyMatch = this.fuzzyMatch(normalizedName)
    if (fuzzyMatch) {
      console.log(`TeamResolver: Fuzzy matched "${normalizedName}" to "${fuzzyMatch.name}"`)
      // Update external_ids for this fuzzy match
      await this.updateExternalId(fuzzyMatch.id, source, teamName)
      return {
        teamId: fuzzyMatch.id,
        wasCreated: false,
        confidence: 'fuzzy'
      }
    }

    // Step 4: Create new team if auto-create is enabled
    if (options?.autoCreate) {
      const newTeam = await this.createTeam(
        normalizedName,
        source,
        teamName,
        options.conferenceId
      )
      return {
        teamId: newTeam.id,
        wasCreated: true,
        confidence: 'created'
      }
    }

    throw new Error(
      `Could not resolve team: "${teamName}" (normalized: "${normalizedName}") from source "${source}"`
    )
  }

  /**
   * Batch resolve multiple teams
   * More efficient than calling resolveTeamId multiple times
   */
  async resolveTeamIds(
    teams: Array<{ name: string; source: string }>,
    options?: {
      autoCreate?: boolean
      conferenceId?: string
    }
  ): Promise<Map<string, TeamResolutionResult>> {
    if (!this.cacheInitialized) {
      await this.initializeCache()
    }

    const results = new Map<string, TeamResolutionResult>()

    for (const team of teams) {
      const key = `${team.source}:${team.name}`
      try {
        const result = await this.resolveTeamId(team.name, team.source, options)
        results.set(key, result)
      } catch (error) {
        console.error(`Failed to resolve team ${team.name}:`, error)
      }
    }

    return results
  }

  /**
   * Find team by external ID from a specific source
   */
  private findByExternalId(source: string, externalId: string): Team | undefined {
    for (const team of this.teamsCache.values()) {
      if (team.external_ids?.[source] === externalId) {
        return team
      }
    }
    return undefined
  }

  /**
   * Find team by exact name match
   */
  private findByName(name: string): Team | undefined {
    for (const team of this.teamsCache.values()) {
      if (team.name.toLowerCase() === name.toLowerCase()) {
        return team
      }
    }
    return undefined
  }

  /**
   * Fuzzy match team name using similarity scoring
   */
  private fuzzyMatch(name: string, threshold: number = 0.85): Team | undefined {
    let bestMatch: Team | undefined
    let bestScore = 0

    for (const team of this.teamsCache.values()) {
      const score = this.calculateSimilarity(name.toLowerCase(), team.name.toLowerCase())
      if (score > threshold && score > bestScore) {
        bestScore = score
        bestMatch = team
      }
    }

    return bestMatch
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Update external_ids for a team
   */
  private async updateExternalId(
    teamId: string,
    source: string,
    externalId: string
  ): Promise<void> {
    const team = this.teamsCache.get(teamId)
    if (!team) return

    const updatedExternalIds = {
      ...team.external_ids,
      [source]: externalId
    }

    const { error } = await this.supabase
      .from('teams')
      .update({ external_ids: updatedExternalIds })
      .eq('id', teamId)

    if (error) {
      console.error(`Failed to update external_ids for team ${teamId}:`, error)
    } else {
      // Update cache
      team.external_ids = updatedExternalIds
      console.log(`TeamResolver: Updated external_ids for ${team.name}: ${source} = ${externalId}`)
    }
  }

  /**
   * Create a new team
   */
  private async createTeam(
    name: string,
    source: string,
    externalId: string,
    conferenceId?: string
  ): Promise<Team> {
    // Get or use Independent conference
    let confId = conferenceId
    if (!confId) {
      const { data } = await this.supabase
        .from('conferences')
        .select('id')
        .eq('short_name', 'IND')
        .single()

      if (!data) {
        throw new Error('Independent conference not found. Run seed data.')
      }
      confId = data.id
    }

    const shortName = this.generateShortName(name)

    const { data, error } = await this.supabase
      .from('teams')
      .insert({
        name,
        short_name: shortName,
        conference_id: confId,
        external_ids: { [source]: externalId }
      })
      .select('id, name, short_name, conference_id, external_ids')
      .single()

    if (error) {
      // Handle race condition - another process might have created it
      if (error.code === '23505') {
        const existing = this.findByName(name)
        if (existing) {
          await this.updateExternalId(existing.id, source, externalId)
          return existing
        }
      }
      throw new Error(`Failed to create team: ${error.message}`)
    }

    const newTeam = data as Team
    this.teamsCache.set(newTeam.id, newTeam)
    console.log(`TeamResolver: Created new team "${name}" from ${source}`)

    return newTeam
  }

  /**
   * Generate a short name from full name
   */
  private generateShortName(fullName: string): string {
    // If it's already short (e.g., "UAB", "UConn"), use it as is
    if (fullName.length <= 5 && fullName === fullName.toUpperCase()) {
      return fullName
    }

    const words = fullName.split(' ')

    // For multi-word names, create an acronym
    if (words.length >= 2) {
      return words.map(w => w[0]).join('').toUpperCase().slice(0, 5)
    }

    // For single words, truncate to 5 chars
    return fullName.slice(0, 5).toUpperCase()
  }

  /**
   * Get team by ID from cache
   */
  getTeamById(teamId: string): Team | undefined {
    return this.teamsCache.get(teamId)
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.teamsCache.clear()
    this.cacheInitialized = false
  }
}
