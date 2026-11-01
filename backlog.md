# Backlog

## Next

## Review Backlog

### PR #2 — [FEAT] render.ts UI 리디자인 (2026-05-29)

- [~] [debt] CDN 폰트 SRI 없음 + 공공망분리 차단 위험 — **won't-fix (2026-05-29)**: 망분리 환경 접속 비대상이라 차단 위험 무효, CDN 폰트 유지 (source: code-review, pr-review-toolkit:review-pr) — `src/web/render.ts:57–58`

### PR #3 — [FIX] render 금액·날짜 포맷 보정 + 공고구분 컬럼 + 유닛 테스트 (2026-05-29)

- [~] [debt] `contractMethodClass`/`formatAmount` undefined 가드 — **won't-fix (2026-05-29)**: `BidRow` 필드 타입이 `string | null`/`number | null`만 허용, TS strict가 undefined 유입 차단 → 가드 무효 (source: agy)

### PR #4 — [FEAT] 마감 공고 soft 필터 + from/to 버그 (2026-05-29)

- [~] [false-positive] from/to·마감일 비교가 compact(`YYYYMMDD`) 저장값에서 깨진다는 지적 — **각하 (2026-05-29)**: prod D1 직접 조회로 `bid_ntce_date`/`bid_clse_date` 모두 대시 `YYYY-MM-DD` 확인. 리뷰어는 stale 픽스처(`202605010900`) 기준 추론 → 픽스처를 실제 포맷으로 정규화해 해소. dash-strip 복원 시 실제 버그 재발 (source: security-review P1, codex P2)

### PR #11 — [FEAT] 어드민 페이지 — 수집 필터 규칙 동적 관리 (2026-05-29)

- [~] [doc] `/admin` 비번 미설정 시 503 메시지 `"admin password not configured"` 가 엔드포인트 존재 노출 — **유지 (2026-05-29)**: 분기는 오설정 시에만 발동(prod 항상 `ADMIN_PASSWORD` 설정), `/admin` 경로는 어차피 추측 가능 → 노출 위험 marginal. 운영 디버깅 신호(=설정하라) 유지가 우선. 사용자 결정 (source: review)
- [~] [decision] all-disabled → DEFAULT 폴백이 "전체 필터 해제" 의도를 막는다는 지적 — **유지 (2026-05-29)**: 5개 리뷰어 중 4(review-pr·security-review·codex·review)가 fail-safe 타당 판정, agy만 버그 주장. 전체 수집 폭주 방지가 우선 → 동작 유지, 어드민 UI에 폴백 안내 문구 추가로 갈음 (source: agy P1, review P2)
- [~] [decision] CSRF Origin-missing 요청 차단(Origin 필수화) 제안 — **각하 (2026-05-29)**: security-review·review-pr 모두 현 Origin-host 검사가 브라우저 위협 모델에 충분하다 확인(브라우저는 교차출처 POST에 항상 Origin 첨부, 비브라우저 클라엔 ambient credential 없음). Origin 필수화는 정상 클라 차단 위험 (source: agy P2)

### PR #71 — [TEST] Move filter-trial rule/sample parsing into src and test it (2026-11-01)

- [ ] [doc] docs/workflows.md (`sweep`: "Record findings in `tasks.md`"), docs/eval-criteria.md (Sprint Contract / below-threshold findings in `tasks.md`) and `.claude/agents/qa-verifier.md` (reads the contract only from `tasks.md`) predate the queue split — review backlog now lives in `backlog.md`, and a single-item sprint has no `tasks.md`, so qa-verifier must be handed the contract inline (source: code-review) — `docs/workflows.md:96`
- [ ] [debt] `parseFilterRules` all-empty fallback returns the shared `DEFAULT_RULES` object (getFilterRules uses `structuredClone`); a caller mutating the result would corrupt the default — clone it and assert `not.toBe(DEFAULT_RULES)` (source: code-review) — `src/collector/filter.ts:211`
