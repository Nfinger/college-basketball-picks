import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  const migrationPath = join(process.cwd(), 'supabase/migrations/20251120000010_weekly_metrics_functions.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('Applying weekly metrics migration to remote database...');

  const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

  if (error) {
    console.error('Error applying migration:', error);
    // Try direct execution instead
    console.log('Trying direct execution...');
    const { error: execError } = await (supabase as any).from('_supabase').rpc('exec', { sql: migrationSQL });
    if (execError) {
      console.error('Direct execution also failed:', execError);
      process.exit(1);
    }
  }

  console.log('✓ Weekly metrics migration applied successfully!');
}

applyMigration().catch(console.error);
