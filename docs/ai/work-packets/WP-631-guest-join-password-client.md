# WP-631 — Guest Password: Host Set-UI + Guest Join-by-Password (Arena Client)

**Status:** Done 2026-08-31
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:** **WP-630** (the three server endpoints this consumes — `set-guest-access`, `join-as-guest`, and the per-match `guest-access` meta read; WP-630 did **not** extend the lobby-list route, so the name + `hasGuestPassword` come from a per-match `GET /guest-access`, not the list); WP-628/WP-629 (the guest-seat client patterns to mirror); D-24441.
**User-Visible Surface:** `play.legendary-arena.com` — host name/password fields + a guest "Join as guest" (pick-from-list → password) flow. D-24026 live-verify applies.

> The client half of the per-match guest password model (D-24441). A host sets a **game name** + **guest password**; a guest opens the lobby, **picks the host's game by name from the list**, types the password, and lands in a Casual seat — no account, no link. This is the "pick-from-list then password" UX the operator chose.

## Goal

After this session: (1) a host can set a **game name** + **guest password** on a match they are **already seated in**, via an **edit control in that match's lobby row** (calling the WP-630 `set-guest-access` endpoint); (2) the **lobby list shows each game's name** (from the WP-630 per-match meta), not just the match id; and (3) each password-enabled game **with an open seat** shows a **"Join as guest"** control that prompts for the password and calls WP-630 `join-as-guest`, dropping the guest into the seat (via the existing unguarded `live`-route connect).

**Scope note (pre-flight):** the host set-UI is **edit-control-only**, not a create-form field. `set-guest-access` returns 403 until the caller is a seat-account participant, and the host only becomes one *after* the seat-0 join — and the create flow (`useCreateMatchFromComposition.ts`, outside this allowlist) navigates away on success. So the host sets the name/password from the lobby row of a game they're seated in, which is also the "pick your game from the list" mental model.

## User-Visible Impact (D-24026)

A grandchild with no account/email can join: open the site → tap Grandpa's named game → type the password → play. Verified post-deploy on `play.legendary-arena.com`.

## Assumes

- WP-630 is live: `POST /api/match/set-guest-access` (host-gated), `POST /api/match/join-as-guest` (public → `{ matchId, seat, credentials }`), `GET /api/match/:id/guest-access` (`{ gameName, hasGuestPassword }`).
- The arena-client `live` route is unguarded and `createLiveClient` connects with `{ matchID, playerID, credentials }` (WP-628 finding), so the `join-as-guest` response seats the guest with no Hanko session.
- `LobbyView.vue` renders the match list; `useAuthStore()` provides the host token; the create flow exists to hang name/password fields on.
- If any assumption is false (esp. WP-630 not merged), this WP is **BLOCKED**.

## Context (Read First)

- `docs/ai/DECISIONS.md` — D-24441.
- `apps/arena-client/src/lobby/LobbyView.vue` — the match list + create flow + the WP-629 guest idioms to mirror.
- `apps/arena-client/src/lobby/lobbyApi.ts` — where the `setGuestAccess` / `joinAsGuest` / `readGuestAccessMeta` wrappers go (mirror `addGuest`/`joinMatch`).

## Non-Negotiable Constraints

Engine determinism constraints **N/A** (arena-client UI + fetch wrappers).

**Locked contract values:**

- `lobbyApi` wrappers: `setGuestAccess(matchId, { gameName, password }, authToken)` (host bearer); `joinAsGuest(matchId, password)` (no auth) → `{ matchId, seat, credentials }`; `readGuestAccessMeta(matchId)` → `{ gameName, hasGuestPassword }`. Full-sentence `Error` (status attached) on non-2xx.
- Guest join builds the same `?match&player&credentials` URL (via the shared `buildGuestPlayUrl`) and navigates via **`window.location.href = url`** — `buildGuestPlayUrl` returns a **full absolute URL** (`${origin}/?...`), so assigning it to `window.location.search` (the idiom `joinExisting` uses for its relative query) would be malformed. The unguarded `live` route, creds-only connect.
- Wrapper request bodies use **`matchId`** (lowercase-d), mirroring `addGuest` — NOT `joinMatch`'s `matchID`. The server reads `matchId`; the wrong casing is a silent 400.
- Guest "Join as guest" shows **only** on matches whose meta says `hasGuestPassword` **AND that still have an open seat** (`players.some(isOpenSeat)`, mirroring the WP-629 "Add guest" gate) — it is NOT the account-holder "Join" (which stays as-is and still requires a login). Gating on the open seat means a `409` from `join-as-guest` no longer means "full" in practice; it maps to a "couldn't join — the game may have just filled or the password was removed" race line.
- The lobby display **name** comes from `readGuestAccessMeta` (the WP-630 `match_guest_access.game_name`), fetched per joinable match. **Not** from the bgio list's `gameName` field — that is the boardgame.io *game-type* name (`'legendary-arena'` on every row), not a per-match display name. The per-match meta fetch is an accepted small fan-out: the family lobby is tiny, the GET is public/cacheable, and a meta failure is swallowed (the row still lists + joins for account holders; only the guest affordance hides).
- Password entry is a simple text input; wrong-password (401) / rate-limited (429) / no-password-or-race (409) / match-ended (404) map to distinct co-op-framed messages; any other non-2xx → a generic line; never throw. The password travels only in the `join-as-guest` POST body — never in a URL/query string, never logged.
- The lobby row's display name falls back to the `matchID` when the meta `gameName` is null/empty.
- Host set-UI: game name + guest password fields in the match row (host seated), submitted to `set-guest-access`; the password field is write-only (never displays a stored password); a 403 maps to "you must be in this game to set its password".

**Session protocol:** full-file contents; human-style per `00.6`; no new deps; SFCs keep `defineComponent({ setup })` (D-6512).

## Scope (In)

- **A.** `lobbyApi` wrappers `setGuestAccess` / `joinAsGuest` / `readGuestAccessMeta`.
- **B. Host set-UI** in `LobbyView.vue` — an **edit control in the lobby row of a match the host is seated in** (game name + write-only password fields) → `setGuestAccess`. (Not a create-form field — see the Scope note under Goal.)
- **C. Lobby list** shows each game's **name** (from `readGuestAccessMeta`) and, per password-enabled game, a **"Join as guest"** → password prompt → `joinAsGuest` → navigate to the seat.
- **D. Tests**: wrappers (right endpoint/method/headers/body; `join-as-guest`/`readGuestAccessMeta` send NO auth; `set-guest-access` sends the bearer); host set fields (password input write-only — never renders a stored value); list shows names; a **named-but-passwordless** match shows its name but **no** "Join as guest"; "Join as guest" hidden on a full match; join-as-guest happy path builds the right `?match&player&credentials` URL and navigates; the **password never appears in the built URL / query**; 401/429/409 copy; never throws.

## Out of Scope

- Any server/contract change (WP-630 owns the endpoints).
- The WP-628 credential link/QR (unchanged; both models coexist).
- Any ranked/competitive surface.
- A guest signpost near the account-holder "Join" (separate future polish).
- Changing how account holders create/join.

## Limitations

- A per-match guest password is a **shared bearer secret**: anyone who has the match's name + password can take a Casual seat. There is **no per-guest identity** (all guests render "Player N") and **no revocation of an already-seated guest** (clearing the password stops *new* joins; it does not evict a seated one). This is acceptable because the seat is Casual-only (server-enforced, WP-630) and the match is ephemeral — a leaked password grants a throwaway seat in one game, nothing durable. Mitigation for abuse is the server's per-IP rate limit (WP-630) plus the host clearing the password.
- The lobby name/`hasGuestPassword` come from a **per-match meta fetch** (small fan-out); a meta failure is swallowed (the row still lists/joins for account holders, the guest affordance just hides).

## Vision Alignment

Triggers §17.1 — identity/visibility (§3, §11) + multiplayer (§4). Surfaces the per-match password join; the guest remains account-less and Casual-only (server-enforced, WP-630). No identity, no merit surface, no determinism/`G`. NG-proximity: none.

## Files Expected to Change

- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — the three wrappers.
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified**.
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — host fields + list names + guest join-by-password.
- `apps/arena-client/src/lobby/LobbyView.test.ts` — **modified**.

Allowlist ≤ 4 files, single app, additive.

## Acceptance Criteria

1. `setGuestAccess` / `joinAsGuest` / `readGuestAccessMeta` hit the right endpoints with the right method/headers/body and parse the result; non-2xx throws (status attached).
2. A host can enter a game name + guest password and submit (→ `set-guest-access`); the password input never shows a stored value.
3. The lobby list shows each game's **name** (from `readGuestAccessMeta`); a **"Join as guest"** control appears only on matches with `hasGuestPassword` **and an open seat**. A named-but-passwordless match shows its name but no guest control.
4. Entering the correct password calls `joinAsGuest` and navigates to `?match&player&credentials` (the guest lands in the seat); the password never appears in the URL/query; wrong (401) / rate-limited (429) / no-password-or-race (409) show co-op copy and never throw.
5. `pnpm --filter @legendary-arena/arena-client build`, `test`, `typecheck` all exit 0.
6. No file outside the allowlist; no server/contract change.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client build      # exit 0
pnpm --filter @legendary-arena/arena-client test        # exit 0
pnpm --filter @legendary-arena/arena-client typecheck   # exit 0
Select-String -Path apps/arena-client/src/lobby/LobbyView.vue -Pattern "join-as-guest|Join as guest"
```

## Definition of Done

- [x] All acceptance criteria pass
- [x] `docs/ai/STATUS.md` updated
- [x] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [x] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `roadmap:counts` exits 0
- [ ] D-24026 live-verify (pick game by name → password → seated) — pending post-deploy
- [x] No files outside the allowlist (4 code files; + the standard govern-close docs)

## Lint Gate Self-Review

Per `00.3`: **§1** PASS (sections; Out-of-Scope 5). **§2** PASS (engine N/A; locked values; `00.6`). **§3** PASS (deps incl. the hard WP-630 dep + BLOCKED clause). **§4** PASS (files + D-24441). **§5** PASS (≤4 files). **§6** PASS (`joinAsGuest`/`setGuestAccess`/`readGuestAccessMeta` match WP-630). **§7** PASS (no deps). **§8** PASS (arena-client only; consumes WP-630; no server/`G`). **§9** PASS. **§10** N/A. **§11** PASS (host set uses the bearer; guest join is passworded-public per WP-630 — stated). **§12** PASS (arena-client tests; **vue-tsc gated**). **§13** PASS. **§14** PASS (6 binary). **§15/§15.1** PASS (surface + D-24026). **§16** PASS. **§17** PASS (Vision block). **§18** PASS. **§19** N/A. **§20** N/A. **§21** N/A (consumes WP-630's endpoints; no api-catalog change of its own).
