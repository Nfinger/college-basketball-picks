import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label'
import { Card, CardContent } from '~/components/ui/card'
import { X, Filter } from 'lucide-react'

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

export function GameFilters({ conferences, onFilterChange }: GameFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)

  // Initialize state from URL params
  const [filters, setFilters] = useState<FilterState>({
    search: searchParams.get('search') || '',
    conferences: searchParams.getAll('conf') || [],
    powerOnly: searchParams.get('power') === 'true',
    midMajorOnly: searchParams.get('midmajor') === 'true',
    picksOnly: searchParams.get('picks') === 'true',
  })

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
  }, [filters, onFilterChange])

  const toggleConference = (confId: string) => {
    setFilters(prev => ({
      ...prev,
      conferences: prev.conferences.includes(confId)
        ? prev.conferences.filter(id => id !== confId)
        : [...prev.conferences, confId],
    }))
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      conferences: [],
      powerOnly: false,
      midMajorOnly: false,
      picksOnly: false,
    })
  }

  const hasActiveFilters =
    filters.search ||
    filters.conferences.length > 0 ||
    filters.powerOnly ||
    filters.midMajorOnly ||
    filters.picksOnly

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    filters.conferences.length +
    (filters.powerOnly ? 1 : 0) +
    (filters.midMajorOnly ? 1 : 0) +
    (filters.picksOnly ? 1 : 0)

  return (
    <div className="space-y-4">
      {/* Filter Toggle Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search teams..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="max-w-sm"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="relative"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        )}
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Quick Filters */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Quick Filters</Label>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="power-only"
                    checked={filters.powerOnly}
                    onCheckedChange={(checked) =>
                      setFilters(prev => ({ ...prev, powerOnly: !!checked, midMajorOnly: false }))
                    }
                  />
                  <Label htmlFor="power-only" className="text-sm cursor-pointer">
                    Power Conferences Only
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="midmajor-only"
                    checked={filters.midMajorOnly}
                    onCheckedChange={(checked) =>
                      setFilters(prev => ({ ...prev, midMajorOnly: !!checked, powerOnly: false }))
                    }
                  />
                  <Label htmlFor="midmajor-only" className="text-sm cursor-pointer">
                    Mid-Majors Only
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="picks-only"
                    checked={filters.picksOnly}
                    onCheckedChange={(checked) =>
                      setFilters(prev => ({ ...prev, picksOnly: !!checked }))
                    }
                  />
                  <Label htmlFor="picks-only" className="text-sm cursor-pointer">
                    My Picks Only
                  </Label>
                </div>
              </div>
            </div>

            {/* Conference Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Conferences</Label>

              {/* Selected Conferences */}
              {filters.conferences.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filters.conferences.map(confId => {
                    const conf = conferences.find(c => c.id === confId)
                    if (!conf) return null
                    return (
                      <Badge key={confId} variant="secondary" className="gap-1">
                        {conf.short_name}
                        <button
                          onClick={() => toggleConference(confId)}
                          className="ml-1 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-full"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}

              {/* Conference Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {conferences
                  .sort((a, b) => {
                    // Sort: power conferences first, then alphabetically
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
                      {conf.is_power_conference && (
                        <span className="ml-auto text-xs opacity-50">★</span>
                      )}
                    </Button>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
