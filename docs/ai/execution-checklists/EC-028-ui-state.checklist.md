# EC-028 — UI State Contract (Execution Checklist)

**Source:** docs/ai/work-packets/WP-028-ui-state-contract-authoritative-view-model.md
**Layer:** Engine / UI Boundary (Read-Only Projection)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-028.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-028.

---

## Before Starting

- [ ] WP-027 complete: replay harness exists; all MVP gameplay in place
- [ ] `LegendaryGameState` is stable with all fields
- [ ] `FinalScoreSummary` (WP-020), `TurnEconomy` (WP-018) exist
- [ ] D-0301 (UI Consumes Projections Only) in DECISIONS.md
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-028.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **UIState top-level shape:**
  ```ts
  interface UIState {
    game: {
      phase: string
      turn: number
      activePlayerId: string
      currentStage: string
    }
    players: UIPlayerState[]
    city: UICityState
    hq: UIHQState
    mastermind: UIMastermindState
    scheme: UISchemeState
    economy: UITurnEconomyState
    log: string[]
    gameOver?: UIGameOverState
  }
  ```

- `UIPlayerState`: `{ playerId, deckCount, handCount, discardCount, inPlayCount, victoryCount, woundCount }`
- Player zones projected as **counts** — not `CardExtId[]` arrays
- `buildUIState(gameState: LegendaryGameState, ctx: UIBuildContext): UIState`
  is the ONLY way UI gets state. `UIBuildContext` is a local structural
  interface `{ readonly phase: string | null, readonly turn: number,
  readonly currentPlayer: string }` — not boardgame.io `Ctx`.

---

## Guardrails

- `buildUIState` is a **pure function** — no I/O, no mutation of G or ctx,
  no caching, no memoization, no closures over G
- `buildUIState` is NOT part of the boardgame.io lifecycle — MUST NOT be
  called from `game.ts`, any move, or any phase hook
- `buildUIState` takes a local `UIBuildContext` structural interface (not
  boardgame.io `Ctx`) — `{ readonly phase, readonly turn, readonly currentPlayer }`.
  No optional fields, no widening.
- `UIState` contains **no engine internals**: no `hookRegistry`, `ImplementationMap`,
  `villainDeckCardTypes`, `cardStats`, `heroAbilityHooks`, `schemeSetupInstructions`,
  no registry objects or types, no setup builder functions
- UIState is the **only** state the UI consumes — no direct G access
- No registry import in `buildUIState` — card display resolution is a separate UI concern
- No `.reduce()` in projection logic — use `for...of`
- No `boardgame.io` import in UI state files
- UIState is deterministic: same G + ctx always produces same UIState

---

## Required `// why:` Comments

- UIState: only data the UI sees; engine internals hidden to prevent logic leakage
- Each projection: what is hidden and why (hookRegistry, cardStats, etc.)
- Zone projection strategy: counts vs card lists (document in DECISIONS.md)

---

## Files to Produce

- `packages/game-engine/src/ui/uiState.types.ts` — **new** — UIState and all sub-types
- `packages/game-engine/src/ui/uiState.build.ts` — **new** — buildUIState pure function
- `packages/game-engine/src/types.ts` — **modified** — re-export UI types
- `packages/game-engine/src/index.ts` — **modified** — export UI API
- `packages/game-engine/src/ui/uiState.build.test.ts` — **new** — tests

---

## Common Failure Smells (Optional)

- `hookRegistry` or `cardStats` key appears in UIState -> engine leakage
- buildUIState mutates G -> deep equality test should catch this
- Card arrays instead of counts in player zones -> projection strategy violated

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Engine internals excluded from UIState type
- [ ] `buildUIState` does not mutate G (deep equality test)
- [ ] `docs/ai/STATUS.md` updated (UIState contract exists; UI never reads G directly; D-0301 implemented)
- [ ] `docs/ai/DECISIONS.md` updated (zone projection strategy; why UIState hides internals; card display resolution separate)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-028 checked off with date
