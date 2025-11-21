/**
 * Blog Post Parser for MTE Tournament Data
 *
 * Extracts structured tournament data from Blogging the Bracket HTML posts.
 * Handles various date formats, team listings, and tournament metadata.
 */

import * as cheerio from 'cheerio';

export interface ParsedTournament {
  name: string;
  dates: {
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
    raw: string; // Original text for debugging
  };
  location: string;
  teams: Array<{
    name: string;
    conference: string;
    isTBD: boolean;
    bracket?: string; // e.g., "Palmetto Bracket", "Lowcountry Bracket"
  }>;
  format: {
    gameCount: number;
    description: string; // "2 games (bracketed MTE)"
  };
  brackets?: string[]; // List of bracket names if multi-bracket tournament
  metadata: {
    sourceUrl: string;
    parsedAt: string;
    section: number; // Position in blog post
  };
}

export interface BlogParseResult {
  tournaments: ParsedTournament[];
  errors: Array<{
    section: number;
    error: string;
    html: string; // For debugging
  }>;
  metadata: {
    totalTournaments: number;
    parseDate: string;
    blogPostUrl: string;
  };
}

interface ParseOptions {
  sourceUrl?: string;
  year?: number; // Default to current season
}

/**
 * Parse blog post HTML to extract tournament data
 */
export async function parseBlogPost(
  htmlContent: string,
  options: ParseOptions = {},
): Promise<BlogParseResult> {
  const $ = cheerio.load(htmlContent);
  const tournaments: ParsedTournament[] = [];
  const errors: Array<{ section: number; error: string; html: string }> = [];

  const sourceUrl = options.sourceUrl || 'unknown';
  const year = options.year || new Date().getFullYear() + 1; // Default to next season

  // Find all tournament entries
  // Typical format: "Tournament Name (Date: Location, Format) Team1 (Conf), Team2 (Conf), ..."
  // The blog post uses paragraphs or list items for each tournament

  let sectionNumber = 0;

  // Try multiple selectors to handle different blog formats
  const selectors = ['p', 'li', '.entry-content > *'];

  for (const selector of selectors) {
    $(selector).each((index, element) => {
      const text = $(element).text().trim();
      const html = $(element).html() || '';

      // Skip empty or very short text
      if (text.length < 20) return;

      // Skip non-tournament content
      // 1. Headers/section titles (short, no parentheses with dates)
      if (text.length < 50 && !text.includes(':')) return;

      // 2. PDF links and informational text
      if (html.includes('.pdf') || text.includes('PDF') || text.includes('NCAA.org')) return;

      // 3. Conference listings (starts with "Conferences" or lists conferences with counts)
      if (text.startsWith('Conferences') || /^\w+ \(\d+\/\d+\):/.test(text)) return;

      // 4. Note/disclaimer text
      if (text.startsWith('Note:') || text.startsWith('*')) return;

      // 5. Related links (starts with "A regularly" or similar)
      if (text.startsWith('A regularly') || text.startsWith('Brackets and schedules')) return;

      // 6. Gambling disclaimers
      if (text.includes('Gambling Problem') || text.includes('1-800')) return;

      // 7. On-campus teams listings (supplementary info, not tournaments)
      if (text.startsWith('On-campus teams:') || text.includes('On-campus teams:')) return;

      // 7b. Skip non-exempt tournaments (these are not MTEs)
      if (text.includes('(non-exempt)')) return;

      // 7c. Skip conference tournament listings (format: "Conference Name (date):")
      if (/^[A-Z][^(]*\(\d+\/\d+\):/.test(text)) return;

      // 7d. Skip footer/related article text about MTEs in general
      if (text.includes("list of the") && text.includes("season's exempt")) return;
      if (text.startsWith("A list of the") && text.includes("MTE")) return;

      // 8. Check for embedded multi-bracket tournaments (ESPN Events style and Acrisure Series style)
      // Format 1 (ESPN Events): "ESPN Events Invitational (Lake Buena Vista, Fla.)"
      //         "<strong>Adventure Bracket (Nov. 24–26, 3 games)</strong><br>teams..."
      // Format 2 (Acrisure): "Acrisure Series (Palm Desert, Calif.)"
      //         "<strong>Acrisure Classic (Nov. 25 and 26, 2 games)</strong><br>teams..."

      // First check if HTML contains embedded sub-tournaments with dates and game counts
      const embeddedTournamentPattern = /<strong>([^<]*\((?:Nov|Dec|Jan|Feb|Mar|Apr)[^<]*games?\))<\/strong>/gi;
      const embeddedTournamentMatches = html.match(embeddedTournamentPattern);

      if (embeddedTournamentMatches && embeddedTournamentMatches.length > 0) {
        // Check if text starts with a parent tournament (location only, no dates) at the beginning
        const parentPattern = /^([^(]+)\s*\(([^)]+)\)/;
        const parentMatch = text.match(parentPattern);

        if (parentMatch && !parentMatch[2].match(/\b(Nov|Dec|Jan|Feb|Mar|Apr)\b/)) {
          // This is a multi-bracket tournament with embedded sub-tournaments
          const parentName = parentMatch[1].trim();
          const parentLocation = parentMatch[2].trim();

          // Parse each embedded sub-tournament
          const htmlParts = html.split(/<strong>/i);

          for (let i = 1; i < htmlParts.length; i++) {
            const part = htmlParts[i];
            const bracketEndIndex = part.indexOf('</strong>');
            if (bracketEndIndex === -1) continue;

            const bracketHeader = part.substring(0, bracketEndIndex).trim();
            const teamsHtml = part.substring(bracketEndIndex + 9); // Skip </strong>

            // Extract sub-tournament name, dates, and game count
            // Format: "Adventure Bracket (Nov. 24–26, 3 games)" or "Acrisure Classic (Nov. 25 and 26, 2 games)"
            const bracketPattern = /^(.+?)\s*\(([^,]+),\s*(\d+)\s+games?(?:\s*\+\s*\d+\s+on-campus)?\)$/i;
            const bracketMatch = bracketHeader.match(bracketPattern);

            if (!bracketMatch) continue;

            const bracketName = bracketMatch[1].trim();
            const dateText = bracketMatch[2].trim();
            const gameCount = parseInt(bracketMatch[3]);

            try {
              sectionNumber++;

              // Parse dates
              const dates = parseDateRange(dateText, year);

              // Extract teams from the HTML after the bracket header
              const teamsText = teamsHtml
                .replace(/<br\s*\/?>/gi, ' ')
                .replace(/<[^>]+>/g, '')
                .trim();

              const teams = parseTeamsFromText(teamsText);

              tournaments.push({
                name: `${parentName} - ${bracketName}`,
                dates: {
                  start: dates.start,
                  end: dates.end,
                  raw: dateText,
                },
                location: parentLocation,
                teams,
                format: {
                  gameCount,
                  description: `${gameCount} games`,
                },
                brackets: undefined,
                metadata: {
                  sourceUrl,
                  parsedAt: new Date().toISOString(),
                  section: sectionNumber,
                  originalTournamentName: parentName,
                  bracket: bracketName,
                },
              });
            } catch (error) {
              errors.push({
                section: sectionNumber,
                error: error instanceof Error ? error.message : 'Unknown error',
                html: bracketHeader + ' | ' + teamsHtml.substring(0, 200),
              });
            }
          }

          return; // Successfully processed embedded brackets
        }
      }

      // 9. Parent event organizers (headers without dates, like "Acrisure Series (Palm Desert, Calif.)")
      // These are followed by actual tournament entries with dates
      if (/^[A-Z][^(]*\([^:]+\)\s*$/.test(text) && !text.match(/\b(Nov|Dec|Jan|Feb|Mar|Apr)\b/)) return;

      // Look for tournament pattern: Name followed by parentheses with date/location
      const tournamentPattern = /^([^(]+)\s*\(([^)]+)\)\s*(.*)$/;
      const match = text.match(tournamentPattern);

      if (!match) return;

      sectionNumber++;

      try {
        const [, rawName, dateLocationInfo, teamsText] = match;

        // Extract tournament name (clean up)
        let name = rawName.trim();

        let dateLocation;

        // Special case 1: Dates and game count in parentheses without location
        // e.g., "Acrisure Holiday Invitational" with dateLocationInfo = "Nov. 25 and 26, 2 games"
        const datesOnlyPattern = /^([^:]+),\s*(\d+)\s+games?(?:\s*\+\s*\d+\s+on-campus)?$/i;
        const datesOnlyMatch = dateLocationInfo.match(datesOnlyPattern);

        if (datesOnlyMatch) {
          // Format: "Nov. 25 and 26, 2 games" (no location, no colon)
          const dateText = datesOnlyMatch[1].trim();
          const gameCount = parseInt(datesOnlyMatch[2]);
          const dates = parseDateRange(dateText, year);

          dateLocation = {
            dates: {
              start: dates.start,
              end: dates.end,
              raw: dateText,
            },
            location: 'Palm Desert, Calif.', // Default location for Acrisure tournaments
            format: {
              gameCount,
              description: `${gameCount} games`,
            },
          };
        }
        // Special case 2: Tournament name includes dates and game count
        // e.g., "Acrisure Holiday Invitational (Nov. 25 and 26, 2 games)" as the NAME
        else {
          const titleWithDatesPattern = /^(.+?)\s+\((.*?,\s*\d+\s+games?)\)$/i;
          const titleMatch = name.match(titleWithDatesPattern);

          if (titleMatch) {
            // Dates are in the tournament name, location is in the info
            name = titleMatch[1].trim();
            const datesAndFormat = titleMatch[2];

            // Parse just the dates from "Nov. 25 and 26, 2 games"
            const dateMatch = datesAndFormat.match(/^(.*?),\s*(\d+)\s+games?/i);
            if (dateMatch) {
              const dateText = dateMatch[1];
              const gameCount = parseInt(dateMatch[2]);
              const dates = parseDateRange(dateText, year);

              dateLocation = {
                dates: {
                  start: dates.start,
                  end: dates.end,
                  raw: dateText,
                },
                location: dateLocationInfo, // The info is just the location
                format: {
                  gameCount,
                  description: `${gameCount} games`,
                },
              };
            } else {
              throw new Error(`Could not parse dates from title: ${datesAndFormat}`);
            }
          } else {
            // Normal format: dates and location in parentheses
            // Formats: "Nov. 20 and 22: Daytona Beach, Fla., 2 games"
            //          "November 20-22, 2024: Location, X games"
            dateLocation = parseDateLocationFormat(dateLocationInfo, year);
          }
        }

        if (!dateLocation.dates.start || !dateLocation.dates.end) {
          errors.push({
            section: sectionNumber,
            error: `Could not parse dates from: ${dateLocationInfo}`,
            html: $(element).html() || '',
          });
          return;
        }

        // Parse teams
        const teams = parseTeamsFromText(teamsText);

        // Extract unique bracket names
        const brackets = [...new Set(teams.map(t => t.bracket).filter(Boolean))];

        // If multi-bracket tournament, create separate tournament entries for each bracket
        if (brackets.length > 0) {
          for (const bracket of brackets) {
            const bracketTeams = teams.filter(t => t.bracket === bracket);
            tournaments.push({
              name: `${name} - ${bracket}`, // Append bracket name to tournament name
              dates: dateLocation.dates,
              location: dateLocation.location,
              teams: bracketTeams,
              format: {
                ...dateLocation.format,
                description: `${dateLocation.format.description} (${bracket})`,
              },
              brackets: undefined, // No longer needed since we split
              metadata: {
                sourceUrl,
                parsedAt: new Date().toISOString(),
                section: sectionNumber,
                originalTournamentName: name, // Store original name for reference
                bracket,
              },
            });
          }
        } else {
          // Single bracket tournament - store as-is
          tournaments.push({
            name,
            dates: dateLocation.dates,
            location: dateLocation.location,
            teams,
            format: dateLocation.format,
            brackets: undefined,
            metadata: {
              sourceUrl,
              parsedAt: new Date().toISOString(),
              section: sectionNumber,
            },
          });
        }
      } catch (error) {
        errors.push({
          section: sectionNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
          html: $(element).html() || '',
        });
      }
    });

    // If we found tournaments, stop trying other selectors
    if (tournaments.length > 0) break;
  }

  return {
    tournaments,
    errors,
    metadata: {
      totalTournaments: tournaments.length,
      parseDate: new Date().toISOString(),
      blogPostUrl: sourceUrl,
    },
  };
}

/**
 * Parse date and location from info string
 * Handles formats like:
 * - "Nov. 20 and 22: Daytona Beach, Fla., 2 games"
 * - "November 20-22, 2024: Location, 4 games"
 */
function parseDateLocationFormat(
  info: string,
  defaultYear: number,
): {
  dates: { start: string; end: string; raw: string };
  location: string;
  format: { gameCount: number; description: string };
} {
  // Special case: Multiple dates with different locations
  // Format: "Dec. 18: campus sites and Dec. 13: Oklahoma City, 2 games"
  const multiDateLocationPattern = /^([^:]+):\s*([^:]+)\s+and\s+([^:]+):\s*([^,]+),\s*(\d+)\s+games?/i;
  const multiMatch = info.match(multiDateLocationPattern);

  if (multiMatch) {
    const date1Text = multiMatch[1].trim();
    const location1 = multiMatch[2].trim();
    const date2Text = multiMatch[3].trim();
    const location2 = multiMatch[4].trim();
    const gameCount = parseInt(multiMatch[5]);

    // Parse both dates and use the range
    const date1 = parseDateRange(date1Text, defaultYear);
    const date2 = parseDateRange(date2Text, defaultYear);

    // Use the earlier date as start and later date as end
    const startDate = date1.start < date2.start ? date1.start : date2.start;
    const endDate = date1.end > date2.end ? date1.end : date2.end;

    // Use the more specific location (not "campus sites")
    const location = location1.toLowerCase().includes('campus') ? location2 : location1;

    return {
      dates: {
        start: startDate,
        end: endDate,
        raw: `${date1Text} and ${date2Text}`,
      },
      location,
      format: {
        gameCount,
        description: `${gameCount} games`,
      },
    };
  }

  // Normal format: Split on colon to separate date from location
  const parts = info.split(':');
  if (parts.length < 2) {
    throw new Error(`Invalid format - expected date: location, got: ${info}`);
  }

  const dateText = parts[0].trim();
  const locationAndFormat = parts.slice(1).join(':').trim();

  // Parse dates
  const dates = parseDateRange(dateText, defaultYear);

  // Parse location and format
  // Format: "Daytona Beach, Fla., 2 games"
  const locationMatch = locationAndFormat.match(/^([^,]+(?:,[^,]+)*),\s*(\d+)\s*games?/i);

  let location = 'TBD';
  let gameCount = 2; // Default
  let formatDescription = `${gameCount} games`;

  if (locationMatch) {
    location = locationMatch[1].trim();
    gameCount = parseInt(locationMatch[2]);
    formatDescription = `${gameCount} games`;
  } else {
    // Try without game count
    const simpleLocationMatch = locationAndFormat.match(/^([^,]+(?:,[^,]+)*)/);
    if (simpleLocationMatch) {
      location = simpleLocationMatch[1].trim();
    }
  }

  return {
    dates: {
      start: dates.start,
      end: dates.end,
      raw: dateText,
    },
    location,
    format: {
      gameCount,
      description: formatDescription,
    },
  };
}

/**
 * Parse date range from various formats
 */
function parseDateRange(
  dateText: string,
  year: number,
): {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
} {
  // Remove commas and normalize spacing
  // Also normalize en-dash (–) and em-dash (—) to regular hyphen (-)
  const cleaned = dateText
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-')
    .trim();

  // Extract year if present
  const yearMatch = cleaned.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1]);
  }

  // Month mapping
  const monthMap: { [key: string]: number } = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };

  // Format 1a: "Nov. 26, 28, and 29" (three non-contiguous dates)
  const threeAndFormat = cleaned.match(/(\w+)\.\s*(\d+)\s+(\d+)\s+and\s+(\d+)/i);
  if (threeAndFormat) {
    const monthName = threeAndFormat[1].toLowerCase();
    const month = monthMap[monthName];
    if (month !== undefined) {
      const day1 = parseInt(threeAndFormat[2]);
      const day3 = parseInt(threeAndFormat[4]);

      return {
        start: formatDate(year, month, day1),
        end: formatDate(year, month, day3),
      };
    }
  }

  // Format 1b: "Nov. 20 and 22" or "November 20 and 22"
  const andFormat = cleaned.match(/(\w+)\.\s*(\d+)\s+and\s+(\d+)/i);
  if (andFormat) {
    const monthName = andFormat[1].toLowerCase();
    const month = monthMap[monthName];
    if (month !== undefined) {
      const day1 = parseInt(andFormat[2]);
      const day2 = parseInt(andFormat[3]);

      return {
        start: formatDate(year, month, day1),
        end: formatDate(year, month, day2),
      };
    }
  }

  // Format 2: "Nov. 20-22" or "November 20-22"
  const rangeFormat = cleaned.match(/(\w+)\.\s*(\d+)-(\d+)/i);
  if (rangeFormat) {
    const monthName = rangeFormat[1].toLowerCase();
    const month = monthMap[monthName];
    if (month !== undefined) {
      const day1 = parseInt(rangeFormat[2]);
      const day2 = parseInt(rangeFormat[3]);

      return {
        start: formatDate(year, month, day1),
        end: formatDate(year, month, day2),
      };
    }
  }

  // Format 3: "November 20-22, 2024"
  const fullFormat = cleaned.match(/(\w+)\s+(\d+)-(\d+)/i);
  if (fullFormat) {
    const monthName = fullFormat[1].toLowerCase();
    const month = monthMap[monthName];
    if (month !== undefined) {
      const day1 = parseInt(fullFormat[2]);
      const day2 = parseInt(fullFormat[3]);

      return {
        start: formatDate(year, month, day1),
        end: formatDate(year, month, day2),
      };
    }
  }

  // Format 4: Single date "Dec. 18" or "December 18"
  const singleDateFormat = cleaned.match(/(\w+)\.?\s+(\d+)/i);
  if (singleDateFormat) {
    const monthName = singleDateFormat[1].toLowerCase();
    const month = monthMap[monthName];
    if (month !== undefined) {
      const day = parseInt(singleDateFormat[2]);

      return {
        start: formatDate(year, month, day),
        end: formatDate(year, month, day),
      };
    }
  }

  throw new Error(`Could not parse date range: ${dateText}`);
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(year: number, month: number, day: number): string {
  const yyyy = year.toString();
  const mm = (month + 1).toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse teams from text
 * Format: "Duke (ACC), North Carolina (ACC), Virginia (ACC)"
 * Also handles multi-bracket formats like:
 * "Palmetto Bracket: Clemson (ACC), Xavier (Big East) Lowcountry Bracket: Boston College (ACC)"
 */
function parseTeamsFromText(
  text: string,
): Array<{ name: string; conference: string; isTBD: boolean; bracket?: string }> {
  const teams: Array<{ name: string; conference: string; isTBD: boolean; bracket?: string }> = [];

  // First, split by bracket labels (e.g., "Palmetto Bracket:", "Lowcountry Bracket:")
  // This handles tournaments with multiple brackets
  const bracketPattern = /\b([A-Z][a-zA-Z\s]*Bracket):/g;
  const bracketSections: Array<{ bracket: string | null; text: string }> = [];

  let lastIndex = 0;
  let lastBracket: string | null = null;
  let match;

  while ((match = bracketPattern.exec(text)) !== null) {
    if (lastIndex < match.index) {
      // Add text before this bracket label
      const sectionText = text.substring(lastIndex, match.index).trim();
      if (sectionText) {
        bracketSections.push({ bracket: lastBracket, text: sectionText });
      }
    }
    // Update current bracket name
    lastBracket = match[1].trim();
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last bracket (or all text if no brackets found)
  const remainingText = text.substring(lastIndex).trim();
  if (remainingText) {
    bracketSections.push({ bracket: lastBracket, text: remainingText });
  }

  // If no brackets found, treat entire text as one section
  if (bracketSections.length === 0) {
    bracketSections.push({ bracket: null, text: text });
  }

  // Parse each section for teams
  for (const section of bracketSections) {
    // Match teams: team name followed by conference in parentheses (handles commas inside parens)
    // This correctly captures "Oregon State (WCC, associate)" as one team
    const parts = section.text.match(/[^,]+\([^)]+\)/g)?.map((s) => s.trim()) || [];

    for (const part of parts) {
      // Check for TBD
      if (/^tbd$/i.test(part)) {
        teams.push({
          name: 'TBD',
          conference: 'TBD',
          isTBD: true,
          bracket: section.bracket || undefined,
        });
        continue;
      }

      // Format: "Team Name (Conference)" or "Team Name (Conference, associate)"
      const teamMatch = part.match(/^(.+?)\s*\(([^,)]+)(?:,\s*[^)]+)?\)$/);
      if (teamMatch) {
        teams.push({
          name: teamMatch[1].trim(),
          conference: teamMatch[2].trim(),
          isTBD: false,
          bracket: section.bracket || undefined,
        });
      }
    }
  }

  return teams;
}
