#!/usr/bin/env tsx
/**
 * Fix MTE Tournament by removing duplicate/old games
 *
 * Usage:
 *   tsx scripts/fix-mte-tournament.ts <tournament-id>
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMTETournament(tournamentId: string) {
  console.log(`\n🔧 Fixing MTE tournament: ${tournamentId}\n`);

  // Get all games for this tournament
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, tournament_round, tournament_metadata')
    .eq('tournament_id', tournamentId)
    .order('game_date');

  if (gamesError || !games) {
    throw new Error(`Failed to fetch games: ${gamesError?.message}`);
  }

  console.log(`Found ${games.length} games\n`);

  // Identify which games to keep and which to delete
  const gamesToDelete: string[] = [];
  const gamesToKeep: any[] = [];

  games.forEach(game => {
    const metadata = game.tournament_metadata as any;

    // Keep semifinals, championship, and consolation games
    if (game.tournament_round === 'semifinals' ||
        game.tournament_round === 'championship' ||
        game.tournament_round === 'consolation') {
      gamesToKeep.push(game);
      console.log(`✅ Keeping: ${game.tournament_round} (${metadata?.bracket_position || 'no position'})`);
    } else {
      // Delete old first_round games
      gamesToDelete.push(game.id);
      console.log(`❌ Deleting: ${game.tournament_round} (old game)`);
    }
  });

  if (gamesToDelete.length === 0) {
    console.log('\n✅ No games to delete. Tournament is clean!\n');
    return;
  }

  // Delete old games
  console.log(`\n🗑️  Deleting ${gamesToDelete.length} old games...\n`);

  const { error: deleteError } = await supabase
    .from('games')
    .delete()
    .in('id', gamesToDelete);

  if (deleteError) {
    throw new Error(`Failed to delete games: ${deleteError.message}`);
  }

  console.log(`✅ Deleted ${gamesToDelete.length} old games\n`);
  console.log(`✅ Tournament now has ${gamesToKeep.length} games:\n`);

  gamesToKeep.forEach((game, idx) => {
    const meta = game.tournament_metadata as any;
    console.log(`  ${idx + 1}. ${game.tournament_round} (${meta?.bracket_position || 'no position'})`);
  });

  console.log(`\n🎉 Tournament fixed!\n`);
  console.log(`View at: /tournaments/${tournamentId}\n`);
}

// Main execution
const tournamentId = process.argv[2];

if (!tournamentId) {
  console.error('❌ Error: Tournament ID required\n');
  console.error('Usage: tsx scripts/fix-mte-tournament.ts <tournament-id>\n');
  process.exit(1);
}

fixMTETournament(tournamentId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
