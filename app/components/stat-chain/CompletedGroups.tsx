// CompletedGroups Component - Display solved groups

import { useState } from 'react'
import { cn } from '~/lib/utils'
import type { GroupDTO } from '~/lib/stat-chain/types'
import { DIFFICULTY_COLORS } from '~/lib/stat-chain/types'

type CompletedGroupsProps = {
  groups: GroupDTO[]
}

export function CompletedGroups({ groups }: CompletedGroupsProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  // Sort by order
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-2">
      {sortedGroups.map((group) => {
        const colors = DIFFICULTY_COLORS[group.difficulty]
        const isExpanded = expandedGroup === group.id

        return (
          <button
            key={group.id}
            type="button"
            onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
            className={cn(
              'w-full p-4 rounded-lg border-2 transition-all text-left',
              colors.bg,
              colors.border,
              colors.text,
              'hover:shadow-md'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold mb-1">{group.title}</div>
                <div className="text-sm opacity-90">
                  {group.teams.map((t) => t.shortName || t.name).join(' • ')}
                </div>
              </div>
              <div className="ml-4 text-xs uppercase font-semibold opacity-75">
                {group.difficulty}
              </div>
            </div>
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-current/20 text-sm">
                {group.explanation}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
