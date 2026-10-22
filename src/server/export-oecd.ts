import { parseCsv } from "../lib/export-desk/parse-import.ts";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { FredPoint } from "../lib/export-desk/parse-fred.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";

// The IMTS query catalogue publishes the eight-dimensional monthly goods
// export/import key. Unlike the retired OECD mirror, this is the OECD API.
// https://github.com/TuanPhanDB/data_monthly_update/blob/69bb223ef8aabbcd4d21fad6ad607df91ffa338c/Relevant_variables.csv#L99
// Labelled CSV is used by FinanceToolkit's OECD adapter. Codes, labels and the
// response's own unit multiplier must agree; no currency/scale is inferred.
const DATAFLOW = "OECD.SDD.TPS,DSD_IMTS@DF_IMTS,1.0";
const BASE_URL = `https://sdmx.oecd.org/public/rest/data/${DATAFLOW}/`;
const METADATA_URL =
  "https://sdmx.oecd.org/public/rest/dataflow/OECD.SDD.TPS/DSD_IMTS@DF_IMTS/1.0?references=all";
const AVAILABILITY_URL = `https://sdmx.oecd.org/public/rest/availableconstraint/${DATAFLOW}/`;
const SOURCE_URL =
  "https://data-explorer.oecd.org/?df[ag]=OECD.SDD.TPS&df[id]=DSD_IMTS%40DF_IMTS&df[vs]=1.0";
const SOURCE = "OECD IMTS · 대한민국/전세계 · 월별 상품수출입 · 명목 USD · 비계절조정";
const BODY_LIMIT = 4_000_000;
const FRESH_MS = 4 * 60 * 60_000;
const FAILURE_MS = 60_000;
const STALE_MS = 7 * 86_400_000;

export interface OecdTradeResult {
  exports: FredPoint[];
  imports: FredPoint[];
  providers: ExportProviderStatus[];
  source: string;
}
interface ParsedTrade {
  exports: FredPoint[];
  imports: FredPoint[];
  provisional: boolean;
  issues: { exports: string[]; imports: string[] };
  failures?: Partial<Record<"exports" | "imports", OecdFailure>>;
}
export interface OecdTradeProfile {
  key: string;
  dimensions: string[];
  selected: Record<string, string[]>;
  labels: Record<string, Record<string, string>>;
  roles: {
    area: string;
    flow: string;
    frequency: string;
    units: string;
    adjustment: string;
    transformation: string;
    partner?: string;
    commodity?: string;
  };
  flowCodes: { exports: string; imports: string };
}
class OecdFailure extends Error {
  readonly reasonCode: string;
  readonly state: ExportProviderStatus["state"];
  readonly columns: string[];
  readonly semanticHints: string[];
  readonly hintContext: "PRODUCT_TYPE" | "AVAILABILITY";
  constructor(
    reasonCode: string,
    state: ExportProviderStatus["state"] = "unavailable",
    columns: string[] = [],
    semanticHints: string[] = [],
    hintContext: "PRODUCT_TYPE" | "AVAILABILITY" = "PRODUCT_TYPE",
  ) {
    super(reasonCode);
    this.reasonCode = reasonCode;
    this.state = state;
    this.columns = columns.filter((column) => /^[A-Z][A-Z0-9_]{1,50}$/.test(column)).slice(0, 22);
    this.semanticHints = semanticHints
      .slice(0, 5)
      .map((hint) =>
        hint
          .replace(/<[^>]*>/g, " ")
          .replace(/\p{Cc}/gu, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120),
      )
      .filter(Boolean);
    this.hintContext = hintContext;
  }
}
function koreaMonth(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60_000).toISOString().slice(0, 7);
}
function previousMonth(now: Date): string {
  const local = new Date(now.getTime() + 9 * 60 * 60_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 7);
}
const decimal = (raw: string): number | null => {
  if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const normalize = (raw: string): string => raw.replace(/\s+/g, " ").trim().toLowerCase();
type XmlRecord = Record<string, unknown>;
const record = (raw: unknown): XmlRecord | null =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as XmlRecord) : null;
const array = (raw: unknown): unknown[] => (Array.isArray(raw) ? raw : raw == null ? [] : [raw]);
function nodes(raw: unknown, name: string): XmlRecord[] {
  const found: XmlRecord[] = [];
  for (const [key, value] of Object.entries(record(raw) ?? {})) {
    if (key === name)
      found.push(
        ...array(value)
          .map(record)
          .filter((item): item is XmlRecord => Boolean(item)),
      );
    if (!key.startsWith("@_"))
      for (const item of array(value)) if (record(item)) found.push(...nodes(item, name));
  }
  return found;
}
function englishName(raw: XmlRecord): string {
  const names = array(raw.Name);
  const preferred =
    names.find((item) => {
      const entry = record(item);
      return entry?.["@_lang"] === "en" || entry?.["@_xml:lang"] === "en";
    }) ?? names.find((item) => typeof item === "string" || !record(item)?.["@_lang"]);
  return typeof preferred === "string"
    ? preferred.trim()
    : String(record(preferred)?.["#text"] ?? "").trim();
}

/** Resolve every query dimension using the requested official dataflow's DSD and codelists. */
export function parseOecdTradeMetadata(xml: string): OecdTradeProfile {
  const fail = (reason: string, dimensions: string[] = [], semanticHints: string[] = []): never => {
    throw new OecdFailure(reason, "unverified", dimensions, semanticHints);
  };
  if (
    xml.length > BODY_LIMIT ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    fail("INVALID_METADATA");
  let payload: unknown;
  try {
    payload = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      parseTagValue: false,
      parseAttributeValue: false,
      processEntities: false,
    }).parse(xml);
  } catch {
    fail("INVALID_METADATA");
  }
  const flows = nodes(payload, "Dataflow").filter(
    (flow) =>
      flow["@_agencyID"] === "OECD.SDD.TPS" &&
      flow["@_id"] === "DSD_IMTS@DF_IMTS" &&
      flow["@_version"] === "1.0",
  );
  if (flows.length !== 1) fail("METADATA_DATAFLOW_IDENTITY");
  const structureRef = record(record(flows[0]!.Structure)?.Ref);
  if (!structureRef) fail("METADATA_STRUCTURE_REFERENCE");
  const structures = nodes(payload, "DataStructure").filter(
    (structure) =>
      structure["@_id"] === structureRef!["@_id"] &&
      structure["@_agencyID"] === structureRef!["@_agencyID"] &&
      structure["@_version"] === structureRef!["@_version"],
  );
  if (structures.length !== 1) fail("METADATA_STRUCTURE_IDENTITY");
  const dimensions = nodes(
    record(structures[0]!.DataStructureComponents)?.DimensionList,
    "Dimension",
  ).sort((a, b) => Number(a["@_position"]) - Number(b["@_position"]));
  const ids = dimensions.map((dimension) => String(dimension["@_id"] ?? ""));
  if (
    !ids.length ||
    ids.some((id) => !/^[A-Z][A-Z0-9_]{1,50}$/.test(id)) ||
    new Set(ids).size !== ids.length ||
    dimensions.some((dimension, index) => Number(dimension["@_position"]) !== index + 1)
  )
    fail("METADATA_DIMENSION_ORDER", ids);
  const codelists = nodes(payload, "Codelist"),
    schemes = nodes(payload, "ConceptScheme");
  const labels: OecdTradeProfile["labels"] = {},
    selected: OecdTradeProfile["selected"] = {};
  const roles = {} as OecdTradeProfile["roles"];
  let exportsCode = "",
    importsCode = "";
  for (const dimension of dimensions) {
    const id = String(dimension["@_id"]);
    let representation = record(dimension.LocalRepresentation);
    if (!record(representation?.Enumeration)?.Ref) {
      const identity = record(record(dimension.ConceptIdentity)?.Ref);
      const scheme = schemes.find(
        (item) =>
          item["@_id"] === identity?.["@_maintainableParentID"] &&
          item["@_agencyID"] === identity?.["@_agencyID"] &&
          (!identity?.["@_maintainableParentVersion"] ||
            item["@_version"] === identity["@_maintainableParentVersion"]),
      );
      const concept = array(scheme?.Concept)
        .map(record)
        .find((item) => item?.["@_id"] === identity?.["@_id"]);
      representation = record(concept?.CoreRepresentation);
    }
    const enumeration = record(record(representation?.Enumeration)?.Ref);
    const list = codelists.find(
      (item) =>
        item["@_id"] === enumeration?.["@_id"] &&
        item["@_agencyID"] === enumeration?.["@_agencyID"] &&
        item["@_version"] === enumeration?.["@_version"],
    );
    if (!list) fail("METADATA_CODELIST_REFERENCE", ids);
    labels[id] = Object.fromEntries(
      array(list!.Code)
        .map(record)
        .filter((item): item is XmlRecord => Boolean(item))
        .map((item) => [String(item["@_id"]), englishName(item)]),
    );
    const choose = (predicate: (code: string, label: string) => boolean): string => {
      const candidates = Object.entries(labels[id]!).filter(
        ([code, label]) => /^[A-Za-z0-9_-]{1,80}$/.test(code) && predicate(code, normalize(label)),
      );
      if (candidates.length !== 1)
        fail(
          `METADATA_AMBIGUOUS_${id}_MATCHES_${Math.min(candidates.length, 99)}`,
          ids,
          id === "PRODUCT_TYPE" && candidates.length === 0
            ? Object.entries(labels[id]!)
                .filter(([code]) => /^[A-Za-z0-9_-]{1,80}$/.test(code))
                .slice(0, 5)
                .map(([code, label]) => `${code}: ${label}`)
            : [],
        );
      return candidates[0]![0];
    };
    if (id === "REF_AREA") {
      roles.area = id;
      selected[id] = [
        choose(
          (code, label) =>
            code === "KOR" &&
            /^(?:korea(?:, republic of)?|republic of korea|south korea)$/.test(label),
        ),
      ];
    } else if (id === "COUNTERPART_AREA") {
      roles.partner = id;
      selected[id] = [
        choose((_code, label) => /^(?:world|total world|all countries)$/.test(label)),
      ];
    } else if (id === "COMMODITY") {
      roles.commodity = id;
      selected[id] = [
        choose((_code, label) =>
          /^(?:total|all commodities|total commodities|total merchandise|all goods|total goods|goods)$/.test(
            label,
          ),
        ),
      ];
    } else if (id === "PRODUCT_TYPE") {
      roles.commodity = id;
      selected[id] = [
        choose((_code, label) =>
          /^(?:commodities|goods|total goods|merchandise|merchandise goods|all goods)$/.test(label),
        ),
      ];
    } else if (id === "TRADE_FLOW") {
      roles.flow = id;
      exportsCode = choose((_code, label) =>
        /^(?:exports|exports of goods|exports \(fob\))$/.test(label),
      );
      importsCode = choose((_code, label) =>
        /^(?:imports|imports of goods|imports \(cif\))$/.test(label),
      );
      selected[id] = [exportsCode, importsCode];
    } else if (id === "FREQ") {
      roles.frequency = id;
      selected[id] = [choose((_code, label) => label === "monthly")];
    } else if (id === "UNIT_MEASURE") {
      roles.units = id;
      selected[id] = [
        choose((_code, label) =>
          /^(?:us|u\.s\.|united states) dollars,? exchange rate converted$/.test(label),
        ),
      ];
    } else if (id === "ADJUSTMENT") {
      roles.adjustment = id;
      selected[id] = [
        choose((_code, label) =>
          /^(?:neither seasonally adjusted nor calendar adjusted|not seasonally adjusted|unadjusted)$/.test(
            label,
          ),
        ),
      ];
    } else if (id === "TRANSFORMATION") {
      roles.transformation = id;
      // Several globally valid level codes can exist. Availability, not
      // codelist order, chooses the one actually reported for Korea.
      selected[id] = Object.entries(labels[id]!)
        .filter(
          ([code, label]) =>
            /^[A-Za-z0-9_-]{1,80}$/.test(code) &&
            /^(?:not applicable|not transformed|non[- ]transformed(?: data)?|untransformed|level|levels|no transformation)$/.test(
              normalize(label),
            ),
        )
        .map(([code]) => code);
      if (!selected[id]!.length) fail("METADATA_TRANSFORMATION_LEVEL_UNVERIFIED", ids);
    } else if (id === "MEASURE")
      selected[id] = [
        choose((_code, label) =>
          /^(?:international (?:merchandise )?trade statistics(?: measured in (?:billions|millions|thousands) of (?:us|u\.s\.) dollars \(usd\))?|value(?: of (?:goods|merchandise)(?: trade)?)?|trade value|merchandise trade|goods)$/.test(
            label,
          ),
        ),
      ];
    else fail("METADATA_UNSUPPORTED_DIMENSION", ids);
  }
  if (
    ![
      roles.area,
      roles.flow,
      roles.frequency,
      roles.units,
      roles.adjustment,
      roles.transformation,
    ].every(Boolean)
  )
    fail("METADATA_REQUIRED_DIMENSION", ids);
  return {
    key: ids.map((id) => selected[id]!.join("+")).join("."),
    dimensions: ids,
    selected,
    labels,
    roles,
    flowCodes: { exports: exportsCode, imports: importsCode },
  };
}

/** SDMX-REST 1.5 availableconstraint returns actual values, not the global DSD domain.
 * https://github.com/sdmx-twg/sdmx-rest/blob/v1.5.0/v2_1/ws/rest/docs/4_6_1_other_queries.md
 */
export function parseOecdTradeAvailability(
  xml: string,
  profile: OecdTradeProfile,
): OecdTradeProfile {
  const fail = (reason: string, id?: string, codes: string[] = []): never => {
    const hints = id
      ? codes.slice(0, 5).map((code) => `${id} ${code}: ${profile.labels[id]?.[code] ?? ""}`)
      : [];
    throw new OecdFailure(reason, "unverified", profile.dimensions, hints, "AVAILABILITY");
  };
  if (
    xml.length > BODY_LIMIT ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    fail("INVALID_AVAILABILITY");
  let payload: unknown;
  try {
    payload = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      parseTagValue: false,
      parseAttributeValue: false,
      processEntities: false,
    }).parse(xml);
  } catch {
    fail("INVALID_AVAILABILITY");
  }
  const constraints = nodes(payload, "ContentConstraint").filter((constraint) => {
    const refs = nodes(constraint.ConstraintAttachment, "Ref");
    return refs.some(
      (ref) =>
        ref["@_agencyID"] === "OECD.SDD.TPS" &&
        ref["@_id"] === "DSD_IMTS@DF_IMTS" &&
        ref["@_version"] === "1.0",
    );
  });
  if (constraints.length !== 1) fail("AVAILABILITY_DATAFLOW_IDENTITY");
  if (constraints[0]!["@_type"] && constraints[0]!["@_type"] !== "Actual")
    fail("AVAILABILITY_NOT_ACTUAL");
  const regions = nodes(constraints[0], "CubeRegion");
  if (
    !regions.length ||
    regions.some((region) => region["@_include"] === "false" || region["@_include"] === false)
  )
    fail("AVAILABILITY_REGION_UNVERIFIED");
  const available: Record<string, Set<string>> = Object.fromEntries(
    profile.dimensions.map((id) => [id, new Set<string>()]),
  );
  for (const region of regions) {
    const pairs = nodes(region, "KeyValue");
    for (const id of profile.dimensions) {
      const matches = pairs.filter((pair) => pair["@_id"] === id);
      if (matches.length !== 1) fail("AVAILABILITY_INCOMPLETE_DIMENSIONS");
      const values = array(matches[0]!.Value).map((value) =>
        typeof value === "string" ? value.trim() : String(record(value)?.["#text"] ?? "").trim(),
      );
      if (!values.length || values.some((code) => !Object.hasOwn(profile.labels[id]!, code)))
        fail("AVAILABILITY_UNKNOWN_CODE", id, values);
      for (const code of values) available[id]!.add(code);
    }
  }
  const resolved = structuredClone(profile);
  for (const id of profile.dimensions) {
    const codes = [...available[id]!];
    if (id !== profile.roles.partner && id !== profile.roles.transformation) {
      if (
        profile.selected[id]!.some((code) => !available[id]!.has(code)) ||
        codes.some((code) => !profile.selected[id]!.includes(code))
      )
        fail("AVAILABILITY_SELECTION_MISMATCH", id, codes);
      continue;
    }
    const candidates = codes.filter((code) => {
      const label = normalize(profile.labels[id]![code]!);
      return id === profile.roles.partner
        ? /^(?:world|total world|all countries|not applicable)$/.test(label)
        : /^(?:not applicable|not transformed|non[- ]transformed(?: data)?|untransformed|level|levels|no transformation)$/.test(
            label,
          );
    });
    if (candidates.length !== 1)
      fail(`AVAILABILITY_AMBIGUOUS_${id}_MATCHES_${Math.min(candidates.length, 99)}`, id, codes);
    resolved.selected[id] = candidates;
  }
  resolved.key = resolved.dimensions.map((id) => resolved.selected[id]!.join("+")).join(".");
  return resolved;
}
function isFlowId(raw: string): boolean {
  return /^OECD\.SDD\.TPS(?::DSD_IMTS@DF_IMTS\(1\.0\)|,DSD_IMTS@DF_IMTS,1\.0)$/.test(raw);
}

/** Validate labelled OECD IMTS records before accepting their nominal USD amounts. */
export function parseOecdTradeCsv(
  csv: string,
  now = new Date(),
  profile?: OecdTradeProfile,
): ParsedTrade {
  if (csv.length > BODY_LIMIT) throw new OecdFailure("BODY_LIMIT", "unverified");
  let table: string[][];
  try {
    table = parseCsv(csv);
  } catch {
    throw new OecdFailure("INVALID_CSV", "unverified");
  }
  const header = table[0]?.map((value) => value.replace(/^\uFEFF/, "").trim()) ?? [];
  const diagnostic = header.filter((value) => /^[A-Z][A-Z0-9_]{1,50}$/.test(value)).slice(0, 22);
  const fail = (reason: string): never => {
    throw new OecdFailure(reason, "unverified", diagnostic);
  };
  if (new Set(header).size !== header.length) fail("AMBIGUOUS_COLUMNS");
  const column = (names: string[]): number => header.findIndex((value) => names.includes(value));
  const fields = {
    flowId: column(["STRUCTURE_ID", "DATAFLOW"]),
    area: column([profile?.roles.area ?? "REF_AREA"]),
    partner: column([profile?.roles.partner ?? "COUNTERPART_AREA"]),
    flow: column([profile?.roles.flow ?? "TRADE_FLOW"]),
    commodity: column([profile?.roles.commodity ?? "COMMODITY"]),
    frequency: column([profile?.roles.frequency ?? "FREQ"]),
    units: column([profile?.roles.units ?? "UNIT_MEASURE"]),
    multiplier: column(["UNIT_MULT"]),
    adjustment: column([profile?.roles.adjustment ?? "ADJUSTMENT"]),
    transformation: column([profile?.roles.transformation ?? "TRANSFORMATION"]),
    period: column(["TIME_PERIOD"]),
    amount: column(["OBS_VALUE"]),
    flowLabel: column(["Trade flow", "Trade flows"]),
    unitLabel: column(["Unit of measure"]),
    adjustmentLabel: column(["Adjustment"]),
    transformationLabel: column(["Transformation"]),
  };
  if (
    Object.entries(fields).some(
      ([field, index]) =>
        index < 0 &&
        !(
          profile &&
          (field.endsWith("Label") ||
            (field === "partner" && !profile.roles.partner) ||
            (field === "commodity" && !profile.roles.commodity))
        ),
    )
  )
    fail("UNVERIFIED_SCHEMA");
  const allowedCodes = new Set([
    "STRUCTURE",
    "STRUCTURE_ID",
    "STRUCTURE_NAME",
    "DATAFLOW",
    "ACTION",
    "REF_AREA",
    "COUNTERPART_AREA",
    "TRADE_FLOW",
    "COMMODITY",
    "FREQ",
    "UNIT_MEASURE",
    "UNIT_MULT",
    "ADJUSTMENT",
    "TRANSFORMATION",
    "TIME_PERIOD",
    "OBS_VALUE",
    "OBS_STATUS",
    "CONF_STATUS",
    "DECIMALS",
    "BASE_PER",
    "COMMENT_OBS",
    "COMMENT_TS",
  ]);
  for (const id of profile?.dimensions ?? []) {
    allowedCodes.add(id);
    if (!header.includes(id)) fail("UNVERIFIED_SCHEMA");
  }
  if (header.some((value) => /^[A-Z][A-Z0-9_]+$/.test(value) && !allowedCodes.has(value)))
    fail("UNKNOWN_DIMENSION");
  const statusColumn = column(["OBS_STATUS"]);
  if (statusColumn < 0) fail("OBS_STATUS_UNVERIFIED");
  const byFlow = { X: new Map<string, number>(), M: new Map<string, number>() };
  const conflicts = { X: new Set<string>(), M: new Set<string>() };
  const issues = { X: new Set<string>(), M: new Set<string>() };
  let provisional = false;
  for (const cells of table.slice(1)) {
    if (!cells.some((value) => value.trim())) continue;
    if (cells.length !== header.length) fail("INCOMPLETE_RECORD");
    const get = (key: keyof typeof fields) => cells[fields[key]]?.trim() ?? "";
    if (!isFlowId(get("flowId"))) fail("WRONG_DATAFLOW");
    // Query wildcards are never treated as evidence of national/world totals.
    if (
      profile
        ? profile.dimensions.some(
            (id) => !profile.selected[id]!.includes(cells[header.indexOf(id)]?.trim() ?? ""),
          )
        : get("area") !== "KOR" ||
          !["W", "WLD"].includes(get("partner")) ||
          !["_T", "TOTAL"].includes(get("commodity"))
    )
      continue;
    const rawFlow = get("flow");
    const flow = profile
      ? rawFlow === profile.flowCodes.exports
        ? "X"
        : rawFlow === profile.flowCodes.imports
          ? "M"
          : ""
      : rawFlow;
    if (flow !== "X" && flow !== "M") continue;
    if (
      !profile &&
      (get("frequency") !== "M" || get("units") !== "USD_EXC" || get("adjustment") !== "N")
    )
      continue;
    const label = (
      field: "flow" | "units" | "adjustment" | "transformation",
      fallback: "flowLabel" | "unitLabel" | "adjustmentLabel" | "transformationLabel",
    ) =>
      normalize(
        get(fallback) ||
          (profile ? (profile.labels[profile.roles[field]]?.[get(field)] ?? "") : ""),
      );
    const flowName = label("flow", "flowLabel"),
      units = label("units", "unitLabel");
    const adjustment = label("adjustment", "adjustmentLabel"),
      transformation = label("transformation", "transformationLabel");
    if (
      !(
        flow === "X"
          ? /^(?:exports|exports of goods|exports \(fob\))$/
          : /^(?:imports|imports of goods|imports \(cif\))$/
      ).test(flowName)
    )
      fail("FLOW_LABEL_MISMATCH");
    if (
      !/^(?:(?:thousands|millions|billions) of )?(?:us|u\.s\.|united states) dollars(?:,? exchange rate converted)?$/.test(
        units,
      )
    )
      fail("USD_LABEL_UNVERIFIED");
    if (
      !/^(?:neither seasonally adjusted nor calendar adjusted|not seasonally adjusted|unadjusted)$/.test(
        adjustment,
      )
    )
      fail("ADJUSTMENT_LABEL_UNVERIFIED");
    if (
      (!profile && !["_Z", "N", "_T"].includes(get("transformation"))) ||
      !/^(?:not applicable|not transformed|non[- ]transformed(?: data)?|untransformed|level|levels|no transformation)$/.test(
        transformation,
      )
    )
      continue;
    const rawMultiplier = get("multiplier");
    if (!/^(?:0|3|6|9)$/.test(rawMultiplier)) fail("USD_SCALE_UNVERIFIED");
    const multiplier = Number(rawMultiplier);
    if (
      (units.startsWith("thousands") && multiplier !== 3) ||
      (units.startsWith("millions") && multiplier !== 6) ||
      (units.startsWith("billions") && multiplier !== 9)
    )
      fail("USD_SCALE_MISMATCH");
    const period = get("period");
    if (!/^(?:19[6-9]\d|20\d\d)-(?:0[1-9]|1[0-2])$/.test(period) || period >= koreaMonth(now))
      continue;
    // SDMX F (forecast), M (missing) and unrecognized status codes cannot
    // become observed trade, even when a numeric value was supplied.
    const observationStatus = cells[statusColumn]?.trim().toUpperCase();
    if (!["A", "P", "E"].includes(observationStatus ?? "")) {
      issues[flow].add("OBS_STATUS_UNVERIFIED");
      continue;
    }
    const amount = decimal(get("amount"));
    if (amount == null) {
      issues[flow].add("INVALID_OBSERVATION");
      continue;
    }
    const valueUsd = amount * 10 ** multiplier;
    if (!Number.isFinite(valueUsd)) continue;
    if (byFlow[flow].has(period) && byFlow[flow].get(period) !== valueUsd)
      conflicts[flow].add(period);
    else byFlow[flow].set(period, valueUsd);
    if (/^(?:P|E)$/.test(observationStatus!)) provisional = true;
  }
  const points = (flow: "X" | "M"): FredPoint[] =>
    [...byFlow[flow]]
      .filter(([period]) => !conflicts[flow].has(period))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, valueUsd]) => ({ period, valueUsd }));
  for (const flow of ["X", "M"] as const)
    if (conflicts[flow].size) issues[flow].add("CONFLICTING_OBSERVATIONS");
  return {
    exports: points("X"),
    imports: points("M"),
    provisional,
    issues: { exports: [...issues.X], imports: [...issues.M] },
  };
}

export function createOecdTradeClient(
  options: { fetch?: typeof fetch; now?: () => Date; timeoutMs?: number } = {},
) {
  const fetcher = options.fetch ?? fetch,
    now = options.now ?? (() => new Date());
  let cached: { data: ParsedTrade; at: number; checkedAt: string } | null = null;
  let metadata: { profile: OecdTradeProfile; at: number } | null = null;
  let result: { data: OecdTradeResult; until: number } | null = null;
  let pending: Promise<OecdTradeResult> | null = null;
  function bundle(
    data: ParsedTrade,
    checkedAt: string,
    overallFailure?: OecdFailure,
  ): OecdTradeResult {
    return {
      exports: data.exports,
      imports: data.imports,
      source: SOURCE,
      providers: (["exports", "imports"] as const).map((kind) => {
        const failure = overallFailure ?? data.failures?.[kind];
        const points = data[kind],
          asOf = points.at(-1)?.period ?? null;
        const issue = data.issues[kind][0];
        const periodNumber = (period: string) =>
          Number(period.slice(0, 4)) * 12 + Number(period.slice(5));
        const gapped = points.some(
          (point, index) =>
            index > 0 && periodNumber(point.period) - periodNumber(points[index - 1]!.period) !== 1,
        );
        const partial = points.length < 24 || gapped || Boolean(issue);
        const age = asOf
          ? (Number(koreaMonth(now()).slice(0, 4)) - Number(asOf.slice(0, 4))) * 12 +
            Number(koreaMonth(now()).slice(5)) -
            Number(asOf.slice(5))
          : 0;
        return {
          id: `oecd.${kind}`,
          name: `OECD 월별 상품${kind === "exports" ? "수출" : "수입"}`,
          configured: true,
          state: points.length
            ? failure || age > 4
              ? "stale"
              : partial
                ? "partial"
                : "ok"
            : (failure?.state ?? (issue ? "unverified" : "empty")),
          checkedAt,
          asOf,
          recordCount: points.length,
          sourceUrl: SOURCE_URL,
          provisional: data.provisional,
          ...(failure || issue || (points.length && partial)
            ? { reasonCode: failure?.reasonCode ?? issue ?? "INSUFFICIENT_OR_GAPPED_HISTORY" }
            : {}),
          message:
            (failure
              ? points.length
                ? `공식 재조회 실패 · ${cached?.checkedAt ?? ""} 검증본 · 통계 기준월을 확인해 주세요.`
                : failure.state === "unverified"
                  ? `공식 IMTS 응답 검증 실패. 확인되지 않은 수치를 사용하지 않습니다.${failure.columns.length ? ` 응답 열: ${failure.columns.join(", ")}` : ""}${failure.semanticHints.length ? ` 공식 ${failure.hintContext === "PRODUCT_TYPE" ? "PRODUCT_TYPE" : "가용 통계"} 코드 설명: ${failure.semanticHints.join(" / ")}` : ""}`
                  : failure.state === "rate-limited"
                    ? "OECD 요청 한도에 도달했습니다. 자동 재시도 없이 잠시 후 다시 조회합니다."
                    : "OECD 공식 월별 상품무역 통계 연결에 실패했습니다."
              : points.length
                ? `한국/전세계 · 상품 총계 · 월별 명목 USD · 비계절조정${age > 4 ? " · 최신 공표 월 시차 확인 필요" : ""}${partial ? " · 이력이 24개월 미만이거나 누락·검증 제외 월이 있습니다." : ""}`
                : issue
                  ? "관측 상태 또는 원자료 검증에 실패한 월을 제외했습니다. 확인되지 않은 수치를 사용하지 않습니다."
                  : "검증된 완료 월 원자료가 없습니다.") +
            (metadata ? ` · 선택 통계키: ${metadata.profile.key}` : ""),
        } satisfies ExportProviderStatus;
      }),
    };
  }
  async function load(): Promise<OecdTradeResult> {
    const checked = now(),
      controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const readers = new Set<ReadableStreamDefaultReader<Uint8Array>>();
    const current: ParsedTrade = {
      exports: [],
      imports: [],
      provisional: false,
      issues: { exports: [], imports: [] },
      failures: {},
    };
    let sealed = false;
    const abortBody = () => {
      for (const reader of readers) void reader.cancel().catch(() => {});
    };
    controller.signal.addEventListener("abort", abortBody, { once: true });
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new OecdFailure("REQUEST_TIMEOUT"));
      }, options.timeoutMs ?? 12_000);
    });
    const fetchText = async (url: URL | string, accept: string): Promise<string> => {
      const response = await fetcher(url, {
        signal: controller.signal,
        headers: { Accept: accept, "User-Agent": "KoreaExportDesk/3.0" },
      });
      if (!response.ok)
        throw new OecdFailure(
          response.status === 429 ? "RATE_LIMIT" : `HTTP_${response.status}`,
          response.status === 429 ? "rate-limited" : "unavailable",
        );
      if (response.url && new URL(response.url).origin !== "https://sdmx.oecd.org")
        throw new OecdFailure("UNEXPECTED_REDIRECT", "unverified");
      if (Number(response.headers.get("content-length")) > BODY_LIMIT || !response.body)
        throw new OecdFailure("BODY_LIMIT", "unverified");
      const reader = response.body.getReader();
      readers.add(reader);
      const decoder = new TextDecoder();
      let text = "",
        bytes = 0;
      try {
        while (!controller.signal.aborted) {
          const chunk = await reader.read();
          if (controller.signal.aborted) throw new OecdFailure("REQUEST_TIMEOUT");
          if (chunk.done) return text + decoder.decode();
          bytes += chunk.value.byteLength;
          if (bytes > BODY_LIMIT) throw new OecdFailure("BODY_LIMIT", "unverified");
          text += decoder.decode(chunk.value, { stream: true });
        }
        throw new OecdFailure("REQUEST_TIMEOUT");
      } finally {
        readers.delete(reader);
        void reader.cancel().catch(() => {});
        try {
          reader.releaseLock();
        } catch {
          /* An abort may still be settling a read. */
        }
      }
    };
    const request = (async () => {
      // Resolve the dataflow's live dimension order and labelled code values
      // before querying any observations. Never issue an all-partner/basket
      // wildcard or infer a DSD key from a different OECD dataset.
      let profile: OecdTradeProfile;
      if (metadata && checked.getTime() - metadata.at < 86_400_000) profile = metadata.profile;
      else {
        const domain = parseOecdTradeMetadata(
          await fetchText(METADATA_URL, "application/vnd.sdmx.structure+xml;version=2.1"),
        );
        // Availability metadata may inspect counterpart/level options within
        // this one country's fixed merchandise/currency/frequency selection.
        // Observation queries are sent only after every slot is resolved.
        const seed = domain.dimensions
          .map((id) =>
            id === domain.roles.partner || id === domain.roles.transformation
              ? ""
              : domain.selected[id]!.join("+"),
          )
          .join(".");
        const availability = new URL(AVAILABILITY_URL + seed);
        availability.search = new URLSearchParams({
          mode: "exact",
          startPeriod: `${checked.getUTCFullYear() - 12}-01`,
          endPeriod: previousMonth(checked),
        }).toString();
        profile = parseOecdTradeAvailability(
          await fetchText(availability, "application/vnd.sdmx.structure+xml;version=2.1"),
          domain,
        );
      }
      if (controller.signal.aborted) throw new OecdFailure("REQUEST_TIMEOUT");
      metadata = { profile, at: checked.getTime() };
      // Query each verified flow independently. A failed import download does
      // not suppress validated exports, and neither query can exceed the
      // shared metadata/availability/data deadline.
      await Promise.allSettled(
        (["exports", "imports"] as const).map(async (kind) => {
          try {
            const one = structuredClone(profile);
            one.selected[one.roles.flow] = [one.flowCodes[kind]];
            one.key = one.dimensions.map((id) => one.selected[id]!.join("+")).join(".");
            const url = new URL(BASE_URL + one.key);
            url.search = new URLSearchParams({
              format: "csvfilewithlabels",
              dimensionAtObservation: "AllDimensions",
              startPeriod: `${checked.getUTCFullYear() - 12}-01`,
              endPeriod: previousMonth(checked),
            }).toString();
            const parsed = parseOecdTradeCsv(await fetchText(url, "text/csv"), checked, one);
            if (sealed || controller.signal.aborted) throw new OecdFailure("REQUEST_TIMEOUT");
            if (!parsed[kind].length)
              throw new OecdFailure(
                parsed.issues[kind][0] ?? "NO_VERIFIED_MONTHS",
                parsed.issues[kind].length ? "unverified" : "empty",
              );
            current[kind] = parsed[kind];
            current.issues[kind] = parsed.issues[kind];
            current.provisional ||= parsed.provisional;
          } catch (error) {
            if (!sealed)
              current.failures![kind] =
                error instanceof OecdFailure ? error : new OecdFailure("TRANSPORT_ERROR");
          }
        }),
      );
      return current;
    })();
    try {
      const data = await Promise.race([request, deadline]);
      if (
        !data.exports.length &&
        !data.imports.length &&
        cached &&
        checked.getTime() - cached.at <= STALE_MS
      ) {
        throw (
          data.failures?.exports ??
          data.failures?.imports ??
          new OecdFailure("NO_VERIFIED_MONTHS", "empty")
        );
      }
      if (
        !data.exports.length &&
        !data.imports.length &&
        !Object.keys(data.failures ?? {}).length
      ) {
        const issue = data.issues.exports[0] ?? data.issues.imports[0];
        throw new OecdFailure(issue ?? "NO_VERIFIED_MONTHS", issue ? "unverified" : "empty");
      }
      if (data.exports.length || data.imports.length)
        cached = { data, at: checked.getTime(), checkedAt: checked.toISOString() };
      const output = bundle(data, checked.toISOString());
      result = {
        data: output,
        until:
          checked.getTime() + (Object.keys(data.failures ?? {}).length ? FAILURE_MS : FRESH_MS),
      };
      return output;
    } catch (error) {
      const failure = error instanceof OecdFailure ? error : new OecdFailure("TRANSPORT_ERROR");
      if (current.exports.length || current.imports.length) {
        for (const kind of ["exports", "imports"] as const)
          if (!current[kind].length) current.failures![kind] = failure;
        cached = { data: current, at: checked.getTime(), checkedAt: checked.toISOString() };
        const output = bundle(current, checked.toISOString());
        result = { data: output, until: checked.getTime() + FAILURE_MS };
        return output;
      }
      const data =
        cached && checked.getTime() - cached.at <= STALE_MS
          ? cached.data
          : { exports: [], imports: [], provisional: false, issues: { exports: [], imports: [] } };
      const output = bundle(data, checked.toISOString(), failure);
      result = { data: output, until: checked.getTime() + FAILURE_MS };
      return output;
    } finally {
      sealed = true;
      if (timer) clearTimeout(timer);
      controller.abort();
      controller.signal.removeEventListener("abort", abortBody);
    }
  }
  return {
    async fetchOecdTrade(): Promise<OecdTradeResult> {
      if (result && now().getTime() < result.until) return structuredClone(result.data);
      if (!pending)
        pending = load().finally(() => {
          pending = null;
        });
      return structuredClone(await pending);
    },
  };
}
export const fetchOecdTrade = createOecdTradeClient().fetchOecdTrade;
