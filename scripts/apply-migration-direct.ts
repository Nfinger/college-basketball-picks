/**
 * Apply migration directly using Supabase client with raw SQL execution
 * This bypasses the CLI connection pooling issues
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
  console.log('📝 Applying tournament migration directly...\n');

  try {
    // Read the migration SQL file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251120000001_create_tournaments.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('   Reading migration file...');
    console.log(`   Size: ${migrationSQL.length} bytes\n`);

    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`   Found ${statements.length} SQL statements\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';

      // Skip if it's just a comment
      if (stmt.trim().startsWith('--')) {
        continue;
      }

      console.log(`   Executing statement ${i + 1}/${statements.length}...`);

      // Use rpc to execute raw SQL
      const { error } = await supabase.rpc('exec', { sql: stmt });

      if (error) {
        // If we can't execute raw SQL, we need to apply through dashboard
        console.log(`\n   ⚠️  Cannot execute raw SQL through Supabase client`);
        console.log(`   Statement that failed: ${stmt.substring(0, 100)}...`);
        console.log(`   Error: ${error.message}\n`);
        console.log('   Please apply the migration manually:\n');
        console.log('   1. Go to: https://supabase.com/dashboard/project/plfzfzcrggahgzzptfrm/sql/new');
        console.log('   2. Run: npx tsx scripts/print-migration.ts');
        console.log('   3. Copy the SQL output and paste into the SQL editor');
        console.log('   4. Click "Run"\n');
        return false;
      }
    }

    console.log('\n   ✅ Migration applied successfully!\n');
    return true;

  } catch (error) {
    console.error('❌ Migration failed:', error instanceof Error ? error.message : error);
    console.log('\n   Manual migration required:');
    console.log('   1. Run: npx tsx scripts/print-migration.ts');
    console.log('   2. Copy the SQL output');
    console.log('   3. Go to: https://supabase.com/dashboard/project/plfzfzcrggahgzzptfrm/sql/new');
    console.log('   4. Paste and click "Run"\n');
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
