# WP-786 — Battle brief: read the table its setup, then one Begin the Battle starts the match

**Status:** Draft 2026-09-28 · **EC:** EC-823 · **Reserves:** D-24634
**Primary Layer:** Arena Client (App)
**User-Visible Surface:** play.legendary-arena.com (the live play route, `lobby` phase)
**Lane:** standard two-session. Not lightweight: it locks where the brief sits and what it reads
(D-24634), and adds a mounted overlay to the shared viewport root.
**Baseline:** `origin/main` @ `da4d3a2c` (2026-09-28)
**Independent of WP-785** (either may execute first).

## Goal

Every match opens on the play route in the engine's `lobby` phase. The board is hidden, and the
only thing on screen is three bare buttons (Mark Ready / Mark Not Ready / Start Match). Replace that
first moment with a **battle brief**: the Mastermind with its portrait and Always Leads line, the
Scheme with its Setup and Evil Wins lines, the villain groups, henchman groups, and hero lineup by
name, the seat count, and one maroon **Begin the Battle** button that readies the player and starts the
match. This is priority 2 of the ewiki
[Play Lobby UX Direction](../../../wiki/play-lobby-ux-direction.md).

## User-Visible Impact

- Solo or bot-ally match: the brief appears on arrival. One click on Begin the Battle starts play
  (today: Mark Ready, then Start Match).
- Multi-human match: each player's Begin the Battle marks them ready and asks to start; the match
  starts when the last seat enters. Until then the brief reads "Waiting for the rest of the table…".
- "Hide brief" collapses it to a small "Show battle brief" button; the existing lobby controls
  remain underneath, unchanged. They are also the recovery path when a multi-human start stalls
  (for example, a seat that pressed Mark Ready but never pressed Begin the Battle, or a seat whose
  ready was dropped because another seat's move landed first — the server rejects the stale
  `_stateID`, and `G.lobby` is not projected, so the brief cannot see it): Hide brief → Mark Ready /
  Start Match.

## Assumes

- **Engine lobby phase** (`packages/game-engine/src/game.ts`, `lobby/lobby.moves.ts`): `MATCH_PHASES`
  starts at `lobby` with `activePlayers: { all: 'lobbyReady' }`. `setPlayerReady({ ready })` writes
  `G.lobby.ready[playerID]` for the **dispatching** player (D-10010). `startMatchIfReady({})`
  no-ops until every seat is ready, then `setPhase('play')`. Bot-ally seats are auto-readied by
  the server driver; nothing sends `startMatchIfReady` for them.
- **Both lobby moves are `client: false`** (`game.ts` lobby `moves`, D-10008). The client reducer
  does not apply them, so the local `_stateID` advances only when a server frame arrives. A second
  move sent in the same tick carries the same stale `_stateID`, and the server's `master.onUpdate`
  drops it ("invalid stateID"). `useConnectionStore().lastStateId` (`src/stores/connection.ts`) is
  set on every frame by `src/client/bgioClient.ts` (the D-24097 watchdog comment there).
- **UIState is projected in the lobby phase** (`playerView` has no phase gate; `G` is built at
  `Game.setup`). Fields used (`packages/game-engine/src/ui/uiState.types.ts`):
  `game.phase`; `mastermind.display.{name,imageUrl}`; `mastermind.gameText?` (Magneto's first line
  is `Always Leads: Brotherhood`; all 111 masterminds carry an `Always Leads` line);
  `scheme.display?` (**optional**) `.{name,imageUrl}`; `scheme.gameText?` (e.g. `Setup: 8 Twists. …`,
  `Evil Wins: …`; 28 of 200 schemes phrase the loss as `Twist N: Evil Wins!`, and 22 carry no Evil
  Wins line, which is then omitted); `players[]` (one
  entry per seat). `uiState.filter.ts` passes all of these through for every audience.
- **Public match LAGN** — `GET /api/match/:matchId/lagn` is `guest` in
  `docs/ai/REFERENCE/api-endpoints.md` (D-24446), reads the match's initial state, so it answers from
  creation. Client helpers: `fetchMatchLagn(matchId, token | null)` (`src/lib/api/matchLagnApi.ts`,
  never throws) and `summarizeLoadout(lagn)` (`src/lib/loadoutSummary.ts`) →
  `{ mastermind, scheme, villainGroups[], henchmanGroups[], heroes[], … }` by display name.
- **Overlay precedent** — `PlayViewport.vue` mounts shared overlays once at the viewport root
  (`WaitingForPlayersPanel` bottom-right and `BattlePlanPanel` top-right, both `z-index: 9999`;
  ViewLoadout / Diagnostic bottom-left), reading state from `useUiStateStore().snapshot`.
  `PlayViewport` holds the `submitMove` prop (`SubmitMove`, `components/play/uiMoveName.types.ts`)
  and a `matchId` prop (App.vue passes the live `matchID`; the fixture route passes `''`).
- **Bot-ally seats are readied by the server before it responds**
  (`apps/server/src/bot-ally/botAllyRoutes.mjs`); nothing server-side sends `startMatchIfReady`.
- **`AbilityText.vue`** renders any `gameText` line (the Board-Visible Field Rule corollary: raw
  marker syntax is never shown to a player).
- vue-tsc and the arena-client suite are green on `origin/main`.

## Context (Read First)

- ewiki [Play Lobby UX Direction](../../../wiki/play-lobby-ux-direction.md) §Interactions: the brief
  is an **engine-derived setup read-out**, distinct from the player-written Battle Plan (WP-635/637).
  The Battle Plan panel stays as it is; the brief does not embed it.
- `apps/arena-client/src/components/play/LobbyControls.vue` — the three buttons; **unchanged**.
- **Why an overlay at the viewport root, not an edit to PlayDesktop / PlayMobile.** One mount covers
  both surfaces (the WP-369 / WP-637 precedent). `PlayMobile` does not receive `matchId` (D-16501).
  An uncommitted local branch in the canonical checkout (`infra/endgame-readonly-board`) is editing
  `PlayDesktop.vue` / `PlayMobile.vue`, and this WP stays clear of both.
- **Why no new UIState field.** Every field read already exists. Group and hero names come from the
  public LAGN, not a new projection, so the Board-Visible Field Rule's five-step contract
  (`.claude/rules/architecture.md` §UIState Projection Integrity) is not triggered.
- **Why the start waits for a frame.** See the `client: false` Assumes bullet: sending both moves in
  one tick silently drops the start. The pre-flight caught this; a mock `submitMove` test would not.
- **Why "Begin the Battle", not "Enter Arena".** The WP-785 entrance's button is Enter Arena; a solo
  player would otherwise press two identically named buttons in a row.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary + `.claude/rules/architecture.md` (arena-client import row):
  client-only, intents only.
- **DECISIONS scan:** D-10008 (`client: false` lobby moves), D-10010 (ready by dispatching player),
  D-16501 (PlayMobile has no `matchId`), D-24446 (public match LAGN), D-24097 (frame watchdog /
  `lastStateId`). Source files: `src/client/bgioClient.ts`, `src/stores/connection.ts`.
- **Autoplay (Watch Bot Play)** readies and starts on the server within seconds; the brief may show
  briefly and disappears when the phase leaves `lobby`. No special case.
- `twistCount` is twists **resolved so far**, not the setup total. The brief shows the scheme's
  `Setup:` line instead.

## Non-Negotiable Constraints

**Engine-wide (do not remove):** ESM only, Node v22+, `node:` prefix. Vue SFCs compile via
`vue-sfc-loader` (test-only devDep). Full file contents, no diffs. Human-style code per
`docs/ai/REFERENCE/00.6-code-style.md` (no nested ternaries, full-word names, JSDoc on every function).

**Packet-specific:**
- Client-only: no `packages/**`, no `apps/server/**`, no new UIState field, no new move.
- The brief never writes `G`, `ctx`, or UIState. Its only move calls are `setPlayerReady` and
  `startMatchIfReady`, both already registered in `UiMoveName`.
- Every `gameText` line goes through `AbilityText.vue`. No raw marker text.
- A failed LAGN fetch never blocks Begin the Battle.
- The brief never obscures the invite (`WaitingForPlayersPanel`) or Battle Plan overlays.
- 01.5 is NOT INVOKED: `PlayViewport.vue` is an allowlisted file changed for its own mount.
- `LobbyControls.vue`, `PlayDesktop.vue`, `PlayMobile.vue`, and `BattlePlanPanel.vue` are unchanged.
- vue-tsc is gated **Before** and **After**.

**Session protocol:** if `setPlayerReady` / `startMatchIfReady` signatures, their `client: false`
flag, `useConnectionStore().lastStateId`, or `summarizeLoadout`'s field names differ from Assumes,
STOP. Stop and ask on any item not locked here.

## Locked Contract Values

- **Props:** `{ submitMove: SubmitMove, matchId: string }`; PlayViewport passes `:match-id="matchId"`.
- **Render gate:** the brief renders only when `snapshot !== null && snapshot.game.phase === 'lobby'`.
- **Begin the Battle** (`data-testid="battle-brief-enter"`): if `hasEntered`, return. Set
  `hasEntered = true` (the button disables and reads `Beginning…`). Send
  `submitMove('setPlayerReady', { ready: true })`, capturing `connectionStore.lastStateId` at the click.
  A non-immediate `watch` on the getter `() => connectionStore.lastStateId` sends
  `submitMove('startMatchIfReady', {})` exactly once, on the first change to a number strictly greater
  than the captured value. Never send both in the same tick.
- **Waiting line:** `Waiting for the rest of the table…` (`data-testid="battle-brief-waiting"`) shows
  once `hasEntered` and `players.length > 1`.
- **Game-text lines:** an undefined `gameText` is treated as no lines. Always Leads = the first
  `mastermind.gameText` entry that starts with `Always Leads`. Setup = the first
  `scheme.gameText` entry starting with `Setup:`. Evil Wins = the first entry starting with
  `Evil Wins:`, else the first entry matching `/evil wins/i` (served text, verbatim). A missing line
  is omitted; nothing is composed in its place. Every line renders through `AbilityText` (`text` prop).
- **Scheme display:** name and art render only when `scheme.display` is present; otherwise the Scheme
  section shows only its game-text lines.
- **Seats line:** `1 seat at the table` when `players.length === 1`, else
  `${players.length} seats at the table`.
- **Lineup:** when `matchId !== ''`, a `watch` on the getter `() => snapshot.value?.game.phase`
  (`snapshot` = `computed(() => useUiStateStore().snapshot)`)
  (`immediate: true`) calls
  `fetchMatchLagn(matchId, authStore.token)` the first time the phase is `'lobby'`; at most once per
  mount; no fetch in any other phase. On `ok`, `summarizeLoadout(lagn)` fills Villain groups /
  Henchmen / Heroes (comma-joined names). On failure, or when `matchId === ''`, the line
  `The lineup could not be loaded. It will appear on the board.`
  (`data-testid="battle-brief-lineup-unavailable"`).
- **Copy:** heading `Battle Brief`; subheading `Read the table its setup, then begin together.`;
  section labels `Mastermind`, `Scheme`, `Villain groups`, `Henchmen`, `Heroes`; primary
  `Begin the Battle`; secondary `Hide brief` → collapsed button `Show battle brief`
  (`data-testid="battle-brief-show"`).
- **Layout:** a centered panel at `z-index: 100` (below the 9999 corner overlays), never covering the
  top-right, bottom-right, or bottom-left corner lanes; the collapsed `Show battle brief` button sits
  top-center.
- **Test ids:** `battle-brief` (root), `battle-brief-mastermind`, `battle-brief-scheme`,
  `battle-brief-lineup`, `battle-brief-seats`, plus those above.
- **Colour:** the Begin the Battle button uses `var(--la-color-cta)`; headings use
  `var(--la-color-gold)`; the panel uses `var(--la-color-surface)` / `var(--la-color-text-primary)`
  (theme-following).
- **Mockup (illustrative, not normative):** the ewiki Play Lobby UX Direction page carries a rendered
  mockup; where it differs from these values, these values win.

## Scope (In)

- `src/components/play/BattleBrief.vue` [new] — props `{ submitMove, matchId }`; reads
  `useUiStateStore().snapshot`, `useAuthStore().token`, `useConnectionStore().lastStateId`; helpers
  `findLineStartingWith(lines, prefix)` and `formatSeatsLine(count)` with JSDoc; `isHidden` and
  `hasEntered` refs.
- `src/components/play/BattleBrief.test.ts` [new] — `globalThis.fetch` stubbed (restored after each
  test); no network. Exactly 9 tests: (1) phase `play` → renders
  nothing and makes no fetch; (2) lobby phase → Mastermind name, Always Leads line, Scheme name,
  Setup and Evil Wins lines; (3) missing Always Leads, an absent `scheme.display`, and a
  `Twist N: Evil Wins!` scheme → no empty row, no scheme name, the `/evil wins/i` line shown;
  (4) LAGN ok → villain groups, henchmen, heroes by name; (5) LAGN 500 → the unavailable line, and
  Begin the Battle still enabled; (6) seed `setConnected(true, 7)`; click Begin the Battle → exactly one call,
  `setPlayerReady { ready: true }`; then `setConnected(true, 8)` + `nextTick` → exactly one more call,
  `startMatchIfReady {}` (two calls, in that order); (7) a second click and a further
  `setConnected(true, 9)` send nothing more; (8) 2 players → the waiting line after
  entry, 1 player → no waiting line; (9) Hide brief → only `battle-brief-show`; clicking it restores
  the brief.
- `src/pages/PlayViewport.vue` [allowlisted; 01.5 NOT INVOKED] — import + one
  `<BattleBrief :submit-move="submitMove" :match-id="matchId" />` beside `<BattlePlanPanel />`, with a
  `// why:` comment.

## Out of Scope

- Removing or restyling `LobbyControls`; any change to `PlayDesktop` / `PlayMobile`.
- Embedding or editing the Battle Plan; hero "jobs", threat prose, or any composed rule text.
- A structured `alwaysLeads` or setup-twist-total UIState field (engine WP if ever wanted).
- Suppressing the brief for autoplay; a ready-state indicator per seat (`G.lobby` is not projected).
- The entrance (WP-785) and priorities 3–7.

## Files Expected to Change

- `apps/arena-client/src/components/play/BattleBrief.vue` — **new** (the lobby-phase brief overlay)
- `apps/arena-client/src/components/play/BattleBrief.test.ts` — **new** (9 tests)
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** (one import + one mount)
- Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24634 → Active),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`.

No other files may be modified.

## Contract

- In the `lobby` phase the brief shows the served Mastermind / Scheme display and game text, the
  public-LAGN lineup, and the seat count. It sends only `setPlayerReady { ready: true }`, then, after
  the next server frame advances `lastStateId`, `startMatchIfReady {}`.
- Outside the `lobby` phase it renders nothing.

## Acceptance Criteria

1. Phase `play` or a null snapshot → no `battle-brief` element.
2. Lobby phase → Mastermind and Scheme names, the Always Leads, Setup, and Evil Wins lines rendered
   through `AbilityText`.
3. A missing game-text line leaves no empty row.
4. A successful LAGN fetch lists villain groups, henchmen, and heroes by display name.
5. A failed LAGN fetch shows the unavailable line and leaves Begin the Battle enabled.
6. Begin the Battle sends `setPlayerReady { ready: true }` immediately and `startMatchIfReady {}` only
   after the first `lastStateId` strictly greater than the value captured at the click; never both in one
   tick; once per mount.
7. With more than one seat, the waiting line shows after entry; with one seat it does not.
8. Hide / Show toggles the brief without a move.
9. vue-tsc exits 0; `PlayViewport.test.ts` and the rest of the suite pass unchanged.

## Verification Steps

```pwsh
pnpm --filter "@legendary-arena/arena-client^..." build
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0 (Before AND After)
pnpm --filter @legendary-arena/arena-client test
# Expected: 2175 -> 2184 tests / 0 fail (baseline observed at da4d3a2c: 2175 / 360 suites / 0 fail);
#           BattleBrief.test.ts 9 / 0 fail; vue-tsc 0 before and after
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All acceptance criteria pass. vue-tsc exits 0. Suite counts recorded before and after.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED, post-deploy):** create a solo match → the brief shows
      Mastermind, Always Leads, Scheme Setup / Evil Wins, the lineup, and "1 seat at the table" →
      Begin the Battle → the board appears with no other click. Repeat once with a bot ally. Record both
      matchIds in STATUS.md.
- [ ] `docs/ai/DECISIONS.md` D-24634 flipped to Active.
- [ ] `docs/ai/STATUS.md` updated. WORK_INDEX WP-786 `[x]` with date. EC_INDEX EC-823 → Done.
      Mindmap `📝`→`✅`. `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:** The Fantasy (the table reads the scheme before the fight), §1 Rules
  Authenticity (served game text verbatim, no composed rules), §4 Faithful Multiplayer (every seat
  enters; the engine still decides when play starts), §17 Accessibility (buttons, headings, text
  lines). NG-1 / NG-4 / NG-6 not crossed: no timer, no urgency, no purchase surface.
- **Conflict assertion:** No conflict.
- **Determinism preservation:** N/A. Client renders served state and submits two existing moves.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 structure:** every required section is present. Baseline `origin/main` @ `da4d3a2c`.
- **§2 constraints:** engine-wide, packet-specific, session protocol (STOP on lobby-move signature /
  `client: false` / `lastStateId` / `summarizeLoadout` drift), and locked values; 01.5 NOT INVOKED.
- **§3 / §4:** prior work complete (WP-100 lobby phase, WP-311/312 connection store + watchdog,
  WP-361/363 match LAGN + `fetchMatchLagn`, WP-369/637 overlay precedent) with file + export anchors;
  Context cites ARCHITECTURE §Layer Boundary, `.claude/rules/architecture.md` §UIState Projection
  Integrity, and the DECISIONS scan (D-10008 / D-10010 / D-16501 / D-24446 / D-24097).
- **§5 / §7:** a 3-file allowlist (2 new) plus governance, each with a one-line description. No new deps.
- **§6 naming:** UIState field paths verbatim (`mastermind.display`, `scheme.display?`, `gameText?`,
  `game.phase`, `players`); `hasEntered` / `isHidden` follow is/has; `summarizeLoadout` names verbatim.
- **§8 layer:** arena-client only; no `packages/**` / `apps/server/**`; no new UIState field or move;
  intents only (`setPlayerReady`, `startMatchIfReady`); the engine still decides the phase change.
- **§9 Windows:** `pwsh` verification. **§10:** N/A — no env vars. **§11:** N/A — consumes the
  existing WP-160 bearer; the match LAGN read is `guest` (D-24446).
- **§12 tests:** `node:test` + vue-sfc-loader; `fetch` stubbed, no network or DB; negatives (play
  phase renders nothing and fetches nothing; a second click and a further frame send nothing).
- **§13 / §14 / §15:** exact commands with 2175 → 2184 expected; 9 binary ACs; DoD with D-24026 live
  verify (solo + bot ally), the D-24634 flip, and a `git status` scope check.
- **§16 code style:** JSDoc on every function, no nested ternary, full-word names, `// why:` on the
  frame gate, the viewport-root mount, the LAGN source, the `/evil wins/i` fallback, and the waiting line.
- **§17 Vision:** present (The Fantasy, §1, §4, §17; NG-1/4/6 not crossed; determinism N/A). **§18:** N/A —
  no grep-based verification. **§19:** N/A (commit-time).
- **§20 Funding:** N/A — the only CTA is Begin the Battle; no donate or support copy.
- **§21 API Catalog:** N/A — client-only; reads the existing `GET /api/match/:matchId/lagn` unchanged.

## Gate Verdicts

- **Pre-flight (01.4), run 1: DO NOT EXECUTE YET → fixes.** PS-1 (both lobby moves are `client: false`;
  a same-tick ready + start drops the start as a stale `_stateID` → the start is frame-gated on
  `lastStateId`), PS-2 (lineup fetch only in the lobby phase, once), PS-3 (`scheme.display` optional;
  undefined `gameText`). RS: layout / z-index, the `/evil wins/i` fallback, the recovery path, 01.5
  label, `matchId` prop, counts 2175 → 2184. Baseline observed: 2175 / 360 suites / 0 fail, vue-tsc 0.
- **Copilot (01.7), run 1: RISK → SUSPEND** (#4, #5, #11, #18, #22, #26, #30) until the PS fixes landed.
- **Re-gate (01.4 delta + 01.7 + 00.3), run 2: READY (conditional) / RISK → HOLD / PASS after fixes.**
  Fixes applied: the WORK_INDEX title; `watch` getters (a primitive watch source never reacts); the
  scheme-data count corrected (28 `Twist N: Evil Wins!`, 22 with no line); WP↔EC verbatim; test (6)/(7)
  seeded stateIds; the multi-human dropped-ready race documented (recovery: Hide brief → LobbyControls;
  no retries); `fetch` stubbing stated. Optional hardening taken: the start fires on the first
  `lastStateId` strictly greater than the value captured at the click.
- **Button rename:** the brief's button is **Begin the Battle** (the WP-785 entrance already uses Enter
  Arena), applied before run 2 and checked in it.
- **Run 3 (post-fix re-read): 01.4 READY TO EXECUTE; 01.7 PASS → CONFIRM; 00.3 PASS.** Two optional
  nits applied afterward (AC6 wording aligned to the strictly-greater gate; the `snapshot` computed named).
