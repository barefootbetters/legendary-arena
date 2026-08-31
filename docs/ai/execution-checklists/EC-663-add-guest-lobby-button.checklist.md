# EC-663 — "Add Guest" Lobby Button (Execution Checklist)

**Source:** docs/ai/work-packets/WP-628-add-guest-lobby-button.md
**Layer:** App (`apps/arena-client`)

## Before Starting

- [ ] Read `apps/arena-client/src/lobby/lobbyApi.ts` `joinMatch` — the `addGuest` wrapper mirrors it exactly (endpoint, bearer header, error throw).
- [ ] Read `apps/arena-client/src/components/WaitingForPlayersPanel.vue` — reuse its visibility gate, `useAuthStore()` token, and the guarded `onCopyLink` clipboard idiom.
- [ ] Read a `?match&player&credentials` builder in `LobbyView.vue` — the guest URL shape is identical.
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (baseline)

## Locked Values (do not re-derive)

- `addGuest(matchId: string, authToken: string): Promise<{ matchId: string; seat: string; credentials: string }>` — `POST ${serverUrl}/api/match/add-guest`, `Authorization: Bearer <authToken>`, body `{ matchId }`; on non-2xx throw a full-sentence `Error` with the numeric `status` attached (`Object.assign(new Error(msg), { status })`) so the panel can map 409 → full vs. generic (mirrors `joinMatch` otherwise).
- Guest URL: **`?match=<id>&player=<seat>&credentials=<cred>`** — each `encodeURIComponent`'d; no `route=` param (the `live` route auto-selects; creds-only connect, no Hanko).
- Control lives in `WaitingForPlayersPanel.vue`, under the panel's existing visibility gate — no new host/creator flag.
- **Hot-seat / physical hand-off only**: open-in-new-tab and/or copy the guest link. **NO** remote seat-bind link.
- Error copy (status → message; two buckets, since the endpoint returns 409 for BOTH cap and full): **`409` → "This match is full — there's no open seat for a guest."**; **every other non-2xx → "Couldn’t add a guest — please try again."** The wrapper throws on non-2xx; the handler maps `error.status`/the thrown error to the bucket and never re-throws. Tests assert the copy for a 409 and for a generic non-2xx.

## Guardrails

- arena-client UI + one fetch wrapper only — no server / engine / contract change; no `G`/`ctx`; no new route; no new npm dep.
- The SFC keeps `defineComponent({ setup() { return {...} } })` (vue-sfc-loader D-6512) so template bindings reach `_ctx`.
- Guard `navigator.clipboard` / `window.open` like the existing `onCopyLink` — a missing API must never throw and break the panel.
- On an `addGuest` failure, surface a co-op-framed message; never let the rejection throw out of the handler.
- Do not touch the panel's existing invite-by-handle / copy-join-link affordances.
- Do not add a competitive / leaderboard / ranked surface.

## Required `// why:` Comments

- On the guest URL build: why it is the same `?match&player&credentials` shape the unguarded `live` route consumes (creds-only connect, no Hanko).
- On the hot-seat-only hand-off (open-tab / copy): why no remote seat-bind link (D-24438 — deferred, new protocol).
- On any guarded `navigator`/`window.open` call: why the guard (absent in some contexts).

## Files to Produce

- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — the `addGuest` wrapper.
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** — wrapper tests (URL, bearer, body, parsed result, error throw).
- `apps/arena-client/src/components/WaitingForPlayersPanel.vue` — **modified** — the "Add guest" button + hand-off affordance + error copy.
- `apps/arena-client/src/components/WaitingForPlayersPanel.test.ts` — **modified** — button visibility, click → `addGuest` + correct URL, cap/full/error copy.

## After Completing

- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (add-guest suites green)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` (`vue-tsc`) exits 0
- [ ] D-24026 live-verify on `play.legendary-arena.com` — button adds a guest seat and yields a working guest link
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24438 flipped Drafted → Active (post-execution)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — row checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` — node `📝` → `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)

- The button never shows → the panel's `isVisible` gate is false (not signed in, no open seat, or no `?match=`); it is not a separate gate.
- The guest link 404s the seat → a `route=` param was added, or a field was double-encoded; the live route wants a bare `?match&player&credentials`.
- Template binding is `undefined` at runtime → a `setup()` return was missed (the D-6512 SFC shape).
