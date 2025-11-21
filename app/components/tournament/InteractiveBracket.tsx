import { useState, useEffect } from 'react';
import type { TournamentGame, Tournament } from '~/lib/tournaments/types';
import { BracketMatchup } from './BracketMatchup';

interface InteractiveBracketProps {
  tournament: Tournament;
  games: TournamentGame[];
  userPicks: Record<string, { winner_team_id: string; picked_at: string }>;
  onPickWinner: (gameId: string, teamId: string) => void;
}

interface BracketRound {
  round: string;
  games: TournamentGame[];
}

export function InteractiveBracket({ tournament, games, userPicks, onPickWinner }: InteractiveBracketProps) {
  const [rounds, setRounds] = useState<BracketRound[]>([]);

  useEffect(() => {
    // Build a map to track which teams advance to which games based on picks
    const gameById = new Map(games.map(g => [g.id, g]));
    const advancedTeams = new Map<string, { team: any; seed?: number }>();

    // Process picks to determine which teams advance (both winners and losers)
    Object.entries(userPicks).forEach(([gameId, pick]) => {
      const game = gameById.get(gameId);
      if (!game) return;

      const metadata = game.tournament_metadata;

      // Determine winner and loser
      const winnerTeam = game.away_team?.id === pick.winner_team_id
        ? game.away_team
        : game.home_team;

      const loserTeam = game.away_team?.id === pick.winner_team_id
        ? game.home_team
        : game.away_team;

      const winnerSeed = game.away_team?.id === pick.winner_team_id
        ? metadata.seed_away
        : metadata.seed_home;

      const loserSeed = game.away_team?.id === pick.winner_team_id
        ? metadata.seed_home
        : metadata.seed_away;

      // Advance winner to next game (championship)
      if (metadata?.next_game_id && metadata?.winner_advances_to) {
        const advanceKey = `${metadata.next_game_id}-${metadata.winner_advances_to}`;
        advancedTeams.set(advanceKey, { team: winnerTeam, seed: winnerSeed });
      }

      // Advance loser to consolation game
      if (metadata?.loser_next_game_id && metadata?.loser_advances_to) {
        const loserAdvanceKey = `${metadata.loser_next_game_id}-${metadata.loser_advances_to}`;
        advancedTeams.set(loserAdvanceKey, { team: loserTeam, seed: loserSeed });
      }
    });

    // Create a map of games with their picks applied
    const gamesWithPicks = games.map(game => {
      const metadata = game.tournament_metadata;

      // Check if teams should be populated from previous round picks
      const awayAdvance = advancedTeams.get(`${game.id}-away`);
      const homeAdvance = advancedTeams.get(`${game.id}-home`);

      // If this game has placeholder teams (championship/consolation), always use advanced teams if available
      const isPlaceholder = metadata?.is_placeholder === true;

      if (awayAdvance || homeAdvance || isPlaceholder) {
        return {
          ...game,
          // For placeholder games, show null (TBD) if no pick has advanced a team yet
          away_team: awayAdvance?.team || (isPlaceholder ? null : game.away_team),
          home_team: homeAdvance?.team || (isPlaceholder ? null : game.home_team),
          tournament_metadata: {
            ...metadata,
            seed_away: awayAdvance?.seed ?? metadata?.seed_away,
            seed_home: homeAdvance?.seed ?? metadata?.seed_home,
          },
        };
      }

      return game;
    });

    // Group games by round and sort by tournament progression
    const gamesByRound = gamesWithPicks.reduce((acc, game) => {
      const round = game.tournament_round || 'unknown';
      if (!acc[round]) {
        acc[round] = [];
      }
      acc[round].push(game);
      return acc;
    }, {} as Record<string, TournamentGame[]>);

    // Define round order for proper bracket display
    const roundOrder: Record<string, number> = {
      'first_four': 1,
      'round_of_64': 2,
      'round_of_32': 3,
      'sweet_16': 4,
      'elite_8': 5,
      'final_four': 6,
      'consolation': 6,  // Consolation on LEFT (losers go left)
      'semifinals': 7,   // Semifinals in CENTER
      'championship': 8, // Championship on RIGHT (winners go right)
      'finals': 8,
    };

    // Convert to array and sort
    const sortedRounds = Object.entries(gamesByRound)
      .map(([round, roundGames]) => ({
        round,
        games: roundGames.sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime()),
      }))
      .sort((a, b) => (roundOrder[a.round] || 99) - (roundOrder[b.round] || 99));

    setRounds(sortedRounds);
  }, [games, userPicks]);

  const getRoundDisplayName = (round: string): string => {
    const names: Record<string, string> = {
      'first_four': 'First Four',
      'round_of_64': 'Round of 64',
      'round_of_32': 'Round of 32',
      'sweet_16': 'Sweet 16',
      'elite_8': 'Elite 8',
      'final_four': 'Final Four',
      'semifinals': 'Semifinals',
      'consolation': 'Consolation',
      'championship': 'Championship',
      'finals': 'Finals',
    };
    return names[round] || round.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (games.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No games in this tournament yet.
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Desktop: Horizontal scrolling bracket */}
      <div className="hidden lg:block overflow-x-auto pb-8">
        <div className="inline-flex gap-16 p-8 min-w-max items-center">
          {rounds.map((round, roundIndex) => (
            <div key={round.round} className="relative flex flex-col">
              {/* Round Header */}
              <div className="text-center font-bold text-sm mb-6 px-4 py-2 bg-primary/10 rounded-lg whitespace-nowrap">
                {getRoundDisplayName(round.round)}
              </div>

              {/* Games in this round */}
              <div className="flex flex-col gap-8 justify-center">
                {round.games.map((game) => {
                  const userPick = userPicks[game.id];

                  return (
                    <div key={game.id}>
                      <BracketMatchup
                        game={game}
                        selectedWinnerId={userPick?.winner_team_id}
                        onSelectWinner={(teamId) => onPickWinner(game.id, teamId)}
                        isLocked={game.status !== 'scheduled'}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Connecting lines to next round */}
              {roundIndex < rounds.length - 1 && round.games.length === 2 && (
                <svg
                  className="absolute left-full top-0 w-16 h-full pointer-events-none"
                  style={{ marginLeft: '0px' }}
                >
                  {/* Line from first game */}
                  <line
                    x1="0"
                    y1="35%"
                    x2="50%"
                    y2="35%"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted-foreground"
                  />
                  {/* Line from second game */}
                  <line
                    x1="0"
                    y1="65%"
                    x2="50%"
                    y2="65%"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted-foreground"
                  />
                  {/* Vertical connector */}
                  <line
                    x1="50%"
                    y1="35%"
                    x2="50%"
                    y2="65%"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted-foreground"
                  />
                  {/* Line to next game */}
                  <line
                    x1="50%"
                    y1="50%"
                    x2="100%"
                    y2="50%"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted-foreground"
                  />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: Vertical list */}
      <div className="lg:hidden space-y-6 p-4">
        {rounds.map((round) => (
          <div key={round.round} className="space-y-4">
            <h3 className="text-lg font-bold px-2 py-1 bg-primary/10 rounded-lg">
              {getRoundDisplayName(round.round)}
            </h3>
            <div className="space-y-3">
              {round.games.map((game) => {
                const userPick = userPicks[game.id];

                return (
                  <BracketMatchup
                    key={game.id}
                    game={game}
                    selectedWinnerId={userPick?.winner_team_id}
                    onSelectWinner={(teamId) => onPickWinner(game.id, teamId)}
                    isLocked={game.status !== 'scheduled'}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
