# WP-628 — "Add Guest" Lobby Button (Arena Client)

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:** WP-627 / D-24437 (`POST /api/match/add-guest` — the server endpoint this calls); WP-369 (`WaitingForPlayersPanel` — the host-side pre-match panel this extends); WP-307 (`POST /api/match/join` — the `addGuest` wrapper mirrors its `lobbyApi` shape); the arena-client `live` route (unguarded; `createLiveClient` connects with `{ matchID, playerID, credentials }` and no Hanko token).
**User-Visible Surface:** `play.legendary-arena.com` — a host-side "Add guest" control in the pre-match waiting panel. D-24026 live-verify applies (the button adds a guest seat and yields a working guest play link).

> This is the **client half** of guest play (Candidate B): WP-627 shipped the server endpoint; this WP wires the lobby button that calls it and turns the returned credential into a playable seat. Client-only — no server, engine, or contract change.

## Session Context

Guest play (account-free walk-up co-op) shipped its server mechanism in WP-627 (`POST /api/match/add-guest`, D-24437), but nothing in the UI calls it. This WP adds the "Add guest" control so a host can actually seat a walk-up player. The playable path already exists: the arena-client `live` route is **unguarded** and `createLiveClient` connects with only `{ matchID, playerID, credentials }` (no Hanko session), so a guest occupies a seat via a `?match&player&credentials` URL — the exact shape every existing join path builds.

## Goal

After this session, a signed-in host in a live match that still has an open seat sees an **"Add guest"** button in the `WaitingForPlayersPanel`. Clicking it calls `POST /api/match/add-guest`, and on success the panel surfaces a **guest play link** (`?match=<id>&player=<seat>&credentials=<cred>`) the host can open in a new tab (same-device hot-seat) or copy to hand to a walk-up player on a second local device. The guest opens that link, the client connects them to the seat with no sign-in, and they play — as a "Player N", Casual-only, exactly as WP-627 established.

## User-Visible Impact (D-24026)

A host can seat a friend with no account in a couple of clicks. Verified post-merge on `play.legendary-arena.com`: the button appears for a signed-in host with an open seat, adds a guest seat, and the produced link connects a guest to that seat.

## Assumes

- `POST /api/match/add-guest` (WP-627, `apps/server/src/match/addGuestRoutes.mjs`) is live and returns `{ matchId, seat, credentials }` on success, with `400/401/403/404/409/500` typed rejections.
- `WaitingForPlayersPanel.vue` (WP-369) exists, reads `matchId` from `?match=`, uses `useMatchSeatStatus(matchId)` for `{ totalSeats, openSeats, isFull }`, holds the host token via `useAuthStore()`, and is visible only for a signed-in player in a live match with an open seat.
- The arena-client `live` route is **not** auth-gated (`routeAuthPolicy.ts`), and `createLiveClient` (`client/bgioClient.ts`) connects with `{ matchID, playerID, credentials }` only — a guest URL `?match&player&credentials` occupies a seat with no Hanko session. Confirmed by every existing join builder (`LobbyView.vue`, `joinMatchFromInvite.ts`).
- `lobbyApi.ts` is the home for the guarded-endpoint fetch wrappers (`joinMatch` is the exact pattern the new `addGuest` mirrors).
- If any assumption is false, this Work Packet is **BLOCKED** and must not proceed.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Layer Boundary (`apps/arena-client` imports; UI consumes read-only projections).
- `docs/ai/DECISIONS.md` — **D-24437** (Candidate B; host hot-seat / hand-off scope), **D-24438** (this WP: the credential-in-URL hot-seat hand-off; remote seat-bind link deferred).
- `wiki/guest-accounts.md` — Candidate B; the deferred remote seat-bind link.
- `apps/arena-client/src/components/WaitingForPlayersPanel.vue` — the panel + its invite/copy-link idiom to mirror.
- `apps/arena-client/src/lobby/lobbyApi.ts` — `joinMatch` (the `addGuest` wrapper's template) + the module `serverUrl`.
- `apps/arena-client/src/lobby/LobbyView.vue` — the `?match&player&credentials` URL builders to mirror.

## Non-Negotiable Constraints

Engine-wide game-determinism constraints (`ctx.random`, no `Math.random()`, moves-never-throw) are **N/A** — this is arena-client UI + one fetch wrapper; it touches no engine, move, `G`, or `ctx`.

**Locked contract values:**

- `addGuest(matchId: string, authToken: string): Promise<{ matchId: string; seat: string; credentials: string }>` in `lobbyApi.ts` — `POST ${serverUrl}/api/match/add-guest`, `Authorization: Bearer <authToken>`, body `{ matchId }`; on a non-2xx throws a full-sentence `Error` with the numeric `status` attached (mirrors `joinMatch` otherwise).
- Error copy (status → message; two buckets): `409` (both the cap and full cases) → "This match is full — there's no open seat for a guest."; **every other non-2xx** → "Couldn't add a guest — please try again." The handler catches, maps, and never re-throws.
- Guest play URL shape: **`?match=<id>&player=<seat>&credentials=<cred>`** (each `encodeURIComponent`'d), the exact shape `App.vue`'s `live` route consumes — no `route=` param, no new connect path.
- The "Add guest" control lives in **`WaitingForPlayersPanel.vue`** and shares that panel's existing visibility gate (signed-in host, live match, open seat) — no new host/creator flag; the server endpoint is the real gate (it rejects a non-participant).
- **Hot-seat / physical hand-off only** (D-24437 / D-24438): open-in-new-tab or copy the guest link. **No remote device-bound seat-bind link** (deferred, new protocol).
- No competitive/leaderboard surface, no new route, no new auth mechanism, no server/engine/contract change.

**Session protocol:** full-file contents for new/modified files; ESM; human-style code per `00.6`; no new npm deps; the SFC keeps the `defineComponent({ setup })` shape (vue-sfc-loader D-6512).

## Scope (In)

- **A. `addGuest` wrapper** in `lobbyApi.ts` — mirrors `joinMatch`: `POST /api/match/add-guest` with the bearer token + `{ matchId }`, returns `{ matchId, seat, credentials }`, throws a full-sentence error on non-2xx.
- **B. The "Add guest" control** in `WaitingForPlayersPanel.vue` — a button in the existing panel (shares its visibility gate). On click: call `addGuest(matchId, authStore.token)`; on success build the guest URL and surface a **hand-off affordance** — the link plus "Open guest seat" (new tab) and "Copy guest link" (clipboard, guarded like the existing copy-link). On failure show a co-op-framed message per the endpoint's rejection (cap reached / match full / generic).
- **C. Tests** — `lobbyApi.test.ts` (the `addGuest` wrapper: URL, bearer header, body, parsed result, error throw) and `WaitingForPlayersPanel.test.ts` (button visible with the panel; click calls `addGuest` and builds the correct `?match&player&credentials` URL; cap/full/error messages).

## Out of Scope

- Any server / engine / contract change (WP-627 already shipped the endpoint).
- The **remote, device-bound seat-bind handoff link** (credential-hiding for a remote guest) — deferred, new protocol.
- A client-side host/creator flag or seat-ownership model beyond the panel's existing visibility gate.
- Any competitive, leaderboard, ranked, or scoring surface.
- Removing or restyling the panel's existing invite-by-handle / copy-join-link affordances.

## Vision Alignment

Triggers §17.1 — player identity/visibility (Vision §3, §11) and multiplayer late-join (Vision §4).

- **§3 / §11 (identity, visibility).** The guest seat has no account and no durable identity; it renders "Player N" and is hard-excluded from competitive submission and the ranked clique (established server-side by WP-627). This WP surfaces a link to occupy that seat — it adds no identity, no account, and no merit surface, so it cannot become a fairness bypass.
- **§4 (multiplayer).** A guest occupying an open seat via the existing `live`-route connect is the same late-join mechanism already used by every join path; this WP changes none of it.
- **NG-proximity.** None — guest play is a free casual convenience; no monetization or funding surface.
- **Determinism.** Unaffected — arena-client UI + one fetch wrapper; no engine randomness, no `G`/`ctx`.

## Files Expected to Change

- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — add the `addGuest` wrapper.
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** — test `addGuest`.
- `apps/arena-client/src/components/WaitingForPlayersPanel.vue` — **modified** — the "Add guest" button + hand-off affordance + error copy.
- `apps/arena-client/src/components/WaitingForPlayersPanel.test.ts` — **modified** — test the button.

Allowlist ≤ 4 files, single app (`apps/arena-client`), strictly additive.

## Acceptance Criteria

1. `addGuest(matchId, authToken)` POSTs to `${serverUrl}/api/match/add-guest` with `Authorization: Bearer <authToken>` and body `{ matchId }`, and returns the parsed `{ matchId, seat, credentials }`.
2. `addGuest` throws a full-sentence `Error` on a non-2xx response (mirrors `joinMatch`).
3. The "Add guest" button renders inside `WaitingForPlayersPanel` under the panel's existing visibility gate (signed-in host, live match, open seat) and not when the panel is hidden.
4. Clicking "Add guest" calls `addGuest(matchId, authStore.token)` and, on success, produces the guest play link `?match=<id>&player=<seat>&credentials=<cred>` (correctly `encodeURIComponent`'d) via an "Open guest seat" (new tab) and/or "Copy guest link" affordance.
5. On an `addGuest` failure the panel shows a co-op-framed message (cap reached / match full / generic) and never throws.
6. `pnpm --filter @legendary-arena/arena-client build`, `test`, and the `vue-tsc` typecheck all pass.
7. No file outside the allowlist is modified; no server/engine/contract change.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client build    # exit 0
pnpm --filter @legendary-arena/arena-client test      # exit 0, add-guest suites green
pnpm --filter @legendary-arena/arena-client typecheck # vue-tsc exit 0

# Confirm the wrapper + button exist
Select-String -Path apps/arena-client/src/lobby/lobbyApi.ts -Pattern "add-guest"
Select-String -Path apps/arena-client/src/components/WaitingForPlayersPanel.vue -Pattern "Add guest"
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — **D-24438 flipped Drafted → Active** (post-execution)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node flipped `📝` → `✅`; `pnpm roadmap:counts:check` exits 0
- [ ] D-24026 live-verify on `play.legendary-arena.com` (button → guest seat → working guest link)
- [ ] No files outside the allowlist were modified

## Lint Gate Self-Review

Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 WP Structure** — PASS. All sections present; `## Out of Scope` names 5 excluded things.
- **§2 Non-Negotiable Constraints** — PASS. Engine constraints N/A with reason; locked values + session protocol; cites `00.6`.
- **§3 Prerequisites** — PASS. Each dep names the exact endpoint/component/route; BLOCKED clause present.
- **§4 Context References** — PASS. Specific files + ARCHITECTURE §Layer Boundary + the two D-entries.
- **§5 Output Completeness** — PASS. 4 files, each `modified` with a one-liner; single app.
- **§6 Naming Consistency** — PASS. `addGuest`, `matchId`, `seat`, `credentials`, `WaitingForPlayersPanel` match the codebase/endpoint.
- **§7 Dependency Discipline** — PASS. No new npm deps.
- **§8 Architectural Boundaries** — PASS. arena-client UI only; consumes the guarded endpoint; no server/engine import, no `pg`, no `G`/`ctx`.
- **§9 Windows Compatibility** — PASS. Verification uses `pwsh` + `Select-String`.
- **§10 Env Var Hygiene** — N/A. No new env vars (`serverUrl` is the existing lobbyApi base).
- **§11 Authentication Clarity** — PASS. The button uses the host's existing Hanko bearer to call the host-gated endpoint; the guest occupies via the unguarded live route (creds-only) — one identity model, stated.
- **§12 Test Quality** — PASS. Arena-client tests; **the app WP gates `vue-tsc` typecheck** (DoD + Verification).
- **§13 Commands & Verification** — PASS. `pnpm` + exact commands + expected output.
- **§14 Acceptance Criteria Quality** — PASS. 7 binary, observable checks.
- **§15 Definition of Done** — PASS; **§15.1** — `**User-Visible Surface:**` declared (`play.legendary-arena.com`) + D-24026 live-verify in the DoD.
- **§16 Code Style** — PASS. Human-style; mirrors the existing `joinMatch` / panel idioms; `// why:` where non-obvious.
- **§17 Vision Alignment** — PASS. Mandatory block present (identity §3/§11 + multiplayer §4); NG-proximity none; determinism unaffected.
- **§18 Prose-vs-Grep** — PASS. The `add-guest` / `Add guest` grep targets are literal route/label strings.
- **§19 Bridge-vs-HEAD Staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. Guest play touches no funding/donate/tournament-funding surface.
- **§21 API Catalog Update** — N/A. This WP **consumes** the existing `POST /api/match/add-guest`; it adds/modifies no `apps/server` endpoint or library function, so `api-endpoints.md` is unchanged.
