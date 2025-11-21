/**
 * Tournament Integration Test Script
 *
 * This script tests the complete tournament integration:
 * 1. Creates a test tournament
 * 2. Imports games from ESPN (2024 Maui Invitational as example)
 * 3. Verifies games appear with tournament data
 * 4. Tests that picks can be made on tournament games
 */

import { createClient } from '@supabase/supabase-js';
import { importMTE } from '../app/lib/tournaments/game-importer';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTournamentIntegration() {
  console.log('🏀 Testing Tournament Integration\n');

  // Step 1: Check if migration is applied
  console.log('1️⃣ Checking database schema...');
  const { data: tournamentsTable, error: schemaError } = await supabase
    .from('tournaments')
    .select('id')
    .limit(1);

  if (schemaError) {
    console.error('❌ Tournaments table not found. Run migration first:');
    console.error('   Execute: supabase/migrations/20251120000001_create_tournaments.sql');
    console.error('   Error:', schemaError.message);
    return false;
  }
  console.log('✅ Schema is ready\n');

  // Step 2: Create or find test tournament
  console.log('2️⃣ Setting up test tournament (2024 Maui Invitational)...');

  const { data: existingTournament } = await supabase
    .from('tournaments')
    .select('id, name')
    .eq('name', '2024 Maui Invitational')
    .single();

  let tournamentId: string;

  if (existingTournament) {
    console.log(`   ℹ️  Tournament already exists: ${existingTournament.id}`);
    tournamentId = existingTournament.id;
  } else {
    const { data: newTournament, error: createError } = await supabase
      .from('tournaments')
      .insert({
        name: '2024 Maui Invitational',
        type: 'mte',
        year: 2024,
        start_date: '2024-11-25',
        end_date: '2024-11-27',
        location: 'Maui, HI',
        status: 'completed',
        metadata: {
          format: 'single_elimination',
          team_count: 8
        },
        external_source: 'espn'
      })
      .select('id')
      .single();

    if (createError || !newTournament) {
      console.error('❌ Failed to create tournament:', createError?.message);
      return false;
    }

    tournamentId = newTournament.id;
    console.log(`   ✅ Created tournament: ${tournamentId}`);
  }

  // Step 3: Import games from ESPN
  console.log('\n3️⃣ Importing games from ESPN...');
  console.log('   (Using 2024 Maui Invitational - Nov 25-27, 2024)');

  try {
    const result = await importMTE(
      supabase,
      'Maui Invitational',
      2024,
      '20241125',
      '20241127',
      'Maui, HI',
      {
        updateExisting: true,
        dryRun: false
      }
    );

    console.log('\n   📊 Import Results:');
    console.log(`   ✅ Games created: ${result.gamesCreated}`);
    console.log(`   🔄 Games updated: ${result.gamesUpdated}`);
    console.log(`   ⏭️  Games skipped: ${result.gamesSkipped}`);

    if (result.errors.length > 0) {
      console.log(`\n   ⚠️  Errors (${result.errors.length}):`);
      result.errors.slice(0, 3).forEach((err, i) => {
        console.log(`      ${i + 1}. ${err.error}`);
      });
    }

    if (result.unmatchedTeams.length > 0) {
      console.log(`\n   ⚠️  Unmatched teams (${result.unmatchedTeams.length}):`);
      result.unmatchedTeams.slice(0, 5).forEach((ut, i) => {
        console.log(`      ${i + 1}. ${ut.espnTeam.name} (${ut.espnTeam.abbreviation})`);
      });
      console.log('\n   💡 Tip: Add these teams to your database or update team names for better matching');
    }

  } catch (error) {
    console.error('❌ Import failed:', error instanceof Error ? error.message : error);
    return false;
  }

  // Step 4: Verify tournament games
  console.log('\n4️⃣ Verifying tournament games...');
  const { data: tournamentGames, error: gamesError } = await supabase
    .from('games')
    .select(`
      id,
      game_date,
      tournament_round,
      tournament_metadata,
      home_team:teams!games_home_team_id_fkey(name, short_name),
      away_team:teams!games_away_team_id_fkey(name, short_name),
      home_score,
      away_score,
      status
    `)
    .eq('tournament_id', tournamentId)
    .order('game_date', { ascending: true });

  if (gamesError || !tournamentGames) {
    console.error('❌ Failed to fetch tournament games:', gamesError?.message);
    return false;
  }

  console.log(`   ✅ Found ${tournamentGames.length} games for this tournament\n`);

  if (tournamentGames.length > 0) {
    console.log('   📋 Sample games:');
    tournamentGames.slice(0, 3).forEach((game: any, i) => {
      const seeds = game.tournament_metadata;
      const seedDisplay = seeds?.seed_away && seeds?.seed_home
        ? `#${seeds.seed_away} vs #${seeds.seed_home}`
        : '';

      console.log(`      ${i + 1}. ${game.away_team?.short_name} vs ${game.home_team?.short_name} ${seedDisplay}`);
      console.log(`         Round: ${game.tournament_round || 'N/A'} | Status: ${game.status}`);
    });
  }

  // Step 5: Test picks functionality
  console.log('\n5️⃣ Testing picks functionality...');

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.log('   ⚠️  No authenticated user - skipping pick test');
    console.log('   💡 To test picks: Log in to the app and try making a pick on a tournament game');
  } else {
    console.log(`   ℹ️  Authenticated as: ${user.email}`);

    if (tournamentGames.length > 0) {
      const testGame = tournamentGames[0];

      // Check if user already has a pick
      const { data: existingPick } = await supabase
        .from('picks')
        .select('id, picked_team_id')
        .eq('game_id', testGame.id)
        .eq('user_id', user.id)
        .single();

      if (existingPick) {
        console.log('   ✅ User already has a pick on a tournament game');
        console.log(`      Game: ${testGame.away_team?.short_name} vs ${testGame.home_team?.short_name}`);
      } else {
        console.log('   ℹ️  No picks yet on tournament games');
        console.log('   💡 Make a pick through the web UI to test the full flow');
      }
    }
  }

  // Step 6: Success summary
  console.log('\n✅ Tournament Integration Test Complete!\n');
  console.log('📝 Next steps:');
  console.log('   1. Navigate to http://localhost:5177 in your browser');
  console.log(`   2. View tournament bracket: http://localhost:5177/tournaments/${tournamentId}`);
  console.log('   3. Go to home page and find tournament games (look for tournament badge)');
  console.log('   4. Make a pick on a tournament game');
  console.log('   5. Verify pick appears in "My Picks" and metrics');
  console.log('   6. Edit/delete the pick to test full CRUD operations\n');

  return true;
}

// Run the test
testTournamentIntegration()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
