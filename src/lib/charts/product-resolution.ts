import type { ChartSecurity } from "./security.ts";

/** A validated route/universe product survives remote metadata failure. Numeric codes alone do not prove stock. */
export function resolveChartProduct(declared: ChartSecurity["instrument"] | undefined, remote: ChartSecurity | null | undefined) {
  const instrument = declared ?? remote?.instrument;
  return { instrument, status: instrument ? "RESOLVED" as const : "PRODUCT_TYPE_UNKNOWN" as const };
}
