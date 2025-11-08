-- Create junction table for news articles and teams
CREATE TABLE IF NOT EXISTS news_article_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure we don't duplicate article-team pairs
  UNIQUE(news_article_id, team_id)
);

-- Add indexes for efficient querying
CREATE INDEX idx_news_article_teams_article_id ON news_article_teams(news_article_id);
CREATE INDEX idx_news_article_teams_team_id ON news_article_teams(team_id);

-- Add RLS policies
ALTER TABLE news_article_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "News article teams are viewable by everyone"
  ON news_article_teams FOR SELECT
  USING (true);
