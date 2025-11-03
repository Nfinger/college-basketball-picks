-- Add Pick of the Day feature to picks table
-- This allows users to highlight one pick per day as their most confident pick

-- Step 1: Add denormalized game_date column for efficient constraint checking
ALTER TABLE picks ADD COLUMN game_date_cache DATE;

-- Step 2: Add POTD flag column
ALTER TABLE picks ADD COLUMN is_pick_of_day BOOLEAN DEFAULT false NOT NULL;

-- Step 3: Backfill game_date_cache for existing picks
UPDATE picks
SET game_date_cache = DATE(g.game_date AT TIME ZONE 'UTC')
FROM games g
WHERE picks.game_id = g.id;

-- Step 4: Make game_date_cache NOT NULL after backfill
ALTER TABLE picks ALTER COLUMN game_date_cache SET NOT NULL;

-- Step 5: Create unique constraint - only one POTD per user per game date
CREATE UNIQUE INDEX idx_one_potd_per_user_per_day
  ON picks (user_id, game_date_cache)
  WHERE is_pick_of_day = true;

-- Step 6: Add index for efficient POTD metrics queries
CREATE INDEX idx_picks_potd_result
  ON picks (user_id, is_pick_of_day, result)
  WHERE is_pick_of_day = true;

-- Step 7: Create trigger function to maintain game_date_cache
CREATE OR REPLACE FUNCTION maintain_pick_game_date_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the game date and cache it
  SELECT DATE(game_date AT TIME ZONE 'UTC') INTO NEW.game_date_cache
  FROM games WHERE id = NEW.game_id;

  -- Ensure we found the game
  IF NEW.game_date_cache IS NULL THEN
    RAISE EXCEPTION 'Cannot find game_date for game_id %', NEW.game_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger to automatically maintain game_date_cache
CREATE TRIGGER trg_maintain_pick_game_date_cache
  BEFORE INSERT OR UPDATE OF game_id ON picks
  FOR EACH ROW
  EXECUTE FUNCTION maintain_pick_game_date_cache();

-- Step 9: Add helpful comments
COMMENT ON COLUMN picks.is_pick_of_day IS 'Flag indicating this is the user''s pick of the day (only one per user per game date)';
COMMENT ON COLUMN picks.game_date_cache IS 'Denormalized game date for efficient constraint checking (maintained by trigger)';
COMMENT ON INDEX idx_one_potd_per_user_per_day IS 'Ensures only one pick of the day per user per game date';
