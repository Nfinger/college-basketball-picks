-- Create matchup_analyses table for storing AI-generated game analysis
CREATE TABLE matchup_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,

  -- Analysis outputs
  analysis_text TEXT NOT NULL,
  prediction JSONB, -- { "winner_team_id": "uuid", "confidence": 0-100, "predicted_spread": number }
  key_insights JSONB, -- ["insight1", "insight2", ...]

  -- Metadata for cache invalidation and debugging
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  team_stats_snapshot JSONB, -- Snapshot of stats used for this analysis

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up analysis by game
CREATE INDEX idx_matchup_analyses_game_id ON matchup_analyses(game_id);

-- Index for finding recent analyses
CREATE INDEX idx_matchup_analyses_analyzed_at ON matchup_analyses(analyzed_at);

-- Ensure only one analysis per game (latest wins)
-- This allows upsert pattern: ON CONFLICT (game_id) DO UPDATE
CREATE UNIQUE INDEX idx_matchup_analyses_latest ON matchup_analyses(game_id);
