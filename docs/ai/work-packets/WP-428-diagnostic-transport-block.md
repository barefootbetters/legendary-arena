# WP-428 — Transport Diagnostics Block in the Play-Surface Diagnostic Export

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`) — single runtime layer; **zero engine / determinism / persistence footprint** (transport status is framework/client state per the WP-116 disconnect policy — it carries no `G` / card / zone data and is never persisted).
**Dependencies:** WP-228 / D-22801 (the diagnostic capture + credential-redacted report builder this extends), WP-311 / D-24096 (the `connection` store — `isConnected` / `lastStateId` / `hasEverConnected`, written every subscribe frame), WP-246 (the `uiStateSnapshot` context-field precedent this mirrors). All landed on `main`.
**User-Visible Surface:** none — internal operator tooling (the report is downloaded by an operator diagnosing a freeze; nothing on `play.legendary-arena.com` changes visually).

> Baseline: `origin/main` at commit `365aff6f` (PR #1017 — ewiki Play Diagnostics page merged). Re-baseline to current `origin/main` at execution.

---

## Goal

After this session, the play-surface diagnostic report carries a **`transport`
block** so a downloaded freeze report names the client's live connection state
instead of leaving the transport layer opaque. The block is five fields:
`isConnected`, `lastStateId`, `hasEverConnected` (read from the existing WP-311
`connection` store), plus a new `lastFrameAtMs` (a client wall-clock stamp the
store records on every subscribe frame) and a derived `timeSinceLastFrameMs`
(the capture clock minus `lastFrameAtMs`). The derived staleness number is the
decisive signal for the most common live freeze class — "the client is waiting
forever for a server frame that never arrives" — which the current report cannot
show at all. Pure client presentation: it reads the `connection` store the live
session already maintains, adds no engine/registry import, writes no `G`, and
touches no `finalStateHash` sentinel. No change to the boardgame.io transport
wrapper (`bgioClient.ts`), no reconnect/resync counters (a deferred follow-up),
no new dependency.

---

## User-Visible Impact

None on the game surface — this is operator-facing diagnostics. The operational
impact: a freeze report from `play.legendary-arena.com` becomes actionable for
the "waiting-forever-for-a-server-frame" class in one read. The live diagnostic
that motivated this WP (`match=660LwoUY-Yq`, captured by the waiting seat) showed
`entries: []` and a healthy-looking snapshot with **no** way to tell whether the
socket was connected, which `_stateID` the client was pinned at, or how long since
the last server frame — precisely the three facts that separate "my browser is
wedged" from "the server advanced past my view." The `transport` block surfaces
all three (plus the derived staleness) directly in the report.

---

## Assumes

- `apps/arena-client/src/stores/connection.ts` (WP-311 / D-24096) is a Pinia
  Options store exposing `isConnected: boolean`, `lastStateId: number | null`,
  `hasEverConnected: boolean`, and the single action
  `setConnected(isConnected: boolean, stateId: number | null): void`, called on
  **every** subscribe frame from `client/bgioClient.ts` (before any `G`
  handling). This is the transport surface the block reads.
- `apps/arena-client/src/diagnostics/diagnostics.ts` (WP-228 / D-22801) exports
  the pure `buildDiagnosticReport(entries, context)` and the `DiagnosticContext`
  / `DiagnosticReport` interfaces. The report already carries opaque
  caller-assembled payloads (`uiStateSnapshot`, `matchSetup`) that the builder
  passes through unmodified — the exact pattern the `transport` field follows,
  except `transport` is a **typed** block (not opaque `unknown`) so the builder
  and tests can read its fields.
- `apps/arena-client/src/components/DiagnosticExportButton.vue` (WP-228) is the
  impure exporter: `collectContext(capturedAtMs)` reads live browser globals +
  the Pinia stores and assembles the `DiagnosticContext`. It already reads
  `useUiStateStore().snapshot`; it will additionally read `useConnectionStore()`.
- `apps/arena-client/src/diagnostics/diagnostics.test.ts` builds every context
  through the single `sampleContext(overrides)` helper — so the new required
  field is backfilled once, in that helper, not scattered across cases.
- The `connection` store is framework/transport state, never game state (WP-116
  disconnect/reconnect policy): it carries no `G`/card/zone data and is never
  persisted. Reading it into a diagnostic report introduces no persistence or
  determinism surface.
- `apps/arena-client` uses Vue 3 + `node:test`; the diagnostics tests run under
  jsdom with an active Pinia (`setActivePinia(createPinia())`).
- `pnpm -r build` exits 0; the arena-client suite + `typecheck` (vue-tsc) pass on
  the baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/arena-client/src/diagnostics/diagnostics.ts` — the module to extend: the
  `DiagnosticContext` + `DiagnosticReport` interfaces, the pure
  `buildDiagnosticReport` (currently passes `uiStateSnapshot` / `matchSetup`
  straight through), and the module's clock-free-builder discipline
  (`captureTimestampMs` is the only clock read, in capture — never the builder).
- `apps/arena-client/src/stores/connection.ts` — the WP-311 store the block reads
  and where `lastFrameAtMs` is added; its `setConnected` action is the single
  write site.
- `apps/arena-client/src/components/DiagnosticExportButton.vue` — `collectContext`
  is where the block is assembled from the store + the capture clock (the one
  place `capturedAtMs` and the store are both in hand).
- `apps/arena-client/src/diagnostics/diagnostics.test.ts` — the `sampleContext`
  helper (single backfill point) + the builder/click-path cases.
- `apps/arena-client/src/stores/connection.test.ts` — the store test to extend
  for `lastFrameAtMs`.
- `apps/arena-client/src/client/bgioClient.ts` — read ONLY to confirm
  `setConnected` is called every frame and that its two-argument call site stays
  source-compatible; it must **not** change.
- `docs/ai/DECISIONS.md` — **D-22801** (the diagnostics boundary), **D-24096**
  (the connection store), and the reserved **D-24249** at the tail of this WP.
- `wiki/play-diagnostics.md` — the ewiki page (merged #1017) whose Edge Cases
  document this exact gap ("No transport / performance data is captured today");
  its `History` gains a WP-428 line at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Provide the **full file contents** for every new or modified file. **No** diffs, **no** snippets, **no** "show only the changed section."
- ESM only; Node v22+; Vue 3 SFCs; test files `*.test.ts` (`node:test`, no `boardgame.io/testing`).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- The diagnostics module stays **boundary-clean** (EC-260 / D-22801): it imports
  NOTHING from `packages/game-engine`, `packages/registry`, `packages/preplan`,
  `apps/server`, `pg`, or `boardgame.io`. The `connection` store is an
  arena-client Pinia store (App layer) — reading it keeps the boundary. If any
  engine/registry/server/`boardgame.io` import appears in `diagnostics.ts`, STOP.
- **Transport state, never game state.** The block reads the WP-311 `connection`
  store only. It does **not** read `G`, does **not** write `G`/`ctx`, does **not**
  add a persistence surface, and does **not** touch any `finalStateHash` sentinel.
- **Do not touch the transport wrapper.** `client/bgioClient.ts` is **not** in
  scope. `setConnected`'s existing two-argument call there must keep compiling
  unchanged — so the new `lastFrameAtMs` is recorded via a **defaulted third
  parameter** on the action (`atMs: number = Date.now()`), never by editing the
  call site.
- **Reconnect / resync / frame counters are OUT.** The block ships the four
  store-backed facts + the one derived staleness number only. Exposing the
  `bgioClient` reconnect/watchdog/resync counters is a deliberate follow-up
  (WP-A2), because it requires instrumenting `bgioClient.ts` (out of scope here).
- **Builder stays pure.** `buildDiagnosticReport` reads no ambient
  `window`/`Date`/global — it passes `context.transport` straight through, exactly
  like `uiStateSnapshot`/`matchSetup`. The one clock subtraction
  (`timeSinceLastFrameMs`) happens in the impure `collectContext` (where
  `capturedAtMs` already exists) via a pure `buildTransportDiagnostics(state,
  capturedAtMs)` helper that takes the clock value as an argument.
- **`Date.now()` `// why:` comment.** The store's defaulted `atMs` parameter reads
  `Date.now()`; it needs a `// why:` noting it is a client-layer diagnostic
  timestamp outside the engine determinism boundary (which governs
  `packages/game-engine` only), mirroring `diagnostics.ts`'s `captureTimestampMs`.
- **Transport block is always present** (never `null`): the `connection` store
  always exists for a mounted play surface, so the block carries live values or
  their null/`false` defaults — matching the "always present" posture of
  `effectProvenance`, not the "null when absent" posture of `matchSetup`.

**Session protocol:** if any contract or field name is unclear, stop and ask.

**Locked contract values (do not re-derive):**
- **Block type:** `TransportDiagnostics = { isConnected: boolean; lastStateId: number | null; hasEverConnected: boolean; lastFrameAtMs: number | null; timeSinceLastFrameMs: number | null }`.
- **Field sources:** `isConnected` / `lastStateId` / `hasEverConnected` ← the WP-311 `connection` store verbatim; `lastFrameAtMs` ← the store's new frame stamp; `timeSinceLastFrameMs` = `capturedAtMs - lastFrameAtMs` (a non-negative integer), or `null` when `lastFrameAtMs` is `null`.
- **New store field:** `lastFrameAtMs: number | null`, initial `null`, set in `setConnected` from a defaulted `atMs: number = Date.now()` third parameter; the existing two-argument call in `bgioClient.ts` is UNCHANGED.
- **Helper:** `buildTransportDiagnostics(state, capturedAtMs)` — pure, clock-free (takes `capturedAtMs`), lives in `diagnostics.ts`, unit-tested.
- **Report/context field:** `transport: TransportDiagnostics` — REQUIRED (never `null`); the builder passes it through unmodified.
- **No change to `bgioClient.ts`; no reconnect/resync counters; no new dependency.**
- **Reserved decision:** **D-24249** (the transport diagnostics block; land Active at execution).

---

## Scope (In)

### A) Transport block type + pure helper + report wiring (`apps/arena-client/src/diagnostics/diagnostics.ts`, **modified**)
- Add the `TransportDiagnostics` interface (the five fields above).
- Add `transport: TransportDiagnostics` to both `DiagnosticContext` and
  `DiagnosticReport` (REQUIRED field), with a doc-comment mirroring the
  `uiStateSnapshot` rationale block.
- Add the pure `buildTransportDiagnostics(state: { isConnected: boolean;
  lastStateId: number | null; hasEverConnected: boolean; lastFrameAtMs: number |
  null }, capturedAtMs: number): TransportDiagnostics` helper — copies the four
  store fields and derives `timeSinceLastFrameMs` (`capturedAtMs - lastFrameAtMs`,
  or `null`). No clock read inside (takes `capturedAtMs`).
- In `buildDiagnosticReport`, add `transport: context.transport` to the returned
  envelope (straight pass-through — no derivation in the builder).

### B) Connection store frame stamp (`apps/arena-client/src/stores/connection.ts`, **modified**)
- Add `lastFrameAtMs: number | null` to the store state (initial `null`).
- Add a defaulted third parameter to `setConnected(isConnected, stateId, atMs:
  number = Date.now())` and assign `this.lastFrameAtMs = atMs`. The `Date.now()`
  default carries the required `// why:` (client-layer diagnostic timestamp,
  outside the engine determinism boundary). Update the store JSDoc.

### C) Export-button wiring (`apps/arena-client/src/components/DiagnosticExportButton.vue`, **modified**)
- In `collectContext(capturedAtMs)`, read `useConnectionStore()` and set
  `transport: buildTransportDiagnostics(store, capturedAtMs)` on the returned
  context (alongside the existing `uiStateSnapshot` / `matchSetup` reads).

### D) Builder + store tests (`diagnostics.test.ts` + `connection.test.ts`, **modified**)
- `diagnostics.test.ts`: add a `transport` default to the `sampleContext` helper
  (single backfill point); add builder cases — the block passes through
  unmodified; `timeSinceLastFrameMs` derives correctly from `lastFrameAtMs` +
  `capturedAtMs`; `timeSinceLastFrameMs` is `null` when `lastFrameAtMs` is `null`;
  the click-path test asserts the exported report carries a `transport` block
  sourced from the store.
- `connection.test.ts`: assert `lastFrameAtMs` starts `null`, is set from an
  explicit `atMs`, and is a number after a default-clock `setConnected` call.

---

## Out of Scope

- **Any change to `client/bgioClient.ts`** — the transport wrapper is untouched;
  the frame stamp rides the already-every-frame `setConnected` call via a
  defaulted parameter, so no call-site edit is needed.
- **Reconnect / resync / frame-count counters** — the `bgioClient` watchdog,
  reconnect-resync, and spectator-staleness counters are real diagnostic signal
  but live as locals in `bgioClient.ts`; exposing them requires instrumenting
  that wrapper and is a separate follow-up (WP-A2).
- **Performance / memory capture** (longtask ring, heap, frame drops) — a
  separate WP (the perf-recorder slice).
- **A client state-transition log** (turn/phase/stage/`_stateID` over time) — a
  separate WP.
- **Buffer durability across refresh** (sessionStorage-backed capture ring) — a
  separate WP.
- **Raw socket.io frame capture / frame-metadata log** — deliberately excluded to
  stay inside the audience-filter/redaction posture.
- **Any server-side correlation** — matching the client `matchId` + `lastStateId`
  against the bgio blob / server logs is a separate `apps/server` WP.
- **Any engine change** — no `G` field, no `UIState` field, no persistence, no
  `finalStateHash` re-pin.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

**Arena-client runtime + tests (App layer):**
- `apps/arena-client/src/diagnostics/diagnostics.ts` — **modified** — `TransportDiagnostics` interface; `transport` on `DiagnosticContext` + `DiagnosticReport`; the pure `buildTransportDiagnostics` helper; pass-through in `buildDiagnosticReport`
- `apps/arena-client/src/stores/connection.ts` — **modified** — `lastFrameAtMs` state field + defaulted `atMs` param on `setConnected` (`Date.now()` with `// why:`)
- `apps/arena-client/src/components/DiagnosticExportButton.vue` — **modified** — `collectContext` reads `useConnectionStore()` and assembles `transport` via the helper
- `apps/arena-client/src/diagnostics/diagnostics.test.ts` — **modified** — `transport` default in `sampleContext`; builder pass-through + `timeSinceLastFrameMs` derivation cases; click-path carries the block
- `apps/arena-client/src/stores/connection.test.ts` — **modified** — `lastFrameAtMs` default/explicit/clock cases

`apps/arena-client/src/client/bgioClient.ts` is **NOT** in scope (its two-argument
`setConnected` call stays source-compatible via the defaulted parameter). No
`packages/**` or `apps/server/**` file may be modified. This WP declares **no**
`01.5` runtime-wiring file — `DiagnosticExportButton.vue` is an already-mounted
component whose collection logic this extends (not a new wiring host).

---

## Contract

- `TransportDiagnostics = { isConnected: boolean; lastStateId: number | null;
  hasEverConnected: boolean; lastFrameAtMs: number | null; timeSinceLastFrameMs:
  number | null }`.
- `buildTransportDiagnostics(state, capturedAtMs): TransportDiagnostics` — pure,
  clock-free; copies the four store fields; derives `timeSinceLastFrameMs =
  capturedAtMs - lastFrameAtMs` (non-negative integer) or `null` when
  `lastFrameAtMs` is `null`.
- `DiagnosticContext.transport` / `DiagnosticReport.transport` — REQUIRED
  (never `null`); the builder passes `context.transport` through unmodified,
  exactly like `uiStateSnapshot` / `matchSetup`.
- `connection` store gains `lastFrameAtMs: number | null` (initial `null`), set in
  `setConnected(isConnected, stateId, atMs = Date.now())`. The two-argument call
  contract used by `bgioClient.ts` is preserved (the parameter is defaulted).

---

## Vision Alignment

N/A on the §17.1 trigger surfaces: no scoring/PAR/leaderboards, no identity, no
card-data/content-semantics change, no RNG. **Multiplayer-sync note:** the block
**reads** transport observability (connection status, `_stateID`, frame staleness)
into an operator report; it does **not** alter sync, reconnect, or resync behavior
— `bgioClient.ts` is untouched, so no sync logic changes. **Monetization note
(NG-1..7):** internal diagnostics, no revenue vector. **Determinism note (§22):**
pure client presentation — reads the framework/transport `connection` store (never
`G`), writes no `G`/`ctx`, adds zero engine/determinism/replay footprint (sims and
replays instantiate no client transport), and touches no `finalStateHash`
sentinel. Transport status is framework state per the WP-116 policy — never
persisted. NG-1..7 preserved.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy is added or proposed
(the WP touches the client diagnostic export and the connection store only).

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the
report is assembled client-side and downloaded locally with zero network egress
(the WP-228 posture is unchanged).

---

## Acceptance Criteria

All items are binary pass/fail.

- [ ] `DiagnosticReport` and `DiagnosticContext` carry a REQUIRED
      `transport: TransportDiagnostics` field with the five locked members.
- [ ] `buildTransportDiagnostics(state, capturedAtMs)` copies the four store
      fields verbatim and derives `timeSinceLastFrameMs = capturedAtMs -
      lastFrameAtMs` (non-negative), or `null` when `lastFrameAtMs` is `null`;
      it reads no clock (the value is passed in).
- [ ] `buildDiagnosticReport` passes `context.transport` through unmodified (the
      builder reads no ambient `window`/`Date`); a round-trip `JSON.parse` of the
      serialized report deep-equals the block.
- [ ] The `connection` store exposes `lastFrameAtMs: number | null` (initial
      `null`), set in `setConnected` from a defaulted `atMs = Date.now()` third
      parameter; the two-argument call in `bgioClient.ts` still compiles unchanged.
- [ ] The click-path (`DiagnosticExportButton`) exported report carries a
      `transport` block whose `isConnected` / `lastStateId` / `hasEverConnected`
      match the live `connection` store at click time.
- [ ] `client/bgioClient.ts` is **not** modified (`git diff --name-only` shows it
      absent); no reconnect/resync counters were added; no new dependency.
- [ ] The layer writes no `G`/`ctx` and adds no engine/determinism footprint
      (App-only runtime diff; no `packages/game-engine/**` file in the diff; no
      `finalStateHash` sentinel touched).
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0;
      `pnpm --filter arena-client test` passes; `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build everything
pnpm -r build
# Expected: exits 0

# Step 2 — arena-client typecheck + tests
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass. The REQUIRED `transport` field on
# DiagnosticContext fails typecheck anywhere a context is built without it — the
# only such site is the sampleContext helper (backfilled in §Scope D).

# Step 3 — the block + helper exist, builder passes it through
Select-String -Path "apps\arena-client\src\diagnostics\diagnostics.ts" -Pattern "TransportDiagnostics|buildTransportDiagnostics|timeSinceLastFrameMs"
# Expected: the interface, the pure helper, and the derived field are present.

# Step 4 — bgioClient untouched, no engine footprint
git diff --name-only
# Expected: only apps/arena-client/src/diagnostics/diagnostics.{ts,test.ts},
# apps/arena-client/src/stores/connection.{ts,test.ts},
# apps/arena-client/src/components/DiagnosticExportButton.vue (+ governance).
# NO client/bgioClient.ts, NO packages/game-engine/** file.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0;
      arena-client suite passes.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated — the diagnostic report now carries a
      `transport` block (connection status + `_stateID` + frame staleness).
- [ ] `docs/ai/DECISIONS.md` updated — land **D-24249** as Active (the transport
      diagnostics block).
- [ ] `wiki/play-diagnostics.md` — the "no transport data captured today" Edge
      Case is updated to reflect the shipped block, and a WP-428 `History` line is
      added (the ewiki page and the code no longer disagree).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-428 checked off with the date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-463 flipped to `Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-428 node glyph `📝 → ✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

> **User-Visible Surface = none (internal tooling).** No D-24026 live-on-surface
> gate applies — nothing on `play.legendary-arena.com` changes visually. The
> execution session verifies the block by downloading a diagnostic report from a
> local/dev play session and confirming the `transport` fields reflect the live
> connection state (the report is the artifact, not a rendered UI change).

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `Out of Scope` lists ≥2 excluded items (bgioClient change, counters, perf capture, transition log, buffer durability, raw frame capture, server correlation, engine change).
- **§2 Constraints** — PASS. Engine-wide (full file contents, no diffs, ESM/Node v22+, 00.6) + packet-specific (boundary-clean, transport-not-game-state, no bgioClient edit, counters out, pure builder, `Date.now()` why-comment, always-present block) + session protocol + locked values.
- **§3 Assumes** — PASS. The WP-311 store shape + every-frame call, the WP-228 builder + opaque-payload pattern, the `sampleContext` single-backfill point, the WP-116 transport-state framing, and a green baseline. Each cites its source.
- **§4 Context (Read First)** — PASS. Specific files (diagnostics.ts, connection.ts, the Vue exporter, both test files, bgioClient read-only) + D-22801/D-24096 + the ewiki page. No `00.2` reference: no card-data / setup-field change (a client diagnostic block).
- **§5 Files** — PASS. 5 content files (3 arena-client runtime + 2 tests), bounded, no `01.5` wiring file; each marked modified with a one-line description; bgioClient.ts explicitly excluded.
- **§6 Naming** — PASS. `TransportDiagnostics`, `buildTransportDiagnostics`, `lastFrameAtMs`, `timeSinceLastFrameMs`, `isConnected`, `lastStateId`, `hasEverConnected`; full words, no abbreviations; consistent with the WP-311 store + WP-228 module.
- **§7 Dependency discipline** — PASS. **No new dependency** — reuses the existing `connection` store + diagnostics module.
- **§8 Architectural boundaries** — PASS. App layer only; reads a Pinia store, no runtime engine/registry/server/`boardgame.io` import in `diagnostics.ts`; no `G` write; the EC-260 boundary grep still holds.
- **§9 Windows** — PASS. `pwsh` `Select-String` + `git diff --name-only` verification.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. arena-client `node:test` under jsdom with active Pinia; no `boardgame.io/testing`; `typecheck` gated.
- **§13 Verification** — PASS. Exact `pnpm` commands + expected output; the REQUIRED-field typecheck gate + the `git diff` bgioClient exclusion are explicit.
- **§14 Acceptance criteria** — PASS. 9 binary, observable items aligned to the deliverables (the block shape, the pure helper + derivation, builder pass-through, the store field + preserved 2-arg call, the click-path, bgioClient untouched, no engine footprint, the gates, scope).
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/ewiki/WORK_INDEX/EC_INDEX/mindmap + scope check. `User-Visible Surface = none (internal tooling)` ⇒ §15.1 D-24026 **does not** apply (declared, with the report-download verification substituted).
- **§16 Code style** — PASS. A pure helper (explicit field copy + one subtraction, no ternary chain/reduce), a defaulted store parameter, and test cases; `// why:` on the `Date.now()` default; no abbreviations; every function keeps its JSDoc.
- **§17 Vision Alignment** — N/A (declared) + multiplayer-sync + monetization + determinism notes: reads sync observability but changes no sync logic; internal diagnostics, no revenue vector; pure client presentation, zero determinism footprint; NG-1..7 preserved.
- **§18 Prose-vs-grep** — PASS. Verification Step 3 greps `diagnostics.ts` for `TransportDiagnostics`/`buildTransportDiagnostics`/`timeSinceLastFrameMs` (source-file scoped, not a forbidden-token grep over prose).
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A — no funding affordance / channel / donate-support copy (client diagnostic export + a store field only).
- **§21 API Catalog** — N/A — no HTTP endpoint and no `apps/server/src/**` library function; the report is assembled client-side with zero network egress.

**Lint verdict: PASS (all 21 resolved; 6 N/A each justified; §7 no new dependency).**

---

## Pre-Flight Verdict (01.4)

> Recorded at drafting; the executing session re-confirms against its own baseline.

**Verdict: READY TO EXECUTE (2026-07-25).**

- **Sequencing / dependencies:** WP-228 / D-22801 (the diagnostics module +
  builder), WP-311 / D-24096 (the `connection` store), and WP-246 (the
  context-field precedent) are all on `main`. No engine dependency; a pure client
  extension.
- **Green baseline:** `main @ 365aff6f`.
- **Scope lock:** closed allowlist (5 arena-client files), no `01.5` wiring file
  (`DiagnosticExportButton.vue` is already mounted); `git diff --name-only` is a
  DoD gate that explicitly excludes `client/bgioClient.ts` and
  `packages/game-engine/**`.
- **Contract fidelity:** the `transport` field mirrors the shipped
  `uiStateSnapshot` / `matchSetup` pass-through pattern (WP-246 / WP-361); the one
  new decision is the frame-stamp mechanism (a defaulted store parameter, chosen
  specifically so `bgioClient.ts` stays untouched).
- **RS-1 (clarification, non-blocking):** reconnect/resync counters are the
  natural next increment but are OUT here — they require `bgioClient.ts`
  instrumentation. Named in Goal / Out of Scope as WP-A2.
- **Empirical scaffold (drafting session, reverted):** the change was prototyped
  on this branch — the `TransportDiagnostics` interface + `transport` field on
  both interfaces + the pure `buildTransportDiagnostics` helper + the builder
  pass-through (`diagnostics.ts`), the `lastFrameAtMs` field + defaulted `atMs`
  parameter (`connection.ts`), the `collectContext` wiring
  (`DiagnosticExportButton.vue`), and the REQUIRED-field backfill in the
  `sampleContext` helper (`diagnostics.test.ts`) — and the arena-client suite run:
  **`vue-tsc` typecheck 0** (the REQUIRED `transport` field broke typecheck only at
  the single `sampleContext` backfill point, confirming the centralized-fixture
  claim) and **1095 / 1095 tests pass, 0 fail** (unchanged from the baseline —
  purely additive). `git diff --name-only` during the scaffold was exactly the
  four edited files (+ governance) — **no fifth or sixth file was forced**; the
  three *other* `setConnected` callers (`bgioClient.ts`,
  `ConnectionStatusBanner.test.ts`, `useDeployVersionCheck.test.ts`) kept compiling
  because the new parameter is defaulted, empirically confirming the closed
  5-file allowlist (`connection.test.ts`'s new cases are additive, not required
  for green). The prototype was then reverted (this SPEC draft is docs-only; the
  code lands at execution).
- **PS items (blocking):** none.

---

## Copilot Check (01.7)

> Recorded at drafting; the executing session may re-run.

**Overall judgment: PASS → CONFIRM (2026-07-25).** Recorded from an independent
subagent audit (read-only, adversarial) that verified every WP/EC claim against
the source (connection-store shape, the two-argument every-frame `setConnected`
call, the `uiStateSnapshot`/`matchSetup` pass-through, the single-`sampleContext`
backfill point, the ewiki gap) and grepped the whole repo for
`DiagnosticContext`/`DiagnosticReport`/`buildDiagnosticReport` consumers to
confirm the closed 5-file allowlist forces no sixth file. Additive, single runtime
layer (App), tightly precedented (mirrors the shipped `uiStateSnapshot` /
`matchSetup` pass-through), no engine/determinism risk, no new dependency,
`bgioClient.ts` untouched. No BLOCK/RISK across the 30-mode lens.

Selected findings:
- **#1 / #9 (layer boundary)** — client-only runtime; reads a Pinia store, no
  runtime engine/registry/server/`boardgame.io` import in `diagnostics.ts`, no `G`
  write; the EC-260 boundary grep still holds.
- **#2 (determinism)** — zero engine footprint; transport state is framework state
  (never `G`, never persisted); no `finalStateHash` sentinel touched.
- **#4 (contract drift)** — the REQUIRED `transport` field is backfilled once in
  `sampleContext`; the store's new `lastFrameAtMs` rides a defaulted parameter so
  the `bgioClient.ts` two-argument call keeps compiling.
- **#7 (new dependency)** — none; reuses the connection store + diagnostics module.
- **#12 (scope creep)** — counters, perf, transition log, buffer durability, and
  server correlation are all explicitly deferred; closed allowlist + `git diff`
  gate.

**Disposition: CONFIRM** — session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24249 (reserved; Drafted 2026-07-25, not yet landed)** — The play-surface
  diagnostic report (WP-228) gains a **`transport` block**:
  `{ isConnected, lastStateId, hasEverConnected, lastFrameAtMs,
  timeSinceLastFrameMs }`. (1) **Sourced from the connection store, not `G`.**
  The first four fields come from the WP-311 / D-24096 `connection` store —
  boardgame.io framework/transport state that carries no `G`/card/zone data and is
  never persisted (WP-116 disconnect policy). Reading it into a downloaded report
  introduces no persistence/determinism surface; the diagnostics-module boundary
  (EC-260) is preserved (a Pinia store read, no engine/registry/`boardgame.io`
  import). (2) **`timeSinceLastFrameMs` is the derived staleness signal.** The
  capture clock minus the store's per-frame `lastFrameAtMs` stamp is the decisive
  number for the "waiting-forever-for-a-server-frame" freeze class — the class the
  motivating live report (`match=660LwoUY-Yq`) could not diagnose. The derivation
  lives in a pure `buildTransportDiagnostics(state, capturedAtMs)` helper (clock
  passed in) so the report builder stays clock-free. (3) **Frame stamp via a
  defaulted parameter.** `connection.setConnected` gains a defaulted `atMs =
  Date.now()` third parameter so the stamp rides the already-every-frame call
  without editing the transport wrapper (`bgioClient.ts` stays untouched). (4)
  **Counters deferred.** The `bgioClient` reconnect/resync/watchdog counters are
  real signal but require instrumenting the wrapper; they are a separate follow-up
  (WP-A2), not part of this block. Pure client presentation — App layer only,
  reads only the connection store, writes no `G`/`ctx`, zero engine/determinism/
  replay footprint, no `finalStateHash` re-pin.

---

## See Also

- [WP-228](WP-228-arena-client-diagnostic-capture-export.md) / D-22801 — the
  diagnostic capture + credential-redacted report builder this extends.
- [WP-246](WP-246-arena-client-diagnostic-uistate-snapshot.md) — the
  `uiStateSnapshot` context-field pass-through precedent this mirrors.
- WP-311 / D-24096 — the `connection` store (`isConnected` / `lastStateId` /
  `hasEverConnected`) this block reads.
- ewiki [Play Diagnostics](https://ewiki.legendary-arena.com/play-diagnostics/) —
  the page whose "no transport data captured today" Edge Case this WP closes.
