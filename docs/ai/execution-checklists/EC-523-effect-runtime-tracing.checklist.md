# EC-523 — Runtime Effect Tracing (`G.diagnostics.traces`) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-488-effect-runtime-tracing.md
**Layer:** Game Engine (`packages/game-engine`) only

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Hollow detector + `GameDiagnostics` channel exist: `test -f packages/game-engine/src/diagnostics/hollowEffect.record.ts && grep -q GameDiagnostics packages/game-engine/src/diagnostics/hollowEffect.types.ts` → OK
- [ ] `hashGameState` already EXCLUDES diagnostics (WP-451): `grep -q diagnostics packages/game-engine/src/test/fixtures/hashGameState.ts` → OK
- [ ] `computeStateHash` does NOT yet exclude diagnostics (this WP adds it): `grep -q diagnostics packages/game-engine/src/replay/replay.hash.ts` → **NO MATCH** (if it matches, the follow-on already landed — reconcile scope)
- [ ] The four sites exist: `grep -q applyVillainEffect .../villain/villainEffects.execute.ts && grep -q executeSingleEffect .../hero/heroEffects.execute.ts && test -f .../hero/effectPrimitive.interpret.ts && grep -q onSchemeTwistRevealed .../villainDeck/villainDeck.reveal.ts` → OK
- [ ] Sentinels exist: `grep -q PRE_WP080_HASH packages/game-engine/src/replay/replay.execute.test.ts && test -f scripts/record-game-fixture.mjs` → OK
- [ ] Working tree clean except for this WP

## Locked Values (do not re-derive)
- Trace home: a new `traces: EffectTrace[]` + `tracesDropped: number` on the EXISTING `G.diagnostics` (`GameDiagnostics`) channel — runtime-only, JSON-serializable, hash-excluded. NOT a module side channel, NOT a top-level G field, NEVER persisted
- `EffectTrace` (plain JSON): `{ cardId, scope:'hero'|'villain'|'henchman', timing, effect, handler, status, fireSite, params, turn }`. `handler` = string label (map key / fn name), `""` when none — NEVER a function reference. `effect` = descriptor token verbatim. `params: Record<string, string|number|boolean>` = the descriptor's own param fields, built by EXPLICIT scalar-field copy that OMITS `undefined` keys (`if (value !== undefined) params.key = value` — the conditional-assign pattern already in `villainEffects.execute.ts`) — NEVER a spread-and-cast of the raw descriptor (that leaks `primitive`/non-scalar fields into `G` and breaks `exactOptionalPropertyTypes: true`); every value is `string|number|boolean`
- Emit sites read the descriptor DEFENSIVELY (like `readTurnNumber` / `buildVillainDescriptorHollowRecord`) so a malformed descriptor cannot throw before the guarded writer runs
- `EFFECT_TRACE_STATUSES` closed union: `fired | no-op | no-handler | secondary-site`. `no-op` = a **deliberate-no-op** handler ran — the FIXED allowlist `{ become-scheme-twist [D-24287], gain-attached-hero [D-24270] }`, both of which intentionally return `{ targets: [] }`. **Decide `no-op` by primitive identity, NEVER by `targets.length`** — many real-firing villain handlers (gain-wound, capture-bystander, reveal-or-wound, draw-cards-current, rescue-bystanders-current, scry-ko-own-deck) legitimately return empty `targets` and MUST read as `fired`
- `EFFECT_TRACE_FIRE_SITES` closed union: `villain-executor | hero-executor | hero-primitive | escape-scheme-twist`
- Writer `recordEffectTrace(G, trace)` mirrors `recordHollowEffect`'s DISCIPLINE (lazy-init `G.diagnostics` — NEVER in `Game.setup()`; append; bound by `EFFECT_TRACES_CAP` with `tracesDropped++`; NEVER throw; NEVER read as gameplay input) with ONE divergence: it does **NOT** `pushLog` to `G.messages` (recordHollowEffect DOES; a per-dispatch trace would spam the log AND churn the `record-game-fixture` `finalStateHash` fixtures via the hashed `messages` field). Touch ONLY `G.diagnostics`
- Emit from the CALLER LOOPS, not the inner dispatch fns (the inner fns lack `turn`+`timing` together): `executeVillainAbilities` (villain-executor; per descriptor after `applyVillainEffect`), `executeHeroEffects` (hero-executor via `executeSingleEffect`'s bool + hero-primitive via `interpretHeroPrimitiveEffect`'s bool), and the `villainCardEscapeTriggersSchemeTwist` block in `villainDeck.reveal.ts` (escape-scheme-twist, `secondary-site`)
- `computeStateHash` (`replay.hash.ts`) gains a `diagnostics`-ONLY exclusion (the D-24271-deferred follow-on): strip ONLY `diagnostics`; `messages`/`logMeta`/`lastPlayEffectsFired` STAY hashed there (unlike `hashGameState`, which also excludes them) — removing them would shift `PRE_WP080_HASH`
- Determinism: BOTH oracles diagnostics-blind ⇒ **NO re-pin** of `PRE_WP080_HASH` or any `record-game-fixture` `finalStateHash` sentinel (stripping an absent field = identical hash). If EITHER shifts → STOP and reconcile, do NOT relax the gate
- Canonical arrays `EFFECT_TRACE_STATUSES`/`EFFECT_TRACE_FIRE_SITES` ↔ their unions asserted by a drift test
- DECISIONS reservation: **D-24294**

## Guardrails
- The trace is INERT: no move / rule / `endIf` / bot / scoring path may READ `G.diagnostics.traces` (same rule as `G.diagnostics`) — grep-confirm
- `G` stays JSON-serializable: no functions/Maps/Sets/classes in `EffectTrace` — `handler` is a STRING label, never the handler function
- Do NOT change the hollow detector's behavior — the trace is ADDITIVE beside `hollowEffects`; a `no-handler` dispatch produces BOTH a hollow record (unchanged) and a trace
- Do NOT touch card semantics, gameplay outcomes, `LogEntry`, `effectProvenance`, UIState, or any `apps/*` / `registry` / `server` file — engine diagnostics only
- Do NOT wire the trace into a client / viewer / projection — engine-side data only (future WP), like WP-484 shipped the index without a consumer
- `EFFECT_TRACES_CAP` MUST bound growth (traces fire on every dispatch — a long game is high-volume; the cap + `tracesDropped` prevent unbounded G growth)
- The `computeStateHash` exclusion is REQUIRED, not optional — traces materialize on every dispatch, so without it a replay fixture that plays any effect shifts `PRE_WP080_HASH`
- Only `Game.setup()` may throw — `recordEffectTrace` and all emits never throw

## Required `// why:` Comments
- On `recordEffectTrace` lazy-init of `G.diagnostics` (runtime-only channel; never seeded in `Game.setup()` so full-state literals need no edit — mirrors `recordHollowEffect`).
- On the `EFFECT_TRACES_CAP` bound (traces fire on EVERY dispatch, unlike the rare hollow, so the cap prevents unbounded `G` growth in a long game).
- On the `computeStateHash` `diagnostics` exclusion (traces materialize commonly, so WITHOUT this the replay/PRE_WP080 oracle would shift — completes the D-24271-deferred second oracle; `hashGameState` already excludes it).
- On capturing `handler` as a STRING label, not the function reference (`G` forbids functions; the trace must stay JSON-serializable).
- On the `secondary-site` emit in `villainDeck.reveal.ts` (the executor handler is a deliberate no-op per D-24287; the real Scheme Twist fires HERE, so the trace records where the work actually happened).

## Files to Produce
- `packages/game-engine/src/diagnostics/hollowEffect.types.ts` — **modified** — `EffectTrace` + closed unions + canonical arrays + `traces`/`tracesDropped` on `GameDiagnostics` + `EFFECT_TRACES_CAP`
- `packages/game-engine/src/diagnostics/effectTrace.record.ts` — **new** — `recordEffectTrace` (mirrors `recordHollowEffect`)
- `packages/game-engine/src/diagnostics/effectTrace.record.test.ts` — **new** — lazy-init/cap/identity/union-drift
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — emit from the `executeVillainAbilities` loop (per descriptor; no-op allowlist)
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — emit from the `executeHeroEffects` loop (both sub-paths: legacy `executeSingleEffect` + primitive `interpretHeroPrimitiveEffect`)
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — `secondary-site` emit in the escape branch
- `packages/game-engine/src/replay/replay.hash.ts` — **modified** — exclude `diagnostics` (D-24271 follow-on)
- `packages/game-engine/src/test/fixtures/hashGameState.test.ts` — **modified** — `finalStateHash` traces-invariance
- `packages/game-engine/src/replay/replay.execute.test.ts` (or new `replay.hash.test.ts`) — **modified/new** — `computeStateHash` traces-invariance + `PRE_WP080_HASH` unchanged
- `docs/ai/DECISIONS.md` — **modified** — land D-24294 (Status → Active)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip WP-488 node `📝` → `✅`; run `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** — governance close (STATUS states "No user-observable change — infrastructure only")

## After Completing
- [ ] `recordEffectTrace` lazy-inits + caps + never throws (mirrors `recordHollowEffect`); `tracesDropped` increments past the cap
- [ ] Traces emitted at all four sites with correct `status`/`fireSite`; `handler` a string, `""` when none; `effect` verbatim
- [ ] Mystique escape → a `secondary-site` trace at the reveal branch, distinct from the executor `no-op`
- [ ] `computeStateHash` excludes `diagnostics`; empty vs populated `G.diagnostics.traces` hash identically (both oracles)
- [ ] `PRE_WP080_HASH` UNCHANGED + no `record-game-fixture` `finalStateHash` churn (`git diff` clean on the sentinel + fixtures)
- [ ] Drift test: `EFFECT_TRACE_STATUSES`/`EFFECT_TRACE_FIRE_SITES` ↔ unions
- [ ] `grep -rn "diagnostics.traces" packages/game-engine/src` → reads ONLY at the writer + emit sites, NEVER a move/rule/endIf/bot/scoring path
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] `git diff --name-only` shows only `packages/game-engine/` + `docs/` (no registry/server/apps)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts; D-24294 landed (Active)
- [ ] Commit prefix: `EC-523:` (code) + `SPEC:` (governance)

## Common Failure Smells
- `PRE_WP080_HASH` shifts → you did NOT add the `computeStateHash` diagnostics exclusion (traces materialized in the replay fixture); add the `replay.hash.ts` denylist, do NOT re-pin the sentinel
- `finalStateHash` fixtures churn → the trace field landed OUTSIDE `G.diagnostics` (so `hashGameState`'s existing denylist misses it); keep traces inside `G.diagnostics`, or add the new field to the `hashGameState` destructure too
- A `handler` cell holds `[Function]`/`undefined` in JSON → you stored the function; capture its string label (map key / `.name`)
- Unbounded `G` growth / huge snapshots → no `EFFECT_TRACES_CAP`; bound + count drops like `recordHollowEffect`
- The Mystique case shows only a `no-op` and no twist trace → you emitted only at the executor; add the `secondary-site` emit in `villainDeck.reveal.ts`
- A test reads `G.diagnostics.traces` to assert gameplay → the trace is INERT; assert on it only in diagnostics/hash tests, never gate a move/rule on it
- `Game.setup()` seeds `G.diagnostics` → it must stay lazy-init at the writer (absent-on-fresh keeps both hashes stable)
- Most villain effects show `no-op` → you decided `no-op` by `targets.length`; many real-firing handlers (gain-wound, capture-bystander, reveal-or-wound, draw-cards-current, rescue-bystanders-current, scry-ko-own-deck) return empty `targets`. `no-op` is ONLY the fixed allowlist `{ become-scheme-twist, gain-attached-hero }` (adding a future deliberate-no-op handler requires adding it here, or it mislabels as `fired`)
- `params` carries an object/array/`undefined` value → you spread-and-cast the descriptor; copy ONLY the scalar param fields, omitting `undefined` keys (assert every `params` value is `typeof ∈ {string, number, boolean}` in `effectTrace.record.test.ts`)
- Traces carry `turn: 0` / `timing: ''` → you emitted inside the inner dispatch fn (`applyVillainEffect`/`executeSingleEffect`/`interpretHeroPrimitiveEffect`), which lacks `turn`+`timing` together; emit from the caller loop (`executeVillainAbilities`/`executeHeroEffects`)
- `record-game-fixture` `finalStateHash` fixtures churn → `recordEffectTrace` pushed a `G.messages` line (it must NOT — that is the one place it diverges from `recordHollowEffect`); write ONLY `G.diagnostics`
- AC-7 passes but the exclusion is missing → the test hashed an EMPTY-traces state both times; it MUST append real `EffectTrace`s before the second hash (an empty-vs-empty compare proves nothing; `PRE_WP080` is empty and cannot catch this)
