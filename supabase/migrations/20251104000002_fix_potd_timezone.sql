-- Fix Pick of the Day timezone mismatch
-- The issue: game_date_cache was using UTC timezone, but the UI queries using Eastern Time
-- This caused picks for late-night games to be stored with the next day's date in UTC,
-- making the UI unable to find existing POTD picks when checking if user can select another

-- Step 1: Update the trigger function to use Eastern Time instead of UTC
CREATE OR REPLACE FUNCTION maintain_pick_game_date_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the game date in Eastern Time and cache it
  -- This matches how the UI displays and queries for games
  SELECT DATE(game_date AT TIME ZONE 'America/New_York') INTO NEW.game_date_cache
  FROM games WHERE id = NEW.game_id;

  -- Ensure we found the game
  IF NEW.game_date_cache IS NULL THEN
    RAISE EXCEPTION 'Cannot find game_date for game_id %', NEW.game_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Backfill existing picks with correct Eastern Time dates
UPDATE picks
SET game_date_cache = DATE(g.game_date AT TIME ZONE 'America/New_York')
FROM games g
WHERE picks.game_id = g.id;

-- Add comment explaining the fix
COMMENT ON FUNCTION maintain_pick_game_date_cache() IS 'Maintains game_date_cache using Eastern Time to match UI date display and queries';
