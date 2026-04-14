# EC-029 — Spectator & Permissions View Models (Execution Checklist)

**Source:** docs/ai/work-packets/WP-029-spectator-permissions-view-models.md
**Layer:** Engine / UI Boundary (Permissions & Audience Views)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-029.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-029.

---

## Before Starting

- [ ] WP-028 complete: `UIState`, `UIPlayerState`, `buildUIState` exist
- [ ] `ReplayInput` exists (WP-027)
- [ ] D-0302 (Single UIState, Multiple Audiences) in DECISIONS.md
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-029.
If formatting, spelling, or ordering differs, the implementation is invalid.

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

- Replay viewers use the `spectator` audience

---

## Guardrails

- `filterUIStateForAudience` is a **pure post-processing function** on UIState — never touches G or ctx
- One `UIState`, filtered views — no alternate game states
- Deck order is **never revealed** to any audience
- Filter returns new `UIState` — never mutates input
- WP-028 contract files (`uiState.types.ts`) may be extended but existing fields must not be removed
- No `.reduce()` in filter logic — use `for...of`
- No `boardgame.io` import in filter files
- Filter does not import `LegendaryGameState`, `hookRegistry`, or `ImplementationMap`

---

## Required `// why:` Comments

- `UIAudience`: audiences are roles, not permissions; engine produces views, does not enforce access control
- Each redaction in filter: what is hidden and why
- Hand visibility: ext_ids for own hand, counts for others

---

## Files to Produce

- `packages/game-engine/src/ui/uiAudience.types.ts` — **new** — UIAudience type
- `packages/game-engine/src/ui/uiState.filter.ts` — **new** — filterUIStateForAudience
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — add audience re-export, optional handCards field
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — add handCards population to player projection (pre-flight authorized, 01.5 wiring allowance)
- `packages/game-engine/src/index.ts` — **modified** — export audience types and filter
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **new** — tests

---

## Common Failure Smells (Optional)

- Spectator view contains hand card ext_ids -> information leakage
- Filter imports LegendaryGameState -> must operate on UIState only
- Filter mutates input UIState -> must return new object

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Filter does not touch G or engine internals
- [ ] No hidden information leakage in spectator view (test confirms)
- [ ] `docs/ai/STATUS.md` updated (spectator views exist; D-0302 implemented; replay uses spectator)
- [ ] `docs/ai/DECISIONS.md` updated (filter operates on UIState not G; hand visibility approach; handCards optional vs always present)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-029 checked off with date
