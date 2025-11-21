import { Check } from 'lucide-react';
import type { TournamentGame } from '~/lib/tournaments/types';

interface BracketMatchupProps {
  game: TournamentGame;
  selectedWinnerId?: string;
  onSelectWinner: (teamId: string) => void;
  isLocked?: boolean;
}

export function BracketMatchup({ game, selectedWinnerId, onSelectWinner, isLocked }: BracketMatchupProps) {
  const isCompleted = game.status === 'completed';
  const awayTeamId = game.away_team?.id;
  const homeTeamId = game.home_team?.id;

  const awaySelected = selectedWinnerId === awayTeamId;
  const homeSelected = selectedWinnerId === homeTeamId;

  // For completed games, show actual winner
  const actualWinner = isCompleted
    ? ((game.away_score ?? 0) > (game.home_score ?? 0) ? awayTeamId : homeTeamId)
    : null;

  const handleTeamClick = (teamId: string) => {
    if (!isLocked && teamId) {
      onSelectWinner(teamId);
    }
  };

  return (
    <div className="w-[280px] border-2 rounded-lg bg-card shadow-md overflow-hidden">
      {/* Away Team */}
      <div
        onClick={() => handleTeamClick(awayTeamId!)}
        className={`
          flex items-center justify-between p-3 border-b-2 transition-all
          ${!isLocked && awayTeamId ? 'cursor-pointer hover:bg-muted/50' : ''}
          ${awaySelected && !isCompleted ? 'bg-primary/10 border-l-4 border-l-primary' : ''}
          ${isCompleted && actualWinner === awayTeamId ? 'bg-green-500/10 font-bold' : ''}
          ${isCompleted && actualWinner !== awayTeamId ? 'opacity-50' : ''}
        `}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {game.tournament_metadata?.seed_away && (
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
              {game.tournament_metadata.seed_away}
            </span>
          )}
          <span className="text-sm font-medium truncate">
            {game.away_team?.name || 'TBD'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isCompleted && (
            <span className={`text-sm font-bold ${actualWinner === awayTeamId ? 'text-green-600' : ''}`}>
              {game.away_score}
            </span>
          )}
          {awaySelected && !isCompleted && (
            <Check className="w-5 h-5 text-primary" />
          )}
        </div>
      </div>

      {/* Home Team */}
      <div
        onClick={() => handleTeamClick(homeTeamId!)}
        className={`
          flex items-center justify-between p-3 transition-all
          ${!isLocked && homeTeamId ? 'cursor-pointer hover:bg-muted/50' : ''}
          ${homeSelected && !isCompleted ? 'bg-primary/10 border-l-4 border-l-primary' : ''}
          ${isCompleted && actualWinner === homeTeamId ? 'bg-green-500/10 font-bold' : ''}
          ${isCompleted && actualWinner !== homeTeamId ? 'opacity-50' : ''}
        `}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {game.tournament_metadata?.seed_home && (
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
              {game.tournament_metadata.seed_home}
            </span>
          )}
          <span className="text-sm font-medium truncate">
            {game.home_team?.name || 'TBD'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isCompleted && (
            <span className={`text-sm font-bold ${actualWinner === homeTeamId ? 'text-green-600' : ''}`}>
              {game.home_score}
            </span>
          )}
          {homeSelected && !isCompleted && (
            <Check className="w-5 h-5 text-primary" />
          )}
        </div>
      </div>

      {/* Game Status Footer */}
      {!isCompleted && (
        <div className="px-3 py-1.5 bg-muted/30 text-xs text-muted-foreground text-center border-t">
          {new Date(game.game_date).toLocaleDateString()} • {new Date(game.game_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
      {isCompleted && (
        <div className="px-3 py-1.5 bg-green-500/10 text-xs text-green-700 font-medium text-center border-t border-green-500/20">
          Final
        </div>
      )}
    </div>
  );
}
