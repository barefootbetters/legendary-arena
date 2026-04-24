# Pre-Flight — WP-087 Engine Type Hardening: `PlayerId` Alias + Setup-Only Array `readonly`

**Work Packet:** [WP-087](../work-packets/WP-087-engine-type-hardening.md)
**Execution Checklist:** [EC-087](../execution-checklists/EC-087-engine-type-hardening.checklist.md)
**Session Context Bridge:** [session-context-wp087.md](../session-context/session-context-wp087.md)
**Pre-flight date:** 2026-04-23
**Repo state at pre-flight:** `main @ 372bf71` (WP-051 governance close)
**Pre-flight verdict:** 🟢 **READY TO EXECUTE** — all four PS findings resolved in the A0 pre-flight bundle that carries this report.

---

## 1. Purpose

This document is the 00.3 Prompt Lint Gate verdict for WP-087 + EC-087, plus the pre-flight drift / invariant checks the Work Packet itself declares. It is authored as part of the A0 SPEC pre-flight bundle that also (a) registers WP-087 in `WORK_INDEX.md`, (b) registers EC-087 in `EC_INDEX.md`, (c) strips the `DRAFT` banners from WP-087 / EC-087 and notes the lint PASS, (d) narrows the grep pattern in WP-087 Verification Step 4 and EC-087 After Completing #4 per PS-1, and (e) reconciles the session-context bridge against current `HEAD` per 00.3 §19.

After this A0 bundle lands, the execution session (Commit A) may open directly on a fresh topic branch without any further pre-flight work.

---

## 2. 00.3 Prompt Lint Gate — §1-§19 Verdict

Run against `docs/ai/work-packets/WP-087-engine-type-hardening.md` at its A0-amended form.

| § | Section | Verdict | Notes |
|---|---|---|---|
| §1 | Work Packet Structure | ✅ PASS | All 10 required sections present (Goal, Assumes, Context, Scope In, Out of Scope, Files Expected to Change, Non-Negotiable Constraints, Acceptance Criteria, Verification Steps, Definition of Done). `## Out of Scope` has 8 explicit exclusions — well above the "at least two" floor. |
| §2 | Non-Negotiable Constraints Block | ✅ PASS | Flat bullet list with Engine-wide, Packet-specific, Session protocol, and Locked contract values sub-groups. Full-file-output requirement and diff prohibition both present. ESM-only / Node-v22+ both present. `00.6-code-style.md` referenced. |
| §3 | Prerequisites (`## Assumes`) | ✅ PASS | WP-049 gating, grep-based invariant on `hookRegistry` / `schemeSetupInstructions` / `heroAbilityHooks` post-setup mutations, `PlayerId` / `PlayerKey` non-existence, boardgame.io 0.50.x lock all listed. |
| §4 | Context References | ✅ PASS | `ARCHITECTURE.md` §Layer Boundary + §Persistence Boundaries; `.claude/rules/game-engine.md` specific subsections; `.claude/rules/code-style.md` specific subsections; `00.2-data-requirements.md` §8.1; `DECISIONS.md` scan note. All citations are specific, none are vague. |
| §5 | Output Completeness | ✅ PASS | 8 files listed in `## Files Expected to Change`, each marked `modified` with a one-line description. No ambiguous output language. Bounded list (≤8 files per 00.1 splitting guidance). |
| §6 | Naming Consistency | ✅ PASS | `PlayerId` used consistently across WP, EC, session-context. `heroDeckIds` referenced correctly per 00.2 §8.1 (pool semantic). No typos in file paths. No stray backtick artifacts. |
| §7 | Dependency Discipline | ✅ PASS | No new npm dependencies. N/A for forbidden packages (none introduced). |
| §8 | Architectural Boundaries | ✅ PASS | Game Engine layer only. No registry / server / preplan / UI touches. No `Math.random()`, no database queries, no WebSocket logic. `G` remains JSON-serializable (type-only change does not violate this). |
| §9 | Windows Compatibility | ✅ PASS | Verification Steps use `pwsh` and `Select-String`, not `bash` / `grep`. `pnpm` used throughout. |
| §10 | Environment Variable Hygiene | N/A | No env vars introduced or required. |
| §11 | Authentication Clarity | N/A | Not an auth packet. |
| §12 | Test Quality | N/A | Zero new tests produced. The sole test-file modification (`rules/ruleRuntime.ordering.test.ts:56`) is a factory-time refactor; test count must equal pre-change baseline. |
| §13 | Commands and Verification | ✅ PASS | Four exact PowerShell commands with expected output (`pnpm -r build`, `pnpm test`, `pnpm --filter game-engine exec tsc --noEmit`, `Select-String` invariant). |
| §14 | Acceptance Criteria Quality | ✅ PASS | 8 binary / observable / specific items. Includes the negative guarantee "No file outside `## Files Expected to Change` was modified to satisfy the type change". |
| §15 | Definition of Done | ✅ PASS | Includes STATUS.md, DECISIONS.md, WORK_INDEX.md update checkboxes, plus the scope-boundary negative check. |
| §16 | Code Style | ✅ PASS | No premature abstraction (PlayerId is canonical across three files — meets the 3-site threshold). No new functions introduced. `// why:` comment required at the `PlayerId` declaration citing boardgame.io's `"0" \| "1" \| …` convention. No `import *`, no barrel re-exports. |
| §17 | Vision Alignment | ✅ PASS | Triggered by §17.1 player-identity surface (§3, §11). `## Vision Alignment` section cites clauses `§3, §11` with explicit "No conflict" assertion and §17.3 purely-structural justification. Non-Goal proximity check ("Not applicable — not user-facing / paid / persuasive / competitive"). Determinism preservation N/A — no scoring / replay / RNG / simulation touched. |
| §18 | Prose-vs-Grep Discipline | ✅ PASS | WP-087's grep Verification Step 4 targets `packages/game-engine/src/**/*.ts`, not `docs/`. Prose in the WP document that enumerates `hookRegistry` / `schemeSetupInstructions` / `heroAbilityHooks` cannot false-positive the grep because the grep path scope excludes the WP itself. |
| §19 | Bridge-vs-HEAD Staleness | ✅ PASS (resolved at A0) | session-context-wp087.md §1 was stale against current `HEAD`; the original snapshot referenced branch `wp-049-par-simulation-engine` with WP-049 pending merge. A0 amendment adds a reconciled state block at the top of §1 pointing to `main @ 372bf71` with WP-049/050/051 all merged. Original snapshot preserved for historical record. See PS-3 below. |

**Final Gate verdict per 00.3 §Final Gate table:** Zero rows match any FAIL condition. Packet passes lint.

---

## 3. Pre-Flight Invariant Checks (WP-087 Assumes + Verification Steps)

Run at `main @ 372bf71` on 2026-04-23 using `grep` / `rg` / `git` directly (equivalent to the PowerShell `Select-String` in the WP — the results are invariant with respect to tool choice because the patterns are mechanical).

### 3.1 No existing `PlayerId` / `PlayerKey` symbol in `packages/**`

Command (bash):
```
grep -rn "type PlayerId\|type PlayerKey" packages/
grep -rn "PlayerId\b\|PlayerKey\b" packages/
```

Result: zero source-file matches. Matches in `packages/game-engine/dist/**` are build output (field-name-level `currentPlayerId` / `playerId` identifiers), not type declarations. ✅

### 3.2 Sole non-setup `hookRegistry` mutation site at `ruleRuntime.ordering.test.ts:56`

Command:
```
grep -rnE "(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)" --include="*.test.ts" packages/game-engine/src/
```

Result: exactly one match: `packages/game-engine/src/rules/ruleRuntime.ordering.test.ts:56: gameState.hookRegistry = createHookRegistry(hooks);`. Line number matches WP-087's cited line (no drift). ✅

### 3.3 `types.ts:365` false-premise trap check (session-context §4.3)

Command:
```
sed -n '360,370p' packages/game-engine/src/types.ts
```

Result: line 365 reads `random: { Shuffle: <T>(deck: T[]) => T[] };` — valid TypeScript. The HTML-escaped form `&lt;T&gt;` is **not** present in source. The false premise that reporters may surface in future review rounds is refuted by the actual source bytes. ✅

### 3.4 `MatchSnapshot.playerNames` current shape

Command:
```
grep -n "playerNames" packages/game-engine/src/persistence/persistence.types.ts
```

Result: `58:  playerNames: Record<string, string>;`. Matches WP-087's expected pre-change shape. The WP's swap to `Record<PlayerId, string>` is well-defined. ✅

### 3.5 Test-file factory constructions are already `readonly`-compatible

The grep over `*.test.ts` files for construction sites (type-annotation shape) returned 40+ matches across `board/`, `hero/`, `moves/`, `persistence/`, `rules/`, `scheme/`, `scoring/`, `villainDeck/`. Every match is a factory-time construction via a literal `[…]` or via `buildDefaultHookDefinitions(config)` / `createHookRegistry(…)` returned-array. None of these patterns would fail the `readonly T[]` assignment check — mutable arrays are assignable to `readonly` in the direction tests use them (constructing a fixture and reading it during assertions).

The one mutation site (§3.2 above) is the only pattern that *would* break under `readonly`, and WP-087 already scopes it as the single test-file modification. ✅

---

## 4. PS Findings (Discovered at Pre-Flight)

### PS-1 BLOCKING — Verification grep pattern over-matches `const` declarations

**Symptom.** The WP-087 Verification Step 4 grep (and the EC-087 After Completing #4 grep) uses the pattern `(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)`. The `\s*=` portion matches both `G.hookRegistry = ...` (a true mutation) and `const schemeSetupInstructions = ...` (a legitimate setup-time local variable declaration).

**Evidence.** At `main @ 372bf71`, the pattern over `packages/game-engine/src/` excluding `*.test.ts` returns one match: `packages/game-engine/src/setup/buildInitialGameState.ts:178: const schemeSetupInstructions = buildSchemeSetupInstructions(...)`. This is a local-variable initialization inside the setup factory — exactly the pattern WP-087 requires everywhere. It is not a post-setup mutation of `G.schemeSetupInstructions`.

**Impact.** The Verification Step's "Expected: no matches" assertion would FAIL during execution even though the implementation is correct. This is a verification-pattern bug, not an implementation flaw.

**Resolution (landed in this A0 bundle).** Narrow the grep pattern to require a `G.` or `gameState.` qualifier:

```
(G|gameState)\.(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)
```

Applied in both WP-087 Verification Step 4 and EC-087 After Completing bullet 4. With the narrowing, the `buildInitialGameState.ts:178 const` declaration no longer matches, while any real `G.hookRegistry = ...` or `gameState.schemeSetupInstructions.push(...)` mutation would still fire.

**Status:** ✅ RESOLVED. Re-running the narrowed pattern at `main @ 372bf71` returns zero matches.

### PS-2 BLOCKING — WP-087 and EC-087 unregistered

**Symptom.** At pre-flight open, `grep "WP-087" docs/ai/work-packets/WORK_INDEX.md` and `grep "EC-087" docs/ai/execution-checklists/EC_INDEX.md` both returned zero. WP-087's own header declared "pre-lint, not yet registered". EC-087's header declared "do not execute until ... WP-087 is registered in `WORK_INDEX.md` ... and this EC is registered in `EC_INDEX.md`".

**Impact.** Execution is gated on both registrations per the EC's Before Starting section and the WP's Gating paragraph.

**Resolution (landed in this A0 bundle).**
- WP-087 entry inserted in `WORK_INDEX.md` directly above the existing WP-089 entry in the Gameplay phase. Entry uses the canonical template format with Dependencies (WP-049), Notes (full scope summary), `[ ]` Ready status, and the self-compliant `## Vision Alignment` reference.
- EC-087 row inserted in `EC_INDEX.md` table directly above the existing EC-085 row. Row marks Status = `Draft` (execution not yet started). Summary counts updated (Draft 46 → 47, Total 60 → 61).

**Status:** ✅ RESOLVED. Both grep checks now return non-zero.

### PS-3 NON-BLOCKING — session-context-wp087.md §1 stale against HEAD

**Symptom.** session-context-wp087.md §1 "State as of authoring" was written during the WP-049 execution session. It describes branch `wp-049-par-simulation-engine` with "WP-049 complete, pending merge" and "WP-050 in flight in a parallel session". At pre-flight time this is factually false — WP-049 merged at `956306c`, WP-050 merged at `0bf9020`, WP-051 merged at `372bf71`. All three closure commits are direct ancestors of current `main`.

**Impact.** 00.3 §19 Bridge-vs-HEAD Staleness Rule explicitly governs this case — session-context bridges are listed as repo-state-summarizing artifacts that must be reconciled against `HEAD` before commit. §19 is a commit-time discipline (not Final-Gate-enforced), but the rule's purpose — preventing committed artifacts from canonically stating a false state of the world — is directly relevant.

**Resolution (landed in this A0 bundle).** Added a reconciliation block at the head of §1 that:
- Preserves the original authoring snapshot (as historical record of the drafting session).
- Restates the current `main @ 372bf71` state with the three merged closure commits cited by hash.
- Documents the repo-wide test baseline at pre-flight time (`671 / 127 / 0`) so the executor can compare at execution start.
- Notes the parallel in-flight drafts (WP-088 / WP-089 / WP-090 + ECs) as untouched surfaces that do not interact with WP-087's scope.
- Includes a "supersedes the original snapshot for all operational purposes" instruction.

Matches the WP-085 / WP-037 precedent for §19 "acceptable" remediation (reconciliation note with strikethrough preservation) — except here the drafting commit was never made, so the reconciliation happens in-place at A0 commit time, not in a follow-up reconciliation commit. Cleaner outcome than a post-commit fix.

**Status:** ✅ RESOLVED.

### PS-4 NON-BLOCKING — WP-087 Appendix A requests for human approval

**Symptom.** WP-087 Appendix A ("Explicit requests for human approval") enumerates three items requiring a decision before execution:
1. Confirm `WP-087` as the final number (vs renumber if WP-086 lands first).
2. Confirm whether EC-087 is kept or removed (WP notes default is "no EC", but one was drafted).
3. Confirm `PlayerId` remains non-branded.

**Impact.** Unresolved Appendix A questions would force the executor to stop mid-execution and ask. 00.3 §2 "Session protocol" bullet in the Non-Negotiable Constraints block explicitly requires this — which is correct — but if the questions can be resolved at pre-flight time, execution proceeds more smoothly.

**Resolution (landed in this A0 bundle).**
1. **WP-087 number confirmed.** WP-086 remains memory-reserved (blocked on WP-084 landing). No other WP in the 087 range has been drafted. WP-087 retains its number. Codified in the WP-087 header block replacing the "WP number note" paragraph.
2. **EC-087 retained.** Even though a pure type-only change does not *strictly* require an EC, retaining the already-drafted EC-087 preserves executor guardrails (Before Starting baseline capture, Locked Values re-statement, After Completing explicit grep + test-count checks, Common Failure Smells). The retention also matches the EC-049 / EC-050 / EC-051 precedent where every recent packet carried an EC regardless of scope. Registered as `Draft` in `EC_INDEX.md`; will flip to `Done` at completion.
3. **`PlayerId` stays non-branded.** Rationale preserved in session-context §3.2: branding would ripple into every test factory (~40+ sites based on §3.5 grep) and turn a type-only WP into a codebase-wide refactor. If a future WP wants to upgrade, it must justify the ripple cost separately.

All three decisions encoded in the replacement header block at the top of `WP-087-engine-type-hardening.md` so the executor reads them before opening any code file.

**Status:** ✅ RESOLVED.

---

## 5. Architectural Concerns Considered (and Rejected as Non-Blocking)

### 5.1 Could `readonly` on `hookRegistry` break boardgame.io's Immer drafting?

boardgame.io uses Immer to draft `G` inside move handlers. If a move handler attempts to write to `G.hookRegistry`, Immer produces a draft that TypeScript would see as mutable even though the declared type is `readonly`. TypeScript's structural typing rejects assignment from `readonly T[]` to `T[]` at the call site, but Immer runtime would still allow mutation on the draft.

The cross-check: no move handler writes to `G.hookRegistry`. The grep in §3.2 above confirms zero production (`*.ts` excluding `*.test.ts`) matches even with the over-broad pre-PS-1 pattern (the one match was a setup-time const, not a move mutation). So the Immer / `readonly` interaction is benign: TypeScript treats the draft correctly, no move handler is affected, and the `readonly` declaration is a purely compile-time tightening.

### 5.2 Could `readonly` on `schemeSetupInstructions` break scheme-setup execution?

`packages/game-engine/src/scheme/schemeSetup.execute.ts` reads `G.schemeSetupInstructions` to drive scheme-setup effect application. Reading is unaffected by `readonly`. The grep in §3.2 confirms no write site exists in production code. ✅

### 5.3 Could `readonly` on `heroAbilityHooks` break hero ability resolution?

`packages/game-engine/src/hero/heroEffects.execute.ts` and `heroConditions.evaluate.ts` both consume `G.heroAbilityHooks` as a read-only data source at runtime. The grep confirms no write sites in production code. Tests construct fixtures at factory time (40+ sites), which is `readonly`-compatible. ✅

### 5.4 Could the `PlayerId` swap in `Record<PlayerId, PlayerZones>` force any test fixture updates?

Test fixtures construct `playerZones` via literal `{ '0': ..., '1': ... }` syntax. Since `PlayerId = string` (non-branded), `{ '0': ..., '1': ... }` literals remain assignment-compatible with `Record<PlayerId, PlayerZones>`. No test fixture modification required. This is the core reason WP-087 chose non-branded over branded — §3.2 in session-context expands.

### 5.5 Could the `PlayerId` swap in `Record<PlayerId, string>` break `MatchSnapshot` serialization?

`MatchSnapshot` is JSON-serialized for persistence. A `Record<PlayerId, string>` where `PlayerId = string` produces identical JSON to `Record<string, string>`. No wire-format or storage-format change. WP-087 scope explicitly excludes serialization changes — this analysis confirms the exclusion is correct, not a latent issue. ✅

---

## 6. Files Changed by This A0 Pre-Flight Bundle

Exactly eight files:

| File | Change |
|---|---|
| `docs/ai/work-packets/WORK_INDEX.md` | **modified** — insert WP-087 entry above existing WP-089 entry in Gameplay phase. In-flight WP-089/WP-090 additions (from a separate workstream) preserved verbatim; no reordering. |
| `docs/ai/execution-checklists/EC_INDEX.md` | **modified** — insert EC-087 row above existing EC-085 row. Summary counts updated (Draft 46 → 47, Total 60 → 61). |
| `docs/ai/work-packets/WP-087-engine-type-hardening.md` | **modified** — replace `DRAFT / pre-lint` status banner with `READY TO EXECUTE` header citing PS-1..PS-4 resolutions; narrow Verification Step 4 grep pattern; note Appendix A supersession. |
| `docs/ai/execution-checklists/EC-087-engine-type-hardening.checklist.md` | **modified** — replace `DRAFT` status banner with `READY TO EXECUTE`; narrow After Completing grep pattern. |
| `docs/ai/session-context/session-context-wp087.md` | **modified** — §1 reconciliation block per PS-3 / 00.3 §19. |
| `docs/ai/invocations/preflight-wp087-engine-type-hardening.md` | **new** — this file. |
| `docs/ai/invocations/session-wp087-engine-type-hardening.md` | **new** — the execution prompt. |

No code files touched. No test files touched. No `packages/**` modifications.

---

## 7. Execution Commit Topology (Predicted)

Based on the WP-050 / WP-051 precedent and the commit-msg hook rules encoded in `.githooks/commit-msg`:

- **A0 SPEC commit (this bundle).** Prefix `SPEC:`. Contains the seven files in §6 (all docs under `docs/`). No `packages/` or `apps/` files; hook rule 5 permits `SPEC:` prefix.
- **Commit A (execution).** Prefix `EC-087:`. Contains the four files listed in WP-087 `## Files Expected to Change` under `packages/game-engine/src/`:
  - `types.ts` — modified
  - `state/zones.types.ts` — modified
  - `persistence/persistence.types.ts` — modified
  - `rules/ruleRuntime.ordering.test.ts` — modified
  - Plus: `DECISIONS.md` + `STATUS.md` — modified for governance footnotes landing inline with the code change. These are docs, but adding them to Commit A mirrors the WP-051 approach. (Alternative: split into Commit A code + Commit B governance; leave to executor judgment at session time.)
- **Commit B (SPEC governance close, if split).** Prefix `SPEC:`. Flips WP-087 `[ ]` → `[x]` in `WORK_INDEX.md`, flips EC-087 `Draft` → `Done` in `EC_INDEX.md`, updates `STATUS.md`, appends D-NNNN to `DECISIONS.md`, optional 01.6 post-mortem.

01.6 post-mortem: **OPTIONAL, not mandatory** for WP-087. The four 01.6 triggers (new long-lived abstraction / new contract consumed by future WPs / new canonical readonly array / new filesystem surface) are not met by a type-only tightening. `PlayerId` is a single-line alias reused in three sites; it is not an "abstraction" in the 01.6 sense. Recommend authoring a brief post-mortem anyway if the executor encounters any mid-session drift, per the standing "documentation packets optional, execution packets mandatory" convention (WP-040 / WP-041 / WP-042 / WP-066 / WP-081 precedent), but no requirement from 01.6's own trigger list.

---

## 8. Pre-Execution Greps (To Be Re-Run at Commit A Open)

The executor must re-run these greps at the opening of the execution session. Results must match the pre-flight baseline. Any divergence indicates an intervening commit that changed the surface WP-087 targets — STOP and re-run pre-flight if that happens.

```bash
# Baseline confirmation:
git rev-parse HEAD                                            # expected: main @ current HEAD at session open
grep -rn "type PlayerId\b\|type PlayerKey\b" packages/        # expected: zero
grep -rnE "(G|gameState)\.(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)" --include="*.ts" packages/game-engine/src/ | grep -v "\.test\.ts"   # expected: zero
grep -rnE "(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)" --include="*.test.ts" packages/game-engine/src/   # expected: exactly 1 match — ruleRuntime.ordering.test.ts:56
sed -n '365p' packages/game-engine/src/types.ts               # expected: `  random: { Shuffle: <T>(deck: T[]) => T[] };`
grep -n "playerNames" packages/game-engine/src/persistence/persistence.types.ts  # expected: `Record<string, string>` (to be swapped to `Record<PlayerId, string>`)

# Test baseline confirmation:
pnpm -r test   # expected: 671 / 127 / 0 repo-wide; game-engine 506 / 113 / 0
```

If any grep returns unexpected output or the test baseline differs, STOP — a parallel session landed a change during the pre-flight-to-execution window and the pre-flight must be re-validated.

---

## 9. Verdict

🟢 **READY TO EXECUTE.**

- 00.3 Prompt Lint Gate: 17/17 applicable sections PASS (§10, §11, §12 marked N/A).
- Pre-flight invariant checks: all 5 verified at `main @ 372bf71`.
- PS findings: 4 surfaced (2 BLOCKING, 2 NON-BLOCKING); all 4 resolved in this A0 SPEC bundle.
- Architectural concerns: 5 considered, all resolved as benign against current `HEAD`.

The execution session may open on a fresh topic branch `wp-087-engine-type-hardening` cut from `main` once this A0 bundle is merged. The session execution prompt is at [session-wp087-engine-type-hardening.md](session-wp087-engine-type-hardening.md) and is authoritative for the Commit A + optional Commit B topology.
