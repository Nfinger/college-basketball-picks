import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // Index route (games with date filtering)
  
  // Auth routes
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),
  
  layout("routes/layout.tsx", [
    index("routes/_index.tsx"),
    route("updates", "routes/updates.tsx"),
    route("metrics", "routes/metrics.tsx"),
    route("mypicks", "routes/mypicks.tsx"),
    route("rankings", "routes/rankings.tsx", [
      route("me", "routes/rankings.me.tsx"),
      route("bracketology", "routes/rankings.bracketology.tsx"),
      route(":rankingId/edit", "routes/rankings.$rankingId.edit.tsx"),
    ]),
    route("daily", "routes/stat-chain.tsx"),
    route("tournaments/:tournamentId", "routes/tournaments.$tournamentId.tsx"),
    route("admin/scrapers", "routes/admin.scrapers.tsx"),
    route("admin/pipeline", "routes/admin.pipeline.tsx"),
    route("admin/tournaments", "routes/admin.tournaments.tsx"),
    route("admin/tournaments/:tournamentId/import", "routes/admin.tournaments.$tournamentId.import.tsx"),
    route("admin/tournaments/:tournamentId/bracket", "routes/admin.tournaments.$tournamentId.bracket.tsx"),
  ]),

  // Inngest API route
  route("api/inngest", "routes/api.inngest.tsx"),

  // API routes
  route("api/favorites", "routes/api.favorites.tsx"),
  route("api/bracket-picks", "routes/api.bracket-picks.ts"),
  route("api/stats/:teamId", "routes/api.stats.$teamId.ts"),
  route("api/analyze-matchup", "routes/api.analyze-matchup.ts"),
  route("api/og/potd/:pickId", "routes/api.og.potd.$pickId.tsx"),

  // Share routes
  route("share/potd/:pickId", "routes/share.potd.$pickId.tsx"),
] satisfies RouteConfig;
