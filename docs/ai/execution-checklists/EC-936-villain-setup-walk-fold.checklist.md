# EC-936 — Villain setup walk fold (Execution Checklist)

**Source:** docs/ai/work-packets/WP-898-villain-setup-walk-fold.md
**Layer:** Game Engine
**Risk Tier:** MEDIUM — an engine setup refactor of five hashed `G` tables, proven byte-identical (digest + real-registry golden); no auth, money, persistence, server or player surface.

## Before Starting
- [ ] Scope lock: only the Files to Produce list below changes.
- [ ] WP-898 Assumes 1-12 hold on the execution baseline. Re-read the five builder line ranges (Assumes 1) and the two retired comments (Assumes 5).
- [ ] If a packet merged since `b43e5478` added a sixth marker table to `villainDefeatRequirement.setup.ts`, fold its walk the same way (the same locked builder shape) as an inline amendment, recorded in the commit body. If it changed a parser or an entry shape, STOP and reconcile the WP. When folding a sixth table, add it to the Verification Step 2 digest object and to the T7 golden before any edit; the Assumes 6 hash and the T7 pin then no longer apply. Use and record the fresh pre-edit values.
- [ ] `pnpm -r build` → 0. Record the game-engine test total.
- [ ] **Before any edit:** run the Verification Step 2 scratch digest and record the counts and sha256. Capture the T7 golden from the **pre-edit** builders: 25 entries for these 13 groups, in this config order: `core/brotherhood`, `core/spider-foes`, `ssw1/deadlands-the`, `ca75/zolas-creations`, `co2e/hydra`, `co2e/skulls`, `co2e/sinister-syndicate`, `co2e/enemies-of-asgard`, `co2e/masters-of-evil`, `co2e/sinister-spider-foes`, `chmp/monsters-unleashed`, `cvwr/great-lakes-avengers`, `ssw2/deadpools-secret-secret-wars`.

## Locked Values (do not re-derive)
- Copied verbatim from WP Locked Values:

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

- Body, in order:
  1. Not a reader → `[]`.
  2. Each `villainGroupIds` entry, in order: `parseQualifiedId` / `getSet` / `findVillainGroupCards` (null → next).
  3. Each card, in order: a non-string `slug` or a non-array `abilities` → next.
  4. `abilityLines` gets the string lines, pushed in a `for…of` (no `.filter`). Then `instanceExtIds = villainCardInstanceExtIds(parsed.setAbbr, parsed.slug, card.slug, card)`. Push `{ abilityLines, instanceExtIds }`.

  Fresh arrays on every call. A card with no string lines is listed with `[]`.
- Builder body, copied verbatim from WP Locked Values:

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

- T7 golden pin (`b43e5478` data): the sha256 of `JSON.stringify` of the five tables over the 13 groups below = `4c0bc0d3a510af9a42b75829887c28da5ea2290ac8c5f923d4d4117ad2321d17`. The golden literal must hash to it; record the check in the commit body.
- Builders keep their names, signatures and table and entry variable names, and lose their own `isRegistryReader` guard.
- The new `// why:` on `listSelectedVillainCards` (WP Locked Values) replaces the L567-570 and L803-805 comments. The L684-687 WP-871 comment stays.
- Test file: `setup/villainDefeatRequirement.enumerator.test.ts`. The T7 sets are `core`, `ssw1`, `ca75`, `co2e`, `chmp`, `cvwr` and `ssw2`, read from `data/cards` with `readFileSync`.
- Baseline digest (`b43e5478` data): 134 groups; 4 / 2 / 8 / 5 / 6 entries; sha256 `6c0a23d3f2441add49727416bbc7578fc2bb82986c782f4bd58514f9e34ca899`.

## Guardrails
- Byte identity: same keys, same insertion order, deep-equal entries, or the same throw. The post-edit digest equals the pre-edit digest. STOP if it does not. No `!card` guard: a `null` card throws today and must keep throwing.
- The test file's local mock types card fields as `unknown`; no `any` / `@ts-ignore` / `@ts-expect-error`.
- No callback or function argument anywhere in the walk (code-style §Functions).
- The parsers, `copyVariableAttackEntry`, `parseEligibleCostList` and the marker regexes are not edited.
- Not edited: `buildInitialGameState.ts`, `types.ts`, `rules/villainAbility.types.ts`, `economy/**`, the overlay script, `data/cards/**`.
- No existing test is edited. The hash oracles (`PRE_WP080_HASH`, the sentinel, every `finalStateHash` pin) are not re-pinned. STOP if one moves.
- The table fold is declined (D-24855). Do not touch `G.villainAttackPerCaptured` or its types.

## Required `// why:` Comments
- `listSelectedVillainCards`, verbatim: "WP-898 / D-24855 — the one setup registry walk for every per-villain marker table (formerly five copies, D-24774 §9 / D-24771). It returns data, not a callback (code-style: no higher-order functions); first-valid-line-wins stays in each builder because it is per-table semantics."
- The T7 golden: a failure means a setup table changed (replay-relevant), never a re-pin.
- The `abilityLines` filter: non-string lines were skipped by every builder, so dropping them here is identical.
- The per-copy fan-out in each builder keeps its existing D-13502 no-aliasing `// why:`.

## Files to Produce
- Engine **modified**: `packages/game-engine/src/setup/villainDefeatRequirement.setup.ts`
- Engine **new**: `packages/game-engine/src/setup/villainDefeatRequirement.enumerator.test.ts`
- Governance close: `docs/ai/post-mortems/01.6-WP-898-villain-setup-walk-fold.md` (**new**, mandatory: new abstraction), `DECISIONS.md` (D-24855), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md` (`; LANDED YYYY-MM-DD`)

## After Completing
- [ ] T1-T8 pass (+8 engine tests). The existing setup and shape tests pass unmodified.
- [ ] The post-edit digest equals the pre-edit digest; both are recorded in the commit body.
- [ ] AC 4 `Select-String` (WP Verification Step 4; the `isRegistryReader` `typeof candidate.getSet` check is an allowed hit): only `listSelectedVillainCards` calls `getSet` / `parseQualifiedId` / `findVillainGroupCards` / `villainCardInstanceExtIds`.
- [ ] `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail. Allowlist-only diff.
- [ ] Five revert proofs observed: the abilities guard; the string filter; first id only; reversed group order; a cached array.
- [ ] Two-commit topology: `EC-936:` then `SPEC:`.
- [ ] 01.6 post-mortem written. D-24855 Active: the enumerator; the byte-identity proof; the table fold declined, with the exposure count and the sixth-source cost; the Assumes 11 walks named (supersedes D-24774 §8-9 and D-24771 §3's fold follow-up).
- [ ] STATUS.md states "No user-observable change — infrastructure only"; L897 "(Fold)" follow-up resolved.
- [ ] WORK_INDEX `[x]` with the Done date, the `EC-936:` commit, engine totals before → after, both digests and the T7 pin, ending ` [live-verify: n/a]`; EC_INDEX Done; mindmap `✅`; `pnpm roadmap:counts:write`.
- [ ] Each exits 0: `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check`, `workindex:liveverify:check`.

## Common Failure Smells
- The digest differs while the counts match → key insertion order changed (group or card loop reordered).
- T8 fails → the fan-out reused one entry object, or `abilityLines` / ids were cached across calls.
- An existing mock test throws → the enumerator lost the `isRegistryReader` guard, so a narrow mock reached `getSet`.
- A shape-test or replay hash moved → a table changed. This is never a re-pin; find the divergence.
