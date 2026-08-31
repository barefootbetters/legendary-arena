# EC-662 — Host-Initiated "Add Guest" Match Seat (Execution Checklist)

**Source:** docs/ai/work-packets/WP-627-guest-seat-host-add.md
**Layer:** Server (`apps/server`)

## Before Starting

- [ ] Read `apps/server/src/bot-ally/botAllyRoutes.mjs` — the `create-with-bot` secret-join is the template; mirror its seat-credential handling and its `db.fetch(matchId, { metadata: true })` occupancy read (`readBotSeatCredentials`), do not invent one.
- [ ] Confirm (pre-flight-verified) `computeRankedEligibility` rule 2 (`roster.length !== seatCount`) still demotes any non-account seat — the guest seat then needs **no** demotion code and **no** migration.
- [ ] `pnpm --filter @legendary-arena/server build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (establish the green baseline)

## Locked Values (do not re-derive)

- Endpoint: `POST /api/match/add-guest` — Auth `authenticated-session-required` (host-gated).
- Guest seat writes **NO `match_seat_accounts` row** (mirror D-24120) → renders "Player N".
- Non-ranked with **NO new marker**: `computeRankedEligibility` rule 2 (`roster.length !== seatCount`) demotes any non-account seat at submit time — no durable guest marker, no migration.
- Seat discovery: read occupancy from bgio metadata (`db.fetch(matchId, { metadata: true })` → `metadata.players`), mirroring `readBotSeatCredentials`; within the D-24095/D-24119 carve-out (a read, not a `G` interpretation).
- Guest seat is **never** competitively submittable and **never** satisfies the ranked human-clique (counted like a bot seat); `guest_not_eligible` is belt-and-suspenders, not the reachable path.
- Per-match cap constant: `MAX_GUEST_SEATS_PER_MATCH` — host at seat 0 never displaced (D-24120); occupied seats never exceed the match player count.
- Host **hot-seat only**; the no-auth seat-bind handoff link is OUT.

## Guardrails

- Server layer only — no engine / move / effect / determinism code; no `G` or `ctx` mutation or persistence.
- No persistence is added — the non-ranked demotion is submit-time computed by `computeRankedEligibility` rule 2; no new table/column/migration; snapshots stay counts-only.
- The endpoint authenticates the host via `requireAuthenticatedSession`; a missing/invalid session returns 401 (never mints a seat).
- Reuse the internal-delegation secret-join; do not expose native `/games/*` create/join.
- The guest-seat demotion is `computeRankedEligibility` rule 2 (roster shorter than seat count) — verify with a test; do not add a `match_bot_ally`-style marker.
- Do not touch the WP-354 eligibility algorithm — rule 2 already covers the guest seat.
- No new npm dependencies; ESM; Node v22+; human-style code per `00.6`.

## Required `// why:` Comments

- On `MAX_GUEST_SEATS_PER_MATCH`: why this bound (host seat 0 preserved; total ≤ player count).
- On the no-`match_seat_accounts`-row path: why (D-24120 — anonymous seat renders "Player N"; also what makes rule 2 demote it).
- On the bgio-metadata occupancy read: why it is within the D-24095/D-24119 carve-out (metadata, not `G`).
- On any swallowed error in the secret-join path: why it is safe.

## Files to Produce

- `apps/server/src/bot-ally/botAllyRoutes.mjs` **or** `apps/server/src/match/addGuestRoutes.mjs` — **new/modified** — the `POST /api/match/add-guest` handler.
- `apps/server/src/match/**` — **modified** — `MAX_GUEST_SEATS_PER_MATCH` + any seat-selection helper.
- `apps/server/src/**/*.test.ts` — **new** — host-gated 401, cap, no seat-account row, non-ranked (rule 2), guest-seat-produces-no-score, clique-Casual.
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — new whole row for `POST /api/match/add-guest` (Auth `authenticated-session-required`).
- **No migration** (rule-2 demotion needs no marker). In the execution commit, **enumerate the actual touched paths** so AC-9 is a concrete diff, not a glob.

## After Completing

- [ ] `pnpm --filter @legendary-arena/server build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (guest-seat suite green; DB tests serialized `--test-concurrency=1`)
- [ ] Live-on-surface verification (D-24026) — the endpoint adds a "Player N" seat and marks the match non-ranked in a real match
- [ ] `docs/ai/REFERENCE/api-endpoints.md` — new row present, whole-row, Status `Wired`
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24437 flipped Drafted → Active (post-execution)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — row checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` — node flipped `📝` → `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)

- A guest match shows as ranked-eligible → the guest seat wrote a `match_seat_accounts` row, so the roster isn't shorter than the seat count and rule 2 never fired; remove the row.
- The seat renders `<unknown>` instead of "Player N" → a `match_seat_accounts` row was written; remove it.
- 500 on the endpoint reading `request.body` → the custom `/api` route needs its own body parser (no global parser).
