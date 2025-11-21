/**
 * ESPN Tournament Scraper
 *
 * Fetches tournament data from ESPN's unofficial API endpoints and converts
 * it to our internal tournament data format.
 *
 * Key ESPN API patterns discovered:
 * - Tournament games have seasonType=3 (postseason)
 * - Tournament games have tournamentId=22 for NCAA tournament
 * - Groups parameter filters: groups=50 for NCAA tournament games
 * - Seeds appear in curatedRank.current field
 * - Regions appear in event notes headline
 * - Rounds appear in event notes headline
 */

import type {
  Tournament,
  TournamentType,
  TournamentGame,
  TournamentMetadata,
} from './types';

// ESPN API Base URL
const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';

/**
 * ESPN API Response Types
 */
interface EspnScoreboardResponse {
  events: EspnEvent[];
  leagues: EspnLeague[];
  season: EspnSeason;
}

interface EspnEvent {
  id: string;
  uid: string;
  date: string;
  name: string;
  shortName: string;
  season: { year: number; type: number; slug: string };
  competitions: EspnCompetition[];
  notes?: { type: string; headline: string }[];
}

interface EspnCompetition {
  id: string;
  uid: string;
  date: string;
  attendance?: number;
  type: { id: string; abbreviation: string };
  timeValid: boolean;
  neutralSite: boolean;
  conferenceCompetition: boolean;
  playByPlayAvailable: boolean;
  recent: boolean;
  venue: EspnVenue;
  competitors: EspnCompetitor[];
  notes: { type: string; headline: string }[];
  status: EspnStatus;
  broadcasts?: any[];
  leaders?: any[];
  format?: { regulation: { periods: number } };
  startDate: string;
  geoBroadcasts?: any[];
  headlines?: { description: string; type: string; shortLinkText: string }[];
}

interface EspnCompetitor {
  id: string;
  uid: string;
  type: string;
  order: number;
  homeAway: 'home' | 'away';
  team: EspnTeam;
  score: string;
  linescores?: { value: number }[];
  statistics?: any[];
  records?: { name: string; abbreviation?: string; type: string; summary: string }[];
  curatedRank?: { current: number };
}

interface EspnTeam {
  id: string;
  uid: string;
  location: string;
  name: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  color: string;
  alternateColor: string;
  isActive: boolean;
  venue: { id: string };
  links: { rel: string[]; href: string; text: string }[];
  logo: string;
}

interface EspnVenue {
  id: string;
  fullName: string;
  address: { city: string; state: string };
  indoor: boolean;
}

interface EspnStatus {
  clock: number;
  displayClock: string;
  period: number;
  type: { id: string; name: string; state: string; completed: boolean; description: string; detail: string; shortDetail: string };
}

interface EspnLeague {
  id: string;
  uid: string;
  name: string;
  abbreviation: string;
  slug: string;
  season: EspnSeason;
  calendarType: string;
  calendarIsWhitelist: boolean;
  calendarStartDate: string;
  calendarEndDate: string;
}

interface EspnSeason {
  year: number;
  startDate: string;
  endDate: string;
  displayName: string;
  type: { id: string; type: number; name: string; abbreviation: string };
}

/**
 * Parse region from ESPN event notes
 * Example: "Men's Basketball Championship - West Region - 1st Round"
 */
function parseRegion(notes?: { type: string; headline: string }[]): string | undefined {
  if (!notes || notes.length === 0) return undefined;

  const eventNote = notes.find((n) => n.type === 'event');
  if (!eventNote) return undefined;

  const headline = eventNote.headline;
  const regionMatch = headline.match(/(East|West|South|Midwest) Region/i);
  return regionMatch ? regionMatch[1] : undefined;
}

/**
 * Parse round from ESPN event notes
 * Example: "Men's Basketball Championship - West Region - 1st Round"
 */
function parseRound(notes?: { type: string; headline: string }[]): string | undefined {
  if (!notes || notes.length === 0) return undefined;

  const eventNote = notes.find((n) => n.type === 'event');
  if (!eventNote) return undefined;

  const headline = eventNote.headline.toLowerCase();

  // Map ESPN round names to our internal round names
  if (headline.includes('first four')) return 'first_four';
  if (headline.includes('1st round')) return 'round_of_64';
  if (headline.includes('2nd round')) return 'round_of_32';
  if (headline.includes('sweet 16') || headline.includes('sweet sixteen')) return 'sweet_16';
  if (headline.includes('elite 8') || headline.includes('elite eight')) return 'elite_8';
  if (headline.includes('final four') || headline.includes('semifinals')) return 'final_four';
  if (headline.includes('championship') || headline.includes('final')) return 'championship';

  return undefined;
}

/**
 * Parse tournament type from ESPN data
 */
function parseTournamentType(event: EspnEvent): TournamentType | undefined {
  const notes = event.notes || event.competitions[0]?.notes || [];
  const eventNote = notes.find((n) => n.type === 'event');

  if (!eventNote) return undefined;

  const headline = eventNote.headline.toLowerCase();

  if (headline.includes('ncaa') || headline.includes('march madness')) return 'ncaa';
  if (headline.includes('conference tournament') || headline.includes('championship')) return 'conference';
  // MTEs are harder to detect - might need to check tournament name or event name
  return undefined;
}

/**
 * Fetch tournament games from ESPN API
 */
export async function fetchTournamentGames(options: {
  startDate: string; // YYYYMMDD format
  endDate: string; // YYYYMMDD format
  groups?: string; // e.g., "50" for NCAA tournament
  limit?: number;
}): Promise<EspnScoreboardResponse> {
  const { startDate, endDate, groups, limit = 300 } = options;

  const params = new URLSearchParams({
    dates: `${startDate}-${endDate}`,
    limit: limit.toString(),
  });

  if (groups) {
    params.append('groups', groups);
  }

  const url = `${ESPN_API_BASE}/scoreboard?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`ESPN API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Convert ESPN event to our TournamentGame format
 */
export function convertEspnEventToGame(event: EspnEvent, competition: EspnCompetition): Partial<TournamentGame> {
  const homeTeam = competition.competitors.find((c) => c.homeAway === 'home');
  const awayTeam = competition.competitors.find((c) => c.homeAway === 'away');

  if (!homeTeam || !awayTeam) {
    throw new Error(`Invalid competition data: missing home or away team for event ${event.id}`);
  }

  const region = parseRegion(competition.notes);
  const round = parseRound(competition.notes);

  const tournamentMetadata: Record<string, any> = {};

  // Add seeds if available
  if (homeTeam.curatedRank?.current) {
    tournamentMetadata.seed_home = homeTeam.curatedRank.current;
  }
  if (awayTeam.curatedRank?.current) {
    tournamentMetadata.seed_away = awayTeam.curatedRank.current;
  }

  // Add region if available
  if (region) {
    tournamentMetadata.region = region;
  }

  // Determine status
  const isCompleted = competition.status.type.completed;
  const status = isCompleted ? 'completed' : competition.status.type.state === 'pre' ? 'scheduled' : 'in_progress';

  return {
    // We'll need to map ESPN team IDs to our team IDs
    external_id: competition.id,
    external_source: 'espn',
    game_date: new Date(competition.date).toISOString(),
    status,
    home_score: isCompleted ? parseInt(homeTeam.score, 10) : undefined,
    away_score: isCompleted ? parseInt(awayTeam.score, 10) : undefined,
    tournament_round: round,
    tournament_metadata: Object.keys(tournamentMetadata).length > 0 ? tournamentMetadata : undefined,
    venue: competition.venue.fullName,
    // ESPN data to help with team matching
    _espn_home_team: {
      id: homeTeam.team.id,
      name: homeTeam.team.displayName,
      abbreviation: homeTeam.team.abbreviation,
    },
    _espn_away_team: {
      id: awayTeam.team.id,
      name: awayTeam.team.displayName,
      abbreviation: awayTeam.team.abbreviation,
    },
  } as any; // Using 'any' to allow _espn fields for matching
}

/**
 * Fetch NCAA Tournament games for a specific year
 */
export async function fetchNCAATournamentGames(year: number): Promise<Partial<TournamentGame>[]> {
  // NCAA tournament typically runs from mid-March to early April
  const startDate = `${year}0315`; // March 15
  const endDate = `${year}0410`; // April 10

  const data = await fetchTournamentGames({
    startDate,
    endDate,
    groups: '50', // NCAA tournament group
    limit: 300,
  });

  const games: Partial<TournamentGame>[] = [];

  for (const event of data.events) {
    // Filter for tournament games (seasonType=3, tournamentId present)
    if (event.season.type !== 3) continue;

    for (const competition of event.competitions) {
      // Only process tournament games
      if (competition.type.abbreviation !== 'TRNMNT') continue;

      try {
        const game = convertEspnEventToGame(event, competition);
        games.push(game);
      } catch (error) {
        console.error(`Failed to convert event ${event.id}:`, error);
      }
    }
  }

  return games;
}

/**
 * Fetch Conference Tournament games for a specific conference and year
 */
export async function fetchConferenceTournamentGames(
  conferenceId: string,
  year: number,
  startDate: string, // YYYYMMDD
  endDate: string, // YYYYMMDD
): Promise<Partial<TournamentGame>[]> {
  const data = await fetchTournamentGames({
    startDate,
    endDate,
    limit: 100,
  });

  const games: Partial<TournamentGame>[] = [];

  for (const event of data.events) {
    // Filter for postseason games
    if (event.season.type !== 3) continue;

    for (const competition of event.competitions) {
      // Only process tournament games
      if (competition.type.abbreviation !== 'TRNMNT') continue;

      // Check if this is a conference tournament game
      // (This might need refinement based on actual data structure)
      const isConferenceTournament = competition.notes.some((n) =>
        n.headline.toLowerCase().includes('conference tournament'),
      );

      if (!isConferenceTournament) continue;

      try {
        const game = convertEspnEventToGame(event, competition);
        games.push(game);
      } catch (error) {
        console.error(`Failed to convert event ${event.id}:`, error);
      }
    }
  }

  return games;
}

/**
 * Fetch MTE (Multi-Team Event) games
 * MTEs are harder to detect - they're often just labeled with the event name
 */
export async function fetchMTEGames(
  eventName: string,
  startDate: string, // YYYYMMDD
  endDate: string, // YYYYMMDD
): Promise<Partial<TournamentGame>[]> {
  const data = await fetchTournamentGames({
    startDate,
    endDate,
    limit: 100,
  });

  const games: Partial<TournamentGame>[] = [];

  // Try to match by event name
  const normalizedEventName = eventName.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const event of data.events) {
    const normalizedName = event.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check if event name matches
    if (!normalizedName.includes(normalizedEventName)) continue;

    for (const competition of event.competitions) {
      try {
        const game = convertEspnEventToGame(event, competition);
        games.push(game);
      } catch (error) {
        console.error(`Failed to convert event ${event.id}:`, error);
      }
    }
  }

  return games;
}
