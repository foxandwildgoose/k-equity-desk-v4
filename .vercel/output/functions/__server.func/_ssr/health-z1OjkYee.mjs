import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/health-z1OjkYee.js
var health_z1OjkYee_exports = /* @__PURE__ */ __exportAll({
	a: () => recordFailure,
	i: () => recordAttempt,
	n: () => isCircuitOpen,
	o: () => recordResult,
	r: () => openCircuit,
	s: () => setHealthNote,
	t: () => health_exports
});
var health_exports = /* @__PURE__ */ __exportAll$1({
	allHealth: () => allHealth,
	healthOf: () => healthOf,
	isCircuitOpen: () => isCircuitOpen,
	openCircuit: () => openCircuit,
	recordAttempt: () => recordAttempt,
	recordFailure: () => recordFailure,
	recordResult: () => recordResult,
	resetHealth: () => resetHealth,
	setHealthNote: () => setHealthNote
});
var store = /* @__PURE__ */ new Map();
function blank(id) {
	return {
		id,
		lastAttemptAt: null,
		lastSuccessAt: null,
		httpStatus: null,
		latencyMs: null,
		itemCount: null,
		newestPublishedAt: null,
		consecutiveFailures: 0,
		circuit: "closed",
		circuitUntil: null,
		circuitOpens: 0,
		adapterPath: null,
		lastError: null,
		notes: {}
	};
}
function healthOf(id) {
	let h = store.get(id);
	if (!h) {
		h = blank(id);
		store.set(id, h);
	}
	return h;
}
function allHealth() {
	return [...store.values()].map((h) => ({
		...h,
		notes: { ...h.notes }
	}));
}
/** One HTTP attempt finished (success or failure). */
function recordAttempt(id, r) {
	const h = healthOf(id);
	const now = (/* @__PURE__ */ new Date()).toISOString();
	h.lastAttemptAt = now;
	h.httpStatus = r.status;
	h.latencyMs = r.latencyMs;
	if (r.ok) {
		h.lastSuccessAt = now;
		h.consecutiveFailures = 0;
		h.lastError = null;
	} else {
		h.consecutiveFailures += 1;
		h.lastError = r.error ?? (r.status ? `HTTP ${r.status}` : "network error");
	}
}
/** Parsed output of a source (after an attempt). */
function recordResult(id, r) {
	const h = healthOf(id);
	h.itemCount = r.count;
	if (r.newestPublishedAt !== void 0) h.newestPublishedAt = r.newestPublishedAt;
	if (r.adapterPath !== void 0) h.adapterPath = r.adapterPath;
}
/** A failure outside HTTP (parse-fail, adapter error). */
function recordFailure(id, error) {
	const h = healthOf(id);
	h.lastAttemptAt = (/* @__PURE__ */ new Date()).toISOString();
	h.consecutiveFailures += 1;
	h.lastError = error;
}
var CIRCUIT_MS = 9e5;
var CIRCUIT_REPEAT_MS = 18e5;
/** 403/429 → open the circuit (15 min, 30 min on a repeat). */
function openCircuit(id, status) {
	const h = healthOf(id);
	const ms = h.circuitOpens > 0 ? CIRCUIT_REPEAT_MS : CIRCUIT_MS;
	h.circuitOpens += 1;
	h.circuit = "open";
	h.circuitUntil = new Date(Date.now() + ms).toISOString();
	h.lastError = `HTTP ${status} — ${Math.round(ms / 6e4)}분간 요청 중단 (circuit)`;
}
function isCircuitOpen(id, now = Date.now()) {
	const h = store.get(id);
	if (!h || h.circuit !== "open" || !h.circuitUntil) return false;
	if (Date.parse(h.circuitUntil) <= now) {
		h.circuit = "closed";
		h.circuitUntil = null;
		return false;
	}
	return true;
}
function setHealthNote(id, key, text) {
	const h = healthOf(id);
	if (text) h.notes[key] = text;
	else delete h.notes[key];
}
/** Test helper. */
function resetHealth() {
	store.clear();
}
//#endregion
export { recordFailure as a, recordAttempt as i, isCircuitOpen as n, recordResult as o, openCircuit as r, setHealthNote as s, health_z1OjkYee_exports as t };
