# WP-524 — Secret Invasion of the Skrull Shapeshifters: "6 Heroes" Setup Requirement — Enforcement Core (Registry + Engine + registry-viewer)

**Layer:** Registry (source of truth) + Game Engine (`Game.setup` gate) + App
(registry-viewer loadout builder) · **Lane:** Standard two-session (cross-layer contract
change to the per-player-count setup requirement + a setup-determinism surface) ·
**Baseline:** `origin/main` @ `c5cfa21b` (WP-524 reservation merged, #1323) ·
**User-Visible Surface:** cards.legendary-arena.com loadout builder (the play-lobby half
is WP-525) · **Epic:** WP-524 + WP-525 **ship as a set** (see §Assumes).

## Goal

Secret Invasion of the Skrull Shapeshifters
(`core/secret-invasion-of-the-skrull-shapeshifters`) prints *"Setup: 8 Twists. **6
Heroes.** Skrull Villain Group required. Shuffle 12 random Heroes from the Hero Deck into
the Villain Deck."* WP-514 / D-24326 shipped the 12-hero → Skrull conversion + combat +
loss, but its scoped "printed rules" quote **deliberately dropped the `6 Heroes` clause**
— so the setup pipeline still sizes the match by the standard per-player-count table
(`PLAYER_COUNT_SETUP.heroCount` = 5 at 2–4 players), and live matches run with **5** hero
groups instead of the **6** the card requires (confirmed from a 2-player Dr. Doom + Secret
Invasion co-op match: `heroDeckIds.length === 5`). This WP makes the hero-group
**requirement** scheme-aware in the **enforcement core**: the registry source of truth, the
authoritative `Game.setup` gate, and the registry-viewer loadout builder.

## User-Visible Impact

The registry-viewer (cards) loadout builder now shows **6** required Hero groups for a
Secret Invasion loadout and flags a 5-hero one as a mismatch; `Game.setup` accepts a
6-hero Secret Invasion config and rejects a 5-hero one for this scheme; a 6-hero Secret
Invasion match builds its Hero Deck from 6 groups. Every other scheme is unchanged (5 at
2–4p, 3 at 1p, 6 at 5p). **The arena-client play lobby is intentionally NOT touched here
— it is WP-525**, which must land in the same set (below).

## Context (Read First)

**This is a requirement INCREASE, the OPPOSITE class from the two shipped
`schemeSetupSizing` overrides.** Legacy Virus (D-24321, wound stack) and Super Hero Civil
War (WP-515 / D-24328, 4-hero deck at 2p) are **post-validation DOWNSIZE** overrides — the
loadout supplies and validates its *standard* count and the engine builds a *smaller*
pile; their ECs (EC-550 §Common Failure Smells) explicitly say **do not touch
`matchSetup.validate`.** WP-524 is the inverse: "6 Heroes" means the operator must
*actually supply 6 hero groups*, so the **requirement/validation layer itself must become
scheme-aware.** If only the built deck grew, the builder would still ask for 5 and the
engine's `validatePlayerCountComposition` would **reject a correct 6-hero loadout** at
`Game.setup`. So the override lives on the *requirement* side, NOT as a build-time
transform in `schemeSetupSizing.ts`. **Do not copy WP-515's "don't touch validate"
guardrail — this WP must touch it.**

**Single definition of the scheme→count override, reached structurally by the engine.**
`PLAYER_COUNT_SETUP` lives in `packages/registry/src/playerCountSetup.ts` (D-24165: pure
data + lookups, browser-safe SSOT; the engine reads it off the `CardRegistry` object via
structural typing, never a static import). A new pure `resolveEffectiveHeroCount(schemeId,
numPlayers, baseHeroCount)` lives beside it and is:

1. consumed by `checkPlayerCountComposition` (registry) — which registry-viewer's
   `useLoadoutDraft` calls;
2. exposed on the `CardRegistry` object (both impls) so the engine's
   `validatePlayerCountComposition` reaches the one definition through the
   `CardRegistryReader` structural interface — no second copy of the "6" in the engine.

**Locked design decisions (operator review points).**

- **FLAT 6 wherever the base is below 6.** `resolveEffectiveHeroCount` returns
  `Math.max(baseHeroCount, 6)` for this scheme: 2/3/4p 5 → 6; 5p already 6 (unchanged); 1p
  (solo bot-ally, a house mode) 3 → 6. The 1-player jump is the literal reading of the
  printed clause and is **flagged for operator review** — a smaller solo pool is a one-line
  change to the resolver if preferred. *Recommendation: flat 6.*
- **Scope: the hero-count requirement only.** The co-located *"Skrull Villain Group
  required"* clause is a villain-group *membership* constraint (`core/skrulls` must be one
  of the groups). It was **already satisfied** in the reported match, so it is **not the
  active defect** — Out of Scope for a focused follow-up, not bloating this WP.

**Determinism.** The effective hero count changes the hero-deck build **for Secret Invasion
only** (a different `config.heroDeckIds` length feeds `buildHeroDeck`, then
`convertHeroesToSkrulls`). Every other scheme/count calls `buildHeroDeck` with an unchanged
id list → **byte-identical**. **No committed fixture materializes Secret Invasion**
(D-24327 grep-verified: no fixture / `*.replay.json` references `skrull` /
`secret-invasion`; the sentinel replay is Legacy Virus; `PRE_WP080_HASH` uses a synthetic
scheme), so sentinel `finalStateHash` + `PRE_WP080_HASH` are **expected byte-identical —
verify, STOP on any shift.**

## Design Rationale

**Requirement-side single source, not a second copy in the engine.** The engine already
hardcodes scheme ids in `setup/schemeSetupSizing.ts`, but that file owns *build-time
downsizing*; putting "Secret Invasion → 6" there too would split the "6" across registry
(for the builder checker) and engine (for validate), inviting drift. Keeping the resolver
in `playerCountSetup.ts` — the SSOT the engine already reads structurally — means one
definition all enforcement layers reach. This is the D-24165 pattern applied to a
scheme-conditioned count.

## Assumes

- **WP-525 / D-24338 (reserved, paired — SHIP AS A SET).** WP-524 makes the engine +
  registry-viewer require 6; the arena-client **play lobby** is scheme-blind (compares
  against a flat `GET /api/match/setup-requirements` projection and **disables Create** on
  a mismatch). **WP-524 shipped alone would make Secret Invasion un-creatable via
  play.legendary-arena.com** (a correct 6-hero loadout is blocked by the play lobby; a
  5-hero one is rejected by the engine). WP-525 makes the server projection + play lobby +
  autoplay default-sizing scheme-aware. **Neither WP is deployed to production alone** —
  they merge as a set (or WP-525 lands first-or-together). This constraint is the whole
  reason for the split; it mirrors the WP-370/371/372 layer-split.
- **WP-514 / D-24326 (✅ merged).** The 12-hero → Skrull conversion
  (`setup/convertHeroesToSkrulls.ts`) + combat (D-24327) + loss already ship; this WP sizes
  the hero-group requirement the conversion draws from. It touches neither conversion nor
  combat. (Note the completion of WP-514's scoped-out "6 Heroes" clause when D-24337 lands.)
- **WP-370 / D-24165 (✅ merged).** `PLAYER_COUNT_SETUP` is the SSOT;
  `checkPlayerCountComposition` is its checker; the engine reads the table off the
  `CardRegistryReader` structurally. The new resolver is a sibling reached the same way.
- **The registry object is built in two impls** — `impl/localRegistry.ts:196` and
  `impl/httpRegistry.ts:175`, both `playerCountSetup: PLAYER_COUNT_SETUP`. Both must also
  expose `resolveEffectiveHeroCount` so every registry the engine receives carries it.
- **`config.schemeId` is available at both enforcement sites** — the engine's
  `validateMatchSetup` already holds `input.schemeId` (read at `matchSetup.validate.ts:572`)
  but does not forward it to `validatePlayerCountComposition`; registry-viewer's
  `useLoadoutDraft` holds `draft.composition.schemeId` but does not pass it into
  `checkPlayerCountComposition` (call at `:455`).
- **The 9-field `MatchSetupConfig` composition lock is preserved** — `heroDeckIds` stays
  the same field; only its *required length* becomes scheme-aware (`.claude/rules/
  code-style.md §Data Contracts`).

## Scope (In)

- `packages/registry/src/playerCountSetup.ts`: add pure
  `resolveEffectiveHeroCount(schemeId, numPlayers, baseHeroCount)` (returns
  `Math.max(base, 6)` for the Secret Invasion scheme id, else `base`); add an optional
  `schemeId` to `PlayerCountCompositionInput` and apply the resolver in the `heroDeckIds`
  length check inside `checkPlayerCountComposition` (a missing `schemeId` → base behaviour,
  so existing callers are unchanged).
- `packages/registry/src/types/index.ts`: add `resolveEffectiveHeroCount` to the
  `CardRegistry` interface (beside `playerCountSetup` at `:225`).
- `packages/registry/src/impl/localRegistry.ts` + `impl/httpRegistry.ts`: expose
  `resolveEffectiveHeroCount` on the constructed registry object.
- `packages/game-engine/src/matchSetup.validate.ts`: add the optional
  `resolveEffectiveHeroCount?` to the engine-local `CardRegistryReader` (`:47-64`); forward
  `input.schemeId` into `validatePlayerCountComposition` and apply the effective hero count
  in the `heroDeckIds` check (`registry.resolveEffectiveHeroCount?.(schemeId, numPlayers,
  row.heroCount) ?? row.heroCount`).
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts`: pass the draft's `schemeId`
  into `checkPlayerCountComposition` (`:455`) and reflect the effective hero count in the
  `requiredPlayerCountSetup` display computed (`:451`) so the builder shows/gates 6 for
  Secret Invasion. The base row is a `Readonly<PlayerCountSetupRow>` — construct a **new**
  row (spread with the resolved `heroCount`), never mutate the immutable table row (RS-2).
- Tests: registry (`playerCountSetup.test.ts` — resolver table + scheme-aware checker),
  engine (`matchSetup.validate.test.ts` — 6-hero SI passes, 5-hero fails, non-SI
  unchanged; mock reader exposes the resolver), registry-viewer
  (`useLoadoutDraft.test.ts` — SI @2p requires/ displays 6).

## Out of Scope

- **The arena-client play lobby + the server `/api/match/setup-requirements` projection +
  autoplay default-loadout sizing → WP-525 (paired, ships in the same set).**
- The *"Skrull Villain Group required"* villain-group membership constraint (a separate
  follow-up WP; already satisfied in the reported match).
- The 12-hero → Skrull conversion / combat / loss (WP-514, shipped).
- Any other scheme's setup counts; the base `PLAYER_COUNT_SETUP` values; the "What If…?"
  modified-setup variant (D-24165 defers it).

## Files Expected to Change

| File | Change |
|---|---|
| `packages/registry/src/playerCountSetup.ts` | add `resolveEffectiveHeroCount`; scheme-aware `checkPlayerCountComposition` |
| `packages/registry/src/playerCountSetup.test.ts` | resolver table + scheme-aware checker cases |
| `packages/registry/src/types/index.ts` | `resolveEffectiveHeroCount` on the `CardRegistry` interface |
| `packages/registry/src/impl/localRegistry.ts` | expose `resolveEffectiveHeroCount` on the object |
| `packages/registry/src/impl/httpRegistry.ts` | expose `resolveEffectiveHeroCount` on the object |
| `packages/game-engine/src/matchSetup.validate.ts` | reader method + forward `schemeId` + effective hero-count check |
| `packages/game-engine/src/matchSetup.validate.test.ts` | 6-hero SI passes; 5-hero fails; non-SI unchanged |
| `apps/registry-viewer/src/composables/useLoadoutDraft.ts` | thread `schemeId`; effective display count |
| `apps/registry-viewer/src/composables/useLoadoutDraft.test.ts` | SI @2p requires/displays 6 |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24337 Active at execution), `NUMBER-LEDGER.md` (reserved), `STATUS.md`.

## Non-Negotiable Constraints

- Gated to `core/secret-invasion-of-the-skrull-shapeshifters`; every other scheme returns
  the base heroCount unchanged.
- **One definition of the scheme→count override** (registry `playerCountSetup.ts`), reached
  by the registry-viewer checker AND the engine (via the reader) — no second copy in the
  engine.
- Engine + registry-viewer must agree: a 6-hero Secret Invasion loadout passes both; a
  5-hero one fails both for this scheme.
- No `.reduce()` in the resolver; no new `ctx.random` draw (the build's single shuffle is
  unchanged — only its input id-list length differs); no `boardgame.io` import in the pure
  registry helper; the engine reaches the resolver structurally (no registry import).
- `checkPlayerCountComposition`'s new `schemeId` is **optional** — omitting it preserves the
  base behaviour, so unrelated callers (and the server autoplay test) are unbroken.
- The 9-field `MatchSetupConfig` composition lock is preserved.
- Determinism: gated to Secret Invasion → every other scheme/count byte-identical; no
  committed Secret Invasion fixture → sentinel `finalStateHash` + `PRE_WP080_HASH`
  **byte-identical — STOP on any shift.**

**Engine-wide (standing) constraints.** Honor `.claude/rules/code-style.md` +
`docs/ai/REFERENCE/00.6-code-style.md`; ESM-only, `.test.ts` on `node:test`, Node v22+.
Work from full file contents.

## Contract

**`resolveEffectiveHeroCount(schemeId: string, numPlayers: number, baseHeroCount:
number): number`** — returns `Math.max(baseHeroCount, 6)` for
`core/secret-invasion-of-the-skrull-shapeshifters`; `baseHeroCount` unchanged otherwise.
Pure, deterministic, no I/O. Threaded into `checkPlayerCountComposition` via an optional
`schemeId` on `PlayerCountCompositionInput`, and exposed on `CardRegistry` +
the engine's `CardRegistryReader` (optional method) so the one definition is reached by all
enforcement sites. `numPlayers` is passed for symmetry with the base table and future
per-count schemes; the Secret Invasion branch is currently count-independent (flat 6).

## Acceptance Criteria

1. `resolveEffectiveHeroCount('core/secret-invasion-of-the-skrull-shapeshifters', n, base)`
   returns 6 for `(2,5)`, `(3,5)`, `(4,5)`, `(5,6)`, `(1,3)`; a non-Secret-Invasion scheme
   returns `base` unchanged; the base `PLAYER_COUNT_SETUP` table is not mutated.
2. `checkPlayerCountComposition` with `schemeId` = Secret Invasion @2p flags a **5-hero**
   loadout (`required: 6, actual: 5`) and passes a **6-hero** one; without a `schemeId` (or
   a different scheme) a 5-hero @2p loadout still passes.
3. `validatePlayerCountComposition` (engine, at `Game.setup`) **rejects** a 5-hero Secret
   Invasion config and **accepts** a 6-hero one; a 6-hero *non*-Secret-Invasion 2p config
   still fails (base 5). Engine and registry-viewer agree.
4. A 2-player Secret Invasion match with a 6-hero loadout builds a Hero Deck from **6**
   groups; `convertHeroesToSkrulls` still pulls its 12 from the larger reservoir; every
   other scheme builds its standard count.
5. registry-viewer: a Secret Invasion draft @2p shows **6** required heroes and marks a
   5-hero draft not-ready; a non-Secret-Invasion draft shows 5.
6. Determinism: engine suite + **whole-workspace** green; sentinel `finalStateHash` +
   `PRE_WP080_HASH` byte-identical; any shift STOPs — do not blind-re-pin.

## Verification Steps

1. `pnpm --filter @legendary-arena/registry build && pnpm --filter
   @legendary-arena/game-engine build && pnpm --filter @legendary-arena/registry-viewer
   build` → 0.
2. `pnpm --filter @legendary-arena/registry test && pnpm --filter
   @legendary-arena/game-engine test && pnpm --filter @legendary-arena/registry-viewer
   test` → green; record delta.
3. **Whole-workspace** `pnpm -r --no-bail test` → green.
4. Control-revert non-vacuous: return `baseHeroCount` from the resolver → the
   Secret-Invasion-requires-6 tests FAIL at registry + engine + registry-viewer; non-scheme
   tests stay green. Restore.
5. Sentinel + `PRE_WP080_HASH` byte-identical; `sim:runtime-observed:check` current;
   `pnpm -r build` → 0; `git diff --name-only` = allowlist + governance.
6. **D-24026 live-verify (operator-pending, WITH WP-525):** on cards.legendary-arena.com the
   builder requires 6 for Secret Invasion; on play.legendary-arena.com (via WP-525) the
   match creates with 6.

## Definition of Done

- [ ] All Acceptance Criteria met; registry + engine + registry-viewer + whole-workspace
      green.
- [ ] Engine + registry-viewer agree on 6 for Secret Invasion, base otherwise.
- [ ] Sentinel + PRE_WP080 byte-identical (or deliberate re-pin applied + documented).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] D-24337 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap `📝`→`✅`;
      `roadmap:counts:check` 0; STATUS close-out.
- [ ] Two-commit topology (EC-559 impl + SPEC close).
- [ ] Paired with WP-525 — **not production-deployed alone** (see §Assumes).
- [ ] D-24026 live-verify performed or explicitly operator-pending (with WP-525).

## Reserved Decisions (land at execution)

**D-24337** — Secret Invasion of the Skrull Shapeshifters requires a scheme-aware effective
hero-group count (its printed "6 Heroes"), not the standard `PLAYER_COUNT_SETUP.heroCount`.
A new pure `resolveEffectiveHeroCount(schemeId, numPlayers, baseHeroCount)`
(`packages/registry/src/playerCountSetup.ts`) returns `Math.max(base, 6)` for
`core/secret-invasion-of-the-skrull-shapeshifters`, else base. Unlike the two
`schemeSetupSizing` DOWNSIZE overrides (D-24321 wounds, D-24328 Civil War), which
post-validation size a built pile below the validated config, this is a requirement
INCREASE: the operator must supply 6 hero groups, so the override is applied on the
requirement side and threaded through the enforcement core — `checkPlayerCountComposition`
(registry; via an optional `schemeId`), exposed on `CardRegistry` (both impls) +
the engine's `CardRegistryReader` so `validatePlayerCountComposition` reaches the one
definition. FLAT 6 wherever base < 6 (2/3/4p 5→6; 5p 6; solo-1p 3→6 — literal clause; a
smaller solo pool is a one-line change). Scope is the enforcement core; the arena-client
play lobby + server projection + autoplay sizing are WP-525/D-24338 (paired, ship as a
set); the "Skrull Villain Group required" constraint is a separate follow-up. Determinism:
scheme-gated → other schemes byte-identical; no committed Secret Invasion fixture (D-24327)
→ sentinel/PRE_WP080 unchanged, verified suite-green at execution.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1–§2 Structure / Constraints** — PASS.
- **§3 Assumes** — PASS (WP-525 pairing/ship-as-a-set; WP-514 conversion shipped; WP-370
  SSOT + structural reader; two registry impls; `schemeId` in scope at both sites; 9-field
  lock preserved).
- **§4 Context** — PASS (requirement-INCREASE vs the two DOWNSIZE overrides; single-source
  registry resolver; flat-6 + solo review point; determinism/re-pin analysis).
- **§5 Files** — PASS (9-file allowlist, 3 layers but one contract).
- **§6 Naming** — PASS (`resolveEffectiveHeroCount`, `PlayerCountCompositionInput.schemeId`).
- **§7 Dependency** — PASS (WP-514 ✅, WP-370 ✅; paired WP-525 reserved).
- **§8 Architecture** — PASS (registry SSOT; engine reaches it structurally, no registry
  import; pure helper, no `.reduce()`, no new `ctx.random`; the engine must touch validate —
  a requirement increase, unlike the downsize class).
- **§9–§11** — N/A (no new endpoint here; no cross-repo; no schema-migration).
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-revert at all 3 layers).
- **§13 Commands** — PASS (whole-workspace test; byte-identical STOP rule).
- **§14 Acceptance Criteria** — PASS (6 testable ACs across resolver / checker / engine /
  build / registry-viewer / determinism).
- **§15 Definition of Done** — PASS (incl. ship-as-a-set-with-WP-525).
- **§16 Code Style** — PASS. **§17 Vision Alignment** — PASS (§3 faithful printed setup;
  determinism line; NG-1..7 not crossed).
- **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — PASS (baseline `c5cfa21b`).
- **§20 Funding Surface** — N/A. **§21 API Catalog** — N/A (no endpoint change here; the
  `/api/match/setup-requirements` shape change is WP-525).

Pre-flight verdict (independent subagent, all 7 load-bearing claims verified at source):
**READY TO EXECUTE**. No PS items. Three advisory RS folded above: RS-1 (the `?? row.heroCount`
fallback is a compile-guarded mock-only path — `resolveEffectiveHeroCount` is required on the
real `CardRegistry`, so a forgetting impl is a compile error, and a mock omission would REJECT
a correct loadout loudly, not silently accept a wrong one — EC-559 corrected); RS-2 (the
`requiredPlayerCountSetup` display must spread a NEW row, not mutate the immutable table row);
RS-3 (line-cite `:571`→`:572`). Confirmed no missed hero-count consumer and that the optional
`schemeId` leaves `autoplayDefault.test.ts` unbroken. Copilot verdict (independent subagent,
claims verified at source): **PASS — CONFIRM**. No BLOCK/RISK. Split coherence, determinism
scoping (both hash oracles use non-SI schemes → airtight), the `Math.max(base,6)` encoding
(never decreases; solo-1p review point surfaced), faithfulness, and the required-on-`CardRegistry`
/ optional-on-reader contract asymmetry all verified. NOTE-A folded into EC-559 (SI validate
tests must supply the resolver on their mock, else a 5-hero SI config false-greens).
