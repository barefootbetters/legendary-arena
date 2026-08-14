# EC-576 — Core Villain/Henchman Fight-Reward Effects (Execution Checklist)

**Source:** docs/ai/work-packets/WP-541-core-villain-fight-reward-effects.md
**Layer:** Game Engine (`packages/game-engine`) + Card Data

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Cards unmarked: `node -e "const m=require('./scripts/convert-cards/inputs/villain-effect-markers.json'); const h=m.henchmen.core||{}; const v=(m.villains.core||{}).hydra||{}; process.exit((h['hand-ninjas']?.fight||h['savage-land-mutates']?.fight||v['hydra-kidnappers']?.fight)?1:0)"` → unmarked
- [ ] Vocabulary + reuse target present: `grep -q VILLAIN_EFFECT_PRIMITIVES …/villainAbility.types.ts && grep -q override-next-hand-size …/villainEffects.execute.ts` → OK
- [ ] Reward surfaces present: `turnEconomy.recruit` + `piles.officers` + `handSizeOverrides` in `types.ts`
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on a clean tree

## Locked Values (do not re-derive)
- New primitives (append-only, D-24034 — union + `VILLAIN_EFFECT_PRIMITIVES` array moved together, 20 → 22): `gain-recruit-current`, `gain-officer-current`. Mirror `draw-cards-current` (keyword-less, self-narrating, single terminal `pushLog`, one `schemeTwistResolved`-style notable path if the file emits one per handler).
- `gain-recruit-current`: parse `:N` (default 1); `G.turnEconomy.recruit += N`. `gain-officer-current`: move ONE card from `G.piles.officers` to the current player's discard; **empty pile → logged no-op, never a throw**.
- Markers in `scripts/convert-cards/inputs/villain-effect-markers.json`:
  - `henchmen.core['hand-ninjas'].fight = ['gain-recruit-current:1']`
  - `villains.core.hydra['hydra-kidnappers'].fight = ['gain-officer-current']`
  - `henchmen.core['savage-land-mutates'].fight = ['override-next-hand-size:7']`  ← REUSE (no new primitive); `7 = HAND_SIZE (6) + 1`.
- Regen: `node scripts/convert-cards/apply-effect-markers.mjs` → `data/cards/core.json`; then regenerate ALL card-data-derived feeds (villain mechanic ledger, effect-implementation index, card-mechanics metadata — whatever the repo's `ledger:villains` / `effect-index` / `mechanics:metadata` scripts cover) or the "Hero/Villain Effect Coverage" freshness gate reddens `main`.
- HYDRA Kidnappers' "may gain an Officer" **auto-takes** (D-24350 — beneficial, no downside, no interactive choice).
- DECISIONS reservation: **D-24350**.

## Guardrails
- Append-only vocabulary — the two new primitives go at the END of the union + array (drift test moved together); do NOT reorder existing entries.
- Savage Land Mutates adds NO primitive — it's a marker reusing `override-next-hand-size:7`.
- No pending-choice / UIState / client change — all three auto-resolve (the "may" auto-takes).
- No `ctx.random`, no I/O, no new persistent shape; mutate `G` via the existing recruit-econ / pile-move / `handSizeOverrides` idioms.
- Regenerate EVERY card-data-derived feed after editing the marker map (partial regen = red `main`); byte-check `data/cards/core.json` is a REAL diff (3 markers), not CRLF noise (`git diff --numstat`).
- Do NOT mark Blob (already handled), Maestro, Endless Armies, The Leader, or Supreme HYDRA — out of scope.
- Keep the v1 curation discipline: only these three unconditional/magnitude-1/single-target lines are marked.

## Required `// why:` Comments
- On `gain-officer-current`'s auto-take: HYDRA Kidnappers' "may gain an Officer" is a pure benefit with no downside → auto-take, no interactive choice (D-24350).
- On the Savage Land marker `override-next-hand-size:7`: `7 = HAND_SIZE (6) + 1` ("draw an extra card"); the primitive sets an absolute next-hand size.
- On `gain-officer-current`'s empty-pile branch: an empty Officer pile is a logged no-op (never a throw).

## Files to Produce
- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — union + array (2 primitives)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — 2 handlers + registry + parse
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** — 3 markers
- `data/cards/core.json` — **modified** — regenerated (3 `[effect:…]` markers)
- villain mechanic ledger + effect-implementation index (+ card-mechanics) — **modified** — regenerated feeds
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` (+ primitive drift test + marker test) — **modified**
- `docs/ai/DECISIONS.md` (D-24350 → Active) · `STATUS.md` (D-24026 operator-pending) · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-541 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `grep -nE "gain-recruit-current|gain-officer-current" villainAbility.types.ts villainEffects.execute.ts` → union+array+handlers present
- [ ] `node -e "const s=JSON.stringify(require('./data/cards/core.json')); process.exit(s.includes('gain-recruit-current')&&s.includes('gain-officer-current')&&s.includes('override-next-hand-size:7')?0:1)"` → exit 0
- [ ] `git diff --numstat data/cards/core.json` → a real `+N` (not 0/0); all derived feeds regenerated + clean on re-run
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] Hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24350 landed (Active)
- [ ] Commit prefix `EC-576:` (code + regenerated card data) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- CI "Hero/Villain Effect Coverage" red though tests pass → a card-data-derived feed (villain ledger / effect index / card-mechanics) wasn't regenerated after the marker edit
- `data/cards/core.json` shows dirty but `git diff --numstat` is 0/0 → CRLF-only noise; regen didn't actually mark (check the group/card slug + timing key in the marker map)
- `gain-officer-current` throws on an empty Officer pile → guard it as a logged no-op
- Savage Land draws 8, not 7 → the marker used the Doc Ock value; it's `override-next-hand-size:7` (HAND_SIZE + 1)
- The drift test fails (21 vs 22) → the union and the `VILLAIN_EFFECT_PRIMITIVES` array weren't both updated
- A pending-choice appears for HYDRA Kidnappers → the "may" auto-takes; no interactive resolution
