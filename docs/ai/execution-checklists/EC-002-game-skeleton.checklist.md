# EC-002 — boardgame.io Game Skeleton (Execution Checklist)

**Source:** docs/ai/work-packets/WP-002-game-skeleton.md
**Layer:** Game Engine

**Execution Authority:**
This EC is the authoritative execution checklist for WP-002.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-002.

---

## Before Starting

- [ ] WP-001 complete: all REFERENCE docs updated and reviewed
- [ ] Foundation Prompt 01 complete: `apps/server/src/server.mjs` exists
- [ ] Foundation Prompt 02 complete: `data/migrations/` exists, `pnpm migrate` succeeds
- [ ] `packages/game-engine/` does NOT exist yet
- [ ] `packages/registry/` exists (reference for workspace structure)
- [ ] `pnpm install` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-002.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **MatchSetupConfig fields** (9 names, character-for-character):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **Phase names** (exactly 4 boardgame.io phases):
  `'lobby'` | `'setup'` | `'play'` | `'end'`

- boardgame.io dependency: `^0.50.0`
- Package name: `@legendary-arena/game-engine`

---

## Guardrails

- Never use `Math.random()` — all randomness via `ctx.random.*`
- Never throw inside move functions — return void on invalid input
- `G` must be JSON-serializable — no Maps, Sets, classes, or functions
- Move stubs return void (Immer model: mutate draft, return void)
- `G` must never contain `imageUrl`, ability text, or display data from R2
- `game-engine` must NOT import `registry`, `server`, any `apps/*`, or `pg`
- ESM only — no `require()`; `node:` prefix on all built-in imports
- Test files use `.test.ts` — never `.test.mjs`

---

## Required `// why:` Comments

- `MatchConfiguration`: why it uses `ext_id` string references, not numeric DB IDs
- `setup()` signature: why it accepts `MatchConfiguration`

---

## Files to Produce

- `packages/game-engine/package.json` — **new** — workspace package declaration
- `packages/game-engine/tsconfig.json` — **new** — TypeScript configuration
- `packages/game-engine/src/types.ts` — **new** — `MatchConfiguration` and `LegendaryGameState`
- `packages/game-engine/src/game.ts` — **new** — boardgame.io `Game()` definition
- `packages/game-engine/src/index.ts` — **new** — package named exports
- `packages/game-engine/src/game.test.ts` — **new** — JSON-serializability test

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] All 9 `MatchConfiguration` field names verified against 00.2 section 8.1
- [ ] No `require()` in any generated file
- [ ] No files outside scope were modified
- [ ] `docs/ai/STATUS.md` created (first entry)
- [ ] `docs/ai/DECISIONS.md` created (first entry: ext_id string references)
- [ ] `docs/ai/work-packets/WORK_INDEX.md`
      WP-002 checked off with date
