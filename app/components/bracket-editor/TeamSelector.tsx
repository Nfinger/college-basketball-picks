import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Badge } from '~/components/ui/badge';
import type { TeamSelectorProps } from './types';

export function TeamSelector({ teams, selectedTeamIds, onSelect, onClose, open }: TeamSelectorProps) {
  const [search, setSearch] = useState('');

  const filteredTeams = useMemo(() => {
    const searchLower = search.toLowerCase();
    return teams.filter(team =>
      team.name.toLowerCase().includes(searchLower) ||
      team.short_name?.toLowerCase().includes(searchLower) ||
      team.conference.name.toLowerCase().includes(searchLower)
    );
  }, [teams, search]);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Team</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {filteredTeams.map((team) => {
                const isSelected = selectedTeamIds.has(team.id);
                return (
                  <button
                    key={team.id}
                    onClick={() => {
                      if (!isSelected) {
                        onSelect(team.id);
                        onClose();
                      }
                    }}
                    disabled={isSelected}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'hover:bg-accent cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{team.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {team.conference.name}
                        </div>
                      </div>
                      <Badge variant={team.conference.is_power_conference ? 'default' : 'secondary'}>
                        {team.conference.short_name}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
