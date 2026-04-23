# WP-029 — Spectator & Permissions View Models

**Status:** Complete  
**Primary Layer:** Engine / UI Boundary (Permissions & Audience Views)  
**Dependencies:** WP-028

---

## Session Context

WP-028 introduced `UIState` as the single authoritative view model and
`buildUIState(G, ctx)` as the pure projection function. This packet extends
the projection to support multiple audiences — active players, non-active
players, and spectators — by filtering the same `UIState` rather than creating
alternate game states. This implements D-0302 (Single UIState, Multiple
Audiences). No hidden information may leak to spectators. Replay viewers use
the spectator view.

---

## Goal

Extend the UI state contract to support permission-aware, audience-filtered
view models. After this session:

- `UIAudience` defines supported audience roles: `player` (with `playerId`)
  and `spectator`
- `filterUIStateForAudience(uiState, audience)` is a pure function that
  produces an audience-appropriate view by filtering the authoritative `UIState`
- Active players see their own hand contents; non-active players and spectators
  see hand counts only
- Spectators see all public information but no hidden information (no deck
  order, no opponent hand contents)
- No alternate "game states" exist — all views derive from one `UIState`
- Tests prove no hidden information leakage in spectator views

---

## Assumes

- WP-028 complete. Specifically:
  - `packages/game-engine/src/ui/uiState.types.ts` exports `UIState`,
    `UIPlayerState`, and all sub-types (WP-028)
  - `packages/game-engine/src/ui/uiState.build.ts` exports `buildUIState`
    (WP-028)
  - `UIState` is JSON-serializable and contains no engine internals (WP-028)
  - `packages/game-engine/src/replay/replay.types.ts` exports `ReplayInput`
    (WP-027)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-0302 (Single UIState, Multiple Audiences)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the UI
  boundary is explicit: UI consumes read-only projections. Spectator views
  are filtered projections of the same `UIState`, not separate game states.
- `docs/ai/DECISIONS.md` — read D-0302 (Single UIState, Multiple Audiences).
  This packet implements D-0302. One authoritative `UIState`, audience-specific
  views are filtered projections.
- `docs/ai/DECISIONS.md` — read D-0301 (UI Consumes Projections Only).
  The audience filter operates on `UIState`, not on `G` — the filter never
  touches engine state.
- `packages/game-engine/src/ui/uiState.types.ts` — read `UIState` and
  `UIPlayerState`. The filter modifies player state visibility (hand contents
  vs hand counts) based on audience.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `audienceType` not `aud`), Rule 6 (`// why:` on information hiding rules),
  Rule 8 (no `.reduce()`), Rule 13 (ESM only).

**Critical design note — one UIState, filtered views:**
There is exactly ONE `UIState` produced by `buildUIState(G, ctx)`. The
audience filter is a **post-processing step** that redacts or replaces fields
based on who is viewing. It does not re-derive from `G` — it filters the
already-projected `UIState`. This ensures consistency: all audiences see the
same game truth, with only visibility differences.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — filtering involves no randomness
- Never throw — return a safe filtered view
- Output must be JSON-serializable
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in any new file
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `filterUIStateForAudience` is a **pure function** — no I/O, no mutation of
  input `UIState`, no side effects
- The filter operates on `UIState` (the projection) — **never on `G` or `ctx`**
- No alternate game states — all views derive from one `UIState`
- Hidden information rules (MVP):
  - Active player sees own hand card ext_ids
  - Non-active players see other players' hand counts only (not card ids)
  - Spectators see all public zones + hand counts for all players (no hand
    contents)
  - Deck order is never revealed to any audience
- Replay viewers use the `spectator` audience
- No `.reduce()` in filter logic — use `for...of`
- WP-028 contract files (`uiState.types.ts`) may be extended (add audience
  types) but existing fields must not be removed
- Tests use `makeMockCtx` — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **UIAudience shape:**
  ```ts
  type UIAudience =
    | { kind: 'player'; playerId: string }
    | { kind: 'spectator' }
  ```

- **Information visibility matrix (MVP):**

  | Data | Active player | Non-active player | Spectator |
  |---|---|---|---|
  | Own hand cards | ext_ids visible | N/A | N/A |
  | Other player hand | count only | count only | count only |
  | Deck contents/order | hidden | hidden | hidden |
  | City cards | visible | visible | visible |
  | HQ cards | visible | visible | visible |
  | Victory pile count | visible | visible | visible |
  | Economy (own) | visible | hidden | hidden |
  | Game log | visible | visible | visible |

---

## Scope (In)

### A) `src/ui/uiAudience.types.ts` — new

- `type UIAudience` as specified in locked contract values
- `// why:` comment: audiences are roles, not permissions; the engine does not
  enforce access control — it produces filtered views

### B) `src/ui/uiState.filter.ts` — new

- `filterUIStateForAudience(uiState: UIState, audience: UIAudience): UIState`
  — pure function:
  1. If `audience.kind === 'player'`:
     - For the active player's own `UIPlayerState`: include hand card ext_ids
     - For all other players: replace hand with count only (redact ext_ids)
     - Include own economy; redact other players' economy
  2. If `audience.kind === 'spectator'`:
     - All player hands: count only (no ext_ids)
     - All economy: hidden
     - All public zones (City, HQ, victory counts, mastermind, scheme): visible
  3. In all cases: deck contents/order never included (already hidden by
     `buildUIState` from WP-028 — verify this)
  - Returns a new `UIState` — never mutates input
  - Uses `for...of` (no `.reduce()`)
  - `// why:` comment on each redaction explaining what is hidden and why

### C) `src/ui/uiState.types.ts` — modified

- Add `UIAudience` re-export
- If needed, add an optional `handCards?: string[]` field to `UIPlayerState`
  that is populated only for the active player's own view (document approach
  in DECISIONS.md)

### D) `src/index.ts` — modified

- Export `UIAudience`, `filterUIStateForAudience`

### E) Tests — `src/ui/uiState.filter.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Nine tests:
  1. Active player sees own hand card ext_ids
  2. Active player does NOT see other player's hand cards
  3. Spectator sees hand counts for all players (no ext_ids)
  4. Spectator does NOT see any player's hand cards
  5. Deck order is never present in any audience view
  6. City and HQ are visible to all audiences
  7. Game log is visible to all audiences
  8. Filter does not mutate input `UIState` (deep equality check)
  9. Filtered `UIState` is JSON-serializable

---

## Out of Scope

- **No access control enforcement** — the engine produces views, it does not
  enforce who can call what
- **No real-time push or subscription** — views are computed on demand
- **No admin or debug audience** — MVP has player and spectator only
- **No partial game state hiding** (fog of war beyond hand contents) — future
- **No UI rendering** — this is a data contract only
- **No server or network changes**
- **No persistence / database access**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiAudience.types.ts` — **new** — UIAudience
  type
- `packages/game-engine/src/ui/uiState.filter.ts` — **new** —
  filterUIStateForAudience
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — add audience
  re-export, optional handCards field
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — add
  `handCards: [...zones.hand]` to player projection (pre-flight authorized,
  01.5 wiring allowance — buildUIState must populate handCards so
  filterUIStateForAudience can expose them to the owning player)
- `packages/game-engine/src/index.ts` — **modified** — export audience types
  and filter
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **new** — tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Audience Types
- [ ] `UIAudience` has `player` (with playerId) and `spectator` kinds
- [ ] Audience types are JSON-serializable

### Information Hiding
- [ ] Active player sees own hand card ext_ids
- [ ] Active player does NOT see other players' hand cards
- [ ] Spectator sees hand counts only — no hand card ext_ids for any player
- [ ] Deck order never present in any view
- [ ] City, HQ, game log visible to all audiences

### Pure Function
- [ ] `filterUIStateForAudience` does not mutate input UIState
      (deep equality test)
- [ ] Filter is deterministic (same inputs → same output)
- [ ] No I/O, no side effects

### No Alternate States
- [ ] Filter operates on UIState — never on G or ctx
- [ ] No new UIState derivation from G — filter is post-processing only

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Tests cover: active player view, non-active view, spectator view
- [ ] Tests confirm no hidden information leakage in spectator view
- [ ] Tests confirm input UIState not mutated
- [ ] All test files use `.test.ts`; no boardgame.io import

### Scope Enforcement
- [ ] No `.reduce()` in filter logic
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding audience filter
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in filter files
Select-String -Path "packages\game-engine\src\ui\uiState.filter.ts","packages\game-engine\src\ui\uiAudience.types.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm filter does not import G or engine internals
Select-String -Path "packages\game-engine\src\ui\uiState.filter.ts" -Pattern "LegendaryGameState|hookRegistry|ImplementationMap"
# Expected: no output

# Step 5 — confirm no .reduce()
Select-String -Path "packages\game-engine\src\ui\uiState.filter.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 6 — confirm no require()
Select-String -Path "packages\game-engine\src\ui" -Pattern "require(" -Recurse
# Expected: no output

# Step 7 — confirm no files outside scope
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
- [ ] No boardgame.io import in filter files
      (confirmed with `Select-String`)
- [ ] Filter does not touch G or engine internals
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in filter logic (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — spectator and permission-filtered views
      exist; D-0302 is implemented; replay viewers use spectator audience
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why filter operates on
      UIState not G; how hand visibility is handled (ext_ids for own hand,
      counts for others); whether handCards is optional or always present
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-029 checked off with today's date
