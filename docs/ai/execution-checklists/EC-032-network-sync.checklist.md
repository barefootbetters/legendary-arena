# EC-032 — Network Sync & Turn Validation (Execution Checklist)

**Source:** docs/ai/work-packets/WP-032-network-sync-turn-validation.md
**Layer:** Multiplayer Safety / Network Boundary / Authority

**Execution Authority:**
This EC is the authoritative execution checklist for WP-032.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-032.

---

## Before Starting

- [ ] WP-031 complete: `assertInvariant` exists; invariant checks wired
- [ ] `computeStateHash` exists (WP-027)
- [ ] `UIState` exists (WP-028); `isMoveAllowedInStage` exists (WP-008A)
- [ ] D-0401 and D-0402 recorded in DECISIONS.md
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-032.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **ClientTurnIntent shape:**
  ```ts
  interface ClientTurnIntent {
    matchId: string
    playerId: string
    turnNumber: number
    move: {
      name: string
      args: unknown
    }
    clientStateHash?: string  // optional -- for desync detection
  }
  ```

- **IntentValidationResult shape:**
  ```ts
  type IntentValidationResult =
    | { valid: true }
    | { valid: false; reason: string; code: string }
  ```

- `type IntentRejectionCode = 'WRONG_PLAYER' | 'WRONG_TURN' | 'INVALID_MOVE' | 'MALFORMED_ARGS' | 'DESYNC_DETECTED'`
- Desync detection uses `computeStateHash(G)` from WP-027
- On desync, engine state is authoritative (D-0402)

---

## Guardrails

- `ClientTurnIntent` is data-only, JSON-serializable -- no functions
- All validation is **engine-side only** -- clients never validate their own intents
- Validation produces **structured rejection results** -- never throws
- Validation **never mutates G** -- intents validated before moves execute
- Desync detection: if client hash differs from engine hash, engine wins (D-0402)
- Contract is **transport-agnostic** -- no WebSocket/HTTP dependency
- No modifications to boardgame.io's internal transport or Server()
- No `.reduce()` in validation; no boardgame.io import in network files

---

## Required `// why:` Comments

- `ClientTurnIntent`: clients submit intents, engine validates (D-0401); transport-agnostic
- Each rejection code: what condition it catches
- `detectDesync`: engine-authoritative resync (D-0402)
- Validation vs boardgame.io turn order: this packet adds intent-level validation on top

---

## Files to Produce

- `packages/game-engine/src/network/intent.types.ts` -- **new** -- ClientTurnIntent, IntentValidationResult, IntentRejectionCode
- `packages/game-engine/src/network/intent.validate.ts` -- **new** -- validateIntent
- `packages/game-engine/src/network/desync.detect.ts` -- **new** -- detectDesync
- `packages/game-engine/src/types.ts` -- **modified** -- re-export network types
- `packages/game-engine/src/index.ts` -- **modified** -- export network API
- `packages/game-engine/src/network/intent.validate.test.ts` -- **new** -- 9 tests

---

## Common Failure Smells (Optional)

- Validation throws instead of returning structured result -- contract violated
- Server file modified -- scope creep, layer violation
- Missing rejection code in tests -- not all 5 codes covered
- Client hash comparison uses strict equality on objects instead of hash strings -- desync logic wrong

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No throw in `intent.validate.ts`
- [ ] Desync uses `computeStateHash`
- [ ] No server files modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated (intent validation exists; desync detection; D-0401 and D-0402 implemented)
- [ ] `docs/ai/DECISIONS.md` updated (engine-side not server-side validation; desync favors engine D-0402; relationship to boardgame.io turn order)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-032 checked off with date
