/**
 * Create test tournament with manual game data for testing picks flow
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestTournamentData() {
  console.log('🏀 Creating Test Tournament Data\n');

  try {
    // 1. Create test tournament
    console.log('1️⃣ Creating test tournament...');
    // Check if tournament already exists
    const { data: existingTournament } = await supabase
      .from('tournaments')
      .select('id')
      .eq('name', 'Test Tournament 2025')
      .eq('year', 2025)
      .single();

    let tournament;
    if (existingTournament) {
      tournament = existingTournament;
      console.log(`   ℹ️  Tournament already exists: ${tournament.id}`);
    } else {
      const { data: newTournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          name: 'Test Tournament 2025',
          type: 'mte',
          year: 2025,
          start_date: '2025-03-01',
          end_date: '2025-03-03',
          location: 'Test Arena',
          status: 'in_progress',
          metadata: { format: 'single_elimination', team_count: 4 },
          external_source: 'manual'
        })
        .select()
        .single();

      if (tournamentError) throw tournamentError;
      tournament = newTournament;
      console.log(`   ✅ Tournament created: ${tournament.id}`);
    }

    // 2. Get some teams with their conferences
    console.log('\n2️⃣ Fetching teams for games...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, short_name, conference_id')
      .not('conference_id', 'is', null)
      .limit(4);

    if (teamsError || !teams || teams.length < 4) {
      throw new Error('Need at least 4 teams with conferences in database');
    }
    console.log(`   ✅ Found ${teams.length} teams`);

    // 3. Create tournament games for TODAY
    console.log('\n3️⃣ Creating tournament games for TODAY...');

    const now = new Date();
    const game1Time = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const game2Time = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now

    const games = [
      {
        home_team_id: teams[0].id,
        away_team_id: teams[1].id,
        conference_id: teams[0].conference_id,
        game_date: game1Time.toISOString(),
        status: 'scheduled',
        tournament_id: tournament.id,
        tournament_round: 'semifinals',
        tournament_metadata: { seed_home: 1, seed_away: 4 },
        spread: -5.5,
      },
      {
        home_team_id: teams[2].id,
        away_team_id: teams[3].id,
        conference_id: teams[2].conference_id,
        game_date: game2Time.toISOString(),
        status: 'scheduled',
        tournament_id: tournament.id,
        tournament_round: 'semifinals',
        tournament_metadata: { seed_home: 2, seed_away: 3 },
        spread: -3.0,
      },
    ];

    const { data: createdGames, error: gamesError } = await supabase
      .from('games')
      .insert(games)
      .select(`
        id,
        game_date,
        tournament_round,
        home_team:teams!games_home_team_id_fkey(name, short_name),
        away_team:teams!games_away_team_id_fkey(name, short_name)
      `);

    if (gamesError) throw gamesError;
    console.log(`   ✅ Created ${createdGames?.length || 0} tournament games`);

    // 4. Display game details
    console.log('\n4️⃣ Tournament Games:');
    createdGames?.forEach((game: any, i) => {
      console.log(`   ${i + 1}. #${games[i].tournament_metadata.seed_away} ${game.away_team.short_name} vs #${games[i].tournament_metadata.seed_home} ${game.home_team.short_name}`);
      console.log(`      ${game.tournament_round} | ${new Date(game.game_date).toLocaleString()}`);
    });

    console.log('\n✅ Test Tournament Created Successfully!\n');
    console.log('📝 Next Steps:');
    console.log('   1. Go to http://localhost:5177');
    console.log('   2. Find the tournament games (look for tournament badge)');
    console.log('   3. Make a pick on a tournament game');
    console.log('   4. Edit your pick');
    console.log('   5. Delete your pick');
    console.log(`   6. View tournament bracket: http://localhost:5177/tournaments/${tournament.id}\n`);

    return true;

  } catch (error) {
    console.error('❌ Failed to create test tournament:', error instanceof Error ? error.message : error);
    return false;
  }
}

// Run the script
createTestTournamentData()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
