# EC-581 — Core Supreme HYDRA Dynamic Victory Points (Execution Checklist)

**Source:** docs/ai/work-packets/WP-546-core-supreme-hydra-dynamic-victory-points.md
**Layer:** Game Engine (`packages/game-engine`) — scoring subsystem only

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Card confirmed: `node -e "const r=require('./data/cards/core.json');const v=r.villains.find(v=>v.slug==='hydra').cards.find(c=>c.slug==='supreme-hydra');process.exit(v.vp==='3*'?0:1)"` → exit 0 (`vp` is `"3*"`)
- [ ] Single scoring path present: `grep -q "export function computeFinalScores" packages/game-engine/src/scoring/scoring.logic.ts && grep -q "computeFinalScores(gameState)" packages/game-engine/src/ui/uiState.build.ts` → OK (HUD inherits the fold)
- [ ] Fallback path present: `grep -q "cardVictoryPoints?.\[cardId\] ?? VP_VILLAIN" packages/game-engine/src/scoring/scoring.logic.ts` → OK (the line to wrap)
- [ ] ext_id format confirmed: `grep -q "villain-\${groupSlug}-\${cardSlug}" packages/game-engine/src/villainDeck/villainDeck.setup.ts` → OK (group membership via `-villain-hydra-`)
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on a clean tree

## Locked Values (do not re-derive)
- **New module** `packages/game-engine/src/scoring/dynamicVictoryPoints.ts`:
  - `export const SUPREME_HYDRA_BASE_VP = 3;`
  - `export const SUPREME_HYDRA_BONUS_PER_OTHER_HYDRA_VILLAIN = 3;`
  - `isHydraGroupVillain(extId): boolean` — true iff `extId.includes('-villain-hydra-')` (the `-villain-` segment already excludes henchmen/bystanders).
  - `computeDynamicVillainVictoryPoints(cardId, victoryPile): number | null`:
    - If `cardId.includes('-villain-hydra-supreme-hydra-')`:
      `otherHydraVillainCount = victoryPile.filter(isHydraGroupVillain).length - 1` (excludes this instance; `- 1` because this Supreme HYDRA is itself a HYDRA villain in its own pile). Clamp negatives to 0 defensively (`Math.max(0, …)`).
      return `SUPREME_HYDRA_BASE_VP + SUPREME_HYDRA_BONUS_PER_OTHER_HYDRA_VILLAIN * otherHydraVillainCount`.
    - Else return `null`.
  - Pure: reads only the victory-pile ext_id strings. No `G` param, no `ctx`, no mutation, no `ctx.random`, no `.reduce()` with branching.
- **`computeFinalScores` fold** (`scoring.logic.ts`, `cardType === 'villain'` branch): replace
  `villainVP += gameState.cardVictoryPoints?.[cardId] ?? VP_VILLAIN;`
  with
  `const dynamicVp = computeDynamicVillainVictoryPoints(cardId, zones.victory);`
  `villainVP += dynamicVp ?? (gameState.cardVictoryPoints?.[cardId] ?? VP_VILLAIN);`
  — folded into `villainVP`; **NO** new `PlayerScoreBreakdown` field.
- **`scoring.types.ts` comment** (~line 18): update the "Card-text-specific VP modifiers … remain a future packet" note to record that Supreme HYDRA's modifier is delivered (D-24355); other `N*` / dynamic-VP cards remain deferred.
- **DECISIONS reservation:** **D-24355**.

## Guardrails
- **NO card-data / marker / ledger / regen.** A passive scoring modifier is NOT a timed `[effect:X]` ability — do NOT add a villain-effect marker (it would show `unsupported`, a false runtime-hollow, or force scoring into the timed-ability parser). The card correctly stays `(unmarked)` in the timed-effect villain-mechanic-ledger, exactly like Blob's `require-to-defeat`.
- Do NOT touch `normalizePrintedVictoryPoints` / the `"3*"` parse — the resolver overrides Supreme HYDRA's value entirely; no other Core card carries `*`.
- Do NOT add a `PlayerScoreBreakdown` field — fold into `villainVP` (no UIState / par / breakdown-type ripple).
- Do NOT generalize to a multi-card dynamic-VP registry — seed EXACTLY Supreme HYDRA (duplicate-first; the second dynamic-VP card earns the abstraction).
- Determinism: pure victory-pile string reads; no `ctx.random`; scoring never mutates `G` → no hashed-G field, no `finalStateHash` / `PRE_WP080_HASH` re-pin.

## Required `// why:` Comments
- On `computeDynamicVillainVictoryPoints`: `[icon:piercing]` is Victory Points in this data; this is a card-text VP modifier delivered per D-24355 (the `scoring.types.ts` "future packet"); seeded with one card, not generalized (duplicate-first).
- On the `- 1` in `otherHydraVillainCount`: "other HYDRA Villain" excludes this Supreme HYDRA instance, which is itself counted in its own victory pile.
- On the fold line: the dynamic resolver overrides the printed-VP/fallback path for known modifier villains; folded into `villainVP` (it is villain VP) to avoid a breakdown-type change.

## Files to Produce
- `packages/game-engine/src/scoring/dynamicVictoryPoints.ts` — **new** — resolver + constants + predicate
- `packages/game-engine/src/scoring/scoring.logic.ts` — **modified** — villain-branch fold
- `packages/game-engine/src/scoring/scoring.types.ts` — **modified** — comment update
- `packages/game-engine/src/scoring/dynamicVictoryPoints.test.ts` — **new** — resolver unit tests
- `packages/game-engine/src/scoring/scoring.logic.test.ts` — **modified** — integration (Supreme HYDRA VP in a full breakdown; winner flip)
- `docs/ai/DECISIONS.md` (D-24355 → Active) · `STATUS.md` · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-546 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `grep -nE "computeDynamicVillainVictoryPoints|SUPREME_HYDRA_BASE_VP|isHydraGroupVillain" packages/game-engine/src/scoring/*.ts` → present
- [ ] Fold in place: `grep -q "dynamicVp ??" packages/game-engine/src/scoring/scoring.logic.ts` → OK
- [ ] **No card-data / marker / ledger touched:** `git status --porcelain` shows ONLY `packages/game-engine/src/scoring/*` + governance docs (NO `data/cards/`, NO `scripts/convert-cards/`, NO `docs/ai/coverage/`)
- [ ] No breakdown-type change: `git diff packages/game-engine/src/scoring/scoring.types.ts` touches ONLY the comment (no new `PlayerScoreBreakdown` field)
- [ ] `grep -c "ctx.random\|Math.random" packages/game-engine/src/scoring/dynamicVictoryPoints.ts` → 0
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] Hash surfaces byte-identical (no fixture; scoring never touches `G`)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24355 landed (Active)
- [ ] Commit prefix `EC-581:` (engine + tests) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- Supreme HYDRA scores 1 (unchanged) → the fold used `dynamicVp && …` or the identity substring is wrong; it must be `dynamicVp ?? (… ?? VP_VILLAIN)` and match `-villain-hydra-supreme-hydra-`.
- Bonus off by 3 → the `- 1` (exclude self) was dropped, or a non-HYDRA villain slipped through `isHydraGroupVillain` (must match `-villain-hydra-`, not just `hydra`).
- A `data/cards/core.json` or `docs/ai/coverage/*` diff appears → wrong approach; this is engine-only (no marker). Revert the regen.
- A hash re-pin is requested → something wrote to `G`; the resolver must be a pure read of the victory pile.
- The HUD score doesn't reflect the bonus → you added a second scoring path instead of folding into `computeFinalScores` (the single source `uiState.build` calls).
