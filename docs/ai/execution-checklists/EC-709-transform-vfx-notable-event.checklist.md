# EC-709 — Transform VFX (the `transformResolved` notable event + power-surge beat) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-672-transform-vfx-notable-event.md
**Layer:** Cross-layer — Game Engine (a new `transformResolved` notable event) + Arena Client (a new notable-event VFX consumer + the transform render)

## Before Starting
- [x] Baseline: `origin/main` @ `26db00e7` (or later — the Hero Transform runtime, the nine-variant notable-event union, and the WP-556 VFX foundation are present); working tree clean, synced.
- [x] WP-658 / WP-665 on `main`: `heroEffectTransform` (`hero/heroEffects.execute.ts`) performs the swap for `SUPPORTED_TRANSFORM_BASES` (She-Hulk, Amadeus Cho) and pushes an `applied` log line on a completed swap / a `blocked` line on the AC-5 exhaustion no-op.
- [x] WP-644 / WP-647 on `main`: the `strikeBlocked` notable-event → `VfxOverlay` consumer pattern (`useStrikeBlockedVfx`, an append-only `notableEvents` cursor; `strikeBlockedVfxManifest`; the fourth-signal render in `VfxOverlay`) — the exact template this mirrors.
- [x] WP-556 / D-24365 on `main`: `VfxOverlay.vue` (`fireBurst(count, colors?)`, `showWord`, `pulseImpact`/`pulseWound`, `shouldRender` gating, module-signal watches); `effectIntensity.ts` (`VfxKind = 'shake'|'particles'|'word'`); `canvas-confetti` installed.
- [x] `pnpm -r build` 0; engine + arena-client suites + `vue-tsc` green.
- [x] Scope lock — EXACT target files = `Files to Produce` below. Anything else is a FAIL.

## Locked Values (do not re-derive)
- Event: `TransformResolvedEvent { type: 'transformResolved', playerId, narrative }` — **minimal payload** (no card id — like `healResolved` / `deckReshuffled`; names travel in the narrative). Tenth variant of `NotableGameEventType`; `NOTABLE_EVENT_TYPES` grows to ten in lockstep with the drift test.
- Narrative: `composeTransformNarrative(baseName, secondFormName)` → ``"<base>" transformed into "<second form>".`` (byte-stable, third-person; the `composeBystanderRevealedNarrative` shape).
- Emit site: the LAST step of `heroEffectTransform` on a **completed** swap (after the second-form is in play + the `applied` log push), **guarded** `if (Array.isArray(G.notableEvents))`. NOT emitted on the AC-5 exhaustion no-op.
- Consumer: `useTransformVfx(snapshot, render?)` + `useTransformVfxSignal()` + `TransformVfxEvent { seq }` — mirrors `useStrikeBlockedVfx`'s module-signal + injectable-render seam; append-only cursor over `UIState.notableEvents` seeded to length on the first valid frame (the D-20104 re-emission gate); filter to `event.type === 'transformResolved'`.
- Call-out word: `TRANSFORM_WORD = 'TRANSFORMED!'` (constant — a transform has no sub-kind).
- Burst palette: `TRANSFORM_VFX.colors = ['#5ee66b', '#a6ff7a', '#eaffd0']` (radioactive gamma green; lead `#5ee66b` pinned distinct from Master Strike red / shield threat colours / wound red).
- Gating: word `'word'` (shows unless `off`); burst `'particles'` (off under reduced-motion); the full-screen gamma **surge bloom** is `'shake'` (full intensity only, off under reduced-motion — the wound-vignette precedent).
- Chip: `NotableEventOverlay` `CHIP_LABELS.transformResolved = 'Transformed!'` + a gamma accent (`--color-transform`, `#5ee66b`).
- SFX: `sfxManifest.transformResolved = ${SFX_BASE_URL}transform.mp3` (the exhaustive `Record` forces it; byte operator-pending on R2, the WP-602/642 posture).

## Guardrails
- **Determinism (engine).** `G.notableEvents` IS serialized by `computeStateHash` (only `G.diagnostics` excluded, D-24294), so the push is hash-relevant wherever a transform fires. NO committed replay / sentinel fixture performs a transform (the sentinel predates `wwhk`) → **NO hash re-pin**. VERIFY empirically: the replay/sentinel/determinism suite must pass unchanged (do NOT edit a pin; a red pin means a fixture DOES transform — STOP and re-pin honestly per the hash-dual-repin doc).
- **Handlers never throw.** The push is guarded on `Array.isArray(G.notableEvents)` — the minimal `heroEffects.execute.test.ts` builder omits `notableEvents`, so an unconditional push would break the existing transform suite. Mirror the handler's existing `transformTargets` / `transformDeck` guards.
- **Emit only on a completed swap.** The AC-5 exhaustion path (`blocked` log, `return` before the swap) emits NOTHING — a swap that did not happen is not a transform.
- **Names resolve at the fire site.** `resolveTransformCardName(G, cardId)` reads `G.cardDisplayData[id]?.name` with a raw-ext_id fallback (the bystander-site precedent), so `composeTransformNarrative` stays pure (no `G`).
- **Pure presentation (client).** Reads `UIState` only; never `G`/`ctx`; absent from the determinism hash (`src/vfx/` D-24365). Fail-soft confetti (reuse `ensureConfetti`); a jsdom mount is a no-op.
- **Accessibility contract (mandatory).** `off` = nothing; `low` / reduced-motion = the "TRANSFORMED!" word (plain fade) + (at `low`) the burst, but the full-screen surge bloom is suppressed. Never a loss of gameplay.
- **One beat per event**, via the append-only cursor (no pre-mount / reconnect replay). A transform has no sub-kind → the VFX event is a plain `{ seq }`, the manifest a single spec (NOT a `Record`).
- **Combo path unchanged** — `fireBurst`'s `colors?` already omits the key when undefined (WP-647); the transform passes its gamma palette explicitly. Do NOT touch `useComboVfx` / `comboVfxManifest`.
- **Client lockstep on a new event type** (vue-tsc will catch these): the exhaustive `sfxManifest` `Record<NotableGameEventType, string>` requires the new key; the `NotableEventOverlay` `CHIP_LABELS` (`?? type` fallback — added for polish, not a hard break). `eventCardId` falls through to `''` for the card-less variant with NO change.
- arena-client tests: `node:test` + `@vue/test-utils` + `jsdom` — never `boardgame.io/testing`, never Vitest.
- `PlayViewport` wiring is ONE `01.5` runtime-wiring line (`useTransformVfx(audioSnapshot)` beside the other feel consumers).

## Required `// why:` Comments
- `heroEffects.execute.ts` push: WP-672 / D-24487 — emit LAST on a completed swap; guarded because the minimal test builder omits `notableEvents`; NOT on the AC-5 no-op.
- `notableEvents.types.ts` array + union: the ten-entry lockstep + the new variant's rationale (transform fire site).
- `useTransformVfx.ts` cursor seed: the append-only re-emission gate (D-20104).
- `VfxOverlay.vue` surge gating: the full-screen gamma flash is `'shake'` (full only, off under reduced-motion — the wound-vignette class); the word survives.
- `PlayViewport.vue` mount: 01.5 runtime wiring — the transform VFX consumer beside the other feel consumers, same snapshot.

## Files to Produce
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — `transformResolved` (union + `NOTABLE_EVENT_TYPES` ten entries) + `TransformResolvedEvent` + the `NotableGameEvent` union
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — ten entries (deepEqual + union + count) + a `TransformResolvedEvent` round-trip
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — `composeTransformNarrative`
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — the narrative + purity
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — the guarded push + `resolveTransformCardName` + the `composeTransformNarrative` import
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — emit-on-completed-swap + NO-emit-on-AC-5
- `apps/arena-client/src/vfx/transformVfxManifest.ts` — **new** — `TRANSFORM_VFX` + `TRANSFORM_WORD`
- `apps/arena-client/src/vfx/transformVfxManifest.test.ts` — **new** — non-empty hex palette + the word + the pinned lead colour
- `apps/arena-client/src/composables/useTransformVfx.ts` — **new** — the notableEvents-stream transform consumer + signal seam
- `apps/arena-client/src/composables/useTransformVfx.test.ts` — **new** — cursor seed / one-per-event / non-transform → none / reconnect-replays-nothing
- `apps/arena-client/src/components/play/VfxOverlay.vue` — **modified** — the surge bloom + gamma burst + word render + the fourth signal consumer
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` — **modified** — surge+word at full / word-survives-suppressed-surge at low+reduced-motion / off renders nothing
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified (01.5)** — mount `useTransformVfx(audioSnapshot)`
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — **modified** — the "Transformed!" chip + gamma accent
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — **modified** — the chip + verbatim narrative + no card-name row
- `apps/arena-client/src/audio/sfxManifest.ts` — **modified** — the `transform.mp3` entry (exhaustive `Record` forces it)
- `apps/arena-client/src/audio/sfxManifest.test.ts` — **modified** — ten keys

## After Completing
- [x] `pnpm -r build` 0
- [x] `pnpm --filter @legendary-arena/game-engine test` — 3176/0; replay/sentinel pins UNCHANGED (23/0, NO re-pin)
- [x] `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) 0 + `test` — 1662/0
- [x] `Select-String PlayViewport.vue "useTransformVfx"` → exactly 1 mount
- [x] `git diff --name-only` — only the allowlist (+ the governance-close artifacts)
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): play a supported base that transforms → the transform beat (gamma surge + burst + "TRANSFORMED!") + the "Transformed!" chip (post-deploy, pending)
- [x] `docs/ai/DECISIONS.md` — land D-24487 (Active)
- [ ] `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md` (+ counts) in the governance-close commit

## Common Failure Smells
- A replay/sentinel hash pin goes red → a committed fixture DOES perform a transform after all; do NOT delete/edit the assertion — re-pin honestly (both `finalStateHash` + `PRE_WP080_HASH` oracles) and note it. (Expected: no re-pin — the sentinel predates `wwhk`.)
- The existing transform suite (`heroEffects.execute.test.ts` swap tests) goes red on a `push` of `undefined` → the emit was NOT guarded on `Array.isArray(G.notableEvents)`; the minimal builder omits the array.
- The AC-5 exhaustion test now sees a notable event → the push was placed before the `return`, not after the completed swap; a no-op must emit nothing.
- `vue-tsc` red with "Property 'transformResolved' is missing in type … Record<…>" → the exhaustive `sfxManifest` `Record` is doing its job; add the tenth key.
- Under reduced-motion / `low` the full-screen gamma surge still flashes → the surge is not gated `'shake'` (it must be, like the wound vignette); but the "TRANSFORMED!" word must STILL show (gated `'word'`).
- The transform fires on mount / reconnect for old events → the cursor was not seeded to `notableEvents.length` on the first valid frame (the D-20104 gate).
- The combo flash changed → `useComboVfx` / `comboVfxManifest` was touched (out of scope) — the transform is additive.
- `git diff` shows a mastermind/scheme transform file → scope creep; v1 is Hero transform only (the other two surfaces are named follow-ups).
