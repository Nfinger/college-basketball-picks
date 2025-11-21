import { useState } from "react";
import { useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { getFavoriteTeamIds } from "~/lib/favorites.server";
import { getRecentNews, getNewsByTeams } from "~/lib/news/news-storage";
import { Badge } from "~/components/ui/badge";
import { AlertCircle, Ban, HelpCircle, Timer, TrendingUp, Search, Newspaper, Activity } from "lucide-react";
import { MyTeamsFilterToggle } from "~/components/MyTeamsFilterToggle";
import { Separator } from "~/components/ui/separator";
import { Input } from "~/components/ui/input";
import { NewsCard } from "~/components/NewsCard";
import { NewsFilter } from "~/components/NewsFilter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Route } from "./+types/updates";

type InjuryReport = {
  id: string;
  player_name: string;
  injury_type: string | null;
  status: "out" | "questionable" | "doubtful" | "day-to-day" | "probable";
  description: string | null;
  reported_date: string;
  expected_return: string | null;
  source_url: string | null;
  team: {
    id: string;
    name: string;
    short_name: string;
    conference: {
      name: string;
      short_name: string;
      is_power_conference: boolean;
    };
  };
};

type NewsArticle = {
  id?: string;
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
  content?: string;
  imageUrl?: string;
  categories: string[];
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase, headers } = await requireAuth(request);

  // Get URL search params
  const url = new URL(request.url);
  const myTeamsOnly = url.searchParams.get("myTeamsOnly") === "true";
  const newsCategory = url.searchParams.get("category") || undefined;

  // Get user's favorite teams
  const favoriteTeamIds = await getFavoriteTeamIds(supabase, user.id);

  // Fetch injuries
  let injuriesQuery = supabase
    .from("injury_reports")
    .select(
      `
      id,
      player_name,
      injury_type,
      status,
      description,
      reported_date,
      expected_return,
      source_url,
      team:teams!injury_reports_team_id_fkey(
        id,
        name,
        short_name,
        conference:conferences(name, short_name, is_power_conference)
      )
    `
    )
    .eq("is_active", true);

  if (myTeamsOnly && favoriteTeamIds.length > 0) {
    injuriesQuery = injuriesQuery.in("team_id", favoriteTeamIds);
  }

  const { data: injuries, error: injuriesError } = await injuriesQuery.order("reported_date", { ascending: false });

  if (injuriesError) {
    console.error("Error fetching injuries:", injuriesError);
  }

  // Transform injury data
  const transformedInjuries: InjuryReport[] = (injuries || [])
    .map((injury: InjuryReport) => ({
      ...injury,
      team: Array.isArray(injury.team) ? injury.team[0] : injury.team,
    }))
    .map((injury: InjuryReport) => ({
      ...injury,
      team: {
        ...injury.team,
        conference: Array.isArray(injury.team.conference)
          ? injury.team.conference[0]
          : injury.team.conference,
      },
    }));

  // Fetch news
  let newsArticles: NewsArticle[] = [];
  if (myTeamsOnly && favoriteTeamIds.length > 0) {
    newsArticles = await getNewsByTeams(supabase, favoriteTeamIds, {
      category: newsCategory,
      limit: 50,
    });
  } else {
    newsArticles = await getRecentNews(supabase, {
      category: newsCategory,
      limit: 50,
    });
  }

  // Transform news articles
  const formattedArticles = newsArticles.map((article) => ({
    title: article.title,
    url: article.url,
    source: article.source,
    published_at: article.publishedAt.toISOString(),
    content: article.content || null,
    image_url: article.imageUrl || null,
    categories: article.categories,
  }));

  return {
    user,
    injuries: transformedInjuries,
    articles: formattedArticles,
    category: newsCategory || "all",
    myTeamsOnly,
    hasFavoriteTeams: favoriteTeamIds.length > 0,
    headers,
  };
}

export function meta() {
  return [
    { title: "Updates - College Basketball Picks" },
    {
      name: "description",
      content: "Latest injury reports and news for college basketball",
    },
  ];
}

function getStatusIcon(status: InjuryReport["status"]) {
  switch (status) {
    case "out":
      return <Ban className="h-4 w-4" />;
    case "questionable":
      return <HelpCircle className="h-4 w-4" />;
    case "doubtful":
      return <AlertCircle className="h-4 w-4" />;
    case "day-to-day":
      return <Timer className="h-4 w-4" />;
    case "probable":
      return <TrendingUp className="h-4 w-4" />;
  }
}

function getStatusColor(status: InjuryReport["status"]) {
  switch (status) {
    case "out":
      return "bg-red-500 text-white";
    case "questionable":
      return "bg-yellow-500 text-white";
    case "doubtful":
      return "bg-orange-500 text-white";
    case "day-to-day":
      return "bg-blue-500 text-white";
    case "probable":
      return "bg-green-500 text-white";
  }
}

export default function Updates() {
  const { injuries, articles, category, myTeamsOnly, hasFavoriteTeams } = useLoaderData<typeof loader>();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [conferenceFilter, setConferenceFilter] = useState<string>("all");

  // Get unique conferences for filter dropdown
  const conferences = Array.from(
    new Set(injuries.map((inj) => inj.team.conference.short_name))
  ).sort();

  // Apply filters to injuries
  const filteredInjuries = injuries.filter((injury) => {
    const matchesSearch =
      searchQuery === "" ||
      injury.player_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      injury.team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      injury.team.short_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      injury.injury_type?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "out" && injury.status === "out") ||
      (statusFilter === "questionable" &&
        ["questionable", "doubtful", "day-to-day"].includes(injury.status)) ||
      (statusFilter === "probable" && injury.status === "probable");

    const matchesConference =
      conferenceFilter === "all" ||
      (conferenceFilter === "power" && injury.team.conference.is_power_conference) ||
      (conferenceFilter === "mid-major" && !injury.team.conference.is_power_conference) ||
      injury.team.conference.short_name === conferenceFilter;

    return matchesSearch && matchesStatus && matchesConference;
  });

  const InjuryList = ({ injuries }: { injuries: InjuryReport[] }) => {
    if (injuries.length === 0) {
      return (
        <p className="text-center text-slate-500 dark:text-slate-400 py-8">
          No injury reports available
        </p>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Player</TableHead>
              <TableHead className="font-semibold">Team</TableHead>
              <TableHead className="font-semibold">Conference</TableHead>
              <TableHead className="font-semibold">Injury</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Reported</TableHead>
              <TableHead className="font-semibold">Expected Return</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {injuries.map((injury) => (
              <TableRow key={injury.id}>
                <TableCell className="font-medium whitespace-normal max-w-[200px]">
                  {injury.player_name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {injury.team.short_name}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      injury.team.conference.is_power_conference
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {injury.team.conference.short_name}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-normal max-w-[250px]">
                  <div className="space-y-1">
                    {injury.injury_type && (
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {injury.injury_type}
                      </p>
                    )}
                    {injury.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {injury.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    className={`${getStatusColor(injury.status)} flex items-center gap-1 w-fit`}
                  >
                    {getStatusIcon(injury.status)}
                    <span className="capitalize">{injury.status}</span>
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(injury.reported_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm">
                  {injury.expected_return
                    ? new Date(injury.expected_return).toLocaleDateString()
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
          Updates
        </h1>
        <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-400">
          Latest injury reports and news for college basketball
        </p>
      </div>

      <Tabs defaultValue="injuries" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="injuries" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span>Injuries</span>
          </TabsTrigger>
          <TabsTrigger value="news" className="flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            <span>News</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="injuries" className="space-y-6">
          {/* Injury Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search players, teams, or injury types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="out">Out</SelectItem>
                <SelectItem value="questionable">Questionable</SelectItem>
                <SelectItem value="probable">Probable</SelectItem>
              </SelectContent>
            </Select>
            <Select value={conferenceFilter} onValueChange={setConferenceFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Conference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conferences</SelectItem>
                <SelectItem value="power">Power Conferences</SelectItem>
                <SelectItem value="mid-major">Mid-Major</SelectItem>
                <Separator className="my-2" />
                {conferences.map((conf) => (
                  <SelectItem key={conf} value={conf}>
                    {conf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <MyTeamsFilterToggle />
          </div>

          {/* Injury Results count */}
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Showing {filteredInjuries.length} of {injuries.length} injuries
          </div>

          <InjuryList injuries={filteredInjuries} />

          {injuries.length > 0 && injuries[0].source_url && (
            <div className="mt-6">
              <Separator />
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                Source:{" "}
                <a
                  href={injuries[0].source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  RotoWire Injury Reports
                </a>
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="news" className="space-y-6">
          {/* News Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <NewsFilter />
            {hasFavoriteTeams && <MyTeamsFilterToggle />}
          </div>

          {/* News Articles */}
          {articles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                {myTeamsOnly
                  ? "No articles found for your teams."
                  : "No articles found for this category."}
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                {myTeamsOnly
                  ? "Try selecting different teams or browse all news."
                  : "Check back soon for the latest news!"}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                Showing {articles.length}{" "}
                {myTeamsOnly
                  ? "articles for your teams"
                  : category === "all"
                  ? "articles"
                  : `${category.replace("_", " ")} articles`}
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {articles.map((article, index) => (
                  <NewsCard key={article.url || index} article={article} />
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
