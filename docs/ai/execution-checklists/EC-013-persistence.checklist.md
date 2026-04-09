# EC-013 — Persistence Boundaries & Snapshots (Execution Checklist)

**Source:** docs/ai/work-packets/WP-013-persistence-boundaries-snapshots.md
**Layer:** Architecture / Data Lifecycle

**Execution Authority:**
This EC is the authoritative execution checklist for WP-013.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-013.

---

## Before Starting

- [ ] WP-012 complete: `LegendaryGameState` has `counters`, `messages`, `playerZones`, `lobby`, `currentStage`, `hookRegistry`
- [ ] `EndgameResult` exists in `endgame.types.ts` (WP-010)
- [ ] `MatchSetupConfig` with 9 locked fields exists (WP-005A)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-013.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `PERSISTENCE_CLASSES` string values (3 canonical class names):
  `RUNTIME = 'runtime'` | `CONFIGURATION = 'configuration'` | `SNAPSHOT = 'snapshot'`
- `MatchSnapshot` top-level keys (exactly these -- no additional fields):
  `matchId` | `snapshotAt` | `turn` | `phase` | `activePlayer` | `players` | `counters` | `messages` | `outcome` (optional)
- `MatchSnapshot.players` zone count fields (exactly 5 -- no zone contents):
  `deckCount` | `handCount` | `discardCount` | `inPlayCount` | `victoryCount`
- `MoveError` shape (reused from WP-008A): `{ code: string; message: string; path: string }`

---

## Guardrails

- `createSnapshot` is pure -- no I/O, no throws, returns `Object.freeze()` result
- `MatchSnapshot` contains zone **counts** only -- no `CardExtId[]` arrays
- `validateSnapshotShape` returns structured results -- never throws
- `MoveError` imported from `coreMoves.types.ts` -- not redefined
- `packages/game-engine/src/game.ts` must NOT be modified
- No database schema, migrations, or storage engines
- `PERSISTENCE_CLASSES` constants are canonical -- future packets import these, never string literals

---

## Required `// why:` Comments

- `PERSISTENCE_CLASSES` block: document each class (runtime, configuration, snapshot)
- `createSnapshot`: zone counts not contents prevents snapshots from becoming second source of truth
- `snapshotAt` using `new Date().toISOString()`: when the snapshot was taken

---

## Files to Produce

- `src/persistence/persistence.types.ts` -- **new** -- `PERSISTENCE_CLASSES`, `MatchSnapshot`, `PersistableMatchConfig`
- `src/persistence/snapshot.create.ts` -- **new** -- `createSnapshot` pure function
- `src/persistence/snapshot.validate.ts` -- **new** -- `validateSnapshotShape`
- `src/types.ts` -- **modified** -- re-export persistence types
- `src/index.ts` -- **modified** -- export new public API
- `src/persistence/snapshot.create.test.ts` -- **new** -- 7 tests (`node:test`)
- `docs/ai/ARCHITECTURE.md` -- **new** -- system structure document (5 sections)

---

## Common Failure Smells (Optional)

- `MatchSnapshot` contains `CardExtId[]` arrays instead of counts
  -> snapshot becoming secondary source of truth
- `createSnapshot` has side effects or throws
  -> purity contract violated
- `game.ts` modified in this packet
  -> scope creep; no game logic changes allowed

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `throw` in `snapshot.create.ts` or `snapshot.validate.ts`
- [ ] No `CardExtId[]` in `MatchSnapshot` (zone counts only)
- [ ] `docs/ai/ARCHITECTURE.md` exists with all 5 required sections
- [ ] `game.ts` was NOT modified (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated (persistence boundary types exported; ARCHITECTURE.md created)
- [ ] `docs/ai/DECISIONS.md` updated (zone counts over ext_id arrays; pure createSnapshot; PersistableMatchConfig excludes G/ctx)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-013 checked off with date
