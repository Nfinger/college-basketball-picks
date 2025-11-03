import { Form, Link, useLocation } from 'react-router'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet'
import { Menu } from 'lucide-react'
import { useState } from 'react'

interface AppLayoutProps {
  children: React.ReactNode
  user: {
    email?: string
  }
}

export function AppLayout({ children, user }: AppLayoutProps) {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigation = [
    { name: 'Today\'s Games', href: '/' },
    { name: 'Browse Dates', href: '/games' },
    { name: 'Metrics', href: '/metrics' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  CBB Picks
                </span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium',
                      location.pathname === item.href
                        ? 'border-blue-500 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-300">
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
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <div className="space-y-2">
                      {navigation.map((item) => (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            'block px-3 py-2 rounded-md text-base font-medium',
                            location.pathname === item.href
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                          )}
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t pt-4">
                      <p className="px-3 text-sm text-gray-600 dark:text-gray-400 mb-3">
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
        {children}
      </main>
    </div>
  )
}
