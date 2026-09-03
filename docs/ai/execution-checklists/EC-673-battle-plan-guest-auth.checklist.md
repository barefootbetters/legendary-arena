# EC-673 — Battle Plan Guest-Seat Authorization (Server) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-638-battle-plan-guest-auth.md
**Layer:** Server (`apps/server`)

## Before Starting

- [ ] On `main`, clean, fast-forward synced; `origin/main` baseline recorded in the WP.
- [ ] Read `apps/server/src/match/battlePlan.routes.ts` (`resolveParticipant` at :190, both routes, `registerBattlePlanRoutes` at :235) — the gate to extend.
- [ ] Read the metadata-read precedent `apps/server/src/bot-ally/botAllyRoutes.mjs:454` (`readBotSeatCredentials`) + `:798` (`db.fetch(matchId, { metadata: true })`), and the constant-time precedent `apps/server/src/match/guestAccess.logic.ts` (`timingSafeEqual`).
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (baseline).
- [ ] Target file set = exactly the `## Files to Produce` list; any file outside it is a FAIL, surfaced before editing.

## Locked Values (do not re-derive)

- Guest auth headers: `X-Guest-Player-Id` (bgio seat id) + `X-Guest-Credentials` (bgio `playerCredentials`). Headers ONLY — never the URL/query.
- Guest editor id: `` `guest:${playerId}` `` → `updated_by_ext_id` (audit-only, NOT projected in GET). Locked prefix `guest:`.
- New Auth closed-set value (extends D-9905, per D-24451): `match-seat-holder` (account participant OR verified guest seat). Add it to the authoritative `api-endpoints.md` Auth Taxonomy header AND set both Battle Plan rows to it; extend the `00.3 §21.2/§21.3` + `.claude/rules/work-packets.md` enumerations in lockstep (also backfilling the already-live `admin-session-required`).
- `resolveParticipant` return → `{ ok:true, matchId, editorId }` (editorId = account ext_id OR `guest:<playerId>`); routes pass `editorId` where they passed `accountId`.
- Injected dep `fetchMatchSeatCredentials(matchId) => Promise<Record<string,string> | null>` (seat → credential), wrapping `server.db.fetch(matchId, { metadata: true })` → `metadata.players`; `null` when absent. The dep field lands on `BattlePlanRouteDependencies` in **`battlePlan.routes.ts`** (where that interface is defined, ~lines 79-86), NOT in `.types.ts`.
- The credential read is a **framework metadata-surface** read (`metadata.players[].credentials`, the bot-ally `readBotSeatCredentials` precedent) — NOT the D-24119 state-replay carve-out and NOT a new carve-out; never `state`/`initialState`/`log`/`G`/`ctx`; never written back.

## Guardrails

- Guest path is a FALLBACK: `requireAuthenticatedSession` first; a VALID session ALWAYS takes the account path and IGNORES guest headers (an account holder can't spoof a guest seat). STOP if guest headers are ever consulted before the session is ruled out.
- Credential compare is `node:crypto` `timingSafeEqual`, length-guarded (unequal lengths → non-match without calling timingSafeEqual on mismatched buffers). No `===` string compare on the credential.
- Failed guest verify → `403 not_a_participant` — the SAME envelope as an account non-participant; do NOT distinguish "no such seat" from "wrong credential" (no seat-existence oracle).
- NO `legendary.match_seat_accounts` write for guests; do NOT touch `computeRankedEligibility` — guests stay rowless / Casual (D-24120 preserved).
- No `boardgame.io`/`game-engine` import in the Battle Plan files — the bgio metadata read is INJECTED via `fetchMatchSeatCredentials`, not imported. `verifyGuestSeatCredential`/`guestEditorId` are pure (no `pg`, no bgio).
- The account-holder path stays byte-for-byte behaviourally unchanged (regression test pins it).

## Required `// why:` Comments

- `resolveParticipant` guest branch: why the guest path is a fallback and why a valid session must win (no account→guest-seat spoof).
- The `timingSafeEqual` compare: why constant-time + length-guard (the credential is a secret; a timing/length oracle leaks seat validity).
- The `403 not_a_participant` on guest-verify failure: why it must not distinguish missing-seat from wrong-credential.
- `fetchMatchSeatCredentials` in `server.mjs`: why reading `metadata.players[].credentials` is a framework metadata-surface read (mirrors `readBotSeatCredentials`) needing NO persistence carve-out — NOT the D-24119 state-replay carve-out.
- `guest:<playerId>` editor id: why a synthetic audit id (guests have no `legendary.players.ext_id`; not projected).

## Files to Produce

- `apps/server/src/match/battlePlan.routes.ts` — **modified** — `resolveParticipant` guest branch + header parse; routes pass `editorId`; the `fetchMatchSeatCredentials` field on the `BattlePlanRouteDependencies` interface (defined here, ~79-86)
- `apps/server/src/match/battlePlan.logic.ts` — **modified** — `verifyGuestSeatCredential` (constant-time) + `guestEditorId`
- `apps/server/src/match/battlePlan.types.ts` — **modified** — `GuestSeatProof` + `GUEST_EDITOR_ID_PREFIX` only (deps field is in `routes.ts`)
- `apps/server/src/server.mjs` — **modified** — inject `fetchMatchSeatCredentials` (01.5 runtime-wiring; the ONLY wiring file)
- `apps/server/src/match/battlePlan.routes.test.ts` — **modified** — guest-valid / wrong-cred / absent-seat / valid-session-ignores-headers / **spoof-vector (valid non-participant session + valid guest headers → account-path 403)** / no-session-no-headers-401 / account-path-unchanged / **seat-table-empty-after-guest-write**
- `apps/server/src/match/battlePlan.logic.test.ts` — **modified** — `verifyGuestSeatCredential` truth table + `guestEditorId` format
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — both rows `Auth = match-seat-holder` + the `match-seat-holder` taxonomy row (D-11804; authoritative Auth set)
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — **modified** — §21.2/§21.3 Auth enumeration → 5-value (backfill `admin-session-required` + add `match-seat-holder`)
- `.claude/rules/work-packets.md` — **modified** — the `Auth ∈ {…}` set in lockstep. **`.claude/rules/` edit — operator-approved (2026-09-03); MUST land in the `SPEC:`/`INFRA:` govern-close commit, NEVER the `EC-673:` commit** (reward-integrity guard blocks `.claude/` in an `EC-###:` commit).

## After Completing

- [ ] `pnpm --filter @legendary-arena/server test` exits 0
- [ ] `Select-String` confirms: no `boardgame.io`/`game-engine` import in the Battle Plan files; `timingSafeEqual` + `X-Guest` present in the routes; no `match_seat_accounts` INSERT added
- [ ] Auth closed set extended in lockstep across `api-endpoints.md` + `00.3 §21` + `.claude/rules/work-packets.md` (= `guest | handle-required | authenticated-session-required | admin-session-required | match-seat-holder`); the `.claude/rules/` edit is in the `SPEC:`/`INFRA:` commit, not `EC-673:`
- [ ] `docs/ai/DECISIONS.md` — create D-24451 Active (post-execution), citing **D-9905**'s re-gating clause (NOT a phantom D-9906) as authority + framing it as a surface-scoped reversal of D-24120; record the D-9905 Auth set extension
- [ ] `docs/ai/STATUS.md` — "No user-observable change — infrastructure only (enables the paired guest-client WP)"
- [ ] `WORK_INDEX.md` WP-638 checked off; `EC_INDEX.md` EC-673 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝 → ✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells

- An account holder can write as a guest seat → the session check didn't short-circuit the guest branch (guest headers consulted despite a valid session).
- A wrong credential is accepted, or a length mismatch throws → the compare isn't length-guarded `timingSafeEqual`.
- The guest-verify failure leaks whether the seat exists → it returned a different code/status for missing-seat vs wrong-credential (must both be `403 not_a_participant`).
- A guest write shows up in the GET response as `updatedByExtId` → the audit id was projected (it must stay stripped, per WP-635).
- Ranked eligibility changed / a `match_seat_accounts` row appeared → the guest path wrote a seat row (forbidden; guests stay rowless).
- Tests race a DB suite → `--test-concurrency=1` on any DB-gated case.
