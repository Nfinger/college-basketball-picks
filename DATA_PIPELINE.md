# College Basketball Data Pipeline

## Overview

A **fault-tolerant, orchestrated data pipeline** for collecting comprehensive college basketball statistics from multiple sources. Built with Inngest for reliable scheduling and execution, with circuit breakers, automatic retries, and comprehensive monitoring.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   INNGEST ORCHESTRATOR                      │
│              (Runs Daily at 5 AM ET)                        │
└─────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          ▼                                   ▼
┌──────────────────────┐          ┌──────────────────────┐
│   PHASE 1: FOUNDATION │          │   MONITORING         │
│   - Conferences       │          │   - Circuit Breakers │
│   - Teams             │          │   - Retry Logic      │
└──────────┬───────────┘          │   - Quality Checks   │
           │                       └──────────────────────┘
           ▼
┌──────────────────────────────────────────────────────────┐
│   PHASE 2: TEAM STATISTICS (Parallel Execution)         │
│   ┌─────────────┬─────────────┬─────────────┐          │
│   │ BartTorvik  │  KenPom     │   ESPN      │          │
│   │ (Priority 1)│ (Priority 2)│ (Priority 3)│          │
│   └─────────────┴─────────────┴─────────────┘          │
└──────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│   PHASE 3: GAMES & SCHEDULES                             │
│   - Game schedules                                       │
│   - Live scores                                          │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│   PHASE 4: PLAYER DATA (Parallel Execution)              │
│   ┌──────────────────┬─────────────────────┐            │
│   │  Player Stats    │   Injury Reports    │            │
│   └──────────────────┴─────────────────────┘            │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│   PHASE 5: SUPPLEMENTARY DATA                            │
│   - News aggregation                                     │
│   - Betting lines                                        │
│   - Social sentiment                                     │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│   PHASE 6: DATA VALIDATION                               │
│   - Quality scoring                                      │
│   - Consistency checks                                   │
│   - Outlier detection                                    │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│   PHASE 7: DAILY PUZZLE GENERATION                       │
│   - AI analysis of statistics                            │
│   - Creative connection discovery                        │
│   - Puzzle validation and save                           │
└──────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Fault Tolerance

**Circuit Breakers**
- Automatically detect failing sources
- Open circuit after 5 consecutive failures
- Auto-recovery testing after 30 minutes
- Manual reset capability

**Automatic Retries**
- Network errors: 5 retries with exponential backoff
- Rate limiting: 3 retries with longer delays
- Authentication: 2 retries
- Validation errors: No retry (fail fast)

**Graceful Degradation**
- Partial success is better than total failure
- Continue pipeline even if some sources fail
- Track which sources succeeded/failed

### 2. Dependency Management

Sources declare their dependencies:
```typescript
{
  source: 'kenpom',
  dependencies: ['teams'], // Requires teams to exist first
  maxAge: 24 // Data older than 24 hours triggers refresh
}
```

**Dependency Chain:**
- Conferences → Teams
- Teams → Team Stats, Player Stats, Games
- Games → Live Scores

### 3. Data Freshness

Skip unnecessary work:
- Incremental runs only fetch stale data
- Configurable staleness thresholds per source
- Full runs ignore freshness (collect everything)

### 4. Monitoring & Observability

**6 Tracking Tables:**
- `pipeline_runs` - Complete orchestrator executions
- `scraper_runs` - Individual scraper results
- `data_freshness` - When each source last updated
- `circuit_breaker_state` - Source health status
- `data_quality_metrics` - Validation scores
- `data_dependencies` - Required relationships

**Dashboard:**
- Real-time pipeline status at `/admin/pipeline`
- Recent run history
- Data freshness indicators
- Circuit breaker states
- Manual trigger controls

## Data Sources

### Currently Implemented

| Source | Type | Cost | Frequency | Priority |
|--------|------|------|-----------|----------|
| **BartTorvik** | Team Stats | Free | Daily | 1 |
| **KenPom** | Team Stats | $19.95/year | Daily | 2 |
| **ESPN** | Team Stats | Free | Daily | 3 |

### Planned Sources

| Source | Type | Status |
|--------|------|--------|
| **ESPN Players** | Player Stats | Ready to integrate |
| **Haslametrics** | Team Stats | To implement |
| **T-Rank** | Team Stats | To implement |
| **NCAA.com** | Team Stats | To implement |
| **Sports Reference** | Historical Data | To implement |
| **RealGM** | Injury Reports | To implement |
| **The Athletic** | News/Analysis | To implement |

## Usage

### Automatic Execution

Pipeline runs automatically **daily at 5 AM ET** via Inngest cron schedule.

### Manual Triggers

**Full Run** (collect all data regardless of freshness):
```bash
# Via API
curl -X POST http://localhost:5173/api/inngest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pipeline/trigger",
    "data": { "runType": "full" }
  }'
```

**Incremental Run** (only stale data):
```bash
curl -X POST http://localhost:5173/api/inngest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pipeline/trigger",
    "data": { "runType": "incremental" }
  }'
```

**Via Dashboard:**
Visit `/admin/pipeline` and click the trigger buttons.

### Generate Daily Puzzle

Automatically triggered after successful data collection, or manually:

```bash
curl -X POST http://localhost:5173/api/inngest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "stat-chain/generate-puzzle",
    "data": { "date": "2025-11-20" }
  }'
```

## Adding New Data Sources

### Step 1: Create Scraper Class

Follow the existing pattern in `lib/scrapers/`:

```typescript
import { BaseScraper } from './base-scraper'

export class NewSourceScraper extends BaseScraper<RawData, ProcessedData> {
  protected config = {
    source: 'new-source',
    rateLimit: 2000, // 2 seconds between requests
    maxRetries: 3,
    timeout: 30000
  }

  protected async fetchData(): Promise<RawData[]> {
    // Implement data fetching
  }

  protected validateRecord(record: RawData): ValidationResult {
    // Implement validation
  }

  protected async transformRecord(record: RawData): Promise<ProcessedData> {
    // Transform to database format
  }

  protected async saveRecord(record: ProcessedData): Promise<void> {
    // Save to database
  }
}
```

### Step 2: Add to Orchestrator

Edit `inngest/functions/data-pipeline-orchestrator.ts`:

```typescript
// Add to appropriate phase
const newSourceResult = await step.run('new-source-data', async () => {
  const runner = new PipelineRunner(supabase)

  const scraper: ScraperConfig = {
    source: 'new-source',
    jobType: 'team_stats', // or 'player_stats', 'games', etc.
    enabled: true,
    priority: 4, // Set appropriate priority
    maxAge: 24, // Hours before refresh
    dependencies: ['teams'], // What this needs
    run: async () => {
      const scraper = new NewSourceScraper()
      return await scraper.run()
    }
  }

  return await runner.run([scraper], runType as any)
})
```

### Step 3: Add Dependency Declaration

If other sources depend on this one, update dependencies:

```sql
INSERT INTO data_dependencies (source, depends_on, dependency_type)
VALUES ('dependent-source', 'new-source', 'required');
```

### Step 4: Test

```bash
# Test the scraper standalone
npx tsx test-new-source-scraper.ts

# Test in orchestrator (incremental)
# Trigger via dashboard or API

# Monitor results
# Check /admin/pipeline for status
```

## Database Schema

### Pipeline Tables

**pipeline_runs** - Orchestrator execution tracking
```sql
id, run_type, status, started_at, completed_at,
sources_attempted, sources_succeeded, sources_failed,
records_processed, records_created, records_updated,
errors[], warnings[], metadata
```

**scraper_runs** - Individual scraper tracking
```sql
id, pipeline_run_id, source, job_type, status,
started_at, completed_at, duration_ms,
records_processed, records_created, records_updated,
errors[], warnings[], retry_count, metadata
```

**data_freshness** - Source update tracking
```sql
id, source, data_type, last_updated_at,
record_count, quality_score (0-1)
```

**circuit_breaker_state** - Source health
```sql
id, source, state (closed|open|half_open),
failure_count, last_failure_at, last_success_at,
open_until
```

**data_quality_metrics** - Validation results
```sql
id, scraper_run_id, source, data_type, metric_type,
score (0-1), details
```

**data_dependencies** - Source relationships
```sql
id, source, depends_on, dependency_type (required|optional)
```

### Helper Functions

```sql
-- Update data freshness
SELECT update_data_freshness('kenpom', 'team_stats', 350, 0.95);

-- Check if data is fresh
SELECT is_data_fresh('kenpom', 'team_stats', 24); -- max 24 hours old

-- Update circuit breaker
SELECT update_circuit_breaker('espn', true); -- success
SELECT update_circuit_breaker('espn', false); -- failure
```

## Monitoring

### Dashboard: `/admin/pipeline`

**Features:**
- Manual pipeline triggers (full/incremental)
- Manual puzzle generation
- Recent pipeline run history
- Data freshness by source
- Circuit breaker states
- Recent scraper runs
- Circuit breaker reset controls

### Key Metrics

**Pipeline Health:**
- Success rate (completed / total runs)
- Partial success rate (some sources succeeded)
- Average duration
- Source reliability (successes / attempts per source)

**Data Quality:**
- Freshness (hours since last update)
- Quality scores (0-1 scale)
- Record counts
- Validation pass rates

**Error Tracking:**
- Circuit breaker states
- Failure patterns by source
- Retry counts
- Error types (network, auth, validation)

## Troubleshooting

### Pipeline Not Running

**Check Inngest Connection:**
```bash
# Verify Inngest is configured
curl http://localhost:5173/api/inngest
```

**Check Cron Schedule:**
- Inngest Dev Server shows scheduled functions
- Verify timezone (cron uses server timezone)

### Source Failing Repeatedly

**Check Circuit Breaker:**
```sql
SELECT * FROM circuit_breaker_state WHERE source = 'kenpom';
```

If `state = 'open'`:
- Wait for `open_until` to expire (auto-recovery)
- Or manually reset via dashboard

**Check Credentials:**
- KenPom: `KENPOM_EMAIL`, `KENPOM_PASSWORD`
- Others: verify API keys, tokens

**Check Rate Limiting:**
- Review scraper `rateLimit` configuration
- Check if source has stricter limits than expected

### Data Not Fresh

**Force Full Run:**
- Use `/admin/pipeline` → "Trigger Full Run"
- Ignores freshness checks, collects everything

**Check Dependencies:**
```sql
SELECT * FROM data_dependencies WHERE source = 'kenpom';
```

If dependencies aren't fresh, source will be skipped.

**Check Last Run:**
```sql
SELECT * FROM scraper_runs
WHERE source = 'kenpom' AND job_type = 'team_stats'
ORDER BY started_at DESC
LIMIT 1;
```

### Puzzle Not Generating

**Check Prerequisites:**
1. ANTHROPIC_API_KEY configured
2. Fresh team statistics (< 48 hours old)
3. No existing puzzle for target date

**Manual Trigger:**
```bash
curl -X POST http://localhost:5173/api/inngest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "stat-chain/generate-puzzle",
    "data": { "date": "2025-11-20" }
  }'
```

**Check Inngest Dashboard:**
- View function execution logs
- See AI generation failures
- Review retry attempts

## Environment Variables

Required:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Inngest
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key

# AI Puzzle Generation
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional: Premium Sources
KENPOM_EMAIL=your@email.com
KENPOM_PASSWORD=yourpassword
```

## Performance Considerations

### Parallel vs Sequential

**Parallel** (fast but higher load):
- Team stats from multiple sources
- Player stats and injuries
- Supplementary data

**Sequential** (slower but safer):
- Foundational data (conferences → teams)
- Dependent data (teams → stats)

### Rate Limiting

Each scraper has configurable rate limits:
```typescript
rateLimit: 2000, // 2 seconds between requests
```

Adjust based on source requirements and politeness.

### Resource Usage

**Peak Usage:**
- Daily at 5 AM ET
- ~5-10 minutes for full run
- ~2-3 minutes for incremental

**Database:**
- Writes: Moderate (batched where possible)
- Reads: Light (mostly during puzzle generation)

**External APIs:**
- BartTorvik: ~350 requests (one per team)
- KenPom: ~350 requests
- ESPN: ~350 requests
- Total: ~1000 requests per full run

## Future Enhancements

### Phase 1 (Weeks 9-10): Additional Sources
- [ ] Haslametrics team stats
- [ ] T-Rank team stats
- [ ] NCAA.com official stats
- [ ] Player-level statistics

### Phase 2 (Weeks 11-12): Advanced Features
- [ ] Play-by-play data collection
- [ ] Historical data backfill
- [ ] Betting line tracking
- [ ] Social media sentiment analysis

### Phase 3 (Weeks 13-14): Intelligence
- [ ] Predictive quality scoring
- [ ] Anomaly detection (catch data issues)
- [ ] Smart scheduling (run during off-peak hours)
- [ ] A/B testing for puzzle difficulty

### Phase 4 (Weeks 15-16): Optimization
- [ ] Incremental puzzle updates
- [ ] Caching layer for frequent queries
- [ ] Parallel scraper execution within phases
- [ ] Webhook notifications for failures

## Credits

**Data Sources:**
- KenPom.com - Premium college basketball analytics
- BartTorvik.com - Advanced metrics and ratings
- ESPN.com - Traditional statistics and player data
- NCAA.com - Official statistics and records

**Technology:**
- Inngest - Reliable function orchestration
- Supabase - PostgreSQL database and auth
- Anthropic Claude - AI puzzle generation
- Playwright - Browser automation for scraping
