import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamMatchupData = {
  id: string;
  name: string;
  short_name: string;
  conference: {
    name: string;
    is_power_conference: boolean;
  };
  stats: {
    source?: string;
    season?: number;
    games_played?: number;
    wins?: number;
    losses?: number;
    offensive_efficiency?: number;
    defensive_efficiency?: number;
    tempo?: number;
    offensive_efficiency_rank?: number;
    defensive_efficiency_rank?: number;
    overall_rank?: number;
    strength_of_schedule?: number;
    strength_of_schedule_rank?: number;
    points_per_game?: number;
    points_allowed_per_game?: number;
    field_goal_pct?: number;
    three_point_pct?: number;
    free_throw_pct?: number;
    rebounds_per_game?: number;
    assists_per_game?: number;
    turnovers_per_game?: number;
    raw_stats?: any;
  } | null;
  recentGames: Array<{
    id: string;
    game_date: string;
    opponent_name: string;
    opponent_short_name: string;
    was_home: boolean;
    team_score: number | null;
    opponent_score: number | null;
    result: "won" | "lost" | null;
    point_differential: number | null;
  }>;
  injuries: Array<{
    player_name: string;
    status: string;
    description: string | null;
    reported_date: string;
  }>;
  recentNews: Array<{
    title: string;
    published_at: string;
    source: string;
  }>;
};

export type MatchupData = {
  game: {
    id: string;
    game_date: string;
    spread: number | null;
    favorite_team_id: string | null;
    status: string;
  };
  homeTeam: TeamMatchupData;
  awayTeam: TeamMatchupData;
};

/**
 * Gathers all relevant data for analyzing a game matchup
 */
export async function getMatchupData(
  supabase: SupabaseClient,
  gameId: string
): Promise<MatchupData | null> {
  // 1. Get game details with teams
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select(
      `
      id,
      game_date,
      spread,
      favorite_team_id,
      status,
      home_team_id,
      away_team_id,
      home_team:teams!games_home_team_id_fkey(
        id,
        name,
        short_name,
        conference:conferences(name, is_power_conference)
      ),
      away_team:teams!games_away_team_id_fkey(
        id,
        name,
        short_name,
        conference:conferences(name, is_power_conference)
      )
    `
    )
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    console.error("Error fetching game:", gameError);
    return null;
  }

  // 2. Get stats for both teams
  const homeTeamStats = await getTeamStats(supabase, game.home_team_id);
  const awayTeamStats = await getTeamStats(supabase, game.away_team_id);

  // 3. Get recent games for both teams
  const homeRecentGames = await getRecentGames(supabase, game.home_team_id, 10);
  const awayRecentGames = await getRecentGames(supabase, game.away_team_id, 10);

  // 4. Get injuries for both teams
  const homeInjuries = await getTeamInjuries(supabase, game.home_team_id);
  const awayInjuries = await getTeamInjuries(supabase, game.away_team_id);

  // 5. Get recent news for both teams
  const homeNews = await getTeamNews(supabase, game.home_team_id, 5);
  const awayNews = await getTeamNews(supabase, game.away_team_id, 5);

  // Type assertion for Supabase joins that return arrays
  const homeTeam = Array.isArray(game.home_team) ? game.home_team[0] : game.home_team;
  const awayTeam = Array.isArray(game.away_team) ? game.away_team[0] : game.away_team;
  const homeConference = Array.isArray(homeTeam.conference) ? homeTeam.conference[0] : homeTeam.conference;
  const awayConference = Array.isArray(awayTeam.conference) ? awayTeam.conference[0] : awayTeam.conference;

  return {
    game: {
      id: game.id,
      game_date: game.game_date,
      spread: game.spread,
      favorite_team_id: game.favorite_team_id,
      status: game.status,
    },
    homeTeam: {
      id: homeTeam.id,
      name: homeTeam.name,
      short_name: homeTeam.short_name,
      conference: homeConference,
      stats: homeTeamStats,
      recentGames: homeRecentGames,
      injuries: homeInjuries,
      recentNews: homeNews,
    },
    awayTeam: {
      id: awayTeam.id,
      name: awayTeam.name,
      short_name: awayTeam.short_name,
      conference: awayConference,
      stats: awayTeamStats,
      recentGames: awayRecentGames,
      injuries: awayInjuries,
      recentNews: awayNews,
    },
  };
}

/**
 * Get latest stats for a team
 */
async function getTeamStats(supabase: SupabaseClient, teamId: string) {
  const { data, error } = await supabase
    .from("team_stats")
    .select("*")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching team stats:", error);
    return null;
  }

  return data;
}

/**
 * Get recent completed games for a team
 */
async function getRecentGames(
  supabase: SupabaseClient,
  teamId: string,
  limit: number = 10
) {
  // Get games where this team was either home or away
  const { data: games, error } = await supabase
    .from("games")
    .select(
      `
      id,
      game_date,
      home_team_id,
      away_team_id,
      home_score,
      away_score,
      home_team:teams!games_home_team_id_fkey(name, short_name),
      away_team:teams!games_away_team_id_fkey(name, short_name)
    `
    )
    .eq("status", "completed")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .not("home_score", "is", null)
    .not("away_score", "is", null)
    .order("game_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching recent games:", error);
    return [];
  }

  // Transform to indicate whether team was home/away and the result
  return games.map((game) => {
    const wasHome = game.home_team_id === teamId;
    const teamScore = wasHome ? game.home_score : game.away_score;
    const opponentScore = wasHome ? game.away_score : game.home_score;
    const opponentData = wasHome ? game.away_team : game.home_team;
    // Handle Supabase returning arrays
    const opponent = Array.isArray(opponentData) ? opponentData[0] : opponentData;

    return {
      id: game.id,
      game_date: game.game_date,
      opponent_name: opponent.name,
      opponent_short_name: opponent.short_name,
      was_home: wasHome,
      team_score: teamScore,
      opponent_score: opponentScore,
      result:
        teamScore !== null && opponentScore !== null
          ? teamScore > opponentScore
            ? ("won" as const)
            : ("lost" as const)
          : null,
      point_differential:
        teamScore !== null && opponentScore !== null
          ? teamScore - opponentScore
          : null,
    };
  });
}

/**
 * Get active injuries for a team
 */
async function getTeamInjuries(supabase: SupabaseClient, teamId: string) {
  const { data, error } = await supabase
    .from("injury_reports")
    .select("player_name, status, description, reported_date")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .order("reported_date", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching injuries:", error);
    return [];
  }

  return data || [];
}

/**
 * Get recent news articles mentioning a team
 */
async function getTeamNews(
  supabase: SupabaseClient,
  teamId: string,
  limit: number = 5
) {
  const { data, error } = await supabase
    .from("news_article_teams")
    .select(
      `
      news_article:news_articles(
        title,
        published_at,
        source
      )
    `
    )
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching team news:", error);
    return [];
  }

  return (
    data
      ?.map((item) => {
        // Handle both array and object returns from Supabase
        const article = Array.isArray(item.news_article) ? item.news_article[0] : item.news_article;
        return article;
      })
      .filter((article) => article !== null && article !== undefined) || []
  );
}

/**
 * Save analysis results to database
 */
export async function saveMatchupAnalysis(
  supabase: SupabaseClient,
  gameId: string,
  analysisText: string,
  prediction: {
    winner_team_id: string;
    confidence: number;
    predicted_spread?: number;
  },
  keyInsights: string[],
  teamStatsSnapshot: any
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("matchup_analyses")
    .upsert(
      {
        game_id: gameId,
        analysis_text: analysisText,
        prediction,
        key_insights: keyInsights,
        team_stats_snapshot: teamStatsSnapshot,
        analyzed_at: new Date().toISOString(),
      },
      {
        onConflict: "game_id",
      }
    );

  if (error) {
    console.error("Error saving matchup analysis:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
