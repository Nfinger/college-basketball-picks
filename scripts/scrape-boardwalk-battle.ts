/**
 * Scrape and import Boardwalk Battle 2025-26 tournament
 *
 * Tournament Details from Blogging the Bracket:
 * - Dates: Nov. 20 and 22, 2025
 * - Location: Daytona Beach, Florida
 * - Format: 2 games (bracketed MTE)
 * - Teams: High Point (Big South), Incarnate Word (Southland), Southern Indiana (OVC), UIC (MVC)
 */

import { createClient } from '@supabase/supabase-js';
import {
  fetchTournamentGames,
  convertNcaaGameToInternal,
} from '../app/lib/tournaments/ncaa-scraper';
import { importGamesToTournament } from '../app/lib/tournaments/game-importer';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function scrapeBoardwalkBattle() {
  console.log('🏀 Starting Boardwalk Battle 2025-26 Tournament Setup\n');

  try {
    // Boardwalk Battle 2025-26 details
    const tournamentName = 'Boardwalk Battle';
    const year = 2026; // 2025-26 season
    const today = new Date();
    const startDate = new Date(2025, 10, 20); // November 20, 2025
    const endDate = new Date(2025, 10, 22); // November 22, 2025
    const location = 'Daytona Beach, FL';

    // Tournament teams (using full NCAA names for matching)
    const tournamentTeams = [
      'High Point University',
      'University of the Incarnate Word',
      'University of Southern Indiana',
      'University of Illinois Chicago',
    ];

    console.log(`📅 Tournament: ${tournamentName}`);
    console.log(`📍 Location: ${location} (Ocean Center)`);
    console.log(`📆 Dates: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
    console.log(`🎮 Format: 2 games (bracketed MTE)`);
    console.log(`👥 Teams: ${tournamentTeams.length}\n`);

    // Step 1: Check if tournament already exists
    console.log('🔍 Checking if tournament exists...');
    const { data: existingTournament } = await supabase
      .from('tournaments')
      .select('id, name, status')
      .eq('name', tournamentName)
      .eq('type', 'mte')
      .eq('year', year)
      .single();

    let tournamentId: string;

    if (existingTournament) {
      console.log(`✅ Tournament already exists: ${existingTournament.id}`);
      console.log(`   Status: ${existingTournament.status}\n`);
      tournamentId = existingTournament.id;
    } else {
      // Step 2: Create tournament record
      console.log('📝 Creating tournament record...');
      const { data: newTournament, error: createError } = await supabase
        .from('tournaments')
        .insert({
          name: tournamentName,
          type: 'mte',
          year: year,
          status: today >= startDate ? 'in_progress' : 'upcoming',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          location: location,
          metadata: {
            format: '2 games',
            bracket_type: 'bracketed MTE',
          },
        })
        .select('id')
        .single();

      if (createError || !newTournament) {
        throw new Error(`Failed to create tournament: ${createError?.message}`);
      }

      tournamentId = newTournament.id;
      console.log(`✅ Tournament created: ${tournamentId}\n`);
    }

    // Step 3: Try to scrape games from NCAA API (will fail if games haven't been played yet)
    console.log('🕷️  Attempting to scrape games from NCAA API...');
    console.log('   (This will likely be empty - tournament is in Nov 2025)\n');

    const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const endDateStr = endDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const ncaaGames = await fetchTournamentGames(tournamentTeams, startDateStr, endDateStr);
    console.log(`   Found ${ncaaGames.length} games\n`);

    if (ncaaGames.length === 0) {
      console.log('ℹ️  No games found yet - tournament hasn\'t been played.');
      console.log('   Games will be available after November 20-22, 2025.\n');

      console.log('✅ Tournament record created successfully!');
      console.log('   Run this script again after the tournament to import games.\n');

      return {
        success: true,
        tournamentId,
        message: 'Tournament created, no games available yet',
      };
    }

    // Convert NCAA games to internal format
    const games = ncaaGames.map(convertNcaaGameToInternal);

    // Log game details
    console.log('📋 Games found:');
    games.forEach((game: any, i: number) => {
      const homeTeam = game.home_team_name;
      const awayTeam = game.away_team_name;
      const gameDate = new Date(game.game_date).toLocaleString();
      const score =
        game.home_score && game.away_score
          ? ` (${awayTeam} ${game.away_score}, ${homeTeam} ${game.home_score})`
          : '';
      console.log(`   ${i + 1}. ${awayTeam} @ ${homeTeam}${score}`);
      console.log(`      Date: ${gameDate}`);
      console.log(`      Status: ${game.status}`);
    });
    console.log();

    // Step 4: Import games to tournament
    console.log('💾 Importing games to tournament...');
    const result = await importGamesToTournament(supabase, tournamentId, games, {
      updateExisting: true,
      matchThreshold: 0.75,
      dryRun: false,
    });

    // Step 5: Report results
    console.log('\n📊 Import Results:');
    console.log(`   ✅ Games Created: ${result.gamesCreated}`);
    console.log(`   🔄 Games Updated: ${result.gamesUpdated}`);
    console.log(`   ⏭️  Games Skipped: ${result.gamesSkipped}`);

    if (result.unmatchedTeams.length > 0) {
      console.log(`\n⚠️  Unmatched Teams (${result.unmatchedTeams.length}):`);
      result.unmatchedTeams.forEach((unmatched) => {
        console.log(`   - ${unmatched.espnTeam.name} (ESPN ID: ${unmatched.espnTeam.id})`);
        console.log(`     Game: ${unmatched.gameName}`);
      });
      console.log('\n💡 These teams need to be added to the database or matched manually.');
    }

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.error}`);
      });
    }

    // Step 6: Get final tournament stats
    console.log('\n🏆 Final Tournament Status:');
    const { data: finalTournament } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        status,
        games:games(count)
      `)
      .eq('id', tournamentId)
      .single();

    if (finalTournament) {
      console.log(`   Tournament: ${finalTournament.name}`);
      console.log(`   Status: ${finalTournament.status}`);
      console.log(`   Total Games: ${finalTournament.games?.[0]?.count || 0}`);
    }

    console.log('\n✅ Boardwalk Battle tournament setup complete!\n');

    return {
      success: true,
      tournamentId,
      ...result,
    };
  } catch (error) {
    console.error('❌ Failed:', error instanceof Error ? error.message : error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Run the scraper
scrapeBoardwalkBattle()
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
