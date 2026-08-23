# EC-628 — Endgame Report Card v2: Named Players, Raw-Score Ledger, Luck of the Draw (Execution Checklist)

**Source:** docs/ai/work-packets/WP-593-endgame-report-card-v2-named-players-styling-luck.md
**Layer:** Server (derived seat-identity projection on the submit response) + Arena Client (display) + docs/tests. No engine change.

## Before Starting
- [ ] Baseline: `pnpm -r build` exit 0; the endgame card renders today (WP-578/584/587/588 in place)
- [ ] Confirm the seat data exists: `readSeatAccounts` (WP-333), `readMatchBotSeats` (WP-375), `legendary.players.display_handle`

## Locked Values (do not re-derive)
- `MatchSeatIdentity = { playerId: string; isBot: boolean; handle: string | null }`. Full 0..seatCount-1 roster; a guest/handle-less seat → `{ isBot:false, handle:null }`.
- Submit 200 envelope: `{ record, wasExisting, seatIdentities? }`. `seatIdentities` is NEVER a `CompetitiveScoreRecord` key (the 16-key lock stays 16) and is NEVER persisted.
- Luck bands: ratio (actual adversity ÷ expected) ≤ 0.75 → favorable; ≥ 1.35 → difficult; else average. Zero expected + any actual → difficult; zero+zero → average. `undefined` when `parBaseline.schemeTwistsPar`/`bystandersLostPar` absent.
- Raw ledger: penalties positive (fixed order: twists, escapes, bystanders-lost, tactic, scenario; + `match lost` when `weightedLossPenalty>0`); earned = bystander + VP reward (shown subtracted); `total` = verbatim `rawScore`.
- Player label: `Player {index+1}` + ` (Bot)` if bot, else ` (@handle)` (one leading `@`, no double), else plain.

## Guardrails (execution order matters)
1. Server `match/seatAccount.logic.ts`: add `MatchSeatIdentity`, private `readHandlesByAccountIds` (ANY($1) over `legendary.players`), and `readSeatIdentities(matchId, seatCount, database)`.
2. Server `competition/competition.types.ts`: `SubmissionResult.ok` gains optional `seatIdentities?: readonly MatchSeatIdentity[]` (import the type from `../match/seatAccount.logic.js`). Do NOT add it to `CompetitiveScoreRecord`.
3. Server `competition/competition.logic.ts`: in `submitCompetitiveScoreByMatchIdForRequest`, after a successful `submitCompetitiveScoreForRequest`, read `readMatchSeatCount` + `readSeatIdentities` inside a try/catch and attach `seatIdentities`; on any error log-and-return the result unchanged (fail-safe). Runs on fresh insert AND idempotent retry.
4. Server `competition/competition.routes.ts`: 200 envelope conditionally spreads `seatIdentities` (omit, not null, when absent).
5. Client `lib/api/competitionApi.ts`: `CompetitiveSeatIdentity` type; optional `MyCompetitiveScore.seatIdentities`; `submitCompetitiveScore` folds `body.seatIdentities` into the returned record (conditional spread — exactOptionalPropertyTypes).
6. Client `vfx/scoreCalcDisplay.ts`: `RawLedgerLine`/`RawLedger`/`LuckRead` types; `WorkedScoreCalc.rawLedger`; `buildRawLedger`; `buildLuckRead` (exported); `playerLabel(playerId, identity?)` + `buildPerPlayerSplit(breakdown, seatIdentities?)`; `buildWorkedScoreCalc(breakdown, seatIdentities?)`. No nested ternary (luck ratio uses explicit `if/else`).
7. Client `components/hud/EndgameSummary.vue`: pass `seatIdentities` to `buildWorkedScoreCalc`; `luckRead` computed; render the raw-score ledger (`arena-hud-raw-ledger`, keep `competitiveRawScore` aria-label), and the luck section (`arena-hud-luck-read`, `luckHeadline`); add styles. Keep the WP-584 worked formula block intact (its aria-labels are tested).
8. Docs: `docs/ai/REFERENCE/api-endpoints.md` (submit row whole-row, D-11804); `docs/12-SCORING-REFERENCE.md` + ewiki `wiki/scoring.md` (report-card + luck section).
9. Tests: server `seatAccount.logic.test.ts` (`readSeatIdentities` roster/solo/blank-handle via a table-routing stub); arena-client `scoreCalcDisplay.test.ts` (ledger, named players, luck bands) + `EndgameSummary.test.ts` (ledger renders, named players, luck renders/omits).

- **Determinism:** NO engine/`G`/move/scoring change → both hash oracles byte-identical. If a hash oracle moves, STOP — you touched the wrong layer.
- **Record lock:** `Object.keys(record).sort()` stays the 16-key set. `seatIdentities` rides beside the record, never inside it.
- **Fail-safe:** the seat-identity read must never fail a score submission — degrade to plain "Player N".

## Required `// why:` Comments
- On `seatIdentities` (types + route + client fold): derived, non-persisted, not a record key — cite WP-593 / D-24402.
- On the fail-safe try/catch: a display-metadata read must never break a submission.
- On the luck bands + the `undefined`-when-no-baseline path: objective/deterministic; cite WP-593.
- On the ledger's fixed penalty order and the loss-penalty line: cite WP-593/WP-591.

## After Completing
- [ ] Server competition + seat tests green (`competition.logic`/`competition.routes`/`seatAccount.logic`)
- [ ] `pnpm -r build`; `(cd apps/arena-client && pnpm vue-tsc --noEmit)` clean; arena-client score/endgame/api tests green
- [ ] `pnpm -r --no-bail test` no new failures; `lagn-v1.json` CRLF churn reverted if present
- [ ] Live-on-surface (D-24026): a bot-ally ranked match shows named players + ledger + luck read
- [ ] `api-endpoints.md` submit row updated; `docs/12` + ewiki `/scoring/` updated
- [ ] STATUS names WP-593 (+ D-24026 pending); DECISIONS D-24402 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)
- The record-key-lock test fails → you added `seatIdentities` to `CompetitiveScoreRecord`; it belongs on the result/response envelope only.
- Per-player labels stay plain even with a bot → `seatIdentities` not threaded into `buildWorkedScoreCalc`, or the client fold dropped `body.seatIdentities`.
- Luck section never shows on a fresh match → the record predates WP-591 (no adversity baseline), or `buildLuckRead` got `parBaseline` without the two WP-591 fields.
- `competitiveRawScore` aria-label test fails → the ledger's net value must keep that aria-label (and the no-breakdown fallback line keeps it too).
