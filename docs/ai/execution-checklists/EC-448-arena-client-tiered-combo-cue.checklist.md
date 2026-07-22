# EC-448 — Arena-Client Tiered Combo Cue (Execution Checklist)

**Source:** docs/ai/work-packets/WP-413-arena-client-tiered-combo-cue.md
**Layer:** App (`apps/arena-client`)

## Before Starting
- [ ] Baseline `origin/main` clean + fast-forward synced; re-confirm the WP baseline.
- [ ] `UIState.game.lastPlayEffectsFired: number` (WP-409 / D-24221) is live — a public scalar, reset to `0` in the play-phase `onBegin`, overwritten per play.
- [ ] The WP-412 audio foundation is on `main`: `audioEngine.ts` exports `getAudioEngine()` / `createAudioEngine(howlFactory)` / the `AudioEngine` interface (`play(clipUrl)` gated by arm + mute + volume) / `__setAudioEngineForTests` / `__resetAudioEngineForTests`; `sfxManifest.ts` is the manifest precedent; `useSoundEffects.ts` is the sibling-consumer precedent; `PlayViewport.vue` is the `01.5` host that already reads the `useUiStateStore` snapshot and mounts `useSoundEffects(snapshot)`.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0; `pnpm --filter arena-client test` exits 0.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it (beyond the ONE recorded `01.5` wiring host, the same WP-412 host) is a FAIL — surface as a blocker, do not improvise.

## Locked Values (do not re-derive)
- No new dependency — reuse WP-412's `howler` via `getAudioEngine()`.
- Tier type: `ComboTier = 'none' | 'small' | 'medium' | 'big'`.
- Tier thresholds: `comboTierForCount(count)` → `<= 0` → `none`, `1` → `small`, `2` → `medium`, `>= 3` → `big`.
- Manifest keys = the three audible tiers `small` / `medium` / `big` → CC0 URLs under `audio/sound-effects/` on `images.legendary-arena.com` (`combo-small.mp3`, `combo-medium.mp3`, `combo-big.mp3`). `'none'` is NOT in the manifest.
- Consumer rule: OWN last-seen scalar; catch up on the first valid frame (NO cue for the pre-mount value); play ONCE per audible value-change; ride the shared engine's mute/volume/unlock gate. NOT an append-only cursor.
- Signal source: `UIState.game.lastPlayEffectsFired` (public scalar; safe on a null/absent snapshot).
- Wiring host = `src/pages/PlayViewport.vue` (the SAME WP-412 `01.5` host); snapshot source = the `useUiStateStore` snapshot already read there. Do NOT add a second wiring host; no template change (reuse the WP-412 `AudioControls`).
- Reserved decision: **D-24228** (land Active at close).

## Guardrails
- Pure presentation: reads `UIState` only — NEVER writes `G`/`ctx`, never affects an outcome, zero engine/determinism/replay footprint. If you touch a `packages/game-engine` file, STOP (out of scope).
- No runtime `@legendary-arena/game-engine/setup` or `@legendary-arena/registry` import; type-only `UIState` via the `.` subpath.
- Reuse the WP-412 engine — NO new `Howl` wrapper, NO new audio control, NO new dependency, NO second SFX channel. The mute/volume/unlock gate is the engine's.
- Scalar-change, not a stream: fire once per audible value-change; the pre-mount value never fires (catch-up); a change to `0`/`none` never fires.
- Documented v1 limitation (assert it, do not "fix" it): two consecutive same-turn plays with the same non-zero count coalesce to one cue. The per-turn reset re-arms equal values across turns (`3 → 0 → 3` fires the second `3`).
- Audio bytes hosted on R2, NEVER committed to git; the manifest carries URLs only. Tests inject a mock/recording engine (no real audio, asset-independent).

## Required `// why:` Comments
- `comboCueManifest.ts` (R2/hyphen rule): CC0 combo clips hosted under `audio/sound-effects/` on `images.legendary-arena.com`, never in git; hyphenated filenames.
- `useComboCue.ts` (scalar-change): own last-seen value; catch up on the first frame (no pre-mount cue); fire once per audible value-change; NOT an append-only cursor; equal-consecutive same-turn plays coalesce (per-turn reset re-arms across turns).

## Files to Produce
- `apps/arena-client/src/audio/comboCueManifest.ts` — **new** — `ComboTier` + `comboTierForCount` (pure) + three-tier → CC0 URL map (exhaustive over the audible tiers)
- `apps/arena-client/src/composables/useComboCue.ts` — **new** — scalar-change combo consumer (`useComboCue(snapshot, engine = getAudioEngine())`)
- `apps/arena-client/src/audio/comboCueManifest.test.ts` — **new** — tier-boundary + manifest exhaustiveness drift
- `apps/arena-client/src/composables/useComboCue.test.ts` — **new** — audible value-change plays once; no pre-mount cue; no cue on change-to-none; coalesces equal consecutive; re-arms across `3 → 0 → 3`; safe-skip null; respects mute
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified (`01.5` wiring — the SAME single host)** — in `setup`, mount `useComboCue(audioSnapshot)` beside `useSoundEffects(audioSnapshot)`; no template change

### Execution Amendment (2026-07-22) — engine lazy-load
The WP-412 engine's `play(clipUrl)` only played clips **preloaded from `sfxManifest`** at construction; a combo-cue URL (not in `sfxManifest`) hit `clip === undefined` and silently no-op'd — the combo cue would never sound through the real engine (the recording-mock unit tests hid it). To honor the "reuse the WP-412 engine" thesis, `play()` now **lazily constructs + caches** a `Howl` for any un-preloaded URL (preloading stays an optimization; no `AudioEngine` interface change, so no other mock engine needs editing). This adds two WP-412 files to the allowlist:
- `apps/arena-client/src/audio/audioEngine.ts` — **modified** — `play()` lazy-loads an un-preloaded URL
- `apps/arena-client/src/audio/audioEngine.test.ts` — **modified** — the former "unknown URL no-op" test becomes a lazy-load test (+ pre-arm gate still holds)
`useComboCue.test.ts` gains an integration test driving the **real** `createAudioEngine` to prove the full chain plays the combo clip.

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter arena-client typecheck` exits 0 (vue-tsc — the load-bearing SFC gate).
- [ ] `pnpm --filter arena-client test` passes (engine injected / `Howl` mocked).
- [ ] `git diff --name-only` = the allowlist only (+ the ONE recorded `01.5` wiring host); NO `packages/game-engine/**` file.
- [ ] Live-on-surface (D-24026): on the deployed bundle, a synergy hero play plays its combo tier + the mute toggle silences it (REQUIRES the three CC0 combo clips uploaded to R2 — note the asset prerequisite in STATUS if pending).
- [ ] `docs/ai/STATUS.md` — the tiered combo cue (hero-play synergy escalation) riding the WP-412 engine + WP-409 signal.
- [ ] `docs/ai/DECISIONS.md` — land D-24228 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-413 checked off with the date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-413 node glyph `📝 → ✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- A `packages/game-engine/**` file in the diff ⇒ you drifted into the engine; the combo cue is App-only (the signal already shipped in WP-409).
- A new `Howl` / audio engine / control ⇒ you rebuilt WP-412 instead of reusing `getAudioEngine()`.
- A cue fires on mount / on reconnect ⇒ the consumer did not catch up (seed last-seen to the current value on the first frame).
- A cue fires on a change to `0` ⇒ the `'none'` tier is not being skipped.
- Every play with the same count fires ⇒ you keyed off something other than a value-change (or you added a per-play edge — out of scope for v1).
- A committed `.mp3` ⇒ audio bytes must live on R2, not git.
