# WP-164 — Autoplay Playback Controls (Client)

**Status:** Draft
**Primary Layer:** Client (apps/arena-client)
**Dependencies:** [WP-163](WP-163-autoplay-playback-server.md) (server endpoints — hard-dep)
**EC:** [EC-181](../execution-checklists/EC-181-autoplay-playback-client.checklist.md)
**Baseline:** `origin/main` at time of execution
**Source invocation:** `session-autoplay-pause.md` (worktree `eloquent-wu-aba150`, 2026-05-19)

---

## Session Context

WP-163 introduces six REST endpoints under `/api/match/:matchId/autoplay/*` with a standardized response envelope and a closed Endpoint Behavior Matrix defining exactly which endpoints return `uiState`. This packet builds the spectator UI on top of those endpoints and wires `uiState` injection through the existing Pinia `useUiStateStore` (verified at `apps/arena-client/src/stores/uiState.ts:35` — `setSnapshot(next: UIState | null)` already exists, no store extension required, no D-entry needed).

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`.

**§17 N/A.** WP-164 is a client-side spectator UX enhancement built on the WP-163 endpoints. None of the §17.1 trigger surfaces are touched: no scoring, no replay system (the rewind uses WP-163's transient REST response, not a `ReplayInput`), no identity, no multiplayer sync, no determinism / RNG (the client is a pure consumer of server-provided `uiState`; no engine-state mutation), no card data, no monetization, no live ops, no accessibility-surface change beyond a media-player control bar, no registry viewer.

**Determinism preservation:** Confirmed. The client never invokes `ctx.random.*`, never mutates `G` / `ctx`, and never reconciles state — Socket.IO broadcasts unconditionally overwrite any injected REST snapshot (D-16301).

---

## Funding Surface Gate (§20)

**§20 N/A.** WP-164 adds six playback buttons (⏮ ⏪ ⏸/▶ ⏩ ⏭) to the spectator view on `PlayDesktop.vue`. No user-visible copy references funding, donations, supporter tiers, or any monetization concept. None of the §20.1 trigger surfaces are touched.

---

## API Catalog Update Obligation (`00.3 §21` + D-11804)

**§21 N/A.** WP-164 is client-only. No file under `apps/server/src/**` is added, modified, or removed. No HTTP endpoint is added, modified, removed, or status-changed. No `Library-only` row in `docs/ai/REFERENCE/api-endpoints.md` is touched. The client is a pure consumer of the six endpoints WP-163 ships; the catalog entries for those endpoints are owned by WP-163.

---

## Goal

After this packet, `apps/arena-client` renders a media-player-style control bar (⏮ ⏪ ⏸/▶ ⏩ ⏭) on `PlayDesktop.vue` when the URL carries an autoplay `match` query param. The bar issues `POST` requests to the six server endpoints, manages local UI state (`isPaused`, `historyLength`, `cursor`, `mode`) directly from response envelopes, and when a response contains `uiState`, injects it into `useUiStateStore` via the existing `setSnapshot` action. When `mode === 'rewind'`, the bar surfaces a visible rewind affordance so the spectator can distinguish historical view from live broadcast. Any subsequent live broadcast from Socket.IO overwrites the injected state unconditionally — there is no client-side reconciliation logic.

---

## Assumes

- WP-163 complete (six endpoints live, response envelope locked).
- `apps/arena-client/src/pages/PlayDesktop.vue` exists with `TurnActionBar` mounted.
- `useUiStateStore` exposes `setSnapshot(next: UIState | null)` — **VERIFIED** at `apps/arena-client/src/stores/uiState.ts:35`.
- `apps/arena-client/src/lobby/LobbyView.vue` sets `?match=...&credentials=...` as documented in the invocation file.
- `pnpm -r build` and `pnpm -r test` exit 0 against `main`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — client may not import `game-engine/setup` (D-14401).
- `.claude/rules/architecture.md` — `apps/arena-client` may import the Runtime-Safe Engine Surface only.
- `.claude/rules/code-style.md` — full-sentence errors, full English words, JSDoc.
- WP-163 — the response envelope, Endpoint Behavior Matrix, and `uiState` delivery rule are authoritative here.
- `apps/arena-client/src/pages/PlayDesktop.vue` — mount point for the new control bar.
- `apps/arena-client/src/lobby/LobbyView.vue §startAutoplay` — how the spectator URL is constructed.
- `apps/arena-client/src/stores/uiState.ts` — the Pinia store that receives projected `UIState` (`setSnapshot` already exists).

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- ESM only, Node v22+
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `00.6-code-style.md`
- No `Math.random()`; no direct DOM mutation outside Vue lifecycle

**Packet-specific:**
- Client MUST track `isPaused`, `historyLength`, `cursor`, `mode` locally — all four come from every endpoint response (D-16304). `mode` is read DIRECTLY from the response, NEVER recomputed from `cursor` / `historyLength` (D-16304 rejected-alternative: client-computed `mode` opens an off-by-one drift surface on the initial-snapshot edge case).
- Client MUST apply `uiState` immediately when present in a REST response (`step-back`, `restart`, conditional `step-forward`); otherwise it waits for the next Socket.IO broadcast (D-16303).
- ANY Socket.IO broadcast that arrives after a rewind MUST overwrite the injected state unconditionally — no client-side reconciliation, no merge logic (D-16301).
- UI state machine — disabled-when rules locked verbatim:
  - `step-back` disabled when `cursor === 0` OR `!isPaused`.
  - `step-forward` disabled when `!isPaused`.
  - `restart` disabled when `!isPaused` OR `historyLength === 0`.
  - `go-to-end` disabled when game is over (use existing match-end signal).
  - `pause` shown when `!isPaused`; `resume` shown when `isPaused`.
- **Rewind affordance:** when `mode === 'rewind'`, the control bar MUST surface a visible indicator (badge, border tint, or equivalent). When `mode === 'live'`, the indicator is absent. The affordance lives on the control bar component, NOT on the Pinia store.
- Control bar MUST only render when the URL has a `match` query param AND the client is connected as a spectator. No render in normal-play mode.
- DO NOT extend `useUiStateStore` — `setSnapshot` already exists at `uiState.ts:35`. Reuse it. Component-local state (`isPaused`, `historyLength`, `cursor`, `mode`) does NOT live in the store.
- No dual-path logic on the client. There is exactly ONE NEW place where `uiState` is applied: the response handler in the playback service. The existing Socket.IO ingestion site (pre-WP-164) continues to inject through the same `setSnapshot` setter; this WP does not modify that path.
- **Concurrency (D-16309 awareness):** the server is single-consumer / last-write-wins under concurrent requests. The client MUST NOT debounce, throttle, or queue playback button events on the assumption that ordering matters. Rapid clicks produce server-side last-write-wins behavior, which is acceptable. Client-side rate limiting would mask the contract.

**Session protocol:**
- If `setSnapshot` semantics differ from what this WP assumes (replace-wholesale, accepts null), stop and ask before writing service code.

---

## Scope (In)

### A) Playback service (new file)
- `apps/arena-client/src/services/autoplayPlayback.ts` — **new**:
  - `pause(matchId)`, `resume(matchId)`, `stepForward(matchId)`, `stepBack(matchId)`, `restart(matchId)`, `goToEnd(matchId)` — each returns a typed `AutoplayControlResponse`.
  - Redeclares the `AutoplayControlResponse` type locally (no shared types package; matches the augmented envelope locked by WP-163 D-16304 — includes `mode: 'live' | 'rewind'`).
  - When a response contains `uiState`, calls `useUiStateStore().setSnapshot(uiState)`. When absent, does NOT call the setter.
  - Returns the full envelope to the caller so the component can read `paused` / `historyLength` / `cursor` / `mode` and update its local state.
  - `// why:` on the snapshot-injection branch explaining why this never races with Socket.IO (live broadcast always wins via the existing transport path; see D-16301).
  - `// why:` on the `mode` field consumption — the server's `mode` is authoritative; the client never recomputes (D-16304).

### B) Control bar component (new file)
- `apps/arena-client/src/components/AutoplayControls.vue` — **new**:
  - Reads `isPaused`, `historyLength`, `cursor`, `mode` from local component state (updated on every response).
  - Five buttons + one toggle, glyphs `⏮ ⏪ ⏸/▶ ⏩ ⏭`.
  - Disabled-state rules verbatim from §Non-Negotiable Constraints.
  - **Rewind affordance:** renders a visible "REWIND" badge / border / equivalent whenever `mode === 'rewind'`; hidden when `mode === 'live'`. Choose the affordance to be unmissable but not garish — a small colored chip near the cursor / step controls is sufficient. `// why:` comment explains the indicator exists so the spectator can distinguish historical view from live broadcast at a glance.
  - Calls `autoplayPlayback` service functions; updates local state from response.

### C) Mount in PlayDesktop (modify)
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified**:
  - Reads `match` query param via existing route mechanism (confirm at preflight).
  - Mounts `<AutoplayControls :matchId="matchId" />` ONLY when `match` query param is present.
  - No other changes.

### D) Tests
- `apps/arena-client/src/services/autoplayPlayback.test.ts` — **new**:
  - Each service function POSTs to the correct path and returns the parsed envelope.
  - When response contains `uiState`, `useUiStateStore().setSnapshot` is invoked exactly once with the payload.
  - When response omits `uiState`, the setter is NOT invoked.
  - The returned envelope includes `mode` and the service does NOT recompute it from `cursor` / `historyLength`.
- `apps/arena-client/src/components/AutoplayControls.test.ts` — **new**:
  - Disabled-state matrix matches the locked rules verbatim.
  - Clicking a button calls the corresponding service function.
  - Rewind affordance is rendered iff `mode === 'rewind'`; hidden iff `mode === 'live'` (drift test against the D-16304 closed set).
  - No `setSnapshot` import in the component (the service owns injection).

---

## Out of Scope

- Server-side changes — WP-163 owns those.
- Modifying `useUiStateStore` — `setSnapshot` already exists; reuse it.
- Timeline scrubber, persisted replay, seed-correct rewind — see invocation §Future Considerations.
- Refactoring `LobbyView.vue` autoplay startup — the URL shape is already in place.
- Refactoring `PlayDesktop.vue` beyond mounting the new component.
- Theming the control bar — minimal styling only; visual polish is a follow-up.

---

## Files Expected to Change

- `apps/arena-client/src/services/autoplayPlayback.ts` — **new** — REST service + store injection.
- `apps/arena-client/src/services/autoplayPlayback.test.ts` — **new** — service tests.
- `apps/arena-client/src/components/AutoplayControls.vue` — **new** — control bar.
- `apps/arena-client/src/components/AutoplayControls.test.ts` — **new** — component tests.
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — mount the control bar conditionally.
- `docs/ai/STATUS.md` — **modified** — note spectator playback controls are live.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — add WP-164 row.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — add EC-181 row.

No other files may be modified. **Note:** `uiState.ts` is NOT in this list — it already has the required setter and must not be touched.

---

## Acceptance Criteria

### Service
- [ ] `autoplayPlayback.ts` exports six functions matching the six endpoint names.
- [ ] Each function returns `AutoplayControlResponse` typed (includes `mode: 'live' | 'rewind'`).
- [ ] `uiState` injection happens iff the response contains a non-null `uiState`.
- [ ] Service does NOT recompute `mode` from `cursor` / `historyLength` — it passes the server's value through.
- [ ] No direct `fetch` outside the service — components and pages call service functions.

### Component
- [ ] Disabled-state rules match the locked rules verbatim.
- [ ] Control bar only mounts when `match` query param is present.
- [ ] Pause / Resume toggle reflects the latest `paused` value from responses.
- [ ] Rewind affordance is visible iff `mode === 'rewind'`; hidden iff `mode === 'live'`.
- [ ] Component does NOT import `useUiStateStore` directly — the service owns injection.

### Store reuse
- [ ] `uiState.ts` is unchanged (`git diff --name-only` does not list it).
- [ ] The service calls `useUiStateStore().setSnapshot(uiState)` exactly as defined at `uiState.ts:35`.
- [ ] No new `setSnapshot` call sites appear in components or pages (verified by grep — see EC-181 Verification Step 6).

### Tests
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] Service test asserts the setter is invoked iff `uiState` is present.
- [ ] Service test asserts `mode` passes through unchanged.
- [ ] Component test asserts every disabled-state rule.
- [ ] Component test asserts the rewind affordance toggles with `mode`.

### Scope enforcement
- [ ] `git diff --name-only` matches §Files Expected to Change exactly.

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — client tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all passing

# Step 3 — no game-engine/setup import anywhere in new code (D-14401)
Get-ChildItem -Path "apps\arena-client\src" -Recurse -Include *.ts,*.vue | Select-String -Pattern "game-engine/setup"
# Expected: no output

# Step 4 — uiState.ts is unchanged
git diff --name-only apps/arena-client/src/stores/uiState.ts
# Expected: empty (file must not appear)

# Step 5 — single ingestion path: setSnapshot calls limited to services + tests + pre-existing Socket.IO site
Get-ChildItem -Path "apps\arena-client\src\components","apps\arena-client\src\pages" -Recurse -Include *.ts,*.vue | Select-String -Pattern "setSnapshot\("
# Expected: no output (components and pages must never call setSnapshot directly)

# Step 6 — control bar mount is conditional on match param
Select-String -Path "apps\arena-client\src\pages\PlayDesktop.vue" -Pattern "AutoplayControls"
# Expected: 1+ matches inside a v-if / conditional render

# Step 7 — no direct fetch in components/pages
Get-ChildItem -Path "apps\arena-client\src\components","apps\arena-client\src\pages" -Recurse -Include *.ts,*.vue | Select-String -Pattern "\bfetch\("
# Expected: no NEW matches in WP-164-added files (verify by reading diff context if any pre-existing matches appear)

# Step 8 — scope enforcement
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] Spectator can click Pause / Resume / Step Forward / Step Back / Restart / Go-to-End and the UI reflects the correct state after each.
- [ ] UI never desyncs from the server (verified by deliberately rewinding then waiting for the next live broadcast — the live state must immediately replace the rewound view).
- [ ] `uiState.ts` is unchanged.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-164 checked off with today's date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-181 marked complete.

---

## Lint Gate Self-Review

> Per `01.0a §Step 5` and `00.3-prompt-lint-checklist.md`. All 21 sections walked.

| § | Title | Verdict | Note |
|---|---|---|---|
| 1 | Work Packet Structure | PASS | All 10 required sections present in order |
| 2 | Non-Negotiable Constraints Block | PASS | Engine-wide + packet-specific + session protocol; full-file-contents rule; 00.6 referenced |
| 3 | Prerequisites (Assumes) | PASS | Hard-dep WP-163 stated; `setSnapshot` verified at `uiState.ts:35` |
| 4 | Context References | PASS | ARCHITECTURE.md §Layer Boundary (D-14401), .claude/rules/architecture.md, .claude/rules/code-style.md, 00.6-code-style.md, WP-163 + uiState.ts + LobbyView.vue cited |
| 5 | Files Expected to Change | PASS | 8 files; `uiState.ts` explicitly EXCLUDED (callout); no ambiguous output language |
| 6 | Naming Consistency | PASS | `matchId` per 00.2; component / service names match WP-160 / WP-161 client conventions |
| 7 | Dependency Discipline | PASS | No new npm deps |
| 8 | Architectural Boundaries | PASS | Client-only; no `game-engine/setup` import (D-14401); no R2 fetch in components; service-only network |
| 9 | Windows Compatibility | PASS | `pwsh` `Get-ChildItem` + `Select-String` patterns |
| 10 | Environment Variable Hygiene | N/A | No new env vars |
| 11 | Authentication Clarity | N/A | Spectator inherits autoplay's `guest` posture |
| 12 | Test Quality | PASS | Vitest / `node:test` per arena-client convention; mode-passthrough + affordance-toggle drift tests; no `boardgame.io/testing` import |
| 13 | Commands and Verification | PASS | `pnpm`-only; PowerShell-correct globs; single-`setSnapshot`-site grep; no-direct-`fetch` grep |
| 14 | Acceptance Criteria Quality | PASS | Binary, specific, grouped by sub-task (Service / Component / Store reuse / Tests / Scope) |
| 15 | Definition of Done | PASS | STATUS / WORK_INDEX / EC_INDEX / `uiState.ts` unchanged-check / scope-boundary all present |
| 16 | Code Style | PASS | `// why:` comments specified; full English names; full-sentence errors; no nested ternaries |
| 17 | Vision Alignment | N/A (justified) | Explicit section; client UX enhancement; no §17.1 trigger surface; determinism preservation confirmed (no `ctx.random.*`, no `G` mutation) |
| 18 | Prose-vs-Grep Discipline | PASS | Grep targets are code files; WP body prose lives outside the grep paths |
| 19 | Bridge-vs-HEAD Staleness | N/A | Not a session-context bridge |
| 20 | Funding Surface Gate | N/A (justified) | Explicit section; six playback buttons with no funding copy |
| 21 | API Catalog Update | N/A (justified) | Explicit section; client-only; no `apps/server/src/**` touch |

**Result:** all 21 sections PASS or explicit N/A with justification.

---

## Pre-Flight Verdict (`01.4`)

> Combined with WP-163 at `docs/ai/invocations/preflight-wp163-wp164-autoplay-playback.md` (scratchpad).

**Verdict: READY TO EXECUTE (after WP-163 lands).**

- Hard-dep: WP-163 server endpoints must be live + Pinia setter verified.
- Repo green at `origin/main = f878b46`.
- Scope locked (8 files; `uiState.ts` excluded by callout).
- No outstanding PS-items.

## Copilot Check Verdict (`01.7`)

> Combined with WP-163 at `docs/ai/invocations/copilot-wp163-wp164-autoplay-playback.md` (scratchpad).

**Verdict: PASS.**

WP iterated through the WP-163 review chain — cascading items applied (`mode` field consumption, rewind affordance, D-16309 single-consumer awareness, audience-filter awareness, scope-enforcement greps, no-direct-`fetch` rule, single-`setSnapshot`-site rule). No outstanding RISK or BLOCK items.

---

## DECISIONS.md stubs

> No new D-entries are required for this WP. `setSnapshot` already exists at
> `apps/arena-client/src/stores/uiState.ts:35` and this WP only consumes it.
> All locked design decisions belong to WP-163 (D-16301..D-16309). Notable
> consumed decisions:
>
> - **D-16304** — response envelope shape (now includes `mode`) and Endpoint
>   Behavior Matrix. WP-164 reads `mode` directly; never recomputes.
> - **D-16301** — Socket.IO broadcast unconditionally overwrites injected
>   rewind state. WP-164 implements no reconciliation.
> - **D-16303** — REST is the only ingestion path for rewind responses; no
>   `transport.pubSub` listener for rewind. WP-164 consumes responses inline.
> - **D-16309** — single-consumer / last-write-wins concurrency. WP-164 does
>   NOT debounce or throttle button events on the assumption that ordering
>   matters; rapid clicks produce server-side last-write-wins behavior.
