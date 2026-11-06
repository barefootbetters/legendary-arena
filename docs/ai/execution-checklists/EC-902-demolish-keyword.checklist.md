# EC-902 — Demolish: Fin Fang Foom's Master Strike, Trull the Unhuman, Zzutak and Piledriver (Execution Checklist)

**Source:** docs/ai/work-packets/WP-864-demolish-keyword.md
**Risk Tier:** MEDIUM — gameplay logic (Hero Deck order, every player's hand); no new `G` field, no auth, money, persistence or
server surface
**Layer:** Game Engine (shared Demolish resolver, one Master Strike arm, one villain primitive) + card data

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] The WP-864 / EC-902 / D-24807 reservation (#3172) is on `main`.
- [ ] `pnpm -r build`, then game-engine and dashboard `test`, exit 0; record the counts (game-engine 6299 / 0 at draft).
- [ ] Re-read at HEAD: the `mastermindStrikeHandler` branch chain and terminal emission; `VILLAIN_EFFECT_PRIMITIVES` (39, last
      `hq-hero-gains-size-changing`) and its length pins in `rules/villainAbility.types.test.ts`; the terminal `parts.length === 1`
      parse branch in `setup/villainAbility.setup.ts` and in the marker script; `selectDefaultCostDiscardCard`.

## Locked Values (do not re-derive; verify at HEAD)
- **Module:** `packages/game-engine/src/board/demolish.logic.ts` exports `demolishEachPlayer(G, currentPlayer: string | null,
  logPrefix: string): DemolishResult`, `DemolishResult { revealedCardId: CardExtId | null; cost: number | null; discards:
  DemolishDiscard[] }` and `DemolishDiscard { playerId: string; cardId: CardExtId }`.
- **Order inside one call:** read `G.heroDeck[0]`. If it is undefined, log the empty-deck line and return. Otherwise rebind
  `G.heroDeck = [...G.heroDeck.slice(1), revealedCardId]` and take `offPlayCardStats(G, id)?.cost`. If the cost is undefined, log
  the no-cost line and return. Otherwise log the reveal, then for each seat in `seatsInTurnOrderFrom(Object.keys(G.playerZones),
  currentPlayer)` run `selectDefaultCostDiscardCard(G, seat, [cost])`, then `discardFromHand` or the no-card line.
- **Logs** (`<name>` = `resolveCardName(G.cardDisplayData, id)`; `P` = raw `${playerId}`; `N` = `${cost}`; no `card` argument
  to `pushLog`):
  - empty deck: `${logPrefix} the Hero Deck is empty, so nothing is Demolished.` (`blocked`)
  - no cost: `${logPrefix} Demolish revealed <name> and put it on the bottom of the Hero Deck, but it has no cost, so no one
    discards.` (`blocked`)
  - reveal: `${logPrefix} Demolish revealed <name> (cost N) and put it on the bottom of the Hero Deck.` (`applied`)
  - discard: `${logPrefix} Player P discarded <name> (cost N).` (`applied`)
  - no card: `${logPrefix} Player P has no card that costs N to discard.` (`blocked`)
- **Strike:** `MASTERMIND_FIN_FANG_FOOM = 'chmp/fin-fang-foom'`; `MONSTERS_UNLEASHED_EXT_ID_PREFIX =
  'chmp-villain-monsters-unleashed-'`. `count` = non-null `G.city` ids with the prefix + `G.escapedPile` ids with the prefix,
  taken once. `total = 1 + count`. Header log `[Fin Fang Foom Master Strike] Demolish each player ${total} time(s): once, plus once
  for each of the ${count} Monsters Unleashed Villain(s) in the city and Escape Pile.` (`neutral`), then `total` calls with
  prefix `[Fin Fang Foom Master Strike]`. The dispatcher arm passes `resolveCurrentPlayer(strikeContext)`. The terminal
  `mastermindStrikeResolved` emission is unchanged.
- **Primitive:** `'demolish-each-player'` appended last (position 40) to `VillainEffectPrimitive` and `VILLAIN_EFFECT_PRIMITIVES`.
  No params, no descriptor fields, no grammar arm (the terminal branch parses it). Handler `villainEffectDemolishEachPlayer` →
  `demolishEachPlayer(G, currentPlayer, `${villainEffectTimingLabel(timing)} effect:`)`, returning `{ targets: [] }`. It is
  keyword-less, so there is no generic `<timing> effect:` line. The marker script's primitive list gains the same string.
- **Markers** (`inputs/villain-effect-markers.json`, `villains.chmp`): `monsters-unleashed/trull-the-unhuman` `ambush:
  ["captureBystander", "demolish-each-player"]`; `monsters-unleashed/zzutak` `escape: ["demolish-each-player"]`;
  `wrecking-crew/piledriver` adds `escape: ["demolish-each-player"]` and keeps `fight: ["koHeroCurrentPlayer"]`. Remove Trull's
  Ambush row from `_unassigned`. Trull's state order is capture then Demolish; its log shows the Demolish lines before the generic
  capture line (accepted, `villainDeck.reveal.ts` untouched). The Escape Demolish runs inline before the deferred D-24656 procedure.
- **Pins / provenance (sanctioned product-change edits, each citing WP-864 / D-24807):** `rules/villainAbility.types.test.ts`
  ordered list +`demolish-each-player`, length 39 → 40 at every length site, last-entry assert → `demolish-each-player`, and the "39" / "position 39"
  strings in the `it()` title and assert messages, and the `// why:` comments above the length asserts (~632 / ~667 / ~692:
  add "WP-864 (D-24807) 40", total → 40).
  `scripts/coverage/mechanic-provenance.json` `"demolish-each-player": { "wp": "WP-864", "decision": "D-24807" }`. Add pending
  `live-verify.json` rows for the Fin Fang Foom strike, Trull, Zzutak and Piledriver.

## Guardrails
- One Demolish implementation: the strike and the primitive both call `demolishEachPlayer`, with no second copy of RS-1.
- Exactly one Hero Deck reveal per call. Rotate by rebind, never `.shift()` / `.splice()`. Deck length is unchanged.
- Every discard goes through `discardFromHand`. Demolish parks no seat choice of its own; the WP-498 / WP-705 reactions
  `discardFromHand` queues (`pendingReturnOnDiscard`, `pendingTeleportReturns`) are expected and left as they are.
- STOP if any other mastermind's strike test, a sentinel, or a golden hash changes.
- No new `G` field, move, UIState field, client or server file. `replay.execute.ts` is untouched. No sentinel moves.
- The Epic Fin Fang Foom face, other Demolish cards, the hollow flag and an interactive pick stay out of scope.
- Moves and handlers never throw. No `.reduce()`, no nested ternaries, no `any` / `@ts-ignore`. Never edit a test to pass. Never
  `git stash`.

## Required `// why:` Comments
- `demolish.logic.ts`: the single reveal ("reveal only one card", rules v23 p.24); the rebind rotation; the auto-pick (WP-821
  precedent, interactive pick deferred, D-24807); current-player-first order (D-24780); returning `discards` for later readers.
- `mastermindHandlers.ts`: the Fin Fang Foom constants, the Monsters Unleashed prefix grammar, the `1 + N` reading (D-24807
  interpretation) and the once-at-start count.
- `villainAbility.types.ts` / `villainEffects.execute.ts` / marker script: the appended primitive (WP-864 / D-24807).

## Files to Produce
- `packages/game-engine/src/board/demolish.logic.ts`: new.
- `packages/game-engine/src/rules/mastermindHandlers.ts`, `rules/villainAbility.types.ts`, `villain/villainEffects.execute.ts`:
  modified.
- `scripts/convert-cards/apply-effect-markers.mjs` and `scripts/convert-cards/inputs/villain-effect-markers.json`;
  `data/cards/chmp.json` (generated).
- Generated / provenance: `villain-mechanic-ledger.{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json` (expected unchanged), `hero-effect-coverage.baseline.json` (only if it moves),
  `mechanic-provenance.json`, `live-verify.json`; `in-play-hollow-baseline.json` + `useInPlayCoverage.test.ts` only if the in-play pin
  moves (the other `apps/dashboard/src/data/*` copies are gitignored).
- Tests: `packages/game-engine/src/board/demolish.logic.test.ts` (new; the WP Scope cases), `rules/villainAbility.types.test.ts`.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24807), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine and dashboard `test` 0. Sentinels byte-unchanged: no `finalStateHash` or golden-hash pin edited,
      only the sanctioned pins above.
- [ ] Provenance and pending live-verify rows added BEFORE the ledgers. After the regen these exit 0: `cards:check` (only
      `chmp.json` changed), `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`,
      `sim:runtime-observed:check`, `sim:coverage --check`, `cards:count-markers:check`; `pnpm --filter @legendary-arena/dashboard
      prebuild:coverage` 0. Engine test delta recorded (expect at least +12).
- [ ] Govern-close checks 0: `workindex:rows:check`, `workindex:executed:check`, `node scripts/check-number-ledger.mjs --check`;
      `git diff --name-only origin/main...HEAD` is inside `## Files to Produce`.
- [ ] D-24807 → Active, covering every clause of the WP's Reserved Decision. Also: STATUS updated; WORK_INDEX checked; EC_INDEX
      Done; mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) on a Fin Fang Foom match created after the deploy, checked from the Demolish log lines and hand
      sizes (Hero Deck order only in an operator debug match), or operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- The strike still logs only "strike count incremented": the arm is missing, or the id is not `chmp/fin-fang-foom`.
- The same card is revealed for every player: the reveal sits inside the per-player loop.
- The Hero Deck shrinks: the revealed card was removed but not appended to the bottom.
- Trull Demolishes before capturing, or never captures: the marker order is wrong, or `_unassigned` still holds the row.
- `cards:check` red: `chmp.json` was hand-edited, or the marker script's primitive list lacks the new string.
