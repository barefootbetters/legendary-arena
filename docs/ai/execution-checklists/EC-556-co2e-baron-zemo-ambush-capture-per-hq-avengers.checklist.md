# EC-556 — co2e Baron Zemo Ambush: Capture per Avengers Hero in the HQ (Execution Checklist)

**Source:** docs/ai/work-packets/WP-521-co2e-baron-zemo-ambush-capture-per-hq-avengers.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] `VILLAIN_EFFECT_PRIMITIVES` union + array present (`rules/villainAbility.types.ts`, currently 16); the Tier-A fire path + `VILLAIN_EFFECT_HANDLERS`; `cardTraitMatches(G.cardTraits, cardId, kind, value)` (`villainEffects.execute.ts:1344`); `parseTraitPredicateTokens` (the `reveal-or-wound` predicate parser, `setup/villainAbility.setup.ts:487`).
- [ ] `attachBystanderToVillain(G.piles.bystanders, cardId, G.attachedBystanders)` exists (`board/bystanders.logic.ts:54`); the `capture-bystander` handler attaches-only at Ambush and the award happens at defeat (`fightVillain.ts:246`, D-18506).
- [ ] `G.hq` is a 5-tuple `[CardExtId|null ×5]`; the co2e Baron Zemo Ambush line is unmarked in `data/cards/co2e.json` (villains → masters-of-evil → baron-zemo).
- [ ] `pnpm -r build` 0; engine test + `ledger:villains:check` + `effect-index:check` green.

## Locked Values (do not re-derive)
- New primitive: `'capture-bystanders-plus-per-hq-hero-by-trait'` (append-only, D-24034; count 16 → 17; append at END of BOTH union and array). Marker grammar `[effect:capture-bystanders-plus-per-hq-hero-by-trait:team:avengers]` (a `:team:<v>` / `:hc:<v>` predicate).
- **Card marked (1):** `co2e/masters-of-evil/baron-zemo`, Ambush line → add `"baron-zemo": { "ambush": ["capture-bystanders-plus-per-hq-hero-by-trait:team:avengers"] }` under the `villains → co2e → masters-of-evil` block (create the block if WP-520 has not landed).
- Handler `villainEffectCaptureBystandersPlusPerHqHeroByTrait`: `count = 1 + countHqHeroesByTrait(G.hq, G.cardTraits, requireKind, requireValue)`; loop `count` times `attachBystanderToVillain`, `break` when `G.piles.bystanders` empty; **attach only — NO award at Ambush** (defeat awards, D-18506); `pushLog` the actual attached count (`applied` if ≥1, `blocked` if 0).
- Helper `countHqHeroesByTrait(hq, cardTraits, kind, value)`: count non-`null` `G.hq` slots where `cardTraitMatches(...)` is true. Local, pure, no mutation.
- **Parser arm** mirrors `reveal-or-wound`: `parseTraitPredicateTokens(parts)`; on null → return null (malformed → `unresolvedMarkers`); else `{ primitive, requireKind, requireValue }`.
- **Marker script:** append the primitive to `apply-effect-markers.mjs`'s local `VILLAIN_EFFECT_PRIMITIVES` array; its validator already accepts the `:<kind>:<value>` predicate tail (reveal-or-wound precedent).

## Guardrails
- Union + array lockstep (append-only); drift test (`villainAbility.types.test.ts`) bumps 16 → 17 with bidirectional parity + no-duplicates. Do not weaken.
- Base count is FIXED at 1; only the additional captures scale with the HQ trait count. Supply-bounded on `G.piles.bystanders`. No `.reduce()`.
- **Attach-only at Ambush** — never award now (the defeat fire site awards). The handler must not touch `zones.victory`.
- `countHqHeroesByTrait` scans `G.hq` ONLY — never player zones / city / villain deck. Do NOT modify the shared `cardTraitMatches` / `playerHasHeroMatchingTrait` / `countPlayerHeroesMatchingTrait`.
- No `ctx.random`. Self-narrate (keyword-less → `descriptorToLegacyKeyword` undefined → no `VillainEffectResult`).
- Net-new primitive → `{ "wp": "WP-521", "decision": "D-24334" }` in `mechanic-provenance.json`.
- ewiki (`wiki/card-effect-system.md`): add the primitive to the vocab list + a note (new HQ-by-trait scan).

## Required `// why:` Comments
- The HQ-scope scan: D-24334 — the printed "in the HQ" counts `G.hq` heroes by trait, the first HQ trait scan; player zones are never counted.
- Attach-only at Ambush: D-18506 — the award is deferred to defeat (matching `capture-bystander` Ambush semantics); awarding now would double-award.
- Base 1 + trait count: D-24334 — "captures a Bystander" (base 1) then "another for each [team:avengers] Hero in the HQ".
- The union/array entry: D-24334 (append-only 16 → 17).

## Files to Produce
- Engine: `rules/villainAbility.types.{ts,test.ts}` (16→17 + drift), `setup/villainAbility.setup.{ts,test.ts}` (parse arm + predicate parse test), `villain/villainEffects.execute.{ts,test.ts}` (handler + `countHqHeroesByTrait` + dispatch + tests) — **modified**
- Data/tooling: `apply-effect-markers.mjs` (1 array entry) + `inputs/villain-effect-markers.json` (co2e baron-zemo ambush row) + `data/cards/co2e.json` regen + `villain-mechanic-ledger.{json,csv}` + `effect-implementation-index.json` + `mechanic-provenance.json`
- ewiki: `wiki/card-effect-system.md`
- Governance: DECISIONS (D-24334), NUMBER-LEDGER, STATUS, WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `pnpm -r build` 0; engine test pass (handler base-1 + HQ-count + supply-bound + attach-not-award + <no Avengers>=1 + drift 16→17 + predicate parse)
- [ ] `ledger:villains:check` + `effect-index:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0
- [ ] `check:wiki` + `wiki-viewer:check-links` 0
- [ ] `git diff --name-only` = allowlist (+ regenerated artifacts)
- [ ] Baron Zemo (co2e) flips unmarked → executable with `{ WP-521, D-24334 }`; no `no-handler` when revealed
- [ ] Hashed oracles (`finalStateHash`/`PRE_WP080_HASH`/sentinel) UNCHANGED (no co2e MoE fixture) — or re-recorded via the canonical tool
- [ ] D-24334 Active; STATUS/WORK_INDEX `[x]`/EC_INDEX Done/mindmap ✅ + counts
- [ ] Live-verify (D-24026): reveal Baron Zemo with Avengers Heroes in HQ → captured count correct, awarded on his defeat

## Common Failure Smells
- Award happened at Ambush (bystanders in victory pile before defeat) → dropped the attach-only rule; remove the award call at Ambush timing.
- Count ignores the HQ / counts player heroes → wrong scan; `countHqHeroesByTrait` must read `G.hq`.
- `apply-effect-markers.mjs` loud-fails → primitive not in the script's local array, or the predicate tail rejected.
- Drift red → union/array not both bumped 16 → 17.
- `unresolvedMarkers` on the co2e Baron Zemo row → parser arm missing or predicate mis-parsed.
