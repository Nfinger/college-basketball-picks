import type { SupabaseClient } from '@supabase/supabase-js';
import type { BracketPicks } from '~/components/bracket-editor';

export async function getCurrentSeasonTournament(supabase: SupabaseClient) {
  const currentYear = new Date().getFullYear();

  // Look for NCAA tournament for current or next year
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('type', 'ncaa')
    .gte('year', currentYear)
    .order('year', { ascending: true })
    .limit(1);

  if (error) {
    console.error('Error fetching current tournament:', error);
    return null;
  }

  // If no tournament exists, create a placeholder
  if (!tournaments || tournaments.length === 0) {
    const { data: newTournament, error: createError } = await supabase
      .from('tournaments')
      .insert({
        name: `${currentYear + 1} NCAA Tournament - Pre-Season Predictions`,
        type: 'ncaa',
        year: currentYear + 1,
        status: 'upcoming',
        start_date: `${currentYear + 1}-03-18`,
        end_date: `${currentYear + 1}-04-08`,
        location: 'Various',
        metadata: {
          regions: ['East', 'West', 'South', 'Midwest'],
          description: 'Season-long bracket predictions'
        }
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating tournament:', createError);
      return null;
    }

    return newTournament;
  }

  return tournaments[0];
}

export async function getUserBracketPicks(
  supabase: SupabaseClient,
  userId: string,
  tournamentId: string
): Promise<BracketPicks | null> {
  const { data, error } = await supabase
    .from('bracket_picks')
    .select('picks')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .single();

  if (error) {
    // No bracket yet, return null
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching bracket picks:', error);
    return null;
  }

  return data?.picks as BracketPicks || null;
}

export async function saveBracketPicks(
  supabase: SupabaseClient,
  userId: string,
  tournamentId: string,
  picks: BracketPicks
): Promise<{ success: boolean; error?: string }> {
  // Update champion_team_id if all regions are complete
  let championTeamId: string | null = null;

  // Check if bracket is complete
  const regions = ['East', 'West', 'South', 'Midwest'];
  let totalPicked = 0;
  for (const region of regions) {
    const seeds = picks.regions[region]?.seeds || {};
    totalPicked += Object.values(seeds).filter(s => s.team_id !== null).length;
  }

  // If bracket is complete (64 teams), could set champion (for now, leave null)
  // This will be implemented in Phase 2 when game predictions are added

  const { error } = await supabase
    .from('bracket_picks')
    .upsert({
      user_id: userId,
      tournament_id: tournamentId,
      picks: picks as any,
      champion_team_id: championTeamId,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,tournament_id'
    });

  if (error) {
    console.error('Error saving bracket picks:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getAllTeams(supabase: SupabaseClient) {
  const { data: teams, error } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      short_name,
      conference:conferences(
        id,
        name,
        short_name,
        is_power_conference
      )
    `)
    .order('name');

  if (error) {
    console.error('Error fetching teams:', error);
    return [];
  }

  // Transform the data to flatten the conference array
  return (teams || []).map((team: any) => ({
    ...team,
    conference: Array.isArray(team.conference)
      ? team.conference[0]
      : team.conference
  }));
}
