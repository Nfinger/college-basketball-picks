import { useLoaderData } from "react-router";
import type { Route } from "./+types/mypicks";
import { requireAuth } from "~/lib/auth.server";
import { getFavoriteTeamIds } from "~/lib/favorites.server";
import { GameCard } from "~/components/GameCard";
import { MyPicksFilters } from "~/components/MyPicksFilters";

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
  result: "won" | "lost" | "push" | "pending";
  locked_at: string | null;
  is_pick_of_day: boolean;
  user_id: string;
}

interface Game {
  id: string;
  game_date: string;
  home_team: Team;
  away_team: Team;
  home_score: number | null;
  away_score: number | null;
  spread: number | null;
  favorite_team_id: string | null;
  status: "scheduled" | "in_progress" | "completed" | "postponed" | "cancelled";
  conference: Conference;
}

interface PickWithGame extends Pick {
  games: Game;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase, headers } = await requireAuth(request);

  // Get URL search params for filtering and sorting
  const url = new URL(request.url);
  const filterParam = (url.searchParams.get("filter") || "all") as "all" | "upcoming" | "past";
  const sortParam = url.searchParams.get("sort") || "date-desc";
  const isPotdOnly = url.searchParams.get("potdOnly") === "true";
  const myTeamsOnly = url.searchParams.get("myTeamsOnly") === "true";

  // Get user's favorite teams for filtering
  const favoriteTeamIds = await getFavoriteTeamIds(supabase, user.id);

  // Build picks query with server-side filters
  let picksQuery = supabase
    .from("picks")
    .select(`
      *,
      games (
        *,
        home_team:teams!games_home_team_id_fkey(*),
        away_team:teams!games_away_team_id_fkey(*),
        conference:conferences(*)
      )
    `)
    .eq("user_id", user.id);

  // Apply POTD filter at database level
  if (isPotdOnly) {
    picksQuery = picksQuery.eq("is_pick_of_day", true);
  }

  // Apply My Teams filter at database level
  if (myTeamsOnly && favoriteTeamIds.length > 0) {
    // First get game IDs that involve favorite teams
    const { data: gamesData } = await supabase
      .from("games")
      .select("id")
      .or(`home_team_id.in.(${favoriteTeamIds.join(",")}),away_team_id.in.(${favoriteTeamIds.join(",")})`);

    const gameIds = gamesData?.map((g) => g.id) || [];

    if (gameIds.length > 0) {
      picksQuery = picksQuery.in("game_id", gameIds);
    } else {
      // No games match favorites, return empty result
      picksQuery = picksQuery.eq("game_id", "00000000-0000-0000-0000-000000000000"); // UUID that won't match
    }
  }

  const { data: picksData, error } = await picksQuery.order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching picks:", error);
    return { picks: [], filterParam, sortParam, isPotdOnly, user, potdGameId: null, headers };
  }

  const picks = (picksData || []) as PickWithGame[];

  // Apply time-based filter
  let filteredPicks = picks;
  if (filterParam === "upcoming") {
    filteredPicks = picks.filter(
      (pick) =>
        !["completed", "postponed", "cancelled"].includes(pick.games.status)
    );
  } else if (filterParam === "past") {
    filteredPicks = picks.filter((pick) =>
      ["completed", "postponed", "cancelled"].includes(pick.games.status)
    );
  }

  // All filters now applied server-side in the query above
  // (POTD, My Teams, and user_id)

  // Apply sorting
  const sortedPicks = sortPicks(filteredPicks, sortParam);

  // Find the current POTD game ID
  const potdPick = picks.find((p) => p.is_pick_of_day);
  const potdGameId = potdPick ? potdPick.games.id : null;

  return {
    picks: sortedPicks,
    filterParam,
    sortParam,
    isPotdOnly,
    user,
    potdGameId,
    headers,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user, supabase, headers } = await requireAuth(request);

  const formData = await request.formData();
  const gameId = formData.get("gameId") as string;
  const pickedTeamId = formData.get("pickedTeamId") as string;
  const spread = formData.get("spread") as string;
  const isPotdString = formData.get("isPotd") as string;
  const isPotd = isPotdString === "true";

  // Get the game to check if it's locked
  const { data: game } = await supabase
    .from("games")
    .select("game_date, status")
    .eq("id", gameId)
    .single();

  if (!game) {
    return { error: "Game not found", headers };
  }

  const gameDate = new Date(game.game_date);
  const isLocked = game.status !== "scheduled" || gameDate < new Date();

  if (isLocked) {
    return { error: "Cannot modify pick for a locked game", headers };
  }

  // Check if pick already exists
  const { data: existingPick } = await supabase
    .from("picks")
    .select("*")
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .single();

  if (existingPick) {
    // Update existing pick
    const { error: updateError } = await supabase
      .from("picks")
      .update({
        picked_team_id: pickedTeamId,
        spread_at_pick_time: parseFloat(spread) || null,
        is_pick_of_day: isPotd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingPick.id);

    if (updateError) {
      console.error("Error updating pick:", updateError);
      return { error: "Failed to update pick", headers };
    }
  } else {
    // Create new pick
    const { error: insertError } = await supabase
      .from("picks")
      .insert({
        user_id: user.id,
        game_id: gameId,
        picked_team_id: pickedTeamId,
        spread_at_pick_time: parseFloat(spread) || null,
        is_pick_of_day: isPotd,
      });

    if (insertError) {
      console.error("Error creating pick:", insertError);
      return { error: "Failed to create pick", headers };
    }
  }

  return { success: true, headers };
}

function sortPicks(picks: PickWithGame[], sortParam: string): PickWithGame[] {
  switch (sortParam) {
    case "date-asc":
      return [...picks].sort(
        (a, b) =>
          new Date(a.games.game_date).getTime() -
          new Date(b.games.game_date).getTime()
      );
    case "date-desc":
      return [...picks].sort(
        (a, b) =>
          new Date(b.games.game_date).getTime() -
          new Date(a.games.game_date).getTime()
      );
    case "result":
      const resultOrder = { won: 0, lost: 1, push: 2, pending: 3 };
      return [...picks].sort(
        (a, b) => resultOrder[a.result] - resultOrder[b.result]
      );
    case "spread":
      return [...picks].sort(
        (a, b) =>
          Math.abs(b.spread_at_pick_time || 0) -
          Math.abs(a.spread_at_pick_time || 0)
      );
    default:
      return picks;
  }
}

export default function MyPicks() {
  const { picks, filterParam, sortParam, isPotdOnly, user, potdGameId } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            My Picks
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            View and manage all your game picks
          </p>
        </div>

        <MyPicksFilters
          currentFilter={filterParam}
          currentSort={sortParam}
          isPotdOnly={isPotdOnly}
        />

        {picks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-slate-400 dark:text-slate-600 mb-4">
              <svg
                className="w-24 h-24 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {filterParam === "all"
                ? "No picks yet"
                : `No ${filterParam} picks`}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              {filterParam === "all"
                ? "Start making picks to see them here"
                : "Try a different filter or make some picks"}
            </p>
            {filterParam === "all" && (
              <a
                href="/"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Browse Games
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {picks.map((pick) => (
              <GameCard
                key={pick.id}
                game={pick.games}
                userPick={pick}
                otherPicks={[]}
                userId={user.id}
                potdGameId={potdGameId}
                isSwingGame={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
