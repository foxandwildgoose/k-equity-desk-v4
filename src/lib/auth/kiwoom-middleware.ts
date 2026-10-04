import { createMiddleware } from "@tanstack/react-start";

/** Reuse real session/gate verification. Never accept the auth-off shared dev user. */
export const kiwoomAccessMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    let kiwoomUserId: string | null = null;
    if (process.env.KIWOOM_FLOW_ENABLED === "true") {
      const { assertSameSiteRequest } = await import("./isolation.server");
      const { getSessionUser } = await import("./verify.server");
      assertSameSiteRequest();
      kiwoomUserId = (await getSessionUser(context.bearerToken))?.id ?? null;
    }
    return next({ context: { kiwoomUserId } });
  });
