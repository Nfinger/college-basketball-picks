/**
 * Game Details Dialog
 *
 * Shows detailed information about a tournament game when clicked.
 * Includes teams, seeds, scores, date/time, venue, and round information.
 */

import type { TournamentGame } from '~/lib/tournaments/types';
import { getRoundDisplayName } from '~/lib/tournaments/types';

interface GameDetailsDialogProps {
  game: TournamentGame | null;
  onClose: () => void;
}

export function GameDetailsDialog({ game, onClose }: GameDetailsDialogProps) {
  if (!game) return null;

  const isCompleted = game.status === 'completed';
  const awayWon = isCompleted && (game.away_score ?? 0) > (game.home_score ?? 0);
  const homeWon = isCompleted && (game.home_score ?? 0) > (game.away_score ?? 0);

  const seedHome = game.tournament_metadata?.seed_home;
  const seedAway = game.tournament_metadata?.seed_away;
  const region = game.tournament_metadata?.region;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-2xl font-bold mb-1">Game Details</h2>
              {game.tournament_round && (
                <p className="text-sm text-muted-foreground">{getRoundDisplayName(game.tournament_round)}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                game.status === 'completed'
                  ? 'bg-gray-100 text-gray-800'
                  : game.status === 'in_progress'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
              }`}
            >
              {game.status === 'completed' ? 'Final' : game.status === 'in_progress' ? 'Live' : 'Scheduled'}
            </span>
            {region && (
              <span className="inline-block px-2 py-1 text-xs rounded-full font-medium bg-primary/10 text-primary">
                {region} Region
              </span>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="p-6">
          <div className="space-y-4">
            {/* Away Team */}
            <div
              className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                awayWon ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                {seedAway && (
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-lg">
                    {seedAway}
                  </div>
                )}
                <div>
                  <div className={`font-semibold text-lg ${awayWon ? 'text-primary' : ''}`}>
                    {game.away_team?.name || 'Away Team'}
                  </div>
                  {game.away_team?.short_name && game.away_team.short_name !== game.away_team.name && (
                    <div className="text-sm text-muted-foreground">{game.away_team.short_name}</div>
                  )}
                </div>
              </div>
              {isCompleted && (
                <div className={`text-3xl font-bold ${awayWon ? 'text-primary' : 'text-muted-foreground'}`}>
                  {game.away_score}
                </div>
              )}
            </div>

            {/* Home Team */}
            <div
              className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                homeWon ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                {seedHome && (
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-lg">
                    {seedHome}
                  </div>
                )}
                <div>
                  <div className={`font-semibold text-lg ${homeWon ? 'text-primary' : ''}`}>
                    {game.home_team?.name || 'Home Team'}
                  </div>
                  {game.home_team?.short_name && game.home_team.short_name !== game.home_team.name && (
                    <div className="text-sm text-muted-foreground">{game.home_team.short_name}</div>
                  )}
                </div>
              </div>
              {isCompleted && (
                <div className={`text-3xl font-bold ${homeWon ? 'text-primary' : 'text-muted-foreground'}`}>
                  {game.home_score}
                </div>
              )}
            </div>
          </div>

          {/* Game Info */}
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 flex-shrink-0"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <div>
                <div className="font-medium">Date & Time</div>
                <div className="text-muted-foreground">
                  {new Date(game.game_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {' at '}
                  {new Date(game.game_date).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })}
                </div>
              </div>
            </div>

            {game.venue && (
              <div className="flex items-start gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 flex-shrink-0"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <div>
                  <div className="font-medium">Venue</div>
                  <div className="text-muted-foreground">{game.venue}</div>
                </div>
              </div>
            )}

            {game.tournament_round && (
              <div className="flex items-start gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 flex-shrink-0"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <div>
                  <div className="font-medium">Round</div>
                  <div className="text-muted-foreground">{getRoundDisplayName(game.tournament_round)}</div>
                </div>
              </div>
            )}

            {game.external_source && (
              <div className="flex items-start gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 flex-shrink-0"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <div>
                  <div className="font-medium">Data Source</div>
                  <div className="text-muted-foreground">{game.external_source.toUpperCase()}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-muted/30">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
