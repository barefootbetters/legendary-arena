# EC-682 — Shield-Block `VfxOverlay` Burst (Execution Checklist)

**Source:** docs/ai/work-packets/WP-647-shield-block-vfx-overlay-burst.md
**Layer:** Arena Client (VFX layer — a `strikeBlocked` notable-event VFX consumer + the shield render) + ewiki

## Before Starting
- [ ] Baseline: `origin/main` @ `be99baad` (or later — the `strikeBlocked` event + all three `threatKind` values + WP-556 VFX foundation are present, WP-646 producer merged); working tree clean, synced.
- [ ] WP-556 / D-24365 on `main`: `VfxOverlay.vue` (`fireBurst` bound `canvas-confetti`, `showWord`, `pulseImpact`, `renderEvent` gated by `shouldRender`, watches a module signal); `effectIntensity.ts` (`useEffectIntensity` → `shouldRender`, `VfxKind = 'shake'|'particles'|'word'`); `useComboVfx.ts` (module-signal + injectable-render seam); `canvas-confetti@^1.9.3` installed. `PlayViewport.vue` mounts `useComboVfx(audioSnapshot)` + renders `<VfxOverlay />`.
- [ ] WP-644/645/646 on `main`: `strikeBlocked` variant projected via `UIState.notableEvents`; `threatKind` ∈ `'masterStrike'|'schemeTwist'|'ambush'`; client `NotableGameEvent = UIState['notableEvents'][number]` carries it.
- [ ] `pnpm -r build` 0; arena-client suite + `vue-tsc` green.
- [ ] Scope lock — EXACT target files = `Files to Produce` below. NO `packages/game-engine/**` diff (pure client consumer). Anything else is a FAIL.

## Locked Values (do not re-derive)
- Consumer: `useStrikeBlockedVfx(snapshot, render?)` + `useStrikeBlockedVfxSignal()` + `StrikeBlockedVfxEvent { threatKind, seq }` — mirrors `useComboVfx`'s module-signal + injectable-render seam; append-only cursor over `UIState.notableEvents` (seed to length on the first valid frame — the D-20104 re-emission gate).
- Call-out word: `BLOCKED_WORD = 'BLOCKED!'` (constant, no per-threat variance).
- Burst colours (proposal, test pins non-empty): `masterStrike → ['#e23046', '#ff6b6b', '#ffffff']`; `schemeTwist → ['#8a4dff', '#b57bff', '#ffffff']`; `ambush → ['#3bd16f', '#7be0a0', '#ffffff']`.
- Shield glyph: Cap's concentric red `#c0182f` / white `#eeeae0` / red / blue `#123f8f` rings + a white star, fixed colours. Copy the self-contained `<g class="shield">` subtree (circles r=84/68.9/52.9/37 + star polygon) from `apps/wiki-viewer/static/visual-effects/block-shield.svg` (same vector as `ewiki/visual-effects/block-shield.svg`) — copy the glyph, do NOT re-draw it, and drop the file's animated wrapper.
- Gating (RS-1): the shield GLYPH shows whenever the word shows (i.e. unless `off`) — it renders **static** and only **spins** when `shouldRender('shake')` (so the identity survives `low`/reduced-motion, the way the word does); burst = `'particles'`; word = `'word'`.

## Guardrails
- **Pure presentation.** Reads `UIState` only; never `G`/`ctx`; never a move. Absent from the determinism hash (the `src/vfx/` D-24365 exemption). Do NOT touch `packages/game-engine/**`.
- **Fail-soft, never throws into gameplay.** Reuse the WP-556 `ensureConfetti` guard; a headless/jsdom mount is a no-op (the burst is skipped; the shield glyph + word still render as DOM).
- **Accessibility contract (mandatory).** Gated by `shouldRender`: burst `'particles'` (suppressed under `off`/reduced-motion); the shield GLYPH shows whenever the word shows (unless `off`) — **static** when `shouldRender('shake')` is false, **spinning** when true (RS-1); word `'word'` (still shows unless `off`, plain fade under reduced-motion). `off` = no VFX; `low`/reduced-motion = a **static shield + "BLOCKED!" word** (+ burst at `low`). Never a loss of gameplay.
- **One beat per `strikeBlocked` event**, via the append-only cursor. Seed the cursor on the first valid frame so a mount/reconnect against an already-populated snapshot replays NOTHING (mirror `useNotableEventStream`). Filter to `event.type === 'strikeBlocked'`.
- `threatKind` drives ONLY the burst `colors` — the sole client use of the field. Derive the threat-kind type from the event (`Extract<NotableGameEvent, { type: 'strikeBlocked' }>['threatKind']`), NOT a deep engine import.
- The manifest `Record<threatKind, {colors}>` is EXHAUSTIVE over the three values — a future `threatKind` value (`'fight'`/`'escape'`) fails `vue-tsc` at the `Record` until mapped (the `sfxManifest` exhaustive-pin discipline).
- The combo path is UNCHANGED: `fireBurst` gains an optional `colors?: readonly string[]` param (`readonly`, to accept the manifest's `readonly string[]` without a `vue-tsc` error) and delegates its options build to a NEW **exported pure** `buildBurstOptions(particleCount, colors?: readonly string[])` — when `colors` is **undefined the `colors` key is OMITTED** from the returned options, so canvas-confetti keeps its **default (multicolor) palette** (the combo burst today passes NO `colors` — it is NOT gold; gold is only the word + impact). Do NOT introduce a gold or any fixed default. `useComboVfx` / `comboVfxManifest` are NOT touched. **Why exported:** `confettiFire` is closure-local and jsdom's `getContext`→`null` short-circuits `fireBurst` before any options object exists, so the combo-unchanged / shield-colours assertions are ONLY writable against the pure `buildBurstOptions` imported directly — never a confetti spy (which would force an out-of-allowlist `jsdom-setup.ts` edit — copilot Finding 1).
- One shared canvas (no second canvas); `transform`/`opacity`-only animations; the shield-spin ≤ ~600ms.
- arena-client tests: `node:test` + `@vue/test-utils` + `jsdom` — never `boardgame.io/testing`, never Vitest.
- `PlayViewport` wiring is ONE `01.5` runtime-wiring line (`useStrikeBlockedVfx(audioSnapshot)` beside `useComboVfx`) — cite `01.5-runtime-wiring-allowance.md`.

## Required `// why:` Comments
- `useStrikeBlockedVfx.ts` cursor seed: the append-only re-emission gate (D-20104) — no replay of pre-mount events on mount/reconnect.
- `VfxOverlay.vue` `fireBurst` `colors?` param: when undefined, OMIT the `colors` key (the combo keeps canvas-confetti's default multicolor palette — NOT gold); the shield path passes threat colours.
- `VfxOverlay.vue` shield-spin CSS: transform/opacity only; suppressed under prefers-reduced-motion (the shouldRender('shake') backstop).
- `PlayViewport.vue` mount: 01.5 runtime wiring — the shield VFX consumer beside useComboVfx, same snapshot.

## Files to Produce
- `apps/arena-client/src/vfx/strikeBlockedVfxManifest.ts` — **new** — `STRIKE_BLOCKED_VFX` exhaustive `threatKind → {colors}` + `BLOCKED_WORD`
- `apps/arena-client/src/vfx/strikeBlockedVfxManifest.test.ts` — **new** — exhaustive over three kinds + non-empty colours + `BLOCKED_WORD`
- `apps/arena-client/src/composables/useStrikeBlockedVfx.ts` — **new** — the notableEvents-stream shield consumer + signal seam
- `apps/arena-client/src/composables/useStrikeBlockedVfx.test.ts` — **new** — cursor seed (no pre-mount replay) / one-beat-per-event with threatKind / non-strikeBlocked → none / reconnect-replays-nothing
- `apps/arena-client/src/components/play/VfxOverlay.vue` — **modified** — shield glyph + threat-coloured burst (`fireBurst` `colors?` → exported pure `buildBurstOptions(count, colors?)`) + word + the new signal consumer
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` — **modified** — shield render + intensity gating (off/reduced-motion suppress shield+burst, word shows) + combo-path-unchanged (assert `buildBurstOptions(count)` omits the `colors` key, `buildBurstOptions(count, [...])` includes it — imported directly, no confetti spy)
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified (01.5)** — mount `useStrikeBlockedVfx(audioSnapshot)`
- `wiki/visual-effects.md` — **modified** — flip **all five** places framing the shield-block-`VfxOverlay`-burst as the "follow-on" to shipped (WP-647) — **3 prose passages + 2 table rows** (the burst has no *dedicated* Surface-1 row, but its follow-on framing lives in two rows, pre-flight RISK): the "not yet shipped" callout (~167–175), the `#surface-block` shipped-note (~723–726), the Decisions-Pending RESOLVED callout (~1021–1027), the **Future-priority table row** (~416, "…the shield particle burst is the follow-on"), and the **Surface-1 `strikeBlocked` catalog row** (~449, "…the shield `VfxOverlay` burst … is the follow-on"). Flip ALL FIVE so the page never says both "shipped" and "follow-on". Also fix the stale "seven locked variants" → "nine" at the notableEvents catalog intro (~line 244; the two added since the seven-era count are `deckReshuffled` + `strikeBlocked`, `bystanderRevealed` was already in the seven; pre-existing drift, RS-3).

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) 0 + `pnpm --filter arena-client test` passes
- [ ] `Select-String PlayViewport.vue "useStrikeBlockedVfx"` → exactly 1 mount
- [ ] `git diff --name-only` — only the allowlist; NO `packages/game-engine/**`
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): block a threat → the shield-block beat (shield + threat-coloured burst + "BLOCKED!"); ewiki entry live
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24459 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-647 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅` + `pnpm roadmap:counts:write`

## Common Failure Smells
- The shield/burst fires on mount or reconnect for old events → the cursor was not seeded to `notableEvents.length` on the first valid frame (the D-20104 gate).
- The combo flash changed colour or count → `buildBurstOptions` now emits a `colors` key when `colors` is undefined (it must OMIT it — the combo keeps canvas-confetti's default multicolor palette, NOT gold), or `comboVfxManifest`/`useComboVfx` was edited (out of scope). The combo-unchanged test asserts `buildBurstOptions(count)` returns options with NO `colors` key (imported directly — NOT a confetti spy; do NOT edit `jsdom-setup.ts` to observe the call).
- Trying to spy on `canvas-confetti` to assert the combo colours → dead end: jsdom's `getContext`→`null` makes `fireBurst` short-circuit before building options, so nothing is observable at the confetti boundary. Assert on the exported pure `buildBurstOptions` instead (copilot Finding 1). Editing `jsdom-setup.ts` to force a context is an out-of-allowlist scope FAIL.
- `vue-tsc` red on a missing-property error in the manifest `Record` → a `threatKind` value is unmapped; the exhaustive `Record` is doing its job — map it (there are exactly three).
- Under reduced-motion / `low` the shield still SPINS, or the burst still fires under reduced-motion → a `shouldRender` gate is missing (the spin is gated `'shake'`, the burst `'particles'`). But note the shield GLYPH itself must STILL show (static) under `low`/reduced-motion — if it vanishes entirely there (only word remains), the visibility was wrongly gated on `'shake'` instead of on the word-gate (RS-1).
- `arena-client test` red in jsdom on a confetti/context error → the fail-soft `ensureConfetti` guard was bypassed for the shield burst (reuse the existing path).
- `git diff` shows a `packages/game-engine/**` file → scope creep; this is a pure client consumer, no engine change.
- The shield glyph animates a layout property (width/top) → use transform/opacity only (the performance budget).
