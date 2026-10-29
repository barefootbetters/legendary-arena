# WP-853 — "Whenever a card you own is KO'd this turn": Bishop's Absorb Energies (Game Engine + card data)

**Status:** Draft 2026-10-28 (EC-891; D-24789 reserved)
**Layer:** Game Engine (parse marker + wait-and-see condition + KO-site signal) + card data
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** WP-568 / D-24377 (deferred conditional grants, the `turn.onMove` wait-and-see resolve) ✅,
WP-656 / D-24467 (edge signal + re-arm for a repeatable per-event grant) ✅, WP-777 / D-24616 (a
per-player lazy counter keyed by the owner of the affected card) ✅, WP-744 / D-24567 (sim / PAR /
fixture harnesses mirror the onMove resolve and the onBegin clears) ✅

## Goal

Make Bishop's **Absorb Energies** (`dkcy/bishop/absorb-energies`) do what it prints: "Whenever a
card you own is KO'd this turn, you get +2[icon:recruit]." Today the setup parser reads only the
`+2[icon:recruit]` token and emits a flat `onPlay recruit:2`, so the card gives +2 Recruit the
moment it is played and nothing when a card is later KO'd. After this WP, playing it gives no
Recruit by itself (its printed `0+` stays 0), and each card the player owns that is KO'd later that
turn gives +2 Recruit, once per card, for each Absorb Energies in play.

## User-Visible Impact

`play.legendary-arena.com` — playing Absorb Energies logs "… ability is waiting — it needs a card
you own to be KO'd this turn" instead of "+2 recruit". Each later KO of one of the player's cards
that turn (a Whatever the Cost KO, a Wound healed, a Firepower from the Future KO, a Villain's
"KO one of your Heroes") logs "+2 recruit from Absorb Energies", once per KO'd card. A turn with no
KO gets nothing. Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` = `d0ab7724` (the WP-853 reserve merge, #3090).
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` exports
  `WAIT_AND_SEE_CONDITION_TYPES`, `REPEATABLE_DEFEAT_CONDITION_TYPE`,
  `recordDeferredConditionalGrant`, `resolveDeferredConditionalGrants`,
  `clearDeferredConditionalGrants`. A failed wait-and-see condition at play records an entry; the
  play-phase `turn.onMove` (`game.ts`, `resolveDeferredHeroGrants(G, { G, ctx, random })`) re-checks
  every entry after every move, fires a satisfied one through `runHookEffects` and removes it.
- `packages/game-engine/src/hero/heroEffects.execute.ts` `resolveDeferredHeroGrants` re-arms a fired
  grant whose hook carries `REPEATABLE_DEFEAT_CONDITION_TYPE` (`hookHasRepeatableDefeatCondition`)
  and then `delete`s the edge flag `G.villainOrMastermindDefeatedSinceResolve` (D-24467 §3–4).
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` has `evaluateCondition` and
  `describeFailedCondition` switches with a `default → false` path, and `matchReadsConditionType`.
- `packages/game-engine/src/setup/heroAbility.setup.ts` maps condition-only markers to conditions
  (the `defeated-villain-or-mastermind` arm) and lists them in `HERO_PARSER_RECOGNIZED_MARKER_NAMES`;
  the line's `+N[icon:recruit]` stays on the same hook as the gated effect.
- `packages/game-engine/src/board/ko.logic.ts` `koCard(koPile, cardId)` only appends. There is no
  KO chokepoint: each of the 34 KO sites (30 `koCard` calls + 4 `moveCardFromZone(…, G.ko, …)`,
  listed in §Context) removes the card from its source zone itself.
- The engine `tsconfig.json` sets `exactOptionalPropertyTypes: true`; optional `G` fields are
  removed with `delete`, never assigned `undefined`.
- `data/cards/dkcy.json` is GENERATED. Markers live in
  `scripts/convert-cards/inputs/hero-ability-markers.json` (keyed by set, then `heroSlug` /
  `cardSlug` / `abilityIndex`) and are applied by `apply-hero-ability-markers.mjs`, whose
  `VALID_TOKEN_PATTERN` must list every token. `ssw1/captain-marvel/absorb-energies` is a
  different card with the same slug; its entry sits under `ssw1` and is untouched.

## Context (Read First)

- **Evidence.** Operator match `g0OSXmiDT3o` (WP-851 live-verify, Bishop deck), log
  `C:\pcloud\matches\Core\RedSkull\red-skull-midtown-LOG-2p-bishop.txt`: 14.2.1–14.2.2 Absorb
  Energies played, `+2 recruit` at once; 14.2.5 Lightning Bolt KO'd for Whatever the Cost, no Recruit
  after it; the same flat on-play grant at 16.2.4, 18.2.6 and 20.2.4, turns with no KO. A phantom
  grant (every play) and a missing reactive grant (every KO) at once.
- **Parse today (observed).** Running `buildHeroAbilityHooks` on `data/cards/dkcy.json` (Bishop)
  gives, for each of the 5 copies, `{ timing: 'onPlay', keywords: ['recruit'], effects: [{ type:
  'recruit', magnitude: 2 }] }` with no condition. No `hero-mechanic-ledger.csv` row names
  `dkcy/bishop` + `absorb-energies` (line 592's `absorb-energies` is ssw1 Captain Marvel's card).
- **Why the D-24467 shape, not a new keyword.** "Whenever X happens this turn, you get +N" is
  Diamond Form's shape: the printed reward is an ordinary `recruit` effect gated by a wait-and-see
  condition that is true only right after the event, and the fired grant re-arms for the next event.
  The only differences are the event (a KO of a card the player owns, not a defeat) and that one move
  can KO several cards at once (heal 3 Wounds; KO 3 cards from Firepower; a Villain KOs every
  Hero with a trait), so the signal is a per-owner **count**, not a boolean, and the grant fires once
  per counted KO. No new hero keyword, handler, pending choice, move, or UIState field.
- **Why a signal at each KO site.** No function sees every KO, and `koCard` gets only the card id,
  not its owner (card ids do not encode an owner). The KO sites that take a card from a player's
  hand, deck, discard or in-play cards already hold that player's id (or their caller does), so each
  one records the owner beside its `koCard` call. A per-function pin over every KO site makes a new,
  unclassified KO site fail CI (the WP-498 hand→discard drift-guard precedent).
- **"A card you own."** The rules glossary (`docs/legendary-universal-rules-v23.md`) does not define
  it. This WP counts a card KO'd from the player's **hand, deck, discard pile, or cards in play** —
  the player's own deck cycle, which is what Heroes, Wounds, Officers and Sidekicks the player
  gained are. KOs from the HQ, the City, the Villain Deck, the Escape Pile and the Victory Pile never
  count. Victory Pile is RS-1 below.
- **KO site table (34 sites = 25 OWNED + 9 NOT OWNED; all paths under `packages/game-engine/src/`).** OWNED (record the
  owner): `hero/heroEffects.execute.ts` `heroEffectKo` (in play), `applyRevealKo` (deck top; owner
  threaded from `applyRevealAction`), `heroEffectKoWoundReward`, `heroEffectKoWound`;
  `moves/healWounds.ts` (one record per Wound); `moves/koDiscardChoice.resolve.ts`;
  `moves/koHeroChoice.resolve.ts` (two sites); `moves/melterKoChoice.resolve.ts` (owner =
  `args.ownerPlayerID`); `moves/optionalKoReward.resolve.ts`; `moves/revealThreeAssign.resolve.ts`;
  `moves/revealTopDispose.resolve.ts` (owner = `args.ownerPlayerID`);
  `moves/ruthlessDictatorChoice.resolve.ts`; `moves/scryKoChoice.resolve.ts`;
  `moves/seatChoiceTactics.ts` `applyCrushPacifistResistanceKo`; `rules/mastermindHandlers.ts`
  `resolveRedSkullStrike` (each player's hand, owner = loop `playerId`);
  `villain/villainEffects.execute.ts` `villainEffectScryKoOwnDeck`,
  `villainEffectRevealTopKoGreyOrDrawByClass`, `villainEffectKoWoundsCurrentHandAndDiscard` (owner =
  `chosenPlayer`, one record per Wound), `villainEffectKoHeroesCurrentByTrait`, `koOneHeroForPlayer`
  (two sites), `koHeroesFromZoneForPlayer`, `koSingleTarget` (owner threaded from its callers);
  `moves/operatorSetters.ts` `koFromPlayerZone` when `from.zone` is hand / deck / discard / inPlay.
  NOT OWNED: HQ — `moves/exorciseHauntedHero.ts`, `rules/schemeTwistResolvers.ts` `koFromHq`,
  `rules/timestreamPurge.logic.ts`, `villainDeck/villainEscapeProcedure.ts`; Villain Deck —
  `rules/tacticHandlers.ts` `resolveFindingZemo`; Victory Pile — `moves/seatChoiceTactics.ts`
  `applyVanishingIllusionsKo`, `rules/mastermindHandlers.ts` `resolveBaronZemoStrike`,
  `rules/tacticHandlers.ts` `resolveWhispersAndLies`, `villain/villainEffects.execute.ts`
  `villainEffectKoBystanderEachVictoryPile`, and `operatorSetters` with `from.zone` = victory.
- **Timing.** The grant is recorded when Absorb Energies is played, so KOs before the play do not
  count. The two onMove KO sites that run after `resolveDeferredHeroGrants` (escape HQ KO, Timestream
  sweep) are HQ-only, so no owned count is ever left unconsumed at a move boundary.
- **Single WP, ~22 source files.** The trigger is only correct if every owned KO site records; a
  split that ships the condition with half the sites would give a trigger that silently misses some
  KOs. The site edits are mechanical (one recorder call beside an existing `koCard`), and the
  drift pin makes the set closed.
- **Corpus scan (all 41 sets, hero cards).** Same "whenever … is KO'd this turn" trigger family:
  - `dkcy/bishop/absorb-energies` — **in scope**.
  - `dstr/doctor-voodoo/posessed-by-brothers-spirit` — "The first time that one of your Heroes or a
    Hero from your deck or discard pile is KO'd this turn, you get +4[icon:recruit] or
    +4[icon:attack]." Parses today to a flat on-play **+4 Recruit AND +4 Attack** (a worse phantom).
    Needs a Hero-only filter, first-time one-shot and a choose-one reward: follow-up WP.
  - `wwhk/miek-the-unhived/endless-appetite` — "Whenever a card is KO'd from your deck this turn, you
    may draw a card." Parses today to an empty hook (does nothing, no phantom). Needs a deck-source
    count: follow-up WP.
  - Neighbours that read a turn total or a this-way set (different primitives, not triggers):
    `wwhk/miek-the-unhived/metamorphosis`, `wwhk/no-name-brood-queen/bursting-with-life`,
    `wwhk/no-name-brood-queen/world-spanning-hunger` (Feast "KO'd from your deck this turn"),
    `vill/sabretooth/upper-hand` ("+1 attack for each card KO'd this turn"),
    `vill/juggernaut/unstoppable-force`, `vill/venom/ravenous-greed`,
    `ssw2/phoenix-force-cyclops/rise-from-the-ashes`, `xmen/phoenix/reincarnating-phoenix`
    ("a Hero that was KO'd this turn"). Mastermind `wpnx/omega-red` ("Whenever you KO any Wounds") is
    a Mastermind rule, not a hero trigger.
- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline + Principle #1 (determinism);
  `.claude/rules/architecture.md` §Persistence Boundary (G runtime-only).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (§5.1 `[keyword:X]`).
- `docs/ai/DECISIONS.md` — scan D-24377, D-24467, D-24543, D-24567, D-24616, D-24787, D-24372 before
  coding.
- `docs/ai/REFERENCE/00.6-code-style.md` — the code-style rules every file follows.

### RS-1 — Victory Pile (operator ruling, default locked)

Default locked: Victory Pile KOs (Villains, Bystanders) do **not** count. Those are cards the player
scored, not cards in their deck cycle. If Jeff rules they do, the only change is four more KO sites
in the OWNED list (and their per-function pin entries); the rest of the design is unchanged. Confirm at
the execution go.

## Scope (In)

- **Marker.** `[keyword:owned-card-koed]` (single segment, no magnitude). `VALID_TOKEN_PATTERN` arm
  `^\[keyword:owned-card-koed\]$`; one `dkcy` entry in `hero-ability-markers.json`
  (`heroSlug: "bishop"`, `cardSlug: "absorb-energies"`, `abilityIndex: 0`); regenerate `dkcy.json`.
- **Parser.** `HERO_PARSER_RECOGNIZED_MARKER_NAMES` gains `owned-card-koed`; a parser arm beside
  `defeated-villain-or-mastermind` pushes `{ type: OWNED_CARD_KOED_CONDITION_TYPE, value: '1' }`. The
  line's `+2[icon:recruit]` stays the hook's `recruit:2` effect.
- **Condition.** `OWNED_CARD_KOED_CONDITION_TYPE = 'ownedCardKoedThisTurn'`, exported from
  `hero/heroConditions.evaluate.ts` beside `CARDS_DISCARDED_THIS_TURN_CONDITION_TYPE` and imported by
  `deferredConditionalGrants.ts` and `heroAbility.setup.ts` (defining it in `deferredConditionalGrants.ts`
  would make `heroConditions.evaluate.ts` import it back — a load-order cycle that throws on the
  `MASTER_STRIKE_*` bindings `WAIT_AND_SEE_CONDITION_TYPES` reads at top level). Added to
  `WAIT_AND_SEE_CONDITION_TYPES`.
  `evaluateCondition` case: `(G.ownedCardsKoedSinceResolve?.[playerID] ?? 0) > 0`.
  `describeFailedCondition` case: `'it needs a card you own to be KO\'d this turn'`.
- **Signal.** `LegendaryGameState.ownedCardsKoedSinceResolve?: Record<string, number>` — KOs of each
  player's own cards since the last resolve. Written only by `recordOwnedCardKoed(G, ownerPlayerID)`
  (`hero/deferredConditionalGrants.ts`), which returns at once unless `G.deferredConditionalGrants`
  holds an entry whose hook (`G.heroAbilityHooks[entry.hookIndex]`) carries
  `OWNED_CARD_KOED_CONDITION_TYPE`; otherwise lazily creates the map and adds 1 for that owner.
- **Firing.** One helper `hookHasConditionType(hook, conditionType): boolean` replaces
  `hookHasRepeatableDefeatCondition`. In `resolveDeferredHeroGrants`, the fire callback runs
  `runHookEffects` once per counted KO for a hook carrying the owned-KO condition (`repeatCount =
  Math.max(1, G.ownedCardsKoedSinceResolve?.[entry.playerId] ?? 0)`; 1 for every other hook), then
  re-arms when the hook carries either repeatable type (defeat or owned-KO). After the resolution,
  `delete G.ownedCardsKoedSinceResolve` (guarded), beside the defeat-flag delete.
- **Owned-KO hooks always defer at play.** The printed trigger starts when the card is played.
  Without this, a counter already above 0 at play (a KO earlier in the same move, possible only via a
  Steal Abilities / Copy Powers pass while another owned-KO grant waits) would pass the condition at
  once, fire once, record nothing and miss every later KO. Locked shape, in `executeHeroEffects`'s
  hook loop after `isCountableConditionalClause` and before `if (!evaluateAllConditions(…))`:
  - **Guard:** the hook has a condition of `OWNED_CARD_KOED_CONDITION_TYPE` **and**
    `evaluateAllConditions(G, playerID, <its conditions minus that one>, cardId)` is true. If any
    other condition fails, fall through to today's path unchanged (that gate's own blocked or
    waiting line).
  - **Record:** `recordDeferredConditionalGrant(G, playerID, cardId, G.heroAbilityHooks.indexOf(hook))`
    — the same `hookIndex` the existing wait-and-see branch uses.
  - **Log:** the existing "… ability is waiting — {reason}.{waitingOutcome}" line with `'neutral'`
    outcome and the same `hollowBodyNote` / `waitingOutcome` tail, where reason =
    `describeFailedCondition(G, playerID, <the owned-KO condition>)` called directly (not
    `findFailedCondition`, which returns `undefined` when the counter is above 0).
  - **Tally:** `continue` exactly where the existing wait-and-see branch does, so the WP-708
    conditional-clause tally matches today's waiting behaviour.
  - The defeat family (Diamond Form, Hawkeye, War Machine, Snarling Fangs) is NOT included: its flag
    is set only by the fight moves and consumed in the same move, so it is never set at play, and
    Snarling Fangs under Sunlight must keep its pinned "did not activate — it isn't Moonlight" line
    (`heroEffects.execute.test.ts`, D-24598).
- **KO sites.** Each OWNED site in §Context calls `recordOwnedCardKoed(G, <owner>)` right after its
  `koCard` / `moveCardFromZone` into `G.ko`, once per card. Where the helper has no owner id in
  scope (`applyRevealKo`, `koSingleTarget`), the owner is threaded in as a new parameter from its
  callers. NOT OWNED sites are unchanged.
- **Turn boundary.** `game.ts` `turn.onBegin` and `simulation/onBeginParity.ts` gain a guarded
  `delete` of the field beside the defeat-flag delete.
- **Drift pin** (in `hero/ownedCardKoTrigger.test.ts`). It scans every non-test `.ts` file under
  `packages/game-engine/src/` and builds a map keyed `<path relative to src>#<enclosing function>`
  → `{ koSites, ownedRecords }`, where a match belongs to the nearest preceding `function <name>(`
  declaration (`export` / `async` prefixes allowed). KO sites = `koCard(` calls plus
  `moveCardFromZone(` calls whose second argument is `G.ko` / `gameState.ko`; records =
  `recordOwnedCardKoed(` calls. Entries with 0/0 are omitted, and the test asserts
  `deepEqual(scannedMap, LOCKED_TABLE)` over the whole scan (the EC's per-function table), so a KO
  site in an unlisted file or function, or a recorder at the wrong site of a mixed file, fails. The
  matcher strips `//` and `/* */` comments first, skips the `function koCard(` /
  `function recordOwnedCardKoed(` definitions, and matches `moveCardFromZone(` across newlines
  (`rules/tacticHandlers.ts` spans lines). Non-vacuous cases: synthetic source proving it catches
  `koCard(`, a single-line and a multi-line `moveCardFromZone(…, G.ko, …)`, ignores a commented one,
  and attributes a recorder placed in the wrong function to that function (map differs). Precedent:
  the WP-498 hand→discard drift-guard, `moves/discardFromHand.test.ts`.
- **Coverage regen:** `ledger:heroes`, `effect-index`, `mechanics:metadata`, `sim:runtime-observed`,
  `sim:coverage --update-baseline`, the dashboard in-play pin if it moves; a
  `mechanic-provenance.json` row for `owned-card-koed`; a pending `live-verify.json` row keyed
  `dkcy/bishop|owned-card-koed` (the WP-844 row shape).
- **Tests** (new `hero/ownedCardKoTrigger.test.ts` unless noted). Hooks are built with the setup
  parser from the real dkcy line + marker, never a hook-less fixture. Cases: parse (condition + only
  a gated `recruit:2`, no unconditional effect); play gives 0 Recruit and logs the waiting line;
  play Absorb, then Whatever the Cost's KO through `resolveOptionalKoReward` (the live-evidence path)
  gives +2; a `resolveKoDiscardChoice` KO gives +2; a second KO move gives +2 more; a non-KO move
  after a KO gives nothing; one move KOing 3 owned cards gives +6; two Absorb copies and one KO give
  +4; a KO before the play gives nothing; another player's card KO'd (Red Skull strike, active player
  holding no Hero so only the other seat loses one) gives the active player nothing AND, after the
  KO and before the resolve, `deepEqual(G.ownedCardsKoedSinceResolve, { '1': 1 })` (proves the site
  records, routed to the owner); a counter already above 0 at play still records the grant
  (always-defer); an HQ KO (`koFromHq`) and a Victory-Pile KO give nothing AND, right after the KO
  and before the resolve, `G.ko` grew by 1 and `Object.hasOwn(G, 'ownedCardsKoedSinceResolve')` is
  false; the turn boundary clears entry and counter; with no pending owned-KO grant a KO (`G.ko`
  grew by 1) leaves no `ownedCardsKoedSinceResolve` key (`Object.hasOwn`). Real-hook wiring (`game.test.ts`, the `cardsDiscardedThisTurn` precedent): the per-move
  consume driven through the real `LegendaryGame` play-phase `turn.onMove`, and the turn-boundary
  delete through the real `turn.onBegin`. Pins: `hero/deferredConditionalGrants.test.ts` — the list
  `deepEqual` and a new `TRUTHY_FIXTURE` entry for the evaluator lockstep (both required); onBegin
  parity deletes the field (`simulation/onBeginParity.test.ts`); the KO-site drift pin. Expected
  unchanged: the disjointness test (`hero/heroConditions.evaluate.test.ts`) and the
  `HERO_PARSER_RECOGNIZED_MARKER_NAMES` arm test (`setup/heroAbility.setup.test.ts`), which iterates
  the list on its own.

## Out of Scope

- `dstr/doctor-voodoo/posessed-by-brothers-spirit` and `wwhk/miek-the-unhived/endless-appetite`
  (same trigger family, different filters / reward shapes; follow-up WPs listed in §Context).
- Turn-total "KO'd this turn" readers (Upper Hand, Unstoppable Force, Ravenous Greed, Feast
  transforms, Rise from the Ashes, Reincarnating Phoenix) — different primitives.
- Victory Pile KOs (RS-1 default). Mastermind / scheme KO rules (Omega Red).
- Any new hero keyword, handler, pending choice, move, `CORE_MOVE_NAMES` entry, or UIState field.
- A per-grant baseline: a KO earlier in the **same move** as an Absorb play (possible only when a
  Steal Abilities / Copy Powers pass plays Absorb after an auto-KO, with an owned-KO grant already
  waiting) is counted at that move's resolve for the new copy too (+2 extra). Accepted: the
  always-defer lock keeps that copy armed for every later KO, which is the part that matters.
- A KO caused by a grant fired inside the resolution itself is consumed by the post-resolve delete.
  A corpus scan of every wait-and-see-gated hook finds none that auto-KOs during the resolve; the
  KO-bearing ones (Snarling Fangs, Stolen Necroblaster, Radioactive Riot, Bloodstone Pendant) park a
  choice that resolves in a later move.
- `replay/replay.execute.ts` keeps its D-24322 posture (no deferred-grant lifecycle; D-24467 parity).

## Files Expected to Change

- `packages/game-engine/src/hero/deferredConditionalGrants.ts` — **modified** — list entry,
  `recordOwnedCardKoed`.
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — condition const +
  evaluate + describe cases.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — owned-KO always-defer at play,
  per-KO firing, `hookHasConditionType`, consume; four OWNED KO sites (`applyRevealKo` owner param).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — marker name + parser arm.
- `packages/game-engine/src/types.ts` — **modified** — `ownedCardsKoedSinceResolve?`.
- `packages/game-engine/src/game.ts` — **modified** — onBegin guarded delete (01.5 runtime wiring).
- `scripts/hero-mechanic-ledger.mjs` — **modified** — `KNOWN_CONDITIONS` gains
  `'owned-card-koed': 'ownedCardKoedThisTurn'` (else the ledger row reads `unsupported`).
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — mirrored delete.
- OWNED KO sites — **modified** — one recorder call each: `moves/healWounds.ts`,
  `moves/koDiscardChoice.resolve.ts`, `moves/koHeroChoice.resolve.ts`,
  `moves/melterKoChoice.resolve.ts`, `moves/optionalKoReward.resolve.ts`,
  `moves/revealThreeAssign.resolve.ts`, `moves/revealTopDispose.resolve.ts`,
  `moves/ruthlessDictatorChoice.resolve.ts`, `moves/scryKoChoice.resolve.ts`,
  `moves/seatChoiceTactics.ts`, `moves/operatorSetters.ts`, `rules/mastermindHandlers.ts`,
  `villain/villainEffects.execute.ts` (`koSingleTarget` owner param).
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — token arm.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — one dkcy entry.
- `data/cards/dkcy.json` — **modified (generated)**.
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
  `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`,
  `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`,
  `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json`,
  `apps/dashboard/src/data/*` coverage copies the regen rewrites; `apps/dashboard/src/composables/useInPlayCoverage.test.ts`
  (in-play pin, only if it moves).
- Tests: `packages/game-engine/src/hero/ownedCardKoTrigger.test.ts` (new),
  `hero/deferredConditionalGrants.test.ts`, `simulation/onBeginParity.test.ts`, `game.test.ts`;
  `hero/heroConditions.evaluate.test.ts` and `setup/heroAbility.setup.test.ts` only if a pin there
  moves (expected unchanged).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24789),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets, no "changed section
  only" output; ESM only; Node v22+; human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness added; no `Math.random()`, clocks or I/O; moves never throw; `for`
  loops, no `.reduce()` in the firing or recorder.
- `G` stays JSON: the counter is a plain `Record<string, number>`, created lazily, written only
  while an owned-KO grant waits; in live `turn.onMove` / `turn.onBegin` and the sim / PAR / fixture
  mirrors it is deleted after every resolve and at the turn boundary. `replay/replay.execute.ts`
  (D-24322) runs neither, so it accumulates there by design — do not "fix" that harness.
- A game in which no Absorb Energies grant is waiting never gains the field, so the `finalStateHash`
  sentinels serialize byte-identically — **no re-pin**. If a sentinel hash moves, STOP and report.
- Card data via the marker source + reproducible regen (`cards:check`); never hand-edit `dkcy.json`.
- No per-card special-casing in the parser or executor; no new hero keyword.

**Session protocol:** if the parsed Absorb hook still carries an unconditional `recruit` effect
after the marker, or `describeFailedCondition` has no case (the waiting line reads the generic
fallback), STOP and report.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `OWNED_CARD_KOED_CONDITION_TYPE = 'ownedCardKoedThisTurn'` (wait-and-see, repeatable per KO).
- `recordOwnedCardKoed(G: LegendaryGameState, ownerPlayerID: string): void` — gated lazy increment.
- `G.ownedCardsKoedSinceResolve?: Record<string, number>` — per-owner KO count since the last
  resolve; absent when none.
- Marker `[keyword:owned-card-koed]` → that condition on the line's hook.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10,
§22 (Deterministic & Reproducible Evaluation).
- **No conflict:** a printed trigger that over-fires today resolves as printed.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — a printed hero ability, nothing bought.
- **Determinism preservation:** no randomness; in live play and the sim / PAR / fixture mirrors the
  counter lives only inside a move and is consumed before the move boundary (the D-24322 replay
  harness runs no resolve, by design); absent for every game with no waiting Absorb grant, so the sentinels
  are byte-identical. Seed-PAR is scheme-keyed and hero-agnostic. Replays of pre-WP-853 matches that
  played Absorb Energies diverge on re-execution (the +2 moves from play to KO); stored
  `competitive_scores` rows are frozen, not re-verified (the D-24616 §5 / D-24600 precedent).

## Funding Surface Gate

N/A — no UI, copy, nav or funding surface; a hero ability's engine behaviour and one log line.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Playing Absorb Energies adds 0 Recruit and logs the waiting line naming "a card you own".
2. Each card the player owns KO'd from hand, deck, discard or play after that, the same turn, adds
   +2 Recruit per Absorb Energies played — including several KOs in one move (+2 each).
3. A move with no owned KO adds nothing; a KO before the play adds nothing.
4. KOs of another player's cards, HQ cards, City / Villain-Deck cards and Victory-Pile cards add
   nothing to the active player.
5. The next turn starts with no waiting grant and no counter.
6. With no owned-KO grant waiting, a KO leaves `G` without `ownedCardsKoedSinceResolve`.
7. The drift pin fails on an added, unclassified KO site (non-vacuous case passes).
8. `WAIT_AND_SEE_CONDITION_TYPES` pin and evaluator lockstep updated; the disjoint test still passes.
9. `cards:check` reproduces `dkcy.json`; ledger lists `owned-card-koed` for `dkcy/bishop` as
   `condition` (the sibling-marker status); every feed `:check` exits 0.
10. Engine suite green; `pnpm -r build` 0; `finalStateHash` sentinels unchanged with no pin edited.

## Verification Steps

Regenerate (in order, after the engine change builds):

- First add the `owned-card-koed` row to `scripts/coverage/mechanic-provenance.json` and the pending
  `dkcy/bishop|owned-card-koed` row to `docs/ai/coverage/live-verify.json` (`ledger:heroes` reads the
  provenance file; adding it later forces a second regen).
- `node scripts/convert-cards/apply-hero-ability-markers.mjs` — exits 0; only `dkcy.json` changes.
- `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
  `pnpm sim:coverage --update-baseline`, `pnpm --filter @legendary-arena/dashboard prebuild:coverage`
  — each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test` — green; every `finalStateHash` / sentinel assert
  (`game.test.ts`, `simulation/*Parity.test.ts`, `test/fixtures/replayFixtures.test.ts`,
  `test/fixtures/hashGameState.test.ts`, `simulation/seatChoiceDispatch.test.ts`,
  `simulation/simulation.captureMoves.test.ts`) passes with no pin literal edited.
- `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`,
  `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`.
- `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `node scripts/check-number-ledger.mjs --check` — at govern-close.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + dashboard suites green; `pnpm -r build` 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance row added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a real match plays Absorb Energies, then KOs one card (Whatever
      the Cost) and, in a later turn, several in one move; Recruit rises +2 per KO and not on play —
      confirmed live, or left open as operator-pending in `docs/ai/STATUS.md` with the pending
      `live-verify.json` row.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24789 → Active;
      `docs/ai/work-packets/WORK_INDEX.md` checked; `docs/ai/execution-checklists/EC_INDEX.md` Done;
      mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` were modified — `git diff --name-only
      origin/main...HEAD` checked against that list.

## Reserved Decision (lands at execution)

D-24789 — "Whenever a card you own is KO'd this turn, <reward>" is the `ownedCardKoedThisTurn`
wait-and-see condition (marker `owned-card-koed`) on the line's own reward effect. It extends the
D-24467 edge + re-arm to a per-owner KO **count**: every KO site that takes a card from a player's
hand, deck, discard or cards in play records the owner (gated on a waiting owned-KO grant), the
resolve fires the grant once per counted KO and deletes the count. "A card you own" = those four
zones; HQ, City, Villain Deck, Escape Pile and (RS-1) Victory Pile never count. A per-function KO-site
pin keeps the site set closed. A hook carrying the owned-KO condition always defers at play when its other conditions pass.
Contract: `LegendaryGameState.ownedCardsKoedSinceResolve?: Record<string, number>` — lazy, gated on a
waiting owned-KO grant, deleted after each resolve and at `turn.onBegin` / `applyOnBeginParity`, never
set in `Game.setup`. `replay.execute.ts` (D-24322) runs no resolve and no clear, so the count
accumulates there by design — the same posture as the defeat flag.
Replays of pre-WP-853 Absorb Energies matches diverge; stored competitive rows stay frozen (D-24616 §5).

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1:** NOT READY — PS-1 (34 KO sites, not 37; per-file table locked in the EC),
  PS-2 (constant moved to `heroConditions.evaluate.ts` to avoid a load-order cycle), PS-3
  (`scripts/hero-mechanic-ledger.mjs` `KNOWN_CONDITIONS`; AC-9 reads `condition`). RS-1 matcher
  rules, RS-2 real-hook `game.test.ts` cases, RS-3 always-defer at play, RS-4 Red Skull fixture +
  `resolveOptionalKoReward` case, RS-5 Vision §8/§22 + frozen rows, RS-6 one helper name, RS-7 the
  two required `deferredConditionalGrants.test.ts` edits, RS-8 the resolve-KO scan. All folded in.
- **Pre-flight round 2:** NOT READY — PS-1: always-defer for every repeatable type would arm Snarling
  Fangs under Sunlight (pinned test, D-24598), change the WP-708 tally and lose the waiting reason.
  Narrowed to the owned-KO type only, guarded on the hook's other conditions, with the record index,
  log reason and tally `continue` locked. RS-1: Lint §17 clause list synced. Verdict after the fold:
  **READY TO EXECUTE** (the fix narrows the lock without changing scope).
- **Copilot round 1:** RISK → HOLD, seven scope-neutral fixes, all folded in: owner-routing tests
  assert the counter before the resolve (and `G.ko` growth on the negative cases); the drift pin is
  per enclosing function with a whole-scan `deepEqual`, living in `ownedCardKoTrigger.test.ts`;
  the determinism claim is scoped to live play + mirrors, with the D-24322 replay posture stated in
  D-24789; D-24789 names the `types.ts` field; provenance / live-verify rows precede the regen; the
  WORK_INDEX row says 25 OWNED of 34. Verified correct: 34/25 site counts, all 25 owners, no
  post-resolve owned KO in onMove, sim/PAR/fixture mirroring, no sentinel uses Bishop, no import
  cycle via `heroConditions.evaluate.ts`. **Copilot round 1: RISK → HOLD (7 fixes folded).**
- **Copilot round 2:** **PASS → CONFIRM** — all seven fixes verified; the per-function table matches the code (32 keys, 34 sites); READY unaffected (no allowlist, source-file or contract change). Two wording nits (per-file → per-function; this verdict label) fixed in place.

## Lint Gate Self-Review (00.3)

- **§1 structure:** all template sections present; Out of Scope names the two sibling cards, the
  turn-total neighbours, the Victory Pile, and the accepted same-move edge. **PASS.**
- **§2 constraints:** full-file output, ESM, Node v22+, `00.6-code-style.md` cited; determinism and
  the session protocol stated. **PASS.**
- **§3 Assumes:** every file, helper and decision cited with its role; baseline named. **PASS.**
- **§4 Context:** evidence log, observed parse, rules-glossary gap, the 34-site table, the corpus
  scan, 00.2 §5 / §5.1, DECISIONS scan list, 00.6. **PASS.**
- **§5 files:** every file listed with role and full path; ~22 hand-edited source files, justified
  in §Context (a partial site set ships a trigger that misses KOs). **PASS.**
- **§6 naming:** full words (`ownerPlayerID`, `ownedCardsKoedSinceResolve`); `KO` per the rules
  text; no renamed 00.2 field. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine-only plus card data; no registry
  import in the engine; no server or client change. **PASS.**
- **§9:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; real parsed hooks; `Object.hasOwn` key checks; no
  `boardgame.io` import in the helper. **PASS.**
- **§13 verification:** every step an exact command with its expected exit. **PASS.**
- **§14 / §15:** 10 binary criteria; DoD names STATUS / DECISIONS / WORK_INDEX / EC_INDEX / D-24026.
  **PASS.**
- **§16 code-style:** reuse of the deferred-grant path, one small helper, `for` loops, `// why:` on
  the recorder gate, the per-KO loop, the re-arm, each threaded owner parameter. **PASS.**
- **§17 Vision:** clauses §1/§2/§8/§10/§22, no-conflict line, NG-1 line, determinism line. **PASS.**
- **§18:** no literal-grep verification step (the drift pin is a test). **N/A.** **§19:** commit-time
  rule. **N/A.** Contract files: `types.ts` gains one optional field, covered by D-24789.
- **§20 funding:** N/A with the statement above. **§21 API catalog:** N/A. **PASS.**
