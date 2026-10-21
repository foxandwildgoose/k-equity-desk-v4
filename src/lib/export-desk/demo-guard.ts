type Provenance = { sourceFile?: unknown; vintage?: unknown };

/** Legacy demo rows must never survive hydration, JSON import, or ingestion. */
export function isSyntheticTradeRow(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const r = row as Provenance;
  return [r.sourceFile, r.vintage].some(
    (value) =>
      typeof value === "string" &&
      /\b(?:demo|synthetic|mock)\b|합성\s*(?:데이터|숫자)/i.test(value),
  );
}

export function assertNoSyntheticLeak(rows: readonly Provenance[]): void {
  if (rows.some(isSyntheticTradeRow)) throw new Error("합성·데모 데이터는 사용할 수 없습니다.");
}

/** Strip retired demo controls and rows while retaining the user's real data. */
export function sanitizeExportDeskSnapshot(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const {
    demoMode: _mode,
    setDemoMode: _setter,
    sourceKeys: _retiredKeys,
    setSourceKey: _retiredSetter,
    ...state
  } = value as Record<string, unknown>;
  if (Array.isArray(state.observations)) {
    state.observations = state.observations.filter((row) => !isSyntheticTradeRow(row));
  }
  if (Array.isArray(state.indexImported)) {
    state.indexImported = state.indexImported.filter((row) => !isSyntheticTradeRow(row));
  }
  if (Array.isArray(state.fxImported)) {
    state.fxImported = state.fxImported.filter((row) => !isSyntheticTradeRow(row));
  }
  if (Array.isArray(state.exposures)) {
    state.exposures = state.exposures.map((row) => {
      if (!row || typeof row !== "object" || row.verificationStatus !== "UNVERIFIED_SEED")
        return row;
      return { ...row, effectiveFrom: "", lastReviewedAt: "" };
    });
  }
  return state;
}
