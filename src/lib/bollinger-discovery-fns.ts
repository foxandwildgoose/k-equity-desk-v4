import { createMiddleware,createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { STRATEGIES } from "./bollinger/discovery";
import { bollingerCollectionRequestSchema } from "./bollinger/collection-request";

const sameSite=createMiddleware({type:"function"}).server(async({next})=>{const {assertSameSiteRequest}=await import("./auth/isolation.server");assertSameSiteRequest();return next();});
const id=z.string().min(1).max(160);
const selection=z.object({top:z.union([z.literal("ALL"),z.literal(10),z.literal(20),z.literal(50),z.literal(100),z.literal(200)]),minWeight:z.number().min(0).max(100),sectors:z.array(z.string().max(80)).max(30)});
export const getDiscoveryCatalog=createServerFn({method:"GET"}).middleware([sameSite]).handler(async()=>{const {discoveryCatalog}=await import("@/server/bollinger-discovery");return discoveryCatalog();});
export const getDiscoveryRunProgress=createServerFn({method:"POST"}).middleware([sameSite]).validator(bollingerCollectionRequestSchema).handler(async({data})=>{
  try {
    const [{getDiscoveryStore},runner]=await Promise.all([import("@/server/bollinger-discovery-store"),import("@/server/bollinger-cloud")]);
    const store=await getDiscoveryStore();
    return "bootstrapTarget" in data ? await runner.readBootstrapBollingerProgress(store,data) : await runner.readSelectedBollingerProgress(store,data);
  } catch(error) { return {status:error instanceof Error&&["DATABASE_MISSING","MIGRATION_0005_REQUIRED","UNIVERSE_MISSING","SELECTION_INVALID","CONFIGURATION_VERSION_INVALID","UNIVERSE_UNSUPPORTED","BOOTSTRAP_TARGET_INVALID","NO_SELECTION"].includes(error.message)?error.message:"DATABASE_QUERY_FAILED",jobs:[]}; }
});
export const getDiscoveryChartContext=createServerFn({method:"GET"}).middleware([sameSite]).validator(z.object({universeId:id,version:z.string().min(1).max(1500),market:z.enum(["KR","US"]),symbol:z.string().regex(/^[A-Z0-9][A-Z0-9.-]{0,14}$/)})).handler(async({data})=>{const {discoveryChartContext}=await import("@/server/bollinger-discovery");return discoveryChartContext(data.universeId,data.version,data.market,data.symbol);});
export const getDiscoveryStockChart=createServerFn({method:"GET"}).middleware([sameSite]).validator(z.object({universeId:id,configVersion:z.string().min(1).max(1500),market:z.enum(["KR","US"]),symbol:z.string().regex(/^[A-Z0-9][A-Z0-9.-]{0,14}$/),asOf:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict()).handler(async({data})=>{const {discoveryStockChart}=await import("@/server/bollinger-discovery");return discoveryStockChart(data);});
export const getDiscoveryCandidates=createServerFn({method:"POST"}).middleware([sameSite])
  .validator(z.object({universeId:id,configVersion:z.string().min(1).max(1500),strategy:z.enum(STRATEGIES),selection,page:z.number().int().min(1).max(10000),pageSize:z.union([z.literal(25),z.literal(50),z.literal(100)]),minScore:z.number().min(0).max(100),minCoverage:z.number().min(0).max(1),asOf:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),symbols:z.array(z.string().regex(/^(KR:[0-9A-Z]{6}|US:[A-Z][A-Z0-9.-]{0,14})$/)).max(15000).optional(),sort:z.enum(["score","distance","rs"]).optional()}))
  .handler(async({data})=>{const {queryDiscovery}=await import("@/server/bollinger-discovery");return queryDiscovery(data);});
export const getDiscoveryEvidence=createServerFn({method:"GET"}).middleware([sameSite]).validator(z.object({universeId:id,version:z.string().min(1).max(1500)})).handler(async({data})=>{const {discoveryDetails}=await import("@/server/bollinger-discovery");return discoveryDetails(data.universeId,data.version);});
export const getDiscoveryUniversePreview=createServerFn({method:"POST"}).middleware([sameSite]).validator(z.object({universeId:id,selection,page:z.number().int().min(1).max(1000)})).handler(async({data})=>{const {previewDiscoveryUniverse}=await import("@/server/bollinger-discovery");return previewDiscoveryUniverse(data.universeId,data.selection.top,data.selection.minWeight,data.selection.sectors,data.page);});
