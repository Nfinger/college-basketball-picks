-- Create tournament type enum
CREATE TYPE tournament_type AS ENUM ('mte', 'conference', 'ncaa');

-- Create tournament status enum
CREATE TYPE tournament_status AS ENUM ('upcoming', 'in_progress', 'completed');

-- Create tournaments table
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type tournament_type NOT NULL,
  year INTEGER NOT NULL,
  status tournament_status NOT NULL DEFAULT 'upcoming',

  -- Location/timing
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location TEXT,

  -- Type-specific metadata stored as JSONB
  -- Examples:
  --   MTE: {"teams": ["Duke", "Kansas"], "format": "single_elimination"}
  --   Conference: {"conference_id": "uuid", "auto_bid": true}
  --   NCAA: {"regions": ["East", "West", "South", "Midwest"]}
  metadata JSONB DEFAULT '{}'::jsonb,

  -- External data source tracking
  external_id TEXT,
  external_source TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes on tournaments table
CREATE INDEX idx_tournaments_type_year ON tournaments(type, year);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_external_id ON tournaments(external_id) WHERE external_id IS NOT NULL;

-- Extend games table with tournament information
ALTER TABLE games
  ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  ADD COLUMN tournament_round TEXT,
  ADD COLUMN tournament_metadata JSONB DEFAULT '{}'::jsonb;

-- Create indexes for tournament game queries
CREATE INDEX idx_games_tournament_id ON games(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX idx_games_tournament_round ON games(tournament_id, tournament_round) WHERE tournament_id IS NOT NULL;

-- Optional: Tournament team participation tracking
CREATE TABLE tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  seed INTEGER,
  region TEXT,
  eliminated_in_round TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tournament_id, team_id)
);

CREATE INDEX idx_tournament_teams_tournament ON tournament_teams(tournament_id);
CREATE INDEX idx_tournament_teams_team ON tournament_teams(team_id);

-- Enable RLS on new tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tournaments (public read)
CREATE POLICY "Anyone can view tournaments" ON tournaments
  FOR SELECT USING (true);

-- RLS Policies for tournament_teams (public read)
CREATE POLICY "Anyone can view tournament teams" ON tournament_teams
  FOR SELECT USING (true);

-- Create trigger for tournaments updated_at
CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to get tournament bracket structure
CREATE OR REPLACE FUNCTION get_tournament_bracket(tournament_uuid UUID)
RETURNS TABLE (
  round TEXT,
  region TEXT,
  games JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.tournament_round,
    COALESCE(g.tournament_metadata->>'region', '') as region,
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'external_id', g.external_id,
        'game_date', g.game_date,
        'status', g.status,
        'home_team', jsonb_build_object(
          'id', ht.id,
          'name', ht.name,
          'short_name', ht.short_name
        ),
        'away_team', jsonb_build_object(
          'id', at.id,
          'name', at.name,
          'short_name', at.short_name
        ),
        'home_score', g.home_score,
        'away_score', g.away_score,
        'spread', g.spread,
        'seed_home', (g.tournament_metadata->>'seed_home')::integer,
        'seed_away', (g.tournament_metadata->>'seed_away')::integer,
        'bracket_position', g.tournament_metadata->>'bracket_position'
      )
      ORDER BY g.game_date, g.id
    ) as games
  FROM games g
  LEFT JOIN teams ht ON g.home_team_id = ht.id
  LEFT JOIN teams at ON g.away_team_id = at.id
  WHERE g.tournament_id = tournament_uuid
  GROUP BY g.tournament_round, g.tournament_metadata->>'region'
  ORDER BY
    CASE g.tournament_round
      WHEN 'first_four' THEN 1
      WHEN 'round_of_64' THEN 2
      WHEN 'round_of_32' THEN 3
      WHEN 'sweet_16' THEN 4
      WHEN 'elite_8' THEN 5
      WHEN 'final_four' THEN 6
      WHEN 'championship' THEN 7
      ELSE 99
    END,
    region;
END;
$$ LANGUAGE plpgsql;
