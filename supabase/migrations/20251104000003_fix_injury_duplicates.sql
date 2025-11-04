-- Fix injury report duplicates by adding unique constraint
-- This ensures only one injury report per player per team at a time

-- Drop any existing duplicate entries before adding constraint
-- Keep the most recently updated record for each player-team combination
DELETE FROM injury_reports a
USING injury_reports b
WHERE a.id < b.id
  AND a.team_id = b.team_id
  AND a.player_name = b.player_name;

-- Add unique constraint to prevent duplicates
-- This allows us to use upsert efficiently
ALTER TABLE injury_reports
ADD CONSTRAINT unique_injury_per_player UNIQUE (team_id, player_name);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT unique_injury_per_player ON injury_reports IS
  'Ensures only one injury report per player per team - allows efficient upsert operations';
