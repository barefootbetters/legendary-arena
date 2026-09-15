# WP-699 — Hand Presentation: hover-lift + shallow hand arc

**Status:** Ready
**Primary Layer:** Arena Client (App / presentation)
**Dependencies:** WP-556 (effectIntensity accessibility seam), WP-685 / WP-688 (play-surface spatial rebuild + fit-to-floor)
**User-Visible Surface:** play.legendary-arena.com

---

## Session Context

WP-556 shipped the client feel-layer foundation — the persisted **Effect-Intensity** control and `effectIntensity.ts`'s `shouldRender('shake' | 'particles' | 'word')` / `prefersReducedMotion` seam that every animation on the play surface now honours; WP-685 / WP-688 rebuilt `<PlayDesktop>` into a fixed 1280×720 fit-to-floor board (D-24505). This packet adds two purely-visual hand-feel affordances on top of both, changing no engine or projection surface.

---

## Goal

After this packet, the local player's hand on `play.legendary-arena.com` reads as a Hearthstone-style hand rather than a flat strip: each hand card **lifts on hover** (a small scale + upward translate + drop-shadow + `z-index` raise so it sits above its neighbours), and the hand **lays out along a shallow arc** (each card rotated to its tangent, the hovered card straightening and nudging its neighbours outward) instead of today's flat horizontal scroll well. Both effects are hand-rolled CSS / WAAPI on `transform` + `opacity` only, gated by the shipped `effectIntensity` control and `prefers-reduced-motion`, and reading only already-projected `UIState`. No new dependency, no engine change.

---

## User-Visible Impact

A player at `play.legendary-arena.com` sees their hand of cards fanned along a gentle arc; moving the pointer over a card raises it above its neighbours with a soft shadow, and the neighbours ease aside. On a touch device, or with the Effect-Intensity control at `off`, or with OS "reduce motion" on, the hand renders in its resting arc with no hover animation and full play functionality. Nothing about which cards are playable, or any game outcome, changes.

---

## Assumes

- WP-556 complete. Specifically:
  - `apps/arena-client/src/vfx/effectIntensity.ts` exports `useEffectIntensity()` returning `{ intensity, prefersReducedMotion, shouldRender }` and `shouldRender('shake' | 'particles' | 'word'): boolean` (WP-556 / D-24365).
- WP-685 / WP-688 complete: `<PlayDesktop>` fits the 1280×720 authoring floor with no page scroll (D-24505); the hand renders inside the fitted, scaled stage.
- `apps/arena-client/src/components/play/HandRow.vue` exists and renders the local hand as a `<ul class="hand-cards">` of `<CardTile>` tiles; it is the shared hand component for both `<PlayDesktop>` and `<PlayMobile>`.
- `apps/arena-client/src/components/play/CardTile.vue` exists and today carries the only hand-card hover motion: `.card-tile--interactive:hover { transform: scale(1.05); }` with `transition: transform 0.15s ease`.
- `pnpm --filter @legendary-arena/arena-client build` exits 0
- `pnpm --filter @legendary-arena/arena-client test` exits 0
- `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- `docs/ai/DECISIONS.md` and `docs/ai/ARCHITECTURE.md` exist

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the App layer consumes read-only `UIState` projections and contains no game logic; this packet must stay inside that boundary (no engine/registry import, no game-rule computation).
- `.claude/rules/architecture.md §Layer Boundary` — the arena-client import rules (UI framework only; never `game-engine` runtime, `registry`, `pg`).
- `wiki/visual-effects.md §Card-interaction & hand feel` — the design reference for this packet (the proposal it implements) and the three hard boundaries every effect honours (pure presentation, absent from the determinism hash, the accessibility gate).
- `wiki/visual-effects.md §Library posture` — D-24365 locks hand-rolled CSS / WAAPI for card motion; no new animation dependency (no `motion` / GSAP / tsparticles).
- `apps/arena-client/src/vfx/effectIntensity.ts` — read it entirely: `useEffectIntensity()`, `shouldRender`, `prefersReducedMotion`. The hover lift routes through this seam.
- `apps/arena-client/src/components/play/HandRow.vue` — read it entirely before modifying: the hand `<ul>`/`<li>`/`<CardTile>` structure, the existing stage/Wound gating, and the flat scroll-well CSS the arc replaces.
- `apps/arena-client/src/components/play/CardTile.vue` — read it entirely: the existing `.card-tile--interactive:hover` scale and the absence of any `z-index` rule.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations), Rule 6 (`// why:` comments), Rule 9 (`node:` prefix), Rule 13 (ESM only), Rule 14 (field names match the data contract).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+ — all new code uses `import` / `export`, never `require()`
- `node:` prefix on all Node.js built-in imports in tests (`node:test`, `node:assert`)
- Test files use `.test.ts` — never `.test.mjs`
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific (App-layer presentation):**
- **Pure presentation.** This packet reads only already-projected `UIState` (the hand arrays and per-card display already passed into `HandRow`); it never reads `G` / `ctx`, never imports `@legendary-arena/game-engine` runtime, `@legendary-arena/registry`, or `pg`, and never computes a game rule.
- **Absent from the determinism hash.** The effects are visual only; they never touch move dispatch, validation, or any state the engine hashes. Bot-vs-bot sims and replays are unaffected.
- **No new dependency (D-24365).** Hover lift and arc are hand-rolled CSS / WAAPI animating `transform` + `opacity` only — never layout properties (no animating `width`/`height`/`top`/`left`). Do not add `motion`, GSAP, `tsparticles`, or any animation package.
- **Accessibility gate (WP-556 / D-24365).** The hover lift is gated behind `@media (hover: hover)` (pointer devices only) AND the `effectIntensity` seam: it does not animate when `shouldRender('particles')` is false or `prefersReducedMotion` is true — the hand still renders in its resting arc and every card stays playable. The resting arc layout itself is static and always renders (it carries no motion).
- **Preserve the WP-688 fit (D-24505).** The arc must not reintroduce a page scroll or overflow the fitted 1280×720 stage on `<PlayDesktop>`, and must not regress `<PlayMobile>`; the hand stays inside its existing well bounds.
- **Playability is unchanged.** This packet does not alter which cards are playable, the stage gate, or the Wound gate in `HandRow.vue` — it only restyles/lays-out the same tiles. (No affordability grey-out: playing a card from hand is resource-free in this game, so there is nothing to grey out — see Out of Scope.)

**Session protocol:**
- If any field name, component contract, or projected `UIState` shape is unclear, stop and ask before proceeding — never guess or invent field names or paths.

**Locked contract values:**
- Effect-Intensity gate API (verbatim, WP-556): `useEffectIntensity()` → `{ intensity, prefersReducedMotion, shouldRender }`; `shouldRender(kind: 'shake' | 'particles' | 'word'): boolean`.

---

## Debuggability & Diagnostics

- The effects are deterministic functions of pointer state + the projected hand contents + the Effect-Intensity setting; identical inputs produce identical visuals.
- Arc geometry (per-card rotation + offset) is a pure function of card index and hand size — unit-testable without a running game.
- No state mutation is introduced; the packet adds no field to any store, `G`, or `ctx`.
- The hand's resting layout and the disabled/Wound states remain inspectable in the DOM exactly as today.

---

## Scope (In)

### A) Hover lift on hand cards — `CardTile.vue` (+ `HandRow.vue` wiring)
- Extend the existing `.card-tile--interactive` hover so that, on pointer enter, a hand tile animates to a small scale-up **and** an upward translate **and** a drop-shadow, and raises its `z-index` so it sits above its neighbours; on pointer leave it reverses, restoring `z-index` after the leave transition settles.
- Suggested resting→hover: `scale ~1.06`, `translateY ~-12px`, ~150ms ease-out; `transform` + `box-shadow` + `opacity` only.
- Gate behind `@media (hover: hover)` (pointer devices only) and the `effectIntensity` seam: when `shouldRender('particles')` is false or `prefersReducedMotion` is true, the lift does not animate (the resting tile still renders and stays interactive). A `@media` query cannot read the JS `effectIntensity` singleton, so **`CardTile.vue` consumes `useEffectIntensity()`** and, only when its hand-scope prop is set, binds a **`card-tile--lift-enabled`** class computed as `shouldRender('particles') && !prefersReducedMotion`; the `:hover` lift CSS keys off that class (the class gates the JS side, `@media (hover: hover)` gates the pointer side — both must hold).
- Add a `// why:` comment on the `z-index`-raise-then-restore ordering (raise on enter, restore only after the leave animation completes, so a leaving card never clips its neighbour).
- Apply the lift **only to hand tiles** (not city/HQ/in-play tiles) — scope via a `HandRow`-set prop/class on `CardTile`, so other `CardTile` consumers are unchanged.

### B) Shallow hand arc layout — `HandRow.vue`
- Replace the flat horizontal scroll well with a shallow-arc layout: each `<li>` tile gets a rotation and vertical offset computed from its index and the hand size, with `transform-origin` below the card so rotation pivots naturally.
- Compress per-card spacing as the hand grows so the arc never overflows its well / the fitted stage.
- On hover, the lifted card straightens toward `0°` rotation and its immediate neighbours ease slightly outward.
- The arc geometry is a small **pure helper** — `computeHandArc(handSize, index): { rotationDegrees, offsetPx }` (or equivalent) in its own module — so it is unit-testable without mounting the component. (Create the helper only if the geometry is used in more than one place or is non-trivial; otherwise inline it with a `// why:` note. Follow 00.6 §16.1 — no premature abstraction.)
- Preserve the existing hand semantics: the full hand renders (never truncated), click-to-play still lands, and the stage/Wound gates are untouched.

### C) Tests — `HandRow.test.ts` (+ arc-helper test if a helper is created)
- Assert the arc geometry: symmetric hand produces symmetric rotations around a center of `0°`; a larger hand compresses spacing (a monotonicity or bound assertion), not a snapshot.
- Assert the hover lift is suppressed when the Effect-Intensity gate is off / reduced-motion (the tile renders without the `card-tile--lift-enabled` class) and present when full. Flip the intensity-off branch with `setIntensity('off')` + `__resetEffectIntensityForTests()`; exercise the reduced-motion branch with a `matchMedia` stub per the existing `apps/arena-client/src/vfx/effectIntensity.test.ts` pattern (`prefersReducedMotion` has no direct setter — it reads `matchMedia`).
- Assert the hand still renders every card and the existing Wound/stage disabled state is unchanged.
- `node:test` + `node:assert/strict` + `@vue/test-utils` `mount`, importing `../../testing/jsdom-setup`. No `boardgame.io` import.

---

## Out of Scope

- **No grey-out / affordability dimming of hand cards.** Playing a card from hand is resource-free in this game (cost gating applies only to recruit/fight), so there is nothing to grey out on affordability — the Hearthstone premise does not apply here. The existing stage/Wound disabled states are untouched.
- **No card-draw motion, no opponent-reveal animation, no turn-start banner** — each is a separate follow-on WP.
- **No engine, registry, server, or `UIState` projection change** — this is App-layer only.
- **No change to `CardTile` behaviour for non-hand consumers** (city / HQ / in-play tiles keep their current hover).
- **No new animation dependency** — hand-rolled CSS / WAAPI only (D-24365).
- Refactors, cleanups, or "while I'm here" improvements are out of scope unless listed in Scope (In).

---

## Files Expected to Change

- `apps/arena-client/src/components/play/CardTile.vue` — **modified** — hand-scoped hover lift (scale + translateY + shadow + z-index), gated by `@media (hover: hover)` + the `effectIntensity` seam
- `apps/arena-client/src/components/play/HandRow.vue` — **modified** — shallow-arc hand layout replacing the flat scroll well; hover straighten + neighbour nudge; passes the hand-scope flag to `CardTile`
- `apps/arena-client/src/components/play/handArc.ts` — **new** — pure arc-geometry helper `computeHandArc(handSize, index)` (created only if the geometry is non-trivial / reused; otherwise omitted and inlined per Scope B)
- `apps/arena-client/src/components/play/handArc.test.ts` — **new** — `node:test` coverage of the arc geometry (omit if the helper is inlined)
- `apps/arena-client/src/components/play/HandRow.test.ts` — **modified** — arc + gated-hover + unchanged-playability assertions

No other files may be modified.

---

## Vision Alignment

- **Vision clauses touched:** §17 (accessibility). No conflict: the packet preserves §17 — every animation is gated behind `prefers-reduced-motion` and the persisted Effect-Intensity control, and degrades to a static resting hand with full play functionality.
- **Non-Goal proximity check:** none of NG-1..7 are crossed. The effects are cosmetic, identical for every player, gate nothing behind payment, and confer no game advantage (no pay-to-win, NG-1).
- **Determinism preservation:** the effects are pure presentation, absent from the determinism hash; they never touch move dispatch, validation, RNG, or any hashed state — replays and bot-vs-bot sims are unaffected (Vision §22).

---

## Acceptance Criteria

### A) Hover lift
- [ ] On a pointer device (`@media (hover: hover)`), hovering a hand `CardTile` animates scale + upward translate + drop-shadow and raises its `z-index` above neighbouring tiles; leaving reverses and restores `z-index` after the leave transition.
- [ ] The lift is suppressed (no animation, resting tile still interactive) when `shouldRender('particles')` is false OR `prefersReducedMotion` is true.
- [ ] The lift applies only to hand tiles; city / HQ / in-play `CardTile` consumers are visually unchanged (confirmed by the scoping prop/class).
- [ ] `CardTile.vue` animates `transform` / `box-shadow` / `opacity` only — no animated layout property (confirmed by reading the changed CSS).

### B) Hand arc
- [ ] `HandRow.vue` lays the hand along a shallow arc (per-card rotation + vertical offset), replacing the flat scroll well; `transform-origin` is below the card.
- [ ] Spacing compresses as the hand grows so the arc does not overflow the fitted stage; no page scroll is introduced on `<PlayDesktop>` at 1280×720 (WP-688 fit preserved).
- [ ] Hovering straightens the lifted card toward `0°` and eases its neighbours outward.
- [ ] The full hand renders (no truncation) and click-to-play still lands.

### Tests
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (all test files)
- [ ] Arc geometry test: a symmetric hand yields rotations symmetric about `0°`; a larger hand compresses spacing (bound/monotonicity assertion, not a snapshot)
- [ ] Gated-hover test: lift class/animation absent when the Effect-Intensity gate is off / reduced-motion, present at full
- [ ] Unchanged-playability test: every hand card renders and the Wound/stage disabled state is unchanged
- [ ] Test files do not import from `boardgame.io`
- [ ] Tests use `node:test` + `node:assert` + `@vue/test-utils`

### Scope Enforcement
- [ ] No **new runtime** `@legendary-arena/game-engine` / `@legendary-arena/registry` / `pg` import added to any changed file — a type-only `import type` from the game-engine `.` subpath is permitted (WP-090); the check targets added non-`import type` lines (confirmed with the diff-scoped `Select-String` in Verification Step 4)
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0, no errors

# Step 2 — run all arena-client tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all tests passing, 0 failing

# Step 3 — typecheck (vue-tsc; vite build + tsx do NOT typecheck)
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0, no vue-tsc errors

# Step 4 — confirm no NEW runtime (value) import of engine/registry/pg was added.
# why: HandRow.vue and CardTile.vue already carry a permitted type-only
#   `import type { UICardDisplay } from '@legendary-arena/game-engine'` (WP-090 allows
#   type-only imports from the game-engine `.` subpath); that line must remain. The
#   check therefore scopes to ADDED lines that import these packages WITHOUT `import type`.
git diff -- apps/arena-client/src/components/play/HandRow.vue apps/arena-client/src/components/play/CardTile.vue | Select-String -Pattern "^\+.*from '(@legendary-arena/(game-engine|registry)|pg)'" | Select-String -NotMatch "import type"
# Expected: no output (no added runtime import; added/kept type-only imports are permitted)

# Step 5 — confirm no new animation dependency was added
git diff -- apps/arena-client/package.json
# Expected: no output (package.json unchanged)

# Step 6 — confirm no files outside scope changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change

# Step 7 — play-surface visual guard (host-delegated; the exec env cannot run chromium)
pnpm --filter @legendary-arena/arena-client test:visual
# Expected (on a chromium-capable host): fit invariants hold at 1280/1366/1920 — no page scroll, board fits
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (D-24026):** the hover lift and hand arc are confirmed **live on `play.legendary-arena.com`** in a real match on the deployed build — a screenshot of the fanned hand + an observed hover lift, plus confirmation the resting arc renders with the Effect-Intensity control at `off` / reduced-motion. Green tests + a merged PR do NOT satisfy this item.
- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] No **new runtime** import of `game-engine` / `registry` / `pg` in any changed file — the pre-existing type-only `import type { UICardDisplay } from '@legendary-arena/game-engine'` is permitted (WP-090) and remains (confirmed with the diff-scoped `Select-String` in Verification Step 4)
- [ ] `apps/arena-client/package.json` unchanged — no new dependency (confirmed with `git diff`)
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what the hand feels like now that it could not before
- [ ] `docs/ai/DECISIONS.md` — no new decision required; note that the packet applies D-24365 (hand-rolled CSS/WAAPI, no new dependency) and the WP-556 accessibility gate
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-699 checked off with today's date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph moved `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

---

## Lint Gate Self-Review

Run against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`. All 21 sections resolved:

- **§1 Structure** — PASS. All required sections present; `## Out of Scope` lists ≥2 explicit exclusions.
- **§2 Non-Negotiable Constraints** — PASS. Engine-wide block (full file contents, forbids diffs/snippets, ESM/Node v22, references `00.6-code-style.md`) + packet-specific + session protocol + locked values.
- **§3 Assumes** — PASS. WP-556 / WP-685 / WP-688 deps with exact exports, files, and build/test/typecheck state.
- **§4 Context** — PASS. Specific docs: ARCHITECTURE §Layer Boundary, `.claude/rules/architecture.md`, the visual-effects wiki, `effectIntensity.ts`, `HandRow.vue`, `CardTile.vue`, `00.6`. Touches no card-data/schema shape → `00.2` not required.
- **§5 Files Expected to Change** — PASS. 5 entries (one conditional), each new/modified with a description; bounded (< 8); no ambiguous output language.
- **§6 Naming** — PASS. Uses canonical `UIState` / `handDisplay`; no setup-field or contract name invented.
- **§7 Dependency Discipline** — PASS. No new npm dependency; `motion` / GSAP / `tsparticles` explicitly forbidden (D-24365).
- **§8 Architectural Boundaries** — PASS. App-layer only; no new runtime engine/registry/`pg` import; no `boardgame.io/react`; components carry no game logic.
- **§9 Windows** — PASS. Verification Steps use `pwsh` + `Select-String` + `\` paths.
- **§10 Env Vars** — N/A. No environment variables introduced.
- **§11 Authentication** — N/A. Does not touch authentication.
- **§12 Test Quality** — PASS (applicable items): `node:test` + `node:assert` + `@vue/test-utils`, no `boardgame.io` import, no network/DB. The `makeMockCtx` / deterministic-shuffle / golden-deck items are engine-move-test specific and N/A for a Vue component test (no deck construction).
- **§13 Commands** — PASS. `pnpm` filter commands, exact, with expected output.
- **§14 Acceptance Criteria** — PASS. Binary, observable, deliverable-aligned.
- **§15 Definition of Done** — PASS. STATUS.md / DECISIONS.md / WORK_INDEX.md + scope-boundary check; §15.1 User-Visible Surface declared (play.legendary-arena.com) with a live-on-surface verification item (not satisfiable by tests + merge alone).
- **§16 Code Style** — PASS. WP mandates human-style code, `// why:` comments, and gates the arc helper on non-trivial/reused (no premature abstraction).
- **§17 Vision Alignment** — TRIGGERED (§17 accessibility) and satisfied: `## Vision Alignment` cites §17, the NG-1..7 proximity check (no pay-to-win / no paid gate), and the §22 determinism-preservation line.
- **§18 Prose-vs-Grep** — Addressed. Verification Step 4 greps the two Vue files for the engine/registry/`pg` import tokens; the EC guardrail + this WP's execution rules require the executor to paraphrase (not echo) those tokens in any `// why:` comment so the diff grep does not false-positive.
- **§19 Bridge-vs-HEAD** — N/A (commit-time discipline, not a Final-Gate WP-lint rule).
- **§20 Funding Surface Gate** — N/A: this packet adds no funding affordance, no donate/support copy, and no funding channel — it is a client-side visual hand-feel change on the play surface.
- **§21 API Catalog** — N/A: no HTTP endpoint added/modified/removed and no `apps/server/src/**` library function touched — arena-client presentation only.

No Final-Gate FAIL condition triggers.

**Gate verdicts on record:** Pre-flight (01.4) = **READY TO EXECUTE** (after fixing PS-1: the import checks were rescoped from "no game-engine import" to "no *new runtime* import," because both Vue files carry a permitted type-only `import type { UICardDisplay }` per WP-090; RS-1/RS-2 folded as the named `effectIntensity` consumer + the `matchMedia` test-stub pointer). Copilot check (01.7) = **PASS** (all 30 modes; no inline change required).
