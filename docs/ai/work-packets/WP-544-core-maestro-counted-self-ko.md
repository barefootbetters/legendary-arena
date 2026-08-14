# WP-544 — Core Maestro Counted Self-KO

**Status:** Draft 2026-08-14
**Layer:** Game Engine (`packages/game-engine`) + Card Data
**Depends on:** WP-485 / D-24290 (the `countPlayerHeroesMatchingTrait` count-by-trait
helper) · WP-492 / D-24298 (the interactive magnitude-M current-player KO park) ·
WP-242 / D-24007 (the `ko-hero` pending-choice stack: `resolveKoHeroChoice` move +
UIState projection + client prompt)
**Reserves:** EC-579 · D-24353
**Lane:** Standard two-session (1 new append-only primitive + parse arm + marker; no
new pending field / resolve move / client UX).

---

## 1. Problem

The Core villain **Maestro** (`villain core/radiation/maestro`) has one Fight ability
that is currently hollow (marked in `/debug/effects` as unimplemented):

> **Fight:** For each of your `[hc:strength]` Heroes, KO one of your Heroes.

It is the **counted self-KO** slice of the Core villain/henchman Fight batch
(WP-541 shipped the reward gains; WP-542 shipped the recursive villain-deck play).
Two cards remain after this one: Supreme HYDRA (dynamic piercing) is the last.

The ability has two independently-parameterized halves:

1. **A count derived from a trait.** *N* = how many of the current player's Heroes
   are `[hc:strength]` (hero-class Strength), counting hand + in-play (Heroes played
   this turn sit in `inPlay` — the Fight effect resolves after the play phase).
2. **An interactive KO of *any* of the player's Heroes.** The player chooses **which**
   *N* of their own Heroes to KO — the targets are **not** restricted to the Strength
   Heroes that produced the count.

## 2. Why this is small: everything it needs already exists

Both halves already have production machinery from earlier villain WPs. Maestro is a
new **wiring** of them, not new mechanics.

**The count half** — `countPlayerHeroesMatchingTrait([...hand, ...inPlay], G.cardTraits,
requireKind, requireValue)` was added by WP-485 (Baron Zemo
`rescue-bystanders-current-by-trait-count`). It already handles both trait kinds
(`team` and `hero-class`), so `[hc:strength]` counts correctly with no change.

**The interactive-KO half** — the existing `ko-hero` primitive with `target: 'current'`
(WP-242 base, generalized to magnitude-M by WP-492 for Whirlwind "KO two of your
Heroes") already:

- Auto-KOs every **forced** step (0 eligible → no-op; every hero must die, or all
  copies identical → auto-KO with no prompt), and
- Parks **one** `PendingKoHeroChoice { choiceType: 'ko-hero', playerID, remaining }`
  when a **genuine** choice remains (`countKoableHeroes(zones) > owed && eligible ≥ 2`),
  carrying the owed count.

The park is resolved by the existing `resolveKoHeroChoice` move, projected by the
existing UIState pending-choice path, and prompted by the existing client surface.
The resolve move already auto-resolves any later forced remainder, so a single-option
pick is never shown.

**Consequence: Maestro adds NO new pending field, NO new resolve move, and NO new
client UX.** The only new thing is a primitive whose count comes from a trait scan
instead of a literal `magnitude`.

## 3. Contract (locked)

### 3.1 New append-only primitive

Add `ko-heroes-current-count-by-trait` to `VillainEffectPrimitive` (union) **and**
`VILLAIN_EFFECT_PRIMITIVES` (array) **and** the drift test, moved together
(D-24034 append-only discipline; 23 → 24 primitives).

**Naming — read this.** The existing sibling `ko-heroes-current-by-trait` (WP-485
Destroyer, "KO all your `[team:shield]` Heroes") KOs the Heroes that **match** the
trait. Maestro is different: the trait only supplies the **count**; the KO targets are
the player's free choice. To keep the two visually distinct, the new primitive is named
`ko-heroes-current-**count**-by-trait` (word order deliberately reordered from the
rescue family's `-by-trait-count`) — the `count` sits earlier to signal "the trait
produces a **count**, not the target set." Do **not** name it
`ko-heroes-current-by-trait-count` (one `-count` suffix away from the KO-the-matching
sibling — a drift trap).

### 3.2 Handler

`villainEffectKoHeroesCurrentCountByTrait(G, currentPlayer, cardId, timing, descriptor)`:

1. Guard `requireKind` / `requireValue` present (defensive — the parser always sets
   both; a hand-built test hook could omit them → no-op `{ targets: [] }`).
2. Guard `G.playerZones[currentPlayer]` present (→ `{ targets: [] }`).
3. `const owed = countPlayerHeroesMatchingTrait([...zones.hand, ...zones.inPlay],
   G.cardTraits, requireKind, requireValue)`.
4. Run the **same interactive KO loop** as `villainEffectKoHero` `target: 'current'`,
   with `owed` as the count: auto-KO every forced step
   (`countKoableHeroes(zones) > owed && buildKoEligibleTargets(zones).length >= 2`
   → break and park; else `koSingleTarget`), then park **one**
   `PendingKoHeroChoice { choiceType: 'ko-hero', playerID: currentPlayer, remaining: owed }`
   iff `owed > 0 && countKoableHeroes(zones) > owed && eligible ≥ 2`.
   - **Duplicate** this loop (do not refactor `villainEffectKoHero`). Per the
     duplicate-first / abstract-on-third rule (`.claude/rules/code-style.md`
     §Abstraction), Maestro is the **second** count-source for the current-player
     KO park (magnitude is the first). Refactoring would disturb the byte-pinned
     WP-242/WP-492 park-shape tests for no benefit. Extract a shared helper only if a
     **third** count-source appears.
   - **`remaining`:** always set it here (`owed` can be ≥ 2 or, when Maestro produces
     exactly 1 forced-choice KO with sparable heroes, 1). Setting `remaining` even at
     1 is fine for a keyword-less primitive — the byte-identical `{choiceType,playerID}`
     omit-when-1 rule is a WP-242 constraint specific to the `koHeroCurrentPlayer`
     **legacy keyword** path, which Maestro is not. Match whatever the `ko-hero`
     magnitude-M path does; if in doubt, mirror it exactly.
5. Self-narrate (keyword-less — `descriptorToLegacyKeyword` returns `undefined`, no
   `VillainEffectResult`):
   - parked → `Fight effect: KO {owed} of your Heroes (one per your {requireValue} Hero) — choose which.` (`neutral`)
   - auto-KO'd ≥ 1 → `Fight effect: KO'd {n} of your Heroes ({names}) — one per your {requireValue} Hero.` (`applied`)
   - none → `Fight effect: no Heroes to KO.` (`blocked`)
6. Return `parked ? { targets, pending: true } : { targets }`.

### 3.3 Parse arm

In `setup/villainAbility.setup.ts`, add a `primitiveToken === 'ko-heroes-current-count-by-trait'`
arm reusing the shared trait-predicate parser (the same one
`ko-heroes-current-by-trait` / `rescue-bystanders-current-by-trait-count` /
`give-hq-hero-by-trait-to-current` use): grammar
`ko-heroes-current-count-by-trait:<kind>:<value>` with `kind ∈ {team, hc}`
(`hc` → `hero-class`). For Maestro: `:hc:strength` → `{ requireKind: 'hero-class',
requireValue: 'strength' }`.

### 3.4 Registry

Add `'ko-heroes-current-count-by-trait': villainEffectKoHeroesCurrentCountByTrait`
to `VILLAIN_EFFECT_HANDLERS`.

### 3.5 Marker + regen

`scripts/convert-cards/inputs/villain-effect-markers.json`:
```
villains.core.radiation.maestro.fight = ['ko-heroes-current-count-by-trait:hc:strength']
```
Then regen `data/cards/core.json` via `apply-effect-markers.mjs` **and** all
card-data-derived feeds (`ledger:villains`, effect-implementation index,
card-mechanics) — a partial regen reddens `main`. Byte-check `core.json` is a real
diff (`git diff --numstat`), not CRLF churn.

## 4. Determinism / persistence

- Reads `G` (hand / inPlay / cardTraits / KO-eligibility); **no `ctx.random`** (KO
  target selection is deterministic; the interactive park defers the choice to the
  player, not to RNG).
- The park reuses the **existing** hashed `G.pendingKoHeroChoices` field — **no new
  G shape**, so no `finalStateHash` / `PRE_WP080_HASH` re-pin surface is introduced.
  Re-pin only if a **committed fixture** fights Maestro (none does — verify at exec).

## 5. Out of scope

- Supreme HYDRA (dynamic piercing) — the last Core villain card; separate WP.
- Any change to `ko-heroes-current-by-trait` (KO-the-matching) or the `ko-hero`
  magnitude path — Maestro is additive.
- No new pending-choice field, resolve move, UIState field, or client prompt (all
  reused).

## 6. Definition of Done

- Primitive in union + array + drift test (23 → 24); handler + registry + parse arm.
- Marker added; `core.json` + all derived feeds regenerated (real diff).
- Tests: handler (count → owed; auto-KO forced; park when genuine choice; zero-match
  no-op; hand + in-play scope) + parse arm + drift + marker-application.
- `pnpm --filter @legendary-arena/game-engine build` + `test` green; `pnpm -r build`
  + `pnpm -r --no-bail test` green.
- Hash surfaces unchanged (no fixture reaches Maestro).
- Governance: D-24353 → Active; STATUS Done; WORK_INDEX + EC_INDEX flipped; mindmap
  `📝` → `✅` + `pnpm roadmap:counts:write`.
- Commit topology: `EC-579:` (code + regenerated card data) + `SPEC:` (governance).
