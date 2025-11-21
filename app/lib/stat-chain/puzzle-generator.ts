// AI-Powered Puzzle Generator for Stat Chain Connections

import type { SupabaseClient } from '@supabase/supabase-js'
import { Anthropic } from '@anthropic-ai/sdk'
import { StatsAggregator, type TeamWithStats } from './stats-aggregator'
import type { GroupDTO } from './types'

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'expert'] as const
type Difficulty = (typeof DIFFICULTY_ORDER)[number]

type GeneratedGroup = {
  difficulty: Difficulty
  title: string
  explanation: string
  teamIds: string[]
}

type PuzzleGenerationResult = {
  success: boolean
  groups?: GeneratedGroup[]
  error?: string
  reasoning?: string
}

export class PuzzleGenerator {
  private anthropic: Anthropic
  private statsAggregator: StatsAggregator

  constructor(private supabase: SupabaseClient, apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required')
    }
    this.anthropic = new Anthropic({ apiKey: key })
    this.statsAggregator = new StatsAggregator(supabase)
  }

  /**
   * Generate a complete daily puzzle with 4 groups of 3 teams
   */
  async generatePuzzle(season?: number): Promise<PuzzleGenerationResult> {
    try {
      // Get all teams with comprehensive statistics
      const allTeams = await this.statsAggregator.getAllTeamsWithStats(season)

      if (allTeams.length < 12) {
        return {
          success: false,
          error: 'Not enough teams with statistics available',
        }
      }

      // Generate puzzle using AI
      const result = await this.generateWithAI(allTeams)

      if (!result.success || !result.groups) {
        return result
      }

      // Validate the puzzle
      const validation = this.validatePuzzle(result.groups, allTeams)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        }
      }

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Use Claude to generate creative connections
   */
  private async generateWithAI(teams: TeamWithStats[]): Promise<PuzzleGenerationResult> {
    const prompt = this.buildPrompt(teams)

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        temperature: 1,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const content = message.content[0]
      if (content.type !== 'text') {
        return {
          success: false,
          error: 'Unexpected response type from AI',
        }
      }

      // Parse the AI response
      const parsed = this.parseAIResponse(content.text)
      return parsed
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI generation failed',
      }
    }
  }

  /**
   * Build comprehensive prompt for AI
   */
  private buildPrompt(teams: TeamWithStats[]): string {
    // Format team data for AI
    const teamsData = teams
      .map((team, idx) => {
        return `
Team ${idx + 1}: ${team.name} (${team.shortName})
  Conference: ${team.conference}
  Record: ${team.stats.wins || 0}-${team.stats.losses || 0}
  KenPom Rank: ${team.stats.kenpomRank || 'N/A'}
  Offensive Efficiency: ${team.stats.offensiveEfficiency?.toFixed(1) || 'N/A'}
  Defensive Efficiency: ${team.stats.defensiveEfficiency?.toFixed(1) || 'N/A'}
  Tempo: ${team.stats.tempo?.toFixed(1) || 'N/A'}
  PPG: ${team.stats.pointsPerGame?.toFixed(1) || 'N/A'}
  FG%: ${team.stats.fieldGoalPct ? (team.stats.fieldGoalPct * 100).toFixed(1) + '%' : 'N/A'}
  3P%: ${team.stats.threePointPct ? (team.stats.threePointPct * 100).toFixed(1) + '%' : 'N/A'}
  APG: ${team.stats.assistsPerGame?.toFixed(1) || 'N/A'}
  RPG: ${team.stats.reboundsPerGame?.toFixed(1) || 'N/A'}
  TPG: ${team.stats.turnoversPerGame?.toFixed(1) || 'N/A'}
  Strength of Schedule: ${team.stats.strengthOfSchedule?.toFixed(2) || 'N/A'}
`.trim()
      })
      .join('\n\n')

    return `You are creating a daily puzzle game similar to NYT Connections, but for college basketball teams.

Your task: Select 12 teams from the list below and organize them into 4 groups of exactly 3 teams each. Each group must share a meaningful statistical or categorical connection.

DIFFICULTY LEVELS (you must create exactly one of each):

1. EASY (Yellow): Obvious connections that basketball fans would immediately recognize
   - Examples: Same conference, top-ranked teams, similar mascot types, geographic region

2. MEDIUM (Green): Requires some knowledge of team performance
   - Examples: Similar offensive efficiency, high tempo teams, strong defensive teams, similar win percentages

3. HARD (Blue): Requires deeper statistical analysis
   - Examples: Similar strength of schedule, comparable assist-to-turnover ratios, balanced offensive/defensive metrics

4. EXPERT (Purple): Subtle, non-obvious connections requiring careful analysis
   - Examples: Teams with similar efficiency margins but different tempos, teams with unusual statistical profiles, counterintuitive patterns

REQUIREMENTS:
- Use exactly 12 teams total (3 teams per group × 4 groups)
- Each team can only appear in ONE group
- Connections must be factually accurate based on the provided statistics
- Difficulty progression should be clear (easy → medium → hard → expert)
- Avoid ambiguous connections where teams could fit multiple groups
- Prefer interesting, creative connections over generic ones
- Each group must have a clear, concise title (max 6 words)
- Each group must have a detailed explanation (2-3 sentences) that proves the connection

AVAILABLE TEAMS:
${teamsData}

Respond with ONLY a valid JSON object in this exact format:
{
  "groups": [
    {
      "difficulty": "easy",
      "title": "Short descriptive title",
      "explanation": "Detailed explanation of the connection and why these teams belong together.",
      "teamNames": ["Team Name 1", "Team Name 2", "Team Name 3"]
    },
    {
      "difficulty": "medium",
      "title": "Short descriptive title",
      "explanation": "Detailed explanation of the connection and why these teams belong together.",
      "teamNames": ["Team Name 4", "Team Name 5", "Team Name 6"]
    },
    {
      "difficulty": "hard",
      "title": "Short descriptive title",
      "explanation": "Detailed explanation of the connection and why these teams belong together.",
      "teamNames": ["Team Name 7", "Team Name 8", "Team Name 9"]
    },
    {
      "difficulty": "expert",
      "title": "Short descriptive title",
      "explanation": "Detailed explanation of the connection and why these teams belong together.",
      "teamNames": ["Team Name 10", "Team Name 11", "Team Name 12"]
    }
  ],
  "reasoning": "Brief explanation of your overall puzzle design strategy and why you chose these specific connections."
}

CRITICAL: Use the EXACT team names as provided above. Double-check that you use exactly 12 different teams with no duplicates.`
  }

  /**
   * Parse AI response and map to team IDs
   */
  private parseAIResponse(response: string): PuzzleGenerationResult {
    try {
      // Extract JSON from response (AI might add explanation text)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return {
          success: false,
          error: 'Could not find JSON in AI response',
        }
      }

      const parsed = JSON.parse(jsonMatch[0])

      if (!parsed.groups || !Array.isArray(parsed.groups) || parsed.groups.length !== 4) {
        return {
          success: false,
          error: 'Invalid response structure: expected 4 groups',
        }
      }

      // Map team names to IDs
      const groups: GeneratedGroup[] = []

      for (const group of parsed.groups) {
        if (!group.teamNames || group.teamNames.length !== 3) {
          return {
            success: false,
            error: `Group "${group.title}" must have exactly 3 teams`,
          }
        }

        groups.push({
          difficulty: group.difficulty,
          title: group.title,
          explanation: group.explanation,
          teamIds: group.teamNames, // Will be resolved later
        })
      }

      return {
        success: true,
        groups,
        reasoning: parsed.reasoning,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse AI response',
      }
    }
  }

  /**
   * Validate puzzle meets all requirements
   */
  private validatePuzzle(
    groups: GeneratedGroup[],
    allTeams: TeamWithStats[]
  ): { valid: boolean; error?: string } {
    // Check we have exactly 4 groups
    if (groups.length !== 4) {
      return { valid: false, error: `Expected 4 groups, got ${groups.length}` }
    }

    // Check each difficulty appears exactly once
    const difficulties = groups.map((g) => g.difficulty)
    for (const diff of DIFFICULTY_ORDER) {
      if (!difficulties.includes(diff)) {
        return { valid: false, error: `Missing difficulty: ${diff}` }
      }
    }

    // Check exactly 3 teams per group
    for (const group of groups) {
      if (group.teamIds.length !== 3) {
        return { valid: false, error: `Group "${group.title}" has ${group.teamIds.length} teams, expected 3` }
      }
    }

    // Check no duplicate teams
    const allTeamIds = groups.flatMap((g) => g.teamIds)
    const uniqueTeamIds = new Set(allTeamIds)
    if (uniqueTeamIds.size !== 12) {
      return { valid: false, error: 'Duplicate teams found across groups' }
    }

    // Check all teams exist
    const teamMap = new Map(allTeams.map((t) => [t.name, t.id]))
    for (const teamName of allTeamIds) {
      if (!teamMap.has(teamName)) {
        return { valid: false, error: `Unknown team: ${teamName}` }
      }
    }

    return { valid: true }
  }

  /**
   * Save generated puzzle to database
   */
  async savePuzzle(
    groups: GeneratedGroup[],
    puzzleDate: string
  ): Promise<{ success: boolean; puzzleId?: string; error?: string }> {
    try {
      // Resolve team names to IDs
      const allTeamNames = groups.flatMap((g) => g.teamIds)
      const { data: teams, error: teamsError } = await this.supabase
        .from('teams')
        .select('id, name')
        .in('name', allTeamNames)

      if (teamsError) {
        return { success: false, error: teamsError.message }
      }

      const teamMap = new Map(teams?.map((t) => [t.name, t.id]) || [])

      // Create puzzle
      const { data: puzzle, error: puzzleError } = await this.supabase
        .from('stat_chain_puzzles')
        .insert({ puzzle_date: puzzleDate })
        .select()
        .single()

      if (puzzleError) {
        return { success: false, error: puzzleError.message }
      }

      // Create groups
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i]
        const { data: dbGroup, error: groupError } = await this.supabase
          .from('stat_chain_groups')
          .insert({
            puzzle_id: puzzle.id,
            group_order: i + 1,
            difficulty: group.difficulty,
            connection_title: group.title,
            connection_explanation: group.explanation,
          })
          .select()
          .single()

        if (groupError) {
          return { success: false, error: groupError.message }
        }

        // Create team associations
        const teamLinks = group.teamIds.map((teamName) => ({
          group_id: dbGroup.id,
          team_id: teamMap.get(teamName)!,
        }))

        const { error: teamsError } = await this.supabase
          .from('stat_chain_teams')
          .insert(teamLinks)

        if (teamsError) {
          return { success: false, error: teamsError.message }
        }
      }

      return { success: true, puzzleId: puzzle.id }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
