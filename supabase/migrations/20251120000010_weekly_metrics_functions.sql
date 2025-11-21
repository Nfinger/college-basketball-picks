-- Function to get weekly user stats
-- Gets stats for the current week (Monday to Sunday)
CREATE OR REPLACE FUNCTION get_user_weekly_stats(user_uuid UUID)
RETURNS TABLE (
  total_picks BIGINT,
  wins BIGINT,
  losses BIGINT,
  pushes BIGINT,
  win_rate NUMERIC,
  week_start DATE,
  week_end DATE
) AS $$
DECLARE
  week_start_date DATE;
  week_end_date DATE;
BEGIN
  -- Calculate current week boundaries (Monday to Sunday)
  week_start_date := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  week_end_date := (week_start_date + INTERVAL '6 days')::DATE;

  RETURN QUERY
  SELECT
    COUNT(*) as total_picks,
    COUNT(*) FILTER (WHERE result = 'won') as wins,
    COUNT(*) FILTER (WHERE result = 'lost') as losses,
    COUNT(*) FILTER (WHERE result = 'push') as pushes,
    ROUND(
      COUNT(*) FILTER (WHERE result = 'won')::NUMERIC /
      NULLIF(COUNT(*) FILTER (WHERE result IN ('won', 'lost')), 0) * 100,
      2
    ) as win_rate,
    week_start_date,
    week_end_date
  FROM picks
  WHERE user_id = user_uuid
    AND result IS NOT NULL
    AND DATE(created_at) >= week_start_date
    AND DATE(created_at) <= week_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get weekly stats by conference
CREATE OR REPLACE FUNCTION get_user_weekly_conference_stats(user_uuid UUID)
RETURNS TABLE (
  conference_id UUID,
  conference_name TEXT,
  conference_short_name TEXT,
  is_power_conference BOOLEAN,
  total_picks BIGINT,
  wins BIGINT,
  losses BIGINT,
  win_rate NUMERIC
) AS $$
DECLARE
  week_start_date DATE;
  week_end_date DATE;
BEGIN
  -- Calculate current week boundaries (Monday to Sunday)
  week_start_date := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  week_end_date := (week_start_date + INTERVAL '6 days')::DATE;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.short_name,
    c.is_power_conference,
    COUNT(*) as total_picks,
    COUNT(*) FILTER (WHERE p.result = 'won') as wins,
    COUNT(*) FILTER (WHERE p.result = 'lost') as losses,
    ROUND(
      COUNT(*) FILTER (WHERE p.result = 'won')::NUMERIC /
      NULLIF(COUNT(*) FILTER (WHERE p.result IN ('won', 'lost')), 0) * 100,
      2
    ) as win_rate
  FROM picks p
  JOIN games g ON p.game_id = g.id
  JOIN conferences c ON g.conference_id = c.id
  WHERE p.user_id = user_uuid
    AND p.result IS NOT NULL
    AND DATE(p.created_at) >= week_start_date
    AND DATE(p.created_at) <= week_end_date
  GROUP BY c.id, c.name, c.short_name, c.is_power_conference
  ORDER BY total_picks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get weekly current streak
CREATE OR REPLACE FUNCTION get_user_weekly_streak(user_uuid UUID)
RETURNS TABLE (
  streak_type pick_result,
  streak_count INTEGER
) AS $$
DECLARE
  latest_result pick_result;
  current_streak INT := 0;
  week_start_date DATE;
  week_end_date DATE;
BEGIN
  -- Calculate current week boundaries (Monday to Sunday)
  week_start_date := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  week_end_date := (week_start_date + INTERVAL '6 days')::DATE;

  -- Get the most recent result within the week
  SELECT result INTO latest_result
  FROM picks
  WHERE user_id = user_uuid
    AND result IN ('won', 'lost')
    AND DATE(created_at) >= week_start_date
    AND DATE(created_at) <= week_end_date
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no picks found, return null
  IF latest_result IS NULL THEN
    RETURN;
  END IF;

  -- Count consecutive results of the same type within the week
  WITH ordered_picks AS (
    SELECT
      result,
      created_at,
      ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
    FROM picks
    WHERE user_id = user_uuid
      AND result IN ('won', 'lost')
      AND DATE(created_at) >= week_start_date
      AND DATE(created_at) <= week_end_date
  )
  SELECT COUNT(*)::INTEGER INTO current_streak
  FROM ordered_picks
  WHERE result = latest_result
    AND rn <= (
      SELECT COALESCE(MIN(rn), 0)
      FROM ordered_picks
      WHERE result != latest_result
    );

  -- If no break in streak found, count all matching picks
  IF current_streak = 0 THEN
    SELECT COUNT(*)::INTEGER INTO current_streak
    FROM ordered_picks
    WHERE result = latest_result;
  END IF;

  RETURN QUERY SELECT latest_result, current_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get weekly POTD stats
CREATE OR REPLACE FUNCTION get_user_weekly_potd_stats(user_uuid UUID)
RETURNS TABLE (
  total_potd BIGINT,
  wins BIGINT,
  losses BIGINT,
  win_rate NUMERIC
) AS $$
DECLARE
  week_start_date DATE;
  week_end_date DATE;
BEGIN
  -- Calculate current week boundaries (Monday to Sunday)
  week_start_date := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  week_end_date := (week_start_date + INTERVAL '6 days')::DATE;

  RETURN QUERY
  SELECT
    COUNT(*) as total_potd,
    COUNT(*) FILTER (WHERE result = 'won') as wins,
    COUNT(*) FILTER (WHERE result = 'lost') as losses,
    ROUND(
      COUNT(*) FILTER (WHERE result = 'won')::NUMERIC /
      NULLIF(COUNT(*) FILTER (WHERE result IN ('won', 'lost')), 0) * 100,
      2
    ) as win_rate
  FROM picks
  WHERE user_id = user_uuid
    AND is_potd = TRUE
    AND result IS NOT NULL
    AND DATE(created_at) >= week_start_date
    AND DATE(created_at) <= week_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get weekly POTD streak
CREATE OR REPLACE FUNCTION get_user_weekly_potd_streak(user_uuid UUID)
RETURNS TABLE (
  streak_type pick_result,
  streak_count INTEGER
) AS $$
DECLARE
  latest_result pick_result;
  current_streak INT := 0;
  week_start_date DATE;
  week_end_date DATE;
BEGIN
  -- Calculate current week boundaries (Monday to Sunday)
  week_start_date := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  week_end_date := (week_start_date + INTERVAL '6 days')::DATE;

  -- Get the most recent POTD result within the week
  SELECT result INTO latest_result
  FROM picks
  WHERE user_id = user_uuid
    AND is_potd = TRUE
    AND result IN ('won', 'lost')
    AND DATE(created_at) >= week_start_date
    AND DATE(created_at) <= week_end_date
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no picks found, return null
  IF latest_result IS NULL THEN
    RETURN;
  END IF;

  -- Count consecutive results of the same type within the week
  WITH ordered_picks AS (
    SELECT
      result,
      created_at,
      ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
    FROM picks
    WHERE user_id = user_uuid
      AND is_potd = TRUE
      AND result IN ('won', 'lost')
      AND DATE(created_at) >= week_start_date
      AND DATE(created_at) <= week_end_date
  )
  SELECT COUNT(*)::INTEGER INTO current_streak
  FROM ordered_picks
  WHERE result = latest_result
    AND rn <= (
      SELECT COALESCE(MIN(rn), 0)
      FROM ordered_picks
      WHERE result != latest_result
    );

  -- If no break in streak found, count all matching picks
  IF current_streak = 0 THEN
    SELECT COUNT(*)::INTEGER INTO current_streak
    FROM ordered_picks
    WHERE result = latest_result;
  END IF;

  RETURN QUERY SELECT latest_result, current_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
