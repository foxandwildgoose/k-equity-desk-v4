/** Test-only browser transport: synthetic API -> actual collector/DB -> FlowResponse. Never a runtime fallback. */
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createKiwoomStore } from "../src/server/kiwoom-store.ts";
import { createKiwoomClient } from "../src/server/kiwoom-client.ts";
import { createChartFlowService } from "../src/server/chart-flow.ts";
const pg = new PGlite();
await pg.waitReady;
// Only this fixture's isolated in-memory PGlite is migrated. The production
// service now also requires the collection-target schema from 0003.
for (const migration of ["0002_kiwoom_flow.sql", "0003_kiwoom_collection_targets.sql"]) {
  await pg.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
}
const store = createKiwoomStore({
  query: async (text, params) => (await pg.query(text, params)).rows,
});
if (!(await store.schema()).ready) throw new Error("Isolated Kiwoom QA schema is incomplete");
const series = new Map();
const config = {
  appKey: "QA_SYNTHETIC_APP_KEY",
  appSecret: "QA_SYNTHETIC_APP_SECRET",
  environment: "mock",
  enabled: true,
  mode: "direct",
  requestsPerSecond: 2,
  expectedEgressIp: "192.0.2.1",
  ownerUserId: "qa-synthetic-owner",
  databaseConfigured: true,
};
const service = createChartFlowService({
  config: () => config,
  store: async () => store,
  checkEgress: async () => ({ status: "IP_MATCH", observedIp: "192.0.2.1" }),
  client: (cfg, s) =>
    createKiwoomClient(
      cfg,
      { ...s, admit: async () => {} },
      {
        fetch: async (url, init) => {
          const response = (body) =>
            new Response(JSON.stringify(body), { headers: { "cont-yn": "N" } });
          if (String(url).endsWith("/oauth2/token"))
            return response({
              return_code: 0,
              token: "QA_SYNTHETIC_TOKEN",
              token_type: "bearer",
              expires_dt: "20300101090000",
            });
          const id = new Headers(init?.headers).get("api-id");
          const body = JSON.parse(init.body);
          const bars = series.get(body.stk_cd) ?? [];
          const key =
            id === "ka10013" ? "crd_trde_trend" : id === "ka10008" ? "stk_frgnr" : "stk_invsr_orgn";
          const rows = bars.map((bar, i) => ({
            dt: bar.date.replaceAll("-", ""),
            remn_rt: i === 20 ? "" : String((i % 11) / 10),
            shr_rt: "91",
            wght: i === 40 ? "" : String((i % 37) / 10),
            limit_exh_rt: "92",
            invtrt: i === 60 ? "" : String(i % 2 ? -1000 : 1500),
            orgn: "930000",
            fnnc_invt: "940000",
            penfnd_etc: "950000",
            samo_fund: "960000",
          }));
          return response({ return_code: 0, [key]: rows });
        },
      },
    ),
});
export async function kiwoomBrowserFixture(request, bars) {
  series.set(request.code, bars);
  const result = await service(request, undefined, config.ownerUserId);
  for (const metric of ["credit", "foreign", "investmentTrust"]) {
    result[metric].source = "키움증권 · QA SYNTHETIC (실데이터 아님)";
    result[metric].reason =
      "QA SYNTHETIC API → 격리된 메모리 PGlite → 실제 서버 서비스 · " + result[metric].reason;
  }
  return result;
}
export async function closeKiwoomBrowserFixture() {
  await pg.close();
}
