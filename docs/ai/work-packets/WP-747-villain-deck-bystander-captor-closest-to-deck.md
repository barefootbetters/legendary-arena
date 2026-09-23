# WP-747 — A Villain-Deck Bystander is captured by the Villain closest to the Villain Deck (Engine)

**Status:** Draft 2026-09-22 (EC-784; D-24571 reserved)
**Primary Layer:** Game Engine (`packages/game-engine/src/villainDeck/**`, comment-only touches in `events/**`) + ewiki (4 descriptive pages)
**Dependencies:** WP-432 / D-24254 (bystanders enter play only via a revealed Bystander card or a capture effect) ✅, WP-602 / D-24412 (`bystanderRevealed` notable event) ✅, WP-508 / D-24314 (escaping villains carry their Bystanders into the Escaped Villains pile) ✅
**User-Visible Surface:** play.legendary-arena.com (the game log, the City board's captured-Bystander badges, the Bystander-revealed overlay)
**Baseline:** `origin/main` @ `3b879f71`

---

## Goal

As a player, when a Bystander card is revealed from the Villain Deck, I want the
Villain closest to the Villain Deck to capture it, as the rulebook says. Then the
villain I can reach first holds the hostage, and I can rescue it before it is
carried off.

---

## User-Visible Impact

Today the engine gives a revealed Bystander to the villain **about to escape**:
the highest occupied City index, where index 4 is the escape edge. Universal
Rules v23 (`docs/legendary-universal-rules-v23.md:607`) say:

> Put the Bystander under the Villain/Adversary in the city that's closest to the
> Villain/Adversary Deck. If there are no Villains/Adversaries in the city, then
> the Bystander is captured/guarded by the Mastermind/Commander.

Villains enter the City at index 0 (the Villain Deck side, per
`pushVillainIntoCity`), so the rule's captor is the **lowest** occupied index.

**Observed live (2026-09-22, match `PaT5TygrTPQ`, 2p Red Skull / Midtown Bank
Robbery):**
- The Bystanders revealed on turns 5, 6, 7 and 9 all went to The Leader, which
  was then at City spaces 3–4.
- Under the rule, they belonged to the Sentinels at space 0, one of which was
  fought on turn 8.
- The Leader escaped on turn 12 carrying 6 Bystanders. Midtown's Evil-Wins
  threshold is 8 Bystanders carried away.

The bug therefore both hides hostages from the player and pushes every
Bystander-carry-away loss toward the scheme.

After this WP:
- A revealed Bystander goes under the lowest-index occupied City space.
- With an empty City it still goes to the Mastermind.
- Log lines, the notable event and the board badges follow automatically. They
  already name the chosen captor.

---

## Assumes

All verified at baseline `3b879f71`:

- **One routing site.** The Bystander branch of `revealVillainCard`
  (`villainDeck/villainDeck.reveal.ts:605–628`) picks the captor with
  `for (let cityIndex = G.city.length - 1; cityIndex >= 0; cityIndex--)` (L613),
  falling back to `G.mastermind.baseCardId`.
  - It is the only **Villain-Deck-reveal** captor site. A repo-wide search
    (`frontmost`, reverse City scans in `hero/`, `villain/`, `rules/`, `board/`)
    finds no other.
  - The two hero effects that pick a City captor already scan **ascending**,
    the rulebook direction (D-24537: "FIRST City villain by ascending city
    index"). They are supporting precedent and stay unchanged:
    - `heroEffectKidnapPerCount` (`hero/heroEffects.execute.ts:2204`)
    - `heroEffectHereHoldThis` (L3015)

    Both call `buildHereHoldThisTargets` (`moves/seatChoiceCards.ts:65`), which
    scans ascending.
  - Ambush / Twist / Fight `capture-bystander` effects name their own captor
    (self, the Bank, the Mastermind), and this WP does not touch them.
- **City orientation.** Index 0 is the entry edge (the Villain Deck side), and
  index 4 is the escape edge.
  - `pushVillainIntoCity` inserts at 0 and pushes the index-4 occupant out.
  - The live log confirms it: every newly revealed villain is fought "at city
    space 0".
- **Henchmen count as Villains.** `G.city` holds villains and henchmen, and both
  are legitimate captors today. That stays unchanged.
- **Origin of the current direction.** PR #75 (2026-05-17) chose "frontmost =
  highest index" and said in its own notes that its session prompt was
  ambiguous about which end is "front". No DECISIONS entry locks the direction.
  D-24254 restates "captured by the frontmost city villain" in passing, while
  describing the branch as "unchanged". D-24571 corrects that restatement.
- **Empirical scaffold** (draft session on `aab4dd37`, re-run by pre-flight on
  `3b879f71`, flipping only L613 to an ascending scan):
  - The engine suite at `3b879f71` goes 4124/4124 → 4123/4124. The one failure
    is the test that pins the old direction: `villainDeck.reveal.test.ts:731`
    "attaches bystander to frontmost villain (highest occupied city index)".
  - `pnpm -r --no-bail test` has zero failures in every other package (registry,
    lagn-spec, vue-sfc-loader, legends-board, engine-runner, replay-producer,
    registry-viewer, preplan, dashboard, server, arena-client).
  - `sim:coverage --check` and `sim:runtime-observed:check` both exit 0.
  - The sentinel `finalStateHash` and `PRE_WP080_HASH` did not move: every
    replay/determinism test passed.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/legendary-universal-rules-v23.md:606–608` — the governing rule text.
- `villainDeck/villainDeck.reveal.ts` L530–539 (the WP-432 comment restating
  the captor) and L605–660 (the Bystander branch, log line, `bystanderRevealed`
  event).
- `villainDeck/villainDeck.reveal.test.ts` L725–845 (the `bystander capture
  routing` describe block).
- `events/notableEvents.types.ts:312–330` and `events/notableEvents.compose.ts:303–308`
  — JSDoc that restates "frontmost".
- `docs/ai/DECISIONS.md` D-24254 (WP-432), D-24412 (WP-602), D-24314 (WP-508).
- ewiki pages restating "frontmost":
  - `wiki/villain-deck.md` L85, L171 and L317–322 (the "Bystander captor
    selection" bullet, the most explicit statement of the old rule)
  - `wiki/sound-effects.md:174`
  - `wiki/visual-effects.md:533`
  - `wiki/complete-game-fixtures.md:660`

**Interaction with WP-748.** WP-747 changes which villain holds a Bystander, and
WP-748's attack bonus reads that count. Each was scaffolded alone. Whichever
lands **second** re-runs the hash oracles, `sim:coverage --check` and
`sim:runtime-observed:check` on the merged tree before its govern-close.

**Why one WP, separate from WP-748.** Both come from the same Midtown match, but
they are different rules:
- WP-747 is a **universal** capture rule. It affects every scheme whose Villain
  Deck holds Bystanders.
- WP-748 is one family of **scheme** special rules.

Each is independently testable and independently valuable. They touch
**disjoint code files** (`villainDeck.reveal.ts` vs `economy.resolve.ts`), so
they can execute in parallel sessions. Only the shared governance ledgers
overlap.

**Replay posture.** Like every gameplay-fidelity fix (WP-508, WP-732),
re-executing a match recorded before this change can now produce a different
final state. Stored scores are never recomputed by this WP. That is the
standing posture, not a new decision.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English
  words, JSDoc on every function, `// why:` on non-obvious choices, no
  `.reduce()`.
- Moves never throw. All randomness via `ctx.random.*` (none is added here).

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and
ask.

**Packet-specific:**
- **Direction only.** The only behavior change is which occupied City space
  captures: the **lowest** occupied index instead of the highest.
- **Keep everything else byte-identical:**
  - the empty-City Mastermind fallback
  - the append-not-overwrite attach
  - the log-line format
  - the `bystanderRevealed` event shape
- **No new `G` field, no new move, no new effect type, no new log outcome.**
- **Comment and doc edits are wording-only.** `notableEvents.types.ts` is a
  contract file. Its edit is JSDoc prose only, with no type change, so it is not
  a contract change.
- **Tests earn the change.** The one existing direction test (L731) is
  rewritten to assert the rulebook direction, and the intentional behavior
  change is named in the commit body (per the CLAUDE.md Reward Integrity rule).
  The only other test-file edit is the L727 header comment.
  - These stay untouched: the single-occupant `villain-frontmost` fixtures
    (L803–869, which don't depend on scan direction) and the WP-602 test title
    at L847.
  - L1991 also stays: it describes an escape, where "frontmost" is correct.
- **Grep-gate prose discipline.**
  - Nothing new written by this WP may contain the word "frontmost". That
    covers the new `// why:`, the `villain-deck.md` D-24571 note, and any prose
    describing the correction. Say "the former escape-edge captor" instead.
  - The new `// why:` must not quote the loop header text. Otherwise the
    exactly-one-match gate reads 2.
- **Determinism.** Verify the sentinel `finalStateHash` and `PRE_WP080_HASH` at
  execution.
  - The scaffold says neither moves.
  - If either moves, STOP and confirm the fixture genuinely reveals a Bystander
    with two or more occupied City spaces before re-pinning honestly
    (`reference_hashed_g_field_dual_repin`).
  - Never edit a pin to force green.

---

## Scope (In)

### A) `villainDeck/villainDeck.reveal.ts` (**modified**)
- The captor loop becomes
  `for (let cityIndex = 0; cityIndex < G.city.length; cityIndex++)`, so the first
  occupied index wins.
- Rewrite the `// why:` comment above the loop to cite the Universal Rules v23
  captor sentence and the index-0-is-the-Villain-Deck-side orientation.
- Reword the WP-432 comment at L533 ("captured by the frontmost city villain")
  to "captured by the city villain closest to the Villain Deck".

### B) `villainDeck/villainDeck.reveal.test.ts` (**modified**)
- Rename the describe-block header comment (L727) from "frontmost" to "closest
  to the Villain Deck".
- Rewrite the L731 test:
  - With City `['villain-entry', null, 'villain-middle', 'villain-near-escape', null]`,
    the Bystander attaches to **`villain-entry` (index 0)**.
  - `villain-middle` and `villain-near-escape` get nothing.
  - The assertion messages name the fixtures by these ids, and none may say
    "frontmost".
- Add one test: with City `[null, 'villain-a', null, 'villain-b', null]` (index 0
  empty), the Bystander attaches to `villain-a` (index 1). This is the
  lowest-*occupied* index, not literally index 0.
- Every other test in the file stays byte-identical: empty-City → Mastermind,
  append, log line, and the WP-602 event test with its `villain-frontmost`
  single-occupant fixtures.

### C) `events/notableEvents.types.ts` + `events/notableEvents.compose.ts` (**modified**; JSDoc only)
- Replace "frontmost City villain" with "City villain closest to the Villain
  Deck" in the `BystanderRevealedEvent` JSDoc, its `captorCardId` field comment,
  and the `composeBystanderRevealedNarrative` `@param captorName`.
- No code change.

### D) ewiki (**modified**; descriptive wording only)
- "frontmost City villain" → "City villain closest to the Villain Deck" in:
  - `wiki/villain-deck.md` L85 and L171
  - `wiki/sound-effects.md:174`
  - `wiki/visual-effects.md:533`
  - `wiki/complete-game-fixtures.md:660` ("frontmost villain" → "the villain
    closest to the Villain Deck")
- `wiki/villain-deck.md` L317–322 (the "Bystander captor selection" bullet):
  rewrite to "the lowest occupied City index — the space nearest the Villain
  Deck (index 0)". Add a one-line note citing Universal Rules v23 L606–608 and
  D-24571, without the word "frontmost".

---

## Out of Scope

- **No change to who captures under a capture effect.** Ambush / Twist / Fight /
  Master-Strike `capture-bystander` effects are unchanged, including the Midtown
  Bank twist and the Master Strike capture (D-15401).
- **No escape-penalty change.** The generic escape wound (WP-015 / D-24439) and
  the unimplemented rulebook HQ-KO and discard steps are a separate fidelity
  question.
- **No Midtown attack bonus.** That is WP-748.
- **No PAR profile re-pin.** `data/par/profile/v1/**` is a derived diagnostic
  that is not CI-gated. It is re-pinned by a separate `INFRA:` regeneration after
  this WP (and WP-748) land, per the #2297 precedent. Seed PAR
  (`data/par/seed/**`) is ratings-derived and write-once, so it is untouched.
- **No client change.** The client renders the engine's captor.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — captor scan direction + two comments
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** — rulebook-direction test + lowest-occupied test
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — JSDoc wording
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — JSDoc wording
- `wiki/villain-deck.md` — **modified** — captor wording (L85, L171, L317–322) + rule note
- `wiki/sound-effects.md` — **modified** — captor wording
- `wiki/visual-effects.md` — **modified** — captor wording
- `wiki/complete-game-fixtures.md` — **modified** — captor wording

No other files may be modified in the `EC-784:` commit (8 files). The
govern-close `SPEC:` commit edits STATUS, DECISIONS (D-24571 Active),
WORK_INDEX, EC_INDEX and the mindmap.

---

## Contract

- **Captor rule.** A Bystander card revealed from the Villain Deck attaches (in
  `G.attachedBystanders`) to the occupant of the **lowest occupied index** of
  `G.city`. If no index is occupied, it goes to `G.mastermind.baseCardId`, also
  mirrored into `G.mastermind.attachedBystanders`, which is unchanged.
- **Unchanged:** the log line `"<Bystander> revealed and captured by <captor>."`
  and the `bystanderRevealed` event, both naming the chosen captor.

---

## Vision Alignment

- **Vision clauses touched:**
  - §1 Rules Authenticity (the printed captor rule)
  - §3 Player Trust & Fairness (hostages held where the rules put them)
  - §8 Deterministic Game Engine
  - §22 Deterministic & Reproducible Evaluation (previously recorded matches
    may replay differently)
  - NG-1
- **Conflict assertion:** No conflict. The fix moves the engine onto the
  printed rule.
- **Non-Goal proximity:** NG-1..8 are not crossed. No monetized surface touches
  capture.
- **Determinism:** deterministic. A pure index scan, no RNG. Replays of
  previously recorded matches may diverge, which is the standing
  gameplay-fidelity posture.

## Funding Surface Gate

N/A — engine rule + descriptive wiki wording; no funding affordance.

## API Catalog

N/A — no `apps/server` endpoint or `Library-only` function changes.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] With City `[A, null, B, C, null]`, a revealed Bystander attaches to `A`
  (index 0), and `B`/`C` get nothing.
- [ ] With City `[null, A, null, B, null]`, a revealed Bystander attaches to `A`
  (index 1).
- [ ] With an empty City, the Bystander attaches to the Mastermind (unchanged
  test passes).
- [ ] An existing attachment is appended to, not overwritten (unchanged test
  passes).
- [ ] The log line and the `bystanderRevealed` event name the new captor.
- [ ] No "frontmost" wording remains in the 7 files in the Verification grep
  (3 engine source files + 4 wiki pages). The test file is excluded: its
  single-occupant `villain-frontmost` fixtures and the L847 title stay unchanged.
- [ ] The sentinel `finalStateHash` and `PRE_WP080_HASH` are unchanged, or were
  re-pinned honestly with the evidence recorded in the commit body.
- [ ] `pnpm -r build` exits 0. The engine suite is green at baseline + 1 new
  test, with counts recorded in the commit body. `sim:coverage --check` and
  `sim:runtime-observed:check` exit 0. The `EC-784:` diff is exactly the 8
  files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
# Expected: exit 0; the rewritten direction test + the new lowest-occupied test pass

pnpm sim:coverage --check
pnpm sim:runtime-observed:check
# Expected: both exit 0 (the draft scaffold observed both unchanged)

Select-String -Path "packages\game-engine\src\villainDeck\villainDeck.reveal.ts" -Pattern "cityIndex = 0; cityIndex < G.city.length"
# Expected: exactly one match (the captor scan)

Select-String -Path "packages\game-engine\src\villainDeck\villainDeck.reveal.ts","packages\game-engine\src\events\notableEvents.types.ts","packages\game-engine\src\events\notableEvents.compose.ts","wiki\villain-deck.md","wiki\sound-effects.md","wiki\visual-effects.md","wiki\complete-game-fixtures.md" -Pattern "frontmost"
# Expected: zero matches

pnpm wiki-viewer:project; pnpm wiki-viewer:check-links
# Expected: both exit 0

git diff --name-only
# Expected (implementation commit): exactly the 8 files above
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **Live verification (D-24026), on play.legendary-arena.com:**
  1. Start a match whose Villain Deck holds Bystanders (Midtown Bank Robbery via
     `POST /api/match/autoplay` with `setupData`, or a live 2p match).
  2. Wait for a Bystander reveal with two or more occupied City spaces.
  3. Confirm the log names the villain at the lowest occupied space (the
     Villain Deck side) and the board badge sits on that villain.
- [ ] `docs/ai/STATUS.md` updated, with the live observation.
- [ ] All acceptance criteria pass.
- [ ] No files outside `## Files Expected to Change` are modified in the
  `EC-784:` commit.
- [ ] `docs/ai/DECISIONS.md`: D-24571 landed Active.
- [ ] `WORK_INDEX.md` WP-747 is `[x]`, and `EC_INDEX.md` EC-784 is Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then
  `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

---

## Reserved Decision (lands at execution)

- **D-24571 (reserved; Drafted 2026-09-22): a Bystander revealed from the
  Villain Deck is captured by the City villain closest to the Villain Deck.**
  - It attaches under the lowest occupied `G.city` index (index 0 is the
    Villain Deck side), with henchmen included. With an empty City it goes to
    the Mastermind.
  - Source: Universal Rules v23 L607.
  - This corrects the PR #75 "frontmost = highest index" choice and the
    incidental "frontmost" restatement in D-24254. D-24254's actual lock (no
    capture merely on City entry) is unaffected.
  - Capture effects that name their own captor are unaffected.
  - Precedent: the hero kidnap captor already picks the first City villain by
    ascending index (D-24537).

---

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-22)**, after in-place text fixes. The independent
reviewer re-ran the scaffold on `3b879f71`: engine 4123/4124, with the single
intended failure.

- **PS-1..3 applied:**
  - PS-1: `wiki/villain-deck.md` L317–322 added to scope.
  - PS-2: `wiki/complete-game-fixtures.md:660` added as the 8th file.
  - PS-3: the test-file edit contradiction resolved (L727 header + L731 rewrite
    + one new test only).
- **RS-1..5 applied:**
  - baseline 4124
  - the ascending hero-captor precedent (D-24537)
  - grep-gate prose discipline
  - rule citation L606–608
  - the WP-748 second-to-land re-check
- RS-6: the live match id isn't verifiable from the repo.

## Copilot Check (01.7)

**RISK → resolved (2026-09-22).** All 30 modes are PASS or N/A except #27
(naming).
- The renamed fixture `villain-escape-edge` sat at index 3, while index 4 is
  the escape edge.
- Fixed in place to `villain-near-escape`, locked in EC-784. This is
  scope-neutral, so no pre-flight re-run is needed.

## Lint Gate Self-Review (00.3)

**PASS (2026-09-22)**, independent reviewer.
- Every section is PASS or N/A with justification:
  - §7 dependencies, §10 env and §11 auth: N/A
  - §19 bridge staleness: N/A, a commit-time item
  - §20 funding and §21 API catalog: N/A with reasons
- Two accuracy fixes applied:
  - The hero-captor helper citation now reads `moves/seatChoiceCards.ts:65`,
    called at `heroEffects.execute.ts:2204` / `:3015`.
  - The vision clauses now add §8 and §22 for the replay posture.

---

## See Also

- WP-432 / D-24254 — bystanders enter only via a card or a capture effect
- WP-602 / D-24412 — the `bystanderRevealed` event
- WP-508 / D-24314 — the Midtown carry-away loss this bug accelerates
- WP-748 — the Midtown-family "+1 attack per Bystander" rule (parallel-safe sibling)
