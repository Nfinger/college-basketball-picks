-- Fix the spread evaluation logic in update_pick_results()
-- The previous version had the signs backwards:
-- - Favorites should SUBTRACT the spread (they must overcome it)
-- - Underdogs should ADD the spread (they get the benefit)
-- Also fixes missing parentheses causing operator precedence issues

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
