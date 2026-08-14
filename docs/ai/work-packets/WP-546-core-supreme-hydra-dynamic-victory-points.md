# WP-546 — Core Supreme HYDRA Dynamic Victory Points

**Status:** Draft 2026-08-14
**Layer:** Game Engine (`packages/game-engine`) — scoring subsystem only
**Depends on:** WP-365 / D-24157 (printed-VP scoring snapshot `G.cardVictoryPoints`
+ the `cardVictoryPoints ?? VP_VILLAIN` fallback) · WP-020 (`computeFinalScores`,
the single scoring path)
**Reserves:** EC-581 · D-24355
**Lane:** Standard two-session (one card, one scoring resolver, a D). **Engine-only —
no card-data / marker / ledger change.**

---

## 1. Problem

The **last** hollow Core villain card is **Supreme HYDRA**
(`villain core/hydra/supreme-hydra`):

> **Supreme HYDRA is worth +3`[icon:piercing]` for each other HYDRA Villain in your
> Victory Pile.**

Implementing it completes the Core villain/henchman batch (Master Strikes 4/4, scheme
twists 8/8, and — with WP-541/542/544 — every villain/henchman Fight ability).

### 1.1 `[icon:piercing]` is Victory Points, not a combat keyword

Despite the "piercing" name, `[icon:piercing]` renders the card's **victory-point
worth** in this data. Corroborating text across the corpus:

- `3dtc`: *"This Bystander is worth +1`[icon:piercing]` for each Hero you have that
  costs 7 or more."*
- `amwp`: *"a Villain worth 2`[icon:piercing]` or less"*, *"You get +1`[icon:attack]`
  for each Villain worth 2`[icon:piercing]` or less in your Victory Pile."*
- `core` (one line below Supreme HYDRA): *"Ultron is worth +1`[icon:piercing]` for
  each `[hc:tech]` Hero you have ... at the end of the game."*

So Supreme HYDRA is a **dynamic end-of-game VP modifier**, not a combat/attack
mechanic. (The roadmap shorthand "dynamic piercing" was a misnomer carried from the
icon name.)

### 1.2 Today it scores the flat fallback

`buildCardVictoryPoints` runs `normalizePrintedVictoryPoints(card.vp)`. Supreme HYDRA's
`vp` is the string `"3*"` (the `*` marks a dynamic value). `Number("3*")` is `NaN`, so
the normalizer returns `undefined` → **no** `G.cardVictoryPoints` entry → scoring falls
back to `VP_VILLAIN = 1`. So today Supreme HYDRA scores a flat **1**, with **both** its
base (3) and its per-HYDRA bonus unimplemented.

This is the **first card-text VP modifier** — `scoring.types.ts:18` explicitly parks
these: *"Card-text-specific VP modifiers ('this card is worth +N VP') remain a future
packet."* This WP is that packet, for this one card.

## 2. Why it is engine-only (no marker, no card-data change)

A **passive scoring modifier is not a timed ability.** The `[effect:X]` marker
pipeline (`buildVillainAbilityHooks` → `onFight` / `onAmbush` / `onEscape`) is for
abilities that fire at a hook timing. Supreme HYDRA's worth is read once at scoring
time; it has no timing. Two consequences:

1. **Do not give it an `[effect:X]` marker.** The villain-ability parser would either
   not resolve it (→ `unsupported`, a false runtime-hollow) or force scoring logic into
   the timed-ability parser — the wrong layer.
2. **It stays `(unmarked)` in the villain-mechanic-ledger by design** — exactly like
   Blob, whose `[require-to-defeat:team:x-men]` is implemented in the setup subsystem
   yet still reads `(unmarked)` in the *timed-effect* ledger (`villain-mechanic-ledger.csv`
   tracks `[effect:X]` mechanics only). Coverage of scoring modifiers is a scoring-subsystem
   concern, verified by scoring tests — not by the timed-effect ledger.

**Proactive observation (out of scope, follow-on):** because of §2.2, `/debug/effects`
will continue to list Supreme HYDRA as `(unmarked)` after this ships (as it does Blob).
A separate small follow-on could teach the coverage viewer to recognize
scoring-subsystem / defeat-requirement coverage so "complete the Core set" is verifiable
from the dashboard. Not bundled here.

## 3. Contract (locked)

### 3.1 Group membership comes free from the ext_id

Villain instance ext_ids are `{setAbbr}-villain-{groupSlug}-{cardSlug}-{copy}`
(`villainCardInstanceExtIds`). So a card in a victory pile is a **HYDRA-group villain**
iff its ext_id contains the `-villain-hydra-` segment — no new `G` snapshot is needed,
and the `-villain-` segment already excludes henchmen/bystanders.

### 3.2 New scoring resolver

New module `packages/game-engine/src/scoring/dynamicVictoryPoints.ts`:

```
export const SUPREME_HYDRA_BASE_VP = 3;
export const SUPREME_HYDRA_BONUS_PER_OTHER_HYDRA_VILLAIN = 3;

/**
 * Returns a villain card's full dynamic VP when it is a known card-text VP-modifier
 * villain, or null when the card has no dynamic rule (caller uses the printed-VP path).
 * Pure — reads only the victory-pile ext_id strings; no G mutation, no ctx.
 */
export function computeDynamicVillainVictoryPoints(
  cardId: CardExtId,
  victoryPile: readonly CardExtId[],
): number | null
```

- Seeded with **exactly** Supreme HYDRA. Identity: `cardId` contains
  `-villain-hydra-supreme-hydra-`.
- `otherHydraVillainCount = (count of victoryPile ext_ids containing '-villain-hydra-') - 1`
  (the `- 1` excludes this Supreme HYDRA instance itself; "other HYDRA Villain").
  Never negative in practice — this card is always in its own victory pile when scored.
- Return `SUPREME_HYDRA_BASE_VP + SUPREME_HYDRA_BONUS_PER_OTHER_HYDRA_VILLAIN * otherHydraVillainCount`.
- Any other `cardId` → `null`.

Use a named helper `isHydraGroupVillain(extId)` (matches `-villain-hydra-`) so the
predicate reads clearly. **Do not generalize** to a multi-card registry — one card,
duplicate-first (`.claude/rules/code-style.md` §Abstraction); the second dynamic-VP
card earns the abstraction.

### 3.3 Fold into `computeFinalScores`

In `scoring.logic.ts`, the `cardType === 'villain'` branch becomes:

```
const dynamicVp = computeDynamicVillainVictoryPoints(cardId, zones.victory);
villainVP += dynamicVp ?? (gameState.cardVictoryPoints?.[cardId] ?? VP_VILLAIN);
```

Folded into `villainVP` — it *is* villain VP. **No `PlayerScoreBreakdown` field is
added** (no UIState / par / breakdown-type ripple). `computeFinalScores` is the single
scoring path (`uiState.build` HUD counter, `parScoring.logic` baselines, final
scoring), so all three inherit the dynamic VP automatically.

### 3.4 Comment update

Update `scoring.types.ts:18` — the "future packet" note now reads that dynamic VP
modifiers are delivered for Supreme HYDRA (D-24355); other `N*` / dynamic-VP cards
remain deferred.

## 4. Determinism / persistence

- Pure reads of victory-pile ext_id **strings**; **no `ctx.random`**, no `G` mutation.
- Scoring is a derived view, **never stored in `G`** — so this introduces **no** hashed-G
  field and **no** `finalStateHash` / `PRE_WP080_HASH` re-pin surface.

## 5. Out of scope

- Ultron / `amwp` / `3dtc` dynamic-VP cards (each a future packet; their bases stay on
  the fallback, their modifiers deferred).
- The `normalizePrintedVictoryPoints` `"3*"` parse — untouched (the resolver overrides
  Supreme HYDRA's value entirely, so the fallback path is never reached for it; no other
  Core card carries `*`).
- Any coverage-viewer change to surface scoring-subsystem coverage (follow-on, §2).
- `PlayerScoreBreakdown` shape; any marker / card-data / ledger regen.

## 6. Definition of Done

- `scoring/dynamicVictoryPoints.ts` added (resolver + constants + `isHydraGroupVillain`);
  `computeFinalScores` villain branch folds it into `villainVP`; `scoring.types.ts`
  comment updated.
- Tests (`scoring.logic.test.ts` + a `dynamicVictoryPoints.test.ts`): Supreme HYDRA with
  0 / 1 / 2 other HYDRA villains in the pile (3 / 6 / 9 VP); a Supreme HYDRA whose pile
  has non-HYDRA villains only (base 3); a normal villain still scores printed/fallback
  unchanged; the winner flips correctly when the bonus decides it.
- `pnpm --filter @legendary-arena/game-engine build` + `test` green; `pnpm -r build` +
  `pnpm -r --no-bail test` green.
- Hash surfaces byte-identical (scoring never touches `G`; no fixture change).
- No card-data / marker / ledger regen (verify `git status` shows only engine + tests +
  governance).
- Governance: D-24355 → Active; STATUS Done; WORK_INDEX + EC_INDEX flipped; mindmap
  `📝` → `✅` + `pnpm roadmap:counts:write`.
- Commit topology: `EC-581:` (engine code + tests) + `SPEC:` (governance). No card data
  in the code commit.
