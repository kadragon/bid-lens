# bid-lens — Agent Instructions

## Project

나라장터 대학 SW 용역 입찰공고 수집·검색 시스템.
- **Runtime:** Cloudflare Workers (TypeScript, Hono)
- **DB:** Cloudflare D1 (SQLite)
- **Trigger:** Cron UTC 00:00 daily (= KST 09:00)
- **UI:** 서버렌더 HTML — SPA/WASM 없음

## Stack

| 도구 | 역할 |
|---|---|
| TypeScript strict | 타입 안전성 (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Biome | lint + format 단일 도구 |
| Vitest + `@cloudflare/vitest-pool-workers` | D1 포함 통합 테스트 |
| lefthook | pre-commit 게이트 (typecheck + lint + test) |
| wrangler | 배포·D1·secret 관리 |

## Critical Files

| 경로 | 역할 |
|---|---|
| `src/index.ts` | Worker 엔트리 — `fetch` + `scheduled` 핸들러 |
| `src/collector/client.ts` | 나라장터 OpenAPI fetch + 페이지네이션 |
| `src/collector/filter.ts` | `isTargetBid` — 대학 SW 용역 필터 규칙 |
| `src/collector/types.ts` | `BidItem`, API 응답 타입 |
| `src/db/repo.ts` | D1 upsert / 검색 쿼리 |
| `src/web/routes.ts` | HTTP 라우트 (`GET /`, `GET /api/bids`) |
| `src/web/render.ts` | HTML 템플릿 렌더러 |
| `src/types.ts` | `Env` 바인딩 타입 |
| `migrations/0001_initial.sql` | D1 스키마 |

## Commands

```bash
pnpm dev          # 로컬 개발 (wrangler dev)
pnpm test         # vitest run
pnpm typecheck    # tsc --noEmit
pnpm lint         # biome check .
pnpm lint:fix     # biome check --write .
pnpm migrate:local   # D1 마이그레이션 로컬
pnpm migrate:remote  # D1 마이그레이션 배포
pnpm deploy       # wrangler deploy
```

## D1 Schema

PK: `(bid_ntce_no, bid_ntce_ord)` — upsert 중복 방지.
인덱스: `bid_ntce_date`, `dmnd_instt_nm`, `bid_clse_date`.

## 수집 필터 (isTargetBid)

변경 전 반드시 `test/filter.test.ts` 테스트 통과 확인.

1. `dmndInsttNm` "대학" 포함
2. `dmndInsttNm` "병원" 미포함
3. `bsnsDivNm == "용역"`
4. `bidNtceNm` "유지보수" 미포함
5. `bidprcPsblIndstrytyNm` 세그먼트(쉼표 분리) 중 SW 키워드 포함 + "디지털콘텐츠개발서비스사업" 미포함
   - SW 키워드: 소프트웨어, 컴퓨터, 정보보호, 이러닝서비스업, 정보통신

## Env / Secrets

| 이름 | 종류 | 설명 |
|---|---|---|
| `OPEN_DATA_API_PROXY_URL` | secret | 나라장터 OpenAPI 프록시 베이스 URL |
| `OPEN_DATA_X_API_KEY` | secret | x-api-key 헤더값 |
| `LOG_LEVEL` | var (wrangler.toml) | "info" |

로컬 개발: `.dev.vars` 파일에 secret 설정 (`.gitignore`에 포함됨).

```
# .dev.vars
OPEN_DATA_API_PROXY_URL=https://...
OPEN_DATA_X_API_KEY=...
```

## Git Rules

- `main` 직접 커밋 금지 — 항상 브랜치 먼저
- 커밋 타입: `[FEAT]` `[FIX]` `[TEST]` `[REFACTOR]` `[HARNESS]` `[CONSTRAINT]` `[DOCS]`
- pre-commit: typecheck + lint + test 전부 green 필수

## TDD 규칙

필터 규칙 변경 → `filter.test.ts` Red 먼저, Green 구현.
D1 repo 변경 → `test/repo.test.ts` 통합 테스트 추가.

## Known Limitations / TODO

- 검색: 현재 LIKE 기반. 복잡한 전문검색 필요 시 FTS5 가상테이블 추가 가능
- 보존 정책: 현재 전량 보존 (마감 지난 공고 포함)
- 프록시가 `type=json`이어도 XML 에러 봉투 반환 가능 — `client.ts`에서 처리됨
