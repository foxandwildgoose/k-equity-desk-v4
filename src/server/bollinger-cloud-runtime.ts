import type { BollingerCloudConfig } from "./bollinger-cloud-config.ts";
import type { BollingerCollectionInput } from "../lib/bollinger/collection-request.ts";

/** Loaded by protected routes only, after operator authorization. Both entry points share one service. */
export async function runBollingerCollector(config: BollingerCloudConfig, input?: BollingerCollectionInput) {
  const [{ getDiscoveryStore }, runner, prices, { fetchDiscoveryBenchmark }] = await Promise.all([
    import("./bollinger-discovery-store.ts"), import("./bollinger-cloud.ts"),
    import("./bollinger-discovery-providers.ts"), import("./naver-market.ts"),
  ]);
  const providers: import("./bollinger-cloud.ts").CloudProviders = {
    prices: prices.fetchDiscoveryPrices, benchmark: fetchDiscoveryBenchmark,
    membership: async (target, previous, options) => {
      if (target === "KOSPI" || target === "KOSDAQ") return prices.fetchKrDiscoveryUniverseBatch(target, previous, options);
      await options.checkpoint();
      return { progress: null, snapshot: target === "NASDAQ_LISTED"
        ? await prices.fetchNasdaqListedDiscoveryUniverse() : await prices.fetchEtfDiscoveryUniverse(target.slice(4)) };
    },
  };
  const store = await getDiscoveryStore();
  if (!input) return runner.runBollingerCloud(store, config, providers);
  return "bootstrapTarget" in input
    ? runner.runBootstrapBollingerCloud(store, config, providers, input)
    : runner.runSelectedBollingerCloud(store, config, providers, input);
}
