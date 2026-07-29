# Evaluation Criteria

The evaluator is a **different role** from the generator. Agents asked to evaluate their own work are systematically lenient — they praise mediocre output and talk themselves out of defects they correctly identified. This separation is the single highest-impact decision in the harness.

In this repo the evaluator is `.claude/agents/qa-verifier.md`, spawned as a mandatory gate at `docs/workflows.md` → `code` Step 4.

## Sprint Contract

Agree on "done" before implementing. It lives in `tasks.md` as an h1 block while the sprint is active, and is deleted when the work merges.

```markdown
# <sprint title>
status: active

## Scope
- Target files/areas (absolute paths)

## Acceptance criteria
- [ ] <one checkbox per item — concrete and verifiable; never merge items into one vague line>
- [ ] <not "it works" but "case X in `pnpm test` passes">

## Out of scope
- Explicit exclusions — prevents scope creep

## Lint/test command
pnpm typecheck && pnpm lint && pnpm test
```

Without a contract the evaluator grades against vague expectations and the generator builds against vague goals. Both drift.

## Grading Criteria

Four criteria. Weights are deliberately uneven.

### 1. Correctness (35%)

Do filter, query, and render produce right results for real inputs?

| Score | Description |
|---|---|
| 5 | Happy path plus boundary values verified (zero amount, empty string, special characters, same-day deadline) |
| 4 | Happy path verified; some boundaries unverified but low risk |
| 3 | Happy path only — the minimum bar |
| 2 | Defect on the happy path; wrong result for some real input |
| 1 | Basic scenario is broken |

**How to test:** run `pnpm test`, then exercise the changed function's boundary values directly. Passing tests alone do not earn a 5 — confirm in the file that the boundary cases actually exist.

### 2. Data Integrity (25%)

Does the collect/store path avoid duplication, loss, and silent corruption?

| Score | Description |
|---|---|
| 5 | Idempotent upsert confirmed, PK `(bid_ntce_no, bid_ntce_ord)` preserved, migration verified locally |
| 4 | Idempotency confirmed; no migration involved |
| 3 | PK constraint intact, idempotency unverified |
| 2 | Re-running produces duplicates or a distorted count |
| 1 | PK broken or data lost |

**How to test:** the D1 integration tests in `pnpm test`, plus upserting the same input twice and confirming the row count is unchanged. For schema changes, confirm `pnpm migrate:local` succeeds.

### 3. Verifiability (20%)

Were the TDD rules in `docs/conventions.md` followed?

| Score | Description |
|---|---|
| 5 | Filter change proved Red→Green, D1 change covered by real D1 integration test, no mocking |
| 4 | Tests present, Red stage not demonstrated |
| 3 | Some test covers the behavior |
| 2 | Behavior changed with no test |
| 1 | An existing test was weakened to make the implementation pass |

**Automatic penalty:** modifying, deleting, or skipping an existing test to get a green run scores **1, unconditionally** — and the sprint fails regardless of every other score.

### 4. Web UI Consistency (20%)

Does it follow `DESIGN.md` components, colors, and typography, and stay server-rendered (no SPA)?

| Score | Description |
|---|---|
| 5 | Uses DESIGN.md tokens; both mobile and desktop layouts checked |
| 4 | Uses tokens; only one viewport checked |
| 3 | Visually consistent with existing styles |
| 2 | Hard-coded values that diverge from existing tokens |
| 1 | Broken layout, or a client-side JS framework introduced |

**Not applicable:** for sprints that do not touch `src/web/`, drop this criterion and redistribute its weight proportionally across the other three.

## Pass Threshold

- **Every criterion ≥3** — no dimension is broken
- **Weighted average ≥3.5**
- **Any failed Acceptance criteria item fails the sprint** — high scores elsewhere never average it away

## Evaluator Protocol

1. Read the Acceptance criteria from the Sprint Contract in `tasks.md`.
2. Read the grading criteria in this document.
3. Run `pnpm typecheck && pnpm lint && pnpm test` and quote the output verbatim.
4. List pass/fail per contract item **with evidence** first. Scores come after evidence, never before.
5. Grade each criterion independently. A strong score on one criterion never excuses weakness on another.
6. Below threshold → record findings in `tasks.md` → fix → re-evaluate once.

The evaluator is **skeptical by default**: look for what is broken, not for what works.

## Evaluator Self-Deception

The most common evaluator failure is not missing a bug — it is finding one and then reasoning it away.

> "Zero-budget notices do render as '미정', but the overall rendering is fine and it's a minor display issue, so I'll give it a 4."

Structurally this is the delegation-bypass problem: identify the issue correctly, then apply subjective reasoning to downgrade its severity. Across several criteria it compounds into inflated scores.

**Countermeasures:**

1. Grade each criterion independently; do not reference earlier scores.
2. Evidence first — list concrete findings before assigning any score.
3. A failed Acceptance criterion is a hard failure, not something an average can absorb.

## Calibration Examples

Drawn from this repo's own history (see the `tasks.md` Review Backlog).

### Score 2 — Correctness

`formatAmount(0)` used a falsy check (`if (!amount)`), so notices with a zero budget rendered as "미정" (`src/web/render.ts:4`, PR #2).

**Why 2:** the happy path (positive amounts) worked, but a real input value (zero) displayed false information to users. The render functions had no unit tests, which is why it went unnoticed. "Mostly works" does not justify a 3 — this was wrong on actual data, not on an exotic edge case.

### Score 2 — Data Integrity

After the FTS5 virtual table landed, `upsertBids` returned `changes()`, which counted shadow-table updates and distorted the collected-row count (`src/db/repo.ts`, PR #12).

**Why 2:** storage itself was correct, but the returned count was wrong, so operational logs quietly lied. No data was lost, so not a 1 — but observed values diverge on re-run, which rules out a 3.

### Score 5 — Verifiability

Unescaped LIKE wildcards fixed in `src/db/repo.ts` (PR #4): user input containing `%`, `_`, or `\` changed matching semantics, resolved with `escapeLike()` plus an `ESCAPE '\'` clause.

**Why 5:** a reproducing test (`test/repo.test.ts`, "LIKE 와일드카드 이스케이프") was added first and confirmed Red, then the minimal change turned it green. It is a real D1 integration test with no mocking, and no existing case was touched.

## Calibration Tuning

Calibrating an evaluator is iterative, not one-shot. Read the reasoning trace in the evaluation log — not just the final scores — find where it diverges from human judgment, and sharpen the criteria in this document accordingly. The first version of any criteria set is almost always too generous; expect several rounds of tightening.
