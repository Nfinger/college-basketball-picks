-- Create team_stats table for storing advanced analytics from multiple sources
-- Supports multi-source data (KenPom, BartTorvik, ESPN, etc.)

CREATE TABLE team_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season INTEGER NOT NULL, -- 2024, 2025, etc.
  games_played INTEGER,
  wins INTEGER,
  losses INTEGER,

  -- Advanced metrics (tempo-free)
  offensive_efficiency NUMERIC(6, 2), -- Points per 100 possessions
  defensive_efficiency NUMERIC(6, 2), -- Points allowed per 100 possessions
  tempo NUMERIC(5, 2), -- Possessions per game

  -- Rankings and strength
  offensive_efficiency_rank INTEGER,
  defensive_efficiency_rank INTEGER,
  overall_rank INTEGER,
  strength_of_schedule NUMERIC(6, 2),
  strength_of_schedule_rank INTEGER,

  -- Traditional stats
  points_per_game NUMERIC(5, 2),
  points_allowed_per_game NUMERIC(5, 2),
  field_goal_pct NUMERIC(5, 4),
  three_point_pct NUMERIC(5, 4),
  free_throw_pct NUMERIC(5, 4),
  rebounds_per_game NUMERIC(5, 2),
  assists_per_game NUMERIC(5, 2),
  turnovers_per_game NUMERIC(5, 2),

  -- Flexible storage for source-specific fields
  raw_stats JSONB DEFAULT '{}'::jsonb,

  -- Data provenance
  source TEXT NOT NULL, -- 'kenpom', 'barttorvik', 'espn', 'ncaa'
  source_url TEXT,

  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one record per team/season/source combination
  UNIQUE(team_id, season, source)
);

-- Create indexes for common queries
CREATE INDEX idx_team_stats_team_season ON team_stats(team_id, season);
CREATE INDEX idx_team_stats_season_source ON team_stats(season, source);
CREATE INDEX idx_team_stats_updated_at ON team_stats(updated_at);
CREATE INDEX idx_team_stats_raw_stats ON team_stats USING gin(raw_stats);

-- Add updated_at trigger
CREATE TRIGGER update_team_stats_updated_at BEFORE UPDATE ON team_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE team_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policy (public read)
CREATE POLICY "Anyone can view team stats" ON team_stats
  FOR SELECT USING (true);

-- Add helpful comments
COMMENT ON TABLE team_stats IS 'Stores advanced team analytics from multiple sources (KenPom, BartTorvik, ESPN)';
COMMENT ON COLUMN team_stats.offensive_efficiency IS 'Points scored per 100 possessions (tempo-free)';
COMMENT ON COLUMN team_stats.defensive_efficiency IS 'Points allowed per 100 possessions (tempo-free)';
COMMENT ON COLUMN team_stats.tempo IS 'Average possessions per game';
COMMENT ON COLUMN team_stats.raw_stats IS 'Source-specific fields stored as JSONB for flexibility';
COMMENT ON COLUMN team_stats.source IS 'Data source identifier: kenpom, barttorvik, espn, ncaa';
