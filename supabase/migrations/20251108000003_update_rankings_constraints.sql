-- Remove the unique constraint that prevents multiple rankings per week
-- Users should be able to create multiple rankings for the same week

ALTER TABLE user_rankings DROP CONSTRAINT IF EXISTS unique_user_week_season;

-- Add a more descriptive index instead
CREATE INDEX IF NOT EXISTS idx_user_rankings_user_week_season
  ON user_rankings(user_id, week, season);
