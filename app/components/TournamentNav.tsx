import { Link } from 'react-router';
import type { Tournament } from '~/lib/tournaments/types';

interface TournamentNavProps {
  tournaments: Tournament[];
  currentTournamentId?: string;
}

export function TournamentNav({ tournaments, currentTournamentId }: TournamentNavProps) {
  // Filter to show only upcoming and in-progress tournaments
  const activeTournaments = tournaments
    .filter((t) => t.status === 'upcoming' || t.status === 'in_progress')
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  if (activeTournaments.length === 0) {
    return null;
  }

  return (
    <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      <Link
        to="/games"
        className="px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap border hover:bg-muted transition-colors"
      >
        All Games
      </Link>
      {activeTournaments.map((tournament) => (
        <Link
          key={tournament.id}
          to={`/tournaments/${tournament.id}`}
          className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap border transition-colors ${
            currentTournamentId === tournament.id
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
        >
          {tournament.name}
          {tournament.status === 'in_progress' && (
            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </Link>
      ))}
    </nav>
  );
}
