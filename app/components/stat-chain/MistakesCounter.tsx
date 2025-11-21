// MistakesCounter Component - Visual display of mistakes remaining

import { cn } from '~/lib/utils'

type MistakesCounterProps = {
  mistakes: number
  maxMistakes: number
}

export function MistakesCounter({ mistakes, maxMistakes }: MistakesCounterProps) {
  const remaining = maxMistakes - mistakes

  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Mistakes:</span>
      <div className="flex gap-1">
        {Array.from({ length: maxMistakes }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'w-3 h-3 rounded-full border-2',
              index < mistakes
                ? 'bg-red-500 border-red-500'
                : 'bg-transparent border-muted-foreground/30'
            )}
          />
        ))}
      </div>
      <span className="text-sm font-medium">
        {remaining} remaining
      </span>
    </div>
  )
}
