/**
 * Team Name Matching Utility
 *
 * Matches ESPN team names/IDs to our internal team database.
 * Uses fuzzy matching to handle variations like:
 * - "North Carolina" vs "UNC" vs "North Carolina Tar Heels"
 * - "Connecticut" vs "UConn" vs "Connecticut Huskies"
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Team from our database
 */
interface DbTeam {
  id: string;
  name: string;
  short_name?: string;
  external_id?: string;
}

/**
 * ESPN team data from API
 */
export interface EspnTeamData {
  id: string;
  name: string;
  abbreviation: string;
}

/**
 * Simple string similarity using Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio (0-1, higher is more similar)
 */
function similarityRatio(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

/**
 * Normalize team name for matching
 * Strips common university/college words to improve matching
 */
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\buniversity of\b/g, '') // Remove "university of"
    .replace(/\buniversity\b/g, '') // Remove "university"
    .replace(/\bcollege\b/g, '') // Remove "college"
    .replace(/\bstate\b/g, '') // Remove "state"
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Calculate match score between ESPN/NCAA team and DB team
 */
function calculateMatchScore(espnTeam: EspnTeamData, dbTeam: DbTeam): number {
  let score = 0;

  // Exact external ID match (highest priority)
  if (dbTeam.external_id === espnTeam.id) {
    return 1.0;
  }

  const espnNormalized = normalizeTeamName(espnTeam.name);
  const espnAbbrev = normalizeTeamName(espnTeam.abbreviation || espnTeam.name);

  // Check against DB team name
  const dbNameNormalized = normalizeTeamName(dbTeam.name);
  const nameScore = similarityRatio(espnNormalized, dbNameNormalized);
  score = Math.max(score, nameScore);

  // Check against DB short name
  if (dbTeam.short_name) {
    const shortNameNormalized = normalizeTeamName(dbTeam.short_name);
    const shortNameScore = similarityRatio(espnNormalized, shortNameNormalized);
    score = Math.max(score, shortNameScore);

    // Also check if ESPN abbrev matches DB short name
    const abbrevShortScore = similarityRatio(espnAbbrev, shortNameNormalized);
    score = Math.max(score, abbrevShortScore);
  }

  // Check against DB abbreviation
  if (dbTeam.abbreviation) {
    const dbAbbrevNormalized = normalizeTeamName(dbTeam.abbreviation);
    const abbrevScore = similarityRatio(espnAbbrev, dbAbbrevNormalized);
    score = Math.max(score, abbrevScore);
  }

  // Bonus for containing the same words
  const espnWords = espnNormalized.split(' ');
  const dbWords = dbNameNormalized.split(' ');
  const commonWords = espnWords.filter((word) => dbWords.includes(word) && word.length > 2);
  if (commonWords.length > 0) {
    score += 0.1 * commonWords.length;
  }

  return Math.min(score, 1.0);
}

/**
 * Match ESPN team to database team
 */
export async function matchTeam(
  supabase: SupabaseClient,
  espnTeam: EspnTeamData,
  threshold: number = 0.75,
): Promise<{ teamId: string; confidence: number } | null> {
  // First, try to find by external ID (ESPN/NCAA) if we've cached it
  const { data: exactMatch } = await supabase
    .from('teams')
    .select('id')
    .eq('external_id', espnTeam.id)
    .single();

  if (exactMatch) {
    return { teamId: exactMatch.id, confidence: 1.0 };
  }

  // Fetch all teams
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, short_name, external_id');

  if (error || !teams) {
    throw new Error(`Failed to fetch teams: ${error?.message}`);
  }

  // Calculate match scores
  const scores = teams.map((team) => ({
    teamId: team.id,
    score: calculateMatchScore(espnTeam, team),
  }));

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const bestMatch = scores[0];

  // Only return if confidence is above threshold
  if (bestMatch && bestMatch.score >= threshold) {
    return { teamId: bestMatch.teamId, confidence: bestMatch.score };
  }

  return null;
}

/**
 * Match multiple ESPN teams in batch
 */
export async function matchTeams(
  supabase: SupabaseClient,
  espnTeams: EspnTeamData[],
  threshold: number = 0.75,
): Promise<Map<string, { teamId: string; confidence: number }>> {
  const matches = new Map<string, { teamId: string; confidence: number }>();

  for (const espnTeam of espnTeams) {
    const match = await matchTeam(supabase, espnTeam, threshold);
    if (match) {
      matches.set(espnTeam.id, match);
    }
  }

  return matches;
}

/**
 * Save external team ID (ESPN/NCAA) to database for future lookups
 */
export async function saveEspnTeamId(
  supabase: SupabaseClient,
  teamId: string,
  espnId: string,
): Promise<void> {
  const { error } = await supabase.from('teams').update({ external_id: espnId }).eq('id', teamId);

  if (error) {
    throw new Error(`Failed to save external team ID: ${error.message}`);
  }
}

/**
 * Interactive team matching (for manual review)
 */
export interface MatchSuggestion {
  espnTeam: EspnTeamData;
  suggestions: Array<{
    teamId: string;
    teamName: string;
    confidence: number;
  }>;
}

/**
 * Get match suggestions for manual review
 */
export async function getMatchSuggestions(
  supabase: SupabaseClient,
  espnTeams: EspnTeamData[],
  topN: number = 3,
): Promise<MatchSuggestion[]> {
  const suggestions: MatchSuggestion[] = [];

  // Fetch all teams once
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, short_name, abbreviation, espn_id');

  if (error || !teams) {
    throw new Error(`Failed to fetch teams: ${error?.message}`);
  }

  for (const espnTeam of espnTeams) {
    // Skip if already matched by ESPN ID
    const exactMatch = teams.find((t) => t.espn_id === espnTeam.id);
    if (exactMatch) continue;

    // Calculate scores for all teams
    const scores = teams
      .map((team) => ({
        teamId: team.id,
        teamName: team.name,
        confidence: calculateMatchScore(espnTeam, team),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topN);

    suggestions.push({
      espnTeam,
      suggestions: scores,
    });
  }

  return suggestions;
}
