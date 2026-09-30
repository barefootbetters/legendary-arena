# WP-784 — Deck-top discards count toward "If you discarded any cards this turn"

**Status:** Draft 2026-09-28 · **EC:** EC-821 · **Reserves:** D-24631 (reserve PR #2485)
**Primary Layer:** Game Engine (no registry, server, client or card-data change)
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (changes a scoring input — New Wings / Pumpkin Bombs now grant after a deck-top discard — so NOT lightweight-eligible per 01.0a criterion #6; 8 engine source files + 3 comment-only, over the ≤4 budget)
**Baseline:** `origin/main` @ `8afe01c1` (2026-09-28)

## Goal

Jeff's ruling (2026-09-28): a card discarded from the **top of a deck** counts as "you
discarded" for "If you discarded any cards this turn" (bkwd New Wings +4, vill Pumpkin Bombs +2),
exactly like a hand discard. Today only card-effect **hand** discards are counted (WP-777 /
D-24616 §4), so New Wings stays dark after Berserk, a reveal-and-discard, Steal Abilities, or a
Doctor Octopus Master Strike. After this packet, every deck-top discard counts for the player
whose deck it came from.

## User-Visible Impact

- In a turn where the only discard was from the top of your deck (Berserk, "Reveal the top card of
  your deck… discard it", Rogue's Steal Abilities, Red Skull's Ruthless Dictator scry, a Doctor
  Octopus strike), New Wings now grants +4 and Pumpkin Bombs +2. That applies whether they were
  played before the discard (the wait-and-see grant fires) or after.
- Nothing changes in a match without New Wings / Pumpkin Bombs (the counter stays unwritten).

## Assumes

- **WP-777 / D-24616 ✅** — `G.cardsDiscardedThisTurn?: Record<string, number>` (per discarding
  player), written only by `recordCardDiscardedThisTurn(G, playerID)` in `moves/discardFromHand.ts`
  (~L46, **not exported today**), gated on
  `matchReadsConditionType(G, CARDS_DISCARDED_THIS_TURN_CONDITION_TYPE)`, deleted at both turn
  boundaries (`game.ts` onBegin, `simulation/onBeginParity.ts`). The condition
  `cardsDiscardedThisTurnAtLeast` is wait-and-see (D-24377).
- **Deck→discard inventory (read-only sweep, 2026-09-28 @ `8afe01c1`).** Exactly **8** sites move a
  card from a player's deck to that player's discard pile; none uses a shared helper:

  | # | Site (`packages/game-engine/src/`) | Mechanic | Whose deck | Shape |
  |---|---|---|---|---|
  | 1 | `hero/heroEffects.execute.ts` `applyRevealDiscard` (~L2182), called from `applyRevealAction` (~L2083) | reveal-rule `discard` action (D-24582) | active player | 1; returns `found` (the rule aborts on `false`, ~L2107) |
  | 2 | `hero/heroEffects.execute.ts` `heroEffectStealAbilities` (~L4810) | Rogue Steal Abilities (D-24401) | each player, own discard | 1 per player; reshuffles an empty deck first |
  | 3 | `hero/effectPrimitive.interpret.ts` `interpretMoveCardNode` (~L484) | `move-card` primitive (Berserk today) | active player | 1; zones are data (`from.zone` / `to.zone`) |
  | 4 | `moves/heroChoice.resolve.ts` `resolveHeroChoice` (~L50) | reveal choose-discard-or-return | active player | 1 |
  | 5 | `moves/revealTopDispose.resolve.ts` `resolveRevealTopDispose` (~L194) | reveal-top-dispose (+ Hypnotic Charm others variant) | `ownerPlayerID` (may be another player) | 1 |
  | 6 | `moves/revealThreeAssign.resolve.ts` `applyRevealThreeDisposition` (~L225) | reveal-three assign (D-24580) | active player | 1 per assignment |
  | 7 | `moves/ruthlessDictatorChoice.resolve.ts` `resolveRuthlessDictatorChoice` (~L161) | Red Skull Ruthless Dictator scry (D-24512) | active player | 1 per call |
  | 8 | `rules/mastermindHandlers.ts` `resolveDoctorOctopusReveal` (~L1129) | Doctor Octopus Master Strike (D-24200 / D-24288) | each struck player | **batch** (hand-built arrays, no `moveCardFromZone`) |

  Excluded (not discards): discard→deck reshuffles, gained/recruited cards entering discard,
  end-of-turn cleanup, KO-from-deck, and hand→discard (already counted via `discardFromHand`).
- `docs/legendary-universal-rules-v23.md` Berserk: "discard the top card of your deck" — the
  same verb the condition reads.
- Engine suite green on `origin/main`.

## Context (Read First)

- **Why count at each site, not a new `discardFromDeck` chokepoint.** The eight sites carry
  contracts a shared move helper would break or have to special-case:
  - #1's `found` return that aborts the rule;
  - #2's empty-deck reshuffle;
  - #3's data-driven zones — the primitive can also move discard→deck;
  - #8's batch rebuild of the whole deck.

  The counter is already a pure, gated, one-line call. So this packet exports it, adds an optional
  `count`, and calls it after each successful deck→discard move. A drift test pins the site set, so
  a future deck→discard site that forgets to count fails loudly — the same role the WP-498 hand
  drift test plays for `discardFromHand`.
- **Whose discard counts.** The deck owner's (the player whose card was discarded), which is also
  whose discard pile receives it — consistent with D-24616 §2's per-discarding-player keying. For
  #5, that is the payload's `args.ownerPlayerID`, not necessarily the chooser. For #2 and #8, it is each affected
  player.
- **Reactions are out of scope.** Cyclops Unending Energy (return-on-discard) and teleport-on-discard
  fire only from `discardFromHand`. Whether a deck-top discard triggers them is a separate ruling;
  unchanged here.
- **Determinism.** The counter stays gated and lazy, so the sentinel `finalStateHash` / `PRE_WP080_HASH`
  cannot move (no bkwd/vill hero in the core sentinel). The `sim:runtime-observed` sweep can shift
  only on a board where a New Wings / Pumpkin Bombs match also runs one of the eight sites.
  Conditional: regenerate only after a per-board tally attributes the diff.
- `docs/ai/DECISIONS.md` — scan D-24616 (the counter; §4 is revised by D-24631), D-24301 (the hand
  chokepoint and its drift test), D-24377 (wait-and-see), D-24582 / D-24401 / D-24580 / D-24512 /
  D-24200 / D-24288 / D-24521 (the eight sites' own decisions).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — no data shape changes; N/A beyond the existing
  `G` field.

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- Never `Math.random()`. No I/O in moves or helpers. Moves never throw.
- `G` stays JSON-serializable. Zones store `CardExtId` strings only.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test` + `makeMockCtx`. No `boardgame.io`
  import in helpers or tests.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`. No `.reduce()`, no abbreviations,
  JSDoc on every function, and full-sentence log text.

**Packet-specific:**
- **Count only after a successful move.** The move must have found the card; a not-found no-op never
  counts.
- **No behavior change at any site** other than the counter call. Return values, reshuffles, logs,
  ordering and the batch rebuild stay byte-identical.
- **Gate unchanged.** Every call goes through `recordCardDiscardedThisTurn`, which keeps its
  `matchReadsConditionType` gate. No site writes `G.cardsDiscardedThisTurn` directly.
- **Reactions untouched.** Return-on-discard and teleport-on-discard stay hand-only.
- **No new `G` field, move, keyword, or handler.** The moves, `HERO_KEYWORDS` and
  `HERO_EFFECT_HANDLERS` pins are unchanged.
- **Sentinel oracles byte-unchanged; no re-pin.**
- **Session protocol:** if the executor finds a deck→discard site not in the table (the drift test
  will name it), STOP and ask before adding it. Never guess its owner.

## Locked Contract Values

- `moves/discardFromHand.ts` exports
  `recordCardDiscardedThisTurn(G: LegendaryGameState, playerID: string, count: number = 1): void`,
  with the same gate and lazy init as today. It adds `count`: a `count <= 0` call returns BEFORE the lazy
  `= {}` init (so a zero-card Doctor Octopus strike never creates an empty map).
  `discardFromHand` keeps calling it with the default.
- **Site calls** (after the successful move; `owner` = the deck's player):
  1. `applyRevealAction`, `discard` branch: `const moved = applyRevealDiscard(playerZones, topCardId); if (moved) { recordCardDiscardedThisTurn(G, playerID); } return moved;`
  2. `heroEffectStealAbilities`: right after `ownerZones.discard = moveResult.to;` (~L4812), `recordCardDiscardedThisTurn(G, ownerPlayerId)` (lower-case `d`; the site has no `found` check because `deck[0]` is guaranteed after its reshuffle).
  3. `interpretMoveCardNode`: when `moveResult.found && moveNode.from.zone === 'deck' && moveNode.to.zone === 'discard'`, `recordCardDiscardedThisTurn(G, playerID)`.
  4. `resolveHeroChoice`, `discard` resolution: after the found move, `(G, playerID)`.
  5. `resolveRevealTopDispose`, `discard` disposition: after the found move, `(G, args.ownerPlayerID)` (the owner is read from `args`; there is no bare `ownerPlayerID` in scope).
  6. `applyRevealThreeDisposition`, `discard`: after the found move, `(G, playerID)`.
  7. `resolveRuthlessDictatorChoice`, `discard`: after the found move, `(G, playerID)`.
  8. `resolveDoctorOctopusReveal`: after the rebuild, `recordCardDiscardedThisTurn(gameState, playerId, discardedCards.length)`.
- **Drift guard** (in `moves/discardFromHand.test.ts`, beside the WP-498 hand guard):
  `DECK_TO_DISCARD_IDIOM = /move(?:CardFromZone|AllCards)\([^,)]*\.deck[^,)]*,[^,)]*\.discard/`. For every non-test
  source file, the number of `recordCardDiscardedThisTurn(` CALLS (comment lines excluded) must be
  ≥ the number of idiom matches, and no comment may contain the literal `recordCardDiscardedThisTurn(`. The matching file set
  must equal exactly `{ heroEffects.execute.ts, heroChoice.resolve.ts, revealTopDispose.resolve.ts,
  revealThreeAssign.resolve.ts, ruthlessDictatorChoice.resolve.ts }` (#1 / #2 share the first). #3
  and #8 do not match the idiom (data-driven zones / hand-built arrays) and are pinned by their own
  site tests. If the set at HEAD differs, STOP (session protocol). The guard checks FILES, not sites:
  `heroEffects.execute.ts` hosts #1 and #2, so the per-site tests and revert proofs stay mandatory.
  The regex also matches comments — no new JSDoc / `// why:` may contain a literal
  `moveCardFromZone(x.deck, x.discard` form.
  The guard's per-file checker is also run on a synthetic in-memory source string (idiom present,
  zero counter calls) and must report a violation — proving it can fail. No hard-coded exemption beyond
  the locked 5-file set.

## Scope (In)

### A) The counter — `moves/discardFromHand.ts`
- Export `recordCardDiscardedThisTurn` with the `count` parameter. Update its JSDoc and `// why:`:
  it now counts hand and deck-top discards (D-24631).

### B) The eight sites (Locked Contract Values)
- `hero/heroEffects.execute.ts` (#1 and #2)
- `hero/effectPrimitive.interpret.ts` (#3)
- `moves/heroChoice.resolve.ts` (#4)
- `moves/revealTopDispose.resolve.ts` (#5)
- `moves/revealThreeAssign.resolve.ts` (#6)
- `moves/ruthlessDictatorChoice.resolve.ts` (#7)
- `rules/mastermindHandlers.ts` (#8)

Each call carries a one-line `// why: D-24631 — a deck-top discard is "you discarded"`.

### B2) Comment-only drift fixes (no code change; cite D-24631)
- `types.ts` (`cardsDiscardedThisTurn?` `// why:` + JSDoc ~L2402–2409), `hero/heroConditions.evaluate.ts`
  (evaluate case ~L258–263 and describe case ~L844), `hero/deferredConditionalGrants.ts` (~L74): today they
  say "hand discards" and "written by discardFromHand only" / "kept at the discardFromHand chokepoint". They
  become "card-effect hand discards and deck-top discards", written by `recordCardDiscardedThisTurn` from the
  hand chokepoint and the deck-top sites. Comment text only — no identifier, type or value changes.

### C) Tests
- `moves/discardFromHand.test.ts`:
  - the guard's synthetic-source failure proof (Locked Values);
  - `count` adds N;
  - `count <= 0` is a no-op;
  - still gated (absent when no hook reads it);
  - the deck→discard drift guard (Locked Values).
- One site test per site, in the site's existing test file. Each builds a state whose
  `heroAbilityHooks` include a hook reading `cardsDiscardedThisTurnAtLeast`, runs the site, and
  asserts the counter for the correct player. Files:
  - `hero/heroEffects.execute.test.ts` (#1 reveal-discard and #2 Steal Abilities — assert every player's entry)
  - `hero/effectPrimitive.interpret.test.ts` or `rules/effectPrimitive.test.ts` (#3 — deck→discard counts; a discard→deck move does not)
  - `moves/heroChoice.resolve.test.ts` (#4)
  - `moves/revealTopDispose.resolve.test.ts` (#5 — the OWNER's entry when owner ≠ chooser; model the entry on the
    `revealedTops` park in `villain/villainEffects.execute.ts` ~L2186, `ownerPlayerID: playerId`)
  - `moves/revealThreeAssign.resolve.test.ts` (#6)
  - `moves/ruthlessDictatorChoice.resolve.test.ts` (#7)
  - `rules/mastermindHandlers.test.ts` (#8 — the count equals the number of discarded cards)
- **New Wings end-to-end** (in `hero/heroEffects.execute.test.ts`, beside the WP-777 block), two cases:
  (a) New Wings waiting → a Berserk (move-card primitive) deck-top discard → `resolveDeferredHeroGrants`
  → +4 once; (b) a Berserk deck-top discard FIRST → `executeHeroEffects(New Wings)` returns 1 and attack is 4.
- **Non-vacuous:** revert each site's call once; its site test must fail. Report 8/8.

### D) Generated artifacts (conditional)
- `docs/ai/coverage/runtime-observed-hollows.json` — only if `sim:runtime-observed:check` goes stale
  AND a per-board tally vs `origin/main` confines the diff to boards where the condition is read.
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — the feed-bound pin only, only if the
  feed moved, re-pinned to the regenerated value with the tally in the comment.

## Out of Scope

- Return-on-discard / teleport-on-discard reactions on deck-top discards (a separate ruling).
- Discards from zones other than hand and deck top (none exist today).
- Villain-side Berserk (an Enemy with Berserk) — no engine site exists; if one lands later, it must
  call the counter (the drift guard names it when it uses the idiom).
- Any change to which cards read the condition, or to its wait-and-see shape.

## Files Expected to Change

Engine source (`packages/game-engine/src/`):
- `moves/discardFromHand.ts` — modified — export `recordCardDiscardedThisTurn` with `count`
- `hero/heroEffects.execute.ts` — modified — counter calls at #1 (`applyRevealAction`) and #2 (Steal Abilities)
- `hero/effectPrimitive.interpret.ts` — modified — counter call at #3 (move-card deck→discard)
- `moves/heroChoice.resolve.ts` — modified — counter call at #4
- `moves/revealTopDispose.resolve.ts` — modified — counter call at #5 (deck owner)
- `moves/revealThreeAssign.resolve.ts` — modified — counter call at #6
- `moves/ruthlessDictatorChoice.resolve.ts` — modified — counter call at #7
- `rules/mastermindHandlers.ts` — modified — counter call at #8 (batch count)
- `types.ts` — modified (comment-only) — B2 wording
- `hero/heroConditions.evaluate.ts` — modified (comment-only) — B2 wording
- `hero/deferredConditionalGrants.ts` — modified (comment-only) — B2 wording

Engine tests (existing files, **modified** — new tests only):
- `moves/discardFromHand.test.ts` — modified — `count` cases + the deck→discard drift guard
- `hero/heroEffects.execute.test.ts` — modified — #1, #2 site tests + the two New Wings end-to-end cases
- `hero/effectPrimitive.interpret.test.ts` or `rules/effectPrimitive.test.ts` (whichever holds the #3 test)
- `moves/heroChoice.resolve.test.ts`
- `moves/revealTopDispose.resolve.test.ts`
- `moves/revealThreeAssign.resolve.test.ts`
- `moves/ruthlessDictatorChoice.resolve.test.ts`
- `rules/mastermindHandlers.test.ts`

Generated (**conditional**, section D):
- `docs/ai/coverage/runtime-observed-hollows.json`
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (feed-bound pin only)

Governance:
- `docs/ai/STATUS.md`
- `docs/ai/DECISIONS.md` (D-24631 → Active; D-24616 §4 annotated "revised by D-24631")
- `docs/ai/work-packets/WORK_INDEX.md`
- `docs/ai/execution-checklists/EC_INDEX.md`
- `docs/05-ROADMAP-MINDMAP.md`

No other files may be modified.

## Contract

- `recordCardDiscardedThisTurn(G, playerID, count = 1)` is the single writer of
  `G.cardsDiscardedThisTurn`. It is called by `discardFromHand` and by all eight deck→discard sites,
  after a successful move, for the deck owner.
- "Discarded this turn" = card-effect hand discards + deck-top discards. Cleanup, gains and KOs do
  not count.

## Acceptance Criteria

1. Each of the eight sites increments the deck owner's count by exactly the number of cards it moved
   to discard, and only when the move happened.
2. #5 counts for `args.ownerPlayerID`. #2 and #8 count for each affected player.
3. A `move-card` from discard to deck does not count.
4. New Wings played before a Berserk deck-top discard grants +4 once that turn. Played after it, New
   Wings grants +4 immediately.
5. A match with no hook reading the condition never creates `G.cardsDiscardedThisTurn` (sentinel
   oracles unchanged).
6. Every existing test at the eight sites still passes without edits (no behavior change beyond the
   count).
7. The drift guard passes. Adding a deck→discard idiom to a new file without the counter fails it.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/registry --filter @legendary-arena/game-engine build
# Expected: exits 0
pnpm --filter @legendary-arena/game-engine test
# Expected: 0 fail; record before/after counts
pnpm --filter @legendary-arena/game-engine exec node --import tsx --test "src/test/fixtures/replayFixtures.test.ts"
git diff --exit-code -- packages/game-engine/src/test/fixtures/games
# Expected: green; exits 0
pnpm sim:runtime-observed:check
# Expected: exits 0; or a diff attributed per board, then `pnpm sim:runtime-observed` once
pnpm -r build; pnpm -r --no-bail test
pnpm --filter @legendary-arena/dashboard typecheck
# Expected: 0 failures; exits 0
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All ACs pass. 8/8 site revert proofs are reported.
- [ ] `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. Engine counts are recorded.
- [ ] Sentinel / replay oracles byte-identical with no re-pin. Moves / keyword / handler pins
      unchanged.
- [ ] `sim:runtime-observed:check` exits 0, regenerated only after an attributed per-board tally.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED):** in a manual match with New Wings plus a deck-top discard
      source (e.g. a Berserk hero or Rogue), a turn whose only discard is from the deck top grants
      New Wings +4. Record the matchId in STATUS.md.
- [ ] STATUS.md updated. D-24631 → Active. D-24616 §4 annotated.
- [ ] WORK_INDEX WP-784 `[x]` with date. EC_INDEX EC-821 → Done. Mindmap `📝`→`✅`.
      `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:** §1 / §2 (faithful printed rules — Berserk's own wording is "discard the top
  card of your deck"), §3 (fairness — the same discard counts the same everywhere), §8 / §22
  (determinism — the gated lazy field is unchanged), §18 / §24 (replay-verified competitive integrity —
  pre-WP-784 replays may diverge; handled by the D-24616 §5 frozen-rows policy), §20–§21 (scoring —
  restores grants the rules allow). NG-1 not crossed.
- **Conflict assertion:** No conflict. No monetization surface.
- **Determinism preservation:** no new state. The counter is gated and lazy. Pre-WP-784 replays with
  New Wings / Pumpkin Bombs plus a deck-top discard may diverge on re-execution. Stored
  `competitive_scores` rows stay frozen (the D-24616 §5 policy, see Vision §24).

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 structure:** every required section is present. Baseline `8afe01c1` cited.
- **§2 constraints:** engine-wide, packet-specific, session protocol, locked values.
- **§3 / §4:** WP-777 / D-24616 and the eight-site inventory with anchors. Rules text, 00.2 and a
  DECISIONS scan list are cited.
- **§5 / §7:** a closed 8-source + 3 comment-only + 8-test allowlist with per-entry descriptions, two named conditionals, and governance. No new
  deps.
- **§6 naming:** source names verbatim (`recordCardDiscardedThisTurn`, `args.ownerPlayerID`,
  `ownerPlayerId`, `discardedCards`). `MatchSetupConfig` untouched.
- **§8 layer:** engine only.
- **§9 Windows:** `pwsh` verification.
- **§10 / §11:** N/A — no env var or auth surface.
- **§12 tests:** `node:test` + `makeMockCtx`, a revert proof per site, and a drift guard.
- **§13 / §14 / §15:** exact commands, 7 binary ACs, and a DoD with STATUS, DECISIONS, WORK_INDEX,
  D-24026.
- **§16 code style:** one `// why:` per site. The counter keeps its `for`-free, `.reduce()`-free
  body.
- **§17 Vision:** present.
- **§18 prose-vs-grep:** the drift guard asserts an exact file set, not a count.
- **§19:** N/A — baseline recorded.
- **§20 Funding:** N/A — engine-only rules fidelity; no funding surface or copy.
- **§21 API Catalog:** N/A — no `apps/server` endpoint or `Library-only` function touched.

## Gate Verdicts

- **Pre-flight (01.4): READY TO EXECUTE.** Baseline at `8afe01c1`: engine 4692/0 (1079 suites). The 8-site
  inventory was independently confirmed complete. The drift regex was run against the source and matches exactly
  the 5 claimed files. No import cycle. PS-1 applied: #5's owner is `args.ownerPlayerID`. RS items applied: #2 pinned
  to `ownerPlayerId` after the move; `count <= 0` returns before the lazy init; the guard is file-level (site tests
  stay mandatory) and comment-sensitive; the #3 test may live in either effect-primitive test file; a #5 owner
  fixture model is named. RS-4: rebase onto the then-current `origin/main` before executing (none of the files had moved at `fdfe8d5e`).
- **Copilot (01.7): RISK → HOLD, fixes applied.** Six scope-neutral findings:
  - stale hand-only comments in `types.ts` / `heroConditions.evaluate.ts` / `deferredConditionalGrants.ts`
    are now comment-only allowlist entries (section B2);
  - the drift guard requires per-file call count ≥ idiom matches, with no comment satisfying it;
  - the idiom widened to `move(?:CardFromZone|AllCards)` (the same 5-file set at source);
  - AC-4's "after" case has a named test;
  - D-24631 §2 gives the owner-keyed rationale;
  - the lane line says 8 source files.
  D-24631 §2's owner-keyed reading for Hypnotic Charm (the chooser is not credited) was CONFIRMED by Jeff
  2026-09-29: the discard counts only for the deck's owner.
- **Delta re-run (01.4 + 01.7): READY / PASS.** Regex confirmed at source (5 files; heroEffects 2 matches);
  per-file call-count rule satisfiable; B2 anchors confirmed.
- **Lint (00.3): PASS.** First run FAIL on four mechanical items: EC drift-guard value not verbatim, §5
  per-entry tags, no guard-can-fail proof, Vision §18 / §24. Plus B2 widened to the "written by" wording,
  B2 wording unified, the B2 `// why:` cite added to the EC, and file counts refreshed. All applied.
