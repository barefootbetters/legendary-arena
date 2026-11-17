# EC-806 — Killmonger Mastermind (Execution Checklist)

**Source:** docs/ai/work-packets/WP-769-killmonger-mastermind.md
**Layer:** Game Engine
**Risk Tier:** MEDIUM — ranked integrity: Killmonger is fought for about a third of his printed cost
**Reconciled:** 2026-11-16 on `main` `4de2e5301`, anchors re-checked on `293255f4b` (see the WP's Reconciliation header). The WP wins any conflict.

## Before Starting
- [ ] WORK_INDEX shows WP-497, WP-684, WP-687, WP-736, WP-750, WP-757, WP-768, WP-821, WP-827, WP-830, WP-846, WP-867, WP-873, WP-840 `[x]`; WP-769 `[ ]`; WP-771 not started.
- [ ] D-24602 / EC-806 / WP-769 are still reserved and unconsumed in `docs/ai/NUMBER-LEDGER.md`.
- [ ] `pnpm install`, `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail (baseline: game-engine 7343, arena-client 2726).
- [ ] Re-read every WP Assumes anchor (1-15). Target files = §Files to Produce (scope lock). In particular:
  - `fightMastermind` step order (Indestructible Man block `:193-204`, price `:211-222`, stage `:229`, block-all `:234-284`, heal `:288`, Enigma `:296-299`, Step 3 `:325-382`) and `defeatMastermindTacticCore` (`:473`, `dispatchTacticOnFight` `:625`);
  - `resolveMastermindFightCost` (`economy.resolve.ts:508-534`);
  - `gainWoundForPlayer`'s interception lines (`board/wounds.logic.ts:95-97`);
  - `mastermindStrikeHandler` (`:1580`), its Indestructible Man arm and hollow `else`;
  - `dispatchTacticOnFight` (`tacticHandlers.ts:1606`), the Indestructible Man arms (`:1811-1829`);
  - `buildHandDiscardChoice` / `applyHandDiscard` (`seatChoiceTactics.ts:467` / `:511`), `applySeatChoiceByKind` (`seatChoice.resolve.ts:670`);
  - `getLegalMoves` step 4 (`:1264-1307`), 4b, 4c; the 56-move list;
  - `isSchemeLossPile` (`rules/schemeResourceLoss.ts:442`); HYDRA Conspiracy's draw counter (`tacticHandlers.ts:722-736`);
  - the autoplay deny-list (`apps/server/src/autoplay/botLoopProgress.mjs:105-126`).
  - `UIMastermindState` and the `fortifiedReason` build (`uiState.build.ts:836-846`) / filter lines.
- [ ] Run the T14 engine-runner baseline (scratch scenario) and keep the output. Recorded at reconcile: `winRate 1`, `averageTurns 10.8`, `woundsAverage 0.2`.

## Locked Values (do not re-derive)
- Wound source (operator default): KO pile first (first `pile-wound` in `G.ko`, `moveCardFromZone`), else the Wound Stack top (`G.piles.wounds[0]`); returns go to the stack bottom.
- Mastermind `bkpt/killmonger`; tactic prefix `bkpt-mastermind-killmonger-`; tactic ids `…-a-scar-for-every-kill`, `…-rite-of-challenge`, `…-throw-from-the-waterfall`, `…-altar-of-resurrection`.
- **Contract:** `MastermindState.wounds?: CardExtId[]`, omit-when-empty (delete, never `[]`), real Wound ids only.
- **`mastermind/mastermind.logic.ts`** (imports types plus `WOUND_EXT_ID` / `moveCardFromZone` from leaf modules) adds the generic helpers (the last three **mutate G in place**: reassign `G.mastermind = { ...G.mastermind, … }`, `G.ko`, `G.piles.wounds` from new arrays; never `.push` / `.splice` a held array; header note updated) `countMastermindWounds(mastermind)`, `hasAvailableWound(G)`, `takeWoundForMastermind(G)` (KO pile first; removing `G.ko[i]` with `i < G.koPileLengthAtTurnStart` decrements that field when present, D-24568), `takeWoundFromMastermind(G)`, `returnMastermindWounds(G)`.
- **`mastermind/killmonger.logic.ts`** exports `KILLMONGER_MASTERMIND_ID`, `KILLMONGER_TACTIC_ID_PREFIX`, `KILLMONGER_ATTACK_LOCK_REASON`, `isKillmonger`, `isKillmongerAttackLocked(G, playerId)`, `canWoundMastermind(G, playerId)`. It imports `economy.resolve` and `mastermind.logic`; neither imports it. The transitive runtime cycle back through `economy.resolve` is the D-24601 item-13 class: no top-level read of a `killmonger.logic` binding anywhere; the four tactic ids in `tacticHandlers.ts` are string literals. No boardgame.io import; never throws.
- **Lock reason, verbatim:** `Killmonger can't be fought while he has more than 0 Attack. Spend Attack equal to his Attack to Wound him and get +1 Recruit.`
- **Cost:** `resolveMastermindFightCost` subtracts `countMastermindWounds(G.mastermind)` (from `mastermind.logic.ts`) inside its 0 floor (generic). The wound cost is that value, not `resolveMastermindFightPrice`.
- **Wound return:** last step of `defeatMastermindTacticCore`, after `dispatchTacticOnFight` and the all-tactics log: append every held Wound to the end (bottom) of `G.piles.wounds`, delete the field, log `Killmonger's N Wound(s) returned to the Wound Stack.` when N > 0. Not on `awardMastermindOnFinalBlow`.
- **Fight lock:** `fightMastermind` step 1, after the Indestructible Man block: `if (isKillmongerAttackLocked(G, ctx.currentPlayer)) return;`. At Attack 0 the normal fight runs (no Recruit).
- **EV:** the affordability check uses the step-1 `spendableAttack`; fix the stale comments `:318-322`, `:345-349`.
- **`woundMastermind()`**, `client: false`, no args, an `export function` declaration (hoisted; the MOVE_MAPs read it at module top level):
  - Validation, in order, silent returns: `canWoundMastermind(G, ctx.currentPlayer)` → spendable (target `'mastermind'`) ≥ cost → stage `main` → `hasAnyPendingChoice(G)` (`moves/phaseCard.ts:82`).
  - **Not** checked: Haunt, guard, Enigma, Healing. Not set: `hasActedThisTurn`, the Diamond Form edge. No EV.
  - Mutation, in order: `G.turnEconomy = spendFightCostForTarget(G.turnEconomy, cost, 'mastermind')` → `takeWoundForMastermind` (KO pile first, else the stack top) → `G.turnEconomy = addResources(G.turnEconomy, 0, 1)` → log `Player P spent N Attack to Wound Killmonger and got +1 Recruit; he has W Wound(s) and A Attack now.`
- **`board/wounds.logic.ts`:** module-private `offerWoundInterception(G, playerID, woundCardId)` = `if (!checkDivingBlock(...)) checkFlyingShieldBlock(...)`, called by `gainWoundForPlayer` (byte-identical) and by exported `gainHeldWoundWithOutcome(G, playerID, woundCardId): WoundGainOutcome` (no zones → the Wound goes to the bottom of `G.piles.wounds`, `'no-wound'`; else land in discard, offer, report `'gained'` / `'diving-block-pending'` exactly as `gainWoundWithOutcome`: a pending Flying Shield Block still reports `'gained'`). `offerWoundInterception`'s `// why:` names the drift it prevents (the draft skipped Flying Shield Block).
- **Seat order:** `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)` (strike, Rite); the Waterfall's simultaneous choice addresses the other seats ascending (`.sort()`).
- **Strike** (`resolveKillmongerStrike`, `else if` before the hollow `else`, prefix `[Killmonger Master Strike]`), per seat in turn order:
  - `countDistinctHeroClassesYouHave(G, seat) >= 4` → unaffected + `strikeBlocked` notable event;
  - else Killmonger holds a Wound → `takeWoundFromMastermind` → `gainHeldWoundWithOutcome` → `describeStrikeWound` log;
  - else hand > 4 → current player parks `{ choiceType: 'discard-to-limit', playerID, limit: 4 }`; others `selectDiscardToLimitCards(G, hand, hand.length − 4)` (a **count**) + `discardCardFromHand`; hand ≤ 4 → nothing.
- **Scar:** `G.turnEconomy = addResources(G.turnEconomy, 0, count)`, count = defeater Victory-Pile cards with `G.villainDeckCardTypes[id] === 'villain'`; 0 → `'neutral'` line.
- **Rite:** turn order; each seat with no `bkpt-mastermind-killmonger-` card in its Victory Pile, while he holds a Wound, gains one via `takeWoundFromMastermind` + `gainHeldWoundWithOutcome` (`// why:` the prefix also matches his base card, which reaches a Victory Pile only on the Final Blow). Runs before the return.
- **Waterfall:** if `G.turnEconomy.drawsLocked === true` (D-24552) → `'blocked'` line `Fight effect: Player P can't draw 2 card(s) — no more draws this turn (Throw from the Waterfall).`, no draw; else `drawCardsIntoHand(defeaterZones, 2, shuffleContext)`; `drawn` = hand growth; `G.turnEconomy.cardsDrawn += drawn` (D-24732); log `Fight effect: Player P drew N card(s) (Throw from the Waterfall).`; then `buildKillmongerWaterfallDiscardChoice(G, otherSeatsWithCards)` → `parkSeatChoice(G, events, choice)`; solo / no cards → `'neutral'` line. Kind `KILLMONGER_WATERFALL_DISCARD_KIND = 'killmonger-waterfall-discard'`, default index 0; `applyKillmongerWaterfallDiscard` (label `Throw from the Waterfall`) in `applySeatChoiceByKind`; added to the `ai.seatChoice.ts` least-valuable list.
- **Altar:** reachable only (left = next seat clockwise, right = previous seat; solo = defeater; any holding a `'villain'` card in its Victory Pile) → `recordHollowEffect(G, { cardId, cardType: 'mastermind', timing: 'onFight', mechanic: 'villain-wound', reason: 'unsupported-keyword', turn: readTacticTurn(ctx) })`.
- **Projection:** `UIMastermindState.woundCount?: number` (≥ 1 Wound, any Mastermind; persists after the Final Blow award); `woundable?: true` (iff `canWoundMastermind(G, ctx.currentPlayer)`); `fortifiedReason` precedence guard → Indestructible Man lock → Killmonger lock (while locked and a Tactic or the Final Blow is left). Filter: conditional spreads, public to every audience. Update the `fortifiedReason` JSDoc / comments.
- **Bot:** step 4 Killmonger branch (no plain intent while locked); step 4d after 4c: `stage === 'main' && tacticsDeck.length > 0 && canWoundMastermind && spendable >= cost && !isLastLossPileWound(G)`, evaluated left to right (the scheme read after the `?.`-guarded Killmonger check) (module-private: `isSchemeLossPile(G, 'wounds')` and no Wound in `G.ko` and `G.piles.wounds.length <= 1`) → `{ name: 'woundMastermind', args: {} }`. `SCORE_WOUND_MASTERMIND_BASE = 110`.

## Guardrails
- Every lockstep site updates together: `game.ts`, `game.test.ts` (title + list, 56 → 57), `recruitSidekick.test.ts` (56 → 57), `index.ts`; `SIMULATION_MOVE_NAMES` + step 4d; `ai.competent` score; `simulation.runner` / `par.aggregator` MOVE_MAPs + the drift test; `replay.execute`; `runFixture`.
- The move name does not start with `resolve…` (autoplay deny-list, D-24591).
- Only `wounds?` is new in `mastermind.types.ts`; only `woundCount?` / `woundable?` in `UIMastermindState`; D-24602 records both.
- Every WP-768 branch stays intact: the `isShuffleFight` path, the `!isShuffleFight` Enigma gate, the step-4 Indestructible Man branch, `shuffleFight`, his `fortifiedReason` lock.
- Sanctioned pin edits only: `mastermindStrike.unresolved.test.ts` 16 → 17; `recruitSidekick.test.ts` T15 move count 56 → 57 (`:359`); a KO-site `LOCKED_TABLE` row only if a KO site is added.
- Core oracles unchanged. No new randomness. Engine only. Moves never throw. No `.reduce()`.

## Required `// why:` Comments
- The −1-per-Wound term (keyword + rules v23 L2213-2246).
- The return runs after `onFight` (Rite) and on every defeat path; bottom of the stack (L2246).
- `woundMastermind` is not a fight: no Haunt / guard / Enigma / Healing lock, no `hasActedThisTurn`, no Bystander rescue.
- KO pile before the Wound Stack (operator default); illegal when no Wound exists.
- The wound cost is his Attack, not the Size-Changing fight price.
- The lock rides `fortifiedReason`; no Recruit on the fight at 0.
- The EV pre-defeat read.
- The reveal pool (rules v23 "Revealing a Card", D-24651) and dual / split classes.
- The shared interception and the return-to-stack residual.
- The bot score of 110, step 4d placement and its two restrictions (no Final Blow wounding, no self-inflicted Wound-Stack loss).
- The Altar reachability and the League deferral.

## Files to Produce
- `packages/game-engine/src/mastermind/mastermind.types.ts` — **modified** (contract)
- `mastermind/mastermind.logic.ts` (+ test) — **modified** (generic Wound helpers)
- `mastermind/killmonger.logic.ts` + test, `moves/woundMastermind.ts` + test — **new**
- `economy/economy.resolve.ts` (+ test), `moves/fightMastermind.ts` (+ test), `board/wounds.logic.ts` (+ test) — **modified**
- `rules/mastermindHandlers.ts` (+ test), `rules/tacticHandlers.ts` (+ test), `moves/seatChoiceTactics.ts` (+ test), `moves/seatChoice.resolve.ts` (+ test), `simulation/ai.seatChoice.ts` (+ test) — **modified**
- `game.ts`, `game.test.ts`, `moves/recruitSidekick.test.ts` (56 → 57), `index.ts`, `simulation/ai.legalMoves.ts` (+ test), `simulation/ai.competent.ts` (+ test), `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `simulation/simulation.moveDispatch.drift.test.ts`, `replay/replay.execute.ts`, `test/fixtures/runFixture.ts` — **modified**
- `ui/uiState.types.ts`, `ui/uiState.build.ts` (+ test), `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — **modified**
- `rules/mastermindStrike.unresolved.test.ts` — **modified** (16 → 17)
- `types.ts` (`:3229-3232`), `hero/heroConditions.evaluate.ts` (`:1136`), `game.ts` (`:1088`) — **comment-only** (the KO pile's append-only premise, amended by D-24602)
- `hero/ownedCardKoTrigger.test.ts` — **modified only if** a KO site is added (sanctioned `LOCKED_TABLE` row; none planned)
- `scripts/coverage/tactic-provenance.json`, `scripts/coverage/strike-provenance.json`, `data/metadata/effect-implementation-index.json` — **modified / regenerated**
- `docs/ai/coverage/live-verify.json` (pending row); hollows / baseline feeds only if `:check` moves
- Governance: `DECISIONS.md` (D-24602), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`, `post-mortems/01.6-WP-769-killmonger-mastermind.md`

## After Completing
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail (paste every package's totals).
- [ ] `pnpm effect-index:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`, `pnpm gauntlet:loadouts:check`, `pnpm cards:check`, `pnpm ledger:villains:check`, `pnpm ledger:heroes:check`, `pnpm mechanics:metadata:check`, `pnpm spike:local-bundle --check` → 0.
- [ ] Revert proofs (lock, Wound return order, EV read, step 4d) recorded in the post-mortem.
- [ ] T14 engine-runner branch run beside the baseline: exit 0, summary differs from the baseline, `winRate` / `averageTurns` recorded (no threshold).
- [ ] D-24602 Active; STATUS; WORK_INDEX `[x]` + `[live-verify: pending]`; EC_INDEX Done; mindmap `✅`; `pnpm roadmap:counts:write` then `pnpm roadmap:counts:check` → 0; `pnpm ledger:numbers:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`, `pnpm workindex:liveverify:check` → 0; NUMBER-LEDGER LANDED; one `pending` `live-verify.json` row.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026) after deploy, as its own `SPEC:` PR.

## Common Failure Smells
- The sim hangs on Killmonger → `woundMastermind` is not emitted, not in a MOVE_MAP, or not scored (unknown moves score 0).
- The bot FAULTs → step 4d and the move gate disagree (cost, Wound availability).
- Rage's "Hero KO'd this turn" bonus lost after a wound → `koPileLengthAtTurnStart` was not decremented for a pre-snapshot KO-pile Wound.
- Legacy Virus lost to the bot's own wound → the step-4d Wound-Stack guard is missing, or the source is stack-first.
- Rite gives out no Wounds → the return ran before `onFight`.
- A Flying Shield Block holder never gets offered a Killmonger Wound → the held-Wound path skipped the shared interception.
- The strike discards exactly 4 cards → the limit was passed instead of the count.
- A core hash moved → `wounds` was seeded as `[]`, or the cost term changed for an unwounded Mastermind.
- The move-list test fails → a lockstep site was missed.
- Fight works at Attack 5 → the lock is missing; the live button is live → `fortifiedReason` was not set.
- Indestructible Man tests fail → a WP-768 branch was disturbed.
