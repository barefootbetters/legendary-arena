# WP-708 — Synergy Realization: per-match Synergy Rate + Table Total on the endgame report card (Game Engine + Server + Arena Client)

**Status:** Draft 2026-09-19 (EC-745; **D-24531** reserved)
**Layer:** Cross-layer — Game Engine (per-match counters + display-only scoring
field) · Server (coach line) · Arena Client (endgame render). **Lane:** Standard
two-session (spans three layers; adds a `G.diagnostics` sub-field and a
display-only scoring field — lightweight-lane ineligible per 01.0a #1/#2).
**Baseline:** `origin/main` @ `4ee5ff39` · **User-Visible Surface:**
play.legendary-arena.com (endgame outcome screen + coach summary)
**Design of record:** `docs/ai/DESIGN-SYNERGY-REALIZATION.md` (ratified framing:
synergy-first, cooperation deferred to a later phase).

## Goal

Give players their first end-of-match synergy feedback. Legendary rewards
assembling **conditional** Hero clauses (`[hc:X]` class synergy, `[team:X]`,
threshold gates); today the engine surfaces these only per-play and in passing.
This WP adds a **per-match** count of conditional clauses **played** and
**assembled** (condition met), derives a display-only **Synergy Rate** per seat
and a neutral **Table Total** across seats, and renders them on the endgame
report card and coach summary in a celebrate-first voice. Nothing changes the
score, grade, or any hash.

## Assumes

- **The condition chokepoint is single and stable.**
  `evaluateAllConditions(G, playerID, hook.conditions, cardId)`
  (`packages/game-engine/src/hero/heroConditions.evaluate.ts`) is called once per
  hook in `packages/game-engine/src/hero/heroEffects.execute.ts`; a false result
  `continue`s (the **WP-295 / D-24082** condition-failed branch that already
  appends a `blocked` `LogEntry`), a true result proceeds to fire. Both branches
  run identically in the live game and in the faithful replay reducer.
- **The signals this aggregates already ship — this WP is the missing
  aggregate, not new detection (supersession-reconciled, 01.0a Step 2):**
  - **WP-295 / D-24082** already detects + logs the whiff (condition-failed →
    `blocked`).
  - **WP-409 / D-24221** ships `lastPlayEffectsFired` → `UIState.game.lastPlayEffectsFired`,
    a **per-play** fired-count for the audio combo cue. It is transient
    (reset each turn) and not conditional-specific, so it is **not** a per-match
    Synergy Rate — but it is the precedent this extends.
  - **WP-706 / D-24528** enriched `EffectTrace.resolution` on `G.diagnostics`
    with computed magnitude + counted inputs for count-scaled effects. That is
    the building block for a **later** Realized-Value phase, **out of scope here**.
  - No shipped WP accumulates a per-match conditional-clause `played`/`assembled`
    tally or puts a Synergy Rate on the report card (WORK_INDEX-verified).
- **`G.diagnostics` is hash-excluded.** `computeStateHash` hashes all of `G`
  **except** `G.diagnostics` (WP-257 / D-24034; confirmed by D-24294 / D-24528,
  which rely on it). Adding a sub-field is **not** hash-affecting — `PRE_WP080`
  and sentinel `finalStateHash` stay byte-identical, **no re-pin**.
- **`GameDiagnostics` is the counters' home.** It already carries `hollowEffects`
  and the optional `traces?` (`packages/game-engine/src/diagnostics/hollowEffect.types.ts`),
  written by lazy recorder helpers (`hollowEffect.record.ts`,
  `effectTrace.record.ts`). This WP adds a sibling recorder + a sibling optional
  field, same lazy-init pattern (absent until first write).
- **The per-seat report-card split exists and is display-only.**
  `PlayerScoringContribution` (`packages/game-engine/src/scoring/parScoring.types.ts`,
  WP-616 / D-24427) is the per-seat split — its own comment names it "the
  tractable foundation for the 'enabled an ally' recognition; a future badge
  reads them." It flows to `CoachPlayerLine` (`apps/server/src/coach/coach.types.ts`,
  WP-622 / D-24433) and renders in `EndgameSummary.vue`'s `perPlayer` row
  (`contributionPhrases`). This WP extends that chain.
- **`ScoringInputs.perPlayer` is display-only and never enters the score.**
  `deriveScoringInputs` (`packages/game-engine/src/scoring/parScoring.logic.ts`)
  builds it from the reduced final state; PAR-baseline synthetic inputs carry
  none. Adding synergy fields keeps it display-only.
- **Hollow ≠ condition-failed.** `condition-failed` is a reachable, not-hollow
  `EffectExecutionReason`; unimplemented mechanics live in
  `G.diagnostics.hollowEffects` (`isHollowReason`). This WP excludes hollow
  mechanics from the counts so a player is never counted as failing to assemble a
  payoff we have not built.

## Context (Read First)

**Why this is now an aggregation WP, not a detection WP.** The original design
assumed no synergy feedback existed. The 01.0a supersession check found three
shipped WPs (WP-295 whiff log, WP-409 fired-count cue, WP-706 resolution trace)
that already build the per-play signals. What is genuinely absent is a
**per-match aggregate** on the **report card**. So the instrument is deliberately
minimal: a per-player `{conditionalPlayed, conditionalAssembled}` counter on the
hash-excluded `G.diagnostics`, incremented at the existing chokepoint, read into a
display-only scoring field. No new `EffectTraceStatus` member, no value ceiling,
no counterfactual — those belong to later phases (design doc §3).

**The counting rule (exact).** At the `evaluateAllConditions` call, for each hook
that carries **≥ 1 condition** and whose mechanic is **not hollow**:
- increment `conditionalPlayed[playerID]` (the denominator), and
- if `evaluateAllConditions` returned **true**, also increment
  `conditionalAssembled[playerID]` (the numerator).

An unconditional hook (empty `conditions`) is never counted. A hook whose
mechanic is hollow/unimplemented is excluded from both counts.

**The hollow-exclusion wrinkle (resolve at execution).** `detectHollowHeroHook`
runs only on condition-**passed** hooks (a condition-failed hook `continue`s
before hollow classification), so a condition-*failed* hook cannot be excluded by
reading a hollow record that was never written. Gate the denominator on the
hook's mechanic being in the **implemented/handled** set at the chokepoint
(the same allowlist hollow detection consults — `MVP_KEYWORDS` /
`HANDLED_KEYWORDS` / the primitive dispatch), independent of outcome. Pin it with
the hollow-fixture AC.

**Determinism.** No `ctx.random.*`, no wall-clock, no I/O. Pure increments on the
hash-excluded diagnostics channel; live and replay-reduced paths accumulate
identically.

## Scope (In)

- `packages/game-engine/src/diagnostics/hollowEffect.types.ts` — add an optional
  synergy sub-field to `GameDiagnostics`:
  `conditionalClauses?: Record<string /*playerID*/, { played: number; assembled: number }>`
  (absent until first write; lazy-init like `traces?`). Update the JSDoc.
- `packages/game-engine/src/diagnostics/synergyCount.record.ts` (**new**) —
  `recordConditionalClause(G, playerID, { assembled: boolean }): void`, a lazy
  recorder sibling to `recordHollowEffect`. Pure, never throws, no `boardgame.io`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — at the
  `evaluateAllConditions` chokepoint, call `recordConditionalClause` per the
  counting rule (both branches; hollow-excluded). No change to firing behavior.
- `packages/game-engine/src/scoring/parScoring.types.ts` — add display-only
  readonly fields to `PlayerScoringContribution`: `conditionalClausesPlayed`,
  `conditionalClausesAssembled`. JSDoc as display-only, never scored.
- `packages/game-engine/src/scoring/parScoring.logic.ts` — `deriveScoringInputs`
  reads `G.diagnostics.conditionalClauses?.[playerId]` into each per-player
  contribution (default 0 when absent). Not added to any raw-score/PAR term.
- `apps/server/src/coach/coach.types.ts` — add the two synergy fields to
  `CoachPlayerLine`.
- `apps/server/src/coach/coachSummary.logic.ts` — populate them from the score
  breakdown's per-player split (default 0 for pre-WP-708 records).
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — (1) a **Table
  Total** headline above the `perPlayer` block; (2) a celebratory *"assembled N
  of M synergy clauses"* line in each seat's contribution row. Copy obeys the
  two-vocabulary rule (below).
- Tests (engine + server + arena-client): recorder increments; chokepoint counts
  played/assembled and skips unconditional + hollow hooks; hash byte-identity;
  per-player scoring fields present and `finalScore` unchanged; coach line carries
  them; Vue renders the line + Table Total; copy-lint over the surfaced strings.

## Out of Scope

- **Realized Value %** and any value-ceiling computation (a later phase;
  WP-706 already captures realized `computedValue` for count-scaled effects).
- **The sequence teacher** / play-order counterfactual (later phase).
- **Cross-seat cooperation / HQ courtesy** (later phase, co-op-scoped — design
  doc §3.4).
- Any new `EffectTraceStatus` member or per-dispatch whiff trace.
- Villain / henchman / scheme conditional effects (hero path only).
- Any change to `finalScore`, PAR, grade, or leaderboard terms.
- Card-data edits; the ewiki page (a follow-up once this ships).

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/diagnostics/hollowEffect.types.ts` | `+ conditionalClauses?` on `GameDiagnostics` (lazy, hash-excluded) |
| `packages/game-engine/src/diagnostics/synergyCount.record.ts` | **new** — `recordConditionalClause` lazy recorder |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | count played/assembled at the `evaluateAllConditions` chokepoint (both branches, hollow-excluded); no firing change |
| `packages/game-engine/src/scoring/parScoring.types.ts` | `+ conditionalClausesPlayed` / `conditionalClausesAssembled` on `PlayerScoringContribution` (display-only) |
| `packages/game-engine/src/scoring/parScoring.logic.ts` | `deriveScoringInputs` reads the counters into `perPlayer`; not in any score term |
| `apps/server/src/coach/coach.types.ts` | `+` the two synergy fields on `CoachPlayerLine` |
| `apps/server/src/coach/coachSummary.logic.ts` | populate them (default 0 for old records) |
| `apps/arena-client/src/components/hud/EndgameSummary.vue` | Table Total headline + per-seat "assembled N of M" line; celebrate-voice copy |
| `packages/game-engine/src/diagnostics/synergyCount.record.test.ts` | **new** — recorder + non-vacuity |
| `packages/game-engine/src/hero/heroEffects.execute.test.ts` | chokepoint counting: met / unmet / unconditional-skipped / hollow-excluded; hash byte-identity |
| `packages/game-engine/src/scoring/parScoring.logic.test.ts` | per-player synergy fields present; `finalScore` unchanged |
| `apps/server/src/coach/coachSummary.logic.test.ts` | coach line carries synergy fields |
| `apps/arena-client/src/components/hud/EndgameSummary.*.test.ts` | renders line + Table Total; copy-lint (no forbidden words) |

Governance (not counted in the code allowlist, **NOT edited by this draft**; land
at execution): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24531 flips Active), `NUMBER-LEDGER.md` (already reserved),
`docs/ai/DESIGN-SYNERGY-REALIZATION.md` (ratified with this WP).

## Contract

- **`recordConditionalClause(G, playerID, { assembled }): void`** — lazy-creates
  `G.diagnostics.conditionalClauses`, increments `played` and (when `assembled`)
  `assembled` for `playerID`. Never throws.
- **Chokepoint** — in `heroEffects.execute.ts`, for a hook with ≥ 1 condition and
  a non-hollow mechanic: `recordConditionalClause(G, playerID, { assembled:
  <evaluateAllConditions result> })`. Unconditional or hollow hooks: no call.
- **`deriveScoringInputs`** — each `PlayerScoringContribution` carries
  `conditionalClausesPlayed` / `conditionalClausesAssembled` read from
  `G.diagnostics.conditionalClauses` (0 when absent). Display-only.
- **Synergy Rate / Table Total are derived at render**, not stored: `assembled /
  played` per seat (guard divide-by-zero — show no rate when `played === 0`);
  Table Total = Σ `assembled`.

## Non-Negotiable Constraints

- **Two vocabularies, never mixed (design doc §2).** Engine/diagnostics keep
  `conditional*` / `condition-failed` / `fired`; the player/coach surface shows
  **none** of `whiff` / `failed` / `error` / `missed` / `wasted`. Enforced by
  copy-lint (AC-7).
- **Off-ranking, display-only.** The synergy fields never enter `finalScore`,
  PAR, grade, or any competitive term (NG-1, no pay-to-win; no
  skill-stat-to-ranking leakage).
- **Hash-neutral.** Counters live on the hash-excluded `G.diagnostics`; no
  `finalStateHash` / `PRE_WP080` re-pin (asserted).
- **Determinism.** No `ctx.random.*`, wall-clock, or I/O; pure increments; live
  and replay paths identical.
- **Layer boundary.** Engine records + derives; server carries; client renders.
  No condition re-evaluation in the client (D-20105) — it renders numbers and the
  engine-authored count only. `synergyCount.record.ts` imports no `boardgame.io`.
- **Hollow-excluded counts (AC-4).**
- **Engine-wide standing rules.** `.claude/rules/code-style.md` +
  `docs/ai/REFERENCE/00.6-code-style.md` (human-style, JSDoc, `// why:` on the
  hash-excluded field + the counting rule); ESM-only `node:` built-ins;
  `.test.ts` on `node:test`; Node v22+; no `.reduce()` in the counter logic.

## Vision Alignment

- **§1 Rules Authenticity / skill growth** — surfaces the synergy the game
  already rewards, teaching players to assemble it.
- **§3 Player Trust & Fairness** — display-only, deterministic, seat-symmetric;
  celebrate-first framing, never a scold.
- **NG-1 no pay-to-win** — pure skill signal, never a score/ranking term, never
  purchasable.
- **Determinism (§8/§22)** — hash-excluded counters; no `ctx.random.*`/I/O; no
  re-pin.

## Acceptance Criteria

1. A conditional hero hook whose condition **passes** increments both `played`
   and `assembled` for the acting seat; a hook whose condition **fails**
   increments `played` only; an **unconditional** hook increments neither.
   Asserted on `G.diagnostics` after a real play, not a fixture value
   (reward-integrity non-vacuity).
2. Per-player counters accumulate on `G.diagnostics.conditionalClauses`,
   hash-excluded; sentinel `finalStateHash` + `PRE_WP080_HASH` **byte-identical**
   (no re-pin), asserted via sweep + full run.
3. `PlayerScoringContribution` carries `conditionalClausesPlayed` /
   `conditionalClausesAssembled`; `finalScore`, `rawScore`, and grade are
   **unchanged** for every fixture (asserted).
4. A **hollow** (unimplemented-mechanic) conditional hook is excluded from both
   counts — asserted against a known-hollow fixture.
5. `EndgameSummary.vue` renders, for the exporting seat, the **Table Total** then
   the seat's *"assembled N of M synergy clauses"* line, in that order; no rate
   shown when `played === 0`.
6. `CoachPlayerLine` carries the two synergy fields (default 0 for old records),
   asserted.
7. **Copy-lint:** the surfaced player/coach strings contain none of
   `whiff` / `failed` / `error` / `missed` / `wasted` (a test over the copy).
   Engine/diagnostic identifiers are exempt.
8. Control / non-vacuity: stubbing `recordConditionalClause` to a no-op fails
   AC-1 and AC-5; restore.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → green; record pass delta.
3. `pnpm --filter @legendary-arena/server test` and
   `pnpm --filter @legendary-arena/arena-client test` (+ `vue-tsc`) → green.
4. Control-stub the recorder → AC-1/AC-5 FAIL (non-vacuous); restore.
5. Sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged (sweep + full run);
   `pnpm sim:runtime-observed:check` current (diagnostics hash-excluded — no
   regeneration expected).
6. `pnpm -r build` → 0. `git diff --name-only` = the allowlist + governance only.
7. **Live-verify (operator-pending, post-deploy, D-24026):** play a real match
   with a `[hc:X]` / `[team:X]` card into both a live and a dead condition; the
   endgame shows the Table Total and the seat's assembled/played line; the coach
   can cite it.

## Definition of Done

- [ ] All ACs met; engine/server/client suites green (pass delta recorded).
- [ ] Sentinel + `PRE_WP080` hashes byte-identical (no re-pin).
- [ ] `finalScore`/grade unchanged for every fixture (display-only proven).
- [ ] Copy-lint green (no forbidden words in surfaced strings).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] `DESIGN-SYNERGY-REALIZATION.md` ratified (committed with this WP).
- [ ] D-24531 flipped Active; WORK_INDEX row `[x]`; EC_INDEX `Done`; roadmap
      `📝`→`✅`; `roadmap:counts:check` 0; STATUS close-out.
- [ ] Two-commit topology (EC-745 impl + SPEC close).
- [ ] Live-verify performed or explicitly operator-pending.

## Reserved Decision (lands at execution)

**D-24531** — Synergy Realization Phase 1: a per-player conditional-clause counter
(`played` / `assembled`) on the hash-excluded `G.diagnostics` channel, recorded at
the `heroEffects.execute.ts` `evaluateAllConditions` chokepoint (hollow-excluded,
building on the WP-295/D-24082 condition-failed branch), surfaced as a
**display-only** Synergy Rate on `PlayerScoringContribution` → `CoachPlayerLine` →
`EndgameSummary.vue` plus a neutral cross-seat Table Total. Never enters
`finalScore`/PAR (NG-1). No `EffectTraceStatus` change; hash-neutral (no re-pin).
The foundation later phases (Realized Value % over WP-706's `EffectTrace.resolution`;
the play-order sequence teacher; co-op cross-seat cooperation) build on. See
DECISIONS.md and `DESIGN-SYNERGY-REALIZATION.md`.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS (all required WP sections, in order).
- **§2 Non-Negotiable Constraints** — PASS (explicit block; vocabulary +
  off-ranking + hash-neutral + standing engine rules).
- **§3 Assumes** — PASS (each assumption cites its locking WP/D; the supersession
  reconciliation is explicit).
- **§4 Context** — PASS (`## Context (Read First)` covers the aggregation-not-
  detection framing, the counting rule, the hollow wrinkle, determinism).
- **§5 Files Expected to Change** — PASS (closed allowlist; governance called out
  as not-edited-by-draft).
- **§6 Naming Consistency** — PASS (`conditionalClauses`, `recordConditionalClause`,
  `PlayerScoringContribution`, `deriveScoringInputs`, `CoachPlayerLine`,
  `contributionPhrases` — verified on `origin/main`).
- **§7 Dependency Discipline** — PASS (all hard-deps landed: WP-295, WP-409,
  WP-616, WP-622, WP-488/706, D-24034).
- **§8 Architectural Boundaries** — PASS (engine records/derives; server carries;
  client renders; no `boardgame.io` in the recorder; no client condition
  re-eval; no `.reduce()`; hash-excluded channel).
- **§9 Windows Compatibility** — N/A (no shell/path work).
- **§10 Env Var Hygiene** — N/A.
- **§11 Authentication Clarity** — N/A.
- **§12 Test Quality** — PASS (`node:test`, `.test.ts`; non-vacuous control-stub;
  copy-lint; hash byte-identity).
- **§13 Commands & Verification** — PASS (runnable steps incl. hash sweep +
  live-verify).
- **§14 Acceptance Criteria Quality** — PASS (8 testable, non-vacuous ACs).
- **§15 Definition of Done** — PASS (binary gates incl. hash identity +
  design-doc ratification + two-commit topology).
- **§16 Code Style** — PASS (human-style, JSDoc, `// why:` on the hash-excluded
  field + counting rule).
- **§17 Vision Alignment** — PASS (§1/§3, NG-1, determinism §8/§22).
- **§18 Prose-vs-Grep Discipline** — PASS (no verification-grep token reused as
  prose).
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline `origin/main` @ `4ee5ff39`;
  drafted in a fresh worktree off `origin/main`, not the 118-behind session
  worktree).
- **§20 Funding Surface Gate** — N/A (no pricing/checkout/account surface).
- **§21 API Catalog Update** — N/A (no `apps/server` endpoint or `Library-only`
  export change; the coach summary is internal, assembled server-side).

**Pre-flight verdict:** READY TO EXECUTE (all hard-deps on `main`; scope locked;
the one open execution detail — the hollow-exclusion gate for condition-failed
hooks — is specified in Context and pinned by AC-4).
**Copilot check verdict:** PASS.
