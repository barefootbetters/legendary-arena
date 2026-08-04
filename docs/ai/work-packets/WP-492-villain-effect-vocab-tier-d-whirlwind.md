# WP-492 — Core Villain-Effect Vocabulary, Tier D (Whirlwind — Interactive Location-Gated KO)

## Goal

Implement the first **interactive** Core villain Fight ability from the
villain-effect-vocabulary arc: **Whirlwind** ("*Fight: If you fight Whirlwind on
the Rooftops or Bridge, KO two of your Heroes.*"). It is currently hollow (D-24266
`unmarked-ability`). The player, after fighting Whirlwind on a gated space,
**chooses which two of their own Heroes to KO** (or fewer, if they hold fewer) —
exactly the interactive KO-a-Hero pipeline (WP-242) already used for the
single-hero `koHeroCurrentPlayer`, generalized to KO **two**. On any other space
the effect logs a clear "no effect — wrong space" line (the WP-489 gate). This
establishes the **magnitude-N interactive current-player KO** the rest of Tier D
(Viper, Melter, Paibok, HYDRA Kidnappers, Maestro, Ymir onFight) will reuse.

## Assumes

- **WP-489 / D-24295 (Tier B) ✅** — the universal `requireCitySpaces` location
  gate + the `@<space>` marker suffix + `CITY_SPACE_NAMES` (Rooftops = index 2,
  Bridge = index 4). This WP REUSES that gate unchanged — no gate-engine change.
  (Source: WORK_INDEX WP-489.)
- **WP-242 / D-24007 + D-24008 ✅** — the interactive KO-a-Hero pipeline: the
  `PendingKoHeroChoice` FIFO (`G.pendingKoHeroChoices`), the `resolveKoHeroChoice`
  move (front-only, recompute-eligibility-fresh, no snapshot), the block-all guards
  at every sibling fire site, and the exactly-1-auto / ≥2-park parker rule this WP
  generalizes to magnitude-N. (Source: WORK_INDEX WP-242.)
- **WP-243 / D-24010 ✅** — the `pendingKoHeroChoice` UIState projection
  (`eligible` + `remaining`) and the arena-client `PendingKoHeroChoicePrompt.vue`,
  which **already renders `remaining > 1`** and iterates `eligible` — so this WP
  needs **NO arena-client change**. (Source: WORK_INDEX WP-243.)
- **WP-252 / D-24023 ✅** — the parameterized `VillainEffectDescriptor` with the
  existing optional `magnitude?` field this WP reads for `ko-hero:current`; the
  `ko-hero:each:<N>` magnitude grammar this WP's `ko-hero:current:<N>` mirrors.
  (Source: WORK_INDEX WP-252.)
- **D-24266 ✅** — the `unmarked-ability` breadcrumb Whirlwind emits today.
  **D-24034 ✅** — append-only union/array/field discipline (the additive
  `PendingKoHeroChoice.remaining?` field).
- **Engine facts on `main` @ baseline `abc90f00`** (grounded 2026-08-03):
  - Whirlwind is `core/masters-of-evil/whirlwind`, one Fight line, **unmarked**
    (`data/cards/core.json`); it is the sole `masters-of-evil` `_unassigned` entry
    tagged `conditional` in `villain-effect-markers.json`.
  - `villainEffectKoHero` (`villain/villainEffects.execute.ts`) `target: 'current'`
    today: 0 eligible → no-op; exactly 1 distinct-eligible option → auto-KO; ≥2 →
    push **one** `PendingKoHeroChoice`. It reads no magnitude.
  - `PendingKoHeroChoice` (`types.ts`) = `{ choiceType: 'ko-hero'; playerID }` — no
    magnitude field. The UIState projects `pendingKoHeroChoice.remaining =
    queue.length` (`ui/uiState.build.ts`; pinned by the WP-243 two-entry test).
  - `resolveKoHeroChoice` (`moves/koHeroChoice.resolve.ts`) KOs the front pick and
    `shift()`s; it never auto-resolves a later entry.

## Context

**Why now.** Same live Doctor-Octopus/Magneto hollow scan that surfaced Tiers A
and B flagged Whirlwind's `unmarked-ability`. Tier B (WP-489) took the two
**auto-resolve** city-gated cards (Abomination, the Lizard) and **explicitly
deferred Whirlwind to Tier D** because its "KO two of *your* Heroes" is inherently
**interactive** (the current player chooses which Heroes). Tier D is the arc's
first interactive tier; Whirlwind is its first card and the one that builds the
reusable **magnitude-N interactive current-player KO**.

**Reuse, not reinvention.** Whirlwind sits at the intersection of two shipped
mechanisms: WP-489's location gate and WP-242's interactive KO queue. The only
genuinely new engine capability is teaching the current-player KO to KO **more
than one** hero interactively. The client already renders a multi-KO obligation
(`remaining`), so this is a **single-layer** WP (Game Engine + card-data markers) —
the same layer shape as Tiers A and B, not a new interactive vertical.

**One WP, single layer, no new pending type.** The magnitude generalization is
carried by an **additive optional field** on the existing `PendingKoHeroChoice`
(`remaining?: number`), not a new choice type; the descriptor reuses the existing
`magnitude?`; the gate is unchanged. One D-entry (D-24298). Not split.

**No *new* `G` field; hash re-pin only if a fixture's deck includes Whirlwind.**
No new top-level `G` field is added — `remaining?` decorates entries pushed into
the already-hashed `G.pendingKoHeroChoices` at runtime. As in Tier B, the marker
descriptors attach to the two Whirlwind copies' entries in the hashed
`G.villainAbilityHooks`, so `finalStateHash` / `PRE_WP080` shift only for a
committed fixture whose **villain deck includes `core/masters-of-evil`** — the
fight need not occur. **Verify at execution: no committed engine fixture is
expected to use `core/masters-of-evil`** (the WP-158 sentinel uses
`core/brotherhood`; the PRE_WP080 replay uses `test/*` groups). Note that
`masters-of-evil` also appears in `scoring/parScoring.keys.ts` (+ its tests) and
`simulation/par.storage.test.ts` — those are **par-scoring key string literals**,
NOT replay-hash fixtures, so they do not construct a hashed final state and do not
trigger a re-pin; eyeball them when running the grep to confirm. Re-pin (dual:
`record-game-fixture.mjs` sentinel + `PRE_WP080_HASH`) only if a committed fixture's
villain deck genuinely includes Whirlwind's group.

## Scope (In)

- **`packages/game-engine/src/types.ts`** — extend `PendingKoHeroChoice` with an
  **additive optional** field `remaining?: number` (the count of KOs still owed by
  this entry; absent means 1, so every pre-existing entry is byte-identical). No
  other field changed; append-only per D-24034.
- **`packages/game-engine/src/setup/villainAbility.setup.ts`** — extend the
  `ko-hero` grammar in `parseParameterizedEffect`: `ko-hero:current:<N>` with **N ≥
  2** → `{ primitive: 'ko-hero', target: 'current', magnitude: N }`. The bare
  `ko-hero:current` is unchanged (implicit magnitude 1); `ko-hero:current:1` is
  **rejected** (use the bare form) so magnitude-1 always parses to the
  reverse-mappable legacy descriptor. Mirrors the existing `ko-hero:each:<N>` branch.
- **`packages/game-engine/src/villain/villainEffects.execute.ts`** — generalize
  `villainEffectKoHero`'s `target: 'current'` branch to a magnitude
  `M = descriptor.magnitude ?? 1`:
  - Compute the distinct-eligible options `O = buildKoEligibleTargets(zones).length`
    fresh, and the count still to KO `remaining = M` (bounded by the physical
    KO-able heroes as the loop drains).
  - **Auto-KO the forced heroes:** while `remaining > 0` and `O ≤ 1`, KO the single
    distinct option (deterministic, via the existing single-KO resolver), decrement
    `remaining`, recompute `O`. (`O === 0` → stop; nothing left to KO.)
  - **Park the free choice:** if `remaining > 0` and `O ≥ 2`, push **one**
    `PendingKoHeroChoice { choiceType, playerID, remaining }` and stop — **but OMIT
    `remaining` when `owed === 1`** (absent ≡ 1), so the M=1 parked entry stays the
    exact `{ choiceType, playerID }` object two existing `deepStrictEqual` shape tests
    pin (`villainEffects.execute.test.ts` park case + `koHeroChoice.resolve.test.ts`
    "remaining entry intact").
  - **M = 1 is byte-identical** to today: `O === 1` auto-KOs one; `O ≥ 2` parks one
    entry with `remaining` **omitted** (absent ≡ 1). The descriptor `{ ko-hero, current }`
    (no magnitude) still reverse-maps to `koHeroCurrentPlayer` and narrates via the
    existing keyword path — it MUST NOT self-narrate.
  - **M ≥ 2 is keyword-less** (`descriptorKey` includes magnitude, so
    `{ ko-hero, current, 2 }` has no `LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR` entry) →
    self-narrate via `pushLog`: the auto-KO'd count + names, and, on a park, a
    "must KO N of your Heroes — choose which" line (the resolve move names each pick).
- **`packages/game-engine/src/moves/koHeroChoice.resolve.ts`** — after the front
  pick is KO'd, **decrement the front entry's `remaining ?? 1`**; if it reaches 0,
  `shift()` (front-pop) as today; if it is still > 0, **auto-resolve any now-forced
  remainder** (while `remaining > 0` and the recomputed distinct options `O ≤ 1`,
  auto-KO the single option and decrement) and then either keep the decremented
  entry in place (if a real choice `O ≥ 2` remains) or `shift()` (if `remaining`
  hit 0). This adds an intra-engine import of **`buildKoEligibleTargets`** (already
  exported from `villain/villainEffects.execute.ts`) to recompute `O`; the
  forced-remainder KO is performed via this move's **existing `moveCardFromZone` +
  `koCard`** path over the eligible `KoHeroTarget` — NOT `koSingleTarget`, which is
  module-private to the executor. The block-all guards keep the board frozen across
  the multi-pick, exactly as for a multi-entry queue today.
- **`packages/game-engine/src/ui/uiState.build.ts`** — project
  `pendingKoHeroChoice.remaining` as the **total KOs owed** = the sum over the queue
  of `entry.remaining ?? 1` (was `queue.length`). A queue of single-KO entries is
  unchanged (each contributes 1, so the WP-243 two-entry test still reads 2); a
  Whirlwind park (one entry, `remaining: 2`) reads 2.
- **`scripts/convert-cards/inputs/villain-effect-markers.json`** — add
  `masters-of-evil/whirlwind.fight = ["ko-hero:current:2@rooftops+bridge"]`; remove
  the now-implemented Whirlwind `_unassigned` row.
- **`scripts/convert-cards/apply-effect-markers.mjs`** — extend
  `isValidParameterizedEffectToken`'s `ko-hero` grammar to accept
  `ko-hero:current:<N>` (N a positive integer ≥ 2), mirroring the engine parser.
- **`data/cards/core.json`** — regenerated by `apply-effect-markers.mjs` (Whirlwind's
  one Fight line gains its `[effect:…]` marker). Generated; `git diff` shows only
  the one Fight line.
- **`docs/ai/coverage/villain-mechanic-ledger.json` + `.csv`** — regenerated by
  `pnpm ledger:villains` (CI-gated): Whirlwind flips `(unmarked)` → an executable
  `ko-hero` Fight row.
- **Tests** — parser cases (`ko-hero:current:2`, reject `:1`, the `@space` gate);
  executor cases (M=1 byte-identical park/auto; M=2 auto-KO both when exactly 2
  eligible; M=2 park + choose when > 2 eligible; M=2 KO 1 when only 1 eligible; gate
  deny off Rooftops/Bridge; self-narration); a `resolveKoHeroChoice` multi-pick
  drain test (remaining decrement + forced-remainder auto-resolve + front-pop); a
  `uiState.build` `remaining = Σ` test; a `diagnostics/hollowEffect.test.ts` check
  that Whirlwind no longer emits `unmarked-ability`.

## Out of Scope

- **The other Tier-D interactive cards** (Viper, Melter, Paibok, HYDRA Kidnappers,
  Maestro, Ymir onFight) — later Tier-D WPs; they reuse this WP's magnitude-N KO +
  the WP-489 gate but each carries its own predicate (Victory-Pile filters, choose-a-
  player, etc.). Not marked here.
- **Tiers C / E** — recursive villain-deck play (Endless Armies, the Leader) and the
  Doctor Octopus cleanup-draw override. No recursion into `performVillainReveal`, no
  new choice type, no cleanup override.
- **No new `PendingKoHeroChoice` sub-type, no new `VillainEffectPrimitive`, no
  arena-client change, no `ci.yml` change.** No change to the each-player `ko-hero`
  branch, the scry-KO / optional-KO-reward pipelines, or the fight/advance/escape
  movement logic. `ko-hero:current:1` is rejected, not silently normalized.

## Files Expected to Change

Engine: `types.ts` (+ `rules/villainAbility.types.test.ts` is N/A — see below),
`setup/villainAbility.setup.ts` (+`.test.ts`), `villain/villainEffects.execute.ts`
(+`.test.ts`), `moves/koHeroChoice.resolve.ts` (+`.test.ts`),
`ui/uiState.build.ts` (+`.test.ts`), `diagnostics/hollowEffect.test.ts`.
Card data / tooling: `scripts/convert-cards/inputs/villain-effect-markers.json`,
`scripts/convert-cards/apply-effect-markers.mjs`, `data/cards/core.json` (generated).
Coverage (generated/CI-gated): `docs/ai/coverage/villain-mechanic-ledger.json`,
`docs/ai/coverage/villain-mechanic-ledger.csv`.
Governance: `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
`docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
`docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md`.

> **Provenance note (no change).** The villain ledger keys `mechanic` by primitive.
> Whirlwind's row is `ko-hero`, which already carries WP-252/D-24023 provenance in
> `scripts/coverage/mechanic-provenance.json` — that correctly populates the new
> row. `mechanic-provenance.json` is therefore **deliberately unchanged** (keying
> WP-492 to `ko-hero` would mis-attribute every other card using it — the same
> reasoning applied in WP-489 Tier B).

## Contract

- **`PendingKoHeroChoice`** gains an additive optional `remaining?: number` (KOs
  still owed by the entry; absent ≡ 1). No field removed/re-typed; append-only per
  D-24034. The reverse-map / `descriptorKey` are untouched (this is a pending-choice
  field, not a descriptor field).
- **Marker grammar:** `ko-hero:current:<N>` (N ≥ 2) →
  `{ primitive: 'ko-hero', target: 'current', magnitude: N }`. The bare
  `ko-hero:current` and `ko-hero:current:1` disposition: bare parses to
  magnitude-less (legacy `koHeroCurrentPlayer`); `:1` is rejected.
- **Magnitude-M current-player KO semantics:** KO `min(M, physical KO-able heroes)`
  of the current player's Heroes; interactive (parked `PendingKoHeroChoice`) only when
  a genuine choice of *which* hero to spare exists — the player has MORE KO-able heroes
  than owed AND ≥ 2 distinct options (`P > owed && O ≥ 2`); auto-resolved (deterministic
  single-KO resolver) for every forced step (`P ≤ owed` or `O ≤ 1`); M = 1 is
  byte-identical to WP-242. (Rule landed in the `P`-vs-owed form so exactly-2-distinct
  auto-KOs both per AC-3 — see D-24298.)
- **Location gate:** reuse the WP-489 `requireCitySpaces` gate — checked before
  handler dispatch, fails closed on `undefined` cityIndex. Whirlwind:
  `requireCitySpaces = ['rooftops', 'bridge']`.
- **UIState:** `pendingKoHeroChoice.remaining` = Σ `entry.remaining ?? 1` over the
  queue (total KOs owed).
- **Card marker:** Whirlwind `ko-hero:current:2@rooftops+bridge` (Fight).

## Acceptance Criteria

1. Fighting **Whirlwind** on the Rooftops (index 2) or the Bridge (index 4) causes
   the current player to KO exactly `min(2, their KO-able hero count)` Heroes; on any
   other space it logs "no effect" (the WP-489 gate) and KOs none.
2. With **> 2** distinct-eligible Heroes, the current player is prompted to choose
   which two to KO (a parked `PendingKoHeroChoice` with `remaining` 2, then 1); the
   board is frozen (block-all guards) until both are resolved.
3. With **exactly 2** eligible Heroes, both are auto-KO'd (no choice); with **1**,
   that one is auto-KO'd; with **0**, it is a reachable no-op (no park, no hollow).
4. **M = 1 is byte-identical** to WP-242: the bare `ko-hero:current` /
   `koHeroCurrentPlayer` path is unchanged (auto-1 / park-one; reverse-maps to the
   keyword; the interactive resolve/prompt/bot behavior is unchanged).
5. `PendingKoHeroChoice.remaining` is additive-optional (absent ≡ 1); a queue of
   single-KO entries projects `remaining = queue length` unchanged (WP-243 test
   passes); a Whirlwind park projects `remaining = 2`.
6. Whirlwind no longer emits `unmarked-ability` (`hollowEffect.test.ts`); `git diff
   data/cards/core.json` shows only its one Fight line.
7. `pnpm -r build && pnpm ledger:villains` then `pnpm ledger:villains:check` exit 0;
   Whirlwind flips `(unmarked)` → `ko-hero` executable with WP-252/D-24023 provenance
   (unchanged provenance map).
8. `ko-hero:current:1` is rejected to `unresolvedMarkers`; an unknown gate space is
   rejected (WP-489 behavior, unchanged).
9. game-engine test + `pnpm -r build` + `pnpm -r --no-bail test` exit 0.
   `finalStateHash` / `PRE_WP080` unchanged — re-pin ONLY if a committed fixture's
   villain deck includes `core/masters-of-evil` (verified none today), because the
   markers land in the hashed `villainAbilityHooks`.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — new parser/executor/resolve/
   projection/hollow tests pass; the WP-242/WP-243 suites stay green (M=1 identity).
2. `node scripts/convert-cards/apply-effect-markers.mjs`; `git diff --stat
   data/cards/core.json` = the one Whirlwind Fight line only.
3. `pnpm -r build && pnpm ledger:villains && pnpm ledger:villains:check` exit 0.
4. `pnpm -r build && pnpm -r --no-bail test` exit 0; confirm no sentinel/PRE_WP080
   re-pin (no committed fixture deck includes `core/masters-of-evil`).
5. **D-24026 live-verify (operator-pending, post-deploy):** in a live match on
   `play.legendary-arena.com`, fight Whirlwind on the Rooftops or Bridge with > 2
   Heroes and confirm the KO-a-Hero prompt appears twice (`2 remaining` → `1
   remaining`); fight it on another space and confirm the "no effect" log.

## Definition of Done

- All Acceptance Criteria met; EC-527 After-Completing satisfied.
- **D-24298 Active**; WORK_INDEX `[x]`; EC_INDEX EC-527 Done; MINDMAP `📝`→`✅` +
  `roadmap:counts:write`; STATUS updated.
- Two-commit topology (`EC-527:` implementation + `SPEC:` governance close).
- No file outside the allowlist (+ governance). `lagn-v1.json` EOL churn reverted.
- `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify recorded as
  operator-pending.

## Lint Gate Self-Review

Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` (21 sections):

- **§1-9 (structure, goal, scope, files, contract, AC, verification, DoD, assumes):**
  PASS — all present; scope is a closed enumeration; files allowlist mirrors §Scope;
  AC testable.
- **§10 (layer boundary):** PASS — single layer (Game Engine + card-data markers); no
  crossing. The arena-client prompt is unchanged (it already renders `remaining`), so
  no App-layer edit. Card-data tooling is upstream of Registry (the Tier A/B shape).
- **§10a / §22 (determinism / persistence):** PASS — no *new* `G` field; the additive
  `PendingKoHeroChoice.remaining?` decorates the already-hashed
  `G.pendingKoHeroChoices`, and the markers attach to the hashed
  `villainAbilityHooks`, so the hash shifts only for a committed fixture whose deck
  includes `core/masters-of-evil` — none today (verified); re-pin trigger in AC-9.
- **§11 (contract-file lock):** PASS — `PendingKoHeroChoice` (in `types.ts`) is
  MODIFIED additively only (a new optional field; append-only per D-24034); recorded
  in D-24298. No new contract file created.
- **§17 (gameplay fidelity):** PASS — faithful to printed text (KO two of *your*
  Heroes, interactive; location-gated Rooftops/Bridge); the auto-when-forced /
  park-when-choice rule preserves player agency without a no-decision freeze;
  M=1 byte-identity pinned.
- **§20 (API catalog):** N/A — no HTTP endpoint or `apps/server` library surface (a
  new bgio move is not added; `resolveKoHeroChoice` already exists).
- **§21 (schema field names):** N/A — no request/response schema; card field names
  unchanged.
- **§12-16, §18-19, §23-… :** PASS/N/A — no monetization, identity, multiplayer-sync,
  RNG (the KO is deterministic; no `ctx.random`), or PvP-terminology surface;
  standard two-session lane.

No unmet items.
