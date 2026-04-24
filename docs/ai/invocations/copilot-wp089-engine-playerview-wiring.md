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
