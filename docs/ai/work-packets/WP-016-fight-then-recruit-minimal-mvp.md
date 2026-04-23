# WP-016 — Fight First, Then Recruit (Minimal MVP)

**Status:** Complete
**Primary Layer:** Game Engine / Core Actions
**Dependencies:** WP-015

---

## Session Context

WP-015 introduced the City (5 spaces) and HQ (5 slots) zones with deterministic
villain push/escape logic. WP-008B established the core move system (drawCards,
playCard, endTurn) with the three-step validation contract. This packet adds
the first two interactive combat and economy moves — `fightVillain` and
`recruitHero` — with an explicit policy that fight ordering takes priority
over recruit ordering. WP-018 will add the full attack/recruit point economy;
this packet establishes the move contracts and minimal validation only.

---

## Goal

Introduce `fightVillain` and `recruitHero` moves with a documented fight-first
ordering policy. After this session:

- `fightVillain({ cityIndex })` move exists: validates the target city space
  is occupied, removes the villain from the City, and places it in the
  player's victory pile
- `recruitHero({ hqIndex })` move exists: validates the target HQ slot is
  occupied, removes the hero from HQ, and places it in the player's discard
- Both moves follow the three-step validation contract (validate args, check
  stage gate, mutate G)
- Both moves are gated to the `main` stage only
- The fight-first ordering policy is documented in DECISIONS.md as a policy
  decision, not a hard lockout
- MVP: no attack/recruit point checking (WP-018), no card text effects (WP-022),
  no bystander rescue (WP-017)

---

## Assumes

- WP-015 complete. Specifically:
  - `packages/game-engine/src/board/city.types.ts` exports `CityZone`, `HqZone`
    (WP-015)
  - `packages/game-engine/src/board/city.logic.ts` exports `pushVillainIntoCity`,
    `initializeCity`, `initializeHq` (WP-015)
  - `G.city` and `G.hq` exist in `LegendaryGameState` (WP-015)
  - `packages/game-engine/src/moves/coreMoves.types.ts` exports `MoveResult`,
    `MoveError` (WP-008A)
  - `G.currentStage` exists as `'start' | 'main' | 'cleanup'` (WP-007A) —
    used for internal gating in non-core moves
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "Canonical Reveal → Fight →
  Side-Effect Ordering". This diagram is the authoritative ordering contract
  for how WP-016 fight logic interacts with WP-015 reveal and WP-017
  side-effects.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Move Validation Contract".
  Both new moves must follow the exact three-step sequence: validate args,
  check stage gate, mutate G. Moves never throw.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "Zone Mutation Rules". Removing
  a card from City or HQ and placing it in a player zone uses the same pure
  helper pattern as all other zone operations.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "Stage Gating". Both `fightVillain`
  and `recruitHero` are `main` stage moves. Both moves gate internally (non-core pattern from WP-014A) and must NOT be
  added to the gating table.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — fight and
  recruit logic is game-engine layer only. The engine decides outcomes. No UI
  ordering assumptions, no server involvement, no registry queries at move time.
- `docs/ai/execution-checklists/EC-014A-*.md` — read "Core vs Non-Core Move
  Model". `fightVillain` and `recruitHero` are non-core moves that gate
  internally. `MOVE_ALLOWED_STAGES` is not modified.
- `packages/game-engine/src/board/city.types.ts` — read CityZone and HqZone
  types from WP-015. Fight removes from City; recruit removes from HQ.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `cityIndex` not `ci`), Rule 6 (`// why:` on the fight-first policy), Rule 8
  (no `.reduce()`), Rule 11 (full-sentence error messages), Rule 13 (ESM only).

**Critical policy note — fight and recruit ordering:**
Players may fight or recruit in either order during their turn, choosing the
sequence that best suits their strategy. This matches Legendary's tabletop
rules where fight-first is recommended but never required.

The "fight-first" rule is a **policy preference**, not a hard rule: the engine
does not reject a recruit if a fight is available. Both moves are allowed in
the `main` stage simultaneously. Fight-first ordering is recorded in
DECISIONS.md as a **policy decision** (D-1602), not a rules lock enforced by
the engine. Future packets may reference this policy for UI hints or AI
suggestions, but the engine itself does not enforce ordering between fight
and recruit.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in any new file
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Both moves follow the three-step validation contract exactly (validate args,
  check stage gate, mutate G)
- Both moves are `main` stage only — gated internally via
  `G.currentStage === 'main'` (non-core move pattern)
- **Non-core gating pattern:** `fightVillain` and `recruitHero` must NOT
  modify `CoreMoveName`, `CORE_MOVE_NAMES`, or `MOVE_ALLOWED_STAGES`. They
  gate internally, matching the `revealVillainCard` precedent (WP-014A).
- Fight-first is a **policy** — the engine does NOT reject recruit when fight
  is available. Both are valid in `main` stage simultaneously.
- MVP: no attack/recruit point validation — a player can fight or recruit
  without checking resources. WP-018 adds the economy.
- MVP: no card text effects on fight or recruit — WP-022 adds keyword execution
- MVP: no bystander rescue on villain defeat — WP-017 adds that
- `MoveResult` / `MoveError` reused from WP-008A — no new error types
- WP-015 contract files (`city.types.ts`) must not be modified
- WP-008A contract files (`coreMoves.types.ts`, `coreMoves.validate.ts`,
  `coreMoves.gating.ts`) must not be modified. `fightVillain` and
  `recruitHero` gate internally (non-core move pattern).
- Tests use `makeMockCtx` — no `boardgame.io` imports in test files
- `// why:` comment on the fight-first policy wherever it affects code or
  documentation
- `fightVillain` does not inspect, modify, or clean up any auxiliary mappings
  attached to a villain (e.g., `G.attachedBystanders`). WP-016 never reads
  `G.attachedBystanders`. Cleanup and awards are the exclusive responsibility
  of WP-017, which extends `fightVillain` after the villain removal step.
- `fightVillain` must not read or mutate `G.hq`. City and HQ are independent
  zones; cross-zone side effects are prohibited in this packet.
- Escape penalties (wounds, bystander resolution) are reveal-time only
  (WP-015/WP-017). `fightVillain` must not inspect escape counters, apply
  penalties, or modify endgame state.
- Messages added by `fightVillain` and `recruitHero` must be informational only
  (e.g., "Player 0 fought villain-card-001 at city space 2"). No rule text,
  effect descriptions, or bystander references. Keep messages minimal and
  stable to avoid brittle test assertions.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values:**

- **MoveError shape** (reused from WP-008A):
  `{ code: string; message: string; path: string }`

- **TurnStage values** (both new moves are main-stage):
  `'start'` | `'main'` | `'cleanup'`

- **PlayerZones keys** (fight places in victory, recruit places in discard):
  `deck` | `hand` | `discard` | `inPlay` | `victory`

- **Non-core move gating:** `fightVillain` and `recruitHero` gate internally
  via `G.currentStage === 'main'`. They are NOT added to `CoreMoveName`,
  `CORE_MOVE_NAMES`, or `MOVE_ALLOWED_STAGES`. Same pattern as
  `revealVillainCard` (WP-014A).

---

## Scope (In)

### A) `src/moves/fightVillain.ts` — new

- `fightVillain(G, ctx, { cityIndex: number }): void`
  — move implementation following three-step contract:
  1. Validate args: `cityIndex` must be a finite integer in the inclusive
     range 0-4, and `G.city[cityIndex]` is not null. Reject negative values,
     non-integers, NaN, and out-of-range values silently (return void).
  2. Check stage gate: if `G.currentStage !== 'main'`, return void immediately
     (internal gating — non-core move, same pattern as `revealVillainCard`)
  3. Mutate G:
     - Remove card from `G.city[cityIndex]` (set to null)
     - Place card in `G.playerZones[ctx.currentPlayer].victory`
     - Push message to `G.messages`
  - `// why:` comment: MVP — no attack point check; WP-018 adds economy
  - Returns void; never throws

### B) `src/moves/recruitHero.ts` — new

- `recruitHero(G, ctx, { hqIndex: number }): void`
  — move implementation following three-step contract:
  1. Validate args: `hqIndex` must be a finite integer in the inclusive
     range 0-4, and `G.hq[hqIndex]` is not null. Reject negative values,
     non-integers, NaN, and out-of-range values silently (return void).
  2. Check stage gate: if `G.currentStage !== 'main'`, return void immediately
     (internal gating — non-core move, same pattern as `revealVillainCard`)
  3. Mutate G:
     - Remove card from `G.hq[hqIndex]` (set to null)
     - Place card in `G.playerZones[ctx.currentPlayer].discard`
     - Push message to `G.messages`
  - `// why:` comment: MVP — no recruit point check; WP-018 adds economy
  - Returns void; never throws

### C) Stage gating (internal, non-core moves) — no changes to coreMoves.types.ts or coreMoves.gating.ts

`fightVillain` and `recruitHero` are **non-core moves** and must not be added
to `CoreMoveName`, `CORE_MOVE_NAMES`, or `MOVE_ALLOWED_STAGES`. Each move
performs its own gating by checking `G.currentStage === 'main'`. If stage is
not `main`, the move returns immediately with no mutation. This matches the
existing precedent established by `revealVillainCard` (WP-014A), which also
gates internally without being in the core move registry. This matches the
Core vs Non-Core move model established by EC-014A.

### D) `src/game.ts` — modified

- Register `fightVillain` and `recruitHero` in the `play` phase moves

### E) `src/index.ts` — modified

- Export `fightVillain` and `recruitHero` as named public exports

### F) Tests — `src/moves/fightVillain.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; does not import
  from `boardgame.io`
- Seven tests:
  1. `fightVillain` removes card from `G.city[cityIndex]`
  2. Removed card appears in player's `victory` zone
  3. Invalid `cityIndex` (out of range): no mutation
  4. Empty city space (null): no mutation
  5. Wrong stage (`start`): no mutation
  6. `JSON.stringify(G)` succeeds after fight
  7. Idempotence: calling `fightVillain` twice on the same index does nothing
     the second time (proves fail-closed on null space)

### G) Tests — `src/moves/recruitHero.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; does not import
  from `boardgame.io`
- Seven tests:
  1. `recruitHero` removes card from `G.hq[hqIndex]`
  2. Removed card appears in player's `discard` zone
  3. Invalid `hqIndex` (out of range): no mutation
  4. Empty HQ slot (null): no mutation
  5. Wrong stage (`cleanup`): no mutation
  6. `JSON.stringify(G)` succeeds after recruit
  7. Idempotence: calling `recruitHero` twice on the same index does nothing
     the second time (proves fail-closed on null slot)

---

## Out of Scope

- **No attack/recruit point economy** — WP-018 adds resource validation
- **No card text effects on fight or recruit** — WP-022 adds keyword execution
- **No bystander rescue on villain defeat** — WP-017 adds that
- **No KO pile interaction** — WP-017
- **No mastermind fight** — WP-019
- **No HQ refill after recruit** — WP-018 or later; MVP leaves empty slots
- **No escape handling in fightVillain** — escape effects (counter increment,
  wound gain) are reveal-time only (WP-015/WP-017). `fightVillain` removes a
  villain from the City; it does not handle escaped villains.
- **No hard lockout of recruit-before-fight** — the policy is documented, not
  enforced by the engine in this packet
- **No UI ordering hints** — UI is a separate layer; this packet is engine-only
- **No persistence / database access**
- **No server or UI changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/moves/fightVillain.ts` — **new** — fightVillain
  move implementation
- `packages/game-engine/src/moves/recruitHero.ts` — **new** — recruitHero
  move implementation
- `packages/game-engine/src/game.ts` — **modified** — register new moves in
  play phase
- `packages/game-engine/src/index.ts` — **modified** — export new moves
- `packages/game-engine/src/moves/fightVillain.test.ts` — **new** — fight
  move unit tests
- `packages/game-engine/src/moves/recruitHero.test.ts` — **new** — recruit
  move unit tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Fight Move
- [ ] `fightVillain` follows three-step contract (validate, gate, mutate)
- [ ] `fightVillain` validates `cityIndex` is a finite integer in 0-4
- [ ] `fightVillain` removes card from `G.city[cityIndex]` and places in
      player's `victory` zone
- [ ] `fightVillain` does not inspect or modify auxiliary mappings (bystanders)
- [ ] `fightVillain` does not read or mutate `G.hq`
- [ ] `fightVillain` returns void on invalid args (never throws)
- [ ] `fightVillain` is gated to `main` stage only
- [ ] `// why:` comment noting MVP has no attack point check

### Recruit Move
- [ ] `recruitHero` follows three-step contract (validate, gate, mutate)
- [ ] `recruitHero` validates `hqIndex` is a finite integer in 0-4
- [ ] `recruitHero` removes card from `G.hq[hqIndex]` and places in
      player's `discard` zone
- [ ] `recruitHero` returns void on invalid args (never throws)
- [ ] `recruitHero` is gated to `main` stage only
- [ ] `// why:` comment noting MVP has no recruit point check

### Stage Gating (Internal)
- [ ] `fightVillain` returns early with no mutation when
      `G.currentStage !== 'main'`
- [ ] `recruitHero` returns early with no mutation when
      `G.currentStage !== 'main'`
- [ ] Stage gating occurs before any mutation or message (early return with
      no side effects)
- [ ] No changes made to `coreMoves.types.ts`, `coreMoves.gating.ts`, or
      `coreMoves.gating.test.ts`

### Policy Documentation
- [ ] Fight-first ordering policy is documented in code via `// why:` comment
- [ ] DECISIONS.md entry explains that fight-first is a policy decision
      (WP-016), not a rules lock enforced by the engine

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Fight test covers: valid fight, invalid index, null space, wrong stage
- [ ] Recruit test covers: valid recruit, invalid index, null slot, wrong stage
- [ ] `JSON.stringify(G)` succeeds after both moves
- [ ] All test files use `makeMockCtx` and do not import from `boardgame.io`
      (confirmed with `Select-String`)

### Scope Enforcement
- [ ] WP-015 contract files (`city.types.ts`) not modified
      (confirmed with `git diff --name-only`)
- [ ] WP-008A contract files (`coreMoves.types.ts`, `coreMoves.validate.ts`,
      `coreMoves.gating.ts`) not modified (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding fight and recruit moves
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no registry import in new move files
Select-String -Path "packages\game-engine\src\moves\fightVillain.ts","packages\game-engine\src\moves\recruitHero.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 4 — confirm no Math.random in new files
Select-String -Path "packages\game-engine\src\moves\fightVillain.ts","packages\game-engine\src\moves\recruitHero.ts" -Pattern "Math.random"
# Expected: no output

# Step 5 — confirm no throw in move files
Select-String -Path "packages\game-engine\src\moves\fightVillain.ts","packages\game-engine\src\moves\recruitHero.ts" -Pattern "throw "
# Expected: no output

# Step 6 — confirm core move contract files unchanged
git diff --name-only packages/game-engine/src/moves/coreMoves.types.ts packages/game-engine/src/moves/coreMoves.gating.ts packages/game-engine/src/moves/coreMoves.validate.ts
# Expected: no output

# Step 7 — confirm WP-015 contract files not modified
git diff --name-only packages/game-engine/src/board/city.types.ts
# Expected: no output

# Step 8 — confirm no require() in generated files
Select-String -Path "packages\game-engine\src\moves\fightVillain.ts","packages\game-engine\src\moves\recruitHero.ts" -Pattern "require("
# Expected: no output

# Step 9 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change

# Step 10 — confirm no accidental core gating references in new move files
Select-String -Path "packages\game-engine\src\moves\fightVillain.ts","packages\game-engine\src\moves\recruitHero.ts" -Pattern "MOVE_ALLOWED_STAGES|isMoveAllowedInStage|CORE_MOVE_NAMES|CoreMoveName"
# Expected: no matches (non-core moves gate internally)
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No `throw` in fightVillain.ts or recruitHero.ts
      (confirmed with `Select-String`)
- [ ] No `Math.random` in any new file (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] WP-015 contract files (`city.types.ts`) not modified
      (confirmed with `git diff --name-only`)
- [ ] WP-008A contract files (`coreMoves.types.ts`, `coreMoves.validate.ts`,
      `coreMoves.gating.ts`) not modified (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — fight and recruit moves exist; players
      can interact with City and HQ for the first time; fight-first is a
      documented policy
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why fight-first is a
      policy not a hard lockout; why MVP has no resource checking (WP-018);
      why recruit places in discard not hand
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-016 checked off with today's date
