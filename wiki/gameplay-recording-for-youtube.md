---
title: Gameplay Recording for YouTube
type: Tutorial
tags:
  - layer-marketing
  - youtube
  - video
  - audio
  - ffmpeg
  - obs
  - chrome
  - ip
  - licensing
  - production
related:
  - video-production-workflow.md
  - youtube-channel-plan.md
  - ip-licensing.md
  - music-authoring.md
  - after-effects-stop-motion-hero-loop.md
  - workspace-map.md
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
that YouTube forces on you for this use.

The production spine this page spells out end-to-end:

> **Chrome tab (gameplay) → OBS capture (video + separate audio stems) →
> FFmpeg edit / duck / loudness / YouTube encode → YouTube Studio upload as
> Unlisted → artist + IP gates → Public only when both clear.**

This page is `draft`: the licensing posture is sourced to governance below,
but the audio / YouTube / FFmpeg mechanics are general external facts
rather than engine-cited claims. The FFmpeg recipes were run against
FFmpeg 8.1 before publishing; still tune the values by ear.

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

Unlisted is *not* a security boundary. Anyone with the link can watch,
forward, embed, or download it. That is fine for a permission preview; do
not treat "unlisted" as "confidential."

The outreach message must make two things explicit so nobody feels
ambushed:

1. **It is not public yet** — this is a preview.
2. **It will not go public without their word** — their permission is the
   trigger, and they can see and hear exactly what they'd be agreeing to.

This turns a vague "can I use your music?" into "here is your song in this
video — may I publish it?", which is a far easier yes.

**Content ID still runs on unlisted (and private) uploads.** A registered
track can claim the preview, reroute monetization, or block playback. Get
the artist's yes on record, and check Studio → Content → Restrictions /
Copyright before you treat the preview as clean.

### Pipeline: Chrome → FFmpeg → YouTube

This is the format-specific companion to the
[Video Production Workflow](video-production-workflow.md) Record (Step 5)
and Assemble/Normalize (Step 6) stages. Camtasia remains the general
default on that page. For a browser match you want **OBS capturing
Chrome**, then **FFmpeg assembling** — not a Chrome extension that bakes
mic + tab audio + music into one WebM.

Keep three audio stems separate until the final mix:

| Stem | Source | Why separate |
|---|---|---|
| Game / tab | Chrome tab audio via OBS (card SFX, UI) | Optional; duck or keep very low so it never fights voice |
| Voice | Dedicated mic into OBS on its own track | Sidechain key for ducking |
| Music | Added in FFmpeg, *not* played through the tab during capture | Otherwise you cannot duck it, and Content ID becomes harder to reason about |

If music is already in the same file as voice, stop and recapture or
isolate. Sidechain ducking cannot key cleanly off a pre-baked mix.

#### 1. Prep the Chrome session

Do this *before* OBS rolls. Card text is the product; Chrome chrome is
not.

- Open the match in its **own Chrome window**, not a tab in a cluttered
  profile. A dedicated "recording" profile with extensions off (ad
  blockers, password prompts, Grammarly overlays) avoids surprise UI.
- Full-screen the play surface (`F11`) or put the window at a fixed
  **1920×1080**. Do not capture a 4K desktop and crop later unless you
  have a reason — YouTube will re-encode anyway, and card glyphs survive
  better when the capture canvas already matches 1080p.
- Hide anything you do not want on camera: other players' hidden
  information on a shared board, diagnostic overlays, Discord / Slack
  toasts, the bookmarks bar, the downloads shelf, picture-in-picture.
- Mute or pause any in-page music / video you are *not* licensing. Tab
  audio should be game SFX only.
- If OBS shows a black frame, disable Chrome's hardware acceleration
  (Settings → System → **Use hardware acceleration when available** off,
  then relaunch) *or* switch the OBS capture method (below).
- Lock the window size. A mid-match maximize/restore changes the crop and
  makes later FFmpeg scale/crop painful.

#### 2. Capture in OBS (not a Chrome recorder)

Chrome tab-capture extensions are fine for a quick clip. They are a poor
parent for this workflow: they usually mix mic + tab into one AAC/Opus
track, write WebM, and drop if the tab crashes. OBS gives you multi-track
audio and a stable 1080p30 file FFmpeg can cut without re-decoding twice.

**Video source (pick one):**

| OBS source | Use when | Notes |
|---|---|---|
| **Window Capture** (Windows Graphics Capture) | Default for `play.legendary-arena.com` | Captures the Chrome window only. Crop the title bar / reserved OS frame in the source filters. |
| **Display Capture** | Window Capture is black or you need the whole monitor | Heavier; leaks other windows. Last resort. |
| **Browser Source** | You want OBS to load the URL itself | Clean 1920×1080 viewport with no Chrome UI. You then play in *that* embedded page, not your everyday window. Not a substitute if you need logged-in cookies from your real profile. |

Do **not** use Game Capture on Chrome. Game Capture hooks game renderers;
a browser is a window.

**Canvas / output (card-game default):**

- Base and output canvas: `1920×1080`
- FPS: `30` (60 does not help card state and doubles bitrate)
- Color: NV12 / SDR / Rec.709
- Encoder: whatever is stable on the machine (NVENC / AMF / x264). This is
  a *capture* file, not the YouTube master. Prefer quality over small
  size: CQP/CRF in the mid-teens, or a high CBR (~20 Mbps) so FFmpeg has
  headroom later.
- Recording format: **MKV** (crash-safe). Remux to MP4 after the take, or
  let FFmpeg read the MKV directly.

**Audio tracks in OBS (this is the whole point):**

| OBS track | What | Monitoring |
|---|---|---|
| Track 1 | Mixdown (voice + game) — optional safety net | Off or headphones only |
| Track 2 | Mic / voice only | Headphones, never speakers (no loopback) |
| Track 3 | Chrome / application audio only | As needed |
| Track 4 | unused / room mics | — |

Enable **Settings → Output → Recording → Audio Track** checkboxes 1–3. In
Advanced Audio Properties, route Mic → tracks 1+2, Chrome/Desktop →
tracks 1+3. Desktop audio should *not* include Spotify, YouTube Music, or
the song you plan to license — those go in at FFmpeg.

Record voice as you play. Do not "fix it in post" by talking over a silent
video unless you can stay in sync; for this format, live narration is the
product.

#### 3. Ingest and cut in FFmpeg

Working files stage on **pCloud, never git** — per
[Workspace Map](workspace-map.md), the per-video folder is
`C:\pcloud\LA\videos\{prefix}-{NNN}-{slug}\` (its shape owned by the
[Video Production Workflow](video-production-workflow.md)); reusable music,
intros, and outros live in `C:\pcloud\LA\video-assets\`.

Inspect first:

```bash
ffprobe -hide_banner -i capture.mkv
```

You want a video stream plus at least two audio streams (voice, game). If
OBS wrote one mixed track only, the take is usable as picture + scratch
audio, but you will need a separate voice file for ducking.

**Remux / extract stems** (copy, no quality loss). OBS track indices are
**machine-dependent** — how Advanced Audio Properties routed each source
decides whether voice is `0:a:1` or `0:a:2`. Confirm with the `ffprobe`
output above before trusting the `-map` numbers here:

```bash
# Picture, no audio — keeps the timeline
ffmpeg -n -i capture.mkv -map 0:v:0 -c copy picture.mkv

# Voice stem (OBS track 2 → usually 0:a:1; CONFIRM with ffprobe)
ffmpeg -n -i capture.mkv -map 0:a:1 -c:a pcm_s16le -ar 48000 -ac 1 voice.wav

# Optional game SFX stem
ffmpeg -n -i capture.mkv -map 0:a:2 -c:a pcm_s16le -ar 48000 -ac 2 game.wav
```

**Cut the session** on the picture file with stream-copy when you can
(keyframe-aligned). For frame-accurate trims, re-encode the picture once
at the end rather than twice.

```bash
# Rough cut, keyframe-aligned (fast)
ffmpeg -n -ss 00:01:12 -to 00:18:40 -i picture.mkv -c copy picture_cut.mkv
```

Apply the same `-ss` / `-to` to the voice (and game) stems so the three
files share a timeline. For audio, decode-based trim is fine:

```bash
ffmpeg -n -ss 00:01:12 -to 00:18:40 -i voice.wav -c:a pcm_s16le voice_cut.wav
```

If you need mid-match cuts (dead air, a leaked overlay, a misclick),
prefer a short `concat` of several picture/voice pairs over a GUI editor
unless the cut list is large. Keep the concat list in the working folder
next to the media.

#### 4. Mix: duck music under voice, then normalize

YouTube presents **one mixed audio track** to viewers of this video.
Multi-language audio / automatic dubbing is a *language* feature (a second
complete mix in Spanish, etc.). It is not a "mute the music" switch and it
is not stem separation. Do not design the mix around viewers turning the
song off.

Mix discipline:

- Resting music bed about **15–20%** of voice level (`volume=0.18`–`0.22`)
  before ducking.
- Duck when voice is present; recover in the gaps. If the bed "pumps"
  between words, lower `ratio` and lengthen `release`.
- Optional game SFX stay quieter than the ducked bed.
- Then loudness-normalize the *finished mix* to a working target of
  **−14 LUFS integrated**, true peak **≤ −1.5 dBTP**. YouTube does not
  publish that number as an upload requirement; it is the industry
  playback reference. Quiet files are not reliably turned *up*.

**Do not reuse the same filter pad twice.** An earlier draft fed `[0:a]`
into both `sidechaincompress` and `amix`; FFmpeg needs `asplit` for that.
And because `amix` of a **mono** voice with a **stereo** bed collapses the
output to mono (verified on FFmpeg 8.1), upmix the voice-mix path to stereo
so the bed keeps its stereo image — that is the `[vmono]…channel_layouts=stereo[voice]`
line below.

Starting recipe — voice is input `0`, music is input `1`:

```bash
ffmpeg -n -i voice_cut.wav -i music.wav -filter_complex "\
  [0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono,asplit=2[vmono][sc]; \
  [vmono]aformat=channel_layouts=stereo[voice]; \
  [1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.20[bed]; \
  [bed][sc]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=400:knee=4:detection=rms[ducked]; \
  [voice][ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]" \
  -map "[mix]" -c:a pcm_s16le -ar 48000 mixed.wav
```

What the graph is doing:

- `aformat` puts both stems on a common rate/layout so `amix` does not
  resample mid-stream.
- `asplit` makes a clean sidechain copy of the voice. First input to
  `sidechaincompress` is the music (**the signal that ducks**); second
  input is the voice (**the detector**). The mono sidechain key against a
  stereo main is fine.
- `[vmono]…channel_layouts=stereo[voice]` upmixes only the mix-path copy of
  the voice, so the final `amix` stays **stereo**. Without it the whole mix
  collapses to mono.
- `volume=0.20` is the resting bed *before* any duck.
- `duration=first` ends with the narration, not a trailing music tail.
  Loop or trim the song to length *before* this command if you want music
  under the whole cut.
- `normalize=0` on `amix` stops FFmpeg from auto-scaling the sum and
  undoing your bed level.

If you also have a game-SFX stem, drop it in at ~0.08–0.12 and `amix`
three inputs. Do not sidechain off SFX.

**Tune by ear, not by copying numbers.** Threshold `0.02` is sensitive
(voice peaks are much hotter than 0.02 on a full-scale WAV). If the bed
never comes back in pauses, raise threshold or drop ratio to `4`. If
consonants click the bed down too fast, raise attack toward `30`–`50`. If
recovery pumps, push release toward `600`–`1000`.

**Two-pass loudnorm** on the mix (measure, then correct):

```bash
ffmpeg -n -i mixed.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null -

# Re-run with the measured_* values the first pass printed:
ffmpeg -n -i mixed.wav \
  -af loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-16.3:measured_TP=-2.1:measured_LRA=8.4:measured_thresh=-26.7:offset=0.5:linear=true \
  -c:a pcm_s16le -ar 48000 mixed_norm.wav
```

Replace the `measured_*` numbers with whatever the first pass reported.
One-pass `loudnorm=I=-14:TP=-1.5:LRA=11` is acceptable for a scratch
check; two-pass is what you upload.

#### 5. Encode the YouTube master

Mux the cut picture with the normalized mix. Re-encode video *once*, to
YouTube's recommended shape: MP4, H.264, AAC-LC, same frame rate as
capture, Rec.709 / SDR. The recommended upload bitrate floor for 1080p30
SDR is **8 Mbps**; for a card-heavy 1080p30 encode, `-crf 18` with
`-preset slow` usually lands above that floor and survives YouTube's
re-encode better than a tight CBR 8M.

```bash
ffmpeg -n -i picture_cut.mkv -i mixed_norm.wav \
  -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -movflags +faststart \
  youtube_master.mp4
```

If the picture is already a clean 1080p30 H.264 capture you trust, you may
`-c:v copy` and only replace audio — smaller risk of a second generation.
Probe first; do not copy a variable-frame-rate or non-`yuv420p` capture
into an upload.

Verify before Studio:

```bash
ffprobe -hide_banner -i youtube_master.mp4
ffmpeg -n -i youtube_master.mp4 -af ebur128=framelog=verbose -f null -
```

Integrated loudness should sit near **−14 LUFS**, true peak under
**−1.5 dBTP**, stereo 48 kHz AAC, 1920×1080, 30 fps, `moov` at the front
(`+faststart`).

#### 6. Upload unlisted — then wait on both gates

1. YouTube Studio → Upload `youtube_master.mp4`.
2. Visibility: **Unlisted**. Not private (artist cannot open it easily).
   Not public (IP gate).
3. Add title, description, chapters, and captions on the unlisted copy.
   Captions help the artist follow the talk-over and help you later; they
   are not a visibility change.
4. Wait for processing **and** for the copyright scan. Check Studio for a
   Content ID claim before you send the link. Unlisted is scanned the same
   as public.
5. Send the artist the link with the two explicit sentences above. Keep
   the yes/no in writing (mail or chat), in the video working folder.
6. Do **not** flip to Public to "test the mix" or "see how the thumbnail
   looks in Browse." Watch the unlisted URL in an incognito window. Mix QA
   happens there.
7. Public is a joint decision: artist permission **and** the IP /
   license-clean posture. This page does not own the second one — see
   [IP Licensing](ip-licensing.md).

Shorts / Arena Clips: cut from the same master with a 9:16 crop in FFmpeg
(`crop` + `scale=1080:1920`) only after the long-form mix is signed off.
Do not run a second, different music bed through a Short unless that use is
in the same permission.

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
- **[Workspace Map](workspace-map.md)** — the authority for where capture
  files and intermediates stage: pCloud, never git, under
  `C:\pcloud\LA\videos\` and `C:\pcloud\LA\video-assets\`.
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
  unsearchable and off your channel. Fine for a permission preview; do not
  treat "unlisted" as "confidential."
- **Content ID scans unlisted and private videos.** Using a musician's
  track that is registered (or later gets registered) can trigger a claim
  that mis-routes monetization or blocks playback — a reason to have the
  artist's explicit permission on record, and to check for claims before
  relying on the preview.
- **Do not publish public to test the mix.** The IP gate means "flip to
  public" is not a casual QA step. Verify the mix on the unlisted video in
  an incognito window.
- **Multi-audio-track is dubbing, not stems.** YouTube's multi-language
  audio and automatic dubbing attach *another language's complete mix*.
  They do not let a viewer mute the song under your voice. Bake the mix.
- **`amix` collapses to mono.** Mixing a mono voice stem with a stereo
  music bed yields a mono master unless the mix-path voice copy is upmixed
  to stereo first (the `channel_layouts=stereo` step in the recipe). The
  final `-ac 2` at encode would otherwise just fake stereo from a mono sum.
- **Reused filter pad.** A pad label (`[0:a]`) cannot feed two filters;
  route it through `asplit` first, or FFmpeg errors on the graph.
- **Ducking that pumps.** Too aggressive a `ratio` / too fast a `release`
  makes the music audibly "pump" up and down between words. Moderate the
  ratio and lengthen the release if it breathes unnaturally.
- **Voice and music must be separable at mix time.** If music is baked into
  the same track as the voice during capture, sidechain ducking can't key
  off the voice cleanly. Keep them on separate tracks until the final mix.
- **OBS track indices are machine-dependent.** Whether the voice is
  `0:a:1` or `0:a:2` depends on how Advanced Audio Properties routed the
  sources on that machine. Confirm with `ffprobe` before trusting a
  `-map` number.
- **Chrome black-frame in OBS.** Switch the Window Capture method, disable
  Chrome hardware acceleration, or use Display Capture as a fallback. Do
  not "fix" it by recording a phone pointed at the monitor unless you are
  deliberately doing the table-feel format.
- **Do not use Game Capture on Chrome.** Game Capture hooks game
  renderers; a browser is a window. Use Window / Display / Browser Source.
- **VFR / odd canvas from a Chrome-extension recording.** If you did
  capture with an extension, remux and `fps=30,scale=1920:1080:flags=lanczos`
  before the mix so the YouTube master is constant-frame-rate 16:9.
- **Framing leaks.** A live capture of the play client can catch diagnostic
  overlays or a shared board's hidden information. Frame the shot (or the
  screen-record region) to exclude what shouldn't be on camera.
- **Artist says yes, then Content ID still claims.** Permission and
  Content ID are different machines. A yes from the musician may still need
  them (or their distributor) to whitelist the video in YouTube's rights
  manager. Do not assume the unlisted preview staying playable means Public
  will.
- **Camera-on-the-play variant.** Physical camera framing you and/or the
  screen is the community "at the table" feel. It inherits the stability +
  lighting discipline from the
  [hero-loop page](after-effects-stop-motion-hero-loop.md). Audio still
  follows the same stem rule: camera audio is *voice* (or scratch), music
  is added in FFmpeg.

## Open Questions

- **License-clean gameplay surface.** The IP gate keeps Marvel-showing
  gameplay unlisted; whether a *public* gameplay-video program runs against
  a reskinned (fantasy / public-domain) build, and when, is owned by the
  acquisition plan and its decision log — not by this page. Check
  [IP Licensing](ip-licensing.md) before publishing any gameplay video
  publicly.
- **Loudness / encode targets are a working reference, not an engine
  contract.** `-14 LUFS` / `-1.5 dBTP` and the CRF 18 shape are the
  playback-reference and general-practice values used across the
  [Video Production Workflow](video-production-workflow.md); YouTube does
  not publish an official loudness upload requirement.

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
- [Workspace Map](workspace-map.md) — where capture files and
  intermediates stage (pCloud `C:\pcloud\LA\videos\` / `video-assets\`)
- [After Effects Stop-Motion Hero Loop](after-effects-stop-motion-hero-loop.md)
  — shared capture-discipline reference
- [`docs/01-VISION.md`](../docs/01-VISION.md) — §Financial Sustainability:
  the royalty covenant to Upper Deck / Marvel that the IP gate serves
- `C:\www\legendary-arena-com\docs\corporate-memory\04-ip-licensing-acquisition-plan.md`
  — the acquisition plan behind the license-clean posture (marketing repo,
  internal; draft, pre-outreach)
- [FFmpeg — sidechaincompress filter](https://ffmpeg.org/ffmpeg-filters.html#sidechaincompress)
  — automatic music-ducking filter (first input = music to duck, second =
  voice detector; split the voice pad with `asplit`)
- [FFmpeg — loudnorm filter](https://ffmpeg.org/ffmpeg-filters.html#loudnorm)
  — two-pass EBU R128 normalization to the −14 LUFS / −1.5 dBTP target
- [YouTube Help — Recommended upload encoding settings](https://support.google.com/youtube/answer/1722171)
  — MP4 + H.264 + AAC-LC, match source frame rate, SDR bitrate floors
- [YouTube Help — Add subtitles & alternate audio (multi-language audio)](https://support.google.com/youtube/answer/12569396)
  — confirms extra audio tracks are for language dubs, not music/voice stems
