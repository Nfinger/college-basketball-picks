import type { TournamentGame } from '~/lib/tournaments/types';

interface BracketGameProps {
  game: TournamentGame;
  onClick?: (game: TournamentGame) => void;
}

export function BracketGame({ game, onClick }: BracketGameProps) {
  const isCompleted = game.status === 'completed';
  const awayWon = isCompleted && (game.away_score ?? 0) > (game.home_score ?? 0);
  const homeWon = isCompleted && (game.home_score ?? 0) > (game.away_score ?? 0);

  return (
    <div
      className="bracket-game border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer shadow-sm"
      onClick={() => onClick?.(game)}
    >
      {/* Away Team */}
      <div
        className={`flex items-center justify-between p-3 border-b ${
          awayWon ? 'font-bold' : isCompleted ? 'text-muted-foreground' : ''
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {game.tournament_metadata?.seed_away && (
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
              {game.tournament_metadata.seed_away}
            </span>
          )}
          <span className="text-sm">{game.away_team?.name}</span>
        </div>
        {isCompleted && (
          <span className={`ml-2 text-sm font-bold ${awayWon ? 'text-primary' : ''}`}>
            {game.away_score}
          </span>
        )}
      </div>

      {/* Home Team */}
      <div
        className={`flex items-center justify-between p-3 ${
          homeWon ? 'font-bold' : isCompleted ? 'text-muted-foreground' : ''
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {game.tournament_metadata?.seed_home && (
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
              {game.tournament_metadata.seed_home}
            </span>
          )}
          <span className="text-sm">{game.home_team?.name}</span>
        </div>
        {isCompleted && (
          <span className={`ml-2 text-sm font-bold ${homeWon ? 'text-primary' : ''}`}>
            {game.home_score}
          </span>
        )}
      </div>
    </div>
  );
}
