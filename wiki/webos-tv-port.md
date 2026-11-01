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

> **Status: feasibility research. Nothing built, nothing decided.** No WP, EC,
> or DECISIONS entry covers a webOS port. Everything this page recommends is a
> *candidate* for a future WP or decision, not a commitment. Platform facts
> come from LG's developer documentation as read on 2026-10-31 (every page is
> linked under References). Client facts come from the code at `main`
> `f4f73de1`. Nothing has run on a TV; anything marked *unverified* is a
> device-spike question.

## Summary

A webOS port is technically feasible without changing the game engine or the
registry. It is not a native port: it is a webOS distribution shell around the
existing arena-client, plus a TV interaction layer (D-pad navigation, 10-foot
readability, TV sign-in). The leading candidate is a hosted webOS app on
webOS TV 24+ (2024 models and newer). Two Seller Lounge policy questions and a
physical-device spike should be settled before any port work is committed,
because either policy answer can change the approach.

## Mechanics

### Recommendation

- **Candidate architecture:** a hosted webOS app whose shell redirects to
  `https://play.legendary-arena.com`, plus a TV mode in the arena-client
  (5-way focus, 10-foot readability, browser-API adaptations). The shell is
  only an `appinfo.json`, a redirecting `index.html`, and icons; no game
  assets live in the `.ipk`. Hosted is the leading candidate only while the
  two Seller Lounge questions are open; see
  [Hosted vs packaged](#hosted-vs-packaged-hosted-is-the-leading-candidate).
- **Candidate minimum:** webOS TV 24+ (2024 models and newer, Chromium 108).
  Static analysis finds no JavaScript or CSS rewrite needed there; only a
  device spike confirms it. See [Client compatibility](#client-compatibility).
- **Gates before port work is committed, cheapest first:**
  1. Seller Lounge, money: is a Legendary Pass bought only on the web, with
     no purchase surface on the TV, acceptable without LG in-app purchase?
  2. Seller Lounge, hosted changes: does content changed behind a hosted URL
     need re-approval, and how large a change counts?
  3. A device spike on a webOS TV 24+ set, answering the checklist,
     performance, cookie, and API questions under [Device spike](#device-spike).

  Either of the first two answers can invalidate the hosted approach, which is
  why they sit ahead of the platform shim and 5-way work in the
  [candidate scope](#candidate-implementation-scope).

### Platform constraints

| Item | LG's documentation says |
|---|---|
| App model | `type: "web"` apps (HTML, CSS, JavaScript) in the TV's Chromium, built and packaged with the webOS CLI (`ares-generate`, `ares-package`, `ares-install`, `ares-launch`, `ares-inspect`) into an `.ipk` ([Web App Types](https://webostv.developer.lge.com/develop/getting-started/web-app-types)) |
| Two app types | **Basic (packaged):** every file ships in the `.ipk`, so any change is a new package. **Hosted:** a small local app redirects to a remote URL, and its content can change "without pushing updates to devices" ([Web App Types](https://webostv.developer.lge.com/develop/getting-started/web-app-types)) |
| Cookies | Only hosted (http/https) apps get cookies. Packaged apps run from `file://` and have none ([Web API and Web Engine](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)) |
| Resolution | `appinfo.json` `resolution` is `1920x1080` (default) or `1280x720`. UHD is not supported for web apps ([appinfo.json](https://webostv.developer.lge.com/develop/references/appinfo-json)) |
| Remote | The Magic Remote has a **pointer mode** (standard mouse events, `:hover`, wheel scroll) and a **5-way mode** (arrows and OK, cursor hidden). An arrow press switches to 5-way; a shake switches back. `cursorStateChange` reports which mode is active. "Apps must support 5-way mode." Keys: arrows 37–40, OK 13, Back 461, and the color keys 403–406, which stay free for TV shortcuts later (pass, menu) ([Magic Remote](https://webostv.developer.lge.com/develop/guides/magic-remote), [System UI Visibility](https://webostv.developer.lge.com/develop/guides/system-ui-visibility)) |
| Back default | The platform drives Back through `history`; setting `disableBackHistoryAPI: true` in `appinfo.json` hands Back (461) to the app. At the first screen the platform's default is an exit prompt on 6.0+ and Home on 5.0 and earlier, which `webOS.platformBack()` triggers ([Back Button](https://webostv.developer.lge.com/develop/guides/back-button)). The QA checklist asks for something else; see the next subsection |
| Overlays | While the launcher or settings is open, the app gets no pointer events; `window` `blur`/`focus` say when ([Magic Remote](https://webostv.developer.lge.com/develop/guides/magic-remote)) |
| Gamepads | `cloudgame_active: true` lets the app read a gamepad directly, not as remapped keys; LG lists webOS TV 23 and 24 on current firmware ([appinfo.json](https://webostv.developer.lge.com/develop/references/appinfo-json)). The community webOSbrew wiki (not LG-official) adds that on 25+ it also turns off the right-click BACK/HOME menu. Optional here: the remote is the required input |
| Store and approval | Seller Lounge; QA runs a pretest, a function test, and a content test. A submission needs the `.ipk`, images, a UX scenario, and a self-checklist with real test results. "If there is any change to the app after being approved, the change has to go through a separate approval process." Sellers register as Individual or Corporate ([App Approval Process](https://webostv.developer.lge.com/distribute/app-approval-process), [App Ecosystem](https://webostv.developer.lge.com/distribute/app-ecosystem)) |
| Paid content | "To provide paid products or content in your VOD or game app, In-App Purchase is required." LG's own billing service is no longer provided; LG recommends Paymentwall and "may ask you for a separate contract" for another third-party biller ([In-App Purchase](https://webostv.developer.lge.com/develop/guides/in-app-purchase)) |
| Launch art | `splashBackground` 1920×1080 PNG, shown while the app loads (optional in `appinfo.json`, but a hosted app's load is a network round trip, so it is what players see first); `icon` 80×80 and `largeIcon` 130×130 for testing; the store icon is a separate 400×400 upload ([appinfo.json](https://webostv.developer.lge.com/develop/references/appinfo-json)) |
| Dev loop | The Developer Mode app opens a timed session; the CLI connects over SSH as `prisoner` on port 9922 after a key-server passphrase ([Developer Mode App](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)). A PC Simulator matches the TV's Chromium but differs in audio/video and lacks some platform APIs ([Simulator](https://webostv.developer.lge.com/develop/tools/simulator-introduction)). The CLI is `@webos-tools/cli`: LG's [CLI Installation](https://webostv.developer.lge.com/develop/tools/cli-installation) page still says Node 14.15–16.20, but the current package (3.2.6) declares `node >=20`, so the repo's Node 22 should run it |

#### LG QA checklist items that bear on the port

From the [App Self Checklist](https://webostv.developer.lge.com/distribute/app-self-checklist),
the list QA tests against:

| Item | Level | What it says |
|---|---|---|
| 4-way navigation | Mandatory | "Selectable UIs must be controlled by 4-way navigation keys (Up, Down, Left, Right), OK, and Back buttons." |
| Selection effect | Mandatory | "All of the objects in your app MUST ALWAYS provide some sort of selection effect with NO EXCEPTION." |
| Back on the entry page | Mandatory | Back "must display the Home screen (webOS23 - webOS25 only)." |
| Text size | Recommended | At least 20 px at 1920×1080 (14 px at 1280×720) |
| Button images | Recommended | At least 75×75 px at 1920×1080 (50×50 at 1280×720) |
| Content | Mandatory | No gambling games, no buying or cashing out game money, no moving game money between users, and no "acquiring of compensation" |
| The checklist itself | Mandatory | Uploaded with real test results; a missing or thin one can be rejected before QA |

### Client compatibility

| webOS TV | Year | Chromium |
|---|---|---|
| 26 | 2026 | 132 |
| 25 | 2025 | 120 |
| 24 | 2024 | 108 |
| 23 | 2023 | 94 |
| 22 | 2022 | 87 |
| 6.x | 2021 | 79 |

Source: [Web API and Web Engine](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine).
What sets the floor, from the client code:

- **JS:** `vite.config.ts` sets `build.target: 'es2022'` with no legacy plugin
  or browserslist, so ES2022 syntax ships as is. ES2022's features landed
  across Chrome releases up to 94 (class static blocks were last), so
  Chromium 94 (webOS TV 23) is the safe floor for the syntax.
- **CSS `:has()`** (Chromium 105+) appears in 8 play-surface files. It drives
  the table-tilt stand-up and the hand-fan neighbor shift
  ([Play Board](play-board.md)). This puts the floor at **webOS TV 24+**. On 23
  and earlier the selectors are dropped: the board renders, but the hover lift
  is lost.
- **`color-mix()`** (Chromium 111+) appears 16 times, only in the endgame coach
  and summary panels. On webOS TV 24 those declarations fall back to defaults,
  a cosmetic loss. On 25+ they render fully.
- Not used: WebGL, service workers, IndexedDB, container queries, `dvh`,
  `backdrop-filter`. VFX are a 2D canvas (`canvas-confetti`, the blade trail)
  plus CSS 3D transforms. Card art is `.webp`, audio `.mp3` through Howler.

Static analysis identifies **webOS TV 24+ (2024 models and newer)** as the
candidate minimum that needs no known JavaScript or CSS rewrite. Running the production bundle on a device is still unverified. Going
lower costs: webOS TV 23 means replacing the `:has()` rules with class toggles;
webOS TV 22 also means retargeting to `es2020`.

### Port requirements

#### 5-way navigation

The Magic Remote's pointer mode is a mouse, so the current board works in
pointer mode unchanged: CSS `:hover` (26 files, about 76 rules) and native
`title` tooltips (about 55). The mandatory 5-way support is almost absent:

- About 199 `@click` handlers, almost all on real `<button>` elements, so they
  can take focus. Only 3 are `<div @click>`.
- `tabindex` appears in 3 files. Arrow keys are handled only in
  `AutoplayControls` and `ReplayInspector`. There is no roving focus, no
  spatial navigation across the board, and no Gamepad API.
- `:focus-visible` styling exists in about 8 files, against hover in 26. The
  checklist requires a selection effect on every object, so a missing focus
  ring fails QA, not just usability.
- **Hover-only information** (card stand-up, the hand fan, Officer/Sidekick
  hover text, `title` tooltips) has no 5-way equivalent.
- The **slash gesture**
  ([`useSlashGesture.ts`](../apps/arena-client/src/composables/useSlashGesture.ts)),
  a pointer stroke that fights villains, only works with a pointer. On TV it
  would be off, with Fight left as a button.

5-way needs a focus layer over the board's zones (hand, HQ, City, Mastermind,
shared decks, the action bar), the lobby, and modals: a visible focus ring,
focus restored when a modal closes, and focus doing what hover does (stand-up
and info reveal). Candidate starting points (npm, checked 2026-10-31; none
tried):

| Option | What it is | Fit for a Vue client |
|---|---|---|
| In-house zone graph | Each zone is a list. Left/right moves within a zone, up/down between zones in a fixed order. Overlays push a zone stack | Strongest fit; see below |
| `js-spatial-navigation` 1.0.1 | Vanilla JS spatial navigation by Luke Chang. Enact Spotlight is a fork of it | Framework-agnostic, geometry-based |
| `spatial-navigation-polyfill` 1.3.1 | The WICG polyfill for the proposed CSS spatial-navigation standard | Framework-agnostic, geometry-based, closest to a standard |
| `@enact/spotlight` 5.6.0 | LG's own focus library | Built around Enact/React; poor fit |
| `@noriginmedia/norigin-spatial-navigation` 3.4.0 | "React hooks based" | React-only |

**Finding:** the geometry-based libraries pick the nearest element on screen.
The board is tilted 14° in 3D with cards that lift and fan, so their on-screen
rectangles don't match the logical layout, and "nearest" becomes unpredictable.
The board is authored at a fixed 1280×720, so its zones and their order are
already known. That makes an explicit zone graph the safer starting point for the
board. Geometry-based libraries stay reasonable candidates for the flat
screens (lobby, menus, modals), so the expected shape is a hybrid: a zone graph
on the board, geometry elsewhere. This is an inference from the layout, not a
tested result.

#### Back key

Routing is query-parameter based with full reloads (`?route=…`,
`window.location.assign`). With `disableBackHistoryAPI: true` the app owns
Back: it closes the top overlay or modal, then leaves the current route.

On the lobby root (the entry page) LG's two sources diverge:

- **App Self Checklist (webOS TV 23–25):** Back "must display the Home
  screen." Mandatory.
- **Back Button guide:** the platform's default is an exit prompt on 6.0+ and
  Home on 5.0 and earlier, and `webOS.platformBack()` triggers that default.

Which one a current webOS TV 24+ set actually does when the app calls
`webOS.platformBack()` from the lobby root is a [device spike](#device-spike)
question. Until it is answered, the checklist wording is the compliance
target, since it is what QA tests.

#### TV readability

LG recommends text of at least 20 px and button images of at least 75×75 px at
1920×1080 (App Self Checklist). The desktop board is authored at 1280×720 and
fit by `transform: scale()`, clamped to 0.5–1.5
([`useScaleToFit.ts`](../apps/arena-client/src/composables/useScaleToFit.ts)).
The TV viewport is a fixed 1920×1080, above the 767 px breakpoint, so
`<PlayDesktop>` renders.

| Measure | Board today | LG at 1920×1080 |
|---|---|---|
| Smallest play-surface text | `0.55rem`–`0.62rem`, about 8.8–9.9 px as authored. On screen that is about 8.6 px at the 0.98× scale measured in a 1920×1080 desktop browser, and at most about 13–15 px at the 1.5× cap | 20 px minimum (recommended) |
| Smallest `px` text anywhere | `10px` (3 uses), `11px` (11 uses) | 20 px |

The gap is measurable: even at the scale cap, the smallest board text is
below LG's recommendation. The 20 px and 75×75 px figures are recommended
checklist items, not mandatory ones, so they are not a stated rejection
criterion; they are the natural design target for a TV mode, and text of about
9–15 px is hard to read from a couch either way. A TV mode would need a larger minimum type size,
targets of 75×75 px or more, and probably the card reader (zoomed card) as the
default way to read card text, not hover.
[Responsive Viewport Targets](responsive-viewport-targets.md) owns the current
targets; TV would be a new one.

#### Browser API adaptations

| Used today | Where | On TV |
|---|---|---|
| `navigator.clipboard` (copy log, copy guest-seat link) | `GameLogPanel`, `GameLogCopyButton`, `WaitingForPlayersPanel`, `DiagnosticExportButton` | No useful clipboard. A **QR code** for invite links instead *(unverified whether the API throws or no-ops)* |
| Blob download (game-log Save, diagnostic export) | `GameLogPanel`, `DiagnosticExportButton` | No user file system. Hide it |
| `window.open` (guest links, loadout viewer, Open Collective) | `WaitingForPlayersPanel`, `LobbyView`, `ViewLoadoutButton`, `BillingSection` | No tabs. Navigate in place or show a QR code *(unverified)* |
| `navigator.vibrate` | `useSlashGesture` | Irrelevant: the slash gesture is off on TV |
| `visibilitychange` socket resync | [`bgioClient.ts`](../apps/arena-client/src/client/bgioClient.ts) | Useful as is for TV suspend and resume. Music should also pause when hidden *(not checked)* |
| `localStorage` prefs (theme, audio, skin, effect intensity) | 14 files | Fine on a hosted (http/https) origin |

#### TV sign-in

Hanko's login is passkey-first, with email passcode and Google/Discord OIDC
([Profile Login](profile-login.md)). On a TV:

- **Passkeys** need a platform authenticator or the cross-device QR/Bluetooth
  flow. Whether the webOS engine exposes WebAuthn usefully is *unverified*;
  expect it to be weak or absent.
- **Google OIDC** inside an embedded web engine may hit Google's block on
  embedded user agents (*unverified on webOS*).
- **Email passcode** works with the system on-screen keyboard, but slowly.
- **Guests** ([Guest Accounts](guest-accounts.md)) already play with no
  sign-in, which covers a first launch.

The usual TV pattern is **device-code pairing**: the TV shows a short code and
a QR code, the player signs in on a phone, and the TV picks up the session.
That needs new server endpoints.

### Distribution

#### Hosted vs packaged: hosted is the leading candidate

| | Hosted app → `https://play.legendary-arena.com` | Packaged `.ipk` |
|---|---|---|
| Hanko sign-in | Works as today: the `hanko` cookie is set on `.legendary-arena.com` ([`hankoClient.ts`](../apps/arena-client/src/auth/hankoClient.ts)) | Breaks: no cookies on `file://`. Hanko SDK 2.6 can keep the token in `sessionStorage` (`sessionTokenLocation`), but that ends when the app closes, so players would sign in on every launch |
| CORS | No change: the page origin is `play.legendary-arena.com`, already on the allowlist in [`server.mjs`](../apps/server/src/server.mjs) | The origin is `file://`/`null`, which the allowlist doesn't include |
| API/socket URLs | Already absolute (`VITE_API_BASE_URL`, `VITE_SERVER_URL` in [`apiBaseUrl.ts`](../apps/arena-client/src/lib/api/apiBaseUrl.ts)) | Same, but a separate build |
| Deploys | Every Pages deploy reaches the TV; the `version.json` update banner keeps working | Every client change is a new `.ipk` and another LG review |
| Offline | Needs the network, which a live match needs anyway | No real gain: live matches need the server |

`X-Frame-Options: DENY` in [`_headers`](../apps/arena-client/public/_headers)
does not matter: the hosted shell redirects at the top level, with no frame.

Why "leading candidate" and not settled: LG says hosted content can change
without pushing updates to devices, and also that any change after approval
needs a separate approval. LG's public documentation doesn't say how those two
statements combine for a hosted app. If every client deploy counts as a
change, hosted loses its main operational advantage. That is gate 2 in the
[Recommendation](#recommendation).

#### Paid content

LG requires an in-app purchase solution when paid products or content are
provided in the TV app. Its own billing service is retired; it recommends
Paymentwall and may require a separate contract for another biller. The
client has **no checkout today**. The Legendary Pass gate
(`/api/me/entitlements`) sends players to `?route=me`, and `BillingSection`
links to Open Collective ([Monetization Model](monetization-model.md)).

The documentation does not say whether an entitlement bought elsewhere and
only recognized on the TV counts as "providing" paid content in the app. The
low-friction candidate posture is that entitlements bought on the web carry
over through the account and the TV build hides purchase and donation calls to
action. Paymentwall is the fallback if LG says no (gate 1).

#### Seller account and rights

- **Seller:** a Corporate seller under BarefootBetters. The `appinfo.json`
  `id` is reverse-DNS, lowercase, and can't be changed after publishing, so it
  is chosen once (for example `com.legendaryarena.arena`).
- **Content rule:** the client has no game money. Paid-entry or prize events
  would stay off the TV build.
- **IP exposure:** a store listing is a public, rights-holder-visible
  distribution of Marvel art under our seller name.
  [IP Licensing](ip-licensing.md) records that the digital Marvel grant is not
  in hand. A TV listing raises that exposure, and LG's content test may ask
  about rights *(unverified)*.

#### Registering the seller account

The account is registered under `jeff@barefootbetters.com`. LG's
[Seller Registration guide](https://seller.lgappstv.com/seller/guide/sellerRegistration.lge)
lists the steps below. It does not list the documents a Corporate seller
needs, how long review takes, or any fee, so those rows wait for the
form itself.

1. **Create the LG account** with `jeff@barefootbetters.com`, from Sign Up on
   [webostv.developer.lge.com](https://webostv.developer.lge.com). The same LG
   account signs in to Seller Lounge and to the Developer Mode app on a TV.
   Choose the country carefully: a developer-forum report says an LG account's
   country can't be changed later, short of deleting the account and starting
   again.
2. **Open [Seller Lounge](https://seller.lgappstv.com/),** sign in with that
   account, and click **Sign Up** for seller membership.
3. **Select the seller type: Corporate Seller.** A corporate seller signs up
   "under a licensed business title," and the store shows the company name.
   Use the business's name exactly as it is registered.
4. **Agree to the Terms and Conditions.**
5. **Complete the General Information form and submit it.**
6. **Verify the email address** from the message sent to
   `jeff@barefootbetters.com`.
7. **Registration is complete.** The Seller Lounge menu then has **1:1 Q&A**,
   where the [two questions](#seller-lounge-questions-and-lgs-answers) are
   posted.

Herbs vs. Ailments is not registered under this account: it is an
independent project built to be sold separately, and its entity isn't
formed yet.

What the registration actually asked, filled in as it happens:

| Item | Answer |
|---|---|
| Date registered | *(not yet)* |
| Account country chosen | *(not yet)* |
| Company name as registered | *(not yet)* |
| Documents the Corporate form asked for | *(not yet)* |
| Review or approval time | *(not yet)* |
| Fee | *(not yet)* |
| Seller ID or account notes | *(not yet)* |

#### Seller Lounge questions and LG's answers

Posted through Seller Lounge 1:1 Q&A. Each question is written generically,
so one answer covers both Legendary Arena and Herbs vs. Ailments. The text
below is what gets pasted.

**Question 1: purchases made outside the TV app** (gate 1)

```
Title: In-App Purchase policy for content bought on our website

We are preparing a game app for webOS TV. Players sign in with their
account on our service. Some players have already paid for a subscription
or license on our own website (outside the TV). The paid content is then
available to them on every device where they sign in, including the TV.

Inside the TV app:
- There is no purchase screen, no price, and no payment of any kind.
- There is no button or link that sends the user to a purchase page.
- The app only checks the signed-in account and unlocks what the user has
  already bought.

Your In-App Purchase guide says "To provide paid products or content in
your VOD or game app, In-App Purchase is required."

1. Is this model allowed without In-App Purchase?
2. May the app show a neutral message such as "This feature is part of
   [subscription name]. Manage your account at [our website]"? Or must the
   app show nothing about it?
3. If In-App Purchase is required, does it have to be Paymentwall, or may we
   use another payment provider under a separate contract with LG?
```

| | LG's answer |
|---|---|
| Date asked | *(not yet asked)* |
| Ticket or reference | *(not yet asked)* |
| Date answered | *(not yet answered)* |
| 1. Allowed without in-app purchase? | *(not yet answered)* |
| 2. Neutral "manage your account" message allowed? | *(not yet answered)* |
| 3. Paymentwall only, or another provider? | *(not yet answered)* |
| What it changes on this page | *(not yet answered)* |

**Question 2: hosted web app updates after approval** (gate 2)

```
Title: Re-approval for content changes in a hosted web app

We plan to publish a hosted web app. The .ipk contains only appinfo.json,
icons, and an index.html that redirects to our web server. The game itself
is served from our server and is updated there.

Your Web App Types guide says a hosted app can update content "without
pushing updates to devices." Your App Approval Process page says "If there
is any change to the app after being approved, the change has to go through
a separate approval process."

1. Does a change on our server (with no new .ipk) need a new approval?
2. If some changes do need approval, which ones? For example: bug fixes,
   new game content, or UI and navigation changes.
3. If we change the UI after approval, must we resubmit the UX scenario
   document?
```

| | LG's answer |
|---|---|
| Date asked | *(not yet asked)* |
| Ticket or reference | *(not yet asked)* |
| Date answered | *(not yet answered)* |
| 1. Server-side change needs approval? | *(not yet answered)* |
| 2. Which changes need approval? | *(not yet answered)* |
| 3. UX scenario resubmitted after a UI change? | *(not yet answered)* |
| What it changes on this page | *(not yet answered)* |

When an answer arrives, quote LG's words in its rows, add the date, and update
the Recommendation and Open Questions to match.

### Device spike

A sideloaded hosted shell on a webOS TV 24+ set, through Developer Mode. The
questions it answers, each tied to the requirement it tests:

| Question | Why it matters |
|---|---|
| Does Back on the lobby root show the Home screen on webOS TV 23–25, via `webOS.platformBack()` or otherwise? | Mandatory checklist item |
| Does every focusable control show a visible selection effect in 5-way mode? | Mandatory checklist item |
| Does the production bundle load and render on Chromium 108 with no console errors? | Confirms the static compatibility analysis |
| Frame rate of the 3D-tilted board with box shadows and VFX on a TV SoC; does `effectIntensity` help? | Performance on TV hardware |
| Does the hosted shell's redirect complete cleanly, leaving the app on the live origin with its cookies intact? | The core hosted assumption |
| Does the Hanko cookie survive an app relaunch? | The main reason for hosted |
| Does `cursorStateChange` fire reliably on each pointer ↔ 5-way switch, so hover state can be cleared or handed to focus? | Stale card lifts (see Edge Cases) |
| Does the Socket.IO connection resync after a TV suspend? | Live-match stability |
| Does a remote OK press unlock audio under the TV's autoplay policy? | First-run sound |
| What do WebAuthn, `window.open`, and the clipboard do? | Sign-in and API adaptations |

### Candidate implementation scope

> **Non-authoritative sizing.** These slices only establish feasibility and
> relative size. They create no WPs, sequencing, or commitments.

| Slice | Relative size | Notes |
|---|---|---|
| Seller Lounge policy questions | A message | Gates 1 and 2; either answer can change the approach |
| Device spike | 1–2 days | Needs a physical webOS TV 24+ set |
| Platform shim | Small | webOS detection, `appinfo.json`, Back-key routing, hiding clipboard/download/`window.open`/slash/donate, QR for invites |
| 5-way navigation | Largest | Zone graph over the board, focus over lobby and modals, focus ring, focus = hover parity, focus restore |
| TV readability | Medium | 20 px minimum text, 75×75 px targets, card reader by default |
| Device-code pairing | Medium (server + client + a web page) | New endpoints, so `api-endpoints.md` changes with them |
| Store submission | Operator time | Corporate registration, UX scenario, self-checklist, store art (400×400 icon, 1920×1080 splash), screenshots, QA rounds. Public pages give only the 400×400 store icon; other image sizes are in the checklist download and Seller Lounge, behind sign-in |

**Not needed:** no WebGL or Canvas rewrite, no native port, no packaged
offline build (live matches need the server), and no engine or registry
change.

## Interactions

- **[Play Board](play-board.md):** the hover stand-up and table tilt that are
  hover-only today; 5-way focus would trigger the same states, and the tilt
  is why a zone graph beats geometry-based navigation on the board.
- **[Responsive Viewport Targets](responsive-viewport-targets.md):** owns the
  1280×720 floor and the desktop/mobile split. A TV target (1920×1080 at 10
  feet, LG's 20 px text) would be added there.
- **[Profile Login](profile-login.md) / [Guest Accounts](guest-accounts.md):**
  the Hanko and guest paths TV sign-in builds on.
- **[Monetization Model](monetization-model.md):** the Legendary Pass and
  billing posture that LG's in-app purchase rule constrains.
- **[IP Licensing](ip-licensing.md):** the digital-rights status a store
  listing exposes.
- **[Windows Engine Exe](windows-engine-exe.md):** the other non-browser
  distribution study. Unlike that one, this port carries the full client, not
  the headless engine.
- **Layer boundary:** a port touches only `apps/arena-client` and, for
  pairing, `apps/server` endpoints. The engine and registry don't change.

## Edge Cases

- **Two input modes at once.** The remote moves between pointer and 5-way
  mid-session. When `cursorStateChange` reports the cursor hidden, any hover
  state has to clear (or hand over to focus), or a stale hover lift stays on
  screen.
- **Overlay steals pointer.** While the launcher or settings overlay is up, the
  app gets no pointer events, so a `pointerdown`-armed interaction can be left
  half-done.
- **First-gesture audio unlock.** `AudioControls` arms audio on the first
  `keydown`/`pointerdown`. A remote OK press should count *(unverified)*.
- **Cross-origin brand CSS.** `index.html` loads
  `https://www.legendary-arena.com/brand-tokens.css` with a local fallback.
  Fine when hosted; a packaged build would have to inline it.
- **`color-mix()` on webOS TV 24.** The endgame panels lose their mixed colors,
  not their layout.
- **Approval drift.** Hosted content can change daily while LG's approval
  covers what QA saw. A large UX change could stop matching the UX scenario on
  file.

## Code Touchpoints

- [`apps/arena-client/vite.config.ts`](../apps/arena-client/vite.config.ts): `build.target: 'es2022'`, the syntax floor.
- [`apps/arena-client/src/auth/hankoClient.ts`](../apps/arena-client/src/auth/hankoClient.ts): cookie-scoped Hanko session, the main reason for hosted.
- [`apps/arena-client/src/client/bgioClient.ts`](../apps/arena-client/src/client/bgioClient.ts): Socket.IO transport and the `visibilitychange` resync.
- [`apps/arena-client/src/composables/useScaleToFit.ts`](../apps/arena-client/src/composables/useScaleToFit.ts) / [`useViewport.ts`](../apps/arena-client/src/composables/useViewport.ts): board fit and the 767 px breakpoint.
- [`apps/arena-client/src/composables/useSlashGesture.ts`](../apps/arena-client/src/composables/useSlashGesture.ts): pointer-only fight gesture.
- [`apps/server/src/server.mjs`](../apps/server/src/server.mjs): CORS origin allowlist.

## Open Questions

**Go / no-go (ask first; each can change the approach):**

1. **Seller Lounge, money:** is a Legendary Pass bought only on the web, with
   no purchase surface on the TV, acceptable without LG in-app purchase? If
   not, a TV build needs Paymentwall or another contracted biller.
2. **Seller Lounge, hosted changes:** does content changed behind a hosted URL
   need re-approval, and how big a change counts?

   Both are drafted, with slots for LG's answers, under
   [Seller Lounge questions and LG's answers](#seller-lounge-questions-and-lgs-answers).
3. **Rights:** does a TV store listing need anything from Upper Deck or Marvel
   beyond what web distribution needs?

**Product decisions (after the gates):**

- **Minimum version:** is webOS TV 24+ enough of the installed base, or are
  webOS TV 22/23 sets worth replacing `:has()` and retargeting the build?
- **Paymentwall:** if Seller Lounge requires in-app purchase, is Paymentwall
  (or another contracted biller) worth the integration for the expected TV
  audience?

Device behavior (WebAuthn, clipboard, `window.open`, audio, performance, Back
on the entry page) is answered by the [device spike](#device-spike), not by
decision.

## References

LG documentation, read 2026-10-31:

- [Web API and Web Engine](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine): engine table, the cookie rule
- [Web App Types](https://webostv.developer.lge.com/develop/getting-started/web-app-types): basic vs hosted
- [Magic Remote](https://webostv.developer.lge.com/develop/guides/magic-remote): modes, key codes, the 5-way requirement
- [System UI Visibility](https://webostv.developer.lge.com/develop/guides/system-ui-visibility): `cursorStateChange`
- [Back Button](https://webostv.developer.lge.com/develop/guides/back-button): the platform's default Back behavior
- [App Self Checklist](https://webostv.developer.lge.com/distribute/app-self-checklist): mandatory navigation, selection-effect and Back items; recommended 20 px text and 75×75 px buttons; content rules
- [appinfo.json](https://webostv.developer.lge.com/develop/references/appinfo-json): `resolution`, `disableBackHistoryAPI`, `cloudgame_active`, icons, splash
- [In-App Purchase](https://webostv.developer.lge.com/develop/guides/in-app-purchase)
- [App Approval Process](https://webostv.developer.lge.com/distribute/app-approval-process) and [App Ecosystem](https://webostv.developer.lge.com/distribute/app-ecosystem)
- [Seller Registration guide](https://seller.lgappstv.com/seller/guide/sellerRegistration.lge) (on Seller Lounge): seller types and the five registration steps
- [CLI Introduction](https://webostv.developer.lge.com/develop/tools/cli-introduction), [CLI Installation](https://webostv.developer.lge.com/develop/tools/cli-installation), [Developer Mode App](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app), [Simulator](https://webostv.developer.lge.com/develop/tools/simulator-introduction)

Other sources:

- npm registry, read 2026-10-31: `@webos-tools/cli` 3.2.6 (`engines: node >=20`), `js-spatial-navigation`, `spatial-navigation-polyfill`, `@enact/spotlight`, `@noriginmedia/norigin-spatial-navigation`
- [webOSbrew appinfo.json notes](https://www.webosbrew.org/develop/guides/appinfo): community, not LG-official (`cloudgame_active` on webOS TV 25)
- Repo: [Play Board](play-board.md), [Responsive Viewport Targets](responsive-viewport-targets.md), [Profile Login](profile-login.md), [Guest Accounts](guest-accounts.md), [Monetization Model](monetization-model.md), [IP Licensing](ip-licensing.md)

Provenance: independent research and review passes (Grok twice and Copilot
once, all 2026-10-31) challenged the drafts. Every disputed claim was checked against LG's
documentation or the npm registry before it changed this page.
