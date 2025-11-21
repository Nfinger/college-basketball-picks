# Stat Chain AI Puzzle Generator

## Overview

An AI-powered system for generating daily Stat Chain Connections puzzles using Claude AI and comprehensive team statistics from KenPom, Torvik, ESPN, and other sources.

## System Architecture

### 1. Statistics Aggregation (`app/lib/stat-chain/stats-aggregator.ts`)

Fetches and combines team statistics from multiple sources:

**Data Sources:**
- **KenPom**: Adjusted efficiency metrics, tempo, rankings, luck
- **BartTorvik**: Alternative efficiency ratings, rankings
- **ESPN**: Traditional stats (PPG, FG%, 3P%, assists, rebounds, turnovers)

**Key Features:**
- Combines multi-source data for comprehensive team profiles
- Supports filtering by conference, stat ranges
- Handles missing data gracefully (prefers KenPom for advanced metrics, ESPN for traditional stats)

**Available Statistics:**
```typescript
{
  // Rankings
  kenpomRank, barttovikRank, overallRank

  // Efficiency (tempo-free)
  offensiveEfficiency, defensiveEfficiency, tempo

  // Traditional stats
  wins, losses, pointsPerGame, pointsAllowedPerGame,
  fieldGoalPct, threePointPct, freeThrowPct,
  reboundsPerGame, assistsPerGame, turnoversPerGame

  // Advanced
  strengthOfSchedule, adjEM (efficiency margin), luck

  // Raw source data
  kenpomRaw, barttovikRaw, espnRaw (JSONB)
}
```

### 2. AI Puzzle Generator (`app/lib/stat-chain/puzzle-generator.ts`)

Uses Claude Sonnet 4 to identify creative connections:

**Process:**
1. Fetches all teams with comprehensive statistics
2. Builds detailed prompt with full team profiles
3. Claude analyzes statistics and identifies 4 groups of 3 teams
4. Validates puzzle structure and difficulty progression
5. Saves to database with proper relationships

**AI Prompt Strategy:**
- Provides full statistical profiles for ~300+ teams
- Instructs on difficulty tiers (Easy → Medium → Hard → Expert)
- Examples of connection types for each difficulty
- Strict validation (12 teams, no duplicates, factual accuracy)

**Difficulty Guidelines:**

**Easy (Yellow):**
- Same conference
- Geographic region
- Similar mascot/colors
- Top-ranked teams

**Medium (Green):**
- Similar offensive/defensive efficiency
- High/low tempo teams
- Win percentage ranges
- Power conference members

**Hard (Blue):**
- Strength of schedule similarity
- Balanced offensive/defensive profiles
- Specific stat ranges (e.g., 75-80 OffEff)
- Advanced metric patterns

**Expert (Purple):**
- Counterintuitive statistical relationships
- Subtle advanced metric correlations
- Unusual efficiency/tempo combinations
- Statistical outliers with common thread

### 3. CLI Tool (`scripts/generate-daily-puzzle.ts`)

Command-line interface for puzzle generation:

```bash
# Generate puzzle for today (preview)
npx tsx scripts/generate-daily-puzzle.ts --preview

# Generate and save to database
npx tsx scripts/generate-daily-puzzle.ts

# Generate for specific date
npx tsx scripts/generate-daily-puzzle.ts 2025-01-15
```

**Features:**
- Environment validation (Supabase, Anthropic API)
- Duplicate puzzle prevention
- Detailed output with AI reasoning
- Preview mode for testing
- Formatted display with difficulty emojis

## Prerequisites

### 1. Team Statistics Data

You must first scrape statistics using the existing scrapers:

```bash
# KenPom (requires subscription - $19.95/year)
# Set KENPOM_EMAIL and KENPOM_PASSWORD in .env
npx tsx test-kenpom-scraper.ts

# BartTorvik (free)
npx tsx test-barttorvik-scraper.ts

# ESPN (free)
npx tsx test-espn-scraper.ts
```

These populate the `team_stats` table with current season data.

### 2. Environment Variables

Required in `.env`:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Get your Anthropic API key at: https://console.anthropic.com/

### 3. Database Migrations

Ensure all migrations are applied:

```bash
supabase migration up
```

Required tables:
- `teams` - Team roster
- `team_stats` - Multi-source statistics
- `stat_chain_puzzles` - Daily puzzles
- `stat_chain_groups` - Puzzle groups
- `stat_chain_teams` - Team-group links
- `stat_chain_sessions` - User sessions

## Usage

### Step 1: Scrape Statistics

```bash
# Run all scrapers to get current data
npx tsx test-kenpom-scraper.ts
npx tsx test-barttorvik-scraper.ts
npx tsx test-espn-scraper.ts
```

### Step 2: Preview a Puzzle

```bash
npx tsx scripts/generate-daily-puzzle.ts --preview
```

This generates a puzzle and displays it without saving to the database.

**Example Output:**
```
🏀 Stat Chain Daily Puzzle Generator

📅 Date: 2025-11-20
👁️  Preview Mode: YES

🤖 Initializing AI puzzle generator...
🎲 Generating puzzle with AI...
   (This may take 30-60 seconds)

✅ Puzzle generated successfully!

═══════════════════════════════════════════════════════

💭 AI Reasoning:
   I focused on creating a progression from obvious conference groupings
   to subtle statistical patterns that require deeper analysis...

🟡 Group 1: ACC POWERHOUSES (easy)
   Teams: Duke, North Carolina, Virginia
   Connection: All three teams are founding members of the Atlantic Coast
   Conference and have won national championships in the modern era.

🟢 Group 2: HIGH-TEMPO OFFENSES (medium)
   Teams: Gonzaga, Houston, Baylor
   Connection: These teams all rank in the top 20 nationally for tempo
   (possessions per game) with averages above 72.5.

🔵 Group 3: BALANCED EFFICIENCY (hard)
   Teams: Purdue, Tennessee, UCLA
   Connection: All three teams have offensive and defensive efficiency
   ratings within 3 points of each other, showing balanced play.

🟣 Group 4: LUCK METRIC OUTLIERS (expert)
   Teams: Auburn, Kansas, Marquette
   Connection: According to KenPom's luck metric, all three teams have
   won 3+ more games than expected based on their game-by-game
   performance.

═══════════════════════════════════════════════════════

👁️  Preview mode - not saving to database
   Run without --preview to save this puzzle
```

### Step 3: Generate and Save

```bash
# Generate for today
npx tsx scripts/generate-daily-puzzle.ts

# Generate for specific date
npx tsx scripts/generate-daily-puzzle.ts 2025-01-15
```

This saves the puzzle to the database and makes it playable at `/daily?date=YYYY-MM-DD`.

## AI Prompt Design

The system uses a carefully crafted prompt that:

1. **Provides Full Context**: Complete statistical profiles for all available teams
2. **Sets Clear Requirements**: 12 teams, 4 groups, specific difficulty levels
3. **Gives Examples**: Connection types for each difficulty tier
4. **Enforces Structure**: JSON response format with validation
5. **Encourages Creativity**: "Interesting, creative connections over generic ones"

### Prompt Components

**Team Data Format:**
```
Team 1: Duke Blue Devils (DUKE)
  Conference: ACC
  Record: 18-3
  KenPom Rank: 5
  Offensive Efficiency: 118.2
  Defensive Efficiency: 92.1
  Tempo: 67.8
  PPG: 79.4
  FG%: 47.2%
  3P%: 36.8%
  ... (all available stats)
```

**Difficulty Guidelines**: Explicit examples for each tier

**Output Format**: Strict JSON schema with validation

**Quality Checks**: Factual accuracy, no ambiguity, clear progression

## Database Schema

The puzzle is stored across 4 tables:

```sql
stat_chain_puzzles
  ├── id (UUID)
  └── puzzle_date (DATE, unique)

stat_chain_groups
  ├── id (UUID)
  ├── puzzle_id (FK → puzzles)
  ├── group_order (1-4)
  ├── difficulty (easy/medium/hard/expert)
  ├── connection_title (TEXT)
  └── connection_explanation (TEXT)

stat_chain_teams
  ├── id (UUID)
  ├── group_id (FK → groups)
  └── team_id (FK → teams)

stat_chain_sessions
  ├── id (UUID)
  ├── puzzle_id (FK → puzzles)
  ├── user_id (FK → auth.users)
  ├── mistakes (0-4)
  ├── solved_groups (UUID[])
  └── guess_history (JSONB)
```

## How It Works

### Connection Discovery Process

The AI analyzes team statistics to find meaningful patterns:

1. **Statistical Clustering**: Groups teams with similar metrics
2. **Conference Analysis**: Identifies conference-based patterns
3. **Performance Trends**: Finds tempo, efficiency, or ranking correlations
4. **Advanced Metrics**: Uses KenPom's adjusted stats for subtle patterns
5. **Validation**: Ensures connections are factually accurate

### Example Connections Generated

**Conference-Based (Easy):**
- "Big Ten Trio" - All from Big Ten Conference
- "SEC Powerhouses" - Top SEC teams

**Performance-Based (Medium):**
- "High Octane Offense" - Teams averaging 80+ PPG
- "Defensive Stalwarts" - Top 20 defensive efficiency

**Statistical (Hard):**
- "Similar Strength of Schedule" - SOS between 0.15-0.18
- "Tempo Twins" - Possessions per game 68-70

**Advanced (Expert):**
- "Efficiency Paradox" - High offense, low defense but winning
- "Luck Factor" - Teams overperforming expected win totals

## Troubleshooting

### "Not enough teams with statistics"
- Run the scrapers to populate team_stats table
- Check that current season data exists
- Verify Supabase connection

### "Failed to fetch teams: fetch failed"
- Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
- Ensure Supabase project is running
- Verify network connectivity

### "Puzzle already exists for this date"
- Delete existing puzzle or choose different date
- Use --preview mode to test without saving

### AI generates invalid connections
- Review AI reasoning in output
- Re-run generator (uses temperature=1 for creativity)
- Check that team stats are accurate and complete

## Cost Considerations

**Anthropic API Costs:**
- Claude Sonnet 4: ~$3 per 1M input tokens, ~$15 per 1M output tokens
- Each puzzle generation: ~2000 input tokens, ~500 output tokens
- Estimated cost per puzzle: ~$0.01
- Monthly cost (30 puzzles): ~$0.30

**Optimization:**
- Preview mode doesn't save to database (useful for testing)
- Failed generations don't retry automatically
- Consider caching team statistics to reduce prompt size

## Future Enhancements

### Puzzle Quality
- [ ] Multi-round generation with voting (generate 3, pick best)
- [ ] User difficulty ratings to calibrate AI
- [ ] Historical analysis to avoid repetitive connections
- [ ] A/B testing different prompts

### Data Sources
- [ ] NCAA Tournament data (seeding, upsets)
- [ ] Injury reports (missing key players)
- [ ] Historical head-to-head records
- [ ] Social media engagement metrics

### Automation
- [ ] Scheduled daily generation (cron job)
- [ ] Quality validation pipeline
- [ ] Automatic puzzle difficulty tuning
- [ ] Backup puzzle generation if primary fails

### Analytics
- [ ] Track which connections users find hardest
- [ ] Monitor solve rates by difficulty
- [ ] Identify optimal difficulty progression
- [ ] A/B test connection types

## Technical Notes

### Why Claude Sonnet 4?
- Best balance of cost, speed, and quality
- Strong analytical reasoning for statistical patterns
- Reliable JSON output formatting
- Temperature=1 for creative but valid connections

### Statistics Priority
1. **KenPom** for adjusted efficiency (tempo-free, most reliable)
2. **BartTorvik** as secondary source for efficiency
3. **ESPN** for traditional stats and public appeal

### Validation Strategy
- Pre-generation: Check data availability
- Post-generation: Validate structure, uniqueness, difficulty
- Pre-save: Final factual accuracy check
- Post-save: User feedback loop

## Credits

- **Data Sources**: KenPom.com, BartTorvik.com, ESPN
- **AI**: Anthropic Claude Sonnet 4
- **Inspiration**: NYT Connections puzzle game
- **Framework**: React Router v7, Supabase, TypeScript
