-- Create news_articles table
CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  content TEXT,
  image_url TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes on news_articles table
CREATE UNIQUE INDEX idx_news_articles_url ON news_articles(url);
CREATE INDEX idx_news_articles_published_at ON news_articles(published_at DESC);
CREATE INDEX idx_news_articles_categories ON news_articles USING GIN(categories);
CREATE INDEX idx_news_articles_source ON news_articles(source);

-- Add updated_at trigger
CREATE TRIGGER update_news_articles_updated_at BEFORE UPDATE ON news_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- RLS Policy for news_articles (public read)
CREATE POLICY "Anyone can view news articles" ON news_articles
  FOR SELECT USING (true);

-- Add helpful comments
COMMENT ON TABLE news_articles IS 'Stores aggregated college basketball news articles from various sources';
COMMENT ON COLUMN news_articles.url IS 'Unique URL used for deduplication of articles';
COMMENT ON COLUMN news_articles.categories IS 'Array of category tags: recruiting, analysis, game_recap, injuries, transfers, rankings, conference_news, coaching, general';
COMMENT ON COLUMN news_articles.content IS 'Article description or excerpt from RSS feed';
