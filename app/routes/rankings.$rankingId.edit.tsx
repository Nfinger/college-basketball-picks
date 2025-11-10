import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate, redirect, useRevalidator } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Save, Upload, Trash2, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { data } from "react-router";
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

interface RankingEntry {
  team_id: string;
  rank: number;
  teams: Team;
}

interface UserRanking {
  id: string;
  title: string;
  week: number;
  season: number;
  published_at: string | null;
  created_at: string;
  ranking_entries: RankingEntry[];
  user_id: string;
}

export async function loader({ request, params }: { request: Request; params: any }) {
  const { user, supabase, headers } = await requireAuth(request);
  const { rankingId } = params;

  // Fetch the ranking
  const { data: ranking, error } = await supabase
    .from("user_rankings")
    .select(`
      id,
      title,
      week,
      season,
      published_at,
      created_at,
      user_id,
      ranking_entries(
        team_id,
        rank,
        teams(
          id,
          name,
          short_name,
          conference:conferences(
            id,
            name,
            short_name,
            is_power_conference
          )
        )
      )
    `)
    .eq("id", rankingId)
    .eq("user_id", user.id)
    .single();

  if (error || !ranking) {
    throw redirect("/rankings");
  }

  // Fetch all teams
  const { data: teams } = await supabase
    .from("teams")
    .select(`
      id,
      name,
      short_name,
      conference:conferences(
        id,
        name,
        short_name,
        is_power_conference
      )
    `)
    .order("name");

  // Transform the data to flatten nested arrays
  const transformedTeams = (teams || []).map((team: any) => ({
    ...team,
    conference: Array.isArray(team.conference) ? team.conference[0] : team.conference,
  }));

  const transformedRanking = {
    ...ranking,
    ranking_entries: ranking.ranking_entries.map((entry: any) => ({
      ...entry,
      teams: {
        ...entry.teams,
        conference: Array.isArray(entry.teams.conference)
          ? entry.teams.conference[0]
          : entry.teams.conference,
      },
    })),
  };

  return data(
    {
      teams: transformedTeams as Team[],
      ranking: transformedRanking as UserRanking,
    },
    { headers }
  );
}

interface SortableTeamItemProps {
  team: Team;
  rank: number;
  onRemove: () => void;
}

function SortableTeamItem({ team, rank, onRemove }: SortableTeamItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: team.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-card p-4 transition-all",
        isDragging ? "shadow-2xl ring-2 ring-primary opacity-50 scale-105" : "hover:shadow-md"
      )}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{team.name}</div>
        <div className="text-sm text-muted-foreground">{team.conference.short_name}</div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-8 w-8 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function RankingEditorPage() {
  const { teams, ranking } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedConferences, setSelectedConferences] = useState<Set<string>>(new Set());
  const [rankedTeams, setRankedTeams] = useState<RankedTeam[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Initialize ranked teams from ranking data
  useEffect(() => {
    const ranked = ranking.ranking_entries
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => ({
        teamId: entry.team_id,
        rank: entry.rank,
      }));
    setRankedTeams(ranked);
  }, [ranking.ranking_entries]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get unique conferences
  const allConferences = Array.from(
    new Map(teams.map((t) => [t.conference.id, t.conference])).values()
  ).sort((a, b) => {
    if (a.is_power_conference !== b.is_power_conference) {
      return a.is_power_conference ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  // Filter teams for the left panel (team pool)
  const rankedTeamIds = new Set(rankedTeams.map((rt) => rt.teamId));
  const availableTeams = teams
    .filter((team) => !rankedTeamIds.has(team.id))
    .filter(
      (team) =>
        (search === "" ||
          team.name.toLowerCase().includes(search.toLowerCase()) ||
          team.short_name.toLowerCase().includes(search.toLowerCase())) &&
        (selectedConferences.size === 0 || selectedConferences.has(team.conference.id))
    );

  // Create team lookup
  const teamsById = teams.reduce(
    (acc, team) => {
      acc[team.id] = team;
      return acc;
    },
    {} as Record<string, Team>
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = rankedTeams.findIndex((rt) => rt.teamId === active.id);
      const newIndex = rankedTeams.findIndex((rt) => rt.teamId === over.id);

      const newOrder = arrayMove(rankedTeams, oldIndex, newIndex);
      const updatedOrder = newOrder.map((rt, index) => ({
        teamId: rt.teamId,
        rank: index + 1,
      }));
      setRankedTeams(updatedOrder);
    }
  };

  const handleAddTeam = (teamId: string) => {
    if (rankedTeams.length >= 25) {
      toast.error("Maximum 25 teams allowed");
      return;
    }
    const newRank = rankedTeams.length + 1;
    setRankedTeams([...rankedTeams, { teamId, rank: newRank }]);
  };

  const handleRemoveTeam = (teamId: string) => {
    const filtered = rankedTeams.filter((rt) => rt.teamId !== teamId);
    const renumbered = filtered.map((rt, index) => ({
      teamId: rt.teamId,
      rank: index + 1,
    }));
    setRankedTeams(renumbered);
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append("intent", "save-entries");
    formData.append("rankingId", ranking.id);
    formData.append("entries", JSON.stringify(rankedTeams));

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/favorites",
    });

    toast.success("Ranking saved!");
  };

  const handlePublish = async () => {
    if (rankedTeams.length === 0) {
      toast.error("Add at least one team before publishing");
      return;
    }

    // Save entries first
    const saveFormData = new FormData();
    saveFormData.append("intent", "save-entries");
    saveFormData.append("rankingId", ranking.id);
    saveFormData.append("entries", JSON.stringify(rankedTeams));

    await fetch("/api/favorites", {
      method: "POST",
      body: saveFormData,
    });

    // Then publish
    const publishFormData = new FormData();
    publishFormData.append("intent", "publish-ranking");
    publishFormData.append("rankingId", ranking.id);

    await fetch("/api/favorites", {
      method: "POST",
      body: publishFormData,
    });

    toast.success("Ranking published!");
    // Navigate and force reload to show updated rankings
    navigate("/rankings", { replace: true });
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this ranking? This action cannot be undone.")) {
      return;
    }

    const formData = new FormData();
    formData.append("intent", "delete-ranking");
    formData.append("rankingId", ranking.id);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/favorites",
    });

    toast.success("Ranking deleted!");
    navigate("/rankings");
  };

  const toggleConference = (confId: string) => {
    const newSet = new Set(selectedConferences);
    if (newSet.has(confId)) {
      newSet.delete(confId);
    } else {
      newSet.add(confId);
    }
    setSelectedConferences(newSet);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/rankings")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-lg font-semibold">{ranking.title}</h1>
              <p className="text-sm text-muted-foreground">
                Week {ranking.week} • {ranking.season} Season
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {ranking.published_at && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Published
              </Badge>
            )}
            <Badge variant="outline">{rankedTeams.length}/25 Teams</Badge>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={fetcher.state !== "idle"}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={fetcher.state !== "idle"}>
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            {!ranking.published_at && (
              <Button onClick={handlePublish} disabled={fetcher.state !== "idle"}>
                <Upload className="mr-2 h-4 w-4" />
                Publish
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Two-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Team Pool */}
        <div className="w-2/5 border-r bg-muted/20 flex flex-col">
          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold mb-3">Search Teams</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Conference Filters</h3>
              <div className="flex flex-wrap gap-2">
                {allConferences.slice(0, 8).map((conf) => (
                  <Badge
                    key={conf.id}
                    variant={selectedConferences.has(conf.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleConference(conf.id)}
                  >
                    {conf.short_name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 px-4">
            <div className="space-y-2 pb-4">
              {availableTeams.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {rankedTeams.length === 25
                    ? "All 25 teams selected!"
                    : "No teams found"}
                </div>
              ) : (
                availableTeams.map((team) => (
                  <div
                    key={team.id}
                    onClick={() => handleAddTeam(team.id)}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 cursor-pointer hover:shadow-md transition-all hover:border-primary"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{team.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {team.conference.short_name}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">Click to add</div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Ranking Canvas */}
        <div className="flex-1 flex flex-col">
          <div className="p-6 border-b bg-card">
            <h2 className="text-xl font-bold">Your Rankings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Drag teams to reorder • Click teams on the left to add them
            </p>
          </div>

          <ScrollArea className="flex-1 p-6">
            {rankedTeams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No teams ranked yet</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Search for teams on the left and click to add them to your ranking
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={rankedTeams.map((rt) => rt.teamId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3 max-w-3xl">
                    {rankedTeams.map((rankedTeam) => {
                      const team = teamsById[rankedTeam.teamId];
                      if (!team) return null;

                      return (
                        <SortableTeamItem
                          key={team.id}
                          team={team}
                          rank={rankedTeam.rank}
                          onRemove={() => handleRemoveTeam(team.id)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeId ? (
                    <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-2xl">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                        {rankedTeams.find((rt) => rt.teamId === activeId)?.rank}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{teamsById[activeId]?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {teamsById[activeId]?.conference.short_name}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
