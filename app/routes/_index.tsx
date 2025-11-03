import { useEffect } from "react";
import {
  useLoaderData,
  useNavigate,
  useActionData,
} from "react-router";
import type { Route } from "./+types/_index";
import { requireAuth } from "~/lib/auth.server";
import { AppLayout } from "~/components/AppLayout";
import { GameCard } from "~/components/GameCard";
import { DatePicker } from "~/components/DatePicker";
import { GameFilters } from "~/components/GameFilters";
import { Button } from "~/components/ui/button";
import { format, addDays, subDays, parseISO, isValid } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type GameWithRelations = {
  id: string;
  game_date: string;
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
  }[];
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase, headers } = await requireAuth(request);

  // Parse and validate date from query parameter
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  let targetDate: Date;

  if (dateParam) {
    const parsed = parseISO(dateParam);
    targetDate = isValid(parsed) ? parsed : new Date();
  } else {
    targetDate = new Date();
  }

  const dateStr = format(targetDate, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isToday = dateStr === todayStr;

  // Parse filter parameters from URL
  const search = url.searchParams.get("search") || "";
  const conferenceIds = url.searchParams.getAll("conf");
  const powerOnly = url.searchParams.get("power") === "true";
  const midMajorOnly = url.searchParams.get("midmajor") === "true";
  const picksOnly = url.searchParams.get("picks") === "true";

  // Fetch games and conferences in parallel
  const [gamesResult, conferencesResult] = await Promise.all([
    supabase
      .from("games")
      .select(
        `
        *,
        home_team:teams!games_home_team_id_fkey(id, name, short_name),
        away_team:teams!games_away_team_id_fkey(id, name, short_name),
        conference:conferences(id, name, short_name, is_power_conference),
        picks(id, picked_team_id, spread_at_pick_time, result, locked_at)
      `
      )
      .gte("game_date", `${dateStr}T00:00:00`)
      .lt("game_date", `${dateStr}T23:59:59`)
      .eq("picks.user_id", user.id)
      .order("game_date", { ascending: true }),
    supabase
      .from("conferences")
      .select("id, name, short_name, is_power_conference")
      .order("name", { ascending: true }),
  ]);

  // Log errors but don't fail - return empty arrays instead
  if (gamesResult.error) {
    console.error("Error fetching games:", gamesResult.error);
  }
  if (conferencesResult.error) {
    console.error("Error fetching conferences:", conferencesResult.error);
  }

  const allGames = gamesResult.data || [];

  // Apply filters server-side
  const filteredGames = allGames.filter((game: GameWithRelations) => {
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
    if (picksOnly && (!game.picks || game.picks.length === 0)) {
      return false;
    }

    return true;
  });

  return {
    user,
    games: filteredGames,
    allGamesCount: allGames.length,
    conferences: conferencesResult.data || [],
    date: dateStr,
    isToday,
    headers,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user, supabase, headers } = await requireAuth(request);

  const formData = await request.formData();
  const gameId = formData.get("gameId") as string;
  const pickedTeamId = formData.get("pickedTeamId") as string;
  const spread = formData.get("spread") as string;

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
    },
    {
      onConflict: "user_id,game_id",
    }
  );

  if (error) {
    console.error("Error saving pick:", error);
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
  const { user, games, allGamesCount, conferences, date, isToday } =
    useLoaderData<typeof loader>();
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
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Date Navigation */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                {isToday
                  ? "Today's Games"
                  : format(currentDate, "MMMM d, yyyy")}
              </h1>
              <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-400">
                {format(currentDate, "EEEE")}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/?date=${previousDay}`)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <DatePicker currentDate={currentDate} />

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/?date=${nextDay}`)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
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
          {games.map((game: GameWithRelations) => (
            <GameCard
              key={game.id}
              game={game}
              userPick={game.picks?.[0]}
              userId={user.id}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
