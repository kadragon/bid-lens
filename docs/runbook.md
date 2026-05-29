# Runbook

## 명령

```bash
pnpm dev              # 로컬 개발 — wrangler dev
pnpm test             # vitest run (D1 통합 포함)
pnpm test:watch       # vitest watch
pnpm typecheck        # tsc --noEmit
pnpm lint             # biome check .
pnpm lint:fix         # biome check --write .
pnpm migrate:local    # D1 마이그레이션 — 로컬
pnpm migrate:remote   # D1 마이그레이션 — 배포 환경
pnpm deploy           # wrangler deploy
```

pre-commit (lefthook): typecheck + lint + test 순차 실행, 전부 green이어야 커밋 통과.

## Env / Secrets

| 이름 | 종류 | 설명 |
|---|---|---|
| `OPEN_DATA_API_PROXY_URL` | secret | 나라장터 OpenAPI 프록시 베이스 URL |
| `OPEN_DATA_X_API_KEY` | secret | x-api-key 헤더값 |
| `LOG_LEVEL` | var (wrangler.toml) | `"info"` |
| `DB` | D1 바인딩 | `bid-lens` 데이터베이스 |

**로컬:** `.dev.vars`에 secret 설정 (`.gitignore` 포함, 커밋 금지).

```
# .dev.vars
OPEN_DATA_API_PROXY_URL=https://...
OPEN_DATA_X_API_KEY=...
```

**원격:** `wrangler secret put OPEN_DATA_API_PROXY_URL` / `wrangler secret put OPEN_DATA_X_API_KEY`.

## 배포

1. `pnpm migrate:remote` — 스키마 변경 시 먼저.
2. `pnpm deploy`.
3. Cron `0 0 * * *` (UTC) 자동 — `scheduled` 핸들러 실행.

## 장애 대응

- **수집 0건:** 프록시 응답이 XML 에러 봉투인지 확인 (`type=json`이어도 발생 가능). `client.ts`가 처리하나 키/URL 만료 가능 — secret 확인.
- **D1 마이그레이션 실패:** 로컬(`migrate:local`)에서 재현 후 수정. 기존 마이그레이션 수정 금지, 새 파일 추가.
- **타입/린트 에러로 커밋 차단:** `pnpm typecheck` / `pnpm lint:fix` 직접 실행해 원인 확인.

## 데이터 확인

```bash
wrangler d1 execute bid-lens --local --command "SELECT COUNT(*) FROM bids"
wrangler d1 execute bid-lens --remote --command "SELECT COUNT(*) FROM bids"
```
