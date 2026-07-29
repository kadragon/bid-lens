# Security Fixes — Dependabot transitive alerts
status: open

All three open GitHub security alerts are **transitive** — none appear directly in `package.json`; they arrive via `vitest` / `@cloudflare/vitest-pool-workers` / `wrangler`. Fix by refreshing the lockfile, or pin with a `package.json` `overrides` block.

Exposure note: all three are Windows dev-server issues, so real-world exposure for this repo is low. Patch to clear the alerts, not because production is at risk.

## Scope

- `pnpm-lock.yaml` — lockfile refresh
- `package.json` — `overrides` block, only if a plain refresh does not reach the required versions

## Acceptance criteria

- [ ] `vite` (transitive, via vitest) resolves to `>=7.3.5` — one bump clears both vite alerts:
  - HIGH — `server.fs.deny` bypass via Windows alternate paths (GHSA-fx2h-pf6j-xcff)
  - MODERATE — bundled launch-editor discloses NTLMv2 hash via UNC path handling on Windows (GHSA-v6wh-96g9-6wx3)
- [ ] `esbuild` (transitive) resolves to `>=0.28.1` — LOW, arbitrary file read via dev server on Windows (GHSA-g7r4-m6w7-qqqr)
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green after the bump
- [ ] GitHub security alerts for this repo show zero open Dependabot entries

## Out of scope

- Upgrading `vitest` / `wrangler` major versions
- Any runtime dependency change (all three alerts are dev-only)

## Lint/test command

pnpm typecheck && pnpm lint && pnpm test

## Review Backlog

### PR #2 — [FEAT] render.ts UI 리디자인 (2026-05-29)

- [~] [debt] CDN 폰트 SRI 없음 + 공공망분리 차단 위험 — **won't-fix (2026-05-29)**: 망분리 환경 접속 비대상이라 차단 위험 무효, CDN 폰트 유지 (source: code-review, pr-review-toolkit:review-pr) — `src/web/render.ts:57–58`
- [x] [debt] `formatAmount(0)` falsy 체크로 0원 예산이 "미정" 표시 — `if (!amount)` → `if (amount === null)` (source: code-review) — `src/web/render.ts:4`
- [x] [constraint] `renderStatusBadge`, `formatAmount`, `formatDate` 단위 테스트 없음 — `test/render.test.ts` 추가 (source: pr-review-toolkit:review-pr)

### PR #3 — [FIX] render 금액·날짜 포맷 보정 + 공고구분 컬럼 + 유닛 테스트 (2026-05-29)

- [x] [debt] `.badge { margin-top: 4px }` — 뱃지가 title-cell 안에 있던 시절의 잔여 스타일. 공고구분 td 단독 셀로 이동 후 sibling `.method` pill 대비 4px 어긋남 → 제거 (top 정렬 통일). render.test.ts는 CSS 미검증이라 영향 없음 (source: pr-review-toolkit:review-pr) — `src/web/render.ts`
- [~] [debt] `contractMethodClass`/`formatAmount` undefined 가드 — **won't-fix (2026-05-29)**: `BidRow` 필드 타입이 `string | null`/`number | null`만 허용, TS strict가 undefined 유입 차단 → 가드 무효 (source: agy)

### PR #4 — [FEAT] 마감 공고 soft 필터 + from/to 버그 (2026-05-29)

- [x] [debt] LIKE 와일드카드 미이스케이프 — `q`/`dmnd`가 `%${v}%`로 바인딩. 사용자 입력 `%`/`_`/`\`가 매칭 의미 변경. **fix (2026-05-29)**: `escapeLike()` + `ESCAPE '\'` 절 추가, Red→Green (`test/repo.test.ts` "LIKE 와일드카드 이스케이프") (source: security-review) — `src/db/repo.ts`
- [~] [false-positive] from/to·마감일 비교가 compact(`YYYYMMDD`) 저장값에서 깨진다는 지적 — **각하 (2026-05-29)**: prod D1 직접 조회로 `bid_ntce_date`/`bid_clse_date` 모두 대시 `YYYY-MM-DD` 확인. 리뷰어는 stale 픽스처(`202605010900`) 기준 추론 → 픽스처를 실제 포맷으로 정규화해 해소. dash-strip 복원 시 실제 버그 재발 (source: security-review P1, codex P2)

### PR #11 — [FEAT] 어드민 페이지 — 수집 필터 규칙 동적 관리 (2026-05-29)

- [x] [constraint] `filter_rules 시드 무결성` 테스트 순서 의존 + 폴백 마스킹(빈 테이블 시 `getFilterRules`가 DEFAULT 폴백 반환 → 시드 부재를 가려 vacuous). **fix (2026-05-29)**: `test/seed.test.ts` 분리(order-independent) + 비어있음 가드(`rows.length > 0` + `enabled===1`)로 마스킹 차단. 가드 RED 증명(시드 strip → fail) 후 복원 (source: review) — `test/seed.test.ts`
- [~] [doc] `/admin` 비번 미설정 시 503 메시지 `"admin password not configured"` 가 엔드포인트 존재 노출 — **유지 (2026-05-29)**: 분기는 오설정 시에만 발동(prod 항상 `ADMIN_PASSWORD` 설정), `/admin` 경로는 어차피 추측 가능 → 노출 위험 marginal. 운영 디버깅 신호(=설정하라) 유지가 우선. 사용자 결정 (source: review)
- [x] [doc] 시드(`0002`) ↔ `DEFAULT_RULES` 동기 원칙을 AGENTS.md Golden Principles에 명문화 (현재 무결성 테스트로 기계 강제 중). **done (2026-05-29)**: Golden Principle #7 추가, `test/seed.test.ts` 강제 명시 (source: review) — `AGENTS.md`
- [~] [decision] all-disabled → DEFAULT 폴백이 "전체 필터 해제" 의도를 막는다는 지적 — **유지 (2026-05-29)**: 5개 리뷰어 중 4(review-pr·security-review·codex·review)가 fail-safe 타당 판정, agy만 버그 주장. 전체 수집 폭주 방지가 우선 → 동작 유지, 어드민 UI에 폴백 안내 문구 추가로 갈음 (source: agy P1, review P2)
- [~] [decision] CSRF Origin-missing 요청 차단(Origin 필수화) 제안 — **각하 (2026-05-29)**: security-review·review-pr 모두 현 Origin-host 검사가 브라우저 위협 모델에 충분하다 확인(브라우저는 교차출처 POST에 항상 Origin 첨부, 비브라우저 클라엔 ambient credential 없음). Origin 필수화는 정상 클라 차단 위험 (source: agy P2)

### PR #12 — [FEAT] 검색 LIKE → FTS5 + LIKE 하이브리드 검색 전환 (2026-05-31)

- [x] [constraint] D1 FTS5 가상테이블 및 3개 트리거(`bids_ai`, `bids_au`, `bids_ad`) 마이그레이션 적용 — `migrations/0005_bids_fts.sql`
- [x] [debt] FTS5 섀도우 테이블에 의한 `changes()` count 왜곡 버그 해결 — `upsertBids`가 `items.length`를 반환하도록 수정 (source: test-failure) — `src/db/repo.ts`
- [x] [FEAT] FTS5 MATCH 쿼리와 SQL LIKE를 결합한 하이브리드 검색 구현 — 인덱스 탐색 속도와 리터럴 및 특수문자 매칭 정확도를 동시 확보 — `src/db/repo.ts`
- [x] [TEST] FTS5 다중 토큰 AND 검색, 특수문자(%, _, ") 매칭 테스트 케이스 추가 및 갱신 — `test/repo.test.ts`

### PR #13 — [FEAT] 상태 배지 마감일 매칭 & 변경 이력(차수) 추적 최적화 (2026-05-31)

- [x] [FEAT] [badge] 상태가 `"공고중"`이더라도 마감일(`bid_clse_date`)이 오늘 이전인 경우 `"마감"`(`badge-closed`) 배지로 렌더링되도록 수정 — `src/web/render.ts`
- [x] [FEAT] [history] 동일 공고번호의 여러 차수 중 최신 차수만 목록에 단일 노출하고, 이전 차수 이력은 뱃지 링크(`00차`, `01차` 등)로 제목 옆에 렌더링 — `src/db/repo.ts` 및 `src/web/render.ts`
- [x] [TEST] 이전 차수 뱃지 렌더링 검증, 과거 마감 공고의 마감 배지 전환 검증 및 최신 차수 필터링 통합 테스트 추가 — `test/render.test.ts` 및 `test/repo.test.ts`
