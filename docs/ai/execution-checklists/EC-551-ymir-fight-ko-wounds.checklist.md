# EC-551 — Ymir (Villain) Fight: KO Your Wounds from Hand + Discard (Execution Checklist)

**Source:** docs/ai/work-packets/WP-516-ymir-fight-ko-wounds.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] `VillainEffectPrimitive` union + `VILLAIN_EFFECT_PRIMITIVES` array present (`rules/villainAbility.types.ts`); the marker pipeline (`apply-effect-markers.mjs` + `inputs/villain-effect-markers.json`); the Tier-A fire path `executeVillainAbilities` → `applyVillainEffect(G, currentPlayer, …)` with the `VILLAIN_EFFECT_HANDLERS` record.
- [ ] Confirm the Ymir card (`data/cards/core.json`, enemies-of-asgard group) Fight line is still ability index 1 and still hollow (no `[effect:]` marker); the Ambush line already carries `[effect:reveal-or-wound:hc:ranged]` — leave it.
- [ ] Confirm `WOUND_EXT_ID` (`'pile-wound'`) is exported from `setup/pilesInit.ts` and already imported by `villainEffects.execute.ts`.
- [ ] `pnpm -r build` 0; engine test + `ledger:villains:check` + `effect-index:check` green.

## Locked Values (do not re-derive)
- New primitive: `'ko-wounds-current-hand-and-discard'` (keyword-less, **no-param**, auto-resolve). `VILLAIN_EFFECT_PRIMITIVES` 14 → 15 (append-only, D-24034; append at the END).
- Marker grammar: `[effect:ko-wounds-current-hand-and-discard]` (no colon params). **Card marked (1):** `core/enemies-of-asgard/ymir-frost-giant-king`, ability index 1 (Fight line) → add `"fight": ["ko-wounds-current-hand-and-discard"]` beside the existing `"ambush"` in `inputs/villain-effect-markers.json`.
- Handler `villainEffectKoWoundsCurrentHandAndDiscard`: KO every `WOUND_EXT_ID` from the current player's `hand` and `discard`, appending each to `G.ko` via `koCard`, then `pushLog` a keyword-less self-narration (label from `villainEffectTimingLabel(timing)`; `applied` when ≥1 KO'd, `blocked` when 0).
- **Target = current player, KO-all** (D-24329): "Choose a player" collapses to the fighting player in solo/co-op; "any number" → all. NO pending choice, NO player-selection UI, NO in-play scan (Wounds are never played).
- **Parser:** a no-param primitive parses via `parseUngatedEffect`'s terminal `if (parts.length === 1) return { primitive: primitiveToken }` — **NO new parser arm.** Confirm with a `setup/villainAbility.setup.test.ts` assertion.
- **Marker script:** append `'ko-wounds-current-hand-and-discard'` to the hand-synced `VILLAIN_EFFECT_PRIMITIVES` array in `apply-effect-markers.mjs` (no-param → validates via that script's terminal `return parts.length === 1`).

## Guardrails
- Primitive in BOTH union AND array (lockstep, append-only); the drift test (`villainAbility.types.test.ts`) bumps 14 → 15 and asserts bidirectional parity + no-duplicates. Do not weaken the negative/duplicate assertions.
- Handler mutates `G` directly, self-narrates via `pushLog`; NO pending choice, NO UIState field, NO client change (auto-resolve, the Tier-A shape). Returns `{ targets: <koedWounds> }` (keyword-less → the recording path drops targets; keep it for parity with `villainEffectKoHeroesCurrentByTrait`).
- KO Wounds from **hand + discard ONLY** (printed text). Match by `cardId === WOUND_EXT_ID`. Append each to `G.ko` (KO pile), NOT back to `G.piles.wounds`. Rebuild each zone with a kept-list `for...of` (no `.reduce()`, no splice-in-loop).
- **Single target = current player.** A defensive `if (!zones) return { targets: [] }` guard; never iterate other players' zones (unlike the each-player KO helper).
- No `Math.random()`/`ctx.random` (Ymir's Fight reveals/shuffles nothing).
- Net-new primitive → hand-add a `{ "wp": "WP-516", "decision": "D-24329" }` row to `scripts/coverage/mechanic-provenance.json` (else the ledger/index render blank WP/Decision).
- Do NOT touch Ymir's Ambush line or the Destroyer/Enchantress/Frost-Giant markers (already marked).
- ewiki (`wiki/card-effect-system.md`): keyword-less descriptors are silently dropped, so refresh the villain-vocab list + add a one-line note for the new primitive; bring the stale "nine entries" count current.

## Required `// why:` Comments
- The `cardId === WOUND_EXT_ID` match + hand+discard-only scan: D-24329 — Ymir Fight KOs the player's own Wounds from hand + discard (printed zones); Wounds are never in-play.
- The current-player-only target: D-24329 — "Choose a player" collapses to the fighting player, KO-all ("any number"); no interactive selection.
- The self-narration `pushLog`: keyword-less auto-resolve (D-24266 breadcrumb removed by marking the card).
- The primitive union/array entry: D-24329 — Ymir Fight ko-wounds primitive (append-only 14 → 15).

## Files to Produce
- Engine: `rules/villainAbility.types.{ts,test.ts}` (union+array 14→15 + drift), `villain/villainEffects.execute.{ts,test.ts}` (handler + dispatch + tests), `setup/villainAbility.setup.test.ts` (no-param parse assertion) — **modified**
- Data/tooling: `scripts/convert-cards/apply-effect-markers.mjs` (1 array entry) + `inputs/villain-effect-markers.json` (1 Ymir `fight` row) + `data/cards/core.json` regen + `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` + `data/metadata/effect-implementation-index.json` + `scripts/coverage/mechanic-provenance.json`
- ewiki: `wiki/card-effect-system.md`
- Governance: DECISIONS (D-24329), NUMBER-LEDGER, STATUS (if present), WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `pnpm -r build` 0; engine test pass (incl. handler + no-op + non-current + drift 14→15 + no-param parse tests)
- [ ] `ledger:villains:check` + `effect-index:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0
- [ ] `check:wiki` + `check-links` (or the repo's ewiki gates) 0 after the `wiki/card-effect-system.md` edit
- [ ] `git diff --name-only` = allowlist (+ regenerated data/artifacts)
- [ ] Ymir flips unmarked → executable in the villain ledger + effect-index with `{ WP-516, D-24329 }`; no `no-handler` hollow when fought
- [ ] Sentinel/replay hashes UNCHANGED (no committed fixture includes or fights Ymir — sentinel = `core/brotherhood`, PRE_WP080 = synthetic group); if either shifts, a fixture referenced enemies-of-asgard — re-record via `record-game-fixture.mjs`, never hand-edit
- [ ] D-24329 Active; §11/§21 N/A; STATUS/WORK_INDEX `[x]`/EC_INDEX Done/mindmap ✅ + counts
- [ ] Live-verify (D-24026, operator, post-deploy): fight Ymir with Wounds → Wounds leave hand+discard for the KO pile

## Common Failure Smells
- `no-handler` hollow still fires when fighting Ymir → the marker didn't apply (marker map / regen), or the primitive isn't in `VILLAIN_EFFECT_HANDLERS`.
- Wounds still in hand/discard after the fight → matched the wrong ext_id (not `WOUND_EXT_ID`) or rebuilt the wrong zone.
- `apply-effect-markers.mjs` loud-fails on the new token → primitive not added to that script's local `VILLAIN_EFFECT_PRIMITIVES` array.
- `ledger:villains:check` red → derived artifact not regenerated after the marker edit; blank WP/Decision → missing provenance row.
- Drift red → primitive in union but not array (or vice-versa), or the count assertion not bumped 14 → 15.
- Sentinel hash shifted unexpectedly → a committed fixture INCLUDES (setup hook-table) or FIGHTS (KO write) enemies-of-asgard/Ymir; re-record, don't hand-edit.
