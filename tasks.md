## Review Backlog

### PR #2 — [FEAT] render.ts UI 리디자인 (2026-05-29)

- [ ] [debt] CDN 폰트 SRI 없음 + 공공망분리 차단 위험 — Google Fonts, jsDelivr에 `integrity=` 추가하거나 self-host (source: code-review, pr-review-toolkit:review-pr) — `src/web/render.ts:57–58`
- [ ] [debt] `formatAmount(0)` falsy 체크로 0원 예산이 "미정" 표시 — `if (!amount)` → `if (amount === null || amount === undefined)` (source: code-review) — `src/web/render.ts:4`
- [ ] [constraint] `renderStatusBadge`, `formatAmount`, `formatDate` 단위 테스트 없음 — `test/render.test.ts` 추가 (source: pr-review-toolkit:review-pr)
