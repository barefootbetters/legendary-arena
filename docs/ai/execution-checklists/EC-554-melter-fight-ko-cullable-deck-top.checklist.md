# EC-554 — Melter (Villain) Fight: KO Each Player's Cullable Deck-Top Card (Execution Checklist)

**Source:** docs/ai/work-packets/WP-519-melter-fight-ko-cullable-deck-top.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] `VillainEffectPrimitive` union + `VILLAIN_EFFECT_PRIMITIVES` array present (`rules/villainAbility.types.ts`); the marker pipeline (`apply-effect-markers.mjs` + `inputs/villain-effect-markers.json`); the Tier-A fire path `executeVillainAbilities(G, ctx, timing, shuffleContext, cityIndex)` → `applyVillainEffect(...)` with the `VILLAIN_EFFECT_HANDLERS` record.
- [ ] Confirm the Melter card (`data/cards/core.json`, masters-of-evil group) Fight line is still ability index 0 and still hollow (no `[effect:]` marker); the other three MoE villains (Baron Zemo / Ultron / Whirlwind) already carry markers — leave them.
- [ ] Confirm `WOUND_EXT_ID` / `SHIELD_AGENT_EXT_ID` / `SHIELD_TROOPER_EXT_ID` are exported from `setup/pilesInit.ts` and already imported by `villainEffects.execute.ts`; `reshuffleDiscardIntoDeck` imported from `moves/drawCards.logic.ts`; `moveCardFromZone`, `koCard` imported.
- [ ] `pnpm -r build` 0; engine test + `ledger:villains:check` + `effect-index:check` green.

## Locked Values (do not re-derive)
- New primitive: `'ko-cullable-each-deck-top'` (keyword-less, **no-param**, auto-resolve). `VILLAIN_EFFECT_PRIMITIVES` 15 → 16 (append-only, D-24034; append at the END).
- Marker grammar: `[effect:ko-cullable-each-deck-top]` (no colon params). **Card marked (1):** `core/masters-of-evil/melter`, Fight line → add `"melter": { "fight": ["ko-cullable-each-deck-top"] }` under the `masters-of-evil` group in `inputs/villain-effect-markers.json` (`villains → core → masters-of-evil`).
- Handler `villainEffectKoCullableEachDeckTop(G, currentPlayer, cardId, timing, descriptor, shuffleContext?)`: for each `playerId` in `Object.keys(G.playerZones).sort()`, `if (zones.deck.length === 0) reshuffleDiscardIntoDeck(zones, shuffleContext)`; skip when still empty; else read `zones.deck[0]`; if `isCullableDeckTopCard(top)` → `moveCardFromZone(zones.deck, [], top)` (set `zones.deck = moveResult.from`) + `G.ko = koCard(G.ko, top)`; else leave on top. Then `pushLog` a keyword-less self-narration (label `villainEffectTimingLabel(timing)`; `applied` when ≥1 KO'd, `blocked` when 0). Return `{ targets: <koedCardIds> }`.
- Predicate `isCullableDeckTopCard(cardId)`: true iff `cardId === WOUND_EXT_ID || cardId === SHIELD_AGENT_EXT_ID || cardId === SHIELD_TROOPER_EXT_ID`. The `selectScryKoTarget` tiers-1–2 set (D-24267). **EXCLUDE** `SHIELD_OFFICER_EXT_ID` and the tier-3 lex-lowest fallback — a real Hero / Officer is KEPT.
- **All players, sorted** (D-18902): every player's deck top is revealed (not current-player-only). "Each player" is faithful; the fighting player is not special-cased.
- **Reveal-reshuffle** (D-24285): an empty deck reshuffles the player's discard first via `reshuffleDiscardIntoDeck`; empty deck + empty discard = reachable no-op for that player.
- **Parser:** a no-param primitive parses via `parseUngatedEffect`'s terminal `if (parts.length === 1) return { primitive: primitiveToken }` — **NO new parser arm.** Confirm with a `setup/villainAbility.setup.test.ts` assertion.
- **Marker script:** append `'ko-cullable-each-deck-top'` to the hand-synced `VILLAIN_EFFECT_PRIMITIVES` array in `apply-effect-markers.mjs` (no-param → validates via that script's terminal `return parts.length === 1`).

## Guardrails
- Primitive in BOTH union AND array (lockstep, append-only); the drift test (`villainAbility.types.test.ts`) bumps 15 → 16 and asserts bidirectional parity + no-duplicates. Do not weaken the negative/duplicate assertions.
- Handler mutates `G` directly, self-narrates via `pushLog`; NO pending choice, NO UIState field, NO client change (auto-resolve, the Tier-A shape). This is the operator-selected fidelity — do NOT add the WP-470 scry-ko pending-choice machinery.
- Cullable = Wound / basic S.H.I.E.L.D. starter (Agent, Trooper) ONLY. KEEP a real Hero and the S.H.I.E.L.D. Officer. Never force-KO (the keep-option is the whole point — this is NOT scry-ko, which must KO one).
- Reveal each player's deck top; reshuffle-on-empty via `shuffleContext`; remove via `moveCardFromZone(zones.deck, [], top)`; append KO'd cards to `G.ko` via `koCard`. No `.reduce()`, no splice-in-loop.
- Randomness ONLY via the seeded reshuffle (`shuffleContext.random.Shuffle`); no `Math.random()`. `reshuffleDiscardIntoDeck` no-ops safely on an empty discard / absent `shuffleContext`.
- Net-new primitive → hand-add a `{ "wp": "WP-519", "decision": "D-24332" }` row to `scripts/coverage/mechanic-provenance.json` (else the ledger/index render blank WP/Decision).
- Do NOT touch the co2e MoE villains or the Baron Zemo / Ultron / Whirlwind markers (out of scope / already marked).
- ewiki (`wiki/card-effect-system.md`): keyword-less descriptors are silently dropped, so refresh the villain-vocab list + add a one-line note for the new primitive.

## Required `// why:` Comments
- The cullable set (`isCullableDeckTopCard`): D-24332 — Wounds + basic S.H.I.E.L.D. starters are the `selectScryKoTarget` tiers-1–2 worst-worthy set (D-24267); Officer + lex-fallback excluded because Melter's choice KEEPS real cards.
- The keep-option (no force-KO): D-24332 — "you choose to KO it or put it back" → a rational cooperative chooser keeps real Heroes; auto-resolve is safe (no WP-470 force-KO agency bug).
- The sorted per-player iteration: D-18902 determinism — `Object.keys(G.playerZones).sort()`, matching the each-player wound/KO paths.
- The reshuffle-on-empty: D-24285 — "reveals the top card" reshuffles the discard when the deck is empty (Legendary reveal rule; scry-ko precedent).
- The self-narration `pushLog`: keyword-less auto-resolve (D-24266 breadcrumb removed by marking the card).
- The primitive union/array entry: D-24332 — Melter Fight cullable-deck-top primitive (append-only 15 → 16).

## Files to Produce
- Engine: `rules/villainAbility.types.{ts,test.ts}` (union+array 15→16 + drift), `villain/villainEffects.execute.{ts,test.ts}` (handler + predicate + dispatch + tests), `setup/villainAbility.setup.test.ts` (no-param parse assertion) — **modified**
- Data/tooling: `scripts/convert-cards/apply-effect-markers.mjs` (1 array entry) + `inputs/villain-effect-markers.json` (1 Melter `fight` row) + `data/cards/core.json` regen + `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` + `data/metadata/effect-implementation-index.json` + `scripts/coverage/mechanic-provenance.json`
- ewiki: `wiki/card-effect-system.md`
- Governance: DECISIONS (D-24332), NUMBER-LEDGER, STATUS (if present), WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `pnpm -r build` 0; engine test pass (incl. handler + cullable/keep + reshuffle-on-empty + drift 15→16 + no-param parse tests)
- [ ] `ledger:villains:check` + `effect-index:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0
- [ ] `check:wiki` + `check-links` (or the repo's ewiki gates) 0 after the `wiki/card-effect-system.md` edit
- [ ] `git diff --name-only` = allowlist (+ regenerated data/artifacts)
- [ ] Melter flips unmarked → executable in the villain ledger + effect-index with `{ WP-519, D-24332 }`; no `no-handler` hollow when fought
- [ ] **Hash verification (CRITICAL — masters-of-evil IS in scoring fixtures):** confirm whether any HASHED oracle (`finalStateHash` via `record-game-fixture.mjs`; `PRE_WP080_HASH` in `replay.execute.test.ts`; the sentinel replay fixture) has a villain config that INCLUDES or FIGHTS Masters-of-Evil/Melter. If none → hashes UNCHANGED. If any → re-record via `record-game-fixture.mjs` (never hand-edit) and note the re-pin in D-24332. The `parScoring.*`/`par.storage` references are PAR-key/scoring fixtures — check whether they feed a hashed oracle.
- [ ] D-24332 Active; §11/§21 N/A; STATUS/WORK_INDEX `[x]`/EC_INDEX Done/mindmap ✅ + counts
- [ ] Live-verify (D-24026, operator, post-deploy): fight Melter → cullable deck tops leave for the KO pile; real Heroes kept

## Common Failure Smells
- `no-handler` hollow still fires when fighting Melter → the marker didn't apply (marker map / regen), or the primitive isn't in `VILLAIN_EFFECT_HANDLERS`.
- A real Hero KO'd off a deck top → `isCullableDeckTopCard` too wide (included Officer / a lex-fallback / a non-starter); it must be Wound + Agent + Trooper ONLY.
- Deck top not removed after a cull → used the wrong `moveCardFromZone` args or didn't reassign `zones.deck = moveResult.from`.
- `apply-effect-markers.mjs` loud-fails on the new token → primitive not added to that script's local `VILLAIN_EFFECT_PRIMITIVES` array.
- `ledger:villains:check` red → derived artifact not regenerated after the marker edit; blank WP/Decision → missing provenance row.
- Drift red → primitive in union but not array (or vice-versa), or the count assertion not bumped 15 → 16.
- Hash shifted unexpectedly → a committed HASHED fixture includes/fights masters-of-evil; re-record via the canonical tool, don't hand-edit.
