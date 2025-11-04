import { serve } from 'inngest/remix'
import type { Route } from './+types/api.inngest'
import { inngest } from '../../inngest/client'
import { scrapeGames } from '../../inngest/functions/scrape-games'
import { updateScores } from '../../inngest/functions/update-scores'
import { scrapeInjuries } from '../../inngest/functions/scrape-injuries'

const handler = serve({
  client: inngest,
  functions: [scrapeGames, updateScores, scrapeInjuries],
})

export async function loader({ request }: Route.LoaderArgs) {
  return handler({ request })
}

export async function action({ request }: Route.ActionArgs) {
  return handler({ request })
}
