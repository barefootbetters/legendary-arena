# WP-432 — Remove the Non-Canonical City-Entry Bystander Attach (Supersedes D-1701) (Game Engine)

**Status:** Draft 2026-07-25 · **PROPOSED (WP-432; highest landed WP is 431)** · **Lightweight lane** (D-24028 — 1 source file + ~3 test files, faithfulness fix). Pairs with **EC-467** (authored). Reserves **D-24254** (lands at execution).
**Primary Layer:** Game Engine (`packages/game-engine/src/villainDeck/`)
**User-Visible Surface:** `play.legendary-arena.com` — bystander VP totals drop toward tabletop values (roughly halved); a villain no longer silently carries an extra rescued bystander. **D-24026 observational only** (no rendered-surface gate; verified by tests + re-reading a game log).
**Dependencies:** WP-017 ✅ (introduced the D-1701 entry-attach being removed), WP-431 ✅ (added the city-entry log line being removed with it). No hard-dep WP in flight.
**Baseline:** `origin/main` @ `b2674057` (capture `git rev-parse origin/main` at execution).

---

## Goal

Make the bystander flow **faithful to tabletop Legendary** by deleting the
non-canonical **D-1701 / WP-017** rule that attaches 1 bystander from
`G.piles.bystanders` to every villain/henchman on City entry. D-1701 itself
flagged this as a simplified MVP rule to be revisited.

**Canonical rule** (confirmed against tabletop sources): a villain does **not**
capture a bystander merely by entering the City. Bystanders enter play only via
(a) a bystander **CARD** revealed from the villain deck — captured by the frontmost
city villain, or the Mastermind if the city is empty — or (b) a specific Ambush /
Master-Strike / Scheme-Twist / Fight `capture-bystander` effect.

**The defect.** The engine ran BOTH the canonical card-reveal source AND the D-1701
entry-attach — two independent bystander populations, both scored as flat bystander
VP — so it put ~2× the canonical bystanders into play, inflated bystander VP, and
drained the supply pile that hero "Rescue a Bystander" abilities share (the pressure
behind the D-24032 ≥30 floor).

---

## User-Visible Impact

Bystander VP totals fall toward tabletop values (roughly halved). Rescuing a
villain no longer yields a phantom extra bystander that was never shown being
captured. Hero "Rescue a Bystander" abilities become more reliable (less supply
competition).

---

## Assumes

- **The canonical bystander-card path already works** — `bystander-villain-deck-NN`
  cards are shuffled into the villain deck (`buildVillainDeck`) and captured by the
  frontmost city villain / Mastermind on reveal (`villainDeck.reveal.ts` bystander
  branch, unchanged). (Verified.)
- **The two populations are independent** — the entry-attach pulls from
  `G.piles.bystanders`; the card-reveal attaches the card id. Removing the
  entry-attach does not touch the card-reveal path. (Verified.)
- **`attachBystanderToVillain` stays** — still called by the Midtown Bank twist
  (`schemeTwistResolvers.ts`) and Fight `capture-bystander` (`villainEffects.execute.ts`).
  Only its call in `villainDeck.reveal.ts` (and its import there) is removed. (Verified.)
- **No fixture re-pin** — the one committed golden fixture reveals only
  mastermind-strike cards, so its `finalStateHash` is byte-unchanged; `PRE_WP080_HASH`
  (empty replay) is untouched. (Verified — engine suite green with no re-pin.)

---

## Scope

**IN scope**
- Delete the entry-attach block in `villainDeck.reveal.ts` (the
  `attachBystanderToVillain` call + the WP-431 city-entry log line + the unused import).
- Update the WP-200 ambush comment that referenced the deleted block.
- Correct the **D-18504 → D-1701** mis-citation everywhere it refers to the
  entry-bystander rule (code comment, DECISIONS D-20006 mirror + D-24252 entry,
  WP-431 artifacts) and mark D-1701 **Superseded** by D-24254.
- Rewrite the ~3 tests that asserted the entry-attach into canonical no-attach
  guards; fix the Midtown scheme-twist supply-count expectations.

**OUT of scope**
- The canonical bystander-card-reveal path, effect-driven captures (Ambush / Strike /
  Twist / Fight), escape-release, bystander VP value, the D-24032 supply floor.
- Which villain captures a revealed bystander card (frontmost vs closest-to-deck) —
  a separate, secondary faithfulness question, not touched here.

---

## Non-Negotiable Constraints

- **No `finalStateHash` re-pin** unless a committed fixture legitimately changes
  (none does — verified). Do not blindly re-record.
- Moves never throw; only `Game.setup()` may throw. Determinism preserved (no
  `ctx.random`, time, or I/O added).
- The `attachBystanderToVillain` helper and its other two callers are untouched.
- Layer-internal (Game Engine only); no cross-layer import change.

---

## Files

- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** —
  delete the entry-attach block + WP-431 log line + unused import; fix the WP-200
  comment + mis-citation.
- `packages/game-engine/src/board/escape-wound.integration.test.ts` — **modified** —
  rewrite the "on City entry" block to assert canonical no-attach.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** —
  replace the WP-431 entry-log tests with a canonical no-attach guard.
- `packages/game-engine/src/rules/schemeHandlers.test.ts` — **modified** — Midtown
  Bank twist supply-count expectations (no longer minus a chained-reveal attach).
- Governance + mis-citation corrections: `docs/ai/DECISIONS.md` (D-24254 + D-1701
  superseded + D-20006/D-24252 cite fix), `docs/ai/NUMBER-LEDGER.md`,
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md`, and the WP-431 artifacts'
  D-18504→D-1701 fix.

---

## Definition of Done

- Entry-attach block + WP-431 log line + unused import gone; canonical bystander
  paths untouched; helper retained for its other two callers.
- D-18504→D-1701 mis-citation corrected everywhere it names the entry rule; D-1701
  marked Superseded by D-24254.
- `pnpm --filter @legendary-arena/game-engine build` 0; engine suite green
  (**2071/0**); **no `finalStateHash` re-pin** in the diff.
- `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide.
- `git diff` shows no golden-fixture / sentinel-hash / generated-artifact change.
- D-24254 Active; WORK_INDEX / EC_INDEX / NUMBER-LEDGER / mindmap / STATUS updated;
  ledger + roadmap-counts gates green.
- Commit prefix `EC-467:`.

---

## Vision Check (§17)

Faithfulness to the licensed Legendary ruleset. Bystander VP falls toward tabletop
values — a deliberate, operator-approved balance change in the faithful direction.
No revenue vector or non-goal crossed.
