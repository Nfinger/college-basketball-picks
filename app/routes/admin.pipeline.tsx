// Pipeline Monitoring Dashboard - Admin view of data collection pipeline

import { redirect } from 'react-router'
import type { Route } from './+types/admin.pipeline'
import { requireAuth } from '~/lib/auth.server'
import { createClient } from '@supabase/supabase-js'
import { inngest } from '../../inngest/client'

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase } = await requireAuth(request)

  // Get recent pipeline runs
  const { data: pipelineRuns } = await supabase
    .from('pipeline_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10)

  // Get data freshness
  const { data: dataFreshness } = await supabase
    .from('data_freshness')
    .select('*')
    .order('last_updated_at', { ascending: false })

  // Get circuit breaker states
  const { data: circuitBreakers } = await supabase
    .from('circuit_breaker_state')
    .select('*')
    .order('source')

  // Get recent scraper runs
  const { data: scraperRuns } = await supabase
    .from('scraper_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20)

  return {
    pipelineRuns: pipelineRuns || [],
    dataFreshness: dataFreshness || [],
    circuitBreakers: circuitBreakers || [],
    scraperRuns: scraperRuns || [],
  }
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request)

  const formData = await request.formData()
  const action = formData.get('action')

  if (action === 'trigger-full') {
    // Trigger full pipeline run
    await inngest.send({
      name: 'pipeline/trigger',
      data: { runType: 'full' },
    })

    return redirect('/admin/pipeline?triggered=full')
  }

  if (action === 'trigger-incremental') {
    // Trigger incremental pipeline run
    await inngest.send({
      name: 'pipeline/trigger',
      data: { runType: 'incremental' },
    })

    return redirect('/admin/pipeline?triggered=incremental')
  }

  if (action === 'generate-puzzle') {
    // Trigger puzzle generation
    const date = new Date().toISOString().split('T')[0]
    await inngest.send({
      name: 'stat-chain/generate-puzzle',
      data: { date },
    })

    return redirect('/admin/pipeline?triggered=puzzle')
  }

  if (action === 'reset-circuit-breaker') {
    const source = formData.get('source') as string
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase
      .from('circuit_breaker_state')
      .update({
        state: 'closed',
        failure_count: 0,
        open_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('source', source)

    return redirect('/admin/pipeline?reset=' + source)
  }

  return { error: 'Unknown action' }
}

export default function PipelineMonitoring({ loaderData }: Route.ComponentProps) {
  const { pipelineRuns, dataFreshness, circuitBreakers, scraperRuns } = loaderData

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Data Pipeline Monitoring</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage the automated data collection pipeline
        </p>
      </div>

      {/* Pipeline Triggers */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Manual Triggers</h2>
        <div className="flex gap-4">
          <form method="post">
            <input type="hidden" name="action" value="trigger-full" />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Trigger Full Run
            </button>
          </form>

          <form method="post">
            <input type="hidden" name="action" value="trigger-incremental" />
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Trigger Incremental Run
            </button>
          </form>

          <form method="post">
            <input type="hidden" name="action" value="generate-puzzle" />
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Generate Daily Puzzle
            </button>
          </form>
        </div>
      </div>

      {/* Recent Pipeline Runs */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Pipeline Runs</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Started</th>
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Status</th>
                <th className="text-right py-2">Sources</th>
                <th className="text-right py-2">Records</th>
                <th className="text-left py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {pipelineRuns.map((run) => (
                <tr key={run.id} className="border-b">
                  <td className="py-2">
                    {new Date(run.started_at).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                      {run.run_type}
                    </span>
                  </td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        run.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                          : run.status === 'partial_success'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                            : run.status === 'failed'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {run.sources_succeeded}/{run.sources_attempted}
                  </td>
                  <td className="py-2 text-right">{run.records_processed}</td>
                  <td className="py-2">
                    {run.completed_at
                      ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                      : 'Running...'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Freshness */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Data Freshness</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dataFreshness.map((item) => {
            const age = Date.now() - new Date(item.last_updated_at).getTime()
            const hoursOld = Math.round(age / (1000 * 60 * 60))
            const isStale = hoursOld > 24

            return (
              <div
                key={`${item.source}-${item.data_type}`}
                className={`p-4 rounded-lg border ${
                  isStale ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950' : ''
                }`}
              >
                <div className="font-semibold">{item.source}</div>
                <div className="text-sm text-muted-foreground">
                  {item.data_type}
                </div>
                <div className="mt-2 text-sm">
                  <div>Records: {item.record_count}</div>
                  <div>Updated: {hoursOld}h ago</div>
                  {item.quality_score && (
                    <div>
                      Quality:{' '}
                      {(parseFloat(item.quality_score as string) * 100).toFixed(0)}
                      %
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Circuit Breakers */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Circuit Breakers</h2>
        <div className="space-y-2">
          {circuitBreakers.map((cb) => (
            <div
              key={cb.source}
              className="flex items-center justify-between p-3 border rounded"
            >
              <div className="flex-1">
                <div className="font-medium">{cb.source}</div>
                <div className="text-sm text-muted-foreground">
                  Failures: {cb.failure_count}
                  {cb.last_failure_at && (
                    <> · Last failure: {new Date(cb.last_failure_at).toLocaleString()}</>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`px-3 py-1 rounded font-medium ${
                    cb.state === 'closed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                      : cb.state === 'open'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                  }`}
                >
                  {cb.state}
                </span>
                {cb.state !== 'closed' && (
                  <form method="post">
                    <input type="hidden" name="action" value="reset-circuit-breaker" />
                    <input type="hidden" name="source" value={cb.source} />
                    <button
                      type="submit"
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Reset
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Scraper Runs */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Scraper Runs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">Source</th>
                <th className="text-left py-2">Job</th>
                <th className="text-left py-2">Status</th>
                <th className="text-right py-2">Records</th>
                <th className="text-right py-2">Duration</th>
                <th className="text-right py-2">Retries</th>
              </tr>
            </thead>
            <tbody>
              {scraperRuns.map((run) => (
                <tr key={run.id} className="border-b">
                  <td className="py-2">
                    {run.started_at
                      ? new Date(run.started_at).toLocaleTimeString()
                      : '-'}
                  </td>
                  <td className="py-2">{run.source}</td>
                  <td className="py-2">{run.job_type}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        run.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                          : run.status === 'failed'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">{run.records_processed}</td>
                  <td className="py-2 text-right">
                    {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '-'}
                  </td>
                  <td className="py-2 text-right">{run.retry_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
