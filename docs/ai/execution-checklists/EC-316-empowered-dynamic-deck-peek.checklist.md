# EC-316 — Empowered Dynamic: Deck-Peek Class Resolution (Execution Checklist)

**Source:** docs/ai/work-packets/WP-284-empowered-dynamic-deck-peek.md
**Layer:** Game Engine

## Before Starting

- [ ] **WP-283 ✅ on `main`** — EC-315 fully executed; `max-class-count-in-zone` type live
- [ ] WP-282 ✅ on `main` (baseline `70c8ce34`)
- [ ] D-24063 + D-24064 (WP-283 decisions) are `Active` in `DECISIONS.md`
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — **≥ 1563 pass / 0 fail**
  (WP-283 post-execution baseline)
- [ ] Read `packages/game-engine/src/rules/effectPrimitive.types.ts` in full
  (post-WP-283 state — includes `max-class-count-in-zone`)
- [ ] Read `packages/game-engine/src/setup/heroAbility.setup.ts` in full
  (post-WP-283 state — includes all empowered dispatch chain paths)
- [ ] Read `packages/game-engine/src/hero/effectPrimitive.interpret.ts` in full

## Locked Values (do not re-derive)

- New `ValueExpressionType` string literal: **`'top-deck-card-class-count-in-zone'`**
- `VALUE_EXPRESSION_TYPES` drift array grows from **3 → 4** entries (post-WP-283 baseline is 3)
- Dynamic composition shape: `{ type: 'gain-resource', resource: 'attack', amount: { type: 'top-deck-card-class-count-in-zone', zone: 'hq' } }`
- `cross-the-multiverse` triggering ability: `"[keyword:What If...?]: You get [keyword:Empowered] by the Hero Classes of the card you revealed this way."`
  — **`wtif.json` is byte-unchanged**
- Evaluator empty-deck guard: `deck.length === 0` or `heroClass` absent/null → return **0**
- Dispatch chain order: `tryResolveEmpoweredDynamic` runs LAST — after `tryResolveEmpoweredCore`, `tryResolveEmpoweredConditionalPrefix`, `tryResolveEmpoweredFreeChoice`, and (pre-pass) `tryResolveEmpoweredChooseOneLine`
- `DECISIONS.md` D-entries reserved: **D-24065** (dynamic-empowered decision) + **D-24066** (`top-deck-card-class-count-in-zone` type)
- Post-WP-283 baseline test count: **≥ 1563** (target post-WP-284: ≥ **1569**)

## Guardrails

1. **D-24030 closed-union:** All four surfaces updated in same commit — `ValueExpressionType` union, `VALUE_EXPRESSION_TYPES` array, `TopDeckCardClassCountInZoneExpression` interface, evaluator dispatch. Missing any = FAIL.
2. **No zone mutation (D-24065):** Evaluator reads `G.playerZones[playerID].deck[0]` only. Never splices, moves, or modifies the deck array. No `MoveCardNode` involved.
3. **Dispatch-chain tail position:** `tryResolveEmpoweredDynamic` is called only after all other empowered resolvers fail. Do not reorder.
4. **Single-class MVP:** `heroClass` is `string | null`. If null, empty string, not a `string`, or absent → return 0. Multi-class array parsing is out of scope.
5. **No card data change:** `wtif.json` is byte-unchanged. The `[keyword:What If...?]` token is already invisible to the parser (cannot match `KEYWORD_PATTERN`); no suppression needed.
6. **No `.reduce()`:** HQ counting uses `for...of`.
7. **`heroKeywords.ts` byte-unchanged.** `game.test.ts` NOT in the allowlist.

## Required `// why:` Comments

- `TopDeckCardClassCountInZoneExpression` block in `effectPrimitive.types.ts`: cite **D-24065 + D-24066** — deck-peek mechanic; no zone move; reads top card class from `G.cardTraits`; empty → 0.
- `VALUE_EXPRESSION_TYPES` drift-array addition: cite **D-24030** — four-surface drift rule (same comment as WP-283 precedent).
- `tryResolveEmpoweredDynamic` helper: cite **D-24065** — recognizes "classes of the card you revealed" phrasing; last fallback before unresolved; cards whose empowered form refers to a runtime-dynamic class (cross-the-multiverse).
- Evaluator for `top-deck-card-class-count-in-zone`: cite **D-24065** — peek-only; deck[0] class → HQ count; empty deck or classless card → 0; no zone move (determinism guarantee).

## Files to Produce

- `packages/game-engine/src/rules/effectPrimitive.types.ts` — **modified** (post-WP-283 as base)
- `packages/game-engine/src/rules/heroCompositions.ts` — **modified** (post-WP-283 as base)
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** (post-WP-283 as base)
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts` — **modified** (post-WP-283 as base)
- `packages/game-engine/src/rules/effectPrimitive.test.ts` — **modified** (post-WP-283 drift count 3 → 4)
- `packages/game-engine/src/hero/effectPrimitive.interpret.test.ts` — **modified** (new evaluator tests)
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** (new dynamic-empowered parser test)

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — count ≥ **1569**
- [ ] `cross-the-multiverse` ability line produces `primitiveEffect` with `amount.type === 'top-deck-card-class-count-in-zone'` (confirm via test)
- [ ] `cross-the-multiverse` shows no `empowered` in `unresolvedMarkers`
- [ ] `VALUE_EXPRESSION_TYPES` drift test passes at **4** entries
- [ ] `docs/ai/DECISIONS.md` — D-24065 + D-24066 both `Status: Active`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-284 row checked `[x]` with date
- [ ] User-Visible Surface: `play.legendary-arena.com` in-game — D-24026 live-verify
  after deploy (cross-the-multiverse no longer appears in `/debug` as empowered hollow)

## Common Failure Smells

- **Zone mutation during eval:** Evaluator modifies `deck` or `hq` array. The evaluator
  must be pure: read `deck[0]` and `hq`, return a number, touch nothing else.
- **Wrong dispatch order:** `tryResolveEmpoweredDynamic` fires on cards that should resolve
  via `tryResolveEmpoweredCore` (e.g. `one-hit-wonder`). Confirm the existing core-path
  tests still pass and the dynamic resolver returns `undefined` for them.
- **Drift count off:** Post-WP-283 baseline is 3 entries; post-WP-284 is 4. If the test
  expects 3 or 2, the array or test update was skipped.
- **Null heroClass crash:** `G.cardTraits[deck[0]]` may be `undefined`, or `heroClass`
  may be `null`. Missing null-guard causes a runtime throw.
