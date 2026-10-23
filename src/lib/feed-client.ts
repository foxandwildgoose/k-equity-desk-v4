import type { FeedPage, FeedSourceResult, ItemKind, Region } from "./feed/types.ts";

/** 7.5s source fan-out + up to 4s ETF enrichment, plus transport/cold-start margin. */
export const FEED_REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_000_000;

export interface FeedPageRequestOptions {
  region: Region;
  group?: "etf" | "robotics-market" | "robotics-policy";
  kinds?: ItemKind[];
  topics?: string[];
  tickers?: string[];
  limit?: number;
  endpoint?: string;
}

export class FeedRequestError extends Error {
  readonly code: "TIMEOUT" | "HTTP" | "NETWORK" | "INVALID_RESPONSE" | "TOO_LARGE";
  constructor(code: FeedRequestError["code"], message: string) {
    super(message);
    this.name = "FeedRequestError";
    this.code = code;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const string = (value: unknown): value is string => typeof value === "string";
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(string);
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const date = (value: unknown) => string(value) && Number.isFinite(Date.parse(value));
const precision = (value: unknown) => ["second", "minute", "day", "unknown"].includes(value as string);
const optional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);
const nullableNumber = (value: unknown) => value === null || number(value);
function link(value: unknown): boolean {
  if (!string(value)) return false;
  try { return ["https:", "http:"].includes(new URL(value).protocol); }
  catch { return false; }
}

function isFeedItem(item: unknown): boolean {
  if (!record(item)) return false;
  if (!["id", "title", "sourceId", "sourceName"].every((key) => string(item[key]) && item[key].length > 0)) return false;
  if (!link(item.url) || !date(item.fetchedAt) || !precision(item.precision)) return false;
  if (item.publishedAt !== null && !date(item.publishedAt)) return false;
  if (!["news", "research", "disclosure", "filing", "policy", "rating", "briefing"].includes(item.kind as string)) return false;
  if (!["KR", "US", "GLOBAL"].includes(item.region as string) || !["ko", "en"].includes(item.lang as string)) return false;
  if (![1, 2, 3].includes(item.sourceTier as number) || !strings(item.topics) || !strings(item.sectors)) return false;
  if (!Array.isArray(item.tickers) || !item.tickers.every((ticker) => record(ticker) && ["KR", "US"].includes(ticker.market as string) && string(ticker.code) && ticker.code.length > 0)) return false;
  if (!optional(item.snippet, string) || !optional(item.outlet, string) || !optional(item.pdfUrl, link) || !optional(item.seq, number) || !optional(item.paywalled, (v) => typeof v === "boolean")) return false;
  if (!optional(item.importance, (importance) => record(importance) && number(importance.score) && ["flash", "high", "normal"].includes(importance.tier as string) && strings(importance.reasons))) return false;
  if (!optional(item.cluster, (cluster) => record(cluster)
    && string(cluster.id) && Number.isInteger(cluster.size) && (cluster.size as number) >= 1
    && strings(cluster.sources)
    && optional(cluster.members, (members) => Array.isArray(members) && members.every((member) => record(member)
      && ["id", "sourceId", "sourceName", "title"].every((key) => string(member[key]))
      && link(member.url) && (member.publishedAt === null || date(member.publishedAt)) && precision(member.precision)
      && optional(member.paywalled, (v) => typeof v === "boolean"))))) return false;
  if (!optional(item.etf, (etf) => record(etf)
    && string(etf.code) && string(etf.name)
    && ["price", "changePct", "volume", "marketSum"].every((key) => nullableNumber(etf[key]))
    && (etf.issuer === null || string(etf.issuer))
    && (etf.retirementEligible === null || typeof etf.retirementEligible === "boolean"))) return false;
  return true;
}

/** Shared HTTP/BroadcastChannel boundary: validate before any state mutation. */
export function isFeedPage(value: unknown): value is FeedPage {
  try {
    if (!record(value) || !Array.isArray(value.items) || !Array.isArray(value.sources)) return false;
    if (typeof value.partial !== "boolean" || !date(value.generatedAt)) return false;
    if (value.nextCursor !== null && typeof value.nextCursor !== "string") return false;
    return value.sources.every((source) => record(source) && string(source.id) && source.id.length > 0
      && typeof source.ok === "boolean" && Number.isInteger(source.count) && (source.count as number) >= 0
      && optional(source.state, string)) && value.items.every(isFeedItem);
  } catch {
    return false;
  }
}

export async function fetchFeedPage(
  opts: FeedPageRequestOptions,
  cursor: string | null,
  signal?: AbortSignal,
  dependencies: { fetch?: typeof fetch; timeoutMs?: number; maxBytes?: number } = {},
): Promise<FeedPage> {
  const cancelled = () => new DOMException("뉴스 조회가 취소되었습니다.", "AbortError");
  if (signal?.aborted) throw cancelled();
  const controller = new AbortController();
  let timedOut = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let rejectCancellation!: (reason: unknown) => void;
  const cancellation = new Promise<never>((_, reject) => { rejectCancellation = reject; });
  const abort = () => { controller.abort(); rejectCancellation(cancelled()); };
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
    rejectCancellation(new FeedRequestError("TIMEOUT", "뉴스 응답 시간이 초과되었습니다. 다시 불러오기를 눌러 주세요."));
  }, dependencies.timeoutMs ?? FEED_REQUEST_TIMEOUT_MS);

  try {
    const request = async (): Promise<FeedPage> => {
      const params = new URLSearchParams({ region: opts.region, limit: String(opts.limit ?? 50) });
      if (opts.group) params.set("group", opts.group);
      if (opts.kinds?.length) params.set("kinds", opts.kinds.join(","));
      if (opts.topics?.length) params.set("topics", opts.topics.join(","));
      if (opts.tickers?.length) params.set("tickers", opts.tickers.join(","));
      if (cursor) params.set("cursor", cursor);
      const response = await (dependencies.fetch ?? fetch)(`${opts.endpoint ?? "/api/feed"}?${params}`, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        void response.body?.cancel().catch(() => undefined);
        throw cancelled();
      }
      if (!response.ok) {
        void response.body?.cancel().catch(() => undefined);
        throw new FeedRequestError("HTTP", `뉴스 서버가 응답하지 않았습니다(HTTP ${response.status}). 다시 불러오기를 눌러 주세요.`);
      }
      if (!response.body) throw new FeedRequestError("INVALID_RESPONSE", "뉴스 응답 내용을 확인할 수 없습니다. 다시 불러와 주세요.");
      reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > (dependencies.maxBytes ?? MAX_RESPONSE_BYTES)) throw new FeedRequestError("TOO_LARGE", "뉴스 응답이 너무 큽니다. 잠시 후 다시 불러와 주세요.");
        chunks.push(part.value);
      }
      const body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      let page: unknown;
      try { page = JSON.parse(new TextDecoder().decode(body)); }
      catch { throw new FeedRequestError("INVALID_RESPONSE", "뉴스 서버에서 올바른 응답을 받지 못했습니다. 다시 불러와 주세요."); }
      if (!isFeedPage(page)) throw new FeedRequestError("INVALID_RESPONSE", "뉴스 응답 형식을 확인할 수 없습니다. 다시 불러와 주세요.");
      return page;
    };
    return await Promise.race([request(), cancellation]);
  } catch (error) {
    if (signal?.aborted) throw cancelled();
    if (timedOut) throw new FeedRequestError("TIMEOUT", "뉴스 응답 시간이 초과되었습니다. 다시 불러오기를 눌러 주세요.");
    if (error instanceof FeedRequestError) throw error;
    throw new FeedRequestError("NETWORK", "뉴스에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 불러와 주세요.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    controller.abort();
    void reader?.cancel().catch(() => undefined);
  }
}

export function feedEmptyReason(
  sources: FeedSourceResult[],
  loading: boolean,
  filtered: boolean,
  status: { failed?: boolean; paused?: boolean } = {},
): string {
  if (status.paused) return "인터넷 연결을 기다리고 있습니다. 연결 상태를 확인해 주세요.";
  if (loading) return "수신 중…";
  if (status.failed) return "뉴스 조회에 실패했습니다. 다시 불러오기를 눌러 주세요.";
  if (filtered) return "현재 필터에 맞는 항목이 없습니다. 필터를 줄여 보세요.";
  if (!sources.length) return "뉴스와 소스 상태를 받지 못했습니다. 다시 불러오거나 소스 상태를 확인해 주세요.";
  const active = sources.filter((source) => source.state !== "disabled");
  if (!active.length) return "이 화면에 연결된 소스가 모두 비활성 상태입니다.";
  if (active.every((source) => !source.ok)) return `소스 ${active.length}곳 모두 응답하지 않았습니다. 소스 상태를 확인하거나 다시 불러와 주세요.`;
  return "응답한 소스에 표시할 기사가 없습니다.";
}
