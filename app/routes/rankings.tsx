import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { TeamSearchCombobox } from "~/components/TeamSearchCombobox";
import { DraggableRankingsList } from "~/components/DraggableRankingsList";
import { Plus, Save, Upload, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { data } from "react-router";
import { format } from "date-fns";

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
  profiles?: {
    full_name: string | null;
  };
}

export async function loader({ request }: { request: Request }) {
  const { user, supabase, headers } = await requireAuth(request);

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

  // Fetch user's rankings
  const { data: myRankings } = await supabase
    .from("user_rankings")
    .select(`
      id,
      title,
      week,
      season,
      published_at,
      created_at,
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
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch all published rankings from all users
  const { data: allRankings } = await supabase
    .from("user_rankings")
    .select(`
      id,
      title,
      week,
      season,
      published_at,
      created_at,
      user_id,
      profiles!user_rankings_user_id_fkey(
        full_name
      ),
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
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(50);

  // Transform the data to flatten the nested arrays from Supabase
  const transformedTeams = (teams || []).map((team: any) => ({
    ...team,
    conference: Array.isArray(team.conference) ? team.conference[0] : team.conference,
  }));

  const transformedMyRankings = (myRankings || []).map((ranking: any) => ({
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
  }));

  const transformedAllRankings = (allRankings || []).map((ranking: any) => ({
    ...ranking,
    profiles: Array.isArray(ranking.profiles) ? ranking.profiles[0] : ranking.profiles,
    ranking_entries: ranking.ranking_entries.map((entry: any) => ({
      ...entry,
      teams: {
        ...entry.teams,
        conference: Array.isArray(entry.teams.conference)
          ? entry.teams.conference[0]
          : entry.teams.conference,
      },
    })),
  }));

  return data(
    {
      teams: transformedTeams as Team[],
      myRankings: transformedMyRankings as UserRanking[],
      allRankings: transformedAllRankings as UserRanking[],
      currentSeason: 2025,
    },
    { headers }
  );
}

export default function RankingsPage() {
  const { teams, myRankings, allRankings, currentSeason } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  // State for creating/editing rankings
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRanking, setEditingRanking] = useState<UserRanking | null>(null);
  const [rankedTeams, setRankedTeams] = useState<RankedTeam[]>([]);

  // New ranking form
  const [newRankingTitle, setNewRankingTitle] = useState("");
  const [newRankingWeek, setNewRankingWeek] = useState("1");
  const [newRankingSeason, setNewRankingSeason] = useState(currentSeason.toString());

  // Get current week (rough estimate based on date)
  const getCurrentWeek = () => {
    const now = new Date();
    const seasonStart = new Date(currentSeason - 1, 10, 1); // November 1
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(20, weeksSinceStart + 1));
  };

  useEffect(() => {
    setNewRankingWeek(getCurrentWeek().toString());
  }, []);

  const handleCreateRanking = () => {
    if (!newRankingTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }

    const formData = new FormData();
    formData.append("intent", "create");
    formData.append("title", newRankingTitle);
    formData.append("week", newRankingWeek);
    formData.append("season", newRankingSeason);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/rankings",
    });

    setIsCreateDialogOpen(false);
    setNewRankingTitle("");
    toast.success("Ranking created successfully!");
  };

  const handleEditRanking = (ranking: UserRanking) => {
    setEditingRanking(ranking);
    // Convert ranking entries to ranked teams format
    const ranked = ranking.ranking_entries
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => ({
        teamId: entry.team_id,
        rank: entry.rank,
      }));
    setRankedTeams(ranked);
    setIsEditDialogOpen(true);
  };

  const handleAddTeam = (teamId: string) => {
    const newRank = rankedTeams.length + 1;
    if (newRank > 25) {
      toast.error("Maximum 25 teams allowed");
      return;
    }
    setRankedTeams([...rankedTeams, { teamId, rank: newRank }]);
    toast.success("Team added to ranking");
  };

  const handleRemoveTeam = (teamId: string) => {
    const filtered = rankedTeams.filter((rt) => rt.teamId !== teamId);
    // Renumber ranks
    const renumbered = filtered.map((rt, index) => ({
      teamId: rt.teamId,
      rank: index + 1,
    }));
    setRankedTeams(renumbered);
    toast.success("Team removed from ranking");
  };

  const handleReorder = (newOrder: RankedTeam[]) => {
    setRankedTeams(newOrder);
  };

  const handleSaveRanking = () => {
    if (!editingRanking) return;

    const formData = new FormData();
    formData.append("intent", "save-entries");
    formData.append("rankingId", editingRanking.id);
    formData.append("entries", JSON.stringify(rankedTeams));

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/rankings",
    });

    toast.success("Ranking saved successfully!");
  };

  const handlePublishRanking = (rankingId: string) => {
    if (!confirm("Are you sure you want to publish this ranking? Published rankings are visible to everyone.")) {
      return;
    }

    const formData = new FormData();
    formData.append("intent", "publish");
    formData.append("rankingId", rankingId);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/rankings",
    });

    setIsEditDialogOpen(false);
    toast.success("Ranking published successfully!");
  };

  const handleDeleteRanking = (rankingId: string) => {
    if (!confirm("Are you sure you want to delete this ranking? This action cannot be undone.")) {
      return;
    }

    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("rankingId", rankingId);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/rankings",
    });

    setIsEditDialogOpen(false);
    toast.success("Ranking deleted successfully!");
  };

  return (
    <div className="container mx-auto max-w-7xl p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Team Rankings</h1>
        <p className="text-muted-foreground">
          Create and share your weekly college basketball rankings
        </p>
      </div>

      <Tabs defaultValue="my-rankings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-rankings">My Rankings</TabsTrigger>
          <TabsTrigger value="all-rankings">Community Rankings</TabsTrigger>
        </TabsList>

        <TabsContent value="my-rankings">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">My Rankings</h2>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Ranking
              </Button>
            </div>

            {myRankings.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground mb-4">
                    You haven't created any rankings yet
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Ranking
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myRankings.map((ranking) => (
                  <Card key={ranking.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-start justify-between">
                        <span className="flex-1">{ranking.title}</span>
                        {ranking.published_at && (
                          <span className="ml-2 rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                            Published
                          </span>
                        )}
                      </CardTitle>
                      <div className="text-sm text-muted-foreground">
                        Week {ranking.week} • {ranking.season} Season
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ranking.ranking_entries.length} teams ranked
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRanking(ranking)}
                          className="flex-1"
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        {!ranking.published_at && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handlePublishRanking(ranking.id)}
                            className="flex-1"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Publish
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteRanking(ranking.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="all-rankings">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Community Rankings</h2>

            {allRankings.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">
                    No published rankings yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {allRankings.map((ranking) => (
                  <Card key={ranking.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle>{ranking.title}</CardTitle>
                          <div className="mt-1 text-sm text-muted-foreground">
                            By {ranking.profiles?.full_name || "Anonymous"} •
                            Week {ranking.week} • {ranking.season} Season
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Published {format(new Date(ranking.published_at!), "PPp")}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {ranking.ranking_entries
                          .sort((a, b) => a.rank - b.rank)
                          .slice(0, 10)
                          .map((entry) => (
                            <div key={entry.team_id} className="flex items-center gap-3">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                                {entry.rank}
                              </div>
                              <div className="flex-1">
                                <span className="font-medium">{entry.teams.name}</span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {entry.teams.conference.short_name}
                                </span>
                              </div>
                            </div>
                          ))}
                        {ranking.ranking_entries.length > 10 && (
                          <div className="pt-2 text-center text-sm text-muted-foreground">
                            + {ranking.ranking_entries.length - 10} more teams
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Ranking Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Ranking</DialogTitle>
            <DialogDescription>
              Create a new ranking for the current week
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., My Top 25 for Week 10"
                value={newRankingTitle}
                onChange={(e) => setNewRankingTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="week">Week</Label>
                <Input
                  id="week"
                  type="number"
                  min="1"
                  max="20"
                  value={newRankingWeek}
                  onChange={(e) => setNewRankingWeek(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="season">Season</Label>
                <Input
                  id="season"
                  type="number"
                  value={newRankingSeason}
                  onChange={(e) => setNewRankingSeason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRanking}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Ranking Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingRanking?.title}</DialogTitle>
            <DialogDescription>
              Week {editingRanking?.week} • {editingRanking?.season} Season •{" "}
              {rankedTeams.length}/25 teams
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label>Add Team</Label>
              <TeamSearchCombobox
                teams={teams}
                selectedTeamIds={rankedTeams.map((rt) => rt.teamId)}
                onSelectTeam={handleAddTeam}
                maxTeams={25}
                placeholder="Search and add a team..."
              />
            </div>

            <div className="space-y-2">
              <Label>Your Rankings</Label>
              <DraggableRankingsList
                rankedTeams={rankedTeams}
                teams={teams}
                onReorder={handleReorder}
                onRemoveTeam={handleRemoveTeam}
              />
            </div>

            <div className="flex justify-between gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Close
              </Button>
              <div className="flex gap-2">
                {editingRanking && !editingRanking.published_at && (
                  <Button
                    variant="default"
                    onClick={() => handlePublishRanking(editingRanking.id)}
                    disabled={rankedTeams.length === 0}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Publish
                  </Button>
                )}
                <Button
                  onClick={handleSaveRanking}
                  disabled={!editingRanking}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
