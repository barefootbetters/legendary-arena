# EC-317 — Ebony Blade: Victory-Pile Villain-Pick Infrastructure
# Execution Checklist

**WP:** WP-285-victory-villain-pick.md
**Layer:** Game Engine (`packages/game-engine`)
**Decisions:** D-24067 (pending-choice infrastructure), D-24068 (keyword + card marking)

---

## Before Starting

- [ ] `git status` — working tree clean; on a `claude/*` branch
- [ ] `pnpm --filter @legendary-arena/game-engine test` — baseline test count recorded
      (expected: 1586 from WP-284)
- [ ] Confirm `G.pendingOptionalKoRewards` exists in `types.ts` (WP-248 ✅) — if missing, STOP
- [ ] Confirm `G.cardStats[id].attack: number` exists in `economy.types.ts` (WP-247 ✅) — if missing, STOP
- [ ] Confirm `G.villainDeckCardTypes: Record<CardExtId, RevealedCardType>` at `types.ts:639` — if missing, STOP
- [ ] Confirm D-24067 and D-24068 are present in `docs/ai/DECISIONS.md` — if missing, STOP
- [ ] Read `resolveOptionalKoReward.ts` in full; confirm it follows the FIFO + guard pattern
      this WP mirrors — if it differs significantly from the expected pattern, STOP and reconcile
- [ ] Read WP-285 in full before touching a single file

---

## Locked Values

| Name | Locked Value | Source |
|---|---|---|
| New keyword | `'victory-villain-attack'` | D-24068 |
| New pending type | `PendingVictoryPileCardPick` | D-24067 |
| New G field | `pendingVictoryPileCardPick` | D-24067 |
| New move name | `resolveVictoryPileCardPick` | D-24067 |
| Helper — gate | `hasPendingVictoryPileCardPick` | D-24067 |
| Helper — eligible | `getEligibleVictoryVillains` | D-24067 |
| `rewardType` literal | `'attack'` | D-24067 |
| Villain filter | `G.villainDeckCardTypes[id] === 'villain'` | WP-285 §Assumes |
| HERO_KEYWORDS length after | `21` (was 20 post-WP-282) | D-24030 drift rule |
| Attack grant target | `G.turnEconomy.attack` | WP-248 precedent |
| Park field init | Lazy only — never in `Game.setup()` | D-24067 |

---

## Guardrails

1. **Never put `pendingVictoryPileCardPick: []` in `Game.setup()`** — lazy-init only.
2. **Import `hasPendingVictoryPileCardPick` at every guard site** — never inline the check.
3. **Filter uses `G.villainDeckCardTypes[id] === 'villain'`** — not ext_id string matching,
   not `cardTraits`, not `cardStats`. The exact field and comparand are locked.
4. **`G.cardStats[cardId].attack` is already a number** (WP-247) — no parsing or coercion.
5. **The FIFO queue front is `[0]`** — pop with `G.pendingVictoryPileCardPick.shift()`,
   not `.pop()`. Same as WP-248.
6. **Bot default: highest-attack villain wins; tie-break = lowest victory-pile index.**
   Deterministic; no `ctx.random.*` allowed in the bot default. Bot MUST call
   `getEligibleVictoryVillains` — never re-implement the filter inline.
7. **Move returns silently on any validation failure** — never throws (core invariant).
8. **Update the drift test in `heroKeywords.test.ts`** — array length 20 → 21; add new entry.
   Omitting this is the most common test-suite red per WP history (WP-248/EC-279 precedent).
9. **Validate eligibility at resolution time, not only at park time.** The move must re-run
   the `getEligibleVictoryVillains` filter at the moment of resolution — park-time eligibility
   is a hint, not a guarantee. Victory pile state at resolve-time is authoritative.
10. **Never partially mutate on a failure path.** If any validation step in the move fails,
    return immediately before touching `G.turnEconomy.attack` or the queue. Partial mutation
    on a failed pick is a data-corruption bug.

---

## Required Implementation Order

Execute files in this sequence. Out-of-order implementation creates type errors that obscure
real failures and makes the test suite unreliable as an early signal:

1. `types.ts` — `PendingVictoryPileCardPick` interface + `G` field (foundation; must compile first)
2. `rules/heroKeywords.ts` — add `'victory-villain-attack'` (union + array; 20 → 21)
3. `moves/resolveVictoryPileCardPick.ts` — move + helpers (depends on types.ts)
4. `moves/resolveVictoryPileCardPick.test.ts` — write and run; confirm suite green before continuing
5. `rules/heroKeywords.test.ts` — update drift test (20 → 21; run after step 4)
6. `setup/heroAbility.setup.ts` — `'victory-villain-attack'` keyword dispatch
7. `hero/heroEffects.execute.ts` — park site (`'victory-villain-attack'` onPlay case)
8. Block-all guard files (all 7 of: `coreMoves.impl.ts`, `fightVillain.ts`, `fightMastermind.ts`,
   `recruitHero.ts`, `villainDeck.reveal.ts`, `dodgeCard.ts`, `playFromUndercover.ts`)
9. `ai/ai.legalMoves.ts` — `hasPendingVictoryPileCardPick` short-circuit + bot default
10. `game.ts` — move registration + `advanceStage` guard (register last to avoid spurious move-set failures)
11. `game.test.ts` — move count N+1 + move-name set
12. `data/cards/antm.json` — `[keyword:victory-villain-attack]` prefix on `the-ebony-blade`

**Checkpoint:** run `pnpm --filter @legendary-arena/game-engine test` after step 4 and again
after step 11. If either run is red, diagnose before continuing.

---

## Required Comments

Every one of the following `// why:` comments must appear verbatim in the produced files:

- `resolveVictoryPileCardPick.ts`:
  - On the lazy-init guard: `// why: pendingVictoryPileCardPick is lazy-init (D-24067); undefined and [] both mean no pending pick`
  - On the `G.villainDeckCardTypes` filter: `// why: filter reads setup-time villain-deck type map (WP-014B); tactics are in G.mastermind, never in this map, so === 'villain' cleanly excludes them`
  - On `hasPendingVictoryPileCardPick` gate at move top: `// why: block-all guard — no other move may fire while a pending victory-pile pick is outstanding (D-24067)`

- `heroEffects.execute.ts` park site:
  - `// why: no eligible villains in victory pile at play time — no pending pick parked, logged as no-op (D-24067)`

- Guard sites (each of the 8 files):
  - `// why: block-all — pendingVictoryPileCardPick must be resolved before any other action (D-24067)`

- `ai.legalMoves.ts` bot default:
  - `// why: deterministic highest-attack pick; ties resolved by lowest victory-pile index (D-24067)`

---

## Files to Produce

**New files:**
- `packages/game-engine/src/moves/resolveVictoryPileCardPick.ts`
- `packages/game-engine/src/moves/resolveVictoryPileCardPick.test.ts`

**Modified files (game engine):**
- `packages/game-engine/src/types.ts`
- `packages/game-engine/src/rules/heroKeywords.ts`
- `packages/game-engine/src/rules/heroKeywords.test.ts`
- `packages/game-engine/src/setup/heroAbility.setup.ts`
- `packages/game-engine/src/hero/heroEffects.execute.ts`
- `packages/game-engine/src/game.ts`
- `packages/game-engine/src/moves/coreMoves.impl.ts`
- `packages/game-engine/src/moves/fightVillain.ts`
- `packages/game-engine/src/moves/fightMastermind.ts`
- `packages/game-engine/src/moves/recruitHero.ts`
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts`
- `packages/game-engine/src/moves/dodgeCard.ts`
- `packages/game-engine/src/moves/playFromUndercover.ts`
- `packages/game-engine/src/game.test.ts`
- `packages/game-engine/src/ai/ai.legalMoves.ts`

**Modified files (card data):**
- `data/cards/antm.json`

**Governance (not code — written at govern-close, not implementation):**
- `docs/ai/DECISIONS.md` (D-24067 + D-24068 Active)
- `docs/ai/work-packets/WORK_INDEX.md` (WP-285 Done)
- `docs/ai/execution-checklists/EC_INDEX.md` (EC-317 Done)
- `docs/ai/STATUS.md` (execution summary)
- `docs/05-ROADMAP-MINDMAP.md` (WP-285 node)

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine test` — all pass; test count ≥ 1598
- [ ] `pnpm -r build && pnpm test` — green
- [ ] `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` — 0 errors
- [ ] Spot-check: `hasPendingVictoryPileCardPick` imported in all 8 guard sites
- [ ] Spot-check: `the-ebony-blade` in `antm.json` has `[keyword:victory-villain-attack]` prefix
- [ ] Spot-check: `HERO_KEYWORDS.length === 21` in `heroKeywords.ts`
- [ ] Spot-check: `resolveVictoryPileCardPick` in `game.ts` moves registration
- [ ] Governance close — `SPEC:` commit with DECISIONS, WORK_INDEX, EC_INDEX, STATUS, mindmap

---

## Required Test Coverage

`resolveVictoryPileCardPick.test.ts` MUST include at minimum these 7 tests. If any is absent,
execution is incomplete — a green suite without these tests does not satisfy the DoD:

- [ ] Valid pick: correct attack value granted to `G.turnEconomy.attack`
- [ ] `cardId` not in victory pile: `G` entirely unmutated
- [ ] `cardId` present but non-villain (`G.villainDeckCardTypes[id] !== 'villain'`): `G` entirely unmutated
- [ ] Eligible list empty at resolution time: `G` entirely unmutated
- [ ] FIFO order: ≥2 queued entries, first resolve consumes entry `[0]`; entry `[1]` is untouched
- [ ] `undefined` queue: `hasPendingVictoryPileCardPick` returns false; move is a no-op
- [ ] Queue shift: after a successful resolution, queue length is exactly `startLength - 1`

---

## Silent Failure Risk

Because every invalid-input path in `resolveVictoryPileCardPick` returns silently (standard
move validation contract), missing test coverage will mask defects invisibly. A move that
silently no-ops a case it should handle is indistinguishable from a move that correctly
no-ops an invalid input.

If any of AC-1 through AC-16 is not covered by a direct test assertion, execution is
incomplete. "Tests green" is not a DoD proxy — each AC must be individually verifiable.

---

## Common Failure Smells

- **`heroKeywords.test.ts` drift test still at 20** — always update the drift test when adding
  a keyword. The test asserts exact array length.
- **`game.test.ts` move count stale** — the move-set drift test asserts exact count; adding
  the new move without updating the count breaks the test.
- **`Game.setup()` initializes `pendingVictoryPileCardPick`** — must be lazy-init only.
  Putting `pendingVictoryPileCardPick: []` in setup is a contract violation (D-24067).
- **Guard site uses inline `G.pendingVictoryPileCardPick?.length > 0`** — must import and
  call `hasPendingVictoryPileCardPick`. The function call is the contract, not the expression.
- **Bot default calls `resolveVictoryPileCardPick` when eligible list is empty** — guard
  `getEligibleVictoryVillains.length > 0` before calling the move.
- **`finalStateHash` changes** — if this happens, the sentinel board unexpectedly includes
  an `antm` card. STOP and investigate; do not paper over with a new hash.
