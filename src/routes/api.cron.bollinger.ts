import { createFileRoute } from "@tanstack/react-router";
import { handleBollingerCloud } from "../server/bollinger-cloud-handler";

export const Route = createFileRoute("/api/cron/bollinger")({
  server:{handlers:{GET:({request})=>handleBollingerCloud(request,async config=>{
    const {runBollingerCollector}=await import("../server/bollinger-cloud-runtime");
    return runBollingerCollector(config);
  })}},
});
