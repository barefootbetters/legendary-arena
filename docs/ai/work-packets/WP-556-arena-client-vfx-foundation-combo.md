# WP-556 — Arena-Client VFX Foundation + Combo Flash + Synergy Call-out

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`) — single layer; **zero engine / determinism / persistence footprint** (VFX is pure presentation per ARCHITECTURE.md "engine owns truth; UI consumes read-only projections").
**Dependencies:** WP-409 / D-24221 (`UIState.game.lastPlayEffectsFired` — the hero-play effects-fired scalar this consumes), WP-413 / D-24228 + WP-425 / D-24246 (`comboTierForCount` — the shared count→tier mapping this **reuses**, never re-derives), WP-412 / D-24224 (the arena-client audio foundation — the `PlayViewport` `01.5` wiring host and the `AudioControls` surface the unified Effect-Intensity control extends). All landed on `main`.
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` — re-baseline to current `origin/main` at execution (this repo's WP/EC throughput is high; capture the SHA in the exec session).

---

## Session Context

The audio half of the feel layer shipped an arc — foundation (WP-412) →
combo cue (WP-413) → apex tier (WP-425). The **visual** half has shipped
nothing: the only motion in the client is one CSS fade in
`NotableEventOverlay.vue`. So every shipped audio cue is currently a
half-moment — a sting with no flash — which violates the "twin moments peak
together" rule locked on the
[Design System Overview](https://ewiki.legendary-arena.com/design-system-overview/#visual-audio-pairing).

This WP is the **visual foundation**, built around the one moment where the
signal is already live, the audio twin already ships, and the payoff is
highest: the **combo**. It delivers three things that all ride the single
`UIState.game.lastPlayEffectsFired` scalar (D-24221) through the single
`comboTierForCount` mapping (D-24228 / D-24246) the audio layer already uses:

1. a **VFX foundation** — one full-bleed overlay layer, the `canvas-confetti`
   (MIT) library, the mount plumbing, and — non-negotiable, day-one — the
   **accessibility gate** (`prefers-reduced-motion` + a persisted, **unified**
   "Effect Intensity" control shared with the audio mute/volume; the client has
   neither today);
2. the **combo flash** — a `useComboVfx` composable (the visual mirror of the
   shipped `useComboCue`) that fires a tiered particle burst on each audible
   value-change; and
3. the **synergy call-out** — an escalating on-screen word
   (**Combo! → Team-Up! → Unstoppable! → LEGENDARY!**) on the same scalar,
   the visual twin of the audio combo sting.

**Why one WP for three pieces (split rationale).** They share **one** mount,
**one** signal, and **one** tier map. The call-out is a thin text renderer
(a word scaled by the tier) with no library dependency; splitting it into its
own WP would duplicate the overlay-mount + test scaffolding for a ~2-file
addition. The combo flash is the foundation's own proving consumer (as the
audio combo cue proved the audio engine). Everything **beyond** the combo
moment — Tier-1 notable-event effects, Surface-4 endgame finales, faction
battle cries — is a **follow-up WP** (see Out of Scope), keeping this WP's
surface to the combo moment plus the shared plumbing every later visual WP
inherits.

**Signal shape (inherited, verified).** `lastPlayEffectsFired` is a **scalar**,
overwritten per play and reset to `0` in the play-phase `onBegin` (WP-409). So
both visual consumers key off a **value change** exactly as `useComboCue` does:
seed last-seen on the first valid frame (no effect for the pre-mount value),
fire once per audible value-change. The same accepted v1 coalescing limitation
applies (two same-turn plays with the same non-zero count → one effect); the
per-turn reset re-arms equal values across turns.

---

## Goal

After this session, `play.legendary-arena.com` renders **visual juice on the
combo moment**, peaking with the already-shipped combo sting: a `useComboVfx`
composable and a synergy call-out both watch `UIState.game.lastPlayEffectsFired`,
map the count to a tier via the **existing** `comboTierForCount` helper (no
per-renderer copy), and render — a tiered `canvas-confetti` burst and an
escalating word — through a single full-bleed overlay layer. The whole layer
honours a new, **unified Effect-Intensity** preference (persisted; off →
no effects) and OS `prefers-reduced-motion` (big shakes/particles suppressed,
the call-out word still shown as a plain fade), and holds a fixed
**performance budget**. It lives **entirely in `apps/arena-client`**, reads
only `UIState`, never writes `G`/`ctx`, and adds **zero** engine, determinism,
or replay footprint.

---

## User-Visible Impact

Players **see** their combos, in lockstep with what they already hear. A
one-effect play gives a light spark; a two-effect play a bigger burst plus the
word **Team-Up!**; a three-or-more-effect synergy the full ascending flourish
and **Unstoppable!**; the rare `≥ 5` chain the apex **LEGENDARY!**. Every effect
scales under one Effect-Intensity control (shared with audio) and degrades
cleanly: at minimum intensity, or with OS reduced-motion on, the screen-shake
and heavy particles drop while the reward stays legible (the call-out word still
appears). Nothing renders before the first user gesture / in a disabled state,
and gameplay is never blocked by the effect layer.

---

## Assumes

- `packages/game-engine` projects `UIState.game.lastPlayEffectsFired: number`
  (WP-409 / D-24221) — a **public** scalar, reset to `0` in the play-phase
  `onBegin`, overwritten per play.
- `apps/arena-client/src/audio/comboCueManifest.ts` (WP-413 / WP-425) exports
  `ComboTier = 'none' | 'small' | 'medium' | 'big' | 'legendary'` and the pure
  `comboTierForCount(count): ComboTier` (`<= 0 → none`, `1 → small`,
  `2 → medium`, `3–4 → big`, `>= 5 → legendary`). This WP **imports** that
  helper; it MUST NOT re-derive the mapping.
- `apps/arena-client/src/composables/useComboCue.ts` (WP-413) is the
  sibling-consumer precedent (own last-seen scalar, catch-up-on-first-frame,
  fire once per audible value-change, injected-engine seam for tests).
- `apps/arena-client/src/pages/PlayViewport.vue` (WP-412) is the single `01.5`
  composable-mount host: its `setup` reads the `useUiStateStore` snapshot
  (`storeToRefs`) and mounts `useSoundEffects` / `useComboCue`. The visual
  consumers mount there, reading the same snapshot.
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` (WP-412) is
  the overlay precedent (full-bleed, sits over the mat), and
  `apps/arena-client/src/components/play/AudioControls.vue` (WP-412) is the
  persisted mute/volume control the unified Effect-Intensity preference extends,
  backed by `apps/arena-client/src/composables/useAudioSettings.ts` (the
  persisted mute/volume store).
- `apps/arena-client/src/pages/PlayDesktop.vue` and `PlayMobile.vue` host the
  play mat; the VFX overlay is hosted there the way `NotableEventOverlay` is.
- `apps/arena-client` uses Vue 3 + `node:test`; `@vue/test-utils` +
  `testing/jsdom-setup` are the component/DOM test precedents.
- There is **no** `prefers-reduced-motion` handling and **no** animation
  library anywhere in `apps/arena-client/src` today (verified: zero matches).
- `pnpm -r build` exits 0; arena-client suite + `typecheck` (vue-tsc) pass on
  the baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/arena-client/src/composables/useComboCue.ts` — the shipped audio
  consumer to mirror: own-state scalar watcher, catch-up-on-first-frame, fire
  once per audible value-change, injected seam. `useComboVfx` copies this shape
  with a particle burst in place of `engine.play(...)`.
- `apps/arena-client/src/audio/comboCueManifest.ts` — the **source of
  `comboTierForCount`** this WP imports (never re-derives) + the manifest shape
  precedent (a keyed `Record`, a compile-time exhaustiveness pin, a drift test).
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — the overlay
  precedent (full-bleed, over the mat, the only current "effect").
- `apps/arena-client/src/components/play/AudioControls.vue` — the
  persisted-preference control precedent; the unified Effect-Intensity control
  extends this surface. Its state store is
  `apps/arena-client/src/composables/useAudioSettings.ts` (persisted mute/volume)
  — the unified "off" reads/sets it (see Scope C).
- `.claude/rules/architecture.md` §Layer Boundary + `.claude/rules/code-style.md`
  — the App-layer import discipline and pure-helper rules this WP obeys.
- `apps/arena-client/src/pages/PlayViewport.vue` / `PlayDesktop.vue` /
  `PlayMobile.vue` — the `01.5` composable-mount host and the two overlay hosts.
- `packages/game-engine/src/ui/uiState.types.ts` —
  `UIState.game.lastPlayEffectsFired` (the signal; public, `number`).
- ewiki [Visual Effects Framework](https://ewiki.legendary-arena.com/visual-effects/)
  — the design source: §VFX Trigger Contract (the eight invariants), §Surface 2
  (the combo signal), §synergy call-out (the label render), §performance budget,
  §accessibility gate, §library posture.
- ewiki [Design System Overview](https://ewiki.legendary-arena.com/design-system-overview/)
  — §Feel-Layer Contract, §visual–audio pairing, §Combo Tier Contract (shared
  mapping), §Event priority & coalescing (why storm-coalescing is out of scope
  until >1 effect class).
- `docs/ai/DECISIONS.md` — D-24221 (signal), D-24228 / D-24246 (the shared
  tiers), D-24224 (audio foundation), and the reserved **D-24365** at the tail.

---

## Non-Negotiable Constraints

**App-wide (always apply):**
- The VFX layer is **pure presentation**: it reads `UIState` only, **never**
  writes `G`/`ctx`, never affects move validation, never branches engine logic.
  Determinism, replays, and bot-vs-bot sims are unaffected (none render VFX).
- No runtime `@legendary-arena/registry` / `@legendary-arena/game-engine/setup`
  import; the engine surface is the `.` subpath (type-only `UIState`).
- ESM only; Vue 3 SFCs; test files `*.test.ts` (`node:test`, no
  `boardgame.io/testing`). Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; the executor
  outputs **full file contents** for each changed file (no diffs/snippets).
- **Determinism-exemption (governance, D-24365).** The `client-app` code
  category (`02-CODE-CATEGORIES.md`) bans `Math.random()` / `Date.now()` /
  `performance.now()`. The VFX presentation layer is **exempt** — it is
  non-replay-bearing presentation off the gameplay render path (never read into
  `G`/`ctx`, never hashed), so it MAY depend on a `Math.random()`-using library
  (`canvas-confetti`) and MAY use `requestAnimationFrame` / time-based
  animation. This mirrors the `functions/` edge-subsurface exemption (D-24085).
  The exemption is landed in D-24365 + a `§client-app` note at close; the
  gameplay engine's determinism is untouched.

**Packet-specific:**
- **Reuse `comboTierForCount` — do not re-derive it.** The combo flash and the
  call-out both import the shipped helper (WP-413 / WP-425). No per-renderer tier
  copy; a drift test pins that the VFX tier map is exhaustive over the same tiers.
- **Accessibility is day-one, pass/fail.** `prefers-reduced-motion` MUST be
  honoured (OS setting); a persisted **unified** Effect-Intensity control MUST
  exist (localStorage; off → no effects); screen-shake and full-screen flashes
  gate behind both; a disabled/reduced state preserves full gameplay parity (the
  layer degrades to no effects — never a loss of game functionality).
- **Scalar-change consumers (locked).** `useComboVfx` and the call-out each keep
  their own last-seen scalar; catch up on the first valid frame (no effect for
  the pre-mount value); render once per audible value-change; skip `none`. NOT
  append-only cursors.
- **Call-out start tier (locked).** The **flash** starts at the `small` tier;
  the **word** starts at `medium` (`small` shows no word) —
  contrast-through-restraint (a single effect is not a "synergy"). Ladder
  wording: `medium → Team-Up!`, `big → Unstoppable!`, `legendary → LEGENDARY!`;
  `small → Combo!` **is flash-only, no word** (the word begins at `medium`).
- **Performance budget (locked).** 60 FPS desktop + modern mobile; ≤ 200
  concurrent particles; ≤ 5 simultaneous bursts; ≤ 500 ms screen-shake; **one**
  shared overlay canvas. Animate `transform`/`opacity` only; pool with a hard
  ceiling (drop oldest at cap); lazy-load `canvas-confetti` off the first-paint
  path. Gameplay rendering always wins; VFX yields the frame, never blocks it,
  never queues a backlog.
- **Library (locked).** `canvas-confetti` (MIT) for bursts/bloom; hand-rolled
  CSS/WAAPI for the call-out word, shake, and vignette. No `tsparticles`, no
  GSAP.
- No new engine event, no `G` field, no `UIState` change — the layer consumes
  the existing WP-409 projection.

**Session protocol:** if any contract or field name is unclear, stop and ask.

**Locked contract values (do not re-derive):**
- **Dependency added:** `canvas-confetti@^1.9.3` (MIT), arena-client
  `dependencies` (the executor confirms the current stable `1.9.x` at add time;
  the full updated `package.json` is committed).
- **Tier source:** import `ComboTier` + `comboTierForCount` from
  `comboCueManifest.ts` (WP-413 / WP-425). Tiers: `<= 0 → none`, `1 → small`,
  `2 → medium`, `3–4 → big`, `>= 5 → legendary`.
- **Call-out words:** `medium → Team-Up!`, `big → Unstoppable!`,
  `legendary → LEGENDARY!`; `small`/`none` → no word (flash-only / silent).
- **Consumer rule:** own last-seen scalar; catch up on first frame (no effect
  for the pre-mount value); render once per audible value-change; skip `none`.
- **Signal source:** `UIState.game.lastPlayEffectsFired` (public scalar; safe
  `?? 0` on a null/absent snapshot).
- **Intensity gate:** `shouldRender(kind: 'shake' | 'particles' | 'word'): boolean`
  — `kind` is a **locked narrow union**, never raw `string`. The unified "off"
  master sets visual intensity to `off` **and** mutes audio via
  `useAudioSettings` (import + call, no new store).
- **Wiring host:** composables mount at `PlayViewport.vue` (the WP-412 `01.5`
  host); the overlay is hosted in `PlayDesktop.vue` + `PlayMobile.vue` beside
  `NotableEventOverlay`.
- **Reserved decision:** **D-24365** (land Active at close).

---

## Debuggability & Diagnostics

- The tier mapping is the shipped, exhaustively-unit-tested
  `comboTierForCount`; the VFX tier→visual map is a pure `Record` with a drift
  test pinning every audible tier.
- `useComboVfx` and the call-out are deterministic over a scalar sequence: given
  a UIState sequence they trigger exactly once per audible value-change and never
  for the pre-mount value; equal-consecutive values within a turn coalesce (the
  documented limitation, shared with `useComboCue`).
- No engine/`G` interaction: `JSON.stringify` of engine state is untouched; the
  layer is invisible to replays and sims. A disabled Effect-Intensity or
  `prefers-reduced-motion` no-ops / degrades the render.

---

## Scope (In)

### A) Dependency (`apps/arena-client/package.json`, **modified** + lockfile)
- Add `canvas-confetti@^1.9.3` (MIT) to arena-client `dependencies`;
  lazy-imported off the first-paint path.

### B) VFX tier→visual map (`apps/arena-client/src/vfx/comboVfxManifest.ts`, **new**)
- Import `ComboTier` + `comboTierForCount` from `comboCueManifest.ts` (no
  re-derive). Export `comboVfxManifest: Record<Exclude<ComboTier,'none'>, ...>`
  mapping each audible tier to a burst spec (particle count / spread / scale,
  within the budget) and the call-out word (`small → no word`). A drift test
  pins exhaustiveness over the audible tiers.

### C) Effect-Intensity preference (`apps/arena-client/src/vfx/effectIntensity.ts`, **new**; + `components/play/AudioControls.vue`, **modified**; + `composables/useAudioSettings.ts`, **modified only if a master-off setter is absent**)
- A persisted (localStorage) **visual** Effect-Intensity value (`off` / `low` /
  `full`) plus a reactive `prefersReducedMotion` read of the OS media query.
  Expose a narrow `shouldRender(kind: 'shake' | 'particles' | 'word'): boolean`
  gate the overlay/consumers consult (`kind` is a **locked union**, never raw
  `string`).
- **Unified control (coupling, locked).** The single **"off"** master governs
  **both** layers: it sets the visual Effect-Intensity to `off` **and** mutes
  audio via `useAudioSettings`' existing mute setter (import + call — no new
  audio store). `AudioControls.vue` renders both the audio mute/volume (existing)
  and the new Effect-Intensity control in **one** panel (no second panel). Only
  if `useAudioSettings` exposes no callable master-mute setter does the executor
  add one (that is the sole reason `useAudioSettings.ts` is in the allowlist);
  otherwise it is import-only and drops from the diff.

### D) VFX overlay (`apps/arena-client/src/components/play/VfxOverlay.vue`, **new**)
- A full-bleed overlay (modeled on `NotableEventOverlay.vue`) hosting the single
  shared `canvas-confetti` canvas and the call-out word render. Honours the
  Effect-Intensity gate + `prefers-reduced-motion` (word → plain fade, no shake).
  Animates `transform`/`opacity` only; pools effects with the budget ceiling.

### E) Combo-flash consumer (`apps/arena-client/src/composables/useComboVfx.ts`, **new**)
- `useComboVfx(snapshot, options?)` — mirror of `useComboCue`: own last-seen
  `lastPlayEffectsFired`; catch up on first valid frame; on each audible
  value-change, drive the overlay to render tier's burst + (at `>= medium`) the
  call-out word. Safe-skip null snapshot / disabled intensity.

### F) Wiring (`PlayViewport.vue`, **modified**, `01.5`; `PlayDesktop.vue` + `PlayMobile.vue`, **modified**, `01.5`)
- Mount `useComboVfx(audioSnapshot)` at `PlayViewport.vue` beside `useComboCue`.
- Host `<VfxOverlay>` in `PlayDesktop.vue` **beside the existing
  `NotableEventOverlay`** (same full-bleed layer position). `PlayMobile.vue`
  has **no** `NotableEventOverlay` today, so host `<VfxOverlay>` at the mobile
  mat root as a new full-bleed overlay (same z-layer discipline); this is the
  first overlay on the mobile mat.

### G) Tests
- `comboVfxManifest.test.ts` — the VFX map is exhaustive over the audible tiers;
  `small` maps to a burst but **no** word; words match the locked ladder.
- `effectIntensity.test.ts` — persistence round-trip; off → `shouldRender`
  false; `prefers-reduced-motion` suppresses shake/particles but not the word.
- `useComboVfx.test.ts` — renders the correct tier once per audible value-change;
  no effect for the pre-mount value; no effect on change-to-`none`; coalesces
  equal-consecutive (documented limitation); re-arms across `3 → 0 → 3`;
  safe-skips null; no-ops when intensity is off.
- `VfxOverlay.test.ts` — mounts; respects the intensity/reduced-motion gate;
  single canvas; the word renders at `>= medium` only.

---

## Out of Scope

- **Tier-1 notable-event effects** (`mastermindStrikeResolved` shake+vignette,
  `mastermindDefeated` bloom, `fightResolved` impact) — the next visual WP,
  riding `useNotableEventStream` on this foundation.
- **Surface-4 endgame finales** (win / loss / tie) — a follow-up WP.
- **Faction battle cries** — licensing-gated (D-24259); MUST NOT ship ahead of
  the Marvel / Upper Deck licence confirmation.
- **The event-storm coalescing algorithm** — the shared contract is locked on
  the hub (§Event priority & coalescing); the concrete algorithm is not needed
  until a second effect class can fire on one frame (the next WP). The combo
  flash + call-out are one class off one scalar — no cross-class storm yet.
- **Ambient menace layer, per-target sub-effect fidelity, the builder/destroyer
  narrative lens** — deferred (Tier 3 on the VFX page).
- **Any engine change** — no new `G` field, no new `UIState` field, no new
  `NotableGameEvent` variant.
- **VFX asset production** — the combo flash is code-generated (`canvas-confetti`
  + CSS), so there are no external VFX assets to source; the audio twin's clips
  already ship.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `apps/arena-client/package.json` — **modified** — add `canvas-confetti` (MIT)
- `apps/arena-client/src/vfx/comboVfxManifest.ts` — **new** — tier→burst/word map (imports `comboTierForCount`)
- `apps/arena-client/src/vfx/effectIntensity.ts` — **new** — unified persisted intensity + reduced-motion gate
- `apps/arena-client/src/components/play/VfxOverlay.vue` — **new** — the single overlay layer (canvas + word)
- `apps/arena-client/src/composables/useComboVfx.ts` — **new** — scalar-change combo-flash consumer
- `apps/arena-client/src/components/play/AudioControls.vue` — **modified (`01.5`)** — render the unified Effect-Intensity beside the existing audio mute/volume (one panel)
- `apps/arena-client/src/composables/useAudioSettings.ts` — **modified ONLY if it lacks a callable master-mute setter** (else import-only, drops from the diff) — the unified "off" mutes audio through it
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified (`01.5` wiring — the same single host)** — mount `useComboVfx`
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified (`01.5` wiring)** — host `<VfxOverlay>` beside `NotableEventOverlay`
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified (`01.5` wiring)** — host `<VfxOverlay>` at the mobile mat root (no prior overlay)
- `docs/ai/DECISIONS.md` + `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — **modified (governance, at close)** — land D-24365 Active with the VFX determinism-exemption clause + record the `src/vfx/` carve-out under §`client-app`
- `apps/arena-client/src/vfx/comboVfxManifest.test.ts` — **new**
- `apps/arena-client/src/vfx/effectIntensity.test.ts` — **new**
- `apps/arena-client/src/composables/useComboVfx.test.ts` — **new**
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` — **new**
- `apps/arena-client/src/composables/useAudioSettings.test.ts` — **modified only if `useAudioSettings.ts` gains the master-mute setter above**
- `pnpm-lock.yaml` — **modified (generated)** — the `canvas-confetti` add

The four `01.5` runtime-wiring hosts (`AudioControls.vue`, `PlayViewport.vue`,
`PlayDesktop.vue`, `PlayMobile.vue`) are recorded here and in the EC. Otherwise
no files may be modified. **Note (file count / potential split):** this WP is
at the upper end of the ~10-file guideline because the foundation touches the
two overlay hosts + the shared control. If pre-flight or copilot judges the
surface too large, split the **synergy call-out** (its word render + logic +
tests) into a follow-up WP on the merged foundation; the combo flash + overlay +
Effect-Intensity gate are the irreducible core.

---

## Vision Alignment

N/A on the §17.1 trigger surfaces: no scoring/PAR/leaderboards, no identity, no
multiplayer sync, no card-data/content-semantics change. **Monetization note:**
VFX is a retention / perceived-quality lever, not a revenue vector — it never
gates play and never becomes pay-to-win (a future cosmetic effect pack would be
an optional flourish only), and it is free to all players (Effect Intensity is a
comfort/accessibility control, never a paywall). **Determinism note:** the VFX
layer is pure client presentation — it reads `UIState`, never writes `G`/`ctx`,
and adds **zero** engine/determinism/replay footprint (sims and replays render
no VFX). NG-1..7 preserved.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the
layer consumes the boardgame.io `UIState` push and renders client-side.

---

## Acceptance Criteria

All items are binary pass/fail.

- [ ] `comboVfxManifest` **imports** `comboTierForCount` (no re-derived tier
      mapping — grep shows a single `comboTierForCount` definition, in
      `comboCueManifest.ts`); the VFX map is exhaustive over the audible tiers;
      a drift test pins it.
- [ ] `useComboVfx` renders exactly one tier effect per **audible value-change**
      of `game.lastPlayEffectsFired`; **no** effect for the pre-mount value, **no**
      effect on a change to `0`/`none`; re-arms across a `3 → 0 → 3` per-turn
      reset; safe-skips a null snapshot.
- [ ] The **flash** renders at `small`+; the **word** renders at `medium`+
      (`small` = flash, no word); words are `Team-Up!` / `Unstoppable!` /
      `LEGENDARY!`.
- [ ] Two consecutive equal non-zero counts in one turn coalesce to a single
      effect (documented v1 limitation — asserted, not a bug).
- [ ] Accessibility gate holds: with Effect-Intensity off the layer renders
      nothing; with `prefers-reduced-motion` on, screen-shake + heavy particles
      are suppressed while the call-out word still shows (as a plain fade); the
      control is persisted (localStorage) and unified with audio mute/volume.
- [ ] Performance budget holds: one overlay canvas; particle/burst caps enforced
      (a rapid combo storm drops oldest, never exceeds the cap);
      `transform`/`opacity`-only animation; `canvas-confetti` lazy-loaded.
- [ ] The layer writes no `G`/`ctx` and adds no engine/determinism footprint
      (App-only diff; engine suites + sentinel hashes untouched).
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0;
      `pnpm --filter arena-client test` passes; `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified
      (`git diff --name-only`), save the recorded `01.5` wiring hosts.

---

## Verification Steps

```pwsh
# Step 1 — build everything
pnpm -r build
# Expected: exits 0

# Step 2 — arena-client typecheck + tests
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass (canvas-confetti + Howl mocked; no real render/audio)

# Step 3 — single tier-mapping source (no per-renderer copy)
Select-String -Path "apps\arena-client\src\**\*.ts" -Pattern "function comboTierForCount"
# Expected: exactly ONE match, in comboCueManifest.ts

# Step 4 — no engine footprint
git diff --name-only
# Expected: only apps/arena-client/** files (+ pnpm-lock.yaml); NO packages/game-engine/**
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
      D-24026):** in a **real deployed match**, a hero play that fires synergy
      effects renders its combo flash (bigger play → bigger tier) with the
      call-out word at `medium`+, peaking with the combo sting; toggling
      Effect-Intensity off silences AND blanks the visuals; OS reduced-motion
      keeps the word but drops the shake — observed on the deployed bundle
      (green tests + merge alone do NOT satisfy it).
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0;
      arena-client suite passes.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated — the VFX foundation + combo flash + synergy
      call-out riding the WP-409 signal + shared `comboTierForCount`.
- [ ] `docs/ai/DECISIONS.md` updated — land **D-24365** as Active (incl. the
      VFX determinism-exemption clause), and `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`
      §`client-app` carries the `src/vfx/` determinism carve-out note.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-556 checked off with the date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-556 node glyph `📝 → ✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`
(independent 00.3 subagent, 2026-08-15):

- **§1 Structure** — PASS. All required sections; Out of Scope lists 7 items.
- **§2 Constraints** — PASS. App-wide + packet-specific + Node v22+ + full-file-output + session protocol + locked values; references 00.6.
- **§3 Assumes** — PASS. WP-409/412/413/425 exact exports/paths + green-baseline + explicit BLOCKED clause.
- **§4 Context** — PASS. Specific files/sections + `.claude/rules/*` + ewiki design; no 00.2 (no card-data change).
- **§5 Files** — PASS. Every file new/modified with a one-liner; single App layer; ~16 files acknowledged (foundation-driven; copilot advised no split).
- **§6 Naming** — PASS. `comboTierForCount`, `ComboTier`, `useComboVfx`, `effectIntensity`, `shouldRender`; no abbreviations; consistent WP↔EC.
- **§7 Dependency** — PASS. `canvas-confetti@^1.9.3` (MIT) pinned; full `package.json` committed; alternatives rejected. (Prior FAIL — the missing version — is now fixed.)
- **§8 Boundaries** — PASS. App-only; type-only `UIState` via `.` subpath; no runtime engine/registry import; no `G`/`ctx` write.
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. None (localStorage preference; no `VITE_`/secrets).
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. 4–6 `*.test.ts` (`node:test`); `canvas-confetti`/`Howl` mocked; no `boardgame.io/testing`; typecheck gated.
- **§13 Verification** — PASS. Exact `pnpm` commands + expected output; the client `typecheck` gate is explicit.
- **§14 Acceptance criteria** — PASS. 8 binary, observable items.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS(+02-CODE-CATEGORIES)/WORK_INDEX/mindmap + scope check; §15.1 D-24026 live-on-surface present (surface = play.legendary-arena.com).
- **§16 Code style** — PASS. Human-style per 00.6; EC enumerates the required `// why:` set (incl. the D-24365 exemption).
- **§17 Vision Alignment** — N/A on trigger surfaces (declared) + monetization + determinism notes; NG-1..7 preserved.
- **§18 Prose-vs-grep** — PASS. Verification Step 3 greps `function comboTierForCount` scoped to `apps\arena-client\src\**\*.ts` (source only, matches the declaration, not the WP prose).
- **§19 Bridge-vs-HEAD** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — PASS. Reasoned N/A (no funding affordance/channel/copy).
- **§21 API Catalog** — PASS. Reasoned N/A (no HTTP endpoint / `apps/server/src/**` library function).

**Lint verdict: PASS** (18 PASS / 3 justified N/A / 0 FAIL — the prior §7 version-pin FAIL is resolved).

---

## Pre-Flight Verdict (01.4)

> Recorded at drafting (independent 01.4 subagent, 2026-08-15, re-run after
> fixes); the executing session re-confirms against its own baseline.

**Verdict: READY TO EXECUTE.**

- **Sequencing / dependencies:** WP-409 (`UIState.game.lastPlayEffectsFired`),
  WP-413 / WP-425 (`comboTierForCount` incl. the `legendary` tier, verified in
  `comboCueManifest.ts`), and WP-412 (the `PlayViewport` `01.5` host +
  `components/play/AudioControls.vue` + `useAudioSettings.ts`) are all on `main`.
  A pure client consumer; no engine dependency.
- **Scope lock:** closed allowlist (~16 files, foundation-driven; four `01.5`
  wiring hosts recorded); `git diff --name-only` is a DoD gate.
- **Prior NOT-READY blockers — all resolved against disk:** the number
  collision (renumbered to the freshly-reserved WP-556 / EC-591 / D-24365; the
  old 548/583/24357 are owned by the merged Coverage WP), the `AudioControls.vue`
  path (`components/play/`, verified), the `PlayMobile` overlay anchor (Mobile
  has no `NotableEventOverlay` — hosts `<VfxOverlay>` at the mat root), and the
  unified-audio coupling (`useAudioSettings.ts` exposes a writable `isMuted`
  ref; allowlisted modified-only-if-needed).
- **RS-1 (executor nuance, non-blocking):** `useAudioSettings` exposes a
  writable `isMuted: Ref<boolean>` rather than a named `setMuted()`; the
  allowlist's "modify only if it lacks a callable master-mute setter" language
  accommodates either path.
- **PS items (blocking):** none. (Live D-24026 verification is inherently
  post-deploy; not a code blocker.)

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (independent 01.7 subagent, 2026-08-15,
re-run after fixes).** Single App layer, additive, pure client-side presentation
reading projected `UIState`; the two load-bearing reuse claims
(`comboTierForCount` incl. the `legendary` tier; `useComboCue` as the consumer
precedent) were verified against source.

The first pass returned **RISK** with four items; all are now resolved:
- **Determinism exemption (Issues 2/13/15)** — the `client-app`
  `Math.random()`/`Date.now()`/`performance.now()` ban is exempted for the
  non-replay-bearing `src/vfx/` presentation layer, codified in D-24365
  (point 7) + the App-wide constraints, landed as a `02-CODE-CATEGORIES.md
  §client-app` note in Files + DoD, and carrying a required `// why:` at the
  `canvas-confetti`/rAF site (EC). Mirrors the `functions/` precedent (D-24085).
- **Type widening (Issue 21)** — `shouldRender(kind: 'shake' | 'particles' |
  'word')` is a locked narrow union, never raw `string`.
- **Scope (Issue 12)** — the synergy call-out stays bundled (foundation-driven
  file count; a split would not reduce the surface).
- **Dependency (Lint §7)** — `canvas-confetti@^1.9.3` pinned.

**Disposition: CONFIRM** — session-prompt generation authorized; no pre-flight
re-run required for these scope-neutral fixes (the file allowlist and mutation
boundary were untouched).

---

## Reserved Decisions (land at execution)

- **D-24365 (reserved; Drafted 2026-08-14, not yet landed)** — arena-client
  gains its **VFX foundation** on `play.legendary-arena.com`, locked as follows.
  (1) **Architecture:** pure client presentation — lives entirely in
  `apps/arena-client`, reads only `UIState` (chiefly
  `game.lastPlayEffectsFired`, WP-409 / D-24221), **never** writes `G`/`ctx`,
  adds **zero** engine/determinism/replay footprint. (2) **Shared tiers, not a
  copy:** the combo flash and the synergy call-out consume the shipped
  `comboTierForCount` (D-24228 / D-24246) — one mapping, now three renderers
  (audio sting + visual flash + word). (3) **Library:** `canvas-confetti` (MIT)
  for bursts + hand-rolled CSS/WAAPI for word/shake/vignette; no tsparticles,
  no GSAP. (4) **Accessibility is day-one:** a persisted **unified**
  Effect-Intensity control (governing both visual intensity/off AND the audio
  mute/volume) + OS `prefers-reduced-motion` (shake/heavy particles suppressed;
  the call-out word survives as a plain fade); off/reduced degrades to no
  effects with full gameplay parity. (5) **Performance budget:** 60 FPS /
  ≤ 200 particles / ≤ 5 bursts / ≤ 500 ms shake / one overlay canvas;
  `transform`/`opacity`-only; pooled with a hard ceiling; gameplay always wins.
  (6) **Call-out restraint:** the flash starts at `small`, the word at `medium`
  (`Team-Up!` / `Unstoppable!` / `LEGENDARY!`). Wired at the WP-412 `01.5` host
  (`PlayViewport.vue`); the overlay hosted in `PlayDesktop` (beside
  `NotableEventOverlay`) and at the `PlayMobile` mat root (no prior overlay).
  (7) **Determinism exemption (mirrors D-24085):** the `client-app` code
  category bans `Math.random()` / `Date.now()` / `performance.now()`; the VFX
  presentation layer under `apps/arena-client/src/vfx/` (and `VfxOverlay`) is
  **exempt** because it is non-replay-bearing presentation off the gameplay
  render path — it MAY depend on a `Math.random()`-using library
  (`canvas-confetti`) and MAY use `requestAnimationFrame` / time-based
  animation. Recorded here and as a `§client-app` note in
  `02-CODE-CATEGORIES.md`; the gameplay engine's determinism is untouched
  (replays/sims render no VFX).

---

## See Also

- [WP-409](WP-409-hero-play-synergy-effect-count-signal.md) / D-24221 — the
  `UIState.game.lastPlayEffectsFired` signal this consumes.
- [WP-412](WP-412-arena-client-audio-layer-foundation.md) / D-24224 — the audio
  foundation (the `01.5` host + `AudioControls` this extends).
- [WP-413](WP-413-arena-client-tiered-combo-cue.md) / D-24228 +
  [WP-425](WP-425-apex-legendary-combo-tier.md) / D-24246 — the shared
  `comboTierForCount` this reuses; the audio twin the flash peaks with.
- ewiki [Visual Effects Framework](https://ewiki.legendary-arena.com/visual-effects/)
  and [Design System Overview](https://ewiki.legendary-arena.com/design-system-overview/)
  — the design source (VFX Trigger Contract, pairing table, accessibility gate,
  performance budget, library posture).
