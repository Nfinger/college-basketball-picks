import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Search, Check } from "lucide-react";
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

interface TeamSearchComboboxProps {
  teams: Team[];
  selectedTeamIds: string[];
  onSelectTeam: (teamId: string) => void;
  maxTeams?: number;
  placeholder?: string;
}

/**
 * Searchable team selector combobox
 * Allows users to search and select teams
 *
 * @example
 * ```tsx
 * <TeamSearchCombobox
 *   teams={allTeams}
 *   selectedTeamIds={rankedTeamIds}
 *   onSelectTeam={(teamId) => addTeamToRanking(teamId)}
 *   maxTeams={25}
 *   placeholder="Add team to ranking..."
 * />
 * ```
 */
export function TeamSearchCombobox({
  teams,
  selectedTeamIds,
  onSelectTeam,
  maxTeams = 25,
  placeholder = "Search teams...",
}: TeamSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Filter out already selected teams and apply search
  const availableTeams = teams.filter(
    (team) =>
      !selectedTeamIds.includes(team.id) &&
      (team.name.toLowerCase().includes(search.toLowerCase()) ||
        team.short_name.toLowerCase().includes(search.toLowerCase()) ||
        team.conference.name.toLowerCase().includes(search.toLowerCase()))
  );

  // Group by conference
  const teamsByConference = availableTeams.reduce(
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

  const handleSelectTeam = (teamId: string) => {
    onSelectTeam(teamId);
    setSearch("");
    setOpen(false);
  };

  const isMaxReached = selectedTeamIds.length >= maxTeams;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start text-muted-foreground"
          disabled={isMaxReached}
        >
          <Search className="mr-2 h-4 w-4" />
          {isMaxReached
            ? `Maximum of ${maxTeams} teams reached`
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <ScrollArea className="h-[300px]">
          {sortedConferences.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {search ? "No teams found" : "All teams have been added"}
            </div>
          ) : (
            <div className="p-2">
              {sortedConferences.map(({ conference, teams: confTeams }) => (
                <div key={conference.id} className="mb-4">
                  <div className="mb-2 flex items-center gap-2 px-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {conference.short_name}
                    </span>
                    {conference.is_power_conference && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        Power
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {confTeams.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => handleSelectTeam(team.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                          "transition-colors"
                        )}
                      >
                        <span>{team.name}</span>
                        {selectedTeamIds.includes(team.id) && (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
