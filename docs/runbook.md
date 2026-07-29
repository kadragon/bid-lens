# Runbook

## Commands

```bash
pnpm dev              # Local development — wrangler dev
pnpm test             # vitest run (includes D1 integration)
pnpm test:watch       # vitest watch
pnpm typecheck        # tsc --noEmit
pnpm lint             # biome check .
pnpm lint:fix         # biome check --write .
pnpm migrate:local    # D1 migrations — local
pnpm migrate:remote   # D1 migrations — deployed environment
pnpm deploy           # wrangler deploy
```

pre-commit (lefthook) runs typecheck + lint + test in sequence; all three must be green for the commit to go through.

## Env / Secrets

| Name | Kind | Description |
|---|---|---|
| `OPEN_DATA_API_PROXY_URL` | secret | Base URL of the KONEPS OpenAPI proxy |
| `OPEN_DATA_X_API_KEY` | secret | Value for the `x-api-key` header |
| `ADMIN_PASSWORD` | secret | Basic Auth password for `/admin` (username fixed to `admin`). Unset → `/admin` returns 503. |
| `LOG_LEVEL` | var (wrangler.toml) | `"info"` |
| `DB` | D1 binding | The `bid-lens` database |

**Local:** put secrets in `.dev.vars` (gitignored, never commit). See `.dev.vars.example`.

```
# .dev.vars
OPEN_DATA_API_PROXY_URL=https://...
OPEN_DATA_X_API_KEY=...
ADMIN_PASSWORD=...
```

**Remote:** `wrangler secret put OPEN_DATA_API_PROXY_URL` / `wrangler secret put OPEN_DATA_X_API_KEY` / `wrangler secret put ADMIN_PASSWORD`.

## Deployment

1. `pnpm migrate:remote` — first, whenever the schema changed.
2. `pnpm deploy`.
3. Cron `0 0 * * *` (UTC) runs the `scheduled` handler automatically.

## Incident Response

- **Zero rows collected:** check whether the proxy returned an XML error envelope (it can happen even with `type=json`). `client.ts` handles that case, but the key or URL may have expired — verify the secrets.
- **D1 migration failure:** reproduce locally with `migrate:local` and fix there. Never edit an existing migration; add a new file.
- **Commit blocked by type/lint errors:** run `pnpm typecheck` or `pnpm lint:fix` directly to see the cause.

## Inspecting Data

```bash
wrangler d1 execute bid-lens --local --command "SELECT COUNT(*) FROM bids"
wrangler d1 execute bid-lens --remote --command "SELECT COUNT(*) FROM bids"
```
