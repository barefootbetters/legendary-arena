# EC-701 — Project the Transform side deck to the UI + render a face-up pile (Execution Checklist)

**Source:** docs/ai/work-packets/WP-664-transform-deck-ui-projection.md
**Layer:** Game Engine (UIState projection) + Arena Client (render)

## Before Starting
- [ ] Re-baseline on `origin/main`. Confirm `transformDeck` STILL appears nowhere in `packages/game-engine/src/ui/` and nowhere in `apps/arena-client/src/` (`git grep -n transformDeck -- packages/game-engine/src/ui apps/arena-client/src` → empty). If it now exists, STOP — someone shipped it.
- [ ] Confirm `G.transformDeck: CardExtId[]` is still an always-present top-level field (`packages/game-engine/src/types.ts` ~L1397) and that `buildInitialGameState` always seeds it (`[]` for non-transform games).
- [ ] Read the model: `koPile` end-to-end — `UIKoPileState` / `koPile: UIKoPileState` (`ui/uiState.types.ts`), its build (`buildUIState`), its filter pass-through (`deepCopyKoPile` / the shared-board block, `ui/uiState.filter.ts` ~L444+). And the simpler `UIDisplayEntry[]` piles: `strikePile` / `twistPile` / `escapedPile` via `buildDisplayEntries` + `deepCopyDisplayEntries`. The transform deck is the `UIDisplayEntry[]` shape.
- [ ] Read the client model: `apps/arena-client/src/components/play/KOPile.vue` (public face-up pile leaf; type-only engine import, D-16502) + `CardTile.vue` (renders one `UICardDisplay`). Read `PlayDesktop.vue` + `PlayMobile.vue` for where shared-board leaves are wired.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test`, and the arena-client test, exit 0 (record baselines).

## Locked Values (do not re-derive)
- UIState field: **`transformDeck?: UIDisplayEntry[]`** — top-level, **optional** on the type (no fixture backfill), **always populated** by `buildUIState`, **public** (unredacted for all audiences), `[]` when the side deck is empty.
- Build: **`transformDeck: buildDisplayEntries(gameState.transformDeck, gameState)`** in `buildUIState` (per-entry shallow copy — never `[...zone]`).
- Filter: a top-level public pass-through, guarded — **`...(uiState.transformDeck !== undefined ? { transformDeck: deepCopyDisplayEntries(uiState.transformDeck) } : {})`**. NEVER redacted (face-up shared board — opponent + spectator see it too).
- Client leaf: **`TransformDeck.vue`** — header "Transform Deck", one non-interactive face-up `CardTile` per entry, hidden (`v-if`) when the prop is absent or empty. Type-only engine import.
- Wiring: `PlayDesktop.vue` + `PlayMobile.vue`, prop fed `uiState.transformDeck`.

## Guardrails
- **READ-ONLY. No `G`/`ctx` mutation, no new `G` field, no move, no card data, no keyword.** This WP only projects existing state + renders it. If any of these becomes necessary, STOP — the WP is mis-scoped.
- **NO hash re-pin.** `computeStateHash` hashes `G`, not `UIState`; this WP adds no `G` field. If `PRE_WP080_HASH` or a sentinel `finalStateHash` moves, you changed `G` by accident — investigate, do NOT re-pin. (`git grep -n "PRE_WP080_HASH\|finalStateHash" -- '*.test.ts' '*.json'` unchanged.)
- **Board-Visible Field Rule (Invariant).** The field is: (1) declared on the `UIState` type; (2) populated in `buildUIState`; (3) **passed through `filterUIStateForAudience`**; (4) filter-survival-tested; (5) verified in the Play Diagnostics `uiStateSnapshot`. An **optional** field that reaches (2) but not (3) is silently dropped at the whitelist — the shipped EC-206 failure. Step 4 is MANDATORY.
- **Public, never redacted.** Unlike the per-player / owner-scoped pending fields, the transform deck is face-up shared-board data (like `koPile` / `strikePile`) — the filter passes it through for EVERY audience unchanged.
- **No aliasing.** `buildDisplayEntries` (build) + `deepCopyDisplayEntries` (filter) already do per-entry shallow copies — use them; do not spread the entries array.
- **Display completeness.** Assert the second-form entries resolve to real faces (name present), not `UNKNOWN_DISPLAY_PLACEHOLDER` (`<unknown>`) — the `carddisplaydata_unknown_pattern` guard. If they DON'T resolve, the side-deck cards are missing from `G.cardDisplayData` — STOP and surface it (a setup gap, not a projection bug).
- Client SFC authoring per the EC-132 whitelist (a tested leaf that takes props + renders → `defineComponent`); type-only engine import (D-16502).

## Required `// why:` Comments
- The `transformDeck` build line: projects the face-up Transform side deck (D-24468) as public shared-board display entries.
- The filter pass-through: public / unredacted (face-up) — the opponent + spectator see it too; the `!== undefined` guard mirrors `scheme.display`.
- The `TransformDeck.vue` empty guard: hidden for non-transform games (empty / absent array), so the pile only appears when a Transform hero is in play.

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts` — `transformDeck?: UIDisplayEntry[]`.
- `packages/game-engine/src/ui/uiState.build.ts` — populate it.
- `packages/game-engine/src/ui/uiState.filter.ts` — the public pass-through.
- `packages/game-engine/src/ui/uiState.filter.test.ts` — the survival test (AC-3), all audiences.
- `packages/game-engine/src/ui/uiState.build.test.ts` — the projection tests (AC-1 real faces, AC-2 empty).
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — iff it enumerates the field set (add `transformDeck` in lockstep; check at execution).
- `apps/arena-client/src/components/play/TransformDeck.vue` (**new**) + `TransformDeck.test.ts` — AC-5.
- `apps/arena-client/src/pages/PlayDesktop.vue` + `PlayMobile.vue` — wiring (AC-6).
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24475 Active), `docs/ai/NUMBER-LEDGER.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record the count); `pnpm -r build` 0; the arena-client test exits 0.
- [ ] **Control run:** delete the filter pass-through line; the AC-3 survival test FAILS (proves the pass-through is load-bearing — the EC-206 guard). Restore it. Record the failure.
- [ ] `git grep -n "PRE_WP080_HASH\|finalStateHash" -- '*.test.ts' '*.json'` unchanged — no hash oracle touched.
- [ ] No card-data / derived-artifact touched (this WP changes none) — `git diff --name-only` shows no `data/cards/**` or ledger/effect-index/mechanics artifacts.
- [ ] `git diff --name-only` on STAGED changes = exactly the finalised allowlist.
- [ ] **D-24026 live-on-surface:** a real `play.legendary-arena.com` She-Hulk match renders the Transform Deck pile with the second-forms face-up; recorded or operator-pending. Green tests + merge do NOT satisfy it.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24475 Active; `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells
- The pile never renders in a She-Hulk match → the field was populated in the build but dropped at `filterUIStateForAudience` (the EC-206 whitelist miss), or the client leaf isn't wired into the page.
- The pile renders `<unknown>` faces → the side-deck cards are absent from `G.cardDisplayData` (a setup gap — surface it, don't paper over with a placeholder).
- A hash oracle moved → you touched `G` by accident (this WP must not); investigate, do NOT re-pin.
- The arena-client fixtures fail to compile → the field was made REQUIRED (it must be optional) or a fixture was needlessly backfilled.
- The pile shows for a non-transform (non-`wwhk`) game → the empty-array `v-if` guard is missing.
