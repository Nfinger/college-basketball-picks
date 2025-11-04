import { useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { AppLayout } from "~/components/AppLayout";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { AlertCircle, Ban, HelpCircle, Timer, TrendingUp } from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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

export async function loader({ request }: any) {
  const { user, supabase, headers } = await requireAuth(request);

  // Fetch all active injury reports with team and conference info
  const { data: injuries, error } = await supabase
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
    .eq("is_active", true)
    .order("reported_date", { ascending: false });

  if (error) {
    console.error("Error fetching injuries:", error);
  }

  // Transform the data to match our type structure
  const transformedInjuries: InjuryReport[] = (injuries || []).map((injury: any) => ({
    ...injury,
    team: Array.isArray(injury.team) ? injury.team[0] : injury.team,
  })).map((injury: any) => ({
    ...injury,
    team: {
      ...injury.team,
      conference: Array.isArray(injury.team.conference) ? injury.team.conference[0] : injury.team.conference,
    },
  }));

  return { user, injuries: transformedInjuries, headers };
}

export function meta() {
  return [
    { title: "Injury Reports - College Basketball Picks" },
    {
      name: "description",
      content: "Current injury reports for college basketball players",
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

export default function Injuries() {
  const { user, injuries } = useLoaderData<typeof loader>();

  // Group injuries by conference
  const powerConferenceInjuries = injuries.filter(
    (inj) => inj.team.conference.is_power_conference
  );
  const midMajorInjuries = injuries.filter(
    (inj) => !inj.team.conference.is_power_conference
  );

  // Group by status
  const outInjuries = injuries.filter((inj) => inj.status === "out");
  const questionableInjuries = injuries.filter((inj) =>
    ["questionable", "doubtful", "day-to-day"].includes(inj.status)
  );

  const InjuryList = ({ injuries }: { injuries: InjuryReport[] }) => (
    <div className="space-y-3">
      {injuries.length === 0 ? (
        <p className="text-center text-slate-500 dark:text-slate-400 py-8">
          No injury reports available
        </p>
      ) : (
        injuries.map((injury) => (
          <Card
            key={injury.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                      {injury.player_name}
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-xs"
                    >
                      {injury.team.short_name}
                    </Badge>
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
                  </div>

                  {injury.injury_type && (
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {injury.injury_type}
                    </p>
                  )}

                  {injury.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {injury.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Reported:{" "}
                      {new Date(injury.reported_date).toLocaleDateString()}
                    </span>
                    {injury.expected_return && (
                      <span>
                        Expected Return:{" "}
                        {new Date(injury.expected_return).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <Badge
                  className={`${getStatusColor(injury.status)} flex items-center gap-1 whitespace-nowrap`}
                >
                  {getStatusIcon(injury.status)}
                  {injury.status.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Injury Reports
          </h1>
          <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-400">
            Current injury information for college basketball players
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">
              All ({injuries.length})
            </TabsTrigger>
            <TabsTrigger value="out">
              Out ({outInjuries.length})
            </TabsTrigger>
            <TabsTrigger value="questionable">
              Questionable ({questionableInjuries.length})
            </TabsTrigger>
            <TabsTrigger value="power">
              Power ({powerConferenceInjuries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <InjuryList injuries={injuries} />
          </TabsContent>

          <TabsContent value="out" className="mt-6">
            <InjuryList injuries={outInjuries} />
          </TabsContent>

          <TabsContent value="questionable" className="mt-6">
            <InjuryList injuries={questionableInjuries} />
          </TabsContent>

          <TabsContent value="power" className="mt-6">
            <InjuryList injuries={powerConferenceInjuries} />
          </TabsContent>
        </Tabs>

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
      </div>
    </AppLayout>
  );
}
