# EC-843 — Operator setters: six operator-match-only moves that set up a board through the real paths (Execution Checklist)

**Source:** docs/ai/work-packets/WP-806-operator-setters.md
**Layer:** Game Engine (`packages/game-engine` only)

## Before Starting
- [ ] Run `pnpm install`, then `pnpm -r build` (exits 0), then `pnpm -r --no-bail test` (0 fail). Record the counts
      (draft: engine 5153 / 0 on `5b6a0634`).
- [ ] Confirm on `main`, and STOP and report if any differs:
  - `game.test.ts` L276 says `exactly 47 moves`;
  - no `operator*` move exists;
  - `hasAnyPendingChoice` is exported from `moves/phaseCard.ts`;
  - `performVillainReveal` (`villainDeck.reveal.ts` L219) and `resolveVillainEscape` (L595) are exported;
  - `G.isDebugMatch` is at `types.ts` L1777.
- [ ] The EXACT target file set = `## Files to Produce`. Any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- `OperatorSupplyPile = 'wounds' | 'bystanders' | 'officers' | 'sidekicks'`;
  `OPERATOR_SUPPLY_PILES = ['wounds', 'bystanders', 'officers', 'sidekicks']`;
  `OPERATOR_ECONOMY_MAX_AMOUNT = 20`.
- `OperatorZoneRef = { zone: 'hand' | 'deck' | 'discard' | 'inPlay' | 'victory'; playerId: string } | { zone: 'ko' } | { zone: 'heroDeck' } | { zone: 'hq'; hqIndex: number } | { zone: 'supply'; pile: OperatorSupplyPile }`.
- The moves and their args:
  - `operatorSetSupplyCount({ pile, count })`
  - `operatorMoveToDeckTop({ deck: 'villain' | 'hero', cardId })`
  - `operatorRevealNow({ cardType: 'scheme-twist' | 'mastermind-strike' })`
  - `operatorMoveCard({ cardId, from, to })`
  - `operatorAddEconomy({ resource: 'attack' | 'recruit', amount })`
  - `operatorEscapeVillain({})`
  `OPERATOR_SETTER_MOVE_NAMES` lists the six names in that order.
- `G.operatorSetAside?: { wounds?: CardExtId[]; bystanders?: CardExtId[]; officers?: CardExtId[]; sidekicks?: CardExtId[] }`.
  It is absent until the first decrease, and a pile's key is kept once created.
- `canRunOperatorSetter(G, currentPlayer, playerID)` requires all four:
  - `G.isDebugMatch === true`;
  - `playerID === currentPlayer`;
  - `G.currentStage === OPERATOR_SETTER_STAGE`, where `OPERATOR_SETTER_STAGE: TurnStage = 'main'`;
  - `!isOperatorChoiceOpen(G)`, where `isOperatorChoiceOpen` = `hasAnyPendingChoice(G)` || `pendingHeroChoice !==
    undefined` || a non-empty `pendingDivingBlockWounds` || a non-empty `pendingEscapeProcedures`. Teleport returns
    don't count.
- Move order: (1) validate args → (2) `canRunOperatorSetter` → (3) state preconditions → (4) helpers + `pushLog`. Any
  failure at 1–3 returns `void` with `G` untouched.
- **Setter 1:**
  - valid counts are non-negative integers ≤ the pile plus its set-aside;
  - a decrease moves the top cards to the end of `operatorSetAside[pile]`;
  - an increase moves cards from the end of the set-aside to the pile's top;
  - an equal count is a silent no-op.
- **Setter 2:** the first occurrence moves to index 0. A card already there, or absent, is a no-op.
- **Setter 3:** take the first `villainDeckCardTypes` match, move it to top, log, then call
  `performVillainReveal(G, { random, ctx: { currentPlayer, turn } }, DEFAULT_IMPLEMENTATION_MAP)`.
  `villainRevealedThisTurn` is untouched.
- **Setter 4 routes:**
  - **R1:** wounds → discard via `gainWoundForPlayer`; officers → discard via `gainOfficerToDiscard`; sidekicks →
    discard and bystanders → victory via `moveCardFromZone`.
  - **R2:** a player zone → `G.ko`.
  - **R3:** a player zone {hand, deck, discard, inPlay, victory} → {hand, deck-top, discard, victory} of any player.
    Same-player hand → discard goes through `discardFromHand`; cross-player hand → discard is refused.
  - **R4:** heroDeck → `hq[hqIndex]` (0–4). The displaced card is pushed to the end of `G.heroDeck`; nothing refills.
  - Any other pair is refused.
- **Setter 5:** `addResources(G.turnEconomy, attack, recruit)` with amount 1–20.
- **Setter 6:** `OPERATOR_ESCAPE_CITY_INDEX = 4`. A `null` space is a no-op. Otherwise log, clear `G.city[4]`, then
  `resolveVillainEscape(G, { random, ctx: { currentPlayer, turn } }, DEFAULT_IMPLEMENTATION_MAP, cardId)`.
- **Log templates** (exact text):
  - `Operator: ${PILE_LABEL} supply set to ${count} (was ${current}).`
  - `Operator: ${cardRef} moved to the top of the ${Villain|Hero} Deck.`
  - `Operator: revealing ${cardRef} now.`
  - `Operator: ${cardRef} moved from ${fromLabel} to ${toLabel}.`, plus ` ${displacedRef} went to the bottom of the
    Hero Deck.` when R4 displaces a card
  - `Operator: +${amount} ${Attack|Recruit} this turn.`
  - `Operator: ${cardRef} escapes.`
  `PILE_LABEL` = Wound / Bystander / S.H.I.E.L.D. Officer / Sidekick. `cardRef = formatCardRef(G.cardDisplayData, id)`.
- Registration: `{ move, client: false }`, 47 → 53. `OperatorView.setAsideCounts?: OperatorSupplyCounts` is present
  only when `G.operatorSetAside` exists.

## Guardrails
- Setters 1, 2, 4 and 5 never read `random`. Setters 3 and 6 pass it only to the reveal or escape path. No
  `Math.random`, no clock.
- No card is created or destroyed. Every moved card is found in its source zone first.
- No setter name goes into `SIMULATION_MOVE_NAMES`, either `MOVE_MAP`, `getLegalMoves`, `replay.execute.ts` or
  `runFixture.ts`.
- No `UIState` / `playerView`, server, client, registry or persistence change. `operatorSetAside` is read only by
  setter 1 and `buildOperatorView`.
- No new `moveCardFromZone(<x>.hand, <y>.discard` idiom (the `discardFromHand.test.ts` drift guard).
- Drift pins are runtime assertions (D-24372). Never `any`, `@ts-ignore` or a widened production type.
- Sentinel `finalStateHash` and `PRE_WP080_HASH` stay byte-identical. If either moves, STOP.

## Required `// why:` Comments
- `canRunOperatorSetter`: the D-24689 §7 gate, and why `playerID` is compared with `ctx.currentPlayer` (a seat choice
  admits a non-active seat into the global move bag).
- `isOperatorChoiceOpen`: why `pendingHeroChoice` and the two queues are added to `hasAnyPendingChoice`, and why teleport
  returns aren't a choice.
- `types.ts` `operatorSetAside`: omit-when-off keeps normal matches hash-identical; no rule reads it (D-24713 §5).
- `game.ts` registration: operator-match-only, deliberately absent from bot, sim and fixture dispatch (D-24713 §7).
- Setters 3 and 6: `random` is handed to the normal path, not used by the setter (D-24713 §3). Setter 6: the space is
  cleared first because `resolveVillainEscape` doesn't touch `G.city`.
- R4: the displaced card goes to the hero-deck bottom without a refill (D-24713 §4).

## Files to Produce
- `packages/game-engine/src/moves/operatorSetters.types.ts`, `operatorSetters.logic.ts`, `operatorSetters.ts`,
  `operatorSetters.test.ts` — **new**
- `packages/game-engine/src/types.ts`, `game.ts`, `index.ts` — **modified**
- `packages/game-engine/src/game.test.ts` — **modified** — the move pin only
- `packages/game-engine/src/ui/operatorView.types.ts`, `operatorView.build.ts`, `operatorView.build.test.ts` —
  **modified**
- `docs/ai/DECISIONS.md`, `wiki/why-play-needs-a-debug-panel.md`, `docs/ai/STATUS.md`,
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` —
  **modified** — governance close

## After Completing
- [ ] Run `pnpm -r build` (0), `pnpm -r --no-bail test` (0 fail), `sim:runtime-observed:check`,
      `sim:coverage --check` and the arena-client `typecheck` (all 0). Record the before / after counts.
- [ ] Revert proofs, each failing ≥ 1 new test:
  - drop the `isDebugMatch` check;
  - drop the `playerID` check;
  - drop `pendingHeroChoice` from the choice gate;
  - read `random` in setter 2;
  - route R1 wounds through `moveCardFromZone`;
  - let R4 refill instead of displacing to the bottom;
  - allow `inPlay` as an R3 destination;
  - skip clearing `G.city[4]`;
  - write `operatorSetAside: {}` at setup.
- [ ] The WP §Verification `Select-String` prints nothing. The sentinel and `replay.execute.test.ts` diffs are empty.
- [ ] `git diff origin/main -- '*.test.ts'` is additions plus the `game.test.ts` pin.
- [ ] Commit 1, `EC-843: …`: code + tests, with a `Tests-changed:` trailer (the move pin) and
      `Vision: §3, §7, §14, §22, §23`.
- [ ] Commit 2, `SPEC: WP-806 / EC-843 govern-close — …`:
  - D-24713 Active;
  - the ewiki §Build status and OQ7;
  - STATUS;
  - WORK_INDEX `[x]` ("live-verify via WP-807");
  - EC_INDEX Done;
  - mindmap ✅ + `pnpm roadmap:counts:write` + `:check`;
  - `pnpm ledger:numbers:check`;
  - the 01.6 post-mortem, or why none.
- [ ] Neither commit subject contains a Rule 1 token (WIP / fix stuff / misc / tmp / updates / changes / debug). Write
      "operator match".

## Common Failure Smells
- The bot or a sim calls a setter, or `simulation.moveDispatch.drift.test.ts` reds → a setter was added to sim dispatch.
- The sentinel hash moved → `operatorSetAside` (or `{}`) is written at setup.
- `discardFromHand.test.ts` drift guard reds → a raw hand→discard idiom was added.
- A twist reveal does nothing visible → the card was moved to the top but `performVillainReveal` was never called.
- The escaped Villain is still in the City → space 4 wasn't cleared before `resolveVillainEscape`.
