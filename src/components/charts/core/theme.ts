import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

/** Chart palette read from the app's CSS variables (dark + light). */
export interface ChartTheme {
  background: string;
  text: string;
  muted: string;
  grid: string;
  border: string;
  crosshair: string;
  labelBg: string;
  card: string;
}

const DARK: ChartTheme = {
  background: "#0d1524",
  text: "#e8eef8",
  muted: "#8b9cb8",
  grid: "rgba(139,156,184,0.10)",
  border: "rgba(139,156,184,0.22)",
  crosshair: "rgba(139,156,184,0.45)",
  labelBg: "#1a2a44",
  card: "#0d1524",
};

function hexToRgba(hex: string, a: number): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Resolve the palette from `:root` CSS variables (SSR → dark defaults). */
export function readChartTheme(): ChartTheme {
  if (typeof window === "undefined") return DARK;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  const muted = v("--muted-foreground", DARK.muted);
  const border = v("--border", "#1a2a44");
  return {
    background: v("--card", DARK.background),
    card: v("--card", DARK.card),
    text: v("--foreground", DARK.text),
    muted,
    grid: hexToRgba(muted, 0.1) ?? DARK.grid,
    border: hexToRgba(muted, 0.25) ?? DARK.border,
    crosshair: hexToRgba(muted, 0.5) ?? DARK.crosshair,
    labelBg: border,
  };
}

/** Re-reads the palette whenever the app theme toggles. */
export function useChartTheme(): ChartTheme {
  const mode = useAppStore((s) => s.theme);
  const [theme, setTheme] = useState<ChartTheme>(DARK);
  useEffect(() => {
    // The theme class is applied in an effect in AppShell; read on the next frame.
    const id = requestAnimationFrame(() => setTheme(readChartTheme()));
    return () => cancelAnimationFrame(id);
  }, [mode]);
  return theme;
}
