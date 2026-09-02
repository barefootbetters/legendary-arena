# EC-669 — Guest Password: In-Match Set Control (Client) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-634-guest-password-in-match-panel.md
**Layer:** App (`apps/arena-client`)

## Before Starting

- [x] WP-631 shipped `setGuestAccess` + `readGuestAccessMeta` in `lobbyApi.ts` (confirm on `main`).
- [x] Read `WaitingForPlayersPanel.vue` (the "Add guest" idioms to mirror) + its test harness (`routeHandler` per-URL stub).
- [x] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0 (baseline).

## Locked Values (do not re-derive)

- Reuse the **shipped** `setGuestAccess(matchId, {gameName, password}, authToken)` + `readGuestAccessMeta(matchId)` — no new/changed endpoint, no server change.
- Password input **write-only** — always blank on open; leaving it blank on save **omits** `password` (rename never wipes it).
- Name **prefills** from `readGuestAccessMeta` (failure-tolerant → blank).
- Error copy: `403` → "you must be in this game to set its guest password"; else generic. Never throw.
- Guest **join** stays in the lobby (WP-631, unchanged) — this panel is the host **set** surface only.

## Guardrails

- arena-client only — no server/contract change; no `G`/`ctx`.
- SFC keeps `defineComponent({ setup })` (D-6512).
- Guard `navigator`/`window` where used; the "Add guest" / invite / copy-link controls are untouched.

## Required `// why:` Comments

- On the in-match set control existing at all (host lands on the play surface after create, not the lobby — WP-634).
- On the write-only password field (blank on save keeps the existing password — the absent-leaves merge).

## Files to Produce

- `apps/arena-client/src/components/WaitingForPlayersPanel.vue` — **modified** — "Set guest password" button + form.
- `apps/arena-client/src/components/WaitingForPlayersPanel.test.ts` — **modified** — form opens/prefills; Save POSTs with bearer; name-only omits password; 403 copy.

## After Completing

- [x] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0
- [ ] D-24026 live-verify (set a password from the game screen)
- [x] `docs/ai/STATUS.md` updated
- [x] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [x] `docs/05-ROADMAP-MINDMAP.md` node `✅`, then `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)

- The stored password renders in the form → the field must be write-only (always blank on open).
- A rename wipes the password → a blank password field was sent as `''` (clear) instead of omitted.
- The set control appears for a non-participant with no feedback → the server 403 must surface the "must be in this game" line.
