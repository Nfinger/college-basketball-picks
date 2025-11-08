-- Create player_stats table (optional but useful for future features)
-- Stores individual player statistics for season

CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Player identification
  player_name TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,

  -- Player details
  jersey_number TEXT,
  position TEXT, -- 'G', 'F', 'C', 'PG', 'SG', 'SF', 'PF', etc.
  class_year TEXT, -- 'FR', 'SO', 'JR', 'SR', 'GR'
  height_inches INTEGER,
  weight_lbs INTEGER,

  -- Basic stats
  games_played INTEGER,
  games_started INTEGER,
  minutes_per_game NUMERIC(5, 2),

  -- Scoring
  points_per_game NUMERIC(5, 2),
  field_goals_made NUMERIC(5, 2),
  field_goals_attempted NUMERIC(5, 2),
  field_goal_pct NUMERIC(5, 4),
  three_pointers_made NUMERIC(5, 2),
  three_pointers_attempted NUMERIC(5, 2),
  three_point_pct NUMERIC(5, 4),
  free_throws_made NUMERIC(5, 2),
  free_throws_attempted NUMERIC(5, 2),
  free_throw_pct NUMERIC(5, 4),

  -- Other stats
  rebounds_per_game NUMERIC(5, 2),
  offensive_rebounds NUMERIC(5, 2),
  defensive_rebounds NUMERIC(5, 2),
  assists_per_game NUMERIC(5, 2),
  steals_per_game NUMERIC(5, 2),
  blocks_per_game NUMERIC(5, 2),
  turnovers_per_game NUMERIC(5, 2),
  fouls_per_game NUMERIC(5, 2),

  -- Advanced metrics
  player_efficiency_rating NUMERIC(6, 2),
  true_shooting_pct NUMERIC(5, 4),
  usage_rate NUMERIC(5, 2),

  -- Flexible storage
  raw_stats JSONB DEFAULT '{}'::jsonb,

  -- Data provenance
  source TEXT NOT NULL, -- 'espn', 'ncaa', 'barttorvik'
  source_url TEXT,
  external_player_id TEXT, -- Source-specific player ID

  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One record per player/team/season/source
  UNIQUE(player_name, team_id, season, source)
);

-- Create indexes
CREATE INDEX idx_player_stats_team_season ON player_stats(team_id, season);
CREATE INDEX idx_player_stats_season_source ON player_stats(season, source);
CREATE INDEX idx_player_stats_player_name ON player_stats(player_name);
CREATE INDEX idx_player_stats_ppg ON player_stats(points_per_game DESC) WHERE points_per_game IS NOT NULL;
CREATE INDEX idx_player_stats_raw_stats ON player_stats USING gin(raw_stats);

-- Add updated_at trigger
CREATE TRIGGER update_player_stats_updated_at BEFORE UPDATE ON player_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policy (public read)
CREATE POLICY "Anyone can view player stats" ON player_stats
  FOR SELECT USING (true);

-- Add helpful comments
COMMENT ON TABLE player_stats IS 'Stores individual player statistics for college basketball';
COMMENT ON COLUMN player_stats.player_efficiency_rating IS 'PER - comprehensive per-minute rating';
COMMENT ON COLUMN player_stats.true_shooting_pct IS 'Shooting efficiency including FTs and 3PT weight';
COMMENT ON COLUMN player_stats.usage_rate IS 'Percentage of team plays used while on court';
