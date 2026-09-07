# WP-656 — Diamond Form Over-Fire: Gate the +3 Recruit on a Villain/Mastermind Defeat (Game Engine + card-data)

**Status:** Draft — pending execution
**Primary Layer:** Game Engine (+ card-data-derived feeds)
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

`core/emma-frost/diamond-form` prints *"Whenever you defeat a Villain or
Mastermind this turn, you get +3[icon:recruit]."* Today it grants **+3 Recruit
unconditionally on play** — the setup parser reads the `[icon:recruit]`
magnitude but not the "Whenever you defeat …" trigger prose, so it emits a flat
`onPlay recruit:3`. This WP corrects the fidelity defect: the +3 Recruit fires
**once per Villain/Mastermind you defeat during the turn** (per the D-24467
semantics), and **not at all** if you defeat neither — modelled through the
existing deferred-conditional-grant ("wait-and-see") mechanism, gated on a new
"defeated a Villain or Mastermind this turn" condition.

## User-Visible Impact

A player who recruits Diamond Form no longer receives a free +3 Recruit on play.
Instead, each qualifying Villain/Mastermind defeat that same turn grants +3
Recruit — the printed behaviour. A player who defeats nothing that turn gains
nothing from the card. This is a **nerf to a currently over-powered card** and a
fidelity fix; it changes the recruit economy of any turn that plays Diamond Form,
so it is player-observable on the deployed client.

## Assumes

- **Baseline:** `origin/main` @ `8b23f005` (drafted 2026-09-06). Re-baseline at
  execution.
- **The deferred-conditional-grant "wait-and-see" mechanism exists** —
  `packages/game-engine/src/hero/deferredConditionalGrants.ts` exports
  `recordDeferredConditionalGrant`, `resolveDeferredConditionalGrants`,
  `clearDeferredConditionalGrants`, `isWaitAndSeeCondition`
  (`WAIT_AND_SEE_CONDITION_TYPES` currently `['recruitMadeThisTurnAtLeast',
  'distinctHeroClassesAtLeast']`). ✅ on `main`. A failed wait-and-see condition
  at play time is recorded (`heroEffects.execute.ts:514`); the container is
  lazily materialized (`D-24377 §6`) so a game that never defers carries no new
  `G` field.
- **Deferred grants are already re-checked after EVERY play-phase move.**
  `resolveDeferredHeroGrants` runs from the play-phase `turn.onMove` hook
  (`game.ts:639`, calling `heroEffects.execute.ts:2758`) — it fires after
  `fightVillain`, `fightMastermind`, and every other move. **So this WP adds NO
  new resolve call**; a recorded Diamond Form grant is re-evaluated post-fight
  today. The only genuinely-new pieces are (a) the condition and (b) the per-turn
  defeat signal it reads.
- **The existing wait-and-see path is ONE-SHOT and NUMERIC-THRESHOLD-shaped.** A
  recorded grant is removed as it fires (`deferredConditionalGrants.ts:134`;
  header: "grants EXACTLY ONCE"), and the doctrine comment (`:1-32`) scopes the
  array to numeric-threshold conditions whose one-shot latch is correct *because a
  crossed threshold stays crossed*. A boolean "defeated this turn" is a different
  shape — this is the real reason the printed "+3 **per** defeat" (`+6` for two)
  does not drop into the existing path unchanged. See D-24467 / the scaffold.
- **`HeroCondition` is a bare struct** `{ type: string; value: string }`
  (`rules/heroAbility.types.ts:94-97`), NOT a discriminated union.
  `evaluateCondition` and `describeFailedCondition` (`heroConditions.evaluate.ts`)
  `switch` on `condition.type` with a `default` that returns `false` — an unlisted
  `type` silently never fires. So there is **no union member to add**; the
  contract is the evaluator-case ↔ `WAIT_AND_SEE_CONDITION_TYPES` lockstep. ✅.
- **`fightVillain.ts` and `fightMastermind.ts` are the defeat sites.** They
  already set `G.hasActedThisTurn = true` unconditionally on success
  (`fightVillain.ts:199`, `fightMastermind.ts:143`), reset at the turn boundary
  (`game.ts:698`). The new per-turn defeat signal is set the same way — but see
  the determinism note (it must be gated to stay oracle-safe).
- **No "defeated a Villain/Mastermind this turn" condition or defeat signal
  exists yet** — this WP adds both.

## Context (Read First)

- `packages/game-engine/src/hero/deferredConditionalGrants.ts` —
  **AUTHORITATIVE for** the wait-and-see contract, its one-shot semantics
  (`:134`), and the numeric-threshold doctrine comment (`:1-32`).
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` —
  **AUTHORITATIVE for** condition evaluation (`evaluateCondition` +
  `describeFailedCondition`, both `switch(condition.type)` with a `default`; the
  existing `playedThisTurn` / `recruitMadeThisTurnAtLeast` cases are the pattern).
- `packages/game-engine/src/rules/heroAbility.types.ts` — **AUTHORITATIVE for**
  the `HeroCondition` bare-struct shape (no union to extend).
- `packages/game-engine/src/game.ts` — **AUTHORITATIVE for** the play-phase
  `turn.onMove` deferred-grant resolution (`:639`) and the turn-boundary reset
  (`:698`).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **AUTHORITATIVE for**
  where a failed wait-and-see condition is recorded (`:514`) and where deferred
  grants are resolved (`resolveDeferredHeroGrants`, `:2758`).
- `packages/game-engine/src/moves/fightVillain.ts`,
  `packages/game-engine/src/moves/fightMastermind.ts` — **AUTHORITATIVE for** the
  defeat sites (set the per-turn defeat signal; note the `hasActedThisTurn`
  precedent) and — RS-1 — the Mastermind "defeat" semantics
  (`fightMastermind.ts:244-247` defeats a **tactic**; the whole Mastermind is
  vanquished only when all tactics fall via `MASTERMIND_DEFEATED`).
- The card-data pipeline: `data/cards/core.json` (`diamond-form` @ ~L508, +
  `co2e.json`, `nmut.json`) and the hero-ability / effect-marker pass under
  `scripts/convert-cards/` that produces the mis-parse. `docs/03-DATA-PIPELINE.md`
  §1 documents the stage order.
- `docs/ai/DECISIONS.md` — scan **D-24377** (deferred-grant lazy materialization +
  hash posture) and the reserved **D-24467** below.

## Design Rationale

**Reuse the wait-and-see mechanism; add only a condition + a defeat signal.**
Diamond Form is a deferred grant whose gate cannot be satisfied at play time but
may become true later this turn. Resolution is **already** wired to every
play-phase move via `turn.onMove` (`game.ts:639`), so no new resolve call is
added — adding one would double-fire against `onMove` and would be the "parallel
trigger" the guardrails forbid. The new pieces are exactly: a `"defeated a
Villain/Mastermind this turn"` condition case in `heroConditions.evaluate.ts`,
its entry in `WAIT_AND_SEE_CONDITION_TYPES`, and a per-turn defeat signal in `G`
that the fight sites set and the condition reads.

**The repeatable-per-defeat semantics is a doctrine-shape change, and its
load-bearing correctness property is that a grant fires PER DEFEAT EVENT
(edge-triggered), never on a sticky-boolean read — scaffold-verified (D-24467).**
The existing wait-and-see path fires **once** (removes the grant on fire) and is
documented as numeric-threshold-only. **The trap that makes this subtle:**
`resolveDeferredHeroGrants` runs from `onMove` after **every** play-phase move,
not just fights. A *sticky boolean* condition (a `defeatedVillainOrMastermindThisTurn`
that stays true for the rest of the turn once the first defeat lands) combined
with a *surviving* repeatable grant would fire **again on every subsequent
non-defeat move** — recruit, buy, play — turning a fix for an over-fire into a
**worse** over-fire. So "per defeat" must be **consumed/counted (edge-triggered)**:
exactly one +3 per qualifying defeat *event*, never a boolean the resolver
re-reads each move. The executor MUST scaffold this against a turn that
**interleaves a non-defeat move between and after two defeats**
(`defeat → recruit → defeat → play`) and record the observed fire count; the
faithful result is **exactly +6** (not +9), with no further +3 on the trailing
move. Choose the model — a per-defeat consumed counter, or a distinct
edge-triggered representation — and update the `:1-32` doctrine comment. **Do not
assume the one-shot wait-and-see path fits, and do not ship a sticky boolean.**

**Determinism — the defeat signal must be gated, or a re-pin is planned
(D-24467).** A per-turn defeat flag set **unconditionally** at both fight sites
(the `hasActedThisTurn` pattern) would enter `G` for essentially every game
(defeating villains/tactics is routine) and **move both hash oracles**, including
the `core/dr-doom` sentinel if it fights anything. To stay oracle-safe, the
signal write must be **gated on a pending deferred grant already existing** (only
written while `G.deferredConditionalGrants` is non-empty — i.e., only while
**any** deferred grant is pending, Diamond Form's or another card's; oracle-safety
then holds iff the sentinel replays carry no deferred grant of any kind). If that
gating is not taken, the WP requires a
**recorded, explained re-pin** via `scripts/record-game-fixture.mjs` (never
hand-edited). The scaffold decides which; there is no "expectation of no re-pin"
until the gating approach is confirmed.

## Scope (In)

- **New wait-and-see condition** (e.g. `defeatedVillainOrMastermindThisTurn`) —
  an `evaluateCondition` case + a `describeFailedCondition` case in
  `heroConditions.evaluate.ts`, added to `WAIT_AND_SEE_CONDITION_TYPES` in
  `deferredConditionalGrants.ts` (in lockstep — an entry with no evaluator case
  silently never fires). No `heroAbility.types.ts` change (the type is a bare
  struct).
- **Per-turn defeat signal in `G`** — set at the `fightVillain` success site (a
  City Villain defeated, incl. the Skrull carve-out) and the `fightMastermind`
  success site (per the RS-1 Mastermind-defeat semantics), **gated to stay
  oracle-safe** (written only while a deferred grant is pending, per the
  determinism note) OR with a planned re-pin; reset at the turn boundary
  (`game.ts:698`) alongside the existing per-turn state / `clearDeferredConditionalGrants`.
- **The repeatable-fire model** (D-24467) — chosen after the mandatory scaffold so
  the grant fires per qualifying defeat, not once; whichever model is chosen, the
  doctrine comment in `deferredConditionalGrants.ts` is updated to match.
- **Card-data re-encode** — `data/cards/core.json` `diamond-form` ability from the
  flat `onPlay recruit:3` to the conditional/deferred `recruit:3` gated on the new
  condition. Apply to every set carrying the same printed text (`co2e.json`,
  `nmut.json` — confirm each at execution).
- **The card-data generation pass** (`scripts/convert-cards/…`) that emits the
  current mis-parse — corrected so a clean regen reproduces the committed
  `data/cards/*.json` (WP-633 reproducible-regen contract).
- **Regenerated card-data-derived artifacts** — the hero mechanic ledger, the
  effect-implementation index, and any coverage feed the change ripples, with
  their `:check` gates green (see the EC for the exact regen chain).
- **Tests** — engine: the grant fires on a City-villain defeat, on a Mastermind
  defeat (per RS-1), **repeatably** across two defeats in one turn, does **not**
  fire on play with no defeat, and is cleared at the turn boundary (does not carry
  into the next turn); a NEGATIVE assertion that the old flat-onPlay behaviour is
  gone; the lockstep drift assertion (below). Card data: the `diamond-form` entry
  encodes the conditional form.

## Out of Scope

- **The other hollow-prose hero cards** (`healing-factor`, `psychic-link`,
  `cyclops/*`, etc.) — the separate backlog WP.
- **Any change to the existing wait-and-see conditions**
  (`recruitMadeThisTurnAtLeast`, `distinctHeroClassesAtLeast`) beyond the doctrine
  comment that documents the new shape.
- **Adding a new `resolveDeferredConditionalGrants` call** — resolution is already
  wired via `onMove`; a second trigger is forbidden.
- **Any `UIState`/client projection of the pending Diamond Form grant** — the
  recruit total already projects; a "pending +3 on next defeat" indicator is a
  separate UX WP.
- **Villain-Escape or Bystander interactions** — only a *defeat* triggers the
  grant, per the printed text.

## Files Expected to Change

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — the
  evaluate case + failure-reason case.
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` — **modified** —
  add to `WAIT_AND_SEE_CONDITION_TYPES`; update the doctrine comment for the new
  shape.
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — set the
  per-turn defeat signal (gated per the determinism note).
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — same at the
  Mastermind defeat site (per RS-1 semantics).
- the per-turn-state type + turn-boundary reset site — **modified** — declare +
  clear the defeat signal. Presumptive allowlist (the scaffold confirms rather
  than discovers): `packages/game-engine/src/types.ts` (the `LegendaryGameState`
  `G`-field) + `packages/game-engine/src/game.ts` (the play-phase `onBegin`/reset
  where `hasActedThisTurn` and `clearDeferredConditionalGrants` are already
  cleared).
- `packages/game-engine/src/**/*.test.ts` — **modified/new** — the coverage above,
  incl. the runtime lockstep drift assertion.
- `data/cards/core.json` (+ `co2e.json`, `nmut.json` as applicable) — **modified**
  — the re-encoded `diamond-form` ability (regenerated, not hand-edited).
- `scripts/convert-cards/**` (the hero-ability / effect-marker pass) — **modified**
  — emit the conditional encoding.
- the regenerated **hero** card-data-derived artifacts — **modified** — Diamond
  Form is a HERO card, so the feeds are `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`
  (`pnpm ledger:heroes`, gated by `ledger:heroes:check` — NOT `ledger:villains`),
  `data/metadata/effect-implementation-index.json` (`pnpm effect-index`,
  `effect-index:check`), and the mechanics-metadata output (`pnpm mechanics:metadata`,
  `mechanics:metadata:check`), plus the WP-633 `cards:check` reproducible-regen gate.
  Run **every** `:check` even where a feed shows no diff, to prove none ships stale
  (`core/emma-frost` currently indexes as `mechanics:["draw"]` only, so whether the
  recruit re-encode ripples each feed is unknown until each `:check` runs).
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24467 Active),
  `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` —
  **modified** — governance close.

The precise per-turn-state file(s) and the exact regen-chain artifact set are
**resolved at execution** (the scaffold enumerates them) and locked into the EC
allowlist at that point; any file touched outside the finalised allowlist is a
FAIL. Note `rules/heroAbility.types.ts` is deliberately NOT in this list (no
union member to add).

## Non-Negotiable Constraints

> - Full file contents for every new/modified file; ESM only, Node v22+; human-
>   style code per `00.6-code-style.md`.
> - Determinism: `ctx.random.*` only, no `Math.random()`/wall-clock; moves never
>   throw; the condition handler never throws (safe-skip malformed data like the
>   existing cases, which fall through the `default → false`).
> - Do NOT add a new deferred-grant resolve call — `onMove` already resolves.
> - The defeat signal is gated to stay oracle-safe OR a recorded re-pin is planned
>   — never an unconditional flag that silently moves the oracles.
> - The card-data `diamond-form` encoding is **regenerated by the pipeline, never
>   hand-edited** (WP-633): a clean regen reproduces the committed bytes.
> - Drift lockstep (`WAIT_AND_SEE_CONDITION_TYPES` ↔ evaluator cases) is a
>   **runtime** assertion (engine tests are not typechecked — D-24372), with a
>   NEGATIVE assertion that fails for a synthetic listed-but-unhandled type.
> - Scaffold-first (D-24467): prototype the deferred-grant path on a two-defeat
>   turn and record the observed fire count BEFORE locking the model.
> - Locked contract values: see `## Contract`.

## Contract

- **Condition** — a new wait-and-see condition slug, added to BOTH
  `WAIT_AND_SEE_CONDITION_TYPES` AND an `evaluateCondition` case (+
  `describeFailedCondition`), never one without the other. The exact literal is
  chosen at execution and recorded in D-24467 + the EC Locked Values.
- **Grant** — `+3` Recruit to the playing player's turn economy, per qualifying
  defeat that turn (repeatable model per D-24467).
- **Trigger scope** — a defeat of a City Villain (`fightVillain` success) or the
  Mastermind (`fightMastermind` success, RS-1 semantics), during the turn Diamond
  Form is in play; reset at the turn boundary. Resolution rides the existing
  `onMove` hook — no new resolve call.
- **Mastermind-defeat semantics (RS-1, must-pin at execution)** — whether each
  Mastermind **tactic** fight counts as a "defeat" (repeatable +3 per tactic) or
  only vanquishing the whole Mastermind counts, resolved against the Universal
  Rules / the physical card and recorded in D-24467.

## Vision Alignment

- **Vision clauses touched:** §1, §2, §22.
- **Conflict assertion:** No conflict — this WP makes a printed hero ability fire
  faithfully where it over-fires; it removes an unearned resource, adds no RNG,
  preserves determinism.
- **Non-Goal proximity check:** N/A — none of NG-1..7 are crossed (a card getting
  *weaker* toward its printed text cannot introduce pay-to-win).
- **Determinism preservation:** No RNG added. The defeat signal is gated (or a
  recorded re-pin is planned) so both hash oracles are handled deliberately, never
  silently moved.

## Funding Surface Gate

§20 N/A — engine gameplay + card data; no funding affordance or copy.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint or server-reachable library function.

## Acceptance Criteria

- **AC-1** Playing Diamond Form with **no** Villain/Mastermind defeat that turn
  grants **0** Recruit (the over-fire is gone).
- **AC-2** Defeating one City Villain the same turn grants **+3** Recruit.
- **AC-3** A Mastermind defeat the same turn grants **+3** Recruit (per the RS-1
  semantics pinned in D-24467).
- **AC-4** "Per defeat" is **edge-triggered**: a turn that **interleaves
  non-defeat moves** — `defeat → recruit/buy → defeat → play` — grants **exactly
  +6** (not +9), and a trailing non-defeat move after the last defeat grants **no
  further +3**. (Back-to-back defeats with no intervening move are NOT sufficient
  coverage — they hide a sticky-boolean over-fire, the very failure class this WP
  removes.)
- **AC-5** The grant does **not** carry into the next turn (turn-boundary clear);
  a defeat next turn without Diamond Form re-played grants nothing.
- **AC-6** Every `WAIT_AND_SEE_CONDITION_TYPES` entry has an `evaluateCondition`
  case (and a `describeFailedCondition` case); a **runtime** drift assertion FAILS
  for a synthetic wait-and-see type that has no evaluator case (the `default →
  false` silent-failure mode). There is no `HeroCondition` union to pin.
- **AC-7** The condition handler never throws on malformed/absent state (safe-skip
  parity with the existing cases).
- **AC-8** `data/cards/{core,co2e,nmut}.json` `diamond-form` encodes the
  conditional grant, and a clean pipeline regen reproduces the committed bytes.
- **AC-9** Determinism is handled explicitly: **either** the defeat signal is
  gated (written only while **any** deferred grant is pending) and both hash
  oracles are byte-unchanged — confirmed against a fixture carrying an
  **unrelated** deferred grant (e.g. a `recruitMadeThisTurnAtLeast` card) **and** a
  defeat, not merely a no-deferred-grant game — **or** a recorded, explained re-pin
  (before/after values, single cause) via `record-game-fixture.mjs`;
  `sim:runtime-observed:check` stays current.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` exits 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; record the pass count.
3. `pnpm -r build` exits 0.
4. The card-data regen chain (per the EC) reproduces the committed
   `data/cards/*.json` and passes every `:check` gate.
5. `pnpm sim:runtime-observed:check` exits 0 with no regeneration.
6. **Control run:** revert the condition/signal wiring and confirm the AC-2..AC-4
   tests fail (the grant tests are non-vacuous).
7. **Scaffold record:** the observed two-defeat fire count and the chosen
   repeatable model are documented in the close-out and D-24467.
8. `git diff --name-only` on staged changes equals the finalised EC allowlist.

## Definition of Done

- [ ] AC-1..AC-9 satisfied.
- [ ] All Verification Steps green, incl. the Step-6 control run and the Step-7
      scaffold record.
- [ ] No files outside the finalised EC allowlist were modified.
- [ ] `docs/ai/DECISIONS.md` — **D-24467 Active**, recording: the wait-and-see
      reuse (no new resolve call — `onMove` already resolves); the new condition +
      its `WAIT_AND_SEE_CONDITION_TYPES` entry; the per-turn defeat signal and its
      oracle-safe gating (or the planned re-pin); the RS-1 Mastermind-defeat
      semantics; and the chosen repeatable-fire model with its scaffold evidence
      and any doctrine-comment update.
- [ ] `docs/ai/STATUS.md` close-out — the Diamond Form over-fire is fixed; the
      recruit-economy nerf and whether a hash re-pin was needed.
- [ ] **D-24026 live-on-surface:** on `play.legendary-arena.com`, a real match
      that plays Diamond Form and defeats a Villain/Mastermind shows the +3 Recruit
      firing on defeat (and no free +3 on play); recorded, or operator-pending.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap node `📝`→`✅` + counts
      regenerated.

## Reserved Decision (lands at execution)

**D-24467 — Diamond Form's "whenever you defeat a Villain or Mastermind this
turn" is a deferred conditional grant gated on a new wait-and-see defeat
condition.** Records: reuse of the D-24377 wait-and-see mechanism with NO new
resolve call (the play-phase `onMove` hook already re-checks deferred grants
post-fight); the new condition case + its `WAIT_AND_SEE_CONDITION_TYPES` entry
(no `HeroCondition` union exists — the lockstep is evaluator-case coverage); the
per-turn defeat signal and how it is kept oracle-safe (gated on a pending grant)
or the planned recorded re-pin; the **RS-1** Mastermind-defeat semantics
(per-tactic-fight vs vanquish-only, resolved against the Universal Rules); and —
the load-bearing part — the **repeatable-fire model** chosen after the mandatory
scaffold, since the existing one-shot numeric-threshold doctrine does not fit a
boolean "defeated this turn" (RS-2), with the observed two-defeat fire count as
evidence and any doctrine-comment update noted.

## Lint Gate Self-Review (00.3)

Completed inline at draft against all 21 sections (see the `SPEC:` draft commit
body for the recorded verdict). §1–§9 PASS; §12–§17 PASS (control run + scaffold
mandated; card-conservation N/A — a recruit grant, not a card move; DoD carries
the scope-boundary check; Vision block carries the §17.2 conflict assertion;
§15.1 declares `play.legendary-arena.com` with the D-24026 live gate). §10, §11,
§18, §20, §21 resolve N/A with named justifications.
