import { bollingerCollectionRequestSchema, type BollingerCollectionInput } from "../lib/bollinger/collection-request.ts";
import { readBollingerCloudConfig, type BollingerCloudConfig } from "./bollinger-cloud-config.ts";
import { authorizeBollingerCollection } from "./bollinger-operator.ts";

const json = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
const LIMIT = 64 * 1024;

/** Authorization happens before reading choices, loading providers or accessing a database. */
export async function handleSelectedBollingerCollection(
  request: Request,
  run: (config: BollingerCloudConfig, input: BollingerCollectionInput) => Promise<unknown>,
  env: Record<string, string | undefined> = process.env,
) {
  const forbidden = await authorizeBollingerCollection(request, env);
  if (forbidden) return forbidden;
  const config = readBollingerCloudConfig(env);
  if (!config.enabled) return json({ status: "DISABLED" }, 409);
  if (!config.configurationValid) return json({ status: "CONFIGURATION_INVALID" }, 400);
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") return json({ status: "PRODUCTION_DEPLOYMENT_REQUIRED" }, 409);
  if (new URL(request.url).search) return json({ status: "QUERY_NOT_ALLOWED" }, 400);
  let input: BollingerCollectionInput;
  try {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (!Number.isFinite(length) || length < 0 || length > LIMIT) return json({ status: "REQUEST_TOO_LARGE" }, 413);
    const reader = request.body?.getReader();
    if (!reader) return json({ status: "SELECTION_INVALID" }, 400);
    const parts: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT) { await reader.cancel(); return json({ status: "REQUEST_TOO_LARGE" }, 413); }
      parts.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    const parsed = bollingerCollectionRequestSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if (!parsed.success) return json({ status: "SELECTION_INVALID" }, 400);
    input = parsed.data;
  } catch { return json({ status: "SELECTION_INVALID" }, 400); }
  // An explicitly empty watchlist/manual intersection cannot acquire any security.
  if (input.symbols !== undefined && input.symbols.length === 0) return json({ status: "NO_SELECTION" }, 400);
  try { return json(await run(config, input)); }
  catch (error) {
    const safe = ["DATABASE_MISSING", "MIGRATION_0005_REQUIRED", "UNIVERSE_MISSING", "UNIVERSE_UNSUPPORTED", "BOOTSTRAP_TARGET_INVALID", "SELECTION_INVALID", "CONFIGURATION_VERSION_INVALID", "NO_SELECTION"];
    const status = error instanceof Error && safe.includes(error.message) ? error.message : "COLLECTION_FAILED";
    return json({ status }, ["SELECTION_INVALID", "UNIVERSE_UNSUPPORTED", "BOOTSTRAP_TARGET_INVALID", "CONFIGURATION_VERSION_INVALID", "NO_SELECTION"].includes(status) ? 400 : 503);
  }
}
