/**
 * Robotics universe config (F6.1) — DATA ONLY.
 *
 * - KR seed codes come from the spec and are re-verified at runtime (rows that
 *   do not resolve to a live quote are hidden and listed in Source Health).
 * - KR candidates are resolved BY NAME through the security search at runtime;
 *   no unverified codes are hard-coded here.
 * - Exposure names are not pure-plays (`exposure: "indirect"`).
 * - US seed symbols are verified through the Yahoo chart endpoint at runtime.
 * - Segment/exposure tags are descriptive classifications, not market data.
 */

export type RoboticsSegment =
  | "humanoid"
  | "cobot"
  | "industrial"
  | "logistics-amr"
  | "service"
  | "medical"
  | "components-actuator-reducer"
  | "sensors-vision"
  | "software-ai";

export type RoboticsExposure = "pure-play" | "significant" | "indirect";

export interface RoboticsEntry {
  name: string;
  nameEn?: string;
  /** KR 6-char code or US symbol. Absent → resolve by name at runtime. */
  code?: string;
  market: "KR" | "US";
  segment: RoboticsSegment;
  exposure: RoboticsExposure;
  /** seed = spec-provided code; candidate = resolve by name; private = news only */
  kind: "seed" | "candidate" | "exposure" | "private";
}

export const SEGMENT_LABEL: Record<RoboticsSegment, string> = {
  humanoid: "휴머노이드",
  cobot: "협동로봇",
  industrial: "산업용",
  "logistics-amr": "물류·AMR",
  service: "서비스",
  medical: "의료",
  "components-actuator-reducer": "부품(감속기·액추에이터)",
  "sensors-vision": "센서·비전",
  "software-ai": "SW·AI",
};

export const EXPOSURE_LABEL: Record<RoboticsExposure, string> = {
  "pure-play": "순수 로봇",
  significant: "비중 큼",
  indirect: "간접 노출",
};

export const ROBOTICS_KR: RoboticsEntry[] = [
  { name: "레인보우로보틱스", nameEn: "Rainbow Robotics", code: "277810", market: "KR", segment: "humanoid", exposure: "pure-play", kind: "seed" },
  { name: "두산로보틱스", nameEn: "Doosan Robotics", code: "454910", market: "KR", segment: "cobot", exposure: "pure-play", kind: "seed" },
  { name: "로보티즈", nameEn: "Robotis", code: "108490", market: "KR", segment: "components-actuator-reducer", exposure: "pure-play", kind: "seed" },
  { name: "로보스타", nameEn: "Robostar", code: "090360", market: "KR", segment: "industrial", exposure: "pure-play", kind: "seed" },
  { name: "클로봇", nameEn: "CLOBOT", code: "466100", market: "KR", segment: "software-ai", exposure: "pure-play", kind: "seed" },
  { name: "에스피지", nameEn: "SPG", code: "058610", market: "KR", segment: "components-actuator-reducer", exposure: "significant", kind: "seed" },
  { name: "유일로보틱스", market: "KR", segment: "industrial", exposure: "pure-play", kind: "candidate" },
  { name: "뉴로메카", market: "KR", segment: "cobot", exposure: "pure-play", kind: "candidate" },
  { name: "티로보틱스", market: "KR", segment: "logistics-amr", exposure: "pure-play", kind: "candidate" },
  { name: "에브리봇", market: "KR", segment: "service", exposure: "pure-play", kind: "candidate" },
  { name: "엔젤로보틱스", market: "KR", segment: "medical", exposure: "pure-play", kind: "candidate" },
  { name: "휴림로봇", market: "KR", segment: "industrial", exposure: "pure-play", kind: "candidate" },
  { name: "하이젠알앤엠", market: "KR", segment: "components-actuator-reducer", exposure: "significant", kind: "candidate" },
  { name: "알에스오토메이션", market: "KR", segment: "components-actuator-reducer", exposure: "significant", kind: "candidate" },
  { name: "삼익THK", market: "KR", segment: "components-actuator-reducer", exposure: "significant", kind: "candidate" },
  { name: "에스비비테크", market: "KR", segment: "components-actuator-reducer", exposure: "significant", kind: "candidate" },
  { name: "현대무벡스", market: "KR", segment: "logistics-amr", exposure: "significant", kind: "candidate" },
  { name: "브이원텍", market: "KR", segment: "sensors-vision", exposure: "significant", kind: "candidate" },
  { name: "삼성전자", market: "KR", segment: "humanoid", exposure: "indirect", kind: "exposure" },
  { name: "LG전자", market: "KR", segment: "service", exposure: "indirect", kind: "exposure" },
  { name: "현대차", market: "KR", segment: "humanoid", exposure: "indirect", kind: "exposure" },
  { name: "현대모비스", market: "KR", segment: "components-actuator-reducer", exposure: "indirect", kind: "exposure" },
  { name: "두산", market: "KR", segment: "cobot", exposure: "indirect", kind: "exposure" },
  { name: "한화", market: "KR", segment: "industrial", exposure: "indirect", kind: "exposure" },
];

export const ROBOTICS_US: RoboticsEntry[] = [
  { name: "Tesla", code: "TSLA", market: "US", segment: "humanoid", exposure: "indirect", kind: "seed" },
  { name: "NVIDIA", code: "NVDA", market: "US", segment: "software-ai", exposure: "indirect", kind: "seed" },
  { name: "Intuitive Surgical", code: "ISRG", market: "US", segment: "medical", exposure: "pure-play", kind: "seed" },
  { name: "Symbotic", code: "SYM", market: "US", segment: "logistics-amr", exposure: "pure-play", kind: "seed" },
  { name: "Teradyne", code: "TER", market: "US", segment: "cobot", exposure: "significant", kind: "seed" },
  { name: "Rockwell Automation", code: "ROK", market: "US", segment: "industrial", exposure: "significant", kind: "seed" },
  { name: "Zebra Technologies", code: "ZBRA", market: "US", segment: "logistics-amr", exposure: "significant", kind: "seed" },
  { name: "Cognex", code: "CGNX", market: "US", segment: "sensors-vision", exposure: "significant", kind: "seed" },
  { name: "PROCEPT BioRobotics", code: "PRCT", market: "US", segment: "medical", exposure: "pure-play", kind: "seed" },
  { name: "Serve Robotics", code: "SERV", market: "US", segment: "service", exposure: "pure-play", kind: "seed" },
  { name: "Richtech Robotics", code: "RR", market: "US", segment: "service", exposure: "pure-play", kind: "seed" },
  { name: "Knightscope", code: "KSCP", market: "US", segment: "service", exposure: "pure-play", kind: "seed" },
  { name: "Fanuc (ADR)", code: "FANUY", market: "US", segment: "industrial", exposure: "pure-play", kind: "seed" },
  { name: "Yaskawa (ADR)", code: "YASKY", market: "US", segment: "industrial", exposure: "significant", kind: "seed" },
  { name: "ABB (ADR)", code: "ABBNY", market: "US", segment: "industrial", exposure: "significant", kind: "seed" },
];

export const ROBOTICS_PRIVATE: RoboticsEntry[] = [
  { name: "Figure AI", market: "US", segment: "humanoid", exposure: "pure-play", kind: "private" },
  { name: "Agility Robotics", market: "US", segment: "humanoid", exposure: "pure-play", kind: "private" },
  { name: "Apptronik", market: "US", segment: "humanoid", exposure: "pure-play", kind: "private" },
  { name: "1X", market: "US", segment: "humanoid", exposure: "pure-play", kind: "private" },
  { name: "Boston Dynamics", nameEn: "Boston Dynamics (Hyundai group)", market: "US", segment: "humanoid", exposure: "pure-play", kind: "private" },
];

/** US robot ETF seed (verify via Yahoo at runtime; hide if unresolved). */
export const ROBOTICS_US_ETFS = ["BOTZ", "ROBO", "ARKQ", "KOID", "HUMN", "BOTT"];

/** KR robot/humanoid ETF discovery regex over the live ETF list (F6.6). */
export const ROBOT_ETF_NAME_RE = /로봇|휴머노이드|로보틱스|robot|humanoid/i;

export const ROBOTICS_US_SYMBOLS = ROBOTICS_US.map((e) => e.code!);
