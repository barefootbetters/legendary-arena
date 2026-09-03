# WP-638 — Battle Plan Guest-Seat Authorization (Server)

**Status:** Ready
**Primary Layer:** Server (`apps/server`)
**Dependencies:** WP-635 ✅ (the Battle Plan endpoints + gate this extends), WP-627/WP-630 ✅ (guest seats + the bgio-credential minting this authorizes against), WP-333/WP-335 ✅ (the account participant path, unchanged)
**User-Visible Surface:** none directly — infrastructure (the auth extension that makes the WP-637 Battle Plan panel usable by a guest; the guest-visible change lands with the paired client WP). No new user-observable behavior ships in this packet alone.
**Baseline:** `origin/main` @ `7b681f15` (draft worktree checkout point; the reserve-only ledger commit lands on top)

## Session Context

D-24451 locks a new, deliberate auth posture: the Battle Plan endpoints
authorize a **guest** by their boardgame.io **seat credential**, not a Hanko
session. Today `resolveParticipant` (`apps/server/src/match/battlePlan.routes.ts:190`)
rejects a guest twice — no Hanko session (`401`) and no
`legendary.match_seat_accounts` row (`403 not_a_participant`, D-24120). But a
guest is a real seated player in the match (the WP-627..631 walk-up-guest arc),
and the Battle Plan is a shared-team artifact they should be able to read and
write. This packet extends the gate; the paired client WP makes the panel send
the guest's credential.

## Goal

After this packet, `PUT`/`GET /api/match/:matchId/battle-plan` authorize a
caller who is **either** an authenticated account holding a seat in the match
(the existing path, unchanged) **or** a guest who proves their seat with a
valid boardgame.io credential. When `requireAuthenticatedSession` fails, the
gate reads the guest's `X-Guest-Player-Id` + `X-Guest-Credentials` request
headers, verifies them (constant-time) against the seat credential stored in
the bgio match metadata, and on success authorizes that seat with a synthetic
`guest:<playerId>` editor id. Guests remain rowless in `match_seat_accounts`;
nothing about ranked eligibility changes.

## User-Visible Impact

**None in this packet — infrastructure.** No user-observable change ships from
the server extension alone; a guest cannot exercise it until the paired client
WP sends the headers. STATUS records "No user-observable change —
infrastructure only (enables the paired guest-client WP)." (The D-24026
live-verify belongs to the client WP that produces the visible behavior.)

## Assumes

- WP-635 shipped `resolveParticipant` (`battlePlan.routes.ts:190`) as the single
  gate both routes call, returning `{ ok:true, accountId, matchId }` or an error
  envelope; `registerBattlePlanRoutes(router, database, deps, logic?)` is wired in
  `server.mjs`. Confirm on `main`.
- A guest's proof-of-seat is a boardgame.io `playerCredentials` string bound to
  `(matchId, seat)`, minted by `mintGuestSeat` (`addGuestRoutes.mjs`) and carried
  by the client in the live-route `?match=&player=&credentials=` params.
- The bgio store exposes the seat credential via `db.fetch(matchId, { metadata:
  true })` → `metadata.players[playerId].credentials` — the **same read class
  already in production** for bot-ally (`readBotSeatCredentials`,
  `botAllyRoutes.mjs:454,798`) and guest-mint. This is a **framework
  metadata-surface read** (the bgio store's own `metadata`, NOT the
  `state`/`initialState`/`log`/`G`/`ctx` blob), which per the bot-ally precedent
  needs **no persistence carve-out** — do not conflate it with the D-24119
  replay carve-out (that one reads `initialState + log` through the reducer, the
  exact thing this WP avoids).
- `node:crypto` `timingSafeEqual` is the constant-time compare (the
  `guestAccess.logic.ts` password-verify precedent).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

## Context (Read First)

- `.claude/rules/architecture.md` §Persistence Boundary — the framework-store
  exemption (D-24095). Reading the bgio `metadata` surface
  (`metadata.players[].credentials`) is a **framework metadata-surface** read,
  distinct from a `state`/`initialState`/`log`/`G`/`ctx` read, and per the
  bot-ally `readBotSeatCredentials` precedent needs **no persistence carve-out**.
- `docs/ai/DECISIONS.md` D-24120 (bots/guests are rowless in
  `match_seat_accounts`; load-bearing for ranked-eligibility rule 2), **D-9905**
  ("Guest Policy Preserved; Hanko Never Gates Gameplay") — its Active Status
  clause requires a new D-entry + explicit WP + reconciliation for any
  auth-posture change on a gated endpoint. The clause is written for the
  *restrict* direction (gating a guest feature behind auth); WP-638 does the
  **inverse** — it opens an account-gated non-gameplay surface to verified guest
  seats, which *advances* D-9905's guest-friendly intent — and **D-24451 is the
  required new decision + reconciliation**.
- `apps/server/src/bot-ally/botAllyRoutes.mjs:454,798` — `readBotSeatCredentials`
  + `db.fetch(..., { metadata: true })`, the metadata-read pattern to mirror.
- `apps/server/src/match/guestAccess.logic.ts` — `timingSafeEqual` constant-time
  compare precedent.
- `apps/server/src/match/battlePlan.routes.ts` — `resolveParticipant` (the gate),
  the two routes, `registerBattlePlanRoutes` signature + the `deps` bundle.

## Non-Negotiable Constraints

**Server packet (engine determinism constraints N/A — no `G`/`ctx`/moves/RNG):**

- The guest path is a **fallback**: try `requireAuthenticatedSession` first; a
  **valid** session ALWAYS takes the account path (guest headers are ignored when
  a session is valid, so an account holder cannot spoof a guest seat). Only when
  the session is absent/invalid does the gate consult the guest headers.
- Guest credentials travel in **request HEADERS** (`X-Guest-Player-Id`,
  `X-Guest-Credentials`), **never** the URL/query (credentials are sensitive;
  URL/query would leak them into logs/history).
- The credential compare is **constant-time** (`timingSafeEqual` over equal-length
  buffers; a length mismatch is a non-match without leaking timing).
- A failed guest verification returns **`403 not_a_participant`** — the SAME code
  as an account non-participant, and it does **not** distinguish "no such seat"
  from "wrong credential" (no seat-existence oracle).
- Guests stay **rowless** in `legendary.match_seat_accounts`. This packet writes
  no seat row and does not touch `computeRankedEligibility`; a guest match stays
  Casual (D-24120 preserved).
- The metadata read is the **only** new framework-store access and is a
  `metadata`-surface read (the bot-ally `readBotSeatCredentials` precedent; no
  carve-out) — never `state`/`initialState`/`log`/`G`/`ctx`, never written back.

**Locked contract values:**
- Guest auth headers: `X-Guest-Player-Id` (the bgio seat id, e.g. `"1"`),
  `X-Guest-Credentials` (the bgio `playerCredentials` string). Deliberately
  distinct from the WP-177 rewind headers `X-Player-ID` / `X-Credentials`
  (different casing + a `Guest`-specific name) so the two auth surfaces never
  alias.
- Guest editor id: `` `guest:${playerId}` `` — written to `updated_by_ext_id`
  (audit-only; **not** projected in the GET response, per WP-635). A locked
  format constant, distinct from any real `legendary.players.ext_id`.
- New Auth closed-set value (extends D-9905): `match-seat-holder` — the caller is
  an account participant in the match **or** a verified guest seat. Both Battle
  Plan rows adopt it in `api-endpoints.md`.
- `resolveParticipant` return becomes `{ ok:true, matchId, editorId }` where
  `editorId` is the account `ext_id` (account path) or `guest:<playerId>` (guest
  path); the routes pass `editorId` where they passed `accountId`.
- New injected dep `fetchMatchSeatCredentials(matchId) => Promise<Record<string,
  string> | null>` (seat id → credential), wrapping `server.db.fetch(matchId, {
  metadata: true })`; `null` when the match/metadata is absent.

**Session protocol:** one WP per session; do not fold in the client credential-
passing (that is the paired WP).

## Debuggability & Diagnostics

- The gate is deterministic given identical inputs + metadata; no RNG, no clock
  branch. `timingSafeEqual` removes the timing side channel.
- A guest write stamps `updated_by_ext_id = guest:<playerId>` so an operator can
  see a phase was authored by a guest seat (audit only; never surfaced to clients).
- The guest path reuses the same `403 not_a_participant` envelope, so the client
  handles guest-auth failure with the code it already knows.

## Scope (In)

### A) The gate (guest branch)
- `apps/server/src/match/battlePlan.routes.ts` — **modified**. `resolveParticipant`:
  after a failed `requireAuthenticatedSession`, if `X-Guest-Player-Id` +
  `X-Guest-Credentials` headers are present, read the match seat credentials via
  the injected `fetchMatchSeatCredentials`, `verifyGuestSeatCredential`, and on
  success return `{ ok:true, matchId, editorId: guest:<playerId> }`; else keep the
  existing session/participant error. Return type + the two routes updated to pass
  `editorId`.

### B) Pure logic
- `apps/server/src/match/battlePlan.logic.ts` — **modified**.
  `verifyGuestSeatCredential(seatCredentials, playerId, supplied)` — constant-time
  compare of `supplied` against `seatCredentials[playerId]` (length-guarded,
  `timingSafeEqual`); `guestEditorId(playerId)` — the `guest:<playerId>` format.
  Pure; no `pg`, no `boardgame.io`.

### C) Types (`.types.ts` contract additions — governed by D-24451)
- `apps/server/src/match/battlePlan.types.ts` — **modified**. `GuestSeatProof`
  (`{ playerId, credentials }`) and the `GUEST_EDITOR_ID_PREFIX` constant only.
  (The `fetchMatchSeatCredentials` dep field lands on the
  `BattlePlanRouteDependencies` interface in `battlePlan.routes.ts` — where that
  interface is actually defined, lines 79-86 — **not** here; a normal route-file
  change, so the `.types.ts` contract additions stay minimal.)

### D) Wiring (01.5 runtime-wiring)
- `apps/server/src/server.mjs` — **modified**. Inject
  `fetchMatchSeatCredentials`, a closure over `server.db.fetch(matchId, {
  metadata: true })` that projects `metadata.players` → `{ seat: credentials }`
  (mirrors `readBotSeatCredentials`), into `registerBattlePlanRoutes`.

### E) API catalog + Auth closed-set extension (D-11804 + D-9905/D-24451)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified**. Both Battle Plan rows'
  `Auth` → the new `match-seat-holder` value, AND the Auth Taxonomy header: add
  the `match-seat-holder` taxonomy row + bump the count/extension note. This
  header is the **authoritative** closed set.
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — **modified**. §21.2 + §21.3
  Auth enumeration extended to the full set (also **backfilling** the already-live
  `admin-session-required`, D-15901, the enumeration is currently missing) +
  `match-seat-holder`.
- `.claude/rules/work-packets.md` — **modified**. The `Auth ∈ {…}` set updated in
  lockstep (same backfill + `match-seat-holder`). **This is a `.claude/rules/`
  edit — operator-approved for this WP (2026-09-03), and it MUST land in the
  `SPEC:` govern-close commit (or an `INFRA:` commit), NEVER the `EC-673:`
  implementation commit** (the reward-integrity guard blocks `.claude/` edits in
  an `EC-###:` commit).

### F) Tests
- `apps/server/src/match/battlePlan.routes.test.ts` — **modified**: guest with a
  valid credential reads + writes; guest with a wrong credential → `403
  not_a_participant`; guest for a seat not in the metadata → `403`; a **valid
  session ignores** guest headers (account path wins) — **including the spoof
  vector: a valid but NON-participant session that also sends valid guest
  headers still gets the account-path `403`, never the guest authorization**;
  missing guest headers + no session → the existing `401`; **after a guest
  write, `match_seat_accounts` for that match stays empty** (guests stay rowless).
- `apps/server/src/match/battlePlan.logic.test.ts` — **modified**:
  `verifyGuestSeatCredential` truth table (match / wrong / absent seat / length
  mismatch) and `guestEditorId` format.

## Out of Scope

- The client credential-passing (`useBattlePlan`/`battlePlanApi` sending the
  headers when `authStore.token` is null) — the **paired follow-on WP**.
- Any `match_seat_accounts` write for guests; any `computeRankedEligibility`
  change (guests stay rowless / Casual — D-24120 preserved).
- Any change to the account-holder path, the phase columns, the length cap, or the
  response shape (WP-635 contract otherwise unchanged).
- Any new blob read beyond the `metadata.players[].credentials` projection; any
  `state`/`log`/`G`/`ctx` read; any write-back to the blob.
- Reactions / author display / LAGN export.

## Vision Alignment

Extends guest play (§4 multiplayer; the WP-627..631 walk-up-guest arc) to the
Battle Plan surface, so a guest at the table is a full team participant in
planning. §23(b) safe — a shared team artifact, no player-vs-player targeting.
No anti-commercial commitment; no gameplay-balance or determinism impact (a
non-gameplay REST surface).

## Files Expected to Change

- `apps/server/src/match/battlePlan.routes.ts` — **modified** — `resolveParticipant` guest branch
- `apps/server/src/match/battlePlan.logic.ts` — **modified** — `verifyGuestSeatCredential` + `guestEditorId`
- `apps/server/src/match/battlePlan.types.ts` — **modified** — `GuestSeatProof` + `GUEST_EDITOR_ID_PREFIX` (the deps field lands in `routes.ts`, see §Scope C)
- `apps/server/src/server.mjs` — **modified** — inject `fetchMatchSeatCredentials` (01.5 runtime-wiring; the ONLY wiring file)
- `apps/server/src/match/battlePlan.routes.test.ts` — **modified**
- `apps/server/src/match/battlePlan.logic.test.ts` — **modified**
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — both rows' Auth + the `match-seat-holder` taxonomy row (D-11804; the authoritative Auth closed set)
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — **modified** — §21.2/§21.3 Auth enumeration extended (+ `admin-session-required` backfill + `match-seat-holder`)
- `.claude/rules/work-packets.md` — **modified** — the `Auth ∈ {…}` set extended in lockstep. **`.claude/rules/` edit — operator-approved (2026-09-03); lands in the `SPEC:`/`INFRA:` govern-close commit, NEVER the `EC-673:` commit** (reward-integrity guard).

No other files may be modified (beyond the governance close-out: STATUS.md, DECISIONS.md, WORK_INDEX.md, ROADMAP-MINDMAP.md, EC_INDEX.md).

## Contract

- **Auth (both routes):** `match-seat-holder` — a valid Hanko session whose
  account is in the match roster, **or** valid `X-Guest-Player-Id` +
  `X-Guest-Credentials` headers matching the bgio seat credential.
- **Precedence:** a valid session always wins; guest headers are consulted only
  when the session is absent/invalid.
- **Failure:** `401` (no/invalid session and no guest headers — the pass-through
  session code); `403 not_a_participant` (session-but-not-in-roster, OR guest
  headers that don't verify — no seat-existence oracle); `400 invalid_request`
  (missing `matchId`).
- **Guest write identity:** `updated_by_ext_id = guest:<playerId>` (audit-only,
  not projected). Response shape unchanged.

## Acceptance Criteria

- [ ] A guest with a credential matching `metadata.players[playerId].credentials` can GET and PUT (per-phase upsert), returning the same document shape as an account holder.
- [ ] A guest with a **wrong** credential, or for a seat absent from the metadata, gets `403 not_a_participant` (indistinguishable).
- [ ] Guest auth is read from `X-Guest-Player-Id` + `X-Guest-Credentials` **headers** only — never the URL/query.
- [ ] The compare is `timingSafeEqual` (length-guarded); a length mismatch is a non-match.
- [ ] A **valid session** takes the account path and **ignores** any guest headers.
- [ ] No session + no guest headers → the existing `401` (pass-through session code); the account-holder path is otherwise byte-for-byte unchanged (regression test).
- [ ] A guest write stamps `updated_by_ext_id = guest:<playerId>`; the GET response still omits it.
- [ ] No `match_seat_accounts` write (a test asserts the seat table stays empty after a guest write); `computeRankedEligibility` untouched; the only new framework-store access is the `metadata.players[].credentials` projection.
- [ ] `api-endpoints.md` both rows show `Auth = match-seat-holder` (D-11804), whole-row, plus the new taxonomy row; the Auth closed set is extended in lockstep across `api-endpoints.md` + `00.3 §21` + `.claude/rules/work-packets.md` (with the pre-existing `admin-session-required` backfilled).

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/server test              # exits 0 (incl. the new guest cases)
# DB-gated persistence unchanged; if a guest write is exercised against local pg, run serialized:
node --test --test-concurrency=1 apps/server/src/match/battlePlan.routes.test.ts
Select-String -Path apps/server/src/match/battlePlan.*.ts -Pattern "boardgame.io|game-engine"   # no matches
Select-String -Path apps/server/src/match/battlePlan.routes.ts -Pattern "timingSafeEqual|X-Guest"  # present
git diff --name-only origin/main                         # only the allowlist + governance close
```

## Definition of Done

- [ ] **User-visible verification (CONDITIONAL):** surface is `none — infrastructure` → `docs/ai/STATUS.md` states "No user-observable change — infrastructure only (enables the paired guest-client WP)"; the D-24026 live-verify belongs to the client WP.
- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/server test` exits 0
- [ ] No `boardgame.io` / `game-engine` import in the Battle Plan files (Select-String)
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` — both rows `Auth = match-seat-holder` + the `match-seat-holder` taxonomy row (D-11804)
- [ ] Auth closed set extended in lockstep: `00.3 §21.2/§21.3` + `.claude/rules/work-packets.md` now list `guest | handle-required | authenticated-session-required | admin-session-required | match-seat-holder` (the `.claude/rules/` edit rides the `SPEC:`/`INFRA:` govern-close, operator-approved — never the `EC-673:` commit)
- [ ] `pnpm --filter @legendary-arena/server test` (and the §21 lint gate) green with the extended set
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — **create** D-24451 as **Active (post-execution)** (RESERVED in NUMBER-LEDGER; no prior "Drafted" entry to flip): cite **D-9905**'s re-gating clause as authority (not a phantom D-9906), frame it as a surface-scoped reversal of D-24120, and record the D-9905 Auth closed-set extension (`match-seat-holder`) + the `admin-session-required` backfill
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-638 checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-673 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Lint Gate Self-Review

Per `00.3` (21 sections):
- §1 PASS (sections; Out-of-Scope closed). §2 PASS (engine N/A; locked values; `00.6`). §3 PASS (deps incl. WP-635/627/630 ✅ + BLOCKED clause). §4 PASS (9-file allowlist — 7 code/doc + the 2 Auth-closed-set enforcement files — all bound by D-24451; the `.claude/rules/` edit is operator-approved and commit-routed to `SPEC:`/`INFRA:`). §5 PASS (server-only, additive to the gate). §6 PASS (headers/editor-id/Auth-value/dep-signature locked; verified against `readBotSeatCredentials`/`timingSafeEqual`). §7 PASS (deps shipped). §8 PASS (server-only; the `metadata`-surface read is the bot-ally precedent needing NO carve-out — NOT the D-24119 state-replay carve-out; no `G`/`ctx`). §9 PASS (`pwsh`). §10 PASS (layer boundary — server; the bgio read is injected, not a direct engine import). §11 N/A (no determinism surface). §12 PASS (persistence: framework metadata-surface read, no carve-out; no `match_seat_accounts` write; guests stay rowless). §13 N/A. §14 PASS (naming; `matchId`/`playerId` / `guest:<playerId>`; `X-Guest-*` distinct from WP-177 rewind headers). §15 PASS (`403 not_a_participant` full-coded envelope; constant-time; no oracle). §16 PASS (server `node:test`; DB-gated serialized). §17 PASS (the `.types.ts` contract additions are minimal — `GuestSeatProof` + one constant — and governed by D-24451; the deps field is a normal `routes.ts` change). §18 PASS (D-24451 reserved; created at execution citing **D-9905** [not a phantom D-9906]; D-9905 Auth set extended in lockstep). §19 PASS (WP-635/627/630/333/335 shipped). §20 PASS (one WP; client is a separate WP). §21 **EXTENDS the closed set** — the WP adds `match-seat-holder` (+ backfills `admin-session-required`) across the authoritative `api-endpoints.md` taxonomy AND the `00.3 §21` + `work-packets.md` enumerations in lockstep, so §21.3 passes on the extended set (D-11804 + D-9905/D-24451).
