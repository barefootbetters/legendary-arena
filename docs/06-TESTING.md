# 06 — Testing

> How testing works in Legendary Arena.
> Determinism-first, replay-verifiable, tightly coupled to architectural
> invariants.
>
> **Last updated:** 2026-04-11
>
> **Current state:** 132 tests passing across all packages (123 engine,
> 6 server, 3 registry). Test coverage spans setup validation, moves,
> rule pipeline, endgame, lobby, drift detection, persistence contracts,
> and CLI scripts.

Testing in Legendary Arena is part of the architecture.
If a test contradicts an architectural invariant, the test is wrong.
Architecture is authoritative.

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
- **Moves must not throw due to invalid player input** — tests assert
  failure through `MoveResult`, not via exceptions. Invariant violations
  or programmer errors may still throw.
- **`G` must remain JSON-serializable** — every test that mutates `G`
  should verify `JSON.stringify(G)` succeeds. If a state cannot be
  JSON-serialized, it cannot be persisted or replayed and is therefore
  an invalid game state.
- **Registry access is forbidden outside `Game.setup()`** — any test
  that accesses registry methods during moves is invalid.
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

## Test Types (Defined by Architecture)

Each WP's EC specifies the exact tests required. Tests enforce
architectural invariants, not implementation details.

| Type | File pattern | Purpose | Created by |
|---|---|---|---|
| Unit | `*.logic.test.ts` | Pure function correctness (zoneOps, parsers, validators) | WP-005B+ |
| Contract | `*.validate.test.ts` | Type shapes, field presence, error accumulation | WP-005A+ |
| Move | `moves/*.test.ts` | Move validation + stage gating | WP-008B |
| Setup | `setup/*.test.ts` | `Game.setup()`, `validateMatchSetup` | WP-005B |
| Rule Pipeline | `rules/*.test.ts` | Hook execution + effect application | WP-009B |
| Endgame | `endgame/*.test.ts` | Victory/loss condition evaluation | WP-010 |
| Persistence | `persistence/*.test.ts` | Snapshot purity, JSON-serializability, zone counts | WP-013 |
| Drift Detection | inline in test files | Canonical arrays match union types | WP-007A+ |
| CLI Scripts | `scripts/*.test.ts` | Argument parsing, error handling, fetch stubs | WP-012 |
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

7. **Tests must explain what invariant they protect** — if violating
   the invariant would be catastrophic for replay or multiplayer
   correctness, say so in a `// why:` comment.

---

## Test Inventory (as of 2026-04-11)

| Package | Test count | Suites | Key coverage areas |
|---|---|---|---|
| `@legendary-arena/game-engine` | 123 | 39 | Setup validation, moves, rules, endgame, lobby, drift detection, persistence |
| `@legendary-arena/server` | 6 | 2 | CLI script argument parsing, fetch stubs, error handling |
| `@legendary-arena/registry` | 3 | 1 | Registry smoke test (sets, cards) |

Engine tests live in `packages/game-engine/src/**/*.test.ts`.
Server tests live in `apps/server/scripts/**/*.test.ts`.

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
| Snapshot tests using object identity | Breaks determinism | Compare serialized output or derived invariants |

---

**See also:**
- [02-ARCHITECTURE.md](02-ARCHITECTURE.md) — determinism, move validation contract
- [04-DEVELOPMENT-SETUP.md](04-DEVELOPMENT-SETUP.md) — running the registry smoke test
- [05-ROADMAP.md](05-ROADMAP.md) — WP-027 (Replay Verification Harness)
- [ai/execution-checklists/EC-010-endgame.checklist.md](ai/execution-checklists/EC-010-endgame.checklist.md) — reference EC with test requirements
