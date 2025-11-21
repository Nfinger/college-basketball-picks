import { data, useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import {
  getCurrentSeasonTournament,
  getUserBracketPicks,
  getAllTeams,
  saveBracketPicks
} from "~/lib/bracket.server";
import { BracketEditor } from "~/components/bracket-editor";
import type { BracketPicks } from "~/components/bracket-editor";
import type { Route } from "./+types/rankings.bracketology";

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase, headers } = await requireAuth(request);

  // Get current season's tournament
  const currentTournament = await getCurrentSeasonTournament(supabase);

  if (!currentTournament) {
    return data(
      {
        tournament: null,
        bracketPicks: null,
        teams: []
      },
      { headers }
    );
  }

  // Get user's bracket picks
  const bracketPicks = await getUserBracketPicks(
    supabase,
    user.id,
    currentTournament.id
  );

  // Get all teams
  const teams = await getAllTeams(supabase);

  return data(
    {
      tournament: currentTournament,
      bracketPicks,
      teams,
    },
    { headers }
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, supabase, headers } = await requireAuth(request);

  const formData = await request.formData();
  const picks = JSON.parse(formData.get("picks") as string) as BracketPicks;
  const tournamentId = formData.get("tournamentId") as string;

  const result = await saveBracketPicks(supabase, user.id, tournamentId, picks);

  return data(result, { headers });
}

export default function BracketologyPage() {
  const { tournament, bracketPicks, teams } = useLoaderData<typeof loader>();

  if (!tournament) {
    return (
      <div className="container mx-auto max-w-7xl p-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">No Tournament Available</h2>
          <p className="text-muted-foreground">
            Tournament data will be available once the season schedule is set.
          </p>
        </div>
      </div>
    );
  }

  const handleSave = async (picks: BracketPicks) => {
    const formData = new FormData();
    formData.append("picks", JSON.stringify(picks));
    formData.append("tournamentId", tournament.id);

    await fetch("?index", {
      method: "POST",
      body: formData,
    });
  };

  return (
    <div className="container mx-auto max-w-7xl p-4">
      <BracketEditor
        tournamentId={tournament.id}
        initialPicks={bracketPicks}
        teams={teams}
        onSave={handleSave}
        autoSave={true}
      />
    </div>
  );
}
