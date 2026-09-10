# WP-696 — Core Dr. Doom Tactic "Secrets of Time Travel" onFight Resolver + the Extra-Turn Primitive (Game Engine)

**Status:** Draft 2026-09-10 (EC-733; D-24513 reserved)
**Layer:** Game Engine · **Lane:** Standard two-session (mutates the turn/determinism
surface — introduces a new hashed `G` field and a new turn-advancement path;
lightweight-lane ineligible per 01.0a eligibility #6/#8) · **Baseline:**
`origin/main` @ `de1da518` · **User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** WP-497 (tactic-onFight framework / `tacticHandlers.ts` /
`dispatchTacticOnFight` / D-24300) ✅

## Goal

Defeating core Dr. Doom's **"Secrets of Time Travel"** tactic
(`core-mastermind-dr-doom-secrets-of-time-travel`, printed **"Fight: Take another
turn after this one."**) currently fires **nothing** — it falls through
`dispatchTacticOnFight` to the silent no-op like every unimplemented tactic. This
WP makes it faithful, which requires the arc's **only novel mechanic: an extra
turn.** The engine has no extra-turn primitive today. This WP introduces a
deterministic one — an optional `G.extraTurns` per-player counter incremented by
the resolver and honored at turn-end by the existing `advanceTurnStage`
chokepoint — so the defeating (active) player takes one immediate **additional
full turn** after the current one ends, before play passes to the next player.

## User-Visible Impact

On `play.legendary-arena.com`, when a player defeats Dr. Doom's "Secrets of Time
Travel" tactic, that player takes another complete turn (fresh hand, fresh
economy, all once-per-turn allowances) immediately, then play advances normally.
Validated by unit + harness-parity tests; **no UI** (the extra turn is just the
same seat's turn beginning again — no pending choice, no new client surface).

## Assumes

- **WP-497 / D-24300** (Mastermind Tactic onFight Execution Framework, ✅) —
  `dispatchTacticOnFight(G, ctx, defeatedTacticId, shuffleContext)` in
  `rules/tacticHandlers.ts`, wired as the final step of
  `defeatMastermindTacticCore` and firing on `ctx.currentPlayer` for every
  tactic defeat. This WP adds one more resolver + dispatch branch, plus the
  turn-loop honoring. **Hard dependency** — WP-497 must be on `main`.
- **Turn model.** The play phase uses boardgame.io's default turn order
  (`game.ts` `phases.play.turn`, no custom `order`). Every turn-end funnels
  through **`advanceTurnStage`** (`turn/turnLoop.ts`): at the final stage
  (`cleanup`) it calls `context.events.endTurn()` and lets boardgame.io rotate.
  Per the game-engine SKILL, `ctx.events.endTurn()` is the **only** way to end a
  turn; **manual player rotation is forbidden**; each call needs a `// why:`.
- **`endTurn` accepts a next-player argument.** boardgame.io 0.50.x's
  `events.endTurn({ next: playerID })` ends the current turn (firing `turn.onEnd`)
  and begins `playerID`'s turn (firing `turn.onBegin`) instead of rotating to the
  default next seat. Passing the *current* player id yields a second consecutive
  turn for that seat, with a normal `onBegin` (hand fill, `resetTurnEconomy`,
  `hasDrawnThisTurn`/`villainRevealedThisTurn`/etc. resets — `game.ts:707`).
  Baseline assertion at execution: confirm 0.50.x honors `{ next }` on `endTurn`
  (locked at `^0.50.0`).
- **The lazy-hashed-field pattern.** `computeStateHash` hashes the full `G`
  (`replay.hash.ts`, D-24124), so any new `G` field is gameplay/hash-affecting.
  The existing `handSizeOverrides` (WP-497) and `lastPlayEffectsFired` (WP-409)
  fields are **absent by default, never seeded in `buildInitialGameState`**, and
  so never materialize in the empty-registry `PRE_WP080` oracle — the pattern
  this WP reuses for `G.extraTurns` (see Determinism below).
- **The sim/replay harnesses bypass boardgame.io.** `simulation.runner.ts` and
  `replay/replay.execute.ts` do **not** run the framework's turn order — they
  call `advanceTurnStage` through a synthetic `events.endTurn` and rotate the
  player *manually* (`simulation.runner.ts` ≈ line 644:
  `currentPlayer = String((policyIndex + 1) % numPlayers)`). Any turn-model
  change must be mirrored in both harnesses or they diverge from the live game
  (`reference_simulation_harness_bypasses_bgio`). **This is the arc's
  foundational lockstep site.**
- Tactic ext_id grammar `${setAbbr}-mastermind-${slug}-${tacticSlug}`; core Dr.
  Doom's tactic resolves to **`core-mastermind-dr-doom-secrets-of-time-travel`**
  (mastermind slug `dr-doom`, tactic slug `secrets-of-time-travel`, printed
  "Fight: Take another turn after this one." — `data/cards/core.json`).

## Context (Read First — the design-heavy part)

This is the **foundational / novel** packet of the core mastermind-tactics arc:
the three siblings (WP-691 Treasures/Xavier's/Whispers, WP-506 Crushing Shockwave,
WP-567 Red Skull) all reuse existing primitives (economy, wounds, next-hand
override, victory-pile scan). "Take another turn" has no precedent — it must add
a turn-advancement primitive. Getting that primitive right is the whole cost of
this WP; the resolver itself is three lines.

### The extra-turn primitive — options considered

**Option A (RECOMMENDED): a `G.extraTurns` counter honored at the
`advanceTurnStage` chokepoint via `events.endTurn({ next })`.**

- Add optional `extraTurns?: Record<string, number>` to `LegendaryGameState`
  (absent by default; **not** seeded in `buildInitialGameState`).
- The resolver increments the acting player's entry:
  `G.extraTurns[currentPlayer] = (G.extraTurns[currentPlayer] ?? 0) + 1`
  (lazy-create the map first). **Increment, not set-to-1** — so stacking works
  (below).
- **There are TWO production end-turn paths, not one — both must honor the counter
  (corrected under gate review; the earlier "single chokepoint" premise was FALSE):**
  1. `advanceTurnStage` (`turn/turnLoop.ts`) — the cleanup-stage auto-end: when the
     current stage has **no successor** and `G.extraTurns?.[currentPlayer] > 0`,
     decrement (delete at 0) and call `context.events.endTurn({ next: currentPlayer })`
     instead of the bare `context.events.endTurn()`.
  2. The player-initiated **`endTurn` move** ends the turn via a **direct**
     `events.endTurn()` at `moves/coreMoves.impl.ts` (≈ line 605), which does **not**
     route through `advanceTurnStage` (game.ts documents the two coexisting end paths,
     D-22002). This call must apply the same decrement + `{ next: currentPlayer }`
     branch, or an extra turn is silently dropped on the normal end-turn — the primary
     user path (AC-2 would fail). This is the correction the pre-flight + copilot gates
     caught: honoring the counter only in `advanceTurnStage` is insufficient.
- `endTurn({ next })` still fires `onEnd` → `onBegin`, so the extra turn is a
  *normal* fresh turn — exactly "take another turn." No manual rotation; the
  `// why:` comment on the `{ next }` branch is mandatory.

Requires: widen `TurnLoopContext` to carry `currentPlayer: string` and to type
`events.endTurn` as `(opts?: { next: string }) => void`; widen `TurnLoopState`
with the optional `extraTurns` field. The `advanceTurnStage` callers pass
`ctx.currentPlayer` and forward the optional arg. **NOTE:** `coreMoves.impl.ts`'s
`endTurn` move is NOT an `advanceTurnStage` caller — it calls `events.endTurn()`
directly (see the two-path correction above); its edit is on that direct call.

**Option B: a custom `turn.order.next({ G, ctx })` in `game.ts`** returning
`currentPlayer` while its counter > 0. More "turn-model owns order" in spirit,
but it rewrites the play-phase turn config (currently default order) and the
sim/replay harnesses **still** bypass it (they rotate manually), so it carries
the *same* lockstep burden while enlarging the change surface. Rejected — buys
nothing over A.

**Option C: a bespoke boolean + manual re-seat.** Rejected outright: manual
player rotation violates the game-engine SKILL and `.claude/rules/architecture.md`
(all turn changes via `ctx.events`).

**Recommendation: Option A.** Minimal, localized to the one existing chokepoint,
uses the framework's documented primitive, stacks naturally, and the lazy-omit
field keeps every normal game byte-identical.

### Sim + replay lockstep (the primary risk)

Because these harnesses rotate the player manually (the
[[reference_simulation_harness_bypasses_bgio]] hazard), **each must independently honor
`G.extraTurns`** at its rotation point, decrementing identically to `advanceTurnStage`.
**THREE bgio-bypassing harnesses (corrected under gate review — `par.aggregator.ts` was
the missing third):**
- `simulation/simulation.runner.ts` — before the `(policyIndex + 1) % numPlayers`
  rotation, if `gameState.extraTurns?.[currentPlayer] > 0`, keep `currentPlayer` and
  decrement instead of rotating.
- `simulation/par.aggregator.ts` — the PAR competitive-scoring harness; it BOTH wraps
  `advanceTurnStage` (≈ line 425) AND does its own manual rotation
  `currentPlayer = String((policyIndex + 1) % numPlayers)` (≈ line 698). Unmirrored, it
  desyncs turn count on any extra-turn match — a determinism divergence in the scoring
  surface (this is why `sim:runtime-observed:check`, PAR-fed, would break). Must honor
  the counter at its manual rotation.
- `replay/replay.execute.ts` — its `advanceStage`/synthetic `endTurn` path must apply
  the same counter check so a replayed match with an extra turn reconstructs faithfully.
- (test parity) `test/fixtures/runFixture.ts` (≈ line 138) is also an `advanceTurnStage`
  caller — confirm it stays consistent for fixture-driven tests.

If this mirroring is skipped, a match that grants an extra turn produces one
turn-count in the live game and a different one in the sim/replay — a silent
determinism divergence. **Do not ship the resolver without both mirrors.**

### Determinism & the re-pin question (assess carefully)

`G.extraTurns` is part of the hashed `G`. Following the `handSizeOverrides` /
`lastPlayEffectsFired` lazy pattern (absent by default, never seeded, deleted at
0) means the empty-registry **`PRE_WP080`** whole-`G` oracle never creates the
key → byte-unchanged there.

**Heightened risk vs the siblings:** the recorded sentinel is **`core/dr-doom`** —
a Dr. Doom match. Unlike WP-506 (Magneto sentinel, no Magneto tactic defeated), a
Dr. Doom sentinel plausibly defeats Dr. Doom tactics. If any committed
fixture/sentinel defeats `core-mastermind-dr-doom-secrets-of-time-travel`, the
extra turn changes the **turn sequence** — and for a recorded *move-log* replay
that is **not a simple hash re-pin**: an inserted extra turn has no recorded
moves and can desync the whole replay. Therefore, at execution:
1. First **grep/verify** that no committed fixture or sentinel move-log defeats
   this specific tactic id.
2. If **none** does → assert both `finalStateHash` (sentinels) and `PRE_WP080`
   byte-identical; **no re-pin** (the target outcome).
3. If **one** does → **STOP and escalate** (`reference_hashed_g_field_dual_repin`):
   never blind-re-pin; the sentinel must be re-recorded (or the tactic excluded
   from it) as a deliberate, documented step. Aim for no re-pin; verify
   empirically before claiming it.

### Interaction notes

- **One mastermind per match**, and "Secrets of Time Travel" is one of Dr. Doom's
  four tactics, so a normal match defeats it **at most once** → a single extra
  turn. The counter still uses **increment**, so two extra-turn-granting tactics
  (a future set, or two defeated in one turn) **stack**: N queued turns taken
  consecutively, one honored per turn-end, decrement each — the natural,
  faithful reading.
- The extra turn is a full normal turn; the scheme-twist / villain-reveal cadence
  is whatever `onBegin`/`onMove` already do — **no special-casing**.
- "After this one, before play passes to the next player" is exactly
  `endTurn({ next: currentPlayer })`.

## Scope (In)

- `packages/game-engine/src/types.ts` — add optional
  `extraTurns?: Record<string, number>` to `LegendaryGameState`; **do not** seed
  it in `buildInitialGameState`.
- `packages/game-engine/src/turn/turnLoop.ts` — widen `TurnLoopContext`
  (`currentPlayer: string`; `events.endTurn: (opts?: { next: string }) => void`)
  and `TurnLoopState` (`extraTurns?`); at turn-end, honor + decrement
  `G.extraTurns[currentPlayer]` and call `endTurn({ next: currentPlayer })`,
  else the bare `endTurn()`. Mandatory `// why:` on the `{ next }` branch.
- `packages/game-engine/src/rules/tacticHandlers.ts` —
  `resolveSecretsOfTimeTravel(G, currentPlayer)` (increments the counter + logs),
  `SECRETS_OF_TIME_TRAVEL_TACTIC_ID` const, and a `dispatchTacticOnFight` branch.
- The four `advanceTurnStage` call sites pass `ctx.currentPlayer` + forward the
  optional arg: `game.ts` (KO-turn-end synthetic wrapper, ≈ line 197),
  `moves/coreMoves.impl.ts` (the `endTurn` move), `simulation/simulation.runner.ts`
  (advanceStage wrapper **and** the manual rotation), `replay/replay.execute.ts`
  (advanceStage/synthetic `endTurn`).
- `scripts/coverage/tactic-provenance.json` — one row marking the tactic
  `executable`; regenerate the effect-implementation index.
- Tests (`rules/tacticHandlers.test.ts` + `turn/turnLoop.test.ts` + a
  sim/replay-parity assertion): resolver increments (and stacks) the counter;
  `advanceTurnStage` grants the same seat another turn when the counter > 0 and
  decrements to deletion; no counter → normal rotation; the sim runner and replay
  honor the extra turn (turn-count parity with the live path); dispatch fires for
  the ext_id; an unknown id stays a silent no-op.

## Out of Scope

- Dr. Doom's other tactics — **Treasures of Latveria** (WP-691), **Dark
  Technology**, **Monarch's Decree** — and every non-core / non-Dr.-Doom tactic.
- Any client/UI surface (no pending choice; the extra turn is an ordinary turn).
- A general "take N actions" / "interrupt" primitive beyond the per-player
  turn counter; scheme/mastermind hooks reacting to "an extra turn happened."
- Card-data edits (resolver-only). No change to the default `turn.order` config
  (Option B rejected).

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/types.ts` | `+ extraTurns?: Record<string, number>` on `LegendaryGameState` (not seeded) |
| `packages/game-engine/src/turn/turnLoop.ts` | honor/decrement the counter at turn-end via `endTurn({ next })`; widen the two local interfaces |
| `packages/game-engine/src/rules/tacticHandlers.ts` | `+ resolveSecretsOfTimeTravel` + its const + a dispatch branch |
| `packages/game-engine/src/game.ts` | KO-turn-end `advanceTurnStage` call passes `ctx.currentPlayer`; synthetic `endTurn` forwards `{ next }` |
| `packages/game-engine/src/moves/coreMoves.impl.ts` | the `endTurn` move's **direct** `events.endTurn()` (≈ line 605) honors/decrements `G.extraTurns` → `events.endTurn({ next: currentPlayer })` (NOT an `advanceTurnStage` call — the corrected two-path fix) |
| `packages/game-engine/src/simulation/simulation.runner.ts` | manual rotation (`(policyIndex+1)%numPlayers`) honors `G.extraTurns` |
| `packages/game-engine/src/simulation/par.aggregator.ts` | **(added under gate review)** the PAR harness's `advanceTurnStage` wrapper (≈425) + manual rotation (≈698) honor `G.extraTurns` — else the competitive-scoring surface desyncs on any extra-turn match |
| `packages/game-engine/src/replay/replay.execute.ts` | advanceStage/synthetic `endTurn` honors `G.extraTurns` |
| `packages/game-engine/src/test/fixtures/runFixture.ts` | (test-only) a FOURTH manual-rotation harness — its own `rotateToNextTurn` (≈L281) + synthetic `endTurn` that ignores args (≈L213); honor `G.extraTurns` if any fixture test exercises an extra turn (low severity — feeds no CI/scoring surface) |
| `packages/game-engine/src/turn/turnLoop.test.ts` | counter grant/decrement/normal-rotation assertions |
| `packages/game-engine/src/rules/tacticHandlers.test.ts` | resolver-increment/stack + dispatch + unknown-id assertions |
| `scripts/coverage/tactic-provenance.json` | one `executable` row for the tactic |

Governance (not counted in the code allowlist, **NOT edited by this draft**;
land at execution): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24513 flips Active), `NUMBER-LEDGER.md` (already reserved).

## Non-Negotiable Constraints

- All turn changes go through `ctx.events.endTurn()` **only** — never manually
  rotate `ctx.currentPlayer`; every `endTurn` call (bare or `{ next }`) carries a
  `// why:` comment (game-engine SKILL / `.claude/rules/architecture.md`).
- Moves never throw; `dispatchTacticOnFight` stays a silent no-op for any
  unhandled id. The resolver mutates `G` directly; never throws.
- Deterministic: no `Math.random`, no wall-clock, no I/O, no `ctx.random.*`
  (nothing here reveals or shuffles). Replay-identical given setup + moves.
- `G.extraTurns` is **absent by default** and **never seeded** in
  `buildInitialGameState`; decrement-to-delete so a spent counter leaves no key.
- No `.reduce()` in the counter logic; no `boardgame.io` import in
  `tacticHandlers.ts` / `turnLoop.ts` (`ctx` narrowed via `unknown` / the local
  `TurnLoopContext`, as today).
- The sim runner and replay harness **must** honor `G.extraTurns` at their manual
  rotation points, decrementing identically to `advanceTurnStage` — no
  live-vs-sim turn-count divergence.
- Log prefix uses the `tacticHandlers.ts` `Fight effect: …` prose convention.

**Engine-wide (standing) constraints.** Honor `.claude/rules/code-style.md` +
`docs/ai/REFERENCE/00.6-code-style.md` (human-style, junior-readable; full
English names; every function JSDoc'd; `// why:` on non-obvious constants);
ESM-only with `node:`-prefixed built-ins; `.test.ts` on `node:test`; Node v22+.
Work from full file contents, output complete files.

## Contract

- **`resolveSecretsOfTimeTravel(G: LegendaryGameState, currentPlayer: string):
  void`** — lazy-creates `G.extraTurns` and increments `G.extraTurns[currentPlayer]`
  by 1 (stacking); logs one `Fight effect:` line. Never throws.
- **Dispatch** — on defeat of `core-mastermind-dr-doom-secrets-of-time-travel`,
  `dispatchTacticOnFight` calls `resolveSecretsOfTimeTravel(G, currentPlayer)`.
- **`advanceTurnStage`** — at the last turn stage, when
  `G.extraTurns?.[currentPlayer] > 0`, decrements (deleting at 0) and calls
  `context.events.endTurn({ next: currentPlayer })`; otherwise the bare
  `context.events.endTurn()`. The sim runner and replay harness apply the same
  counter check at their manual rotation points.

## Vision Alignment

- **§1 Rules Authenticity** — implements printed tactic text currently inert.
- **§3 Player Trust & Fairness** — deterministic, replay-faithful; the extra turn
  is a full normal turn, no hidden advantage.
- **NG-1 no pay-to-win** — not crossed; no monetization / PvP / identity surface.
- **Determinism preserved (§8 / §22)** — no `ctx.random.*`, no wall-clock, no I/O;
  the one new state is a lazy per-player counter that replays identically. Re-pin
  is *not expected* under the lazy-omit pattern **provided** no committed fixture
  defeats this tactic — verified at execution; drift STOPs (never blind-re-pin).

## Acceptance Criteria

1. Defeating `core-mastermind-dr-doom-secrets-of-time-travel` invokes
   `resolveSecretsOfTimeTravel` on the defeating `ctx.currentPlayer` and
   increments `G.extraTurns[currentPlayer]` to 1.
2. At that player's turn-end, `advanceTurnStage` calls
   `events.endTurn({ next: currentPlayer })`, the counter decrements to 0 (key
   deleted), and the same seat begins a fresh turn (new `onBegin`: hand filled,
   economy reset, allowances reset).
3. With no counter set, `advanceTurnStage` ends the turn with the bare
   `endTurn()` and boardgame.io rotates normally (regression-safe).
4. Two increments in one turn (stacking) grant **two** consecutive extra turns,
   the counter draining one per turn-end.
5. The simulation runner and the replay executor produce the **same turn count**
   for a match that grants an extra turn as the live boardgame.io path (harness
   parity) — no divergence.
6. An unknown/unimplemented tactic id remains a silent no-op (unchanged from
   WP-497).
7. Determinism: full engine suite green; sentinel `finalStateHash` +
   `PRE_WP080_HASH` **byte-identical** *iff* no committed fixture defeats this
   tactic (verified) — any drift STOPs execution and is escalated, not re-pinned.
8. `scripts/coverage/tactic-provenance.json` marks the tactic `executable` and
   `pnpm effect-index:check` is current after regeneration.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all green; note the pass
   delta.
3. Control check: temporarily stub `resolveSecretsOfTimeTravel` to a no-op → the
   extra-turn grant + stacking + harness-parity assertions FAIL (non-vacuous);
   restore.
4. Grep the fixtures/sentinels for `secrets-of-time-travel`; confirm none defeats
   it. Confirm sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged (sweep +
   full run); `pnpm sim:runtime-observed:check` current with no regeneration.
5. `pnpm effect-index:check` current after regenerating the tactic coverage;
   `pnpm cards:check` reproducible (no card edits).
6. `pnpm -r build` → 0.
7. `git diff --name-only` = the file allowlist + governance only.
8. **Live-verify (operator-pending, post-deploy):** on
   `play.legendary-arena.com`, defeat Dr. Doom's "Secrets of Time Travel" tactic
   → the defeating player immediately takes another full turn, then play
   advances; the log shows the Fight line.

## Definition of Done

- [ ] All Acceptance Criteria met; engine suite green (pass delta recorded).
- [ ] Sim + replay honor `G.extraTurns` (harness-parity test green).
- [ ] Sentinel + `PRE_WP080` hashes byte-identical (or drift diagnosed +
      escalated — **not** blind-re-pinned; not expected).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `effect-index:check` + `sim:runtime-observed:check`
      current; `cards:check` reproducible.
- [ ] D-24513 flipped Active; WORK_INDEX row → `[x]`; EC_INDEX → `Done`; roadmap
      mindmap `📝`→`✅`; `roadmap:counts:check` 0; `docs/ai/STATUS.md` close-out.
- [ ] Two-commit topology (EC-733 impl + SPEC close).
- [ ] Live-verify performed or explicitly operator-pending.

## Reserved Decision (lands at execution)

**D-24513** — The extra-turn primitive + Dr. Doom "Secrets of Time Travel"
resolution: a deterministic optional `G.extraTurns: Record<playerID, number>`
counter, incremented (stacking) by `resolveSecretsOfTimeTravel` when the tactic
is defeated and honored at the single `advanceTurnStage` turn-end chokepoint via
boardgame.io `events.endTurn({ next: currentPlayer })` (never manual rotation),
decrement-to-delete, mirrored identically in the sim runner and replay executor
(which bypass boardgame.io). Lazy/omit-when-zero (never seeded in
`buildInitialGameState`) so normal games stay hash-byte-identical. This is the
arc's foundational novel mechanic that any future extra-turn effect reuses. See
DECISIONS.md.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS (all required WP sections, in order).
- **§2 Non-Negotiable Constraints** — PASS (explicit block; standing engine rules cited).
- **§3 Assumes** — PASS (WP-497 hard dep; turn model, `endTurn({next})`, lazy-hash pattern, and the sim/replay-bypass each cite their locking source).
- **§4 Context** — PASS (`## Context (Read First)` spells out the primitive options + recommendation, the sim/replay lockstep, and the re-pin analysis).
- **§5 Files Expected to Change** — PASS (closed allowlist + governance called out as not-edited-by-draft).
- **§6 Naming Consistency** — PASS (`extraTurns`, `advanceTurnStage`, `dispatchTacticOnFight`, tactic ext_id grammar, `cardTraits` untouched).
- **§7 Dependency Discipline** — PASS (WP-497 landed; no other unmet dep).
- **§8 Architectural Boundaries** — PASS (game-engine only; no `boardgame.io`/registry import in the pure helpers; `ctx` via `unknown`/`TurnLoopContext`; no `.reduce()`; turn changes via `ctx.events` only).
- **§9 Windows Compatibility** — N/A (no shell/path work).
- **§10 Env Var Hygiene** — N/A.
- **§11 Authentication Clarity** — N/A.
- **§12 Test Quality** — PASS (`node:test`, `.test.ts`; non-vacuous control-stub; explicit harness-parity assertion).
- **§13 Commands & Verification** — PASS (runnable Verification Steps incl. the fixture grep).
- **§14 Acceptance Criteria Quality** — PASS (8 testable, non-vacuous ACs incl. stacking + harness parity).
- **§15 Definition of Done** — PASS (binary gates incl. hash byte-identity + escalation clause + two-commit topology).
- **§16 Code Style** — PASS (human-style, JSDoc, `// why:` on the `{ next }` branch + the new const).
- **§17 Vision Alignment** — PASS (§1/§3, NG-1, determinism §8/§22).
- **§18 Prose-vs-Grep Discipline** — PASS (no verification-grep token reused as prose).
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline `origin/main` @ `de1da518`; the WP-691..696/EC-728..733/D-24508..24513 reservation is that commit).
- **§20 Funding Surface Gate** — N/A (no pricing/checkout/account surface).
- **§21 API Catalog Update** — N/A (no `apps/server` endpoint or `Library-only` export change).

**Determinism / turn-model risk (explicit).** This packet is the arc's only
turn-model change and its only new hashed `G` field. The two named hazards are
(1) the sim/replay harnesses bypass boardgame.io and must independently honor
`G.extraTurns`, and (2) the `core/dr-doom` sentinel is a Dr. Doom match, so the
re-pin question is live in a way the siblings' was not — a fixture that defeats
this tactic desyncs a recorded replay, which is an escalation, not a re-pin.
Both are surfaced in Context, the Constraints, the ACs, and the DoD.

Pre-flight verdict: **READY TO EXECUTE** once WP-497 is on `main` (it is) and the
executor confirms the two determinism hazards empirically at execution.
