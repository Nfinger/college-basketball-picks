import { Form, Link, Outlet, useLocation, useRouteLoaderData } from 'react-router'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet'
import { Menu, Heart } from 'lucide-react'
import { useState } from 'react'
import { requireAuth } from '~/lib/auth.server'
import type { Route } from './+types/layout'
import { useLoaderData } from 'react-router'
import { FavoriteTeamManager } from '~/components/FavoriteTeamManager'
import type { loader as rootLoader } from '~/root'

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request)
  return { user }
}


export default function Layout() {
  const { user } = useLoaderData<typeof loader>()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [teamManagerOpen, setTeamManagerOpen] = useState(false)

  const navigation = [
    { name: 'Games', href: '/' },
    { name: 'My Picks', href: '/mypicks' },
    { name: 'Fantasy', href: '/fantasy' },
    { name: 'Rankings', href: '/rankings' },
    { name: 'Injuries', href: '/injuries' },
    { name: 'News', href: '/news' },
    { name: 'Metrics', href: '/metrics' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center gap-3">
                <img src="/logo.svg" alt="Basketball" className="h-8 w-8" />
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  CBB Picks
                </span>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-6">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition-colors',
                      location.pathname === item.href
                        ? 'border-blue-600 text-slate-900 dark:text-white'
                        : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-700'
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTeamManagerOpen(true)}
                className="hidden sm:flex items-center gap-2"
              >
                <Heart className="h-4 w-4" />
                <span>My Teams</span>
              </Button>
              <span className="hidden sm:inline text-sm text-slate-700 dark:text-slate-300 font-medium">
                {user.email}
              </span>
              <Form method="post" action="/logout" className="hidden sm:block">
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </Form>

              {/* Mobile Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="sm:hidden">
                  <Button variant="outline" size="sm">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-slate-50 dark:bg-slate-900">
                  <SheetHeader>
                    <SheetTitle className="text-slate-900 dark:text-white">Menu</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <div className="space-y-2">
                      {navigation.map((item) => (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            'block px-4 py-3 rounded-lg text-base font-medium transition-colors',
                            location.pathname === item.href
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 shadow-sm'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          )}
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-4 space-y-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setTeamManagerOpen(true)
                          setMobileMenuOpen(false)
                        }}
                        className="w-full flex items-center gap-2"
                      >
                        <Heart className="h-4 w-4" />
                        <span>My Teams</span>
                      </Button>
                      <p className="px-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                        {user.email}
                      </p>
                      <Form method="post" action="/logout">
                        <Button type="submit" variant="outline" className="w-full">
                          Sign out
                        </Button>
                      </Form>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet context={{ user }} />
      </main>

      {/* Favorite Team Manager Modal */}
      <FavoriteTeamManager
        teams={rootData?.allTeams || []}
        open={teamManagerOpen}
        onOpenChange={setTeamManagerOpen}
      />
    </div>
  )
}
