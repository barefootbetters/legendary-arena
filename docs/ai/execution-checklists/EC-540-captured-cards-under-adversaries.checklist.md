# EC-540 — Captured Cards Under Villains & Mastermind (Execution Checklist)

**Source:** docs/ai/work-packets/WP-505-captured-cards-under-adversaries.md
**Layer:** Game Engine (UIState projection) + App (arena-client render) — cross-layer

## Before Starting
- [ ] WP-214/EC-246 on `main`: `UICityCard.attachedHeroes` projected in `uiState.build.ts` AND passed through `deepCopyCitySpaces` in `uiState.filter.ts`.
- [ ] WP-154 on `main`: `mastermind.attachedBystanders` projected; `MastermindTile.vue` renders it.
- [ ] `G.attachedBystanders` populated at runtime — primary site `villainDeck.reveal.ts` (revealed bystander → frontmost city villain); also the `captureBystander` villain effect + `schemeTwistResolvers.ts`. Keyed by villain zone-instance ext_id.
- [ ] Scope lock — EXACT target set = the `Files to Produce` list below. Any edit outside it is a FAIL; surface as a blocker first.
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.

## Locked Values (do not re-derive)
- New `UICityCard` field: `attachedHeroDisplay: UICardDisplay[]` — index-aligned with `attachedHeroes: string[]` (same length, same order); each entry = `resolveDisplay(heroExtId, gameState)`.
- New `UICityCard` field: `attachedBystanderCount: number` = `G.attachedBystanders[space]?.length ?? 0` — COUNT ONLY, never ext_ids/display.
- Both new fields are PUBLIC — survive `filterUIStateForAudience` for every audience.
- Mastermind side: NO engine change — render `mastermind.attachedBystanders.length` in `MastermindTile.vue`.
- Bystander badge copy: "N captured", count-only, with `aria-label`; render nothing when count is 0.
- `uiState.types.drift.test.ts` `UICityCard` `Object.keys().sort()` = exactly `['attachedBystanderCount','attachedHeroDisplay','attachedHeroes','display','extId','fightCost','keywords','type']` (adds the two new fields AND repairs the missing WP-214 `attachedHeroes`/`fightCost`).
- Enforcement: arena-client `vue-tsc` is the ONLY compile-time enforcer of required-field backfill; game-engine `.test.ts` files are `tsc`-excluded and `tsx`-type-stripped, so the drift `Object.keys` assertion is the game-engine guard.
- `G.attachedBystanders` key space = villain zone-instance ext_id = the city loop's `space` var → `G.attachedBystanders[space]?.length ?? 0`.

## Guardrails
- 5-step Board-Visible Field Rule is mandatory for BOTH new fields: type → build → filter passthrough → filter test → diagnostics snapshot. A field populated but not passed through `deepCopyCitySpaces` is silently dropped (EC-206 / PR #1165 failure mode).
- Bystanders are FACE DOWN: project a count only. Do NOT project bystander ext_ids or display for city villains (no identity leak).
- Face-up heroes need the display payload — the client has no ext_id→image resolver; `attachedHeroes` ext_ids alone cannot render art.
- Both new fields are REQUIRED (not optional): backfill EVERY enumerated `UICityCard`-literal site (see Files to Produce). arena-client `vue-tsc` catches misses; the game-engine drift `Object.keys` assertion catches the engine-side fixture.
- Audience-filter test must be NON-VACUOUS: use a fixture with `attachedBystanderCount > 0` and a non-empty `attachedHeroDisplay`, and assert EXACT equality (count value + hero-display length/order index-aligned to `attachedHeroes`) for owner, opponent, and spectator — never mere key-presence or truthiness (count `0` is falsy).
- Do NOT change the type of the existing `attachedHeroes: string[]` field or the `mastermind.attachedBystanders` projection — additive only.
- Comment discipline: correct the FALSE "mastermind ships []/no source today" claims, but PRESERVE (reworded) the still-valid "never flatten city captures onto the mastermind tile" prohibition — do not delete it.
- STOP means HARD STOP: if a `Before Starting` precondition is false, fix-and-reverify or abort-and-report; do not improvise.

## Required `// why:` Comments
- `uiState.build.ts` city projection: why `attachedBystanderCount` is a count only (face-down = identity hidden, D-24311); note city bystanders render on the CITY card and are still never flattened onto the mastermind (prohibition preserved, false "no source" claim removed).
- `uiState.filter.ts` `deepCopyCitySpaces`: why both new fields are copied through unredacted (public board state).
- `MastermindTile.vue`: remove the stale "SAFE-SKIP-WP128 ships []" header claim (false since D-15401); the count badge reads the real `attachedBystanders`.

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — add both fields to `UICityCard`; rewrite stale comment
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate both fields; rewrite safe-skip comment
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — pass both through `deepCopyCitySpaces`
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — assert projection (hero display index-aligned; bystander count)
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — assert both survive the audience filter (all audiences), non-vacuously
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified (MANDATORY)** — backfill the `UICityCard` fixture; change the `Object.keys().sort()` assertion to the 8-key set (below)
- `apps/arena-client/src/components/play/CityRow.vue` — **modified** — render face-up hero art + bystander count badge
- `apps/arena-client/src/components/play/CityRow.test.ts` — **modified** — cover render + fixture backfill
- `apps/arena-client/src/components/play/MastermindTile.vue` — **modified** — swap `<li>` list for count badge; correct the stale "ships []/no source" header
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — **modified** — cover the badge
- `apps/arena-client/src/composables/useCityRow.test.ts` — **modified** — backfill the two required `UICityCard` fields
- `apps/arena-client/src/preplan/mutationDetector.test.ts` — **modified** — backfill the two required `UICityCard` fields
- `apps/arena-client/src/fixtures/uiState/mid-turn.json` + `endgame-loss.json` + `endgame-win.json` — **modified** — backfill non-null city spaces (each is bound `satisfies UIState` in `fixtures/uiState/typed.ts`)
- `docs/ai/DECISIONS.md` — **modified** — land D-24311
- `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md` — **modified** — governance close

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] Live-on-surface verification (D-24026): captured hero renders as art + captured bystanders render as a count badge under the holding villain/mastermind on a real match
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24311 landed (flip "DRAFTED" → active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` glyph → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- Blank space / "No rules text" under a villain = display payload not projected; the field reached build but not the filter passthrough (5-step step 3 missed).
- arena-client `vue-tsc` errors on `UICityCard` literals = a fixture missing one of the two required new fields.
- Bystander badge shows on the mastermind but not city villains = `attachedBystanderCount` not populated in `buildUIState` (or `G.attachedBystanders` keyed differently than expected — it keys by zone-instance ext_id, same as `attachedHeroes`).
