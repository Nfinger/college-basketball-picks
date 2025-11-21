-- Data Pipeline Infrastructure Tables
-- Tracks pipeline runs, data quality, and source health

-- ============================================================================
-- PIPELINE RUNS - Track orchestrator executions
-- ============================================================================

CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('full', 'incremental', 'validation', 'backfill')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial_success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Metrics
  sources_attempted INTEGER DEFAULT 0,
  sources_succeeded INTEGER DEFAULT 0,
  sources_failed INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,

  -- Results
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_started_at ON pipeline_runs(started_at DESC);
CREATE INDEX idx_pipeline_runs_run_type ON pipeline_runs(run_type);

-- ============================================================================
-- SCRAPER RUNS - Enhanced tracking for individual scraper executions
-- ============================================================================

CREATE TABLE scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,

  source TEXT NOT NULL, -- 'kenpom', 'barttorvik', 'espn', etc.
  job_type TEXT NOT NULL, -- 'team_stats', 'player_stats', 'games', etc.

  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER, -- Milliseconds

  -- Results
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Error handling
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scraper_runs_pipeline_run_id ON scraper_runs(pipeline_run_id);
CREATE INDEX idx_scraper_runs_source_status ON scraper_runs(source, status);
CREATE INDEX idx_scraper_runs_started_at ON scraper_runs(started_at DESC);
CREATE INDEX idx_scraper_runs_source_job_type ON scraper_runs(source, job_type);

-- ============================================================================
-- DATA FRESHNESS - Track when data was last updated
-- ============================================================================

CREATE TABLE data_freshness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  data_type TEXT NOT NULL,
  last_updated_at TIMESTAMPTZ NOT NULL,
  record_count INTEGER DEFAULT 0,
  quality_score NUMERIC(3, 2) CHECK (quality_score >= 0 AND quality_score <= 1), -- 0.00 to 1.00

  metadata JSONB DEFAULT '{}'::jsonb,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source, data_type)
);

CREATE INDEX idx_data_freshness_source ON data_freshness(source);
CREATE INDEX idx_data_freshness_last_updated ON data_freshness(last_updated_at DESC);
CREATE INDEX idx_data_freshness_quality ON data_freshness(quality_score);

-- ============================================================================
-- CIRCUIT BREAKER STATE - Track failing sources
-- ============================================================================

CREATE TABLE circuit_breaker_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('closed', 'open', 'half_open')),

  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,

  open_until TIMESTAMPTZ, -- When circuit breaker will attempt recovery

  metadata JSONB DEFAULT '{}'::jsonb,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_circuit_breaker_state ON circuit_breaker_state(state);
CREATE INDEX idx_circuit_breaker_source ON circuit_breaker_state(source);

-- ============================================================================
-- DATA QUALITY METRICS - Track validation results
-- ============================================================================

CREATE TABLE data_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraper_run_id UUID REFERENCES scraper_runs(id) ON DELETE CASCADE,

  source TEXT NOT NULL,
  data_type TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- 'completeness', 'consistency', 'freshness', 'accuracy'

  score NUMERIC(3, 2) CHECK (score >= 0 AND score <= 1), -- 0.00 to 1.00
  details JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quality_metrics_scraper_run ON data_quality_metrics(scraper_run_id);
CREATE INDEX idx_quality_metrics_source_type ON data_quality_metrics(source, data_type);
CREATE INDEX idx_quality_metrics_created_at ON data_quality_metrics(created_at DESC);

-- ============================================================================
-- DATA DEPENDENCIES - Define relationships between data sources
-- ============================================================================

CREATE TABLE data_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  depends_on TEXT NOT NULL,
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('required', 'optional')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source, depends_on)
);

CREATE INDEX idx_data_dependencies_source ON data_dependencies(source);
CREATE INDEX idx_data_dependencies_depends_on ON data_dependencies(depends_on);

-- Seed initial dependencies
INSERT INTO data_dependencies (source, depends_on, dependency_type) VALUES
  -- Team stats require teams
  ('kenpom', 'teams', 'required'),
  ('barttorvik', 'teams', 'required'),
  ('espn_stats', 'teams', 'required'),

  -- Player stats require teams
  ('espn_players', 'teams', 'required'),

  -- Games require teams
  ('games', 'teams', 'required'),

  -- Teams require conferences
  ('teams', 'conferences', 'required'),

  -- Injuries are optional but benefit from having teams
  ('injuries', 'teams', 'optional');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update data freshness
CREATE OR REPLACE FUNCTION update_data_freshness(
  p_source TEXT,
  p_data_type TEXT,
  p_record_count INTEGER,
  p_quality_score NUMERIC DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO data_freshness (source, data_type, last_updated_at, record_count, quality_score)
  VALUES (p_source, p_data_type, NOW(), p_record_count, p_quality_score)
  ON CONFLICT (source, data_type)
  DO UPDATE SET
    last_updated_at = NOW(),
    record_count = p_record_count,
    quality_score = COALESCE(p_quality_score, data_freshness.quality_score),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to check if data is fresh enough
CREATE OR REPLACE FUNCTION is_data_fresh(
  p_source TEXT,
  p_data_type TEXT,
  p_max_age_hours INTEGER DEFAULT 24
)
RETURNS BOOLEAN AS $$
DECLARE
  v_last_updated TIMESTAMPTZ;
BEGIN
  SELECT last_updated_at INTO v_last_updated
  FROM data_freshness
  WHERE source = p_source AND data_type = p_data_type;

  IF v_last_updated IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_last_updated > NOW() - (p_max_age_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to update circuit breaker state
CREATE OR REPLACE FUNCTION update_circuit_breaker(
  p_source TEXT,
  p_success BOOLEAN,
  p_failure_threshold INTEGER DEFAULT 5,
  p_timeout_minutes INTEGER DEFAULT 30
)
RETURNS TEXT AS $$
DECLARE
  v_state TEXT;
  v_failure_count INTEGER;
BEGIN
  -- Get or create circuit breaker state
  INSERT INTO circuit_breaker_state (source, state)
  VALUES (p_source, 'closed')
  ON CONFLICT (source) DO NOTHING;

  SELECT state, failure_count INTO v_state, v_failure_count
  FROM circuit_breaker_state
  WHERE source = p_source;

  IF p_success THEN
    -- Success - reset failures and close circuit
    UPDATE circuit_breaker_state
    SET
      state = 'closed',
      failure_count = 0,
      last_success_at = NOW(),
      open_until = NULL,
      updated_at = NOW()
    WHERE source = p_source;
    RETURN 'closed';
  ELSE
    -- Failure - increment count
    v_failure_count := v_failure_count + 1;

    IF v_failure_count >= p_failure_threshold THEN
      -- Open circuit breaker
      UPDATE circuit_breaker_state
      SET
        state = 'open',
        failure_count = v_failure_count,
        last_failure_at = NOW(),
        open_until = NOW() + (p_timeout_minutes || ' minutes')::INTERVAL,
        updated_at = NOW()
      WHERE source = p_source;
      RETURN 'open';
    ELSE
      -- Increment failure count but keep closed
      UPDATE circuit_breaker_state
      SET
        failure_count = v_failure_count,
        last_failure_at = NOW(),
        updated_at = NOW()
      WHERE source = p_source;
      RETURN 'closed';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_freshness ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_breaker_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_dependencies ENABLE ROW LEVEL SECURITY;

-- Public read access to monitoring data
CREATE POLICY "Anyone can view pipeline runs" ON pipeline_runs FOR SELECT USING (true);
CREATE POLICY "Anyone can view scraper runs" ON scraper_runs FOR SELECT USING (true);
CREATE POLICY "Anyone can view data freshness" ON data_freshness FOR SELECT USING (true);
CREATE POLICY "Anyone can view circuit breaker state" ON circuit_breaker_state FOR SELECT USING (true);
CREATE POLICY "Anyone can view quality metrics" ON data_quality_metrics FOR SELECT USING (true);
CREATE POLICY "Anyone can view dependencies" ON data_dependencies FOR SELECT USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE pipeline_runs IS 'Tracks complete pipeline orchestration runs';
COMMENT ON TABLE scraper_runs IS 'Tracks individual scraper executions within pipeline runs';
COMMENT ON TABLE data_freshness IS 'Monitors when each data source was last successfully updated';
COMMENT ON TABLE circuit_breaker_state IS 'Manages circuit breaker state for failing data sources';
COMMENT ON TABLE data_quality_metrics IS 'Stores validation and quality scores for scraped data';
COMMENT ON TABLE data_dependencies IS 'Defines required dependencies between data sources';
