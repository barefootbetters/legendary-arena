# WP-419 — Arena-Client Surface-2 Player-Action Move SFX (tactile local feedback)

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`) — single layer; **zero engine / determinism / persistence footprint** (audio is pure presentation per ARCHITECTURE.md "engine owns truth; UI consumes read-only projections")
**Dependencies:** WP-412 (the audio layer foundation — `audioEngine` singleton, autoplay-unlock, mute/volume; the `getAudioEngine().play(url)` this reuses, incl. the EC-448 lazy-load-any-URL amendment). WP-100 (`UiMoveName` union + the `submitMove` dispatch chokepoint). Both landed on `main`.
**Lane:** Lightweight (D-24028) — single-session draft+execute; 4 code/test files + 1 same-layer runtime-wiring host (`App.vue`).
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `1733950b`.

---

## Session Context

WP-412 shipped the arena-client audio foundation (**Surface 1** — one clip per
resolved `NotableGameEvent`) and WP-413 added the tiered combo cue, both playing
through the shared `getAudioEngine()`. WP-412's own **Out of Scope** named
**Surface 2** — action-move tactile SFX (`playCard` / `recruitHero` /
`fightVillain` local feedback) — as a follow-on WP. This is that follow-on.

The ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/)
Surface-2 section is precise about the shape: the client **dispatches** these
moves, so it can play a sound on the **local action** for immediate tactile
feedback, **independent of** the authoritative result. Unlike Surface 1
(driven by a resolved-event stream) and the combo cue (driven by a played-effect
count), a move cue must fire on the **local dispatch** — the only signal for
`recruitHero` (which emits **no** notable event at all) and the earliest possible
signal for the rest (the authoritative frame may arrive turns later or be
rejected).

**Key client reality (verified this session):** every UI move flows through a
single chokepoint — the `submitMove` closure in `App.vue` (`SubmitMove =
(name: UiMoveName, args) => liveClient.value?.submitMove(name, args)`),
prop-drilled everywhere as `SubmitMove`. That closure is the natural, single
place to fire the Surface-2 cue on dispatch. This is a **different** host than
Surface 1 / the combo cue (both mount as snapshot-watch composables at
`PlayViewport`) — correctly so, because Surface 2 is dispatch-driven, not
projection-driven.

**`dodgeCard` gap (verified):** the ewiki Surface-2 table lists a sixth row,
`dodgeCard → dodge.mp3`. `dodgeCard` is an **engine-only** move
(`packages/game-engine/src/moves/dodgeCard.ts`); it is **not** in the
`UiMoveName` union and the click-to-play surface has **no dispatch path** for it,
so it **cannot** fire a Surface-2 cue today. It is out of scope here (mapping it
would not typecheck) and is left as a documented unfired-clip gap for a later
UI-affordance WP.

---

## Goal

After this session, `play.legendary-arena.com` plays a short tactile sound the
instant the player dispatches an action move — a card whoosh on `playCard`, a
purchase chime on `recruitHero`, a sword impact on `fightVillain`, a draw/shuffle
on `drawCards`, a soft pass-confirm on `endTurn`. A `moveSfxManifest` maps each
of these five `UiMoveName`s to a CC0 clip URL (hosted on R2, `audio/sound-effects/`);
a `useMoveSounds` composable returns a `playMoveSound(name)` function that plays
the mapped clip through the **existing WP-412 `getAudioEngine()`** (inheriting its
autoplay-unlock / mute / volume gates — no new engine, dependency, control, or
channel); and `App.vue`'s `submitMove` closure calls it on every dispatch, ahead
of relaying intent to the live client. An unmapped move (lobby / stage /
`resolve*`) is a silent no-op. The layer lives entirely in `apps/arena-client`,
reads **no** `UIState`, never writes `G`/`ctx`, and adds **zero** engine,
determinism, or replay footprint.

---

## User-Visible Impact

The game feels responsive to touch. Playing a card, recruiting a hero, attacking
a villain, drawing, and ending a turn each land with an immediate, satisfying
sound — fired on the click, not on a server round-trip — so the surface feels
alive even before the authoritative result paints. The existing WP-412 mute
toggle + volume slider already govern it (one master SFX channel); nothing plays
before the first-gesture unlock.

---

## Assumes

- WP-412 landed: `apps/arena-client/src/audio/audioEngine.ts` exports
  `getAudioEngine(): AudioEngine` with `play(clipUrl: string)`, and (per the
  EC-448 amendment) `play` **lazily constructs + caches** a `Howl` for any URL
  not in the preloaded `sfxManifest` set — so a move clip URL plays without being
  added to any preload manifest. The engine applies its own unlock / mute /
  volume gates on every `play`.
- `apps/arena-client/src/components/play/uiMoveName.types.ts` exports the
  `UiMoveName` union (incl. `playCard`, `recruitHero`, `fightVillain`,
  `drawCards`, `endTurn`) and the `SubmitMove` alias.
- `apps/arena-client/src/App.vue` defines the single `submitMove: SubmitMove`
  dispatch closure at the app root and prop-drills it as `SubmitMove`. It already
  mounts an app-root composable (`useAnalyticsCapture()`) in `setup`.
- `howler` is already an `apps/arena-client` dependency (WP-412) — **no new
  dependency** is added.
- `pnpm -r build` exits 0; arena-client suite + `typecheck` (vue-tsc) pass on
  `1733950b`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/arena-client/src/audio/sfxManifest.ts` — the Surface-1 manifest this
  mirrors (the `Record<...,string>` drift pin, the `images.legendary-arena.com/
  audio/sound-effects/` base-URL + hyphenated-filename convention). Surface 2 is
  a **partial** map over `UiMoveName` (not every move gets a sound), so it uses
  `Partial<Record<UiMoveName, string>>` rather than an exhaustive `Record`.
- `apps/arena-client/src/composables/useComboCue.ts` — the sibling consumer whose
  style this mirrors: the filename-first JSDoc, the `@see` block, the
  `engine: AudioEngine = getAudioEngine()` injectable test seam, the `// why:`
  rationale comments. Surface 2 differs in that it is **imperative** (no `watch`,
  no snapshot) — a move cue fires on dispatch, not on a projected frame.
- `apps/arena-client/src/App.vue` — the `submitMove` dispatch closure (the single
  wiring host) and the `useAnalyticsCapture()` app-root composable precedent.
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — the `UiMoveName`
  union the manifest keys on (the compile-time drift pin).
- `docs/ai/ARCHITECTURE.md` — engine owns truth / UI consumes read-only
  projections; the audio layer never writes `G`, never affects an outcome.
- ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/) — the
  design source: the Surface-2 table (move → character → clip path), the
  "dispatch on the local move for tactile feedback, independent of the result"
  rule, the `recruitHero`-has-no-result-event note, and the hyphenated R2 path
  convention.

---

## Non-Negotiable Constraints

**App-wide (always apply):**
- The audio layer is **pure presentation**: it reads no `UIState`, **never**
  writes `G`/`ctx`, never affects move validation, never branches engine logic.
  Determinism, replays, and bot-vs-bot sims are unaffected (none render audio).
- No runtime `@legendary-arena/registry` / `@legendary-arena/game-engine/setup`
  import; the only engine surface used is the **type-only** `UiMoveName` (which
  is a UI-side type, not an engine import at all).
- ESM only; Vue 3 SFCs; test files `*.test.ts` (`node:test`, no
  `boardgame.io/testing`).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Surface 2 only.** The five dispatchable action moves → one clip each. Surface
  1 (WP-412), the combo cue (WP-413), Surface 3 (turn-lifecycle cues), and
  background music are unchanged / out of scope.
- **Dispatch-keyed, no watch.** The cue fires from the `submitMove` closure on
  the LOCAL dispatch — it must NOT be reworked into a `UIState`-snapshot watch
  (that would miss `recruitHero`, which emits no event, and would delay the
  felt-immediately cues).
- **Reuse the WP-412 engine wholesale.** `getAudioEngine()` only — no new engine,
  no new dependency, no new control, no second channel. The engine's existing
  unlock / mute / volume gates apply unchanged.
- **Partial manifest.** Only felt player actions carry a clip; lobby / stage /
  `resolve*` moves are silent (unmapped = no-op, never a throw).
- **`dodgeCard` stays unmapped.** No client dispatch path exists; mapping it would
  add an unfired clip (and would not typecheck against `UiMoveName`). Its absence
  is pinned by a test.
- **Audio bytes are hosted, not committed.** CC0 clips live on R2 under
  `audio/sound-effects/` (served via `images.legendary-arena.com`, the ewiki
  rule); the manifest references them by absolute URL. No audio in git.
- No new engine event, no `G` field, no `UIState` change.

**Locked contract values (do not re-derive):**
- **New dependency:** NONE (reuses WP-412's `howler`).
- **Manifest keys → clip filenames** (the locked ewiki Surface-2 table):
  `playCard → play-card.mp3`, `recruitHero → recruit-hero.mp3`,
  `fightVillain → attack-villain.mp3`, `drawCards → draw-cards.mp3`,
  `endTurn → end-turn.mp3`.
- **R2 prefix:** `audio/sound-effects/` on `images.legendary-arena.com`.
- **Wiring host:** `App.vue`'s `submitMove` closure (the single dispatch host).
- **Reserved decision:** **D-24239** (land Active at close).

---

## Debuggability & Diagnostics

- `useMoveSounds` is unit-testable with an injected recording engine (assert the
  mapped clip is played, unmapped names are no-ops, mute skips) and with the real
  `createAudioEngine(mockHowlFactory)` (assert the arm gate + the EC-448
  lazy-load path) — no real audio, asset-independent.
- `moveSfxManifest` is a static map — a drift test pins the five keys, their
  locked filenames, the R2 host, the hyphen rule, and `dodgeCard`'s absence.
- No engine/`G` interaction: `JSON.stringify` of engine state is untouched; the
  layer is invisible to replays and sims.

---

## Scope (In)

### A) Move-SFX manifest (`apps/arena-client/src/audio/moveSfxManifest.ts`, **new**)
- A `Partial<Record<UiMoveName, string>>` mapping the five action moves to their
  CC0 clip URL under `audio/sound-effects/`. Deliberately partial (not
  exhaustive over `UiMoveName`). The type is the compile-time drift pin.

### B) Move-cue consumer (`apps/arena-client/src/composables/useMoveSounds.ts`, **new**)
- `useMoveSounds(engine = getAudioEngine())` returns
  `(name: UiMoveName) => void` — looks up `moveSfxManifest[name]` and plays it
  through the engine; an unmapped name is a silent no-op. No `watch`, no
  snapshot. The `engine` parameter is the injectable test seam.

### C) Wiring (`apps/arena-client/src/App.vue`, **modified** — the single runtime-wiring host)
- In `setup`, build the player once (`const playMoveSound = useMoveSounds();`,
  beside the `useAnalyticsCapture()` app-root precedent). In the existing
  `submitMove` closure, call `playMoveSound(name)` **before**
  `liveClient.value?.submitMove(name, args)`. The edit adds one composable
  instantiation + one call at the dispatch site — reversible by deleting the
  WP-419 files; no other `App.vue` behavior changes.

### D) Tests
- `moveSfxManifest.test.ts` — the five keys mapped to their locked filenames;
  non-empty `images.legendary-arena.com/audio/sound-effects/` URLs; hyphen rule;
  `dodgeCard` NOT mapped.
- `useMoveSounds.test.ts` — each mapped move plays its clip; fires per dispatch
  (no coalescing); unmapped moves are no-ops; mute skips; the real-engine
  lazy-load + unlock-gate integration path.

---

## Out of Scope

- **`dodgeCard` / a dodge UI affordance** — engine-only move, no `UiMoveName`
  dispatch path; adding one (union member + a UI control) is a separate WP. Left
  as a documented unfired-clip gap.
- **Surface 3** (turn-lifecycle cues) and **background / adaptive music** —
  follow-on WPs.
- **Surface 1 / the combo cue** — unchanged (WP-412 / WP-413).
- **A new audio control / a per-move volume / a separate move channel** — the
  WP-412 master SFX mute/volume governs Surface 2.
- **Any engine change** — no `G` field, no new move, no `UIState` change, no
  determinism/replay impact.
- **Audio asset production** — sourcing / encoding / uploading the five CC0 move
  clips to R2 is an operator/ops step (the code + tests are asset-independent via
  a mocked `Howl`); live-on-surface verification depends on the assets being
  present — **already met**: the five clips are live on R2 (GET-200, `audio/mpeg`,
  valid `ID3`), verified this session (mirrors WP-412's assets leg, PR #916).
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `apps/arena-client/src/audio/moveSfxManifest.ts` — **new** — five move → CC0 URL partial map
- `apps/arena-client/src/audio/moveSfxManifest.test.ts` — **new** — drift pin (keys / filenames / host / hyphen / dodgeCard-absent)
- `apps/arena-client/src/composables/useMoveSounds.ts` — **new** — dispatch → clip player (injectable engine seam)
- `apps/arena-client/src/composables/useMoveSounds.test.ts` — **new** — mapped/unmapped/mute/real-engine tests
- `apps/arena-client/src/App.vue` — **modified (runtime-wiring — the single host)** — `useMoveSounds()` in `setup` + `playMoveSound(name)` in the `submitMove` closure

No other files may be modified. The wiring host is `App.vue` (recorded in the EC).

---

## Vision Alignment

N/A on the §17.1 trigger surfaces: no scoring/PAR/leaderboards, no identity, no
multiplayer sync, no card-data/content-semantics change. **Monetization note:**
audio is a retention / perceived-quality lever, not a revenue vector — sound
never gates play and never becomes pay-to-win. **Determinism note:** the audio
layer is pure client presentation — it reads no `UIState`, never writes `G`/`ctx`,
and adds **zero** engine/determinism/replay footprint (sims and replays render no
audio). NG-1..7 preserved.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the
layer fires on a local dispatch and fetches static R2 clips.

---

## Acceptance Criteria

All items are binary pass/fail.

- [ ] `moveSfxManifest` maps exactly the five action-move keys (`playCard`,
      `recruitHero`, `fightVillain`, `drawCards`, `endTurn`) to their locked
      `audio/sound-effects/` filenames; the drift test fails on a dropped/renamed
      key or a wrong filename.
- [ ] `moveSfxManifest` does **not** map `dodgeCard` (pinned by test).
- [ ] `useMoveSounds()(name)` plays the mapped clip through the engine for a
      mapped move, and is a silent no-op for an unmapped move; it fires once per
      dispatch (no coalescing) and skips when the engine is muted.
- [ ] The cue reuses `getAudioEngine()` — no new dependency, engine, control, or
      channel; the engine's unlock/mute/volume gates apply unchanged.
- [ ] `App.vue`'s `submitMove` closure calls `playMoveSound(name)` before
      relaying intent; the layer writes no `G`/`ctx` and adds no
      engine/determinism footprint (App-only diff; engine suites untouched).
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0;
      `pnpm --filter arena-client test` passes; `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified
      (`git diff --name-only`).

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

# Step 3 — manifest maps the five moves, not dodgeCard
Select-String -Path "apps\arena-client\src\audio\moveSfxManifest.ts" -Pattern "playCard|recruitHero|fightVillain|drawCards|endTurn"
Select-String -Path "apps\arena-client\src\audio\moveSfxManifest.ts" -Pattern "dodgeCard"
# Expected: the five keys present; the dodgeCard search returns only the why-comment (no mapping)

# Step 4 — no engine footprint
git diff --name-only
# Expected: only apps/arena-client/** files (+ the recorded App.vue wiring host)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
      D-24026):** in a **real deployed match**, dispatching a card play / recruit
      / fight / draw / end-turn plays its move sound immediately; the WP-412 mute
      toggle silences it — observed on the deployed bundle. The five CC0 move
      clips are already live on R2 (GET-200, `audio/mpeg`, valid `ID3`), so this
      is pending only the deploy + eyeball; green tests + merge alone do NOT
      satisfy it.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0;
      arena-client suite passes.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated — Surface-2 move SFX.
- [ ] `docs/ai/DECISIONS.md` updated — land **D-24239** as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-419 checked off with the date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-454 row Status `Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-419 node glyph `📝 → ✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections; `Out of Scope` lists ≥2 excluded items (dodge affordance, Surface 3, music, new control/channel, engine change, asset production).
- **§2 Constraints** — PASS. App-wide + packet-specific + locked values; references 00.6.
- **§3 Assumes** — PASS. WP-412 (`getAudioEngine`/lazy-load), WP-100 (`UiMoveName`/`submitMove`) exact exports/paths + green baseline `1733950b`.
- **§4 Context (Read First)** — PASS. Specific files (the Surface-1 manifest, the combo-cue sibling, the App.vue dispatch host, the move-name type) + the ewiki design. No `00.2` reference: no card-data/setup-field change.
- **§5 Files** — PASS. 4 new + 1 recorded wiring host; single App layer; cohesive. Lightweight-Lane budget (≤4 code/test + 1 same-layer wiring).
- **§6 Naming** — PASS. `moveSfxManifest`, `useMoveSounds`, `playMoveSound`; no abbreviations.
- **§7 Dependency discipline** — PASS. **No new dependency** — reuses WP-412's `howler` via `getAudioEngine()`.
- **§8 Architectural boundaries** — PASS. App layer only; the only engine-adjacent surface is the type-only UI `UiMoveName`; no runtime engine/registry import, no `G` write.
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. None introduced (clip URLs are static R2 paths).
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. arena-client `node:test` + a mocked `Howl` / recording engine (asset-independent); `typecheck` gated; no `boardgame.io/testing`.
- **§13 Verification** — PASS. Exact `pnpm` commands + expected output; the client `typecheck` gate is explicit.
- **§14 Acceptance criteria** — PASS. Binary, observable.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/EC_INDEX/mindmap + scope check; `User-Visible Surface = play.legendary-arena.com` ⇒ §15.1 live-on-surface (D-24026) present, with the asset-prerequisite noted honestly.
- **§16 Code style** — PASS. Composable + a static manifest, `// why:` on the no-op/lookup + wiring rationale, no abbreviations.
- **§17 Vision Alignment** — N/A (declared) + monetization + determinism notes: audio is retention polish, never pay-to-win; pure client presentation, zero determinism footprint.
- **§18 Prose-vs-grep** — PASS. Verification Step 3 greps `moveSfxManifest.ts` (source-file scoped, not the WP).
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding affordance/channel/copy.
- **§21 API Catalog** — N/A. No HTTP endpoint / `apps/server/src/**` library function.

**Lint verdict: PASS (all 21 resolved; 7 N/A each justified; §7 = no new dependency).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-07-24).**

- **Sequencing / dependencies:** WP-412 (`getAudioEngine().play(url)` + the
  EC-448 lazy-load-any-URL amendment) and WP-100 (`UiMoveName` + the `submitMove`
  chokepoint) are on `main`; verified by direct source read of `audioEngine.ts`,
  `uiMoveName.types.ts`, and `App.vue`.
- **Green baseline:** `main @ 1733950b`.
- **Scope lock:** closed allowlist; `git diff --name-only` is a DoD gate; one
  recorded wiring host (`App.vue`).
- **Contract fidelity:** the manifest keys on the locked ewiki Surface-2 table
  (five moves, hyphenated filenames); the consumer is dispatch-imperative (no
  snapshot watch), correctly distinct from Surface 1 / the combo cue.
- **RS-1 (RESOLVED):** the wiring host is `App.vue`'s `submitMove` closure — the
  single UI dispatch chokepoint (prop-drilled as `SubmitMove`), a **different**
  host than Surface 1 / the combo cue's `PlayViewport` snapshot-watch, because
  Surface 2 is dispatch-driven. Recorded as the single runtime-wiring host in the
  EC.
- **PS items (blocking):** none. (The five CC0 move clips are already live on R2 —
  GET-verified 200 / `audio/mpeg` / valid `ID3` — so the D-24026 asset
  prerequisite is already met; live verification is pending only the deploy +
  eyeball.)

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (2026-07-24).** Additive, single App layer,
well-precedented (mirrors the WP-412/413 manifest+consumer pattern; reuses the
shared engine), no engine/determinism risk, no new dependency.

Selected findings:
- **#1 / #9 (layer boundary)** — PASS. Client-only; the only engine-adjacent
  surface is the type-only UI `UiMoveName`; no runtime engine/registry import, no
  `G` write.
- **#2 (determinism)** — PASS. Zero engine footprint; audio is invisible to
  replays/sims (the AC pins an App-only diff + untouched engine suites).
- **#7 (new dependency)** — PASS. None — reuses WP-412's `howler`.
- **#12 (scope creep)** — PASS. Surface-2 five moves only; `dodgeCard` /
  Surface 3 / music explicitly deferred; closed allowlist + `git diff` gate.
- **#26 (implicit content semantics)** — PASS. The move↔clip mapping is an
  explicit manifest, drift-pinned; no card-data change.

**Disposition: CONFIRM** — execution authorized (Lightweight Lane, same session).

---

## Reserved Decisions (land at execution)

- **D-24239 (reserved; land Active at execution)** — The arena-client gains the
  **Surface-2 player-action-move tactile SFX** layer for
  `play.legendary-arena.com`, locked as follows. (1) **Trigger:** the cue fires on
  the **local move dispatch** (the single `App.vue` `submitMove` chokepoint),
  **before** relaying intent to the live client and **independent of** the
  authoritative result — the correct signal because `recruitHero` emits no
  notable event and the felt-immediately cues must not wait on a projected frame.
  This is deliberately distinct from Surface 1 (`useSoundEffects`, resolved-event
  stream) and the combo cue (`useComboCue`, played-effect scalar). (2)
  **Coverage:** the five dispatchable action moves — `playCard`, `recruitHero`,
  `fightVillain`, `drawCards`, `endTurn` — via a **partial** `moveSfxManifest`
  over `UiMoveName` (lobby / stage / `resolve*` moves are silent). (3)
  **`dodgeCard`:** the ewiki Surface-2 table's sixth row cannot fire — it is an
  engine-only move with no `UiMoveName` dispatch path; it stays unmapped (its
  absence is test-pinned) as a documented gap for a later UI-affordance WP. (4)
  **Engine reuse:** plays through the WP-412 `getAudioEngine()` wholesale —
  **no** new engine, dependency, control, or channel; the existing
  autoplay-unlock / master mute / master volume gates apply unchanged (the
  EC-448 lazy-load-any-URL amendment covers the move clips, which are not in the
  preloaded `sfxManifest` set). (5) **Architecture:** pure client presentation —
  reads no `UIState`, never writes `G`/`ctx`, zero engine/determinism/replay
  footprint. (6) **Assets:** CC0-first, hosted on R2 under `audio/sound-effects/`
  (hyphenated filenames), never in git. Advances the ewiki Sound Effects
  Surface-2 coverage; Surface 3 + music remain follow-ons.

---

## See Also

- [WP-412](WP-412-arena-client-audio-layer-foundation.md) / D-24224 — the audio
  layer foundation (`getAudioEngine`, unlock, mute/volume) this reuses.
- [WP-413](WP-413-arena-client-tiered-combo-cue.md) / D-24228 — the sibling
  follow-on cue (`useComboCue`) whose manifest+consumer style this mirrors.
- ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/) — the
  design source (the Surface-2 move table; dispatch-for-tactile-feedback;
  `recruitHero`-has-no-event; the hyphenated R2 path rule).
