-- Migration: Create user_favorite_teams table
-- Purpose: Adds "My Teams" feature for persistent team favorites
-- Impact: New table, no data migration needed
-- Rollback: DROP TABLE user_favorite_teams CASCADE;

-- Create user_favorite_teams table
CREATE TABLE IF NOT EXISTS user_favorite_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_team UNIQUE(user_id, team_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_favorite_teams_user_id
  ON user_favorite_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_teams_team_id
  ON user_favorite_teams(team_id);

-- Enable Row Level Security
ALTER TABLE user_favorite_teams ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own favorites
CREATE POLICY "Users can view their own favorite teams"
  ON user_favorite_teams FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorite teams"
  ON user_favorite_teams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite teams"
  ON user_favorite_teams FOR DELETE
  USING (auth.uid() = user_id);
