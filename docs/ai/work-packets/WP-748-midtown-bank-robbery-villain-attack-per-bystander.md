# WP-748 — Midtown Bank Robbery family: each Villain gets +1 attack for each Bystander it has (Engine)

**Status:** Draft 2026-09-22 (EC-785; D-24572 reserved) — **BLOCKED on WP-750** (client `fightCost` gating; reserved, not yet drafted)
**Primary Layer:** Game Engine (`packages/game-engine/src/economy/economy.resolve.ts` + tests)
**Dependencies:** **WP-750 / EC-787 (hard, sequencing — arena-client Fight gating and City tile cost read `UICityCard.fightCost`; reserved #2300, not yet drafted) — must be `[x]` in WORK_INDEX before this WP's execution session starts (EC-785 Before Starting STOPs otherwise); it reads the existing projection and needs nothing from this WP**; WP-214 (`resolveFightCost` is the single fight-cost authority) ✅, WP-539 / D-24348 (the scheme-gated fight-cost bonus pattern, Portals) ✅, WP-508 / D-24314 (Midtown carry-away loss) ✅
**User-Visible Surface:** play.legendary-arena.com (whether a fight succeeds, the bot ally's fight choices, the `city[i].fightCost` projection visible in Play Diagnostics)
**Baseline:** `origin/main` @ `3b879f71`

---

## Goal

As a player in Midtown Bank Robbery (or its co2e / msp1 reprints), I want every
Villain to get +1 attack for each Bystander it holds, as the scheme's Special
Rules say. Then a hostage-laden villain is actually harder to fight, and I can't
defeat it with its printed attack alone.

---

## User-Visible Impact

Three schemes print the Special Rule *"Each Villain gets +1[icon:attack] for each
Bystander it has."*:

| Scheme ext_id | Name |
|---|---|
| `core/midtown-bank-robbery` | Midtown Bank Robbery |
| `co2e/bank-robbery-hostage-crisis` | Bank Robbery Hostage Crisis |
| `msp1/destroy-the-cities-of-earth` | Destroy the Cities of Earth! |

The engine ignores the rule. `resolveFightCost` has scheme bonuses only for
Killbots and Portals.

**Observed live (2026-09-22, match `PaT5TygrTPQ`, 2p Red Skull / Midtown):**
- On turn 19 the bot ally defeated HYDRA Kidnappers (printed 3) with 3 attack.
- The Kidnappers held 3 Bystanders, so the real cost was 6.
- The Leader escaped holding 6 Bystanders, which would have made it a
  10-attack villain.
- The PAR calibration page (`wiki/par-simulation-calibration.md:557`) already
  flags `midtown-bank-robbery :: red-skull :: hydra` as **too easy (100%)**.
  This missing rule is one cause.

After this WP:
- A Villain's fight cost under these three schemes is its resolved cost plus the
  number of Bystanders in `G.attachedBystanders[villainId]`.
- Because `resolveFightCost` is the single authority, the change reaches three
  places at once:
  - the fight move gate (`fightVillain.ts:140`)
  - the bot's legal moves (`simulation/ai.legalMoves.ts:890`)
  - the `city[i].fightCost` projection (`ui/uiState.build.ts:782`, passed
    through the audience filter at `uiState.filter.ts:98`)

**Known client gap (pre-existing, not fixed here).** The arena-client never
reads `fightCost` in production code.
- `CityRow.vue:98` gates Fight with `canFight(cell.card.display)`.
- `useCardCostGating.ts:80–97` compares available attack to `display.cost`,
  which is the **printed** `vAttack` (`buildCardDisplayData.ts:493`).

Shipped alone, this WP would leave a Midtown villain holding Bystanders showing
its printed cost, with the Fight button enabled at printed attack and the engine
silently refusing. The same gap already affects dynamic `N+` villains,
Portals, Killbots and Skrulls today. The fix is **WP-750** (reserved):
switch the Fight gating and the tile cost to `UICityCard.fightCost`.

**WP-750 must merge first.** Under Midtown every twist hands the Bank villain two
hostages, so shipping this engine change alone would turn a rare gap into a
frequent enabled Fight button that silently does nothing. WP-750 is app-layer
only, so it stays out of this engine WP (Layer Boundary).

---

## Assumes

All verified at baseline `3b879f71`:

- **Prior packets.**
  - WP-750 / EC-787 is `[x]` in WORK_INDEX. This is a hard sequencing
    prerequisite checked at execution time; it is not true at draft, and
    EC-785 STOPs otherwise.
  - WP-214, WP-539 / D-24348 and WP-508 / D-24314 are complete.

- **Single authority.** `resolveFightCost(G, villainCardId)`
  (`economy/economy.resolve.ts:47–55`) returns
  `resolveBaseFightCost + darkPortalVillainBonus`.
  - Its production consumers are exactly `fightVillain.ts:140`,
    `ai.legalMoves.ts:890` and `uiState.build.ts:782`, verified by grep.
  - The only other production addition to a City villain's fight cost is the
    Patrol keyword modifier. Both gate sites (`fightVillain.ts:141`,
    `ai.legalMoves.ts:891`) add it on top of `resolveFightCost`, and this WP's
    bonus stacks under it unchanged.
- **Bystander storage.** Villain-held Bystanders live only in
  `G.attachedBystanders: Record<CardExtId, CardExtId[]>` (`types.ts:2196`),
  keyed by the villain's zone-instance ext_id. The Midtown twist writes there
  too.
  - Mastermind-held Bystanders sit under `G.attachedBystanders[baseCardId]`
    (`fightMastermind.ts:359`) and `G.mastermind.attachedBystanders`
    (`defeatChoice.resolve.ts:114`).
  - The Mastermind is not a Villain, and its cost comes only from
    `resolveMastermindFightCost`, which this WP does not touch.
- **Scheme id.** `G.selection.schemeId` carries the set-qualified ext_id (the
  Portals gate compares `'core/portals-to-the-dark-dimension'`).
  - A card-data scan of all 41 sets finds exactly the three ids above with this
    Special Rule.
  - The two Killbots schemes and msp1's "Replace Earth's Leaders with HYDRA" set
    a Bystander-Villain's attack by other means; they are not this rule.
- **Henchmen are Villains.** Henchmen sit in `G.city` and resolve through the
  same function, so they get the bonus too. That matches the rule, since
  henchmen are Villains.
- **Printed-attack readers stay printed.** Pure Fury's
  `getPrintedAttackForDefeatTarget` (`hero/heroEffects.execute.ts:3850`)
  deliberately reads the printed attack (D-24499), so it is unaffected.
- **Test fixtures tolerate a missing map.** Several `economy.resolve.test.ts`
  fixtures (e.g. `makePortalsG`) build `G` without `attachedBystanders`, so the
  new helper must read `G.attachedBystanders?.[villainCardId]`.
- **Empirical scaffold** (draft session on `aab4dd37`, the helper as specified,
  optional-chained; engine suite re-run by pre-flight on `3b879f71`: 4124/0):
  - `pnpm -r --no-bail test` has **zero failures in every package**. No
    existing test pins the missing bonus.
  - Note: the Portals and Mastermind tests use `core/midtown-bank-robbery` as
    their non-Portals scheme with no `attachedBystanders` map. They pass only
    because of the optional chaining.
  - `sim:coverage --check` and `sim:runtime-observed:check` both exit 0.
  - The sentinel `finalStateHash` and `PRE_WP080_HASH` are unchanged.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `economy/economy.resolve.ts` (whole file, 203 lines): the WP-214 authority,
  the Portals wrapper (`darkPortalVillainBonus`, the precedent for a
  scheme-gated additive bonus), `resolveBaseFightCost`.
- `economy/economy.resolve.test.ts` L244+ (the Portals describe block to mirror).
- `moves/fightVillain.test.ts` L35–137 (`createMockGameState` already seeds
  `selection` and `attachedBystanders`).
- `docs/ai/DECISIONS.md` D-24348 (Portals scheme bonus), D-24314 (Midtown
  carry-away), D-24499 (printed-attack readers).

**Interaction with WP-747.** WP-747 changes which villain holds a Bystander,
and this WP's bonus reads that count. Each was scaffolded alone. Whichever lands
**second** re-runs the hash oracles, `sim:coverage --check` and
`sim:runtime-observed:check` on the merged tree before its govern-close. That
includes the case where the other lands mid-session: check at rebase, before the
`EC-785:` commit.

**Why a separate WP from WP-747.** WP-747 fixes a universal capture rule. This WP
fixes one family of scheme special rules. They touch disjoint code files and are
**parallel-safe**. In play they compound: under Midtown, WP-747 puts hostages on
the villain nearest the Villain Deck, and this WP makes that villain harder.

**Replay posture.** As with any gameplay-fidelity fix, re-executing a
Midtown-family match recorded before this change can differ. Stored scores are
not recomputed.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English
  words, JSDoc on every function, `// why:` on non-obvious choices, no
  `.reduce()`.
- Pure helper: no `boardgame.io` import, no randomness, no I/O.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and
ask.

**Packet-specific:**
- **One bonus, one site.** Add a private helper beside
  `darkPortalVillainBonus` and add its result in `resolveFightCost`. Never
  duplicate the bonus in `fightVillain`, `ai.legalMoves`, or `uiState.build`.
- **Villains only.** `resolveMastermindFightCost` is unchanged.
- **Count, not identity.** The bonus is the array length. No per-Bystander
  lookup.
- **No new `G` field, move, effect, canonical array or UIState field.** The City
  tile's existing `fightCost` projection carries the change, so the
  Board-Visible Field 5-step does not apply.
- **Tests earn green.** No existing test is edited. The scaffold broke none.
- **Determinism:** verify the sentinel `finalStateHash` and `PRE_WP080_HASH`
  at execution. The scaffold says neither moves. If either moves, STOP and
  confirm the fixture plays a Midtown-family scheme before any honest re-pin.
  Never edit a pin to force green.

---

## Scope (In)

### A) `economy/economy.resolve.ts` (**modified**)
- Add a module constant
  `VILLAIN_ATTACK_PER_BYSTANDER_SCHEME_IDS: ReadonlySet<string>` holding the
  three ext_ids, with a `// why:` naming the Special Rule and the three sets.
  The comment names the sets **in prose** (core Midtown, co2e Hostage Crisis,
  msp1 Destroy the Cities) and never repeats an ext_id, which keeps the
  exactly-one-match grep exact.
- No comment or JSDoc may write the helper in call form, i.e. with its
  parenthesized arguments. Refer to it by bare name, so the call-site grep
  matches only the `resolveFightCost` return.
- Add a private function `bystanderVillainAttackBonus(G, villainCardId): number`:
  - It returns `0` unless the set has `G.selection?.schemeId`.
  - Otherwise it returns `G.attachedBystanders?.[villainCardId]?.length ?? 0`.
  - JSDoc required.
- `resolveFightCost` returns
  `resolveBaseFightCost(G, id) + darkPortalVillainBonus(G, id) + bystanderVillainAttackBonus(G, id)`.
  - Update its `// why:` so the "scheme bonuses stack on the resolved cost"
    rationale covers both bonuses.
  - Update the file header / JSDoc sentence that lists what the resolver adds.

### B) `economy/economy.resolve.test.ts` (**modified**; new describe block)
- `core/midtown-bank-robbery`: a static 3-cost villain with 2 attached
  Bystanders resolves to 5; with none, 3.
- `co2e/bank-robbery-hostage-crisis` and `msp1/destroy-the-cities-of-earth`
  each apply the same +N.
- A non-family scheme (e.g. `core/legacy-virus-the`) with 2 attached
  Bystanders resolves to 3 (no bonus).
- A dynamic `N+` villain with a captured hero and 1 Bystander under Midtown
  resolves to base + hero cost + 1 (the bonus stacks on the dynamic
  resolution).
- A `G` without an `attachedBystanders` map under Midtown resolves to the base
  (no throw).
- **Mastermind isolation.** Under `core/midtown-bank-robbery`, with
  `G.attachedBystanders[<mastermind baseCardId>]` holding 2 Bystanders,
  `resolveMastermindFightCost` equals its value with an empty map.

### C) `moves/fightVillain.test.ts` (**modified**; new describe block)
- **Fixture pattern (locked).**
  - `createMockGameState` hardcodes `schemeId: 'test-scheme'` and
    `attachedBystanders: {}`, and `selection` is `readonly`. Build
    `{ ...base, selection: { ...base.selection, schemeId: 'core/midtown-bank-robbery' } }`
    and assign `attachedBystanders` after construction.
  - The helper itself is **not** edited. `'test-scheme'` is the control
    scheme.
- Under `core/midtown-bank-robbery`, a 3-cost villain holding 3 Bystanders:
  - With 3 available attack, `fightVillain` leaves it in the City and spends
    nothing.
  - With 6, it is defeated, its 3 Bystanders are rescued, and exactly 6 attack
    is spent (0 available afterwards).
- Under a non-family scheme, 3 attack defeats the same villain (control).

---

## Out of Scope

- **No Mastermind bonus.** The rule says "Villain".
- **No other Midtown-family text.** The Bank twist, the carry-away loss and the
  co2e/msp1 twist variants are unchanged. Wiring co2e/msp1 twist resolvers is a
  separate WP if they are unwired.
- **No change to printed-attack readers** (Pure Fury, D-24499).
- **No bystander-captor change.** That is WP-747.
- **No per-card Bystander bonuses.** Villains that print their own "+N attack
  for each Bystander he/she has" (co2e Baron Zemo and Enchantress, msp1 Raza,
  dkcy Blockbuster / Chimera / Scalphunter, 2099 Jigsaw) are a separate rule.
  If implemented, they must stack additively with this scheme bonus in
  `resolveFightCost`.
- **No client change.** Switching the Fight gating and the tile cost to
  `UICityCard.fightCost` is WP-750, the hard prerequisite that must be `[x]`
  before this WP starts.
- **No PAR profile re-pin.** `data/par/profile/v1/**` is a derived,
  non-CI-gated diagnostic. It is re-pinned by a separate `INFRA:` regeneration
  after this WP (and WP-747) land (#2297 precedent). Seed PAR
  (`data/par/seed/**`) is ratings-derived and write-once, so it is untouched. Any
  Midtown difficulty recalibration is an authoring decision, not this WP.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/economy/economy.resolve.ts` — **modified** — scheme-id set + `bystanderVillainAttackBonus` + wiring in `resolveFightCost`
- `packages/game-engine/src/economy/economy.resolve.test.ts` — **modified** — per-scheme, control, dynamic-stack and missing-map cases
- `packages/game-engine/src/moves/fightVillain.test.ts` — **modified** — fight gate refuses at printed attack, allows at bonus attack; control scheme

No other files may be modified in the `EC-785:` commit (3 files). The
govern-close `SPEC:` commit edits STATUS, DECISIONS (D-24572 Active),
WORK_INDEX, EC_INDEX and the mindmap.

---

## Contract

- **`resolveFightCost(G, villainCardId)`** now equals
  `resolveBaseFightCost + darkPortalVillainBonus + bystanderVillainAttackBonus`.
- **`bystanderVillainAttackBonus`** equals the number of Bystanders attached to
  that villain when `G.selection.schemeId` is one of the three family ids, and
  `0` otherwise. It is private, not exported.
- **Consumers are unchanged.** The fight move, bot legal moves and City
  `fightCost` projection read the same function.

---

## Vision Alignment

- **Vision clauses touched:**
  - §1 Rules Authenticity (the printed Special Rule)
  - §3 Player Trust & Fairness (the engine fight gate matches the printed rule)
  - §8 Deterministic Game Engine
  - §20 PAR-Based Scenario Scoring and §26 Simulation-Calibrated PAR
    Determination (Midtown scenarios stop being artificially easy)
  - §22 Deterministic & Reproducible Evaluation (previously recorded
    Midtown-family matches may replay differently)
  - NG-1
- **Conflict assertion:** No conflict.
- **Non-Goal proximity:** NG-1..8 are not crossed. No purchasable or cosmetic
  input touches fight cost.
- **Determinism:** deterministic. A pure count, no RNG. Replays of previously
  recorded Midtown-family matches may diverge, which is the standing
  gameplay-fidelity posture.

## Funding Surface Gate

N/A — engine rule only; no funding affordance.

## API Catalog

N/A — no `apps/server` endpoint or `Library-only` function changes.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] Under each of the three family schemes, a villain holding N Bystanders
  resolves to its prior cost + N.
- [ ] Under a non-family scheme, attached Bystanders add nothing.
- [ ] The bonus stacks on a dynamic (`N+`) villain's resolved cost.
- [ ] A `G` with no `attachedBystanders` map resolves without throwing.
- [ ] Under Midtown, `fightVillain` refuses a 3-cost villain holding 3
  Bystanders at 3 attack and defeats it at 6, spending exactly 6. The control
  scheme defeats it at 3.
- [ ] Under Midtown, Bystanders attached under the Mastermind's key do not
  change `resolveMastermindFightCost` (test).
- [ ] `resolveMastermindFightCost` is unchanged (`git diff` shows no edit to
  it).
- [ ] The sentinel `finalStateHash` and `PRE_WP080_HASH` are unchanged, or were
  re-pinned honestly with the evidence recorded.
- [ ] `pnpm -r build` exits 0. The engine suite is green at baseline + the new
  cases, with counts recorded in the commit body. `sim:coverage --check` and
  `sim:runtime-observed:check` exit 0. The `EC-785:` diff is exactly the 3
  files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
# Expected: exit 0; the new resolve + fightVillain cases pass

pnpm sim:coverage --check
pnpm sim:runtime-observed:check
# Expected: both exit 0

Select-String -Path "packages\game-engine\src\economy\economy.resolve.ts" -Pattern "core/midtown-bank-robbery","co2e/bank-robbery-hostage-crisis","msp1/destroy-the-cities-of-earth"
# Expected: exactly one match per id (the set literal; the // why: names the sets in prose)

Select-String -Path "packages\game-engine\src\economy\economy.resolve.ts" -Pattern "bystanderVillainAttackBonus\(G, villainCardId\)"
# Expected: exactly one match (the resolveFightCost call site)

git diff --name-only
# Expected (implementation commit): exactly the 3 files above
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **Live verification (D-24026), on play.legendary-arena.com:**
  1. Start a Midtown Bank Robbery match (`POST /api/match/autoplay` with
     `setupData`, or a live match).
  2. Wait for a City villain holding N ≥ 1 Bystanders.
  3. Confirm that villain's `city[i].fightCost` = printed + N in the Play
     Diagnostics `uiStateSnapshot`, and that it is not defeated at printed attack
     (the Fight control is disabled, and the bot ally does not fight it below
     printed + N).
  4. The tile shows `fightCost` (printed + N) through WP-750, and the Fight
     control stays disabled at printed attack.
- [ ] `docs/ai/STATUS.md` updated, with the live observation.
- [ ] All acceptance criteria pass.
- [ ] No files outside `## Files Expected to Change` are modified in the
  `EC-785:` commit.
- [ ] `docs/ai/DECISIONS.md`: D-24572 landed Active.
- [ ] `WORK_INDEX.md` WP-748 is `[x]`, and `EC_INDEX.md` EC-785 is Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then
  `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

---

## Reserved Decision (lands at execution)

- **D-24572 (reserved; Drafted 2026-09-22): the Midtown Bank Robbery family's
  "+1 attack for each Bystander it has" is applied in `resolveFightCost`.**
  - The schemes are `core/midtown-bank-robbery`,
    `co2e/bank-robbery-hostage-crisis` and `msp1/destroy-the-cities-of-earth`.
  - The bonus is added to every City villain's resolved cost (static or
    dynamic, henchmen included) and equals `G.attachedBystanders[villainId].length`.
  - It is not applied to the Mastermind, and not applied to printed-attack
    readers (D-24499).
  - It is the second scheme-gated additive bonus, after Portals (D-24348), in
    the single fight-cost authority (WP-214).

---

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-22), conditional on WP-750 being `[x]`**, after
in-place text fixes by an independent reviewer. The prototype on `3b879f71` ran
the engine at 4124/0.

- **PS-1 (applied):** the arena-client gates Fight on printed `display.cost`
  and never reads the projected `fightCost`. The UI claims were narrowed, the
  known client gap is documented, and the fix was split out as WP-750.
- **RS-1..6 applied:**
  - ids named in prose in the `// why:`
  - the locked `fightVillain.test.ts` fixture spread
  - baseline 4124
  - the Mastermind storage wording
  - the file length
  - per-card "+N per Bystander" villains out of scope

## Copilot Check (01.7)

**Round 1: RISK/HOLD.** Fixes applied:
- #2: mid-session WP-747 rebase re-check.
- #9/#29/#30: WP-750 reserved (#2300) and made a hard prerequisite, with STOP
  gates in the Status line, the WORK_INDEX row and the EC.
- #11: Mastermind-isolation and exact-spend tests.
- #12: no call-form helper spelling in comments.

**Round 2: RISK.** Three stale sentences contradicted "WP-750 first", and the WP
and EC disagreed on when WP-750 must be done. Fixed in place. The reviewer's
stated outcome once applied is **PASS**. Depending on a reserved-but-undrafted
WP is judged acceptable under 01.0a "Blocking drafts".

## Lint Gate Self-Review (00.3)

**PASS (2026-09-22)** after one fix, by an independent reviewer.
- §17 had FAILed: a vision clause was cited by name instead of number. It now
  cites §1, §3, §8, §20/§26, §22 and NG-1.
- Two accuracy fixes applied:
  - Patrol is named as the other fight-cost addition at both gate sites.
  - The live DoD step no longer asks for a fight the WP-750 client would
    disable.
- The prior-packets bullet was added to Assumes.
- Every other section is PASS or N/A with justification (§10 env, §11 auth).

---

## See Also

- WP-214 — `resolveFightCost` single authority
- WP-539 / D-24348 — Portals scheme-gated fight-cost bonus (the pattern mirrored)
- WP-508 / D-24314 — the Midtown carry-away loss
- WP-747 — the Villain-Deck Bystander captor rule (parallel-safe sibling)
