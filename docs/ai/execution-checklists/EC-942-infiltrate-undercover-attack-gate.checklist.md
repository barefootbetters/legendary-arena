# EC-942 — Infiltrate the Conspiracy's "+3 Attack if 4 Bystanders and/or Undercover Heroes in your Victory Pile" gate (Execution Checklist)

**Source:** docs/ai/work-packets/WP-904-infiltrate-undercover-attack-gate.md
**Layer:** Game Engine (one condition-marker arm, a new on-play Victory-Pile count condition + evaluate/describe/count helper) + card data (one curated marker, one `VALID_TOKEN_PATTERN` arm, regenerated `bkwd.json`)
**Risk Tier:** MEDIUM — gameplay rules on one bkwd hero line (an ungated grant becomes conditional, lowering a phantom score), a new engine condition type, card data and derived feeds; `finalStateHash` sentinels byte-identical (no core card prints this line); no auth, money, persistence, server or client surface

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`; any edit outside it is a FAIL — surface it as an amendment.
- [ ] Baseline `origin/main` at or after the WP-904 reserve merge (#3451); WP-745 / D-24568, WP-653 / D-24464, WP-678 / D-24494, WP-901 / D-24858 Active. Capture `git rev-parse origin/main`.
- [ ] `pnpm -r build` then `pnpm -r --no-bail test` exit 0; record per-package totals.
- [ ] Re-observe the Infiltrate parse at HEAD (WP §Assumes): line 1 → ungated `{ attack, 3 }`, `conditions: []`. A different parse is a STOP.
- [ ] **Design fork (READ):** this EC implements **Reading A** (on-play present-state; the same-play parked Undercover send from line 0 is NOT counted). If the operator has chosen Reading B (defer the grant past `resolveUndercoverChoice`), STOP — the WP must be re-scoped; this EC does not cover the deferred-grant path.
- [ ] Confirm `HeroCondition.type` is an open `string` (no union / drift-array to update) and that `bystandersInVictoryAtLeast` is absent from `WAIT_AND_SEE_CONDITION_TYPES` / `PLAY_HISTORY_CONDITION_TYPES` / `ORDER_SAFE_ENABLER_CONDITION_TYPES` / `matchReadsConditionType` — the new sibling mirrors it.

## Locked Values (do not re-derive; verify at HEAD)
- **Marker** (`hero-ability-markers.json` → **`bkwd` set block**, next to the existing Infiltrate `abilityIndex: 0` entry — NOT the `apocalyptic-black-widow` block that also has a `bystanders-threshold:4` entry):
  `{ "heroSlug": "black-widow", "cardSlug": "infiltrate-the-conspiracy", "abilityIndex": 1, "markupToken": "[keyword:bystanders-or-undercover-threshold:4]" }`.
  `VALID_TOKEN_PATTERN` arm `^\[keyword:bystanders-or-undercover-threshold:[1-9]\d*\]$`; `assertValidToken` locked-forms message lists it.
- **Parser — TWO edits in `setup/heroAbility.setup.ts`:**
  1. A new arm next to the `bystanders-threshold` arm (L2178), before the unresolved fallback:
     `} else if (normalizedKeyword === 'bystanders-or-undercover-threshold') { const threshold = keywordMatch[2]; if (threshold !== undefined) { conditions.push({ type: 'bystandersOrUndercoverInVictoryAtLeast', value: threshold }); } }`. The keyword is NOT a `HeroKeyword` — no `HERO_KEYWORDS`, no length pin, no handler.
  2. Add `'bystanders-or-undercover-threshold'` to `HERO_PARSER_RECOGNIZED_MARKER_NAMES` (L431, next to `'bystanders-threshold'` at L471). Without it the coverage probe records a false hollow for bkwd Black Widow that corrupts the regenerated feeds. The data-driven pin at `heroAbility.setup.test.ts:2025` auto-covers the new name (and FAILS loudly if listed but the arm is unreachable) — the two edits are mutually guarded.
- **Condition type:** `bystandersOrUndercoverInVictoryAtLeast`. `evaluateCondition` case → `countBystandersOrUndercoverInVictory(G, playerID) >= parseInt(value, 10)` (`Number.isNaN(threshold)` → false). The describe case goes in `describeFailedCondition`'s switch (the function at L1248), beside the `bystandersInVictoryAtLeast` case at L1326 → `` it needs ${condition.value} Bystanders and/or Undercover Heroes in your Victory Pile — you have ${count} ``.
- **Count helper** (`hero/heroConditions.evaluate.ts`, private):
  `countBystandersOrUndercoverInVictory(G, playerID)` — `const zones = G.playerZones[playerID]; if (!zones) return 0;` build `const undercover = new Set(zones.undercover ?? []);`, `for (const cardId of zones.victory)` count `1` when `cardId === BYSTANDER_EXT_ID || (cardId as string).startsWith('bystander-villain-deck-') || undercover.has(cardId)`. `for...of`, no `.reduce()`. Count by membership in `victory`, never `undercover.length`.
- **Not registered:** do NOT add the type to `WAIT_AND_SEE_CONDITION_TYPES`, `PLAY_HISTORY_CONDITION_TYPES`, `ORDER_SAFE_ENABLER_CONDITION_TYPES`, or `matchReadsConditionType`.

## Guardrails
- No new `HeroKeyword`, `HERO_KEYWORDS` entry, handler, move, `CORE_MOVE_NAMES` entry, `G` key, phase or stage.
- The `+3[icon:attack]` grant stays on the hook (Step 2b); the marker adds only the gating condition. The line keeps `keywords: ['attack']`.
- Count reads `victory ∩ (bystanders ∪ undercover)` by membership in `victory` (Unleash-proof); never `undercover.length`.
- On-play present-state evaluation only; the same-play parked Undercover send is not counted (Reading A).
- `evaluateCondition` never mutates `G`; moves never throw; no `.reduce()`; runtime pins, not `satisfies` (D-24372).
- A sentinel or `finalStateHash` moving is a STOP, never a re-pin. `bkwd.json` regenerated from the marker map only; zero-diff re-run.

## Required `// why:` Comments
- The parser arm: WP-904 / D-24861 — Savior/`bystanders-threshold` present-state precedent widened to count Undercover Heroes; on-play (present-state "have", not a "this turn" window); the `:N` guard; the `+N[icon:attack]` stays via Step 2b.
- The `evaluateCondition` case: present-state Victory-Pile read; NaN threshold → false.
- The count helper: count by membership in `victory` (Unleash-proof — the append-only `undercover` tracker may outlive a card's Victory-Pile presence); a Bystander and an Undercover Hero are disjoint id spaces (no double count).
- The `describeFailedCondition` case: the running count the gate compares.
- D-24861 on the condition type (the reserved decision).

## Files to Produce
- `scripts/convert-cards/inputs/hero-ability-markers.json` — modified (one `bkwd` entry).
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — modified (`VALID_TOKEN_PATTERN` + `assertValidToken` message).
- `data/cards/bkwd.json` — generated (never hand-edited).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — modified (TWO edits: the condition-marker arm + the `HERO_PARSER_RECOGNIZED_MARKER_NAMES` entry).
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — modified (evaluate + describe + count helper).
- Generated / provenance: hero ledger `{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`, `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json` (if moved), `live-verify.json` (one pending row), dashboard copies (gitignored), `useInPlayCoverage.test.ts` (if moved). No `mechanic-provenance.json` row (no new keyword).
- Tests: `hero/infiltrateVictoryPileGate.test.ts` (new); `hero/heroConditions.evaluate.test.ts` — **hard-confirm at execution** whether an evaluate↔describe parity pin or a closed condition-type enumeration exists that must gain `bystandersOrUndercoverInVictoryAtLeast`; if so it is NOT optional and must be committed (search the test for an enumeration of condition types or a describe-every-type assertion before concluding it is unneeded).
- Close: `STATUS.md`, `DECISIONS.md` (D-24861), `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`, `docs/ai/post-mortems/` (01.6 if triggered).

## After Completing
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail (per-package totals); sentinels unchanged.
- [ ] Regenerate feeds, then 0: `cards:check`, `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`. Add the pending live-verify row BEFORE `ledger:heroes`.
- [ ] `EC-942:` commit (code + data), then `SPEC:` close: D-24861 Active, STATUS, WORK_INDEX `[x]` + `[live-verify: pending]`, EC_INDEX Done, mindmap ✅ + `pnpm roadmap:counts:write`; `roadmap:counts:check` → 0, NUMBER-LEDGER LANDED, 01.6 post-mortem if triggered.
- [ ] Live-on-surface (D-24026) in its own `SPEC:` PR after the deploy, or operator-pending in STATUS. The pending `live-verify.json` row explicitly records the accepted Reading-A boundary (exactly 3 qualifying going in; line 0's send of a 4th does NOT retroactively grant the +3), so the fidelity gap is documented, not latent.

## Common Failure Smells
- Infiltrate still grants +3 on every play — the marker not on `abilityIndex: 1`, the token missing from `VALID_TOKEN_PATTERN`, or the parser arm not reached (wrong `normalizedKeyword` spelling).
- The +3 vanishes entirely — the marker suppressed the icon instead of gating it (it must not; the grant stays via Step 2b, the condition gates).
- Count wrong by one — counting `undercover.length` instead of `victory ∩ undercover`, or double-counting a card that is both scanned branches.
- `describeFailedCondition` throws or returns the default — the case missing while the evaluate case exists (the coach's "did not apply" line then reads wrong).
- Sentinel or replay hash moved — a core card unexpectedly parses the marker, or a new `G` key was written.
- A second `apply-hero-ability-markers.mjs` run is not zero-diff — the idempotence guard not reached (the token already present check).
