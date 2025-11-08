-- Add external_ids JSONB column to support multiple data sources
-- This allows us to map teams across ESPN, KenPom, BartTorvik, etc.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS external_ids JSONB DEFAULT '{}'::jsonb;

-- Migrate existing external_id data to external_ids JSONB
-- Assumes external_id came from The Odds API
UPDATE teams
  SET external_ids = jsonb_build_object('odds_api', external_id)
  WHERE external_id IS NOT NULL AND external_id != '';

-- Create index for faster lookups by external source
CREATE INDEX IF NOT EXISTS idx_teams_external_ids ON teams USING gin(external_ids);

-- Add helpful comment
COMMENT ON COLUMN teams.external_ids IS 'Maps team identifiers from various sources: {odds_api: "...", espn: "...", kenpom: "...", barttorvik: "..."}';
