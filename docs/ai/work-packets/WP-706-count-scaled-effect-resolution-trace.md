# WP-706 — Count-scaled effect resolution trace (the computed magnitude + counted inputs on the hash-excluded `EffectTrace`, carried to the Play Diagnostics export)

**Status:** Draft
**Primary Layer:** Game Engine (the `EffectTrace.resolution` capture on the hash-excluded `G.diagnostics` channel + a diagnostics-only counted-inputs explain + the engine-side `UIState.effectTraces` projection pass-through) + one Arena Client diagnostics-export test (the export already lifts traces as an opaque array — no client source change)
**Dependencies:** WP-488 / D-24294 (the `EffectTrace` on the hash-excluded `G.diagnostics.traces` channel, on `main`), WP-575 / D-24384 (the `UIState.effectTraces` projection + the arena-client Play Diagnostics export that lifts it, on `main`), WP-451 / D-24271 (the `computeStateHash`/replay `diagnostics` exclusion, on `main`), WP-703 / D-24523 (`cardHasClassWhenPlayed` honoring the additive `heroClass2`, on `main` — the motivating case this makes live-observable), WP-680 / D-24497 + WP-673/674/675 (the count-scaled `HeroCountSource` family + the `attack-per-count` / `recruit-per-count` executors, on `main`), D-24391 (`cardCountsAsTeamMember` honoring Copy-Powers teams, on `main`)

**User-Visible Surface:** `play.legendary-arena.com` (the Play Diagnostics export)

> Baseline: `origin/main` @ the reserve commit for WP-706 / EC-743 / D-24528 (or later — the `EffectTrace` channel, its `UIState.effectTraces` projection, the diagnostics export lift, and the count-scaled `HeroCountSource` family + dual-class `heroClass2` are all present).

---

## Goal

After this session, when a **count-scaled hero effect** resolves in a real match — the shipped `attack-per-count` / `recruit-per-count` family, dispatched via the standard hook-effects path, that grants `magnitude × floor(count / perEach)` of attack or recruit scaled by a `HeroCountSource` (Nick Fury *Legendary Commander* "+1 attack for each other S.H.I.E.L.D. Hero you played this turn"; Captain America *Perfect Teamwork* "+1 attack for each colour of Hero you played this turn"; the Deadpool / Avengers / cost-4+ / icon-count siblings; the count-scaled-*choose* family, vnom Symbiotic Adaptation, is a named follow-up — its dispatch site records no trace today) — the engine records the **realized computation** on the effect's hash-excluded `EffectTrace`: the count source, the resolved count, the per-each divisor, the computed grant, the resource, and the counted cards. That record rides the already-shipped `UIState.effectTraces` projection into the Play Diagnostics export, so a real deployed match can **prove** what a synergy actually resolved to — e.g. that *Perfect Teamwork* granted +3 attack because it counted three distinct hero colours across `[card-a, card-b, card-c]`, one of which contributed a colour **only via its `heroClass2`** (the WP-703 dual-class case). Today that computation is unit- and sim-verifiable only: the effect trace records empty declared params, the game log prints the card's base stats, `lastPlayEffectsFired` is a bare fired-count, and `heroEffectResolved` fires only for the reveal-for-attack family — so no live surface shows the computed magnitude or the counted inputs.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Persistence Boundaries` + `.claude/rules/architecture.md §G and ctx Are Runtime-Only` and `§Persistence Boundary (Cross-Layer)` — `G.diagnostics` is the framework/observability channel; this WP stays inside it.
- `.claude/rules/architecture.md §UIState Projection Integrity` — the **Board-Visible Field Rule**: a client-visible field added to `buildUIState` but not carried through `filterUIStateForAudience` is silently dropped at the whitelist (the EC-206 failure mode). The new `resolution` sub-field MUST be carried in **both** `uiState.build.ts` and `uiState.filter.ts`.
- `docs/ai/DECISIONS.md` — scan D-24294 (`G.diagnostics` is the ONLY hash-excluded channel; the `EffectTrace` shape; traces are INERT), D-24271 (`computeStateHash` diagnostics exclusion), D-24081 (the `messages` oracle exclusion — why the game-log path is NOT chosen here), D-24384 (the `UIState.effectTraces` projection + export), D-24516 (why player-facing outcome is NOT reconstructed from `effectTraces` in the client — respected here), D-24523 (dual-class `heroClass2`), D-24497/D-24391 (the count sources + Copy-Powers team counting). This WP lands **D-24528** (reserved), extending D-24294.
- `packages/game-engine/src/diagnostics/hollowEffect.types.ts` — the `EffectTrace` interface + `EFFECT_TRACES_CAP`; the additive `resolution?` field lands here.
- `packages/game-engine/src/diagnostics/effectTrace.record.ts` — `recordEffectTrace(G, trace)` (lazy-init, cap-bounded, never `pushLog`s). The record is built by the caller and passed in; no writer change unless the builder needs it.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — count-scaled effects dispatch through the **legacy `hook.effects` path**: `runHookEffects` calls `executeSingleEffect` (which returns a bare boolean) and then builds the effect's trace via **`buildHeroLegacyEffectTrace`** (fireSite `hero-executor`) — NOT `buildHeroPrimitiveEffectTrace`. The `attack-per-count` / `recruit-per-count` executors are `void` and the computed `count` / `perEach` / `magnitude` / grant never leave them, so they are **not** co-located with the trace build. The capture therefore **re-resolves** the resolution at the trace-build site (see §Scope C) — deterministic because the grant adds to `turnEconomy` and never moves `inPlay` cards, so an immediately-following `resolveCountSource` re-read returns the identical count. `buildHeroEffectTraceParams` already writes `countSource` + `magnitude` into `params` for these traces (mild redundancy with `resolution`, acceptable).
- `packages/game-engine/src/hero/heroCountSource.resolve.ts` — `resolveCountSource(G, playerID, source, triggeringCardId?)` returns a bare integer; the per-source counters iterate `playerZones.inPlay` (or `.victory`) with mostly **inline, private** matching logic and discard the matches. The diagnostics-only `explainCountSourceInputs` mirrors each played-this-turn counter's matching logic in ext-id-collecting form (sharing `cardCountsAsTeamMember` where it already exists) — its safety guarantee is not "reuses one predicate" but that `resolveCountSource` itself is **untouched**, so the integer the gameplay grant uses is byte-identical.
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — `countDistinctHeroClassesInPlay` (inlines `heroClass` + `heroClass2` + `getGrantedClasses` into a distinct-colour `Set`, honouring the WP-703 dual-class) is the counter behind `distinct-hero-classes-played-this-turn`; the explain for that source mirrors this inline Set logic (it does **not** call `cardHasClassWhenPlayed`, which is only the boolean `heroClassMatch` gate in `sizeChanging.logic.ts`). This is what makes a dual-class card's `heroClass2` contribution observable.
- `packages/game-engine/src/rules/heroCountSource.ts` — the closed `HeroCountSource` union + `CountScaledChoiceOption` (`countSource` / `magnitude` / `perEach`).
- `packages/game-engine/src/ui/uiState.build.ts` + `uiState.filter.ts` + `uiState.types.ts` — the `effectTraces` projection (field-by-field build + field-by-field filter pass-through; `UIState.effectTraces?: EffectTrace[]` reuses the engine type).
- `apps/arena-client/src/diagnostics/diagnostics.ts` — `extractEffectTraces` lifts `uiStateSnapshot.effectTraces` as an opaque `unknown[]`; the new sub-field rides for free (a test asserts it survives to the export).
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code (referenced by the constraints below).
- Auto-memory `project_effect_debugging_surface_arc` (the WP-484/487/488 debug-effects arc + the runtime-tracing posture), `reference_uistate_filter_whitelist_drops_fields` (the filter-drop failure mode), `project_hero_effect_resolved_overlay` (why the player-facing `heroEffectResolved` chip is a *separate* follow-up, not this WP).

---

## Assumes

- **WP-488 on `main`:** `packages/game-engine/src/diagnostics/hollowEffect.types.ts` exports `EffectTrace { cardId, scope, timing, effect, handler, status, fireSite, params, turn }` and `GameDiagnostics { …, traces?: EffectTrace[], tracesDropped? }`; `effectTrace.record.ts` exports `recordEffectTrace(G, trace)`; `G.diagnostics` is lazy-init (undefined on a fresh match) and traces are INERT (no move/rule/`endIf`/bot/scoring reads them).
- **WP-575 on `main`:** `UIState.effectTraces?: EffectTrace[]` exists; `uiState.build.ts` builds it (per-record field copy), `uiState.filter.ts` passes it through **field-by-field** for every audience value-unchanged (public, D-12803, no redaction), and `apps/arena-client/src/diagnostics/diagnostics.ts` `extractEffectTraces` lifts it from `uiStateSnapshot.effectTraces` structurally into the exported `DiagnosticReport.effectTraces`.
- **WP-451 / D-24271 on `main`:** `computeStateHash` (`packages/game-engine/src/replay/replay.hash.ts`) destructures **`diagnostics`** out before hashing; `packages/game-engine/src/test/fixtures/hashGameState.ts` also excludes `diagnostics`. `G.diagnostics` is blind to **both** oracles; `G.notableEvents` stays hashed (so it is NOT the channel used here).
- **Count-scaled family on `main`:** the closed `HeroCountSource` union (`rules/heroCountSource.ts`) + `resolveCountSource` (`hero/heroCountSource.resolve.ts`) + the `void` `attack-per-count` / `recruit-per-count` executors dispatched via `executeSingleEffect` from the legacy `hook.effects` loop `runHookEffects` (`heroEffects.execute.ts`); the executor normalizes `perEach` absent/≤0 → 1; `cardHasClassWhenPlayed` honours `heroClass2` (WP-703) and `cardCountsAsTeamMember` honours Copy-Powers teams (D-24391).
- **`CardExtId` on `main`:** the named `type CardExtId = string` alias is the zone/id type; `countedInputs` is `CardExtId[]`.

---

## Scope (In)

### A) Engine — the trace field (`packages/game-engine/src/diagnostics/hollowEffect.types.ts`)
- Add an additive optional `resolution?: EffectTraceResolution` to `EffectTrace`, and a new `EffectTraceResolution` interface: `{ countSource: HeroCountSource; resource: 'attack' | 'recruit'; magnitude: number; count: number; perEach: number; computedValue: number; countedInputs?: CardExtId[] }`. `countedInputs` is **omit-when-unavailable** (present for the played-this-turn card-counting sources; absent for the victory-pile sources in this slice). Header/why comment cites WP-706 / D-24528 and states the field is diagnostics-only, INERT, and hash-excluded (rides the existing `G.diagnostics` exclusion). Import `HeroCountSource` (type-only) + `CardExtId`.

### B) Engine — the counted-inputs explain (`packages/game-engine/src/hero/heroCountSource.resolve.ts`)
- Add a diagnostics-only `explainCountSourceInputs(G, playerID, source, triggeringCardId?): CardExtId[]` that, for the **played-this-turn** sources, iterates `playerZones.inPlay` and collects the ext-ids that source counts — mirroring each counter's matching logic in ext-id-collecting form (the cost/icon predicates are inline in the private counters, so explain mirrors them; `cardCountsAsTeamMember` is shared and reused for the team sources; `distinct-hero-classes-played-this-turn` mirrors `countDistinctHeroClassesInPlay`'s inline `heroClass`/`heroClass2`/`getGrantedClasses` gathering). It respects each source's self-inclusion rule (see below). Returns `[]` (→ omitted at the capture site) for the victory-pile sources (`victory-bystanders`, `shield-levels`) in this slice. **`resolveCountSource` is not modified** — the integer the grant uses is byte-identical; explain is a separate, additive read-only pass.
- **Self-inclusion (RS-3, the `countedInputs` invariant):** the seven per-card played-this-turn sources are self-**exclusive** (skip `triggeringCardId`), so `count === countedInputs.length`; `distinct-hero-classes-played-this-turn` is self-**inclusive** (counts distinct colours over all cards incl. the trigger), so `count <= countedInputs.length` (a distinct-colour rollup, not an error). `explainCountSourceInputs` mirrors each source's rule so the invariant test holds.

### C) Engine — the capture (`packages/game-engine/src/hero/heroEffects.execute.ts`)
- Count-scaled effects record their trace via `buildHeroLegacyEffectTrace` (fireSite `hero-executor`) in the `runHookEffects` caller loop, immediately after `executeSingleEffect` returns. The `void` executors do not surface `count`/`perEach`/`magnitude`/grant, so — for an `attack-per-count` / `recruit-per-count` effect — build the `resolution` record at that trace-build site by **re-resolving** `count = resolveCountSource(G, playerID, countSource, cardId)` and `countedInputs = explainCountSourceInputs(...)` from the (settled) `G`, reading `magnitude` / `perEach` off the effect descriptor with the **same** absent/≤0 → 1 normalization the executor applies (`perEach = descriptor.perEach > 0 ? descriptor.perEach : 1`, so `computedValue` matches the grant and never divides by 0/undefined), and computing `computedValue = magnitude × floor(count / perEach)`; omit `countedInputs` when the returned list is empty. The re-resolve is deterministic and matches the granted value because the grant added to `turnEconomy` without moving any `inPlay` card between the grant and the trace build (same caller-loop iteration). No new fire site, no new trace, no executor / `executeSingleEffect` signature change; the existing legacy trace gains the sub-record. Guarded exactly like the existing trace push (diagnostics is best-effort; never throw).

### D) Engine — the projection pass-through (`packages/game-engine/src/ui/uiState.build.ts` + `uiState.filter.ts`)
- Carry `resolution` through the per-record `effectTraces` copy in **both** `buildUIState` and `filterUIStateForAudience` — a fresh-object copy of `resolution` (and a fresh `countedInputs` array) for aliasing defence (D-11105), conditional assignment so an absent `resolution` omits the key (exactOptionalPropertyTypes). `UIState.effectTraces` reuses the engine `EffectTrace` type, so `uiState.types.ts` needs no field edit — but confirm the type resolves and the two pass-throughs are the only field-gates.

### E) Engine tests
- `hollowEffect.types.test.ts` — `EffectTraceResolution` round-trips through JSON; `resolution` is optional on `EffectTrace`.
- `heroCountSource.resolve.test.ts` — `explainCountSourceInputs` returns the matched ext-ids for a played-this-turn source (with `count === countedInputs.length` for the per-card sources), returns `[]` for a victory-pile source, and — the load-bearing assertion — for `distinct-hero-classes-played-this-turn` includes a dual-class card whose contributed colour is matched **only via `heroClass2`**; `resolveCountSource` returns the same integer with and without the explain call (byte-identical gameplay path).
- `heroEffects.execute.test.ts` — a count-scaled dispatch records a trace whose `resolution` names `{countSource, resource, magnitude, count, perEach, computedValue}` and `computedValue === magnitude × floor(count / perEach)`; a non-count-scaled dispatch records **no** `resolution`; the capture is guarded (no throw on a minimal mock omitting `G.diagnostics`); and — pinning the deliberate redundancy — for a count-scaled trace `params.countSource === resolution.countSource` and `params.magnitude === resolution.magnitude` (so the two representations cannot silently diverge).
- `uiState.filter.test.ts` — a built `UIState.effectTraces` record carrying `resolution` survives `filterUIStateForAudience` for every audience value-unchanged (the Board-Visible Field Rule regression), and an absent `resolution` stays omitted.
- `uiState.types.drift.test.ts` — the existing runtime keyset drift pin on the projected `EffectTrace` (the WP-562 "optional-add passes a keyset check silently" guard) is **extended**: add a second fixture whose seeded trace carries a `resolution` sub-record and assert the built projection's keyset includes `resolution` (the ten-key case, incl. the nested `resolution` + `countedInputs` surviving the build copy), and update the stale "exactly nine EffectTrace keys" wording to "nine required + the optional `resolution`." Without this the pin stays green but stops guarding the widened field-set — the exact drift class the copilot gate flagged.

### F) Arena Client test (`apps/arena-client/src/diagnostics/diagnostics.test.ts`)
- Assert the exported `DiagnosticReport.effectTraces` carries the `resolution` sub-record from a snapshot that includes it (the opaque lift preserves it end-to-end — the D-24026 verification aid). No arena-client source change.

---

## Out of Scope

- **The game-log economy clause (option a).** `formatBaseEconomyClause` (`log/logDisplay.ts`) prints the played card's **base** stats and is actively misleading for a count-scaled card (it shows the printed `N+`, not the computed grant). Fixing it is a real correctness papercut — but the log lives in `G.messages`, which the `messages` oracle fixtures (`assertMessagesOracle`) and `computeStateHash` **do** cover (only `finalStateHash` excludes it), so a log-line text change re-pins the replay/messages oracle. This WP deliberately routes the computed detail to the **non-hashed** `G.diagnostics` channel instead. The log fix is a named follow-up: either an honest messages-oracle re-pin, or route the computed clause to the diagnostics/`heroEffectResolved` surface.
- **A player-facing `heroEffectResolved` chip for count synergies.** Riding the WP-697 notable-event bucket to raise an on-screen "counted 3 colours" chip is *player feedback*, a different concern from *verifiability*, and count-scaled grants already surface an audible combo cue (WP-413) + a synergy call-out (WP-556). A chip is a named follow-up, not this WP.
- **The count-scaled-*choose* family (`resolveCountScaledChoice`, vnom Symbiotic Adaptation, WP-675/679).** That move (`packages/game-engine/src/moves/countScaledChoice.resolve.ts`) dispatches `attack-per-count` / `recruit-per-count` via `executeSingleEffect` at a site **outside** `runHookEffects` that builds **no `EffectTrace` at all** today. Adding a trace + resolution there is a *new* fire site — a larger change than this slice's enrichment of the existing legacy trace — so the choose-one dispatch is a named follow-up. This slice's "single site" is the standard hook-effects path, which covers the direct count-scaled cards (Nick Fury, Perfect Teamwork, Avengers Assemble, the cost-4+ / icon / odd-cost siblings) — the primary motivation.
- **`countedInputs` for the victory-pile count sources** (`victory-bystanders`, `shield-levels`) — those enumerate the Victory Pile, not cards-played-this-turn, so they need their own explain shape; captured with `count`/`computedValue` only in this slice, `countedInputs` omitted, follow-up.
- **Per-colour attribution for the distinct-class source.** Slice 1 lists the counted cards; recording *which colour* each card contributed (and flagging the ones contributed via `heroClass2`) is a refinement follow-up — the card list + the count already make the dual-class contribution observable.
- **Villain / mastermind / henchman count effects, zone-helper-touch capture, and any `/debug/effects` viewer surface** — the debug-effects dashboard is a build-time static index that never sees a live match (WP-484/487); it is the wrong surface for live verification and stays deferred (WP-488 §Out of Scope).
- **Any gameplay-outcome change.** This WP records what the engine already computes; it changes no grant, no move, no hash.

---

## Files Expected to Change

- `packages/game-engine/src/diagnostics/hollowEffect.types.ts` + `hollowEffect.types.test.ts`
- `packages/game-engine/src/hero/heroCountSource.resolve.ts` + `heroCountSource.resolve.test.ts`
- `packages/game-engine/src/hero/heroEffects.execute.ts` + `heroEffects.execute.test.ts`
- `packages/game-engine/src/ui/uiState.build.ts` + `packages/game-engine/src/ui/uiState.filter.ts` + `uiState.filter.test.ts` + `uiState.types.drift.test.ts` (extend the effectTraces keyset pin)
- `apps/arena-client/src/diagnostics/diagnostics.test.ts`

Governance / generated artifacts (`STATUS.md`, `DECISIONS.md` lands D-24528, `WORK_INDEX.md`, `EC_INDEX.md`, `NUMBER-LEDGER.md` mark reservations landed, `05-ROADMAP-MINDMAP.md` + its count table) ride the governance-close commit (the universal repo pattern).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Produce **full file contents** for every new or modified file. Diffs, snippets, and "show only the changed section" are forbidden.
- ESM only; Node v22+; `node:` prefix on built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: explicit control flow, descriptive names, no `.reduce()` in the capture/explain path (use `for...of`), no nested ternaries, a JSDoc on every function.
- Determinism: no `Math.random()` / wall-clock / I/O in engine code; `explainCountSourceInputs` is a pure read-only pass (no `G` mutation, no `ctx.random`).

**Packet-specific:**
- **Determinism (the safety contract).** The `resolution` record lives on `EffectTrace` inside `G.diagnostics`, which **both** oracles already exclude (`computeStateHash` destructures `diagnostics`, D-24271; `hashGameState` excludes it, D-24081-lineage). Adding a field to an already-excluded channel is hash-inert — **NO re-pin** of `PRE_WP080_HASH` or `finalStateHash`. VERIFY empirically: the replay/sentinel/determinism suite passes byte-unchanged. If a pin goes red, a mutation leaked outside `G.diagnostics`: **STOP** and find it; never edit a pin to force green.
- **The gameplay grant path is untouched.** `resolveCountSource` returns the same integer the grant uses; `countedInputs` is captured by a **separate** `explainCountSourceInputs` that only reads. A count-scaled play must grant exactly what it grants today. Assert it: `resolveCountSource` returns identically with and without an explain call.
- **INERT (D-24294).** No move, rule, `endIf`, bot, scoring, or PAR path reads `resolution`. It is observability-only.
- **Board-Visible Field Rule (the one real footgun).** `resolution` must be carried in **both** `uiState.build.ts` and `uiState.filter.ts` — a field built but not filtered is silently dropped at the whitelist (EC-206). A filter regression test asserts it survives.
- **`countedInputs` invariant.** For the per-card played-this-turn sources, `count === countedInputs.length`; for `distinct-hero-classes-played-this-turn`, `count` is the distinct-colour rollup so `count <= countedInputs.length` (documented, not an error); for the victory-pile sources, `countedInputs` is omitted.
- **JSON-safe + capped.** `resolution` is plain scalars + a string array; it rides the existing `EFFECT_TRACES_CAP` (no new cap, no unbounded growth).

**Session protocol:** if any scope classification is ambiguous — a second capture site, a determinism re-pin, a `resolveCountSource` signature change, a contract-file touch — STOP and re-read `.claude/rules/architecture.md`; do not guess or expand scope.

**Locked contract values (do not re-derive):**
- `EffectTraceResolution { countSource: HeroCountSource; resource: 'attack' | 'recruit'; magnitude: number; count: number; perEach: number; computedValue: number; countedInputs?: CardExtId[] }` — additive optional `resolution?` on `EffectTrace`; `computedValue === magnitude × floor(count / perEach)`.
- `explainCountSourceInputs(G, playerID, source, triggeringCardId?): CardExtId[]` — diagnostics-only; mirrors each played-this-turn counter's matching logic in ext-id-collecting form (shares `cardCountsAsTeamMember`; mirrors `countDistinctHeroClassesInPlay`'s inline Set for the class source); `[]` for victory-pile sources; **does not** modify `resolveCountSource` (that integer stays byte-identical). Respects self-inclusion: self-exclusive for the seven per-card sources (`count === countedInputs.length`), self-inclusive for `distinct-hero-classes-played-this-turn` (`count <= countedInputs.length`, a distinct-colour rollup).
- Slice-1 `countedInputs`-bearing sources (the played-this-turn family): `distinct-hero-classes-played-this-turn`, `avengers-played-this-turn`, `shield-heroes-played-this-turn`, `cost-four-plus-played-this-turn`, `worthy-cards-played-this-turn`, `odd-cost-heroes-played-this-turn`, `attack-icon-played-this-turn`, `recruit-icon-played-this-turn`. Omitted-`countedInputs` sources: `victory-bystanders`, `shield-levels`.
- Capture site: `buildHeroLegacyEffectTrace` (fireSite `hero-executor`) in `runHookEffects` (`heroEffects.execute.ts`) — the resolution is re-resolved from settled `G` at trace-build (deterministic; grant does not move `inPlay`), NOT threaded from the `void` executor and NOT via a signature change to `executeSingleEffect`. One site; no new fire site. The `resolveCountScaledChoice` dispatch site is explicitly OUT of scope (it records no trace today).
- Determinism: NO re-pin of `PRE_WP080_HASH` / `finalStateHash` (diagnostics is hash-excluded) — verify empirically.

---

## Vision Alignment

**Vision clauses touched:** §8 (Determinism guarantees) — a new field on a `G` sub-object, even a hash-excluded one, is determinism-adjacent; §22 (replay faithfulness) — the field must not perturb replay.

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.`

**Non-Goal proximity check:** NG-1..7 preserved — this is observability of what the engine already computes (no pay-to-win, no PvP, no monetization, no identity, no card-data change).

**Determinism preservation:** the `resolution` record is written only onto `G.diagnostics` (INERT, excluded from **both** the replay `computeStateHash` oracle and the fixture `hashGameState` oracle); the gameplay `resolveCountSource` integer and every grant are byte-identical; `explainCountSourceInputs` is a pure read-only pass. Expected result: **no re-pin** of `PRE_WP080_HASH` / `finalStateHash`, verified empirically (the replay/sentinel/determinism suite passes unchanged). The D-24365 VFX exemption is not invoked (no VFX).

## Funding Surface Gate

N/A — no funding affordance, channel, or user-visible funding copy; this is diagnostics/observability for gameplay verification. (Per §20.1: none of the WP-097 §A/§B/§C surfaces are touched.)

## API Catalog

N/A — no HTTP endpoint added/modified/removed, and no `apps/server/src/**` library function touched; this is a game-engine change surfaced through the existing WP-575 diagnostics export, with no server surface.

---

## Acceptance Criteria

- [ ] `EffectTrace` gains an additive optional `resolution?: EffectTraceResolution`; `EffectTraceResolution { countSource, resource, magnitude, count, perEach, computedValue, countedInputs? }` round-trips through JSON.
- [ ] `explainCountSourceInputs` returns the matched ext-ids for a played-this-turn source (`count === countedInputs.length` for the per-card sources), returns `[]` for a victory-pile source, and — for `distinct-hero-classes-played-this-turn` — includes a dual-class card whose colour is matched only via `heroClass2` (the WP-703 live-observability tie).
- [ ] `resolveCountSource` returns the identical integer with and without an `explainCountSourceInputs` call (the gameplay grant path is byte-unchanged).
- [ ] A count-scaled dispatch records a trace whose `resolution` carries the correct scalars with `computedValue === magnitude × floor(count / perEach)`; a non-count-scaled dispatch records no `resolution`; the capture is guarded (no throw on a minimal mock without `G.diagnostics`).
- [ ] `resolution` survives `filterUIStateForAudience` for every audience value-unchanged (Board-Visible Field Rule), and an absent `resolution` stays omitted.
- [ ] The exported `DiagnosticReport.effectTraces` carries the `resolution` sub-record end-to-end (arena-client extract preserves the opaque lift).
- [ ] **NO hash re-pin** — the replay/sentinel/determinism suite passes byte-unchanged (`PRE_WP080_HASH` + the sentinel `finalStateHash`); the full engine suite is green; `pnpm -r build` 0; arena-client `vue-tsc` 0 + suite green.

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0

pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; replay/sentinel hash pins UNCHANGED (no re-pin — resolution lives on the hash-excluded G.diagnostics)

pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: vue-tsc 0; all tests pass (incl. the diagnostics-export resolution round-trip)

Select-String -Path "packages\game-engine\src\hero\heroCountSource.resolve.ts" -Pattern "export function resolveCountSource"
# Expected: exactly one match — the gameplay resolver is not duplicated; explainCountSourceInputs is a separate export

Select-String -Path "packages\game-engine\src\ui\uiState.filter.ts" -Pattern "resolution"
# Expected: at least one match — the resolution field IS carried through the audience filter (Board-Visible Field Rule)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com` Play Diagnostics export, D-24026):** a real deployed match that plays a count-scaled hero card, exported via the Play Diagnostics button, carries an `effectTraces` record whose `resolution` names the count source, the computed grant, and the counted cards — ideally a `distinct-hero-classes-played-this-turn` play with a dual-class hero so the `heroClass2` contribution is visible. (Confirm the export's `gitSha` is a descendant of this WP's merge commit first — the WP-697/WP-575 live-verify method.)
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; engine + arena-client suites pass; `vue-tsc` 0.
- [ ] `docs/ai/DECISIONS.md` — land D-24528 (Active).
- [ ] `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md` (+ counts), `NUMBER-LEDGER.md` (mark reservations landed) updated in the governance-close commit; no files outside `## Files Expected to Change` (plus governance artifacts) modified.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `## Out of Scope` lists ≥2 explicit exclusions (the game-log fix; the player-facing chip; the victory-pile countedInputs; the debug-effects viewer).
- **§2 Constraints** — PASS. Engine-wide (full file contents, no diffs, ESM/Node22, 00.6 reference) + packet-specific (determinism/hash-excluded, gameplay-path-untouched, INERT, Board-Visible Field Rule, countedInputs invariant) + session protocol + locked contract values.
- **§3 Assumes** — PASS. WP-488/575/451/703 + the count-scaled family named with exact exports/paths and the shapes they must have.
- **§4 Context (Read First)** — PASS. Specific files + D-entries + the architecture Board-Visible Field Rule + memories, each with the reason it's read.
- **§5 Files** — PASS. Five engine source files + five engine test files (incl. the extended `uiState.types.drift.test.ts` keyset pin) + one arena-client test, each named and marked; bounded (5 source, ≤8), no ambiguous "update this section" language.
- **§6 Naming** — PASS. `EffectTraceResolution`, `explainCountSourceInputs`, `countedInputs`, `computedValue`; `CardExtId` / `HeroCountSource` used verbatim; no abbreviations; no 00.2 field surface touched.
- **§7 Dependencies** — PASS. No new npm dependency.
- **§8 Boundaries** — PASS. Engine records the data + owns the projection; the arena-client only lifts the opaque array (existing WP-575 seam); no DB/WebSocket/registry-at-runtime; `G.diagnostics` persistence posture preserved (INERT, hash-excluded).
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env / §11 Auth** — N/A (no env vars; no authentication surface).
- **§12 Tests** — PASS. engine `node:test` + arena-client `node:test`; no `boardgame.io/testing`; deterministic.
- **§13 Verification** — PASS. Exact `pnpm` commands + the no-re-pin expectation + the resolver-not-duplicated + filter-carries-resolution greps.
- **§14 Acceptance** — PASS. Seven binary, observable, file/function-specific checks aligned to scope.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX + scope-boundary check + the D-24026 live-on-surface item (surface ≠ `none`).
- **§16 Code style** — PASS. `for...of` in the explain/capture, explicit control flow, JSDoc required, no premature abstraction (the explain reuses existing predicates; no new shared helper below the third copy).
- **§17 Vision** — PASS. `## Vision Alignment` present with the §8/§22 clauses + the determinism-preservation line.
- **§18 Prose-vs-grep** — PASS. The `resolveCountSource` grep is scoped to `export function resolveCountSource` (not the bare token) and the `resolution` grep is a presence check (must match), so neither is a forbidden-token false-positive gate.
- **§19 Bridge** — N/A (not a repo-state-summarizing artifact).
- **§20 Funding** — N/A with justification (no WP-097 §A/§B/§C surface, no funding copy).
- **§21 API Catalog** — N/A with justification (no `apps/server` endpoint or library function).

**Lint verdict: PASS (all 21 resolved).**

---

## Gate Verdicts (executed in the drafting session, independent subagents)

- **Pre-flight (01.4): READY TO EXECUTE** (independent subagent, two passes). Pass 1 returned NOT READY on two blocking findings, both fixed in-place: PS-1 — the capture mechanism was mis-described (count-scaled effects use the legacy `hook.effects` path via `buildHeroLegacyEffectTrace`, not `buildHeroPrimitiveEffectTrace`, and the `void` executors don't surface the computed values) → rewritten to **re-resolve** the resolution at the `runHookEffects` trace-build site (verified deterministic: the grant adds to `turnEconomy` without moving `inPlay` in the same loop iteration, so the re-read equals the granted count, no signature change); PS-2 — a second count-scaled dispatch site (`resolveCountScaledChoice` / vnom Symbiotic Adaptation) records no trace today → explicitly scope-excluded as a named follow-up. Pass 2 verified both fixes against the real control flow and returned **READY TO EXECUTE**, with four non-blocking RS accuracy nits (caller-loop name `runHookEffects`, stale Assumes line, `perEach` absent/≤0→1 normalization, EC guardrail wording) — all folded in.
- **Copilot (01.7): PASS** (independent subagent, two passes). Pass 1 returned RISK → SUSPEND on one genuine WP-562/EC-206 drift-class gap: the existing runtime keyset drift pin `uiState.types.drift.test.ts` (which guards the projected `EffectTrace` field-set) was not in the allowlist, so widening it with `resolution` would leave the pin green but stale. Fixed by adding that test to the allowlist + requiring a `resolution`-bearing ten-key fixture (verified the pin lives at `uiState.types.drift.test.ts:1347`). Two scope-neutral HOLD nits also folded: state the re-resolve computes in the `runHookEffects` caller and passes into `buildHeroLegacyEffectTrace` (pure assembler, no signature fold); and pin `params.countSource`/`magnitude` agreement with `resolution` against silent divergence. Pass 2 returned **CONFIRM / PASS** — all three resolved by construction, allowlist bounded (5 source + 6 test), determinism/persistence/Board-Visible-Field/non-vacuity posture unchanged.

---

## See Also

- [WP-488](WP-488-effect-runtime-tracing.md) / D-24294 — the runtime `EffectTrace` on the hash-excluded `G.diagnostics` channel this enriches
- [WP-575](WP-575-diagnostics-report-carries-no-effect-trace.md) / D-24384 — the `UIState.effectTraces` projection + the Play Diagnostics export this rides
- [WP-703](WP-703-dual-class-engine.md) / D-24523 — the dual-class `heroClass2` this makes live-observable (its D-24026 live-verify is otherwise unit/sim-only)
- WP-680 / D-24497 + WP-673/674/675 — the count-scaled `HeroCountSource` family + the `attack-per-count` / `recruit-per-count` executors
- `project_effect_debugging_surface_arc`, `reference_uistate_filter_whitelist_drops_fields`, `project_hero_effect_resolved_overlay` — the debug-effects arc, the filter-drop failure mode, and why the player-facing chip is a separate follow-up
