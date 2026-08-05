# EC-534 — Join by Match ID or Link (Execution Checklist)

**Source:** docs/ai/work-packets/WP-499-join-by-match-id.md
**Layer:** App (`apps/arena-client` — the lobby view + lobby API client). Standard two-session lane. No engine/registry/server/data touch.

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] `pnpm -r build` first (arena-client imports the game-engine dist)
- [ ] Precondition A: `grep -q "/api/match/join" apps/arena-client/src/lobby/lobbyApi.ts` (reuse the existing join endpoint)
- [ ] Precondition B: `grep -q "get('match')" apps/arena-client/src/lobby/LobbyView.vue` (the `?match=<id>` param we parse)
- [ ] Precondition C: `! grep -qi "joinByReference\|join by match id" apps/arena-client/src/lobby/LobbyView.vue` (no affordance today)
- [ ] Precondition D: `grep -q "String(seat.id)" apps/arena-client/src/lobby/lobbyApi.ts` (seat-id-stringify mapping `fetchMatch` mirrors)
- [ ] Working tree clean except this WP

## Locked Values (do not re-derive)
- Parser name + signature: `parseMatchReference(raw: string): string | null` in `apps/arena-client/src/lobby/matchReference.ts`. Pure — no I/O, no boardgame.io import.
  - Trim first. Empty → `null`. If the input contains `?`, read the `match` param via `URLSearchParams` on the query substring **after the first `?` and before any `#`** (strip a trailing fragment so `…&match=ID#frag` yields `ID`, not `ID#frag`); return it (non-empty) or `null`. Else if it matches `^[A-Za-z0-9_-]+$` (the boardgame.io `nanoid` alphabet), return the trimmed string. Else `null`.
- Fetch helper: `fetchMatch(matchID: string): Promise<LobbyMatchSummary | null>` in `lobbyApi.ts` — `GET ${serverUrl}/games/legendary-arena/${encodeURIComponent(matchID)}`. **404 → `null`** (unknown match, not an error). Other non-2xx → `throw new Error(<full sentence naming the id, endpoint, status>)`. 200 → map the single-match object to `LobbyMatchSummary` (set `matchID` from the arg; `players[].id` via `String(...)`; `gameover ?? null`; `setupData ?? null`) — reuse the exact mapping shape `listMatches` uses.
- Handler: `joinByReference()` in `LobbyView.vue`. Order: `isSubmitting` guard → `parseMatchReference` (null → inline "Enter a match ID or invite link.") → `fetchMatch` in try/catch (null → inline "No match found with ID <id>." ; thrown → inline the error) → first open seat via the existing `isOpenSeat` (none → inline "That match has no open seats." ; treat `gameover` as no-join) → delegate to the existing `joinExisting(matchID, openSeatId)` (it owns the playerName guard, auth token, join POST, and navigation — do NOT re-implement any of them).
- New refs/bindings returned from `setup()`: `joinReference` (input model) + `joinByReference` (handler). Additive only.
- Error copy is inline via the existing `errorMessage` ref (no new banner mechanism).

## Guardrails
- Reuse, don't reinvent: the join itself goes through the existing `joinExisting`/`joinMatch` (`POST /api/match/join`) — no new join path, credential handling, or navigation code.
- `fetchMatch` is read-only and public (like `listMatches`) — no Authorization header, no mutation, no new endpoint.
- Pure parser stays pure: `matchReference.ts` imports nothing from boardgame.io/game-engine and does no I/O.
- Do NOT modify the create flow, the highlight/`orderedMatches` logic, the friends/invite panels, or `MatchSetupConfig`.
- Zero determinism surface; no `G`/RNG/replay/hash; no re-pin (N/A — app layer).
- If any of {new contract file, layer crossing, determinism/persistence surface, engine/registry/server/data edit, scope ambiguity} arises → STOP and re-scope (do not absorb the Track-2 handle work).

## Required `// why:` Comments
- On `fetchMatch`'s 404→`null` branch (why: an unknown match ID is a normal not-found the caller renders as inline copy, not an exception — distinct from a transport/5xx error which throws).
- On `joinByReference`'s delegation to `joinExisting` (why: reuse the existing authenticated join path — playerName guard, Bearer token, `POST /api/match/join`, and navigation — so the manual-join is byte-identical to the row Join).

## Files to Produce
- `apps/arena-client/src/lobby/matchReference.ts` — **new** — pure `parseMatchReference`
- `apps/arena-client/src/lobby/matchReference.test.ts` — **new** — parser units (raw id / full URL / query-only / whitespace / missing param / empty / garbage)
- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — `fetchMatch`
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** — `fetchMatch` units (200 map / 404→null / 500→throw)
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — input + `joinByReference` + bindings
- `apps/arena-client/src/lobby/LobbyView.test.ts` — **modified** — a **happy-path** case (sign in per the existing `signIn()` helper; stub `fetch` so `GET /games/legendary-arena/:id` returns a match with one open seat; paste a valid ref; click Join; assert the recorded `POST /api/match/join` carries the correct `matchID` + **first-open-seat** `playerID`, mirroring the WP-376 join test at `LobbyView.test.ts:246`) **plus** error-path cases (empty input / unknown match → not-found / no open seat)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` / `NUMBER-LEDGER.md` / `DECISIONS.md` — **modified** — governance close

## After Completing
- [ ] `matchReference` + `fetchMatch` units green; `LobbyView` error-path cases green
- [ ] jsdom happy-path case asserts the join POST (correct `matchID` + first-open-seat `playerID`); error-path cases green
- [ ] In-browser (localhost): paste a bare ID AND a full `?...match=<id>` link → join **lands** in the match; a bogus ID → inline "no match found" (only the navigation *landing* is browser-verified — the join POST itself is asserted in jsdom per WP-376)
- [ ] `pnpm --filter @legendary-arena/arena-client test` + `pnpm -r build` exit 0; coverage thresholds hold
- [ ] `git diff --name-only | grep -vE '^(apps/arena-client/src/lobby/(matchReference|lobbyApi|LobbyView)\.(ts|test\.ts|vue)|docs/)'` → NO MATCH
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; NUMBER-LEDGER RESERVED→LANDED; D-24302 Active; ROADMAP node `✅` + counts refreshed
- [ ] Commit prefix: `EC-534:` (code) + `SPEC:` (governance); D-24026 live-verify Join-by-ID on the deployed lobby (operator-pending)

## Common Failure Smells
- `fetchMatch` throws on an unknown ID → you didn't special-case 404; a not-found must return `null` so the handler shows inline copy, not a stack trace.
- Skipping the happy-path component test "because jsdom can't navigate" → jsdom logs "Not implemented: navigation" but does NOT throw or hang (see the WP-376 join test at `LobbyView.test.ts:217`). Assert the recorded join POST (matchID + first-open-seat id); do NOT assert the navigation *landing* (that is the one browser-only step).
- A create/highlight test regressed → you touched shared lobby state; `joinByReference` is additive and delegates to the untouched `joinExisting`.
- `parseMatchReference` accepts a URL with no `match` param → must return `null` (malformed link), not the whole string.
