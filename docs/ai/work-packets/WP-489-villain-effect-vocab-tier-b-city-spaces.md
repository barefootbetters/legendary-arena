# WP-489 — Core Villain-Effect Vocabulary, Tier B (Named City Spaces)

## Goal

Give the engine **named city spaces** and a **location gate** so villain
abilities that read "*if you fight this Villain on the <space>…*" fire correctly,
and use that capability to implement two currently-hollow Core villain Fight
abilities: **Abomination** ("*Fight: If you fight Abomination on the Streets or
Bridge, rescue three Bystanders.*") and **The Lizard** ("*Fight: If you fight the
Lizard in the Sewers, each other player gains a Wound.*"). Both are auto-resolve.
The player sees the gated effect actually happen (or a clear "no effect — wrong
space" log) instead of the silent `unmarked-ability` breadcrumb they emit today.

## Assumes

- **WP-485 / D-24290 (Tier A) ✅** — the auto-resolve villain-vocabulary precedent
  (keyword-less, self-narrating primitives; `apply-effect-markers.mjs` vocabulary
  sync; the `hollowEffect` no-longer-unmarked test pattern). Landed on `main`.
  (Source: WORK_INDEX WP-485.)
- **WP-252 / D-24023 ✅** — the parameterized `VillainEffectPrimitive` +
  `VillainEffectDescriptor {primitive,target?,magnitude?,selector?}` +
  `VILLAIN_EFFECT_HANDLERS` dispatch that Tier B extends. (Source: WORK_INDEX WP-252.)
- **WP-202 / D-20203 ✅** — the each-player iteration pattern
  (`Object.keys(G.playerZones).sort()`) and `gain-wound` target handling this WP's
  `each-other` variant mirrors. (Source: WORK_INDEX WP-202.)
- **WP-478 / D-24285 ✅** — the trailing-optional handler-parameter precedent
  (`shuffleContext?` threaded through `executeVillainAbilities` → the handler
  signature) that this WP's `cityIndex?` threading copies. (Source: WORK_INDEX WP-478.)
- **D-24266 ✅** — the `unmarked-ability` breadcrumb these two abilities emit today
  (marker-less ability lines). **D-24034 ✅** — append-only union/array/drift
  discipline.
- **Engine facts on `main` @ baseline `9ae926c1`** (grounded 2026-08-01):
  - `G.city` is a fixed 5-tuple `[CitySpace×5]` indexed 0-4; **index 0 is the entry
    space, index 4 is the escape edge** (`board/city.types.ts:21-29`). The spaces are
    **not named anywhere** — no `CITY_SPACE_NAMES` constant exists yet.
  - The fought city index **is not available at the villain-effect handler fire
    site** today: `fightVillain` knows `cityIndex` (`moves/fightVillain.ts:51-80`)
    but nulls the slot (`:156`) *before* firing effects (`:192`) and does **not**
    pass the index into `executeVillainAbilities`
    (`villain/villainEffects.execute.ts:93-105`) or the `VillainEffectHandler`
    signature (`:469-481`). Threading it is the core of this WP.
  - The `keywords-full.json` glossary *corroborates* (does not prove — it is
    ~20%-unreliable, hallucinated descriptions) the entry space as the **Sewers** (`:70`,
    `:524`) and Rooftops / Streets as named city spaces (`:314`). The authoritative
    index→name binding is operator-confirmed against the physical board (Verification §1).

## Context

**Why now.** Same live Doctor-Octopus hollow (Magneto/Spider-Foes gauntlet,
2026-08-01) that surfaced Tier A: the diagnostics scan found 16 marker-less Core
villain abilities. Tier A (WP-485) took the auto-resolve subset with no board
condition. Tier B takes the next-cheapest subset: abilities gated on the **named
city space** the villain is fought on. This is the arc's first *board-state-aware*
villain effect.

**Two of the three "city-space" cards, not three — Whirlwind is deferred.** The
Tier map in WP-485 §Context listed {Whirlwind, Abomination, the Lizard} under
Tier B. Grounding refined that: **Whirlwind's "KO two of *your* Heroes" is
inherently interactive** — the current player chooses which Heroes to KO. The
engine's only faithful multi-KO of the current player's own Heroes is the
interactive `pendingKoHeroChoices` pipeline (WP-242/D-24007), which parks a player
choice; there is **no** auto-resolve path that faithfully KOs "two of your Heroes."
Interactivity is the heavier concern and the WP-485 map already routes interactive
villains to **Tier D**. So Whirlwind moves to Tier D, where it will reuse *both* this
WP's location gate *and* the interactive KO pipeline (extended to a magnitude-bearing
current-player KO). Keeping Tier B to the two auto-resolve city cards keeps this WP
single-concern: **named city spaces + a location gate**, not new interactive machinery.

**One WP, single layer.** Game Engine + card-data markers only (identical layer
shape to Tier A). The cross-file threading (`fightVillain` → executor → handler,
plus `undefined` at the reveal fire sites) is mechanical trailing-optional wiring
(the `shuffleContext?` precedent), not a layer crossing. One D-entry (D-24295). Not
split.

**No *new* `G` field; hash re-pin only if a fixture's villain deck includes these cards.**
City-space names are static and derivable from the index; they live as a **pure engine
constant**, never in `G` — no *new* `G` field is added. But the marker descriptors DO land
in `G`: they attach to the two cards' entries in `G.villainAbilityHooks`, which **is** a
hashed top-level `G` field (seeded at `setup/buildInitialGameState.ts`; NOT in the
`hashGameState.ts` exclusion set). So marking Abomination / the Lizard shifts
`finalStateHash` / `PRE_WP080` for any committed fixture whose **villain deck includes**
those cards — the fight need not occur. **Verified: no committed engine fixture uses the
`core/radiation` or `core/spider-foes` groups** (the WP-158 sentinel uses
`core/brotherhood`; the PRE_WP080 replay uses `test/*` groups), so **no re-pin today**.
Re-pin (dual: `record-game-fixture.mjs` sentinel + `PRE_WP080_HASH`) only if a future
committed fixture's villain deck includes Abomination or the Lizard. The gated effects
themselves mutate already-hashed zones through existing primitives.

## Scope (In)

- **`packages/game-engine/src/board/citySpaceNames.ts`** (new) — the canonical
  index→name mapping as a pure constant:
  `CITY_SPACE_NAMES: readonly ['sewers','bank','rooftops','streets','bridge']`
  (index 0 = entry = Sewers … index 4 = escape edge = Bridge), a `CitySpaceName`
  union type derived from it, and a `citySpaceNameForIndex(index): CitySpaceName |
  undefined` helper (out-of-range/undefined → `undefined`). No `boardgame.io` import.
- **`packages/game-engine/src/rules/villainAbility.types.ts`** — extend
  `VillainEffectDescriptor` (additive, no field removed/re-typed):
  - `requireCitySpaces?: readonly CitySpaceName[]` — the location gate.
  - add `'each-other'` to the `target` union (alongside `'current' | 'each'`).
  - `capture-bystander` gains use of the existing `magnitude?` field as a rescue
    **count** (default 1). **No new `VillainEffectPrimitive`** — Tier B reuses
    `gain-wound` and `capture-bystander`. Extend the drift/round-trip test for the
    new `target` value + the descriptor field.
- **`packages/game-engine/src/setup/villainAbility.setup.ts`** —
  `parseParameterizedEffect` gains a **universal gate suffix**: a token may carry a
  trailing `@<space>[+<space>…]` which is split off first and lifted into
  `requireCitySpaces` (each space validated against `CITY_SPACE_NAMES`; unknown
  space → `unresolvedMarkers`, never a silent accept). The remaining left side parses
  by the existing grammar, extended so:
  - `gain-wound:each-other[:<N>]` → `{ primitive:'gain-wound', target:'each-other',
    magnitude: N ?? 1 }`.
  - `capture-bystander:<N>` → `{ primitive:'capture-bystander', magnitude: N }` (the
    existing no-arg `capture-bystander` still parses to `magnitude: undefined` → 1).
  - `isValidParameterizedEffectToken` / vocabulary sync mirrored in the marker script.
- **`packages/game-engine/src/villain/villainEffects.execute.ts`**:
  - Thread the fought `cityIndex?: number` through `executeVillainAbilities`
    (trailing-optional, `shuffleContext?` precedent) and into the
    `VillainEffectHandler` signature; the 12 existing handlers widen trivially.
  - A **universal gate** in the effect-application path (before handler dispatch):
    if `descriptor.requireCitySpaces` is set and
    `citySpaceNameForIndex(cityIndex)` is `undefined` or not in the list → **skip the
    effect** and self-narrate via `pushLog` (e.g. "…not fought on the Streets or
    Bridge; no effect."). If the gate passes, dispatch as normal.
  - `gain-wound` handler: new `each-other` branch — iterate
    `Object.keys(G.playerZones).sort()` skipping `currentPlayer`, wound each
    (supply-bounded), self-narrate.
  - `capture-bystander` handler: honor `magnitude` — repeat the existing attach +
    (onFight) award to the current player up to N, stopping when the supply empties;
    self-narrate the actual count rescued.
- **`packages/game-engine/src/moves/fightVillain.ts`** — capture `cityIndex` (the
  move already has it as an arg) and pass it into `executeVillainAbilities`. The slot
  is nulled before effects fire, but the **index value** is a plain number and
  survives; no reorder needed.
- **`packages/game-engine/src/villainDeck/villainDeck.reveal.ts`** — the
  `onAmbush` / `onEscape` fire sites pass `cityIndex: undefined` (no fought space);
  any `requireCitySpaces` effect there fails the gate closed. None of Tier B's cards
  are Ambush/Escape.
- **`scripts/convert-cards/inputs/villain-effect-markers.json`** — add:
  - `radiation/abomination.fight = ["capture-bystander:3@streets+bridge"]`
  - `spider-foes/the-lizard.fight = ["gain-wound:each-other@sewers"]`
- **`scripts/convert-cards/apply-effect-markers.mjs`** — extend
  `isValidParameterizedEffectToken` to accept the `@<space>` gate suffix + the two
  extended grammars, and sync the hand-copied vocabulary.
- **`data/cards/core.json`** — regenerated by `apply-effect-markers.mjs` (the two
  Fight lines gain their `[effect:…]` markers). Generated, not hand-edited; `git diff`
  shows only the two Fight lines.
- **`docs/ai/coverage/villain-mechanic-ledger.json` + `.csv`** — regenerated by
  `pnpm ledger:villains` (CI-gated by `ledger:villains:check`): Abomination + the
  Lizard flip `(unmarked)` → their new executable Fight rows.
- **`scripts/coverage/mechanic-provenance.json`** — add the new mechanics'
  `{ wp:'WP-489', decision:'D-24295' }` provenance entries (keeps the WP-484
  Effect-Implementation-Index join populated).
- **Tests** — handler cases in `villain/villainEffects.execute.test.ts` (gate
  pass/fail per space; `gain-wound:each-other` skips current; `capture-bystander:N`
  count + supply bound); a `cityIndex`-threading test through `fightVillain`; parser
  cases in `setup/villainAbility.setup.test.ts` (gate suffix, unknown-space rejection,
  the two grammars); drift/round-trip in `rules/villainAbility.types.test.ts`; a
  `board/citySpaceNames` unit test; a `diagnostics/hollowEffect.test.ts` check that
  Abomination + the Lizard no longer emit `unmarked-ability`.
- **`docs/ai/DECISIONS.md`** — land **D-24295**.

## Out of Scope

- **Whirlwind** — interactive ("KO two of *your* Heroes"); Tier D (reuses this WP's
  gate + the WP-242 `pendingKoHeroChoices` pipeline extended to current-player
  magnitude-N). Explicitly not marked here.
- **Tiers C / D / E** — recursive villain-deck play (Endless Armies, the Leader),
  the other interactive cards (Maestro, Viper, Ymir, Melter, Paibok, HYDRA
  Kidnappers), and the Doctor Octopus cleanup-draw override. No recursion into
  `performVillainReveal`, no `pending*Choices`, no new `G` field, no cleanup override.
- **Cross-set city-space villains** (Galactus destroy-space, Burrow, Conqueror,
  Momentum, Patrol, etc.) — Tier B builds the reusable named-space capability but
  marks only the two Core cards. No new `G.city` mechanics (destroyed spaces, etc.).
- No change to the fight/advance/escape movement logic, the `capture-bystander`
  behavior for *un-counted* markers, or the existing `gain-wound` `current`/`each`
  branches. No `ci.yml` change.

## Files Expected to Change

Engine: `board/citySpaceNames.ts` (new, +test), `rules/villainAbility.types.ts`
(+`.test.ts`), `setup/villainAbility.setup.ts` (+`.test.ts`),
`villain/villainEffects.execute.ts` (+`.test.ts`), `moves/fightVillain.ts`
(+`fightVillain.test.ts` if a threading assertion is added),
`villainDeck/villainDeck.reveal.ts`, `diagnostics/hollowEffect.test.ts`.
Card data / tooling: `scripts/convert-cards/inputs/villain-effect-markers.json`,
`scripts/convert-cards/apply-effect-markers.mjs`, `data/cards/core.json` (generated).
Coverage (generated/CI-gated): `docs/ai/coverage/villain-mechanic-ledger.json`,
`docs/ai/coverage/villain-mechanic-ledger.csv`,
`scripts/coverage/mechanic-provenance.json`.
Governance: `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
`docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
`docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md`.

## Contract

- **`CITY_SPACE_NAMES`** (index 0-4), **proposed pending operator confirmation**:
  `['sewers','bank','rooftops','streets','bridge']` (index 0 = entry, index 4 = escape edge
  per `city.types.ts`). Load-bearing faithfulness binding; **NOT locked** until the operator
  confirms the full mapping — endpoints included — against the authoritative rulebook (see
  Verification Step 1). `keywords-full.json` is corroborating-only.
- **`VillainEffectDescriptor`** additive fields: `requireCitySpaces?: readonly
  CitySpaceName[]`; `target` union gains `'each-other'`; `magnitude?` now read by the
  `capture-bystander` handler as a rescue count. No `VillainEffectPrimitive` added
  (union unchanged; drift array unchanged).
- **Marker grammar** additions (self-narrating, keyword-less):
  - gate suffix `@<space>[+<space>…]` on any effect token → `requireCitySpaces`.
  - `gain-wound:each-other[:<N>]`; `capture-bystander:<N>`.
- **Handler signature**: `cityIndex?: number` threaded trailing-optional through
  `executeVillainAbilities` and `VillainEffectHandler`; `undefined` at non-fight fire
  sites; gate fails closed on `undefined`.
- **Card markers**: Abomination `capture-bystander:3@streets+bridge` (Fight); the
  Lizard `gain-wound:each-other@sewers` (Fight).

## Acceptance Criteria

1. `CITY_SPACE_NAMES` + `citySpaceNameForIndex` exist as a pure constant/helper (no
   `boardgame.io`, no `G` field); unit-tested including out-of-range → `undefined`.
2. Fighting **Abomination** on the Streets (index 3) or the Bridge (index 4) rescues
   exactly 3 Bystanders to the current player (supply-bounded); on any other space it
   logs "no effect" and rescues none.
3. Fighting **The Lizard** in the Sewers (index 0) gives each **other** player a Wound
   (never the current player); on any other space it logs "no effect."
4. The fought `cityIndex` is threaded from `fightVillain` to the handlers; the two
   non-fight fire sites pass `undefined`; the 12 pre-existing handlers are behavior-
   identical.
5. Unknown city-space names in a marker are rejected to `unresolvedMarkers` (never
   silently accepted).
6. Abomination + the Lizard no longer emit `unmarked-ability`
   (`hollowEffect.test.ts`); `git diff data/cards/core.json` shows only their two
   Fight lines.
7. `pnpm -r build && pnpm ledger:villains` then `pnpm ledger:villains:check` exit 0;
   provenance `wp`/`decision` populated for the new rows.
8. Whirlwind is **unchanged** (still `unmarked-ability`) — verified deferred, not
   silently dropped.
9. game-engine test + `pnpm -r build` + `pnpm -r --no-bail test` exit 0.
   `finalStateHash` / `PRE_WP080` unchanged — re-pin ONLY if a committed fixture's
   villain deck *includes* Abomination or the Lizard (`core/radiation` /
   `core/spider-foes`), because the markers land in the hashed `villainAbilityHooks`
   field; none do today (verified), so expect no re-pin.

## Verification Steps

1. **Confirm the FULL index→name binding against the authoritative rulebook
   (load-bearing).** The engine locks only the *convention* — index 0 = entry, index 4 =
   escape edge (`board/city.types.ts:23-29`). Which **named** space sits at each index is
   NOT reliably derivable from the repo: the `keywords-full.json` glossary is
   **known ~20% unreliable** (hallucinated descriptions — see the `keywords-json v23
   divergence` note) and is **corroborating-only**, never authoritative. Before execution
   locks `CITY_SPACE_NAMES`, the operator confirms the **entire** binding — above all the
   **endpoints** (which named space a newly-revealed Villain *enters* = index 0, and which
   it is pushed *off* to escape = index 4) plus the middle order — against the physical
   Upper Deck Marvel Legendary board / official rulebook. Proposed (pending confirmation):
   **Sewers(0), Bank(1), Rooftops(2), Streets(3), Bridge(4)**. Tier B exercises the
   Lizard's **Sewers** binding and Abomination's **Streets and Bridge** bindings; a
   reversed endpoint binding would make both cards fire on exactly the wrong spaces with
   green tests, so this confirmation is a hard execution precondition.
2. `pnpm --filter @legendary-arena/game-engine test` — new handler/parser/constant
   tests pass.
3. `node scripts/convert-cards/apply-effect-markers.mjs`; `git diff --stat
   data/cards/core.json` = the two Fight lines only.
4. `pnpm -r build && pnpm ledger:villains && pnpm ledger:villains:check` exit 0.
5. **D-24026 live-verify (operator-pending, post-deploy):** in a live match on
   `play.legendary-arena.com`, fight Abomination on the Streets/Bridge (3 Bystanders
   rescued) and the Lizard in the Sewers (each other player wounded); confirm the game
   log narrates each, and that off-space fights narrate "no effect."

## Definition of Done

- All Acceptance Criteria met; EC-524 After-Completing satisfied.
- **D-24295 Active**; WORK_INDEX `[x]`; EC_INDEX EC-524 Done; MINDMAP `📝`→`✅` +
  `roadmap:counts:write`; STATUS updated.
- Two-commit topology (`EC-524:` implementation + `SPEC:` governance close).
- No file outside the allowlist (+ governance). lagn-v1.json EOL churn reverted.
- `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify recorded as
  operator-pending.

## Lint Gate Self-Review

Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` (21 sections):

- **§1-9 (structure, goal, scope, files, contract, AC, verification, DoD, assumes):**
  PASS — all present; scope is a closed enumeration; files allowlist mirrors §Scope;
  AC testable.
- **§10 (layer boundary):** PASS — single layer (Game Engine + card-data markers), no
  crossing; pure constant has no `boardgame.io` import.
- **§10a / §22 (determinism / persistence):** PASS — no *new* `G` field (names are a
  constant); but the marker descriptors attach to the hashed `villainAbilityHooks` field, so
  the hash shifts only for a committed fixture whose villain deck includes these two cards —
  none do today (verified); corrected re-pin trigger in AC-9.
- **§11 (contract-file lock):** PASS — `villainAbility.types.ts` is a locked contract file,
  MODIFIED here additively only (a new optional descriptor field + a new `target` enum
  value; append-only per D-24034); the change is recorded in D-24295 per the contract-change
  rule. No new contract file is created.
- **§17 (gameplay fidelity):** PASS — faithful to printed text; index→name binding
  flagged as load-bearing with an operator-confirmation step (Verification §1);
  Whirlwind deferral documented (not dropped).
- **§20 (API catalog):** N/A — no HTTP endpoint or `apps/server` library surface.
- **§21 (schema field names):** N/A — no request/response schema; card field names
  unchanged.
- **§12-16, §18-19, §23-… :** PASS/N/A — no monetization, identity, multiplayer-sync,
  RNG, or PvP-terminology surface; standard two-session lane.

No unmet items.
