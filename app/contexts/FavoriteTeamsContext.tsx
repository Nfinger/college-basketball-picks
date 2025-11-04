import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useFetcher, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";

type FavoriteTeamsContextType = {
  favoriteTeamIds: string[];
  isFavorite: (teamId: string) => boolean;
  toggleFavorite: (teamId: string) => void;
  isLoading: boolean;
};

const FavoriteTeamsContext = createContext<FavoriteTeamsContextType | null>(
  null
);

/**
 * Context provider for managing user's favorite teams across the app.
 * Provides optimistic updates and sync with server.
 *
 * @example
 * ```tsx
 * const { isFavorite, toggleFavorite } = useFavoriteTeams();
 *
 * <button onClick={() => toggleFavorite(teamId)}>
 *   {isFavorite(teamId) ? 'Remove' : 'Add'}
 * </button>
 * ```
 */
export function FavoriteTeamsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const fetcher = useFetcher();

  // Optimistic local state - uses Set for O(1) lookups
  const [optimisticFavorites, setOptimisticFavorites] = useState<Set<string>>(
    new Set(rootData?.favoriteTeams || [])
  );

  // Sync with server data when it changes (after revalidation)
  useEffect(() => {
    if (rootData?.favoriteTeams) {
      setOptimisticFavorites(new Set(rootData.favoriteTeams));
    }
  }, [rootData?.favoriteTeams]);

  const isFavorite = useCallback(
    (teamId: string) => {
      return optimisticFavorites.has(teamId);
    },
    [optimisticFavorites]
  );

  const toggleFavorite = useCallback(
    (teamId: string) => {
      const isCurrentlyFavorite = optimisticFavorites.has(teamId);
      const intent = isCurrentlyFavorite ? "remove" : "add";

      // Optimistic update - immediate UI feedback
      setOptimisticFavorites((prev) => {
        const next = new Set(prev);
        if (isCurrentlyFavorite) {
          next.delete(teamId);
        } else {
          next.add(teamId);
        }
        return next;
      });

      // Submit to server
      const formData = new FormData();
      formData.append("intent", intent);
      formData.append("teamId", teamId);

      fetcher.submit(formData, {
        method: "POST",
        action: "/api/favorites",
      });
    },
    [optimisticFavorites, fetcher]
  );

  const value = {
    favoriteTeamIds: Array.from(optimisticFavorites),
    isFavorite,
    toggleFavorite,
    isLoading: fetcher.state !== "idle",
  };

  return (
    <FavoriteTeamsContext.Provider value={value}>
      {children}
    </FavoriteTeamsContext.Provider>
  );
}

/**
 * Hook to access favorite teams functionality
 * @throws {Error} If used outside FavoriteTeamsProvider
 */
export function useFavoriteTeams() {
  const context = useContext(FavoriteTeamsContext);
  if (!context) {
    throw new Error(
      "useFavoriteTeams must be used within FavoriteTeamsProvider"
    );
  }
  return context;
}
