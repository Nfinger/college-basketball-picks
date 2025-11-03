import { useRouteError, isRouteErrorResponse, Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { AlertCircle, Home, RefreshCw } from 'lucide-react'

export function RouteErrorBoundary() {
  const error = useRouteError()

  let title = 'Oops! Something went wrong'
  let message = 'An unexpected error occurred.'
  let statusCode: number | null = null

  if (isRouteErrorResponse(error)) {
    statusCode = error.status
    if (error.status === 404) {
      title = '404 - Page Not Found'
      message = 'The page you are looking for does not exist.'
    } else if (error.status === 401) {
      title = '401 - Unauthorized'
      message = 'You need to be logged in to access this page.'
    } else if (error.status === 403) {
      title = '403 - Forbidden'
      message = 'You do not have permission to access this page.'
    } else if (error.status === 500) {
      title = '500 - Server Error'
      message = 'Something went wrong on our end. Please try again later.'
    } else {
      message = error.statusText || message
    }
  } else if (error instanceof Error) {
    message = error.message
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <CardTitle className="text-xl">{title}</CardTitle>
              {statusCode && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Error Code: {statusCode}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">{message}</p>

          {import.meta.env.DEV && error instanceof Error && error.stack && (
            <div className="mt-4">
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  Stack Trace (Dev Only)
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                  {error.stack}
                </pre>
              </details>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button
              asChild
              variant="default"
              className="flex-1"
            >
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Link>
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
