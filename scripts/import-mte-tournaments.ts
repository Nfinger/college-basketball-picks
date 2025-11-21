#!/usr/bin/env tsx
/**
 * Bulk MTE Tournament Importer
 *
 * Imports multiple tournaments from parsed blog post data
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { matchTeam } from '../app/lib/tournaments/team-matcher';

const PARSED_DATA_FILE = './data/tournaments/parsed-tournaments.json';

interface ParsedTournament {
  name: string;
  dates: { start: string; end: string; raw: string };
  location: string;
  teams: Array<{ name: string; conference: string; isTBD: boolean; bracket?: string }>;
  format: { gameCount: number; description: string };
  brackets?: string[];
  metadata: { sourceUrl: string; parsedAt: string; section: number };
}

interface ImportResult {
  created: number;
  skipped: number;
  failed: number;
  details: Array<{
    name: string;
    status: 'created' | 'skipped' | 'failed';
    error?: string;
    tournamentId?: string;
    teamsMatched?: number;
    teamsUnmatched?: number;
  }>;
}

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const createMissingTeams = !args.includes('--no-create-teams');

  console.log('🏀 MTE Tournament Bulk Importer\n');
  console.log(`   Mode: ${dryRun ? '🔍 DRY RUN' : '✅ PRODUCTION'}`);
  console.log(`   Create Missing Teams: ${createMissingTeams ? 'Yes' : 'No'}\n`);

  // Check for parsed data
  if (!existsSync(PARSED_DATA_FILE)) {
    console.error('❌ Parsed data not found. Run scripts/test-blog-parser.ts first.');
    process.exit(1);
  }

  // Load parsed data
  const content = await readFile(PARSED_DATA_FILE, 'utf-8');
  const parseResult = JSON.parse(content);
  const tournaments: ParsedTournament[] = parseResult.tournaments;

  console.log(`📋 Found ${tournaments.length} tournaments to import\n`);

  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const result: ImportResult = {
    created: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  // Import each tournament
  for (const t of tournaments) {
    try {
      console.log(`\n📝 Processing: ${t.name}`);
      console.log(`   📅 ${t.dates.start} to ${t.dates.end}`);
      console.log(`   📍 ${t.location}`);
      console.log(`   👥 ${t.teams.length} teams`);

      // Determine year and status
      const startDate = new Date(t.dates.start);
      const year =
        startDate.getMonth() >= 10 ? startDate.getFullYear() + 1 : startDate.getFullYear();

      // Check if tournament already exists
      const { data: existing } = await supabase
        .from('tournaments')
        .select('id, name')
        .eq('name', t.name)
        .eq('year', year)
        .single();

      if (existing && !dryRun) {
        console.log(`   ⏭️  Already exists: ${existing.id}`);
        result.skipped++;
        result.details.push({
          name: t.name,
          status: 'skipped',
          tournamentId: existing.id,
        });
        continue;
      }

      // Match teams and track bracket associations
      const teamMatches: Map<string, { teamId: string; bracket?: string }> = new Map();
      let teamsMatched = 0;
      let teamsUnmatched = 0;

      for (const team of t.teams) {
        if (team.isTBD) continue;

        const match = await matchTeam(
          supabase,
          {
            id: '',
            name: team.name,
            abbreviation: '',
          },
          0.75,
        );

        if (match) {
          teamMatches.set(team.name, { teamId: match.teamId, bracket: team.bracket });
          teamsMatched++;
          const bracketLabel = team.bracket ? ` [${team.bracket}]` : '';
          console.log(`      ✅ ${team.name}${bracketLabel} → matched (${(match.confidence * 100).toFixed(0)}%)`);
        } else if (createMissingTeams && !dryRun) {
          // Create new team
          // Note: We can't store metadata in teams table, so just create with basic info
          const { data: newTeam, error } = await supabase
            .from('teams')
            .insert({
              name: team.name,
              short_name: team.name, // Will need manual cleanup
              // Conference info available: team.conference
              // This team was auto-created from MTE import and needs verification
            })
            .select('id')
            .single();

          if (error) {
            console.log(`      ❌ ${team.name} (${team.conference}) → create failed: ${error.message}`);
            teamsUnmatched++;
          } else {
            teamMatches.set(team.name, { teamId: newTeam!.id, bracket: team.bracket });
            teamsMatched++;
            const bracketLabel = team.bracket ? ` [${team.bracket}]` : '';
            console.log(`      ➕ ${team.name}${bracketLabel} (${team.conference}) → created new team [NEEDS VERIFICATION]`);
          }
        } else {
          console.log(`      ⚠️  ${team.name} → no match`);
          teamsUnmatched++;
        }
      }

      if (dryRun) {
        console.log(`   🔍 Would create tournament (dry run)`);
        result.created++;
        result.details.push({
          name: t.name,
          status: 'created',
          teamsMatched,
          teamsUnmatched,
        });
        continue;
      }

      // Create tournament
      const today = new Date();
      const { data: tournament, error: createError } = await supabase
        .from('tournaments')
        .insert({
          name: t.name,
          type: 'mte' as const,
          year,
          start_date: t.dates.start,
          end_date: t.dates.end,
          location: t.location,
          status: today >= startDate ? 'in_progress' : 'upcoming',
          metadata: {
            format: t.format.description,
            game_count: t.format.gameCount,
            team_count: t.teams.length,
            brackets: t.brackets || null, // Store bracket names
            source: 'blog-import',
            source_url: t.metadata.sourceUrl,
          },
        })
        .select('id')
        .single();

      if (createError || !tournament) {
        throw new Error(`Failed to create tournament: ${createError?.message}`);
      }

      // Associate teams with bracket information
      if (teamMatches.size > 0) {
        const associations = Array.from(teamMatches.entries()).map(([_, data]) => ({
          tournament_id: tournament.id,
          team_id: data.teamId,
          region: data.bracket || null, // Store bracket in region field
        }));

        const { error: assocError } = await supabase
          .from('tournament_teams')
          .insert(associations);

        if (assocError) {
          console.log(`   ⚠️  Failed to associate teams: ${assocError.message}`);
        }
      }

      console.log(`   ✅ Created: ${tournament.id}`);
      result.created++;
      result.details.push({
        name: t.name,
        status: 'created',
        tournamentId: tournament.id,
        teamsMatched,
        teamsUnmatched,
      });
    } catch (error) {
      console.error(`   ❌ Failed: ${error instanceof Error ? error.message : error}`);
      result.failed++;
      result.details.push({
        name: t.name,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`   ✅ Created: ${result.created}`);
  console.log(`   ⏭️  Skipped: ${result.skipped}`);
  console.log(`   ❌ Failed: ${result.failed}`);
  console.log();

  // Save report
  const reportFile = `./data/tournaments/import-report-${new Date().toISOString().split('T')[0]}.json`;
  await writeFile(reportFile, JSON.stringify(result, null, 2));
  console.log(`📄 Full report saved to: ${reportFile}\n`);

  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
