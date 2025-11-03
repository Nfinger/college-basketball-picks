import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Label } from '~/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { ListFilter, Check } from 'lucide-react'

// Simple deep equality check for filter objects
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false

  // Type assertion after checking they are objects
  const objA = a as Record<string, unknown>
  const objB = b as Record<string, unknown>

  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (!keysB.includes(key)) return false

    const valA = objA[key]
    const valB = objB[key]

    if (Array.isArray(valA) && Array.isArray(valB)) {
      if (valA.length !== valB.length) return false
      if (valA.some((item, i) => item !== valB[i])) return false
    } else if (valA !== valB) {
      return false
    }
  }

  return true
}

interface Conference {
  id: string
  name: string
  short_name: string
  is_power_conference: boolean
}

interface GameFiltersProps {
  conferences: Conference[]
  onFilterChange?: (filters: FilterState) => void
}

export interface FilterState {
  search: string
  conferences: string[]
  powerOnly: boolean
  midMajorOnly: boolean
  picksOnly: boolean
  excitingOnly: boolean
}

type Preset = 'all' | 'power' | 'midmajor' | 'picks' | 'exciting' | 'custom'

export function GameFilters({ conferences, onFilterChange }: GameFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Local state for search input to enable debouncing
  const [localSearch, setLocalSearch] = useState(searchParams.get('search') || '')

  const { POWER_CONFERENCE_IDS, MID_MAJOR_CONFERENCE_IDS } = useMemo(() => {
    const powerIds = conferences.filter(c => c.is_power_conference).map(c => c.id)
    const midMajorIds = conferences.filter(c => !c.is_power_conference).map(c => c.id)
    return { POWER_CONFERENCE_IDS: powerIds, MID_MAJOR_CONFERENCE_IDS: midMajorIds }
  }, [conferences])

  const presets = useMemo<Record<Exclude<Preset, 'custom'>, Partial<FilterState>>>(() => ({
    all: { conferences: [], powerOnly: false, midMajorOnly: false, picksOnly: false, excitingOnly: false },
    power: { conferences: POWER_CONFERENCE_IDS, powerOnly: true, midMajorOnly: false, picksOnly: false, excitingOnly: false },
    midmajor: { conferences: MID_MAJOR_CONFERENCE_IDS, powerOnly: false, midMajorOnly: true, picksOnly: false, excitingOnly: false },
    picks: { conferences: [], powerOnly: false, midMajorOnly: false, picksOnly: true, excitingOnly: false },
    exciting: { conferences: [], powerOnly: false, midMajorOnly: false, picksOnly: false, excitingOnly: true },
  }), [POWER_CONFERENCE_IDS, MID_MAJOR_CONFERENCE_IDS])

  // Derive all state directly from searchParams - single source of truth
  const { filters, activePreset } = useMemo(() => {
    const search = searchParams.get('search') || ''
    const confs = searchParams.getAll('conf')
    const power = searchParams.get('power') === 'true'
    const midmajor = searchParams.get('midmajor') === 'true'
    const picks = searchParams.get('picks') === 'true'
    const exciting = searchParams.get('exciting') === 'true'

    const currentFilters: FilterState = {
      search,
      conferences: confs,
      powerOnly: power,
      midMajorOnly: midmajor,
      picksOnly: picks,
      excitingOnly: exciting,
    }

    // Determine the active preset from the derived filter state
    const currentFilterStateForPresetCheck = {
      conferences: [...currentFilters.conferences].sort(),
      powerOnly: currentFilters.powerOnly,
      midMajorOnly: currentFilters.midMajorOnly,
      picksOnly: currentFilters.picksOnly,
      excitingOnly: currentFilters.excitingOnly,
    }

    let currentPreset: Preset = 'custom'
    for (const [presetName, presetValues] of Object.entries(presets)) {
      const comparablePreset = {
        conferences: [...(presetValues.conferences || [])].sort(),
        powerOnly: presetValues.powerOnly || false,
        midMajorOnly: presetValues.midMajorOnly || false,
        picksOnly: presetValues.picksOnly || false,
        excitingOnly: presetValues.excitingOnly || false,
      }
      if (isEqual(currentFilterStateForPresetCheck, comparablePreset)) {
        currentPreset = presetName as Preset
        break
      }
    }

    return { filters: currentFilters, activePreset: currentPreset }
  }, [searchParams, presets])

  // Sync local search with URL params when they change externally (e.g., clear filters)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    if (urlSearch !== localSearch) {
      setLocalSearch(urlSearch)
    }
  }, [searchParams])

  // Debounce search input - update URL params after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      const newSearchParams = new URLSearchParams(searchParams)
      if (localSearch) {
        newSearchParams.set('search', localSearch)
      } else {
        newSearchParams.delete('search')
      }
      // Only update if the search value actually changed
      if (searchParams.get('search') !== (localSearch || null)) {
        setSearchParams(newSearchParams, { replace: true })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [localSearch])

  // Propagate filter changes to parent component (legitimate side effect)
  useEffect(() => {
    onFilterChange?.(filters)
  }, [filters, onFilterChange])

  // Event handlers directly update searchParams
  const handlePresetChange = (value: Preset | '') => {
    if (!value) return

    const presetState = presets[value as Exclude<Preset, 'custom'>]
    const newSearchParams = new URLSearchParams(searchParams)

    // Clear all preset-related params before applying new ones
    newSearchParams.delete('conf')
    newSearchParams.delete('power')
    newSearchParams.delete('midmajor')
    newSearchParams.delete('picks')
    newSearchParams.delete('exciting')

    presetState.conferences?.forEach(conf => newSearchParams.append('conf', conf))
    if (presetState.powerOnly) newSearchParams.set('power', 'true')
    if (presetState.midMajorOnly) newSearchParams.set('midmajor', 'true')
    if (presetState.picksOnly) newSearchParams.set('picks', 'true')
    if (presetState.excitingOnly) newSearchParams.set('exciting', 'true')

    setSearchParams(newSearchParams, { replace: true })
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update local state immediately for responsive UI
    setLocalSearch(e.target.value)
  }

  const toggleConference = (confId: string) => {
    const newSearchParams = new URLSearchParams(searchParams)
    const currentConfs = newSearchParams.getAll('conf')
    const isPresent = currentConfs.includes(confId)

    const newConfs = isPresent
      ? currentConfs.filter(id => id !== confId)
      : [...currentConfs, confId]

    newSearchParams.delete('conf')
    newConfs.forEach(id => newSearchParams.append('conf', id))

    setSearchParams(newSearchParams, { replace: true })
  }

  const clearFilters = () => {
    // Clear all filters including search
    setSearchParams({}, { replace: true })
  }

  const hasActiveFilters =
    filters.search ||
    filters.conferences.length > 0 ||
    filters.powerOnly ||
    filters.midMajorOnly ||
    filters.picksOnly ||
    filters.excitingOnly

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Input
          type="text"
          placeholder="Search teams..."
          value={localSearch}
          onChange={handleSearchChange}
          className="flex-grow sm:flex-grow-0 sm:w-64"
        />

        <ToggleGroup
          type="single"
          value={activePreset}
          onValueChange={handlePresetChange}
          className="justify-start"
        >
          <ToggleGroupItem value="all">
            {activePreset === 'all' && <Check className="h-3 w-3 mr-1" />}
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="exciting">
            {activePreset === 'exciting' && <Check className="h-3 w-3 mr-1" />}
            Exciting
          </ToggleGroupItem>
          <ToggleGroupItem value="power">
            {activePreset === 'power' && <Check className="h-3 w-3 mr-1" />}
            Power 5
          </ToggleGroupItem>
          <ToggleGroupItem value="midmajor">
            {activePreset === 'midmajor' && <Check className="h-3 w-3 mr-1" />}
            Mid-Major
          </ToggleGroupItem>
          <ToggleGroupItem value="picks">
            {activePreset === 'picks' && <Check className="h-3 w-3 mr-1" />}
            My Picks
          </ToggleGroupItem>
        </ToggleGroup>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant={activePreset === 'custom' ? 'default' : 'outline'} size="sm">
              <ListFilter className="h-4 w-4 mr-2" />
              Custom
              {activePreset === 'custom' && filters.conferences.length > 0 && (
                <Badge variant="secondary" className="ml-2 rounded-full">
                  {filters.conferences.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-white dark:bg-slate-900" align="start">
            <div className="space-y-4">
              <Label className="text-sm font-semibold">Conferences</Label>
              <div className="grid grid-cols-2 gap-2">
                {conferences
                  .sort((a, b) => {
                    if (a.is_power_conference && !b.is_power_conference) return -1
                    if (!a.is_power_conference && b.is_power_conference) return 1
                    return a.short_name.localeCompare(b.short_name)
                  })
                  .map(conf => (
                    <Button
                      key={conf.id}
                      variant={filters.conferences.includes(conf.id) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleConference(conf.id)}
                      className="justify-start text-xs"
                    >
                      {conf.short_name}
                      {conf.is_power_conference && <span className="ml-auto text-xs opacity-50">★</span>}
                    </Button>
                  ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
