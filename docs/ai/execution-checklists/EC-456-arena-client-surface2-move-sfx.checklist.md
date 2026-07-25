# EC-456 — Arena-Client Surface-2 Player-Action Move SFX (Execution Checklist)

**Source:** docs/ai/work-packets/WP-421-arena-client-surface2-move-sfx.md
**Layer:** App (`apps/arena-client`)

## Before Starting

- [ ] Baseline green: `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; arena-client suite passes on `origin/main` @ `1733950b`.
- [ ] WP-412 is on `main`: `audioEngine.ts` exports `getAudioEngine(): AudioEngine` with `play(clipUrl)`; `play` lazy-loads any URL (EC-448 amendment); the unlock/mute/volume gates hold.
- [ ] `uiMoveName.types.ts` exports `UiMoveName` (incl. `playCard`, `recruitHero`, `fightVillain`, `drawCards`, `endTurn`) + the `SubmitMove` alias.
- [ ] `App.vue` defines the single `submitMove: SubmitMove` dispatch closure and mounts `useAnalyticsCapture()` in `setup`.
- [ ] The EXACT target file set is `## Files to Produce`. Any file outside it in `git diff --name-only` is a FAIL.

## Locked Values (do not re-derive)

- Manifest keys → filenames: `playCard→play-card.mp3`, `recruitHero→recruit-hero.mp3`, `fightVillain→attack-villain.mp3`, `drawCards→draw-cards.mp3`, `endTurn→end-turn.mp3`.
- Base URL: `https://images.legendary-arena.com/audio/sound-effects/` (hyphens, never underscores).
- Manifest type: `Partial<Record<UiMoveName, string>>` (partial by design — not exhaustive).
- `dodgeCard` stays UNMAPPED (engine-only move; no `UiMoveName` dispatch path).
- No new dependency (reuse WP-412 `howler` via `getAudioEngine()`).
- Wiring host: `App.vue`'s `submitMove` closure (the single dispatch host).
- Reserved decision: **D-24241** (land Active at close).

## Guardrails

- Dispatch-keyed, imperative — NO `watch`, NO `UIState` snapshot (a snapshot watch would miss `recruitHero` and delay the felt cues).
- Call `playMoveSound(name)` BEFORE `liveClient.value?.submitMove(name, args)` — the cue tracks the local action, ahead of the authoritative result.
- Reuse `getAudioEngine()` wholesale — no new engine/control/channel; the existing unlock/mute/volume gates apply unchanged.
- Unmapped move = silent no-op, never a throw.
- Pure presentation: read no `UIState`, never write `G`/`ctx`; no runtime engine/registry import.
- `App.vue` edit is minimal + reversible-by-deleting-the-WP-files; no other `App.vue` behavior changes.

## Required `// why:` Comments

- `moveSfxManifest.ts` — the R2/hyphen hosting rule; the partial-not-exhaustive rationale; the `dodgeCard`-absent gap (engine-only, no dispatch path).
- `useMoveSounds.ts` — why dispatch-keyed not snapshot-watched (`recruitHero` has no event); the unmapped-name silent no-op; the injectable-engine test seam.
- `App.vue` — WP-421 Surface-2: fire the local tactile cue at the dispatch chokepoint, before relaying, independent of the authoritative result.

## Files to Produce

- `apps/arena-client/src/audio/moveSfxManifest.ts` — **new** — five move → CC0 URL partial map
- `apps/arena-client/src/audio/moveSfxManifest.test.ts` — **new** — drift pin (keys/filenames/host/hyphen/dodgeCard-absent)
- `apps/arena-client/src/composables/useMoveSounds.ts` — **new** — dispatch → clip player (injectable engine seam)
- `apps/arena-client/src/composables/useMoveSounds.test.ts` — **new** — mapped/unmapped/mute/real-engine tests
- `apps/arena-client/src/App.vue` — **modified (runtime-wiring — the single host)** — `useMoveSounds()` in `setup` + `playMoveSound(name)` in the `submitMove` closure

## After Completing

- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; `pnpm --filter arena-client test` passes.
- [ ] `git diff --name-only` shows only the five `## Files to Produce` paths.
- [ ] `moveSfxManifest.test.ts` pins the five keys, the locked filenames, the R2 host, the hyphen rule, and `dodgeCard`'s absence.
- [ ] D-24026 live-on-surface: on a deployed match, each of the five moves plays its clip; WP-412 mute silences it. The five CC0 clips are already live on R2 (GET-200, `audio/mpeg`, valid `ID3`) — so this is pending only the deploy + eyeball, not the asset upload.
- [ ] `docs/ai/STATUS.md` prepended — Surface-2 move SFX.
- [ ] `docs/ai/DECISIONS.md` — **D-24241** landed Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-421 checked off with the date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-421 node glyph `📝 → ✅`; `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells

- Reworking the cue into a `UIState`-snapshot watch (misses `recruitHero`; delays the felt cues) — it MUST fire on the local dispatch.
- Mapping `dodgeCard` (no dispatch path — an unfired clip; also breaks the drift test).
- Making the manifest an exhaustive `Record<UiMoveName, string>` (it is intentionally partial).
- Adding a new audio control / channel / dependency (reuse the WP-412 engine + master mute/volume).
- Calling `playMoveSound` AFTER relaying to the client (defeats the tactile-immediacy point).
