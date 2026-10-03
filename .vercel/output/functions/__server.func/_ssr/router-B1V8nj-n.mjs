import { o as __toESM } from "../_runtime.mjs";
import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { r as hashString } from "./text-2P-t067w.mjs";
import { n as SOURCE_REGISTRY } from "./registry-BWVqhaYN.mjs";
import { i as runSources } from "./runner-JXC75WOo.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { _ as createRootRoute, b as useNavigate, d as useRouterState, g as createFileRoute, h as lazyRouteComponent, l as Scripts, m as Outlet, p as createRouter, u as HeadContent, v as Link, x as useRouter, z as redirect } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as Slot, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as createServerFn } from "./ssr.mjs";
import { a as literal, c as string, i as boolean, l as union, n as _enum, o as number, r as array, s as object, t as number$1 } from "../_libs/zod.mjs";
import { d as normalizeKrTicker, f as shouldRouteToEtf, i as getUniverseItem, l as isKrTicker, n as UNIVERSE_BY_CODE, s as isDigitTicker, t as UNIVERSE } from "./universe-BLkYDatc.mjs";
import { a as kstDayKey, l as zonedParts, n as formatAbsoluteTime, r as formatItemTime, t as dateGroupLabel } from "./time-By5ScNNo.mjs";
import { i as scoreImportance, n as containsTerm, t as CLUSTER_STOPWORDS } from "./importance-C2QKgaE9.mjs";
import { l as sortNewestFirst, n as dedupeById, o as pageAfterCursor, t as compareNewestFirst } from "./mappers-DlpCqw-E.mjs";
import { t as US_STREET_SYMBOLS } from "./us-street-Dx2s8JR4.mjs";
import { n as SECTORS, r as SECTOR_BY_ID, t as FOCUS_SECTOR_IDS } from "./sectors-CSrSXBVT.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
import { n as rankByQuery, t as matchesSearchQuery } from "./search-match-BMQS9B1C.mjs";
import { _ as policyStatusTopicIds, c as ROBOT_TOPICS, d as createSsrRpc, h as isRobotPolicyText, m as getSecuritySearch, n as POLICY_STATUS_LABEL, o as ROBOTICS_US_SYMBOLS, y as robotTopicIds } from "./classify-DLKCwe5y.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { i as ETF_THEMES, n as ETF_ISSUER_BRANDS, r as ETF_STAGE_LABEL, s as enrichEtfStory, u as isEtfStory } from "./etf-news-D8YKQLOx.mjs";
import { u as isRoboticsText, v as yahooUsSymbol } from "./research-taxonomy-BpoDpMeG.mjs";
import { t as US_LINKED_CODES } from "./us-link-7--eFHFs.mjs";
import { r as tagUsTickers, t as buildUsTickerIndex } from "./news-DxJZGpZd.mjs";
import { i as QueryClientProvider, r as useQuery, t as useInfiniteQuery } from "../_libs/tanstack__react-query.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { $ as FileText, A as Newspaper, Ct as BellRing, D as Play, G as Layers, H as Library, J as Info, M as Moon, O as Pause, P as Menu, St as Bell, W as LayoutDashboard, Z as Flag, at as ExternalLink, b as Search, bt as Bot, ct as Crosshair, d as Star, g as Ship, gt as ChartLine, jt as Activity, k as Palette, l as Trash2, m as SlidersHorizontal, mt as ChartPie, n as X, o as Triangle, ot as Earth, pt as ChevronDown, q as Landmark, s as TriangleAlert, u as Sun, y as Settings2, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { a as DialogOverlay, i as DialogDescription, n as DialogClose, o as DialogPortal, r as DialogContent, s as DialogTitle, t as Dialog } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { n as SwitchThumb, t as Switch$1 } from "../_libs/radix-ui__react-switch.mjs";
import { a as Trigger, i as Root3, n as Portal, r as Provider, t as Content2 } from "../_libs/@radix-ui/react-tooltip+[...].mjs";
import { t as wrapper_default } from "../_libs/ws.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/store-BVRlbyec.js
var import_react = /* @__PURE__ */ __toESM(require_react());
/**
* Persisted store schema v2 + migration from the unversioned v1 snapshot
* (F10.2). Pure module — imported by `store.ts` and unit-tested under
* `node --experimental-strip-types`.
*/
var DEFAULT_WATCHLIST = [
	"005930",
	"000660",
	"373220",
	"207940",
	"277810",
	"012450"
];
function defaultAlertSettings() {
	return {
		inAppEnabled: true,
		inAppMinTier: "high",
		osEnabled: false,
		osMinTier: "flash",
		osWatchMatches: true,
		quietHours: {
			enabled: true,
			start: "23:00",
			end: "07:00"
		},
		regions: {
			KR: true,
			US: true
		},
		categories: {
			news: true,
			disclosure: true,
			research: true,
			policy: true,
			filing: true,
			rating: true,
			etf: true,
			robotics: true
		},
		sound: false,
		tickerTape: false,
		paused: false,
		priceAlerts: []
	};
}
function defaultNewsPrefs() {
	return {
		tz: "KST",
		disabledSources: [],
		bloombergEnabled: true,
		minImportance: 0,
		watchOnly: false
	};
}
function defaultChartPrefs() {
	return {
		chartType: "candles",
		scale: "normal",
		syncInterval: false,
		templates: {}
	};
}
function defaultRoboticsCustom() {
	return {
		added: [],
		removed: []
	};
}
function defaultPersisted(preferredSectors = []) {
	return {
		watchlist: [...DEFAULT_WATCHLIST],
		theme: "dark",
		colorConvention: "korea",
		focusMode: false,
		preferredSectors: [...preferredSectors],
		usWatchlist: [...US_STREET_SYMBOLS],
		keywordWatch: [],
		alertSettings: defaultAlertSettings(),
		newsPrefs: defaultNewsPrefs(),
		chartPrefs: defaultChartPrefs(),
		roboticsCustom: defaultRoboticsCustom()
	};
}
function isObj(v) {
	return v != null && typeof v === "object" && !Array.isArray(v);
}
function strArray(v, fallback) {
	if (!Array.isArray(v)) return [...fallback];
	return v.filter((x) => typeof x === "string" && x.trim().length > 0);
}
function deepFill(defaults, value) {
	if (!isObj(defaults) || !isObj(value)) {
		if (Array.isArray(defaults)) return Array.isArray(value) ? value : defaults;
		if (value === void 0 || value === null) return defaults;
		return typeof value === typeof defaults ? value : defaults;
	}
	const out = { ...defaults };
	for (const [k, dv] of Object.entries(defaults)) out[k] = deepFill(dv, value[k]);
	for (const [k, v] of Object.entries(value)) if (!(k in out)) out[k] = v;
	return out;
}
/**
* Migrate any older persisted snapshot (unversioned = v0/v1) to v2. Existing
* user data (watchlist, theme, colorConvention, focusMode, preferredSectors)
* is preserved; new fields get defaults. Garbage input yields defaults.
*/
function migratePersisted(persisted, _fromVersion, preferredDefaults = []) {
	const base = defaultPersisted(preferredDefaults);
	if (!isObj(persisted)) return base;
	const p = persisted;
	return {
		watchlist: strArray(p.watchlist, base.watchlist),
		theme: p.theme === "light" || p.theme === "dark" ? p.theme : base.theme,
		colorConvention: p.colorConvention === "global" || p.colorConvention === "korea" ? p.colorConvention : base.colorConvention,
		focusMode: typeof p.focusMode === "boolean" ? p.focusMode : base.focusMode,
		preferredSectors: strArray(p.preferredSectors, base.preferredSectors),
		usWatchlist: strArray(p.usWatchlist, base.usWatchlist).map((s) => s.toUpperCase()),
		keywordWatch: strArray(p.keywordWatch, base.keywordWatch),
		alertSettings: deepFill(base.alertSettings, p.alertSettings),
		newsPrefs: deepFill(base.newsPrefs, p.newsPrefs),
		chartPrefs: deepFill(base.chartPrefs, p.chartPrefs),
		roboticsCustom: deepFill(base.roboticsCustom, p.roboticsCustom)
	};
}
/** Rehydrate merge: persisted values win, nested settings keep new default keys. */
function mergePersisted(persisted, current) {
	if (!isObj(persisted)) return current;
	const out = { ...current };
	for (const [k, v] of Object.entries(persisted)) {
		const cur = current[k];
		if (typeof cur === "function") continue;
		out[k] = isObj(cur) && isObj(v) ? deepFill(cur, v) : v;
	}
	return out;
}
var useAppStore = create()(persist((set, get) => ({
	watchlist: DEFAULT_WATCHLIST,
	theme: "dark",
	colorConvention: "korea",
	focusMode: false,
	preferredSectors: FOCUS_SECTOR_IDS,
	sidebarOpen: false,
	usWatchlist: [...US_STREET_SYMBOLS],
	keywordWatch: [],
	alertSettings: defaultAlertSettings(),
	newsPrefs: defaultNewsPrefs(),
	chartPrefs: defaultChartPrefs(),
	roboticsCustom: defaultRoboticsCustom(),
	addToWatchlist: (code) => set((s) => s.watchlist.includes(code) ? s : { watchlist: [...s.watchlist, code] }),
	removeFromWatchlist: (code) => set((s) => ({ watchlist: s.watchlist.filter((c) => c !== code) })),
	toggleWatchlist: (code) => {
		const { watchlist } = get();
		if (watchlist.includes(code)) get().removeFromWatchlist(code);
		else get().addToWatchlist(code);
	},
	setTheme: (theme) => set({ theme }),
	toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
	setColorConvention: (colorConvention) => set({ colorConvention }),
	setFocusMode: (focusMode) => set({ focusMode }),
	setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
	isWatched: (code) => get().watchlist.includes(code),
	addUsWatch: (symbol) => set((s) => {
		const sym = symbol.trim().toUpperCase();
		if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(sym) || s.usWatchlist.includes(sym)) return s;
		return { usWatchlist: [...s.usWatchlist, sym] };
	}),
	removeUsWatch: (symbol) => set((s) => ({ usWatchlist: s.usWatchlist.filter((x) => x !== symbol.toUpperCase()) })),
	addKeyword: (kw) => set((s) => {
		const k = kw.trim();
		if (k.length < 2 || s.keywordWatch.includes(k)) return s;
		return { keywordWatch: [...s.keywordWatch, k].slice(-50) };
	}),
	removeKeyword: (kw) => set((s) => ({ keywordWatch: s.keywordWatch.filter((x) => x !== kw) })),
	setAlertSettings: (patch) => set((s) => ({ alertSettings: {
		...s.alertSettings,
		...patch
	} })),
	upsertPriceAlert: (alert) => set((s) => {
		const rest = s.alertSettings.priceAlerts.filter((a) => a.id !== alert.id);
		return { alertSettings: {
			...s.alertSettings,
			priceAlerts: [...rest, alert].slice(-100)
		} };
	}),
	removePriceAlert: (id) => set((s) => ({ alertSettings: {
		...s.alertSettings,
		priceAlerts: s.alertSettings.priceAlerts.filter((a) => a.id !== id)
	} })),
	setNewsPrefs: (patch) => set((s) => ({ newsPrefs: {
		...s.newsPrefs,
		...patch
	} })),
	toggleSource: (sourceId, on) => set((s) => {
		const cur = new Set(s.newsPrefs.disabledSources);
		if (on) cur.delete(sourceId);
		else cur.add(sourceId);
		return { newsPrefs: {
			...s.newsPrefs,
			disabledSources: [...cur]
		} };
	}),
	setChartPrefs: (patch) => set((s) => ({ chartPrefs: {
		...s.chartPrefs,
		...patch
	} })),
	addRoboticsName: (entry) => set((s) => {
		const key = `${entry.market}:${entry.code.toUpperCase()}`;
		return { roboticsCustom: {
			added: [...s.roboticsCustom.added.filter((e) => `${e.market}:${e.code.toUpperCase()}` !== key), {
				...entry,
				code: entry.code.toUpperCase()
			}],
			removed: s.roboticsCustom.removed.filter((k) => k !== key)
		} };
	}),
	hideRoboticsName: (key) => set((s) => ({ roboticsCustom: {
		added: s.roboticsCustom.added.filter((e) => `${e.market}:${e.code}` !== key),
		removed: s.roboticsCustom.removed.includes(key) ? s.roboticsCustom.removed : [...s.roboticsCustom.removed, key]
	} })),
	restoreRoboticsName: (key) => set((s) => ({ roboticsCustom: {
		...s.roboticsCustom,
		removed: s.roboticsCustom.removed.filter((k) => k !== key)
	} }))
}), {
	name: "korea-equity-cc",
	version: 2,
	migrate: (persisted, version) => migratePersisted(persisted, version, FOCUS_SECTOR_IDS),
	merge: (persisted, current) => mergePersisted(persisted, current),
	partialize: (s) => ({
		watchlist: s.watchlist,
		theme: s.theme,
		colorConvention: s.colorConvention,
		focusMode: s.focusMode,
		preferredSectors: s.preferredSectors,
		usWatchlist: s.usWatchlist,
		keywordWatch: s.keywordWatch,
		alertSettings: s.alertSettings,
		newsPrefs: s.newsPrefs,
		chartPrefs: s.chartPrefs,
		roboticsCustom: s.roboticsCustom
	})
}));
/** Korea: red up / blue down. Global: green up / red down. */
function usePriceColors() {
	if (useAppStore((s) => s.colorConvention) === "korea") return {
		up: "text-price-up",
		down: "text-price-down",
		upBg: "bg-price-up/10",
		downBg: "bg-price-down/10",
		upSolid: "bg-price-up",
		downSolid: "bg-price-down",
		label: "상승 빨강 · 하락 파랑 (한국)"
	};
	return {
		up: "text-price-up-global",
		down: "text-price-down-global",
		upBg: "bg-price-up-global/10",
		downBg: "bg-price-down-global/10",
		upSolid: "bg-price-up-global",
		downSolid: "bg-price-down-global",
		label: "상승 초록 · 하락 빨강 (글로벌)"
	};
}
/** Registry ids hidden by the user (Bloomberg toggle folds in here). */
function useDisabledSources() {
	const disabled = useAppStore((s) => s.newsPrefs.disabledSources);
	const bloomberg = useAppStore((s) => s.newsPrefs.bloombergEnabled);
	return (0, import_react.useMemo)(() => {
		const ids = new Set(disabled);
		if (!bloomberg) for (const id of BLOOMBERG_SOURCE_IDS) ids.add(id);
		return ids;
	}, [disabled, bloomberg]);
}
var BLOOMBERG_SOURCE_IDS = [
	"bloomberg-markets",
	"bloomberg-economics",
	"bloomberg-technology",
	"bloomberg-politics",
	"bloomberg-wealth",
	"gn-bloomberg"
];
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/utils-C_uf36nf.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/input-4oYknhNn.js
var import_jsx_runtime = require_jsx_runtime();
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
	type,
	className: cn("flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className),
	ref,
	...props
}));
Input.displayName = "Input";
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/market-fns-CmzZRaBZ.js
var getQuotesByCodes = createServerFn({ method: "GET" }).validator(object({ codes: array(string()).max(80) })).handler(createSsrRpc("20ea6d9740e1873a46832e044191aca791a44d54741a82c0515cc1024ed4809f"));
var getMarketQuotes = createServerFn({ method: "GET" }).handler(createSsrRpc("22317702d830bba22c18bf55ff9aebcad93b94248c8d7055bab2fcde519e8e40"));
var getStockBundle = createServerFn({ method: "GET" }).validator(object({ code: string().regex(/^\d{6}$/) })).handler(createSsrRpc("e9288d88bf1ce8e8e4c2f168f1315f422eb2b842f1836dbace9e44e9e3397186"));
var getChartData = createServerFn({ method: "GET" }).validator(object({
	code: string().trim().min(1).max(12),
	market: _enum([
		"KOSPI",
		"KOSDAQ",
		"US"
	]),
	interval: _enum([
		"minute",
		"day",
		"week",
		"month",
		"year"
	]),
	minuteSize: union([
		literal(1),
		literal(3),
		literal(5),
		literal(10),
		literal(15),
		literal(30),
		literal(60)
	]).optional(),
	range: string().max(12).optional(),
	/** US intraday: include pre/post-market bars (F7.13). */
	prePost: boolean().optional()
})).handler(createSsrRpc("2741e40ab8821427d8bcf896deb105a7fc19dc0babb8b6aaa02a412130fbdcb1"));
var getValuationSeries = createServerFn({ method: "GET" }).validator(object({ code: string().trim().min(1).max(12) })).handler(createSsrRpc("ab33f5943578ad6a4c2d3b553d37dde601acd42bf9821710ba94b3b49b64bff9"));
var getUsStreet = createServerFn({ method: "GET" }).validator(object({
	symbol: string().trim().max(12).optional(),
	symbols: array(string().trim().regex(/^[A-Za-z][A-Za-z0-9.]{0,9}$/)).max(12).optional()
})).handler(createSsrRpc("c896e3ab110f1205a7679a339a05886599385517722877e90211332040abcd2b"));
var getResearchPdf = createServerFn({ method: "GET" }).validator(object({
	researchId: number().int().positive(),
	category: _enum([
		"company",
		"industry",
		"market",
		"economy"
	]).optional()
})).handler(createSsrRpc("ec3f9140d0f0bf9b88ddf1a2d851c83947f39c599f5e8d3b49ee04869396705b"));
var getResearchDesk = createServerFn({ method: "GET" }).handler(createSsrRpc("7f1eda26b4ed9a12a5244298a15abb0733dcd49bd061fc8a0accfab120cc103f"));
var getIndustryResearch = createServerFn({ method: "GET" }).validator(object({ sectorId: string().min(2).max(40) })).handler(createSsrRpc("fa901486ee32fe838f7ec1e2616b9ca96d283759d098635f15bc3ca29270f2b4"));
var getDisclosureDetail = createServerFn({ method: "GET" }).validator(object({
	code: string().regex(/^[0-9A-Za-z]{6}$/),
	disclosureId: string().min(1).max(80)
})).handler(createSsrRpc("1107098a65d0f5af81534960a39838855f849486e0bdbe3da960184f336bc8d6"));
/** F1.4: per-stock Naver news page N (newest first via the kernel), for 더 보기. */
var getStockNews = createServerFn({ method: "GET" }).validator(object({
	code: string().regex(/^[0-9A-Z]{6}$/),
	page: number().int().min(1).max(20)
})).handler(createSsrRpc("aac9fd6614014e29cf27670f2be6ab9c85b5af0b0913b45ab895e8c3186392fa"));
var getMarketIndices = createServerFn({ method: "GET" }).handler(createSsrRpc("f154a3830a7fa769b3681442c51672d43b9a273e148420e7f4105ddbb9cec5a6"));
createServerFn({ method: "GET" }).handler(createSsrRpc("9e6270a121f70ddeb2c53fa068debfb416fa043638edf949510802e4c35a32b9"));
var getKrxDisclosureDesk = createServerFn({ method: "GET" }).handler(createSsrRpc("6281abd8e0ea4fcb2e73102513eb9f1836f4cfa213660d96e1f42e5efd6335e4"));
createServerFn({ method: "GET" }).validator(object({
	code: string().min(4).max(8),
	nameKo: string().max(40).optional()
})).handler(createSsrRpc("f6e1258df5ed0a87b70ff13bb9ab8a207cc972029afee820bfc15f9d9ec58fa9"));
var getEtfMarket = createServerFn({ method: "GET" }).validator(object({
	bucket: _enum([
		"retirement",
		"all",
		"new",
		"theme",
		"us",
		"bond"
	]).optional(),
	q: string().max(80).optional(),
	limit: number().int().min(1).max(300).optional()
}).optional()).handler(createSsrRpc("1f550e4983ce6593c02d459289b03dbcfd2ca8e5672e4ed84b0ed31936d8a6a3"));
createServerFn({ method: "GET" }).handler(createSsrRpc("958e0e687e7dc66dfb3df70d2a767358d6db1234c44cbf9a9b449ac225dd3e84"));
var getEtfBundle = createServerFn({ method: "GET" }).validator(object({ code: string().min(4).max(8) })).handler(createSsrRpc("53180af1c07730e82baef51d15e76df4b7cb48694d71483a894406251d5d9db7"));
var getUsLinkDesk = createServerFn({ method: "GET" }).handler(createSsrRpc("f52dc16aa5a4dbef8932d53da7a78136dd3815103ce8fd839ab0848dc7c35b11"));
var getUsOfficialPolicy = createServerFn({ method: "GET" }).handler(createSsrRpc("f9e5b26032bcb7dd5ceae5cf107843715380b06b12481625af8fab1a61d3c6c2"));
var getUsOfficialUniverse = createServerFn({ method: "GET" }).handler(createSsrRpc("a398b94dab0e26b2679346ed1504000b9dd7747f368736a3f1c1b30ca0efc3db"));
var getUsOfficialCompany = createServerFn({ method: "GET" }).validator(object({ symbol: string().trim().min(1).max(12) })).handler(createSsrRpc("62954cbe6ed624015e6ae33cf86fcecc6945b9bf459f8abc95ef84f3c7302614"));
var getUsOfficialReport = createServerFn({ method: "GET" }).validator(object({ id: string().trim().min(3).max(180) })).handler(createSsrRpc("162a03eb73c1068bbf58ffcf83b1f34a32ae0d5d303189029ac364c8919906da"));
var V2_TYPES = [
	"market",
	"company",
	"industry",
	"invest",
	"economy",
	"debenture"
];
var getResearchV2 = createServerFn({ method: "GET" }).validator(object({
	type: _enum(V2_TYPES),
	index: number().int().min(0).max(200).default(0),
	size: number().int().min(1).max(50).default(20),
	itemCodes: array(string().regex(/^[0-9A-Z]{6}$/)).max(10).optional()
})).handler(createSsrRpc("1e043142b984a445c8fbb7fa56fb21b08e0f6acc0e8d1155afb1bdf2a548f6be"));
var getResearchV2Detail = createServerFn({ method: "GET" }).validator(object({
	type: _enum(V2_TYPES),
	nid: number().int().positive(),
	itemCode: string().regex(/^[0-9A-Z]{6}$/).optional()
})).handler(createSsrRpc("c36e8a86edb908a7b4f8479449dead1d41987096122802bef08f8aed44518632"));
var resolveResearchOriginal = createServerFn({ method: "GET" }).validator(object({
	type: _enum(V2_TYPES),
	nid: number().int().positive()
})).handler(createSsrRpc("4bd52a35d9b41432c406a3498236398eb58afdb9f5ea3cff08c10dccce87d194"));
var getResearchBriefing = createServerFn({ method: "GET" }).handler(createSsrRpc("7535ab763956273b1340d9d7a6ab2cb0d30a41f762613441900a615fac6075ae"));
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/format-CDIwCm5R.js
function formatPrice(value) {
	if (!Number.isFinite(value)) return "—";
	const abs = Math.abs(value);
	if (abs >= 1e3) return new Intl.NumberFormat("ko-KR").format(Math.round(value));
	if (Number.isInteger(value) || abs >= 100) return new Intl.NumberFormat("ko-KR").format(Math.round(value));
	return new Intl.NumberFormat("ko-KR", {
		minimumFractionDigits: 0,
		maximumFractionDigits: abs < 10 ? 2 : 1
	}).format(value);
}
function formatUsd(value) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(value);
}
function formatHoldingPrice(value, currency) {
	if (currency === "USD") return formatUsd(value);
	return formatPrice(value);
}
function formatWeight(value) {
	if (value == null || !Number.isFinite(value)) return "—";
	const abs = Math.abs(value).toFixed(2);
	return value < 0 ? `−${abs}%` : `${abs}%`;
}
function formatQty(value) {
	if (value == null || !Number.isFinite(value)) return "—";
	if (Number.isInteger(value)) return value.toLocaleString("ko-KR");
	return value.toLocaleString("ko-KR", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2
	});
}
function formatChange(value) {
	if (!Number.isFinite(value)) return "—";
	return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
}
function formatPct(value) {
	if (!Number.isFinite(value)) return "—";
	return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}
function formatVolume(value) {
	if (!Number.isFinite(value) || value === 0) return "—";
	if (value >= 1e8) return `${(value / 1e8).toFixed(1)}억`;
	if (value >= 1e4) return `${(value / 1e4).toFixed(0)}만`;
	return new Intl.NumberFormat("ko-KR").format(value);
}
function formatMarketCap(억) {
	if (!Number.isFinite(억) || 억 === 0) return "—";
	if (억 >= 1e4) return `${(억 / 1e4).toFixed(1)}조`;
	return `${new Intl.NumberFormat("ko-KR").format(억)}억`;
}
/** Normalize listing / trade timestamps to YYYY-MM-DD. */
function formatIsoDate(raw) {
	if (!raw) return "—";
	const sliced = raw.trim().slice(0, 10);
	if (/^\d{4}-\d{2}-\d{2}$/.test(sliced)) return sliced;
	const dt = new Date(raw);
	if (Number.isNaN(dt.getTime())) return "—";
	return kstYmd(dt);
}
/** YYYY-MM-DD in Asia/Seoul. Never use UTC midnight for Korean session dates. */
function kstYmd(d = /* @__PURE__ */ new Date()) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Seoul",
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(d);
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/feed-fns-BQ1HZbm8.js
/**
* Server functions for source health (B0.5).
*/
var getSourceHealth = createServerFn({ method: "GET" }).handler(createSsrRpc("372a9c4aa7135b43b167eccfb4cc43657a1fa434bb90c327753d1a483fd51c6a"));
/** `지금 재시도`: bypass the TTL once, still respect the circuit. */
var retrySource = createServerFn({ method: "POST" }).validator(object({ id: string().min(2).max(60).regex(/^[a-z0-9-]+$/) })).handler(createSsrRpc("f0b11c3d735f678e4ca21290cfdf80fd6fb452c06b5c8696cf77abcf690de7b3"));
/** Delayed US/FX/commodity snapshot tiles (F3.2 / F3.6). */
var getMarketSnapshot = createServerFn({ method: "GET" }).validator(object({ ids: array(_enum([
	"spx",
	"ndx",
	"dji",
	"rut",
	"vix",
	"tnx",
	"dxy",
	"wti",
	"gold",
	"btc",
	"usdkrw"
])).max(11).optional() })).handler(createSsrRpc("10674e5ecfabc75bfa277b5ead779d52583998735e4b64ccaa7b7c106d3606fc"));
/** US economic calendar for the next 7 days from the official policy pack (F3.4). */
var getUsCalendar = createServerFn({ method: "GET" }).handler(createSsrRpc("2a6c66b1e8f49b3adc9f553bcd5cbe8aa8983c5a797be053198765d534386db3"));
/** Naver AI market briefing (F1.5) — current + today's v2 list, attributed. */
var getNaverAiBriefing = createServerFn({ method: "GET" }).handler(createSsrRpc("ef7893deb0d09616ff11a2f0c583627ae5407606842650ddb706e1e326c4e67c"));
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/use-feed-BzxiECO9.js
/**
* Headline clustering (B0.6). Two items join a cluster when their title token
* sets have Jaccard ≥ 0.6 and they are ≤ 12 h apart. The representative is the
* best-tier member, then the earliest. Pure module.
*/
var CLUSTER_JACCARD = .6;
var PREFIX_TAGS = /\[(?:속보|단독|종합|특징주|마감시황|포토|영상|사진|1보|2보|3보|종합\d*보)\]|\((?:종합|\d보|종합\d보|상보|속보|단독)\)|【[^】]*】/g;
/** NFKC, lowercase, strip tags like `[속보]`/`(종합)`/`(2보)`, trailing ` - Source`, punctuation. */
function normalizeClusterTitle(title) {
	let s = (title ?? "").normalize("NFKC");
	s = s.replace(PREFIX_TAGS, " ");
	s = s.replace(/\s+[-–—|]\s+([^-–—|]{1,30})$/u, (full, tail) => tail.trim().split(/\s+/).length <= 4 ? "" : full);
	s = s.toLowerCase();
	s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
	return s.replace(/\s+/g, " ").trim();
}
var HANGUL_RUN = /[가-힣]+/g;
var LATIN_WORD = /[a-z0-9]+/g;
/** Hangul character bigrams + Latin/number words, stopwords removed. */
function clusterTokens(title) {
	const norm = normalizeClusterTitle(title);
	const out = /* @__PURE__ */ new Set();
	for (const m of norm.matchAll(HANGUL_RUN)) {
		const run = m[0];
		if (run.length === 1) {
			if (!CLUSTER_STOPWORDS.has(run)) out.add(run);
			continue;
		}
		if (CLUSTER_STOPWORDS.has(run)) continue;
		for (let i = 0; i < run.length - 1; i++) {
			const bg = run.slice(i, i + 2);
			if (!CLUSTER_STOPWORDS.has(bg)) out.add(bg);
		}
	}
	for (const m of norm.matchAll(LATIN_WORD)) {
		const w = m[0];
		if (!CLUSTER_STOPWORDS.has(w)) out.add(w);
	}
	return out;
}
function jaccard(a, b) {
	if (!a.size && !b.size) return 0;
	let inter = 0;
	const [small, big] = a.size <= b.size ? [a, b] : [b, a];
	for (const t of small) if (big.has(t)) inter++;
	const union = a.size + b.size - inter;
	return union === 0 ? 0 : inter / union;
}
function timeMs(it) {
	if (!it.publishedAt) return null;
	const ms = Date.parse(it.publishedAt);
	return Number.isNaN(ms) ? null : ms;
}
/** Same story? Jaccard ≥ 0.6 and ≤ 12 h apart (unknown times never merge). */
function sameStory(a, b, tokens) {
	const ta = timeMs(a);
	const tb = timeMs(b);
	if (ta == null || tb == null) return false;
	if (Math.abs(ta - tb) > 432e5) return false;
	return jaccard(tokens?.a ?? clusterTokens(a.title), tokens?.b ?? clusterTokens(b.title)) >= CLUSTER_JACCARD;
}
function pickRepresentative(members) {
	return [...members].sort((x, y) => {
		if (x.sourceTier !== y.sourceTier) return x.sourceTier - y.sourceTier;
		const tx = timeMs(x) ?? Number.POSITIVE_INFINITY;
		const ty = timeMs(y) ?? Number.POSITIVE_INFINITY;
		if (tx !== ty) return tx - ty;
		return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
	})[0];
}
function toMember(it) {
	return {
		id: it.id,
		sourceId: it.sourceId,
		sourceName: it.outlet ? `${it.sourceName} · ${it.outlet}` : it.sourceName,
		title: it.title,
		url: it.url,
		publishedAt: it.publishedAt,
		precision: it.precision,
		paywalled: it.paywalled
	};
}
/**
* Collapse near-duplicate headlines. Returns one representative per cluster
* with `cluster` populated (singletons get `size: 1`), sorted newest first.
* Only `news`, `policy`, `filing` and `rating` kinds cluster; research and
* disclosures pass through as singletons.
*/
function clusterItems(items) {
	const sorted = [...items].sort(compareNewestFirst);
	const groups = [];
	for (const it of sorted) {
		const clusterable = it.kind === "news" || it.kind === "policy" || it.kind === "filing" || it.kind === "rating";
		const tok = clusterTokens(it.title);
		let placed = false;
		if (clusterable && tok.size >= 2 && timeMs(it) != null) for (const g of groups) {
			if (!g.clusterable) continue;
			if (g.members.some((m, i) => sameStory(m, it, {
				a: g.tokens[i],
				b: tok
			}))) {
				g.members.push(it);
				g.tokens.push(tok);
				placed = true;
				break;
			}
		}
		if (!placed) groups.push({
			members: [it],
			tokens: [tok],
			clusterable
		});
	}
	return groups.map((g) => {
		const rep = pickRepresentative(g.members);
		const others = g.members.filter((m) => m.id !== rep.id).sort(compareNewestFirst);
		const sources = [...new Set(g.members.map((m) => m.sourceName))];
		return {
			...rep,
			cluster: {
				id: `c${hashString(g.members.map((m) => m.id).sort().join("|"))}`,
				size: g.members.length,
				sources,
				members: others.map(toMember)
			}
		};
	}).sort(compareNewestFirst);
}
/**
* Remove items from disabled sources. When a cluster representative is removed
* but other members survive, the newest surviving member is promoted.
*/
function filterDisabledSources(items, disabled) {
	if (!disabled.size) return [...items];
	const out = [];
	for (const it of items) {
		const members = (it.cluster?.members ?? []).filter((m) => !disabled.has(m.sourceId));
		if (!disabled.has(it.sourceId)) {
			out.push(it.cluster ? {
				...it,
				cluster: {
					...it.cluster,
					members,
					size: members.length + 1,
					sources: [.../* @__PURE__ */ new Set([it.sourceName, ...members.map((m) => m.sourceName)])]
				}
			} : it);
			continue;
		}
		const [head, ...rest] = members;
		if (!head) continue;
		out.push({
			...it,
			id: head.id,
			sourceId: head.sourceId,
			sourceName: head.sourceName,
			title: head.title,
			url: head.url,
			publishedAt: head.publishedAt,
			precision: head.precision,
			paywalled: head.paywalled,
			snippet: void 0,
			outlet: void 0,
			cluster: {
				...it.cluster,
				members: rest,
				size: rest.length + 1,
				sources: [.../* @__PURE__ */ new Set([head.sourceName, ...rest.map((m) => m.sourceName)])]
			}
		});
	}
	return out.sort(compareNewestFirst);
}
/**
* Merge paged feed responses without duplicates (AT-10): rows are deduped by
* id, and a later-page row that is already a member of an earlier cluster is
* dropped. Output is newest first. Pure module.
*/
function mergeFeedPages(pages) {
	const merged = dedupeById(pages.flatMap((p) => p.items));
	const memberIds = /* @__PURE__ */ new Set();
	for (const it of merged) for (const m of it.cluster?.members ?? []) memberIds.add(m.id);
	const out = [];
	const reps = /* @__PURE__ */ new Set();
	for (const it of merged) {
		if (memberIds.has(it.id) && !reps.has(it.id)) {
			if (!((it.cluster?.members?.length ?? 0) > 0)) continue;
		}
		reps.add(it.id);
		out.push(it);
	}
	return sortNewestFirst(out);
}
async function fetchFeedPage(opts, cursor) {
	const params = new URLSearchParams({
		region: opts.region,
		limit: String(opts.limit ?? 50)
	});
	if (opts.group) params.set("group", opts.group);
	if (opts.kinds?.length) params.set("kinds", opts.kinds.join(","));
	if (opts.topics?.length) params.set("topics", opts.topics.join(","));
	if (opts.tickers?.length) params.set("tickers", opts.tickers.join(","));
	if (cursor) params.set("cursor", cursor);
	const res = await fetch(`${opts.endpoint ?? "/api/feed"}?${params}`, { headers: { accept: "application/json" } });
	if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
	return await res.json();
}
/** User watch context (KR + US watchlists and keywords) for scoring/filters. */
function useWatchContext() {
	const watchlist = useAppStore((s) => s.watchlist);
	const usWatchlist = useAppStore((s) => s.usWatchlist);
	const keywords = useAppStore((s) => s.keywordWatch);
	return (0, import_react.useMemo)(() => {
		const names = /* @__PURE__ */ new Map();
		for (const u of UNIVERSE) names.set(u.code, u.nameKo);
		return {
			tickers: [...watchlist, ...usWatchlist],
			keywords,
			names,
			usIndex: buildUsTickerIndex(usWatchlist.map((s) => ({
				symbol: s,
				names: []
			})))
		};
	}, [
		watchlist,
		usWatchlist,
		keywords
	]);
}
/** Re-score with the user's watch context and add cashtag tags for the US watchlist. */
function personalize(items, watch, now = Date.now()) {
	return items.map((it) => {
		let tickers = it.tickers;
		if (it.lang === "en") {
			const extra = tagUsTickers(it.title, watch.usIndex).filter((t) => !tickers.some((x) => x.code === t.code));
			if (extra.length) tickers = [...tickers, ...extra];
		}
		const next = tickers === it.tickers ? it : {
			...it,
			tickers
		};
		return {
			...next,
			importance: scoreImportance(next, {
				now,
				watchTickers: watch.tickers,
				watchKeywords: watch.keywords
			})
		};
	});
}
/**
* Paged newest-first feed from `/api/feed`. Pages are merged without
* duplicates (by id); disabled sources (user toggles, Bloomberg switch) are
* removed client-side, promoting surviving cluster members.
*/
function useFeed(opts) {
	const disabled = useDisabledSources();
	const watch = useWatchContext();
	const q = useInfiniteQuery({
		queryKey: [
			"feed",
			opts.endpoint ?? "/api/feed",
			opts.region,
			opts.group ?? "",
			opts.kinds?.join(",") ?? "",
			opts.topics?.join(",") ?? "",
			opts.tickers?.join(",") ?? "",
			opts.limit ?? 50
		],
		queryFn: ({ pageParam }) => fetchFeedPage(opts, pageParam),
		initialPageParam: null,
		getNextPageParam: (last) => last.nextCursor ?? void 0,
		enabled: opts.enabled ?? true,
		staleTime: 25e3,
		refetchInterval: opts.refetchMs ?? 9e4,
		refetchOnWindowFocus: false
	});
	const pages = q.data?.pages ?? [];
	const items = (0, import_react.useMemo)(() => sortNewestFirst(personalize(filterDisabledSources(mergeFeedPages(pages), disabled), watch)), [
		pages,
		disabled,
		watch
	]);
	const first = pages[0];
	return {
		...q,
		items,
		sources: first?.sources ?? [],
		partial: pages.some((p) => p.partial),
		generatedAt: first?.generatedAt ?? null
	};
}
function useMarketSnapshot(ids, opts) {
	return useQuery({
		queryKey: ["market-snapshot", ids?.join(",") ?? "all"],
		queryFn: () => getMarketSnapshot({ data: { ids } }),
		staleTime: 5e4,
		refetchInterval: opts?.refetchMs ?? 12e4,
		refetchOnWindowFocus: false,
		enabled: opts?.enabled ?? true
	});
}
function useUsCalendar(opts) {
	return useQuery({
		queryKey: ["us-calendar"],
		queryFn: () => getUsCalendar(),
		staleTime: 6e5,
		refetchOnWindowFocus: false,
		enabled: opts?.enabled ?? true
	});
}
function useNaverAiBriefing(opts) {
	return useQuery({
		queryKey: ["naver-ai-briefing"],
		queryFn: () => getNaverAiBriefing(),
		staleTime: 6e5,
		refetchOnWindowFocus: false,
		enabled: opts?.enabled ?? true
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/button-DVF-Ua0H.js
var buttonVariants = cva("inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:bg-primary/90",
			secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
			outline: "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
			ghost: "hover:bg-accent hover:text-accent-foreground",
			destructive: "bg-destructive text-white hover:bg-destructive/90",
			link: "text-foreground underline-offset-4 hover:underline"
		},
		size: {
			default: "h-9 px-3.5 py-2",
			sm: "h-8 rounded-md px-2.5 text-xs",
			lg: "h-11 rounded-lg px-5",
			icon: "h-9 w-9",
			"icon-sm": "h-8 w-8"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/sheet-C7ys5Emr.js
var Sheet = Dialog;
function SheetPortal(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogPortal, { ...props });
}
function SheetOverlay({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {
		className: cn("fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
		...props
	});
}
function SheetContent({ className, children, side = "right", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
		className: cn("fixed z-50 flex flex-col gap-4 bg-card shadow-lg transition ease-in-out data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out", side === "right" && "inset-y-0 right-0 h-full w-full max-w-md border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right", side === "left" && "inset-y-0 left-0 h-full w-full max-w-xs border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left", side === "bottom" && "inset-x-0 bottom-0 max-h-[85vh] border-t border-border data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom", className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
			className: "absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-70 hover:bg-accent hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Close"
			})]
		})]
	})] });
}
function SheetHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex flex-col gap-1 border-b border-border px-4 py-3 pr-12", className),
		...props
	});
}
function SheetTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
		className: cn("text-base font-semibold text-foreground", className),
		...props
	});
}
function SheetDescription({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
		className: cn("text-xs text-muted-foreground", className),
		...props
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/TimeStamp-Zz50LCia.js
/**
* `now` that is null during SSR/hydration (so markup matches) and then ticks
* every 30 s on the client, keeping relative labels fresh.
*/
function useNow(intervalMs = 3e4) {
	const [now, setNow] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		setNow(Date.now());
		const id = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(id);
	}, [intervalMs]);
	return now;
}
/**
* Item time (B0.2): relative under 12 h, `MM.DD HH:mm` after, date-only `MM.DD`
* (never a fake 00:00), `날짜 미상` when unknown. Tooltip: absolute KST (+ET).
*/
function TimeStamp({ publishedAt, precision, tz = "KST", withEt = false, className }) {
	const now = useNow();
	const item = {
		publishedAt,
		precision
	};
	const label = now == null ? formatItemTime(item, {
		tz,
		now: publishedAt ? Date.parse(publishedAt) + 468e5 : 0
	}) : formatItemTime(item, {
		tz,
		now
	});
	const title = formatAbsoluteTime(item, { withEt: withEt || tz === "ET" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
		dateTime: publishedAt ?? void 0,
		title,
		"aria-label": title,
		className: cn("tabular whitespace-nowrap", !publishedAt && "text-muted-foreground/70 italic", className),
		children: label
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/FeedRow-DTP2MyWU.js
/**
* Client-side feed filters (B0.7 FilterBar): source, topic, minimum importance,
* watchlist-only, text search via `matchesSearchQuery`. Pure module.
*/
var EMPTY_FILTERS = {
	sources: [],
	topics: [],
	minImportance: 0,
	watchOnly: false,
	q: "",
	kinds: []
};
function isWatchMatch(item, watch) {
	const tickers = new Set([...watch.tickers].map((t) => t.toUpperCase()));
	if (item.tickers.some((t) => tickers.has(t.code.toUpperCase()) || tickers.has(`${t.market}:${t.code}`.toUpperCase()))) return true;
	const text = `${item.title} ${item.snippet ?? ""}`;
	for (const k of watch.keywords) if (k.trim().length >= 2 && containsTerm(text, k.trim())) return true;
	return false;
}
function applyFeedFilters(items, f, watch) {
	const sources = new Set(f.sources);
	const topics = new Set(f.topics);
	const kinds = new Set(f.kinds ?? []);
	const q = f.q.trim();
	return items.filter((it) => {
		if (sources.size) {
			const inCluster = it.cluster?.members?.some((m) => sources.has(m.sourceId)) ?? false;
			if (!sources.has(it.sourceId) && !inCluster) return false;
		}
		if (topics.size && !it.topics.some((t) => topics.has(t))) return false;
		if (kinds.size && !kinds.has(it.kind)) return false;
		if (f.minImportance > 0 && (it.importance?.score ?? 0) < f.minImportance) return false;
		if (f.watchOnly && (!watch || !isWatchMatch(it, watch))) return false;
		if (q) {
			const names = it.tickers.map((t) => watch?.names?.get(t.code) ?? "").filter(Boolean);
			const hay = [
				it.title,
				it.snippet,
				it.sourceName,
				it.outlet,
				...it.tickers.map((t) => t.code),
				...names,
				...it.topics
			];
			if (!matchesSearchQuery(q, hay)) return false;
		}
		return true;
	});
}
/** Distinct sources present (rep + cluster members) with counts, for filter chips. */
function sourceFacets(items) {
	const map = /* @__PURE__ */ new Map();
	for (const it of items) {
		const ids = /* @__PURE__ */ new Map([[it.sourceId, it.sourceName]]);
		for (const m of it.cluster?.members ?? []) if (!ids.has(m.sourceId)) ids.set(m.sourceId, m.sourceName.split(" · ")[0]);
		for (const [id, name] of ids) {
			const row = map.get(id) ?? {
				id,
				name,
				count: 0
			};
			row.count += 1;
			map.set(id, row);
		}
	}
	return [...map.values()].sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1));
}
function topicFacets(items) {
	const map = /* @__PURE__ */ new Map();
	for (const it of items) for (const t of new Set(it.topics)) map.set(t, (map.get(t) ?? 0) + 1);
	return [...map.entries()].map(([id, count]) => ({
		id,
		count
	})).sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1));
}
var TOPIC_LABELS = {
	market: "시황",
	macro: "거시·정책",
	earnings: "실적·기업",
	"market-structure": "시장구조",
	rating: "등급·목표가",
	rates: "금리·채권",
	fx: "환율",
	disclosure: "공시",
	company: "기업분석",
	global: "해외",
	policy: "정책",
	tech: "테크",
	etf: "ETF",
	"etf-listing": "ETF 상장",
	robotics: "로봇",
	research: "리서치",
	statistics: "통계"
};
for (const [id, label] of Object.entries(ETF_STAGE_LABEL)) TOPIC_LABELS[`stage:${id}`] = label;
for (const t of ETF_THEMES) TOPIC_LABELS[`theme:${t.id}`] = t.label;
for (const b of ETF_ISSUER_BRANDS) TOPIC_LABELS[`brand:${b.brand}`] = b.brand;
for (const t of ROBOT_TOPICS) TOPIC_LABELS[`robot:${t.id}`] = t.label;
for (const [id, label] of Object.entries(POLICY_STATUS_LABEL)) TOPIC_LABELS[`status:${id}`] = label;
function topicLabel(id) {
	return TOPIC_LABELS[id] ?? id;
}
var CHIP_PREFIXES = [
	"stage:",
	"status:",
	"robot:"
];
/**
* Theme chips derived from the item's own text (ETF stage, policy status,
* robot topic). `stage:other` / `status:other` render as 기타 only for policy.
*/
function ThemeChips({ item, max = 4 }) {
	const chips = item.topics.filter((t) => CHIP_PREFIXES.some((p) => t.startsWith(p)) && t !== "stage:other").slice(0, max);
	if (!chips.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: chips.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("rounded px-1.5 py-0.5 text-[9.5px] font-semibold", t.startsWith("stage:") && "bg-desk-gold/15 text-desk-gold", t.startsWith("status:") && "bg-desk-teal/15 text-desk-teal", t.startsWith("robot:") && "bg-muted text-muted-foreground"),
		"data-chip": t,
		title: t.startsWith("status:") ? "원문에 나온 표현으로만 표시합니다" : void 0,
		children: topicLabel(t)
	}, t)) });
}
/** Matched ETF (F5.2): code, price, 1D %, volume, market value, issuer → /etfs/$code. */
function EtfMatchStrip({ etf }) {
	const colors = usePriceColors();
	const pct = etf.changePct;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/etfs/$code",
		params: { code: etf.code },
		className: "mt-1.5 flex min-h-8 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-border bg-muted/20 px-2 py-1 text-[10.5px] hover:bg-muted/40",
		"data-etf-match": etf.code,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-semibold text-foreground",
				children: etf.name
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tabular text-muted-foreground",
				children: etf.code
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tabular font-semibold",
				children: etf.price != null ? `${formatPrice(etf.price)}원` : "—"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: cn("tabular font-semibold", pct != null && pct > 0 && colors.up, pct != null && pct < 0 && colors.down),
				children: pct != null ? formatPct(pct) : "—"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "tabular text-muted-foreground",
				children: ["거래량 ", etf.volume != null ? etf.volume.toLocaleString("ko-KR") : "—"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "tabular text-muted-foreground",
				children: ["시총 ", etf.marketSum != null ? `${etf.marketSum.toLocaleString("ko-KR")}억` : "—"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground",
				children: etf.issuer ?? "운용사 —"
			}),
			etf.retirementEligible === false && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "rounded border border-desk-rose/40 px-1 text-[9px] text-desk-rose",
				children: "파생"
			})
		]
	});
}
var KIND_LABEL = {
	news: "뉴스",
	research: "리서치",
	disclosure: "공시",
	filing: "SEC 공시",
	policy: "정책",
	rating: "등급",
	briefing: "브리핑"
};
function tierDotClass(tier) {
	return tier === 1 ? "bg-desk-gold" : tier === 2 ? "bg-desk-teal" : "bg-muted-foreground/50";
}
var TIER_LABEL = {
	1: "1차 출처",
	2: "주요 매체",
	3: "기타·집계"
};
function SourceBadge({ item }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "inline-flex min-w-0 items-center gap-1.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: cn("size-1.5 shrink-0 rounded-full", tierDotClass(item.sourceTier)),
				title: TIER_LABEL[item.sourceTier],
				"aria-label": TIER_LABEL[item.sourceTier]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "truncate font-medium text-foreground/85",
				children: item.outlet ? `${item.outlet}` : item.sourceName
			}),
			item.outlet && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "hidden truncate text-muted-foreground sm:inline",
				children: ["via ", item.sourceName]
			}),
			item.paywalled && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "shrink-0 rounded border border-desk-gold/40 px-1 text-[9px] font-semibold text-desk-gold",
				children: "유료"
			})
		]
	});
}
function ImportanceChip({ item }) {
	const imp = item.importance;
	if (!imp || imp.tier === "normal") return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", imp.tier === "flash" ? "bg-price-up/15 text-price-up" : "bg-amber-500/15 text-amber-500"),
		title: `중요도 ${imp.score}: ${imp.reasons.join(" · ")}`,
		children: [
			imp.tier === "flash" ? "FLASH" : "HIGH",
			" ",
			imp.score
		]
	});
}
function TickerChips({ tickers, labelFor, max = 4 }) {
	if (!tickers.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: tickers.slice(0, max).map((t) => t.market === "KR" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/stock/$ticker",
		params: { ticker: t.code },
		className: "inline-flex min-h-8 items-center rounded border border-border px-1.5 text-[10px] font-medium text-primary hover:bg-muted/50 sm:min-h-0 sm:py-0.5",
		"data-ticker": t.code,
		children: labelFor?.(t) ?? t.code
	}, `KR:${t.code}`) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/us/$symbol",
		params: { symbol: t.code },
		className: "inline-flex min-h-8 items-center rounded border border-border px-1.5 text-[10px] font-medium text-primary hover:bg-muted/50 sm:min-h-0 sm:py-0.5",
		"data-ticker": t.code,
		children: ["$", t.code]
	}, `US:${t.code}`)) });
}
/**
* One feed row (B0.7): time, source badge (tier dot, 유료), headline linking to
* the original in a new tab, 2-line source snippet, ticker chips, importance
* reason chips and a cluster `+N` expander with every member's link.
*/
function FeedRow({ item, tz = "KST", withEt = false, showReasons = true, showKind = true, tierBar = false, labelFor, className, translation }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const members = item.cluster?.members ?? [];
	const reasons = item.importance?.reasons ?? [];
	const hasThemeChips = item.topics.some((t) => t.startsWith("stage:") && t !== "stage:other" || t.startsWith("status:") || t.startsWith("robot:"));
	const tierColor = item.importance?.tier === "flash" ? "bg-price-up" : item.importance?.tier === "high" ? "bg-amber-500" : "bg-transparent";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: cn("relative flex gap-2 px-3 py-2.5", className),
		"data-feed-id": item.id,
		"data-published": item.publishedAt ?? "",
		children: [tierBar && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: cn("absolute inset-y-1 left-0 w-1 rounded-r", tierColor),
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0 flex-1",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
							publishedAt: item.publishedAt,
							precision: item.precision,
							tz,
							withEt,
							className: "font-medium text-foreground/80"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceBadge, { item }),
						showKind && item.kind !== "news" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground",
							children: KIND_LABEL[item.kind]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportanceChip, { item })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: item.url,
					target: "_blank",
					rel: "noopener noreferrer",
					className: "group mt-1 flex min-h-8 items-start gap-1 text-[13px] font-semibold leading-snug text-foreground hover:underline sm:min-h-0",
					lang: item.lang,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 break-words",
							children: item.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, {
							className: "mt-0.5 size-3 shrink-0 opacity-40 group-hover:opacity-80",
							"aria-hidden": true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: "원문 (새 창)"
						})
					]
				}),
				translation && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-0.5 text-[12px] leading-snug text-foreground/85",
					lang: "ko",
					"data-translation": true,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mr-1 rounded bg-muted px-1 text-[9px] font-semibold text-muted-foreground",
						children: "기계 번역"
					}), translation]
				}),
				item.snippet && !item.paywalled && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground",
					children: item.snippet
				}),
				item.etf && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EtfMatchStrip, { etf: item.etf }),
				(item.tickers.length > 0 || showReasons && reasons.length > 0 || members.length > 0 || hasThemeChips) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-1.5 flex flex-wrap items-center gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeChips, { item }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TickerChips, {
							tickers: item.tickers,
							labelFor
						}),
						showReasons && item.importance && item.importance.tier !== "normal" && reasons.slice(0, 4).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded bg-muted/70 px-1.5 py-0.5 text-[9.5px] text-muted-foreground",
							children: r
						}, r)),
						members.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setOpen((v) => !v),
							"aria-expanded": open,
							className: "inline-flex min-h-8 items-center gap-0.5 rounded border border-border px-1.5 text-[10px] font-semibold text-foreground/80 hover:bg-muted/50 sm:min-h-0 sm:py-0.5",
							title: item.cluster?.sources.join(" · "),
							children: [
								"+",
								members.length,
								" 매체",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: cn("size-3 transition-transform", open && "rotate-180") })
							]
						})
					]
				}),
				open && members.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1.5 space-y-1 border-l-2 border-border pl-2",
					children: members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex min-w-0 flex-wrap items-baseline gap-x-2 text-[11px]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
								publishedAt: m.publishedAt,
								precision: m.precision,
								tz,
								className: "text-[10px] text-muted-foreground"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-muted-foreground",
								children: m.sourceName
							}),
							m.paywalled && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[9px] font-semibold text-desk-gold",
								children: "유료"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: m.url,
								target: "_blank",
								rel: "noopener noreferrer",
								className: "min-w-0 break-words text-foreground/90 hover:underline",
								children: m.title
							})
						]
					}, m.id))
				})
			]
		})]
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/EmptyState-DUMoSuK6.js
/** Empty list: always states the reason and links to source health (B0.7). */
function EmptyState({ reason, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "inline-flex items-start gap-1.5 text-left leading-relaxed",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
				className: "mt-0.5 size-3.5 shrink-0",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: reason })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/status/sources",
				className: "inline-flex min-h-8 items-center font-semibold text-primary hover:underline",
				children: "소스 상태 확인 →"
			})
		})]
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/FeedList-Do5db8eD.js
/**
* Newest-first list with date group headers (오늘/어제/날짜) and "더 보기".
* Items must arrive already sorted by the server (compareNewestFirst).
*/
function FeedList({ items, tz = "KST", withEt = false, hasMore = false, loadingMore = false, onLoadMore, emptyReason, loading = false, renderRow, tierBar = false, labelFor, className, translations }) {
	const now = useNow(6e4);
	if (!items.length) return loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-xs text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }), " 수신 중…"]
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, { reason: emptyReason ?? "표시할 항목이 없습니다." });
	const virtual = items.length > 200;
	let lastDay;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("overflow-hidden rounded-lg border border-border bg-card", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "divide-y divide-border",
			"data-feed-list": true,
			children: items.map((it) => {
				const day = it.publishedAt ? kstDayKey(it.publishedAt) : null;
				const header = day !== lastDay;
				lastDay = day;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Fragment, { children: [header && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "sticky top-0 z-[1] bg-muted/80 px-3 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground backdrop-blur",
					"data-date-header": day ?? "unknown",
					children: now == null && day ? day.replace(/-/g, ".") : dateGroupLabel(day, now ?? void 0)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					style: virtual ? {
						contentVisibility: "auto",
						containIntrinsicSize: "auto 92px"
					} : void 0,
					children: renderRow ? renderRow(it) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedRow, {
						item: it,
						tz,
						withEt,
						tierBar,
						labelFor,
						translation: translations?.[it.id]
					})
				})] }, it.id);
			})
		}), (hasMore || loadingMore) && onLoadMore && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "border-t border-border p-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: onLoadMore,
				disabled: loadingMore,
				className: "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-primary hover:bg-muted/50 disabled:opacity-60",
				children: [loadingMore ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : null, "더 보기"]
			})
		})]
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/NewsDesk-B_Qa8DcQ.js
/** Compact `소스 n/m 정상` chip linking to /status/sources (B0.5). */
function SourceHealthChip({ sources, className }) {
	const list = (sources ?? []).filter((s) => s.state !== "disabled");
	const ok = list.filter((s) => s.ok).length;
	const total = list.length;
	const unverified = list.every((s) => !s.ok) && total > 0;
	const tone = total === 0 ? "muted" : ok === total ? "ok" : ok === 0 ? "bad" : "warn";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/status/sources",
		className: cn("inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold", tone === "ok" && "border-emerald-500/40 text-emerald-500", tone === "warn" && "border-amber-500/40 text-amber-500", tone === "bad" && "border-price-up/40 text-price-up", tone === "muted" && "border-border text-muted-foreground", className),
		title: "소스별 상태 · 재시도",
		"data-testid": "source-health-chip",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, {
				className: "size-3",
				"aria-hidden": true
			}),
			total === 0 ? "소스 확인 중" : `소스 ${ok}/${total} 정상`,
			unverified && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-normal opacity-80",
				children: "· 소스 미검증"
			})
		]
	});
}
function Chip({ active, onClick, children, title }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		title,
		"aria-pressed": active,
		className: cn("inline-flex min-h-9 items-center rounded-md border px-2 text-[11px] font-medium sm:min-h-7", active ? "border-foreground/30 bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground"),
		children
	});
}
function toggle(list, id) {
	return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
/** Feed filters (B0.7): source, topic, minimum importance, watchlist-only, search. */
function FilterBar({ value, onChange, sources = [], topics = [], kinds, className }) {
	const dirty = value.sources.length > 0 || value.topics.length > 0 || value.minImportance > 0 || value.watchOnly || value.q.trim() || (value.kinds?.length ?? 0) > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("space-y-2 rounded-lg border border-border bg-muted/15 p-2.5", className),
		"data-testid": "feed-filter-bar",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "size-3" }), " 필터"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative min-w-0 flex-1 basis-48",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: value.q,
							onChange: (e) => onChange({
								...value,
								q: e.target.value
							}),
							placeholder: "제목·종목·출처 검색",
							className: "h-9 pl-8 text-xs",
							"aria-label": "피드 검색"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: String(value.minImportance),
						onChange: (e) => onChange({
							...value,
							minImportance: Number(e.target.value)
						}),
						className: "h-9 rounded-md border border-border bg-background px-2 text-xs",
						"aria-label": "최소 중요도",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "0",
								children: "중요도 전체"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "60",
								children: "HIGH 이상 (60+)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "80",
								children: "FLASH (80+)"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						active: value.watchOnly,
						onClick: () => onChange({
							...value,
							watchOnly: !value.watchOnly
						}),
						title: "관심종목·키워드 매칭만",
						children: "관심종목만"
					}),
					dirty && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => onChange({
							sources: [],
							topics: [],
							minImportance: 0,
							watchOnly: false,
							q: "",
							kinds: []
						}),
						className: "inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:text-foreground sm:min-h-7",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3" }), " 초기화"]
					})
				]
			}),
			kinds && kinds.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-1",
				"aria-label": "종류",
				children: kinds.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
					active: value.kinds?.includes(k.id) ?? false,
					onClick: () => onChange({
						...value,
						kinds: toggle(value.kinds ?? [], k.id)
					}),
					children: k.label
				}, k.id))
			}),
			sources.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex max-w-full flex-wrap gap-1",
				"aria-label": "출처",
				children: sources.slice(0, 16).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
					active: value.sources.includes(s.id),
					onClick: () => onChange({
						...value,
						sources: toggle(value.sources, s.id)
					}),
					children: [s.name, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-1 tabular opacity-60",
						children: s.count
					})]
				}, s.id))
			}),
			topics.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-1",
				"aria-label": "주제",
				children: topics.slice(0, 12).map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
					active: value.topics.includes(t.id),
					onClick: () => onChange({
						...value,
						topics: toggle(value.topics, t.id)
					}),
					children: [
						"#",
						topicLabel(t.id),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-1 tabular opacity-60",
							children: t.count
						})
					]
				}, t.id))
			})
		]
	});
}
var NAME_BY_CODE = new Map(UNIVERSE.map((u) => [u.code, u.nameKo]));
function krTickerLabel(t) {
	return t.market === "KR" ? NAME_BY_CODE.get(t.code) ?? t.code : void 0;
}
/** Explain an empty list honestly (A3.1): which sources failed and why. */
function emptyReasonFor(sources, loading, filtered) {
	if (loading) return "수신 중…";
	if (filtered) return "현재 필터에 맞는 항목이 없습니다. 필터를 줄여 보세요.";
	const active = sources.filter((s) => s.state !== "disabled");
	if (!active.length) return "이 화면에 연결된 소스가 모두 비활성 상태입니다.";
	if (active.filter((s) => !s.ok).length === active.length) return `소스 ${active.length}곳 모두 응답하지 않았습니다(소스 미검증·네트워크 차단·서킷 등). 데이터를 채워 넣지 않습니다.`;
	return "응답한 소스에 표시할 기사가 없습니다.";
}
/** Filterable newest-first feed with 더 보기 (B0.7). */
function NewsDesk({ items, sources, loading, hasMore, loadingMore, onLoadMore, tz = "KST", withEt = false, kinds, header, translations }) {
	const [filters, setFilters] = (0, import_react.useState)(EMPTY_FILTERS);
	const watch = useWatchContext();
	const visible = (0, import_react.useMemo)(() => applyFeedFilters(items, filters, watch), [
		items,
		filters,
		watch
	]);
	const facetsS = (0, import_react.useMemo)(() => sourceFacets(items), [items]);
	const facetsT = (0, import_react.useMemo)(() => topicFacets(items), [items]);
	const filtered = visible.length !== items.length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "space-y-2",
		"aria-label": "뉴스 목록",
		children: [
			header,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterBar, {
				value: filters,
				onChange: setFilters,
				sources: facetsS,
				topics: facetsT,
				kinds
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex items-center justify-between text-[10px] text-muted-foreground",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"표시 ",
					visible.length,
					"건",
					filtered ? ` / 전체 ${items.length}건` : "",
					" · 최신순"
				] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedList, {
				items: visible,
				tz,
				withEt,
				loading,
				hasMore,
				loadingMore,
				onLoadMore,
				emptyReason: emptyReasonFor(sources, loading, filtered),
				labelFor: krTickerLabel,
				translations
			})
		]
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/session-CI6EBFwL.js
/**
* Clock-based session estimates (F1.2 / F3.3). Holidays are NOT modeled, so
* every label is marked `추정` unless a verified calendar source says
* otherwise. Pure module.
*/
var US_SESSION_LABEL = {
	pre: "프리마켓",
	regular: "정규장",
	after: "애프터마켓",
	closed: "휴장"
};
function weekday(ms, zone) {
	const p = zonedParts(ms, zone);
	return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}
/** US equities by the New York clock: pre 04:00–09:30, regular 09:30–16:00, after 16:00–20:00. */
function usSessionEstimate(now = Date.now()) {
	const p = zonedParts(now, "America/New_York");
	const wd = weekday(now, "America/New_York");
	const mins = p.h * 60 + p.mi;
	let session = "closed";
	if (wd >= 1 && wd <= 5) {
		if (mins >= 240 && mins < 570) session = "pre";
		else if (mins >= 570 && mins < 960) session = "regular";
		else if (mins >= 960 && mins < 1200) session = "after";
	}
	return {
		session,
		label: US_SESSION_LABEL[session],
		estimated: true
	};
}
var KR_SESSION_LABEL = {
	"nxt-pre": "NXT 프리마켓",
	"pre-auction": "장전 동시호가",
	regular: "KRX 정규장",
	"close-auction": "장마감 동시호가",
	"after-hours": "KRX 시간외 · NXT 애프터",
	"nxt-after": "NXT 애프터마켓",
	closed: "장 마감"
};
/**
* KRX/NXT by the KST clock: NXT pre 08:00–08:50, KRX pre-auction 08:30–09:00,
* regular 09:00–15:20, closing auction 15:20–15:30, KRX after-hours 15:40–18:00
* (NXT after 15:30–20:00). Weekends closed; holidays not modeled.
*/
function krSessionEstimate(now = Date.now()) {
	const p = zonedParts(now, "Asia/Seoul");
	const wd = weekday(now, "Asia/Seoul");
	const mins = p.h * 60 + p.mi;
	let session = "closed";
	if (wd >= 1 && wd <= 5) {
		if (mins >= 480 && mins < 510) session = "nxt-pre";
		else if (mins >= 510 && mins < 540) session = "pre-auction";
		else if (mins >= 540 && mins < 920) session = "regular";
		else if (mins >= 920 && mins < 930) session = "close-auction";
		else if (mins >= 940 && mins < 1080) session = "after-hours";
		else if (mins >= 930 && mins < 1200) session = "nxt-after";
	}
	return {
		session,
		label: KR_SESSION_LABEL[session],
		estimated: true
	};
}
/** Naver index `marketStatus` codes → Korean label (source-provided, not estimated). */
function krIndexStatusLabel(ms) {
	if (!ms) return null;
	const u = ms.toUpperCase();
	if (u === "OPEN") return "KRX 개장";
	if (u === "CLOSE" || u === "CLOSED") return "KRX 마감";
	if (u === "PREOPEN" || u === "PRE") return "KRX 장전";
	if (u === "AFTER" || u === "AFTERHOURS") return "KRX 시간외";
	return ms;
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/use-live-wire-Dlqrbp3h.js
var WIRE_TABS = [
	{
		id: "all",
		label: "전체"
	},
	{
		id: "kr",
		label: "한국"
	},
	{
		id: "us",
		label: "미국"
	},
	{
		id: "etf",
		label: "ETF"
	},
	{
		id: "robotics",
		label: "로봇"
	},
	{
		id: "watch",
		label: "관심종목"
	}
];
var RANK = {
	normal: 1,
	high: 2,
	flash: 3
};
function itemTier(it) {
	return it.importance?.tier ?? "normal";
}
function meetsTier(it, min) {
	return RANK[itemTier(it)] >= RANK[min];
}
var POLL_VISIBLE_MS = 2e4;
var POLL_HIDDEN_MS = 6e4;
var POLL_CLOSED_MS = 18e4;
var POLL_MAX_BACKOFF_MS = 3e5;
function bothMarketsClosed(now) {
	return krSessionEstimate(now).session === "closed" && usSessionEstimate(now).session === "closed";
}
/** 20 s visible / 60 s hidden / 180 s when KR and US are both closed; errors back off ×2 up to 5 min. */
function pollIntervalMs(opts) {
	const base = bothMarketsClosed(opts.now) ? POLL_CLOSED_MS : opts.visible ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
	const n = Math.max(0, opts.errorCount ?? 0);
	if (!n) return base;
	return Math.min(base * 2 ** n, POLL_MAX_BACKOFF_MS);
}
var EMPTY_SEEN = {
	seenIds: [],
	seenClusters: [],
	unread: 0,
	lastSeenAt: null,
	initialized: false
};
/**
* Items not seen before by id or by cluster id. The first diff only records
* what is on the wire (no flood of "new" items on first load).
*/
function diffNewItems(items, state, now) {
	const ids = new Set(state.seenIds);
	const clusters = new Set(state.seenClusters);
	const fresh = [];
	for (const it of items) {
		const memberIds = it.cluster?.members?.map((m) => m.id) ?? [];
		if (!(ids.has(it.id) || (it.cluster?.id ? clusters.has(it.cluster.id) : false) || memberIds.some((m) => ids.has(m))) && state.initialized) fresh.push(it);
		ids.add(it.id);
		for (const m of memberIds) ids.add(m);
		if (it.cluster?.id) clusters.add(it.cluster.id);
	}
	const cap = (xs) => [...xs].slice(-600);
	return {
		fresh,
		next: {
			seenIds: cap(ids),
			seenClusters: cap(clusters),
			unread: state.unread,
			lastSeenAt: items.length ? new Date(now).toISOString() : state.lastSeenAt,
			initialized: true
		}
	};
}
function wireCategories(it) {
	const out = [it.kind === "briefing" ? "news" : it.kind];
	if (it.topics.includes("etf")) out.push("etf");
	if (it.topics.includes("robotics")) out.push("robotics");
	return out;
}
/** Region and category toggles (every applicable category must be on). */
function passesToggles(it, s) {
	if (!(it.region === "GLOBAL" ? s.regions.KR || s.regions.US : s.regions[it.region])) return false;
	return wireCategories(it).every((c) => s.categories[c] !== false);
}
function minutesOf(hhmm) {
	const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
	if (!m) return null;
	const h = Number(m[1]);
	const mi = Number(m[2]);
	return h < 24 && mi < 60 ? h * 60 + mi : null;
}
function inQuietHours(now, q) {
	if (!q.enabled) return false;
	const start = minutesOf(q.start);
	const end = minutesOf(q.end);
	if (start == null || end == null || start === end) return false;
	const p = zonedParts(now, "Asia/Seoul");
	const t = p.h * 60 + p.mi;
	return start < end ? t >= start && t < end : t >= start || t < end;
}
var RATE_WINDOW_MS = 6e5;
var EMPTY_NOTIFY = {
	sentAt: [],
	digestAt: null,
	held: 0
};
function planNotifications(fresh, s, ctx, state) {
	const quiet = inQuietHours(ctx.now, s.quietHours);
	const sentAt = state.sentAt.filter((t) => ctx.now - t < RATE_WINDOW_MS);
	let held = state.held;
	let digestAt = state.digestAt;
	const toasts = [];
	const os = [];
	if (s.paused) return {
		toasts,
		os,
		digest: null,
		sound: false,
		quiet,
		next: {
			sentAt,
			digestAt,
			held
		}
	};
	for (const it of fresh) {
		if (!passesToggles(it, s)) continue;
		const wantToast = s.inAppEnabled && ctx.visible && meetsTier(it, s.inAppMinTier);
		const watchHit = s.osWatchMatches && ctx.watch ? isWatchMatch(it, ctx.watch) : false;
		const wantOs = s.osEnabled && ctx.osPermission === "granted" && ctx.leader && !quiet && (meetsTier(it, s.osMinTier) || watchHit);
		if (!wantToast && !wantOs) continue;
		if (sentAt.length >= 5) {
			held += 1;
			continue;
		}
		sentAt.push(ctx.now);
		if (wantToast) toasts.push(it);
		if (wantOs) os.push(it);
	}
	let digest = null;
	if (held > 0 && (digestAt == null || ctx.now - digestAt >= 6e5)) {
		digest = { count: held };
		digestAt = ctx.now;
		held = 0;
	}
	const sound = s.sound && !quiet && (toasts.length > 0 || os.length > 0);
	return {
		toasts,
		os,
		digest,
		sound,
		quiet,
		next: {
			sentAt,
			digestAt,
			held
		}
	};
}
function matchesWireTab(it, tab, watch) {
	switch (tab) {
		case "all": return true;
		case "kr": return it.region === "KR";
		case "us": return it.region === "US";
		case "etf": return it.topics.includes("etf");
		case "robotics": return it.topics.includes("robotics");
		case "watch": return watch ? isWatchMatch(it, watch) : false;
	}
}
/** Canonical `regions` param for `/api/wire` (sorted, de-duplicated). */
function canonicalRegions(input) {
	const ok = /* @__PURE__ */ new Set(["KR", "US"]);
	const list = [...new Set(input.map((r) => r.trim().toUpperCase()).filter((r) => ok.has(r)))].sort();
	return (list.length ? list : ["KR", "US"]).join(",");
}
var LS_KEY = "ked-live-wire-v1";
var LOCK_NAME = "ked-live-wire-leader";
var CHANNEL = "ked-live-wire";
var HEARTBEAT_KEY = "ked-live-wire-heartbeat";
function loadSeen() {
	try {
		const raw = localStorage.getItem(LS_KEY);
		if (!raw) return EMPTY_SEEN;
		const v = JSON.parse(raw);
		return {
			seenIds: Array.isArray(v.seenIds) ? v.seenIds.filter((x) => typeof x === "string") : [],
			seenClusters: Array.isArray(v.seenClusters) ? v.seenClusters.filter((x) => typeof x === "string") : [],
			unread: typeof v.unread === "number" && v.unread >= 0 ? v.unread : 0,
			lastSeenAt: typeof v.lastSeenAt === "string" ? v.lastSeenAt : null,
			initialized: v.initialized === true
		};
	} catch {
		return EMPTY_SEEN;
	}
}
function saveSeen(s) {
	try {
		localStorage.setItem(LS_KEY, JSON.stringify(s));
	} catch {}
}
var seen = EMPTY_SEEN;
var useWireStore = create()((set) => ({
	items: [],
	sources: [],
	generatedAt: null,
	partial: false,
	unread: 0,
	role: "starting",
	errorCount: 0,
	lastError: null,
	lastFetchAt: null,
	drawerOpen: false,
	highlightId: null,
	setDrawerOpen: (open) => {
		set({
			drawerOpen: open,
			...open ? {} : { highlightId: null }
		});
		if (open) {
			seen = {
				...seen,
				unread: 0
			};
			saveSeen(seen);
			set({ unread: 0 });
		}
	},
	markAllRead: () => {
		seen = {
			...seen,
			unread: 0
		};
		saveSeen(seen);
		set({ unread: 0 });
	},
	openItem: (id) => {
		seen = {
			...seen,
			unread: 0
		};
		saveSeen(seen);
		set({
			drawerOpen: true,
			highlightId: id,
			unread: 0
		});
	}
}));
/** Short WebAudio beep (F8.4, off by default; no external asset). */
function beep() {
	try {
		const Ctx = window.AudioContext ?? window.webkitAudioContext;
		if (!Ctx) return;
		const ctx = new Ctx();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.frequency.value = 880;
		gain.gain.value = .05;
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + .12);
		osc.onended = () => void ctx.close();
	} catch {}
}
function notificationPermission() {
	if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
	return Notification.permission;
}
/**
* "데스크톱 알림 켜기" — requests permission INSIDE the click handler (never on
* load) and switches OS notifications on only when granted.
*/
async function enableDesktopAlerts() {
	if (typeof Notification === "undefined") return "unsupported";
	const result = await Notification.requestPermission();
	useAppStore.getState().setAlertSettings({ osEnabled: result === "granted" });
	return result;
}
function showOs(item) {
	try {
		const n = new Notification(item.title, {
			body: `${item.outlet ?? item.sourceName}${item.importance?.reasons.length ? ` · ${item.importance.reasons.slice(0, 2).join(" · ")}` : ""}`,
			tag: item.id,
			lang: item.lang
		});
		n.onclick = () => {
			window.focus();
			useWireStore.getState().openItem(item.id);
			n.close();
		};
	} catch {}
}
function showToast(item) {
	toast(item.title, {
		id: `wire:${item.id}`,
		description: `${item.importance?.tier === "flash" ? "FLASH" : "HIGH"} · ${item.outlet ?? item.sourceName}`,
		action: {
			label: "원문",
			onClick: () => window.open(item.url, "_blank", "noopener,noreferrer")
		},
		duration: 8e3
	});
}
/**
* Live Wire engine (F8.2). Mount once (AppShell). One tab — elected with the
* Web Locks API, else a localStorage heartbeat — polls `/api/wire`; the page
* is shared with other tabs over BroadcastChannel. Every tab diffs what it
* has seen, updates the unread badge and plans its own notifications.
*/
function useLiveWireEngine() {
	const settings = useAppStore((s) => s.alertSettings);
	const disabled = useDisabledSources();
	const watch = useWatchContext();
	const latest = (0, import_react.useRef)({
		settings,
		disabled,
		watch
	});
	latest.current = {
		settings,
		disabled,
		watch
	};
	const notify = (0, import_react.useRef)(EMPTY_NOTIFY);
	(0, import_react.useEffect)(() => {
		seen = loadSeen();
		useWireStore.setState({ unread: seen.unread });
		const tabId = Math.random().toString(36).slice(2);
		let leader = false;
		let stopped = false;
		let timer;
		let heartbeat;
		const lockAbort = new AbortController();
		let releaseLock = null;
		const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
		let lastPage = null;
		const apply = (page) => {
			lastPage = page;
			const { settings: s, disabled: d, watch: w } = latest.current;
			const now = Date.now();
			const items = sortNewestFirst(personalize(filterDisabledSources(page.items, d), w, now));
			const { fresh, next } = diffNewItems(items, seen, now);
			const counted = fresh.filter((it) => passesToggles(it, s)).length;
			const drawerOpen = useWireStore.getState().drawerOpen;
			seen = {
				...next,
				unread: drawerOpen ? 0 : next.unread + counted
			};
			saveSeen(seen);
			useWireStore.setState({
				items,
				sources: page.sources,
				generatedAt: page.generatedAt,
				partial: page.partial,
				unread: seen.unread
			});
			if (!fresh.length) return;
			const plan = planNotifications(fresh, s, {
				now,
				watch: w,
				osPermission: notificationPermission(),
				visible: document.visibilityState === "visible",
				leader
			}, notify.current);
			notify.current = plan.next;
			for (const it of plan.toasts.slice(0, 5)) showToast(it);
			for (const it of plan.os) showOs(it);
			if (plan.digest) toast(`새 주요 뉴스 ${plan.digest.count}건 더`, {
				id: `wire-digest:${now}`,
				description: "알림이 많아 묶었습니다 (10분에 최대 5건). Live Wire에서 확인하세요.",
				action: {
					label: "열기",
					onClick: () => useWireStore.getState().setDrawerOpen(true)
				}
			});
			if (plan.sound) beep();
		};
		const schedule = () => {
			if (stopped || !leader) return;
			if (timer) clearTimeout(timer);
			const { errorCount } = useWireStore.getState();
			timer = setTimeout(poll, pollIntervalMs({
				visible: document.visibilityState === "visible",
				now: Date.now(),
				errorCount
			}));
		};
		const poll = async () => {
			if (stopped || !leader) return;
			if (latest.current.settings.paused) return schedule();
			const { regions } = latest.current.settings;
			const list = [regions.KR ? "KR" : "", regions.US ? "US" : ""].filter(Boolean);
			try {
				const res = await fetch(`/api/wire?regions=${canonicalRegions(list)}`, { headers: { accept: "application/json" } });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const page = await res.json();
				useWireStore.setState({
					errorCount: 0,
					lastError: null,
					lastFetchAt: Date.now()
				});
				apply(page);
				channel?.postMessage({
					type: "page",
					page
				});
			} catch (err) {
				useWireStore.setState((st) => ({
					errorCount: st.errorCount + 1,
					lastError: err instanceof Error ? err.message : "error"
				}));
			}
			schedule();
		};
		const becomeLeader = () => {
			if (leader || stopped) return;
			leader = true;
			useWireStore.setState({ role: "leader" });
			poll();
		};
		channel?.addEventListener("message", (ev) => {
			if (ev.data?.type === "page" && ev.data.page && !leader) apply(ev.data.page);
			if (ev.data?.type === "hello" && leader && lastPage) channel.postMessage({
				type: "page",
				page: lastPage
			});
		});
		const locks = typeof navigator !== "undefined" ? navigator.locks : void 0;
		if (locks?.request) {
			useWireStore.setState({ role: "follower" });
			locks.request(LOCK_NAME, { signal: lockAbort.signal }, () => new Promise((resolve) => {
				releaseLock = resolve;
				becomeLeader();
			})).catch(() => void 0);
		} else {
			const tick = () => {
				try {
					const raw = localStorage.getItem(HEARTBEAT_KEY);
					const cur = raw ? JSON.parse(raw) : null;
					if (!cur || cur.id === tabId || Date.now() - cur.at > 15e3) {
						localStorage.setItem(HEARTBEAT_KEY, JSON.stringify({
							id: tabId,
							at: Date.now()
						}));
						becomeLeader();
					} else if (!leader) useWireStore.setState({ role: "follower" });
				} catch {
					becomeLeader();
				}
			};
			tick();
			heartbeat = setInterval(tick, 5e3);
		}
		channel?.postMessage({ type: "hello" });
		const onVisibility = () => schedule();
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			stopped = true;
			if (timer) clearTimeout(timer);
			if (heartbeat) clearInterval(heartbeat);
			document.removeEventListener("visibilitychange", onVisibility);
			lockAbort.abort();
			releaseLock?.();
			channel?.close();
			try {
				const raw = localStorage.getItem(HEARTBEAT_KEY);
				if (raw && JSON.parse(raw).id === tabId) localStorage.removeItem(HEARTBEAT_KEY);
			} catch {}
		};
	}, []);
}
/** Live Wire state for UI (F8.2 `useLiveWire`): items, unread, role, errors, drawer. */
function useLiveWire() {
	return useWireStore();
}
/**
* Fire a chart alert through the Live Wire notifier (F7.11): in-app toast
* always; OS notification when enabled + granted and outside quiet hours.
*/
function notifyAlert(title, body) {
	const s = useAppStore.getState().alertSettings;
	toast(title, {
		id: `alert:${title}:${Date.now()}`,
		description: body,
		duration: 1e4,
		action: {
			label: "Live Wire",
			onClick: () => useWireStore.getState().setDrawerOpen(true)
		}
	});
	if (s.osEnabled && notificationPermission() === "granted" && !inQuietHours(Date.now(), s.quietHours)) try {
		const n = new Notification(title, {
			body,
			tag: `alert:${title}`
		});
		n.onclick = () => {
			window.focus();
			n.close();
		};
	} catch {}
	if (s.sound && !inQuietHours(Date.now(), s.quietHours)) beep();
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-B1V8nj-n.js
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function QueryProvider({ children }) {
	const [client] = (0, import_react.useState)(() => new QueryClient({ defaultOptions: { queries: {
		retry: 1,
		refetchOnWindowFocus: false,
		staleTime: 2e4
	} } }));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client,
		children
	});
}
/**
* Top branding bar for deployed apps. Shown only when live
* GetRemixEligibility reports forkable. Project id is the sole VITE_ input
* (needed to call the RPC and build the remix link).
*/
var BANNER_HEIGHT = "2.75rem";
var BANNER_HEIGHT_VAR = "--grok-banner-h";
var REMIX_ELIGIBILITY_PATH = "/rest/app-deployer/v1/projects/{project_id}/remix-eligibility";
function readEnv(key) {
	const fromVite = {
		"BASE_URL": "/",
		"DEV": false,
		"MODE": "production",
		"PROD": true,
		"SSR": true,
		"TSS_DEV_SERVER": "false",
		"TSS_DEV_SSR_STYLES_BASEPATH": "/",
		"TSS_DEV_SSR_STYLES_ENABLED": "true",
		"TSS_DISABLE_CSRF_MIDDLEWARE_WARNING": "false",
		"TSS_INLINE_CSS_ENABLED": "false",
		"TSS_ROUTER_BASEPATH": "",
		"TSS_SERVER_FN_BASE": "/_serverFn/",
		"VITE_AUTH_ENABLED": "false",
		"VITE_DEV_SERVER_HOST": "0.0.0.0"
	}[key];
	if (fromVite !== void 0 && fromVite !== "") return fromVite;
}
function remixEligibilityUrl(projectId) {
	return `https://app-builder-deployer.grok.com${REMIX_ELIGIBILITY_PATH.replace("{project_id}", encodeURIComponent(projectId))}`;
}
async function fetchRemixEligible(projectId) {
	try {
		const response = await fetch(remixEligibilityUrl(projectId), {
			method: "GET",
			credentials: "omit",
			headers: { Accept: "application/json" }
		});
		if (!response.ok) return false;
		const data = await response.json();
		if (!data || typeof data !== "object" || !("forkable" in data)) return false;
		return data.forkable === true;
	} catch {
		return false;
	}
}
function RemixIcon() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "14",
		height: "14",
		viewBox: "0 0 14 14",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
		className: "block size-3.5 shrink-0",
		"aria-hidden": true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M2.85059 3.5C3.42171 3.49757 3.9879 3.74949 4.36816 4.17562C5.82851 5.79822 7.28852 7.42134 8.74886 9.04394C8.91014 9.22468 9.14982 9.3323 9.39201 9.33333C9.39445 9.33335 9.39697 9.33333 9.39941 9.33333C9.69335 9.33354 9.98729 9.34136 10.2812 9.35612L9.50423 8.5791L10.3291 7.75423L12.4915 9.91667L10.3291 12.0791L9.50423 11.2542L10.2812 10.4766C9.98728 10.4914 9.69336 10.4998 9.39941 10.5C9.39371 10.5 9.38802 10.5 9.38232 10.5C8.81697 10.4976 8.25832 10.2462 7.88184 9.82438C6.42149 8.20178 4.96148 6.57866 3.50114 4.95605C3.33823 4.77345 3.09529 4.66561 2.85059 4.66667H1.75V3.5H2.85059Z",
				fill: "#417CFF"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M5.53597 8.52612C5.14663 8.95882 4.75754 9.39174 4.36816 9.82438C3.9879 10.2505 3.42171 10.5024 2.85059 10.5H1.75V9.33333H2.85059C3.09529 9.33439 3.33823 9.22655 3.50114 9.04394C3.91804 8.58073 4.33469 8.11725 4.75155 7.65397L5.53597 8.52612Z",
				fill: "#417CFF"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M12.4915 4.08333L10.3291 6.24577L9.50423 5.4209L10.2801 4.64445C9.99185 4.65884 9.70361 4.66667 9.41536 4.66667H9.39941C9.15471 4.66561 8.91177 4.77346 8.74886 4.95605C8.33197 5.41926 7.91473 5.88219 7.49788 6.34546L6.71346 5.47331C7.10279 5.04063 7.49247 4.60825 7.88184 4.17562C8.2621 3.74949 8.8283 3.49757 9.39941 3.5H9.41536C9.7036 3.5 9.99186 3.50726 10.2801 3.52165L9.50423 2.74577L10.3291 1.9209L12.4915 4.08333Z",
				fill: "#417CFF"
			})
		]
	});
}
function CreatedWithGrokBanner() {
	const projectId = (readEnv("VITE_PROJECT_ID") ?? "").trim();
	const [showRemix, setShowRemix] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (projectId.length === 0) return;
		fetchRemixEligible(projectId).then(setShowRemix);
	}, [projectId]);
	if (!showRemix) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none fixed top-2 left-0 right-0 z-[100] flex justify-center",
		"data-created-with-grok-banner": true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `:root{${BANNER_HEIGHT_VAR}:${BANNER_HEIGHT};}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
			href: `https://grok.com/remix?app_id=${encodeURIComponent(projectId)}`,
			target: "_blank",
			rel: "noopener noreferrer",
			"aria-label": "Created with Grok — Remix this app",
			className: "group pointer-events-auto flex h-9 select-none items-center gap-2 rounded-full border border-white/15 bg-black/85 backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.08)] pl-4 pr-1.5 text-[13px] leading-none text-white/90",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-medium tracking-tight text-white/85",
				children: "Created with Grok"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "inline-flex h-6 items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 text-[12px] font-medium text-white transition-colors group-hover:bg-white/15",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemixIcon, {}), "Remix"]
			})]
		})]
	});
}
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
/**
* Stock universe accessors. Prices are NOT stored here —
* load live quotes via getMarketQuotes / useMarketQuotes.
*/
function stocksBySector(sectorId) {
	if (sectorId === "us-linked") return US_LINKED_CODES.map((c) => UNIVERSE_BY_CODE[c]).filter(Boolean);
	return UNIVERSE.filter((s) => s.sectorId === sectorId);
}
var getStocksBySector = stocksBySector;
function searchUniverse(q) {
	const s = q.trim();
	if (!s) return [];
	const hits = UNIVERSE.filter((x) => matchesSearchQuery(s, [
		x.nameKo,
		x.nameEn,
		x.code,
		SECTOR_BY_ID[x.sectorId]?.nameKo,
		SECTOR_BY_ID[x.sectorId]?.nameEn
	]));
	return rankByQuery(hits, s, (x) => ({
		name: x.nameKo,
		code: x.code
	})).slice(0, 20);
}
function mergeQuote(meta, q) {
	const price = q?.price ?? 0;
	const marketCap = q?.marketCap ?? 0;
	return {
		code: meta.code,
		nameKo: meta.nameKo,
		nameEn: meta.nameEn,
		sectorId: meta.sectorId,
		market: meta.market,
		price,
		change: q?.change ?? 0,
		changePct: q?.changePct ?? 0,
		volume: q?.volume ?? 0,
		marketCap,
		high52: q?.high52 ?? 0,
		low52: q?.low52 ?? 0,
		sparkline: [],
		capBand: marketCap >= 1e5 ? "대형" : marketCap >= 2e4 ? "중형" : "소형"
	};
}
function quoteToStock(q) {
	return mergeQuote({
		code: q.code,
		nameKo: q.nameKo,
		nameEn: q.nameEn,
		sectorId: q.sectorId,
		market: q.market
	}, q);
}
function marketMoversFromQuotes(quotes, n = 6) {
	const byPct = [...[...quotes].filter((q) => q.price > 0)].sort((a, b) => b.changePct - a.changePct);
	return {
		gainers: byPct.slice(0, n).map(quoteToStock),
		losers: [...byPct].reverse().slice(0, n).map(quoteToStock)
	};
}
function sectorStatsFromQuotes(sectorId, quotes) {
	const codes = sectorId === "us-linked" ? new Set(US_LINKED_CODES) : new Set(UNIVERSE.filter((u) => u.sectorId === sectorId).map((u) => u.code));
	const list = quotes.filter((q) => codes.has(q.code) && q.price > 0);
	if (!list.length) return {
		count: 0,
		avgChangePct: 0,
		topGainer: null,
		topLoser: null
	};
	const avg = list.reduce((s, q) => s + q.changePct, 0) / Math.max(1, list.length);
	const sorted = [...list].sort((a, b) => b.changePct - a.changePct);
	return {
		count: list.length,
		avgChangePct: avg,
		topGainer: quoteToStock(sorted[0]),
		topLoser: quoteToStock(sorted[sorted.length - 1])
	};
}
/** Coverage-universe snapshot quotes (Naver). KIS ticks overlay via useMarketStream. */
function useMarketQuotes(refetchMs = 45e3) {
	return useQuery({
		queryKey: ["market-quotes"],
		queryFn: () => getMarketQuotes(),
		staleTime: 4e4,
		refetchInterval: refetchMs,
		refetchOnWindowFocus: false
	});
}
function useQuoteMap() {
	const q = useMarketQuotes();
	const map = /* @__PURE__ */ new Map();
	for (const quote of q.data?.quotes ?? []) map.set(quote.code, quote);
	return {
		...q,
		map
	};
}
function useStockBundle(code) {
	const padded = normalizeKrTicker(code);
	return useQuery({
		queryKey: ["stock-bundle", padded],
		queryFn: () => getStockBundle({ data: { code: padded } }),
		staleTime: 25e3,
		refetchInterval: 45e3,
		refetchOnWindowFocus: false,
		enabled: isDigitTicker(padded)
	});
}
function useChartData(opts) {
	const us = opts.market === "US";
	const code = us ? yahooUsSymbol(opts.code) ?? opts.code.trim().toUpperCase() : normalizeKrTicker(opts.code);
	return useQuery({
		queryKey: [
			"chart",
			code,
			opts.market,
			opts.interval,
			opts.minuteSize ?? 1,
			opts.range ?? "default",
			opts.prePost ? "prepost" : ""
		],
		queryFn: () => getChartData({ data: {
			code,
			market: opts.market,
			interval: opts.interval,
			minuteSize: opts.minuteSize,
			range: opts.range,
			prePost: us && opts.interval === "minute" ? Boolean(opts.prePost) : void 0
		} }),
		staleTime: opts.interval === "minute" ? 15e3 : 6e4,
		enabled: (opts.enabled ?? true) && (us ? yahooUsSymbol(code) != null : isKrTicker(code)),
		refetchOnWindowFocus: false
	});
}
function useValuationSeries(code, enabled = true) {
	const us = yahooUsSymbol(code);
	const kr = normalizeKrTicker(code);
	const key = us ?? kr;
	return useQuery({
		queryKey: ["valuation-series", key],
		queryFn: () => getValuationSeries({ data: { code: key } }),
		staleTime: 216e5,
		enabled: enabled && Boolean(us || isKrTicker(kr)),
		refetchOnWindowFocus: false,
		retry: 1
	});
}
function useMarketIndices() {
	return useQuery({
		queryKey: ["market-indices"],
		queryFn: () => getMarketIndices(),
		staleTime: 2e4,
		refetchInterval: 3e4,
		refetchOnWindowFocus: false
	});
}
function useResearchDesk(opts) {
	return useQuery({
		queryKey: ["research-desk"],
		queryFn: () => getResearchDesk(),
		staleTime: 3e5,
		enabled: opts?.enabled ?? true,
		refetchOnWindowFocus: false
	});
}
/** First 12 of usWatchlist ∪ US_STREET_SYMBOLS ∪ robotics US names (F4.5). */
function useStreetUniverse() {
	const usWatch = useAppStore((s) => s.usWatchlist);
	return (0, import_react.useMemo)(() => [.../* @__PURE__ */ new Set([
		...usWatch,
		...US_STREET_SYMBOLS,
		...ROBOTICS_US_SYMBOLS
	])].slice(0, 12), [usWatch]);
}
function useUsStreet(symbol, opts) {
	const ticker = symbol?.trim().toUpperCase() || "";
	const symbols = ticker ? void 0 : opts?.symbols;
	return useQuery({
		queryKey: [
			"us-street",
			"v3",
			ticker || "desk",
			symbols?.join(",") ?? ""
		],
		queryFn: () => getUsStreet({ data: ticker ? { symbol: ticker } : { symbols } }),
		staleTime: 6e5,
		enabled: opts?.enabled ?? true,
		refetchOnWindowFocus: false
	});
}
function useUsOfficialPolicy(opts) {
	return useQuery({
		queryKey: ["us-official-policy"],
		queryFn: () => getUsOfficialPolicy(),
		staleTime: 6e5,
		enabled: opts?.enabled ?? true,
		refetchOnWindowFocus: false
	});
}
function useUsOfficialUniverse(opts) {
	return useQuery({
		queryKey: ["us-official-universe"],
		queryFn: () => getUsOfficialUniverse(),
		staleTime: 6e5,
		enabled: opts?.enabled ?? true,
		refetchOnWindowFocus: false
	});
}
function useUsOfficialCompany(symbol) {
	const ticker = symbol?.trim().toUpperCase() || "";
	return useQuery({
		queryKey: ["us-official-company", ticker],
		queryFn: () => getUsOfficialCompany({ data: { symbol: ticker } }),
		enabled: ticker.length > 0,
		staleTime: 6e5,
		refetchOnWindowFocus: false
	});
}
function useUsOfficialReport(id) {
	const key = id?.trim() || "";
	return useQuery({
		queryKey: ["us-official-report", key],
		queryFn: () => getUsOfficialReport({ data: { id: key } }),
		enabled: key.length > 2,
		staleTime: 6e5,
		refetchOnWindowFocus: false
	});
}
function useIndustryResearch(sectorId) {
	return useQuery({
		queryKey: ["industry-research", sectorId],
		queryFn: () => getIndustryResearch({ data: { sectorId } }),
		enabled: Boolean(sectorId),
		staleTime: 18e4,
		refetchOnWindowFocus: false
	});
}
function useEtfMarket(opts) {
	return useQuery({
		queryKey: [
			"etf-market",
			opts.bucket ?? "all",
			opts.q ?? "",
			opts.limit ?? 100
		],
		queryFn: () => getEtfMarket({ data: {
			bucket: opts.bucket,
			q: opts.q,
			limit: opts.limit
		} }),
		staleTime: 45e3,
		enabled: opts.enabled ?? true,
		refetchOnWindowFocus: false
	});
}
function useEtfBundle(code) {
	const normalized = normalizeKrTicker(code);
	return useQuery({
		queryKey: ["etf-bundle", normalized],
		queryFn: () => getEtfBundle({ data: { code: normalized } }),
		staleTime: 3e4,
		enabled: isKrTicker(normalized),
		refetchOnWindowFocus: false
	});
}
function useUsLinkDesk() {
	return useQuery({
		queryKey: ["us-link-desk"],
		queryFn: () => getUsLinkDesk(),
		staleTime: 9e4,
		refetchInterval: 18e4,
		refetchOnWindowFocus: false
	});
}
function useSecuritySearch(q) {
	const needle = q.trim();
	return useQuery({
		queryKey: ["security-search", needle],
		queryFn: () => getSecuritySearch({ data: { q: needle } }),
		enabled: needle.length >= 1,
		staleTime: 6e4,
		placeholderData: (prev) => prev
	});
}
function useQuotesByCodes(codes) {
	const key = [...codes].sort().join(",");
	return useQuery({
		queryKey: ["quotes-by-codes", key],
		queryFn: () => getQuotesByCodes({ data: { codes } }),
		enabled: codes.length > 0,
		staleTime: 3e4
	});
}
function Switch({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
		className: cn("peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input", className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: cn("pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0") })
	});
}
/** Grouped navigation (F10.1). Every pre-existing URL keeps working. */
var NAV_GROUPS = [
	{
		id: "kr",
		label: "한국",
		items: [
			{
				to: "/",
				label: "대시보드",
				icon: LayoutDashboard,
				exact: true
			},
			{
				to: "/news/kr",
				label: "한국 뉴스",
				icon: Newspaper
			},
			{
				to: "/research",
				label: "리서치 데스크",
				icon: Library,
				search: { market: "kr" }
			},
			{
				to: "/etfs",
				label: "퇴직연금 ETF",
				icon: Layers,
				tone: "text-desk-gold"
			},
			{
				to: "/news/etf",
				label: "ETF 뉴스",
				icon: ChartPie
			},
			{
				to: "/disclosures",
				label: "주요 공시",
				icon: FileText
			},
			{
				to: "/export-desk",
				label: "수출 × KOSPI",
				icon: Ship,
				tone: "text-desk-gold"
			}
		]
	},
	{
		id: "us",
		label: "미국",
		items: [
			{
				to: "/news/us",
				label: "미국 뉴스",
				icon: Earth
			},
			{
				to: "/research",
				label: "미국 리서치",
				icon: ChartLine,
				search: { market: "us" }
			},
			{
				to: "/us-research",
				label: "공식 원문",
				icon: Landmark,
				tone: "text-desk-gold"
			},
			{
				to: "/us-link",
				label: "미국 연계",
				icon: Flag,
				tone: "text-desk-teal"
			}
		]
	},
	{
		id: "themes",
		label: "테마",
		items: [{
			to: "/robotics",
			label: "로봇",
			icon: Bot,
			tone: "text-desk-teal"
		}]
	},
	{
		id: "tools",
		label: "도구",
		items: [
			{
				to: "/watchlist",
				label: "관심종목",
				icon: Star
			},
			{
				to: "/settings/alerts",
				label: "알림 설정",
				icon: BellRing
			},
			{
				to: "/status/sources",
				label: "소스 상태",
				icon: Activity
			}
		]
	}
];
function isActive(item, pathname, search) {
	if (!(item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`))) return false;
	if (item.to === "/research") {
		const market = search.market === "us" ? "us" : "kr";
		return (item.search?.market ?? "kr") === market;
	}
	return true;
}
function Sidebar({ onNavigate, className }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const search = useRouterState({ select: (s) => s.location.search });
	const focusMode = useAppStore((s) => s.focusMode);
	const setFocusMode = useAppStore((s) => s.setFocusMode);
	const colors = usePriceColors();
	const { data } = useMarketQuotes();
	const quotes = data?.quotes ?? [];
	const sectors = focusMode ? SECTORS.filter((s) => FOCUS_SECTOR_IDS.includes(s.id) || s.focus) : SECTORS;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: cn("shell-sidebar flex h-full w-60 flex-col text-white", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-3.5 py-3.5 border-b border-white/[0.08]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					onClick: onNavigate,
					className: "flex items-center gap-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-8 items-center justify-center rounded-md bg-gradient-to-br from-desk-gold to-amber-700 text-xs font-bold text-black shadow",
						children: "KX"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "leading-tight",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-sm font-semibold tracking-tight text-white",
							children: "Korea Equity"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-[9px] font-medium uppercase tracking-[0.14em] text-white/45",
							children: "Command Center"
						})]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "px-2 py-2 space-y-2",
				"aria-label": "주 메뉴",
				children: NAV_GROUPS.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-0.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-2.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35",
						children: group.label
					}), group.items.map((item) => {
						const active = isActive(item, pathname, search);
						const Icon = item.icon;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.to,
							search: item.search,
							onClick: onNavigate,
							className: cn("nav-item", active ? "nav-item-active" : "nav-item-idle"),
							"aria-current": active ? "page" : void 0,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: cn("size-3.5 shrink-0", item.tone || "opacity-80") }), item.label]
						}, `${item.to}-${item.label}`);
					})]
				}, group.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-2.5 my-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center justify-between gap-2 text-xs text-white/90",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5 font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "size-3 text-desk-gold" }), "Focus 모드"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: focusMode,
						onCheckedChange: setFocusMode,
						"aria-label": "Focus 모드"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-[10px] text-white/50 leading-snug",
					children: "미국 연계 · 반도체 · 전지 · 바이오 · 로봇"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 overflow-y-auto scroll-thin px-2 pb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35",
					children: "Sectors · 산업"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-0.5",
					children: sectors.map((s) => {
						const stats = sectorStatsFromQuotes(s.id, quotes);
						const robotics = s.id === "robotics";
						const to = robotics ? "/robotics" : `/industry/${s.id}`;
						const active = pathname === to || pathname.startsWith(`${to}/`) || robotics && pathname.startsWith("/industry/robotics");
						const up = stats.avgChangePct > 0;
						const color = !stats.count || stats.avgChangePct === 0 ? "text-white/40" : up ? colors.up : colors.down;
						const cls = cn("nav-item justify-between", active ? "nav-item-active" : "nav-item-idle", s.id === "us-linked" && !active && "ring-1 ring-desk-gold/35");
						const body = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "truncate text-[13px]",
							children: [s.id === "us-linked" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-desk-gold mr-1",
								children: "★"
							}) : null, s.nameKo]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("text-[11px] tabular shrink-0 font-medium font-mono", color),
							children: stats.count ? formatPct(stats.avgChangePct) : "—"
						})] });
						return robotics ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/robotics",
							onClick: onNavigate,
							className: cls,
							"data-sector-link": "robotics",
							children: body
						}, s.id) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/industry/$sectorId",
							params: { sectorId: s.id },
							onClick: onNavigate,
							className: cls,
							children: body
						}, s.id);
					})
				})]
			})
		]
	});
}
/** Static labels only — values load from server-side market adapters. */
var DATA_LABEL = "실시간: KIS Open API · KRX WebSocket(설정 시) · 백업: 네이버 금융 스냅샷 · 리포트: 네이버 금융 · 공시: DART";
var DATA_DELAY_NOTE = "KIS 자격증명이 설정된 종목은 KRX 실시간 체결 스트림으로 갱신합니다. 미설정·장애 시 네이버 금융 스냅샷으로 자동 유지되며, 화면에 데이터 모드를 명시합니다. 시장 폭·섹터 통계는 앱 커버리지 종목 기준입니다.";
var RISK_DISCLAIMER = "본 서비스는 투자 권유가 아닙니다. 데이터 지연·오류 가능. 손실 책임은 이용자에게 있습니다.";
var US_LABEL = {
	spx: "SPX",
	ndx: "NDX",
	vix: "VIX",
	tnx: "US10Y",
	usdkrw: "USD/KRW"
};
function statusLabel(ms) {
	if (!ms) return null;
	const u = ms.toUpperCase();
	if (u === "OPEN") return "개장";
	if (u === "CLOSE" || u === "CLOSED") return "마감";
	if (u === "PREOPEN" || u === "PRE") return "장전";
	if (u === "AFTER" || u === "AFTERHOURS") return "시간외";
	return ms;
}
function MarketBar() {
	const colors = usePriceColors();
	const { data, isLoading, isError } = useMarketIndices();
	const usRows = (useMarketSnapshot([
		"spx",
		"ndx",
		"vix",
		"tnx",
		"usdkrw"
	], { refetchMs: 18e4 }).data?.rows ?? []).filter((r) => r.price != null);
	const [mounted, setMounted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setMounted(true), []);
	const indices = data?.indices ?? [];
	const anyOpen = indices.some((i) => i.marketStatus?.toUpperCase() === "OPEN");
	const status = statusLabel(indices[0]?.marketStatus);
	const source = data?.source ?? indices[0]?.source ?? "naver-finance-snapshot";
	const modeLabel = source === "kis-krx-websocket" ? "KIS·KRX LIVE" : "스냅샷(네이버)";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "market-tape",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-0 overflow-x-auto scroll-thin max-w-full",
			children: [
				mounted && isLoading && indices.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "px-3 py-2 text-[11px] text-muted-foreground",
					children: "지수 수신 중…"
				}),
				isError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "px-3 py-2 text-[11px] text-price-down",
					children: "지수 조회 실패"
				}),
				status && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "market-tape-item flex shrink-0 items-center gap-1.5 border-r border-border",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 rounded-full", anyOpen ? "bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" : "bg-muted-foreground") }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-semibold tracking-wide text-muted-foreground uppercase",
							children: status
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("rounded px-1 py-0.5 text-[9px] font-semibold tracking-wide", source === "kis-krx-websocket" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"),
							children: modeLabel
						})
					]
				}),
				indices.map((idx, i) => {
					const up = idx.changePct > 0;
					const color = idx.changePct === 0 ? "text-muted-foreground" : up ? colors.up : colors.down;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: cn("market-tape-item flex shrink-0 items-baseline gap-2", i > 0 && "border-l border-border"),
						title: `${idx.nameEn} · ${idx.source}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
								children: idx.nameKo
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-semibold tabular text-foreground",
								children: idx.value.toLocaleString("en-US", {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: cn("text-[11px] font-medium tabular", color),
								children: [
									up ? "+" : "",
									idx.change.toLocaleString("en-US", { maximumFractionDigits: 2 }),
									" ",
									"(",
									formatPct(idx.changePct),
									")"
								]
							})
						]
					}, idx.id);
				}),
				mounted && usRows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 items-baseline border-l border-border",
					"data-testid": "marketbar-us",
					title: "Yahoo Finance 지연 시세",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "market-tape-item text-[9px] font-semibold uppercase tracking-wide text-muted-foreground",
						children: "US · 지연"
					}), usRows.map((r) => {
						const up = (r.changePct ?? 0) > 0;
						const down = (r.changePct ?? 0) < 0;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "market-tape-item flex shrink-0 items-baseline gap-1.5",
							title: `${r.symbol} · ${r.source}${r.delayMinutes ? ` · 지연 ${r.delayMinutes}분` : " · 지연 시세"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-semibold text-muted-foreground",
									children: US_LABEL[r.id] ?? r.label
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-semibold tabular text-foreground",
									children: r.price != null ? r.price.toLocaleString("en-US", {
										maximumFractionDigits: 2,
										minimumFractionDigits: 2
									}) : "—"
								}),
								r.changePct != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("text-[11px] tabular", up ? colors.up : down ? colors.down : "text-muted-foreground"),
									children: formatPct(r.changePct)
								})
							]
						}, r.id);
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ml-auto shrink-0 px-3 py-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] text-muted-foreground whitespace-nowrap",
						children: DATA_LABEL
					})
				})
			]
		})
	});
}
function PriceChange({ change, changePct, size = "sm", showAmount = true, className }) {
	const colors = usePriceColors();
	const up = changePct > 0;
	const flat = changePct === 0;
	const color = flat ? "text-muted-foreground" : up ? colors.up : colors.down;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("inline-flex items-center gap-0.5 font-medium tabular", size === "xs" ? "text-[11px]" : size === "md" ? "text-sm" : "text-xs", color, className),
		children: [
			!flat && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Triangle, {
				className: cn("size-2 fill-current", !up && "rotate-180"),
				strokeWidth: 0
			}),
			showAmount && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatChange(change) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
				"(",
				formatPct(changePct),
				")"
			] })
		]
	});
}
function PriceValue({ value, changePct, size = "md", className }) {
	const colors = usePriceColors();
	const color = changePct === void 0 || changePct === 0 ? "text-foreground" : changePct > 0 ? colors.up : colors.down;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("font-semibold tabular tracking-tight", size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-base", color, className),
		children: new Intl.NumberFormat("ko-KR").format(value >= 100 ? Math.round(value) : value)
	});
}
var RECENT_KEY = "kx-search-recent-v1";
function loadRecent() {
	try {
		const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
		return Array.isArray(raw) ? raw.slice(0, 8) : [];
	} catch {
		return [];
	}
}
function pushRecent(hit) {
	const prev = loadRecent().filter((x) => x.code !== hit.code);
	localStorage.setItem(RECENT_KEY, JSON.stringify([hit, ...prev].slice(0, 8)));
}
function SearchCommand({ className }) {
	const [q, setQ] = (0, import_react.useState)("");
	const [debounced, setDebounced] = (0, import_react.useState)("");
	const [open, setOpen] = (0, import_react.useState)(false);
	const [hi, setHi] = (0, import_react.useState)(0);
	const wrapRef = (0, import_react.useRef)(null);
	const navigate = useNavigate();
	const { map } = useQuoteMap();
	(0, import_react.useEffect)(() => {
		const id = window.setTimeout(() => setDebounced(q.trim()), 180);
		return () => window.clearTimeout(id);
	}, [q]);
	const live = useSecuritySearch(debounced);
	const localStocks = (0, import_react.useMemo)(() => searchUniverse(q), [q]);
	const etfQ = useEtfMarket({
		bucket: "all",
		q: debounced.length >= 2 ? debounced : void 0,
		limit: 20,
		enabled: debounced.length >= 2
	});
	const stockHits = (0, import_react.useMemo)(() => {
		const by = /* @__PURE__ */ new Map();
		for (const s of localStocks) by.set(s.code, {
			code: s.code,
			nameKo: s.nameKo,
			nameEn: s.nameEn,
			market: s.market,
			sectorId: s.sectorId,
			isEtf: false,
			source: "universe"
		});
		for (const h of live.data?.hits ?? []) if (!h.isEtf) by.set(h.code, h);
		return [...by.values()];
	}, [localStocks, live.data?.hits]);
	const etfResults = (0, import_react.useMemo)(() => {
		const fromLive = (live.data?.hits ?? []).filter((h) => h.isEtf);
		const needle = q.trim();
		if (needle.length < 2) return fromLive;
		const extra = (etfQ.data?.etfs ?? []).filter((etf) => matchesSearchQuery(needle, [
			etf.nameKo,
			etf.code,
			etf.tabLabel,
			etf.issuer
		])).map((etf) => ({
			code: etf.code,
			nameKo: etf.nameKo,
			nameEn: etf.nameKo,
			market: "KOSPI",
			sectorId: "electronics",
			isEtf: true,
			source: "naver-autocomplete"
		}));
		const by = /* @__PURE__ */ new Map();
		for (const h of [...fromLive, ...extra]) by.set(h.code, h);
		return [...by.values()];
	}, [
		live.data?.hits,
		etfQ.data?.etfs,
		q
	]);
	const rows = (0, import_react.useMemo)(() => {
		return [...stockHits.map((hit) => ({
			kind: "stock",
			hit
		})), ...etfResults.map((hit) => ({
			kind: "etf",
			hit
		}))].slice(0, 20);
	}, [stockHits, etfResults]);
	(0, import_react.useEffect)(() => setHi(0), [q]);
	(0, import_react.useEffect)(() => {
		function onDoc(e) {
			if (!wrapRef.current?.contains(e.target)) setOpen(false);
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);
	(0, import_react.useEffect)(() => {
		function onKey(e) {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				wrapRef.current?.querySelector("input")?.focus();
				setOpen(true);
			}
			if (e.key === "Escape") setOpen(false);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	function go(hit) {
		const code = normalizeKrTicker(hit.code);
		const etf = shouldRouteToEtf(code, hit.nameKo, hit.isEtf);
		const routed = {
			...hit,
			code,
			isEtf: etf
		};
		pushRecent(routed);
		try {
			sessionStorage.setItem("kx-last-security", JSON.stringify(routed));
		} catch {}
		if (etf) navigate({
			to: "/etfs/$code",
			params: { code }
		});
		else navigate({
			to: "/stock/$ticker",
			params: { ticker: code }
		});
		setOpen(false);
		setQ("");
	}
	const fetching = live.isFetching || etfQ.isFetching;
	const empty = !fetching && q.trim().length > 0 && rows.length === 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: wrapRef,
		className: cn("relative w-full max-w-md", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => {
						setQ(e.target.value);
						setOpen(true);
					},
					onFocus: () => setOpen(true),
					onKeyDown: (e) => {
						if (!open) return;
						if (e.key === "ArrowDown") {
							e.preventDefault();
							setHi((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
						} else if (e.key === "ArrowUp") {
							e.preventDefault();
							setHi((i) => Math.max(i - 1, 0));
						} else if (e.key === "Enter" && rows[hi]) {
							e.preventDefault();
							go(rows[hi].hit);
						}
					},
					placeholder: "코스피·코스닥 전 종목 · ETF · 코드 (⌘K)",
					className: "h-10 pl-9 pr-8 bg-muted/40 border-border text-sm",
					"aria-label": "종목 검색",
					autoComplete: "off"
				}),
				q && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground",
					onClick: () => {
						setQ("");
						setOpen(false);
					},
					"aria-label": "검색 지우기",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
				})
			]
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-lg",
			children: !q.trim() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecentList, { onPick: go }) : empty ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-3 py-6 text-center text-xs text-muted-foreground",
				children: "검색 결과 없음"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "max-h-80 overflow-y-auto scroll-thin py-1",
				children: [fetching && rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin" }), " 전 종목 검색 중"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: rows.map((row, i) => {
					const quote = map.get(row.hit.code);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: cn("flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50", i === hi && "bg-muted/60"),
						onMouseEnter: () => setHi(i),
						onClick: () => go(row.hit),
						children: [
							row.kind === "etf" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "size-3.5 text-desk-gold shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-10 shrink-0 text-[10px] font-semibold text-muted-foreground",
								children: row.hit.market === "KOSDAQ" ? "코스닥" : "코스피"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-medium truncate",
									children: row.hit.nameKo
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[10px] text-muted-foreground",
									children: [row.hit.code, row.kind === "etf" ? " · ETF" : ""]
								})]
							}),
							quote && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-right shrink-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs font-semibold tabular",
									children: formatPrice(quote.price)
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceChange, {
									change: quote.change,
									changePct: quote.changePct,
									size: "sm"
								})]
							})
						]
					}) }, `${row.kind}-${row.hit.code}`);
				}) })]
			})
		})]
	});
}
function RecentList({ onPick }) {
	const recent = typeof window === "undefined" ? [] : loadRecent();
	if (!recent.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "px-3 py-4 text-[11px] text-muted-foreground",
		children: "코스피·코스닥 전 종목 검색. 종목명 또는 6자리 코드를 입력하세요."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "py-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
			children: "최근 검색"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: recent.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50",
			onClick: () => onPick(h),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[10px] text-muted-foreground w-10",
					children: h.isEtf ? "ETF" : h.market === "KOSDAQ" ? "코스닥" : "코스피"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate",
					children: h.nameKo
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-auto text-[10px] tabular text-muted-foreground",
					children: h.code
				})
			]
		}) }, h.code)) })]
	});
}
/** Mount once: runs the Live Wire engine (leader election + polling + notifications). */
function LiveWireRunner() {
	useLiveWireEngine();
	return null;
}
/** Header button with unread badge (F8.3). */
function LiveWireButton() {
	const unread = useWireStore((s) => s.unread);
	const setOpen = useWireStore((s) => s.setDrawerOpen);
	const label = unread > 0 ? `Live Wire — 새 항목 ${unread}건` : "Live Wire";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		variant: "ghost",
		size: "icon-sm",
		onClick: () => setOpen(true),
		"aria-label": label,
		title: label,
		className: "relative",
		"data-testid": "live-wire-button",
		children: [unread > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellRing, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-3.5" }), unread > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-price-up px-1 text-center text-[9px] font-bold leading-4 text-white tabular",
			"data-testid": "live-wire-badge",
			children: unread > 99 ? "99+" : unread
		})]
	});
}
function DesktopAlertsButton({ className }) {
	const osEnabled = useAppStore((s) => s.alertSettings.osEnabled);
	const [perm, setPerm] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => setPerm(notificationPermission()), []);
	if (perm == null) return null;
	if (perm === "unsupported") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("text-[10.5px] text-muted-foreground", className),
		children: "이 브라우저는 데스크톱 알림을 지원하지 않습니다."
	});
	if (osEnabled && perm === "granted") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("text-[10.5px] text-emerald-500", className),
		children: "데스크톱 알림 켜짐"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: async () => setPerm(await enableDesktopAlerts()),
		className: cn("inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted/50", className),
		"data-testid": "enable-desktop-alerts",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellRing, { className: "size-3" }), " 데스크톱 알림 켜기"]
	});
}
/** Right drawer: tabs, min tier + source filters, pause, FeedRow items (F8.3). */
function LiveWireDrawer() {
	const wire = useLiveWire();
	const paused = useAppStore((s) => s.alertSettings.paused);
	const setAlertSettings = useAppStore((s) => s.setAlertSettings);
	const watch = useWatchContext();
	const [tab, setTab] = (0, import_react.useState)("all");
	const [minTier, setMinTier] = (0, import_react.useState)("normal");
	const [sources, setSources] = (0, import_react.useState)([]);
	const facets = (0, import_react.useMemo)(() => sourceFacets(wire.items), [wire.items]);
	const visible = (0, import_react.useMemo)(() => wire.items.filter((it) => matchesWireTab(it, tab, watch) && meetsTier(it, minTier) && (!sources.length || sources.includes(it.sourceId) || (it.cluster?.members?.some((m) => sources.includes(m.sourceId)) ?? false))), [
		wire.items,
		tab,
		watch,
		minTier,
		sources
	]);
	const reason = wire.role === "starting" ? "연결 중…" : wire.errorCount > 0 && !wire.items.length ? `Live Wire 응답 실패 (${wire.lastError ?? "오류"}) — 재시도 대기 중입니다.` : wire.items.length && visible.length === 0 ? "현재 탭·필터에 맞는 항목이 없습니다." : wire.sources.length && wire.sources.every((s) => !s.ok) ? `소스 ${wire.sources.length}곳 모두 응답 없음(소스 미검증·네트워크 차단 등) — 채워 넣지 않습니다.` : "아직 수신한 항목이 없습니다.";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: wire.drawerOpen,
		onOpenChange: wire.setDrawerOpen,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
			side: "right",
			className: "flex w-full max-w-lg flex-col gap-0 overflow-hidden p-0",
			"data-testid": "live-wire-drawer",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
					className: "border-b border-border bg-card",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetTitle, {
						className: "flex items-center gap-2 pr-6 text-base",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellRing, { className: "size-4 text-price-up" }), " Live Wire"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5 text-[11px]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-x-2 gap-y-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["기준 ", wire.generatedAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
										publishedAt: wire.generatedAt,
										precision: "second"
									}) : "—"] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded border border-border px-1.5 py-0.5",
										children: wire.role === "leader" ? "이 탭이 수신 담당" : wire.role === "follower" ? "다른 탭에서 수신 공유" : "연결 중"
									}),
									paused && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-500",
										children: "일시정지"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceHealthChip, { sources: wire.sources })
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-1.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setAlertSettings({ paused: !paused }),
										"aria-pressed": paused,
										className: "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 font-semibold text-foreground hover:bg-muted/50",
										"data-testid": "live-wire-pause",
										children: [paused ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-3" }), paused ? "재개" : "일시정지"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DesktopAlertsButton, {}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/settings/alerts",
										onClick: () => wire.setDrawerOpen(false),
										className: "inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-semibold text-primary hover:underline",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings2, { className: "size-3" }), " 알림 설정"]
									})
								]
							})]
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2 border-b border-border p-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-6",
						role: "tablist",
						"aria-label": "Live Wire 탭",
						children: WIRE_TABS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							role: "tab",
							"aria-selected": tab === t.id,
							onClick: () => setTab(t.id),
							className: cn("min-h-9 rounded-md text-[11px] font-semibold", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"),
							children: t.label
						}, t.id))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: minTier,
							onChange: (e) => setMinTier(e.target.value),
							className: "h-9 rounded-md border border-border bg-background px-2 text-xs",
							"aria-label": "최소 중요도",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "normal",
									children: "중요도 전체"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "high",
									children: "HIGH 이상"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "flash",
									children: "FLASH만"
								})
							]
						}), facets.slice(0, 8).map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"aria-pressed": sources.includes(f.id),
							onClick: () => setSources((xs) => xs.includes(f.id) ? xs.filter((x) => x !== f.id) : [...xs, f.id]),
							className: cn("inline-flex min-h-9 items-center rounded-md border px-2 text-[10.5px]", sources.includes(f.id) ? "border-foreground/30 bg-foreground text-background" : "border-border text-muted-foreground"),
							children: [
								f.name,
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-1 opacity-60",
									children: f.count
								})
							]
						}, f.id))]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-h-0 flex-1 overflow-y-auto scroll-thin p-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartAlertsSection, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedList, {
						items: visible,
						emptyReason: reason,
						loading: wire.role === "starting",
						renderRow: (it) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedRow, {
							item: it,
							tierBar: true,
							labelFor: krTickerLabel,
							className: cn(wire.highlightId === it.id && "bg-amber-500/10 ring-1 ring-inset ring-amber-500/50")
						})
					})]
				})
			]
		})
	});
}
/** Optional desktop bottom ticker tape (F8.3; off by default). */
function TickerTape() {
	const on = useAppStore((s) => s.alertSettings.tickerTape);
	const items = useWireStore((s) => s.items);
	const top = (0, import_react.useMemo)(() => items.filter((it) => meetsTier(it, "high")).slice(0, 12), [items]);
	const openItem = useWireStore((s) => s.openItem);
	if (!on) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "hidden h-8 overflow-hidden border-t border-border bg-panel/95 text-[11px] backdrop-blur md:block",
		"data-testid": "ticker-tape",
		"aria-label": "Live Wire 티커",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `@keyframes ked-tape{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media (prefers-reduced-motion: reduce){.ked-tape{animation:none!important}}` }), top.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-8 items-center px-3 text-muted-foreground",
			children: "Live Wire: HIGH 이상 항목 없음 또는 수신 전"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "ked-tape flex h-8 w-max items-center gap-6 whitespace-nowrap px-3",
			style: { animation: `ked-tape ${Math.max(30, top.length * 8)}s linear infinite` },
			children: [...top, ...top].map((it, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => openItem(it.id),
				className: "inline-flex items-center gap-1.5 hover:underline",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 rounded-full", it.importance?.tier === "flash" ? "bg-price-up" : "bg-amber-500") }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
						publishedAt: it.publishedAt,
						precision: it.precision,
						className: "text-muted-foreground"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: it.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: it.outlet ?? it.sourceName
					})
				]
			}, `${it.id}-${i}`))
		})]
	});
}
/** Chart alerts (F7.11) listed and managed in the Live Wire drawer. */
function ChartAlertsSection() {
	const alerts = useAppStore((s) => s.alertSettings.priceAlerts);
	const remove = useAppStore((s) => s.removePriceAlert);
	if (!alerts.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
		className: "mb-2 rounded-lg border border-border bg-muted/15 p-2 text-[11px]",
		"data-testid": "wire-chart-alerts",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
			className: "cursor-pointer font-semibold",
			children: [
				"차트 알림 ",
				alerts.filter((a) => a.active).length,
				"/",
				alerts.length
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-1.5 space-y-1",
			children: alerts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: a.market === "KR" ? "/stock/$ticker" : "/us/$symbol",
						params: a.market === "KR" ? { ticker: a.code } : { symbol: a.code },
						className: "min-w-0 flex-1 truncate hover:underline",
						children: [
							a.name ?? a.code,
							" · ",
							a.kind === "price-cross" ? `가격 ${a.level?.toLocaleString("ko-KR")}` : a.kind === "rsi-cross" ? `RSI ${a.level}` : `이평 ${a.fast}/${a.slow}`,
							" · ",
							a.active ? "대기" : "완료"
						]
					}),
					a.lastFiredAt && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
						publishedAt: a.lastFiredAt,
						precision: "second",
						className: "text-muted-foreground"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => remove(a.id),
						className: "inline-flex size-9 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground",
						"aria-label": "알림 삭제",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
					})
				]
			}, a.id))
		})]
	});
}
/**
* Lightweight Charts attribution (F7.3 / D4).
*
* Apache-2.0 requires the NOTICE attribution plus a link to
* https://www.tradingview.com/ on a page users can see. The chart option
* `attributionLogo: false` is allowed ONLY because the app renders
* `CHART_ATTRIBUTION_LABEL` → `CHART_ATTRIBUTION_URL` in the global footer
* (AppShell) and in every chart status line. Covered by
* scripts/project-invariants.test.mjs.
*/
/** Verbatim NOTICE of tradingview/lightweight-charts v5.2.1. */
var LIGHTWEIGHT_CHARTS_NOTICE = "TradingView Lightweight Charts™\nCopyright (с) 2025 TradingView, Inc. https://www.tradingview.com/";
var CHART_ATTRIBUTION_URL = "https://www.tradingview.com/";
var CHART_ATTRIBUTION_LABEL = "Charts: TradingView Lightweight Charts™";
var TooltipProvider = Provider;
var Tooltip = Root3;
var TooltipTrigger = Trigger;
function TooltipContent({ className, sideOffset = 4, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
		sideOffset,
		className: cn("z-50 overflow-hidden rounded-md bg-primary px-2.5 py-1.5 text-xs text-primary-foreground shadow-md animate-in fade-in-0 zoom-in-95", className),
		...props
	}) });
}
function AppShell({ children }) {
	const theme = useAppStore((s) => s.theme);
	const toggleTheme = useAppStore((s) => s.toggleTheme);
	const colorConvention = useAppStore((s) => s.colorConvention);
	const setColorConvention = useAppStore((s) => s.setColorConvention);
	const sidebarOpen = useAppStore((s) => s.sidebarOpen);
	const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
	(0, import_react.useEffect)(() => {
		const root = document.documentElement;
		if (theme === "dark") root.classList.add("dark");
		else root.classList.remove("dark");
	}, [theme]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipProvider, {
		delayDuration: 300,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "app-shell bg-background text-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "app-shell-banner shrink-0",
					style: { height: "var(--grok-banner-h, 0px)" }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "app-shell-top shell-header z-40",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 h-12 px-3 md:grid-cols-[15rem_minmax(0,1fr)_auto] md:px-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										size: "icon-sm",
										className: "md:hidden",
										onClick: () => setSidebarOpen(true),
										"aria-label": "메뉴 열기",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-4" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/",
										className: "md:hidden flex items-center gap-2 font-semibold text-sm tracking-tight",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-desk-gold to-amber-700 text-[11px] font-bold text-black shadow-sm",
											children: "KX"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "leading-tight",
											children: ["Equity", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "block text-[9px] font-medium text-muted-foreground tracking-wider uppercase",
												children: "Command"
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "hidden md:block" })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchCommand, { className: "min-w-0 max-w-xl mx-auto w-full" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-end gap-0.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveWireButton, {}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tooltip, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipTrigger, {
										asChild: true,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "ghost",
											size: "icon-sm",
											onClick: () => setColorConvention(colorConvention === "korea" ? "global" : "korea"),
											"aria-label": "등락 색상 전환",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, { className: "size-3.5" })
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipContent, { children: colorConvention === "korea" ? "한국식 (빨강↑ 파랑↓) → 글로벌" : "글로벌 (초록↑ 빨강↓) → 한국식" })] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tooltip, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipTrigger, {
										asChild: true,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "ghost",
											size: "icon-sm",
											onClick: toggleTheme,
											"aria-label": "테마 전환",
											children: theme === "dark" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-3.5" })
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipContent, { children: theme === "dark" ? "라이트 모드" : "다크 모드" })] })
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarketBar, {})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "app-shell-body",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sidebar, { className: "hidden md:flex min-h-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
						className: "app-shell-main scroll-thin bg-background",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "app-shell-content desk-page mx-auto w-full max-w-[1440px] px-4 py-5 md:px-7 md:py-7",
								children
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
								className: "border-t border-border bg-panel/90 px-4 py-3 md:px-7",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mx-auto max-w-[1440px] text-[11px] leading-relaxed text-muted-foreground",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-desk-gold",
										children: "면책 · "
									}), "Korea Equity Command Center는 정보·리서치 워크플로 도구이며 투자 자문·매매 권유·주문 실행 서비스가 아닙니다. 시세·차트·수급·리포트는 제3자 경로(KIS/KRX·네이버·Yahoo·DART 등)에 의존하며 지연·누락·오류가 있을 수 있습니다. 투자 결정과 손실 책임은 이용자 본인에게 있습니다. 실주문 전 증권사 HTS/MTS에서 호가·잔량·VI·공시를 재확인하세요."]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mx-auto mt-1.5 max-w-[1440px] text-[11px] leading-relaxed text-muted-foreground",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
											href: CHART_ATTRIBUTION_URL,
											target: "_blank",
											rel: "noopener noreferrer",
											className: "font-medium text-foreground/80 underline-offset-2 hover:underline",
											"data-testid": "chart-attribution",
											title: LIGHTWEIGHT_CHARTS_NOTICE,
											children: CHART_ATTRIBUTION_LABEL
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "whitespace-pre-line",
											children: [" · ", LIGHTWEIGHT_CHARTS_NOTICE.replace("\n", " · ")]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: " · " }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
											to: "/status/sources",
											className: "underline-offset-2 hover:underline",
											children: "소스 상태"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "sticky bottom-0 z-30",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TickerTape, {})
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveWireRunner, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveWireDrawer, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
					theme,
					position: "bottom-right",
					closeButton: true,
					toastOptions: { className: "text-sm" }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
					open: sidebarOpen,
					onOpenChange: setSidebarOpen,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
						side: "left",
						className: "w-72 p-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetHeader, {
							className: "sr-only",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: "메뉴" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sidebar, {
							className: "w-full border-0",
							onNavigate: () => setSidebarOpen(false)
						})]
					})
				})
			]
		})
	});
}
var styles_default = "/assets/styles-D0XVHtGx.css";
var APP_NAME = "Korea Equity Command Center";
var Route$26 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "한국 주식 산업별 실시간 시세 · 공시 · 뉴스 · 증권사 리포트 커맨드 센터"
			},
			{
				name: "apple-mobile-web-app-title",
				content: APP_NAME
			},
			{
				name: "theme-color",
				content: "#060a12"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "stylesheet",
				href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap"
			}
		]
	}),
	component: RootComponent
});
function RootComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "ko",
		className: "dark",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreatedWithGrokBanner, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	});
}
var $$splitComponentImporter$21 = () => import("./routes-Tpsz0l8m.mjs");
var Route$25 = createFileRoute("/")({
	component: lazyRouteComponent($$splitComponentImporter$21, "component"),
	head: () => ({ meta: [{ title: "대시보드 · Korea Equity Command Center" }] })
});
var $$splitComponentImporter$20 = () => import("./chart-C9299Tv_.mjs");
var Route$24 = createFileRoute("/chart")({
	component: lazyRouteComponent($$splitComponentImporter$20, "component"),
	validateSearch: (s) => ({
		symbols: typeof s.symbols === "string" ? s.symbols.slice(0, 80) : void 0,
		layout: s.layout === "2" || s.layout === "4" || s.layout === "1" ? s.layout : s.layout === 2 || s.layout === 4 || s.layout === 1 ? String(s.layout) : void 0
	}),
	head: () => ({ meta: [{ title: "차트 워크스페이스 · Korea Equity Command Center" }] })
});
/** `/chart` workspace (F7.9): 1-, 2- or 4-chart layout, synced crosshair, optional synced interval. */
var $$splitComponentImporter$19 = () => import("./disclosures-DgW8Tk3Z.mjs");
var Route$23 = createFileRoute("/disclosures")({
	component: lazyRouteComponent($$splitComponentImporter$19, "component"),
	head: () => ({ meta: [{ title: "KRX 공시 데스크 · Korea Equity Command Center" }] })
});
var $$splitComponentImporter$18 = () => import("./etfs-BLEOHP_a.mjs");
var Route$22 = createFileRoute("/etfs")({ component: lazyRouteComponent($$splitComponentImporter$18, "component") });
var $$splitComponentImporter$17 = () => import("./export-desk-CHTuGUbr.mjs");
var Route$21 = createFileRoute("/export-desk")({
	component: lazyRouteComponent($$splitComponentImporter$17, "component"),
	head: () => ({ meta: [{ title: "Export × KOSPI · Korea Equity Command Center" }] })
});
var $$splitComponentImporter$16 = () => import("./research-Jwf9NW_1.mjs");
var TABS$1 = [
	"all",
	"company",
	"industry",
	"invest",
	"economy",
	"debenture",
	"market"
];
var Route$20 = createFileRoute("/research")({
	component: lazyRouteComponent($$splitComponentImporter$16, "component"),
	validateSearch: (s) => {
		const market = s.market === "us" || s.market === "kr" ? s.market : void 0;
		const sector = typeof s.sector === "string" ? s.sector : void 0;
		const raw = s.tab === "featured" ? "company" : s.tab;
		return {
			tab: TABS$1.includes(raw) ? raw : void 0,
			sector,
			market
		};
	},
	head: () => ({ meta: [{ title: "리서치 데스크 · Korea Equity Command Center" }] })
});
var TABS = [
	{
		id: "overview",
		label: "개요"
	},
	{
		id: "market",
		label: "시장 동향"
	},
	{
		id: "policy",
		label: "정책"
	},
	{
		id: "companies",
		label: "기업"
	},
	{
		id: "research",
		label: "리서치"
	},
	{
		id: "etf",
		label: "ETF"
	}
];
var $$splitComponentImporter$15 = () => import("./robotics-C7wPKZ4n.mjs");
var Route$19 = createFileRoute("/robotics")({
	component: lazyRouteComponent($$splitComponentImporter$15, "component"),
	validateSearch: (s) => ({ tab: TABS.some((t) => t.id === s.tab) ? s.tab : void 0 }),
	head: () => ({ meta: [{ title: "로봇 섹션 · Korea Equity Command Center" }] })
});
/** The overview's on-screen previews (market 5 + policy 5 + research 5) → optional AI input, newest first. */
var $$splitComponentImporter$14 = () => import("./us-link-BEY7K2Fe.mjs");
var Route$18 = createFileRoute("/us-link")({
	component: lazyRouteComponent($$splitComponentImporter$14, "component"),
	head: () => ({ meta: [{ title: "미국 연계 · 미중 AI 패권 전쟁 · Korea Equity" }] })
});
var $$splitComponentImporter$13 = () => import("./us-research-DXbQrPFI.mjs");
var Route$17 = createFileRoute("/us-research")({ component: lazyRouteComponent($$splitComponentImporter$13, "component") });
var $$splitComponentImporter$12 = () => import("./watchlist-CoGjvC1l.mjs");
var Route$16 = createFileRoute("/watchlist")({
	component: lazyRouteComponent($$splitComponentImporter$12, "component"),
	head: () => ({ meta: [{ title: "관심종목 · Korea Equity Command Center" }] })
});
/**
* Feed aggregation (B0.7 / F8.1): fan out to registry sources under an 8 s
* budget, then merge → cluster → score → sort newest first → page.
*/
var FEED_SOURCES = {
	KR: [
		"naver-flash",
		"naver-main",
		"naver-focus-401",
		"naver-focus-402",
		"naver-focus-404",
		"naver-focus-406",
		"naver-focus-429",
		"hankyung-finance",
		"hankyung-economy",
		"yonhap-market",
		"yonhap-economy",
		"mk-rss",
		"gn-kr-market",
		"krx-disclosures",
		"kis-news-title"
	],
	US: [
		"bloomberg-markets",
		"bloomberg-economics",
		"bloomberg-technology",
		"bloomberg-politics",
		"bloomberg-wealth",
		"gn-bloomberg",
		"naver-worldnews",
		"naver-focus-403",
		"fed-press",
		"sec-8k-atom",
		"finviz-ratings",
		"cnbc-rss",
		"marketwatch-rss",
		"yahoo-finance-rss",
		"gn-us-market",
		"finnhub-news"
	],
	GLOBAL: []
};
FEED_SOURCES.GLOBAL = [
	...FEED_SOURCES.KR,
	...FEED_SOURCES.US,
	"hankyung-international"
];
/** Theme pages (F5 / F6.3 / F6.4): fixed source sets + server-side post-processing. */
var FEED_GROUPS = [
	"etf",
	"robotics-market",
	"robotics-policy"
];
var GROUP_SOURCES = {
	etf: [
		"gn-etf-kr",
		"gn-etf-brands",
		"hankyung-finance",
		"naver-news-search-etf"
	],
	"robotics-market": [
		"robot-report",
		"irobotnews",
		"ieee-spectrum-robotics",
		"gn-robotics-kr",
		"gn-robotics-en",
		"hankyung-it"
	],
	"robotics-policy": [
		"federal-register",
		"gn-robot-policy-kr",
		"gn-robot-policy-en",
		"irobotnews"
	]
};
/** Sources whose every item is on-theme (others are keyword-filtered). */
var ROBOT_NATIVE = /* @__PURE__ */ new Set([
	"robot-report",
	"irobotnews",
	"ieee-spectrum-robotics",
	"gn-robotics-kr",
	"gn-robotics-en"
]);
async function liveEtfList() {
	try {
		const { fetchAllEtfs } = await import("./etf-market-S8CEBu8d.mjs");
		return await Promise.race([fetchAllEtfs(), new Promise((resolve) => setTimeout(() => resolve([]), 4e3))]);
	} catch {
		return [];
	}
}
function addTopics(it, extra) {
	if (!extra.length) return it;
	return {
		...it,
		topics: [.../* @__PURE__ */ new Set([...it.topics, ...extra])]
	};
}
/** Keep on-theme items and stamp theme topics (ETF match / robot topics / status chips). */
async function postProcessGroup(group, items) {
	if (group === "etf") {
		const etfs = await liveEtfList();
		return items.map((it) => enrichEtfStory(it, etfs)).filter((x) => x != null);
	}
	const text = (it) => `${it.title} ${it.snippet ?? ""}`;
	if (group === "robotics-market") return items.filter((it) => ROBOT_NATIVE.has(it.sourceId) || isRoboticsText(text(it))).map((it) => addTopics(it, [
		"robotics",
		...robotTopicIds(text(it)),
		...isRobotPolicyText(text(it)) ? ["policy"] : []
	]));
	return items.filter((it) => it.sourceId !== "irobotnews" || isRobotPolicyText(text(it))).map((it) => addTopics(it, [
		"policy",
		"robotics",
		...it.topics.some((t) => t.startsWith("status:")) ? [] : policyStatusTopicIds(`${text(it)} ${it.outlet ?? ""}`)
	]));
}
/**
* Live Wire (F8.1): the high-frequency subset. Fetch-cache TTL = registry
* pollSec (flash/main 30 s, Hankyung 60 s, Fed/SEC 120 s, GN 120 s,
* Bloomberg 300 s).
*/
var WIRE_SOURCES = {
	KR: [
		"naver-flash",
		"naver-main",
		"hankyung-finance",
		"hankyung-economy",
		"gn-kr-market"
	],
	US: [
		"bloomberg-markets",
		"bloomberg-economics",
		"bloomberg-technology",
		"bloomberg-politics",
		"bloomberg-wealth",
		"gn-bloomberg",
		"fed-press",
		"sec-8k-atom",
		"gn-us-market"
	]
};
/** Wire items carry `etf` / `robotics` topics so the drawer tabs can filter them. */
function tagWireThemes(items) {
	return items.map((it) => {
		const text = `${it.title} ${it.snippet ?? ""}`;
		const extra = [];
		if (isEtfStory(it.title)) extra.push("etf");
		if (isRoboticsText(text)) extra.push("robotics");
		return addTopics(it, extra);
	});
}
var KIND_BY_ID = new Map(SOURCE_REGISTRY.map((s) => [s.id, s.kind]));
function sourceIdsFor(q) {
	if (q.wire) return [...new Set(q.regions.flatMap((r) => r === "GLOBAL" ? [...WIRE_SOURCES.KR, ...WIRE_SOURCES.US] : WIRE_SOURCES[r]))];
	const ids = new Set(q.group ? GROUP_SOURCES[q.group] : q.sourceIds ?? []);
	if (!q.group && !q.sourceIds?.length) for (const r of q.regions) for (const id of FEED_SOURCES[r]) ids.add(id);
	const kinds = new Set(q.kinds ?? []);
	return [...ids].filter((id) => !kinds.size || kinds.has(KIND_BY_ID.get(id) ?? "news"));
}
function sourceResults(results) {
	return results.map((r) => ({
		id: r.id,
		ok: r.state === "ok" || r.state === "empty",
		count: r.items.length,
		state: r.state === "no-adapter" ? "error" : r.state
	}));
}
var aggCache = /* @__PURE__ */ new Map();
var AGG_TTL_MS = 15e3;
/** Merge + cluster + score + sort (full list, newest first). */
async function collectFeed(q) {
	const ids = sourceIdsFor(q).sort();
	const key = `${q.wire ? "wire" : q.group ?? ""}|${ids.join(",")}`;
	const hit = aggCache.get(key);
	const now = q.now ?? Date.now();
	if (hit && now - hit.at < AGG_TTL_MS) return hit;
	const { results, partial } = await runSources(ids, {
		budgetMs: q.budgetMs ?? 7500,
		perSourceMs: 7e3,
		now
	});
	const raw = results.flatMap((r) => r.items);
	const clustered = clusterItems(q.group ? await postProcessGroup(q.group, raw) : q.wire ? tagWireThemes(raw) : raw).map((it) => ({
		...it,
		importance: scoreImportance(it, { now })
	}));
	const out = {
		at: now,
		items: sortNewestFirst(clustered),
		sources: sourceResults(results),
		partial,
		generatedAt: new Date(now).toISOString()
	};
	aggCache.set(key, out);
	if (aggCache.size > 40) aggCache.delete(aggCache.keys().next().value);
	return out;
}
async function aggregateFeed(q) {
	const all = await collectFeed(q);
	const topics = new Set(q.topics ?? []);
	const tickers = new Set((q.tickers ?? []).map((t) => t.toUpperCase()));
	const filtered = all.items.filter((it) => {
		if (topics.size && !it.topics.some((t) => topics.has(t))) return false;
		if (tickers.size && !it.tickers.some((t) => tickers.has(t.code.toUpperCase()) || tickers.has(`${t.market}:${t.code}`.toUpperCase()))) return false;
		return true;
	});
	const page = pageAfterCursor(filtered, q.cursor ?? null, Math.min(Math.max(q.limit ?? 50, 1), 200));
	return {
		items: page.items,
		nextCursor: page.nextCursor,
		partial: all.partial,
		sources: all.sources,
		generatedAt: all.generatedAt
	};
}
var QuerySchema$1 = object({
	region: _enum([
		"KR",
		"US",
		"GLOBAL"
	]).default("KR"),
	group: _enum(FEED_GROUPS).optional(),
	kinds: string().max(120).optional().transform((v) => v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []).pipe(array(_enum([
		"news",
		"research",
		"disclosure",
		"filing",
		"policy",
		"rating",
		"briefing"
	])).max(7)),
	topics: string().max(200).optional().transform((v) => v ? v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12) : []),
	tickers: string().max(300).optional().transform((v) => v ? v.split(",").map((x) => x.trim().toUpperCase()).filter((x) => /^(KR:|US:)?[0-9A-Z.]{1,10}$/.test(x)).slice(0, 40) : []),
	cursor: string().max(400).optional(),
	limit: number$1().int().min(1).max(200).default(50)
});
/**
* GET /api/feed — aggregated, clustered, scored, newest-first feed (B0.7).
* CDN-cacheable; 8 s budget with `partial: true` when a source is missing.
*/
var Route$15 = createFileRoute("/api/feed")({ server: { handlers: { GET: async ({ request }) => {
	const url = new URL(request.url);
	const parsed = QuerySchema$1.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) return Response.json({
		error: "bad_request",
		issues: parsed.error.issues.slice(0, 5)
	}, { status: 400 });
	const q = parsed.data;
	const page = await aggregateFeed({
		regions: [q.region],
		group: q.group,
		kinds: q.kinds,
		topics: q.topics,
		tickers: q.tickers,
		cursor: q.cursor ?? null,
		limit: q.limit
	});
	return Response.json(page, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
} } } });
var APPROVAL_URL = process.env.KIS_APPROVAL_URL ?? "https://openapi.koreainvestment.com:9443/oauth2/approval";
var WS_URL = process.env.KIS_WS_URL ?? "ws://ops.koreainvestment.com:21000";
var TR_ID = "H0STCNT0";
var APPROVAL_TTL_MS = 432e5;
function n(v) {
	const out = Number(String(v ?? "").replace(/,/g, ""));
	return Number.isFinite(out) ? out : 0;
}
function enabled() {
	return Boolean(process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET);
}
var approvalCache = null;
async function getApprovalKey() {
	if (!enabled()) throw new Error("KIS credentials are not configured");
	if (approvalCache && Date.now() - approvalCache.at < APPROVAL_TTL_MS) return approvalCache.key;
	const res = await fetch(APPROVAL_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			grant_type: "client_credentials",
			appkey: process.env.KIS_APP_KEY,
			secretkey: process.env.KIS_APP_SECRET
		})
	});
	if (!res.ok) throw new Error(`KIS approval HTTP ${res.status}`);
	const json = await res.json();
	if (!json.approval_key) throw new Error("KIS approval_key missing");
	approvalCache = {
		key: json.approval_key,
		at: Date.now()
	};
	return json.approval_key;
}
function parseTradePayload(payload) {
	const f = payload.split("^");
	if (f.length < 46) return null;
	const code = f[0]?.trim();
	if (!code || !/^\d{6}$/.test(code)) return null;
	const signCode = f[3] ?? "3";
	const direction = signCode === "4" || signCode === "5" ? -1 : signCode === "3" ? 0 : 1;
	const change = direction * Math.abs(n(f[4]));
	const changePct = direction * Math.abs(n(f[5]));
	return {
		code,
		tradeTime: f[1] ?? "",
		price: n(f[2]),
		change,
		changePct,
		open: n(f[7]),
		high: n(f[8]),
		low: n(f[9]),
		ask: n(f[10]),
		bid: n(f[11]),
		tradeVolume: n(f[12]),
		accumulatedVolume: n(f[13]),
		accumulatedValue: n(f[14]),
		tradeStrength: n(f[18]),
		businessDate: f[33] ?? "",
		marketControlCode: f[44] ?? "",
		source: "kis-krx-websocket",
		receivedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
var KisRealtimeHub = class {
	socket = null;
	listeners = /* @__PURE__ */ new Map();
	statusListeners = /* @__PURE__ */ new Set();
	approvalKey = null;
	connectPromise = null;
	reconnectTimer = null;
	reconnectAttempt = 0;
	getStatus() {
		return {
			enabled: enabled(),
			connected: this.socket?.readyState === wrapper_default.OPEN,
			provider: "kis",
			source: "kis-krx-websocket",
			message: enabled() ? void 0 : "KIS_APP_KEY / KIS_APP_SECRET 미설정 — 스냅샷 모드"
		};
	}
	onStatus(listener) {
		this.statusListeners.add(listener);
		listener(this.getStatus());
		return () => {
			this.statusListeners.delete(listener);
		};
	}
	async subscribe(code, listener) {
		if (!/^\d{6}$/.test(code)) throw new Error("Invalid KRX code");
		const set = this.listeners.get(code) ?? /* @__PURE__ */ new Set();
		const first = set.size === 0;
		set.add(listener);
		this.listeners.set(code, set);
		if (enabled()) {
			const wasOpen = this.socket?.readyState === wrapper_default.OPEN;
			await this.ensureConnected();
			if (first && wasOpen) this.sendSubscription(code, "1");
		}
		return () => {
			const current = this.listeners.get(code);
			if (!current) return;
			current.delete(listener);
			if (current.size === 0) {
				this.listeners.delete(code);
				this.sendSubscription(code, "0");
			}
		};
	}
	emitStatus(message) {
		const status = {
			...this.getStatus(),
			message: message ?? this.getStatus().message
		};
		for (const listener of this.statusListeners) listener(status);
	}
	async ensureConnected() {
		if (!enabled()) return;
		if (this.socket?.readyState === wrapper_default.OPEN) return;
		if (this.connectPromise) return this.connectPromise;
		this.connectPromise = (async () => {
			this.approvalKey = await getApprovalKey();
			await new Promise((resolve, reject) => {
				const ws = new wrapper_default(WS_URL);
				this.socket = ws;
				const timeout = setTimeout(() => reject(/* @__PURE__ */ new Error("KIS WebSocket connect timeout")), 1e4);
				ws.once("open", () => {
					clearTimeout(timeout);
					this.reconnectAttempt = 0;
					this.emitStatus("KRX 실시간 연결");
					for (const code of this.listeners.keys()) this.sendSubscription(code, "1");
					resolve();
				});
				ws.once("error", () => {
					clearTimeout(timeout);
					this.emitStatus("KIS WebSocket 오류");
					reject(/* @__PURE__ */ new Error("KIS WebSocket error"));
				});
				ws.on("close", () => {
					clearTimeout(timeout);
					this.socket = null;
					this.connectPromise = null;
					this.emitStatus("KIS 연결 끊김 — 재연결 대기");
					this.scheduleReconnect();
				});
				ws.on("message", (data) => {
					const text = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : Buffer.from(data).toString("utf8");
					this.handleMessage(text);
				});
			});
		})().finally(() => {
			this.connectPromise = null;
		});
		return this.connectPromise;
	}
	scheduleReconnect() {
		if (!enabled() || this.listeners.size === 0 || this.reconnectTimer) return;
		const delay = Math.min(3e4, 1e3 * 2 ** this.reconnectAttempt++);
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.ensureConnected().catch(() => this.scheduleReconnect());
		}, delay);
	}
	sendSubscription(code, trType) {
		if (!this.approvalKey || this.socket?.readyState !== wrapper_default.OPEN) return;
		this.socket.send(JSON.stringify({
			header: {
				approval_key: this.approvalKey,
				custtype: "P",
				tr_type: trType,
				"content-type": "utf-8"
			},
			body: { input: {
				tr_id: TR_ID,
				tr_key: code
			} }
		}));
	}
	handleMessage(raw) {
		if (!raw) return;
		if (raw.startsWith("0|") || raw.startsWith("1|")) {
			const parts = raw.split("|");
			if (parts[1] !== TR_ID) return;
			const trade = parseTradePayload(parts[3] ?? "");
			if (!trade) return;
			for (const listener of this.listeners.get(trade.code) ?? []) listener(trade);
			return;
		}
		try {
			const msg = JSON.parse(raw);
			if (msg.header?.tr_id === "PINGPONG") {
				if (this.socket?.readyState === wrapper_default.OPEN) this.socket.pong(raw);
				return;
			}
			if (msg.body?.rt_cd === "1" && !String(msg.body.msg1 ?? "").includes("ALREADY IN SUBSCRIBE")) this.emitStatus(msg.body.msg1 ?? "KIS subscription error");
		} catch {}
	}
};
var kisRealtimeHub = new KisRealtimeHub();
var encoder = new TextEncoder();
function sse(event, data) {
	return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
/** F8.6: close well inside the serverless limit; EventSource reconnects after `retry`. */
var MAX_STREAM_MS = 24e4;
var RETRY_MS = 3e3;
var Route$14 = createFileRoute("/api/market-stream")({ server: { handlers: { GET: async ({ request }) => {
	const url = new URL(request.url);
	const codes = [...new Set((url.searchParams.get("codes") ?? "").split(",").map((x) => normalizeKrTicker(x)).filter((x) => isDigitTicker(x)))].slice(0, 40);
	if (!codes.length) return Response.json({ error: "codes_required" }, { status: 400 });
	const maxParam = Number(url.searchParams.get("maxMs"));
	const lifetimeMs = Number.isFinite(maxParam) && maxParam > 0 ? Math.min(Math.max(maxParam, 5e3), MAX_STREAM_MS) : MAX_STREAM_MS;
	const cleanup = [];
	let heartbeat = null;
	let lifetime = null;
	const stop = () => {
		if (heartbeat) clearInterval(heartbeat);
		if (lifetime) clearTimeout(lifetime);
		heartbeat = null;
		lifetime = null;
		for (const off of cleanup.splice(0)) off();
	};
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(`retry: ${RETRY_MS}\n\n`));
			controller.enqueue(sse("status", kisRealtimeHub.getStatus()));
			const offStatus = kisRealtimeHub.onStatus((status) => {
				try {
					controller.enqueue(sse("status", status));
				} catch {}
			});
			cleanup.push(offStatus);
			Promise.all(codes.map((code) => kisRealtimeHub.subscribe(code, (trade) => {
				try {
					controller.enqueue(sse("trade", trade));
				} catch {}
			}))).then((offs) => cleanup.push(...offs)).catch((error) => {
				try {
					controller.enqueue(sse("status", {
						...kisRealtimeHub.getStatus(),
						connected: false,
						message: error instanceof Error ? error.message : "KIS stream error"
					}));
				} catch {}
			});
			heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": heartbeat\n\n"));
				} catch {}
			}, 15e3);
			lifetime = setTimeout(() => {
				try {
					controller.enqueue(sse("reconnect", {
						afterMs: RETRY_MS,
						reason: "lifetime"
					}));
				} catch {}
				stop();
				try {
					controller.close();
				} catch {}
			}, lifetimeMs);
			request.signal.addEventListener("abort", () => {
				stop();
				try {
					controller.close();
				} catch {}
			}, { once: true });
		},
		cancel() {
			stop();
		}
	});
	return new Response(stream, { headers: {
		"content-type": "text/event-stream; charset=utf-8",
		"cache-control": "no-cache, no-transform",
		connection: "keep-alive",
		"x-accel-buffering": "no"
	} });
} } } });
var QuerySchema = object({ regions: string().max(20).optional().transform((v) => {
	const list = [...new Set((v ?? "KR,US").split(",").map((x) => x.trim().toUpperCase()))].filter((x) => x === "KR" || x === "US");
	return (list.length ? list : ["KR", "US"]).sort();
}) });
/**
* GET /api/wire?regions=KR,US — Live Wire (F8.1). No cursor so the response
* stays CDN-cacheable: the newest 100 clustered + scored items for the
* canonical (sorted) region set. Clients diff against what they have seen.
*/
var Route$13 = createFileRoute("/api/wire")({ server: { handlers: { GET: async ({ request }) => {
	const url = new URL(request.url);
	const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) return Response.json({
		error: "bad_request",
		issues: parsed.error.issues.slice(0, 5)
	}, { status: 400 });
	const regions = parsed.data.regions;
	const all = await collectFeed({
		regions,
		wire: true,
		budgetMs: 7500
	});
	const body = {
		items: all.items.slice(0, 100),
		nextCursor: null,
		partial: all.partial,
		sources: all.sources,
		generatedAt: all.generatedAt,
		regions: regions.join(",")
	};
	return Response.json(body, { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" } });
} } } });
var $$splitComponentImporter$11 = () => import("./etfs.index-DgQCnS30.mjs");
var Route$12 = createFileRoute("/etfs/")({
	component: lazyRouteComponent($$splitComponentImporter$11, "component"),
	head: () => ({ meta: [{ title: "ETF 데스크 · Korea Equity Command Center" }] })
});
var $$splitComponentImporter$10 = () => import("./etfs._code-D1uYhIYl.mjs");
var Route$11 = createFileRoute("/etfs/$code")({
	component: lazyRouteComponent($$splitComponentImporter$10, "component"),
	head: ({ params }) => ({ meta: [{ title: `${params.code} · ETF · Korea Equity` }] })
});
var $$splitComponentImporter$9 = () => import("./industry._sectorId-D926aCIP.mjs");
var Route$10 = createFileRoute("/industry/$sectorId")({
	component: lazyRouteComponent($$splitComponentImporter$9, "component"),
	head: ({ params }) => {
		const s = SECTOR_BY_ID[params.sectorId];
		return { meta: [{ title: s ? `${s.nameKo} · Korea Equity Command Center` : "산업 · Korea Equity" }] };
	}
});
/** `/news` → `/news/kr` (F10.1). */
var Route$9 = createFileRoute("/news/")({ beforeLoad: () => {
	throw redirect({
		to: "/news/kr",
		replace: true
	});
} });
var $$splitComponentImporter$8 = () => import("./news.etf-CipmcBp6.mjs");
var Route$8 = createFileRoute("/news/etf")({
	component: lazyRouteComponent($$splitComponentImporter$8, "component"),
	head: () => ({ meta: [{ title: "ETF 뉴스 브리핑 · Korea Equity Command Center" }] })
});
var $$splitComponentImporter$7 = () => import("./news.kr-HzwbqsBM.mjs");
var Route$7 = createFileRoute("/news/kr")({
	component: lazyRouteComponent($$splitComponentImporter$7, "component"),
	head: () => ({ meta: [{ title: "한국 뉴스 브리핑 · Korea Equity Command Center" }] })
});
var $$splitComponentImporter$6 = () => import("./news.us-BmiKbUvB.mjs");
var Route$6 = createFileRoute("/news/us")({
	component: lazyRouteComponent($$splitComponentImporter$6, "component"),
	head: () => ({ meta: [{ title: "미국 뉴스 브리핑 · Korea Equity Command Center" }] })
});
var $$splitComponentImporter$5 = () => import("./settings.alerts-BOrmt7DD.mjs");
var Route$5 = createFileRoute("/settings/alerts")({
	component: lazyRouteComponent($$splitComponentImporter$5, "component"),
	head: () => ({ meta: [{ title: "알림 설정 · Korea Equity Command Center" }] })
});
var $$splitComponentImporter$4 = () => import("./status.sources-Q2ITNIWT.mjs");
var Route$4 = createFileRoute("/status/sources")({
	component: lazyRouteComponent($$splitComponentImporter$4, "component"),
	head: () => ({ meta: [{ title: "소스 상태 · Korea Equity Command Center" }] })
});
var $$splitComponentImporter$3 = () => import("./stock._ticker-CFPPN8Wh.mjs");
var Route$3 = createFileRoute("/stock/$ticker")({
	component: lazyRouteComponent($$splitComponentImporter$3, "component"),
	head: ({ params }) => {
		const st = getUniverseItem(params.ticker);
		return { meta: [{ title: st ? `${st.nameKo} ${st.code} · Korea Equity` : "종목 · Korea Equity" }] };
	}
});
/**
* F7.10 research overlay: target-price changes only where the prior
* same-broker target was actually fetched (annotated rows); otherwise a
* plain "리포트" marker with the rating.
*/
var $$splitComponentImporter$2 = () => import("./us-research.index-CArvCkaB.mjs");
var Route$2 = createFileRoute("/us-research/")({
	validateSearch: (s) => ({ ticker: typeof s.ticker === "string" ? s.ticker.slice(0, 12).toUpperCase() : void 0 }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component"),
	head: () => ({ meta: [{ title: "Research · Official US filings and policy" }] })
});
var $$splitComponentImporter$1 = () => import("./us-research._reportId-BeaXS_Po.mjs");
var Route$1 = createFileRoute("/us-research/$reportId")({
	component: lazyRouteComponent($$splitComponentImporter$1, "component"),
	head: ({ params }) => ({ meta: [{ title: `Research · ${params.reportId}` }] })
});
var $$splitComponentImporter = () => import("./us._symbol-Byn9aiN3.mjs");
var Route = createFileRoute("/us/$symbol")({
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	head: ({ params }) => ({ meta: [{ title: `${params.symbol.toUpperCase()} · 미국 주식` }] })
});
var IndexRoute = Route$25.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$26
});
var ChartRoute = Route$24.update({
	id: "/chart",
	path: "/chart",
	getParentRoute: () => Route$26
});
var DisclosuresRoute = Route$23.update({
	id: "/disclosures",
	path: "/disclosures",
	getParentRoute: () => Route$26
});
var EtfsRoute = Route$22.update({
	id: "/etfs",
	path: "/etfs",
	getParentRoute: () => Route$26
});
var ExportDeskRoute = Route$21.update({
	id: "/export-desk",
	path: "/export-desk",
	getParentRoute: () => Route$26
});
var ResearchRoute = Route$20.update({
	id: "/research",
	path: "/research",
	getParentRoute: () => Route$26
});
var RoboticsRoute = Route$19.update({
	id: "/robotics",
	path: "/robotics",
	getParentRoute: () => Route$26
});
var UsLinkRoute = Route$18.update({
	id: "/us-link",
	path: "/us-link",
	getParentRoute: () => Route$26
});
var UsResearchRoute = Route$17.update({
	id: "/us-research",
	path: "/us-research",
	getParentRoute: () => Route$26
});
var WatchlistRoute = Route$16.update({
	id: "/watchlist",
	path: "/watchlist",
	getParentRoute: () => Route$26
});
var ApiFeedRoute = Route$15.update({
	id: "/api/feed",
	path: "/api/feed",
	getParentRoute: () => Route$26
});
var ApiMarketStreamRoute = Route$14.update({
	id: "/api/market-stream",
	path: "/api/market-stream",
	getParentRoute: () => Route$26
});
var ApiWireRoute = Route$13.update({
	id: "/api/wire",
	path: "/api/wire",
	getParentRoute: () => Route$26
});
var EtfsIndexRoute = Route$12.update({
	id: "/",
	path: "/",
	getParentRoute: () => EtfsRoute
});
var EtfsCodeRoute = Route$11.update({
	id: "/$code",
	path: "/$code",
	getParentRoute: () => EtfsRoute
});
var IndustrySectorIdRoute = Route$10.update({
	id: "/industry/$sectorId",
	path: "/industry/$sectorId",
	getParentRoute: () => Route$26
});
var NewsIndexRoute = Route$9.update({
	id: "/news/",
	path: "/news/",
	getParentRoute: () => Route$26
});
var NewsEtfRoute = Route$8.update({
	id: "/news/etf",
	path: "/news/etf",
	getParentRoute: () => Route$26
});
var NewsKrRoute = Route$7.update({
	id: "/news/kr",
	path: "/news/kr",
	getParentRoute: () => Route$26
});
var NewsUsRoute = Route$6.update({
	id: "/news/us",
	path: "/news/us",
	getParentRoute: () => Route$26
});
var SettingsAlertsRoute = Route$5.update({
	id: "/settings/alerts",
	path: "/settings/alerts",
	getParentRoute: () => Route$26
});
var StatusSourcesRoute = Route$4.update({
	id: "/status/sources",
	path: "/status/sources",
	getParentRoute: () => Route$26
});
var StockTickerRoute = Route$3.update({
	id: "/stock/$ticker",
	path: "/stock/$ticker",
	getParentRoute: () => Route$26
});
var UsResearchIndexRoute = Route$2.update({
	id: "/",
	path: "/",
	getParentRoute: () => UsResearchRoute
});
var UsResearchReportIdRoute = Route$1.update({
	id: "/$reportId",
	path: "/$reportId",
	getParentRoute: () => UsResearchRoute
});
var UsSymbolRoute = Route.update({
	id: "/us/$symbol",
	path: "/us/$symbol",
	getParentRoute: () => Route$26
});
var EtfsRouteChildren = {
	EtfsCodeRoute,
	EtfsIndexRoute
};
var EtfsRouteWithChildren = EtfsRoute._addFileChildren(EtfsRouteChildren);
var UsResearchRouteChildren = {
	UsResearchReportIdRoute,
	UsResearchIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	ChartRoute,
	DisclosuresRoute,
	EtfsRoute: EtfsRouteWithChildren,
	ExportDeskRoute,
	ResearchRoute,
	RoboticsRoute,
	UsLinkRoute,
	UsResearchRoute: UsResearchRoute._addFileChildren(UsResearchRouteChildren),
	WatchlistRoute,
	ApiFeedRoute,
	ApiMarketStreamRoute,
	ApiWireRoute,
	IndustrySectorIdRoute,
	NewsEtfRoute,
	NewsKrRoute,
	NewsUsRoute,
	SettingsAlertsRoute,
	StatusSourcesRoute,
	StockTickerRoute,
	UsSymbolRoute,
	NewsIndexRoute
};
var routeTree = Route$26._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent,
		defaultPreload: "intent"
	});
}
//#endregion
export { ThemeChips as $, useUsLinkDesk as A, getResearchV2Detail as At, sectorStatsFromQuotes as B, useMarketIndices as C, formatWeight as Ct, useResearchDesk as D, getResearchBriefing as Dt, useQuotesByCodes as E, getKrxDisclosureDesk as Et, useUsStreet as F, BLOOMBERG_SOURCE_IDS as Ft, krSessionEstimate as G, notifyAlert as H, useValuationSeries as I, useAppStore as It, SourceHealthChip as J, usSessionEstimate as K, getStocksBySector as L, usePriceColors as Lt, useUsOfficialPolicy as M, resolveResearchOriginal as Mt, useUsOfficialReport as N, Input as Nt, useStockBundle as O, getResearchPdf as Ot, useUsOfficialUniverse as P, cn as Pt, SourceBadge as Q, marketMoversFromQuotes as R, useIndustryResearch as S, formatVolume as St, useQuoteMap as T, getDisclosureDetail as Tt, useWireStore as U, beep as V, krIndexStatusLabel as W, EmptyState as X, FeedList as Y, ImportanceChip as Z, RISK_DISCLAIMER as _, formatMarketCap as _t, Route$3 as a, SheetHeader as at, useEtfBundle as b, formatQty as bt, Route$19 as c, normalizeClusterTitle as ct, Route$24 as d, useNaverAiBriefing as dt, TimeStamp as et, DesktopAlertsButton as f, useUsCalendar as ft, DATA_LABEL as g, formatIsoDate as gt, DATA_DELAY_NOTE as h, formatHoldingPrice as ht, Route$2 as i, SheetDescription as it, useUsOfficialCompany as j, getStockNews as jt, useStreetUniverse as k, getResearchV2 as kt, TABS as l, useFeed as lt, PriceValue as m, retrySource as mt, Route as n, Sheet as nt, Route$10 as o, SheetTitle as ot, PriceChange as p, getSourceHealth as pt, NewsDesk as q, Route$1 as r, SheetContent as rt, Route$11 as s, Button as st, router_exports as t, useNow as tt, Route$20 as u, useMarketSnapshot as ut, Switch as v, formatPct as vt, useMarketQuotes as w, kstYmd as wt, useEtfMarket as x, formatUsd as xt, useChartData as y, formatPrice as yt, mergeQuote as z };
