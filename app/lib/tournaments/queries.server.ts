import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Tournament,
  TournamentGame,
  TournamentTeam,
  CreateTournamentInput,
  UpdateTournamentInput,
  Bracket,
  BracketRound,
} from './types';
import { sortRounds } from './types';

/**
 * Get all tournaments, optionally filtered by type or year
 */
export async function getTournaments(
  supabase: SupabaseClient,
  filters?: {
    type?: string;
    year?: number;
    status?: string;
  }
) {
  let query = supabase.from('tournaments').select('*').order('start_date', { ascending: false });

  if (filters?.type) {
    query = query.eq('type', filters.type);
  }
  if (filters?.year) {
    query = query.eq('year', filters.year);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch tournaments: ${error.message}`);
  }

  return data as Tournament[];
}

/**
 * Get a single tournament by ID
 */
export async function getTournament(supabase: SupabaseClient, tournamentId: string) {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch tournament: ${error.message}`);
  }

  return data as Tournament;
}

/**
 * Create a new tournament
 */
export async function createTournament(
  supabase: SupabaseClient,
  input: CreateTournamentInput
) {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name: input.name,
      type: input.type,
      year: input.year,
      start_date: input.start_date,
      end_date: input.end_date,
      location: input.location,
      metadata: input.metadata,
      external_id: input.external_id,
      external_source: input.external_source,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create tournament: ${error.message}`);
  }

  return data as Tournament;
}

/**
 * Update a tournament
 */
export async function updateTournament(
  supabase: SupabaseClient,
  input: UpdateTournamentInput
) {
  const { id, ...updates } = input;

  const { data, error } = await supabase
    .from('tournaments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update tournament: ${error.message}`);
  }

  return data as Tournament;
}

/**
 * Delete a tournament
 */
export async function deleteTournament(supabase: SupabaseClient, tournamentId: string) {
  const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId);

  if (error) {
    throw new Error(`Failed to delete tournament: ${error.message}`);
  }
}

/**
 * Get all games for a tournament
 */
export async function getTournamentGames(supabase: SupabaseClient, tournamentId: string) {
  const { data, error } = await supabase
    .from('games')
    .select(
      `
      *,
      home_team:teams!games_home_team_id_fkey (
        id,
        name,
        short_name
      ),
      away_team:teams!games_away_team_id_fkey (
        id,
        name,
        short_name
      )
    `
    )
    .eq('tournament_id', tournamentId)
    .order('game_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch tournament games: ${error.message}`);
  }

  return data as TournamentGame[];
}

/**
 * Get tournament teams with seeding information
 */
export async function getTournamentTeams(supabase: SupabaseClient, tournamentId: string) {
  const { data, error } = await supabase
    .from('tournament_teams')
    .select(
      `
      *,
      team:teams (
        id,
        name,
        short_name,
        conference_id
      )
    `
    )
    .eq('tournament_id', tournamentId)
    .order('seed', { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to fetch tournament teams: ${error.message}`);
  }

  return data as (TournamentTeam & { team: { id: string; name: string; short_name: string } })[];
}

/**
 * Add a team to a tournament
 */
export async function addTournamentTeam(
  supabase: SupabaseClient,
  tournamentId: string,
  teamId: string,
  seed?: number,
  region?: string
) {
  const { data, error } = await supabase
    .from('tournament_teams')
    .insert({
      tournament_id: tournamentId,
      team_id: teamId,
      seed,
      region,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add team to tournament: ${error.message}`);
  }

  return data as TournamentTeam;
}

/**
 * Get bracket structure using the database function
 */
export async function getTournamentBracket(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<Bracket> {
  // First get the tournament
  const tournament = await getTournament(supabase, tournamentId);

  // Use the database function to get structured bracket data
  const { data, error } = await supabase.rpc('get_tournament_bracket', {
    tournament_uuid: tournamentId,
  });

  if (error) {
    throw new Error(`Failed to fetch tournament bracket: ${error.message}`);
  }

  // Transform the data into our Bracket structure
  const rounds: BracketRound[] = (data || []).map((row: { round: string; region: string; games: TournamentGame[] }) => ({
    round: row.round,
    region: row.region || undefined,
    games: row.games,
  }));

  // Sort rounds by tournament order
  const sortedRounds = sortRounds(rounds);

  // Group by region for NCAA tournaments
  const regions: Record<string, BracketRound[]> = {};
  if (tournament.type === 'ncaa') {
    sortedRounds.forEach((round) => {
      if (round.region) {
        if (!regions[round.region]) {
          regions[round.region] = [];
        }
        regions[round.region].push(round);
      }
    });
  }

  return {
    tournament,
    rounds: sortedRounds,
    regions: Object.keys(regions).length > 0 ? regions : undefined,
  };
}

/**
 * Get active tournaments (in progress)
 */
export async function getActiveTournaments(supabase: SupabaseClient) {
  return getTournaments(supabase, { status: 'in_progress' });
}

/**
 * Get upcoming tournaments
 */
export async function getUpcomingTournaments(supabase: SupabaseClient) {
  return getTournaments(supabase, { status: 'upcoming' });
}

/**
 * Get current year's tournaments
 */
export async function getCurrentYearTournaments(supabase: SupabaseClient) {
  const currentYear = new Date().getFullYear();
  return getTournaments(supabase, { year: currentYear });
}

/**
 * Search tournaments by name
 */
export async function searchTournaments(supabase: SupabaseClient, searchTerm: string) {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('name', `%${searchTerm}%`)
    .order('start_date', { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`Failed to search tournaments: ${error.message}`);
  }

  return data as Tournament[];
}
