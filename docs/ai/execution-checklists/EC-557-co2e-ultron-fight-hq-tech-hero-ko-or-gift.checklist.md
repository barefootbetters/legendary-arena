# EC-557 — co2e Ultron Fight: Take a Tech Hero from the HQ (KO or Gift) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-522-co2e-ultron-fight-hq-tech-hero-ko-or-gift.md
**Layer:** Game Engine + Card Data (Fork A) — or + Client (Fork B)

## Before Starting
- [ ] **CONFIRM THE FIDELITY FORK with the operator.** This EC is written for **Fork A (auto-resolve)**: gift the highest-cost `[hc:tech]` HQ Hero to the current player's discard. If the operator selects **Fork B (interactive pending-choice)**, STOP and expand the allowlist to the 7-touchpoint pending pattern (WP §Contract Fork-B delta) before coding — do not silently ship Fork A.
- [ ] `captureHeroFromHq` + `refillHqSlot` exist (`board/heroCapture.logic.ts:54`, `board/city.logic.ts:204`); cost read from `G.cardStats[id]?.cost`, ties → rightmost. The defeat-to-gain routing pushes a gained Hero to `G.playerZones[player].discard` (`fightVillain.ts:235`, D-24327) — "gain" = discard, never victory.
- [ ] `cardTraitMatches` for the `[hc:tech]` filter; `parseTraitPredicateTokens` for the marker tail. `G.hq` 5-tuple; the co2e Ultron Fight line is unmarked (villains → masters-of-evil → ultron).
- [ ] `pnpm -r build` 0; engine test + gates green.

## Locked Values (Fork A — do not re-derive)
- New primitive: `'give-hq-hero-by-trait-to-current'` (append-only, D-24034; count +1). Marker `[effect:give-hq-hero-by-trait-to-current:hc:tech]` (trait predicate).
- **Card marked (1):** `co2e/masters-of-evil/ultron`, Fight line → `"ultron": { "fight": ["give-hq-hero-by-trait-to-current:hc:tech"] }` under the co2e MoE block (Ultron already gets an `escape` row from WP-520; this ADDS a `fight` row — do not overwrite the escape).
- Handler `villainEffectGiveHqHeroByTraitToCurrent`: scan `G.hq` for non-`null` slots matching `{ requireKind, requireValue }`; **no match → reachable no-op (`blocked`)**; else pick the **highest-cost** match (`G.cardStats[id]?.cost ?? 0`, ties → **rightmost** index, matching `captureHeroFromHq`); null the HQ slot + `refillHqSlot(G.hq, index, G.heroDeck)`; `G.playerZones[currentPlayer].discard.push(heroId)`; `pushLog` naming Hero + recipient (`applied`).
- **KO branch NOT implemented** (Fork A) — gift strictly dominates KO in co-op; the auto-resolve never KOs (D-24335). Recipient = **current player** (no player picker).
- Gift → **discard**, never victory (D-24327).
- **Parser arm** mirrors `reveal-or-wound` (trait predicate); marker-script vocabulary entry appended.

## Guardrails
- Union + array lockstep (append-only, D-24034); drift test bumped + parity.
- Fork A mutates `G` directly, self-narrates; **NO pending choice, NO UIState field, NO client change**. Do NOT add pending-choice machinery under Fork A.
- Selection is deterministic: highest-cost, rightmost tie-break — NEVER `ctx.random`. Trait filter via `cardTraitMatches` over `G.hq` slots (do not modify the shared matcher).
- HQ refill via `refillHqSlot` (FIFO `G.heroDeck` shift; leaves `null` on empty reservoir) — the vacated slot must not be left stale.
- Gift lands in the current player's `discard` — never `victory`, never another player's zone (Fork A).
- Net-new primitive → `{ "wp": "WP-522", "decision": "D-24335" }` provenance row.
- ewiki vocab list + note (HQ trait-selection + gift-to-discard).

## Required `// why:` Comments
- The dominated-KO collapse: D-24335 — in co-op, gifting an HQ Hero (player gains the card AND the HQ refills) strictly dominates KO'ing it, so the auto-resolve always gifts, never KOs.
- Recipient = current player: D-24335 — "choose a player" collapses to the fighting player (the WP-516/WP-519 precedent).
- Gift → discard: D-24327 — "gain" routes to the recipient's discard, never victory.
- Highest-cost + rightmost tie: D-24335 — mirrors `captureHeroFromHq`'s selection determinism.

## Files to Produce (Fork A)
- Engine: `rules/villainAbility.types.{ts,test.ts}`, `setup/villainAbility.setup.{ts,test.ts}` (parse arm + test), `villain/villainEffects.execute.{ts,test.ts}` (handler + HQ trait-highest-cost selection + gift-to-discard + tests) — **modified**
- Data/tooling: `apply-effect-markers.mjs` + `inputs/villain-effect-markers.json` (co2e ultron fight row) + `data/cards/co2e.json` regen + `villain-mechanic-ledger.{json,csv}` + `effect-implementation-index.json` + `mechanic-provenance.json`
- ewiki: `wiki/card-effect-system.md`
- Governance: DECISIONS (D-24335), NUMBER-LEDGER, STATUS, WORK_INDEX, EC_INDEX, mindmap
- *(Fork B adds: `types.ts` pending type + G field, `moves/ultronHqChoice.resolve.ts`, block-all guards ~12 sites, `ui/uiState.{types,build,filter}.ts`, `apps/arena-client/**` prompt + wiring, `simulation/ai.legalMoves.ts`.)*

## After Completing
- [ ] `pnpm -r build` 0; engine test pass (handler highest-cost/tie + no-tech no-op + gift-to-discard + drift + parse)
- [ ] `ledger:villains:check` + `effect-index:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0; `check:wiki` + `wiki-viewer:check-links` 0
- [ ] `git diff --name-only` = allowlist
- [ ] Ultron (co2e) Fight flips unmarked → executable with `{ WP-522, D-24335 }`; no `no-handler`; the WP-520 escape marker still intact
- [ ] Hashed oracles UNCHANGED (no co2e MoE fixture) — or re-recorded
- [ ] D-24335 Active; STATUS/WORK_INDEX `[x]`/EC_INDEX Done/mindmap ✅ + counts
- [ ] Live-verify (D-24026): fight co2e Ultron with a Tech Hero in HQ → it enters your discard, HQ refills

## Common Failure Smells
- Gift landed in victory (not discard) → wrong zone; "gain" is discard (D-24327).
- Selection used `ctx.random` or ignored the trait filter → must be deterministic highest-cost `[hc:tech]`.
- HQ slot left null/stale → missing `refillHqSlot`.
- Fork A shipped with pending-choice code → over-scope; Fork A is auto-resolve only.
- Overwrote Ultron's WP-520 escape marker → the co2e block must carry BOTH `escape` (reveal-or-wound) and the new `fight` row.
