# WP-409 — Hero-Play Synergy-Effect Count → UIState (the tiered combo-cue signal)

**Status:** Ready
**Primary Layer:** Game Engine (engine tally + `UIState` projection; the only cross-package touch is an arena-client UIState **fixture backfill**, not a runtime layer crossing)
**Dependencies:** WP-295 / D-24082 (the observability-only, hash-excluded `G` mutation precedent), D-24081 / D-24114 (the `finalStateHash` observability-exclusion mechanism), WP-200 (`UIState` + the villain `appliedEffects` accumulator this mirrors). All landed on `main`.
**User-Visible Surface:** `none — infrastructure` (the engine signal has **no consumer yet**; the client combo-cue audio that reads it is a separate, future WP — see Out of Scope)

> Baseline: `origin/main` at commit `44703314` (SPEC audio-design wiki, PR #891).

---

## Session Context

The ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/)
design reference (PR #891) specs a **tiered combo / synergy cue** — an
escalating audio sting that gets bigger the more a hero play does. That
page also records the honest blocker: **nothing the client can observe
carries a "how much did this play do" count.** The five/six locked
`NotableGameEvent` variants and `playCard` project no per-play effect
tally; the villain side already exposes `FightResolvedEvent.appliedEffects`,
but the hero side has no analog. This WP builds **only that missing engine
signal** — a deterministic per-play count of the hero effects that fired,
projected onto `UIState` — so the future client audio layer has something
real to fire on. The audio playback itself is explicitly out of scope
(the whole client audio layer is unscoped; the operator chose "engine
signal only" so a tested, buildable increment lands now rather than a
blocked full-feature WP).

**Engine reality that shapes the contract (verified this session):** a
hero card play does **not** re-fire other cards' hooks — there is no
re-entrant cascade. `executeHeroEffects` iterates the hooks of the
just-played card only. "Synergy" is realized as **conditional gating**
(`heroClassMatch`/`[hc:X]`, `requiresTeam`, `requiresKeyword`,
`distinctHeroClassesAtLeast` in `heroConditions.evaluate.ts`): a
synergy-gated hook *unlocks* and fires because other cards are already in
play. So the honest, countable signal is **the number of hero effects
that fire for a play** — a synergy-unlocked hook adds to the count. The
field is named for that reality (`lastPlayEffectsFired`), not the
"cascade" mental model.

---

## Goal

After this session, every hero card play records a deterministic count of
the hero-ability effects that **fired** for that play, and that count is
projected as a public scalar on `UIState`. Concretely: `executeHeroEffects`
returns the number of effects that reached their handler; `applyCardPlay`
stores it on a transient `G.lastPlayEffectsFired` (covering both `playCard`
and `playFromUndercover`); the play-phase `onBegin` hook resets it; and
`UIState.game.lastPlayEffectsFired` projects it publicly. The count is
**observability-only** — no rule, move, or endgame reads it — so it is
**excluded from the `finalStateHash` oracle** (the D-24081 `messages`
mechanism), leaving every recorded sentinel/golden `finalStateHash`
byte-unchanged (no re-pin). No gameplay, no client audio, no new
`NotableGameEvent` variant.

---

## User-Visible Impact

**None this session — infrastructure only.** This WP projects a number
that nothing currently consumes; a player sees no change. It exists to
unblock the future tiered combo-cue WP (client audio), which is where the
user-visible payoff lands. `docs/ai/STATUS.md` must state "No
user-observable change — infrastructure only" so the run is not read as
visible progress (D-24026 inversion for `none — infrastructure`).

---

## Assumes

- `packages/game-engine/src/moves/coreMoves.impl.ts` exports `applyCardPlay`
  (the shared core for `playCard` and `playFromUndercover`), which already
  calls `executeHeroEffects(G, context, playerID, cardId)` as its final
  effect step.
- `packages/game-engine/src/hero/heroEffects.execute.ts` exports
  `executeHeroEffects` (currently returns `void`), which iterates
  `getHooksForCard(...)`, gates each hook on
  `evaluateAllConditions(...)`, then runs `executeSingleEffect(...)` per
  `hook.effects` and `interpretHeroPrimitiveEffect(...)` per
  `hook.primitiveEffects`.
- `packages/game-engine/src/villain/villainEffects.execute.ts` already
  returns `VillainEffectResult[]` (the accumulator pattern this WP mirrors
  on the hero side).
- `packages/game-engine/src/types.ts` defines `LegendaryGameState` and
  already carries optional per-turn transient flags (`hasDrawnThisTurn?`,
  `hasActedThisTurn?`, `hasHealedThisTurn?`).
- `packages/game-engine/src/game.ts` resets those transient flags (and
  `G.turnEconomy`) in the **play-phase `onBegin`** hook.
- `packages/game-engine/src/ui/uiState.types.ts` defines the public
  `UIState.game` block (`hasActedThisTurn`, `hasHealedThisTurn`, …, no
  audience redaction), built in `uiState.build.ts`; the block is pinned
  by `uiState.types.drift.test.ts`.
- `packages/game-engine/src/test/fixtures/hashGameState.ts` computes the
  `finalStateHash` oracle and already excludes `messages` + `logMeta` via
  a rest-destructure (D-24081 / D-24114); `notableEvents` is deliberately
  kept in the hash.
- `pnpm -r build` exits 0; engine + arena-client suites + arena-client
  `typecheck` pass on `44703314`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `packages/game-engine/src/moves/coreMoves.impl.ts` — `applyCardPlay`
  (the `executeHeroEffects(...)` call is the final effect step; the return
  is captured here) and both callers (`playCard`, `playFromUndercover`).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `executeHeroEffects`
  (the hook loop, the `evaluateAllConditions` gate that `continue`s on
  fail, the `executeSingleEffect` / `interpretHeroPrimitiveEffect` calls),
  and `executeSingleEffect` (the `MVP_KEYWORDS` + magnitude safe-skip
  gates **before** the `HERO_EFFECT_HANDLERS[keyword]` dispatch — an effect
  that safe-skips did **not** fire and is not counted).
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts` —
  `interpretHeroPrimitiveEffect` (each top-level primitive effect that
  runs counts as one fired effect).
- `packages/game-engine/src/villain/villainEffects.execute.ts` — the
  `VillainEffectResult[]` accumulator + `appliedEffects` mapping: the
  exact hero-side analog to mirror.
- `packages/game-engine/src/types.ts` — the `hasHealedThisTurn?` optional
  transient flag (the field-shape precedent for `lastPlayEffectsFired?`).
- `packages/game-engine/src/game.ts` — the play-phase `onBegin` reset
  block (add the new field's reset alongside the existing flags).
- `packages/game-engine/src/ui/uiState.types.ts` + `uiState.build.ts` —
  the public `game` block (`hasActedThisTurn` is the projection precedent;
  public, no `uiState.filter.ts` redaction).
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — the
  `game`-block field pin (add `lastPlayEffectsFired`).
- `packages/game-engine/src/test/fixtures/hashGameState.ts` — the
  `messages`/`logMeta` exclusion rest-destructure (D-24081); add
  `lastPlayEffectsFired` to it.
- `packages/game-engine/src/replay/replay.hash.ts` +
  `replay/replay.execute.test.ts` — `computeStateHash` (djb2, whole-`G`,
  determinism harness) and any `PRE_WP080_HASH` pin. **Confirm which
  oracle each hash gate uses**: the `finalStateHash` sentinel uses
  `hashGameState.ts` (excludable); a whole-`G` `computeStateHash` gate
  would still see the new field. Resolve the treatment for BOTH before
  claiming "no re-pin" (see the determinism note in Vision Alignment).
- `docs/ai/DECISIONS.md` — D-24081 / D-24114 (`finalStateHash`
  observability exclusion), D-24082 (WP-295 observability-only `G`
  mutation narrowing), and the reserved D-24221 at the tail of this WP.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations),
  Rule 6 (`// why:`), Rule 13 (ESM).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — the count is a pure tally over hook/effect
  iteration; effects consume `ctx.random.*`, but *how many* fired is a
  pure function of `G`.
- Moves never throw — the count capture is a plain numeric assignment.
- Never persist `G`/`ctx`; `G` stays JSON-serializable — the field is a
  plain `number`.
- `.reduce()` is forbidden in effect application — accumulate the tally
  with an explicit `for` / `for...of` loop counter.
- ESM only, Node v22+; `node:` prefix on Node built-ins; test files `.test.ts`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Count semantics (locked):** `lastPlayEffectsFired` = the number of
  hero-ability effects that **fired** for the just-played card — each
  `executeSingleEffect` call that reached its `HERO_EFFECT_HANDLERS`
  dispatch **plus** each top-level primitive effect
  `interpretHeroPrimitiveEffect` ran. An effect skipped by an unmet
  synergy condition (`evaluateAllConditions` false → the hook `continue`s)
  or by a safe `MVP_KEYWORDS` / magnitude gate is **not** counted. A play
  whose card has no hooks — or whose only hooks fail their conditions —
  yields **0**.
- **Accumulator, not `.reduce()`:** mirror the villain `VillainEffectResult[]`
  pattern — `executeSingleEffect` / `interpretHeroPrimitiveEffect` signal
  fired/not-fired; `executeHeroEffects` tallies and returns a `number`.
- **Capture site:** `applyCardPlay` assigns the returned count to
  `G.lastPlayEffectsFired`. This is the single place per play the count is
  known, and it covers `playCard` and `playFromUndercover` in one edit.
- **Reset site:** the play-phase `onBegin` hook clears the field
  (to `0`), alongside the existing per-turn transient resets. Per play it
  is overwritten; per turn it starts clean.
- **Projection is public:** `UIState.game.lastPlayEffectsFired: number` —
  no audience redaction (played cards are face-up; the count is not
  secret). No `uiState.filter.ts` change.
- **Observability-only ⇒ hash-excluded (D-24221):** nothing in any rule,
  move, phase, or endgame reads `G.lastPlayEffectsFired`. It is excluded
  from the `finalStateHash` oracle (`hashGameState.ts`, the D-24081
  `messages` mechanism) so every recorded sentinel/golden `finalStateHash`
  stays **byte-unchanged** — **no re-pin**. If a whole-`G` determinism
  gate (`computeStateHash` / `PRE_WP080_HASH`) includes the field, apply
  the matching exclusion **or** re-pin that oracle deliberately with the
  reason recorded (dual-oracle hazard per `reference_hashed_g_field_dual_repin`).
- **No new `NotableGameEvent` variant.** The heavyweight event-stream path
  (drift arrays, `notableEvents`-in-hash re-pin, arena-client overlay
  backfill, a D-20001 gate) is explicitly rejected in favor of the UIState
  scalar.

**Session protocol:**
- If any contract or field name is unclear, stop and ask — never guess.

**Locked contract values (do not re-derive):**
- **Transient field:** `G.lastPlayEffectsFired?: number` (optional on
  `LegendaryGameState`).
- **Projected field:** `UIState.game.lastPlayEffectsFired: number` (public).
- **Reset value:** `0`, in the play-phase `onBegin` hook.
- **Return type change:** `executeHeroEffects(...) : void → number`.
- **Not counted:** condition-gated skips and safe `MVP_KEYWORDS`/magnitude
  skips.

---

## Debuggability & Diagnostics

- The count is deterministic and unit-observable: a crafted hero card with
  a known hook set produces a known `lastPlayEffectsFired`; a synergy-gated
  hook contributes only when its condition is met.
- No new state mutation beyond the single numeric assignment and its reset;
  `G` stays JSON-serializable.
- The value is reproducible on replay (the reducer re-runs `applyCardPlay`),
  independent of the hash-exclusion (exclusion affects only the oracle, not
  reproduction).

---

## Scope (In)

### A) Engine — the transient field (`packages/game-engine/src/types.ts`, **modified**)
- Add `lastPlayEffectsFired?: number` to `LegendaryGameState`, JSDoc'd as
  an **observability-only, per-turn transient** (the count of hero effects
  that fired for the most recent play this turn; reset each turn; excluded
  from `finalStateHash`). Mirror the `hasHealedThisTurn?` field shape.

### B) Engine — the tally (`packages/game-engine/src/hero/heroEffects.execute.ts`, **modified**)
- Widen `executeHeroEffects(...)` from `void` to `number`: count the
  effects that fired (per the locked semantics) and return the total.
- Have `executeSingleEffect(...)` signal whether it reached its handler
  (return a boolean, or otherwise report fired-status) so the tally
  excludes safe-skips. Use an explicit loop counter — no `.reduce()`.
- `// why:` on the count — observability signal for the future combo cue,
  effects-fired (not a cascade), condition/safe skips excluded.

### C) Engine — primitive-effect fired-signal (`packages/game-engine/src/hero/effectPrimitive.interpret.ts`, **modified**)
- Have `interpretHeroPrimitiveEffect(...)` report that a top-level
  primitive effect ran (a `boolean`/count), so `executeHeroEffects` adds
  it to the tally. Keep the never-persisted `EffectExecutionContext`
  behavior unchanged.

### D) Engine — capture in the move (`packages/game-engine/src/moves/coreMoves.impl.ts`, **modified**)
- In `applyCardPlay`, assign the `executeHeroEffects(...)` return to
  `G.lastPlayEffectsFired`. One edit; covers both play moves.

### E) Engine — reset (`packages/game-engine/src/game.ts`, **modified**)
- In the play-phase `onBegin` hook, set `G.lastPlayEffectsFired = 0`
  alongside the existing transient-flag resets. `// why:` (per-turn
  transient; a fresh turn starts at 0 before any play).

### F) Engine — projection (`packages/game-engine/src/ui/uiState.types.ts` + `uiState.build.ts`, **modified**)
- Add `lastPlayEffectsFired: number` to the public `UIState.game` block
  type; project `G.lastPlayEffectsFired ?? 0` in `uiState.build.ts`. No
  `uiState.filter.ts` change (public).

### G) Engine — hash exclusion (`packages/game-engine/src/test/fixtures/hashGameState.ts`, **modified**)
- Add `lastPlayEffectsFired` to the rest-destructure that already excludes
  `messages` / `logMeta`. `// why:` (observability-only, D-24221; keeps
  every recorded sentinel `finalStateHash` byte-unchanged).

### H) Engine tests
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified**:
  a play with N firing effects returns/sets N; a condition-failed hook
  contributes 0; a no-hook card yields 0; a safe-skipped effect is not
  counted.
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified**:
  pin `lastPlayEffectsFired` on the `game` block.
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** (if a
  `game`-block projection test exists): assert `lastPlayEffectsFired`
  projects from `G`.
- Confirm the sentinel/golden `finalStateHash` fixtures are **unchanged**
  (the exclusion holds).

### I) Client — UIState fixture backfill (`apps/arena-client/**` UIState fixtures, **modified**)
- Backfill `game.lastPlayEffectsFired` in the arena-client UIState test
  fixtures/factories so `vue-tsc` stays green (required-field add;
  precedent: `project_arena_client_uistate_backfill_recurrence`). Exact
  fixture files identified by the executor via `pnpm --filter arena-client
  typecheck`. **No arena-client runtime/audio change** — fixtures only.

---

## Out of Scope

- **No client audio / no combo cue playback.** The tiered sting, the
  tier→count mapping, howler.js wiring, and the whole client audio layer
  are a **separate future WP**; this WP ships only the engine signal.
- **No new `NotableGameEvent` variant** and **no `notableEvents` change** —
  the UIState scalar is the deliberate lighter path.
- **No gameplay change.** Hook execution, condition evaluation, effect
  handlers, and outcomes are untouched — the tally only *observes* them.
- **No villain-side change.** `appliedEffects` already exists; this WP does
  not touch the villain executor.
- **No cross-card cascade / re-entrant triggering.** The engine has none;
  this WP does not add one (it would be a gameplay change).
- **No audience-redacted variant.** The count is public; no
  `uiState.filter.ts` work.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/types.ts` — **modified** — `lastPlayEffectsFired?: number`
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — tally + `void → number`
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts` — **modified** — primitive fired-signal
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — capture into `G`
- `packages/game-engine/src/game.ts` — **modified** — reset in play-phase `onBegin`
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `game.lastPlayEffectsFired`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — project the field
- `packages/game-engine/src/test/fixtures/hashGameState.ts` — **modified** — hash exclusion (D-24221)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — count assertions
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — pin the field
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified (if present)** — projection assertion
- `apps/arena-client/**` UIState test fixtures — **modified** — backfill `game.lastPlayEffectsFired`

No other files may be modified. (The executor may add one same-layer
runtime-wiring exception only per `01.5`, recorded in the EC.)

---

## Vision Alignment

N/A on the §17.1 trigger surfaces: no scoring/PAR/leaderboards, no
identity, no multiplayer sync, no card-data/content-semantics change, no
monetization. **Determinism note (load-bearing):** `G.lastPlayEffectsFired`
is a deterministic pure tally, but a new top-level `G` field is included in
the `finalStateHash` oracle **by default** and would churn the recorded
sentinel/golden fixtures. Because the field is **observability-only**
(nothing reads it for rules — the same class as `G.messages`, D-24081 /
D-24082), it is excluded from `hashGameState.ts`, keeping every recorded
`finalStateHash` byte-unchanged (**no re-pin**). The **dual-oracle hazard**
(`reference_hashed_g_field_dual_repin`): if the whole-`G` `computeStateHash`
/ `PRE_WP080_HASH` determinism gate includes the field, the executor must
apply the matching exclusion or deliberately re-pin that oracle with the
reason recorded — this is called out in Context and the AC. NG-1..7
preserved (an observability count for a future cosmetic cue; no
pay-to-win, no PvP).

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy. An engine
observability signal.

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only`
function; the value flows over the boardgame.io state push (`UIState`),
not the HTTP surface.

---

## Acceptance Criteria

All items are binary pass/fail.

### Engine
- [ ] `LegendaryGameState` has `lastPlayEffectsFired?: number` (optional
      transient); `G` stays JSON-serializable.
- [ ] `executeHeroEffects(...)` returns the count of effects that fired
      per the locked semantics; `applyCardPlay` assigns it to
      `G.lastPlayEffectsFired` for both `playCard` and `playFromUndercover`.
- [ ] Unit tests prove: N firing effects ⇒ count N; a condition-failed
      hook contributes 0; a no-hook card ⇒ 0; a safe-skipped effect is not
      counted.
- [ ] The play-phase `onBegin` hook resets `G.lastPlayEffectsFired` to `0`.
- [ ] `UIState.game.lastPlayEffectsFired: number` projects `G.lastPlayEffectsFired ?? 0`;
      the drift test pins it; no `uiState.filter.ts` redaction.
- [ ] `lastPlayEffectsFired` is excluded from `hashGameState.ts`; every
      recorded sentinel/golden `finalStateHash` is **unchanged (no re-pin)**.
- [ ] The whole-`G` determinism gate (`computeStateHash` / `PRE_WP080_HASH`)
      is verified: either unaffected, matched-exclusion, or deliberately
      re-pinned with the reason recorded — never a silent shift.

### Client
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0 (fixtures
      backfilled); `pnpm --filter arena-client test` passes. No
      arena-client runtime/audio change.

### Build / scope
- [ ] `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified
      (`git diff --name-only`), save an `01.5` wiring exception recorded in
      the EC.

---

## Verification Steps

```pwsh
# Step 1 — build everything (packages before dependent apps)
pnpm -r build
# Expected: exits 0

# Step 2 — engine tests (tally + projection + NO finalStateHash re-pin)
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; every sentinel/golden finalStateHash unchanged

# Step 3 — client typecheck + tests (fixture backfill only)
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass

# Step 4 — confirm the capture is a single assignment in applyCardPlay
Select-String -Path "packages\game-engine\src\moves\coreMoves.impl.ts" -Pattern "lastPlayEffectsFired"
# Expected: the assignment from the executeHeroEffects return

# Step 5 — confirm the hash exclusion is present
Select-String -Path "packages\game-engine\src\test\fixtures\hashGameState.ts" -Pattern "lastPlayEffectsFired"
# Expected: one match, inside the exclusion rest-destructure

# Step 6 — scope check
git diff --name-only
# Expected: only files in ## Files Expected to Change (+ any recorded 01.5 wiring file)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0.
- [ ] Engine + client suites pass; every recorded sentinel/golden
      `finalStateHash` unchanged (or the whole-`G` oracle deliberately
      re-pinned with the reason recorded).
- [ ] No files outside `## Files Expected to Change` were modified
      (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — **"No user-observable change —
      infrastructure only"** (D-24026 inversion; the signal has no consumer
      yet).
- [ ] `docs/ai/DECISIONS.md` updated — land **D-24221** as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-409 checked off with
      today's date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — the WP-409 node's glyph moved
      `📝 → ✅`, then `pnpm roadmap:counts:write`; `pnpm
      roadmap:counts:check` exits 0.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `Out of Scope`
  lists ≥2 excluded items (client audio, new notableEvent, cascade,
  villain, redaction).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session
  protocol + locked values; references 00.6.
- **§3 Assumes** — PASS. Exact exports/paths (`applyCardPlay`,
  `executeHeroEffects`, the villain accumulator, the `onBegin` reset,
  `hashGameState.ts` exclusion) + green baseline `44703314`.
- **§4 Context (Read First)** — PASS. Specific files + the villain-executor
  template + the dual-oracle hazard + 00.6. No `00.2` reference: no
  card-data shape or setup field changes (a runtime observability count,
  not a `00.2` contract).
- **§5 Files** — PASS. ~12 files, single layer (engine) + an arena-client
  fixture-only backfill; a genuinely small signal WP.
- **§6 Naming** — PASS. `lastPlayEffectsFired`, `executeHeroEffects`,
  `interpretHeroPrimitiveEffect`; no abbreviations.
- **§7 Dependency discipline** — PASS. No new npm dependency.
- **§8 Architectural boundaries** — PASS. Engine tallies + projects;
  arena-client only backfills consuming fixtures (no new engine→client
  runtime import; the projection is the already-typed `UIState`).
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. Engine `node:test`; arena-client `typecheck` +
  `node:test`; no `boardgame.io/testing`.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output;
  the client `typecheck` gate is explicit.
- **§14 Acceptance criteria** — PASS. Binary, grouped, observable.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap +
  scope check; `User-Visible Surface = none — infrastructure` ⇒ the
  D-24026 gate **inverts** to the STATUS "no user-observable change"
  statement (no live-surface check).
- **§16 Code style** — PASS. Explicit loop counter (no `.reduce()`),
  `// why:` on the count/reset/exclusion, no abbreviations.
- **§17 Vision Alignment** — N/A (declared) + the required determinism
  note: observability-only ⇒ `finalStateHash`-excluded (no re-pin); the
  dual-oracle hazard is called out.
- **§18 Prose-vs-grep** — PASS. Verification Steps 4/5 grep source files
  (`coreMoves.impl.ts`, `hashGameState.ts`) for `lastPlayEffectsFired`;
  the WP prose that names the token is out of those greps' file scope.
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing
  artifact.
- **§20 Funding Surface Gate** — N/A. No funding affordance/channel/copy.
- **§21 API Catalog** — N/A. No HTTP endpoint / `apps/server/src/**`
  library function; the value flows over the boardgame.io state push.

**Lint verdict: PASS (all 21 resolved; 8 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

> Recorded at drafting; the executing session re-confirms against its own
> baseline before implementing.

**Verdict: READY TO EXECUTE (2026-07-21).**

- **Sequencing / dependencies:** every surface this touches is on `main`
  (`applyCardPlay`, `executeHeroEffects`, the villain accumulator, the
  `onBegin` reset, the public `UIState.game` block, the `hashGameState.ts`
  exclusion). No blocking hard-dep WP; the client audio consumer is
  explicitly out of scope.
- **Green baseline:** `main @ 44703314`.
- **Scope lock:** the `Files Expected to Change` allowlist is closed;
  `git diff --name-only` is a DoD gate.
- **Contract fidelity:** the count mirrors the villain `VillainEffectResult[]`
  accumulator; the field mirrors `hasHealedThisTurn?`; the projection
  mirrors `hasActedThisTurn`; the hash exclusion mirrors `messages`
  (D-24081).
- **RS-1 (clarification, non-blocking):** the count granularity is locked
  to effects-fired; if scaffolding shows `executeSingleEffect` /
  `interpretHeroPrimitiveEffect` cannot cheaply report fired-status, the
  executor may fall back to hook-level counting **only** by recording it
  as an inline EC amendment (semantic change → re-confirm the AC).
- **PS-1 (blocking → resolve at execution, not draft):** the dual-oracle
  hash treatment (`computeStateHash` / `PRE_WP080_HASH`) must be verified
  by the scaffold run before close; the AC gates it.

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (2026-07-21).** Small, additive,
well-precedented (the hero-side mirror of the villain `appliedEffects`
accumulator + the D-24081 observability-exclusion pattern), single engine
layer, no gameplay or determinism-semantics risk.

Selected findings:
- **#2 (determinism)** — PASS with a named watch-item: the field is
  observability-only and excluded from `finalStateHash`; the AC forces the
  executor to verify the whole-`G` oracle (`computeStateHash` /
  `PRE_WP080_HASH`) and never accept a silent shift.
- **#4 (contract drift)** — PASS. The new `UIState.game` field is pinned by
  `uiState.types.drift.test.ts`; no drift-array (`NOTABLE_EVENT_TYPES`)
  churn because the notableEvent path is deliberately avoided.
- **#1 / #9 (layer boundary)** — PASS. Engine computes + projects;
  arena-client backfills consuming fixtures only.
- **#12 (scope creep)** — PASS. Closed allowlist + `git diff --name-only`
  gate + the "no cascade / no gameplay" Out-of-Scope lock.
- **#26 (implicit content semantics)** — PASS. The count is a mechanical
  tally, not card-data; no `00.2` contract touched.

**Disposition: CONFIRM** — session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24221 (reserved; Drafted 2026-07-21, not yet landed)** — Hero card
  plays record a deterministic **observability-only** count,
  `G.lastPlayEffectsFired`, of the hero-ability effects that fired for the
  most recent play (each `executeSingleEffect` that reached its handler +
  each top-level `interpretHeroPrimitiveEffect` that ran; condition-gated
  and safe-skip effects excluded). It is a per-turn transient (reset to `0`
  in the play-phase `onBegin`), set by `applyCardPlay` from the widened
  `executeHeroEffects` return, and projected **publicly** as
  `UIState.game.lastPlayEffectsFired`. Because nothing reads it for rules
  it is **excluded from the `finalStateHash` oracle** (`hashGameState.ts`,
  the D-24081 `messages` mechanism), so recorded sentinel/golden hashes are
  byte-unchanged (no re-pin); the whole-`G` `computeStateHash` oracle is
  handled with a matching exclusion or a deliberate, reasoned re-pin. It
  exists to unblock the future client **tiered combo / synergy cue** (the
  ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/)
  signal gap); no new `NotableGameEvent` variant is added.

---

## See Also

- [WP-295](WP-295-effect-observability-logging.md) / D-24082 — the
  observability-only, hash-excluded `G` mutation precedent.
- [WP-200](WP-200-notable-game-event-log.md) / D-20008 — `UIState` + the
  villain `appliedEffects` accumulator this mirrors.
- `docs/ai/DECISIONS.md` — D-24081 / D-24114 (`finalStateHash`
  observability exclusion), the reserved D-24221 above.
- ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/)
  §"Tiered combo / synergy cue" — the consumer design + the signal gap
  this WP closes (PR #891).
