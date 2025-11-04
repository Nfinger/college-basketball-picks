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
  ]),

  // Inngest API route
  route("api/inngest", "routes/api.inngest.tsx"),
] satisfies RouteConfig;
