# EC-595 — Adaptive Danger-Meter Music Channel

**WP:** [WP-560](../work-packets/WP-560-adaptive-danger-music-channel.md)
**Layer:** App (`apps/arena-client` only)
**Lane:** Standard two-session
**Reserves:** D-24369

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] On `origin/main` at or after `040edfa3`; working tree clean.
- [ ] `pnpm install`, then `pnpm -r build` exits 0 (arena-client imports the
      built engine `dist`).
- [ ] Record baselines: `pnpm --filter arena-client test` and
      `pnpm --filter arena-client typecheck` (**0**).
- [ ] Read `audio/audioEngine.ts` — specifically that `HowlLike` is
      `play()` + `volume()` only. That is *why* a separate engine exists.
- [ ] Read `composables/useComboCue.ts` — the last-seen-value consumer
      pattern this packet mirrors for tier changes.

## Locked Values

- Three tracks under `audio/music/` on R2, one per `MenaceTier`.
- Music **defaults ON**; music volume defaults **strictly below**
  `DEFAULT_SFX_VOLUME`.
- Master mute silences **both** channels; the music toggle silences **music
  only**.
- Crossfade fires on a tier **change** only — never on an unchanged tier.
- The loop **stops** at `gameOver` and does not resume.
- No playback before the WP-412 unlock gesture.
- New storage keys follow the existing convention:
  `arenaClientMusicEnabled`, `arenaClientMusicVolume`.

## Guardrails

1. **Do NOT widen `audioEngine.ts` or `HowlLike`** (D-24369 §1). The SFX
   contract is fire-and-forget; `stop`/`loop`/`fade` belong to the new
   `musicEngine.ts`. `git diff` on `audioEngine.ts` must be **empty**.
2. **Never re-band a tier.** Read `menaceTier`; never read `menace` to
   derive one. This is D-24367 §2 inherited — it is what keeps the meter and
   the score from disagreeing.
3. **Crossfade on change only.** Keep a last-seen tier in the consumer, the
   `useComboCue` pattern. Re-firing every frame is an audible bug.
4. **Audio bytes never enter git.** Upload via the existing content-driven
   `scripts/upload-move-sfx-to-r2.mjs`; commit no `.mp3`.
5. **Tests are asset-independent.** Inject a mock music-Howl; never
   construct a real `Howl` and never depend on a live R2 fetch.
6. **Client-only.** `git diff --name-only -- packages` MUST be empty. No
   runtime `registry` / `server` import, no `G`/`ctx` write.
7. **`pnpm --filter arena-client typecheck` is the load-bearing gate** —
   `vite build` is esbuild and `node:test` runs under tsx, so **neither
   typechecks SFCs** (recurred WP-166 / 207 / 227).
8. **Fail soft.** A missing or failed track yields silence, never a throw and
   never a broken match — the WP-412 precedent.

## Required Comments

- `// why:` on `musicEngine.ts`'s existence, stating that `audioEngine`'s
  `HowlLike` is `play`+`volume` only and citing D-24369 §1 — otherwise a
  future reader will "consolidate" the two engines and drag `stop`/`fade`
  onto every one-shot SFX call site.
- `// why:` on the change-only crossfade guard, naming the audible bug it
  prevents.
- `// why:` on the music-defaults-ON / lower-volume choice, citing D-24369 §4
  and contrasting it with D-24367 §1 — the meter is information and is never
  gated; music is decoration and is.
- `// why:` on the `gameOver` stop, noting the endgame sting is a separate
  future packet so the correct behaviour today is silence.

## Files to Produce

| File | Change |
|---|---|
| `audio/musicEngine.ts` | new — loop / crossfade / stop, own narrow interface |
| `audio/musicEngine.test.ts` | new — against an injected mock |
| `audio/menaceMusicManifest.ts` | new — `MenaceTier` → URL, no bands |
| `audio/menaceMusicManifest.test.ts` | new |
| `composables/useAdaptiveMusic.ts` | new — tier watch, change-only crossfade, stop at gameOver |
| `composables/useAdaptiveMusic.test.ts` | new |
| `composables/useAudioSettings.ts` | music toggle + music volume |
| `composables/useAudioSettings.test.ts` | extend |
| `components/play/AudioControls.vue` | surface the control |
| `components/play/AudioControls.test.ts` | extend |
| `pages/PlayViewport.vue` | mount once, beside `useComboCue` |
| `wiki/sound-effects.md` | mark the adaptive score shipped |
| `wiki/music-authoring.md` | narrow the Client-consumption open question |

All app paths under `apps/arena-client/src/`. Governance ledgers excluded
per `01.5`.

## After Completing

- [ ] `WORK_INDEX.md` → `[x]` with observed counts.
- [ ] `EC_INDEX.md` → `Done`; mindmap → `✅`; `roadmap:counts:write` + `:check`.
- [ ] **D-24369** landed **Active**.
- [ ] `STATUS.md` — **D-24026 REQUIRED**, and record it as pending on **both**
      the deploy **and** the asset upload (two separate prerequisites).
- [ ] Record the **danger-meter arc (packets 1–3) as complete**.

## Common Failure Smells

- **"Just add `stop()` to `HowlLike`."** That is the one thing this packet
  exists not to do. Every one-shot SFX call site would carry it forever.
- **Re-deriving the tier from `menace`** because "the manifest already has
  the number". Two band tables is how the meter and the score drift.
- **Crossfading on every snapshot.** The tier is a scalar, not an event
  stream; without a last-seen guard the loop restarts constantly and it is
  immediately audible.
- **Letting music ignore the master mute.** A muted player expects silence
  from the whole client, not just the cues.
- **Committing the `.mp3` files.** Audio lives on R2; the repo has never
  carried audio bytes.
- **Declaring D-24026 done at merge.** This packet has *two* prerequisites —
  the deploy and the R2 upload. WP-412 / 413 / 425 each sat unverified until
  their clips landed; expect the same and say so in `STATUS.md`.
