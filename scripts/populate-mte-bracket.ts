#!/usr/bin/env tsx
/**
 * Populate MTE Tournament Bracket
 *
 * Creates the complete bracket structure for MTE tournaments including:
 * - Semifinals (2 games)
 * - Championship game (winners bracket)
 * - Consolation game (losers bracket)
 *
 * Usage:
 *   npm run populate-mte <tournament-id>
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Required: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateMTEBracket(tournamentId: string) {
  console.log(`\n🏀 Populating MTE bracket for tournament: ${tournamentId}\n`);

  // 1. Get tournament details
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, name, start_date, type')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    throw new Error(`Tournament not found: ${tournamentId}`);
  }

  if (tournament.type !== 'mte') {
    throw new Error(`Tournament is not an MTE (type: ${tournament.type})`);
  }

  console.log(`📋 Tournament: ${tournament.name}`);
  console.log(`📅 Start Date: ${tournament.start_date}\n`);

  // 2. Get teams from tournament_teams
  const { data: teams, error: teamsError } = await supabase
    .from('tournament_teams')
    .select('team_id, team:teams(id, name)')
    .eq('tournament_id', tournamentId)
    .order('seed');

  if (teamsError || !teams || teams.length === 0) {
    throw new Error('No teams found. Please populate tournament_teams first.');
  }

  if (teams.length !== 4) {
    throw new Error(`Expected 4 teams for MTE, found ${teams.length}`);
  }

  console.log('Teams:');
  teams.forEach((t: any, i) => console.log(`  ${i + 1}. ${t.team.name}`));
  console.log('');

  // 3. Check if games already exist
  const { data: existingGames } = await supabase
    .from('games')
    .select('id, tournament_round')
    .eq('tournament_id', tournamentId);

  if (existingGames && existingGames.length > 0) {
    console.log(`⚠️  Warning: Tournament already has ${existingGames.length} games:`);
    existingGames.forEach((g: any) => console.log(`  - ${g.tournament_round}`));
    console.log('\nAdding missing games...\n');
  }

  const startDate = tournament.start_date;
  const day2 = addDays(startDate, 1);

  // 4. Create all 4 games
  const games = [];

  // Semifinal 1
  games.push({
    tournament_id: tournamentId,
    tournament_round: 'semifinals',
    home_team_id: teams[0].team_id,
    away_team_id: teams[1].team_id,
    game_date: `${startDate}T18:00:00`,
    status: 'scheduled',
    tournament_metadata: {
      bracket_position: 'SF-1',
      round: 'semifinals',
      game_number: 1,
    },
  });

  // Semifinal 2
  games.push({
    tournament_id: tournamentId,
    tournament_round: 'semifinals',
    home_team_id: teams[2].team_id,
    away_team_id: teams[3].team_id,
    game_date: `${startDate}T20:30:00`,
    status: 'scheduled',
    tournament_metadata: {
      bracket_position: 'SF-2',
      round: 'semifinals',
      game_number: 2,
    },
  });

  // Championship (winners) - Use first team as placeholder, will be updated by picks
  games.push({
    tournament_id: tournamentId,
    tournament_round: 'championship',
    home_team_id: teams[0].team_id, // Placeholder - will be replaced by winner of SF-1
    away_team_id: teams[1].team_id, // Placeholder - will be replaced by winner of SF-2
    game_date: `${day2}T20:00:00`,
    status: 'scheduled',
    tournament_metadata: {
      bracket_position: 'CHAMP',
      round: 'championship',
      game_number: 4,
      is_placeholder: true, // Mark that these teams are placeholders
    },
  });

  // Consolation (losers) - Use remaining teams as placeholders
  games.push({
    tournament_id: tournamentId,
    tournament_round: 'consolation',
    home_team_id: teams[2].team_id, // Placeholder - will be replaced by loser of SF-1
    away_team_id: teams[3].team_id, // Placeholder - will be replaced by loser of SF-2
    game_date: `${day2}T18:00:00`,
    status: 'scheduled',
    tournament_metadata: {
      bracket_position: 'CONS',
      round: 'consolation',
      game_number: 3,
      is_placeholder: true, // Mark that these teams are placeholders
    },
  });

  console.log('🔨 Creating games...');
  console.log('  Semifinal 1');
  console.log('  Semifinal 2');
  console.log('  Championship (TBD vs TBD)');
  console.log('  Consolation (TBD vs TBD)\n');

  // 5. Insert games
  const { data: insertedGames, error: insertError } = await supabase
    .from('games')
    .insert(games)
    .select('id, tournament_metadata, tournament_round');

  if (insertError) {
    throw new Error(`Failed to insert games: ${insertError.message}`);
  }

  console.log(`✅ Inserted ${insertedGames?.length} games\n`);

  // 6. Link games with next_game_id (winners) and loser_next_game_id
  console.log('🔗 Linking bracket progression...');

  const gameMap = new Map();
  insertedGames?.forEach((g: any) => {
    const pos = g.tournament_metadata?.bracket_position;
    if (pos) gameMap.set(pos, g.id);
  });

  const sf1Id = gameMap.get('SF-1');
  const sf2Id = gameMap.get('SF-2');
  const champId = gameMap.get('CHAMP');
  const consId = gameMap.get('CONS');

  // Update SF-1: winners go to championship (home), losers go to consolation (home)
  if (sf1Id && champId && consId) {
    const { data: sf1 } = await supabase
      .from('games')
      .select('tournament_metadata')
      .eq('id', sf1Id)
      .single();

    await supabase
      .from('games')
      .update({
        tournament_metadata: {
          ...sf1?.tournament_metadata,
          next_game_id: champId,
          winner_advances_to: 'home',
          loser_next_game_id: consId,
          loser_advances_to: 'home',
        },
      })
      .eq('id', sf1Id);

    console.log('  SF-1 → Championship (winner) / Consolation (loser)');
  }

  // Update SF-2: winners go to championship (away), losers go to consolation (away)
  if (sf2Id && champId && consId) {
    const { data: sf2 } = await supabase
      .from('games')
      .select('tournament_metadata')
      .eq('id', sf2Id)
      .single();

    await supabase
      .from('games')
      .update({
        tournament_metadata: {
          ...sf2?.tournament_metadata,
          next_game_id: champId,
          winner_advances_to: 'away',
          loser_next_game_id: consId,
          loser_advances_to: 'away',
        },
      })
      .eq('id', sf2Id);

    console.log('  SF-2 → Championship (winner) / Consolation (loser)');
  }

  console.log('\n✅ Bracket progression linked\n');
  console.log('🎉 MTE bracket complete!\n');
  console.log(`View at: /tournaments/${tournamentId}\n`);
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
  console.error('Usage: npm run populate-mte <tournament-id>\n');
  process.exit(1);
}

populateMTEBracket(tournamentId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
