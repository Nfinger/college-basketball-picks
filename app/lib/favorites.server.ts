import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetches the list of team IDs that a user has favorited
 * @param supabase - Supabase client instance
 * @param userId - The user's UUID
 * @returns Array of team UUIDs
 */
export async function getFavoriteTeamIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_favorite_teams")
    .select("team_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching favorite teams:", error);
    return [];
  }

  return data?.map((f) => f.team_id) || [];
}

/**
 * Builds a Supabase filter string for querying by favorite teams
 * Handles both single-team queries and multi-team queries (like games with home/away)
 * @param teamIds - Array of team UUIDs to filter by
 * @param fieldName - The field to filter on ('team_id' for single, 'games' for home/away)
 * @returns Filter string for Supabase .or() query, or null if no teams
 */
export function applyFavoriteTeamsFilter(
  teamIds: string[],
  fieldName: string = "team_id"
): string | null {
  if (teamIds.length === 0) return null;

  // For games: need to check both home_team_id and away_team_id
  if (fieldName === "games") {
    return `home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`;
  }

  // For other tables (injuries, picks): just check team_id
  return `${fieldName}.in.(${teamIds.join(",")})`;
}
