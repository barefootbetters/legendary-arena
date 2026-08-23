# WP-593 — Endgame Report Card v2: Named Players, Raw-Score Ledger, Luck of the Draw

**Status:** Draft 2026-08-23 — executing this session. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (endgame report card). The card now names each seat (`Player 1 (Bot)` / `Player 2 (@jeff)`), shows the Raw Score as a penalties/earned ledger, and gives an objective "Luck of the draw" read (favorable / even / difficult shuffle). D-24026 live-verification applies.
**Primary Layer:** Server (a derived seat-identity projection on the submit response) + Arena Client (display), no engine change.
**Dependencies:** WP-333 (`readSeatAccounts`), WP-375 (`readMatchBotSeats`), WP-338 (submit-by-matchId), WP-578/583/584/587/588 (endgame card + worked calc + per-player split), WP-591 (`ParBaseline.schemeTwistsPar`/`bystandersLostPar` — the luck read's expected-adversity source). All landed. Baseline `origin/main` at draft: `09baeef7`.

## Goal

Three operator-requested upgrades to the endgame report card:

1. **Named players.** The per-player split labels seats "Player 1 / Player 2" only. Add the human's handle and a bot marker: `Player 1 (Bot)` / `Player 2 (@jeff)`. The seat→identity map is not on the wire today (deck/identity are server-side), so this needs a small server projection.
2. **Raw Score restyle.** Present the raw score as a compact two-sided ledger — penalties that raised it (worse) beside rewards that lowered it (better), netting to the raw score — instead of only the monospace worked formula.
3. **Luck of the draw.** An OBJECTIVE, deterministic read of how favorable the shuffle was: the match's actual adversity (scheme twists / villain escapes / bystanders lost) versus what this scenario's PAR expects, banded into favorable / even / difficult and framed encouragingly ("you did your best with what you were dealt").

The OPINIONATED hero/purchase coaching (the LLM half of the operator's original item 3) is a separate Pass-gated feature and is **deferred to WP-B** — not built here.

## User-Visible Impact

The report card reads like a personal debrief: each seat is named (bot vs the human's handle), the raw score is a legible ledger rather than a formula wall, and the player gets an honest, encouraging read on whether the deck broke their way. All three are additive; an older record with no breakdown or no WP-591 baseline degrades gracefully (plain "Player N", plain raw figure, no luck section).

## Contract (Locked by D-24402)

1. **Seat identity (derived, non-persisted).** A `readSeatIdentities(matchId, seatCount, database)` server helper returns a full 0..seatCount-1 roster `{ playerId, isBot, handle }` (`handle: string | null`), built from `readSeatAccounts` + `readMatchBotSeats` + `legendary.players.display_handle`. `submitCompetitiveScoreByMatchIdForRequest` attaches it to the `ok` result and the `POST /api/competition/scores` handler returns it beside the record (`{ record, wasExisting, seatIdentities? }`). It is **never** a field of the locked 16-key `CompetitiveScoreRecord` and is **never** persisted. Fail-safe: any roster/handle read error leaves the submission untouched (card degrades to "Player N").
2. **Raw-score ledger (client-only).** `buildWorkedScoreCalc` gains a `rawLedger` (penalty lines + `penaltyTotal`, earned lines + `earnedTotal`, net `total` = verbatim `rawScore`) — a restyle of the same weighted values, never recomputed.
3. **Luck read (client-only, deterministic).** `buildLuckRead(breakdown)` compares actual adversity vs the WP-591 `parBaseline` expectation (`schemeTwistsPar` + `escapesPar` + `bystandersLostPar`) and bands the ratio: ≤0.75 favorable, ≥1.35 difficult, else average. Returns `undefined` when the record has no WP-591 adversity baseline (older rows). Computed from the breakdown only — never from deck order (the engine never projects it).

### Determinism / persistence
No engine change, no `G` field, no move, no scoring/formula change → `finalStateHash` / `PRE_WP080_HASH` untouched (no re-pin). `seatIdentities` is derived read-time match metadata attached to the HTTP response, never written to `legendary.competitive_scores`. The luck read and ledger are pure client display functions.

## Scope (In)

**Server:** `match/seatAccount.logic.ts` (`MatchSeatIdentity` type + `readSeatIdentities` + a private `readHandlesByAccountIds`); `competition/competition.types.ts` (`SubmissionResult.ok` gains optional `seatIdentities`); `competition/competition.logic.ts` (by-matchId path attaches `seatIdentities`, fail-safe); `competition/competition.routes.ts` (200 envelope returns `seatIdentities`).

**Arena Client:** `lib/api/competitionApi.ts` (`CompetitiveSeatIdentity` + optional `MyCompetitiveScore.seatIdentities`; `submitCompetitiveScore` folds it into the record); `vfx/scoreCalcDisplay.ts` (`RawLedger`/`LuckRead` types; `buildRawLedger`; `buildLuckRead`; named per-player labels from seat identities); `components/hud/EndgameSummary.vue` (ledger, named players, luck section + styles).

**Docs + tests:** `docs/ai/REFERENCE/api-endpoints.md` (submit response `seatIdentities`); `docs/12-SCORING-REFERENCE.md` + ewiki `/scoring/` (report-card + luck section); server + arena-client tests.

## Out of Scope

- The LLM hero/purchase coach (WP-B — Pass-gated, separate cost/infra arc).
- `seatIdentities` on the `GET /api/me/scores` history read (the endgame card uses the submit response; the history path keeps plain "Player N" to avoid a matchId-per-row resolution).
- Any engine / `G` / move / scoring change; any change to the locked `CompetitiveScoreRecord` shape.

## Acceptance Criteria

1. `readSeatIdentities` returns a full seat roster with bot seats flagged and human handles resolved; a guest/handle-less seat comes back `{ isBot:false, handle:null }`.
2. The `POST /api/competition/scores` 200 envelope carries `seatIdentities` on the by-matchId path; a roster read failure never fails the submission (fail-safe).
3. `buildRawLedger` splits penalties (positive, incl. loss penalty) from earned rewards, netting to the verbatim `rawScore`.
4. `buildLuckRead` bands favorable / average / difficult from actual-vs-expected adversity and returns `undefined` with no WP-591 baseline.
5. `EndgameSummary` renders `Player N (Bot)` / `Player N (@handle)`, the raw-score ledger, and the luck section; each degrades gracefully when its data is absent.
6. No game-state-hash re-pin; server + arena-client (`vue-tsc`) + `pnpm -r --no-bail test` green.

## Verification Steps

```bash
pnpm -r build 2>&1 | tail -3
node --import tsx --test apps/server/src/competition/competition.logic.test.ts apps/server/src/competition/competition.routes.test.ts apps/server/src/match/seatAccount.logic.test.ts 2>&1 | tail -6
(cd apps/arena-client && pnpm vue-tsc --noEmit && node --import tsx --import @legendary-arena/vue-sfc-loader/register --test "src/vfx/scoreCalcDisplay.test.ts" "src/components/hud/EndgameSummary.test.ts" "src/lib/api/competitionApi.test.ts" 2>&1 | tail -6)
pnpm -r --no-bail test 2>&1 | tail -6
# Live (post-deploy; D-24026): finish a ranked match with a bot ally on play.legendary-arena.com; the endgame card names Player N (Bot) + Player N (@handle), shows the raw-score ledger, and gives a luck read.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] All 6 Acceptance Criteria pass
- [ ] Verification Steps produce expected output (live step post-deploy)
- [ ] Seat identities derived + non-persisted; ledger + luck read client-only; graceful degradation on every optional path
- [ ] No game-state-hash re-pin; no engine/`G`/move/scoring change; `CompetitiveScoreRecord` 16-key lock untouched
- [ ] `docs/ai/REFERENCE/api-endpoints.md` submit row updated (D-11804 whole-row); `docs/12` + ewiki `/scoring/` updated
- [ ] `docs/ai/STATUS.md` Done entry names WP-593 + D-24026 operator-pending
- [ ] `docs/ai/DECISIONS.md` D-24402 landed Active
- [ ] WORK_INDEX + EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-628:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed (operator-pending)

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-23)
The seat→identity data all exists server-side (WP-333 `readSeatAccounts`, WP-375 `readMatchBotSeats`, `legendary.players.display_handle`); the endgame card consumes the submit response (`useCompetitiveSubmitOnGameover`), so attaching `seatIdentities` there reaches the card without a history-path change. **Mutation boundary:** no engine/`G`/hash/fixture; `seatIdentities` rides beside the record so the locked 16-key `CompetitiveScoreRecord` is untouched; the luck read + ledger are pure client functions off the existing breakdown. The luck read needs the WP-591 `parBaseline` adversity fields (present on all post-WP-591 rows; `undefined` degrades cleanly).

### Copilot (`01.7`) — verdict: **PASS** (2026-08-23)
Layer boundary (server seat projection + client display; no engine edge) — clean. Determinism (no `G`, no hash, no scoring) — clean. Persistence (seatIdentities derived, non-persisted, not a score-row column) — clean. Contract fidelity (16-key record lock preserved; ledger/luck rendered verbatim from the breakdown) — clean. **RISK considered:** breaking the record-key lock (avoided — seatIdentities is a sibling field, not a record key); a roster read failing a submission (mitigated — fail-safe try/catch returns the result unchanged); a fabricated luck verdict (avoided — deterministic ratio off PAR expectation, `undefined` when unknown). Locked in AC-1..AC-5 + D-24402.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)
§1–§21 pass; closed allowlist across server competition/match + arena-client api/vfx/hud + tests + governance; `node:test`; `// why:` on every new field, the fail-safe swallow, and the luck bands citing D-24402; §20 N/A (no funding surface). **§21 SATISFIED (not N/A):** the `POST /api/competition/scores` 200 response gains `seatIdentities` — `docs/ai/REFERENCE/api-endpoints.md` is updated in the same change (D-11804 whole-row). No ❌ triggers.

## Vision Alignment
**Clauses touched:** §20-26 (competitive surface — the report card is the player's debrief; luck read is objective/deterministic), §22 (determinism — no game-state hash change), §24 (competitive integrity — luck read is derived, never fabricated). **Conflict assertion:** `No conflict` — display + read-path only, no rule or determinism change. **Non-Goal proximity:** none (the Pass-gated LLM coach is deferred to WP-B, not encoded here). **Determinism:** no engine `G`/fixture → both hash oracles byte-identical.

## Funding Surface Gate
**N/A** — an endgame-display + read-path change; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**Required — DONE.** `POST /api/competition/scores` 200 response gains the optional derived `seatIdentities` field; `docs/ai/REFERENCE/api-endpoints.md` row updated whole (D-11804), including the source column (`WP-593 (endgame seatIdentities)`). `GET /api/me/scores` is unchanged (no seatIdentities on the history read). No `apps/server/src/**` `Library-only` catalog signature changed status.
