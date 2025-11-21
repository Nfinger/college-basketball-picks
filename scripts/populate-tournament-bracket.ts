#!/usr/bin/env tsx
/**
 * Populate Tournament Bracket
 *
 * Creates all 63 bracket games for a tournament so users can pick winners
 * for all rounds, even matchups that are TBD.
 *
 * Usage:
 *   npm run populate-bracket <tournament-id>
 *
 * Example:
 *   npm run populate-bracket 123e4567-e89b-12d3-a456-426614174000
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface RegionSeeds {
  [region: string]: {
    [seed: number]: string; // seed -> team_id
  };
}

interface GameInsert {
  tournament_id: string;
  tournament_round: string;
  home_team_id: string | null;
  away_team_id: string | null;
  game_date: string;
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

async function getTournamentTeams(tournamentId: string): Promise<RegionSeeds> {
  const { data: teams, error } = await supabase
    .from('tournament_teams')
    .select('team_id, seed, region')
    .eq('tournament_id', tournamentId)
    .order('seed');

  if (error) {
    throw new Error(`Failed to fetch tournament teams: ${error.message}`);
  }

  const seeds: RegionSeeds = {
    East: {},
    West: {},
    South: {},
    Midwest: {},
  };

  for (const team of teams || []) {
    if (team.region && team.seed) {
      seeds[team.region][team.seed] = team.team_id;
    }
  }

  return seeds;
}

async function populateTournamentBracket(tournamentId: string) {
  console.log(`\n🏀 Populating bracket for tournament: ${tournamentId}\n`);

  // 1. Get tournament details
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, name, start_date, type')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    throw new Error(`Tournament not found: ${tournamentId}`);
  }

  console.log(`📋 Tournament: ${tournament.name}`);
  console.log(`📅 Start Date: ${tournament.start_date}`);
  console.log(`🏆 Type: ${tournament.type}\n`);

  // 2. Check if games already exist
  const { data: existingGames } = await supabase
    .from('games')
    .select('id')
    .eq('tournament_id', tournamentId);

  if (existingGames && existingGames.length > 0) {
    console.log(`⚠️  Warning: Tournament already has ${existingGames.length} games`);
    console.log('This script will add additional games. Consider deleting existing games first.\n');
  }

  // 3. Get seeded teams from tournament_teams table
  const seeds = await getTournamentTeams(tournamentId);

  const regions = ['East', 'West', 'South', 'Midwest'];
  let totalTeams = 0;
  for (const region of regions) {
    const regionTeams = Object.keys(seeds[region]).length;
    totalTeams += regionTeams;
    console.log(`${region}: ${regionTeams} teams seeded`);
  }

  if (totalTeams === 0) {
    throw new Error(
      'No teams found! Please populate tournament_teams table first with seeding information.'
    );
  }

  console.log(`\n✅ Total teams: ${totalTeams}\n`);

  // 4. Create all 63 games
  console.log('🔨 Creating bracket games...\n');

  const allGames: GameInsert[] = [];
  const gamePositions: Map<string, string> = new Map(); // bracket_position -> game_id

  const startDate = tournament.start_date;

  // Round 1: 32 games (8 per region)
  console.log('Creating Round 1 (Round of 64): 32 games');
  for (const region of regions) {
    const round1Games = createRound1Games(
      tournamentId,
      region,
      seeds[region],
      startDate
    );
    allGames.push(...round1Games);
  }

  // Round 2: 16 games (4 per region)
  console.log('Creating Round 2 (Round of 32): 16 games');
  for (const region of regions) {
    const round2Games = createRound2Games(tournamentId, region, addDays(startDate, 2));
    allGames.push(...round2Games);
  }

  // Sweet 16: 8 games (2 per region)
  console.log('Creating Sweet 16: 8 games');
  for (const region of regions) {
    const sweet16Games = createSweet16Games(
      tournamentId,
      region,
      addDays(startDate, 4)
    );
    allGames.push(...sweet16Games);
  }

  // Elite 8: 4 games (1 per region)
  console.log('Creating Elite 8: 4 games');
  for (const region of regions) {
    const elite8Game = createElite8Game(tournamentId, region, addDays(startDate, 6));
    allGames.push(...elite8Game);
  }

  // Final Four: 2 games
  console.log('Creating Final Four: 2 games');
  const finalFourGames = createFinalFourGames(tournamentId, addDays(startDate, 8));
  allGames.push(...finalFourGames);

  // Championship: 1 game
  console.log('Creating Championship: 1 game');
  const championshipGame = createChampionshipGame(
    tournamentId,
    addDays(startDate, 10)
  );
  allGames.push(championshipGame);

  console.log(`\n📊 Total games to create: ${allGames.length}\n`);

  // 5. Insert all games
  console.log('💾 Inserting games into database...');
  const { data: insertedGames, error: insertError } = await supabase
    .from('games')
    .insert(allGames)
    .select('id, tournament_metadata');

  if (insertError) {
    throw new Error(`Failed to insert games: ${insertError.message}`);
  }

  console.log(`✅ Inserted ${insertedGames?.length} games\n`);

  // 6. Build position map
  for (const game of insertedGames || []) {
    const metadata = game.tournament_metadata as any;
    if (metadata?.bracket_position) {
      gamePositions.set(metadata.bracket_position, game.id);
    }
  }

  // 7. Update next_game_id links
  console.log('🔗 Linking bracket progression...');
  await linkBracketProgression(gamePositions, regions);

  console.log('✅ Bracket progression linked\n');
  console.log('🎉 Tournament bracket populated successfully!\n');
  console.log(`Tournament ID: ${tournamentId}`);
  console.log(`View at: /tournaments/${tournamentId}\n`);
}

// Helper functions (same as in tournament-bracket-generator.server.ts)
function createRound1Games(
  tournamentId: string,
  region: string,
  seeds: { [seed: number]: string },
  startDate: string
): GameInsert[] {
  const matchups = [
    [1, 16],
    [8, 9],
    [5, 12],
    [4, 13],
    [6, 11],
    [3, 14],
    [7, 10],
    [2, 15],
  ];

  return matchups.map(([seed1, seed2], idx) => ({
    tournament_id: tournamentId,
    tournament_round: 'round_of_64',
    home_team_id: seeds[seed1] || null,
    away_team_id: seeds[seed2] || null,
    game_date: startDate,
    status: 'scheduled',
    tournament_metadata: {
      seed_home: seed1,
      seed_away: seed2,
      region,
      bracket_position: `${region[0]}-R1-G${idx + 1}`,
    },
  }));
}

function createRound2Games(
  tournamentId: string,
  region: string,
  gameDate: string
): GameInsert[] {
  return Array.from({ length: 4 }, (_, i) => ({
    tournament_id: tournamentId,
    tournament_round: 'round_of_32',
    home_team_id: null,
    away_team_id: null,
    game_date: gameDate,
    status: 'scheduled',
    tournament_metadata: {
      region,
      bracket_position: `${region[0]}-R2-G${i + 1}`,
    },
  }));
}

function createSweet16Games(
  tournamentId: string,
  region: string,
  gameDate: string
): GameInsert[] {
  return Array.from({ length: 2 }, (_, i) => ({
    tournament_id: tournamentId,
    tournament_round: 'sweet_16',
    home_team_id: null,
    away_team_id: null,
    game_date: gameDate,
    status: 'scheduled',
    tournament_metadata: {
      region,
      bracket_position: `${region[0]}-S16-G${i + 1}`,
    },
  }));
}

function createElite8Game(
  tournamentId: string,
  region: string,
  gameDate: string
): GameInsert[] {
  return [
    {
      tournament_id: tournamentId,
      tournament_round: 'elite_8',
      home_team_id: null,
      away_team_id: null,
      game_date: gameDate,
      status: 'scheduled',
      tournament_metadata: {
        region,
        bracket_position: `${region[0]}-E8-G1`,
      },
    },
  ];
}

function createFinalFourGames(tournamentId: string, gameDate: string): GameInsert[] {
  return [
    {
      tournament_id: tournamentId,
      tournament_round: 'semifinals',
      home_team_id: null,
      away_team_id: null,
      game_date: gameDate,
      status: 'scheduled',
      tournament_metadata: {
        region: 'Final Four',
        bracket_position: 'FF-G1',
      },
    },
    {
      tournament_id: tournamentId,
      tournament_round: 'semifinals',
      home_team_id: null,
      away_team_id: null,
      game_date: gameDate,
      status: 'scheduled',
      tournament_metadata: {
        region: 'Final Four',
        bracket_position: 'FF-G2',
      },
    },
  ];
}

function createChampionshipGame(tournamentId: string, gameDate: string): GameInsert {
  return {
    tournament_id: tournamentId,
    tournament_round: 'championship',
    home_team_id: null,
    away_team_id: null,
    game_date: gameDate,
    status: 'scheduled',
    tournament_metadata: {
      region: 'Championship',
      bracket_position: 'CHAMP',
    },
  };
}

async function linkBracketProgression(
  gamePositions: Map<string, string>,
  regions: string[]
) {
  const updates: Array<{ id: string; metadata: any }> = [];

  // Link Round 1 -> Round 2 (for each region)
  for (const region of regions) {
    const regionCode = region[0];

    for (let r2Game = 1; r2Game <= 4; r2Game++) {
      const r1Game1 = (r2Game - 1) * 2 + 1;
      const r1Game2 = (r2Game - 1) * 2 + 2;

      const nextGameId = gamePositions.get(`${regionCode}-R2-G${r2Game}`);
      if (!nextGameId) continue;

      const game1Id = gamePositions.get(`${regionCode}-R1-G${r1Game1}`);
      const game2Id = gamePositions.get(`${regionCode}-R1-G${r1Game2}`);

      if (game1Id) {
        // Get current metadata
        const { data } = await supabase
          .from('games')
          .select('tournament_metadata')
          .eq('id', game1Id)
          .single();

        updates.push({
          id: game1Id,
          metadata: {
            ...data?.tournament_metadata,
            next_game_id: nextGameId,
            winner_advances_to: 'home',
          },
        });
      }

      if (game2Id) {
        const { data } = await supabase
          .from('games')
          .select('tournament_metadata')
          .eq('id', game2Id)
          .single();

        updates.push({
          id: game2Id,
          metadata: {
            ...data?.tournament_metadata,
            next_game_id: nextGameId,
            winner_advances_to: 'away',
          },
        });
      }
    }
  }

  // Apply all updates
  for (const update of updates) {
    await supabase
      .from('games')
      .update({ tournament_metadata: update.metadata })
      .eq('id', update.id);
  }
}

function addDays(dateString: string, days: number): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// Main execution
const tournamentId = process.argv[2];

if (!tournamentId) {
  console.error('❌ Error: Tournament ID required\n');
  console.error('Usage: npm run populate-bracket <tournament-id>\n');
  console.error('Example:');
  console.error('  npm run populate-bracket 123e4567-e89b-12d3-a456-426614174000\n');
  process.exit(1);
}

populateTournamentBracket(tournamentId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  });
