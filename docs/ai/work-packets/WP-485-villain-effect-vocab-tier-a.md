# WP-485 — Core Villain-Effect Vocabulary, Tier A (auto-resolve primitives)

**User-Visible Surface:** `play.legendary-arena.com` — fighting Enchantress, the
Destroyer, or Baron Zemo now actually does what the card says, instead of the
hollow no-op the diagnostics flag. **D-24026 live-verification applies**
(operator-pending: fight each in a live match; the effect fires and the game log
shows it).

## Goal

Implement three currently-**unmarked** ("unmarked-ability" / no-handler, per
D-24266) Core villain Fight abilities by adding three **auto-resolve** villain
effect primitives to the closed vocabulary. This is **Tier A** of the Core
villain-effect-vocabulary extension — the abilities whose handlers are pure and
auto-resolving (no player interactivity, no city-space state, no new persisted
`G` field): Enchantress ("Fight: Draw three cards."), the Destroyer ("Fight: KO
all your `[team:shield]` Heroes."), and Baron Zemo ("Fight: For each of your
`[team:avengers]` Heroes, rescue a Bystander."). Each gets a new
`VILLAIN_EFFECT_PRIMITIVE`, its parser grammar, a handler, the
`apply-effect-markers.mjs` vocabulary sync, and the card marker. Lands **D-24290**.

## User-Visible Impact

Three Core villains stop being hollow. Fighting Enchantress draws the attacker
three cards; fighting the Destroyer KOs all of the attacker's S.H.I.E.L.D. Heroes
(hand + in-play); fighting Baron Zemo rescues one Bystander per Avengers Hero the
attacker has in hand or in play. Casual and gauntlet play both benefit; the
gauntlet surfaced the gap (a live Magneto/Spider-Foes leg fought a hollow Doctor
Octopus, 2026-08-01).

## Assumes

- **On `origin/main` @ `e1ed1e09`** (baseline; WP-485/EC-520/D-24290 reserved via
  the reserve-first SPEC #1157). game-engine + registry card-data build/test green.
- **D-24266 markerless-breadcrumb** on `main` — an ability line with a
  `Fight:`/`Ambush:`/`Escape:` prefix but no `[effect:]` marker produces the
  `unmarked-ability` / `no-handler` hollow record (`villainAbility.setup.ts`
  `detectVillainUnmarkedTimingLine`). These three abilities are exactly that class.
- **D-24034 unresolved-marker discipline** on `main` — the append-only
  union/array/drift pattern for `VILLAIN_EFFECT_PRIMITIVES`
  (`rules/villainAbility.types.ts`), and the hand-synced vocabulary copy in
  `scripts/convert-cards/apply-effect-markers.mjs`.
- **Existing helpers this WP reuses:** `playerHasHeroMatchingTrait`
  (`villainEffects.execute.ts` — the `G.cardTraits` hand+in-play trait scan; this
  WP adds a **count** sibling); `drawCardsIntoHand` (`moves/drawCards.logic.ts`);
  the `capture-bystander` handler's player-award-a-Bystander mechanism (the
  onFight branch that awards a Bystander to the current player).
- Marker authoring path (`apply-effect-markers.mjs` + `villain-effect-markers.json`
  → `data/cards/core.json`) is the established villain-marker surface.

## Context (Read First)

**Read before executing:** `docs/ai/ARCHITECTURE.md §Layer Boundary` (Game Engine
owns effect handlers; Registry card data is generated input — the marker lives in
`scripts/convert-cards/inputs/villain-effect-markers.json`, applied to
`data/cards/core.json` by the generator), `.claude/rules/code-style.md` +
`.claude/skills/legendary-game-engine/SKILL.md`, and the villain-effect pipeline:
`packages/game-engine/src/rules/villainAbility.types.ts`
(`VILLAIN_EFFECT_PRIMITIVES` union + array + `VillainEffectDescriptor`),
`packages/game-engine/src/setup/villainAbility.setup.ts` (`parseParameterizedEffect`
grammar + `extractEffects`), `packages/game-engine/src/villain/villainEffects.execute.ts`
(`VILLAIN_EFFECT_HANDLERS` + `playerHasHeroMatchingTrait` + the `capture-bystander`
handler), and `scripts/convert-cards/apply-effect-markers.mjs` (the hand-synced
vocabulary + `isValidParameterizedEffectToken`).

**Why now:** the per-scheme gauntlet variety (WP-471..475) put Spider-Foes into a
Magneto game; fighting Doctor Octopus hit a hollow. The diagnostics scan then
showed 16 Core villain Fight/Ambush/Escape abilities are marker-less. All 16 need
NEW primitives (the cheap unconditional/magnitude-1 ones were curated long ago).
This is an **arc**, not one WP; this packet is **Tier A** — the auto-resolve
subset — deliberately scoped small and low-risk.

**The follow-on tiers (mapped here, drafted later):**
- **Tier B — named city spaces:** Whirlwind, Abomination, the Lizard ("if you
  fight X on the Rooftops/Bridge/Streets/Sewers…"). The engine has NO named city
  spaces (`G.city` is a 5-tuple, indices 0-4); needs a setup-time index→name map
  (new `G`/registry field) — a state-shape change with its own D-entry.
- **Tier C — recursive villain-deck play:** Endless Armies of HYDRA, the Leader
  ("play the top N cards of the Villain Deck"). Must re-enter `performVillainReveal`
  from a fire site (Ambush/Fight cascades) — recursion/determinism-sensitive.
- **Tier D — interactive choices:** Maestro (KO one of your Heroes per Strength
  Hero — a player KO choice), Ymir, Melter, Paibok, HYDRA Kidnappers ("you may…").
  Needs `pending*Choices` + block-all guards + resolve moves + arena-client UX
  (the Magneto-discard pattern). Viper ("each player without another HYDRA Villain
  in their Victory Pile gains a Wound") also lands here — it needs a victory-pile
  villain-group predicate the handlers lack today.
- **Tier E — Doctor Octopus:** "draw eight instead of six" at the next cleanup —
  a persisted per-turn flag surviving to the next `onBegin` (a **hashed-field**
  change; dual re-pin). Its own WP.

## Scope (In)

- **`packages/game-engine/src/rules/villainAbility.types.ts`** — append three new
  primitives to the `VillainEffectPrimitive` union AND the
  `VILLAIN_EFFECT_PRIMITIVES` array (append-only, D-24034): `draw-cards-current`,
  `ko-heroes-current-by-trait`, `rescue-bystanders-current-by-trait-count`. Extend
  `VillainEffectDescriptor` with the fields these need (a `drawCount` for
  `draw-cards-current`; the existing `requireKind`/`requireValue` reused as the
  trait predicate for the two trait primitives). No field is removed or re-typed.
- **`packages/game-engine/src/setup/villainAbility.setup.ts`** —
  `parseParameterizedEffect` gains three grammar branches:
  - `draw-cards-current:<N>` → `{ primitive: 'draw-cards-current', drawCount: N }` (N a
    positive integer).
  - `ko-heroes-current-by-trait:<kind>:<value>` → `{ primitive:
    'ko-heroes-current-by-trait', requireKind, requireValue }` (`kind` ∈
    `team|hero-class`; value normalized like the existing `reveal-or-wound` grammar).
  - `rescue-bystanders-current-by-trait-count:<kind>:<value>` → same predicate shape.
- **`packages/game-engine/src/villain/villainEffects.execute.ts`** — three handlers
  in `VILLAIN_EFFECT_HANDLERS`, plus a `countPlayerHeroesMatchingTrait` helper
  (the count sibling of `playerHasHeroMatchingTrait`, same hand+in-play scope,
  same `G.cardTraits` snapshot):
  - `draw-cards-current`: the current player draws `drawCount` cards via
    `drawCardsIntoHand` (the existing draw path; deck-exhaustion reshuffle is that
    helper's existing behavior). Self-narrates via `pushLog`.
  - `ko-heroes-current-by-trait`: KO **all** of the current player's heroes
    matching the trait, from **hand + in-play** (per operator ruling 2026-08-01),
    to the KO pile. Auto (all matching — no player choice). Self-narrates.
  - `rescue-bystanders-current-by-trait-count`: the current player rescues N
    Bystanders where N = `countPlayerHeroesMatchingTrait` (hand+in-play), awarding
    them via the same player-Bystander-award mechanism the `capture-bystander`
    onFight branch uses (bounded by the Bystander supply). Self-narrates.
- **`scripts/convert-cards/inputs/villain-effect-markers.json`** — add the tokens
  under the three cards: `enemies-of-asgard/enchantress.fight = ["draw-cards-current:3"]`,
  `enemies-of-asgard/destroyer.fight = ["ko-heroes-current-by-trait:team:shield"]`,
  `masters-of-evil/baron-zemo.fight =
  ["rescue-bystanders-current-by-trait-count:team:avengers"]`.
- **`scripts/convert-cards/apply-effect-markers.mjs`** — add the three primitives
  to the hand-synced `VILLAIN_EFFECT_PRIMITIVES` copy and extend
  `isValidParameterizedEffectToken` to accept the three grammars.
- **`data/cards/core.json`** — regenerated by running `apply-effect-markers.mjs`
  (the three Fight lines gain their `[effect:…]` markers). Generated output, not
  hand-edited.
- **`docs/ai/coverage/villain-mechanic-ledger.json` + `.csv`** — regenerated by
  `pnpm ledger:villains` (CI-gated by `ledger:villains:check`, `ci.yml`): the three
  abilities flip from `(unmarked)` to their new executable primitive (Destroyer
  gains a second executable Fight row beside its existing Escape row). Generated
  output, committed, not hand-edited.
- **`scripts/coverage/mechanic-provenance.json`** — add the three new mechanics'
  `{ wp: 'WP-485', decision: 'D-24290' }` provenance entries (the ledger's
  `wp`/`decision` columns; keeps the WP-484 Effect-Implementation-Index join
  populated rather than blank).
- **Tests** — new handler cases in `villain/villainEffects.execute.test.ts`
  (each primitive: effect fires; magnitude/trait filtering correct; empty-match
  no-ops cleanly); parser cases in `setup/villainAbility.setup.test.ts`; the
  drift/round-trip assertions in `rules/villainAbility.types.test.ts` extended for
  the three new primitives; a `diagnostics/hollowEffect.test.ts` check that the
  three abilities no longer emit `unmarked-ability`.
- **`docs/ai/DECISIONS.md`** — land **D-24290**.

## Out of Scope

- **Tiers B–E** (city-space, recursive villain-deck play, interactive, Doc Ock) —
  their own follow-on WPs (mapped above). No city-space state, no `pending*Choices`,
  no recursion into `performVillainReveal`, no cleanup-draw override here.
- No change to existing primitives, the `capture-bystander` behavior, the KO-hero
  per-player helper, or any hero-effect vocabulary. No `ambush`/`escape` timing for
  these three (all are `Fight:`). No new `G` field. No `ci.yml` change.

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` (+ `.test.ts`)
- `packages/game-engine/src/setup/villainAbility.setup.ts` (+ `.test.ts`)
- `packages/game-engine/src/villain/villainEffects.execute.ts` (+ `.test.ts`)
- `packages/game-engine/src/diagnostics/hollowEffect.test.ts` — no-longer-hollow assertion
- `scripts/convert-cards/inputs/villain-effect-markers.json`
- `scripts/convert-cards/apply-effect-markers.mjs`
- `data/cards/core.json` — regenerated (markers applied)
- `docs/ai/coverage/villain-mechanic-ledger.json` + `.csv` — regenerated (`pnpm ledger:villains`; CI-gated)
- `scripts/coverage/mechanic-provenance.json` — 3 new mechanic → WP-485 / D-24290 entries
- `docs/ai/DECISIONS.md` — land D-24290

## Contract

> Full file contents (no diffs); ESM/Node v22+; `00.6`; game-engine imports Node
> built-ins only; handlers are pure + deterministic (`for...of`, no `.reduce()`);
> the closed union is append-only (D-24034); markers are authored in the inputs
> overlay and applied by the generator (never hand-edited into `core.json`).

**Locked — three new auto-resolve primitives (tokens + semantics):**
- `draw-cards-current:<N>` — current player draws N (via `drawCardsIntoHand`).
- `ko-heroes-current-by-trait:<team|hero-class>:<value>` — KO **all** current
  player's matching heroes from **hand + in-play**.
- `rescue-bystanders-current-by-trait-count:<team|hero-class>:<value>` — current
  player rescues N Bystanders, N = count of matching heroes (hand + in-play),
  bounded by the Bystander supply.

Each handler self-narrates via `pushLog` (keyword-less, like `scry-ko` /
`reveal-or-wound`); the reverse legacy-keyword map returns undefined, so no
generic `<timing> effect:` line and no `VillainEffectResult`. All three are
auto-resolve — **no `pending*Choices`, no block-all guard, no resolve move**.

## Acceptance Criteria

- [ ] Fighting Enchantress draws the current player 3 cards; the log shows it; the
      ability is no longer `unmarked-ability`.
- [ ] Fighting the Destroyer KOs **every** S.H.I.E.L.D.-team hero the current
      player has in hand + in-play (a player with none no-ops cleanly).
- [ ] Fighting Baron Zemo rescues exactly one Bystander per Avengers-team hero the
      current player has in hand + in-play (zero Avengers → zero, no error; bounded
      by the Bystander supply).
- [ ] `node scripts/convert-cards/apply-effect-markers.mjs` leaves
      `data/cards/core.json` with the three `[effect:…]` markers and no other card
      drift (`git diff` shows only the three intended lines).
- [ ] `VILLAIN_EFFECT_PRIMITIVES` union ↔ array drift test passes with the three
      new entries; the parser accepts the three grammars and rejects malformed tokens.
- [ ] `pnpm ledger:villains:check` exits 0 (the regenerated
      `villain-mechanic-ledger.{json,csv}` reflect the three now-executable Fight
      abilities; provenance columns carry WP-485 / D-24290).
- [ ] game-engine `test` + `pnpm -r build` exit 0. `finalStateHash` / sentinel
      re-pin only if a committed fixture reaches one of these three fights
      (`draw-cards-current` reshuffle path); confirm empirically and re-pin with note if so.
- [ ] `D-24290` landed. No file outside the allowlist (+ governance) is modified.

## Verification Steps

```bash
node scripts/convert-cards/apply-effect-markers.mjs   # regenerate markers
git diff --stat data/cards/core.json                  # only the 3 Fight lines
pnpm -r build && pnpm ledger:villains                 # regenerate the villain mechanic ledger
pnpm ledger:villains:check                            # CI gate: ledger current
pnpm --filter @legendary-arena/game-engine test
pnpm -r build && pnpm -r --no-bail test
# Post-deploy (D-24026): fight Enchantress / Destroyer / Baron Zemo in a live
# match; each effect fires and the game log records it (no hollow breadcrumb).
```

## Vision Alignment

**Clauses:** §1-9 (faithful game implementation — cards do what they say).
**Conflict:** *No conflict* — closes three faithfulness gaps; no scoring/PAR/RNG/
persistence surface (auto-resolve handlers; the only randomness is the existing
`drawCardsIntoHand` reshuffle path). Locks the three new primitives under **D-24290**.
**NG:** none.

## Definition of Done

- [ ] All AC pass; game-engine test + `pnpm -r build` + `pnpm -r --no-bail test` green.
- [ ] **D-24290 Active.**
- [ ] **D-24026 live-verify (operator-pending):** the three fights fire live.
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-520 Done.
- [ ] No files outside the list.

## Lint Gate Self-Review

- §1/§15: header + `## User-Visible Impact`; D-24026 present. PASS.
- §2: Contract full-file / no-diffs / `00.6`. PASS. §4: Context read-list. PASS.
- §5: game-engine (3 src + tests) + card-data (2 inputs + generated core.json) +
  the CI-gated `villain-mechanic-ledger.{json,csv}` (regenerated) + provenance map +
  DECISIONS. One layer edge (Registry card-data input → Game Engine consumer), the
  established villain-marker pattern (data authored in overlay, consumed by the
  engine); downward, allowed. The ledger/provenance are derived-artifact ripple
  sites in-allowlist per 01.4 (not a new layer crossing). PASS.
- §8: game-engine Node-only, pure handlers; card data via generator. PASS.
- §17: §1-9, No conflict, D-24290. PASS. §20 N/A — no funding/pricing/copy/channel.
  §21 N/A — no `apps/server` HTTP endpoint or `Library-only` catalog function
  added/removed/restatused; a game-engine effect handler is not a catalog surface.
- New closed-union primitives → reserves/lands **D-24290** (contract change recorded).

## Gate Verdicts (drafting session)

Recorded at drafting; see the SPEC commit body for the pre-flight / copilot / lint
subagent verdicts run against this WP + EC-520.
