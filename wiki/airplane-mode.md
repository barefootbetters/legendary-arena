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
  - card-image-acquisition.md
  - guest-accounts.md
  - bot-ally.md
  - monetization-model.md
  - ip-licensing.md
  - lagn-v1.md
  - scoring.md
  - seed-challenges.md
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
  - ../docs/ai/NUMBER-LEDGER.md
  - ../.claude/rules/architecture.md
last-reviewed: 2026-11-12
---

# Airplane Mode

> **Status: design research. Nothing built, nothing decided.** No WP, EC, or
> DECISIONS entry covers airplane mode. Everything this page recommends is a
> *candidate* for a future WP or decision, not a commitment. Code facts come
> from `main` at `38238583` (2026-11-12). Facts about other products come from
> their help pages and reviews, read 2026-11-12 and linked under References;
> anything marked *unverified* wasn't confirmed from a primary source.

## Summary

Airplane mode would let a player download one solo match setup (its
mastermind, scheme, villains, henchmen, heroes and the shared cards) and then
play it start to finish with no connection. Today that isn't possible: every
match runs on the server and the browser only renders.

The work is mostly in
the arena-client: run the existing engine in the browser for a single-seat
match, cache the app and the setup's card art, and save the game on the
device. The engine's determinism (D-0002) is what makes offline play
trustworthy: a game saved as setup plus seed plus move log can be replayed and
checked by the server when the player is back online.

## Mechanics

### Recommendation

- **Candidate scope for a first version:** single-seat solo, no bot ally, in
  the browser as an installable web app (a PWA). The player picks a
  setup, taps **Download for airplane mode**, sees the size first, and gets a
  **Ready offline** badge when it's done.
- **Candidate architecture:**
  - A boardgame.io client with the in-browser `Local()` master, running the
    same `LegendaryGame` the server runs.
  - The setup's card data and image list supplied by the server at download
    time, because arena-client may not import the registry at runtime.
  - Card art cached **per setup** at the `phone` tier (WP-888, published), in Cache
    Storage, through a service worker
    ([Card Image Acquisition › Size tiers](card-image-acquisition.md#size-tiers-for-mobile-and-offline)).
  - Saved games and the offline results queue kept in IndexedDB.
- **Decisions needed before a WP, cheapest first:**
  1. **Running the rules on the device.** The engine already ships in the
     client bundle, but today it only renders: moves are `client: false`
     (D-10008), the seed is server-held, and a client-side bot was rejected
     for online play. Offline solo needs a decision that the device may host a
     single-seat match, plus a ruling on how that sits with the persistence
     boundary (see [Saving the game](#saving-the-game)). `Game.setup()` also
     needs a card registry reader, and the import rules bar arena-client from
     importing `registry` at runtime
     ([architecture rules](../.claude/rules/architecture.md)). The candidate
     answer is a server-built setup bundle (see
     [Card data for the setup](#card-data-for-the-setup)), not a registry
     exception.
  2. **Who gets it.** Airplane mode is a convenience feature, so it fits as a
     Legendary Pass perk ([Monetization Model](monetization-model.md)) as well
     as a free one. That's a business call. Either way it never changes a game
     outcome, so it stays clear of NG-1.
  3. **Rights.** The live game already sends every card image to players'
     browsers with `Cache-Control: public, max-age=31536000, immutable`
     ([RUNBOOK](../docs/ops/RUNBOOK-r2-image-cache-control.md)), so the art
     already sits on their devices for up to a year. The digital character
     rights gap that [IP Licensing](ip-licensing.md) records applies to the
     whole game today, not to airplane mode alone. What airplane mode adds is
     an explicit "download" and durable storage that the browser is less likely
     to evict, which makes that same exposure more visible. A future license
     might require an expiry or periodic check-in; that would set the refresh
     rule below.

### What the code does today

| Area | Today | What airplane mode needs |
|---|---|---|
| Where rules run | Server only. [`server.mjs`](../apps/server/src/server.mjs) loads the registry from disk and serves `LegendaryGame` from boardgame.io `Server()`. The client builds `Client({ game: LegendaryGame, multiplayer: SocketIO(...) })` in [`bgioClient.ts`](../apps/arena-client/src/client/bgioClient.ts). There's no `Local()` transport, practice or hotseat mode | A local master in the browser for single-seat matches |
| Moves | Every move is long-form `client: false` (D-10008, [`game.ts`](../packages/game-engine/src/game.ts)). The client sees only the `playerView` UIState, never raw `G` | Unchanged: with a local master, the master runs the moves and the client still sees only `playerView` *(inferred from boardgame.io's design; not yet tested)* |
| Engine in the browser | The runtime-safe `.` export has no `node:*` imports. The Node-only pieces sit behind `./setup` ([`package.json`](../packages/game-engine/package.json)). [`vite.config.ts`](../apps/arena-client/vite.config.ts) fails the build on any `node:*` leak. Today the client imports only small helpers at runtime | `Game.setup()` in the browser, fed by a registry reader |
| Card data for setup | Setup needs a `CardRegistryReader` to build `cardDisplayData`; without one it falls back to an empty registry and builds an empty match. A browser-capable reader exists ([`httpRegistry.ts`](../packages/registry/src/impl/httpRegistry.ts)), but arena-client may not import `registry` at runtime, and the barrel also re-exports the `node:fs` loader | A server-built setup bundle the client reads through a small reader of its own (see [Card data for the setup](#card-data-for-the-setup)) |
| Seed | Server-generated ([`matchSeed.mjs`](../apps/server/src/game/matchSeed.mjs), WP-809) and kept from clients by [`syncRedaction.mjs`](../apps/server/src/game/syncRedaction.mjs) | Generated on the device. The device then knows its seed (see [Edge Cases](#edge-cases)) |
| Bot ally | Server-side ([`botAllyDriver.mjs`](../apps/server/src/bot-ally/botAllyDriver.mjs)). [DESIGN-SOLO-BOT-ALLY](../docs/ai/DESIGN-SOLO-BOT-ALLY.md) rejects a client-side bot for online play. The policies are in the runtime-safe engine export | Left out of version 1 |
| Saved state | Postgres `bgio` schema ([`bgioPgStore.js`](../apps/server/src/db/bgioPgStore.js), D-24095). The client has no IndexedDB and no game save; localStorage holds prefs only | An on-device save (see [Saving the game](#saving-the-game)) |
| Card images | One WebP per card at `images.legendary-arena.com/{set}/{set}-{ribbon}-{slug}.webp` ([R2 Image Naming Convention](r2-image-naming-convention.md)). A match's image list is `UIState.matchCardImageUrls` (`buildMatchCardImageManifest` in [`uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts)). [`useCardImagePrefetch.ts`](../apps/arena-client/src/composables/useCardImagePrefetch.ts) warms them into the browser's HTTP cache, 6 at a time | Durable caching, plus a size estimate before download |
| Image sizes | **Built and published** (WP-888 / [D-24840](../docs/ai/DECISIONS.md), 2026-11-12). Every card has `thumb` (280 px), `phone` (840 px) and `large` (1680 px) WebP tiers at `{set}/{tier}/{file}.webp`, plus a per-set byte manifest at `metadata/image-sizes/{set}.json` ([Card Image Acquisition](card-image-acquisition.md#size-tiers-for-mobile-and-offline)). No screen uses them yet: every screen still gets the original (most sets about 100 KB per card, six high-resolution sets about 1 MB, `co2e` 2.7 MB) | Nothing more from the image side: the `phone` tier is the download, and its manifests give the size label |
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
- If there's an expiry at all, make it one plain line that applies to every
  setup.

**Avoid:**

- Per-item expiry rules a player can't predict.
- Surprise deletion (Spotify's least-recently-used device eviction is the
  example).
- A login wall in front of solo play.
- Silently losing a finished game's result.

**Where we can beat Hearthstone:**

- Solo works with no connection.
- A result earned offline still counts once it's verified on reconnect.
- Owned content keeps working through our outages.

### Proposed design

#### The download button and the badge

The setup screen gets a **Download for airplane mode** button. Before
downloading, it shows the size, for example *"Download 4.2 MB (52 cards) for
offline play"*.

- **Image list.** The engine builds a match's image list,
  `buildMatchCardImageManifest` (`UIState.matchCardImageUrls`), but only once
  a match exists. On the setup screen there's no match yet, so the server
  supplies the list as part of the setup bundle (see
  [Card data for the setup](#card-data-for-the-setup)).
- **Byte sizes.** The size step (WP-888) publishes a per-set manifest of
  each card's bytes per tier, at `metadata/image-sizes/{setAbbr}.json` on R2
  ([Card Image Acquisition › Size tiers](card-image-acquisition.md#size-tiers-for-mobile-and-offline)).
  The label is the sum of the setup's cards at the chosen tier, read from the
  manifests of the sets the setup uses.
- **Rough figures** at the `phone` tier, from the published manifests (about
  94 KB per card for `core`, 131 KB for `co2e`):
  - A typical solo setup is roughly 40–60 unique images, about 4–8 MB
    *(estimate; the count depends on the heroes and villain groups)*.
  - The whole library is 296 MB at `phone`, against 1,133 MB for the
    originals the card data references. That's every card in every set, not
    what any one player downloads.
  - Without tiers, a `co2e` setup would run to hundreds of megabytes; at
    `phone` all 151 `co2e` cards are 19 MB.

When every file is cached, the setup shows **Ready offline**.

#### Which image sizes

The tiers and their URLs are owned by
[Card Image Acquisition › Size tiers](card-image-acquisition.md#size-tiers-for-mobile-and-offline).
In short:

- **`phone` (840 px long edge) is the airplane-mode download.** It's large
  enough for tap-to-zoom on a phone.
- **`thumb` (280 px)** is the board, hand, City and HQ size. It's about 15 KB
  per card, so a data-saver setting could download `thumb` only, at the cost
  of a blurrier zoom.
- **`large` (1680 px)** is for desktop and 4K zoom. A desktop player could
  choose it, at a much bigger download for the high-resolution sets.

A tier URL is the card's existing `imageUrl` with `/{tier}` inserted before
the file name, so no card data changes.

**The tiers are ready.** WP-888 published all three tiers and the manifests
for all 41 sets on 2026-11-12, so no originals-only first version is needed.
For the 78% of cards with a long edge under 840 px, `phone` is a re-encode
of the original at its own size.

#### Caching

| What | Where | Why |
|---|---|---|
| App shell (built JS/CSS, fonts, icons, skins, ability icons) | Service worker precache | Vite's hashed `/assets/*` are already immutable; a Workbox-style precache (for example `vite-plugin-pwa`) is the usual fit *(candidate; not tried)* |
| Card art for a downloaded setup | Cache Storage, keyed by the tier URL | Offline, the service worker answers a request for any size of a card from the copy it holds, so a component asking for the original or another tier still gets an image. `ACAO: *` means the responses are non-opaque, so quota is counted at real size |
| The setup bundle (card data and image list) | IndexedDB | Small, and it's what `Game.setup()` reads offline |
| Saved games, results queue, downloads index | IndexedDB | Structured, queryable, survives reloads |

**Desktop app later.** D-24838 already says store builds wrap the web client
(Capacitor, Electron or Tauri). The same caches work inside a wrapper's
webview. A wrapper could later swap Cache Storage for its own file storage
without changing the design.

#### Card data for the setup

`Game.setup()` reads cards through a `CardRegistryReader`. arena-client may
not import `registry` at runtime, so the candidate is a **setup bundle**
built by the server, which already loads the registry:

- At download time, the client sends the setup config. The server returns the
  card records that setup draws on, plus the image list.
- The client saves the bundle in IndexedDB. A small reader of its own serves
  the bundle through the reader interface the engine expects. The engine's
  types for that interface can come in through the engine's `.` surface or as
  type-only imports.
- The bundle carries the card-data version, so a saved game can say which
  data it was played on (see [Edge Cases](#edge-cases)).
- **The bundle has to be complete for setup, not just for the cards on
  screen.** Sixteen engine setup builders call `listCards()`, `listSets()` or
  `getSet()` (for example `buildInitialGameState.ts`, `buildHeroDeck.ts`,
  `villainDeck.setup.ts`, `mastermind.setup.ts`, `buildCardDisplayData.ts`).
  A reader that answers with only the setup's own cards would build a match
  that's silently missing cards, the same failure as the empty-registry
  fallback. So the server builds the bundle by running setup against the real
  registry and recording every record the builders read. The client reader
  replays exactly that set.

The endpoint is new, so it gets an
[`api-endpoints.md`](../docs/ai/REFERENCE/api-endpoints.md) row when built.
Whether the reader interface takes plain data without the registry package
is a spike question.

#### The storage page

One page, under the player's profile, lists:

- each downloaded setup, with its name, card count, size, download date, and
  whether a saved game is in progress;
- a total, plus `navigator.storage.estimate()` for the space left;
- **Delete** per setup and **Delete all**.

Deleting a setup removes only the images no other downloaded setup uses.
Cache Storage keeps no reference counts, so the downloads index in IndexedDB
maps each image URL to the setups that use it. The client deletes the cache
entry when a URL's last setup goes. A crash between the two writes leaves an
orphan or a dangling entry, which the storage page reconciles when it next
loads. A setup with a game in progress asks before deleting.

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
D-24119 replay pattern). If it replays legally to the claimed end, the result
is recorded like any other finished game. How verified offline results count
toward leaderboards and seed challenges is open question 4. Queued analytics
events go out with it.

The seed in an offline record is the device's own random seed. The server
mints online seeds from random bytes ([`matchSeed.mjs`](../apps/server/src/game/matchSeed.mjs)),
not from the setup, so there's nothing to re-derive and any seed is valid for
an ordinary game. The one case with an expected seed is a seed challenge,
where the record's setup and seed must match the published challenge.

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
| Score submission, seed challenges, leaderboard | Submitted from the results queue once the replay verifies; how they count is open question 4 |
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
| 3 | Any setup: the setup-bundle endpoint, the download button, the size label from the WP-888 manifests, and the badge | The label's bytes match what Cache Storage ends up holding. Every image in the setup renders offline |
| 4 | The storage page and delete | Deleting one of two setups that share heroes keeps the shared images |
| 5 | The results queue, the replay-verify endpoint, and recording verified results | A finished offline game appears in history after reconnect. A tampered log is rejected |
| 6 | Caching viewed cards online, a tier setting (`thumb` / `phone` / `large`), optional audio | The size cap holds, and the setting changes what downloads |

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
- **[Card Image Acquisition](card-image-acquisition.md):** owns the size
  tiers (WP-888 / D-24840, published 2026-11-12), their URLs, and the
  per-set byte manifests. Airplane mode downloads the `phone` tier and
  sizes the download from those manifests. Slice 3 no longer waits on them.
- **[R2 Image Naming Convention](r2-image-naming-convention.md):** the URLs
  the cache is keyed by. The tier URLs add a `/{tier}` folder to them.
- **[Guest Accounts](guest-accounts.md):** guest solo runs a fixed featured
  table on the server today. Airplane mode is the on-device sibling.
- **[Bot Ally](bot-ally.md):** server-side by design; out of version 1.
- **[LAGN v1](lagn-v1.md) / [Scoring](scoring.md):** the record shape a synced
  offline game would share, and the scoring a verified replay recomputes.
- **[Monetization Model](monetization-model.md) / [IP Licensing](ip-licensing.md):**
  who gets airplane mode, and whether rights allow caching art on devices.
- **Layer boundary:** arena-client may already import the engine's `.`
  surface (WP-090), but not `registry` at runtime, so card data arrives as a
  server-built setup bundle. The server gains two endpoints: the setup bundle
  and replay verification. The engine itself doesn't change.

## Edge Cases

- **The device knows its seed.** A device-generated seed means the device
  could in principle read future shuffles. Seed challenges publish their seed
  by design ([Seed Challenges](seed-challenges.md)), so a known seed doesn't by
  itself make a result unfair. Replay verification proves every move was
  legal. Saving after every move means a reload returns the same game rather
  than a retry.
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
2. **Access:** free, or a Legendary Pass perk? If it's Pass-gated, what does
   a player see when the cached entitlement lapses while they're still
   offline: does the downloaded setup stay playable?
3. **Rights and expiry:** is the extra visibility of an explicit download an
   acceptable risk while the digital rights gap stands, given the art is
   already browser-cached for a year? Would a license require an expiry or
   periodic check-in, and if so, what window?
   (Spotify uses 30 days, YouTube 29, Google Maps a year.)
4. **Offline results:** do verified offline games count toward leaderboards
   and seed challenges the same as online games, or differently?

**Facts to settle by spike:**

- Does `LegendaryGame` run unchanged on a `Local()` master in the browser,
  including `Game.setup()` reading a server-built setup bundle through a
  plain-data reader? How much does the client bundle grow?
- How many unique images does a real setup have? This replaces the 40–60
  estimate.
- What do current iOS and Android browsers actually do about storage eviction
  for an installed PWA?

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
- [Card Image Acquisition › Size tiers](card-image-acquisition.md#size-tiers-for-mobile-and-offline): the published tiers, tier URLs, per-set byte manifests, and the library and per-set sizes this page quotes (WP-888 / D-24840)

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
