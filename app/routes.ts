import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // Index route (games with date filtering)
  
  // Auth routes
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),
  
  layout("routes/layout.tsx", [
    index("routes/_index.tsx"),
    route("injuries", "routes/injuries.tsx"),
    route("metrics", "routes/metrics.tsx"),
    route("mypicks", "routes/mypicks.tsx"),
    route("fantasy", "routes/fantasy.tsx"),
    route("news", "routes/news.tsx"),
    route("admin/scrapers", "routes/admin.scrapers.tsx"),
  ]),

  // Inngest API route
  route("api/inngest", "routes/api.inngest.tsx"),

  // API routes
  route("api/favorites", "routes/api.favorites.tsx"),
  route("api/stats/:teamId", "routes/api.stats.$teamId.ts"),
  route("api/analyze-matchup", "routes/api.analyze-matchup.ts"),
  route("api/og/potd/:pickId", "routes/api.og.potd.$pickId.tsx"),

  // Share routes
  route("share/potd/:pickId", "routes/share.potd.$pickId.tsx"),
] satisfies RouteConfig;
