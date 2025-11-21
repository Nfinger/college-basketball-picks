-- Stat Chain Connections - Database Schema
-- Creates tables for daily puzzle game where users identify groups of 3 teams with shared connections

-- ============================================================================
-- TABLES
-- ============================================================================

-- Puzzles table (one per day)
CREATE TABLE stat_chain_puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_date DATE UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE stat_chain_puzzles IS 'Daily puzzles for Stat Chain Connections game';
COMMENT ON COLUMN stat_chain_puzzles.puzzle_date IS 'Date this puzzle is available for (YYYY-MM-DD)';

-- Groups table (4 groups per puzzle)
CREATE TABLE stat_chain_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id UUID NOT NULL REFERENCES stat_chain_puzzles(id) ON DELETE CASCADE,
  group_order INTEGER NOT NULL CHECK (group_order BETWEEN 1 AND 4),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
  connection_title TEXT NOT NULL,
  connection_explanation TEXT NOT NULL,
  UNIQUE(puzzle_id, group_order)
);

COMMENT ON TABLE stat_chain_groups IS 'Groups of teams with shared connections (4 per puzzle)';
COMMENT ON COLUMN stat_chain_groups.group_order IS 'Order for reveal (1-4), also indicates difficulty progression';
COMMENT ON COLUMN stat_chain_groups.difficulty IS 'Difficulty tier: easy, medium, hard, expert';
COMMENT ON COLUMN stat_chain_groups.connection_title IS 'Short title shown when solved (e.g., "All from ACC")';
COMMENT ON COLUMN stat_chain_groups.connection_explanation IS 'Detailed explanation shown after solving';

-- Group members (3 teams per group)
CREATE TABLE stat_chain_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES stat_chain_groups(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id),
  UNIQUE(group_id, team_id)
);

COMMENT ON TABLE stat_chain_teams IS 'Team assignments to groups (3 teams per group)';

-- User game sessions (tracks individual plays)
CREATE TABLE stat_chain_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id UUID NOT NULL REFERENCES stat_chain_puzzles(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  mistakes INTEGER DEFAULT 0 CHECK (mistakes >= 0 AND mistakes <= 4),
  solved_groups UUID[] DEFAULT '{}',
  guess_history JSONB DEFAULT '[]'::jsonb,
  UNIQUE(user_id, puzzle_id)
);

COMMENT ON TABLE stat_chain_sessions IS 'User game sessions tracking progress on puzzles';
COMMENT ON COLUMN stat_chain_sessions.mistakes IS 'Number of incorrect guesses (max 4 before game over)';
COMMENT ON COLUMN stat_chain_sessions.solved_groups IS 'Array of group IDs that have been solved';
COMMENT ON COLUMN stat_chain_sessions.guess_history IS 'JSON array of all guesses: [{ team_ids: [...], correct: bool, timestamp: ... }]';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_stat_chain_puzzles_date ON stat_chain_puzzles(puzzle_date);
CREATE INDEX idx_stat_chain_groups_puzzle ON stat_chain_groups(puzzle_id);
CREATE INDEX idx_stat_chain_teams_group ON stat_chain_teams(group_id);
CREATE INDEX idx_stat_chain_teams_team ON stat_chain_teams(team_id);
CREATE INDEX idx_stat_chain_sessions_user ON stat_chain_sessions(user_id);
CREATE INDEX idx_stat_chain_sessions_puzzle ON stat_chain_sessions(puzzle_id);
CREATE INDEX idx_stat_chain_sessions_user_puzzle ON stat_chain_sessions(user_id, puzzle_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE stat_chain_puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_chain_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_chain_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_chain_sessions ENABLE ROW LEVEL SECURITY;

-- Puzzles: Public read
CREATE POLICY "Puzzles are viewable by everyone"
  ON stat_chain_puzzles FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert puzzles"
  ON stat_chain_puzzles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Groups: Public read
CREATE POLICY "Groups are viewable by everyone"
  ON stat_chain_groups FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage groups"
  ON stat_chain_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Teams: Public read
CREATE POLICY "Team assignments are viewable by everyone"
  ON stat_chain_teams FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage team assignments"
  ON stat_chain_teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Sessions: Users can only access their own
CREATE POLICY "Users can view their own sessions"
  ON stat_chain_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON stat_chain_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON stat_chain_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get today's puzzle with all groups and teams
CREATE OR REPLACE FUNCTION get_daily_puzzle(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  puzzle_id UUID,
  puzzle_date DATE,
  group_id UUID,
  group_order INTEGER,
  difficulty TEXT,
  connection_title TEXT,
  connection_explanation TEXT,
  team_id UUID,
  team_name TEXT,
  team_short_name TEXT,
  team_logo_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS puzzle_id,
    p.puzzle_date,
    g.id AS group_id,
    g.group_order,
    g.difficulty,
    g.connection_title,
    g.connection_explanation,
    t.id AS team_id,
    t.name AS team_name,
    t.short_name AS team_short_name,
    t.logo_url AS team_logo_url
  FROM stat_chain_puzzles p
  JOIN stat_chain_groups g ON g.puzzle_id = p.id
  JOIN stat_chain_teams st ON st.group_id = g.id
  JOIN teams t ON t.id = st.team_id
  WHERE p.puzzle_date = target_date
  ORDER BY g.group_order, t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get or create user session for a puzzle
CREATE OR REPLACE FUNCTION get_or_create_session(
  p_user_id UUID,
  p_puzzle_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Try to find existing session
  SELECT id INTO v_session_id
  FROM stat_chain_sessions
  WHERE user_id = p_user_id AND puzzle_id = p_puzzle_id;

  -- Create if doesn't exist
  IF v_session_id IS NULL THEN
    INSERT INTO stat_chain_sessions (user_id, puzzle_id)
    VALUES (p_user_id, p_puzzle_id)
    RETURNING id INTO v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate that a puzzle has correct structure (4 groups, 3 teams each)
CREATE OR REPLACE FUNCTION validate_puzzle_structure(p_puzzle_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_group_count INTEGER;
  v_team_counts INTEGER[];
  v_total_teams INTEGER;
  v_unique_teams INTEGER;
BEGIN
  -- Check we have exactly 4 groups
  SELECT COUNT(*) INTO v_group_count
  FROM stat_chain_groups
  WHERE puzzle_id = p_puzzle_id;

  IF v_group_count != 4 THEN
    RETURN FALSE;
  END IF;

  -- Check each group has exactly 3 teams
  SELECT ARRAY_AGG(team_count) INTO v_team_counts
  FROM (
    SELECT COUNT(*) AS team_count
    FROM stat_chain_teams st
    JOIN stat_chain_groups g ON g.id = st.group_id
    WHERE g.puzzle_id = p_puzzle_id
    GROUP BY g.id
  ) counts;

  IF ARRAY_LENGTH(v_team_counts, 1) != 4 OR
     EXISTS (SELECT 1 FROM UNNEST(v_team_counts) t WHERE t != 3) THEN
    RETURN FALSE;
  END IF;

  -- Check total teams = 12 and all unique
  SELECT COUNT(*), COUNT(DISTINCT st.team_id)
  INTO v_total_teams, v_unique_teams
  FROM stat_chain_teams st
  JOIN stat_chain_groups g ON g.id = st.group_id
  WHERE g.puzzle_id = p_puzzle_id;

  RETURN v_total_teams = 12 AND v_unique_teams = 12;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
