import { requireAuth } from "~/lib/auth.server";
import { inngest } from "../../inngest/client";

export async function action({ request }: { request: Request }) {
  // Require authentication
  await requireAuth(request);

  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    let gameId: string | null = null;

    // Handle both JSON and FormData
    const contentType = request.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const body = await request.json();
      gameId = body.gameId;
    } else {
      const formData = await request.formData();
      gameId = formData.get("gameId") as string;
    }

    if (!gameId) {
      return Response.json(
        { error: "gameId is required" },
        { status: 400 }
      );
    }

    // Trigger the Inngest function
    await inngest.send({
      name: "game/analyze.requested",
      data: { gameId },
    });

    return Response.json({
      success: true,
      message: "Analysis started",
      gameId,
    });
  } catch (error) {
    console.error("Error triggering matchup analysis:", error);
    return Response.json(
      { error: "Failed to start analysis" },
      { status: 500 }
    );
  }
}
