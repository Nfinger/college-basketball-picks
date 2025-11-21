/**
 * Fix tournament structure: remove duplicates and add championship game
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixTournamentStructure() {
  console.log('🔧 Fixing tournament structure\n');

  try {
    const tournamentId = '9b417a35-69d7-4a05-bdb2-16a59be42071';

    // 1. Get all games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });

    if (gamesError) throw gamesError;

    console.log(`Found ${games?.length || 0} total games\n`);

    // 2. Keep only first 2 games (one of each matchup)
    const uniqueGames = new Map();
    const gamesToKeep: string[] = [];
    const gamesToDelete: string[] = [];

    games?.forEach(game => {
      const key = `${game.home_team_id}-${game.away_team_id}`;
      if (!uniqueGames.has(key)) {
        uniqueGames.set(key, game);
        gamesToKeep.push(game.id);
        console.log(`✅ Keeping: ${game.id}`);
      } else {
        gamesToDelete.push(game.id);
        console.log(`🗑️  Deleting duplicate: ${game.id}`);
      }
    });

    // 3. Delete duplicates
    if (gamesToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('games')
        .delete()
        .in('id', gamesToDelete);

      if (deleteError) throw deleteError;
      console.log(`\n✅ Deleted ${gamesToDelete.length} duplicate games\n`);
    }

    // 4. Get the two semifinal games we kept
    const { data: semifinals, error: semiError } = await supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name)')
      .eq('tournament_id', tournamentId)
      .order('game_date', { ascending: true });

    if (semiError) throw semiError;

    if (!semifinals || semifinals.length < 2) {
      throw new Error('Need at least 2 semifinal games');
    }

    console.log('📋 Semifinals:');
    semifinals.forEach((game: any, i: number) => {
      console.log(`   ${i + 1}. ${game.away_team.name} vs ${game.home_team.name}`);
    });

    // 5. Create championship game (6 hours after last semifinal)
    const lastSemifinalDate = new Date(semifinals[semifinals.length - 1].game_date);
    const championshipDate = new Date(lastSemifinalDate.getTime() + 6 * 60 * 60 * 1000);

    const { data: newChampGame, error: champError } = await supabase
      .from('games')
      .insert({
        tournament_id: tournamentId,
        tournament_round: 'championship',
        tournament_metadata: {
          seed_home: 1,
          seed_away: 2,
          round: 'championship'
        },
        game_date: championshipDate.toISOString(),
        status: 'scheduled',
        conference_id: semifinals[0].conference_id,
        // TBD teams - will be populated by user picks
        home_team_id: semifinals[0].home_team_id, // Placeholder
        away_team_id: semifinals[1].home_team_id, // Placeholder
      })
      .select()
      .single();

    if (champError) throw champError;

    console.log(`\n✅ Created championship game: ${newChampGame.id}`);
    console.log(`   Date: ${championshipDate.toLocaleString()}\n`);

    // 6. Show final structure
    const { data: finalGames, error: finalError } = await supabase
      .from('games')
      .select('id, tournament_round, game_date')
      .eq('tournament_id', tournamentId)
      .order('game_date', { ascending: true });

    if (finalError) throw finalError;

    console.log('🏀 Final Tournament Structure:');
    finalGames?.forEach((game: any) => {
      console.log(`   ${game.tournament_round}: ${new Date(game.game_date).toLocaleString()}`);
    });

    console.log('\n✅ Tournament structure fixed!\n');
    return true;
  } catch (error) {
    console.error('❌ Failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

fixTournamentStructure()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
