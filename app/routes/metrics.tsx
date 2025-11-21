import { useLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/metrics";
import { requireAuth } from "~/lib/auth.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { TrendingUp, TrendingDown, Trophy, Star, Calendar } from "lucide-react";

type UserStats = {
  user_id: string;
  username: string;
  total_picks: number;
  wins: number;
  losses: number;
  win_rate: string;
};

type ConferenceStats = {
  conference_id: string;
  conference_short_name: string;
  is_power_conference: boolean;
  total_picks: number;
  wins: number;
  losses: number;
  win_rate: string;
};

type ComparisonStats = {
  user: { id: string; username: string };
  stats: UserStats;
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase, headers } = await requireAuth(request);

  const url = new URL(request.url);
  const conferenceFilter = url.searchParams.get("conf") || "all";

  const [
    { data: overallStats },
    { data: conferenceStats },
    { data: streak },
    { data: allUsersStats },
    { data: potdStats },
    { data: potdStreak },
    { data: potdComparison },
    { data: weeklyStats },
    { data: weeklyConferenceStats },
    { data: weeklyStreak },
    { data: weeklyPotdStats },
    { data: weeklyPotdStreak },
  ] = await Promise.all([
    supabase.rpc("get_user_overall_stats", { user_uuid: user.id }),
    supabase.rpc("get_user_conference_stats", { user_uuid: user.id }),
    supabase.rpc("get_user_current_streak", { user_uuid: user.id }),
    supabase.rpc("get_all_users_overall_stats"),
    supabase.rpc("get_user_potd_stats", { user_uuid: user.id }),
    supabase.rpc("get_user_potd_streak", { user_uuid: user.id }),
    supabase.rpc("get_user_potd_comparison", { user_uuid: user.id }),
    supabase.rpc("get_user_weekly_stats", { user_uuid: user.id }),
    supabase.rpc("get_user_weekly_conference_stats", { user_uuid: user.id }),
    supabase.rpc("get_user_weekly_streak", { user_uuid: user.id }),
    supabase.rpc("get_user_weekly_potd_stats", { user_uuid: user.id }),
    supabase.rpc("get_user_weekly_potd_streak", { user_uuid: user.id }),
  ]);

  const comparisonStats = (allUsersStats || [])
    .filter((u: UserStats) => u.user_id !== user.id)
    .map((stats: UserStats) => ({
      user: { id: stats.user_id, username: stats.username },
      stats,
    }));

  const filteredConferenceStats = (conferenceStats || []).filter(
    (conf: ConferenceStats) => {
      if (conferenceFilter === "power") return conf.is_power_conference;
      if (conferenceFilter === "midmajor") return !conf.is_power_conference;
      return true;
    }
  );

  const filteredWeeklyConferenceStats = (weeklyConferenceStats || []).filter(
    (conf: ConferenceStats) => {
      if (conferenceFilter === "power") return conf.is_power_conference;
      if (conferenceFilter === "midmajor") return !conf.is_power_conference;
      return true;
    }
  );

  const powerStats = (conferenceStats || []).filter(
    (c: ConferenceStats) => c.is_power_conference
  );
  const midMajorStats = (conferenceStats || []).filter(
    (c: ConferenceStats) => !c.is_power_conference
  );

  const powerTotals = powerStats.reduce(
    (
      acc: { picks: number; wins: number; losses: number },
      curr: ConferenceStats
    ) => ({
      picks: acc.picks + Number(curr.total_picks),
      wins: acc.wins + Number(curr.wins),
      losses: acc.losses + Number(curr.losses),
    }),
    { picks: 0, wins: 0, losses: 0 }
  );

  const midMajorTotals = midMajorStats.reduce(
    (
      acc: { picks: number; wins: number; losses: number },
      curr: ConferenceStats
    ) => ({
      picks: acc.picks + Number(curr.total_picks),
      wins: acc.wins + Number(curr.wins),
      losses: acc.losses + Number(curr.losses),
    }),
    { picks: 0, wins: 0, losses: 0 }
  );

  const powerWinRate = powerTotals.picks
    ? (
        (powerTotals.wins / (powerTotals.wins + powerTotals.losses)) *
        100
      ).toFixed(2)
    : "0.00";

  const midMajorWinRate = midMajorTotals.picks
    ? (
        (midMajorTotals.wins / (midMajorTotals.wins + midMajorTotals.losses)) *
        100
      ).toFixed(2)
    : "0.00";

  const weeklyPowerStats = (weeklyConferenceStats || []).filter(
    (c: ConferenceStats) => c.is_power_conference
  );
  const weeklyMidMajorStats = (weeklyConferenceStats || []).filter(
    (c: ConferenceStats) => !c.is_power_conference
  );

  const weeklyPowerTotals = weeklyPowerStats.reduce(
    (
      acc: { picks: number; wins: number; losses: number },
      curr: ConferenceStats
    ) => ({
      picks: acc.picks + Number(curr.total_picks),
      wins: acc.wins + Number(curr.wins),
      losses: acc.losses + Number(curr.losses),
    }),
    { picks: 0, wins: 0, losses: 0 }
  );

  const weeklyMidMajorTotals = weeklyMidMajorStats.reduce(
    (
      acc: { picks: number; wins: number; losses: number },
      curr: ConferenceStats
    ) => ({
      picks: acc.picks + Number(curr.total_picks),
      wins: acc.wins + Number(curr.wins),
      losses: acc.losses + Number(curr.losses),
    }),
    { picks: 0, wins: 0, losses: 0 }
  );

  const weeklyPowerWinRate = weeklyPowerTotals.picks
    ? (
        (weeklyPowerTotals.wins / (weeklyPowerTotals.wins + weeklyPowerTotals.losses)) *
        100
      ).toFixed(2)
    : "0.00";

  const weeklyMidMajorWinRate = weeklyMidMajorTotals.picks
    ? (
        (weeklyMidMajorTotals.wins / (weeklyMidMajorTotals.wins + weeklyMidMajorTotals.losses)) *
        100
      ).toFixed(2)
    : "0.00";

  const sortedComparisonStats = comparisonStats.sort(
    (a: ComparisonStats, b: ComparisonStats) =>
      Number(b.stats.win_rate || 0) - Number(a.stats.win_rate || 0)
  );

  return {
    user,
    overallStats: overallStats?.[0] || null,
    conferenceStats: filteredConferenceStats,
    allConferenceStats: conferenceStats || [],
    powerTotals,
    midMajorTotals,
    powerWinRate,
    midMajorWinRate,
    streak: streak?.[0] || null,
    comparisonStats: sortedComparisonStats,
    potdStats: potdStats?.[0] || null,
    potdStreak: potdStreak?.[0] || null,
    potdComparison: potdComparison || [],
    weeklyStats: weeklyStats?.[0] || null,
    weeklyConferenceStats: filteredWeeklyConferenceStats,
    allWeeklyConferenceStats: weeklyConferenceStats || [],
    weeklyPowerTotals,
    weeklyMidMajorTotals,
    weeklyPowerWinRate,
    weeklyMidMajorWinRate,
    weeklyStreak: weeklyStreak?.[0] || null,
    weeklyPotdStats: weeklyPotdStats?.[0] || null,
    weeklyPotdStreak: weeklyPotdStreak?.[0] || null,
    headers,
  };
}

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Metrics - College Basketball Picks" },
    {
      name: "description",
      content: "View your picking statistics and performance",
    },
  ];
}

export default function Metrics() {
  const {
    overallStats,
    conferenceStats,
    allConferenceStats,
    powerTotals,
    midMajorTotals,
    powerWinRate,
    midMajorWinRate,
    streak,
    comparisonStats,
    potdStats,
    potdStreak,
    potdComparison,
    weeklyStats,
    weeklyConferenceStats,
    allWeeklyConferenceStats,
    weeklyPowerTotals,
    weeklyMidMajorTotals,
    weeklyPowerWinRate,
    weeklyMidMajorWinRate,
    weeklyStreak,
    weeklyPotdStats,
    weeklyPotdStreak,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const conferenceFilter = searchParams.get("conf") || "all";

  const renderMetricsContent = (
    stats: typeof overallStats,
    confStats: typeof conferenceStats,
    allConfStats: typeof allConferenceStats,
    powerTots: typeof powerTotals,
    midMajorTots: typeof midMajorTotals,
    powerRate: string,
    midMajorRate: string,
    currentStreak: typeof streak,
    potd: typeof potdStats,
    potdStrk: typeof potdStreak,
    isWeekly: boolean = false
  ) => (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/50 border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Total Picks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {stats?.total_picks || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
              Wins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600 dark:text-green-400 tabular-nums">
              {stats?.wins || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
              Losses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-600 dark:text-red-400 tabular-nums">
              {stats?.losses || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {stats?.win_rate || "0"}%
              </div>
              {stats?.win_rate && Number(stats.win_rate) > 50 ? (
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {currentStreak && (
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-900 hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-amber-900 dark:text-amber-100">
              {isWeekly ? "Weekly" : "Current"} Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                <Trophy className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                  {currentStreak.streak_count}{" "}
                  {currentStreak.streak_type === "won" ? "Wins" : "Losses"}
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                  Keep it going!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {potd && potd.total_potd > 0 && (
        <>
          <div className="mt-8 mb-4">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 dark:from-yellow-400 dark:to-amber-400 bg-clip-text text-transparent flex items-center gap-2">
              <Star className="w-6 h-6 fill-yellow-500 text-yellow-600" />
              Pick of the Day Performance
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Track your performance on your most confident picks
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-500" />
                  Total POTDs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-yellow-600 dark:text-yellow-400 tabular-nums">
                  {potd.total_potd}
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                  POTD Wins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-green-600 dark:text-green-400 tabular-nums">
                  {potd.wins}
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
                  POTD Losses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                  {potd.losses}
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                  POTD Win Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                    {potd.win_rate || "0"}%
                  </div>
                  {potd.win_rate && Number(potd.win_rate) > 50 ? (
                    <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {potdStrk && potdStrk.streak_count > 0 && (
            <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-900 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
                  <Star className="w-5 h-5 fill-yellow-500" />
                  Current POTD Streak
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
                    <Trophy className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                      {potdStrk.streak_count}{" "}
                      {potdStrk.streak_type === "won" ? "Wins" : "Losses"}
                    </div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                      Your most confident picks streak!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {(powerTots.picks > 0 || midMajorTots.picks > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Power Conferences vs Mid-Majors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Power Conferences</span>
                  <Badge variant="default">★</Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Total Picks:
                    </span>
                    <span className="font-medium">{powerTots.picks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Wins:
                    </span>
                    <span className="font-medium text-green-600">
                      {powerTots.wins}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Losses:
                    </span>
                    <span className="font-medium text-red-600">
                      {powerTots.losses}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Win Rate:</span>
                    <span>{powerRate}%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Mid-Majors</span>
                  <Badge variant="secondary">MM</Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Total Picks:
                    </span>
                    <span className="font-medium">{midMajorTots.picks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Wins:
                    </span>
                    <span className="font-medium text-green-600">
                      {midMajorTots.wins}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Losses:
                    </span>
                    <span className="font-medium text-red-600">
                      {midMajorTots.losses}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Win Rate:</span>
                    <span>{midMajorRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {allConfStats.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Performance by Conference</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={conferenceFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.delete("conf");
                    setSearchParams(newParams, { replace: true });
                  }}
                >
                  All
                </Button>
                <Button
                  variant={conferenceFilter === "power" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set("conf", "power");
                    setSearchParams(newParams, { replace: true });
                  }}
                >
                  Power
                </Button>
                <Button
                  variant={
                    conferenceFilter === "midmajor" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set("conf", "midmajor");
                    setSearchParams(newParams, { replace: true });
                  }}
                >
                  Mid-Major
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conference</TableHead>
                  <TableHead className="text-right">Picks</TableHead>
                  <TableHead className="text-right">Wins</TableHead>
                  <TableHead className="text-right">Losses</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {confStats.map((conf: ConferenceStats) => (
                  <TableRow key={conf.conference_id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {conf.conference_short_name}
                        {conf.is_power_conference && (
                          <Badge variant="outline" className="text-xs">
                            ★
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {conf.total_picks}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {conf.wins}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {conf.losses}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          Number(conf.win_rate) > 50 ? "default" : "secondary"
                        }
                      >
                        {conf.win_rate || "0"}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Performance Metrics</h1>
        <p className="text-muted-foreground mt-2">
          Track your picking performance and statistics
        </p>
      </div>

      <Tabs defaultValue="weekly" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <TabsTrigger
            value="weekly"
            className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 transition-all"
          >
            <Calendar className="h-4 w-4" />
            This Week
          </TabsTrigger>
          <TabsTrigger
            value="season"
            className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 transition-all"
          >
            <Trophy className="h-4 w-4" />
            Season
          </TabsTrigger>
        </TabsList>

        <TabsContent value="season" className="space-y-6">
          {renderMetricsContent(
            overallStats,
            conferenceStats,
            allConferenceStats,
            powerTotals,
            midMajorTotals,
            powerWinRate,
            midMajorWinRate,
            streak,
            potdStats,
            potdStreak,
            false
          )}

          {potdComparison.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 fill-yellow-500 text-yellow-600" />
                  Pick of the Day vs Regular Picks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pick Type</TableHead>
                      <TableHead className="text-right">Total Picks</TableHead>
                      <TableHead className="text-right">Wins</TableHead>
                      <TableHead className="text-right">Losses</TableHead>
                      <TableHead className="text-right">Win Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {potdComparison.map(
                      (comp: {
                        pick_type: string;
                        total_picks: number;
                        wins: number;
                        losses: number;
                        win_rate: string;
                      }) => (
                        <TableRow
                          key={comp.pick_type}
                          className={
                            comp.pick_type === "Pick of the Day"
                              ? "bg-yellow-50 dark:bg-yellow-900/20"
                              : ""
                          }
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {comp.pick_type === "Pick of the Day" && (
                                <Star className="w-4 h-4 fill-yellow-500 text-yellow-600" />
                              )}
                              {comp.pick_type}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {comp.total_picks}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {comp.wins}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {comp.losses}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                Number(comp.win_rate) > 50
                                  ? "default"
                                  : "secondary"
                              }
                              className={
                                comp.pick_type === "Pick of the Day"
                                  ? "bg-yellow-500 hover:bg-yellow-600"
                                  : ""
                              }
                            >
                              {comp.win_rate || "0"}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {comparisonStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Head-to-Head Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Total Picks</TableHead>
                      <TableHead className="text-right">Wins</TableHead>
                      <TableHead className="text-right">Losses</TableHead>
                      <TableHead className="text-right">Win Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overallStats && (
                      <TableRow className="bg-blue-50 dark:bg-blue-900/20">
                        <TableCell className="font-semibold">You</TableCell>
                        <TableCell className="text-right">
                          {overallStats.total_picks}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {overallStats.wins}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {overallStats.losses}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default">
                            {overallStats.win_rate || "0"}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )}
                    {comparisonStats
                      .filter((comp: ComparisonStats) => comp.stats)
                      .map((comp: ComparisonStats) => (
                        <TableRow key={comp.user.id}>
                          <TableCell>{comp.user.username}</TableCell>
                          <TableCell className="text-right">
                            {comp.stats.total_picks}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {comp.stats.wins}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {comp.stats.losses}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">
                              {comp.stats.win_rate || "0"}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-6">
          {renderMetricsContent(
            weeklyStats,
            weeklyConferenceStats,
            allWeeklyConferenceStats,
            weeklyPowerTotals,
            weeklyMidMajorTotals,
            weeklyPowerWinRate,
            weeklyMidMajorWinRate,
            weeklyStreak,
            weeklyPotdStats,
            weeklyPotdStreak,
            true
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
