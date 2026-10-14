# WP-806 — Operator setters: six operator-match-only moves that set up a board through the real paths

**Status:** Draft 2026-10-13 · **EC:** EC-843 · **Reserves:** D-24713 (reserve PR #2765, with WP-807 / EC-844)
**Primary Layer:** Game Engine (`packages/game-engine` only)
**User-Visible Surface:** none — infrastructure. The payoff is WP-807: the Tweakpane pane in the WP-804 operator panel
that submits these moves on play.legendary-arena.com. No client can submit them until WP-807 ships, so the D-24026
live verification of every setter runs under WP-807 §Verification.
**Lane:** standard two-session. Ineligible for the lightweight lane: a new contract file and a contract-file edit
(01.0a criteria 3, 4), a new `G` field and new moves on the determinism surface (criterion 6).
**Baseline:** `origin/main` @ `5b6a0634` (2026-10-13, #2764 the ewiki operator-panel page) plus the reserve commit
(#2765). Engine **5153 / 0** on that baseline after `pnpm install` + `pnpm -r build`.

## Goal

In an operator match (`G.isDebugMatch === true`), the operator can set up the board on their own turn, in the `main`
stage, with no choice open, through six new boardgame.io moves:

1. `operatorSetSupplyCount`: set the Wound, Bystander, S.H.I.E.L.D. Officer or Sidekick supply to a count. A decrease
   moves cards to a set-aside zone that no rule reads. An increase brings set-aside cards back.
2. `operatorMoveToDeckTop`: move a card already in the villain deck or the hero deck to its top.
3. `operatorRevealNow`: move the next Scheme Twist or Master Strike in the villain deck to the top and reveal it now,
   through the normal reveal path.
4. `operatorMoveCard`: move a card already in the match from one zone to another, over a closed route table, through
   the gain, discard and zone helpers. This includes placing a hero-deck card in an HQ space; the card it displaces goes
   to the bottom of the hero deck.
5. `operatorAddEconomy`: add Recruit or Attack for this turn.
6. `operatorEscapeVillain`: the Villain in the escape-edge City space escapes, through the normal escape path.

In any other match, every one of them returns without changing anything. Every setter writes a game-log line that
starts with "Operator:". Each one is an ordinary move, so it sits in the move log and the D-24119 replay re-runs it.

This is follow-on 2 of the WP-802 arc (`docs/ai/work-packets/WP-802-operator-board-inspection.md` §Arc), paired with
WP-807 (the client pane). D-24689 §7 fixed setters 1–4 and their rules. D-24713 (this packet) records the operator's
2026-10-13 rulings that extend §7: setters 5 and 6, the hero deck in setter 2, the HQ placement in setter 4, and the
set-aside zone's name and shape.

## User-Visible Impact

- **Today.** The operator can see the whole board (WP-802, WP-804) but can't set one up. D-24686 (the reveal-or-Wound
  log line when the Wound supply is empty) is still `pending` after three Cosmic Cube games, because a loadout can't
  start with fewer than 30 Wounds (`SUPPORT_COUNT_MINIMUMS.woundsCount`,
  `packages/registry/src/setupContract/setupContract.schema.ts`). The D-24684 Ymir chooser took four full games to get
  Ymir revealed and fought by the right seat.
- **After this packet and WP-807:**
  - D-24686: set the Wound supply to 0, put Ymir on top of the villain deck, play one turn.
  - D-24684: move Wounds into the bot's discard to build a most-Wounds tie, then put Ymir on top.
  - A Scheme Twist or Master Strike can be fired on demand instead of waited for.
  - A specific hero can be put in the HQ, or on top of the hero deck.
  - Recruit and Attack can be topped up to reach a fight.
  - An escape can be forced to test escape effects.
- **Business impact:** each card on the live-verify record still at `partial` or `pending`
  (`docs/ai/coverage/live-verify.json`) drops from several full games to one set-up game. That is the queue this
  shortens.

## Assumes

- **Dependencies (shipped):**
  - WP-802 / EC-839 / D-24689: #2699, live-verified. It ships `G.isDebugMatch` (`types.ts` L1777, written only at
    `setup/buildInitialGameState.ts` L649) and `buildOperatorView`.
  - WP-804 / EC-841: #2735 (`9cfd635d`). The panel exists. This packet does not touch it.
  - D-24697 (#2728); WP-803 / D-24692 (its `G.outOfTimeCards` is a different zone with a different name).
- **Move registration.** Every play-phase move is a top-level `LegendaryGame.moves` entry in the long form
  `{ move: fn, client: false }` (D-10008, `game.ts` L522–711). The play phase has no `moves:` key, and its turn sets
  `activePlayers: { currentPlayer: 'playTurn' }` (`game.ts` L793). There are **47** moves today.
  - `game.test.ts` L240–278 asserts the exact sorted set at L275 and `'LegendaryGame must define exactly 47 moves'` at
    L276.
  - The test title at L240 lists every name, and L244–274 is a changelog of "added X (N → N+1)" lines.
- **The simulation leaves moves out by precedent.** `recruitOfficer`, `dodgeCard`, `healWounds`, `phaseCard` and
  `endMatchEarly` are registered but are absent from `SIMULATION_MOVE_NAMES` (`simulation/ai.legalMoves.ts` L105–242)
  and from both `MOVE_MAP`s (`simulation/simulation.runner.ts` L333–423, `simulation/par.aggregator.ts` L490–565).
  - `simulation.moveDispatch.drift.test.ts` only checks `SIMULATION_MOVE_NAMES` ⊆ both maps (L28–55) and that the two
    maps match (L187–193). Nothing asserts that `LegendaryGame.moves` ⊆ `SIMULATION_MOVE_NAMES`.
  - `getLegalMoves` (`ai.legalMoves.ts` L406) builds its list explicitly. The bot-ally driver submits only moves from
    it, plus recovery `endTurn` / `advanceStage` (`apps/server/src/bot-ally/botAllyDriver.mjs` L256–298, L1306–1318).
  - So a setter that isn't listed is never made by a bot, a simulation or PAR.
- **No server move allowlist.** The D-24701 client-action guard admits any `MAKE_MOVE` (`apps/server/src/game/
  clientActionGuard.mjs` L46–51, L77–91). The faithful replay (`apps/server/src/replay/matchReplay.logic.ts`)
  re-dispatches every `MAKE_MOVE` through the real reducer. So no server file changes.
- **Pending choices.** `hasAnyPendingChoice(G)` (`moves/phaseCard.ts` L82–120) runs 32 checks: the 30 block-all
  `hasPending*` guards (`hasPendingSeatChoice` among them) and the two put-bottom-HQ guards.
  - It does **not** cover `G.pendingHeroChoice` (`types.ts` L1910). Callers check that separately
    (`villainDeck/villainEscapeProcedure.ts` L271, `moves/coreMoves.impl.ts` L614, `game.ts` L258).
  - `G.pendingDivingBlockWounds` (L2261) and `G.pendingEscapeProcedures` (L2270) are queues that `turn.onMove` opens
    into seat choices after each move. `G.pendingTeleportReturns` (L2238) is a set-aside list that lasts the turn, not
    a choice.
  - While a seat choice is open, a non-active seat is admitted into `resolvingSeatChoice`
    (`moves/seatChoice.resolve.ts` L90). That stage is empty, so the global move bag applies. A setter therefore checks
    `playerID === ctx.currentPlayer` itself.
- **Stage.** Non-core moves check `G.currentStage !== 'main'` with a literal (`recruitOfficer.ts` L176,
  `phaseCard.ts` L142). `TURN_STAGES` / `TurnStage` are at `turn/turnPhases.types.ts` L28–35.
- **Supplies** (`G.piles: GlobalPiles`, `state/zones.types.ts` L77–95). `bystanders`, `wounds`, `officers` and
  `sidekicks` are `CardExtId[]` with index 0 on top (`recruitOfficer.ts` L98–99). Their ids are fungible: `pile-wound`,
  `pile-bystander`, `pile-shield-officer`, `pile-sidekick` (`setup/pilesInit.ts` L22–43). `horrors` is empty in MVP and
  out of scope.
- **Decks.**
  - `G.villainDeck.deck` (top `deck[0]`, `villainDeck/villainDeck.types.ts` L56–61), with types in
    `G.villainDeckCardTypes`: `'villain' | 'henchman' | 'bystander' | 'scheme-twist' | 'mastermind-strike'`. The type
    map is the source of truth; scheme conversions rewrite it, so ext-id prefixes are not.
  - `G.heroDeck` (top `[0]`, bottom = end).
  - A player's deck is `G.playerZones[id].deck`, top `[0]` (`moves/drawCards.logic.ts` L77–83).
- **HQ and City.**
  - `G.hq: HqZone`, five `CardExtId | null` slots (`board/city.types.ts` L39, L47).
  - `G.city: CityZone`, five `CitySpace` slots. Space 4 is the escape edge: `pushVillainIntoCity` (`board/city.logic.ts`
    L55) ejects it as `escapedCard` when the City is full.
- **The paths the setters call:**
  - **Reveal:** `performVillainReveal(G, context: RevealContext, implementationMap)` (`villainDeck/villainDeck.reveal.ts`
    L219), with `RevealContext = { random: { Shuffle }, ctx: { currentPlayer, turn } }` (L94–99). It has no stage gate,
    doesn't touch `villainRevealedThisTurn`, and needs no events. The `revealVillainCard` move wraps it (L131, L192–196).
    The villain deck never reshuffles (D-24160).
  - **Escape:** `resolveVillainEscape(G, context: RevealContext, implementationMap, escapedCardId)` (`villainDeck.
    reveal.ts` L595) runs the whole escape:
    - the counter, `G.escapedPile` and bystander carry-away;
    - the owed HQ-KO / bystander-discard queue, which `turn.onMove` opens at `game.ts` L869;
    - `onEscape` effects, captured heroes, and the resource-loss check.
    It does **not** touch `G.city`; its callers clear the space first (`villainDeck.reveal.ts` L314,
    `villainDeck.enterCity.ts` L56).
  - **Implementation map:** `DEFAULT_IMPLEMENTATION_MAP` (`rules/ruleRuntime.impl.ts` L35).
  - **Wounds:** `gainWoundForPlayer(G, playerID)` (`board/wounds.logic.ts` L70). It also runs `checkDivingBlock`.
  - **Officers:** `gainOfficerToDiscard(G, playerID)` (`moves/recruitOfficer.ts` L120).
  - **Bystanders and Sidekicks:** no gain helper exists for either.
  - **Discard:** `discardFromHand(G, playerID, cardId)` (`moves/discardFromHand.ts` L198) is the hand→discard chokepoint,
    drift-guarded by `discardFromHand.test.ts` L134–150.
  - **Zones:** `moveCardFromZone(from, to, cardId)` (`moves/zoneOps.ts` L54) appends to the end (the **bottom** of a
    deck) and returns new arrays.
  - **Placing a card on top:** the existing idiom (`moves/putHandOnDeckTop.resolve.ts` L127–136) is
    `moveCardFromZone(source, [], cardId)` to remove it, then `deck = [cardId, ...deck]`.
  - **Test harness:** `makeMockMoveContext(G, { playerID, numPlayers })` (`test/mockMoveContext.ts` L71) sets
    `ctx.currentPlayer = playerID`. A real operator-match `G` is built by `buildInitialGameState(config with
    isDebugMatch: true, registry, makeMockCtx())`, as in `ui/operatorView.build.test.ts` L29–50.
  - **Economy:** `addResources(economy, attack, recruit)` (`economy/economy.logic.ts` L740). `G.turnEconomy` resets only
    at turn start (`game.ts` L963).
- **Logging.** `pushLog(G, message, outcome?, card?)` (`log/logPush.ts` L26–31) adds the `{turn}.{step}.{action}`
  prefix itself. `formatCardRef(G.cardDisplayData, extId)` is at `log/logDisplay.ts` L128.
- **Side effects of any play-phase move.** After every move, `turn.onMove` (`game.ts` L834–892) runs
  `latchFinalTurnIfDeckExhausted`, `applyPileDepletionResourceLoss`, `checkAndTransformScheme`,
  `resolveDeferredHeroGrants`, and the return-on-discard, escape-procedure and Diving Block openers. The top-level
  `endIf` (`game.ts` L502) runs too. A setter inherits all of this; that's intended (§Context).
- **Hash oracles.** `hashGameState` (`test/fixtures/hashGameState.ts` L72–116) and `computeStateHash`
  (`replay/replay.hash.ts` L67–81) hash a sort-keyed `JSON.stringify`, so an absent key is invisible to both. The
  sentinel `finalStateHash` (`test/fixtures/games/sentinel-core-doom-2p.replay.json` L3, `3a74c4a8…`) and
  `PRE_WP080_HASH = 'dae75521'` (`replay/replay.execute.test.ts` L188) cover matches that never write
  `operatorSetAside`, so neither moves.
- **Operator projection.** `OperatorView` / `OperatorSupplyCounts` (`ui/operatorView.types.ts`), `buildOperatorView`
  (`ui/operatorView.build.ts` L145, gate L151) and their tests (`ui/operatorView.build.test.ts`). The arena-client's
  WP-804 test fixture declares a full `OperatorBoardResponse` inline, so a **required** new `OperatorView` field would
  break `vue-tsc` there. The new field is optional (§Locked Contract Values).
- **No new dependencies.**

## Context (Read First)

**Why six moves and not one.** One `operatorSet({ kind, … })` move would make the drift pin cheaper. It would also make
every validator a branch on `kind`, and every log line and test a lookup. Six named moves read as the six things the
pane does, and each validator stays under a screen.

**Why the setters call the real paths.** The ewiki page's §Edge Cases rule is "prefer the real paths over raw writes"
(the Herbs vs. Ailments lesson: a board the rules can't reach finds bugs that aren't real). So:
- a Wound is gained through `gainWoundForPlayer` (Diving Block fires);
- a reveal goes through `performVillainReveal`, and an escape through `resolveVillainEscape`;
- a hand→discard goes through `discardFromHand`.
Where no helper exists (Bystander to a Victory Pile, Sidekick to a discard pile, a player's zone to another zone),
`moveCardFromZone` moves the card and nothing triggers. The log line names the route.

**What the setters inherit.** Because each is a play-phase move, `turn.onMove` and the top-level `endIf` run after
it. A setter that empties the hero deck latches the final turn. One that empties a pile a scheme counts can end the
game. Revealing the eighth Scheme Twist can lose it. That's the real board responding, which is the point of a
setter, and the log shows the operator line that caused it.

**Randomness.** D-24689 §7 says setters use no `ctx.random` (reorder, never re-roll). Setters 1, 2, 4 and 5 never
read `random`. Setters 3 and 6 hand the move's `random` to the normal reveal and escape paths, which draw from it
exactly as they do in play: a twist effect that shuffles still shuffles. D-24713 §3 records that reading of §7. The
setter's own code chooses no card by chance.

**Why the set-aside zone is per pile.** All four supplies use fungible ids, so a flat list could recover the pile from
the id. A record keyed by pile says which supply a card came from without relying on that, and the operator view can
show a count per pile. `G.operatorSetAside` is omitted until the first decrease, so every normal match and every hash
oracle stays byte-identical. No rule reads it (D-24689 §7).

**Why setter 4 has a closed route table.** "Any zone to any zone" lets the operator build a board the rules can't, for
example a card in play whose effects never resolved. The table allows the routes the incidents need:
- a gain from a supply;
- a KO from any zone a player owns;
- a move between a player's hand, deck top, discard and Victory Pile;
- a hero-deck card into an HQ space.
"Draw a card" is the deck-top card moved to the hand. "KO a card" is the KO route. Everything else returns silently.

**Why the HQ displacement goes to the hero-deck bottom.** That's where the cards that already "put a Hero from the HQ
on the bottom of the Hero Deck" send one (`resolveOptionalPutBottomHQ.ts` L145–148). It conserves every card, and it
doesn't refill anything: the placed card fills the space.

**Read:**
- WP-802 in full (§Arc, §D-24689 Content), WP-804 §Locked Contract Values (the panel's `OperatorView` use), and
  `docs/ai/DECISIONS.md` D-24689 (§1, §4, §6, §7), D-24026, D-24119, D-24160, D-10008, D-24697. Scan for later
  entries on `hasAnyPendingChoice` and the escape procedure.
- `docs/ai/ARCHITECTURE.md`: §The Move Validation Contract, §Zone Mutation Rules, §Villain Deck Authority Boundary,
  §Canonical Reveal → Fight → Side-Effect Ordering, §Persistence Boundary (Cross-Layer), and Section 1 §Layer Boundary
  (Authoritative).
- `.claude/rules/architecture.md` (Determinism; Move & Phase Rules; Layer Boundary) and
  `.claude/skills/legendary-game-engine/SKILL.md`.
- `.claude/rules/code-style.md` §Drift Detection: engine drift pins are runtime assertions (WP-563 / D-24372).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 (Match Configuration): `MatchSetupConfig` and the creation payload
  are untouched. The new field is runtime `G` only.
- `wiki/why-play-needs-a-debug-panel.md`: §What it lets an operator do, §Guardrails, §Edge Cases, §Ideas … reconciled,
  and Open Question 7.

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test`; no `boardgame.io/testing` import.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`:
  - full-word names; booleans start with `is` / `has` / `can`;
  - JSDoc on every function; functions ~30 lines max;
  - no nested ternaries, no `.reduce()` in zone or effect code, no `import *`, no new barrel;
  - full-sentence messages; `// why:` on every non-obvious rule.
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- Determinism: no `Math.random()`, no clock reads, no I/O in a move. Zones hold `CardExtId` strings only.
- Moves never throw (Move Validation Contract). Only `Game.setup()` throws.
- No commit subject may contain a `.githooks/commit-msg` Rule 1 token (case-insensitive WIP, fix stuff, misc, tmp,
  updates, changes, debug). `isDebugMatch` trips it; write "operator match".

**Packet-specific:**
- Every setter returns `void` without touching `G` unless **all** hold:
  - `G.isDebugMatch === true`;
  - `playerID === ctx.currentPlayer`;
  - `G.currentStage === 'main'`;
  - no choice is open (`isOperatorChoiceOpen(G) === false`).
- A setter never creates or destroys a card and never names one outside the match. Every card it moves is found in its
  source zone first; a missing card returns silently.
- Setters 1, 2, 4 and 5 never read `random`. Setters 3 and 6 pass the move's `random` only to `performVillainReveal` /
  `resolveVillainEscape`.
- No setter is added to `SIMULATION_MOVE_NAMES`, either `MOVE_MAP`, `getLegalMoves`, `replay/replay.execute.ts` or
  `test/fixtures/runFixture.ts`. Bots never make them.
- `G.operatorSetAside` is written only by `operatorSetSupplyCount`, omitted until its first decrease, and read only by
  that setter and `buildOperatorView`. No rule, no `UIState` builder, no scoring code reads it.
- No `UIState` field, no `playerView` change, no server, client, registry or persistence change.
- Hand→discard goes through `discardFromHand`. No new `moveCardFromZone(<x>.hand, <y>.discard` idiom anywhere.
- **Two style rules, applied here:**
  - **Keyed access.** Setters may index `G.piles[pile]`, `G.operatorSetAside[pile]` and `G.playerZones[id][zone]` with
    a key that the step-1 validator has already confirmed is a member of its closed union, as `G.villainDeckCardTypes[id]`
    does. That isn't "dynamic access for known keys".
  - **Writes outside `zoneOps`.** Setter 1's multi-card move between a pile and its set-aside and R4's `G.hq[i]` write
    happen outside `zoneOps`. They follow the `gainOfficerToDiscard` (pile slice) and `resolveOptionalPutBottomHQ` (HQ
    write) precedents. Every single-card zone removal still uses `moveCardFromZone`.

**Session protocol:** Read the EC, then this WP, then WP-802. Run the baseline before editing. STOP and report, without
guessing, if:
- anything is unclear;
- a baseline differs from §Assumes (move count 47, engine 5153 / 0, the anchors above);
- a file outside the allowlist would need to change;
- either hash oracle moves.

## Locked Contract Values

- **New contract file** `packages/game-engine/src/moves/operatorSetters.types.ts`:
  - `export type OperatorSupplyPile = 'wounds' | 'bystanders' | 'officers' | 'sidekicks';`
  - `export const OPERATOR_SUPPLY_PILES: readonly OperatorSupplyPile[] = ['wounds', 'bystanders', 'officers', 'sidekicks'];`
  - `export type OperatorDeckName = 'villain' | 'hero';`
  - `export type OperatorRevealCardType = 'scheme-twist' | 'mastermind-strike';`
  - `export type OperatorEconomyResource = 'attack' | 'recruit';`
  - `export const OPERATOR_ECONOMY_MAX_AMOUNT = 20;`
  - `export type OperatorPlayerZoneName = 'hand' | 'deck' | 'discard' | 'inPlay' | 'victory';`
  - `export type OperatorZoneRef = { zone: OperatorPlayerZoneName; playerId: string } | { zone: 'ko' } | { zone: 'heroDeck' } | { zone: 'hq'; hqIndex: number } | { zone: 'supply'; pile: OperatorSupplyPile };`
  - `export interface OperatorSetSupplyCountArgs { pile: OperatorSupplyPile; count: number }`
  - `export interface OperatorMoveToDeckTopArgs { deck: OperatorDeckName; cardId: CardExtId }`
  - `export interface OperatorRevealNowArgs { cardType: OperatorRevealCardType }`
  - `export interface OperatorMoveCardArgs { cardId: CardExtId; from: OperatorZoneRef; to: OperatorZoneRef }`
  - `export interface OperatorAddEconomyArgs { resource: OperatorEconomyResource; amount: number }`
  - `export type OperatorEscapeVillainArgs = Record<string, never>;`
  - `export type OperatorSetterMoveName = 'operatorSetSupplyCount' | 'operatorMoveToDeckTop' | 'operatorRevealNow' | 'operatorMoveCard' | 'operatorAddEconomy' | 'operatorEscapeVillain';`
  - `export const OPERATOR_SETTER_MOVE_NAMES: readonly OperatorSetterMoveName[] = ['operatorSetSupplyCount', 'operatorMoveToDeckTop', 'operatorRevealNow', 'operatorMoveCard', 'operatorAddEconomy', 'operatorEscapeVillain'];`
- **`G` field** (`types.ts`, on `LegendaryGameState`, beside `isDebugMatch`):
  `operatorSetAside?: { wounds?: CardExtId[]; bystanders?: CardExtId[]; officers?: CardExtId[]; sidekicks?: CardExtId[] };`
  - It is absent until the first decrease.
  - A pile's key is created on its first decrease and kept, even when it empties.
- **Gate** (`moves/operatorSetters.logic.ts`):
  - `const OPERATOR_SETTER_STAGE: TurnStage = 'main';`
  - `export function isOperatorChoiceOpen(G: LegendaryGameState): boolean`. True when any of these holds:
    - `hasAnyPendingChoice(G)`;
    - `G.pendingHeroChoice !== undefined`;
    - `(G.pendingDivingBlockWounds?.length ?? 0) > 0`;
    - `(G.pendingEscapeProcedures?.length ?? 0) > 0`.
    `pendingTeleportReturns` is **not** a choice and doesn't block.
  - `export function canRunOperatorSetter(G: LegendaryGameState, currentPlayer: string, playerID: string): boolean`.
    True only when `G.isDebugMatch === true`, `playerID === currentPlayer`,
    `G.currentStage === OPERATOR_SETTER_STAGE` and `!isOperatorChoiceOpen(G)`.
- **Move order** (each setter in `moves/operatorSetters.ts`, signature `({ G, ctx, playerID, ...context }: MoveContext,
  args: unknown) => void`, the `revealVillainCard` / `phaseCard` context pattern):
  1. validate the args, without destructuring them in the parameter list, because an `undefined` payload must not
     throw. Check:
     - `typeof args === 'object' && args !== null`;
     - every nested ref (`from`, `to`) passes `typeof === 'object' && !== null` before any of its fields is read;
     - `cardId` passes `typeof === 'string'`;
     - every union-typed field is a member of its closed set;
     - every number passes `Number.isInteger`;
     - every player id passes `Object.hasOwn(G.playerZones, id)`, so a client-sent `'constructor'` can't reach
       `Object.prototype`.
  2. `canRunOperatorSetter(G, ctx.currentPlayer, playerID)`;
  3. state preconditions (the card or Villain is where the args say);
  4. mutate through helpers and `pushLog`.
  Any failure at steps 1–3 returns `void` with `G` untouched.
- **Setter 1 — `operatorSetSupplyCount({ pile, count })`.**
  - `count` must be a non-negative integer, with `count ≤ G.piles[pile].length + (G.operatorSetAside?.[pile]?.length ?? 0)`.
  - **Decrease:** the top `current − count` cards (index 0 first) move, in order, to the end of `operatorSetAside[pile]`.
  - **Increase:** `count − current` cards move one at a time from the **end** of `operatorSetAside[pile]`, each
    prepended to the pile (`pile = [card, ...pile]`). A decrease followed by an equal increase restores the original
    order.
  - **Equal:** returns silently, with no log line.
  - Log: `Operator: ${PILE_LABEL} supply set to ${count} (was ${current}).`
    `PILE_LABEL = { wounds: 'Wound', bystanders: 'Bystander', officers: 'S.H.I.E.L.D. Officer', sidekicks: 'Sidekick' }`.
- **Setter 2 — `operatorMoveToDeckTop({ deck, cardId })`.**
  - The source is `G.villainDeck.deck` (`'villain'`) or `G.heroDeck` (`'hero'`).
  - The card's first occurrence is removed with `const moveResult = moveCardFromZone(deck, [], cardId)`, then
    `deck = [cardId, ...moveResult.from]`. Prepend to the removal result, never to the original array, or the card is
    duplicated.
  - Already at index 0, or absent: return silently.
  - Log: `Operator: ${cardRef} moved to the top of the ${'Villain' | 'Hero'} Deck.`
- **Setter 3 — `operatorRevealNow({ cardType })`.**
  - Find the first index `i` in `G.villainDeck.deck` with `G.villainDeckCardTypes[deck[i]] === cardType`. None: return
    silently.
  - Move that card to the top with the same remove-and-prepend idiom, then `pushLog` `Operator: revealing ${cardRef}
    now.`
  - Then call `performVillainReveal(G, { random: context.random, ctx: { currentPlayer: ctx.currentPlayer, turn:
    ctx.turn } }, DEFAULT_IMPLEMENTATION_MAP)`.
  - `G.villainRevealedThisTurn` is not touched.
- **Setter 4 — `operatorMoveCard({ cardId, from, to })`.** These routes are allowed; any other pair returns silently.
  - **R1, a gain from a supply:**
    - `{supply wounds}` → `{discard, p}`: `gainWoundForPlayer(G, p)`. `cardId` must be the pile's top card.
    - `{supply officers}` → `{discard, p}`: `gainOfficerToDiscard(G, p)`. `cardId` must be the pile's top card.
    - `{supply sidekicks}` → `{discard, p}` and `{supply bystanders}` → `{victory, p}`: `moveCardFromZone`.
  - **R2, a KO:** `{hand | deck | discard | inPlay | victory, p}` → `{ko}`, via `moveCardFromZone` into `G.ko`.
  - **R3, between player zones:** `{hand | deck | discard | inPlay | victory, p}` → `{hand | deck | discard | victory, q}`,
    where `p` and `q` may differ.
    - A `deck` destination puts the card on **top**: `source = moveCardFromZone(source, [], cardId).from`, then
      `deck = [cardId, ...deck]`, where `deck` is the destination deck. Source and destination are different zones, so
      nothing is duplicated.
    - `hand` → `discard` with `p === q` goes through `discardFromHand(G, p, cardId)`.
    - `hand` → `discard` with `p !== q` returns silently.
    - Every other pair uses `moveCardFromZone(source, destination, cardId)`. A same-zone, same-player pair returns
      silently.
  - **R4, a hero into the HQ:** `{heroDeck}` → `{hq, hqIndex}`, with `hqIndex` an integer 0–4.
    - The card's first occurrence leaves `G.heroDeck`, and `G.hq[hqIndex] = cardId`.
    - If the space held a card, that card is pushed to the **end** (bottom) of `G.heroDeck`. Nothing refills.
  - `playerId` / `p` / `q` must be a key of `G.playerZones`.
  - Log: `Operator: ${cardRef} moved from ${fromLabel} to ${toLabel}.`
    - Player-zone labels, in full: `Player ${p}'s hand`, `Player ${p}'s deck`, `Player ${p}'s discard pile`,
      `Player ${p}'s play area`, `Player ${p}'s Victory Pile`. A deck **destination** reads `the top of Player ${p}'s
      deck`.
    - Shared labels: `the KO pile`, `the Hero Deck`, `HQ space ${hqIndex + 1}`, `the ${PILE_LABEL} supply`.
    - R4 with a displaced card adds ` ${displacedRef} went to the bottom of the Hero Deck.`
- **Setter 5 — `operatorAddEconomy({ resource, amount })`.**
  - `amount` must be an integer from 1 to `OPERATOR_ECONOMY_MAX_AMOUNT`.
  - `G.turnEconomy = addResources(G.turnEconomy, attack, recruit)`, with the other resource 0.
  - Log: `Operator: +${amount} ${'Attack' | 'Recruit'} this turn.`
- **Setter 6 — `operatorEscapeVillain({})`.**
  - The payload must be a non-null object. Its keys are ignored.
  - The escape edge is `const OPERATOR_ESCAPE_CITY_INDEX = 4;`. If `G.city[4]` is `null`, return silently.
  - Otherwise `pushLog` `Operator: ${cardRef} escapes.`, clear the space (`G.city` copy with `[4] = null`), then call
    `resolveVillainEscape(G, { random: context.random, ctx: { currentPlayer: ctx.currentPlayer, turn: ctx.turn } },
    DEFAULT_IMPLEMENTATION_MAP, cardId)`.
- **Registration** (`game.ts`): six entries, `{ move: <fn>, client: false }`, keyed by the six names.
  - Move count **47 → 53**.
  - `game.test.ts`: the sorted array, the title and `'LegendaryGame must define exactly 53 moves'`, plus one changelog
    line ("added the six operator setters (47 → 53)").
- **Operator projection** (`ui/operatorView.types.ts` and `.build.ts`):
  - `OperatorView` gains the **optional** `readonly setAsideCounts?: OperatorSupplyCounts;`.
  - It is present only when `G.operatorSetAside` exists. Each count is that pile's array length, or 0.
  - It is omitted otherwise, so the WP-804 inline fixture still type-checks.
  - It is built with a conditional spread **inside** the returned object literal, as `uiState.build.ts` L2414 does.
    Assigning it afterwards won't compile: the fields are `readonly` and the project uses
    `exactOptionalPropertyTypes`.
- **Exports** (`index.ts`, the `.` surface):
  - types: `OperatorSupplyPile`, `OperatorDeckName`, `OperatorRevealCardType`, `OperatorEconomyResource`,
    `OperatorPlayerZoneName`, `OperatorZoneRef`, the six args types and `OperatorSetterMoveName`;
  - values: `OPERATOR_SUPPLY_PILES`, `OPERATOR_SETTER_MOVE_NAMES` and `OPERATOR_ECONOMY_MAX_AMOUNT`.
  The engine `.` surface stays free of `node:*`.

## Scope (In)

### A) Contract and gate
- `moves/operatorSetters.types.ts` (new): the §Locked contract.
- `moves/operatorSetters.logic.ts` (new): `isOperatorChoiceOpen`, `canRunOperatorSetter`, `PILE_LABEL`, the zone-label
  and zone-lookup helpers, and the route classifier for setter 4. Each is ~30 lines or less.

### B) The six moves
- `moves/operatorSetters.ts` (new): the six move functions, each following the locked move order.

### C) State, registration, projection, exports
- `types.ts`: `operatorSetAside?` with a `// why:` naming D-24689 §7 / D-24713 §5 and omit-when-off.
- `game.ts`: the six registrations, with a `// why:` saying they are operator-match-only and absent from the bot,
  simulation and fixture dispatch by design.
- `ui/operatorView.types.ts`, `ui/operatorView.build.ts`: `setAsideCounts?`.
- `index.ts`: the §Locked exports.

### D) Tests (new)
`moves/operatorSetters.test.ts` uses the harness below.
- `G` comes from `buildInitialGameState` with `isDebugMatch: true` (the `ui/operatorView.build.test.ts` L29–50
  pattern), then `G.currentStage = 'main'`. Zones are seeded per case.
- Each move is called with `makeMockMoveContext(G, { playerID: '0', numPlayers: 2 })`. That helper sets
  `ctx.currentPlayer = playerID`, so the "not your turn" case overrides `ctx.currentPlayer` to `'1'`.
- Every args-shape refusal includes `undefined` and `null` payloads.
1. **Gate, for every setter.** Each refusal leaves `G` deep-equal to a pre-call `structuredClone`:
   - `isDebugMatch` absent;
   - `playerID !== ctx.currentPlayer`;
   - `currentStage` `'start'` and `'cleanup'`;
   - `pendingHeroChoice` set;
   - one `hasAnyPendingChoice` member set;
   - a non-empty `pendingDivingBlockWounds`;
   - a non-empty `pendingEscapeProcedures`.

   **Each refusal starts from a state where the same setter and args succeed once the blocker is removed.** Seed
   `city[4]`, a twist and a strike in the villain deck, the named card in its source, and a non-empty supply. In the
   same test, remove the blocker and assert that `G` changes (the positive control), for each of the six setters.
   **Teleport returns:** a non-empty `pendingTeleportReturns` doesn't block setter 5.
2. **Setter 1.** Decrease to 0 moves every Wound to `operatorSetAside.wounds`. Increase restores from it. Over-max,
   negative and non-integer counts are refused. Equal writes no log line. The log text is exact.
3. **Setter 2.** Villain deck and hero deck: the card ends at index 0 and the rest keep their order. An absent card is
   refused.
4. **Setter 3.** With a twist deep in the deck, the twist reaches `G.scheme.twistPile` through the reveal path, with
   the reveal path's own log lines after the operator line.
   - The villain deck shrinks by exactly 1, and the twist id appears once across the deck and `G.scheme.twistPile`.
   - A deck with no Master Strike is refused.
   - `villainRevealedThisTurn` is unchanged.
5. **Setter 4.**
   - R1 for each pile. R1 wounds runs Diving Block: with `core/captain-america/diving-block#0` in the target's hand and
     its hook registered (the `moves/divingBlock.logic.test.ts` `makeState` shape, L38–69), the gain queues
     `pendingDivingBlockWounds`. That proves the route is `gainWoundForPlayer`, not a raw zone move.
   - R2 from each player zone.
   - R3: a deck destination lands on top; same-player hand → discard goes through `discardFromHand` (a return-on-discard
     card parks its pending return); cross-player hand → discard is refused.
   - R4 into an empty and an occupied space. `G.heroDeck` is asserted exactly, contents and length: the placed card is
     gone, and the displaced card is at the end.
   - Refused:
     - `from: null`, `to: undefined`, `cardId: 42`;
     - an R1 `cardId` that isn't the pile's top id. The ids are fungible, so the presence check is what refuses it;
       the top-id rule is defensive and has no revert proof;
     - an `inPlay` destination;
     - `{ko}` as a source;
     - a `{supply}` destination;
     - player id `'constructor'`;
     - an unknown player;
     - a card not in the source;
     - `hqIndex` 5.
   - Setter 1 round trip: a decrease, then an equal increase, restores the pile's original order.
6. **Setter 5.** Attack and Recruit each add `amount`. 0, 21 and 1.5 are refused.
7. **Setter 6.** A Villain in space 4 ends in `G.escapedPile`, `G.city[4]` is `null`, and the escape counter rises by
   one. Its attached Bystanders are carried away. An empty space 4 is refused.
8. **Conservation.** For setters 1, 2 and 4 (every route), the multiset of every card id is the same before and after.
   It counts:
   - all players' zones and `G.piles`;
   - `G.villainDeck.deck` + `.discard`, `G.heroDeck`, `G.hq` and `G.city`;
   - `G.ko`, `G.escapedPile` and `G.operatorSetAside`;
   - the **values** (not the keys) of `G.attachedBystanders`, `G.villainAttachedHeroes` and `G.outOfTimeCards`;
   - `G.scheme.twistPile`, `G.mastermind.strikePile` / `.tacticsDeck` / `.tacticsDefeated` / `.attachedBystanders`,
     `G.transformDeck` and `G.pendingTeleportReturns[].cardId`.

   Reference-only queues (`pendingDivingBlockWounds[].woundCardId`, `pendingEscapeProcedures`) aren't counted, which
   avoids double counts.
9. **No random.** Setters 1, 2, 4 and 5 run with a `random` that is a `Proxy` whose `get` trap throws on any property
   access, and they don't throw.
10. **Determinism.** The same `G` and args, run twice from two clones, give deep-equal results.
11. **Logging.** The first entry each setter adds (`G.messages[lengthBefore]`, without its prefix) starts with
    `Operator:`. For setters 1, 2, 4 and 5 it is the only entry added. For 3 and 6 the normal path's own lines follow
    it.
12. **Pins (runtime):**
    - `OPERATOR_SETTER_MOVE_NAMES` ⊆ `Object.keys(LegendaryGame.moves)`;
    - none of the six is in `SIMULATION_MOVE_NAMES` or `SIMULATION_RUNNER_MOVE_NAMES`;
    - `OPERATOR_SUPPLY_PILES` deep-equals the `OperatorSupplyCounts` key set as written in a built `OperatorView`.

`ui/operatorView.build.test.ts` adds two cases: no `setAsideCounts` key when `G.operatorSetAside` is absent, and exact
counts after a decrease.

### E) Existing test — the one authorized change
- `game.test.ts` move-registration pin: the array, the title, the count message (47 → 53) and one changelog line. The
  new moves force it. Commit 1's `Tests-changed:` trailer names it. No other existing assertion changes.
- **01.5 runtime-wiring allowance: INVOKED** (`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`). It covers the
  `game.ts` registration and the new `G` field. §E is the only authorized change to an existing test.

### F) Docs (governance close, `SPEC:` commit)
- `docs/ai/DECISIONS.md`: D-24713, from §D-24713 Content, marked Active.
- `wiki/why-play-needs-a-debug-panel.md`: §Build status row for follow-on 2 (WP-806 done, WP-807 pending), and Open
  Question 7 answered "D-24713".
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md` (📝 → ✅, then `pnpm roadmap:counts:write`).

## D-24713 Content

### D-24713 — Operator setters: the six moves, the set-aside zone, and the §7 extensions (Active on execution — WP-806 / EC-843)

Extends D-24689 §7 with the operator's rulings of 2026-10-13 (Open Question 7 on `wiki/why-play-needs-a-debug-panel.md`
and the hero-deck / HQ question).

1. **Six moves.**
   - `operatorSetSupplyCount`, `operatorMoveToDeckTop`, `operatorRevealNow`, `operatorMoveCard`, `operatorAddEconomy`
     and `operatorEscapeVillain`.
   - Each follows D-24689 §7's move rules: operator match only; the operator's own turn, checked against
     `ctx.currentPlayer`; the `main` stage; refused while a choice is open; an "Operator:" log line.
   - "A choice is open" means `hasAnyPendingChoice`, `pendingHeroChoice`, or a queued Diving Block or escape procedure.
     A set-aside teleport return is not a choice.
2. **Economy and escape (Open Question 7).**
   - Setters may add 1–20 Recruit or Attack to the current turn's `turnEconomy`. Turn start resets it as usual.
   - A forced escape takes the Villain in the escape-edge City space through `resolveVillainEscape`, the path a
     pushed-out Villain takes, so escape effects, carried Bystanders and the escape count all fire.
   - Neither creates or destroys a card. Recruit and Attack are turn counters, never VP or score.
3. **Randomness.** §7's "no `ctx.random`" governs the setter's own logic: no setter chooses a card by chance.
   `operatorRevealNow` and `operatorEscapeVillain` hand the move's `random` to the normal reveal and escape paths,
   which use it as they do in play.
4. **Hero deck and HQ.**
   - Setter 2 also reorders the hero deck.
   - Setter 4 may place a hero-deck card in an HQ space. The card it displaces goes to the bottom of the hero deck, as
     "put a Hero on the bottom of the Hero Deck" cards do. Nothing refills.
   - `G.hqHaunters` stays aligned with the space, so a placed hero in a haunted space is haunted, consistent with
     D-24587.
5. **The set-aside zone** is `G.operatorSetAside?: { wounds?, bystanders?, officers?, sidekicks? }` (`CardExtId[]`
   each).
   - It is written only by `operatorSetSupplyCount` and omitted until its first decrease, so normal matches and every
     hash oracle are byte-identical.
   - No rule, `UIState` builder or scoring code reads it. `buildOperatorView` shows its counts as the optional
     `setAsideCounts`.
6. **Setter 4's routes are closed:**
   - a gain from a supply;
   - a KO from a player's zone;
   - a move between a player's hand, deck top, discard and Victory Pile (any players);
   - a hero-deck card into an HQ space.
   Hand → discard for the same player goes through `discardFromHand`. Nothing else is allowed, so no card lands "in
   play" without having been played.
7. **Out of the bot.** The setters are absent from `getLegalMoves`, the simulation and PAR dispatch, the
   determinism-only replay and the fixture runner, like `phaseCard` and `endMatchEarly`. The server's faithful replay
   re-runs them through the real reducer.
8. **Deferred.**
   - A plain-English command console over these moves is a later client packet.
   - Open Question 8 (branching rewind) and Open Question 9 (a secret per-player rig) are not ruled on.
   - Jump to turn N stays D-24689 §8's follow-on.

**Reserved by:** NUMBER-LEDGER D-24713 (#2765). Related: D-24689, D-24026, D-24119, D-24160, D-10008, D-24697, D-24372.

## Limitations (accepted)

- **The operator view polls.** After a setter, the WP-804 panel shows the change on its next 3-second poll or on
  "Refresh". WP-807 refreshes right after each submit.
- **No rescue triggers.** A Bystander moved to a Victory Pile, or a Sidekick to a discard pile, triggers no rescue or
  gain effect, because no helper exists for those moves. The log names the route, and it's noted here so that a test
  relying on a rescue trigger uses a real rescue.
- **Setters can end the game.** They inherit `turn.onMove` and `endIf` (§Context). An operator who empties the hero
  deck gets a final turn.
- **A mid-turn reveal isn't a start-of-turn reveal.** Some handlers assume the reveal happens at turn start. Magneto's
  Master Strike checks the hand only, because "inPlay is empty" then (`rules/mastermindHandlers.ts` L201–206). A
  `main`-stage reveal also sets `masterStrikePlayedThisTurn` partway through the turn. That's the real handler on an
  unusual timing. A live-verify that depends on such a handler should put the card on top (setter 2) and let the next
  turn's normal reveal take it.
- **The determinism-only replay** (`replay/replay.execute.ts`) skips unknown moves with a warning (L216–222). An
  operator match never goes through it. Score verification of an operator match is refused anyway (`debug_match`,
  D-24689 §3), and the D-24119 replay runs the real reducer.
- **A Diving Block holder blocks the next setter.** An R1 Wound to a Diving Block holder (the bot included) opens a
  seat choice after the move. Setters stay refused until it resolves. That's the gate working, and a D-24684 setup that
  moves Wounds into the bot's discard should expect it.
- **The after-move hooks are verified live.** The tests call the moves directly, so `turn.onMove` and `endIf` don't run
  in WP-806. Their consequences are verified live under WP-807.
- **R1 Wounds and Officers take the pile's top card.** The ids are fungible, so the `cardId` check is a consistency
  check, not a choice.

## Out of Scope

- The client pane, the Tweakpane dependency and the `UiMoveName` union (WP-807).
- A command console (D-24713 §8), Open Questions 8 and 9, jump to turn N (D-24689 §8), the effects tuner, latency and
  connection monitors, and PAR extensions.
- Setters for the City (place a Villain), Mastermind tactics, the KO pile as a source, `horrors` and the transform
  deck.
- Any server, persistence, `UIState`, `playerView` or registry change. No API endpoint change.
- Updating the stale "every move has an entry" comments at `replay/replay.execute.ts` L137 and
  `simulation/simulation.runner.ts` L327. They predate this packet, so they get a separate hygiene commit.

## Files Expected to Change

- `packages/game-engine/src/moves/operatorSetters.types.ts` — **new** — the contract types and constants
- `packages/game-engine/src/moves/operatorSetters.logic.ts` — **new** — gate, labels, route classifier
- `packages/game-engine/src/moves/operatorSetters.ts` — **new** — the six moves
- `packages/game-engine/src/moves/operatorSetters.test.ts` — **new** — §D
- `packages/game-engine/src/types.ts` — **modified** — `operatorSetAside?`
- `packages/game-engine/src/game.ts` — **modified** — six registrations
- `packages/game-engine/src/game.test.ts` — **modified** — §E pin only
- `packages/game-engine/src/ui/operatorView.types.ts` — **modified** — optional `setAsideCounts`
- `packages/game-engine/src/ui/operatorView.build.ts` — **modified** — builds it
- `packages/game-engine/src/ui/operatorView.build.test.ts` — **modified** — two cases
- `packages/game-engine/src/index.ts` — **modified** — the §Locked exports
- `docs/ai/post-mortems/01.6-WP-806-operator-setters.md` — **new** — mandatory 01.6 post-mortem, written before the
  `EC-843:` commit and committed in it (the WP-803 precedent)
- `docs/ai/DECISIONS.md`, `wiki/why-play-needs-a-debug-panel.md`, `docs/ai/STATUS.md`,
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` —
  **modified** — governance close

Eleven code files is over the ~8-file guidance:
- four are new: the contract, the logic, the moves and their test;
- seven are existing files that each take a few lines.
The client half is already split out as WP-807. Splitting the moves further would ship setters the pane can't reach
yet, in two packets instead of one.

## Contract

- Locks `moves/operatorSetters.types.ts`, the six move names and argument shapes, the gate, the route table, the log
  templates, `G.operatorSetAside` and `OperatorView.setAsideCounts?`.
- No server, `UIState`, persistence or API change.

## Acceptance Criteria

1. `Object.keys(LegendaryGame.moves).length === 53`, and the six `OPERATOR_SETTER_MOVE_NAMES` are among them, each
   registered `{ move, client: false }`.
2. Every setter leaves `G` deep-equal to its pre-call clone when `isDebugMatch` is absent, the caller isn't the current
   player, the stage isn't `main`, or a choice is open (§D case 1).
3. Setter 1 moves cards between `G.piles[pile]` and `G.operatorSetAside[pile]` only, and refuses counts above the pile
   plus its set-aside.
4. Setters 2 and 3 reorder `G.villainDeck.deck` / `G.heroDeck` and draw nothing by chance. Setter 3's card resolves
   through `performVillainReveal`.
5. Setter 4 allows exactly routes R1–R4, and same-player hand → discard goes through `discardFromHand`. R4 sends the
   displaced card to the hero-deck bottom.
6. Setter 5 adds 1–20 to the chosen resource only. Setter 6 escapes the space-4 Villain through
   `resolveVillainEscape`, with space 4 cleared.
7. The card multiset is unchanged by setters 1, 2 and 4 (§D case 8). Every setter's first added log entry starts with
   "Operator:" (§D case 11).
8. No setter name appears in `SIMULATION_MOVE_NAMES`, either `MOVE_MAP`, `getLegalMoves`, `replay.execute.ts` or
   `runFixture.ts`. The sentinel `finalStateHash` and `PRE_WP080_HASH` are unchanged.
9. A built `OperatorView` has no `setAsideCounts` key until a decrease, then exact counts.
10. `pnpm -r build` exits 0, `pnpm -r --no-bail test` reports 0 failures, and `pnpm sim:runtime-observed:check`,
    `pnpm sim:coverage --check` and `pnpm --filter @legendary-arena/arena-client typecheck` exit 0.
11. The only changed existing assertion is §E. Everything else in `git diff origin/main -- '*.test.ts'` is an
    addition.

## Verification Steps

```pwsh
pnpm -r build
pnpm -r --no-bail test
pnpm --filter @legendary-arena/game-engine test
pnpm --filter @legendary-arena/arena-client typecheck
pnpm sim:runtime-observed:check
pnpm sim:coverage --check
pnpm ledger:numbers:check
pnpm roadmap:counts:check
Select-String -Path packages/game-engine/src/simulation/*.ts,packages/game-engine/src/replay/replay.execute.ts,packages/game-engine/src/test/fixtures/runFixture.ts -Pattern 'operator(SetSupplyCount|MoveToDeckTop|RevealNow|MoveCard|AddEconomy|EscapeVillain)'
git diff --name-only origin/main
git diff origin/main -- '*.test.ts'
git diff origin/main -- packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json packages/game-engine/src/replay/replay.execute.test.ts
```

Expected:
- every `pnpm` command exits 0, with engine tests 5153 + N / 0;
- the `Select-String` prints nothing;
- the name diff is ⊆ §Files Expected to Change;
- the test diff is additions plus the §E pin;
- the last diff is empty.

**Live (D-24026):** none in this packet, because no client can submit these moves yet. WP-807 §Verification exercises
every setter in production, and its live record covers this packet too (cited in both STATUS lines).

## Definition of Done

- [ ] Acceptance Criteria 1–11 pass, with command output pasted into the PR.
- [ ] `git diff --name-only origin/main` ⊆ §Files Expected to Change. Revert line-ending-only churn (e.g.
      `lagn-v1.json`).
- [ ] `docs/ai/DECISIONS.md`: D-24713 landed Active from §D-24713 Content.
- [ ] STATUS, WORK_INDEX (`[x]` with date), EC_INDEX, the mindmap (✅, counts regenerated) and the ewiki page's §Build
      status / Open Question 7 are updated.
- [ ] 01.6 post-mortem written (`docs/ai/post-mortems/01.6-WP-806-operator-setters.md`, per
      `docs/ai/REFERENCE/01.6-post-mortem-checklist.md`). It is **mandatory**: a new contract that WP-807 consumes, plus
      new runtime wiring. It is a STOP gate before the `EC-843:` commit.
- [ ] Two commits in one PR: `EC-843:` (code + tests) and `SPEC:` (governance close). Neither subject contains a
      commit-msg Rule 1 token.
- [ ] D-24026 live verification: deferred to WP-807 by design. WORK_INDEX says "live-verify via WP-807".

## Open Operator Decisions (do not block execution)

- **OD-1 — Economy cap.** `OPERATOR_ECONOMY_MAX_AMOUNT = 20` per submit. Raise it in a follow-up `INFRA:` commit if
  one submit isn't enough; it changes no rule.

## Vision Alignment

- §3 Player Trust & Fairness: setters run only in an operator match, which every seat sees is unscored (D-24689 §1,
  §3), and every setter is logged.
- §7 Strict Layer Separation: the engine owns the setters; the client (WP-807) only submits intent.
- §14 Explicit Decisions, No Silent Drift: D-24713 records the §7 extensions before code uses them.
- §22 Determinism & Replay: setters are moves in the log. Their own logic draws nothing by chance; the paths they call
  use `ctx.random` as in play. Normal-match hashes are unchanged (omit-when-off field, no re-pin).
- §23 Competitive Leaderboards & Submission: an operator match is still refused at submission (`debug_match`).
- **Conflict assertion:** No conflict.
- **NG-1..NG-8:** none crossed. Operator tooling isn't a product feature, and no purchase reaches it.

## Funding Surface Gate

N/A. Operator tooling, with no commerce, account-tier, entitlement, nav, profile or donate surface.

## API Catalog

No endpoint is added or changed, so D-11804 doesn't trigger. The moves travel over the existing boardgame.io socket.

## Lint Gate Self-Review (00.3)

Pending: the gate runs as an independent subagent after pre-flight and copilot.

## Gate Verdicts

- **Pre-flight (01.4): READY TO EXECUTE.** It ran as an independent subagent. The first pass was NOT READY:
  - **PS-1:** §D 11 asserted the *newest* log line, but the reveal and escape paths log after the operator line. It now
    asserts the first added entry.
  - **PS-2:** top-of-deck placement was unspecified, and R3 contradicted itself (`moveCardFromZone` appends to the
    bottom). The `putHandOnDeckTop` prepend idiom is now locked for setters 1–3 and R3.
  - **PS-3:** the 01.6 post-mortem was softened. It is now mandatory and a STOP gate before the `EC-843:` commit.
  - **RS-1..RS-10 applied:**
    - the `makeMockMoveContext` harness;
    - args hardening (no destructuring, `Object.hasOwn`);
    - full log labels;
    - explicit refused routes;
    - the `setAsideCounts` conditional spread;
    - the 32-check count;
    - the mid-turn reveal limitation;
    - the haunted-HQ note in D-24713 §4;
    - the keyed-access and pile-slice style sanctions;
    - 01.5 INVOKED.
  All the fixes are text and none changes scope, so per 01.4 the verdict is READY without a re-run.
- **Copilot (01.7): PASS.** It ran as an independent subagent. The first pass was RISK → HOLD, with findings F1–F9:
  - F1: nested-arg null guards;
  - F2: positive controls on every gate refusal;
  - F3: the Diving Block gate case and per-clause revert proofs;
  - F4: honest R4 revert proofs;
  - F5: the get-trap `Proxy` for "no random";
  - F6: prepend to the removal result, plus setter 3 conservation;
  - F7: the full conservation zone list;
  - F8: the Diving Block and live-only limitations;
  - F9: EC/WP parity for exports, R1, setter 2 and setter 6.
  The delta re-check was PASS. Its notes N1 (the fungible top-id refusal) and N2 (count map values; `tacticsDefeated`)
  are applied.
- **Lint (00.3):** pending.
