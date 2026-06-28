# EC-TEMPLATE — Execution Checklist Template

> **Purpose:** Execution Checklists (ECs) are lightweight pre-execution
> supplements that sit alongside Work Packets. Claude reads both the WP
> (authoritative design document) and the EC (execution contract) before
> starting.
>
> ECs do NOT replace Work Packets. The WP is always authoritative for
> design intent. If the EC and WP conflict on design, the WP wins.
>
> **Execution Authority:** For any Work Packet with a corresponding
> Execution Checklist (EC), the EC is the authoritative execution checklist.
> Implementation must satisfy the EC exactly.
> Failure to satisfy any EC item is a failed execution of the WP.
>
> **When to use:** Before starting a WP session, read the EC first for a
> rapid orientation, then read the full WP for details.

---

## How to Generate an EC

For each WP, extract:

1. **Before Starting** — from `## Assumes`: key dependencies that must be true
2. **Locked Values** — from `## Non-Negotiable Constraints` locked contract
   values: verbatim constants, field names, evaluation orders. Never paraphrase.
3. **Guardrails** — from constraints and architecture: the 5-8 most important
   rules that prevent drift
4. **Required Comments** — any `// why:` comment locations specified in the WP
5. **Files to Produce** — from `## Files Expected to Change`: compact list
6. **After Completing** — from `## Definition of Done`: session-close checklist
7. **Common Failure Smells** (optional) — known symptoms that indicate specific
   guardrail violations or re-derived locked values

---

## EC File Structure (Exact)

```markdown
# EC-NNN — Short Title (Execution Checklist)

**Source:** docs/ai/work-packets/WP-NNN-slug.md
**Layer:** [Game Engine | Registry | Server | Cross-cutting]

## Before Starting
- [ ] [dependency 1]
- [ ] [dependency 2]
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter <package> typecheck` exits 0 — REQUIRED for app/client packages (see Rules)

## Locked Values (do not re-derive)
- [verbatim constant 1]
- [verbatim constant 2]
- [exact evaluation order or field names]

## Guardrails
- [most important rule 1]
- [most important rule 2]
- [known failure mode to prevent]

## Required `// why:` Comments
- [location 1]: [what to explain]
- [location 2]: [what to explain]

## Files to Produce
- `path/file.ts` — **new** — one-line description
- `path/file.ts` — **modified** — what changes

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter <package> typecheck` exits 0 — REQUIRED for app/client packages (see Rules)
- [ ] Live-on-surface verification — REQUIRED when the WP's `User-Visible Surface` ≠ `none — infrastructure` (see Rules); for `none`, STATUS.md states "No user-observable change — infrastructure only"
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated (list specific decisions)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date

## Common Failure Smells (Optional)
- [symptom] usually indicates [specific guardrail violation]
- [symptom] often means [locked value was re-derived]
```

---

## Rules

- The EC is the **authoritative execution contract** for its WP — compliance
  is binary; every item must be satisfied exactly
- The WP is the **authoritative design document** — if the EC and WP conflict
  on design intent, the WP wins
- ECs should **target ~60** non-empty content lines and **must not exceed 100**
  (excluding the header block and section titles). The cap keeps the EC a
  quick-reference, not a WP duplicate; it is not a per-line budget. Multi-file
  engine-mutating ECs legitimately run ~70–85 (e.g., EC-251 ≈ 72, EC-252 ≈ 81).
  An EC over ~100 lines is probably duplicating WP content and should be trimmed.
  (Ceiling raised from a flat 60 by `SPEC` 2026-06-06 per the WP-220 audit: the 60
  figure predated the reveal-executor EC family, and every shipped EC in that
  lineage exceeded it — doc-vs-practice drift, not over-long ECs.)
- Locked Values must be copied verbatim from the WP.
  If formatting or ordering differs, the EC is invalid.
- Do not include narrative, rationale, or session context
- Do not include full acceptance criteria — those live in the WP
- One EC per WP; filename: `EC-NNN-short-slug.checklist.md`
- **App/client-package WPs MUST gate `typecheck`.** For `apps/dashboard`,
  `apps/arena-client`, and `apps/registry-viewer`, both `Before Starting` and
  `After Completing` MUST include `pnpm --filter <pkg> typecheck` exits 0.
  `vite build` uses esbuild and `node:test` runs under tsx, so NEITHER
  type-checks — only the explicit `typecheck` script (`vue-tsc --noEmit`) does.
  A WP whose close-out verifies only build + test can ship `vue-tsc` errors to
  unprotected `main`, where they sit until a later PR's CI trips. This has
  recurred repeatedly: arena-client WP-166 / WP-207 / WP-227 and dashboard
  WP-229 (a `VALID_HORIZONS` error caught + fixed in WP-230). Engine / registry
  / server WPs are covered by `pnpm -r build` (their build IS the typecheck) and
  need no separate line.
- **User-facing WPs MUST gate live-on-surface verification (D-24026).** When the
  WP's `User-Visible Surface` is NOT `none — infrastructure`, `After Completing`
  MUST include a check that the change is confirmed **live on the named surface**
  (a real match on play.legendary-arena.com, the deployed cards/dashboard page),
  with observable evidence — green tests + a merged PR do not, alone, satisfy it.
  The drift this prevents: WP-248..253 each marked "done" on tests + merge while
  the operator saw no change on cards/play, because most were behavior-identical
  refactors or tooling (legitimately `none — infrastructure`) — but "done" never
  said so. For a `none — infrastructure` WP, the gate inverts: STATUS.md must
  state "No user-observable change — infrastructure only" so the run is not read
  as visible progress. Engine refactors a player cannot perceive ARE
  `none — infrastructure`; classify honestly.
- Short Title in the EC header should match the filename slug semantically
- The "Common Failure Smells" section is optional — include it when the WP
  has known failure modes that are non-obvious from the guardrails alone
- **Grep-gate prose discipline (WP-101 §3.2 + WP-102 §3.2 precedent):**
  when a verification step uses a **count-bounded grep gate** (e.g.,
  "exactly 1 match", "exactly 3 matches", "zero matches") that targets
  a literal token (SQL keyword, function name, framework symbol, skip
  reason string), do NOT echo that literal in `// why:` comments,
  module-header docstrings, or any other prose in the same file. The
  grep gate counts total matches, not code-context matches; a comment
  that names the policed literal will inflate the count and trip the
  gate. **Discipline:** paraphrase the policed literal in prose, OR
  cross-reference it ("the SQL filter above", "the function's name",
  "the locked skip pattern") rather than quoting it. Concrete examples
  caught at execution time:
  - `'UPDATE legendary.players'` in module-header prose tripped the
    "exactly 1 match" single-writer gate (WP-101 → reworded to
    "PostgreSQL update statement").
  - `'ADD COLUMN IF NOT EXISTS x3'` in migration-file prose tripped
    the "exactly 3 matches" column-count gate (WP-101 → reworded to
    "three idempotent column additions").
  - `'{ skip: "requires test database" }'` in test-file docstring
    tripped the "exactly N matches" skip-pattern gate (WP-101 →
    reworded to "options-based non-silent skip").
  - `'requireAuthenticatedSession'` in route-handler `// why:` comment
    tripped the auth-helper Hard Stop grep (WP-102 → reworded to
    "no authenticated-session helper invocation").
  - `'visibility IN ('public', 'link')'` in narrowing-guard `// why:`
    comment tripped the "exactly 1 match" SQL-filter gate (WP-102 →
    reworded to "the SQL visibility filter above").
  - `'encodeURIComponent'` in client-API `// why:` comment tripped the
    "exactly 1 line" defense gate (WP-102 → reworded to
    "percent-encoding the handle defends against...").
- **STOP means HARD STOP (EC-321 review precedent).** When a `Before Starting`
  precondition or a `Guardrails` item says "else STOP" / "STOP and investigate,"
  it means: do NOT modify additional files, do NOT attempt a partial or
  speculative fix. Either (1) fix the violated precondition explicitly and
  re-verify, OR (2) abort and report the blocker. An EC author writing a STOP
  clause should not leave the recovery posture (fix-forward vs. revert) ambiguous
  — the executor's default on ambiguity is abort-and-report, never improvise.
- **Scope lock is declared up front, not discovered after (EC-321 review
  precedent).** `Before Starting` must enumerate the EXACT target file set (the
  same list as `Files to Produce`). Any modification outside that list is a FAIL,
  not a judgment call — surface it as a blocker before touching the file. This
  catches accidental refactor-creep at edit time rather than at the post-run
  `git diff --name-only` spot-check.
- **Drift/guard tests must be non-vacuous AND cheat-proof (EC-321 review
  precedent).** When an EC requires a guard test (a drift gate, a coverage
  superset, a symmetry assertion), the EC MUST require: (a) a NEGATIVE assertion
  proving the guard FAILS for a synthetic bad input (e.g., a phantom name absent
  from the maps) so the check is not vacuous; and (b) explicit prohibitions on
  cheat paths — no mocking of the asserted-over inputs, no mutation of those
  inputs, no derived/filtered comparison that removes the very elements under
  test. A guard test that can pass without guarding reality is a failed guard.
- **Determinism gates are binary, but pin to script behavior — not a literal
  output string (EC-321 review precedent + verified hazard).** When an EC gates a
  determinism/artifact-freshness check (`sim:runtime-observed:check` and kin),
  the pass condition is: the command **exits 0 and performs no regeneration or
  diff** (the committed artifact stays byte-current). State it that way. Do NOT
  assert an exact stdout literal: the EC-321 review proposed asserting the check
  prints `"artifact is current"`, but the script actually prints
  `OK: runtime-observed hollows artifact is current.` — a pinned substring would
  have failed a passing run. Re-baselining to make a drift check pass is itself a
  FAIL; investigate WHY the artifact changed before regenerating.
