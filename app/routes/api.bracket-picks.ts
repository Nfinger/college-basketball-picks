import { data, type ActionFunctionArgs } from 'react-router';
import { createSupabaseServerClient } from '~/lib/supabase.server';

export async function action({ request }: ActionFunctionArgs) {
  const { supabase } = createSupabaseServerClient(request);

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return data({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tournamentId, gameId, winnerTeamId } = body;

    if (!tournamentId || !gameId || !winnerTeamId) {
      return data({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get or create bracket_picks record for this user/tournament
    const { data: existingPicks, error: selectError } = await supabase
      .from('bracket_picks')
      .select('id, picks, champion_team_id')
      .eq('user_id', user.id)
      .eq('tournament_id', tournamentId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, we'll create it
      throw selectError;
    }

    // Update or create the picks
    const currentPicks = existingPicks?.picks || {};
    const updatedPicks = {
      ...currentPicks,
      [gameId]: {
        winner_team_id: winnerTeamId,
        picked_at: new Date().toISOString(),
      },
    };

    if (existingPicks) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('bracket_picks')
        .update({
          picks: updatedPicks,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPicks.id);

      if (updateError) throw updateError;
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from('bracket_picks')
        .insert({
          user_id: user.id,
          tournament_id: tournamentId,
          picks: updatedPicks,
        });

      if (insertError) throw insertError;
    }

    return data({ success: true, picks: updatedPicks });
  } catch (error) {
    console.error('Error saving bracket pick:', error);
    return data(
      { error: error instanceof Error ? error.message : 'Failed to save bracket pick' },
      { status: 500 }
    );
  }
}
