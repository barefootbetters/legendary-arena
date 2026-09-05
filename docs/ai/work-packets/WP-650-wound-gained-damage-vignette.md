# WP-650 — Wound-Gained Damage Vignette + Thud (Surface-1b feel layer)

**Status:** Ready
**Primary Layer:** arena-client (two new feel-layer consumers + one `VfxOverlay` render + a synthesized clip) + ewiki (a Surface-1b flip on `visual-effects` + `sound-effects`)
**Dependencies:** WP-556 / D-24365 (the VFX foundation: `VfxOverlay`, the module-signal seam, `effectIntensity.shouldRender`, `canvas-confetti`, the `src/vfx/` determinism exemption), WP-647 / D-24459 (the second consumer `useStrikeBlockedVfx` — the exact pattern this mirrors), WP-412/413 (the audio engine + the `useComboCue` scalar-cue template)

**User-Visible Surface:** `play.legendary-arena.com` + `ewiki.legendary-arena.com/visual-effects/` + `/sound-effects/`

> Baseline: `origin/main` @ `089a71de` or later. `UIState.players[i].woundCount` is already projected and public across audiences; this WP adds only client presentation.

---

## Session Context

The [Visual Effects](../../wiki/visual-effects.md) Surface-1b table proposes a
"wound gained" beat — *"a dull red damage flash"* — the thematic **inverse** of
the shipped shield block (WP-647): where the shield celebrates a threat
**avoided**, this fires when the local player **takes** a Wound. It is listed as
a follow-up WP. This packet ships it: a full-screen dull-red damage **vignette**
plus a dull damage **thud**, both keyed on the local seat's `woundCount`
increasing.

Every wound source lands as a `woundCount` increment — a Master Strike
(no-matching-Hero → Wound), a reveal-or-punish Scheme Twist, a villain Ambush,
a fight sub-effect — so watching that one scalar catches them all uniformly,
without parsing `appliedEffects` (which is keyword-only and cannot say *whose*
count moved). A **heal** decrements the count, so the consumers fire **only on an
increase**.

---

## Goal

After this session, when the local player's `UIState.players[own].woundCount`
increases, the play surface flashes a **full-bleed dull-red damage vignette**
(pulling in from the screen edges, transparent centre so the mat stays readable)
and plays a **dull damage thud** — the felt "ouch" of taking the hit, the mirror
of the shield-block relief. Both honour the WP-556 Effect-Intensity accessibility
contract. The ewiki `visual-effects` + `sound-effects` Surface-1b "Wound gained"
rows flip from proposal to shipped.

---

## User-Visible Impact

Taking a Wound stops being a silent number change: the screen edges flash red and
a low thud lands, so damage *feels* like damage. It pairs with the shield-block
beat to complete the block-vs-take defensive dyad.

---

## Assumes

- WP-556 / D-24365 complete: `VfxOverlay.vue` (the single full-bleed overlay), the
  module-signal consumer seam, `effectIntensity.shouldRender('shake'|'particles'|'word')`,
  and the `src/vfx/` determinism exemption are all on `main`.
- WP-647 / D-24459 complete: `useStrikeBlockedVfx` + the `VfxOverlay` shield render
  are the exact template for a second/third signal consumer.
- `UIState.players[i].woundCount: number` is projected (`uiState.build.ts`
  `countWounds`) and preserved for every audience by the filter (`uiState.filter.ts`).
  The local seat is the one whose `handCards !== undefined` (the `PlayDesktop.vue`
  `viewer` self-selection — the audience filter reveals a hand only to its owner).
- `getAudioEngine().play(url)` lazily plays ANY url (not only preloaded
  `sfxManifest` clips), so a wound-thud url outside `sfxManifest` plays fine.
- `pnpm -r build` 0; arena-client `vue-tsc` + suite green on the baseline.

If any of the above is false, this packet is **BLOCKED**.

---

## Non-Negotiable Constraints

- **Increase-only.** Fire on `count > lastSeen`; a heal (decrease) advances
  `lastSeen` silently and fires nothing. Seed `lastSeen` on the first valid
  own-seat frame (no pre-mount fire on mount/reconnect).
- **Local seat only.** Self-select via `handCards !== undefined`. A spectator /
  autoplay frame has no own hand → safe-skip (not a `lastSeen` reset).
- **Pure presentation.** Reads `UIState` only, writes no `G`/`ctx`, `src/vfx/`
  hash-excluded (D-24365). **No engine change. No determinism re-pin** — this is
  arena-client-only; `finalStateHash` / `PRE_WP080` / sim artifacts do not move
  and are not touched.
- **Not a notable event.** A Wound is not a `NotableGameEvent`; the thud carries a
  single-URL `woundCueManifest.ts` constant. Do **not** add a key to `sfxManifest`
  (its Record is exhaustive over the nine notable-event types).
- **Accessibility (WP-556).** The vignette is gated `shouldRender('shake')` (full
  intensity only; suppressed under reduced-motion / low / off — a full-screen
  colour flash is the photosensitivity-class of effect a reduced-motion user opts
  out of, like the impact pulse), with a `@media (prefers-reduced-motion)` CSS
  backstop. `off` also mutes the thud (the master mute); the thud still plays at
  `low`.

---

## Scope (In)

### A) The VFX consumer (`useWoundVfx.ts`, **new**)
Mirror `useComboVfx`: a scalar-change consumer over the local seat's `woundCount`,
increase-only, publishing a `WoundVfxEvent { seq }` to a module signal
`VfxOverlay` renders. Self-seat via `handCards !== undefined`.

### B) The audio consumer (`useWoundCue.ts`, **new**) + `woundCueManifest.ts` (**new**)
Mirror `useComboCue`: same self-seat increase-only signal → `engine.play(WOUND_GAINED_CLIP)`.
`WOUND_GAINED_CLIP` is the single R2 url (hyphenated, never committed).

### C) The render (`VfxOverlay.vue`, **modified**)
Add a full-bleed `.vfx-overlay__wound` red-edge-gradient div, `v-if="isWounded"`
with a monotonic `woundKey` remount, driven by a `pulseWound()` that clears after
`WOUND_VIGNETTE_MS`, on a `watch(woundSignal, …)` gated `shouldRender('shake')`.
A `@keyframes vfx-wound` (opacity/transform only) + a reduced-motion CSS backstop.
Expose the new refs in `setup()`'s `return`.

### D) Wiring (`PlayViewport.vue`, **modified**)
Mount `useWoundVfx(audioSnapshot)` + `useWoundCue(audioSnapshot)` beside the other
feel consumers (two 01.5 lines).

### E) Tests
`useWoundVfx.test.ts` + `useWoundCue.test.ts` (safe-skip / seed / increase-only /
heal-no-fire / re-arm / opponent-ignored / mute) and `VfxOverlay.test.ts` render
tests (full / off / reduced-motion / low).

### F) Asset (`ewiki/sound-effects/wound-gained.py`, **new**)
The deterministic synth generator for `wound-gained.mp3` (a dull downward body
thud — the sonic opposite of the shield clang). The byte lives on R2, not git.

### G) ewiki (`wiki/visual-effects.md` + `wiki/sound-effects.md`, **modified**)
Flip the Surface-1b "Wound gained" rows from proposal to shipped.

---

## Out of Scope

- **No engine change / no determinism re-pin** — arena-client-only, hash-excluded.
- **No per-panel targeting** — v1 is a full-screen vignette for the local player
  (the operator choice; the ewiki "afflicted player panel" wording is
  non-normative). A per-panel / per-afflicted-player variant is a future WP.
- **No other Surface-1b sub-effect** (Hero KO, bystander capture/rescue) — those
  are keyword-only-precision-limited and their own WPs.
- **No `sfxManifest` entry / no new notable event.**

---

## Files Expected to Change

- `apps/arena-client/src/composables/useWoundVfx.ts` — **new**
- `apps/arena-client/src/composables/useWoundCue.ts` — **new**
- `apps/arena-client/src/audio/woundCueManifest.ts` — **new**
- `apps/arena-client/src/composables/useWoundVfx.test.ts` — **new**
- `apps/arena-client/src/composables/useWoundCue.test.ts` — **new**
- `apps/arena-client/src/components/play/VfxOverlay.vue` — **modified**
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` — **modified**
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified**
- `ewiki/sound-effects/wound-gained.py` — **new**
- `wiki/visual-effects.md` — **modified**
- `wiki/sound-effects.md` — **modified**

No other files may be modified. `git diff --name-only` is a DoD gate.

---

## Vision Alignment

N/A — no §17.1 trigger surface (a cosmetic feel-layer overlay + cue; no scoring /
PAR / leaderboards / identity / card-data / monetization). **Determinism note:**
the `src/vfx/` + audio consumers are hash-excluded presentation (D-24365) reading
projected `UIState` only — no `finalStateHash` / `PRE_WP080` / Seed-PAR / sim
movement. NG-1..7 preserved.

## Funding Surface Gate

N/A — a gameplay overlay, no funding affordance.

## API Catalog

N/A — no HTTP endpoint / `apps/server/src/**` library function.

---

## Acceptance Criteria

- [ ] The local seat's `woundCount` increasing flashes the red vignette + plays the
  thud once; a heal (decrease) does neither; an opponent's wound does neither.
  Asserted in `useWoundVfx.test.ts` / `useWoundCue.test.ts` / `VfxOverlay.test.ts`.
- [ ] Accessibility: `off` renders no vignette (and mutes the thud); reduced-motion
  and `low` render no vignette; the thud still plays at `low`.
- [ ] `pnpm -r build` 0; arena-client `vue-tsc` 0; arena-client suite passes.
- [ ] `wound-gained.mp3` GET-verified on R2; the generator reproduces the byte.
- [ ] ewiki Surface-1b "Wound gained" is shipped on both pages; `check-links` passes.
- [ ] No files outside the allowlist changed; no `packages/game-engine/**` diff.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
node apps/wiki-viewer/scripts/project-wiki.mjs; node apps/wiki-viewer/scripts/check-links.mjs
git diff --name-only   # only the allowlist
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  in a real deployed match, taking a Wound flashes the red vignette + plays the
  thud (green tests + merge alone do NOT satisfy it). ewiki updates live.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; arena-client `vue-tsc` + suite pass; no engine diff, no re-pin.
- [ ] No files outside the allowlist (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — land D-24462 (Active).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-650 checked off with today's date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write` refreshed.

---

## Reserved Decisions (land at execution)

- **D-24462 (reserved; Drafted 2026-09-05)** — the wound-gained damage vignette +
  thud (see the NUMBER-LEDGER reservation for the full text). Extends the
  Surface-1b design on `visual-effects.md`; mirrors WP-647/D-24459's consumer
  pattern; pure hash-excluded presentation, no engine change.

---

## See Also

- [WP-647](WP-647-shield-block-vfx-overlay-burst.md) / D-24459 — the shield-block beat this inverts
- [WP-556](WP-556-arena-client-vfx-foundation-combo.md) / D-24365 — the VFX foundation + determinism exemption
- `wiki/visual-effects.md §Surface-1b` — the proposed "wound gained" beat this ships
