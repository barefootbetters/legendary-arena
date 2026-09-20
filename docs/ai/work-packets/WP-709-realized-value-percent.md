# WP-709 — Synergy Realization: Realized Value % on the endgame report card (Game Engine + Server + Arena Client)

**Status:** Draft 2026-09-19 (EC-746; **D-24532** reserved)
**Layer:** Cross-layer — Game Engine (per-clause value derivation + per-match
value sums + display-only scoring fields) · Server (coach line) · Arena Client
(endgame render). **Lane:** Standard two-session (spans three layers; extends a
`G.diagnostics` sub-record and adds display-only scoring fields — lightweight-lane
ineligible per 01.0a #1/#2).
**Baseline:** `origin/main` @ `b45362aa` · **User-Visible Surface:**
play.legendary-arena.com (endgame outcome screen + coach summary)
**Design of record:** `docs/ai/DESIGN-SYNERGY-REALIZATION.md` §2.3 / §3.3
(Phase 2 — Realized Value %). Phase 1 (Synergy Rate + Table Total) shipped as
WP-708 / EC-745 / D-24531.

## Goal

Phase 1 (WP-708) counts conditional Hero clauses **played** and **assembled** —
but it weighs a whiffed `+1 Recruit` exactly the same as a whiffed `+6 Attack`
game-swing. This WP adds a display-only **Realized Value %**: it weights each
conditional clause by the attack/recruit value it realized versus the value it
could have offered, so landing a big synergy counts more than landing a small one
and whiffing a game-swing costs more than whiffing a chip. The metric is derived
from the effect descriptor magnitude and the `HeroCountSource` count at the same
`evaluateAllConditions` chokepoint Phase 1 uses, accumulated as realized/potential
value sums on the hash-excluded `G.diagnostics`, and rendered on the endgame
report card + coach in a celebrate-first voice. Nothing changes the score, grade,
or any hash.

## Assumes

- **Phase 1 shipped and is stable (WP-708 / EC-745 / D-24531 on `main`).**
  - `packages/game-engine/src/diagnostics/synergyCount.record.ts` exports
    `recordConditionalClause(G, playerID, { assembled: boolean }): void`, a lazy
    recorder that increments `G.diagnostics.conditionalClauses[playerID]`
    (`{ played, assembled }`).
  - `packages/game-engine/src/hero/heroEffects.execute.ts` — the per-hook loop in
    `executeHeroEffects` computes
    `isCountableConditionalClause = (hook.conditions?.length ?? 0) > 0 && hookHasExecutableEffect(hook)`
    and calls `recordConditionalClause` on **both** the condition-failed branch
    (`{ assembled: false }`, before the WP-295 `blocked` log) and the
    conditions-passed branch (`{ assembled: true }`, before `runHookEffects`). The
    wait-and-see / numeric-threshold branch `continue`s **without** counting.
  - `PlayerScoringContribution` (`scoring/parScoring.types.ts`) carries the
    display-only `conditionalClausesPlayed` / `conditionalClausesAssembled`;
    `deriveScoringInputs` (`scoring/parScoring.logic.ts`) reads
    `gameState.diagnostics?.conditionalClauses?.[playerId]` into each per-player
    contribution (default 0). `CoachPlayerLine`
    (`apps/server/src/coach/coach.types.ts`) carries the two fields;
    `buildCoachMatchSummary` (`coach/coachSummary.logic.ts`) populates them;
    `EndgameSummary.vue` renders `synergyPhrase` + `synergyTableTotal`; the client
    mirrors them in `competitionApi.ts` `CompetitivePlayerContribution` and
    `vfx/scoreCalcDisplay.ts`.
- **The realized computation of count-scaled effects already ships
  (WP-706 / D-24528 on `main`).** `buildCountScaledResolution`
  (`hero/heroEffects.execute.ts`) computes, for an `attack-per-count` /
  `recruit-per-count` effect, `computedValue = magnitude × floor(count / perEach)`
  with `count = resolveCountSource(G, playerID, countSource, cardId)` and
  `perEach = effect.perEach && effect.perEach > 0 ? effect.perEach : 1`, recorded
  on `EffectTrace.resolution` (hash-excluded `G.diagnostics.traces`). This WP
  **re-derives** that same math at the chokepoint (see §Context — why not read the
  trace) so realized value is computed identically and completely.
- **`resolveCountSource` is a pure, total read (WP-680 family on `main`).**
  `resolveCountSource(G, playerID, source, triggeringCardId?)`
  (`hero/heroCountSource.resolve.ts`) returns a non-negative integer read from
  settled `G` zones; it is deterministic, does not mutate `G`, and does not import
  `boardgame.io`. Calling it a second time at the chokepoint returns the identical
  integer the grant uses (the grant only mutates `turnEconomy`, never `inPlay`).
- **The value currency is attack + recruit magnitude.** The four
  value-granting Hero keywords are `attack`, `recruit` (flat, `magnitude`) and
  `attack-per-count`, `recruit-per-count` (count-scaled, `magnitude` + `countSource`
  + `perEach`) — the exact set WP-706 assigns `resource: 'attack' | 'recruit'`.
  `HeroEffectDescriptor` (`rules/heroAbility.types.ts`) carries `type: HeroKeyword`,
  `magnitude?`, `countSource?`, `perEach?`.
- **`G.diagnostics` is hash-excluded.** `computeStateHash`
  (`replay/replay.hash.ts:78`) and the `finalStateHash` oracle
  (`src/test/fixtures/hashGameState.ts:109`) both rest-destructure `diagnostics` out before
  hashing (WP-451 / D-24271). Extending the `conditionalClauses` sub-record with
  two number fields is **not** hash-affecting — `PRE_WP080_HASH` and sentinel
  `finalStateHash` stay byte-identical, **no re-pin**.

## Context (Read First)

**Why compute at the chokepoint, not read back the WP-706 trace.** The prompt
offered two sources for the aggregate: extend the Phase-1 tally, or read back the
`EffectTrace.resolution` traces. The tally wins on every axis:

1. **Traces are capped** (`EFFECT_TRACES_CAP = 512`) and cap-dropped on a long
   match — a trace-readback aggregate is lossy; the tally is exact.
2. **Traces exist only for count-scaled effects** — a flat `+2 Attack if Avenger`
   conditional clause records no `resolution`, so a trace readback would miss the
   majority of value clauses.
3. **A whiffed clause records no trace at all** (`runHookEffects` is skipped when
   the condition fails), yet the whiff is exactly where potential value must be
   counted. Only the chokepoint sees the whiff branch.
4. The chokepoint is the single site that already has the hook, the condition
   result, and the player — Phase 1 already records `{ played, assembled }` there.

So this WP derives per-clause value at the chokepoint and accumulates
realized/potential value sums alongside the existing counters. For an **assembled**
count-scaled clause the derived realized value equals the WP-706 `computedValue`
for the same play (the count source reads the same settled `inPlay`), pinned by a
cross-check test — so the two representations stay consistent while the tally
remains exact and complete.

**The value model (exact).** For each countable conditional clause (the Phase-1
population: `≥ 1 condition AND hookHasExecutableEffect`), define its
**clause value** as the sum, over the hook's legacy `effects`, of the
attack/recruit magnitude each value keyword offers **at the current board state**:

- `attack` / `recruit` (flat): `magnitude ?? 0`.
- `attack-per-count` / `recruit-per-count` (count-scaled):
  `magnitude × floor(resolveCountSource(G, playerID, countSource, cardId) / perEach)`,
  with `perEach` normalized absent/≤ 0 → 1 and `countSource` absent → contributes 0
  (mirrors `buildCountScaledResolution`).

Then at the chokepoint, for each countable conditional clause:

- `potentialValue += clauseValue` (the value the clause **could have offered**),
  and
- if `evaluateAllConditions` returned **true**, `realizedValue += clauseValue` (the
  value it **actually realized**).

The count source reads `inPlay` / victory zones that are settled by hook-evaluation
time and are independent of the boolean condition, so the clause value — the
"ceiling" — is computable identically on **both** the assembled and the whiffed
branch. Clause value is the **hook-evaluation-time (pre-`runHookEffects`) board
snapshot**: for a multi-effect hook where an earlier effect feeds a later
count-scaled effect the displayed value can differ from the per-effect grant, which
is by design (display-only; live and replay both snapshot pre-execution → no
determinism impact), and is why the AC-3 `realizedValue === computedValue`
cross-check is bounded to a hook with a single count-scaled value effect. An assembled clause contributes equally to realized and potential (it fired
in full); a whiffed clause contributes its value to potential only. A clause with
no attack/recruit effects has clause value 0 and moves neither sum — it stays in the
Phase-1 Synergy Rate but carries no value weight (v1 scopes "value" to the
attack/recruit currency the count-scaled family produces).

**Realized Value % is derived at render, not stored:**
`round(100 × realizedValue / potentialValue)` per seat, hidden when
`potentialValue === 0` (no synergy value that match). Rendered below the Phase-1
Synergy Rate line, in the design-doc §3.3 order (Table Total → Synergy Rate →
Realized Value %).

**Determinism.** No `ctx.random.*`, wall-clock, or I/O. `resolveCountSource` is a
pure read; the value helper mutates nothing. Live and replay-reduced paths
accumulate identically. The value sums ride the hash-excluded `G.diagnostics`
channel — no re-pin.

## Scope (In)

- `packages/game-engine/src/diagnostics/hollowEffect.types.ts` — extend the
  `GameDiagnostics.conditionalClauses` per-player record from
  `{ played: number; assembled: number }` to
  `{ played: number; assembled: number; potentialValue: number; realizedValue: number }`.
  Additive; still lazy-init; still hash-excluded. Update the JSDoc.
- `packages/game-engine/src/diagnostics/synergyCount.record.ts` — extend
  `recordConditionalClause(G, playerID, { assembled, clauseValue }): void`:
  `played += 1`, `potentialValue += clauseValue`, and (when `assembled`)
  `assembled += 1`, `realizedValue += clauseValue`. Pure, never throws, no
  `boardgame.io`.
- `packages/game-engine/src/hero/heroClauseValue.derive.ts` (**new**) — a pure
  `heroClauseValue(G, playerID, cardId, hook): number` that sums the attack/recruit
  clause value per the model above (flat magnitude + count-scaled
  `magnitude × floor(count / perEach)` via `resolveCountSource`). No
  `boardgame.io`; no `G` mutation; `for...of`, no `.reduce()`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — at the chokepoint,
  when `isCountableConditionalClause`, compute `clauseValue` once and pass it to
  `recordConditionalClause` on both branches (whiff `{ assembled: false }`,
  assembled `{ assembled: true }`). No change to firing behavior, no new call site.
- `packages/game-engine/src/scoring/parScoring.types.ts` — add display-only
  readonly fields to `PlayerScoringContribution`:
  `conditionalClausesRealizedValue`, `conditionalClausesPotentialValue`. JSDoc as
  display-only, never scored.
- `packages/game-engine/src/scoring/parScoring.logic.ts` — `deriveScoringInputs`
  reads the two value sums from `G.diagnostics.conditionalClauses?.[playerId]`
  (default 0 when absent) into each per-player contribution (the `perPlayer.push`
  ~line 127); **and** `buildScoreBreakdown`'s field-by-field deep-copy of
  `PlayerScoringContribution` (~lines 415–429) must copy the two new fields too, or
  they silently never reach `competitionApi`/the client (the same manual-copy
  whitelist class as the UIState filter). Not added to any raw-score / PAR term.
- `apps/server/src/coach/coach.types.ts` — add the two value fields to
  `CoachPlayerLine`.
- `apps/server/src/coach/coachSummary.logic.ts` — populate them from the per-player
  contribution (default 0 for pre-WP-709 records).
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — a celebratory
  *"realized N% of your synergy value"* line per seat, below the Synergy Rate line;
  hidden when potential value is 0. Copy obeys the two-vocabulary rule.
- `apps/arena-client/src/lib/api/competitionApi.ts` — mirror the two value fields
  (optional) on `CompetitivePlayerContribution`.
- `apps/arena-client/src/vfx/scoreCalcDisplay.ts` — mirror the two value fields
  (nullable) on the client report-card contribution.
- Tests (engine + server + arena-client): value helper (flat sum, count-scaled
  math, non-value clause = 0, cross-check vs `resolveCountSource`); recorder value
  accumulation; chokepoint realized/potential accumulate (assembled adds both,
  whiff adds potential only) + cross-check realized == WP-706 `computedValue`; hash
  byte-identity; per-player scoring fields present and `finalScore` unchanged; coach
  line carries them; Vue renders the % line and hides it at potential 0; copy-lint
  over the surfaced strings.

## Out of Scope

- **The play-order sequence teacher** (the play-order counterfactual over the
  D-24119 faithful replay). Its feasibility — observing per-effect signals during
  replay re-execution — is an **open design question**; it is a separate later WP,
  explicitly not bundled here (design doc §3.3).
- **Cross-seat cooperation / HQ courtesy** (Phase 3, co-op-scoped — design doc §3.4).
- **Value from `primitiveEffects` composition grants** (Berserk / Empowered
  `gain-resource` nodes, whose `amount` can be a dynamic expression). v1 scopes
  clause value to legacy `attack` / `recruit` / `attack-per-count` /
  `recruit-per-count` effects; a conditional hook that grants value only via
  primitives counts in the Phase-1 Synergy Rate but carries no value weight. A
  primitive-value refinement is a named follow-up.
- **The `count-scaled-choose` family** (`resolveCountScaledChoice`, vnom Symbiotic
  Adaptation) and **`reveal-herodeck-attack`** — the same dispatch sites WP-706
  excluded (a pending-choice resolved outside the chokepoint; a divisor-based
  reveal whose magnitude is not a flat value). Follow-up.
- **Non-resource clause value** — draw / KO / rescue conditional clauses carry no
  attack/recruit value and are naturally excluded from the value ratio (they remain
  in the Phase-1 Synergy Rate).
- Any new `EffectTraceStatus` member or per-dispatch whiff trace.
- Villain / henchman / scheme conditional effects (hero path only).
- Any change to `finalScore`, PAR, grade, or leaderboard terms; card-data edits;
  the ewiki page (a follow-up once the arc settles).

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/diagnostics/hollowEffect.types.ts` | extend `conditionalClauses` record with `potentialValue` / `realizedValue` (lazy, hash-excluded) |
| `packages/game-engine/src/diagnostics/synergyCount.record.ts` | `recordConditionalClause` takes `clauseValue`; accumulates the two value sums |
| `packages/game-engine/src/hero/heroClauseValue.derive.ts` | **new** — pure `heroClauseValue` attack/recruit value summer |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | compute `clauseValue` at the chokepoint; pass to the recorder on both branches; no firing change |
| `packages/game-engine/src/scoring/parScoring.types.ts` | `+ conditionalClausesRealizedValue` / `conditionalClausesPotentialValue` on `PlayerScoringContribution` (display-only) |
| `packages/game-engine/src/scoring/parScoring.logic.ts` | `deriveScoringInputs` reads the value sums into `perPlayer`; not in any score term |
| `apps/server/src/coach/coach.types.ts` | `+` the two value fields on `CoachPlayerLine` |
| `apps/server/src/coach/coachSummary.logic.ts` | populate them (default 0 for old records) |
| `apps/arena-client/src/components/hud/EndgameSummary.vue` | per-seat "realized N% of your synergy value" line; hidden at potential 0; celebrate-voice copy |
| `apps/arena-client/src/lib/api/competitionApi.ts` | mirror the two value fields (optional) |
| `apps/arena-client/src/vfx/scoreCalcDisplay.ts` | mirror the two value fields (nullable) |
| `packages/game-engine/src/hero/heroClauseValue.derive.test.ts` | **new** — value helper: flat / count-scaled / non-value / cross-check |
| `packages/game-engine/src/diagnostics/synergyCount.record.test.ts` | recorder value accumulation |
| `packages/game-engine/src/hero/heroEffects.execute.test.ts` | chokepoint realized/potential accumulation; whiff adds potential only; realized == WP-706 `computedValue`; hash byte-identity |
| `packages/game-engine/src/hero/heroEffects.conditional.test.ts` | extend the exact-match chokepoint `deepEqual` pins (~:451/:471) with `potentialValue`/`realizedValue`; the `=== undefined` unconditional/hollow assertions (~:487/:507) stay unchanged |
| `packages/game-engine/src/scoring/parScoring.logic.test.ts` | per-player value fields present; `finalScore` unchanged |
| `apps/server/src/coach/coachSummary.logic.test.ts` | coach line carries value fields |
| `apps/arena-client/src/components/hud/EndgameSummary.test.ts` | renders % line; hidden at potential 0; copy-lint (no forbidden words) |
| `apps/arena-client/src/vfx/scoreCalcDisplay.test.ts` | client mirror carries value fields |

Governance (not counted in the code allowlist, land at execution): `WORK_INDEX.md`,
`EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`, `DECISIONS.md` (D-24532 flips Active),
`NUMBER-LEDGER.md` (mark reservations landed), `STATUS.md`.

## Contract

- **`recordConditionalClause(G, playerID, { assembled: boolean; clauseValue: number }): void`**
  — lazy-creates `G.diagnostics.conditionalClauses`, increments `played` and
  `potentialValue += clauseValue`, and (when `assembled`) `assembled` and
  `realizedValue += clauseValue`, for `playerID`. Never throws.
- **`heroClauseValue(G, playerID, cardId, hook): number`** — the sum of
  attack/recruit clause value over the hook's legacy `effects` (flat `magnitude`;
  count-scaled `magnitude × floor(resolveCountSource / perEach)`, `perEach`
  normalized absent/≤ 0 → 1, absent `countSource` → 0). Pure; returns 0 for a hook
  with no attack/recruit effects.
- **Chokepoint** — in `heroEffects.execute.ts`, for a countable conditional clause,
  `const clauseValue = heroClauseValue(G, playerID, cardId, hook)` then
  `recordConditionalClause(G, playerID, { assembled: <evaluateAllConditions result>, clauseValue })`.
- **`GameDiagnostics.conditionalClauses`** — the per-player record gains
  `potentialValue: number` and `realizedValue: number` (additive; lazy; hash-excluded).
- **`deriveScoringInputs`** — each `PlayerScoringContribution` carries
  `conditionalClausesRealizedValue` / `conditionalClausesPotentialValue` (0 when
  absent). Display-only.
- **Realized Value % is derived at render**, not stored:
  `round(100 × realizedValue / potentialValue)` per seat (guard divide-by-zero —
  show no line when `potentialValue === 0`).

## Non-Negotiable Constraints

- **Two vocabularies, never mixed (design doc §2).** Engine/diagnostics keep
  `potentialValue` / `realizedValue` / `clauseValue` / `condition-failed`; the
  player/coach surface shows **none** of `whiff` / `failed` / `error` / `missed` /
  `wasted`. Enforced by copy-lint (AC-8).
- **Off-ranking, display-only.** The value fields never enter `finalScore`, PAR,
  grade, or any competitive term (NG-1, no pay-to-win; no skill-stat-to-ranking
  leakage).
- **Hash-neutral.** The value sums ride the hash-excluded `G.diagnostics`; no
  `finalStateHash` / `PRE_WP080` re-pin (asserted empirically — a re-pin means value
  leaked out of diagnostics; STOP).
- **The gameplay grant path is untouched.** `resolveCountSource` returns the same
  integer the grant uses; the value helper only reads. A count-scaled play must
  grant exactly what it grants today.
- **Determinism.** No `ctx.random.*`, wall-clock, or I/O; pure reads + increments;
  live and replay paths identical.
- **Layer boundary.** Engine derives + records; server carries; client renders. No
  condition or value re-computation in the client (D-20105) — it renders the
  engine-authored numbers only. `synergyCount.record.ts` and
  `heroClauseValue.derive.ts` import no `boardgame.io`.
- **Hero path only.** Villain / scheme conditional effects out.
- **Engine-wide standing rules.** `.claude/rules/code-style.md` +
  `docs/ai/REFERENCE/00.6-code-style.md` (human-style, JSDoc, `// why:` on the
  hash-excluded fields + the value model + the count-scaled normalization); ESM-only
  `node:` built-ins; `.test.ts` on `node:test`; Node v22+; no `.reduce()` in the
  value/counter logic.

## Vision Alignment

- **§1 Rules Authenticity / skill growth** — surfaces how much of the synergy value
  the game rewards a player actually landed, teaching them to assemble the big swings.
- **§3 Player Trust & Fairness** — display-only, deterministic, seat-symmetric;
  celebrate-first framing, never a scold.
- **NG-1 no pay-to-win** — pure skill signal, never a score/ranking term, never
  purchasable.
- **Determinism (§8/§22)** — hash-excluded value sums; no `ctx.random.*`/I/O; no
  re-pin.

## Acceptance Criteria

1. `heroClauseValue` returns the summed attack/recruit value for a hook: a flat
   `attack`/`recruit` effect contributes `magnitude`; an `attack-per-count` /
   `recruit-per-count` effect contributes `magnitude × floor(count / perEach)` with
   `perEach` normalized absent/≤ 0 → 1 and absent `countSource` → 0; a hook with no
   attack/recruit effect returns 0. Asserted on real hooks, not fixture constants.
2. At the chokepoint, a countable conditional clause whose condition **passes**
   adds its clause value to both `potentialValue` and `realizedValue`; a clause whose
   condition **fails** adds it to `potentialValue` only; an unconditional or hollow
   hook adds neither. Asserted on `G.diagnostics` after a real play (non-vacuity).
3. For an **assembled count-scaled** conditional clause with a **single**
   count-scaled value effect, the recorded `realizedValue` equals the WP-706
   `EffectTrace.resolution.computedValue` for the same play (the two derivations
   agree — cross-check; the helper sums per-hook while `resolution.computedValue` is
   per-effect, so the cross-check hook must carry exactly one count-scaled effect).
4. The value sums accumulate on `G.diagnostics.conditionalClauses`, hash-excluded;
   sentinel `finalStateHash` + `PRE_WP080_HASH` **byte-identical** (no re-pin),
   asserted via sweep + full run.
5. `PlayerScoringContribution` carries `conditionalClausesRealizedValue` /
   `conditionalClausesPotentialValue`; `finalScore`, `rawScore`, and grade are
   **unchanged** for every fixture (asserted).
6. `CoachPlayerLine` carries the two value fields (default 0 for old records),
   asserted.
7. `EndgameSummary.vue` renders, for the exporting seat, a *"realized N% of your
   synergy value"* line below the Synergy Rate line; no line shown when
   `potentialValue === 0`.
8. **Copy-lint:** the surfaced player/coach strings contain none of
   `whiff` / `failed` / `error` / `missed` / `wasted` (a test over the copy).
   Engine/diagnostic identifiers are exempt.
9. Control / non-vacuity: stubbing `heroClauseValue` to return 0 fails AC-1/AC-3 and
   the render AC; restore.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → green; record pass delta.
3. `pnpm --filter @legendary-arena/server test` and
   `pnpm --filter @legendary-arena/arena-client test` (+ `vue-tsc`) → green.
4. Control-stub `heroClauseValue` → AC-1/AC-3/AC-7 FAIL (non-vacuous); restore.
5. Sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged (sweep + full run);
   `pnpm sim:runtime-observed:check` current (diagnostics hash-excluded — no
   regeneration expected).
6. `pnpm -r build` → 0. `git diff --name-only` = the allowlist + governance only.
7. **Live-verify (operator-pending, post-deploy, D-24026):** play a real match with
   a count-scaled `[hc:X]` / `[team:X]` card into a live condition and a flat
   conditional card into a dead condition; the endgame shows the seat's Realized
   Value %; the coach can cite it.

## Definition of Done

- [ ] All ACs met; engine/server/client suites green (pass delta recorded).
- [ ] Sentinel + `PRE_WP080` hashes byte-identical (no re-pin).
- [ ] `finalScore`/grade unchanged for every fixture (display-only proven).
- [ ] Copy-lint green (no forbidden words in surfaced strings).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] D-24532 flipped Active; WORK_INDEX row `[x]`; EC_INDEX `Done`; roadmap
      `📝`→`✅`; `roadmap:counts:check` 0; STATUS close-out.
- [ ] Two-commit topology (EC-746 impl + SPEC close).
- [ ] Live-verify performed or explicitly operator-pending.

## Reserved Decision (lands at execution)

**D-24532** — Synergy Realization Phase 2: a display-only per-match **Realized
Value %** that value-weights the WP-708/D-24531 conditional-clause synergy signal.
Per-clause value = the attack/recruit magnitude the clause offers at the current
board state (flat `magnitude`; count-scaled `magnitude × floor(resolveCountSource /
perEach)`), summed over the hook's legacy value keywords at the
`evaluateAllConditions` chokepoint; `potentialValue` accrues for every countable
conditional clause played and `realizedValue` only when the condition held, both on
the hash-excluded `G.diagnostics.conditionalClauses` record. Realized Value % =
`round(100 × realizedValue / potentialValue)`, derived at render, surfaced on
`PlayerScoringContribution` → `CoachPlayerLine` → `EndgameSummary.vue`. Locks:
(1) display-only — never `finalScore`/`rawScore`/PAR/grade (NG-1); (2) hash-neutral
(rides `G.diagnostics`, excluded from both oracles → NO re-pin); (3) computed at the
chokepoint, NOT read back from the capped WP-706 trace channel (traces are lossy,
count-scaled-only, and absent for whiffs), while agreeing with WP-706 `computedValue`
for assembled count-scaled clauses (cross-checked); (4) two-vocabulary invariant
(no whiff/failed/error/missed/wasted on the surface); (5) hero path only; value
currency = attack + recruit; NO new `EffectTraceStatus` member. The sequence teacher
(play-order counterfactual) and co-op cross-seat cooperation remain deferred later
phases. See DECISIONS.md and `DESIGN-SYNERGY-REALIZATION.md` §3.3.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS (all required WP sections, in order; ≥ 2 explicit
  Out-of-Scope exclusions).
- **§2 Non-Negotiable Constraints** — PASS (explicit block; vocabulary +
  off-ranking + hash-neutral + gameplay-path-untouched + standing engine rules).
- **§3 Assumes** — PASS (each assumption cites its locking WP/D with exact
  exports/paths; Phase 1 + WP-706 + the count-source family named).
- **§4 Context** — PASS (`## Context (Read First)` covers the chokepoint-not-trace
  decision, the exact value model, the ceiling derivation, determinism).
- **§5 Files Expected to Change** — PASS (closed allowlist; governance called out as
  land-at-execution).
- **§6 Naming Consistency** — PASS (`conditionalClauses`, `recordConditionalClause`,
  `heroClauseValue`, `resolveCountSource`, `buildCountScaledResolution`,
  `PlayerScoringContribution`, `deriveScoringInputs`, `CoachPlayerLine`,
  `EndgameSummary` — verified on `origin/main`).
- **§7 Dependency Discipline** — PASS (all hard-deps landed: WP-708, WP-706,
  WP-680 family, WP-616, WP-622, D-24034/D-24271).
- **§8 Architectural Boundaries** — PASS (engine derives/records; server carries;
  client renders; no `boardgame.io` in the new helpers; no client re-computation;
  no `.reduce()`; hash-excluded channel; gameplay grant path untouched).
- **§9 Windows Compatibility** — N/A (no shell/path work).
- **§10 Env Var Hygiene** — N/A.
- **§11 Authentication Clarity** — N/A.
- **§12 Test Quality** — PASS (`node:test`, `.test.ts`; non-vacuous control-stub;
  cross-check vs WP-706 `computedValue`; copy-lint; hash byte-identity).
- **§13 Commands & Verification** — PASS (runnable steps incl. hash sweep +
  live-verify).
- **§14 Acceptance Criteria Quality** — PASS (9 testable, non-vacuous ACs).
- **§15 Definition of Done** — PASS (binary gates incl. hash identity + two-commit
  topology).
- **§16 Code Style** — PASS (human-style, JSDoc, `// why:` on the hash-excluded
  fields + the value model + count-scaled normalization; `for...of`, no `.reduce()`).
- **§17 Vision Alignment** — PASS (§1/§3, NG-1, determinism §8/§22).
- **§18 Prose-vs-Grep Discipline** — PASS (no verification-grep token reused as
  prose gate).
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline `origin/main` @ `b45362aa`;
  drafted in a fresh worktree off `origin/main`).
- **§20 Funding Surface Gate** — N/A (no pricing/checkout/account surface).
- **§21 API Catalog Update** — N/A (no `apps/server` endpoint or `Library-only`
  export change; the coach summary is internal, assembled server-side).

**Pre-flight verdict:** (recorded at Gate Verdicts below.)
**Copilot check verdict:** (recorded at Gate Verdicts below.)

## Gate Verdicts (drafting session, independent subagents)

- **Pre-flight (01.4): READY TO EXECUTE** (independent subagent). No blocking (PS)
  findings. All dependency symbols verified against the actual worktree (WP-708
  chokepoint + recorder, WP-706 `buildCountScaledResolution`, `resolveCountSource`,
  the four value keywords, `PlayerScoringContribution`, `CoachPlayerLine`); the value
  model is implementable at the chokepoint; `resolveCountSource` reads zones
  independent of the boolean condition (valid on the whiff branch); both hash oracles
  rest-destructure `diagnostics` (no re-pin); the client file-set (EndgameSummary +
  scoreCalcDisplay + competitionApi) is the correct/complete surface. Four RS accuracy
  nits folded in: the `src/test/fixtures/hashGameState.ts:109` path, the
  `buildScoreBreakdown` deep-copy (~:415–429) silent-drop site, the
  `synergyCount.record.test.ts` deepEqual pin site, and the AC-3 single-count-scaled-
  effect bound.
- **Copilot (01.7): PASS** (after a RISK → HOLD, fixes folded in place — scope-neutral,
  no pre-flight re-run). One real gap: the recorder record-shape change breaks
  exact-match `deepEqual` chokepoint pins in `heroEffects.conditional.test.ts` (~:451/
  :471), a file that was not in the allowlist — added to WP §Files + EC §Files, with
  the EC deepEqual enumeration made exhaustive (both `synergyCount.record.test.ts` and
  `heroEffects.conditional.test.ts`, plus the `parScoring.logic.test.ts` input
  literals) and the `=== undefined` unconditional/hollow assertions flagged as
  do-not-edit. The intra-hook clause-value timing semantic (pre-execution board
  snapshot; AC-3 bounded to single-count-scaled-effect hooks) locked in the WP Context
  + EC. No determinism/architecture damage; off-ranking and non-vacuity confirmed
  falsifiable.
