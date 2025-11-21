/**
 * Script to apply the weekly metrics migration to the remote database
 * Run with: pnpm tsx scripts/run-weekly-metrics-migration.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('Reading migration file...');
  const migrationPath = join(process.cwd(), 'supabase/migrations/20251120000010_weekly_metrics_functions.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('Applying weekly metrics migration to remote database...\n');

  // Split the SQL into individual statements and execute them
  // PostgreSQL functions need to be created one at a time
  const statements = migrationSQL
    .split(/;[\s\n]+(?=CREATE|--)/g)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + (statements[i].endsWith(';') ? '' : ';');

    // Extract function name for better logging
    const funcNameMatch = statement.match(/CREATE OR REPLACE FUNCTION (\w+)/);
    const funcName = funcNameMatch ? funcNameMatch[1] : `Statement ${i + 1}`;

    console.log(`Creating function: ${funcName}...`);

    try {
      const { error } = await supabase.rpc('exec_sql' as any, { sql: statement }) as any;

      if (error) {
        console.error(`✗ Error creating ${funcName}:`, error.message);
        errorCount++;
      } else {
        console.log(`✓ ${funcName} created successfully`);
        successCount++;
      }
    } catch (err: any) {
      // If exec_sql doesn't exist, we'll need to use a different method
      console.log(`Note: exec_sql RPC not available, trying alternative method...`);

      // Alternative: Use the SQL editor API via HTTP
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: statement })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`✗ Error creating ${funcName}:`, errorText);
        errorCount++;
      } else {
        console.log(`✓ ${funcName} created successfully`);
        successCount++;
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`Migration Summary:`);
  console.log(`  ✓ Successful: ${successCount}`);
  console.log(`  ✗ Failed: ${errorCount}`);
  console.log(`========================================\n`);

  if (errorCount > 0) {
    console.log('⚠️  Some functions failed to create. Please check the errors above.');
    console.log('You may need to apply this migration manually via the Supabase dashboard.');
    process.exit(1);
  } else {
    console.log('✓ All weekly metrics functions have been created successfully!');
    console.log('\nYou can now use the new weekly metrics endpoints:');
    console.log('  - get_user_weekly_stats()');
    console.log('  - get_user_weekly_conference_stats()');
    console.log('  - get_user_weekly_streak()');
    console.log('  - get_user_weekly_potd_stats()');
    console.log('  - get_user_weekly_potd_streak()');
  }
}

applyMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
