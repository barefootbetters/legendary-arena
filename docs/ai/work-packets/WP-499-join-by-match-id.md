# WP-499 — Join by Match ID or Link (lobby manual-join affordance)

**Status:** Draft 2026-08-04 — standard two-session lane. **Gates: lint SATISFIED (21/21) · pre-flight READY · copilot PASS** — see Gate Verdicts.
**User-Visible Surface:** `arena-client` lobby (a new "Join by match ID or link" input; D-24026 live-verification applies).
**Primary Layer:** App (`apps/arena-client` — the lobby view + its lobby API client). No engine/registry/server/data touch; reuses the existing `POST /api/match/join`.
**Dependencies:** WP-307 / D-24092 (the authenticated match-gate `joinMatch` → `POST /api/match/join`); WP-369 (the copy-join-link `?route=lobby&match=<id>` deep link this parses and mirrors).

---

## Goal

Today a player can only join a match by clicking **Join** on a row in the lobby's auto-fetched public match list, or by opening a copy-join-link (`?route=lobby&match=<id>`) that merely *highlights* a row already in that list. There is no way to type or paste a match ID or an invite link to join directly — so an **unlisted** match, or a match not yet in the fetched list, is unreachable without the exact deep link. This WP adds a **"Join by match ID or link"** input to the lobby: the player pastes a raw match ID or a full invite link, the client extracts the match ID, fetches that single match (read-only), and joins its first open seat via the existing `joinMatch`. It is identity-agnostic — exactly like the copy-link flow that already works — which also makes it the reliable path to play with a brand-new friend while the never-wired handle-claim system blocks by-`@handle` match invites (see Context). No server change, no new endpoint.

## Assumes (Hard-Gate Preconditions)

```bash
# A. joinMatch posts to the existing match-gate join endpoint (the join path we reuse).
grep -q "/api/match/join" apps/arena-client/src/lobby/lobbyApi.ts && echo "A_OK joinMatch → POST /api/match/join exists"
# B. The lobby already reads the `match` query param from the copy-join-link (the URL shape we parse).
grep -q "get('match')" apps/arena-client/src/lobby/LobbyView.vue && echo "B_OK ?match=<id> deep link param confirmed"
# C. No manual-join-by-id affordance exists today (this WP introduces it).
! grep -qi "joinByReference\|join by match id" apps/arena-client/src/lobby/LobbyView.vue && echo "C_OK no join-by-id input today"
# D. The lobby list already stringifies boardgame.io seat ids (the mapping fetchMatch mirrors).
grep -q "String(seat.id)" apps/arena-client/src/lobby/lobbyApi.ts && echo "D_OK seat-id mapping precedent"
```

## Context (Read First)

- **Why this surfaced.** An operator tried to play with a friend by entering the friend's username in the invite flow and got an error; the friend had just created an account. Root cause (traced 2026-08-04): the by-`@handle` invite resolves against `legendary.players.handle_canonical`, which is **NULL for every account** because the handle-claim feature was never wired — `claimHandle` (`apps/server/src/identity/handle.logic.ts`) has **zero non-test call sites** and no HTTP endpoint or profile-UI field surfaces it. The workaround that *did* work was the copy-join-link (identity-agnostic). This WP productizes that workaround as a first-class manual-join, so a match is reachable by ID/link regardless of the (broken) handle system. The handle fix itself is a separate follow-up WP (Track 2).
- **Mirror the copy-link, don't reinvent join.** `WaitingForPlayersPanel.onCopyLink` builds `${origin}/?route=lobby&match=<id>`; `LobbyView` reads `?match=<id>` (`highlightMatchId`, line 108) to order/highlight the row. This WP parses the *same* `match` param (and a bare ID) and then calls the *same* `joinExisting` → `joinMatch` the row's Join button uses. The trust model is therefore unchanged: a match is joinable by anyone holding its ID, exactly as it already is by anyone holding the shareable link (D-24302 §4).
- **Single-match fetch is what makes unlisted matches reachable.** The list endpoint (`GET /games/legendary-arena?isGameover=false`) omits unlisted matches. boardgame.io also exposes a per-match read `GET /games/legendary-arena/:id` (public, like the list). `fetchMatch` uses it so a pasted ID resolves even when the match is not in the public list.
- **Standard two-session lane (not lightweight, D-24028):** proper coverage of the new UI touches `LobbyView.test.ts` (a 6th code/test file), and the surface is multiplayer-join-adjacent — both push past the lightweight eligibility gate, so this runs the standard draft→execute split. Zero determinism/persistence surface even so.

## Scope (In)

- **New `apps/arena-client/src/lobby/matchReference.ts`** — a pure parser `parseMatchReference(raw): string | null` that extracts a match ID from either a raw ID or an invite-link URL (reads the `match` query param), trimming whitespace and returning `null` for empty/malformed input. No I/O, no boardgame.io import.
- **New `apps/arena-client/src/lobby/matchReference.test.ts`** — unit tests for the parser (raw ID, full URL, query-only, whitespace, missing `match` param, empty, malformed).
- **Modify `apps/arena-client/src/lobby/lobbyApi.ts`** — add `fetchMatch(matchID): Promise<LobbyMatchSummary | null>`, a read-only `GET /games/legendary-arena/:id` that maps the single-match response to `LobbyMatchSummary` (returns `null` on 404, throws a full-sentence error on other non-2xx). Reuses the existing seat-id-stringify + gameover-normalize mapping.
- **Modify `apps/arena-client/src/lobby/lobbyApi.test.ts`** — tests for `fetchMatch` (200 map, 404→null, 500→throw).
- **Modify `apps/arena-client/src/lobby/LobbyView.vue`** — a "Join by match ID or link" input (`joinReference` ref) + a `joinByReference()` handler that parses → fetches → picks the first open seat → delegates to the existing `joinExisting(matchID, seatId)`; inline error copy for empty/malformed/not-found/no-open-seat/finished. Only additive bindings; the existing create/join/highlight flows are untouched.
- **Modify `apps/arena-client/src/lobby/LobbyView.test.ts`** — component cases for the new input's error paths (empty input; unknown match → not-found; no open seat) — the paths that do not trigger navigation.

## Out of Scope

- **The server / any endpoint.** `POST /api/match/join` and the boardgame.io per-match GET already exist; no route, no new endpoint, no new credential path, no `apps/server` change.
- **The handle-claim fix** (Track 2 follow-up WP) — inviting by `@handle`, auto-assigning handles, the profile handle field. Not touched here.
- **The friends-only match-invite guard, the friends list, the waiting-room invite panel** — unchanged.
- **Spectating / joining a finished match / seat selection UI** — the handler joins the *first* open seat; no seat-picker. A gameover or full match yields an inline error, not a join.
- **A new Decision beyond D-24302; any engine/registry/data/persistence/RNG surface.**

## Files Expected to Change

- `apps/arena-client/src/lobby/matchReference.ts` — **new** (pure parser)
- `apps/arena-client/src/lobby/matchReference.test.ts` — **new** (parser units)
- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** (`fetchMatch`)
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** (`fetchMatch` units)
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** (input + `joinByReference` handler + bindings)
- `apps/arena-client/src/lobby/LobbyView.test.ts` — **modified** (a happy-path case asserting the join POST at the first open seat + error-path cases)
- `docs/ai/STATUS.md` / `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` / `docs/ai/NUMBER-LEDGER.md` / `docs/ai/DECISIONS.md` — **modified** (governance close)

5 code/test files + 1 view + governance. Two-session lane.

## Contract

The lobby exposes a **Join by match ID or link** input. Given a raw boardgame.io match ID **or** a full invite-link URL, the client extracts the match ID (`parseMatchReference`), fetches that single match read-only (`fetchMatch` → `GET /games/legendary-arena/:id`), and joins the **first open seat** via the existing `joinMatch` (`POST /api/match/join`). Empty/malformed input, an unknown match, no open seat, or a finished match each produce inline error copy and no join. No server endpoint is added or changed; the join credential/navigation path is byte-identical to the existing row-Join. Trust model unchanged from the WP-369 copy-link (D-24302).

## Acceptance Criteria

1. `parseMatchReference` returns the match ID for: a bare ID (`"KdHnMXaOPin"`), a full link (`"https://app/?route=lobby&match=KdHnMXaOPin"`), and a query-only string (`"?route=lobby&match=KdHnMXaOPin"`); returns `null` for empty/whitespace, a URL with no `match` param, and obvious garbage.
2. `fetchMatch` maps a 200 single-match response to `LobbyMatchSummary` (seat ids stringified, `gameover` normalized), returns `null` on 404, and throws a full-sentence error on other non-2xx.
3. In the lobby, pasting a valid ID/link with an open seat and clicking Join calls `joinMatch` for that match at the **first open seat** — asserted in a jsdom component test on the recorded `POST /api/match/join` (matchID + first-open-seat `playerID`), mirroring the WP-376 join test. The subsequent navigation *landing* (`?match=&player=&credentials=`) is browser-verified (jsdom logs "Not implemented: navigation" without throwing).
4. Error paths show inline copy and do not join: empty input, unknown match (404→null), a match with no open seat, a finished match.
5. `pnpm --filter @legendary-arena/arena-client test` + `pnpm -r build` exit 0; arena-client coverage thresholds hold. No file outside the allowlist changes; no `finalStateHash`/`PRE_WP080` re-pin (N/A — no engine surface).

## Verification Steps

```bash
pnpm -r build
pnpm --filter @legendary-arena/arena-client test 2>&1 | tail -6
# Browser (localhost dev server, not CF-gated): open the lobby, paste a match ID
# AND separately a full ?...match=<id> link into "Join by match ID or link", set a
# player name, click Join → lands in the match. Try a bogus ID → inline "no match found".
git diff --name-only | grep -vE '^(apps/arena-client/src/lobby/(matchReference|lobbyApi|LobbyView)\.(ts|test\.ts|vue)|docs/)' ; echo "out-of-scope hits above (expect none)"
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed
- [ ] All 5 Acceptance Criteria pass
- [ ] Join-by-ID happy path confirmed in-browser (paste ID and link → join); error paths show inline copy, no join
- [ ] `pnpm --filter @legendary-arena/arena-client test` + `pnpm -r build` exit 0; coverage thresholds hold
- [ ] Only the six allowlisted files + governance changed; no engine/registry/server/data change; reserves no new decision beyond D-24302
- [ ] `docs/ai/STATUS.md` Done entry; WORK_INDEX `[x]` + EC_INDEX Done; NUMBER-LEDGER `RESERVED`→`LANDED`; D-24302 flipped Active; `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` 0
- [ ] Commit prefix `EC-534:` (code) + `SPEC:` (governance close)
- [ ] D-24026 live-verify: Join-by-ID confirmed on the deployed lobby (operator-pending)

## Gate Verdicts (drafting session)

- **Pre-flight (01.4):** READY TO EXECUTE — dependencies (WP-307/D-24092, WP-369) are on `main`; scope is a closed six-file allowlist; the single-match endpoint and join path pre-exist; ambiguities (parser edge cases, seat selection, error copy) resolved in the Contract + EC Locked Values. *(Verdict recorded at draft; independent-subagent run.)*
- **Copilot (01.7):** PASS — no contract file, no layer crossing, no determinism/persistence/hash surface. Independent-subagent audit confirmed every load-bearing claim against source (the single-match `GET /games/legendary-arena/:id` is real, public, returns the shared `createClientMatchData` shape `listMatches` maps, and does NOT filter unlisted; match IDs are `nanoid(11)` ⊂ `[A-Za-z0-9_-]`). One RISK folded in: the happy-path join POST IS jsdom-testable (WP-376 precedent) — only the navigation landing is browser-only; AC-3 + the EC now assert the join POST in jsdom. *(Verdict recorded at draft.)*
- **Lane:** standard two-session (not lightweight) — `LobbyView.test.ts` is a 6th code/test file and the surface is multiplayer-join-adjacent; both fail the lightweight eligibility gate, so the draft→execute split applies.

## Lint Gate Self-Review

All 21 sections resolved (PASS or explicit N/A):
- **§4 (00.2):** N/A — reads boardgame.io seat/match shapes already mapped by `listMatches`; adds no card-data/match-setup field; `MatchSetupConfig` untouched.
- **§5:** Files Expected to Change is a closed set (6 code/test/view + governance) matching the EC.
- **§10 (env):** N/A — no new env var (`fetchMatch` reuses the existing `serverUrl`). **§11 (auth):** the join reuses the existing authenticated match-gate (`requireAuthTokenOrRedirectToLogin` + Bearer token); the read-only `fetchMatch` is a public GET like `listMatches`. **§12 (tests):** `.test.ts` only; new `matchReference.test.ts` + additions to `lobbyApi.test.ts` / `LobbyView.test.ts`.
- **§17 Vision / §20 Funding / §21 API:** resolved below.
- **§18 / §19:** N/A (the only verification grep runs over `git diff --name-only`; STATUS authored at close against live HEAD).
- All remaining sections PASS.

## Vision Alignment

**Clauses touched:** §22 (determinism — app-layer UI + a read-only fetch; no `G`/RNG/replay/hash); §23(b) (PvP terminology — N/A: this is hero-vs-villain co-op/solo match joining, no player-vs-player interaction term introduced). **Conflict:** `No conflict.` A lobby affordance that reuses the existing join path; no card semantics, gameplay, scoring, or persistence change. **Non-Goal check:** none of NG-1..8 crossed — not monetization, not pay-to-win, not a persuasion/competitive surface; it lowers friction to *start playing*, aligned with the product's growth interest.

## Funding Surface Gate

**N/A — no funding surface touched** (no nav/registry/profile/tournament-funding affordance or copy; a lobby join input only). Authority: WP-097, D-9701, D-9801.

## API Catalog Update

**N/A — no HTTP endpoint and no `apps/server/src/**` library function added or modified** (per lint §21.4). `fetchMatch` is a client-side read of boardgame.io's existing public per-match route; the join reuses the existing `POST /api/match/join`. `docs/ai/REFERENCE/api-endpoints.md` is unaffected.
