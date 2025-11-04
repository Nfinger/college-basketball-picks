import { type ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireAuth } from "~/lib/auth.server";

/**
 * API route for managing user's favorite teams
 * POST with intent=add to add a favorite
 * POST with intent=remove to remove a favorite
 */
export async function action({ request }: ActionFunctionArgs) {
  const { user, supabase, headers } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const teamId = formData.get("teamId");

  if (!teamId || typeof teamId !== "string") {
    return json({ error: "Team ID is required" }, { status: 400 });
  }

  if (intent === "add") {
    const { error } = await supabase
      .from("user_favorite_teams")
      .insert({ user_id: user.id, team_id: teamId });

    if (error) {
      // Handle duplicate error gracefully (unique constraint violation)
      if (error.code === "23505") {
        return json({ success: true, message: "Already favorited" });
      }
      console.error("Error adding favorite team:", error);
      return json({ error: error.message }, { status: 500 });
    }

    return json({ success: true, action: "added" });
  }

  if (intent === "remove") {
    const { error } = await supabase
      .from("user_favorite_teams")
      .delete()
      .match({ user_id: user.id, team_id: teamId });

    if (error) {
      console.error("Error removing favorite team:", error);
      return json({ error: error.message }, { status: 500 });
    }

    return json({ success: true, action: "removed" });
  }

  return json({ error: "Invalid intent. Use 'add' or 'remove'" }, { status: 400 });
}
