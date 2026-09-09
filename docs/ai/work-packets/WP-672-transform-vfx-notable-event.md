# WP-672 — Transform VFX (the `transformResolved` notable event + the gamma-green power-surge beat)

**Status:** Done
**Primary Layer:** Cross-layer — Game Engine (a new `transformResolved` `NotableGameEvent` variant emitted at the Hero-transform fire site) + Arena Client (a new notable-event VFX consumer + the transform render in `VfxOverlay`)
**Dependencies:** WP-658 / D-24469 + WP-665 / D-24476 (the Hero Transform swap runtime `heroEffectTransform`, on `main`), WP-644 / D-24456 + WP-647 / D-24459 (the `strikeBlocked` notable event + its `VfxOverlay` consumer — the exact engine-event → VFX-consumer pattern this mirrors), WP-556 / D-24365 (the VFX foundation: `VfxOverlay.vue`, the module-signal consumer seam, `effectIntensity` `shouldRender`, `canvas-confetti`, the `src/vfx/` determinism exemption)

**User-Visible Surface:** `play.legendary-arena.com` + `ewiki.legendary-arena.com/visual-effects/` + `ewiki.legendary-arena.com/transform/`

> Baseline: `origin/main` @ `26db00e7` (EC-703: collapse the Transform Deck …, #1928) or later — the Hero Transform runtime, the nine-variant notable-event union, and the WP-556 VFX foundation are all present.

---

## Session Context

Transform is the signature mechanic of the World War Hulk (`wwhk`) set — a Hero
base card meeting its printed condition and **swapping into a stronger second
form** (She-Hulk's *Hurl Legal Objections → Hurl Trucks*, Amadeus Cho's
*Gamma-Draining Nanites → Like Totally Smart Hulk* are the two supported bases
today). The swap is modeled and shipped (`heroEffectTransform`, WP-658 / WP-665),
but it lands **silently** — a game-log line only, no notable event and no juice.
`G.messages` is not projected to clients, so the arena client had **no signal**
to celebrate a transform.

The VFX Trigger Contract ([ewiki `visual-effects`](../../wiki/visual-effects.md))
forbids the juice layer from inventing gameplay events (Invariant #6): a flash
MUST ride an engine-projected signal. None of the nine locked
`NotableGameEventType` variants carries a transform, so — exactly as the shield
block did (WP-644 engine event → WP-647 client beat) — this WP adds the **tenth**
variant and a matching VFX consumer, as one cross-layer packet.

---

## Goal

After this session, when a Hero base card transforms in a real match, the engine
emits a `transformResolved` notable event and the arena client fires a **transform
beat** on `play.legendary-arena.com`:

1. a **gamma-green "power surge"** — a centre-out radial bloom swelling as the hero
   powers up (a CSS `opacity`/`transform` bloom, gated `shouldRender('shake')`);
2. a **gamma-green particle burst** (`canvas-confetti` off the shared canvas, the
   radioactive-green palette, gated `shouldRender('particles')`);
3. the **"TRANSFORMED!"** call-out word (the existing word layer, gated
   `shouldRender('word')`).

The `NotableEventOverlay` also raises a **"Transformed!"** centre-screen chip (the
free Surface-1 win) with a gamma-green accent.

---

## User-Visible Impact

Powering up stops feeling like a log line: the board flushes gamma green, the
hero's energy sprays out, and **"TRANSFORMED!"** punches on-screen — the payoff
the set's whole mechanic is built around, now visible in real matches.

---

## What Shipped (this session executed the arc)

- **Engine.** `transformResolved` is the tenth `NotableGameEventType` (union +
  `NOTABLE_EVENT_TYPES` array + the drift test, all in lockstep — ten entries).
  `TransformResolvedEvent` is a **minimal payload** `{ type, playerId, narrative }`
  (no card id — like `healResolved` / `deckReshuffled`; the base + second-form
  names travel in the composed narrative). `composeTransformNarrative(baseName,
  secondFormName)` returns the byte-stable `"<base>" transformed into "<second
  form>".`. `heroEffectTransform` pushes it as the **last** step of a completed
  swap (after the second-form is in play and the `applied` log line is pushed),
  **guarded** (`if (Array.isArray(G.notableEvents))`, never throws on a minimal
  mock). It is **NOT** pushed on the AC-5 exhaustion soft no-op.
- **Client.** `transformVfxManifest.ts` (a gamma-green palette + the constant
  `TRANSFORMED!` word), `useTransformVfx.ts` (an append-only `notableEvents` cursor
  filtering to `transformResolved`, the D-20104 re-emission gate — a mirror of
  `useStrikeBlockedVfx`), a **fourth `VfxOverlay` consumer** (the surge bloom +
  burst + word, each gated by the WP-556 accessibility contract), the
  `PlayViewport` wiring line, the `NotableEventOverlay` "Transformed!" chip +
  accent, and the `sfxManifest` `transform.mp3` entry (operator-pending byte).
- **Scope (v1).** Only the **Hero** transform surface emits the event.

---

## Non-Negotiable Constraints

**Engine (always apply):**
- **Determinism.** `G.notableEvents` **is** serialized by `computeStateHash` (only
  `G.diagnostics` is excluded, D-24294), so a new push is hash-relevant wherever a
  transform actually fires. But **no committed replay / sentinel fixture performs a
  transform** — the sentinel predates `wwhk` — so there is **NO hash re-pin**,
  verified empirically (23 replay/sentinel tests green; full engine suite green).
- **Handlers never throw.** The push is guarded on `Array.isArray(G.notableEvents)`
  — a minimal test mock omitting the array is a silent skip (mirrors the handler's
  existing `transformTargets` / `transformDeck` guards).
- **Emit only on a completed swap.** The AC-5 exhaustion path (`blocked` log,
  no swap) emits nothing — a swap that did not happen is not a transform.
- **Minimal payload (D-20001).** `{ type, playerId, narrative }` — no `eventId` /
  `seq` / `timestamp` / card id; names resolve at the fire site via
  `G.cardDisplayData` (composer stays pure) with a raw-ext_id fallback.

**VFX-layer (always apply):**
- **Pure presentation.** Reads `UIState` only; never `G`/`ctx`; never a move.
  Absent from the determinism hash (the `src/vfx/` D-24365 exemption).
- **Never throws into gameplay.** The confetti/canvas path is fail-soft (the
  WP-556 `ensureConfetti` guard); a headless/jsdom mount is a no-op.
- **Accessibility contract (mandatory).** Gated by `shouldRender`: the burst is
  `'particles'` (suppressed under `off` / reduced-motion); the surge bloom is the
  full-screen `'shake'` class (full intensity only, off under reduced-motion — the
  wound-vignette precedent); the **"TRANSFORMED!" word still shows** as a plain
  fade unless intensity is `off`. Never a loss of gameplay.
- **Performance budget (WP-556, unchanged):** one shared canvas; `transform`/
  `opacity`-only animations; the surge bloom within the ≤500ms budget; the shared
  lazy-loaded confetti; no second canvas.

**Packet-specific:**
- One transform beat **per `transformResolved` event**, via the append-only cursor
  (no replay of pre-mount events on mount / reconnect — the D-20104 gate). Same-frame
  transforms coalesce at the single module signal to one visible beat — the accepted
  v1 limitation `useStrikeBlockedVfx` / `useComboVfx` already document.
- The transform beat, the shield beat, and the combo flash share the one word
  element + `wordTimer` + canvas + surge/impact primitives (single-overlay design);
  a beat within ~1.3s replaces the word slot (last wins) — accepted v1.
- **A transform has no sub-kind** — unlike `strikeBlocked`'s `threatKind`, the
  event carries only `playerId` + `narrative`, so the VFX event is a plain `{ seq }`
  and the manifest is a single spec, not a `Record`.
- The combo path is **unchanged** — `fireBurst`'s `colors?` param already omits the
  key when undefined (WP-647); the transform passes its gamma palette explicitly.

**Locked values (do not re-derive):**
- Event: `TransformResolvedEvent { type: 'transformResolved', playerId, narrative }`.
- Narrative: `composeTransformNarrative(base, target)` → `"<base>" transformed into "<target>".`.
- Consumer: `useTransformVfx(snapshot, render?)` + `useTransformVfxSignal()` +
  `TransformVfxEvent { seq }`, mirroring `useStrikeBlockedVfx`.
- Call-out word: `TRANSFORM_WORD = 'TRANSFORMED!'`.
- Burst palette: `TRANSFORM_VFX.colors = ['#5ee66b', '#a6ff7a', '#eaffd0']` (a
  radioactive gamma green distinct from every other effect's colours).

---

## Scope (In)

### A) Engine — the event type (`packages/game-engine/src/events/notableEvents.types.ts`)
- Add `'transformResolved'` to the `NotableGameEventType` union + the
  `NOTABLE_EVENT_TYPES` canonical array (ten entries) + `TransformResolvedEvent`
  interface + the `NotableGameEvent` union. Update the header/why comments (nine → ten).

### B) Engine — the narrative (`packages/game-engine/src/events/notableEvents.compose.ts`)
- Add pure `composeTransformNarrative(baseName, secondFormName)` — byte-stable.

### C) Engine — the emit (`packages/game-engine/src/hero/heroEffects.execute.ts`)
- After the `applied` transform log push, resolve base + second-form display names
  (via a new local `resolveTransformCardName`, the bystander-site precedent) and
  **guarded**-push the `transformResolved` event. Import `composeTransformNarrative`.

### D) Engine tests
- `notableEvents.types.test.ts` — ten entries + a `TransformResolvedEvent` round-trip.
- `notableEvents.compose.test.ts` — the transform narrative + purity.
- `heroEffects.execute.test.ts` — the emit fires on a completed swap (right
  `playerId` + narrative names both cards); NO emit on the AC-5 exhaustion no-op.

### E) Client — the manifest (`apps/arena-client/src/vfx/transformVfxManifest.ts`, **new**)
- `TRANSFORM_VFX: { colors: readonly string[] }` (the gamma palette) + `TRANSFORM_WORD`.

### F) Client — the consumer (`apps/arena-client/src/composables/useTransformVfx.ts`, **new**)
- A module signal + `useTransformVfxSignal()` + an injectable `render` seam; an
  append-only cursor over `UIState.notableEvents` filtering to `transformResolved`,
  emitting `TransformVfxEvent { seq }`. Mirrors `useStrikeBlockedVfx`.

### G) Client — the render (`apps/arena-client/src/components/play/VfxOverlay.vue`, **modified**)
- A fourth signal consumer + a `renderTransform()` that shows the "TRANSFORMED!"
  word (gated `'word'`), the gamma burst (gated `'particles'`), and the surge bloom
  (gated `'shake'`). Add the `.vfx-overlay__surge` element + keyframes +
  reduced-motion suppression.

### H) Client — the wiring (`apps/arena-client/src/pages/PlayViewport.vue`, **modified** — `01.5`)
- Mount `useTransformVfx(audioSnapshot)` beside the other feel consumers.

### I) Client — the chip + SFX
- `NotableEventOverlay.vue` — a `transformResolved: 'Transformed!'` chip label + a
  gamma accent block. `sfxManifest.ts` — a `transform.mp3` entry (the exhaustive
  `Record` forces it; byte operator-pending) + its drift test (ten keys).

### J) Client tests
- `transformVfxManifest.test.ts` — **new**; `useTransformVfx.test.ts` — **new**
  (cursor seed / one-per-event / non-transform / reconnect); `VfxOverlay.test.ts`
  — **modified** (surge + word at full; word-survives-suppressed-surge at low /
  reduced-motion; off renders nothing); `NotableEventOverlay.test.ts` — **modified**
  (the "Transformed!" chip + verbatim narrative, no card-name row); `sfxManifest.test.ts`
  — **modified** (ten keys).

---

## Out of Scope

- **Mastermind + Scheme transform surfaces** (General Ross, WP-669; Chthon, WP-670)
  do not yet emit `transformResolved` — each a named honest-partial follow-up that
  adds an emit at its own fire site (the event + manifest + consumer are shared).
- **No per-transform word/colour variance** — one word, one palette (a transform
  has no sub-kind, unlike `strikeBlocked`'s `threatKind`).
- **No "cards Transformed this turn" counter** (Sentry's *Rival Personalities*) — a
  distinct engine mechanic, not this VFX WP.
- **No second canvas / no new dependency.**

---

## Files Expected to Change

- `packages/game-engine/src/events/notableEvents.types.ts` + `.test.ts`
- `packages/game-engine/src/events/notableEvents.compose.ts` + `.test.ts`
- `packages/game-engine/src/hero/heroEffects.execute.ts` + `.test.ts`
- `apps/arena-client/src/vfx/transformVfxManifest.ts` (**new**) + `.test.ts` (**new**)
- `apps/arena-client/src/composables/useTransformVfx.ts` (**new**) + `.test.ts` (**new**)
- `apps/arena-client/src/components/play/VfxOverlay.vue` + `.test.ts`
- `apps/arena-client/src/pages/PlayViewport.vue`
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` + `.test.ts`
- `apps/arena-client/src/audio/sfxManifest.ts` + `.test.ts`

Governance / generated artifacts (`STATUS.md`, `DECISIONS.md` land D-24487,
`WORK_INDEX.md`, `EC_INDEX.md`, `NUMBER-LEDGER.md`, `05-ROADMAP-MINDMAP.md` + its
count table) ride the governance-close commit (the universal repo pattern).

---

## Vision Alignment

N/A — no §17.1 trigger surface (no scoring/PAR/leaderboards, identity, card-data,
or monetization). **Determinism:** the notable-event push is hash-relevant only
where a transform fires, and no committed fixture does (NO re-pin, verified); the
VFX layer is hash-excluded (D-24365). NG-1..7 preserved (cosmetic juice for a
shared-board event; no pay-to-win, no PvP).

## Funding Surface Gate

N/A — no funding affordance/channel/copy; gameplay juice.

## API Catalog

N/A — no HTTP endpoint / `apps/server/src/**` library function.

---

## Acceptance Criteria

- [x] `transformResolved` is the tenth `NotableGameEventType` (union + array +
  drift test, ten entries); `TransformResolvedEvent { type, playerId, narrative }`
  round-trips through JSON.
- [x] `heroEffectTransform` emits one `transformResolved` on a completed swap
  (right `playerId`, narrative naming base + second form) and **none** on the AC-5
  exhaustion no-op; the push is guarded (never throws on a minimal mock).
- [x] **NO hash re-pin** — the 23 replay/sentinel/determinism tests pass unchanged;
  the full engine suite (3176) is green.
- [x] A `transformResolved` event fires one transform beat: the gamma surge + burst
  + "TRANSFORMED!" word, one composable-level emit per event via the append-only
  cursor (no pre-mount / reconnect replay).
- [x] Accessibility parity: under `off` nothing renders; under `low` /
  reduced-motion the full-screen surge is suppressed while the "TRANSFORMED!" word
  still shows; no loss of gameplay in any mode.
- [x] The combo path is unchanged; the `NotableEventOverlay` raises a "Transformed!"
  chip; `sfxManifest` is exhaustive over the ten keys.
- [x] `pnpm --filter arena-client typecheck` (vue-tsc) 0; arena-client suite passes;
  engine suite passes; `pnpm -r build` 0.

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0

pnpm --filter @legendary-arena/game-engine test
# Expected: all pass (3176/0); replay/sentinel hash pins unchanged (no re-pin)

pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: vue-tsc 0; all tests pass (1662/0)

Select-String -Path "apps\arena-client\src\pages\PlayViewport.vue" -Pattern "useTransformVfx"
# Expected: exactly one mount
```

Executed this session — engine `3176/0`, arena-client `vue-tsc` 0 + `1662/0`,
`pnpm -r build` 0, replay/sentinel pins UNCHANGED (23/0, no re-pin).

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  in a **real deployed match**, playing a supported base card that transforms
  (She-Hulk *Hurl Legal Objections* after ≥6 recruit; Amadeus Cho *Gamma-Draining
  Nanites* after drawing 2) fires the transform beat — gamma surge + burst +
  "TRANSFORMED!" — on the deployed bundle (green tests + merge alone do NOT satisfy
  it; post-deploy live-verify pending).
- [x] All acceptance criteria pass.
- [x] `pnpm -r build` 0; engine + arena-client suites pass; `vue-tsc` 0.
- [x] `docs/ai/DECISIONS.md` — land D-24487 (Active).
- [ ] `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`
  (+ counts) updated in the governance-close commit.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections; `Out of Scope` lists ≥2.
- **§2 Constraints** — PASS. Engine determinism + VFX-layer + packet-specific + locked values.
- **§3 Assumes / §4 Context** — PASS. WP-658/665 + WP-644/647 + WP-556 named with exact exports/paths.
- **§5 Files** — PASS. Cross-layer, each edit small and named; the engine half is a mechanical lockstep add (union/array/drift/compose/emit), the client half mirrors WP-647.
- **§6 Naming** — PASS. `transformResolved`, `composeTransformNarrative`, `useTransformVfx`, `TRANSFORM_VFX`, `TRANSFORM_WORD`, `renderTransform`; no abbreviations.
- **§7 Dependencies** — PASS. No new npm dep.
- **§8 Boundaries** — PASS. Engine emits the event; the client consumes projected `UIState`; the `01.5` wiring is the single authorized runtime-wiring line.
- **§9 Windows** — PASS. `pwsh` `Select-String`.
- **§10 Env / §11 Auth** — N/A.
- **§12 Tests** — PASS. engine `node:test` + arena-client `node:test` / `@vue/test-utils` / jsdom; no `boardgame.io/testing`.
- **§13 Verification** — PASS. Exact `pnpm` commands + the replay-pin check + the wiring grep.
- **§14 Acceptance / §15 DoD** — PASS. Binary; the determinism (no re-pin) + emit-on-swap-only + accessibility pinned; live-on-surface (D-24026).
- **§16 Code style** — PASS. Mirrors `useStrikeBlockedVfx`; explicit; the guarded push; no `.reduce()` in the emit.
- **§17 Vision** — N/A (declared) + the determinism note (no re-pin; hash-excluded VFX).
- **§18 Prose-vs-grep** — PASS. The wiring grep targets `PlayViewport.vue`.
- **§19 Bridge / §20 Funding / §21 API** — N/A.

**Lint verdict: PASS (all 21 resolved).**

---

## Gate Verdicts (executed in-session)

- **Pre-flight (01.4): READY.** The engine-event → VFX-consumer arc is the shipped
  WP-644/647 pattern; the one novel risk — a hash re-pin from the new
  `G.notableEvents` push — was retired **empirically** (the sentinel replay predates
  `wwhk`; 23 replay/sentinel tests green, no fixture transforms). The vue-tsc pass
  caught the two lockstep sites a cross-layer notable-event add must touch on the
  client (the exhaustive `sfxManifest` `Record`; the `NotableEventOverlay` chip is a
  `?? type` fallback, updated for polish) — both folded before completion.
- **Copilot (01.7): RISK, folded.** (1) The guarded push (`Array.isArray`) is load-
  bearing — the minimal `heroEffects.execute.test.ts` builder omits `notableEvents`,
  so an unconditional push would fail the existing transform suite; verified the
  guard keeps all pre-existing transform tests green. (2) Emit-on-swap-only: the AC-5
  exhaustion path must NOT emit (a no-op is not a transform); pinned by a dedicated
  test. (3) `eventCardId` falls through to `''` for the card-less variant with no
  change (the `healResolved` posture) — verified.

---

## See Also

- [WP-647](WP-647-shield-block-vfx-overlay-burst.md) / D-24459 — the engine-event → `VfxOverlay` consumer pattern this mirrors
- WP-658 / D-24469 + WP-665 / D-24476 — the Hero Transform swap runtime this announces
- WP-556 / D-24365 — the VFX foundation this builds on
- `wiki/transform.md` — the Transform mechanic (Hero / Mastermind / Scheme surfaces)
- `wiki/visual-effects.md` — the VFX Trigger Contract (Surface 1 notable events)
