---
title: Play Diagnostics
type: Tool
tags:
  - diagnostics
  - tooling
  - operations
  - freeze-debugging
  - arena-client
  - effect-provenance
related:
  - operational-health-checks.md
  - turn-system.md
  - rule-execution-pipeline.md
  - cardextid.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\play-diagnostics.md (this page — https://ewiki.legendary-arena.com/play-diagnostics/)
  - ../apps/arena-client/src/diagnostics/diagnostics.ts
  - ../apps/arena-client/src/diagnostics/effectProvenance.ts
  - ../apps/arena-client/src/diagnostics/matchSetupSession.ts
  - ../apps/arena-client/src/components/DiagnosticExportButton.vue
  - ../apps/arena-client/src/client/bgioClient.ts
  - ../docs/ai/work-packets/WP-228-arena-client-diagnostic-capture-export.md
  - ../docs/ai/work-packets/WP-314-diagnostic-effect-provenance.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-07-25
---

## Summary

Play Diagnostics is the operator-facing capture-and-export tool on the
game client (`play.legendary-arena.com`). An always-on, bounded,
in-memory buffer records every `console.*` call and every uncaught
`window` error / unhandled rejection for the page's lifetime; a small
fixed-position **Download diagnostics** button then bundles that buffer
with the player's live UIState snapshot, the input match-setup
composition, and a derived effect-provenance block into a single
credential-redacted JSON report. It is the primary artifact for
diagnosing a frozen or misbehaving live match — one download instead of
a code hunt.

## Mechanics

### Always-on capture

[`diagnostics.ts`](../apps/arena-client/src/diagnostics/diagnostics.ts)
installs a single module-level capture singleton per page load. It
wraps five console levels — `log`, `info`, `warn`, `error`, `debug` —
and registers `window` `'error'` + `'unhandledrejection'` listeners.
Every wrapped console method calls through to the original first and
always (pass-through capture: it never suppresses output), then appends
a normalized entry to a ring buffer. Each entry carries a monotonic
`sequence`, its `kind` (`console` / `error` / `unhandledrejection`),
the console `level` (or `null`), the `message`, an associated `stack`
when one is available, and a wall-clock `atMs`.

The buffer is capped at `DIAGNOSTIC_BUFFER_CAP` (200 entries). On
overflow the oldest entry is dropped and a `droppedEntryCount`
increments, so the exported report's `truncated` flag (`= droppedCount
> 0`) discloses any loss. Installation is idempotent, and a
non-enumerable per-method marker additionally guards against
double-wrapping under a Vite HMR module re-instantiation.

Message/stack construction is fixed: for a console call, the first
`Error` argument's `.message` + `.stack` win; otherwise the arguments
are `String()`-joined by a single space with a `null` stack. A `window`
error prefers `event.error` (an `Error`) over `event.message`; a
rejection prefers an `Error` reason over `String(reason)`.

### The report envelope

[`buildDiagnosticReport`](../apps/arena-client/src/diagnostics/diagnostics.ts)
is a pure builder — it reads no ambient `window` / `Date` / global
state; the impure caller passes everything in. The report carries build
identity (`appVersion`, `gitSha`, `buildTimestamp`, `capturedAtIso`),
the redacted `locationHref`, `matchId` / `playerId`, viewport size and
`userAgent`, the derived `entryCount` / `entryDroppedCount` /
`truncated`, two opaque payloads (`uiStateSnapshot`, `matchSetup`), the
typed `transport` block and the derived `effectProvenance`, and finally
the captured `entries` array.

`uiStateSnapshot` and `matchSetup` are carried **opaque** — typed
`unknown` — so the diagnostics module inspects neither and imports
nothing from the engine, registry, pre-planning, server, or multiplayer
surfaces (the EC-260 boundary grep enforces this). `uiStateSnapshot` is
the player's own audience-filtered view read from the client store;
`matchSetup` is the input composition read back from session storage;
both are serialized, never interpreted. The `transport` block (WP-428)
is **typed** — assembled by the caller from the WP-311 `connection`
store, a Pinia read that keeps the boundary — and `effectProvenance` is
derived structurally from the snapshot (see below).

### Effect provenance

[`effectProvenance.ts`](../apps/arena-client/src/diagnostics/effectProvenance.ts)
derives a compact "why is this stuck / did that card fire" summary
structurally from the UIState snapshot the report already carries — so
a "froze after I played card X" report names its own cause without an
engine trace. Two fields:

- `awaitingPlayerInput` — what the turn is blocked on, read from the
  projected `pending*` fields. The block-all kinds are
  `victoryPileCardPick`, `optionalKoReward`, `drawOrEmpowered`, and
  `koHeroChoice`; `null` when nothing is pending. This is the primary
  deliverable — a block-all pending choice was previously invisible in
  the export.
- `recentlyPlayedCards` — the last `RECENTLY_PLAYED_CARDS_CAP` (5)
  played cards, each with its `extId`, an inferred `outcome`
  (`resolved` / `hollow` / `awaitingChoice` / `conditionNotMet`), and
  an `abilityText` resolved from the snapshot's own projected card
  display (no card-text import).

The builder is fail-soft: a null or malformed snapshot yields an empty
provenance, a throwing resolver yields `abilityText: null`, and it
never throws — the export stays robust.

### Transport block

[`buildTransportDiagnostics`](../apps/arena-client/src/diagnostics/diagnostics.ts)
assembles the typed `transport` block (WP-428 / D-24249) from the WP-311
[`connection` store](../apps/arena-client/src/stores/connection.ts) and the
single click-time capture clock — so a freeze report names the client's live
connection state instead of leaving the transport layer opaque. Five fields:

- `isConnected` / `lastStateId` / `hasEverConnected` — read verbatim from the
  `connection` store: boardgame.io's `transport.isConnected`, the last observed
  `_stateID`, and the one-way "connected at least once" latch.
- `lastFrameAtMs` — a client wall-clock stamp the store records on **every**
  subscribe frame. It rides the existing `setConnected` call via a defaulted
  `atMs = Date.now()` parameter, so `client/bgioClient.ts` is untouched.
- `timeSinceLastFrameMs` — derived: the capture clock minus `lastFrameAtMs`
  (or `null` before the first frame). This is the decisive number for the
  "waiting-forever-for-a-server-frame" freeze — a large value means the client
  stopped receiving server frames while the tab still looks alive.

The derivation lives in the pure `buildTransportDiagnostics(state, capturedAtMs)`
helper (the clock is passed in), so `buildDiagnosticReport` stays clock-free and
the block rides straight through — the same pass-through posture as
`uiStateSnapshot` / `matchSetup`, except the block is **typed**, not opaque. It
reads only the `connection` Pinia store (framework/transport state, never `G`,
never persisted per the WP-116 disconnect policy), so the EC-260 module boundary
holds. The `bgioClient` reconnect/resync/watchdog **counters** are a separate,
not-yet-surfaced follow-up (see Edge Cases).

### The export flow

[`DiagnosticExportButton.vue`](../apps/arena-client/src/components/DiagnosticExportButton.vue)
is the impure caller. On click it reads the clock once, collects live
browser context (redacting the `credentials` query param out of
`locationHref` before the pure builder runs), reads the UIState
snapshot from the client store and the input setup via
`readMatchSetup(matchId)`, builds and serializes the report, downloads
it as a `.json` file via a transient object-URL anchor, and
best-effort copies the same payload to the clipboard. The download
file name is
`legendary-arena-diagnostics-{matchId-or-no-match}-{capturedAtMs}.json`,
with `/` and `\` in the match id replaced by `-`. The button is
`position: fixed` bottom-left at `z-index: 9999` so it stays reachable
above any stuck overlay or modal.

### Credential redaction

[`redactCredentialsFromUrl`](../apps/arena-client/src/diagnostics/diagnostics.ts)
replaces the `credentials` query-param value with the literal
`***redacted***` while leaving `match` / `player` intact for
correlation. It parses via `URL()`; a malformed href falls back to a
regex strip so the live-match session secret never survives into the
report even for an unparseable href.

### Input match-setup capture

[`matchSetupSession.ts`](../apps/arena-client/src/diagnostics/matchSetupSession.ts)
stashes the INPUT match-setup composition (scheme / mastermind /
groups / heroes + the four supply-pile counts) in `sessionStorage`,
keyed by match id, at match creation. The client never receives the
engine's raw `G` — only the UIState projection, which omits the input
config — so pairing the input composition with the snapshot's *live*
pile counts lets one read distinguish "misconfigured to 1" from
"started at 30 and drained mid-game" (the disambiguation the
Web-Shooters rescue bug needed). `sessionStorage` (not an in-memory
singleton) is chosen so the setup survives a mid-match reload, which is
exactly when diagnostics are most needed. `readMatchSetup` returns
`null` when the client did not create the match, the session cleared,
or the stored entry is corrupt.

## Interactions

- **Client UIState store.** The report's `uiStateSnapshot` is read from
  the Pinia UI store the live session already maintains (the same store
  `bgioClient` writes each server frame into). It is the player's own
  audience-filtered projection — no cross-player data.
- **`effectProvenance` ← snapshot.** The provenance block is derived
  entirely from that same snapshot, so it needs no additional context
  field and no engine import. Its `pending*` and `hollowEffects` reads
  connect the freeze diagnostic to the
  [Rule Execution Pipeline](rule-execution-pipeline.md) (hollow /
  unresolved effects) and to the pending-choice guard.
- **[Turn System](turn-system.md).** A freeze manifests mid-turn; the
  provenance block reads the projected turn/stage/pending fields to
  classify what the stage is blocked on. The diagnostic is client
  tooling *about* a turn, not part of the turn state machine itself.
- **Transport layer (`connection` store / `bgioClient`).** The report
  carries a typed **`transport` block** (WP-428): `isConnected`,
  `lastStateId`, `hasEverConnected` (read from the WP-311 `connection`
  store), a per-frame `lastFrameAtMs` stamp, and a derived
  `timeSinceLastFrameMs` (the capture clock minus `lastFrameAtMs`) — the
  staleness signal that separates "my browser is wedged" from "the server
  advanced past my view." The store records `lastFrameAtMs` on every
  subscribe frame via a defaulted parameter, so
  [`client/bgioClient.ts`](../apps/arena-client/src/client/bgioClient.ts)
  is untouched. The `bgioClient` reconnect/resync/watchdog **counters**
  are not yet surfaced — a deferred follow-up (see Edge Cases).
- **[Operational Health Checks](operational-health-checks.md).** The
  sibling operator tool. Those probes answer "is the production
  perimeter reachable" from the server side; Play Diagnostics answers
  "what did this browser see when the match wedged" from the client
  side. Reach for the health checks first when a whole surface is down;
  reach for Play Diagnostics when one match froze.
- **Engine boundary.** Every file in this tool is pure browser code —
  zero import from `packages/game-engine`, `packages/registry`,
  `packages/preplan`, `apps/server`, or `boardgame.io`. The opaque
  `unknown` typing of `uiStateSnapshot` / `matchSetup` keeps that
  boundary clean while still carrying engine-shaped data through; the
  typed `transport` block stays clean a different way — it reads the
  arena-client `connection` Pinia store, not any engine surface.

## Edge Cases

- **Empty `entries` does not mean the capture is broken.** A report
  with `entryCount: 0` most often means either the freeze was
  logically silent (a wedge that threw no error and logged nothing) or
  the operator hard-refreshed to recover *before* clicking export,
  which resets the per-page-load in-memory buffer. The capture
  mechanism works; the buffer is simply empty. (A session-surviving
  buffer is future work — see History.)
- **The report reflects only the exporting seat.** `uiStateSnapshot`
  and the console buffer belong to the browser that clicked export. A
  waiting seat (e.g. a spectator, or a player whose turn it is not) can
  export a perfectly healthy-looking report while a *different* seat's
  client is the one wedged — the exporting browser never sees the other
  client's console or transport. Read `playerId` against
  `uiStateSnapshot.game.activePlayerId` to know which seat's view you
  are holding.
- **Transport data is captured; reconnect counters and performance data
  are not.** As of WP-428 the report carries the `transport` block —
  connection status, last `_stateID`, and `timeSinceLastFrameMs` (the
  "waiting forever for a server reply" staleness signal). Still absent:
  the `bgioClient` reconnect/resync/watchdog **counters** (they live as
  locals in the transport wrapper — a separate follow-up), and any
  **performance / memory** signals (long tasks, heap, frame drops — a
  separate perf-recorder follow-up). A blocked main thread also can't be
  captured by a click handler that never runs; a continuous recorder is
  the future shape.
- **`matchSetup` is `null` for joiners.** Only the client that *created*
  the match persisted the input composition, so a report from a joined
  player carries `matchSetup: null`. Pull the setup from the creator's
  report, or from the server, in that case.
- **`truncated: true` means the console tail was dropped.** On a
  long-lived page the 200-entry cap can evict the oldest entries; the
  flag discloses it. The most recent 200 entries are always retained.
- **Played-line parsing is prose-fragile.** `effectProvenance` extracts
  each played card's `extId` by parsing the projected log prose. An
  enrichment to that prose (WP-417 added a printed-icon clause) once
  broke the extractor into capturing `+1 recruit` as the `extId`; the
  parser now anchors on the first ext-id-shaped parenthesized group.
  The durable fix is a structured log-outcome contract (queued as
  WP-B.3), which removes prose-parsing entirely.
- **Clipboard copy is best-effort.** When the Clipboard API is absent or
  rejects (permissions, focus), the copy is silently skipped — the file
  download is the primary share path and always runs.
- **Redaction targets the `credentials` param only.** `match` and
  `player` are deliberately retained for correlation; no other
  query-string value is stripped, so avoid putting secrets elsewhere in
  the play-surface URL.

## Code Touchpoints

- [`apps/arena-client/src/diagnostics/diagnostics.ts`](../apps/arena-client/src/diagnostics/diagnostics.ts) —
  the capture singleton, the pure report builder, the redactor, and the
  file-name builder.
- [`apps/arena-client/src/diagnostics/effectProvenance.ts`](../apps/arena-client/src/diagnostics/effectProvenance.ts) —
  the derived `awaitingPlayerInput` + `recentlyPlayedCards` provenance.
- [`apps/arena-client/src/diagnostics/matchSetupSession.ts`](../apps/arena-client/src/diagnostics/matchSetupSession.ts) —
  session-scoped persistence of the input match-setup composition.
- [`apps/arena-client/src/components/DiagnosticExportButton.vue`](../apps/arena-client/src/components/DiagnosticExportButton.vue) —
  the impure exporter: context collection, download, clipboard copy.
- [`apps/arena-client/src/client/bgioClient.ts`](../apps/arena-client/src/client/bgioClient.ts) —
  the transport wrapper whose every-frame `setConnected` call feeds the
  `connection` store the `transport` block reads; it also holds the
  reconnect/resync/watchdog counters that are not yet exported.

## History

- **WP-228 / D-22801** — introduced the always-on capture buffer and
  the credential-redacted export button (the boundary-locked
  foundation).
- **WP-246** — added the live UIState snapshot payload to the report.
- **WP-314 / D-24100** — added the derived `effectProvenance` block
  (`awaitingPlayerInput` + `recentlyPlayedCards`).
- **WP-315 / D-24101** — projected hero-card `abilityText` onto the
  snapshot so provenance can resolve played-card text without a
  card-text import.
- **WP-417 / D-24237** — enriched the projected play log with a
  printed-icon clause; the same change required hardening the
  provenance `extId` extractor against the new parenthesized groups.
- **WP-428 / D-24249** — added the typed `transport` block (connection
  status, last `_stateID`, and `timeSinceLastFrameMs` staleness), sourced
  from the WP-311 `connection` store; the store's new per-frame
  `lastFrameAtMs` stamp rides a defaulted `setConnected` parameter, so the
  transport wrapper stayed untouched.

## References

- [`apps/arena-client/src/diagnostics/diagnostics.ts`](../apps/arena-client/src/diagnostics/diagnostics.ts)
- [`apps/arena-client/src/diagnostics/effectProvenance.ts`](../apps/arena-client/src/diagnostics/effectProvenance.ts)
- [`apps/arena-client/src/diagnostics/matchSetupSession.ts`](../apps/arena-client/src/diagnostics/matchSetupSession.ts)
- [`apps/arena-client/src/components/DiagnosticExportButton.vue`](../apps/arena-client/src/components/DiagnosticExportButton.vue)
- [WP-228 — arena-client diagnostic capture + export](../docs/ai/work-packets/WP-228-arena-client-diagnostic-capture-export.md)
- [WP-246 — arena-client diagnostic UIState snapshot](../docs/ai/work-packets/WP-246-arena-client-diagnostic-uistate-snapshot.md)
- [WP-314 — diagnostic effect provenance](../docs/ai/work-packets/WP-314-diagnostic-effect-provenance.md)
- [WP-315 — card ability text in display and diagnostic](../docs/ai/work-packets/WP-315-card-ability-text-in-display-and-diagnostic.md)
- [WP-417 — play-effect and action logging](../docs/ai/work-packets/WP-417-play-effect-and-action-logging.md)
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-22801, D-24100, D-24101, D-24237
- [Operational Health Checks](operational-health-checks.md) — sibling operator tool
