import { u as sortOfficialNewestFirst } from "./mappers-DlpCqw-E.mjs";
import { C as rateSentence, S as priorFact, T as tradesFromLines, _ as parseBeaSchedule, b as parseForm4Owner, c as filingArchiveUrl, d as formatXbrlNumber, f as framedAnnualFacts, g as parseBeaCurrentReleases, h as linesFromHtml, i as articleLines, l as filingIndexUrl, o as emptyReport, p as framedQuarterlyFacts, s as factLines, t as PAID_SOURCE_NOTE, v as parseBeigeIndex, w as riskLines, y as parseFomcCalendar } from "./us-official-parse-DdEnQc7w.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/us-official-research-B2JCCI2h.js
/** SEC fair-access UA (D7): real contact from SEC_USER_AGENT; placeholder only as a fallback (flagged in Source Health). */
function secUa() {
	return process.env.SEC_USER_AGENT?.trim() || "KoreaEquityDesk research@example.com";
}
var TTL_MS = 12e5;
var OFFICIAL_UNIVERSE = [
	"NVDA",
	"AAPL",
	"MSFT",
	"AMZN",
	"GOOGL",
	"META"
];
var ALLOW = /* @__PURE__ */ new Set([
	"www.sec.gov",
	"data.sec.gov",
	"www.federalreserve.gov",
	"www.bea.gov",
	"api.bls.gov",
	"home.treasury.gov"
]);
function hostOk(url) {
	try {
		const u = new URL(url);
		return u.protocol === "https:" && ALLOW.has(u.hostname);
	} catch {
		return false;
	}
}
async function getText(url) {
	if (!hostOk(url)) return {
		ok: false,
		status: 0,
		text: "",
		url
	};
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent": secUa(),
				Accept: "text/html,application/json;q=0.9,*/*;q=0.8"
			},
			redirect: "follow",
			signal: AbortSignal.timeout(18e3)
		});
		const finalHost = (() => {
			try {
				return new URL(res.url).hostname;
			} catch {
				return "";
			}
		})();
		if (!ALLOW.has(finalHost)) return {
			ok: false,
			status: res.status,
			text: "",
			url: res.url
		};
		const text = await res.text();
		if (/undeclared automated tool/i.test(text.slice(0, 1500))) return {
			ok: false,
			status: 403,
			text: "",
			url: res.url
		};
		return {
			ok: res.ok,
			status: res.status,
			text,
			url: res.url
		};
	} catch {
		return {
			ok: false,
			status: 0,
			text: "",
			url
		};
	}
}
var secGate = Promise.resolve();
function secGet(url) {
	const run = secGate.then(async () => {
		await new Promise((r) => setTimeout(r, 140));
		return getText(url);
	});
	secGate = run.then(() => void 0, () => void 0);
	return run;
}
var tickerCache = null;
var subCache = /* @__PURE__ */ new Map();
var POLICY_REV = 2;
var policyCache = null;
var universeCache = null;
var companyCache = /* @__PURE__ */ new Map();
var reportCache = /* @__PURE__ */ new Map();
function httpsOrNull(value) {
	if (typeof value !== "string") return null;
	const t = value.trim();
	if (!/^https:\/\//i.test(t)) return null;
	try {
		const u = new URL(t);
		if (u.protocol !== "https:") return null;
		return u.toString();
	} catch {
		return null;
	}
}
async function tickerDirectory() {
	const now = Date.now();
	if (tickerCache && now - tickerCache.at < TTL_MS) return tickerCache.map;
	const res = await secGet("https://www.sec.gov/files/company_tickers.json");
	const map = /* @__PURE__ */ new Map();
	if (res.ok) try {
		const json = JSON.parse(res.text);
		for (const row of Object.values(json)) {
			if (!row?.ticker || row.cik_str == null) continue;
			map.set(row.ticker.toUpperCase(), {
				cik: String(row.cik_str),
				title: row.title || row.ticker
			});
		}
	} catch {}
	if (map.size) tickerCache = {
		at: now,
		map
	};
	return map;
}
async function loadSubmissions(cik) {
	const now = Date.now();
	const hit = subCache.get(cik);
	if (hit && now - hit.at < TTL_MS) return hit.data;
	const res = await secGet(`https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`);
	if (!res.ok) return null;
	try {
		const data = JSON.parse(res.text);
		subCache.set(cik, {
			at: now,
			data
		});
		return data;
	} catch {
		return null;
	}
}
function rowsOf(sub) {
	const r = sub.filings?.recent;
	if (!r?.form) return [];
	const n = r.form.length;
	const out = [];
	for (let i = 0; i < n; i++) out.push({
		form: r.form[i] ?? "",
		filingDate: r.filingDate?.[i] ?? "",
		reportDate: r.reportDate?.[i] ?? "",
		accession: r.accessionNumber?.[i] ?? "",
		items: r.items?.[i] ?? "",
		primary: r.primaryDocument?.[i] ?? "",
		description: r.primaryDocDescription?.[i] ?? ""
	});
	return out;
}
function latest(rows, form) {
	return rows.find((r) => r.form === form) ?? null;
}
var FORM_KO = {
	"10-K": "연차보고서",
	"10-Q": "분기보고서",
	"8-K": "수시보고서",
	"DEF 14A": "위임장",
	"4": "내부자 거래",
	"13F-HR": "기관 보유"
};
function baseFiling(row, name, ticker, sic) {
	const kind = row.form === "DEF 14A" || row.form === "10-K" || row.form === "10-Q" || row.form === "8-K" || row.form === "4" || row.form === "13F-HR" ? row.form : "8-K";
	const url = filingArchiveUrl(row.accession, row.primary);
	const period = /^\d{4}-\d{2}-\d{2}$/.test(row.reportDate) ? row.reportDate : null;
	const itemNote = row.items ? ` Items: ${row.items}.` : "";
	const prose = row.form === "10-K" || row.form === "10-Q" ? "The 10-K/10-Q HTML was not downloaded (submissions list the file at several megabytes). No MD&A or risk-factor prose is shown." : "Primary-document prose was not retrieved for this card.";
	return emptyReport({
		id: `sec-${row.accession}`,
		title: `${name} — Form ${row.form}${period ? ` (period ended ${period})` : ""}`,
		titleKo: `${name} ${FORM_KO[row.form] ?? row.form}`,
		kind,
		badge: row.form,
		badgeKo: FORM_KO[row.form] ?? row.form,
		sourceName: "SEC EDGAR",
		publishedAt: /^\d{4}-\d{2}-\d{2}$/.test(row.filingDate) ? row.filingDate : null,
		tickers: [ticker],
		sectors: sic ? [sic] : [],
		url,
		indexUrl: filingIndexUrl(row.accession),
		accession: row.accession,
		summaryStatus: "not-retrieved",
		summaryLabel: null,
		bottomLine: null,
		notes: [prose + itemNote, row.description ? `SEC description: ${row.description}.` : "SEC did not include a primary-document description."]
	});
}
function applyExtract(report, lines, label) {
	const bullets = factLines(lines).slice(0, 8);
	if (!bullets.length) return {
		...report,
		summaryStatus: "not-retrieved",
		notes: [...report.notes, "The document was retrieved but no usable extract lines were parsed."]
	};
	const joined = lines.join(" ");
	const risks = riskLines(lines);
	return {
		...report,
		summaryStatus: "document-extract",
		summaryLabel: label,
		bottomLine: bullets[0] ?? null,
		bullets,
		risks,
		whatChanged: lines.find((l) => /from a year ago|from the previous quarter|revised|compared with/i.test(l)) ?? null,
		implications: "Possible market relevance is only what the extracted lines themselves state. This page does not add a buy or sell view.",
		notes: [...report.notes.filter((n) => !n.startsWith("Primary-document")), "Extracts may be shortened. They are not a paraphrase."],
		nextWatch: joined.match(/outlook[\s\S]{0,40}/i) ? lines.find((l) => /outlook|dividend|will pay|expected to be/i.test(l)) ?? null : lines.find((l) => /dividend|expected to be/i.test(l)) ?? null
	};
}
var conceptCache = /* @__PURE__ */ new Map();
async function conceptJson(cik, tag) {
	const key = `${cik}:${tag}`;
	const now = Date.now();
	const hit = conceptCache.get(key);
	if (hit && now - hit.at < TTL_MS) return hit.json;
	const res = await secGet(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik.padStart(10, "0")}/us-gaap/${tag}.json`);
	if (!res.ok) {
		conceptCache.set(key, {
			at: now,
			json: null
		});
		return null;
	}
	try {
		const json = JSON.parse(res.text);
		conceptCache.set(key, {
			at: now,
			json
		});
		return json;
	} catch {
		conceptCache.set(key, {
			at: now,
			json: null
		});
		return null;
	}
}
async function xbrlFigures(cik, accession) {
	const tags = [
		"Revenues",
		"NetIncomeLoss",
		"EarningsPerShareDiluted",
		"OperatingIncomeLoss"
	];
	const figs = [];
	for (const tag of tags) {
		const json = await conceptJson(cik, tag);
		if (!json) continue;
		const units = json.units ?? {};
		const unitKey = units.USD ? "USD" : units["USD/shares"] ? "USD/shares" : Object.keys(units)[0];
		if (!unitKey) continue;
		const quarterly = framedQuarterlyFacts(units[unitKey] ?? []);
		const annual = framedAnnualFacts(units[unitKey] ?? []);
		const fromQuarter = [...quarterly].reverse().find((f) => f.accn === accession);
		const latest = fromQuarter ?? [...annual].reverse().find((f) => f.accn === accession);
		if (!latest || typeof latest.val !== "number") continue;
		const prior = priorFact(fromQuarter ? quarterly : annual, latest);
		figs.push({
			metric: `${json.label || tag} (${tag}, ${unitKey})`,
			period: `${latest.fp} FY${latest.fy ?? "?"} · ${latest.start ?? "start not stated"} to ${latest.end} · frame ${latest.frame} · filed ${latest.filed ?? "?"} · ${latest.form}`,
			actual: formatXbrlNumber(latest.val),
			prior: prior ? `${formatXbrlNumber(prior.val)} (${prior.fp} FY${prior.fy ?? "?"} ended ${prior.end}, frame ${prior.frame})` : null,
			source: `SEC XBRL companyconcept ${tag}, accession ${latest.accn}`
		});
	}
	return figs;
}
function withXbrl(report, figs) {
	if (!figs.length) return report;
	const bullets = figs.slice(0, 8).map((f) => `${f.metric}: ${f.actual}. Period: ${f.period}. Prior framed fact: ${f.prior ?? "none in companyconcept"}. ${f.source}.`);
	const changed = figs.filter((f) => f.prior).map((f) => `${f.metric.split(" (")[0]} is ${f.actual} versus ${f.prior}.`).join(" ");
	return {
		...report,
		summaryStatus: "xbrl-extract",
		summaryLabel: "Structured extract from SEC XBRL companyconcept. Not a prose reading of the 10-K or 10-Q. The filing HTML was not downloaded.",
		bottomLine: bullets[0] ?? report.bottomLine,
		bullets,
		keyFigures: figs,
		whatChanged: changed ? `Comparison of two framed quarterly XBRL facts. This is arithmetic context, not a growth rate the company printed. ${changed}` : null,
		risks: [],
		implications: "Possible market relevance is limited to these reported XBRL figures. This page does not issue a buy or sell view.",
		notes: [...report.notes, "Risk-factor text was not retrieved, so none is listed."]
	};
}
async function loadPressRelease(accession) {
	if (!/^\d{10}-\d{2}-\d{6}$/.test(accession)) return null;
	const cik = String(Number(accession.slice(0, 10)));
	const accn = accession.replace(/-/g, "");
	const idx = await secGet(`https://www.sec.gov/Archives/edgar/data/${cik}/${accn}/index.json`);
	if (!idx.ok) return null;
	let names = [];
	try {
		names = (JSON.parse(idx.text).directory?.item ?? []).map((i) => i.name ?? "").filter(Boolean);
	} catch {
		return null;
	}
	const pr = names.find((n) => /pr\.htm$/i.test(n)) ?? names.find((n) => /99/.test(n) && /\.htm$/i.test(n) && !/commentary/i.test(n));
	if (!pr || pr.includes("..") || pr.startsWith("/")) return null;
	const docUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accn}/${pr}`;
	const doc = await secGet(docUrl);
	if (!doc.ok || doc.text.length < 500 || doc.text.length > 8e5) return null;
	return {
		name: pr,
		url: doc.url || docUrl,
		html: doc.text
	};
}
async function loadForm4(row) {
	const url = filingArchiveUrl(row.accession, row.primary);
	if (!url) return null;
	const doc = await secGet(url);
	if (!doc.ok) return null;
	const owner = parseForm4Owner(doc.text);
	const trades = tradesFromLines(linesFromHtml(doc.text, 8e4));
	const bullets = [...owner ? [`Reporting person parsed from the Form 4: ${owner}.`] : [], ...trades].slice(0, 8);
	return emptyReport({
		id: `sec-${row.accession}`,
		title: `Form 4${owner ? ` — ${owner}` : ""}`,
		titleKo: `Form 4 내부자 보고${owner ? ` · ${owner}` : ""}`,
		kind: "4",
		badge: "Form 4",
		badgeKo: "내부자",
		sourceName: "SEC EDGAR",
		publishedAt: /^\d{4}-\d{2}-\d{2}$/.test(row.filingDate) ? row.filingDate : null,
		url,
		indexUrl: filingIndexUrl(row.accession),
		accession: row.accession,
		summaryStatus: bullets.length ? "document-extract" : "not-retrieved",
		summaryLabel: bullets.length ? "Fields parsed from the Form 4 HTML. Not a full holding history." : null,
		bottomLine: bullets[0] ?? null,
		bullets,
		notes: ["Transaction codes are printed as on the form (S sale, P purchase, A award, and so on)."]
	});
}
function pickLink(m, kind) {
	return m.links.find((l) => l.kind === kind)?.url ?? null;
}
function sortIsoDesc(rows) {
	return [...rows].sort((a, b) => a.iso && b.iso ? a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0 : a.iso ? -1 : 1);
}
async function narrativeFrom(url, article) {
	const res = await getText(url);
	if (!res.ok) return null;
	const lines = article ? articleLines(res.text) : linesFromHtml(res.text, 14e4);
	return lines.length ? lines : null;
}
function fomcCard(meeting, kind, htmlUrl, pdfUrl, lines, previousRate) {
	const idDate = meeting.iso ?? `${meeting.year}`;
	const badge = kind === "fomc-statement" ? "FOMC statement" : kind === "fomc-minutes" ? "FOMC minutes" : kind === "fomc-sep" ? "SEP" : kind === "fomc-press" ? "Press conference" : "Implementation note";
	const base = emptyReport({
		id: `${kind}-${idDate}`,
		title: `${badge} — ${meeting.dateLabel}`,
		titleKo: kind === "fomc-statement" ? `FOMC 성명 · ${meeting.dateLabel}` : kind === "fomc-minutes" ? `FOMC 의사록 · ${meeting.dateLabel}` : `${badge} · ${meeting.dateLabel}`,
		kind,
		badge,
		badgeKo: kind === "fomc-minutes" ? "의사록" : "통화정책",
		sourceName: "Federal Reserve",
		publishedAt: meeting.iso,
		sectors: ["Macro"],
		url: htmlUrl,
		pdfUrl,
		summaryStatus: "not-retrieved",
		notes: ["Dates and links come from the FOMC calendar HTML."]
	});
	if (!lines) return base;
	const bullets = factLines(lines).slice(0, 8);
	if (!bullets.length) return {
		...base,
		notes: [...base.notes, "HTML was retrieved but no extract lines were kept."]
	};
	const rate = rateSentence(lines.join(" "));
	let whatChanged = null;
	if (rate && previousRate && rate !== previousRate) whatChanged = `This statement: ${rate} Prior statement retrieved for comparison: ${previousRate}`;
	else if (rate) whatChanged = "A prior statement was not compared, so no change versus the previous decision is stated.";
	const next = null;
	return {
		...base,
		summaryStatus: "document-extract",
		summaryLabel: "Extracted from the official Federal Reserve HTML. Not a paraphrase and not the full document.",
		bottomLine: bullets[0] ?? null,
		bullets,
		whatChanged,
		risks: riskLines(lines),
		implications: "Possible market relevance is the decision and wording the Committee published. This page does not convert that into a trade.",
		nextWatch: next
	};
}
function beaId(url) {
	return `bea-${url.replace("https://www.bea.gov/news/", "").replace(/[^a-z0-9/-]/gi, "").replace(/\//g, "-")}`;
}
async function beaCard(release, industry) {
	const lines = await narrativeFrom(release.url, false);
	const base = emptyReport({
		id: beaId(release.url),
		title: release.title,
		titleKo: release.title,
		kind: industry ? "industry" : "bea-release",
		badge: industry ? "Industry" : "BEA",
		badgeKo: industry ? "산업" : "BEA",
		sourceName: "U.S. Bureau of Economic Analysis",
		sectors: [industry ? "Industry" : "Macro"],
		url: release.url,
		notes: ["Title and URL were taken from the BEA current-releases page, then the release page was fetched."]
	});
	if (!lines) return {
		...base,
		notes: [...base.notes, "Release page text was not retrieved."]
	};
	const bullets = factLines(lines).slice(0, 8);
	if (!bullets.length) return base;
	return {
		...base,
		summaryStatus: "document-extract",
		summaryLabel: "Opening lines extracted from the BEA release HTML.",
		bottomLine: bullets[0] ?? null,
		bullets,
		whatChanged: lines.find((l) => /revised|revision|compared to the first/i.test(l)) ?? null,
		risks: riskLines(lines),
		implications: "Possible market relevance is limited to the figures and wording in the extract. No trade is recommended."
	};
}
async function blsCard(seriesId) {
	const url = `https://api.bls.gov/publicAPI/v1/timeseries/data/${seriesId}`;
	const res = await getText(url);
	if (!res.ok) return null;
	let points = [];
	try {
		const json = JSON.parse(res.text);
		if (json.status !== "REQUEST_SUCCEEDED") return null;
		points = json.Results?.series?.[0]?.data ?? [];
	} catch {
		return null;
	}
	const latest = points[0];
	if (!latest?.value || !latest.year || !latest.periodName) return null;
	const prior = points[1];
	const foot = (latest.footnotes ?? []).map((f) => [f.code, f.text].filter(Boolean).join(": ")).filter(Boolean);
	const period = `${latest.periodName} ${latest.year}`;
	const bullets = [
		`Series ${seriesId}, observation ${period}: ${latest.value}.`,
		prior?.value ? `Previous observation in the same API response: ${prior.periodName} ${prior.year}: ${prior.value}.` : "The API response did not include an earlier observation.",
		"No 12-month percent change and no consensus comparison are in this payload, so neither is shown.",
		foot.length ? `API footnote: ${foot.join("; ")}.` : "The latest observation had no footnote text."
	];
	return emptyReport({
		id: `bls-${seriesId}`,
		title: `BLS series ${seriesId} — ${period}`,
		titleKo: `BLS ${seriesId} · ${period}`,
		kind: "bls-series",
		badge: "Macro",
		badgeKo: "거시",
		sourceName: "U.S. Bureau of Labor Statistics Public API",
		sectors: ["Macro"],
		url,
		summaryStatus: "document-extract",
		summaryLabel: "Values copied from the BLS API JSON. The JSON has no series-title field, so the card is named by the series id that was requested. bls.gov news-release HTML was not retrieved.",
		bottomLine: bullets[0] ?? null,
		bullets,
		keyFigures: [{
			metric: seriesId,
			period,
			actual: latest.value,
			prior: prior?.value ? `${prior.value} (${prior.periodName} ${prior.year})` : null,
			source: "BLS Public API v1"
		}],
		notes: ["The API value is shown unscaled. A unit is not added unless the payload states one."],
		implications: "Possible market relevance is the observation itself. This is not a buy or sell view."
	});
}
function calendarFromPolicy(meetings, beige, schedule) {
	const events = [];
	for (const m of meetings) {
		if (m.year < 2026) continue;
		const statement = pickLink(m, "statement-html");
		events.push({
			id: `cal-fomc-${m.iso ?? m.dateLabel}`,
			iso: m.iso,
			dateLabel: m.dateLabel,
			timeLabel: null,
			title: statement ? "FOMC meeting (statement link on the Fed calendar)" : "FOMC meeting (no statement link on the calendar yet)",
			sourceName: "Federal Reserve FOMC calendar",
			url: statement ?? "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
			kind: statement ? "released" : "scheduled"
		});
	}
	for (const row of beige) {
		if (row.year < 2026) continue;
		events.push({
			id: `cal-beige-${row.iso ?? row.label}`,
			iso: row.iso,
			dateLabel: `${row.label}, ${row.year}`,
			timeLabel: null,
			title: row.scheduledOnly ? "Beige Book (date printed, document not yet linked)" : "Beige Book",
			sourceName: "Federal Reserve Beige Book",
			url: row.htmlUrl ?? row.pdfUrl,
			kind: row.scheduledOnly ? "scheduled" : "released"
		});
	}
	for (const row of schedule) events.push({
		id: `cal-bea-${row.iso ?? row.dateLabel}-${row.title.slice(0, 48).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
		iso: row.iso,
		dateLabel: row.dateLabel,
		timeLabel: row.timeLabel,
		title: row.title,
		sourceName: "BEA release schedule",
		url: "https://www.bea.gov/news/schedule",
		kind: "scheduled"
	});
	return events;
}
async function fetchUsOfficialPolicy() {
	const now = Date.now();
	if (policyCache && policyCache.rev === POLICY_REV && now - policyCache.at < TTL_MS) return policyCache.data;
	const errors = [];
	const [fomc, beigeRes, beaCurrent, beaSched, treas] = await Promise.all([
		getText("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"),
		getText("https://www.federalreserve.gov/monetarypolicy/publications/beige-book-default.htm"),
		getText("https://www.bea.gov/news/current-releases"),
		getText("https://www.bea.gov/news/schedule"),
		getText("https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding")
	]);
	let meetings = [];
	if (!fomc.ok) errors.push("FOMC calendar page was not retrieved.");
	else {
		meetings = parseFomcCalendar(fomc.text);
		if (!meetings.length) errors.push("FOMC calendar HTML did not yield meeting rows.");
	}
	let beige = [];
	if (!beigeRes.ok) errors.push("Beige Book index was not retrieved.");
	else {
		beige = parseBeigeIndex(beigeRes.text);
		if (!beige.length) errors.push("Beige Book index HTML did not yield rows.");
	}
	let releases = [];
	if (!beaCurrent.ok) errors.push("BEA current releases page was not retrieved.");
	else releases = parseBeaCurrentReleases(beaCurrent.text);
	const schedule = beaSched.ok ? parseBeaSchedule(beaSched.text) : [];
	if (!beaSched.ok) errors.push("BEA release schedule was not retrieved. Upcoming BEA dates are omitted.");
	const recentMeetings = sortIsoDesc(meetings.filter((m) => m.iso && m.iso <= (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)));
	const withStatement = recentMeetings.filter((m) => pickLink(m, "statement-html"));
	const latestStmt = withStatement[0] ?? null;
	const prevStmt = withStatement[1] ?? null;
	const latestMin = recentMeetings.find((m) => pickLink(m, "minutes-html")) ?? null;
	const latestSep = recentMeetings.find((m) => pickLink(m, "sep-html")) ?? null;
	const latestPress = recentMeetings.find((m) => pickLink(m, "press")) ?? null;
	const latestBeige = sortIsoDesc(beige.filter((b) => b.htmlUrl && b.iso))[0] ?? null;
	const gdp = releases.find((r) => /\bGDP\b/i.test(r.title) && !/industr/i.test(r.title)) ?? null;
	const pce = releases.find((r) => /personal income and outlays/i.test(r.title)) ?? null;
	const industryRel = releases.find((r) => /industr/i.test(r.title)) ?? null;
	const [stmtLines, prevLines, minLines, beigeLines, gdpCard, pceCard, indCard, cpi, unemp, pay, ppi] = await Promise.all([
		latestStmt ? narrativeFrom(pickLink(latestStmt, "statement-html"), true) : Promise.resolve(null),
		prevStmt ? narrativeFrom(pickLink(prevStmt, "statement-html"), true) : Promise.resolve(null),
		latestMin ? narrativeFrom(pickLink(latestMin, "minutes-html"), true) : Promise.resolve(null),
		latestBeige?.htmlUrl ? narrativeFrom(latestBeige.htmlUrl, true) : Promise.resolve(null),
		gdp ? beaCard(gdp, false) : Promise.resolve(null),
		pce ? beaCard(pce, false) : Promise.resolve(null),
		industryRel ? beaCard(industryRel, true) : Promise.resolve(null),
		blsCard("CUUR0000SA0"),
		blsCard("LNS14000000"),
		blsCard("CES0000000001"),
		blsCard("WPSFD49207")
	]);
	const macro = [];
	if (latestStmt) {
		const card = fomcCard(latestStmt, "fomc-statement", pickLink(latestStmt, "statement-html"), pickLink(latestStmt, "statement-pdf"), stmtLines, prevLines ? rateSentence(prevLines.join(" ")) : null);
		const nextMeeting = meetings.find((m) => m.iso && latestStmt.iso && m.iso > latestStmt.iso && m.year >= latestStmt.year);
		macro.push({
			...card,
			nextWatch: nextMeeting ? `Next FOMC date printed on the calendar after this meeting: ${nextMeeting.dateLabel}.` : "No later FOMC date was parsed from the calendar."
		});
	}
	if (latestMin) macro.push(fomcCard(latestMin, "fomc-minutes", pickLink(latestMin, "minutes-html"), pickLink(latestMin, "minutes-pdf"), minLines, null));
	if (latestSep) macro.push(emptyReport({
		id: `fomc-sep-${latestSep.iso}`,
		title: `Summary of Economic Projections — ${latestSep.dateLabel}`,
		titleKo: `경제전망 요약(SEP) · ${latestSep.dateLabel}`,
		kind: "fomc-sep",
		badge: "SEP",
		badgeKo: "전망",
		sourceName: "Federal Reserve",
		publishedAt: latestSep.iso,
		sectors: ["Macro"],
		url: pickLink(latestSep, "sep-html"),
		pdfUrl: pickLink(latestSep, "sep-pdf"),
		summaryStatus: "not-retrieved",
		notes: ["The projections table is linked from the FOMC calendar. Its cell values were not copied, so no dot-plot numbers are shown."]
	}));
	if (latestPress) macro.push(emptyReport({
		id: `fomc-press-${latestPress.iso}`,
		title: `FOMC press conference — ${latestPress.dateLabel}`,
		titleKo: `FOMC 기자회견 · ${latestPress.dateLabel}`,
		kind: "fomc-press",
		badge: "Press conference",
		badgeKo: "기자회견",
		sourceName: "Federal Reserve",
		publishedAt: latestPress.iso,
		sectors: ["Macro"],
		url: pickLink(latestPress, "press"),
		summaryStatus: "not-retrieved",
		notes: ["Calendar link only. The transcript was not retrieved, so there is no summary."]
	}));
	if (latestBeige?.htmlUrl) {
		const card = emptyReport({
			id: `beige-${latestBeige.iso ?? latestBeige.label}`,
			title: `Beige Book — ${latestBeige.label}, ${latestBeige.year}`,
			titleKo: `베이지북 · ${latestBeige.label} ${latestBeige.year}`,
			kind: "beige-book",
			badge: "Beige Book",
			badgeKo: "베이지북",
			sourceName: "Federal Reserve",
			publishedAt: latestBeige.iso,
			sectors: ["Macro"],
			url: latestBeige.htmlUrl,
			pdfUrl: latestBeige.pdfUrl,
			notes: ["Link taken from the Beige Book index. District detail after the national summary is in the original."]
		});
		macro.push(beigeLines ? applyExtract(card, beigeLines, "National-summary lines extracted from the Beige Book HTML.") : card);
	}
	if (gdpCard) macro.push(gdpCard);
	if (pceCard) macro.push(pceCard);
	for (const card of [
		cpi,
		unemp,
		pay,
		ppi
	]) if (card) macro.push(card);
	if (!cpi) errors.push("BLS CPI series CUUR0000SA0 was not retrieved. No CPI figure is shown.");
	const industry = [];
	if (indCard) industry.push(indCard);
	else errors.push("No industry-titled release was parsed from the BEA current-releases page.");
	const featured = [
		macro.find((r) => r.kind === "fomc-statement"),
		macro.find((r) => r.kind === "fomc-minutes"),
		macro.find((r) => r.kind === "beige-book"),
		gdpCard,
		indCard,
		cpi
	].filter((r) => Boolean(r)).slice(0, 8);
	const hubs = [
		{
			id: "hub-edgar",
			label: "SEC EDGAR search",
			labelKo: "EDGAR 검색",
			url: "https://www.sec.gov/edgar/search/",
			note: "Company filings on this desk are loaded from data.sec.gov submissions, not from a scraped search."
		},
		{
			id: "hub-fomc",
			label: "FOMC calendars",
			labelKo: "FOMC 일정",
			url: fomc.ok ? "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm" : null,
			note: fomc.ok ? "Calendar page retrieved." : "Calendar page was not retrieved, so the link is withheld."
		},
		{
			id: "hub-bea",
			label: "BEA release schedule",
			labelKo: "BEA 발표 일정",
			url: beaSched.ok ? "https://www.bea.gov/news/schedule" : null,
			note: beaSched.ok ? "Schedule page retrieved." : "Schedule page was not retrieved."
		},
		{
			id: "hub-treasury",
			label: "Treasury quarterly refunding",
			labelKo: "재무부 분기 환수",
			url: treas.ok ? "https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding" : null,
			note: treas.ok ? "The hub page returned HTTP 200, but the release list is not in the HTML (it is rendered in the browser). No refunding date or amount is shown." : "Treasury refunding page was not retrieved."
		},
		{
			id: "hub-bls",
			label: "BLS public API",
			labelKo: "BLS API",
			url: cpi?.url ?? null,
			note: "bls.gov news-release HTML was blocked from this server, so CPI, PPI, and payrolls are shown only from the public API when that call succeeds."
		}
	];
	const data = {
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		featured,
		macro,
		industry,
		calendar: calendarFromPolicy(meetings, beige, schedule).slice(0, 40),
		hubs,
		errors,
		paidNote: PAID_SOURCE_NOTE
	};
	policyCache = {
		at: Date.now(),
		rev: POLICY_REV,
		data
	};
	return data;
}
async function companyBundle(symbol, opts) {
	const ticker = symbol.trim().toUpperCase();
	const errors = [];
	const map = await tickerDirectory();
	const hit = map.get(ticker);
	if (!hit) return {
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		symbol: ticker,
		name: null,
		cik: null,
		sic: null,
		website: null,
		investorWebsite: null,
		filings: [],
		earnings: [],
		form4: [],
		holdings: [],
		errors: map.size ? [`${ticker} is not in the SEC company_tickers.json file this server retrieved.`] : ["SEC company_tickers.json was not retrieved, so no filing list is shown."]
	};
	const sub = await loadSubmissions(hit.cik);
	if (!sub) return {
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		symbol: ticker,
		name: hit.title,
		cik: hit.cik,
		sic: null,
		website: null,
		investorWebsite: null,
		filings: [],
		earnings: [],
		form4: [],
		holdings: [],
		errors: [`SEC submissions for CIK ${hit.cik} were not retrieved.`]
	};
	const name = sub.name || hit.title;
	const sic = sub.sicDescription || "";
	const rows = rowsOf(sub);
	const filings = [];
	for (const form of [
		"10-Q",
		"10-K",
		"DEF 14A"
	]) {
		const row = latest(rows, form);
		if (row) filings.push(baseFiling(row, name, ticker, sic));
	}
	const eight = rows.filter((r) => r.form === "8-K").slice(0, 6);
	for (const row of eight) filings.push(baseFiling(row, name, ticker, sic));
	const earningsRow = rows.find((r) => r.form === "8-K" && r.items.split(",").map((s) => s.trim()).includes("2.02"));
	const earnings = [];
	if (earningsRow) {
		const card = baseFiling(earningsRow, name, ticker, sic);
		card.kind = "earnings-release";
		card.badge = "Earnings 8-K";
		card.badgeKo = "실적 8-K";
		card.title = `${name} — earnings 8-K (item 2.02, filed ${earningsRow.filingDate || "date not stated"})`;
		if (opts.exhibit) {
			const ex = await loadPressRelease(earningsRow.accession);
			if (ex) {
				const extracted = applyExtract({
					...card,
					id: `sec-${earningsRow.accession}-ex-${ex.name.replace(/\.htm$/i, "").replace(/[^a-z0-9]+/gi, "").slice(0, 40)}`,
					url: ex.url,
					title: `${name} — Exhibit 99 earnings release filed ${earningsRow.filingDate}`,
					titleKo: `${name} 실적 보도자료 (Exhibit)`,
					badge: "Earnings release",
					badgeKo: "실적 발표"
				}, linesFromHtml(ex.html), "Lines extracted from the earnings exhibit HTML attached to the 8-K. Not a sell-side note.");
				earnings.push(extracted);
			} else earnings.push({
				...card,
				notes: [...card.notes, "The exhibit index or press-release HTML was not retrieved. The 8-K cover page is linked instead."]
			});
		} else earnings.push(card);
	}
	if (opts.xbrl) for (const kind of ["10-Q", "10-K"]) {
		const filing = filings.find((f) => f.kind === kind && f.accession);
		if (!filing?.accession) continue;
		const figs = await xbrlFigures(hit.cik, filing.accession);
		const idx = filings.findIndex((f) => f.id === filing.id);
		if (idx >= 0) filings[idx] = withXbrl(filings[idx], figs);
	}
	const form4 = [];
	const form4Rows = rows.filter((r) => r.form === "4").slice(0, opts.form4 ? 1 : 3);
	if (opts.form4 && form4Rows[0]) {
		const parsed = await loadForm4(form4Rows[0]);
		if (parsed) {
			parsed.tickers = [ticker];
			parsed.sectors = sic ? [sic] : [];
			parsed.title = `${name} — ${parsed.title}`;
			form4.push(parsed);
		}
	} else for (const row of form4Rows) {
		const card = baseFiling(row, name, ticker, sic);
		form4.push(card);
	}
	const hold = latest(rows, "13F-HR");
	const holdings = hold ? [{
		...baseFiling(hold, name, ticker, sic),
		notes: ["This 13F-HR is a filing by the issuer CIK in the submissions feed. It is not a list of funds that own the stock. The information table was not parsed."]
	}] : [];
	if (!filings.length) errors.push("No 10-K, 10-Q, DEF 14A, or 8-K rows were in the recent submissions feed.");
	return {
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		symbol: ticker,
		name,
		cik: hit.cik,
		sic: sic || null,
		website: httpsOrNull(sub.website),
		investorWebsite: httpsOrNull(sub.investorWebsite),
		filings,
		earnings,
		form4,
		holdings,
		errors
	};
}
async function fetchUsOfficialCompany(symbol) {
	const ticker = symbol.trim().toUpperCase();
	const now = Date.now();
	const hit = companyCache.get(ticker);
	if (hit && now - hit.at < TTL_MS) return hit.data;
	const data = await companyBundle(ticker, {
		form4: true,
		xbrl: true,
		exhibit: true
	});
	companyCache.set(ticker, {
		at: Date.now(),
		data
	});
	return data;
}
async function fetchUsOfficialUniverse() {
	if (universeCache && Date.now() - universeCache.at < TTL_MS) return universeCache.data;
	const errors = [];
	const packs = [];
	for (const symbol of OFFICIAL_UNIVERSE) packs.push(await companyBundle(symbol, {
		form4: false,
		xbrl: false,
		exhibit: false
	}));
	let newestEarn = null;
	for (const pack of packs) {
		errors.push(...pack.errors.map((e) => `${pack.symbol}: ${e}`));
		const earn = pack.earnings[0];
		if (!earn?.accession || !earn.publishedAt) continue;
		if (!newestEarn || earn.publishedAt > newestEarn.filed) newestEarn = {
			filed: earn.publishedAt,
			symbol: pack.symbol,
			accession: earn.accession
		};
	}
	const filings = packs.flatMap((p) => p.filings.filter((f) => f.kind === "10-Q" || f.kind === "10-K" || f.kind === "DEF 14A" || f.badge === "8-K"));
	const earnings = packs.flatMap((p) => p.earnings);
	let featuredFiling = null;
	const newestQ = sortOfficialNewestFirst(filings.filter((f) => f.kind === "10-Q" && f.publishedAt && f.accession))[0];
	if (newestQ?.accession) {
		const pack = packs.find((p) => p.symbol === newestQ.tickers[0]);
		if (pack?.cik) featuredFiling = withXbrl(newestQ, await xbrlFigures(pack.cik, newestQ.accession));
	}
	if (newestEarn) {
		const ex = await loadPressRelease(newestEarn.accession);
		const idx = earnings.findIndex((e) => e.accession === newestEarn.accession);
		if (ex && idx >= 0) earnings[idx] = applyExtract({
			...earnings[idx],
			id: `sec-${newestEarn.accession}-ex-${ex.name.replace(/\.htm$/i, "").replace(/[^a-z0-9]+/gi, "").slice(0, 40)}`,
			url: ex.url,
			kind: "earnings-release",
			badge: "Earnings release",
			badgeKo: "실적 발표",
			title: `${earnings[idx].tickers[0] ?? newestEarn.symbol} — Exhibit 99 earnings release`
		}, linesFromHtml(ex.html), "Lines extracted from the earnings exhibit HTML. Not a sell-side note.");
	}
	const data = {
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		filings,
		earnings,
		featuredFiling,
		errors: errors.filter(Boolean)
	};
	universeCache = {
		at: Date.now(),
		data
	};
	return data;
}
function cacheReport(report, id) {
	reportCache.set(id, {
		at: Date.now(),
		data: report
	});
	return report;
}
async function fetchUsOfficialReport(id) {
	const key = id.trim();
	const cached = reportCache.get(key);
	if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
	if (key.startsWith("bls-")) {
		const series = key.slice(4);
		if (!/^[A-Z0-9]+$/.test(series)) return cacheReport(null, key);
		return cacheReport(await blsCard(series), key);
	}
	if (key.startsWith("bea-")) {
		const policy = await fetchUsOfficialPolicy();
		return cacheReport([...policy.macro, ...policy.industry].find((r) => r.id === key) ?? null, key);
	}
	if (key.startsWith("fomc-") || key.startsWith("beige-")) {
		const policy = await fetchUsOfficialPolicy();
		return cacheReport(policy.macro.find((r) => r.id === key) ?? policy.featured.find((r) => r.id === key) ?? null, key);
	}
	const sec = /^sec-(\d{10}-\d{2}-\d{6})(?:-ex-([a-z0-9]+))?$/i.exec(key);
	if (!sec) return cacheReport(null, key);
	const accession = sec[1];
	const cik = String(Number(accession.slice(0, 10)));
	const sub = await loadSubmissions(cik);
	if (!sub) return cacheReport(null, key);
	const row = rowsOf(sub).find((r) => r.accession === accession);
	if (!row) return cacheReport(null, key);
	const ticker = sub.tickers?.[0] ?? "";
	let report = baseFiling(row, sub.name || "Issuer", ticker, sub.sicDescription || "");
	if (row.form === "10-Q" || row.form === "10-K") report = withXbrl(report, await xbrlFigures(cik, accession));
	else if (row.form === "4") {
		const parsed = await loadForm4(row);
		if (parsed) report = {
			...parsed,
			title: `${sub.name || "Issuer"} — ${parsed.title}`,
			tickers: ticker ? [ticker] : []
		};
	} else if (sec[2] || row.form === "8-K" && row.items.includes("2.02")) {
		const ex = await loadPressRelease(accession);
		if (ex) report = applyExtract({
			...report,
			id: key.startsWith("sec-") && key.includes("-ex-") ? key : report.id,
			url: ex.url,
			kind: "earnings-release",
			badge: "Earnings release",
			badgeKo: "실적 발표",
			title: `${sub.name || ticker} — Exhibit 99 earnings release`
		}, linesFromHtml(ex.html), "Lines extracted from the earnings exhibit HTML.");
	}
	report.id = key;
	return cacheReport(report, key);
}
/** CIK (no leading zeros) → ticker, from the SEC company_tickers.json directory. */
async function cikTickerMap() {
	const dir = await tickerDirectory();
	const out = /* @__PURE__ */ new Map();
	for (const [ticker, hit] of dir) if (!out.has(hit.cik)) out.set(hit.cik, ticker);
	return out;
}
//#endregion
export { cikTickerMap, fetchUsOfficialCompany, fetchUsOfficialPolicy, fetchUsOfficialReport, fetchUsOfficialUniverse };
