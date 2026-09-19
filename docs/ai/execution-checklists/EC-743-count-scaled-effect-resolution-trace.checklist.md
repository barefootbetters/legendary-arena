# EC-743 — Count-scaled effect resolution trace (Execution Checklist)

**Source:** docs/ai/work-packets/WP-706-count-scaled-effect-resolution-trace.md
**Layer:** Game Engine (+ one Arena Client diagnostics-export test)

## Before Starting
- [ ] WP-488 / D-24294 on `main`: `EffectTrace` + `recordEffectTrace` + `G.diagnostics` lazy-init + INERT traces.
- [ ] WP-575 / D-24384 on `main`: `UIState.effectTraces` built (`uiState.build.ts`) + filtered field-by-field (`uiState.filter.ts`) + lifted by arena-client `extractEffectTraces`.
- [ ] WP-451 / D-24271 on `main`: `computeStateHash` AND `hashGameState` both exclude `G.diagnostics`.
- [ ] WP-703 / D-24523 on `main`: `cardHasClassWhenPlayed` honours `heroClass2`; the count-scaled `HeroCountSource` family + `attack-per-count` / `recruit-per-count` executors present.
- [ ] Scope lock — target file set is EXACTLY the `Files to Produce` list; any file outside it is a FAIL, surface it as a blocker before editing.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0 (baseline).

## Locked Values (do not re-derive)
- `EffectTraceResolution { countSource: HeroCountSource; resource: 'attack' | 'recruit'; magnitude: number; count: number; perEach: number; computedValue: number; countedInputs?: CardExtId[] }`; additive optional `resolution?` on `EffectTrace`.
- `computedValue === magnitude × floor(count / perEach)`, with `perEach` normalized absent/≤0 → 1 (same as the executor) so it never divides by 0/undefined.
- `explainCountSourceInputs(G, playerID, source, triggeringCardId?): CardExtId[]` — diagnostics-only; mirrors each played-this-turn counter's matching logic in ext-id-collecting form (shares `cardCountsAsTeamMember`; mirrors `countDistinctHeroClassesInPlay`'s inline `heroClass`/`heroClass2`/`getGrantedClasses` Set for the class source — it does NOT call `cardHasClassWhenPlayed`); returns `[]` for `victory-bystanders` / `shield-levels`; **does NOT modify `resolveCountSource`** (that integer stays byte-identical). Self-**exclusive** for the 7 per-card sources (`count === countedInputs.length`), self-**inclusive** for `distinct-hero-classes-played-this-turn` (`count <= countedInputs.length`).
- `countedInputs`-bearing (played-this-turn) sources: `distinct-hero-classes-played-this-turn`, `avengers-played-this-turn`, `shield-heroes-played-this-turn`, `cost-four-plus-played-this-turn`, `worthy-cards-played-this-turn`, `odd-cost-heroes-played-this-turn`, `attack-icon-played-this-turn`, `recruit-icon-played-this-turn`. Omitted: `victory-bystanders`, `shield-levels`.
- Capture site: `buildHeroLegacyEffectTrace` (fireSite `hero-executor`) in `runHookEffects` (`heroEffects.execute.ts`) — the `void` `attack-per-count`/`recruit-per-count` executors do not surface the values, so **re-resolve** `count`/`countedInputs` from settled `G` at the trace-build site (`computedValue = magnitude × floor(count / perEach)`, `magnitude`/`perEach` off the descriptor). Deterministic: the grant added to `turnEconomy` without moving `inPlay` (same caller-loop iteration). Compute `resolution` in the `runHookEffects` caller (it already holds `G`/`playerID`/`effect`) and PASS it into `buildHeroLegacyEffectTrace` — keep that builder a pure record assembler; do NOT fold resolve+explain into it. NO new fire site, NO new trace, NO `executeSingleEffect`/executor signature change. The `resolveCountScaledChoice` dispatch (`moves/countScaledChoice.resolve.ts`, vnom Symbiotic Adaptation) is OUT of scope — it records no trace today.
- Determinism: NO re-pin of `PRE_WP080_HASH` / `finalStateHash` (resolution lives on the hash-excluded `G.diagnostics`) — verify empirically.

## Guardrails
- `G.diagnostics` is the ONLY hash-excluded channel — keep every write inside it; a re-pin means a mutation leaked out → STOP, find it, never edit a pin to force green.
- Gameplay grant path untouched: `resolveCountSource` returns the same integer; `explainCountSourceInputs` only reads. Assert identical resolver output with/without the explain call.
- Capture is a diagnostics-only **re-resolve** at trace-build (not a threaded value, not a signature change). It matches the grant only because no `inPlay` card moves between grant and trace in the same caller-loop iteration — if that ever changes, the re-resolve is wrong; keep the re-resolve immediately adjacent to the trace build.
- Do NOT add a trace at `resolveCountScaledChoice` (`moves/countScaledChoice.resolve.ts`) — that site is OUT of scope and is NOT in the file list; touching it is a scope violation (surface it as a blocker, not an inline fix).
- INERT (D-24294): nothing (move/rule/`endIf`/bot/scoring/PAR) reads `resolution`.
- **Board-Visible Field Rule:** carry `resolution` in BOTH `uiState.build.ts` AND `uiState.filter.ts` (a build-only add is silently dropped at the filter whitelist — EC-206). Fresh-object copy of `resolution` + a fresh `countedInputs` array (aliasing defence, D-11105); conditional assignment (absent ⇒ omitted, exactOptionalPropertyTypes).
- `countedInputs` invariant: `count === countedInputs.length` for per-card sources; `count <= length` for distinct-class (documented); omitted for victory-pile sources.
- No `.reduce()` in the explain/capture; `for...of` + descriptive names; JSDoc on every new function. `explainCountSourceInputs` mirrors each counter's matching logic in ext-id-collecting form (shares `cardCountsAsTeamMember`; mirrors `countDistinctHeroClassesInPlay`'s inline Set — NOT `cardHasClassWhenPlayed` — for the class source; may import `getGrantedClasses`); it does NOT edit `heroConditions.evaluate.ts` (read-only reference, not in the file list).

## Required `// why:` Comments
- `EffectTraceResolution` declaration: why it is diagnostics-only, INERT, and hash-excluded (rides the D-24294 `G.diagnostics` exclusion; cite WP-706 / D-24528).
- `explainCountSourceInputs`: why it is a separate read-only pass and NOT folded into `resolveCountSource` (keep the gameplay integer byte-identical → determinism).
- The `uiState.filter.ts` `resolution` copy: why it must mirror `uiState.build.ts` (Board-Visible Field Rule / EC-206).

## Files to Produce
- `packages/game-engine/src/diagnostics/hollowEffect.types.ts` — **modified** — add `EffectTraceResolution` + optional `resolution?` on `EffectTrace`.
- `packages/game-engine/src/diagnostics/hollowEffect.types.test.ts` — **modified** — resolution JSON round-trip + optionality.
- `packages/game-engine/src/hero/heroCountSource.resolve.ts` — **modified** — add `explainCountSourceInputs` (resolver untouched).
- `packages/game-engine/src/hero/heroCountSource.resolve.test.ts` — **modified** — explain matches (incl. `heroClass2`), `[]` for pile sources, resolver byte-identical.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — compute `resolution` in the `runHookEffects` caller (holds `G`/`playerID`/`effect`) and pass it into `buildHeroLegacyEffectTrace`; guarded.
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — resolution present on count-scaled, absent otherwise, guarded, and `params.countSource`/`magnitude` agree with `resolution`.
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — carry `resolution` in the `effectTraces` build.
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — carry `resolution` through the field-by-field pass-through.
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — resolution survives every audience; absent stays omitted.
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — extend the effectTraces keyset pin with a `resolution`-bearing fixture (ten-key case); fix the stale "exactly nine keys" wording. (WP-562 optional-add drift class.)
- `apps/arena-client/src/diagnostics/diagnostics.test.ts` — **modified** — exported report carries `resolution` end-to-end.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0 (replay/sentinel pins byte-unchanged — NO re-pin).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] `pnpm -r build` exits 0.
- [ ] Live-on-surface verification (D-24026) — a real exported match's `effectTraces` carries the `resolution` record for a count-scaled play (ideally a distinct-class play with a dual-class hero).
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` lands D-24528 (Active); `NUMBER-LEDGER.md` reservations marked landed.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date; `docs/ai/execution-checklists/EC_INDEX.md` → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — node glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- A red `PRE_WP080_HASH` / `finalStateHash` pin → a mutation leaked outside `G.diagnostics` (or the explain accidentally wrote `G`); STOP, don't re-pin.
- `resolution` present in a diagnostics snapshot but ABSENT in the exported report → the `uiState.filter.ts` pass-through was missed (Board-Visible Field Rule).
- A count-scaled grant value changed vs baseline → `resolveCountSource` was altered instead of adding a separate explain; revert and split.
