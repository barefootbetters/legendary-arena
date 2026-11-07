# EC-910 — Mandarin's Rings cross-player and Villain Deck Fight lines: Liar claim, Nightbringer Villain Deck defeat + reorder, Remaker give-right (Execution Checklist)

**Source:** docs/ai/work-packets/WP-872-villain-fight-cross-player-and-villain-deck.md
**Layer:** Game Engine (+ card data and card-data-derived feeds)
**Risk Tier:** MEDIUM — gameplay rules (three new villain-effect primitives, one new lazily created hashed `G` queue, six seat-choice kinds, one of them addressed to a non-active seat, and a hidden-information prompt), plus card data and derived determinism feeds; no auth, money, persistence or server surface

## Before Starting
- [ ] Scope lock: only the files in Files to Produce change (plus the governance close files); check with `git status --porcelain`.
- [ ] Re-baseline on `origin/main`; WP-872 Assumes 1-16 hold. If WP-870 or WP-869 landed first, re-read the last `VILLAIN_EFFECT_PRIMITIVES` entry, every count pin, the rvlt `mandarins-rings` marker block, `ALL_PENDING_FIELDS` / `isOperatorChoiceOpen`, the onMove opener order, the loop mirror sites and `defeatCityVillainCore`'s tail (WP-869 adds a Fight bridge there: it joins the extracted helper). If WP-869 landed: its two stack-origin routes move with the routing block, `routeDefeatedVillainCard` also returns `stackBystandersRescued`, its pre-event entry-count stays in the core, and only its post-event bridge call moves into `runVillainFightFireSiteBridges` after the reenter bridge (WP Assumes 2).
- [ ] Confirm copies: Liar `henchman-mandarins-rings-03`, Nightbringer `-05`, Remaker `-06` (D-24803).
- [ ] `pnpm -r build` → 0; engine test total recorded; every `:check` in WP Verification 3 → 0; dashboard `typecheck`, `lint`, `run format:check` → 0, all before any edit.

## Locked Values (do not re-derive)
- Primitives appended last, in order, no parameter: **`look-other-player-deck-top-claim-current`**, **`reveal-villain-deck-defeat-low-vp-current`**, **`give-card-to-right-player-current`**. No `setup/villainAbility.setup.ts` arm (terminal `parts.length === 1`).
- Markers (rvlt `mandarins-rings` `cards`, alphabetical): `liar-the-mento-intensifier`, `nightbringer-the-black-light`, `remaker-the-matter-rearranger` → `{ "fight": ["<primitive>"] }`; remove their three `_unassigned` rows.
- `G.pendingVillainFightPicks?: PendingVillainFightPick[] | undefined` and `PendingSeatChoice.villainFightPick?` (types exactly as in the WP Locked Values), the queue lazy and never seeded, the payload unprojected.
- `moves/villainFightPick.logic.ts` exports: kinds `liar-target`, `liar-claim`, `liar-decide`, `nightbringer-defeat`, `nightbringer-order`, `remaker-give` (`*_SEAT_CHOICE_KIND`), `isVillainFightPickKind`, `queueVillainFightPick`, `rightNeighborSeat` (last of `seatsInTurnOrderFrom(Object.keys(G.playerZones), seat)`; `undefined` with one seat), `openVillainFightPickSeatChoiceIfNeeded`, `applyVillainFightPickResolvedSeatChoice`, `chainVillainFightPick`; `PERMUTATIONS_OF_TWO` / `PERMUTATIONS_OF_THREE` (index 0 = as revealed; the WP's literal order).
- Handlers, opener, applies, chain and every log line / option label: verbatim from WP Locked Values. All six defaults are 0: first other seat; "Good"; the fighter's discard; decline; as revealed; give nothing.
- Liar log card argument: `sourceCardId` on every Liar line except the `liar-decide` `applied` line (`lookedAtCardId`).
- `nightbringer-defeat` chain acts only when the Villain Deck top equals the applied payload's post-apply `revealedCardIds` in order (fails only on drift).
- Liar top-up (`reshuffleDiscardIntoDeck`) only in the handler (fixed target) or the `liar-target` apply; never in the opener.
- Nightbringer eligibility: `villainDeckCardTypes` `'villain'` | `'henchman'` and `heistRevealedVictoryPoints ≤ 2`. The defeat apply removes the card from the Villain Deck, calls `recordVillainDefeated` only when `matchHasFightRestrictionKind(G, 'requires-villain-defeated-this-turn')`, logs, then `routeDefeatedVillainCard` (Victory Pile, or the Skrull / Officer / Micro-Sized route). Order: defeat → put back → Fight effect. Requirements and fight restrictions are not checked (free defeat, D-24737).
- `moves/fightVillain.ts`: the converted-origin routing block (L615-648) moves verbatim into exported `routeDefeatedVillainCard(G, currentPlayer, cardId)` returning `{ skrullGained, officerGained, microSizedGained }` (plus `stackBystandersRescued` if WP-869 landed first); the Endless Armies + Mr. Immortal blocks move verbatim into exported `runVillainFightFireSiteBridges(G, ctx, cardId, shuffleContext)`, the core's last call; new export `resolveVillainDeckDefeatFightEffect(G, ctx, cardId, shuffleContext)` = `executeVillainAbilities(…, 'onFight', shuffleContext)` (no `cityIndex`) + the `Fight effect:` line + the bridges; the chain passes `{ currentPlayer: payload.fighterSeat, turn: readTurnNumber(ctx) }` as its ctx.
- Wiring: onMove opener immediately before `openEnigmaPeekSeatChoiceIfNeeded`. `applySeatChoiceByKind` arm → `applyVillainFightPickResolvedSeatChoice(G, choice, shuffleContext)`, placed before the `applySeatChoiceCard` / generic-log fall-through. Payloads copy arrays; `liar-target` payload `{ sourceCardId, fighterSeat }`. Chain call after the Size-Changing chain with the applied choice captured before the delete.
- Lockstep: `dropAllPendingPlayerChoices` + `ALL_PENDING_FIELDS`; `isOperatorChoiceOpen` + one row; `onBegin` + `applyOnBeginParity` guarded delete; the opener after `openRevealOrWoundSeatChoiceIfNeeded` (after WP-870's mirror if present) in `simulation.runner.ts` ×2, `par.aggregator.ts` ×2, `runFixture.ts` (`events` undefined).
- Provenance: three keys `{ "wp": "WP-872", "decision": "D-24817" }` after the last villain primitive key.
- Feeds vs execution-time baseline: villain ledger executable +3, unmarked −3, distinctMechanics +3; effect index executable +3, unmarked −3. Unchanged: card-mechanics, runtime-observed, coverage baseline, hero ledger, lagn schema, dashboard `useInPlayCoverage`.

## Guardrails
- No new move, UIState field or `apps/**` change; every new kind rides `pendingSeatChoice` / `resolveSeatChoice`.
- No log line names the Liar card or passes its id as the card argument before it lands in a discard pile; `liar-decide` labels never name it.
- `defeatCityVillainCore` byte-identical in behavior; every existing fight / defeat-choice / Secret Invasion / Brainwash / Trap Heroes / Endless Armies / Mr. Immortal test passes unedited. The only behavior-change edit to an existing assertion is `henchmanVariantCopies.test.ts` L219 (Liar now marked), stated in the `EC-910:` body; the other existing-test edits are the lockstep pins in Files to Produce.
- Nightbringer: no fight cost, no paid rescue, no Enigma offer, no Excessive Violence, no `fightResolved`, no Diamond Form signal.
- The handlers never import the module back at evaluation time (function-body-only cycle, the WP-828 `// why:`).
- Card data only through `apply-effect-markers.mjs` (re-run applies 0); map edits keep per-line format.
- An unexpected feed delta that also shows on clean `origin/main` is recorded drift; any other delta or hash-oracle move is a STOP.
- Pins are runtime assertions (D-24372); no `satisfies`, `any`, `@ts-ignore`, `.reduce()`, nested ternaries; moves never throw.

## Required `// why:` Comments
- Union + array + marker list: the three printed lines, WP-872 / D-24817, the append position.
- Each handler: why it queues (no `events`, D-24761 / D-24779); Liar's solo no-op and top-up placement; Remaker's right = previous seat (D-24500 mirror) and solo no-op.
- Module: per-step state in the payload; effect in the apply, next park in the chain; the hidden-card rule; Nightbringer's ruling order; the import cycle.
- `fightVillain.ts`: both extractions (one routing and one bridge list for both defeat paths); the deck defeat is not a fight; a Micro-Sized card falls back to the defeater (D-24805).
- `seatChoice.resolve.ts`: the arm and the chain (live `events` / `ctx` / `random`); the timeout residual.
- T20's deep-dist import: the WP-411 / D-24223 exception. Each lockstep site; the new `G` field (lazy, hashed, never seeded).

## Files to Produce
- Engine **modified** (`packages/game-engine/src/`): `rules/villainAbility.types.ts` + `.test.ts`, `villain/villainEffects.execute.ts`, `types.ts`, `moves/seatChoice.resolve.ts`, `moves/fightVillain.ts`, `game.ts`, `endgame/mastermindVictory.logic.ts` + `.test.ts`, `moves/operatorSetters.logic.ts` + `moves/operatorSetters.test.ts`, `villainDeck/henchmanVariantCopies.test.ts` (L219 + copies 5, 6), `simulation/onBeginParity.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts`
- Engine **new**: `moves/villainFightPick.logic.ts`, `villain/mandarinsRingsCrossPlayerFight.test.ts` (T1-T20, T14b, T16b)
- Scripts **modified**: `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json`
- **Regenerated**: `data/cards/rvlt.json`; `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`; `data/metadata/effect-implementation-index.json`
- Governance: `docs/ai/work-packets/WP-869-converted-bystander-villain-split-groot.md` and `docs/ai/execution-checklists/EC-907-converted-bystander-villain-split-groot.checklist.md` (only if WP-869 is unexecuted at close; Assumes 2), `docs/ai/DECISIONS.md` (D-24817 Active), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/coverage/live-verify.json`

## After Completing
- [ ] T1-T20 (+ T14b, T16b) pass; `pnpm -r build` 0; dashboard `prebuild:coverage` + `prebuild:effect-index`, then `pnpm -r --no-bail test` 0 fail; dashboard `typecheck`, `lint`, `run format:check`, `run test:coverage` → 0.
- [ ] Marker pass `3 new`, re-run `0`; only `rvlt.json` changes.
- [ ] Feeds regenerated, every WP Verification 3 `:check` → 0, deltas as locked, line-ending churn reverted, hash oracles unchanged.
- [ ] WP Verification 5 control runs and 6 revert proofs observed and recorded in the `EC-910:` body.
- [ ] Allowlist-only diff. Two commits: `EC-910:` then `SPEC:` (if WP-869 is unexecuted, the `SPEC:` also amends WP-869 + EC-907 to target the two helpers; D-24817 locks that later bridges / routes go in them) (D-24817 Active with Rulings 1-3, STATUS follow-ups, indices, mindmap `✅` + `roadmap:counts:write`, ledger LANDED; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0).
- [ ] D-24026 live-verify recorded, or operator-pending.

## Common Failure Smells
- The target's prompt or the log shows the Liar card early → a label or the look line carries the card (T3 / T9).
- The target can't answer in a live match (T20 red after the claim) → `liar-decide` parked without `events` / `ctx?.currentPlayer`, so no stage ride.
- A sim or PAR run stalls or the queue grows across turns → a loop mirror or lockstep site is missing.
- A Skrull defeated by Nightbringer lands in the Victory Pile → the apply skipped `routeDefeatedVillainCard`.
- T20 fails about half the time → it hard-codes seat 0 as the fighter (the first player is random).
- Endless Armies plays nothing via Nightbringer → `resolveVillainDeckDefeatFightEffect` skips the bridges.
- Nightbringer's Fight effect line precedes the put-back line → the chain ran the Fight before parking the order step.
- Remaker's card lands with the left neighbour → `rightNeighborSeat` used the next seat.
- A count pin is off by more than 3 → another villain-primitive WP landed first; re-read, do not guess.
