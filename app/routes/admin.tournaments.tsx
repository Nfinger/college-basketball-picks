import { data, type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { Form, useLoaderData, useNavigate } from 'react-router';
import { createSupabaseServerClient } from '~/lib/supabase.server';
import {
  getTournaments,
  createTournament,
  deleteTournament,
} from '~/lib/tournaments/queries.server';
import type { TournamentType, CreateTournamentInput } from '~/lib/tournaments/types';

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabase } = createSupabaseServerClient(request);

  // Check if user is authenticated (basic auth check)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const tournaments = await getTournaments(supabase);

  return data({ tournaments });
}

export async function action({ request }: ActionFunctionArgs) {
  const { supabase } = createSupabaseServerClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const action = formData.get('_action');

  if (action === 'create') {
    const name = formData.get('name') as string;
    const type = formData.get('type') as TournamentType;
    const year = parseInt(formData.get('year') as string);
    const start_date = formData.get('start_date') as string;
    const end_date = formData.get('end_date') as string;
    const location = formData.get('location') as string;
    const external_id = formData.get('external_id') as string;
    const external_source = formData.get('external_source') as string;

    // Build metadata based on tournament type
    let metadata = {};
    if (type === 'mte') {
      metadata = {
        format: formData.get('format') || 'single_elimination',
        team_count: parseInt(formData.get('team_count') as string) || 8,
      };
    } else if (type === 'conference') {
      metadata = {
        conference_id: formData.get('conference_id') as string,
        conference_name: formData.get('conference_name') as string,
        auto_bid: formData.get('auto_bid') === 'true',
        total_teams: parseInt(formData.get('total_teams') as string) || 0,
      };
    } else if (type === 'ncaa') {
      metadata = {
        regions: ['East', 'West', 'South', 'Midwest'],
        total_teams: 68,
      };
    }

    const input: CreateTournamentInput = {
      name,
      type,
      year,
      start_date,
      end_date,
      location: location || undefined,
      metadata,
      external_id: external_id || undefined,
      external_source: external_source || undefined,
    };

    await createTournament(supabase, input);

    return data({ success: true });
  }

  if (action === 'delete') {
    const tournamentId = formData.get('tournamentId') as string;
    await deleteTournament(supabase, tournamentId);
    return data({ success: true });
  }

  return data({ error: 'Invalid action' }, { status: 400 });
}

export default function AdminTournaments() {
  const { tournaments } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Tournament Management</h1>
        <p className="text-muted-foreground">Create and manage college basketball tournaments</p>
      </div>

      {/* Create Tournament Form */}
      <div className="bg-card rounded-lg border p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Create New Tournament</h2>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="_action" value="create" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Tournament Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full px-3 py-2 border rounded-md"
                placeholder="2024 Maui Invitational"
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium mb-1">
                Type *
              </label>
              <select
                id="type"
                name="type"
                required
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="mte">MTE (Multi-Team Event)</option>
                <option value="conference">Conference Tournament</option>
                <option value="ncaa">NCAA Tournament</option>
              </select>
            </div>

            <div>
              <label htmlFor="year" className="block text-sm font-medium mb-1">
                Year *
              </label>
              <input
                type="number"
                id="year"
                name="year"
                required
                defaultValue={new Date().getFullYear()}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium mb-1">
                Location
              </label>
              <input
                type="text"
                id="location"
                name="location"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Maui, HI"
              />
            </div>

            <div>
              <label htmlFor="start_date" className="block text-sm font-medium mb-1">
                Start Date *
              </label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label htmlFor="end_date" className="block text-sm font-medium mb-1">
                End Date *
              </label>
              <input
                type="date"
                id="end_date"
                name="end_date"
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label htmlFor="external_id" className="block text-sm font-medium mb-1">
                ESPN Tournament ID
              </label>
              <input
                type="text"
                id="external_id"
                name="external_id"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="45"
              />
            </div>

            <div>
              <label htmlFor="external_source" className="block text-sm font-medium mb-1">
                Data Source
              </label>
              <select
                id="external_source"
                name="external_source"
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Manual</option>
                <option value="espn">ESPN</option>
                <option value="ncaa">NCAA</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Create Tournament
            </button>
          </div>
        </Form>
      </div>

      {/* Tournaments List */}
      <div className="bg-card rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Existing Tournaments</h2>
        </div>
        <div className="divide-y">
          {tournaments.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No tournaments created yet. Create your first tournament above.
            </div>
          ) : (
            tournaments.map((tournament) => (
              <div key={tournament.id} className="p-4 hover:bg-muted/50 flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold">{tournament.name}</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {tournament.type.toUpperCase()}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        tournament.status === 'in_progress'
                          ? 'bg-green-100 text-green-800'
                          : tournament.status === 'upcoming'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {tournament.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      {tournament.year} • {new Date(tournament.start_date).toLocaleDateString()} -{' '}
                      {new Date(tournament.end_date).toLocaleDateString()}
                    </p>
                    {tournament.location && <p>📍 {tournament.location}</p>}
                    {tournament.external_id && (
                      <p className="text-xs">
                        External ID: {tournament.external_id} ({tournament.external_source})
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/tournaments/${tournament.id}`)}
                    className="px-3 py-1 text-sm border rounded-md hover:bg-muted"
                  >
                    View
                  </button>
                  <button
                    onClick={() => navigate(`/admin/tournaments/${tournament.id}/bracket`)}
                    className="px-3 py-1 text-sm border border-purple-200 text-purple-600 rounded-md hover:bg-purple-50"
                  >
                    Build Bracket
                  </button>
                  <button
                    onClick={() => navigate(`/admin/tournaments/${tournament.id}/import`)}
                    className="px-3 py-1 text-sm border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50"
                  >
                    Import Games
                  </button>
                  <Form method="post" className="inline">
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <button
                      type="submit"
                      className="px-3 py-1 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50"
                      onClick={(e) => {
                        if (!confirm('Are you sure you want to delete this tournament?')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Delete
                    </button>
                  </Form>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
