# WP-799 — Printed Hero Deck counts: one scheme hero-count table for `resolveEffectiveHeroCount` (24 new rules, 26 rows)

**Status:** Draft 2026-10-08 · **EC:** EC-836 · **Reserves:** D-24672 (reserve PR #2642)
**Primary Layer:** Registry (source of truth). Every enforcement surface already reads the resolver.
**User-Visible Surface:** cards.legendary-arena.com loadout builder and preview, play.legendary-arena.com lobby and
`Game.setup`, gauntlet "Play this leg" (through WP-798)
**Lane:** standard two-session (a validation-tightening change to the per-scheme hero-count requirement across 24
schemes — NOT lightweight-eligible: competitive surface, a D-entry that locks a future-facing table)
**Baseline:** `origin/main` @ `3fbb03f3` (2026-10-08)
**Depends on:** WP-798 (gauntlet per-leg hero count) — must be Done first

## Goal

Twenty-six schemes print a Hero Deck size other than the per-player-count table: "Add an extra Hero", "6 Heroes",
"7 Heroes", "8 Heroes in Hero deck", "4-5 Players: Add another Hero", "1 player: 5 Heroes", "For exactly 2 players:
Use 4 Heroes", and so on. Today only two of them are enforced (core Secret Invasion, D-24337; core Super Hero Civil
War at 2p, D-24385), because `resolveEffectiveHeroCount` hard-codes those two scheme ids. This packet adds the other
24 as table rows.

After this packet, `resolveEffectiveHeroCount` reads one table, `SCHEME_HERO_COUNT_RULES`, holding all 26 printed
Hero Deck count rules (the 24 new ones plus the two existing ones). Every surface that already calls the resolver —
the registry composition check, `Game.setup`, the setup-requirements projection (the play lobby), the loadout
builder and its preview, and (after WP-798) the gauntlet per-leg pick count — then requires the printed count. The
base count is rejected for these schemes, exactly like WP-796's Henchman rule.

## User-Visible Impact

- **Loadout builder (cards):** e.g. a 2-player Annihilation: Conquest loadout shows "6 heroes" and blocks export with
  5; a Go Back in Time to Slay Heroes' Ancestors loadout needs 8 at every player count. Every other scheme is
  unchanged.
- **Play lobby:** the requirement line and the create gate follow the same counts (projection-driven, no client
  change).
- **Match:** the Hero Deck holds the printed number of Heroes (14 cards each), e.g. 7 × 14 = 84 cards for
  Star-Lord's Awesome Mix Tape.
- **Gauntlet:** each affected leg asks for, launches with and qualifies on the printed count (WP-798 makes the per-leg
  pick count follow the resolver). Through D-24671, 16 sets' fixed-division budgets rise (never fall), at 1/2/3/4/5
  players: msp1, bkwd, dkcy, rvlt 8; co2e, 2099, shld, wpnx 6/8/8/8/9; cosm 7/8/8/8/9; mdns 7/9/9/9/10; antm
  5/7/7/8/9; cvwr, chmp, wwhk, mgtg 9; ca75 10. dead and every other set are unchanged.

## Assumes

- **WP-370 / D-24165 ✅** — `PLAYER_COUNT_SETUP` + `getPlayerCountSetup` + `checkPlayerCountComposition` in
  `packages/registry/src/playerCountSetup.ts` (:46–72, :226–273).
- **WP-524 / D-24337 ✅ and WP-576 / D-24385 ✅** — `resolveEffectiveHeroCount(schemeId, numPlayers, baseHeroCount)`
  (`playerCountSetup.ts` :74–141) with the two hard-coded overrides: `SECRET_INVASION_SCHEME_ID` →
  `Math.max(base, 6)` (:75, :82, :129–131) and `CIVIL_WAR_SCHEME_ID` → 4 at exactly 2 players (:85, :94, :137–139).
- **Every surface already calls the resolver** (verified at baseline; no code change needed there):
  - `checkPlayerCountComposition` (`playerCountSetup.ts`, the hero check);
  - the engine `validatePlayerCountComposition` through the optional structural `CardRegistryReader` member
    (`packages/game-engine/src/matchSetup.validate.ts` :74, :535), carried by both registry impls
    (`impl/localRegistry.ts` :205, `impl/httpRegistry.ts` :184) as a required `CardRegistry` member
    (`types/index.ts` :239);
  - the server setup-requirements projection (`apps/server/src/match/matchGate.routes.ts` :227);
  - the viewer required row and preview (`apps/registry-viewer/src/composables/useLoadoutDraft.ts` :533,
    `apps/registry-viewer/src/lib/previewSetupRequirement.ts` :69).
- **WP-798 (EC-835 / D-24671)** — gauntlet runs size each leg's hero pick by the resolver, and the fixed-division
  pool budget is `max(base, largest leg count) + 2` per gauntlet. Without it, a leg whose scheme gains a hero would
  ask for the base count and fail `Game.setup`. **Hard dependency.**
- **WP-796 / D-24666 ✅** — the Henchman sibling; this packet follows its strict-requirement shape.
- **Engine build side** — the Hero Deck is built from every configured `heroDeckIds` entry (14 cards per Hero). The
  only build-side hero sizing is `resolveEffectiveHeroDeckIds` (`packages/game-engine/src/setup/schemeSetupSizing.ts`
  :19–97, `resolveEffectiveHeroDeckIds` :81–97), core Civil War only, which slices a 5-hero 2p deck to 4; once the
  requirement is 4 that slice is a no-op for valid configs. Nothing else in the engine reads a hero count from the scheme.
- **Determinism** — no `G` field changes; the sentinel replay fixture plays `core/legacy-virus-the` (unlisted).
- **Card data** — `data/cards/<set>.json` carries all 26 scheme slugs in the table (26/26 present at baseline); the
  new fail-loud test reads it the way `packages/registry/src/gauntletConfigs.test.ts` does (:64, :410).
- **Reservation** — WP-799 / EC-836 / D-24672 are reserved by PR #2642 (open at draft time). It must be merged to
  `origin/main` before execution; EC-836 Before Starting gates it.
- **Scaffold (01.4 §Empirical Scaffold, run 2026-10-08 at `3fbb03f3`):** the 24-scheme table was patched into
  `resolveEffectiveHeroCount` in a throwaway worktree; `pnpm -r build` exited 0 and `pnpm -r --no-bail test` plus
  `node --import tsx --test scripts/*.test.ts` reported **0 failures in every package** (registry 281, game-engine
  5011, server 1663 / 1457 pass, registry-viewer 326, arena-client 2297, dashboard 570, legends-board 135,
  engine-runner 20, preplan 52, lagn-spec 107, vue-sfc-loader 11, replay-producer 4, scripts 105). **No existing
  test needs an edit.**

## Context (Read First)

**Rules.** The scheme's Setup text is the requirement. A Hero is the usual 14 cards. Operator rulings (Jeff,
2026-10-08):
- **Wager at Blackjack for Heroes' Souls** ("And two extra Heroes"): both go into the Hero Deck → base + 2.
- **Star-Lord's Awesome Mix Tape** ("Use 7 Heroes"): the Hero Deck is 7 Heroes × 14 = 84 cards → exactly 7. Its other
  clause — double the Villain and Henchman groups, shuffle, discard half of each group's cards, and put the rest in
  the Villain Deck (1 player: 2 Henchmen per group) — is Villain-Deck build work and a named follow-up packet.

**Why strict.** Same as D-24337 / D-24666: the operator must supply the printed count, and the base count is
rejected. Reprints that the hard-coded ids missed (msp1 Enslave Minds with the Chitauri Scepter = Secret Invasion's
"6 Heroes"; co2e and msp1 Super Hero Civil War = "4 at 2 players") are fixed by the same table.

**Why a table, not more `if`s.** Twenty-six rules in three shapes. One closed, drift-pinned table keeps "one
definition" (D-24337 §2) honest and makes the next printed rule a data row.

**What is NOT a count (out of reach of this packet, named follow-ups):**
- an extra Hero kept **outside** the Hero Deck (set aside, shuffled into the Villain Deck, a separate stack):
  amwp Auction Shrink Tech to Highest Bidder, antm Trap Heroes in the Microverse, dkcy X-Cutioner's Song, mdns
  Midnight Massacre, rlmk Ruin the Perfect Wedding, shld Secret Empire of Betrayal, ssw2 The Mark of Khonshu, wtif
  Marvel Zombies, wwhk Mutating Gamma Rays, wwhk Shoot Hulk into Space, xmen The Dark Phoenix Saga, cosm Turn the Soul
  of Adam Warlock, msmc Control the Mutant Messiah (an extra Hero in a "Mutant Messiah" stack), and House of M's
  Scarlet Witch cards;
- **msis The Time Heist** ("Use 4 Heroes in the Hero Deck, plus 4 other Heroes to make a 'Past Hero Deck'") prints a
  main Hero Deck of exactly 4, but is deliberately NOT a row: the 4 Past Heroes have no `MatchSetupConfig` home except
  `heroDeckIds` (9-field lock), so the Time Heist packet decides whether the requirement is 4 or 8. Until then it keeps
  the base count;
- **which** Heroes are allowed (Deadpool required, exactly one Nova Hero, two "Hulk" Heroes, House of M's 4 X-Men +
  2 others, Avengers vs. X-Men's 3 + 3 by Team, Star-Lord's "at least one Guardians" Hero) — identity validation;
- Star-Lord's group doubling (above);
- six hand-authored themes that would prefill one Hero short (AIM/MODOK, Annihilation: Conquest, Black Widow
  Espionage, Contest of Champions, Punisher MAX, and Age of Ultron at 4–5 players) and the Secret Invasion theme's
  existing gap — choosing the added Hero is a content decision. (`house-of-m.json`, 6 Heroes, becomes valid at every
  count.)

**Read:**
- `docs/ai/DECISIONS.md`: D-24165, D-24337, D-24338, D-24385, D-24328, D-24666, D-24671 (WP-798), D-24372,
  D-11804.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary; `.claude/rules/architecture.md`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §7 (`heroDeckIds`, `MatchSetupConfig` used verbatim; the 9-field
  composition lock is untouched).

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- No `Math.random()`, no I/O in moves or helpers. Moves never throw; only `Game.setup()` may throw.
- `G` stays JSON-serializable. No `G` field and no `MatchSetupConfig` field is added.
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test`. No `boardgame.io` import in helpers or tests.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full-word names, JSDoc on every function, no nested
  ternaries, no `.reduce()` with branching.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- No new npm dependencies; no `package.json` change.

**Packet-specific:**
- **Session protocol:** if anything here is unclear or contradicts the code at baseline, STOP and ask — never guess.
- **One definition.** `SCHEME_HERO_COUNT_RULES` lives ONLY in `packages/registry/src/playerCountSetup.ts`, and
  `resolveEffectiveHeroCount` is its only reader. The constants `SECRET_INVASION_SCHEME_ID`,
  `SECRET_INVASION_HERO_COUNT`, `CIVIL_WAR_SCHEME_ID` and `CIVIL_WAR_2P_HERO_COUNT` are removed; their two rules
  become table rows with **identical results** at every player count.
- **The resolver signature and every consumer are unchanged.** No edit to `matchSetup.validate.ts`,
  `matchGate.routes.ts` (code), `useLoadoutDraft.ts`, `previewSetupRequirement.ts`, the registry impls, `types/index.ts`
  or any arena-client file. If one turns out to need a CODE edit, STOP and report.
- **Requirement side, not build side.** No `schemeSetupSizing` change; `PLAYER_COUNT_SETUP` is never mutated.
- **Exactly the printed count.** A listed scheme with any other count is a mismatch. Every unlisted scheme is
  byte-identical to today.
- **Existing tests pass without edits** (scaffold-proven). Any failing existing test is STOP-and-report.
- **Sentinel / replay oracles unchanged.** The sentinel `finalStateHash` and `PRE_WP080_HASH` stay byte-identical.

## Locked Contract Values

- **Rule type and table** (`packages/registry/src/playerCountSetup.ts`), exported:

  ```ts
  export type SchemeHeroCountRule =
    | { readonly kind: 'add'; readonly amount: number; readonly fromPlayerCount: number }
    | { readonly kind: 'exact'; readonly count: number }
    | { readonly kind: 'exactAtPlayerCount'; readonly playerCount: number; readonly count: number };

  export const SCHEME_HERO_COUNT_RULES: Readonly<Record<string, SchemeHeroCountRule>> = { /* 26 rows below */ };
  ```

- **The 26 rows** (key = scheme ext_id; order in the source file is this table's order):

  | Scheme ext_id | Rule | Printed clause |
  |---|---|---|
  | `core/secret-invasion-of-the-skrull-shapeshifters` | `exact 6` | "6 Heroes" (D-24337, was `Math.max(base, 6)`) |
  | `core/super-hero-civil-war` | `exactAtPlayerCount 2 → 4` | "If only 2 players, use only 4 Heroes" (D-24385) |
  | `msp1/enslave-minds-with-the-chitauri-scepter` | `exact 6` | "6 Heroes" |
  | `msp1/super-hero-civil-war` | `exactAtPlayerCount 2 → 4` | "If only 2 players, use only 4 Heroes" |
  | `co2e/super-hero-civil-war` | `exactAtPlayerCount 2 → 4` | "For exactly 2 players: Use 4 Heroes" |
  | `co2e/secret-invasion-of-the-skrull-shapeshifters` | `add 1 from 1p` | "Add an extra Hero to the Hero Deck" |
  | `2099/subjugate-earth-with-mega-corporations` | `add 1 from 1p` | "Add an extra Hero" |
  | `2099/befoul-earth-into-a-polluted-wasteland` | `add 1 from 1p` | "Add an extra Hero" |
  | `cosm/contest-of-champions-the` | `add 1 from 1p` | "Add an extra Hero" |
  | `cosm/annihilation-conquest` | `add 1 from 1p` | "Add an extra Hero" |
  | `shld/hydra-helicarriers-hunt-heroes` | `add 1 from 1p` | "Add an extra Hero" |
  | `wpnx/go-after-heroes-loved-ones` | `add 1 from 1p` | "Add an extra Hero" |
  | `mdns/wager-at-blackjack-for-heroes-souls` | `add 2 from 1p` | "And two extra Heroes" (ruling: Hero Deck) |
  | `antm/age-of-ultron` | `add 1 from 4p` | "4-5 Players: Add another Hero" |
  | `bkwd/frame-heroes-for-murder` | `exact 6` | "6 Heroes" |
  | `dkcy/detonate-the-helicarrier` | `exact 6` | "6 Heroes in the Hero Deck" |
  | `rvlt/house-of-m` | `exact 6` | "Hero Deck is 4 X-Men Heroes and 2 non-X-Men Heroes" |
  | `cvwr/avengers-vs-x-men` | `exact 6` | "3 Heroes of one Team and 3 Heroes of another Team" |
  | `chmp/divide-and-conquer` | `exact 7` | "7 Heroes" |
  | `cvwr/reveal-heroes-secret-identities` | `exact 7` | "7 Heroes in Hero Deck" |
  | `wwhk/break-the-planet-asunder` | `exact 7` | "7 Heroes" |
  | `mgtg/star-lords-awesome-mix-tape` | `exact 7` | "Use 7 Heroes" (ruling: 84-card Hero Deck) |
  | `ca75/go-back-in-time-to-slay-heroes-ancestors` | `exact 8` | "8 Heroes in Hero deck" |
  | `dead/deadpool-kills-the-marvel-universe` | `exactAtPlayerCount 2 → 4` | "2 players: Use 4 Heroes total" |
  | `cvwr/epic-super-hero-civil-war` | `exactAtPlayerCount 1 → 4` | "1 player: 4 Heroes in Hero Deck" |
  | `cosm/destroy-the-nova-corps` | `exactAtPlayerCount 1 → 5` | "1 player: 5 Heroes" |

- **Resolver semantics:** look the row up with `Object.hasOwn(SCHEME_HERO_COUNT_RULES, schemeId)`, so a prototype key
  such as `constructor` resolves to the base count. After the guard, read `const rule =
  SCHEME_HERO_COUNT_RULES[schemeId]` and return `baseHeroCount` when `rule === undefined` (no non-null assertion;
  `noUncheckedIndexedAccess` is on). No row → `baseHeroCount`. `add` → `baseHeroCount + amount` when
  `numPlayers >= fromPlayerCount`, else base. `exact` → `count` at every player count. `exactAtPlayerCount` → `count` when
  `numPlayers === playerCount`, else base. Each kind is an explicit `if` on `rule.kind` (no nested ternaries).
  After the three `rule.kind` branches, the fall-through narrows `rule` to `never`; assert it with
  `const exhaustiveCheck: never = rule;` (the `campaign.logic.ts` :152 / `notableEvents.compose.ts` :408 precedent),
  then return `baseHeroCount`. Adding a fourth `SchemeHeroCountRule` kind without a branch fails the registry `tsc`
  build.
- **Effective counts the tests lock** (1p..5p, base 3/5/5/5/6): `add 1 from 1p` → 4/6/6/6/7; `add 2 from 1p` →
  5/7/7/7/8; `add 1 from 4p` → 3/5/5/6/7; `exact 6` → 6/6/6/6/6; `exact 7` → 7 ×5; `exact 8` → 8 ×5;
  `exactAtPlayerCount 2 → 4` → 3/4/5/5/6; `1 → 4` → 4/5/5/5/6; `1 → 5` → 5/5/5/5/6.
- **API catalog row** (`docs/ai/REFERENCE/api-endpoints.md`, `GET /api/match/setup-requirements`), replaced whole:
  Status `Wired`, Method `GET`, Auth `guest` (closed sets, unchanged); request and response schemas unchanged;
  Authorizing WP appends `WP-799 / D-24672 (scheme hero-count table)`; Notes say `heroCount` is projected through
  `resolveEffectiveHeroCount`, which reads the 26-row `SCHEME_HERO_COUNT_RULES` table (printed +N, exactly N and
  per-player-count Hero Deck rules), with the rest carried forward.
- **D-24672** is authored at execution as Active (six points in §D-24672 Content).

## Scope (In)

### A) Registry
- `playerCountSetup.ts`: `SchemeHeroCountRule`, `SCHEME_HERO_COUNT_RULES`, the table-driven
  `resolveEffectiveHeroCount`; the four constants removed; the resolver JSDoc rewritten for the table.

### B) Server catalog doc
- `docs/ai/REFERENCE/api-endpoints.md`: the setup-requirements row replaced whole (D-11804). No server code change.

### C) Tests
- **`playerCountSetup.test.ts`:**
  - a runtime drift pin (D-24372): `Object.keys(SCHEME_HERO_COUNT_RULES)` deep-equals the 26 locked ids in order;
  - every row's effective count at 1–5p against the locked per-kind sequences above (table-driven loop, expected
    values written out, never computed from the rule);
  - `checkPlayerCountComposition`: a 2p Annihilation: Conquest config with 5 heroes → one `heroDeckIds` mismatch
    (required 6); with 6 → none; a 1p Go Back in Time config with 3 → mismatch (required 8);
  - `constructor` and `__proto__` resolve to the base count (prototype-key guard; this test guards branch
    reordering, it is not a hasOwn revert proof);
  - every scheme id in the table exists in `data/cards/<set>.json` (fail-loud against a typo, reading the card data
    like `gauntletConfigs.test.ts` does);
  - the existing Secret Invasion and Civil War assertions stay unedited and green.
- **`apps/server/src/match/matchGate.routes.test.ts`:** `?schemeId=cosm/annihilation-conquest` projects `heroCount`
  4/6/6/6/7 and the base `henchmenGroupCount`.
- **`apps/registry-viewer/src/lib/previewSetupRequirement.test.ts`:** an 8-hero requirement for
  `ca75/go-back-in-time-to-slay-heroes-ancestors` at every player count.
- **Non-vacuous:** reverting each of these must fail at least one new test. Report 3/3: (a) the `add` branch, (b) the
  `exact` branch, (c) the `exactAtPlayerCount` branch.

## D-24672 Content (authored at execution, Status Active)

1. **A requirement override, strict, from one table.** A scheme's printed Hero Deck size is a requirement: exactly
   that many Heroes, the base count rejected. `SCHEME_HERO_COUNT_RULES` holds every printed Hero Deck count rule except
   The Time Heist (deferred, §4) in three kinds (`add` from a player count, `exact`, `exactAtPlayerCount`); 26 rows at landing.
2. **One definition.** The table lives in `playerCountSetup.ts`; `resolveEffectiveHeroCount` is its only reader and
   every enforcement surface (composition check, engine, setup-requirements projection, loadout builder and preview,
   gauntlet per-leg picks via D-24671) reads the resolver. D-24337's `Math.max(base, 6)` and D-24385's 2p 4 become
   rows with identical results.
3. **Operator rulings.** Wager at Blackjack's "two extra Heroes" go into the Hero Deck (+2). Star-Lord's Awesome Mix
   Tape uses 7 Heroes (84 cards); its double-groups / keep-half Villain Deck clause is a separate packet.
4. **Scope boundary.** Only the Hero Deck count. Extra Heroes kept outside the Hero Deck, which-Hero constraints
   (Team, name, required Hero) and Star-Lord's group doubling are named follow-ups. The Time Heist's 4 + 4 Past Hero
   Deck is a named follow-up.
5. **Gauntlet and PAR.** Approved gauntlet loadouts carry no heroes, so no menu, config or seed-PAR artifact changes.
   Per-leg hero picks and the pool budget follow the resolver through D-24671, raising 16 sets' fixed-division
   budgets (never lowering any). Existing scores on an affected leg that used the base count remain valid leg clears
   (`qualifiesAsLegClear` has no team-size check); a wider budget can newly qualify existing entries (D-24671 §3);
   nothing is re-scored. Execution runs a read-only production count of fixed-division-eligible entries on the 16
   affected gauntlets per player count (or hands Jeff the psql command) and records it here.
6. **No migration.** Matches in progress keep their setup. Saved loadouts and themes holding the old count are
   flagged when loaded, not rewritten; the six affected themes are a named content follow-up.

## Out of Scope

- Everything listed under "What is NOT a count" above.
- Any engine, server, arena-client or registry-viewer code; any `G` field; any `MatchSetupConfig` field.
- Theme content changes; seed-PAR or PAR-profile regeneration.

## Files Expected to Change

- `packages/registry/src/playerCountSetup.ts` — modified — table + table-driven resolver
- `packages/registry/src/playerCountSetup.test.ts` — modified — new cases (existing assertions untouched)
- `apps/server/src/match/matchGate.routes.test.ts` — modified — one projection case
- `apps/registry-viewer/src/lib/previewSetupRequirement.test.ts` — modified — one preview case
- `docs/ai/REFERENCE/api-endpoints.md` — modified — setup-requirements row replaced whole
- Governance:
  - `docs/ai/STATUS.md`
  - `docs/ai/DECISIONS.md` (D-24672 → Active)
  - `docs/ai/work-packets/WORK_INDEX.md`
  - `docs/ai/execution-checklists/EC_INDEX.md`
  - `docs/05-ROADMAP-MINDMAP.md`

No other files may be modified. Line-ending-only churn a build leaves in generated files (e.g.
`packages/lagn-spec/schemas/lagn-v1.json`) is reverted.

## Contract

- For each of the 26 listed schemes, every enforcement surface requires exactly the printed Hero Deck count at each
  player count. For every other scheme, nothing changes.

## Acceptance Criteria

1. `resolveEffectiveHeroCount` returns the locked per-kind sequences for every row at 1–5p, and the base count for an
   unlisted id and for `''`.
2. Core Secret Invasion returns 6 at 1–5p and core Civil War 4 at 2p / base elsewhere — identical to today.
3. `checkPlayerCountComposition` reports a `heroDeckIds` mismatch (required 6) for a 2p Annihilation: Conquest config
   with 5 heroes, and none with 6.
4. `GET /api/match/setup-requirements?schemeId=cosm/annihilation-conquest` returns `heroCount` 4, 6, 6, 6, 7.
5. The viewer preview for `ca75/go-back-in-time-to-slay-heroes-ancestors` requires 8 heroes at every player count.
6. The drift pin holds the 26 ids in order, and every id exists in the card data.
7. `pnpm -r --no-bail test` has 0 failures with no edit to an existing assertion; the sentinel `finalStateHash` /
   `PRE_WP080_HASH` are unchanged.
8. With the built registry dist, `max(base, largest leg count) + 2` over each set's listed schemes equals the 16-set
   list in §User-Visible Impact exactly, and every other set (including `dead`) stays 5/7/7/7/8; the computed table is
   recorded in the execution summary.

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0
pnpm -r --no-bail test
# Expected: 0 failures; record before/after counts per package
pnpm --filter registry-viewer typecheck
# Expected: exits 0
pnpm --filter @legendary-arena/game-engine exec node --import tsx --test "src/test/fixtures/replayFixtures.test.ts"
git diff --exit-code -- packages/game-engine/src/test/fixtures/games
# Expected: green; exits 0
node scripts/gauntlet-post-block.mjs ca75 arnim-zola
# Expected: Fixed-Pool budget 10 / 10 / 10 / 10 / 10
node scripts/gauntlet-post-block.mjs cosm grandmaster-the
# Expected: 7 / 8 / 8 / 8 / 9
node scripts/gauntlet-post-block.mjs dead evil-deadpool
# Expected: 5 / 7 / 7 / 7 / 8 (unchanged)
# AC8 full table (scratch, not committed): from the built registry dist, per set and n = 1..5,
# max(base, max over the set's schemes of resolveEffectiveHeroCount) + 2. Expected: exactly the 16-set list in
# §User-Visible Impact; every other set 5 / 7 / 7 / 7 / 8. Record the output.
pnpm ledger:numbers:check; pnpm roadmap:counts:write; pnpm roadmap:counts:check
# Expected: each exits 0
git grep -n "SCHEME_HERO_COUNT_RULES" -- apps packages ':!*.test.ts' ':!**/dist/**'
# Expected: matches only in packages/registry/src/playerCountSetup.ts
git grep -n -E "SECRET_INVASION_HERO_COUNT|CIVIL_WAR_2P_HERO_COUNT|SECRET_INVASION_SCHEME_ID|CIVIL_WAR_SCHEME_ID" -- packages/registry/src
# Expected: no matches
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All ACs pass. The 3/3 revert proofs are reported.
- [ ] `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. Registry-viewer typecheck is 0. Per-package
      before/after counts are recorded.
- [ ] The replay oracles are byte-identical, with no re-pin. `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED), after deploy:**
  - the cards loadout builder shows "6 heroes" for a 2p Annihilation: Conquest loadout and blocks export with 5;
  - the play lobby warns "A 2-player match needs 6 heroes — this loadout has 5." for that loadout after a hard
    refresh (`setup-requirements` is cached up to an hour);
  - a match created with 6 heroes plays, and its Hero Deck holds 6 Heroes;
  - a gauntlet leg on an affected scheme asks for and launches with the printed count (WP-798 path);
  - a ca75 gauntlet run shows 'Hero pool: N / 10 budget'.

  Record the matchId in STATUS.md.
- [ ] STATUS.md updated. D-24672 authored in DECISIONS.md as Active, with the six points.
- [ ] D-24672 §5 records the read-only fixed-division entry count for the 16 affected gauntlets (or the psql command
      handed to Jeff).
- [ ] WORK_INDEX WP-799 `[x]` with date. EC_INDEX EC-836 → Done. Mindmap `📝`→`✅`. `pnpm roadmap:counts:write`;
      `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:**
  - §1 / §2: faithful setup. Printed Hero Deck sizes now apply.
  - §3: fairness. A gauntlet leg's hero count is the printed one for every player.
  - §10a: Registry Viewer. The required row and export gate apply the printed count.
  - §19b: saved and exported loadouts with the old count are flagged on load, not rewritten (D-24672 §6).
  - §8 / §22: determinism. No `G` change; the sentinel scheme is unlisted.
  - §23 / §24: leaderboards and competitive integrity. Approved loadouts carry no heroes; per-leg picks follow D-24671.
  - None of NG-1..NG-8 is crossed.
- **Conflict assertion:** no conflict. Rules fidelity only; no monetization surface.

## Lint Gate Self-Review (00.3)

All 21 sections are satisfied or N/A. This was an independent subagent run: FAIL on §3 as drafted (Final Gate row 6 —
the card-data file dependency and the #2642 reservation were missing from Assumes), PASS after A1. Advisory edits
A1–A9 were applied before commit, and a delta re-check confirmed PASS with no Final Gate row firing.
- **§1 structure:** all required sections are present. Baseline `3fbb03f3` is cited.
- **§2 constraints:** engine-wide constraints (ESM, Node v22+, full files with no diffs or snippets, `00.6`, no new
  dependencies), packet-specific constraints with the session protocol and named STOP points (one definition,
  unchanged consumers, requirement side only, existing tests unedited, oracles unchanged), and the Locked Contract
  Values (rule type, the 26 ordered rows, resolver semantics with the `never` check, locked sequences, the API row).
- **§3 / §4:**
  - WP-370 / D-24165, WP-524 / D-24337, WP-576 / D-24385, WP-796 / D-24666 and the hard dependency WP-798 / D-24671
    are cited with verified line anchors. Also cited: every resolver consumer (all re-verified), the engine build side
    (`schemeSetupSizing.ts`), the card data the fail-loud test reads (26/26 slugs present), and the #2642 reservation
    (gated in EC Before Starting).
  - Also cited: the DECISIONS scan list (incl. D-24328, D-24372, D-11804), 00.2 §7 field names, ARCHITECTURE
    §Layer Boundary and `.claude/rules/architecture.md`.
- **§5 / §7:**
  - A closed allowlist: 5 registry / server-test / viewer-test / catalog files plus governance, each marked modified.
  - No new dependencies and no `package.json` change.
- **§6 naming:** `heroDeckIds`, `schemeId`, `ext_id`, `MatchSetupConfig` (9-field lock untouched) and the D-24165
  `heroCount` row field are canonical. The EC's per-kind lists match the 26 WP rows, and the source and drift-pin
  order is the WP table's.
- **§8 layer:** the registry is the single source; every consumer already reads the resolver (the engine through the
  existing structural `CardRegistryReader` member), and no consumer code changes. No `G` field and nothing persisted.
- **§9 Windows:** `pwsh` verification.
- **§10 / §11:** N/A — no environment variable; setup-requirements stays `guest` and no auth code is touched.
- **§12 tests:** `node:test`; the server test drives the route handler with no network or database; no boardgame.io;
  literal expectations, never computed from the rule; 3/3 revert proofs (`add`, `exact`, `exactAtPlayerCount`); the
  sentinel `finalStateHash` / `PRE_WP080_HASH` are pinned unchanged.
- **§13 / §14 / §15:**
  - exact commands with their expected output, including the `gauntlet-post-block.mjs` budget checks for AC8;
  - 8 binary ACs;
  - a DoD covering STATUS, DECISIONS (D-24672 Active, with the §5 entry count), WORK_INDEX, EC_INDEX, the mindmap and
    roadmap counts, the allowlist scope check and the D-24026 live verify on cards, play and the gauntlet (matchId
    recorded; the one-hour setup-requirements cache is noted).
- **§16 code style:** JSDoc, an explicit `if` per rule kind with a `never` exhaustiveness check, no nested ternaries,
  no branching `.reduce()`, data in a table rather than a helper, and the `// why:` list in the EC.
- **§17 Vision:** §1/§2/§3/§8/§10a/§19b/§22/§23/§24 touched; no NG-1..NG-8 crossing; the determinism line (no `G`
  change, sentinel scheme unlisted) and the leaderboard position (approved loadouts carry no heroes; budgets rise
  through D-24671; nothing re-scored; a read-only count of newly eligible entries is recorded, D-24672 §5) are stated.
- **§18:** the removed-constant grep is scoped to `packages/registry/src`; WP prose naming the constants lies outside
  it, and EC Guardrail 8 forbids naming them in new comments (cite the D-entries).
- **§19:** N/A — commit-time discipline.
- **§20 Funding:** N/A — the touched surfaces are the cards loadout builder, the play lobby requirement line and
  gauntlet "Play this leg". None is a navigation, viewer, profile or tournament funding affordance, and there is no
  donate/support copy.
- **§21 API Catalog:** triggered. `GET /api/match/setup-requirements` now projects the printed `heroCount` for 24 more
  schemes. Its `api-endpoints.md` row is replaced whole (D-11804) in the execution commit: Status `Wired`, Auth
  `guest` (closed sets, unchanged), schemas and field names unchanged, Authorizing WP gains WP-799 / D-24672, and Notes
  describe the 26-row `SCHEME_HERO_COUNT_RULES` projection.

## Gate Verdicts

All three gates ran as independent subagents.
- **Pre-flight (01.4): NOT READY → READY TO EXECUTE.**
  - Empirical scaffold (own throwaway worktree at `3fbb03f3`): the 26-row table, the table-driven resolver and the
    removed constants. `pnpm -r build` 0; `pnpm -r --no-bail test` 0 failures in every package (registry 281,
    game-engine 5011, server 1663 / 1457 pass, registry-viewer 326, arena-client 2297, dashboard 570, legends-board
    135, engine-runner 20, preplan 52, lagn-spec 107, vue-sfc-loader 11, replay-producer 4); both typechecks 0;
    scripts 105 / 105; replay fixtures unchanged. Every row's locked sequence, and core Secret Invasion / Civil War
    identical to the old implementation, confirmed by direct calls.
  - All 26 rows verified against the printed Setup text in `data/cards`; a scan of all 200 schemes found no missed
    count rule.
  - PS-1: The Time Heist (a printed main Hero Deck of 4 plus a 4-Hero Past Hero Deck) deferred and named, and
    D-24672 §1's completeness claim scoped. RS-1..RS-5 applied (Mutant Messiah listed; six themes; the 16-set budget
    list; WP-798 budget wording; the `Object.hasOwn` lookup and prototype-key test). Delta re-check: one word
    (five → six themes) → **READY**.
- **Copilot (01.7): RISK → HOLD → PASS (CONFIRM).** Four scope-neutral fixes: #4 the source `git grep` checks; #10 the
  `never` exhaustiveness assertion; #11 AC8 (the 16-set budget table from the built dist) and the ca75 budget live
  check; #26 the 24-vs-26 wording. The re-run returned **PASS / CONFIRM**.
- **Lint (00.3): FAIL → PASS.** §3 (Final Gate row 6) cleared by A1 (card-data dependency + #2642 reservation in
  Assumes); advisories A2–A9 applied (AC8 budget commands, EC viewer typecheck gate, EC row-order note,
  removed-constant comment guardrail, Guardrail 1 wording, `noUncheckedIndexedAccess` note, affected-entry count,
  WORK_INDEX wording). The delta re-check returned **PASS** (EC-836: 74 content lines).
