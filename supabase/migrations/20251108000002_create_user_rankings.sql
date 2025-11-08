-- Create user_rankings table to store user-created team rankings (like AP Poll)
CREATE TABLE user_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  week INTEGER NOT NULL, -- Week number (1-20 typically for college basketball season)
  season INTEGER NOT NULL, -- e.g., 2025
  published_at TIMESTAMPTZ, -- When the ranking was published (NULL = draft)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_week_season UNIQUE(user_id, week, season)
);

-- Create ranking_entries table to store the actual team rankings
CREATE TABLE ranking_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_id UUID NOT NULL REFERENCES user_rankings(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 25), -- Limit to top 25 like AP Poll
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_ranking_team UNIQUE(ranking_id, team_id),
  CONSTRAINT unique_ranking_rank UNIQUE(ranking_id, rank)
);

-- Create indexes for efficient querying
CREATE INDEX idx_user_rankings_user_id ON user_rankings(user_id);
CREATE INDEX idx_user_rankings_week_season ON user_rankings(week, season);
CREATE INDEX idx_user_rankings_published ON user_rankings(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX idx_ranking_entries_ranking_id ON ranking_entries(ranking_id);
CREATE INDEX idx_ranking_entries_team_id ON ranking_entries(team_id);

-- Enable Row Level Security
ALTER TABLE user_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_rankings
-- Users can view all published rankings
CREATE POLICY "Anyone can view published rankings"
  ON user_rankings FOR SELECT
  USING (published_at IS NOT NULL);

-- Users can view their own draft rankings
CREATE POLICY "Users can view their own rankings"
  ON user_rankings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own rankings
CREATE POLICY "Users can create their own rankings"
  ON user_rankings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own rankings
CREATE POLICY "Users can update their own rankings"
  ON user_rankings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own rankings
CREATE POLICY "Users can delete their own rankings"
  ON user_rankings FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for ranking_entries
-- Anyone can view entries for published rankings
CREATE POLICY "Anyone can view entries for published rankings"
  ON ranking_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_rankings
      WHERE user_rankings.id = ranking_entries.ranking_id
      AND user_rankings.published_at IS NOT NULL
    )
  );

-- Users can view entries for their own rankings
CREATE POLICY "Users can view their own ranking entries"
  ON ranking_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_rankings
      WHERE user_rankings.id = ranking_entries.ranking_id
      AND user_rankings.user_id = auth.uid()
    )
  );

-- Users can insert entries for their own rankings
CREATE POLICY "Users can create their own ranking entries"
  ON ranking_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_rankings
      WHERE user_rankings.id = ranking_entries.ranking_id
      AND user_rankings.user_id = auth.uid()
    )
  );

-- Users can update entries for their own rankings
CREATE POLICY "Users can update their own ranking entries"
  ON ranking_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_rankings
      WHERE user_rankings.id = ranking_entries.ranking_id
      AND user_rankings.user_id = auth.uid()
    )
  );

-- Users can delete entries for their own rankings
CREATE POLICY "Users can delete their own ranking entries"
  ON ranking_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_rankings
      WHERE user_rankings.id = ranking_entries.ranking_id
      AND user_rankings.user_id = auth.uid()
    )
  );

-- Add updated_at trigger for user_rankings
CREATE TRIGGER update_user_rankings_updated_at
  BEFORE UPDATE ON user_rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
