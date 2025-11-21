/**
 * Game Importer for Tournaments
 *
 * Associates scraped ESPN games with tournaments in our database.
 * Handles team matching, duplicate detection, and game creation/updates.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { TournamentGame } from './types';
import { matchTeam, saveEspnTeamId, type EspnTeamData } from './team-matcher';

/**
 * Result of importing games
 */
export interface ImportResult {
  success: boolean;
  gamesCreated: number;
  gamesUpdated: number;
  gamesSkipped: number;
  errors: Array<{
    game: Partial<TournamentGame>;
    error: string;
  }>;
  unmatchedTeams: Array<{
    espnTeam: EspnTeamData;
    gameName: string;
  }>;
}

/**
 * Import games into a tournament
 */
export async function importGamesToTournament(
  supabase: SupabaseClient,
  tournamentId: string,
  games: Partial<TournamentGame>[],
  options: {
    updateExisting?: boolean;
    matchThreshold?: number;
    dryRun?: boolean;
  } = {},
): Promise<ImportResult> {
  const { updateExisting = true, matchThreshold = 0.75, dryRun = false } = options;

  const result: ImportResult = {
    success: true,
    gamesCreated: 0,
    gamesUpdated: 0,
    gamesSkipped: 0,
    errors: [],
    unmatchedTeams: [],
  };

  // Verify tournament exists
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    result.success = false;
    result.errors.push({
      game: {},
      error: `Tournament not found: ${tournamentId}`,
    });
    return result;
  }

  for (const game of games) {
    try {
      // Extract ESPN team data (these are temporary fields we added during scraping)
      const espnHomeTeam = (game as any)._espn_home_team as EspnTeamData | undefined;
      const espnAwayTeam = (game as any)._espn_away_team as EspnTeamData | undefined;

      if (!espnHomeTeam || !espnAwayTeam) {
        result.errors.push({
          game,
          error: 'Missing ESPN team data',
        });
        continue;
      }

      // Match teams
      const homeMatch = await matchTeam(supabase, espnHomeTeam, matchThreshold);
      const awayMatch = await matchTeam(supabase, espnAwayTeam, matchThreshold);

      if (!homeMatch) {
        result.unmatchedTeams.push({
          espnTeam: espnHomeTeam,
          gameName: `${espnHomeTeam.name} vs ${espnAwayTeam.name}`,
        });
      }

      if (!awayMatch) {
        result.unmatchedTeams.push({
          espnTeam: espnAwayTeam,
          gameName: `${espnHomeTeam.name} vs ${espnAwayTeam.name}`,
        });
      }

      if (!homeMatch || !awayMatch) {
        result.gamesSkipped++;
        continue;
      }

      // Save ESPN IDs if confidence is high
      if (homeMatch.confidence >= 0.9) {
        await saveEspnTeamId(supabase, homeMatch.teamId, espnHomeTeam.id);
      }
      if (awayMatch.confidence >= 0.9) {
        await saveEspnTeamId(supabase, awayMatch.teamId, espnAwayTeam.id);
      }

      // Check if game already exists by external_id
      if (game.external_id && game.external_source) {
        const { data: existingGame } = await supabase
          .from('games')
          .select('id')
          .eq('external_id', game.external_id)
          .eq('external_source', game.external_source)
          .single();

        if (existingGame) {
          if (updateExisting && !dryRun) {
            // Update existing game
            const { error: updateError } = await supabase
              .from('games')
              .update({
                tournament_id: tournamentId,
                tournament_round: game.tournament_round,
                tournament_metadata: game.tournament_metadata,
                home_score: game.home_score,
                away_score: game.away_score,
                status: game.status,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingGame.id);

            if (updateError) {
              result.errors.push({
                game,
                error: `Failed to update game: ${updateError.message}`,
              });
            } else {
              result.gamesUpdated++;
            }
          } else {
            result.gamesSkipped++;
          }
          continue;
        }
      }

      // Create new game
      if (!dryRun) {
        // Get conference_id from one of the teams (assuming both are in same conference for now)
        const { data: teamData } = await supabase
          .from('teams')
          .select('conference_id')
          .eq('id', homeMatch.teamId)
          .single();

        const gameData = {
          tournament_id: tournamentId,
          tournament_round: game.tournament_round,
          tournament_metadata: game.tournament_metadata,
          home_team_id: homeMatch.teamId,
          away_team_id: awayMatch.teamId,
          game_date: game.game_date,
          status: game.status || 'scheduled',
          home_score: game.home_score,
          away_score: game.away_score,
          venue: game.venue,
          external_id: game.external_id,
          external_source: game.external_source,
          conference_id: teamData?.conference_id || null,
        };

        const { error: createError } = await supabase.from('games').insert(gameData);

        if (createError) {
          result.errors.push({
            game,
            error: `Failed to create game: ${createError.message}`,
          });
        } else {
          result.gamesCreated++;
        }
      } else {
        result.gamesCreated++;
      }
    } catch (error) {
      result.errors.push({
        game,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  result.success = result.errors.length === 0;

  return result;
}

/**
 * Import NCAA Tournament games for a specific year
 */
export async function importNCAATournament(
  supabase: SupabaseClient,
  year: number,
  options?: {
    updateExisting?: boolean;
    matchThreshold?: number;
    dryRun?: boolean;
  },
): Promise<ImportResult> {
  // Lazy import to avoid circular dependencies
  const { fetchNCAATournamentGames } = await import('./espn-scraper');

  // Find or create NCAA tournament
  const { data: existingTournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('type', 'ncaa')
    .eq('year', year)
    .single();

  let tournamentId: string;

  if (existingTournament) {
    tournamentId = existingTournament.id;
  } else {
    // Create tournament
    const { data: newTournament, error: createError } = await supabase
      .from('tournaments')
      .insert({
        name: `${year} NCAA Tournament`,
        type: 'ncaa',
        year,
        start_date: `${year}-03-15`,
        end_date: `${year}-04-10`,
        status: 'in_progress',
        metadata: {
          regions: ['East', 'West', 'South', 'Midwest'],
          total_teams: 68,
        },
        external_source: 'espn',
      })
      .select('id')
      .single();

    if (createError || !newTournament) {
      return {
        success: false,
        gamesCreated: 0,
        gamesUpdated: 0,
        gamesSkipped: 0,
        errors: [{ game: {}, error: `Failed to create tournament: ${createError?.message}` }],
        unmatchedTeams: [],
      };
    }

    tournamentId = newTournament.id;
  }

  // Fetch games from ESPN
  const games = await fetchNCAATournamentGames(year);

  // Import games
  return importGamesToTournament(supabase, tournamentId, games, options);
}

/**
 * Import Conference Tournament games
 */
export async function importConferenceTournament(
  supabase: SupabaseClient,
  conferenceId: string,
  conferenceName: string,
  year: number,
  startDate: string, // YYYYMMDD
  endDate: string, // YYYYMMDD
  options?: {
    updateExisting?: boolean;
    matchThreshold?: number;
    dryRun?: boolean;
  },
): Promise<ImportResult> {
  const { fetchConferenceTournamentGames } = await import('./espn-scraper');

  // Find or create conference tournament
  const { data: existingTournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('type', 'conference')
    .eq('year', year)
    .eq('metadata->>conference_id', conferenceId)
    .single();

  let tournamentId: string;

  if (existingTournament) {
    tournamentId = existingTournament.id;
  } else {
    // Create tournament
    const startDateFormatted = `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`;
    const endDateFormatted = `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`;

    const { data: newTournament, error: createError } = await supabase
      .from('tournaments')
      .insert({
        name: `${year} ${conferenceName} Tournament`,
        type: 'conference',
        year,
        start_date: startDateFormatted,
        end_date: endDateFormatted,
        status: 'upcoming',
        metadata: {
          conference_id: conferenceId,
          conference_name: conferenceName,
        },
        external_source: 'espn',
      })
      .select('id')
      .single();

    if (createError || !newTournament) {
      return {
        success: false,
        gamesCreated: 0,
        gamesUpdated: 0,
        gamesSkipped: 0,
        errors: [{ game: {}, error: `Failed to create tournament: ${createError?.message}` }],
        unmatchedTeams: [],
      };
    }

    tournamentId = newTournament.id;
  }

  // Fetch games from ESPN
  const games = await fetchConferenceTournamentGames(conferenceId, year, startDate, endDate);

  // Import games
  return importGamesToTournament(supabase, tournamentId, games, options);
}

/**
 * Import MTE games
 */
export async function importMTE(
  supabase: SupabaseClient,
  eventName: string,
  year: number,
  startDate: string, // YYYYMMDD
  endDate: string, // YYYYMMDD
  location?: string,
  options?: {
    updateExisting?: boolean;
    matchThreshold?: number;
    dryRun?: boolean;
  },
): Promise<ImportResult> {
  const { fetchMTEGames } = await import('./espn-scraper');

  // Find or create MTE
  const { data: existingTournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('type', 'mte')
    .eq('year', year)
    .ilike('name', `%${eventName}%`)
    .single();

  let tournamentId: string;

  if (existingTournament) {
    tournamentId = existingTournament.id;
  } else {
    // Create tournament
    const startDateFormatted = `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`;
    const endDateFormatted = `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`;

    const { data: newTournament, error: createError } = await supabase
      .from('tournaments')
      .insert({
        name: eventName,
        type: 'mte',
        year,
        start_date: startDateFormatted,
        end_date: endDateFormatted,
        location,
        status: 'upcoming',
        metadata: {
          format: 'single_elimination',
        },
        external_source: 'espn',
      })
      .select('id')
      .single();

    if (createError || !newTournament) {
      return {
        success: false,
        gamesCreated: 0,
        gamesUpdated: 0,
        gamesSkipped: 0,
        errors: [{ game: {}, error: `Failed to create tournament: ${createError?.message}` }],
        unmatchedTeams: [],
      };
    }

    tournamentId = newTournament.id;
  }

  // Fetch games from ESPN
  const games = await fetchMTEGames(eventName, startDate, endDate);

  // Import games
  return importGamesToTournament(supabase, tournamentId, games, options);
}
