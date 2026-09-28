# WP-785 — Lobby Arena entrance: one Enter Arena on a legal featured table

**Status:** Draft 2026-09-28 · **EC:** EC-822 · **Reserves:** D-24633
**Primary Layer:** Arena Client (App)
**User-Visible Surface:** play.legendary-arena.com (the bare landing URL)
**Lane:** standard two-session. Not lightweight: 6 code/test files plus `App.vue` exceeds the
4-file budget, and the WP locks a player-path default (D-24633).
**Baseline:** `origin/main` @ `da4d3a2c` (2026-09-28); arena-client 2175 tests / 360 suites / 0 fail,
vue-tsc 0 (observed).

## Goal

A first-time visitor to `play.legendary-arena.com` sees the game, not a form. The bare landing
URL opens a dark, art-led **Arena entrance**: Magneto's portrait, the featured encounter in one
line, and one maroon **Enter Arena** button. One click creates a curated, composition-legal
**solo featured table** (Magneto + Brotherhood + Sentinel against Midtown Bank Robbery, with
Spider-Man, Hulk, and Wolverine) and seats the player at it. Every control the lobby has today
stays, unchanged, behind an **Arena Workshop** link. This is priority 1 of the ewiki
[Play Lobby UX Direction](../../../wiki/play-lobby-ux-direction.md).

## User-Visible Impact

- `play.legendary-arena.com/` (no query) shows the Arena entrance instead of the cream lobby form.
- **Enter Arena** (signed in) → the match is created and joined, and the player lands on the play
  route in the `lobby` phase, exactly as "Create match from loadout" does today.
- **Enter Arena** (signed out) → `?route=login`, the same bounce every create path uses today.
- **Arena Workshop** → `?route=workshop`, which renders today's `LobbyView` with its heading
  renamed to "Arena Workshop". Invite links (`?route=lobby&match=<id>`, WP-369) and any `?match=`
  without full live params still open it.
- Navigation that targets `/` now lands on the entrance: the header "Play" link, the endgame
  "Back to Lobby", the bot-stall escape (`location.assign('/')`), and the LoginPage success path
  (`?route=`). A Workshop user bounced to login therefore returns to the entrance, not the
  Workshop; recorded as a papercut (the LoginPage `returnTo` allowlist is guarded-routes-only).

## Assumes

- **WP-092 / WP-254 / WP-371 ✅** — `launchMatchFromComposition(input)`
  (`apps/arena-client/src/lobby/useCreateMatchFromComposition.ts`) creates via
  `POST /api/match/create`, stashes the setup (`persistMatchSetup`), joins seat `'0'` via
  `POST /api/match/join`, navigates to `?match&player=0&credentials`, and never throws
  (`{ ok: true, matchID } | { ok: false, message }`).
- **Engine `minPlayers: 1`** (`packages/game-engine/src/game.ts`). `PLAYER_COUNT_SETUP[1]`
  (`packages/registry/src/playerCountSetup.ts`, D-24165) = 1 villain group / 1 henchman group /
  1 villain-deck bystander / 3 heroes. Supply floors 30 / 30 / 30 / 0 (D-24032), so 30/30/30/12
  passes. `validateSetupData` → `validateMatchSetup` does **not** check Always Leads.
- **Card data** (`data/cards/core.json`): mastermind `magneto` has `alwaysLeads: ["brotherhood"]`
  (bare slugs) and no top-level `imageUrl`; its base card (name `Magneto`) has
  `https://images.legendary-arena.com/core/core-mm-magneto.webp`. Villain group `brotherhood`,
  henchman group `sentinel`, scheme `midtown-bank-robbery`, heroes `spider-man`, `hulk`,
  `wolverine` exist with the names used below.
- **Sign-in:** `/api/match/create` and `/api/match/join` require a session (401 otherwise). The
  client bounces a signed-out visitor to `?route=login` (`LobbyView.vue`
  `requireAuthTokenOrRedirectToLogin`). `useAuthStore().token` is the bearer (WP-160).
- **Routing** (`apps/arena-client/src/App.vue`): no router; `parseQuery()` + `selectRoute()`.
  `ParsedQuery` has `live` (all three params) but no raw `match`; setup can only give the template
  what it returns (D-6512). With no explicit route and incomplete live params `selectRoute` returns
  `'lobby'` and the template's final `v-else` renders `<LobbyView />`. `?route=lobby` is not a
  parsed route today; `LobbyView` reads `?match=` to highlight a row (WP-369). `App.test.ts`
  stubs `LobbyView` and passes with an unstubbed `ArenaEntrance` that makes no request on mount.
- **Brand tokens** load from `index.html` (`/brand-tokens.local.css`, then the live
  `https://www.legendary-arena.com/brand-tokens.css`). The dark palette applies only under
  `html[data-theme="dark"]` (`--la-color-bg-primary: #0b0f19`, `--la-color-text-primary: #f5f7fb`,
  `--la-color-gold: #d4af37`). `--la-color-cta` is `#7a1d1f` in both themes.
- **jsdom ignores `location.search` assignment** (it logs "Not implemented: navigation"), so a unit
  test can observe that no request was sent, not the navigation itself (LobbyView.test.ts precedent).

## Context (Read First)

- ewiki [Play Lobby UX Direction](../../../wiki/play-lobby-ux-direction.md) — the two external reviews,
  the reconciled flow, priorities 1–7, and a rendered mockup (illustrative; these locked values win).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §7 Match Configuration — the composition field names.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary + `.claude/rules/architecture.md` (arena-client import row):
  no runtime `registry` import, so the featured table is a client constant.
- DECISIONS scan: D-24092 (Access Model), D-24032 (supply floors), D-24165 (`PLAYER_COUNT_SETUP`),
  D-6512 (App.vue setup returns), D-24446.
- `apps/arena-client/src/client/bgioClient.test.ts` §"empty query string → <LobbyView />" pins today's
  default route. That assertion changes on purpose (the product default changes); the commit says so.
- **Why a solo table, not bot ally.** Bot-ally create needs 2–5 seats and a 2-player composition.
  Solo is the shortest legal path with no bot idle limit. Named bot seats are priority 4.
- **Why not `loadout-test.json`.** It pairs Magneto with Skrulls, which breaks his printed Always
  Leads. The engine does not check Always Leads, so the table must be legal by construction and
  pinned by a test against `data/cards/core.json`.
- **Vision gap:** `docs/01-VISION.md` §Access Model promises a guest a solo match without an account
  (D-24092). The create endpoints require a session, so this WP keeps the sign-in bounce. WP-787
  (server guest-solo create) closes the gap; a client adoption WP follows it.
- Fonts: `--la-font-display` names Bebas Neue, but arena-client loads no webfont; the fallback stack
  renders. Loading the webfont is out of scope.

## Non-Negotiable Constraints

**Engine-wide (do not remove):** ESM only, Node v22+, `node:` prefix. Vue SFCs compile via
`vue-sfc-loader` (test-only devDep). Full file contents, no diffs. Human-style code per
`docs/ai/REFERENCE/00.6-code-style.md` (no nested ternaries, full-word names, JSDoc on every function).

**Packet-specific:**
- Client-only: no `packages/**`, no `apps/server/**`, no new endpoint, no engine change.
- No runtime import of `@legendary-arena/registry`; a type-only import of `MatchConfiguration` from
  `@legendary-arena/game-engine` is allowed.
- `ArenaEntrance.vue` makes **no request on mount**; the only request is the Enter Arena launch.
- `LobbyView.vue` changes only its `<h1>` text. Every existing id, `data-testid`, and control stays.
- `App.test.ts` passes unchanged; do not add an `ArenaEntrance` stub.
- 01.5 is NOT INVOKED: every modified file is allowlisted and changed for its own behavior.
- vue-tsc is gated **Before** and **After**.

**Session protocol:** if `launchMatchFromComposition`'s signature or result shape differs from
Assumes, STOP. Stop and ask on any item not locked here.

## Locked Contract Values

- **Featured table** (`FEATURED_TABLE: MatchConfiguration` in `src/lobby/featuredTable.ts`):
  `schemeId: 'core/midtown-bank-robbery'`, `mastermindId: 'core/magneto'`,
  `villainGroupIds: ['core/brotherhood']`, `henchmanGroupIds: ['core/sentinel']`,
  `heroDeckIds: ['core/spider-man', 'core/hulk', 'core/wolverine']`, `bystandersCount: 30`,
  `woundsCount: 30`, `officersCount: 30`, `sidekicksCount: 12`. `FEATURED_PLAYER_COUNT = 1`.
- **`FEATURED_TABLE_LABELS`:** `mastermind: 'Magneto'`, `scheme: 'Midtown Bank Robbery'`,
  `villainGroup: 'Brotherhood'`, `henchmanGroup: 'Sentinel'`,
  `heroes: ['Spider-Man', 'Hulk', 'Wolverine']`,
  `artUrl: 'https://images.legendary-arena.com/core/core-mm-magneto.webp'`.
- **Player name:** `'Player'` (the Play Again precedent; the auth store carries no handle).
- **Copy:** eyebrow `Featured table`; heading `The Arena Awaits`; encounter line
  `Magneto and the Brotherhood are robbing Midtown Bank.`; roster line
  `Spider-Man, Hulk, and Wolverine answer the call.`; primary button `Enter Arena`
  (while creating: `Entering…`, disabled); signed-out helper
  `Sign in to take your seat. Your account is free.`; workshop link `Arena Workshop` with helper
  `Loadouts, bot allies, watching bots, and joining by match ID.`; art `alt`: `Magneto`.
- **Latch:** `isEntering` blocks a second click. On `ok: true` it stays set (the page is navigating).
  On `ok: false` it clears and `result.message` shows in `arena-enter-error`.
- **Test ids:** `arena-entrance` (root), `arena-enter`, `arena-enter-error`, `arena-workshop-link`,
  `arena-featured-art`.
- **Routing:** `ParsedQuery` gains `workshopRoute: boolean` (`routeParam === 'workshop' || routeParam === 'lobby'`,
  following the `meRoute` / `loginRoute` sibling naming) and `hasMatchParam: boolean`
  (`readQueryParam(params, 'match') !== null`, so an empty `?match=` counts as absent). Setup returns
  `showWorkshop = parsed.workshopRoute || parsed.hasMatchParam`. The template's final `v-else` becomes
  `<template v-else-if="showWorkshop"><LobbyView /></template><template v-else><ArenaEntrance /></template>`;
  `ArenaEntrance` is imported eagerly and added to `components`. `AppRoute` is unchanged.
- **Stage colour:** the stage is dark in both themes. Its root declares `--arena-stage-bg: #0b0f19`,
  `--arena-stage-text: #f5f7fb`, and `--arena-stage-accent: #d4af37` (the brand dark values) with a CSS
  `/* why: */` comment; the button uses `var(--la-color-cta)`.

## Scope (In)

- `src/lobby/featuredTable.ts` [new] — `FEATURED_TABLE`, `FEATURED_PLAYER_COUNT`,
  `FEATURED_TABLE_LABELS`. JSDoc on each export.
- `src/lobby/featuredTable.test.ts` [new] — exactly 5 `test()` calls. Reads `data/cards/core.json` via
  `new URL('../../../../data/cards/core.json', import.meta.url)` + `node:fs` (precedent
  `src/replay/loadReplay.test.ts`; no registry import) and asserts: (1) every id's slug exists in its
  category; (2) the mastermind's `alwaysLeads` slugs ⊆ the `villainGroupIds` slugs (strip `core/`);
  (3) the counts are 1 villain group / 1 henchman group / 3 heroes, with a `// why:` naming
  `PLAYER_COUNT_SETUP[1]` (D-24165) as the pinned source (live create's `validateSetupData` stays the
  authoritative legality check); (4) each label equals the card data's `name`; (5) the art URL equals
  the `imageUrl` of Magneto's base card (the `cards[]` entry named `Magneto`).
- `src/lobby/ArenaEntrance.vue` [new] — the stage, copy, art, Enter Arena (→
  `launchMatchFromComposition({ config: FEATURED_TABLE, playerCount: FEATURED_PLAYER_COUNT,
  playerName: 'Player', authToken })`, or `window.location.search = '?route=login'` when
  `token === null`), the latch, the error line, the workshop link.
- `src/lobby/ArenaEntrance.test.ts` [new] — exactly 7 tests: (1) renders heading, encounter, roster,
  and art `alt="Magneto"`; (2) no request on mount; (3) signed out → a click sends no request, shows no
  error, and leaves the button enabled; (4) signed in → one `POST /api/match/create` with the featured
  `setupData` and `numPlayers: 1`, then one join for seat `'0'` with `playerName: 'Player'`; (5) a
  create failure shows `arena-enter-error` and re-enables the button; (6) a second click while entering
  makes no second create; (7) the workshop link's `href` is `?route=workshop`.
- `src/App.vue` — the `workshopRoute` / `hasMatchParam` parse, `showWorkshop`, and the template branch.
- `src/client/bgioClient.test.ts` — the empty-query test now asserts `arena-entrance` exists and
  `lobby-view` does not (data-route still `'lobby'`); **+2 tests**: `?route=workshop` → `lobby-view`,
  and `?route=lobby` → `lobby-view` (pins the alias; the unchanged partial-params test already
  covers `?match=` alone). The partial-params test is unchanged.
- `src/lobby/LobbyView.vue` — `<h1>` text `Legendary Arena — Lobby` → `Arena Workshop`. Nothing else.

## Out of Scope

- A guest-playable featured table (WP-787 server; a client adoption WP after it).
- Bot-ally or multi-seat featured tables, a rotating featured source, a featured endpoint.
- The battle brief (WP-786), named bot seats, Watch-as-a-table, Resume, empty-state rewrite,
  loadout preview (priorities 3–7).
- Webfont loading, `index.html`, header navigation, LoginPage `returnTo`, `LobbyView` layout or copy
  beyond the `<h1>`, and raw server text inside the launcher's error message (LobbyView parity).

## Files Expected to Change

- `apps/arena-client/src/lobby/featuredTable.ts` — **new** (featured composition, player count, labels)
- `apps/arena-client/src/lobby/featuredTable.test.ts` — **new** (5 core.json legality pins)
- `apps/arena-client/src/lobby/ArenaEntrance.vue` — **new** (entrance stage + Enter Arena launch)
- `apps/arena-client/src/lobby/ArenaEntrance.test.ts` — **new** (7 tests)
- `apps/arena-client/src/App.vue` — **modified** (`workshopRoute` / `hasMatchParam` parse + lobby-route branch)
- `apps/arena-client/src/client/bgioClient.test.ts` — **modified** (empty-query retarget + 2 routing tests)
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** (`<h1>` only)
- Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24633 → Active),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`.

No other files may be modified.

## Contract

- The bare landing URL renders `ArenaEntrance`. `?route=workshop`, `?route=lobby`, or any non-empty
  `?match=` without full live params renders `LobbyView`.
- Enter Arena creates exactly the featured table at 1 player through the existing launcher, and
  never through a new endpoint.
- Every `LobbyView` control, id, and `data-testid` survives.

## Acceptance Criteria

1. The empty query renders `[data-testid="arena-entrance"]` and not `[data-testid="lobby-view"]`.
2. `?route=workshop` and `?route=lobby` render `lobby-view`.
3. `featuredTable.test.ts` passes its five data assertions against `data/cards/core.json`.
4. Signed in, one click sends one create with `numPlayers: 1` and the locked composition, then joins
   seat `'0'` with `playerName: 'Player'`.
5. Signed out, a click sends no request (navigation to `?route=login` is covered by the live verify).
6. A failed create shows the launcher's message in `arena-enter-error`; the button re-enables.
7. A double click creates one match.
8. The entrance sends no request on mount.
9. vue-tsc exits 0; `LobbyView.test.ts` and `App.test.ts` pass unchanged; the suite has 0 failures.

## Verification Steps

```pwsh
pnpm --filter "@legendary-arena/arena-client^..." build
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0 (Before AND After)
pnpm --filter @legendary-arena/arena-client test
# Expected: 2175 -> 2189 tests / 0 fail (ArenaEntrance 7, featuredTable 5, bgioClient +2)
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All acceptance criteria pass. vue-tsc exits 0. Suite counts recorded before and after.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED, post-deploy):** open `play.legendary-arena.com/` signed in →
      the entrance renders dark in both themes → Enter Arena → a solo match opens with Magneto,
      Brotherhood, Sentinel, Midtown Bank Robbery, and Spider-Man / Hulk / Wolverine in the HQ deck.
      Signed out → the login page. `?route=workshop` → the full old lobby. Record the matchId in STATUS.md.
- [ ] `docs/ai/DECISIONS.md` D-24633 flipped to Active.
- [ ] `docs/ai/STATUS.md` updated. WORK_INDEX WP-785 `[x]` with date. EC_INDEX EC-822 → Done.
      Mindmap `📝`→`✅`. `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:** The Fantasy (the encounter leads), §1 Rules Authenticity (the featured table
  honors Always Leads, pinned by test), §2 Content Authenticity (real card art from R2), §17
  Accessibility (real `<button>`, `alt` on the art, visible error text), Access Model (sign-in bounce
  unchanged; D-24633 §4 records the guest-solo gap for WP-787). NG-1 / NG-4 / NG-6 not crossed: no
  timers, no urgency copy, no purchase surface.
- **Conflict assertion:** No conflict introduced.
- **Determinism preservation:** N/A. Client-only; the match is created through the existing path.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 structure:** every required section is present. Baseline `origin/main` @ `da4d3a2c`.
- **§2 constraints:** engine-wide, packet-specific, session protocol (stop-and-ask + launcher-shape
  STOP), and locked values; 01.5 NOT INVOKED.
- **§3 / §4:** WP-092/254/371/369/160 cited with file anchors; Context cites 00.2 §7, ARCHITECTURE
  §Layer Boundary + `.claude/rules/architecture.md`, and D-24092 / D-24032 / D-24165 / D-6512.
- **§5 / §7:** a 7-file allowlist (4 new) plus governance, each with a one-line description. No new deps.
- **§6 naming:** 00.2 §7 composition field names verbatim; `hasMatchParam` / `isEntering` follow
  is/has; `workshopRoute` follows the ParsedQuery sibling convention.
- **§8 layer:** arena-client only; no runtime `@legendary-arena/registry` import; `MatchConfiguration`
  type-only from the engine; creates only through the existing launcher.
- **§9 Windows:** `pwsh` verification. **§10:** N/A — no env vars. **§11:** N/A — consumes the existing
  WP-160 bearer and sign-in bounce unchanged.
- **§12 tests:** `node:test` + vue-sfc-loader; fetch stubbed, no network or DB; featuredTable reads the
  local `data/cards/core.json`; negatives (signed out and double click send no create).
- **§13 / §14 / §15:** exact commands with 2175 → 2189 expected; 9 binary ACs; DoD with D-24026 live
  verify, the D-24633 flip, and a `git status` scope check.
- **§16 code style:** JSDoc on every function, no nested ternary, full-word names, `// why:` on the
  stage colours, the Always Leads pin, the lobby alias, and the `'Player'` name.
- **§17 Vision:** present (The Fantasy, §1, §2, §17, Access Model; NG-1/4/6 not crossed). **§18:** N/A —
  no grep-based verification. **§19:** N/A (commit-time).
- **§20 Funding:** N/A — the only CTA is Enter Arena plus a sign-in helper; no donate or support copy,
  no nav funding affordance.
- **§21 API Catalog:** N/A — client-only; calls the existing `/api/match/create` and `/api/match/join`
  unchanged; no `apps/server` endpoint or `Library-only` function touched.

## Gate Verdicts

- **Pre-flight (01.4): READY TO EXECUTE** after doc fixes. Baseline observed at `da4d3a2c`: arena-client
  2175 / 360 suites / 0 fail, vue-tsc 0, roadmap / WORK_INDEX checks 0. PS-1 (no parse field for a
  `match` param → `hasMatchParam` + `showWorkshop` locked), PS-2 (jsdom cannot observe `location.search`
  → test 3 and AC5 assert no request), PS-3 (`#f5f1e6` was not a brand value → `#f5f7fb`) applied.
  RS items applied: the latch on success/failure, the art `alt`, featuredTable mechanics (slug compare,
  `import.meta.url` path, the D-24165 `// why:`), 2175 → 2189, 01.5 NOT INVOKED, App.test.ts unchanged,
  and the navigation side effects in User-Visible Impact.
- **Copilot (01.7): RISK → HOLD → fixes applied** (#4 EC compression, #11 unobservable test, #12, #16,
  #22 latch, #26, #27, #30). **Re-run 2026-09-28: RISK → HOLD** (#11 the `route=lobby` alias was not
  pinned → the bgioClient test now uses bare `?route=lobby`; #4 EC Routing / Latch now verbatim;
  `route` → `routeParam` in the parse lock) **→ applied → PASS.** Pre-flight delta: READY stands.
- **Lint (00.3): PASS** after the §4 citations and §5 descriptions were added.
