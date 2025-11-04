import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useFavoriteTeams } from "~/contexts/FavoriteTeamsContext";
import { Star, Search } from "lucide-react";
import { cn } from "~/lib/utils";

interface Team {
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

interface FavoriteTeamManagerProps {
  teams: Team[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Full team selection interface modal
 * Shows all teams grouped by conference, searchable
 * Allows bulk "Clear All" action
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * <FavoriteTeamManager
 *   teams={allTeams}
 *   open={open}
 *   onOpenChange={setOpen}
 * />
 * ```
 */
export function FavoriteTeamManager({
  teams,
  open,
  onOpenChange,
}: FavoriteTeamManagerProps) {
  const [search, setSearch] = useState("");
  const { isFavorite, toggleFavorite, favoriteTeamIds } = useFavoriteTeams();

  // Filter and group teams
  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(search.toLowerCase()) ||
      team.short_name.toLowerCase().includes(search.toLowerCase())
  );

  // Group by conference
  const teamsByConference = filteredTeams.reduce(
    (acc, team) => {
      const confId = team.conference.id;
      if (!acc[confId]) {
        acc[confId] = {
          conference: team.conference,
          teams: [],
        };
      }
      acc[confId].teams.push(team);
      return acc;
    },
    {} as Record<string, { conference: Team["conference"]; teams: Team[] }>
  );

  // Sort: Power conferences first, then alphabetically
  const sortedConferences = Object.values(teamsByConference).sort((a, b) => {
    if (a.conference.is_power_conference !== b.conference.is_power_conference) {
      return a.conference.is_power_conference ? -1 : 1;
    }
    return a.conference.name.localeCompare(b.conference.name);
  });

  const handleClearAll = () => {
    favoriteTeamIds.forEach((id) => toggleFavorite(id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Manage My Teams</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {favoriteTeamIds.length} team{favoriteTeamIds.length !== 1 ? "s" : ""}{" "}
            selected
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Team List */}
        <ScrollArea className="h-[400px] pr-4">
          {sortedConferences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No teams found
            </div>
          ) : (
            sortedConferences.map(({ conference, teams: confTeams }) => (
              <div key={conference.id} className="mb-6">
                <h3 className="font-semibold mb-2 sticky top-0 bg-background py-2 flex items-center gap-2">
                  {conference.name}
                  {conference.is_power_conference && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      Power
                    </span>
                  )}
                </h3>
                <div className="space-y-1">
                  {confTeams.map((team) => {
                    const isFav = isFavorite(team.id);
                    return (
                      <button
                        key={team.id}
                        onClick={() => toggleFavorite(team.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleFavorite(team.id);
                          }
                        }}
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded hover:bg-accent transition-colors",
                          isFav && "bg-accent/50"
                        )}
                        aria-label={`${isFav ? "Remove" : "Add"} ${team.name} ${isFav ? "from" : "to"} favorites`}
                      >
                        <span className="text-sm">{team.name}</span>
                        <Star
                          className={cn(
                            "h-4 w-4 transition-colors flex-shrink-0",
                            isFav
                              ? "fill-yellow-500 text-yellow-500"
                              : "text-muted-foreground"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClearAll}
            disabled={favoriteTeamIds.length === 0}
            className="w-full sm:w-auto"
          >
            Clear All
          </Button>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
