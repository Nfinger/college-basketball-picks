import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tournament Bracket Generator
 *
 * Creates the complete bracket structure (all 63 games) for an NCAA tournament.
 * Games are created as "shell" games with TBD teams that get filled in as the tournament progresses.
 *
 * Bracket Structure:
 * - Round 1 (Round of 64): 32 games across 4 regions
 * - Round 2 (Round of 32): 16 games across 4 regions
 * - Sweet 16: 8 games across 4 regions
 * - Elite 8: 4 games (regional finals)
 * - Final Four: 2 games (national semifinals)
 * - Championship: 1 game
 * Total: 63 games
 */

export interface RegionSeeds {
  [region: string]: {
    [seed: number]: string; // seed number -> team_id
  };
}

interface GameInsert {
  tournament_id: string;
  tournament_round: string;
  home_team_id: string | null;
  away_team_id: string | null;
  game_date?: string;
  status: string;
  tournament_metadata: {
    seed_home?: number;
    seed_away?: number;
    region: string;
    bracket_position: string;
    next_game_id?: string;
    winner_advances_to?: 'home' | 'away';
  };
}

interface CreatedGame {
  id: string;
  bracket_position: string;
  region: string;
  round: string;
}

/**
 * Creates all 63 tournament bracket games for an NCAA tournament
 */
export async function createTournamentBracketGames(
  supabase: SupabaseClient,
  tournamentId: string,
  seeds: RegionSeeds,
  tournamentStartDate?: string
) {
  const allGames: GameInsert[] = [];
  const gamesByPosition: Map<string, CreatedGame> = new Map();

  // Get tournament details for dates
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('start_date')
    .eq('id', tournamentId)
    .single();

  const startDate = tournamentStartDate || tournament?.start_date || new Date().toISOString().split('T')[0];

  // Process each region
  const regions = ['East', 'West', 'South', 'Midwest'];
  const regionalGames: { [region: string]: CreatedGame[][] } = {};

  for (const region of regions) {
    const regionSeeds = seeds[region] || {};

    // Round 1: 8 games per region
    const round1Games = createRound1Games(tournamentId, region, regionSeeds, startDate);

    // Round 2: 4 games per region (TBD teams)
    const round2Games = createRound2Games(tournamentId, region, startDate);

    // Sweet 16: 2 games per region (TBD teams)
    const sweet16Games = createSweet16Games(tournamentId, region, startDate);

    // Elite 8: 1 game per region (TBD teams)
    const elite8Games = createElite8Game(tournamentId, region, startDate);

    regionalGames[region] = [round1Games, round2Games, sweet16Games, elite8Games];
    allGames.push(...round1Games, ...round2Games, ...sweet16Games, ...elite8Games);
  }

  // Final Four: 2 games
  const finalFourGames = createFinalFourGames(tournamentId, startDate);
  allGames.push(...finalFourGames);

  // Championship: 1 game
  const championshipGame = createChampionshipGame(tournamentId, startDate);
  allGames.push(championshipGame);

  // Insert all games in one transaction
  const { data: insertedGames, error } = await supabase
    .from('games')
    .insert(allGames)
    .select('id, tournament_metadata');

  if (error) {
    console.error('Error creating tournament games:', error);
    return { games: null, error };
  }

  // Build map of bracket_position -> game_id
  for (const game of insertedGames || []) {
    const metadata = game.tournament_metadata as any;
    if (metadata?.bracket_position) {
      gamesByPosition.set(metadata.bracket_position, {
        id: game.id,
        bracket_position: metadata.bracket_position,
        region: metadata.region,
        round: metadata.round || 'unknown'
      });
    }
  }

  // Second pass: Update next_game_id references
  await linkBracketProgression(supabase, gamesByPosition, regions);

  return { games: insertedGames, error: null };
}

/**
 * Creates Round 1 games (Round of 64) for a region
 * Standard NCAA matchups: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
 */
function createRound1Games(
  tournamentId: string,
  region: string,
  seeds: { [seed: number]: string },
  startDate: string
): GameInsert[] {
  const matchups = [
    [1, 16], [8, 9], [5, 12], [4, 13],
    [6, 11], [3, 14], [7, 10], [2, 15]
  ];

  return matchups.map(([seed1, seed2], idx) => ({
    tournament_id: tournamentId,
    tournament_round: 'round_of_64',
    home_team_id: seeds[seed1] || null,
    away_team_id: seeds[seed2] || null,
    game_date: addDays(startDate, 0), // First day
    status: 'scheduled',
    tournament_metadata: {
      seed_home: seed1,
      seed_away: seed2,
      region,
      bracket_position: `${region[0]}-R1-G${idx + 1}`,
    }
  }));
}

/**
 * Creates Round 2 games (Round of 32) for a region
 * Winners of games 1-2, 3-4, 5-6, 7-8 advance
 */
function createRound2Games(
  tournamentId: string,
  region: string,
  startDate: string
): GameInsert[] {
  const games: GameInsert[] = [];

  for (let i = 0; i < 4; i++) {
    games.push({
      tournament_id: tournamentId,
      tournament_round: 'round_of_32',
      home_team_id: null, // TBD
      away_team_id: null, // TBD
      game_date: addDays(startDate, 2), // Two days later
      status: 'scheduled',
      tournament_metadata: {
        region,
        bracket_position: `${region[0]}-R2-G${i + 1}`,
      }
    });
  }

  return games;
}

/**
 * Creates Sweet 16 games for a region
 */
function createSweet16Games(
  tournamentId: string,
  region: string,
  startDate: string
): GameInsert[] {
  const games: GameInsert[] = [];

  for (let i = 0; i < 2; i++) {
    games.push({
      tournament_id: tournamentId,
      tournament_round: 'sweet_16',
      home_team_id: null, // TBD
      away_team_id: null, // TBD
      game_date: addDays(startDate, 4), // Four days later
      status: 'scheduled',
      tournament_metadata: {
        region,
        bracket_position: `${region[0]}-S16-G${i + 1}`,
      }
    });
  }

  return games;
}

/**
 * Creates Elite 8 game for a region (regional final)
 */
function createElite8Game(
  tournamentId: string,
  region: string,
  startDate: string
): GameInsert[] {
  return [{
    tournament_id: tournamentId,
    tournament_round: 'elite_8',
    home_team_id: null, // TBD
    away_team_id: null, // TBD
    game_date: addDays(startDate, 6), // Six days later
    status: 'scheduled',
    tournament_metadata: {
      region,
      bracket_position: `${region[0]}-E8-G1`,
    }
  }];
}

/**
 * Creates Final Four games (national semifinals)
 */
function createFinalFourGames(
  tournamentId: string,
  startDate: string
): GameInsert[] {
  return [
    {
      tournament_id: tournamentId,
      tournament_round: 'final_four',
      home_team_id: null, // TBD (Elite 8 winner)
      away_team_id: null, // TBD (Elite 8 winner)
      game_date: addDays(startDate, 8),
      status: 'scheduled',
      tournament_metadata: {
        region: 'Final Four',
        bracket_position: 'FF-G1',
      }
    },
    {
      tournament_id: tournamentId,
      tournament_round: 'final_four',
      home_team_id: null, // TBD (Elite 8 winner)
      away_team_id: null, // TBD (Elite 8 winner)
      game_date: addDays(startDate, 8),
      status: 'scheduled',
      tournament_metadata: {
        region: 'Final Four',
        bracket_position: 'FF-G2',
      }
    }
  ];
}

/**
 * Creates Championship game
 */
function createChampionshipGame(
  tournamentId: string,
  startDate: string
): GameInsert {
  return {
    tournament_id: tournamentId,
    tournament_round: 'championship',
    home_team_id: null, // TBD (Final Four winner)
    away_team_id: null, // TBD (Final Four winner)
    game_date: addDays(startDate, 10),
    status: 'scheduled',
    tournament_metadata: {
      region: 'Championship',
      bracket_position: 'CHAMP',
    }
  };
}

/**
 * Links games via next_game_id to establish bracket progression
 */
async function linkBracketProgression(
  supabase: SupabaseClient,
  gamesByPosition: Map<string, CreatedGame>,
  regions: string[]
) {
  const updates: { id: string; metadata: any }[] = [];

  // Link Round 1 -> Round 2
  for (const region of regions) {
    const regionCode = region[0];

    // Games 1-2 feed R2-G1, Games 3-4 feed R2-G2, etc.
    for (let r2Game = 1; r2Game <= 4; r2Game++) {
      const r1Game1 = (r2Game - 1) * 2 + 1;
      const r1Game2 = (r2Game - 1) * 2 + 2;

      const nextGame = gamesByPosition.get(`${regionCode}-R2-G${r2Game}`);
      if (!nextGame) continue;

      // Update both R1 games to point to this R2 game
      const game1 = gamesByPosition.get(`${regionCode}-R1-G${r1Game1}`);
      const game2 = gamesByPosition.get(`${regionCode}-R1-G${r1Game2}`);

      if (game1) {
        updates.push({
          id: game1.id,
          metadata: {
            ...gamesByPosition.get(`${regionCode}-R1-G${r1Game1}`),
            next_game_id: nextGame.id,
            winner_advances_to: 'home'
          }
        });
      }

      if (game2) {
        updates.push({
          id: game2.id,
          metadata: {
            ...gamesByPosition.get(`${regionCode}-R1-G${r1Game2}`),
            next_game_id: nextGame.id,
            winner_advances_to: 'away'
          }
        });
      }
    }
  }

  // Link Round 2 -> Sweet 16
  for (const region of regions) {
    const regionCode = region[0];

    for (let s16Game = 1; s16Game <= 2; s16Game++) {
      const r2Game1 = (s16Game - 1) * 2 + 1;
      const r2Game2 = (s16Game - 1) * 2 + 2;

      const nextGame = gamesByPosition.get(`${regionCode}-S16-G${s16Game}`);
      if (!nextGame) continue;

      const game1 = gamesByPosition.get(`${regionCode}-R2-G${r2Game1}`);
      const game2 = gamesByPosition.get(`${regionCode}-R2-G${r2Game2}`);

      if (game1) {
        updates.push({
          id: game1.id,
          metadata: {
            ...gamesByPosition.get(`${regionCode}-R2-G${r2Game1}`),
            next_game_id: nextGame.id,
            winner_advances_to: 'home'
          }
        });
      }

      if (game2) {
        updates.push({
          id: game2.id,
          metadata: {
            ...gamesByPosition.get(`${regionCode}-R2-G${r2Game2}`),
            next_game_id: nextGame.id,
            winner_advances_to: 'away'
          }
        });
      }
    }
  }

  // Link Sweet 16 -> Elite 8
  for (const region of regions) {
    const regionCode = region[0];
    const nextGame = gamesByPosition.get(`${regionCode}-E8-G1`);
    if (!nextGame) continue;

    const game1 = gamesByPosition.get(`${regionCode}-S16-G1`);
    const game2 = gamesByPosition.get(`${regionCode}-S16-G2`);

    if (game1) {
      updates.push({
        id: game1.id,
        metadata: {
          ...gamesByPosition.get(`${regionCode}-S16-G1`),
          next_game_id: nextGame.id,
          winner_advances_to: 'home'
        }
      });
    }

    if (game2) {
      updates.push({
        id: game2.id,
        metadata: {
          ...gamesByPosition.get(`${regionCode}-S16-G2`),
          next_game_id: nextGame.id,
          winner_advances_to: 'away'
        }
      });
    }
  }

  // Link Elite 8 -> Final Four
  const ffGame1 = gamesByPosition.get('FF-G1');
  const ffGame2 = gamesByPosition.get('FF-G2');

  if (ffGame1) {
    const e8East = gamesByPosition.get('E-E8-G1');
    const e8West = gamesByPosition.get('W-E8-G1');

    if (e8East) {
      updates.push({
        id: e8East.id,
        metadata: {
          ...gamesByPosition.get('E-E8-G1'),
          next_game_id: ffGame1.id,
          winner_advances_to: 'home'
        }
      });
    }

    if (e8West) {
      updates.push({
        id: e8West.id,
        metadata: {
          ...gamesByPosition.get('W-E8-G1'),
          next_game_id: ffGame1.id,
          winner_advances_to: 'away'
        }
      });
    }
  }

  if (ffGame2) {
    const e8South = gamesByPosition.get('S-E8-G1');
    const e8Midwest = gamesByPosition.get('M-E8-G1');

    if (e8South) {
      updates.push({
        id: e8South.id,
        metadata: {
          ...gamesByPosition.get('S-E8-G1'),
          next_game_id: ffGame2.id,
          winner_advances_to: 'home'
        }
      });
    }

    if (e8Midwest) {
      updates.push({
        id: e8Midwest.id,
        metadata: {
          ...gamesByPosition.get('M-E8-G1'),
          next_game_id: ffGame2.id,
          winner_advances_to: 'away'
        }
      });
    }
  }

  // Link Final Four -> Championship
  const champGame = gamesByPosition.get('CHAMP');
  if (champGame && ffGame1 && ffGame2) {
    updates.push({
      id: ffGame1.id,
      metadata: {
        ...gamesByPosition.get('FF-G1'),
        next_game_id: champGame.id,
        winner_advances_to: 'home'
      }
    });

    updates.push({
      id: ffGame2.id,
      metadata: {
        ...gamesByPosition.get('FF-G2'),
        next_game_id: champGame.id,
        winner_advances_to: 'away'
      }
    });
  }

  // Batch update all games with next_game_id links
  for (const update of updates) {
    await supabase
      .from('games')
      .update({ tournament_metadata: update.metadata })
      .eq('id', update.id);
  }
}

/**
 * Helper to add days to a date string
 */
function addDays(dateString: string, days: number): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
