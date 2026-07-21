# EC-447 — Arena-Client Audio Layer Foundation (Execution Checklist)

**Source:** docs/ai/work-packets/WP-412-arena-client-audio-layer-foundation.md
**Layer:** App (`apps/arena-client`)

## Before Starting
- [ ] Baseline `origin/main` clean + fast-forward synced; re-confirm the WP baseline.
- [ ] `UIState.notableEvents` (WP-200) projects the six variants; `useNotableEventStream.ts` exports the `NotableGameEvent = UIState['notableEvents'][number]` alias + the append-only cursor pattern to parallel.
- [ ] A localStorage settings precedent exists (`useSkinApplier` / `SkinSelector`) to mirror for mute/volume.
- [ ] `howler` is NOT yet an arena-client dependency.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0; `pnpm --filter arena-client test` exits 0.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it (beyond the ONE recorded `01.5` wiring host) is a FAIL — surface as a blocker, do not improvise.

## Locked Values (do not re-derive)
- New dep: `howler` (runtime) + `@types/howler` (dev), `apps/arena-client` ONLY.
- Manifest keys = the six `NotableGameEventType` strings: `fightResolved`, `ambushResolved`, `schemeTwistResolved`, `mastermindStrikeResolved`, `mastermindDefeated`, `healResolved`.
- R2 prefix: `audio/sound-effects/` on `images.legendary-arena.com`.
- Settings: localStorage-persisted `isMuted` (boolean) + `volume` (0..1); default unmuted, moderate volume.
- Consumer rule: OWN cursor; catch up to length on first valid frame (NO history replay); one clip per newly-appended event, index order; NO auto-dismiss throttle.
- Reserved decision: **D-24224** (land Active at close).

## Guardrails
- Pure presentation: the layer reads `UIState` only — NEVER writes `G`/`ctx`, never affects an outcome, zero engine/determinism/replay footprint. If you touch a `packages/game-engine` file, STOP (out of scope).
- No runtime `@legendary-arena/game-engine/setup` or `@legendary-arena/registry` import; type-only `UIState` via the `.` subpath.
- Autoplay unlock is mandatory: NO play before the first-gesture arm; a pre-arm event is silently skipped (do NOT queue it to blast on unlock).
- Mute ⇒ no play; volume applied on every play. Muted/pre-arm plays are silent no-ops, never throws.
- Surface 1 ONLY — no music channel, no combo cue, no Surface-2/3 cues (follow-on WPs).
- Audio bytes are hosted on R2, NEVER committed to git; the manifest carries URLs only. Tests use a mocked `Howl` (no real audio, asset-independent).
- The `useSoundEffects` cursor must NOT reuse `useNotableEventStream`'s one-at-a-time 2.5s overlay queue — it is a separate per-event consumer.

## Required `// why:` Comments
- `audioEngine.ts` (unlock gate): no audio before the first user gesture arms the context (browser autoplay policy).
- `audioEngine.ts` (mute/volume gate): muted ⇒ silent no-op; master volume applied per play.
- `useSoundEffects.ts` (cursor): own append-only cursor; catch up on first frame (no history replay); fires per newly-appended event with no overlay-style throttle (distinct from useNotableEventStream).

## Files to Produce
- `apps/arena-client/package.json` — **modified** — `howler` + `@types/howler`
- `apps/arena-client/src/audio/audioEngine.ts` — **new** — howler wrapper (play / mute / volume / unlock)
- `apps/arena-client/src/audio/sfxManifest.ts` — **new** — six event → CC0 URL map (exhaustive)
- `apps/arena-client/src/composables/useSoundEffects.ts` — **new** — per-event SFX consumer (own cursor)
- `apps/arena-client/src/composables/useAudioSettings.ts` — **new** — localStorage mute/volume
- `apps/arena-client/src/components/play/AudioControls.vue` — **new** — mute/volume UI
- `apps/arena-client/src/audio/audioEngine.test.ts` — **new**
- `apps/arena-client/src/audio/sfxManifest.test.ts` — **new**
- `apps/arena-client/src/composables/useSoundEffects.test.ts` — **new**
- `apps/arena-client/src/composables/useAudioSettings.test.ts` — **new**
- `apps/arena-client/src/components/play/AudioControls.test.ts` — **new**
- Play root host (`PlayViewport.vue` OR `PlayDesktop.vue`/`PlayMobile.vue`) — **modified (`01.5` wiring; record which)** — mount engine + `useSoundEffects` + `AudioControls`

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter arena-client typecheck` exits 0 (vue-tsc — the load-bearing SFC gate).
- [ ] `pnpm --filter arena-client test` passes (howler mocked).
- [ ] `git diff --name-only` = the allowlist only (+ the ONE recorded `01.5` wiring host); NO `packages/game-engine/**` file.
- [ ] Live-on-surface (D-24026): on the deployed bundle, a notable event plays its sound + mute persists across reload (REQUIRES the CC0 clips uploaded to R2 — note the asset prerequisite in STATUS if pending).
- [ ] `docs/ai/STATUS.md` — first sound in the game (Surface-1 SFX).
- [ ] `docs/ai/DECISIONS.md` — land D-24224 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-412 checked off with the date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-412 node glyph `📝 → ✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- A `packages/game-engine/**` file in the diff ⇒ you drifted into the engine; audio is App-only.
- A sound replays on reconnect/remount ⇒ the cursor is not catching up on the first frame (history replay).
- Audio blasts a backlog on unlock ⇒ pre-arm events were queued instead of skipped.
- `vue-tsc` red on `Howl` types ⇒ `@types/howler` missing from devDependencies.
- A committed `.mp3`/`.wav` ⇒ audio bytes must live on R2, not git.
