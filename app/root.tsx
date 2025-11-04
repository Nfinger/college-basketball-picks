import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { Toaster } from "~/components/ui/sonner";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { FavoriteTeamsProvider } from "~/contexts/FavoriteTeamsContext";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

/**
 * Root loader - Loads user's favorite teams and all teams for the team manager
 * This data is available globally via useRouteLoaderData("root")
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);

  // Get authenticated user (optional - doesn't throw if not logged in)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let favoriteTeams: string[] = [];
  let allTeams: Array<{
    id: string;
    name: string;
    short_name: string;
    conference: {
      id: string;
      name: string;
      short_name: string;
      is_power_conference: boolean;
    };
  }> = [];

  if (user) {
    // Fetch user's favorite team IDs
    const { data: favorites } = await supabase
      .from("user_favorite_teams")
      .select("team_id")
      .eq("user_id", user.id);

    favoriteTeams = favorites?.map((f) => f.team_id) || [];

    // Fetch all teams with conference info for the team manager
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

    allTeams = teams || [];
  }

  return {
    user,
    favoriteTeams,
    allTeams,
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <FavoriteTeamsProvider>
      <Outlet />
    </FavoriteTeamsProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
