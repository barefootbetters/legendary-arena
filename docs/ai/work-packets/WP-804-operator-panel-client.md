# WP-804 — Operator panel on the play surface: lobby option, reveal-all board panel, badge, no score submit

**Status:** Draft 2026-10-12 · **EC:** EC-841 · **Reserves:** none (reserve PR #2727, WP-804 / EC-841 only). Rulings sit
under D-24689 §5 / §6; the bot-decision turn fix is D-24697 (#2728).
**Primary Layer:** App (`apps/arena-client` only)
**User-Visible Surface:** play.legendary-arena.com:
- the lobby's bot-ally section shows an "Operator match" option, to admins only;
- an operator match shows a public "Operator match — not scored" badge to every seat;
- an admin in an operator match gets a collapsible board panel with every zone, deck order, supplies, counters, effect
  traces and the bot's decisions, plus two downloads;
- at game over the client says the match isn't scored instead of submitting.
**Lane:** standard two-session. Ineligible for the lightweight lane: 15 code files (01.0a criterion 2), and the packet
touches the score-submission surface (criterion 6).
**Baseline:** `origin/main` @ `30a27c1f` (2026-10-12; the reserve merge #2727, after #2728 / D-24697)

## Goal

Make WP-802's operator match usable from the play client:
- An admin ticks "Operator match" in the lobby's bot-ally section and gets an operator match through the normal join
  flow.
- In that match the admin opens a panel beside the play mat that refreshes the whole board from
  `GET /api/admin/operator-match/:matchId/board`.
- Every seat sees that the match is an operator match.
- The client never submits a score for it.

This is follow-on 1 of the WP-802 arc (`docs/ai/work-packets/WP-802-operator-board-inspection.md` §Arc). D-24689 §6
fixes its form: a lazy Vue 3 SFC, loaded only in an operator match for an admin, with no new dependency.

## User-Visible Impact

- **Today.** WP-802 shipped and was live-verified on operator match `3pNYCKHKJCE`. Even so:
  - an operator match can only be created with `Invoke-RestMethod` and a pasted admin token;
  - the board comes back as raw JSON;
  - the game-over submit hits the server's 422 `debug_match` and shows as a failed submit.
- **After this packet:**
  - Jeff ticks one box in the lobby.
  - During the game the panel shows both seats' hand and discard Wounds (the D-24684 question).
  - It shows the villain deck in order, so Jeff can see which card comes next.
  - It shows each bot decision on the game log's turn scale (D-24697). A forced singleton shows as forced with one legal
    move (the D-24688 class).
  - "Download operator snapshot" saves the board and decisions as JSON. D-24689 §5 assigns that record to this packet.
  - "Download as fixture" saves the current play-surface UIState in the shape of `src/fixtures/uiState/*.json`.
- **Business impact:** live verification of a card fix becomes one game, not several. Today's live-verify backlog (the
  `partial` and `pending` rows in `docs/ai/coverage/live-verify.json`) is what this shortens.

## Assumes

- **Dependencies (shipped):**
  - WP-802 / EC-839 / D-24689: #2699, live-verified in #2712 and #2721.
  - D-24691: #2694.
  - D-24697: #2728. Bot decisions carry the turn the board and game log show.

  D-24689 §5 and §6 assign this packet the panel, the snapshot download and skipping the submit.
- **The server routes.** All are `admin-session-required` and `Cache-Control: no-store`. This packet changes none of
  them.
  - `GET /api/admin/operator-match/eligibility` → `200 { isOperator: true }`. A non-admin gets 403 `{ code, reason }`; no
    session gets 401 (`apps/server/src/operator/operatorMatch.routes.ts` L176–184, admin check L89–114).
  - `POST /api/admin/operator-match/create-with-bot` takes the same body as `/api/match/create-with-bot` (`{ numPlayers,
    botCount, policy, setupData }`) and returns `200 { matchId }`. The match is unlisted, and the server never joins seat
    0 (`bot-ally/botAllyRoutes.mjs` L830–857, L646–650).
  - `GET /api/admin/operator-match/:matchId/board` → `200 { matchId, operatorView, botDecisions }`, or 404 / 409 / 500
    (`respondWithOperatorBoard`, `operatorMatch.routes.ts` L122–164).
  - Since D-24697, each `botDecisions[].turn` is the engine's display turn, `buildUIState(...).game.turn`: the number the
    HUD and the game log use (`botAllyRoutes.mjs` `recordIfOperatorMatch`). The client shows it as-is.
  - CORS is global (`@koa/cors` via boardgame.io `Server({ origins })`, `apps/server/src/server.mjs` L788–845), and
    `https://play.legendary-arena.com` is allowed.
- **Types.**
  - `OperatorView`, `OperatorSeatView`, `OperatorWoundsByZone`, `OperatorSupplyCounts` and `OperatorBuildContext` are
    type exports of `@legendary-arena/game-engine` (`index.ts` L473–481).
  - The arena-client already depends on the engine (`workspace:*`) and type-imports `MatchConfiguration` from its `.`
    surface (`lobby/lobbyApi.ts` L12).
  - `OperatorBotDecision` is **not** exported (`apps/server/src/operator/operatorBotDecisions.ts` L20–27). The client
    declares the wire shape inline, as `adminBillingApi.ts` does (L7–10).
  - `OperatorView.cardDisplay` omits ids that have no display entry (`operatorView.build.ts` L96–122).
  - `UIState.isDebugMatch?: boolean` is present only when true (`uiState.types.ts` L362–366) and reaches every audience.
- **Client facts** (`apps/arena-client/src`):
  - **API calls.** There is no shared authed-fetch helper. Each API function takes `authToken` and sets `Authorization:
    Bearer …` itself.
    - `lobby/lobbyApi.ts` `createMatchWithBot` (L97–131) uses `serverUrl` (`VITE_SERVER_URL`).
    - `lib/api/apiBaseUrl.ts` `buildApiUrl(path)` (L32–46, `VITE_API_BASE_URL`) is what the `lib/api/*` modules use, and
      it does not encode path segments.
    - The token is `useAuthStore().token` (`stores/auth.ts`).
  - **Lobby.** `LobbyView.vue` `createWithBotAlly()` (L426–510) calls `createMatchWithBot`, then `joinMatch(…, '0', …)`,
    then navigates. The section is `data-testid="lobby-bot-ally"` (L1230–1271). SFCs use `defineComponent({ setup })`
    (D-6512).
  - **Play.**
    - `pages/PlayViewport.vue` gets `matchId` as a prop (`''` on the fixture route) and reads
      `useUiStateStore().snapshot`.
    - Overlay siblings sit at L552–690, with `<HollowEffectsPanel/>` at L613.
    - `PlayViewport` is a static import in `App.vue` (L15), so it ships in the entry chunk.
    - `SUBMISSION_MESSAGES` (L64) is `Record<Exclude<SubmissionStatus, 'idle'>, string>`.
    - `computeCasualCoachMatchId` (L100–114) returns null for anything but `'ineligible'`.
  - **Score submit.**
    - `composables/useCompetitiveSubmitOnGameover.ts` `submitOnce` skips `endedEarly` at L250–262: it latches
      `hasSubmitted = true`, sets `submittedForMatch`, sets status `'ended-early'` and returns, before the guest/token
      check. The union is at L63–72.
    - Today a 422 `debug_match` falls through to `'failed'` (L214–230).
    - `components/play/EndgameActions.vue` takes `statusVariant` as a plain `String` prop (L67–71). It styles
      `endgame-actions__status--<status>`, and `--ineligible` / `--ended-early` share the neutral rule (L217–221).
  - **The one exhaustive test map.** `pages/PlayViewport.test.ts` L125–147 has `EXPECTED_BY_STATUS:
    Record<SubmissionStatus, string | null>` and asserts `Object.keys(EXPECTED_BY_STATUS).length === 9`. A new status is
    a `vue-tsc` error there until a row is added (`tsconfig.json` includes `src/**/*`). No other exhaustive switch over
    `SubmissionStatus` exists.
  - **Downloads.** `lib/downloadTextFile.ts` `downloadTextFile(fileName, text, mimeType)` (L26–45);
    `diagnostics/diagnostics.ts` `buildDiagnosticFileName` (L657–664).
  - **Polling precedent.** `composables/useBotAllyStatus.ts` uses a self-scheduling `setTimeout` chain with `.unref()`,
    retries quietly after a failure, and stops in `onUnmounted` (L34, L72–151).
  - **Fixtures** are a closed set (`fixtures/uiState/index.ts` union + switch, `typed.ts` static imports), loaded
    DEV-only by `main.ts` L34–43.
  - **Theme tokens:** `--la-color-surface`, `--la-color-text-primary` / `-secondary` / `-muted`,
    `--la-color-border-subtle` / `-strong` and `--la-color-gold`, with dark overrides under `html[data-theme="dark"]`.
    `BattleBrief.vue` is the theme-aware precedent.
  - **Tests:** `node:test` + `@vue/test-utils` + jsdom (`import '../../testing/jsdom-setup'`), e.g.
    `components/play/HollowEffectsPanel.test.ts`.
    - Every `LobbyView.test.ts` fetch stub ends in a catch-all returning `200 { matches }`, so a probe resolves to "not
      an operator" there.
    - No test counts fetch calls.
    - `PlayViewport.test.ts` sets no token.
  - **Built chunks.** Vue keeps `data-testid` literals in built chunks: `dist/assets/AdminBillingPage-*.js` contains
    `admin-billing-loading`.
- **Suites at baseline** (worktree on `30a27c1f` after `pnpm install` + `pnpm -r build`): arena-client **2299 / 0**,
  `typecheck` exit 0. The draft ran no server tests: WP-804 changes no server file. Re-record everything at execution.
- **No new dependencies.**

## Context (Read First)

**Why no turn conversion.** The bot record used to carry the framework `ctx.turn`, one ahead of the game log after the
lobby turn. D-24697 (#2728) fixed that at the source, so the panel shows `turn` as the log does. This draft first carried
a client-side conversion with a game-over term. Pre-flight ran the real reducer and showed the term was wrong: at game
over the top-level `endIf` ends the match without a turn bump. That stale comment is at `uiState.build.ts` L665–673. The
fix in #2728 makes the whole conversion unnecessary.

**Why poll and not push.** The live match already reaches the client over the boardgame.io socket, but only as the
player's audience view. The reveal-all view travels only over the admin HTTP route (D-24689 §4). Polling every 3 seconds
while the panel is open is cheap and follows `useBotAllyStatus`. A collapsed panel doesn't poll.

**Why the eligibility probe, and where it runs.** The client has no `isAdmin`; the only admin signal is the eligibility
route's 200. Each probe costs the server an admin lookup, so the client probes only where the answer changes what's
shown:
- **the lobby:** once per visit for a signed-in user, to show or hide the option;
- **the play surface:** only when `snapshot.isDebugMatch === true`, so normal games never probe.
Anything but a 200 means "not an operator", silently.

**Read:**
- WP-802 in full, especially §Arc and §D-24689 Content. `docs/ai/DECISIONS.md` D-24689 (§3–§6), D-24697, D-24306,
  D-24026, D-6512.
- `docs/ai/ARCHITECTURE.md` §Package Import Rules (Hard Constraints) and §Layer Boundary (Authoritative). These cover
  the arena-client's type-only `.` engine imports.
- `docs/ai/ARCHITECTURE.md` §Persistence Boundary (Cross-Layer), the D-24689 §4 carve-out the board route reads under.
- `.claude/rules/architecture.md` §UIState Projection Integrity. Any surface rendering card text goes through
  `AbilityText.vue`; this panel renders names only.
- `docs/ai/REFERENCE/api-endpoints.md`: the three operator rows. Only the eligibility row's Notes change (§Scope E).

## Non-Negotiable Constraints

**Repo-wide (do not remove):**
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test`. SFCs use `defineComponent({ setup() { … } })`
  (D-6512), never `<script setup>`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`:
  - full-word names; booleans start with `is` / `has` / `can`;
  - JSDoc on every function; functions ~30 lines max;
  - no nested ternaries, no `import *`, no new barrel;
  - full-sentence error messages; `// why:` on every non-obvious rule.
- Output the **full file contents** for every modified file. No diffs, no snippets.
- No commit subject may contain a `.githooks/commit-msg` Rule 1 token (case-insensitive WIP, fix stuff, misc, tmp,
  updates, changes, debug). `isDebugMatch` and `debug_match` both trip it; write "operator match".

**Packet-specific:**
- The client never runs a rule and never edits state; the panel only reads the server's projection (Engine Owns Truth).
- The arena-client imports the operator types from `@legendary-arena/game-engine` as **types only**. Never `/setup`,
  never `registry` at runtime.
- No new dependency (D-24689 §6): no Tweakpane, no UI library.
- No server, engine, `UIState`, move or persistence change.
- The panel and its composable load only through `defineAsyncComponent` inside `PlayViewport.vue`, which uses the
  PascalCase tag `<OperatorBoardPanel>`. Normal play never downloads them.
- The lobby option and the panel appear only after the eligibility route returns 200.
- The public badge appears whenever `snapshot.isDebugMatch === true`, for every seat.
- The panel renders card **names** (`operatorView.cardDisplay`, raw id as fallback), never card text, so no marker syntax
  can reach the screen.
- Colors come from the `--la-color-*` tokens (day and night), never raw hex.

**Session protocol:** Read the EC, then this WP, then WP-802. Run the baseline suites and `typecheck` before editing.
STOP and report, without guessing, if:
- anything is unclear;
- a baseline differs from §Assumes;
- a file outside the allowlist would need to change.

## Locked Contract Values

- **Client API**, new `apps/arena-client/src/lib/api/operatorMatchApi.ts` (wire shapes declared inline):
  - `export interface OperatorBotDecisionWire { turn: number; seat: string; isForced: boolean; move: { name: string;
    args: unknown }; decisionLog: readonly string[]; legalMoveCount: number }`
  - `export interface OperatorBoardResponse { matchId: string; operatorView: OperatorView; botDecisions: readonly
    OperatorBotDecisionWire[] }`
  - `fetchOperatorEligibility(authToken: string): Promise<boolean>`
    - true only on HTTP 200 with `isOperator === true`;
    - every other status, a thrown fetch or bad JSON gives false;
    - never throws.
  - `createOperatorMatchWithBot(config: MatchConfiguration, seatCount: number, botCount: number, policy: 'competent' |
    'random', authToken: string): Promise<{ matchId: string }>`
    - posts to `/api/admin/operator-match/create-with-bot` with the same body as `createMatchWithBot`;
    - throws a full-sentence `Error` on non-2xx.
  - `fetchOperatorBoard(matchId: string, authToken: string): Promise<{ ok: true; value: OperatorBoardResponse } | { ok:
    false; status: number; error: string }>`
    - path `/api/admin/operator-match/${encodeURIComponent(matchId)}/board`;
    - never throws; a thrown fetch gives `status: 0`;
    - on a non-2xx, `error = body.error ?? body.reason ?? 'The operator board could not be loaded (HTTP <status>).'`.
      401 / 403 return `{ code, reason }`, and 404 / 409 / 500 return `{ error }` (`operatorMatch.routes.ts` L103–113).
  - URLs via `buildApiUrl` (`VITE_API_BASE_URL`, deliberately the `lib/api/*` convention rather than lobbyApi's
    `serverUrl`); `Authorization: Bearer <token>`.
- **Composables:**
  - `useOperatorEligibility(isEnabled: Ref<boolean>)` → `{ isOperator: Ref<boolean> }`
    - probes when `isEnabled.value === true` and `useAuthStore().token` is non-null;
    - re-probes when either changes;
    - resets to false when the token clears or `isEnabled` turns false;
    - keeps a generation counter that every probe start and reset increments. A response from a stale generation is
      dropped, so a 200 landing after a reset can't set `isOperator` true.
    - `LobbyView` passes `ref(true)`. `PlayViewport` passes `computed(() => snapshot.value?.isDebugMatch === true)`.
  - `useOperatorBoard(matchId: string, isExpanded: Ref<boolean>)` → `{ board: Ref<OperatorBoardResponse | null>,
    errorMessage: Ref<string | null>, refreshNow(): Promise<void> }`
    - polls every `OPERATOR_BOARD_POLL_MS = 3000` while `isExpanded.value === true` and a token exists;
    - a self-scheduling `setTimeout` chain with `.unref()` where present;
    - stopped when collapsed and on unmount;
    - a failed fetch keeps the last good `board` and sets `errorMessage`;
    - keeps a generation counter that every start, stop and `refreshNow` increments. A response from a stale generation
      is dropped and schedules nothing. `refreshNow` clears the pending timer and reschedules exactly one, so there is
      never more than one chain, and an older response never overwrites a newer board.
    - Unlike `useBotAllyStatus`, which can't restart once stopped, this chain restarts on expand.
- **File names.** `buildOperatorFileName(kind: 'operator' | 'fixture', matchId: string, capturedAtMs: number): string`,
  exported from `useOperatorBoard.ts`.
  - Returns `legendary-arena-${kind}-${safeMatch}-${capturedAtMs}.json`.
  - `safeMatch` replaces `/` and `\` with `-`, and is `no-match` when empty.
- **Downloads** use `downloadTextFile(…, 'application/json')` and `JSON.stringify(value, null, 2)`, and read `Date.now()`
  once per click.
  - "Download operator snapshot" → `buildOperatorFileName('operator', …)`, body `{ matchId, capturedAtMs, operatorView,
    botDecisions }`.
  - "Download as fixture" → `buildOperatorFileName('fixture', …)`, body `useUiStateStore().snapshot`.
- **Submit skip.**
  - `SubmissionStatus` gains `'operator-match'`.
  - When `uiStateStore.snapshot?.isDebugMatch === true`, `submitOnce` latches `hasSubmitted = true` and
    `submittedForMatch = currentMatchId`, sets `'operator-match'` and returns. This is the ended-early pattern, placed
    before the `endedEarly` and guest/token checks.
  - `SUBMISSION_MESSAGES['operator-match'] = 'Operator match — not scored.'`
  - `EndgameActions.vue` adds `.endgame-actions__status--operator-match` to the neutral rule.
  - The `PlayViewport.test.ts` `EXPECTED_BY_STATUS` row is `'operator-match': null`: no casual coach, since
    `computeCasualCoachMatchId` keys only on `'ineligible'`.
- **Badge.** In `PlayViewport.vue`, `<p class="operator-match-badge" data-testid="operator-match-badge">Operator match —
  not scored</p>` renders when `snapshot.isDebugMatch === true`, for every seat.
- **Panel mount.**
  - `const OperatorBoardPanel = defineAsyncComponent(() => import('../components/play/OperatorBoardPanel.vue'))`,
    registered in `components`.
  - Rendered as `<OperatorBoardPanel v-if="isOperatorPanelVisible" :match-id="matchId" />`, where
    `isOperatorPanelVisible = snapshot?.isDebugMatch === true && isOperator && matchId !== ''`.
- **Chunk-load failure:** no `errorComponent` is used. If the panel chunk fails to load, the panel renders nothing and
  Vue logs the error. Accepted for operator tooling.
- **Panel** (`components/play/OperatorBoardPanel.vue`, root `data-testid="operator-board-panel"`):
  - a header toggle button `data-testid="operator-board-toggle"` with `aria-expanded`, expanded on mount;
  - sections, each with its own `data-testid`:
    - `operator-seats`: per seat `playerId`, hand, deck top-first, discard, in play, victory, and `woundsByZone`;
    - `operator-decks`: villain deck, hero deck and Mastermind tactics, top-first;
    - `operator-piles`: supply counts, KO, escaped;
    - `operator-engine`: `currentStage`, `counters`, and the last 10 `board.value.operatorView.board.effectTraces`
      (the unfiltered UIState) as card name + status. They are never read from `useUiStateStore`;
    - `operator-bot-decisions`: newest first. Per entry: "Turn N" (the record's `turn`, as-is), seat, "forced" or
      "policy", move name, legal-move count and the `decisionLog` lines;
  - a card label is `operatorView.cardDisplay[id]?.name ?? id`;
  - a "Refresh" button `data-testid="operator-board-refresh"` calls `refreshNow`;
  - two download buttons, `data-testid="operator-download-snapshot"` and `"operator-download-fixture"`;
  - when `errorMessage` is set, it renders in `data-testid="operator-board-error"` and the last board stays on screen.
- **Lobby.**
  - In the bot-ally section, a checkbox `data-testid="lobby-operator-match"`, labelled "Operator match (admin, not
    scored)", rendered only when `isOperator` is true.
  - When it is checked, `createWithBotAlly` calls `createOperatorMatchWithBot` instead of `createMatchWithBot`. Every
    other step (persist setup, `joinMatch` seat 0, navigation) is unchanged.

## Scope (In)

### A) API and composables
- `lib/api/operatorMatchApi.ts` (new): the three functions and two wire types.
- `composables/useOperatorEligibility.ts` (new).
- `composables/useOperatorBoard.ts` (new): polling plus `buildOperatorFileName`.

### B) Panel and play surface
- `components/play/OperatorBoardPanel.vue` (new): the panel, theme tokens only, split into named `setup` helpers so each
  function stays ~30 lines.
- `pages/PlayViewport.vue`: the badge, the lazy panel mount, `useOperatorEligibility(isOperatorMatch)` and the new
  `SUBMISSION_MESSAGES` entry.
- `components/play/EndgameActions.vue`: the neutral status class (style only).

### C) Submit skip (`composables/useCompetitiveSubmitOnGameover.ts`)
- `'operator-match'` and the latched early return.

### D) Lobby (`lobby/LobbyView.vue`)
- `useOperatorEligibility(ref(true))`, the checkbox and the create branch.

### E) Docs (governance close, `SPEC:` commit)
- `docs/ai/REFERENCE/api-endpoints.md`: **replace** the eligibility row whole. Its Notes name WP-804 as the consumer
  instead of "the planned arena-client follow-on". Also update the "Last updated" footer. No endpoint changes, so this is
  a documentation refresh, not a D-11804 change.
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md` and
  `docs/05-ROADMAP-MINDMAP.md` (📝 → ✅, then `pnpm roadmap:counts:write`).
- No DECISIONS entry. The rulings are D-24689 §5 / §6 and D-24697; this packet implements them.

### F) New tests
- `lib/api/operatorMatchApi.test.ts` (new):
  1. eligibility is true only for 200 `{ isOperator: true }`; false for 403, 401, 500, a thrown fetch and bad JSON;
  2. create posts the locked body to the operator path with the bearer header, and throws on 400;
  3. board encodes the match id in the path. It returns `ok: true` with the body on 200, `ok: false` with the status on
     409, 404 and 500, and `status: 0` on a thrown fetch.
- `composables/useOperatorEligibility.test.ts` (new):
  - no probe without a token or with `isEnabled` false;
  - true after a 200; false after a 403;
  - resets to false when the token clears or `isEnabled` turns false;
  - probes when the token arrives after mount (App.vue hydrates the session in the background), and when `isEnabled`
    flips true after mount;
  - a 200 resolving after a reset leaves `isOperator` false (stale generation).
- `composables/useOperatorBoard.test.ts` (new):
  1. polls only while expanded, and stops when collapsed and on unmount (mock timers);
  2. a failed poll keeps the last board and sets `errorMessage`;
  3. `buildOperatorFileName`: both kinds, `/` replaced, `no-match` on empty;
  4. a collapse → expand while a fetch is in flight leaves exactly one chain (count board fetches across two intervals);
  5. `refreshNow` mid-chain leaves one chain, and a stale response doesn't overwrite a newer board.
- `components/play/OperatorBoardPanel.test.ts` (new). The fixture `OperatorBoardResponse` is declared inline in this
  file, and the composable's fetch is stubbed. The cases:
  - all five sections render;
  - the raw id shows when `cardDisplay` lacks an entry;
  - decisions show newest first with their `turn` unchanged;
  - the toggle collapses the panel and stops polling;
  - both downloads produce the locked names and bodies, tested with the `GameLogDownloadButton.test.ts` pattern
    (L55–90): stub `URL.createObjectURL` to capture the Blob, spy `document.createElement` to capture `anchor.download`,
    and `mock.method(Date, 'now')`. No ESM module mocking: the test script has no `--experimental-test-module-mocks`;
  - an error keeps the last board.
- `pages/PlayViewport.test.ts`. The async panel appears only after `await flushPromises()`, so **every** presence and
  absence check runs after `flushPromises()`. The cases that exercise eligibility set a token
  (`useAuthStore().setSession('token', null)`, as `useCompetitiveSubmitOnGameover.test.ts` L76 does). The cases:
  - the badge renders with `isDebugMatch` and not without it;
  - **positive:** token, `isDebugMatch`, eligibility 200 and a non-empty `matchId` → `operator-board-panel` is present;
  - the panel is absent when any one of the three gate conditions is missing;
  - the badge renders for a non-admin seat (eligibility 403) while the panel does not;
  - a normal match with a token makes no eligibility request.
- `composables/useCompetitiveSubmitOnGameover.test.ts`, with a token set:
  - an operator match at game over sets `'operator-match'` and makes no fetch;
  - **latch:** after that first game over, clear `gameOver`, then send game over again *without* `isDebugMatch`. No
    fetch is made, which proves the latch, not the flag, stops it;
  - a normal match is unchanged.
- `lobby/LobbyView.test.ts`:
  - the checkbox is absent for a non-operator and present after an eligibility 200;
  - checked, it posts to the operator create path and then joins seat 0;
  - unchecked, it posts to the public path as before.

### G) Existing test — the one authorized change
- `pages/PlayViewport.test.ts` `EXPECTED_BY_STATUS` (L125–147) gains the row `'operator-match': null`. Its length
  assertion moves from 9 to 10.
- The new union member forces both edits (`Record<SubmissionStatus, …>`). They extend the map rather than weaken it.
- Commit 1's `Tests-changed:` trailer names it. No other existing assertion changes.

## Limitations (accepted)

- **The eligibility gate is presentation only.** Hiding the option and the panel protects nothing on its own. Every
  operator route enforces `admin-session-required` server-side (D-15902), so a non-admin who forces the panel visible
  gets 403s.
- **The lobby probe** runs once per lobby visit for every signed-in user. It costs one admin lookup and returns a 403 for
  non-admins, which is quiet in the UI but visible in devtools. Play-surface probes run only in operator matches.
- **The bot record is per instance** (D-24689 §5), so during a deploy overlap the panel can show an empty decision list.
- **Staleness:** a 3-second poll can show a board up to 3 seconds old. "Refresh" fetches immediately.
- **Fixtures:** a downloaded fixture doesn't load by name until someone adds it to the closed fixture set
  (`fixtures/uiState/index.ts` and `typed.ts`).
- **Play Again starts a normal match.** The operator create path keeps `persistBotAllySetup`, so "Play Again" on an
  operator match relaunches through `launchBotAllyFromComposition` and the public `createMatchWithBot`. That is a normal,
  scored match, which is acceptable: an operator re-ticks the lobby box for another operator match.

## Out of Scope

- Setters, Tweakpane and the set-aside zone (arc follow-on 2, D-24689 §7).
- Jump to turn N (arc follow-on 3, D-24689 §8).
- Any server, engine or `UIState` change.
- Adding downloaded fixtures to the closed fixture set.
- An operator relaunch. The Play Again button (`PlayViewport.playAgain`, `useCreateMatchFromComposition`) is unchanged.
- Labelling operator matches on the dashboard (WP-802 OD-1).
- The stale ctx-turn comment at `packages/game-engine/src/ui/uiState.build.ts` L665–673 and the matching wording in
  `uiState.build.test.ts` L151 / L168. The engine is out of scope; this is a separate hygiene commit.
- The native-lobby guard's missing CORS headers on 401/403. No client calls the native create or `playAgain`.

## Files Expected to Change

- `apps/arena-client/src/lib/api/operatorMatchApi.ts` — **new** — the three API functions and wire types
- `apps/arena-client/src/lib/api/operatorMatchApi.test.ts` — **new** — §F
- `apps/arena-client/src/composables/useOperatorEligibility.ts` — **new** — the gated probe
- `apps/arena-client/src/composables/useOperatorEligibility.test.ts` — **new** — §F
- `apps/arena-client/src/composables/useOperatorBoard.ts` — **new** — polling and file names
- `apps/arena-client/src/composables/useOperatorBoard.test.ts` — **new** — §F
- `apps/arena-client/src/components/play/OperatorBoardPanel.vue` — **new** — the panel
- `apps/arena-client/src/components/play/OperatorBoardPanel.test.ts` — **new** — §F, inline fixture
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — badge, lazy mount, eligibility, message
- `apps/arena-client/src/pages/PlayViewport.test.ts` — **modified** — §F cases + the §G row
- `apps/arena-client/src/components/play/EndgameActions.vue` — **modified** — status class (style only)
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts` — **modified** — `'operator-match'`
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.test.ts` — **modified** — §F cases
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — option and create branch
- `apps/arena-client/src/lobby/LobbyView.test.ts` — **modified** — §F cases
- `docs/ai/REFERENCE/api-endpoints.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close

The fifteen code files are over the ~8-file guidance:
- eight are four new modules, each with its own test;
- seven are existing client files that each take a few lines.

Splitting the lobby option from the panel would ship an option that creates a match nobody can inspect from the UI.

## Contract

- Locks the client API and its wire types, the two composables, `buildOperatorFileName`, the `'operator-match'` status,
  and the panel, badge and lobby test ids.
- No server, engine, `UIState`, move or persistence change.

## Acceptance Criteria

1. `fetchOperatorEligibility` returns true only for 200 `{ isOperator: true }` and never throws.
2. The play surface makes no eligibility request in a normal match.
3. In the lobby, the operator checkbox is absent unless eligibility returned 200. Checked, the match is created through
   `/api/admin/operator-match/create-with-bot`, and seat 0 joins as before.
4. `PlayViewport` shows the badge for any seat in an operator match, and only there.
5. The panel mounts only when the match is an operator match, the user is eligible and `matchId` is non-empty. It is
   loaded through `defineAsyncComponent`.
6. The panel renders the five sections and labels cards by name, with a raw-id fallback. Bot decisions show newest
   first, with the record's `turn` unchanged.
7. The panel polls every 3000 ms, only while expanded. It stops when collapsed and on unmount, and keeps the last board
   on an error.
8. The two downloads produce the locked file names and bodies.
9. At game over in an operator match, the client makes no submit request and shows "Operator match — not scored." The
   skip is latched.
10. `pnpm -r build` exits 0, `pnpm -r --no-bail test` reports 0 failures, and
    `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
11. The only changed existing assertion is §G: the `EXPECTED_BY_STATUS` row and the length 9 → 10. Everything else in
    `git diff origin/main -- '*.test.ts'` is an addition.
12. A production build keeps the panel out of the entry chunk. After `pnpm --filter @legendary-arena/arena-client build`,
    the string `operator-bot-decisions` appears in exactly one `dist/assets/*.js`, and that file is not the entry chunk
    `dist/index.html` loads.

## Verification Steps

```pwsh
pnpm -r build
pnpm -r --no-bail test
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client build
Get-ChildItem apps/arena-client/dist/assets -Filter *.js | Select-String -SimpleMatch "operator-bot-decisions" -List | Select-Object Path
Select-String -Path apps/arena-client/dist/index.html -Pattern 'assets/index-[^"]+\.js'
pnpm ledger:numbers:check
pnpm roadmap:counts:check
git diff --name-only origin/main
git diff origin/main -- '*.test.ts'
```

Expected:
- every `pnpm` command exits 0;
- `operator-bot-decisions` appears in exactly one asset, and it is not the entry asset named in `dist/index.html`;
- the name diff lists only §Files Expected to Change;
- the test diff is additions plus the §G row and count.

**Live (D-24026), after merge and deploy**, signed in as `jefferyjjensen` (admin):
1. The lobby's bot-ally section shows "Operator match (admin, not scored)". Signed in as a non-admin account, or signed
   out, it doesn't.
2. Ticking it and creating a 2p match lands on the play mat with the "Operator match — not scored" badge.
3. The panel shows both seats' zones, the villain deck top-first and the supply counts. After the bot's first turn, its
   decisions show turn numbers matching the game log's turn prefix (D-24697).
4. Collapsing the panel stops its board requests (browser devtools Network tab); expanding resumes them. A normal match
   makes no eligibility request.
5. Both downloads save JSON files with the locked names, and the snapshot holds `botDecisions`.
6. At game over the end panel says "Operator match — not scored." and no `POST /api/competition/scores` is sent.
7. The panel is readable in both day and night themes.

Record the matchId in STATUS.

## Definition of Done

- [ ] Acceptance Criteria 1–12 pass, with command output pasted into the PR.
- [ ] `git status --porcelain` / `git diff --name-only origin/main` ⊆ §Files Expected to Change. Revert line-ending-only
      churn (e.g. `lagn-v1.json`).
- [ ] STATUS, WORK_INDEX (`[x]` with date), EC_INDEX, the eligibility row in `api-endpoints.md` and the mindmap (✅,
      counts regenerated) are updated.
- [ ] DECISIONS.md: no new entry. The rulings are D-24689 §5 / §6 and D-24697, and this packet records none; confirm at
      close that none was needed.
- [ ] Two commits in one PR: `EC-841:` (code + tests) and `SPEC:` (governance close). Neither subject contains a
      commit-msg Rule 1 token.
- [ ] D-24026 live verification after deploy (§Verification Steps), recorded as a STATUS flip.

## Open Operator Decisions (do not block execution)

- **OD-1 — Poll cadence.** The 3-second cadence is locked. If it feels slow at live verification, tune the one constant
  in a follow-up `INFRA:` commit.

## Vision Alignment

- §3 Player Trust & Fairness: every seat sees that an operator match isn't scored, and the client never submits one.
- §7 Strict Layer Separation: the engine builds the view, the server gates it, and the client only renders it.
- §11 Stateless Client Philosophy: the client holds only the last fetched board and stores nothing.
- §14 Explicit Decisions, No Silent Drift: the packet implements D-24689 §5 / §6 and D-24697, and records no new
  ruling.
- §16 Performance & Responsiveness: a lazy chunk; polling only while the panel is open; no probe in normal matches.
- §17 Accessibility & Inclusivity: a keyboard-reachable toggle with `aria-expanded`, and theme tokens for day and night.
- §23 Competitive Leaderboards & Submission: an operator match never reaches the leaderboard. The client skips the
  submit, and the server's `debug_match` 422 (D-24689 §3) stays authoritative.
- **Conflict assertion:** No conflict.
- **Determinism (§22):** no engine, move or server change. Every match stays deterministic and replay-faithful.
- **NG-1..NG-8:** none crossed. Operator tooling is not a product feature, and no purchase reaches it.

## Funding Surface Gate

N/A. Operator tooling, with no commerce, account-tier, entitlement, nav, profile or donate surface.

## API Catalog

No endpoint is added or changed (D-11804 doesn't trigger). The eligibility row's Notes are refreshed in the governance
close because they name this packet as "planned".

## Lint Gate Self-Review (00.3)

All 21 sections are satisfied or N/A. The gate ran as an independent subagent: FAIL, then FAIL, then PASS.
- **First pass (4 FAILs, fixed):**
  - §4: ARCHITECTURE.md missing from Read;
  - §11: no presentation-only Limitation;
  - §17: §22 / §23 missing;
  - EC Locked Values paraphrased, not verbatim.
- **Delta (1 FAIL, fixed):** §15 — the DoD lacked an explicit "DECISIONS.md: none" item.
- **Advisories applied:**
  - the latched skip;
  - the encoded board path;
  - the play-surface probe gated on `isDebugMatch`;
  - the inline test fixture;
  - the refreshed eligibility row;
  - "fix stuff" added to the token list;
  - the `EXPECTED_BY_STATUS` anchor L125.
- **§19:** N/A (commit time). **§20:** justified N/A. **§21:** no endpoint change, so the eligibility row is a doc refresh.

## Gate Verdicts

- **Pre-flight (01.4): READY TO EXECUTE.** The first pass was NOT READY:
  - **PS-1:** the draft's client-side turn conversion had a wrong game-over term. Running the real reducer showed that
    `ctx.turn` does not bump at game over, and that the `uiState.build.ts` L665–673 comment is stale. D-24697 (#2728)
    now records the display turn server-side, so the conversion and its `frameworkTurn` server field were removed.
  - **PS-2:** the new status breaks `PlayViewport.test.ts` `EXPECTED_BY_STATUS`. Fixed as the one authorized §G edit.
  - **RS-1..RS-6:** the gated probe, the PascalCase tag plus the AC 12 search string, the baseline, the URL convention,
    the eligibility-row refresh, and the fetch-stub safety check.

  The delta re-check returned READY. Its anchor and baseline nits were applied: `botAllyRoutes.mjs` L830–857 /
  L646–650, and arena-client 2299 / 0.
- **Copilot (01.7):** the first pass was RISK → HOLD. Findings:
  - F1: tests that couldn't fail, now fixed with `flushPromises`, a token in the probe cases, the latch shape, late
    arrival, and the download-test pattern;
  - F2: poll and probe overlap, now generation counters;
  - F3: Play Again relaunches a normal match, now stated;
  - F4: the effect-trace path;
  - F5: the board error source and chunk-load failure;
  - F6: this record.
  Delta: PASS (CONFIRM).
- **Lint (00.3): PASS** after two FAIL rounds.
