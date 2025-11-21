-- Stat Chain Connections - Sample Puzzle Seed Data
-- Creates one test puzzle for development and testing

-- Get today's date for the puzzle
DO $$
DECLARE
  v_puzzle_id UUID;
  v_group_easy UUID;
  v_group_medium UUID;
  v_group_hard UUID;
  v_group_expert UUID;
BEGIN
  -- Create puzzle for today
  INSERT INTO stat_chain_puzzles (puzzle_date)
  VALUES (CURRENT_DATE)
  RETURNING id INTO v_puzzle_id;

  -- Group 1: Easy - All from ACC
  INSERT INTO stat_chain_groups (puzzle_id, group_order, difficulty, connection_title, connection_explanation)
  VALUES (
    v_puzzle_id,
    1,
    'easy',
    'All from ACC',
    'All three teams compete in the Atlantic Coast Conference. The ACC is one of the Power 6 conferences in college basketball.'
  )
  RETURNING id INTO v_group_easy;

  -- Add teams to easy group (Duke, UNC, Virginia)
  INSERT INTO stat_chain_teams (group_id, team_id)
  SELECT v_group_easy, t.id
  FROM teams t
  WHERE t.short_name IN ('DUKE', 'UNC', 'UVA');

  -- Group 2: Medium - All from Big Ten
  INSERT INTO stat_chain_groups (puzzle_id, group_order, difficulty, connection_title, connection_explanation)
  VALUES (
    v_puzzle_id,
    2,
    'medium',
    'All from Big Ten',
    'All three teams are members of the Big Ten Conference, known for its physical style of play and strong defensive tradition.'
  )
  RETURNING id INTO v_group_medium;

  -- Add teams to medium group (Purdue, Illinois, Michigan State)
  INSERT INTO stat_chain_teams (group_id, team_id)
  SELECT v_group_medium, t.id
  FROM teams t
  WHERE t.short_name IN ('PUR', 'ILL', 'MSU');

  -- Group 3: Hard - All from Big 12
  INSERT INTO stat_chain_groups (puzzle_id, group_order, difficulty, connection_title, connection_explanation)
  VALUES (
    v_puzzle_id,
    3,
    'hard',
    'All from Big 12',
    'These teams are all members of the Big 12 Conference. The Big 12 has become one of the deepest conferences in college basketball in recent years.'
  )
  RETURNING id INTO v_group_hard;

  -- Add teams to hard group (Kansas, Houston, Baylor)
  INSERT INTO stat_chain_teams (group_id, team_id)
  SELECT v_group_hard, t.id
  FROM teams t
  WHERE t.short_name IN ('KU', 'HOU', 'BAY');

  -- Group 4: Expert - All from SEC
  INSERT INTO stat_chain_groups (puzzle_id, group_order, difficulty, connection_title, connection_explanation)
  VALUES (
    v_puzzle_id,
    4,
    'expert',
    'All from SEC',
    'All three teams compete in the Southeastern Conference. The SEC has traditionally been known more for football but has grown significantly in basketball competitiveness.'
  )
  RETURNING id INTO v_group_expert;

  -- Add teams to expert group (Need to check what SEC teams exist in seed)
  -- For now, using placeholder - adjust based on actual teams in seed.sql
  INSERT INTO stat_chain_teams (group_id, team_id)
  SELECT v_group_expert, t.id
  FROM teams t
  WHERE t.conference_id = (SELECT id FROM conferences WHERE short_name = 'SEC')
  LIMIT 3;

  -- Verify puzzle structure is valid
  IF NOT validate_puzzle_structure(v_puzzle_id) THEN
    RAISE EXCEPTION 'Puzzle structure validation failed';
  END IF;

  RAISE NOTICE 'Sample puzzle created successfully for date: %', CURRENT_DATE;
END $$;
