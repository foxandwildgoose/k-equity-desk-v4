# HTS 6단 수급 데이터 검증 기록

검증일: 2026-10-03 (Asia/Seoul). 실제 응답과 테스트 fixture를 구분한다.

## 실제 연결

`artifacts/chart-upgrade/actual-flow-verification.json`은 실제 HTTP 응답을 사용한 검증 결과다. 테스트용 값은 운영 어댑터의 대체 데이터로 사용하지 않는다.

- 국내 개별주: 삼화콘덴서 001820, HPSP 403870, SFA반도체 036540, SKC 011790.
- 국내 상장 ETF: KODEX 200 069500, KODEX 미국S&P500 379800, KODEX 미국S&P500데일리커버드콜OTM 0005A0.
- `/basic` 메타데이터로 종목 코드, 상품 유형, KOR 상장 국가를 확인하고 `/trend`의 각 행 종목 코드도 검사한다. 해외자산 ETF의 거래일은 그대로 Asia/Seoul이다.
- Naver의 최근 10거래일 창만 사용한다. 미확인 페이지네이션 파라미터로 이력 전체를 제공한다고 주장하지 않는다. 요청 범위와 실제 제공 범위를 각각 반환한다.
- KIS_APP_KEY와 KIS_APP_SECRET은 이 환경에서 모두 미설정이다. 값은 검사·출력하지 않았으며, 변수 존재 여부만 확인했다. 신용·투신의 실제 인증 호출 및 ETF 지원 여부는 검증하지 못했다. 각 패널은 `not-configured`로 유지한다.

## 지표별 정의

| 패널           | 실제 원천/API                                                     | 필드·단위                                                       | 날짜                                                        | 확정/공표 시각                           |
| -------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| 외국인보유비율 | 기존 Naver `GET https://m.stock.naver.com/api/stock/{code}/trend` | `foreignerHoldRatio`, 원문 `%`, 내부 0~100                      | `bizdate` / `localBizDate`, 원천 영업일                     | 미확인: `final=null`, `availableAt=null` |
| 신용잔고율     | KIS 국내주식 신용잔고 일별추이 [0476]                             | `whol_loan_rmnd_rate`, 전체 **융자** 잔고 비율 `%`              | `stlm_date` 결제일. `deal_date` 매매일로 바꿔 표시하지 않음 | 미확인: null                             |
| 투신 순매수    | KIS 종목별 투자자매매동향(일별)                                   | `ivtr_ntby_qty`, 주. 매수 `ivtr_shnu_vol`, 매도 `ivtr_seln_vol` | `stck_bsop_date` 영업일                                     | 미확인: null                             |

외국인 **한도소진율**인 Naver integration의 `foreignRate`는 사용하지 않는다. 실제 KT(030200) 응답에서 외인소진율이 100.00%인 반면 `foreignerHoldRatio`는 49.00%였다. SK텔레콤(017670)에서도 각각 71.12%와 34.88%로 구별된다. 같은 수치처럼 보일 수 있는 일반 종목만으로 필드 의미를 추정하지 않았다.

ETF 069500의 Naver 종목 화면 SSR은 투자자별 매매동향에 **단위:주**를 표시한다. ETF라는 이유로 주 수량을 좌 수량으로 변환하거나 천 단위를 임의로 붙이지 않는다. ETF 자체 시장거래 수급만 사용하며 구성종목, 설정·환매, 발행수량 증감을 대체 지표로 사용하지 않는다.

투신은 `ivtr_*` 분류만 사용한다. `orgn_*`(기관계), `fund_*`(기금), `scrt_*`(증권)는 대체하지 않는다. 순매수 필드가 결측이고 같은 행의 투신 매수·매도가 모두 있을 때에만 `ivtr_shnu_vol − ivtr_seln_vol`로 계산하고 산식을 반환한다. 현재 상장수량을 과거 신용·외국인 비율의 분모로 사용하지 않는다.

## KIS 공식 근거와 어댑터

공식 저장소 `koreainvestment/open-trading-api`를 기존 Git 인증으로 조회했다. 확인 커밋: `277ec0eb7a9b7f63b6807829286c80f36649dad2`.

- [신용 일별 API와 인자](https://github.com/koreainvestment/open-trading-api/blob/277ec0eb7a9b7f63b6807829286c80f36649dad2/examples_llm/domestic_stock/daily_credit_balance/daily_credit_balance.py)
- [신용 필드 한글 정의](https://github.com/koreainvestment/open-trading-api/blob/277ec0eb7a9b7f63b6807829286c80f36649dad2/examples_llm/domestic_stock/daily_credit_balance/chk_daily_credit_balance.py)
- [투자자별 API와 인자](https://github.com/koreainvestment/open-trading-api/blob/277ec0eb7a9b7f63b6807829286c80f36649dad2/examples_llm/domestic_stock/investor_trade_by_stock_daily/investor_trade_by_stock_daily.py)
- [투신 필드 한글 정의](https://github.com/koreainvestment/open-trading-api/blob/277ec0eb7a9b7f63b6807829286c80f36649dad2/examples_llm/domestic_stock/investor_trade_by_stock_daily/chk_investor_trade_by_stock_daily.py)

신용은 `/uapi/domestic-stock/v1/quotations/daily-credit-balance`, TR `FHPST04760000`, `FID_COND_MRKT_DIV_CODE=J`, `FID_COND_SCR_DIV_CODE=20476`, `FID_INPUT_ISCD`, `FID_INPUT_DATE_1`(결제일)를 사용한다. 공식 설명상 1회 최대 30건이며 날짜 인자로 다음 조회가 가능하다. 대주잔고(`whol_stln_*`)를 사용하지 않는다.

투신은 `/uapi/domestic-stock/v1/quotations/investor-trade-by-stock-daily`, TR `FHPTJ04160001`, `FID_COND_MRKT_DIV_CODE=J`(KRX), 종목·일자 및 공식 예제의 공란 인자를 사용한다. `output2` 일별 행을 파싱한다. `tr_cont=M/F`일 때 `N`으로 연속 조회하며 페이지 날짜가 반복되면 중단한다.

두 어댑터는 코드상 실행 가능하며 fixture로 인증 성공/거절, 정확한 필드, 누락, 페이지 반복, 부분 실패를 검증한다. 인증 없는 환경에서 상시 빈 배열을 성공으로 반환하는 TODO가 아니다. 키를 안전한 서버 환경변수로 주입하면 실제 조회가 실행된다. ETF별 실제 지원·권한은 해당 종목의 응답을 받은 후에 판단한다.

표시·재배포 권한, 종목별 역사 이력 보존 기간, 실제 게시 지연 및 계정별 정확한 호출 한도는 공식 예제만으로 확인할 수 없다. 문서/샘플 코드 공개와 시장 데이터 재배포 권한은 별개다. 실제 서비스 배포 시 계정 약관과 Naver/원제공자 표시 조건을 별도로 확인해야 한다. 이번 변경은 배포하지 않았다.

## 안전·정렬·제약

- 허용 URL은 Naver와 KIS HTTPS 두 origin으로 고정하며 redirect를 거절한다. 브라우저가 공급자 URL이나 API 키를 지정할 수 없다.
- 요청당 7초, 429/5xx/시간 초과에 한 번만 재시도한다. 인증 토큰은 중복 요청을 합치고 1분 이내 재발급을 제한한다. KIS 요청은 인스턴스별 순차 큐로 제한한다.
- 기본 최대 4페이지(설정 최대 8), 반복 페이지/빈 페이지/요청 시작일 도달 시 중단한다. 후속 페이지 실패는 이미 확보한 날짜를 `partial`로 반환한다.
- 종목·상장 시장·상품 유형·거래소·통화·수량 단위·기간·봉 주기를 포함한 key로 요청을 합치고 5분 캐시한다. 구독자 모두 취소했을 때 공급자 요청을 취소한다. 늦게 도착한 응답은 원래 종목 key에만 저장한다.
- null, 정상 0, 오류, 미설정, 정의 미확인을 구분한다. 최신 캐시만 서버가 반환하며, 클라이언트가 갱신에 실패해 5분 이상 오래된 값을 유지하면 별도 `stale`를 표시한다.
- 일별 원본은 날짜·출처·원천 필드·기준일·취득 시각과 함께 보관한다. 순수 함수는 공통 가격 날짜에 정렬하며 일/주/월/년 비율은 마지막 유효값, 순매수는 기간 합, 누적은 고정 기준일부터 합산 후 기간 마지막 값을 사용한다. 일부 날짜가 없으면 partial이다.
- 누적 기준일 이후 누락이 생기면 그 이후 누적을 null로 남긴다. 스크롤/줌 때문에 원점을 바꾸거나 결측을 0으로 취급하지 않는다.
- 과거 공표 시각을 모르는 실제 원천은 엄밀한 리플레이 수급 표시를 비활성화한다. 분봉에서도 일별 수치를 장중 값처럼 복제하지 않는다. 패널 영역은 유지한다.
- 미국 주식·미국 상장 ETF에는 지표 정의·공급자 `unknown`을 반환한다. 미확인 해외 분류를 한국 지표로 강제하지 않는다.

테스트: `node --experimental-strip-types --test src/lib/charts/hts-flow.test.ts src/server/chart-flow.test.ts`.
