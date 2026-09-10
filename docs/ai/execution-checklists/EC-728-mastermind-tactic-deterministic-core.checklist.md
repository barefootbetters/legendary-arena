# EC-728 — Deterministic core mastermind tactics (Execution Checklist)

**Source:** docs/ai/work-packets/WP-691-mastermind-tactic-deterministic-core.md
**Layer:** Game Engine
**Status:** Pending

## Before Starting
- [ ] WP-497 (tactic-onFight framework / D-24300) shipped — read `rules/tacticHandlers.ts`: `dispatchTacticOnFight`, an existing resolver (`resolveOctetOfValenceElectrons` for the `handSizeOverrides` next-hand pattern; `resolveCrushingShockwave` for the each-other-player scan), and the ext_id key format
- [ ] Confirm at HEAD: the next-hand override field name + that it applies per-player at the play-phase `onBegin` (no end-of-turn cleanup draw); whether it is set-value or supports additive (Treasures needs +3 ADDITIVE)
- [ ] Confirm `G.cardTraits[id].team === 'x-men'` + the bystander rescue/supply helpers + the victory-pile zone field
- [ ] `pnpm -r build` 0; engine suite green

## Locked Values (do not re-derive)
- [ ] `TREASURES_EXTRA_CARDS = 3` — ADDITIVE to the defeating player's next-hand fill (NOT set-to-N)
- [ ] `WHISPERS_BYSTANDER_KO = 2` — each OTHER player KOs 2 Victory-Pile Bystanders (skip `ctx.currentPlayer`; <2 → all they have)
- [ ] Xavier's Nemesis = rescue 1 Bystander per in-play `[team:x-men]` Hero of the acting player (0 X-Men → 0; empty supply → stop)
- [ ] ext_ids: `core-mastermind-dr-doom-treasures-of-latveria`, `core-mastermind-magneto-xaviers-nemesis`, `core-mastermind-loki-whispers-and-lies`

## Guardrails
- [ ] Deterministic: no `Math.random`, no wall-clock, no I/O; resolvers mutate `G` via zone helpers, never throw
- [ ] No `.reduce()` in the count/zone loops (`for...of`)
- [ ] Whispers skips the acting player; only touches OTHER players' victory piles
- [ ] Treasures override is per-player and applied at the correct player's next `onBegin` (not globally)
- [ ] Unknown tactic id stays a silent no-op (do not weaken `dispatchTacticOnFight`'s default)
- [ ] No re-pin expected (no committed fixture defeats these tactics); confirm no state-hash fixture churn

## Required `// why:` Comments
- [ ] `TREASURES_EXTRA_CARDS` additive-vs-set rationale (next-hand fill, WP-497 pattern)
- [ ] Whispers `ctx.currentPlayer` skip (the "each OTHER player" text)
- [ ] Xavier's X-Men count reading `cardTraits.team`
- [ ] Each new `dispatchTacticOnFight` case cites WP-691 / D-24508

## Files to Produce
- [ ] `rules/tacticHandlers.ts` — `resolveTreasuresOfLatveria`, `resolveXaviersNemesis`, `resolveWhispersAndLies` + 3 dispatch cases + the 2 constants
- [ ] `rules/tacticHandlers.test.ts` (or the tactic suite) — each resolver incl. edges (0 X-Men; <2 bystanders; skip-self; +3 applied to the right player)
- [ ] `scripts/coverage/tactic-provenance.json` — 3 rows marking the tactics `executable`; regenerate the effect-implementation index
- [ ] NO card-data edit (resolver-only)

## After Completing
- [ ] engine suite green; `pnpm -r build` 0
- [ ] `pnpm cards:check` reproducible (no card edits); `pnpm effect-index:check` current after regen
- [ ] confirm NO hash re-pin (no state-hash fixture diff)
- [ ] D-24508 Active; WORK_INDEX `[x]` + EC_INDEX + roadmap mindmap [d]→[x]
- [ ] PR squash-merged when green

## Common Failure Smells
- Treasures sets the hand to 3 instead of +3 → must be additive to the base fill.
- Whispers KOs the acting player's bystanders → must skip `ctx.currentPlayer`.
- Xavier's counts non-X-Men or misses Size-Changing granted X-Men → read team faithfully.
- Effect-index `:check` fails → regenerate after adding the tactic-provenance rows.
