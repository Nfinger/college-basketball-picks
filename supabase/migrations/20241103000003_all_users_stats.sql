-- Function to get stats for all users at once (fixes N+1 query problem)
CREATE OR REPLACE FUNCTION get_all_users_overall_stats()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  total_picks BIGINT,
  wins BIGINT,
  losses BIGINT,
  pushes BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id as user_id,
    pr.username,
    COUNT(p.id) as total_picks,
    COUNT(*) FILTER (WHERE p.result = 'won') as wins,
    COUNT(*) FILTER (WHERE p.result = 'lost') as losses,
    COUNT(*) FILTER (WHERE p.result = 'push') as pushes,
    ROUND(
      COUNT(*) FILTER (WHERE p.result = 'won')::NUMERIC /
      NULLIF(COUNT(*) FILTER (WHERE p.result IN ('won', 'lost')), 0) * 100,
      2
    ) as win_rate
  FROM profiles pr
  LEFT JOIN picks p ON pr.id = p.user_id
  GROUP BY pr.id, pr.username
  HAVING COUNT(p.id) > 0
  ORDER BY win_rate DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
