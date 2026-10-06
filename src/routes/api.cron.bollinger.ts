import { createFileRoute } from "@tanstack/react-router";
import { handleBollingerCloud } from "../server/bollinger-cloud-handler";

export const Route = createFileRoute("/api/cron/bollinger")({
  server:{handlers:{GET:({request})=>handleBollingerCloud(request,async config=>{
    const [{getDiscoveryStore},{runBollingerCloud},providers,{fetchDiscoveryBenchmark}]=await Promise.all([
      import("../server/bollinger-discovery-store"),import("../server/bollinger-cloud"),import("../server/bollinger-discovery-providers"),import("../server/naver-market"),
    ]);
    return runBollingerCloud(await getDiscoveryStore(),config,{
      prices:providers.fetchDiscoveryPrices,benchmark:fetchDiscoveryBenchmark,
      membership:async(target,previous,options)=>{
        if(target==="KOSPI"||target==="KOSDAQ")return providers.fetchKrDiscoveryUniverseBatch(target,previous,options);
        await options.checkpoint();
        return {progress:null,snapshot:target==="NASDAQ_LISTED"?await providers.fetchNasdaqListedDiscoveryUniverse():await providers.fetchEtfDiscoveryUniverse(target.slice(4))};
      },
    });
  })}},
});
