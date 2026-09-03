---
title: Gameplay Video Production (YouTube)
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
  - C:\pcloud\BB\DEV\legendary-arena\wiki\gameplay-video-production-youtube.md (this page — https://ewiki.legendary-arena.com/gameplay-video-production-youtube/)
  - ../docs/01-VISION.md
last-reviewed: 2026-09-03
---

## Summary

End-to-end production of a `play.legendary-arena.com` gameplay video for
YouTube — the "play a match and talk over it" format that community
channels (the Bageltop Games ecosystem, for example) use. Covers capture,
editing, mixing, encoding, publishing, and the two governance gates that
decide when it may go public. It is the format-specific companion to the
general [Video Production Workflow](video-production-workflow.md).

The production spine:

> **Chrome tab (gameplay) → OBS capture (video + separate audio stems) →
> FFmpeg edit / duck / loudness / YouTube encode → YouTube Studio upload as
> Unlisted → artist + IP gates → Public only when both clear.**

**This page owns production mechanics; it does not define licensing
policy** — [IP Licensing](ip-licensing.md) is the authoritative source for
publication-visibility decisions. This page is `draft`: the licensing
posture is sourced to governance below, and the audio / YouTube / FFmpeg
mechanics are general external facts (the FFmpeg recipes were run against
FFmpeg 8.1 before publishing) rather than engine-cited claims.

## Mechanics

### Decision gates

A video may be **made** at any time. **Public** publication requires every
applicable gate to pass; until then it stays Unlisted.

| Gate | Authority | Requirement | If it fails |
|---|---|---|---|
| **IP** | [IP Licensing](ip-licensing.md) | Gameplay showing Marvel / *Legendary* IP stays Unlisted until the license-clean policy changes | Public publication blocked |
| **Music** | The creator | Written artist permission on file **and** no unresolved Content ID restriction | Public publication blocked |
| **Technical QA** | The producer | Passes the [Ready-to-publish quality bar](#ready-to-publish--quality-bar) | Upload / release blocked |

The single policy line the rest of the page defers to:

> **Gameplay videos showing Marvel or *Legendary* IP stay Unlisted unless
> [IP Licensing](ip-licensing.md) explicitly authorizes public
> publication.** Recording a match does not create a new right; publishing
> it publicly amplifies the exposure the acquisition plan already flags.
> See [`docs/01-VISION.md`](../docs/01-VISION.md) §Financial Sustainability
> for the royalty covenant this serves.

The IP gate and the music gate happen to want the same thing — an
**Unlisted** video first — so the two converge on one default: record
freely, stay unlisted, go public only when both clear.

### Unlisted, not private — the song-permission handshake {#song-permission-handshake}

The strongest way to ask a musician for permission is to remove the
guesswork: show them the finished video with their track in place and ask
for a yes on something concrete rather than an imagined use.

Use **unlisted**, not **private**:

| Visibility | Who can watch | Fit for the artist ask |
|---|---|---|
| **Private** | Only Google accounts you explicitly grant | Poor — the artist must be signed into a whitelisted account |
| **Unlisted** | Anyone with the link; not in search, not on your channel | **Good** — the artist just opens a link and watches |
| **Public** | Everyone; searchable; on your channel | Gated (see [Decision gates](#decision-gates)) |

Unlisted is **not a security boundary** — anyone with the link can watch,
forward, embed, or download it. Fine for a permission preview; do not
treat it as confidential. And **Content ID still scans Unlisted (and
Private) uploads**: a registered track can claim the preview, reroute
monetization, or block playback, so check Studio → Content →
Restrictions / Copyright before you rely on it.

The outreach makes two things explicit so nobody feels ambushed:

1. **It is not public yet** — this is a preview.
2. **It will not go public without their word** — their permission is the
   trigger.

Music-usage authorization is satisfied **only by written permission
retained in the project folder** (mail or chat), not a verbal yes. This
turns a vague "can I use your music?" into "here is your song in this
video — may I publish it?", a far easier yes.

### Pipeline: Chrome → FFmpeg → YouTube

The format-specific companion to the
[Video Production Workflow](video-production-workflow.md) Record (Step 5)
and Assemble/Normalize (Step 6) stages. Camtasia is the general default
there; for a browser match you want **OBS capturing Chrome**, then
**FFmpeg assembling** — not a Chrome extension that bakes mic + tab audio
+ music into one WebM.

**Minimum command sequence** (the whole pipeline, once the capture and the
licensed song exist — details in the steps below):

```bash
ffprobe -hide_banner -i capture.mkv                       # 1. confirm stream/track order
ffmpeg -ss 00:01:12 -to 00:18:40 -i capture.mkv \
  -map 0 -c copy capture_cut.mkv                          # 2. cut A/V together (see step 3)
ffmpeg -i capture_cut.mkv -map 0:a:1 -ar 48000 -ac 1 voice.wav   # 3. extract stems AFTER the cut
ffmpeg -i voice.wav -i music.wav -filter_complex "…duck…" mixed.wav   # 4. mix (recipe below)
ffmpeg -i mixed.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null -  # 4. measure
ffmpeg -i mixed.wav -af loudnorm=…measured_*… mixed_norm.wav       # 4. normalize
ffmpeg -i capture_cut.mkv -i mixed_norm.wav -map 0:v:0 -map 1:a:0 …  youtube_master.mp4  # 5. encode
# 6. Upload Unlisted → wait for Content ID → clear artist + IP gates → Public
```

Keep three audio stems separate until the final mix:

| Stem | Source | Why separate |
|---|---|---|
| Game / tab | Chrome tab audio via OBS (card SFX, UI) | Optional; duck or keep low so it never fights voice |
| Voice | Dedicated mic into OBS on its own track | Sidechain key for ducking |
| Music | Added in FFmpeg, *not* played through the tab during capture | Otherwise you cannot duck it, and Content ID is harder to reason about |

If music is already in the same file as voice, stop and recapture or
isolate. Sidechain ducking cannot key cleanly off a pre-baked mix.

#### 1. Prep the Chrome session

Do this *before* OBS rolls. Card text is the product; Chrome chrome is
not.

- Open the match in its **own Chrome window** on a dedicated "recording"
  profile with extensions off (ad blockers, password prompts, Grammarly
  overlays) so no surprise UI appears.
- Full-screen the play surface (`F11`) or fix the window at **1920×1080**.
  Do not capture a 4K desktop and crop later — YouTube re-encodes anyway,
  and card glyphs survive better when the canvas already matches 1080p.
- Hide anything you do not want on camera: other players' hidden info on a
  shared board, diagnostic overlays, Discord / Slack toasts, the bookmarks
  bar, the downloads shelf, picture-in-picture.
- Mute or pause any in-page music / video you are *not* licensing. Tab
  audio should be game SFX only.
- If OBS shows a black frame, disable Chrome's hardware acceleration
  (Settings → System → **Use hardware acceleration when available** off,
  then relaunch) *or* switch the OBS capture method (below).
- Lock the window size. A mid-match maximize/restore changes the crop.

**Pre-recording checklist:** recording profile loaded · notifications
off / Do Not Disturb · window locked to 1920×1080 · OBS audio tracks
verified · mic monitoring on headphones (no speakers) · working folder
created under `C:\pcloud\LA\videos\…`.

#### 2. Capture in OBS (not a Chrome recorder)

Chrome tab-capture extensions are fine for a quick clip but a poor parent
here: they usually mix mic + tab into one track, write WebM, and drop if
the tab crashes. OBS gives multi-track audio and a stable 1080p30 file.

**OBS requirements** (required): separate voice / tab audio tracks ·
1920×1080 canvas · 30 fps · **MKV** recording (crash-safe).
**Recommended:** Window Capture · a hardware encoder.
**Not recommended:** Chrome recording extensions · Game Capture on Chrome
(Game Capture hooks game renderers; a browser is a window).

**Video source (pick one):**

| OBS source | Use when | Notes |
|---|---|---|
| **Window Capture** (Windows Graphics Capture) | Default for `play.legendary-arena.com` | Chrome window only. Crop the title bar in the source filters. |
| **Display Capture** | Window Capture is black or you need the whole monitor | Heavier; leaks other windows. Last resort. |
| **Browser Source** | You want OBS to load the URL itself | Clean 1920×1080 viewport, no Chrome UI. You play in *that* embedded page. Not a substitute if you need logged-in cookies from your real profile. |

**Canvas / output:** base + output `1920×1080`, `30` fps (60 does not help
card state and doubles bitrate), NV12 / SDR / Rec.709, a stable encoder
(NVENC / AMF / x264) at CQP/CRF in the mid-teens or a high CBR (~20 Mbps)
so FFmpeg has headroom. Record to **MKV**; remux to MP4 after the take or
let FFmpeg read the MKV directly.

**Audio routing — the whole point, and the easiest thing to get wrong.**

| OBS track | What | Route |
|---|---|---|
| Track 1 | Mixdown (voice + game) — optional safety net | Mic + game |
| Track 2 | Mic / voice only | Mic |
| Track 3 | Chrome / application audio only | See below |

Enable **Settings → Output → Recording → Audio Track** checkboxes 1–3.
Capture Chrome's audio with **Application Audio Capture** (match Chrome by
executable) or **Window Capture → Capture Audio**, and **disable the
global Desktop Audio device** — plain "Desktop Audio" is Discord, Slack, a
forgotten Spotify tab, and the song you plan to license, all of which
leak into the recording. Route Mic → tracks 1+2, the Chrome
application-audio source → tracks 1+3.

Record voice as you play; for this format, live narration is the product.

#### 3. Ingest and cut in FFmpeg

Working files stage on **pCloud, never git** — per
[Workspace Map](workspace-map.md), the per-video folder is
`C:\pcloud\LA\videos\{prefix}-{NNN}-{slug}\` (its shape owned by the
[Video Production Workflow](video-production-workflow.md)); reusable music,
intros, and outros live in `C:\pcloud\LA\video-assets\`.

Inspect first — and note the stream/track order for every `-map` below:

```bash
ffprobe -hide_banner -i capture.mkv
```

You want a video stream plus at least two audio streams (voice, game). If
OBS wrote one mixed track only, the take is usable as picture + scratch
audio, but you need a separate voice file for ducking.

**Cut first, then extract — or the audio drifts.** A copy-seek
(`-ss` before `-i`, `-c copy`) snaps the *video* to the previous keyframe;
a decoded WAV seeks to the exact sample. Cut the picture and the voice
with two different seek behaviours and the voice sits late for the entire
file. Two legal patterns — pick one, do not mix:

*Pattern A — cut the combined capture once, then extract (recommended).*
The single cut keeps video and audio locked together:

```bash
# One cut on the combined file (fast, keyframe-aligned copy)
ffmpeg -ss 00:01:12 -to 00:18:40 -i capture.mkv -map 0 -c copy capture_cut.mkv

# Now extract stems from the ALREADY-CUT file — they share one timeline.
# OBS track indices are MACHINE-DEPENDENT (how Advanced Audio Properties
# routed each source): voice may be 0:a:1 or 0:a:2 — CONFIRM with ffprobe.
ffmpeg -i capture_cut.mkv -map 0:v:0 -c copy picture_cut.mkv
ffmpeg -i capture_cut.mkv -map 0:a:1 -c:a pcm_s16le -ar 48000 -ac 1 voice_cut.wav
ffmpeg -i capture_cut.mkv -map 0:a:2 -c:a pcm_s16le -ar 48000 -ac 2 game_cut.wav
```

*Pattern B — cut each stream separately, but decode-accurately.* Put
`-ss` / `-to` **after** `-i` so every stream seeks to the exact same
time (frame- and sample-accurate), re-encoding the picture once:

```bash
ffmpeg -i picture.mkv -ss 00:01:12 -to 00:18:40 -c:v libx264 -crf 16 picture_cut.mkv
ffmpeg -i voice.wav   -ss 00:01:12 -to 00:18:40 -c:a pcm_s16le voice_cut.wav
```

For mid-match cuts (dead air, a leaked overlay, a misclick), prefer a
short `concat` of matched picture/voice pairs over a GUI editor unless the
cut list is large. Keep the concat list next to the media.

#### 4. Mix: duck music under voice, then normalize

YouTube presents **one mixed audio track** to viewers. Multi-language
audio / automatic dubbing is a *language* feature (a second complete mix in
Spanish, etc.), not a "mute the music" switch and not stem separation.
Bake the mix.

Mix discipline:

- **Default music bed level: `volume=0.20`** (about 15–20% of voice).
  Deviate only when narration clarity fails review.
- Duck when voice is present; recover in the gaps.
- Optional game SFX stay quieter than the ducked bed.
- Loudness-normalize the *finished mix* to a working target of
  **−14 LUFS integrated**, true peak **≤ −1.5 dBTP**. YouTube does not
  publish that as an upload requirement — it is the industry playback
  reference, and quiet files are not reliably turned *up*.

**Two graph rules the earlier draft got wrong.** (1) A pad label (`[0:a]`)
cannot feed two filters — route it through `asplit`. (2) `amix` of a
**mono** voice with a **stereo** bed collapses the master to mono (verified
on FFmpeg 8.1), so upmix the mix-path voice copy to stereo — the
`[vmono]…channel_layouts=stereo[voice]` line.

Two-stem recipe — voice is input `0`, music is input `1`:

```bash
ffmpeg -n -i voice_cut.wav -i music.wav -filter_complex "\
  [0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono,asplit=2[vmono][sc]; \
  [vmono]aformat=channel_layouts=stereo[voice]; \
  [1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.20[bed]; \
  [bed][sc]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=400:knee=4:detection=rms[ducked]; \
  [voice][ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]" \
  -map "[mix]" -c:a pcm_s16le -ar 48000 mixed.wav
```

What the graph does: `aformat` puts both stems on a common rate/layout;
`asplit` makes a clean sidechain copy of the voice (first `sidechaincompress`
input is the **music**, the signal that ducks; second is the **voice**, the
detector — a mono key against a stereo main is fine); the
`channel_layouts=stereo` upmix keeps the final `amix` stereo; `volume=0.20`
is the resting bed; `duration=first` ends with the narration; `normalize=0`
stops `amix` from auto-scaling the sum and undoing the bed level.

**A short song needs looping.** `duration=first` trims to the narration but
will **not invent tail music** — a song shorter than the cut leaves silence
under the back half. Loop the song to fill by adding `-stream_loop -1`
before its `-i` (`ffmpeg -n -i voice_cut.wav -stream_loop -1 -i music.wav …`),
or accept a silent tail with `apad`. `-stream_loop -1` + `duration=first`
gives music under the whole cut, trimmed to length.

**Three-stem variant** (adds a game-SFX bed at a low fixed level — do not
sidechain off SFX): input `2` is `game_cut.wav`.

```bash
ffmpeg -n -i voice_cut.wav -i music.wav -i game_cut.wav -filter_complex "\
  [0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono,asplit=2[vmono][sc]; \
  [vmono]aformat=channel_layouts=stereo[voice]; \
  [1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.20[bed]; \
  [bed][sc]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=400:knee=4:detection=rms[ducked]; \
  [2:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.10[sfx]; \
  [voice][ducked][sfx]amix=inputs=3:duration=first:dropout_transition=0:normalize=0[mix]" \
  -map "[mix]" -c:a pcm_s16le -ar 48000 mixed.wav
```

**Values are defaults, not gospel — but the test is objective.** Keep
`0.20` / `threshold=0.02` / `ratio=6` and adjust only when review fails:
**verify at least one ~5-second speech pause recovers audible music**; if
it does not, raise `threshold` or drop `ratio` to `4`. If consonants click
the bed down, raise `attack` toward `30`–`50`; if recovery pumps between
words, push `release` toward `600`–`1000`.

**Two-pass loudnorm** on the mix (measure, then correct):

```bash
ffmpeg -n -i mixed.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null -

# Re-run with the measured_* values the first pass printed:
ffmpeg -n -i mixed.wav \
  -af loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-16.3:measured_TP=-2.1:measured_LRA=8.4:measured_thresh=-26.7:offset=0.5:linear=true \
  -c:a pcm_s16le -ar 48000 mixed_norm.wav
```

One-pass `loudnorm=I=-14:TP=-1.5:LRA=11` is fine for a scratch check;
two-pass is what you upload.

#### 5. Encode the YouTube master

Mux the cut picture with the normalized mix; re-encode video *once*, to
YouTube's recommended shape: MP4, H.264, AAC-LC, capture frame rate,
Rec.709 / SDR. `-crf 18 -preset slow` on a card-heavy 1080p30 clip lands
above YouTube's 8 Mbps 1080p30 SDR floor and survives the re-encode better
than a tight CBR 8M.

**Tag Rec.709 explicitly.** The bare `-colorspace/-color_primaries/-color_trc`
flags only reliably set the matrix on libx264 (verified on FFmpeg 8.1 — the
other two came back `unknown`); add `-x264-params` so primaries, transfer,
and matrix all land in the H.264 VUI:

```bash
ffmpeg -n -i picture_cut.mkv -i mixed_norm.wav \
  -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709" \
  -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -movflags +faststart \
  youtube_master.mp4
```

If the picture is already a clean 1080p30 H.264 capture you trust, you may
`-c:v copy` and only replace audio. Probe first; do not copy a
variable-frame-rate or non-`yuv420p` capture into an upload.

Verify before Studio:

```bash
ffprobe -hide_banner -i youtube_master.mp4
ffmpeg -n -i youtube_master.mp4 -af ebur128=framelog=verbose -f null -
```

#### 6. Upload Unlisted — then clear both gates

1. YouTube Studio → Upload `youtube_master.mp4`.
2. Visibility: **Unlisted**. Not private (artist can't open it easily), not
   public ([Decision gates](#decision-gates)).
3. Add title, description, chapters, and captions on the Unlisted copy.
4. Wait for processing **and** the copyright scan; check Studio for a
   Content ID claim before you send the link.
5. Send the artist the link with the two explicit sentences above; keep
   their written yes/no in the video working folder.
6. QA on the Unlisted URL in an **incognito** window. Do not flip to Public
   to "test the mix."
7. Public is a joint decision: artist permission **and** the IP posture
   ([IP Licensing](ip-licensing.md) owns the second).

Shorts / Arena Clips: **crop to 9:16 first, then scale** — `scale=1080:1920`
straight from a 16:9 master squashes the board. Crop a `608×1080` window
(center by default; shift the `x` offset if the cards you care about are
off-center), then upscale:

```bash
ffmpeg -n -i youtube_master.mp4 \
  -vf "crop=608:1080:(iw-608)/2:0,scale=1080:1920:flags=lanczos,setsar=1" \
  short.mp4
```

Cut Shorts only after the long-form mix is signed off, and do not run a
different music bed through a Short unless that use is in the same
permission.

### Ready to publish — quality bar {#ready-to-publish--quality-bar}

The video is ready for **public** release when all of these hold (the
Technical QA gate in [Decision gates](#decision-gates)):

- Master is MP4 / H.264 High / AAC-LC, **1920×1080**, capture frame rate
  (30 fps), `yuv420p`, Rec.709-tagged, `+faststart`.
- Integrated loudness sits near **−14 LUFS**, true peak under
  **−1.5 dBTP** (confirm with the `ebur128` probe above).
- A ~5-second speech pause recovers audible music (the duck breathes).
- Content ID reviewed; no unresolved claim/restriction.
- If a licensed song is used, **written** artist permission is in the
  project folder.
- Working files are on pCloud; the master is exported.
- The IP posture authorizes Public (else it stays Unlisted).

Any box unchecked → the video stays **draft or Unlisted**.

## Interactions

- **[Video Production Workflow](video-production-workflow.md)** — the
  ten-step parent pipeline (idea → published video → companion blog). This
  page is the gameplay-session-specific companion to its Record (Step 5)
  and Assemble/Normalize (Step 6) stages.
- **[YouTube Channel Plan](youtube-channel-plan.md)** — the "Legendary
  Arena" channel strategy. A play-and-narrate match feeds the **Across the
  Table** (gameplay) series and **Arena Clips** (Shorts).
- **[IP Licensing](ip-licensing.md)** — the authority for the
  publication-visibility gate: the two unlicensed rights, the standing
  exposure of the public Marvel build, and the license-clean posture.
- **[Music Authoring](music-authoring.md)** — the in-app music pipeline
  (per-theme/hero Suno tracks). Distinct from a **third-party musician's
  song** used as a backing track, which is what the handshake is for.
- **[Workspace Map](workspace-map.md)** — the authority for where capture
  files and intermediates stage: pCloud, never git, under
  `C:\pcloud\LA\videos\` and `C:\pcloud\LA\video-assets\`.
- **[After Effects Stop-Motion Hero Loop](after-effects-stop-motion-hero-loop.md)**
  — shares the capture-discipline detail (stability, lighting, screen-vs-
  camera record settings), though it targets a different artifact.

## Edge Cases

- **Cut-seek A/V desync.** A copy-seek (`-ss` before `-i`, `-c copy`) snaps
  the video to the previous keyframe; a decoded WAV seeks exactly. Cutting
  picture and voice with mismatched seek modes leaves the voice late for
  the whole file. Cut the combined capture once and extract after (Pattern
  A), or seek decode-accurately with `-ss` after `-i` on both (Pattern B).
- **OBS "Desktop Audio" leaks.** The global Desktop Audio device captures
  Discord, Slack, notifications, and any music player. Use Application
  Audio Capture (match Chrome) or Window Capture → Capture Audio, and
  disable global Desktop Audio.
- **`amix` collapses to mono.** Mixing a mono voice with a stereo bed
  yields a mono master unless the mix-path voice copy is upmixed to stereo
  first; the encode's `-ac 2` would otherwise just fake stereo.
- **Reused filter pad.** A pad label cannot feed two filters; route it
  through `asplit` or FFmpeg errors on the graph.
- **Short song, silent tail.** `duration=first` will not invent tail music;
  loop the song with `-stream_loop -1` (or `apad` for a deliberate silent
  tail).
- **Shorts squash.** `scale=1080:1920` straight from a 16:9 master flattens
  the board. Crop `608×1080` first, then scale.
- **Rec.709 half-tagged.** The plain `-color_*` flags only set the matrix
  on libx264 (FFmpeg 8.1); add `-x264-params "colorprim=…:transfer=…:colormatrix=…"`
  for full primaries/transfer/matrix tagging.
- **Ducking that pumps.** Too high a `ratio` / too fast a `release` makes
  the bed pump between words. Lower the ratio, lengthen the release.
- **Unlisted ≠ private, and neither is confidential.** Private needs a
  whitelisted Google account (bad for the artist ask); Unlisted is
  anyone-with-the-link and forwardable. See
  [the handshake](#song-permission-handshake).
- **Content ID runs on Unlisted, and permission ≠ clearance.** A registered
  track can claim an Unlisted preview; a yes from the musician may still
  need them (or their distributor) to whitelist the video in YouTube's
  rights manager. Do not assume a playable preview means Public will play.
- **Chrome black-frame in OBS.** Switch the Window Capture method, disable
  Chrome hardware acceleration, or fall back to Display Capture. Do not
  record a phone pointed at the monitor unless you are deliberately doing
  the table-feel format.
- **Do not use Game Capture on Chrome.** It hooks game renderers; a browser
  is a window. Use Window / Display / Browser Source.
- **VFR / odd canvas from an extension recording.** Remux and
  `fps=30,scale=1920:1080:flags=lanczos` before the mix so the master is
  constant-frame-rate 16:9.
- **Framing leaks.** A live capture can catch diagnostic overlays or a
  shared board's hidden information. Frame the shot to exclude them.
- **Camera-on-the-play variant.** Physical-camera framing is the community
  "at the table" feel; it inherits stability + lighting discipline from the
  [hero-loop page](after-effects-stop-motion-hero-loop.md). Camera audio is
  *voice* (or scratch); music is still added in FFmpeg.

## Open Questions

- **License-clean gameplay surface.** The IP gate keeps Marvel-showing
  gameplay Unlisted; whether a *public* gameplay-video program runs against
  a reskinned (fantasy / public-domain) build, and when, is owned by the
  acquisition plan and its decision log — not this page. Check
  [IP Licensing](ip-licensing.md) before publishing any gameplay video
  publicly.

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
