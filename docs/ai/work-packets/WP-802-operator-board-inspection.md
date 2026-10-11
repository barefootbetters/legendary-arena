# WP-802 — Operator match: admin-only creation, never scored, and a reveal-all board read

**Status:** Draft 2026-10-11 · **EC:** EC-839 · **Reserves:** D-24689 (reserve PR #2688)
**Primary Layer:** Server (with a Game Engine projection and setup flag)
**User-Visible Surface:** three `admin-session-required` HTTP routes on the game server (operator only); a
`debug_match` score-submission refusal; a 400 on any public create carrying the operator flag. The play-surface panel
that consumes the board route is the planned follow-on (§Arc).
**Lane:** standard two-session (crosses the engine / server boundary, adds a contract file, touches scoring and the
persistence boundary; ineligible for the lightweight lane under 01.0a criteria 1, 3, 4 and 6)
**Baseline:** `origin/main` @ `8f70b0b0` (2026-10-11, #2686 the design page) plus the reserve commit `52aa008a` (#2688)

## Goal

An admin can create an **operator match**: a normal bot-ally match whose setup carries `isDebugMatch: true`. While it
runs, the admin can read the whole board through one HTTP route: every seat's hand, deck in draw order, discard, in
play and victory pile, Wounds split by zone, the supply counts, the villain deck, hero deck and Mastermind tactics in
order, the KO and escaped piles, the engine's own stage, pending choices and effect traces, and the bot's recent
decisions. An operator match is never scored. Nobody but an admin can create one.

This is the server and engine half of the operator panel argued for in
[`wiki/why-play-needs-a-debug-panel.md`](../../../wiki/why-play-needs-a-debug-panel.md) (#2686). It removes the first
and fourth gaps on that page (hidden zones; bot intent) at the data layer. D-24689 answers the page's six open questions.

## User-Visible Impact

- **The evidence (2026-10-10/11 live-verify sessions; the design page §The evidence).**
  - D-24684 (Ymir chooser): bot-ally match `MHZt0mnJyn6` (build `19be0fc`) went `partial` in
    `docs/ai/coverage/live-verify.json` because the log can't show the bot's hand + discard Wounds. A PASS took a
    fourth full game (`ZVUtr7aaCom`).
  - D-24686 (empty-Wound-supply log line): three Cosmic Cube games and the supply never ran out. Still `pending`.
    `woundsCount` must be at least 30 (`SUPPORT_COUNT_MINIMUMS.woundsCount`,
    `packages/registry/src/setupContract/setupContract.schema.ts`), so a loadout can't set it up. That gap needs the
    setters (§Arc), not this packet.
  - D-24688 (the bot's "KO nothing" Maniacal Tyrant default): found only by reading the bot's code after the games.
    The scored candidates in `packages/game-engine/src/simulation/ai.competent.ts` are internal.
- **After this packet**, in one operator match:
  - `GET /api/admin/operator-match/:matchId/board` shows both seats' hand + discard Wounds at the moment of the Ymir
    fight (`woundsByZone`). That is the D-24684 question, answered without another game.
  - the same response lists each bot decision: forced or chosen by the policy, the policy's own decision lines
    (`[Bot] Chose: … (score N)`, `[Bot] Over: …`), and how many legal moves it had. A forced singleton such as D-24688's
    "KO nothing" shows as `isForced: true, legalMoveCount: 1` with its arguments.
- **Business impact.** Every card on the live-verify record still at `partial` or `pending` costs several full games
  today. This packet is the first step to one game per verification. Fairness is protected: an operator match can never
  reach a leaderboard, a gauntlet, a badge or a Casual score row, and only an admin can make one.

## Arc (decomposition)

One packet would cross three layers and about forty files, so the panel ships as an arc. Each packet delivers testable
value on its own:

1. **WP-802 (this packet): the operator match on the server.** Engine flag + projection; admin create, eligibility and
   board routes; the create-path refusals; the `debug_match` scoring refusal; the bot-decision record. Usable with an
   authenticated request; verified live that way.
2. **Planned (not reserved): the operator panel in the arena-client.** A lobby "Operator match" option shown only when
   the eligibility route returns 200; a lazy-loaded Vue panel (D-24689 §6) mounted beside the play mat in an operator
   match, polling the board route; the public `isDebugMatch` badge; skipping the score submit in an operator match;
   "Download operator snapshot" and "Copy as fixture" (the current UIState in the shape of
   `apps/arena-client/src/fixtures/uiState/*.json`, for the `/?fixture=…&play=1` route).
3. **Planned (not reserved): setters.** Engine moves gated on `G.isDebugMatch`, under the D-24689 §7 rulings.
4. **Planned (not reserved): jump to turn N.** Read-only replay stopped at move N, under the D-24689 §8 rulings and its
   own persistence carve-out.

The follow-ons are planned only, so no number is burnt if the arc changes. Each takes numbers from the ledger when it is
drafted.

## Assumes

- **Dependencies (all shipped):**
  - WP-375 / WP-376: bot-ally create (`POST /api/match/create-with-bot`) and the human seat join;
  - WP-307 / WP-308 (D-24092 / D-24093 / D-24094): the `/api/match/create` gate and the native-lobby hard gate;
  - WP-159 / WP-176 (D-15901 / D-15902): `requireAdminSession` and the `admin-session-required` tier;
  - WP-502 (D-24306): the `ended_early` permanent rejection;
  - WP-686 (D-24503): the engine-consumed `finalBlow` field, the omit-when-off precedent;
  - WP-029 / WP-258 / WP-575 (D-12803): the audience filter and its public pass-through pattern;
  - D-24095 / D-24119 / D-24153 / D-24169 / D-24187: the framework-store exemption and its four carve-outs.
- **The creation payload.** The engine has no envelope type.
  - `packages/game-engine/src/types.ts` L451: `export type MatchConfiguration = MatchSetupConfig & { readonly finalBlow?:
    boolean };`.
  - `setup/buildInitialGameState.ts` ~L635–644 stores the raw `setupData` as `matchConfiguration: config` and spreads
    `...(config.finalBlow === true ? { finalBlow: true } : {})`. `LegendaryGameState` declares
    `readonly matchConfiguration` (L1745) and `readonly finalBlow?: boolean` (L1756).
  - `validateMatchSetup` (`matchSetup.validate.ts`) checks only the composition fields. Unknown keys pass through into
    `G.matchConfiguration`.
  - The registry loadout envelope (`packages/registry/src/setupContract/setupContract.schema.ts` `EnvelopeSchema`,
    `.strict()`) is a separate, client-side document. It is **not** touched here and keeps rejecting unknown keys.
- **Every create reaches the native route.** All server create paths POST over loopback to
  `${serverUrl}/games/legendary-arena/create` with `INTERNAL_DELEGATION_HEADER`:
  - `match/matchGate.routes.ts` ~L297 `POST /api/match/create` forwards the caller's `setupData` unchanged;
  - `autoplay/autoplay.mjs` ~L325 `POST /api/match/autoplay` (no auth) uses `body.setupData ??
    buildDefaultComposition(playerCount)` (~L337);
  - `bot-ally/botAllyRoutes.mjs` ~L568 `POST /api/match/create-with-bot` validates with `validateCreateWithBotBody`
    and forwards `setupData`;
  - `match/guestSoloRoutes.mjs` ~L215 uses a server-fixed table (no caller `setupData`).
  - **boardgame.io's native `playAgain`** (`boardgame.io@0.50.2` server.js L2344–2392) creates a new match from
    `ctx.request.body.setupData || metadata.setupData` and needs only seat credentials. `isGuardedNativeLobbyPath`
    (`nativeLobbyGuard.ts` L118–126) matches only `/create` and `/:id/join`, and `api-endpoints.md` L268 lists the
    built-ins as `guest`. No client calls it (`PlayViewport.vue` L436–470 relaunches through
    `/api/match/create(-with-bot)`), and no server test hits it.
  - **The guard's path test is exact, the router's is not.** `isGuardedNativeLobbyPath` compares
    `path === '/games/legendary-arena/create'` and a case-sensitive join regex. boardgame.io mounts `@koa/router@10.1.1`
    with its defaults (`strict: false`, `sensitive: false`, params decoded). So the router still serves
    `/games/legendary-arena/create/`, `/games/legendary-arena/CREATE`, `/games/legendary%2Darena/create` and the same
    variants of `join`, while the guard passes them through. That is a live bypass of D-24094 today (copilot, 2026-10-11).
  - `match/nativeLobbyGuard.ts` admits a native create or join with the secret **or** any valid session (~L200–212).
    No client calls the native create directly (only server proxies; checked 2026-10-11).
  - The guard can't read the request body: boardgame.io's own `koaBody()` (`boardgame.io@0.50.2` server.js L2142)
    re-reads the stream, and `koa-body@5.0.0` does not skip an already-parsed body.
- **Admin gate.** `apps/server/src/auth/adminSession.ts` `requireAdminSession(request, options)` (L125) returns
  `{ ok: true, accountId }` or `{ ok: false, code: 'unauthorized' | 'forbidden' | 'lookup_failed', reason }`. It is the
  only file that reads `is_admin`. It is imported in `server.mjs` (L77) and injected at ~L1547–1626.
- **Scoring has one choke point.** `competition/competition.logic.ts` `submitCompetitiveScoreImpl` (~L712) is the only
  insert into `legendary.competitive_scores` (~L981) and issues the badges in the same flow (~L1057, ~L1075).
  Leaderboards, gauntlet progress, Hall of Legends, result-LAGN and `/api/dash/players` all read that table. PAR is a
  gate only; no seed-challenge feature exists. The `ended_early` check is at ~L879–888, after the reduce.
  `competition.types.ts` L79–95 (`SubmissionRejectionReason`) and L111–120 (`SUBMISSION_REJECTION_REASONS`) are pinned
  by the drift test `competition.logic.test.ts` ~L967–1010. `competition.routes.ts` `statusForRejectionReason` maps any
  unlisted reason to 422 (as `ended_early`).
- **The projection.** `ui/uiState.build.ts` `buildUIState(gameState, ctx: UIBuildContext)` (L657); `UIBuildContext`
  (L153–157, module-private, "must not be widened") is `{ phase, turn, currentPlayer }`. The unfiltered output carries
  every seat's hand, discard and in-play display. Decks are counts only, and `deckComposition` is sorted so draw order
  never leaks (~L826). `countWounds` (L380–411) is private and totals all five zones by `WOUND_EXT_ID` (imported from
  `setup/buildInitialGameState.js`).
- **Orientation (index 0 is next).** `VillainDeckState.deck` ("Top of deck is deck[0]"), `MastermindState.tacticsDeck`
  ("drawn from index 0"), `drawCardsIntoHand` (`playerZones.deck[0]`, `moves/drawCards.logic.ts` L77), and the HQ refill
  (`G.heroDeck[0]`, `board/city.logic.ts` L222).
- **Other `G` shapes read:** `PlayerZones` (`state/zones.types.ts` L41: `deck`, `hand`, `discard`, `inPlay`,
  `victory`), `GlobalPiles` (L77: `bystanders`, `wounds`, `officers`, `sidekicks`), `G.ko`, `G.escapedPile`,
  `G.scheme.twistPile`, `G.currentStage`, `G.cardDisplayData` (`Readonly<Record<CardExtId, UICardDisplay>>`).
- **Filter pass-through precedent.** `ui/uiState.filter.ts` ~L1552–1625 passes `hollowEffects` and `effectTraces` to
  every audience with a conditional assignment.
- **The bot.** `bot-ally/botAllyDriver.mjs` `decideBotMove(state, botSeat, policy)` (L253–281) returns
  `{ name, args }`. It drains a forced pending choice first (no policy call), otherwise calls `policy.decideTurn` and
  drops `intent.decisionLog`. `botAllyRoutes.mjs` `startDriverForMatch` builds the driver with
  `decide: (state, seat) => decideBotMove(state, seat, policy)` (~L535). The competent policy's `decisionLog` holds the
  chosen move and up to two alternatives with scores (`ai.competent.ts` L430–461).
- **Live state reads.** Server code already reads a match's live `state` with `db.fetch(matchId, { state: true })` to
  drive bots (`botAllyRoutes.mjs` ~L190, ~L520; `autoplay.mjs` `resilientFetch` ~L673). WP-802 adds a new purpose for
  that read and records it as a carve-out (D-24689 §4).
- **Suites at baseline** (this worktree on `52aa008a`, after `pnpm -r build`): server **1678 tests, 1472 pass, 206
  skipped (DB-backed, no `TEST_DATABASE_URL`), 0 fail**; game-engine **5047 / 0**. Re-record at execution.
- **No new dependencies.** No package, script or workflow is added.

## Context (Read First)

**Why a debug match and not a dev build.** All four incidents happened on production play, and D-24026 counts only what
is seen on play. A panel compiled out of production builds would not have helped. So the gate is an admin-created match
on the normal deployment.

**Why an HTTP route and not a spectator connection (Q1).** boardgame.io spectators connect over the socket with no
credentials. Anyone who knows a match id can spectate. A reveal-all audience served through `playerView` could not be held
behind `admin-session-required`. An HTTP route reuses `requireAdminSession` and leaves `playerView` and the player
audiences in `filterUIStateForAudience` exactly as they are. The cost is a new carve-out for a live read of the `state`,
recorded in D-24689 §4 next to D-24119 / D-24153 / D-24169 / D-24187.

**Why the flag rides in the creation payload, not the loadout.** A loadout is shareable (LAGN, the profile library). A
shared or imported loadout must never carry an operator switch. So `isDebugMatch` is a field of the creation payload
`MatchConfiguration` only, beside `finalBlow`. The registry's strict `EnvelopeSchema` keeps rejecting it, and the 9-field
`MatchSetupConfig` composition lock is untouched.

**Why the native create tightens.** The flag reaches `Game.setup()` in `setupData`, which any create path forwards.
Every server proxy can refuse it, because each one parses its own body. The native route is the hole: any signed-in
player can POST it directly with any `setupData`, and the guard can't read the body (§Assumes). boardgame.io's native
`playAgain` is a second hole: any seat holder, a guest included, can send it any `setupData`. So both native routes admit
only the internal delegation or an **admin** session; a non-admin session gets 403. No client uses either. Join is
unchanged. This also closes a D-24092 bypass: today a guest can mint a match of any size and setup through `playAgain`,
outside the guest-solo rate limiter. A `playAgain` on an operator match copies `metadata.setupData` and so yields another
operator match; only an admin can send it. None of this holds unless the guard recognizes every path the router serves,
so the guard's path test is normalized (case-insensitive, any game-name segment, optional trailing slash) for create,
`playAgain` and join. That closes the existing D-24094 bypass for all three; join's admission rule (secret or session)
is unchanged.

**Empirical scaffold (2026-10-11, this worktree on `52aa008a`, reverted).** The native guard was made
delegation-only for create, and the server suite run:
- `pnpm --filter @legendary-arena/server test`: 1678 tests, **2 fail**, both in `match/nativeLobbyGuard.test.ts`:
  - `POST create with no secret and no session returns 401 and does not pass through` failed only on its message regex
    (the probe used a placeholder message). The locked design keeps that 401 and its message, so this test stays
    unchanged;
  - `POST create with a valid session (no secret) passes through`: the intended behavior change. It is rewritten (§Scope
    G).
- No other server test failed. The 206 DB-backed tests skipped (no `TEST_DATABASE_URL`). They create through the
  delegating proxies, which the change doesn't touch. The executor runs them when a test database is available.
- `isDebugMatch` appears nowhere in code today, so no fixture carries it and the proxy refusals reject nothing that
  exists.
- No server test hits the native `playAgain` route (pre-flight, 2026-10-11), so guarding it breaks no existing test.
- The locked design adds a `requireAdminSession` dependency to the guard. The two dependency fixtures in
  `nativeLobbyGuard.test.ts` (`acceptingSessionDeps` L78, `rejectingSessionDeps` L84) each gain a fake for it; that is a
  fixture addition, not an assertion change.

**Determinism and hashes.** `G.isDebugMatch` and `UIState.isDebugMatch` are written only when true (the WP-686
omit-when-off pattern). A normal match's `G`, its `finalStateHash`, `PRE_WP080_HASH` and the sentinel replay fixture
stay byte-identical. The projection is a pure read. The bot record is server memory, never `G`.

**Read:**
- [`wiki/why-play-needs-a-debug-panel.md`](../../../wiki/why-play-needs-a-debug-panel.md) in full (the case; don't
  re-argue it).
- `docs/ai/DECISIONS.md`: D-24095, D-24119 (and its "Implementation landmines"), D-24153, D-24169, D-24187, D-24306,
  D-24503, D-24092 / D-24093 / D-24094, D-15901 / D-15902, D-12803, D-24026.
- `docs/ai/ARCHITECTURE.md` §Persistence Boundary (Cross-Layer) and `.claude/rules/architecture.md` §UIState
  Projection Integrity (the five-step rule) and §Persistence Boundary.
- `docs/ai/REFERENCE/api-endpoints.md` (the Auth closed set; the rows in §Scope H).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §7 (the `finalBlow` paragraph, ~L653) and
  `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` §Extensibility Rules.
- `docs/ai/ARCHITECTURE.md` Section 1 "Monorepo Package Boundaries" and `.claude/rules/architecture.md` §Layer Boundary.
- `.githooks/commit-msg` Rule 1 (forbidden subject tokens) and Rule 5 (`SPEC:` carries no code).

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- No `Math.random()`, no `ctx.random`, no clock, no I/O in the projection or setup. Moves never throw (no move is added
  here).
- Zones store `CardExtId` strings only. No `.reduce()` in zone reads. `for...of` loops.
- ESM only, Node v22+, the `node:` prefix, `.test.ts`, `node:test`. No `boardgame.io` import in the projection.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full-word names, JSDoc on every function, `// why:` on
  every non-obvious rule, full-sentence error messages.
- Output the **full file contents** for every modified file. No diffs, no snippets.
- Functions fit on one screen (~30 lines): `buildOperatorView` is split into named per-section helpers, and the shared
  bot-ally create steps are a named module-level function, not a closure inside `registerBotAllyRoutes`. No nested
  ternaries, no `import *`, no new barrel.
- New code and `// why:` text cite D-15902 for the admin rule and never name the admin column; only
  `auth/adminSession.ts` reads it.
- No commit subject may contain a `.githooks/commit-msg` Rule 1 token (case-insensitive: WIP, misc, tmp, updates,
  changes, debug). `isDebugMatch` and `debug_match` therefore never appear in a subject; write "operator match".

**Packet-specific:**
- `playerView`, the `UIAudience` union and every player and spectator audience in `filterUIStateForAudience` are
  unchanged, apart from the public `isDebugMatch` pass-through. No seat or spectator ever receives another seat's
  hidden zones or any deck order.
- The `MatchSetupConfig` composition (9 fields) and the registry `SetupEnvelope` / `EnvelopeSchema` are untouched.
- `G.isDebugMatch` is set only at `Game.setup()` from the creation payload. Nothing writes it afterwards.
- An operator match is never scored, ranked, badged, leaderboard-, PAR-, gauntlet- or seed-challenge-eligible, and gets
  no Casual row.
- Nothing new is persisted: no `G` or `ctx` persistence, no new table or column, no write to `bgio.*`. The bot record
  lives in process memory and is lost on restart.
- Every operator route is `admin-session-required`, and the check is the route's first business-logic step.
- The server never interprets `G` beyond reading `G.isDebugMatch` (scoring refusal, bot record). The engine decides
  what the operator sees (`buildOperatorView` returns `null` for a normal match).
- No setter, move, replay-to-turn or client file. Those are the planned follow-ons.

**Session protocol:** Read the EC, then this WP, then the design page. Run the baseline suites before editing. If
anything is unclear, a baseline differs from §Assumes, or a file outside the allowlist would need to change, STOP and
report. Don't guess.

## Locked Contract Values

- Creation-payload field: `MatchConfiguration = MatchSetupConfig & { readonly finalBlow?: boolean; readonly
  isDebugMatch?: boolean }`.
- `G`: `readonly isDebugMatch?: boolean` on `LegendaryGameState`, written by `buildInitialGameState` as
  `...(config.isDebugMatch === true ? { isDebugMatch: true } : {})`. Only the strict `=== true` value turns it on.
- `UIState`: `isDebugMatch?: boolean`, populated in `buildUIState` only when `gameState.isDebugMatch === true`, and passed
  through `filterUIStateForAudience` to **every** audience (public) by conditional assignment.
- Engine projection, new contract file `packages/game-engine/src/ui/operatorView.types.ts`:
  ```ts
  export interface OperatorBuildContext { readonly phase: string | null; readonly turn: number; readonly currentPlayer: string; }
  export interface OperatorWoundsByZone { readonly deck: number; readonly hand: number; readonly discard: number; readonly inPlay: number; readonly victory: number; }
  export interface OperatorSeatView {
    readonly playerId: string;
    readonly deckTopFirst: readonly CardExtId[];
    readonly hand: readonly CardExtId[];
    readonly discard: readonly CardExtId[];
    readonly inPlay: readonly CardExtId[];
    readonly victory: readonly CardExtId[];
    readonly woundsByZone: OperatorWoundsByZone;
  }
  export interface OperatorSupplyCounts { readonly wounds: number; readonly bystanders: number; readonly officers: number; readonly sidekicks: number; }
  export interface OperatorView {
    readonly board: UIState;
    readonly currentStage: TurnStage;
    readonly seats: readonly OperatorSeatView[];
    readonly villainDeckTopFirst: readonly CardExtId[];
    readonly heroDeckTopFirst: readonly CardExtId[];
    readonly mastermindTacticsTopFirst: readonly CardExtId[];
    readonly supplyCounts: OperatorSupplyCounts;
    readonly koPile: readonly CardExtId[];
    readonly escapedPile: readonly CardExtId[];
    readonly counters: Readonly<Record<string, number>>;
    readonly cardDisplay: Readonly<Record<CardExtId, UICardDisplay>>;
  }
  ```
- `export function buildOperatorView(gameState: LegendaryGameState, context: OperatorBuildContext): OperatorView | null`
  in `ui/operatorView.build.ts`:
  - returns `null` unless `gameState.isDebugMatch === true`;
  - `board` is `buildUIState(gameState, context)`, **unfiltered**;
  - `seats` are sorted ascending by player id;
  - every array is a fresh copy in stored order (index 0 = next drawn or revealed);
  - `woundsByZone` counts `WOUND_EXT_ID` per zone;
  - `supplyCounts` are the `G.piles` lengths;
  - `counters` is a fresh copy of `G.counters` (the engine's own counts, e.g. `schemeTwistCount`,
    `rules/schemeHandlers.ts` L57), never a re-derived pile length;
  - `cardDisplay` holds the `G.cardDisplayData` entry for every id that appears in `seats`, the three decks, `koPile` and
    `escapedPile` (an id with no entry is left out).
- Engine exports from `packages/game-engine/src/index.ts`: `buildOperatorView` and the five types.
- Server constants and helpers, new `apps/server/src/operator/operatorMatch.logic.ts`:
  - `export function setupDataCarriesOperatorFlag(setupData: unknown): boolean`: true when `setupData` is a non-null
    object with an **own** `isDebugMatch` property, whatever its value;
  - `export const OPERATOR_FLAG_REFUSAL_MESSAGE = 'This match setup carries isDebugMatch, which only the operator
    create route may set. Remove the field and create the match again.'`.
- Bot record, new `apps/server/src/operator/operatorBotDecisions.ts`:
  - `OPERATOR_BOT_DECISION_CAP = 50` decisions per match, keeping the most recent 50 (the oldest is dropped);
  - `OPERATOR_BOT_DECISION_MATCH_CAP = 20` matches, evicting the oldest-inserted match first (no clock);
  - `recordOperatorBotDecision(matchId, record)`, `readOperatorBotDecisions(matchId)` (a fresh copy, `[]` when absent);
  - `OperatorBotDecision = { turn: number; seat: string; isForced: boolean; move: { name: string; args: unknown };
    decisionLog: readonly string[]; legalMoveCount: number }`.
- `decideBotMove(state, botSeat, policy, onDecision?)`:
  - its return value `{ name, args }` is unchanged;
  - when `onDecision` is given it is called once with `{ isForced, move, decisionLog, legalMoveCount }`, inside its own
    `try` / `catch`: a throw is logged with a full sentence and the same move is returned, so a recorder fault never
    changes bot play (the driver's fault fallback is never triggered by it);
  - forced path: `isForced: true`, `decisionLog: []`;
  - policy path: `isForced: false`, `decisionLog: intent.decisionLog ?? []`.
- Routes (all `admin-session-required`, `Cache-Control: no-store` first, admin check first):
  - `GET /api/admin/operator-match/eligibility` → `200 { isOperator: true }`; 401 / 403 / 500 from `requireAdminSession`
    (`unauthorized` / `forbidden` / `lookup_failed`).
  - `POST /api/admin/operator-match/create-with-bot`:
    - body as `POST /api/match/create-with-bot` (`validateCreateWithBotBody`);
    - the route creates with `{ ...setupData, isDebugMatch: true }` and `unlisted: true` in the native create body (so
      the match never appears in `GET /games/legendary-arena`), through the same bot-ally create steps;
    - `200 { matchId }`; 400 on an invalid body; 401 / 403 / 500 as above; a native-create or join failure passes its
      status through, as the public route does.
  - `GET /api/admin/operator-match/:matchId/board`:
    - `200 { matchId, operatorView, botDecisions }`;
    - 404 when the match does not exist;
    - 409 when `buildOperatorView` returns `null` (not an operator match);
    - 500 `{ error: 'The operator board could not be read from the match store; try again in a moment.' }` when
      `db.fetch` throws (the fault is logged);
    - 401 / 403 / 500 as above.
- Public create refusal: `POST /api/match/create`, `POST /api/match/autoplay` and `POST /api/match/create-with-bot` return
  `400 { error: OPERATOR_FLAG_REFUSAL_MESSAGE }` when `setupDataCarriesOperatorFlag(setupData)`. The check runs before any
  loopback create.
- Native guard path test (POST only), replacing the exact comparisons in `isGuardedNativeLobbyPath`:
  - create: `/^\/games\/[^/]+\/create\/?$/i`;
  - `playAgain`: `/^\/games\/[^/]+\/[^/]+\/playagain\/?$/i`;
  - join: `/^\/games\/[^/]+\/[^/]+\/join\/?$/i`.
- Native guard admission, for a create or `playAgain` path:
  - secret → admit;
  - otherwise `requireAdminSession` (new required dependency): `ok` → admit;
  - `forbidden` → `403 { error: 'Matches are created through the /api/match routes; this native create route accepts only
    a server-internal delegation or an admin session.' }` (the same message for `playAgain`);
  - `unauthorized` → the existing 401 and message;
  - `lookup_failed` → `500 { error: 'The admin check for this native create could not be completed; try again in a
    moment.' }`.
  - Join admission is unchanged (secret or session); only its path test is normalized. `leave` and the other
    built-ins are unchanged.
- Bot-ally context: `requireAdminSession` is destructured from the context, never asserted. `registerBotAllyRoutes`
  registers the operator create route only when it is a function; `server.mjs` supplies it.
- Scoring: `'debug_match'` appended to `SubmissionRejectionReason` and `SUBMISSION_REJECTION_REASONS` in lockstep;
  `submitCompetitiveScoreImpl` returns `{ ok: false, reason: 'debug_match' }` when
  `(reduced.finalState as LegendaryGameState).isDebugMatch === true`, placed immediately **before** the `ended_early`
  check. HTTP 422 via the existing default.

## Scope (In)

### A) Engine — the flag (`types.ts`, `setup/buildInitialGameState.ts`)
- Add `isDebugMatch?` to `MatchConfiguration` and to `LegendaryGameState`, each with a `// why:` naming D-24689 and the
  omit-when-off hash rule.
- `buildInitialGameState` spreads the flag only when `config.isDebugMatch === true`.

### B) Engine — the public badge field (five-step rule, `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`)
1. Declare `isDebugMatch?: boolean` on `UIState`.
2. Populate it in `buildUIState` (conditional spread).
3. Pass it through `filterUIStateForAudience` for every audience (public), mirroring the `hollowEffects` block.
4. Audience test (§E).
5. The Play Diagnostics `uiStateSnapshot` carries it in an operator match (§Verification live step 8; the existing
   client's export needs no change).

### C) Engine — the operator projection (`ui/operatorView.types.ts`, `ui/operatorView.build.ts`, `index.ts`)
- The types and `buildOperatorView` exactly as in §Locked Contract Values.
- `countWoundsInZone(zone)` is a module-private helper in `operatorView.build.ts`. `countWounds` in `uiState.build.ts` is
  not changed or exported.
- Export the function and types from `index.ts`, under a `// Operator projection (WP-802)` comment beside the
  `buildUIState` export.

### D) Server — operator module (`apps/server/src/operator/`)
- `operatorMatch.logic.ts`: `setupDataCarriesOperatorFlag` and `OPERATOR_FLAG_REFUSAL_MESSAGE`.
- `operatorBotDecisions.ts`: the in-memory record (§Locked Contract Values). A module-level `Map`, insertion-order
  eviction. No timer, no I/O.
- `operatorMatch.routes.ts`: `registerOperatorMatchRoutes(router, context)` with `{ db, requireAdminSession, verifier,
  accountResolver, database }`. It registers the eligibility and board routes. The board route:
  1. runs the admin check;
  2. reads the live state with `db.fetch(matchId, { state: true })` (a missing state → 404);
  3. builds `OperatorBuildContext` from `state.ctx.phase`, `state.ctx.turn` and `state.ctx.currentPlayer`;
  4. calls `buildOperatorView(state.G, context)` (`null` → 409);
  5. returns the view plus `readOperatorBotDecisions(matchId)`.
  The read carries a `// why:` citing D-24689 §4.
- TypeScript, mirroring `billing/adminBilling.routes.ts` (dependency injection, full-sentence error bodies).

### E) Server — create paths
- `bot-ally/botAllyRoutes.mjs`:
  - move the four create steps (native create, bot-seat joins, `insertBotAllyMatch` + `startDriverForMatch`, auto-ready)
    out of the `create-with-bot` handler into one named module-level function, used by both routes. It takes
    `{ context, createSubmit, numPlayers, botCount, policy, setupData, unlisted }` as arguments (`createSubmit` is still
    built in `registerBotAllyRoutes` by `resolveCreateSubmit`) and returns `{ ok: true, matchId }` or
    `{ ok: false, status, error }`; each route maps that to its response. The ~110 lines of steps (L597–713) split into
    named sub-helpers (native create, join bot seats, start and ready) under the 30-line rule. The
    public route's behavior is unchanged except for the refusal;
  - register `POST /api/admin/operator-match/create-with-bot` in the same function, only when
    `context.requireAdminSession` is a function (destructured, never asserted; `collectHandler` in the existing test
    and the guest-solo context don't supply it). The shared create function takes an `unlisted` argument: `false` for
    the public route, `true` for the operator route;
  - the public route refuses the flag;
  - `startDriverForMatch` passes an `onDecision` callback to `decideBotMove`. It records the decision only when
    `state.G.isDebugMatch === true`. Revived drivers record too, because rehydration goes through
    `startDriverForMatch` (L809). Fault-fallback moves (`runFaultFallback`, `botAllyDriver.mjs` ~L1139 / ~L1151 / ~L1206)
    bypass `decide` and are not recorded; the driver's fault log already names them. Seat-choice submissions
    (`handleSeatChoiceTick` → `submitBotSeatChoice` → `decideBotSeatChoiceMove`, `botAllyDriver.mjs` ~L696 / ~L744) are
    engine defaults and are not recorded either.
- `bot-ally/botAllyDriver.mjs`: the optional `onDecision` parameter on `decideBotMove`.
- `match/matchGate.routes.ts` and `autoplay/autoplay.mjs`: the refusal, before the loopback create.
- `match/nativeLobbyGuard.ts`: the normalized path test for create, `playAgain` and join, and the create rule for the
  create and `playAgain` paths. `requireAdminSession` joins `NativeLobbyGuardDependencies`.
- `competition/competition.types.ts` and `competition/competition.logic.ts`: `debug_match`.
- `server.mjs` (runtime wiring): register the operator routes, and pass `requireAdminSession` to the native guard and the
  bot-ally context.

### F) New tests
- `packages/game-engine/src/game.test.ts`:
  1. `setup()` with `isDebugMatch: true` stores `G.isDebugMatch === true`;
  2. an absent flag or `false` leaves **no** `isDebugMatch` key (`Object.keys` assertion);
  3. a non-boolean truthy value (`'yes'`) leaves no key.
- `packages/game-engine/src/ui/uiState.filter.test.ts`:
  1. an operator-match `UIState` keeps `isDebugMatch: true` for its own player, another player and a spectator;
  2. a normal `UIState` has no `isDebugMatch` key for any audience (keyset assertion on a **built** projection).
- `packages/game-engine/src/ui/operatorView.build.test.ts` (new):
  1. `null` for a normal `G`;
  2. every seat's five zones, in stored order, sorted by player id;
  3. `woundsByZone` with Wounds in hand, discard and deck counted separately (the D-24684 case);
  4. the three decks top-first, plus the supply counts, the KO and escaped piles, and `counters` equal to
     `G.counters` (a copy: mutating it leaves `G.counters` unchanged);
  5. `cardDisplay` holds exactly the ids that appear;
  6. mutating the returned arrays leaves `G` unchanged (aliasing defense);
  7. two calls on the same `G` deep-equal (determinism).
- `apps/server/src/operator/operatorMatch.logic.test.ts` (new):
  1. `setupDataCarriesOperatorFlag` is true for `isDebugMatch: true`, `false` and `'x'`, and false for absent, `null` and
     a non-object;
  2. the bot record keeps the most recent 50 per match (the 51st drops the first) and evicts the oldest match past 20;
  3. a read returns a copy.
- `apps/server/src/operator/operatorMatch.routes.test.ts` (new):
  1. each route returns 401 / 403 without an admin session, and runs the admin check before any `db.fetch`;
  2. eligibility returns 200;
  3. board returns 404 for an unknown match, 409 for a normal match, 500 when `db.fetch` throws, and 200 with
     `operatorView.seats` and `botDecisions` for an operator match.
- `bot-ally/botAllyRoutes.test.ts`:
  1. the public route returns 400 with the refusal for a flagged `setupData` and does no loopback create;
  2. the operator route creates with `isDebugMatch: true` and `unlisted: true` in the native create body, and is
     refused without an admin session;
  3. a driver started through `startDriverForMatch` for an operator match records forced and policy decisions
     (`readOperatorBotDecisions`); a normal match's driver records nothing. Method: read the driver from
     `botAllyDrivers`, stop its timer, call `.tick()` with a lease-granting database fake, and use a real engine state
     (the `buildInitialGameState` fixture pattern in `botAllyDriver.test.ts`).
- `bot-ally/botAllyDriver.test.ts`: `onDecision` gets `isForced: true` for a forced pending choice, and the policy's
  `decisionLog` on the policy path. The return value deep-equals the baseline `{ name, args }`, including when
  `onDecision` throws.
- `match/matchGate.routes.test.ts` and `autoplay/autoplayDefault.test.ts`: a flagged `setupData` → 400 and no loopback
  create.
- `match/nativeLobbyGuard.test.ts` (a new `adminSessionDeps` fixture whose `requireAdminSession` returns
  `{ ok: true, accountId }`):
  - an admin session admits create and `playAgain`;
  - a non-admin session gets 403 on `playAgain` with the locked message and no pass-through;
  - a `playAgain` with no session gets 401; with the secret it passes;
  - path variants are guarded: `/games/legendary-arena/create/`, `/games/legendary-arena/CREATE`,
    `/games/legendary%2Darena/create` and `/games/legendary-arena/m-1/playagain` each get 403 for a non-admin session,
    and `/games/legendary-arena/m-1/join/` gets 401 with no session; none passes through. The encoded path is passed
    raw to `makeContext` (Koa's `ctx.path` is undecoded, which is what the patterns are built for);
  - `lookup_failed` → 500;
  - a non-admin session still admits **join**.
- `competition/competition.logic.test.ts`: an operator-match replay with published PAR is rejected `debug_match`, and no
  row or badge is written.

### G) Existing tests — authorized edits (scaffold)
- `match/nativeLobbyGuard.test.ts`:
  - `acceptingSessionDeps` and `rejectingSessionDeps` gain a `requireAdminSession` fake. `acceptingSessionDeps` models
    a valid **non-admin** session: `{ ok: false, code: 'forbidden', reason }`. `rejectingSessionDeps` returns
    `{ ok: false, code: 'unauthorized', reason }`. These are fixture additions.
  - `POST create with a valid session (no secret) passes through` is rewritten as `POST create with a valid non-admin
    session (no secret) returns 403 and does not pass through`.
  No other assertion in the file changes.
- `competition/competition.logic.test.ts` `SUBMISSION_REJECTION_REASONS array matches SubmissionRejectionReason union`
  (~L967): add `case 'debug_match':` and append `'debug_match'` to `expectedReasons`. This is the D-24306 lockstep
  precedent.
- **Rewrite rules (Reward Integrity).** No assertion is removed or weakened. Commit 1's `Tests-changed:` trailer names
  both edits and the old → new title. `git diff origin/main -- '*.test.ts'` touches only these edits plus §F additions.

### H) Docs
- `docs/ai/REFERENCE/api-endpoints.md` (D-11804, whole rows):
  - three **new** rows, one per operator route (`Wired`, `admin-session-required`);
  - **replace** the `POST /games/legendary-arena/create` row: Auth becomes `admin-session-required` for an external
    caller, and the Notes say the server-internal delegation still admits the loopback creates and that join is
    unchanged;
  - a **new** `POST /games/legendary-arena/{matchID}/playAgain` row (`admin-session-required`, same Notes), and
    **replace** the boardgame.io built-ins row (L268) so it no longer covers `playAgain`;
  - **replace** the `requireAdminSession` `Library-only` row (L317) to add WP-802 as a caller, and the Auth Taxonomy
    `admin-session-required` row (L48) "Callers" list; add a "Last updated" footer entry;
  - **replace** the rows for `POST /api/match/create`, `POST /api/match/autoplay` and `POST /api/match/create-with-bot`
    (the 400 refusal);
  - **replace** the `POST /api/competition/scores` row (`debug_match` → 422).
- `docs/ai/ARCHITECTURE.md` §Persistence Boundary (Cross-Layer): add the D-24689 carve-out sentence after D-24187's,
  and change "All other application reads" accordingly.
- `.claude/rules/architecture.md` §Persistence Boundary (Cross-Layer): "four" → "five" carve-outs, adding a D-24689
  clause in the same style.
- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` §Extensibility Rules and `docs/ai/REFERENCE/00.2-data-requirements.md`
  (after the `finalBlow` paragraph): one paragraph each. `isDebugMatch` is a creation-payload field consumed by the
  engine, never a loadout-envelope field (the registry `EnvelopeSchema` rejects it), set only by the operator route
  (D-24689).
- `wiki/why-play-needs-a-debug-panel.md`: each Open Question gets a one-line "Answered: D-24689 §N" pointer, and the
  Summary links WP-802. `last-reviewed` is updated.
- `docs/ai/DECISIONS.md`: D-24689 (content below) lands Active.
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md` (📝 → ✅, then `pnpm roadmap:counts:write`).

## D-24689 Content

**Operator match: an admin-created, never-scored match with a reveal-all board read (WP-802). Answers the six open
questions on `wiki/why-play-needs-a-debug-panel.md` and constrains the arc's follow-ons.**

1. **Identity (Q6).**
   - The flag is `isDebugMatch?: boolean` on the creation payload `MatchConfiguration`, beside `finalBlow`. It is never
     part of the loadout envelope (`SetupEnvelope` / `EnvelopeSchema` stay strict), the LAGN document or the 9-field
     composition.
   - `Game.setup()` writes `G.isDebugMatch = true` only for a strict `true`, and omits it otherwise, so normal matches
     and every hash oracle are byte-identical. Nothing writes it after setup.
   - `UIState.isDebugMatch` is public to every audience, so every seat and every diagnostics export shows the match is
     an operator match.
2. **Creation is admin-only.**
   - Only `POST /api/admin/operator-match/create-with-bot` sets the flag.
   - Every public create path that forwards caller `setupData` refuses a payload carrying the key (400).
   - The native-lobby guard recognizes every path the router serves for create, `playAgain` and join
     (case-insensitive, any game-name segment, optional trailing slash), closing the existing D-24094 path-variant bypass.
   - boardgame.io's native create and `playAgain` admit only the server-internal delegation or an admin session. No
     client uses either; a non-admin session gets 403. This narrows D-24094's session admission for those two routes
     only; join is unchanged. It also closes the `playAgain` path by which a guest could mint a match outside the
     D-24092 gate. A `playAgain` on an operator match yields another operator match, which only an admin can request.
   - The operator match is created `unlisted`, so it never appears in the public match list.
   - Any future create proxy that forwards caller `setupData` must refuse the flag the same way.
3. **Never scored.**
   - `submitCompetitiveScoreImpl` rejects an operator match with the permanent reason `debug_match` before any score,
     badge or row is written, beside `ended_early` (D-24306).
   - It is never ranked, never on a leaderboard, never a gauntlet leg, never a Casual row, and never PAR-eligible (no
     seed-challenge feature exists today; any future one reads `competitive_scores` and inherits this).
   - Capture (`bgio.replay_artifacts`) still runs; a replay of an operator match is a tool, not a result.
4. **Reads travel over an admin HTTP route (Q1), under a fifth framework-store carve-out.**
   - **The carve-out:** for an `admin-session-required` route, a server-layer read MAY read a match's live `state`
     solely to test `G.isDebugMatch`, and MAY pass it to the engine's `buildOperatorView` (a derived, read-only
     projection) only when that is `true`.
   - **Its limits:** the projection is never written back, never persisted, never a save-game, never round-tripped into
     gameplay state, and never a source of competitive or derived features. It is refused (409) for any other match.
   - **Why not a spectator connection:** spectators are unauthenticated, so a reveal-all audience in `playerView` could
     not be admin-gated. `playerView` and the player audiences are unchanged.
   - **Two narrow `G.isDebugMatch` reads ride on reads that already exist:** the bot-ally driver MAY test it on the
     state it already fetches, solely to decide whether to record a decision (§5); and `submitCompetitiveScoreImpl`
     tests it on `reduced.finalState` under D-24119 (§3). Neither read widens what those paths do with the state.
5. **Bot decisions are shown live, from server memory (Q4).**
   - **What is recorded:** for each bot decision in an operator match, the server keeps the turn, the seat, whether the
     move was forced, the move, the policy's own `decisionLog` (the chosen move and up to two scored alternatives) and
     the legal-move count.
   - **Where it lives:** process memory, capped at 50 per match and 20 matches. It is not in `G`, the move log or any
     table, and a restart loses it. It is per instance: during a deploy overlap (the WP-437 lease) the board route can
     land on the instance that isn't driving the bot and show an empty list. Fault-fallback moves and seat-choice
     submissions (engine defaults) are not recorded. The record keeps the most recent 50 decisions per match.
   - **Who sees it:** the board route returns it; the client follow-on's snapshot download saves it. It is not added to
     the player diagnostics export.
   - A full scored list of every legal move needs an engine change to `ai.competent.ts` and is not needed: a forced
     singleton (the D-24688 class) is visible as `isForced: true, legalMoveCount: 1`.
6. **UI (Q5).**
   - The read-only panel is a Vue 3 SFC in the arena-client, loaded with `defineAsyncComponent` only in an operator
     match for an admin. The arena-client has no UI library, and the read-only panel adds no dependency.
   - The setters' control pane adopts Tweakpane, the shared debug-panel library named on the Herbs vs. Ailments page.
     It is mounted inside that Vue panel as a lazy chunk; the setters packet adds the dependency.
7. **Setters, for the follow-on packet (Q3).**
   - **Order:** (1) set a supply pile count; (2) move a card already in the villain deck to its top; (3) reveal the next
     Scheme Twist or Master Strike now, moving one already in the villain deck to the top and revealing it through the
     normal reveal path; (4) move a card already in the match from one zone to another through the zone and gain helpers.
   - **Conservation:** a setter never creates or destroys a card and never names a card outside the match's loaded
     composition. The engine never queries the registry after setup, so such a card has no data. A supply decrease moves
     cards to a set-aside zone that no rule reads. Its name and `G` shape belong to the setters packet and are written
     only when used.
   - **Move rules:** every setter is a boardgame.io move under the Move Validation Contract. It:
     - returns silently unless `G.isDebugMatch === true`;
     - is refused while any pending choice is open;
     - runs only on the operator's own turn, in the `main` stage;
     - uses no `ctx.random` or `Math.random` (reorder, never re-roll);
     - writes a `pushLog` line starting "Operator:".
   - Because setters are moves, they are in the move log and replay faithfully.
8. **Jump to turn N, for its follow-on packet (Q2).**
   - It needs its own carve-out entry: reading `initialState + log` of **any** match, finished or in progress, to
     rebuild a read-only board stopped at move N. Gap 2 was a normal match. It is admin-only and never written back.
   - It replays on the current server build. No build is recorded per match today: `bgio.replay_artifacts` has no
     version column, and D-24119 does no build check. So that packet records the server build at match creation and
     shows "played on build X, replayed on build Y" (or "build unknown").
   - It labels the result rather than refusing, because the matches worth inspecting are usually from an earlier build.

**Reserved by:** NUMBER-LEDGER D-24689 (#2688). Related: D-24026, D-24095, D-24119, D-24153, D-24169, D-24187, D-24306,
D-24503, D-24094, D-15901, D-12803, D-24684, D-24686, D-24688.

## Limitations (accepted)

- A stolen admin session reveals every operator match. That is the same exposure as every other
  `admin-session-required` route.
- Join is unchanged. Anyone who learns an operator match's id can take its open human seat before the admin does, and
  the admin would then see that player's hand. The match is `unlisted`, and its id goes only to the admin.
- The bot record is per instance and lost on restart (D-24689 §5).
- An admin `playAgain` on an operator match creates another operator match, **listed** unless the request body sets
  `unlisted: true` (boardgame.io reads `unlisted` from the body only), and with no bot driver.
- Each public proxy's refusal is the only flag check on that path, because the native route can't read the body. A
  future create proxy that forwards caller `setupData` must add the same refusal, or it reopens the hole (D-24689 §2).

## Out of Scope

- Any arena-client file: the lobby option, the panel, the badge, skipping the submit, and the downloads (planned follow-on
  1). Until it ships, an operator match's gameover submit gets a 422 `debug_match` from the server. That is the
  authoritative refusal; the client follow-on skips the submit, as WP-502 does for `ended_early`.
- Setters and their `G` set-aside zone (follow-on 2). Jump to turn N and its build stamping (follow-on 3).
- A full scored candidate list from the competent policy (D-24689 §5).
- Labelling operator matches on `/api/dash/matches` (D-24169). The raw `matchConfiguration` already carries
  `isDebugMatch`; a dashboard packet can read it.
- Autoplay (Watch Bot Play) operator matches. The operator create route is bot-ally only.
- The registry `SetupEnvelope`, LAGN and the 9-field composition.

## Files Expected to Change

- `packages/game-engine/src/types.ts` — **modified** — `MatchConfiguration` and `LegendaryGameState` fields
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — omit-when-off spread
- `packages/game-engine/src/game.test.ts` — **modified** — §F cases
- `packages/game-engine/src/ui/operatorView.types.ts` — **new** — contract types
- `packages/game-engine/src/ui/operatorView.build.ts` — **new** — `buildOperatorView`
- `packages/game-engine/src/ui/operatorView.build.test.ts` — **new**
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `isDebugMatch?`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — public pass-through
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — audience cases
- `packages/game-engine/src/index.ts` — **modified** — exports
- `apps/server/src/operator/operatorMatch.logic.ts` — **new**
- `apps/server/src/operator/operatorMatch.logic.test.ts` — **new**
- `apps/server/src/operator/operatorBotDecisions.ts` — **new**
- `apps/server/src/operator/operatorMatch.routes.ts` — **new**
- `apps/server/src/operator/operatorMatch.routes.test.ts` — **new**
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — **modified** — shared create steps, operator create route, refusal,
  `onDecision`
- `apps/server/src/bot-ally/botAllyRoutes.test.ts` — **modified** — §F cases
- `apps/server/src/bot-ally/botAllyDriver.mjs` — **modified** — optional `onDecision`
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **modified** — §F case
- `apps/server/src/match/matchGate.routes.ts` — **modified** — refusal
- `apps/server/src/match/matchGate.routes.test.ts` — **modified** — §F case
- `apps/server/src/autoplay/autoplay.mjs` — **modified** — refusal
- `apps/server/src/autoplay/autoplayDefault.test.ts` — **modified** — §F case
- `apps/server/src/match/nativeLobbyGuard.ts` — **modified** — create and `playAgain` rule
- `apps/server/src/match/nativeLobbyGuard.test.ts` — **modified** — §G edits + §F cases
- `apps/server/src/competition/competition.types.ts` — **modified** — `debug_match`
- `apps/server/src/competition/competition.logic.ts` — **modified** — the refusal
- `apps/server/src/competition/competition.logic.test.ts` — **modified** — §G drift edit + §F case
- `apps/server/src/server.mjs` — **modified** — runtime wiring (01.5, named here)
- `docs/ai/REFERENCE/api-endpoints.md`, `docs/ai/ARCHITECTURE.md`, `.claude/rules/architecture.md`,
  `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md`, `docs/ai/REFERENCE/00.2-data-requirements.md`,
  `wiki/why-play-needs-a-debug-panel.md` — **modified** — §H
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close

Thirty code files are well over the ~8-file guidance, so here is why. The engine half (11 files) has no consumer without the server
routes. The server half without the engine flag can't tell an operator match from a normal one. The create-path hardening
(8 files) must land with the flag, or a player could forge an operator match the day it ships. Most files carry a few
lines. The client is already split out.

## Contract

- Locks `isDebugMatch` on `MatchConfiguration`, `G` and `UIState`; the `OperatorView` types and `buildOperatorView`; the
  three operator routes; the `debug_match` reason; the native-create admission rule; the bot record shape and caps.
- No change to the `MatchSetupConfig` composition, `SetupEnvelope`, LAGN, `UIAudience`, any move, phase, stage, trigger,
  effect or canonical engine array.

## Acceptance Criteria

1. `setup()` with `isDebugMatch: true` gives `G.isDebugMatch === true`. Absent, `false` or `'yes'` gives no
   `isDebugMatch` key.
2. A built `UIState` carries `isDebugMatch: true` for its own player, another player and a spectator in an operator
   match. It carries no such key in a normal match.
3. `buildOperatorView` returns `null` for a normal `G`. For an operator `G` it returns every seat's five zones in stored
   order, `woundsByZone` per zone, the three decks top-first, the supply counts, the KO and escaped piles, `counters` (a fresh copy of `G.counters`), and
   `cardDisplay` for exactly the ids present. Mutating the result leaves `G` unchanged.
4. Every operator route returns 401 without a session and 403 for a non-admin session, and the board route reads no state
   before the admin check.
5. The board route returns 404 for an unknown match, 409 for a normal match, 500 when `db.fetch` throws, and 200 with
   `operatorView` and `botDecisions` for an operator match.
6. `POST /api/admin/operator-match/create-with-bot` creates a bot-ally match whose native create body carries
   `isDebugMatch: true` and `unlisted: true`.
7. `POST /api/match/create`, `POST /api/match/autoplay` and `POST /api/match/create-with-bot` return 400 with the locked
   message for a flagged `setupData`, and make no loopback create.
8. The native create and `playAgain` admit the secret and an admin session. They return 403 for a non-admin session
   and 401 with no session, on the canonical path and on every §F path variant. A non-admin session still joins, and an
   anonymous join on a path variant gets 401.
9. An operator-match submission with published PAR is rejected `debug_match` (HTTP 422), and no `competitive_scores`
   row or badge is written. Evidence is the DB-gated test actually running (the CI DB job, or a local run with
   `TEST_DATABASE_URL`). A skipped run is not a pass.
10. In an operator match the bot record holds forced and policy decisions, with the policy's `decisionLog`. In a normal
    match nothing is recorded (both through `startDriverForMatch`). `decideBotMove`'s return value is unchanged.
11. The only changed existing tests are the §G edits.
12. `pnpm -r build` exits 0. `pnpm -r --no-bail test` reports 0 failures in every package. The replay fixture
    `finalStateHash` and `PRE_WP080_HASH` are unchanged. `sim:runtime-observed:check`, `sim:coverage --check` and
    `par:seed:test` are unchanged.

## Verification Steps

```pwsh
pnpm -r build
pnpm -r --no-bail test
pnpm sim:runtime-observed:check
pnpm sim:coverage --check
pnpm par:seed:test
pnpm ledger:numbers:check
pnpm roadmap:counts:check
git diff --name-only origin/main
git diff origin/main -- '*.test.ts'
git grep -n "isDebugMatch" -- packages/registry
git grep -n "SELECT is_admin" -- apps/server/src
git grep -n "is_admin" -- apps/server/src/operator apps/server/src/match apps/server/src/bot-ally apps/server/src/autoplay apps/server/src/competition
```

Expected:
- every `pnpm` command exits 0;
- the name diff lists only §Files Expected to Change;
- the test diff touches only §G edits and §F additions;
- `isDebugMatch` has no hit under `packages/registry`;
- `SELECT is_admin` returns exactly `apps/server/src/auth/adminSession.ts:104` (the D-15902 single-reader gate);
- the scoped `is_admin` grep is empty (it is empty today).

**Live (D-24026), after merge and deploy**, with an admin bearer token (PowerShell `Invoke-RestMethod`):
1. eligibility returns `{ isOperator: true }`;
2. the operator create returns a `matchId`; join seat 0 and play a turn;
3. board returns every seat's zones and at least one bot decision;
4. a normal match's board returns 409;
5. `POST /api/match/create` with `isDebugMatch` returns 400;
6. a non-admin token gets 403 on the native create, on `playAgain` and on `/games/legendary-arena/create/`; an
   anonymous POST to `/games/legendary-arena/create/` gets 401;
7. the operator match is absent from `GET /games/legendary-arena?isGameover=false`;
8. the Play Diagnostics export from the operator match (seat 0) has `uiStateSnapshot.isDebugMatch === true`.

Record the matchId in STATUS.

## Definition of Done

- [ ] Acceptance Criteria 1–12 pass, with command output pasted into the PR.
- [ ] `git status --porcelain` / `git diff --name-only origin/main` ⊆ §Files Expected to Change. Revert line-ending-only
      churn such as `lagn-v1.json`.
- [ ] D-24689 Active in DECISIONS. The carve-out sentence is in ARCHITECTURE.md and `.claude/rules/architecture.md`. The
      §H rows are in `api-endpoints.md` as whole rows.
- [ ] STATUS, WORK_INDEX (`[x]` with date), EC_INDEX and the mindmap (✅, counts regenerated) updated.
- [ ] Two commits in the same PR: `EC-839:` (code + tests + the `api-endpoints.md` rows, D-11804) and `SPEC:`
      (governance close). Neither subject contains a commit-msg Rule 1 token; write "operator match", never
      `isDebugMatch` or `debug_match`.
- [ ] D-24026 live verification after deploy (§Verification Steps), recorded as a STATUS flip.

## Open Operator Decisions (do not block execution)

- **OD-1 — Operator matches on `/api/dash/matches`.** They are listed like any match. Recommendation: label them in a
  dashboard packet that reads `matchConfiguration.isDebugMatch`.
- **OD-2 — The interim submit.** Until the client follow-on ships, an operator match's gameover submit gets a 422
  `debug_match`. Recommendation: accept. The server refusal is authoritative, and operator matches are created only by
  request in that window.

## Vision Alignment

- §3 Player Trust & Fairness: an operator match can never reach a leaderboard, gauntlet, badge or score row, and only an
  admin can create one.
- §4 Faithful Multiplayer Experience: no seat or spectator gains any hidden information. The reveal-all read is
  admin-only, over HTTP.
- §8 Deterministic Game Engine: no randomness and no new move. Normal matches and every hash oracle are byte-identical
  (omit-when-off).
- §7 Strict Layer Separation: the engine builds the view; the server only gates, reads and wires.
- §18 Replayability & Spectation: spectators gain nothing, and replay capture of an operator match still runs.
- §14 Explicit Decisions, No Silent Drift: D-24689 records the fifth carve-out, the native-create narrowing and the arc's
  rulings.
- §22 / §23 / §24 (reproducible, submitted and replay-verified scoring): a new permanent rejection keeps operator matches
  out of every competitive surface.
- **Conflict assertion:** No conflict. The persistence boundary gains a fifth read-only carve-out, recorded in D-24689
  §4 and ARCHITECTURE.md. Nothing new is persisted.
- **Determinism:** the projection and setup are pure. The bot record is server memory outside `G`, and the move log is
  unchanged.
- **NG-1..NG-8:** none crossed. Operator tooling is not a product feature and no purchase reaches it.

## Funding Surface Gate

N/A — operator tooling with no commerce, account-tier or entitlement surface.

## API Catalog

Applies (D-11804). Four new rows (three operator routes, native `playAgain`) and whole-row replacements of the native
create, the built-ins row, `/api/match/create`, `/api/match/autoplay`, `/api/match/create-with-bot`,
`/api/competition/scores`, the `requireAdminSession` Library-only row and the Auth Taxonomy `admin-session-required`
row, all in the `EC-839:` code commit (commit 1), the same commit as the route changes. A `SPEC:` commit can't carry
code (commit-msg Rule 5).

## Lint Gate Self-Review (00.3)

All 21 sections are satisfied or N/A. The gate ran as an independent subagent: FAIL on the first pass (9 sections, plus 2
EC items), FAIL on the delta (2 one-line items), then PASS.
- **First-pass FAILs, all fixed:**
  - §4: Read lacked 00.2 §7, MATCH-SETUP-SCHEMA, the Layer Boundary and the commit-msg hook;
  - §8: D-24689 §4 said the driver reads were "not covered", while §E reads `G.isDebugMatch` there. Both narrow reads
    are now named;
  - §11: no `## Limitations (accepted)`;
  - §13 / §18: the `is_admin` grep's expected result was false today. It became the D-15902 `SELECT is_admin` gate plus
    an empty scoped grep, and new text cites D-15902 instead of naming the column;
  - §14: AC 10 had no backing test (added §F bot-ally case 3), and AC 9 could pass on a skipped DB test (evidence rule
    added);
  - §15: the second commit subject lacked the forbidden-token rule (`isDebugMatch` itself trips "debug");
  - §16: code-style limits restated (30-line functions, module-level shared create function, no nested ternaries);
  - §17: §12a replaced by §7 and §18;
  - §21: the catalog rows move into the `EC-839:` code commit (`SPEC:` can't carry code).
  - EC: Locked Values verbatim with `readonly`; the "isDebugMatch appears nowhere" precondition scoped to `packages apps`.
- **Delta FAILs, fixed:** AC 3 still named twist counts; one §E bullet still placed the shared create function inside
  `registerBotAllyRoutes`.
- **Advisories applied:** the `requireAdminSession` Library-only row and the Auth Taxonomy callers list; the fault-fallback
  line refs; the `playAgain`-is-listed Limitation.
- **§19:** N/A (commit-time). **§20 Funding:** justified N/A. **§21 API Catalog:** applies; closed-set Auth values and
  whole-row replacements.

## Gate Verdicts

- **Pre-flight (01.4): READY TO EXECUTE.** First pass NOT READY:
  - PS-1: boardgame.io's native `playAgain` was an unguarded create path that takes caller `setupData` (now guarded
    under the create rule; the operator match is created `unlisted`);
  - PS-2: the guard-test fixture contradicted the renamed 403 test (fixtures now model non-admin and admin separately);
  - RS-1..RS-5: the carve-out wording (test-only read), `counters` instead of a twist-pile length, fault-fallback moves
    not recorded, the per-instance record, and the optional bot-ally context field.
  Delta 1: READY after two text contradictions were fixed. Delta 2 (the normalized guard path test, which narrows join
  path variants): READY; the router claim and the three patterns were verified against 19 paths.
- **Copilot (01.7): PASS.** First pass RISK → HOLD:
  - F1: the guard's exact path test is bypassed by router variants (`/create/`, `/CREATE`, `%2D`). That is live today
    against D-24094; now a normalized POST-only test for create, `playAgain` and join;
  - F2: seat-choice submissions are not recorded (stated);
  - F3: `onDecision` in its own `try` / `catch`;
  - F4: the board route's 500 on a `db.fetch` throw;
  - F5: the record keeps the most recent 50;
  - F6: five-step rule step 5 verified live now (live step 8);
  - F7: the driver-test method.
  Delta: PASS.
- **Lint (00.3): PASS** — FAIL (first pass), FAIL (delta 1, two one-line items), PASS (delta 2, after the copilot fixes).
- **Empirical scaffold:** native-create tightening probed on `52aa008a` (§Context): 2 guard-test failures, 1 rewritten and
  1 unchanged under the locked design; every other server test green; engine 5047 / 0.
- **Out-of-band:** the live path-variant bypass is offered to Jeff as a separate INFRA hotfix, so it doesn't wait for
  this packet's execution. If that lands first, execution re-baselines `nativeLobbyGuard.ts` against it.
