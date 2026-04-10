# Session Prompt — Execute WP-002 (boardgame.io Game Skeleton)

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

---

## What You Are Doing

Execute WP-002 to create the `packages/game-engine/` workspace package — the
boardgame.io Game Skeleton that all future gameplay Work Packets build on.

This is a **contracts-only** packet. You are scaffolding types, phases, and
move stubs. You are NOT implementing game logic, rules, shuffle, or win/loss
conditions.

---

## Authority Chain (Read in This Order)

Before writing any code, read these files in order:

1. `.claude/CLAUDE.md` — root coordination, EC-mode rules, governance set
2. `docs/ai/ARCHITECTURE.md` — layer boundaries, game-engine package rules,
   the LegendaryGame object, what G is and is not
3. `.claude/rules/game-engine.md` — game engine layer enforcement rules
4. `.claude/rules/code-style.md` — code style enforcement rules
5. `docs/ai/work-packets/WP-002-game-skeleton.md` — **THE WORK PACKET**
   (authoritative spec for what to build)
6. `docs/ai/execution-checklists/EC-002-game-skeleton.checklist.md` —
   **THE EXECUTION CHECKLIST** (every item must be satisfied exactly)
7. `docs/ai/REFERENCE/00.2-data-requirements.md §8.1` — MatchConfiguration
   field names (9 fields, locked, character-for-character)
8. `docs/ai/REFERENCE/00.6-code-style.md` — code style rules
9. `packages/registry/package.json` — reference for workspace package
   structure (`"type": "module"`, exports map, TypeScript setup)
10. `packages/registry/tsconfig.json` — reference for TypeScript config

---

## Pre-Execution Checks

Before writing a single line, confirm:

- [ ] `packages/game-engine/` does NOT exist yet (this session creates it)
- [ ] `packages/registry/` exists (reference for workspace structure)
- [ ] `apps/server/src/server.mjs` exists (FP-01 complete)
- [ ] `data/migrations/` exists with 3 .sql files (FP-02 complete)
- [ ] `pnpm install` succeeds
- [ ] `pnpm migrate` succeeds (database is ready)
- [ ] boardgame.io `^0.50.0` is available on npm

---

## Execution Rules

1. **One Work Packet per session** — only WP-002
2. **Read the full WP and EC** before writing code
3. **EC is the execution contract** — every checklist item must be satisfied
4. **If the EC and WP conflict, the WP wins**
5. **ESM only** — no `require()`, `node:` prefix on all built-ins
6. **Code style**: `docs/ai/REFERENCE/00.6-code-style.md` — all rules apply
7. **Test files use `.test.ts`** — never `.test.mjs`
8. **Field names from 00.2 §8.1 are locked** — do not rename, abbreviate,
   or reorder

---

## Locked Values (Copy Verbatim — Do Not Re-derive)

- **MatchConfiguration fields** (9 names, character-for-character):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **Phase names** (exactly 4 boardgame.io phases):
  `'lobby'` | `'setup'` | `'play'` | `'end'`

- **Move stubs**: `playCard`, `endTurn` (return void, no side effects)

- **boardgame.io dependency**: `^0.50.0`
- **Package name**: `@legendary-arena/game-engine`

---

## Files Expected to Change

- `packages/game-engine/package.json` — **new**
- `packages/game-engine/tsconfig.json` — **new**
- `packages/game-engine/src/types.ts` — **new** — `MatchConfiguration`, `LegendaryGameState`
- `packages/game-engine/src/game.ts` — **new** — `LegendaryGame` (boardgame.io `Game()`)
- `packages/game-engine/src/index.ts` — **new** — package named exports
- `packages/game-engine/src/game.test.ts` — **new** — JSON-serializability test

No other files may be modified except:
- `docs/ai/STATUS.md` — **update** (add WP-002 section; file already exists)
- `docs/ai/DECISIONS.md` — **update** (add ext_id string reference decision
  if not already present; file already exists with entries from prior sessions)
- `docs/ai/work-packets/WORK_INDEX.md` — **update** (check off WP-002)

---

## Current Environment State

- Local PostgreSQL is running with `legendary_arena` database
- All 3 migrations applied (`pnpm migrate` exits 0)
- `.env` exists with real `DATABASE_URL` pointing to local PostgreSQL
- `pnpm check` passes except EC-CONN-002 (server not deployed) and
  EC-RCLONE-003 (rclone timeout — transient)
- `packages/registry/` exists as a reference workspace package
- `apps/server/` exists with `pg` and `boardgame.io` installed

---

## Important Notes

- **STATUS.md and DECISIONS.md already exist** — WP-002 was written assuming
  they didn't. Add new sections to the existing files rather than creating
  them from scratch. Check DECISIONS.md for an existing ext_id decision
  (D-1201) before adding a duplicate.
- **The WP says "MatchConfiguration"** as the type name. WP-005A later
  reconciles this with `MatchSetupConfig`. For this packet, use
  `MatchConfiguration` as specified.
- **boardgame.io 0.50.x uses Immer** — move functions receive a mutable
  draft of G and return void. Do NOT return a new G object.
- **`game-engine` must NOT import** `registry`, `server`, any `apps/*`,
  `pg`, or any database package. This is an architectural invariant.
- **TypeScript configuration**: mirror `packages/registry/tsconfig.json`
  for consistency. The package uses `"type": "module"` so TypeScript must
  emit ESM-compatible output.

---

## Verification After Execution

Run these in order (from the WP's Verification Steps):

```pwsh
# 1. Install the new package's dependencies
pnpm install

# 2. Build the package
pnpm --filter @legendary-arena/game-engine build

# 3. Run the JSON-serializability test
pnpm --filter @legendary-arena/game-engine test

# 4. Confirm MatchConfiguration has all 9 field names
Select-String -Path "packages\game-engine\src\types.ts" `
  -Pattern "schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount"

# 5. Confirm no require() in any generated file
Select-String -Path "packages\game-engine\src" -Pattern "require\(" -Recurse

# 6. Confirm the package is importable from a consumer
node --input-type=module --eval "
  import { LegendaryGame } from '@legendary-arena/game-engine';
  console.log('phases:', Object.keys(LegendaryGame.phases ?? {}));
  console.log('moves:', Object.keys(LegendaryGame.moves ?? {}));
"

# 7. Confirm no files outside scope were changed
git diff --name-only
```

---

## Post-Execution Updates

- [ ] `docs/ai/STATUS.md` — add WP-002 section
- [ ] `docs/ai/DECISIONS.md` — add ext_id string reference decision
      (check D-1201 first — may already exist from FP-02)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — mark WP-002 complete with date
