# EC-529 — Core Villain-Effect Vocabulary, Tier D (Viper — Conditional Victory-Pile-Gated Each-Player Wound)

**Source:** docs/ai/work-packets/WP-494-villain-effect-vocab-tier-d-viper.md
**Layer:** Game Engine (primitive + descriptor field + parser + handler) + Registry
card-data markers — downward edge only.

## Before Starting
- [ ] On `origin/main` (post-reserve; after WP-469/D-24281 + WP-252/D-24023 + WP-489/D-24295
      are on main), worktree clean; game-engine + card-data build/test green.
- [ ] Confirm Viper is still `unmarked-ability` today: `core/hydra/viper`, two lines —
      "Fight: Each player without another HYDRA Villain in their Victory Pile gains a
      Wound." + "Escape: Same effect." (`data/cards/core.json`). Core `hydra` group has
      4 villains (endless-armies-of-hydra, hydra-kidnappers, supreme-hydra, viper).
- [ ] Confirm the precedents: `villainEffectRevealOrWound` is the conditional-each-player
      skeleton to mirror; the onEscape fire site (`villainDeck.reveal.ts`) already runs
      `executeVillainAbilities` for escaping villains; `defeatCityVillainCore` pushes the
      fought Viper to the current player's Victory Pile BEFORE onFight runs (exclude by
      `cardId`); NO villain group/team map exists in `G`.
- [ ] **Scaffold:** add the new primitive to the union+array + the descriptor field +
      the parser branch and run `pnpm --filter @legendary-arena/game-engine test`. Expect
      the primitives-count drift test to want **13** (update it) and NO other break (the
      new descriptor field is additive-optional; round-trip over legacy keywords
      unchanged). "Extend the drift/round-trip test" = update the count to 13 + ADD
      positive coverage for the new field.
- [ ] **Exact target file set (any outside = FAIL, STOP; governance close-out excepted):**
      `rules/villainAbility.types.ts`(+test), `setup/villainAbility.setup.ts`(+test),
      `villain/villainEffects.execute.ts`(+test), `diagnostics/hollowEffect.test.ts`,
      `scripts/convert-cards/inputs/villain-effect-markers.json`,
      `scripts/convert-cards/apply-effect-markers.mjs`, `data/cards/core.json`(generated),
      `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`(regenerated, CI-gated),
      `data/metadata/effect-implementation-index.json`(regenerated ripple, CI-gated by
      `effect-index:check` — the WP-485 precedent; the `core-villain-hydra-viper` row
      flips, the co2e twin stays unmarked), `scripts/coverage/mechanic-provenance.json`,
      `docs/ai/DECISIONS.md`
      **(+ governance close-out: `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
      `STATUS.md`, `NUMBER-LEDGER.md`).**

## Locked Values (do not re-derive)
- **New primitive** `gain-wound-unless-victory-villain-group` — append at position 13
  to BOTH `VillainEffectPrimitive` (union) and `VILLAIN_EFFECT_PRIMITIVES` (array),
  append-only per D-24034; drift-test count 12→**13**. Keyword-less (NO
  `LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR` entry) → self-narrates.
- **Additive descriptor field** `victoryVillainGroup?: string` — the target villain
  group slug (`hydra`). NOT part of `descriptorKey`. No field removed/re-typed.
- **Marker grammar:** `gain-wound-unless-victory-villain-group:<groupSlug>` (exactly 2
  tokens; slug non-empty, `normalizeTraitSlug`-normalized) →
  `{ primitive, victoryVillainGroup: <slug> }`; empty slug / extra tokens → null
  (`unresolvedMarkers`).
- **Card markers (BOTH timings):** Viper `fight` AND `escape` =
  `gain-wound-unless-victory-villain-group:hydra`.
- **Group identification (Path B — NO new `G` field, NO villain-group map):**
  `setAbbr = cardId.slice(0, cardId.indexOf('-villain-'))`; a Victory-Pile card is a
  group-`G` villain iff it `!== cardId` AND
  `startsWith(\`${setAbbr}-villain-${group}-\`)`. Reads only already-hashed state.
- **Handler** `villainEffectGainWoundUnlessVictoryVillainGroup` (mirror
  `villainEffectRevealOrWound`): for each `playerId` in
  `Object.keys(G.playerZones).sort()`, wound one UNLESS the player's Victory Pile has
  another group-`G` villain; supply-bounded (`G.piles.wounds.length === 0` → skip);
  `woundsDrawn` += 1 for the current player only; self-narrate one honest
  `applied`/`blocked` line; return `{ targets: [] }`.
- **Provenance:** add `"gain-wound-unless-victory-villain-group": { "wp": "WP-494",
  "decision": "D-24299" }` to `mechanic-provenance.json` (net-new primitive — unlike
  Whirlwind, which reused `ko-hero`).
- **CI ripple:** `pnpm -r build && pnpm ledger:villains && pnpm effect-index` then
  `ledger:villains:check` + `effect-index:check` (the effect-index is a villain-ledger
  ripple — WP-485 precedent; the Viper core row flips, the co2e twin stays unmarked).

## Guardrails
- game-engine Node built-ins only; handler pure/deterministic (NO `ctx.random`);
  `for...of`, no `.reduce()`; `00.6` names. Markers authored in JSON, applied by the
  generator — NEVER hand-edit `core.json`; `git diff` shows ONLY Viper's two lines.
- **NO new `G` field, NO villain-group map** (Path B — a new hashed setup map re-pins
  ALL committed fixtures). Derive `setAbbr` from the fought `cardId`; match by prefix.
- Defensive: absent `victoryVillainGroup`, or a `cardId` lacking the `-villain-` infix
  → no wound (`{ targets: [] }`), never a throw. Exclude the fought `cardId` (`another`).
- Existing `gain-wound` / `reveal-or-wound` branches stay behavior-identical. No
  recursion into `performVillainReveal`, no `pending*Choices`, no `ci.yml`.
- Both Fight and Escape are marked; the onEscape fire site already runs the executor —
  do NOT add a new escape path.

## Required `// why:` Comments
- Why `setAbbr` is derived from the fought `cardId` (`-villain-` infix) instead of a
  villain-group `G` map (a new hashed setup field re-pins every committed fixture). The
  membership test MUST anchor on the FULL prefix `${setAbbr}-villain-${group}-`, NOT a
  bare `.includes('-villain-')`: villain-deck bystanders (`bystander-villain-deck-NN`)
  carry the `-villain-` substring and can sit in a Victory Pile, but never start with
  the anchored prefix (they start `bystander-`); henchmen use the disjoint `henchman-…`
  namespace.
- Why the fought `cardId` is excluded from the Victory-Pile scan (printed "*another*"
  HYDRA Villain; on Fight the just-defeated Viper is already in the current player's
  Victory Pile).
- Why the effect self-narrates (keyword-less — `descriptorToLegacyKeyword` → undefined,
  so the generic reverse-mapped line never fires).
- Why `woundsDrawn` bumps for the current player only (UI economy projects the current
  player's wounds; parity with reveal-or-wound / gain-wound:each).
- Why `victoryVillainGroup` is excluded from `descriptorKey` (a predicate detail; the
  descriptor must stay keyword-less).
- Why the group-slug match is lowercase-kebab-safe: the parser `normalizeTraitSlug`s
  the marker value (trim+lowercase) and villain-instance ext_id group slugs are
  registry-verbatim lowercase-kebab, so `startsWith` never mismatches on case for
  `hydra` (a mixed-case group slug would need re-normalizing the ext_id side — none exist).

## Files to Produce
- `villainAbility.types.ts` — new primitive (union+array) + `victoryVillainGroup?` (+drift test).
- `villainAbility.setup.ts` — the `:<groupSlug>` grammar branch (+parse test).
- `villainEffects.execute.ts` — the handler + `VILLAIN_EFFECT_HANDLERS` entry (+tests).
- `hollowEffect.test.ts` — Viper (fight + escape) no longer `unmarked-ability`.
- `villain-effect-markers.json` (fight+escape) + `apply-effect-markers.mjs` (primitive + grammar).
- `core.json` regenerated; `villain-mechanic-ledger.{json,csv}` regenerated;
  `effect-implementation-index.json` regenerated (ripple; Viper core row flips);
  `mechanic-provenance.json` — 1 new WP-494/D-24299 entry.
- `DECISIONS.md` — land D-24299.

## After Completing
- [ ] `apply-effect-markers.mjs`; `git diff --stat data/cards/core.json` = Viper's two lines only.
- [ ] `pnpm -r build && pnpm ledger:villains && pnpm effect-index` then
      `ledger:villains:check` + `effect-index:check` exit 0; provenance carries the new
      primitive; `git diff data/metadata/effect-implementation-index.json` = the
      `core-villain-hydra-viper` row only (co2e twin unchanged).
- [ ] game-engine test + `pnpm -r build` + `pnpm -r --no-bail test` exit 0.
      **No new `G` field.** `finalStateHash`/sentinel re-pin ONLY if a committed fixture's
      villain deck *includes* `core/hydra` (verify: sentinel=`core/brotherhood`,
      PRE_WP080=`test/*`), so expect no re-pin.
- [ ] **D-24299 Active.** STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-529 Done.
- [ ] No file outside the allowlist (+ governance). Revert `lagn-v1.json` EOL churn.

## Common Failure Smells
- core.json shows > 2 changed lines → a marker matched the wrong line or the generator
  grammar drifted from the engine parser.
- A masters-of-evil villain in the Victory Pile suppresses the wound → the prefix is
  wrong (must be `${setAbbr}-villain-hydra-`, not a substring `includes`).
- The just-defeated Viper suppresses its own wound → the `!== cardId` exclusion is missing.
- Drift test red on count → the new primitive was added to the union but not the array
  (or vice versa), or the count wasn't bumped to 13.
- A broad finalStateHash/PRE_WP080 re-pin on a green build → a new `G` field was added
  (Path A). Path B adds none; re-pin only if a committed fixture deck includes core/hydra.
- Viper wounds no one when it should → the Escape line wasn't marked, or the handler
  read the wrong player's Victory Pile (must iterate ALL players, not just current).
