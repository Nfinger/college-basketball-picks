/**
 * Clean up duplicate tournament games
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupDuplicateGames() {
  console.log('🧹 Cleaning up duplicate tournament games\n');

  try {
    const tournamentId = '9b417a35-69d7-4a05-bdb2-16a59be42071';

    // Get all games for this tournament
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id, tournament_round, game_date')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });

    if (gamesError) throw gamesError;

    console.log(`Found ${games?.length || 0} total games`);

    // Group games by matchup (home + away + round)
    const gamesByMatchup = new Map<string, any[]>();

    games?.forEach(game => {
      const key = `${game.home_team_id}-${game.away_team_id}-${game.tournament_round}`;
      if (!gamesByMatchup.has(key)) {
        gamesByMatchup.set(key, []);
      }
      gamesByMatchup.get(key)!.push(game);
    });

    // Find duplicates and keep only the first one
    const gamesToDelete: string[] = [];

    gamesByMatchup.forEach((matchupGames, key) => {
      if (matchupGames.length > 1) {
        console.log(`\n   Found ${matchupGames.length} duplicates for matchup ${key}`);
        // Keep the first, delete the rest
        const toDelete = matchupGames.slice(1).map(g => g.id);
        gamesToDelete.push(...toDelete);
        console.log(`   Keeping game ${matchupGames[0].id}, deleting ${toDelete.length} duplicates`);
      }
    });

    if (gamesToDelete.length > 0) {
      console.log(`\n🗑️  Deleting ${gamesToDelete.length} duplicate games...`);

      const { error: deleteError } = await supabase
        .from('games')
        .delete()
        .in('id', gamesToDelete);

      if (deleteError) throw deleteError;

      console.log('   ✅ Duplicates removed');
    } else {
      console.log('\n   ℹ️  No duplicates found');
    }

    // Show final game count
    const { data: finalGames, error: finalError } = await supabase
      .from('games')
      .select('id, tournament_round')
      .eq('tournament_id', tournamentId);

    if (finalError) throw finalError;

    console.log(`\n✅ Cleanup complete! Tournament now has ${finalGames?.length || 0} unique games\n`);

    return true;
  } catch (error) {
    console.error('❌ Cleanup failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

// Run the cleanup
cleanupDuplicateGames()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
