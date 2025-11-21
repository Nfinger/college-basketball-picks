-- ============================================================================
-- Stat Chain Connections Game Schema
-- ============================================================================
-- This migration creates the database schema for a daily puzzle game where
-- players group teams by common statistical characteristics.
--
-- Tables:
--   - stat_chain_puzzles: Daily puzzles with metadata
--   - stat_chain_groups: Correct answer groups for each puzzle
--   - stat_chain_teams: Teams that belong to each group
--   - stat_chain_sessions: Player game sessions with guess history
--
-- Design decisions:
--   - Uses UUID primary keys (matches existing pattern)
--   - TIMESTAMPTZ for all timestamps
--   - JSONB for guess history (avoids separate guesses table)
--   - Reuses existing teams table via foreign keys
--   - No stats table for MVP (calculate on demand)
--   - RLS policies for proper access control
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- Stat Chain Puzzles
-- Represents a single daily puzzle instance
CREATE TABLE stat_chain_puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Puzzle metadata
  puzzle_date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE stat_chain_puzzles IS 'Daily puzzles for Stat Chain Connections game';
COMMENT ON COLUMN stat_chain_puzzles.puzzle_date IS 'Date this puzzle is available (unique per day)';
COMMENT ON COLUMN stat_chain_puzzles.difficulty IS 'Difficulty rating: easy, medium, or hard';


-- Stat Chain Groups
-- The correct answer groups for each puzzle (typically 4 groups per puzzle)
CREATE TABLE stat_chain_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  puzzle_id UUID NOT NULL REFERENCES stat_chain_puzzles(id) ON DELETE CASCADE,
  
  -- Group metadata
  group_name TEXT NOT NULL,
  description TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  stat_value TEXT NOT NULL,
  difficulty_order INTEGER NOT NULL CHECK (difficulty_order BETWEEN 1 AND 4),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(puzzle_id, difficulty_order)
);

COMMENT ON TABLE stat_chain_groups IS 'Correct answer groups for each puzzle';
COMMENT ON COLUMN stat_chain_groups.group_name IS 'Display name for the group (e.g., "Top Scorers")';
COMMENT ON COLUMN stat_chain_groups.description IS 'Explanation of what connects these teams';
COMMENT ON COLUMN stat_chain_groups.stat_type IS 'Statistical category (e.g., "points_per_game")';
COMMENT ON COLUMN stat_chain_groups.stat_value IS 'The connecting value or condition';
COMMENT ON COLUMN stat_chain_groups.difficulty_order IS 'Display order by difficulty (1=easiest, 4=hardest)';


-- Stat Chain Teams
-- Teams that belong to each group (exactly 4 teams per group)
CREATE TABLE stat_chain_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  group_id UUID NOT NULL REFERENCES stat_chain_groups(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  
  -- Metadata
  display_order INTEGER NOT NULL CHECK (display_order BETWEEN 1 AND 4),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(group_id, team_id),
  UNIQUE(group_id, display_order)
);

COMMENT ON TABLE stat_chain_teams IS 'Teams that belong to each group (4 per group)';
COMMENT ON COLUMN stat_chain_teams.display_order IS 'Order to show teams within group (1-4)';


-- Stat Chain Sessions
-- Player game sessions tracking progress and guesses
CREATE TABLE stat_chain_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id UUID NOT NULL REFERENCES stat_chain_puzzles(id) ON DELETE CASCADE,
  
  -- Game state
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'won', 'lost')),
  guesses_remaining INTEGER NOT NULL DEFAULT 4,
  groups_solved INTEGER NOT NULL DEFAULT 0,
  
  -- Guess history stored as JSONB array
  -- Format: [{ team_ids: [uuid, uuid, uuid, uuid], correct: boolean, group_id?: uuid, timestamp: iso8601 }]
  guess_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(user_id, puzzle_id)
);

COMMENT ON TABLE stat_chain_sessions IS 'Player game sessions with progress and guess history';
COMMENT ON COLUMN stat_chain_sessions.status IS 'Current game state: in_progress, won, or lost';
COMMENT ON COLUMN stat_chain_sessions.guesses_remaining IS 'Number of incorrect guesses remaining (starts at 4)';
COMMENT ON COLUMN stat_chain_sessions.groups_solved IS 'Number of groups correctly solved (0-4)';
COMMENT ON COLUMN stat_chain_sessions.guess_history IS 'Array of guess objects with team_ids, correctness, and timestamps';


-- ============================================================================
-- INDEXES
-- ============================================================================

-- Puzzles: Query by date
CREATE INDEX idx_stat_chain_puzzles_date ON stat_chain_puzzles(puzzle_date DESC);

-- Groups: Query by puzzle
CREATE INDEX idx_stat_chain_groups_puzzle ON stat_chain_groups(puzzle_id);

-- Teams: Query by group and team
CREATE INDEX idx_stat_chain_teams_group ON stat_chain_teams(group_id);
CREATE INDEX idx_stat_chain_teams_team ON stat_chain_teams(team_id);

-- Sessions: Query by user and puzzle
CREATE INDEX idx_stat_chain_sessions_user ON stat_chain_sessions(user_id);
CREATE INDEX idx_stat_chain_sessions_puzzle ON stat_chain_sessions(puzzle_id);
CREATE INDEX idx_stat_chain_sessions_status ON stat_chain_sessions(status);


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp triggers
CREATE TRIGGER update_stat_chain_puzzles_updated_at 
  BEFORE UPDATE ON stat_chain_puzzles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE stat_chain_puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_chain_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_chain_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_chain_sessions ENABLE ROW LEVEL SECURITY;

-- Puzzles: Anyone can view
CREATE POLICY "Anyone can view puzzles" ON stat_chain_puzzles
  FOR SELECT USING (true);

-- Groups: Anyone can view (puzzle solutions are public after solving)
CREATE POLICY "Anyone can view groups" ON stat_chain_groups
  FOR SELECT USING (true);

-- Teams: Anyone can view
CREATE POLICY "Anyone can view group teams" ON stat_chain_teams
  FOR SELECT USING (true);

-- Sessions: Users can only view/modify their own sessions
CREATE POLICY "Users can view own sessions" ON stat_chain_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON stat_chain_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON stat_chain_sessions
  FOR UPDATE USING (auth.uid() = user_id);


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get daily puzzle with all groups and teams
-- Returns a complete puzzle structure for a given date
CREATE OR REPLACE FUNCTION get_daily_puzzle(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  puzzle_id UUID,
  puzzle_date DATE,
  title TEXT,
  description TEXT,
  difficulty TEXT,
  groups JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS puzzle_id,
    p.puzzle_date,
    p.title,
    p.description,
    p.difficulty,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'group_name', g.group_name,
          'description', g.description,
          'stat_type', g.stat_type,
          'stat_value', g.stat_value,
          'difficulty_order', g.difficulty_order,
          'teams', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'team_id', sct.team_id,
                'team_name', t.name,
                'team_short_name', t.short_name,
                'display_order', sct.display_order
              ) ORDER BY sct.display_order
            )
            FROM stat_chain_teams sct
            JOIN teams t ON t.id = sct.team_id
            WHERE sct.group_id = g.id
          )
        ) ORDER BY g.difficulty_order
      )
      FROM stat_chain_groups g
      WHERE g.puzzle_id = p.id
    ) AS groups
  FROM stat_chain_puzzles p
  WHERE p.puzzle_date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_daily_puzzle IS 'Get complete puzzle structure including groups and teams for a given date';


-- Get or create user session for a puzzle
-- Creates a new session if one doesn't exist
CREATE OR REPLACE FUNCTION get_user_session(
  p_user_id UUID,
  p_puzzle_id UUID
)
RETURNS TABLE (
  session_id UUID,
  status TEXT,
  guesses_remaining INTEGER,
  groups_solved INTEGER,
  guess_history JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
) AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Try to get existing session
  SELECT id INTO v_session_id
  FROM stat_chain_sessions
  WHERE user_id = p_user_id AND puzzle_id = p_puzzle_id;
  
  -- Create new session if doesn't exist
  IF v_session_id IS NULL THEN
    INSERT INTO stat_chain_sessions (user_id, puzzle_id)
    VALUES (p_user_id, p_puzzle_id)
    RETURNING id INTO v_session_id;
  END IF;
  
  -- Return session data
  RETURN QUERY
  SELECT 
    s.id,
    s.status,
    s.guesses_remaining,
    s.groups_solved,
    s.guess_history,
    s.started_at,
    s.completed_at
  FROM stat_chain_sessions s
  WHERE s.id = v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_session IS 'Get existing session or create new one for user and puzzle';


-- Submit a guess and validate it
-- Returns the result of the guess and updates session state
CREATE OR REPLACE FUNCTION submit_guess(
  p_session_id UUID,
  p_team_ids UUID[]
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  correct BOOLEAN,
  group_id UUID,
  group_name TEXT,
  guesses_remaining INTEGER,
  game_status TEXT
) AS $$
DECLARE
  v_session RECORD;
  v_group RECORD;
  v_correct BOOLEAN := false;
  v_group_id UUID := NULL;
  v_group_name TEXT := NULL;
  v_new_guesses INTEGER;
  v_new_status TEXT;
  v_new_groups_solved INTEGER;
  v_guess_record JSONB;
BEGIN
  -- Get session
  SELECT * INTO v_session
  FROM stat_chain_sessions
  WHERE id = p_session_id;
  
  -- Validate session exists
  IF v_session IS NULL THEN
    RETURN QUERY SELECT false, 'Session not found', false, NULL::UUID, NULL::TEXT, 0, 'in_progress';
    RETURN;
  END IF;
  
  -- Validate game is still in progress
  IF v_session.status != 'in_progress' THEN
    RETURN QUERY SELECT false, 'Game already completed', false, NULL::UUID, NULL::TEXT, v_session.guesses_remaining, v_session.status;
    RETURN;
  END IF;
  
  -- Validate exactly 4 teams provided
  IF array_length(p_team_ids, 1) != 4 THEN
    RETURN QUERY SELECT false, 'Must select exactly 4 teams', false, NULL::UUID, NULL::TEXT, v_session.guesses_remaining, v_session.status;
    RETURN;
  END IF;
  
  -- Check if this guess matches a group
  SELECT g.* INTO v_group
  FROM stat_chain_groups g
  WHERE g.puzzle_id = v_session.puzzle_id
    AND (
      SELECT COUNT(*)
      FROM stat_chain_teams sct
      WHERE sct.group_id = g.id 
        AND sct.team_id = ANY(p_team_ids)
    ) = 4
    -- Group hasn't been solved yet
    AND NOT EXISTS (
      SELECT 1 
      FROM jsonb_array_elements(v_session.guess_history) AS guess
      WHERE (guess->>'correct')::boolean = true 
        AND (guess->>'group_id')::uuid = g.id
    );
  
  -- Set result based on match
  IF v_group IS NOT NULL THEN
    v_correct := true;
    v_group_id := v_group.id;
    v_group_name := v_group.group_name;
    v_new_groups_solved := v_session.groups_solved + 1;
    v_new_guesses := v_session.guesses_remaining;
  ELSE
    v_correct := false;
    v_new_groups_solved := v_session.groups_solved;
    v_new_guesses := v_session.guesses_remaining - 1;
  END IF;
  
  -- Determine new game status
  IF v_new_groups_solved = 4 THEN
    v_new_status := 'won';
  ELSIF v_new_guesses = 0 AND NOT v_correct THEN
    v_new_status := 'lost';
  ELSE
    v_new_status := 'in_progress';
  END IF;
  
  -- Create guess record
  v_guess_record := jsonb_build_object(
    'team_ids', to_jsonb(p_team_ids),
    'correct', v_correct,
    'group_id', v_group_id,
    'timestamp', NOW()
  );
  
  -- Update session
  UPDATE stat_chain_sessions
  SET 
    guesses_remaining = v_new_guesses,
    groups_solved = v_new_groups_solved,
    status = v_new_status,
    completed_at = CASE WHEN v_new_status IN ('won', 'lost') THEN NOW() ELSE NULL END,
    guess_history = guess_history || v_guess_record
  WHERE id = p_session_id;
  
  -- Return result
  RETURN QUERY SELECT 
    true AS success,
    CASE 
      WHEN v_correct THEN 'Correct! You found: ' || v_group_name
      WHEN v_new_status = 'lost' THEN 'Incorrect. Game over!'
      ELSE 'Incorrect. Try again!'
    END AS message,
    v_correct,
    v_group_id,
    v_group_name,
    v_new_guesses,
    v_new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION submit_guess IS 'Submit and validate a guess, updating session state accordingly';


-- Get puzzle statistics (how many people solved it, average guesses, etc.)
CREATE OR REPLACE FUNCTION get_puzzle_stats(p_puzzle_id UUID)
RETURNS TABLE (
  total_attempts INTEGER,
  total_wins INTEGER,
  total_losses INTEGER,
  win_rate DECIMAL,
  avg_guesses_used DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_attempts,
    COUNT(*) FILTER (WHERE status = 'won')::INTEGER AS total_wins,
    COUNT(*) FILTER (WHERE status = 'lost')::INTEGER AS total_losses,
    ROUND(
      COUNT(*) FILTER (WHERE status = 'won')::DECIMAL / 
      NULLIF(COUNT(*)::DECIMAL, 0) * 100, 
      1
    ) AS win_rate,
    ROUND(
      AVG(4 - guesses_remaining + CASE WHEN status = 'lost' THEN 1 ELSE 0 END),
      1
    ) AS avg_guesses_used
  FROM stat_chain_sessions
  WHERE puzzle_id = p_puzzle_id 
    AND status IN ('won', 'lost');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_puzzle_stats IS 'Get statistics for a puzzle (attempts, win rate, average guesses)';
