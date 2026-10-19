import assert from "node:assert/strict";
import { test } from "node:test";
import { pickHoldingSearchItem, type HoldingSearchItem } from "./etf-holding-identity.ts";

const micron: HoldingSearchItem = {
  name: "Micron Technology Inc",
  code: "MU",
  reutersCode: "MU.O",
  nationCode: "USA",
  isEtf: false,
};

test("holding autocomplete never substitutes the first US or Korean company", () => {
  const wrong = [
    { name: "마이크로닉스", code: "999999", nationCode: "KOR" },
    { ...micron, name: "Microchip Technology Inc", reutersCode: "MCHP.O" },
  ];
  assert.equal(pickHoldingSearchItem("Micron Technology Inc", wrong), null);
  assert.equal(pickHoldingSearchItem("Micron Technology Inc", [...wrong, micron]), micron);
});

test("full normalized identities accept legal suffixes and formatting only", () => {
  for (const name of ["MICRON TECHNOLOGY", "Micron Technology, Inc.", "Micron Technology Incorporated"]) {
    assert.equal(pickHoldingSearchItem(name, [micron]), micron);
  }
  assert.equal(pickHoldingSearchItem("Micron", [micron]), null);
  assert.equal(pickHoldingSearchItem("Micron Technology Holdings", [micron]), null);
  assert.equal(pickHoldingSearchItem("Micron Technology ETF", [micron]), null);
});

test("a foreign ISIN cannot resolve to a Korean ticker with the same company name", () => {
  const korean = { ...micron, code: "999999", reutersCode: undefined, nationCode: "KOR" };
  assert.equal(pickHoldingSearchItem(micron.name!, [korean], { isin: "US5951121038" }), null);
  assert.equal(pickHoldingSearchItem(micron.name!, [korean, micron], { isin: "US5951121038" }), micron);
  assert.equal(pickHoldingSearchItem(micron.name!, [micron], { isin: "KR7005930003" }), null);
});

test("ambiguous listings never resolve by autocomplete order", () => {
  const alternate = { ...micron, reutersCode: "MU.N" };
  assert.equal(pickHoldingSearchItem(micron.name!, [micron, alternate]), null);
  assert.equal(pickHoldingSearchItem(micron.name!, [alternate, micron]), null);
  assert.ok(pickHoldingSearchItem(micron.name!, [micron, { ...micron }]));
});

test("share-class suffixes must match both company identity and class", () => {
  const wrongCompany = { ...micron, name: "Berkshire Hathaway Inc Class A", reutersCode: "BRKa.N" };
  const alphabetA = { ...micron, name: "Alphabet Inc. Class A Common Stock", reutersCode: "GOOGL.O" };
  const alphabetC = { ...micron, name: "Alphabet Inc Class C", reutersCode: "GOOG.O" };
  assert.equal(pickHoldingSearchItem("Alphabet Inc-CL A", [wrongCompany, alphabetC, alphabetA]), alphabetA);
  assert.equal(pickHoldingSearchItem("Alphabet Inc-CL A", [wrongCompany, alphabetC]), null);
  assert.equal(pickHoldingSearchItem("Alphabet Inc", [alphabetA, alphabetC]), null);
  assert.equal(pickHoldingSearchItem("Alphabet Inc Class A", [{ ...alphabetA, name: "Alphabet Inc" }]), null);
});

test("preferred shares and depositary receipts retain separate identities", () => {
  const ordinary = { ...micron, name: "Example Corporation" };
  const preferred = { ...micron, name: "Example Corporation Preferred", reutersCode: "EXp.N" };
  const adr = { ...micron, name: "Example Corporation ADR", reutersCode: "EX.O" };
  assert.equal(pickHoldingSearchItem("Example Corp", [preferred, adr]), null);
  assert.equal(pickHoldingSearchItem("Example Corp", [preferred, adr, ordinary]), ordinary);
});

test("English to Korean translation requires exact provider ISIN evidence", () => {
  const translated = { ...micron, name: "마이크론 테크놀로지" };
  assert.equal(pickHoldingSearchItem("MICRON TECHNOLOGY INC", [translated], { isin: "US5951121038" }), null);
  const identified = { ...translated, isin: "US5951121038" };
  assert.equal(pickHoldingSearchItem("MICRON TECHNOLOGY INC", [identified], { isin: "US5951121038" }), identified);
  assert.equal(pickHoldingSearchItem("MICRON TECHNOLOGY INC", [{ ...micron, isin: "US0378331005" }], { isin: "US5951121038" }), null);
});

test("Korean names match spacing but never an unrelated same-prefix result", () => {
  const correct = { name: "삼성전자", code: "005930", nationCode: "KOR" };
  const wrong = { name: "삼성전자우", code: "005935", nationCode: "KOR" };
  assert.equal(pickHoldingSearchItem("삼성 전자", [wrong, correct]), correct);
  assert.equal(pickHoldingSearchItem("삼성전자", [wrong]), null);
});

test("ISIN domicile does not force Irish US-listed stocks into Ireland", () => {
  const seagate = { ...micron, name: "Seagate Technology Holdings PLC", reutersCode: "STX.O" };
  assert.equal(pickHoldingSearchItem("SEAGATE TECHNOLOGY HOLDINGS", [seagate], { isin: "IE00BKVD2N49" }), seagate);
});

test("published US symbols identify translated names without guessing an exchange suffix", () => {
  const alphabetA = { ...micron, name: "알파벳 A", code: "GOOGL", reutersCode: "GOOGL.O" };
  const alphabetC = { ...micron, name: "알파벳 C", code: "GOOG", reutersCode: "GOOG.O" };
  const berkshireB = { ...micron, name: "버크셔 해서웨이 B", code: "BRK.B", reutersCode: "BRKb.N" };
  assert.equal(pickHoldingSearchItem("ALPHABET INC CL A", [alphabetC, alphabetA], { foreignTicker: "GOOGL", nation: "USA" }), alphabetA);
  assert.equal(pickHoldingSearchItem("ALPHABET INC CL C", [alphabetA, alphabetC], { foreignTicker: "GOOG", nation: "USA" }), alphabetC);
  for (const foreignTicker of ["BRK/B", "BRK.B", "BRK-B"]) {
    assert.equal(pickHoldingSearchItem("BERKSHIRE HATHAWAY INC CL B", [berkshireB], { foreignTicker }), berkshireB);
  }
});

test("a published symbol rejects wrong share classes and conflicting quote identifiers", () => {
  const alphabet = { ...micron, name: "Alphabet Inc Class A", code: "GOOGL", reutersCode: "GOOGL.O" };
  assert.equal(pickHoldingSearchItem(alphabet.name, [alphabet], { foreignTicker: "GOOG" }), null);
  assert.equal(pickHoldingSearchItem(alphabet.name, [{ ...alphabet, reutersCode: "GOOG.O" }], { foreignTicker: "GOOGL" }), null);
  assert.equal(pickHoldingSearchItem(alphabet.name, [{ ...alphabet, nationCode: "KOR", code: "999999" }], { foreignTicker: "GOOGL" }), null);
  assert.equal(pickHoldingSearchItem(alphabet.name, [alphabet], { foreignTicker: "GOOGL US Equity" }), null);
});

test("explicit ticker, market and ETF hints constrain otherwise identical names", () => {
  const koreanEtf = { name: "Example", code: "999999", nationCode: "KOR", isEtf: true };
  const koreanStock = { name: "Example", code: "999998", nationCode: "KOR", isEtf: false };
  const foreignStock = { ...micron, name: "Example" };
  assert.equal(pickHoldingSearchItem("Example", [koreanEtf, koreanStock, foreignStock], { code: "999998", isEtf: false }), koreanStock);
  assert.equal(pickHoldingSearchItem("Example", [koreanEtf, koreanStock, foreignStock], { nation: "US" }), foreignStock);
  assert.equal(pickHoldingSearchItem("Example", [koreanEtf, koreanStock], { isEtf: true }), koreanEtf);
});

test("invalid identities do not create a quote mapping", () => {
  assert.equal(pickHoldingSearchItem("", [micron]), null);
  assert.equal(pickHoldingSearchItem(micron.name!, [micron], { isin: "not-an-isin" }), null);
  assert.equal(pickHoldingSearchItem(micron.name!, [{ ...micron, nationCode: undefined }]), null);
  assert.equal(pickHoldingSearchItem(micron.name!, [{ ...micron, code: undefined, reutersCode: undefined }]), null);
  assert.equal(pickHoldingSearchItem(micron.name!, [{ ...micron, reutersCode: "https://attacker.example" }]), null);
});
