# WP-010 — Victory & Loss Conditions (Minimal MVP)

**Status:** Ready
**Primary Layer:** Game Engine / Endgame
**Dependencies:** WP-009B

---

## Session Context

WP-009B established the two-step rule execution pipeline and added `G.messages`,
`G.counters`, and `G.hookRegistry` to `LegendaryGameState`. The rules pipeline
now increments counters via `applyRuleEffects`. This packet wires `endIf` into
the `play` phase using a pure `evaluateEndgame` function that reads
`G.counters` exclusively. `ENDGAME_CONDITIONS` constants established here are
the canonical counter key names for every future packet that increments an
endgame counter — they must never be replaced with string literals.

---

## Goal

Implement deterministic victory and loss conditions so a match can conclusively
end.

After this session, `@legendary-arena/game-engine` exports:
- `EndgameResult` — the typed outcome of a concluded match
- `ENDGAME_CONDITIONS` — canonical constants for condition counter keys
- `evaluateEndgame(G)` — a pure function that returns `EndgameResult | null`
- boardgame.io `endIf()` wired into the `play` phase using `evaluateEndgame`
- Tests proving each condition triggers correctly and evaluation order is fixed

This is Minimal MVP: three conditions only. No scoring UI, no complex Legendary
edge cases, no multi-mastermind defeat sequences.

---

## Assumes

- WP-009B complete. Specifically:
  - `packages/game-engine/src/types.ts` exports `LegendaryGameState` with
    `counters: Record<string, number>`, `messages: string[]`,
    `hookRegistry: HookDefinition[]` (WP-009B)
  - `packages/game-engine/src/game.ts` has the `play` phase wired with
    `onTurnStart`/`onTurnEnd` triggers and `advanceStage` move (WP-009B,
    WP-007B)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `packages/game-engine/src/rules/ruleRuntime.execute.ts` exports
    `executeRuleHooks` (WP-009B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/DECISIONS.md` exists (created in WP-002)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "The endIf Contract" and
  "G.counters Key Conventions" subsections. These document the architectural
  rules this packet must follow: `endIf` must be a pure function that delegates
  entirely to `evaluateEndgame`; `ENDGAME_CONDITIONS` constants are the
  canonical source for counter key names; loss conditions are evaluated before
  victory.
- `packages/game-engine/src/types.ts` — read `LegendaryGameState` entirely.
  `G.counters` is `Record<string, number>`. Victory and loss conditions use
  numeric comparisons (`>= 1` for truthy, `>= LIMIT` for threshold) — do not
  add boolean fields to `G`.
- `packages/game-engine/src/game.ts` — read the `play` phase `endIf` config.
  If `endIf` already exists as a stub, replace it. Understand the existing
  structure before modifying.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — `endIf` in
  boardgame.io must be a pure function of `(G, ctx)`. It cannot perform I/O,
  query the database, or have side effects. It returns a truthy value to end
  the game or `undefined`/`false` to continue.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.2` — `G` must remain
  JSON-serializable. `EndgameResult` must be a plain object with string and
  number fields only.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 3 (no nested
  ternaries — use explicit `if/else` blocks), Rule 4 (no abbreviations —
  `escapedVillainCount` not `evCount`), Rule 6 (`// why:` on `ESCAPE_LIMIT`
  and on evaluation order), Rule 9 (`node:` prefix), Rule 13 (ESM only).

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
- No database or network access of any kind
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `evaluateEndgame` is a pure function — no side effects, no I/O, no `throw`
- All endgame conditions use numeric comparisons on `G.counters` — do not add
  boolean fields to `G`
- Loss conditions must be evaluated before victory — never swap the order;
  add a `// why:` comment on evaluation order
- `endIf` in `game.ts` calls `evaluateEndgame` — no inline `counters[`
  condition logic inside `endIf` itself
- `ENDGAME_CONDITIONS` constants are the canonical counter key names — every
  packet that increments an endgame counter must import and use these constants,
  never string literals
- `ESCAPE_LIMIT` must have a `// why:` comment: 8 is the standard Legendary
  MVP limit; it becomes part of `MatchSetupConfig` in a later packet

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **ENDGAME_CONDITIONS keys** (this packet defines these 3 canonical counter
  key strings — every future packet that increments an endgame counter must
  import and use these constants; never use the string values directly):
  `ESCAPED_VILLAINS = 'escapedVillains'`
  `SCHEME_LOSS = 'schemeLoss'`
  `MASTERMIND_DEFEATED = 'mastermindDefeated'`

- **ESCAPE_LIMIT** (MVP hardcoded value — future packets must not re-derive
  this number; import the constant):
  `ESCAPE_LIMIT = 8`

- **Evaluation order** (loss conditions checked before victory — this order
  is locked; do not swap; when both `schemeLoss >= 1` AND
  `mastermindDefeated >= 1` are set simultaneously, result is `'scheme-wins'`):
  1. `escapedVillains >= ESCAPE_LIMIT` → `'scheme-wins'`
  2. `schemeLoss >= 1` → `'scheme-wins'`
  3. `mastermindDefeated >= 1` → `'heroes-win'`
  4. otherwise → `null` (game continues)

- **G.counters field** (consumed here — established in WP-009B; all endgame
  counter reads use this field):
  `G.counters: Record<string, number>` — missing keys evaluate as `0` via
  `?? 0` pattern; do not add separate boolean fields to `G`

---

## Scope (In)

### A) `src/endgame/endgame.types.ts` — new
- `type EndgameOutcome = 'heroes-win' | 'scheme-wins'`
- `interface EndgameResult { outcome: EndgameOutcome; reason: string }`
- `const ENDGAME_CONDITIONS` — readonly object of canonical counter key strings:
  ```ts
  const ENDGAME_CONDITIONS = {
    ESCAPED_VILLAINS:    'escapedVillains',
    SCHEME_LOSS:         'schemeLoss',
    MASTERMIND_DEFEATED: 'mastermindDefeated',
  } as const;
  ```
  These are the **only** authoritative names for these counters in the engine.
- `const ESCAPE_LIMIT: number = 8` — with `// why:` comment: 8 is the standard
  Legendary escape limit for MVP; becomes part of `MatchSetupConfig` in a later
  packet when scheme-specific limits are implemented
- All exports are JSON-serializable — no functions in this file

### B) `src/endgame/endgame.evaluate.ts` — new
- `evaluateEndgame(G: LegendaryGameState): EndgameResult | null`
  — evaluates the three MVP conditions in priority order:
  1. **Loss — Too Many Escapes:**
     `if ((G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0) >= ESCAPE_LIMIT)`
     → `{ outcome: 'scheme-wins', reason: 'Too many villains escaped.' }`
  2. **Loss — Scheme Triggered:**
     `if ((G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] ?? 0) >= 1)`
     → `{ outcome: 'scheme-wins', reason: 'The scheme has been completed.' }`
  3. **Victory — Mastermind Defeated:**
     `if ((G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] ?? 0) >= 1)`
     → `{ outcome: 'heroes-win', reason: 'The mastermind has been defeated.' }`
  4. Otherwise return `null` (game continues)
- `// why:` comment on evaluation order: loss conditions checked before victory
  so a simultaneous trigger resolves as a loss — matches Legendary rulebook
  precedence
- Pure function: no side effects, no I/O, no `throw`
- Uses explicit `if/else if/else` blocks — no nested ternaries

### C) `src/game.ts` — modified
- Add `endIf: (G, ctx) => evaluateEndgame(G) ?? undefined` to the `play` phase
- `// why:` comment: `endIf` must be pure — all endgame state is read from
  `G.counters` which the rule pipeline maintains via `applyRuleEffects`
- No inline condition logic — delegates entirely to `evaluateEndgame`

### D) `src/types.ts` — modified
- Re-export `EndgameResult`, `EndgameOutcome`, `ENDGAME_CONDITIONS` alongside
  existing game state types

### E) `src/index.ts` — modified
- Export `evaluateEndgame`, `EndgameResult`, `EndgameOutcome`,
  `ENDGAME_CONDITIONS`, `ESCAPE_LIMIT` as named public exports

### F) Tests — `src/endgame/endgame.evaluate.test.ts` — new
- Uses `node:test` and `node:assert` only; does not import from `boardgame.io`;
  does not use `makeMockCtx` (pure function — no `ctx` needed)
- Six tests:
  1. Returns `null` when all endgame counters are absent or `0`
  2. Returns `{ outcome: 'scheme-wins' }` when
     `escapedVillains >= ESCAPE_LIMIT`
  3. Returns `{ outcome: 'scheme-wins' }` when `schemeLoss >= 1`
  4. Returns `{ outcome: 'heroes-win' }` when `mastermindDefeated >= 1`
  5. Loss takes priority when both `schemeLoss: 1` and `mastermindDefeated: 1`
     are set — result must be `'scheme-wins'`
  6. `JSON.stringify(evaluateEndgame(G))` succeeds for all return values
- `// why:` comment on the priority test: prevents regression on the
  loss-before-victory evaluation order decision

---

## Out of Scope

- No scoring UI or VP calculation
- No complex Legendary edge cases (multi-mastermind defeat, divided schemes)
- No city or villain deck logic
- No `onSchemeTwistRevealed` or `onMastermindStrikeRevealed` wiring — this
  packet only reads `G.counters`; counter updates come from the rules pipeline
- No persistence or PostgreSQL access
- No server or UI changes
- No changes to WP-009A/009B outputs (`ruleHooks.*`, `ruleRuntime.*`)
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/endgame/endgame.types.ts` — **new** —
  `EndgameResult`, `ENDGAME_CONDITIONS`, `ESCAPE_LIMIT`
- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **new** — pure
  `evaluateEndgame` function
- `packages/game-engine/src/game.ts` — **modified** — wire `endIf` into `play`
  phase
- `packages/game-engine/src/types.ts` — **modified** — re-export endgame types
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/endgame/endgame.evaluate.test.ts` — **new** —
  `node:test` coverage

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Endgame Types and Constants
- [ ] `src/endgame/endgame.types.ts` exports `EndgameOutcome` as exactly:
      `'heroes-win' | 'scheme-wins'`
- [ ] `ENDGAME_CONDITIONS` exports 3 keys: `ESCAPED_VILLAINS`, `SCHEME_LOSS`,
      `MASTERMIND_DEFEATED` with the exact string values specified in Scope (In)
- [ ] `ESCAPE_LIMIT` is exported and equals `8`
- [ ] `endgame.types.ts` has a `// why:` comment on `ESCAPE_LIMIT`
- [ ] No function properties exist in `endgame.types.ts`
      (confirmed with `Select-String` for `=>` in the file)

### Evaluator Correctness
- [ ] `evaluateEndgame(G)` returns `null` when all endgame counters are absent
      or `0`
- [ ] `evaluateEndgame(G)` returns `{ outcome: 'scheme-wins' }` when
      `G.counters.escapedVillains` equals `ESCAPE_LIMIT`
- [ ] `evaluateEndgame(G)` returns `{ outcome: 'scheme-wins' }` when
      `G.counters.schemeLoss` equals `1`
- [ ] `evaluateEndgame(G)` returns `{ outcome: 'heroes-win' }` when
      `G.counters.mastermindDefeated` equals `1`
- [ ] When both `schemeLoss: 1` and `mastermindDefeated: 1` are set, result
      is `{ outcome: 'scheme-wins' }` — loss takes priority
- [ ] `endgame.evaluate.ts` contains no `throw` statement
      (confirmed with `Select-String`)
- [ ] `endgame.evaluate.ts` has a `// why:` comment on evaluation order

### Game Wiring
- [ ] `src/game.ts` `play` phase has an `endIf` that calls `evaluateEndgame(G)`
- [ ] `endIf` contains no inline `counters[` logic — delegates entirely to
      `evaluateEndgame`
      (confirmed with `Select-String` for `counters[` on the `endIf` line)
- [ ] `endIf` has a `// why:` comment

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test
      files, including all prior WP tests)
- [ ] Evaluate test has all 6 test cases specified in Scope (In)
- [ ] Priority test (simultaneous loss + victory) is present and passes
- [ ] Test file does not import from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] Test uses `node:test` and `node:assert` only

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after endgame wiring
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm evaluateEndgame does not throw
Select-String -Path "packages\game-engine\src\endgame\endgame.evaluate.ts" -Pattern "throw "
# Expected: no output

# Step 4 — confirm no inline counter logic in endIf
Select-String -Path "packages\game-engine\src\game.ts" -Pattern "counters\["
# Expected: no output (counters accessed only inside endgame.evaluate.ts)

# Step 5 — confirm no function properties in types file
Select-String -Path "packages\game-engine\src\endgame\endgame.types.ts" -Pattern "=>"
# Expected: no output

# Step 6 — confirm no require() in any generated file
Select-String -Path "packages\game-engine\src\endgame" -Pattern "require(" -Recurse
# Expected: no output

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
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
- [ ] No `throw` in `endgame.evaluate.ts` (confirmed with `Select-String`)
- [ ] No inline `counters[` in `endIf` in `game.ts`
      (confirmed with `Select-String`)
- [ ] No function properties in `endgame.types.ts`
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — a match can now conclusively end; what
      the three MVP conditions are and how to trigger them in a test scenario
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: the loss-before-victory
      evaluation order; why boolean events use numeric counters (`>= 1`) rather
      than separate boolean fields in `G`; why `ESCAPE_LIMIT` is a hardcoded
      constant for MVP rather than part of `MatchSetupConfig`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-010 checked off with today's date
