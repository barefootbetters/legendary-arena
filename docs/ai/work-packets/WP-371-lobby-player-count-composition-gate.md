# WP-371 — Match-Create Player-Count Composition Gate (Server) + Lobby Surface (Arena Client)

**Status:** Draft 2026-07-13 · **BLOCKED on WP-370** (needs the `PLAYER_COUNT_SETUP` table + the registry export path) · **Standard two-session lane** (D-24028 — crosses Server → App; validates a multiplayer match-create path). Pairs with **EC** (authored at execution-prep). Reserves **D-24167** (lands Active at execution).
**Primary Layer:** Server (`apps/server` — the authoritative create-gate) + App (`apps/arena-client` — the lobby surface). The server imports the registry table; the arena-client does **not** (it surfaces the server's structured rejection).
**Dependencies:** **WP-370** ⛔ (the `PLAYER_COUNT_SETUP` table + its registry export); WP-334 / WP-333 / WP-301 (`POST /api/match/create` gate + Hanko session auth); the arena-client lobby (`LobbyView.vue` create + join paths).
**User-Visible Surface:** play.legendary-arena.com — the lobby. Creating a match whose loadout composition does not match the chosen player count is **rejected with a clear message**, before a match is created.

---

## Session Context

`POST /api/match/create` (`apps/server/src/match/matchGate.routes.ts:224`) is a thin auth gate: it reads `{ numPlayers, setupData }` from the request body (:235-236) and forwards them verbatim to the boardgame.io native lobby (:252-253). It performs **no** composition-vs-player-count validation — the engine's `Game.setup()` is the only authority, and (before WP-370) it did not check either. The arena-client lobby (`LobbyView.vue`) sends `numPlayers` and the 9-field composition fully **decoupled**: `submitCreate` (:207) from the manual form's `numPlayers` ref, `submitFromJson` (:390) from the uploaded envelope's `playerCount`. A user can create a 4-player match with 1 villain group; today it either starts an illegal board or (post-WP-370) fails deep in `Game.setup()` with an opaque server error rather than a clean lobby message.

WP-370 installs the authoritative engine block and the registry-owned table. This WP adds the **server-layer** gate (a clean, early rejection with a structured error code the lobby can render) and the **lobby surface** (warn + block submit), so the mismatch is caught and explained at the create boundary rather than surfacing as a generic setup failure.

---

## Goal

After this session, `POST /api/match/create` validates the submitted composition's villain-group / henchman-group / hero counts against `numPlayers` using `PLAYER_COUNT_SETUP` (imported from `@legendary-arena/registry`) **before** delegating to the native lobby, and returns a structured `400` with a typed error code + full-sentence message on mismatch (no match created). The arena-client lobby renders that rejection inline on both create paths (`submitCreate`, `submitFromJson`) and disables the create button while a known mismatch is present — a warn-then-block UX consistent with the engine's authoritative block (D-24165 enforcement model).

---

## User-Visible Impact

Creating a match with a composition that does not fit the player count now shows a clear lobby message ("A 4-player match requires 3 villain groups; this loadout has 1.") and does not create a match, instead of an opaque failure after the match is already spun up. Valid setups are unaffected.

---

## Assumes

- **WP-370 complete:** `@legendary-arena/registry` exports `PLAYER_COUNT_SETUP` + `getPlayerCountSetup` on a browser-safe/server-safe path; the engine already blocks the same mismatch authoritatively at `Game.setup()`.
- **Create gate:** `apps/server/src/match/matchGate.routes.ts:224` `router.post('/api/match/create', …)` reads `{ numPlayers, setupData }` (:235-253) and delegates to the native lobby; it is `authenticated-session-required` (WP-334/301).
- **Lobby:** `apps/arena-client/src/lobby/LobbyView.vue` — `submitCreate` (:207-225, manual `numPlayers` ref → `createMatch(config, seatCount, authToken)`) and `submitFromJson` (:390-…, envelope `playerCount` → `numPlayers`); `apps/arena-client/src/lobby/lobbyApi.ts` `createMatch` wraps the POST and returns/throws on the server response.
- **Server imports registry:** `apps/server` may import `@legendary-arena/registry` (Import Rules); `apps/arena-client` may **not** import `registry` at runtime — it consumes the server's structured error only.
- **Baseline:** captured at execution-prep off `origin/main` (post-WP-370). Server + arena-client suites green.
- `docs/ai/DECISIONS.md` exists; **D-24167** is reserved.

If any of the above is false (esp. WP-370 not merged), this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary` + `.claude/rules/architecture.md §Import Rules` — server may import `registry`; arena-client must not (runtime). The lobby learns the expected counts only from the server response, never a local table.
- `docs/ai/ARCHITECTURE.md §Server Layer` — the server **wires**; it does not "decide gameplay." Confirm this gate is framed as **input validation at the create boundary** (rejecting malformed setup requests), not as re-implementing engine rules — the engine remains the authority; the server gate is a fast, friendly pre-check reading the same registry data (D-24167 records this framing).
- `apps/server/src/match/matchGate.routes.ts` — read the whole create handler (:224-279): body parsing, the existing auth gate, the delegation call. The composition check slots in after auth + body validation and before delegation; on mismatch, return the structured error and do not delegate.
- `apps/server/src/match/matchGate.routes.test.ts` + `.integration.test.ts` — the existing gate tests; mirror their structure for the new rejection cases.
- `apps/arena-client/src/lobby/LobbyView.vue` + `lobbyApi.ts` — the two submit paths + the `createMatch` wrapper; where the server error is caught and surfaced. Read the existing error-render pattern (e.g. the WP-254 `ext_id` guard messaging) and reuse it.
- `docs/ai/REFERENCE/api-endpoints.md` (D-11804) — the `POST /api/match/create` row; its `Auth` / `Status` and the response schema get the new rejection documented (updated in the impl commit).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 11 (full-sentence messages), Rule 4 (naming).

---

## Non-Negotiable Constraints

- **Server is authority-adjacent, not authority.** The engine block (WP-370) is the source of truth; this gate is a friendlier early rejection using the same `PLAYER_COUNT_SETUP` data. It must reject exactly the compositions the engine would reject for the given `numPlayers` — no stricter, no looser (a drift test asserts parity of the length rules).
- **Structured error, closed set.** Mismatch → `400` with a typed error code (e.g. `PLAYER_COUNT_COMPOSITION_MISMATCH`) + a full-sentence message naming the field and the expected/actual counts. The arena-client renders the message; it does not re-derive the numbers.
- **arena-client imports no registry / engine table.** The lobby surface reads the server's error only. Any `@legendary-arena/registry` runtime import in arena-client is a FAIL.
- **No match on rejection.** The gate returns before delegating to the native lobby; a rejected create leaves no match, no bgio state.
- **Auth unchanged.** `authenticated-session-required` + existing session handling untouched; the composition check runs after auth.
- ESM only; `node:` prefix; `.test.ts`; full-file outputs; no `.reduce()` with branching; human-style code.

---

## Scope (In)

### A) Server create-gate (`apps/server/src/match/matchGate.routes.ts` — modified)
- After auth + body validation, before delegation: read the composition arrays + `numPlayers` from `setupData`/body, look up `PLAYER_COUNT_SETUP[numPlayers]`, and check `villainGroupIds` / `henchmanGroupIds` / `heroDeckIds` lengths. On mismatch, respond `400 { errorCode: 'PLAYER_COUNT_COMPOSITION_MISMATCH', message }` and return (no delegation). Absent table row / unparseable numPlayers → fall through to existing behavior (not this gate's error to own). `// why:` cites D-24167.
- A small shared pure helper (server-local or reused from registry) computes the mismatch list so the route stays thin.

### B) Server tests (`apps/server/src/match/matchGate.routes.test.ts` (+ integration) — modified)
- A matching create still delegates + succeeds; a wrong villain-group / henchman / hero count for the player count returns the typed `400` and does **not** create a match; auth-first ordering preserved; parity with the engine length rules (drift assertion).

### C) API catalog (`docs/ai/REFERENCE/api-endpoints.md` — modified, D-11804)
- Replace the `POST /api/match/create` row entirely (whole-row replace per D-11804): document the new `400` rejection + error code in the response schema. `Auth` / `Status` unchanged otherwise.

### D) Lobby surface (`apps/arena-client/src/lobby/LobbyView.vue` (+ `lobbyApi.ts` if the error shape needs typing) — modified)
- Both submit paths: catch the `PLAYER_COUNT_COMPOSITION_MISMATCH` `400`, render the server's full-sentence message inline (existing error-surface pattern), and keep the user in the lobby. Optionally disable the create button when the current form's composition lengths already disagree with the chosen player count (a soft pre-check using the counts the user has entered — a length compare, **not** a re-typed table; the button-disable is UX only, the server remains the gate).

### E) Lobby tests (`apps/arena-client/src/lobby/*.test.ts` — modified)
- A `400` mismatch renders the message + creates no match; a successful create is unchanged; the button-disable pre-check (if added) toggles on length disagreement.

---

## Out of Scope

- **The engine block + the table + villain-deck fix** — WP-370.
- **The registry-viewer loadout builder** — WP-372.
- **Re-implementing engine setup rules on the server** — the gate checks only the three composition lengths against the shared table; it is not a second engine.
- **"What If…?" variant / game modes** — none in the app.
- **Retro-validation of existing matches.**
- Refactors outside Scope (In).

---

## Files Expected to Change

- `apps/server/src/match/matchGate.routes.ts` — **modified** — composition-vs-numPlayers gate
- `apps/server/src/match/matchGate.routes.test.ts` — **modified** — rejection + parity tests
- `apps/server/src/match/matchGate.routes.integration.test.ts` — **modified** (if the integration path needs the case)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — whole-row replace for `POST /api/match/create` (D-11804)
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — surface the rejection + optional button-disable
- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** (if the error shape needs typing)
- `apps/arena-client/src/lobby/*.test.ts` — **modified** — lobby rejection tests
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24167), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` + counts — **modified** — governance close

No other files. Run the server + arena-client suites, `pnpm roadmap:counts:check`, and the api-endpoints companion check before pushing.

---

## Vision Alignment

- **Clauses:** §3 (trust/fairness — clean rejection at the boundary), §23(b) (no PvP framing in copy — the message is about setup legality, not opponents).
- **Conflict:** none — input-validation UX; no NG-1 surface.
- **Non-Goal proximity:** §multiplayer-sync — not triggered (no transport/sync change; a create-time input check).

## Funding Surface Gate

N/A — lobby validation only; no funding affordances/copy/channels.

## API Catalog (00.3 §21)

**Applies.** `POST /api/match/create` behavior changes (adds a `400` rejection path + error code). `docs/ai/REFERENCE/api-endpoints.md` row replaced whole (D-11804) in the impl commit; `Auth` = `authenticated-session-required` and `Status` = `Wired` unchanged.

---

## Acceptance Criteria

- [ ] `POST /api/match/create` returns `400 { errorCode: 'PLAYER_COUNT_COMPOSITION_MISMATCH', message }` and creates no match when a composition length ≠ the table for `numPlayers`; a matching create still succeeds.
- [ ] The server gate rejects exactly what the engine (WP-370) rejects for the same `numPlayers` (parity drift test).
- [ ] The lobby renders the server's message inline on both `submitCreate` and `submitFromJson`; the user stays in the lobby.
- [ ] arena-client has no `@legendary-arena/registry` runtime import (`git grep` empty outside comments).
- [ ] Server + arena-client suites green at baseline + new tests; api-endpoints row updated; no files outside the allowlist changed.

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/server test
pnpm --filter @legendary-arena/arena-client test
pnpm --filter @legendary-arena/arena-client typecheck
git grep "@legendary-arena/registry" apps/arena-client/src   # expect: comments only, no runtime import
pnpm roadmap:counts:check
git diff --name-only origin/main   # only ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification (surface = play.legendary-arena.com lobby):** D-24026 operator-pending on deploy — create a 4-player match with 1 villain group → the lobby shows the mismatch message and no match is created; a matching setup creates normally.
- [ ] All acceptance criteria pass.
- [ ] Server + arena-client builds + suites green; api-endpoints.md row replaced (D-11804).
- [ ] arena-client imports no registry runtime table.
- [ ] No files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24167 → Active; `docs/ai/work-packets/WORK_INDEX.md` WP-371 checked off; mindmap node + `roadmap:counts --write` regenerated in the close commit.

---

## Lint Gate Self-Review & Gate Verdicts

Recorded in the drafting SPEC commit body (current SPEC-draft convention). Summary: 21/21 resolved (PASS — incl. §21 API-catalog obligation flagged for the create-gate row); pre-flight **NOT READY — BLOCKED on WP-370** (hard-dep table + registry export must land first); copilot **PASS** (server-as-authority-adjacent framing confirmed; arena-client boundary held; structured-error closed set). The WORK_INDEX row carries `blocked: WP-370` until WP-370 merges, at which point pre-flight re-runs to READY at execution-prep.
