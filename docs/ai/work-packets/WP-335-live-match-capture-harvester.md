# WP-335 — Live-Match Capture Harvester (WP-3a of the Faithful-Replay Arc)

**Status:** Draft — Ready to execute (pending operator review)
**Primary Layer:** Server (`apps/server/**`) + Persistence (new `bgio.replay_artifacts` table)
**Dependencies:** D-24119 (Active — arc), D-24121 (WP-3 owns the `replayHash → matchId` mapping), WP-334/D-24121 (`reduceMatchToFinalState` + `readMatchForReplay`), WP-333/D-24120 (`match_seat_accounts`), WP-309/D-24095 (`bgio.matches` store), WP-327/D-24113 (the reaper this coordinates with), WP-052 (`assignReplayOwnership`)
**EC:** EC-365
**Baseline:** `origin/main` at `bea81e2f` (2026-07-08)
**User-Visible Surface:** none — infrastructure
**Reserves:** D-24122

---

## Goal

After this packet, a completed multiplayer match is automatically **captured**: on
gameover, a server-side harvester reconstructs the match's final state (via WP-334's
`reduceMatchToFinalState`), computes the canonical `replayHash`, durably stores the
replay artifact (`{ initialState, log }`) keyed by that hash in a new
`bgio.replay_artifacts` table, records the `replayHash → matchId` mapping + the
derived `scenarioKey`, and calls `assignReplayOwnership` for each **authenticated**
seat. This makes a finished live match competitively **submittable** (the client
submit + verifier repoint are the following arc WPs) and creates the
`replayHash → matchId` mapping D-24121 named as the missing link. **Scope is
capture only — it does NOT score, does NOT repoint the WP-053 verifier (WP-3b), and
does NOT surface the hash to the client (WP-5).**

---

## Assumes

- **D-24119 Active** (arc), **D-24121 Active** (WP-3 owns the `replayHash → matchId`
  mapping; the verifier repoint is a separate WP).
- **WP-334 Done** — `apps/server/src/replay/matchReplay.logic.ts` exports
  `readMatchForReplay(matchId, db) → { initialState, log, metadata } | null` and
  `reduceMatchToFinalState({ initialState, log }) → { finalState, stateHash }` (skips
  automatic entries; starts from persisted `initialState`).
- **WP-333 Done** — `legendary.match_seat_accounts` (`(match_id, player_id) →
  account_id=ext_id`, migration 024) records authenticated seats; its writer
  `recordSeatAccount` exists but **no reader** exists yet.
- **WP-052 Done** — `assignReplayOwnership(accountId, replayHash, scenarioKey, db)`
  (`apps/server/src/identity/replayOwnership.logic.ts:129`) — idempotent
  `ON CONFLICT (player_id, replay_hash) DO UPDATE`; `visibility` defaults `'private'`;
  returns `{ ok:false, code:'unknown_account' }` if the account has no `players` row.
- **WP-309 Done** — `bgio.matches` (migration 023) stores `initial_state`, `log`,
  `metadata` (with `metadata.gameover` on a finished match), `state`, `updated_at`.
  `initial_state` is nullable (a `setState`-upsert row has none → not replayable).
- **WP-327 Done** — the match reaper (`apps/server/src/db/matchReaper.js`)
  `DELETE`s gameover `bgio.matches` rows after `GAMEOVER_GRACE_MS = 3_600_000`
  (1 hr) on a `MATCH_REAPER_INTERVAL_MS = 900_000` (15 min) `setInterval`, wired in
  `index.mjs`.
- The reconstructed `finalState.selection` (`MatchSelection`) carries
  set-qualified (`<setAbbr>/<slug>`) `schemeId`/`mastermindId`/`villainGroupIds`
  (D-10014); `buildScenarioKey` (`packages/game-engine/src/scoring/parScoring.keys.ts:30`)
  takes **bare slugs**, so the set-abbr prefix must be stripped.
- `pnpm install && pnpm -r build` exits 0 on `main`; the `apps/server` suite passes
  its baseline (DB-dependent tests skip without `TEST_DATABASE_URL`).

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` D-24119 (arc + landmines), D-24121 (mechanism-only WP-2;
  WP-3 owns the mapping + the verifier repoint deferral; the automatic-entry skip),
  D-24120 (seat→account; bot/guest seats get no `match_seat_accounts` row),
  D-24095 (bgio framework-store boundary + the D-24119 read carve-out — the
  persistence decision this WP extends; see §Persistence note + D-24122),
  D-24113 (the reaper).
- `apps/server/src/replay/matchReplay.logic.ts` — the WP-334 building blocks.
- `apps/server/src/match/seatAccount.logic.ts` — the writer; this WP adds the reader.
- `apps/server/src/identity/replayOwnership.logic.ts` (`assignReplayOwnership:129`,
  `listAccountReplays:209` — the future WP-5 "my replays" read, not touched here).
- `apps/server/src/db/matchReaper.js` (`reapStaleMatches:62` query, `startMatchReaper:107`
  scheduler) — the pattern to mirror + the query to amend.
- `apps/server/src/index.mjs` (`:95` reaper wiring) — where the harvester wires in.
- `data/migrations/023_create_bgio_match_store.sql` + `024_create_match_seat_accounts.sql`
  — migration conventions.
- `packages/game-engine/src/scoring/parScoring.keys.ts` (`buildScenarioKey`);
  `packages/game-engine/src/matchSetup.types.ts` (set-qualified id grammar, D-10014);
  `packages/game-engine/src/types.ts` (`MatchSelection`).
- `docs/ai/REFERENCE/00.6-code-style.md` Rules 4, 6, 11, 13;
  `.claude/skills/legendary-server/SKILL.md`, `.claude/skills/legendary-persistence/SKILL.md`.
- `docs/01-VISION.md` §22, §24 (replay-verified competitive integrity, public boards).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+. Human-style code (00.6). Full file contents. Test files
  `.test.ts`; `node:test`; DB-dependent tests use the non-silent skip without
  `TEST_DATABASE_URL`. Full-sentence error messages.

**Packet-specific:**
- Capture reconstructs via `reduceMatchToFinalState` (the WP-334 faithful path). The
  `replayHash` stored = `reduceMatchToFinalState(...).stateHash` — the canonical hash
  the future verifier recomputes. Capture MUST NOT hash the live `bgio.matches.state.G`
  (it would not match the reducer path).
- **Durability:** the artifact (`{ initialState, log }`) is copied into
  `bgio.replay_artifacts` at capture, keyed by `replay_hash`, so it survives the
  reaper deleting the `bgio.matches` row. The future verifier reads THIS table, never
  the (reaped) live row.
- **Capture is submittable-only:** store artifact + `replayHash → matchId` mapping +
  `assignReplayOwnership` per authenticated seat. It does NOT write
  `legendary.competitive_scores` (scoring stays in the WP-332 submission pipeline —
  server-authoritative direct scoring is the D-24119 fallback, not this WP), does NOT
  gate on PAR (the submission gates `par_not_published`), does NOT flip visibility
  (ownership stays `private` by default; WP-5 flips before submit).
- **Authenticated seats only:** `assignReplayOwnership` is called only for seats with
  a `match_seat_accounts` row (bots/guests have none, D-24120). A per-seat
  `assignReplayOwnership` failure (`unknown_account`, or a thrown DB error) is logged
  (full-sentence) and does not abort the capture of the other seats or the artifact
  write (best-effort per seat).
- **Reaper coordination:** `reapStaleMatches` is amended so a gameover row is reaped
  only once `captured_at` is set (else a capture outage past the 1 hr grace silently
  loses a competitive match). The harvester runs on an interval well under
  `GAMEOVER_GRACE_MS`. This touches the WP-327 locked query — the only permitted change
  is adding the `captured_at`-guard to the gameover branch; the abandoned branch is
  byte-unchanged.
- **Dedupe:** the harvester scans `bgio.matches WHERE metadata.gameover present AND
  captured_at IS NULL`; `captured_at` is stamped after a successful capture. The
  artifact insert is idempotent (`ON CONFLICT (replay_hash) DO NOTHING`) and
  `assignReplayOwnership` is idempotent, so a re-capture (crash between insert and
  the `captured_at` stamp) is harmless.
- **`storeReplay` is NOT used** — it stores a `ReplayInput`, not the bgio artifact
  (D-24121 / WP-103 contract); `bgio.replay_artifacts` replaces it for the faithful
  path. (The arc text listed `storeReplay`; this WP supersedes that with the
  artifact table — recorded in D-24122.)
- Trigger is a **scan harvester** mirroring `startMatchReaper`, NOT a
  `bgioPgStore.setState` interceptor (setState fires per-move; gameover is written via
  `setMetadata`; and the bgio adapter must stay engine/legendary-free).
- Server + persistence only. No `computeStateHash` change (WP-4). No engine edit.
  `pg.Pool` reused. No new npm dependency. No `Math.random` in capture logic.

**Session protocol:**
- If the `MatchSelection` id grammar, the reaper query, or the seat-reader shape is
  unclear, stop and read the source — never guess.

**Locked contract values:**
- Migration `data/migrations/025_create_bgio_replay_artifacts.sql`.
- Table `bgio.replay_artifacts`:
  `replay_hash text PRIMARY KEY`, `match_id text NOT NULL`,
  `scenario_key text NOT NULL`, `initial_state jsonb NOT NULL`, `log jsonb NOT NULL`,
  `captured_at timestamptz NOT NULL DEFAULT now()`. In the **`bgio` schema** (a
  derived, server-replay-pipeline projection — see §Persistence note).
- `bgio.matches` gains `captured_at timestamptz` (nullable; the dedupe + reaper guard).
- `captureMatch(matchId: string, database: DatabaseClient): Promise<CaptureResult>`
  in `apps/server/src/replay/matchCapture.logic.ts` — reconstruct → hash → derive
  `scenarioKey` → insert artifact → `assignReplayOwnership` per authenticated seat →
  stamp `captured_at`. Returns a typed summary (`{ matchId, replayHash, scenarioKey,
  seatsOwned, skipped }`).
- `readSeatAccounts(matchId: string, database: DatabaseClient): Promise<{ playerId: string; accountId: AccountId }[]>`
  added to `seatAccount.logic.ts`.
- `scenarioKey = buildScenarioKey(strip(selection.schemeId), strip(selection.mastermindId),
  selection.villainGroupIds.map(strip))` where `strip(id) = id.slice(id.indexOf('/') + 1)`.
- `startCaptureHarvester({ database, intervalMs }): { stop(): void }` in
  `apps/server/src/replay/captureHarvester.js`; a `CAPTURE_HARVESTER_INTERVAL_MS`
  well under `GAMEOVER_GRACE_MS` (locked at `300_000` / 5 min).

---

## Scope (In)

### A) Migration
- **`data/migrations/025_create_bgio_replay_artifacts.sql`** — new. Creates
  `bgio.replay_artifacts` (locked shape) + `ALTER TABLE bgio.matches ADD COLUMN IF NOT
  EXISTS captured_at timestamptz`. Idempotent.

### B) Seat-account reader
- **`apps/server/src/match/seatAccount.logic.ts`** — modified (additive).
  `readSeatAccounts(matchId, database)` — `SELECT player_id, account_id FROM
  legendary.match_seat_accounts WHERE match_id = $1`.

### C) Capture logic
- **`apps/server/src/replay/matchCapture.logic.ts`** — new. `captureMatch(matchId, db)`:
  `readMatchForReplay` (null → skip, not replayable) → `reduceMatchToFinalState` →
  derive `scenarioKey` (strip + `buildScenarioKey`) → `INSERT bgio.replay_artifacts`
  (ON CONFLICT (replay_hash) DO NOTHING) → `readSeatAccounts` → `assignReplayOwnership`
  per seat (best-effort, log on failure) → `UPDATE bgio.matches SET captured_at = now()`.

### D) Harvester + wiring
- **`apps/server/src/replay/captureHarvester.js`** — new. `startCaptureHarvester`
  mirroring `startMatchReaper`: scan `bgio.matches WHERE jsonb_exists(metadata,'gameover')
  AND captured_at IS NULL`, `captureMatch` each, `setInterval(CAPTURE_HARVESTER_INTERVAL_MS).unref()`,
  errors logged + swallowed, immediate first run, `stop()`.
- **`apps/server/src/index.mjs`** — modified (01.5 runtime-wiring). Start the harvester
  after the pool exists, before/beside the reaper start; stop on SIGTERM.

### E) Reaper coordination
- **`apps/server/src/db/matchReaper.js`** — modified. Add `AND captured_at IS NOT NULL`
  to the gameover branch of the `reapStaleMatches` DELETE (a gameover row is reaped
  only once captured). The abandoned branch is byte-unchanged.

### F) Tests
- **`apps/server/src/replay/matchCapture.logic.test.ts`** — new. DB-gated end-to-end:
  seed a `bgio.matches` gameover row (real `initial_state`+`log`, produced via the
  WP-334 manufacture helper) + `match_seat_accounts` + `players`; run `captureMatch`;
  assert the artifact row exists (hash = `reduceMatchToFinalState.stateHash`), the
  mapping + scenarioKey are stored, ownership rows exist per authenticated seat,
  `captured_at` is stamped; idempotent re-run. A logic-pure `scenarioKey`-strip test.
- **`apps/server/src/replay/captureHarvester.test.ts`** — new. Mock-timer scan +
  dedupe (only un-captured gameover rows captured); immediate run + `stop()`.
- **`apps/server/src/db/matchReaper.test.ts`** — modified. A gameover row with
  `captured_at IS NULL` is NOT reaped; with `captured_at` set + past grace, it is.
- **`apps/server/src/match/seatAccount.logic.test.ts`** — modified. `readSeatAccounts`
  returns the seats (DB-gated).

### G) API catalog (§21)
- **`docs/ai/REFERENCE/api-endpoints.md`** — modified. `Library-only` rows for
  `captureMatch` + `readSeatAccounts` (+ note the harvester is a background job, not
  an HTTP surface).

---

## Out of Scope

- **The WP-053 verifier repoint** (reading `bgio.replay_artifacts` + `reduceMatchToFinalState`
  on submission, and the `moveCount`/rounds scoring-semantics question) — **WP-3b**.
- **Scoring at capture** (writing `competitive_scores`) — the D-24119 fallback, not this WP.
- **Surfacing the `replayHash` to the client / an HTTP `listAccountReplays`** — WP-5.
- **Flipping ownership visibility** — private by default; WP-5's concern before submit.
- **`computeStateHash` field-set reconciliation** (messages/logMeta) — WP-4; does not
  block capture (capture + future verify both go through `reduceMatchToFinalState` over
  the same artifact, so their hashes agree by construction).
- **Any engine edit**; **`storeReplay`/`replay_blobs`** (replaced by the artifact table).

---

## Files Expected to Change

- `data/migrations/025_create_bgio_replay_artifacts.sql` — **new**
- `apps/server/src/replay/matchCapture.logic.ts` — **new**
- `apps/server/src/replay/matchCapture.logic.test.ts` — **new**
- `apps/server/src/replay/captureHarvester.js` — **new**
- `apps/server/src/replay/captureHarvester.test.ts` — **new**
- `apps/server/src/match/seatAccount.logic.ts` — **modified** — `readSeatAccounts`
- `apps/server/src/match/seatAccount.logic.test.ts` — **modified**
- `apps/server/src/db/matchReaper.js` — **modified** — capture guard on the gameover reap branch
- `apps/server/src/db/matchReaper.test.ts` — **modified**
- `apps/server/src/index.mjs` — **modified** — harvester wiring (01.5)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — Library-only rows (§21)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-335 row
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-365 row
- `docs/ai/execution-checklists/EC-365-live-match-capture-harvester.checklist.md` — **new**
- `docs/ai/work-packets/WP-335-live-match-capture-harvester.md` — **new** — this file
- `docs/ai/STATUS.md` — **modified** (execution) — infrastructure-only entry
- `docs/ai/DECISIONS.md` — **modified** (execution) — D-24122

No other files. **File-count justification (§5 deviation):** ~10 code/test/migration
files form one cohesive capture pipeline (table + reader + capture + harvester +
reaper-coordination + tests); splitting would create an artificial boundary inside
one feature. The verifier repoint is already split out as WP-3b.

---

## Contract

- `bgio.replay_artifacts(replay_hash PK, match_id, scenario_key, initial_state,
  log, captured_at)` — the durable, replayHash-keyed artifact + the
  `replayHash → matchId` mapping + `scenarioKey`.
- `bgio.matches.captured_at` — dedupe marker + reaper guard.
- `captureMatch(matchId, db) → { matchId, replayHash, scenarioKey, seatsOwned, skipped }`.
- `readSeatAccounts(matchId, db) → { playerId, accountId }[]`.
- `startCaptureHarvester({ database, intervalMs }) → { stop() }`.
- Reaper: gameover rows reaped only when `captured_at IS NOT NULL`.

---

## Acceptance Criteria

- [ ] Migration 025 creates `bgio.replay_artifacts` (locked shape, PK `replay_hash`)
      + adds `bgio.matches.captured_at`; idempotent.
- [ ] `captureMatch` stores an artifact row whose `replay_hash` equals
      `reduceMatchToFinalState({ initialState, log }).stateHash`, with `match_id`,
      `scenario_key`, and the `{ initialState, log }` copy.
- [ ] `scenarioKey` = `buildScenarioKey` over the **set-abbr-stripped** selection ids
      (logic-pure test asserts the strip).
- [ ] `assignReplayOwnership` is called once per seat present in `match_seat_accounts`;
      a per-seat failure is logged and does not abort the others or the artifact write.
- [ ] `captureMatch` stamps `bgio.matches.captured_at`; a re-run is idempotent (no
      duplicate artifact, no duplicate ownership).
- [ ] The harvester scans only `gameover AND captured_at IS NULL` rows and captures
      each; immediate first run + `stop()` clears the timer (mock-timer test).
- [ ] `reapStaleMatches` does NOT reap a gameover row while `captured_at IS NULL`;
      reaps it once `captured_at` is set + past grace. The abandoned branch is unchanged.
- [ ] Capture does NOT write `competitive_scores`, does NOT gate on PAR, does NOT flip
      visibility, does NOT call `storeReplay`.
- [ ] Engine untouched (`git diff --name-only packages/` empty). No `computeStateHash`
      change.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` has Library-only rows for the new functions.
- [ ] No files outside `## Files Expected to Change` modified.

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — server tests (capture + harvester + reaper-guard; DB tests skip without TEST_DATABASE_URL)
pnpm --filter @legendary-arena/server test
# Expected: baseline preserved; new capture/harvester tests pass

# Step 3 — capture stores the reducer hash, not the live G hash
Select-String -Path "apps\server\src\replay\matchCapture.logic.ts" -Pattern "reduceMatchToFinalState"
# Expected: >= 1 match; capture derives replayHash from the reducer, never from bgio.matches.state.G

# Step 4 — capture does not score / does not call storeReplay
Select-String -Path "apps\server\src\replay\matchCapture.logic.ts" -Pattern "competitive_scores|storeReplay"
# Expected: no match

# Step 5 — reaper gameover branch now guards on captured_at
Select-String -Path "apps\server\src\db\matchReaper.js" -Pattern "captured_at"
# Expected: >= 1 match (the gameover-branch guard)

# Step 6 — engine untouched
git diff --name-only packages/
# Expected: no output

# Step 7 — scope
git diff --name-only
# Expected: matches Files Expected to Change
```

---

## Vision Alignment

**Vision clauses touched:** §22 (replay-verified competitive integrity — capture is
what makes a live match's result reproducible + attributable), §24 (public
leaderboards — this is the pipeline stage that will eventually feed them), §3
(identity — ownership is assigned to the server-verified account per seat, never a
client-supplied value; via the WP-333 seat table).

**Conflict assertion:** No conflict. Capture stores a faithful, server-authoritative
reconstruction + assigns ownership to the already-verified account; it introduces no
new scoring logic and no client trust.

**Non-Goal proximity check:** NG-1..7 — none crossed. No paid surface, no
pay-to-win, no data sale (the artifact + mapping are server-internal).

**Determinism preservation:** Capture reconstructs via the framework-seeded
`reduceMatchToFinalState` (WP-334) and stores its canonical hash; it changes no RNG
sourcing, no `computeStateHash`, no engine harness. Replay-faithful by construction
(Vision §22). No `G`/`ctx` mutation.

---

## Funding Surface Gate

**N/A** — a server-side background capture job + persistence. No global-nav / registry
/ profile funding affordance, no tournament funding channel, no user-visible funding
copy. Authority: WP-097, D-9701, D-9801.

---

## API Catalog Update (§21 — D-11804)

**Triggered** (adds `apps/server/src/**` library functions). At execution,
`docs/ai/REFERENCE/api-endpoints.md` gains `Library-only` rows for `captureMatch` and
`readSeatAccounts`, and a note that `startCaptureHarvester` is a background scheduler
(no HTTP surface), mirroring the reaper's catalog treatment. No HTTP endpoint added.

---

## Persistence Note + Decision (D-24122)

`bgio.replay_artifacts` lives in the **`bgio` schema**, not `legendary.*`. Rationale:
it holds a copy of the framework-shaped replay data (`initial_state`, `log`) that the
D-24119/D-24095 carve-out already authorizes the server replay pipeline to derive from
the bgio blob; keeping the durable copy in the `bgio` schema avoids persisting
framework-serialized state into the `legendary.*` domain schema (which D-24095's core
invariant forbids). It is a **derived, server-replay-pipeline-only** projection —
distinct from the framework's live match store (`bgio.matches`) — and is read only by
the capture + (future) verify pipeline, never by general application code. **D-24122**
records this: (a) the durable replay-artifact store in the `bgio` schema (extending the
D-24119 read carve-out to a durable derived copy, without amending the D-24095
`legendary.*` invariant); (b) capture is submittable-only (not scoring — the D-24119
fallback is not invoked); (c) `storeReplay`/`replay_blobs` is superseded by the
artifact table for the faithful path; (d) the reaper gameover-branch capture guard.

---

## Lint Gate Self-Review (00.3)

| § | Verdict | Notes |
|---|---------|-------|
| §1 Structure | PASS | All required sections incl. Out of Scope (≥2 exclusions) |
| §2 Constraints | PASS | Engine-wide + packet-specific + session protocol + locked values; 00.6; no partial output |
| §3 Assumes | PASS | WP-334/333/309/327/052 + the reaper/grace + the id-grammar facts explicit |
| §4 Context | PASS | DECISIONS + matchReplay + seatAccount + reaper + buildScenarioKey + SKILLs cited |
| §5 Output | PASS (deviation) | ~10 code/test files — one cohesive capture pipeline; justified above; verifier repoint already split to WP-3b |
| §6 Naming | PASS | `matchId`/`replayHash`/`scenarioKey`/`accountId`/`captured_at` consistent; `ext_id` linkage |
| §7 Dependencies | PASS | No new npm dep; `pg.Pool` reused |
| §8 Boundaries | PASS | Server + persistence; harvester not in the bgio adapter; artifact in bgio schema (D-24122); no engine edit; no DB in moves |
| §9 Windows | PASS | `Select-String` / `pnpm` |
| §10 Env vars | N/A | No new env vars (harvester interval is a locked constant; the reaper precedent uses no env) |
| §11 Auth | PASS | Ownership assigned only to seats with a `match_seat_accounts` row (server-verified accounts); no new auth surface; Limitations = per-seat best-effort |
| §12 Tests | PASS | `node:test`; DB-gated end-to-end + mock-timer harvester + reaper-guard; no boardgame.io import in tests |
| §13 Commands | PASS | Exact `pnpm` + `Select-String` w/ expected output |
| §14 Acceptance | PASS | 10 binary, observable, referenced items |
| §15 Definition of Done | PASS | STATUS/DECISIONS/WORK_INDEX + scope-boundary + User-Visible Surface (`none — infrastructure`) |
| §16 Code style | PASS | Small functions; `// why:` on the capture-not-score, reaper-guard, best-effort-per-seat, strip; no premature abstraction |
| §17 Vision | PASS | §22/§24/§3 cited; no conflict; determinism-preservation line present |
| §18 Prose-vs-grep | PASS | Step 3/4/5 greps target tokens (`reduceMatchToFinalState`, `competitive_scores`/`storeReplay`, `captured_at`) — prose usage intended; Step 4 expects zero |
| §19 Bridge staleness | N/A | No repo-state-summarizing artifact |
| §20 Funding | N/A | Justified: server background job + persistence, no funding surface |
| §21 API catalog | PASS | Triggered; Library-only rows obligated in the impl commit |

**Pre-flight self-verdict:** READY — deps (WP-334/333/309/327/052 Done; D-24119/24121
Active) on `main`; scope locked as capture-only (verifier repoint split to WP-3b);
the durability + schema-placement + reaper-coordination + submittable-only decisions
are resolved via the design research and recorded as D-24122; the moveCount/rounds
scoring question is deferred with WP-3b (does not affect capture). No ambiguity.

**Copilot self-check:** PASS — server+persistence only, cohesive capture pipeline, no
engine edit, no scoring, artifact in the bgio schema (no D-24095 `legendary.*`
invariant amendment), reaper guard scoped to the gameover branch, catalog obligation
captured, User-Visible Surface honestly `none — infrastructure`.

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (new capture/harvester/reaper-guard tests green, DB-gated verified locally where feasible; baseline preserved)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated in the impl commit (Library-only rows; §21)
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change — infrastructure only"; names the payoff (finished matches now captured + submittable; the `replayHash → matchId` mapping exists)
- [ ] `docs/ai/DECISIONS.md` updated — D-24122 (durable replay-artifact store in the `bgio` schema; capture submittable-only; `storeReplay` superseded; reaper capture-guard) flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-335 checked off with date
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`)
- [ ] Migration 025 applied to the local DB (`psql -f`) if running the DB-backed capture tests
