#!/usr/bin/env tsx
/**
 * Test Blog Parser
 *
 * Fetches the blog post and tests the parser without database access
 */

import { parseBlogPost } from '../app/lib/tournaments/blog-parser';
import { writeFile, mkdir } from 'fs/promises';

const BLOG_POST_URL =
  'https://www.bloggingthebracket.com/2025/4/8/24403878/2025-26-mens-college-basketball-exempt-multi-team-events-mte-thanksgiving-early-season-tournaments';

async function main() {
  console.log('🔍 Testing Blog Post Parser\n');

  // Fetch blog post
  console.log('📡 Fetching blog post...');
  const response = await fetch(BLOG_POST_URL);
  const html = await response.text();
  console.log(`   ✅ Fetched ${html.length} characters\n`);

  // Cache it
  await mkdir('./data/tournaments', { recursive: true });
  await writeFile('./data/tournaments/blogging-bracket-2025-26.html', html);
  console.log('   💾 Cached to ./data/tournaments/blogging-bracket-2025-26.html\n');

  // Parse it
  console.log('🔍 Parsing tournament data...');
  const result = await parseBlogPost(html, {
    sourceUrl: BLOG_POST_URL,
    year: 2025, // 2025-26 season tournaments happen in Nov/Dec 2025
  });

  console.log(`   ✅ Found ${result.tournaments.length} tournaments`);
  console.log(`   ⚠️  Parse errors: ${result.errors.length}\n`);

  // Show first 5 tournaments
  console.log('📋 First 5 Tournaments:\n');
  result.tournaments.slice(0, 5).forEach((t, i) => {
    console.log(`${i + 1}. ${t.name}`);
    console.log(`   📅 ${t.dates.start} to ${t.dates.end} (raw: "${t.dates.raw}")`);
    console.log(`   📍 ${t.location}`);
    console.log(`   🎮 ${t.format.description}`);
    console.log(`   👥 ${t.teams.length} teams:`);
    t.teams.slice(0, 3).forEach((team) => {
      console.log(`      • ${team.name} (${team.conference})${team.isTBD ? ' [TBD]' : ''}`);
    });
    if (t.teams.length > 3) {
      console.log(`      ... and ${t.teams.length - 3} more`);
    }
    console.log();
  });

  // Show errors if any
  if (result.errors.length > 0) {
    console.log('⚠️  Parse Errors:\n');
    result.errors.slice(0, 5).forEach((err, i) => {
      console.log(`${i + 1}. Section ${err.section}:`);
      console.log(`   Error: ${err.error}`);
      console.log(`   HTML: ${err.html.slice(0, 100)}...\n`);
    });

    if (result.errors.length > 5) {
      console.log(`   ... and ${result.errors.length - 5} more errors\n`);
    }
  }

  // Save parsed data
  await writeFile('./data/tournaments/parsed-tournaments.json', JSON.stringify(result, null, 2));
  console.log('💾 Saved parsed data to ./data/tournaments/parsed-tournaments.json\n');

  // Summary
  console.log('📊 Summary:');
  console.log(`   Total tournaments: ${result.tournaments.length}`);
  console.log(`   Parse errors: ${result.errors.length}`);
  console.log(
    `   Success rate: ${((result.tournaments.length / (result.tournaments.length + result.errors.length)) * 100).toFixed(1)}%`,
  );

  // Find the Boardwalk Battle as sanity check
  const boardwalk = result.tournaments.find((t) => t.name.includes('Boardwalk Battle'));
  if (boardwalk) {
    console.log('\n✅ Found Boardwalk Battle (sanity check):');
    console.log(`   Dates: ${boardwalk.dates.start} to ${boardwalk.dates.end}`);
    console.log(`   Location: ${boardwalk.location}`);
    console.log(`   Teams: ${boardwalk.teams.map((t) => t.name).join(', ')}`);
  } else {
    console.log('\n⚠️  Could not find Boardwalk Battle - parser may need adjustments');
  }
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
