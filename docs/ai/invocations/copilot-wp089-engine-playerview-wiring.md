# Copilot Check — WP-089 (Engine PlayerView Wiring)

**Date:** 2026-04-23 (re-run snapshot 2026-04-24 after PS-1 / PS-2 in-tree resolution)
**Pre-flight verdict under review:** READY TO EXECUTE (2026-04-23; PS-1 / PS-2 resolved 2026-04-24)
**Inputs reviewed:**
- EC: `docs/ai/execution-checklists/EC-089-engine-playerview-wiring.checklist.md`
- WP: `docs/ai/work-packets/WP-089-engine-playerview-wiring.md`
- Pre-flight: `docs/ai/invocations/preflight-wp089-engine-playerview-wiring.md` (same session)

---

## Overall Judgment

**RISK** — two issues still carry scope-neutral `FIX` items that must fold into the session prompt before generation: **Issue 4** (contract drift — `UIAudience` import path; `makeMockCtx` shape vs. `Ctx` needed by `playerView`) and **Issue 21** (type widening — RS-3 local assertion wording lock). **Issue 30** (Pre-Session Actions PS-1 / PS-2) has flipped to **PASS** as of 2026-04-24 — both governance rows are now registered in-tree (WORK_INDEX.md for WP-089 + the `Engine→Client Projection Wiring` Dependency Chain subsection; EC_INDEX.md for EC-089 Draft row + Summary count bump). None of the remaining findings would cause architectural or determinism damage on their own — the WP is well-scoped, the dependency contracts are verified, and the design preserves the upstream WP-028 / WP-029 purity discipline — but both require explicit lock language in the session prompt so they cannot drift. After the session prompt folds in the RS-1 / RS-2 / RS-3 locks verbatim, the pre-flight READY verdict stands.

---

## Findings

### Category 1 — Separation of Concerns & Boundaries

1. **PASS** — Issue 1 (Engine vs UI / App Boundary Drift). WP-089 §Non-Negotiable Constraints and EC-089 §Guardrails both prohibit `game.ts` imports from `@legendary-arena/registry` or `apps/server/`; Verification Steps 3 and 4 re-assert via `Select-String`. Layer Boundary is grep-enforced, not just stated.

9. **PASS** — Issue 9 (UI Re-implements or Re-interprets Engine Logic). WP-089 preserves D-0301 / D-0302 by delegating to `buildUIState` + `filterUIStateForAudience`. No UI-side reshape; no alternative projection.

16. **PASS** — Issue 16 (Lifecycle Wiring Creep). Pre-flight RS-10 explicitly locks "`buildPlayerView` is consumed exclusively via `LegendaryGame.playerView` — never from phase hooks, turn hooks, or any move". EC-089 Common Failure Smells row 2 catches the inline-arrow form. WP-028 precedent applied.

29. **PASS** — Issue 29 (Assumptions Leaking Across Layers). `buildPlayerView` lives in the engine, reads engine types only, and emits an engine-defined projection. No UI assumption leaks.

### Category 2 — Determinism & Reproducibility

2. **PASS** — Issue 2 (Non-Determinism Introduced by Convenience). WP-089 §Non-Negotiable Constraints line 110 bans wall-clock, RNG, and I/O inside `buildPlayerView`. EC-089 §Guardrails line 31 repeats. No `ctx.random.*` involvement — `playerView` is read-only.

8. **PASS** — Issue 8 (No Single Debugging Truth Artifact). WP-089 §Debuggability & Diagnostics locks reproducibility: same `(G, ctx, playerID)` always yields byte-identical output; failures are localizable by inspecting inputs against the two upstream helpers' outputs. Replay remains server-G-based.

23. **PASS** — Issue 23 (Lack of Deterministic Ordering Guarantees). Iteration order is owned by `buildUIState` (WP-028) and `filterUIStateForAudience` (WP-029), both already locked. `buildPlayerView` introduces no new loops.

### Category 3 — Immutability & Mutation Discipline

3. **PASS** — Issue 3 (Pure vs Immer Confusion). `buildPlayerView` is explicitly a pure function (EC-089 §Guardrails line 31; WP-089 §Goal line 31). No Immer context, no `G` mutation, no `return void` — returns a new `UIState`.

17. **PASS** — Issue 17 (Hidden Mutation via Aliasing). Pre-flight RS-5 notes upstream copy discipline (WP-028 `cardKeywords` spread fix; WP-029 shallow-copy filter). `buildPlayerView` inherits both, introduces no new aliasing surface, and its test suite's "no mutation of `gameState` / `ctx`" tests (#5, #6) pin the contract.

### Category 4 — Type Safety & Contract Integrity

4. **RISK** — Issue 4 (Contract Drift Between Types, Tests, and Runtime). Two drift points surfaced in pre-flight Dependency Contract Verification:
   - **(a) `UIAudience` import path drift.** WP-089 Scope(In)§A line 216 offers an import of `UIAudience` from `./ui/uiState.filter.js` with an "if exported there; otherwise construct inline" fallback. Grep confirms `UIAudience` is **not** re-exported from `uiState.filter.ts` — it lives at `./ui/uiAudience.types.ts` and is re-exported via `uiState.types.ts:176`. Without a locked resolution in the session prompt, the executor will waste a turn investigating.
   - **(b) `makeMockCtx` shape vs. `Ctx` needed by `playerView`.** EC-089 §Files-to-Produce line 48 requires `makeMockCtx` for "the `ctx`-like fixture" — but `makeMockCtx` returns `SetupContext` = `{ ctx: { numPlayers }, random: { Shuffle } }`. `playerView` receives boardgame.io runtime `Ctx` with `phase` / `turn` / `currentPlayer`. The EC text and the reality diverge.

   **FIX:** Fold pre-flight RS-1 and RS-2 locks into the session prompt verbatim as locked values:
   - Lock §A import list to exactly three symbols from `./ui/` (`buildUIState`, `filterUIStateForAudience`, `UIState`) — **no `UIAudience` import**. Audience literals are constructed inline at the `filterUIStateForAudience(...)` call site.
   - Lock the test-fixture pattern as dual-context: `makeMockCtx()` supplies the `SetupContext` for `buildInitialGameState(...)`; an inline object literal (`{ phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 2 }`) supplies the boardgame.io `Ctx` subset passed to `playerView!(gameState, ctxLike, playerID)`. Cast `ctxLike as any` only at the `playerView!` invocation site with a `// why:` comment citing the test-only nature.
   - Add an EC-089 back-sync candidate to the session prompt's "post-execution cleanup" list: clarify line 48 per RS-2 (non-blocking follow-up).

5. **PASS** — Issue 5 (Optional Field Ambiguity, `exactOptionalPropertyTypes`). Upstream helpers already handle this (`UIState.gameOver?`, `UIPlayerState.handCards?` — conditional assignment pattern per `uiState.filter.ts:67-69`). `buildPlayerView` never constructs an optional-field object.

6. **PASS** — Issue 6 (Undefined Merge Semantics). No merge behavior in `buildPlayerView`.

10. **PASS** — Issue 10 (Stringly-Typed Outcomes). `UIAudience` is a discriminated union; `playerID` → audience derivation is `typeof 'string'` check per EC-089 Locked Values line 25. No free-form string arithmetic.

21. **RISK** — Issue 21 (Type Widening at Boundaries). The `LegendaryGame: Game<LegendaryGameState, …>` generic locks `playerView` to `(G, Ctx, PlayerID) => G`, so the WP-089 reshape triggers TS2322 at the assignment site. WP-089 §Type Safety Note line 137-147 authorizes either (a) generic-parameter adjustment or (b) a local narrowly-scoped assertion. Pre-flight RS-3 locks option (b) to avoid ripple through every generic-consumer. The `as unknown as Game<LegendaryGameState>['playerView']` form preserves boundary narrowness — but without session-prompt lock, the executor may grab `as any` (wider) or flip to option (a) (ripple).

   **FIX:** Fold RS-3 into the session prompt as a locked-values entry. Exact wording:
   - The only permitted cast pattern is `buildPlayerView as unknown as Game<LegendaryGameState>['playerView']` at the `playerView:` assignment site.
   - A `// why:` comment is MANDATORY above the cast, citing "WP-089 §Type Safety Note + D-8901 — Game<G,…>.playerView types as `(G, Ctx, PlayerID) => G`, but this engine reshapes to `UIState` per the projection contract. Local assertion confined to this assignment — Game<…> generic unchanged to avoid ripple".
   - `as any` at the `playerView:` site is **forbidden** (drops too much type information; breaks future refactor safety).
   - Option (a) — modifying the `Game<LegendaryGameState, …>` generic — is **out of scope** for WP-089 regardless of whether it would compile.

27. **PASS** — Issue 27 (Weak Canonical Naming Discipline). `buildPlayerView`, `playerView`, `UIState`, `UIAudience`, `UIBuildContext`, `filterUIStateForAudience` all match established precedent (no abbreviations). `playerId` (audience) vs. `playerID` (boardgame.io `PlayerID` type) distinction is locked in EC-089 §Locked Values line 25 — canonical.

### Category 5 — Persistence & Serialization

7. **PASS** — Issue 7 (Persisting Runtime State by Accident). `UIState` is a projection, not runtime state. ARCHITECTURE.md Section 3 unchanged. `buildPlayerView` never writes to DB / R2 / filesystem.

19. **PASS** — Issue 19 (Weak JSON-Serializability Guarantees). `UIState` is JSON-serializable by construction (locked by WP-028). `buildPlayerView` returns an already-serializable value.

24. **PASS** — Issue 24 (Mixed Persistence Concerns). Projections are not persistence; no new `G` field; snapshot, config, and runtime classes remain disjoint.

### Category 6 — Testing & Invariant Enforcement

11. **PASS** — Issue 11 (Tests Validate Behavior, Not Invariants). Pre-flight §Test Expectations locks six tests at the invariant level: delegation-correctness (#1), spectator-fallback (#2, #3), determinism (#4), gameState immutability (#5), ctx immutability (#6). Contract-enforcement framing borrowed from WP-028 precedent. Baseline `507 / 114 / 0` → `513 / 115 / 0` locked. `makeMockCtx` used (dual-context per RS-2); no `boardgame.io/testing` import.

### Category 7 — Scope & Execution Governance

12. **PASS** — Issue 12 (Scope Creep During "Small" Packets). WP-089 §Files Expected to Change lists exactly two production paths (`game.ts`, `game.playerView.test.ts`) plus three governance files (DECISIONS / STATUS / WORK_INDEX / EC_INDEX). EC-089 §After Completing item 7 runs `git diff --name-only` as a binary gate. Pre-flight Scope Lock enumerates forbidden file modifications (including the parallel-workstream `shared.ts`).

13. **PASS** — Issue 13 (Unclassified Directories and Ownership Ambiguity). No new directory. `game.ts` is already engine-classified. No D-XXXX code-category entry required.

30. **PASS** — Issue 30 (Missing Pre-Session Governance Fixes). Pre-flight originally flagged **PS-1** (WP-089 not in `WORK_INDEX.md`) and **PS-2** (EC-089 not in `EC_INDEX.md`) as BLOCKING per `.claude/rules/work-packets.md` and EC-089's own §Before Starting gate.

   **Resolution applied 2026-04-24 (in-tree, awaiting A0 SPEC commit):**
   - `WORK_INDEX.md` carries WP-089's 14-line Ready-status block (lifted verbatim from `.claude/worktrees/wp088-handoff-preserve/WORK_INDEX.md.with-all-wp-a0:1602-1614`), inserted after WP-088's completed entry. Dependency Chain ASCII block carries the `Engine→Client Projection Wiring (prerequisite for WP-090): WP-028 + WP-029 → WP-089 (LegendaryGame.playerView)` subsection per backup lines 1794-1796. WP-090 / WP-059 portions left untouched — they remain pending their own A0 sessions.
   - `EC_INDEX.md` carries a freshly drafted EC-089 Draft row (the preserved backup did **not** contain an EC-089 row, contrary to session-context §2's implication — verified by grep; only EC-059 and EC-090 appear in the backup). The new row mirrors the EC-088 Draft-state pattern from the backup, anchored to EC-089's checklist and WP-089's spec. Summary counts updated: `Draft 46 → 47; Total 62 → 63; Done 16` unchanged.
   - Staging plan for the pending commit: exact filenames only (`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, the two pre-flight / copilot artifacts in `docs/ai/invocations/`, the forthcoming session-prompt, the session-context file, and the untracked WP-089 / EC-089 markdown files). Never `git add .` / `-A` / `-u` (P6-27). Commit prefix `SPEC:` per 01.3 (docs-only — commit-msg hook accepts).

### Category 8 — Extensibility & Future-Proofing

14. **PASS** — Issue 14 (No Extension Seams for Future Growth). `UIAudience` discriminated union is the extension seam — future audiences (coach, observer, replay) extend the union in `uiAudience.types.ts` and route new `playerID` kinds through `buildPlayerView`. The audience-derivation branch has room for one additional kind without refactoring. Pre-flight §Maintainability & Upgrade Readiness PASS line 1.

28. **PASS** — Issue 28 (No Upgrade or Deprecation Story). `playerView` is additive — old clients that didn't receive `playerView` simply got raw `G`; the server-side wiring is transparent. No migration required; no deprecation required.

### Category 9 — Documentation & Intent Clarity

15. **PASS** — Issue 15 (Missing "Why" for Invariants and Boundaries). EC-089 §Required `// why:` Comments enumerates three mandatory anchors: (a) `null`/`undefined` → spectator mapping, (b) `playerView: buildPlayerView` field as the sole engine→client projection boundary, (c) any local type assertion at the assignment site. Pre-flight RS-3 adds a fourth (specific cast-form rationale) — this collapses to (c). No additional `// why:` comment gaps.

20. **PASS** — Issue 20 (Ambiguous Authority Chain). WP-089 §Context lines 67-92 cites six authoritative documents in order. Pre-flight §Authority Chain enumerates twelve, explicitly including session-context and 01.5. EC-089 Source line 3 cites WP-089 as its origin. No ambiguity.

26. **PASS** — Issue 26 (Implicit Content Semantics). `'player'` / `'spectator'` literals are closed-union members locked in `uiAudience.types.ts:19-20`, EC-089 §Locked Values line 24, and WP-089 §Locked contract values line 154. `typeof playerID === 'string'` is the exact derivation rule. No convention-by-name.

### Category 10 — Error Handling & Failure Semantics

18. **PASS** — Issue 18 (Outcome Evaluation Timing Ambiguity). `playerView` runs on every state push (per WP-089 Scope(In)§A line 231 JSDoc requirement "so it must stay cheap") — a well-defined lifecycle moment owned by boardgame.io. No pre-vs-post-game ambiguity.

22. **PASS** — Issue 22 (Silent Failure vs Loud Failure Decisions Made Late). WP-089 §Non-Negotiable Constraints line 112 locks: `playerView` never throws — unparseable `playerID` returns a best-effort (spectator-filtered) `UIState`. EC-089 §Guardrails line 31 and Verification Step 3 (`Select-String … "throw "`) pin the rule.

### Category 11 — Single Responsibility & Logic Clarity

25. **PASS** — Issue 25 (Overloaded Function Responsibilities). `buildPlayerView` does four things in order: build `UIBuildContext` from `ctx`, call `buildUIState`, derive `UIAudience` from `playerID`, call `filterUIStateForAudience`. Each step is a single, named operation. No merging / validation / evaluation bundling.

---

## Mandatory Governance Follow-ups

- **DECISIONS.md entry:** D-8901 — "Engine-Level `playerView` Projection" per WP-089 canonical language at WP-089:405-414. Lands in Commit A (code commit) or Commit B (SPEC governance close); both are established patterns. Prefer Commit A per WP-088 precedent.
- **02-CODE-CATEGORIES.md update:** none (no new directory).
- **.claude/rules/*.md update:** none.
- **WORK_INDEX.md update:** PS-1 adds WP-089 row (Draft) in A0 SPEC; Commit B flips `[ ]` → `[x]` with date + Commit A hash.
- **EC_INDEX.md update:** PS-2 adds EC-089 row (Draft) in A0 SPEC; Commit B flips Draft → Done; Summary `Draft 46 → 47 → 46`; `Done 16 → 17`; `Total 62 → 63`.
- **Session-prompt locked-values insertions (from RISK FIXes above):**
  - Issue 4(a) — RS-1 inline-`UIAudience`-literal lock.
  - Issue 4(b) — RS-2 dual-context test-fixture lock.
  - Issue 21 — RS-3 exact cast-pattern lock (`as unknown as Game<LegendaryGameState>['playerView']`).
- **Post-execution back-sync candidates (non-blocking, for 01.6 post-mortem):**
  - WP-089 Scope(In)§A line 216 — drop the "if exported there" branch for `UIAudience`.
  - WP-089 line 237 — align `playerView` placement phrasing with EC-089 §Guardrails "adjacent to `setup` / `moves` / `phases`" per RS-7.
  - EC-089 §Files-to-Produce line 48 — clarify `makeMockCtx` usage per RS-2.

---

## Pre-Flight Verdict Disposition

- [x] **HOLD** — Issue 30's portion resolved 2026-04-24 via in-tree governance-row edits (PS-1 + PS-2 now PASS). Issues 4(a), 4(b), and 21 remain RISK until their FIXes fold into the forthcoming session execution prompt as locked-values entries. No pre-flight re-run required — all remaining findings are scope-neutral (they lock behavior, don't change the allowlist, don't change the test count, don't change the mutation boundary, don't change the code-category taxonomy). Expected trajectory: re-run the copilot check against the drafted session prompt; Issues 4(a)/4(b)/21 flip to PASS; verdict becomes CONFIRM.
- [ ] CONFIRM — not yet; session-prompt lock entries for Issues 4(a) / 4(b) / 21 must be applied and re-verified first.
- [ ] SUSPEND — not applicable; no blocker would require re-running pre-flight.

**Sequencing after HOLD:**

1. Author the session execution prompt (`docs/ai/invocations/session-wp089-engine-playerview-wiring.md`) with the three remaining locked-values entries folded into §Locked Values verbatim: RS-1 (inline `UIAudience` literal), RS-2 (dual-context test fixture), RS-3 (exact cast form `buildPlayerView as unknown as Game<LegendaryGameState>['playerView']`).
2. Commit the A0 SPEC bundle as `SPEC: WP-089 A0 pre-flight bundle — register WP-089 / EC-089 governance rows (PS-1, PS-2)` — staging `WORK_INDEX.md`, `EC_INDEX.md`, the two pre-flight / copilot artifacts, the session prompt, the session-context file, and the untracked WP-089 / EC-089 markdown files by exact filename only.
3. Re-run the copilot check against the committed artifacts (expect CONFIRM; all 30 issues PASS).
4. Open the WP-089 execution session in a fresh Claude Code session (step 3 per 01.4 workflow table).

---

## Re-Run 2026-04-24 (Post-A0 SPEC Commit `f5c6304`)

**Re-run trigger:** A0 SPEC bundle landed at commit `f5c6304` (2026-04-24) registering WP-089 in `WORK_INDEX.md` (line 1602) and EC-089 (Draft) in `EC_INDEX.md` (line 154, Summary `Draft 47 / Total 63`), plus the `Engine→Client Projection Wiring` Dependency Chain subsection (WORK_INDEX.md:1744-1745). Session execution prompt has **not yet been drafted** — that is step 2 of the 01.4 workflow and is pending this re-run's disposition.

**Re-scan delta vs. first-run:** Only Issue 30 changes state. The other 29 findings' dispositions are unchanged and not re-stated here (see first-run Findings above).

### Changed findings

30. **PASS** (was RISK) — Issue 30 (Missing Pre-Session Governance Fixes). PS-1 and PS-2 resolved in-tree and committed at `f5c6304`. `WORK_INDEX.md` now carries WP-089 as Ready with a 14-line notes block inherited verbatim from the preserved backup at `.claude/worktrees/wp088-handoff-preserve/WORK_INDEX.md.with-all-wp-a0:1602-1614`; the Dependency Chain ASCII block carries `WP-028 + WP-029 → WP-089 (LegendaryGame.playerView)` under a new `Engine→Client Projection Wiring (prerequisite for WP-090)` subsection. `EC_INDEX.md` now carries EC-089 as Draft with a freshly composed row (the preserved EC_INDEX backup did not contain an EC-089 row — documented as a session-context §2 back-sync candidate). `.claude/rules/work-packets.md` prohibition "Execute a packet not listed in WORK_INDEX.md" and EC-089 §Before Starting gate (d) are both satisfied. No governance drift detected — the committed row count matches the expected `Draft 47 / Total 63 / Done 16`.

### Unchanged RISK findings (still pending)

4. **RISK (unchanged)** — Issue 4 (Contract Drift). RS-1 (`UIAudience` inline literal) and RS-2 (dual-context test fixture) are explicitly locked in the pre-flight artifact and called out in §Authorized Next Step as mandatory session-prompt fold-ins, but the session prompt does not yet exist. The WP text at line 216 still reads "Import `UIAudience` from `./ui/uiState.filter.js` (type-only) if it is exported there; otherwise construct the audience literal inline", and the EC text at line 48 still reads "Uses `makeMockCtx` from `packages/game-engine/src/test/mockCtx.ts` for constructing the `ctx`-like fixture" — both carry the drift source text unchanged. Without a session prompt carrying the locks forward, the executor's primary reading path (EC + session prompt) does not see the RS-# resolutions.

   **FIX (unchanged):** Fold RS-1 and RS-2 into the forthcoming session prompt's §Locked Values verbatim. The WP / EC text remains as-authored (their back-sync is a non-blocking post-execution item per the pre-flight's Authorized Next Step list).

21. **RISK (unchanged)** — Issue 21 (Type Widening at Boundaries). RS-3 (exact cast pattern `buildPlayerView as unknown as Game<LegendaryGameState>['playerView']`, `as any` forbidden, generic-parameter change out of scope) is locked in the pre-flight but not yet present in a session prompt. Same disposition as Issue 4 — FIX carries forward to the session-prompt draft.

   **FIX (unchanged):** Fold RS-3 into the session prompt's §Locked Values as a mandatory cast pattern with the `// why:` comment form specified in the pre-flight.

### Re-Run Findings Summary

| Issue | First-run | Re-run 2026-04-24 | Δ |
|---|---|---|---|
| 4(a) — `UIAudience` import path | RISK | RISK | — |
| 4(b) — `makeMockCtx` vs `Ctx` | RISK | RISK | — |
| 21 — Type widening / cast form | RISK | RISK | — |
| 30 — Pre-session governance fixes | RISK | **PASS** | ✓ resolved via `f5c6304` |
| All other 26 issues | PASS | PASS | — |

**Re-run verdict: HOLD (unchanged).** Three scope-neutral RISK findings remain, all with a common resolution: draft the session prompt with RS-1 / RS-2 / RS-3 as mandatory §Locked Values entries. After the session prompt is drafted (still step 2 of 01.4 workflow), re-run the copilot check a second time against the EC + WP + pre-flight + session-prompt union — expected final verdict is **CONFIRM** with all 30 issues PASS.

**No pre-flight re-run required.** All remaining FIXes are scope-neutral session-prompt drafting items; they do not change the WP-089 file allowlist, test-count lock, mutation boundary, or code-category taxonomy. The pre-flight READY TO EXECUTE verdict stands.

### Re-Run Pre-Flight Verdict Disposition

- [x] **HOLD** — Session prompt draft pending. Session-prompt author is bound by pre-flight §Authorized Next Step to fold in RS-1 / RS-2 / RS-3. No other artifact changes required. After session-prompt drafting, re-run copilot check a second time; expect CONFIRM.
- [ ] CONFIRM — Withheld pending session-prompt draft carrying the RS-# locks.
- [ ] SUSPEND — Not applicable; scope has not changed.

**Next action in the workflow:** Draft `docs/ai/invocations/session-wp089-engine-playerview-wiring.md` folding in RS-1 / RS-2 / RS-3 / RS-4 (01.5 INVOKED) / RS-6 (01.6 post-mortem MANDATORY) per the pre-flight's Authorized Next Step list. Then re-run this copilot check for final CONFIRM.

---

## Re-Run 2026-04-24 #2 (Post-Session-Prompt Draft)

**Re-run trigger:** Session execution prompt drafted at `docs/ai/invocations/session-wp089-engine-playerview-wiring.md` folding in RS-1 / RS-2 / RS-3 / RS-4 / RS-6 locks verbatim per pre-flight §Authorized Next Step. Inputs reviewed are now four: EC-089, WP-089, pre-flight, and the new session prompt. This re-run closes the HOLD opened in first-run Disposition.

**Re-scan delta vs. Re-Run #1 (post-A0 commit):** Issues 4(a), 4(b), and 21 re-scanned against the session-prompt union.

### Changed findings

4. **PASS** (was RISK in both first-run and Re-Run #1) — Issue 4 (Contract Drift Between Types, Tests, and Runtime).
   - **4(a) `UIAudience` import path drift:** Session prompt §Locked Values "RS-1 — `UIAudience` Imports (Inline-Literal Lock)" locks "Do NOT import `UIAudience` into `game.ts`", enumerates the exact three imports that DO land (`buildUIState`, `filterUIStateForAudience`, `UIState` type-only), and specifies the inline-literal form at the `filterUIStateForAudience(...)` call site with `as const` narrowing. Session prompt §Hard Stops row 6 grep-enforces "Any `import` of `UIAudience` anywhere in `game.ts` — violates RS-1". Session prompt §Verification Steps "Invariant greps" block includes `grep -n "UIAudience" packages/game-engine/src/game.ts` with "Expected: no output". Session prompt §Implementation Tasks Task A explicitly adds "No `UIAudience` import (RS-1)". Session prompt §AI Agent Warning row 2 catches the tempting-but-wrong import. **Prevention by construction** — the executor cannot complete the task while importing `UIAudience` into `game.ts`; the grep gate would fail.
   - **4(b) `makeMockCtx` shape vs. runtime `Ctx`:** Session prompt §Locked Values "RS-2 — Dual-Context Test Fixture Lock" locks the dual-context pattern with an annotated code example (`makeMockCtx()` for `SetupContext` → `buildInitialGameState`; inline `ctxLike` literal for the runtime `Ctx` subset → `LegendaryGame.playerView!(...)`). Explicitly forbids four alternative paths: modifying `makeMockCtx`, creating a new shared helper, importing `boardgame.io/testing`, replacing `as any` with `as Ctx`. Session prompt §AI Agent Warning row 3 catches the tempting misreading of EC-089 line 48. Session prompt §Hard Stops row 5 locks "Any modification to `packages/game-engine/src/test/mockCtx.ts`". Session prompt §Implementation Tasks Task D carries the full test-file outline including the `ctxLike` block with its required `// why:` comment. **Prevention by construction** — the test template is literally in the prompt.

21. **PASS** (was RISK) — Issue 21 (Type Widening at Boundaries).
    Session prompt §Locked Values "RS-3 — Local Type Assertion Lock (Exact Cast Pattern)" specifies the only permitted cast form verbatim — `buildPlayerView as unknown as Game<LegendaryGameState>['playerView']` — along with its three-sentence mandatory `// why:` comment block citing WP-089 §Type Safety Note + D-0301 / D-8901 + the `game.ts:213` `endIf` precedent. Explicitly forbids four cast alternatives: `as any`, `as Game<UIState>['playerView']`, modifying the `Game<...>` generic, wrapper `Game()` instance / parallel object. Session prompt §Hard Stops rows 12-14 each grep-enforce one of the forbidden patterns. Session prompt §AI Agent Warning row 1 explicitly calls out "Casting too wide (`as any`) at the `playerView:` assignment" and explains why the `as unknown as Game<LegendaryGameState>['playerView']` preserves the signature guarantee. Session prompt §Implementation Tasks Task C carries the exact wiring line including the RS-3 `// why:` comment block. Session prompt §Final Instruction row 3 restates the RS-3 lock. **Prevention by construction** — every narrow path to the wrong cast form is grep-gated or guard-rail-warned.

### Unchanged findings

30. **PASS (unchanged)** — Issue 30 (Pre-Session Governance Fixes). `f5c6304` resolved PS-1 / PS-2 in Re-Run #1. No change.

All 26 first-run PASS findings remain PASS (no scope change, no new drift introduced by the session prompt).

### Additional verification against the 30-issue lens

Scanning the session prompt's ~640-line text against the other 26 issues:

- **Issue 1** (Engine / UI boundary drift) — Session prompt §Hard Stops row 8 grep-enforces no `apps/server/` / `@legendary-arena/registry` imports in `game.ts`; §Lifecycle-isolation audit in §Verification Steps grep-enforces `buildPlayerView` is called only from the `LegendaryGame` literal field. PASS.
- **Issue 2** (Non-determinism by convenience) — Session prompt §Hard Stops row 13 forbids `ctx.random.*`, `Math.random()`, `Date.now()`, `performance.now()`, `new Date()` inside `buildPlayerView`; §Verification Steps greps enforce. §AI Agent Warning "Do NOT" row 3 restates. PASS.
- **Issue 3** (Pure vs Immer confusion) — Session prompt §Goal item 3 locks "No intermediate mutation"; §Hard Stops rows 11-12 forbid mutation of `gameState` / `ctx` / `playerID`; Tests #5 / #6 in §Locked test baseline assert no-mutation via `JSON.stringify` identity. PASS.
- **Issue 5** (Optional field ambiguity) — Not triggered; `buildPlayerView` composes helpers that already handle optional `UIState.gameOver?` and `UIPlayerState.handCards?`. `as const` narrowing in the audience ternary avoids `exactOptionalPropertyTypes` pitfalls. PASS.
- **Issue 6** (Undefined merge semantics) — No merging. PASS.
- **Issue 7** (Persisting runtime state by accident) — Session prompt §WP Class line explicitly calls out "No serialization / replay / snapshot shape change"; §Implementation Tasks Task B's JSDoc cites "no mutation of gameState or ctx, no entries appended to gameState.messages". PASS.
- **Issue 8** (No single debugging truth) — Session prompt §Implementation Tasks Task B's JSDoc cites "Given identical (gameState, ctx, playerID), the output is byte-identical"; reproducibility locked via Test #4 determinism assertion. PASS.
- **Issue 9** (UI re-implements engine logic) — Session prompt §Goal item 4 locks delegation-only semantics; Test #1 asserts byte-equality with `filterUIStateForAudience(buildUIState(...))`; §AI Agent Warning "Do NOT" row 7 forbids asserting zone contents (that's WP-028 / WP-029 territory). PASS.
- **Issue 10** (Stringly-typed outcomes) — Audience derivation uses `typeof === 'string'` + `as const` narrowing to produce a properly-typed `UIAudience` discriminated union literal. PASS.
- **Issue 11** (Tests validate behavior not invariants) — Session prompt §Locked test baseline frames all six tests as contract-enforcement, not illustration (test file header literally says "If tests fail, the implementation is incorrect by definition. Do NOT weaken assertions to make tests pass — fix the implementation instead"). PASS.
- **Issue 12** (Scope creep during small packets) — Session prompt §Pre-Session Gate 6 locks `git diff --name-only` output to exactly 7 files (bundled) or 3+4 (split); §Verification Steps §Scope lock re-enforces; §Hard Stops row 1 catches generic ripple. PASS.
- **Issue 13** (Unclassified directories) — N/A, no new directory. PASS.
- **Issue 14** (No extension seams) — `UIAudience` discriminated union is the extension seam; future audiences add union members and route through the `typeof playerID === 'string'` branch without refactoring. Pre-flight §Maintainability item 1 PASS carries. PASS.
- **Issue 15** (Missing "why" for invariants) — Session prompt §Locked Values §Required `// why:` Comments enumerates three mandatory comment anchors with three-sentence-minimum specs; §Implementation Tasks Tasks B + C carry the verbatim comment text. PASS.
- **Issue 16** (Lifecycle wiring creep) — Session prompt §Hard Stops row 16 grep-enforces `buildPlayerView` not wired into phase / turn / move hooks; §Verification Steps §Lifecycle-isolation audit runs the grep; §AI Agent Warning row 4 explicitly forbids the pattern. PASS.
- **Issue 17** (Hidden mutation via aliasing) — Session prompt §Verification Steps §Aliasing self-audit RS-5 documents the upstream copy discipline; post-mortem §Aliasing self-audit section makes the audit mandatory. PASS.
- **Issue 18** (Outcome evaluation timing) — `playerView` runs on every state push — a well-defined lifecycle moment. PASS.
- **Issue 19** (Weak JSON-serializability) — `UIState` is JSON-serializable by WP-028 construction; projection does not introduce functions / Maps / Sets / class instances. PASS.
- **Issue 20** (Ambiguous authority chain) — Session prompt §Authority Chain lists 17 documents in strict order; §first line block names EC-089 as primary execution authority. PASS.
- **Issue 22** (Silent vs loud failure) — Session prompt §Goal item 1 locks "never throws"; §Hard Stops row 10 grep-enforces "Any `throw` statement introduced inside `buildPlayerView`"; §Verification Steps grep asserts. Malformed input produces best-effort spectator projection — explicit fail-soft pattern. PASS.
- **Issue 23** (Deterministic ordering) — Inherits from `buildUIState` / `filterUIStateForAudience`; Test #4 asserts. PASS.
- **Issue 24** (Mixed persistence concerns) — Projection is not persistence; no `G` field added; no `MatchSetupConfig` touch; no snapshot change. PASS.
- **Issue 25** (Overloaded function responsibilities) — `buildPlayerView` does exactly four locked steps in order. Session prompt §Locked Values §Projection order locks the body to those four steps; §Goal item 3 restates; §AI Agent Warning "Do NOT" row 6 forbids caching / memoization. PASS.
- **Issue 26** (Implicit content semantics) — `'player'` / `'spectator'` locked as closed-union members; `typeof playerID === 'string'` is the exact derivation with explicit `''` empty-seat-is-player carve-out. PASS.
- **Issue 27** (Weak canonical naming) — `playerID` (boardgame.io type name) vs `playerId` (audience field) distinction preserved verbatim; session prompt §Locked Values §Function signature calls out "`playerID` matches boardgame.io's type name and the audience-field `playerId` distinction is intentional per code-style Rule 14". PASS.
- **Issue 28** (No upgrade / deprecation story) — Additive change; clients that don't receive `playerView` simply got raw `G` before (documented in WP-089 §Session Context). No migration required. PASS.
- **Issue 29** (Assumptions leaking across layers) — Session prompt §Hard Stops rows 7-8 grep-enforce no server / registry imports; §WP Class locks engine-layer only. PASS.

### Re-Run #2 Findings Summary

| Issue | First-run | Re-Run #1 (2026-04-24 post-`f5c6304`) | Re-Run #2 (2026-04-24 post-session-prompt) | Δ #2 |
|---|---|---|---|---|
| 4(a) — `UIAudience` import path | RISK | RISK | **PASS** | ✓ prevented by RS-1 lock in session prompt |
| 4(b) — `makeMockCtx` vs `Ctx` | RISK | RISK | **PASS** | ✓ prevented by RS-2 dual-context lock in session prompt |
| 21 — Type widening / cast form | RISK | RISK | **PASS** | ✓ prevented by RS-3 exact cast lock in session prompt |
| 30 — Pre-session governance fixes | RISK | PASS | PASS | — (held from #1) |
| All other 26 issues | PASS | PASS | PASS | — |

**Re-run #2 verdict: 30 / 30 PASS.** No RISK findings. No FIX items outstanding. Session prompt's §Hard Stops, §Verification Steps, §Definition of Done, and §AI Agent Warning blocks collectively grep-gate every RS-# lock such that the executing agent cannot complete Commit A while violating any RS-# constraint.

### Re-Run #2 Pre-Flight Verdict Disposition

- [ ] HOLD — No, all RISK findings resolved.
- [x] **CONFIRM** — Pre-flight READY TO EXECUTE verdict stands. Session prompt generation complete. **Execution session is authorized to open in a fresh Claude Code session (step 3 per 01.4 workflow table).**
- [ ] SUSPEND — Not applicable; scope unchanged throughout.

**Sequencing after CONFIRM:**

1. Commit the session prompt + updated copilot check as a companion `SPEC:` commit (e.g., `SPEC: WP-089 A0 completion — session prompt + copilot check CONFIRM`) OR bundle with the next EC-089 code commit. Stage by exact filename only.
2. Open a fresh Claude Code session with `docs/ai/invocations/session-wp089-engine-playerview-wiring.md` as the working prompt.
3. Execute per the session prompt's §Implementation Tasks A-F.
4. Run §Verification Steps; confirm all pass.
5. Author 01.6 post-mortem before the governance-close commit.
6. Commit A (`EC-089:` prefix) ± Commit B (`SPEC:` prefix) per the executor's chosen commit topology.

The WP-089 pre-execution governance gate is fully satisfied. Execution authorization stands.
