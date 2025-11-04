import { useSearchParams } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { ArrowUpDown } from "lucide-react";

interface MyPicksFiltersProps {
  currentFilter: "all" | "upcoming" | "past";
  currentSort: string;
}

export function MyPicksFilters({ currentFilter, currentSort }: MyPicksFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const handleFilterChange = (value: string) => {
    if (!value) return; // ToggleGroup can return empty string if clicked again

    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("filter");
    } else {
      params.set("filter", value);
    }
    setSearchParams(params);
  };

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "date-desc") {
      params.delete("sort"); // date-desc is default
    } else {
      params.set("sort", value);
    }
    setSearchParams(params);
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Time-based Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
            Filter by Status
          </Label>
          <ToggleGroup
            type="single"
            value={currentFilter}
            onValueChange={handleFilterChange}
            className="justify-start flex-wrap"
          >
            <ToggleGroupItem
              value="all"
              aria-label="Show all picks"
              className="data-[state=on]:bg-blue-100 data-[state=on]:text-blue-900 dark:data-[state=on]:bg-blue-900 dark:data-[state=on]:text-blue-100"
            >
              All
            </ToggleGroupItem>
            <ToggleGroupItem
              value="upcoming"
              aria-label="Show upcoming picks"
              className="data-[state=on]:bg-blue-100 data-[state=on]:text-blue-900 dark:data-[state=on]:bg-blue-900 dark:data-[state=on]:text-blue-100"
            >
              Upcoming
            </ToggleGroupItem>
            <ToggleGroupItem
              value="past"
              aria-label="Show past picks"
              className="data-[state=on]:bg-blue-100 data-[state=on]:text-blue-900 dark:data-[state=on]:bg-blue-900 dark:data-[state=on]:text-blue-100"
            >
              Past
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Sort Dropdown */}
        <div className="w-full sm:w-64">
          <Label
            htmlFor="sort-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block"
          >
            Sort By
          </Label>
          <Select value={currentSort} onValueChange={handleSortChange}>
            <SelectTrigger id="sort-select" className="w-full">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-slate-500" />
                <SelectValue placeholder="Sort by..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Date (Newest First)</SelectItem>
              <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
              <SelectItem value="result">Result (Won First)</SelectItem>
              <SelectItem value="spread">Spread (Biggest First)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
