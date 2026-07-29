# bid-lens — Agent Instructions

Collection and search system for Korean university SW service bid notices from 나라장터 (KONEPS).
Cloudflare Workers (TypeScript, Hono) + D1. Cron UTC 00:00 (KST 09:00). Server-rendered HTML, no SPA.

## Docs Index (read on demand)

| File | When to read |
|------|--------------|
| `docs/architecture.md` | Before changing module boundaries, data flow, or the D1 schema |
| `docs/conventions.md` | Before touching filter rules, TS strict, or TDD rules |
| `docs/workflows.md` | At task start — `code`/`plan`/`draft`/`constrain`/`sweep`/`explore` cycles |
| `docs/delegation.md` | Before spawning a subagent — objective triggers, 4-field contract |
| `docs/eval-criteria.md` | When writing a Sprint Contract or grading QA |
| `docs/runbook.md` | Build/test/deploy commands, env/secrets, incident response |
| `DESIGN.md` | Before web UI work — components, colors, typography |

## Stack

TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) · Biome (lint+format) · Vitest + `@cloudflare/vitest-pool-workers` (D1 integration) · lefthook (pre-commit) · wrangler.

## Critical Files

| Path | Role |
|---|---|
| `src/index.ts` | Worker entry — `fetch` + `scheduled` |
| `src/collector/client.ts` | KONEPS OpenAPI fetch + pagination |
| `src/collector/filter.ts` | `isTargetBid` — university SW service filter |
| `src/collector/types.ts` | `BidItem`, API response types |
| `src/db/repo.ts` | D1 upsert / search queries |
| `src/web/routes.ts` | HTTP routes (`GET /`, `GET /api/bids`) |
| `src/web/render.ts` | HTML template renderer |
| `src/types.ts` | `Env` binding types |
| `migrations/0001_initial.sql` | D1 schema |

## Golden Principles

Violations block the commit. Each one has a mechanical enforcement mechanism.

1. **Filter changes go Red→Green in `test/filter.test.ts`** — test first, before changing `isTargetBid` rules. Enforced by pre-commit (full vitest suite, which includes filter.test.ts).
2. **D1 upsert PK `(bid_ntce_no, bid_ntce_ord)`** — the deduplication guarantee. Never break it. Enforced by the schema PK constraint.
3. **pre-commit must be green** — typecheck + lint + test all pass. Enforced by `lefthook.yml`.
4. **Never commit directly to `main`** — always branch first (`<type>/<slug>`). Enforced by git convention.
5. **No secrets in code or git** — `.dev.vars` (local) and wrangler secrets (remote) only. Enforced by `.gitignore` + `.claudeignore`.
6. **Agent Integrity** — never guess a value you have not directly verified; mark it `[unknown — read {source}]`.
7. **`filter_rules` seed (`migrations/0002`) stays in sync with `DEFAULT_RULES` (`src/collector/filter.ts`)** — no drift. Enforced by `test/seed.test.ts` (seed rows exist, `getFilterRules` == `DEFAULT_RULES`, fallback masking blocked).

## Commands

```bash
pnpm dev          # local (wrangler dev)
pnpm test         # vitest run
pnpm typecheck    # tsc --noEmit
pnpm lint         # biome check .
pnpm lint:fix     # biome check --write .
pnpm migrate:local    # D1 migrations — local
pnpm migrate:remote   # D1 migrations — deployed
pnpm deploy       # wrangler deploy
```

## Delegation

Solo-developed. **Inline is the default** — no standing orchestrator. Objective triggers and the 4-field contract live in `docs/delegation.md`.

**Overrides global `~/.claude/CLAUDE.md` Delegation gate** (10+ files · 3+ independent units · only when asked). This repo spawns at lower thresholds and makes `qa-verifier` mandatory without a user ask. Repo wins — do not re-derive.

- **Mandatory (blocking):** always spawn `qa-verifier` after a source edit. Whoever implemented must never verify their own work. The only named role (`.claude/agents/qa-verifier.md`).
- **Conditional:** first read of a >300 LOC file · touching ≥2 directories · implementing ≥3 files · analyzing >20 lines of output → `general-purpose`.
- Everything else is inline. Create a dedicated role once the same delegation type recurs 3×.

<!-- harness:verbatim — harness-init Step 3 mandated block; do not trim as boilerplate -->
## Token Economy

1. Never re-read a file already read this session — check changes via diff or the relevant region only.
2. No tool calls to confirm what is already known.
3. Run independent tool calls in parallel.
4. Delegate analysis of >20 lines of output to a subagent; take back only the conclusion.
5. Never restate what the user said.

## Language Policy

`docs/*.md`, `.claude/agents/*.md`, code, comments, commit messages, and PRs are **English**. Only user-facing conversation is Korean. Domain terms that exist only in Korean (`대학`, `용역`, filter keywords, KONEPS field labels) stay in Korean — they are data, not prose. Matching a neighboring file's language never overrides this rule.

<!-- harness:verbatim — harness-init Step 3 mandated block; do not trim as boilerplate -->
## Maintenance

Edit this file only when **all four** are true:

1. Not directly discoverable from code, config, manifests, or docs
2. Operationally important — affects build, test, deploy, or runtime safety
3. Likely to cause mistakes if left undocumented
4. Stable and not task-specific

**Do not add:** architecture summaries, directory overviews, style rules the tooling already enforces, anything already visible in the repo, temporary or task-specific instructions. Prefer editing or deleting stale entries over appending. Move long content to `docs/*.md` and leave only a pointer. Size budget: target ≤100 lines, warn above 120.

**Memory boundary:** repo facts (architecture, conventions, golden principles) belong in this file and `docs/` — version-controlled. Auto-memory (`MEMORY.md`) is for cross-session user preferences and working habits only, never code facts.
