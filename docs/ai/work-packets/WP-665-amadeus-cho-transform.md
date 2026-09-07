# WP-665 — Amadeus Cho's Transform fires: model "drew two cards this turn" + gate Gamma-Draining Nanites (Game Engine + card-data)

**Status:** Draft — pending execution
**Primary Layer:** Game Engine (a new wait-and-see condition + a per-turn draw counter) + card-data
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

`wwhk/amadeus-cho/gamma-draining-nanites` prints *"Draw a card. Then, if you drew
two cards this turn, Transform this into Like Totally Smart Hulk."* WP-658 shipped
the `[keyword:Transform]` runtime but deliberately held Amadeus Cho back behind the
`SUPPORTED_TRANSFORM_BASES` She-Hulk-only allowlist, because its transform is gated
on a condition the engine does not model — *"drew two cards this turn"* — and firing
it unconditionally would be an unfaithful swap (the exact fidelity trap the allowlist
exists to prevent). Live-observed every play: *"Unhandled effect observed: … declared
a 'transform' mechanic at onPlay, but no executable handler was reached
(parse-unrecognized)."* This WP models the *"drew N cards this turn"* condition and
gates Gamma-Draining Nanites' transform on it, so the card transforms **only when**
the player has drawn ≥2 cards this turn.

## User-Visible Impact

Playing Gamma-Draining Nanites draws a card (unchanged), and — if the player has
drawn at least two cards this turn (its own draw plus one more from any draw effect)
— it now transforms into Like Totally Smart Hulk, pulled from the visible Transform
Deck (WP-664). If the threshold is not yet met, the ability *waits* (the wait-and-see
window, like She-Hulk's) and transforms later in the turn if a further draw reaches 2.
The "no executable handler (parse-unrecognized)" hollow for Gamma-Draining Nanites is
gone.

## Assumes

- **Baseline:** `origin/main` @ `0a8ec97f` (2026-09-07). Re-baseline at execution.
- **Gamma-Draining Nanites' ability is ALREADY two ability lines** in the generated
  data (`data/cards/wwhk.json`): `abilities[0]` = `"Draw a card. [keyword:draw:1]"`
  and `abilities[1]` = `"Then, if you drew two cards this turn, [keyword:Transform]
  this into Like Totally Smart Hulk."`. Each line becomes its own `HeroAbilityHook`
  (`heroAbility.setup.ts` — one hook per ability string). So the **draw is already an
  unconditional hook** and the **transform is a separate hook** — this WP gates only
  the transform hook, leaving the draw untouched. Confirm at execution. ✅ on `main`.
- **The transform partition + swap + runtime are shipped** (WP-657 / WP-658 / WP-662).
  `G.transformDeck` holds Like Totally Smart Hulk; `G.transformTargets` maps
  `wwhk/amadeus-cho/gamma-draining-nanites → …/like-totally-smart-hulk`;
  `heroEffectTransform` performs the swap. This WP does NOT touch the swap. ✅ on `main`.
- **The wait-and-see deferred-conditional-grant mechanism is shipped** (WP-568 /
  WP-656). A hook whose numeric-threshold condition fails at play is recorded and
  re-checked each `onMove`, firing when the threshold is reached later this turn
  (`deferredConditionalGrants.ts` `WAIT_AND_SEE_CONDITION_TYPES`; the resolution loop
  `resolveDeferredHeroGrants`). This WP adds `cardsDrawnThisTurnAtLeast` to that set
  and reuses the whole mechanism — the transform hook (transform-only) re-fires with
  no re-draw. ✅ on `main`.
- **The marker→condition pattern is shipped** (D-24354 recruit-threshold, D-24464
  Outwit family). A `[keyword:X]` marker on an ability line pushes a game-state
  `HeroCondition` onto that line's hook. This WP adds a `draw-threshold` marker
  mirroring `recruit-threshold` exactly. ✅ on `main`.
- **`TurnEconomy` already carries a per-turn draw count** (`woundsDrawn`), reset by
  `resetTurnEconomy` and carried by the economy rebuild helpers. This WP adds a sibling
  `cardsDrawn` the same way. ✅ on `main`.

## Context (Read First)

- `data/cards/wwhk.json` (`gamma-draining-nanites`) — the two-line ability (above).
- `packages/game-engine/src/economy/economy.types.ts` (`TurnEconomy`, `woundsDrawn`) +
  `economy/economy.logic.ts` (`resetTurnEconomy`; `addResources` / `spendAttack` /
  `spendRecruit` / `enableRecruitSpendableAsAttack` / `spendFightCost` — the FIVE rebuild
  sites that each copy `woundsDrawn`) — **AUTHORITATIVE for** the per-turn-counter pattern.
- `packages/game-engine/src/hero/heroEffects.execute.ts` (`heroEffectDraw` @ ~L927 —
  the `draw:N` handler, always the current player) — **AUTHORITATIVE for** the single
  increment site; and `heroEffectTransform` (the swap, untouched).
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` (`recruitMadeThisTurnAtLeast`
  @ L158 — reads `G.turnEconomy.recruit`; the describe case @ ~L517) — **AUTHORITATIVE
  for** the evaluator + describe pattern the new condition mirrors.
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` (`WAIT_AND_SEE_CONDITION_TYPES`
  @ L62 — the closed set; every entry MUST have an evaluator case; a runtime drift pin in
  `deferredConditionalGrants.test.ts` enforces the lockstep) — **AUTHORITATIVE for** the
  wait-and-see enrollment.
- `packages/game-engine/src/setup/heroAbility.setup.ts` (`SUPPORTED_TRANSFORM_BASES` @ L418;
  the `recruit-threshold` marker arm @ L938) — **AUTHORITATIVE for** the allowlist add + the
  new `draw-threshold` marker arm.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN` @ L72) +
  `scripts/convert-cards/inputs/hero-ability-markers.json` (`wwhk` §, gamma entry @ ~L796) —
  **AUTHORITATIVE for** the marker token grammar + authoring.
- `scripts/hero-mechanic-ledger.mjs` (`KNOWN_CONDITIONS`, `BY_HOOK_KEYWORDS`) — the ledger
  credit for the new condition + gamma's transform flip.
- `docs/ai/DECISIONS.md` — the reserved **D-24476** below; scan **D-24354** (recruit-threshold),
  **D-24377** (wait-and-see), **D-24469** (transform runtime), **D-24468** (side deck).

## Design Rationale

**Reuse the wait-and-see + marker→condition machinery unchanged; the only new runtime
state is a per-turn draw counter.** Gamma-Draining Nanites is the *"drew-2"* case the
WP-658 comment names. Because the card's ability is ALREADY two hooks (draw / transform),
the transform can be gated in isolation without touching the draw — no parser change, no
per-effect condition mechanism. The transform hook gets a `cardsDrawnThisTurnAtLeast:2`
condition (via a `draw-threshold:2` marker); at play the draw hook runs first
(incrementing the counter), then the transform hook evaluates the threshold — firing
immediately when ≥2 (a prior draw happened) or deferring via the existing whole-turn
window when only Gamma's own draw has landed, exactly like She-Hulk's recruit gate.

**Count effect-draws for the current player only, via `heroEffectDraw`.** The counter
lives in `G.turnEconomy` (the active player's per-turn accumulator, beside `woundsDrawn`)
and is incremented in `heroEffectDraw` — the `draw:N` keyword handler, which always runs
for the current player and is the path every "Draw a card" effect (Gamma's own draw,
Extrapolate, Window of Opportunity, …) takes. The **start-of-turn hand refill is NOT
counted**: it uses a different helper (`drawCardsIntoHand`), so the counter correctly
reflects only cards drawn from effects this turn — "drew two cards this turn" is never
trivially true from the mandatory refill.

**Always-present counter (mirror `woundsDrawn`), re-pin the oracles.** `cardsDrawn` is a
required `TurnEconomy` field (default 0), carried by the five economy rebuild helpers like
`woundsDrawn`. A new `G`-resident field shifts `computeStateHash`, so both engine hash
oracles (`PRE_WP080_HASH`, the sentinel `finalStateHash`) re-pin — the same sanctioned
no-behaviour-change new-field class as WP-657/658 (`transformDeck`/`transformTargets`).

## Scope (In)

- **`TurnEconomy.cardsDrawn: number`** (economy.types.ts) — per-turn effect-draw count,
  reset to 0 by `resetTurnEconomy`, carried by `addResources` / `spendAttack` /
  `spendRecruit` / `enableRecruitSpendableAsAttack` / `spendFightCost`.
- **Increment in `heroEffectDraw`** — `G.turnEconomy.cardsDrawn += drawnCount` after the
  realized draw (the current-player `draw:N` path).
- **New `cardsDrawnThisTurnAtLeast` condition** — evaluator case reading
  `G.turnEconomy.cardsDrawn` (mirrors `recruitMadeThisTurnAtLeast`) + a describe case for
  the waiting/blocked log line; added to `WAIT_AND_SEE_CONDITION_TYPES` + its runtime drift
  pin. `HeroCondition.type` is an open string, so no union change.
- **`draw-threshold` marker arm** (heroAbility.setup.ts) — pushes
  `{ type: 'cardsDrawnThisTurnAtLeast', value: <N> }` (mirrors `recruit-threshold`).
- **`VALID_TOKEN_PATTERN += ^\[keyword:draw-threshold:[1-9]\d*\]$`** (apply-hero-ability-markers.mjs).
- **`hero-ability-markers.json`** — gamma-draining-nanites **abilityIndex 1**
  `[keyword:draw-threshold:2]`.
- **`gamma-draining-nanites` → `SUPPORTED_TRANSFORM_BASES`.**
- **Regen** `data/cards/wwhk.json` (marker on abilities[1]) + the hero derived-artifact chain.
- **Ledger** — `cardsDrawnThisTurnAtLeast` in `KNOWN_CONDITIONS`; gamma-draining-nanites
  flips `unsupported → executable` (transform by-hook, the WP-658 `BY_HOOK_KEYWORDS`
  precedent) with a condition row; effect-index + mechanics-metadata in lockstep.
- **Hash re-pin** — `PRE_WP080_HASH` + the sentinel `finalStateHash` (new `TurnEconomy`
  field), documented no-behaviour-change.
- **Tests** — evaluator (reads the counter); the counter increments on effect draws but
  NOT the start-of-turn refill; wait-and-see drift pin; setup parser (gamma's transform
  resolves executable + the draw-threshold condition on abilities[1], draw on abilities[0]
  untouched); behavior: drew ≥2 → transforms; drew 1 (only Gamma) → waits, then transforms
  after a further draw; the ledger flip; the hash re-pins.

## Out of Scope

- **The transform swap itself** (`heroEffectTransform`), the side deck (WP-657), the
  registry fields (WP-662), the visible deck (WP-664) — reused as-is.
- **She-Hulk / every other transform hero** — the other 13 held-back transforms keep their
  honest `parse-unrecognized` markers (their conditions — discarded-≥2, KO-pile counts,
  combat outcomes, reveal-cost, feast+KO, gain-a-Wound — stay unmodeled). This WP adds
  exactly Gamma-Draining Nanites.
- **The each-player reveal-from-hand draw** (`drawFromPlayerDeck` @ heroEffects L2757,
  Psychic Link) — a different mechanic and a rare cross-set interaction; it is deliberately
  NOT counted toward `cardsDrawn` (only the `draw:N` handler path counts). Note this
  boundary in D-24476.
- **Projecting `cardsDrawn` to `UIState`** — an internal counter; the transform's
  waiting/firing is already observable via the game log. No Board-Visible-Field change.
- **Like Totally Smart Hulk's own ability** — not re-fired on transform (the WP-658
  Honest-Partial posture, unchanged).

## Files Expected to Change

- `packages/game-engine/src/economy/economy.types.ts` — `cardsDrawn`.
- `packages/game-engine/src/economy/economy.logic.ts` — reset + 5 rebuild sites.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — the increment in `heroEffectDraw`.
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — evaluator + describe cases.
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` (+ `.test.ts` drift pin) —
  `WAIT_AND_SEE_CONDITION_TYPES`.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — `draw-threshold` arm + allowlist.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — `VALID_TOKEN_PATTERN`.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — gamma abilities[1] marker.
- `data/cards/wwhk.json` (regenerated) + the hero derived artifacts.
- `scripts/hero-mechanic-ledger.mjs` — `KNOWN_CONDITIONS` (+ ledger data regen).
- `packages/game-engine/src/**/*.test.ts` — the coverage above + the hash re-pins.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24476), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/ai/NUMBER-LEDGER.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

The exact allowlist is finalised at execution; any file outside it is a FAIL.

## Non-Negotiable Constraints

> - Full file contents; ESM only, Node v22+; human-style code per `00.6-code-style.md`.
> - Determinism: `ctx.random.*` only; moves never throw; the counter + condition + deferred
>   re-check are deterministic. The counter counts effect draws only (NOT the start-of-turn
>   refill via `drawCardsIntoHand`).
> - The draw hook (abilities[0]) stays UNCONDITIONAL — the `draw-threshold` marker goes on
>   abilities[1] (the transform hook) ONLY. Gating the draw is a bug.
> - New wait-and-see condition ↔ the full lockstep (evaluator case + `WAIT_AND_SEE_CONDITION_TYPES`
>   + runtime drift pin); a listed type with no evaluator case silently never fires.
> - Card data regenerated, not hand-edited (WP-633); every `:check` gate run and green.
> - Both hash oracles handled deliberately (re-pin with a recorded no-behaviour-change note).
> - Session protocol: on any ambiguity not resolved by the WP + EC, STOP and surface it.

## Contract

- **Counter** — `TurnEconomy.cardsDrawn: number` (effect draws this turn, current player).
- **Condition** — `cardsDrawnThisTurnAtLeast` (value N), wait-and-see, reads `G.turnEconomy.cardsDrawn`.
- **Marker** — `[keyword:draw-threshold:2]` on `gamma-draining-nanites` abilityIndex 1.
- **Allowlist** — `wwhk/amadeus-cho/gamma-draining-nanites` added to `SUPPORTED_TRANSFORM_BASES`.

## Vision Alignment

- **Vision clauses touched:** §1 (faithful card behavior), §22 (determinism).
- **Conflict assertion:** No conflict — a printed hero ability made faithful; deterministic
  (no new RNG), replay-faithful, buys no game outcome (NG-1 untouched).
- **Non-Goal proximity check:** N/A — none of NG-1..7 crossed.
- **Determinism preservation:** the counter + condition are pure functions of existing
  deterministic state; the new `TurnEconomy` field re-pins the oracles (no behavior change).

## Funding Surface Gate

§20 N/A — engine gameplay + card data; no funding affordance or copy.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint or server-reachable library function.

## Acceptance Criteria

- **AC-1** Playing Gamma-Draining Nanites draws a card (abilities[0], unconditional) — unchanged.
- **AC-2** With ≥2 cards drawn this turn at the moment abilities[1] resolves, the card
  transforms into Like Totally Smart Hulk (pulled from `G.transformDeck`), applying its
  printed stats — the WP-658 swap.
- **AC-3** With only Gamma's own draw so far (cardsDrawn == 1), the transform hook WAITS
  (the wait-and-see log line, `neutral`), and transforms later the same turn once a further
  draw reaches 2; if the turn ends below 2, it never transforms.
- **AC-4** `G.turnEconomy.cardsDrawn` increments on effect draws (`draw:N`) for the current
  player and is 0 after the start-of-turn hand refill (the refill is NOT counted).
- **AC-5** `cardsDrawnThisTurnAtLeast` is in `WAIT_AND_SEE_CONDITION_TYPES` with an evaluator
  case; the runtime drift pin passes.
- **AC-6** `data/cards/wwhk.json` gamma abilities[1] encodes `[keyword:draw-threshold:2]`;
  a clean regen reproduces the committed bytes; every `:check` gate is green.
- **AC-7** The hero ledger flips `gamma-draining-nanites` `unsupported → executable`
  (transform by-hook) with a `cardsDrawnThisTurnAtLeast` condition row; effect-index +
  mechanics-metadata in lockstep.
- **AC-8** Determinism: both hash oracles re-pinned deliberately (recorded no-behaviour-change);
  `sim:runtime-observed:check` current (or a recorded re-pin); whole-repo green.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` + `pnpm -r build` exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; record the pass count.
3. The card-data regen chain reproduces committed `data/cards/*.json` + every `:check`
   (`ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `cards:check`).
4. `pnpm sim:runtime-observed:check` exits 0 (no regen, or a recorded re-pin).
5. **Control run:** remove `gamma-draining-nanites` from `SUPPORTED_TRANSFORM_BASES`; confirm
   AC-2 fails (the transform reverts to a parse-unrecognized hollow) — non-vacuous.
6. `git diff --name-only` = the finalised EC allowlist.

## Definition of Done

- [ ] AC-1..AC-8 satisfied.
- [ ] All Verification Steps green, incl. the Step-5 control run.
- [ ] No files outside the finalised EC allowlist were modified.
- [ ] `docs/ai/DECISIONS.md` — **D-24476 Active**, recording: the `cardsDrawn` counter (effect
      draws only, current player, NOT the start-of-turn refill); the `cardsDrawnThisTurnAtLeast`
      wait-and-see condition; the `draw-threshold` marker gating only abilities[1]; gamma added
      to `SUPPORTED_TRANSFORM_BASES`; the each-player-reveal-draw non-count boundary; and the
      deliberate hash re-pin.
- [ ] `docs/ai/STATUS.md` close-out.
- [ ] **D-24026 live-on-surface:** on `play.legendary-arena.com`, an Amadeus Cho match plays
      Gamma-Draining Nanites after ≥2 draws and it transforms into Like Totally Smart Hulk;
      recorded or operator-pending.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap node `📝`→`✅` + counts regenerated.

## Reserved Decision (lands at execution)

**D-24476 — Amadeus Cho's Gamma-Draining Nanites transforms only when the player has drawn
≥2 cards this turn, modeled by a new `cardsDrawnThisTurnAtLeast` wait-and-see condition over a
new per-turn `TurnEconomy.cardsDrawn` counter; gamma joins `SUPPORTED_TRANSFORM_BASES`.**
Records: the counter increments on current-player `draw:N` effect draws (`heroEffectDraw`)
only — the start-of-turn hand refill (`drawCardsIntoHand`) is NOT counted, so the threshold is
never trivially met; the condition joins `WAIT_AND_SEE_CONDITION_TYPES` and reuses the
deferred-grant window (the transform hook is transform-only, so the deferred re-fire never
re-draws); the `draw-threshold:2` marker gates only abilities[1] (the transform), leaving
abilities[0] (the draw) unconditional; the each-player reveal-from-hand draw is deliberately
not counted (a rare cross-set interaction, a different mechanic); and the new `TurnEconomy`
field re-pins both engine hash oracles (no behaviour change, the WP-657/658 precedent).

## Lint Gate Self-Review (00.3)

Completed inline at draft against all 21 sections (recorded in the `SPEC:` draft commit body).
§1–§9 PASS (Context specific + authoritative; §4 the card-data change is a prose-marker append,
not a 00.2 schema change; §8 engine decides, card-data feeds it — no layer breach). §12–§17 PASS
(control run mandated; §16 human-style; §17 Vision block carries clause numbers + conflict
assertion + determinism line; §15.1 declares `play.legendary-arena.com` with the D-24026 gate).
§10, §11, §18, §20, §21 resolve N/A with named justifications. **Gate verdicts finalised at
execution** (pre-flight + copilot recorded in the draft commit body).
