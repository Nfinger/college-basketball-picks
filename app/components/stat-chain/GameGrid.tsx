// GameGrid Component - 4x3 grid of team tiles

import type { TeamDTO, GroupDTO } from '~/lib/stat-chain/types'
import { TeamCard } from './TeamCard'

type GameGridProps = {
  teams: TeamDTO[]
  selectedTeams: string[]
  solvedGroups: GroupDTO[]
  onTeamSelect: (teamId: string) => void
  disabled: boolean
  isIncorrect?: boolean
}

export function GameGrid({
  teams,
  selectedTeams,
  solvedGroups,
  onTeamSelect,
  disabled,
  isIncorrect,
}: GameGridProps) {
  // Get IDs of solved teams
  const solvedTeamIds = new Set(
    solvedGroups.flatMap((group) => group.teams.map((t) => t.id))
  )

  // Filter out solved teams
  const availableTeams = teams.filter((team) => !solvedTeamIds.has(team.id))

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-3 max-w-3xl mx-auto">
      {availableTeams.map((team) => {
        const isSelected = selectedTeams.includes(team.id)
        const isDisabled = disabled || (selectedTeams.length === 3 && !isSelected)

        return (
          <TeamCard
            key={team.id}
            team={team}
            isSelected={isSelected}
            onClick={() => onTeamSelect(team.id)}
            disabled={isDisabled}
            isIncorrect={isIncorrect}
          />
        )
      })}
    </div>
  )
}
