# WP-647 — Shield-Block `VfxOverlay` Burst (the `strikeBlocked` shield effect on the play surface)

**Status:** Ready
**Primary Layer:** Arena Client (VFX layer — a `strikeBlocked` notable-event VFX consumer + the shield-block render in `VfxOverlay`) + ewiki (a "follow-on → shipped" doc flip)
**Dependencies:** WP-644/645/646 / D-24456..D-24458 (the `strikeBlocked` `NotableGameEvent` variant + its three `threatKind` values `masterStrike`/`schemeTwist`/`ambush` + the `NotableEventOverlay` "Blocked!" chip — **all on `main`**), WP-556 / D-24365 (the VFX foundation: `VfxOverlay.vue`, the module-signal consumer seam, `effectIntensity` `shouldRender`, `canvas-confetti`, the `src/vfx/` determinism exemption)

**User-Visible Surface:** `play.legendary-arena.com` + `ewiki.legendary-arena.com/visual-effects/`

> Baseline: `origin/main` @ `be99baad` (SPEC: draft WP-646 …, #1804) or later — the `strikeBlocked` event + all three `threatKind` values + the WP-556 VFX foundation are present. (WP-646's producer, #1805, is on `main`, so `'ambush'` blocks fire.)

---

## Session Context

The `strikeBlocked` event now fires at all three reveal-to-avoid moments —
Magneto / Dr. Doom Master Strikes (`masterStrike`), reveal-or-punish Scheme
Twists (`schemeTwist`), and villain Ambushes (`ambush`) — and the arena client
already raises a **"Blocked!"** center-screen **chip** for each
(`NotableEventOverlay`). What is *not* yet built is the **juice**: the
Captain-America-shield **particle burst** the [ewiki `#surface-block`
mock](../../wiki/visual-effects.md#surface-block) (`block-shield.svg`, PR #1797)
proposed — a shield spinning in to intercept, throwing the threat's energy back
off its face. The ewiki has said all along this is *"the follow-on — the same
engine signal now exists to drive it whenever a VFX WP wires it."* This is that WP.

WP-556 shipped the VFX foundation — a single full-bleed `VfxOverlay` with one
`canvas-confetti` canvas, a call-out word, and an impact pulse, all gated by the
`effectIntensity` accessibility contract — but wired **only** the combo flash
(`useComboVfx`, a scalar-change consumer). This WP adds the **first notable-event
VFX consumer**: a `strikeBlocked` **stream** consumer (`useStrikeBlockedVfx`, an
append-only cursor over `UIState.notableEvents`, mirroring `useNotableEventStream`
rather than the scalar `useComboVfx`) that drives a **shield-block beat** in the
same overlay — recoloured per `threatKind` (Master Strike red / Scheme Twist
purple / Ambush green). **Pure presentation:** it reads `UIState` only, never
`G`/`ctx`, and is absent from the determinism hash (the `src/vfx/` D-24365
exemption).

---

## Goal

After this session, when a `strikeBlocked` event lands in `UIState.notableEvents`
(a player revealed a Hero to block a Master Strike / Scheme Twist / Ambush), the
`VfxOverlay` fires a **shield-block beat** on `play.legendary-arena.com`:

1. a **Captain-America shield glyph** (concentric red/white/blue rings + a white
   star, an inline SVG) that **scales + spins in** at centre, holds briefly, and
   fades — the "intercept";
2. a **threat-coloured deflection burst** (`canvas-confetti` off the shared
   canvas, `colors` chosen by `threatKind`: red / purple / green) — the energy
   thrown back off the shield;
3. the **"BLOCKED!"** call-out word (the existing word layer).

Each element is independently gated by the `effectIntensity` `shouldRender`
contract: the burst is suppressed under `off` / reduced-motion, the shield's
**spin** is dropped there (but a **static shield** still shows unless `off`), and
the **"BLOCKED!" word still shows** as a plain fade — so the shield identity + the
reward stay legible without motion (RS-1). The append-only cursor emits one
composable-level beat **per new `strikeBlocked` event**; note the WP-556 seam is
a single module-signal `ref` the overlay `watch`es, so **several blocks appended
in the SAME frame** (a multi-player simultaneous block — the reveal-or-punish /
Magneto-skip paths append one event per blocking player in one move resolution)
coalesce to **one visible beat carrying the last `threatKind`** — an accepted v1
limitation, identical to the same-tick coalescing `useComboVfx` already documents;
blocks in **separate** frames render as separate beats. (A real sequential VFX
queue is deferred to a future WP, not this one.) No engine change — pure consumer
of the shipped event.

The ewiki `#surface-block` note flips from *"the VfxOverlay shield-block burst
remains the follow-on"* to *"shipped (WP-647)"*.

---

## User-Visible Impact

Blocking a threat stops feeling like a non-event: the shield swings in, the
threat's energy sprays off in its colour, and **"BLOCKED!"** punches on-screen —
the defensive payoff the shield-block mock promised, now live in real matches.

---

## Assumes

- WP-644/645/646 on `main`: the `strikeBlocked` variant is projected via
  `UIState.notableEvents` (public, wholesale); its `threatKind` is one of
  `'masterStrike' | 'schemeTwist' | 'ambush'` (all three producers ship). The
  client's `NotableGameEvent = UIState['notableEvents'][number]`
  (`useNotableEventStream.ts`) already carries the variant + `threatKind`.
- WP-556 / D-24365 on `main`:
  - `apps/arena-client/src/components/play/VfxOverlay.vue` — the single overlay
    with `fireBurst(particleCount)` (bound `canvas-confetti`), `showWord`,
    `pulseImpact`, `renderEvent` gated by `shouldRender`, watching a module
    signal; mounted once at `PlayViewport.vue`.
  - `apps/arena-client/src/vfx/effectIntensity.ts` — `useEffectIntensity()` →
    `{ shouldRender }`, `VfxKind = 'shake' | 'particles' | 'word'` (`'shake'` =
    full-intensity only; `'particles'` = suppressed under `off`/reduced-motion;
    `'word'` = always unless `off`).
  - `apps/arena-client/src/composables/useComboVfx.ts` — the module-signal +
    injectable-renderer consumer pattern this mirrors.
  - `canvas-confetti@^1.9.3` is installed and lazy-loaded off first-paint.
- `PlayViewport.vue` mounts `useComboVfx(audioSnapshot)` at the composable root
  (reading the `useUiStateStore` snapshot) and renders `<VfxOverlay />` once.
- `pnpm -r build` 0; arena-client suite + `vue-tsc` pass on `be99baad`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/arena-client/src/composables/useComboVfx.ts` — the exact consumer
  template: a module-level `ref` signal (`comboVfxSignal`) + a `useXSignal()`
  accessor + an injectable `render` seam (default publishes to the signal) + a
  monotonic `seq`. `useStrikeBlockedVfx` mirrors this, but over the
  **notableEvents STREAM** (append-only cursor), not the combo scalar.
- `apps/arena-client/src/composables/useNotableEventStream.ts` — the append-only
  cursor pattern to mirror: seed the cursor to `notableEvents.length` on the
  first valid frame (no replay of pre-mount history — the re-emission gate,
  D-20104), then, on each frame, emit for the new tail (`index >= cursor`),
  advancing the cursor. `useStrikeBlockedVfx` reuses this cursor discipline but
  filters to `event.type === 'strikeBlocked'` and publishes a VFX event carrying
  `threatKind`. The `NotableGameEvent` alias + `strikeBlocked`'s `threatKind`
  type live here (engine-derived) — derive the threat-kind type from the event
  (`Extract<NotableGameEvent, { type: 'strikeBlocked' }>['threatKind']`), never a
  fragile deep engine import.
- `apps/arena-client/src/components/play/VfxOverlay.vue` — add a second signal
  consumer (`useStrikeBlockedVfxSignal`) + a `renderShieldBlock(event)` that
  fires the shield glyph (gated `'shake'`), the threat-coloured burst (gated
  `'particles'`, passing `colors` from the manifest to `fireBurst`), and the
  "BLOCKED!" word (gated `'word'`). `fireBurst` gains an optional `colors?:
  readonly string[]` param (`readonly`, to accept the manifest's `readonly
  string[]` without a `vue-tsc` assignability error) and delegates the options
  build to a NEW **exported pure** `buildBurstOptions(particleCount, colors?:
  readonly string[])` — when `colors` is **undefined the `colors` key is OMITTED**
  from the returned confetti options, so the combo path keeps canvas-confetti's
  **default (multicolor) palette** exactly as today (it does NOT pass a gold
  default); the shield path passes the threat colours. **Why exported:**
  `confettiFire` is closure-local and, under jsdom, `getContext`→`null` makes
  `fireBurst` short-circuit **before** building any options object — so the
  combo-unchanged / shield-colours assertions are only writable against the pure
  `buildBurstOptions` (imported directly), NOT via a confetti spy (which would
  force an out-of-allowlist `jsdom-setup.ts` edit — copilot Finding 1). Add the
  shield glyph to the template (an inline SVG shown on `isShielding`, with a CSS
  scale+spin keyframe suppressed under `prefers-reduced-motion`).
- `apps/arena-client/src/vfx/comboVfxManifest.ts` — the manifest precedent
  (a typed `Record` of the tier → spec). `strikeBlockedVfxManifest.ts` mirrors
  it: `threatKind → { colors: string[] }` + the shared `BLOCKED_WORD`.
- `apps/arena-client/src/vfx/effectIntensity.ts` — the `shouldRender` gate; the
  shield-spin is `'shake'` (motion, full-intensity only), the burst `'particles'`,
  the word `'word'`.
- `apps/arena-client/src/pages/PlayViewport.vue` — mount `useStrikeBlockedVfx(
  audioSnapshot)` beside `useComboVfx(audioSnapshot)` (the composable root,
  reading the SAME `useUiStateStore` snapshot). This is the **one** `01.5`
  runtime-wiring line (cite `01.5-runtime-wiring-allowance.md`).
- `wiki/visual-effects.md` — the `#surface-block` note + the Surface-1 catalog
  row + the "not yet shipped" callout each say the shield-block `VfxOverlay`
  burst is the follow-on; flip to "shipped (WP-647)".
- `docs/ai/DECISIONS.md` — D-24365 (the VFX layer + its determinism exemption),
  D-24456 (the `strikeBlocked` event). Land D-24459 at execution.

---

## Non-Negotiable Constraints

**VFX-layer (always apply):**
- **Pure presentation.** Reads `UIState` only; never `G`/`ctx`; never a move.
  Absent from the determinism hash — bot-vs-bot sims and replays render no VFX
  (the `src/vfx/` D-24365 exemption; `Math.random`/timers/`canvas-confetti`
  permitted here **only** because it never bears on the replay hash).
- **Never throws into gameplay.** The confetti/canvas path is fail-soft (the
  WP-556 `ensureConfetti` guard); a headless/jsdom mount is a no-op.
- **Accessibility contract (mandatory).** Gated by `shouldRender`: the burst is
  `'particles'` (suppressed under `off` / reduced-motion); the **shield glyph
  shows whenever the word shows** (i.e. unless intensity is `off`), rendering
  **static** (no spin) when `shouldRender('shake')` is false and **spinning** only
  when it is true — so the shield IDENTITY survives reduced-motion / `low` the way
  the word does (RS-1), and only the *spin* (motion) is dropped; the word is
  `'word'` (still shows unless `off`, plain fade under reduced-motion). Disabled
  (`off`) degrades to **no effects at all**; `low` / reduced-motion degrade to a
  **static shield + "BLOCKED!" word** (+ the burst at `low`). Never a loss of
  gameplay.
- **Performance budget (WP-556, unchanged):** one shared canvas; `transform`/
  `opacity`-only animations; the shield-spin ≤ ~600ms; the burst uses the shared
  lazy-loaded confetti; no second canvas.

**Packet-specific:**
- One shield-block beat **per `strikeBlocked` event**, via the append-only
  cursor (no replay of pre-mount events on mount/reconnect — the D-20104
  re-emission gate `useNotableEventStream` already encodes).
- **Shared-primitive last-wins (accepted v1, copilot Finding 2).** The shield
  beat and the combo flash share the one word element + `wordTimer` + canvas +
  impact primitive (the single-overlay design). A shield beat firing while a
  combo word is still on-screen (within ~1.3s), or vice-versa, **replaces** the
  word slot and resets its timer — last beat wins. This is consistent with the
  WP-556 single-active-effect overlay; a per-effect VFX queue is deferred to the
  same future WP as the same-frame-coalescing queue.
- `threatKind` drives **only** the deflection-burst `colors` (and is the sole use
  of `threatKind` in the client). The shield glyph is Cap's fixed red/white/blue;
  the word is the constant **"BLOCKED!"**. No per-threat word/shield variance in
  v1.
- The manifest's `threatKind → colors` map is **exhaustive** over the three
  values via a keyed `Record<StrikeBlockThreatKind-derived, …>`; a future
  `threatKind` value (`'fight'`/`'escape'`) fails `vue-tsc` at the `Record` until
  mapped (the same exhaustive-pin discipline as `sfxManifest`).
- **No engine change; no new engine event; no `threatKind` value added** — pure
  consumer. Do NOT touch `packages/game-engine/**`.
- The combo path is unchanged — `fireBurst`'s new `colors?` param, when
  **undefined, omits the `colors` key** so canvas-confetti keeps its **default
  (multicolor) palette** (the combo burst today passes NO `colors` — it is NOT
  gold; gold is only the word + impact flash), and `useComboVfx` /
  `comboVfxManifest` are untouched. Do NOT introduce a gold or any fixed default
  — that would regress the combo burst.

**Locked values (do not re-derive):**
- Consumer: `useStrikeBlockedVfx(snapshot, render?)` + `useStrikeBlockedVfxSignal()`
  + `StrikeBlockedVfxEvent { threatKind, seq }`, mirroring `useComboVfx`.
- Call-out word: `BLOCKED_WORD = 'BLOCKED!'`.
- Burst colours (proposal): `masterStrike → ['#e23046', '#ff6b6b', '#ffffff']`;
  `schemeTwist → ['#8a4dff', '#b57bff', '#ffffff']`; `ambush → ['#3bd16f',
  '#7be0a0', '#ffffff']` (matching the ewiki red / purple / green).
- Shield glyph: Cap's concentric red (`#c0182f`) / white (`#eeeae0`) / red / blue
  (`#123f8f`) rings + a white star (reuse the `block-shield.svg` vector).

---

## Scope (In)

### A) Client — the manifest (`apps/arena-client/src/vfx/strikeBlockedVfxManifest.ts`, **new**)
- Export `STRIKE_BLOCKED_VFX: Record<ThreatKind, { colors: readonly string[] }>`
  keyed exhaustively over the three `threatKind` values (derived from the event
  type, not a deep engine import) + `BLOCKED_WORD = 'BLOCKED!'`. Mirrors
  `comboVfxManifest.ts`.

### B) Client — the consumer (`apps/arena-client/src/composables/useStrikeBlockedVfx.ts`, **new**)
- A module signal `strikeBlockedVfxSignal` + `useStrikeBlockedVfxSignal()` + an
  injectable `render` seam (default publishes to the signal), mirroring
  `useComboVfx`. `useStrikeBlockedVfx(snapshot, render?)` keeps an append-only
  cursor over `UIState.notableEvents` (seed to length on the first valid frame),
  and for each new `event.type === 'strikeBlocked'` emits one
  `StrikeBlockedVfxEvent { threatKind: event.threatKind, seq }`. Pure — reads
  `UIState` only.

### C) Client — the render (`apps/arena-client/src/components/play/VfxOverlay.vue`, **modified**)
- Consume `useStrikeBlockedVfxSignal()`; a `renderShieldBlock(event)` shows the
  shield glyph (whenever `shouldRender('word')` — i.e. unless `off`; it renders
  **static** and only **spins** when `shouldRender('shake')`, so the identity
  survives `low` / reduced-motion — RS-1), fires
  `fireBurst(count, STRIKE_BLOCKED_VFX[event.threatKind].colors)` (gated
  `'particles'`), and `showWord(BLOCKED_WORD)` (gated `'word'`).
  `fireBurst` gains an optional `colors?: readonly string[]` param (`readonly`,
  to accept the manifest's `readonly string[]`) and delegates its options build to
  a NEW **exported pure** `buildBurstOptions(particleCount, colors?)` that OMITS
  the `colors` key when `colors` is undefined (→ the combo's default multicolor
  palette is unchanged). `buildBurstOptions` is exported so the tests assert the
  key presence/absence on it directly — the jsdom `getContext`→`null`
  short-circuit makes the confetti options unobservable via a spy (copilot
  Finding 1). Add the shield glyph to the template (inline SVG shown on
  `isShielding`) + a CSS scale+spin keyframe, suppressed under
  `prefers-reduced-motion`.

### D) Client — the wiring (`apps/arena-client/src/pages/PlayViewport.vue`, **modified** — `01.5`)
- Mount `useStrikeBlockedVfx(audioSnapshot)` beside `useComboVfx(audioSnapshot)`
  at the composable root (same `useUiStateStore` snapshot). One runtime-wiring
  line, authorized here per `01.5-runtime-wiring-allowance.md`.

### E) Client tests
- `strikeBlockedVfxManifest.test.ts` — **new**: exhaustive over the three
  `threatKind` values; each maps to a non-empty `colors` array; `BLOCKED_WORD`.
- `useStrikeBlockedVfx.test.ts` — **new**: seeds the cursor (no emit for
  pre-mount events); one emit per new `strikeBlocked` (with the right
  `threatKind`) captured via an injected recording renderer (the composable emit
  count, not a visible-beat count); non-`strikeBlocked` events emit nothing; a
  reconnect / full snapshot refresh replays nothing (the cursor discipline).
- `VfxOverlay.test.ts` — **modified**: a `strikeBlocked` signal renders the
  shield glyph + the "BLOCKED!" word (and the burst is attempted) with full
  intensity; under `off` / reduced-motion the shield + burst are suppressed while
  the word still shows; the combo path is unchanged — asserted by importing the
  exported `buildBurstOptions` and checking `buildBurstOptions(count)` omits the
  `colors` key while `buildBurstOptions(count, [...])` includes it (no confetti
  spy, no `jsdom-setup.ts` edit — copilot Finding 1).

### F) Docs / ewiki (`wiki/visual-effects.md`, **modified**)
- Flip the **five** places that frame the shield-block `VfxOverlay` burst as the
  follow-on — **three prose passages + two table rows** (the burst has no
  *dedicated* Surface-1 catalog row, but its follow-on framing lives in two rows,
  pre-flight RISK): the **"not yet shipped" callout** (~lines 167–175); the
  **`#surface-block` shipped-note** (~lines 714–738, esp. the "…**VfxOverlay**
  burst below … is the **follow-on**" sentence ~723–726); the **Decisions-Pending
  RESOLVED callout** (~1021–1027); the **Future-priority table row** (~line 416,
  the "the shield particle burst is the follow-on" sub-clause in the T3/Future
  row); and the **Surface-1 `strikeBlocked` catalog row** (~line 449, the "the
  shield `VfxOverlay` burst … is the follow-on" sub-clause). Flip ALL FIVE so the
  page does not simultaneously say "shipped (WP-647)" and "follow-on".
  The shield-block **`VfxOverlay` burst** now ships (WP-647) — the shield glyph
  (spin gated by intensity) + threat-coloured deflection burst + "BLOCKED!" word,
  recoloured per `threatKind`, gated by the Effect-Intensity contract.
- **While in the file (pre-existing drift, RS-3):** the Surface-1 notableEvents
  catalog intro (~line 244) still says "**seven** locked variants" — stale; the
  union is now **nine** (the seven-era count already included `bystanderRevealed`;
  the two added since are `deckReshuffled` + `strikeBlocked`). Correct the count
  in passing.

---

## Out of Scope

- **No engine change** — pure consumer of the shipped `strikeBlocked` event.
- **No new notable-event VFX effects** (Master Strike shake, mastermind-defeat
  bloom, etc.) — this WP ships only the shield-block beat. A future WP may
  generalize `useStrikeBlockedVfx` into a `useNotableEventVfx` dispatcher when a
  second notable-event effect lands (duplicate-first, abstract-on-third).
- **No per-threat word / shield variance** — the word is the constant "BLOCKED!",
  the shield is Cap's fixed colours; only the burst recolours.
- **No `onFight`/`onEscape` coverage** — those reveal-avoidances are not yet
  `strikeBlocked` producers (separate engine WPs).
- **No second canvas / no new dependency / no combo-path change.**

---

## Files Expected to Change

- `apps/arena-client/src/vfx/strikeBlockedVfxManifest.ts` — **new** — the `threatKind → colors` map + `BLOCKED_WORD`
- `apps/arena-client/src/vfx/strikeBlockedVfxManifest.test.ts` — **new** — exhaustive + non-empty colours
- `apps/arena-client/src/composables/useStrikeBlockedVfx.ts` — **new** — the notableEvents-stream shield consumer + signal seam
- `apps/arena-client/src/composables/useStrikeBlockedVfx.test.ts` — **new** — cursor seed / one-beat-per-event / non-strikeBlocked / reconnect
- `apps/arena-client/src/components/play/VfxOverlay.vue` — **modified** — the shield glyph + threat-coloured burst + word render + the new signal consumer + the exported pure `buildBurstOptions(count, colors?)`
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` — **modified** — shield render + intensity gating + combo-path-unchanged (asserted on `buildBurstOptions`)
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified (01.5 wiring)** — mount `useStrikeBlockedVfx(audioSnapshot)`
- `wiki/visual-effects.md` — **modified** — flip all five follow-on places (3 prose + 2 table rows) to shipped (WP-647) + the seven→nine count

No other **feature** files may be modified. The `git diff --name-only` DoD gate
covers the feature diff above; the governance / generated artifacts the
Definition of Done requires — `STATUS.md`, `DECISIONS.md` (land D-24459),
`WORK_INDEX.md`, `05-ROADMAP-MINDMAP.md` (+ its regenerated count table) — ride
the `SPEC:` governance-close commit and are **exempt** from this feature
allowlist (the universal repo pattern; RS-2). No `packages/game-engine/**` diff
(pure client consumer).

---

## Vision Alignment

N/A — no §17.1 trigger surface (no scoring/PAR/leaderboards, identity,
multiplayer sync, card-data, or monetization). **Determinism:** the VFX layer is
**excluded from the hash** (D-24365) — it reads projected `UIState` only, writes
no `G`/`ctx`, and renders nothing in bot-vs-bot sims / replays; adding a second
`UIState` consumer changes no determinism surface. NG-1..7 preserved (cosmetic
juice for a shared-board event; no pay-to-win, no PvP).

## Funding Surface Gate

N/A — no funding affordance/channel/copy; gameplay juice.

## API Catalog

N/A — no HTTP endpoint / `apps/server/src/**` library function; a client-only VFX
consumer of the boardgame.io state push.

---

## Acceptance Criteria

- [ ] A `strikeBlocked` event in `UIState.notableEvents` fires one shield-block
  beat: the shield glyph + a threat-coloured burst + the "BLOCKED!" word, one
  composable-level emit per event, via the append-only cursor (no replay of
  pre-mount events on mount / reconnect). Simultaneous same-frame blocks coalesce
  at the module signal to a single visible beat (last `threatKind`) — the
  documented v1 limitation; the "one beat per event" test asserts the
  **composable emit count** via the recording renderer, not a visible-beat count.
- [ ] `threatKind` selects the burst `colors` (red / purple / green); the
  manifest `Record` is exhaustive over the three values (a future value fails
  `vue-tsc`). The word is the constant "BLOCKED!"; the shield is Cap's colours.
- [ ] Full parity with the accessibility contract: under `off` no VFX renders;
  under `low` / reduced-motion the shield's spin + (under reduced-motion) the
  burst are suppressed while a **static shield + the "BLOCKED!" word still show**
  (RS-1); no loss of gameplay in any mode.
- [ ] The combo path (`useComboVfx` / `comboVfxManifest` / the combo burst) is
  unchanged; `buildBurstOptions(count)` (no `colors` arg) returns options with
  **no `colors` key** — the default multicolor palette — while
  `buildBurstOptions(count, [...])` includes it. Asserted directly on the exported
  `buildBurstOptions` (NOT via a confetti spy, NOT that it is gold), so the test
  needs no `jsdom-setup.ts` edit (copilot Finding 1).
- [ ] No `packages/game-engine/**` change.
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) 0; `pnpm --filter
  arena-client test` passes; `pnpm -r build` 0.
- [ ] `wiki/visual-effects.md` marks the shield-block `VfxOverlay` burst shipped
  (WP-647).
- [ ] No files outside the allowlist changed (`git diff --name-only`).

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0

pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: vue-tsc 0; all tests pass

Select-String -Path "apps\arena-client\src\pages\PlayViewport.vue" -Pattern "useStrikeBlockedVfx"
# Expected: exactly one mount

git diff --name-only
# Expected: only files in ## Files Expected to Change; no packages/game-engine/** diff
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
  D-24026):** in a **real deployed match**, blocking a threat (reveal a Hero vs a
  Magneto/Doom strike, a reveal-or-punish twist, or a villain Ambush) fires the
  shield-block beat — shield glyph + threat-coloured burst + "BLOCKED!" — on the
  deployed bundle (green tests + merge alone do NOT satisfy it). The ewiki
  `#surface-block` update is live.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; arena-client
  suite passes.
- [ ] No files outside the allowlist changed (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — the shield-block VfxOverlay burst ships.
- [ ] `docs/ai/DECISIONS.md` — land D-24459 (Active).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-647 checked off with today's date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write` refreshed.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections; `Out of Scope` lists ≥2 (no engine change, no general useNotableEventVfx, no per-threat word variance, no onFight/onEscape, no second canvas/dep).
- **§2 Constraints** — PASS. VFX-layer + packet-specific + locked values; references WP-556 / D-24365 + the accessibility contract + `01.5`.
- **§3 Assumes** — PASS. WP-644/645/646 + WP-556 named with exact exports/paths; green baseline `be99baad`.
- **§4 Context** — PASS. `useComboVfx` + `useNotableEventStream` + `VfxOverlay` + `effectIntensity` + `PlayViewport` + the manifest precedent. No `00.2` (a runtime VFX consumer, not card-data).
- **§5 Files** — PASS. 8 files (2 new composable/manifest + their 2 tests + `VfxOverlay` + its test + `PlayViewport` wiring + wiki). A genuine new client feature on the WP-556 foundation; each edit small and named.
- **§6 Naming** — PASS. `useStrikeBlockedVfx`, `strikeBlockedVfxSignal`, `StrikeBlockedVfxEvent`, `STRIKE_BLOCKED_VFX`, `BLOCKED_WORD`, `renderShieldBlock`; no abbreviations.
- **§7 Dependencies** — PASS. No new npm dep (`canvas-confetti` already installed).
- **§8 Boundaries** — PASS. Client-only VFX consumer; reads projected `UIState`; no engine change; `threatKind` type derived from the event (no deep engine import). The `01.5` wiring is the single authorized runtime-wiring line.
- **§9 Windows** — PASS. `pwsh` `Select-String`.
- **§10 Env / §11 Auth** — N/A.
- **§12 Tests** — PASS. arena-client `node:test` + `@vue/test-utils` + `jsdom`; no `boardgame.io/testing`. The confetti path is fail-soft in jsdom (WP-556 precedent).
- **§13 Verification** — PASS. Exact `pnpm` commands; the `vue-tsc` gate; the wiring grep; the no-engine-diff scope check.
- **§14 Acceptance criteria** — PASS. Binary; the per-event beat + the threat recolour + the accessibility gating + combo-unchanged pinned.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap + scope check; live-on-surface (D-24026).
- **§16 Code style** — PASS. Mirrors the `useComboVfx` seam; explicit; no abbreviations; the exhaustive `Record` pin.
- **§17 Vision** — N/A (declared) + the determinism note: the VFX layer is hash-excluded (D-24365); a second `UIState` consumer changes no determinism surface; sims/replays render no VFX.
- **§18 Prose-vs-grep** — PASS. The wiring grep targets `PlayViewport.vue` for `useStrikeBlockedVfx`; the WP prose is out of that file's scope.
- **§19 Bridge staleness** — N/A.
- **§20 Funding** — N/A.
- **§21 API Catalog** — N/A.

**Lint verdict: PASS (all 21 resolved; 7 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**VERDICT: READY TO EXECUTE** (independent pre-flight, re-run 2026-09-04).

The first pass returned **NOT READY** on one blocking defect + three
risk-suggestions; all are folded in and the re-run verifies clean against source:

- **PS-1 (blocking, FIXED)** — the draft claimed the combo `fireBurst` "defaults
  to gold." False against `VfxOverlay.vue:94-107`: `fireBurst(particleCount)`
  builds the confetti options with **no `colors` key** → canvas-confetti's default
  multicolor palette. Gold (`#ffe082` / `rgba(255,224,130)`) appears **only** on
  the word (`.vfx-overlay__word`, line 247) and the impact flash
  (`.vfx-overlay__impact`, lines 213-217). Purged everywhere: the new `colors?`
  param **omits** the `colors` key when undefined, and the combo-unchanged test
  pins the absent key — NOT gold.
- **RS-1 (FIXED)** — the shield GLYPH shows whenever the word shows (unless
  `off`), rendered **static** and **spinning only** when `shouldRender('shake')`,
  so the shield identity survives `low` / reduced-motion the way the word does
  (only the *spin* is gated `'shake'`). Consistent with `effectIntensity.ts`
  (`word` = true unless off; `shake` = full-and-not-reduced-motion).
- **RS-2 (FIXED)** — the `git diff --name-only` allowlist covers the **feature**
  diff; the governance / generated artifacts (`STATUS`/`DECISIONS`/`WORK_INDEX`/
  mindmap + counts) ride the `SPEC:` close and are exempt (the universal pattern).
- **RS-3 (FIXED)** — the ewiki flip targets **three** follow-on passages
  (~167-175 callout, ~723-726 `#surface-block` note, ~1021-1027 Decisions-Pending),
  NOT a Surface-1 table row; plus the stale "seven → nine" variant-count at ~244.
- **RS-A (cosmetic, FIXED)** — the seven→nine parenthetical originally over-counted
  (`bystanderRevealed` was already in the seven-era count); corrected to name the
  two genuinely added since (`deckReshuffled` + `strikeBlocked`).

Every other load-bearing claim (paths, exports, the append-only cursor + D-20104
seed, the exhaustive three-value `Record`, the engine `threatKind` union, the
`01.5` wiring precedent, the `ensureConfetti` fail-soft guard) verified TRUE
against source. Baseline confirmed `origin/main` @ `e75b0fa3` (≥ the `be99baad`
floor; WP-644/645/646 producers all merged).

---

## Copilot Check (01.7)

**VERDICT: RISK** (independent adversarial copilot, 2026-09-04) — two non-blocking
findings, both folded in; neither touches gameplay, determinism, a contract
boundary, or the file allowlist (scope-neutral, so no pre-flight re-run).

- **Finding 1 (same-frame multi-block coalescing; FIXED in prose)** — the WP-556
  seam is a single module-signal `ref` the overlay `watch`es, so N `strikeBlocked`
  events appended in **one frame** (a multi-player simultaneous block) collapse to
  **one visible beat carrying the last `threatKind`** (Vue flushes the watch once
  with the last assignment). The draft's "several beats" promise was corrected to
  the truth: one composable-level emit per event, but same-tick blocks coalesce to
  a single visible beat — an **accepted v1 limitation** identical to the same-tick
  coalescing `useComboVfx` already documents; a real sequential VFX queue is a
  future WP. The `useStrikeBlockedVfx.test.ts` "one per event" assertion is a
  **composable emit count** (via the recording renderer), not a visible-beat count.
- **Finding 2 (manifest `readonly string[]` vs `colors?: string[]`; FIXED)** — the
  locked `fireBurst` param is now typed `colors?: readonly string[]` so the
  manifest's `readonly string[]` flows in without a `vue-tsc` assignability error.

Copilot-cleared angles (evidence in the copilot pass): `fireBurst` has exactly one
existing caller (the combo path — "combo unchanged" holds); the
`Extract<…>['threatKind']` derivation resolves to the three-value union at the
`UIState` boundary (uiState.filter.ts passes `notableEvents` wholesale, no
widening) so the exhaustive `Record` really does fail `vue-tsc` on a 4th value;
the new consumer's cursor is independent of the chip's `useNotableEventStream`
cursor (distinct module signals, distinct local cursors — no interference);
reconnect / shorter-array is safe (append-only within a match, D-20004; a
wholesale-replaced array yields zero iterations, no re-fire); and the RS-1 gating
matrix has no burst-without-shield / shield-without-word state.

### Post-merge re-run (2026-09-05, against the committed WP+EC)

The in-turn gates above ran against working-tree drafts; several edits landed
**after** the copilot pass (the `readonly` widening, the coalescing prose, the
gold cleanup), so a fresh pre-flight + copilot were run against the **committed**
WP-647 / EC-682 (PR #1806, now merged to `origin/main` @ `064e8490`). Both
verdicts and their folds are captured here; the corrections land as a follow-up
`SPEC:` commit on top of the merged draft.

- **Pre-flight (re-run): READY.** All four post-copilot edits verified internally
  consistent and true against source; every "gold" occurrence is a correct
  negation; the `readonly` param assigns cleanly (`VfxOverlay.vue:59` types the
  confetti options `Record<string, unknown>`). **One non-blocking ewiki RISK:**
  the flip scope named three prose passages but **two table rows** (~416
  Future-priority, ~449 Surface-1 `strikeBlocked` catalog) also frame the burst as
  "the follow-on" — flipping only the three would ship a self-contradictory page.
  **FOLDED:** Scope F now flips all five places.
- **Copilot (re-run): RISK, both folded.**
  - **Finding 1 (execution-blocking → FIXED):** the mandated "combo `fireBurst`
    passes no `colors` key" assertion is **not writable** — `confettiFire` is
    closure-local and jsdom's `getContext`→`null` short-circuits `fireBurst`
    before the options object is built, so an executor could only assert it by
    editing out-of-allowlist `jsdom-setup.ts` or faking it. **FOLDED:** extract an
    **exported pure `buildBurstOptions(count, colors?)`** in `VfxOverlay.vue` that
    omits the `colors` key when undefined; the test imports and asserts on it
    directly — no confetti spy, no jsdom edit, in-allowlist.
  - **Finding 2 (accepted v1 limit → documented):** the shield beat and combo
    flash share the one word element + `wordTimer` + canvas + impact, so a beat
    within ~1.3s of another replaces the word slot (last wins). **FOLDED:** a
    shared-primitive last-wins constraint added to Packet-specific + D-24459,
    consistent with the single-overlay v1 design.
  - Copilot-cleared (evidence in the pass): the recording-renderer test seam is
    writable (`useComboVfx.test.ts` precedent); `seq` is redundant-but-harmless
    (each emit is a fresh object literal, so `watch` fires on reference change);
    two independent signal `watch`es don't clobber each other; the burst fires at
    `low` identically to the combo (`shouldRender('particles')` is `true` at
    `low`); and `block-shield.svg`'s `<g class="shield">` subtree is a
    self-contained glyph with the locked colours (the EC cites the exact path).

---

## Reserved Decisions (land at execution)

- **D-24459 (reserved; Drafted 2026-09-04, not yet landed)** — The shield-block
  **`VfxOverlay` burst** — the juice the ewiki `#surface-block` mock proposed and
  the `strikeBlocked` event (D-24456..D-24458) was built to drive — ships on the
  WP-556 VFX foundation. A new **notable-event VFX consumer** `useStrikeBlockedVfx`
  keeps an append-only cursor over `UIState.notableEvents` (mirroring
  `useNotableEventStream`, not the scalar `useComboVfx`) and, per new
  `strikeBlocked` event, publishes a `StrikeBlockedVfxEvent { threatKind, seq }`
  to a module signal the `VfxOverlay` renders as a shield-block beat: a
  Captain-America shield glyph spinning in, a **threat-coloured** deflection
  burst (`canvas-confetti`, `colors` per `threatKind` — red `masterStrike` /
  purple `schemeTwist` / green `ambush`), and the constant **"BLOCKED!"** word.
  Every element is gated by the WP-556 `effectIntensity` `shouldRender` contract
  (shield-spin + burst suppressed under `off` / reduced-motion; the shield glyph
  itself + the word still show). Simultaneous same-frame blocks coalesce at the
  single module signal to one visible beat (last `threatKind`), and — because the
  shield beat and the combo flash share the one word element / timer / canvas /
  impact primitive — a beat firing while another is on-screen replaces the word
  slot (last wins); both are accepted v1 limitations of the single-overlay design
  matching `useComboVfx`, with a per-effect VFX queue deferred to a future WP.
  `threatKind` is the sole client use of that field, and its manifest
  `Record` is exhaustive over the three values (a future value fails `vue-tsc`).
  **Pure presentation** — reads `UIState` only, writes no `G`/`ctx`, and is
  absent from the determinism hash (the `src/vfx/` D-24365 exemption); sims /
  replays render no VFX. `PlayViewport` mounts the consumer beside `useComboVfx`
  (one `01.5` runtime-wiring line). No engine change; the combo path is
  unchanged: `fireBurst`'s new `colors?` OMITS the `colors` key when undefined,
  so the combo burst keeps canvas-confetti's default multicolor palette — it is
  not, and must not become, gold. A future WP may generalize the consumer into a
  `useNotableEventVfx` dispatcher when a second notable-event effect lands.

---

## See Also

- [WP-644](WP-644-strike-blocked-notable-event.md) / D-24456..D-24458 — the `strikeBlocked` event + its three `threatKind` producers this VFX consumes
- WP-556 / D-24365 — the VFX foundation (`VfxOverlay`, `effectIntensity`, `useComboVfx`, the `src/vfx/` determinism exemption) this builds on
- `wiki/visual-effects.md §#surface-block` — the shield-block mock (`block-shield.svg`, PR #1797) this WP realizes on the play surface
