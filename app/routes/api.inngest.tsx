import { serve } from 'inngest/remix'
import type { Route } from './+types/api.inngest'
import { inngest } from '../../inngest/client'
import { scrapeGames } from '../../inngest/functions/scrape-games'
import { updateScores } from '../../inngest/functions/update-scores'
import { scrapeInjuries } from '../../inngest/functions/scrape-injuries'
import { aggregateNews } from '../../inngest/functions/aggregate-news'
import { scrapeBartTorvikStats } from '../../inngest/functions/scrape-barttorvik-stats'
import { scrapeKenPomStats } from '../../inngest/functions/scrape-kenpom-stats'
import { scrapeESPNStats } from '../../inngest/functions/scrape-espn-stats'
import { analyzeMatchup } from '../../inngest/functions/analyze-matchup'

const handler = serve({
  client: inngest,
  functions: [
    scrapeGames,
    updateScores,
    scrapeInjuries,
    aggregateNews,
    scrapeBartTorvikStats,
    scrapeKenPomStats,
    scrapeESPNStats,
    analyzeMatchup,
  ],
})

export async function loader({ request }: Route.LoaderArgs) {
  return handler({ request })
}

export async function action({ request }: Route.ActionArgs) {
  return handler({ request })
}
