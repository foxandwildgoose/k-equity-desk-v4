import { createFileRoute } from "@tanstack/react-router";

async function handleAuth(request: Request) {
  const deployed =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.VERCEL || process.env.DATABASE_URL?.trim());
  if (
    process.env.VITE_AUTH_ENABLED === "false" ||
    (deployed &&
      (!process.env.DATABASE_URL?.trim() ||
        !process.env.BETTER_AUTH_SECRET?.trim() ||
        !process.env.BETTER_AUTH_URL?.trim()))
  )
    return Response.json({ status: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  // Keep the server SDK out of the route/SSR entry and load it only after setup checks.
  const { auth } = await import("@/lib/auth/server");
  return auth.handler(request);
}
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
});
