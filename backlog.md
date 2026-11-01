# Backlog

## Next

## Done

- [x] 검색 LIKE → FTS5 가상테이블 + LIKE 하이브리드 검색 전환 (2026-05-31)
- [x] 보존 정책 — soft 필터 채택 (삭제 없음). 기본 검색에서 마감(`bid_clse_date < today` KST) 제외 + "마감 포함" 토글. `searchBids` `includeClosed`/`today` 파라미터.

## Review Backlog

### PR #70 — [FEAT] Add filter rule trial CLI to compare draft rules on samples (2026-11-01)

- [ ] [constraint] `loadRules`/`loadSamples` (trim, empty-pattern reject, all-empty → DEFAULT_RULES fallback) have no automated test — scripts/ runs under Node, outside vitest-pool-workers; consider moving the pure parse/validate into `src/` and testing it there (source: qa-verifier) — `scripts/filter-trial.mts:58` (introduced here)
