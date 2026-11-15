# WP-898 — Villain setup walk fold: one shared enumerator for the five setup tables; the attack-per-captured table stays separate (Game Engine)

**Status:** Draft 2026-11-15 — pre-flight (01.4) READY TO EXECUTE (round 2); copilot (01.7) PASS → CONFIRM (round 2); lint (00.3) PASS (run 2). EC-936; **D-24855** reserved (#3398). See §Gate Record.
**Primary Layer:** Game Engine (one setup file and one new test file)
**Dependencies:** WP-838 ✅ (the fifth walk copy, #3394), WP-871 ✅, WP-841 ✅, WP-817 ✅, WP-292 ✅. No open packet edits `setup/villainDefeatRequirement.setup.ts` at drafting. A packet that adds a sixth marker table before this one executes adds a sixth walk copy; fold it the same way (see EC Before Starting). WP-897 (drafted #3399) touches no file in this allowlist.
**User-Visible Surface:** none — infrastructure
**Risk Tier:** MEDIUM — an engine setup refactor of five hashed `G` tables, proven byte-identical (digest + real-registry golden); no auth, money, persistence, server or player surface.
**Lane:** Standard (two-session). The lightweight lane (D-24028) does not fit: the shared enumerator is a new abstraction (an `01.6` trigger, criterion 3), and the packet rewrites existing builder bodies (criterion 7).
**Arc:** follow-up named by D-24774 §8-9, D-24771 and the WP-838 post-mortem (`docs/ai/post-mortems/01.6-WP-838-co2e-capture-family.md` L95); `docs/ai/STATUS.md` L897 "(Fold)".

> Baseline: `origin/main` at `b43e5478` (the reserve commit #3398; WP-838 merged in #3394). Re-read the line anchors and test totals at execution.

---

## Goal

`packages/game-engine/src/setup/villainDefeatRequirement.setup.ts` builds five per-villain setup tables. Each builder carries its own copy of the same registry walk. Today a new marker table means a sixth copy, and a fix to the walk has to be made five times. After this session the walk exists once, as a data-returning enumerator. Each builder keeps only its own parts: the line parser, the first-valid-line rule and its per-copy entry construction. All five tables come out byte-identical, so no match, replay or hash oracle changes.

The second half of the follow-up, folding `G.villainAttackPerCaptured` into `G.villainVariableAttack`, is **declined** (Operator decision 2026-11-15). D-24855 records why. The two tables stay separate for good.

## User-Visible Impact

None. The change is setup-internal: same `G`, same fight costs, same gates. Live-verify (D-24026) is not applicable. The row closes `n/a` (D-24853).

---

## Assumes

1. **The five walk copies** (`setup/villainDefeatRequirement.setup.ts` on the baseline). Each is the same block:
   - `isRegistryReader` guard (else an empty record)
   - for each `matchConfig.villainGroupIds` entry: `parseQualifiedId`, `registry.getSet`, `findVillainGroupCards` (skip on null)
   - for each card: skip a non-string `slug` or a non-array `abilities`; scan `abilities` skipping non-string lines, take the first non-null parse (`break`); skip when null
   - `villainCardInstanceExtIds(parsed.setAbbr, parsed.slug, card.slug, card)`; write one fresh entry per id

   | Builder | Lines | Parser | Per-copy entry |
   |---|---|---|---|
   | `buildVillainDefeatRequirements` | L280-324 | `parseDefeatRequirementLine` (private) | `{ kind: requirement.kind, value: requirement.value }` |
   | `buildVillainFightDiscardCosts` | L350-394 | `parseFightDiscardCostLine` | `{ eligibleCosts: [...discardCost.eligibleCosts] }` |
   | `buildVillainVariableAttack` | L571-615 | `parseVariableAttackLine` | `copyVariableAttackEntry(entry)` |
   | `buildVillainFightRestrictions` | L688-731 | `parseFightRestrictionLine` | `{ kind: restriction.kind }` |
   | `buildVillainAttackPerCaptured` | L806-849 | `parseAttackPerCapturedLine` | `{ kind: entry.kind, attackPerCard: entry.attackPerCard }` |

2. **Shared private helpers in the same file:**
   - `DefeatRequirementVillainCard` (L61)
   - `VillainDefeatRequirementRegistryReader` (L69, exported)
   - `parseQualifiedId` (L204)
   - `isRegistryReader` (L224)
   - `findVillainGroupCards` (L239)
3. **The instance-id emitter.** `villainDeck/villainDeck.setup.ts:504` `villainCardInstanceExtIds` is pure, has no side effects, and returns a fresh array. It produces `{setAbbr}-villain-{groupSlug}-{cardSlug}-{NN}` for `readVillainCopyCount(card)` copies (L472: `copies` when it is a number ≥ 1, else 1).
4. **Callers.** `setup/buildInitialGameState.ts` L479-516 calls all five builders with `(registry as unknown, villainBuildConfig)` and spreads each table only when non-empty. Nothing else calls them in production. Tests: `setup/villainDefeatRequirement.setup.test.ts` (7 suites, 18 cases) and `setup/buildInitialGameState.shape.test.ts`.
5. **The "deliberate copy" comments** this packet retires:
   - L567-570 (`// why: D-24774 — a deliberate third copy …`)
   - L803-805 (`// why: D-24771 — a deliberate fifth copy …`)

   The WP-871 comment at L684-687 is about the table's shape, not the walk, and stays.
6. **Real-data baseline.** Over all 134 villain groups in `data/cards/*.json` (one config, files in name order, groups in file order), the five builders produce 4 / 2 / 8 / 5 / 6 entries (25 in total). `JSON.stringify` of `{ villainDefeatRequirements, villainFightDiscardCosts, villainVariableAttack, villainFightRestrictions, villainAttackPerCaptured }` hashes to sha256 `6c0a23d3f2441add49727416bbc7578fc2bb82986c782f4bd58514f9e34ca899`. Measured at drafting with a scratch script that imports the builders through `tsx`. The entries come from these 13 groups:
   - `core/brotherhood`, `core/spider-foes`, `ssw1/deadlands-the` (the data's own slug, `data/cards/ssw1.json` L1805)
   - `ca75/zolas-creations`
   - `co2e/hydra`, `co2e/skulls`, `co2e/sinister-syndicate`, `co2e/enemies-of-asgard`, `co2e/masters-of-evil`, `co2e/sinister-spider-foes`
   - `chmp/monsters-unleashed`, `cvwr/great-lakes-avengers`, `ssw2/deadpools-secret-secret-wars`
7. **Real-registry test pattern.** Engine tests read committed card data with `readFileSync(join(CARDS_DIRECTORY, '<set>.json'))` and a structural `{ getSet }` registry (`board/demolish.logic.test.ts` L16-18, L39, L67-71). The engine test glob is `src/**/*.test.ts` (`packages/game-engine/package.json` `test`), so a new test file runs with no wiring.
8. **Hash oracles.**
   - The replay sentinel and `PRE_WP080_HASH = 'dae75521'` (`replay/replay.execute.test.ts` L188)
   - `replay/replay.hash.test.ts`
   - the `finalStateHash` pins listed by `Get-ChildItem packages/game-engine/src -Recurse -Filter *.test.ts | Select-String -List finalStateHash | Select-Object Path`

   None of them may change. A setup refactor that keeps every table byte-identical cannot move them.
9. **Targeted baseline.** `node --import tsx --test` over `setup/villainDefeatRequirement.setup.test.ts`, `replay/replay.execute.test.ts`, `replay/replay.hash.test.ts` and `setup/buildInitialGameState.shape.test.ts` gives 52 / 0 on the baseline.
10. **The table-fold surface** (for D-24855; not changed here):
    - `rules/villainAbility.types.ts` L1065 `VillainCapturedKind`, L1071 `VILLAIN_CAPTURED_KINDS`, L1080 `VillainAttackPerCaptured`
    - `types.ts` L3379 `villainAttackPerCaptured?`
    - `economy/economy.resolve.ts` `villainCapturedCountBonus` (~L381) and the dynamic early return (~L470-475)
    - `scripts/convert-cards/apply-defeat-requirement-markers.mjs` L150 `LOCKED_CAPTURED_KINDS`
11. **Other villain walks outside this file** (not folded here):
    - private `findVillainGroupCards` copies: `setup/villainAbility.setup.ts:1268`, `setup/buildCardDisplayData.ts:1014`, `setup/buildCardVictoryPoints.ts:126`
    - walks of other shapes: `setup/buildCardAbomination.ts`, `setup/buildFightSizeChanging.ts`, `setup/buildVillainBloodFrenzy.ts`, `setup/buildCardKeywords.ts`
12. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why now.** WP-841 (third copy) and WP-838 (fifth copy) each chose duplication on purpose. A shared walk would have changed shipped tables inside a feature packet. Both packets named this fold as a separate follow-up (D-24774 §9; WP-838's L803-805 code comment citing D-24771). As a refactor-only packet with a byte-identity proof, the risk they avoided is the thing this packet tests.
- **Why a data-returning enumerator, not a callback.** `.claude/rules/code-style.md` §Functions forbids higher-order functions the framework does not require. A `buildTable(registry, matchConfig, parseLine, copyEntry)` shape is out. The enumerator returns plain records; each builder loops over them with `for…of`.
- **Why "first valid line wins" stays in each builder.** It is per-table semantics: one card could carry two different markers, and each table takes its own first match. Hoisting it would need a parser argument, which is the callback again.
- **Why the enumerator computes ids for every card.** Today the emitter runs only for marked cards. Running it for every card does the same work the deck builder already does (Assumes 3: pure, fresh array) and keeps each builder at a single loop. It touches no `G` and no randomness.
- **Why the table fold is declined (Operator decision 2026-11-15, option (c) of three).**
  - Measured exposure on 2026-11-15, by a read-only query of the droplet `la` database: `bgio.matches` has 0 rows holding `villainAttackPerCaptured` in `initial_state`. `bgio.replay_artifacts` has 4 of 247. All 4 are finished `co2e/doctor-doom` live-verify autoplays: `9L2FBYe3ifK`, `NEPNusmBEwM`, `NU-svGELG_A` and `T5nqL0pJBxV`.
  - The fold has two paths, and both lose:
    - Keep a legacy read of the old field. The engine then has two read paths, which is most of what the fold was meant to remove.
    - Drop the old read. Those replays, and every later match with Enchantress, Venom or co2e Baron Zemo, replay at base-only fight cost.
  - Either path changes the contract file `rules/villainAbility.types.ts` for a naming cleanup with no behavior gain.
  - The walk fold is what pays off on every new marker. The table fold was renaming.
- **What a sixth captured source costs without the fold** (recorded in D-24855 so a later packet does not re-open it): a new `VillainCapturedKind` member, plus `VILLAIN_CAPTURED_KINDS`, plus the overlay's hand-synced `LOCKED_CAPTURED_KINDS`, plus one arm in `villainCapturedCountBonus`. That is four small anchored edits.
- **Why the other walks stay out** (Assumes 11). They have different shapes: henchmen, the Mastermind, group-level reads, `readSetArray`. Folding them widens the hash-risk surface to `cardDisplayData`, VP, keywords and fight-cost tables. Each can follow the same pattern later, one packet at a time.
- `docs/ai/ARCHITECTURE.md` §Persistence Boundaries (setup snapshots in `G`) and §Zone & Pile Structure (CardExtId keys).
- `docs/ai/DECISIONS.md`: read D-24076, D-24750, D-24774 (§8-9), D-24816, D-24771, D-13502 (no aliasing across copies), D-18704 (per-instance keys) and D-10014 (local helper copies) before coding.
- User memory: `reference_injected_seam_hides_missing_wiring` (a mocked registry proves nothing about real data), `reference_setup_hook_change_replay_compat`, `reference_engine_tests_never_typechecked`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24855) before coding. One WP per session.

**Packet-specific:**
- **Behavior identity.** For every input, valid or malformed, every builder returns the same keys, in the same insertion order, with deep-equal entries, **or throws the same error**. The Assumes 6 digest must match before and after. A `null` entry inside a group's `cards` throws a `TypeError` at `typeof card.slug` today in all five builders. The enumerator keeps that throw: do **not** add a `!card` guard. The one accepted difference is cost: instance ids are now computed for unmarked cards too (Context), which is negligible for real data.
- **No callbacks.** The enumerator takes no function argument. Builders do not pass functions anywhere.
- **Parsers untouched.** The five line parsers, `copyVariableAttackEntry`, `parseEligibleCostList` and the marker regexes are not edited.
- **Signatures untouched.** The five builders keep their exported names and `(registry: unknown, matchConfig: MatchSetupConfig)` signatures. `buildInitialGameState.ts`, `types.ts`, `rules/villainAbility.types.ts`, `economy/**` and the overlay script are not edited.
- **No test edits.** Every existing test passes unmodified. The new cases live in a new file.

## Locked Values

- In `setup/villainDefeatRequirement.setup.ts`:

  ```ts
  /** One selected villain card, as every setup table builder reads it (WP-898 / D-24855). */
  export interface SelectedVillainCard {
    /** The card's string ability lines, in printed order (non-string entries dropped). */
    abilityLines: string[];
    /** Copy-indexed instance ext_ids from villainCardInstanceExtIds. */
    instanceExtIds: CardExtId[];
  }

  export function listSelectedVillainCards(
    registry: unknown,
    matchConfig: MatchSetupConfig,
  ): SelectedVillainCard[]
  ```

  Body, in this order:
  1. `!isRegistryReader(registry)` → return `[]`.
  2. For each `villainGroupId` of `matchConfig.villainGroupIds`, in order: `parseQualifiedId` (null → next); `registry.getSet(parsed.setAbbr)`; `findVillainGroupCards(setData, parsed.slug)` (null → next).
  3. For each `card` of the group's cards, in order: `typeof card.slug !== 'string'` → next; `!Array.isArray(card.abilities)` → next.
  4. Build `abilityLines` with a `for…of` that pushes each `typeof abilityLine === 'string'` entry (no `.filter`). Then `instanceExtIds = villainCardInstanceExtIds(parsed.setAbbr, parsed.slug, card.slug, card)`. Push `{ abilityLines, instanceExtIds }`.

  It returns a fresh outer array and fresh `abilityLines` arrays on every call. A card with no string lines is still listed, with `abilityLines: []`. A duplicate group id lists its cards again, which matches today's overwrite-with-equal-entries behavior.
- Each builder body becomes exactly:

  ```ts
  const <table> = {};                      // existing name and type kept
  for (const villainCard of listSelectedVillainCards(registry, matchConfig)) {
    let <entry> = null;                   // existing name and type kept
    for (const abilityLine of villainCard.abilityLines) {
      <entry> = <parser>(abilityLine);
      if (<entry> !== null) break;
    }
    if (<entry> === null) continue;
    for (const cardId of villainCard.instanceExtIds) {
      <table>[cardId] = <per-copy entry, verbatim from the Assumes 1 table>;
    }
  }
  return <table>;
  ```

  The per-copy `// why:` (D-13502, no aliasing) stays on each fan-out loop. Each builder loses its own `isRegistryReader` guard; the enumerator returns `[]` instead.
- The two retired comments (Assumes 5) become one `// why:` on `listSelectedVillainCards`: "WP-898 / D-24855 — the one setup registry walk for every per-villain marker table (formerly five copies, D-24774 §9 / D-24771). It returns data, not a callback (code-style: no higher-order functions); first-valid-line-wins stays in each builder because it is per-table semantics."
- **T7 golden pin:** the sha256 of `JSON.stringify({ villainDefeatRequirements, villainFightDiscardCosts, villainVariableAttack, villainFightRestrictions, villainAttackPerCaptured })`, built over the 13 groups in Assumes 6 order, is `4c0bc0d3a510af9a42b75829887c28da5ea2290ac8c5f923d4d4117ad2321d17` on `b43e5478` data (4 / 2 / 8 / 5 / 6). The T7 golden literal must hash to this value; record the check in the commit body. If `data/cards` changed since `b43e5478`, use the fresh pre-edit value and say so.
- A second `// why:` on the `abilityLines` filter: every builder skipped non-string lines, so dropping them here is identical.
- The new test file is `setup/villainDefeatRequirement.enumerator.test.ts`. Its local mock-registry copy types card fields as `unknown`, so T3 / T4 can pass a numeric `slug`, a string `abilities`, mixed arrays and `copies: 0` with no `any`, `@ts-ignore` or `@ts-expect-error`.

---

## Scope (In)

- **A)** `setup/villainDefeatRequirement.setup.ts`: add `SelectedVillainCard` and `listSelectedVillainCards`; rewrite the five builder bodies to the locked shape; replace the two retired comments with the new one.
- **B)** `setup/villainDefeatRequirement.enumerator.test.ts` (new): T1-T8 below.
- **C)** The one-time byte-identity check (Verification Step 2). It is recorded in the commit body and D-24855 and is not committed as a script.

## Out of Scope

- **The table fold** (`G.villainAttackPerCaptured` into `G.villainVariableAttack`). Declined; D-24855 records why and what a sixth captured source costs. No edit to `rules/villainAbility.types.ts`, `types.ts`, `economy/**` or the overlay script.
- **The other villain walks** (Assumes 11), in `villainAbility.setup.ts`, `buildCardDisplayData.ts`, `buildCardVictoryPoints.ts`, `buildCardAbomination.ts`, `buildFightSizeChanging.ts`, `buildVillainBloodFrenzy.ts` and `buildCardKeywords.ts`.
- **Renames.** `DefeatRequirementVillainCard`, `VillainDefeatRequirementRegistryReader` and the file name stay. Moving the builders to another file is also out.
- **Henchman or Mastermind marker tables.** The enumerator is villain-only.
- **Card data, the overlay, the feeds, PAR and the client.** None change.

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `setup/villainDefeatRequirement.setup.ts` — modified — adds `SelectedVillainCard` / `listSelectedVillainCards`; the five builder bodies rewritten to the locked loop; the two retired comments replaced
- `setup/villainDefeatRequirement.enumerator.test.ts` — **new** — T1-T8

**Governance close:**
- `docs/ai/post-mortems/01.6-WP-898-villain-setup-walk-fold.md` — **new** — mandatory under `01.6-post-mortem-checklist.md` L47, because this adds a long-lived abstraction
- `docs/ai/DECISIONS.md` — modified — D-24855
- `docs/ai/STATUS.md` — modified
- `docs/ai/work-packets/WORK_INDEX.md` — modified
- `docs/ai/execution-checklists/EC_INDEX.md` — modified
- `docs/05-ROADMAP-MINDMAP.md` — modified
- `docs/ai/NUMBER-LEDGER.md` — modified — the three reservation lines gain `; LANDED YYYY-MM-DD`

That is 2 code / test files (1 new, 1 modified).

## Contract

- `SelectedVillainCard` and `listSelectedVillainCards` (Locked Values), exported for the test file only. No production caller outside this file.
- The five builders' exported names, signatures and outputs, unchanged.

## Test Contract

All cases go in the new test file and use `node:test` / `node:assert/strict` only. The mock registry follows the existing `makeRegistry` shape in `villainDefeatRequirement.setup.test.ts` (a local copy; that file is not edited).

| # | Input | Expected | Invariant / must NOT |
|---|---|---|---|
| T1 | `listSelectedVillainCards` with `null`, `{}` and `{ getSet: 'x' }` | `[]` each | never throws |
| T2 | A valid registry; `villainGroupIds` of `''`, `'core'`, `'a/b/c'`, `' core/x'`, an unknown set and an unknown group | `[]` | malformed ids are skipped, not thrown |
| T3 | One group with a no-`slug` card, a numeric-`slug` card, a card whose `abilities` is a string, and a card with `abilities: ['a', 7, null, 'b']` | exactly one record, `abilityLines` `['a', 'b']`; a group whose `cards` holds `null` → `assert.throws` (`TypeError`), as today | guards and the string filter; no new `!card` guard |
| T4 | Cards with `copies: 3`, no `copies`, and `copies: 0` | ids `-00 -01 -02`; `-00`; `-00` | the shared emitter, `readVillainCopyCount` |
| T5 | Two groups `[g2, g1]`, two cards each; then the same group listed twice | records in config order, then card order; the second config lists the group's cards twice | order is the insertion order the tables inherit |
| T6 | Two calls on the same input; push onto the first result's arrays; mutate the registry card's `abilities` after a call | the second result is unchanged; the earlier result's `abilityLines` is unchanged | fresh arrays; no alias of registry data |
| T7 | **Real registry.** The committed JSON for `core`, `ssw1`, `ca75`, `co2e`, `chmp`, `cvwr` and `ssw2`, with the 13 groups of Assumes 6 in that order. Run all five builders. | Each table deep-equals the golden literal, and `Object.keys` matches the golden key order. Golden = the 25 entries of Assumes 6. | byte identity on real data (the D-24855 pin). A data change that marks another card in these groups updates the golden in the same commit. |
| T8 | **Real registry**, T7's tables | For each marked card with more than one copy (11 of the 14), the copy entries are different objects; Primus' `eligibleCosts` arrays and Hydro-Man's `requireCitySpaces` arrays are different objects; mutating one copy's entry leaves the other's unchanged | no aliasing (D-13502) |

The T7 golden carries a `// why:`: a failure means a setup table changed, which is replay-relevant; it is never re-pinned to make a refactor pass.

Also: the 18 existing cases in `villainDefeatRequirement.setup.test.ts` and every case in `buildInitialGameState.shape.test.ts` pass **unmodified**.

## Vision Alignment

**Vision clauses touched:** §8 / §22 (determinism), §23 / §24 (competitive integrity: fight costs unchanged), NG-1.

**Conflict assertion:** No conflict. This WP preserves all touched clauses and crosses none of NG-1..NG-8 (an engine-internal refactor with no paid or persuasive surface).

**Determinism preservation:**
- Setup output is byte-identical (Assumes 6 digest, T7). No new `G` key and no removed one.
- No randomness, clock or I/O. The enumerator runs once per builder at setup.
- Hash oracles (Assumes 8) are expected unchanged. If one moves, STOP: a table changed.
- **Replay-compat:** no `initialState` changes for any match, past or future, so every stored match replays exactly as before.

## Funding Surface Gate

§20 **N/A**: engine-internal refactor. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Enumerator.** T1-T6 pass.
2. **Identity.** T7-T8 pass. The Verification Step 2 digest after the change equals the one taken before it.
3. **Unmodified tests.** The existing setup and shape tests pass with no edit (`git diff` shows neither file).
4. **One walk.** Only `listSelectedVillainCards` in `villainDefeatRequirement.setup.ts` calls `getSet`, `parseQualifiedId`, `findVillainGroupCards` or `villainCardInstanceExtIds`. Each builder body has one outer `for…of` over its result.
5. **Locked surface.** `listSelectedVillainCards` takes no function parameter and no builder passes a function. The five parsers, `copyVariableAttackEntry`, `parseEligibleCostList` and the marker regexes are unchanged. The L567-570 and L803-805 comments are gone, replaced by the single locked `// why:`; the L684-687 WP-871 comment remains.
6. **Revert proofs.** Each of the five Verification Step 7 mutations fails at least one named T-case and is restored.
7. **Gates.** `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. The hash-oracle files are untouched and green.

## Verification Steps

1. `pnpm -r build` → exit 0. Record the game-engine test total before any edit.
2. **Byte identity (before / after).** Before editing, run a scratch script, not committed: write it in the session scratchpad as `walk-digest.mts` and run it from `packages/game-engine` with `node --import tsx <scratchpad>/walk-digest.mts`. It imports the builders by a `file:///` URL (or `pathToFileURL`), because a bare Windows `C:/…` path fails in an ES module (`ERR_UNSUPPORTED_ESM_URL_SCHEME`). It loads every `data/cards/*.json` (files in name order, groups in file order) into a `{ getSet }` registry, runs all five builders over one config listing every villain group id, and prints the per-table entry counts and the sha256 of `JSON.stringify` of the five tables. Expect 134 groups and 4 / 2 / 8 / 5 / 6 entries, with digest `6c0a23d3…ca899` if `data/cards` has not changed since `b43e5478`. If the data has changed, use the fresh pre-edit digest. Re-run after the edit: the counts and digest must equal the pre-edit run. Record both in the commit body.
3. `pnpm --filter @legendary-arena/game-engine test` → all pass. Record the before and after totals (+8 expected, one per T-case).
4. `Select-String -Path packages/game-engine/src/setup/villainDefeatRequirement.setup.ts -Pattern 'getSet','findVillainGroupCards\(','villainCardInstanceExtIds\(','parseQualifiedId\(' | Select-Object LineNumber, Line` shows only definitions, imports, comments, the `isRegistryReader` type check (`typeof candidate.getSet`) and the calls inside `listSelectedVillainCards` (AC 4).
5. `pnpm -r --no-bail test` → 0 fail.
6. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` line-ending churn.
7. Revert proofs, one at a time, each failing at least one T-case, then restored:
   - drop the `Array.isArray(card.abilities)` guard (T3)
   - drop the string filter on ability lines (T3)
   - emit only the first instance id (T4, T7)
   - iterate `villainGroupIds` in reverse (T5, T7 key order)
   - return a module-level cached array (T6)

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the five revert proofs were observed.
- [ ] D-24855 appended to `DECISIONS.md` as Active, with the content listed under Reserved Decision.
- [ ] `docs/ai/STATUS.md` entry states "No user-observable change — infrastructure only"; the L897 "(Fold)" follow-up resolved: walks folded (WP-898); table fold declined (D-24855). The Assumes 11 walks are named as an open follow-up.
- [ ] The 01.6 post-mortem `docs/ai/post-mortems/01.6-WP-898-villain-setup-walk-fold.md` is written (verdict WP COMPLETE).
- [ ] WORK_INDEX `[x]` with the Done date, the `EC-936:` commit, game-engine totals before → after (+8), both digests and the T7 pin, ending ` [live-verify: n/a]`; EC_INDEX Done, mindmap `✅`, ledger lines `; LANDED YYYY-MM-DD`. After `pnpm roadmap:counts:write`, each of these exits 0: `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check`, `workindex:liveverify:check`.
- [ ] Two-commit topology: `EC-936:` then `SPEC:`.
- [ ] Live-verify (D-24026): **N/A**, `User-Visible Surface: none — infrastructure`. Byte identity is proven by T7 and the Verification Step 2 digest.

## Operator forks (decided)

| # | Fork | Decided | Alternatives |
|---|---|---|---|
| F1 | Fold `G.villainAttackPerCaptured` into `G.villainVariableAttack`? | **(c) Decline** (Operator, 2026-11-15) | (a) fold and keep a legacy read of the old field; (b) fold, drop the old read and accept divergent replays for the live-verify artifacts |
| F2 | Which walks? | **The five in `villainDefeatRequirement.setup.ts`** (drafted default) | also the Assumes 11 walks (wider hash-risk surface) |

## Reserved Decision (lands at execution)

**D-24855 — villain-setup-walk-fold.** It locks:
- `listSelectedVillainCards` as the one setup registry walk for every per-villain marker table in `villainDefeatRequirement.setup.ts`. It returns data, not a callback. First-valid-line-wins and per-copy entry construction stay in each builder. A new marker table adds a parser and a builder loop, never a walk. This supersedes D-24774 §9's "deliberate third copy" note and the "deliberate fifth copy" code comment (setup.ts L803-805, which cites D-24771).
- The byte-identity proof: the pre- and post-edit digests over all villain groups, plus the T7 golden.
- **The table fold is declined for good** (Operator, 2026-11-15). The record includes:
  - the measured exposure (0 live matches; 4 finished replay artifacts, the four live-verify autoplay ids)
  - the reasons: the two read paths, or divergent replays, and the contract change for no behavior gain
  - the cost of a sixth captured source (four anchored edits, Context)

  This supersedes D-24774 §8's "the fold path … in a later packet" and D-24771 §3's "the fold is a follow-up".
- The Assumes 11 walks stay outside the fold and are named as follow-ups.
- Replay-compat: no `initialState` change, so every stored match replays as before.

---

## Gate Record

Each gate was run by an independent subagent. Pre-flight and lint ran first, in parallel; copilot ran after pre-flight was READY. After every edit, every gate re-confirmed on the final text.

**Pre-flight (01.4), round 1: NOT READY.** The agent prototyped the locked enumerator and the five builders in its scratchpad (repo untouched) and ran a differential against the current code. Results: the same digest over all 134 groups; the same output or the same throw for every malformed input tried (bad registries and ids, null and primitive cards, string `abilities`, sparse lines, odd `copies`, duplicate and reversed configs); the same `getSet` call count (65).
- **PS-1 (fixed):** Assumes 6 named `ssw1/deadlands`. The slug is `deadlands-the`, and the wrong id would have dropped the Zombie Venom entry (24, not 25).
- **PS-2 (fixed):** T8 assumed two copies per card. Three of the 14 marked cards are single-copy.
- **RS-1..5 (fixed):** "or the same throw" plus the cost note; no `!card` guard, with a null-card `assert.throws` in T3; the Step 4 allowed hit for `isRegistryReader`; `unknown`-typed mock card fields; the `abilityLines` `// why:` in the WP; an anchor nit.

**Pre-flight round 2: READY TO EXECUTE.** One clarifying fix: the Step 2 scratch script imports by `file:///` URL. READY was re-confirmed after that edit and again after the copilot edits, with the T7 pin recomputed.

**Copilot (01.7), round 1: RISK → HOLD, six findings, all applied.** No architecture or determinism concern; hidden coupling checked (only `buildInitialGameState.ts` and two engine tests import the builders; nothing in `apps/`, `scripts/` or other packages).
1. T7 golden had no pre-committed value → T7 golden pin `4c0bc0d3…` locked.
2. A sixth-table amendment would escape the digest → EC Before Starting extends the digest and golden first.
3. D-24855 supersession targets imprecise → D-24774 §9 plus the L803-805 comment; D-24774 §8 plus D-24771 §3.
4. Close lines → `; LANDED YYYY-MM-DD`; WORK_INDEX row carries date, commit, totals, digests and pin.
5. EC paraphrased the locked blocks → copied verbatim.
6. `origin/main` moved (WP-897 draft #3399) → rebased, keep-both rows, counts regenerated.

**Copilot round 2: PASS → CONFIRM.** One optional Context wording fix ("Why now": D-24774 §9 plus WP-838's code comment, not D-24771 itself). It was applied after CONFIRM; it is background text only, with no change to contract, scope or decision.

**Measured at drafting:**
- The full-registry digest was reproduced by four separate runs (drafter, pre-flight, lint, copilot).
- The T7 pin was computed by three (drafter, copilot, pre-flight).
- Targeted baseline: 52 / 0.

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 runs. **Run 1: FAIL.** The fixes:
- §3 / §6: the `deadlands-the` slug.
- §9: PowerShell commands for Assumes 8 and Step 4.
- §14: the ACs went from 5 to 7.
- §15.1: the STATUS infrastructure phrase.
- §15.2: the Risk Tier line in the WP and the EC.
- §5: per-file descriptions.

**Run 2: PASS**, re-confirmed after the Step 2 edit and after the copilot edits. The table is run 2's post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all required sections; 5 Out of Scope items; 7 ACs |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS after fix — every Assumes anchor checked against the repo; targeted baseline 52 / 0 re-run |
| §4 | PASS — ARCHITECTURE sections, the cited D-ids, memory refs; no data-shape change, so 00.2 is not cited |
| §5 | PASS after fix — 2 code / test files, each tagged and described; governance files tagged |
| §6 | PASS after fix — group ids match the data; canonical names untouched |
| §7 | PASS — no new dependencies |
| §8 | PASS — setup-time only; no `G` key added or removed |
| §9 | PASS after fix — PowerShell / pnpm / node commands |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — `node:test`, committed JSON via `readFileSync` (precedent), no boardgame.io / network / DB |
| §13 | PASS — exact commands with expected output; the Step 2 digest reproduced |
| §14 | PASS after fix — 7 binary ACs tied to T1-T8, the digest and the revert proofs |
| §15 | PASS — DoD covers DECISIONS, STATUS, indexes, ledger, post-mortem, every check script |
| §15.1 | PASS after fix — `none — infrastructure`; the STATUS phrase is required; the row closes `[live-verify: n/a]` |
| §15.2 | PASS after fix — Risk Tier MEDIUM, byte-identical in the WP and the EC |
| §16 | PASS — the abstraction replaces 5 copies; no callback; JSDoc and `// why:` sites locked |
| §17 | PASS — §8 / §22 / §23 / §24, NG-1; conflict line; determinism and replay-compat |
| §18 | PASS — Step 4 is not count-bounded and allows comment hits |
| §19 | N/A at draft — commit-time reconciliation |
| §20 | PASS — N/A with reason (engine-internal refactor) |
| §21 | PASS — N/A with reason (no HTTP endpoint or `apps/server/src` surface) |

**Verdict:** PASS.
