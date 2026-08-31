# WP-629 — "Add Guest" in the Lobby + Persistent Hand-off Link (Arena Client)

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:** WP-627 / D-24437 (`POST /api/match/add-guest`); WP-628 / D-24438 (the `addGuest` wrapper + the play-surface "Add guest" panel this extends); WP-369 (`WaitingForPlayersPanel`).
**User-Visible Surface:** `play.legendary-arena.com` — an "Add guest" control in the **lobby** match-seat list, and a hand-off link that no longer vanishes. D-24026 live-verify applies.

> Two follow-up fixes to WP-628 surfaced by live use: the "Add guest" button was only on the in-match play surface (a host managing seats from the lobby never saw it), and the play-surface hand-off link auto-hid the instant the guest seat filled — before the host could copy it. Client-only; realizes D-24438, makes no new decision.

## Goal

After this session: (1) a signed-in host sees an **"Add guest"** button in the **lobby** match-seat list on any match with an open seat, and using it shows the guest play link **inline** where they manage seats; and (2) the guest hand-off link (in both the lobby and the play-surface panel) **persists until the host dismisses it** ("Done") rather than disappearing the moment adding the guest fills the seat.

## User-Visible Impact (D-24026)

A host can add a guest from the lobby (where they naturally look) and reliably copy the hand-off link. Verified post-deploy on `play.legendary-arena.com`.

## Assumes

- `addGuest(matchId, authToken)` (`lobbyApi.ts`, WP-628) is live and returns `{ matchId, seat, credentials }` with a numeric `status` attached on non-2xx.
- `WaitingForPlayersPanel.vue` (WP-628) holds the play-surface guest hand-off; its `isVisible` currently requires an open seat, which is what makes the link vanish once the seat fills.
- `LobbyView.vue` renders the match-seat list with a per-open-seat "Join"; `useAuthStore()` exposes `token`.
- If any assumption is false, this WP is **BLOCKED**.

## Context (Read First)

- `docs/ai/DECISIONS.md` — D-24438 (the credential-URL hot-seat hand-off this realizes on a second surface), D-24437.
- `apps/arena-client/src/lobby/LobbyView.vue` — the match-seat list + `useAuthStore`.
- `apps/arena-client/src/components/WaitingForPlayersPanel.vue` — the `isVisible` gate + guest section.
- `apps/arena-client/src/lobby/lobbyApi.ts` — `addGuest` + the new shared `buildGuestPlayUrl`.

## Non-Negotiable Constraints

Engine determinism constraints are **N/A** — arena-client UI only; no engine/`G`/`ctx`.

**Locked contract values:**

- Shared `buildGuestPlayUrl(matchId, seat, credentials)` in `lobbyApi.ts` returns `?match=<id>&player=<seat>&credentials=<cred>` (each `encodeURIComponent`'d); used by both the lobby and the panel (removes the duplicated inline build).
- Lobby "Add guest" shows only when **signed in** (`authStore.token !== null`) on a match with an open seat; it **never redirects to login** (unlike "Join") — it is simply hidden when signed out. The server endpoint is the real host/participant gate.
- The guest hand-off (lobby inline + play-surface panel) **persists until "Done"**: the panel's `isVisible` stays true while a guest link is set; the lobby tracks the active match's link/error and clears them on Done.
- Error copy (both surfaces): `409` → "This match is full — there's no open seat for a guest."; every other non-2xx → "Couldn't add a guest — please try again." Never re-throw.
- Hot-seat / physical hand-off only (D-24438); no remote seat-bind link.

**Session protocol:** full-file contents; ESM; human-style code per `00.6`; no new npm deps; the SFCs keep `defineComponent({ setup })` (D-6512).

## Scope (In)

- **A.** `buildGuestPlayUrl` helper in `lobbyApi.ts`; the WP-628 panel refactored to use it.
- **B.** Lobby "Add guest" in `LobbyView.vue`: a per-open-seat-match button (signed-in only) → `addGuest` → an inline, persistent guest-link block (Open guest seat / Copy guest link / Done) scoped to the active match, with the 409/generic error copy.
- **C.** Persistent panel link in `WaitingForPlayersPanel.vue`: `isVisible` also true while a guest link is set; a "Done" dismiss.
- **D.** Tests for both surfaces.

## Out of Scope

- Any server / engine / contract change (the endpoint shipped in WP-627).
- The remote device-bound seat-bind handoff link (deferred, D-24438).
- A guest signpost near the lobby "Join" (a separate future polish).
- Any competitive / ranked / scoring surface.
- Restyling the existing lobby create/join or invite/copy-link affordances.

## Vision Alignment

Touches §17.1 — identity/visibility (§3, §11) + multiplayer late-join (§4). A guest seat has no account and no merit surface (hard-excluded server-side, WP-627); this WP only changes *where* the host reaches the same hand-off and *how long* the link stays visible — no identity, no merit, no determinism, no `G`/`ctx`. NG-proximity: none (free casual convenience).

## Files Expected to Change

- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — `buildGuestPlayUrl`.
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — the lobby "Add guest" + inline persistent link.
- `apps/arena-client/src/lobby/LobbyView.test.ts` — **modified** — lobby tests.
- `apps/arena-client/src/components/WaitingForPlayersPanel.vue` — **modified** — persistent link + Done + use the shared helper.
- `apps/arena-client/src/components/WaitingForPlayersPanel.test.ts` — **modified** — Done-dismiss test.

Allowlist ≤ 5 files, single app, additive.

## Acceptance Criteria

1. `buildGuestPlayUrl` returns the `?match&player&credentials` URL (each encoded); the panel uses it (no duplicated inline build).
2. The lobby "Add guest" button renders for a signed-in host on a match with an open seat, and is **absent when signed out**.
3. Clicking lobby "Add guest" calls `addGuest`, then shows an inline guest link (Open / Copy / Done) scoped to that match; the link **persists** until Done.
4. A `409` shows the match-full copy; other failures show the generic copy; neither throws.
5. The play-surface panel **stays visible while a guest link is set** (does not vanish when the seat fills); "Done" dismisses it.
6. `pnpm --filter @legendary-arena/arena-client build`, `test`, and `typecheck` (`vue-tsc`) all pass.
7. No file outside the allowlist; no server/engine/contract change.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client build      # exit 0
pnpm --filter @legendary-arena/arena-client test        # exit 0, WP-629 suites green
pnpm --filter @legendary-arena/arena-client typecheck   # vue-tsc exit 0
Select-String -Path apps/arena-client/src/lobby/LobbyView.vue -Pattern "lobby-add-guest"
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node flipped `📝` → `✅`; `pnpm roadmap:counts:check` exits 0
- [ ] D-24026 live-verify on `play.legendary-arena.com`
- [ ] No files outside the allowlist

## Lint Gate Self-Review

Per `00.3`: **§1** PASS (all sections; `## Out of Scope` names 5). **§2** PASS (engine N/A w/ reason; locked values; cites `00.6`). **§3** PASS (deps + shapes; BLOCKED clause). **§4** PASS (files + D-entries). **§5** PASS (5 files, each `modified`). **§6** PASS (`addGuest`/`buildGuestPlayUrl`/`WaitingForPlayersPanel` match code). **§7** PASS (no new deps). **§8** PASS (arena-client only; no `G`/`ctx`/server import). **§9** PASS (`pwsh`/`Select-String`). **§10** N/A. **§11** PASS (host bearer for the host-gated endpoint; guest occupies via the unguarded live route — stated). **§12** PASS (arena-client tests; **vue-tsc gated**). **§13** PASS. **§14** PASS (7 binary). **§15/§15.1** PASS (`**User-Visible Surface:**` + D-24026). **§16** PASS (human-style; mirrors WP-628 idioms). **§17** PASS (Vision block present). **§18** PASS. **§19** N/A. **§20** N/A (no funding surface). **§21** N/A (consumes the existing endpoint; no api-catalog change).
