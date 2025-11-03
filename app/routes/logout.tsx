import { redirect } from 'react-router'
import type { Route } from './+types/logout'
import { signOut } from '~/lib/auth.server'

export async function action({ request }: Route.ActionArgs) {
  const { headers } = await signOut(request)
  return redirect('/login', { headers })
}

export async function loader() {
  return redirect('/login')
}
