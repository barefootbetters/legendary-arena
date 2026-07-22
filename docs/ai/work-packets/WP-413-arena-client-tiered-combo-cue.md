# WP-413 — Arena-Client Tiered Combo Cue (hero-play synergy escalation SFX)

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`) — single layer; **zero engine / determinism / persistence footprint** (audio is pure presentation per ARCHITECTURE.md "engine owns truth; UI consumes read-only projections")
**Dependencies:** WP-409 / D-24221 (`UIState.game.lastPlayEffectsFired` — the hero-play effects-fired signal this consumes), WP-412 / D-24224 (the arena-client audio foundation: the howler engine, autoplay unlock, persistent mute/volume, and the `PlayViewport` `01.5` wiring host this reuses). Both landed on `main`.
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `ced4bcf4` (WP-412 exec, PR #913). Re-baseline to current `origin/main` at execution.

---

## Session Context

The ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/)
design specs a **tiered combo / synergy cue** — an escalating audio sting that
gets bigger the more a hero play does. Two follow-on WPs made it buildable:
**WP-409** shipped the honest engine signal (`UIState.game.lastPlayEffectsFired`
— the count of hero-ability effects that fired for the most recent play, a
public scalar), and **WP-412** shipped the arena-client **audio foundation**
(the howler.js engine with `play`/mute/volume/unlock, and the single `01.5`
wiring host at `PlayViewport.vue`). This WP is the **consumer** that finally
makes the combo cue audible: a client-only layer that watches
`lastPlayEffectsFired`, maps its value to a tier, and plays the tier's clip
through the **existing** WP-412 engine — no new engine, no new dependency, no
new audio control, zero engine footprint.

**Signal shape that shapes the consumer (verified this session).**
`lastPlayEffectsFired` is a **scalar**, not an append-only stream: it is
overwritten on every play and reset to `0` in the play-phase `onBegin`
(WP-409). So — unlike WP-412's `useSoundEffects`, which rides an index cursor
over the append-only `notableEvents` array — the combo consumer keys off a
**value change**: on each snapshot, if `lastPlayEffectsFired` changed from the
last-seen value and its tier is audible, fire the tier's clip. The per-turn
reset to `0` naturally re-arms an equal-value play across turns (a `3 → 0 → 3`
transition fires the second `3`). The one honest gap this leaves — **two
consecutive plays in the same turn with the same non-zero count coalesce to one
cue** — is a documented v1 limitation, not a bug (a per-play edge signal is a
deferred refinement; see Out of Scope).

---

## Goal

After this session, `play.legendary-arena.com` plays an **escalating combo
sting** when a hero play fires synergy effects: a `useComboCue` composable
watches `UIState.game.lastPlayEffectsFired`, maps the count to one of three
audible tiers via a pure `comboTierForCount` helper (`1 → small`, `2 → medium`,
`≥ 3 → big`; `≤ 0 → none`, silent), and plays the tier's CC0 clip through the
**WP-412 audio engine** (`getAudioEngine()`) — so it inherits that engine's
autoplay-unlock arm, master mute, and master volume for free. The layer lives
**entirely in `apps/arena-client`**, reads only `UIState`, never writes
`G`/`ctx`, and adds **zero** engine, determinism, or replay footprint. No new
engine signal, no new dependency, no new audio control, no music.

---

## User-Visible Impact

Players hear their **combos**. A one-effect play gives a light tick; a
two-effect play a bigger cue; a three-or-more-effect synergy play the full
escalating sting — immediate, satisfying feedback that a hero play "did a lot,"
scaling with WP-409's real effects-fired count. It rides the same single SFX
channel the notable-event SFX already use, so the existing mute toggle silences
it and the volume slider scales it (no new control). Nothing plays before the
first user gesture unlocks audio (the WP-412 arm), and nothing plays while muted.

---

## Assumes

- `packages/game-engine` projects `UIState.game.lastPlayEffectsFired: number`
  (WP-409 / D-24221) — a **public** scalar (no audience redaction), the count
  of hero-ability effects that fired for the most recent play, reset to `0` in
  the play-phase `onBegin` and overwritten per play.
- `apps/arena-client/src/audio/audioEngine.ts` (WP-412) exports
  `getAudioEngine()` (the module singleton), `createAudioEngine(howlFactory)`,
  and the `AudioEngine` interface with `play(clipUrl)` gated by the
  autoplay-unlock arm + master mute + master volume, plus the
  `__setAudioEngineForTests` / `__resetAudioEngineForTests` test hooks.
- `apps/arena-client/src/audio/sfxManifest.ts` (WP-412) is the manifest
  precedent: absolute CC0 clip URLs under
  `https://images.legendary-arena.com/audio/sound-effects/`.
- `apps/arena-client/src/composables/useSoundEffects.ts` (WP-412) is the
  sibling consumer precedent (own-state watcher over the `useUiStateStore`
  snapshot, catch-up-on-first-frame, `engine.play(...)` with a defaulted
  injectable engine seam for tests).
- `apps/arena-client/src/pages/PlayViewport.vue` (WP-412) is the single `01.5`
  wiring host: its `setup` already reads the `useUiStateStore` snapshot
  (`storeToRefs`) and mounts `useSoundEffects(snapshot)`. The combo consumer
  mounts at that same root, reading that same snapshot.
- `apps/arena-client` uses Vue 3 + `node:test`; `@vue/test-utils` +
  `testing/jsdom-setup` are the component/DOM test precedents.
- `pnpm -r build` exits 0; arena-client suite + `typecheck` (vue-tsc) pass on
  `ced4bcf4`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/arena-client/src/composables/useSoundEffects.ts` — the WP-412 sibling
  consumer to parallel: the own-state watcher, the catch-up-on-first-frame
  (no history replay), the defaulted `engine` injection seam, and the
  `engine.play(...)` call. The combo consumer copies that shape but watches a
  **scalar value change** instead of an append-only cursor.
- `apps/arena-client/src/audio/sfxManifest.ts` — the WP-412 manifest shape to
  mirror: a keyed `Record` of absolute `audio/sound-effects/` URLs, a
  compile-time exhaustiveness pin, and a drift test.
- `apps/arena-client/src/audio/audioEngine.ts` — `getAudioEngine()` +
  `AudioEngine.play(clipUrl)` (the arm / mute / volume gate the combo cue
  inherits) + the test hooks.
- `apps/arena-client/src/pages/PlayViewport.vue` — the single `01.5` host; the
  combo consumer mounts beside `useSoundEffects(snapshot)` in `setup`.
- `packages/game-engine/src/ui/uiState.types.ts` — `UIState.game.lastPlayEffectsFired`
  (the signal; public, `number`).
- `docs/ai/DECISIONS.md` — D-24221 (the signal), D-24224 (the audio
  foundation), and the reserved **D-24228** at the tail of this WP.
- ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/)
  §"Tiered combo / synergy cue" — the design source (escalation, CC0/R2).

---

## Non-Negotiable Constraints

**App-wide (always apply):**
- The combo cue is **pure presentation**: it reads `UIState` only, **never**
  writes `G`/`ctx`, never affects move validation, never branches engine logic.
  Determinism, replays, and bot-vs-bot sims are unaffected (none render audio).
- No runtime `@legendary-arena/registry` / `@legendary-arena/game-engine/setup`
  import; the engine surface is the `.` subpath (type-only `UIState`).
- ESM only; Vue 3 SFCs; test files `*.test.ts` (`node:test`, no
  `boardgame.io/testing`).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Reuse the WP-412 engine — do not build a new one.** The combo cue plays
  through `getAudioEngine()`; it inherits that engine's autoplay-unlock arm,
  master mute, and master volume. **No** new `Howl` wrapper, **no** new audio
  control, **no** new dependency, **no** second SFX channel.
- **Tier mapping (locked).** `comboTierForCount(count)`: `count <= 0 → 'none'`
  (silent — no cue), `count === 1 → 'small'`, `count === 2 → 'medium'`,
  `count >= 3 → 'big'`. A pure function; three audible tiers plus a silent
  floor.
- **Scalar-change consumer (locked).** `useComboCue` keeps its **own** last-seen
  `lastPlayEffectsFired`; catches up on the first valid frame (seed last-seen to
  the current value — **no** cue for the pre-mount value); on each subsequent
  snapshot where the value **changed** AND `comboTierForCount(value)` is audible
  (`!== 'none'`), plays the tier's clip **once**. It is NOT an append-only
  cursor (the signal is a scalar, not a stream).
- **Documented v1 limitation (accepted).** Two consecutive plays in the **same
  turn** with the **same non-zero count** coalesce to one cue (the scalar does
  not change). This is acceptable for v1; a per-play edge signal is a deferred
  follow-on (Out of Scope). The per-turn reset to `0` re-arms equal-value plays
  **across** turns.
- **Audio bytes are hosted, not committed.** Three CC0 combo clips live on R2
  under `audio/sound-effects/` (served via `images.legendary-arena.com`, the
  ewiki rule); the manifest references them by absolute URL. No audio in git.
- **CC0-first licensing.** Clips are CC0 (Kenney / OpenGameArt CC0), no
  attribution.
- No new engine event, no `G` field, no `UIState` change — the layer consumes
  the existing WP-409 projection.

**Session protocol:** if any contract or field name is unclear, stop and ask.

**Locked contract values (do not re-derive):**
- **No new dependency** — reuses WP-412's `howler` via `getAudioEngine()`.
- **Tier type:** `ComboTier = 'none' | 'small' | 'medium' | 'big'`.
- **Tier thresholds:** `<= 0 → none`, `1 → small`, `2 → medium`, `>= 3 → big`.
- **Manifest keys:** the three audible tiers (`small`, `medium`, `big`) → CC0
  URLs under `audio/sound-effects/` on `images.legendary-arena.com`
  (`combo-small.mp3`, `combo-medium.mp3`, `combo-big.mp3`). `'none'` is NOT in
  the manifest (the consumer skips it).
- **Consumer rule:** own last-seen scalar; catch up on first frame (no cue for
  the pre-mount value); play once per audible value-change; ride the shared
  engine's mute/volume/unlock gate.
- **Signal source:** `UIState.game.lastPlayEffectsFired` (public scalar; safe
  `?? 0` on a null/absent snapshot).

---

## Debuggability & Diagnostics

- The tier helper is a pure, exhaustively unit-testable function
  (`comboTierForCount(0..N)` → the locked tiers).
- `useComboCue` is deterministic over a scalar sequence: given a UIState
  sequence, it calls `engine.play(comboCueManifest[tier])` exactly once per
  audible value-change and never for the pre-mount value; equal-consecutive
  values within a turn coalesce (the documented limitation).
- No engine/`G` interaction: `JSON.stringify` of engine state is untouched; the
  layer is invisible to replays and sims. Mute/volume/unlock behavior is the
  WP-412 engine's (a muted or pre-arm engine no-ops the play).

---

## Scope (In)

### A) Combo-cue manifest + tier helper (`apps/arena-client/src/audio/comboCueManifest.ts`, **new**)
- Export `ComboTier = 'none' | 'small' | 'medium' | 'big'`.
- Export `comboTierForCount(count: number): ComboTier` — the pure locked
  mapping (`<= 0 → none`, `1 → small`, `2 → medium`, `>= 3 → big`).
- Export `comboCueManifest: Record<Exclude<ComboTier, 'none'>, string>` — the
  three audible tiers → CC0 clip URLs under `audio/sound-effects/`. Exhaustive
  over the audible tiers (a drift test pins all three mapped, non-empty).

### B) Combo-cue consumer (`apps/arena-client/src/composables/useComboCue.ts`, **new**)
- `useComboCue(snapshot: Ref<UIState | null>, engine: AudioEngine = getAudioEngine()): void`
  — watches `snapshot.value?.game.lastPlayEffectsFired`; keeps its own last-seen
  value; catches up on the first valid frame (no cue for the pre-mount value);
  on each subsequent audible value-change, calls
  `engine.play(comboCueManifest[tier])`. Safe-skip on null snapshot / absent
  `game`. The engine (WP-412) applies the mute/volume/unlock gate.

### C) Wiring (`src/pages/PlayViewport.vue`, **modified**; `01.5` runtime-wiring — the SAME single host)
- In `PlayViewport.vue`'s `setup`, beside the existing
  `useSoundEffects(audioSnapshot)` (WP-412), mount `useComboCue(audioSnapshot)`
  reading the **same** `useUiStateStore` snapshot. No new wiring host, no new
  prop chain, no template change (the combo cue has no UI — it reuses the WP-412
  `AudioControls`).

### D) Tests
- `comboCueManifest.test.ts` — `comboTierForCount` exhaustive over the tier
  boundaries (`0 → none`, `1 → small`, `2 → medium`, `3/4/… → big`, negative →
  none); the manifest maps all three audible tiers to a non-empty
  `audio/sound-effects/` URL (drift pin).
- `useComboCue.test.ts` — plays the correct tier clip on an audible
  value-change; no cue for the pre-mount value (catch-up); no cue on a change to
  `0`/`none`; coalesces an equal-consecutive value (the documented limitation);
  re-arms across a `3 → 0 → 3` per-turn reset; safe-skip on null snapshot;
  respects mute (via a muted engine).

---

## Out of Scope

- **Background / adaptive music** and **Surface-2 (action) / Surface-3 (turn)
  cues** — separate follow-on WPs on the WP-412 foundation.
- **A per-play edge signal** that would de-coalesce two equal-count plays in the
  same turn — a deferred refinement (would require a new engine per-play
  counter or a companion UIState observable; the v1 coalescing is accepted).
- **Any engine change** — no new `G` field, no new `UIState` field, no new
  `NotableGameEvent` variant, no change to WP-409's `lastPlayEffectsFired`
  semantics or reset lifecycle.
- **A new audio dependency, engine, control, or channel** — the combo cue
  reuses the WP-412 `howler` engine, `AudioControls`, and single SFX channel.
- **Audio asset production** — sourcing/encoding/uploading the three CC0 combo
  clips to R2 is an operator/ops step (the code + tests are asset-independent
  via a mocked `Howl` / injected engine); live-on-surface verification depends
  on the assets being present.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `apps/arena-client/src/audio/comboCueManifest.ts` — **new** — `ComboTier` + `comboTierForCount` + tier→URL map
- `apps/arena-client/src/composables/useComboCue.ts` — **new** — scalar-change combo consumer
- `apps/arena-client/src/audio/comboCueManifest.test.ts` — **new**
- `apps/arena-client/src/composables/useComboCue.test.ts` — **new**
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified (`01.5` wiring — the same single host)** — mount `useComboCue(audioSnapshot)` beside `useSoundEffects`

**Execution amendment (2026-07-22):** two WP-412 engine files were added to the
allowlist — `apps/arena-client/src/audio/audioEngine.ts` (+ its `.test.ts`) — to
make `play(clipUrl)` **lazily load** an un-preloaded URL. The engine only played
clips preloaded from `sfxManifest`, so a combo-cue URL silently no-op'd; the
lazy-load (no `AudioEngine` interface change) is the minimal way to honor the
"reuse the WP-412 engine" thesis. Recorded in EC-448 §Execution Amendment.

Otherwise no files may be modified. The `01.5` wiring host is `PlayViewport.vue`
(recorded in the EC), the same host WP-412 established.

---

## Vision Alignment

N/A on the §17.1 trigger surfaces: no scoring/PAR/leaderboards, no identity, no
multiplayer sync, no card-data/content-semantics change. **Monetization note:**
audio is a retention / perceived-quality lever, not a revenue vector — the combo
cue never gates play and never becomes pay-to-win (a future cosmetic "sound
pack" would be an optional flourish only). **Determinism note:** the combo cue
is pure client presentation — it reads `UIState`, never writes `G`/`ctx`, and
adds **zero** engine/determinism/replay footprint (sims and replays render no
audio). NG-1..7 preserved.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the
layer consumes the boardgame.io `UIState` push and fetches static R2 clips.

---

## Acceptance Criteria

All items are binary pass/fail.

- [ ] `comboTierForCount` maps `<= 0 → 'none'`, `1 → 'small'`, `2 → 'medium'`,
      `>= 3 → 'big'`; a drift test pins the boundaries.
- [ ] `comboCueManifest` maps **all three** audible tiers (`small`, `medium`,
      `big`) to a non-empty `audio/sound-effects/` URL; the drift test fails if
      a tier is unmapped.
- [ ] `useComboCue` plays exactly one clip per **audible value-change** of
      `game.lastPlayEffectsFired`; it plays **no** cue for the pre-mount value
      (catch-up), **no** cue on a change to `0`/`none`, and re-arms across a
      `3 → 0 → 3` per-turn reset. It safe-skips a null snapshot.
- [ ] Two consecutive equal non-zero counts in one turn coalesce to a single
      cue (the documented v1 limitation — asserted, not a bug).
- [ ] The combo cue rides the WP-412 engine gate: a muted engine plays nothing;
      no new engine, dependency, control, or channel is added.
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
# Expected: both exit 0 / all pass (howler mocked / engine injected; no real audio)

# Step 3 — tier boundaries + manifest exhaustiveness
Select-String -Path "apps\arena-client\src\audio\comboCueManifest.ts" -Pattern "small|medium|big"
# Expected: the three audible tiers present in the mapping + manifest

# Step 4 — no engine footprint
git diff --name-only
# Expected: only apps/arena-client/** files (+ the recorded 01.5 wiring host)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
      D-24026):** in a **real deployed match**, a hero play that fires synergy
      effects plays its combo sting (a bigger play → a bigger tier); the mute
      toggle silences it — observed on the deployed bundle (requires the three
      CC0 combo clips uploaded to R2; green tests + merge alone do NOT satisfy
      it).
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0;
      arena-client suite passes.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated — the tiered combo cue (hero-play synergy
      escalation) rides the WP-412 engine + WP-409 signal; note the R2-clip
      prerequisite if assets pending.
- [ ] `docs/ai/DECISIONS.md` updated — land **D-24228** as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-413 checked off with the date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-413 node glyph `📝 → ✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections; `Out of Scope` lists ≥2 excluded items (music, Surfaces 2/3, per-play edge signal, engine change, new dep/engine/control/channel, asset production).
- **§2 Constraints** — PASS. App-wide + packet-specific + session protocol + locked values; references 00.6.
- **§3 Assumes** — PASS. WP-409 signal + WP-412 foundation exact exports/paths + green baseline `ced4bcf4`.
- **§4 Context (Read First)** — PASS. Specific files (the WP-412 sibling consumer, the manifest precedent, the engine, the play root) + the ewiki design. No `00.2` reference: no card-data/setup-field change (a client presentation layer).
- **§5 Files** — PASS. 5 files, single layer (`apps/arena-client`), 4 new + one `01.5` wiring host (the same WP-412 host). A small, cohesive consumer.
- **§6 Naming** — PASS. `comboCueManifest`, `comboTierForCount`, `ComboTier`, `useComboCue`; no abbreviations.
- **§7 Dependency discipline** — PASS. **No new dependency** — reuses WP-412's `howler` via `getAudioEngine()`.
- **§8 Architectural boundaries** — PASS. App layer only; reads the typed `UIState` (`.` subpath), no runtime engine/registry import, no `G` write.
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. None introduced (clip URLs are static R2 paths).
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. arena-client `node:test`; the engine is injected / `Howl` mocked (asset-independent); `typecheck` gated; no `boardgame.io/testing`.
- **§13 Verification** — PASS. Exact `pnpm` commands + expected output; the client `typecheck` gate is explicit.
- **§14 Acceptance criteria** — PASS. Binary, observable (incl. the coalescing limitation asserted).
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap + scope check; `User-Visible Surface = play.legendary-arena.com` ⇒ §15.1 live-on-surface (D-24026) present, with the asset-prerequisite noted honestly.
- **§16 Code style** — PASS. A pure tier helper + a thin consumer, `// why:` on the scalar-change rule + the coalescing limitation, no abbreviations.
- **§17 Vision Alignment** — N/A (declared) + monetization + determinism notes: audio is retention polish, never pay-to-win; pure client presentation, zero determinism footprint.
- **§18 Prose-vs-grep** — PASS. Verification Step 3 greps `comboCueManifest.ts` for the tier tokens (source-file scoped, not the WP).
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding affordance/channel/copy.
- **§21 API Catalog** — N/A. No HTTP endpoint / `apps/server/src/**` library function.

**Lint verdict: PASS (all 21 resolved; 7 N/A each justified; §7 no new dependency).**

---

## Pre-Flight Verdict (01.4)

> Recorded at drafting; the executing session re-confirms against its own baseline.

**Verdict: READY TO EXECUTE (2026-07-21).**

- **Sequencing / dependencies:** WP-409 (`UIState.game.lastPlayEffectsFired`,
  verified live in `uiState.types.ts` + built `dist`) and WP-412 (the audio
  engine + `getAudioEngine()` + the `PlayViewport` `01.5` host) are both on
  `main`. No engine dependency; a pure client consumer.
- **Green baseline:** `main @ ced4bcf4`.
- **Scope lock:** closed allowlist (4 new + one `01.5` wiring host, the same
  WP-412 host); `git diff --name-only` is a DoD gate.
- **Contract fidelity:** the consumer mirrors WP-412's `useSoundEffects`
  (own-state watcher, catch-up, injected-engine seam) but keys off a **scalar
  value change** (the WP-409 signal is a scalar, not a stream); the tier mapping
  is a new locked pure function.
- **RS-1 (clarification, non-blocking):** the equal-consecutive-same-turn
  coalescing is an accepted v1 limitation (the scalar carries no per-play edge);
  a de-coalescing refinement is deferred. Named in Context + Out of Scope + an
  AC that **asserts** the coalescing (so it is a locked behavior, not a
  surprise).
- **PS items (blocking):** none. (Live D-24026 verification depends on the three
  CC0 combo clips being uploaded to R2 — an operator prerequisite, not a code
  blocker.)

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (2026-07-21).** Additive, single App layer,
tightly precedented (mirrors the WP-412 `useSoundEffects` consumer and reuses
the WP-412 engine wholesale), no engine/determinism risk, no new dependency.

Selected findings:
- **#1 / #9 (layer boundary)** — PASS. Client-only; reads typed `UIState`, no
  runtime engine/registry import, no `G` write; reuses `getAudioEngine()`.
- **#2 (determinism)** — PASS. Zero engine footprint; audio is invisible to
  replays/sims (the AC pins an App-only diff + untouched engine suites).
- **#7 (new dependency)** — PASS. **No** new dependency — reuses WP-412's
  `howler` through the engine singleton.
- **#12 (scope creep)** — PASS. Combo cue only; music / Surfaces 2-3 / a
  per-play edge signal explicitly deferred; closed allowlist + `git diff` gate;
  no new control/channel.
- **#4 (contract drift)** — PASS. Consumes WP-409's existing public
  `UIState.game.lastPlayEffectsFired`; no `UIState`/drift-array change.

**Disposition: CONFIRM** — session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24228 (reserved; Drafted 2026-07-21, not yet landed)** — The arena-client
  gains a **tiered combo cue** on `play.legendary-arena.com`, locked as follows.
  (1) **Architecture:** pure client presentation — it lives entirely in
  `apps/arena-client`, reads only `UIState.game.lastPlayEffectsFired` (WP-409 /
  D-24221), **never** writes `G`/`ctx`, and adds **zero** engine / determinism /
  replay footprint. (2) **Reuse, not rebuild:** it plays through the **WP-412**
  audio engine (`getAudioEngine()`, D-24224), inheriting that engine's
  autoplay-unlock arm, master mute, and master volume — **no** new dependency,
  **no** new `Howl` wrapper, **no** new audio control, **no** second SFX
  channel. (3) **Tiers:** `comboTierForCount(count)` maps `<= 0 → 'none'`
  (silent), `1 → 'small'`, `2 → 'medium'`, `>= 3 → 'big'`; the three audible
  tiers map to CC0 clips hosted on R2 under `audio/sound-effects/` (served via
  `images.legendary-arena.com`), referenced by URL — **no audio in git**.
  (4) **Scalar-change consumer:** because `lastPlayEffectsFired` is a scalar
  (overwritten per play, reset to `0` in the play-phase `onBegin`), `useComboCue`
  keeps its **own** last-seen value and fires once per **audible value-change**
  (catch up on the first frame, no cue for the pre-mount value) — distinct from
  WP-412's append-only `notableEvents` cursor. (5) **Accepted v1 limitation:**
  two consecutive plays in the **same turn** with the **same non-zero count**
  coalesce to one cue (the scalar does not change); the per-turn reset re-arms
  equal-value plays **across** turns. A per-play edge signal that would
  de-coalesce them is a deferred follow-on. Wired once at the WP-412 `01.5`
  host (`PlayViewport.vue`), beside `useSoundEffects`.

---

## See Also

- [WP-409](WP-409-hero-play-synergy-effect-count-signal.md) / D-24221 — the
  `UIState.game.lastPlayEffectsFired` signal this consumes.
- [WP-412](WP-412-arena-client-audio-layer-foundation.md) / D-24224 — the
  arena-client audio foundation (engine, unlock, mute/volume, `01.5` host) this
  reuses.
- ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/)
  §"Tiered combo / synergy cue" — the design source.
