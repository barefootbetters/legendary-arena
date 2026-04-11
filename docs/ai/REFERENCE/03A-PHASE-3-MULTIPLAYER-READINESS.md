# Phase 3 Multiplayer Readiness Gate

> **Authority:** Subordinate to `docs/ai/ARCHITECTURE.md` and `DECISIONS.md`.
> This gate is a **mandatory process constraint**, not advisory guidance.
> It defines what must be true **before** Phase 3 work begins and what
> Phase 3 must **deliver** before Phase 4 may start.

---

## Purpose

Phase 3 introduces **irreversible risk classes** that did not exist in
earlier phases:

- Concurrency (multiple clients, asynchronous intents)
- Networking (latency, retries, partial delivery)
- Persistence (snapshots, reconnects, restarts)
- Partial failure (disconnects, duplicate submissions)

This gate ensures that **single-player correctness is not weakened** when
these forces are introduced.

If this gate is violated, Legendary Arena stops being deterministic,
trustworthy, or replay-safe.

---

## Scope

**Phase transition:** Phase 2 (complete) -> Phase 3 (MVP Multiplayer)

**Phase 3 Work Packets:**
- WP-009A/B — Rule Hooks (contracts + implementation)
- WP-010 — Victory & Loss Conditions
- WP-011-013 — Lobby, Join, Persistence, Reconnect

This gate has two sections:
1. **Entry criteria** — must be true before any Phase 3 WP executes
2. **Exit criteria** — must be true before Phase 4 may begin

---

## Entry Criteria (Before Phase 3 Begins)

These conditions are **frozen preconditions** established by the Phase 3
Readiness Review (`docs/ai/invocations/phase3-readiness-review.md`, 2026-04-11).
Phase 3 work must not weaken any of them.

### E-1. Determinism Is Airtight

- [x] No `Math.random`, `Date.now`, `new Date()`, or `performance.now` in
      game-engine source (confirmed by grep audit)
- [x] All randomization uses `ctx.random` exclusively
- [x] `Object.keys`/`Object.values` used only in order-irrelevant contexts
- [x] 89/89 tests passing, 0 failures

### E-2. Move Validation Contract Holds

- [x] All core moves follow: validate args -> check stage -> mutate G
- [x] No mutation occurs before both validation steps pass
- [x] A rejected move is provably side-effect free

### E-3. Turn Engine Is Correctly Gated

- [x] Stage transitions follow `start -> main -> cleanup -> endTurn`
- [x] Exactly 2 code paths call `endTurn`, both through `getNextTurnStage`
- [x] No client-driven turn advancement possible

### E-4. Engine/Server Boundary Is Clean

- [x] Server imports only `LegendaryGame` from public API
- [x] No internal engine path imports (`src/moves/`, `src/rules/`, etc.)
- [x] Server never mutates or interprets `G`

### E-5. Scoring Is Frozen as a Trust Surface

- [x] Raw Score formula frozen (12-SCORING-REFERENCE.md v1.1)
- [x] Structural invariants locked (3 invariants, defaults satisfy all)
- [x] PAR pipeline designed (WP-048 through WP-051)
- [x] D-0703 (Difficulty Declared Before Competition) is immutable

### E-6. Governance Is Operational

- [x] `.claude/rules/*.md` enforce layer boundaries at execution time
- [x] ECs enforce locked values at checklist level
- [x] DECISIONS.md prevents re-litigation of settled choices

**Entry verdict:** All entry criteria pass. Phase 3 may proceed.

---

## Exit Criteria (Phase 3 Must Deliver)

These must all be true before Phase 4 (Core Gameplay Loop) begins.
Each criterion maps to specific Phase 3 WPs.

### X-1. Determinism Under Concurrency (WP-009A/B, WP-010)

- [ ] Move ordering determined by engine logic only — never by arrival time
- [ ] Simultaneous or near-simultaneous intents resolve identically across runs
- [ ] Rule hook execution order is deterministic (priority ascending, then
      id lexical — defined in ARCHITECTURE.md)
- [ ] Victory and loss evaluation is deterministic and order-stable
- [ ] Engine results identical with artificial latency injected

**Fail condition examples:**
- Two machines produce different states from the same intent sequence
- Hook ordering varies across runs
- Loss condition evaluated before victory when rules say otherwise

### X-2. Intent Validation & Replay Safety (WP-011, WP-012)

- [ ] Server validates intent structure before engine execution
- [ ] Invalid intents do not mutate `G` and produce deterministic rejection
- [ ] Only accepted intents are recorded for replay
- [ ] Replays never require server context to reproduce
- [ ] Duplicate intent submissions are safely rejected or idempotent

**Key principle:**
> If an action cannot be replayed offline, it must not be accepted online.

### X-3. Snapshot, Restore & Reconnect Integrity (WP-013)

- [ ] `MatchSnapshot` type defined (zone counts only, no CardExtId arrays)
- [ ] Snapshot taken mid-turn restores correctly
- [ ] Reconnected players resume the exact turn stage
- [ ] Snapshot restore + intent replay produces identical final state
- [ ] No double-execution after reconnect
- [ ] Snapshot format is JSON-serializable, deterministic, and versioned

**Fail condition examples:**
- Reconnect causes a turn stage to advance
- Restored game diverges on replay
- Snapshot contains derived or UI state

### X-4. Engine/Server Authority Separation (All Phase 3 WPs)

- [ ] Server submits intents only — never outcomes
- [ ] Server never mutates or patches `G`
- [ ] Engine remains unaware of users, sessions, sockets, or persistence
- [ ] No multiplayer-only logic paths inside the engine

**Invariant:**
> There is exactly one authority over game outcomes: the engine.

### X-5. Failure Mode Behavior (WP-011, WP-013)

Run each simulation at least once:
- [ ] Server restart mid-turn — game resumes correctly or fails clearly
- [ ] Client disconnect during move — no silent corruption
- [ ] Duplicate intent submission — no duplicated progression
- [ ] Delayed intent arrival after reconnect — no state divergence

**Expected behavior:** game either resumes correctly or fails clearly and
deterministically. Silent corruption, partial progression, or state ambiguity
is never acceptable. Failure must be explicit, reproducible, and diagnosable.

---

**Exit verdict rule:**
Phase 4 is blocked unless **all X-criteria pass simultaneously**.
Partial completion is not sufficient.

---

## Phase 3 Gate Decision

### Entry Status
- [x] All entry criteria pass (verified 2026-04-11)

### Exit Status
- [ ] All exit criteria pass — Phase 4 approved
- [ ] Exit criteria incomplete — Phase 3 work continues

### Blockers (if any)

| Area | Issue | WP | Status |
|------|-------|----|--------|
| (none at entry) | | | |

---

## Relationship to Governance

| Document | Relevance |
|----------|-----------|
| `ARCHITECTURE.md` | Determinism, layer boundaries, persistence rules |
| `DECISIONS.md` | D-0001 (Correctness), D-0002 (Determinism), D-0703 (PAR) |
| `WORK_INDEX.md` | Phase 3 WP dependency chain |
| `.claude/rules/server.md` | Server is wiring-only |
| `.claude/rules/game-engine.md` | Engine owns all gameplay authority |
| `12-SCORING-REFERENCE.md` | Scoring is a frozen trust surface |

> Phase 3 makes concurrency, persistence, and networking permanent.
> Any ambiguity accepted here survives for years.

Phase 3 establishes the permanent rules of multiplayer reality.
Any behavior accepted here becomes contractual.
