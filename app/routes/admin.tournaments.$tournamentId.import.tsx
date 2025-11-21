/**
 * Tournament Game Import UI
 *
 * Admin interface for importing games from ESPN into a tournament.
 * Supports:
 * - NCAA Tournament import
 * - Conference Tournament import
 * - MTE import
 * - Manual game association
 */

import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';
import { Form, useLoaderData, useNavigation, Link } from 'react-router';
import { useState } from 'react';
import { createSupabaseServerClient } from '~/lib/supabase.server';
import { getTournament } from '~/lib/tournaments/queries.server';
import {
  importNCAATournament,
  importConferenceTournament,
  importMTE,
  type ImportResult,
} from '~/lib/tournaments/game-importer';
import { getMatchSuggestions, type EspnTeamData } from '~/lib/tournaments/team-matcher';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const { tournamentId } = params;

  if (!tournamentId) {
    throw new Response('Tournament ID required', { status: 400 });
  }

  const tournament = await getTournament(supabase, tournamentId);

  return data({ tournament });
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
    if (action === 'import-ncaa') {
      const year = parseInt(formData.get('year') as string);
      const dryRun = formData.get('dry_run') === 'true';

      const result = await importNCAATournament(supabase, year, {
        updateExisting: true,
        dryRun,
      });

      return data({ result, type: 'ncaa' });
    }

    if (action === 'import-conference') {
      const conferenceId = formData.get('conference_id') as string;
      const conferenceName = formData.get('conference_name') as string;
      const year = parseInt(formData.get('year') as string);
      const startDate = formData.get('start_date') as string; // YYYY-MM-DD
      const endDate = formData.get('end_date') as string; // YYYY-MM-DD
      const dryRun = formData.get('dry_run') === 'true';

      // Convert to YYYYMMDD format
      const startDateFormatted = startDate.replace(/-/g, '');
      const endDateFormatted = endDate.replace(/-/g, '');

      const result = await importConferenceTournament(
        supabase,
        conferenceId,
        conferenceName,
        year,
        startDateFormatted,
        endDateFormatted,
        {
          updateExisting: true,
          dryRun,
        },
      );

      return data({ result, type: 'conference' });
    }

    if (action === 'import-mte') {
      const eventName = formData.get('event_name') as string;
      const year = parseInt(formData.get('year') as string);
      const startDate = formData.get('start_date') as string;
      const endDate = formData.get('end_date') as string;
      const location = formData.get('location') as string;
      const dryRun = formData.get('dry_run') === 'true';

      const startDateFormatted = startDate.replace(/-/g, '');
      const endDateFormatted = endDate.replace(/-/g, '');

      const result = await importMTE(supabase, eventName, year, startDateFormatted, endDateFormatted, location, {
        updateExisting: true,
        dryRun,
      });

      return data({ result, type: 'mte' });
    }

    return data({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export default function TournamentImport() {
  const { tournament } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [showDryRunWarning, setShowDryRunWarning] = useState(true);

  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link to={`/admin/tournaments`} className="text-sm text-muted-foreground hover:underline mb-2 inline-block">
          ← Back to Tournaments
        </Link>
        <h1 className="text-3xl font-bold mb-2">Import Games</h1>
        <p className="text-muted-foreground">
          Import games from ESPN for: <span className="font-semibold">{tournament.name}</span>
        </p>
      </div>

      {/* Dry Run Warning */}
      {showDryRunWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 mb-1">Test First with Dry Run</h3>
              <p className="text-sm text-yellow-800 mb-2">
                It's recommended to run a dry run first to see what games would be imported and identify any team matching
                issues.
              </p>
              <button
                onClick={() => setShowDryRunWarning(false)}
                className="text-sm text-yellow-900 underline hover:no-underline"
              >
                Got it, dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Forms */}
      <div className="space-y-6">
        {/* NCAA Tournament Import */}
        {tournament.type === 'ncaa' && (
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Import NCAA Tournament Games</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Automatically fetch all NCAA tournament games from ESPN for {tournament.year}.
            </p>

            <Form method="post" className="space-y-4">
              <input type="hidden" name="_action" value="import-ncaa" />
              <input type="hidden" name="year" value={tournament.year} />

              <div className="flex items-center gap-2">
                <input type="checkbox" name="dry_run" value="true" id="ncaa-dry-run" defaultChecked />
                <label htmlFor="ncaa-dry-run" className="text-sm">
                  Dry run (preview without saving)
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Importing...' : 'Import NCAA Games'}
              </button>
            </Form>
          </div>
        )}

        {/* Conference Tournament Import */}
        {tournament.type === 'conference' && (
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Import Conference Tournament Games</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Fetch conference tournament games from ESPN for the specified date range.
            </p>

            <Form method="post" className="space-y-4">
              <input type="hidden" name="_action" value="import-conference" />
              <input type="hidden" name="year" value={tournament.year} />

              <div>
                <label className="block text-sm font-medium mb-1">Conference ID</label>
                <input
                  type="text"
                  name="conference_id"
                  defaultValue={tournament.metadata?.conference_id || ''}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., 5 for Big Ten"
                />
                <p className="text-xs text-muted-foreground mt-1">ESPN conference ID</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Conference Name</label>
                <input
                  type="text"
                  name="conference_name"
                  defaultValue={tournament.metadata?.conference_name || ''}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., Big Ten"
                />
              </div>

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
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    name="end_date"
                    defaultValue={tournament.end_date}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" name="dry_run" value="true" id="conf-dry-run" defaultChecked />
                <label htmlFor="conf-dry-run" className="text-sm">
                  Dry run (preview without saving)
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Importing...' : 'Import Conference Games'}
              </button>
            </Form>
          </div>
        )}

        {/* MTE Import */}
        {tournament.type === 'mte' && (
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Import MTE Games</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Fetch Multi-Team Event games from ESPN by event name and date range.
            </p>

            <Form method="post" className="space-y-4">
              <input type="hidden" name="_action" value="import-mte" />
              <input type="hidden" name="year" value={tournament.year} />

              <div>
                <label className="block text-sm font-medium mb-1">Event Name</label>
                <input
                  type="text"
                  name="event_name"
                  defaultValue={tournament.name}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., Maui Invitational"
                />
                <p className="text-xs text-muted-foreground mt-1">As it appears on ESPN</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Location (optional)</label>
                <input
                  type="text"
                  name="location"
                  defaultValue={tournament.location || ''}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., Maui, HI"
                />
              </div>

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
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    name="end_date"
                    defaultValue={tournament.end_date}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" name="dry_run" value="true" id="mte-dry-run" defaultChecked />
                <label htmlFor="mte-dry-run" className="text-sm">
                  Dry run (preview without saving)
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Importing...' : 'Import MTE Games'}
              </button>
            </Form>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-muted/50 rounded-lg p-6">
        <h3 className="font-semibold mb-2">How Import Works</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span>1.</span>
            <span>Fetches games from ESPN API for the specified tournament/dates</span>
          </li>
          <li className="flex gap-2">
            <span>2.</span>
            <span>Matches ESPN team names to your database teams using fuzzy matching</span>
          </li>
          <li className="flex gap-2">
            <span>3.</span>
            <span>Creates new games or updates existing games based on external_id</span>
          </li>
          <li className="flex gap-2">
            <span>4.</span>
            <span>Reports any teams that couldn't be matched for manual review</span>
          </li>
        </ul>

        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-medium mb-2">Troubleshooting</p>
          <p className="text-sm text-muted-foreground">
            If games don't import or teams don't match correctly, check that your teams table has accurate names and
            abbreviations. You can also manually add espn_id to teams for exact matching.
          </p>
        </div>
      </div>
    </div>
  );
}
