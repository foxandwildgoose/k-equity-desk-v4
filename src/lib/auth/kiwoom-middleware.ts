import { createMiddleware } from "@tanstack/react-start";

/** Reuse real session/gate verification. Never accept the auth-off shared dev user. */
export const kiwoomAccessMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    let kiwoomUserId: string | null = null;
    const { assertSameSiteRequest } = await import("./isolation.server");
    assertSameSiteRequest();
    if (process.env.KIWOOM_FLOW_ENABLED === "true" && process.env.VITE_AUTH_ENABLED !== "false") {
      try {
        const { getSessionUser } = await import("./verify.server");
        kiwoomUserId = (await getSessionUser(context.bearerToken))?.id ?? null;
      } catch {
        // Fail closed, without serializing a DB/session error (which may contain secrets).
        kiwoomUserId = null;
      }
    }
    return next({ context: { kiwoomUserId } });
  });
