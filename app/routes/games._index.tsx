import { redirect } from 'react-router'
import type { Route } from './+types/games._index'
import { format } from 'date-fns'

export async function loader(_: Route.LoaderArgs) {
  const today = format(new Date(), 'yyyy-MM-dd')
  return redirect(`/games/${today}`)
}
