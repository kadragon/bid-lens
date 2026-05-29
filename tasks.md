## Review Backlog

### PR #2 — [FEAT] render.ts UI 리디자인 (2026-05-29)

- [~] [debt] CDN 폰트 SRI 없음 + 공공망분리 차단 위험 — **won't-fix (2026-05-29)**: 망분리 환경 접속 비대상이라 차단 위험 무효, CDN 폰트 유지 (source: code-review, pr-review-toolkit:review-pr) — `src/web/render.ts:57–58`
- [x] [debt] `formatAmount(0)` falsy 체크로 0원 예산이 "미정" 표시 — `if (!amount)` → `if (amount === null)` (source: code-review) — `src/web/render.ts:4`
- [x] [constraint] `renderStatusBadge`, `formatAmount`, `formatDate` 단위 테스트 없음 — `test/render.test.ts` 추가 (source: pr-review-toolkit:review-pr)
