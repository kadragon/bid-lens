## Review Backlog

### PR #2 — [FEAT] render.ts UI 리디자인 (2026-05-29)

- [~] [debt] CDN 폰트 SRI 없음 + 공공망분리 차단 위험 — **won't-fix (2026-05-29)**: 망분리 환경 접속 비대상이라 차단 위험 무효, CDN 폰트 유지 (source: code-review, pr-review-toolkit:review-pr) — `src/web/render.ts:57–58`
- [x] [debt] `formatAmount(0)` falsy 체크로 0원 예산이 "미정" 표시 — `if (!amount)` → `if (amount === null)` (source: code-review) — `src/web/render.ts:4`
- [x] [constraint] `renderStatusBadge`, `formatAmount`, `formatDate` 단위 테스트 없음 — `test/render.test.ts` 추가 (source: pr-review-toolkit:review-pr)

### PR #3 — [FIX] render 금액·날짜 포맷 보정 + 공고구분 컬럼 + 유닛 테스트 (2026-05-29)

- [ ] [debt] `.badge { margin-top: 4px }` — 뱃지가 title-cell 안에 있던 시절의 잔여 스타일. 공고구분 td로 이동 후 효과 모호 — 디자인(desktop.png) 확인 후 제거/스코프 판단 (source: pr-review-toolkit:review-pr) — `src/web/render.ts:221`
- [~] [debt] `contractMethodClass`/`formatAmount` undefined 가드 — **won't-fix (2026-05-29)**: `BidRow` 필드 타입이 `string | null`/`number | null`만 허용, TS strict가 undefined 유입 차단 → 가드 무효 (source: agy)
