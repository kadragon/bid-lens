# Workflows

Pick one primary workflow per cycle. Permitted side-effects are listed at the bottom.

This repo is solo-developed and ships a single Worker, so `code` covers most work. Use `plan` only for multi-session features. `debate` is not adopted (no Agent Teams here).

## `code` — Implementation

The default cycle for behavioral change. The steps below are **named stages**, not "consult if needed" references.

**Step 0 — Branch**
Always branch before editing. If on `main`, run `git checkout -b <type>/<slug>`.
Prefixes: `feat/` `fix/` `refactor/` `test/` `harness/` `docs/`. (AGENTS.md Golden Principle #4)

**Step 1 — Scope check (delegation gate)**
Check the objective triggers in the `docs/delegation.md` routing table. If any fires, run exploration before editing. If none fire, go straight to Step 2.

**Step 2 — Sprint Contract**
Define "done" in concrete, verifiable terms before writing code. Template: `docs/eval-criteria.md` → Sprint Contract. It lives in `tasks.md` only while the sprint is active.

Testing approach depends on what changes (`docs/conventions.md` holds the authoritative TDD rules):

| Change target | Approach |
|---|---|
| `src/collector/filter.ts` filter rules | **Red→Green required** — add the failing case to `test/filter.test.ts` first. Never edit existing cases |
| `src/db/repo.ts` queries | Add a D1 integration test to `test/repo.test.ts` (real D1, no mocking) |
| `src/web/render*.ts` | Unit test in `test/render.test.ts` |
| Bug fixes generally | Reproducing test first, then the minimal change that turns it green |
| Schema | Add a new `migrations/000N_*.sql` (never edit an existing one), verify with `pnpm migrate:local` |

**Step 3 — Implement**
For ≤2 files, edit inline. Beyond that, hand a `general-purpose` subagent the Sprint Contract, absolute paths of every in-scope file, and the `pnpm test` command, using the 4-field contract in `docs/delegation.md` → Spawn Prompt Contract. Whoever implements does not verify their own output.

**Step 4 — Post-implementation QA (mandatory)**
Always spawn the `qa-verifier` agent **separately**. The session or agent that implemented must never verify its own work — no exceptions. Grading is against Sprint Contract criteria; "looks right" is not a verdict.

On blocking findings: report to the user → fix → re-run `qa-verifier` once. If still blocking after that one retry, stop and report rather than proceeding.

**Step 5 — Verification gate**
`pnpm typecheck && pnpm lint && pnpm test` must all be green. The lefthook pre-commit hook enforces the same three, so a miss here is caught again at commit time.

**Step 6 — Review and merge**
Hand off to `Skill(dev:task-review)` — it commits, opens the PR, collects reviews, waits for CI, and merges. Direct pushes to `main` are prohibited in this repo.

## `plan` — Spec Generation

Expand a short request into a spec. Use it for multi-session or structural work; skip it for small features.

1. Write `docs/design/{feature}.md` with user stories, high-level technical design, and a phased feature list. **No granular implementation detail** — errors here cascade downstream.
2. Review with the user. Do not proceed before approval.
3. Decompose the approved spec into `backlog.md` items.

## `draft` — Documentation

Write or update `docs/`. Ground every claim in current code. **Never modify production code.** If writing the doc reveals a missing constraint, add an item to `backlog.md` / `tasks.md` and stop there.

## `constrain` — Structural Enforcement

Turn a Golden Principle from prose into machinery.

1. Write the structural test or lint rule **first**.
2. Run it and confirm it fails.
3. If current code violates it, add a remediation item to `backlog.md` — do not fix it here.
4. Update `docs/architecture.md` and the AGENTS.md Golden Principles.

Existing example: Golden Principle #7 (seed ↔ `DEFAULT_RULES` sync) is enforced by `test/seed.test.ts`.

## `sweep` — Garbage Collection

Run between features. Record findings in `tasks.md` tagged `[doc]`, `[constraint]`, `[debt]`, or `[harness]`. Fix trivial items inline; leave the rest.

The harness itself is in scope: "is this component still compensating for a real model limitation?" If not, delete it.

## `explore` — Research

State the question → research or prototype → report options and trade-offs → **do not commit**. If approved, flows into `plan` or `code`.

---

## Permitted Side-Effects

| Primary workflow | Permitted |
|---|---|
| `code` | Add discovered issues to `tasks.md` as `[doc]` / `[constraint]` items |
| `code` | Update related `docs/` after implementing |
| `draft` | Add a `backlog.md` item when the doc reveals missing behavior |
| `sweep` | Fix trivial `[doc]` items inline |

**Not permitted:** writing production code during `draft` or `sweep`.

---

## Sprint Files

- `backlog.md` — queue of work not yet started. Always present.
- `tasks.md` — active Sprint Contract plus the review backlog. Delete the sprint block when it lands.

`tasks.md` h1 sprint block schema:

```markdown
# <sprint title>
status: open | active

## Covers
- [ ] <item line copied verbatim from backlog.md>

## Scope
## Acceptance criteria
## Out of scope
## Lint/test command
```

## Context Anxiety — Not Adopted

Countermeasures for the pattern where a model stubs out later work or declares "done" early (forced context resets, handoff files) are **deliberately not installed**. The current model (Opus 5, 1M context) is told by its own base instructions that context is summarized and handed back, so the premise behind those countermeasures does not hold here.

Re-examine if any of the following is actually observed in this repo's sessions:

- Later backlog items consistently lower quality than earlier ones
- Remaining work replaced by a summary instead of being done
- Only the first few of many planned items implemented fully, the rest stubbed
