export interface Team {
  id: string;
  name: string;
  short_name: string;
  conference: {
    id: string;
    name: string;
    short_name: string;
    is_power_conference: boolean;
  };
}

export interface TeamSelection {
  team_id: string | null;
  picked_at: string;
}

export interface BracketPicks {
  version: number;
  last_updated: string;
  regions: {
    [regionName: string]: {
      seeds: {
        [seed: number]: TeamSelection;
      };
    };
  };
}

export interface BracketEditorProps {
  tournamentId: string;
  initialPicks: BracketPicks | null;
  teams: Team[];
  onSave: (picks: BracketPicks) => Promise<void>;
  autoSave?: boolean;
}

export interface RegionSectionProps {
  regionName: string;
  seeds: Record<number, TeamSelection>;
  teams: Team[];
  onTeamSelect: (seed: number, teamId: string) => void;
  onTeamRemove: (seed: number) => void;
}

export interface SeedSlotProps {
  seed: number;
  selectedTeam: Team | null;
  onSelect: () => void;
  onRemove: () => void;
}

export interface TeamSelectorProps {
  teams: Team[];
  selectedTeamIds: Set<string>;
  onSelect: (teamId: string) => void;
  onClose: () => void;
  open: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
