# College Basketball Data Pipeline Architecture

**Comprehensive, Fault-Tolerant Data Collection System**

---

## Executive Summary

This document outlines a robust, production-ready data pipeline architecture for collecting comprehensive college basketball statistics using Inngest for orchestration. The design follows ruthless simplicity while providing enterprise-grade fault tolerance, data quality validation, and dependency management.

**Core Principles:**
- **Simplicity First**: Start with working vertical slices, add complexity only when needed
- **Fault Tolerance**: Every stage can fail and recover gracefully
- **Data Quality**: Validate at every boundary
- **Idempotency**: All operations can retry safely
- **Observability**: Track everything for debugging and optimization

---

## 1. Data Pipeline Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DAILY ORCHESTRATION TRIGGER                         │
│                         (5:00 AM EST Daily)                              │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      MASTER ORCHESTRATOR                                 │
│  - Determines what needs updating (season state, data age)               │
│  - Triggers dependency tree execution                                    │
│  - Monitors overall pipeline health                                      │
│  - Handles global rate limiting                                          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
    ┌───────────────────────┐        ┌───────────────────────┐
    │   FOUNDATIONAL DATA   │        │  REFERENCE DATA       │
    │   (Must Complete)     │        │  (Can Parallelize)    │
    └───────────┬───────────┘        └───────────┬───────────┘
                │                                 │
                ▼                                 ▼
    ┌───────────────────────┐        ┌───────────────────────┐
    │  1. Conference Data   │        │  5. Tournament Data   │
    │     (ncaa.com)        │        │     (ncaa.com API)    │
    └───────────┬───────────┘        └───────────────────────┘
                │
                ▼
    ┌───────────────────────┐        ┌───────────────────────┐
    │  2. Team Rosters      │        │  6. Betting Lines     │
    │     (ESPN/NCAA.com)   │        │     (Odds API)        │
    └───────────┬───────────┘        └───────────────────────┘
                │
                ▼
    ┌───────────────────────┐
    │  3. Games Schedule    │
    │     (ESPN API)        │
    └───────────┬───────────┘
                │
                ▼
                │
    ┌───────────┴───────────────────────────────────┐
    │          DATA COLLECTION STAGE                │
    │         (Parallel Execution)                  │
    └───────────┬───────────────────────────────────┘
                │
    ┌───────────┴────────────────────────┐
    │                                    │
    ▼                                    ▼
┌─────────────────────┐      ┌─────────────────────┐
│  ADVANCED STATS     │      │  TRADITIONAL STATS  │
│  (Can Run Parallel) │      │  (Can Run Parallel) │
└──────────┬──────────┘      └──────────┬──────────┘
           │                             │
    ┌──────┴──────┐              ┌──────┴──────┐
    ▼             ▼              ▼             ▼
┌─────────┐  ┌─────────┐   ┌─────────┐  ┌─────────┐
│ KenPom  │  │BartTorv │   │  ESPN   │  │NCAA.com │
│(Premium)│  │ (Free)  │   │ Stats   │  │  Stats  │
└─────────┘  └─────────┘   └─────────┘  └─────────┘
    │             │              │             │
    └──────┬──────┘              └──────┬──────┘
           │                            │
           ▼                            ▼
┌─────────────────────┐      ┌─────────────────────┐
│  Haslametrics       │      │  Player Stats       │
│  T-Rank             │      │  (ESPN/NCAA)        │
└─────────────────────┘      └─────────────────────┘
           │                            │
           └──────────┬─────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              CONTEXTUAL DATA STAGE                   │
│              (Depends on Games)                      │
└──────────────────────┬──────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    ▼                  ▼                  ▼
┌─────────┐    ┌──────────────┐   ┌──────────────┐
│Injuries │    │Play-by-Play  │   │News/Analysis │
│(Rotowire│    │(ESPN/NCAA)   │   │(RSS/APIs)    │
│  ESPN)  │    │              │   │              │
└─────────┘    └──────────────┘   └──────────────┘
    │                  │                  │
    └──────────────────┼──────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            VALIDATION & AGGREGATION                  │
│  - Cross-source consistency checks                   │
│  - Data quality metrics                              │
│  - Outlier detection                                 │
│  - Completeness scoring                              │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            DERIVED DATA & CACHING                    │
│  - Generate composite rankings                       │
│  - Update materialized views                         │
│  - Cache frequently accessed queries                 │
│  - Trigger downstream notifications                  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│               COMPLETION & REPORTING                 │
│  - Pipeline health report                            │
│  - Data freshness metrics                            │
│  - Alert on failures                                 │
│  - Update dashboard                                  │
└─────────────────────────────────────────────────────┘
```

**Key Dependencies:**
```
Conferences → Teams → Games → Everything Else
Teams → Team Stats
Games → Play-by-Play, Injuries (game-specific)
```

---

## 2. Inngest Function Architecture

### 2.1 Master Orchestrator

```typescript
/**
 * Main orchestrator - runs daily and coordinates entire pipeline
 * Determines what needs updating and triggers appropriate workflows
 */
export const dailyDataPipelineOrchestrator = inngest.createFunction(
  {
    id: 'daily-data-pipeline',
    name: 'Daily Basketball Data Pipeline Orchestrator',
    concurrency: { limit: 1 }, // Only one orchestrator at a time
  },
  { cron: '0 5 * * *' }, // 5 AM EST daily
  async ({ step, logger }) => {
    const pipelineRunId = crypto.randomUUID()

    // Step 1: Initialize pipeline state
    const state = await step.run('initialize-pipeline', async () => {
      return await initializePipelineRun(pipelineRunId)
    })

    // Step 2: Foundational data (sequential - must complete)
    const foundational = await step.run('collect-foundational-data', async () => {
      // These run in sequence as each depends on previous
      const conferences = await inngest.send({ name: 'data/conferences.fetch' })
      const teams = await inngest.send({ name: 'data/teams.fetch' })
      const games = await inngest.send({ name: 'data/games.fetch' })

      return { conferences, teams, games }
    })

    // Step 3: Reference data (parallel - independent)
    const reference = await step.run('collect-reference-data', async () => {
      // These can run in parallel
      return await Promise.allSettled([
        inngest.send({ name: 'data/tournaments.fetch' }),
        inngest.send({ name: 'data/betting-lines.fetch' }),
      ])
    })

    // Step 4: Advanced statistics (parallel - all depend on teams)
    const advancedStats = await step.run('collect-advanced-stats', async () => {
      return await Promise.allSettled([
        inngest.send({ name: 'data/kenpom-stats.fetch' }),
        inngest.send({ name: 'data/barttorvik-stats.fetch' }),
        inngest.send({ name: 'data/haslametrics-stats.fetch' }),
        inngest.send({ name: 'data/trank-stats.fetch' }),
      ])
    })

    // Step 5: Traditional statistics (parallel)
    const traditionalStats = await step.run('collect-traditional-stats', async () => {
      return await Promise.allSettled([
        inngest.send({ name: 'data/espn-stats.fetch' }),
        inngest.send({ name: 'data/ncaa-stats.fetch' }),
        inngest.send({ name: 'data/espn-players.fetch' }),
      ])
    })

    // Step 6: Contextual data (parallel - depends on games)
    const contextual = await step.run('collect-contextual-data', async () => {
      return await Promise.allSettled([
        inngest.send({ name: 'data/injuries.fetch' }),
        inngest.send({ name: 'data/play-by-play.fetch' }),
        inngest.send({ name: 'data/news.aggregate' }),
      ])
    })

    // Step 7: Validation and quality checks
    const validation = await step.run('validate-data-quality', async () => {
      return await validatePipelineData(pipelineRunId)
    })

    // Step 8: Generate derived data
    const derived = await step.run('generate-derived-data', async () => {
      return await generateCompositeMetrics(pipelineRunId)
    })

    // Step 9: Finalize and report
    return await step.run('finalize-pipeline', async () => {
      return await finalizePipelineRun(pipelineRunId, {
        foundational,
        reference,
        advancedStats,
        traditionalStats,
        contextual,
        validation,
        derived,
      })
    })
  }
)
```

### 2.2 Data Collection Functions (Pattern)

Each data source follows this pattern:

```typescript
/**
 * Template for all data collection functions
 * Provides fault tolerance, retry logic, and observability
 */
export const createDataCollectionFunction = (config: {
  id: string
  name: string
  source: string
  jobType: string
  scraperClass: typeof BaseScraper
  retries?: number
  rateLimit?: { limit: number, period: string }
}) => {
  return inngest.createFunction(
    {
      id: config.id,
      name: config.name,
      retries: config.retries || 3,
      rateLimit: config.rateLimit,
    },
    { event: `data/${config.id}.fetch` },
    async ({ step, event, logger }) => {
      // Step 1: Check if data is fresh enough (idempotency)
      const needsUpdate = await step.run('check-freshness', async () => {
        return await checkDataFreshness(config.source, config.jobType)
      })

      if (!needsUpdate.required) {
        logger.info('Data is fresh, skipping collection', needsUpdate)
        return { skipped: true, reason: 'data_fresh', ...needsUpdate }
      }

      // Step 2: Verify dependencies
      const deps = await step.run('verify-dependencies', async () => {
        return await verifyDependencies(config.source, config.jobType)
      })

      if (!deps.satisfied) {
        throw new Error(`Dependencies not met: ${deps.missing.join(', ')}`)
      }

      // Step 3: Run scraper with circuit breaker
      const result = await step.run('collect-data', async () => {
        const scraper = new config.scraperClass()
        return await withCircuitBreaker(
          config.source,
          () => scraper.run()
        )
      })

      // Step 4: Validate collected data
      const validation = await step.run('validate-data', async () => {
        return await validateCollectedData(config.source, result)
      })

      if (!validation.passed) {
        logger.warn('Data validation failed', validation)
        // Don't throw - partial success is better than total failure
      }

      // Step 5: Update metadata
      await step.run('update-metadata', async () => {
        return await updateDataMetadata(config.source, config.jobType, {
          lastUpdate: new Date(),
          recordCount: result.recordsProcessed,
          quality: validation.score,
        })
      })

      return {
        success: result.success,
        ...result,
        validation,
      }
    }
  )
}

// Example usage:
export const collectKenPomStats = createDataCollectionFunction({
  id: 'kenpom-stats',
  name: 'Collect KenPom Statistics',
  source: 'kenpom',
  jobType: 'team_stats',
  scraperClass: KenPomScraper,
  retries: 3,
  rateLimit: { limit: 10, period: '1m' }, // Max 10 calls per minute
})
```

### 2.3 Validation Functions

```typescript
/**
 * Data quality validation - runs after collection
 */
export const validateDataQuality = inngest.createFunction(
  {
    id: 'validate-data-quality',
    name: 'Validate Data Quality',
  },
  { event: 'data/validate.trigger' },
  async ({ step, event }) => {
    const { source, jobType, runId } = event.data

    // Step 1: Schema validation
    const schema = await step.run('validate-schema', async () => {
      return await validateSchema(source, jobType)
    })

    // Step 2: Consistency checks (cross-source)
    const consistency = await step.run('check-consistency', async () => {
      return await checkCrossSourceConsistency(source, jobType)
    })

    // Step 3: Outlier detection
    const outliers = await step.run('detect-outliers', async () => {
      return await detectOutliers(source, jobType)
    })

    // Step 4: Completeness check
    const completeness = await step.run('check-completeness', async () => {
      return await checkDataCompleteness(source, jobType)
    })

    // Step 5: Calculate quality score
    const qualityScore = await step.run('calculate-quality', async () => {
      return calculateQualityScore({
        schema,
        consistency,
        outliers,
        completeness,
      })
    })

    // Step 6: Alert if quality is poor
    if (qualityScore < 0.7) {
      await step.run('send-quality-alert', async () => {
        return await sendAlert({
          type: 'data_quality',
          severity: qualityScore < 0.5 ? 'critical' : 'warning',
          source,
          jobType,
          score: qualityScore,
          details: { schema, consistency, outliers, completeness },
        })
      })
    }

    return { qualityScore, schema, consistency, outliers, completeness }
  }
)
```

### 2.4 Error Handling & Retry Functions

```typescript
/**
 * Dead letter queue handler for failed operations
 */
export const handleFailedOperation = inngest.createFunction(
  {
    id: 'handle-failed-operation',
    name: 'Handle Failed Data Collection',
  },
  { event: 'data/collection.failed' },
  async ({ step, event }) => {
    const { source, jobType, error, attemptCount } = event.data

    // Step 1: Log to dead letter queue
    await step.run('log-to-dlq', async () => {
      return await logToDeadLetterQueue({
        source,
        jobType,
        error,
        attemptCount,
        timestamp: new Date(),
      })
    })

    // Step 2: Check if circuit breaker should open
    const circuitState = await step.run('check-circuit-breaker', async () => {
      return await updateCircuitBreaker(source, 'failure')
    })

    if (circuitState === 'open') {
      // Step 3: Send alert for repeated failures
      await step.run('alert-circuit-open', async () => {
        return await sendAlert({
          type: 'circuit_breaker',
          severity: 'critical',
          source,
          message: `Circuit breaker opened for ${source} after repeated failures`,
        })
      })
    }

    // Step 4: Attempt fallback to cached data
    await step.run('use-fallback-data', async () => {
      return await useCachedData(source, jobType)
    })

    return { circuitState, fallbackUsed: true }
  }
)

/**
 * Circuit breaker recovery check
 */
export const checkCircuitBreakerRecovery = inngest.createFunction(
  {
    id: 'check-circuit-recovery',
    name: 'Check Circuit Breaker Recovery',
  },
  { cron: '*/15 * * * *' }, // Every 15 minutes
  async ({ step }) => {
    // Find all open circuit breakers
    const openCircuits = await step.run('find-open-circuits', async () => {
      return await getOpenCircuitBreakers()
    })

    // Try to recover each one
    for (const circuit of openCircuits) {
      await step.run(`test-recovery-${circuit.source}`, async () => {
        return await testCircuitRecovery(circuit.source)
      })
    }

    return { tested: openCircuits.length }
  }
)
```

---

## 3. Data Models & State Tracking

### 3.1 Enhanced Scraper Runs Table

```sql
-- Extend existing scraper_runs table
ALTER TABLE scraper_runs ADD COLUMN IF NOT EXISTS pipeline_run_id UUID;
ALTER TABLE scraper_runs ADD COLUMN IF NOT EXISTS parent_run_id UUID REFERENCES scraper_runs(id);
ALTER TABLE scraper_runs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE scraper_runs ADD COLUMN IF NOT EXISTS circuit_breaker_state TEXT; -- 'closed', 'open', 'half_open'

CREATE INDEX idx_scraper_runs_pipeline_run ON scraper_runs(pipeline_run_id);
CREATE INDEX idx_scraper_runs_parent ON scraper_runs(parent_run_id);
```

### 3.2 Pipeline Runs Table

```sql
-- Track overall pipeline execution
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Execution info
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'partial', 'failed'
  triggered_by TEXT NOT NULL, -- 'cron', 'manual', 'event'

  -- Stage completion tracking
  stages_completed JSONB DEFAULT '[]'::jsonb,
  stages_failed JSONB DEFAULT '[]'::jsonb,

  -- Metrics
  total_sources INTEGER DEFAULT 0,
  sources_succeeded INTEGER DEFAULT 0,
  sources_failed INTEGER DEFAULT 0,
  sources_skipped INTEGER DEFAULT 0,

  total_records_processed INTEGER DEFAULT 0,
  total_records_created INTEGER DEFAULT 0,
  total_records_updated INTEGER DEFAULT 0,

  -- Quality metrics
  overall_quality_score NUMERIC(3, 2),
  quality_checks_passed INTEGER DEFAULT 0,
  quality_checks_failed INTEGER DEFAULT 0,

  -- Performance
  duration_ms INTEGER,

  -- Metadata
  season INTEGER NOT NULL, -- Which season this pipeline run is for
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_season ON pipeline_runs(season);
CREATE INDEX idx_pipeline_runs_started_at ON pipeline_runs(started_at DESC);
```

### 3.3 Data Freshness Tracking

```sql
-- Track when each data source was last updated
CREATE TABLE data_freshness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source TEXT NOT NULL,
  job_type TEXT NOT NULL,

  -- Freshness tracking
  last_successful_run TIMESTAMPTZ,
  last_attempt TIMESTAMPTZ,
  record_count INTEGER DEFAULT 0,

  -- Quality metrics
  quality_score NUMERIC(3, 2),
  validation_errors TEXT[],

  -- Staleness detection
  expected_update_frequency INTERVAL, -- e.g., '1 day'
  is_stale BOOLEAN GENERATED ALWAYS AS (
    last_successful_run < NOW() - expected_update_frequency
  ) STORED,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source, job_type)
);

CREATE INDEX idx_data_freshness_stale ON data_freshness(is_stale) WHERE is_stale = true;
CREATE INDEX idx_data_freshness_last_run ON data_freshness(last_successful_run);
```

### 3.4 Circuit Breaker State

```sql
-- Track circuit breaker state for each source
CREATE TABLE circuit_breaker_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source TEXT NOT NULL UNIQUE,

  -- Circuit state
  state TEXT NOT NULL DEFAULT 'closed', -- 'closed', 'open', 'half_open'
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,

  -- Thresholds (configurable per source)
  failure_threshold INTEGER DEFAULT 5, -- Open after N failures
  success_threshold INTEGER DEFAULT 2, -- Close after N successes in half-open
  timeout_seconds INTEGER DEFAULT 300, -- Try recovery after 5 minutes

  -- State tracking
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,

  -- Can try recovery?
  can_retry BOOLEAN GENERATED ALWAYS AS (
    state = 'open' AND
    opened_at < NOW() - (timeout_seconds || ' seconds')::INTERVAL
  ) STORED,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_circuit_breaker_state ON circuit_breaker_state(state);
CREATE INDEX idx_circuit_breaker_can_retry ON circuit_breaker_state(can_retry) WHERE can_retry = true;
```

### 3.5 Data Quality Metrics

```sql
-- Store detailed quality metrics per source
CREATE TABLE data_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source TEXT NOT NULL,
  job_type TEXT NOT NULL,
  pipeline_run_id UUID REFERENCES pipeline_runs(id),

  -- Quality dimensions (0-1 scale)
  schema_validity_score NUMERIC(3, 2),
  completeness_score NUMERIC(3, 2),
  consistency_score NUMERIC(3, 2),
  timeliness_score NUMERIC(3, 2),

  -- Overall score (weighted average)
  overall_score NUMERIC(3, 2),

  -- Detailed results
  schema_errors TEXT[],
  missing_fields TEXT[],
  consistency_issues JSONB DEFAULT '[]'::jsonb,
  outliers_detected JSONB DEFAULT '[]'::jsonb,

  -- Pass/Fail
  passed BOOLEAN,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_quality_source ON data_quality_metrics(source, job_type);
CREATE INDEX idx_data_quality_pipeline ON data_quality_metrics(pipeline_run_id);
CREATE INDEX idx_data_quality_passed ON data_quality_metrics(passed);
```

### 3.6 Dependencies Table

```sql
-- Define dependencies between data sources
CREATE TABLE data_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source TEXT NOT NULL,
  job_type TEXT NOT NULL,

  -- What this depends on
  depends_on_source TEXT NOT NULL,
  depends_on_job_type TEXT NOT NULL,

  -- Is this a hard or soft dependency?
  is_required BOOLEAN DEFAULT true,

  -- How fresh must the dependency be?
  max_age_hours INTEGER DEFAULT 24,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source, job_type, depends_on_source, depends_on_job_type)
);

-- Seed with known dependencies
INSERT INTO data_dependencies (source, job_type, depends_on_source, depends_on_job_type, is_required) VALUES
  ('teams', 'rosters', 'conferences', 'list', true),
  ('games', 'schedule', 'teams', 'rosters', true),
  ('kenpom', 'team_stats', 'teams', 'rosters', true),
  ('barttorvik', 'team_stats', 'teams', 'rosters', true),
  ('espn', 'team_stats', 'teams', 'rosters', true),
  ('espn', 'player_stats', 'teams', 'rosters', true),
  ('injuries', 'reports', 'games', 'schedule', true),
  ('play_by_play', 'events', 'games', 'schedule', true),
  ('news', 'articles', 'teams', 'rosters', false); -- Soft dependency
```

---

## 4. Scheduling Strategy

### 4.1 Time-Based Schedule

```
Season State-Aware Scheduling:

PRE-SEASON (September - November):
- Daily 6 AM EST: Team rosters, conference changes
- Weekly: Historical stats for analysis
- Minimal: No games to scrape yet

REGULAR SEASON (November - March):
- 5:00 AM: Master orchestrator starts
- 5:05 AM: Foundational data (conferences, teams, games)
- 5:15 AM: Advanced stats (KenPom, BartTorvik, etc.) - parallel
- 5:20 AM: Traditional stats (ESPN, NCAA) - parallel
- 5:30 AM: Contextual (injuries, news, play-by-play) - parallel
- 6:00 AM: Validation and quality checks
- 6:15 AM: Derived data generation
- Throughout day: Score updates every 5 minutes during game times

POST-SEASON (March - April - Tournament):
- More frequent updates during tournament (every hour)
- Bracket data collection
- Enhanced injury monitoring
- Real-time score updates

OFF-SEASON (May - August):
- Weekly: Team roster updates (transfers, recruiting)
- Monthly: Historical data verification
- Minimal: Most sources don't update
```

### 4.2 Dependency-Aware Execution

```typescript
/**
 * Check if dependencies are satisfied before running
 */
async function verifyDependencies(
  source: string,
  jobType: string
): Promise<{ satisfied: boolean; missing: string[] }> {
  // Get dependencies from database
  const deps = await supabase
    .from('data_dependencies')
    .select('*')
    .eq('source', source)
    .eq('job_type', jobType)

  const missing: string[] = []

  for (const dep of deps.data || []) {
    // Check if dependency data exists and is fresh
    const depData = await supabase
      .from('data_freshness')
      .select('*')
      .eq('source', dep.depends_on_source)
      .eq('job_type', dep.depends_on_job_type)
      .single()

    if (!depData.data) {
      if (dep.is_required) {
        missing.push(`${dep.depends_on_source}:${dep.depends_on_job_type}`)
      }
      continue
    }

    // Check freshness
    const age = Date.now() - new Date(depData.data.last_successful_run).getTime()
    const maxAge = dep.max_age_hours * 60 * 60 * 1000

    if (age > maxAge && dep.is_required) {
      missing.push(
        `${dep.depends_on_source}:${dep.depends_on_job_type} (too stale: ${age}ms old)`
      )
    }
  }

  return {
    satisfied: missing.length === 0,
    missing,
  }
}
```

### 4.3 Rate Limiting & Concurrency

```typescript
/**
 * Global rate limiting configuration
 */
const RATE_LIMITS = {
  // Premium sources - respect subscription limits
  kenpom: { limit: 10, period: '1m', concurrent: 1 },

  // Free public APIs - be respectful
  barttorvik: { limit: 30, period: '1m', concurrent: 2 },
  espn: { limit: 60, period: '1m', concurrent: 3 },
  ncaa: { limit: 30, period: '1m', concurrent: 2 },

  // Commercial APIs - paid limits
  odds_api: { limit: 100, period: '1m', concurrent: 5 },

  // RSS feeds - very gentle
  news_feeds: { limit: 10, period: '5m', concurrent: 1 },
}

/**
 * Apply rate limiting to functions
 */
export const collectKenPomStats = createDataCollectionFunction({
  id: 'kenpom-stats',
  // ... other config
  rateLimit: RATE_LIMITS.kenpom,
  concurrency: { limit: RATE_LIMITS.kenpom.concurrent },
})
```

---

## 5. Error Handling & Fault Tolerance

### 5.1 Retry Strategies

```typescript
/**
 * Tiered retry strategy based on error type
 */
const RETRY_STRATEGIES = {
  // Network errors - retry quickly
  network: {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },

  // Rate limit errors - respect server
  rateLimit: {
    maxRetries: 3,
    initialDelay: 5000,
    maxDelay: 60000,
    backoffMultiplier: 3,
  },

  // Authentication errors - retry less
  auth: {
    maxRetries: 2,
    initialDelay: 2000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },

  // Data validation errors - fail fast
  validation: {
    maxRetries: 1,
    initialDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
  },
}

async function retryWithStrategy(
  fn: () => Promise<any>,
  errorType: keyof typeof RETRY_STRATEGIES
): Promise<any> {
  const strategy = RETRY_STRATEGIES[errorType]
  let delay = strategy.initialDelay

  for (let attempt = 1; attempt <= strategy.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === strategy.maxRetries) {
        throw error
      }

      await sleep(delay)
      delay = Math.min(delay * strategy.backoffMultiplier, strategy.maxDelay)
    }
  }
}
```

### 5.2 Circuit Breaker Implementation

```typescript
/**
 * Circuit breaker pattern for failing sources
 */
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half_open' = 'closed'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime?: Date

  constructor(
    private source: string,
    private failureThreshold = 5,
    private successThreshold = 2,
    private timeoutMs = 300000 // 5 minutes
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if we should try recovery
      if (this.shouldAttemptRecovery()) {
        this.state = 'half_open'
        this.successCount = 0
      } else {
        throw new Error(`Circuit breaker OPEN for ${this.source}`)
      }
    }

    try {
      const result = await fn()
      await this.onSuccess()
      return result
    } catch (error) {
      await this.onFailure(error)
      throw error
    }
  }

  private shouldAttemptRecovery(): boolean {
    if (!this.lastFailureTime) return false

    const timeSinceFailure = Date.now() - this.lastFailureTime.getTime()
    return timeSinceFailure >= this.timeoutMs
  }

  private async onSuccess() {
    this.failureCount = 0

    if (this.state === 'half_open') {
      this.successCount++

      if (this.successCount >= this.successThreshold) {
        this.state = 'closed'
        await this.updateDatabase('closed')
        await sendAlert({
          type: 'circuit_breaker_recovery',
          severity: 'info',
          source: this.source,
          message: `Circuit breaker closed for ${this.source}`,
        })
      }
    }
  }

  private async onFailure(error: any) {
    this.failureCount++
    this.lastFailureTime = new Date()

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open'
      await this.updateDatabase('open')
      await sendAlert({
        type: 'circuit_breaker_open',
        severity: 'critical',
        source: this.source,
        message: `Circuit breaker OPENED for ${this.source}`,
        error: error.message,
      })
    }
  }

  private async updateDatabase(state: string) {
    await supabase
      .from('circuit_breaker_state')
      .upsert({
        source: this.source,
        state,
        failure_count: this.failureCount,
        success_count: this.successCount,
        last_failure_at: this.lastFailureTime,
        updated_at: new Date(),
      })
  }
}

// Global circuit breaker instances
const circuitBreakers = new Map<string, CircuitBreaker>()

export async function withCircuitBreaker<T>(
  source: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!circuitBreakers.has(source)) {
    circuitBreakers.set(source, new CircuitBreaker(source))
  }

  const breaker = circuitBreakers.get(source)!
  return await breaker.execute(fn)
}
```

### 5.3 Graceful Degradation

```typescript
/**
 * Fallback to cached data when sources fail
 */
async function useCachedData(source: string, jobType: string) {
  const cached = await supabase
    .from('data_freshness')
    .select('metadata')
    .eq('source', source)
    .eq('job_type', jobType)
    .single()

  if (!cached.data?.metadata?.cached_snapshot) {
    throw new Error(`No cached data available for ${source}:${jobType}`)
  }

  await sendAlert({
    type: 'using_cached_data',
    severity: 'warning',
    source,
    jobType,
    age: cached.data.metadata.cache_age,
  })

  // Mark data as stale but usable
  return {
    usedCache: true,
    cacheAge: cached.data.metadata.cache_age,
    data: cached.data.metadata.cached_snapshot,
  }
}

/**
 * Save snapshot of good data for fallback
 */
async function cacheDataSnapshot(
  source: string,
  jobType: string,
  data: any
) {
  await supabase
    .from('data_freshness')
    .update({
      metadata: {
        cached_snapshot: data,
        cache_age: 0,
        cached_at: new Date().toISOString(),
      },
    })
    .eq('source', source)
    .eq('job_type', jobType)
}
```

### 5.4 Alerting Strategy

```typescript
/**
 * Tiered alerting based on severity
 */
type AlertSeverity = 'info' | 'warning' | 'error' | 'critical'

interface Alert {
  type: string
  severity: AlertSeverity
  source?: string
  message: string
  details?: any
}

async function sendAlert(alert: Alert) {
  // Log to database
  await supabase.from('alerts').insert({
    type: alert.type,
    severity: alert.severity,
    source: alert.source,
    message: alert.message,
    details: alert.details,
    created_at: new Date(),
  })

  // Send to appropriate channels based on severity
  switch (alert.severity) {
    case 'critical':
      // Page on-call, send SMS
      await sendSMS(alert)
      await sendEmail(alert)
      await sendSlack(alert, '#alerts-critical')
      break

    case 'error':
      // Email + Slack
      await sendEmail(alert)
      await sendSlack(alert, '#alerts-errors')
      break

    case 'warning':
      // Slack only
      await sendSlack(alert, '#alerts-warnings')
      break

    case 'info':
      // Log only (optional Slack)
      console.info('[ALERT]', alert)
      break
  }
}

/**
 * Alert conditions
 */
const ALERT_CONDITIONS = {
  // Multiple failures
  repeated_failures: {
    condition: (failures: number) => failures >= 3,
    severity: 'error' as AlertSeverity,
  },

  // Circuit breaker opened
  circuit_open: {
    condition: () => true,
    severity: 'critical' as AlertSeverity,
  },

  // Data quality below threshold
  poor_quality: {
    condition: (score: number) => score < 0.5,
    severity: 'critical' as AlertSeverity,
  },

  // Data staleness
  stale_data: {
    condition: (ageHours: number) => ageHours > 48,
    severity: 'warning' as AlertSeverity,
  },

  // Pipeline partially failed
  partial_failure: {
    condition: (successRate: number) => successRate < 0.8,
    severity: 'warning' as AlertSeverity,
  },
}
```

---

## 6. Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Goal**: Core infrastructure working end-to-end

**Tasks**:
1. Create data models (pipeline_runs, data_freshness, circuit_breaker_state)
2. Implement master orchestrator skeleton
3. Enhance BaseScraper with circuit breaker support
4. Create data collection function factory
5. Build basic validation framework
6. Set up alerting infrastructure

**Deliverables**:
- ✅ Database schema deployed
- ✅ Orchestrator running daily
- ✅ One scraper (BartTorvik) fully integrated
- ✅ Basic alerting working

**Success Criteria**:
- Pipeline runs end-to-end
- Failures are logged and alerted
- Can view pipeline status in dashboard

---

### Phase 2: Core Data Sources (Week 3-4)

**Goal**: All existing scrapers integrated into pipeline

**Tasks**:
1. Migrate existing scrapers to new pattern
   - KenPom
   - BartTorvik
   - ESPN Stats
   - ESPN Players
   - Injuries
   - News
2. Implement dependency checking
3. Add data freshness tracking
4. Build quality validation for each source
5. Create pipeline dashboard

**Deliverables**:
- ✅ All existing scrapers in pipeline
- ✅ Dependencies enforced
- ✅ Quality metrics tracked
- ✅ Dashboard showing pipeline health

**Success Criteria**:
- Daily runs complete successfully
- Quality scores meet thresholds (>0.7)
- Failed sources don't break pipeline

---

### Phase 3: Advanced Sources (Week 5-6)

**Goal**: Add comprehensive data sources

**New Scrapers**:
1. **Haslametrics** (advanced stats)
2. **T-Rank** (tempo-free rankings)
3. **NCAA.com** (official stats)
4. **Play-by-Play** (detailed game events)
5. **Betting Lines** (Odds API integration)
6. **Tournament Data** (brackets, seeds)

**Tasks**:
1. Implement new scrapers following pattern
2. Add to orchestrator workflow
3. Define dependencies
4. Create validation rules
5. Update dashboard

**Deliverables**:
- ✅ 6 new data sources integrated
- ✅ Comprehensive stats coverage
- ✅ All sources monitored

**Success Criteria**:
- >90% of target data sources operational
- Cross-source consistency >85%
- Pipeline completes in <2 hours

---

### Phase 4: Intelligence & Optimization (Week 7-8)

**Goal**: Smart pipeline that learns and adapts

**Tasks**:
1. **Adaptive Scheduling**
   - Skip sources when data is fresh
   - Increase frequency during season peaks
   - Reduce during off-season

2. **Quality Intelligence**
   - ML-based outlier detection
   - Automated consistency checking
   - Predictive failure detection

3. **Performance Optimization**
   - Identify bottlenecks
   - Optimize parallel execution
   - Reduce redundant operations

4. **Advanced Alerting**
   - Anomaly detection
   - Trend analysis
   - Predictive alerts

**Deliverables**:
- ✅ Smart scheduling system
- ✅ Advanced quality checks
- ✅ Optimized execution plan
- ✅ Predictive monitoring

**Success Criteria**:
- Pipeline runtime reduced by 30%
- False positive alerts reduced by 50%
- Quality scores consistently >0.85
- Zero critical data gaps

---

## 7. Monitoring & Observability

### 7.1 Key Metrics

**Pipeline Health**:
- Overall success rate (target: >95%)
- Average duration (target: <2 hours)
- Sources failing (target: 0 critical sources)
- Quality score (target: >0.85)

**Data Quality**:
- Freshness (target: <24 hours for all sources)
- Completeness (target: >90% of expected records)
- Consistency (target: <5% variance across sources)
- Validation pass rate (target: >95%)

**Performance**:
- Time per source
- Records processed per minute
- API quota usage
- Database load

**Reliability**:
- Circuit breaker state (target: all closed)
- Retry rate (target: <10%)
- Fallback usage (target: <5%)
- Alert volume (target: <10 per day)

### 7.2 Dashboard Views

**Operations Dashboard**:
```
┌─────────────────────────────────────────┐
│     BASKETBALL DATA PIPELINE            │
│                                         │
│  Status: ✅ Healthy                     │
│  Last Run: 2 hours ago                 │
│  Quality: 0.87                         │
│  Duration: 1h 23m                      │
│                                         │
│  Sources: 12/14 ✅  2 ⚠️               │
│                                         │
│  ┌─ Recent Runs ──────────────┐        │
│  │ 5:00 AM ✅ Success          │        │
│  │ Yesterday ✅ Success        │        │
│  │ 2 days ago ⚠️ Partial       │        │
│  └────────────────────────────┘        │
│                                         │
│  ┌─ Active Issues ────────────┐        │
│  │ ⚠️ KenPom: Rate limited     │        │
│  │ ⚠️ News: 3 feeds slow       │        │
│  └────────────────────────────┘        │
└─────────────────────────────────────────┘
```

**Source Health Grid**:
```
Source         Status  Quality  Age   Records
─────────────────────────────────────────────
KenPom         ✅      0.92     2h    363
BartTorvik     ✅      0.89     2h    363
ESPN Stats     ✅      0.85     2h    363
ESPN Players   ⚠️      0.72     3h    2,847
Injuries       ✅      0.95     1h    127
News           ✅      0.88     2h    456
Haslametrics   ✅      0.91     2h    363
T-Rank         ❌      -        24h   -
NCAA.com       ✅      0.86     2h    363
Play-by-Play   ✅      0.94     2h    1,234
Odds API       ✅      0.98     1h    89
Tournaments    ✅      1.00     6h    68
```

### 7.3 Logging Strategy

```typescript
/**
 * Structured logging for observability
 */
const logger = {
  info: (msg: string, meta?: object) => {
    console.log(JSON.stringify({
      level: 'info',
      message: msg,
      timestamp: new Date().toISOString(),
      ...meta,
    }))
  },

  warn: (msg: string, meta?: object) => {
    console.warn(JSON.stringify({
      level: 'warn',
      message: msg,
      timestamp: new Date().toISOString(),
      ...meta,
    }))
  },

  error: (msg: string, error: Error, meta?: object) => {
    console.error(JSON.stringify({
      level: 'error',
      message: msg,
      error: {
        message: error.message,
        stack: error.stack,
      },
      timestamp: new Date().toISOString(),
      ...meta,
    }))
  },
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```typescript
describe('CircuitBreaker', () => {
  it('should open after threshold failures', async () => {
    const breaker = new CircuitBreaker('test', 3)

    // Simulate 3 failures
    for (let i = 0; i < 3; i++) {
      await expect(
        breaker.execute(() => Promise.reject('fail'))
      ).rejects.toThrow()
    }

    // Next call should fail immediately
    await expect(
      breaker.execute(() => Promise.resolve('ok'))
    ).rejects.toThrow('Circuit breaker OPEN')
  })

  it('should attempt recovery after timeout', async () => {
    // Test half-open state logic
  })
})

describe('DataValidation', () => {
  it('should detect schema violations', async () => {
    const invalidData = [{ /* missing required fields */ }]
    const result = await validateSchema('test', invalidData)

    expect(result.passed).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should detect outliers', async () => {
    // Test outlier detection logic
  })
})
```

### 8.2 Integration Tests

```typescript
describe('Pipeline Integration', () => {
  it('should complete full pipeline run', async () => {
    const result = await runPipeline('test')

    expect(result.status).toBe('success')
    expect(result.sourcesSucceeded).toBeGreaterThan(0)
    expect(result.overallQualityScore).toBeGreaterThan(0.7)
  })

  it('should handle partial failures gracefully', async () => {
    // Mock one source failing
    // Verify pipeline continues
  })

  it('should enforce dependencies', async () => {
    // Try to run dependent source without dependency
    // Verify it fails with clear error
  })
})
```

### 8.3 Load Tests

```typescript
describe('Performance', () => {
  it('should handle concurrent scraping', async () => {
    const start = Date.now()

    // Run 10 sources in parallel
    const results = await Promise.all(
      sources.map(s => runScraper(s))
    )

    const duration = Date.now() - start

    expect(duration).toBeLessThan(300000) // 5 minutes
    expect(results.every(r => r.success)).toBe(true)
  })
})
```

---

## 9. Deployment & Operations

### 9.1 Environment Configuration

```typescript
// config/pipeline.ts
export const PIPELINE_CONFIG = {
  development: {
    orchestrator: {
      schedule: '*/30 * * * *', // Every 30 min for testing
      concurrency: 1,
    },
    scrapers: {
      timeout: 30000, // 30 seconds
      maxRetries: 2,
      rateLimit: { limit: 5, period: '1m' },
    },
    alerts: {
      enabled: false, // No alerts in dev
    },
  },

  staging: {
    orchestrator: {
      schedule: '0 */6 * * *', // Every 6 hours
      concurrency: 1,
    },
    scrapers: {
      timeout: 120000, // 2 minutes
      maxRetries: 3,
      rateLimit: { limit: 20, period: '1m' },
    },
    alerts: {
      enabled: true,
      channels: ['slack'], // Slack only
    },
  },

  production: {
    orchestrator: {
      schedule: '0 5 * * *', // 5 AM daily
      concurrency: 1,
    },
    scrapers: {
      timeout: 300000, // 5 minutes
      maxRetries: 5,
      rateLimit: { limit: 60, period: '1m' },
    },
    alerts: {
      enabled: true,
      channels: ['slack', 'email', 'sms'],
    },
  },
}
```

### 9.2 Runbook

**Daily Operations**:
1. Check dashboard at start of day
2. Review pipeline run from 5 AM
3. Investigate any warnings/errors
4. Monitor data freshness

**Common Issues**:

**Issue**: Source failing with auth errors
**Fix**: Check credentials, regenerate tokens if needed

**Issue**: Circuit breaker open
**Fix**: Investigate source health, manually trigger recovery test

**Issue**: Quality score low
**Fix**: Review validation errors, check source changes

**Issue**: Pipeline running slow
**Fix**: Check for hanging scrapers, review rate limits

### 9.3 Disaster Recovery

**Scenario 1: Total Pipeline Failure**
1. Check orchestrator status
2. Review error logs
3. Manually trigger foundational data collection
4. Resume from last known good state

**Scenario 2: Data Corruption**
1. Identify affected tables
2. Restore from last good snapshot (if < 24h old)
3. Re-run specific scrapers to rebuild
4. Validate data consistency

**Scenario 3: Source Permanently Unavailable**
1. Open circuit breaker manually
2. Remove from pipeline dependencies
3. Update downstream consumers
4. Find alternative source if critical

---

## 10. Future Enhancements

### 10.1 Machine Learning Integration

- **Predictive modeling**: Predict game outcomes using collected stats
- **Anomaly detection**: ML-based outlier detection
- **Player performance forecasting**: Injury impact, form prediction
- **Automated insights**: Generate analysis from data patterns

### 10.2 Real-Time Features

- **Live game updates**: WebSocket connections for in-game stats
- **Momentum metrics**: Real-time scoring run detection
- **Social sentiment**: Live Twitter/Reddit sentiment analysis
- **Betting line movements**: Real-time odds tracking

### 10.3 Advanced Analytics

- **Composite rankings**: Merge multiple rating systems
- **Matchup predictions**: Head-to-head analysis
- **Player prop models**: Individual player performance prediction
- **Tournament simulations**: Bracket probability modeling

### 10.4 Data Products

- **Public API**: Expose collected data via REST API
- **Data exports**: CSV/JSON downloads for analysis
- **Webhooks**: Real-time notifications for data updates
- **Historical analysis**: Time-series data for trend analysis

---

## Conclusion

This architecture provides a robust, scalable foundation for collecting comprehensive college basketball data. Key strengths:

✅ **Fault Tolerant**: Circuit breakers, retries, graceful degradation
✅ **Observable**: Comprehensive logging, metrics, alerting
✅ **Maintainable**: Clear patterns, modular design, documented
✅ **Extensible**: Easy to add new sources following established patterns
✅ **Quality-Focused**: Validation at every stage
✅ **Production-Ready**: Handles failures, scales, monitors

**Next Steps**:
1. Review and approve architecture
2. Begin Phase 1 implementation
3. Iterate based on learnings
4. Expand to additional sources

**Philosophy Alignment**:
- Ruthless simplicity: Start minimal, add complexity only when needed
- Vertical slices: Each phase delivers working end-to-end value
- Quality over completeness: Better to have 5 reliable sources than 15 flaky ones
- Emergence: Let patterns emerge rather than over-engineering upfront
