# EC-504 — Villain `reveal-or-wound` Conditional Each-Player Effect (Execution Checklist)

**Source:** docs/ai/work-packets/WP-469-villain-reveal-or-wound.md
**Layer:** Game Engine (+ card-data generated artifact)

## Before Starting
- [ ] On `origin/main` ≥ `35bd1351`.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] Re-read `.claude/skills/legendary-game-engine/SKILL.md` (executor discipline, zone ops).

## Locked Values (do not re-derive)
- New primitive `reveal-or-wound` — grammar `reveal-or-wound:<kind>:<value>`,
  `kind` ∈ `{ team, hc }` (`hc` → `'hero-class'`), `value` non-empty. Bad kind / wrong
  token count → `null`.
- Descriptor: `{ primitive: 'reveal-or-wound', requireKind: 'team' | 'hero-class', requireValue }`.
- `requireValue` normalized at parse to the `cardTraits` slug space (`normalizeTraitSlug`
  = `trim().toLowerCase()`), so `===` is casing/whitespace-safe.
- `VILLAIN_EFFECT_PRIMITIVES` post-WP = 8 entries, `reveal-or-wound` at **position 8**
  (after `gain-attached-hero`). Drift test → 8.
- Semantics: each player in `Object.keys(G.playerZones).sort()`, scan `zones.hand` via
  `G.cardTraits`; `team` → `trait.team === value`, `hero-class` → `trait.heroClass ===
  value`. Match → NO mutation. No match → `gainWound` (empty pile → no-op); when the
  wounded player IS the current player, also increment `G.turnEconomy.woundsDrawn`
  (parity with `villainEffectGainWound`). HAND ONLY (not hand+inPlay).
- Narration (pinned, ONE line): ≥1 wounded → `<timing> effect: <N> player(s) had no
  matching Hero and gained a Wound (<names>).`; none → `<timing> effect: every player
  revealed a matching Hero.`
- Marked CORE — **5 cards / 8 markers**: `brotherhood/sabretooth` fight+escape
  `reveal-or-wound:team:x-men`; `enemies-of-asgard/frost-giant` fight+escape `:hc:ranged`
  (Escape="Same effect."); `enemies-of-asgard/ymir-frost-giant-king` ambush `:hc:ranged`;
  `masters-of-evil/ultron` escape `:hc:tech`; `radiation/zzzax` fight+escape
  `:hc:strength` (Escape="Same effect."). EVERY core "Same effect." Escape is marked —
  omitting one leaves a hollow. Also remove the stale `_unassigned` `reason:"conditional"`
  rows for sabretooth / frost-giant / ymir / ultron (hygiene; script ignores `_unassigned`).

## Guardrails
- **Hand-only predicate.** Write a new `handHasHeroMatchingTrait(hand, cardTraits, kind,
  value)` scanning `zones.hand` ONLY. Do NOT call or modify `playerMeetsDefeatRequirement`
  (hand+inPlay, D-24076).
- Reuse `G.cardTraits[cardId]` for `{ team, heroClass }`; reuse `gainWound`. No new `G`
  field, no `ctx.random.*` / `Math.random` / I/O, no `.reduce()`.
- Append-only to the closed union: union + array + drift test move together (→ 8).
- Do NOT extend `descriptorKey` with the predicate fields — `reveal-or-wound` is
  keyword-less (reverse-maps to `undefined`); it self-narrates; frozen keyword surface
  (`EFFECT_KEYWORD_LABELS`, `notableEvents.compose.ts`, injective round-trip) stays untouched.
- **Self-narrate** via `pushLog` (scry-ko D-24267 precedent) with the pinned templates.
- Auto-resolved: NO pending-choice / UIState / prompt / bot `getLegalMoves` change.
- `apply-effect-markers.mjs` keeps its OWN grammar validator — teach it
  `reveal-or-wound:<kind>:<value>`, or the regen loud-fails.
- Regenerate the card JSON via the script — do NOT hand-edit. Verify only the 8 core
  lines changed.

## Required `// why:` Comments
- The `requireKind`/`requireValue` descriptor fields: present only on `reveal-or-wound`;
  cite D-24281.
- `handHasHeroMatchingTrait`: why HAND ONLY (printed "reveal" is a hand action —
  narrower than the D-24076 hand+inPlay defeat requirement, deliberately not reused).
- The handler `pushLog`: why self-narrate (keyword-less descriptor dropped by the result path).
- The wound branch's `woundsDrawn` bump: why only for the current player (mirrors
  `gain-wound:each`; keeps the UI wounds-drawn projection correct).
- `requireValue` normalization: why it must match the `cardTraits` slug space.
- The union/array append: cite D-24281.

## Files to Produce
- `packages/game-engine/src/rules/villainAbility.types.ts` — union + array (→8) + `requireKind`/`requireValue`.
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — drift test → 8.
- `packages/game-engine/src/setup/villainAbility.setup.ts` — `reveal-or-wound:<kind>:<value>` parse + normalize.
- `packages/game-engine/src/setup/villainAbility.setup.test.ts` — accept team/hc + normalize, reject bad kind / 2-token.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — handler + hand-only helper + registry + `pushLog` + `woundsDrawn`.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — reveal→no-wound / no-match→wound / each-player / team+hero-class / in-play-doesn't-count / empty-pile no-op / woundsDrawn / narration / Sabretooth+FrostGiant+Zzzax no-breadcrumb (incl. Escape).
- `scripts/convert-cards/apply-effect-markers.mjs` — grammar.
- `scripts/convert-cards/inputs/villain-effect-markers.json` — 5 core entries (8 markers) + remove 4 stale `_unassigned` rows.
- `data/cards/core.json` — generated (8 markers on 5 cards).

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] Registry validate + `pnpm ledger:villains` regenerate + `:check` +
      `mechanics:metadata:check` + `sim:runtime-observed:check` exit 0.
- [ ] Replay/fixture `finalStateHash` regenerated-with-note (a re-pin is LIKELY here).
- [ ] `docs/ai/DECISIONS.md` — D-24281 landed (Active).
- [ ] `WORK_INDEX.md` row `[x]`; `EC_INDEX.md` → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅` + `pnpm roadmap:counts:write`; `:check` exits 0.
- [ ] Live-on-surface (D-24026): fight Sabretooth; each player reveals an X-Men Hero or
      gains a Wound, no `Unhandled effect observed`.

## Common Failure Smells
- Drift test still expects 7 → union/array/test not moved together.
- A hero IN PLAY (not in hand) prevents a wound → you reused the hand+inPlay predicate.
- The wound fires but the log shows no per-player line → the handler didn't self-narrate.
- The current player's wound-count is off by one → missing the `woundsDrawn` bump.
- `data/cards/*.json` churn beyond the 8 core lines → hand-edit or stale regen.
- Frost Giant / Zzzax Escape still records `unmarked-ability` → the "Same effect." Escape marker was missed.
