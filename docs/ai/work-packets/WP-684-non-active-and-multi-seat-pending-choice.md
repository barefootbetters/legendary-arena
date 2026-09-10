# WP-684 — Non-active-player & multi-seat pending-choice capability (Game Engine + Arena Client)

**Status:** Done 2026-09-10 (EC-721; D-24501 Active)
**Layer:** Game Engine + Arena Client — **foundational** (extends a core invariant)
**Hard-deps:** the shipped active-player pending-choice / block-all model (D-24069, WP-286) ✅
**Blocks:** WP-682 (Diving Block, non-active reactive window), WP-683 (Random Acts, multi-seat pass)

## Goal

Generalize the engine's pending-choice model — today **active-player-only** — so a pending
choice may be addressed to a **non-active seat**, and so a **simultaneous multi-seat** choice
(every seat selects concurrently) can be modeled: block all moves until every addressed seat
has resolved, then apply atomically. No card is wired here; this is the shared capability the
arc's two multiplayer-touching cards need.

## User-Visible Impact

None directly — foundational. It unblocks the visible fixes in WP-682 (Diving Block protecting
a non-active player from a Master Strike Wound) and WP-683 (Random Acts pass-left). Validated by
unit tests + a projection/redaction test with no card consumer.

## Context (Read First)

Both WP-682 and WP-683 were drafted assuming a capability that does not exist. The shipped
pending-choice model is **active-player-scoped**: `getLegalMoves` short-circuits for the active
player, and block-all admits only the active player's `resolve*` move
([[reference_interactive_choice_active_player_only]]). But:

- **Diving Block** (WP-682) is a reactive "if **you** would gain a Wound" reveal. In multiplayer,
  a Master Strike or "each player gains a Wound" scheme wounds **non-active** players, so a
  non-active seat must be offered the reveal/decline window — impossible under the active-only model.
- **Random Acts** (WP-683) asks **every** seat to pass a card simultaneously.

Two independent gate reviews (pre-flight + copilot) converged: this is one undesigned, unowned
capability, and it must be designed and owned **before** WP-682/WP-683 execute. This WP owns it.

## Assumes

- The active-player pending-choice / block-all / `getLegalMoves` model exists and is the base to
  generalize (`game.ts`, `ai.legalMoves.ts`, the `resolve*` moves) — confirm the exact
  short-circuit sites at HEAD.
- `ctx.playOrder` / `ctx.numPlayers` are the seat set (engine-owned, deterministic).
- boardgame.io stage/turn gating: confirm how a move by a **non-current** player is admitted
  (stages / `everyone`) — this is the framework mechanism the generalization rides (baseline
  assertion; do not fork the framework's turn model).
- Determinism is non-negotiable: a multi-seat resolution must be replay-identical given the
  selections; disconnect/timeout of a non-active seat must have a defined, deterministic posture.

## Design Rationale

### 1. Non-active-seat pending choice (single seat)
Generalize the pending-choice descriptor + block-all + `getLegalMoves` so a pending choice can
name a **target seat** other than the active player; while it is open, that seat's `resolve*`
move is legal (and only it / the active player's non-conflicting moves are gated per the
existing posture). This is the minimum Diving Block needs.

### 2. Simultaneous multi-seat choice
Define the contract for a choice addressed to **all** seats at once: park a per-seat pending
entry, block all turn progress until **every** addressed seat has submitted, then apply all
selections **atomically** and deterministically. Per-seat UIState redaction so each seat sees
only its own prompt (the audience-filter contract). This is what Random Acts needs.

### 3. Disconnect / timeout posture
A non-active or multi-seat forced choice cannot stall the match forever. Define a deterministic
default resolution for a seat that does not (or cannot) submit — consistent with the existing
disconnect/reconnect posture (ARCHITECTURE.md §Disconnect & Reconnect Semantics), not an
invented policy. This is the load-bearing fairness/liveness decision this WP locks.

## Scope (In)

- Generalize the pending-choice descriptor(s) to carry a target seat (or all-seats) instead of
  implicitly the active player.
- `getLegalMoves` / block-all (`game.ts`, `ai.legalMoves.ts`) admit the addressed non-active
  seat(s)' `resolve*` move while a matching pending choice is open.
- A multi-seat "await all, then apply atomically" resolution helper + its determinism guarantee.
- Per-seat UIState redaction for a multi-seat prompt (five-step board-visible contract).
- Disconnect/timeout default-resolution posture (deterministic) for an unsubmitted seat.
- Tests: non-active seat can resolve while active player is blocked; multi-seat await-all +
  atomic apply + replay determinism; per-seat redaction; the timeout default.

## Out of Scope

- Any card (Diving Block / Random Acts wire in WP-682 / WP-683).
- Any new hero keyword, count source, or capture/wound mechanic.
- Reworking the active-only path for existing choices (strict superset — existing active-only
  pending choices must be byte-identical).

## Non-Negotiable Constraints

- Existing active-player pending choices are **unchanged** (strict superset; byte-identical).
- Multi-seat resolution is deterministic and replay-identical given the selections; atomic apply.
- Per-seat UIState redaction: a seat sees only its own prompt (audience-filter contract).
- No `Math.random`, no wall-clock; disconnect/timeout resolution is deterministic.
- Server stays authoritative (§5 multiplayer integrity); the engine decides, the client renders.
- New `resolve*` moves enroll in `SIMULATION_MOVE_NAMES` + both sim `MOVE_MAP`s.

## Files Expected to Change

See EC-721 §Files to Produce. Primarily `game.ts` (block-all / stage gating), `ai.legalMoves.ts`,
the pending-choice types + a multi-seat resolution helper, `ui/uiState.{types,build,filter}.ts`
(per-seat redaction), the sim dispatch maps, and arena-client scaffolding for a non-active/multi-seat
prompt (the concrete renderers ship with the consuming cards in WP-682/WP-683).

## Contract

- A pending choice may name a target seat (or all seats); `getLegalMoves` returns that seat's
  `resolve*` move while it is open; the active player cannot resolve another seat's choice.
- A multi-seat choice blocks turn progress until all addressed seats submit (or hit the
  deterministic timeout default), then applies all selections atomically.
- Per-seat UIState exposes only that seat's pending prompt.

## Vision Alignment

- §3 Player Trust & Fairness — every seat's choice is its own; deterministic, replay-faithful.
- §5 Multiplayer integrity — server-authoritative cross-seat choices with a defined liveness posture.
- §17.2 Non-Goal proximity — no pay-to-win / no client authority introduced; determinism preserved.

## Acceptance Criteria

- A non-active seat can resolve a pending choice addressed to it while the active player is blocked;
  the active player cannot resolve it.
- A simultaneous multi-seat choice awaits all seats, applies atomically, and replays identically.
- Per-seat UIState redaction verified; the disconnect/timeout default is deterministic and tested.
- Existing active-only pending choices are byte-identical (regression pin).
- Engine + arena-client suites green; `pnpm -r build` 0; determinism impact assessed (re-pin only
  if a hashed pending-choice field is added; assert the delta).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — non-active resolve, multi-seat await-all +
   atomic + determinism, per-seat redaction, timeout default, active-only regression pin green.
2. `pnpm --filter @legendary-arena/arena-client test` — the non-active/multi-seat prompt scaffolding.
3. `pnpm -r build` 0.
4. Confirm any hash re-pin is limited to a deliberately-added hashed field.

## Definition of Done

Both suites green, `pnpm -r build` 0, D-24501 Active, WORK_INDEX + EC_INDEX rows flipped, roadmap
mindmap node flipped, PR squash-merged. WP-682 and WP-683 unblocked.

## Reserved Decision (lands at execution)

D-24501 — non-active-seat & simultaneous multi-seat pending-choice capability (generalizes the
active-only model as a strict superset) + the deterministic disconnect/timeout posture for an
unsubmitted seat. See DECISIONS.md.

## Lint Gate Self-Review (00.3)

§1 Context (Read First) + Files Expected to Change present. Locked values (strict superset;
atomic multi-seat apply; deterministic timeout; per-seat redaction) stated. Cross-layer (engine
decides, client renders; server authoritative) — no inversion. §2 engine-wide constraints:
ESM/Node v22+, determinism, no `Math.random` (see `.claude/rules/*`). §17 Vision Alignment cites
§3/§5/§17.2 with an explicit determinism-preservation line. §20 funding: N/A (no funding surface).
§21 API catalog: N/A (no HTTP/library surface). Extends a core invariant deliberately and as a
strict superset — the reason this is its own foundational WP. Applicable items satisfied.
