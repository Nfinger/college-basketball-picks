import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '~/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { Check } from 'lucide-react'

interface TournamentFiltersProps {
  onFilterChange?: (filters: TournamentFilterState) => void
}

export interface TournamentFilterState {
  status: string[]
  type: string[]
  picksOnly: boolean
}

type Preset = 'all' | 'upcoming' | 'live' | 'mypicks' | 'custom'

export function TournamentFilters({ onFilterChange }: TournamentFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const presets = useMemo<Record<Exclude<Preset, 'custom'>, Partial<TournamentFilterState>>>(() => ({
    all: { status: [], type: [], picksOnly: false },
    upcoming: { status: ['upcoming'], type: [], picksOnly: false },
    live: { status: ['in_progress'], type: [], picksOnly: false },
    mypicks: { status: [], type: [], picksOnly: true },
  }), [])

  // Derive all state directly from searchParams
  const { filters, activePreset } = useMemo(() => {
    const statusParams = searchParams.getAll('tournamentStatus')
    const typeParams = searchParams.getAll('tournamentType')
    const picks = searchParams.get('tournamentPicks') === 'true'

    const currentFilters: TournamentFilterState = {
      status: statusParams,
      type: typeParams,
      picksOnly: picks,
    }

    // Determine active preset
    let currentPreset: Preset = 'custom'
    for (const [presetName, presetValues] of Object.entries(presets)) {
      const statusMatch = JSON.stringify([...(presetValues.status || [])].sort()) === JSON.stringify([...currentFilters.status].sort())
      const typeMatch = JSON.stringify([...(presetValues.type || [])].sort()) === JSON.stringify([...currentFilters.type].sort())
      const picksMatch = (presetValues.picksOnly || false) === currentFilters.picksOnly

      if (statusMatch && typeMatch && picksMatch) {
        currentPreset = presetName as Preset
        break
      }
    }

    return { filters: currentFilters, activePreset: currentPreset }
  }, [searchParams, presets])

  const handlePresetChange = (value: Preset | '') => {
    if (!value) return

    const presetState = presets[value as Exclude<Preset, 'custom'>]
    const newSearchParams = new URLSearchParams(searchParams)

    // Clear tournament filter params
    newSearchParams.delete('tournamentStatus')
    newSearchParams.delete('tournamentType')
    newSearchParams.delete('tournamentPicks')

    // Apply new preset
    presetState.status?.forEach(status => newSearchParams.append('tournamentStatus', status))
    presetState.type?.forEach(type => newSearchParams.append('tournamentType', type))
    if (presetState.picksOnly) newSearchParams.set('tournamentPicks', 'true')

    setSearchParams(newSearchParams, { replace: true })
  }

  const clearFilters = () => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.delete('tournamentStatus')
    newSearchParams.delete('tournamentType')
    newSearchParams.delete('tournamentPicks')
    setSearchParams(newSearchParams, { replace: true })
  }

  const hasActiveFilters = filters.status.length > 0 || filters.type.length > 0 || filters.picksOnly

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <ToggleGroup
        type="single"
        value={activePreset}
        onValueChange={handlePresetChange}
        className="flex flex-wrap justify-start gap-2"
      >
        <ToggleGroupItem value="all" className="text-xs sm:text-sm">
          {activePreset === 'all' && <Check className="h-3 w-3 mr-1" />}
          All
        </ToggleGroupItem>
        <ToggleGroupItem value="upcoming" className="text-xs sm:text-sm">
          {activePreset === 'upcoming' && <Check className="h-3 w-3 mr-1" />}
          Upcoming
        </ToggleGroupItem>
        <ToggleGroupItem value="live" className="text-xs sm:text-sm">
          {activePreset === 'live' && <Check className="h-3 w-3 mr-1" />}
          Live
        </ToggleGroupItem>
        <ToggleGroupItem value="mypicks" className="text-xs sm:text-sm">
          {activePreset === 'mypicks' && <Check className="h-3 w-3 mr-1" />}
          My Brackets
        </ToggleGroupItem>
      </ToggleGroup>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs sm:text-sm">
          Clear
        </Button>
      )}
    </div>
  )
}
