# EC-558 — co2e Whirlwind Ambush: Two City Villains Swap Spaces (Execution Checklist)

**Source:** docs/ai/work-packets/WP-523-co2e-whirlwind-ambush-swap-two-city-villains.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] **CONFIRM THE SWAP-RULE FORK with the operator.** This EC is written for **Rule B (frontmost ↔ rearmost)** + **Whirlwind eligible** + henchmen excluded + `<2` villains → no-op. If the operator selects a different rule (A: frontmost two; C: fixed Sewers↔Bridge) or excludes Whirlwind, STOP and adjust the handler + this EC before coding.
- [ ] `G.city` is a 5-tuple `[CardExtId|null ×5]` (`board/city.types.ts:21,29`); `CITY_SPACE_NAMES` index 0=sewers(entrance) → 4=bridge(escape) (`board/citySpaceNames.ts:24`). Only existing writes: `pushVillainIntoCity`, defeat null-out — **no swap primitive exists** (this is the first).
- [ ] `resolveVillainCardType(G, id)` / `G.villainDeckCardTypes[id]` classify `'villain' | 'henchman'`. The Ambush fire site passes `cityIndex = undefined` (`villainDeck.reveal.ts` ~:406).
- [ ] The co2e Whirlwind **Ambush** line is unmarked (villains → masters-of-evil → whirlwind); its **Fight** line is WP-520's (do not touch); `core/masters-of-evil/whirlwind` is a DIFFERENT card (WP-492).
- [ ] `pnpm -r build` 0; engine test + gates green.

## Locked Values (Rule B — do not re-derive)
- New primitive: `'swap-two-city-villains'` (append-only, D-24034; count +1). **No-param** marker `[effect:swap-two-city-villains]` — parses via the generic terminal `parts.length === 1` branch (**NO new parser arm**, matching `ko-cullable-each-deck-top`).
- **Card marked (1):** `co2e/masters-of-evil/whirlwind`, **Ambush** line → `"whirlwind": { "ambush": ["swap-two-city-villains"] }` under the co2e MoE block (Whirlwind already gets a `fight` row from WP-520; this ADDS an `ambush` row — do not overwrite the fight).
- Handler `villainEffectSwapTwoCityVillains`: collect indices `i` where `G.city[i] !== null && G.villainDeckCardTypes[G.city[i]] === 'villain'`; **`< 2` such indices → reachable no-op (`blocked`)**; else swap `G.city[min]` ↔ `G.city[max]` (**Rule B**, Whirlwind eligible); `pushLog` naming the two Villains + spaces (`applied`).
- Henchmen NEVER selected. Fires at Ambush (`cityIndex` undefined — swap is space-relative, reads `G.city` directly).

## Guardrails
- Union + array lockstep (append-only, D-24034); drift bumped + parity.
- The City stores `CardExtId | null` ONLY — swap exchanges two ext_id strings between `G.city` indices; NO card objects, NO new zone, NO `.reduce()`.
- **No `ctx.random`** — Rule B is positional/deterministic.
- Henchmen excluded (the card says "Villains"); `< 2` City Villains → no-op (never throw).
- The locked rule (B + Whirlwind eligible) is not changed without an operator sign-off recorded here.
- Do NOT modify `pushVillainIntoCity` or the city advance/escape logic — the swap is an independent write.
- Net-new primitive → `{ "wp": "WP-523", "decision": "D-24336" }` provenance row.
- ewiki vocab list + note (first City manipulation + the swap-family forward note).

## Required `// why:` Comments
- The swap rule: D-24336 — Rule B (lowest-index ↔ highest-index occupied Villain space) is the locked "disrupt the board" reading; the card names no chooser, so the engine picks deterministically.
- Henchman exclusion: D-24336 — "Two Villains" counts only `villain`-classified City occupants.
- `cityIndex` unused: the Ambush fire site passes undefined; the swap is space-relative, reading `G.city` directly (not the WP-489 location gate).
- The union/array entry: D-24336 (append-only).

## Files to Produce
- Engine: `rules/villainAbility.types.{ts,test.ts}` (union+array + drift), `villain/villainEffects.execute.{ts,test.ts}` (handler + City-villain scan + swap + tests), `setup/villainAbility.setup.test.ts` (no-param parse assertion) — **modified** *(no parser arm — no-param)*
- Data/tooling: `apply-effect-markers.mjs` (1 array entry) + `inputs/villain-effect-markers.json` (co2e whirlwind ambush row) + `data/cards/co2e.json` regen + `villain-mechanic-ledger.{json,csv}` + `effect-implementation-index.json` + `mechanic-provenance.json`
- ewiki: `wiki/card-effect-system.md`
- Governance: DECISIONS (D-24336), NUMBER-LEDGER, STATUS, WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `pnpm -r build` 0; engine test pass (two-villain swap + henchman-excluded + `<2` no-op + ext_id-only + drift + no-param parse)
- [ ] `ledger:villains:check` + `effect-index:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0; `check:wiki` + `wiki-viewer:check-links` 0
- [ ] `git diff --name-only` = allowlist
- [ ] Whirlwind (co2e) Ambush flips unmarked → executable with `{ WP-523, D-24336 }`; no `no-handler`; the WP-520 fight marker still intact
- [ ] Hashed oracles UNCHANGED (no co2e MoE fixture) — or re-recorded
- [ ] D-24336 Active; STATUS/WORK_INDEX `[x]`/EC_INDEX Done/mindmap ✅ + counts
- [ ] Live-verify (D-24026): reveal Whirlwind with ≥2 City Villains → the two swap per Rule B

## Common Failure Smells
- Henchman got swapped → classification check missing (`G.villainDeckCardTypes === 'villain'`).
- Swapped when only 1 City Villain (or threw) → the `<2` no-op guard missing.
- Used `ctx.random` → Rule B is positional; no RNG.
- A card object entered the City → swap must move ext_id strings only.
- Overwrote Whirlwind's WP-520 fight marker → the co2e block carries BOTH `fight` and the new `ambush` row.
- Confused with `core/masters-of-evil/whirlwind` (WP-492) → wrong set; this is co2e only.
