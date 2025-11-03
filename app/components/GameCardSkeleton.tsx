import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

export function GameCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Away Team Skeleton */}
        <div className="flex items-center justify-between p-3 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-9 w-16" />
          </div>
        </div>

        <div className="flex items-center justify-center">
          <Skeleton className="h-4 w-4" />
        </div>

        {/* Home Team Skeleton */}
        <div className="flex items-center justify-between p-3 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-9 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
