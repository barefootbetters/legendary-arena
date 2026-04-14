# EC-022 — Execute Hero Keywords Minimal MVP (Execution Checklist)

**Source:** docs/ai/work-packets/WP-022-execute-hero-keywords-minimal-mvp.md
**Layer:** Game Engine / Rules Execution (Hero Abilities)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-022.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-022.

---

## Before Starting

- [ ] WP-021 complete: `HeroAbilityHook`, `HeroKeyword`, `G.heroAbilityHooks` exist
- [ ] Verify WP-021 keyword literals: `'draw'`, `'attack'`, `'recruit'`, `'ko'`,
      `'rescue'`, `'wound'`, `'reveal'`, `'conditional'`
- [ ] Verify WP-021 descriptor field: `HeroEffectDescriptor.magnitude` (not `amount`)
- [ ] Verify WP-021 `effects` is optional: `effects?: HeroEffectDescriptor[]`
- [ ] `economy.logic.ts` exports `addResources(economy: TurnEconomy, attack: number, recruit: number): TurnEconomy` (WP-018) — returns new value, does not mutate
- [ ] `ko.logic.ts` exports `koCard(koPile: CardExtId[], cardId: CardExtId): CardExtId[]` (WP-017) — returns new array, does not mutate
- [ ] `zoneOps.ts` exports `moveCardFromZone`, `moveAllCards` — zone-ops primitives for draw logic
- [ ] `setup/shuffle.ts` exports `ShuffleProvider` interface and `shuffleDeck` function
- [ ] `coreMoves.impl.ts` contains `drawCards` **move** (WP-008B) — this is a move function, NOT a callable helper. Draw logic must be extracted/inlined using zone-ops primitives.
- [ ] `playCard` destructures `{ G, playerID }` — will need `{ G, playerID, ...context }` to pass shuffle context
- [ ] KO pile field confirmed: `G.ko: CardExtId[]` (top-level field on `LegendaryGameState`)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-022.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **Executed keywords (MVP) — use these exact WP-021 literals:**

  | Keyword literal | Effect | Helpers used |
  |---|---|---|
  | `'draw'` | Draw N cards from player deck to hand | `moveCardFromZone`, `moveAllCards`, `shuffleDeck` (with `ShuffleProvider`) |
  | `'attack'` | Add N to `turnEconomy.attack` | `addResources(G.turnEconomy, N, 0)` |
  | `'recruit'` | Add N to `turnEconomy.recruit` | `addResources(G.turnEconomy, 0, N)` |
  | `'ko'` | KO the played card to `G.ko` | `koCard(G.ko, cardId)` |

- **Skipped keywords (deferred):**
  `'rescue'`, `'wound'`, `'reveal'`, `'conditional'` — safely ignored in MVP

- **Descriptor field:** `magnitude` (never `amount`)
- **Function signature:**
  `executeHeroEffects(G: LegendaryGameState, ctx: unknown, playerID: string, cardId: CardExtId): void`
  - `ctx: unknown` — avoids `boardgame.io` import; narrowed to `ShuffleProvider`
    at the draw call site (import from `../setup/shuffle.js`, engine-internal)
  - `playerID: string` — needed for draw (which player's deck/hand) and future
    per-player effects. Passed from `playCard`'s `MoveContext`.
- `HeroEffectResult`: `{ executed: boolean; keyword: string; message: string }` — not stored in G
- Execution order: hooks in `G.heroAbilityHooks` order, effects in `effects[]`
  array order, filtering must not reorder
- Effects execute immediately after hero card is played, before fight/recruit actions
- **Numeric validation:** `magnitude` must be finite integer >= 0;
  if undefined/NaN/negative/float, skip the effect (never default to 1 or 0)

- **Helper return patterns (all pure — must assign result back to G):**
  - `G.turnEconomy = addResources(G.turnEconomy, N, 0)`
  - `G.ko = koCard(G.ko, cardId)`
  - Zone arrays from `moveCardFromZone` / `moveAllCards` must be assigned
    back to player zone fields

---

## Guardrails

- Only **unconditional** effects execute — hooks with conditions safely skipped
- Hooks with undefined/empty `effects` array — no execution, no error
- Unsupported keywords safely ignored — no mutation, no error
- Invalid magnitude — skip effect, no mutation, no default
- Skipped effects produce `HeroEffectResult` messages (not stored in `G`,
  available for dev/test assertions only)
- Execution uses **existing helpers only** — no ad-hoc state writes
- **Do NOT call `drawCards` move function** — it is a full move with
  validation/gating. Use zone-ops primitives (`moveCardFromZone`,
  `moveAllCards`, `shuffleDeck`) directly for draw logic.
- `'ko'` MVP targets the played card itself (no player choice)
- KO pile path: `G.ko` (top-level `CardExtId[]`, not nested)
- WP-021 contract files (`heroAbility.types.ts`, `heroKeywords.ts`) must NOT be modified
- No `.reduce()` in effect execution — use `for...of`
- No `boardgame.io` import in hero execution files
- No registry import — hooks already resolved in `G.heroAbilityHooks`
- **Do not remove or replace** existing WP-018 `addResources` call in playCard.
  Hero hook economy is additive. If testing reveals duplication, document in
  DECISIONS.md and resolve — do not pre-emptively remove.

---

## Required `// why:` Comments

- Which 4 keywords are executed and why others are skipped
- `'ko'` targets the played card — MVP simplification, no player choice
- Execution timing: effects fire immediately after play
- Conditional skip: WP-022 skips all conditional effects; WP-023 evaluates them
- Why `ctx: unknown` is used instead of a typed `Ctx`
- Why `ctx` is narrowed to `ShuffleProvider` at the draw call site
- Why `playerID` is a parameter (draw needs to know which player's zones)

---

## Contract Fidelity Checks (Run Before Writing Code)

- [ ] Keyword literals in code match WP-021: `'draw'`, `'attack'`, `'recruit'`, `'ko'`
      (NOT `gainAttack`, `gainRecruit`, `koCard`)
- [ ] Descriptor field is `magnitude` (NOT `amount`)
- [ ] `ctx` parameter typed as `unknown` (NOT `Ctx`)
- [ ] `playerID: string` parameter present in signature
- [ ] `effects` array handled as optional (check for `undefined` / empty)
- [ ] `ShuffleProvider` imported from engine-internal `setup/shuffle.js`
      (NOT from `boardgame.io`)
- [ ] `addResources` / `koCard` results assigned back to G (not void calls)
- [ ] KO pile accessed as `G.ko` (not `G.koPile` or `G.piles.ko`)

---

## Files to Produce

- `packages/game-engine/src/hero/heroEffects.types.ts` — **new** — HeroEffectResult internal type
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **new** — executeHeroEffects
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — playCard destructuring changed to `{ G, playerID, ...context }`, calls `executeHeroEffects(G, context, playerID, args.cardId)`
- `packages/game-engine/src/types.ts` — **modified** — re-export if needed
- `packages/game-engine/src/index.ts` — **modified** — export executeHeroEffects
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **new** — execution tests (11 tests)

---

## Common Failure Smells (Check During Implementation)

- Using `gainAttack`/`gainRecruit`/`koCard` instead of `'attack'`/`'recruit'`/`'ko'` -> contract drift
- Using `.amount` instead of `.magnitude` -> field name drift
- Importing `Ctx` from boardgame.io -> layer violation
- Calling `drawCards()` move function instead of using zone-ops primitives -> architectural violation
- Importing `ShuffleProvider` from boardgame.io instead of `setup/shuffle.js` -> layer violation
- Treating `addResources`/`koCard` as void (not assigning return value) -> silent no-op
- Using `G.koPile` or `G.piles.ko` instead of `G.ko` -> wrong field path
- Missing `playerID` parameter -> can't determine whose zones to modify
- Conditional effects execute -> WP-022 should skip all conditional effects
- WP-021 contract files show up in `git diff` -> contract violation
- Effects fire during fight instead of on play -> timing is wrong
- Ad-hoc G mutation instead of using helpers -> bypasses existing logic
- Removing WP-018 `addResources` call without proof of duplication -> risky regression
- Missing check for `effects === undefined` -> runtime crash
- Defaulting invalid magnitude to 1 or 0 -> violates skip-only policy

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] WP-021 contracts not modified (confirmed with `git diff --name-only`)
- [ ] No conditional logic executed
- [ ] Keyword literals match WP-021 (confirmed with `Select-String` for old names)
- [ ] `magnitude` field used, not `amount` (confirmed with `Select-String`)
- [ ] `ctx: unknown` used, not `Ctx` (confirmed with `Select-String`)
- [ ] `playerID: string` in signature (confirmed with `Select-String`)
- [ ] Does NOT call `drawCards` move function (confirmed with `Select-String`)
- [ ] `ShuffleProvider` imported from `setup/shuffle.js` (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in hero execution files (confirmed with `Select-String`)
- [ ] No `.reduce()` in execution logic (confirmed with `Select-String`)
- [ ] `docs/ai/STATUS.md` updated (hero abilities execute for 4 keywords)
- [ ] `docs/ai/DECISIONS.md` updated (why only 4 keywords; `ko` targets played card;
      hero effect vs WP-018 economy interaction findings)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-022 checked off with date
