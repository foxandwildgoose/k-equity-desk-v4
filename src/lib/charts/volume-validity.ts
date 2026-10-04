/** Preserve missing/invalid quantity separately from genuine zero through JSON. */
export function chartVolume(value: unknown): { volume: number; volumeValid: boolean } {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.replace(/,/g, ""))
        : NaN;
  const volumeValid = Number.isFinite(numeric) && numeric >= 0;
  return { volume: volumeValid ? Math.round(numeric) : 0, volumeValid };
}
