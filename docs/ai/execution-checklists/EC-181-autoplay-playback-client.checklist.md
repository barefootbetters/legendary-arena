# EC-181 — Autoplay Playback Controls / Client (Execution Checklist)

**Source:** [WP-164](../work-packets/WP-164-autoplay-playback-client.md)
**Layer:** Client (apps/arena-client)

> **Hard-depends on [EC-180](EC-180-autoplay-playback-server.checklist.md)** complete and merged to `main`.
>
> **Numbering note (2026-05-19):** earlier drafts reserved EC-178 / EC-179
> but those slots were already taken on origin/main and an in-flight branch.
> EC-180 / EC-181 are the first genuinely-free pair.

## Before Starting
- [ ] WP-163 / EC-180 complete and merged to `main`
- [ ] Local server running with autoplay endpoints reachable from the client (same origin or configured base URL)
- [ ] `pnpm -r build` exits 0 on `main`
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 on `main`
- [ ] Confirmed `useUiStateStore().setSnapshot` exists at `apps/arena-client/src/stores/uiState.ts:35` and accepts `UIState | null`
- [ ] Confirmed `PlayDesktop.vue` is the spectator surface used for autoplay view (per WP-164)
- [ ] Identified the existing Socket.IO ingestion site that already calls `setSnapshot(...)` (will remain unchanged; new service is the SECOND legitimate call site)

## Locked Values (do not re-derive)
- Response envelope keys (D-16304): `ok`, `paused`, `historyLength`, `cursor`, `mode`, `uiState?`, `error?`. `mode` is present on every response.
- `mode` values (D-16304): `'live' | 'rewind'`. Client reads `mode` directly from the response — never recomputes from `cursor` / `historyLength`.
- Endpoint Behavior Matrix (D-16304) — endpoints returning `uiState`:
  - `step-back` (always)
  - `restart` (always)
  - `step-forward` (only on cursor move; omitted on real-move branch)
  - All others (`pause`, `resume`, `go-to-end`): NO
- Disabled-when rules (verbatim — applied byte-for-byte, not paraphrased):
  - `step-back` disabled when `cursor === 0` OR `!isPaused`
  - `step-forward` disabled when `!isPaused`
  - `restart` disabled when `!isPaused` OR `historyLength === 0`
  - `go-to-end` disabled when game is over
  - `pause` shown when `!isPaused`; `resume` shown when `isPaused`
- Control bar renders ONLY when URL has `match` query param
- Pinia setter signature: `setSnapshot(next: UIState | null): void` (replace wholesale; existing — DO NOT modify)
- Rewind visual indicator: when `mode === 'rewind'`, the control bar MUST surface a visible "REWIND" affordance (badge, border tint, or equivalent). Spectator must be able to tell at a glance that the view is historical, not live.

## Guardrails
- No `game-engine/setup` import — Boundary Leakage class violation per D-14401
- `uiState.ts` MUST NOT appear in `git diff --name-only` — `setSnapshot` already exists; reuse only
- **Single ingestion path (locked):** the new playback service is the ONLY component / page / new module that calls `setSnapshot(...)`. The existing Socket.IO ingestion site (already in the codebase pre-WP-164) is the OTHER legitimate caller. No additional call sites may be introduced. Verified by grep — see Verification Step 6.
- ANY Socket.IO broadcast after a rewind overwrites injected state unconditionally — no merge, no reconciliation logic anywhere
- No direct `fetch` outside the service module — components and pages call service functions only
- No styling pass beyond minimal functional layout + the rewind indicator — visual polish is a follow-up WP
- No changes outside the Files to Produce list
- Client MUST NOT debounce or coalesce rapid playback requests — the server is last-write-wins under concurrency (D-16309); the client's role is to issue requests and apply responses, not to police rate. If rapid clicks cause user-visible weirdness, that's a server-side question, not a client one.

## Required `// why:` Comments
- `autoplayPlayback.ts` snapshot-injection branch — `// why:` explains why this does not race Socket.IO: live broadcast unconditionally overwrites injected snapshot via the existing transport path (D-16301).
- `autoplayPlayback.ts` mode-field consumption — `// why:` notes that `mode` is read directly from the server response, never recomputed from `cursor` / `historyLength`, to preserve the server's authoritative predicate (D-16304).
- `AutoplayControls.vue` rewind indicator — `// why:` explains the indicator exists so the spectator can distinguish historical view from live broadcast at a glance.
- `PlayDesktop.vue` conditional mount — `// why:` explains the bar renders only when `match` query param is present (prevents normal-play UI pollution).

## Files to Produce (Scope Lock)
- `apps/arena-client/src/services/autoplayPlayback.ts` — **new**
- `apps/arena-client/src/services/autoplayPlayback.test.ts` — **new**
- `apps/arena-client/src/components/AutoplayControls.vue` — **new**
- `apps/arena-client/src/components/AutoplayControls.test.ts` — **new**
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — conditional mount only
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**

**No other files may be modified.** Specifically: `apps/arena-client/src/stores/uiState.ts` is NOT in this list and MUST NOT appear in `git diff`.

## Implementation Checks (Binary)

### A) Service module responsibilities
- [ ] Reads `matchId` from `window.location.search` (`match` query param) or the existing route accessor used by `LobbyView.vue`'s `startAutoplay`
- [ ] Exports exactly six functions: `pause`, `resume`, `stepForward`, `stepBack`, `restart`, `goToEnd` — names match the endpoint paths
- [ ] Each function returns a typed `AutoplayControlResponse` (declared locally — no shared types package)
- [ ] Each function applies `useUiStateStore().setSnapshot(response.uiState)` ONLY when `response.uiState` is present (truthy)
- [ ] Each function exposes `response.mode` to callers so the component can render the rewind indicator
- [ ] Service module is the ONLY non-test, non-Socket.IO-ingestion file that calls `setSnapshot(`

### B) Component responsibilities
- [ ] `AutoplayControls.vue` reads `isPaused` / `historyLength` / `cursor` / `mode` from local reactive state updated from service responses
- [ ] Disabled-when rules applied verbatim — each button's `:disabled` prop matches the locked rule character-for-character
- [ ] Calls ONLY the service functions — no direct `fetch`, no `import { useUiStateStore }` in the component
- [ ] Surfaces a visible rewind affordance whenever `mode === 'rewind'`

### C) Page responsibilities
- [ ] `PlayDesktop.vue` mounts `<AutoplayControls>` ONLY when `match` query param exists
- [ ] No other change to `PlayDesktop.vue` (no refactor, no styling pass)

---

## Verification Steps (Commands)

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — client tests
pnpm --filter @legendary-arena/arena-client test
# Expected: exits 0

# Step 3 — scope enforcement
git diff --name-only
# Expected: only files listed in "Files to Produce"; NOT apps/arena-client/src/stores/uiState.ts

# Step 4 — no game-engine/setup import (D-14401 boundary)
Get-ChildItem -Path "apps\arena-client\src" -Recurse -Include *.ts,*.vue | Select-String -Pattern "game-engine/setup"
# Expected: no output

# Step 5 — uiState.ts unchanged
git diff --name-only | Select-String -Pattern "apps/arena-client/src/stores/uiState\.ts"
# Expected: no output

# Step 6 — single ingestion path: setSnapshot call sites
Get-ChildItem -Path "apps\arena-client\src\components","apps\arena-client\src\pages" -Recurse -Include *.ts,*.vue | Select-String -Pattern "setSnapshot\("
# Expected: no output — components/pages never call setSnapshot directly
Get-ChildItem -Path "apps\arena-client\src\services" -Recurse -Include *.ts | Select-String -Pattern "setSnapshot\("
# Expected: at least one match — autoplayPlayback.ts is the new service call site

# Step 7 — control bar mount is conditional on match param
Select-String -Path "apps\arena-client\src\pages\PlayDesktop.vue" -Pattern "AutoplayControls"
# Expected: at least one match inside a v-if / conditional render block (verify by reading context)

# Step 8 — no direct fetch in components/pages
Get-ChildItem -Path "apps\arena-client\src\components","apps\arena-client\src\pages" -Recurse -Include *.ts,*.vue | Select-String -Pattern "\bfetch\("
# Expected: no NEW matches in WP-164 files (any pre-existing fetch in other files is outside scope; verify by reading the new component / page diff)
```

---

## Manual End-to-End Validation (Autoplay Spectator)

Required after automated steps pass. Server must be running with EC-180 endpoints live.

### Setup
- [ ] Start an autoplay match; land on `PlayDesktop.vue` spectator view with `?match=...` in the URL.
- [ ] Confirm the control bar (⏮ ⏪ ⏸/▶ ⏩ ⏭) is visible.

### Pause / Resume
- [ ] Click **Pause** → `isPaused === true`; Pause button replaced by Resume; bot stops advancing (no new moves arrive).
- [ ] Click **Resume** → `isPaused === false`; Resume replaced by Pause; bot continues advancing; rewind indicator absent.

### Step-back (rewind visual only)
- [ ] Pause. Click **Step-back** once.
- [ ] Response includes `uiState`; UI updates immediately to prior state.
- [ ] Response includes `mode: 'rewind'`; rewind affordance is visible.
- [ ] Step-back disables when `cursor === 0`.
- [ ] Resume (or wait for any live Socket.IO update). UI is overwritten by live state unconditionally — rewind does NOT stick.

### Restart
- [ ] Pause. Click **Restart**.
- [ ] Response includes `uiState` and `mode: 'rewind'` (or `'live'` if only the initial snapshot exists).
- [ ] UI shows earliest snapshot.
- [ ] Restart disables when `historyLength === 0` (unreachable in practice if initial-snapshot rule held; defended anyway).

### Step-forward (both branches)
- [ ] Pause, then step-back twice so `cursor < latest`.
- [ ] Click **Step-forward** while `cursor < latest - 1`.
- [ ] Response includes `uiState`; `mode` still `'rewind'`.
- [ ] Step-forward at `cursor === latest`.
- [ ] Response does NOT include `uiState`; `mode === 'live'`. Exactly one real bot move arrives via Socket.IO, then paused again.

### Go-to-end
- [ ] Click **Go-to-end** → rapid move progression until game ends.
- [ ] Button disables when game is over.

### Rewind-overwrite invariant (critical)
- [ ] Pause. Step-back twice.
- [ ] Without resuming, observe a live Socket.IO update arrive (it will because the controller is paused — actually, it WON'T arrive unless another tick occurs. Adjust this test: pause, step-back, then resume; observe that the next real move's Socket.IO broadcast cleanly replaces the rewound view with no flicker, no merge artifact, no stale data.)

---

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] All Verification Steps pass with expected output
- [ ] All Manual validation items checked
- [ ] No `game-engine/setup` import in any modified or new file
- [ ] `uiState.ts` did NOT change (`git diff --name-only` does not list it)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with today's date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` row marked complete

## Common Failure Smells
- Two places apply `uiState` (beyond the existing Socket.IO ingestion + the new service) → dual-path bug; consolidate to service module
- Buttons stay enabled in non-paused state → disabled-state rules were paraphrased instead of applied verbatim
- Control bar renders in normal-play mode → `match` query-param gate missing
- `uiState.ts` shows up in `git diff` → existing `setSnapshot` was modified instead of reused; revert
- A Socket.IO update lands but the UI keeps showing the rewound state → injection path mutates state in a way that survives the live broadcast; remove the merge logic
- Component or page makes a direct `fetch` call → violates service-only network rule; refactor into service
- `step-forward` always injects `uiState` regardless of response shape → violates Endpoint Behavior Matrix; the `'live-move'` branch must NOT inject
- Component recomputes `mode` from `cursor` / `historyLength` instead of reading the server's `mode` field → D-16304 violation; off-by-one drift on the initial-snapshot edge case
- No rewind indicator when `mode === 'rewind'` → UX-level guardrail violated; spectator cannot tell historical from live
- Client adds debounce / throttle to button handlers → premature optimization; server is authoritative under concurrency (D-16309), let it be last-write-wins
- Response envelope from server is missing `mode` → server-side EC-180 violation; flag back to server execution, do NOT add a client-side fallback predicate
