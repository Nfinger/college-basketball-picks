import { Link, Outlet, useLoaderData, useLocation } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Plus, Trophy } from "lucide-react";
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

  // Fetch all published rankings from all users with user profiles
  const { data: allRankings, error: allRankingsError } = await supabase
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
    .not("published_at", "is", null)
    .order("week", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(50);

  // Fetch user profiles for all ranking authors
  const userIds = [...new Set((allRankings || []).map((r: any) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds);

  if (allRankingsError) {
    console.error("Error fetching published rankings:", allRankingsError);
  }

  // Transform the data to flatten the nested arrays from Supabase
  const transformedAllRankings = (allRankings || []).map((ranking: any) => ({
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

  // Create a profile lookup map
  const profilesMap = (profiles || []).reduce(
    (acc: any, profile: any) => {
      acc[profile.id] = profile;
      return acc;
    },
    {} as Record<string, any>
  );

  return data(
    {
      allRankings: transformedAllRankings as UserRanking[],
      profiles: profilesMap,
    },
    { headers }
  );
}

export default function RankingsPage() {
  const { allRankings, profiles } = useLoaderData<typeof loader>();
  const location = useLocation();

  const currentTab = location.pathname === '/rankings/bracketology' ? 'bracketology' : 'rankings';

  // Group rankings by week and season
  const rankingsByWeek = allRankings.reduce((acc: any, ranking: UserRanking) => {
    const key = `${ranking.season}-W${ranking.week}`;
    if (!acc[key]) {
      acc[key] = {
        season: ranking.season,
        week: ranking.week,
        rankings: [],
      };
    }
    acc[key].rankings.push(ranking);
    return acc;
  }, {});

  const sortedWeeks = Object.values(rankingsByWeek).sort((a: any, b: any) => {
    if (a.season !== b.season) return b.season - a.season;
    return b.week - a.week;
  });

  return (
    <div className="container mx-auto max-w-7xl p-4">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Community Rankings</h1>
            <p className="text-muted-foreground">
              Compare rankings and bracket predictions from college basketball fans
            </p>
          </div>
          <Button asChild>
            <Link to="/rankings/me">
              <Plus className="mr-2 h-4 w-4" />
              My Rankings
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={currentTab} className="w-full">
        <TabsList>
          <TabsTrigger value="rankings" asChild>
            <Link to="/rankings">Weekly Rankings</Link>
          </TabsTrigger>
          <TabsTrigger value="bracketology" asChild>
            <Link to="/rankings/bracketology">
              <Trophy className="mr-2 h-4 w-4" />
              Bracketology
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rankings" className="mt-6">
          {allRankings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">
                  No published rankings yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <RankingsContent sortedWeeks={sortedWeeks} profiles={profiles} />
          )}
        </TabsContent>

        <TabsContent value="bracketology" className="mt-6">
          <Outlet />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RankingsContent({ sortedWeeks, profiles }: { sortedWeeks: any[]; profiles: any }) {
  return (
    <div className="space-y-8">
      {sortedWeeks.map((weekData: any) => {
        const { week, season, rankings } = weekData;

        // Find the maximum rank across all rankings for this week
        const maxRank = Math.max(
          ...rankings.map((r: UserRanking) =>
            Math.max(...r.ranking_entries.map((e) => e.rank), 0)
          )
        );

        return (
          <Card key={`${season}-W${week}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle>Week {week} Rankings</CardTitle>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {season} Season • {rankings.length} {rankings.length === 1 ? 'ranking' : 'rankings'}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 sticky left-0 bg-background z-10">Rank</TableHead>
                      {rankings.map((ranking: UserRanking) => {
                        const profile = profiles[ranking.user_id];
                        const userName = profile?.username || 'Anonymous';
                        return (
                          <TableHead key={ranking.id} className="min-w-[200px]">
                            <div className="flex flex-col">
                              <span className="font-semibold">{userName}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(ranking.published_at!), "MMM d, h:mm a")}
                              </span>
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: maxRank }, (_, i) => i + 1).map((rank) => (
                      <TableRow key={rank}>
                        <TableCell className="font-bold sticky left-0 bg-background z-10">{rank}</TableCell>
                        {rankings.map((ranking: UserRanking) => {
                          const entry = ranking.ranking_entries.find((e) => e.rank === rank);
                          return (
                            <TableCell key={ranking.id} className="font-medium">
                              {entry ? entry.teams.name : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
