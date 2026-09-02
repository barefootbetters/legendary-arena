# WP-634 — Guest Password: In-Match Set Control (Arena Client)

**Status:** Done 2026-09-01
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:** **WP-631 / D-24441** (the `setGuestAccess` / `readGuestAccessMeta` wrappers + the lobby "Join as guest" this complements); WP-628/WP-629 (the `WaitingForPlayersPanel` "Add guest" pattern to mirror).
**User-Visible Surface:** `play.legendary-arena.com` — a **"Set guest password"** control on the in-match waiting panel. D-24026 live-verify applies.

> A placement follow-up to WP-631 realizing the same decision (D-24441). WP-631 put the host's set-password control only in the **lobby** match-row; but after creating a game the host lands on the **play surface**, so the control was where the host wasn't. This adds the **"Set guest password"** control to `WaitingForPlayersPanel` — next to the existing "Add guest" button — so the host sets a game name + password from the game screen and reads the password out to a walk-up guest. The guest still **joins** from the lobby's "Join as guest" (WP-631); this is the host's **set** surface.

## Goal

After this session a host in a live match sees a **"Set guest password"** button on the waiting panel; clicking it opens a form (game **name** + write-only **password**) that prefills the current name (via `readGuestAccessMeta`) and submits to WP-630 `set-guest-access` — no navigating back to the lobby.

## User-Visible Impact (D-24026)

Grandpa creates a game → on the game screen taps **"Set guest password"** → types a name + password → reads it to a grandchild, who joins from the lobby's "Join as guest". Verified post-deploy on `play.legendary-arena.com`.

## Assumes

- WP-631 shipped `setGuestAccess(matchId, {gameName, password}, authToken)` and `readGuestAccessMeta(matchId)` in `lobbyApi.ts` (both live).
- `WaitingForPlayersPanel.vue` renders on the play surface for a signed-in player in a live match (WP-369/WP-628), reads the match id from `?match=`, and already hosts the "Add guest" control.
- The WP-630 `set-guest-access` participant gate (403 for a non-participant) is the real authority; the panel only calls it.
- If any assumption is false, this WP is **BLOCKED**.

## Non-Negotiable Constraints

Engine determinism constraints **N/A** (arena-client UI + existing fetch wrappers).

**Locked contract values:**

- Reuses the **shipped** `setGuestAccess` / `readGuestAccessMeta` wrappers — **no** new/changed endpoint, no server change.
- The password field is **write-only** — always blank on open; a stored password is never rendered back. Leaving it blank on save **omits** `password` (the server's absent-leaves-unchanged merge — a rename never wipes the password).
- The name prefills from `readGuestAccessMeta` (failure-tolerant → blank on error); the form never blocks the panel.
- Error copy: `403` → "you must be in this game to set its guest password"; else generic; **never throws**.
- The guest **join** is unchanged (lobby "Join as guest", WP-631); this panel adds only the host **set** control.

**Session protocol:** full-file contents; human-style per `00.6`; no new deps; SFC keeps `defineComponent({ setup })` (D-6512).

## Scope (In)

- **A.** `WaitingForPlayersPanel.vue` — a "Set guest password" button + a collapsible form (name + write-only password, Save/Cancel, status), wired to `setGuestAccess` + `readGuestAccessMeta`.
- **B. Tests** — `WaitingForPlayersPanel.test.ts`: form opens + prefills name + blank password; Save POSTs with the bearer; a name-only save omits the password; 403 copy.

## Out of Scope

- Any server / contract / endpoint change (WP-630 owns them).
- The lobby "Set guest password" / "Join as guest" (WP-631, unchanged).
- Any ranked/competitive surface; any engine / `G` / `ctx` change.

## Vision Alignment

Triggers §17.1 — identity/visibility (§3, §11) + multiplayer (§4). Surfaces the existing per-match password set on a second (in-match) surface; the guest remains account-less and Casual-only (server-enforced, WP-630). No identity, no merit surface, no determinism/`G`. NG-proximity: none.

## Files Expected to Change

- `apps/arena-client/src/components/WaitingForPlayersPanel.vue` — **modified** — the set control + form.
- `apps/arena-client/src/components/WaitingForPlayersPanel.test.ts` — **modified** — the tests.

Allowlist ≤ 2 code files, single app, additive.

## Acceptance Criteria

1. A signed-in host in a live match sees a **"Set guest password"** button on the waiting panel; clicking it opens a form.
2. The form **prefills the game name** (from `readGuestAccessMeta`) and the **password field is blank** (write-only, `type="password"`).
3. **Save** POSTs to `set-guest-access` with the host bearer; a **name-only** save (blank password) **omits** the `password` field.
4. A `403` shows "you must be in this game…"; failures never throw.
5. `pnpm --filter @legendary-arena/arena-client build`, `test`, `typecheck` all exit 0.
6. No file outside the allowlist; no server/contract change.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client build      # exit 0
pnpm --filter @legendary-arena/arena-client test        # exit 0
pnpm --filter @legendary-arena/arena-client typecheck   # exit 0
Select-String -Path apps/arena-client/src/components/WaitingForPlayersPanel.vue -Pattern "set-guest-access|Set guest password"
```

## Definition of Done

- [x] All acceptance criteria pass
- [x] `docs/ai/STATUS.md` updated
- [x] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [x] `docs/05-ROADMAP-MINDMAP.md` node `✅`; `roadmap:counts` exits 0
- [ ] D-24026 live-verify (set a password from the game screen) — pending post-deploy
- [x] No files outside the allowlist

## Lint Gate Self-Review

Per `00.3`: **§1** PASS (sections; Out-of-Scope 4). **§2** PASS (engine N/A; locked values; `00.6`). **§3** PASS (deps incl. WP-631 + BLOCKED clause). **§4** PASS (files + D-24441). **§5** PASS (≤2 files). **§6** PASS (`setGuestAccess`/`readGuestAccessMeta`/`set-guest-access` match WP-630/631). **§7** PASS (no deps). **§8** PASS (arena-client only; consumes WP-631; no server/`G`). **§9** PASS (`pwsh`). **§10** N/A. **§11** PASS (host set uses the bearer; the participant gate is server-side — stated). **§12** PASS (arena-client tests; vue-tsc gated). **§13** PASS. **§14** PASS (6 binary). **§15/§15.1** PASS (surface + D-24026). **§16** PASS. **§17** PASS (Vision block). **§18** PASS. **§19** N/A. **§20** N/A. **§21** N/A (consumes WP-630's endpoint; no api-catalog change).
