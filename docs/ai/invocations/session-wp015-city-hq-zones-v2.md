# Session Execution Prompt — WP-015 + WP-015A v2 (Mode B Invariants Audit)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute the audit. Do not execute in the session that
> generated this prompt.

---

## Session Identity

**Work Packets:** WP-015 (City & HQ Zones) + WP-015A (Reveal Safety Fixes)
**Audit Mode:** Mode B — Invariants Audit (current mainline)
**Pre-Flight:** `docs/ai/invocations/preflight-wp015-city-hq-zones-v2.md`
**EC:** `docs/ai/execution-checklists/EC-015-city-zones.checklist.md`

---

## Read Order (Mandatory — Do Not Skip)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/ai/execution-checklists/EC-015-city-zones.checklist.md`
4. `docs/ai/work-packets/WP-015-city-hq-zones-villain-movement.md`
5. `docs/ai/work-packets/WP-015A-reveal-safety-fixes.md`
6. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`
7. `docs/ai/invocations/preflight-wp015-city-hq-zones-v2.md`

---

## Context

Mode B invariants audit on the current mainline. WP-015 and WP-015A are
both complete. Your job is to validate all active invariants hold, then
fix any that don't.

---

## Runtime Wiring Allowance

WP-015 adds `city: CityZone` and `hq: HqZone` to `LegendaryGameState`.
Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to these files are permitted solely for type/assertion correctness:

- `src/setup/buildInitialGameState.ts` — initialize `G.city` and `G.hq`
- `src/types.ts` — add `city: CityZone`, `hq: HqZone` fields
- `src/index.ts` — export city/hq types and functions

No new behavior may be introduced under this allowance.

---

## Task: Validate All Active Invariants

### City/HQ Types (city.types.ts)

1. `CityZone` = `[CitySpace, CitySpace, CitySpace, CitySpace, CitySpace]`
2. `CitySpace = CardExtId | null`
3. `HqZone` = `[HqSlot, HqSlot, HqSlot, HqSlot, HqSlot]`
4. `HqSlot = CardExtId | null`
5. `// why:` on 5-tuple design (both City and HQ)

### City Push Logic (city.logic.ts)

6. `pushVillainIntoCity` is pure — no boardgame.io import in file
7. Push inserts at space 0, shifts toward space 4
8. Space 4 card captured as `escapedCard` before shift
9. `escapedCard = oldCity[4]`, never the newly revealed card
10. City remains length 5 after every push
11. No `.reduce()` in logic (comments OK)
12. `// why:` on shift direction (rightward = toward escape)
13. `initializeCity()` returns 5 nulls
14. `initializeHq()` returns 5 nulls with `// why:` referencing WP-016

### City Validation (city.validate.ts)

15. `validateCityShape` checks: is array, length 5, each element string|null
16. Returns `{ ok: true }` or `{ ok: false, errors: MoveError[] }`
17. No boardgame.io import

### Reveal Routing (villainDeck.reveal.ts)

18. Villain/henchman -> City via `pushVillainIntoCity` (not discard)
19. Scheme-twist/mastermind-strike -> discard (no City modification)
20. Bystander -> discard + message with `// why: WP-017`
21. City placement occurs BEFORE trigger emission (steps 4 before 5)
22. Escape increments `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
    (constant, not string literal `'escapedVillains'`)
23. Escape message appended to `G.messages`
24. Malformed city validation before push — early return on failure

### WP-015A: Stage Gate (villainDeck.reveal.ts)

25. `if (G.currentStage !== 'start') return;` as first line of move body
26. No side effects on stage mismatch (no messages, no mutations)
27. `// why:` on stage gate rationale

### WP-015A: Deferred Deck Removal (villainDeck.reveal.ts)

28. Villain/henchman: deck removal AFTER city validation succeeds
29. Non-city types: deck removal before trigger/discard routing
30. Malformed city: card stays in deck (no removal occurs)
31. `// why:` on deferred deck removal rationale

### Game State (types.ts)

32. `LegendaryGameState` has `city: CityZone`
33. `LegendaryGameState` has `hq: HqZone`
34. City/HQ types re-exported from `types.ts`

### Setup Wiring (buildInitialGameState.ts)

35. `G.city = initializeCity()` (all null)
36. `G.hq = initializeHq()` (all null, WP-016 populates)

### Exports (index.ts)

37. `CityZone`, `CitySpace`, `HqZone`, `HqSlot` exported (types)
38. `pushVillainIntoCity`, `initializeCity`, `initializeHq` exported (values)
39. `validateCityShape` exported (value)
40. `PushVillainResult` exported (type)

### Prohibitions

41. No boardgame.io import in `src/board/` files
42. No `@legendary-arena/registry` import in `src/board/` files
43. No `Math.random()` in `src/board/` files
44. No `require()` in `src/board/` files
45. `villainDeck.types.ts` not modified by WP-015
46. HQ not mutated after initialization (no move in WP-015 touches `G.hq`)
47. `revealVillainCard` NOT in `CoreMoveName`/`CORE_MOVE_NAMES`/`MOVE_ALLOWED_STAGES`

### Tests — City Push (city.logic.test.ts)

48. Places card at space 0 of empty city
49. Shifts existing cards forward
50. Full city: space 4 escapes
51. Escape returned; non-escape returns null
52. Escape identity: `escapedCard === oldCity[4]`
53. City remains 5-element tuple
54. JSON.stringify succeeds
55. `initializeCity()` returns all nulls
56. `initializeHq()` returns all nulls

### Tests — City Integration (villainDeck.city.integration.test.ts)

57. Villain reveal places card in `G.city[0]`
58. Henchman reveal places card in `G.city[0]`
59. Scheme-twist does NOT modify `G.city`
60. Mastermind-strike does NOT modify `G.city`
61. Escape increments counter
62. JSON.stringify succeeds after city placement
63. `G.hq` remains unchanged after reveals
64. Malformed city: card remains in deck, no counter, message (WP-015A)

### Tests — Reveal (villainDeck.reveal.test.ts, WP-015A addition)

65. Stage gating: no-op when `G.currentStage !== 'start'`

### Test Meta

66. All test files use `node:test`/`node:assert`/`makeMockCtx`
67. No `from 'boardgame.io'` imports in any test file
68. `pnpm --filter @legendary-arena/game-engine build` exits 0
69. `pnpm --filter @legendary-arena/game-engine test` exits 0 (all pass)

---

## If Any Invariant Fails

1. Record which invariant failed and why
2. Fix the code to satisfy the invariant
3. If the fix touches a 01.5 wiring file, document per Reporting Requirement
4. Re-run build + tests
5. Document the fix in the audit output

---

## Completion

When all invariants pass:

1. Record audit results (invariant # -> PASS with file:line)
2. Report total test count and 0 failures
3. Note any fixes applied
4. Do NOT modify governance docs unless a fix requires it

---

## Constraints (Non-Negotiable)

- Do not revert any prior WP changes
- Do not modify `CoreMoveName`, `CORE_MOVE_NAMES`, or `MOVE_ALLOWED_STAGES`
- Do not add registry imports to engine files
- Do not use `Math.random()`, `.reduce()` in logic, or `require()`
- Moves never throw; only `Game.setup()` may throw
- `G` must remain JSON-serializable
- City push logic must remain a pure helper (no boardgame.io)
- Escape counter must use `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` constant
- City mutation only in `revealVillainCard` (no other move/helper)
- 01.5 wiring must be minimal, no new behavior
