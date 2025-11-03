import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Label } from '~/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { ListFilter } from 'lucide-react'
import { isEqual } from 'lodash'

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
}

type Preset = 'all' | 'power' | 'midmajor' | 'picks' | 'custom'

export function GameFilters({ conferences, onFilterChange }: GameFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize state from URL params
  const [filters, setFilters] = useState<FilterState>({
    search: searchParams.get('search') || '',
    conferences: searchParams.getAll('conf') || [],
    powerOnly: searchParams.get('power') === 'true',
    midMajorOnly: searchParams.get('midmajor') === 'true',
    picksOnly: searchParams.get('picks') === 'true',
  })

  const [activePreset, setActivePreset] = useState<Preset>('all')

  const { POWER_CONFERENCE_IDS, MID_MAJOR_CONFERENCE_IDS } = useMemo(() => {
    const powerIds = conferences.filter(c => c.is_power_conference).map(c => c.id)
    const midMajorIds = conferences.filter(c => !c.is_power_conference).map(c => c.id)
    return { POWER_CONFERENCE_IDS: powerIds, MID_MAJOR_CONFERENCE_IDS: midMajorIds }
  }, [conferences])

  const presets = useMemo<Record<Exclude<Preset, 'custom'>, Partial<FilterState>>>(() => ({
    all: { conferences: [], powerOnly: false, midMajorOnly: false, picksOnly: false },
    power: { conferences: POWER_CONFERENCE_IDS, powerOnly: true, midMajorOnly: false, picksOnly: false },
    midmajor: { conferences: MID_MAJOR_CONFERENCE_IDS, powerOnly: false, midMajorOnly: true, picksOnly: false },
    picks: { conferences: [], powerOnly: false, midMajorOnly: false, picksOnly: true },
  }), [POWER_CONFERENCE_IDS, MID_MAJOR_CONFERENCE_IDS])

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams()

    if (filters.search) params.set('search', filters.search)
    filters.conferences.forEach(conf => params.append('conf', conf))
    if (filters.powerOnly) params.set('power', 'true')
    if (filters.midMajorOnly) params.set('midmajor', 'true')
    if (filters.picksOnly) params.set('picks', 'true')

    setSearchParams(params, { replace: true })
    onFilterChange?.(filters)
  }, [filters, onFilterChange, setSearchParams])

  // Apply preset when activePreset changes
  useEffect(() => {
    if (activePreset !== 'custom') {
      const presetState = presets[activePreset]
      setFilters(prev => ({ ...prev, ...presetState }))
    }
  }, [activePreset, presets])

  // Determine the active preset from the current filter state
  useEffect(() => {
    const currentFilterState = {
      conferences: [...filters.conferences].sort(),
      powerOnly: filters.powerOnly,
      midMajorOnly: filters.midMajorOnly,
      picksOnly: filters.picksOnly,
    }

    for (const [presetName, presetValues] of Object.entries(presets)) {
      const comparablePreset = {
        conferences: [...(presetValues.conferences || [])].sort(),
        powerOnly: presetValues.powerOnly || false,
        midMajorOnly: presetValues.midMajorOnly || false,
        picksOnly: presetValues.picksOnly || false,
      }
      if (isEqual(currentFilterState, comparablePreset)) {
        setActivePreset(presetName as Preset)
        return
      }
    }
    setActivePreset('custom')
  }, [filters, presets])

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const toggleConference = (confId: string) => {
    setFilters(prev => ({
      ...prev,
      conferences: prev.conferences.includes(confId)
        ? prev.conferences.filter(id => id !== confId)
        : [...prev.conferences, confId],
    }))
  }

  const clearFilters = () => {
    setActivePreset('all')
  }

  const hasActiveFilters =
    filters.search ||
    filters.conferences.length > 0 ||
    filters.powerOnly ||
    filters.midMajorOnly ||
    filters.picksOnly

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Input
          type="text"
          placeholder="Search teams..."
          value={filters.search}
          onChange={(e) => handleFilterChange({ search: e.target.value })}
          className="flex-grow sm:flex-grow-0 sm:w-64"
        />

        <ToggleGroup
          type="single"
          value={activePreset}
          onValueChange={(value: Preset) => {
            if (value) setActivePreset(value)
          }}
          className="justify-start"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="power">Power 5</ToggleGroupItem>
          <ToggleGroupItem value="midmajor">Mid-Major</ToggleGroupItem>
          <ToggleGroupItem value="picks">My Picks</ToggleGroupItem>
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
          <PopoverContent className="w-80" align="start">
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
