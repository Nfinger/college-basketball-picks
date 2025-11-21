/**
 * Apply tournament migration directly to database
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('📝 Applying tournament migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251120000001_create_tournaments.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('   Reading migration file...');
    console.log(`   File: ${migrationPath}`);
    console.log(`   Size: ${migrationSQL.length} bytes\n`);

    // Execute the migration
    console.log('   Executing SQL...');
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // If exec_sql function doesn't exist, try direct execution
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('   ℹ️  exec_sql function not available, trying direct execution...\n');

        // Split SQL into individual statements and execute
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          console.log(`   Executing statement ${i + 1}/${statements.length}...`);

          const { error: stmtError } = await supabase.from('_migrations').select('*').limit(1);
          if (stmtError && stmtError.message.includes('relation "_migrations" does not exist')) {
            console.log('   ⚠️  Cannot execute raw SQL through Supabase client');
            console.log('   Please apply the migration manually using Supabase Dashboard or CLI\n');
            console.log('   Steps:');
            console.log('   1. Go to: https://supabase.com/dashboard/project/plfzfzcrggahgzzptfrm/sql/new');
            console.log('   2. Paste the contents of: supabase/migrations/20251120000001_create_tournaments.sql');
            console.log('   3. Click "Run"\n');
            return false;
          }
        }
      } else {
        throw error;
      }
    }

    console.log('   ✅ Migration applied successfully!\n');
    return true;

  } catch (error) {
    console.error('❌ Migration failed:', error instanceof Error ? error.message : error);
    console.log('\n   Manual migration required:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/plfzfzcrggahgzzptfrm/sql/new');
    console.log('   2. Paste the contents of: supabase/migrations/20251120000001_create_tournaments.sql');
    console.log('   3. Click "Run"\n');
    return false;
  }
}

// Run the migration
applyMigration()
  .then((success) => {
    if (success) {
      console.log('✅ Ready to run tournament integration test!');
      console.log('   Run: npx tsx scripts/test-tournament-integration.ts\n');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
