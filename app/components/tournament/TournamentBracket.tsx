import { useMemo, useState } from 'react';
import { BracketRound } from './BracketRound';
import type { Tournament, TournamentGame, BracketRound as BracketRoundType } from '~/lib/tournaments/types';
import { sortRounds } from '~/lib/tournaments/types';

interface TournamentBracketProps {
  tournament: Tournament;
  games: TournamentGame[];
  onGameClick?: (game: TournamentGame) => void;
}

export function TournamentBracket({ tournament, games, onGameClick }: TournamentBracketProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Group games by round and region
  const bracketData = useMemo(() => {
    const gamesByRound: Record<string, TournamentGame[]> = {};
    const gamesByRegion: Record<string, Record<string, TournamentGame[]>> = {};

    games.forEach((game) => {
      const round = game.tournament_round || 'unknown';
      const region = game.tournament_metadata?.region;

      // Group by round
      if (!gamesByRound[round]) {
        gamesByRound[round] = [];
      }
      gamesByRound[round].push(game);

      // Group by region (for NCAA tournaments)
      if (region) {
        if (!gamesByRegion[region]) {
          gamesByRegion[region] = {};
        }
        if (!gamesByRegion[region][round]) {
          gamesByRegion[region][round] = [];
        }
        gamesByRegion[region][round].push(game);
      }
    });

    // Convert to BracketRound structure
    const rounds: BracketRoundType[] = Object.entries(gamesByRound).map(([round, roundGames]) => ({
      round,
      games: roundGames.sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime()),
    }));

    return {
      rounds: sortRounds(rounds),
      gamesByRegion,
      regions: Object.keys(gamesByRegion),
    };
  }, [games]);

  // For NCAA tournaments, show region filter
  const isNCAA = tournament.type === 'ncaa';
  const hasRegions = bracketData.regions.length > 0;

  // Filter games by selected region if applicable
  const displayRounds = useMemo(() => {
    if (!selectedRegion || !hasRegions) {
      return bracketData.rounds;
    }

    const regionGames = bracketData.gamesByRegion[selectedRegion] || {};
    return Object.entries(regionGames)
      .map(([round, roundGames]) => ({
        round,
        region: selectedRegion,
        games: roundGames,
      }))
      .sort((a, b) => {
        const order: Record<string, number> = {
          first_four: 1,
          round_of_64: 2,
          round_of_32: 3,
          sweet_16: 4,
          elite_8: 5,
          final_four: 6,
          championship: 7,
        };
        return (order[a.round] ?? 99) - (order[b.round] ?? 99);
      });
  }, [bracketData, selectedRegion, hasRegions]);

  if (games.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No games in this tournament yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Region Filter for NCAA */}
      {isNCAA && hasRegions && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedRegion(null)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap border transition-colors ${
              selectedRegion === null
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            }`}
          >
            All Regions
          </button>
          {bracketData.regions.map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap border transition-colors ${
                selectedRegion === region
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      )}

      {/* Bracket Container */}
      <div className="bracket-container">
        {/* Desktop: Horizontal scroll bracket */}
        <div className="hidden md:block overflow-x-auto pb-4">
          <div className="flex gap-16 p-4 min-w-max relative">
            {displayRounds.map((round, roundIndex) => (
              <div key={`${round.round}-${round.region || 'all'}`} className="relative">
                <BracketRound
                  round={round.round}
                  games={round.games}
                  onGameClick={onGameClick}
                  isFirstRound={roundIndex === 0}
                  isLastRound={roundIndex === displayRounds.length - 1}
                />
                {/* Connector lines to next round */}
                {roundIndex < displayRounds.length - 1 && (
                  <div className="absolute left-full top-0 bottom-0 w-16">
                    {round.games.map((_, gameIndex) => {
                      if (gameIndex % 2 === 0 && gameIndex < round.games.length - 1) {
                        const topPosition = (gameIndex * (100 / round.games.length)) + (50 / round.games.length);
                        const bottomPosition = ((gameIndex + 1) * (100 / round.games.length)) + (50 / round.games.length);
                        const midPosition = (topPosition + bottomPosition) / 2;

                        return (
                          <svg
                            key={gameIndex}
                            className="absolute left-0 w-full"
                            style={{
                              top: `${topPosition}%`,
                              height: `${bottomPosition - topPosition}%`
                            }}
                          >
                            {/* Horizontal line from first game */}
                            <line
                              x1="0"
                              y1="0"
                              x2="50%"
                              y2="0"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-border"
                            />
                            {/* Vertical connector */}
                            <line
                              x1="50%"
                              y1="0"
                              x2="50%"
                              y2="100%"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-border"
                            />
                            {/* Horizontal line from second game */}
                            <line
                              x1="0"
                              y1="100%"
                              x2="50%"
                              y2="100%"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-border"
                            />
                            {/* Line to next round */}
                            <line
                              x1="50%"
                              y1="50%"
                              x2="100%"
                              y2="50%"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-border"
                            />
                          </svg>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: Vertical list by round */}
        <div className="md:hidden space-y-6">
          {displayRounds.map((round) => (
            <div key={`${round.round}-${round.region || 'all'}`} className="space-y-3">
              <h3 className="text-lg font-semibold px-4">
                {round.round.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </h3>
              <div className="space-y-3 px-4">
                {round.games.map((game) => (
                  <div key={game.id} onClick={() => onGameClick?.(game)}>
                    <div className="border rounded-md bg-card">
                      {/* Away Team */}
                      <div className="flex items-center justify-between p-3 border-b">
                        <div className="flex items-center gap-2">
                          {game.tournament_metadata?.seed_away && (
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-xs font-bold flex items-center justify-center">
                              {game.tournament_metadata.seed_away}
                            </span>
                          )}
                          <span className="font-medium">{game.away_team?.name}</span>
                        </div>
                        {game.status === 'completed' && (
                          <span className="text-lg font-bold">{game.away_score}</span>
                        )}
                      </div>

                      {/* Home Team */}
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          {game.tournament_metadata?.seed_home && (
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-xs font-bold flex items-center justify-center">
                              {game.tournament_metadata.seed_home}
                            </span>
                          )}
                          <span className="font-medium">{game.home_team?.name}</span>
                        </div>
                        {game.status === 'completed' && (
                          <span className="text-lg font-bold">{game.home_score}</span>
                        )}
                      </div>

                      {/* Game Info */}
                      <div className="px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
                        {new Date(game.game_date).toLocaleDateString()} •{' '}
                        {new Date(game.game_date).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
