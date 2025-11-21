-- Sample Tournament Seeding Script
-- This creates a sample Maui Invitational tournament with games for testing the bracket visualization

-- First, create the tournament
INSERT INTO tournaments (id, name, type, year, start_date, end_date, location, status, metadata)
VALUES (
  'maui-2024-sample',
  '2024 Maui Invitational',
  'mte',
  2024,
  '2024-11-25',
  '2024-11-27',
  'Maui, HI',
  'completed',
  '{"format": "single_elimination", "team_count": 8}'
)
ON CONFLICT (id) DO NOTHING;

-- Add participating teams (using actual team IDs from your database)
-- You'll need to replace these UUIDs with actual team IDs from your teams table
-- Query to get team IDs: SELECT id, name FROM teams WHERE name IN ('Auburn', 'Iowa State', 'North Carolina', 'Dayton', 'Memphis', 'Michigan State', 'Colorado', 'Connecticut');

-- Example structure (replace with actual UUIDs):
-- INSERT INTO tournament_teams (tournament_id, team_id, seed)
-- VALUES
--   ('maui-2024-sample', 'AUBURN_TEAM_ID', 1),
--   ('maui-2024-sample', 'IOWA_STATE_TEAM_ID', 2),
--   ('maui-2024-sample', 'NORTH_CAROLINA_TEAM_ID', 3),
--   ('maui-2024-sample', 'DAYTON_TEAM_ID', 4),
--   ('maui-2024-sample', 'MEMPHIS_TEAM_ID', 5),
--   ('maui-2024-sample', 'MICHIGAN_STATE_TEAM_ID', 6),
--   ('maui-2024-sample', 'COLORADO_TEAM_ID', 7),
--   ('maui-2024-sample', 'CONNECTICUT_TEAM_ID', 8);

-- Create sample bracket games
-- Round 1 (Quarterfinals)
-- Game 1: Auburn vs UConn
-- Game 2: Iowa State vs Colorado
-- Game 3: North Carolina vs Michigan State
-- Game 4: Dayton vs Memphis

-- Round 2 (Semifinals)
-- Game 5: Winner of Game 1 vs Winner of Game 2
-- Game 6: Winner of Game 3 vs Winner of Game 4

-- Round 3 (Finals)
-- Game 7: Winner of Game 5 vs Winner of Game 6

-- Note: You'll need to populate these with actual team IDs from your database
-- Example query to help:
/*
WITH tournament_teams_data AS (
  SELECT name FROM unnest(ARRAY[
    'Auburn', 'Iowa State', 'North Carolina', 'Dayton',
    'Memphis', 'Michigan State', 'Colorado', 'Connecticut'
  ]) AS name
)
SELECT t.id, t.name
FROM teams t
WHERE t.name IN (SELECT name FROM tournament_teams_data);
*/

-- After getting team IDs, you can insert games like this:
/*
INSERT INTO games (
  tournament_id,
  tournament_round,
  tournament_metadata,
  game_date,
  home_team_id,
  away_team_id,
  home_score,
  away_score,
  status,
  conference_id
) VALUES
  -- Quarterfinals
  (
    'maui-2024-sample',
    'quarterfinals',
    '{"seed_home": 1, "seed_away": 8}',
    '2024-11-25 19:00:00-10',
    'AUBURN_ID',
    'CONNECTICUT_ID',
    85,
    67,
    'completed',
    (SELECT id FROM conferences LIMIT 1)
  ),
  -- Add more games...
;
*/

-- Helpful query to see what you need to populate:
SELECT
  'Need to add ' || COUNT(*) || ' teams to tournament_teams table' AS teams_status,
  'Need to add 7 games (4 quarters, 2 semis, 1 final) to games table' AS games_status;

-- Query to verify tournament was created:
SELECT * FROM tournaments WHERE id = 'maui-2024-sample';
