/**
 * NCAA API Scraper for Tournament Data
 *
 * Uses the free NCAA API (henrygd/ncaa-api) to scrape tournament games.
 * API Documentation: https://github.com/henrygd/ncaa-api
 * Demo API: https://ncaa-api.henrygd.me/openapi
 */

const NCAA_API_BASE = 'https://ncaa-api.henrygd.me';

interface NcaaTeam {
  names: {
    full: string;
    short: string;
    seo: string;
    char6: string;
  };
  score: string;
  winner: boolean;
  description: string;
  conferences: Array<{
    conferenceName: string;
    conferenceSeo: string;
  }>;
}

interface NcaaGame {
  game: {
    gameID: string;
    away: NcaaTeam;
    home: NcaaTeam;
    finalMessage: string;
    startTime: string;
    startTimeEpoch: number;
    startDate: string;
    gameState: string;
    currentPeriod: string;
    url: string;
  };
}

interface NcaaScoreboardResponse {
  games: NcaaGame[];
}

/**
 * Fetch games from NCAA API for a specific date
 * @param date - Date in YYYY-MM-DD format
 * @returns Array of games
 */
export async function fetchNcaaGames(date: string): Promise<NcaaGame[]> {
  const [year, month, day] = date.split('-');
  const url = `${NCAA_API_BASE}/scoreboard/basketball-men/d1/${year}/${month}/${day}`;

  console.log(`📡 Fetching NCAA games from: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'College-Basketball-Picks-App/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`NCAA API request failed: ${response.status} ${response.statusText}`);
  }

  const data: NcaaScoreboardResponse = await response.json();
  return data.games || [];
}

/**
 * Fetch games for a tournament by team names and date range
 * @param teamNames - Array of team names to filter for
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Array of matching games
 */
export async function fetchTournamentGames(
  teamNames: string[],
  startDate: string,
  endDate: string
): Promise<NcaaGame[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const allGames: NcaaGame[] = [];

  // Normalize team names for matching (lowercase, no special chars)
  const normalizedTeamNames = teamNames.map((name) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  console.log(`🔍 Searching for tournament games from ${startDate} to ${endDate}`);
  console.log(`   Teams: ${teamNames.join(', ')}`);

  // Fetch games for each day in the range
  const currentDate = new Date(start);
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];

    try {
      const games = await fetchNcaaGames(dateStr);

      // Filter for games involving tournament teams
      const tournamentGames = games.filter((game) => {
        const awayTeamNormalized = game.game.away.names.full
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        const homeTeamNormalized = game.game.home.names.full
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

        return (
          normalizedTeamNames.includes(awayTeamNormalized) ||
          normalizedTeamNames.includes(homeTeamNormalized)
        );
      });

      console.log(`   ${dateStr}: Found ${tournamentGames.length} games`);
      allGames.push(...tournamentGames);
    } catch (error) {
      console.error(`   ${dateStr}: Error fetching games:`, error);
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);

    // Rate limiting: 5 requests per second max
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.log(`✅ Found ${allGames.length} total tournament games`);
  return allGames;
}

/**
 * Convert NCAA API game to our internal game format
 * Adds temporary _espn_home_team and _espn_away_team fields for team matching
 */
export function convertNcaaGameToInternal(game: NcaaGame): {
  home_team_name: string;
  away_team_name: string;
  game_date: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  home_score: number | null;
  away_score: number | null;
  metadata: Record<string, any>;
  _espn_home_team: { id: string; name: string; abbreviation: string };
  _espn_away_team: { id: string; name: string; abbreviation: string };
} {
  // Determine status from gameState
  let status: 'scheduled' | 'in_progress' | 'completed' = 'scheduled';
  if (game.game.gameState === 'final') {
    status = 'completed';
  } else if (game.game.gameState === 'live') {
    status = 'in_progress';
  }

  // Parse scores
  const homeScore = game.game.home.score ? parseInt(game.game.home.score) : null;
  const awayScore = game.game.away.score ? parseInt(game.game.away.score) : null;

  // Create game date from epoch timestamp (seconds, not milliseconds) or fallback to startDate/startTime
  let gameDate: string;
  try {
    const epoch = typeof game.game.startTimeEpoch === 'string'
      ? parseInt(game.game.startTimeEpoch)
      : game.game.startTimeEpoch;

    if (epoch && !isNaN(epoch)) {
      // Convert from seconds to milliseconds
      gameDate = new Date(epoch * 1000).toISOString();
    } else if (game.game.startDate && game.game.startTime) {
      // Combine startDate and startTime
      gameDate = new Date(`${game.game.startDate} ${game.game.startTime}`).toISOString();
    } else {
      // Fallback to just the date
      gameDate = new Date(game.game.startDate).toISOString();
    }
  } catch (error) {
    console.error('Error parsing game date:', {
      startTimeEpoch: game.game.startTimeEpoch,
      startDate: game.game.startDate,
      startTime: game.game.startTime,
      gameID: game.game.gameID,
    });
    throw error;
  }

  return {
    home_team_name: game.game.home.names.full,
    away_team_name: game.game.away.names.full,
    game_date: gameDate,
    status,
    home_score: homeScore,
    away_score: awayScore,
    metadata: {
      ncaa_game_id: game.game.gameID,
      ncaa_url: game.game.url,
      home_team_short: game.game.home.names.short,
      away_team_short: game.game.away.names.short,
      home_conference: game.game.home.conferences[0]?.conferenceName,
      away_conference: game.game.away.conferences[0]?.conferenceName,
      final_message: game.game.finalMessage,
      current_period: game.game.currentPeriod,
    },
    // Temporary fields for team matching (using NCAA game ID as pseudo-ESPN ID)
    _espn_home_team: {
      id: `ncaa-${game.game.gameID}-home`,
      name: game.game.home.names.full,
      abbreviation: game.game.home.names.short,
    },
    _espn_away_team: {
      id: `ncaa-${game.game.gameID}-away`,
      name: game.game.away.names.full,
      abbreviation: game.game.away.names.short,
    },
  };
}
