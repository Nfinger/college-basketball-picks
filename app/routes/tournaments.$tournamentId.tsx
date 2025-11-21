import { data, type LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link, useFetcher } from 'react-router';
import { useState, useCallback } from 'react';
import { createSupabaseServerClient } from '~/lib/supabase.server';
import {
  getTournament,
  getTournamentGames,
  getTournamentTeams,
} from '~/lib/tournaments/queries.server';
import { InteractiveBracket } from '~/components/tournament/InteractiveBracket';
import { GameDetailsDialog } from '~/components/tournament/GameDetailsDialog';
import type { TournamentGame } from '~/lib/tournaments/types';
import { Trophy } from 'lucide-react';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const { tournamentId } = params;

  if (!tournamentId) {
    throw new Response('Tournament ID required', { status: 400 });
  }

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [tournament, games, teams, bracketPicks] = await Promise.all([
    getTournament(supabase, tournamentId),
    getTournamentGames(supabase, tournamentId),
    getTournamentTeams(supabase, tournamentId),
    // Load user's bracket picks if logged in
    user
      ? supabase
          .from('bracket_picks')
          .select('picks, champion_team_id')
          .eq('user_id', user.id)
          .eq('tournament_id', tournamentId)
          .single()
          .then(({ data }) => data)
      : Promise.resolve(null),
  ]);

  return data({
    tournament,
    games,
    teams,
    userPicks: bracketPicks?.picks || {},
    championTeamId: bracketPicks?.champion_team_id,
  });
}

export default function TournamentDetail() {
  const { tournament, games, teams, userPicks: initialPicks, championTeamId } = useLoaderData<typeof loader>();
  const [selectedGame, setSelectedGame] = useState<TournamentGame | null>(null);
  const [userPicks, setUserPicks] = useState(initialPicks);
  const fetcher = useFetcher();

  const handlePickWinner = useCallback(
    (gameId: string, teamId: string) => {
      // Optimistic update
      setUserPicks((prev) => ({
        ...prev,
        [gameId]: {
          winner_team_id: teamId,
          picked_at: new Date().toISOString(),
        },
      }));

      // Save to database
      fetcher.submit(
        {
          tournamentId: tournament.id,
          gameId,
          winnerTeamId: teamId,
        },
        {
          method: 'POST',
          action: '/api/bracket-picks',
          encType: 'application/json',
        }
      );
    },
    [tournament.id, fetcher]
  );

  // Find champion team
  const championTeam = championTeamId
    ? teams.find((t) => t.team.id === championTeamId)?.team
    : null;

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link to="/?view=tournaments" className="text-sm text-muted-foreground hover:underline mb-2 inline-block">
          ← Back to Tournaments
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{tournament.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {tournament.type.toUpperCase()}
              </span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  tournament.status === 'in_progress'
                    ? 'bg-green-100 text-green-800'
                    : tournament.status === 'upcoming'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {tournament.status}
              </span>
              <span>
                {new Date(tournament.start_date).toLocaleDateString()} -{' '}
                {new Date(tournament.end_date).toLocaleDateString()}
              </span>
              {tournament.location && <span>📍 {tournament.location}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Champion Display */}
      {championTeam && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 rounded-lg border-2 border-yellow-500/50 p-6 mb-6">
          <div className="flex items-center justify-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-600" />
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Your Champion</div>
              <div className="text-2xl font-bold text-yellow-600">{championTeam.name}</div>
            </div>
            <Trophy className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      )}

      {/* Tournament Bracket */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Make Your Picks</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Click on a team to pick them as the winner. Your picks are saved automatically.
        </p>
        <InteractiveBracket
          tournament={tournament}
          games={games}
          userPicks={userPicks}
          onPickWinner={handlePickWinner}
        />
      </div>

      {/* Game Details Dialog */}
      <GameDetailsDialog game={selectedGame} onClose={() => setSelectedGame(null)} />
    </div>
  );
}
