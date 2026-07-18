# EC-418 — co2e Mastermind Strike Texts (Execution Checklist)

**Source:** docs/ai/work-packets/WP-388-co2e-mastermind-strike-texts.md
**Layer:** Game Engine

## Before Starting
- [ ] **WP-389 / D-24193 has landed on `main`** — `findMastermindCards`
      selects the FIRST non-tactic face. Verify by resolving
      `co2e/doctor-doom` → base `Dr. Doom` (attack `10+`), not `Epic Doctor
      Doom` (`12+`). If it still resolves Epic, STOP: abort and report — this
      WP implements base-face text and is invalid until WP-389 lands
- [ ] WP-386 pattern present: `resolveRedSkullStrike` + `selectRedSkullKoTarget`
      in `packages/game-engine/src/rules/mastermindHandlers.ts`; the dispatch
      chain branches on `G.selection.mastermindId`
- [ ] `G.cardTraits[extId]` carries `{ heroClass, team }` (WP-179);
      `gainWound` from `src/board/wounds.logic.ts` is **non-mutating**;
      `WOUND_EXT_ID` from `src/setup/pilesInit.ts` — on any miss, STOP:
      abort and report; do not fix-forward or improvise
- [ ] WP-200 emission is the handler's final step — read it; do not reorder
- [ ] Exact target file set (any edit outside = FAIL; surface as a blocker
      first): `rules/mastermindHandlers.{ts,test.ts}` under
      `packages/game-engine/src/`, plus `docs/ai/STATUS.md`,
      `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
      `docs/ai/execution-checklists/EC_INDEX.md`,
      `docs/05-ROADMAP-MINDMAP.md`
- [ ] `pnpm --filter @legendary-arena/game-engine` build + test exit 0 —
      observed draft baseline (`origin/main` @ `9c456412`): **1991 pass / 464
      suites / 0 fail**; if it moved, re-record, do not force the number

## Locked Values (do not re-derive)
- Mastermind ids (each its own constant, co2e-only): `'co2e/doctor-doom'`,
  `'co2e/loki'`, `'co2e/magneto'`, `'co2e/doctor-octopus'`
- `MASTERMIND_MAGNETO` (`'core/magneto'`) and `MASTERMINDS_RED_SKULL` are
  **unchanged** — co2e Magneto is a SEPARATE id, never folded into either
- Trait slugs (lowercase) `'x-men'` / `'spider-friends'` / `'strength'`, read
  via `gameState.cardTraits[extId]?.team` / `?.heroClass`
- Hero iff `extId !== WOUND_EXT_ID`; cost
  `gameState.cardStats[extId]?.cost ?? 0` (D-21502)
- Selection: lowest cost; tie → lowest hand index (strict `<`)
- The shared selector generalizes by a **plain discriminator argument**
  (trait kind `'any' | 'team' | 'heroClass'` + slug), NOT a predicate
  callback — `.claude/rules/code-style.md` §Functions bans closures-as-config
- Omen count (Doom): `(gameState.counters.masterStrikeCount ?? 0) + 1`
- Doom branch test: discard iff `hand.length >= omenCount`, else `gainWound`
- BOTH helpers are non-mutating; assign BOTH outputs back.
  `moveCardFromZone(hand, discard, extId)` returns `{ from, to, found }` →
  set `playerZones.hand = result.from` AND `playerZones.discard = result.to`
  (WP-382 / D-24183). `gainWound(piles.wounds, playerZones.discard)` → assign
  both returned arrays back
- Player iteration: `Object.keys(gameState.playerZones).sort()`
- Handler ordering: `captureBystanderOntoMastermind` → per-mastermind branch
  → WP-200 emission → `return buildGenericStrikeEffects()`

## Guardrails
- Never throws — empty/all-Wound hand, missing `cardStats`/`cardTraits`,
  empty wounds pile, absent counter → logged no-op or documented fallback
- No new `G` field, zone, `RuleEffect` type, move, or phase change — in
  particular **no Omen zone and no Hypno-Thrall zone**
- No RNG — `ctx` stays unread (`_ctx`); no `Math.random()`, `.Shuffle`, or
  wall-clock
- Loki / Doc Ock: no qualifying Hero → **logged no-op**. Do NOT improvise the
  alternate branch (Thrall stack, reveal-8) or substitute a Wound
- Do not touch `resolveMagnetoStrike` / `resolveRedSkullStrike` /
  `selectRedSkullKoTarget` behavior, the emission + payload, or
  `composeMastermindStrikeNarrative`. Do NOT edit the `MASTERMINDS_RED_SKULL`
  `// why:` block — WP-389 made its claim true
- Branches mutually exclusive per id; non-matching mastermind takes none; no
  `boardgame.io` / registry import
- Determinism gates binary: sentinel `finalStateHash`, `PRE_WP080_HASH`, and
  `sim:runtime-observed:check` pass with **no regeneration**; drift = STOP

## Required `// why:` Comments
- The id constants: base face only — the Epic face prints different text and
  is unreachable once WP-389 lands (D-24193); `co2e/magneto` ≠ `core/magneto`
- The auto-pick rule: D-24192 extends D-24188 — player-optimal, deterministic,
  avoids a blocking multi-player pending-choice
- Doom's Omen derivation: one Omen per strike; the generic `modifyCounter`
  applies AFTER the handler returns — hence `+ 1`
- Loki / Doctor Octopus no-op paths: the alternate printed branch is out of
  scope per D-24192; the no-op is deliberate, not an oversight
- The `?? 0` cost fallback (D-21502); `!== WOUND_EXT_ID` (Wounds aren't Heroes)
- Correct the stale `MAGNETO_HAND_SIZE_LIMIT` `// why:` claim that no team
  data exists — `G.cardTraits` has carried it since WP-179 (comment only)

## Files to Produce
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** —
  four id constants + four resolvers + shared lowest-cost selector
  (discriminator arg, not a callback) + four dispatch branches
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** —
  one describe-block per resolver; AC-1..AC-9 each need a covering assertion
- `docs/ai/STATUS.md` — **modified** — close-out entry
- `docs/ai/DECISIONS.md` — **modified** — D-24192 Drafted → Active (edit in
  place; the entry already exists from the drafting commit)
- `WORK_INDEX.md` checkbox flip; `EC_INDEX.md` status flip;
  `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅` + `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0 and
      `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — baseline
      **1991** + new tests, 0 fail
- [ ] `pnpm sim:runtime-observed:check` exits 0, **no regeneration**; sentinel
      `finalStateHash` + `PRE_WP080_HASH` byte-identical
- [ ] `git diff --name-only` on STAGED changes = exactly the seven-file
      allowlist (an unstaged CRLF-only diff is not a violation)
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — D-24192 Active;
      `WORK_INDEX.md` + `EC_INDEX.md` flipped with date
- [ ] Live-on-surface (D-24026): a deployed co2e match where one of the four
      strikes produces the specified hand change + HUD log lines

## Common Failure Smells
- A Wound appears for Loki or Doctor Octopus → a no-op path was "helpfully"
  filled in; only Doom and co2e Magneto gain Wounds
- Hand shrinks but discard does not grow → the Red Skull call shape was
  copied, which assigns only `.from` (its destination was a throwaway `[]`)
- Any determinism gate regenerating → something leaked outside the four co2e
  branches (matrix mastermind is `core/dr-doom`); investigate, never re-pin
