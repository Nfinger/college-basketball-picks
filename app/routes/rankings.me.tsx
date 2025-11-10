import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate, Link } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Plus, Upload, Trash2, Edit2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { data } from "react-router";
import { differenceInWeeks } from "date-fns";

// NCAA 2025-26 season started November 3rd, 2025
const SEASON_START_DATE = new Date(2025, 10, 3);
const CURRENT_SEASON = 2025;

function getCurrentSeasonWeek(): number {
  const now = new Date();
  const weeksSinceStart = differenceInWeeks(now, SEASON_START_DATE);
  const currentWeek = weeksSinceStart + 1;
  return Math.max(1, Math.min(20, currentWeek));
}

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

export async function loader({ request }: { request: Request }) {
  const { user, supabase, headers } = await requireAuth(request);

  // Fetch user's rankings only
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

  return data(
    {
      myRankings: transformedMyRankings as UserRanking[],
      currentSeason: CURRENT_SEASON,
      currentWeek: getCurrentSeasonWeek(),
    },
    { headers }
  );
}

export default function MyRankingsPage() {
  const { myRankings, currentSeason, currentWeek } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  useEffect(() => {
    if (fetcher.data && fetcher.data.success && fetcher.data.ranking) {
      toast.success("Ranking created! Add your teams.");
      navigate(`/rankings/${fetcher.data.ranking.id}/edit`);
    }
  }, [fetcher.data, navigate]);

  const handleCreateRanking = () => {
    const title = `Week ${currentWeek} Rankings`;

    const formData = new FormData();
    formData.append("intent", "create-ranking");
    formData.append("title", title);
    formData.append("week", currentWeek.toString());
    formData.append("season", currentSeason.toString());

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/favorites",
    });
  };

  const handleDeleteRanking = (rankingId: string) => {
    if (!confirm("Are you sure you want to delete this ranking? This action cannot be undone.")) {
      return;
    }

    const formData = new FormData();
    formData.append("intent", "delete-ranking");
    formData.append("rankingId", rankingId);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/favorites",
    });

    toast.success("Ranking deleted!");
  };

  const handlePublishRanking = (rankingId: string) => {
    if (!confirm("Are you sure you want to publish this ranking? Published rankings are visible to everyone.")) {
      return;
    }

    const formData = new FormData();
    formData.append("intent", "publish-ranking");
    formData.append("rankingId", rankingId);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/favorites",
    });

    toast.success("Ranking published!");
  };

  return (
    <div className="container mx-auto max-w-7xl p-4">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/rankings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Community Rankings
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold mb-2">My Rankings</h1>
        <p className="text-muted-foreground">
          Create and manage your weekly college basketball rankings
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">My Rankings</h2>
          <Button onClick={handleCreateRanking} disabled={fetcher.state !== "idle"}>
            <Plus className="mr-2 h-4 w-4" />
            {fetcher.state !== "idle" ? "Creating..." : "Create Ranking"}
          </Button>
        </div>

        {myRankings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                You haven't created any rankings yet
              </p>
              <Button onClick={handleCreateRanking} disabled={fetcher.state !== "idle"}>
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
                      onClick={() => navigate(`/rankings/${ranking.id}/edit`)}
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
    </div>
  );
}
