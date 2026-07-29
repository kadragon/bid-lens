# Delegation

**Inline is the default.** This repo is solo-developed, ~2,200 LOC of source, one Worker. For most work, delegation costs more than it returns. Delegate only when a trigger below fires.

There is no standing orchestrator or agent team. `qa-verifier` is the only named role; everything else routes to a `general-purpose` subagent.

## Routing Table

### Mandatory gate (blocking)

Skipping this is treated as a Golden Principle violation.

| Trigger (objective) | Delegate to | Context to pass |
|---|---|---|
| After any source edit — always | `qa-verifier` | Changed file list, Sprint Contract, `pnpm test` |

`qa-verifier` **must** be a different instance from whoever implemented. Why this is the harness's only blocking gate: see `docs/eval-criteria.md` → self-evaluation leniency.

### Conditional gates

| Trigger (objective) | Delegate to | Context to pass |
|---|---|---|
| Target file >300 LOC and not yet read this session | `general-purpose` (read-only exploration) | Absolute file path, `docs/architecture.md` |
| Change touches ≥2 of `src/collector` / `src/db` / `src/web` | `general-purpose` (read-only exploration) | Changed paths, `docs/architecture.md` |
| Implementation spans ≥3 files | `general-purpose` (implementation) | Sprint Contract, absolute paths, `pnpm test` |
| Analyzing >20 lines of output (logs, large grep results) | `general-purpose` | Command/paths, the conclusion needed |

Files over 300 LOC as of 2026-07: `src/web/render.ts` (540) · `src/web/render-admin.ts` (365) · `src/db/repo.ts` (364) · `src/web/admin.ts` (302).

### When not to delegate

- Change spans ≤2 files — inline is cheaper
- Subtasks are tightly coupled (sequential or judgment-heavy)
- Every agent would need identical context
- Single-fact lookup where the file, symbol, or value is already known

## Spawn Prompt Contract (all 4 fields required)

Every spawn passes these four fields, without exception. Omitting any of them lets the subagent widen its own scope, which produces duplicated or misaligned work.

```markdown
- Objective: what specifically should be accomplished
- Output format: diff / table / report / verdict — be concrete
- Tools to use: which tools to prioritize
- Boundaries: files and modules that must NOT be touched
```

`Boundaries` matters more than usual here — existing files under `migrations/` and existing cases in `test/filter.test.ts` are edit-prohibited, so name them every time.

## Objective Trigger Design

Never write a subjective trigger. Agents consistently overestimate their own understanding and will rationalize their way past conditions like "unfamiliar module" every single time.

| Rejected | Replace with |
|---|---|
| "unfamiliar module" | "first edit in this directory this session" or ">300 LOC" |
| "complex change" | "touches ≥2 directories" or "≥3 files" |
| "if unsure" | Remove the self-assessment; use a countable proxy |
| "large refactor" | "≥N files modified in one commit" |

## Model Selection

| Role | Model | Rationale |
|---|---|---|
| `qa-verifier` | sonnet | Checking against stated criteria — comparison, not open judgment |
| Code exploration / summarizing | sonnet | Search, read, summarize |
| Implementation | sonnet | Pattern-following coding |
| Root-cause analysis (2nd attempt) | opus | After simpler approaches have failed |

## Result Handoff

| Mechanism | When |
|---|---|
| Return value | Unnamed subagent — the default |
| `SendMessage(to: "main")` | Named or backgrounded spawns — **must be stated in the initial prompt** |
| Scratchpad file | Large artifacts. Use the session scratchpad directory from the system prompt; name as `{phase:02d}_{agent}_{artifact}.{ext}` |

For a named agent, messaging *is* the delivery channel. Omit the report-back instruction and the agent can complete a full review whose findings are then silently dropped. The instruction cannot be added after the spawn, so it belongs in the prompt template. Require a report even when the result set is empty, so "finished with nothing" stays distinguishable from "still running".

## Applying Subagent Output

- **Structural fix** (typo, missing import) → apply in the current cycle
- **Behavioral change** (new feature, changed logic) → add to `backlog.md`; never apply directly
- **Conflicts with a design doc** → report both options to the user; do not choose

## Reusable Roles

`.claude/agents/qa-verifier.md` — the only named role. Claude Code reuses the same file for both subagent and teammate spawns.

`implementer`, `explorer`, and `product-evaluator` role files are **deliberately absent**. The conditional gates above are covered well enough by `general-purpose`, and at this repo's size a dedicated role would rarely fire. Create one when either of these is observed:

- The same kind of `general-purpose` briefing has been written 3+ times
- A conditional gate repeatedly fails because the briefing was too thin
