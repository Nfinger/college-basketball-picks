/**
 * Print migration SQL for easy copy-paste into Supabase Dashboard
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251120000001_create_tournaments.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

console.log('═══════════════════════════════════════════════════════════════');
console.log('TOURNAMENT MIGRATION SQL');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('📋 Copy the SQL below and paste into Supabase SQL Editor:');
console.log('   https://supabase.com/dashboard/project/plfzfzcrggahgzzptfrm/sql/new');
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(migrationSQL);
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('✅ After running in Supabase Dashboard, run the test script:');
console.log('   npx tsx scripts/test-tournament-integration.ts');
console.log('═══════════════════════════════════════════════════════════════');
