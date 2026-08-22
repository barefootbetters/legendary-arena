# WP-582 — Rogue "Copy Powers" is a Full Duplicate (attack + recruit + team, not ability-only)

**Status:** Draft 2026-08-22 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com`. After Rogue's Copy Powers copies a Hero, the player's **Attack and Recruit rise by the copied card's printed stats** (a real duplicate), the copied Hero's **team** counts for team-synergy Hero abilities, and — as already shipped — the copied Hero's **class** and **on-play ability** apply. D-24026 live-verification applies.
**Primary Layer:** Game Engine (`packages/game-engine`) — ONLY.
**Dependencies:** WP-535 / D-24345 (the shipped Copy Powers re-fire + dual-class grant — this WP amends its Fork 2); WP-290 / D-24074 (the `cardSizeChangingClasses` runtime dual-class map, the precedent this WP mirrors for team); WP-251 / D-24022 (`HERO_EFFECT_HANDLERS`). All landed. Baseline `origin/main` at draft: `cd40d11a`.

---

## Goal

Make Rogue's `core/rogue/copy-powers` a **full duplicate** of the copied Hero, as the printed Marvel Legendary card specifies — *"Play this card as a copy of another Hero you played this turn."* WP-535 / D-24345 **Fork 2** deliberately scoped the copy to *"ability only, NOT printed stats … does NOT re-add the copied Hero's base attack/recruit economy."* The operator has confirmed from the physical card that this is wrong: Copy Powers copies the **entire** card — attack, recruit, hero class, effects, and team. Today the copy re-fires the ability and grants the class, but silently drops the copied card's **printed attack + recruit** and its **team**. This WP closes those two gaps and records D-24391 superseding D-24345 Fork 2.

**Found live (2026-08-22 match review):** Copy Powers cloned Cyclops' *Unending Energy* and the player's attack did **not** rise by the copied card's printed attack; a later copy of Wolverine drew a card (ability fired) but again added no printed stat.

## User-Visible Impact

When Copy Powers copies a Hero with printed attack/recruit, the player's available Attack and Recruit increase by exactly those printed values (a genuine second instance of an already-played Hero — the stat legitimately **doubles**), and a fight can be funded from the added economy. A Hero ability that reads *"for each other &lt;team&gt; Hero"* now counts the Copy Powers card as the copied team. Class and ability behaviour are unchanged (already faithful). No monetization or persistence change. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The class-grant precedent exists inside applyCopyPowers (the pattern team-copy mirrors)
grep -q "cardSizeChangingClasses\[sourceCardId\]" packages/game-engine/src/hero/heroEffects.execute.ts && echo "A_OK"
# Expected: A_OK

# B. No runtime team-grant map exists yet (team-copy is a NEW mechanism)
! grep -rq "cardCopiedTeams" packages/game-engine/src && echo "B_OK"
# Expected: B_OK

# C. addResources is already imported in heroEffects.execute.ts (no new import needed)
grep -q "import { addResources" packages/game-engine/src/hero/heroEffects.execute.ts && echo "C_OK"
# Expected: C_OK

# D. The requiresTeam hero-condition read exists (the single read team-copy routes through)
grep -q "case 'requiresTeam'" packages/game-engine/src/hero/heroConditions.evaluate.ts && echo "D_OK"
# Expected: D_OK

# E. applyCopyPowers does NOT already add economy (the gap being fixed)
! grep -A30 "export function applyCopyPowers" packages/game-engine/src/hero/heroEffects.execute.ts | grep -q "addResources" && echo "E_OK"
# Expected: E_OK
```

---

## Context (Read First)

- `packages/game-engine/src/hero/heroEffects.execute.ts` — **`applyCopyPowers(G, ctx, playerID, sourceCardId, chosenHeroId)`** is the single apply function BOTH resolution paths funnel through: the 1-eligible auto path (`heroEffectCopyPowers`, `targets.length === 1`) and the ≥2 pending-choice path (`resolveCopyPowersChoice` in `moves/copyPowersChoice.resolve.ts`). It already (a) logs the copy, (b) grants the copied class into `G.cardSizeChangingClasses[sourceCardId]`, and (c) re-fires the ability via `executeHeroEffects`. It does **not** add the copied card's attack/recruit economy — that is the Fork-2 omission. `addResources` is already imported here.
- `packages/game-engine/src/moves/coreMoves.impl.ts` — `applyCardPlay` shows the canonical base-economy add for a normal play: `const cardStats = G.cardStats[cardId]; G.turnEconomy = addResources(G.turnEconomy, cardStats.attack, cardStats.recruit)`. The copied Hero's printed attack/recruit live in `G.cardStats[chosenHeroId]` (built at setup, keyed by the same copy-suffixed instance ids `applyCopyPowers` receives). Copy Powers adds a **second** instance of that stat — a duplicate genuinely doubles it (the copied Hero was already played this turn, so its own stat was already added when it was played).
- `packages/game-engine/src/hero/sizeChanging.logic.ts` — `getGrantedClasses` / `cardHasClassWhenPlayed` read + union `G.cardSizeChangingClasses` at the hero-class gate. The team-copy is the **exact mirror** of this: a new `G.cardCopiedTeams` map + a new `effectiveTeams.logic.ts` helper.
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — `case 'requiresTeam'` reads `G.cardTraits[cardId]?.team` directly for hero team-synergy. This is the **single** read team-copy routes through the new helper (the class grant wired only the parallel hero-class read — see Non-Goal below).
- **Team is read statically at 7 sites** (`heroConditions.evaluate.ts` requiresTeam, plus villain / mastermind / scheme-twist / tactic / villain-defeat-requirement / UIState). There is **no** runtime team-grant map today. The existing **class** grant likewise reaches only the hero-synergy read and does **not** propagate to the non-hero class reads — so wiring team to the single hero-synergy read keeps team and class **symmetric**. Full parity across all 7 read sites (for both team and class) is a deferred consistency follow-up, not this WP.
- Determinism: `G.turnEconomy` is a hashed field — adding attack/recruit is a **real gameplay delta** (expected, not a violation). `G.cardSizeChangingClasses` is hashed but lazy/omit-when-empty; the new `G.cardCopiedTeams` map is added the same lazy/omit-when-empty way. **No committed fixture plays Copy Powers** (the sole complete-game fixture is `core/dr-doom`), so `finalStateHash` / `PRE_WP080_HASH` stay byte-identical — verify, no re-pin expected.

---

## Scope (In)

- **`packages/game-engine/src/hero/heroEffects.execute.ts`** — in `applyCopyPowers`, after the existing class grant and before the ability re-fire:
  - **Attack + Recruit:** `const copiedStats = G.cardStats[chosenHeroId]; if (copiedStats) { G.turnEconomy = addResources(G.turnEconomy, copiedStats.attack, copiedStats.recruit); }` plus a `pushLog(..., 'applied', sourceCardId)` line naming the granted economy (mirror `applyCardPlay`'s base-economy log phrasing). A `// why:` notes the intended double-count (a duplicate of an already-played Hero) and cites D-24391.
  - **Team:** grant the copied Hero's `G.cardTraits[chosenHeroId]?.team` into a new lazy `G.cardCopiedTeams[sourceCardId]` map, mirroring the class-grant block exactly (init-if-absent, push-if-not-present). `CardTraitEntry.team` is `string | null`, so guard the null (teamless copied Hero) case just as the class grant guards `typeof copiedClass === 'string' && copiedClass.length > 0` — a teamless copy grants nothing.
- **`packages/game-engine/src/types.ts`** — declare the new optional lazy `cardCopiedTeams?: Record<CardExtId, string[]>` on `LegendaryGameState` (beside the `cardSizeChangingClasses` sibling at ~`types.ts:1432`) with a `// why:` contract comment (runtime-written by Copy Powers, lazy/omit-when-empty, hashed like `cardSizeChangingClasses`). The neighbouring `cardSizeChangingClasses` contract comment (~`types.ts:1428`) still implies "read-only at runtime" (a known stale note from D-24345 — the class IS written at runtime by `applyCopyPowers`); correct it in passing.
- **`packages/game-engine/src/hero/effectiveTeams.logic.ts`** — **new** pure helper mirroring `sizeChanging.logic.ts`: `getGrantedTeams(G, cardId)` (the card's static `cardTraits.team`, if any, unioned with `G.cardCopiedTeams[cardId]`) and `cardHasTeamWhenPlayed(G, cardId, team)`. No boardgame.io import (pure helper).
- **`packages/game-engine/src/hero/heroConditions.evaluate.ts`** — the `case 'requiresTeam'` read (~`heroConditions.evaluate.ts:83`) is a per-card `traitEntry.team === condition.value` compare inside a **self-excluding `for...of` over `inPlay`**; route that per-card compare through `cardHasTeamWhenPlayed` while **preserving the self-exclusion loop** (do not collapse it to a single-card read), so a copied team satisfies a hero team-synergy condition. The `requiresTeam` **description** branch (the other switch, ~line 316) is display-only and unchanged unless the same read is needed there.
- **Tests** (`packages/game-engine/src/**/*.test.ts`):
  - `hero/heroEffects.execute.test.ts` — the Copy Powers behaviour test asserts the copied card's printed attack **and** recruit are added to `G.turnEconomy` on copy; a copy of a null-stat Hero adds 0/0; the team map is written.
  - `moves/copyPowersChoice.resolve.test.ts` — BOTH paths (auto + resolve) assert the economy delta and the team-map write.
  - `hero/heroConditions.evaluate.test.ts` — a `requiresTeam` condition is satisfied after a Copy Powers copy of that team (mirror the existing `cardSizeChangingClasses` class test).
  - `hero/effectiveTeams.logic.test.ts` — **new** — `getGrantedTeams` / `cardHasTeamWhenPlayed` over static-only, copied-only, and both.

## Out of Scope

- **Class and ability copy** — already faithful (class via `cardSizeChangingClasses` D-24074; ability via the `executeHeroEffects` re-fire). **Verify** they still fire; do not re-implement.
- **Full team/class parity across the 6 non-hero read sites** (villain / mastermind / scheme-twist / tactic / villain-defeat-requirement / UIState) — the existing class grant does not reach them either; bringing **both** team and class to full parity is a deferred consistency follow-up, not this fidelity fix.
- **Steal Abilities** (Rogue's other copy card) — a separate follow-up already noted OUT of scope by D-24345.
- **Card data / markers / ledgers** — the `[keyword:copy-powers]` marker and the handler are already registered; `HERO_EFFECT_HANDLERS` / `HERO_KEYWORDS` counts are **unchanged**. No `data/cards`, marker, hero-mechanic-ledger, or effect-index regen.
- **The pending-choice / UIState / prompt surface** — unchanged (the copy still resolves the same way; only what the copy grants changes). No new move, no new pending kind, no new UIState field.

---

## Files Expected to Change

- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (attack/recruit add + team-map write in `applyCopyPowers`)
- `packages/game-engine/src/types.ts` — **modified** (new lazy `cardCopiedTeams` field on `LegendaryGameState` ~`:1432` + contract comment; correct the stale `cardSizeChangingClasses` "read-only at runtime" note ~`:1428`)
- `packages/game-engine/src/hero/effectiveTeams.logic.ts` — **new** (pure `getGrantedTeams` / `cardHasTeamWhenPlayed` helper)
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** (`requiresTeam` routed through the helper)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** (economy + team assertions on copy)
- `packages/game-engine/src/moves/copyPowersChoice.resolve.test.ts` — **modified** (both paths assert economy + team)
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified** (`requiresTeam`-after-copy)
- `packages/game-engine/src/hero/effectiveTeams.logic.test.ts` — **new** (helper unit tests)
- `docs/ai/DECISIONS.md` — **modified** (land D-24391; amend D-24345 Fork 2 with a supersession note)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-582 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

Game-engine only; single-session lane.

---

## Contract (Locked by D-24391)

- **Attack + Recruit:** `applyCopyPowers` adds `G.cardStats[chosenHeroId]` attack **and** recruit to `G.turnEconomy` via `addResources`, on BOTH resolution paths. The double-count is **intended** — Copy Powers is a duplicate of an already-played Hero, so its stat is added a second time. A null-stat copied Hero adds 0/0 (never throws).
- **Team:** Copy Powers counts as the copied Hero's team for the hero team-synergy `requiresTeam` read, via the new lazy `G.cardCopiedTeams` map + `getGrantedTeams`/`cardHasTeamWhenPlayed` helper — the exact mirror of the D-24074 class grant, reaching the SAME single hero-synergy read.
- **Class + ability:** unchanged — already faithful (`cardSizeChangingClasses`; the `executeHeroEffects` re-fire).
- **Supersedes D-24345 Fork 2** ("ability only, not stats"). Every other D-24345 clause — interactive pending choice, the dual-class grant, the descriptive-`[hc:X]` parser exclusion, and the instance-id copy-of-self recursion fix — stays **Active**.
- **Non-goal:** full team/class parity across the villain / scheme / mastermind / tactic / defeat-requirement / UIState reads is deferred.

### Determinism / persistence

- `G.turnEconomy` is hashed; adding attack/recruit is a real gameplay change (the intended fix), not a determinism violation.
- The new `G.cardCopiedTeams` map is **lazy-materialized** (undefined by default, created at the grant site, never in `Game.setup`) and omit-when-empty — mirroring `cardSizeChangingClasses`.
- No committed fixture plays Copy Powers, so `finalStateHash` / `PRE_WP080_HASH` are byte-identical — **verify, re-pin only on a real fixture diff (none expected)**. If either oracle moves unexpectedly, STOP.
- Not a snapshot field (snapshots stay counts-only). No `ctx.random`, no I/O.

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word names, `for...of` never `.reduce()`, `getGrantedTeams`/`cardHasTeamWhenPlayed` mirroring the class helper names, a `// why:` on the economy double-count (cite D-24391) and on the team map's lazy materialization. Moves never throw. The new drift-sensitive add (the `cardCopiedTeams` field) is asserted by a RUNTIME test, never a bare `satisfies` (D-24372). ESM, Node v22+.

---

## Acceptance Criteria

1. After Copy Powers copies a Hero with printed attack A and recruit R, `G.turnEconomy` available attack rises by A and available recruit by R (measured through both the auto path and the resolve path); a fight can be funded from the added economy.
2. Copying a null-stat Hero (e.g. a Hero whose printed attack/recruit is null) adds 0/0 and never throws.
3. A hero ability with a `requiresTeam: &lt;team&gt;` condition is satisfied when the only card of that team in play is a Copy Powers card that copied a Hero of `&lt;team&gt;`.
4. The copied Hero's **class** still grants (`cardSizeChangingClasses`) and its **ability** still re-fires (`executeHeroEffects`) — unchanged from D-24345.
5. No new move; `HERO_EFFECT_HANDLERS` / `HERO_KEYWORDS` counts unchanged; no `data/cards` / marker / hero-mechanic-ledger / effect-index change. The `cardCopiedTeams` field is optional + lazy + omit-when-empty.
6. `pnpm --filter @legendary-arena/game-engine build` + `test` green (economy + team + condition + helper suites pass); `finalStateHash` / `PRE_WP080_HASH` byte-unchanged; `pnpm -r --no-bail test` shows no new failures.

---

## Verification Steps

```bash
# 1. applyCopyPowers now adds economy and writes the team map
grep -n "addResources(G.turnEconomy" packages/game-engine/src/hero/heroEffects.execute.ts   # expect a new call inside applyCopyPowers
grep -n "cardCopiedTeams\[sourceCardId\]" packages/game-engine/src/hero/heroEffects.execute.ts # expect the team grant

# 2. New team helper exists and is routed at the requiresTeam read
grep -n "export function getGrantedTeams\|export function cardHasTeamWhenPlayed" packages/game-engine/src/hero/effectiveTeams.logic.ts
grep -n "cardHasTeamWhenPlayed" packages/game-engine/src/hero/heroConditions.evaluate.ts

# 3. No forbidden surfaces touched
git diff --name-only | grep -E '^(data/cards|data/metadata|docs/ai/coverage)' ; echo "expect none"

# 4. Handler / keyword counts unchanged (no new move / keyword)
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -6
# Expected: green; move-count / HERO_EFFECT_HANDLERS / HERO_KEYWORDS drift tests unchanged

# 5. Hash oracles unchanged (no fixture plays Copy Powers)
pnpm --filter @legendary-arena/game-engine test 2>&1 | grep -iE "finalStateHash|PRE_WP080|hash" | tail -5
pnpm -r --no-bail test 2>&1 | tail -8

# 6. Live (post-deploy; D-24026): play.legendary-arena.com — play a Hero with printed attack,
#    then play Copy Powers copying it; the Attack readout rises by the copied card's printed attack.
#    Record in STATUS.
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–E passed before the edit
- [ ] All 6 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 6 is post-deploy)
- [ ] `applyCopyPowers` adds the copied card's printed attack + recruit on both paths (intended double-count) and writes the copied team into the lazy `cardCopiedTeams` map
- [ ] `requiresTeam` is routed through `cardHasTeamWhenPlayed`; class + ability copy verified unchanged
- [ ] No new move / keyword; no `data/cards` / marker / ledger / index change; `cardCopiedTeams` optional + lazy + omit-when-empty; hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] Game-engine suite green (economy + team + condition + helper); `pnpm -r --no-bail` no new failures
- [ ] `docs/ai/STATUS.md` Done entry names WP-582, records the D-24026 live-verify as operator-pending (`User-Visible Surface = play.legendary-arena.com`) and the hash-oracle outcome
- [ ] `docs/ai/DECISIONS.md` D-24391 landed Active; D-24345 Fork 2 amended with the supersession note (D-24345 otherwise stays Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-582 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-617:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed in the deployed play surface (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-22)

Dependencies verified on `main` @ `cd40d11a`: `applyCopyPowers` is the single apply function both resolution paths funnel through and already grants the class + re-fires the ability (WP-535/D-24345); `addResources` is imported here; `G.cardStats[chosenHeroId]` carries the copied instance's printed attack/recruit; the `requiresTeam` read is the single hero-synergy team gate; no `cardCopiedTeams` map exists yet (team-copy is a new mechanism). **Mutation boundary** — the economy add mutates the hashed `turnEconomy` (a real, intended gameplay delta); the new team map is lazy/omit-when-empty like `cardSizeChangingClasses`; no committed fixture plays Copy Powers, so both hash oracles stay byte-identical (verify, no re-pin). **Empirical scaffold — NOT required:** this is an additive behaviour add inside one apply function plus a mirror helper, not a validation-surface or contract change; the AC economy/team assertions are the proof.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-22)

Layer boundary (game-engine only; `applyCopyPowers` + a pure mirror helper + one condition read) — clean. Determinism (turnEconomy delta is the intended fix; the team map is lazy/omit-when-empty; no fixture reaches Copy Powers → no re-pin) — clean. Contract fidelity (printed "copy of another Hero" = full duplicate: attack + recruit + team added; class + ability already faithful) — clean. Scope (attack/recruit + team-at-hero-gate; class + ability verified-not-reimplemented; the 6 non-hero read sites explicitly deferred as a symmetric team+class follow-up) — clean. **RISK considered:** the minimal-vs-full team fork — resolved to **minimal (hero-synergy read only)** because the existing class grant is itself minimal, so team-at-hero-gate keeps team and class symmetric; full-parity-across-all-reads would make team more complete than class (an inconsistency) and is deferred. The intended **double-count** (a duplicate adds the stat a second time) is called out so an executor does not "fix" it as a bug. Both locked in AC-1/AC-3 and D-24391.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS. **§2 Constraints** — PASS. **§3 Assumes** — PASS (A–E w/ expected output). **§4 Context** — PASS (the apply fn, the class precedent, the economy add shape, the team read sites + symmetry argument; 00.2 — no renamed field, `cardCopiedTeams` is a new engine-internal map). **§5 Files** — PASS (closed allowlist, game-engine + governance). **§6 Naming** — PASS (`getGrantedTeams` / `cardHasTeamWhenPlayed` / `cardCopiedTeams` mirror the class canon). **§7 Deps** — PASS (all landed). **§8 Boundaries** — PASS (pure helper has no boardgame.io import; engine-only). **§9 Windows** — N/A. **§10 Env** — N/A. **§11 Auth** — N/A. **§12 Test Quality** — PASS (`node:test`; economy delta + team map + condition + helper; both resolution paths). **§13 Verification** — PASS. **§14 AC** — PASS (6 binary). **§15 DoD** — PASS (STATUS + DECISIONS D-24391 + D-24345 amendment + indices + mindmap + D-24026). **§16 Code Style** — PASS (`for...of`; `// why:` on the double-count + lazy map; runtime drift assertion per D-24372). **§17 Vision** — present. **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding** — N/A. **§21 API Catalog** — N/A.

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Clauses touched:** §10 (card fidelity — Copy Powers now copies the whole card as printed), §22 (determinism — the economy delta is a real gameplay change; the new map is lazy so replay stays identical). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it makes the printed copy faithful without altering determinism, loss conditions, or any other card. **Non-Goal proximity:** none of NG-1..NG-8. **Determinism preservation:** no fixture reaches Copy Powers → both hash oracles byte-identical, no re-pin expected.

## Funding Surface Gate

**N/A** — a card-fidelity fix in the engine; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function changes. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
