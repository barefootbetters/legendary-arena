# EC-525 — Destroyer's `team:shield` KO matches the basic S.H.I.E.L.D. cards (Execution Checklist)

**Source:** docs/ai/work-packets/WP-490-destroyer-shield-ko-basic-cards.md
**Layer:** Game Engine (villain effect handler + an intra-layer constant relocation) — single layer

## Before Starting
- [ ] On `origin/main` post WP-485/EC-520 (#1162); worktree clean; game-engine
      build/test green.
- [ ] Confirm the live bug: `ko-heroes-current-by-trait:team:shield` KOs 0 because
      the basic S.H.I.E.L.D. cards (`starting-shield-agent`, `starting-shield-trooper`,
      `pile-shield-officer`) have no `G.cardTraits` entry (built only from registry
      hero entries, `buildCardTraits.ts`).
- [ ] Confirm the constants: `SHIELD_AGENT_EXT_ID` / `SHIELD_TROOPER_EXT_ID`
      (`buildInitialGameState.ts`), `SHIELD_OFFICER_EXT_ID` (`pilesInit.ts`).
- [ ] **Scaffold:** relocate the two constants + add the KO-only predicate, build,
      and run the game-engine suite green before adding new tests.
- [ ] **Exact target file set (any outside = FAIL, STOP):**
      `setup/pilesInit.ts`, `setup/buildInitialGameState.ts`,
      `villain/villainEffects.execute.ts` (+`.test.ts`), `docs/ai/DECISIONS.md`.

## Locked Values (do not re-derive)
- **The KO-only widening:** a `ko-heroes-current-by-trait` predicate of kind `team`
  value `shield` matches, in addition to any `cardTraits.team === 'shield'` card, the
  three basic S.H.I.E.L.D. ext_ids `starting-shield-agent`, `starting-shield-trooper`,
  `pile-shield-officer`. A `hero-class` predicate (or any other `team` value) never
  matches them.
- **Local predicate `koHeroMatchesTraitOrBasicShield`** in `villainEffects.execute.ts`
  — wraps `cardTraitMatches`; the shared `cardTraitMatches` /
  `playerHasHeroMatchingTrait` / `countPlayerHeroesMatchingTrait` are UNCHANGED.
- **Constant relocation:** move `SHIELD_AGENT_EXT_ID` / `SHIELD_TROOPER_EXT_ID` into
  `pilesInit.ts` beside `SHIELD_OFFICER_EXT_ID`; re-export both from
  `buildInitialGameState.ts` (mirror the existing `SHIELD_OFFICER_EXT_ID` re-export).
- Lands **D-24296**.

## Guardrails
- game-engine imports Node built-ins only; handler pure/deterministic; `for...of`,
  no `.reduce()`; `00.6`.
- Do NOT tag the basic cards `team:shield` in `cardTraits` (root-cause fix rejected —
  65-site synergy + Baron Zemo blast radius; operator ruling 2026-08-03).
- Do NOT change any other villain primitive, card data, marker, or the villain
  ledger (same mechanic, wider matching only). No new `G` field, no new primitive.

## Required `// why:` Comments
- Why the basic S.H.I.E.L.D. cards need naming (teamless synthetic components; no
  `cardTraits` entry; physically S.H.I.E.L.D.).
- Why the widening is local to the KO handler (narrow fix — shared matcher unchanged
  so synergies + Baron Zemo unaffected).
- Why the constants relocate to `pilesInit` (neutral leaf beside `SHIELD_OFFICER_EXT_ID`;
  cycle-free import for the handler).

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine test` green (3 new cases).
- [ ] `pnpm -r build && pnpm -r --no-bail test` exit 0. NO `finalStateHash` /
      sentinel re-pin (no committed fixture reaches a Destroyer `team:shield` fight —
      confirm empirically via green replay/sentinel suites).
- [ ] **D-24296 Active.** WORK_INDEX `[x]`; MINDMAP `✅` + counts:write; EC_INDEX
      EC-525 Done. (No STATUS.md WP-level entry.)
- [ ] No file outside the allowlist (+ governance). Revert any lagn-v1.json EOL churn.

## Common Failure Smells
- Baron Zemo's rescue-count changes → the widening leaked into the shared
  `countPlayerHeroesMatchingTrait` (must be KO-handler-local).
- A `hero-class:shield` predicate KOs basic cards → the widening isn't guarded to
  `kind === 'team' && value === 'shield'`.
- Duplicate-identifier build error → the handler already imported the two constants
  from `buildInitialGameState`; drop that import in favour of the `pilesInit` source.
