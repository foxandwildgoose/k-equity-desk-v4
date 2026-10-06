import { createHash, timingSafeEqual } from "node:crypto";
import { readBollingerCloudConfig, type BollingerCloudConfig } from "./bollinger-cloud-config.ts";

/** Bearer operator authorization precedes any DB access or provider import. */
export async function handleBollingerCloud(request:Request,run:(config:BollingerCloudConfig)=>Promise<unknown>,env:Record<string,string|undefined>=process.env) {
  const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  if(request.method!=="GET")return json({status:"METHOD_NOT_ALLOWED"},405);
  if(new URL(request.url).search)return json({status:"QUERY_NOT_ALLOWED"},400);
  const config=readBollingerCloudConfig(env);
  if(!config.secretValid)return json({status:config.secretConfigured?"CRON_SECRET_INVALID":"CRON_SECRET_MISSING"},503);
  const authorization=request.headers.get("authorization")??"";
  const hash=(value:string)=>createHash("sha256").update(value).digest();
  if(authorization.length>300||!timingSafeEqual(hash(authorization),hash(`Bearer ${env.CRON_SECRET}`)))return json({status:"OPERATOR_AUTH_REQUIRED"},401);
  if(!config.enabled)return json({status:"DISABLED"});
  if(!config.configurationValid)return json({status:"CONFIGURATION_INVALID"},400);
  if(env.VERCEL_ENV&&env.VERCEL_ENV!=="production")return json({status:"PRODUCTION_DEPLOYMENT_REQUIRED"},409);
  try{return json(await run(config));}
  catch(error){return json({status:error instanceof Error&&["DATABASE_MISSING","MIGRATION_0005_REQUIRED"].includes(error.message)?error.message:"COLLECTION_FAILED"},503);}
}
