import { Star } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useFavoriteTeams } from "~/contexts/FavoriteTeamsContext";
import { cn } from "~/lib/utils";

interface TeamFavoriteButtonProps {
  teamId: string;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default" | "icon";
  showLabel?: boolean;
  className?: string;
}

/**
 * Inline star button to toggle favorite status for any team
 * Provides instant feedback via optimistic updates
 *
 * @example
 * ```tsx
 * <TeamFavoriteButton teamId={team.id} />
 * <TeamFavoriteButton teamId={team.id} showLabel />
 * ```
 */
export function TeamFavoriteButton({
  teamId,
  variant = "ghost",
  size = "icon",
  showLabel = false,
  className,
}: TeamFavoriteButtonProps) {
  const { isFavorite, toggleFavorite, isLoading } = useFavoriteTeams();
  const isFav = isFavorite(teamId);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={(e) => {
        e.stopPropagation(); // Prevent parent click handlers
        toggleFavorite(teamId);
      }}
      disabled={isLoading}
      className={cn(
        "transition-colors",
        isFav && "text-yellow-500 hover:text-yellow-600",
        className
      )}
      title={isFav ? "Remove from My Teams" : "Add to My Teams"}
      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
    >
      <Star className={cn("h-4 w-4", isFav && "fill-current")} />
      {showLabel && (
        <span className="ml-1">{isFav ? "Favorited" : "Favorite"}</span>
      )}
    </Button>
  );
}
