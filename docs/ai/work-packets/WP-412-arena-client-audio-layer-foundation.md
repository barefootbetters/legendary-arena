# WP-412 — Arena-Client Audio Layer Foundation (notable-event SFX, unlock, mute/volume)

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`) — single layer; **zero engine / determinism / persistence footprint** (audio is pure presentation per ARCHITECTURE.md "engine owns truth; UI consumes read-only projections")
**Dependencies:** WP-200 (`G.notableEvents` → `UIState.notableEvents` projection + `NotableGameEvent` union), WP-201 (`useNotableEventStream` — the overlay-consumer sibling this parallels). Both landed on `main`.
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `2ba385d1` (WP-409 exec).

---

## Session Context

The ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/)
design reference specs a full client audio system; its Open Questions note the
first step is **"a WP defining the audio layer's contract, the SFX/music
mute-volume UX, and initial event coverage."** This WP is exactly that
**foundation** — the reusable arena-client audio layer that every later audio
feature sits on. It ships the buildable, user-visible v1: a howler.js SFX
engine, an autoplay-unlock gesture, persistent mute/volume, and **Surface 1**
coverage — one CC0 clip per notable game event, riding the already-projected
`UIState.notableEvents` stream with **zero engine work**.

The richer audio features are deliberate **follow-on WPs** on top of this
foundation: the **tiered combo cue** (which consumes WP-409's
`UIState.game.lastPlayEffectsFired` — hard-deps WP-412 **+** WP-409), the
**adaptive danger-meter background music** (a separate music channel), and the
Surface-2 action / Surface-3 turn cues. Keeping v1 to Surface-1 SFX + the
mute/volume + unlock UX makes it a coherent, shippable slice.

**Key engine reality (verified this session):** `useNotableEventStream`
(WP-201) surfaces **one event at a time** through a 2.5 s auto-dismiss queue for
the visual overlay — the wrong shape for audio, which must fire a clip on
**every** newly-appended event immediately. So the audio consumer is a
**sibling** composable with its own append-only cursor over
`UIState.notableEvents` (mirroring `useNotableEventStream`'s catch-up-then-emit
logic, minus the throttle), not a reuse of the overlay stream.

---

## Goal

After this session, `play.legendary-arena.com` plays a short sound effect when a
notable game event resolves. A howler.js-backed audio engine loads a manifest of
CC0 clips (hosted on R2); a `useSoundEffects` composable watches
`UIState.notableEvents` and plays the clip mapped to each **newly-appended**
event's `type` (the six `NotableGameEventType` variants); an autoplay-unlock
gesture arms audio on the first user interaction; and a persistent mute toggle +
master volume (localStorage) let players control it. The layer lives **entirely
in `apps/arena-client`**, reads only `UIState`, never writes `G`/`ctx`, and adds
**zero** engine, determinism, or replay footprint. No background music, no combo
cue, no new engine event.

---

## User-Visible Impact

Players hear the game. A Master Strike lands with a dramatic stinger, a villain
is defeated with a satisfying hit, a Scheme Twist with an ominous sting, and so
on — one clip per notable event, riding the same stream the center-screen
overlay already uses. A **mute toggle + volume slider** in the play HUD gives
immediate, persistent control (respecting the browser's autoplay policy: nothing
plays until the first interaction unlocks audio). This is the first sound in the
game.

---

## Assumes

- `packages/game-engine` projects `UIState.notableEvents: NotableGameEvent[]`
  (WP-200), a strictly append-only array (D-20004) of the six locked variants
  (`fightResolved`, `ambushResolved`, `schemeTwistResolved`,
  `mastermindStrikeResolved`, `mastermindDefeated`, `healResolved`).
- `apps/arena-client/src/composables/useNotableEventStream.ts` exists and
  exports the `NotableGameEvent = UIState['notableEvents'][number]` alias +
  the cursor/catch-up pattern this WP parallels for audio.
- The arena-client mounts a UIState snapshot ref at the play root
  (`PlayViewport` / `PlayDesktop` / `PlayMobile`) that the overlay already
  consumes; the audio layer mounts against the **same** snapshot.
- A localStorage settings precedent exists in the client
  (`useSkinApplier` / `SkinSelector`) for the mute/volume persistence pattern.
- `apps/arena-client` uses Vue 3 + `node:test`; `howler` is **not** currently a
  dependency (this WP adds it).
- `pnpm -r build` exits 0; arena-client suite + `typecheck` (vue-tsc) pass on
  `2ba385d1`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/arena-client/src/composables/useNotableEventStream.ts` — the sibling
  consumer: the `NotableGameEvent` alias, the append-only cursor, the
  catch-up-on-first-frame (no history replay) and per-index enqueue logic. The
  audio consumer copies the cursor/catch-up shape but fires a clip per event
  with **no** auto-dismiss throttle.
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — the existing
  per-variant consumer (chip labels keyed on `event.type`); the audio manifest
  keys on the same discriminator.
- The `useSkinApplier` / `SkinSelector` composable + component — the localStorage
  read/write + settings-UI precedent to mirror for mute/volume.
- The play root (`PlayViewport` / `PlayDesktop` / `PlayMobile`) — where the
  overlay stream is mounted; the audio engine + `useSoundEffects` mount once at
  the same root against the same snapshot.
- `docs/ai/ARCHITECTURE.md` — engine owns truth / UI consumes read-only
  projections; the audio layer never writes `G`, never affects an outcome, adds
  zero determinism footprint.
- ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/) —
  the design source: Surface 1 (notable events), the howler.js recommendation,
  CC0-first licensing, R2 hosting, the autoplay-unlock + persistent mute/volume
  requirement, and the browser-autoplay-policy edge case.
- [howler.js](https://howlerjs.com/) — the Web Audio wrapper (HTML5 fallback,
  cross-browser, built-in autoplay unlock, per-sound gain).
- `docs/ai/DECISIONS.md` — the reserved D-24224 at the tail of this WP.

---

## Non-Negotiable Constraints

**App-wide (always apply):**
- The audio layer is **pure presentation**: it reads `UIState` only, **never**
  writes `G`/`ctx`, never affects move validation, never branches engine logic.
  Determinism, replays, and bot-vs-bot sims are unaffected (none render audio).
- No runtime `@legendary-arena/registry` / `@legendary-arena/game-engine/setup`
  import; the engine surface is the `.` subpath (type-only `UIState`).
- ESM only; Vue 3 SFCs; test files `*.test.ts` (`node:test`, no
  `boardgame.io/testing`).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Surface 1 only.** v1 coverage is the six `NotableGameEventType` variants →
  one clip each. Action-move (Surface 2), turn-lifecycle (Surface 3), the combo
  cue, and background music are **out of scope** (follow-on WPs).
- **Own cursor, no throttle.** `useSoundEffects` maintains its **own**
  append-only cursor over `UIState.notableEvents` (catch up on first frame — no
  replay of pre-mount history; then play a clip per newly-appended event
  **immediately**). It does **not** reuse `useNotableEventStream`'s one-at-a-time
  2.5 s overlay queue.
- **Autoplay unlock is mandatory.** No audio plays before the first user
  gesture arms the audio context (howler's unlock + an explicit "armed" state);
  a pre-unlock event is silently skipped (never queued to blast on unlock).
- **Persistent, player-controlled.** A mute toggle + master volume (0..1)
  persist to localStorage (the `useSkinApplier` precedent) and are respected on
  every play. Default: unmuted, a conservative moderate volume.
- **Mute/volume is a single SFX channel** in v1. Separate SFX-vs-music channels
  arrive with the music follow-on WP (do not build a music channel here).
- **Audio bytes are hosted, not committed.** CC0 clips live on R2 under
  `audio/sound-effects/` (served via `images.legendary-arena.com`, the ewiki
  rule); the manifest references them by absolute URL. No audio in git.
- **CC0-first licensing.** Clips are CC0 (Kenney / OpenGameArt CC0), no
  attribution; any non-CC0 asset needs its credit tracked (avoid for v1).
- No new engine event, no `G` field, no `UIState` change — the layer consumes
  the existing projection.

**Session protocol:** if any contract or field name is unclear, stop and ask.

**Locked contract values (do not re-derive):**
- **New dependency:** `howler` (runtime) + `@types/howler` (dev), `apps/arena-client` only.
- **Manifest keys:** the six `NotableGameEventType` strings — `fightResolved`,
  `ambushResolved`, `schemeTwistResolved`, `mastermindStrikeResolved`,
  `mastermindDefeated`, `healResolved`.
- **R2 prefix:** `audio/sound-effects/` on `images.legendary-arena.com`.
- **Settings keys:** localStorage-persisted `isMuted` (boolean) + `volume` (0..1).
- **Consumer rule:** own cursor, catch up on first frame (no history replay),
  one clip per newly-appended event, no auto-dismiss throttle.

---

## Debuggability & Diagnostics

- The audio engine is unit-testable with a **mocked `Howl`** (assert
  play-called / muted-skips / volume-applied / unlock-gated) — no real audio in
  tests, asset-independent.
- `useSoundEffects` is deterministic over a UIState sequence: given appended
  events, it calls `play(clipKey)` exactly once per new event, never for
  pre-cursor history.
- No engine/`G` interaction: `JSON.stringify` of engine state is untouched; the
  layer is invisible to replays and sims.

---

## Scope (In)

### A) Dependency (`apps/arena-client/package.json`, **modified**)
- Add `howler` to `dependencies` and `@types/howler` to `devDependencies`.
  No other package gains the dependency (arena-client only; not in production
  bundles of engine/registry/server).

### B) Audio engine (`apps/arena-client/src/audio/audioEngine.ts`, **new**)
- A thin howler wrapper: preload the manifest clips as `Howl` instances, expose
  `play(clipKey)`, a global mute + master-volume gate, and the autoplay-unlock
  arming (`arm()` on first gesture; `play` is a silent no-op until armed or when
  muted). No singleton stored in `G`; module-local to the client.

### C) Clip manifest (`apps/arena-client/src/audio/sfxManifest.ts`, **new**)
- A `Record<NotableGameEventType, string>` mapping each of the six event types to
  a CC0 clip URL under `audio/sound-effects/` (e.g. `master-strike.mp3`,
  `villain-defeated.mp3`, …). Exhaustive over the union (a drift test pins all
  six are mapped).

### D) SFX consumer (`apps/arena-client/src/composables/useSoundEffects.ts`, **new**)
- `useSoundEffects(snapshot: Ref<UIState | null>)` — watches
  `UIState.notableEvents` with its own cursor; catches up to current length on
  the first valid frame (no replay); on each subsequent append, calls
  `audioEngine.play(sfxManifest[event.type])` for every new event in index
  order. Safe-skip on null snapshot / undefined `notableEvents`.

### E) Persistent settings (`apps/arena-client/src/composables/useAudioSettings.ts`, **new**)
- `isMuted` + `volume` reactive refs, initialized from and written back to
  localStorage (the `useSkinApplier` precedent), wired into the audio engine's
  mute/volume gate. Conservative defaults.

### F) Controls UI (`apps/arena-client/src/components/play/AudioControls.vue`, **new**)
- A small mute toggle + volume slider bound to `useAudioSettings`, plus the
  first-interaction arm. Mounted unobtrusively in the play HUD.

### G) Wiring (play root — `PlayViewport.vue` **or** `PlayDesktop.vue`/`PlayMobile.vue`, **modified**; `01.5` runtime-wiring)
- Mount the audio engine init + `useSoundEffects(snapshot)` once at the play
  root against the same UIState snapshot the overlay consumes, and place
  `AudioControls`. (`01.5` wiring — the exact host file is recorded in the EC.)

### H) Tests
- `audioEngine.test.ts` — mocked `Howl`: play dispatch, mute-skips, volume gate,
  unlock-gating (pre-arm no-op).
- `sfxManifest.test.ts` — exhaustive: all six `NotableGameEventType` keys mapped
  to a non-empty URL (drift pin over the union).
- `useSoundEffects.test.ts` — plays once per newly-appended event; no replay of
  pre-cursor history; safe-skip on null; respects mute.
- `useAudioSettings.test.ts` — localStorage round-trip (persist + rehydrate).
- `AudioControls.test.ts` — renders mute/volume; toggling updates settings.

---

## Out of Scope

- **Background / adaptive music** (the danger-meter score, a separate music
  channel, howler crossfades) — a follow-on WP on this foundation.
- **The tiered combo cue** — consumes WP-409's `UIState.game.lastPlayEffectsFired`;
  its own follow-on WP (hard-deps WP-412 + WP-409).
- **Surface 2** (action-move tactile SFX: `playCard`/`recruitHero`/`fightVillain`
  local feedback) and **Surface 3** (turn-lifecycle cues) — follow-on coverage.
- **The motif matrix** (per Music Authoring) — future.
- **Separate SFX vs. music volume channels** — arrive with the music WP; v1 is
  one master SFX channel + mute.
- **Any engine change** — no `G` field, no new `NotableGameEvent` variant, no
  `UIState` change, no determinism/replay impact.
- **Audio asset production** — sourcing/encoding/uploading the CC0 clips to R2 is
  an operator/ops step (the code + tests are asset-independent via a mocked
  `Howl`); live-on-surface verification depends on the assets being present.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `apps/arena-client/package.json` — **modified** — `howler` + `@types/howler`
- `apps/arena-client/src/audio/audioEngine.ts` — **new** — howler wrapper (play / mute / volume / unlock)
- `apps/arena-client/src/audio/sfxManifest.ts` — **new** — six event → CC0 URL map
- `apps/arena-client/src/composables/useSoundEffects.ts` — **new** — per-event SFX consumer (own cursor)
- `apps/arena-client/src/composables/useAudioSettings.ts` — **new** — localStorage mute/volume
- `apps/arena-client/src/components/play/AudioControls.vue` — **new** — mute/volume UI
- `apps/arena-client/src/audio/audioEngine.test.ts` — **new**
- `apps/arena-client/src/audio/sfxManifest.test.ts` — **new**
- `apps/arena-client/src/composables/useSoundEffects.test.ts` — **new**
- `apps/arena-client/src/composables/useAudioSettings.test.ts` — **new**
- `apps/arena-client/src/components/play/AudioControls.test.ts` — **new**
- Play root host (`PlayViewport.vue` **or** `PlayDesktop.vue`/`PlayMobile.vue`) — **modified (`01.5` wiring)** — mount the engine + `useSoundEffects` + `AudioControls`

No other files may be modified. The `01.5` wiring host is recorded in the EC.

---

## Vision Alignment

N/A on the §17.1 trigger surfaces: no scoring/PAR/leaderboards, no identity, no
multiplayer sync, no card-data/content-semantics change. **Monetization note:**
audio is a retention / perceived-quality lever, not a revenue vector — sound
never gates play and never becomes pay-to-win (a future cosmetic "sound pack"
would be an optional flourish only). **Determinism note:** the audio layer is
pure client presentation — it reads `UIState`, never writes `G`/`ctx`, and adds
**zero** engine/determinism/replay footprint (sims and replays render no audio).
NG-1..7 preserved.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the
layer consumes the boardgame.io `UIState` push and fetches static R2 clips.

---

## Acceptance Criteria

All items are binary pass/fail.

- [ ] `howler` is an `apps/arena-client` runtime dependency + `@types/howler`
      dev dependency; no other package gains it.
- [ ] `sfxManifest` maps **all six** `NotableGameEventType` variants to a
      non-empty `audio/sound-effects/` URL; the drift test fails if a variant is
      unmapped.
- [ ] `useSoundEffects` plays exactly one clip per **newly-appended**
      `notableEvents` entry, in index order; it **never** replays pre-mount
      history (catch-up cursor), and safe-skips a null snapshot.
- [ ] The audio engine is **unlock-gated** (no play before the first-gesture
      arm) and **mute/volume-gated** (muted ⇒ no play; volume applied).
- [ ] Mute + volume persist to localStorage and rehydrate on reload.
- [ ] The layer writes no `G`/`ctx` and adds no engine/determinism footprint
      (App-only diff; engine suites + sentinel hashes untouched).
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0;
      `pnpm --filter arena-client test` passes; `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified
      (`git diff --name-only`), save the recorded `01.5` wiring host.

---

## Verification Steps

```pwsh
# Step 1 — build everything
pnpm -r build
# Expected: exits 0

# Step 2 — arena-client typecheck + tests
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass (howler mocked; no real audio)

# Step 3 — manifest exhaustiveness (all six event types mapped)
Select-String -Path "apps\arena-client\src\audio\sfxManifest.ts" -Pattern "Resolved"
# Expected: the six NotableGameEventType keys present

# Step 4 — no engine footprint
git diff --name-only
# Expected: only apps/arena-client/** files (+ the recorded 01.5 wiring host)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
      D-24026):** in a **real deployed match**, a notable event (e.g. a villain
      defeated or a Master Strike) plays its sound; the mute toggle silences it
      and persists across reload — observed on the deployed bundle (requires the
      CC0 clips uploaded to R2; green tests + merge alone do NOT satisfy it).
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0;
      arena-client suite passes.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated — first sound in the game (Surface-1 SFX).
- [ ] `docs/ai/DECISIONS.md` updated — land **D-24224** as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-412 checked off with the date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-412 node glyph `📝 → ✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections; `Out of Scope` lists ≥2 excluded items (music, combo cue, Surfaces 2/3, motif, separate channels, engine change, asset production).
- **§2 Constraints** — PASS. App-wide + packet-specific + session protocol + locked values; references 00.6.
- **§3 Assumes** — PASS. WP-200 / WP-201 exact exports/paths + green baseline `2ba385d1`.
- **§4 Context (Read First)** — PASS. Specific files (the overlay sibling, the skin-settings precedent, the play root) + the ewiki design + howler. No `00.2` reference: no card-data/setup-field change (a client presentation layer, not a `00.2` contract).
- **§5 Files** — PASS. ~12 files, single layer (`apps/arena-client`), mostly new; a cohesive foundation. One `01.5` wiring host recorded in the EC.
- **§6 Naming** — PASS. `audioEngine`, `sfxManifest`, `useSoundEffects`, `useAudioSettings`, `AudioControls`; no abbreviations.
- **§7 Dependency discipline** — PASS **with justification**: `howler` is a NEW dependency — the ewiki-recommended, widely-used Web Audio wrapper (HTML5 fallback, cross-browser, built-in autoplay unlock). Confined to `apps/arena-client` (runtime dep + `@types/howler` dev); it never enters engine/registry/server bundles. D-24224 records the choice.
- **§8 Architectural boundaries** — PASS. App layer only; reads the typed `UIState` (`.` subpath), no runtime engine/registry import, no `G` write.
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. None introduced (clip URLs are static R2 paths in the manifest).
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. arena-client `node:test` + a mocked `Howl` (asset-independent); `typecheck` gated; no `boardgame.io/testing`.
- **§13 Verification** — PASS. Exact `pnpm` commands + expected output; the client `typecheck` gate is explicit.
- **§14 Acceptance criteria** — PASS. Binary, observable.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap + scope check; `User-Visible Surface = play.legendary-arena.com` ⇒ §15.1 live-on-surface (D-24026) present, with the asset-prerequisite noted honestly.
- **§16 Code style** — PASS. Composables + a thin wrapper, `// why:` on the unlock/mute gates and the cursor rule, no abbreviations.
- **§17 Vision Alignment** — N/A (declared) + monetization + determinism notes: audio is retention polish, never pay-to-win; pure client presentation, zero determinism footprint.
- **§18 Prose-vs-grep** — PASS. Verification Step 3 greps `sfxManifest.ts` for `Resolved` (source-file scoped, not the WP).
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding affordance/channel/copy.
- **§21 API Catalog** — N/A. No HTTP endpoint / `apps/server/src/**` library function.

**Lint verdict: PASS (all 21 resolved; 7 N/A each justified; §7 dependency justified).**

---

## Pre-Flight Verdict (01.4)

> Recorded at drafting; the executing session re-confirms against its own baseline.

**Verdict: READY TO EXECUTE (2026-07-21).**

- **Sequencing / dependencies:** WP-200 (notableEvents + `UIState.notableEvents`)
  and WP-201 (`useNotableEventStream` sibling) are on `main`; verified by direct
  source read of `useNotableEventStream.ts` (the `NotableGameEvent` alias + the
  append-only cursor pattern). No engine dependency; **no hard-dep on WP-409**
  (the combo cue is a follow-on).
- **Green baseline:** `main @ 2ba385d1`.
- **Scope lock:** closed allowlist; `git diff --name-only` is a DoD gate; one
  `01.5` wiring host recorded in the EC.
- **Contract fidelity:** the audio consumer mirrors `useNotableEventStream`'s
  cursor/catch-up (no history replay) but fires per-event with no throttle; the
  manifest keys on the six-variant discriminator the overlay already uses.
- **RS-1 (clarification, non-blocking):** the exact play-root host for the
  `01.5` wiring (`PlayViewport` vs `PlayDesktop`/`PlayMobile`) is the executor's
  call from the current mount structure; recorded in the EC once chosen.
- **PS items (blocking):** none. (Live D-24026 verification depends on the CC0
  clips being uploaded to R2 — an operator prerequisite, not a code blocker.)

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (2026-07-21).** Additive, single App layer,
well-precedented (mirrors the WP-201 overlay consumer + the skin-settings
localStorage pattern), no engine/determinism risk.

Selected findings:
- **#1 / #9 (layer boundary)** — PASS. Client-only; reads typed `UIState`, no
  runtime engine/registry import, no `G` write.
- **#2 (determinism)** — PASS. Zero engine footprint; audio is invisible to
  replays/sims (the AC pins an App-only diff + untouched engine suites).
- **#7 (new dependency)** — PASS with the §7 justification: `howler` is the
  ewiki-recommended wrapper, arena-client-scoped, D-24224-recorded.
- **#12 (scope creep)** — PASS. Surface-1 only; music / combo cue / Surfaces 2-3
  explicitly deferred to follow-on WPs; closed allowlist + `git diff` gate.
- **#26 (implicit content semantics)** — PASS. The clip↔event mapping is an
  explicit manifest, drift-pinned over the union; no card-data change.

**Disposition: CONFIRM** — session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24224 (reserved; Drafted 2026-07-21, not yet landed)** — The arena-client
  gains a **foundational audio layer** for `play.legendary-arena.com`, locked as
  follows. (1) **Architecture:** audio is pure client presentation — it lives
  entirely in `apps/arena-client`, reads only `UIState`, **never** writes
  `G`/`ctx`, never affects an outcome, and adds **zero** engine / determinism /
  replay footprint (per ARCHITECTURE.md engine-owns-truth). (2) **Wrapper:**
  **howler.js** is the audio engine (Web Audio + HTML5 fallback, cross-browser,
  built-in autoplay unlock), an arena-client-only dependency. (3) **Assets:**
  **CC0-first** licensing; clips are **hosted on R2** under `audio/sound-effects/`
  (served via `images.legendary-arena.com`) and referenced by URL — **no audio
  in git**. (4) **v1 coverage:** **Surface 1** — the six `NotableGameEventType`
  variants → one clip each, via a `useSoundEffects` consumer that keeps its **own
  append-only cursor** over `UIState.notableEvents` (catch up on first frame, no
  history replay, one clip per newly-appended event, **no** overlay-style
  throttle) — distinct from WP-201's one-at-a-time visual queue. (5) **UX:**
  an autoplay-unlock gesture and a **persistent mute + master volume**
  (localStorage) are required; v1 is a single SFX channel. (6) **Follow-ons:**
  the adaptive danger-meter **music** (separate channel), the **tiered combo
  cue** (consuming WP-409's `lastPlayEffectsFired`), and Surface-2 / Surface-3
  coverage are explicit later WPs on this foundation. Closes the ewiki Sound
  Effects "no WP scoped yet" Open Question for the SFX foundation.

---

## See Also

- [WP-200](WP-200-notable-game-event-log.md) / D-20002 — the `notableEvents`
  union + `UIState.notableEvents` projection this consumes.
- [WP-201] / `useNotableEventStream` — the overlay-consumer sibling this
  parallels for audio.
- [WP-409](WP-409-hero-play-synergy-effect-count-signal.md) / D-24221 — the combo-cue
  signal a **follow-on** audio WP will consume (not this one).
- ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/) —
  the design source (Surface 1, howler.js, CC0/R2, unlock + mute/volume).
