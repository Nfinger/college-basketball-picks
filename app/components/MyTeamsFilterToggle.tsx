import { Button } from "~/components/ui/button";
import { useMyTeamsFilter } from "~/hooks/useMyTeamsFilter";
import { Heart } from "lucide-react";
import { cn } from "~/lib/utils";

interface MyTeamsFilterToggleProps {
  className?: string;
}

/**
 * Toggle button for "My Teams Only" filter
 * Integrates into existing filter components (GameFilters, MyPicksFilters, etc.)
 *
 * @example
 * ```tsx
 * <div className="flex gap-2">
 *   <MyTeamsFilterToggle />
 *   {/* other filters *\/}
 * </div>
 * ```
 */
export function MyTeamsFilterToggle({ className }: MyTeamsFilterToggleProps) {
  const {
    isMyTeamsOnly,
    hasAnyFavorites,
    toggleMyTeamsOnly,
    canUseFilter,
  } = useMyTeamsFilter();

  return (
    <Button
      variant={isMyTeamsOnly ? "default" : "outline"}
      size="sm"
      onClick={toggleMyTeamsOnly}
      disabled={!canUseFilter}
      className={cn("gap-2", className)}
      title={
        !canUseFilter
          ? "Add teams to favorites first"
          : isMyTeamsOnly
            ? "Show all teams"
            : "Show only my teams"
      }
      aria-pressed={isMyTeamsOnly}
      aria-label={`Filter by my teams${hasAnyFavorites ? `, ${hasAnyFavorites} teams selected` : ""}`}
    >
      <Heart className={cn("h-4 w-4", isMyTeamsOnly && "fill-current")} />
      <span>My Teams Only</span>
      {hasAnyFavorites > 0 && (
        <span className="text-xs opacity-70">({hasAnyFavorites})</span>
      )}
    </Button>
  );
}
