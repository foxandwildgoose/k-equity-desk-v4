# Korea Equity Command Center

한국 주식·ETF 투자 데스크 웹앱입니다.  
TanStack Start (React 19) + 실시간 시세 / TradingView형 차트 / ETF 공식 편입비중 / 공시 / 리서치.

이 zip은 **실행 가능한 전체 소스 프로젝트**입니다. GitHub·GitLab·로컬 폴더에 그대로 올리면 됩니다.

## GitHub에 올리기

1. 이 zip을 받아 압축을 풉니다.
2. GitHub에서 빈 저장소를 만듭니다.
3. 아래를 실행합니다.

```bash
cd Korea-Equity-Command-Center
git init
git add .
git commit -m "Initial commit: Korea Equity Command Center"
git branch -M main
git remote add origin https://github.com/<your-account>/<your-repo>.git
git push -u origin main
```

Cursor / VS Code / Claude Code 등에서 그 저장소를 clone 하면 이어서 작업할 수 있습니다.

## 포함 기능

- 전종목 검색 (KOSPI·KOSDAQ, `0226A0` 같은 영문 ETF 코드 포함)
- 종목 상세: 분·일·주·월 차트, 추세선·피보나치·RSI, PER/PBR 밴드, 수급, 리서치
- 퇴직연금 ETF: 운용사 공식 비중만 사용(추정 없음), 실시간 시세, 동일 트레이딩 차트
- 수출 × KOSPI, 미국 연계, 공시(DART/KRX), 관심종목

## 로컬에서 실행

Node.js 22 필요.

```bash
npm install
npm run dev
```

환경 변수는 파일(.env)을 만들지 말고 셸 `export` 또는 배포 플랫폼 설정으로 넣습니다.
전체 목록과 미설정 시 동작은 [`docs/upgrade/ENVIRONMENT.md`](docs/upgrade/ENVIRONMENT.md)를 보세요.

기본 주소: `http://localhost:8080`

```bash
npm run typecheck
npm run build
```

## 환경 변수

모든 변수는 서버 전용이며 선택 사항입니다(없으면 기능이 자동으로 축소됩니다).
표·기본값·미설정 시 동작: **[`docs/upgrade/ENVIRONMENT.md`](docs/upgrade/ENVIRONMENT.md)**
(KIS, `SEC_USER_AGENT`, `FINNHUB_API_KEY`, `NEWS_BLOOMBERG_ENABLED`, 선택 AI 브리핑 등).

`VITE_` 접두사를 붙이지 마세요. 브라우저로 키가 노출됩니다. 저장소에 `.env` 파일을 만들지 않습니다.

키움 세 지표는 [설정/Windows 실행 순서](docs/upgrade/KIWOOM_FLOW_SETUP.md)와 [검증 상태](docs/upgrade/KIWOOM_FLOW_VERIFICATION.md)를 확인하세요. 현재 권장 배포는 **허용 IP 수집기 → 공유 PostgreSQL → Vercel의 collector 웹앱**입니다. 도구 메뉴의 **키움 연결 상태**와 `/login`을 제공합니다. `verify:kiwoom -- --check-config`는 설정만, `--check-database`는 스키마 조회만 수행합니다. `kiwoom:collect`는 기존 수집 명령의 별칭입니다. `build`와 `build:bundle`은 DB migration 없는 production bundling입니다. DB 변경은 `npm run db:migrate`로 명시적으로 실행합니다. 공개되는 `VITE_AUTH_ENABLED`에는 인증 ON/OFF만 넣고 증권사 키는 서버에만 설정합니다.

## 소스 검증

외부 소스(네이버·한경·Bloomberg RSS·연준·SEC·Google 뉴스 등)는 `src/server/feeds/registry.ts`에
등록되어 있습니다. `npm run verify:sources`는 소스마다 작은 GET 1회를 보내
`docs/upgrade/SOURCES_STATUS.md`를 갱신합니다. 앱의 `/status/sources` 화면에서 상태를 볼 수 있습니다.

## 디렉터리

```
src/routes/        화면 (ETF, 종목, 수출데스크, 리서치, 공시)
src/server/        네이버·WiseReport·PLUS·FRED·DART 어댑터
src/components/    차트, 테이블, 레이아웃
src/data/          유니버스·섹터·테마 설정
attachments/       마스터 프롬프트
```

시세·편입·공시는 제3자 공개 경로를 사용합니다. 투자 자문이 아니며, 실주문 전 증권사 HTS/MTS에서 재확인하세요.

## 라이선스 / 브랜딩

Grok Build 템플릿(PWA·배너) 파일이 `public/__grok`, `scripts/grok-pwa-*`, `server/` 에 포함되어 있습니다. 배포 시 필요하면 유지하거나 제거하세요.

Bollinger Screener 2.0은 Universe를 선택한 뒤 **실행**으로 모든 선택 기업의 현재 상황과 저장된 일봉의 **볼린저 가격 차트**를 보여줍니다. 기업 이름으로 차트를 바꾸고, 전략 탭으로 판정을 즉시 비교합니다. 후보가 0개여도 기업은 숨기지 않습니다. 부족한 자료는 기존 운영자 권한의 **선택 범위 수집·계산** / **수집 이어받기**로 확보합니다. 기존 Neon/Vercel Hobby를 그대로 사용하는 [사용 순서·변경·검증 기록](docs/upgrade/BOLLINGER_INVESTOR_VIEW.md)을 참고하세요. 기존 키움 수집기와 차트 지표는 유지합니다.
