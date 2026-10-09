import { createFileRoute } from "@tanstack/react-router";
import { handleSelectedBollingerCollection } from "../server/bollinger-collection-handler";

export const Route = createFileRoute("/api/bollinger/collect")({
  server: { handlers: { POST: ({ request }) => handleSelectedBollingerCollection(request, async (config, input) => {
    const { runBollingerCollector } = await import("../server/bollinger-cloud-runtime");
    return runBollingerCollector(config, input);
  }) } },
});
