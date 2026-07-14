# WP-376 — Solo Bot-Ally Lobby Affordance (Client)

**Status:** Draft 2026-07-14 · **PROPOSED (number pending allocation; highest live WP is 374)** · **Standard lane** (a new lobby flow + an API helper + a create/join sequence; single user-visible surface). Pairs with **EC-405** (authored). Reserves **D-24171** (lands at execution). **Source design:** `docs/ai/DESIGN-SOLO-BOT-ALLY.md` §4c.
**Primary Layer:** Client (`apps/arena-client/src/lobby/`)
**User-Visible Surface:** `arena.legendary-arena.com` lobby — a new "Play with a bot ally" affordance (seat count + bot count + policy) that creates a bot-ally match and drops the player onto the play surface. **D-24026 live-verify APPLIES.**
**Dependencies:** **WP-375** (`POST /api/match/create-with-bot` + driver) — hard dep, must be Done. WP-011/012 (`createMatch`/`joinMatch`, `lobbyApi.ts`) ✅; WP-369 (`WaitingForPlayersPanel` auto-hide on `openSeats === 0`) ✅.
**Blocked-for-production-by:** **WP-377** (ranked-eligibility seat-count guard) — this affordance MUST NOT reach production until WP-377 is Active, or the DESIGN §5b ranked-farm vector is exposed. (Build/merge may precede; production exposure may not.)
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution).

---

## Goal

Add the client entry point for the bot-ally mode: a lobby control that lets a
signed-in player choose a seat count (2–5), a bot count (`1..seats-1`), and a
policy (`competent`/`random`), POST it to `POST /api/match/create-with-bot`
(WP-375), then **join their own seat 0** via the existing authed
`joinMatch(..., authToken)` path and navigate to the play surface. Co-op framing
throughout — the bot is an ally.

---

## User-Visible Impact

The lobby gains a "Play with a bot ally" panel next to the existing create and
"Watch Bot Play" controls. Submitting it lands the player on a co-op match whose
other seat is already filled by a bot — no "Waiting for players", the match
starts once they ready seat 0, and their bot ally takes its turns.

---

## Assumes

- **`createAndJoin` is the authed create→join→navigate idiom.** `LobbyView.vue:290-318` — `createMatch(config, seatCount, authToken)` → `joinMatch(matchID, '0', name, authToken)` → `window.location.search = ?match=&player=0&credentials=<joined.playerCredentials>`. The bot-ally flow reuses steps 2–3 verbatim; only step 1 changes to the bot endpoint. (Verified.)
- **`startAutoplay` is the fetch-to-a-server-endpoint idiom** but navigates as a **spectator** on a **server-returned** credential (`result.credentials['0']`, `:542`). The bot-ally flow must NOT copy that — the human is a real player. (Verified.)
- **`joinMatch(matchId, playerId, name, authToken)` returns `{ playerCredentials }`** and (server-side) writes seat 0's `match_seat_accounts` row. `lobbyApi.ts:178`. This authed join is what keeps WP-377's ranked/attribution correct. (Verified.)
- **Reusable setup helpers exist in `LobbyView.vue`:** `buildConfig()`, `numPlayers`, `parsePositiveInteger`, `persistMatchSetup`, `requireAuthTokenOrRedirectToLogin`, `serverUrl`, `errorMessage`, `isSubmitting`. (Verified.)
- **`WaitingForPlayersPanel` auto-hides when `openSeats === 0`.** `WaitingForPlayersPanel.vue:72-78` — WP-375's join-before-return ordering makes seats full on arrival, so the panel never flashes. (Verified.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `docs/ai/DESIGN-SOLO-BOT-ALLY.md` §4c — the client affordance; §5b — why the seat-0 authed join matters for ranked/attribution.
- `apps/arena-client/src/lobby/LobbyView.vue` — `createAndJoin` (`:290`), `startAutoplay` (`:518`), the "Watch Bot Play" template block (`:524-544` area).
- `apps/arena-client/src/lobby/lobbyApi.ts` — `createMatch` (`:50`), `joinMatch` (`:178`) — the helper shapes to mirror.
- `docs/01-VISION.md §23(b)` — co-op-only copy (bot is an ally; no "vs"/"opponent"/"beat").

---

## Non-Negotiable Constraints

**Always apply:**
- TS + Vue 3 Composition API SFC; `.test.ts`; full-sentence errors; `// why:` on non-obvious choices; scoped CSS.
- Client layer only; no server/engine import.

**Packet-specific:**
- **The human ALWAYS joins seat 0 via `joinMatch(..., authToken)`.** The client MUST NOT navigate on a server-returned seat-0 credential (contrast `startAutoplay:542`) — that would leave seat 0 without a `match_seat_accounts` row and (correctly) mark the player's own match Casual under WP-377, and break attribution.
- **The client MUST NOT ready or start the match and MUST NOT touch bot seats** — bot readiness is server-owned (WP-375); the human readies seat 0 on the play surface.
- **Co-op copy only (§23(b))** — "Play with a bot ally" / "Add a bot to your table"; never "vs" / "opponent" / "beat" in the block or the helper.
- **Auth-gated:** the affordance runs behind `requireAuthTokenOrRedirectToLogin` — a guest is redirected, never an unauthed bot-ally create.
- **Reuse `buildConfig()`** — a bot-ally match still needs a real `MatchSetupConfig`; no second setup-selection path.
- **No `WaitingForPlayersPanel` logic change** — VERIFY it stays hidden for a bot-filled match; if a flash appears, the fix is WP-375's ordering, not a client patch.

**Session protocol:**
- If the endpoint response shape (`{ matchId }`, no seat-0 credential) is unclear, read WP-375 / `api-endpoints.md` — do not assume autoplay's `{ credentials }` shape.

---

## Scope (In)

### A) `createMatchWithBot(config, seatCount, botCount, policy, authToken)` (`lobbyApi.ts`, new)
- Mirror `createMatch` (`:50`): `POST ${serverUrl}/api/match/create-with-bot`, `Content-Type: application/json`, Bearer `authToken`, body `{ numPlayers: seatCount, botCount, policy, setupData: config }`. Returns `{ matchId }`; throws a full-sentence error on non-ok.

### B) `createWithBotAlly()` + inputs (`LobbyView.vue`, modified)
- New refs: `botAllyBotCount` (default `1`, `1..seatCount-1`), `botAllyPolicy` (default `'competent'`).
- Flow (model on `createAndJoin`): `requireAuthTokenOrRedirectToLogin` → `config = buildConfig()`, `seatCount = parsePositiveInteger(numPlayers.value,...)`, validate `seatCount >= 2 && 1 <= botCount <= seatCount-1` → `createMatchWithBot(...)` → `persistMatchSetup(matchId, config)` → `joined = await joinMatch(matchId, '0', name, authToken)` → navigate `?match=&player=0&credentials=<joined.playerCredentials>`. Error + `isSubmitting` handling mirrors `createAndJoin`.
- Template: a "Play with a bot ally" block reusing the `numPlayers` field, adding a bot-count input + policy select, co-op copy.

### C) Tests
- `lobbyApi.test.ts`: `createMatchWithBot` posts the right URL/body/headers, returns `{ matchId }`, throws on non-ok.
- `LobbyView.test.ts`: `createWithBotAlly` POSTs `create-with-bot`; then calls `joinMatch(matchId,'0',...)` and navigates with the **joined** credential (a mock server credential is not used); `botCount` client validation; guest → login redirect; co-op copy present, no "vs".

---

## Out of Scope

- **Server endpoint / driver** — WP-375.
- **Ranked guard** — WP-377.
- **In-match bot-seat badge** beyond the lobby — fold into the play-surface work if not trivial here; not required for this packet's DoD.
- **New bot policies** beyond `competent`/`random`.

---

## Files Expected to Change

- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** (refs + `createWithBotAlly` + template block)
- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** (`createMatchWithBot`)
- `apps/arena-client/src/lobby/LobbyView.test.ts` — **modified** (flow cases)
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** (helper cases)
- Governance: `WORK_INDEX.md` (WP-376) + `DECISIONS.md` (**D-24171**) + `STATUS.md` + `EC_INDEX.md`/EC-405 at execution-prep. (`api-endpoints.md` row is owned by WP-375 — not duplicated.)

---

## Contract

| Key | Value |
|---|---|
| Helper | `createMatchWithBot(config, seatCount, botCount, policy, authToken)` → `{matchId}` (mirror `createMatch`) |
| Human seat | ALWAYS `"0"`, joined via `joinMatch(..., authToken)`; NEVER a server-returned seat-0 credential |
| Inputs | `numPlayers` (reused), `botAllyBotCount` (1..seats-1, default 1), `botAllyPolicy` ('competent'\|'random', default competent) |
| Copy | co-op only (§23(b)); no vs/opponent/beat |
| Auth | `requireAuthTokenOrRedirectToLogin` (guest → login) |
| Panel | no logic change; verified hidden for a bot-filled match |

---

## Acceptance Criteria

1. `createMatchWithBot` POSTs `/api/match/create-with-bot` with `{numPlayers,botCount,policy,setupData}` + Bearer auth and returns `{ matchId }` (**AC-1**).
2. `createWithBotAlly` joins seat 0 via `joinMatch(matchId,'0',name,authToken)` and navigates `?player=0` on the **joined** credential — no server seat-0 credential reuse (**AC-2**).
3. Client validation rejects `botCount >= seatCount` / `botCount < 1` / `seatCount < 2` before any POST; a guest is redirected to login (**AC-3**).
4. The new block's copy is co-op (`rg -i "\bvs\b|opponent|beat" → zero in the block`) (**AC-4**).
5. Live verify (D-24026): a 1-human+1-bot match created from the lobby lands on the play surface with NO "Waiting for players"; after the human readies seat 0 the match starts and the bot takes a turn; screenshot captured (**AC-5**).
6. `pnpm -r build` 0; `pnpm --filter @legendary-arena/arena-client test` green (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/arena-client test
Select-String -Path "apps\arena-client\src\lobby\LobbyView.vue" -Pattern "credentials\['0'\]"  # zero (no server seat-0 credential)
Select-String -Path "apps\arena-client\src\lobby\LobbyView.vue" -Pattern "\bvs\b|opponent|beat the bot"  # zero in the new block
git diff --name-only
```

Then the browser verify per the project verify workflow (create bot-ally match → started board screenshot).

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Human joins seat 0 via authed `joinMatch`; no server seat-0 credential reuse
- [ ] Co-op copy only; auth-gated; `botCount` validated client-side
- [ ] `WaitingForPlayersPanel` verified hidden for a bot-filled match (no flash)
- [ ] `pnpm -r build` 0; arena-client test green; browser verify screenshot captured (D-24026)
- [ ] `DECISIONS.md` **D-24171** landed; `WORK_INDEX` (WP-376) + `STATUS.md` updated
- [ ] EC_INDEX notes EC-405 blocked-for-production by WP-377/EC-406

---

## Vision Alignment

**Vision clauses touched:** §23(b) (co-op framing — bot ally, not opponent). **Conflict assertion:** No conflict — a client entry point to a co-op mode. **Non-Goal check:** NG — no PvP surface. **Determinism:** N/A (client UI; the bot runs server-side).

## Lint Gate Self-Review (00.3)

- §1–§21 PASS or N/A-with-reason. Highlights — §5 standard lane (new flow + helper); §8 client boundary (no server/engine import); §11 N/A (no new endpoint — consumes WP-375's); §15.1 APPLIES (D-24026 lobby→play live check); §17 §23(b) co-op copy addressed, determinism N/A; §21 N/A (endpoint row owned by WP-375).

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight: READY once WP-375 is Done** — hard dep on the endpoint. No other blocker; the client idiom (`createAndJoin`) is the direct template.

**Copilot: PASS.** Failure modes pinned: (a) human's own match shows Casual/unattributed → **join seat 0 via `joinMatch(authToken)`, never a server credential; `rg` guard**; (b) "1 of 2" flash → **WP-375 ordering; panel-hidden verify**; (c) PvP copy → **§23(b), `rg` guard**; (d) guest reaches create → **auth gate**; (e) drifted second setup UI → **reuse `buildConfig()`**.

## Decision (reserved, lands at execution)

Reserves **D-24171**: the bot-ally lobby affordance posts to `POST /api/match/create-with-bot` and then has the human **join seat 0 via the authed `joinMatch(..., authToken)`** (never a server-returned seat-0 credential — the distinction from the autoplay spectator flow), preserving seat 0's `match_seat_accounts` row for WP-377/attribution; co-op copy only (§23(b)); auth-gated; production exposure blocked until WP-377 is Active. Drafted 2026-07-14; not yet landed.
