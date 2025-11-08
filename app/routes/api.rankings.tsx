import { data } from "react-router";
import { requireAuth } from "~/lib/auth.server";

/**
 * API route for managing user's team rankings
 * POST with intent=create to create a new ranking
 * POST with intent=update to update ranking metadata
 * POST with intent=save-entries to save the ranked teams
 * POST with intent=publish to publish a ranking
 * POST with intent=delete to delete a ranking
 */
export async function action({ request }: { request: Request }) {
  const { user, supabase } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Create a new ranking
  if (intent === "create") {
    const title = formData.get("title");
    const week = formData.get("week");
    const season = formData.get("season");

    if (!title || !week || !season) {
      return data({ error: "Title, week, and season are required" }, { status: 400 });
    }

    const { data: ranking, error } = await supabase
      .from("user_rankings")
      .insert({
        user_id: user.id,
        title: title as string,
        week: parseInt(week as string),
        season: parseInt(season as string),
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate week/season error
      if (error.code === "23505") {
        return data(
          { error: "You already have a ranking for this week and season" },
          { status: 400 }
        );
      }
      console.error("Error creating ranking:", error);
      return data({ error: error.message }, { status: 500 });
    }

    return data({ success: true, ranking });
  }

  // Update ranking metadata
  if (intent === "update") {
    const rankingId = formData.get("rankingId");
    const title = formData.get("title");

    if (!rankingId || !title) {
      return data({ error: "Ranking ID and title are required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_rankings")
      .update({ title: title as string })
      .eq("id", rankingId as string)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating ranking:", error);
      return data({ error: error.message }, { status: 500 });
    }

    return data({ success: true });
  }

  // Save ranking entries (the actual ranked teams)
  if (intent === "save-entries") {
    const rankingId = formData.get("rankingId");
    const entriesJson = formData.get("entries");

    if (!rankingId || !entriesJson) {
      return data({ error: "Ranking ID and entries are required" }, { status: 400 });
    }

    let entries: { teamId: string; rank: number }[];
    try {
      entries = JSON.parse(entriesJson as string);
    } catch (e) {
      return data({ error: "Invalid entries format" }, { status: 400 });
    }

    // Verify the ranking belongs to the user
    const { data: ranking, error: rankingError } = await supabase
      .from("user_rankings")
      .select("id")
      .eq("id", rankingId as string)
      .eq("user_id", user.id)
      .single();

    if (rankingError || !ranking) {
      return data({ error: "Ranking not found" }, { status: 404 });
    }

    // Delete existing entries
    const { error: deleteError } = await supabase
      .from("ranking_entries")
      .delete()
      .eq("ranking_id", rankingId as string);

    if (deleteError) {
      console.error("Error deleting existing entries:", deleteError);
      return data({ error: deleteError.message }, { status: 500 });
    }

    // Insert new entries
    if (entries.length > 0) {
      const { error: insertError } = await supabase
        .from("ranking_entries")
        .insert(
          entries.map((entry) => ({
            ranking_id: rankingId as string,
            team_id: entry.teamId,
            rank: entry.rank,
          }))
        );

      if (insertError) {
        console.error("Error inserting new entries:", insertError);
        return data({ error: insertError.message }, { status: 500 });
      }
    }

    return data({ success: true });
  }

  // Publish a ranking
  if (intent === "publish") {
    const rankingId = formData.get("rankingId");

    if (!rankingId) {
      return data({ error: "Ranking ID is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_rankings")
      .update({ published_at: new Date().toISOString() })
      .eq("id", rankingId as string)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error publishing ranking:", error);
      return data({ error: error.message }, { status: 500 });
    }

    return data({ success: true });
  }

  // Delete a ranking
  if (intent === "delete") {
    const rankingId = formData.get("rankingId");

    if (!rankingId) {
      return data({ error: "Ranking ID is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_rankings")
      .delete()
      .eq("id", rankingId as string)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting ranking:", error);
      return data({ error: error.message }, { status: 500 });
    }

    return data({ success: true });
  }

  return data(
    { error: "Invalid intent. Use 'create', 'update', 'save-entries', 'publish', or 'delete'" },
    { status: 400 }
  );
}
