import type { HtsProfileSettings } from "./hts-settings.ts";

export interface ResolvedProfileStyle {
  color: string;
  opacity: number;
  labelColor: string;
}

const PROFILE_THEME: Record<"light" | "dark", ResolvedProfileStyle> = {
  light: { color: "#E6B77C", opacity: 0.32, labelColor: "#76552F" },
  dark: { color: "#D9A15A", opacity: 0.28, labelColor: "#E5D2B8" },
};

/** Auto colors follow the app theme; explicit saved choices retain their fill. */
export function resolveProfileStyle(
  profile: Pick<HtsProfileSettings, "colorMode" | "color" | "opacity">,
  theme: "light" | "dark",
): ResolvedProfileStyle {
  const defaults = PROFILE_THEME[theme];
  return profile.colorMode === "custom"
    ? { color: profile.color, opacity: profile.opacity, labelColor: defaults.labelColor }
    : { ...defaults };
}

/**
 * Normalize against every bin in the selected time window, even if the
 * maximum-volume price bin is currently outside the viewport. The displayed
 * total-volume percentage is deliberately not an input to bar geometry.
 */
export function profileBarWidth(
  plotWidth: number,
  widthRatio: number,
  volume: number,
  maxBinVolume: number,
): number {
  if (
    ![plotWidth, widthRatio, volume, maxBinVolume].every(Number.isFinite) ||
    plotWidth <= 0 || widthRatio <= 0 || widthRatio > 1 ||
    volume <= 0 || maxBinVolume <= 0 || volume > maxBinVolume
  ) return 0;
  return plotWidth * widthRatio * (volume / maxBinVolume);
}
