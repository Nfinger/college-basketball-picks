/**
 * Tournament Bracket Builder - Admin UI
 *
 * Allows admins to:
 * - Create first-round matchups from tournament teams
 * - Set game dates/times for each matchup
 * - Define bracket structure (regions/pods for multi-bracket tournaments)
 */

import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';
import { Form, useLoaderData, useNavigation, Link, useFetcher } from 'react-router';
import { useState } from 'react';
import { createSupabaseServerClient } from '~/lib/supabase.server';
import { getTournament } from '~/lib/tournaments/queries.server';

interface Team {
  id: string;
  name: string;
  short_name: string;
  seed?: number;
  region?: string;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const { tournamentId } = params;

  if (!tournamentId) {
    throw new Response('Tournament ID required', { status: 400 });
  }

  const tournament = await getTournament(supabase, tournamentId);

  // Get tournament teams
  const { data: tournamentTeams } = await supabase
    .from('tournament_teams')
    .select(`
      id,
      seed,
      region,
      team:teams(id, name, short_name)
    `)
    .eq('tournament_id', tournamentId)
    .order('seed', { ascending: true, nullsFirst: false });

  // Get existing games
  const { data: games } = await supabase
    .from('games')
    .select(`
      id,
      game_date,
      tournament_round,
      tournament_metadata,
      home_team:teams!games_home_team_id_fkey(id, name, short_name),
      away_team:teams!games_away_team_id_fkey(id, name, short_name)
    `)
    .eq('tournament_id', tournamentId)
    .order('game_date', { ascending: true });

  const teams = tournamentTeams?.map((tt: any) => ({
    id: tt.team.id,
    name: tt.team.name,
    short_name: tt.team.short_name,
    seed: tt.seed,
    region: tt.region,
  })) || [];

  return data({ tournament, teams, games: games || [] });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const { tournamentId } = params;

  if (!tournamentId) {
    throw new Response('Tournament ID required', { status: 400 });
  }

  const formData = await request.formData();
  const action = formData.get('_action') as string;

  try {
    if (action === 'upload-bracket-image') {
      const imageFile = formData.get('bracket_image') as File;
      const defaultDate = formData.get('default_date') as string;
      const defaultTime = formData.get('default_time') as string;

      if (!imageFile || imageFile.size === 0) {
        throw new Error('No image file provided');
      }

      console.log('Processing bracket image:', imageFile.name, imageFile.type);

      // Convert image to base64
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Image = buffer.toString('base64');
      const mimeType = imageFile.type;

      // Get available teams for matching
      const { data: tournamentTeams } = await supabase
        .from('tournament_teams')
        .select('team:teams(id, name, short_name)')
        .eq('tournament_id', tournamentId);

      const teamsList = tournamentTeams?.map((tt: any) => ({
        id: tt.team.id,
        name: tt.team.name,
        shortName: tt.team.short_name,
      })) || [];

      // Use Claude to extract matchups from the image
      const prompt = `Analyze this tournament bracket image and extract all the matchups.

Available teams in this tournament:
${teamsList.map(t => `- ${t.name} (short: ${t.shortName})`).join('\n')}

For each matchup you find, identify the two teams playing against each other. Match team names from the image to the available teams list above (be flexible with abbreviations and short names).

Return ONLY a JSON array of matchups in this exact format:
[
  {
    "homeTeam": "Full Team Name",
    "awayTeam": "Full Team Name"
  }
]

Rules:
1. Only include first-round matchups (the initial games, not semifinal or final games)
2. Use the exact team names from the available teams list
3. If you can't confidently match a team name, skip that matchup
4. Return ONLY the JSON array, no other text`;

      const anthropic = await import('@anthropic-ai/sdk');
      const client = new anthropic.default({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      // Extract JSON from response
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('AI Response:', responseText);

      // Parse JSON (handle markdown code blocks)
      let matchupsData: Array<{ homeTeam: string; awayTeam: string }> = [];
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        matchupsData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not extract matchups from AI response');
      }

      console.log(`Extracted ${matchupsData.length} matchups from image`);

      // Match team names to IDs and create games
      const gameDatetime = `${defaultDate}T${defaultTime}:00`;
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('metadata')
        .eq('id', tournamentId)
        .single();

      const matchups = [];
      const errors = [];

      for (const matchup of matchupsData) {
        // Find team IDs
        const homeTeam = teamsList.find(
          t => t.name.toLowerCase() === matchup.homeTeam.toLowerCase() ||
               t.shortName.toLowerCase() === matchup.homeTeam.toLowerCase()
        );
        const awayTeam = teamsList.find(
          t => t.name.toLowerCase() === matchup.awayTeam.toLowerCase() ||
               t.shortName.toLowerCase() === matchup.awayTeam.toLowerCase()
        );

        if (homeTeam && awayTeam) {
          matchups.push({
            tournament_id: tournamentId,
            home_team_id: homeTeam.id,
            away_team_id: awayTeam.id,
            game_date: gameDatetime,
            tournament_round: 'first_round',
            tournament_metadata: {},
            status: 'scheduled',
            conference_id: tournamentData?.metadata?.conference_id || null,
          });
        } else {
          errors.push(`Could not match teams: ${matchup.homeTeam} vs ${matchup.awayTeam}`);
        }
      }

      if (matchups.length === 0) {
        throw new Error('No valid matchups found. ' + errors.join(', '));
      }

      // Insert all matchups
      const { error } = await supabase.from('games').insert(matchups);

      if (error) {
        console.error('Error inserting matchups:', error);
        throw error;
      }

      console.log(`Successfully created ${matchups.length} matchups`);
      if (errors.length > 0) {
        console.warn('Some matchups could not be created:', errors);
      }

      return data({
        success: true,
        created: matchups.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    if (action === 'create-matchup') {
      const homeTeamId = formData.get('home_team_id') as string;
      const awayTeamId = formData.get('away_team_id') as string;
      const gameDate = formData.get('game_date') as string;
      const gameTime = formData.get('game_time') as string;
      const round = formData.get('round') as string || 'first_round';
      const region = formData.get('region') as string || null;

      console.log('Creating matchup:', {
        homeTeamId,
        awayTeamId,
        gameDate,
        gameTime,
      });

      // Combine date and time
      const gameDatetime = `${gameDate}T${gameTime}:00`;

      // Get the tournament to find conference_id (tournaments are typically associated with a conference or neutral)
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('metadata')
        .eq('id', tournamentId)
        .single();

      const { error } = await supabase.from('games').insert({
        tournament_id: tournamentId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        game_date: gameDatetime,
        tournament_round: round,
        tournament_metadata: region ? { region } : {},
        status: 'scheduled',
        conference_id: tournamentData?.metadata?.conference_id || null, // Use tournament conference or null for neutral site
      });

      if (error) {
        console.error('Error creating matchup:', error);
        throw error;
      }

      console.log('Matchup created successfully');
      return data({ success: true });
    }

    if (action === 'delete-matchup') {
      const gameId = formData.get('game_id') as string;

      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (error) throw error;

      return data({ success: true });
    }

    if (action === 'generate-standard-bracket') {
      const teams = JSON.parse(formData.get('teams') as string);
      const startDate = formData.get('start_date') as string;
      const startTime = formData.get('start_time') as string;
      const gapMinutes = parseInt(formData.get('gap_minutes') as string || '150');

      // Generate standard 4-team bracket matchups (1v3, 2v4)
      const matchups: Array<{
        home_team_id: string;
        away_team_id: string;
        game_date: string;
      }> = [];

      let currentDate = new Date(`${startDate}T${startTime}:00`);

      // For every 4 teams, create two matchups
      for (let i = 0; i < teams.length; i += 4) {
        const bracket = teams.slice(i, i + 4);

        if (bracket.length === 4) {
          // Game 1: Team 1 vs Team 3 (indices 0 vs 2)
          matchups.push({
            home_team_id: bracket[0].id,
            away_team_id: bracket[2].id,
            game_date: currentDate.toISOString(),
          });

          // Advance time for next game
          currentDate = new Date(currentDate.getTime() + gapMinutes * 60 * 1000);

          // Game 2: Team 2 vs Team 4 (indices 1 vs 3)
          matchups.push({
            home_team_id: bracket[1].id,
            away_team_id: bracket[3].id,
            game_date: currentDate.toISOString(),
          });

          // Advance time for next bracket
          currentDate = new Date(currentDate.getTime() + gapMinutes * 60 * 1000);
        }
      }

      // Insert all matchups
      const { error } = await supabase.from('games').insert(
        matchups.map((m) => ({
          ...m,
          tournament_id: tournamentId,
          tournament_round: 'first_round',
          status: 'scheduled',
        }))
      );

      if (error) throw error;

      return data({ success: true, created: matchups.length });
    }

    return data({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export default function TournamentBracketBuilder() {
  const { tournament, teams, games } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const [selectedTeams, setSelectedTeams] = useState<{ home?: Team; away?: Team }>({});

  const isSubmitting = navigation.state === 'submitting' || fetcher.state === 'submitting';

  const availableTeams = teams.filter(
    (t: Team) => !games.some((g: any) =>
      g.home_team?.id === t.id || g.away_team?.id === t.id
    )
  );

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/admin/tournaments`}
          className="text-sm text-muted-foreground hover:underline mb-2 inline-block"
        >
          ← Back to Tournaments
        </Link>
        <h1 className="text-3xl font-bold mb-2">Bracket Builder</h1>
        <p className="text-muted-foreground">
          Create first-round matchups for: <span className="font-semibold">{tournament.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Team Pool & Manual Creation */}
        <div className="space-y-6">
          {/* Image Upload for AI Bracket Creation */}
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Upload Bracket Image</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a screenshot or image of the bracket and AI will extract the matchups automatically.
            </p>

            <Form method="post" encType="multipart/form-data" className="space-y-4">
              <input type="hidden" name="_action" value="upload-bracket-image" />

              <div>
                <label className="block text-sm font-medium mb-1">Bracket Image</label>
                <input
                  type="file"
                  name="bracket_image"
                  accept="image/*"
                  required
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Accepted formats: JPG, PNG, WebP
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Default Game Date</label>
                  <input
                    type="date"
                    name="default_date"
                    defaultValue={tournament.start_date}
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Default Game Time</label>
                  <input
                    type="time"
                    name="default_time"
                    defaultValue="18:00"
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Processing Image...' : 'Upload & Extract Matchups'}
              </button>
            </Form>
          </div>

          {/* Manual Matchup Creation */}
          {availableTeams.length >= 2 && (
            <div className="bg-card rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4">Create Matchup Manually</h2>

              <Form method="post" className="space-y-4">
                <input type="hidden" name="_action" value="create-matchup" />

                <div>
                  <label className="block text-sm font-medium mb-1">Home Team</label>
                  <select
                    name="home_team_id"
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="">Select team...</option>
                    {availableTeams.map((team: Team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Away Team</label>
                  <select
                    name="away_team_id"
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="">Select team...</option>
                    {availableTeams.map((team: Team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Game Date</label>
                    <input
                      type="date"
                      name="game_date"
                      defaultValue={tournament.start_date}
                      required
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Game Time</label>
                    <input
                      type="time"
                      name="game_time"
                      defaultValue="18:00"
                      required
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Matchup'}
                </button>
              </Form>
            </div>
          )}

          {/* Available Teams */}
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">
              Available Teams ({availableTeams.length})
            </h2>

            {availableTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All teams have been assigned to matchups
              </p>
            ) : (
              <div className="space-y-2">
                {availableTeams.map((team: Team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded"
                  >
                    <div>
                      <div className="font-medium">{team.name}</div>
                      {team.region && (
                        <div className="text-xs text-muted-foreground">{team.region}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generate Standard Bracket */}
          {availableTeams.length >= 4 && (
            <div className="bg-card rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4">Generate Standard Bracket</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Auto-generate matchups using standard bracket format (1v3, 2v4) for every 4 teams.
              </p>

              <Form method="post" className="space-y-4">
                <input type="hidden" name="_action" value="generate-standard-bracket" />
                <input type="hidden" name="teams" value={JSON.stringify(availableTeams)} />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Date</label>
                    <input
                      type="date"
                      name="start_date"
                      defaultValue={tournament.start_date}
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Start Time</label>
                    <input
                      type="time"
                      name="start_time"
                      defaultValue="18:00"
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Time Between Games (minutes)
                  </label>
                  <input
                    type="number"
                    name="gap_minutes"
                    defaultValue="150"
                    required
                    min="30"
                    step="15"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Typical: 150 minutes (2.5 hours)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Generating...' : `Generate ${Math.floor(availableTeams.length / 4) * 2} Matchups`}
                </button>
              </Form>
            </div>
          )}
        </div>

        {/* Right Column: Existing Matchups */}
        <div>
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">
              Created Matchups ({games.length})
            </h2>

            {games.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No matchups created yet. Use the form or quick generate to create bracket matchups.
              </p>
            ) : (
              <div className="space-y-3">
                {games.map((game: any) => (
                  <div key={game.id} className="p-4 bg-muted/50 rounded">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium">
                          {game.home_team.name} vs {game.away_team.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(game.game_date).toLocaleString()}
                        </div>
                        {game.tournament_metadata?.region && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {game.tournament_metadata.region}
                          </div>
                        )}
                      </div>

                      <fetcher.Form method="post">
                        <input type="hidden" name="_action" value="delete-matchup" />
                        <input type="hidden" name="game_id" value={game.id} />
                        <button
                          type="submit"
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </fetcher.Form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
