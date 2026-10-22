import { randomUUID } from "node:crypto";
import { CORE20_HS_PROXY } from "../lib/export-desk/hs-map.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";
import type { TradeObservation } from "../lib/export-desk/parse-import.ts";
import type { LiveTradeBundle } from "./export-trade-pipeline.ts";

export interface TradeCategorySnapshot {
  cacheRevision?: string;
  observations: TradeObservation[];
  providers: ExportProviderStatus[];
}
export interface CachedTrade<T> {
  value: T;
  /** Cache validation time, distinct from the source's statistical reference month. */
  verifiedAt: string;
  freshUntil: string;
  validUntil: string;
  stale: boolean;
}
interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}
type Payload = LiveTradeBundle | TradeCategorySnapshot;
interface StoredRow {
  payload: unknown;
  as_of: string;
  verified_at: string | Date;
  fresh_until: string | Date;
  valid_until: string | Date;
}
const FRESH_MS = 6 * 60 * 60_000;
const RETAIN_MS = 90 * 86_400_000;
const MAX_PAYLOAD_BYTES = 2_000_000;
const officialDomains = [
  "tradedata.go.kr",
  "data.go.kr",
  "customs.go.kr",
  "fred.stlouisfed.org",
  "comtradeplus.un.org",
  "comtradeapi.un.org",
  "sdmx.oecd.org",
  "data-explorer.oecd.org",
  "api.worldbank.org",
  "databank.worldbank.org",
];
const states = new Set([
  "ok",
  "partial",
  "stale",
  "empty",
  "missing-key",
  "invalid-key",
  "rate-limited",
  "unavailable",
  "unverified",
]);
const object = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 2000): v is string =>
  typeof v === "string" && Boolean(v.trim()) && v.length <= max;
const month = (v: unknown): v is string =>
  typeof v === "string" && /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(v);
const number = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const scopeValid = (v: string) => /^[a-z][a-z0-9:._-]{0,119}$/.test(v);
const categoryValid = (id: string) =>
  CORE20_HS_PROXY.some((p) => p.key === id) || /^hs2:\d{2}$|^hs4:\d{4}$/.test(id);
const iso = (v: string | Date) => {
  const time = new Date(v).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

function officialUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      officialDomains.some(
        (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      )
    );
  } catch {
    return false;
  }
}
function validProviders(raw: unknown, now: Date): raw is ExportProviderStatus[] {
  return (
    Array.isArray(raw) &&
    raw.length <= 100 &&
    raw.every(
      (p) =>
        object(p) &&
        text(p.id, 120) &&
        text(p.name) &&
        typeof p.configured === "boolean" &&
        typeof p.state === "string" &&
        states.has(p.state) &&
        text(p.message, 4000) &&
        typeof p.checkedAt === "string" &&
        Number.isFinite(Date.parse(p.checkedAt)) &&
        Date.parse(p.checkedAt) <= now.getTime() + 300_000 &&
        (p.asOf == null || month(p.asOf)) &&
        Number.isInteger(p.recordCount) &&
        number(p.recordCount) &&
        (officialUrl(p.sourceUrl) ||
          (p.id === "trade.cache" &&
            p.sourceUrl === "https://k-equity-desk-v4.vercel.app/export-desk")),
    )
  );
}
function providerEvidence(
  providers: ExportProviderStatus[],
  latest: string,
  saving: boolean,
  selectedId?: string,
): boolean {
  return providers.some(
    (p) =>
      p.id !== "trade.cache" &&
      (!selectedId || p.id === selectedId) &&
      p.configured &&
      p.recordCount > 0 &&
      p.asOf === latest &&
      (p.state === "ok" ||
        p.state === "partial" ||
        (p.state === "stale" && (!saving || !p.reasonCode))),
  );
}
function validObservation(row: unknown, currentMonth: string): row is TradeObservation {
  return (
    object(row) &&
    month(row.period) &&
    row.period < currentMonth &&
    text(row.categoryId, 120) &&
    number(row.valueUsd) &&
    ["HS", "HSK", "MTI", "TOTAL"].includes(String(row.classification)) &&
    text(row.sourceFile, 4000) &&
    !/\b(?:demo|synthetic|mock)\b|합성\s*(?:데이터|숫자)/i.test(row.sourceFile)
  );
}
function validPoints(
  raw: unknown,
  currentMonth: string,
): raw is { period: string; valueUsd: number }[] {
  return (
    Array.isArray(raw) &&
    raw.length <= 2400 &&
    raw.every(
      (p, i) =>
        object(p) &&
        month(p.period) &&
        p.period < currentMonth &&
        number(p.valueUsd) &&
        (i === 0 || String(raw[i - 1].period) < p.period),
    )
  );
}
function currentMonth(now: Date) {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 7);
}
function latestCategory(value: TradeCategorySnapshot): string {
  return value.observations.at(-1)?.period ?? "";
}
function validPayload(value: unknown, key: string, now: Date, saving: boolean): value is Payload {
  if (!object(value) || !validProviders(value.providers, now)) return false;
  const ym = currentMonth(now);
  if (
    !Array.isArray(value.observations) ||
    value.observations.length > 20_000 ||
    !value.observations.every((r) => validObservation(r, ym))
  )
    return false;
  if (key.startsWith("category:")) {
    const id = key.slice(9);
    if (
      !categoryValid(id) ||
      !value.observations.length ||
      !value.observations.every((r) => r.categoryId === id)
    )
      return false;
    if (!value.observations.every((r, i, rows) => i === 0 || rows[i - 1]!.period < r.period))
      return false;
    const matching = value.providers.filter((p) =>
      ["customs.item", "customs-hs", "customs.public-item", `comtrade.hs.${id}`].includes(p.id),
    );
    return providerEvidence(matching, value.observations.at(-1)!.period, saving);
  }
  if (
    key !== "bundle" ||
    !validPoints(value.exports, ym) ||
    !value.exports.length ||
    !validPoints(value.imports, ym)
  )
    return false;
  if (
    !object(value.source) ||
    !text(value.source.totals, 4000) ||
    !text(value.source.items, 4000) ||
    typeof value.source.fetchedAt !== "string" ||
    !Number.isFinite(Date.parse(value.source.fetchedAt)) ||
    Date.parse(value.source.fetchedAt) > now.getTime() + 300_000
  )
    return false;
  if (
    !Array.isArray(value.notes) ||
    value.notes.length > 100 ||
    !value.notes.every((s) => typeof s === "string" && s.length <= 4000) ||
    !Array.isArray(value.news) ||
    value.news.length > 50 ||
    !object(value.destinations) ||
    !Array.isArray(value.destinations.rows) ||
    value.destinations.rows.length > 250 ||
    !value.destinations.rows.every(
      (r) =>
        object(r) &&
        text(r.partnerCode, 10) &&
        text(r.name, 300) &&
        number(r.valueUsd) &&
        (r.share === null ||
          (typeof r.share === "number" &&
            Number.isFinite(r.share) &&
            r.share >= 0 &&
            r.share <= 1)),
    )
  )
    return false;
  if (
    value.destinations.rows.length &&
    (!month(value.destinations.period) || value.destinations.period >= ym)
  )
    return false;
  if (!text(value.source.totalsProviderId, 120)) return false;
  return providerEvidence(
    value.providers,
    value.exports.at(-1)!.period,
    saving,
    value.source.totalsProviderId as string | undefined,
  );
}
function clone<T>(value: T): T {
  return structuredClone(value);
}
export const isVerifiedTradeBundle = (
  value: unknown,
  now = new Date(),
  options: { allowStale?: boolean } = {},
): boolean => validPayload(value, "bundle", now, !options.allowStale);
export const isVerifiedTradeCategory = (
  id: string,
  value: unknown,
  now = new Date(),
  options: { allowStale?: boolean } = {},
): boolean => validPayload(value, `category:${id}`, now, !options.allowStale);

/** Preserve independently verified HS/country data when the totals service fails. */
export function verifiedTradeSupplements(value: unknown, now = new Date()) {
  const none = {
    observations: [] as TradeObservation[],
    destinations: {
      period: "",
      rows: [] as LiveTradeBundle["destinations"]["rows"],
      source: "자료 미확보",
    },
  };
  if (!object(value)) return none;
  const providers = Array.isArray(value.providers)
    ? value.providers.filter((p): p is ExportProviderStatus => validProviders([p], now))
    : [];
  const positive = (p: ExportProviderStatus, period: string) =>
    p.configured &&
    p.recordCount > 0 &&
    p.asOf === period &&
    ["ok", "partial", "stale"].includes(p.state);
  const observations = Array.isArray(value.observations)
    ? value.observations.filter(
        (r): r is TradeObservation =>
          validObservation(r, currentMonth(now)) &&
          r.classification !== "TOTAL" &&
          providers.some(
            (p) =>
              positive(p, r.period) &&
              [
                "customs.item",
                "customs-hs",
                "customs.public-item",
                "comtrade.total",
                `comtrade.hs.${r.categoryId}`,
              ].includes(p.id),
          ),
      )
    : [];
  const destination = value.destinations;
  if (
    !object(destination) ||
    !month(destination.period) ||
    destination.period >= currentMonth(now) ||
    !Array.isArray(destination.rows) ||
    destination.rows.length > 250 ||
    !text(destination.source, 4000) ||
    !providers.some(
      (p) =>
        positive(p, destination.period as string) &&
        ["customs.country", "customs-destinations", "comtrade.destinations"].includes(p.id),
    ) ||
    !destination.rows.every(
      (r) =>
        object(r) &&
        text(r.partnerCode, 10) &&
        text(r.name, 300) &&
        number(r.valueUsd) &&
        (r.share === null ||
          (typeof r.share === "number" &&
            Number.isFinite(r.share) &&
            r.share >= 0 &&
            r.share <= 1)),
    )
  )
    return { ...none, observations };
  return {
    observations,
    destinations: clone(destination as unknown as LiveTradeBundle["destinations"]),
  };
}
function serialize(value: Payload): string | null {
  try {
    const json = JSON.stringify(value);
    return Buffer.byteLength(json, "utf8") <= MAX_PAYLOAD_BYTES ? json : null;
  } catch {
    return null;
  }
}
function cached<T extends Payload>(
  row: StoredRow | undefined,
  key: string,
  now: Date,
): CachedTrade<T> | null {
  if (!row || !validPayload(row.payload, key, now, false)) return null;
  const verifiedAt = iso(row.verified_at),
    freshUntil = iso(row.fresh_until),
    validUntil = iso(row.valid_until);
  if (
    !verifiedAt ||
    !freshUntil ||
    !validUntil ||
    Date.parse(verifiedAt) > now.getTime() + 300_000 ||
    Date.parse(freshUntil) < Date.parse(verifiedAt) ||
    Date.parse(validUntil) < Date.parse(freshUntil) ||
    Date.parse(validUntil) - Date.parse(verifiedAt) > RETAIN_MS ||
    Date.parse(freshUntil) - Date.parse(verifiedAt) > FRESH_MS ||
    Date.parse(validUntil) <= now.getTime()
  )
    return null;
  const value = row.payload as T;
  const latest =
    key === "bundle"
      ? (value as LiveTradeBundle).exports.at(-1)!.period
      : latestCategory(value as TradeCategorySnapshot);
  if (row.as_of !== latest || !serialize(value)) return null;
  return {
    value: clone(value),
    verifiedAt,
    freshUntil,
    validUntil,
    stale: Date.parse(freshUntil) <= now.getTime(),
  };
}

export function createExportTradeStore(sql?: Sql, options: { now?: () => Date } = {}) {
  const now = options.now ?? (() => new Date());
  const memory = new Map<string, StoredRow>();
  const leases = new Map<string, { owner?: string; leaseUntil: number; cooldownUntil: number }>();
  function pruneLeases() {
    const time = now().getTime();
    for (const [key, row] of leases)
      if (row.leaseUntil <= time && row.cooldownUntil <= time) leases.delete(key);
  }
  async function read<T extends Payload>(key: string): Promise<CachedTrade<T> | null> {
    try {
      const rows = sql
        ? await sql.query<StoredRow>(
            "select payload,as_of,verified_at,fresh_until,valid_until from export_trade_snapshots where cache_key=$1 and schema_version=1",
            [key],
          )
        : [memory.get(key)];
      const result = cached<T>(rows[0], key, now());
      if (result && rows[0]) memory.set(key, rows[0]);
      return result;
    } catch {
      sql = undefined;
      return cached<T>(memory.get(key), key, now());
    }
  }
  async function save(key: string, value: Payload): Promise<boolean> {
    const checked = now();
    if (!validPayload(value, key, checked, true)) return false;
    const payload = serialize(value);
    if (!payload) return false;
    const asOf =
      key === "bundle"
        ? (value as LiveTradeBundle).exports.at(-1)!.period
        : latestCategory(value as TradeCategorySnapshot);
    const verifiedAt = checked.toISOString(),
      freshUntil = new Date(checked.getTime() + FRESH_MS).toISOString(),
      validUntil = new Date(checked.getTime() + RETAIN_MS).toISOString();
    try {
      if (sql)
        return (
          (
            await sql.query(
              `insert into export_trade_snapshots(cache_key,schema_version,as_of,payload,verified_at,fresh_until,valid_until)
         values($1,1,$2,$3::jsonb,$4::timestamptz,$5::timestamptz,$6::timestamptz)
         on conflict(cache_key) do update set as_of=excluded.as_of,payload=excluded.payload,verified_at=excluded.verified_at,fresh_until=excluded.fresh_until,valid_until=excluded.valid_until
         where export_trade_snapshots.as_of<=excluded.as_of and export_trade_snapshots.verified_at<=excluded.verified_at returning cache_key`,
              [key, asOf, payload, verifiedAt, freshUntil, validUntil],
            )
          ).length === 1
        );
      const previous = memory.get(key);
      if (previous && previous.as_of > asOf) return false;
      if (memory.size >= 128 && !memory.has(key)) memory.delete(memory.keys().next().value!);
      memory.set(key, {
        as_of: asOf,
        payload: JSON.parse(payload),
        verified_at: verifiedAt,
        fresh_until: freshUntil,
        valid_until: validUntil,
      });
      return true;
    } catch {
      sql = undefined;
      return save(key, value);
    }
  }
  return {
    get storage() {
      return sql ? ("postgres" as const) : ("memory" as const);
    },
    readBundle: () => read<LiveTradeBundle>("bundle"),
    saveBundle: (value: LiveTradeBundle) => save("bundle", value),
    readCategory: (id: string) =>
      categoryValid(id) ? read<TradeCategorySnapshot>(`category:${id}`) : Promise.resolve(null),
    saveCategory: (id: string, value: TradeCategorySnapshot) =>
      categoryValid(id) ? save(`category:${id}`, value) : Promise.resolve(false),
    async acquireRefresh(scope: string, leaseMs = 45_000): Promise<string | null> {
      if (!scopeValid(scope) || !Number.isFinite(leaseMs) || leaseMs < 1000 || leaseMs > 120_000)
        return null;
      const owner = randomUUID();
      try {
        if (sql)
          return (
            await sql.query<{ owner: string }>(
              `insert into export_trade_refresh_state(scope,owner,lease_until) values($1,$2,clock_timestamp()+$3*interval '1 millisecond')
           on conflict(scope) do update set owner=excluded.owner,lease_until=excluded.lease_until
           where (export_trade_refresh_state.lease_until is null or export_trade_refresh_state.lease_until<=clock_timestamp())
             and (export_trade_refresh_state.cooldown_until is null or export_trade_refresh_state.cooldown_until<=clock_timestamp()) returning owner`,
              [scope, owner, leaseMs],
            )
          )[0]?.owner === owner
            ? owner
            : null;
        pruneLeases();
        const previous = leases.get(scope),
          time = now().getTime();
        if (previous && (previous.leaseUntil > time || previous.cooldownUntil > time)) return null;
        if (leases.size >= 256 && !leases.has(scope)) return null;
        leases.set(scope, {
          owner,
          leaseUntil: time + leaseMs,
          cooldownUntil: previous?.cooldownUntil ?? 0,
        });
        return owner;
      } catch {
        sql = undefined;
        return this.acquireRefresh(scope, leaseMs);
      }
    },
    async releaseRefresh(scope: string, owner: string): Promise<void> {
      if (!scopeValid(scope) || !owner) return;
      try {
        if (sql)
          await sql.query(
            "update export_trade_refresh_state set owner=null,lease_until=null where scope=$1 and owner=$2",
            [scope, owner],
          );
        else {
          const previous = leases.get(scope);
          if (previous?.owner === owner)
            leases.set(scope, { ...previous, owner: undefined, leaseUntil: 0 });
        }
      } catch {
        sql = undefined;
        await this.releaseRefresh(scope, owner);
      }
    },
    async setCooldown(scope: string, delayMs: number): Promise<boolean> {
      if (!scopeValid(scope) || !Number.isFinite(delayMs) || delayMs < 1000 || delayMs > 86_400_000)
        return false;
      try {
        if (sql)
          await sql.query(
            `insert into export_trade_refresh_state(scope,cooldown_until) values($1,clock_timestamp()+$2*interval '1 millisecond')
           on conflict(scope) do update set cooldown_until=greatest(export_trade_refresh_state.cooldown_until,excluded.cooldown_until)`,
            [scope, delayMs],
          );
        else {
          pruneLeases();
          const previous = leases.get(scope);
          if (!previous && leases.size >= 256) return false;
          leases.set(scope, {
            owner: previous?.owner,
            leaseUntil: previous?.leaseUntil ?? 0,
            cooldownUntil: Math.max(previous?.cooldownUntil ?? 0, now().getTime() + delayMs),
          });
        }
        return true;
      } catch {
        sql = undefined;
        return this.setCooldown(scope, delayMs);
      }
    },
    async retryAt(scope: string, cooldownOnly = false): Promise<string | null> {
      if (!scopeValid(scope)) return null;
      try {
        if (sql) {
          const field = cooldownOnly ? "cooldown_until" : "greatest(lease_until,cooldown_until)";
          const row = (
            await sql.query<{ retry_at: string | Date | null }>(
              `select ${field}::text as retry_at from export_trade_refresh_state where scope=$1 and ${field}>clock_timestamp()`,
              [scope],
            )
          )[0];
          return row?.retry_at ? iso(row.retry_at) : null;
        }
        const row = leases.get(scope),
          retry = Math.max(cooldownOnly ? 0 : (row?.leaseUntil ?? 0), row?.cooldownUntil ?? 0);
        return retry > now().getTime() ? new Date(retry).toISOString() : null;
      } catch {
        sql = undefined;
        return this.retryAt(scope, cooldownOnly);
      }
    },
  };
}
export type ExportTradeStore = ReturnType<typeof createExportTradeStore>;
export const createMemoryExportTradeStore = (options: { now?: () => Date } = {}) =>
  createExportTradeStore(undefined, options);

function staleProviders(
  providers: ExportProviderStatus[],
  verifiedAt: string,
): ExportProviderStatus[] {
  return providers.map((p) =>
    p.recordCount > 0 && ["ok", "partial", "stale"].includes(p.state)
      ? {
          ...p,
          state: "stale",
          reasonCode: "VERIFIED_CACHE",
          message: `${p.message} · 저장된 공식 검증본(${verifiedAt})입니다. 재조회 실패 또는 진행 중이며 통계 기준월은 유지합니다.`,
        }
      : p,
  );
}
export function staleTradeBundle(
  entry: CachedTrade<LiveTradeBundle>,
  reason = "공식 통계 재조회 실패",
): LiveTradeBundle {
  return {
    ...clone(entry.value),
    providers: staleProviders(entry.value.providers, entry.verifiedAt),
    notes: [
      ...entry.value.notes,
      `${reason} · ${entry.verifiedAt} 저장 검증본을 표시합니다. 조회 시각을 통계 기준월로 바꾸지 않습니다.`,
    ],
  };
}
export function staleTradeCategory(
  entry: CachedTrade<TradeCategorySnapshot>,
): TradeCategorySnapshot {
  return {
    ...clone(entry.value),
    providers: staleProviders(entry.value.providers, entry.verifiedAt),
  };
}

const memoryFallback = createExportTradeStore();
let databaseStore: ExportTradeStore | null = null;
let opening: Promise<ExportTradeStore> | null = null;
let retryAfter = 0;

/** Lazy bounded PostgreSQL; a missing database never initializes a fake durable backend. */
export async function getExportTradeStore(): Promise<ExportTradeStore> {
  if (databaseStore) return databaseStore;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (
    !connectionString ||
    !/^postgres(?:ql)?:\/\//.test(connectionString) ||
    Date.now() < retryAfter
  )
    return memoryFallback;
  opening ??= (async () => {
    let pool: import("pg").Pool | undefined;
    try {
      const { Pool } = await import("pg");
      pool = new Pool({
        connectionString,
        max: 2,
        connectionTimeoutMillis: 2000,
        statement_timeout: 2000,
        query_timeout: 2000,
        idleTimeoutMillis: 10_000,
      });
      pool.on("error", () => {
        databaseStore = null;
        retryAfter = Date.now() + 30_000;
      });
      // Only this checked-in additive migration may bootstrap the public cache.
      // The migration remains the schema source for normal db:migrate runs too.
      const migration = await import("../../migrations/0006_export_trade_cache.sql?raw");
      await pool.query(`BEGIN;\n${migration.default}\nCOMMIT;`);
      const connectedPool = pool;
      databaseStore = createExportTradeStore({
        query: async <T>(query: string, params?: unknown[]) => {
          try {
            return (await connectedPool.query(query, params)).rows as T[];
          } catch (error) {
            databaseStore = null;
            retryAfter = Date.now() + 30_000;
            void connectedPool.end().catch(() => undefined);
            throw error;
          }
        },
      });
      return databaseStore;
    } catch {
      if (pool) void pool.end().catch(() => undefined);
      retryAfter = Date.now() + 30_000;
      return memoryFallback;
    } finally {
      opening = null;
    }
  })();
  return opening;
}
