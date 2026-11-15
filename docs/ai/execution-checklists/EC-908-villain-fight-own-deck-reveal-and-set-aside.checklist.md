# EC-908 — Mandarin's Rings own-deck Fight lines: Lightning / Daystar KO-or-keep, Spin cost-0 discard + reorder, Zero next-hand card (Execution Checklist)

**Source:** docs/ai/work-packets/WP-870-villain-fight-own-deck-reveal-and-set-aside.md
**Layer:** Game Engine (+ card data and card-data-derived feeds)
**Risk Tier:** MEDIUM — gameplay rules (three new villain-effect primitives, one new lazily created hashed `G` queue, one new seat-choice kind) plus card data and derived determinism feeds; no auth, money, persistence or server surface

## Before Starting
- [ ] Scope lock: only the files in Files to Produce change (plus the governance close files); anything else is a blocker. Check with `git status --porcelain`.
- [ ] Re-baseline on `origin/main`; WP-870 Assumes 1-14 hold. If WP-868, WP-869 or WP-871 landed first, re-read the last `VILLAIN_EFFECT_PRIMITIVES` entry, every count pin, the antm block of `villain-effect-markers.json`, and the `ALL_PENDING_FIELDS` / `isOperatorChoiceOpen` lists.
- [ ] Confirm the copy mapping: Lightning = `henchman-mandarins-rings-04`, Spin = `-08`, Zero = `-09` (D-24803).
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/game-engine test` → 0 fail; record the total (6455 at `03867810`). Every `:check` gate in WP Verification 3 exits 0 before any edit. `pnpm --filter @legendary-arena/dashboard typecheck`, `lint`, `run format:check` → 0 before any edit.

## Locked Values (do not re-derive)
- Primitives appended last, in order: **`reveal-top-may-ko-current`** (no param), **`reveal-top-discard-zero-cost-current:<N>`** (2 tokens, positive N → `magnitude`; bare, `:0`, `:x`, `:6:x` → `null`), **`next-hand-from-play-zero-cost-current`** (no param).
- Markers: rvlt `mandarins-rings` `cards`: `lightning-the-electro-blast` → `reveal-top-may-ko-current`; `spin-the-vortex-beam` → `reveal-top-discard-zero-cost-current:6`; `zero-the-ice-blast` → `next-hand-from-play-zero-cost-current`. antm villains `queens-vengeance`: insert `daystar` → `reveal-top-may-ko-current` in alphabetical order (between `blackbird` and `gigantus`). Remove `_unassigned` rows lightning, spin, zero; keep liar, nightbringer, remaker.
- New `G` field (`types.ts`, beside `pendingOutOfTimeGrants`): `pendingNextHandFromPlayPicks?: PendingNextHandFromPlayPick[] | undefined` with `export interface PendingNextHandFromPlayPick { playerID: string; sourceCardId: CardExtId; }`, lazy, never seeded.
- `moves/nextHandFromPlay.logic.ts`: `NEXT_HAND_FROM_PLAY_SEAT_CHOICE_KIND = 'next-hand-from-play'`, `queueNextHandFromPlayPick`, `openNextHandFromPlaySeatChoiceIfNeeded`, `applyNextHandFromPlayResolvedSeatChoice` (the `outOfTimeGrant.logic.ts` shape); never imports `villainEffects.execute.ts`.
- Log references: every `{card}` / `{source}` in the Lightning, Spin and Zero lines is `formatCardRef(G.cardDisplayData, id)` (`{source}` = the Zero copy), that id passed as the 4th `pushLog` argument.
- Lightning: the WP-754 park for `currentPlayer` (reshuffle-on-empty reveal; one entry `isKoAllowed: true`, `isDiscardAllowed: false`; the queued-behind branch), its two log lines verbatim, `{ targets: [], pending: true }`; empty: `Player {p} had no card to reveal on top of their deck (reveal-top).` `blocked`, `{ targets: [] }`.
- Spin (cost 0 = the villain module's `resolveRevealedDeckTopCost` === 0: stats cost, Wound = 0; unknown = not 0): reshuffle when `deck.length < N`; look at `deck.slice(0, N)` in order; each cost-0 card deck → discard (`moveCardFromZone`), `Player {p} discarded {card} from the top of their deck (cost 0).` `applied`; `remaining >= 2` → push `{ choiceType: 'reorder-deck-top', playerID, cardIds: deck.slice(0, remaining) }` + `Player {p} puts the other {remaining} revealed cards back in any order.` `neutral`; nothing looked at → `Player {p} had no cards to reveal (cost-0 discard).` `blocked`.
- Reorder drift (`resolveReorderChoice`, its only change): when the owner's deck is shorter than `front.cardIds.length` (L120) or `deck.slice(0, front.cardIds.length)` is no longer a permutation of `front.cardIds` (L121), shift the front (delete the queue when empty) and log `Player {p}'s revealed cards are no longer all on top of their deck; nothing to put back in order.` `neutral`; both returns become the drop, never return with it queued. The L111 submission-permutation check stays first (the drop fires only on a permutation submission against a drifted deck); a non-permutation submission stays a no-op (queue intact). The existing drift case (`reorderChoice.resolve.test.ts` L192-198, header L7-9) is rewritten to expect the drop: an intentional D-24815 change, stated in the `EC-908:` commit body.
- Zero's eligibility is stricter than `isZeroCostCard` (no stats entry = not eligible), recorded in D-24815.
- Zero handler: queue the pick + `Player {p} will add a 0-cost card they played this turn to their next hand ({card}).` `neutral`, `{ targets: [], pending: true }`.
- Opener: no-op while `pendingSeatChoice`, `hasAnyPendingChoice`, or `pendingHeroChoice` is open, or the match is decided (the `isAnotherChoiceOpenOrMatchOver` shape). Cost test: a local helper `G.cardStats[id]?.cost === 0` (not `isZeroCostCard`). Eligible = in-play cost-0 cards whose id occurs more times in `inPlay` than in `deferredHandInjections[p]` (copies counted), de-duplicated by display name (first instance, play order); 0 → `Player {p} played no 0-cost card to add to their next hand ({source}).` `blocked` + shift; 1 → record + shift; ≥2 → park seat choice (addressed `[p]`, options `{ label: name, cardId, sourceZone: 'inPlay' }`, `defaultOptionIndex` 0), entry stays queued. When the queue empties, `delete G.pendingNextHandFromPlayPicks`. Record: lazy-init + push (reuse `recordDeferredHandInjection` if cycle-free, else duplicate; note which), `Player {p} will add {card} to their next hand as an extra card ({source}).` `applied`.
- Consume log (`deferredHandInjection.logic.ts`, strings + header comment only): `{name} ({id}) was added to Player {p}'s hand as an extra card.` and `Player {p}'s extra card ({id}) could not be found to add to their hand; no effect.`; the header and the `types.ts` `deferredHandInjections` JSDoc name both writers.
- `game.ts`: onMove opener right after `openOutOfTimeGrantSeatChoiceIfNeeded`, before `openEnigmaPeekSeatChoiceIfNeeded`; play `onBegin` guarded-deletes the queue. `seatChoice.resolve.ts`: a kind arm in `applySeatChoiceByKind`.
- Queue lockstep: `dropAllPendingPlayerChoices` sets it `undefined` + `ALL_PENDING_FIELDS` += `'pendingNextHandFromPlayPicks'`; `isOperatorChoiceOpen` true on a non-empty queue + one test row; `applyOnBeginParity` deletes it; the opener mirrored directly after `openRevealOrWoundSeatChoiceIfNeeded` in `simulation.runner.ts` (2 sites), `par.aggregator.ts` (2 sites), `test/fixtures/runFixture.ts` (`events` undefined, the loop's active seat).
- Provenance: one `mechanic-provenance.json` key per primitive, `{ "wp": "WP-870", "decision": "D-24815" }`, after `hq-hero-gains-size-changing`.
- Expected feeds: villain ledger executable 224 → 228, unmarked 534 → 530, distinctMechanics 47 → 50; effect index executable 735 → 739, unmarked 981 → 977. Unchanged: card-mechanics, runtime-observed, coverage baseline, dashboard `useInPlayCoverage`.

## Guardrails
- No new player-facing pending-choice type, move, prompt or UIState field. Byte-unchanged: `moves/revealTopDispose.resolve.ts`, `moves/endOfTurnCleanup.logic.ts`, `hero/heroEffects.execute.ts`, all `apps/**` source. `moves/reorderChoice.resolve.ts`: the two drift returns (L120-121), their comments, the header / JSDoc drift wording and a `pushLog` import only; `moves/reorderChoice.resolve.test.ts`: the drift case and the header sentence (L7-9) only. `moves/deferredHandInjection.logic.ts`: the two log strings and header comment only.
- Zero never moves the card at pick time; it stays in play until cleanup.
- Spin never discards a card it did not look at, nor a card of unknown cost; no `discardFromHand` call.
- Liar, Nightbringer and Remaker stay unmarked.
- Card data only through `apply-effect-markers.mjs` (re-run applies 0); map edits keep the file's per-line format.
- A feed delta outside the expected list that also appears on a clean `origin/main` run is pre-existing drift: record it in the commit body. Any other delta, or a hash-oracle move, is a STOP: do not re-pin.
- Pins are runtime assertions (D-24372); never `satisfies`, `any` or `@ts-ignore`.

## Required `// why:` Comments
- Union + array + marker-script list: the three printed lines, WP-870 / D-24815, the append position.
- Lightning handler: duplicated from WP-754's park (code-style Rule 1, no hero-executor import); the resolve move is shared.
- Spin handler: D-24285 top-up; deck → discard is not a hand discard; cost-0 rule (D-24583); the WP-479 0-or-1 no-park rule. Reorder drift branch: the same-move Excessive Violence overtake and the block-all soft-lock it prevents.
- Zero handler + module: why the executor queues (no `events`, D-24750 / D-24779); the card stays in play and returns through D-24797; copies counted (shared S.H.I.E.L.D. / Wound ids); dedupe-by-name; mandatory pick; the local cost helper; the import-cycle note copied from `outOfTimeGrant.logic.ts`.
- T17's boardgame.io deep-dist import: the WP-411 / D-24223 reducer-test exception (copied from `game.test.ts`).
- Each lockstep site (drop set D-24518, operator guard, turn-start delete, loop mirror: the loops never run `onMove`); the consume-log change (a second writer); the new `G` field (lazy, hashed, never seeded).

## Files to Produce
- Engine **modified** (`packages/game-engine/src/`): `rules/villainAbility.types.ts` + `.test.ts`, `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts`, `types.ts`, `moves/seatChoice.resolve.ts`, `moves/reorderChoice.resolve.ts` + `.test.ts` (drift case), `moves/deferredHandInjection.logic.ts`, `game.ts`, `endgame/mastermindVictory.logic.ts` + `.test.ts`, `moves/operatorSetters.logic.ts` + `moves/operatorSetters.test.ts`, `simulation/onBeginParity.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts`
- Engine **new**: `moves/nextHandFromPlay.logic.ts`, `villain/mandarinsRingsFight.test.ts` (T1-T18)
- Scripts **modified**: `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json`
- **Regenerated**: `data/cards/rvlt.json`, `data/cards/antm.json`; `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`; `data/metadata/effect-implementation-index.json`
- Governance: `docs/ai/DECISIONS.md` (D-24815 Active), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/coverage/live-verify.json`

## After Completing
- [ ] T1-T18 pass; `pnpm -r build` 0 (tsc keyset guard); `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` + `run prebuild:effect-index`, then `pnpm -r --no-bail test` 0 fail; `pnpm --filter @legendary-arena/dashboard typecheck`, `lint`, `run format:check`, `run test:coverage` → 0.
- [ ] Marker pass `4 new`, re-run `0`; only `rvlt.json` and `antm.json` change.
- [ ] `pnpm ledger:villains`, `effect-index`, `mechanics:metadata`, `sim:runtime-observed`, `sim:coverage --update-baseline`, then every `:check` in WP Verification 3 → 0; deltas match the expected list; line-ending churn reverted; hash oracles unchanged.
- [ ] Control runs (Zero map entry → no-op → T10-T15, T17 fail; `game.ts` opener call removed → T17 fails; shipped reorder drift no-op restored → T16 fails) and revert proof (Spin discards everything → T7, T8, T9 fail) observed.
- [ ] Allowlist-only diff.
- [ ] Two commits: `EC-908:` then `SPEC:` (D-24815 Active, STATUS with the follow-ups, indices, mindmap `✅` + `roadmap:counts:write`, ledger LANDED; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0).
- [ ] D-24026 live-verify recorded, or operator-pending.

## Common Failure Smells
- Lightning shows a Discard button → the entry lacks `isDiscardAllowed: false`.
- Spin's reorder prompt lists a discarded card → `cardIds` taken before the discards.
- A turn cannot end after fighting Spin with an Excessive Violence hero → a reorder drift return (L120 short deck or L121 permutation) still leaves the front queued.
- Zero's card is drawn as one of the six, not a seventh → it was moved to the discard at pick time instead of recorded (D-24797 lifts only recorded cards).
- A second Zero logs "played no 0-cost card" with Agents still in play → the eligibility test compares ids, not copy counts.
- The Zero pick never opens live (T17 red) → the `game.ts` onMove call is missing; in a sim / PAR run, or the queue grows across turns → a lockstep site or loop mirror is missing.
- `apply-effect-markers.mjs` exits 1 → the hand-synced list or the grammar check misses a primitive.
- A count pin is off by more than 3 → another villain-primitive WP landed first; re-read, do not guess.
