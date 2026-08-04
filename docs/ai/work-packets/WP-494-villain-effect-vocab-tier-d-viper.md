# WP-494 — Core Villain-Effect Vocabulary, Tier D (Viper — Conditional Victory-Pile-Gated Each-Player Wound)

## Goal

Implement the Core villain **Viper** (`core/hydra/viper`), currently hollow
(D-24266 `unmarked-ability`): "*Fight: Each player without another HYDRA Villain in
their Victory Pile gains a Wound.*" + "*Escape: Same effect.*" This is a
**conditional each-player wound** — each player gains a Wound **unless** their
Victory Pile already holds another HYDRA Villain. It is **auto-resolve, not
interactive** (no player choice), fires at **both** the Fight and Escape sites, and
self-narrates. It establishes the arc's first **victory-pile villain-group
predicate**, reusable by other "each player without X in their Victory Pile" cards
(Chitauri Leviathan, Hela-2099).

## Assumes

- **WP-469 / D-24281 (`reveal-or-wound`) ✅** — the conditional each-player wound
  precedent this WP's handler mirrors: sorted `Object.keys(G.playerZones).sort()`
  iteration, per-player predicate → skip-or-wound, supply-bounded, `woundsDrawn`
  bumped for the current player only, keyword-less `pushLog` self-narration.
  (Source: WORK_INDEX WP-469.)
- **WP-202 / D-20203 ✅** — the each-player iteration pattern. **WP-252 / D-24023 ✅**
  — the parameterized `VillainEffectPrimitive` + `VillainEffectDescriptor` +
  `VILLAIN_EFFECT_HANDLERS` dispatch this WP extends with one new primitive.
- **WP-489 / D-24295 (Tier B) ✅** — the keyword-less self-narrating villain-effect
  pattern, the `apply-effect-markers.mjs` vocabulary sync, and the confirmation that
  the **Escape fire site already runs `executeVillainAbilities`** for escaping
  villains (`villainDeck.reveal.ts` onEscape, where the Abomination/Lizard city gate
  is checked). (Source: WORK_INDEX WP-489.)
- **D-24266 ✅** — the `unmarked-ability` breadcrumb Viper emits today.
  **D-24034 ✅** — append-only union/array/field/drift discipline (the new primitive
  + the additive descriptor field).
- **Engine facts on `main` @ baseline `fa61c598`** (grounded 2026-08-03):
  - Viper is `core/hydra/viper`, **unmarked**, with two ability lines — one
    `Fight:` and one `Escape: Same effect.` (`data/cards/core.json`). The core
    `hydra` group has four villains (Endless Armies of HYDRA, HYDRA Kidnappers,
    Supreme HYDRA, Viper), so "another HYDRA Villain in your Victory Pile" is
    satisfiable.
  - **No villain group/team map exists in `G`** — `G.villainDeckCardTypes` maps ext_id
    → `villain | henchman` only; `G.cardTraits` is built from hero entries only. The
    villain instance ext_id is `{setAbbr}-villain-{groupSlug}-{cardSlug}-NN`; both
    slugs may contain hyphens, so the group is **not** splittable from the ext_id —
    but the `-villain-` infix is unambiguous, so `setAbbr` = everything before it.
  - **A new setup-time `G` map would force a BROAD re-pin.** Setup-seeded fields are
    included in **both** hash oracles (`replay/replay.hash.ts` `computeStateHash`
    excludes only `diagnostics`; `test/fixtures/hashGameState.ts` `hashGameState`
    excludes only `messages`/`logMeta`/`lastPlayEffectsFired`/`diagnostics`). There is
    **no hash-excluded home for setup data**, so a new `G.villainGroups` map would
    shift `finalStateHash` **and** `PRE_WP080` for *every* committed fixture. This WP
    therefore adds **no new `G` field** (see Path B in §Context).
  - On Fight, the defeated Viper is pushed to the **current player's Victory Pile
    before** onFight effects run (`fightVillain.ts` `defeatCityVillainCore`), so the
    handler must exclude the fought `cardId` when scanning ("*another*"). On Escape,
    Viper goes to `escapedPile` (the exclusion is inert there).

## Context

**Why now.** Same hollow-scan that surfaced Tiers A–D flagged Viper's
`unmarked-ability`. The WP-485 tier map filed Viper under "Tier D interactive," but
grounding refined that: Viper's text is a **conditional each-player wound** (a
Victory-Pile predicate), **not** interactive — there is no player choice. It reuses
the WP-469 conditional-each-player skeleton, not the interactive KO pipeline. It is
Tier D because it needs a new **predicate class**: a per-player Victory-Pile
villain-group membership test.

**Path B — no new `G` field, no broad re-pin.** The one hard problem is knowing that
a Victory-Pile card is "a HYDRA Villain." The clean-looking option — a setup-time
`G.villainGroups` map — is a trap: it is a new **hashed** setup field with no
exclusion bucket, so it re-pins **every** committed `finalStateHash`/`PRE_WP080`
fixture. Instead this WP **derives** the group's ext_id prefix from state already in
the game: the fought/escaped Viper's own ext_id gives `setAbbr` (split on the
unambiguous `-villain-` infix), and the marker gives the target `groupSlug`; the
handler matches Victory-Pile villains by `startsWith(\`${setAbbr}-villain-${groupSlug}-\`)`.
This reads only already-hashed state (`G.playerZones[p].victory`, the fought
`cardId`), adds **no new `G` field**, and re-pins **nothing broad** — only the narrow
Tier-B-class trigger (a committed fixture whose villain deck *includes* `core/hydra`,
none today). The anchored **full** prefix `${setAbbr}-villain-${groupSlug}-` (e.g.
`core-villain-hydra-`) is what makes the match exact: only villain instances carry
`{setAbbr}-villain-{groupSlug}-`; henchmen use the disjoint `henchman-…` namespace,
and scheme-twists / mastermind-strikes / heroes never carry `-villain-`. Villain-deck
bystanders **do** carry the substring `-villain-` (`bystander-villain-deck-NN`) and can
sit in a Victory Pile, but they start `bystander-` and never `startsWith` the anchored
`${setAbbr}-villain-${groupSlug}-` prefix — so the full-prefix test excludes them. (A
bare `.includes('-villain-')` test would be **wrong** for exactly this reason; the
match MUST anchor on the full prefix.) Group slugs are unique with no `hydra`-prefixed
sibling, so the prefix is exact.

**One WP, single layer.** Game Engine + card-data markers (the Tier A/B shape). One
new primitive, one additive descriptor field, one D-entry (D-24299). Not split.

**Provenance DOES get one new entry** (unlike Whirlwind Tier B). The new primitive
`gain-wound-unless-victory-villain-group` has no prior provenance, so the villain
ledger would show Viper's row blank; this WP adds its
`{ wp: 'WP-494', decision: 'D-24299' }` entry (the WP-485 Tier-A pattern for
net-new primitives).

## Scope (In)

- **`packages/game-engine/src/rules/villainAbility.types.ts`**:
  - Append `'gain-wound-unless-victory-villain-group'` to the
    `VillainEffectPrimitive` union **and** `VILLAIN_EFFECT_PRIMITIVES` array (position
    13; append-only per D-24034; the drift test asserts the count is 13).
  - Add an **additive optional** descriptor field `victoryVillainGroup?: string` (the
    target villain group slug, e.g. `hydra`). No field removed/re-typed. It is
    **not** part of `descriptorKey` (like `requireKind`/`zone`), so the descriptor
    stays keyword-less (no legacy reverse-map → self-narrates).
- **`packages/game-engine/src/setup/villainAbility.setup.ts`** —
  `parseParameterizedEffect` gains a branch: `gain-wound-unless-victory-villain-group:<groupSlug>`
  (exactly 2 tokens; the slug non-empty, normalized via `normalizeTraitSlug`) →
  `{ primitive: 'gain-wound-unless-victory-villain-group', victoryVillainGroup: <slug> }`.
  A missing/empty slug or extra tokens → null (→ `unresolvedMarkers`).
- **`packages/game-engine/src/villain/villainEffects.execute.ts`**:
  - New handler `villainEffectGainWoundUnlessVictoryVillainGroup`, added to
    `VILLAIN_EFFECT_HANDLERS`. Mirrors `villainEffectRevealOrWound`: for each
    `playerId` in `Object.keys(G.playerZones).sort()`, gain one Wound **unless** the
    player's Victory Pile holds a card `!== cardId` that
    `startsWith(\`${setAbbr}-villain-${group}-\`)` — where `group =
    descriptor.victoryVillainGroup` and `setAbbr` is `cardId.slice(0,
    cardId.indexOf('-villain-'))`. Supply-bounded; `woundsDrawn` bumped for the
    current player only; keyword-less → self-narrates one honest `applied`/`blocked`
    line (naming the wounded players). Defensive guards: absent `victoryVillainGroup`,
    or a `cardId` without the `-villain-` infix → no wound (`{ targets: [] }`).
- **`scripts/convert-cards/inputs/villain-effect-markers.json`** — under
  `villains.core.hydra`, add `"viper": { "fight":
  ["gain-wound-unless-victory-villain-group:hydra"], "escape":
  ["gain-wound-unless-victory-villain-group:hydra"] }`; remove the Viper
  `_unassigned` row.
- **`scripts/convert-cards/apply-effect-markers.mjs`** — add the new primitive to the
  local `VILLAIN_EFFECT_PRIMITIVES` copy and extend `isValidParameterizedEffectToken`
  with the `gain-wound-unless-victory-villain-group:<slug>` grammar (2 tokens,
  non-empty slug), mirroring the engine parser.
- **`data/cards/core.json`** — regenerated by `apply-effect-markers.mjs`: Viper's
  Fight **and** Escape lines gain their `[effect:…]` markers. Generated; `git diff`
  shows only the two Viper lines.
- **`docs/ai/coverage/villain-mechanic-ledger.json` + `.csv`** — regenerated by
  `pnpm ledger:villains`: Viper flips `(unmarked)` → its new executable rows.
- **`data/metadata/effect-implementation-index.json`** — regenerated by
  `pnpm effect-index` (a ripple of the villain-ledger change; CI-gated by
  `pnpm effect-index:check`, the WP-485 Tier-A precedent): the
  `core-villain-hydra-viper` row flips `(unmarked)` → the new primitive. The
  `co2e-villain-hydra-viper` twin stays `(unmarked)` — the marker is set-scoped
  to `villains.core.hydra`, so the co2e set's Viper is deliberately left hollow
  (consistent with §Out of Scope; a co2e marking is a separate WP).
- **`scripts/coverage/mechanic-provenance.json`** — add
  `"gain-wound-unless-victory-villain-group": { "wp": "WP-494", "decision":
  "D-24299" }` (the new primitive's attribution; keeps the WP-484 Effect-Index join
  populated).
- **`docs/ai/DECISIONS.md`** — land **D-24299**.
- **Tests** — handler cases in `villain/villainEffects.execute.test.ts` (a player
  WITH another HYDRA villain in victory → no wound; a player WITHOUT → wound; the
  fought Viper excluded by `cardId`; a masters-of-evil villain in victory does NOT
  count; supply-bound; `woundsDrawn` current-only; fires at both `onFight` and
  `onEscape`; self-narration); parser cases in `setup/villainAbility.setup.test.ts`
  (the grammar + empty-slug rejection); drift in `rules/villainAbility.types.test.ts`
  (count 13 + the new descriptor field round-trips keyword-less); a
  `diagnostics/hollowEffect.test.ts` check that Viper (both timings) no longer emits
  `unmarked-ability`.

## Out of Scope

- **A `G.villainGroups` setup map / any new `G` field** — Path B derives the prefix
  from the fought ext_id; a new hashed setup field would force a broad re-pin.
- **Cross-set HYDRA generality** — the prefix is derived from the fought Viper's own
  set, so "HYDRA Villain" means a same-set `hydra`-group villain. In a Core game
  that is exactly `core/hydra`. Mixed-set decks with a second set's `hydra` group are
  out of scope (no such Core scenario).
- **The other core `hydra` cards** (Endless Armies of HYDRA — recursive Tier C;
  HYDRA Kidnappers — optional "you may"; Supreme HYDRA — a passive VP-scaling, not a
  Fight/Ambush/Escape effect). Not marked here.
- **The sibling victory-pile-predicate cards** (Chitauri Leviathan "no Bystanders in
  their Victory Pile", Hela-2099) — later WPs may reuse this primitive or add
  bystander/other predicates; not marked here.
- No new interactive machinery, no recursion into `performVillainReveal`, no
  `pending*Choices`, no `ci.yml` change, no change to the existing `gain-wound` /
  `reveal-or-wound` branches.

## Files Expected to Change

Engine: `rules/villainAbility.types.ts` (+`.test.ts`), `setup/villainAbility.setup.ts`
(+`.test.ts`), `villain/villainEffects.execute.ts` (+`.test.ts`),
`diagnostics/hollowEffect.test.ts`.
Card data / tooling: `scripts/convert-cards/inputs/villain-effect-markers.json`,
`scripts/convert-cards/apply-effect-markers.mjs`, `data/cards/core.json` (generated).
Coverage (generated/CI-gated): `docs/ai/coverage/villain-mechanic-ledger.json`,
`docs/ai/coverage/villain-mechanic-ledger.csv`,
`data/metadata/effect-implementation-index.json`,
`scripts/coverage/mechanic-provenance.json`.
Governance: `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
`docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
`docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md`.

## Contract

- **New primitive** `gain-wound-unless-victory-villain-group` appended to the
  `VillainEffectPrimitive` union + `VILLAIN_EFFECT_PRIMITIVES` array (count 12 → 13;
  append-only per D-24034). Keyword-less (no `LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR`
  entry) → self-narrates.
- **Additive descriptor field** `victoryVillainGroup?: string` (the target villain
  group slug). Not in `descriptorKey`.
- **Marker grammar** `gain-wound-unless-victory-villain-group:<groupSlug>` →
  `{ primitive: …, victoryVillainGroup: <normalized slug> }`.
- **Group identification (Path B):** `setAbbr = cardId.slice(0,
  cardId.indexOf('-villain-'))`; a Victory-Pile card is a group-`G` villain iff it
  `!== cardId` **and** `startsWith(\`${setAbbr}-villain-${group}-\`)`.
- **Card markers:** Viper `fight` **and** `escape` =
  `gain-wound-unless-victory-villain-group:hydra`.
- **Provenance:** `gain-wound-unless-victory-villain-group` → `{ WP-494, D-24299 }`.

## Acceptance Criteria

1. On **Fight**, each player whose Victory Pile holds NO other `core/hydra` villain
   gains exactly one Wound (supply-bounded); a player who holds another HYDRA villain
   (e.g. a defeated HYDRA Kidnappers) gains none. The just-defeated Viper in the
   current player's Victory Pile is excluded (does not count as "another").
2. A non-HYDRA villain in a Victory Pile (e.g. a `masters-of-evil` villain) does NOT
   satisfy the predicate — that player still gains a Wound.
3. The effect fires identically at the **Escape** fire site (Viper escaping), wounding
   each player without another HYDRA villain in their Victory Pile.
4. `woundsDrawn` is bumped for the current player only; the effect self-narrates one
   honest `applied`/`blocked` line; no `VillainEffectResult` keyword is recorded
   (keyword-less).
5. Viper no longer emits `unmarked-ability` at either timing (`hollowEffect.test.ts`);
   `git diff data/cards/core.json` shows only Viper's two ability lines.
6. `VILLAIN_EFFECT_PRIMITIVES` count is 13 (drift test); the new descriptor field
   round-trips and reverse-maps to `undefined` (keyword-less).
7. `pnpm -r build && pnpm ledger:villains && pnpm effect-index` then `pnpm
   ledger:villains:check` + `pnpm effect-index:check` exit 0; the provenance map
   carries the new primitive's `WP-494 / D-24299`; the `core-villain-hydra-viper`
   effect-index row flips executable (co2e twin stays unmarked).
8. game-engine test + `pnpm -r build` + `pnpm -r --no-bail test` exit 0. **No new
   `G` field.** `finalStateHash` / `PRE_WP080` unchanged — re-pin ONLY if a committed
   fixture's villain deck *includes* `core/hydra` (the marker lands in the hashed
   `villainAbilityHooks`); none today (verify), so expect no re-pin.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — new handler/parser/drift/hollow
   tests pass.
2. `node scripts/convert-cards/apply-effect-markers.mjs`; `git diff --stat
   data/cards/core.json` = Viper's two lines only.
3. `pnpm -r build && pnpm ledger:villains && pnpm ledger:villains:check` exit 0;
   `pnpm effect-index && pnpm effect-index:check` exit 0 (`git diff` on
   `data/metadata/effect-implementation-index.json` = the `core-villain-hydra-viper`
   row only; the co2e twin unchanged).
4. `pnpm -r build && pnpm -r --no-bail test` exit 0; confirm no sentinel/PRE_WP080
   re-pin (no committed fixture deck includes `core/hydra`).
5. **D-24026 live-verify (operator-pending, post-deploy):** in a live match on
   `play.legendary-arena.com`, defeat Viper while one player holds another HYDRA
   villain (no wound) and another does not (a Wound), and confirm the Escape line
   fires the same effect.

## Definition of Done

- All Acceptance Criteria met; EC-529 After-Completing satisfied.
- **D-24299 Active**; WORK_INDEX `[x]`; EC_INDEX EC-529 Done; MINDMAP `📝`→`✅` +
  `roadmap:counts:write`; STATUS updated.
- Two-commit topology (`EC-529:` implementation + `SPEC:` governance close).
- No file outside the allowlist (+ governance). `lagn-v1.json` EOL churn reverted.
- `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify recorded as
  operator-pending.

## Lint Gate Self-Review

Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` (21 sections):

- **§1-9 (structure, goal, scope, files, contract, AC, verification, DoD, assumes):**
  PASS — all present; scope is a closed enumeration; files allowlist mirrors §Scope;
  AC testable.
- **§10 (layer boundary):** PASS — single layer (Game Engine + card-data markers); no
  crossing. No arena-client / server surface (auto-resolve, no pending choice, no
  UIState field).
- **§10a / §22 (determinism / persistence):** PASS — **no new `G` field** (Path B
  derives the group prefix from the fought ext_id + already-hashed Victory Piles); the
  marker attaches to the hashed `villainAbilityHooks`, so the hash shifts only for a
  committed fixture whose deck includes `core/hydra` — none today (verified); re-pin
  trigger in AC-8.
- **§11 (contract-file lock):** PASS — `villainAbility.types.ts` MODIFIED additively
  (one new primitive appended to the frozen-append union/array + one new optional
  descriptor field; append-only per D-24034); recorded in D-24299. No new contract
  file.
- **§17 (gameplay fidelity):** PASS — faithful to printed text (conditional each-player
  wound; the Victory-Pile "another HYDRA Villain" predicate with exclude-self; both
  Fight + Escape). The set-scoped "HYDRA" interpretation is documented as an explicit
  scope decision (§Out of Scope).
- **§20 (API catalog):** N/A — no HTTP endpoint or `apps/server` library surface.
- **§21 (schema field names):** N/A — no request/response schema; card field names
  unchanged.
- **§12-16, §18-19, §23-… :** PASS/N/A — no monetization, identity, multiplayer-sync,
  RNG (deterministic; no `ctx.random`), or PvP-terminology surface; standard
  two-session lane.

No unmet items.
