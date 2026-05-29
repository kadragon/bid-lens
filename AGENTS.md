# bid-lens — Agent Instructions

나라장터 대학 SW 용역 입찰공고 수집·검색 시스템.
Cloudflare Workers (TypeScript, Hono) + D1. Cron UTC 00:00 (KST 09:00). 서버렌더 HTML, SPA 없음.

## Docs Index (read on demand)

| File | When to read |
|------|--------------|
| `docs/architecture.md` | 모듈 경계·데이터 흐름·D1 스키마 변경 전 |
| `docs/conventions.md` | 필터 규칙·TS strict·TDD 규칙 작업 전 |
| `docs/runbook.md` | 빌드/테스트/배포 명령·env/secret·장애 대응 |

## Stack

TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) · Biome (lint+format) · Vitest + `@cloudflare/vitest-pool-workers` (D1 통합) · lefthook (pre-commit) · wrangler.

## Critical Files

| 경로 | 역할 |
|---|---|
| `src/index.ts` | Worker 엔트리 — `fetch` + `scheduled` |
| `src/collector/client.ts` | 나라장터 OpenAPI fetch + 페이지네이션 |
| `src/collector/filter.ts` | `isTargetBid` — 대학 SW 용역 필터 |
| `src/collector/types.ts` | `BidItem`, API 응답 타입 |
| `src/db/repo.ts` | D1 upsert / 검색 쿼리 |
| `src/web/routes.ts` | HTTP 라우트 (`GET /`, `GET /api/bids`) |
| `src/web/render.ts` | HTML 템플릿 렌더러 |
| `src/types.ts` | `Env` 바인딩 타입 |
| `migrations/0001_initial.sql` | D1 스키마 |

## Golden Principles

위반 시 커밋 차단. 각 항목은 기계적 강제 수단 보유.

1. **필터 변경은 `test/filter.test.ts` Red→Green** — `isTargetBid` 규칙 변경 전 테스트 먼저. 강제: vitest + lefthook.
2. **D1 upsert PK `(bid_ntce_no, bid_ntce_ord)`** — 중복 방지, 절대 깨지 말 것. 강제: 스키마 PK 제약.
3. **pre-commit green 필수** — typecheck + lint + test 전부 통과. 강제: `lefthook.yml`.
4. **`main` 직접 커밋 금지** — 항상 브랜치 먼저 (`<type>/<slug>`). 강제: git 규칙.
5. **secret은 코드/git 금지** — `.dev.vars`(로컬)·wrangler secret(원격)만. 강제: `.gitignore` + `.claudeignore`.
6. **Agent Integrity** — 직접 확인 안 한 값은 추측 금지, `[unknown — read {source}]` 표기.

## Commands

```bash
pnpm dev          # 로컬 (wrangler dev)
pnpm test         # vitest run
pnpm typecheck    # tsc --noEmit
pnpm lint[:fix]   # biome check [--write] .
pnpm migrate:local|remote   # D1 마이그레이션
pnpm deploy       # wrangler deploy
```

## Delegation

Solo 개발, fresh 리포. 상시 에이전트/오케스트레이터 **없음**. 같은 위임 유형 3× 반복 시 `.claude/agents/` 역할 생성 (전역 CLAUDE.md 규칙). 광범위 작업 → 서브에이전트, 외과적 → 직접.

## Token Economy

1. 세션 내 이미 읽은 파일 재읽기 금지 — 변경 확인은 diff/영역만.
2. 이미 아는 정보 확인용 도구 호출 금지.
3. 독립 도구 호출은 병렬로.
4. >20줄 출력 분석은 서브에이전트로, 결론만 회수.
5. 사용자 말 재진술 금지.

## Git Rules

- `main` 직접 커밋 금지 — 브랜치 먼저.
- 커밋 타입: `[FEAT]` `[FIX]` `[TEST]` `[REFACTOR]` `[HARNESS]` `[CONSTRAINT]` `[DOCS]` `[PLAN]`.
- pre-commit: typecheck + lint + test 전부 green.

## Maintenance

이 파일은 다음 4개 **모두** 참일 때만 수정:

1. 코드/설정/매니페스트/docs에서 직접 발견 불가
2. 운영상 중요 — 빌드·테스트·배포·런타임 안전에 영향
3. 미문서화 시 실수 유발 가능성 높음
4. 안정적이며 작업 특화 아님

**추가 금지:** 아키텍처 요약, 디렉터리 개요, 툴이 이미 강제하는 스타일 규칙, 리포에 이미 보이는 것, 임시/작업 특화 지침. 오래된 항목은 추가보다 수정/삭제. 긴 내용은 `docs/*.md`로 이동 후 포인터만. 크기 예산: 목표 ≤100줄, 경고 >120줄.
