#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

async function checkMetadata() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: games, error } = await supabase
    .from('games')
    .select('id, tournament_round, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name), tournament_metadata')
    .eq('tournament_id', 'aaf9aa85-433c-402a-8e14-1d1a9365efb6')
    .order('game_date');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('\n=== TOURNAMENT GAMES ===\n');
  games?.forEach((g: any, idx: number) => {
    console.log(`Game ${idx + 1}: [${g.tournament_round}]`);
    console.log(`  ${g.home_team?.name} vs ${g.away_team?.name}`);
    console.log(`  ID: ${g.id}`);

    const meta = g.tournament_metadata;
    if (meta) {
      if (meta.next_game_id) {
        console.log(`  → Winner advances to: ${meta.next_game_id.substring(0, 8)}... (${meta.winner_advances_to} position)`);
      }
      if (meta.loser_next_game_id) {
        console.log(`  → Loser advances to: ${meta.loser_next_game_id.substring(0, 8)}... (${meta.loser_advances_to} position)`);
      }
      if (meta.is_placeholder) {
        console.log(`  ⚠️  PLACEHOLDER TEAMS`);
      }
      if (meta.bracket_position) {
        console.log(`  Position: ${meta.bracket_position}`);
      }
    }
    console.log('');
  });
}

checkMetadata().catch(console.error);
