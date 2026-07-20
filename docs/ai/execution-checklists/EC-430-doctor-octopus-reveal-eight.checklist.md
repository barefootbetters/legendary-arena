# EC-430 — Doctor Octopus Reveal-Eight Branch (Execution Checklist)

**Source:** docs/ai/work-packets/WP-397-doctor-octopus-reveal-eight.md
**Layer:** Game Engine

## Before Starting
- [ ] **Shares `rules/mastermindHandlers.{ts,test.ts}` with WP-398 — NOT
      parallel-safe.** If WP-398 landed first, re-record the baseline pass
      count against current `main`; do not reuse the drafted number
- [ ] `resolveDoctorOctopusStrike` exists in
      `packages/game-engine/src/rules/mastermindHandlers.ts` and its
      no-qualifying-Hero path is the logged no-op this WP replaces (WP-388)
- [ ] Confirm `context.random.Shuffle` really reaches the handler: read the
      Step-5 `// why:` in `villainDeck/villainDeck.reveal.ts` and the
      `RevealContext` interface. If the strike hook no longer receives the
      full context, STOP: abort and report — do not add new plumbing
- [ ] `G.cardTraits[extId]` carries `{ heroClass, team }` (WP-179); else STOP
- [ ] Exact target file set (any edit outside = FAIL; surface as a blocker
      first): `rules/mastermindHandlers.{ts,test.ts}` under
      `packages/game-engine/src/`, plus `docs/ai/STATUS.md`,
      `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
      `docs/ai/execution-checklists/EC_INDEX.md`,
      `docs/05-ROADMAP-MINDMAP.md`
- [ ] `pnpm --filter @legendary-arena/game-engine` build + test exit 0 —
      observed draft baseline (`origin/main` @ `01498ac1`): **2028 pass / 473
      suites / 0 fail**; if it moved, re-record, do not force the number

## Locked Values (do not re-derive)
- `DOCTOR_OCTOPUS_REVEAL_COUNT = 8`
- Non-grey predicate: `gameState.cardTraits?.[extId]?.heroClass != null`
  (loose `!=` — `null` and `undefined` both read as grey)
- Grey cards (Wounds, and cards with no `cardTraits` entry) go BACK to the
  deck; never discarded by this branch
- Reveal from the FRONT of `playerZones.deck` (index 0 = top); return the
  shuffled remainder to the FRONT:
  `deck = [...shuffledRemainder, ...untouchedTail]`
- Short deck: reveal `min(8, deck.length)` — NEVER top up from the discard
- Player iteration: `Object.keys(gameState.playerZones).sort()`
- Branch order unchanged: Spider-Friends discard first; only a `null`
  selection reaches the reveal branch
- **The handler signature does NOT change** — `ImplementationMap` types the
  2nd param `ctx: unknown` and `strictFunctionTypes` makes narrowing it a
  `TS2322` compile error (reproduced at draft). Keep `unknown`; rename `_ctx`
  → a read name; narrow via a local runtime guard
  `resolveShuffleFunction(context: unknown): (<T>(items: T[]) => T[]) | null`
  — structurally, NOT by importing `RevealContext` and NOT a boardgame.io type
- Handler ordering: `captureBystanderOntoMastermind` → per-mastermind branch
  → WP-200 emission → `return buildGenericStrikeEffects()`

## Guardrails
- `context.random.Shuffle` is the ONLY randomness. No `Math.random()`, no
  wall-clock, no hand-rolled shuffle, no sort-by-random comparator
- A context without `Shuffle` returns the remainder in revealed order and
  logs that fallback — deterministic, never silent, never a throw
- Never throws: empty deck, deck < 8, all-grey, all-non-grey, absent
  `cardTraits`, stub context
- **Card conservation is load-bearing** — every revealed card ends in exactly
  one of {discard, deck}; assert it as a multiset in tests
- Do NOT touch the Spider-Friends discard branch, the other four resolvers,
  `captureBystanderOntoMastermind`, the counter, or the WP-200 emission
- No new `G` field, zone, `RuleEffect` type, move, or phase change
- No `boardgame.io` / registry import in `mastermindHandlers.ts`
- Determinism gates binary: sentinel `finalStateHash`, `PRE_WP080_HASH`, and
  `sim:runtime-observed:check` pass with **no regeneration** (both oracles are
  `core/dr-doom`); drift = STOP, never re-pin

## Required `// why:` Comments
- The non-grey predicate: rulebook "Grey Heroes" = grey-coloured cards with
  no Hero Class, so non-grey ⟺ `heroClass != null`; Wounds are grey and
  return to the deck
- `ctx.random.Shuffle` usage: the framework PRNG is the only permitted
  randomness and keeps replay faithful; note this is the first strike
  resolver to consume it
- Why the remainder is shuffled rather than kept in order: the printed effect
  exists to deny free deck information — preserving order would make the
  strike a benefit
- The short-deck path: reveal what is there, no reshuffle-from-discard (the
  reveal family never reshuffles; only the draw path does)
- The missing-`Shuffle` fallback: stubs pass `{}`; revealed order is the
  deterministic degradation

## Files to Produce
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** —
  reveal-eight branch + reveal-count constant + non-grey predicate + narrowed
  context parameter
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** —
  reveal-branch describe-block; AC-1..AC-8 each need a covering assertion
- `docs/ai/STATUS.md` — **modified** — close-out entry
- `docs/ai/DECISIONS.md` — **modified** — D-24200 Drafted → Active, and
  D-24192 annotated (Doctor Octopus half closed; its `ctx.random` claim was
  wrong — the context was always reachable)
- `WORK_INDEX.md` checkbox flip; `EC_INDEX.md` status flip;
  `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅` + `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0 and
      `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — baseline
      **2028** + new tests, 0 fail
- [ ] **Control run:** revert the reveal branch to the WP-388 no-op and record
      the observed failure count; a passing suite means the tests are vacuous
- [ ] `pnpm sim:runtime-observed:check` exits 0, **no regeneration**; sentinel
      `finalStateHash` + `PRE_WP080_HASH` byte-identical
- [ ] `git diff --name-only` on STAGED changes = exactly the seven-file
      allowlist (an unstaged CRLF-only diff is not a violation)
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — D-24200 Active +
      D-24192 annotated; `WORK_INDEX.md` + `EC_INDEX.md` flipped with date
- [ ] Live-on-surface (D-24026): a deployed Doctor Octopus strike against a
      player holding no Spider-Friends Hero reveals and discards

## Common Failure Smells
- A player's deck grows or shrinks across the strike → the untouched tail was
  dropped or the remainder was appended instead of prepended; check the
  multiset conservation assertion
- Wounds land in the discard pile → the predicate inverted grey/non-grey
- The same shuffle order every run in a seeded replay is EXPECTED; a differing
  order across two replays of one seed means something other than
  `context.random.Shuffle` produced it — STOP
