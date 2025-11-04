import { useSearchParams } from "react-router";
import { useFavoriteTeams } from "~/contexts/FavoriteTeamsContext";

/**
 * Hook to manage "My Teams Only" URL parameter state
 * Integrates with existing URL-based filter pattern
 *
 * @returns Object with filter state and toggle functions
 *
 * @example
 * ```tsx
 * const { isMyTeamsOnly, toggleMyTeamsOnly, canUseFilter } = useMyTeamsFilter();
 *
 * <Button
 *   onClick={toggleMyTeamsOnly}
 *   disabled={!canUseFilter}
 * >
 *   {isMyTeamsOnly ? "Show All" : "My Teams Only"}
 * </Button>
 * ```
 */
export function useMyTeamsFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { favoriteTeamIds } = useFavoriteTeams();

  const isMyTeamsOnly = searchParams.get("myTeamsOnly") === "true";
  const hasAnyFavorites = favoriteTeamIds.length > 0;

  const toggleMyTeamsOnly = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (isMyTeamsOnly) {
        next.delete("myTeamsOnly");
      } else {
        next.set("myTeamsOnly", "true");
      }
      return next;
    });
  };

  const clearMyTeamsFilter = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("myTeamsOnly");
      return next;
    });
  };

  return {
    isMyTeamsOnly,
    hasAnyFavorites,
    toggleMyTeamsOnly,
    clearMyTeamsFilter,
    canUseFilter: hasAnyFavorites,
  };
}
