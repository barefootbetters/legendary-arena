# EC-027 — Determinism & Replay Verification Harness (Execution Checklist)

**Source:** docs/ai/work-packets/WP-027-determinism-replay-verification-harness.md
**Layer:** Engine Infrastructure / Verification

**Execution Authority:**
This EC is the authoritative execution checklist for WP-027.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-027.

---

## Before Starting

- [ ] WP-026 complete: all MVP gameplay mechanics in place (WP-002 through WP-026)
- [ ] All randomness flows through `ctx.random.*` exclusively
- [ ] `MatchSetupConfig` exists (WP-005A); `makeMockCtx` exists (WP-005B)
- [ ] D-0002 (Determinism Is Non-Negotiable) and D-0201 (Replay as First-Class Feature) in DECISIONS.md
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-027.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **ReplayInput shape:**
  ```ts
  interface ReplayInput {
    seed: string
    setupConfig: MatchSetupConfig
    playerOrder: string[]
    moves: ReplayMove[]
  }

  interface ReplayMove {
    playerId: string
    moveName: string
    args: unknown
  }
  ```

- `ReplayResult`: `{ finalState: LegendaryGameState; stateHash: string; moveCount: number }`
- `ReplayInput` is Class 2 (Configuration) — safe to persist
- `computeStateHash(G)` uses canonical JSON serialization (sorted keys)
- `verifyDeterminism` runs replay **twice** and compares hashes

---

## Guardrails

- `replayGame` is a **pure function** — identical input produces identical output, no I/O
- State hashing must be **canonical** — deterministic serialization with sorted keys
- Harness does NOT use `boardgame.io/testing` — uses `makeMockCtx` or equivalent
- Harness does NOT modify any gameplay logic — observation and verification only
- `ReplayInput` is data-only, JSON-serializable — no functions
- No `.reduce()` in harness logic; no `Math.random` in replay files
- No `boardgame.io` import in any replay file

---

## Required `// why:` Comments

- `ReplayInput`: everything needed to reconstruct a game deterministically; Class 2 data
- `computeStateHash`: canonical serialization approach (sorted keys or equivalent)
- `replayGame`: reconstruction-from-inputs approach — G is never persisted
- `verifyDeterminism`: two-run comparison proves determinism

---

## Files to Produce

- `packages/game-engine/src/replay/replay.types.ts` — **new** — ReplayInput, ReplayMove, ReplayResult
- `packages/game-engine/src/replay/replay.execute.ts` — **new** — replayGame
- `packages/game-engine/src/replay/replay.hash.ts` — **new** — computeStateHash
- `packages/game-engine/src/replay/replay.verify.ts` — **new** — verifyDeterminism
- `packages/game-engine/src/types.ts` — **modified** — re-export replay types
- `packages/game-engine/src/index.ts` — **modified** — export replay API
- `packages/game-engine/src/replay/replay.verify.test.ts` — **new** — tests

---

## Common Failure Smells (Optional)

- Same input produces different hashes -> nondeterminism in engine
- Hash uses unsorted keys -> not canonical serialization
- Gameplay files modified -> harness is verification-only, no engine changes

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No gameplay logic modified (confirmed with `git diff --name-only`)
- [ ] No `Math.random` in replay files
- [ ] `docs/ai/STATUS.md` updated (replay harness exists; determinism formally provable; D-0201 implemented)
- [ ] `docs/ai/DECISIONS.md` updated (canonical hashing approach; why makeMockCtx not boardgame.io/testing; ReplayInput as Class 2)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-027 checked off with date
