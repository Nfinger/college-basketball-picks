import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import type { SeedSlotProps } from './types';

export function SeedSlot({ seed, selectedTeam, onSelect, onRemove }: SeedSlotProps) {
  return (
    <Card className="p-3 hover:bg-accent cursor-pointer transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1" onClick={onSelect}>
          <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
            {seed}
          </Badge>
          {selectedTeam ? (
            <div className="flex-1">
              <div className="font-medium text-sm">{selectedTeam.short_name || selectedTeam.name}</div>
              <div className="text-xs text-muted-foreground">{selectedTeam.conference.short_name}</div>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Select team...</span>
          )}
        </div>
        {selectedTeam && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
