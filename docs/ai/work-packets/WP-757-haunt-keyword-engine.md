# WP-757 — Haunt keyword: haunted HQ Heroes, exorcise, and The Fallen's Ambush Haunts (Game Engine + Card Data)

**Status:** Draft 2026-09-25
**Primary Layer:** Game Engine / Implementation + Card Data
**Dependencies:**
- WP-185/187 / D-18701 (villain effect-marker substrate)
- WP-016 (HQ + `refillHqSlot`)
- WP-648 / D-24460 (`recruitOfficer`, the new-move lockstep template)
- WP-692 / D-24509 (free-recruit path)
- WP-693 / D-24510 (free-defeat targets)
- WP-128 / D-12803 (UIState audience filter)
- WP-513/514 + D-24058 (Secret Invasion twist, the push-into-City precedent)

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). NOT lightweight-eligible: it adds a new `G` field (determinism surface), a new move, a new villain-effect primitive (contract widen), and >4 files.
**Arc:** 1 of 3 in the Zarathos arc:
- WP-757 (this packet, the engine Haunt substrate)
- WP-758 (Zarathos mastermind), which runs after this one
- WP-759 (Haunt client UI), which is parallel-safe with WP-758

Both followers are BLOCKED on this packet. WP-760 (Fallen fight-side) is a sibling.

> Baseline: `origin/main` at `d09d0946` (reserve #2356).

---

## Goal

Jeff asked for the Mastermind **Zarathos** (`mdns`, *Midnight Sons*) to be playable on `play.legendary-arena.com`.

**Where it stands today.** A Zarathos match sets up and runs: mdns loads, `findMastermindCards` takes the base face, `alwaysLeads` pulls in **The Fallen**, and the four tactics are shuffled. But every Zarathos effect is written in terms of **Haunt**, and Haunt does not exist in engine or client code. All three Fallen Ambush lines are unmarked, so they fire nothing.

**What this packet builds** is the complete, Mastermind-agnostic Haunt substrate:

- **Haunt state.** A lazily created, per-HQ-slot haunter array: `G.hqHaunters`, holding `{ kind: 'villain', cardId } | { kind: 'mastermind' }`.
- **Recruit block.** A haunted Hero cannot be recruited: `recruitHero`, free-recruit auto-gain, and the parked free-recruit choice all refuse it.
- **Fight block.** A Villain haunter is unfightable because it is outside the City. `fightMastermind` and the free-defeat Mastermind target refuse while the Mastermind haunts.
- **Exorcise.** A new move, `exorciseHauntedHero({ hqIndex, outcome, recipientPlayerId? })`:
  1. It spends the haunted Hero's cost.
  2. It KOs the Hero, or gives it to a chosen player's discard.
  3. It either sends a Villain haunter into the City (no Ambush, reveal-parity escape handling) or releases the Mastermind haunter.
- **Refill inheritance.** A haunter stays on its slot through every HQ removal and refill.
- **Villain primitive.** A new villain-effect primitive, `haunt-hq-hero`, with selectors `rightmost` / `leftmost` / `cost-lte-3`, marks Metarchus's, Atrocity's and Patriarch's Ambush lines.
- **Client visibility.** Haunt state reaches clients through the UIState five-step.
- **Bots.** Bots, sim and replay can dispatch the new move, and bots actually choose to exorcise.

## User-Visible Impact

In any match with The Fallen (always led by Zarathos; also selectable under other Masterminds), Metarchus, Atrocity and Patriarch now Haunt HQ Heroes on entry, and those Heroes cannot be recruited. A player can pay a Haunted Hero's cost to exorcise it, then KO the Hero or hand it to any player, and the Villain drops into the City to be fought.

The client affordance (overlay + Exorcise button) is WP-759. **WP-757 and WP-759 should deploy together.** Between them, the live client shows a Recruit button the engine refuses.

---

## Assumes

1. `G.hq: HqZone` is a 5-tuple of `CardExtId | null` (`board/city.types.ts:47`).
   - Every HQ removal nulls the slot, then calls `refillHqSlot(hq, hqIndex, heroDeck)` (`board/city.logic.ts:204`).
   - `refillHqSlot` is pure and index-preserving.
2. `recruitHero` (`moves/recruitHero.ts:77`):
   - Validation order: index → slot → cost (`cardStats[cardId].cost` vs `getAvailableRecruit`) → stage `main` → block-all guards (~113-161) → `hasHealedThisTurn` (:165).
   - It sets `G.hasActedThisTurn = true` (:199).
3. `fightMastermind` (`moves/fightMastermind.ts:115`) has no "mastermind can't be fought" gate. `fightVillain` fights only `G.city[cityIndex]`.
4. Free-recruit paths:
   - Auto-gain: `collectEligibleHqIndices` / `gainHqHeroFree` / `freeRecruitFromHqByFilter` (`rules/tacticHandlers.ts:797-862`).
   - Parked choice: resolved via `getEligibleGiveHqHeroCards` and the bot default `selectDefaultGiveHqHeroCard` (`moves/giveHqHeroChoice.resolve.ts:115-170`).
   - A free-recruit entry carries `filter`. Paibok's unfiltered "gain" entry does not.
5. Exactly two builders offer the Mastermind as a free-defeat target:
   - `buildDefeatWithBystanderTargets` (`moves/defeatChoice.resolve.ts:115-116`), when it holds Bystanders and has tactics left;
   - `buildPureFuryTargets` (`hero/heroEffects.execute.ts:4280-4284`, dispatched ~4314), when its printed attack is below the count and tactics remain.
6. Villain reveal, `performVillainReveal` (`villainDeck/villainDeck.reveal.ts:203`):
   - It calls `pushVillainIntoCity` (:262), then handles escapes (~296-440: the generic per-escape wound when the escaper has no Escape ability, card-text Escape effects via `onEscape`, bystander carry, `koAttachedHeroesOnEscape`, `applyEscapedPileResourceLoss`).
   - It then calls `executeVillainAbilities(…, 'onAmbush', …)` (:473).
   - The escape branch is **inline** (:294-448); there is **no shared escape helper**. It also includes the escape→Scheme-Twist branch (Mystique, :407-438), which needs `executeRuleHooks` with the RevealContext and `implementationMap`. The generic escape wound reads `ctx.currentPlayer` (:324).
   - After `onAmbush`, the reveal path pushes `ambushResolved` with `citySpace` looked up from `G.city` (falling back to 0 if the card has left, :486-517).
   - The Ambush handler receives the copy-indexed instance `cardId`, so `G.city.indexOf(cardId)` is unique.
7. Secret Invasion's twist (`rules/schemeTwistResolvers.ts:704-734`) is the only path that pushes into the City without Ambush. It skips the generic per-escape wound and card-text Escape effects, so it is **not** reveal-parity.
8. Villain effect primitives:
   - `VillainEffectPrimitive` union + `VILLAIN_EFFECT_PRIMITIVES` array (`rules/villainAbility.types.ts:291,379`); parity drift is pinned at 25 (`villainAbility.types.test.ts:378`).
   - `VillainEffectDescriptor.selector` is `'rightmost' | 'highest-cost' | 'lowest-cost'` (:466).
   - `capture-hq-hero:<selector>` is the precedent. Parser at `setup/villainAbility.setup.ts:481`, handler map at `villain/villainEffects.execute.ts:2970`, marker validation at `scripts/convert-cards/apply-effect-markers.mjs:164,269`.
   - Nothing switches exhaustively over primitives. Keyword-less primitives self-narrate via `pushLog`.
9. The card-uniqueness invariant visits every card container, including the HQ (`invariants/gameRules.checks.ts:~107`).
10. New-move lockstep sites:
    - `game.ts:532` (register with `client: false`)
    - the `game.test.ts:181/213` move-list drift test
    - `index.ts:160`
    - `SIMULATION_MOVE_NAMES` plus legal intents in `simulation/ai.legalMoves.ts` (recruit intents ~880-890; order locked ~973)
    - MOVE_MAPs in `simulation/simulation.runner.ts:~316`, `simulation/par.aggregator.ts:~481`, `replay/replay.execute.ts:140`
    - `simulation/simulation.moveDispatch.drift.test.ts`
    - the bot scorer `simulation/ai.competent.ts`: `scoreOneMove`, `SCORE_RECRUIT_BASE` 50, `SCORE_FIGHT_VILLAIN_BASE` 100, unknown names score 0
11. UIState:
    - HQ assembly is at `ui/uiState.build.ts:~2186-2189` (`hq: { slots, slotDisplay }`).
    - The filter copies at `ui/uiState.filter.ts:~463`.
    - Types `UIHQState` / `UIMastermindState` / `UICardDisplay` live in `ui/uiState.types.ts`, and the UI type export list is explicit (`index.ts:~358-368`).
    - The client has no extId → display resolver, so a card shown to it must carry an embedded `display` (as `UICityCard.display` does).
12. Gates exist as pnpm scripts:
    - `cards:check`
    - `effect-index:check`
    - `mechanics:metadata:check`
    - `ledger:villains:check` (reads the engine **dist**, so build first)
    - `sim:runtime-observed:check`
    - `sim:coverage`

    Mechanic wp/decision columns come from `scripts/coverage/mechanic-provenance.json`.
13. `pnpm -r build` exits 0, and the engine suite is green on the baseline. Every drift count is re-read at execution.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- **Rulebook v23 p.27** (`docs/legendary-universal-rules-v23.md` ~L1507-1543) and `data/metadata/keywords-full.json` `haunt`. These are the authority for every behavior here:
  - Tuck the Villain beneath the Hero.
  - A Haunted Hero can't be recruited, including for free, and the Haunting Villain can't be fought.
  - Pay the Hero's cost to exorcise: KO it or choose a player to gain it. The Villain then enters the City, ignoring Ambush. Exorcise is not a fight.
  - One haunter per Hero.
  - Exorcising Zarathos's Hero returns him to the Mastermind space.
  - "Gain" and "put on the bottom of the Hero Deck" still work on Haunted Heroes.
  - When a Haunted Hero leaves the HQ, the haunter stays and haunts the refill.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary + §Move Validation Contract.
- `.claude/rules/architecture.md` §UIState Projection Integrity (the five-step).
- `docs/ai/REFERENCE/00.2-data-requirements.md` (canonical field names).
- `docs/ai/DECISIONS.md` D-18701, D-24509, D-24510, D-24460, D-12803.
- `data/cards/mdns.json` The Fallen (~797-853).
- User memory:
  - `reference_uistate_filter_whitelist_drops_fields`
  - `reference_hashed_g_field_dual_repin`
  - `feedback_move_registration_drift_test`
  - `reference_new_resolve_move_sim_dispatch_lockstep`
  - `reference_bot_legalmoves_moveguard_divergence`

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc, `// why:`, no `.reduce()`, no nested ternaries, no `import *`.
- Moves and effects **never throw**. Zones store `CardExtId` only; a haunter records a `CardExtId`, never a card object.
- No randomness is introduced. Engine layer only: no `apps/*` change.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24587) before coding. One WP per session.

**Packet-specific:**

- **Omit-when-absent `G.hqHaunters`.**
  - Created only on the first haunt, never in `Game.setup`.
  - A 5-length `(HqHaunter | null)[]` aligned to `G.hq`.
  - A match that never haunts keeps it absent, so the hash oracles are byte-stable.
- **Index-keyed state.** Do NOT edit any existing HQ removal site: gain, capture, put-bottom, KO-from-HQ twist, Secret Invasion, or the give-HQ-hero effects. Because the haunter stays on the index, the refill Hero inherits it automatically.
- **Recruit block — exactly four places:**
  1. `recruitHero`: silent return on a haunted slot, before any spend.
  2. `collectEligibleHqIndices`: haunted slots are ineligible for auto free-recruit.
  3. `getEligibleGiveHqHeroCards` / `selectDefaultGiveHqHeroCard`: exclude haunted slots **when the entry carries `filter`** (free recruit). Paibok's unfiltered "gain" stays unfiltered.
  4. `ai.legalMoves` recruit intents: skip haunted slots.
- **Exorcise follows the move validation contract, in this order:**
  1. Args: `hqIndex` 0-4, slot non-null, slot haunted, `outcome ∈ {'ko','gain'}`. For `'gain'`, a `recipientPlayerId` that exists in `G.playerZones`.
  2. Cost: available Recruit ≥ `cardStats[heroId].cost`, the same authority `recruitHero` uses.
  3. Stage `main`, then the full `recruitHero` block-all guard list, then `hasHealedThisTurn`. The heal lock applies because exorcise spends like a recruit.
  4. Mutate:
     - Spend via recruitHero's spend path and set `G.hasActedThisTurn = true`.
     - Apply the outcome: `'ko'` → `G.ko`; `'gain'` → the recipient's **discard**.
     - Clear the haunter, then `refillHqSlot`.
     - Release the haunter. A **Villain** goes through `enterCityIgnoringAmbush`. A **Mastermind** gets a log line: "returns to the Mastermind space".
- **Exorcise is not a recruit and not a fight.** No recruit triggers or tallies, and no `onFight`.
- **Escape extraction.** Extract the escape branch of `performVillainReveal` (`villainDeck.reveal.ts:294-448`) into an exported `resolveVillainEscape(G, context: RevealContext, implementationMap: ImplementationMap, escapedCardId)` in `villainDeck.reveal.ts`. This is a **mechanical extraction**: the reveal path calls it with identical behavior, and the existing reveal tests must pass unchanged.
- **`enterCityIgnoringAmbush(G, context: RevealContext, implementationMap: ImplementationMap, cardId)`** lives in `villainDeck/villainDeck.enterCity.ts` (new). It is placed under `villainDeck/`, not `board/`, to avoid a board→villain/rules import cycle.
  - It pushes the card into City space 0 and calls `resolveVillainEscape` for any Villain pushed out.
  - Parity covers the full reveal-path handling: the generic wound, card-text `onEscape`, the escape→Scheme-Twist branch, bystander carry, `koAttachedHeroesOnEscape`, `applyEscapedPileResourceLoss` and the escape counter.
  - It never fires `onAmbush`, and it does not copy Secret Invasion's reduced handling.
  - `context` is a `RevealContext` (`{ random, ctx: { currentPlayer } }`, `villainDeck.reveal.ts:78-83`); `implementationMap` is passed separately, exactly as `performVillainReveal` takes it (:203-207). The exorcise move builds the context from its own `random` / `ctx` and passes the static `DEFAULT_IMPLEMENTATION_MAP` (precedent `fightVillain.ts:494`, `playVillainTop.resolve.ts:106`).
- **Fight-mastermind block.** `fightMastermind` returns silently when any `G.hqHaunters` entry is `{ kind: 'mastermind' }`. `buildDefeatWithBystanderTargets` **and `buildPureFuryTargets`** both omit the Mastermind target under the same predicate, and bot legal intents mirror it. All four use one predicate: `isMastermindHaunting`.
- **One haunter per Hero.** Selectors consider only unhaunted, non-null slots. With no eligible slot, the Ambush Haunt is a logged no-op and **the Villain stays in the City**.
- **Ambush Haunt moves the Villain out of the City.** The handler finds its `cardId` in `G.city`, nulls that space, and records the haunter. Any attached bystanders stay keyed to the card (none for the Fallen).
  - The handler self-narrates with one `pushLog` line naming the haunted Hero. It does not duplicate the composed "Ambush effect:" line.
  - The reveal path's `ambushResolved` notable event then records `citySpace` 0, because the card has left the City. This is **accepted** (locked in D-24587) and asserted in a test.
- **Selectors (D-24587), an append-only widen of the descriptor's `selector` union with `'leftmost' | 'cost-lte-3'`:**
  - `rightmost`: the highest unhaunted index.
  - `leftmost`: the lowest.
  - `cost-lte-3`: the lowest-index unhaunted slot whose `cardStats` cost is ≤ 3. This is a deterministic v1 of Patriarch's "an unhaunted Hero". The named fidelity gap is recorded in D-24587.

  The `capture-hq-hero` parser and validator stay unchanged and still reject the new selector values.
- **Empty haunted slot.** When the Hero deck runs dry and a haunted slot goes `null`, the haunter persists. It cannot be exorcised: there is no Hero and no cost. It re-attaches if the slot refills. The deck-exhaustion final-turn latch bounds a stranded Mastermind haunter.
- **Invariant.** The uniqueness invariant visits each Villain haunter's `cardId`.
- **UIState five-step.** Both fields are public shared-board data for every audience and are omit-when-absent. A Villain haunter carries an embedded `display: UICardDisplay`, built from `G.cardDisplayData` the same way `UICityCard.display` is.
- **Bot policy:**
  - Legal intents: `exorciseHauntedHero({ hqIndex, outcome: 'gain', recipientPlayerId: <self> })` per affordable haunted slot, appended **after the `fightMastermind` step, `hqIndex` ascending**.
  - `ai.competent.ts` scores them at `SCORE_EXORCISE_BASE = 75`, between recruit (50) and fight-villain (100). The `// why:` comment: an exorcise both frees a Hero and unlocks a fight.

## Locked Values

- `type HqHaunter = { kind: 'villain'; cardId: CardExtId } | { kind: 'mastermind' }`.
- `G.hqHaunters?: (HqHaunter | null)[]`.
- Move `exorciseHauntedHero({ hqIndex: number; outcome: 'ko' | 'gain'; recipientPlayerId?: string })`, registered with `client: false`.
- Primitive `'haunt-hq-hero'`. Tokens:
  - `[effect:haunt-hq-hero:rightmost]`
  - `[effect:haunt-hq-hero:leftmost]`
  - `[effect:haunt-hq-hero:cost-lte-3]`
- Marker rows under `villains.mdns.fallen`:
  - `metarchus.ambush ["haunt-hq-hero:rightmost"]` (keep its `fight`)
  - `atrocity.ambush ["haunt-hq-hero:leftmost"]`
  - `patriarch.ambush ["haunt-hq-hero:cost-lte-3"]`
- `mechanic-provenance.json`: `"haunt-hq-hero": { "wp": "WP-757", "decision": "D-24587" }`.
- UIState:
  - `UIHQHaunter = { kind: 'villain'; extId: string; display: UICardDisplay } | { kind: 'mastermind' }`
  - `UIHQState.haunters?: (UIHQHaunter | null)[]`
  - `UIMastermindState.isHaunting?: true`
  - `UIHQHaunter` is added to the `index.ts` UI type exports.
- `SCORE_EXORCISE_BASE = 75`.
- Exported helpers for WP-758:
  - `hauntHqSlot(G, hqIndex, haunter): boolean` (lazy-creates the array; returns `false` on a haunted or null slot)
  - `isMastermindHaunting(G): boolean`
  - `isHqSlotHaunted(G, hqIndex): boolean`

---

## Scope (In)

- **A) Types.** `types.ts`: `HqHaunter` + `hqHaunters?`.
- **B) Haunt logic.** `board/haunt.logic.ts` (new) + test:
  - `isHqSlotHaunted`
  - `isMastermindHaunting`
  - `selectUnhauntedHqIndex`
  - `hauntHqSlot`
  - `clearHqHaunter`

  `enterCityIgnoringAmbush` lives in `villainDeck/` (D2).
- **C) Move.** `moves/exorciseHauntedHero.ts` (new) + test.
- **D) Guards:**
  - `moves/recruitHero.ts`
  - `rules/tacticHandlers.ts` (`collectEligibleHqIndices`)
  - `moves/giveHqHeroChoice.resolve.ts`
  - `moves/fightMastermind.ts`
  - `moves/defeatChoice.resolve.ts`
  - `hero/heroEffects.execute.ts` (`buildPureFuryTargets`)

  Each gets tests.
- **D2) Escape extraction:** `villainDeck/villainDeck.reveal.ts` (`resolveVillainEscape`) + test; `villainDeck/villainDeck.enterCity.ts` (new, `enterCityIgnoringAmbush`) + test.
- **E) Primitive:**
  - `rules/villainAbility.types.ts` (union + array + selector widen) + test
  - `setup/villainAbility.setup.ts` (parser branch) + test
  - `villain/villainEffects.execute.ts` (handler + map) + test
  - `scripts/convert-cards/apply-effect-markers.mjs` (token validation)
- **F) Data:**
  - 3 marker rows
  - `mechanic-provenance.json`
  - regenerate `data/cards/mdns.json` + feeds
- **G) Invariant visit.** `invariants/gameRules.checks.ts` + `invariants.test.ts`.
- **H) UIState five-step.** Types, build, filter, audience test, and the `index.ts` export.
- **I) Move lockstep:**
  - `game.ts`, `game.test.ts`, `index.ts`
  - `ai.legalMoves.ts` + test
  - `ai.competent.ts` + test
  - `simulation.runner.ts`, `par.aggregator.ts`, `replay.execute.ts`
  - the dispatch drift test

## Out of Scope

- **Zarathos himself** (strike, tactics, highest-cost selector) is WP-758. This packet ships the `mastermind` haunter kind and its blocks **with no producer**, so WP-758 never reopens this contract.
- **Client** work is WP-759.
- **The Fallen fight-side** (Blood Frenzy, Atrocity's rescue, Patriarch's reveal-draw, Salomé's KO-from-discard) is WP-760.
- **Salomé's Escape "ascends to become an additional Mastermind"** is deferred to a future Ascend / multiple-Masterminds arc (34 lines across 7 sets; `G.mastermind` is a single object today).
- **Epic Zarathos** (no Epic-face selection, D-24193) is a named follow-up.
- **Server autoplay** (`apps/server/src/autoplay/autoplay.mjs`). Its spend filter is a hardcoded move-name list (~895-901), so all-bot autoplay matches will not exorcise until it gains `exorciseHauntedHero`. That is tracked as a separate server follow-up, together with its non-active seat-choice gap. Engine bots (sim/PAR) do exorcise via `ai.competent.ts`. Human play is unaffected.
- **N/A engine mechanics:** "HQ space destroyed" and "escape KOs a Hero from the HQ" have no engine path today.
- **Patriarch's choice.** An interactive choice for "an unhaunted Hero" is not built; v1 is deterministic.
- **Excluded surfaces:** no scoring, PAR-table, leaderboard, identity or monetization surface.

## Files Expected to Change

**New files**
- `packages/game-engine/src/board/haunt.logic.ts` (+ `haunt.logic.test.ts`)
- `packages/game-engine/src/moves/exorciseHauntedHero.ts` (+ `exorciseHauntedHero.test.ts`)
- `packages/game-engine/src/villainDeck/villainDeck.enterCity.ts` (+ `villainDeck.enterCity.test.ts`)

**Modified — engine (`packages/game-engine/src/`)**
- `types.ts` — `HqHaunter`, `hqHaunters?`
- `moves/recruitHero.ts` (+ `recruitHero.test.ts`) — haunted guard
- `rules/tacticHandlers.ts` (+ `tacticHandlers.test.ts`) — `collectEligibleHqIndices` exclusion
- `moves/giveHqHeroChoice.resolve.ts` (+ test) — filtered-entry exclusion
- `moves/fightMastermind.ts` (+ `fightMastermind.test.ts`) — haunting guard
- `moves/defeatChoice.resolve.ts` (+ test) — Mastermind target exclusion
- `hero/heroEffects.execute.ts` (+ `heroEffects.execute.test.ts`) — `buildPureFuryTargets` Mastermind exclusion
- `villainDeck/villainDeck.reveal.ts` (+ `villainDeck.reveal.test.ts`) — mechanical `resolveVillainEscape` extraction
- `rules/villainAbility.types.ts` (+ test) — primitive + selector widen
- `setup/villainAbility.setup.ts` (+ test) — parser branch
- `villain/villainEffects.execute.ts` (+ test) — handler + map
- `invariants/gameRules.checks.ts` (+ `invariants.test.ts`) — haunter visit
- `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` (+ the audience-filter test file) — five-step
- `game.ts`, `game.test.ts`, `index.ts` — registration, drift, exports
- `simulation/ai.legalMoves.ts` (+ test) — recruit skip + exorcise intents
- `simulation/ai.competent.ts` (+ test) — `SCORE_EXORCISE_BASE`
- `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `simulation/simulation.moveDispatch.drift.test.ts`, `replay/replay.execute.ts` — dispatch

**Modified — scripts and card data**
- `scripts/convert-cards/apply-effect-markers.mjs` — token validation
- `scripts/convert-cards/inputs/villain-effect-markers.json` — 3 rows
- `scripts/coverage/mechanic-provenance.json` — 1 row
- `data/cards/mdns.json` — regenerated
- Derived feeds, regenerated:
  - `data/metadata/effect-implementation-index.json`
  - `data/metadata/card-mechanics.json`
  - `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`
  - `docs/ai/coverage/runtime-observed-hollows.json`
  - `sim:coverage` baseline, only if its check flags

**Governance**
- `docs/ai/DECISIONS.md` (D-24587)
- `docs/ai/STATUS.md`
- `WORK_INDEX.md`, `EC_INDEX.md`
- `docs/05-ROADMAP-MINDMAP.md`

This is ~30 code/test/data files, well over the ~8 guideline. Justification: one mechanic, but it touches every new-move lockstep site, the five-step, and four recruit-block sites, and splitting would leave a half-wired, unexercisable Haunt. About half the files are tests.

## Contract

- The Locked Values above: `HqHaunter`, `hqHaunters?`, the move signature, the primitive + tokens, the UIState shapes, and the three exported helpers.
- WP-758 and WP-759 consume this contract **verbatim**. Changing it after merge requires a DECISIONS entry.

## Vision Alignment

**Vision clauses touched:**
- §1 (faithful Legendary rules)
- §8 / §22 (determinism, replay-faithful behavior)
- §23 / §24 (competitive integrity — the gauntlet loadouts for Zarathos and Lilith include `mdns/fallen`, `gauntletLoadouts.generated.ts:820-837`)
- NG-1 (no pay-to-win)

**Conflict assertion:** No conflict. The change makes The Fallen play as printed.

**Non-Goal proximity:** NG-1..7 are not crossed. Pure rules fidelity, with no monetization or persuasion surface.

**Determinism preservation:**
- `hqHaunters` is omit-when-absent and the move introduces no randomness, so `finalStateHash` / `PRE_WP080_HASH` stay unchanged (the core-only sentinel plays no Fallen).
- **Replay-compat note:** stored replays of *pre-WP-757* matches that revealed a Fallen Ambush will not re-execute identically, because those Ambushes now haunt. This is the same consequence every card-fidelity WP carries. Recorded in D-24587.

## Funding Surface Gate

§20 **N/A**: engine and card data only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint or `apps/server/src/**` library surface changed. D-11804 does not apply.

---

## Acceptance Criteria

1. A match that never haunts has no `hqHaunters` key, and both hash oracles are unchanged.
2. Revealing a Fallen Villain with an eligible Hero removes the Villain from the City and haunts:
   - Metarchus → the rightmost unhaunted Hero;
   - Atrocity → the leftmost unhaunted Hero;
   - Patriarch → the lowest-index unhaunted Hero with cost ≤ 3.

   With no eligible Hero, the Villain stays in the City and a no-op is logged.
3. A haunted slot cannot be recruited by any path:
   - `recruitHero` on it changes nothing (no spend, no gain);
   - the free-recruit auto-gain never takes it;
   - the parked free-recruit choice (Dark Technology / Bitter Captor) never offers it and its bot default never picks it.

   Paibok's unfiltered "gain" still offers it.
4. `exorciseHauntedHero` with enough Recruit:
   - spends exactly the Hero's cost and sets `hasActedThisTurn`;
   - `'ko'` → the Hero goes to `G.ko`; `'gain'` → the Hero goes to the recipient's discard, including a non-active recipient;
   - refills the slot unhaunted.

   Haunter release:
   - A Villain haunter enters City space 0 **without** its Ambush (asserted). A pushed-out Villain escapes via `resolveVillainEscape`, with the generic wound, Escape text and bystander carry asserted. The existing reveal tests pass unchanged after the extraction.
   - A Mastermind haunter is released.
5. `exorciseHauntedHero` changes nothing on any of:
   - invalid args, an unhaunted slot, or a null slot;
   - insufficient Recruit, the wrong stage, or an outstanding pending choice;
   - after healing this turn;
   - `'gain'` with an unknown recipient.
6. Removing a haunted Hero by another path (`captureHeroFromHq`, put-bottom) leaves the haunter on the slot, and it haunts the refill Hero.
7. While `isMastermindHaunting`:
   - `fightMastermind` changes nothing;
   - both free-defeat target builders (defeat-with-Bystander and Pure Fury) omit the Mastermind;
   - bot legal moves offer no `fightMastermind`.

   Bot legal moves never offer a haunted recruit, and do offer exorcise per affordable haunted slot (after `fightMastermind`, `hqIndex` ascending). `ai.competent` prefers exorcise over recruit. Legal intents match the move guards: no bot FAULT across a seeded Fallen sim.
8. The uniqueness invariant passes with a haunting Villain and fails if that Villain is also in the City.
9. The UIState filter passes through `hq.haunters` (with the Villain `display`) and `mastermind.isHaunting` for every audience, and both are present in the diagnostics `uiStateSnapshot`.
10. Drift tests are green, each +1:
    - the move list;
    - `SIMULATION_MOVE_NAMES` / MOVE_MAPs;
    - `VILLAIN_EFFECT_PRIMITIVES` (25 → 26, re-read at execution).
11. The Fallen Ambush lines in `mdns.json` carry the three tokens, and every card/feed gate exits 0.

## Verification Steps

1. `pnpm -r build` → exit 0. It must come first: `ledger:villains:check` reads the engine dist.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass.
3. `node scripts/convert-cards/apply-effect-markers.mjs` → "3 lines updated". Re-run → 0 updates (idempotent).
4. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:villains:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git diff --name-only` ⊆ Files Expected to Change. Hash fixtures unchanged, or dual-re-pinned honestly per `reference_hashed_g_field_dual_repin`. Revert `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] All Acceptance Criteria pass; the diff is allowlist-only.
- [ ] D-24587 appended Active to `DECISIONS.md`.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, `roadmap:counts:check` 0.
- [ ] Two-commit topology: `EC-794:` then `SPEC:`.
- [ ] **D-24026 live-verify (post-merge, REQUIRED, after WP-759 deploys).** In a **human-driven** solo match on `play.legendary-arena.com` with mastermind `mdns/zarathos` (deployed `/api/version` gitSha checked), observe:
  - a Fallen Ambush haunts a Hero;
  - Recruit refuses that Hero;
  - an exorcise drops the Villain into the City.

  Recorded as operator-pending until seen. Not all-bot autoplay (see Out of Scope).

## Reserved Decision (lands at execution)

**D-24587 — haunt-state-model.** It locks:

- **State and move:** `hqHaunters` is index-keyed and omit-when-absent; the haunter kinds; the exorcise order, cost authority, heal lock and outcomes.
- **City entry:** reveal-parity escape handling on no-Ambush entry via the extracted `resolveVillainEscape`; the `ambushResolved` event's `citySpace` 0 fallback is accepted.
- **Blocks:** the four recruit-block sites (free recruit filtered, "gain" unfiltered); the Mastermind fight block and both free-defeat builders (defeat-with-Bystander, Pure Fury).
- **Selectors:** the `cost-lte-3` deterministic selector (a named fidelity gap).
- **Empty slots:** empty-slot haunter persistence.
- **Bots:** bot score 75.
- **Replay:** the replay-compat note for pre-WP-757 Fallen matches.

---

## Lint Gate Self-Review (00.3)

**Round 1: FAIL** on §2, §4, §5, §13, §15, §17, §20 and §21 (gate subagent). Fixed in this revision:
- engine-wide boilerplate and session protocol;
- 00.2, ARCHITECTURE and DECISIONS context;
- missing files added, with new/modified tags;
- exact gate commands;
- a STATUS DoD line, and live-verify moved to human play;
- Vision, Funding and API sections.

**Round 2: PASS.**
- **§1:** all sections present, including Scope (In) and Out of Scope.
- **§2:** boilerplate + protocol.
- **§3:** Assumes verified line-by-line by the gate subagent.
- **§4:** context complete.
- **§5:** ~30 files, justified.
- **§6:** canonical names (`CardExtId`, `hqIndex`).
- **§7:** no dependencies.
- **§8:** engine only.
- **§9:** pnpm only.
- **§10–§11:** N/A.
- **§12:** `node:test`, no boardgame.io test imports.
- **§13:** exact commands with expected outputs.
- **§14:** 11 binary ACs.
- **§15:** STATUS, DECISIONS, indexes, live-verify.
- **§16:** 00.6.
- **§17:** satisfied.
- **§18–§19:** N/A.
- **§20–§21:** N/A, justified.

## Gate Record

**Pre-flight (01.4), round 1: NOT READY.**
- PS-1: missing sections.
- PS-2: free-recruit parked choice.
- PS-3: haunted recruit intents.
- PS-4: bots never exorcise; autoplay list.
- PS-5: no haunter `display`.

All five are resolved above:
- sections added;
- `giveHqHeroChoice.resolve.ts` guard;
- `ai.legalMoves` skip;
- `ai.competent` score 75, with autoplay excluded as a tracked server follow-up and live-verify moved to human play;
- `display` added to `UIHQHaunter`.

RS-1..10 are locked:
1. selector widen, capture parser unchanged;
2. reveal-parity escape;
3. heal lock + `hasActedThisTurn`;
4. intent ordering;
5. free-defeat Mastermind exclusion;
6. self-narration (conditional `notableEvents` dropped);
7. exact commands + `mechanic-provenance.json`;
8. factual fixes (all three Fallen Ambush lines; build line);
9. empty-slot bound;
10. EC files list.

**Scope verdict: READY TO EXECUTE.** The dependencies (WP-016/185/187/648/692/693/128) are all complete on `main`.

**Copilot (01.7), round 1: BLOCK (SUSPEND)** on #4, #10/#21, #12, #16, #22, #23, #26, #28, #29 and #30. Each maps to a PS/RS fix above: the contract now carries `display`, the selector typing is locked, the allowlist is closed, the bot no-op loop is removed, ordering and semantics are locked, and the replay-compat note is recorded.

**Round 3 CONFIRM (independent subagent).** WP-759 and WP-760 CONFIRM. Two text-only defects were fixed in this revision:
- **D1 (WP-757):** the escape-helper signatures now take `implementationMap` separately from `RevealContext`.
- **D2 (WP-758):** strike wounds go through `gainWoundForPlayer`, not the private `mastermindHandlers` helper.

The nits (line refs, EC anchors, the prompt arc count) were applied. With these, pre-flight READY stands and copilot is RISK (documented).

**Round 2 (independent subagent).** Every round-1 code-fact fix was confirmed against live code. Two new blockers, both fixed in this revision:
- **B1:** Pure Fury (`buildPureFuryTargets`) also offered a haunting Mastermind. Now excluded, with `heroEffects.execute.ts` added to the allowlist.
- **B2:** there is no shared escape helper, and the escape branch includes escape→Scheme-Twist. Now handled by a mechanical `resolveVillainEscape` extraction, with `enterCityIgnoringAmbush` moved under `villainDeck/` and given the full context.

Non-blocking items locked: the `ambushResolved` `citySpace` fallback, no double narration, and the MOVE_MAP overlap with WP-749 (whichever lands second rebases).

Verdicts: pre-flight **READY TO EXECUTE**; copilot **RISK (documented)**. The residual risk is the escape extraction touching the core reveal path, which the unchanged reveal tests guard.
