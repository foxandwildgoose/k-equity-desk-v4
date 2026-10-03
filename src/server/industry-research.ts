/**
 * Industry research: Naver upjong search + Hankyung Consensus.
 * Naver PC list requires EUC-KR `upjong` query (pre-encoded in taxonomy).
 */
import type { SectorId } from "@/data/types";
import {
  NAVER_UPJONG_ENC,
  RESEARCH_SECTOR_RULES,
  classifyResearchSectors,
} from "@/data/research-taxonomy";
import { buildResearchExecutiveSummary } from "@/lib/research-utils";
import { decodeHtmlEntities } from "@/lib/readable-text";
import type { ResearchReport } from "@/server/naver-market";
import { sortReportsNewestFirst } from "@/lib/feed/mappers";

const UA =
  "Mozilla/5.0 (compatible; KoreaEquityCommand/1.0; +https://x.ai) AppleWebKit/537.36";

async function getEucKr(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,*/*",
        "Accept-Language": "ko-KR,ko;q=0.9",
        Referer: "https://finance.naver.com/research/industry_list.naver",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    try {
      return new TextDecoder("euc-kr").decode(buf);
    } catch {
      return buf.toString("utf8");
    }
  } finally {
    clearTimeout(t);
  }
}

async function getUtf8(url: string, referer: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,*/*",
        "Accept-Language": "ko-KR,ko;q=0.9",
        Referer: referer,
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function decodeHtml(s: string): string {
  return decodeHtmlEntities(s).replace(/\s+/g, " ").trim();
}

function toIsoDate(raw: string): string {
  const s = raw.trim();
  const m1 = s.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  if (m1) {
    const yy = Number(m1[1]);
    const year = yy >= 70 ? 1900 + yy : 2000 + yy;
    return `${year}.${m1[2]}.${m1[3]}`;
  }
  const m2 = s.match(/(\d{4})[-.](\d{2})[-.](\d{2})/);
  if (m2) return `${m2[1]}.${m2[2]}.${m2[3]}`;
  return s;
}

function naverListUrl(upjong: string, page: number): string {
  const enc = NAVER_UPJONG_ENC[upjong] ?? encodeURIComponent(upjong);
  return `https://finance.naver.com/research/industry_list.naver?page=${page}&searchType=upjong&upjong=${enc}`;
}

export function naverIndustrySearchUrl(upjong: string): string {
  return naverListUrl(upjong, 1);
}

function parseNaverIndustryPage(html: string, sectorId: SectorId, upjong: string): ResearchReport[] {
  const parts = html.split(/industry_read\.naver\?nid=/);
  const out: ResearchReport[] = [];
  for (const part of parts.slice(1)) {
    const idm = part.match(/^(\d+)/);
    if (!idm) continue;
    const nid = Number(idm[1]);
    const titleM = part.match(/>([^<]{2,160})<\/a>/);
    if (!titleM) continue;
    const title = decodeHtml(titleM[1]);
    const tds = [...part.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      decodeHtml(m[1].replace(/<[^>]+>/g, "")),
    ).filter(Boolean);
    const broker = tds.find((t) => /증권|투자|IR|평가|가이드/.test(t)) ?? tds[0] ?? "증권사";
    const dateRaw = tds.find((t) => /\d{2}\.\d{2}\.\d{2}/.test(t)) ?? "";
    const date = toIsoDate(dateRaw);
    const pageUrl = `https://finance.naver.com/research/industry_read.naver?nid=${nid}`;
    const blob = `${title} ${upjong}`;
    out.push({
      researchId: nid,
      title,
      broker,
      date,
      preview: `${upjong} 업종 산업분석 · ${broker}`,
      category: "industry",
      categoryLabel: "산업분석",
      pageUrl,
      pdfUrl: pageUrl,
      summary: buildResearchExecutiveSummary(`${upjong} 업종 산업분석. ${title}`, title),
      sectorIds: [sectorId, ...classifyResearchSectors(blob).filter((s) => s !== sectorId)],
      tags: [upjong, "네이버 업종검색"],
      hasInvestmentView: false,
      sourceKind: "naver",
      sourceLabel: `네이버 · ${upjong}`,
    });
  }
  return out;
}

async function fetchNaverUpjong(
  upjong: string,
  sectorId: SectorId,
  pages = 2,
): Promise<ResearchReport[]> {
  const htmls = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      getEucKr(naverListUrl(upjong, i + 1)).catch(() => ""),
    ),
  );
  return htmls.flatMap((h) => (h ? parseNaverIndustryPage(h, sectorId, upjong) : []));
}

function parseHankyungIndustry(html: string, sectorId: SectorId): ResearchReport[] {
  const rule = RESEARCH_SECTOR_RULES.find((r) => r.sectorId === sectorId);
  const kws = rule?.keywords ?? [];
  const rows = html.split(/<tr/i);
  const out: ResearchReport[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    const idm = row.match(/report_idx=(\d+)/);
    if (!idm) continue;
    const rid = Number(idm[1]);
    if (seen.has(rid)) continue;
    seen.add(rid);
    const titleM =
      row.match(/report_idx=\d+[^>]*>([^<]{2,160})<\/a>/) ??
      row.match(/>([^<]{6,160})<\/a>/);
    if (!titleM) continue;
    const title = decodeHtml(titleM[1]);
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      decodeHtml(m[1].replace(/<[^>]+>/g, " ")),
    );
    const dateRaw = tds.find((t) => /\d{4}-\d{2}-\d{2}/.test(t)) ?? "";
    const broker =
      tds.find((t) => /증권|투자|IR/.test(t) && t.length < 30) ?? "한경 컨센서스";
    const blob = `${title} ${broker}`;
    if (kws.length && !kws.some((k) => blob.toLowerCase().includes(k.toLowerCase()))) {
      continue;
    }
    const pdfUrl = `https://consensus.hankyung.com/analysis/downpdf?report_idx=${rid}`;
    out.push({
      researchId: 8_000_000 + (rid % 1_000_000),
      title,
      broker,
      date: toIsoDate(dateRaw),
      preview: `한경 컨센서스 산업 리포트 · ${broker}`,
      category: "industry",
      categoryLabel: "산업분석",
      pageUrl: pdfUrl,
      pdfUrl,
      summary: buildResearchExecutiveSummary(`한경 컨센서스. ${title}`, title),
      sectorIds: [sectorId, ...classifyResearchSectors(blob).filter((s) => s !== sectorId)],
      tags: ["한경 컨센서스"],
      hasInvestmentView: false,
      sourceKind: "hankyung",
      sourceLabel: "한경 컨센서스",
    });
  }
  return out;
}

async function fetchHankyungForSector(sectorId: SectorId): Promise<ResearchReport[]> {
  const html = await getUtf8(
    "https://consensus.hankyung.com/analysis/list?skinType=industry&pagenum=20",
    "https://consensus.hankyung.com/",
  ).catch(() => "");
  if (!html) return [];
  return parseHankyungIndustry(html, sectorId);
}

function dedupe(list: ResearchReport[]): ResearchReport[] {
  const seen = new Set<string>();
  const out: ResearchReport[] = [];
  for (const r of list) {
    const key = `${r.sourceKind ?? "naver"}:${r.researchId}:${r.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return sortReportsNewestFirst(out);
}

export async function fetchIndustryResearchBySector(
  sectorId: SectorId,
): Promise<{
  reports: ResearchReport[];
  naverCount: number;
  hankyungCount: number;
  upjongs: string[];
  naverUrl: string;
  hankyungUrl: string;
}> {
  const rule = RESEARCH_SECTOR_RULES.find((r) => r.sectorId === sectorId);
  const upjongs = (rule?.naverUpjongs ?? []).filter((u) => NAVER_UPJONG_ENC[u]);
  const [naverLists, hankyung] = await Promise.all([
    Promise.all(upjongs.map((u) => fetchNaverUpjong(u, sectorId, 2).catch(() => []))),
    fetchHankyungForSector(sectorId).catch(() => [] as ResearchReport[]),
  ]);
  const naver = naverLists.flat();
  const reports = dedupe([...naver, ...hankyung]).slice(0, 80);
  return {
    reports,
    naverCount: naver.length,
    hankyungCount: hankyung.length,
    upjongs,
    naverUrl: upjongs[0]
      ? naverIndustrySearchUrl(upjongs[0])
      : "https://finance.naver.com/research/industry_list.naver",
    hankyungUrl: "https://consensus.hankyung.com/analysis/list?skinType=industry",
  };
}
