-- Create injury status enum
CREATE TYPE injury_status AS ENUM ('out', 'questionable', 'doubtful', 'day-to-day', 'probable');

-- Create injury_reports table
CREATE TABLE injury_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  injury_type TEXT,
  status injury_status NOT NULL,
  description TEXT,
  reported_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_return DATE,
  source_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes on injury_reports table
CREATE INDEX idx_injury_reports_team_id ON injury_reports(team_id);
CREATE INDEX idx_injury_reports_status ON injury_reports(status);
CREATE INDEX idx_injury_reports_is_active ON injury_reports(is_active);
CREATE INDEX idx_injury_reports_reported_date ON injury_reports(reported_date);

-- Create composite index for active injuries by team
CREATE INDEX idx_active_injuries_by_team ON injury_reports(team_id, is_active) WHERE is_active = true;

-- Add updated_at trigger
CREATE TRIGGER update_injury_reports_updated_at BEFORE UPDATE ON injury_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE injury_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy for injury_reports (public read)
CREATE POLICY "Anyone can view injury reports" ON injury_reports
  FOR SELECT USING (true);

-- Add helpful comment
COMMENT ON TABLE injury_reports IS 'Stores player injury information for college basketball teams';
COMMENT ON COLUMN injury_reports.is_active IS 'Set to false when player returns or injury is outdated';
COMMENT ON COLUMN injury_reports.source_url IS 'URL to the source of the injury report for credibility';
