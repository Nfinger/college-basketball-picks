import { BracketGame } from './BracketGame';
import type { TournamentGame } from '~/lib/tournaments/types';
import { getRoundDisplayName } from '~/lib/tournaments/types';

interface BracketRoundProps {
  round: string;
  games: TournamentGame[];
  onGameClick?: (game: TournamentGame) => void;
  isFirstRound?: boolean;
  isLastRound?: boolean;
}

export function BracketRound({ round, games, onGameClick, isFirstRound, isLastRound }: BracketRoundProps) {
  // Calculate spacing between games based on round progression
  const gameHeight = 96; // Height of each game card including padding
  const gapBetweenPairs = isFirstRound ? 16 : 32;

  return (
    <div className="bracket-round flex flex-col min-w-[280px]">
      <div className="text-center font-semibold text-sm mb-6 px-2 border-b pb-2">
        {getRoundDisplayName(round)}
      </div>
      <div className="flex flex-col justify-center h-full">
        {games.map((game, index) => {
          // For non-first rounds, add extra spacing before every other game
          const shouldAddExtraSpace = !isFirstRound && index > 0 && index % 2 === 0;
          const extraMargin = shouldAddExtraSpace ? gameHeight + gapBetweenPairs : 0;

          return (
            <div
              key={game.id}
              style={{
                marginTop: index === 0 ? 0 : (index % 2 === 0 ? `${extraMargin}px` : `${gapBetweenPairs}px`)
              }}
            >
              <BracketGame game={game} onClick={onGameClick} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
