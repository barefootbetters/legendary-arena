# WP-627 — Host-Initiated "Add Guest" Match Seat (Server)

**Status:** Ready
**Primary Layer:** Server (`apps/server`)
**Dependencies:** Solo bot-ally arc (`POST /api/match/create-with-bot`, `BotAllyDriver`; seat 0 is never a bot, D-24120); WP-308 native-lobby internal-delegation guard; WP-338 by-matchId competitive submission (`guest_not_eligible`); WP-354 ranked human-clique eligibility.
**User-Visible Surface:** server endpoint only — a new host-gated `POST /api/match/add-guest`. The arena-client "Add guest" lobby control is a **paired follow-up client WP** and is out of scope here.

> The *action* is host-gated (`authenticated-session-required`); the *seat it mints* is anonymous (no account, no `match_seat_accounts` row). The only user-visible artifact this WP ships is the endpoint and its effect on match state — a guest seat appears, renders "Player N", and the match becomes non-ranked. The button that calls it ships in the follow-up client WP, so the D-24026 live-verify here is against the endpoint's observable effect, not a UI.

## Session Context

Account-free "walk-up" co-op play — a group at one table plays without everyone creating an account — is recorded on the ewiki [Guest Accounts](../../../wiki/guest-accounts.md) page as **Candidate B**, chosen over the shared `guest01`…`guest05` credential pool (Candidate A) per **D-24437**. Candidate B mints an anonymous seat modeled on the existing bot-ally secret-join, so it needs no shared credential, no geo-block, and no usage log. This WP builds the server mechanism.

## Goal

After this session an authenticated host can add an anonymous, non-account **guest seat** to a match they created, via a new server endpoint that secret-joins the seat exactly as the bot-ally `create-with-bot` flow does — writing **no `match_seat_accounts` row** (so the seat renders "Player N"), tagging the match **non-ranked**, and permanently excluding the seat from competitive submission and the ranked human-clique. A per-match guest-seat cap prevents a host from laundering a ranked lobby by seating guests.

## User-Visible Impact (D-24026)

A host can seat a friend who has no account, and they can play together. The guest seat shows as "Player N", the match is marked Casual (never ranked), and nothing the guest does produces a competitive score. Verified post-merge against the endpoint's observable effect on match state (the follow-up client WP wires the actual button).

## Assumes

- The create-with-bot secret-join exists and is the template: `POST /api/match/create-with-bot` in `apps/server/src/bot-ally/botAllyRoutes.mjs` secret-joins non-host seats via the WP-308 internal-delegation header and writes **no** `match_seat_accounts` row (D-24120). This WP mirrors that seat-credential handling; it does not invent a new one.
- A seat with **no** `match_seat_accounts` row and **no** bot tag already renders "Player N" via `readSeatIdentities` (`apps/server/src/match/seatAccount.logic.ts`).
- The match store tags non-ranked matches durably today via `match_bot_ally` (migration 033); the WP-354 eligibility path honors that tag / compares human-account seats against the player count.
- Competitive submission already refuses non-account participants three ways: the `guest_not_eligible` guard (`apps/server/src/competition/competition.logic.ts`), the client `'guest'` no-token status, and the non-ranked match tag (WP-338 / WP-354).
- The host is authenticated via the WP-112 session (`requireAuthenticatedSession`, `apps/server/src/auth/sessionToken.logic.ts`).
- If any assumption is false, this Work Packet is **BLOCKED** and must not proceed.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Layer Boundary (server wires, engine decides) + §Persistence Boundary (bgio framework-store exemption; snapshots counts-only).
- `.claude/rules/architecture.md` (Server layer responsibilities; `G` never persisted by app code).
- `wiki/guest-accounts.md` — Candidate B; the shared constraints; the pool-concurrency and handoff-client edge cases.
- `docs/ai/DECISIONS.md` — **D-24437** (this WP's decision), **D-24120** (bot seat carries no `match_seat_accounts` row; seat 0 never a bot).
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — the create-with-bot secret-join to mirror (seat-credential handling, internal-delegation header).
- `apps/server/src/match/matchGate.routes.ts` — the authenticated create/join gate the host already passed.
- `apps/server/src/match/seatAccount.logic.ts` — seat identity, the "Player N" fallback, `readSeatIdentities` / `recordSeatAccount`.
- `apps/server/src/competition/competition.logic.ts` — the `guest_not_eligible` guard and the WP-354 clique check.

## Non-Negotiable Constraints

Engine-wide game-determinism constraints (`ctx.random` only, no `Math.random()`, moves-never-throw) are **N/A** — this is a server-layer wiring packet that adds no engine, move, or effect code and mutates no `G`.

**Locked contract values:**

- Endpoint: **`POST /api/match/add-guest`** — Auth **`authenticated-session-required`** (host-gated). Returns the new seat's id (and the seat credential the host needs to occupy it), or a typed rejection.
- The guest seat writes **NO `match_seat_accounts` row** (mirrors the D-24120 bot-seat handling) → it renders "Player N".
- The match is non-ranked with **no new marker**: `computeRankedEligibility` **rule 2** (`roster.length !== seatCount`, whose own comment notes it "catches bots AND guests generically") already demotes any match whose account-roster is shorter than its bgio seat count. A guest seat writes no `match_seat_accounts` row, so it shortens the roster and forces `is_ranked_eligible = false` at submit time — **no durable "this match had a guest" marker and no migration are required**.
- A guest seat is **never** competitively submittable and **never** satisfies the ranked human-clique — it is counted the way a bot seat is (a seat that keeps the match Casual). The `guest_not_eligible` guard (`competition.logic.ts`) is **defense-in-depth**, not the reachable path: the minted seat has no session to submit with, so the reachable exclusion is "no account → cannot submit" plus the rule-2 demotion above.
- Seat selection: `add-guest` operates on an **already-created** match, so it discovers the next free seat and current occupancy from the bgio match **metadata** (`db.fetch(matchId, { metadata: true })` → `metadata.players`) — the same read `readBotSeatCredentials` uses, within the D-24095 / D-24119 framework-store metadata carve-out (a read, never a `G` interpretation).
- Per-match cap: **`MAX_GUEST_SEATS_PER_MATCH`** — bounded so the host at seat 0 is never displaced (D-24120) and total occupied seats never exceed the match player count.
- Scope is **host hot-seat only**: the endpoint mints a seat the host controls or hands off physically. A no-auth, device-bound **seat-bind handoff link** is OUT (new protocol; future client WP).

**Session protocol:** full-file contents for new/modified files (no diffs/snippets); ESM only; Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; no new npm dependencies; Hanko is the only auth broker.

## Scope (In)

- **A. Endpoint.** `POST /api/match/add-guest` in the server match / bot-ally route layer: authenticate the host, read the target match's occupancy from the bgio metadata (`db.fetch(matchId, { metadata: true })`, mirroring `readBotSeatCredentials`), secret-join **one** anonymous seat at the next free slot via the internal-delegation header (mirroring `create-with-bot`), write no `match_seat_accounts` row, enforce `MAX_GUEST_SEATS_PER_MATCH`, and return the seat id + credential to the host.
- **B. Non-ranked demotion (no new code).** Confirmed at pre-flight: `computeRankedEligibility` rule 2 (`roster.length !== seatCount`) already demotes any match with a non-account seat, so a guest seat is Casual with **zero new demotion code and no migration**. This sub-task is purely a **test** asserting a completed guest match is `is_ranked_eligible = false` via that path — do **not** add a `match_bot_ally`-style marker.
- **C. Tests** (`node:test`): 401 without a host session; cap enforcement; no `match_seat_accounts` row written; match tagged non-ranked; a completed guest match refused competitive submission; the WP-354 clique demoted to Casual with a guest seat present.

## Out of Scope

- The arena-client "Add guest" lobby button / UI — a **paired follow-up client WP**.
- The no-auth **seat-bind handoff link** (device-bound guest seat) — new protocol, a separate future WP.
- **Candidate A** (the shared `guest01`…`guest05` pool), its usage-log migration, and the Cloudflare geo-block / WAF rule — a different, not-chosen design (D-24437).
- Any new auth provider or shared credential.
- Any change to the ranked-eligibility **algorithm** itself (WP-354) beyond making a guest seat demote to Casual.
- Any engine / move / effect / determinism change; any `G` or `ctx` persistence; any snapshot beyond counts-only.

## Vision Alignment

This WP touches §17.1 triggers — **player identity / ownership / visibility (Vision §3, §11)** and **multiplayer late-join (Vision §4)** — so this block is mandatory.

- **§3 / §11 (identity, ownership, visibility).** A guest seat has no account and therefore no durable identity: it cannot own a replay (`assignReplayOwnership` requires an `AccountId`) and cannot submit a competitive score. This is *consistent* with the vision, not in tension — competitive standing is replay-verified and identity-anchored, and an anonymous seat is a casual participant only. The WP hard-excludes guest seats from every merit surface (competitive submission, ranked clique), so it cannot become a fairness bypass.
- **§4 (multiplayer).** The guest seat is a host-initiated addition to an already-created match; it does not change reconnection or late-join semantics beyond adding a seat the host controls.
- **NG-proximity.** None. Guest play is a free casual convenience, not a paid or gated feature — no NG-1 pay-to-win, no monetization or funding surface touched.
- **Determinism.** Unaffected — no engine randomness and no move code; this is a lobby / seat-binding concern, not a `G` mutation.

## Files Expected to Change

- `apps/server/src/bot-ally/botAllyRoutes.mjs` **or** a new sibling `apps/server/src/match/addGuestRoutes.mjs` — **new/modified** — the `POST /api/match/add-guest` handler (host-auth + metadata occupancy read + secret-join + cap). The executor picks per the existing module boundary and declares it in the EC.
- `apps/server/src/match/**` — **modified** — the `MAX_GUEST_SEATS_PER_MATCH` constant + any seat-selection helper.
- `apps/server/src/**/*.test.ts` — **new** — the acceptance tests.
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — a new whole row for `POST /api/match/add-guest` (§21; lands in the EC execution commit — Auth `authenticated-session-required`).

**No migration** — pre-flight confirmed the non-ranked demotion needs no durable marker (`computeRankedEligibility` rule 2). Allowlist ≤ ~4 files; the exact server-file boundary is confirmed at execution after reading `botAllyRoutes.mjs`, and **the executor enumerates the actual touched paths in the execution commit** so AC-9 is a concrete diff check, not a glob.

## Acceptance Criteria

1. `POST /api/match/add-guest` returns **401** with no authenticated host session.
2. With a valid host session on a match the host created, the endpoint adds **exactly one** seat and returns its seat id + credential.
3. **No `match_seat_accounts` row** is written for the guest seat; `readSeatIdentities` renders it "Player N".
4. A completed match containing a guest seat is `is_ranked_eligible = false` via the existing `computeRankedEligibility` **rule 2** (`roster.length !== seatCount`) — no new marker, no migration.
5. Adding guest seats beyond `MAX_GUEST_SEATS_PER_MATCH` (or beyond the match player count) is rejected with a typed error; the host at seat 0 is never displaced.
6. The **guest seat** produces no `competitive_scores` row (it has no session to submit with). The **host** may still submit and writes a **Casual** row (`is_ranked_eligible = false`), exactly as in a bot-ally match — the test asserts the Casual demotion + the guest seat's absence and does **not** assert the host's submission is refused.
7. The WP-354 ranked human-clique treats a guest seat like a bot seat (rule 2): the match is **Casual**, not ranked-eligible (`guest_not_eligible` is belt-and-suspenders, not the reachable path).
8. `pnpm --filter @legendary-arena/server build` and `pnpm --filter @legendary-arena/server test` both exit 0.
9. No file outside the allowlist is modified.

## Verification Steps

```pwsh
# Build + test the server package
pnpm --filter @legendary-arena/server build   # exit 0
pnpm --filter @legendary-arena/server test     # exit 0, guest-seat suite green

# Confirm the endpoint is registered and host-gated
Select-String -Path apps/server/src/**/*.mjs,apps/server/src/**/*.ts -Pattern "match/add-guest"
# Expected: the route registration + the requireAuthenticatedSession host gate

# Confirm the cap constant exists
Select-String -Path apps/server/src/**/*.ts -Pattern "MAX_GUEST_SEATS_PER_MATCH"
# Expected: one definition, referenced by the add-guest handler
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `docs/ai/STATUS.md` updated with what changed
- [ ] `docs/ai/DECISIONS.md` — **D-24437 flipped Drafted → Active** (post-execution)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` — new row for `POST /api/match/add-guest` (§21)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node flipped `📝` → `✅`; `pnpm roadmap:counts:check` exits 0
- [ ] No files outside the "Files Expected to Change" allowlist were modified

## Lint Gate Self-Review

Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — verdict per section:

- **§1 WP Structure** — PASS. All required sections present, non-empty; `## Out of Scope` names 7 excluded things.
- **§2 Non-Negotiable Constraints** — PASS. Engine constraints declared N/A with reason; locked contract values + session protocol present; forbids diffs/snippets; cites `00.6-code-style.md`.
- **§3 Prerequisites** — PASS. Every dep names the exact export/route/shape; ends with the BLOCKED clause.
- **§4 Context References** — PASS. Specific files + ARCHITECTURE §Layer Boundary + `.claude/rules/architecture.md` (layer boundary touched).
- **§5 Output Completeness** — PASS. Each file `new`/`modified` with a one-liner; ≤~4 files; no migration (pre-flight confirmed rule-2 demotion needs no marker); the executor enumerates the actual touched paths at commit so AC-9 is a concrete diff check.
- **§6 Naming Consistency** — PASS. `match_seat_accounts`, `match_bot_ally`, `AccountId`, `readSeatIdentities` match `00.2` / the codebase.
- **§7 Dependency Discipline** — PASS. No new npm deps; Hanko-broker-only stated.
- **§8 Architectural Boundaries** — PASS. Server layer only; no `G`/`ctx` in DB; no persistence added (the non-ranked demotion is submit-time computed by `computeRankedEligibility` rule 2 — no new table/column); the bgio-metadata occupancy read is within the D-24095/D-24119 carve-out.
- **§9 Windows Compatibility** — PASS. Verification uses `pwsh` + `Select-String`.
- **§10 Env Var Hygiene** — N/A. No new env vars.
- **§11 Authentication Clarity** — PASS. One identity model (Hanko session); the endpoint is `authenticated-session-required`; the seat it mints is explicitly anonymous.
- **§12 Test Quality** — PASS. `node:test`; no boardgame.io import; server DB-gated tests serialized per project convention.
- **§13 Commands & Verification** — PASS. `pnpm` + exact commands + expected output.
- **§14 Acceptance Criteria Quality** — PASS. 9 binary, observable checks.
- **§15 Definition of Done** — PASS; **§15.1** — `**User-Visible Surface:**` declared (server endpoint) + D-24026 live-verify noted.
- **§16 Code Style** — PASS. Human-style code required; no premature abstraction; explicit control flow; `// why:` required in the EC.
- **§17 Vision Alignment** — PASS. Mandatory block present (identity §3/§11 + multiplayer §4); NG-proximity none; determinism unaffected.
- **§18 Prose-vs-Grep** — PASS. The `match/add-guest` and `MAX_GUEST_SEATS_PER_MATCH` grep targets are literal route/constant names, not forbidden-token restatements.
- **§19 Bridge-vs-HEAD Staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. Guest play touches no funding / donate / tournament-funding surface; it is a free casual convenience.
- **§21 API Catalog Update** — PASS (deferred to execution). The new `POST /api/match/add-guest` row lands in `api-endpoints.md` in the EC execution commit; the file is in Files Expected to Change; Auth ∈ the closed set (`authenticated-session-required`).
