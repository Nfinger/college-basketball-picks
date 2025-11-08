-- Create scraper_runs table for monitoring and observability
-- Tracks execution of all scraping jobs for debugging and alerting

CREATE TABLE scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job identification
  source TEXT NOT NULL, -- 'espn', 'barttorvik', 'kenpom', 'rotowire', 'odds_api'
  job_type TEXT NOT NULL, -- 'games', 'team_stats', 'player_stats', 'injuries', 'scores'
  job_id TEXT, -- Inngest run ID for correlation

  -- Execution status
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'failure', 'partial'

  -- Results
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  warnings TEXT[],

  -- Performance metrics
  duration_ms INTEGER,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Store arbitrary run-specific data

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for monitoring queries
CREATE INDEX idx_scraper_runs_source_status ON scraper_runs(source, status);
CREATE INDEX idx_scraper_runs_started_at ON scraper_runs(started_at DESC);
CREATE INDEX idx_scraper_runs_status ON scraper_runs(status);
CREATE INDEX idx_scraper_runs_source_type ON scraper_runs(source, job_type);

-- Enable Row Level Security
ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policy (public read for monitoring dashboard)
CREATE POLICY "Anyone can view scraper runs" ON scraper_runs
  FOR SELECT USING (true);

-- Add helpful comments
COMMENT ON TABLE scraper_runs IS 'Tracks all scraper job executions for monitoring and debugging';
COMMENT ON COLUMN scraper_runs.source IS 'Data source being scraped: espn, barttorvik, kenpom, rotowire, odds_api';
COMMENT ON COLUMN scraper_runs.job_type IS 'Type of data being scraped: games, team_stats, player_stats, injuries, scores';
COMMENT ON COLUMN scraper_runs.status IS 'Execution status: running, success, failure, partial';
COMMENT ON COLUMN scraper_runs.metadata IS 'Flexible storage for run-specific metadata (teams created, data freshness, etc.)';

-- Create helper function to log scraper runs
CREATE OR REPLACE FUNCTION log_scraper_run(
  p_source TEXT,
  p_job_type TEXT,
  p_status TEXT DEFAULT 'success',
  p_records_processed INTEGER DEFAULT 0,
  p_records_created INTEGER DEFAULT 0,
  p_records_updated INTEGER DEFAULT 0,
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  run_id UUID;
BEGIN
  INSERT INTO scraper_runs (
    source,
    job_type,
    status,
    records_processed,
    records_created,
    records_updated,
    error_message,
    duration_ms,
    metadata,
    completed_at
  ) VALUES (
    p_source,
    p_job_type,
    p_status,
    p_records_processed,
    p_records_created,
    p_records_updated,
    p_error_message,
    p_duration_ms,
    p_metadata,
    NOW()
  )
  RETURNING id INTO run_id;

  RETURN run_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_scraper_run IS 'Helper function to log a scraper run with all relevant metrics';

-- Create view for latest successful runs by source
CREATE VIEW latest_scraper_runs AS
SELECT DISTINCT ON (source, job_type)
  id,
  source,
  job_type,
  status,
  records_processed,
  started_at,
  completed_at,
  duration_ms,
  error_message
FROM scraper_runs
ORDER BY source, job_type, started_at DESC;

COMMENT ON VIEW latest_scraper_runs IS 'Shows the most recent run for each source/job_type combination';
