---
title: webOS TV Port
type: Guide
tags:
  - platform
  - arena-client
  - smart-tv
  - input
  - distribution
related:
  - responsive-viewport-targets.md
  - play-board.md
  - profile-login.md
  - guest-accounts.md
  - monetization-model.md
  - ip-licensing.md
  - windows-engine-exe.md
status: draft
source:
  - C:\dev\legendary-arena\wiki\webos-tv-port.md (this page — https://ewiki.legendary-arena.com/webos-tv-port/)
  - ../apps/arena-client/vite.config.ts
  - ../apps/arena-client/src/auth/hankoClient.ts
  - ../apps/arena-client/src/client/bgioClient.ts
  - ../apps/arena-client/src/lib/api/apiBaseUrl.ts
  - ../apps/arena-client/src/composables/useScaleToFit.ts
  - ../apps/arena-client/src/composables/useViewport.ts
  - ../apps/arena-client/src/composables/useSlashGesture.ts
  - ../apps/arena-client/public/_headers
  - ../apps/server/src/server.mjs
last-reviewed: 2026-10-31
---

# webOS TV Port

> **Status: research, nothing built.** This page records what it would take to
> ship `play.legendary-arena.com` as an LG webOS TV app. No WP, EC, or decision
> covers it yet. Claims about LG's platform come from
> `webostv.developer.lge.com` as read on 2026-10-31 (linked under References).
> Claims about our client come from the code at `main` `f4f73de1`. Anything
> marked *unverified* has not been tested on a TV.

## Summary

An LG webOS TV app is an HTML5 app running in the TV's built-in Chromium. So
the arena-client (Vue 3 + Vite, boardgame.io over Socket.IO) can run there
almost as it is. The real work is **not** the runtime. It is **input** (LG
requires every app to work with the 5-way D-pad, and our board is built for a
mouse), **10-foot readability**, **sign-in on a TV**, and **LG store policy**
(LG requires its In-App Purchase path for paid content in game apps). The
recommended shape is a **hosted web app** that points at the live client and
targets **webOS TV 24 and later**.

## Mechanics

### What LG's platform is

| Item | Fact (LG docs) |
|---|---|
| App model | `type: "web"` apps, built and packaged with the webOS CLI (`ares-generate`, `ares-package`, `ares-install`, `ares-launch`, `ares-inspect`) into an `.ipk` |
| Two app types | **Basic (packaged):** every file ships in the `.ipk`, so any change needs a new package and a new review. **Hosted:** a small local app redirects to a remote URL, so content can change without pushing a package |
| Cookies | **Only hosted apps (http/https) get cookies.** Packaged apps run from `file://` and have no cookie support |
| Resolution | `appinfo.json` `resolution` is `1920x1080` (default) or `1280x720`. **UHD is not supported for web apps** |
| Remote | Magic Remote has a **pointer mode** (standard mouse events, `:hover` works, the wheel scrolls) and a **5-way mode** (arrows + OK, cursor hidden). Pressing an arrow key switches to 5-way; shaking the remote switches back. `cursorStateChange` reports which mode is active |
| 5-way rule | "Apps must support 5-way mode." LG tells developers to avoid features that don't work with 5-way input |
| Key codes | Arrows 37–40, OK 13, **Back 461**, color keys 403–406, media keys 415/19/417/412/413 |
| Back key | By default the platform drives Back through `history`. Setting `disableBackHistoryAPI: true` in `appinfo.json` hands Back (461) to the app. **The App Self Checklist, which QA tests against, is mandatory here: Back on the entry page "must display the Home screen (webOS23 - webOS25 only)."** The Back Button guide says something different: at the first screen 6.0+ shows an exit prompt and 5.0 and earlier go to Home, and `webOS.platformBack()` (webOSTV.js) triggers that platform behavior. Build to the checklist, and confirm what `platformBack()` does on 23–25 in the device spike |
| 5-way checklist | Mandatory self-checklist items: "Selectable UIs must be controlled by 4-way navigation keys (Up, Down, Left, Right), OK, and Back buttons," and "All of the objects in your app MUST ALWAYS provide some sort of selection effect with NO EXCEPTION." Recommended button images are 75×75 px at 1920×1080. Wheel scrolling should move lists the same way a mouse wheel does |
| Gamepads | `appinfo.json` `cloudgame_active: true` makes the app handle gamepad input directly, not as platform-mapped keys. LG lists it for webOS TV 23 and 24 on current firmware. The community webOSbrew wiki (not LG-official) adds that on webOS 25+ it also turns off the right-click BACK/HOME menu. Optional for us: the remote is the required input |
| Content rule | The self-checklist says an app must not include gambling games, buying or cashing out game money, moving game money between users, or "acquiring of compensation". A missing or thin checklist can be rejected before QA. Our client has no game money. Paid-entry or prize events should stay off the TV build |
| Launch art | `splashBackground` is a 1920×1080 PNG shown while the app loads. `icon` is 80×80 and `largeIcon` 130×130 (for testing). The store icon is a separate 400×400 upload |
| Overlays | While the launcher or settings overlay is open, the app gets no pointer events. Use `window` `blur`/`focus` to detect it |
| Store | LG Seller Lounge. QA runs a **pretest**, a **function test**, and a **content test**. A submission needs the `.ipk`, images, a **UX scenario** document, and a **self-checklist** filled in with real test results ("mandatory"). Every post-approval change goes through approval again. Sellers register as **Individual** or **Corporate**. LG Apps reaches 36 countries |
| Paid content | "To provide paid products or content in your VOD or game app, In-App Purchase is required." LG's own billing service is retired, and LG recommends Paymentwall. Another third-party biller may need a separate contract with LG |
| Dev loop | The Developer Mode app (signed in with an LG developer account) opens a time-limited session. The CLI connects over SSH as `prisoner` on port 9922 after a key-server passphrase. A PC **Simulator** matches the TV's Chromium version but differs in audio/video and lacks some platform APIs. The emulator is deprecated. The CLI is the npm package `@webos-tools/cli`. LG's install page still recommends Node 14.15–16.20, but the current package (3.2.6) declares `node >=20`, so the repo's Node 22 should run it. **webOS Studio** is LG's separate IDE tool; the older VS Code extension is listed as deprecated |

### Engine versions vs what our client ships

| webOS TV | Year | Chromium |
|---|---|---|
| 26 | 2026 | 132 |
| 25 | 2025 | 120 |
| 24 | 2024 | 108 |
| 23 | 2023 | 94 |
| 22 | 2022 | 87 |
| 6.x | 2021 | 79 |

What sets our floor:

- **JS:** `vite.config.ts` sets `build.target: 'es2022'` with no legacy plugin
  or browserslist, so ES2022 syntax ships as is. That needs about Chromium 94
  (webOS 23). This is my reading of the ES2022 feature table, not tested on a
  TV.
- **CSS `:has()`** (Chromium 105+) appears in 8 play-surface files. It drives
  the table-tilt stand-up and the hand-fan neighbor shift
  ([Play Board](play-board.md)). This makes **webOS 24 the real floor.** On 23
  and earlier the selectors are dropped, so the board renders but the hover
  lift is lost.
- **`color-mix()`** (Chromium 111+) appears 16 times, only in the endgame coach
  and summary panels. On webOS 24 those declarations fall back to defaults. On
  25+ they render fully.
- No WebGL, service worker, IndexedDB, container queries, `dvh`, or
  `backdrop-filter`. VFX are a 2D canvas (`canvas-confetti`, blade trail) plus
  CSS 3D transforms. Card art is `.webp`, audio is `.mp3` through Howler.

So **webOS 24+ (2024 models on) runs the current bundle with no syntax work,
and is the recommended minimum.** Going lower costs this much: webOS 23 means
rewriting the `:has()` rules (the stand-up and hand fan as class toggles), and
webOS 22 also means retargeting to `es2020`.

### Hosted vs packaged: hosted wins

| | Hosted app → `https://play.legendary-arena.com` | Packaged `.ipk` |
|---|---|---|
| Hanko sign-in | Works as today: the `hanko` cookie is set on `.legendary-arena.com` ([`hankoClient.ts`](../apps/arena-client/src/auth/hankoClient.ts)) | **Breaks.** No cookies on `file://`. Hanko SDK 2.6 can keep the token in `sessionStorage` (`sessionTokenLocation`), but that ends when the app closes, so players would sign in on every launch |
| CORS | No change: the page origin is `play.legendary-arena.com`, which is already on the allowlist in [`server.mjs`](../apps/server/src/server.mjs) | The origin is `file://`/`null`, which the allowlist does not include |
| API/socket URLs | Already absolute (`VITE_API_BASE_URL`, `VITE_SERVER_URL` in [`apiBaseUrl.ts`](../apps/arena-client/src/lib/api/apiBaseUrl.ts)) | Same, but needs its own build |
| Deploys | Every Pages deploy reaches the TV. The `version.json` update banner keeps working | Every client change means a new `.ipk` and another LG review |
| Offline | Needs the network, which the game needs anyway | No real gain: live matches need the server |

`X-Frame-Options: DENY` in [`_headers`](../apps/arena-client/public/_headers)
does not matter here: the hosted shell redirects at the top level, with no
frame. One open point: LG says any change after approval needs approval again.
Whether a large content change behind a hosted URL counts is a Seller Lounge
question (see Open Questions).

### Input: the main work

The Magic Remote's pointer mode gives us a mouse, so the current board works in
pointer mode with no changes. That covers CSS `:hover` (26 files, about 76
rules) and native `title` tooltips (about 55). But LG requires 5-way support,
and the client has almost none:

- About 199 `@click` handlers, almost all on real `<button>` elements, so they
  can take focus. Only 3 are `<div @click>`.
- `tabindex` appears in 3 files. Arrow keys are handled only in
  `AutoplayControls` and `ReplayInspector`. There is no roving focus, no
  spatial navigation across the board, and no Gamepad API.
- Focus styling (`:focus-visible`) exists in about 8 files, against hover in 26.
- **Hover-only information** (card stand-up, the hand fan, Officer/Sidekick
  hover text, `title` tooltips) has no 5-way equivalent.
- The **slash gesture** ([`useSlashGesture.ts`](../apps/arena-client/src/composables/useSlashGesture.ts)),
  a pointer stroke that fights villains, only works with a pointer. On TV it
  should be off, with Fight left as a button.

What 5-way needs: a spatial-focus layer over the board's zones (hand, HQ, City,
Mastermind, shared decks, the action bar) and over the lobby and modals. It
also needs a visible focus ring, focus restored when a modal closes, and
`focus` doing what `hover` does (stand-up and info reveal). The checklist
requires a selection effect on every object, so a missing focus ring fails QA,
not just usability. Starting points (npm, checked 2026-10-31; none tried yet):

| Option | What it is | Fit for a Vue client |
|---|---|---|
| In-house zone graph | Each board zone (hand, HQ, City, Mastermind, decks, action bar) is a list. Left/right moves within a zone, up/down moves between zones in a fixed order | Probably the best fit. The board's layout is fixed at 1280×720, so the graph is small, explicit, and testable. Overlays push a zone stack |
| `js-spatial-navigation` 1.0.1 | Vanilla JS spatial navigation by Luke Chang. Enact Spotlight is a fork of it | Framework-agnostic. Geometry-based, so a 3D-tilted board can pick surprising neighbors |
| `spatial-navigation-polyfill` 1.3.1 | The WICG polyfill for the proposed CSS spatial-navigation standard | Framework-agnostic and closest to a standard. Geometry-based too |
| `@enact/spotlight` 5.6.0 | LG's own focus library | Built around Enact/React. A poor fit for Vue |
| `@noriginmedia/norigin-spatial-navigation` 3.4.0 | "React hooks based" | React-only |

**Back key:** routing is query-parameter based with full reloads
(`?route=…`, `window.location.assign`). The cleanest model is
`disableBackHistoryAPI: true`: Back closes the top overlay or modal, then
leaves the current route. At the lobby root (the entry page) it must show
the Home screen on webOS 23–25, per the checklist. Whether
`webOS.platformBack()` does that there or shows the exit prompt is a device
check.

### 10-foot readability

The desktop board is authored at 1280×720 and fit by `transform: scale()`,
clamped to 0.5–1.5 ([`useScaleToFit.ts`](../apps/arena-client/src/composables/useScaleToFit.ts)).
The TV viewport is a fixed 1920×1080, above the 767 px breakpoint, so
`<PlayDesktop>` renders. The smallest play-surface text is `0.55rem`–`0.62rem`
(about 9–10 px before scaling). That reads fine at a desk and is unreadable
from a couch. A TV mode needs a larger minimum type size and bigger focus
targets. It may also need the card reader (zoomed card) as the default way to
read card text, not hover. The [Responsive Viewport Targets](responsive-viewport-targets.md)
page owns the current targets; TV would be a new one.

### Browser APIs that don't fit a TV

| Used today | Where | On TV |
|---|---|---|
| `navigator.clipboard` (copy log, copy guest-seat link) | `GameLogPanel`, `GameLogCopyButton`, `WaitingForPlayersPanel`, `DiagnosticExportButton` | No useful clipboard. Show a **QR code** for invite links instead *(unverified whether the API throws or no-ops)* |
| Blob download (game-log Save, diagnostic export) | `GameLogPanel`, `DiagnosticExportButton` | No file system for the user. Hide it |
| `window.open` (guest links, loadout viewer, Open Collective) | `WaitingForPlayersPanel`, `LobbyView`, `ViewLoadoutButton`, `BillingSection` | No tabs. Navigate in place or show a QR code *(unverified)* |
| `navigator.vibrate` | `useSlashGesture` | Irrelevant: the slash gesture is off on TV |
| `visibilitychange` socket resync | [`bgioClient.ts`](../apps/arena-client/src/client/bgioClient.ts) | Useful as is for TV suspend and resume. Music should also pause when hidden *(not checked)* |
| `localStorage` prefs (theme, audio, skin, effect intensity) | 14 files | Fine in a hosted app (http/https origin) |

### Sign-in on a TV

Hanko's login is passkey-first, with email passcode and Google/Discord OIDC
([Profile Login](profile-login.md)). On a TV:

- **Passkeys** need a platform authenticator or the cross-device QR/Bluetooth
  flow. Whether the webOS engine exposes WebAuthn usefully is *unverified*, and
  I'd expect it doesn't.
- **Google OIDC** inside an embedded web engine may hit Google's block on
  embedded user agents (*unverified on webOS*).
- **Email passcode** works with the system on-screen keyboard, but it is slow.
- **Guests** ([Guest Accounts](guest-accounts.md)) already play with no
  sign-in, which covers first launch.

The pattern TV apps use is **device-code pairing**: the TV shows a short code
and a QR code, the player signs in on a phone at a `legendary-arena.com/tv`
page, and the TV picks up the session. That means new server endpoints, so it
would be its own WP with an API-catalog update.

### Store and money

- LG requires its IAP path for paid content in game apps, and LG's billing is
  retired in favor of Paymentwall. The client has **no checkout today**. The
  Legendary Pass gate (`/api/me/entitlements`) sends players to `?route=me`,
  and `BillingSection` links to Open Collective
  ([Monetization Model](monetization-model.md)).
- The low-friction TV posture: entitlements bought on the web carry over to the
  TV through the account, and the TV build hides purchase and donation calls to
  action. Whether LG accepts a "bought elsewhere" entitlement with no
  purchase path on the TV is a Seller Lounge question. Paymentwall is the
  fallback if TV revenue justifies it.
- **Seller account:** a Corporate seller under BarefootBetters. The
  `appinfo.json` `id` is reverse-DNS, lowercase, and **can't be changed after
  publishing**, so choose it once (for example `com.legendaryarena.arena`).
  Store art is a 400×400 icon, separate from the 80×80/130×130 package icons.
- **IP exposure:** a store listing is a public, rights-holder-visible
  distribution of Marvel art under our seller name.
  [IP Licensing](ip-licensing.md) records that the digital Marvel grant is
  not in hand. A TV listing raises that exposure, and LG's content test may ask
  about rights *(unverified)*.

### Second-source check

A separate research pass (Grok, 2026-10-31) reached the same overall shape:
web app, 1920×1080, Magic Remote **and** D-pad both required, visible focus
states, Developer Mode sideloading, and Seller Lounge QA with a self-checklist
and UX scenario. Where it differs:

- **"Keep assets local, package everything."** That is generic advice for
  offline games. LA can't play without the game server, and a packaged app
  loses cookies (and so the Hanko session). Hosted stays the recommendation.
  Card art and audio already come from `images.legendary-arena.com`.
- **"Prefer Canvas or WebGL."** Doesn't apply. The client is a Vue DOM app
  with a 2D-canvas VFX overlay. TV performance risk sits in the CSS 3D tilt,
  shadows, and filters, not in a render engine.
- **Back at the entry screen returns to Home.** Grok was right, and the first
  version of this page was wrong to dismiss it. The App Self Checklist requires
  Home on webOS 23–25. The Back Button guide's exit-prompt text is the
  platform's default behavior, not the QA criterion.

Grok's review of this page (2026-10-31) agreed with the recommended path and
asked for the changes now made: the Back-key correction, the current CLI
`engines` range, a stated minimum version, named spatial-navigation options,
an out-of-scope line, and the Seller Lounge questions first.

### Work breakdown (sizing, not a plan)

| Piece | Size | Notes |
|---|---|---|
| Device spike | 1–2 days | Hosted shell sideloaded through Developer Mode on a 2024+ LG set: load time, frame rate with the 3D board and VFX, socket stability, audio unlock, Hanko cookie. Needs a physical TV |
| Platform shim | ~1 WP | webOS detection, `appinfo.json`, Back-key routing, hiding clipboard/download/`window.open`/slash/donate, QR for invites |
| 5-way navigation | 1–2 WPs, the biggest piece | Spatial focus over board, lobby, and modals; focus ring; focus = hover parity; focus restore |
| TV readability mode | ~1 WP | Minimum type size, larger targets, card reader as the default way to read |
| Device-code sign-in | ~1 WP (server + client + a web page) | New endpoints, so update `api-endpoints.md` in the same commit |
| Store submission | Operator time | Corporate seller registration, UX scenario, self-checklist, store art, screenshots, QA rounds. The public pages give only the 400×400 store icon. Screenshot and other image sizes are in the checklist download and Seller Lounge (behind sign-in), so the estimate firms up at registration |

**Not needed:** no WebGL or Canvas rewrite, no native port, no packaged
offline build (the game is multiplayer and needs the server), and no engine or
registry change.

## Interactions

- **[Play Board](play-board.md):** the hover stand-up and table tilt this page
  calls hover-only; 5-way focus needs to trigger the same states.
- **[Responsive Viewport Targets](responsive-viewport-targets.md):** owns the
  1280×720 floor and the desktop/mobile split. A TV target (1920×1080 at 10
  feet) would be added there.
- **[Profile Login](profile-login.md) / [Guest Accounts](guest-accounts.md):**
  the Hanko and guest paths TV sign-in builds on.
- **[Monetization Model](monetization-model.md):** the Legendary Pass and
  billing posture that LG's IAP rule constrains.
- **[IP Licensing](ip-licensing.md):** the digital-rights status a store
  listing exposes.
- **[Windows Engine Exe](windows-engine-exe.md):** the other non-browser
  distribution study. Unlike that one, this port carries the full client, not
  the headless engine.
- **Layer boundary:** a TV port only touches `apps/arena-client` (and, for
  pairing, `apps/server` endpoints). The engine and registry don't change.

## Edge Cases

- **Two input modes at once.** The remote moves between pointer and 5-way
  mid-session. Focus state and hover state must agree when the cursor
  disappears (`cursorStateChange`), or a stale hover lift stays on screen.
- **Overlay steals pointer.** While the launcher or settings overlay is up, the
  app gets no pointer events, so a `pointerdown`-armed interaction can be left
  half-done.
- **First-gesture audio unlock.** `AudioControls` arms audio on the first
  `keydown`/`pointerdown`. A remote OK press should count, but this is
  *unverified* on the TV's autoplay policy.
- **Cross-origin brand CSS.** `index.html` loads
  `https://www.legendary-arena.com/brand-tokens.css` with a local fallback.
  Fine for a hosted app; a packaged build would have to inline it.
- **`color-mix()` on webOS 24.** The endgame panels lose their mixed colors, not
  their layout. Cosmetic only.
- **Approval drift.** Hosted content can change daily while LG's approval
  covers what QA saw. A big UX change could break the UX scenario on file.

## Code Touchpoints

- [`apps/arena-client/vite.config.ts`](../apps/arena-client/vite.config.ts): `build.target: 'es2022'`, the syntax floor.
- [`apps/arena-client/src/auth/hankoClient.ts`](../apps/arena-client/src/auth/hankoClient.ts): cookie-scoped Hanko session, the reason to go hosted.
- [`apps/arena-client/src/client/bgioClient.ts`](../apps/arena-client/src/client/bgioClient.ts): Socket.IO transport and the `visibilitychange` resync.
- [`apps/arena-client/src/composables/useScaleToFit.ts`](../apps/arena-client/src/composables/useScaleToFit.ts) / [`useViewport.ts`](../apps/arena-client/src/composables/useViewport.ts): board fit and the 767 px breakpoint.
- [`apps/arena-client/src/composables/useSlashGesture.ts`](../apps/arena-client/src/composables/useSlashGesture.ts): pointer-only fight gesture.
- [`apps/server/src/server.mjs`](../apps/server/src/server.mjs): CORS origin allowlist.

## Open Questions

Ask the first two first. Either answer can change the whole approach, and they
cost a Seller Lounge 1:1 Q&A message, not engineering.

1. **Seller Lounge, money:** does LG accept a game whose paid entitlement
   (the Legendary Pass) is bought only on the web, with no purchase surface
   on the TV? If not, the TV build needs Paymentwall or another contracted
   biller.
2. **Seller Lounge, hosted changes:** does content changed behind a hosted URL
   need re-approval, and how big a UX change counts? If every client deploy
   counts, hosted loses its main advantage.
3. **Back on the entry page:** does `webOS.platformBack()` show Home on webOS
   23–25, as the checklist requires, or the exit prompt? Device spike.
- **Device behavior:** WebAuthn, `window.open`, clipboard, and the audio
  autoplay policy in the webOS 24+ engine. Answered by the device spike.
- **Performance:** frame rate of the 3D-tilted board with box shadows and VFX
  on a TV SoC. `effectIntensity` is the existing lever.
- **Minimum version:** is webOS 24+ (2024 models on) enough of the installed
  base, or are 22/23 sets worth an `es2020` + no-`:has()` build?
- **Rights:** does a TV store listing need anything from Upper Deck/Marvel
  beyond what web distribution needs?

## References

- LG: [Web API and Web Engine](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine) (engine table, cookie rule)
- LG: [Web App Types](https://webostv.developer.lge.com/develop/getting-started/web-app-types) (basic vs hosted)
- LG: [Magic Remote](https://webostv.developer.lge.com/develop/guides/magic-remote) (modes, key codes, 5-way requirement)
- LG: [Back Button](https://webostv.developer.lge.com/develop/guides/back-button)
- LG: [appinfo.json](https://webostv.developer.lge.com/develop/references/appinfo-json)
- LG: [System UI Visibility](https://webostv.developer.lge.com/develop/guides/system-ui-visibility) (`cursorStateChange`)
- LG: [In-App Purchase](https://webostv.developer.lge.com/develop/guides/in-app-purchase)
- LG: [App Self Checklist](https://webostv.developer.lge.com/distribute/app-self-checklist) (content rule) and [CLI Installation](https://webostv.developer.lge.com/develop/tools/cli-installation)
- Community: [webOSbrew appinfo.json notes](https://www.webosbrew.org/develop/guides/appinfo) (`cloudgame_active` on webOS 25; not LG-official)
- LG: [App Approval Process](https://webostv.developer.lge.com/distribute/app-approval-process) and [App Ecosystem](https://webostv.developer.lge.com/distribute/app-ecosystem)
- LG: [CLI Introduction](https://webostv.developer.lge.com/develop/tools/cli-introduction), [Developer Mode App](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app), [Simulator](https://webostv.developer.lge.com/develop/tools/simulator-introduction)
- [Enact Spotlight on npm](https://www.npmjs.com/package/@enact/spotlight): LG's React focus library, for comparison
- Repo: [Play Board](play-board.md), [Responsive Viewport Targets](responsive-viewport-targets.md), [Profile Login](profile-login.md), [Monetization Model](monetization-model.md), [IP Licensing](ip-licensing.md)
