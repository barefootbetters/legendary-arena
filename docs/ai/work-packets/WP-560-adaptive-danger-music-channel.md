# WP-560 — Adaptive Danger-Meter Music Channel (App)

**Status:** Drafted 2026-08-16
**EC:** [EC-595](../execution-checklists/EC-595-adaptive-danger-music-channel.checklist.md)
**Reserves:** D-24369
**Lane:** Standard two-session
**User-Visible Surface:** `play.legendary-arena.com` — **D-24026 live verification REQUIRED**
**Drafted off:** `origin/main` @ `040edfa3`

---

## Goal

Make the match *sound* like it is going badly. A background score crossfades
between three loops as the villains close in, driven by the same
`menaceTier` the Danger Meter renders — so a player who is losing hears it
before they read it. This is packet 3 and the last of the danger-meter arc:
WP-557 built the signal, WP-558 made it visible, this makes it audible.

## Assumes

- **WP-557 / D-24366** — `UIState.progress.menaceTier` is projected and its
  bands are a shared contract. Landed on `main`.
- **WP-412 / D-24224** — the arena-client audio layer: `howler`, the
  autoplay-unlock gesture, and the persisted master mute / volume.
- **WP-558 / D-24367** — the sibling visual consumer. Not a hard dependency
  (both read the same projection independently), but its §2 no-re-derivation
  rule is inherited here so the two channels cannot drift apart.
- `PlayViewport.vue` is the shared composable host where `useSoundEffects`,
  `useComboCue` and `useComboVfx` are already mounted.
- `scripts/upload-move-sfx-to-r2.mjs` is content-driven and already names
  "the adaptive-music work still to come" as an anticipated consumer.

## Context

**Why now.** The ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/)
page has specified an adaptive score since the audio layer shipped, and it
was blocked on a signal that did not exist. WP-557 built it; WP-558 proved
the tier contract renders correctly. Nothing is blocking the audio half any
more except its assets.

**The finding that shapes the whole packet.** The shipped `audioEngine.ts` is
strictly **fire-and-forget**: its `HowlLike` interface exposes exactly
`play()` and `volume()`, and a grep of `apps/arena-client/src/audio` for
`loop`, `stop`, or `fade` returns **nothing**. Every cue shipped so far
(WP-412 event SFX, WP-413/425 combo stings, WP-421 move SFX) is a one-shot.
A music channel needs looping, crossfading, and stopping — none of which
exist. **D-24369 §1** locks a separate `musicEngine.ts` rather than widening
`HowlLike`, because `stop`/`loop`/`fade` on the SFX contract would be carried
by every one-shot call site for no one-shot benefit.

**Why horizontal, not vertical.** The ewiki lays out both techniques and
recommends horizontal re-sequencing first. That recommendation is correct for
a hard reason, not a soft one: vertical layering needs stems recorded in
sync, and stems cannot be assembled from three independently-composed CC0
tracks. Vertical layering stays available later if a commissioned score with
stems is ever produced.

**Why music is the deliberate inverse of the meter.** WP-558's D-24367 §1
locked the meter as *information* that always renders, because loss progress
is game state and hiding it behind an effects toggle costs the player
something real. A soundtrack is the opposite: it carries no state a player
can lose by silencing it. So music **defaults on** (a silent feature ships as
no feature), at a **lower volume than SFX** (a loop must not drown the cues),
with its **own persisted toggle**, and the **master mute silences it**. The
two rules look contradictory side by side and are deliberately so — the
distinction is whether the channel carries information.

**Assets are the real prerequisite.** Three CC0 loopable tracks under a new
`audio/music/` R2 prefix. Audio bytes never enter git (the WP-412 rule), and
the existing content-driven upload script covers the encode + upload with no
new tooling. As with WP-412/413/425, the operator upload **gates the D-24026
verification** — the code can merge before the assets land, but the packet is
not observably done until they do.

**Scope boundary against the theme-music system.** `wiki/music-authoring.md`
carries an open question: which WP wires `musicAssets.*Url` into the client
"and how it maps to the adaptive danger-meter tiers". This packet answers the
**tier-mapping half** and explicitly does **not** touch the per-theme
`musicAssets` pipeline, the motif matrix, or the theme stings. That question
is narrowed, not closed, and the page is updated to say so.

## Scope (In)

1. `audio/musicEngine.ts` — a loop-capable engine: `playLoop(url)`,
   `crossfadeTo(url)`, `stop()`, `setMuted()`, `setVolume()`. Its own narrow
   `MusicHowlLike` interface (adding `stop`/`fade`/`loop`) so tests inject a
   mock and no real Web Audio runs.
2. `audio/menaceMusicManifest.ts` — `MenaceTier → track URL`. Imports the
   tier type; **declares no bands**.
3. `composables/useAdaptiveMusic.ts` — watches `progress.menaceTier`,
   crossfades on **tier change only**, catches up on the first frame, and
   stops at `gameOver`.
4. `composables/useAudioSettings.ts` — adds the persisted music toggle and
   music volume alongside the existing master mute / volume.
5. `components/play/AudioControls.vue` — surfaces the music toggle + volume.
6. `pages/PlayViewport.vue` — mounts `useAdaptiveMusic` once, beside the
   existing composables.
7. `wiki/sound-effects.md` — mark the adaptive-music section shipped and
   record the horizontal-re-sequencing decision as landed.
8. `wiki/music-authoring.md` — narrow the "Client consumption" open question
   to the theme-`musicAssets` half that remains open.

## Scope (Out)

- **Widening `audioEngine.ts` / `HowlLike`.** Forbidden — D-24369 §1.
- **The per-theme `musicAssets.*Url` pipeline**, the motif matrix, theme
  stings, and the match-start decoded-buffer prefetch. Different arc.
- **Vertical stem layering.** Deferred until a stems-bearing score exists.
- **Win/loss/tie endgame stingers.** The loop *stops* at gameover; composing
  the resolution sting is a separate Surface-4 packet.
- Any `packages/**` file, any engine change, any new `UIState` field.
- Committing audio bytes to git.

## Files Expected to Change

| File | Change |
|---|---|
| `apps/arena-client/src/audio/musicEngine.ts` | **new** |
| `apps/arena-client/src/audio/musicEngine.test.ts` | **new** |
| `apps/arena-client/src/audio/menaceMusicManifest.ts` | **new** |
| `apps/arena-client/src/audio/menaceMusicManifest.test.ts` | **new** |
| `apps/arena-client/src/composables/useAdaptiveMusic.ts` | **new** |
| `apps/arena-client/src/composables/useAdaptiveMusic.test.ts` | **new** |
| `apps/arena-client/src/composables/useAudioSettings.ts` | music toggle + volume |
| `apps/arena-client/src/composables/useAudioSettings.test.ts` | cover the new settings |
| `apps/arena-client/src/components/play/AudioControls.vue` | surface the control |
| `apps/arena-client/src/components/play/AudioControls.test.ts` | cover the control |
| `apps/arena-client/src/pages/PlayViewport.vue` | mount once |
| `wiki/sound-effects.md` | mark shipped |
| `wiki/music-authoring.md` | narrow the open question |

Governance ledgers excluded per `01.5`.

## Contract

**Locked — a separate engine (D-24369 §1).** `musicEngine.ts` owns its own
`MusicHowlLike`. `audioEngine.ts` and its `HowlLike` are **not modified**.

**Locked — tier-driven, never re-banded (D-24369 §3).** The channel reads
`menaceTier` and switches on **change**. It never reads `menace` to derive a
band, and it never re-declares boundaries. Inherited from D-24367 §2 so the
meter and the score cannot disagree.

**Locked — crossfade on change only.** A tier that has not changed must not
retrigger a crossfade. The consumer keeps its own last-seen tier, exactly as
`useComboCue` keeps its own last-seen scalar.

**Locked — the audio settings matrix:**

| Setting | Default | Effect |
|---|---|---|
| Master mute (existing) | off | Silences **both** SFX and music |
| Music enabled (new) | **on** | Silences music only |
| Master volume (existing) | `DEFAULT_SFX_VOLUME` | SFX level |
| Music volume (new) | **below** the SFX default | Music level |

**Locked — lifecycle.** No music before the WP-412 unlock gesture. The loop
stops at `gameOver` and does not resume.

**Locked — assets.** Three CC0 loopable tracks at `audio/music/` on R2,
uploaded with the existing content-driven script. **Never committed to git.**
Tests mock the music Howl so the suite is asset-independent.

## Acceptance Criteria

- **AC-1** — `menaceMusicManifest` maps every `MenaceTier` to a distinct
  track URL, proven by iterating the engine's `MENACE_TIERS` (not a local
  copy), and declares no band boundaries of its own.
- **AC-2** — `musicEngine` loops, crossfades, and stops against an injected
  mock; no real `Howl` is constructed in tests.
- **AC-3** — `useAdaptiveMusic` crossfades on a tier **change** and does
  **not** retrigger when the tier is unchanged across frames.
- **AC-4** — the channel never reads `menace`: a state with
  `menace: 0.9, menaceTier: 'calm'` plays the **calm** track.
- **AC-5** — nothing plays before the unlock gesture.
- **AC-6** — master mute silences music; the music toggle silences music
  **without** silencing SFX.
- **AC-7** — the loop stops at `gameOver` and does not resume.
- **AC-8** — the default music volume is strictly **below**
  `DEFAULT_SFX_VOLUME`.
- **AC-9** — `audio/audioEngine.ts` is **unchanged**
  (`git diff --name-only -- apps/arena-client/src/audio/audioEngine.ts` empty)
  and `HowlLike` is not widened.
- **AC-10** — `pnpm --filter arena-client typecheck` 0 and the suite is green,
  up by the new tests; `git diff --name-only -- packages` is **empty**.
- **AC-11** — both wiki pages updated; link-check passes.
- **AC-12** — **D-24026 live verification**: on the deployed bundle with the
  three loops on R2, a real match starts the loop after the unlock gesture,
  and the track **changes** as menace crosses a tier boundary.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter arena-client typecheck` → 0 (**load-bearing**: neither
   `vite build` nor `node:test` typechecks SFCs).
3. `pnpm --filter arena-client test` → green.
4. `pnpm -r --no-bail test` → no new failures.
5. `git diff --name-only -- packages apps/arena-client/src/audio/audioEngine.ts`
   → empty.
6. `pnpm wiki-viewer:project && pnpm wiki-viewer:check-links` → passes.
7. Operator: upload three CC0 loops to `audio/music/` via
   `scripts/upload-move-sfx-to-r2.mjs`; confirm GET-200.
8. Post-deploy: AC-12 on `play.legendary-arena.com`.

## Definition of Done

- [ ] AC-1..AC-11 demonstrated with observed output.
- [ ] AC-12 verified live, or recorded in `STATUS.md` as operator-pending on
      **both** the deploy and the asset upload.
- [ ] `pnpm -r build` 0; typecheck 0; suite green; repo-wide no new failures.
- [ ] D-24369 landed **Active**.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `✅`;
      `roadmap:counts:check` 0.
- [ ] `STATUS.md` updated.
- [ ] **The danger-meter arc is recorded as complete** (packets 1–3).

## Gate Verdicts (Drafting Session, 2026-08-16)

**Pre-flight (`01.4`): READY TO EXECUTE.** Artifact:
`docs/ai/invocations/preflight-wp560-adaptive-music.md`. Hard-deps WP-557 ✅
and WP-412 ✅ are Active on `main` @ `040edfa3`.

**Empirical scaffold: NOT REQUIRED, and deliberately not run.** This WP
tightens no existing input path and removes no prop — it is strictly
additive apart from two additive edits to `useAudioSettings` and
`AudioControls`. The WP-558 scaffold was required because that packet
*removed a required prop*; nothing here has that shape. The substantive
risk was instead resolved by **reading the shipped engine**, which is what
surfaced the fire-and-forget finding.

**Copilot check (`01.7`): PASS** (1 RISK, FIXed in-place). Artifact:
`docs/ai/invocations/copilot-wp560-adaptive-music.md`. Issue **9** fired
again — a second consumer of the same tier contract is exactly where a
duplicate band table gets written. FIXed by D-24369 §3 plus **AC-4**, which
proves non-re-derivation the same way WP-558's AC-6 did, with an
inconsistent `menace`/`menaceTier` pair.

## Lint Gate Self-Review

| § | Verdict | Note |
|---|---|---|
| 1 Goal user-visible | PASS | `play.legendary-arena.com`; D-24026 required. |
| 2 Scope closed | PASS | 8-item In; Out names `HowlLike` widening, the theme pipeline, vertical stems, endgame stingers, `packages/**`. |
| 3 Assumes cite sources | PASS | Each cites a landed WP/D or a read file. |
| 4 Files allowlist | PASS | 13 files. |
| 5 Contract explicit | PASS | Five locked rules incl. the settings matrix. |
| 6 AC testable | PASS | 12 ACs. |
| 7 Layer boundary | PASS | App-only; AC-10 pins an empty `packages` diff. |
| 8 Determinism | PASS | Pure client presentation; reads the projection; hash-excluded. `src/audio` is not replay-bearing. |
| 9 Persistence | PASS | Two new localStorage keys, following the existing `arenaClient*` convention. No server state. |
| 10 Move contract | N/A | No move. |
| 11 Phase/turn | N/A | No transition. |
| 12 Zone ops | N/A | No zone mutation. |
| 13 Canonical arrays | PASS | Consumes `MENACE_TIERS`; adds none, re-bands none. |
| 14 Naming | PASS | Full English words; settings keys follow `arenaClientAudio*`. |
| 15 Error handling | PASS | A failed/missing track is fail-soft (silence, never a throw) — the WP-412 precedent. |
| 16 Test extension | PASS | `useAudioSettings.test.ts` and `AudioControls.test.ts` extended, not replaced. |
| 17 Vision | PASS | §14; retention polish. No pay-to-win, no PvP terminology. |
| 18 Dependencies complete | PASS | WP-557 ✅, WP-412 ✅ on `main` @ `040edfa3`. |
| 19 Lane eligibility | PASS | Two-session: 13 files (> 4) and a new long-lived engine abstraction (an `01.6` trigger), both disqualifying for the lightweight lane. |
| 20 Knobs | N/A | No `SAFE-KNOBS.md` surface. |
| 21 API catalog | N/A | No HTTP endpoint. |

**All 21 sections resolved.**

## Notes

The **asset upload is the schedule risk**, not the code. WP-412, WP-413 and
WP-425 each merged with their D-24026 verification blocked on clips reaching
R2, and each sat that way until the operator uploaded them. Three loopable
music tracks are a larger sourcing job than a one-shot sting — they must loop
seamlessly and sit together tonally. Sourcing them before the execution
session opens is the single highest-value thing that can be done in parallel.
