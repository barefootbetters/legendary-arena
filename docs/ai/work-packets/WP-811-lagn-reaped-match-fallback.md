# WP-811 — Finished matches stay viewable: `/lagn` and `/result-lagn` fall back to the durable replay artifact after the reaper (Server)

**Status:** Draft 2026-10-14
**Primary Layer:** Server (`apps/server`: the two LAGN readers, the capture step, the capture harvester) + one migration
**Dependencies:**
- WP-309 (`bgio.matches`), WP-327 / D-24113 (the reaper), WP-335 / D-24122 (capture + `bgio.replay_artifacts`), WP-334 / WP-336 / D-24119 / D-24124 (the faithful reducer)
- WP-361 / D-24153 (`GET /api/match/:matchId/lagn`), WP-406 / D-24216 + D-24169 (`GET /api/match/:matchId/result-lagn`), WP-411 / D-24223 (`ctx.gameover` = the top-level `endIf`)
- WP-407 / WP-408 (the Hall of Legends match view + download that consume `/result-lagn`)

**User-Visible Surface:** `legends.legendary-arena.com/#/match/<matchId>` (WP-407 view + WP-408 download), the registry-viewer `?lagn=` link (WP-363), and the endgame report card's seat names (`GET /api/match/:matchId/seat-identities`). Today all of them 404 for any match that finished more than about an hour ago; after this packet they keep working.
**Lane:** Standard (two-session). It adds a migration and touches a persistence boundary (lightweight-lane criterion 6, self-demotion trigger).

> Baseline: `origin/main` at `b583b47a` (includes #2785, the WP-811 / EC-848 / D-24719 reserve, and #2784, the WP-810 draft).

---

## Goal

**Today a finished match's LAGN disappears about an hour after the game ends.**

- `readMatchConfigurationForLagn` and `readMatchGameover` read only the live `bgio.matches` row.
- The WP-327 reaper deletes a finished match's row once it is 1 hour past its last write and the harvester has captured it.
- So both public LAGN endpoints, and `GET /api/match/:matchId/seat-identities` (which calls the same two readers), return `404` for every match that ended more than ~1h ago. The Hall of Legends match view, its LAGN download, any shared `?lagn=` link and a late-opened report card's seat names die an hour after the game.
- Observed on prod 2026-10-14 (Context).

**After this session:**
1. When the live row is gone, both readers fall back to the durable `bgio.replay_artifacts` copy (same `initial_state`, kept forever).
2. Capture copies the live row's `metadata.gameover` onto the artifact (new `gameover` column, migration 046), so `/result-lagn` still reports Victory / Defeat after the reap.
3. Artifacts captured before migration 046 get their verdict filled by a small per-scan sweep in the existing capture harvester (re-executed with the D-24119 reducer, verdict = the engine's own `evaluateEndgame`). Until a row is filled, `/result-lagn` serves it without the optional `result` block instead of a false `match_not_finished` (legends-board labels that "Draw"; see Context, "Operator decision").
4. Routes, responses, auth and caching are unchanged; the three routes simply stop returning `404` for a reaped, captured match. A match in neither store is still the fail-closed `404`.

## User-Visible Impact

On `legends.legendary-arena.com/#/match/<id>`, a match finished yesterday renders its roster and outcome, and its "Download LAGN" works, instead of the "match not found" state. (A match captured before 046 shows "Draw" until its verdict is swept, and keeps it if today's engine no longer reproduces its hash; see Context, "Operator decision".) The same holds for a shared registry-viewer `?lagn=` link built from `/lagn`, and for the seat names on an endgame report card opened after the reap.

---

## Assumes

1. **The readers read only the live row:**
   - `matchLagn.logic.ts:~92-121` `readMatchConfigurationForLagn`: `SELECT initial_state FROM bgio.matches WHERE match_id = $1`; an absent row returns `null`.
   - `matchLagn.logic.ts:~349-366` `readMatchGameover`: `SELECT metadata->'gameover' … FROM bgio.matches`; an absent row returns `null`.
   - `matchLagn.routes.ts:~148-205` (`/lagn`) maps `null` configuration to `404 match_not_found`; `:~215-313` (`/result-lagn`) maps `null` configuration to `404 not_found` and `null` gameover to `404 match_not_finished`. The roster (`readSeatAccounts`), battle plan and score reads are domain-table or artifact reads that survive the reap.
   - `seatIdentities.routes.ts:~121-185` (`GET /api/match/:matchId/seat-identities`, on `main` since #2067) calls **both** readers through its own seam (`:~57-79`): `null` configuration → `404 match_not_found`, `null` gameover → `404 match_not_finished`; `readSeatIdentities` reads domain tables only.
2. **The reaper deletes captured finished rows after 1h:** `matchReaper.js:~39-43` (`GAMEOVER_GRACE_MS = 3_600_000`), `:~83-91` (the DELETE requires `captured_at IS NOT NULL` for gameover rows), cadence 15 min (`:~36`).
3. **Capture runs first and keeps the artifact forever:**
   - `captureHarvester.js:~33` (5-min cadence), `:~44-50` (scan for uncaptured gameover rows), `:~73-106` (per-match capture loop, errors swallowed).
   - `matchCapture.logic.ts:~84-134`: `readMatchForReplay` (returns `{ initialState, log, metadata }`, `matchReplay.logic.ts:~375-398`), `reduceMatchToFinalState`, then `INSERT INTO bgio.replay_artifacts (replay_hash, match_id, scenario_key, initial_state, log) … ON CONFLICT (replay_hash) DO NOTHING`, then `captured_at`.
   - Nothing deletes `bgio.replay_artifacts` rows.
4. **The artifact schema** (`data/migrations/025_create_bgio_replay_artifacts.sql`): `replay_hash` PK, `match_id`, `scenario_key`, `initial_state`, `log`, `captured_at`. No `gameover` column and no `match_id` index; `readReplayHashByMatchId` (`matchReplay.logic.ts:~506-520`) already queries it by `match_id … LIMIT 1`. The latest migration is `045_create_battle_plan.sql`.
5. **The verdict is a pure function of `G`:** `game.ts:~510` `endIf: ({ G }) => evaluateEndgame(G) ?? undefined`, so `metadata.gameover` equals `evaluateEndgame` of the final `G`. `reduceMatchToFinalState` reproduces the live final `G` (D-24124). `competition.logic.ts:~54` already calls `evaluateEndgame` on a reduced state (precedent).
6. **Consumers need no code change:** `apps/legends-board/src/panels/matchResultClient.ts` and `matchResultDownload.ts` fetch `/result-lagn` by match id; WP-363's link reads `/lagn`; the arena-client endgame co-op recap reads `/seat-identities`. **One display consequence:** legends-board `formatOutcome` (`matchResultDisplay.ts:~57-75`) labels any document without `result` as **"Draw"** (it was written for the tie case). So a match whose verdict is unknown (`VERDICT_NOT_RECORDED` until swept, or a stored `{}`) shows "Draw" on the Hall of Legends. This packet keeps the client unchanged and records the gap; see Context, "Operator decision".
7. **Tests:** `matchLagn.logic.test.ts` (fake-DB readers, `:~329-361`, `:~634-650`), `matchLagn.routes.test.ts` (seam-injected), `matchCapture.logic.test.ts` (DB-gated end-to-end capture `:~157-262` plus pure tests), `captureHarvester.test.ts` (the scheduler test counts **every** pool query, `:~61-88`).
8. **Baseline:** `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/server test` gives **1767 tests, 0 fail, 207 skipped** (DB-gated).

If any item is false, this packet is **BLOCKED**; reconcile the WP and D-24719 first. Line anchors are `~` approximate; re-read at execution.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Persistence Boundary (Cross-Layer), the D-24095 carve-out blockquote (`:~342-383`); `.claude/rules/architecture.md` §Persistence Boundary; `.claude/skills/legendary-server/SKILL.md`, `.claude/skills/legendary-persistence/SKILL.md`.
- `docs/ai/DECISIONS.md`: D-24095, D-24113, D-24119, D-24122, D-24124, D-24153, D-24169, D-24187 (the precedent: a carve-out that reads `bgio.replay_artifacts` `initialState.G.matchConfiguration`), D-24216, D-24223.

**Prod evidence (observed 2026-10-14, public endpoints only; gitSha `44724482`):**
- A guest autoplay match `MAYLMfB1PM9` was fast-forwarded to game over at ~11:08 UTC. `GET /api/match/MAYLMfB1PM9/result-lagn` returned **200** with `result.outcome: "victory"` (11:09, 11:14, 11:19).
- A poller re-checks both endpoints every 5 minutes past the reap window; the result is recorded in the drafting PR and STATUS (expected flip to `404` around 12:10–12:25 UTC).
- Code-level proof stands on its own: the reaper's DELETE and the readers' single-table SELECTs (Assumes 1–3).

**Draft scaffold (observed 2026-10-14; patch kept in the drafting session scratchpad, not committed):**
- Server suite 1767 → **1790 tests, 0 fail**, 207 skipped. The only existing-test edit was the harvester scheduler test (Scope D).
- DB-gated `matchCapture.logic.test.ts` against local Postgres with 046 applied: 19 / 0 fail, 0 skipped.
- Copilot mutants, each killed (1 fail): the sweep always storing `{}`; the UPDATE without `AND gameover IS NULL`; no hash check; the sweep moved before the capture loop.
- Revert proofs, all observed (AC 9): (a) no configuration fallback → 4 fail in the LAGN logic + route tests, plus 1 in the seat-identities test; (b) no gameover fallback → 5 fail (4 LAGN + 1 seat-identities); (c) a legacy artifact read as `null` → 2 fail; (d) no sweep → 1 fail; (e) capture stores no verdict → 1 fail (DB-gated).
- The independent pre-flight re-applied the patch at `b583b47a` and reproduced the counts (Gate Record).

**Why a stored verdict, not a re-reduction per request (rejected alternatives):**
- **Re-execute the artifact on every `/result-lagn` GET.** The endpoint is guest-readable, and a full reduction blocks the event loop for live sockets. WP-810 needed a move-weighted process budget for exactly that cost. Rejected.
- **Re-execute on read only for legacy rows.** The same cost on the same guest path, just for older matches. Rejected; the sweep pays it once, in the background.
- **A one-time operator backfill script** (the `scripts/backfill-team-key.mjs` pattern). Works, but it is a manual prod write. The harvester sweep needs no operator step and is idempotent. Not taken.
- **Lengthen the reaper grace.** Delays the 404, never removes it, and grows `bgio.matches`. Rejected.
- **Return `match_not_finished` for an unfilled legacy artifact.** False: an artifact exists only for a finished match. The honest API partial is a document without the optional `result` block (`toLagnResult` already omits it for a tie).
- **Trust any re-derived verdict.** The sweep runs on today's engine; a later fidelity change can make an old log reduce to a different final `G` (the competition verifier refuses a replay whose hash no longer matches, `competition.logic.ts:~833`). The sweep therefore stores the verdict only when the re-reduced `stateHash` equals the row's `replay_hash`; otherwise `{}`. Rejected: storing it anyway, which could publish Victory for a lost match.

**Operator decision (default chosen; Jeff may override before execution).** Unknown outcomes display as "Draw" on legends-board (Assumes 6). Default: ship the server fix as specified (setup, roster and download come back now, and every match captured after 046 has its real outcome), record the gap in D-24719, and queue a small legends-board follow-up so an outcome-less result reads as "Outcome not recorded" rather than "Draw" (LAGN has no tie outcome today, so that follow-up needs a way to tell a tie from unknown). Alternative: have `/result-lagn` keep returning `404` for an unknown verdict. It never shows a wrong label, but legacy matches lose their Hall of Legends view, and it changes the route mapping (out of this packet's no-route-logic constraint).

**Why it is a persistence decision (D-24719).** D-24122 describes the artifact store as read by the server replay pipeline; guest routes now read it too (setup and verdict only). D-24719 records that widening. The D-24153 clause names the `bgio.matches` blob, and the D-24169 clause names only the `/api/dash/matches` summary, although `/result-lagn` and `/seat-identities` already cite it for the `metadata.gameover` read. D-24719 widens both to the artifact store and names the finished-match outcome reads. The new `gameover` column is a **D-24122 artifact-store write**, like `replay_hash` and `scenario_key` (already reducer-derived values in that table): the capture copy and the sweep write only there, never `bgio.matches`. The D-24119 clause's "never written back to the `bgio` store" is narrowed to `bgio.matches`, so the verdict write does not contradict it. It adds **no new carve-out**: three existing clauses are amended in place, so WP-810's D-24716 count ("six") is unaffected.

### Interplay

- **WP-810 / D-24716 (replay-LAGN, drafted #2784, BLOCKED on WP-808).** It reads the artifact store for its own export and re-derives the outcome by re-execution. Both packets edit the same ARCHITECTURE blockquote and the `.claude/rules/architecture.md` carve-out list: the second to merge rebases (text conflict only). WP-810's Interplay names this bug as out of scope; this packet does not edit WP-810's files.
- **#2779 / D-24717 (open; result-LAGN refuses an operator match).** It gates on `matchConfiguration.isDebugMatch`, read by `readMatchConfigurationForLagn`. The fallback returns the same object from the artifact's byte-identical `initial_state`, so the gate also covers a reaped operator match. If #2779 is on `main` at execution, AC 8 applies.
- **`GET /api/match/:matchId/seat-identities` (on `main`, #2067).** It calls both readers, so it is in scope: a reaped, captured match goes from `404` to `200` with its roster. That is the same privacy surface as `/result-lagn` (its own header says so), so there is no new exposure. One production-logic test pins it; its catalog row is replaced whole.
- **#2780 / D-24718 (open; seat-identities refuses an operator match).** Adds an `isDebugMatch` gate on the same configuration object, so it composes the same way as #2779. Text-merge only.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves and effects never throw. All in-game randomness goes through boardgame.io's seeded `random` (the `ctx.random` family). No `Math.random`, clocks or I/O in engine code.
- `G` stays JSON-serializable. Only `Game.setup()` may throw.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24719) before coding. One WP per session.

**Packet-specific:**
- **No engine, client or route-logic change.** `packages/**`, `apps/legends-board/**`, `apps/registry-viewer/**` and `apps/arena-client/**` are not edited. `matchLagn.routes.ts` and `seatIdentities.routes.ts` get **comment-only** edits (the "row present" gate comments and the seat-identities header now name the artifact fallback). Status codes, bodies, auth and `Cache-Control` are unchanged.
- **The live row wins.** The artifact is read only when the live `bgio.matches` row is **absent**. A live row with a null `initial_state` stays `null`, and a live in-progress match stays `match_not_finished`.
- **Reads stay inside D-24719:** artifact `initial_state` (`G.matchConfiguration`, `ctx.numPlayers`) and the artifact's `gameover` column for the readers; the sweep's reduction (D-24119) whose only output is `evaluateEndgame` of the final `G`. **Writes** go only to `bgio.replay_artifacts.gameover` (D-24122 artifact store). Never `bgio.matches`, never `legendary.*`, never a save-game or scoring input.
- **Sweep cost is bounded:** at most `ARTIFACT_GAMEOVER_SWEEP_BATCH_SIZE` rows per harvester scan, run after the capture loop, its errors logged and swallowed.
- **01.5 not invoked.** Every file is in the allowlist by name.

## Locked Values

- **Migration:** `data/migrations/046_add_replay_artifact_gameover.sql`:
  - `ALTER TABLE bgio.replay_artifacts ADD COLUMN IF NOT EXISTS gameover jsonb;` (nullable)
  - `CREATE INDEX IF NOT EXISTS replay_artifacts_match_id_idx ON bgio.replay_artifacts (match_id);`
  - `CREATE INDEX IF NOT EXISTS replay_artifacts_gameover_missing_idx ON bgio.replay_artifacts (replay_hash) WHERE gameover IS NULL;`
- **Reader fallback SQL** (`matchLagn.logic.ts`, both `… WHERE match_id = $1 LIMIT 1`):
  - `SELECT initial_state FROM bgio.replay_artifacts WHERE match_id = $1 LIMIT 1`
  - `SELECT gameover FROM bgio.replay_artifacts WHERE match_id = $1 LIMIT 1`
- **`VERDICT_NOT_RECORDED`:** exported `StoredGameover` = `Object.freeze({})`, returned when the artifact exists and its `gameover` is SQL `NULL`. `toLagnResult(VERDICT_NOT_RECORDED)` is `undefined`.
- **Capture INSERT:** columns `(replay_hash, match_id, scenario_key, initial_state, log, gameover)`, `$6 = serializeStoredGameover(artifact.metadata)`; `serializeStoredGameover(metadata)` returns `JSON.stringify(metadata.gameover)`, or `null` when the metadata is not an object or its `gameover` is `null` / absent.
- **Sweep:** `fillMissingArtifactGameovers(database, batchSize)` in `matchCapture.logic.ts`:
  - `SELECT replay_hash, initial_state, log FROM bgio.replay_artifacts WHERE gameover IS NULL LIMIT $1`
  - per row: `reduceMatchToFinalState(…)`; when its `stateHash` equals the row's `replay_hash`, `evaluateEndgame(finalState) ?? {}`; when the hash differs, `{}` with a full-sentence `console.error`; a reduction that throws stores `{}` and logs a full-sentence error
  - `UPDATE bgio.replay_artifacts SET gameover = $2 WHERE replay_hash = $1 AND gameover IS NULL`
  - returns the number of rows filled (the sum of each UPDATE's `rowCount`)
- **`ARTIFACT_GAMEOVER_SWEEP_BATCH_SIZE = 5`.**
- **Harvester:** `runScanOnce` calls the sweep once per scan, after the capture loop, inside its own `try/catch`; it logs `Recorded the endgame verdict on N earlier replay artifact(s).` only when N > 0.
- **Doc lines:**
  - **ARCHITECTURE.md**, three in-place amendments (with the blockquote's `> ` line wraps joined, each quoted anchor below occurs exactly once; verified at draft):
    - D-24119 clause: replace "(a derived, read-only projection, for faithful replay reconstruction and competitive-score verification; never written back to the `bgio` store or to `legendary.*`," with "(a derived, read-only projection, for faithful replay reconstruction, competitive-score verification, and deriving a captured artifact's endgame verdict (`evaluateEndgame` of the reproduced final `G`) into the D-24122 artifact store's `bgio.replay_artifacts.gameover` column (D-24719); never written back to `bgio.matches` or to `legendary.*`,".
    - D-24153 clause: after "the D-24153 loadout carve-out: a server-layer read MAY read the blob's `initialState.G.matchConfiguration` (+ `initialState.ctx.numPlayers`)" insert " — or, once the reaper has deleted a finished match's live row, the same fields from its durable `bgio.replay_artifacts` copy (D-24719) —".
    - D-24169 clause: after "for the operator dashboard's `/api/dash/matches` analytics;" insert " the same `metadata.gameover` read — or, once reaped, its capture-time copy in `bgio.replay_artifacts.gameover` (D-24719) — is the finished-match gate and outcome of the WP-406 result LAGN and `/seat-identities`;".
  - **`.claude/rules/architecture.md`:** the D-24119 parenthetical gains "; also derives a captured artifact's endgame verdict into the D-24122 `bgio.replay_artifacts.gameover` column (D-24719), never `bgio.matches`", and the list's "never-written-back" wording gains "(to `bgio.matches`)"; the D-24153 parenthetical becomes "(Tier-1 LAGN loadout projection from `initialState.G.matchConfiguration` + `ctx.numPlayers`, from the live row or, once reaped, its `bgio.replay_artifacts` copy — D-24719)"; the D-24169 parenthetical gains "and the finished-match gate / outcome of the result LAGN and seat identities, from the live row or the artifact's `gameover` copy (D-24719)". The carve-out count is unchanged.
  - **`api-endpoints.md`:** the `GET /api/match/:matchId/lagn`, `GET /api/match/:matchId/result-lagn` and `GET /api/match/:matchId/seat-identities` rows replaced **whole** (D-11804). Each row's Notes gain: "A finished match whose live row has been reaped is served from its `bgio.replay_artifacts` copy (WP-811 / D-24719)." The `result-lagn` row adds: "A pre-046 artifact without a recorded verdict omits `result`." Each row's Authorizing WP column gains `WP-811 / D-24719`. Status `Wired`, Auth `guest`, request and response unchanged. Footer `*Last updated: WP-811 …*` line.
  - **`bgio.replay_artifacts` data docs (promote `gameover` from pending to live).** #2788 documented the table with WP-811 marked "pending, not on `main`". Promote it in both docs. Leave the WP-810 / D-24716 pending clause unless WP-810 has executed.
    - **`docs/03.1-DATA-SOURCES.md` "Durable Replay Artifacts":**
      - **Created by:** append "; migration `046_add_replay_artifact_gameover.sql` (WP-811 / D-24719) adds the nullable `gameover` column plus the `replay_artifacts_match_id_idx` and `replay_artifacts_gameover_missing_idx` indexes".
      - **Columns:** add `gameover` (jsonb, nullable).
      - **Writers:** append "`captureMatch` also writes `gameover`. `fillMissingArtifactGameovers` (the per-scan harvester sweep, D-24719) fills a NULL `gameover` once and never overwrites it".
      - **Consumers:** add "the WP-811 / D-24719 reaped-match fallback in `matchLagn.logic.ts` (`/lagn`, `/result-lagn`, `/seat-identities`; reads `initial_state` + `gameover` by `match_id`, only when the live row is gone)".
      - **Pending consumers:** drop the WP-811 sentence and the "`gameover` is not on `main` yet" clause.
    - **`docs/ai/REFERENCE/00.2-data-requirements.md` §4.1 `bgio.replay_artifacts` row:**
      - In the column list, after `log jsonb NOT NULL (…)`, add "`gameover jsonb NULL` (the capture-time copy of `metadata.gameover`, or the sweep's `evaluateEndgame` verdict; written once, never overwritten; `{}` = finished, outcome unknown; NULL = pre-046 row not yet swept; WP-811 / D-24719)".
      - Change `match_id`'s "unindexed" to "indexed by `replay_artifacts_match_id_idx` (migration 046)".
      - The writer sentence gains "and the `fillMissingArtifactGameovers` sweep (`gameover` only)".
      - The readers list gains "the WP-811 / D-24719 reaped-match fallback (`/lagn`, `/result-lagn`, `/seat-identities`)".
      - Delete the WP-811 clause from "Pending, not on `main`".
      - "Authored by" gains "; `gameover` + both indexes by WP-811 / EC-848 / D-24719 (migration 046)".

---

## Scope (In)

- **A) Migration 046** (new), per Locked Values, with a header comment block citing WP-811 / EC-848 / D-24719 and `// why`-style SQL comments for the column and both indexes.
- **B) Readers** (`matchLagn.logic.ts`):
  - `readMatchConfigurationForLagn`: on an absent live row, `readArtifactConfigurationForLagn` (module-private); the shared parse moves to a private `projectConfigurationForLagn(initialState)`, with a `// why:` that one projection keeps the live and artifact objects identical (the #2779 / #2780 `isDebugMatch` gates depend on it).
  - `readMatchGameover`: on an absent live row, `readArtifactGameover` (module-private), returning the stored verdict, `VERDICT_NOT_RECORDED`, or `null` when no artifact exists.
  - Update the module and function JSDoc to cite D-24719.
  - Comment-only: the projectability gate comments in `matchLagn.routes.ts` (both routes) and `seatIdentities.routes.ts`, and the "Blob reads" paragraph of the `seatIdentities.routes.ts` header, name the artifact fallback (D-24719). No code line changes.
- **C) Capture + sweep** (`matchCapture.logic.ts`, `captureHarvester.js`): the INSERT's `gameover`, `serializeStoredGameover`, `fillMissingArtifactGameovers`, `ARTIFACT_GAMEOVER_SWEEP_BATCH_SIZE`, the harvester call; `evaluateEndgame` imported from `@legendary-arena/game-engine` (the `.` surface).
- **D) Tests:**
  - `matchLagn.logic.test.ts` (+8): a table-aware fake DB. Configuration: artifact read when reaped (asserts the SQL), live row wins (1 query), null-`initial_state` live row does not fall back, neither store → `null`. Gameover: artifact verdict (+ `toLagnResult` → `defeat`), legacy `NULL` → `VERDICT_NOT_RECORDED` (+ `toLagnResult` → `undefined`), live in-progress row does not fall back, never captured → `null`.
  - `matchLagn.routes.test.ts` (+4): **no seam injected** (production logic) over a fake pool with the live row reaped: `/lagn` 200 + valid; `/result-lagn` 200 + valid + `result: { outcome: 'victory' }`; a legacy artifact → 200 + valid + no `result`; neither store → `404 match_not_found` / `404 not_found`.
  - `matchCapture.logic.test.ts` (+8 new, 1 strengthened): `serializeStoredGameover` (2); sweep locked batch size; SELECT shape + params; a **decisive** artifact (the manufactured lobby artifact with `G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] = 1`, with a precondition that its verdict is `scheme-wins`) stores that verdict, and the UPDATE text is asserted (`WHERE replay_hash = $1 AND gameover IS NULL`); a hash that no longer matches stores `'{}'`; a `rowCount` of 0 counts 0; a malformed log stores `'{}'`. The DB-gated capture test additionally asserts the artifact's `gameover` deep-equals the seeded `metadata.gameover`.
  - `seatIdentities.routes.test.ts` (+1): **no seam injected**, live row reaped, artifact present → `200` with the two-seat roster (`playerId` `'0'`, `'1'`).
  - `captureHarvester.test.ts` (+2, 1 modified): the scheduler test counts **scans** (queries `FROM bgio.matches`) instead of every pool call, because each scan now also runs the sweep; its three assertions are otherwise unchanged. New: with a one-id work-list (the capture skips it as not replayable), the sweep query comes **after** the capture's own read, with params `[5]`; a throwing sweep is swallowed and the next scan still runs.
- **E) Docs:** ARCHITECTURE.md, `.claude/rules/architecture.md`, `api-endpoints.md` (three rows), and the `gameover` promotion in `docs/03.1-DATA-SOURCES.md` + `00.2-data-requirements.md` §4.1, per Locked Values.

## Out of Scope

- **Any client change.** legends-board, registry-viewer and arena-client consume the same responses.
- **WP-810's replay-LAGN export** and its files.
- **Shortening or lengthening the reaper grace**, and the reaper itself.
- **Matches never captured** (finished before WP-335, or abandoned without gameover). Their artifact does not exist; they stay `404`.
- **`replay_hash` collisions.** Two matches with byte-identical final `G` share one artifact row (`ON CONFLICT DO NOTHING`), so the second match id has no artifact. Distinct seeds make this practically impossible; not addressed.
- **Other live-row-only reads** (`isMatchFinished`, `readMatchSeatCount`, the coach, battle-plan seat checks). Their callers act on live or just-finished matches.
- **`/api/dash/matches`.** It lists live rows by design.
- **Documenting `bgio.replay_artifacts` from scratch.** The pre-existing gap in 03.1 and 00.2 §4.1 was closed separately by #2788. This WP only promotes its own `gameover` column from pending to live (Scope E).

## Files Expected to Change

- `data/migrations/046_add_replay_artifact_gameover.sql` — **new**
- `apps/server/src/match/matchLagn.logic.ts` — modified
- `apps/server/src/match/matchLagn.logic.test.ts` — modified (+8 tests)
- `apps/server/src/match/matchLagn.routes.ts` — modified (comments only)
- `apps/server/src/match/matchLagn.routes.test.ts` — modified (+4 tests)
- `apps/server/src/match/seatIdentities.routes.ts` — modified (comments only)
- `apps/server/src/match/seatIdentities.routes.test.ts` — modified (+1 test)
- `apps/server/src/replay/matchCapture.logic.ts` — modified
- `apps/server/src/replay/matchCapture.logic.test.ts` — modified (+8 tests, 1 strengthened)
- `apps/server/src/replay/captureHarvester.js` — modified
- `apps/server/src/replay/captureHarvester.test.ts` — modified (+2 tests, 1 counting change)
- `docs/ai/ARCHITECTURE.md`, `.claude/rules/architecture.md`, `docs/ai/REFERENCE/api-endpoints.md` — modified
- `docs/03.1-DATA-SOURCES.md`, `docs/ai/REFERENCE/00.2-data-requirements.md` — modified (`gameover` promotion)
- Governance: `docs/ai/DECISIONS.md` (D-24719), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 16 code, test and doc files (two of them comment-only) plus 5 governance files, in one layer (`apps/server`) plus a migration and docs. Above the ~8-file bound because each code file has its test, and the carve-out docs move in lockstep.

## Contract

- The Locked Values.
- `readMatchConfigurationForLagn(matchId, db)`: live row → as today; no live row → the artifact's projection or `null`.
- `readMatchGameover(matchId, db)`: live row → as today; no live row → the artifact's verdict, `VERDICT_NOT_RECORDED`, or `null` (never captured).
- `bgio.replay_artifacts.gameover`: the verdict JSON, written once (capture or sweep), never overwritten (`AND gameover IS NULL`). `{}` means "finished, outcome unknown" (a throwing reduction, no verdict, or a re-execution that no longer reproduces `replay_hash`).

## Vision Alignment

**Vision clauses touched:** §3 (Player Trust & Fairness: player visibility), §12a (Data Portability: a match's LAGN stays downloadable), §18 (Replayability & Spectation: the Hall of Legends match view keeps working), §19 (AI-Ready Export), §7 (Strict Layer Separation), §8 (Deterministic engine; untouched), NG-1 (untouched).
**Conflict assertion:** none.
- §12a / §18 / §19: a finished match's public record is readable for as long as its artifact exists, not one hour.
- §3: the fallback keeps a finished match's claimed handles (`/result-lagn` `players[]`, `/seat-identities`) public for as long as its artifact exists instead of about an hour. Handles stay D-24214 claimed-handle-only (never an AccountId), and a permanent public match record is the intended WP-407 Hall of Legends behavior.
- §7: server and persistence only; the engine is called through its `.` surface (`evaluateEndgame`), never edited.
**Non-Goal proximity:** not crossed. Nothing scored, purchased or ranked reads the new column.
**Determinism:** unchanged. The sweep re-executes through the D-24119 reducer and reads one engine verdict, only when the reproduced hash equals the captured one; no hash, PRNG or replay behavior changes.

## Funding Surface Gate

§20 **N/A** — server readers, capture and a migration; no UI, no user-visible copy, no funding channel or affordance (WP-097 §F; the §20.1 surfaces are absent).

## API Catalog

§21 **applies:** the `/lagn`, `/result-lagn` and `/seat-identities` rows are replaced whole and a footer line added (Scope E). Status, Auth, request and response columns are unchanged; each route stops returning `404` for a reaped, captured match.

---

## Acceptance Criteria

1. **Reaped setup.** With no live row and an artifact present, `GET /lagn` returns `200 { lagn }` that validates (route test 1).
2. **Reaped result.** With no live row and an artifact carrying `{ outcome: 'heroes-win' }`, `GET /result-lagn` returns `200` with `result: { outcome: 'victory' }` (route test 2; logic tests).
3. **Legacy artifact.** With `gameover` SQL `NULL`, `/result-lagn` returns `200` without `result`, never `match_not_finished` (route test 3; logic test).
4. **Reaped seat roster.** With no live row and an artifact present, `GET /seat-identities` returns `200` with the roster (seat-identities test).
5. **Live row wins; fail-closed kept.** A live row is read alone (one query); a null-`initial_state` live row and a live in-progress match do not fall back; a match in neither store is `404 match_not_found` / `404 not_found` (logic + route tests).
6. **Capture copies the verdict.** The DB-gated capture test reads back the seeded `metadata.gameover` from the artifact's `gameover`.
7. **Sweep.** It selects only `gameover IS NULL` rows with `LIMIT $1 = 5`; stores the decisive `evaluateEndgame` verdict of the reduced state when the hash matches, through the asserted guarded UPDATE; stores `'{}'` for a hash mismatch or an unreplayable row; counts `rowCount`; and runs once per harvester scan after the capture loop, its failure swallowed (capture + harvester tests). The four draft mutants each fail a test.
8. **Operator match (applies only if #2779 / D-24717 is on `main` at execution).** A reaped artifact whose `matchConfiguration.isDebugMatch === true` gets `/result-lagn` `404 not_found` (one added route test, counted in Verification 2). With #2780 / D-24718 also on `main`, the same holds for `/seat-identities` through its own gate (no extra test required).
9. **Revert proofs** (each restored afterwards; all observed at draft): (a) configuration fallback removed → 4 fail in the LAGN logic + route tests and 1 in the seat-identities test; (b) gameover fallback removed → 5 fail (4 LAGN + 1 seat-identities); (c) legacy row returns `null` → 2 fail; (d) sweep call removed → 1 fail; (e) capture stores `null` → 1 fail (DB-gated).
10. **Build and tests.** `pnpm -r build` → 0. Server suite 1767 → **1790** tests (1791 with AC 8), 0 fail. `pnpm -r --no-bail test` → 0 fail. DB-gated `matchCapture.logic.test.ts` with `TEST_DATABASE_URL` and 046 applied → 0 fail, 0 skipped. CI **Server DB Tests** green.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/server test` → 1790 tests (1791 with AC 8), 0 fail, 207 skipped.
3. Local DB (`DATABASE_URL` = the local dev Postgres from the repo `.env`, loaded into the shell; psql 18 at `C:\Program Files\PostgreSQL\18\bin`), in pwsh: `$env:TEST_DATABASE_URL = $env:DATABASE_URL; psql $env:DATABASE_URL -w -f data\migrations\046_add_replay_artifact_gameover.sql; pnpm --filter @legendary-arena/server exec node --import tsx --test --test-concurrency=1 src/replay/matchCapture.logic.test.ts` → 0 fail, 0 skipped.
4. Revert proofs (AC 9), each restored.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git status --porcelain --untracked-files=all` ⊆ Files Expected to Change (it lists untracked new files, which `git diff --name-only` misses). Revert any `lagn-v1.json` CRLF churn from the build.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24719 Active. It records:
  - the bug (readers live-row-only; reaper deletes captured finished rows after 1h) and the prod evidence
  - §1 the reader fallback, live row first, same fields from the byte-identical artifact `initial_state`
  - §2 the capture-time `gameover` copy and `VERDICT_NOT_RECORDED` (`{}` = finished, outcome unknown; never `match_not_finished`)
  - §3 the harvester sweep (D-24119 reduction, `evaluateEndgame` of final `G` only when the reproduced hash equals `replay_hash`, batch 5, never overwrites, `{}` on a mismatch or a throwing reduction), with the mismatch count observed after the backlog drains
  - the legends-board "Draw" label for an unknown outcome (Assumes 6), the operator decision taken, and the follow-up client item
  - the D-24122 "server replay pipeline" wording widened: guest routes now read the artifact's setup and verdict
  - §4 the carve-out amendments: D-24153 and D-24169 widened to the artifact store, D-24169 naming the finished-match gate and outcome of the result LAGN and `/seat-identities`, D-24119 naming the verdict derivation; no new carve-out (WP-810's count unchanged)
  - the rejected alternatives (re-reduce per request, re-reduce for legacy rows, operator backfill, longer grace, `match_not_finished` for legacy)
  - `/seat-identities` as the third affected route (same readers, same privacy surface as `/result-lagn`)
  - the `gameover` column as a D-24122 artifact-store write, and the D-24119 "never written back" narrowing to `bgio.matches`
  - the legacy backlog: the count of prod artifacts with `gameover IS NULL` at deploy, from a read-only query (the drafting session could not run it: prod DB reads were blocked by the permission classifier), and the drain estimate at 5 rows per 5-minute scan
  - the never-captured and `replay_hash`-collision exclusions
- [ ] `docs/ai/STATUS.md`; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-848:` then `SPEC:`), with a `Tests-changed:` trailer for `captureHarvester.test.ts` (scan counting) and `matchCapture.logic.test.ts` (strengthened assertion).
- [ ] **D-24026 live-verify (post-merge, after deploy; `GET /version` `gitSha` = the merge commit):**
  1. Before the deploy, record the read-only count of `bgio.replay_artifacts WHERE gameover IS NULL`; after the backlog drains, record the count of `gameover = '{}'::jsonb` (hash mismatches + no-verdict rows).
  2. `MAYLMfB1PM9` (finished and reaped 2026-10-14, captured before 046): `GET https://api.legendary-arena.com/api/match/MAYLMfB1PM9/lagn` → 200; `/seat-identities` → 200; `/result-lagn` → 200 at once (without `result` until its row is swept) and, after the legacy backlog clears (within (backlog count ÷ 5) × 5 minutes of the deploy), with `result.outcome: "victory"`, unless the deployed engine no longer reproduces its hash (then still no `result`; record which). Check the legends-board label for it before and after the sweep.
  3. A fresh guest autoplay match (`POST /api/match/autoplay`, then `/go-to-end`), re-checked ≥ 80 minutes after game over: all three endpoints 200, `result.outcome` present.
  4. `legends.legendary-arena.com/#/match/<step-3 id>` renders the outcome, and "Download LAGN" saves a file.
  5. Recorded as a STATUS flip.

## Reserved Decision (lands at execution)

**D-24719 — lagn-reaped-match-fallback.** It locks everything listed in the DoD item above.

---

## Lint Gate Self-Review (00.3)

- **§1 Structure:** every required section is present; 8 Out-of-Scope exclusions; 10 binary ACs.
- **§2 Constraints:** the engine-wide block is verbatim (full files, ESM, Node v22+, 00.6); session protocol, packet constraints ("01.5 not invoked", comment-only route edits) and Locked Values present.
- **§3 Assumes:** 8 items cited to file:line, re-verified by two independent reviewers at `b583b47a`; a false item → BLOCKED.
- **§4 Context:** ARCHITECTURE §Persistence Boundary + the D-24095 blockquote, the rules file, the server and persistence skills, and D-24095 / D-24113 / D-24119 / D-24122 / D-24124 / D-24153 / D-24169 / D-24187 / D-24216 / D-24223. 00.2 is **N/A**: §4.1 inventories only `legendary.*` tables, so the new `bgio.replay_artifacts.gameover` column sits outside it; no card data, `MatchSetupConfig` or LAGN field shape changes (`result` is already optional). The missing `bgio.replay_artifacts` row in 00.2 / 03.1 is a pre-existing gap (Out of Scope).
- **§5 Output completeness:** 14 code / test / doc files (two comment-only) + 5 governance files, each marked new or modified; above ~8 with the reason stated. Every ARCHITECTURE anchor occurs exactly once with the blockquote wraps joined (verified).
- **§6 Naming:** `VERDICT_NOT_RECORDED`, `serializeStoredGameover`, `fillMissingArtifactGameovers`, `ARTIFACT_GAMEOVER_SWEEP_BATCH_SIZE`, `projectConfigurationForLagn`; full words; canonical field names untouched.
- **§7 Dependencies:** no new package; `evaluateEndgame` via the engine `.` surface (allowed for `apps/server`). Listed dependencies are Done.
- **§8 Architecture:** server + migration only. Writes only to the D-24122 artifact store's `gameover` column; D-24719 amends three carve-out clauses in place (no new carve-out).
- **§9 Windows:** Verification 3 is pwsh; the rest are pnpm / git.
- **§10 Env vars:** no new variable; `TEST_DATABASE_URL` / `DATABASE_URL` documented.
- **§11 Auth:** N/A — all three routes stay `guest`.
- **§12 Tests:** `node:test`, `.test.ts`, no `boardgame.io/testing`; fake-DB unit tests plus the existing DB-gated capture test (non-silent skip).
- **§13 Verification:** exact commands with counts; the allowlist check uses `git status --porcelain --untracked-files=all`.
- **§14 ACs:** 10, binary, each tied to a named test, mutant or count.
- **§15 DoD:** STATUS, DECISIONS (D-24719), WORK_INDEX, EC_INDEX, mindmap, allowlist-only diff, two-commit topology. **§15.1:** surfaces declared; the live-verify drives all three endpoints on a reaped legacy match and a fresh match, records the backlog counts, and checks the legends-board view, label and download.
- **§16 Code style:** 00.6 cited; full-sentence errors; the `// why:` locations are enumerated in EC-848.
- **§17 Vision:** §3, §7, §8, §12a, §18, §19, NG-1; no conflict; determinism line present.
- **§18 Prose-vs-grep:** N/A — no grep-based verification gate.
- **§19 Bridge staleness:** baseline `b583b47a` is the `origin/main` tip (verified at draft).
- **§20 Funding surface:** N/A, with the §20.1 reason.
- **§21 API catalog:** applies; three rows replaced whole, Status `Wired` / Auth `guest` inside the closed sets, Authorizing WP gains `WP-811 / D-24719`, footer line.

**Verdict: PASS (21 / 21 resolved)** after lint rounds 1–2. Round 1 had five text FAILs (§5 non-unique anchor, §9 bash syntax, §13 untracked files, §17 missing §3, §20 thin N/A); round 2 had one (the EC live-verify step range). All were fixed without a scope change.

## Gate Record

**Pre-flight (01.4), round 1** (independent subagent, baseline `b583b47a`, scaffold re-applied: 1767 → 1787 / 0 fail, revert proofs (a) and (d) reproduced): **NOT READY**.
- **PS-1:** the D-24119 "never written back to the `bgio` store" wording contradicted the new artifact write. Fixed: narrowed to `bgio.matches`; `gameover` named a D-24122 artifact-store write.
- **PS-2:** `GET /api/match/:matchId/seat-identities` (on `main`) calls both readers and was missed. Fixed: in scope, with a production-logic test, a whole-row catalog replacement and DoD wording.
- RS applied: the legacy backlog count in D-24719 and "after the backlog clears" in live-verify; 03.1 / 00.2 gap listed out of scope; comment-only route edits allowlisted.

**Pre-flight (01.4), round 2:** **READY TO EXECUTE**, no PS items. Two wording nits (AC renumber reference, D-24169 scope in the DoD) applied.

**Copilot (01.7), round 1:** **RISK → HOLD**, eight findings, all applied with no allowlist change:
1. The sweep verdict test passed for an always-`{}` mutant (the manufactured artifact has no verdict). Now a decisive `SCHEME_LOSS`-latched artifact with a precondition.
2. The UPDATE SQL was never asserted, and filled rows counted attempts. Now asserted, and counted from `rowCount`.
3. Today's engine may not reproduce an old capture. The verdict is now stored only when the reproduced hash equals `replay_hash`, else `{}`.
4. legends-board labels an outcome-less result "Draw". Assumes 6 corrected; the operator decision and its follow-up are recorded.
5. The D-24153 anchor was not unique. Re-anchored.
6. The rules-file D-24119 parenthetical was out of lockstep. Amended; the D-24122 wording widening goes in D-24719.
7. Revert (b) is 5 fail, not 4 (observed).
8. The harvester ordering test could not tell where the sweep ran. Now a one-id work-list with index assertions.

Mutants observed killed after the fixes (1 fail each): always `{}`; no `IS NULL` guard; no hash check; sweep before the capture loop. Scaffold: 1790 / 0 fail; DB-gated capture 19 / 0 / 0 skipped.

**Copilot (01.7), round 2: PASS, disposition CONFIRM.** All eight closed; the test arithmetic (+23 → 1790) is consistent across WP and EC.

**Lint (00.3):** round 1 FAIL (5), round 2 FAIL (1, the EC step range), then **PASS (21 / 21)**.
