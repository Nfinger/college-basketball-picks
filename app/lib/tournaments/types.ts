// Tournament type definitions

export type TournamentType = 'mte' | 'conference' | 'ncaa';
export type TournamentStatus = 'upcoming' | 'in_progress' | 'completed';
export type NCAARegion = 'East' | 'West' | 'South' | 'Midwest';

// Standard NCAA tournament rounds
export type TournamentRound =
  | 'first_four'
  | 'round_of_64'
  | 'round_of_32'
  | 'sweet_16'
  | 'elite_8'
  | 'final_four'
  | 'championship'
  | string; // Allow custom rounds for MTEs/conference tournaments

// Base tournament interface
export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  year: number;
  status: TournamentStatus;
  start_date: string;
  end_date: string;
  location?: string;
  metadata: TournamentMetadata;
  external_id?: string;
  external_source?: string;
  created_at: string;
  updated_at: string;
}

// Tournament-specific metadata types
export type TournamentMetadata =
  | MTEMetadata
  | ConferenceTournamentMetadata
  | NCAATournamentMetadata
  | Record<string, unknown>;

export interface MTEMetadata {
  format: 'single_elimination' | 'multi_bracket';
  team_count: number;
  bracket_structure?: string;
}

export interface ConferenceTournamentMetadata {
  conference_id: string;
  conference_name: string;
  auto_bid: boolean;
  total_teams: number;
}

export interface NCAATournamentMetadata {
  regions: NCAARegion[];
  total_teams: number;
}

// Tournament team participation
export interface TournamentTeam {
  id: string;
  tournament_id: string;
  team_id: string;
  seed?: number;
  region?: NCAARegion | string;
  eliminated_in_round?: TournamentRound;
  created_at: string;
}

// Game tournament metadata
export interface GameTournamentMetadata {
  seed_home?: number;
  seed_away?: number;
  region?: NCAARegion | string;
  bracket_position?: string;
  next_game_id?: string;
}

// Extended game interface for tournament games
export interface TournamentGame {
  id: string;
  external_id?: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home_score?: number;
  away_score?: number;
  spread?: number;
  favorite_team_id?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';
  tournament_id: string;
  tournament_round: TournamentRound;
  tournament_metadata: GameTournamentMetadata;
  home_team?: {
    id: string;
    name: string;
    short_name: string;
  };
  away_team?: {
    id: string;
    name: string;
    short_name: string;
  };
}

// Bracket visualization structures
export interface BracketNode {
  game?: TournamentGame;
  winner?: {
    id: string;
    name: string;
    short_name: string;
    seed?: number;
  };
  round: TournamentRound;
  region?: NCAARegion | string;
  position: number;
  next_game_id?: string;
}

export interface BracketRound {
  round: TournamentRound;
  region?: NCAARegion | string;
  games: TournamentGame[];
}

export interface Bracket {
  tournament: Tournament;
  rounds: BracketRound[];
  regions?: Record<string, BracketRound[]>;
}

// Form/input types for creating tournaments
export interface CreateTournamentInput {
  name: string;
  type: TournamentType;
  year: number;
  start_date: string;
  end_date: string;
  location?: string;
  metadata: TournamentMetadata;
  external_id?: string;
  external_source?: string;
}

export interface UpdateTournamentInput extends Partial<CreateTournamentInput> {
  id: string;
  status?: TournamentStatus;
}

// Helper type guards
export function isMTEMetadata(metadata: TournamentMetadata): metadata is MTEMetadata {
  return 'format' in metadata && 'team_count' in metadata;
}

export function isConferenceTournamentMetadata(
  metadata: TournamentMetadata
): metadata is ConferenceTournamentMetadata {
  return 'conference_id' in metadata && 'auto_bid' in metadata;
}

export function isNCAATournamentMetadata(
  metadata: TournamentMetadata
): metadata is NCAATournamentMetadata {
  return 'regions' in metadata && Array.isArray(metadata.regions);
}

// Round ordering for sorting
export const TOURNAMENT_ROUND_ORDER: Record<string, number> = {
  first_four: 1,
  round_of_64: 2,
  round_of_32: 3,
  sweet_16: 4,
  elite_8: 5,
  final_four: 6,
  championship: 7,
};

// Round display names
export const TOURNAMENT_ROUND_NAMES: Record<string, string> = {
  first_four: 'First Four',
  round_of_64: 'Round of 64',
  round_of_32: 'Round of 32',
  sweet_16: 'Sweet 16',
  elite_8: 'Elite 8',
  final_four: 'Final Four',
  championship: 'Championship',
};

// Helper function to get round display name
export function getRoundDisplayName(round: TournamentRound): string {
  return TOURNAMENT_ROUND_NAMES[round] || round.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// Helper function to sort rounds
export function sortRounds(rounds: BracketRound[]): BracketRound[] {
  return [...rounds].sort((a, b) => {
    const orderA = TOURNAMENT_ROUND_ORDER[a.round] ?? 99;
    const orderB = TOURNAMENT_ROUND_ORDER[b.round] ?? 99;
    return orderA - orderB;
  });
}
