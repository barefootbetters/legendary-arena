# EC-023 — Conditional Hero Effects (Execution Checklist)

**Source:** docs/ai/work-packets/WP-023-conditional-hero-effects-teams-colors-keywords.md
**Layer:** Game Engine / Rules Execution (Hero Abilities — Conditional Layer)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-023.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-023.

---

## Before Starting

- [ ] WP-022 complete: `executeHeroEffects` exists and executes 4 unconditional keywords
- [ ] `G.heroAbilityHooks`, `G.turnEconomy`, `G.cardStats` exist
- [ ] `G.playerZones[*].inPlay` tracks played cards (WP-006A)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-023.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **Supported condition types (MVP):**

  | Condition type | Evaluates | Data source |
  |---|---|---|
  | `requiresTeam` | Player has played a card from specified team this turn | `G.playerZones[player].inPlay` + team data |
  | `requiresColor` | Player has played a card with specified hero class | `G.playerZones[player].inPlay` + `hc` field |
  | `requiresKeyword` | Player has played a card with specified keyword this turn | `G.heroAbilityHooks` filtered by played cards |
  | `playedThisTurn` | Player has played at least N cards this turn | `G.playerZones[player].inPlay.length` |

- Unsupported condition types: safely skipped (return `false`)
- Effects execute only when **ALL** conditions pass (AND logic)
- Empty/undefined conditions array: returns `true` (unconditional)

---

## Guardrails

- Conditions are **checked, not inferred** — each evaluator reads `G`, returns `boolean`
- Conditions **NEVER mutate game state** — pure predicates only
- Effects **NEVER inspect hidden information** — no opponent hands, deck contents
- WP-021 contract files (`heroAbility.types.ts`, `heroKeywords.ts`) must NOT be modified
- WP-022 execution file is modified to integrate conditions, not replaced
- No `.reduce()` in condition evaluation — use `for...of`
- No `boardgame.io` import in condition evaluator

---

## Required `// why:` Comments

- Each condition evaluator: what it checks and data source
- Condition evaluation design: conditions never mutate state
- WP-023 upgrade: WP-022 skipped all conditional effects; WP-023 evaluates them deterministically

---

## Files to Produce

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **new** — evaluateCondition, evaluateAllConditions
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — integrate condition evaluation
- `packages/game-engine/src/index.ts` — **modified** — export evaluators
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **new** — condition evaluator unit tests
- `packages/game-engine/src/hero/heroEffects.conditional.test.ts` — **new** — conditional execution integration tests

---

## Common Failure Smells (Optional)

- Condition evaluator mutates G -> deep equality test should catch this
- Single failing condition still allows effect -> AND logic not implemented
- WP-021 types modified -> contract violation

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] WP-021 contracts not modified (confirmed with `git diff --name-only`)
- [ ] Condition evaluation does not mutate G (deep equality test passes)
- [ ] `docs/ai/STATUS.md` updated (conditional hero effects execute; team/class synergies work)
- [ ] `docs/ai/DECISIONS.md` updated (why 4 condition types; AND logic; conditions never mutate; team/class data access)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-023 checked off with date
