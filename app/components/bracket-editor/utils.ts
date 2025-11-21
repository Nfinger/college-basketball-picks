import type { BracketPicks, ValidationResult } from './types';

export function createEmptyBracket(): BracketPicks {
  const regions = ['East', 'West', 'South', 'Midwest'];
  const emptyRegions: BracketPicks['regions'] = {};

  for (const region of regions) {
    emptyRegions[region] = {
      seeds: {}
    };
    for (let seed = 1; seed <= 16; seed++) {
      emptyRegions[region].seeds[seed] = {
        team_id: null,
        picked_at: new Date().toISOString()
      };
    }
  }

  return {
    version: 1,
    last_updated: new Date().toISOString(),
    regions: emptyRegions
  };
}

export function validateBracket(picks: BracketPicks): ValidationResult {
  const errors: string[] = [];
  const regions = ['East', 'West', 'South', 'Midwest'];

  for (const region of regions) {
    const seeds = picks.regions[region]?.seeds || {};
    const filledSeeds = Object.values(seeds).filter(s => s.team_id !== null).length;

    if (filledSeeds < 16) {
      errors.push(`${region} region: ${16 - filledSeeds} teams missing`);
    }
  }

  const allTeamIds: string[] = [];
  for (const region of regions) {
    const seeds = picks.regions[region]?.seeds || {};
    Object.values(seeds).forEach(s => {
      if (s.team_id) allTeamIds.push(s.team_id);
    });
  }

  const uniqueIds = new Set(allTeamIds);
  if (allTeamIds.length !== uniqueIds.size) {
    errors.push('Duplicate teams detected');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function getAllSelectedTeamIds(picks: BracketPicks): Set<string> {
  const teamIds = new Set<string>();
  const regions = ['East', 'West', 'South', 'Midwest'];

  for (const region of regions) {
    const seeds = picks.regions[region]?.seeds || {};
    Object.values(seeds).forEach(s => {
      if (s.team_id) teamIds.add(s.team_id);
    });
  }

  return teamIds;
}
