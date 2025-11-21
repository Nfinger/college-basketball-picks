import { useState, useEffect, useCallback } from 'react';
import { RegionSection } from './RegionSection';
import { TeamSelector } from './TeamSelector';
import { createEmptyBracket, validateBracket, getAllSelectedTeamIds } from './utils';
import type { BracketEditorProps, BracketPicks } from './types';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { CheckCircle2, Loader2 } from 'lucide-react';

type SaveStatus = 'idle' | 'saving' | 'saved';

export function BracketEditor({
  tournamentId,
  initialPicks,
  teams,
  onSave,
  autoSave = true
}: BracketEditorProps) {
  const [picks, setPicks] = useState<BracketPicks>(
    initialPicks || createEmptyBracket()
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ region: string; seed: number } | null>(null);

  useEffect(() => {
    if (!autoSave) return;

    const timeout = setTimeout(() => {
      setSaveStatus('saving');
      onSave(picks)
        .then(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        })
        .catch(err => {
          console.error('Save failed:', err);
          setSaveStatus('idle');
        });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [picks, autoSave, onSave]);

  const handleTeamSelect = (region: string, seed: number, teamId: string) => {
    if (!teamId) {
      setSelectedSlot({ region, seed });
      setSelectorOpen(true);
      return;
    }

    const newPicks = { ...picks };
    if (!newPicks.regions[region]) {
      newPicks.regions[region] = { seeds: {} };
    }
    newPicks.regions[region].seeds[seed] = {
      team_id: teamId,
      picked_at: new Date().toISOString()
    };
    newPicks.last_updated = new Date().toISOString();
    setPicks(newPicks);
  };

  const handleTeamRemove = (region: string, seed: number) => {
    const newPicks = { ...picks };
    if (newPicks.regions[region]?.seeds[seed]) {
      newPicks.regions[region].seeds[seed] = {
        team_id: null,
        picked_at: new Date().toISOString()
      };
      newPicks.last_updated = new Date().toISOString();
      setPicks(newPicks);
    }
  };

  const handleTeamSelectorSelect = useCallback((teamId: string) => {
    if (selectedSlot) {
      handleTeamSelect(selectedSlot.region, selectedSlot.seed, teamId);
    }
  }, [selectedSlot]);

  const validation = validateBracket(picks);
  const selectedTeamIds = getAllSelectedTeamIds(picks);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Season-Long Bracket Predictions</h2>
        {saveStatus !== 'idle' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Saved
              </>
            )}
          </div>
        )}
      </div>

      {!validation.valid && validation.errors.length > 0 && (
        <Alert>
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {validation.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {['East', 'West', 'South', 'Midwest'].map(region => (
          <RegionSection
            key={region}
            regionName={region}
            seeds={picks.regions[region]?.seeds || {}}
            teams={teams}
            onTeamSelect={(seed) => handleTeamSelect(region, seed, '')}
            onTeamRemove={(seed) => handleTeamRemove(region, seed)}
          />
        ))}
      </div>

      <TeamSelector
        teams={teams}
        selectedTeamIds={selectedTeamIds}
        onSelect={handleTeamSelectorSelect}
        onClose={() => setSelectorOpen(false)}
        open={selectorOpen}
      />
    </div>
  );
}
