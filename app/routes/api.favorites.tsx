import { data } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import type { Route } from "./+types/api.favorites";

/**
 * API route for managing user's favorite teams
 * POST with intent=add to add a favorite
 * POST with intent=remove to remove a favorite
 */
export async function action({ request }: Route.ActionArgs) {
  const { user, supabase } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const teamId = formData.get("teamId");

  if (!teamId || typeof teamId !== "string") {
    return data({ error: "Team ID is required" }, { status: 400 });
  }

  if (intent === "add") {
    const { error } = await supabase
      .from("user_favorite_teams")
      .insert({ user_id: user.id, team_id: teamId });

    if (error) {
      // Handle duplicate error gracefully (unique constraint violation)
      if (error.code === "23505") {
        return data({ success: true, message: "Already favorited" });
      }
      console.error("Error adding favorite team:", error);
      return data({ error: error.message }, { status: 500 });
    }

    return data({ success: true, action: "added" });
  }

  if (intent === "remove") {
    const { error } = await supabase
      .from("user_favorite_teams")
      .delete()
      .match({ user_id: user.id, team_id: teamId });

    if (error) {
      console.error("Error removing favorite team:", error);
      return data({ error: error.message }, { status: 500 });
    }

    return data({ success: true, action: "removed" });
  }

  return data({ error: "Invalid intent. Use 'add' or 'remove'" }, { status: 400 });
}
