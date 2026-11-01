# Runbook

## Commands

```bash
pnpm dev              # Local development — wrangler dev
pnpm CI               # Typecheck, lint, and tests — same command as GitHub Actions
pnpm test             # vitest run (includes D1 integration)
pnpm test:watch       # vitest watch
pnpm typecheck        # tsc --noEmit
pnpm lint             # biome check .
pnpm lint:fix         # biome check --write .
pnpm filter:trial     # Compare draft filter rules on local samples — see below
pnpm migrate:local    # D1 migrations — local
pnpm migrate:remote   # D1 migrations — deployed environment
pnpm deploy           # wrangler deploy
```

pre-commit (lefthook) runs typecheck + lint + test in sequence; all three must be green for the commit to go through.

## Filter Rule Trial

Before saving a rule change in `/admin`, check which sample notices it flips:

```bash
pnpm filter:trial --samples test/fixtures/filter-samples.json --draft draft.json [--current current.json]
```

- `draft.json` / `current.json` are full `FilterRules` objects (all six camelCase keys, string arrays). `--current` defaults to `DEFAULT_RULES`, which can differ from the live D1 `filter_rules` — pass a snapshot to compare against production. Like production, patterns are trimmed, empty patterns are rejected, and an all-empty rule set falls back to `DEFAULT_RULES`.
- Samples are any JSON array of notices with `dmndInsttNm`, `bsnsDivNm`, `bidNtceNm`, `bidprcPsblIndstrytyNm` (raw KONEPS items fit).
- Output lists newly excluded / newly included notices with the deciding `rule_type` and keyword. It reads local files only (no network, no D1) and decides through `explainBid`, the same function `isTargetBid` uses.
- Results cover the samples only. Rejected notices are never stored, so the D1 table cannot reveal what a rule drops.
- Runs on Node's built-in TypeScript stripping; `scripts/` is outside `tsconfig` (no Node types), so the script stays thin (file reading, printing, exit codes). `compareRules` and the pure parse/validate functions (`parseFilterRules`, `parseFilterInputs`) live in `src/collector/filter.ts` and are tested in `test/filter.test.ts`.

## pnpm Configuration

The pnpm version is pinned once, in `package.json` `"packageManager"`. CI (`pnpm/action-setup`) and
Cloudflare Workers Builds both read it — never re-pin a version in `.github/workflows/CI.yml`. A CI
pnpm older than the one that wrote the lockfile fails `pnpm install --frozen-lockfile` with
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.

pnpm settings live in `pnpm-workspace.yaml` (`overrides`, `allowBuilds`). The `pnpm` field in
`package.json` is **not read** by pnpm ≥10 — moving settings there silently disables them.

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
