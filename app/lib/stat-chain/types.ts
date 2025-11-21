// Stat Chain Connections - TypeScript Types
// Defines all data types for the stat chain game feature

// ============================================================================
// DOMAIN MODELS (Database representation)
// ============================================================================

export type Team = {
  id: string
  name: string
  short_name: string
  logo_url: string | null
  conference_id: string
  external_id: string
  created_at: string
}

export type Puzzle = {
  id: string
  puzzle_date: string
  created_at: string
}

export type Group = {
  id: string
  puzzle_id: string
  group_order: number
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
  connection_title: string
  connection_explanation: string
}

export type GroupTeamAssignment = {
  id: string
  group_id: string
  team_id: string
}

export type Session = {
  id: string
  puzzle_id: string
  user_id: string
  started_at: string
  completed_at: string | null
  mistakes: number
  solved_groups: string[]
  guess_history: GuessHistoryEntry[]
}

// ============================================================================
// DATA TRANSFER OBJECTS (API representation)
// ============================================================================

export type TeamDTO = {
  id: string
  name: string
  shortName: string
  logoUrl: string | null
}

export type GroupDTO = {
  id: string
  order: number
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
  title: string
  explanation: string
  teams: TeamDTO[]
}

export type PuzzleDTO = {
  id: string
  date: string
  teams: TeamDTO[]
  groups: GroupDTO[]
}

export type SessionDTO = {
  id: string
  puzzleId: string
  mistakes: number
  maxMistakes: number
  solvedGroups: GroupDTO[]
  completed: boolean
  won: boolean
  completedAt: string | null
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type GuessHistoryEntry = {
  teamIds: string[]
  correct: boolean
  groupId?: string
  timestamp: string
}

export type GuessResult = {
  result: 'correct' | 'incorrect' | 'game_over'
  group?: GroupDTO
  mistakes: number
  gameCompleted: boolean
  won: boolean
}

export type DifficultyColor = {
  bg: string
  border: string
  text: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DIFFICULTY_COLORS: Record<string, DifficultyColor> = {
  easy: {
    bg: 'bg-yellow-100',
    border: 'border-yellow-500',
    text: 'text-yellow-800',
  },
  medium: {
    bg: 'bg-green-100',
    border: 'border-green-500',
    text: 'text-green-800',
  },
  hard: {
    bg: 'bg-blue-100',
    border: 'border-blue-500',
    text: 'text-blue-800',
  },
  expert: {
    bg: 'bg-purple-100',
    border: 'border-purple-500',
    text: 'text-purple-800',
  },
}

export const MAX_MISTAKES = 4
export const TEAMS_PER_GROUP = 3
export const GROUPS_PER_PUZZLE = 4
export const TOTAL_TEAMS = TEAMS_PER_GROUP * GROUPS_PER_PUZZLE

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isValidDifficulty(value: string): value is Group['difficulty'] {
  return ['easy', 'medium', 'hard', 'expert'].includes(value)
}

export function isValidGuess(teamIds: unknown): teamIds is string[] {
  return (
    Array.isArray(teamIds) &&
    teamIds.length === TEAMS_PER_GROUP &&
    teamIds.every((id) => typeof id === 'string')
  )
}

// ============================================================================
// ADMIN TYPES
// ============================================================================

export type CreatePuzzleRequest = {
  date: string
  groups: Array<{
    difficulty: Group['difficulty']
    connectionTitle: string
    connectionExplanation: string
    teamIds: string[]
  }>
}

export type PuzzleWithSolutionDTO = PuzzleDTO & {
  solution: GroupDTO[]
}

// ============================================================================
// LOCAL STORAGE TYPES
// ============================================================================

export type LocalGameState = {
  selectedTeams: string[]
  lastUpdated: string
}
