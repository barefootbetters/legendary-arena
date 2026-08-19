# EC-611 — Super Hero Civil War 2p Hero-Count Requirement (require 4) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-576-civil-war-2p-hero-count-requirement.md
**Layer:** Registry (`packages/registry`) authority + Game Engine (comment reconcile) + registry-viewer (test) — cross-layer

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Resolver present, no Civil War branch yet: `grep -q "export function resolveEffectiveHeroCount" …/playerCountSetup.ts && ! grep -q "super-hero-civil-war" …/playerCountSetup.ts` → OK
- [ ] Base table sizes 2p at 5: `grep -q "heroCount: 5" …/playerCountSetup.ts` → OK
- [ ] Engine downsize + stale comment present: `grep -q "CIVIL_WAR_2P_HERO_GROUPS" …/schemeSetupSizing.ts && grep -q "requires exactly 5 at 2p" …/schemeSetupSizing.ts` → OK
- [ ] Scaffold's one break still encodes old behaviour: `grep -q 'super-hero-civil-war", 2))?.row.heroCount, 5' apps/registry-viewer/src/lib/previewSetupRequirement.test.ts` → OK
- [ ] `pnpm --filter @legendary-arena/registry build && test` + `pnpm --filter @legendary-arena/game-engine build && test` exit 0 on a clean tree (engine baseline **2789/0**; the 3 pre-existing registry-viewer failures — `useLagnFromUrl` / `useLoadoutLagnExport` / `loadoutLagnImport` — are OUT of scope and unchanged)

## Locked Values (do not re-derive)
- `resolveEffectiveHeroCount` gains named consts `const CIVIL_WAR_SCHEME_ID = 'core/super-hero-civil-war';` and `const CIVIL_WAR_2P_HERO_COUNT = 4;` (mirroring `SECRET_INVASION_SCHEME_ID` / `SECRET_INVASION_HERO_COUNT`), plus ONE branch: `if (schemeId === CIVIL_WAR_SCHEME_ID && numPlayers === 2) return CIVIL_WAR_2P_HERO_COUNT;`. Place it AFTER the Secret Invasion branch, BEFORE `return baseHeroCount;`. Every other `(schemeId, numPlayers)` returns `baseHeroCount` unchanged.
- Require **EXACTLY 4** at 2p Civil War — not a 4-or-5 range, not `Math.min`. A 5-hero 2p Civil War loadout is now invalid.
- `resolveEffectiveHeroDeckIds` (`schemeSetupSizing.ts`) — **CODE UNCHANGED**. Only its doc comment is corrected: the clause "the loadout still provides and validates its normal 5 hero-deck ids (matchSetup.validate requires exactly 5 at 2p)" becomes "validation now requires exactly 4 at 2p (WP-576); the slice is a defensive no-op on a 4-id loadout."
- `previewSetupRequirement.test.ts:54` — change the assertion from `heroCount, 5` to `heroCount, 4` for `super-hero-civil-war @2p`; keep a non-override example (`core/midtown-bank-robbery @5p → 6`) for the base fall-through case.
- DECISIONS reservation: **D-24385**.

## Guardrails
- REQUIREMENT-side override ONLY (registry `resolveEffectiveHeroCount`) — the OPPOSITE class from the WP-515 engine downsize. Do NOT add a second engine code path; the slice already builds 4.
- Do NOT mutate the `PLAYER_COUNT_SETUP` base table (D-24165) or any scheme other than `core/super-hero-civil-war`, or any player count other than 2.
- Do NOT change either Civil War loss config (hero-deck-empty WP-510; per-count twist thresholds D-24178).
- No `ctx.random`, no I/O, no new persistent shape; no `data/cards` / marker / mechanic-ledger / effect-index / card change.
- `finalStateHash` / `PRE_WP080` byte-unchanged (no committed fixture reaches Civil War 2p) — verify, do NOT pre-pin.
- The 3 pre-existing registry-viewer failures are NOT this WP's to fix and NOT to be masked — leave them exactly as they are on `main`.

## Required `// why:` Comments
- On the Civil War branch in `resolveEffectiveHeroCount`: the printed "If only 2 players, use only 4 Heroes in the Hero Deck" (WP-576), a per-count requirement override — the sibling to Secret Invasion's flat "6 Heroes".
- On the corrected `resolveEffectiveHeroDeckIds` comment: validation now guarantees 4 ids at 2p (WP-576), so the `slice(0,4)` is a retained defensive no-op, not the sizing mechanism.

## Files to Produce
- `packages/registry/src/playerCountSetup.ts` — **modified** — Civil War 2p branch + consts + doc
- `packages/registry/src/playerCountSetup.test.ts` — **modified** — resolver cases (CW @2p→4, @3-5p→base, non-override→base, Secret Invasion→6)
- `apps/registry-viewer/src/lib/previewSetupRequirement.test.ts` — **modified** — line-54 assertion 5 → 4
- `packages/game-engine/src/setup/schemeSetupSizing.ts` — **modified** — stale comment only (code byte-identical)
- `packages/game-engine/src/matchSetup.contracts.test.ts` — **modified** — 2p Civil War accept-4 / reject-5
- `docs/ai/DECISIONS.md` (D-24385 → Active) · `STATUS.md` (D-24026 operator-pending) · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-576 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `grep -nE "CIVIL_WAR_SCHEME_ID|CIVIL_WAR_2P_HERO_COUNT" packages/registry/src/playerCountSetup.ts` → branch present
- [ ] `grep -c "requires exactly 5 at 2p" packages/game-engine/src/setup/schemeSetupSizing.ts` → **0** (comment corrected); `grep -c "slice(0, CIVIL_WAR_2P_HERO_GROUPS)" …` → still present (code unchanged)
- [ ] `git diff --name-only | grep -E '^(data/cards|data/metadata|docs/ai/coverage)'` → **NO MATCH**
- [ ] Registry + engine build/test exit 0; `previewSetupRequirement.test.ts` green; `pnpm -r build` + `pnpm -r --no-bail test` exit 0 (only the 3 pre-existing rv failures remain, unchanged)
- [ ] Hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24385 landed (Active)
- [ ] Commit prefix `EC-611:` (code) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- Builder still shows 5 / download still grayed at 4 → the branch wasn't added to `resolveEffectiveHeroCount`, or was added to the base table instead
- A 5-hero 2p Civil War loadout still validates → the branch returns `Math.min`/a range instead of exactly 4, or landed on the wrong scheme id
- A non-Civil-War scheme's 2p hero count changed → the branch isn't gated on both `schemeId` AND `numPlayers === 2`
- Engine `civilWarSizing` test fails → you changed `resolveEffectiveHeroDeckIds` CODE instead of only its comment (the slice must stay)
- Extra registry-viewer files "fixed" → those 3 failures are pre-existing drift; touching them is out of scope
- A `data/cards` / ledger file in the diff → this is a registry-logic + validation fix; no card-data change
