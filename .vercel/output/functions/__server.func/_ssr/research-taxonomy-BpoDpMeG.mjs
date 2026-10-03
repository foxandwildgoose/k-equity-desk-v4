//#region node_modules/.nitro/vite/services/ssr/assets/research-taxonomy-BpoDpMeG.js
var MIN_EXPANDING = 8;
function sampleMean(xs) {
	if (!xs.length) return null;
	let s = 0;
	for (const x of xs) s += x;
	return s / xs.length;
}
/** Sample standard deviation (n − 1). Null when n < 2. */
function sampleSigma(xs) {
	if (xs.length < 2) return null;
	const mean = sampleMean(xs);
	if (mean == null) return null;
	let acc = 0;
	for (const x of xs) {
		const d = x - mean;
		acc += d * d;
	}
	return Math.sqrt(acc / (xs.length - 1));
}
/** Percent of positive sample values that are <= current. */
function percentileRank(sample, current) {
	if (!(current > 0) || !Number.isFinite(current)) return null;
	const xs = sample.filter((v) => Number.isFinite(v) && v > 0);
	if (!xs.length) return null;
	let le = 0;
	for (const v of xs) if (v <= current) le += 1;
	return le / xs.length * 100;
}
function expandingPercentile(values) {
	const hist = [];
	return values.map((v) => {
		if (v == null || !(v > 0) || !Number.isFinite(v)) return null;
		hist.push(v);
		if (hist.length < MIN_EXPANDING) return null;
		return percentileRank(hist, v);
	});
}
function sigmaBands(mean, sigma) {
	if (mean == null || sigma == null || !Number.isFinite(mean) || !Number.isFinite(sigma)) return {
		p1: null,
		m1: null,
		p2: null,
		m2: null
	};
	return {
		p1: mean + sigma,
		m1: mean - sigma,
		p2: mean + 2 * sigma,
		m2: mean - 2 * sigma
	};
}
function sampleQuantile(xs, q) {
	if (!xs.length) return null;
	const sorted = [...xs].sort((a, b) => a - b);
	const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
	const lo = Math.floor(pos);
	const hi = Math.ceil(pos);
	if (lo === hi) return sorted[lo];
	const w = pos - lo;
	return sorted[lo] * (1 - w) + sorted[hi] * w;
}
function statsOf(values) {
	const pos = values.filter((v) => v != null && v > 0 && Number.isFinite(v));
	let current = null;
	for (let i = values.length - 1; i >= 0; i--) {
		const v = values[i];
		if (v != null && v > 0 && Number.isFinite(v)) {
			current = v;
			break;
		}
	}
	const mean = sampleMean(pos);
	const sigma = sampleSigma(pos);
	return {
		n: pos.length,
		mean,
		sigma,
		current,
		percentile: current == null ? null : percentileRank(pos, current),
		p10: sampleQuantile(pos, .1),
		p50: sampleQuantile(pos, .5),
		p90: sampleQuantile(pos, .9),
		...sigmaBands(mean, sigma)
	};
}
function emptyStats() {
	return {
		n: 0,
		mean: null,
		sigma: null,
		current: null,
		percentile: null,
		p10: null,
		p50: null,
		p90: null,
		p1: null,
		m1: null,
		p2: null,
		m2: null
	};
}
/** Net debt (억원) = reported EV − year-end common market cap. */
function netDebtEok(evEok, price, shares) {
	if (evEok == null || price == null || shares == null) return null;
	if (!(price > 0) || !(shares > 0) || !Number.isFinite(evEok)) return null;
	return evEok - price * shares / 1e8;
}
function trailingMultiple(price, fundamental) {
	if (price == null || fundamental == null) return null;
	if (!(price > 0) || !(fundamental > 0) || !Number.isFinite(price) || !Number.isFinite(fundamental)) return null;
	return price / fundamental;
}
/** EV / fundamental. Undefined when fundamental is not strictly positive. */
function evMultiple(evEok, fundamentalEok) {
	if (evEok == null || fundamentalEok == null) return null;
	if (!(fundamentalEok > 0) || !Number.isFinite(evEok) || !Number.isFinite(fundamentalEok)) return null;
	return evEok / fundamentalEok;
}
function fairPriceFromPer(eps, multiple) {
	if (eps == null || multiple == null) return null;
	if (!(eps > 0) || !(multiple > 0)) return null;
	return eps * multiple;
}
/**
* Equity value = fundamental × multiple − net debt.
* fundamental and net debt are 억원; shares are a count; price is KRW.
*/
function fairPriceFromEvMultiple(fundamentalEok, multiple, netDebt, shares) {
	if (fundamentalEok == null || multiple == null || netDebt == null || shares == null) return null;
	if (!(fundamentalEok > 0) || !(multiple > 0) || !(shares > 0) || !Number.isFinite(netDebt)) return null;
	const equityEok = fundamentalEok * multiple - netDebt;
	if (!(equityEok > 0)) return null;
	return equityEok * 1e8 / shares;
}
function extractEncparam(html) {
	const quoted = html.match(/encparam\s*:\s*'([^']+)'/);
	if (quoted?.[1]) return quoted[1];
	return html.match(/encparam=([A-Za-z0-9+/=_-]+)/)?.[1] ?? null;
}
function lastDayIso(year, month) {
	return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}
function parseRatioColumns(yymm) {
	if (!Array.isArray(yymm)) return [];
	const out = [];
	yymm.forEach((raw, i) => {
		const s = String(raw);
		const m = s.match(/(\d{4})\/(\d{2})/);
		if (!m) return;
		const year = Number(m[1]);
		const month = Number(m[2]);
		if (!(month >= 1 && month <= 12)) return;
		out.push({
			index: i + 1,
			year,
			month,
			estimate: /\(E\)/.test(s),
			periodEnd: lastDayIso(year, month)
		});
	});
	return out;
}
function asRecord(v) {
	return v != null && typeof v === "object" ? v : null;
}
function num(v) {
	if (v == null || v === "") return null;
	const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
	return Number.isFinite(n) ? n : null;
}
function findAccount(rows, names) {
	if (!Array.isArray(rows)) return null;
	for (const name of names) for (const row of rows) {
		const rec = asRecord(row);
		if (rec && String(rec.ACC_NM ?? "") === name) return rec;
	}
	return null;
}
function colValue(row, index) {
	if (!row) return null;
	return num(row[`DATA${index}`]);
}
function parseAnnualFundamentals(rpt5, rpt0) {
	const a = asRecord(rpt5);
	const b = asRecord(rpt0);
	const cols = parseRatioColumns(a?.YYMM ?? b?.YYMM);
	const rows5 = a?.DATA;
	const rows0 = b?.DATA;
	const eps = findAccount(rows5, ["EPS"]);
	const per = findAccount(rows5, ["PER"]);
	const ebitda = findAccount(rows5, ["EBITDA＜당기＞", "EBITDA<당기>"]);
	const ev = findAccount(rows5, ["EV＜당기＞", "EV<당기>"]);
	const sales = findAccount(rows5, ["매출액＜당기＞", "매출액<당기>"]);
	const px = findAccount(rows5, ["보통주.수정주가(기말)＜당기＞", "보통주.수정주가(기말)<당기>"]);
	const evEb = findAccount(rows5, ["EV/EBITDA"]);
	const shares = findAccount(rows0, ["발행주식수(보통주)"]);
	const debt = findAccount(rows0, ["이자발생부채"]);
	const annuals = [];
	let consensus = null;
	for (const c of cols) {
		const row = {
			year: c.year,
			periodEnd: c.periodEnd,
			estimate: c.estimate,
			eps: colValue(eps, c.index),
			per: colValue(per, c.index),
			ebitdaEok: colValue(ebitda, c.index),
			salesEok: colValue(sales, c.index),
			evEok: colValue(ev, c.index),
			price: colValue(px, c.index),
			shares: colValue(shares, c.index),
			debtEok: colValue(debt, c.index),
			evEbitda: colValue(evEb, c.index)
		};
		if (c.estimate) {
			if (!consensus && row.eps != null && row.eps > 0) consensus = {
				year: c.year,
				eps: row.eps,
				per: row.per != null && row.per > 0 ? row.per : null
			};
			continue;
		}
		annuals.push(row);
	}
	annuals.sort((x, y) => x.periodEnd < y.periodEnd ? -1 : x.periodEnd > y.periodEnd ? 1 : 0);
	return {
		annuals,
		consensus
	};
}
function parseBandMonthPrices(json) {
	const price = asRecord(asRecord(json)?.bandChart1)?.price;
	if (!Array.isArray(price)) return [];
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const row of price) {
		const rec = asRecord(row);
		if (!rec) continue;
		const x = rec.x;
		const y = num(rec.y);
		if (typeof x !== "number" || y == null || !(y > 0)) continue;
		const date = new Date(x).toISOString().slice(0, 10);
		if (seen.has(date)) continue;
		seen.add(date);
		out.push({
			date,
			price: y
		});
	}
	out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
	return out;
}
/** Yahoo symbol for a Naver Reuters code (NVDA.O) or a bare US ticker. KR codes return null. */
function yahooUsSymbol(raw) {
	const t = raw.trim().toUpperCase().replace(/\s+/g, "");
	if (!t || /^[0-9A-Z]{6}$/.test(t)) return null;
	const stripped = t.replace(/\.(O|N|A|K|Q)$/, "");
	if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(stripped)) return null;
	if (stripped.endsWith(".") || stripped.startsWith(".")) return null;
	return stripped;
}
function fiscalYearOf(v) {
	if (typeof v !== "string") return null;
	const m = v.match(/(19|20)\d{2}/);
	return m ? Number(m[0]) : null;
}
/**
* Nasdaq earnings-forecast: next-twelve-month EPS is the sum of the next four
* quarterly consensus prints. That is a current snapshot, not a history of
* what the Street thought in the past.
*/
function parseNasdaqEarningsForecast(json) {
	const data = asRecord(asRecord(json)?.data);
	if (!data) return null;
	const qWrap = asRecord(data.quarterlyForecast);
	const qRows = Array.isArray(qWrap?.rows) ? qWrap.rows : [];
	const quarters = [];
	for (const row of qRows) {
		const rec = asRecord(row);
		if (!rec) continue;
		const eps = num(rec.consensusEPSForecast);
		const year = fiscalYearOf(rec.fiscalEnd);
		if (eps == null || !(eps > 0) || year == null) continue;
		quarters.push({
			year,
			eps
		});
	}
	if (quarters.length >= 4) {
		const ntm = quarters.slice(0, 4);
		const eps = ntm.reduce((sum, row) => sum + row.eps, 0);
		if (eps > 0) return {
			year: ntm[3].year,
			eps,
			per: null,
			horizon: "ntm"
		};
	}
	const yWrap = asRecord(data.yearlyForecast);
	const yRows = Array.isArray(yWrap?.rows) ? yWrap.rows : [];
	for (const row of yRows) {
		const rec = asRecord(row);
		if (!rec) continue;
		const eps = num(rec.consensusEPSForecast);
		const year = fiscalYearOf(rec.fiscalEnd);
		const estimates = num(rec.noOfEstimates);
		if (eps == null || !(eps > 0) || year == null) continue;
		if (estimates != null && estimates < 3) continue;
		return {
			year,
			eps,
			per: null,
			horizon: "fy1"
		};
	}
	return null;
}
/** Put reported shares onto the same basis as a split-adjusted price. */
function sharesOnPriceBasis(shares, asOf, splits) {
	if (shares == null || !(shares > 0) || !Number.isFinite(shares)) return shares;
	let factor = 1;
	for (const split of splits) if (split.date > asOf && split.factor > 0 && Number.isFinite(split.factor)) factor *= split.factor;
	return shares * factor;
}
function parseYahooSplits(json) {
	const chart = asRecord(asRecord(json)?.chart);
	const splits = asRecord(asRecord((Array.isArray(chart?.result) ? asRecord(chart.result[0]) : null)?.events)?.splits);
	if (!splits) return [];
	const out = [];
	for (const row of Object.values(splits)) {
		const rec = asRecord(row);
		if (!rec) continue;
		const numerator = num(rec.numerator);
		const denominator = num(rec.denominator);
		const stamp = num(rec.date);
		if (numerator == null || denominator == null || !(denominator > 0) || stamp == null) continue;
		out.push({
			date: (/* @__PURE__ */ new Date(stamp * 1e3)).toISOString().slice(0, 10),
			factor: numerator / denominator
		});
	}
	out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
	return out;
}
function parseYahooAdjCloses(json) {
	const chart = asRecord(asRecord(json)?.chart);
	const result = Array.isArray(chart?.result) ? asRecord(chart.result[0]) : null;
	const ts = result?.timestamp;
	if (!result || !Array.isArray(ts)) return [];
	const indicators = asRecord(result.indicators);
	const adjWrap = Array.isArray(indicators?.adjclose) ? asRecord(indicators.adjclose[0]) : null;
	const quoteWrap = Array.isArray(indicators?.quote) ? asRecord(indicators.quote[0]) : null;
	const series = Array.isArray(adjWrap?.adjclose) ? adjWrap.adjclose : quoteWrap?.close;
	if (!Array.isArray(series)) return [];
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (let i = 0; i < ts.length; i++) {
		const t = ts[i];
		const px = num(series[i]);
		if (typeof t !== "number" || px == null || !(px > 0)) continue;
		const date = (/* @__PURE__ */ new Date(t * 1e3)).toISOString().slice(0, 10);
		if (seen.has(date)) continue;
		seen.add(date);
		out.push({
			date,
			price: px
		});
	}
	out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
	return out;
}
function isoDays(a, b) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
	const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
	return Number.isFinite(ms) ? Math.round(ms / 864e5) : null;
}
function secRows(json, ns, tag) {
	const units = asRecord(asRecord(asRecord(asRecord(asRecord(json)?.facts)?.[ns])?.[tag])?.units);
	if (!units) return [];
	const rows = [];
	for (const list of Object.values(units)) {
		if (!Array.isArray(list)) continue;
		for (const row of list) {
			const rec = asRecord(row);
			if (rec) rows.push(rec);
		}
	}
	return rows;
}
function isFilingForm(form) {
	return form === "10-K" || form === "10-Q" || form === "10-K/A" || form === "10-Q/A";
}
/** Keep one value per period end: latest figure, earliest filing date (first time the market saw the period). */
function collectDurationFacts(rows, minDays, maxDays) {
	const best = /* @__PURE__ */ new Map();
	for (const row of rows) {
		if (!isFilingForm(row.form)) continue;
		const start = typeof row.start === "string" ? row.start.slice(0, 10) : "";
		const end = typeof row.end === "string" ? row.end.slice(0, 10) : "";
		const filed = typeof row.filed === "string" ? row.filed.slice(0, 10) : "";
		const val = num(row.val);
		if (!start || !end || !filed || val == null) continue;
		const span = isoDays(start, end);
		if (span == null || span < minDays || span > maxDays) continue;
		const prev = best.get(end);
		if (!prev) {
			best.set(end, {
				end,
				start,
				filed,
				val,
				latest: filed
			});
			continue;
		}
		if (filed < prev.filed) prev.filed = filed;
		if (filed >= prev.latest) {
			prev.val = val;
			prev.start = start;
			prev.latest = filed;
		}
	}
	return [...best.values()].map(({ end, start, filed, val }) => ({
		end,
		start,
		filed,
		val
	})).sort((a, b) => a.end < b.end ? -1 : a.end > b.end ? 1 : 0);
}
function collectInstantFacts(rows) {
	const best = /* @__PURE__ */ new Map();
	for (const row of rows) {
		if (!isFilingForm(row.form)) continue;
		const end = typeof row.end === "string" ? row.end.slice(0, 10) : "";
		const filed = typeof row.filed === "string" ? row.filed.slice(0, 10) : "";
		const val = num(row.val);
		const start = typeof row.start === "string" ? row.start.slice(0, 10) : "";
		if (!end || !filed || val == null) continue;
		if (start && start !== end) {
			const span = isoDays(start, end);
			if (span != null && span > 5) continue;
		}
		const prev = best.get(end);
		if (!prev) {
			best.set(end, {
				end,
				filed,
				val,
				latest: filed
			});
			continue;
		}
		if (filed < prev.filed) prev.filed = filed;
		if (filed >= prev.latest) {
			prev.val = val;
			prev.latest = filed;
		}
	}
	return [...best.values()].map(({ end, filed, val }) => ({
		end,
		filed,
		val
	})).sort((a, b) => a.end < b.end ? -1 : a.end > b.end ? 1 : 0);
}
function dropNearDuplicates(facts) {
	const out = [];
	for (const fact of facts) {
		const prev = out[out.length - 1];
		if (!prev) {
			out.push(fact);
			continue;
		}
		const gap = isoDays(prev.end, fact.end);
		if (gap != null && gap < 60) {
			if (fact.filed >= prev.filed) out[out.length - 1] = fact;
			continue;
		}
		out.push(fact);
	}
	return out;
}
/** Turn year-to-date flows (Q1, 6-month, 9-month, FY sharing one start) into single-quarter amounts. */
function quartersFromCumulative(facts) {
	const groups = /* @__PURE__ */ new Map();
	for (const fact of facts) {
		const list = groups.get(fact.start) ?? [];
		list.push(fact);
		groups.set(fact.start, list);
	}
	const out = [];
	for (const list of groups.values()) {
		list.sort((a, b) => a.end < b.end ? -1 : a.end > b.end ? 1 : 0);
		let prev = 0;
		let prevEnd = list[0]?.start ?? "";
		for (const fact of list) {
			const quarter = fact.val - prev;
			if (Number.isFinite(quarter)) out.push({
				end: fact.end,
				start: prevEnd,
				filed: fact.filed,
				val: quarter
			});
			prev = fact.val;
			prevEnd = fact.end;
		}
	}
	return dropNearDuplicates(out.sort((a, b) => a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
}
/**
* 10-K often has the full year but not a standalone Q4. Q4 = FY − Q1 − Q2 − Q3
* when those three quarters sit inside the fiscal year.
*/
function synthesizeFourthQuarter(quarters, fiscalYears) {
	const q = dropNearDuplicates(quarters);
	const have = new Set(q.map((row) => row.end));
	const extra = [];
	for (const fy of fiscalYears) {
		if ([...have].some((end) => {
			const gap = isoDays(end, fy.end);
			return gap != null && Math.abs(gap) < 40;
		})) continue;
		const inside = q.filter((row) => row.end > fy.start && row.end < fy.end);
		if (inside.length !== 3) continue;
		let sequential = true;
		for (let i = 1; i < inside.length; i++) {
			const gap = isoDays(inside[i - 1].end, inside[i].end);
			if (gap == null || gap < 70 || gap > 130) sequential = false;
		}
		if (!sequential) continue;
		const q4 = fy.val - inside.reduce((sum, row) => sum + row.val, 0);
		if (!Number.isFinite(q4)) continue;
		extra.push({
			end: fy.end,
			start: inside[2].end,
			filed: fy.filed,
			val: q4
		});
		have.add(fy.end);
	}
	return dropNearDuplicates([...q, ...extra].sort((a, b) => a.end < b.end ? -1 : 1));
}
function trailingFourQuarter(quarters) {
	const rows = dropNearDuplicates(quarters);
	const out = [];
	for (let i = 3; i < rows.length; i++) {
		const slice = rows.slice(i - 3, i + 1);
		let ok = true;
		for (let k = 1; k < slice.length; k++) {
			const gap = isoDays(slice[k - 1].end, slice[k].end);
			if (gap == null || gap < 70 || gap > 140) ok = false;
		}
		if (!ok) continue;
		const value = slice.reduce((sum, row) => sum + row.val, 0);
		if (!Number.isFinite(value)) continue;
		out.push({
			periodEnd: slice[3].end,
			availableOn: slice[3].filed,
			value
		});
	}
	return out;
}
function instantAsOf(rows, date) {
	let hit = null;
	for (const row of rows) if (row.end <= date) hit = row.val;
	else break;
	return hit;
}
function ttmAsOf(rows, periodEnd) {
	let best = null;
	let bestGap = 22;
	for (const row of rows) {
		const gap = isoDays(periodEnd, row.periodEnd);
		if (gap == null) continue;
		const abs = Math.abs(gap);
		if (abs < bestGap) {
			bestGap = abs;
			best = row.value;
		}
	}
	return bestGap <= 21 ? best : null;
}
function synthesizeTagged(json, tags) {
	let bestQ = [];
	let bestFy = [];
	let bestEnd = "";
	let bestScore = -1;
	for (const tag of tags) {
		const q = collectDurationFacts(secRows(json, "us-gaap", tag), 70, 120);
		const fy = collectDurationFacts(secRows(json, "us-gaap", tag), 300, 380);
		const score = q.length + fy.length;
		const end = [...q, ...fy].reduce((max, row) => row.end > max ? row.end : max, "");
		if (score === 0) continue;
		if (end > bestEnd || end === bestEnd && score > bestScore) {
			bestEnd = end;
			bestScore = score;
			bestQ = q;
			bestFy = fy;
		}
	}
	return synthesizeFourthQuarter(bestQ, bestFy);
}
function longestInstant(json, ns, tags) {
	let best = [];
	for (const tag of tags) {
		const rows = collectInstantFacts(secRows(json, ns, tag));
		if (rows.length > best.length) best = rows;
	}
	return best;
}
/** SEC companyfacts → PIT rows the KR annual builder already understands. */
function annualsFromCompanyFacts(json) {
	const name = typeof asRecord(json)?.entityName === "string" ? String(asRecord(json)?.entityName) : null;
	const epsQ = synthesizeTagged(json, ["EarningsPerShareDiluted", "EarningsPerShareBasic"]);
	const salesQ = synthesizeTagged(json, [
		"Revenues",
		"RevenueFromContractWithCustomerExcludingAssessedTax",
		"SalesRevenueNet",
		"RevenueFromContractWithCustomerIncludingAssessedTax"
	]);
	const oiQ = synthesizeTagged(json, ["OperatingIncomeLoss"]);
	let daFacts = [];
	let daEnd = "";
	for (const tag of [
		"DepreciationDepletionAndAmortization",
		"DepreciationAndAmortization",
		"Depreciation"
	]) {
		const facts = [
			...collectDurationFacts(secRows(json, "us-gaap", tag), 70, 120),
			...collectDurationFacts(secRows(json, "us-gaap", tag), 150, 200),
			...collectDurationFacts(secRows(json, "us-gaap", tag), 240, 300),
			...collectDurationFacts(secRows(json, "us-gaap", tag), 300, 380)
		];
		const end = facts.reduce((max, row) => row.end > max ? row.end : max, "");
		if (!facts.length) continue;
		if (end > daEnd || end === daEnd && facts.length > daFacts.length) {
			daFacts = facts;
			daEnd = end;
		}
	}
	const daQ = quartersFromCumulative(daFacts);
	const epsTtm = trailingFourQuarter(epsQ);
	const salesTtm = trailingFourQuarter(salesQ);
	const oiTtm = trailingFourQuarter(oiQ);
	const daTtm = trailingFourQuarter(daQ);
	const shares = collectInstantFacts([...secRows(json, "dei", "EntityCommonStockSharesOutstanding"), ...secRows(json, "us-gaap", "CommonStockSharesOutstanding")]);
	let debtIsTotal = false;
	let debtLong = collectInstantFacts(secRows(json, "us-gaap", "LongTermDebtNoncurrent"));
	if (!debtLong.length) {
		debtLong = longestInstant(json, "us-gaap", ["LongTermDebtAndCapitalLeaseObligations", "LongTermDebt"]);
		debtIsTotal = debtLong.length > 0;
	}
	const debtCurrent = debtIsTotal ? [] : (() => {
		const primary = collectInstantFacts(secRows(json, "us-gaap", "LongTermDebtCurrent"));
		return primary.length ? primary : longestInstant(json, "us-gaap", [
			"DebtCurrent",
			"ShortTermBorrowings",
			"CommercialPaper"
		]);
	})();
	const cashPrimary = collectInstantFacts(secRows(json, "us-gaap", "CashAndCashEquivalentsAtCarryingValue"));
	const cash = cashPrimary.length ? cashPrimary : longestInstant(json, "us-gaap", ["CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "Cash"]);
	const annuals = [];
	for (const row of epsTtm) {
		const sales = ttmAsOf(salesTtm, row.periodEnd);
		const oi = ttmAsOf(oiTtm, row.periodEnd);
		const da = ttmAsOf(daTtm, row.periodEnd);
		const ebitda = oi != null && da != null ? oi + da : null;
		const available = row.availableOn >= row.periodEnd ? row.availableOn : row.periodEnd;
		const sh = instantAsOf(shares, available);
		const debt = sumOrNull(instantAsOf(debtLong, available), instantAsOf(debtCurrent, available));
		const cashVal = instantAsOf(cash, available);
		const netDebt = debt != null && cashVal != null ? debt - cashVal : null;
		annuals.push({
			year: Number(available.slice(0, 4)),
			periodEnd: available,
			estimate: false,
			eps: row.value,
			per: null,
			ebitdaEok: ebitda == null ? null : ebitda / 1e8,
			salesEok: sales == null ? null : sales / 1e8,
			evEok: null,
			price: null,
			shares: sh,
			debtEok: debt == null ? null : debt / 1e8,
			evEbitda: null,
			netDebtEok: netDebt == null ? null : netDebt / 1e8
		});
	}
	annuals.sort((a, b) => a.periodEnd < b.periodEnd ? -1 : a.periodEnd > b.periodEnd ? 1 : 0);
	return {
		annuals,
		name
	};
}
function sumOrNull(a, b) {
	if (a == null && b == null) return null;
	return (a ?? 0) + (b ?? 0);
}
function yearMonth(date) {
	return date.slice(0, 7);
}
function pitAnnual(annuals, date) {
	const key = yearMonth(date);
	let hit = null;
	for (const a of annuals) {
		if (a.estimate) continue;
		const end = a.periodEnd;
		const month = Number(end.slice(5, 7));
		const year = Number(end.slice(0, 4));
		if (Number.isFinite(year) && month >= 1 && month <= 12 && lastDayIso(year, month) === end ? yearMonth(end) <= key : end <= date) hit = a;
		else break;
	}
	return hit;
}
function posMult(m) {
	return m != null && m > 0 && Number.isFinite(m) ? m : null;
}
function seriesFrom(dates, prices, values, bands, basis) {
	const pct = expandingPercentile(values);
	return {
		points: dates.map((date, i) => ({
			date,
			value: values[i] ?? null,
			percentile: pct[i] ?? null
		})),
		priceBands: bands,
		stats: statsOf(values),
		unit: "배",
		basis
	};
}
var NOTE = "네이버 컴퍼니가이드 IFRS 연결. 후행 PER·EV 배수는 직전 결산 실적을 결산일부터 적용한다(공시 시차 미반영). 선행 PER은 최신 연간 컨센서스 EPS로 나눈 값이며 과거 시점의 당시 컨센서스가 아니다. EV = 보통주 시가총액 + 결산기말 순차입금(공시 EV − 당시 보통주 시가총액). EPS≤0이면 PER 없음, EBITDA≤0이면 EV/EBITDA 없음.";
function emptyValuationPack(code, note) {
	const basis = "데이터 없음";
	const empty = () => ({
		points: [],
		priceBands: [],
		stats: emptyStats(),
		unit: "배",
		basis
	});
	return {
		code,
		source: "none",
		sourceUrl: "",
		note,
		name: null,
		currency: "KRW",
		drivers: [],
		window: {
			from: null,
			to: null
		},
		consensus: null,
		per: empty(),
		forwardPer: empty(),
		evEbitda: empty(),
		evSales: empty(),
		valuationBand: {
			basis: "none",
			basisLabel: "밸류에이션 밴드 없음",
			points: [],
			percentilePoints: [],
			stats: emptyStats(),
			note
		}
	};
}
function buildValuationPack(input) {
	const annuals = [...input.annuals].filter((a) => !a.estimate).sort((x, y) => x.periodEnd < y.periodEnd ? -1 : x.periodEnd > y.periodEnd ? 1 : 0);
	let months = [...input.months].filter((m) => m.price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(m.date));
	if (!months.length) months = annuals.filter((a) => a.price != null && a.price > 0).map((a) => ({
		date: a.periodEnd,
		price: a.price
	}));
	const seen = /* @__PURE__ */ new Set();
	months = months.filter((m) => {
		if (seen.has(m.date)) return false;
		seen.add(m.date);
		return true;
	}).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
	if (!annuals.length || !months.length) return emptyValuationPack(input.code, "이 종목의 연간 투자지표 또는 월별 주가를 확인하지 못했습니다. ETF·재무 미수록 종목은 배수를 만들지 않습니다.");
	const dates = [];
	const prices = [];
	const perV = [];
	const fwdV = [];
	const evEbV = [];
	const evSaV = [];
	const epsAt = [];
	const ebitdaAt = [];
	const salesAt = [];
	const ndAt = [];
	const shAt = [];
	const drivers = [];
	const cns = input.consensus && input.consensus.eps > 0 ? input.consensus.eps : null;
	for (const m of months) {
		const a = pitAnnual(annuals, m.date);
		const nd = a ? a.netDebtEok != null && Number.isFinite(a.netDebtEok) ? a.netDebtEok : netDebtEok(a.evEok, a.price, a.shares) : null;
		const shares = a?.shares ?? null;
		let ev = null;
		if (shares != null && shares > 0 && nd != null) ev = m.price * shares / 1e8 + nd;
		dates.push(m.date);
		prices.push(m.price);
		epsAt.push(a?.eps ?? null);
		ebitdaAt.push(a?.ebitdaEok ?? null);
		salesAt.push(a?.salesEok ?? null);
		ndAt.push(nd);
		shAt.push(shares);
		drivers.push({
			date: m.date,
			price: m.price,
			eps: a?.eps ?? null,
			ebitdaEok: a?.ebitdaEok ?? null,
			salesEok: a?.salesEok ?? null,
			netDebtEok: nd,
			shares
		});
		perV.push(trailingMultiple(m.price, a?.eps ?? null));
		fwdV.push(trailingMultiple(m.price, cns));
		evEbV.push(evMultiple(ev, a?.ebitdaEok ?? null));
		evSaV.push(evMultiple(ev, a?.salesEok ?? null));
	}
	const perStats = statsOf(perV);
	const fwdStats = statsOf(fwdV);
	const evEbStats = statsOf(evEbV);
	const evSaStats = statsOf(evSaV);
	const perBands = dates.map((date, i) => ({
		date,
		price: prices[i] ?? null,
		mean: fairPriceFromPer(epsAt[i] ?? null, posMult(perStats.mean)),
		p1: fairPriceFromPer(epsAt[i] ?? null, posMult(perStats.p1)),
		m1: fairPriceFromPer(epsAt[i] ?? null, posMult(perStats.m1)),
		p2: fairPriceFromPer(epsAt[i] ?? null, posMult(perStats.p2)),
		m2: fairPriceFromPer(epsAt[i] ?? null, posMult(perStats.m2))
	}));
	const fwdBands = dates.map((date, i) => ({
		date,
		price: prices[i] ?? null,
		mean: fairPriceFromPer(cns, posMult(fwdStats.mean)),
		p1: fairPriceFromPer(cns, posMult(fwdStats.p1)),
		m1: fairPriceFromPer(cns, posMult(fwdStats.m1)),
		p2: fairPriceFromPer(cns, posMult(fwdStats.p2)),
		m2: fairPriceFromPer(cns, posMult(fwdStats.m2))
	}));
	const evEbBands = dates.map((date, i) => ({
		date,
		price: prices[i] ?? null,
		mean: fairPriceFromEvMultiple(ebitdaAt[i] ?? null, posMult(evEbStats.mean), ndAt[i] ?? null, shAt[i] ?? null),
		p1: fairPriceFromEvMultiple(ebitdaAt[i] ?? null, posMult(evEbStats.p1), ndAt[i] ?? null, shAt[i] ?? null),
		m1: fairPriceFromEvMultiple(ebitdaAt[i] ?? null, posMult(evEbStats.m1), ndAt[i] ?? null, shAt[i] ?? null),
		p2: fairPriceFromEvMultiple(ebitdaAt[i] ?? null, posMult(evEbStats.p2), ndAt[i] ?? null, shAt[i] ?? null),
		m2: fairPriceFromEvMultiple(ebitdaAt[i] ?? null, posMult(evEbStats.m2), ndAt[i] ?? null, shAt[i] ?? null)
	}));
	const evSaBands = dates.map((date, i) => ({
		date,
		price: prices[i] ?? null,
		mean: fairPriceFromEvMultiple(salesAt[i] ?? null, posMult(evSaStats.mean), ndAt[i] ?? null, shAt[i] ?? null),
		p1: fairPriceFromEvMultiple(salesAt[i] ?? null, posMult(evSaStats.p1), ndAt[i] ?? null, shAt[i] ?? null),
		m1: fairPriceFromEvMultiple(salesAt[i] ?? null, posMult(evSaStats.m1), ndAt[i] ?? null, shAt[i] ?? null),
		p2: fairPriceFromEvMultiple(salesAt[i] ?? null, posMult(evSaStats.p2), ndAt[i] ?? null, shAt[i] ?? null),
		m2: fairPriceFromEvMultiple(salesAt[i] ?? null, posMult(evSaStats.m2), ndAt[i] ?? null, shAt[i] ?? null)
	}));
	const perBasis = "후행 PER = 수정주가 ÷ 직전 결산(또는 TTM) EPS. EPS가 0 이하이면 그 구간은 표시하지 않음.";
	const money = input.currency === "USD" ? "달러" : "원";
	const digits = input.currency === "USD" ? 2 : 0;
	const cnsText = cns == null ? "" : input.consensus?.horizon === "ntm" ? `NTM ${cns.toLocaleString("en-US", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	})}${money}` : `${input.consensus.year}E ${cns.toLocaleString(input.currency === "USD" ? "en-US" : "ko-KR", { maximumFractionDigits: digits })}${money}`;
	const fwdBasis = cns ? `선행 PER = 수정주가 ÷ 최신 컨센서스 EPS (${cnsText}). 과거 시점의 당시 컨센서스가 아니다. 시계열은 동일 EPS로 나눈 경로다.` : "컨센서스 EPS가 없어 선행 PER을 계산하지 않음.";
	const evEbBasis = "EV/EBITDA. EV = 당시 보통주 시가총액 + 직전 결산 순차입금. EBITDA≤0이면 미표시.";
	const evSaBasis = "EV/Sales. 매출은 적자 구간에도 양수이면 사용. 밴드는 관측 EV/Sales의 평균 ±1σ ±2σ를 당시 매출·순차입금에 투영한 가격.";
	const per = seriesFrom(dates, prices, perV, perBands, perBasis);
	const forwardPer = seriesFrom(dates, prices, fwdV, fwdBands, fwdBasis);
	const evEbitda = seriesFrom(dates, prices, evEbV, evEbBands, evEbBasis);
	const evSales = seriesFrom(dates, prices, evSaV, evSaBands, evSaBasis);
	const perCurrent = per.stats.current != null;
	let basis = "none";
	if (perCurrent && per.stats.n >= 8) basis = "per";
	else if (evSales.stats.n >= 8) basis = "evSales";
	else if (perCurrent && per.stats.n >= 2) basis = "per";
	else if (evSales.stats.n >= 2) basis = "evSales";
	const chosen = basis === "per" ? per : basis === "evSales" ? evSales : null;
	const valuationBand = {
		basis,
		basisLabel: basis === "per" ? "후행 PER 평균 ±1σ ±2σ를 당시 EPS에 곱해 주가에 투영" : basis === "evSales" ? "EV/Sales 평균 ±1σ ±2σ를 당시 매출·순차입금에 투영 (PER 표본 부족 또는 EPS≤0)" : "밴드를 그릴 양의 배수 표본이 부족함",
		points: chosen?.priceBands ?? [],
		percentilePoints: chosen?.points ?? [],
		stats: chosen?.stats ?? emptyStats(),
		note: "가격 밴드의 배수는 전체 관측 구간의 평균·표준편차(사후)다. 백분위 선은 그 달까지의 과거만 사용한다. 현재 백분위는 전체 양의 배수 중 현재 이하 비율."
	};
	return {
		code: input.code,
		source: input.source ?? "naver-companyguide",
		sourceUrl: input.sourceUrl ?? `https://navercomp.wisereport.co.kr/v2/company/c1040001.aspx?cmp_cd=${input.code}`,
		note: input.note ?? NOTE,
		name: input.name ?? null,
		currency: input.currency ?? "KRW",
		drivers,
		window: {
			from: dates[0] ?? null,
			to: dates[dates.length - 1] ?? null
		},
		consensus: input.consensus,
		per,
		forwardPer,
		evEbitda,
		evSales,
		valuationBand
	};
}
/** Recompute mean, σ, bands, and percentiles on points inside the window. */
function resliceValuation(pack, from) {
	if (!from || pack.drivers.length < 2) return pack;
	const drivers = pack.drivers.filter((row) => row.date >= from);
	if (drivers.length < 2 || drivers.length === pack.drivers.length) return pack;
	const cns = pack.consensus && pack.consensus.eps > 0 ? pack.consensus.eps : null;
	const perV = drivers.map((row) => trailingMultiple(row.price, row.eps));
	const fwdV = drivers.map((row) => trailingMultiple(row.price, cns));
	const evEbV = drivers.map((row) => {
		if (row.shares == null || !(row.shares > 0) || row.netDebtEok == null) return null;
		return evMultiple(row.price * row.shares / 1e8 + row.netDebtEok, row.ebitdaEok);
	});
	const evSaV = drivers.map((row) => {
		if (row.shares == null || !(row.shares > 0) || row.netDebtEok == null) return null;
		return evMultiple(row.price * row.shares / 1e8 + row.netDebtEok, row.salesEok);
	});
	const dates = drivers.map((row) => row.date);
	const prices = drivers.map((row) => row.price);
	const perStats = statsOf(perV);
	const fwdStats = statsOf(fwdV);
	const evEbStats = statsOf(evEbV);
	const evSaStats = statsOf(evSaV);
	const perBands = dates.map((date, i) => ({
		date,
		price: prices[i] ?? null,
		mean: fairPriceFromPer(drivers[i]?.eps ?? null, posMult(perStats.mean)),
		p1: fairPriceFromPer(drivers[i]?.eps ?? null, posMult(perStats.p1)),
		m1: fairPriceFromPer(drivers[i]?.eps ?? null, posMult(perStats.m1)),
		p2: fairPriceFromPer(drivers[i]?.eps ?? null, posMult(perStats.p2)),
		m2: fairPriceFromPer(drivers[i]?.eps ?? null, posMult(perStats.m2))
	}));
	const evSaBands = dates.map((date, i) => ({
		date,
		price: prices[i] ?? null,
		mean: fairPriceFromEvMultiple(drivers[i]?.salesEok ?? null, posMult(evSaStats.mean), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
		p1: fairPriceFromEvMultiple(drivers[i]?.salesEok ?? null, posMult(evSaStats.p1), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
		m1: fairPriceFromEvMultiple(drivers[i]?.salesEok ?? null, posMult(evSaStats.m1), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
		p2: fairPriceFromEvMultiple(drivers[i]?.salesEok ?? null, posMult(evSaStats.p2), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
		m2: fairPriceFromEvMultiple(drivers[i]?.salesEok ?? null, posMult(evSaStats.m2), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null)
	}));
	const evEbBands = dates.map((date, i) => ({
		date,
		price: prices[i] ?? null,
		mean: fairPriceFromEvMultiple(drivers[i]?.ebitdaEok ?? null, posMult(evEbStats.mean), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
		p1: fairPriceFromEvMultiple(drivers[i]?.ebitdaEok ?? null, posMult(evEbStats.p1), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
		m1: fairPriceFromEvMultiple(drivers[i]?.ebitdaEok ?? null, posMult(evEbStats.m1), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
		p2: fairPriceFromEvMultiple(drivers[i]?.ebitdaEok ?? null, posMult(evEbStats.p2), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
		m2: fairPriceFromEvMultiple(drivers[i]?.ebitdaEok ?? null, posMult(evEbStats.m2), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null)
	}));
	const fwdBands = dates.map((date, i) => ({
		date,
		price: prices[i] ?? null,
		mean: fairPriceFromPer(cns, posMult(fwdStats.mean)),
		p1: fairPriceFromPer(cns, posMult(fwdStats.p1)),
		m1: fairPriceFromPer(cns, posMult(fwdStats.m1)),
		p2: fairPriceFromPer(cns, posMult(fwdStats.p2)),
		m2: fairPriceFromPer(cns, posMult(fwdStats.m2))
	}));
	const per = seriesFrom(dates, prices, perV, perBands, pack.per.basis);
	const forwardPer = seriesFrom(dates, prices, fwdV, fwdBands, pack.forwardPer.basis);
	const evEbitda = seriesFrom(dates, prices, evEbV, evEbBands, pack.evEbitda.basis);
	const evSales = seriesFrom(dates, prices, evSaV, evSaBands, pack.evSales.basis);
	const perCurrent = per.stats.current != null;
	let basis = "none";
	if (perCurrent && per.stats.n >= 8) basis = "per";
	else if (evSales.stats.n >= 8) basis = "evSales";
	else if (perCurrent && per.stats.n >= 2) basis = "per";
	else if (evSales.stats.n >= 2) basis = "evSales";
	const chosen = basis === "per" ? per : basis === "evSales" ? evSales : null;
	return {
		...pack,
		drivers,
		window: {
			from: dates[0] ?? null,
			to: dates[dates.length - 1] ?? null
		},
		per,
		forwardPer,
		evEbitda,
		evSales,
		valuationBand: {
			basis,
			basisLabel: pack.valuationBand.basisLabel,
			points: chosen?.priceBands ?? [],
			percentilePoints: chosen?.points ?? [],
			stats: chosen?.stats ?? emptyStats(),
			note: "평균·표준편차·밴드는 선택한 구간만 사용한다. 백분위 선도 그 구간 안에서만 과거를 본다."
		}
	};
}
/** Official Naver industry_list `upjong` values, EUC-KR encoded. */
var NAVER_UPJONG_ENC = {
	건설: "%B0%C7%BC%B3",
	건자재: "%B0%C7%C0%DA%C0%E7",
	광고: "%B1%A4%B0%ED",
	금융: "%B1%DD%C0%B6",
	기계: "%B1%E2%B0%E8",
	휴대폰: "%C8%DE%B4%EB%C6%F9",
	담배: "%B4%E3%B9%E8",
	유통: "%C0%AF%C5%EB",
	미디어: "%B9%CC%B5%F0%BE%EE",
	바이오: "%B9%D9%C0%CC%BF%C0",
	반도체: "%B9%DD%B5%B5%C3%BC",
	보험: "%BA%B8%C7%E8",
	석유화학: "%BC%AE%C0%AF%C8%AD%C7%D0",
	섬유의류: "%BC%B6%C0%AF%C0%C7%B7%F9",
	소프트웨어: "%BC%D2%C7%C1%C6%AE%BF%FE%BE%EE",
	운수창고: "%BF%EE%BC%F6%C3%A2%B0%ED",
	유틸리티: "%C0%AF%C6%BF%B8%AE%C6%BC",
	은행: "%C0%BA%C7%E0",
	인터넷포탈: "%C0%CE%C5%CD%B3%DD%C6%F7%C5%BB",
	자동차: "%C0%DA%B5%BF%C2%F7",
	전기전자: "%C0%FC%B1%E2%C0%FC%C0%DA",
	제약: "%C1%A6%BE%E0",
	조선: "%C1%B6%BC%B1",
	종이: "%C1%BE%C0%CC",
	증권: "%C1%F5%B1%C7",
	철강금속: "%C3%B6%B0%AD%B1%DD%BC%D3",
	타이어: "%C5%B8%C0%CC%BE%EE",
	통신: "%C5%EB%BD%C5",
	항공운송: "%C7%D7%B0%F8%BF%EE%BC%DB",
	홈쇼핑: "%C8%A8%BC%EE%C7%CE",
	음식료: "%C0%BD%BD%C4%B7%E1",
	여행: "%BF%A9%C7%E0",
	게임: "%B0%D4%C0%D3",
	IT: "IT",
	에너지: "%BF%A1%B3%CA%C1%F6",
	해운: "%C7%D8%BF%EE",
	지주회사: "%C1%F6%C1%D6%C8%B8%BB%E7",
	디스플레이: "%B5%F0%BD%BA%C7%C3%B7%B9%C0%CC",
	화장품: "%C8%AD%C0%E5%C7%B0",
	자동차부품: "%C0%DA%B5%BF%C2%F7%BA%CE%C7%B0",
	교육: "%B1%B3%C0%B0"
};
var RESEARCH_SECTOR_RULES = [
	{
		sectorId: "us-linked",
		label: "미국 연계",
		keywords: [
			"미국",
			"IRA",
			"CHIPS",
			"바이든",
			"트럼프",
			"워싱턴",
			"연준",
			"Fed",
			"달러",
			"나스닥",
			"S&P",
			"미중",
			"수출통제",
			"관세",
			"동맹",
			"FMS"
		],
		naverUpjongs: [
			"반도체",
			"에너지",
			"자동차",
			"바이오",
			"전기전자"
		]
	},
	{
		sectorId: "semiconductors",
		label: "반도체",
		keywords: [
			"반도체",
			"HBM",
			"DRAM",
			"NAND",
			"파운드리",
			"메모리",
			"웨이퍼",
			"후공정",
			"패키징"
		],
		naverUpjongs: ["반도체"]
	},
	{
		sectorId: "electronics",
		label: "전자·IT",
		keywords: [
			"전자",
			"디스플레이",
			"OLED",
			"MLCC",
			"스마트폰",
			"IT하드웨어",
			"PCB",
			"카메라모듈"
		],
		naverUpjongs: [
			"전기전자",
			"디스플레이",
			"휴대폰",
			"IT"
		]
	},
	{
		sectorId: "auto",
		label: "자동차·부품",
		keywords: [
			"자동차",
			"완성차",
			"전기차",
			"EV",
			"자율주행",
			"타이어",
			"자동차부품"
		],
		naverUpjongs: [
			"자동차",
			"자동차부품",
			"타이어"
		]
	},
	{
		sectorId: "battery",
		label: "2차전지",
		keywords: [
			"2차전지",
			"배터리",
			"양극재",
			"음극재",
			"전해액",
			"분리막",
			"리튬",
			"ESS"
		],
		naverUpjongs: [
			"에너지",
			"전기전자",
			"석유화학"
		]
	},
	{
		sectorId: "bio",
		label: "바이오·제약",
		keywords: [
			"바이오",
			"제약",
			"헬스케어",
			"CDMO",
			"CMO",
			"임상",
			"신약",
			"바이오시밀러"
		],
		naverUpjongs: ["바이오", "제약"]
	},
	{
		sectorId: "finance",
		label: "금융",
		keywords: [
			"은행",
			"보험",
			"증권",
			"금융",
			"NIM",
			"대손",
			"주주환원"
		],
		naverUpjongs: [
			"금융",
			"은행",
			"증권",
			"보험"
		]
	},
	{
		sectorId: "shipbuilding",
		label: "조선·중공업",
		keywords: [
			"조선",
			"LNG선",
			"선박",
			"선가",
			"해양플랜트",
			"엔진",
			"중공업"
		],
		naverUpjongs: ["조선", "해운"]
	},
	{
		sectorId: "chemicals",
		label: "화학",
		keywords: [
			"화학",
			"석유화학",
			"스프레드",
			"정유",
			"스페셜티",
			"PVC",
			"에틸렌"
		],
		naverUpjongs: ["석유화학"]
	},
	{
		sectorId: "energy",
		label: "에너지·유틸리티",
		keywords: [
			"원전",
			"SMR",
			"전력",
			"전력기기",
			"변압기",
			"유틸리티",
			"태양광",
			"풍력",
			"가스",
			"발전"
		],
		naverUpjongs: ["에너지", "유틸리티"]
	},
	{
		sectorId: "telecom",
		label: "통신·미디어",
		keywords: [
			"통신",
			"5G",
			"미디어",
			"플랫폼",
			"인터넷",
			"게임",
			"콘텐츠",
			"광고"
		],
		naverUpjongs: [
			"통신",
			"미디어",
			"인터넷포탈",
			"게임"
		]
	},
	{
		sectorId: "consumer",
		label: "소비재·유통",
		keywords: [
			"소비",
			"유통",
			"화장품",
			"음식료",
			"식품",
			"면세",
			"리테일",
			"K-뷰티"
		],
		naverUpjongs: [
			"유통",
			"음식료",
			"화장품",
			"홈쇼핑",
			"섬유의류"
		]
	},
	{
		sectorId: "construction",
		label: "건설·부동산",
		keywords: [
			"건설",
			"주택",
			"분양",
			"부동산",
			"PF",
			"플랜트"
		],
		naverUpjongs: ["건설", "건자재"]
	},
	{
		sectorId: "steel",
		label: "철강·금속",
		keywords: [
			"철강",
			"강판",
			"철광석",
			"금속",
			"알루미늄",
			"구리",
			"비철"
		],
		naverUpjongs: ["철강금속"]
	},
	{
		sectorId: "robotics",
		label: "로봇·AI",
		keywords: [
			"로봇",
			"로보틱스",
			"휴머노이드",
			"협동로봇",
			"산업용 로봇",
			"물류로봇",
			"AMR",
			"서비스로봇",
			"감속기",
			"액추에이터",
			"서보",
			"모션제어",
			"피지컬 AI",
			"physical AI",
			"embodied",
			"robot",
			"robotics",
			"humanoid",
			"cobot"
		],
		naverUpjongs: [
			"기계",
			"IT",
			"소프트웨어"
		]
	},
	{
		sectorId: "defense",
		label: "방산·항공우주",
		keywords: [
			"방산",
			"국방",
			"항공우주",
			"위성",
			"미사일",
			"유도무기",
			"전투기"
		],
		naverUpjongs: ["기계"]
	}
];
/** Robot terms that must be present for bare "AI"/"인공지능" to count as robotics (F6.8). */
var ROBOT_TERMS = RESEARCH_SECTOR_RULES.find((r) => r.sectorId === "robotics").keywords;
var LATIN_ROBOT = /^[a-z ]+$/i;
function hasTerm(normalized, keyword) {
	const k = keyword.toLowerCase();
	if (LATIN_ROBOT.test(keyword) && keyword.length <= 5) return new RegExp(`(^|[^a-z])${k.replace(/ /g, "\\s")}($|[^a-z])`).test(normalized);
	return normalized.includes(k);
}
/** Robotics iff a robot-specific term appears (bare AI/인공지능 alone never qualifies). */
function isRoboticsText(text) {
	const normalized = text.toLowerCase();
	return ROBOT_TERMS.some((k) => hasTerm(normalized, k));
}
function classifyResearchSectors(text) {
	const normalized = text.toLowerCase();
	return RESEARCH_SECTOR_RULES.filter((rule) => rule.sectorId === "robotics" ? isRoboticsText(text) : rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))).map((rule) => rule.sectorId);
}
//#endregion
export { sharesOnPriceBasis as _, classifyResearchSectors as a, fairPriceFromEvMultiple as c, parseAnnualFundamentals as d, parseBandMonthPrices as f, resliceValuation as g, parseYahooSplits as h, buildValuationPack as i, fairPriceFromPer as l, parseYahooAdjCloses as m, RESEARCH_SECTOR_RULES as n, emptyValuationPack as o, parseNasdaqEarningsForecast as p, annualsFromCompanyFacts as r, extractEncparam as s, NAVER_UPJONG_ENC as t, isRoboticsText as u, yahooUsSymbol as v };
