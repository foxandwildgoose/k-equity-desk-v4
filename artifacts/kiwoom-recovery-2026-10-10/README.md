# 키움 전체 국내 종목 복구 검증

**모든 PNG와 브라우저 숫자는 QA SYNTHETIC 합성 fixture입니다. 실전 시세·키움 수신 증거가 아닙니다.** 실제 adapter/parser/store/React Query와 최신 production build canvas를 사용했으며 운영 DB·broker 네트워크 요청은 0입니다. 모바일 캡처에는 해당 날짜의 크로스헤어 관측값이 포함될 수 있습니다. 최신 저장값은 별도의 QA assertion으로 검사했습니다.

- [검증 요약](verification.json): 전체 테스트 1015, 키움 subset 105, production 4조합/24체크, dev 2조합/12체크 PASS.
- [원인과 해결](../../docs/upgrade/KIWOOM_FLOW_RECOVERY_2026-10-10.md)
- [기존 PC 수집기 갱신 순서](../../docs/upgrade/KIWOOM_FLOW_SETUP.md)

| 패널 | Light desktop — KOSPI | Dark mobile — KOSDAQ |
| --- | --- | --- |
| 신용잔고율 | [원본 캡처](018260-recovered-credit-light-desktop.png) | [원본 캡처](131970-recovered-credit-dark-mobile.png) |
| 외국인보유비율 | [원본 캡처](018260-recovered-foreign-light-desktop.png) | [원본 캡처](131970-recovered-foreign-dark-mobile.png) |
| 투신 누적순매수 | [원본 캡처](018260-recovered-investmentTrust-light-desktop.png) | [원본 캡처](131970-recovered-investmentTrust-dark-mobile.png) |

전체 원본과 최초 실패 증거는 로컬 `/workspace/screenshots/kiwoom-recovery/`에 보존했습니다. 이 요약은 과거 운영자 2026-10-05의 실제 수신 기록을 덮어쓰지 않습니다. 이번 수정본의 허용 IP 실수신·공유 Neon 영속성·최신 Vercel 표시 재검증은 대기입니다.
