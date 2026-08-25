# EC-641 — UIState Draw-Pool Composition Projection (Execution Checklist)

**Source:** docs/ai/work-packets/WP-606-uistate-draw-pool-composition.md
**Layer:** Game Engine

## Before Starting
- [ ] Baseline `main` clean + synced; capture `git rev-parse origin/main`.
- [ ] Scope lock — EXACTLY these 5 files, all under `packages/game-engine/src/ui/`:
      `uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts`,
      `uiState.filter.test.ts`, `uiState.types.drift.test.ts`. Any edit outside
      this set is a FAIL — surface as a blocker, do not proceed.
- [ ] Read the `discardCards` (owner-only) and `matchCardImageUrls` (public)
      precedents in `uiState.build.ts` / `uiState.filter.ts` before editing.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0.

## Locked Values (do not re-derive)
- Owner-only field: `deckComposition?: string[]` on `UIPlayerState`.
- Public field: `villainDeckComposition?: string[]` on `UIDecksState`.
- Order-strip: `[...zone].sort()` (ascending lexicographic) — order-independent multiset.
- `deckComposition` source: `G.playerZones[playerId].deck`.
- `villainDeckComposition` source: `G.villainDeck.deck`.
- Owner redaction posture ≡ `discardCards` (preserve owner / omit non-owner).
- Public pass-through posture ≡ `matchCardImageUrls` (fresh copy, all audiences).
- `villainDeckComposition` `decks` pass-through shape (EXACT — `exactOptionalPropertyTypes`):
  `decks: { ...uiState.decks, ...(uiState.decks.villainDeckComposition !== undefined ? { villainDeckComposition: [...uiState.decks.villainDeckComposition] } : {}) }`
  — never a `villainDeckComposition: undefined` literal, never a bare `[...maybe-undefined]`.

## Guardrails
- **Order-stripped always** — project `[...zone].sort()`, NEVER the raw array;
  raw order leaks the next-draw sequence (the scry-KO secret). A test MUST
  prove order-independence (permuted zone → identical projection).
- **`deckComposition` owner-only** — preserved in `preserveHandCards` (fresh
  copy, conditional assignment, never `= undefined`), OMITTED in
  `redactHandCards`. Opponents + spectators get counts only.
- **`villainDeckComposition` public** — fresh-copied for every audience in the
  `decks` pass-through (aliasing defense); never redacted.
- **Projection-only** — both fields live ONLY on the projection; add NOTHING
  to `G`. `finalStateHash` + `PRE_WP080_HASH` MUST stay byte-identical — a
  moved hash means you touched `G`; STOP and investigate, never re-pin to chase.
- **Optional in the type** — both `?:` so no arena-client fixture backfill;
  pin them by **ADDING a NEW built-projection keyset assertion** over a real
  `buildUIState(...)` result (the menace `result.progress` precedent,
  `uiState.types.drift.test.ts:~150`). Do NOT extend the hand-written-fixture
  `UIDecksState` (:~415) / `UIPlayerState` (:~316) keysets — a keyset over a
  hand-written fixture is **as vacuous as `satisfies`** for an optional add
  (optional adds can't trip either; WP-563 / D-24372).
- **No client / UI / `G` / move / display-array change** — 5 engine files only.

## Required `// why:` Comments
- `uiState.build.ts` `deckComposition` site: order-stripped for information
  safety (composition, not next-draw order); projection-only, no hash surface.
- `uiState.build.ts` `villainDeckComposition` site: same order-strip rationale;
  public because remaining villain composition = public setup − public discard.
- `uiState.filter.ts` `villainDeckComposition` fresh-copy: aliasing defense,
  `matchCardImageUrls` precedent (public, value-identical every audience).

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `deckComposition?` (UIPlayerState) + `villainDeckComposition?` (UIDecksState), JSDoc each
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate both via `[...zone].sort()`
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — owner-only `deckComposition` pass-through; public fresh-copy `villainDeckComposition`
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — owner-only + public audience assertions
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — keyset pins + order-independence guard (+ negative: unsorted raw ≠ projection)

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0; sentinel
      `finalStateHash` + `PRE_WP080_HASH` UNCHANGED (projection-only).
- [ ] Order-independence + owner-only-redaction + public-passthrough tests pass.
- [ ] `none — infrastructure` — STATUS.md states "No user-observable change —
      infrastructure only" (D-24026 inverted; no live-surface check).
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — land D-24417 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-606 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — node `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `git diff --name-only` — only the 5 files above.

## Common Failure Smells (Optional)
- Sentinel hash moved → you added a field to `G` (or projected into a hashed
  structure) instead of the projection; the fields must live ONLY on UIState.
- Opponent audience sees `deckComposition` → you assigned it in
  `redactHandCards`, or forgot the owner-only conditional in `preserveHandCards`.
- Drift test still green after removing a field → you used `satisfies`, OR you
  extended a hand-written-fixture keyset (`:415`/`:316`) — equally vacuous for
  an optional add. The pin MUST be a keyset over a real `buildUIState(...)`.
- Order-independence test passes vacuously → the negative (unsorted raw ≠
  projection) is missing, so the sort isn't actually asserted.
