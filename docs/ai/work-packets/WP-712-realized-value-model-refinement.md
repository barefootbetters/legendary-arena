# WP-712 — Synergy Realization: Realized Value % value-model refinement (Game Engine)

**Status:** Draft 2026-09-20 (EC-749; **D-24535** reserved)
**Layer:** Game Engine only (the value recorded at the `evaluateAllConditions`
chokepoint on the hash-excluded `G.diagnostics`). **Lane:** Standard two-session
(refines a shipped display-metric's semantics — not purely additive).
**Baseline:** `origin/main` @ `67299144` · **User-Visible Surface:**
play.legendary-arena.com (the endgame report card / coach Realized Value %,
already rendered from WP-709).
**Design of record:** `docs/ai/DESIGN-SYNERGY-REALIZATION.md` §2.3 / §3.3. Refines
WP-709 / D-24532 (the display-only Realized Value %).

## Goal

WP-709's Realized Value % is meant to weight synergy by the attack/recruit value a
player realized versus what they set up. A real 2p Red Skull match exposed that,
as shipped, it **misses most of the actual synergy**: the marquee count-scaled
cards ("+1 attack/recruit for each color of Hero you have" — Avengers Assemble,
Perfect Teamwork) carry no boolean gate, so they are excluded from the tally
entirely, and a count-scaled class-gated clause that **whiffed** reads as 0
potential (its count was 0), so a left-on-the-table synergy is invisible. This WP
refines the value model so Realized Value % reflects **all** attack/recruit synergy
value: pure count-scaled clauses now count (realized = potential = what they
granted), and a count-scaled class-gated whiff registers a nonzero **potential
floor**. It is **engine-only** — the display fields already flow to the coach and
client from WP-709. Nothing changes the score, grade, Synergy Rate, or any hash.

## Assumes

- **WP-709 / D-24532 shipped (on `main`).** The chokepoint in
  `packages/game-engine/src/hero/heroEffects.execute.ts` records, per boolean-gated
  conditional clause, `recordConditionalClause(G, playerID, { assembled, clauseValue })`
  (`diagnostics/synergyCount.record.ts`), accruing to
  `G.diagnostics.conditionalClauses[playerID] = { played, assembled, potentialValue,
  realizedValue }`. `heroClauseValue(G, playerID, cardId, hook)`
  (`hero/heroClauseValue.derive.ts`) sums the hook's attack/recruit value: flat
  `attack`/`recruit` → `magnitude`; count-scaled `attack-per-count`/`recruit-per-count`
  → `magnitude × floor(resolveCountSource / perEach)` at the current board. The value
  sums surface display-only via `PlayerScoringContribution.conditionalClauses{Potential,
  Realized}Value` → `CoachPlayerLine` → `EndgameSummary.vue` (+ the client mirrors) —
  **already plumbed, unchanged by this WP.**
- **The two gaps are real (verified against a live match + the card markers).**
  - Pure count-scaled cards carry **no** `[hc:X]:` / `[team:X]:` condition prefix —
    Avengers Assemble `"You get +1[icon:recruit] for each color of Hero you have.
    [keyword:recruit-per-count:distinct-hero-classes-played-this-turn:1]"`, Perfect
    Teamwork the `attack-per-count` sibling. Their hooks have `conditions.length === 0`,
    so `isCountableConditionalClause` (`= conditions.length > 0 && hookHasExecutableEffect`)
    is false and `recordConditionalClause` is never called → their (large) realized
    value is excluded from the tally.
  - A count-scaled **boolean-gated** clause whose gate class **equals its count source**
    (Arc Reactor `[hc:tech]` + tech-count, Marvelous Strength `[hc:strength]` +
    strength-count, …) that whiffs has count 0, so today's whiff-branch
    `clauseValue = heroClauseValue(...)` = `magnitude × floor(0 / perEach)` = **0** →
    `potentialValue += 0`, i.e. that whiff is invisible to the ratio. **Note (corrected
    at pre-flight):** the count source is *independent* of the boolean gate, so a clause
    whose gate and count source differ (e.g. `[hc:tech]` gate + `cost-four-plus` count)
    can whiff with count > 0 and **already** accrues its full current-board value today —
    the shipped test `heroEffects.execute.test.ts:6256` pins `potentialValue: 2` for such
    a case. So the whiff is only invisible when the count is 0; the fix must be a **floor**,
    never a replacement (see the implementation).
- **`G.diagnostics` is hash-excluded** (`computeStateHash` `replay/replay.hash.ts:78`,
  the `finalStateHash` oracle `src/test/fixtures/hashGameState.ts:109`). Changing what
  value is recorded there is not hash-affecting — `PRE_WP080_HASH` + sentinel
  `finalStateHash` stay byte-identical, **no re-pin**.
- **`resolveCountSource` is a pure read** (`hero/heroCountSource.resolve.ts`);
  `buildCountScaledResolution` (`heroEffects.execute.ts`) already computes the same
  `computedValue` at `runHookEffects` for these effects — the chokepoint re-read is
  deterministic (the grant only mutates `turnEconomy`, never `inPlay`).

## Context (Read First)

**The refined value model (uniform across clause types).** For each hero hook the
chokepoint processes, its attack/recruit value is recorded as:

| Clause type | realized value | potential value |
|---|---|---|
| Flat boolean-gated (`[hc:X]: +N attack`, e.g. Repulsor Rays) | `magnitude` if assembled, else 0 | `magnitude` (always) — **unchanged** |
| Count-scaled boolean-gated (Arc Reactor / Legendary Commander …) | `computedValue` if assembled, else 0 | if assembled `computedValue`; else **`max(computedValue, potentialFloor)`** — a count-0 whiff rises to the floor, a count>0 whiff keeps its true current-board value (no regression) |
| Pure count-scaled, no gate (Avengers Assemble / Perfect Teamwork) | `computedValue` (**now recorded**) | `computedValue` (= realized; no gate to miss) |

Where:
- `heroClauseRealizedValue(hook)` (= the existing `heroClauseValue`) = Σ flat
  `magnitude` + Σ count-scaled `magnitude × floor(resolveCountSource / perEach)`.
- **`heroClausePotentialFloor(hook)` (new)** = Σ flat `magnitude` + Σ count-scaled
  `magnitude` (the per-each unit — the **minimum meaningful payoff**, achieved at count
  = `perEach`). This is the "you left the synergy on the table" value a whiffed
  count-scaled clause registers. For a flat clause the floor equals `magnitude`, so
  flat whiffs are unchanged.

**Why a floor of `magnitude` (not the counterfactual best count).** When the count is
already > 0 (gate class ≠ count source), the whiff's point-in-time value is a settled
fact (`computedValue`) and is kept unchanged. When the count is 0, the honest
point-in-time value is 0 and the true "could have offered" is undefined without a reorder
counterfactual (that is the deferred sequence teacher, WP-710) — so we record the
**minimum non-zero payoff**, one enabling unit = `magnitude`, as a conservative floor.
`Math.max` gives both: raise a 0 to the floor, never lower a real value. It makes a
count-0 whiff visible as a loss without inventing a counterfactual count.

**Synergy Rate (WP-708) is unchanged.** `played` / `assembled` stay **boolean-gated
only** (a pure count-scaled clause has no assembly decision, so it does not enter the
rate). Only the **value sums** expand to cover pure count-scaled clauses. The two
metrics therefore measure different populations — Synergy Rate = "did you meet the
condition"; Realized Value % = "how much attack/recruit synergy value you realized" —
documented so the divergence is intentional, not a bug.

**Implementation (minimal, engine-only).** The recorder gains an optional
`countsTowardRate` flag (default `true`, so existing WP-709 calls are unchanged):
- **Whiff branch** (boolean condition failed, `isCountableConditionalClause`): pass
  `clauseValue: Math.max(heroClauseValue(G, playerID, cardId, hook), heroClausePotentialFloor(hook))`
  — the floor is a **floor**, not a replacement. A count-0 whiff (0) rises to the
  per-each `magnitude`; a count>0 whiff (gate ≠ count source) keeps its true
  current-board value, so the shipped `heroEffects.execute.test.ts:6256` pin
  (`potentialValue: 2`) stays green **with no edit**. `realizedValue += 0`. Flat clauses:
  `heroClauseValue` and the floor are both `magnitude`, so identical to today.
- **Assembled branch** (boolean conditions passed): unchanged —
  `clauseValue: heroClauseValue(...)`, both sums += it.
- **New no-condition count-scaled branch** (a hook with `conditions.length === 0` AND a
  count-scaled value effect, non-hollow): record
  `{ countsTowardRate: false, assembled: true, clauseValue: heroClauseValue(...) }` →
  `potentialValue += computedValue`, `realizedValue += computedValue`, no `played`/
  `assembled` bump. Recorded at the chokepoint (before `runHookEffects`, same board →
  same `computedValue` the grant produces).

**Determinism.** No `ctx.random.*`, wall-clock, or I/O; pure reads + increments on the
hash-excluded `G.diagnostics`. No re-pin; no fixture; no card-data.

## Scope (In)

- `packages/game-engine/src/hero/heroClauseValue.derive.ts` — add pure
  `heroClausePotentialFloor(hook): number` (Σ flat `magnitude` + Σ count-scaled
  `magnitude`, the per-each floor). Keep `heroClauseValue` (the realized value) as-is;
  add a `// why:` distinguishing realized vs potential-floor. No `boardgame.io`.
- `packages/game-engine/src/diagnostics/synergyCount.record.ts` — add an optional
  `countsTowardRate: boolean` (default `true`) to `recordConditionalClause`'s outcome:
  when `false`, accrue the value sums but do **not** bump `played`/`assembled`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — at the chokepoint: (1) the
  whiff branch passes `heroClausePotentialFloor(hook)` as the clause value; (2) add a
  no-condition count-scaled recording branch (`countsTowardRate: false`), gated on the
  hook having a count-scaled value effect and being non-hollow. No firing change, no new
  fire site.
- Tests (engine): `heroClausePotentialFloor` (flat floor = magnitude; count-scaled
  floor = magnitude regardless of `perEach`/count); recorder `countsTowardRate: false`
  accrues value without played/assembled; chokepoint — a count-scaled boolean whiff now
  accrues `potentialValue = floor` (was 0); a pure count-scaled clause is now recorded
  (realized = potential = computedValue) with played/assembled **unchanged**; a flat
  boolean clause is unchanged; Synergy Rate (played/assembled) byte-unchanged for a
  fixture; sentinel `finalStateHash` + `PRE_WP080` byte-identical.

## Out of Scope

- **Any counterfactual "best count" for a whiffed count-scaled clause** — the reorder
  counterfactual is the deferred sequence teacher (WP-710). v1's whiff potential is the
  fixed `magnitude` floor, not a hypothetical count.
- **Synergy Rate / `played` / `assembled` changes** — the WP-708 rate stays boolean-gated
  only; only the value sums expand.
- **Server / client changes** — the display fields
  (`conditionalClauses{Realized,Potential}Value`) already flow from WP-709; this WP only
  changes what the engine records. No `parScoring`/coach/arena-client edit.
- **Villain / scheme conditional effects** (hero path only); the
  `count-scaled-choose` / `reveal-herodeck-attack` families (same sites WP-706/709
  excluded); any change to `finalScore` / PAR / grade / hash / fixture / card-data.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/hero/heroClauseValue.derive.ts` | `+ heroClausePotentialFloor(hook)` (per-each floor); keep `heroClauseValue` |
| `packages/game-engine/src/diagnostics/synergyCount.record.ts` | `+ countsTowardRate?` (default true); value-only accrual when false |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | whiff branch → potential floor; new no-condition count-scaled value branch |
| `packages/game-engine/src/hero/heroClauseValue.derive.test.ts` | `heroClausePotentialFloor` cases (flat + count-scaled floor) |
| `packages/game-engine/src/diagnostics/synergyCount.record.test.ts` | `countsTowardRate: false` value-only accrual |
| `packages/game-engine/src/hero/heroEffects.execute.test.ts` | NEW: count-0 whiff rises to the floor; pure count-scaled counted (rate unchanged); flat unchanged. REGRESSION (no edit): the existing `:6256` count>0-whiff pin (`potentialValue: 2`) stays green under `Math.max` |

Governance (land at execution): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24535 Active), `NUMBER-LEDGER.md` (mark landed), `STATUS.md`.

## Contract

- **`heroClausePotentialFloor(hook): number`** — Σ flat `magnitude` + Σ count-scaled
  `magnitude` (per-each unit); pure; 0 for a hook with no attack/recruit value.
- **`recordConditionalClause(G, playerID, { assembled, clauseValue, countsTowardRate? })`**
  — `countsTowardRate` defaults `true`; when `false`, `potentialValue`/`realizedValue`
  accrue but `played`/`assembled` do not. Never throws.
- **Chokepoint** — whiff: `clauseValue = Math.max(heroClauseValue(...), heroClausePotentialFloor(hook))`
  (floor, not replacement); assembled (boolean): `clauseValue = heroClauseValue(...)`;
  no-condition count-scaled: `{ countsTowardRate: false, assembled: true, clauseValue: heroClauseValue(...) }`.
- **Count-scaled-effect detection** — the no-condition branch fires when the hook has an
  `attack-per-count` / `recruit-per-count` effect; reuse the exact type check
  `buildCountScaledResolution` uses (`heroEffects.execute.ts`) — export a small predicate
  or mirror it inline with a `// why:` so the two can't drift.
- **`G.diagnostics.conditionalClauses` record shape unchanged**
  (`{ played, assembled, potentialValue, realizedValue }`); only the values written change.

## Non-Negotiable Constraints

- **Synergy Rate unchanged.** `played`/`assembled` stay boolean-gated only; a fixture's
  Synergy Rate is byte-identical before/after (asserted).
- **Off-ranking, display-only.** The value sums never enter `finalScore` / `rawScore` /
  PAR / grade (NG-1) — unchanged posture from WP-709.
- **Hash-neutral.** All on the hash-excluded `G.diagnostics`; no `finalStateHash` /
  `PRE_WP080` re-pin (asserted); no fixture / card-data.
- **Determinism.** No `ctx.random.*` / wall-clock / I/O; live and replay paths identical.
- **Layer boundary.** Engine-only; the recorder + value helpers import no `boardgame.io`;
  no `.reduce()` in the value/counter logic; hero path only.
- **Two vocabularies.** No player/coach copy change here (engine recording only); the
  WP-709 copy-lint still holds downstream.
- **Engine-wide standing rules.** `.claude/rules/code-style.md` +
  `docs/ai/REFERENCE/00.6-code-style.md`; ESM-only `node:` built-ins; `.test.ts` on
  `node:test`; Node v22+; `// why:` on the potential-floor rationale + the
  no-condition count-scaled branch.

## Vision Alignment

- **§1 Rules Authenticity / skill growth** — makes the skill signal reflect the synergy
  the game actually rewards (the count-scaled color/team engines), not a small slice.
- **§3 Player Trust & Fairness** — display-only, deterministic, seat-symmetric; a
  whiffed synergy now registers honestly instead of vanishing.
- **NG-1 no pay-to-win** — pure skill signal, never a score/ranking term.
- **Determinism (§8/§22)** — hash-excluded; no re-pin.

## Acceptance Criteria

1. `heroClausePotentialFloor` returns Σ flat `magnitude` + Σ count-scaled `magnitude`
   (per-each unit, independent of the actual count / `perEach`), and 0 for a
   no-attack/recruit hook. Asserted on real hooks.
2. A count-scaled **boolean-gated whiff with count 0** (gate class = count source) now
   accrues `potentialValue = potentialFloor` (> 0, was 0) with `realizedValue += 0` —
   asserted on `G.diagnostics` after a real whiffed play (non-vacuity). A whiff with
   **count > 0** (gate class ≠ count source) is **unchanged** — the shipped
   `heroEffects.execute.test.ts:6256` pin (`potentialValue: 2`) stays green with no edit
   (`Math.max` floor never lowers a real value; regression pin).
3. A **pure count-scaled** clause (no condition, e.g. Avengers Assemble) is now recorded
   with `realizedValue = potentialValue = computedValue`, and `played`/`assembled` are
   **not** bumped for it (Synergy Rate population unchanged). Asserted on a real play.
4. A **flat** boolean clause (assembled or whiffed) records identically to WP-709
   (regression pin).
5. Synergy Rate (`played`/`assembled`) is **byte-identical** before/after for a fixture
   (only the value sums changed).
6. `finalScore` / `rawScore` / grade unchanged for every fixture; sentinel
   `finalStateHash` + `PRE_WP080_HASH` byte-identical (no re-pin), no fixture churn.
7. Control / non-vacuity: stubbing `heroClausePotentialFloor` → 0 fails AC-2; making the
   no-condition branch a no-op fails AC-3; restore.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` + `test` → green; record delta.
2. Control-stub per AC-7 → FAIL (non-vacuous); restore.
3. Sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged; `sim:runtime-observed:check`
   current (diagnostics hash-excluded).
4. `pnpm -r build` 0 (server + arena-client compile unchanged — no signature change to
   the display fields). `git diff --name-only` = the allowlist + governance.
5. **Live-verify (operator-pending, post-deploy, D-24026):** replay/play a Cap-color-count
   match; the endgame Realized Value % now reflects the Avengers Assemble / Perfect
   Teamwork realized value and a count-scaled whiff registers a nonzero potential (the
   number moves versus the pre-refinement value).

## Definition of Done

- [ ] All ACs met; engine suite green (pass delta recorded).
- [ ] Sentinel + `PRE_WP080` hashes byte-identical; no fixture / card-data churn.
- [ ] Synergy Rate byte-identical; `finalScore`/grade unchanged.
- [ ] `pnpm -r build` 0 (server + client unchanged); `git diff --name-only` = allowlist.
- [ ] `sim:runtime-observed:check` current.
- [ ] D-24535 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; roadmap `📝`→`✅`;
      `roadmap:counts:check` 0; NUMBER-LEDGER landed; STATUS close-out.
- [ ] Two-commit topology (EC-749 impl + SPEC close).
- [ ] Live-verify performed or explicitly operator-pending.

## Reserved Decision (lands at execution)

**D-24535** — Synergy Realization: Realized Value % value-model refinement. Refines
D-24532 so the display-only Realized Value % reflects all attack/recruit synergy value.
Locks: (1) **pure count-scaled** clauses (no boolean gate) are recorded with
`realized = potential = computedValue` (previously excluded — no condition, so
`recordConditionalClause` was never called; `countsTowardRate: false`, so a hook's flat
magnitude on the *same* no-condition hook is also folded via `heroClauseValue` — moot for
the pure count-scaled Avengers Assemble / Perfect Teamwork); (2) a **count-scaled
boolean-gated whiff** accrues `potentialValue = max(computedValue, per-each magnitude)` —
a **floor**, not a replacement: a count-0 whiff (gate class = count source) rises from 0
to the per-each `magnitude`, while a count>0 whiff (gate ≠ count source) keeps its true
current-board value (no regression; the shipped `:6256` pin stays green); (3) **flat**
boolean clauses unchanged; (4) **Synergy Rate**
(`played`/`assembled`, WP-708) unchanged — boolean-gated only, via a `countsTowardRate`
flag; only the value sums expand; (5) still display-only / off-ranking (NG-1),
hash-neutral on `G.diagnostics` (**no re-pin**), engine-only (WP-709 already plumbs the
display fields to coach + client), hero path only; the whiff "floor" is the point-in-time
minimum, not a reorder counterfactual (that is the deferred sequence teacher WP-710).
Motivated by a real 2p Red Skull match where the marquee Cap color-count synergies and
count-scaled whiffs were invisible to the metric. Entry lands at WP-712 execution. See
DECISIONS.md and `DESIGN-SYNERGY-REALIZATION.md` §3.3.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS (all sections; ≥ 2 Out-of-Scope exclusions).
- **§2 Non-Negotiable Constraints** — PASS (Synergy-Rate-unchanged + off-ranking +
  hash-neutral + determinism + engine-only + standing rules).
- **§3 Assumes** — PASS (cites WP-709/D-24532 exact symbols; the two gaps verified
  against markers + the live match).
- **§4 Context** — PASS (the refined value model table, the floor rationale, the
  Synergy-Rate-unchanged split, the minimal implementation).
- **§5 Files** — PASS (closed engine-only allowlist; governance called out).
- **§6 Naming Consistency** — PASS (`heroClauseValue`, `heroClausePotentialFloor`,
  `recordConditionalClause`, `conditionalClauses`, `resolveCountSource`,
  `isCountableConditionalClause` — verified on `origin/main`).
- **§7 Dependency Discipline** — PASS (hard-dep WP-709/D-24532 landed; WP-706/708 signals).
- **§8 Architectural Boundaries** — PASS (engine-only; hash-excluded channel; no
  `boardgame.io` in helpers; no `.reduce()`; no server/client change).
- **§9 Windows** — N/A. **§10 Env** — N/A. **§11 Auth** — N/A.
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-stubs; regression pin on
  flat + Synergy Rate; hash byte-identity).
- **§13 Commands & Verification** — PASS (runnable steps + live-verify).
- **§14 Acceptance Criteria Quality** — PASS (7 testable, non-vacuous ACs).
- **§15 Definition of Done** — PASS (binary gates incl. hash identity + Synergy-Rate
  invariance + two-commit).
- **§16 Code Style** — PASS (human-style, JSDoc, `// why:` on the floor + no-condition
  branch; no `.reduce()`).
- **§17 Vision Alignment** — PASS (§1/§3, NG-1, determinism §8/§22).
- **§18 Prose-vs-Grep Discipline** — PASS.
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline `origin/main` @ `67299144`).
- **§20 Funding Surface Gate** — N/A (no pricing/checkout/account surface).
- **§21 API Catalog Update** — N/A (no `apps/server` endpoint or `Library-only` export
  change; engine-only, display fields already plumbed).

**Pre-flight verdict:** READY TO EXECUTE (see Gate Verdicts).
**Copilot check verdict:** (see Gate Verdicts.)

## Gate Verdicts (drafting session, independent subagents)

- **Pre-flight (01.4): READY TO EXECUTE** (independent subagent, two passes). Pass 1 →
  NOT READY: PS-1/PS-2 — the whiff-branch "replace `heroClauseValue` with the floor"
  was a fidelity **regression**, because the count source is independent of the boolean
  gate, so a whiff whose gate class ≠ count source already accrues its true current-board
  value (the shipped `heroEffects.execute.test.ts:6256` pins `potentialValue: 2`); a
  replace would lower it to 1 and break that test. Fixed as a **floor**:
  `clauseValue = Math.max(heroClauseValue(...), heroClausePotentialFloor(hook))` — count-0
  whiffs rise to the per-each magnitude, count>0 whiffs (and the shipped pin) unchanged.
  3 RS nits folded (no-condition-branch flat-fold scope, reuse `buildCountScaledResolution`'s
  count-scaled detection, D-24535 accuracy). Pass 2 → **READY TO EXECUTE**: floor
  semantics verified against source; engine-only allowlist, hash-neutral, Synergy Rate
  unchanged (`countsTowardRate`), no double-count (mutually-exclusive branches), AC-7
  control-stubs non-vacuous.
- **Copilot (01.7): PASS / CONFIRM** (independent subagent). Every load-bearing claim
  verified against source: both hash oracles strip `G.diagnostics` (no re-pin); the
  `Math.max` floor preserves the shipped `:6256` pin and raises count-0 whiffs; the two
  recording branches are disjoint by `conditions.length` (no double-count); AC-7
  control-stubs genuinely falsify; engine-only layer boundary holds. One keep-as-is
  naming note (`countsTowardRate` matches the sibling `assembled`/`fired` convention) —
  not verdict-affecting.
