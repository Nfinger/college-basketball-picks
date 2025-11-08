# College Basketball Analytics Pipeline

Comprehensive Inggest-based data pipeline for scraping and storing advanced basketball analytics from multiple sources.

## Overview

This pipeline automatically scrapes team statistics from authoritative sources and stores them in Supabase for use in pick-making dashboards and analysis.

## Architecture

```
Data Sources → Scrapers → Team Resolver → Database → API → UI
```

### Components

1. **Base Scraper** (`lib/scrapers/base-scraper.ts`)
   - Abstract class providing retry logic, rate limiting, and error handling
   - Automatic logging to `scraper_runs` table for observability
   - Exponential backoff for failed requests
   - Configurable timeouts and rate limits

2. **Team Resolver** (`lib/scrapers/team-resolver.ts`)
   - Maps team names across multiple data sources
   - Supports exact matching via `external_ids` JSONB field
   - Fuzzy matching using Levenshtein distance
   - Auto-creates teams when needed
   - In-memory caching to avoid N+1 queries

3. **Concrete Scrapers**
   - **BartTorvik Scraper** (`lib/scrapers/barttorvik-scraper.ts`) - Implemented
   - KenPom Scraper - TODO
   - ESPN Stats Scraper - TODO

## Database Schema

### New Tables

**team_stats** - Stores advanced team analytics
```sql
- team_id (FK to teams)
- season (2024, 2025, etc.)
- offensive_efficiency, defensive_efficiency, tempo
- Rankings and strength metrics
- raw_stats (JSONB for source-specific fields)
- source ('barttorvik', 'kenpom', 'espn')
```

**scraper_runs** - Tracks job execution for monitoring
```sql
- source, job_type, status
- records_processed, records_created, records_updated
- error_message, duration_ms
- started_at, completed_at
```

**player_stats** - Individual player statistics (optional)
```sql
- player_name, team_id, season
- PPG, RPG, APG, shooting percentages
- Advanced metrics (PER, true shooting %, usage rate)
```

### Enhanced Tables

**teams** - Added `external_ids` JSONB column
```sql
external_ids: {
  "odds_api": "Duke Blue Devils",
  "barttorvik": "Duke",
  "kenpom": "Duke",
  "espn": "2390"
}
```

## Inngest Jobs

### Active Jobs

1. **scrapeGames** - Daily at 6am (existing)
2. **updateScores** - Periodic (existing)
3. **scrapeInjuries** - Every 6 hours (existing)
4. **scrapeBartTorvikStats** - Daily at 6am (NEW)

### Scheduling

- Games: Every 2 hours during season
- Team Stats: Daily at 6-7am
- Injuries: Every 6 hours
- Historical backfills: On-demand via Inngest dashboard

## Data Sources

### Tier 1: Implemented

- **BartTorvik.com**
  - Free, comprehensive tempo-free metrics
  - Offensive/defensive efficiency, tempo, SOS
  - Updated daily

### Tier 2: Planned

- **KenPom.com** (Requires $20/yr subscription)
  - Gold standard for efficiency ratings
  - Adjusted efficiency margins
  - Requires Playwright authentication

- **ESPN CBB**
  - Basic team statistics
  - Complementary to advanced metrics

## Usage

### Running Scrapers Manually

```bash
# Test BartTorvik scraper
npx tsx test-barttorvik-scraper.ts

# Via Inngest dev server
npm run inngest
# Then trigger job from http://localhost:8288
```

### Querying Team Stats

```typescript
// Get team stats for a specific season and source
const { data } = await supabase
  .from('team_stats')
  .select('*')
  .eq('team_id', teamId)
  .eq('season', 2025)
  .eq('source', 'barttorvik')
  .single()

// Get latest stats from any source
const { data } = await supabase
  .from('team_stats')
  .select('*')
  .eq('team_id', teamId)
  .eq('season', 2025)
  .order('updated_at', { ascending: false })
  .limit(1)
  .single()
```

### Monitoring Scrapers

```typescript
// Check latest scraper runs
const { data } = await supabase
  .from('latest_scraper_runs')
  .select('*')

// Check for failures
const { data } = await supabase
  .from('scraper_runs')
  .select('*')
  .eq('status', 'failure')
  .order('started_at', { ascending: false })
  .limit(10)
```

## Creating New Scrapers

### 1. Extend BaseScraper

```typescript
import { BaseScraper } from './base-scraper'
import type { ScraperConfig, ValidationResult, ScraperRunResult } from './base-scraper'

export class MyNewScraper extends BaseScraper<RawData, TransformedData> {
  protected config: ScraperConfig = {
    source: 'mysource',
    rateLimit: 1000,
    maxRetries: 3,
    timeout: 30000
  }

  protected getJobType(): string {
    return 'team_stats'
  }

  protected async scrape(): Promise<RawData[]> {
    // Implement scraping logic
  }

  protected validate(data: RawData[]): ValidationResult {
    // Implement validation
  }

  protected async transform(data: RawData[]): Promise<TransformedData[]> {
    // Use TeamResolver to map team names
    // Transform to database format
  }

  protected async save(data: TransformedData[]): Promise<ScraperRunResult> {
    // Upsert to database
  }
}
```

### 2. Create Inngest Function

```typescript
import { inngest } from '../client'
import { MyNewScraper } from '../../lib/scrapers/my-new-scraper'

export const scrapeMySource = inngest.createFunction(
  { id: 'scrape-my-source', name: 'Scrape My Source' },
  { cron: '0 6 * * *' },
  async ({ step }) => {
    return await step.run('scrape-and-save', async () => {
      const scraper = new MyNewScraper()
      return await scraper.run()
    })
  }
)
```

### 3. Register in API Route

```typescript
// app/routes/api.inngest.tsx
import { scrapeMySource } from '../../inngest/functions/scrape-my-source'

const handler = serve({
  client: inngest,
  functions: [...existingFunctions, scrapeMySource],
})
```

## Best Practices

### Rate Limiting

- Respect robots.txt
- Use scraper's built-in `rateLimit` config
- Implement exponential backoff (automatic in BaseScraper)

### Team Resolution

- Always initialize TeamResolver cache at scraper start
- Use fuzzy matching cautiously (review auto-created teams)
- Update external_ids when new mappings discovered

### Error Handling

- Validate data before saving
- Use partial success mode when appropriate
- Log errors to `scraper_runs` table
- Set up alerts for repeated failures

### Data Quality

- Validate efficiency ratings (typical range: 80-130)
- Validate tempo (typical range: 60-80)
- Check for anomalies before saving
- Store raw data in `raw_stats` JSONB for debugging

## Monitoring & Alerting

### Recommended Checks

1. **Data Freshness**
   - Alert if no successful run in 24 hours
   - Check `latest_scraper_runs` view

2. **Error Rate**
   - Alert if >10% failure rate
   - Monitor `scraper_runs.status = 'failure'`

3. **Record Counts**
   - Expect ~350+ D1 teams
   - Alert if sudden drop in records

4. **Performance**
   - Monitor `duration_ms` for slowdowns
   - Target: <60s per scraper run

## Next Steps

### Short Term

- [ ] Implement KenPom scraper (requires subscription)
- [ ] Create admin dashboard for scraper monitoring
- [ ] Set up alerting (email/Slack) for failures
- [ ] Add caching to API endpoints

### Medium Term

- [ ] ESPN stats scraper for complementary data
- [ ] Player stats scraping (optional)
- [ ] Historical backfill for previous seasons
- [ ] API endpoints for team analytics

### Long Term

- [ ] Machine learning features from raw stats
- [ ] Betting line movement tracking
- [ ] Real-time score updates during games
- [ ] Advanced visualizations and charts

## Support

For issues or questions:
1. Check `scraper_runs` table for error messages
2. Review logs in Inngest dashboard
3. Test scrapers manually with test scripts
4. Check external_ids mapping for team resolution issues

## References

- [BartTorvik.com](https://barttorvik.com/trank.php) - Free advanced metrics
- [KenPom.com](https://kenpom.com) - Premium efficiency ratings
- [Inngest Docs](https://www.inngest.com/docs) - Workflow orchestration
- [Supabase Docs](https://supabase.com/docs) - Database and auth
