# Conventions

Rules already enforced by Biome or tsconfig are not repeated here. This file covers only what agents get wrong repeatedly.

## Collection Filter — `isTargetBid`

Lives in `src/collector/filter.ts`. **Changing it requires Red→Green in `test/filter.test.ts` first.**

AND conditions, in order:

1. `dmndInsttNm` contains `대학`
2. `dmndInsttNm` does not contain `병원`
3. `bsnsDivNm == "용역"`
4. `bidNtceNm` does not contain `유지보수`
5. Among the comma-separated segments of `bidprcPsblIndstrytyNm` — contains an SW keyword AND contains no excluded industry

- SW keywords: `소프트웨어`, `컴퓨터`, `정보보호`, `이러닝서비스업`, `정보통신`
- Excluded industries: `디지털콘텐츠개발서비스사업`

Keep `filter.ts` a pure function — no external dependencies, no IO. Add new keywords to the constant arrays.

## TDD Rules

- Filter rule change → add a new failing case to `filter.test.ts` (Red), confirm it fails, then implement (Green). **Never modify existing cases.**
- D1 repo change → add an integration test to `test/repo.test.ts` (real D1 via `@cloudflare/vitest-pool-workers`).
- Mocking is disallowed by default — integration tests come first. Mock only external IO and non-deterministic dependencies.

## TypeScript

Full strict mode plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. What that means in practice:

- Indexing an array or object yields `T | undefined` — narrowing is mandatory.
- An optional property cannot be explicitly assigned `undefined` — omit the key itself.
- No `any`. If the type is unknown, use `unknown` and narrow.

## SQL

Every query belongs in `src/db/repo.ts`. Routes and the collector go through repo functions. Always use bound parameters — never string interpolation (SQL injection).

- **Hybrid FTS5 search:** when using FTS5 `MATCH`, AND it together with a SQL `LIKE` filter. The hybrid preserves literal matching accuracy for special characters such as `%`, `_`, and `"`.
- **Single latest revision:** to surface one row per notice number (`bid_ntce_no`) without duplicates, use `ROW_NUMBER() OVER (PARTITION BY bid_ntce_no ORDER BY bid_ntce_ord DESC)`.

## Date Column Format

D1 date columns such as `bid_ntce_date` and `bid_clse_date` store the raw OpenAPI value as **`YYYY-MM-DD`** — dashed, date only, no time (time lives in the separate `bid_clse_tm` column). `client.ts` loads it without conversion.

- **Never convert the format for comparisons.** Dashed `YYYY-MM-DD` is fixed-width and zero-padded, so lexicographic order equals chronological order and `>=` / `<=` are exact as-is. Converting (stripping dashes, for instance) silently breaks comparison — this was the actual cause of the from/to bug.
- `<input type="date">` values are also `YYYY-MM-DD`, so they bind directly.
- Empty values are stored as `""`, not NULL (`BidItem` fields are non-null strings). Filters must handle both `IS NULL` and `= ''`.
