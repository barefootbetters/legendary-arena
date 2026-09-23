# EC-784 — A Villain-Deck Bystander is captured by the Villain closest to the Villain Deck (Execution Checklist)

**Source:** docs/ai/work-packets/WP-747-villain-deck-bystander-captor-closest-to-deck.md
**Layer:** Game Engine (`villainDeck/villainDeck.reveal.{ts,test.ts}`; JSDoc in `events/notableEvents.{types,compose}.ts`) + ewiki (4 descriptive pages)
**Status:** Pending

## Before Starting
- [ ] Fresh worktree off `origin/main`. Run `pnpm install`, then `pnpm -r build`; confirm the tail has no `Failed`. Record the engine suite baseline (4124/4124 at `3b879f71`).
- [ ] Read:
  - `docs/legendary-universal-rules-v23.md:606–608`
  - `villainDeck.reveal.ts:530–539` and `:605–660`
  - `villainDeck.reveal.test.ts:725–870`
  - `notableEvents.types.ts:312–330`
  - `notableEvents.compose.ts:303–308`
  - `wiki/villain-deck.md:317–322`
- [ ] If WP-748 has already landed, this is the second of the pair: re-run the hash oracles, `sim:coverage --check` and `sim:runtime-observed:check` on the merged tree.
- [ ] Scope lock: exactly the 8 files in Files to Produce. Any other edit → STOP.

## Locked Values (do not re-derive)
- **Captor scan:** `for (let cityIndex = 0; cityIndex < G.city.length; cityIndex++)`. The first non-null, non-undefined occupant wins; otherwise `G.mastermind.baseCardId`.
- **Orientation:** index 0 is the entry edge (Villain Deck side); index 4 is the escape edge (`pushVillainIntoCity`, `board/city.logic.ts:55`).
- **Rule text to cite:** "Put the Bystander under the Villain/Adversary in the city that's closest to the Villain/Adversary Deck" (Universal Rules v23 L606–608).
- **Replacement wording:**
  - comments, JSDoc and three wiki pages: "City villain closest to the Villain Deck"
  - `complete-game-fixtures.md`: "the villain closest to the Villain Deck"
  - `villain-deck.md` L317–322: "the lowest occupied City index — the space nearest the Villain Deck (index 0)"
- **Test fixtures:**
  - `[villain-entry, null, villain-middle, villain-near-escape, null]` → `villain-entry`
  - `[null, villain-a, null, villain-b, null]` → `villain-a`

## Guardrails
- **Direction only.** The Mastermind fallback, the append attach, the `G.mastermind.attachedBystanders` mirror, the log-line format and the `bystanderRevealed` shape stay byte-identical.
- **No new `G` field, move, effect type, or `LOG_OUTCOMES` member.**
- **`notableEvents.types.ts` gets JSDoc prose only.** No type edit, since it is a contract file.
- **Test file edits are limited to** the L727 header comment, the L731 test rewrite, and one new test.
  - The single-occupant `villain-frontmost` fixtures (L803–869), the L847 title and L1991 (an escape description) stay byte-identical.
  - Name the intentional behavior change in the commit body.
- **Grep-gate prose:** nothing written by this WP contains "frontmost" (say "the former escape-edge captor"), and the new `// why:` does not quote the loop header.
- **Determinism:** if the sentinel `finalStateHash` or `PRE_WP080_HASH` moves, STOP, confirm the fixture reveals a Bystander with two or more occupied City spaces, and re-pin honestly with the evidence. Never force green.
- **Out of scope:**
  - Capture effects (Ambush / Twist / Fight / Master Strike) and the ascending hero kidnap captor (D-24537) stay unchanged.
  - `data/par/**` stays untouched.

## Required `// why:` Comments
- The captor loop (`villainDeck.reveal.ts`): cite the Universal Rules v23 captor sentence and the index-0-is-Villain-Deck-side orientation (WP-747 / D-24571).

## Files to Produce
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — ascending captor scan; rewrite the L606 `// why:`; reword the L533 comment
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** — L727 header; L731 rulebook-direction rewrite (renamed fixtures); new lowest-occupied test
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — JSDoc wording (2 spots)
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — `@param captorName` wording
- `wiki/villain-deck.md` — **modified** — L85, L171, L317–322 wording + a one-line rule/D-24571 note
- `wiki/sound-effects.md` — **modified** — L174 wording
- `wiki/visual-effects.md` — **modified** — L533 wording
- `wiki/complete-game-fixtures.md` — **modified** — L660 wording

## After Completing
- [ ] `pnpm -r build` exits 0 (no `Failed` in the tail).
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 at baseline + 1 (4125 at `3b879f71`); record the counts in the commit body.
- [ ] `pnpm sim:coverage --check` and `pnpm sim:runtime-observed:check` exit 0.
- [ ] `pnpm wiki-viewer:project` and `pnpm wiki-viewer:check-links` exit 0.
- [ ] The Verification greps pass: the ascending scan matches once; "frontmost" has zero matches across the 3 engine source files + 4 wiki pages.
- [ ] `git diff --name-only` for the `EC-784:` commit lists the 8 files.
- [ ] Live (D-24026): a Bystander reveal with two or more occupied spaces goes to the lowest occupied space. Record it in STATUS.
- [ ] Governance:
  - STATUS updated
  - DECISIONS D-24571 Active (correcting D-24254's restatement; cite D-24537 as precedent)
  - WORK_INDEX `[x]`; EC_INDEX Done
  - mindmap `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- **The Bystander goes to the Mastermind although the City has villains.** The loop condition or the null check was inverted.
- **The fixture `[null, a, null, b, null]` attaches to nothing, or to `b`.** The scan starts at 1, or still runs descending.
- **The "frontmost" grep has a match.** It is usually in new prose: the `// why:` or the wiki D-24571 note.
- **The exactly-one-match scan grep reads 2.** The `// why:` quoted the loop header.
- **The sentinel hash moved.** Investigate before re-pinning; the scaffold saw no movement.
