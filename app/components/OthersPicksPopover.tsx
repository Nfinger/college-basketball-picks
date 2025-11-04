import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Badge } from "~/components/ui/badge";
import { Eye, EyeOff, Star } from "lucide-react";
import { cn } from "~/lib/utils";

interface Pick {
  id: string;
  picked_team_id: string;
  spread_at_pick_time: number;
  result: "won" | "lost" | "push" | "pending" | null;
  is_pick_of_day: boolean;
  user_id: string;
  profiles?: {
    username: string;
  };
}

interface Team {
  id: string;
  name: string;
  short_name: string;
}

interface OthersPicksPopoverProps {
  otherPicks: Pick[];
  homeTeam: Team;
  awayTeam: Team;
  showOtherPick: boolean;
  onToggle: () => void;
}

export function OthersPicksPopover({
  otherPicks,
  homeTeam,
  awayTeam,
  showOtherPick,
  onToggle,
}: OthersPicksPopoverProps) {
  if (otherPicks.length === 0) return null;

  const getResultColor = (result: Pick["result"]) => {
    switch (result) {
      case "won":
        return "bg-green-500 text-white";
      case "lost":
        return "bg-red-500 text-white";
      case "push":
        return "bg-gray-500 text-white";
      default:
        return "bg-blue-500 text-white";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          title={showOtherPick ? "Hide others' picks" : `Show ${otherPicks.length} other pick${otherPicks.length !== 1 ? 's' : ''}`}
        >
          {showOtherPick ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          <span className="font-medium">{otherPicks.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">
            Others' Picks ({otherPicks.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {otherPicks.map((pick) => {
              const pickedTeam = pick.picked_team_id === homeTeam.id
                ? homeTeam
                : awayTeam;
              const spreadDisplay = pick.spread_at_pick_time > 0
                ? `+${pick.spread_at_pick_time}`
                : pick.spread_at_pick_time;

              return (
                <div
                  key={pick.id}
                  className="border-b pb-2 last:border-b-0 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      @{pick.profiles?.username || 'Unknown'}
                    </span>
                    {pick.is_pick_of_day && (
                      <Badge className="bg-yellow-500 text-white text-xs px-1.5 py-0.5">
                        <Star className="h-2.5 w-2.5 fill-white inline mr-0.5" />
                        POTD
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      {pickedTeam.short_name} {spreadDisplay}
                    </span>
                    {pick.result && pick.result !== "pending" && (
                      <Badge className={cn(getResultColor(pick.result), "text-xs px-1.5 py-0.5")}>
                        {pick.result.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
