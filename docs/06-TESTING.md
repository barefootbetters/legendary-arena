# 06 — Testing

> How testing works in Legendary Arena.
> Determinism-first, replay-verifiable, tightly coupled to architectural
> invariants.
>
> **Last updated:** 2026-04-09
>
> **Current state:** No game engine tests exist yet. The game engine
> package (`packages/game-engine/`) is created by WP-002. This document
> defines the testing standards that all future tests must follow.
>
> The only existing test is `packages/registry/src/registry.smoke.test.ts`
> (created by WP-003's predecessor work).

---

## Test Runner & Conventions

| Setting | Value | Authority |
|---|---|---|
| Runner | `node:test` (native Node.js) | CLAUDE.md |
| Assertions | `node:assert` (native Node.js) | CLAUDE.md |
| File extension | `.test.ts` — never `.test.mjs` | CLAUDE.md, code-style.md |
| Node version | v22+ (built-in test runner) | CLAUDE.md |
| Module system | ESM only — no CommonJS | CLAUDE.md |

**Explicitly forbidden:**
- Vitest, Jest, Mocha — use `node:test` only
- `boardgame.io/testing` — use `makeMockCtx` instead
- `.test.mjs` extension — always `.test.ts`
- Live server or database connections in unit tests

---

## Test Philosophy

Testing follows the same invariants as the game engine:

- **Determinism is non-negotiable** — tests never use `Math.random()`,
  real time, or external services. All randomness comes from
  `ctx.random.*` with seeded values.
- **Moves never throw** — tests assert silent failure via `MoveResult`,
  not try/catch.
- **`G` must remain JSON-serializable** — every test that mutates `G`
  should verify `JSON.stringify(G)` succeeds.
- **Registry is only available during `Game.setup()`** — no test may
  call registry methods from within a move.
- **Zones store only `CardExtId` strings** — never full card objects.

---

## Mock Context (`makeMockCtx`)

All game engine tests use `makeMockCtx` from
`packages/game-engine/src/test/mockCtx.ts` (created by WP-005B).

Key behaviors:
- `ctx.random.Shuffle` **reverses** arrays (proves shuffle ran — an
  identity shuffle would not change the order)
- Provides `ctx.events` stubs (`endTurn`, `endPhase`, `endGame`)
- Does NOT import from `boardgame.io` — independently testable

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { makeMockCtx } from '../test/mockCtx.ts';

describe('evaluateEndgame', () => {
  it('returns null when no endgame counters are set', () => {
    const gameState = { counters: {} };
    const result = evaluateEndgame(gameState);
    assert.strictEqual(result, null);
  });
});
```

---

## Test Types (Planned)

These test categories will be created as Work Packets are executed.
Each WP's EC specifies the exact tests required.

| Type | File pattern | What it tests | Created by |
|---|---|---|---|
| Unit | `*.logic.test.ts` | Pure functions (zoneOps, parsers, validators) | WP-005B+ |
| Contract | `*.validate.test.ts` | Type shapes, field presence | WP-005A+ |
| Move | `moves/*.test.ts` | Move validation + stage gating | WP-008B |
| Setup | `setup/*.test.ts` | `Game.setup()`, `validateMatchSetup` | WP-005B |
| Rule Pipeline | `rules/*.test.ts` | Hook execution + effect application | WP-009B |
| Endgame | `endgame/*.test.ts` | Victory/loss condition evaluation | WP-010 |
| Drift Detection | inline in test files | Canonical arrays match union types | WP-007A+ |
| Replay | `replay/*.test.ts` | Full game replay from recorded moves | WP-027 |

---

## Drift-Detection Tests

These guard against architectural drift between TypeScript union types
and their canonical constant arrays. Required whenever a canonical array
exists.

| Array | Union Type | Created by |
|---|---|---|
| `MATCH_PHASES` | `MatchPhase` | WP-007A |
| `TURN_STAGES` | `TurnStage` | WP-007A |
| `CORE_MOVE_NAMES` | — | WP-008A |
| `RULE_TRIGGER_NAMES` | `RuleTriggerName` | WP-009A |
| `RULE_EFFECT_TYPES` | `RuleEffectType` | WP-009A |
| `REVEALED_CARD_TYPES` | `RevealedCardType` | WP-014 |

**How drift tests work:**
```ts
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('drift detection', () => {
  // why: failure here means a value was added to the type but not the
  // array, or vice versa — this breaks replay determinism
  it('MATCH_PHASES contains exactly the expected values', () => {
    assert.deepStrictEqual(
      [...MATCH_PHASES],
      ['lobby', 'setup', 'play', 'end']
    );
  });
});
```

---

## Test Rules (from Execution Checklists)

Every EC that produces tests enforces these rules:

- [ ] Test file uses `node:test` and `node:assert` only
- [ ] Test file does NOT import from `boardgame.io`
- [ ] Test uses `makeMockCtx` from `src/test/mockCtx.ts`
- [ ] `JSON.stringify(G)` succeeds after every state-mutating operation
- [ ] No test requires network access or database connections
- [ ] Tests run without a live boardgame.io server
- [ ] Each test has a descriptive name explaining what it proves
- [ ] `// why:` comments on non-obvious assertions

---

## Writing Tests — Guidelines

1. **Test the contract, not the implementation** — assert `MoveResult`
   outcomes and observable state changes, not internal helper calls.

2. **Never mutate `G` directly in tests** — always go through the move
   function or helper, matching how boardgame.io calls it.

3. **Use explicit `for...of` loops** in test setup when mirroring
   production code patterns.

4. **Add `// why:` comments** on assertions that enforce architectural
   decisions (evaluation order, loss-before-victory, etc.).

5. **No abbreviated variable names** — `gameState` not `gs`,
   `expectedResult` not `exp`, `villainGroup` not `vg`.

6. **Keep tests under 30 lines** — break complex scenarios into
   named setup helpers.

---

## Existing Tests

| Package | File | Tests | Created by |
|---|---|---|---|
| `@legendary-arena/registry` | `src/registry.smoke.test.ts` | `listSets().length > 0`, `listCards().length > 0` | WP-003 (predecessor) |

All future tests will live in `packages/game-engine/src/**/*.test.ts`.

---

## Common Gotchas

| Mistake | Why it's wrong | What to do instead |
|---|---|---|
| `import { describe } from 'vitest'` | Project uses `node:test` | `import { describe, it } from 'node:test'` |
| `expect(x).toBe(y)` | Vitest/Jest syntax | `assert.strictEqual(x, y)` |
| `import { Client } from 'boardgame.io/testing'` | Forbidden in tests | Use `makeMockCtx` |
| `Math.random()` in test setup | Breaks determinism | Use `ctx.random.*` via `makeMockCtx` |
| `.test.mjs` file extension | Project convention | Use `.test.ts` |
| Direct `G.field = value` mutation | Bypasses move contract | Call the move function |
| `require('node:test')` | Project is ESM-only | `import { describe, it } from 'node:test'` |

---

**See also:**
- [02-ARCHITECTURE.md](02-ARCHITECTURE.md) — determinism, move validation contract
- [04-DEVELOPMENT-SETUP.md](04-DEVELOPMENT-SETUP.md) — running the registry smoke test
- [05-ROADMAP.md](05-ROADMAP.md) — WP-027 (Replay Verification Harness)
- [ai/execution-checklists/EC-010-endgame.checklist.md](ai/execution-checklists/EC-010-endgame.checklist.md) — reference EC with test requirements
