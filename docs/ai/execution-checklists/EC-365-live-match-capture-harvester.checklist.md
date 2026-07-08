# EC-365 — Live-Match Capture Harvester (WP-3a) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-335-live-match-capture-harvester.md
**Layer:** Server (`apps/server/**`) + Persistence (new `bgio.replay_artifacts`)

## Before Starting
- [ ] D-24119 + D-24121 Active; WP-334 Done (`reduceMatchToFinalState` / `readMatchForReplay`)
- [ ] WP-333 Done (`match_seat_accounts` + `recordSeatAccount`); WP-052 (`assignReplayOwnership`); WP-309 (`bgio.matches`); WP-327 (reaper)
- [ ] `pnpm install` + `pnpm -r build` exit 0; capture the `apps/server` baseline
- [ ] Target file set == the WP `Files Expected to Change` allowlist; anything outside is a FAIL

## Locked Values (do not re-derive)
- Migration `data/migrations/025_create_bgio_replay_artifacts.sql`
- Table `bgio.replay_artifacts`: `replay_hash text PRIMARY KEY`, `match_id text NOT NULL`, `scenario_key text NOT NULL`, `initial_state jsonb NOT NULL`, `log jsonb NOT NULL`, `captured_at timestamptz NOT NULL DEFAULT now()` — in the **`bgio` schema** (D-24122)
- `bgio.matches` gains `captured_at timestamptz` (nullable) — dedupe + reaper guard
- `captureMatch(matchId, database)` → `{ matchId, replayHash, scenarioKey, seatsOwned, skipped }` (`apps/server/src/replay/matchCapture.logic.ts`)
- `readSeatAccounts(matchId, database)` → `{ playerId, accountId }[]` (added to `seatAccount.logic.ts`)
- `replayHash` stored = `reduceMatchToFinalState({ initialState, log }).stateHash` — NEVER hash the live `bgio.matches.state.G`
- `scenarioKey = buildScenarioKey(strip(selection.schemeId), strip(selection.mastermindId), selection.villainGroupIds.map(strip))`, `strip(id) = id.slice(id.indexOf('/') + 1)` (set-abbr → bare slug, D-10014)
- `startCaptureHarvester({ database, intervalMs }) → { stop() }`; `CAPTURE_HARVESTER_INTERVAL_MS = 300_000` (5 min, well under GAMEOVER_GRACE_MS)
- Reserves D-24122

## Guardrails
- Capture is SUBMITTABLE-ONLY: store artifact + `replayHash→matchId` mapping (the artifact row's `match_id`) + `assignReplayOwnership` per authenticated seat. Do NOT write `legendary.competitive_scores`, do NOT gate on PAR, do NOT flip visibility, do NOT call `storeReplay`
- Durability: copy `{ initialState, log }` into `bgio.replay_artifacts` so it survives the reaper deleting the `bgio.matches` row; the future verifier reads the artifact table, never the live row
- `assignReplayOwnership` ONLY for seats present in `match_seat_accounts` (bots/guests have none, D-24120); a per-seat failure (`unknown_account` / DB throw) logs a full-sentence message and does NOT abort the other seats or the artifact write (best-effort per seat)
- Reaper amendment: add `AND captured_at IS NOT NULL` to the GAMEOVER branch of `reapStaleMatches` ONLY; the abandoned branch byte-unchanged
- Dedupe: harvester scans `jsonb_exists(metadata,'gameover') AND captured_at IS NULL`; stamp `captured_at` after a successful capture; artifact insert `ON CONFLICT (replay_hash) DO NOTHING`; `assignReplayOwnership` idempotent (re-capture harmless)
- Trigger is a SCAN harvester mirroring `startMatchReaper` — NOT a `bgioPgStore.setState` interceptor (per-move; gameover via setMetadata; keep the bgio adapter engine/legendary-free)
- Server + persistence only; artifact in the `bgio` schema (D-24122, NOT `legendary.*`); no engine edit; no `computeStateHash` change; `pg.Pool` reused; no new npm dep; no `Math.random`

## Required `// why:` Comments
- `matchCapture.logic.ts` replayHash source: why the reducer hash, not the live `state.G` (must match the verifier path)
- `matchCapture.logic.ts` best-effort per seat: why a seat failure logs + continues (partial attribution beats aborting the artifact)
- `matchCapture.logic.ts` no-score / no-PAR-gate: why capture only makes submittable (submission pipeline owns scoring + gates)
- `matchReaper.js` capture guard: why a gameover row is not reaped until `captured_at` (a capture outage past grace would lose a competitive match)
- `025_*.sql` bgio schema: why the artifact lives in `bgio` not `legendary.*` (D-24122 / D-24095 — derived framework-shaped projection)

## Files to Produce
- `data/migrations/025_create_bgio_replay_artifacts.sql` — **new** — table + `bgio.matches.captured_at`
- `apps/server/src/replay/matchCapture.logic.ts` — **new** — `captureMatch`
- `apps/server/src/replay/matchCapture.logic.test.ts` — **new** — DB-gated end-to-end + strip
- `apps/server/src/replay/captureHarvester.js` — **new** — `startCaptureHarvester`
- `apps/server/src/replay/captureHarvester.test.ts` — **new** — mock-timer scan + dedupe
- `apps/server/src/match/seatAccount.logic.ts` — **modified** — `readSeatAccounts`
- `apps/server/src/match/seatAccount.logic.test.ts` — **modified**
- `apps/server/src/db/matchReaper.js` — **modified** — gameover-branch capture guard
- `apps/server/src/db/matchReaper.test.ts` — **modified**
- `apps/server/src/index.mjs` — **modified** — harvester wiring (01.5)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — Library-only rows
- `docs/ai/DECISIONS.md` — **modified** — D-24122

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (new tests green; baseline preserved)
- [ ] Migration 025 applied locally (`psql -f`) if running the DB-gated capture tests
- [ ] Grep: `reduceMatchToFinalState` present in `matchCapture.logic.ts`; `competitive_scores`/`storeReplay` ABSENT; `captured_at` present in `matchReaper.js`
- [ ] `git diff --name-only packages/` empty (engine untouched)
- [ ] `api-endpoints.md` Library-only rows added (§21)
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only" (+ payoff)
- [ ] `docs/ai/DECISIONS.md` D-24122 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `git diff --name-only` == allowlist

## Common Failure Smells (Optional)
- Verifier (future WP-3b) can't find a submitted replay → capture didn't store the artifact / the `match_id` mapping, or the hash stored ≠ the reducer hash
- Competitive matches vanish under load → the reaper guard (`captured_at IS NOT NULL` on the gameover branch) was not added, so a capture outage reaped them
- Bot/guest seats error the capture → `assignReplayOwnership` called for a seat with no `match_seat_accounts` row (only authenticated seats have one)
- Every scenarioKey mismatches PAR later → the set-abbr `<setAbbr>/` prefix was not stripped before `buildScenarioKey`
