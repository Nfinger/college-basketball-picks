-- Create team_game_stats table to store detailed stats for each team in each game
CREATE TABLE team_game_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  is_home BOOLEAN NOT NULL,

  -- Box score stats
  points INTEGER NOT NULL DEFAULT 0,
  field_goals_made INTEGER NOT NULL DEFAULT 0,
  field_goals_attempted INTEGER NOT NULL DEFAULT 0,
  three_pointers_made INTEGER NOT NULL DEFAULT 0,
  three_pointers_attempted INTEGER NOT NULL DEFAULT 0,
  free_throws_made INTEGER NOT NULL DEFAULT 0,
  free_throws_attempted INTEGER NOT NULL DEFAULT 0,
  rebounds INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  steals INTEGER NOT NULL DEFAULT 0,
  blocks INTEGER NOT NULL DEFAULT 0,
  turnovers INTEGER NOT NULL DEFAULT 0,

  -- Calculated percentages (stored for query performance)
  field_goal_percentage DECIMAL(5, 3),
  three_point_percentage DECIMAL(5, 3),
  free_throw_percentage DECIMAL(5, 3),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(game_id, team_id)
);

CREATE INDEX idx_team_game_stats_game_id ON team_game_stats(game_id);
CREATE INDEX idx_team_game_stats_team_id ON team_game_stats(team_id);

-- Create fantasy_seasons table
CREATE TABLE fantasy_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create fantasy_weeks table
CREATE TABLE fantasy_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES fantasy_seasons(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(season_id, week_number)
);

CREATE INDEX idx_fantasy_weeks_season_id ON fantasy_weeks(season_id);

-- Create slot type enum for lineup positions
CREATE TYPE fantasy_slot_type AS ENUM ('power_1', 'power_2', 'power_3', 'mid_major_1', 'mid_major_2', 'flex');

-- Create fantasy_lineups table
CREATE TABLE fantasy_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES fantasy_weeks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, week_id)
);

CREATE INDEX idx_fantasy_lineups_user_id ON fantasy_lineups(user_id);
CREATE INDEX idx_fantasy_lineups_week_id ON fantasy_lineups(week_id);

-- Create fantasy_lineup_teams join table
CREATE TABLE fantasy_lineup_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lineup_id UUID NOT NULL REFERENCES fantasy_lineups(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  slot_type fantasy_slot_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(lineup_id, slot_type),
  UNIQUE(lineup_id, team_id)
);

CREATE INDEX idx_fantasy_lineup_teams_lineup_id ON fantasy_lineup_teams(lineup_id);
CREATE INDEX idx_fantasy_lineup_teams_team_id ON fantasy_lineup_teams(team_id);

-- Create fantasy_matchups table (tracks weekly head-to-head matchups)
CREATE TABLE fantasy_matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES fantasy_weeks(id) ON DELETE CASCADE,
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user1_score DECIMAL(3, 1), -- 0-9 (can be 0.5 for ties)
  user2_score DECIMAL(3, 1),
  is_calculated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(week_id, user1_id, user2_id),
  CHECK (user1_id < user2_id) -- Ensure consistent ordering
);

CREATE INDEX idx_fantasy_matchups_week_id ON fantasy_matchups(week_id);
CREATE INDEX idx_fantasy_matchups_user1_id ON fantasy_matchups(user1_id);
CREATE INDEX idx_fantasy_matchups_user2_id ON fantasy_matchups(user2_id);

-- Create fantasy_category enum
CREATE TYPE fantasy_category AS ENUM (
  'points',
  'rebounds',
  'assists',
  'steals',
  'blocks',
  'field_goal_pct',
  'free_throw_pct',
  'three_point_pct',
  'wins'
);

-- Create fantasy_matchup_categories table (breakdown by category)
CREATE TABLE fantasy_matchup_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id UUID NOT NULL REFERENCES fantasy_matchups(id) ON DELETE CASCADE,
  category fantasy_category NOT NULL,
  user1_value DECIMAL(10, 3),
  user2_value DECIMAL(10, 3),
  winner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for tie
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(matchup_id, category)
);

CREATE INDEX idx_fantasy_matchup_categories_matchup_id ON fantasy_matchup_categories(matchup_id);

-- Create fantasy_standings table (season-long cumulative)
CREATE TABLE fantasy_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES fantasy_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points DECIMAL(5, 1) NOT NULL DEFAULT 0,
  weeks_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(season_id, user_id)
);

CREATE INDEX idx_fantasy_standings_season_id ON fantasy_standings(season_id);
CREATE INDEX idx_fantasy_standings_user_id ON fantasy_standings(user_id);

-- Create fantasy_team_usage table to track which teams have been used (burn rule)
CREATE TABLE fantasy_team_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES fantasy_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  week_used_id UUID NOT NULL REFERENCES fantasy_weeks(id) ON DELETE CASCADE,
  slot_type fantasy_slot_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(season_id, user_id, team_id)
);

CREATE INDEX idx_fantasy_team_usage_season_user ON fantasy_team_usage(season_id, user_id);
CREATE INDEX idx_fantasy_team_usage_team_id ON fantasy_team_usage(team_id);

-- Add triggers for updated_at
CREATE TRIGGER update_team_game_stats_updated_at BEFORE UPDATE ON team_game_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_seasons_updated_at BEFORE UPDATE ON fantasy_seasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_weeks_updated_at BEFORE UPDATE ON fantasy_weeks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_lineups_updated_at BEFORE UPDATE ON fantasy_lineups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_matchups_updated_at BEFORE UPDATE ON fantasy_matchups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_standings_updated_at BEFORE UPDATE ON fantasy_standings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE team_game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_lineup_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_matchup_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_team_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies (public read for most fantasy data)
CREATE POLICY "Anyone can view team game stats" ON team_game_stats
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view fantasy seasons" ON fantasy_seasons
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view fantasy weeks" ON fantasy_weeks
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view fantasy lineups" ON fantasy_lineups
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view fantasy lineup teams" ON fantasy_lineup_teams
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own lineups" ON fantasy_lineups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lineups" ON fantasy_lineups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lineup teams" ON fantasy_lineup_teams
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM fantasy_lineups
      WHERE fantasy_lineups.id = fantasy_lineup_teams.lineup_id
      AND fantasy_lineups.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own lineup teams" ON fantasy_lineup_teams
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM fantasy_lineups
      WHERE fantasy_lineups.id = fantasy_lineup_teams.lineup_id
      AND fantasy_lineups.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view matchups" ON fantasy_matchups
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view matchup categories" ON fantasy_matchup_categories
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view standings" ON fantasy_standings
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view team usage" ON fantasy_team_usage
  FOR SELECT USING (true);
