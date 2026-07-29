# Architecture

## Overview

A single Cloudflare Worker with two entry points:

- `fetch` — HTTP requests (web UI + JSON API)
- `scheduled` — Cron (UTC 00:00 = KST 09:00) daily collection

## Module Boundaries

```
src/
  index.ts          # Entry point: fetch + scheduled handlers. Top of the dependency direction.
  types.ts          # Env binding types (DB, secrets)
  collector/        # External data collection — 나라장터 (KONEPS) OpenAPI
    client.ts       #   fetch + pagination + XML error-envelope handling
    collect.ts      #   collection orchestration — client → filter → repo
    filter.ts       #   isTargetBid — pure function, no external dependencies
    types.ts        #   BidItem, API response types
  db/
    repo.ts         #   D1 upsert / search queries. SQL lives here only.
  web/
    routes.ts       #   HTTP routes (Hono)
    render.ts       #   HTML templates (server-rendered, no SPA)
    admin.ts        #   Admin routes — login/session, filter-rule CRUD, manual collection
    render-admin.ts #   Admin HTML templates
    favicon.ts      #   Inline favicon SVG constant
```

**Dependency direction:** `index` → {`collector`, `db`, `web`}. `web` → `db` (search). `collector` → `db` (upsert). `filter.ts` is pure — it imports no other module, which keeps it trivially testable. It is consumed by `collector/collect.ts`, `db/repo.ts`, and `web/render.ts`, so its exported signatures (`isTargetBid`, `classifySegments`, `DEFAULT_RULES`, `FilterRules`, `RULE_TYPES`) are a shared contract.

**SQL isolation:** every D1 query lives in `db/repo.ts`. Routes and the collector call repo functions instead.

## Data Flow

**Collection (`scheduled`):**
`client.ts` paginated fetch → only items passing `filter.isTargetBid` → `repo.upsert` (duplicate PKs ignored) → `bids_fts` virtual table synced automatically by triggers.

**Search (`fetch`):**
`routes.ts` query parameters → `repo` hybrid FTS5 MATCH + LIKE search, with a window function selecting the single latest revision and aggregating history → `render.ts` HTML or JSON response (previous-revision badges rendered).

## D1 Schema

Table `bids`, defined in `migrations/0001_initial.sql`.

- **PK `(bid_ntce_no, bid_ntce_ord)`** — notice number + revision. The core of upsert deduplication. Never change it.
- Indexes: `bid_ntce_date`, `dmnd_instt_nm`, `bid_clse_date` (search and sort paths).
- `collected_at` — collection timestamp (NOT NULL).
- Amounts: `asign_bdgt_amt`, `presmpt_prce` as INTEGER.

Virtual table `bids_fts` and triggers (`migrations/0005_bids_fts.sql`):

- **FTS5 virtual table** — full-text search over `bid_ntce_nm` and `dmnd_instt_nm` (`unicode61` tokenizer).
- **Triggers** — `bids_ai`, `bids_au`, `bids_ad` keep FTS5 in sync on INSERT/UPDATE/DELETE against `bids`.

Schema changes go in a new `migrations/000N_*.sql` (never edit an existing file) and are verified with `pnpm migrate:local`.

## Known Constraints

- Search is a hybrid of FTS5 MATCH and SQL LIKE — index-scan performance plus literal matching accuracy for special characters.
- Retention keeps everything: closed and cancelled notices stay searchable so past projects can still be analyzed.
- The proxy can return an XML error envelope even when `type=json` is requested — handled in `client.ts`.
