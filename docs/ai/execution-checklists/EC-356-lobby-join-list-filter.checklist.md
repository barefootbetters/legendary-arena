# EC-356 — Lobby Join List Shows Only Joinable Matches (Execution Checklist)

**Source:** docs/ai/work-packets/WP-326-lobby-join-list-filter.md
**Layer:** arena-client only (pure filter helper + `listMatches` param + `LobbyView` wiring + tests; no engine/server/registry change)
**Lane:** Lightweight (single session) — co-released with WP-327 (server reaper); this half only changes what the client displays.

## Before Starting
- [ ] On the branch, clean, synced; baseline `origin/main` @ `ce022043` recorded.
- [ ] Confirm `LobbyView.vue` renders `matches` via `v-for="match in matches"` with the per-seat Join gated on `isOpenSeat(seat)` (`seat.name === undefined`), and is already `defineComponent`.
- [ ] Confirm `LobbyMatchSummary` = `{ matchID, players: { id, name? }[], setupData, gameover: unknown | null }` and `listMatches()` fetches `{serverUrl}/games/legendary-arena`.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Joinable = `gameover === null` **AND** `players.some((seat) => seat.name === undefined)`.
- List fetch URL: `{serverUrl}/games/legendary-arena?isGameover=false`.
- Empty-state copy (verbatim): `No open matches right now — create one above.`
- Reserved decision: **D-24112**.

## Guardrails
- Display filter only — never mutate, end, or delete a match (lifecycle is WP-327's server half).
- Keep the `matches` ref as the raw server result; filter in a **computed** (`joinableMatches`) so a future spectate view can reach the full list without a re-fetch.
- `filterJoinableMatches` is a **pure** function over a `readonly LobbyMatchSummary[]` — no Vue reactivity, no side effects, unit-testable without a mount.
- No `MatchSetupConfig` / envelope / projection edit; no `finalStateHash` surface (client display only).
- No new npm dependency; no `import * as`; no barrel re-export (00.6).

## Required `// why:` Comments
- The `?isGameover=false` param on `listMatches` (why: server-side drop of finished matches via the boardgame.io lobby route → WP-309 store `where.isGameover`; a server that ignores it degrades to the client filter, still correct).
- `filterJoinableMatches` extracted as a pure helper (why: unit-testable filter without a component mount — WP-321 `isPinnedToBottom` / WP-322 `buildGameLogText` precedent).
- The two-part joinable predicate (why: hide finished games AND matches with no open seat — the two dead-row classes WP-309 durability exposed).

## Files to Produce
- `lobby/lobbyMatchFilter.ts` [pure `filterJoinableMatches`] · `lobbyMatchFilter.test.ts` [empty → empty; open-seat+no-gameover kept; fully-seated dropped; gameover+open-seat dropped; mixed → joinable subset, order preserved].
- `lobby/lobbyApi.ts` [modify: `listMatches()` fetches `?isGameover=false`] · `lobbyApi.test.ts` [modify: assert the URL param; existing normalization tests unchanged].
- `lobby/LobbyView.vue` [modify: `joinableMatches` computed = `filterJoinableMatches(matches.value)`; `join-existing` `v-for` iterates it; empty-state line when length 0; everything else unchanged].
- Governance: `docs/ai/DECISIONS.md` (D-24112), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client run typecheck` clean; `run test` 0 fail (existing lobbyApi normalization tests pass unchanged); `run build` succeeds.
- [ ] `git diff --name-only` = the allowlist (5 client + 4 governance).
- [ ] STATUS / DECISIONS (D-24112 Active) / WORK_INDEX (WP-326 `[x]`) / EC_INDEX (EC-356 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (join list shows only joinable, non-gameover matches; empty list shows the empty-state line).

## Common Failure Smells
- Filtering the `matches` ref in place (mutating the raw list) instead of a computed → loses the full list for a future spectate view.
- Reversing / sorting the list → out of scope; preserve server order.
- Treating `?isGameover=false` as the only mechanism → the client-side `gameover === null` check is the guaranteed one; the param is a bandwidth optimization.
- Any server / engine / projection edit → out of scope (the reaper is WP-327).
- Adding a spectate button for full matches → future WP; here they are simply hidden.
