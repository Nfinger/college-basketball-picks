-- Function to get overall user stats
CREATE OR REPLACE FUNCTION get_user_overall_stats(user_uuid UUID)
RETURNS TABLE (
  total_picks BIGINT,
  wins BIGINT,
  losses BIGINT,
  pushes BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
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
    ) as win_rate
  FROM picks
  WHERE user_id = user_uuid AND result IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get stats by conference
CREATE OR REPLACE FUNCTION get_user_conference_stats(user_uuid UUID)
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
BEGIN
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
  GROUP BY c.id, c.name, c.short_name, c.is_power_conference
  ORDER BY total_picks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current streak
CREATE OR REPLACE FUNCTION get_user_current_streak(user_uuid UUID)
RETURNS TABLE (
  streak_type pick_result,
  streak_count INTEGER
) AS $$
DECLARE
  latest_result pick_result;
  current_streak INT := 0;
BEGIN
  -- Get the most recent result
  SELECT result INTO latest_result
  FROM picks
  WHERE user_id = user_uuid AND result IN ('won', 'lost')
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no picks found, return null
  IF latest_result IS NULL THEN
    RETURN;
  END IF;

  -- Count consecutive results of the same type
  WITH ordered_picks AS (
    SELECT
      result,
      created_at,
      ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
    FROM picks
    WHERE user_id = user_uuid AND result IN ('won', 'lost')
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

-- Function to update pick results when scores are finalized
CREATE OR REPLACE FUNCTION update_pick_results()
RETURNS void AS $$
BEGIN
  UPDATE picks p
  SET result = CASE
    -- Team picked is favorite and covered the spread
    -- Favorites must overcome the spread, so we SUBTRACT it from their score
    WHEN p.picked_team_id = g.favorite_team_id AND (
         (g.home_team_id = p.picked_team_id AND g.home_score - p.spread_at_pick_time > g.away_score) OR
         (g.away_team_id = p.picked_team_id AND g.away_score - p.spread_at_pick_time > g.home_score)
    )
    THEN 'won'::pick_result

    -- Team picked is underdog and covered the spread
    -- Underdogs get the benefit of the spread, so we ADD it to their score
    WHEN p.picked_team_id != g.favorite_team_id AND (
         (g.home_team_id = p.picked_team_id AND g.home_score + p.spread_at_pick_time > g.away_score) OR
         (g.away_team_id = p.picked_team_id AND g.away_score + p.spread_at_pick_time > g.home_score)
    )
    THEN 'won'::pick_result

    -- Push (exactly the spread) - check both favorite and underdog formulas
    WHEN (p.picked_team_id = g.favorite_team_id AND (
           (g.home_team_id = p.picked_team_id AND g.home_score - p.spread_at_pick_time = g.away_score) OR
           (g.away_team_id = p.picked_team_id AND g.away_score - p.spread_at_pick_time = g.home_score)
         )) OR
         (p.picked_team_id != g.favorite_team_id AND (
           (g.home_team_id = p.picked_team_id AND g.home_score + p.spread_at_pick_time = g.away_score) OR
           (g.away_team_id = p.picked_team_id AND g.away_score + p.spread_at_pick_time = g.home_score)
         ))
    THEN 'push'::pick_result

    -- Otherwise, lost
    ELSE 'lost'::pick_result
  END,
  locked_at = CASE
    WHEN p.locked_at IS NULL THEN g.game_date
    ELSE p.locked_at
  END
  FROM games g
  WHERE p.game_id = g.id
    AND g.status = 'completed'
    AND g.home_score IS NOT NULL
    AND g.away_score IS NOT NULL
    AND p.result = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
