# WP-380 — Wound "Healing" Client Affordance (Heal Wounds button + UIState projection)

**Status:** Ready
**Primary Layer:** Cross-cutting — Game Engine (UIState projection) + arena-client (play HUD)
**Dependencies:** WP-379 (the `healWounds` engine move + the `hasActedThisTurn` / `hasHealedThisTurn` G flags), WP-129/EC-132 (the 3-step TurnActionBar + `useTurnActions` gating), WP-100 (the `submitMove` / `UiMoveName` click-to-play surface)
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `4edd95a1` (WP-316 KO-log follow-up).

---

## Session Context

WP-379 shipped the engine `healWounds` move and the two per-turn `LegendaryGameState` flags (`hasActedThisTurn`, `hasHealedThisTurn`) that gate it, but deliberately projected nothing to `UIState` and added no client control — "the deferred follow-up client WP." This packet is that follow-up: it projects the two flags onto `UIState.game` and adds a gated **"Heal Wounds"** button to the play HUD's 3-step turn-action bar, following the exact `useTurnActions` GatingResult + disabled-tooltip precedent established by WP-129/EC-132. It is a **single cross-layer WP** (not a paired split) because the engine half is a trivial 2-boolean projection; the layer boundary is respected by a one-directional dependency (client reads the new projection) and an engine-first commit order.

---

## Goal

After this session, a signed-in player on `play.legendary-arena.com`, on their own turn during the `main` stage with one or more Wounds in hand and having not yet recruited or fought, sees an enabled **"Heal Wounds"** button in the TurnActionBar Step 2 panel. Clicking it dispatches `submitMove('healWounds', {})`; the engine KOs their Wounds and the next server frame reflects the shrunk hand + grown KO pile + the WP-379 log line. When the action is unavailable (not their turn, wrong stage, no Wound in hand, already acted, already healed, or a pending choice is open) the button is disabled with the reason surfaced as a tooltip — matching every other TurnActionBar affordance. To make the button correctly gate-able, `UIState.game` gains two read-only boolean projections, `hasActedThisTurn` and `hasHealedThisTurn`.

---

## User-Visible Impact

A player who has drawn into one or more Wounds can now **click "Heal Wounds"** to KO them from hand on their turn — the physical game's Healing ability, previously unreachable in the UI. The button lives in the Step 2 (Main) turn-action panel next to the play/recruit/fight affordances, and greys out with an explanatory tooltip exactly like Pass Priority / End Turn when it isn't a legal action. No other surface changes.

---

## Assumes

- WP-379 complete. Specifically:
  - `packages/game-engine/src/game.ts` registers `healWounds: { move: healWounds, client: false }` (the move takes no arguments)
  - `LegendaryGameState` (`packages/game-engine/src/types.ts`) declares `hasActedThisTurn?: boolean` and `hasHealedThisTurn?: boolean`
  - `packages/game-engine/src/setup/pilesInit.ts` exports the runtime value `WOUND_EXT_ID` = `'pile-wound'` (re-exported from the engine barrel `packages/game-engine/src/index.ts`)
- WP-129 / EC-132 complete: `apps/arena-client/src/components/play/TurnActionBar.vue` renders the 3-step panel; `apps/arena-client/src/composables/useTurnActions.ts` owns the `GatingResult` predicates (`canRevealVillain`, `canPassPriority`, `canEndTurn`, …) and the disabled-tooltip precedence.
- WP-100 complete: `apps/arena-client/src/components/play/uiMoveName.types.ts` defines the `UiMoveName` union + `SubmitMove` alias; interactive `play/` components declare a `submitMove: SubmitMove` prop.
- `UIState.game` (`packages/game-engine/src/ui/uiState.types.ts`) exposes `activePlayerId` + `currentStage`; `UIPlayerState.handCards?: string[]` carries the viewer's own hand ext_ids (active-player-redacted by `uiState.filter.ts`).
- `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` and `pnpm --filter arena-client test` + `pnpm --filter arena-client typecheck` all pass on `4edd95a1`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the arena-client may import the engine's Runtime-Safe surface + types; the engine must not import the client. This WP's engine half (projection) is consumed by the client via the built engine `dist`, so the engine must be **built before** the client typechecks.
- `packages/game-engine/src/ui/uiState.types.ts` — the `UIState.game` object (`activePlayerId`, `currentStage`); the two new fields sit here as public (non-redacted) booleans, siblings of `currentStage`.
- `packages/game-engine/src/ui/uiState.build.ts` — the `game` object literal (~line 432) where `currentStage: gameState.currentStage` is populated; add the two flags there with `?? false` coercion.
- `packages/game-engine/src/ui/uiState.filter.ts` — confirm the filter passes `game.*` through unchanged (it redacts per-player fields, not `game`); the two new fields are public like `currentStage`, so no redaction. If the filter reconstructs `game` explicitly, add the two fields to that reconstruction.
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — the `satisfies`-based field-name pin; add the two new `game` fields.
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — add `'healWounds'` to `UiMoveName` (the sanctioned drift-guard extension point; the move takes no args → `submitMove('healWounds', {})`).
- `apps/arena-client/src/composables/useTurnActions.ts` — the `GatingResult` predicate pattern; `canHealWounds()` mirrors `canPassPriority()` / `canEndTurn()` in shape and the turn→stage→resource→structural tooltip precedence.
- `apps/arena-client/src/components/play/TurnActionBar.vue` — the Step 2 (`play.main`) panel + the `revealGate()/onReveal()` button idiom (script setup + template `:disabled` + tooltip).
- `apps/arena-client/src/pages/PlayDesktop.vue` and `PlayMobile.vue` — where `isViewerTurn`, the `viewer` (the player whose `handCards` is present), and the `hasPending*` computeds are derived and drilled into `TurnActionBar`.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:` comments), Rule 13 (ESM only).
- `docs/ai/DECISIONS.md` — scan D-24099 / D-24132 / D-24139 (prior `UiMoveName` extensions) and the reserved D-24181 at the tail of this WP.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only (this packet uses none)
- Never throw inside boardgame.io move functions — N/A here (no move logic changes)
- Never persist `G`, `ctx`, or any runtime state; `G` stays JSON-serializable
- The projection is **read-only**: `buildUIState` / `filterUIStateForAudience` never mutate `G` or append to `G.messages`; given identical `(G, ctx, playerID)` the output is byte-identical
- ESM only, Node v22+; `node:` prefix on Node built-ins; test files `.test.ts`
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `UIState.game.hasActedThisTurn` / `hasHealedThisTurn` are **public** (like `currentStage`) — whether the active player has acted/healed is observable, not secret; do **not** add per-player redaction in `uiState.filter.ts`.
- The client must **not** add a new runtime `@legendary-arena/game-engine` import in a component — `bgioClient.ts` is the sole runtime engine-import site. The Wound identity used for the hand scan is a client-local constant guarded by a drift test that imports the engine `WOUND_EXT_ID` (test-only engine import is permitted).
- `canHealWounds()` gates in the locked precedence order: not-your-turn → wrong-stage (`main`) → any block-all pending choice → no Wound in hand → already acted (`hasActedThisTurn`) → already healed (`hasHealedThisTurn`). Each returns a `GatingResult` with a full-sentence `reason`; never a bare boolean.
- The button dispatches `submitMove('healWounds', {})` — empty-object payload (the engine move takes no args); no client-side prediction (the move is `client: false`).
- Do **not** change engine gameplay, the `healWounds` move body, the AI/simulation surface, or emit a `notableEvent` — see Out of Scope.

**Session protocol:**
- If any contract, field name, or component path is unclear, stop and ask — never guess field names, type shapes, or file paths.

**Locked contract values (do not re-derive):**
- **Move name:** `'healWounds'` (added to `UiMoveName`); dispatched as `submitMove('healWounds', {})`
- **Wound ext_id (client-local, drift-tested against the engine value):** `'pile-wound'`
- **TurnStage gate value:** `'main'` (`'start'` | `'main'` | `'cleanup'`)
- **New UIState.game fields:** `hasActedThisTurn: boolean`, `hasHealedThisTurn: boolean`
- **GatingResult shape:** `{ allowed: boolean; reason: string | null }`

---

## Debuggability & Diagnostics

- The projection is deterministic and observable: `UIState.game.hasActedThisTurn` / `hasHealedThisTurn` mirror `G` exactly (with `?? false`), verifiable by a `buildUIState` unit test.
- The button's enabled/disabled state is a pure function of the projected snapshot + the client-derived `hasWoundInHand` + `isViewerTurn` — reproducible in a `@vue/test-utils` mount test with a fixed snapshot.
- No new state mutation is introduced (projection is read-only; the client only dispatches an existing move).

---

## Scope (In)

### A) Engine — project the two turn-action flags

- **`packages/game-engine/src/ui/uiState.types.ts`** — modified: add `hasActedThisTurn: boolean` and `hasHealedThisTurn: boolean` to the `UIState.game` object type (siblings of `currentStage`). JSDoc: public, mirrors the `G` per-turn flags, drives the client Heal-Wounds affordance gating.
- **`packages/game-engine/src/ui/uiState.build.ts`** — modified: in the `game` object literal (~line 432), add `hasActedThisTurn: gameState.hasActedThisTurn ?? false` and `hasHealedThisTurn: gameState.hasHealedThisTurn ?? false`. Add a `// why:` (coerce the optional G flags to a definite boolean projection).
- **`packages/game-engine/src/ui/uiState.filter.ts`** — modified **only if** the filter reconstructs the `game` object; otherwise unchanged (the fields are public like `currentStage`). If touched, carry both fields through verbatim (no redaction).
- **`packages/game-engine/src/ui/uiState.types.drift.test.ts`** — modified: pin the two new `game` field names (extend the existing `satisfies` pin). `// why:` on the pin: a new projected field added to the type but not the builder (or vice versa) is drift.

### B) Client — `UiMoveName` extension

- **`apps/arena-client/src/components/play/uiMoveName.types.ts`** — modified: add `| 'healWounds'` to `UiMoveName` with a `// why:` citing WP-380 / D-24181 (surfaces the WP-379 Healing move).

### C) Client — `canHealWounds` gating predicate

- **`apps/arena-client/src/composables/useTurnActions.ts`** — modified: extend the `useTurnActions(...)` signature with three new trailing params (defaulting to `false` for back-compat): `hasWoundInHand: boolean`, `hasActedThisTurn: boolean`, `hasHealedThisTurn: boolean`. Add a `canHealWounds(): GatingResult` predicate returning, in precedence order: `NOT_YOUR_TURN` if `!isViewerTurn`; a stage-gate reason if `currentStage !== 'main'`; a "resolve the pending choice first" reason if any block-all pending flag is set; a "no Wounds in hand to heal" reason if `!hasWoundInHand`; a "you have already recruited or fought this turn" reason if `hasActedThisTurn`; a "you have already healed this turn" reason if `hasHealedThisTurn`; else `ALLOWED`. Each reason is a full sentence.

### D) Client — the button

- **`apps/arena-client/src/components/play/TurnActionBar.vue`** — modified: add three props (`hasWoundInHand: boolean`, `hasActedThisTurn: boolean`, `hasHealedThisTurn: boolean`); a `healGate()` function (mirrors `passPriorityGate()`, threading the three new props into `useTurnActions(...).canHealWounds()`); an `onHealWounds()` handler (`props.submitMove('healWounds', {})`, `// why:` empty payload — the move takes no args); and a **"Heal Wounds"** button in the Step 2 panel with `:disabled="!healGate().allowed"`, the `reason` bound as the disabled tooltip, and a `data-testid` (e.g. `heal-wounds-button`) mirroring the other action buttons.

### E) Client — wire the derived state through the pages

- **`apps/arena-client/src/pages/PlayDesktop.vue`** and **`apps/arena-client/src/pages/PlayMobile.vue`** — modified: derive `hasWoundInHand` (scan the `viewer.handCards` array for the client-local Wound ext_id constant), read `hasActedThisTurn` / `hasHealedThisTurn` from `snapshot.game`, and drill all three into `<TurnActionBar>`. Use a single shared client helper for the hand scan (see F) so the Wound literal appears in exactly one place.

### F) Client — Wound identity helper + drift test

- Add a tiny client helper (e.g. **`apps/arena-client/src/components/play/woundIdentity.ts`**, new): export `WOUND_EXT_ID = 'pile-wound'` and `handHasWound(handCards: readonly string[] | undefined): boolean`. Both pages import it (the literal lives here only).
- **Drift test** (new `woundIdentity.test.ts` or folded into an existing client mirror test): `import { WOUND_EXT_ID as ENGINE_WOUND } from '@legendary-arena/game-engine'` (test-only) and assert the client constant `=== ENGINE_WOUND`, so the literal can never drift from the engine. `// why:` the client identifies a Wound by a mirrored literal because components may not import engine runtime code; the drift test is the guard.

### G) Tests

- **`apps/arena-client/src/composables/useTurnActions.test.ts`** — modified: `canHealWounds()` cases — allowed (viewer turn, main, wound in hand, not acted, not healed, no pending); and one disabled case per precedence rung (not turn / not main / pending / no wound / acted / healed), each asserting the exact `reason`.
- **`apps/arena-client/src/components/play/TurnActionBar.test.ts`** — modified: the button renders in Step 2, is enabled/disabled per `healGate()`, and clicking an enabled button calls `submitMove` with `('healWounds', {})`.
- Engine: a `buildUIState` assertion (in the existing `uiState.build.test.ts`) that `game.hasActedThisTurn` / `hasHealedThisTurn` mirror `G` (true/false/undefined→false).

---

## Out of Scope

- **No engine gameplay change.** The `healWounds` move body, the `hasActedThisTurn` / `hasHealedThisTurn` flags, and the fight/recruit reverse lock are WP-379's locked contract — untouched.
- **No AI / simulation integration.** `healWounds` stays out of `ai.legalMoves.ts` / `SIMULATION_MOVE_NAMES`; PAR/sweep baselines unchanged.
- **No `notableEvent` / center-screen overlay** for healing. The player observes the result via the hand shrink + KO pile + the WP-379 `G.messages` log line (already projected to the HUD log); a heal overlay is a separate cosmetic polish WP.
- **No "Wounds can't be played" `playCard` fix** and **no Enraging-Wound variants** — distinct future WPs (per WP-379 Out of Scope).
- **No new `canX` boolean in UIState** — the engine projects raw flags; the capability is derived client-side in `useTurnActions`, matching the codebase convention.
- No changes to other `play/` components, other moves, or the lobby surface.
- Refactors / cleanups not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — two `UIState.game` boolean fields
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate the two fields (`?? false`)
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified (conditional)** — only if `game` is reconstructed; carry the fields through
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — pin the two new field names
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — projection mirror assertion
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — add `'healWounds'`
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified** — `canHealWounds()` + 3 params
- `apps/arena-client/src/composables/useTurnActions.test.ts` — **modified** — `canHealWounds` cases
- `apps/arena-client/src/components/play/TurnActionBar.vue` — **modified** — props + button + handler
- `apps/arena-client/src/components/play/TurnActionBar.test.ts` — **modified** — button render/disabled/click
- `apps/arena-client/src/components/play/woundIdentity.ts` — **new** — client Wound constant + `handHasWound`
- `apps/arena-client/src/components/play/woundIdentity.test.ts` — **new** — drift test vs engine `WOUND_EXT_ID`
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — derive + drill the three values
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — derive + drill the three values

No other files may be modified.

---

## Vision Alignment

N/A — this WP touches none of the §17.1 trigger surfaces: no scoring / PAR / leaderboards, no replay / determinism / RNG (the UIState projection is a read-only view, not part of the competitive `G` hash; adding `UIState.game` fields does not change `computeStateHash`), no identity / accounts, no multiplayer sync / reconnection, no card data / content semantics, no monetization, no live-ops gate. The one arguable touch — a new interactive control — reuses the existing accessible TurnActionBar button + disabled-tooltip pattern (WP-129/EC-132), introducing no new accessibility surface. NG-1..7 are trivially preserved (a co-op/solo Healing action; no pay-to-win, no PvP interaction).

## Funding Surface Gate

N/A — no global-nav / registry-viewer / profile funding affordance, no tournament funding channel, and no user-visible "donate/support" copy. This is a gameplay-action button.

## API Catalog

N/A — no HTTP endpoint added, modified, or removed, and no `apps/server/src/**` `Library-only` function touched. Moves dispatch over the boardgame.io transport, not the HTTP API surface.

---

## Acceptance Criteria

All items are binary pass/fail.

### Engine projection
- [ ] `UIState.game` declares `hasActedThisTurn: boolean` and `hasHealedThisTurn: boolean`; `buildUIState` populates both from `G` with `undefined → false`.
- [ ] The drift test pins both new `game` field names and fails if the type and builder diverge.
- [ ] `filterUIStateForAudience` leaves both fields intact for every audience (they are public, like `currentStage`).
- [ ] The projection change alters no competitive hash: `pnpm --filter @legendary-arena/game-engine test` passes with **no** sentinel / `PRE_WP080_HASH` re-pin (UIState is not part of `computeStateHash`).

### Client gating + button
- [ ] `UiMoveName` includes `'healWounds'`; the surface typechecks (`vue-tsc`).
- [ ] `useTurnActions(...).canHealWounds()` returns `allowed: true` only when it is the viewer's turn, `currentStage === 'main'`, a Wound is in hand, no block-all choice is pending, and neither `hasActedThisTurn` nor `hasHealedThisTurn`; otherwise `allowed: false` with the precedence-correct full-sentence `reason`.
- [ ] `TurnActionBar` renders a **Heal Wounds** button in Step 2 (`data-testid` present), disabled per `healGate()`, tooltip bound to the reason.
- [ ] Clicking an enabled Heal Wounds button calls `submitMove('healWounds', {})` exactly once (empty-object payload).
- [ ] `woundIdentity.ts` exports the client Wound constant + `handHasWound`; the drift test asserts it equals the engine `WOUND_EXT_ID`.

### Build / test / typecheck
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0.
- [ ] `pnpm --filter arena-client test` and `pnpm --filter @legendary-arena/game-engine test` pass.

### Scope
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build everything (engine dist must exist before the client typechecks)
pnpm -r build
# Expected: exits 0

# Step 2 — engine tests (projection + drift + NO hash re-pin)
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; sentinel + PRE_WP080_HASH unchanged

# Step 3 — client typecheck (vue-tsc — build/test do NOT type-check the SFCs)
pnpm --filter arena-client typecheck
# Expected: exits 0

# Step 4 — client tests
pnpm --filter arena-client test
# Expected: all pass (incl. canHealWounds cases, the button, the wound drift test)

# Step 5 — confirm the client component adds no runtime engine import
Select-String -Path "apps\arena-client\src\components\play\TurnActionBar.vue","apps\arena-client\src\components\play\woundIdentity.ts","apps\arena-client\src\pages\PlayDesktop.vue","apps\arena-client\src\pages\PlayMobile.vue" -Pattern "from '@legendary-arena/game-engine'"
# Expected: no output (only the *.test.ts drift test may import it)

# Step 6 — scope check
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):** in a **real deployed match**, on the viewer's `main` stage with a Wound in hand, the **Heal Wounds** button is enabled, clicking it KOs the Wound(s) (hand shrinks, KO pile grows, the WP-379 log line appears), and after healing the button + fight/recruit affordances disable with correct tooltips — captured as a screenshot / observed behavior on the deployed bundle (green tests + merge alone do NOT satisfy this).
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0.
- [ ] `pnpm --filter arena-client test` + `pnpm --filter @legendary-arena/game-engine test` pass.
- [ ] No runtime `@legendary-arena/game-engine` import added to a component (confirmed with `Select-String`).
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — the Healing ability is now player-clickable on the play surface.
- [ ] `docs/ai/DECISIONS.md` updated — land D-24181 (Heal-Wounds affordance + the two-flag UIState projection) as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-380 checked off with today's date.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All 10 required sections present; `Out of Scope` lists ≥2 excluded items (AI/sim, heal overlay, playCard wound-block, Enraging Wounds).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session protocol + locked values; references 00.6.
- **§3 Assumes** — PASS. WP-379/129/100 named with exact exports/paths + green baseline.
- **§4 Context (Read First)** — PASS. Specific files + `ARCHITECTURE §Layer Boundary` + `00.6`. No `00.2` reference: this WP changes no card-data shape or setup field (the Wound identity is the engine `WOUND_EXT_ID` constant, mirrored + drift-tested, not a `00.2` data change).
- **§5 Files** — PASS **with a noted RISK**: 14 files (5 engine + 9 client). Above the ~8 guideline because the change spans a cross-layer feature (engine projection + client button + prop-drill through two page shells + co-located tests). Operator chose a single cross-layer WP over a paired split; the engine and client halves are committed separately (engine-first). Documented here so pre-flight/copilot weigh it explicitly, not silently.
- **§6 Naming** — PASS. `WOUND_EXT_ID`, `hasActedThisTurn`/`hasHealedThisTurn`, camelCase move name; no abbreviations.
- **§7 Dependency discipline** — PASS. No new npm dependency.
- **§8 Architectural boundaries** — PASS. Engine projection is read-only; the client consumes the engine via built dist; no engine→client import; no runtime `@legendary-arena/game-engine` import in any component (drift test only).
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. No environment variable introduced.
- **§11 Auth** — N/A. No authentication logic; the move dispatches over the already-authenticated boardgame.io transport.
- **§12 Tests** — PASS. arena-client `node:test` + `@vue/test-utils` + `jsdom`; engine `node:test`; no `boardgame.io/testing`, no Vitest.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output; the client `typecheck` (vue-tsc) gate is explicit.
- **§14 Acceptance criteria** — PASS. Binary, grouped, ~13 observable items.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX + scope check; `User-Visible Surface = play.legendary-arena.com`; §15.1 live-on-surface (D-24026) present.
- **§16 Code style** — PASS. Explicit control flow, no abbreviations, JSDoc, `// why:` on non-obvious sites, named imports, full-sentence gating reasons.
- **§17 Vision Alignment** — N/A (declared with justification): no §17.1 trigger — no scoring/PAR/leaderboard, replay/determinism/RNG (UIState is not in `computeStateHash`), identity, multiplayer-sync, card-data, monetization, live-ops; the new control reuses the existing accessible TurnActionBar button pattern; NG-1..7 preserved.
- **§18 Prose-vs-grep** — PASS. Verification Step 5 greps the component/page files (not the WP) for `from '@legendary-arena/game-engine'`; the grep path list deliberately **excludes** `woundIdentity.test.ts` (the test may import the engine constant), so the drift test does not trip it.
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding affordance/channel/copy — a gameplay-action button.
- **§21 API Catalog** — N/A. No HTTP endpoint and no `apps/server/src/**` `Library-only` function; moves dispatch over the boardgame.io transport, not the HTTP surface.

**Lint verdict: PASS (all 21 resolved; §5 file-count RISK noted and accepted; 6 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-07-15).**

- **Sequencing / dependencies:** WP-379 ✅ (move + G flags), WP-129/EC-132 ✅ (TurnActionBar + `useTurnActions`), WP-100 ✅ (`UiMoveName`/`submitMove`) — all landed on `main`; verified by direct source read of the projection sites, `useTurnActions`, and `TurnActionBar`.
- **Green baseline:** `main @ 4edd95a1` (measured this session): `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` (vue-tsc) exits 0; `arena-client` suite **923 pass / 0 fail**; the engine suite is unchanged from WP-379's close (1948 / 0).
- **Scope lock:** the `Files Expected to Change` allowlist is closed (14 files, two conditional); `git diff --name-only` is a DoD gate. The 14-file span is the one pre-flight concern — mitigated by the engine-first commit split and the closed allowlist.
- **Contract fidelity:** the two projected fields sit on `UIState.game` beside `currentStage` (public, non-redacted); the client button reuses the `GatingResult` + disabled-tooltip contract verbatim; `submitMove('healWounds', {})` matches the empty-payload `endTurn`/`advanceStage` idiom.
- **RS-1 (clarification, non-blocking):** whether `uiState.filter.ts` needs a change is resolved at execution by inspecting whether the filter reconstructs the `game` object (it redacts per-player fields, so likely passes `game` through unchanged).
- **RS-2 (clarification, non-blocking):** the exact home of the client Wound constant + hand-scan helper (`woundIdentity.ts` suggested) is confirmed at execution; the literal must live in exactly one client file, drift-tested against the engine.
- **PS items (blocking):** none.

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (2026-07-15).** The pre-flight READY verdict stands. The one RISK is scope size (#12 — 14 files); it does not threaten architecture or determinism and is mitigated by the closed allowlist + engine-first commit split. All other issues scan PASS.

Selected findings:
- **#1 / #9 / #16 / #29 (layer boundary)** — PASS. Engine projection is read-only and one-directional; the client consumes it via built dist; no runtime engine import in components (Verification Step 5 grep-gated); no orchestration leaks into the engine.
- **#2 (determinism)** — PASS. UIState is not part of `computeStateHash`; the AC explicitly requires **no** sentinel / `PRE_WP080_HASH` re-pin, and the EC flags any hash shift as a STOP (it would mean `G` was mutated).
- **#4 / #27 (contract drift / naming)** — PASS. New `UIState.game` fields pinned in the drift test; `UiMoveName` extended at its sanctioned point; the client Wound literal drift-tested against the engine `WOUND_EXT_ID`.
- **#12 (scope creep)** — RISK (noted). 14 files is large; accepted as a deliberately cohesive cross-layer WP with a closed allowlist + `git diff --name-only` gate + engine-first commit split. Not a BLOCK.
- **#22 (silent vs loud)** — PASS. `canHealWounds` surfaces a full-sentence reason on every disabled rung (no silent server-side no-op), matching the tooltip-precedence convention.

**Disposition: CONFIRM** — session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24181 (reserved; Drafted 2026-07-15, not yet landed)** — The Wound "Healing" ability is surfaced to players by (a) projecting the two WP-379 per-turn flags `hasActedThisTurn` and `hasHealedThisTurn` onto `UIState.game` as **public** read-only booleans (siblings of `currentStage`; not per-player-redacted because acted/healed status is observable, not secret), and (b) a **Heal Wounds** button in the TurnActionBar Step 2 panel gated by a client-derived `useTurnActions().canHealWounds()` predicate (turn → `main` stage → no pending choice → Wound in hand → not acted → not healed), dispatching `submitMove('healWounds', {})`. The capability flag stays client-derived (no new `canX` in UIState, per convention); the Wound identity used for the hand scan is a client-local `'pile-wound'` constant guarded by a drift test against the engine `WOUND_EXT_ID` (components may not import engine runtime code). Single cross-layer WP (engine-first commit) because the engine half is a trivial 2-boolean projection.

---

## See Also

- [WP-379](WP-379-wound-healing-ability.md) — the engine `healWounds` move + the two G flags this WP surfaces
- [WP-129](WP-129-turn-action-bar-stage-gating.md) / EC-132 — the 3-step TurnActionBar + `useTurnActions` gating precedent
- [WP-249](WP-249-optional-ko-reward-ux.md) / [WP-287](WP-287-draw-or-empowered-ux.md) — prior client-UX follow-ups to engine moves
- `docs/legendary-universal-rules-v23.md §Healing Wounds` — the printed rule
