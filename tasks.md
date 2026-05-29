## Review Backlog

### PR #2 — [FEAT] render.ts UI 리디자인 (2026-05-29)

- [~] [debt] CDN 폰트 SRI 없음 + 공공망분리 차단 위험 — **won't-fix (2026-05-29)**: 망분리 환경 접속 비대상이라 차단 위험 무효, CDN 폰트 유지 (source: code-review, pr-review-toolkit:review-pr) — `src/web/render.ts:57–58`
- [x] [debt] `formatAmount(0)` falsy 체크로 0원 예산이 "미정" 표시 — `if (!amount)` → `if (amount === null)` (source: code-review) — `src/web/render.ts:4`
- [x] [constraint] `renderStatusBadge`, `formatAmount`, `formatDate` 단위 테스트 없음 — `test/render.test.ts` 추가 (source: pr-review-toolkit:review-pr)

### PR #3 — [FIX] render 금액·날짜 포맷 보정 + 공고구분 컬럼 + 유닛 테스트 (2026-05-29)

- [ ] [debt] `.badge { margin-top: 4px }` — 뱃지가 title-cell 안에 있던 시절의 잔여 스타일. 공고구분 td로 이동 후 효과 모호 — 디자인(desktop.png) 확인 후 제거/스코프 판단 (source: pr-review-toolkit:review-pr) — `src/web/render.ts:221`
- [~] [debt] `contractMethodClass`/`formatAmount` undefined 가드 — **won't-fix (2026-05-29)**: `BidRow` 필드 타입이 `string | null`/`number | null`만 허용, TS strict가 undefined 유입 차단 → 가드 무효 (source: agy)

### PR #4 — [FEAT] 마감 공고 soft 필터 + from/to 버그 (2026-05-29)

- [ ] [debt] LIKE 와일드카드 미이스케이프 — `q`/`dmnd`가 `%${v}%`로 바인딩. 파라미터화돼 SQL injection은 없으나 사용자 입력 `%`/`_`/`\`가 매칭 의미 변경. `ESCAPE` 절 + 입력 이스케이프 필요. **기존 코드, 이번 diff 무관** (source: security-review) — `src/db/repo.ts:118-123`
- [~] [false-positive] from/to·마감일 비교가 compact(`YYYYMMDD`) 저장값에서 깨진다는 지적 — **각하 (2026-05-29)**: prod D1 직접 조회로 `bid_ntce_date`/`bid_clse_date` 모두 대시 `YYYY-MM-DD` 확인. 리뷰어는 stale 픽스처(`202605010900`) 기준 추론 → 픽스처를 실제 포맷으로 정규화해 해소. dash-strip 복원 시 실제 버그 재발 (source: security-review P1, codex P2)
