# 종목 통합 검색 수정 및 검증

확인일: 2026-10-10 (한국시간)

작업 브랜치: `work`

기준 커밋: `c4133d989958ada92508d2f96b6c6cdd69f9c096`

원격 `main`의 별도 ETF 업데이트 `fa77a9480e1ac31f11c539906836e18dc2d063b2`를 보존하여 통합했습니다. 위 기준 커밋은 검색 문제 조사를 시작한 시점이며, 최종 결과는 ETF 업데이트와 통합한 코드로 검사했습니다.

## 1. 문제와 수정 범위

대시보드 중앙 검색창에 `삼성`을 입력하면 삼성전자 한 줄만 보이고 다른 결과를 선택하기 어려운 문제가 있었습니다. 검색 결과 개수 자체의 문제와 검색 결과가 화면에서 잘리는 문제를 함께 조사했습니다.

확인된 직접 원인은 `src/styles.css`의 `.app-shell-top { overflow: hidden; }`과 헤더 내부에 절대 위치로 생성되던 검색 결과 패널의 조합입니다. 결과 패널이 헤더 경계를 넘어가면 잘렸습니다. 패널의 `z-index`만 높여서는 부모의 clipping을 벗어날 수 없습니다. 따라서 기존 디자인과 헤더 레이아웃을 유지하면서 설치된 Radix Popover의 Portal로 검색 패널을 렌더링하도록 바꿨습니다.

이번 작업은 종목 검색, 결과 표시, 종목 선택 후 기존 상세 차트 페이지로 이동하는 경로에 한정합니다. 로그인, DB, 키움 인증정보, 키움 세 지표의 계산·수집·저장, 기존 가격 차트 구현은 재작성하지 않습니다. 새 DB migration, 비밀값 등록, Node.js 재설치는 필요하지 않습니다.

## 2. 확인된 문제별 해결

| 문제 | 확인된 기존 동작 | 수정 |
| --- | --- | --- |
| 결과 패널이 첫 행만 보임 | 부모 헤더의 `overflow: hidden`이 검색 결과 영역과 클릭 영역을 잘랐음 | 기존 Radix Portal로 헤더 clipping 밖에 렌더링. 화면 경계·스크롤·리사이즈에 맞추어 위치 보정 |
| 전체 상장 종목을 검색하지 못함 | 약 140개 앱 커버리지 목록과 공급자의 제한된 자동완성에 의존 | KOSPI·KOSDAQ 전체 편입 목록, ETF 목록, 미국 상장 symbol directory와 공급자 검색을 통합 |
| ETF가 주식 결과 뒤에서 사라짐 | 국내 주식과 ETF를 별도로 수집한 뒤 합쳐 첫 20개만 표시 | 통합 순위와 중복 제거 후 40개 단위 페이지 조회. `검색 결과 더 보기`로 추가 결과 표시 |
| 미국 종목 검색·이동 불가 | 기존 검색 타입과 결과 필터가 국내 시장만 허용하고 선택 후 국내 경로만 사용 | `KR`/`US`를 명시하고 기존 `/stock/$ticker`, `/etfs/$code`, `/us/$symbol` 경로로 이동 |
| 공급자 실패가 검색 결과 없음처럼 표시됨 | 공급자 오류를 빈 배열로 바꾸어 실패 여부가 사라짐 | `ready`, `partial`, `unavailable`과 공급자별 상태를 전달. 오류·부분 결과·실제 빈 결과를 구분하고 재조회 제공 |
| 이전 검색 결과가 새 검색어에 섞임 | React Query의 이전 placeholder 결과를 그대로 사용 | 검색어별 페이지 캐시 분리, 요청 취소 signal 전달, 반환 `q`와 현재 입력값 일치 확인 |
| 검색 결과의 중복·순위 불일치 | 국내 코드만으로 병합하고 주식/ETF 묶음 순서가 관련도보다 우선함 | 국가와 코드로 식별. 정확한 코드·이름 일치를 우선하고 동일 종목을 중복 표시하지 않음 |
| 저장소 차단 시 선택해도 이동하지 않음 | `localStorage.setItem()` 예외가 종목 이동 전에 발생할 수 있었음 | 최근 검색 저장과 화면 이동을 분리. 저장소 차단·손상 JSON·잘못된 최근 기록을 안전하게 처리 |
| 한글 조합 Enter가 종목을 선택함 | 검색창 Enter 처리에 IME 조합 보호가 없었음 | 조합 중에는 검색 debounce와 Enter 선택을 보류. 조합 완료 후 검색 |
| 키보드 선택 결과가 화면 밖에 있음 | 활성 행 변경 후 목록 스크롤과 ARIA 연결이 충분하지 않았음 | combobox/listbox/option, 활성 항목 안내, 방향키 스크롤, Escape/Tab 처리. 마지막 항목의 아래 방향키로 다음 페이지 조회 |
| 신규 영문자 포함 국내 코드가 ETF나 잘못된 페이지로 이동함 | 국내 코드·상품 분류를 문자열 모양으로 추측하거나 숫자 전용 검증에 제한 | 검색 공급자의 명시된 상품 분류를 존중. 6자리 영문자 포함 국내 주식은 기존 주식 상세 경로에서 처리 |
| 미국 share class·6자리 미국 티커가 국내 코드와 혼동됨 | 국내 코드 정규화나 기존 미국 티커 검증이 적용될 수 있었음 | 국가별 정규화와 검증 분리. `BRK.B` 등 공급자 symbol을 미국 차트의 canonical symbol로 연결 |
| 워크스페이스 검색이 다른 국가로 이동하거나 지연 결과를 표시함 | 별도 종목 선택기에도 국내 코드 가정과 지연 응답 문제가 있었음 | 통합 검색 계약을 재사용하고 `KR:`/`US:` 구분을 유지. 요청 순서 guard로 이전 응답 차단 |
| 번역된 미국 회사명이 검색에서 누락됨 | 실제 `Apple` 응답은 `AAPL / 애플`인데 영문 문자열의 재필터링으로 AAPL이 탈락했음 | 실제 공급자가 반환한 현재 검색어와 순서만 보존. 이전 검색어의 메타데이터는 무시. `Apple` → AAPL, APLE 실수신 재검증 |
| 입력만으로 존재하지 않는 종목 결과를 생성함 | 코드 모양만 맞으면 공급자 확인 없이 이름이 코드인 결과를 생성했음 | 검색은 실제 목록·응답 또는 기존 커버리지에서 확인한 종목만 반환 |
| 초기 홈 화면이 다시 그려질 수 있음 | 헤더의 시세 요청이 홈 route hydration보다 먼저 완료되면 관심종목·산업 타일의 SSR `—`와 초기 클라이언트 값이 달랐음 | 기존 `mounted` guard를 공통 시세 memo에 적용하여 모든 홈 시세 영역의 첫 렌더를 일치시킴 |

## 3. 사용자가 보는 동작

1. 중앙 검색창에 종목명, 국내 코드, 미국 티커를 입력합니다. `⌘K` 또는 `Ctrl+K`로 검색창에 이동할 수도 있습니다.
2. 검색 결과에 종목명, 코드, 코스피·코스닥·미국 시장, ETF 여부가 표시됩니다. 국내 시세 snapshot은 국내 결과에만 붙습니다. 미국 결과에 원화 시세를 잘못 붙이지 않습니다.
3. 검색 결과가 많으면 패널 안에서 스크롤합니다. `검색 결과 더 보기`로 다음 40개를 불러옵니다. 키보드로 마지막 결과까지 이동한 뒤 아래 방향키를 눌러도 다음 페이지를 불러옵니다.
4. 항목을 클릭하거나 방향키로 선택한 뒤 Enter를 누르면 기존 상세 페이지로 이동합니다. 국내 주식은 주식 상세, 국내 ETF는 ETF 상세, 미국 종목은 미국 종목 상세 페이지를 사용합니다.
5. 조회 실패 시에는 실패 안내와 `검색 다시 시도`가 나타납니다. 일부 공급자만 실패한 경우 확보한 결과를 유지하면서 부분 결과임을 표시합니다.
6. 최근 검색은 기존 저장 위치를 유지합니다. 브라우저가 저장을 차단해도 검색과 종목 이동은 계속 동작합니다.

검색 결과 없음은 해당 검색어로 확보한 목록·응답에서 일치 항목이 없다는 뜻입니다. 연결 실패를 미상장 또는 미지원으로 단정하지 않습니다. 검색 결과가 있다는 사실만으로 해당 종목의 실시간 시세나 모든 차트 기간의 가격 이력을 보장하지 않습니다.

## 4. 검색 데이터 범위와 공급자

- 국내 주식: 기존 앱 커버리지 목록에 더해 Naver KOSPI·KOSDAQ 시장별 상장 목록과 검색 응답을 사용합니다. 공급자가 제공하는 현재 목록을 읽고 중복 페이지·누락 페이지·목록 변경·응답 스키마를 검증합니다.
- 국내 ETF: Naver ETF 목록과 검색 응답에서 확인한 상품 구분을 사용합니다. 영문자가 포함된 코드라는 이유만으로 국내 주식을 ETF로 분류하지 않습니다.
- 미국: Nasdaq Trader의 `nasdaqlisted.txt`, `otherlisted.txt`를 사용해 Nasdaq·NYSE·AMEX 및 지원 거래소의 현재 상장 symbol을 확보하고 Yahoo 검색 및 기존 앱 이름 목록을 함께 사용합니다.
- OTC·특수 상품·상장폐지 종목·권리/워런트 등의 검색과 차트 제공은 공급자 지원 범위에 의존합니다. 모든 미국 종목에 모든 가격 이력이 제공된다고 주장하지 않습니다.
- 공개 시장정보의 고정 호스트·경로만 요청합니다. 이 검색은 키움 App Key·App Secret·토큰·계좌정보를 사용하거나 브라우저에 반환하지 않습니다. DB 변경도 수행하지 않습니다.
- 서버에는 제한된 조회 예산, 공급자 타임아웃, 디렉터리 캐시, 공유 요청, 검색어 캐시, 페이지 크기 제한을 적용합니다. 공급자 상태가 불완전하면 전체 목록 확보 완료로 표시하지 않습니다.
- 캐시는 서버 프로세스별입니다. Vercel의 새 인스턴스에서는 전체 목록을 다시 확보할 수 있으며, 10초 조회 예산 안에 완료하지 못하면 부분 결과로 응답합니다. 검색어와 실패한 목록 재조회에는 최대 30초의 캐시·재시도 간격이 있어 `검색 다시 시도`가 즉시 모든 공급자를 다시 호출한다고 보장하지 않습니다.

확인 대상 공개 출처:

- https://m.stock.naver.com/
- https://finance.naver.com/
- https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs
- https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt
- https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt
- https://finance.yahoo.com/

실제 공개 응답 확인: **2026-10-10 14:39 한국시간**. 키·토큰 없이 환경에 설정된 HTTPS proxy를 사용하는 curl 전달기를 테스트용 `fetcher`에 주입해 동일 검색 엔진·파서를 실행했습니다. 앱 코드에 proxy, curl 호출, 환경의 경로를 추가하지 않았습니다. 이는 Vercel의 기본 `fetch` 전송 경로 검증과 구분합니다.

| 실제 조회 | 결과 |
| --- | --- |
| KOSPI 목록 | 25/25페이지, 원자료 2,483개. 주식·ETF로 명시된 검색 대상 2,116개. ETN 등은 주식으로 위장하지 않고 제외 |
| KOSDAQ 목록 | 19/19페이지, 1,823개 |
| 국내 ETF 목록 | 1,172개 |
| `삼성` | 실제 주식·ETF 49개. 주식 26개(스팩 포함), ETF 23개 |
| `Apple` | `AAPL / 애플 / NASDAQ`, `APLE / Apple Hospitality REIT Inc / NYSE` |
| `0226A0` | `PLUS SK하이닉스샌디스크채권혼합50`, ETF 분류 |
| 전체 결과 상태 | `partial`. 네이버 데스크톱 검색·Nasdaq Trader는 이 환경에서 403, Yahoo 검색은 429 반환 |

3개 검색의 전체 소요 시간은 8.559초였습니다. 국내 44페이지를 모두 검증한 결과이며 미국 전체 디렉터리 실수신 완료를 뜻하지 않습니다. [실수신 응답과 공급자별 상태](artifacts/security-search/live-public-provider-verification.json)에 결과를 남겼습니다. 실제 상장 목록을 성공적으로 읽은 범위와 자동 테스트의 가상 목록을 섞어 보고하지 않습니다.

## 5. 변경 파일과 목적

| 파일 | 목적 |
| --- | --- |
| `src/components/layout/SearchCommand.tsx` | 중앙 검색창, Portal 결과 패널, 상태 표시, 최근 검색, 접근성·키보드·IME·더 보기 |
| `src/components/dashboard/Dashboard.tsx` | 기존 초기화 guard를 시세 memo에 적용하여 홈 SSR 재생성으로 검색 입력이 끊길 수 있는 문제를 방지 |
| `src/lib/use-market.ts` | 검색어별 infinite query와 취소 signal, 추가 페이지, 국내 영문자 포함 코드 조회 활성 조건 |
| `src/lib/security-search.ts` | 국가·시장·상품·공급자·페이지·처리 상태의 공통 검색 계약 및 미국 symbol 정규화 |
| `src/lib/security-search-ui.ts` | 현재 검색어에 해당하는 페이지만 표시, 병합·순위·이동 경로·최근 저장 검증 |
| `src/lib/security-search-ui.test.ts` | 검색어 변경, 중복·정렬, ETF 누락 방지, 국가별 이동, 최근 기록·저장 차단 회귀 검사 |
| `src/server/security-search.ts` | 기존 server function에 통합 엔진·입력 검증·페이지 응답 연결. 국내 전용 기존 호출부 호환 유지 |
| `src/server/security-search-engine.ts` | 시장 목록과 공급자 검색 통합, 제한된 조회·캐시·공유 요청, 공급자 상태와 페이지 처리 |
| `src/server/security-search-parse.ts` | 공급자별 실제 응답·상장 목록 parsing, 시장·상품 분류, 미국 share class 처리 |
| `src/server/security-search.test.ts` | 공급자 필드·부분 목록·중복 페이지·공유 요청·조회 실패·미상장 코드·페이지 계약 검사 |
| `src/routes/stock.$ticker.tsx`, `src/lib/market-fns.ts` | 국내 신규 코드가 기존 주식 상세·시세 요청 검증을 통과하도록 연결 |
| `src/lib/valuation-series.ts`, `src/lib/valuation-series.test.ts` | 미국 6자리 티커와 share class가 기존 미국 가격 차트 경로로 연결되도록 검증 보완 |
| `src/routes/chart.tsx` | 워크스페이스 선택기에 국가별 검색 결과와 지연 응답 guard 적용 |
| `src/lib/charts/security.ts`, `src/lib/charts/use-chart-security.ts`, `src/server/chart-security.ts`, `src/lib/charts/security.test.ts` | 주식/ETF 상세 및 차트 워크스페이스에서 국내·미국 코드 해석 일치 |
| `scripts/qa-security-search.mjs`, `package.json` | 운영 API 성공 여부에 의존하지 않는 브라우저 회귀 검사와 실행 명령 |
| `src/server/etf-issuer-holdings.ts` | 통합한 원격 ETF 변경의 기존 lint 오류 4개를 불필요한 regex escape 제거로 수정. 날짜 해석은 유지, 관련 14개 테스트 통과 |

## 6. 검증 방식과 실제 기록

자동 검사는 테스트 전용 공급자 응답과 결정적인 가격 이력을 사용합니다. 화면·로그·캡처의 fixture 값은 실시간 투자 데이터가 아닙니다. 실제 Vercel·Neon·가격 공급자 검증과 격리된 테스트 성공은 각각 구분합니다.

검사 대상은 삼성 다중 검색 결과의 실제 표시·스크롤·선택, 40개 이후 페이지, 국내 주식·ETF·미국 페이지와 차트 연결, 신규 국내 영문자 코드, 미국 share class, 한 글자 미국 티커, IME, 오래된 검색 응답, 최근 기록·저장 차단, 공급자 실패·재시도, 라이트·다크, 데스크톱·모바일입니다.

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| 관련 검색 단위·통합 테스트 | 서버 24개, UI helper 8개 통과. 코드·이동·주식 코드 회귀 테스트도 전체 검사에 포함 |
| `npm test` | 통과. 스크립트 테스트 214개 통과·12개 기존 환경 조건으로 skip, 앱 테스트 712개 통과·실패 0 |
| `npm run lint` | 통과. 오류 0, 기존 경고 57. 새 검색 코드와 QA 스크립트 대상 검사 오류·경고 0 |
| `npm run build` | production 번들 통과. 현재 명령에 migration 없음. 운영 DB에 접근하거나 변경하지 않음 |
| `npm run check:deploy` | `PASS`, issues 없음 |
| production 브라우저 검색·상세 차트 검사 | 라이트·다크 × 데스크톱 1440×900·모바일 390×844, 15개씩 총 60개 통과. uncaught error·가로 넘침 없음 |
| 일반 dev 홈 smoke | 기존 Dashboard 시세 hydration 경로 수정 후 데스크톱·모바일 2개 통과. 실패 0 |
| production 홈 smoke | 최종 번들에서 데스크톱·모바일 2개 통과. 실패·hydration 오류·가로 넘침 0 |
| 실제 공개 공급자 조회 | 국내 목록·ETF·삼성·Apple 확인. 미국 전체 디렉터리는 403·429로 실수신 검증 대기 |
| 실제 Vercel 배포 화면 | 이 실행환경의 배포 사이트 접속이 CONNECT 403으로 차단되어 미검증. 새 커밋 배포 후 확인 필요 |

Node 22에서 실행했습니다. 원격 `fa77a94`의 새 의존성을 기존 lockfile로 설치했으며 검색 작업 자체는 패키지를 추가하지 않았습니다.

브라우저 QA는 최종 production 번들을 `npm run preview -- --host 127.0.0.1 --port 8198`으로 실행한 뒤 다음 명령으로 수행했습니다.

```bash
npm run qa:security-search -- \
  --base http://127.0.0.1:8198 \
  --out /workspace/screenshots/security-search/final-after-complete-home-guard
```

QA 스크립트는 `.nitrorc`의 출력 경로 또는 기본 `.vercel/output/functions/__server.func/index.mjs`를 읽습니다. 다른 위치의 번들은 `--server-entry <번들 index.mjs 경로>`로 지정합니다. Chromium이 준비된 로컬/CI에서 실행하며 운영 API나 운영 DB를 이용하지 않습니다.

검사한 실제 이동 경로는 `/stock/005930`, `/stock/032830`, `/stock/131970`, `/stock/1032A0`, `/etfs/0226A0`, `/us/AAPL`, `/us/BRK-B`, `/us/F`, 워크스페이스 `US:AAPL`입니다. 합성 종목·가격은 QA 브라우저 응답에서만 사용했습니다. 각 페이지의 실제 Lightweight Charts canvas 픽셀과 요청의 종목 코드·시장을 검사했습니다. DOM 링크만 클릭하고 성공으로 기록하지 않았습니다.

검사 중 발견한 오류도 구분했습니다. 초기 타입 검사에서 테스트 helper 인자가 빠진 오류를 수정했습니다. 초기 QA의 native select 옵션까지 세는 selector와 hydration 이전 입력 문제는 harness를 수정하고 네 가지 화면에서 전체 검사를 다시 실행했습니다. 통과 기준이나 가격 canvas 검사를 제거하지 않았습니다. 기존 헤더에서는 20개 결과 중 첫 삼성전자만 클릭 가능하고 나머지 19개는 잘리는 것을 별도로 재현했습니다.

일반 홈 `npm run qa:smoke -- --routes / --base http://127.0.0.1:8080` 검사에서는 의존성 갱신 직후 기존 Vite 프로세스의 오래된 모듈 오류가 있었으며 개발 서버를 재시작했습니다. 이후 확인한 Dashboard 관심종목·산업 타일의 서버 `—`/초기 클라이언트 시세 hydration 차이에는 기존 `mounted` guard를 공통 시세 memo에 적용했습니다. 최종 dev 홈 재검사와 `--base http://127.0.0.1:8198` production 홈 재검사 모두 데스크톱·모바일에서 통과했으며 검색·클릭·차트의 production 검사는 별도로 수행했습니다.

증거 파일:

- [최종 브라우저 결과 JSON](artifacts/security-search/verification.json)
- [최종 production 홈 smoke 결과](artifacts/security-search/home-smoke.json)
- [기존 clipping 증거 JSON](artifacts/security-search/baseline-verification.json), [기존 화면](artifacts/security-search/baseline-clipped-dark-desktop.png)
- [Light 데스크톱 검색](artifacts/security-search/search-samsung-light-desktop.png), [Dark 데스크톱 검색](artifacts/security-search/search-samsung-dark-desktop.png)
- [Light 모바일 검색](artifacts/security-search/search-samsung-light-mobile.png), [Dark 모바일 검색](artifacts/security-search/search-samsung-dark-mobile.png)
- [ETF 차트](artifacts/security-search/chart-0226A0-light-desktop.png), [미국 차트](artifacts/security-search/chart-AAPL-dark-desktop.png), [코스닥 모바일 차트](artifacts/security-search/chart-131970-dark-mobile.png)

전체 원본 QA 스크린샷 36장과 JSON은 `/workspace/screenshots/security-search/final-after-complete-home-guard/`에 있습니다. 위 차트 캡처의 수치는 명시된 테스트 데이터이며 실제 투자 수치가 아닙니다.

## 7. 운영 반영

이번 변경은 기존 Neon·Vercel 및 인증 설정을 그대로 사용합니다. 새 migration, 비밀값 설정 변경, 유료 서비스 구입, 차트 라이브러리 교체가 필요하지 않습니다.

코드가 GitHub에 반영되면 해당 새 커밋의 Vercel Production 배포가 Ready인지를 확인한 뒤 기존 사이트를 새로고침합니다. 이전 배포를 재배포하는 것과 새 코드 배포는 구분합니다. GitHub 반영 상태, 실제 새 배포 확인 및 운영 검색 결과는 최종 검증 기록에 별도로 남깁니다.
