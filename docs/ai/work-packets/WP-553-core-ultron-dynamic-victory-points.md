# WP-553 — Core Ultron Dynamic Victory Points

**Status:** Draft 2026-08-15
**Layer:** Game Engine (`packages/game-engine`) — scoring subsystem only
**Depends on:** WP-546 / D-24355 (the `scoring/dynamicVictoryPoints.ts` resolver this
extends) · WP-365 / D-24157 (printed-VP scoring snapshot) · WP-020 (`computeFinalScores`)
**Reserves:** EC-588 · D-24362
**Lane:** Standard (engine-scoring-only; the SECOND dynamic-VP card). **No card-data /
marker / ledger change.**

---

## 1. Problem

**Ultron** (`villain core/masters-of-evil/ultron`) has two abilities:

1. *"Ultron is worth +1`[icon:piercing]` for each `[hc:tech]` Hero you have among all
   your cards at the end of the game."* — a **dynamic end-of-game VP modifier** (`vp` is
   the string `"2+"`; the `+` marks a dynamic value). **Unimplemented.**
2. *"Escape: Each player reveals a `[hc:tech]` Hero or gains a Wound."*
   (`[effect:reveal-or-wound:hc:tech]`) — **already implemented** (WP-469). **Out of scope.**

`[icon:piercing]` renders **victory points** in this data (the same convention WP-546
established for Supreme HYDRA). Because `Number("2+")` is `NaN`, `normalizePrintedVictoryPoints`
returns `undefined`, no `G.cardVictoryPoints` entry is written, and Ultron falls back to
`VP_VILLAIN = 1` — understating even its **base 2**, and missing the whole per-Tech-Hero
bonus.

**This was caught live** at WP-546's own verify (match `U6aE2N1IW0k`): Ultron in a
victory pile scored 1, and the VP tally only reconciled because Ultron was treated as the
flat fallback. Ultron is the **second** card-text dynamic-VP modifier — the one WP-546's
STATUS entry named as the next in line.

## 2. Design — extend the WP-546 resolver

WP-546 created `computeDynamicVillainVictoryPoints(cardId, victoryPile): number | null`,
seeded with exactly Supreme HYDRA, and deferred generalization under duplicate-first.
**Ultron is the second card, so the abstraction is now earned** — extend the one resolver.

**The key difference from Supreme HYDRA:** Supreme HYDRA counts other HYDRA villains **in
the victory pile**; Ultron counts `[hc:tech]` Heroes **among ALL your cards** (deck +
hand + discard + in-play + victory). So the resolver needs more context than the victory
pile alone.

### 2.1 Signature extension

```
export function computeDynamicVillainVictoryPoints(
  cardId: CardExtId,
  victoryPile: readonly CardExtId[],
  allPlayerCardIds: readonly CardExtId[],
  cardTraits: Record<CardExtId, { heroClass: string | null; team: string | null }>,
): number | null
```

- **Supreme HYDRA branch — unchanged.** Still reads `victoryPile` only. Its behavior and
  tests are preserved verbatim (only their call sites gain the two new args).
- **New Ultron branch** (`cardId.includes('-villain-masters-of-evil-ultron-')`):
  `ULTRON_BASE_VP + ULTRON_BONUS_PER_TECH_HERO * countTechHeroesAmongCards(allPlayerCardIds, cardTraits)`.
- Constants: `ULTRON_BASE_VP = 2`, `ULTRON_BONUS_PER_TECH_HERO = 1`.
- Helper `countTechHeroesAmongCards(cardIds, cardTraits)`: count `cardIds` where
  `cardTraits[id]?.heroClass === 'tech'`. (Only Hero cards carry a `heroClass`; starting
  S.H.I.E.L.D. cards, wounds, villains, henchmen, bystanders are `null`/absent → not
  counted.) Pure; no `.reduce()` with branching.

### 2.2 Call-site change (`scoring.logic.ts`)

In `computeFinalScores`, build the player's full card list **once per player** (before the
victory loop) and pass it + `gameState.cardTraits`:

```
const allPlayerCardIds = [
  ...zones.deck, ...zones.hand, ...zones.discard, ...zones.inPlay, ...zones.victory,
];
// … inside the victory loop, villain branch:
const dynamicVp = computeDynamicVillainVictoryPoints(
  cardId, zones.victory, allPlayerCardIds, gameState.cardTraits,
);
villainVP += dynamicVp ?? (gameState.cardVictoryPoints?.[cardId] ?? VP_VILLAIN);
```

Folded into `villainVP` — **no new `PlayerScoreBreakdown` field**. `computeFinalScores` is
the single scoring path, so the HUD counter (`uiState.build`), par baselines, and final
scoring all inherit it.

## 3. Determinism / persistence

- Pure reads of the player's zone card-id strings + the `cardTraits` setup snapshot; **no
  `ctx.random`**, no `G` mutation.
- Scoring is a derived view, never stored in `G` — **no** hashed-`G` field, **no**
  `finalStateHash` / `PRE_WP080_HASH` re-pin (no committed fixture defeats Ultron — verify).

## 4. Out of scope

- Ultron's **Escape** ability (`reveal-or-wound:hc:tech`) — already implemented (WP-469).
- `normalizePrintedVictoryPoints` / the `"2+"` parse — untouched (the resolver overrides
  Ultron's value entirely).
- amwp / 3dtc dynamic-VP cards — each a future packet.
- Any `PlayerScoreBreakdown` shape change, marker, card-data, or ledger edit.
- **Coverage interplay (follow-on, not this WP):** once WP-548 (subsystem-coverage) lands,
  add `core-villain-masters-of-evil-ultron` → `scoring:dynamic-vp` to its allowlist so
  Ultron reads as covered in `/debug/effects`.

## 5. Definition of Done

- `dynamicVictoryPoints.ts`: extended signature + Ultron branch + constants + the
  `countTechHeroesAmongCards` helper; Supreme HYDRA branch unchanged.
- `scoring.logic.ts`: builds `allPlayerCardIds` per player and passes it + `cardTraits`.
- Tests: Ultron with 0 / 1 / N tech Heroes across zones → 2 / 3 / (2 + N); a victory pile
  with no tech Heroes → base 2; a non-Ultron / non-modifier villain → `null`; the existing
  Supreme HYDRA tests updated to the new signature and still passing; an integration case
  in `scoring.logic.test.ts` (Ultron in a full breakdown with tech Heroes across zones).
- `pnpm -r build` + `pnpm -r --no-bail test` green; `git status` shows only
  `packages/game-engine/src/scoring/*` + governance.
- Hash surfaces byte-identical; no `ctx.random`.
- Governance: D-24362 → Active; STATUS; WORK_INDEX `[x]`; EC-588 Done; mindmap `📝` → `✅`
  + `roadmap:counts:write`.
- Commit topology: `EC-588:` (engine + tests) + `SPEC:` (governance).
