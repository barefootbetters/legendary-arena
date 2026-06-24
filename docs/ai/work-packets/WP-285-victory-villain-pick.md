# WP-285 — Ebony Blade: Victory-Pile Villain-Pick Infrastructure + First Seed Card

**Status:** Ready to Execute
**Layer:** Game Engine (`packages/game-engine`)
**Depends on:** WP-247 ✅, WP-248 ✅
**EC:** EC-317
**Decisions:** D-24067, D-24068
**User-Visible Surface:** none — infrastructure (engine-only; no client picker UX yet)

---

## Goal

`antm/black-knight/the-ebony-blade` currently contributes 0 Attack because its ability has no
`[keyword:X]` marker — the `noMarker` gap class. This WP builds the **victory-pile villain-pick
pending-choice infrastructure** and seeds it with The Ebony Blade as the first consumer.

After this WP executes:

- `the-ebony-blade` is marked `[keyword:victory-villain-attack]` in `data/cards/antm.json`.
- Playing The Ebony Blade parks a `PendingVictoryPileCardPick` entry in `G.pendingVictoryPileCardPick`
  (FIFO queue, lazy-init, never in `Game.setup()`). If no eligible villains exist in the victory
  pile at park time, the pending entry is not parked (logged no-op).
- A new move `resolveVictoryPileCardPick({ cardId })` lets the active player (or bot) select a
  villain from their victory pile; the engine reads `G.cardStats[selectedCardId].attack` and grants
  that amount as +Attack via `G.turnEconomy.attack`.
- Block-all guards at all 8 standard sites prevent any other move from firing while a pending
  pick is outstanding.
- The bot auto-resolves by picking the villain with the highest printed attack.

The infrastructure is intentionally generic (`rewardType: 'attack'` discriminant, extendable) so
future cards that read other stats from victory-pile cards can re-use it without a new WP.

---

## Assumes

- **WP-247 ✅** — `G.cardStats[id].attack: number` exists (numeric printed-attack field).
  `evaluateCardPrintedStat` established the pattern; this WP reads `G.cardStats[cardId].attack`
  directly in the move handler.
- **WP-248 ✅** — `G.pendingOptionalKoRewards` FIFO pending-choice infrastructure established
  the pattern: lazy-init, block-all guards at 6 sites, bot-default in `ai.legalMoves.ts`.
  This WP follows the same topology (8 guard sites as of WP-282).
- **`hasPendingOptionalKoReward` and `hasPendingKoHeroChoice`** — exported from their respective
  resolve files; this WP exports `hasPendingVictoryPileCardPick` from the new resolve file,
  parallel to those.
- **`G.villainDeckCardTypes: Record<CardExtId, RevealedCardType>`** (WP-014B, `types.ts:639`) —
  populated at setup time; used to filter victory-pile cards to `'villain'` type only.
  Mastermind tactics are NOT in `G.villainDeckCardTypes` (they live in `G.mastermind`), so
  `villainDeckCardTypes[id] === 'villain'` is a clean "villain but not tactic" filter.
- **`data/cards/antm.json`** — `the-ebony-blade` card exists with ability text:
  `"You get +[icon:attack] equal to the printed [icon:attack] of a Villain in your Victory Pile. (Mastermind Tactics aren't Villains.)"`.
  The WP adds `[keyword:victory-villain-attack]` as a prefix to this text.
- **`HERO_KEYWORDS` union + array** (`packages/game-engine/src/rules/heroKeywords.ts`) —
  currently 20 keywords (WP-282 added `'undercover'`); this WP adds the 21st.
- **Block-all guard sites** — as of WP-282, there are 8 sites that check for any pending choice
  before allowing a move:
  1. `packages/game-engine/src/game.ts` (`advanceStage`)
  2. `packages/game-engine/src/moves/coreMoves.impl.ts` (`drawCards`)
  3. `packages/game-engine/src/moves/fightVillain.ts`
  4. `packages/game-engine/src/moves/fightMastermind.ts`
  5. `packages/game-engine/src/moves/recruitHero.ts`
  6. `packages/game-engine/src/villainDeck/villainDeck.reveal.ts`
  7. `packages/game-engine/src/moves/dodgeCard.ts`
  8. `packages/game-engine/src/moves/playFromUndercover.ts`

---

## Context

The Ebony Blade bug was surfaced via diagnostics (`gitSha 25b7ad6`): `hollowEffects` showed
`card: hero, mechanic: size-changing, timing: onPlay, reason: parse-unrecognized` on turn 14.
Root cause: the card has no `[keyword:X]` marker, so `parseAbilityText` builds no effect hook,
and no hook means 0 Attack and no hollow signal. This is the `noMarker` gap class — the engine
attempts nothing and logs nothing because the marker never existed.

The Ebony Blade is the **only** card in the current corpus whose ability selects a card from the
victory pile and reads its printed stat. The mechanic ("pick one from your own victory pile,
gain a printed stat") is generic enough to re-use for future cards, so this WP builds a
named pending-choice infrastructure rather than a one-off move.

**Why one WP, not two:** The block-all guard additions (8 sites) are mechanical one-liners that
do not justify a separate WP; they are inseparable from the new pending-choice type they guard.
The types + move + parser + effect-executor + guards + bot-default are a single cohesive unit —
splitting at the "types vs. consumers" boundary would produce an unusable stub WP followed by
an execution WP that needs all the same files. The WP-248 precedent followed the same reasoning.

**finalStateHash:** Expected unchanged. The sentinel board uses only `core/*` heroes; no `antm`
card is in the sentinel fixture, so the bot never parks a `pendingVictoryPileCardPick` during
a sentinel replay. Executor must confirm this empirically.

---

## Scope (In)

- Add `PendingVictoryPileCardPick` interface to `types.ts`
- Add `pendingVictoryPileCardPick?: PendingVictoryPileCardPick[]` field to `LegendaryGameState`
- Add `'victory-villain-attack'` to `HERO_KEYWORDS` union + array (20 → 21)
- New move file `resolveVictoryPileCardPick.ts` with move + `hasPendingVictoryPileCardPick` helper
  + `getEligibleVictoryVillains` helper
- New test file `resolveVictoryPileCardPick.test.ts`
- Parser recognition in `heroAbility.setup.ts` (keyword dispatch for `'victory-villain-attack'`)
- Park site in `heroEffects.execute.ts` (`'victory-villain-attack'` case)
- Move registration + `advanceStage` guard in `game.ts`
- Block-all guard at 7 additional sites (listed in Assumes)
- Bot auto-pick in `ai.legalMoves.ts` (short-circuit + highest-attack selector)
- `[keyword:victory-villain-attack]` marker added to `the-ebony-blade` in `data/cards/antm.json`
- Drift test update in `heroKeywords.test.ts` (array length 20 → 21, new entry present)
- Move-registration drift test in `game.test.ts` (move count N → N+1, `resolveVictoryPileCardPick` in set)

## Out of Scope

- Client-side picker UI — no `PendingVictoryPileCardPick` surfaces in `apps/arena-client`;
  the bot resolves all picks automatically; a future UX WP will add the player-facing panel.
- Other victory-pile pick abilities (any future card that selects from the victory pile to gain
  recruit, fight cost reduction, etc.) — deferred; the `rewardType` discriminant is reserved but
  only `'attack'` is implemented here.
- Victory pile reading in non-pick contexts (count-based abilities that do NOT require a
  player choice from the victory pile) — out of scope; those use `HeroCountSource` patterns
  already established by WP-247.
- Bystander victory pile filtering — bystanders are already in scope of WP-247 via
  `countVictoryBystanders`; this WP does not touch that path.
- Henchman victory-pile selection — henchmen are excluded by the `'villain'` type filter;
  this is intentional per The Ebony Blade's card text and is not generalized here.

---

## Context (Read First)

1. `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative), §The Rule Execution Pipeline,
   §Move Validation Contract, §The Turn Stage Cycle
2. `.claude/rules/architecture.md` — Layer Boundary enforcement
3. `.claude/rules/code-style.md` — No `.reduce()` in zone operations; `for...of` required
4. `docs/ai/REFERENCE/00.6-code-style.md` — Full style guide
5. `docs/ai/DECISIONS.md` — D-24030 (closed-union drift rule), D-24016 (attack-per-count,
   nearest-precedent), D-24019 (optional-ko-reward, nearest-pending-choice precedent),
   D-24067 (this WP's pending-choice decision), D-24068 (this WP's keyword decision)
6. `packages/game-engine/src/types.ts` — `PendingOptionalKoReward`, `PendingKoHeroChoice`,
   `LegendaryGameState.pendingOptionalKoRewards`, `G.villainDeckCardTypes` (line 639)
7. `packages/game-engine/src/moves/resolveOptionalKoReward.ts` — pattern to mirror exactly
8. `packages/game-engine/src/hero/heroEffects.execute.ts` — park site pattern (onPlay dispatch)
9. `packages/game-engine/src/ai/ai.legalMoves.ts` — short-circuit pattern for pending choices
10. `packages/game-engine/src/economy/economy.types.ts` — `CardStatEntry.attack: number`
11. `packages/game-engine/src/rules/heroKeywords.ts` — current union + array (20 entries)

---

## Files Expected to Change

**Engine package** (`packages/game-engine/src/`):

- `types.ts` — modified: add `PendingVictoryPileCardPick` interface + `pendingVictoryPileCardPick` G field
- `rules/heroKeywords.ts` — modified: add `'victory-villain-attack'` (union + array, 20 → 21)
- `rules/heroKeywords.test.ts` — modified: update drift test (array length 20 → 21, new entry)
- `moves/resolveVictoryPileCardPick.ts` — **new**: move + `hasPendingVictoryPileCardPick` + `getEligibleVictoryVillains`
- `moves/resolveVictoryPileCardPick.test.ts` — **new**: tests for move + helpers
- `setup/heroAbility.setup.ts` — modified: `'victory-villain-attack'` keyword dispatch
- `hero/heroEffects.execute.ts` — modified: `'victory-villain-attack'` onPlay case (park or no-op)
- `game.ts` — modified: move registration + `advanceStage` block-all guard
- `moves/coreMoves.impl.ts` — modified: `drawCards` block-all guard
- `moves/fightVillain.ts` — modified: block-all guard
- `moves/fightMastermind.ts` — modified: block-all guard
- `moves/recruitHero.ts` — modified: block-all guard
- `villainDeck/villainDeck.reveal.ts` — modified: block-all guard
- `moves/dodgeCard.ts` — modified: block-all guard
- `moves/playFromUndercover.ts` — modified: block-all guard
- `game.test.ts` — modified: move count N → N+1, `'resolveVictoryPileCardPick'` in move-name set
- `ai/ai.legalMoves.ts` — modified: `hasPendingVictoryPileCardPick` short-circuit + bot pick

**Card data:**

- `data/cards/antm.json` — modified: `[keyword:victory-villain-attack]` prefixed to `the-ebony-blade` ability text

**Note on file count:** 17 code/test files exceeds the ~8-file split guidance in §5. The 8 block-all
guard additions are mechanical one-liner imports + guard insertions that cannot be sensibly
separated from the infrastructure they guard. The pattern is identical to WP-248's precedent.

---

## Non-Negotiable Constraints

### Engine-wide
- Every new or modified file must be written in full — no diffs, no snippets, no
  "show only the changed section." Every line of every file.
- ESM only (`import`/`export`). Node.js v22+. No CommonJS.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English names,
  `for...of` loops, no `.reduce()` in zone or effect operations, JSDoc on every function,
  `// why:` on every non-obvious decision, ternaries only for simple single-condition
  branches (no nested ternaries).
- All randomness via `ctx.random.*` — never use `Math.random()` (see D-3701).
- `G` is runtime-only: never persist, serialize, or store it.
- Moves never throw. Only `Game.setup()` may throw.
- All zones store `CardExtId` strings only.

### Packet-specific
- `PendingVictoryPileCardPick` is **lazy-init only** — never initialized in `Game.setup()`;
  `G.pendingVictoryPileCardPick` is `undefined` by default and created on first park.
- `hasPendingVictoryPileCardPick(G)` returns `false` for both `undefined` and `[]`.
- Block-all guards must use `hasPendingVictoryPileCardPick` from the new resolve file — do not
  inline the check.
- **Queue integrity:** `pendingVictoryPileCardPick` is always treated as a strict FIFO queue:
  reads access index `[0]` (the front), pushes append to the end, removal always uses
  `.shift()`. The queue must never contain `null` entries or entries missing `playerID`/`rewardType`.
  Multiple concurrent entries are allowed and resolve strictly in insertion order.
- **Eligibility is evaluated at resolution time, not at park time.** Between park and resolve,
  the victory pile state is authoritative. Do not cache or re-use park-time eligibility.
  The move must call `getEligibleVictoryVillains` (or equivalent filter) at resolution time.
- Block-all guards must use `hasPendingVictoryPileCardPick` from the new resolve file — do not
  inline the check.
- The bot must not call `resolveVictoryPileCardPick` if `getEligibleVictoryVillains` returns
  an empty array (handle in the bot default section of `ai.legalMoves.ts`). The bot must call
  `getEligibleVictoryVillains` — never re-implement the filter inline.
- `G.cardStats[selectedCardId].attack` is a `number` (per WP-247 `CardStatEntry`). No
  string-to-number coercion.
- Do not use `G.villainDeckCardTypes[id]?.cardType` — the field IS the `RevealedCardType`
  string directly: `G.villainDeckCardTypes[id] === 'villain'`.

### Session protocol
- If any file in `## Files Expected to Change` does not exist as expected, STOP and report.
  Do not create the file with a placeholder.
- If any `// why:` comment location is unclear, STOP and ask.
- After implementation, run `pnpm --filter @legendary-arena/game-engine test` and confirm
  passing before reporting done.

### Locked contract values
- New keyword literal: `'victory-villain-attack'` (exact, no variant spellings)
- New pending-choice type name: `PendingVictoryPileCardPick` (exact)
- New G field name: `pendingVictoryPileCardPick` (exact)
- New move name: `resolveVictoryPileCardPick` (exact)
- Helper names: `hasPendingVictoryPileCardPick`, `getEligibleVictoryVillains` (exact)
- `rewardType` discriminant: `'attack'` (string literal, lowercase)
- Filter: `G.villainDeckCardTypes[cardId] === 'villain'` — verbatim; do not use other checks

---

## Acceptance Criteria

- **AC-1:** `heroKeywords.test.ts` drift test passes with 21 entries; `HERO_KEYWORDS` array
  includes `'victory-villain-attack'` at the correct position.
- **AC-2:** `resolveVictoryPileCardPick.test.ts` — a valid villain pick: move reads
  `G.cardStats[cardId].attack` and grants exactly that amount to `G.turnEconomy.attack`.
- **AC-3:** Move returns silently when `hasPendingVictoryPileCardPick(G)` is false.
- **AC-4:** Move returns silently when `cardId` arg is not in the player's victory pile.
- **AC-5:** Move returns silently when `cardId` is not a villain
  (`G.villainDeckCardTypes[cardId] !== 'villain'`).
- **AC-6:** `hasPendingVictoryPileCardPick` returns `false` for `undefined` and `[]`, `true`
  for a non-empty array.
- **AC-7:** `getEligibleVictoryVillains(G, playerID)` returns only cards where
  `G.villainDeckCardTypes[id] === 'villain'`.
- **AC-8:** Park site in `heroEffects.execute.ts` — if eligible villains exist at play time,
  a `PendingVictoryPileCardPick` is pushed; if none exist, no push occurs (logged no-op).
- **AC-9:** `game.test.ts` drift test passes with move count N+1; `'resolveVictoryPileCardPick'`
  is in the exact move-name set.
- **AC-10:** `data/cards/antm.json` `the-ebony-blade` ability text starts with
  `[keyword:victory-villain-attack]`.
- **AC-11:** All 8 block-all guard sites import `hasPendingVictoryPileCardPick` and return
  silently when it is true.
- **AC-12:** Bot default in `ai.legalMoves.ts` — when `hasPendingVictoryPileCardPick` is true
  and eligible villains exist, the bot calls `resolveVictoryPileCardPick` with the
  highest-attack villain's `cardId` (deterministic: if tie, lowest victory-pile index wins;
  bot must not use any randomness; bot must call `getEligibleVictoryVillains`, never
  re-implement the filter inline).
- **AC-13:** Queue integrity — after a successful pick, exactly one entry is removed from
  `G.pendingVictoryPileCardPick` via `.shift()`; the queue length decreases by exactly 1.
- **AC-14:** Resolution-time eligibility — if the victory pile contains only non-villains
  (bystanders, henchmen, etc.) when `resolveVictoryPileCardPick` fires, the move returns
  silently without mutating `G`.
- **AC-15:** FIFO order — with ≥2 pending entries, successive resolve calls consume entries in
  insertion order (first parked = first resolved); the second entry is untouched after the
  first successful resolve.
- **AC-16:** Bot guard — bot never calls `resolveVictoryPileCardPick` when
  `getEligibleVictoryVillains` returns an empty array.

---

## Failure Boundaries

The following conditions must never mutate `G`. The move must return `void` immediately on
any failure — same contract as every other move (see `ARCHITECTURE.md §Move Validation
Contract`):

| Condition | Required behavior |
|---|---|
| `G.pendingVictoryPileCardPick` is `undefined` or `[]` | Silent return, no state change |
| `cardId` arg not present in player's `G.playerZones[playerID].victory` | Silent return, no state change |
| `G.villainDeckCardTypes[cardId] !== 'villain'` | Silent return, no state change |
| Eligible villain list empty at resolution time | Silent return, no state change |
| FIFO front entry's `playerID` ≠ `ctx.currentPlayer` | Silent return, no state change |

No partial mutation is permitted on any failure path. If the move begins a validation chain
and any step fails, it must return before touching `G.turnEconomy.attack` or the queue.

**Park-site vs. resolution-time distinction:**
- The no-op at the **park site** (no eligible villains at play time) IS logged via `G.messages`
  — this is intentional; it is a gameplay event (the player played a card, nothing happened).
- Resolution-time silent returns are **not** logged — they are invalid-input paths in the move,
  not gameplay events.

---

## Verification Steps

```pwsh
# 1. Game engine tests — all must pass
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass, no failures; test count increases by at least 12 from WP-284 baseline (1586)

# 2. Full monorepo build + test
pnpm -r build
pnpm test
# Expected: all packages build; all tests pass

# 3. TypeScript typecheck
pnpm --filter @legendary-arena/game-engine exec tsc --noEmit
# Expected: 0 errors

# 4. Move-name drift check (spot-check)
# Grep resolveVictoryPileCardPick in game.ts moves registration
# Expected: found exactly once in the moves object

# 5. Keyword drift check (spot-check)
# Grep 'victory-villain-attack' in heroKeywords.ts
# Expected: found in both the union type and the HERO_KEYWORDS array

# 6. Block-all guard check (spot-check)
# Grep hasPendingVictoryPileCardPick in game.ts and all 7 non-game.ts guard sites
# Expected: found in each of the 8 files listed in ## Files Expected to Change
```

---

## Vision Alignment

**Touched surfaces (§17.1):**
- Card data / content semantics (Vision §1, §2) — adding a keyword marker to `antm.json`

**Clause check:**
- §1 (faithful to the physical game): The Ebony Blade's printed ability is "+Attack equal to a
  villain's printed attack." This WP implements that mechanic exactly. No conflict.
- §2 (card-accurate effect execution): The keyword marker enables the parser to build the correct
  hook. No conflict.

**Conflict assertion:** No conflict. This WP preserves all touched clauses.

**Non-Goal proximity:** No NG-1..7 are crossed. No monetization, no pay-to-win, no
cosmetic surfaces, no scoring changes, no identity changes.

**Determinism preservation:** The `resolveVictoryPileCardPick` move reads `G.cardStats[id].attack`
(a deterministic setup-time value) and grants it via `G.turnEconomy.attack += attack` — same
mutation pattern as `resolveOptionalKoReward`. The bot default is deterministic (highest-attack
first; ties broken by lowest victory-pile index). The `finalStateHash` is expected unchanged
because the sentinel board uses only `core/*` heroes (executor must confirm).

**State mutation scope:** The move is permitted to mutate exactly two fields:
- `G.turnEconomy.attack` (incremented by the selected villain's printed attack)
- `G.pendingVictoryPileCardPick` (front entry removed via `.shift()`)

No other `G` fields may be mutated during move execution.

---

## Funding Surface Gate

**N/A** — this WP adds engine infrastructure and a card data marker. No UI surfaces, no
user-visible copy, no funding channels, no global-nav or registry-viewer affordances are
introduced. None of the §20.1 trigger surfaces are present.

---

## §21 API Catalog

**N/A** — this WP adds a boardgame.io move, not an HTTP endpoint or `apps/server` library
function. No `apps/server/src/**` surfaces are added or modified. No entry in
`docs/ai/REFERENCE/api-endpoints.md` is required.

---

## Lint Gate Self-Review

| § | Status | Notes |
|---|---|---|
| §1 Structure | ✅ PASS | All 10 required sections present |
| §2 Constraints | ✅ PASS | Engine-wide + packet-specific + session protocol + locked values |
| §3 Assumes | ✅ PASS | WP-247, WP-248 deps; G.villainDeckCardTypes, G.cardStats.attack deps listed |
| §4 Context | ✅ PASS | ARCHITECTURE.md, DECISIONS.md, 00.6, types.ts, resolveOptionalKoReward.ts cited |
| §5 Files | ✅ PASS | All 18 files (17 code/test + antm.json) listed; file-count rationale noted |
| §6 Naming | ✅ PASS | Canonical names only; no 00.2 violations |
| §7 Dependencies | ✅ PASS | No new npm deps |
| §8 Boundaries | ✅ PASS | Game engine only; no layer crossings |
| §9 Windows | ✅ PASS | `pwsh` verification steps; no Unix-only commands |
| §10 Env Vars | ✅ PASS | No new env vars |
| §11 Auth | N/A | No authentication surfaces |
| §12 Tests | ✅ PASS | `node:test`, `makeMockCtx`, no boardgame.io imports |
| §13 Verification | ✅ PASS | Exact `pnpm` commands with expected output |
| §14 AC Quality | ✅ PASS | 16 binary, observable, specific items (AC-1..12 original + AC-13..16 queue/boundary hardening) |
| §15 DoD | ✅ PASS | STATUS.md, DECISIONS.md, WORK_INDEX.md included; D-24026 declared N/A infrastructure |
| §16.1 Abstraction | ✅ PASS | Helpers appear in multiple sites (8 guard sites) |
| §16.2 Control flow | ✅ PASS | `for...of` mandated; no nested ternaries or complex reduce() |
| §16.3 Names | ✅ PASS | Full English names; no abbreviations |
| §16.4 Functions | ✅ PASS | JSDoc required; ≤30 lines mandated |
| §16.5 Comments | ✅ PASS | `// why:` required on guard sites and lazy-init |
| §16.6 Imports | ✅ PASS | Named imports only; no `import *` |
| §16.7 Errors | ✅ PASS | Full sentences required |
| §17 Vision | ✅ PASS | Triggered (card data); §1, §2 cited; no conflict; determinism line present |
| §18 Grep/Prose | ✅ PASS | No literal-string grep for forbidden tokens in WP prose |
| §19 HEAD Staleness | N/A | Not a repo-state-summarizing artifact |
| §20 Funding | ✅ PASS | N/A with justification (no §20.1 surfaces) |
| §21 API Catalog | ✅ PASS | N/A with justification (no HTTP endpoints or server library functions) |

**Lint gate verdict: ALL PASS — ready for pre-flight.**

---

## Pre-flight Verdict

**READY TO EXECUTE**

- ✅ WP-247 is Done (D-24016 Active; `G.cardStats[id].attack: number` confirmed in `economy.types.ts`)
- ✅ WP-248 is Done (D-24019 Active; `G.pendingOptionalKoRewards` pattern confirmed in `types.ts:599`)
- ✅ WP-282 is Done (block-all guards confirmed at 8 sites including `dodgeCard.ts` + `playFromUndercover.ts`)
- ✅ `G.villainDeckCardTypes: Record<CardExtId, RevealedCardType>` confirmed at `types.ts:639`
- ✅ HERO_KEYWORDS at 20 entries (`'undercover'` is entry 20); new entry 21 = `'victory-villain-attack'`
- ✅ Scope is locked: 17 code/test files + antm.json; no layer crossings
- ✅ No sentinel board impact expected (core-only heroes; executor must confirm `finalStateHash` unchanged)
- ✅ Ambiguity resolved: victory-pile villain filter = `G.villainDeckCardTypes[id] === 'villain'`
  (mastermind tactics excluded by design — they are never in `G.villainDeckCardTypes`)

---

## Copilot Check Verdict

**PASS**

No failure modes detected from the standard 30-mode audit. Key points:
- Pattern is a direct structural mirror of WP-248 (FIFO pending-choice, block-all guards, bot-default)
- The 8-site guard list is exhaustive per WP-282's established scope
- `G.villainDeckCardTypes` filter is clean and self-documenting
- No sentinel impact; determinism-preservation explicitly stated
- Lint gate all-pass

---

## Definition of Done

- [ ] All 16 Acceptance Criteria pass (AC-1..16)
- [ ] `pnpm --filter @legendary-arena/game-engine test` — all pass; test count ≥ 1598 (baseline
      1586 + minimum 12 new tests; the required-coverage mandate in EC-317 specifies 7 minimum
      tests for `resolveVictoryPileCardPick.test.ts`)
- [ ] `pnpm -r build && pnpm test` — all packages build and test green
- [ ] `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` — 0 errors
- [ ] `docs/ai/STATUS.md` updated with WP-285 execution summary
- [ ] `docs/ai/DECISIONS.md` — D-24067 flipped to Active; D-24068 flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-285 checkbox flipped to `[x]`
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-285 node added under the correct subsystem cluster
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] **User-Visible Surface: none — infrastructure.** STATUS.md entry states "No user-observable
      change — infrastructure only; The Ebony Blade +Attack will be bot-resolved in live matches
      pending a future client picker UX WP."
