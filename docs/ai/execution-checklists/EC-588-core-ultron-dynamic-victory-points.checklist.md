# EC-588 — Core Ultron Dynamic Victory Points (Execution Checklist)

**Source:** docs/ai/work-packets/WP-553-core-ultron-dynamic-victory-points.md
**Layer:** Game Engine (`packages/game-engine`) — scoring subsystem only. **No card-data /
marker / ledger change.**

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Card confirmed: `node -e "const r=require('./data/cards/core.json');const c=r.villains.find(v=>v.slug==='masters-of-evil').cards.find(c=>c.slug==='ultron');process.exit(c.vp==='2+'?0:1)"` → exit 0
- [ ] WP-546 resolver present: `grep -q "export function computeDynamicVillainVictoryPoints" packages/game-engine/src/scoring/dynamicVictoryPoints.ts` → OK
- [ ] Call site present: `grep -q "computeDynamicVillainVictoryPoints(cardId, zones.victory)" packages/game-engine/src/scoring/scoring.logic.ts` → OK (the line to extend)
- [ ] cardTraits shape: `grep -q "heroClass: string | null" packages/game-engine/src/state/cardTraits.types.ts` → OK
- [ ] Escape already done (do NOT touch): `grep -q "reveal-or-wound:hc:tech" data/cards/core.json` → OK
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on a clean tree

## Locked Values (do not re-derive)
- **New constants** (in `dynamicVictoryPoints.ts`): `ULTRON_BASE_VP = 2`, `ULTRON_BONUS_PER_TECH_HERO = 1`.
- **New helper** `countTechHeroesAmongCards(cardIds, cardTraits): number` — count `cardIds` where `cardTraits[id]?.heroClass === 'tech'`. Pure; no `.reduce()` with branching.
- **Extend the resolver signature** to
  `computeDynamicVillainVictoryPoints(cardId, victoryPile, allPlayerCardIds, cardTraits): number | null`
  where `cardTraits: Record<CardExtId, { heroClass: string | null; team: string | null }>`.
  - **Supreme HYDRA branch — UNCHANGED** (reads `victoryPile` only; do not alter its logic or constants).
  - **New Ultron branch** (`cardId.includes('-villain-masters-of-evil-ultron-')`):
    `return ULTRON_BASE_VP + ULTRON_BONUS_PER_TECH_HERO * countTechHeroesAmongCards(allPlayerCardIds, cardTraits);`
  - All other `cardId` → `null` (unchanged).
- **Call site** (`scoring.logic.ts`, `computeFinalScores`): build `const allPlayerCardIds = [...zones.deck, ...zones.hand, ...zones.discard, ...zones.inPlay, ...zones.victory];` **once per player** (before/above the `for (const cardId of zones.victory)` loop), then the villain branch becomes
  `const dynamicVp = computeDynamicVillainVictoryPoints(cardId, zones.victory, allPlayerCardIds, gameState.cardTraits);`
  `villainVP += dynamicVp ?? (gameState.cardVictoryPoints?.[cardId] ?? VP_VILLAIN);`
  — folded into `villainVP`; **NO** new `PlayerScoreBreakdown` field.
- **DECISIONS reservation:** D-24362.

## Guardrails
- **NO card-data / marker / ledger / regen.** A passive scoring modifier is not a timed `[effect:X]` ability. (Ultron's Escape `reveal-or-wound:hc:tech` is already implemented — do NOT touch it or `data/cards/`.)
- Do NOT touch `normalizePrintedVictoryPoints` / the `"2+"` parse — the resolver overrides Ultron's value entirely.
- Do NOT add a `PlayerScoreBreakdown` field — fold into `villainVP`.
- Do NOT alter the Supreme HYDRA branch's behavior — only its call signature gains args it ignores.
- Determinism: pure reads of zone card-id strings + the `cardTraits` snapshot; no `ctx.random`; scoring never mutates `G` → no `finalStateHash` / `PRE_WP080_HASH` re-pin.
- Build `allPlayerCardIds` ONCE per player, not once per victory card (avoid rebuilding inside the loop).

## Required `// why:` Comments
- On the Ultron branch: `[icon:piercing]` is Victory Points; Ultron counts `[hc:tech]` Heroes among ALL the player's cards (every zone), NOT just the victory pile — the distinction from Supreme HYDRA. Delivered per D-24362.
- On `countTechHeroesAmongCards`: only Hero cards carry a `heroClass`; non-hero cards are `null`/absent and are not counted.
- On building `allPlayerCardIds` once per player: end-of-game "all your cards" = every zone; hoisted out of the victory loop.

## Files to Produce
- `packages/game-engine/src/scoring/dynamicVictoryPoints.ts` — **modified** — signature + Ultron branch + constants + helper
- `packages/game-engine/src/scoring/dynamicVictoryPoints.test.ts` — **modified** — Ultron cases + Supreme HYDRA calls updated to the new signature
- `packages/game-engine/src/scoring/scoring.logic.ts` — **modified** — build `allPlayerCardIds`, pass it + `cardTraits`
- `packages/game-engine/src/scoring/scoring.logic.test.ts` — **modified** — Ultron integration + winner interaction
- `docs/ai/DECISIONS.md` (D-24362 → Active) · `STATUS.md` · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-553 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `grep -nE "ULTRON_BASE_VP|countTechHeroesAmongCards|masters-of-evil-ultron" packages/game-engine/src/scoring/dynamicVictoryPoints.ts` → present
- [ ] Signature threaded: `grep -q "allPlayerCardIds" packages/game-engine/src/scoring/scoring.logic.ts` → OK
- [ ] **No card-data / marker / ledger touched:** `git status --porcelain` shows ONLY `packages/game-engine/src/scoring/*` + governance docs (NO `data/cards/`, NO `docs/ai/coverage/`, NO markers)
- [ ] Supreme HYDRA branch behavior unchanged (its existing tests pass, only their call args updated); no `PlayerScoreBreakdown` field added
- [ ] `grep -c "ctx.random\|Math.random" packages/game-engine/src/scoring/dynamicVictoryPoints.ts` → 0
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] Hash surfaces byte-identical (no fixture defeats Ultron)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP `✅` + counts; D-24362 Active
- [ ] Commit prefix `EC-588:` (engine + tests) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- Ultron scores 1 (unchanged) → the Ultron identity substring is wrong or the call site still passes 2 args; it must be `-villain-masters-of-evil-ultron-` and the resolver must receive `allPlayerCardIds` + `cardTraits`.
- Ultron counts only victory-pile tech Heroes → you passed `zones.victory` instead of `allPlayerCardIds`; Ultron counts EVERY zone.
- Supreme HYDRA tests fail to compile → update their call sites to the 4-arg signature (pass `[]` / `{}` for the unused args, or realistic values).
- A `data/cards/*.json` or `docs/ai/coverage/*` diff appears → wrong approach; this is engine-scoring-only. Revert.
- A hash re-pin is requested → something wrote to `G`; the resolver + call site must be pure reads.
- SHIELD Agents/Troopers inflate the count → they have `heroClass: null`; only `heroClass === 'tech'` counts.
