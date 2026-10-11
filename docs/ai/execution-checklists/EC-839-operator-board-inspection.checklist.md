# EC-839 — Operator match: admin-only creation, never scored, reveal-all board read (Execution Checklist)

**Source:** docs/ai/work-packets/WP-802-operator-board-inspection.md
**Layer:** Server + Game Engine (projection and setup flag)

## Before Starting
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail. Record the counts (draft: engine 5047 / 0; server 1678 tests, 1472 pass, 206 skipped, 0 fail).
- [ ] Confirm on `main`:
  - `git grep -n isDebugMatch -- packages apps` is empty;
  - `MatchConfiguration` is `MatchSetupConfig & { readonly finalBlow?: boolean }` (`types.ts` ~L451);
  - `nativeLobbyGuard.ts` still admits a create with the secret or any session, and does not guard `playAgain`;
  - the three public create routes forward caller `setupData` (WP §Assumes);
  - `decideBotMove` still returns `{ name, args }` and drops `decisionLog`;
  - `SUBMISSION_REJECTION_REASONS` ends at `'ended_early'`;
  - `DECISIONS.md` has no D-24689 entry yet.
  If any differs, STOP and report.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker. `server.mjs` is the only runtime-wiring file and is named.

## Locked Values (do not re-derive)
- `MatchConfiguration = MatchSetupConfig & { readonly finalBlow?: boolean; readonly isDebugMatch?: boolean }`; `LegendaryGameState`: `readonly isDebugMatch?: boolean` via `...(config.isDebugMatch === true ? { isDebugMatch: true } : {})`; `UIState`: `isDebugMatch?: boolean`, public to every audience.
- `buildOperatorView(gameState, context: OperatorBuildContext): OperatorView | null`, plus the five types, exactly as WP §Locked Contract Values. `null` unless `gameState.isDebugMatch === true`. `board` is unfiltered `buildUIState`. Seats sorted by player id. Fresh arrays in stored order (index 0 next). `counters` is a fresh copy of `G.counters`.
- `setupDataCarriesOperatorFlag(setupData: unknown): boolean`: true for a non-null object with an own `isDebugMatch` key, any value. `OPERATOR_FLAG_REFUSAL_MESSAGE = 'This match setup carries isDebugMatch, which only the operator create route may set. Remove the field and create the match again.'`.
- Bot record: `OPERATOR_BOT_DECISION_CAP = 50` (keeps the most recent 50), `OPERATOR_BOT_DECISION_MATCH_CAP = 20` (insertion-order eviction); `OperatorBotDecision` shape per WP.
- `decideBotMove(state, botSeat, policy, onDecision?)`: return unchanged; forced → `isForced: true, decisionLog: []`; policy → `intent.decisionLog ?? []`; `onDecision` runs in its own `try` / `catch` (logged; the same move is returned).
- Routes: `GET /api/admin/operator-match/eligibility` (200 `{ isOperator: true }`), `POST /api/admin/operator-match/create-with-bot` (200 `{ matchId }`, creates with `{ ...setupData, isDebugMatch: true }` and `unlisted: true` in the native create body), `GET /api/admin/operator-match/:matchId/board` (200 `{ matchId, operatorView, botDecisions }` / 404 / 409 / 500 `{ error: 'The operator board could not be read from the match store; try again in a moment.' }` on a `db.fetch` throw). All: `no-store` first, `requireAdminSession` first, 401 / 403 / 500 by code.
- Public refusal: 400 `{ error: OPERATOR_FLAG_REFUSAL_MESSAGE }` before any loopback create, on `/api/match/create`, `/api/match/autoplay`, `/api/match/create-with-bot`.
- Guard path test (POST only): create `/^\/games\/[^/]+\/create\/?$/i`; `playAgain` `/^\/games\/[^/]+\/[^/]+\/playagain\/?$/i`; join `/^\/games\/[^/]+\/[^/]+\/join\/?$/i`.
- Native create **and** `playAgain`: secret → admit; admin → admit; `forbidden` → `403 { error: 'Matches are created through the /api/match routes; this native create route accepts only a server-internal delegation or an admin session.' }`; `unauthorized` → the existing 401 and message; `lookup_failed` → `500 { error: 'The admin check for this native create could not be completed; try again in a moment.' }`. The same 403 message for `playAgain`. Join admission (secret or session), `leave` and the other built-ins unchanged.
- Bot-ally context: `requireAdminSession` destructured, never asserted; the operator create route is registered only when it is a function.
- `'debug_match'` appended to the union and array; checked on `reduced.finalState` immediately before `ended_early`; HTTP 422 by the existing default.

## Guardrails
- `playerView`, `UIAudience` and every player and spectator audience are unchanged except the public `isDebugMatch`; no seat ever receives another seat's hidden zones or any deck order.
- The 9-field composition, the registry `SetupEnvelope` / `EnvelopeSchema` and LAGN are untouched (`git grep isDebugMatch -- packages/registry` is empty).
- Nothing new is persisted: no table, column, `bgio.*` write or `G` persistence. The bot record is process memory only.
- The admin check is the first business-logic step of every operator route; the board route never reads state before it.
- The server reads only `G.isDebugMatch`; the engine decides the view (`null` → 409).
- Normal matches are byte-identical: replay fixture `finalStateHash` and `PRE_WP080_HASH` unchanged; a moved oracle is a leak, never a re-pin.
- Existing-test edits are exactly WP §Scope G: two fixture fakes, one renamed guard test, and the drift-test lockstep. No assertion is removed or weakened. `Tests-changed:` trailer names them.
- The admin column stays read only by `auth/adminSession.ts` (D-15902); new code and comments cite D-15902 and never name the column.
- Functions ~30 lines max: `buildOperatorView` split into named per-section helpers; the shared bot-ally create steps are a named module-level function. No nested ternaries, no `import *`, no new barrel.
- Existing-test fixture rule: `acceptingSessionDeps` gets `requireAdminSession` → `{ ok: false, code: 'forbidden', reason }` (a non-admin session); `rejectingSessionDeps` → `unauthorized`; a new `adminSessionDeps` → `{ ok: true, accountId }`.

## Required `// why:` Comments
- `types.ts` (both fields) and `buildInitialGameState.ts`: D-24689; omit-when-off keeps normal matches byte-identical (WP-686 precedent).
- `uiState.filter.ts`: public to every audience so every seat and diagnostics export shows an operator match (D-24689 §1).
- `operatorView.build.ts`: the reveal-all projection exists only for an operator match; `board` is deliberately unfiltered.
- `operatorMatch.routes.ts` state read: the D-24689 §4 carve-out (operator matches only, read-only, never written back).
- Each public create refusal: only the operator route may set the flag (D-24689 §2).
- `nativeLobbyGuard.ts`: the body can't be read here (boardgame.io re-parses it), so create and `playAgain` admit only the delegation or an admin (D-24689 §2 narrows D-24094 for those two routes); and the three path patterns are case-insensitive with an optional trailing slash because `@koa/router` serves those variants.
- `competition.logic.ts`: an operator match is never scored (D-24689 §3, beside D-24306).
- `botAllyRoutes.mjs` `onDecision`: records only when `G.isDebugMatch === true`; never written to `G` (D-24689 §5).

## Files to Produce
- `packages/game-engine/src/types.ts`, `setup/buildInitialGameState.ts`, `game.test.ts` — **modified**
- `packages/game-engine/src/ui/operatorView.types.ts`, `ui/operatorView.build.ts`, `ui/operatorView.build.test.ts` — **new**
- `packages/game-engine/src/ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts`, `index.ts` — **modified**
- `apps/server/src/operator/operatorMatch.logic.ts`, `operatorMatch.logic.test.ts`, `operatorBotDecisions.ts`, `operatorMatch.routes.ts`, `operatorMatch.routes.test.ts` — **new**
- `apps/server/src/bot-ally/botAllyRoutes.mjs`, `botAllyRoutes.test.ts`, `botAllyDriver.mjs`, `botAllyDriver.test.ts` — **modified**
- `apps/server/src/match/matchGate.routes.ts`, `matchGate.routes.test.ts`, `nativeLobbyGuard.ts`, `nativeLobbyGuard.test.ts` — **modified**
- `apps/server/src/autoplay/autoplay.mjs`, `autoplayDefault.test.ts` — **modified**
- `apps/server/src/competition/competition.types.ts`, `competition.logic.ts`, `competition.logic.test.ts` — **modified**
- `apps/server/src/server.mjs` — **modified** — runtime wiring
- `docs/ai/REFERENCE/api-endpoints.md`, `docs/ai/ARCHITECTURE.md`, `.claude/rules/architecture.md`, `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md`, `docs/ai/REFERENCE/00.2-data-requirements.md`, `wiki/why-play-needs-a-debug-panel.md` — **modified** — WP §Scope H
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close

## After Completing
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail in every package; before / after counts recorded. Run the DB-backed server tests too if `TEST_DATABASE_URL` is available, else say they were skipped.
- [ ] Gates unchanged: `sim:runtime-observed:check`, `sim:coverage --check`, `par:seed:test`; replay fixture `finalStateHash` and `PRE_WP080_HASH`.
- [ ] Revert proofs, each failing ≥ 1 new test: drop the setup spread; drop the filter pass-through; return a view for a normal `G`; drop each of the three public refusals; restore session admission on native create; drop the `playAgain` guard; restore the exact-match path test (a `/create/` variant passes); drop `unlisted: true`; drop the `debug_match` check; record bot decisions in a normal match (via `startDriverForMatch`).
- [ ] `git status --porcelain` ⊆ Files to Produce (revert `lagn-v1.json` CRLF churn); `git grep isDebugMatch -- packages/registry` empty; `git grep -n "SELECT is_admin" -- apps/server/src` = exactly `auth/adminSession.ts:104`; `git grep -n "is_admin" -- apps/server/src/operator apps/server/src/match apps/server/src/bot-ally apps/server/src/autoplay apps/server/src/competition` empty.
- [ ] The DB-gated `debug_match` test actually ran (CI DB job or local `TEST_DATABASE_URL`); a skipped run is not a pass.
- [ ] `api-endpoints.md` in commit 1: four new rows (three operator routes, native `playAgain`) + whole-row replacements per WP §Scope H / §API Catalog; Auth values from the closed set.
- [ ] Commit 1, `EC-839: …`: code + tests + the `api-endpoints.md` rows, with `Tests-changed:` and `Vision: §3, §4, §7, §8, §14, §18, §22, §23, §24` trailers.
- [ ] Commit 2, `SPEC: WP-802 / EC-839 govern-close — …`: D-24689 Active (WP §D-24689 Content); the ARCHITECTURE.md and rules carve-out sentence; MATCH-SETUP-SCHEMA / 00.2 paragraphs; wiki pointers; STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write` + `:check`; `pnpm ledger:numbers:check`.
- [ ] Neither subject contains a commit-msg Rule 1 token (case-insensitive WIP / misc / tmp / updates / changes / debug): write "operator match", never `isDebugMatch` or `debug_match`.
- [ ] Live (D-24026), after merge + deploy only: the eight WP §Verification live steps with an admin token. Govern-close says "live-verify pending"; a post-deploy STATUS commit records the matchId.

## Common Failure Smells
- A normal match's `finalStateHash` moves → the flag or `UIState` field is written as `false` instead of omitted.
- Every seat suddenly sees opponents' hands → the operator view leaked into `playerView` or a player audience.
- The native create hangs or 500s for every proxy → the guard tried to read the request body.
- The operator create works but the board route says 409 → the operator route didn't add `isDebugMatch: true` to the native create body.
- Bot decisions are empty in an operator match → `onDecision` wired in the create handler only, not in `startDriverForMatch` (revived drivers miss it). Seat-choice and fault-fallback moves are never recorded (by design).
- An operator match's bot suddenly plays fallback moves → `onDecision` threw outside its own `try` / `catch`.
