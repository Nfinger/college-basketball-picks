-- Function to get available teams for a user in a given week
-- Respects burn rule: filters out teams already used by that user in the season
CREATE OR REPLACE FUNCTION get_available_teams_for_user(
  p_user_id UUID,
  p_week_id UUID,
  p_is_power_conference BOOLEAN
)
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  team_short_name TEXT,
  conference_id UUID,
  conference_name TEXT,
  conference_short_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id as team_id,
    t.name as team_name,
    t.short_name as team_short_name,
    c.id as conference_id,
    c.name as conference_name,
    c.short_name as conference_short_name
  FROM teams t
  INNER JOIN conferences c ON t.conference_id = c.id
  WHERE c.is_power_conference = p_is_power_conference
    AND NOT EXISTS (
      -- Exclude teams already used by this user in this season
      SELECT 1
      FROM fantasy_team_usage ftu
      INNER JOIN fantasy_weeks fw ON ftu.week_used_id = fw.id
      WHERE ftu.user_id = p_user_id
        AND ftu.team_id = t.id
        AND fw.season_id = (
          SELECT season_id FROM fantasy_weeks WHERE id = p_week_id
        )
    )
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate weekly stats for a lineup
-- Aggregates all games played by the lineup's teams during the week
CREATE OR REPLACE FUNCTION calculate_lineup_weekly_stats(
  p_lineup_id UUID
)
RETURNS TABLE (
  total_points INTEGER,
  total_rebounds INTEGER,
  total_assists INTEGER,
  total_steals INTEGER,
  total_blocks INTEGER,
  total_field_goals_made INTEGER,
  total_field_goals_attempted INTEGER,
  total_free_throws_made INTEGER,
  total_free_throws_attempted INTEGER,
  total_three_pointers_made INTEGER,
  total_three_pointers_attempted INTEGER,
  total_wins INTEGER,
  total_games INTEGER,
  field_goal_percentage DECIMAL(5, 3),
  free_throw_percentage DECIMAL(5, 3),
  three_point_percentage DECIMAL(5, 3),
  win_percentage DECIMAL(5, 3)
) AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
BEGIN
  -- Get the week date range
  SELECT fw.start_date, fw.end_date
  INTO v_week_start, v_week_end
  FROM fantasy_lineups fl
  INNER JOIN fantasy_weeks fw ON fl.week_id = fw.id
  WHERE fl.id = p_lineup_id;

  RETURN QUERY
  WITH lineup_teams AS (
    SELECT flt.team_id
    FROM fantasy_lineup_teams flt
    WHERE flt.lineup_id = p_lineup_id
  ),
  team_stats AS (
    SELECT
      tgs.points,
      tgs.rebounds,
      tgs.assists,
      tgs.steals,
      tgs.blocks,
      tgs.field_goals_made,
      tgs.field_goals_attempted,
      tgs.free_throws_made,
      tgs.free_throws_attempted,
      tgs.three_pointers_made,
      tgs.three_pointers_attempted,
      CASE
        WHEN g.status = 'completed' THEN
          CASE
            WHEN (tgs.is_home = true AND g.home_score > g.away_score) THEN 1
            WHEN (tgs.is_home = false AND g.away_score > g.home_score) THEN 1
            ELSE 0
          END
        ELSE 0
      END as is_win
    FROM team_game_stats tgs
    INNER JOIN games g ON tgs.game_id = g.id
    INNER JOIN lineup_teams lt ON tgs.team_id = lt.team_id
    WHERE g.game_date::date >= v_week_start
      AND g.game_date::date <= v_week_end
      AND g.status = 'completed'
  )
  SELECT
    COALESCE(SUM(points), 0)::INTEGER as total_points,
    COALESCE(SUM(rebounds), 0)::INTEGER as total_rebounds,
    COALESCE(SUM(assists), 0)::INTEGER as total_assists,
    COALESCE(SUM(steals), 0)::INTEGER as total_steals,
    COALESCE(SUM(blocks), 0)::INTEGER as total_blocks,
    COALESCE(SUM(field_goals_made), 0)::INTEGER as total_field_goals_made,
    COALESCE(SUM(field_goals_attempted), 0)::INTEGER as total_field_goals_attempted,
    COALESCE(SUM(free_throws_made), 0)::INTEGER as total_free_throws_made,
    COALESCE(SUM(free_throws_attempted), 0)::INTEGER as total_free_throws_attempted,
    COALESCE(SUM(three_pointers_made), 0)::INTEGER as total_three_pointers_made,
    COALESCE(SUM(three_pointers_attempted), 0)::INTEGER as total_three_pointers_attempted,
    COALESCE(SUM(is_win), 0)::INTEGER as total_wins,
    COUNT(*)::INTEGER as total_games,
    CASE
      WHEN SUM(field_goals_attempted) > 0
      THEN ROUND((SUM(field_goals_made)::DECIMAL / SUM(field_goals_attempted)::DECIMAL), 3)
      ELSE 0
    END as field_goal_percentage,
    CASE
      WHEN SUM(free_throws_attempted) > 0
      THEN ROUND((SUM(free_throws_made)::DECIMAL / SUM(free_throws_attempted)::DECIMAL), 3)
      ELSE 0
    END as free_throw_percentage,
    CASE
      WHEN SUM(three_pointers_attempted) > 0
      THEN ROUND((SUM(three_pointers_made)::DECIMAL / SUM(three_pointers_attempted)::DECIMAL), 3)
      ELSE 0
    END as three_point_percentage,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND((SUM(is_win)::DECIMAL / COUNT(*)::DECIMAL), 3)
      ELSE 0
    END as win_percentage
  FROM team_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to compare two lineups and determine category winners
CREATE OR REPLACE FUNCTION compare_lineups(
  p_lineup1_id UUID,
  p_lineup2_id UUID
)
RETURNS TABLE (
  category fantasy_category,
  lineup1_value DECIMAL(10, 3),
  lineup2_value DECIMAL(10, 3),
  winner_lineup_id UUID
) AS $$
DECLARE
  v_stats1 RECORD;
  v_stats2 RECORD;
BEGIN
  -- Get stats for both lineups
  SELECT * INTO v_stats1 FROM calculate_lineup_weekly_stats(p_lineup1_id);
  SELECT * INTO v_stats2 FROM calculate_lineup_weekly_stats(p_lineup2_id);

  -- Points
  RETURN QUERY SELECT
    'points'::fantasy_category,
    v_stats1.total_points::DECIMAL(10, 3),
    v_stats2.total_points::DECIMAL(10, 3),
    CASE
      WHEN v_stats1.total_points > v_stats2.total_points THEN p_lineup1_id
      WHEN v_stats2.total_points > v_stats1.total_points THEN p_lineup2_id
      ELSE NULL
    END;

  -- Rebounds
  RETURN QUERY SELECT
    'rebounds'::fantasy_category,
    v_stats1.total_rebounds::DECIMAL(10, 3),
    v_stats2.total_rebounds::DECIMAL(10, 3),
    CASE
      WHEN v_stats1.total_rebounds > v_stats2.total_rebounds THEN p_lineup1_id
      WHEN v_stats2.total_rebounds > v_stats1.total_rebounds THEN p_lineup2_id
      ELSE NULL
    END;

  -- Assists
  RETURN QUERY SELECT
    'assists'::fantasy_category,
    v_stats1.total_assists::DECIMAL(10, 3),
    v_stats2.total_assists::DECIMAL(10, 3),
    CASE
      WHEN v_stats1.total_assists > v_stats2.total_assists THEN p_lineup1_id
      WHEN v_stats2.total_assists > v_stats1.total_assists THEN p_lineup2_id
      ELSE NULL
    END;

  -- Steals
  RETURN QUERY SELECT
    'steals'::fantasy_category,
    v_stats1.total_steals::DECIMAL(10, 3),
    v_stats2.total_steals::DECIMAL(10, 3),
    CASE
      WHEN v_stats1.total_steals > v_stats2.total_steals THEN p_lineup1_id
      WHEN v_stats2.total_steals > v_stats1.total_steals THEN p_lineup2_id
      ELSE NULL
    END;

  -- Blocks
  RETURN QUERY SELECT
    'blocks'::fantasy_category,
    v_stats1.total_blocks::DECIMAL(10, 3),
    v_stats2.total_blocks::DECIMAL(10, 3),
    CASE
      WHEN v_stats1.total_blocks > v_stats2.total_blocks THEN p_lineup1_id
      WHEN v_stats2.total_blocks > v_stats1.total_blocks THEN p_lineup2_id
      ELSE NULL
    END;

  -- Field Goal %
  RETURN QUERY SELECT
    'field_goal_pct'::fantasy_category,
    v_stats1.field_goal_percentage::DECIMAL(10, 3),
    v_stats2.field_goal_percentage::DECIMAL(10, 3),
    CASE
      WHEN v_stats1.field_goal_percentage > v_stats2.field_goal_percentage THEN p_lineup1_id
      WHEN v_stats2.field_goal_percentage > v_stats1.field_goal_percentage THEN p_lineup2_id
      ELSE NULL
    END;

  -- Free Throw %
  RETURN QUERY SELECT
    'free_throw_pct'::fantasy_category,
    v_stats1.free_throw_percentage::DECIMAL(10, 3),
    v_stats2.free_throw_percentage::DECIMAL(10, 3),
    CASE
      WHEN v_stats1.free_throw_percentage > v_stats2.free_throw_percentage THEN p_lineup1_id
      WHEN v_stats2.free_throw_percentage > v_stats1.free_throw_percentage THEN p_lineup2_id
      ELSE NULL
    END;

  -- Three Point %
  RETURN QUERY SELECT
    'three_point_pct'::fantasy_category,
    v_stats1.three_point_percentage::DECIMAL(10, 3),
    v_stats2.three_point_percentage::DECIMAL(10, 3),
    CASE
      WHEN v_stats1.three_point_percentage > v_stats2.three_point_percentage THEN p_lineup1_id
      WHEN v_stats2.three_point_percentage > v_stats1.three_point_percentage THEN p_lineup2_id
      ELSE NULL
    END;

  -- Wins
  RETURN QUERY SELECT
    'wins'::fantasy_category,
    v_stats1.total_wins::DECIMAL(10, 3),
    v_stats2.total_wins::DECIMAL(10, 3),
    CASE
      WHEN v_stats1.total_wins > v_stats2.total_wins THEN p_lineup1_id
      WHEN v_stats2.total_wins > v_stats1.total_wins THEN p_lineup2_id
      ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
