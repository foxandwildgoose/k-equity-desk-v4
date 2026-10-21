export function resolveRegionalCapability(
  geo: string,
  classification: string,
  cfg?: {
    forbiddenCombos?: { geo: string; classification: string; reason: string }[];
    levels?: { id: string; available?: boolean; reason?: string; classifications?: string[] }[];
  },
): { available: boolean; reason?: string } {
  const family = (value: string) =>
    /^HSK-?10$/.test(value) ? "HSK" : /^HS[246]$/.test(value) ? "HS" : value;
  if (!["HS", "HSK", "MTI"].includes(family(classification))) {
    return { available: false, reason: "검증된 품목 분류가 아닙니다." };
  }
  const forbidden = (cfg?.forbiddenCombos ?? []).find(
    (f) =>
      f.geo === geo &&
      (f.classification === classification ||
        (family(f.classification) === "HSK" && family(classification) === "HSK")),
  );
  if (forbidden) return { available: false, reason: forbidden.reason };
  const level = (cfg?.levels ?? []).find((l) => l.id === geo);
  if (level && level.available === false) {
    return { available: false, reason: level.reason };
  }
  if (cfg?.levels && !level) {
    return { available: false, reason: "선택한 지역 단위의 공식 제공 범위가 설정되지 않았습니다." };
  }
  if (
    level?.classifications &&
    !level.classifications.some((value) => family(value) === family(classification))
  ) {
    return {
      available: false,
      reason: "이 지역 단위는 선택한 품목 분류의 제공 범위에 포함되지 않습니다.",
    };
  }
  if (!cfg && geo === "SIGUNGU" && family(classification) === "HSK") {
    return {
      available: false,
      reason: "시군구 × HSK-10 공식 시계열이 없습니다. 숫자를 합성하지 않습니다.",
    };
  }
  return { available: true };
}
