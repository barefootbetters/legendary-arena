# EC-419 — Mastermind Base-Face Selection (Execution Checklist)

**Source:** docs/ai/work-packets/WP-389-mastermind-base-face-selection.md
**Layer:** Game Engine

## Before Starting
- [ ] Read the defect first: the card loop in `findMastermindCards` — the
      internal helper called by the exported `buildMastermindState`, in
      `packages/game-engine/src/mastermind/mastermind.setup.ts` — assigns
      `baseCard = card` on every non-tactic face with no early exit, so the
      LAST non-tactic face wins
- [ ] Confirm the blast radius is still real before changing anything: at
      least one mastermind in `data/cards/co2e.json` has two `tactic !== true`
      faces (base then `epic-*`). If the data no longer looks like that, STOP:
      abort and report — do not adapt the fix to different data
- [ ] `findMastermindCards` is the sole **computing** writer of
      `MastermindState.baseCardId`; `buildMastermindState` also assigns it on
      three degenerate early-returns (fallback `baseCardId: mastermindId`) —
      those stay UNTOUCHED. Confirm both before editing; else STOP and report
- [ ] Exact target file set, enumerated (any edit outside it is a FAIL —
      surface as a blocker before touching the file):
      `packages/game-engine/src/mastermind/mastermind.setup.ts`,
      `packages/game-engine/src/mastermind/mastermind.setup.test.ts`,
      `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`,
      `docs/ai/work-packets/WORK_INDEX.md`,
      `docs/ai/execution-checklists/EC_INDEX.md`,
      `docs/05-ROADMAP-MINDMAP.md`
- [ ] `pnpm --filter @legendary-arena/game-engine` build + test exit 0 —
      observed draft baseline (`origin/main` @ `9c456412`): **1991 pass / 464
      suites / 0 fail**; if it moved, re-record, do not force the number

## Locked Values (do not re-derive)
- Discriminator is `card.tactic === true` for tactics (D-1413 schema
  contract) — do NOT introduce an `epic` field, a name/slug prefix check, or
  any other heuristic
- The fix is exactly one guard: assign `baseCard` only while it is still
  `null`, so the **first** non-tactic face wins
- Tactic collection unchanged — every `tactic === true` card is appended in
  registry order, wherever it sits relative to the base face
- The `if (!baseCard) return null;` guard, `MastermindState` construction,
  and `tacticsDeck` contents/order unchanged
- Expected post-fix resolution, scaffold-observed at draft: `co2e/doctor-doom`
  → `Dr. Doom` `10+` (not `Epic Doctor Doom` `12+`); `co2e/red-skull` →
  `Red Skull` `7` (not `Epic Red Skull` `10+`); tactic count 4 → 4 for both
- Draft scaffold ran both gates with the guard applied: engine suite
  **1991 / 0 fail** (baseline-identical; no fixture encodes alternate-face
  values) and `sim:runtime-observed:check` current with no regeneration

## Guardrails
- Do NOT sort, filter, reverse, or otherwise reorder `mastermind.cards` —
  the fix is the assignment guard and nothing else
- Do NOT add an `epic` opt-in to `MatchSetupConfig` or the loadout envelope;
  the 9-field composition lock stands and the opt-in is a named future WP
- Do NOT change the null-return contract to a throw (`Game.setup()` may
  throw; this helper returns null)
- No new `G` field, zone, `RuleEffect` type, move, or phase change
- No `boardgame.io` / registry import added to `mastermind.setup.ts`
- Determinism gates are binary: sentinel `finalStateHash`, `PRE_WP080_HASH`,
  and `sim:runtime-observed:check` pass with **no regeneration**. All `core`
  masterminds have a single non-tactic face and both oracles pin
  `core/dr-doom`, so byte-identical is the EXPECTED result — drift means the
  change reached further than intended: STOP and investigate, never re-pin
- The new test must be non-vacuous and cheat-proof: assert positively on the
  base id AND negatively that it is not the Epic id; do not mock, mutate, or
  filter the fixture's `cards` array to manufacture a pass

## Required `// why:` Comments
- The assignment guard: the first non-tactic face is the base card; later
  non-tactic faces are alternate faces — Epic variants (56) or transformation
  faces (9) — deliberately not selected (D-24193)
- Why the previous code was wrong rather than merely different: with a single
  non-tactic face, first-wins and last-wins are indistinguishable, so the
  defect stayed invisible until a set shipped an Epic face
- The retained `tactic === true` discriminator: registry schema contract
  D-1413, not a heuristic (extend the existing comment; do not delete it)

## Files to Produce
- `packages/game-engine/src/mastermind/mastermind.setup.ts` — **modified** —
  first-wins `baseCard` guard + extended `// why:`
- `packages/game-engine/src/mastermind/mastermind.setup.test.ts` —
  **modified** — two-non-tactic-face describe-block covering AC-1..AC-4
  (first face wins + negative not-Epic assertion; single-face unchanged;
  tactics fully collected; zero-non-tactic still returns null)
- `docs/ai/STATUS.md` — **modified** — close-out entry
- `docs/ai/DECISIONS.md` — **modified** — D-24193 Drafted → Active (edit in
  place; the entry already exists from the drafting commit)
- `WORK_INDEX.md` — **modified** — checkbox flip; `EC_INDEX.md` —
  **modified** — status flip
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — node `📝` → `✅`, then
  `pnpm roadmap:counts:write` (the drafting commit added the node)

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0 and
      `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — baseline
      **1991** + new tests, 0 fail
- [ ] `pnpm sim:runtime-observed:check` exits 0, **no regeneration
      performed**; sentinel `finalStateHash` + `PRE_WP080_HASH`
      byte-identical
- [ ] Recorded ad-hoc check: `co2e/doctor-doom` resolves to the base face
      (attack `10+`), not the Epic face
- [ ] `git diff --name-only` on STAGED changes = exactly the seven-file
      allowlist (an unstaged CRLF-only working-tree diff is not a violation)
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — D-24193 Active;
      `WORK_INDEX.md` + `EC_INDEX.md` flipped with date
- [ ] Live-on-surface (D-24026): a deployed match on an affected mastermind
      shows the base face (operator-pending acceptable; record it)

## Common Failure Smells
- Tactics count drops → the guard was placed so it skips the `else` branch
  entirely, or a `break` was added and later tactic cards were never collected
- Only co2e behaves and other sets do not → someone keyed the fix on set
  abbreviation or an `epic-` slug prefix instead of the positional guard
- Any determinism gate regenerating → the change reached beyond face
  selection (both oracles are `core/dr-doom`, single-face); investigate,
  never re-pin
- The new test passes with the guard reverted → it is vacuous; the negative
  not-Epic assertion is missing or asserts against a filtered array
