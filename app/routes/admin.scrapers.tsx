import { useLoaderData } from 'react-router'
import type { Route } from './+types/admin.scrapers'
import { createClient } from '@supabase/supabase-js'
import { formatDistanceToNow } from 'date-fns'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function loader({ request }: Route.LoaderArgs) {
  // Fetch latest scraper runs
  const { data: latestRuns, error: latestError } = await supabase
    .from('latest_scraper_runs')
    .select('*')
    .order('started_at', { ascending: false })

  // Fetch recent run history
  const { data: recentRuns, error: recentError } = await supabase
    .from('scraper_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  // Calculate summary statistics
  const { data: failureCount } = await supabase
    .from('scraper_runs')
    .select('id', { count: 'exact' })
    .eq('status', 'failure')
    .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  return {
    latestRuns: latestRuns || [],
    recentRuns: recentRuns || [],
    failuresLast24h: failureCount || 0,
    error: latestError || recentError
  }
}

export default function ScraperDashboard() {
  const { latestRuns, recentRuns, failuresLast24h } = useLoaderData<typeof loader>()

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Scraper Health Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-gray-600">Total Scrapers</div>
          <div className="text-2xl font-bold">{latestRuns.length}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-gray-600">Failures (24h)</div>
          <div className="text-2xl font-bold text-red-600">
            {typeof failuresLast24h === 'number' ? failuresLast24h : 0}
          </div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-gray-600">Success Rate</div>
          <div className="text-2xl font-bold text-green-600">
            {recentRuns.length > 0
              ? Math.round(
                  ((recentRuns.filter(r => r.status === 'success').length) / recentRuns.length) * 100
                )
              : 0}%
          </div>
        </div>
      </div>

      {/* Latest Runs by Source */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Latest Runs by Source</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {latestRuns.map((run: any) => (
            <ScraperCard key={`${run.source}-${run.job_type}`} run={run} />
          ))}
        </div>
      </div>

      {/* Recent Run History */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Run History</h2>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Source</th>
                <th className="px-4 py-2 text-left">Job Type</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Records</th>
                <th className="px-4 py-2 text-left">Duration</th>
                <th className="px-4 py-2 text-left">Started</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run: any) => (
                <RunRow key={run.id} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ScraperCard({ run }: { run: any }) {
  const isStale = run.started_at &&
    new Date().getTime() - new Date(run.started_at).getTime() > 4 * 60 * 60 * 1000 // 4 hours

  const statusColors: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    failure: 'bg-red-100 text-red-800',
    running: 'bg-blue-100 text-blue-800',
    partial: 'bg-yellow-100 text-yellow-800'
  }
  const statusColor = statusColors[run.status] || 'bg-gray-100 text-gray-800'

  return (
    <div className={`p-4 border rounded-lg ${isStale ? 'border-yellow-500' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">{run.source}</div>
        <div className={`px-2 py-1 rounded text-xs ${statusColor}`}>
          {run.status}
        </div>
      </div>
      <div className="text-sm text-gray-600 mb-1">{run.job_type}</div>
      <div className="text-sm">
        <div>Records: {run.records_processed || 0}</div>
        <div>Duration: {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : 'N/A'}</div>
        <div className="text-xs text-gray-500 mt-1">
          {run.started_at ? formatDistanceToNow(new Date(run.started_at), { addSuffix: true }) : 'Never'}
        </div>
      </div>
      {isStale && (
        <div className="mt-2 text-xs text-yellow-700 font-medium">
          ⚠️ Data may be stale
        </div>
      )}
      {run.error_message && (
        <div className="mt-2 text-xs text-red-600 truncate" title={run.error_message}>
          Error: {run.error_message}
        </div>
      )}
    </div>
  )
}

function RunRow({ run }: { run: any }) {
  const statusColors: Record<string, string> = {
    success: 'text-green-600',
    failure: 'text-red-600',
    running: 'text-blue-600',
    partial: 'text-yellow-600'
  }
  const statusColor = statusColors[run.status] || 'text-gray-600'

  return (
    <tr className="border-t hover:bg-gray-50">
      <td className="px-4 py-2 font-medium">{run.source}</td>
      <td className="px-4 py-2">{run.job_type}</td>
      <td className={`px-4 py-2 font-medium ${statusColor}`}>{run.status}</td>
      <td className="px-4 py-2">{run.records_processed || 0}</td>
      <td className="px-4 py-2">
        {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : 'N/A'}
      </td>
      <td className="px-4 py-2 text-sm text-gray-600">
        {run.started_at ? formatDistanceToNow(new Date(run.started_at), { addSuffix: true }) : 'Never'}
      </td>
    </tr>
  )
}
