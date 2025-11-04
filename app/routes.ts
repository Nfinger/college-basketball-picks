import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Index route (games with date filtering)
  index("routes/_index.tsx"),

  // Auth routes
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),
  
  // My Picks route
  route("mypicks", "routes/mypicks.tsx"),

  // Metrics route
  route("metrics", "routes/metrics.tsx"),

  // Inngest API route
  route("api/inngest", "routes/api.inngest.tsx"),
] satisfies RouteConfig;
