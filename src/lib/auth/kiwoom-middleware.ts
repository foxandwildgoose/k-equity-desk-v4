import { createMiddleware } from "@tanstack/react-start";

/** Reuse real session/gate verification. Never accept the auth-off shared dev user. */
function kiwoomMiddleware(publicMarketRead: boolean) { return createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    let kiwoomUserId: string | null = null;
    const { assertSameSiteRequest } = await import("./isolation.server");
    assertSameSiteRequest();
    const { readKiwoomConfig } = await import("@/server/kiwoom-config");
    const config = readKiwoomConfig();
    const requiresSession = !publicMarketRead || config.mode === "direct" || config.readAuthRequired || config.targetAuthRequired;
    if (requiresSession && config.enabled && config.authEnabled !== false) {
      try {
        const { getSessionUser } = await import("./verify.server");
        kiwoomUserId = (await getSessionUser(context.bearerToken))?.id ?? null;
      } catch {
        // Fail closed, without serializing a DB/session error (which may contain secrets).
        kiwoomUserId = null;
      }
    }
    return next({ context: { kiwoomUserId } });
  }); }
export const kiwoomAccessMiddleware = kiwoomMiddleware(false);
export const kiwoomMarketReadMiddleware = kiwoomMiddleware(true);
