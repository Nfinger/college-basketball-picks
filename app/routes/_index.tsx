import { useEffect, useState } from "react";
import {
  useLoaderData,
  useNavigate,
  useActionData,
  useOutletContext,
  useSearchParams,
  useFetcher,
} from "react-router";
import type { Route } from "./+types/_index";
import { requireAuth } from "~/lib/auth.server";
import { getFavoriteTeamIds } from "~/lib/favorites.server";
import { GameCard } from "~/components/GameCard";
import { DatePicker } from "~/components/DatePicker";
import { GameFilters } from "~/components/GameFilters";
import { TournamentFilters } from "~/components/TournamentFilters";
import { Button } from "~/components/ui/button";
import { format, addDays, subDays, parseISO, isValid } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Trophy, Sparkles, TrendingUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { GameAnalytics } from "~/components/GameAnalytics";
import { MatchupAnalysis } from "~/components/MatchupAnalysis";
import { cn } from "~/lib/utils";

type GameWithRelations = {
  id: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  tournament_round: string | null;
  tournament_metadata: { seed_home?: number; seed_away?: number; region?: string } | null;
  home_team: { id: string; name: string; short_name: string };
  away_team: { id: string; name: string; short_name: string };
  home_score: number | null;
  away_score: number | null;
  spread: number | null;
  favorite_team_id: string | null;
  status: "scheduled" | "in_progress" | "completed" | "postponed" | "cancelled";
  conference: {
    id: string;
    name: string;
    short_name: string;
    is_power_conference: boolean;
  };
  tournament?: {
    id: string;
    name: string;
    type: "mte" | "conference" | "ncaa";
    status: "upcoming" | "in_progress" | "completed";
  } | null;
  picks?: {
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
  }[];
  matchup_analyses?: {
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
  }[];
  home_team_injury_count?: number;
  away_team_injury_count?: number;
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase, headers } = await requireAuth(request);

  // Define timezone constant
  const timezone = "America/New_York";

  // Get current date in Eastern Time
  const nowInET = toZonedTime(new Date(), timezone);
  const todayStr = format(nowInET, "yyyy-MM-dd");

  // Parse and validate date from query parameter
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  let targetDate: Date;
  let dateStr: string;

  if (dateParam) {
    const parsed = parseISO(dateParam);
    if (isValid(parsed)) {
      targetDate = parsed;
      dateStr = format(parsed, "yyyy-MM-dd");
    } else {
      // Invalid date param, use today in ET
      targetDate = nowInET;
      dateStr = todayStr;
    }
  } else {
    // No date param, use today in ET
    targetDate = nowInET;
    dateStr = todayStr;
  }

  const isToday = dateStr === todayStr;

  // Parse filter parameters from URL
  const search = url.searchParams.get("search") || "";
  const conferenceIds = url.searchParams.getAll("conf");
  const powerOnly = url.searchParams.get("power") === "true";
  const midMajorOnly = url.searchParams.get("midmajor") === "true";
  const picksOnly = url.searchParams.get("picks") === "true";
  const opponentPicksOnly = url.searchParams.get("opponentpicks") === "true";
  const excitingOnly = url.searchParams.get("exciting") === "true";
  const swingOnly = url.searchParams.get("swing") === "true";
  const myTeamsOnly = url.searchParams.get("myTeamsOnly") === "true";

  // Get user's favorite teams for filtering
  const favoriteTeamIds = await getFavoriteTeamIds(supabase, user.id);

  // Create date boundaries in Eastern Time, then convert to UTC for the query
  // This ensures we get all games that occur on the selected date in EST/EDT

  // Create start of day in Eastern Time (midnight)
  const startOfDayET = new Date(targetDate);
  startOfDayET.setHours(0, 0, 0, 0);
  const startOfDay = fromZonedTime(startOfDayET, timezone);

  // Create end of day in Eastern Time (23:59:59.999)
  const endOfDayET = new Date(targetDate);
  endOfDayET.setHours(23, 59, 59, 999);
  const endOfDay = fromZonedTime(endOfDayET, timezone);

  // Build games query with optional My Teams filter
  let gamesQuery = supabase
    .from("games")
    .select(
      `
      *,
      home_team_id,
      away_team_id,
      home_team:teams!games_home_team_id_fkey(id, name, short_name),
      away_team:teams!games_away_team_id_fkey(id, name, short_name),
      conference:conferences(id, name, short_name, is_power_conference),
      tournament:tournaments(id, name, type, status),
      picks(id, picked_team_id, spread_at_pick_time, result, locked_at, is_pick_of_day, user_id),
      matchup_analyses!matchup_analyses_game_id_fkey(id, analysis_text, prediction, key_insights, analyzed_at)
    `
    )
    .gte("game_date", startOfDay.toISOString())
    .lte("game_date", endOfDay.toISOString());

  // Apply My Teams filter if enabled and user has favorites
  if (myTeamsOnly && favoriteTeamIds.length > 0) {
    gamesQuery = gamesQuery.or(
      `home_team_id.in.(${favoriteTeamIds.join(",")}),away_team_id.in.(${favoriteTeamIds.join(",")})`
    );
  }

  gamesQuery = gamesQuery.order("game_date", { ascending: true });

  // Fetch games, conferences, profiles, POTD status, active tournaments, and bracket picks in parallel
  const [gamesResult, conferencesResult, profilesResult, potdResult, tournamentsResult, bracketPicksResult] = await Promise.all([
    gamesQuery,
    supabase
      .from("conferences")
      .select("id, name, short_name, is_power_conference")
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, username"),
    supabase
      .from("picks")
      .select("game_id")
      .eq("user_id", user.id)
      .eq("is_pick_of_day", true)
      .eq("game_date_cache", dateStr)
      .maybeSingle(),
    supabase
      .from("tournaments")
      .select(`
        id,
        name,
        type,
        status,
        start_date,
        end_date,
        location,
        games:games(count)
      `)
      .order("start_date", { ascending: true }),
    supabase
      .from("bracket_picks")
      .select("tournament_id, picks, champion_team_id")
      .eq("user_id", user.id),
  ]);

  // Log errors but don't fail - return empty arrays instead
  if (gamesResult.error) {
    console.error("Error fetching games:", gamesResult.error);
  }
  if (conferencesResult.error) {
    console.error("Error fetching conferences:", conferencesResult.error);
  }
  if (profilesResult.error) {
    console.error("Error fetching profiles:", profilesResult.error);
  }
  if (potdResult.error) {
    console.error("Error fetching POTD status:", potdResult.error);
  }

  // Create a map of user_id -> username for quick lookup
  const profilesMap = new Map<string, string>();
  (profilesResult.data || []).forEach((profile: { id: string; username: string }) => {
    profilesMap.set(profile.id, profile.username);
  });

  // Merge profile data into picks and normalize matchup_analyses
  const allGames = (gamesResult.data || []).map((game: GameWithRelations) => ({
    ...game,
    picks: game.picks?.map(pick => ({
      ...pick,
      profiles: pick.user_id ? { username: profilesMap.get(pick.user_id) || 'Unknown' } : undefined,
    })),
    matchup_analysis: game.matchup_analyses && game.matchup_analyses.length > 0 ? game.matchup_analyses[0] : null,
  }));

  // Fetch injury counts and team stats for all teams in the games
  const teamIds = Array.from(
    new Set(
      allGames.flatMap((game: GameWithRelations) => [
        game.home_team.id,
        game.away_team.id,
      ])
    )
  );

  // Get current season
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const currentSeason = month >= 8 ? year + 1 : year;

  // Fetch injury counts and team stats in parallel
  const [injuryResult, teamStatsResult] = await Promise.all([
    supabase
      .from('injury_reports')
      .select('team_id')
      .eq('is_active', true)
      .in('team_id', teamIds),
    supabase
      .from('team_stats')
      .select('team_id, overall_rank, source, offensive_efficiency, defensive_efficiency')
      .eq('season', currentSeason)
      .in('team_id', teamIds)
  ]);

  // Create a map of team_id -> injury count
  const injuryCountMap = new Map<string, number>();
  (injuryResult.data || []).forEach((injury: { team_id: string }) => {
    injuryCountMap.set(
      injury.team_id,
      (injuryCountMap.get(injury.team_id) || 0) + 1
    );
  });

  // Create a map of team_id -> best ranking (prioritize kenpom > barttorvik > espn)
  const teamStatsMap = new Map<string, { rank: number; netEff: number }>();
  (teamStatsResult.data || []).forEach((stat: {
    team_id: string;
    overall_rank: number;
    source: string;
    offensive_efficiency: number;
    defensive_efficiency: number;
  }) => {
    const existingStat = teamStatsMap.get(stat.team_id);
    const sourcePriority = { kenpom: 3, barttorvik: 2, espn: 1 };
    const currentPriority = sourcePriority[stat.source as keyof typeof sourcePriority] || 0;
    const existingPriority = existingStat ?
      (sourcePriority[(teamStatsResult.data?.find((s: any) =>
        s.team_id === stat.team_id && s.overall_rank === existingStat.rank
      )?.source) as keyof typeof sourcePriority] || 0) : 0;

    if (!existingStat || currentPriority > existingPriority) {
      const netEff = stat.offensive_efficiency && stat.defensive_efficiency ?
        stat.offensive_efficiency - stat.defensive_efficiency : 0;
      teamStatsMap.set(stat.team_id, {
        rank: stat.overall_rank,
        netEff: netEff
      });
    }
  });

  // Add injury counts and team stats to games
  const allGamesWithInjuries = allGames.map((game: GameWithRelations) => ({
    ...game,
    home_team_injury_count: injuryCountMap.get(game.home_team.id) || 0,
    away_team_injury_count: injuryCountMap.get(game.away_team.id) || 0,
    home_team_rank: teamStatsMap.get(game.home_team.id)?.rank,
    away_team_rank: teamStatsMap.get(game.away_team.id)?.rank,
    home_team_net_eff: teamStatsMap.get(game.home_team.id)?.netEff,
    away_team_net_eff: teamStatsMap.get(game.away_team.id)?.netEff,
  }));

  // Apply filters server-side
  const filteredGames = allGamesWithInjuries.filter((game: GameWithRelations) => {
    // Search filter - search both full name and abbreviation
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesHome =
        game.home_team.name.toLowerCase().includes(searchLower) ||
        game.home_team.short_name.toLowerCase().includes(searchLower);
      const matchesAway =
        game.away_team.name.toLowerCase().includes(searchLower) ||
        game.away_team.short_name.toLowerCase().includes(searchLower);
      if (!matchesHome && !matchesAway) return false;
    }

    // Conference filter
    if (conferenceIds.length > 0) {
      if (!conferenceIds.includes(game.conference.id)) return false;
    }

    // Power conference filter
    if (powerOnly && !game.conference.is_power_conference) {
      return false;
    }

    // Mid-major filter
    if (midMajorOnly && game.conference.is_power_conference) {
      return false;
    }

    // Picks only filter
    if (picksOnly) {
      const userPick = game.picks?.find(p => p.user_id === user.id);
      if (!userPick) return false;
    }

    // Others' picks only filter
    if (opponentPicksOnly) {
      const othersPicks = game.picks?.filter(p => p.user_id !== user.id);
      if (!othersPicks || othersPicks.length === 0) return false;
    }

    // Exciting games filter - close spreads in power conferences OR very close spreads anywhere
    if (excitingOnly) {
      if (game.spread === null) {
        return false; // No spread data means we can't determine if it's exciting
      }

      const isPowerConferenceCloseGame = game.conference.is_power_conference && game.spread <= 5;
      const isVeryCloseGame = game.spread <= 2.5;

      if (!isPowerConferenceCloseGame && !isVeryCloseGame) {
        return false;
      }
    }

    // Swing games filter - games where users picked opposite sides
    if (swingOnly) {
      if (!game.picks || game.picks.length < 2) {
        return false; // Need at least 2 picks for a swing game
      }

      // Check if both home and away teams have picks
      const homeTeamPicks = game.picks.filter(p => p.picked_team_id === game.home_team.id);
      const awayTeamPicks = game.picks.filter(p => p.picked_team_id === game.away_team.id);

      // It's a swing game if both teams have at least one pick
      if (homeTeamPicks.length === 0 || awayTeamPicks.length === 0) {
        return false;
      }
    }

    return true;
  });

  // Sort games: upcoming games first (by start time), then completed games (by start time)
  const sortedGames = filteredGames.sort((a: GameWithRelations, b: GameWithRelations) => {
    const aIsFinished = ["completed", "postponed", "cancelled"].includes(a.status);
    const bIsFinished = ["completed", "postponed", "cancelled"].includes(b.status);

    // If one is finished and the other isn't, put finished at the bottom
    if (aIsFinished && !bIsFinished) return 1;
    if (!aIsFinished && bIsFinished) return -1;

    // Both have same status category, sort by game_date (start time)
    const aDate = new Date(a.game_date).getTime();
    const bDate = new Date(b.game_date).getTime();
    return aDate - bDate;
  });

  // Process bracket picks to create tournament completion map
  const bracketCompletion = new Map<string, { hasPicks: boolean; championPicked: boolean }>();
  (bracketPicksResult.data || []).forEach((bracket: { tournament_id: string; picks: any; champion_team_id: string | null }) => {
    const hasPicks = bracket.picks && Object.keys(bracket.picks).length > 0;
    const championPicked = !!bracket.champion_team_id;
    bracketCompletion.set(bracket.tournament_id, { hasPicks, championPicked });
  });

  return {
    games: sortedGames,
    allGamesCount: allGamesWithInjuries.length,
    conferences: conferencesResult.data || [],
    tournaments: tournamentsResult.data || [],
    bracketCompletion: Object.fromEntries(bracketCompletion),
    date: dateStr,
    isToday,
    potdGameId: potdResult.data?.game_id || null,
    headers,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user, supabase, headers } = await requireAuth(request);

  const formData = await request.formData();
  const gameId = formData.get("gameId") as string;
  const pickedTeamId = formData.get("pickedTeamId") as string;
  const spread = formData.get("spread") as string;
  const isPotd = formData.get("isPotd") === "true";

  if (!gameId || !pickedTeamId) {
    return { error: "Missing required fields", headers };
  }

  // Check if game has started (locked)
  const { data: game } = await supabase
    .from("games")
    .select("game_date, status")
    .eq("id", gameId)
    .single();

  if (!game) {
    return { error: "Game not found", headers };
  }

  if (game.status !== "scheduled" || new Date(game.game_date) < new Date()) {
    return { error: "Game has already started", headers };
  }

  // Upsert pick (update if exists, insert if not)
  const { error } = await supabase.from("picks").upsert(
    {
      user_id: user.id,
      game_id: gameId,
      picked_team_id: pickedTeamId,
      spread_at_pick_time: parseFloat(spread) || 0,
      result: "pending",
      is_pick_of_day: isPotd,
    },
    {
      onConflict: "user_id,game_id",
    }
  );

  if (error) {
    console.error("Error saving pick:", error);

    // Handle POTD constraint violation with user-friendly message
    if (error.code === "23505" && error.message?.includes("idx_one_potd_per_user_per_day")) {
      return {
        error: "You already have a Pick of the Day for games on this date. Unmark your current POTD first.",
        headers
      };
    }

    return { error: error.message, headers };
  }

  return { success: true, headers };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data?.date) {
    return [
      { title: "Games - College Basketball Picks" },
      {
        name: "description",
        content: "Make your picks for college basketball games",
      },
    ];
  }

  const date = parseISO(data.date);
  const formattedDate = isValid(date) ? format(date, "MMMM d, yyyy") : "Games";

  // Use formatted date for meta tags to avoid timezone issues
  return [
    { title: `${formattedDate} - College Basketball Picks` },
    {
      name: "description",
      content: `Make your picks for ${formattedDate} college basketball games`,
    },
  ];
}

export default function Index() {
  const { games, allGamesCount, conferences, tournaments, bracketCompletion, date, isToday, potdGameId } =
    useLoaderData<typeof loader>();
  const { user } = useOutletContext<{ user: { id: string; email: string } }>();
  const navigate = useNavigate();
  const actionData = useActionData<typeof action>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();

  const currentDate = parseISO(date);
  const previousDay = format(subDays(currentDate, 1), "yyyy-MM-dd");
  const nextDay = format(addDays(currentDate, 1), "yyyy-MM-dd");

  // Tab state
  const activeTab = searchParams.get("view") || "games";
  const setActiveTab = (tab: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (tab === "games") {
      newParams.delete("view");
    } else {
      newParams.set("view", tab);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Get gameId from URL and find the game
  const gameIdFromUrl = searchParams.get("gameId");
  const selectedGame = gameIdFromUrl
    ? games.find((g: GameWithRelations) => g.id === gameIdFromUrl)
    : null;
  const userPickForModal = selectedGame?.picks?.find(p => p.user_id === user.id);

  // Control modal state based on URL
  const [modalOpen, setModalOpen] = useState(false);

  // Sync modal state with URL
  useEffect(() => {
    setModalOpen(!!gameIdFromUrl && !!selectedGame);
  }, [gameIdFromUrl, selectedGame]);

  // Handle modal close - remove gameId from URL
  const handleModalClose = (open: boolean) => {
    if (!open) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("gameId");
      setSearchParams(newParams, { replace: true });
    }
    setModalOpen(open);
  };

  // Show toast notifications for pick results
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        toast.success("Pick saved successfully!");
      } else if (actionData.error) {
        toast.error(actionData.error);
      }
    }
  }, [actionData]);

  // Filter tournaments based on search params
  const filteredTournaments = tournaments.filter((tournament: any) => {
    const statusFilters = searchParams.getAll('tournamentStatus');
    const typeFilters = searchParams.getAll('tournamentType');
    const picksOnly = searchParams.get('tournamentPicks') === 'true';

    // Status filter
    if (statusFilters.length > 0 && !statusFilters.includes(tournament.status)) {
      return false;
    }

    // Type filter
    if (typeFilters.length > 0 && !typeFilters.includes(tournament.type)) {
      return false;
    }

    // Picks only filter - show only tournaments where user has made picks
    if (picksOnly) {
      const completion = bracketCompletion[tournament.id];
      if (!completion || !completion.hasPicks) {
        return false;
      }
    }

    return true;
  });

  return (
      <div className="space-y-6">
        {/* Header with Tabs */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                {activeTab === "tournaments" ? "Tournaments" : (isToday ? "Today's Games" : format(currentDate, "MMMM d, yyyy"))}
              </h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base font-medium text-slate-600 dark:text-slate-400">
                {activeTab === "tournaments" ? "Make your bracket picks" : format(currentDate, "EEEE")}
              </p>
            </div>

            {activeTab === "games" && (
              <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/?date=${previousDay}`)}
                  className="text-xs sm:text-sm"
                >
                  <ChevronLeft className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>

                <DatePicker currentDate={currentDate} />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/?date=${nextDay}`)}
                  className="text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4 sm:ml-1" />
                </Button>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b">
            <button
              onClick={() => setActiveTab("games")}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "games"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Games
            </button>
            {tournaments && tournaments.length > 0 && (
              <button
                onClick={() => setActiveTab("tournaments")}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
                  activeTab === "tournaments"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Trophy className="w-4 h-4" />
                Tournaments
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {tournaments.length}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Games View */}
        {activeTab === "games" && (
          <>
            {/* Filters */}
            <GameFilters conferences={conferences} />

            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                Showing {games.length} of {allGamesCount} games
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game: GameWithRelations) => {
            const userPick = game.picks?.find(p => p.user_id === user.id);
            const otherPicks = game.picks?.filter(p => p.user_id !== user.id) || [];

            // Check if this is a swing game (users picked opposite sides)
            const homeTeamPicks = game.picks?.filter(p => p.picked_team_id === game.home_team.id) || [];
            const awayTeamPicks = game.picks?.filter(p => p.picked_team_id === game.away_team.id) || [];
            const isSwingGame = homeTeamPicks.length > 0 && awayTeamPicks.length > 0;

            return (
              <GameCard
                key={game.id}
                game={game}
                userPick={userPick}
                otherPicks={otherPicks}
                userId={user.id}
                potdGameId={potdGameId}
                isSwingGame={isSwingGame}
                homeTeamPickers={homeTeamPicks}
                awayTeamPickers={awayTeamPicks}
              />
            );
          })}
        </div>
          </>
        )}

        {/* Tournaments View */}
        {activeTab === "tournaments" && (
          <>
            <TournamentFilters />
            {filteredTournaments && filteredTournaments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTournaments.map((tournament: any) => {
                  const completion = bracketCompletion[tournament.id];
                  const hasBracketPicks = completion?.hasPicks || false;
                  const hasChampionPick = completion?.championPicked || false;

                  return (
                    <button
                      key={tournament.id}
                      onClick={() => navigate(`/tournaments/${tournament.id}`)}
                      className="group bg-card rounded-lg border p-5 text-left hover:border-primary hover:bg-accent transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1">
                          <div className="flex items-start gap-2">
                            <h3 className="font-bold text-lg leading-tight flex-1">
                              {tournament.name}
                            </h3>
                            {hasBracketPicks && (
                              <CheckCircle2 className={cn(
                                "w-5 h-5 shrink-0 mt-0.5",
                                hasChampionPick
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-yellow-600 dark:text-yellow-400"
                              )} />
                            )}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                          tournament.status === 'in_progress'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                          {tournament.status === 'in_progress' ? 'Live' : 'Upcoming'}
                        </span>
                      </div>

                      <div className="text-sm text-muted-foreground space-y-1.5 mb-4">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{tournament.type.toUpperCase()}</span>
                          {tournament.location && (
                            <>
                              <span>•</span>
                              <span>{tournament.location}</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs">
                          {format(new Date(tournament.start_date), 'MMM d')} - {format(new Date(tournament.end_date), 'MMM d, yyyy')}
                        </div>
                        {hasBracketPicks && (
                          <div className={cn(
                            "text-xs font-medium",
                            hasChampionPick
                              ? "text-green-600 dark:text-green-400"
                              : "text-yellow-600 dark:text-yellow-400"
                          )}>
                            {hasChampionPick ? "Bracket Complete" : "Bracket In Progress"}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <span>{hasBracketPicks ? "Edit Bracket" : "View Bracket"}</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No tournaments found matching your filters.
              </div>
            )}
          </>
        )}

        {/* URL-controlled Game Modal */}
        {selectedGame && (
          <Dialog open={modalOpen} onOpenChange={handleModalClose}>
            <DialogContent className="!w-[95vw] sm:!max-w-[95vw] lg:!max-w-[1600px] !max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {selectedGame.away_team.name} @ {selectedGame.home_team.name}
                </DialogTitle>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-600">
                  <span>{format(new Date(selectedGame.game_date), 'EEEE, MMMM d')} at {format(new Date(selectedGame.game_date), 'h:mm a')}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="flex items-center gap-1">
                    {selectedGame.conference.name}
                    {selectedGame.conference.is_power_conference && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        Power
                      </span>
                    )}
                  </span>
                </div>
              </DialogHeader>

              {/* Game Header - Spread and Status */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 py-3 sm:py-4 border-y">
                {/* Away Team */}
                <div className="text-center">
                  <div className="font-semibold text-lg">{selectedGame.away_team.short_name}</div>
                  {selectedGame.spread && (
                    <div className={`text-sm ${selectedGame.favorite_team_id === selectedGame.away_team.id ? 'font-semibold text-blue-600' : 'text-gray-600'}`}>
                      {selectedGame.favorite_team_id === selectedGame.away_team.id ? `-${selectedGame.spread}` : `+${selectedGame.spread}`}
                    </div>
                  )}
                  {selectedGame.away_team_injury_count != null && selectedGame.away_team_injury_count > 0 && (
                    <div className="text-xs text-orange-600 mt-1">
                      {selectedGame.away_team_injury_count} {selectedGame.away_team_injury_count === 1 ? 'injury' : 'injuries'}
                    </div>
                  )}
                </div>

                {/* VS/Score */}
                <div className="text-center">
                  {selectedGame.status === 'completed' && selectedGame.home_score !== null && selectedGame.away_score !== null ? (
                    <div className="text-2xl font-bold">
                      {selectedGame.away_score} - {selectedGame.home_score}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-lg">VS</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1 capitalize">{selectedGame.status}</div>
                </div>

                {/* Home Team */}
                <div className="text-center">
                  <div className="font-semibold text-lg">{selectedGame.home_team.short_name}</div>
                  {selectedGame.spread && (
                    <div className={`text-sm ${selectedGame.favorite_team_id === selectedGame.home_team.id ? 'font-semibold text-blue-600' : 'text-gray-600'}`}>
                      {selectedGame.favorite_team_id === selectedGame.home_team.id ? `-${selectedGame.spread}` : `+${selectedGame.spread}`}
                    </div>
                  )}
                  {selectedGame.home_team_injury_count != null && selectedGame.home_team_injury_count > 0 && (
                    <div className="text-xs text-orange-600 mt-1">
                      {selectedGame.home_team_injury_count} {selectedGame.home_team_injury_count === 1 ? 'injury' : 'injuries'}
                    </div>
                  )}
                </div>
              </div>

              {/* AI Matchup Analysis Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span>AI Matchup Analysis</span>
                </div>

                <MatchupAnalysis
                  gameId={selectedGame.id}
                  analysis={(selectedGame.matchup_analyses && selectedGame.matchup_analyses.length > 0 ? selectedGame.matchup_analyses[0] : null) || null}
                  homeTeamName={selectedGame.home_team.short_name}
                  awayTeamName={selectedGame.away_team.short_name}
                />
              </div>

              {/* Analytics Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <TrendingUp className="h-4 w-4" />
                  <span>Team Analytics & Comparison</span>
                </div>

                <GameAnalytics
                  game={selectedGame}
                  showComparison={true}
                />
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => handleModalClose(false)}>
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
  );
}
