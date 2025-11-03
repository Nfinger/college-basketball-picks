import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Index route (today's games)
  index("routes/_index.tsx"),

  // Auth routes
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),

  // Games route
  route("games", "routes/games.tsx"),

  // Metrics route
  route("metrics", "routes/metrics.tsx"),

  // Inngest API route
  route("api/inngest", "routes/api.inngest.tsx"),
] satisfies RouteConfig;
