# EC-843 — Operator setters: six operator-match-only moves that set up a board through the real paths (Execution Checklist)

**Source:** docs/ai/work-packets/WP-806-operator-setters.md
**Layer:** Game Engine (`packages/game-engine` only)

## Before Starting
- [ ] Run `pnpm install`, then `pnpm -r build` (0) and `pnpm -r --no-bail test` (0 fail). Record the counts (draft: engine 5153 / 0 on `5b6a0634`).
- [ ] Confirm on `main`, and STOP and report if any differs: `game.test.ts` L276 says `exactly 47 moves`; no `operator*` move exists; `hasAnyPendingChoice` is exported from `moves/phaseCard.ts`; `performVillainReveal` (`villainDeck.reveal.ts` L219) and `resolveVillainEscape` (L595) are exported; `G.isDebugMatch` is at `types.ts` L1777.
- [ ] The EXACT target file set = `## Files to Produce`. Any file outside it is a FAIL, surfaced as a blocker. 01.5 runtime-wiring allowance: INVOKED. WP §E is the only existing-test edit.

## Locked Values (do not re-derive)
- `moves/operatorSetters.types.ts`, verbatim:
  - `export type OperatorSupplyPile = 'wounds' | 'bystanders' | 'officers' | 'sidekicks';` `export const OPERATOR_SUPPLY_PILES: readonly OperatorSupplyPile[] = ['wounds', 'bystanders', 'officers', 'sidekicks'];`
  - `export type OperatorDeckName = 'villain' | 'hero';` `export type OperatorRevealCardType = 'scheme-twist' | 'mastermind-strike';` `export type OperatorEconomyResource = 'attack' | 'recruit';` `export const OPERATOR_ECONOMY_MAX_AMOUNT = 20;`
  - `export type OperatorPlayerZoneName = 'hand' | 'deck' | 'discard' | 'inPlay' | 'victory';` `export type OperatorZoneRef = { zone: OperatorPlayerZoneName; playerId: string } | { zone: 'ko' } | { zone: 'heroDeck' } | { zone: 'hq'; hqIndex: number } | { zone: 'supply'; pile: OperatorSupplyPile };`
  - `export interface OperatorSetSupplyCountArgs { pile: OperatorSupplyPile; count: number }` `export interface OperatorMoveToDeckTopArgs { deck: OperatorDeckName; cardId: CardExtId }` `export interface OperatorRevealNowArgs { cardType: OperatorRevealCardType }`
  - `export interface OperatorMoveCardArgs { cardId: CardExtId; from: OperatorZoneRef; to: OperatorZoneRef }` `export interface OperatorAddEconomyArgs { resource: OperatorEconomyResource; amount: number }` `export type OperatorEscapeVillainArgs = Record<string, never>;`
  - `export type OperatorSetterMoveName = 'operatorSetSupplyCount' | 'operatorMoveToDeckTop' | 'operatorRevealNow' | 'operatorMoveCard' | 'operatorAddEconomy' | 'operatorEscapeVillain';` `export const OPERATOR_SETTER_MOVE_NAMES: readonly OperatorSetterMoveName[] = ['operatorSetSupplyCount', 'operatorMoveToDeckTop', 'operatorRevealNow', 'operatorMoveCard', 'operatorAddEconomy', 'operatorEscapeVillain'];`
- `G` field: `operatorSetAside?: { wounds?: CardExtId[]; bystanders?: CardExtId[]; officers?: CardExtId[]; sidekicks?: CardExtId[] };`. It is absent until the first decrease, and a pile's key is created on its first decrease and kept, even when it empties.
- Gate (`moves/operatorSetters.logic.ts`):
  - `const OPERATOR_SETTER_STAGE: TurnStage = 'main';`
  - `export function isOperatorChoiceOpen(G: LegendaryGameState): boolean` is true when `hasAnyPendingChoice(G)`, or `G.pendingHeroChoice !== undefined`, or `(G.pendingDivingBlockWounds?.length ?? 0) > 0`, or `(G.pendingEscapeProcedures?.length ?? 0) > 0`. `pendingTeleportReturns` is **not** a choice.
  - `export function canRunOperatorSetter(G: LegendaryGameState, currentPlayer: string, playerID: string): boolean` is true only when `G.isDebugMatch === true`, `playerID === currentPlayer`, `G.currentStage === OPERATOR_SETTER_STAGE` and `!isOperatorChoiceOpen(G)`.
- `PILE_LABEL = { wounds: 'Wound', bystanders: 'Bystander', officers: 'S.H.I.E.L.D. Officer', sidekicks: 'Sidekick' }`.
- Move signature: `({ G, ctx, playerID, ...context }, args: unknown)`.
- Move order:
  - (1) validate args, never destructured: an object and not null; every nested `from` / `to` an object and not null before any field read; `cardId` a string; union members; `Number.isInteger`; `Object.hasOwn(G.playerZones, id)`. Setter 6 accepts any non-null object and ignores its keys;
  - (2) `canRunOperatorSetter`;
  - (3) state preconditions;
  - (4) helpers + `pushLog`.
  Any failure at 1–3 returns `void` with `G` untouched.
- **Top placement:**
  - Within one deck (setters 2 and 3): `const moveResult = moveCardFromZone(deck, [], cardId)`, then `deck = [cardId, ...moveResult.from]`. Prepend to the removal result, never the original.
  - R3 deck destination: remove from the source zone, then `deck = [cardId, ...deck]` (`putHandOnDeckTop.resolve.ts` L127–136).
- **Setter 2:** a card already at index 0, or absent, is a silent no-op.
- **R1:** `cardId` must be the pile's top id.
- **Setter 1:** counts are non-negative integers ≤ the pile plus its set-aside. A decrease moves the top cards to the end of `operatorSetAside[pile]`. An increase takes cards one at a time from the set-aside's end and prepends each, so a decrease then an equal increase restores the order. An equal count is a silent no-op.
- **Setter 3:** take the first `villainDeckCardTypes` match, put it on top, log, then call `performVillainReveal(G, { random, ctx: { currentPlayer, turn } }, DEFAULT_IMPLEMENTATION_MAP)`. `villainRevealedThisTurn` is untouched.
- **Setter 4, R1:** wounds → discard via `gainWoundForPlayer`; officers → discard via `gainOfficerToDiscard`; sidekicks → discard and bystanders → victory via `moveCardFromZone`.
- **R2:** a player zone → `G.ko`.
- **R3:** {hand, deck, discard, inPlay, victory} → {hand, deck-top, discard, victory} of any player. Same-player hand → discard goes through `discardFromHand`; cross-player hand → discard is refused.
- **R4:** heroDeck → `hq[hqIndex]` (0–4). The displaced card is pushed to the end of `G.heroDeck`; nothing refills.
- Any other pair is refused.
- **Setter 5:** `addResources(G.turnEconomy, attack, recruit)` with amount 1–20.
- **Setter 6:** `OPERATOR_ESCAPE_CITY_INDEX = 4`. A `null` space is a no-op. Otherwise log, clear `G.city[4]`, then `resolveVillainEscape(G, { random, ctx: { currentPlayer, turn } }, DEFAULT_IMPLEMENTATION_MAP, cardId)`.
- Logs:
  - `Operator: ${PILE_LABEL} supply set to ${count} (was ${current}).`; `Operator: ${cardRef} moved to the top of the ${Villain|Hero} Deck.`; `Operator: revealing ${cardRef} now.`
  - `Operator: ${cardRef} moved from ${fromLabel} to ${toLabel}.`, plus ` ${displacedRef} went to the bottom of the Hero Deck.` when R4 displaces a card
  - `Operator: +${amount} ${Attack|Recruit} this turn.`; `Operator: ${cardRef} escapes.`
- Labels: `Player ${p}'s hand|deck|discard pile|play area|Victory Pile`; a deck destination is `the top of Player ${p}'s deck`; `the KO pile`; `the Hero Deck`; `HQ space ${hqIndex + 1}`; `the ${PILE_LABEL} supply`.
- Registration: `{ move, client: false }`, 47 → 53.
- `OperatorView.setAsideCounts?: OperatorSupplyCounts` is present only when `G.operatorSetAside` exists, built with a conditional spread inside the return literal.
- `index.ts` (`.`) exports:
  - types: `OperatorSupplyPile`, `OperatorDeckName`, `OperatorRevealCardType`, `OperatorEconomyResource`, `OperatorPlayerZoneName`, `OperatorZoneRef`, the six args types and `OperatorSetterMoveName`;
  - values: `OPERATOR_SUPPLY_PILES`, `OPERATOR_SETTER_MOVE_NAMES` and `OPERATOR_ECONOMY_MAX_AMOUNT`.
- Tests:
  - every gate refusal has a positive control (same setter and args succeed with the blocker removed);
  - "no random" uses a `Proxy` whose `get` trap throws;
  - conservation counts every card-holding field per WP §D 8.

## Guardrails
- Setters 1, 2, 4 and 5 never read `random`. Setters 3 and 6 pass it only to the reveal or escape path. No `Math.random`, no clock.
- No card is created or destroyed. Every moved card is found in its source zone first.
- No setter name goes into `SIMULATION_MOVE_NAMES`, either `MOVE_MAP`, `getLegalMoves`, `replay.execute.ts` or `runFixture.ts`.
- No `UIState` / `playerView`, server, client, registry or persistence change. `operatorSetAside` is read only by setter 1 and `buildOperatorView`.
- No new `moveCardFromZone(<x>.hand, <y>.discard` idiom. Keyed access only with step-1-validated union keys. Pile slices and the HQ write follow the `gainOfficerToDiscard` / `resolveOptionalPutBottomHQ` precedents.
- Drift pins are runtime assertions (D-24372). Never `any`, `@ts-ignore` or a widened production type.
- Sentinel `finalStateHash` and `PRE_WP080_HASH` stay byte-identical. If either moves, STOP.

## Required `// why:` Comments
- `canRunOperatorSetter`: the D-24689 §7 gate, and the explicit `playerID` check (a seat choice admits a non-active seat into the global move bag).
- `isOperatorChoiceOpen`: the extra fields beyond `hasAnyPendingChoice`; teleport returns aren't a choice.
- Args validation: moves never throw, so the payload isn't destructured, and `Object.hasOwn` blocks prototype keys.
- `types.ts` `operatorSetAside`: omit-when-off keeps normal matches hash-identical; no rule reads it (D-24713 §5).
- `game.ts` registration: operator-match-only, absent from bot, sim and fixture dispatch (D-24713 §7).
- Setters 3 and 6: `random` goes to the normal path (D-24713 §3). Setter 6 clears the space first; `resolveVillainEscape` doesn't. R4: displaced card to the hero-deck bottom, no refill (D-24713 §4).

## Files to Produce
- `packages/game-engine/src/moves/operatorSetters.types.ts`, `operatorSetters.logic.ts`, `operatorSetters.ts`, `operatorSetters.test.ts` — **new**
- `packages/game-engine/src/types.ts`, `game.ts`, `index.ts` — **modified**
- `packages/game-engine/src/game.test.ts` — **modified** — the move pin only
- `packages/game-engine/src/ui/operatorView.types.ts`, `operatorView.build.ts`, `operatorView.build.test.ts` — **modified**
- `docs/ai/post-mortems/01.6-WP-806-operator-setters.md` — **new** — mandatory, in the `EC-843:` commit
- `docs/ai/DECISIONS.md`, `wiki/why-play-needs-a-debug-panel.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close

## After Completing
- [ ] Run `pnpm -r build` (0), `pnpm -r --no-bail test` (0 fail), `sim:runtime-observed:check`, `sim:coverage --check` and the arena-client `typecheck` (all 0). Record the before / after counts.
- [ ] Revert proofs, each failing ≥ 1 new test:
  - drop the `isDebugMatch` check; drop the `playerID` check; drop the stage check
  - drop each choice-gate clause: `pendingHeroChoice`, `hasAnyPendingChoice`, `pendingDivingBlockWounds`, `pendingEscapeProcedures`
  - call `context.random.Shuffle(...)` in setter 2; route R1 wounds through `moveCardFromZone`
  - send R4's displaced card to the hero-deck top; drop R4's displaced card
  - allow `inPlay` as an R3 destination; append (not prepend) on a deck destination; prepend to the original deck in setter 2
  - read `from.zone` before the null check; skip clearing `G.city[4]`; write `operatorSetAside: {}` at setup
- [ ] The WP §Verification `Select-String` prints nothing. The sentinel and `replay.execute.test.ts` diffs are empty. `git diff origin/main -- '*.test.ts'` is additions plus the `game.test.ts` pin.
- [ ] **STOP gate:** the 01.6 post-mortem is written (`docs/ai/REFERENCE/01.6-post-mortem-checklist.md`) before Commit 1.
- [ ] Commit 1, `EC-843: …`: code + tests + post-mortem, with a `Tests-changed:` trailer (the move pin) and `Vision: §3, §7, §14, §22, §23`.
- [ ] Commit 2, `SPEC: WP-806 / EC-843 govern-close — …`: D-24713 Active; the ewiki §Build status and OQ7; STATUS "No user-observable change — infrastructure only; live-verify via WP-807"; WORK_INDEX `[x]` ("live-verify via WP-807"); EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write` + `:check`; `pnpm ledger:numbers:check`.
- [ ] Neither commit subject contains a Rule 1 token (WIP / fix stuff / misc / tmp / updates / changes / debug). Write "operator match".

## Common Failure Smells
- A bot or a sim calls a setter, or `simulation.moveDispatch.drift.test.ts` reds → a setter was added to sim dispatch.
- The sentinel hash moved → `operatorSetAside` (or `{}`) is written at setup.
- `discardFromHand.test.ts` drift guard reds → a raw hand→discard idiom was added.
- A card "moved to the top" is drawn last → `moveCardFromZone` appended it to the bottom.
- A setter throws on an empty payload → its args were destructured in the parameter list.
- The escaped Villain is still in the City → space 4 wasn't cleared before `resolveVillainEscape`.
- A card appears twice in a deck after setter 2 → it was prepended to the original array, not the removal result.
- Every setter is refused right after an R1 Wound → a Diving Block seat choice is open. That's correct; resolve it first.
