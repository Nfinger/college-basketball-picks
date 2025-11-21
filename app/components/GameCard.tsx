import { useState } from "react";
import { useFetcher, Link } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { format, isPast } from "date-fns";
import { cn } from "~/lib/utils";
import { Loader2, Star, AlertCircle, Trophy } from "lucide-react";
import { OthersPicksPopover } from "~/components/OthersPicksPopover";
import { GameDetailsDialogCompact } from "~/components/GameDetailsDialog";
import { ShareButton } from "~/components/ShareButton";
import { ShareModal } from "~/components/ShareModal";

interface Team {
  id: string;
  name: string;
  short_name: string;
}

interface Conference {
  id: string;
  name: string;
  short_name: string;
  is_power_conference: boolean;
}

interface Pick {
  id: string;
  picked_team_id: string;
  spread_at_pick_time: number;
  result: "won" | "lost" | "push" | "pending" | null;
  locked_at: string | null;
  is_pick_of_day: boolean;
  user_id: string;
  profiles?: {
    username: string;
  };
}

interface MatchupAnalysisData {
  id: string;
  analysis_text: string;
  prediction: {
    winner_team_id: string;
    winner_name: string;
    confidence: number;
    predicted_spread?: number;
  };
  key_insights: string[];
  analyzed_at: string;
}

interface Tournament {
  id: string;
  name: string;
  type: "mte" | "conference" | "ncaa";
  status: "upcoming" | "in_progress" | "completed";
}

interface Game {
  id: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  tournament_round: string | null;
  tournament_metadata: { seed_home?: number; seed_away?: number; region?: string } | null;
  home_team: Team;
  away_team: Team;
  home_score: number | null;
  away_score: number | null;
  spread: number | null;
  favorite_team_id: string | null;
  status: "scheduled" | "in_progress" | "completed" | "postponed" | "cancelled";
  conference: Conference;
  tournament?: Tournament | null;
  picks?: Pick[];
  matchup_analysis?: MatchupAnalysisData | null;
  home_team_injury_count?: number;
  away_team_injury_count?: number;
  home_team_rank?: number;
  away_team_rank?: number;
  home_team_net_eff?: number;
  away_team_net_eff?: number;
}

interface GameCardProps {
  game: Game;
  userPick?: Pick;
  otherPicks: Pick[];
  userId: string;
  potdGameId: string | null;
  isSwingGame?: boolean;
  homeTeamPickers?: Pick[];
  awayTeamPickers?: Pick[];
}

export function GameCard({
  game,
  userPick,
  otherPicks,
  userId: _userId,
  potdGameId,
  isSwingGame = false,
  homeTeamPickers = [],
  awayTeamPickers = [],
}: GameCardProps) {
  const fetcher = useFetcher();
  const gameDate = new Date(game.game_date);
  const isLocked = game.status !== "scheduled" || isPast(gameDate);
  const isCompleted = game.status === "completed";
  const [showOtherPick, setShowOtherPick] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Optimistic UI: check if we're submitting a pick for this game
  const isSubmitting = fetcher.state === "submitting";
  const submittingForThisGame = fetcher.formData?.get("gameId") === game.id;
  const optimisticPickedTeamId = fetcher.formData?.get("pickedTeamId") as string | undefined;

  // POTD state - database as source of truth with optimistic UI
  const dbIsPotd = userPick?.is_pick_of_day || false;
  const optimisticIsPotd = submittingForThisGame && isSubmitting
    ? fetcher.formData?.get("isPotd") === "true"
    : dbIsPotd;

  const hasPotdToday = potdGameId !== null;
  const thisGameIsPotd = potdGameId === game.id;
  const canTogglePotd = !isLocked && (!hasPotdToday || thisGameIsPotd) && userPick;

  // Determine which team is the favorite
  const homeIsFavorite = game.favorite_team_id === game.home_team.id;
  const awayIsFavorite = game.favorite_team_id === game.away_team.id;

  // Format spread display
  const getSpreadDisplay = (teamId: string) => {
    if (!game.spread) return null;

    if (teamId === game.favorite_team_id) {
      return `-${game.spread}`;
    } else if (game.favorite_team_id) {
      return `+${game.spread}`;
    }
    return null;
  };

  // Check if user picked this team (with optimistic UI)
  const isUserPick = (teamId: string) => {
    if (isSubmitting && optimisticPickedTeamId) {
      return optimisticPickedTeamId === teamId;
    }
    return userPick?.picked_team_id === teamId;
  };

  // Check if any other user picked this team
  const isOtherPick = (teamId: string) => {
    if (!showOtherPick) return false;
    return otherPicks.some(pick => pick.picked_team_id === teamId);
  };

  // Get result badge color
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

  // Determine picked team for share modal
  const pickedTeam = userPick?.picked_team_id === game.home_team.id
    ? game.home_team
    : game.away_team;

  // Get tournament type display name
  const getTournamentTypeBadge = (type: Tournament["type"]) => {
    switch (type) {
      case "ncaa":
        return "NCAA";
      case "mte":
        return "MTE";
      case "conference":
        return "CONF";
      default:
        return "TOURN";
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[200px] pb-0">
      <div className="relative">
        {/* Pick of the Day Star - Top Right Corner */}
        {userPick && (
          <div className="absolute -top-4 right-2 flex justify-end">
            {!isLocked ? (
              <fetcher.Form method="post">
                <input type="hidden" name="gameId" value={game.id} />
                <input type="hidden" name="pickedTeamId" value={userPick.picked_team_id} />
                <input type="hidden" name="spread" value={game.spread || ""} />
                <input type="hidden" name="isPotd" value={(!optimisticIsPotd).toString()} />
                <button
                  type="submit"
                  disabled={!canTogglePotd}
                  className={cn(
                    "transition-all duration-200 p-1 rounded-full",
                    canTogglePotd &&
                      "hover:scale-110 cursor-pointer hover:bg-yellow-50 dark:hover:bg-yellow-900/20",
                    !canTogglePotd && "opacity-40 cursor-not-allowed"
                  )}
                  title={
                    !canTogglePotd && hasPotdToday && !thisGameIsPotd
                      ? "You already have a Pick of the Day"
                      : optimisticIsPotd
                        ? "Remove Pick of the Day"
                        : "Mark as Pick of the Day"
                  }
                >
                  <Star
                    className={cn(
                      "w-5 h-5 transition-all duration-200",
                      optimisticIsPotd
                        ? "fill-yellow-400 text-yellow-500 drop-shadow-md"
                        : "text-slate-400 dark:text-slate-600"
                    )}
                  />
                </button>
              </fetcher.Form>
            ) : (
              userPick.is_pick_of_day && (
                <Badge className="bg-yellow-500 text-white border-0 text-xs px-2 py-0.5 shadow-md">
                  <Star className="w-3 h-3 fill-white inline mr-1" />
                  POTD
                </Badge>
              )
            )}
          </div>
        )}
      </div>
      <CardContent className="flex-1 flex flex-col">
        {/* Three Column Grid Layout */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 flex-1">
          {/* Left Column: Away Team */}
          <fetcher.Form
            method="post"
            onClick={(e) => {
              if (!isLocked && !isSubmitting) {
                e.currentTarget.requestSubmit();
              }
            }}
            className={cn(
              "flex flex-col items-center justify-center p-1.5 rounded-lg transition-all duration-200 h-full",
              !isLocked && "cursor-pointer hover:scale-105 hover:shadow-md",
              isLocked && "opacity-60 cursor-not-allowed",
              isUserPick(game.away_team.id) &&
                "ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 shadow-md",
              isOtherPick(game.away_team.id) &&
                "ring-2 ring-orange-400 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20",
              !isUserPick(game.away_team.id) && !isOtherPick(game.away_team.id) &&
                "border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600"
            )}
            role={!isLocked ? "button" : undefined}
            aria-label={!isLocked ? `Pick ${game.away_team.name}` : undefined}
            tabIndex={!isLocked ? 0 : undefined}
            onKeyDown={(e) => {
              if (
                !isLocked &&
                !isSubmitting &&
                (e.key === "Enter" || e.key === " ")
              ) {
                e.preventDefault();
                e.currentTarget.requestSubmit();
              }
            }}
          >
            <input type="hidden" name="gameId" value={game.id} />
            <input
              type="hidden"
              name="pickedTeamId"
              value={game.away_team.id}
            />
            <input type="hidden" name="spread" value={game.spread || ""} />
            <input
              type="hidden"
              name="isPotd"
              value={optimisticIsPotd ? "true" : "false"}
            />

            <div className="text-center space-y-1 w-full">
              {/* Line 1: Team Name + Ranking + Seed + Injury Icon */}
              <div
                className="flex items-center justify-center gap-1.5"
                title={game.away_team.name}
              >
                {game.away_team_rank && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    #{game.away_team_rank}
                  </span>
                )}
                {game.tournament_metadata?.seed_away && (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
                    {game.tournament_metadata.seed_away}
                  </span>
                )}
                <span className="font-bold text-base text-slate-900 dark:text-slate-100 truncate max-w-[100px]">
                  {game.away_team.short_name}
                </span>
                {game.away_team_injury_count != null && game.away_team_injury_count > 0 && (
                  <div title={`${game.away_team_injury_count} ${game.away_team_injury_count === 1 ? 'injury' : 'injuries'}`}>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </div>
                )}
              </div>

              {/* Line 2: Score (if completed) or Spread */}
              {isCompleted && game.away_score !== null ? (
                <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {game.away_score}
                </div>
              ) : game.spread ? (
                <div
                  className={cn(
                    "text-base font-mono font-semibold",
                    awayIsFavorite
                      ? "text-purple-700 dark:text-purple-400"
                      : "text-slate-600 dark:text-slate-400"
                  )}
                >
                  {getSpreadDisplay(game.away_team.id)}
                </div>
              ) : (
                <div className="h-[24px]" /> // Placeholder to maintain height
              )}

              {isSubmitting && optimisticPickedTeamId === game.away_team.id && (
                <div className="flex items-center justify-center gap-1 text-xs text-slate-600 dark:text-slate-400 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="font-medium">Saving...</span>
                </div>
              )}
            </div>
          </fetcher.Form>

          {/* Center Column: Result & Status */}
          <div className="flex flex-col items-center justify-center px-1 space-y-1.5 min-w-[40px] h-full">
            {userPick && (
              <div className="flex flex-col items-center gap-1">
                {userPick.result && userPick.result !== "pending" && (
                  <Badge
                    className={cn(
                      getResultColor(userPick.result),
                      "font-bold shadow-md text-xs px-1.5 py-0.5"
                    )}
                  >
                    {userPick.result.toUpperCase()}
                  </Badge>
                )}
                {isLocked && userPick.result === "pending" && (
                  <Badge
                    variant="outline"
                    className="text-xs border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5"
                  >
                    Locked
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Home Team */}
          <fetcher.Form
            method="post"
            onClick={(e) => {
              if (!isLocked && !isSubmitting) {
                e.currentTarget.requestSubmit();
              }
            }}
            className={cn(
              "flex flex-col items-center justify-center p-1.5 rounded-lg transition-all duration-200 h-full",
              !isLocked && "cursor-pointer hover:scale-105 hover:shadow-md",
              isLocked && "opacity-60 cursor-not-allowed",
              isUserPick(game.home_team.id) &&
                "ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 shadow-md",
              isOtherPick(game.home_team.id) &&
                "ring-2 ring-orange-400 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20",
              !isUserPick(game.home_team.id) && !isOtherPick(game.home_team.id) &&
                "border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600"
            )}
            role={!isLocked ? "button" : undefined}
            aria-label={!isLocked ? `Pick ${game.home_team.name}` : undefined}
            tabIndex={!isLocked ? 0 : undefined}
            onKeyDown={(e) => {
              if (
                !isLocked &&
                !isSubmitting &&
                (e.key === "Enter" || e.key === " ")
              ) {
                e.preventDefault();
                e.currentTarget.requestSubmit();
              }
            }}
          >
            <input type="hidden" name="gameId" value={game.id} />
            <input
              type="hidden"
              name="pickedTeamId"
              value={game.home_team.id}
            />
            <input type="hidden" name="spread" value={game.spread || ""} />
            <input
              type="hidden"
              name="isPotd"
              value={optimisticIsPotd ? "true" : "false"}
            />

            <div className="text-center space-y-1 w-full">
              {/* Line 1: Team Name + Ranking + Seed + Injury Icon */}
              <div
                className="flex items-center justify-center gap-1.5"
                title={game.home_team.name}
              >
                {game.home_team_rank && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    #{game.home_team_rank}
                  </span>
                )}
                {game.tournament_metadata?.seed_home && (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
                    {game.tournament_metadata.seed_home}
                  </span>
                )}
                <span className="font-bold text-base text-slate-900 dark:text-slate-100 truncate max-w-[100px]">
                  {game.home_team.short_name}
                </span>
                {game.home_team_injury_count != null && game.home_team_injury_count > 0 && (
                  <div title={`${game.home_team_injury_count} ${game.home_team_injury_count === 1 ? 'injury' : 'injuries'}`}>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </div>
                )}
              </div>

              {/* Line 2: Score (if completed) or Spread */}
              {isCompleted && game.home_score !== null ? (
                <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {game.home_score}
                </div>
              ) : game.spread ? (
                <div
                  className={cn(
                    "text-base font-mono font-semibold",
                    homeIsFavorite
                      ? "text-purple-700 dark:text-purple-400"
                      : "text-slate-600 dark:text-slate-400"
                  )}
                >
                  {getSpreadDisplay(game.home_team.id)}
                </div>
              ) : (
                <div className="h-[24px]" /> // Placeholder to maintain height
              )}

              {isSubmitting && optimisticPickedTeamId === game.home_team.id && (
                <div className="flex items-center justify-center gap-1 text-xs text-slate-600 dark:text-slate-400 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="font-medium">Saving...</span>
                </div>
              )}
            </div>
          </fetcher.Form>
        </div>
      </CardContent>

      {/* Footer with Conference and Time */}
      <div className="px-2 pb-2 pt-1 border-t border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            {game.conference && (
              <Badge
                variant={
                  game.conference.is_power_conference ? "default" : "secondary"
                }
                className="font-semibold text-xs px-1.5 py-0.5"
              >
                {game.conference.short_name}
              </Badge>
            )}
            {game.tournament && (
              <Link to={`/tournaments/${game.tournament.id}`}>
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-0 text-xs px-1.5 py-0.5 cursor-pointer transition-colors flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  {game.tournament.name}
                  <span className="ml-0.5 opacity-75">
                    ({getTournamentTypeBadge(game.tournament.type)})
                  </span>
                </Badge>
              </Link>
            )}
            {game.status === "in_progress" && (
              <Badge className="bg-red-600 text-white border-0 animate-pulse-soft shadow-lg shadow-red-600/50 text-xs px-1.5 py-0.5">
                <span className="inline-block w-1 h-1 rounded-full bg-white mr-1 animate-pulse"></span>
                LIVE
              </Badge>
            )}
            {game.status === "completed" && (
              <Badge className="bg-slate-600 text-white border-0 text-xs px-1.5 py-0.5">
                FINAL
              </Badge>
            )}
            {isSwingGame && (
              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 text-xs px-1.5 py-0.5 shadow-md font-bold">
                ⚔️ SWING
              </Badge>
            )}
            <OthersPicksPopover
              otherPicks={otherPicks}
              homeTeam={game.home_team}
              awayTeam={game.away_team}
              showOtherPick={showOtherPick}
              onToggle={() => setShowOtherPick(!showOtherPick)}
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Share button - only show for POTD picks */}
            {userPick?.is_pick_of_day && (
              <ShareButton
                onClick={() => setShareModalOpen(true)}
                size="sm"
                variant="ghost"
                className="h-7 px-2"
              />
            )}
            <GameDetailsDialogCompact
              game={game}
              userPick={userPick}
              potdGameId={potdGameId}
              enablePicking={true}
            />
            <span
              className="text-xs font-semibold text-slate-600 dark:text-slate-400"
              suppressHydrationWarning
            >
              {format(gameDate, "h:mm a")}
            </span>
          </div>
        </div>
        {/* Swing Game Details - Show who picked which side */}
        {isSwingGame && (
          <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                {awayTeamPickers.map(p => p.profiles?.username).join(", ")}
              </span>
            </div>
            <span className="text-slate-400 dark:text-slate-600 font-bold px-1">vs</span>
            <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                {homeTeamPickers.map(p => p.profiles?.username).join(", ")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {userPick?.is_pick_of_day && (
        <ShareModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          pickId={userPick.id}
          pickedTeam={pickedTeam}
          spread={userPick.spread_at_pick_time}
        />
      )}
    </Card>
  );
}
