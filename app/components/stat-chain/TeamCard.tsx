// TeamCard Component - Individual team tile for selection

import { cn } from '~/lib/utils'
import type { TeamDTO } from '~/lib/stat-chain/types'

type TeamCardProps = {
  team: TeamDTO
  isSelected: boolean
  onClick: () => void
  disabled: boolean
  isIncorrect?: boolean
}

export function TeamCard({ team, isSelected, onClick, disabled, isIncorrect }: TeamCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'aspect-square flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200',
        'hover:scale-105 active:scale-95',
        isSelected && 'border-primary bg-primary/10 scale-105 shadow-lg',
        !isSelected && 'border-border hover:border-primary/50 bg-card',
        disabled && 'opacity-50 cursor-not-allowed hover:scale-100',
        isIncorrect && isSelected && 'animate-shake border-red-500'
      )}
    >
      {team.logoUrl && (
        <img
          src={team.logoUrl}
          alt={team.name}
          className="w-12 h-12 md:w-16 md:h-16 object-contain mb-2"
        />
      )}
      <span className="text-xs md:text-sm text-center font-medium line-clamp-2">
        {team.shortName || team.name}
      </span>
    </button>
  )
}
