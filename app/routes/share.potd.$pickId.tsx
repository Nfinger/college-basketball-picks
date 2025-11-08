import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { createServerClient } from "@supabase/ssr";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { format } from "date-fns";
import { Star, Calendar, User } from "lucide-react";

interface Team {
  id: string;
  name: string;
  short_name: string;
}

interface Game {
  id: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  spread: number | null;
  favorite_team_id: string | null;
  status: string;
  home_team: Team;
  away_team: Team;
}

interface Pick {
  id: string;
  picked_team_id: string;
  spread_at_pick_time: number;
  is_pick_of_day: boolean;
  created_at: string;
  games: Game;
  profiles: {
    username: string;
  } | null;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { pickId } = params;

  // Get the full URL for meta tags
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  // Create Supabase client with service role to bypass RLS
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });

  // Fetch pick with full data
  const { data: pick, error } = await supabase
    .from("picks")
    .select(`
      id,
      picked_team_id,
      spread_at_pick_time,
      is_pick_of_day,
      created_at,
      games (
        id,
        game_date,
        home_team_id,
        away_team_id,
        spread,
        favorite_team_id,
        status,
        home_team:teams!games_home_team_id_fkey(id, name, short_name),
        away_team:teams!games_away_team_id_fkey(id, name, short_name)
      ),
      profiles (
        username
      )
    `)
    .eq("id", pickId)
    .eq("is_pick_of_day", true)
    .single();

  if (error || !pick) {
    throw new Response("Pick not found", { status: 404 });
  }

  // Extract data from the joined query result (Supabase returns arrays for joins)
  const game = Array.isArray(pick.games) ? pick.games[0] : pick.games;
  const homeTeam = Array.isArray(game.home_team) ? game.home_team[0] : game.home_team;
  const awayTeam = Array.isArray(game.away_team) ? game.away_team[0] : game.away_team;
  const profile = Array.isArray(pick.profiles) ? pick.profiles[0] : pick.profiles;

  // Reconstruct the pick with proper types
  const processedPick: Pick = {
    id: pick.id,
    picked_team_id: pick.picked_team_id,
    spread_at_pick_time: pick.spread_at_pick_time,
    is_pick_of_day: pick.is_pick_of_day,
    created_at: pick.created_at,
    games: {
      id: game.id,
      game_date: game.game_date,
      home_team_id: game.home_team_id,
      away_team_id: game.away_team_id,
      spread: game.spread,
      favorite_team_id: game.favorite_team_id,
      status: game.status,
      home_team: homeTeam,
      away_team: awayTeam,
    },
    profiles: profile,
  };

  return { pick: processedPick, baseUrl };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.pick) {
    return [
      { title: "Pick Not Found" },
      { name: "description", content: "This pick could not be found." },
    ];
  }

  const { pick, baseUrl } = data;
  const game = pick.games;
  const homeTeam = game.home_team;
  const awayTeam = game.away_team;

  // Determine which team was picked
  const pickedTeam = pick.picked_team_id === homeTeam.id ? homeTeam : awayTeam;
  const otherTeam = pick.picked_team_id === homeTeam.id ? awayTeam : homeTeam;

  // Format spread
  const pickedTeamIsFavorite = game.favorite_team_id === pick.picked_team_id;
  const spreadDisplay = pickedTeamIsFavorite
    ? `-${Math.abs(pick.spread_at_pick_time)}`
    : `+${Math.abs(pick.spread_at_pick_time)}`;

  const username = pick.profiles?.username || "Anonymous";
  const title = `${username}'s POTD: ${pickedTeam.short_name} ${spreadDisplay}`;
  const description = `Check out my Pick of the Day for ${awayTeam.short_name} @ ${homeTeam.short_name}`;

  return [
    { title },
    { name: "description", content: description },

    // Open Graph tags
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: `${baseUrl}/api/og/potd/${pick.id}` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: title },

    // Twitter Card tags
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: `${baseUrl}/api/og/potd/${pick.id}` },
    { name: "twitter:image:alt", content: title },
  ];
}

export default function SharePotd() {
  const { pick } = useLoaderData<typeof loader>();
  const game = pick.games;
  const homeTeam = game.home_team;
  const awayTeam = game.away_team;

  // Determine which team was picked
  const pickedTeam = pick.picked_team_id === homeTeam.id ? homeTeam : awayTeam;
  const otherTeam = pick.picked_team_id === homeTeam.id ? awayTeam : homeTeam;

  // Format spread
  const pickedTeamIsFavorite = game.favorite_team_id === pick.picked_team_id;
  const spreadDisplay = pickedTeamIsFavorite
    ? `-${Math.abs(pick.spread_at_pick_time)}`
    : `+${Math.abs(pick.spread_at_pick_time)}`;

  const username = pick.profiles?.username || "Anonymous";
  const gameDate = new Date(game.game_date);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <Card className="overflow-hidden border-2 border-slate-200 dark:border-slate-800">
          {/* Header with POTD Badge */}
          <div className="bg-gradient-to-r from-yellow-400 to-amber-500 p-6">
            <div className="flex items-center justify-center gap-3">
              <Star className="w-8 h-8 fill-white text-white" />
              <h1 className="text-3xl font-bold text-white">PICK OF THE DAY</h1>
              <Star className="w-8 h-8 fill-white text-white" />
            </div>
          </div>

          <CardContent className="p-8">
            {/* Matchup */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {awayTeam.short_name}
                </div>
                <div className="text-xl font-semibold text-slate-500 dark:text-slate-400">
                  @
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {homeTeam.short_name}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-2">
                <Calendar className="w-4 h-4" />
                <span suppressHydrationWarning>
                  {format(gameDate, "EEEE, MMMM d, yyyy 'at' h:mm a")}
                </span>
              </div>

              {game.status !== "scheduled" && (
                <Badge variant="secondary" className="mb-4">
                  {game.status === "in_progress" && "LIVE"}
                  {game.status === "completed" && "FINAL"}
                  {game.status === "postponed" && "POSTPONED"}
                  {game.status === "cancelled" && "CANCELLED"}
                </Badge>
              )}
            </div>

            {/* The Pick */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 p-8 rounded-lg border-2 border-blue-500 mb-8">
              <div className="text-center">
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-3">
                  My pick is
                </p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                    {pickedTeam.short_name}
                  </span>
                  <span className="text-4xl font-bold text-yellow-500">
                    {spreadDisplay}
                  </span>
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 mb-6">
              <User className="w-4 h-4" />
              <span className="font-semibold">@{username}</span>
            </div>

            {/* Call to Action */}
            <div className="text-center pt-6 border-t border-slate-200 dark:border-slate-800">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Make your own picks and track your performance
              </p>
              <a
                href="/"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Get Started
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-slate-500 dark:text-slate-400">
          <p>College Basketball Picks & Analytics</p>
        </div>
      </div>
    </div>
  );
}
