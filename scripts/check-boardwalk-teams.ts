import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const teams = [
  'UC San Diego',
  'East Carolina',
  'Toledo',
  'La Salle',
  'UIC',
  'James Madison',
  'Jacksonville State',
  'Stetson'
];

async function checkTeams() {
  console.log('🔍 Checking Boardwalk Battle teams in database:\n');

  for (const name of teams) {
    const { data } = await supabase
      .from('teams')
      .select('id, name, short_name')
      .ilike('name', `%${name}%`)
      .limit(1)
      .single();

    if (data) {
      console.log(`✅ ${name.padEnd(20)} → ${data.name} (${data.short_name})`);
    } else {
      console.log(`❌ ${name.padEnd(20)} → NOT FOUND`);
    }
  }
}

checkTeams();
