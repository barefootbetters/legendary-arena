# EC-026 — Scheme Setup Instructions & City Modifiers (Execution Checklist)

**Source:** docs/ai/work-packets/WP-026-scheme-setup-instructions-city-modifiers.md
**Layer:** Game Engine / Setup & Board Configuration

**Execution Authority:**
This EC is the authoritative execution checklist for WP-026.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-026.

**Terminology note:**
References to "Representation Before Execution" (RBE) refer to D-2601 in
`docs/ai/DECISIONS.md`, which formalizes the pattern:
- data-only representation first
- deterministic execution applied by a pure executor
- no execution logic embedded in registry data or runtime wiring

---

## Before Starting

- [ ] WP-025 complete: `BoardKeyword`, `G.cardKeywords` exist
- [ ] `schemeTwistHandler` exists (WP-024); `G.hookRegistry` has scheme entries
- [ ] "Representation Before Execution" decision (D-2601) documented in
      `docs/ai/DECISIONS.md`
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-026.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **SchemeSetupInstruction type union (MVP):**
  `'modifyCitySize'` | `'addCityKeyword'` | `'addSchemeCounter'` | `'initialCityState'`

- `SchemeSetupInstruction`: `{ type: SchemeSetupType; value: unknown }` — data-only, JSON-serializable
- `G.schemeSetupInstructions: SchemeSetupInstruction[]` — stored for replay observability
- **Timing:** instructions execute during `setup` phase, after deck construction, before first turn

---

## Guardrails

- `SchemeSetupInstruction` is **data-only** — no functions, no closures
  (per "Representation Before Execution" decision, D-2601)
- Instructions execute **once** during setup — never re-executed during moves
- No hard-coded scheme logic — all behavior from declarative instruction data
- `SchemeSetupType` is a closed union — new types require DECISIONS.md entry
- Unknown instruction types log warning to `G.messages`, skip (never throw)
- MVP rule: while `CityZone` is a fixed tuple, `modifyCitySize` MUST log a
  warning to `G.messages`, perform NO mutation, and return `G` unchanged
- Scheme **setup** (this packet) is separate from scheme **twist** (WP-024)
- WP-025 contracts (`boardKeywords.types.ts`) must not be modified
- No `.reduce()` in instruction execution; no `boardgame.io` import in scheme setup files

---

## Required `// why:` Comments

- `SchemeSetupInstruction`: follows the "Representation Before Execution"
  decision (D-2601) — data-only contracts applied by a deterministic executor
- Each instruction type handler: what it modifies and how
- Scheme setup timing: runs after base construction, before first turn
- `modifyCitySize` approach: document tuple vs dynamic in DECISIONS.md

---

## Files to Produce

- `packages/game-engine/src/scheme/schemeSetup.types.ts` — **new** — SchemeSetupInstruction, SchemeSetupType
- `packages/game-engine/src/scheme/schemeSetup.execute.ts` — **new** — executeSchemeSetup
- `packages/game-engine/src/setup/buildSchemeSetupInstructions.ts` — **new** — buildSchemeSetupInstructions
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — wire scheme setup
- `packages/game-engine/src/types.ts` — **modified** — add schemeSetupInstructions to LegendaryGameState
- `packages/game-engine/src/index.ts` — **modified** — exports
- `packages/game-engine/src/scheme/schemeSetup.execute.test.ts` — **new** — tests

---

## Common Failure Smells (Optional)

- Instructions re-execute during moves -> must be setup-only
- Unknown instruction type crashes -> should warn and skip
- Scheme twist logic mixed into setup -> setup and twist are separate mechanisms

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] WP-025 contracts not modified (confirmed with `git diff`)
- [ ] Unknown instruction types handled gracefully (warning, no throw)
- [ ] `docs/ai/STATUS.md` updated (scheme setup instructions work; Phase 5 complete)
- [ ] `docs/ai/DECISIONS.md` updated (setup vs twist separation; City size modification approach; MVP instruction type simplifications)
- [ ] `docs/ai/ARCHITECTURE.md` updated (add `G.schemeSetupInstructions` to Field Classification Reference)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-026 checked off with date
