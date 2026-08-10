# WP-521 — co2e Baron Zemo (Villain) Ambush: Capture a Bystander + One per Avengers Hero in the HQ

**User-Visible Surface:** `play.legendary-arena.com` — revealing the **co2e**
(Legendary 2nd-edition) **Baron Zemo** villain (Masters of Evil) now captures a
Bystander plus one more for each Avengers Hero in the HQ, instead of doing
nothing. **D-24026 live-verification applies** (operator-pending, post-deploy).

## User-Visible Impact

co2e Baron Zemo's printed **Ambush** — *"Baron Zemo captures a Bystander. Then he
captures another Bystander for each [team:avengers] Hero in the HQ."* — is
currently unmarked, so revealing him reaches no executable handler: the ability
does nothing and the game log records a D-24266 `unmarked-ability` `no-handler`
breadcrumb. This is **epic 1/3** of the co2e Masters-of-Evil deferred-primitive
epic (D-24333): the three timing lines that need a **new** `VillainEffectPrimitive`,
one WP apiece. (WP-520 marks the three co2e MoE lines that reduced to existing
primitives; this WP adds the first new primitive.)

## Goal

Implement the co2e Masters-of-Evil villain **Baron Zemo**
(`co2e/masters-of-evil/baron-zemo`, copies 2) **Ambush** ability, currently hollow
(D-24266). His Ambush captures **1 Bystander + 1 per `[team:avengers]` Hero
currently in the HQ**, attaching them to Baron Zemo (the award is deferred to his
defeat, matching the existing `capture-bystander` Ambush semantics). This needs a
new auto-resolve `VillainEffectPrimitive` (`capture-bystanders-plus-per-hq-hero-by-trait`)
and — a first for the engine — a **count of HQ heroes by trait**. Game engine +
card data, one WP. Locks **D-24334**.

## Assumes

- Baseline: `origin/main` @ the WP-521 reserve or later. Working tree clean.
- **WP-252 / D-24023** — the `VillainEffectPrimitive` union +
  `VILLAIN_EFFECT_PRIMITIVES` array (`rules/villainAbility.types.ts`, currently 16
  entries), the `VillainEffectDescriptor` (its `requireKind` / `requireValue`
  predicate fields), and the marker pipeline.
- **WP-485 / D-24290** — the Tier-A auto-resolve fire path
  (`executeVillainAbilities` → `applyVillainEffect` → `VILLAIN_EFFECT_HANDLERS`);
  the shared per-card trait matcher `cardTraitMatches(G.cardTraits, cardId, kind,
  value)` (`villain/villainEffects.execute.ts:1344`); and the trait-scaled bystander
  handler `villainEffectRescueBystandersCurrentByTraitCount` (Baron Zemo's **core**
  Fight — the closest template, but it counts the current player's hand+in-play
  heroes and *rescues*; this WP counts **HQ** heroes and *captures*).
- **WP-469 / D-24281** — `parseTraitPredicateTokens(parts)` (the shared
  `:team:<v>` / `:hc:<v>` predicate parser used by `reveal-or-wound`); the new
  marker `capture-bystanders-plus-per-hq-hero-by-trait:team:avengers` reuses it,
  so the new parse arm mirrors the `reveal-or-wound` arm
  (`setup/villainAbility.setup.ts:487`).
- **WP-185 / D-18506** — the `capture-bystander` handler
  (`villainEffectCaptureBystander`, `villainEffects.execute.ts:1005`): at **Ambush**
  timing it **attaches only** via `attachBystanderToVillain`; the award happens
  later at the Fight/defeat fire site (`defeatCityVillainCore` Step 3b,
  `moves/fightVillain.ts:246`). This WP's handler follows the same attach-at-Ambush /
  award-on-defeat split — it must **not** award now.
- **Existing helpers reused:** `attachBystanderToVillain`
  (`board/bystanders.logic.ts:54` — takes `G.piles.bystanders`, the villain
  `cardId`, `G.attachedBystanders`; no-op clone on empty supply); `G.hq` is a
  fixed 5-tuple `[HqSlot×5]`, `HqSlot = CardExtId | null`
  (`board/city.types.ts:39,47`; `types.ts:1178`); `G.cardTraits[cardId]` =
  `{ team, heroClass }` normalized at setup (`state/cardTraits.types.ts:19`).
- **D-24034** — append-only union/array drift discipline (count 16 → 17).
- **co2e marker block:** WP-520 (the co2e MoE marking WP) creates the
  `villains → co2e → masters-of-evil` block in `inputs/villain-effect-markers.json`;
  this WP adds a `baron-zemo` row to it (creating the block if WP-520 has not yet
  landed — the marker map is additive).

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, §Zone & Pile Structure,
  §Determinism.
- `.claude/rules/*.md`, `.claude/skills/legendary-game-engine/SKILL.md`.
- `docs/ai/DECISIONS.md` — D-24290 (Tier-A + `cardTraitMatches`), D-24281
  (`reveal-or-wound` + `parseTraitPredicateTokens`), D-18506 (capture-bystander
  Ambush/Fight award split), D-24034, D-24266, D-24333 (the epic).
- **Template handlers** — `villainEffectRescueBystandersCurrentByTraitCount`
  (trait-count-sized bystander loop) and `villainEffectCaptureBystander` (the
  attach-at-Ambush path). Both in `villain/villainEffects.execute.ts`.
- **The card** — `data/cards/co2e.json` (villains → `masters-of-evil` →
  `baron-zemo`), Ambush line (read verbatim; do not re-derive).

**Split-vs-single decision:** one WP, single layer (game engine + card data). The
other two co2e MoE new-primitive lines (Ultron Fight, Whirlwind Ambush) are
separate WPs (WP-522, WP-523) — each is a distinct new primitive, so bundling
would blow the one-primitive-per-WP boundary.

**New engine capability (the notable part):** this is the **first** count of HQ
heroes by trait. `cardTraitMatches` exists but every current caller scans the
current player's hand + in-play, never `G.hq`. The WP adds a small
`countHqHeroesByTrait(G.hq, G.cardTraits, kind, value)` scan (iterate the 5 HQ
slots, skip `null`, `cardTraitMatches` each). **Trait-scope caveat (D-24296):**
`buildCardTraits` only builds entries for `config.heroDeckIds` heroes, so
synthetic component cards (Wounds, basic S.H.I.E.L.D.) have no `cardTraits` entry
— but those never sit in the HQ in normal play, and an `[team:avengers]` predicate
never matches them anyway, so no `BASIC_SHIELD_EXT_IDS`-style widening is needed
here.

## Scope (In)

- New `VillainEffectPrimitive` `'capture-bystanders-plus-per-hq-hero-by-trait'`
  (union + `VILLAIN_EFFECT_PRIMITIVES` array, lockstep, count 16 → 17, append-only
  per D-24034). Marker grammar `[effect:capture-bystanders-plus-per-hq-hero-by-trait:team:avengers]`
  (a `:team:<value>` / `:hc:<value>` trait predicate, parsed by
  `parseTraitPredicateTokens`).
- **Parser arm** in `setup/villainAbility.setup.ts` mirroring the `reveal-or-wound`
  arm: validate the trait predicate, return
  `{ primitive: 'capture-bystanders-plus-per-hq-hero-by-trait', requireKind,
  requireValue }`.
- **Handler** `villainEffectCaptureBystandersPlusPerHqHeroByTrait` in
  `villain/villainEffects.execute.ts` + its `VILLAIN_EFFECT_HANDLERS` entry:
  compute `count = 1 + countHqHeroesByTrait(G.hq, G.cardTraits, requireKind,
  requireValue)`; loop `count` times attaching a Bystander to `cardId` via
  `attachBystanderToVillain` (supply-bounded — `break` when `G.piles.bystanders`
  is empty); **attach only** (no award — Ambush timing, award deferred to defeat);
  `pushLog` a keyword-less self-narration of the count actually attached.
- **Helper** `countHqHeroesByTrait(hq, cardTraits, kind, value)` (local, pure):
  count the non-`null` HQ slots whose trait matches, via `cardTraitMatches`.
- **Marker row** for `co2e/masters-of-evil/baron-zemo` Ambush line in
  `inputs/villain-effect-markers.json` (under the `co2e` block) → regenerated
  `data/cards/co2e.json`.
- **Marker-script vocabulary:** append the primitive to the hand-synced
  `VILLAIN_EFFECT_PRIMITIVES` array in `apply-effect-markers.mjs` and confirm its
  validator accepts the `:team:<v>` predicate tail (it already validates
  `reveal-or-wound:<kind>:<value>`).
- Drift/handler/parse-test updates: `villainAbility.types.test.ts` (16 → 17),
  `villainEffects.execute.test.ts` (handler: base-1 + HQ-count, supply-bound,
  attach-not-award-at-Ambush, no-op-empty-HQ), `setup/villainAbility.setup.test.ts`
  (the predicate marker parses; a malformed predicate → `unresolvedMarkers`).
- Regenerated derived artifacts: `data/cards/co2e.json`, `ledger:villains`,
  `effect-implementation-index.json`, `sim:runtime-observed` (if it enumerates
  co2e Baron Zemo), and a `{ wp: WP-521, decision: D-24334 }` provenance row in
  `scripts/coverage/mechanic-provenance.json` (net-new primitive).
- **ewiki refresh:** `wiki/card-effect-system.md` villain-vocab list + a note for
  the new primitive (and the new HQ-by-trait scan).

## Out of Scope

- **The base count is fixed at 1** (the printed "captures a Bystander" base); only
  the *additional* captures scale with the HQ Avengers count. No configurable base.
- **HQ heroes only** — the count scans `G.hq` (the printed "in the HQ"), never
  player zones, the city, or the villain deck.
- **No award at Ambush** — attach only; the defeat fire site awards (D-18506). Do
  not add an award path.
- The other two co2e MoE new-primitive lines (WP-522 Ultron Fight, WP-523
  Whirlwind Ambush) and the two variable-attack passives (a separate mechanic
  class). No client change; no scoring/PAR change; no new contract file.

## Files Expected to Change

**Engine:**
- `packages/game-engine/src/rules/villainAbility.types.ts` — union + array (16 → 17)
- `packages/game-engine/src/setup/villainAbility.setup.ts` — new parse arm
- `packages/game-engine/src/villain/villainEffects.execute.ts` — handler +
  `countHqHeroesByTrait` + dispatch
- Tests: `rules/villainAbility.types.test.ts`, `villain/villainEffects.execute.test.ts`,
  `setup/villainAbility.setup.test.ts`

**Data / tooling:**
- `scripts/convert-cards/apply-effect-markers.mjs` — one array entry
- `scripts/convert-cards/inputs/villain-effect-markers.json` — co2e Baron Zemo
  Ambush row
- `data/cards/co2e.json` — regenerated
- `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` +
  `data/metadata/effect-implementation-index.json` +
  `scripts/coverage/mechanic-provenance.json`

**ewiki:** `wiki/card-effect-system.md`

**Governance:** `docs/ai/DECISIONS.md` (D-24334), `NUMBER-LEDGER.md`, `STATUS.md`,
`WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## Contract

- **The mechanic (D-24334).** `capture-bystanders-plus-per-hq-hero-by-trait` is an
  auto-resolve villain primitive carrying a `{ requireKind, requireValue }` trait
  predicate. Its handler attaches `1 + countHqHeroesByTrait(...)` Bystanders to the
  triggering villain via `attachBystanderToVillain`, supply-bounded, **attach-only
  at Ambush** (award on defeat). It self-narrates via `pushLog` (keyword-less).
- **HQ-by-trait count.** `countHqHeroesByTrait` counts non-`null` `G.hq` slots
  whose `G.cardTraits[slot]` matches the predicate (`team` or `hero-class`). This
  is the first HQ trait scan; it does **not** modify the shared `cardTraitMatches`
  / player-zone scanners.
- **Determinism.** No `ctx.random` (attaching bystanders is deterministic). The
  marker adds an Ambush descriptor to Baron Zemo's hashed `villainAbilityHooks`, so
  a fixture whose villain config includes co2e Masters of Evil shifts its
  initial-`G` hash. **At execution, verify** no hashed oracle (`finalStateHash`,
  `PRE_WP080_HASH`, sentinel) includes co2e MoE — the known oracles use
  `core/brotherhood` + a synthetic group, so hashes are expected **unchanged**;
  re-record via the canonical tool if any shifts.

## Acceptance Criteria

1. Revealing `co2e/masters-of-evil/baron-zemo` attaches `1 + (Avengers Heroes in
   HQ)` Bystanders to Baron Zemo (bounded by the Bystander supply), with **no
   award yet** (they sit in `G.attachedBystanders[cardId]`, awarded to the
   defeating player's victory pile on his defeat), and self-narrates the count —
   **no `no-handler` hollow breadcrumb**.
2. With **zero** Avengers Heroes in the HQ, exactly 1 Bystander attaches (base);
   with an empty Bystander supply, the handler is a reachable no-op (log `blocked`,
   no crash, no hollow).
3. `countHqHeroesByTrait` counts only non-`null` HQ slots matching the trait;
   player-zone / city / villain-deck cards are never counted.
4. `capture-bystanders-plus-per-hq-hero-by-trait` is in BOTH the union AND the
   array (16 → 17); the drift test passes.
5. `[effect:capture-bystanders-plus-per-hq-hero-by-trait:team:avengers]` parses to
   `{ primitive, requireKind: 'team', requireValue: 'avengers' }`; a malformed
   predicate → `unresolvedMarkers`.
6. `co2e/masters-of-evil/baron-zemo` flips unmarked → executable in the villain
   ledger + `effect-implementation-index.json` with `{ WP-521, D-24334 }`.
7. `pnpm -r build` 0; engine test green; hashed oracles verified unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (handler + HQ-count +
   supply-bound + attach-not-award + drift 16 → 17 + predicate-parse tests).
3. `pnpm ledger:villains:check && pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm roadmap:counts:check` → 0.
4. `pnpm check:wiki && pnpm wiki-viewer:check-links` → 0 after the ewiki edit.
5. Live-verify (D-24026, operator, post-deploy): a co2e MoE match — reveal Baron
   Zemo with Avengers Heroes in the HQ, confirm the captured-Bystander count and
   the eventual award on his defeat; no `no-handler`.

## Definition of Done

- All Acceptance Criteria pass; all Verification Steps green.
- Two-commit topology (`EC-556:` impl + `SPEC:` govern-close): D-24334 Active;
  STATUS updated; `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap `📝`→`✅` +
  `pnpm roadmap:counts:write`.
- `git diff --name-only` matches the allowlist (+ regenerated artifacts).
- `User-Visible Surface = play.legendary-arena.com` — D-24026 operator-pending.

## Non-Negotiable Constraints

- Full file contents for every new/modified file. ESM; Node v22+; `node:` imports.
- Human-style code per `00.6` — full-word names, functions ≤ 30 lines with JSDoc,
  `for...of` over branching `.reduce()`, `// why:` on non-obvious decisions.
- Determinism: no `Math.random()` / `Date.now()` / wall-clock / I/O; no `ctx.random`.
- Union + array move in lockstep (append-only, D-24034); drift test parity 16 → 17.
- **Attach-only at Ambush** (award deferred to defeat — D-18506); base 1 + HQ-trait
  count; supply-bounded; no `.reduce()` in the handler.
- New HQ-by-trait scan is local; do NOT alter `cardTraitMatches` or the player-zone
  scanners.
- Only `co2e/masters-of-evil/baron-zemo` Ambush is marked.
- Net-new primitive → `{ "wp": "WP-521", "decision": "D-24334" }` provenance row.
- **Session protocol:** if the marker fails to parse or the count logic can't be
  expressed cleanly, STOP and reconcile against ARCHITECTURE.md — do not guess.

**Locked contract values:** see `## Contract` and `EC-556` Locked Values.

## Vision Alignment

- **Vision clauses touched** — §1, §2, §10 (faithful card semantics).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity check** — none of NG-1..7 crossed (a villain effect).
- **Determinism preservation** — deterministic; no `ctx.random`; re-pin posture in
  §Contract (expected: no re-pin).

## Lint Gate Self-Review (00.3)

All 21 sections resolved (drafting session):
- **§1/§2** PASS (sections present; `00.6` constraints; full-output required).
- **§3 Assumes** PASS (WP-252/485/469/185 + reused helpers with file anchors).
- **§4 Context** PASS (ARCHITECTURE + DECISIONS + template handlers + card).
- **§5 Files** PASS (engine + card data + ewiki + governance; bounded).
- **§6 Naming** PASS (`[team:avengers]`, canonical primitive/field names; `ext_id`).
- **§7 Dependencies** PASS (no new dep).
- **§8 Architecture** PASS (engine + card data; no server/registry/pg reach).
- **§9/§10** N/A (existing pnpm/node regen; no new env).
- **§11 Auth** N/A.
- **§12 Test Quality** PASS (`node:test`; drift + handler + count + parse; no
  `boardgame.io/testing`).
- **§13 Verification** PASS (exact commands + exits).
- **§14 Acceptance** PASS (7 binary, observable items).
- **§15/§15.1 DoD** PASS (STATUS/DECISIONS/WORK_INDEX; user-visible surface +
  impact; D-24026 item).
- **§16 Code Style** PASS (models the trait-count + capture-bystander handlers;
  small HQ-scan helper; `// why:` on attach-not-award + base-1 + HQ-scope).
- **§17 Vision** PASS (§1/§2/§10; no conflict; NG clear; determinism line).
- **§18 Prose-vs-Grep** PASS.
- **§19 Bridge staleness** N/A.
- **§20 Funding** N/A (gameplay mechanic).
- **§21 API Catalog** N/A (no HTTP endpoint).
- Reserves **D-24334**.
