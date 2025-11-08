import { useEffect } from "react";
import {
  useLoaderData,
  useNavigate,
  useActionData,
  useOutletContext,
} from "react-router";
import type { Route } from "./+types/_index";
import { requireAuth } from "~/lib/auth.server";
import { getFavoriteTeamIds } from "~/lib/favorites.server";
import { GameCard } from "~/components/GameCard";
import { DatePicker } from "~/components/DatePicker";
import { GameFilters } from "~/components/GameFilters";
import { Button } from "~/components/ui/button";
import { format, addDays, subDays, parseISO, isValid } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type GameWithRelations = {
  id: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
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

  // Fetch games, conferences, profiles, and POTD status in parallel
  const [gamesResult, conferencesResult, profilesResult, potdResult] = await Promise.all([
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

  return {
    games: sortedGames,
    allGamesCount: allGamesWithInjuries.length,
    conferences: conferencesResult.data || [],
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
  const { games, allGamesCount, conferences, date, isToday, potdGameId } =
    useLoaderData<typeof loader>();
  const { user } = useOutletContext<{ user: { id: string; email: string } }>();
  const navigate = useNavigate();
  const actionData = useActionData<typeof action>();

  const currentDate = parseISO(date);
  const previousDay = format(subDays(currentDate, 1), "yyyy-MM-dd");
  const nextDay = format(addDays(currentDate, 1), "yyyy-MM-dd");

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

  return (
      <div className="space-y-6">
        {/* Date Navigation */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                {isToday
                  ? "Today's Games"
                  : format(currentDate, "MMMM d, yyyy")}
              </h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base font-medium text-slate-600 dark:text-slate-400">
                {format(currentDate, "EEEE")}
              </p>
            </div>

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
          </div>
        </div>

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
      </div>
  );
}
