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

### PR #11 — [FEAT] 어드민 페이지 — 수집 필터 규칙 동적 관리 (2026-05-29)

- [ ] [constraint] `filter_rules 시드 무결성` 테스트가 CRUD describe 의 destructive `beforeEach` 보다 먼저 실행됨을 가정(순서 의존). `seed.test.ts` 분리 또는 자체 `beforeAll` 검증으로 견고화 (source: review) — `test/repo.test.ts`
- [ ] [doc] `/admin` 비번 미설정 시 503 메시지 `"admin password not configured"` 가 엔드포인트 존재 노출. 운영 디버깅엔 유용하나 중립 메시지/404 고려 가능 (source: review) — `src/web/admin.ts`
- [ ] [doc] 시드(`0002`) ↔ `DEFAULT_RULES` 동기 원칙을 AGENTS.md Golden Principles에 명문화 (현재 무결성 테스트로 기계 강제 중) (source: review) — `AGENTS.md`
- [~] [decision] all-disabled → DEFAULT 폴백이 "전체 필터 해제" 의도를 막는다는 지적 — **유지 (2026-05-29)**: 5개 리뷰어 중 4(review-pr·security-review·codex·review)가 fail-safe 타당 판정, agy만 버그 주장. 전체 수집 폭주 방지가 우선 → 동작 유지, 어드민 UI에 폴백 안내 문구 추가로 갈음 (source: agy P1, review P2)
- [~] [decision] CSRF Origin-missing 요청 차단(Origin 필수화) 제안 — **각하 (2026-05-29)**: security-review·review-pr 모두 현 Origin-host 검사가 브라우저 위협 모델에 충분하다 확인(브라우저는 교차출처 POST에 항상 Origin 첨부, 비브라우저 클라엔 ambient credential 없음). Origin 필수화는 정상 클라 차단 위험 (source: agy P2)
