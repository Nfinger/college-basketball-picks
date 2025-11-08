import { ImageResponse } from "@vercel/og";
import { createServerClient } from "@supabase/ssr";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { pickId } = params;

  // Create Supabase client with service role to bypass RLS for shared picks
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });

  // Fetch pick with full game and team data
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
    // Return a 404 error image
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1e293b",
            color: "white",
            fontSize: 48,
            fontWeight: "bold",
          }}
        >
          Pick Not Found
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60",
        },
      }
    );
  }

  // Extract data from the joined query result
  const game = Array.isArray(pick.games) ? pick.games[0] : pick.games;
  const homeTeam = Array.isArray(game.home_team) ? game.home_team[0] : game.home_team;
  const awayTeam = Array.isArray(game.away_team) ? game.away_team[0] : game.away_team;
  const profile = Array.isArray(pick.profiles) ? pick.profiles[0] : pick.profiles;

  // Determine which team was picked
  const pickedTeam = pick.picked_team_id === homeTeam.id ? homeTeam : awayTeam;
  const otherTeam = pick.picked_team_id === homeTeam.id ? awayTeam : homeTeam;

  // Determine if picked team is favorite and format spread
  const pickedTeamIsFavorite = game.favorite_team_id === pick.picked_team_id;
  const spreadDisplay = pickedTeamIsFavorite
    ? `-${Math.abs(pick.spread_at_pick_time)}`
    : `+${Math.abs(pick.spread_at_pick_time)}`;

  // Get username or default
  const username = profile?.username || "Anonymous";

  // Format date
  const gameDate = new Date(game.game_date);
  const dateString = gameDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: "600",
              color: "#fbbf24",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ marginRight: "12px" }}>⭐</span>
            PICK OF THE DAY
          </div>
        </div>

        {/* Main Content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Matchup */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "30px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 48,
                  fontWeight: "bold",
                  color: "#e2e8f0",
                  marginBottom: "8px",
                }}
              >
                {awayTeam.short_name}
              </div>
            </div>

            <div
              style={{
                fontSize: 36,
                fontWeight: "bold",
                color: "#64748b",
                margin: "0 40px",
              }}
            >
              @
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 48,
                  fontWeight: "bold",
                  color: "#e2e8f0",
                  marginBottom: "8px",
                }}
              >
                {homeTeam.short_name}
              </div>
            </div>
          </div>

          {/* Pick Display */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "40px",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              borderRadius: "16px",
              border: "3px solid #3b82f6",
            }}
          >
            <div
              style={{
                fontSize: 28,
                color: "#94a3b8",
                marginBottom: "16px",
              }}
            >
              My pick is
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: "bold",
                color: "#3b82f6",
                display: "flex",
                alignItems: "center",
              }}
            >
              {pickedTeam.short_name}
              <span style={{ marginLeft: "20px", color: "#fbbf24" }}>
                {spreadDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "40px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontSize: 20,
                color: "#64748b",
                marginBottom: "4px",
              }}
            >
              {dateString}
            </div>
            <div
              style={{
                fontSize: 24,
                color: "#94a3b8",
                fontWeight: "600",
              }}
            >
              @{username}
            </div>
          </div>
          <div
            style={{
              fontSize: 20,
              color: "#64748b",
              fontWeight: "600",
            }}
          >
            College Basketball Picks
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Cache for 7 days (picks don't change after creation)
        "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
      },
    }
  );
}
