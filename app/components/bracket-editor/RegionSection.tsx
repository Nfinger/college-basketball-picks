import { SeedSlot } from './SeedSlot';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { RegionSectionProps } from './types';

export function RegionSection({
  regionName,
  seeds,
  teams,
  onTeamSelect,
  onTeamRemove
}: RegionSectionProps) {
  const getTeamById = (teamId: string | null) => {
    if (!teamId) return null;
    return teams.find(t => t.id === teamId) || null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{regionName} Region</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Array.from({ length: 16 }, (_, i) => i + 1).map((seed) => (
            <SeedSlot
              key={seed}
              seed={seed}
              selectedTeam={getTeamById(seeds[seed]?.team_id || null)}
              onSelect={() => onTeamSelect(seed, '')}
              onRemove={() => onTeamRemove(seed)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
