-- Pick of the Day Metrics Functions
-- These functions provide separate statistics tracking for Pick of the Day picks

-- Function 1: Get user's overall Pick of the Day statistics
CREATE OR REPLACE FUNCTION get_user_potd_stats(user_uuid UUID)
RETURNS TABLE (
  total_potd BIGINT,
  wins BIGINT,
  losses BIGINT,
  pushes BIGINT,
  win_rate NUMERIC(5, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_potd,
    COUNT(*) FILTER (WHERE result = 'won')::BIGINT as wins,
    COUNT(*) FILTER (WHERE result = 'lost')::BIGINT as losses,
    COUNT(*) FILTER (WHERE result = 'push')::BIGINT as pushes,
    CASE
      WHEN COUNT(*) FILTER (WHERE result IN ('won', 'lost')) = 0 THEN 0
      ELSE ROUND(
        COUNT(*) FILTER (WHERE result = 'won')::NUMERIC /
        COUNT(*) FILTER (WHERE result IN ('won', 'lost'))::NUMERIC * 100,
        2
      )
    END as win_rate
  FROM picks
  WHERE user_id = user_uuid
    AND is_pick_of_day = true
    AND result != 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Get user's current Pick of the Day streak
CREATE OR REPLACE FUNCTION get_user_potd_streak(user_uuid UUID)
RETURNS TABLE (
  streak_type pick_result,
  streak_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH ordered_potd AS (
    SELECT
      result,
      locked_at,
      ROW_NUMBER() OVER (ORDER BY locked_at DESC) as rn,
      result = LAG(result) OVER (ORDER BY locked_at DESC) as is_same
    FROM picks
    WHERE user_id = user_uuid
      AND is_pick_of_day = true
      AND result IN ('won', 'lost')
      AND locked_at IS NOT NULL
    ORDER BY locked_at DESC
  ),
  streak_calc AS (
    SELECT
      result,
      COUNT(*) as count
    FROM ordered_potd
    WHERE rn = 1 OR is_same = true
    GROUP BY result
    LIMIT 1
  )
  SELECT
    result as streak_type,
    COALESCE(count::INTEGER, 0) as streak_count
  FROM streak_calc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Get comparison between Pick of the Day and Regular picks
CREATE OR REPLACE FUNCTION get_user_potd_comparison(user_uuid UUID)
RETURNS TABLE (
  pick_type TEXT,
  total_picks BIGINT,
  wins BIGINT,
  losses BIGINT,
  pushes BIGINT,
  win_rate NUMERIC(5, 2)
) AS $$
BEGIN
  RETURN QUERY
  -- POTD stats
  SELECT
    'Pick of the Day'::TEXT as pick_type,
    COUNT(*)::BIGINT as total_picks,
    COUNT(*) FILTER (WHERE result = 'won')::BIGINT as wins,
    COUNT(*) FILTER (WHERE result = 'lost')::BIGINT as losses,
    COUNT(*) FILTER (WHERE result = 'push')::BIGINT as pushes,
    CASE
      WHEN COUNT(*) FILTER (WHERE result IN ('won', 'lost')) = 0 THEN 0
      ELSE ROUND(
        COUNT(*) FILTER (WHERE result = 'won')::NUMERIC /
        COUNT(*) FILTER (WHERE result IN ('won', 'lost'))::NUMERIC * 100,
        2
      )
    END as win_rate
  FROM picks
  WHERE user_id = user_uuid
    AND is_pick_of_day = true
    AND result != 'pending'

  UNION ALL

  -- Regular picks stats
  SELECT
    'Regular Picks'::TEXT as pick_type,
    COUNT(*)::BIGINT as total_picks,
    COUNT(*) FILTER (WHERE result = 'won')::BIGINT as wins,
    COUNT(*) FILTER (WHERE result = 'lost')::BIGINT as losses,
    COUNT(*) FILTER (WHERE result = 'push')::BIGINT as pushes,
    CASE
      WHEN COUNT(*) FILTER (WHERE result IN ('won', 'lost')) = 0 THEN 0
      ELSE ROUND(
        COUNT(*) FILTER (WHERE result = 'won')::NUMERIC /
        COUNT(*) FILTER (WHERE result IN ('won', 'lost'))::NUMERIC * 100,
        2
      )
    END as win_rate
  FROM picks
  WHERE user_id = user_uuid
    AND is_pick_of_day = false
    AND result != 'pending'
  ORDER BY pick_type DESC; -- POTD first, Regular second
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION get_user_potd_stats IS 'Returns overall statistics for user''s Pick of the Day picks';
COMMENT ON FUNCTION get_user_potd_streak IS 'Returns current winning or losing streak for Pick of the Day picks';
COMMENT ON FUNCTION get_user_potd_comparison IS 'Compares performance between Pick of the Day and regular picks';
