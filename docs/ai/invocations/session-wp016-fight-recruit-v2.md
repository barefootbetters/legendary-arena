# Session Execution Prompt — WP-016 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-016 — Fight First, Then Recruit (Minimal MVP)
**Mode:** Implementation (WP-016 has not been implemented yet)
**Pre-Flight:** `docs/ai/invocations/preflight-wp016-fight-recruit-v2.md`
**EC:** `docs/ai/execution-checklists/EC-016-fight-recruit.checklist.md`

---

## Read Order (Mandatory — Do Not Skip)

Read these documents **in this exact order** before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - "Canonical Reveal → Fight → Side-Effect Ordering" (§Section 4)
   - "The Move Validation Contract" (§Section 4)
   - "Zone Mutation Rules" (§Section 4)
   - "Stage Gating" (§Section 4)
   - "Layer Boundary (Authoritative)"
3. `docs/ai/execution-checklists/EC-016-fight-recruit.checklist.md`
4. `docs/ai/work-packets/WP-016-fight-then-recruit-minimal-mvp.md`
5. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`
6. `docs/ai/invocations/preflight-wp016-fight-recruit-v2.md`

Also read these implementation files for patterns to follow:

7. `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — non-core
   move pattern (stage gating, `MoveContext` type, void return)
8. `packages/game-engine/src/board/city.types.ts` — `CityZone`, `HqZone`
9. `packages/game-engine/src/state/zones.types.ts` — `PlayerZones.victory`,
   `PlayerZones.discard`

---

## Runtime Wiring Allowance

WP-016 adds `fightVillain` and `recruitHero` to `LegendaryGame.moves`.
Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to these files are permitted solely for assertion correctness:

- `src/game.test.ts` — update move-count assertion (5 -> 7 moves,
  value-only, no new logic)

No other 01.5 wiring changes anticipated. `game.ts` and `index.ts`
modifications are explicitly in the WP scope (not wiring allowance).

---

## Task: Implement WP-016

### A) Create `src/moves/fightVillain.ts`

Implement `fightVillain` as a boardgame.io move:

```
fightVillain({ G, ctx }: MoveContext, { cityIndex }: { cityIndex: number }): void
```

Three-step contract:
1. **Validate args:** `cityIndex` must be a finite integer 0-4 and
   `G.city[cityIndex]` must not be null. On failure: return void (no mutation).
2. **Stage gate:** if `G.currentStage !== 'main'`, return void immediately.
   No side effects, no messages. `// why:` comment.
3. **Mutate G:**
   - Capture card: `const cardId = G.city[cityIndex]`
   - Set `G.city[cityIndex] = null`
   - Push cardId to `G.playerZones[ctx.currentPlayer].victory`
   - Push informational message to `G.messages`
   - `// why:` MVP has no attack point check; WP-018 adds economy

**Prohibitions:**
- Never throw
- Never read `G.hq` or `G.attachedBystanders`
- Never inspect escape counters
- No `.reduce()`
- Messages are informational only (no rule text)

### B) Create `src/moves/recruitHero.ts`

Implement `recruitHero` as a boardgame.io move:

```
recruitHero({ G, ctx }: MoveContext, { hqIndex }: { hqIndex: number }): void
```

Three-step contract:
1. **Validate args:** `hqIndex` must be a finite integer 0-4 and
   `G.hq[hqIndex]` must not be null. On failure: return void.
2. **Stage gate:** if `G.currentStage !== 'main'`, return void.
   `// why:` comment.
3. **Mutate G:**
   - Capture card: `const cardId = G.hq[hqIndex]`
   - Set `G.hq[hqIndex] = null`
   - Push cardId to `G.playerZones[ctx.currentPlayer].discard`
   - Push informational message to `G.messages`
   - `// why:` MVP has no recruit point check; WP-018 adds economy

**Prohibitions:** same as fightVillain.

### C) Modify `src/game.ts`

Add `fightVillain` and `recruitHero` to the `play` phase `moves` object.
Import from their respective files.

### D) Modify `src/index.ts`

Export `fightVillain` and `recruitHero` as named public exports.

### E) Create `src/moves/fightVillain.test.ts`

7 tests using `node:test`, `node:assert`, `makeMockCtx`. No boardgame.io.

1. Removes card from `G.city[cityIndex]`
2. Card appears in player's `victory` zone
3. Invalid `cityIndex` (out of range, e.g. 5, -1): no mutation
4. Empty city space (null): no mutation
5. Wrong stage (`start`): no mutation (stage gating)
6. `JSON.stringify(G)` succeeds after fight
7. Idempotence: second call on same index = no-op

Mock G must include all `LegendaryGameState` fields (city, hq, playerZones
with victory/discard, currentStage set to `'main'` for happy path,
villainDeck, villainDeckCardTypes, etc.).

### F) Create `src/moves/recruitHero.test.ts`

7 tests, same structure as fight tests but for HQ:

1. Removes card from `G.hq[hqIndex]`
2. Card appears in player's `discard` zone
3. Invalid `hqIndex` (out of range): no mutation
4. Empty HQ slot (null): no mutation
5. Wrong stage (`cleanup`): no mutation
6. `JSON.stringify(G)` succeeds after recruit
7. Idempotence: second call on same index = no-op

### G) Update `src/game.test.ts` (01.5 wiring)

Update the move-count assertion from 5 to 7 moves. Update the move
name list to include `fightVillain` and `recruitHero`. Value-only
change, no new logic.

---

## Verification (Run All Before Completion)

```bash
# Build
pnpm --filter @legendary-arena/game-engine build

# Tests
pnpm --filter @legendary-arena/game-engine test

# No registry imports
grep -r "@legendary-arena/registry" packages/game-engine/src/moves/fightVillain.ts packages/game-engine/src/moves/recruitHero.ts

# No Math.random
grep -r "Math.random" packages/game-engine/src/moves/fightVillain.ts packages/game-engine/src/moves/recruitHero.ts

# No throw
grep -r "throw " packages/game-engine/src/moves/fightVillain.ts packages/game-engine/src/moves/recruitHero.ts

# No require
grep -r "require(" packages/game-engine/src/moves/fightVillain.ts packages/game-engine/src/moves/recruitHero.ts

# No core gating references
grep -r "MOVE_ALLOWED_STAGES\|CORE_MOVE_NAMES\|CoreMoveName" packages/game-engine/src/moves/fightVillain.ts packages/game-engine/src/moves/recruitHero.ts

# Contract files unchanged
git diff --name-only packages/game-engine/src/moves/coreMoves.types.ts packages/game-engine/src/moves/coreMoves.gating.ts packages/game-engine/src/moves/coreMoves.validate.ts packages/game-engine/src/board/city.types.ts
```

All grep checks must return empty. Build and tests must exit 0.

---

## Post-Execution Documentation

Update these governance docs:

1. **`docs/ai/DECISIONS.md`** — add entries:
   - D-1601: `fightVillain` and `recruitHero` are non-core moves (gate
     internally, not added to `MOVE_ALLOWED_STAGES`)
   - D-1602: fight-first ordering is a **policy preference**, not a hard
     lockout enforced by the engine
   - D-1603: MVP has no resource checking; WP-018 adds economy
   - D-1604: recruit places hero in player's discard (not hand) — matches
     tabletop Legendary rules

2. **`docs/ai/STATUS.md`** — fight and recruit moves exist; players can
   interact with City and HQ; fight-first is a documented policy

3. **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-016

---

## Constraints (Non-Negotiable)

- Moves never throw; return void on invalid input
- `G` must remain JSON-serializable
- No `Math.random()`, `.reduce()` in logic, `require()`, or `throw`
- No `@legendary-arena/registry` imports
- No modification of `CoreMoveName`, `CORE_MOVE_NAMES`, `MOVE_ALLOWED_STAGES`
- No modification of `coreMoves.types.ts`, `coreMoves.validate.ts`,
  `coreMoves.gating.ts`, `city.types.ts`, `villainDeck.types.ts`
- No attack/recruit point economy (WP-018)
- No bystander rescue or `G.attachedBystanders` access (WP-017)
- No card text effects (WP-022)
- No HQ refill after recruit
- No hard lockout of recruit-before-fight
- `fightVillain` must not read `G.hq`; `recruitHero` must not read `G.city`
- 01.5 wiring limited to `game.test.ts` assertion update only
