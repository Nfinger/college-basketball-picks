#!/usr/bin/env tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year')
    .ilike('name', '%Virgin Islands Paradise Jam%')
    .single();

  if (tournament) {
    console.log('Tournament:', tournament.name);
    console.log('ID:', tournament.id);
    console.log('Year:', tournament.year);

    const { data: teams } = await supabase
      .from('tournament_teams')
      .select('team_id, teams(name)')
      .eq('tournament_id', tournament.id);

    console.log('\nCurrent team count:', teams?.length);
    console.log('\nCurrent teams:');
    teams?.forEach((t: any) => console.log('  -', t.teams?.name));
  } else {
    console.log('Tournament not found');
  }
}

main().catch(console.error);
