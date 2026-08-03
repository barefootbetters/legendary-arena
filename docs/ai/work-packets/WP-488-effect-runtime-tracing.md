# WP-488 — Runtime Effect Tracing (`G.diagnostics.traces`)

**Status:** Draft 2026-08-02 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `none — infrastructure` (a runtime-only, hash-excluded engine diagnostic; no player-facing or client surface. Wiring a trace into Play Diagnostics / a UIState projection / the `/debug/effects` viewer is explicitly Out of Scope and a separate future WP).
**Primary Layer:** Game Engine (`packages/game-engine`) only.
**Dependencies:** WP-257 / D-24034 (the hollow-effect detector + `G.diagnostics` channel this extends); WP-451 / D-24271 (the `hashGameState` diagnostics hash-exclusion this completes for the second oracle); D-24287 (the Mystique escape→scheme-twist secondary fire site this trace must capture).

---

## Goal

After this session, the engine emits a **runtime-only structured effect trace** whenever a card effect descriptor is dispatched during play. Each trace records the card, scope, timing, the effect token, the **handler that ran** (as a string label), a **status** (`fired` / `no-op` / `no-handler` / `secondary-site`), the fire site, the descriptor params, and the turn — appended to a new `traces` array on the existing `G.diagnostics` channel (the same runtime-only, JSON-serializable, hash-excluded, never-gameplay-input home as the WP-257 hollow records). It is the third and final piece of the ewiki `wiki/debug-effects.md` direction (piece 1 = the generated Effect Implementation Index, shipped WP-484; piece 2 is *this* runtime trace; piece 3 = the `/debug/effects` viewer, shipped WP-487). It unifies what today's surfaces answer separately — *"did a handler run at all?"* (hollow detector) and *"did the handler mutate anything?"* — into one per-dispatch record, and critically captures the **secondary-fire case** the hollow detector reads as "applied" but where the real work fires elsewhere (Mystique's `become-scheme-twist`: the executor handler is a deliberate no-op, the Scheme Twist actually fires at the villain-deck escape site, D-24287). To keep it determinism-safe now that a diagnostic materializes on **every** dispatch (unlike the rare hollow), this WP also completes the D-24271-deferred second half: `replay.hash.ts`'s `computeStateHash` gains the same `diagnostics` exclusion `hashGameState` already has. Locked by D-24294. **No card semantics, no gameplay behavior, and no client/viewer surface change** — the trace is inert engine data, never read by any move, rule, or `endIf`.

## User-Visible Impact

None. This is a runtime-only, hash-excluded engine diagnostic (`G.diagnostics.traces`) with **no player-facing, client, or operator surface in this WP** — nothing renders it, no move or rule consumes it, and it changes no gameplay outcome or persisted/hashed state. Its payoff is future: it is the engine-side data a later WP would surface (a UIState projection / the `/debug/effects` viewer) to answer *"which handler ran card X's effect, and did it actually do anything — or did the real work fire elsewhere?"* `User-Visible Surface = none — infrastructure`; D-24026 live-verification is N/A (nothing to observe on a live surface).

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The hollow-effect detector + G.diagnostics channel exist (the plumbing this extends)
test -f packages/game-engine/src/diagnostics/hollowEffect.record.ts && test -f packages/game-engine/src/diagnostics/hollowEffect.types.ts && grep -q "GameDiagnostics" packages/game-engine/src/diagnostics/hollowEffect.types.ts && echo "A_OK"
# Expected: A_OK

# B. G.diagnostics is declared runtime-only in the state type
grep -q "diagnostics" packages/game-engine/src/types.ts && echo "B_OK"
# Expected: B_OK

# C. The finalStateHash oracle (hashGameState) already EXCLUDES diagnostics (WP-451)
grep -q "diagnostics" packages/game-engine/src/test/fixtures/hashGameState.ts && echo "C_OK"
# Expected: C_OK

# D. The replay/determinism oracle (computeStateHash) does NOT yet exclude diagnostics (this WP adds it)
grep -q "diagnostics" packages/game-engine/src/replay/replay.hash.ts && echo "ALREADY-EXCLUDED (reconcile)" || echo "D_OK not-yet-excluded"
# Expected: D_OK not-yet-excluded  (if ALREADY-EXCLUDED, the follow-on landed elsewhere — reconcile scope)

# E. The four dispatch/fire sites exist
grep -q "applyVillainEffect" packages/game-engine/src/villain/villainEffects.execute.ts && grep -q "executeSingleEffect" packages/game-engine/src/hero/heroEffects.execute.ts && test -f packages/game-engine/src/hero/effectPrimitive.interpret.ts && grep -q "onSchemeTwistRevealed" packages/game-engine/src/villainDeck/villainDeck.reveal.ts && echo "E_OK"
# Expected: E_OK

# F. The determinism sentinels exist (to confirm no re-pin)
grep -q "PRE_WP080_HASH" packages/game-engine/src/replay/replay.execute.test.ts && test -f scripts/record-game-fixture.mjs && echo "F_OK"
# Expected: F_OK

# G. Governance docs exist
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && echo "G_OK"
# Expected: G_OK
```

If C fails, WP-451's `hashGameState` exclusion is absent — STOP and reconcile before adding a hash-excluded field. If D reports ALREADY-EXCLUDED, the second-oracle follow-on already landed — narrow this WP's scope to the trace only.

---

## Context (Read First)

- `packages/game-engine/src/diagnostics/hollowEffect.{types,record,test}.ts` (WP-257 / D-24034) — the surface this extends. `GameDiagnostics` (`hollowEffect.types.ts`) is `{ hollowEffects: HollowEffectRecord[], hollowEffectsDropped: number }`, capped at `HOLLOW_EFFECTS_CAP = 256`. The writer `recordHollowEffect(G, record)` lazy-inits `G.diagnostics` (never in `Game.setup()`), bounds by the cap with a dropped-counter, never throws, and is **never read as gameplay input**. This WP adds a sibling `traces: EffectTrace[]` field + a parallel `recordEffectTrace` writer with the identical discipline.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — the villain dispatch chokepoint is `applyVillainEffect` (looks up `VILLAIN_EFFECT_HANDLERS[descriptor.primitive]` and invokes it; a `null` return is the existing hollow-record site). `villainEffectBecomeSchemeTwist` is a deliberate **no-op** handler (returns `{ targets: [] }`) whose only purpose is hollow-suppression (D-24287) — the trace must show it as `no-op`, not `fired`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — the hero dispatch has **two** paths per hook: `executeSingleEffect` (legacy `hook.effects`, returns whether it fired) and the primitive-composition path via `interpretHeroPrimitiveEffect` (`packages/game-engine/src/hero/effectPrimitive.interpret.ts`). Both must emit a trace, or primitive-composed hero effects go untraced.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — the **secondary fire site**. In the escape branch, when the escaped card carries `become-scheme-twist` (`villainCardEscapeTriggersSchemeTwist`), the real Scheme Twist fires here via `executeRuleHooks('onSchemeTwistRevealed', ...) + applyRuleEffects` — NOT in the villain executor (whose handler is the no-op). The trace must emit a `secondary-site` record here so the Mystique case is answerable ("the executor was a no-op; the twist fired at the escape site").
- `packages/game-engine/src/test/fixtures/hashGameState.ts` (WP-451 / D-24271) — the `finalStateHash` oracle (sha256). It **already excludes** `diagnostics` (+ `messages`, `logMeta`, `lastPlayEffectsFired`) via a top-level rest-destructure denylist. Traces (inside `G.diagnostics`) are therefore auto-excluded here — add an invariance assertion, no code change to the denylist unless traces move outside `diagnostics`.
- `packages/game-engine/src/replay/replay.hash.ts` — the `computeStateHash` oracle (djb2, the `PRE_WP080_HASH` sentinel). It hashes the **whole** `G` with only a key-sort replacer — it does **NOT** exclude diagnostics. Today diagnostics survives only because it is absent-on-fresh and no pinned replay fixture materializes a rare hollow record. **Traces materialize on every dispatch**, so a replay fixture that plays any effect *would* populate `G.diagnostics.traces` and shift `PRE_WP080_HASH`. This WP must add the `diagnostics` exclusion here (the D-24271-deferred follow-on) so both oracles stay diagnostics-blind. Because the pinned fixture currently hashes with `diagnostics` absent, stripping an absent field yields an identical hash — **no re-pin expected** (confirm empirically).
- `packages/game-engine/src/types.ts` — `G.diagnostics?: GameDiagnostics` (runtime-only; comment: never persisted as a save-game, never read as gameplay input, optional so full-state literals need no edit). The `GameDiagnostics` type is imported from `diagnostics/hollowEffect.types.js`.
- `apps/arena-client/src/diagnostics/effectProvenance.ts` — the client-side per-seat surface. It reads `LogEntry.outcome` (engine-authored), NOT `G.diagnostics`. The trace complements it and does not feed it in this WP (client consumption is future work).
- `docs/ai/ARCHITECTURE.md §Persistence Boundaries` + `.claude/rules/architecture.md` — `G` is runtime-only but must stay JSON-serializable (no functions/Maps/Sets/classes). A runtime-only, JSON-serializable, hash-excluded `G` field (like `G.diagnostics`) is the sanctioned pattern; a module-level side channel is not (state surviving a move must live in the Immer-drafted `G`). Handler identity is captured as a **string label**, never a function reference.
- `docs/ai/REFERENCE/00.6-code-style.md` — `for...of` (no branching `.reduce()`), full-word names, `// why:`, full-sentence errors; emit full file contents for every new/modified file.

---

## Scope (In)

- Add `EffectTrace` + `EffectTraceStatus` (closed union) + `EffectTraceFireSite` (closed union) to the diagnostics contract (`packages/game-engine/src/diagnostics/hollowEffect.types.ts`), and add a `traces: EffectTrace[]` + `tracesDropped: number` pair to `GameDiagnostics`, with a separate `EFFECT_TRACES_CAP`. `EffectTrace` is plain JSON: `{ cardId, scope: 'hero'|'villain'|'henchman', timing, effect, handler, status, fireSite, params, turn }`.
- Add `packages/game-engine/src/diagnostics/effectTrace.record.ts` — `recordEffectTrace(G, trace)` mirroring `recordHollowEffect`'s **discipline** (lazy-init `G.diagnostics` — never in `Game.setup()`; append to `traces`; bound by `EFFECT_TRACES_CAP` with `tracesDropped++`; never throw; never read as gameplay input) with **one deliberate divergence**: it does **NOT** `pushLog` to `G.messages`. `recordHollowEffect` writes a `G.messages` line for operator visibility, but a trace fires on every dispatch (high-volume) and `G.messages` is a hashed field the `record-game-fixture` sentinels cover — pushing per-dispatch would both spam the log and churn the fixtures. So `recordEffectTrace` touches only `G.diagnostics`.
- Emit a trace at each effect dispatch, from the **caller loops** — `executeVillainAbilities` and `executeHeroEffects` — NOT the inner dispatch functions. The inner functions (`applyVillainEffect`, `executeSingleEffect`, `interpretHeroPrimitiveEffect`) do not carry `turn` and `timing` together, so a trace emitted inside them could not fill the locked `EffectTrace` fields; the caller loops carry `turn`, the hook `timing`, `cardId`, the descriptor, and the dispatch result:
  - **Villain** (`fireSite: 'villain-executor'`) — in `executeVillainAbilities` (`villainEffects.execute.ts`), per descriptor after `applyVillainEffect` returns: `no-handler` when it returns `null` (beside the existing hollow record), `no-op` when the primitive is a **deliberate no-op** — the fixed allowlist `{ become-scheme-twist [D-24287], gain-attached-hero [D-24270] }`, both of which intentionally return `{ targets: [] }` — else `fired`. (A `VillainEffectApplication` carries no mutation signal and many real-firing handlers legitimately return empty `targets`, so `no-op` is this fixed allowlist, **NOT** `targets.length`.)
  - **Hero** — in `executeHeroEffects` (`heroEffects.execute.ts`), per hook covering BOTH dispatch sub-paths: the legacy `hook.effects` → `executeSingleEffect` (`fireSite: 'hero-executor'`) and the primitive `hook.primitiveEffects` → `interpretHeroPrimitiveEffect` (`fireSite: 'hero-primitive'`); `fired` when the call returns true, `no-handler`/skip when it returns false (the pre-gate/undefined-handler branch).
  - **Escape→scheme-twist secondary site** (`fireSite: 'escape-scheme-twist'`) — in the escape branch of `villainDeck.reveal.ts` (the `villainCardEscapeTriggersSchemeTwist` block, which carries the `RevealContext`→turn + escaped card): a `secondary-site` trace naming the escaped card, recording that the real Twist fired here rather than in the executor (whose handler is the `become-scheme-twist` no-op).
- Extend `packages/game-engine/src/replay/replay.hash.ts` `computeStateHash` to exclude **`diagnostics` only** (a top-level rest-destructure of that one field) — do **NOT** also remove `messages` / `logMeta` / `lastPlayEffectsFired`, which remain hashed by `computeStateHash` (unlike `hashGameState`, which also excludes them; removing them here would shift `PRE_WP080_HASH` and trip AC-9). This completes the D-24271-deferred second oracle so common per-dispatch traces never shift the replay hash.
- Add `packages/game-engine/src/diagnostics/effectTrace.record.test.ts` — `node:test` coverage: lazy-init, cap + `tracesDropped`, record identity, and a drift test asserting `EFFECT_TRACE_STATUSES` / `EFFECT_TRACE_FIRE_SITES` arrays ↔ their unions (the canonical-array discipline).
- Add hash-invariance assertions: extend `hashGameState.test.ts` to assert `finalStateHash` is invariant to populated `G.diagnostics.traces`, and add a `computeStateHash`-invariance assertion (empty + populated traces ⇒ same hash) proving the new `replay.hash.ts` exclusion.
- Reserve and land D-24294 (the trace contract + hash-exclusion-of-both-oracles + runtime-only/never-gameplay lock).

## Out of Scope

- **"Which zone helpers mutated state."** Capturing the specific zone-op helpers a handler invoked is net-new instrumentation (a helper-touch manifest threaded through every handler or `zoneOps` wrapper) — a genuinely separate surface, deferred to a future WP. This WP records the **handler identity** (string label) and a **status**, not the internal helper calls.
- **Any client / viewer / UIState surface.** No `effectProvenance` change, no UIState projection of traces, no `/debug/effects` viewer wiring, no `LogEntry` change. The trace is engine-side data only (mirroring WP-484, which shipped the index without a consumer). Surfacing traces to a client is a separate future WP.
- **Persisting or publishing traces.** No R2 upload, no committed artifact, no snapshot field. `G.diagnostics` is runtime-only and hash-excluded; it is never persisted by application code.
- **Additional secondary fire sites beyond the escape→scheme-twist case.** Other `executeRuleHooks` sites in the reveal/master-strike pipelines are not instrumented here; the D-24287 escape-twist case is the one documented secondary site (the canonical Mystique example), establishing the pattern for future sites.
- **Changing the hollow detector's behavior.** `recordHollowEffect` and its records are untouched; the trace is additive and sits beside them. A `no-handler` dispatch produces BOTH a hollow record (unchanged) and a trace (new) — the trace is the unified per-dispatch view, the hollow record the historical miss-only view.
- **Reading a trace in any move / rule / `endIf` / bot / scoring path.** The trace is inert; consuming it as gameplay input is forbidden (same rule as `G.diagnostics`).

---

## Files Expected to Change

- `packages/game-engine/src/diagnostics/hollowEffect.types.ts` — **modified** (contract: add `EffectTrace`, `EffectTraceStatus`/`EffectTraceFireSite` closed unions + canonical arrays, `traces`/`tracesDropped` on `GameDiagnostics`, `EFFECT_TRACES_CAP`)
- `packages/game-engine/src/diagnostics/effectTrace.record.ts` — **new** (`recordEffectTrace` writer, mirrors `recordHollowEffect`)
- `packages/game-engine/src/diagnostics/effectTrace.record.test.ts` — **new** (`node:test`: lazy-init, cap, identity, union-drift)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** (emit from the `executeVillainAbilities` loop, per descriptor, by the no-op allowlist)
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (emit from the `executeHeroEffects` loop for both sub-paths — legacy `executeSingleEffect` + primitive `interpretHeroPrimitiveEffect`)
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** (emit the `secondary-site` trace in the escape→scheme-twist branch)
- `packages/game-engine/src/replay/replay.hash.ts` — **modified** (exclude `diagnostics` from `computeStateHash`; D-24271 follow-on)
- `packages/game-engine/src/test/fixtures/hashGameState.test.ts` — **modified** (traces-invariance assertion for `finalStateHash`)
- `packages/game-engine/src/replay/replay.execute.test.ts` OR a `replay.hash.test.ts` — **modified/new** (`computeStateHash`-invariance-to-traces assertion; confirm `PRE_WP080_HASH` unchanged)
- `docs/ai/DECISIONS.md` — **modified** (land D-24294)
- `docs/ai/STATUS.md` — **modified** (Done entry, `none — infrastructure`)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (status flip)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (status flip)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (flip WP-488 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

~9 engine code/test files + 5 governance. Single layer (Game Engine); standard two-session lane (contract change + determinism surface + >4 code files — decisively not lightweight-eligible). The trace surface (type + writer + four emit sites + the second hash-exclusion + the invariance tests) is one indivisible determinism-safe contract — a trace field with no writer is dead; a writer with no hash-exclusion breaks the replay oracle — so the bundle is justified inline per the §5 file-count guidance.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` / never add a new RNG — the trace only observes dispatch that already happened; no `ctx.random`, no wall-clock, no `Date`/timer read.
- Moves never throw; only `Game.setup()` may throw — `recordEffectTrace` and all four emit sites are best-effort and MUST NOT throw (a trace-emit bug must never break a move, an ability execution, or a villain-deck reveal).
- `G` is runtime-only but must stay JSON-serializable — no functions/Maps/Sets/classes in `EffectTrace`; `handler` is a **string label**, never a function reference.
- ESM only, Node v22+; `node:` prefix on built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — `for...of` (no branching `.reduce()`), full-word names, `// why:` on the load-bearing lines (below), full-sentence errors.
- Full file contents required for every new/modified file in the session output — no diffs, no snippets, no "changed section only".

**Packet-specific:**
- The trace is **inert**: never read by any move / rule / `endIf` / bot / scoring / AI path (same rule as `G.diagnostics`) — grep-confirmed.
- `recordEffectTrace` touches ONLY `G.diagnostics` — it does **NOT** `pushLog` to `G.messages` (the one deliberate divergence from `recordHollowEffect`; a per-dispatch log push would churn the hashed `messages` field + the `record-game-fixture` sentinels).
- The `computeStateHash` (`replay.hash.ts`) exclusion is **`diagnostics`-only** — keep hashing `messages` / `logMeta` / `lastPlayEffectsFired` (removing them shifts `PRE_WP080_HASH`).
- `G.diagnostics` stays **lazy-init at the writer**, never seeded in `Game.setup()` (absent-on-fresh keeps both hash oracles stable).
- `params` built by explicit scalar-field copy (omit `undefined`), never a spread-and-cast; every value `string|number|boolean`.
- No `registry` / `server` / `apps/*` edits — engine diagnostics only; the hollow detector's behavior is unchanged.

**Session protocol:**
- **STOP and reconcile** if `PRE_WP080_HASH` or any `record-game-fixture` `finalStateHash` sentinel shifts — do NOT re-pin a sentinel or relax a gate to make a determinism regression pass.
- If a dispatch/fire site's signature can't supply the locked `EffectTrace` fields (`turn`/`timing`), emit from the caller loop — do not stamp `0`/`""`.

**Locked contract values:** see `## Contract (Locked by D-24294)` below.

## Contract (Locked by D-24294)

- **Trace home:** a new `traces: EffectTrace[]` (+ `tracesDropped: number`) on the existing `G.diagnostics` (`GameDiagnostics`) channel — a runtime-only, JSON-serializable, **hash-excluded** engine field, the sanctioned WP-451 pattern. NOT a module-level side channel, NOT a top-level `G` field, NOT persisted.
- **`EffectTrace` shape** (plain JSON, no functions/Maps/Sets): `{ cardId: CardExtId, scope: 'hero'|'villain'|'henchman', timing: string, effect: string, handler: string, status: EffectTraceStatus, fireSite: EffectTraceFireSite, params: Record<string, string|number|boolean>, turn: number }`. `handler` is a **string label** (the handler map key / function name), `""` when no handler ran; `effect` is the descriptor's primitive/keyword token **verbatim**; `params` is a shallow JSON snapshot of the descriptor's own parameter fields.
- **`EffectTraceStatus`** closed union: `'fired' | 'no-op' | 'no-handler' | 'secondary-site'` — `fired` = a handler ran; `no-op` = a **deliberate-no-op** handler ran (the fixed allowlist `{ become-scheme-twist, gain-attached-hero }` — both intentionally mutate nothing; determined by primitive identity, never by `targets.length`); `no-handler` = no handler for the token (co-recorded as a hollow); `secondary-site` = the effect's real work fired at a different site than the executor.
- **`EffectTraceFireSite`** closed union: `'villain-executor' | 'hero-executor' | 'hero-primitive' | 'escape-scheme-twist'` — the code site that emitted the trace.
- **Writer discipline** (identical to `recordHollowEffect`): lazy-init `G.diagnostics` (never in `Game.setup()`); append + bound by `EFFECT_TRACES_CAP` with `tracesDropped++`; never throw; never read as gameplay input by any move/rule/`endIf`/bot/scoring path.
- **Determinism (both oracles diagnostics-blind):** `hashGameState` (`finalStateHash`) already excludes `diagnostics` (WP-451) — traces are auto-excluded; `computeStateHash` (`replay.hash.ts`, the `PRE_WP080_HASH` oracle) gains the same **diagnostics-only** exclusion in this WP (it keeps hashing `messages`/`logMeta`/`lastPlayEffectsFired`). Given the pinned fixture currently hashes with `diagnostics` absent, adding the exclusion yields an **identical** hash ⇒ **no re-pin** of `PRE_WP080_HASH` or the `record-game-fixture` `finalStateHash` sentinels (confirm empirically; if either shifts, STOP and reconcile before relaxing a gate).
- **Canonical-array discipline:** `EFFECT_TRACE_STATUSES` and `EFFECT_TRACE_FIRE_SITES` are readonly arrays asserted ↔ their unions by a drift test (per `.claude/rules/code-style.md §Drift Detection`).

---

## Acceptance Criteria

1. `G.diagnostics.traces` is a JSON array of `EffectTrace`; `recordEffectTrace(G, trace)` lazy-inits `G.diagnostics`, appends, and never throws (mirrors `recordHollowEffect`).
2. `recordEffectTrace` bounds `traces` at `EFFECT_TRACES_CAP`, incrementing `tracesDropped` past the cap (no unbounded growth).
3. Every `EffectTrace.status` ∈ `{ fired, no-op, no-handler, secondary-site }`; every `EffectTrace.fireSite` ∈ the closed fire-site union; `handler` is a string (`""` when no handler ran, never a function reference); `effect` is the descriptor token verbatim.
4. A villain effect dispatch emits a trace from `executeVillainAbilities`: a resolved handler → `fired`, EXCEPT the deliberate-no-op allowlist (`become-scheme-twist`, `gain-attached-hero`) → `no-op`; an unmapped primitive (`applyVillainEffect` returns `null`) → `no-handler` (co-recorded as a hollow). `no-op` is decided by primitive identity, never `targets.length` (real-firing handlers legitimately return empty `targets`).
5. A hero effect dispatch emits a trace from `executeHeroEffects` for BOTH sub-paths — legacy (`hero-executor`, via `executeSingleEffect`'s boolean) and primitive (`hero-primitive`, via `interpretHeroPrimitiveEffect`'s boolean) — with `fired`/`no-handler` set by each call's return.
6. The Mystique escape case emits a `secondary-site` trace (`fireSite: 'escape-scheme-twist'`) at the `villainDeck.reveal.ts` escape branch, distinct from the executor's `no-op` trace for the same card — so the trace shows the real Twist fired at the escape site.
7. `computeStateHash` (`replay.hash.ts`) excludes `diagnostics`; a state with empty vs a **genuinely populated** `G.diagnostics.traces` (the test appends real `EffectTrace`s before hashing) hashes identically. This is the ONLY test that catches a forgotten exclusion — `PRE_WP080_HASH` is an empty replay and passes regardless, so it cannot.
8. `hashGameState` (`finalStateHash`) is invariant to populated `G.diagnostics.traces` (a new assertion beside the D-24271 diagnostics test).
9. `PRE_WP080_HASH` is **unchanged** and every `record-game-fixture` `finalStateHash` sentinel is **unchanged** — the hash-excluded field re-pins neither oracle (confirmed empirically; if either shifts, the WP stops and reconciles).
10. `EFFECT_TRACE_STATUSES` / `EFFECT_TRACE_FIRE_SITES` arrays ↔ their unions are asserted by a drift test; adding a value without updating both fails.
11. No move, rule, `endIf`, bot, or scoring path reads `G.diagnostics.traces` (grep-confirmed inert); `G` stays JSON-serializable (no functions/Maps/Sets in the trace).
12. `pnpm -r build` and `pnpm -r --no-bail test` exit 0; only `packages/game-engine` (+ governance) files are modified; no `registry`/`server`/`apps/*` file changes.

---

## Verification Steps

```bash
# 1. Build + run the diagnostics + hash tests
pnpm --filter @legendary-arena/game-engine build 2>&1 | tail -2
pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5
# Expected: exit 0; effectTrace.record + hash-invariance + drift tests pass

# 2. computeStateHash now excludes diagnostics
grep -n "diagnostics" packages/game-engine/src/replay/replay.hash.ts
# Expected: a destructure/denylist excluding diagnostics

# 3. Determinism sentinels UNCHANGED (the load-bearing check)
grep -n "PRE_WP080_HASH = " packages/game-engine/src/replay/replay.execute.test.ts
git diff --stat packages/game-engine/src/replay/replay.execute.test.ts
node scripts/record-game-fixture.mjs --check 2>&1 | tail -3   # or the repo's fixture-freshness gate
# Expected: PRE_WP080_HASH literal unchanged; no finalStateHash sentinel churn

# 4. The trace is inert (never read as gameplay input)
grep -rnE "diagnostics\.traces|\.traces\b" packages/game-engine/src --include=*.ts | grep -vE "diagnostics/effectTrace|hollowEffect|\.test\.ts|record" ; echo "reads above (expect only the writer + emit sites, never a move/rule/endIf)"

# 5. Both hash oracles invariant to traces
pnpm --filter @legendary-arena/game-engine test 2>&1 | grep -iE "invariant|traces|diagnostics" | head
# Expected: the finalStateHash + computeStateHash traces-invariance assertions pass

# 6. Scope boundary — engine-only
git diff --name-only | grep -E '^(packages/(registry)|apps/|packages/game-engine/.*(?<!\.ts))' ; git diff --name-only | grep -vE '^(packages/game-engine/|docs/)' ; echo "non-engine/doc hits above (expect none)"

# 7. Full build/test
pnpm -r build && pnpm -r --no-bail test
# Expected: both exit 0
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] All preconditions (A–G) passed before the edit
- [ ] All 12 Acceptance Criteria pass
- [ ] All 7 Verification Steps produce the expected output
- [ ] `G.diagnostics.traces` records per-dispatch `EffectTrace`s at the four sites; status/fireSite closed unions honored; handler is a string label, never a function
- [ ] The Mystique escape case yields a `secondary-site` trace at the reveal escape branch, distinct from the executor `no-op`
- [ ] `computeStateHash` excludes `diagnostics` (D-24271 second oracle completed); both hash oracles invariant to `G.diagnostics.traces`
- [ ] `PRE_WP080_HASH` + all `record-game-fixture` `finalStateHash` sentinels UNCHANGED (no re-pin); if either shifted, the WP stopped and reconciled
- [ ] `recordEffectTrace` mirrors the `recordHollowEffect` discipline (lazy-init, cap + dropped-counter, never-throw, never-gameplay-input); `EFFECT_TRACES_CAP` bounds growth
- [ ] Drift test asserts `EFFECT_TRACE_STATUSES` / `EFFECT_TRACE_FIRE_SITES` ↔ their unions
- [ ] Trace is inert (grep-confirmed no gameplay-path read); `G` stays JSON-serializable
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` exit 0; only `packages/game-engine` + governance modified
- [ ] `docs/ai/STATUS.md` Done entry names WP-488 + the trace, states "No user-observable change — infrastructure only" (`User-Visible Surface = none — infrastructure`)
- [ ] `docs/ai/DECISIONS.md` D-24294 landed (trace contract + both-oracle hash-exclusion + runtime-only/never-gameplay lock); Status → Active
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-488 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-523:` for code/test, `SPEC:` for governance close

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-02, after one adversarial re-verify)

The determinism spine was verified empirically against source, not asserted: `hashGameState` (`finalStateHash`) already excludes `diagnostics` (WP-451/D-24271) so traces inside `G.diagnostics` are auto-excluded there; `computeStateHash` (`replay.hash.ts`) does not yet exclude it (this WP adds a `diagnostics`-only exclusion); `PRE_WP080_HASH` is an empty replay so `diagnostics` is absent, and stripping an absent field yields an identical hash ⇒ **no re-pin** of that sentinel or the `record-game-fixture` `finalStateHash` fixtures (which hash via the already-diagnostics-blind `hashGameState`). The pre-flight caught — and this WP now fixes — two real authoring defects: the villain `fired`/`no-op` rule was wrongly keyed on `targets.length` (≥6 real-firing handlers return empty `targets`), corrected to a fixed primitive allowlist `{ become-scheme-twist, gain-attached-hero }`; and the three inner dispatch functions lack `turn`+`timing` together, so the emits were relocated to the caller loops (`executeVillainAbilities` / `executeHeroEffects`), dropping `effectPrimitive.interpret.ts` from the allowlist. The `G.diagnostics` allowlist is complete (every existing reader tolerates the additive shape change). **Empirical Scaffold N/A** — the emits are additive-observational (no existing input-path validation is tightened); the one risky change (the `computeStateHash` exclusion) is proven by AC-7 (populated-vs-empty invariance) + AC-9 (sentinels unchanged), both verified from source. **Mutation Boundary N/A** — the trace is inert; it mutates only the hash-excluded `G.diagnostics`.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-02, after one RISK round)

No BLOCK across the failure-mode lens. Determinism/persistence (both oracles diagnostics-blind by construction; cap+`tracesDropped` deterministic; no `Date`/random; append order is deterministic `for...of` and hash-excluded regardless), contract fidelity (handler a string label, closed unions + canonical-array drift), layer boundary (engine-only; `recordEffectTrace` touches only `G.diagnostics`; grep-inert), testing (AC-7/8/9 prove both-oracle invariance + no sentinel re-pin — AC-7's "append real traces" pre-empts the empty-vs-empty false pass), error handling (never-throws at all four emit sites; only `Game.setup()` throws), and scope/governance (12 AC, fixed allowlist, two-commit topology, D-24294 accurate) all cleared. The two copilot RISKs were folded in: `params` is now locked to explicit scalar-field copy (never a spread-and-cast that would break `exactOptionalPropertyTypes` and leak non-scalar fields into `G`), and the `computeStateHash` exclusion is stated as `diagnostics`-only (not "align with the hashGameState denylist", which would over-strip `messages`/`logMeta`/`lastPlayEffectsFired` and shift `PRE_WP080_HASH`).

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure / §2 Non-Negotiable Constraints** — PASS (a `## Non-Negotiable Constraints` section was added: engine-wide [no `Math.random`, moves/emits never throw, `G` JSON-serializable, ESM/Node v22+, full-file-contents, 00.6] + packet-specific [inert, no-`pushLog`, `diagnostics`-only hash exclusion, lazy-init, scalar-copy `params`, engine-only] + session protocol [STOP on sentinel shift]).
- **§3 Assumes** — PASS (A–G with exact expected output; the `computeStateHash` not-yet-excluded precondition D guards a double-land).
- **§4 Context** — PASS (the hollow detector, both hash oracles, the four sites, ARCHITECTURE §Persistence Boundaries, 00.6). 00.2 N/A — `EffectTrace` is an engine diagnostic type, not a 00.2 card-data/setup field.
- **§5 Files** — PASS (closed ~9-engine + 5-governance allowlist, each new/modified + described; indivisibility justified inline).
- **§6 Naming** — PASS (`EffectTrace.cardId: CardExtId` mirrors `HollowEffectRecord`; closed-union + canonical-array names).
- **§7 Dependencies** — N/A (no new npm dep).
- **§8 Architectural Boundaries** — PASS (engine-only; `G` JSON-serializable; trace hash-excluded + never gameplay-read; Verification-4/6 grep-enforce).
- **§9 Windows** — N/A (no shell scripts; `pnpm`/`node`/grep via the Bash tool).
- **§10 Env / §11 Auth** — N/A (none).
- **§12 Test Quality** — PASS (`node:test` invariance + drift + record; no boardgame.io/network/DB).
- **§13 Verification** — PASS (exact `pnpm --filter` + expected output; the sentinel-unchanged check is the load-bearing one).
- **§14 Acceptance Criteria** — PASS (12 binary/observable; determinism ACs 7/8/9 well-formed).
- **§15 Definition of Done** — PASS (STATUS/DECISIONS D-24294/WORK_INDEX/EC_INDEX/ROADMAP + `## User-Visible Impact` + the `none — infrastructure` STATUS wording).
- **§16 Code Style** — PASS (`for...of`, 5 `// why:` locations, string-label handler, scalar-copy `params`).
- **§17 Vision Alignment** — PASS (§22 determinism + §10; No conflict; NG-1..8; determinism-preservation line).
- **§18 Prose-vs-Grep** — N/A (greps target the feature's own identifiers scoped to `packages/game-engine/src`, not forbidden tokens in this doc).
- **§19 Bridge-vs-HEAD** — commit-time discipline; N/A at draft.
- **§20 Funding Surface Gate / §21 API Catalog** — N/A (internal engine diagnostics; no funding surface, no HTTP/`apps/server` library fn).

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Vision clauses touched:** §22 (determinism — the trace is runtime-only and hash-excluded from BOTH oracles, so replay + state-placement stay byte-stable), §10 (effect semantics — read-only observation, no behavior change).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The trace is inert engine-side observation of dispatch that already happens; it changes no card semantics, no gameplay outcome, and no persisted/hashed state. It strengthens determinism hygiene by making the second hash oracle diagnostics-blind (the D-24271-deferred follow-on).

**Non-Goal proximity check:** none of NG-1..NG-8 crossed — the trace carries no monetization, persuasion, pay-to-win, or competitive-integrity surface; it is developer/debug engine tooling, never read as gameplay input.

**Determinism preservation:** the trace materializes on every dispatch but is excluded from `hashGameState` (already) and `computeStateHash` (added here), so neither `finalStateHash` nor `PRE_WP080_HASH` moves; it uses no `ctx.random`, persists nothing, and is forbidden from any gameplay-path read.

## Funding Surface Gate

**N/A — no funding surface touched.** No §20.1 trigger: internal engine debug tooling only; no navigation/profile/tournament funding surface, no user-visible funding copy. (Authority chain per §20 form: WP-097, D-9701, D-9801.)

## API Catalog Update

**N/A — no API surface touched.** Per lint §21.4: no HTTP endpoint and no `apps/server/src/**` library function added or modified. Engine-internal diagnostics only; `docs/ai/REFERENCE/api-endpoints.md` unaffected.
