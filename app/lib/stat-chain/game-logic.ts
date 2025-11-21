// Stat Chain Connections - Game Logic
// Core game rules and validation functions

import type { GroupDTO, MAX_MISTAKES, TEAMS_PER_GROUP } from './types'

// ============================================================================
// GUESS VALIDATION
// ============================================================================

/**
 * Check if a guess matches any unsolved group
 * @param teamIds - Array of team IDs being guessed
 * @param groups - All groups in the puzzle
 * @param solvedGroupIds - IDs of already solved groups
 * @returns Object with correct flag and matched group if found
 */
export function checkGuess(
  teamIds: string[],
  groups: GroupDTO[],
  solvedGroupIds: string[]
): { correct: boolean; matchedGroup: GroupDTO | null } {
  // Validate input
  if (teamIds.length !== 3) {
    return { correct: false, matchedGroup: null }
  }

  // Sort for consistent comparison
  const sortedGuess = [...teamIds].sort()

  // Check each unsolved group
  for (const group of groups) {
    // Skip already solved groups
    if (solvedGroupIds.includes(group.id)) {
      continue
    }

    // Get team IDs from this group
    const groupTeamIds = group.teams.map((t) => t.id).sort()

    // Check if guess matches this group
    if (
      groupTeamIds.length === sortedGuess.length &&
      groupTeamIds.every((id, index) => id === sortedGuess[index])
    ) {
      return { correct: true, matchedGroup: group }
    }
  }

  return { correct: false, matchedGroup: null }
}

// ============================================================================
// GAME STATE
// ============================================================================

/**
 * Determine if the game is complete
 * @param solvedGroupsCount - Number of groups solved
 * @param mistakes - Number of mistakes made
 * @param maxMistakes - Maximum allowed mistakes (default: 4)
 * @returns Object with completion status and win/loss result
 */
export function isGameComplete(
  solvedGroupsCount: number,
  mistakes: number,
  maxMistakes: number = 4
): { complete: boolean; won: boolean } {
  const allSolved = solvedGroupsCount === 4
  const tooManyMistakes = mistakes >= maxMistakes

  return {
    complete: allSolved || tooManyMistakes,
    won: allSolved && mistakes < maxMistakes,
  }
}

/**
 * Calculate mistakes remaining
 * @param currentMistakes - Current number of mistakes
 * @param maxMistakes - Maximum allowed mistakes
 * @returns Number of mistakes remaining
 */
export function getMistakesRemaining(
  currentMistakes: number,
  maxMistakes: number = 4
): number {
  return Math.max(0, maxMistakes - currentMistakes)
}

// ============================================================================
// TEAM SHUFFLING
// ============================================================================

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param array - Array to shuffle
 * @returns New shuffled array
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Shuffle teams deterministically based on a seed
 * Useful for consistent shuffling per user/session
 * @param array - Array to shuffle
 * @param seed - Seed string for deterministic shuffling
 * @returns New shuffled array
 */
export function shuffleArrayWithSeed<T>(array: T[], seed: string): T[] {
  // Simple seeded random number generator
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }

  const seededRandom = () => {
    hash = (hash * 9301 + 49297) % 233280
    return hash / 233280
  }

  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate team selection
 * @param selectedTeams - Array of selected team IDs
 * @param availableTeams - Array of team IDs available for selection
 * @returns Validation result
 */
export function validateTeamSelection(
  selectedTeams: string[],
  availableTeams: string[]
): { valid: boolean; error?: string } {
  if (selectedTeams.length > 3) {
    return { valid: false, error: 'Cannot select more than 3 teams' }
  }

  // Check all selected teams are available
  const invalidTeams = selectedTeams.filter((id) => !availableTeams.includes(id))
  if (invalidTeams.length > 0) {
    return { valid: false, error: 'Selected teams are not available' }
  }

  // Check for duplicates
  const uniqueTeams = new Set(selectedTeams)
  if (uniqueTeams.size !== selectedTeams.length) {
    return { valid: false, error: 'Duplicate teams selected' }
  }

  return { valid: true }
}

/**
 * Get teams available for selection (not yet solved)
 * @param allTeams - All teams in the puzzle
 * @param solvedGroups - Groups that have been solved
 * @returns Array of available team IDs
 */
export function getAvailableTeams(
  allTeams: Array<{ id: string }>,
  solvedGroups: GroupDTO[]
): string[] {
  const solvedTeamIds = new Set(
    solvedGroups.flatMap((group) => group.teams.map((t) => t.id))
  )

  return allTeams.filter((team) => !solvedTeamIds.has(team.id)).map((t) => t.id)
}

// ============================================================================
// SHARE FUNCTIONALITY
// ============================================================================

/**
 * Generate shareable text result in NYT Connections style
 * @param date - Puzzle date
 * @param solvedGroups - Groups solved in order
 * @param mistakes - Number of mistakes made
 * @param maxMistakes - Maximum allowed mistakes
 * @returns Shareable text
 */
export function generateShareText(
  date: string,
  solvedGroups: GroupDTO[],
  mistakes: number,
  maxMistakes: number = 4
): string {
  const difficultyEmojis = {
    easy: '🟨',
    medium: '🟩',
    hard: '🟦',
    expert: '🟪',
  }

  const lines = solvedGroups.map((group) => {
    const emoji = difficultyEmojis[group.difficulty]
    return `${emoji}${emoji}${emoji} ✓`
  })

  return `College Hoops Connections
${date}
${lines.join('\n')}
Mistakes: ${mistakes}/${maxMistakes}

Play at: [Your App URL]`
}

// ============================================================================
// DIFFICULTY HELPERS
// ============================================================================

/**
 * Get difficulty level as number for sorting
 * @param difficulty - Difficulty string
 * @returns Number (1-4)
 */
export function getDifficultyLevel(difficulty: string): number {
  const levels = { easy: 1, medium: 2, hard: 3, expert: 4 }
  return levels[difficulty as keyof typeof levels] || 0
}

/**
 * Sort groups by difficulty (easy -> expert)
 * @param groups - Groups to sort
 * @returns Sorted groups
 */
export function sortGroupsByDifficulty(groups: GroupDTO[]): GroupDTO[] {
  return [...groups].sort((a, b) => getDifficultyLevel(a.difficulty) - getDifficultyLevel(b.difficulty))
}
