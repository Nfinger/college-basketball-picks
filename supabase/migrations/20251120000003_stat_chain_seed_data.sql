-- ============================================================================
-- Stat Chain Connections - Sample Seed Data
-- ============================================================================
-- Creates a complete sample puzzle for testing the Stat Chain Connections game
-- This uses real teams from the existing teams table
-- ============================================================================

DO $$
DECLARE
  v_puzzle_id UUID;
  v_group1_id UUID;
  v_group2_id UUID;
  v_group3_id UUID;
  v_group4_id UUID;
  
  -- Team IDs (will be fetched from teams table)
  v_duke_id UUID;
  v_unc_id UUID;
  v_kentucky_id UUID;
  v_kansas_id UUID;
  v_gonzaga_id UUID;
  v_villanova_id UUID;
  v_ucla_id UUID;
  v_houston_id UUID;
  v_baylor_id UUID;
  v_purdue_id UUID;
  v_arizona_id UUID;
  v_texas_id UUID;
  v_uconn_id UUID;
  v_marquette_id UUID;
  v_creighton_id UUID;
  v_xavier_id UUID;
BEGIN
  -- Fetch team IDs by name (adjust names to match your actual team names)
  SELECT id INTO v_duke_id FROM teams WHERE name ILIKE '%Duke%' LIMIT 1;
  SELECT id INTO v_unc_id FROM teams WHERE name ILIKE '%North Carolina%' LIMIT 1;
  SELECT id INTO v_kentucky_id FROM teams WHERE name ILIKE '%Kentucky%' LIMIT 1;
  SELECT id INTO v_kansas_id FROM teams WHERE name ILIKE '%Kansas%' LIMIT 1;
  SELECT id INTO v_gonzaga_id FROM teams WHERE name ILIKE '%Gonzaga%' LIMIT 1;
  SELECT id INTO v_villanova_id FROM teams WHERE name ILIKE '%Villanova%' LIMIT 1;
  SELECT id INTO v_ucla_id FROM teams WHERE name ILIKE '%UCLA%' LIMIT 1;
  SELECT id INTO v_houston_id FROM teams WHERE name ILIKE '%Houston%' LIMIT 1;
  SELECT id INTO v_baylor_id FROM teams WHERE name ILIKE '%Baylor%' LIMIT 1;
  SELECT id INTO v_purdue_id FROM teams WHERE name ILIKE '%Purdue%' LIMIT 1;
  SELECT id INTO v_arizona_id FROM teams WHERE name ILIKE '%Arizona%' LIMIT 1;
  SELECT id INTO v_texas_id FROM teams WHERE name ILIKE '%Texas%' LIMIT 1;
  SELECT id INTO v_uconn_id FROM teams WHERE name ILIKE '%Connecticut%' OR name ILIKE '%UConn%' LIMIT 1;
  SELECT id INTO v_marquette_id FROM teams WHERE name ILIKE '%Marquette%' LIMIT 1;
  SELECT id INTO v_creighton_id FROM teams WHERE name ILIKE '%Creighton%' LIMIT 1;
  SELECT id INTO v_xavier_id FROM teams WHERE name ILIKE '%Xavier%' LIMIT 1;
  
  -- Create sample puzzle for today
  INSERT INTO stat_chain_puzzles (puzzle_date, title, description, difficulty)
  VALUES (
    CURRENT_DATE,
    'Elite Programs Edition',
    'Group these teams by their historical accomplishments and current performance metrics',
    'medium'
  )
  RETURNING id INTO v_puzzle_id;
  
  -- Group 1: Multiple National Championships (Easiest - most recognizable)
  INSERT INTO stat_chain_groups (
    puzzle_id, 
    group_name, 
    description, 
    stat_type, 
    stat_value, 
    difficulty_order
  )
  VALUES (
    v_puzzle_id,
    'Blue Blood Programs',
    'Teams with 5+ national championships in program history',
    'championships',
    '5+',
    1
  )
  RETURNING id INTO v_group1_id;
  
  -- Add teams to Group 1 (using real team IDs if found, otherwise skip)
  IF v_duke_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group1_id, v_duke_id, 1);
  END IF;
  
  IF v_unc_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group1_id, v_unc_id, 2);
  END IF;
  
  IF v_kentucky_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group1_id, v_kentucky_id, 3);
  END IF;
  
  IF v_kansas_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group1_id, v_kansas_id, 4);
  END IF;
  
  -- Group 2: Recent Tournament Success
  INSERT INTO stat_chain_groups (
    puzzle_id,
    group_name,
    description,
    stat_type,
    stat_value,
    difficulty_order
  )
  VALUES (
    v_puzzle_id,
    'Final Four Regulars',
    'Teams with 3+ Final Four appearances since 2015',
    'final_four_appearances',
    '3+ since 2015',
    2
  )
  RETURNING id INTO v_group2_id;
  
  -- Add teams to Group 2
  IF v_gonzaga_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group2_id, v_gonzaga_id, 1);
  END IF;
  
  IF v_villanova_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group2_id, v_villanova_id, 2);
  END IF;
  
  IF v_ucla_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group2_id, v_ucla_id, 3);
  END IF;
  
  IF v_houston_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group2_id, v_houston_id, 4);
  END IF;
  
  -- Group 3: Defensive Excellence
  INSERT INTO stat_chain_groups (
    puzzle_id,
    group_name,
    description,
    stat_type,
    stat_value,
    difficulty_order
  )
  VALUES (
    v_puzzle_id,
    'Defensive Powerhouses',
    'Teams ranked in top 10 defensive efficiency this season',
    'defensive_efficiency',
    'top 10',
    3
  )
  RETURNING id INTO v_group3_id;
  
  -- Add teams to Group 3
  IF v_baylor_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group3_id, v_baylor_id, 1);
  END IF;
  
  IF v_purdue_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group3_id, v_purdue_id, 2);
  END IF;
  
  IF v_arizona_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group3_id, v_arizona_id, 3);
  END IF;
  
  IF v_texas_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group3_id, v_texas_id, 4);
  END IF;
  
  -- Group 4: Big East Conference (Hardest - requires conference knowledge)
  INSERT INTO stat_chain_groups (
    puzzle_id,
    group_name,
    description,
    stat_type,
    stat_value,
    difficulty_order
  )
  VALUES (
    v_puzzle_id,
    'Big East Elite',
    'Top-ranked teams from the Big East Conference',
    'conference',
    'Big East',
    4
  )
  RETURNING id INTO v_group4_id;
  
  -- Add teams to Group 4
  IF v_uconn_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group4_id, v_uconn_id, 1);
  END IF;
  
  IF v_marquette_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group4_id, v_marquette_id, 2);
  END IF;
  
  IF v_creighton_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group4_id, v_creighton_id, 3);
  END IF;
  
  IF v_xavier_id IS NOT NULL THEN
    INSERT INTO stat_chain_teams (group_id, team_id, display_order)
    VALUES (v_group4_id, v_xavier_id, 4);
  END IF;
  
  RAISE NOTICE 'Sample puzzle created with ID: %', v_puzzle_id;
  RAISE NOTICE 'Note: Only teams found in the teams table were added';
END $$;

-- Verify the puzzle was created correctly
SELECT 
  p.puzzle_date,
  p.title,
  p.difficulty,
  COUNT(DISTINCT g.id) as group_count,
  COUNT(sct.id) as team_count
FROM stat_chain_puzzles p
LEFT JOIN stat_chain_groups g ON g.puzzle_id = p.id
LEFT JOIN stat_chain_teams sct ON sct.group_id = g.id
WHERE p.puzzle_date = CURRENT_DATE
GROUP BY p.id, p.puzzle_date, p.title, p.difficulty;
