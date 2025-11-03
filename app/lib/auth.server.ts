import { redirect } from 'react-router'
import { createSupabaseServerClient } from './supabase.server'

export async function requireAuth(request: Request) {
  const { supabase, headers } = createSupabaseServerClient(request)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw redirect('/login', { headers })
  }

  return { user, supabase, headers }
}

export async function signUp(
  request: Request,
  email: string,
  password: string,
  username: string
) {
  const { supabase, headers } = createSupabaseServerClient(request)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
    },
  })

  return { data, error, headers }
}

export async function signIn(request: Request, email: string, password: string) {
  const { supabase, headers } = createSupabaseServerClient(request)

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return { data, error, headers }
}

export async function signOut(request: Request) {
  const { supabase, headers } = createSupabaseServerClient(request)

  await supabase.auth.signOut()

  return { headers }
}
