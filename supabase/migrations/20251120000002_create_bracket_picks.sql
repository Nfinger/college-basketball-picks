-- Create bracket_picks table for tournament bracket predictions
CREATE TABLE bracket_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

  -- Store all bracket picks as JSONB for flexibility
  -- Structure: { "game_id": { "winner_team_id": "uuid", "picked_at": "timestamp" } }
  picks JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Track champion selection
  champion_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One bracket per user per tournament
  UNIQUE(user_id, tournament_id)
);

-- Create indexes
CREATE INDEX idx_bracket_picks_user_id ON bracket_picks(user_id);
CREATE INDEX idx_bracket_picks_tournament_id ON bracket_picks(tournament_id);
CREATE INDEX idx_bracket_picks_user_tournament ON bracket_picks(user_id, tournament_id);

-- Enable RLS
ALTER TABLE bracket_picks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view and modify their own bracket picks
CREATE POLICY "Users can view their own bracket picks" ON bracket_picks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bracket picks" ON bracket_picks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bracket picks" ON bracket_picks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bracket picks" ON bracket_picks
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for bracket_picks updated_at
CREATE TRIGGER update_bracket_picks_updated_at BEFORE UPDATE ON bracket_picks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add next_game_id to tournament_metadata for auto-progression
-- This is optional metadata that can be added to games to link them to their next round game
COMMENT ON COLUMN games.tournament_metadata IS
'JSONB metadata for tournament games. Common fields:
- seed_home: integer seed for home team
- seed_away: integer seed for away team
- region: string region name (for NCAA tournaments)
- bracket_position: string position identifier
- next_game_id: UUID of the game this winner advances to
- winner_position: "home" or "away" in next game';
