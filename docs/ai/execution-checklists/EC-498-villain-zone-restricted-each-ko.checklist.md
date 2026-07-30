# EC-498 — Villain Zone-Restricted Each-Player Hero KO (Execution Checklist)

**Source:** docs/ai/work-packets/WP-463-villain-zone-restricted-each-ko.md
**Layer:** Game Engine (+ card-data generated artifact)

## Before Starting
- [ ] On `origin/main` ≥ `b8d479df` (WP-461/462 legends-set-details merged).
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Re-read `.claude/skills/legendary-game-engine/SKILL.md` (zone ops, executor discipline).

## Locked Values (do not re-derive)
- Grammar: `ko-hero:each:<N>:<zone>`, `N ≥ 1`, `zone ∈ { discard, hand }` (exactly
  these two). 3-token `ko-hero:each:<N>` unchanged. Bad zone / 5th token → `null`.
- Descriptor: `{ primitive: 'ko-hero', target: 'each', magnitude: N, zone }`.
- **`VILLAIN_EFFECT_PRIMITIVES` is UNCHANGED (7 entries).** No new primitive; the
  primitive drift test is NOT touched.
- **`descriptorKey` does NOT include `zone`** — the zone-bearing descriptor reverse-maps
  to `koHeroEachPlayer` (N=1) / `koHeroEachPlayerMag2` (N=2), narrating per-target.
- Zone-locked KO: `selectKoHeroTarget` within the named zone only (Wounds excluded,
  starter-first then lex-asc), `magnitude` times, NO discard→hand→inPlay fallback.
  Short/empty zone → fewer/zero KOs, reachable no-op (never hollow).
- Marked card: core `brotherhood/juggernaut` — `ambush: ["ko-hero:each:2:discard"]`,
  `escape: ["ko-hero:each:2:hand"]`. Core only (the only unconditional/unfiltered
  zone-restricted KO in the corpus).

## Guardrails
- Extend the `each` branch ONLY. The `target: 'current'` (interactive) path and the
  zone-less `koOneHeroForPlayer` path stay byte-unchanged.
- No new `G` field, no `ctx.random.*` / `Math.random` / I/O, no `.reduce()`. Mutate
  only `G.playerZones[*].{discard,hand}` + `G.ko` via existing helpers. Player order is
  `Object.keys(G.playerZones).sort()` (D-18902).
- Do NOT add `zone` to `descriptorKey` — that would break the intended narration reuse
  and silence the KO. Reverse-map MUST still resolve to the mag-N each-KO keyword.
- Do NOT touch the frozen keyword surface — `VillainEffectResult.keyword`,
  `EFFECT_KEYWORD_LABELS`, `notableEvents.compose.ts`, the injective round-trip test.
- Wounds are NOT Heroes — `selectKoHeroTarget` already excludes `WOUND_EXT_ID`; do not
  KO a Wound (that would invert the penalty).
- `apply-effect-markers.mjs` keeps its OWN grammar validator — teach it the 4-token
  `ko-hero:each:N:zone` form, or the regen loud-fails on the curated token.
- Regenerate the card JSON via the script — do NOT hand-edit `data/cards/core.json`.
  Verify only the two Juggernaut lines changed.

## Required `// why:` Comments
- The `zone` field on `VillainEffectDescriptor`: why it is a resolver-targeting detail,
  present only on the `each` branch.
- `descriptorKey`: why `zone` is deliberately OMITTED (narration reuse — the
  zone-restricted each-KO narrates as the generic mag-N each-KO with per-target names).
- `koHeroesFromZoneForPlayer`: why the named zone has NO fallback (printed text is
  source-restricted) and why a short zone is a reachable no-op.
- The descriptor field addition: cite D-24280.

## Files to Produce
- `packages/game-engine/src/rules/villainAbility.types.ts` — optional `zone?: 'discard' | 'hand'` (a NARROWER union than `KoHeroTarget.zone` — do not reuse that type) + `descriptorKey` why.
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — assert `descriptorToLegacyKeyword({ primitive:'ko-hero', target:'each', magnitude:2, zone:'discard' }) === 'koHeroEachPlayerMag2'` (guards the narration decision at the unit boundary).
- `packages/game-engine/src/setup/villainAbility.setup.ts` — 4-token parse.
- `packages/game-engine/src/setup/villainAbility.setup.test.ts` — parse accept/reject.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — `koHeroesFromZoneForPlayer` + branch.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — zone-lock BOTH directions (`:discard` KOs from discard only / `:hand` KOs from hand only leaving a non-empty discard byte-unchanged) + no-fallback + magnitude cap + reachable no-op + per-target narration + each-player (all players) + Juggernaut no-breadcrumb.
- `scripts/convert-cards/apply-effect-markers.mjs` — 4-token grammar.
- `scripts/convert-cards/inputs/villain-effect-markers.json` — Juggernaut ambush + escape.
- `data/cards/core.json` — generated (2 markers).

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] Registry validate + `pnpm ledger:villains` regenerate + `:check` +
      `mechanics:metadata:check` + `sim:runtime-observed:check` exit 0.
- [ ] Replay/fixture `finalStateHash` unchanged OR regenerated-with-note (Verification 4).
- [ ] `docs/ai/DECISIONS.md` — D-24280 landed (Active).
- [ ] `WORK_INDEX.md` row `[x]`; `EC_INDEX.md` → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅` + `pnpm roadmap:counts:write`; `:check` exits 0.
- [ ] Live-on-surface (D-24026): drive a match where Juggernaut enters the city; each
      player KOs two heroes from discard, no `Unhandled effect observed`.

## Common Failure Smells
- Primitive drift test edited → you added a primitive instead of a descriptor param. Revert.
- The KO fires but the log shows no per-target line → `zone` leaked into `descriptorKey`
  (reverse-map now returns undefined → no result recorded). Remove it from the key.
- A hero gets KO'd from the hand under `:discard` → you reused the discard→hand→inPlay
  fallback resolver instead of the zone-locked one.
- `data/cards/*.json` churn beyond the two Juggernaut lines → hand-edit or stale regen.
- Juggernaut still records `unmarked-ability` → marker not regenerated onto the JSON.
