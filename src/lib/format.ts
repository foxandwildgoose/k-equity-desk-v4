/** Format KRW with Korean locale grouping */
export function formatKRW(value: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(value)) return "—";
  if (opts?.compact) {
    if (Math.abs(value) >= 1_0000_0000_0000) {
      return `${(value / 1_0000_0000_0000).toFixed(1)}조`;
    }
    if (Math.abs(value) >= 1_0000_0000) {
      return `${(value / 1_0000_0000).toFixed(1)}억`;
    }
    if (Math.abs(value) >= 1_0000) {
      return `${(value / 1_0000).toFixed(0)}만`;
    }
  }
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return new Intl.NumberFormat("ko-KR").format(Math.round(value));
  }
  if (Number.isInteger(value) || abs >= 100) {
    return new Intl.NumberFormat("ko-KR").format(Math.round(value));
  }
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: abs < 10 ? 2 : 1,
  }).format(value);
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatHoldingPrice(value: number, currency?: string | null): string {
  if (currency === "USD") return formatUsd(value);
  if (currency === "KRW") return formatPrice(value);
  if (!currency) return `${formatPrice(value)} (통화 미확인)`;
  try {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency }).format(value);
  } catch {
    return `${formatPrice(value)} ${currency}`;
  }
}

export function formatWeight(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value).toFixed(2);
  return value < 0 ? `−${abs}%` : `${abs}%`;
}

export function formatQty(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return value.toLocaleString("ko-KR");
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatChange(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
}

export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  if (value >= 1_0000_0000) return `${(value / 1_0000_0000).toFixed(1)}억`;
  if (value >= 1_0000) return `${(value / 1_0000).toFixed(0)}만`;
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function formatMarketCap(억: number): string {
  if (!Number.isFinite(억) || 억 === 0) return "—";
  if (억 >= 10000) return `${(억 / 10000).toFixed(1)}조`;
  return `${new Intl.NumberFormat("ko-KR").format(억)}억`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

/** Normalize listing / trade timestamps to YYYY-MM-DD. */
export function formatIsoDate(raw?: string | null): string {
  if (!raw) return "—";
  const sliced = raw.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(sliced)) return sliced;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return "—";
  return kstYmd(dt);
}

/** YYYY-MM-DD in Asia/Seoul. Never use UTC midnight for Korean session dates. */
export function kstYmd(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
