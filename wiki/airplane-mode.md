---
title: Airplane Mode
type: Guide
tags:
  - platform
  - arena-client
  - offline
  - images
  - persistence
  - determinism
related:
  - webos-tv-port.md
  - windows-engine-exe.md
  - r2-image-naming-convention.md
  - guest-accounts.md
  - bot-ally.md
  - monetization-model.md
  - ip-licensing.md
  - lagn-v1.md
  - scoring.md
  - responsive-viewport-targets.md
status: draft
source:
  - C:\dev\legendary-arena\wiki\airplane-mode.md (this page — https://ewiki.legendary-arena.com/airplane-mode/)
  - ../apps/arena-client/src/client/bgioClient.ts
  - ../apps/arena-client/src/composables/useCardImagePrefetch.ts
  - ../apps/arena-client/src/composables/useDeployVersionCheck.ts
  - ../apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts
  - ../apps/arena-client/src/lib/api/analyticsEmitter.ts
  - ../apps/arena-client/vite.config.ts
  - ../apps/arena-client/public/_headers
  - ../packages/game-engine/src/game.ts
  - ../packages/game-engine/src/ui/uiState.build.ts
  - ../packages/game-engine/package.json
  - ../packages/registry/src/impl/httpRegistry.ts
  - ../packages/registry/src/heroImageUrl.ts
  - ../apps/server/src/server.mjs
  - ../apps/server/src/game/matchSeed.mjs
  - ../apps/server/src/game/syncRedaction.mjs
  - ../apps/server/src/match/guestSoloRoutes.mjs
  - ../apps/server/src/bot-ally/botAllyDriver.mjs
  - ../apps/server/src/db/bgioPgStore.js
  - ../docs/ai/DESIGN-SOLO-BOT-ALLY.md
  - ../docs/ops/RUNBOOK-r2-image-cache-control.md
  - ../docs/13-REPLAYS-REFERENCE.md
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-11-12
---

# Airplane Mode

> **Status: design research. Nothing built, nothing decided.** No WP, EC, or
> DECISIONS entry covers airplane mode. Everything this page recommends is a
> *candidate* for a future WP or decision, not a commitment. Code facts come
> from `main` at `a34b66a5` (2026-11-12). Facts about other products come from
> their help pages and reviews, read 2026-11-12 and linked under References;
> anything marked *unverified* wasn't confirmed from a primary source.

## Summary

Airplane mode would let a player download one solo match setup (its
mastermind, scheme, villains, henchmen, heroes and the shared cards) and then
play it start to finish with no connection. Today that isn't possible: every
match runs on the server and the browser only renders. The work is mostly in
the arena-client: run the existing engine in the browser for a single-seat
match, cache the app and the setup's card art, and save the game on the
device. The engine's determinism (D-0002) is what makes offline play
trustworthy: a game saved as setup plus seed plus move log can be replayed and
checked by the server when the player is back online.

## Mechanics

### Recommendation

- **Candidate scope for a first version:** single-seat solo, no bot ally,
  unranked, in the browser as an installable web app (a PWA). The player picks a
  setup, taps **Download for airplane mode**, sees the size first, and gets a
  **Ready offline** badge when it's done.
- **Candidate architecture:**
  - A boardgame.io client with the in-browser `Local()` master, running the
    same `LegendaryGame` the server runs.
  - Card data cached in full: about 2 MB of JSON, small enough to take all of it.
  - Card art cached **per setup** in Cache Storage, through a service worker.
  - Saved games and the offline results queue kept in IndexedDB.
- **Decisions needed before a WP, cheapest first:**
  1. **Running the rules on the device.** The engine already ships in the
     client bundle, but today it only renders: moves are `client: false`
     (D-10008), the seed is server-held, and a client-side bot was rejected
     for online play. Offline solo needs a decision that the device may host a
     single-seat match, plus a ruling on how that sits with the persistence
     boundary (see [Saving the game](#saving-the-game)).
  2. **Who gets it.** Airplane mode is a convenience feature, so it fits as a
     Legendary Pass perk ([Monetization Model](monetization-model.md)) as well
     as a free one. That's a business call. Either way it never changes a game
     outcome, so it stays clear of NG-1.
  3. **Rights.** Caching Marvel art on players' devices is a new form of digital
     distribution. [IP Licensing](ip-licensing.md) records that the digital
     character rights aren't in hand yet. A license might require download
     expiry; that would set the refresh rule below.

### What the code does today

| Area | Today | What airplane mode needs |
|---|---|---|
| Where rules run | Server only. [`server.mjs`](../apps/server/src/server.mjs) loads the registry from disk and serves `LegendaryGame` from boardgame.io `Server()`. The client builds `Client({ game: LegendaryGame, multiplayer: SocketIO(...) })` in [`bgioClient.ts`](../apps/arena-client/src/client/bgioClient.ts). There's no `Local()` transport, practice or hotseat mode | A local master in the browser for single-seat matches |
| Moves | Every move is long-form `client: false` (D-10008, [`game.ts`](../packages/game-engine/src/game.ts)). The client sees only the `playerView` UIState, never raw `G` | Unchanged: with a local master, the master runs the moves and the client still sees only `playerView` *(inferred from boardgame.io's design; not yet tested)* |
| Engine in the browser | The runtime-safe `.` export has no `node:*` imports. The Node-only pieces sit behind `./setup` ([`package.json`](../packages/game-engine/package.json)). [`vite.config.ts`](../apps/arena-client/vite.config.ts) fails the build on any `node:*` leak. Today the client imports only small helpers at runtime | `Game.setup()` in the browser, fed by a registry reader |
| Card data for setup | Setup needs a `CardRegistryReader` to build `cardDisplayData`; without one it falls back to an empty registry and builds an empty match. The browser-capable reader is [`httpRegistry.ts`](../packages/registry/src/impl/httpRegistry.ts). The registry barrel also re-exports the `node:fs` loader, and there's no browser subpath | A browser entry point for the registry, reading cached JSON |
| Seed | Server-generated ([`matchSeed.mjs`](../apps/server/src/game/matchSeed.mjs), WP-809) and kept from clients by [`syncRedaction.mjs`](../apps/server/src/game/syncRedaction.mjs) | Generated on the device. The device then knows its seed (see [Edge Cases](#edge-cases)) |
| Bot ally | Server-side ([`botAllyDriver.mjs`](../apps/server/src/bot-ally/botAllyDriver.mjs)). [DESIGN-SOLO-BOT-ALLY](../docs/ai/DESIGN-SOLO-BOT-ALLY.md) rejects a client-side bot for online play. The policies are in the runtime-safe engine export | Left out of version 1 |
| Saved state | Postgres `bgio` schema ([`bgioPgStore.js`](../apps/server/src/db/bgioPgStore.js), D-24095). The client has no IndexedDB and no game save; localStorage holds prefs only | An on-device save (see [Saving the game](#saving-the-game)) |
| Card images | One WebP per card at `images.legendary-arena.com/{set}/{set}-{ribbon}-{slug}.webp` ([R2 Image Naming Convention](r2-image-naming-convention.md)). A match's image list is `UIState.matchCardImageUrls` (`buildMatchCardImageManifest` in [`uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts)). [`useCardImagePrefetch.ts`](../apps/arena-client/src/composables/useCardImagePrefetch.ts) warms them into the browser's HTTP cache, 6 at a time | Durable caching, plus a size estimate before download |
| Image sizes | **No size tiers exist.** There's no thumbnail or phone variant, no `srcset`, and no manifest with byte sizes. A sampled card is 489×687, 87 KB; 15 random Core images averaged 96 KB (70–128 KB) | A per-image byte list for the download-size label |
| Image headers | `public, max-age=31536000, immutable` ([RUNBOOK](../docs/ops/RUNBOOK-r2-image-cache-control.md)) and `Access-Control-Allow-Origin: *` (checked 2026-11-12) | Already enough for a service worker to cache non-opaque responses |
| PWA | None: no service worker, no web app manifest, no icons. The client is Vite 5, Vue 3 and Pinia on Cloudflare Pages; [`_headers`](../apps/arena-client/public/_headers) already marks `/assets/*` immutable | A manifest, icons, and a service worker that caches the app shell |

### What assumes a connection during play

Each of these would need an offline answer:

- **Socket.IO transport and its watchdogs** (move-ack, reconnect resync,
  tab-focus resync) in [`bgioClient.ts`](../apps/arena-client/src/client/bgioClient.ts),
  shown by `ConnectionStatusBanner.vue`. A local match has no socket, so these
  never arm.
- **Hanko session** hydrating on the `live` route. Offline, the player plays
  as whoever was signed in at download time, or as a guest.
- **The deploy check**: a `version.json` poll every 60 s
  ([`useDeployVersionCheck.ts`](../apps/arena-client/src/composables/useDeployVersionCheck.ts)).
  It needs to stay quiet offline and offer the update only once the player is
  back online and between matches.
- **In-match API calls**: build provenance, bot-ally status, autoplay
  controls, battle plan, and seat identities at gameover. Offline, these are
  hidden or answered locally.
- **Endgame**: score submission (`POST /api/competition/scores`,
  [`useCompetitiveSubmitOnGameover.ts`](../apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts))
  and the coach (entitlement plus the coach endpoints). The score goes into the
  sync queue. The coach waits for a connection.
- **First-party analytics** ([`analyticsEmitter.ts`](../apps/arena-client/src/lib/api/analyticsEmitter.ts))
  posts to `/api/analytics/events`. Events are queued, not dropped.
- **Assets fetched from R2:**
  - sound effects and music (Howler)
  - play-mat skins and ability-marker icons
  - featured-table art
  - the cross-origin `brand-tokens.css`, which already has a local fallback

  Skins and icons belong in the app-shell cache. Audio is an optional add-on to
  the download, and without it the game simply plays silent.

### How other products handle offline

| Product | What it does | Take or avoid |
|---|---|---|
| **YouTube Premium** | Per-video download with a default quality setting; higher quality "may consume more data… and take up more space." Downloads play offline up to 29 days, then the device must reconnect, and some regions allow only 48 hours. Interrupted downloads resume on reconnect | **Take:** quality setting, resumable downloads. **Note:** the 29-day reconnect is a license refresh, not a technical need |
| **Netflix** | Expiry varies by title license, and some titles expire 48 hours after first play. Renewal happens in My Downloads, while online, and may be capped. Ad plans get 15 downloads per device per month | **Avoid:** per-item rules a player can't predict. If we need expiry, use one rule for every setup |
| **Spotify** | Download toggle per playlist or album. The device must go online once every 30 days "to keep your downloads," which Spotify says is for compensating artists. 10,000 tracks on each of up to 5 devices | **Take:** a per-setup toggle and a quiet periodic check-in. It's the closest model to a royalty-bearing catalog like ours |
| **Google Maps offline areas** | Pick a region ahead of time, see its size, download it. Maps expire after one year and auto-update over Wi-Fi within 15 days of expiry | **Take:** "choose the area first" maps directly onto "choose the setup first"; auto-refresh over Wi-Fi; a long expiry |
| **Hearthstone** | Online-only, including its solo Adventures. Offline, the mobile app shows "You are currently offline" and allows only collection browsing. Players have asked for purchased Adventures to work offline | **Beat:** our rules are deterministic and the seed can be device-generated, so solo needs no server to stay honest |
| **Marvel Snap** | Online-only; profiles and matchmaking are server-held. When the app was pulled in the U.S. in January 2025, nobody could play for about two days | **Beat:** an outage, store pull, or bad hotel Wi-Fi shouldn't stop a solo game |
| **Star Realms** | Free tier is play vs. the AI; the full game adds campaign missions and AI difficulties. Reviews say pass-and-play needs a login. Whether vs-AI works fully offline is *unverified* | **Avoid:** a sign-in wall in front of local play |
| **Dominion (Temple Gates)** | Solo vs. four AI levels. Launch coverage called it mobile-first and not needing "a persistent internet connection"; current offline behavior *unverified* | **Take:** solo that just works on a phone |
| **Slay the Spire** | A single-player deck-builder that runs entirely on the device *(from general knowledge; no source read)* | The bar: players don't think about the connection at all |

**Copy:**

- Show the size before downloading.
- Offer a per-setup toggle and a "Ready offline" badge.
- Give one storage page with delete.
- Resume interrupted downloads.
- Refresh quietly over Wi-Fi.
- Make the expiry rule one plain line, if there's an expiry at all.

**Avoid:**

- Per-item expiry rules a player can't predict.
- Surprise deletion (Spotify's least-recently-used device eviction is the
  example).
- A login wall in front of solo play.
- Silently losing a finished game's result.

**Where we beat Hearthstone:**

- Solo works with no connection.
- A result earned offline still counts once it's verified on reconnect.
- Owned content keeps working through our outages.

### Proposed design

#### The download button and the badge

The setup screen gets a **Download for airplane mode** button. Before
downloading, it shows the size, for example *"Download 4.2 MB (52 cards) for
offline play"*.

- **Image list.** The engine already builds the image list for a match,
  `buildMatchCardImageManifest`. Run in the browser at download time, it gives
  the exact list for the setup, with no new data file.
- **Byte sizes.** The label needs each image's size, which doesn't exist yet.
  Two options:
  - **A size manifest:** one generated JSON of `imageUrl → bytes`, built with
    the card data. This is the "list of images" the image-sizes work was meant
    to produce, and the dependency the original prompt names.
  - **HEAD requests** at download time, as a fallback. That's about 50 small
    requests.
- **Rough figures** at today's single tier (sampled 70–128 KB per card):
  - A typical solo setup is roughly 40–60 unique images, about 4–6 MB
    *(estimate; the count depends on the heroes and villain groups)*.
  - All 3,104 unique card images across the 41 sets come to about 270 MB.

When every file is cached, the setup shows **Ready offline**.

#### Which image sizes

The setup offers two sizes:

- **Standard (default):** the 489×687 image every card has today, with no new
  pipeline.
- **Data saver:** a smaller phone tier, once the image-sizes work produces one.
  A setting picks the size.

Because the file names follow [R2 Image Naming Convention](r2-image-naming-convention.md),
a tier can be a parallel prefix or a suffix without touching card data.

#### Caching

| What | Where | Why |
|---|---|---|
| App shell (built JS/CSS, fonts, icons, skins, ability icons) | Service worker precache | Vite's hashed `/assets/*` are already immutable; a Workbox-style precache (for example `vite-plugin-pwa`) is the usual fit *(candidate; not tried)* |
| Card art for a downloaded setup | Cache Storage, keyed by `imageUrl` | `CardTile` keeps requesting the same URL and the service worker answers from cache, so no component changes. `ACAO: *` means the responses are non-opaque, so quota is counted at real size |
| Card data (all sets) and metadata | IndexedDB | About 2.2 MB of card JSON plus 1.6 MB of metadata as files on disk, and smaller compressed. Caching all of it is simpler than per-setup subsets and lets any downloaded setup build |
| Saved games, results queue, downloads index | IndexedDB | Structured, queryable, survives reloads |

**Desktop app later.** D-24838 already says store builds wrap the web client
(Capacitor, Electron or Tauri). The same caches work inside a wrapper's
webview. A wrapper could later swap Cache Storage for its own file storage
without changing the design.

#### The storage page

One page, under the player's profile, lists:

- each downloaded setup, with its name, card count, size, download date, and
  whether a saved game is in progress;
- a total, plus `navigator.storage.estimate()` for the space left;
- **Delete** per setup and **Delete all**.

Deleting a setup removes only the images no other downloaded setup uses (the
caches are reference-counted by URL). A setup with a game in progress asks
before deleting.

#### Caching cards viewed online

The service worker can also keep card art seen during normal online play, in a
separate cache with a size cap and least-recently-used eviction. That makes a
later download faster, since many images are already there. It's never what
**Ready offline** is based on: that badge needs the setup's own pinned set, so
eviction can't break a download.

#### Saving the game

Candidate: save the **match record**, not the state. The record is the setup
config, the seed, and the move log after every move, in IndexedDB. Resume
replays the log through the engine. This matches the server's replay model
(D-24119 rebuilds a match from `initialState` plus `log`) and the LAGN record
shape ([LAGN v1](lagn-v1.md)), so the same record can be verified later.

It also stays clear of the persistence boundary, which keeps application code
from persisting `G` ([ARCHITECTURE.md §Persistence Boundaries](../docs/ai/ARCHITECTURE.md)).
boardgame.io's own local storage options would save the framework's state
object. Whether D-24095's framework-store exemption covers that on a device is
for the decision in gate 1, not this page.

#### Syncing when back online

Finished offline games go into a results queue. On reconnect, each record goes
to a new server endpoint. The server replays it with the real engine (the
D-24119 replay pattern). If it replays legally to the claimed end, the game
counts for personal stats and history as **Offline (unranked)**. Queued
analytics events go out with it.

The endpoint is new, so its row in
[`api-endpoints.md`](../docs/ai/REFERENCE/api-endpoints.md) would land with
it.

#### Connection drops mid-game

- **Online match, connection drops:** no change. The server holds the match;
  the banner shows the drop; the client resyncs on reconnect. An online match
  can't move offline mid-game, because its seed is server-held and redacted
  from the client.
- **Offline match:** there's no connection to lose. The save after every move
  covers a closed tab, a dead battery, or the OS killing the app.
- **Back online mid-offline-match:** the match stays local until it ends. Only
  the finished record syncs.

#### Features that need a server

| Feature | In airplane mode |
|---|---|
| Online multiplayer, guest seats, lobby | Online only. Hidden offline, with one line saying why |
| Bot ally | Online only in version 1. The policies could run on the device later, but that needs its own decision against DESIGN-SOLO-BOT-ALLY |
| Ranked / competitive scores, seed challenges, leaderboard | Online only. Offline results are unranked |
| Coach, battle plan | Wait for a connection |
| Phone-to-phone offline play | Future. Leave room by keeping the match record transport-neutral (setup + seed + log), which a later peer transport could exchange. Not built |

### Candidate build steps

> **Non-authoritative sizing.** These slices show feasibility and order. They
> create no WPs or commitments. Each one can be tested on its own.

| # | Slice | How it's checked |
|---|---|---|
| 0 | **Spike:** one hard-coded Core setup, the engine on a `Local()` master in the browser, images fetched online | The match plays to an end in the browser with no socket. It replays identically from its saved setup, seed and log |
| 1 | **Smallest offline version:** a web app manifest, a service worker caching the app shell, plus the spike setup's images and card data | In Chrome DevTools, Network → **Offline**, then reload and play to the end. On a real phone: install to the home screen, turn on airplane mode, cold-start, and play |
| 2 | On-device save and resume | Kill the tab mid-turn, reopen offline, and the game resumes on the same turn with the same deck order |
| 3 | Any setup: the download button, the size label (manifest or HEAD), and the badge | The label's bytes match what Cache Storage ends up holding. Every image in the setup renders offline |
| 4 | The storage page and delete | Deleting one of two setups that share heroes keeps the shared images |
| 5 | The results queue, the replay-verify endpoint, and the "Offline (unranked)" history entry | A finished offline game appears in history after reconnect. A tampered log is rejected |
| 6 | Caching viewed cards online, image-size setting, optional audio | The size cap holds, and the setting changes what downloads |

DevTools checks that apply to every slice:

- **Application → Service workers:** registered and active.
- **Application → Cache storage:** the expected entries are there.
- **Application → Storage:** usage, and **Clear site data** for a clean rerun.
- **Network → Offline:** throttling set to offline.

The phone test matters because iOS behaves differently (see Edge Cases).

## Interactions

- **[webOS TV Port](webos-tv-port.md):** the TV study found no gain in an
  offline build *for live matches*. That still holds; airplane mode is about
  solo only. A hosted TV app would get airplane mode for free if the PWA pieces
  land.
- **[Windows Engine Exe](windows-engine-exe.md):** the other "engine runs
  locally" study, headless and for verification. Both rely on the engine's
  runtime-safe export being free of Node-only code.
- **[R2 Image Naming Convention](r2-image-naming-convention.md):** the URLs
  the cache is keyed by. Any size tier extends that convention.
- **[Guest Accounts](guest-accounts.md):** guest solo runs a fixed featured
  table on the server today. Airplane mode is the on-device sibling.
- **[Bot Ally](bot-ally.md):** server-side by design; out of version 1.
- **[LAGN v1](lagn-v1.md) / [Scoring](scoring.md):** the record shape a synced
  offline game would share, and the scoring a verified replay recomputes.
- **[Monetization Model](monetization-model.md) / [IP Licensing](ip-licensing.md):**
  who gets airplane mode, and whether rights allow caching art on devices.
- **Layer boundary:** arena-client may already import the engine's `.`
  surface (WP-090). The registry needs a browser entry point. The server gains
  one verify endpoint. The engine itself doesn't change.

## Edge Cases

- **The device knows its seed.** With a device-generated seed, a player can in
  principle read future shuffles or reload to retry a turn. That's harmless
  for solo practice. It's why offline results stay unranked, even though
  replay verification proves the moves were legal.
- **iOS storage eviction.** WebKit's 2020 policy deletes script-writable
  storage (IndexedDB and Cache Storage included) after 7 days without use in
  Safari. Web apps added to the Home Screen were treated differently
  *(unverified against current iOS; check on a device)*. Expect the design to
  ask iPhone players to install the app, and to call
  `navigator.storage.persist()`.
- **Quota.** Browsers cap storage per origin and can evict under pressure.
  `navigator.storage.estimate()` drives the space-left display, and a failed
  write has to surface as "not enough space," not a half-cached setup that
  still shows the badge.
- **Opaque responses.** Had the image host lacked CORS, Chrome would count
  each opaque cached response at a large padded size. `ACAO: *` avoids that
  today. A change to the R2 CORS policy would quietly inflate quota use.
- **Card data changes after download.** A rules or data fix shipped online
  changes what an old saved game would replay to. A record needs to carry the
  engine build and card-data version it was played on, and the verifier needs
  to either replay on that version or accept the mismatch.
- **App update mid-game.** A new service worker shouldn't take over during an
  offline match. Activate it between matches.
- **Signed out while offline.** If the entitlement check (for a Pass-gated
  version) can't run, a cached entitlement with a refresh window, Spotify
  style, decides it.

## Code Touchpoints

- [`apps/arena-client/src/client/bgioClient.ts`](../apps/arena-client/src/client/bgioClient.ts): the Socket.IO client a local transport would sit beside.
- [`packages/game-engine/src/ui/uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts): `buildMatchCardImageManifest`, the per-setup image list.
- [`apps/arena-client/src/composables/useCardImagePrefetch.ts`](../apps/arena-client/src/composables/useCardImagePrefetch.ts): today's HTTP-cache warmer.
- [`packages/registry/src/impl/httpRegistry.ts`](../packages/registry/src/impl/httpRegistry.ts): the browser-capable registry reader.
- [`apps/server/src/game/matchSeed.mjs`](../apps/server/src/game/matchSeed.mjs) / [`syncRedaction.mjs`](../apps/server/src/game/syncRedaction.mjs): server seed and its redaction.
- [`apps/server/src/match/guestSoloRoutes.mjs`](../apps/server/src/match/guestSoloRoutes.mjs): today's server-side guest solo.
- [`apps/arena-client/vite.config.ts`](../apps/arena-client/vite.config.ts): the build a PWA plugin would join.

## Open Questions

**Decisions (each changes the design):**

1. **On-device rules:** may a single-seat match run on a `Local()` master in
   the browser? How does saving a match record sit with the persistence
   boundary and D-24095?
2. **Access:** free, or a Legendary Pass perk?
3. **Rights and expiry:** do the digital rights allow caching art on devices?
   Do they require an expiry or periodic check-in, and if so, what window?
   (Spotify uses 30 days, YouTube 29, Google Maps a year.)
4. **Offline results:** unranked history only, or also seed-challenge PAR
   comparisons marked "offline"?

**Facts to settle by spike:**

- Does `LegendaryGame` run unchanged on a `Local()` master in the browser,
  including `Game.setup()` with a browser registry? How big is the bundle?
- How many unique images does a real setup have? This replaces the 40–60
  estimate.
- What do current iOS and Android browsers actually do about storage eviction
  for an installed PWA?
- Does the image-sizes work produce a phone tier and a byte-size manifest?
  This page assumes neither exists yet.

## References

Repo:

- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md): engine owns truth, persistence boundaries, layer boundary
- [DECISIONS.md](../docs/ai/DECISIONS.md):
  - D-0002, determinism
  - D-10008, `client: false` moves
  - D-24095, the `bgio` framework store
  - D-24119, server-side replay from `initialState` plus `log`
  - D-24838, store builds wrap the web client
- [DESIGN-SOLO-BOT-ALLY.md](../docs/ai/DESIGN-SOLO-BOT-ALLY.md): why the bot runs server-side
- [RUNBOOK-r2-image-cache-control.md](../docs/ops/RUNBOOK-r2-image-cache-control.md): image cache headers
- [13-REPLAYS-REFERENCE.md](../docs/13-REPLAYS-REFERENCE.md): local replay files, already usable offline
- Measured 2026-11-12:
  - 15 random Core images by `HEAD`
  - one image's headers (`ACAO: *`, immutable) and its dimensions (489×687)
  - unique image URLs counted across `data/cards/*.json` (3,104)

Other products, read 2026-11-12:

- [YouTube: Watch videos offline with YouTube Premium](https://support.google.com/youtube/answer/11977233) and [in select countries](https://support.google.com/youtube/answer/6141269)
- [Netflix: How to download titles to watch offline](https://help.netflix.com/en/node/54816); [How-To Geek on Netflix download limits](https://www.howtogeek.com/286287/is-there-a-limit-to-how-much-you-can-download-from-netflix-for-offline-viewing/)
- [Spotify: Listen offline](https://support.spotify.com/us/article/listen-offline/)
- [Google Maps: Download areas & navigate offline](https://support.google.com/maps/answer/6291838)
- [Blizzard: Hearthstone connection issues on mobile](https://support.blizzard.com/en/article/18238); [GosuGamers: offline adventures request](https://www.gosugamers.net/hearthstone/news/50201-team-5-why-not-give-us-the-option-to-download-purchased-adventures-to-play-offline)
- [GosuGamers: Marvel Snap goes offline in the U.S.](https://www.gosugamers.net/entertainment/news/74178-marvel-snap-goes-offline-in-the-u-s-following-brief-tiktok-ban); [Noff: can Marvel Snap be played offline](https://www.noff.gg/marvel-snap/faqs/can-marvel-snap-be-played-offline) (third-party)
- [Star Realms on the App Store](https://apps.apple.com/us/app/star-realms/id1066107760)
- [Dominion on the App Store](https://apps.apple.com/us/app/dominion/id1476461085); [GamesBeat: Temple Gates launches Dominion](https://gamesbeat.com/temple-gates-games-launches-dominion-digital-board-game-on-mobile-and-pc/)

Provenance: drafted from a Claude chat prompt that asked for an audit, a
product comparison, a design, and a build plan. The code audit was checked
against the files above before this page cited them.
