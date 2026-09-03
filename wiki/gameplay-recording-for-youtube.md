---
title: Gameplay Recording for YouTube
type: Tutorial
tags:
  - layer-marketing
  - youtube
  - video
  - audio
  - ffmpeg
  - ip
  - licensing
  - production
related:
  - video-production-workflow.md
  - youtube-channel-plan.md
  - ip-licensing.md
  - music-authoring.md
  - after-effects-stop-motion-hero-loop.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\gameplay-recording-for-youtube.md (this page — https://ewiki.legendary-arena.com/gameplay-recording-for-youtube/)
  - ../docs/01-VISION.md
last-reviewed: 2026-09-03
---

## Summary

A workflow for recording a live `play.legendary-arena.com` match for
YouTube — the "point a camera / screen recorder at a game and talk over
it" format that community channels (the Bageltop Games ecosystem, for
example) use. It covers the three things that make this format different
from the general [Video Production Workflow](video-production-workflow.md):
the **IP posture** that gates whether such a recording may go public, the
**unlisted-first handshake** for getting a musician's permission to use a
song, and the **single-track audio mix** (voiceover over ducked music)
that YouTube forces on you. This page is `draft`: the licensing posture is
sourced to governance below, but the audio/YouTube mechanics are general
external facts rather than engine-cited claims.

## Mechanics

### The IP gate — decide publish-visibility before you record

Recording a match captures Marvel character **names and art** and the
*Legendary* system on screen. Per [IP Licensing](ip-licensing.md), that
touches **two separate rights Legendary Arena does not yet license** —
Upper Deck's *Legendary* system/brand, and Marvel's **digital** character
rights — and the currently-public build already shows that IP. Recording a
session does not create a *new* right; **publishing it publicly does
amplify the exposure.** The acquisition plan flags advertising the
unlicensed Marvel build into the rights-holders' own community as
heightened risk, and its operative posture is that any public placement
points only at a **license-clean** surface.

The practical rule this page inherits (it does not invent it — see
[IP Licensing](ip-licensing.md), the acquisition plan, and
[`docs/01-VISION.md`](../docs/01-VISION.md) §Financial Sustainability):

> **Keep Marvel-showing gameplay recordings *unlisted* until the
> license-clean decision. Do not flip one to public on your own.**

This is not a blocker on *making* the video — it is a gate on its
**visibility**. And it happens to line up exactly with the music-permission
workflow below, which also wants the video unlisted first. The two gates
converge on the same default: **record freely, stay unlisted, publish
public only when the licensing posture clears it.**

### Unlisted, not private — the song-permission handshake

The strongest way to ask a musician for permission to use their song is to
remove all the guesswork: show them the finished video with their track in
place, and ask for a yes on something concrete rather than an imagined use.

Use **unlisted**, not **private**:

| Visibility | Who can watch | Fit for the artist ask |
|---|---|---|
| **Private** | Only Google accounts you explicitly grant | Poor — the artist must be signed into a specific account you've whitelisted |
| **Unlisted** | Anyone with the link; not in search, not on your channel | **Good** — the artist just opens a link and watches |
| **Public** | Everyone; searchable; on your channel | Gated (see the IP gate above) |

The outreach message must make two things explicit so nobody feels
ambushed:

1. **It is not public yet** — this is a preview.
2. **It will not go public without their word** — their permission is the
   trigger, and they can see and hear exactly what they'd be agreeing to.

This turns a vague "can I use your music?" into "here is your song in this
video — may I publish it?", which is a far easier yes.

### Capture the session

The capture step is the same toolchain as the general pipeline — see the
[Video Production Workflow](video-production-workflow.md) tool chain
(Camtasia default, OBS, Snagit) and the capture-discipline detail in the
[After Effects Stop-Motion Hero Loop](after-effects-stop-motion-hero-loop.md)
Phase 2 (frame stability, lighting, and screen-vs-camera record settings).
Two format choices for this specific "play and narrate" video:

| Approach | What it is | Notes |
|---|---|---|
| **Screen capture** | Record the browser running `play.legendary-arena.com`, narrate over it | Cleanest card legibility; OBS/Camtasia at 1080p30 |
| **Camera on the play** | Physical camera framing you and/or the screen while you play and talk | The community "at the table" feel; needs the stability + lighting discipline from the hero-loop page |

Record **voiceover and gameplay as you go**, but capture the **music on its
own track** (or add it in edit) — you need the voice and music separable at
mix time for the ducking step below. Frame the capture to avoid leaking
anything you don't want on screen (diagnostic overlays, other players'
hidden information on a shared board).

### The audio mix — YouTube gives you one track, so bake it yourself

A standard YouTube video carries a **single mixed audio track**. Viewers
**cannot** toggle the music off separately from your voiceover — whatever
you upload is what everyone hears.

YouTube does support **multiple audio tracks**, but that feature is built
for **dubbing into other languages**, not stem separation (music vs.
voice), and it is oriented at larger channels. Do not plan the mix around
letting viewers mute the music — that capability does not exist for this
use. **You bake the final mix yourself.**

The mix discipline:

- Keep music **well under** the voice — roughly **15–20%** of the voice
  level as a resting bed.
- Use **ducking** so the music drops automatically whenever you talk and
  recovers in the gaps, rather than sitting at one flat level.

FFmpeg does the ducking automatically with **sidechain compression** — the
voice track triggers gain reduction on the music track. Starting recipe
(voice is input `0`, music is input `1`; tune the numbers to taste):

```
ffmpeg -i voiceover.wav -i music.wav -filter_complex "\
  [1:a]volume=0.20[bed]; \
  [bed][0:a]sidechaincompress=threshold=0.02:ratio=6:attack=15:release=400[ducked]; \
  [0:a][ducked]amix=inputs=2:duration=longest:dropout_transition=0[mix]" \
  -map "[mix]" -c:a aac -b:a 192k mixed.m4a
```

- `volume=0.20` sets the 15–20% resting bed before any ducking.
- `sidechaincompress` ducks `[bed]` whenever `[0:a]` (the voice) is
  present; `ratio`/`threshold` set how hard, `attack`/`release`
  (milliseconds) set how fast it dips and recovers.
- `amix` recombines voice + ducked music into the one track YouTube wants.

Follow with a loudness-normalization pass to the channel target
(`-14 LUFS`, matching the [Video Production Workflow](video-production-workflow.md)
Step 6 normalize) before upload.

## Interactions

- **[Video Production Workflow](video-production-workflow.md)** — the
  ten-step parent pipeline (idea → published video → companion blog). This
  page is the gameplay-session-specific companion to its Record (Step 5)
  and Assemble/Normalize (Step 6) stages; the FFmpeg-via-Claude-Code
  assembly and `-14 LUFS` normalization live there.
- **[YouTube Channel Plan](youtube-channel-plan.md)** — the "Legendary
  Arena" channel strategy. A play-and-narrate match is the raw material for
  the **Across the Table** (gameplay) series and **Arena Clips** (Shorts).
- **[IP Licensing](ip-licensing.md)** — the authority for the publish-
  visibility gate: the two unlicensed rights, the standing exposure of the
  public Marvel build, and the license-clean posture this page defers to.
- **[Music Authoring](music-authoring.md)** — the in-app music pipeline
  (per-theme/hero Suno tracks). Distinct from a **third-party musician's
  song** used as a video backing track, which is what the unlisted-preview
  permission handshake is for.
- **[After Effects Stop-Motion Hero Loop](after-effects-stop-motion-hero-loop.md)**
  — shares the capture-discipline detail (stability, lighting, screen-vs-
  camera record settings) referenced above, though it targets a different
  artifact (the muted homepage hero loop).

## Edge Cases

- **Unlisted ≠ private.** Private restricts to whitelisted Google
  accounts; unlisted is anyone-with-the-link. For the artist ask you want
  unlisted — a private video makes the musician jump through account
  hoops.
- **Unlisted is not a security boundary.** An unlisted link can be
  forwarded and opened by anyone who has it; it is not secret, just
  unsearchable and off your channel. That is fine for a permission preview,
  but do not treat "unlisted" as "confidential."
- **Content ID scans unlisted videos too.** YouTube's Content ID can match
  and **claim** copyrighted music even on an unlisted video. Using a
  musician's track that is registered (or later gets registered) can
  trigger a claim that mis-routes monetization or blocks playback — a
  reason to have the artist's explicit permission on record, and to check
  for claims before relying on the preview.
- **Do not publish public to test the mix.** The IP gate means "flip to
  public" is not a casual QA step. Verify the mix on the unlisted video.
- **Multi-audio-track is dubbing-only.** Do not design the video assuming
  viewers can mute the music via YouTube's alternate-audio feature — it is
  for language dubs, aimed at larger channels, and does not separate music
  from voice.
- **Ducking that pumps.** Too aggressive a `ratio`/too fast a `release`
  makes the music audibly "pump" up and down between words. Moderate the
  ratio and lengthen the release if it breathes unnaturally.
- **Voice and music must be separable at mix time.** If music is baked into
  the same track as the voice during capture, sidechain ducking can't key
  off the voice cleanly. Keep them on separate tracks until the final mix.
- **Framing leaks.** A live capture of the play client can catch diagnostic
  overlays or a shared board's hidden information. Frame the shot (or the
  screen-record region) to exclude what shouldn't be on camera.

## Open Questions

- **License-clean gameplay surface.** The IP gate keeps Marvel-showing
  gameplay unlisted; whether a *public* gameplay-video program runs against
  a reskinned (fantasy / public-domain) build, and when, is owned by the
  acquisition plan and its decision log — not by this page. Check
  [IP Licensing](ip-licensing.md) before publishing any gameplay video
  publicly.
- **Where produced video assets stage.** This page describes the workflow,
  not the file locations; per the [Video Production Workflow](video-production-workflow.md)
  file-system section, per-video working folders live under `C:\pcloud\LA\`
  (not in git). Confirm that layout there before staging captures.

## References

- [Video Production Workflow](video-production-workflow.md) — parent
  ten-step pipeline; Record + Assemble/Normalize stages and the `-14 LUFS`
  loudness target
- [YouTube Channel Plan](youtube-channel-plan.md) — channel strategy;
  the gameplay + Shorts series this format feeds
- [IP Licensing](ip-licensing.md) — the two unlicensed rights (Upper Deck
  system + Marvel digital characters), the public-build exposure, and the
  license-clean posture that gates public publication
- [Music Authoring](music-authoring.md) — the in-app music pipeline
  (contrast with a third-party backing song)
- [After Effects Stop-Motion Hero Loop](after-effects-stop-motion-hero-loop.md)
  — shared capture-discipline reference
- [`docs/01-VISION.md`](../docs/01-VISION.md) — §Financial Sustainability:
  the royalty covenant to Upper Deck / Marvel that the IP gate serves
- `C:\www\legendary-arena-com\docs\corporate-memory\04-ip-licensing-acquisition-plan.md`
  — the acquisition plan behind the license-clean posture (marketing repo,
  internal; draft, pre-outreach)
- [FFmpeg — sidechaincompress filter](https://ffmpeg.org/ffmpeg-filters.html#sidechaincompress)
  — the automatic music-ducking filter used in the mix recipe
- [YouTube Help — Add subtitles & alternate audio (multi-language audio)](https://support.google.com/youtube/answer/12569396)
  — confirms the multiple-audio-track feature is for dubbing, not music/voice stems
