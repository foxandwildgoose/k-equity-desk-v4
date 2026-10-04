# 차트 표시 제어·HTS 매물대 가독성 검증

확인일: 2026-10-04 (Asia/Seoul). 기준 커밋: `7cbb1500072f994f451cae92a7f15feadebb6787`. 구현 커밋: `745dbe668d58936b61be94a7b1f2259483992ed9`. 검토 브랜치: `codex/chart-display-readability` (현재 작업 브랜치 `work`에서 게시).

## 확인한 원인과 확인하지 않은 조건

- 기존 `ked:vp:v1`의 thin/mid/wide 설정은 10%/14%/18%로 복원된다. `visibleOnly=false`도 전체 기간 집계로 복원된다. 신규 기본값 85%만 바꿔서는 기존 화면이 넓어지지 않는다. 브라우저에서 저장 폭 10%·50구간·전체 기간·자동 주석 ON 상태를 재현했다.
- 기존 마커 생성 경로는 리포트/목표가를 하나의 `research` 토글로 제어하고, 긴 증권사명을 포함한 문구를 개별 마커마다 그렸다. 같은 봉의 다수 항목을 모두 쌓으면 캔들을 가린다.
- 기존 catalog 매물대는 HTS 매물대 OFF일 때 별도의 fallback으로 계속 표시될 수 있었다. 이번에는 공통 매물대 상태 하나로 연결했다.
- 기존 막대의 `구간 수량 / 최대 구간 수량 × plot 폭 × 설정 폭` 수식, 실제 가격 좌표, media 좌표, 캔들 뒤의 fill 레이어는 올바르므로 유지했다.
- 공통 차트 테마 갱신이 최초 `barSpacing`/`rightOffset`을 다시 적용하여 사용자 줌을 바꾸는 문제를 브라우저에서 발견했다. 테마 변경은 색상 관련 옵션만 갱신하도록 수정했다.
- 투명 native canvas를 PNG로 합성하면 Light 화면에 Dark 기본 종이가 사용될 수 있었다. native chart의 배경을 기존 차트 테마 색으로 명시하여 화면과 PNG의 합성 결과를 일치시켰다.
- 페이지의 SSE 갱신이 내용이 같은 이벤트 배열을 다시 만들 때 열린 주석 상세가 닫히는 문제를 재현했다. 정렬된 이벤트의 실제 내용으로 표시 상태의 수명을 관리하여 같은 내용의 갱신은 상세를 유지한다. 종목·분류·리플레이·원본 내용이 달라지면 이전 상세를 닫는다.
- native 전체화면 바깥의 body에 포털된 메뉴/패널은 전체화면에서 보이지 않을 수 있었다. 차트 표시·매물대 설정·지표·그리기·주석 상세의 포털을 실제 전체화면 요소 안에 연결했다.

첨부 문제 화면의 배포 버전과 현재 checkout이 동일한지는 확인하지 않았다. 전체 기간 집계에서 최대 수량 구간이 가격 화면 밖에 있으면 최장 visible 막대가 설정 폭보다 짧아지는 것은 정상이다. 이를 왜곡하여 억지로 85%로 늘리지 않는다. 참고 이미지의 가격·날짜·거래량은 데이터나 fixture에 사용하지 않았다.

## 사용 방법

가격 차트 가까이에 항상 보이는 `차트 표시` 행을 사용한다. 작은 화면과 분할 차트에서도 줄바꿈하며 접근할 수 있다.

- `공시`, `리포트`, `목표가`, `신호` 버튼은 ON/OFF 문자와 `aria-pressed`를 함께 표시한다. 메뉴의 같은 항목과 동일한 상태를 사용한다.
- `차트 표시` 메뉴에서 뉴스, 배당, 분할, 고저점·자동 연결선, 주석 모두 숨김/표시, 기술지표, 그리기 객체 관리에 접근한다.
- `주석 모두 숨김/표시`는 자동 주석과 고저점만 바꾼다. 캔들·기술지표·하위 pane·매물대·수동 그리기는 유지한다.
- `매물대 ON/OFF`는 catalog와 HTS의 공통 상태다. OFF에서 다른 매물대가 다시 나타나지 않는다.
- `매물대 설정`에서 폭 10~90%, 구간 수, 수량/거래대금, 집계 기간, POC/VA, 라벨, 테마 자동/사용자 지정을 선택한다.
- `차트 정리`는 현재 scope에서 자동 주석 OFF, 매물대 ON, 10구간, 폭 85%, 보이는 시간 구간, 거래량 수량, 라벨 ON, POC/VA OFF, 테마 자동을 적용한다. 가격 종류/스케일·줌·그리기·기술지표·하위 pane 높이/접기·투신 누적 기준일은 유지한다.
- `주석 상세` 및 하단 `화면의 주석 묶음`에서 각 원본의 날짜·분류·제목·실제 출처를 확인한다. 실제 URL이 있을 때만 기존 안전한 원문 열기 함수를 사용한다.

## 표시·저장 계약

`overlays.research`는 리포트 발행, `overlays.targets`는 목표가 변경이다. 같은 문서의 두 의미를 별도 항목으로 유지한다. 제목의 TP/히든 등 문자열만으로 분류하지 않는다. 예전 boolean `research` 값은 신규 `targets`가 없는 경우 함께 복원하고, 배당/분할도 같은 방식으로 보존한다. 손상된 boolean은 truthy 값으로 사용하지 않는다.

화면 좌표가 가까운 마커를 위/아래 최대 두 묶음으로 압축하고 원본 배열과 분류별 건수·기간을 보존한다. `createSeriesMarkers(..., { autoScale: false })`를 사용하며, 토글에는 기존 plugin의 `setMarkers()`만 호출한다. 차트를 재생성하거나 `fitContent()`를 호출하지 않는다. OFF는 마커와 hit target을 제거하고 상세/hover 상태도 정리한다.

리플레이는 실제 공표 시각을 확인할 수 없는 자료를 표시하지 않는다. RSI pivot 신호는 실제 오른쪽 5개 확인 봉 이후에만 사용한다. 분봉에 날짜만 제공된 공표 자료를 임의 시각으로 옮기지 않는다. 주/월/년 표시 묶음은 실제 불러온 봉에 맞추되 원래 날짜를 상세에서 유지한다.

신규 사용자에게 자동 주석은 OFF, 매물대는 ON이다. 이전 폭·구간 수·범위·명시적 OFF·사용자 색상은 추측하여 덮어쓰지 않는다. 기존 color/opacity만 있고 `colorMode`가 없으면 사용자 지정으로 보존한다. 저장 scope와 load guard는 유지하며 `localStorage.clear()`는 사용하지 않는다.

테마 자동은 Light `#E6B77C`, opacity 0.32, label `#76552F`; Dark `#D9A15A`, opacity 0.28, label `#E5D2B8`이다. 사용자 지정 fill/opacity는 테마 변경으로 덮어쓰지 않는다. 알파는 fill에 한 번만 적용하며, 12 CSS px 라벨은 별도로 그린다. 실제 0·결측 구간을 거래가 있는 막대처럼 그리지 않는다. 최대 수량·hover 구간 라벨을 우선하고, 겹치는 나머지는 상세표에서 확인한다.

집계는 기존 OHLCV 고저 범위 겹침 배분을 유지하는 추정 매물대다. 가격축 zoom은 집계 수량/구간 경계/전체 대비 비율을 바꾸지 않는다. 시간축 pan은 visible 모드에서만 집계 기간을 바꾼다. 고정/전체 기간은 유지한다. 표시 OFF로 원시 OHLCV·공시·리포트 데이터를 삭제하지 않는다.

## 수정 파일

| 파일 | 목적 |
|---|---|
| `ProChart.tsx`, `ChartDisplayControls.tsx`, `ChartShell.tsx` | 항상 접근 가능한 표시 UI, 공통 상태, 실제 마커·primitive·상세·PNG 연결 |
| `chart-events.ts`, `TradingChart.tsx`, `stock.$ticker.tsx` | 명시적 분류·원본 메타데이터·기간 정렬·묶음·리플레이 시점 제한 |
| `hts-settings.ts`, `persistence.ts`, `HtsSettingsPanel.tsx`, `catalog.ts` | 기본값, 엄격한 복원, 테마 출처, 제한된 차트 정리, 중복 표시 경로 제거 |
| `primitives.ts`, `profile-style.ts`, `profile-labels.ts` | 공통 폭 계산, 테마 fill, 양수 구간 라벨, 캡션 예약 영역 |
| `create-pro-chart.ts`, `sheet.tsx`, `ChartPanels.tsx` | 테마 줌 보존·PNG 종이 일치, fullscreen 내부 팝업 지원 |
| 관련 테스트, `qa-chart-display.mjs`, `qa-chart-hts.mjs` | 결정적 표시·canvas·PNG 검사와 기존 HTS 회귀 검사 |

API 호출/인증/DB/키움 수급 계산 파일은 이번 작업에서 수정하지 않았다. DB 마이그레이션·main 병합·운영 배포는 실행하지 않았다.

## 실행한 검사

Node 22.23.3, lockfile에 설치된 Lightweight Charts 5.2.1, 시스템 Chromium을 사용했다.

```sh
npm test
npm run typecheck
env -u DATABASE_URL node scripts/with-app-env.mjs vite build
npm run lint
```

- 전체 테스트: 570개 통과, 실패/skip 0 (script 206 + TypeScript 364). 기존 PowerShell 테스트에도 실제 PowerShell 7.5.3을 지정하여 실행했다.
- typecheck: 통과.
- 안전한 production bundling: 통과. `npm run build`의 `db:migrate`는 실행하지 않았다.
- 수정 소스의 targeted ESLint: 오류 0, 기존 ProChart cleanup/unused 및 ChartPanels Fast Refresh 관련 경고 6.
- 전체 lint: 오류 1, 경고 60. 기존 `src/lib/app-data/client.server.ts:214`의 빈 catch로 실패. 기준 커밋에도 존재하는 범위 밖 오류이며 테스트를 삭제하거나 lint 기준을 완화하지 않았다.
- 기존 `qa:chart-hts` fixture 검사: 주식 403870/ETF 069500/미국 NVDA × desktop/mobile 6/6 통과.
- 기존 HTS의 가격 알림/주석 상호작용 검사는 이전 메뉴 선택자를 새 공통 분류 버튼으로 갱신하고, 신규 OFF 기본값에 맞게 ON→OFF를 명시했다. 주식 403870/ETF 069500 desktop의 해당 검사 2/2 통과. 기존 HTS 전체 `--interactions` 조합을 모두 실행했다고 주장하지 않는다.

모든 fixture 시세·공시·리포트·수급은 `QA SYNTHETIC (실데이터 아님)`으로 명시하며 서비스 fallback으로 사용하지 않는다.

## 브라우저·canvas·PNG 증거

- 개발 서버와 production build에서 각각 24/24 조합 통과: 한국 주식 005930/ETF 069500/미국 NVDA × desktop 1440×900/mobile 390×844 × Light/Dark × DPR 1/2. 토글 DOM뿐 아니라 실제 Canvas API 좌표·색·알파·pane 경계와 PNG 픽셀을 검사했다.
- 실제 desktop plot 폭 1,070 CSS px에서 최대 막대 폭 909.5 CSS px를 관측했다. `1070 × 0.85 = 909.5`이며 DPR 2에서도 media 좌표가 이중 배율로 커지지 않았다. Light fill `#e6b77c`/0.32, Dark fill `#d9a15a`/0.28을 확인했다. 한국 ETF 라벨의 좌 단위도 확인했다.
- 과거 폭 10%·50구간·전체 기간·자동 주석 ON을 별도로 주입했다. 저장된 상태는 유지하고, `차트 정리` 후 10구간·85%·visible·테마 자동으로 저장/즉시 렌더링되었다.
- 공시 30개, 리포트 38개, 목표가 변경 12개를 독립적으로 표시했다. 묶음의 native canvas hover/click과 상세의 전체 원본을 확인했으며, OFF 후 marker/hit target/상세를 제거했다. 실제 캔들 geometry와 가격축 좌표는 동일했다. 뉴스·배당·분할 및 주석 전체 표시/숨김도 별도로 확인했다.
- Light/Dark PNG를 디코딩하여 기존 테마 배경, 투명하지 않은 native 영역, 실제 차트 내용과 주석 ON/OFF를 확인했다. 화면 캡처만 보고 export 성공을 추정하지 않았다.
- 테마 자동/사용자 지정, resize, 전체화면, 가격축 zoom, visible 시간축 pan, 전체 기간 불변, 종목 왕복·새로고침 scope 복원도 검사했다. 최종 production build의 과거 설정 Light/Dark 2/2 케이스·14/14 추가 검사, 분할/전체화면 2/2 케이스·4/4 검사, 별도 native hit/ON/OFF 캡처 2/2 케이스·2/2 검사 모두 통과했다. 최종 추가 검사의 JSON은 [증거 목록](../../artifacts/chart-display/README.md)에 연결한다.
- 주봉 리포트 38개에서 원래 날짜를 상세에 유지하고 주봉 설정/월봉 설정을 별도 복원했다. 리플레이 이전의 미래 공시 30개가 노출되지 않고 리플레이 종료 후 다시 나타나는 것을 확인했다.

재실행 명령은 실제 추가한 `qa:chart-display`를 사용한다. `QA_BASE`는 실행 중인 내부 검증 서버 주소이고 운영 사이트 주소를 넣지 않는다. production build는 변경될 때마다 현재 bundling 산출물의 RPC ID map을 생성하여 `--function-map`에 전달해야 한다. 시세 응답이 fixture로 가로채졌는지 `fixtureCalls`와 `QA SYNTHETIC` 출처를 검사하며, 인증/실제 API 성공 여부에 의존하지 않는다.

```sh
npm run qa:chart-display -- --cases stock,etf,us --viewports desktop,mobile --themes light,dark --dprs 1,2 --out <증거 폴더>
npm run qa:chart-display -- --cases stock --viewports desktop --themes light,dark --dprs 1 --legacy --interactions --out <과거 설정 증거 폴더>
npm run qa:chart-display -- --cases workspace-split --viewports desktop,mobile --themes dark --dprs 1 --out <분할·전체화면 증거 폴더>
npm run qa:chart-hts -- --mode fixture --cases stock-403870,etf-069500,us-NVDA --viewports desktop,mobile --out <HTS 회귀 증거 폴더>
npm run qa:chart-hts -- --mode fixture --cases stock-403870,etf-069500 --viewports desktop --interactions --checks 'Local price alert' --out <가격 알림·주석 회귀 증거 폴더>
```

이번 production 검사는 `node --experimental-strip-types scripts/qa-chart-display.mjs`에 동일한 matrix/상호작용 옵션과 `--function-map /workspace/.onboarding/chart-display-function-map.json`을 전달하여 실행했다. 해당 map은 현재 build의 `createServerRpc` ID/name 49개를 읽어 생성했다. 다른 build에서는 아래처럼 다시 생성할 수 있다. `bundle-dir`는 현재 production bundling 폴더, `map-file.json`은 비밀값이 없는 QA 산출물 경로로 바꾼다.

```sh
node --input-type=module - <bundle-dir> <map-file.json> <<'NODE'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [root, output] = process.argv.slice(2);
const names = {};
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.mjs')) {
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(/createServerRpc\(\{\s*id: "([a-f0-9]{64})",\s*name: "([^"]+)"/g)) names[match[1]] = match[2];
    }
  }
}
walk(root);
if (!Object.keys(names).length) throw new Error('Current build RPC map not found');
writeFileSync(output, JSON.stringify(names, null, 2));
NODE
```

실행 로그와 선정한 원본 PNG/JSON을 `artifacts/chart-display/`에 보관한다. 대규모 canvas 호출 배열을 건수로 축약한 JSON은 축약 사실과 원본 경로를 명시한다. 전체 폭·테마 matrix 이후 추가한 상세 수명/전체화면 개선은 최종 production targeted 검사로 재검증했다. 중간 실패 결과를 최종 통과 결과로 바꾸지 않았다. 실제 코드 결함인 테마 줌 초기화·PNG 배경·같은 내용 갱신 시 상세 초기화는 수정한 뒤 재검사했다. Sheet 종료 애니메이션/포커스 복귀를 기다리지 않은 검사와 mobile의 닫기 버튼 DOM 위치를 잘못 지정한 검사는 정상 동작에 맞게 수정했고, 기능 검증 조건은 유지했다.

## 운영 확인 범위

검증은 개발 서버와 로컬 production build에서 수행한다. 운영 사이트의 실제 데이터·브로커 링크·인증 세션, 기존 사용자의 배포 storage, 배포 버전은 별도 확인이 필요하다. 외부 폰트 및 Grok 확장 스크립트에서 기존 인증서 신뢰 오류가 관측되며 TLS 검증을 끄지 않았다. 이 브라우저 환경의 외부 연결 실패와 앱 자체 runtime 오류를 구분해 기록한다.
