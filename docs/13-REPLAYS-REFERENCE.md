# Legendary Arena — Replay & Game Saving Reference

> **Authority:** Subordinate to `01-VISION.md`, `docs/ai/ARCHITECTURE.md`,
> and `DECISIONS.md`. This is a **normative governance reference**, not
> implementation detail. All systems that touch replays must conform to
> the rules defined here.
>
> Replay determinism, replay immutability, and replay-verified scoring are
> **immutable trust surfaces** (D-1002) and must not be weakened, optimized
> around, or conditionally enforced. Any deviation requires an explicit
> decision entry in `DECISIONS.md`.
>
> **Version:** 1.1
> **Last updated:** 2026-04-11

---

## Table of Contents

- [Purpose](#purpose)
- [Core Philosophy](#core-philosophy)
- [What Replays Are Not](#what-replays-are-not)
- [Game Recording Model](#game-recording-model)
- [Replay Playback Experience](#replay-playback-experience)
- [Storage and Access Architecture](#storage-and-access-architecture)
- [Export and Import](#export-and-import)
- [Community Scoreboard Integration](#community-scoreboard-integration)
- [Account and Guest Policy](#account-and-guest-policy)
- [Privacy and Consent Controls](#privacy-and-consent-controls)
- [Replay System Invariants](#replay-system-invariants-non-negotiable)
- [Technical Implementation Guardrails](#technical-implementation-guardrails)
- [Relationship to Other Documents](#relationship-to-other-documents)

---

## Purpose

This document defines the **authoritative replay and game-saving system** for
Legendary Arena.

Every played game becomes a **permanent, reviewable, and shareable artifact** —
analogous to a chess PGN file, but richer — while remaining 100% faithful to the
deterministic engine and all Primary Vision Goals.

It exists to:
- Make every game a studyable artifact of strategy, decision-making, and heroism
- Support personal improvement, community sharing, and competitive benchmarking
- Enable server-side persistence, local ownership, and replay-verified
  leaderboards without compromising fairness or rules authenticity
- Provide a durable foundation for spectation, coaching, and external analysis
  (including LLM-based tools per Vision goal 19)

This document defines **what must be true**, not how code is written.

---

## Core Philosophy

Every game in Legendary Arena is **automatically recorded** from the first card
draw to the final victory, defeat, or concession. Nothing is optional.

Because the game engine is fully deterministic, a replay is **bit-for-bit
equivalent** to the original session. Replays are:

- Re-executable — the engine can reconstruct the full game from replay data alone
- Verifiable — cryptographic hashing confirms integrity
- Immutable — write-once, append-never, no editing or normalization
- Sufficient — reproduces final state, Raw Score, and PAR normalization exactly

This directly fulfills:
- Vision goal 18 (Replayability & Spectation)
- Vision goal 19 (AI-Ready Export & Analysis Support)
- Vision goals 22 & 24 (Deterministic scoring, replay-verified integrity)

Replays are the **sole source of truth** for scoring, leaderboards, and
competitive validation.

---

## What Replays Are Not

Replays are **not**:
- Analytics telemetry
- Debug logs
- Best-effort recordings
- Lossy summaries
- Server-interpreted reconstructions

Replays exist to be **re-executed**, not merely viewed.

If a game cannot be faithfully replayed by the engine, it is considered
**invalid** for scoring, competition, or archival purposes.

---

## Game Recording Model

### What Is Recorded

A replay is a time-ordered, structured sequence of **atomic engine-level events**,
including:

- Game setup (scheme, mastermind, villain groups, player count, hero teams)
- Deterministic seed (for seeded RNG reconstruction)
- Player order
- All player intents and validated engine actions (as `ReplayMove` entries)
- Final game state

The replay alone is sufficient for full re-execution. **No server context, UI
state, patching, inference, or post-processing is permitted.**

This aligns with the `ReplayInput` contract defined in WP-027:
```
ReplayInput { seed, setupConfig, playerOrder, moves: ReplayMove[] }
```

### Automatic and Immutable

- Every game is recorded automatically, without player intervention
- Replays are **write-once and append-never**
- No editing, truncation, reordering, normalization, or re-serialization
  (even if semantically equivalent) is permitted
- Server-side "repairs," "fix-ups," migration jobs, or cleanup passes are forbidden
- Corrections require generating a **new replay** (not modifying the original)
- A cryptographic verification hash is stored with every replay

### Engine-Level, Not Server Artifacts

Replays are **engine-layer data**, not server artifacts. The engine produces
the replay record; the server stores it. The server must never interpret,
modify, or reconstruct replay content.

This preserves the layer boundary: the engine decides outcomes; the server
connects pieces.

---

## Replay Playback Experience

Players access replays through the in-game **Replay Library**.

### Core Features

- Step-by-step playback with VCR-style controls (play, pause, step forward/back, variable speed)
- Identical card zoom, rules pop-ups, and game log as live play
- Optional private or public annotations
- One-click export from the replay screen

### Spectation

Live spectation and post-game viewing use the **same replay engine**,
guaranteeing zero divergence between played, watched, and replayed games.

Spectators see the spectator-filtered view (WP-029) — public zones and hand
counts, never hidden cards or deck order.

---

## Storage and Access Architecture

### Server-Side Storage (Default)

- Completed games are stored on the server for a **minimum of 30 days**
- Hosted in cloud object storage aligned with other immutable assets
- Accessible from any device via account login
- Extended retention is offered only as a convenience, never as gameplay advantage

### Local Export (Player-Owned)

- Any replay may be exported locally with one click
- Local replay files are:
  - Self-contained (no server dependency for playback)
  - Deterministic (same file always produces same re-execution)
  - Fully usable offline
- Players may archive, share, or analyze them indefinitely

### Hybrid Model

The server stores the authoritative copy. Local exports are bit-identical
mirrors. **Players always own their game history.**

---

## Export and Import

### Export Formats

Replays may be exported in multiple representations:

- Compact native format (e.g., `.lar`) for fast load and transport
- Structured JSON for analysis and AI tooling (Vision goal 19)
- Plain-text summaries for quick sharing

Exact encodings are implementation details; replay **semantics, ordering, and
determinism are the binding contract**. All exports include a verification hash.

### Import

Any valid replay file may be imported to watch, study, or verify it. No account
or server history is required. Imported replays can be re-executed and
re-scored by the engine.

---

## Community Scoreboard Integration

Replays are the **only accepted input** for competitive scoring.

**No replay, no score.**

### Submission Flow

1. Player selects a replay from their library
2. Chooses an eligible leaderboard (scenario-specific)
3. Server re-executes the replay in isolation
4. Verification confirms:
   - Rules compliance (engine re-execution succeeds)
   - Score correctness (Raw Score matches)
   - PAR exists for the scenario (WP-051 gate check)
   - Absence of tampering (hash verification)
5. Valid replays appear on the leaderboard with permanent permalinks

Leaderboards are scenario-specific and ranked by Final Score relative to PAR
(see `docs/12-SCORING-REFERENCE.md`).

**Client-reported results are never trusted.** The server always re-executes.
Leaderboard state is derived exclusively from server-verified replay execution,
never from persisted scores or client submissions.

---

## Account and Guest Policy

### Guest Play (No Account Required)

- Any player may play and complete a game without an account
- Every game is fully recorded
- Guests receive **immediate one-click local replay export** upon game end
- Local replay ownership is permanent and unconditional

### Account-Based Features (Optional)

Accounts unlock:
- Server-side replay persistence and multi-device access
- Replay Library browsing and search
- Annotations
- Leaderboard submission
- Permanent shareable replay links
- Extended retention (supporter tier convenience only)

Creating an account is free and optional. **Core gameplay and local replay
ownership are never gated.**

---

## Privacy and Consent Controls

- Replays are **private by default**
- Public sharing and leaderboard submission require explicit opt-in
- GDPR-compliant deletion is supported
- Replays are never used for in-game AI assistance (D-0701)
- Replay data is never sold, shared with third parties, or used for advertising

---

## Replay System Invariants (Non-Negotiable)

These are hard correctness requirements, not guidelines:

- Every competitive score must be backed by a valid, re-executable replay
- Every replay must be sufficient to reproduce:
  - Final game state (identical `computeStateHash` per WP-027)
  - Raw Score (identical `computeRawScore` per WP-048)
  - PAR normalization (identical Final Score)
- Server verification always re-executes the replay — never trusts client results
- Replay immutability is enforced at write time — no post-hoc modification
- Replay format is versioned — historical replays remain valid under their
  original version

Violation of any invariant is a **hard correctness failure**. Any system
component that bypasses or weakens these invariants is considered
architecturally invalid and must be removed or reworked.

---

## Technical Implementation Guardrails

- Replay = deterministic re-execution of recorded inputs only
- The engine is the sole gameplay authority — replays do not bypass the engine
- No cross-layer leakage — replay recording and playback respect layer boundaries
- Replay recording must impose **no measurable gameplay latency**
- Replay versioning preserves historical meaning — old replays remain playable
  under their original engine version

---

## Relationship to Other Documents

| Document | Relationship |
|----------|-------------|
| `01-VISION.md` (goals 18, 19, 22, 24) | Authoritative — replays implement these goals |
| `docs/ai/ARCHITECTURE.md` | Persistence boundaries, layer separation |
| `DECISIONS.md` | D-0002 (Determinism), D-0703 (PAR), D-1002 (Immutable surfaces) |
| `12-SCORING-REFERENCE.md` | Replays as sole scoring input |
| `12.1-PAR-ARTIFACT-INTEGRITY.md` | PAR hashing trust model |
| `WP-027` | ReplayInput contract, verifyDeterminism, computeStateHash |
| `WP-048` | Scoring contracts (ScoreBreakdown, computeRawScore) |
| `WP-051` | Server gate (PAR must exist before competitive submission) |
| `03A-PHASE-3-MULTIPLAYER-READINESS.md` | Replay safety under concurrency |

---

**Legendary Arena replays are not a convenience feature.**

They are the institutional memory of heroic play — preserved faithfully, owned
by players, and enforced by mathematics.

Every great game deserves to be remembered — correctly, completely, and forever.
