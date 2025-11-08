import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface Team {
  id: string;
  name: string;
  short_name: string;
  conference: {
    id: string;
    name: string;
    short_name: string;
    is_power_conference: boolean;
  };
}

interface RankedTeam {
  teamId: string;
  rank: number;
}

interface DraggableRankingsListProps {
  rankedTeams: RankedTeam[];
  teams: Team[];
  onReorder: (newOrder: RankedTeam[]) => void;
  onRemoveTeam: (teamId: string) => void;
}

interface SortableTeamItemProps {
  team: Team;
  rank: number;
  onRemove: () => void;
}

/**
 * Individual sortable team item
 */
function SortableTeamItem({ team, rank, onRemove }: SortableTeamItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: team.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-shadow",
        isDragging && "shadow-lg opacity-50"
      )}
    >
      {/* Drag Handle */}
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Rank Number */}
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {rank}
      </div>

      {/* Team Info */}
      <div className="flex-1">
        <div className="font-medium">{team.name}</div>
        <div className="text-xs text-muted-foreground">
          {team.conference.short_name}
        </div>
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Draggable rankings list component
 * Allows users to reorder teams via drag-and-drop
 *
 * @example
 * ```tsx
 * <DraggableRankingsList
 *   rankedTeams={rankedTeams}
 *   teams={allTeams}
 *   onReorder={(newOrder) => setRankedTeams(newOrder)}
 *   onRemoveTeam={(teamId) => removeTeam(teamId)}
 * />
 * ```
 */
export function DraggableRankingsList({
  rankedTeams,
  teams,
  onReorder,
  onRemoveTeam,
}: DraggableRankingsListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = rankedTeams.findIndex((rt) => rt.teamId === active.id);
      const newIndex = rankedTeams.findIndex((rt) => rt.teamId === over.id);

      const newOrder = arrayMove(rankedTeams, oldIndex, newIndex);
      // Update ranks to match new positions
      const updatedOrder = newOrder.map((rt, index) => ({
        teamId: rt.teamId,
        rank: index + 1,
      }));
      onReorder(updatedOrder);
    }
  };

  // Create a map for quick team lookups
  const teamsById = teams.reduce(
    (acc, team) => {
      acc[team.id] = team;
      return acc;
    },
    {} as Record<string, Team>
  );

  if (rankedTeams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          No teams ranked yet
        </p>
        <p className="text-sm text-muted-foreground">
          Use the search above to add teams to your ranking
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={rankedTeams.map((rt) => rt.teamId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {rankedTeams.map((rankedTeam) => {
            const team = teamsById[rankedTeam.teamId];
            if (!team) return null;

            return (
              <SortableTeamItem
                key={team.id}
                team={team}
                rank={rankedTeam.rank}
                onRemove={() => onRemoveTeam(team.id)}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
