# EC-826 — Reveal card visible (Execution Checklist)

**Source:** docs/ai/work-packets/WP-789-reveal-card-visible.md
**Layer:** Game Engine + App arena-client

## Before Starting
- [ ] `pnpm --filter "@legendary-arena/arena-client^..." build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` and `pnpm --filter @legendary-arena/arena-client test` exit 0 (record baselines)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (Before; the client reads the engine's built dist types)
- [ ] Confirm on `main`: the `applyRevealRules` emit is gated on `revealLogOutcome !== 'blocked'`; `eventCardId` returns `''` for `heroEffectResolved`
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- `HeroEffectResolvedEvent` gains `revealedCardId?: CardExtId`: optional, with a JSDoc `// why:`
  (WP-789 / D-24637). It is set only by the `applyRevealRules` emit. Other emit sites leave it absent.
- `applyRevealRules` emit condition becomes
  `!revealRulesContainAnyAction(rules, ['choose-discard-or-return']) && Array.isArray(G.notableEvents)`
  (the `revealLogOutcome !== 'blocked'` clause is removed). The pushed event is
  `{ type: 'heroEffectResolved', playerId: playerID, narrative, revealedCardId: topCardId }`.
- Narrative `outcomeText`:
  - matched → `matchedActionPhrases.join(', ')` (unchanged);
  - miss (`matchedPredicateText === undefined`) → `left on top`.
  - The composer is unchanged. A miss therefore reads, e.g.,
    `"Card Shark" revealed "S.H.I.E.L.D. Agent" (cost 0) — left on top.`
- **Multi-card reveals with a reorder (reveal-count ≥ 2 + `reorderRemainder`).** `applyRevealRules` gains a
  final optional parameter `deferredEvents?: { event: HeroEffectResolvedEvent; isMiss: boolean }[]`. When it
  is provided, EVERY event (hit or miss) is pushed there, in reveal order, instead of `G.notableEvents`.
  - `heroEffectReveal` passes a local buffer only when `effect.reorderRemainder === true`, and tracks
    `let didParkReorder = false`, set inside its `remainderCount >= 2` park branch.
  - After the loop (it also runs on the deck-exhausted `break` exit), it pushes the buffer to
    `G.notableEvents` in order:
    - all entries when `!didParkReorder`;
    - only the `isMiss === false` entries when it parked.
  - A parked reorder prompt already shows the remainder, which keeps the D-24547 double-surface rule.
  - Reveals without `reorderRemainder` pass no buffer and emit inline (unchanged ordering).
- **Projection (UIState five-step).**
  - `UIState.notableEventCards?: UIDisplayEntry[]` — one `{ extId, display }` per DISTINCT
    `revealedCardId` in `G.notableEvents`, in first-appearance order, built by deduping the ids and
    calling the existing `buildDisplayEntries` (as `transformDeck` does) in `buildUIState`.
  - The field is omitted when there are none (conditional spread, never `undefined`).
  - PUBLIC: `filterUIStateForAudience` copies it for every audience, with the `transformDeck`
    conditional-copy pattern (~L666).
- Client:
  - `eventCardId` returns `event.revealedCardId ?? ''` for `heroEffectResolved`, so the card-name row
    appears when the id is present and stays hidden when it is absent (today's behavior).
  - `PlayDesktop.vue` `notableEventCardLookup` folds `notableEventCards` into its map with the
    existing first-wins `store()`, so a revealed card still in the deck resolves.
  - `NotableEventOverlay.vue` renders
    `<img class="notable-event-overlay__card-image" data-testid="play-notable-event-overlay-card-image">`
    only when `event.type === 'heroEffectResolved'` and the resolved `cardDisplayData[id].imageUrl` is
    a non-empty string. `alt` = the card name. There is no image for any other event type, and none
    when the id or URL is missing.

## Guardrails
- No game-state change: grant, draw, deck order, the `G.messages` line and return values stay byte-identical.
- Parking reveals (`choose-discard-or-return`) still emit nothing (D-24547 double-surface rule).
- Client renders served data only (D-20105); narrative verbatim; no client rule logic.
- Only `heroEffectResolved` gains an image; other overlay types unchanged.
- Sentinel oracles byte-unchanged; a moved oracle is an emit leak, never a re-pin.
- Existing tests pass WITHOUT edits, EXCEPT the one authorized inversion: WP-726 `does NOT emit on a blocked reveal`
  (`heroEffects.execute.test.ts` ~L1997) — rename + assertion changes only, fixture kept (length 1, `revealedCardId ===
  'starter-agent'`, narrative ends `— left on top.`). Say so in the EC commit body. No comment-only edits to other tests.

## Required `// why:` Comments
- The emit condition: D-24637 revises D-24547 §2 — a miss is exactly when the player needs to see the card (it stays on top).
- `revealedCardId` field + write: the overlay resolves the card like `ambushResolved` / `bystanderRevealed`; a revealed card is public.
- The `eventCardId` branch and the overlay image guard (served data only; absent id → today's render).
- The reorder event buffer and its flush: a parked reorder prompt already shows the remainder (D-24547 double-surface
  rule); buffering every event keeps reveal order.
- `notableEventCards` declaration + build: a revealed card often stays in the deck, outside every projected zone (D-24637 §3).
- The `notableEventCards` filter pass-through: public, copied field-by-field like `transformDeck` (the Board-Visible Field Rule).

## Files to Produce
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — optional `revealedCardId` + JSDoc rewrite
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — emit on a miss + id; reorder event buffer
- `apps/arena-client/src/composables/useNotableEventStream.ts` — **modified** — `eventCardId` branch
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — **modified** — reveal card image
- `packages/game-engine/src/ui/{uiState.types,uiState.build,uiState.filter}.ts` — **modified** (`notableEventCards`)
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** (lookup fold)
- Tests (**modified**): `packages/game-engine/src/{hero/heroEffects.execute,events/notableEvents.types,ui/uiState.filter,ui/uiState.build}.test.ts`,
  `apps/arena-client/src/pages/PlayDesktop.test.ts`,
  `apps/arena-client/src/composables/useNotableEventStream.test.ts`, `apps/arena-client/src/components/play/NotableEventOverlay.test.ts`
- `docs/ai/{STATUS,DECISIONS}.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] Engine + client suites 0 fail; before/after counts recorded; arena-client vue-tsc exits 0 (After)
- [ ] 6/6 revert proofs: (a) emit condition, (b) `revealedCardId` write, (c) `eventCardId` branch, (d) image `v-if`,
      (e) `notableEventCards` build/pass-through, (f) reorder event buffer (incl. the [miss, hit, hit] order case)
- [ ] `replayFixtures.test.ts` green + `git diff --exit-code -- packages/game-engine/src/test/fixtures/games` exits 0
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 failures; `git status --porcelain` ⊆ Files to Produce
- [ ] Live (D-24026): Card Shark miss shows the card image + "left on top"; High Stakes Jackpot shows the revealed card image;
      diagnostics `uiStateSnapshot` carries `notableEventCards`; matchId in STATUS.md
- [ ] STATUS.md updated; D-24637 → Active; D-24547 §2 annotated "revised by D-24637"
- [ ] WORK_INDEX WP-789 `[x]` with date; EC_INDEX EC-826 → Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write` + `:check` exit 0

## Common Failure Smells
- Card Shark misses still silent → the `'blocked'` clause was left in the emit condition.
- Overlay shows the name but no image → `eventCardId` fixed but the `v-if` / imageUrl lookup missing.
- A miss shows a raw ext_id → `notableEventCards` not built, not passed through, or not folded into the PlayDesktop lookup.
- Amazing Spider-Man shows three overlays AND a reorder prompt → the miss buffer was not used for `reorderRemainder` reveals.
- Fight overlays suddenly show images → the image guard does not check `event.type`.
- reveal-attack-choose shows an overlay AND a prompt → the `choose-discard-or-return` exclusion was dropped.
- Sentinel hash moved → an emit fired outside `applyRevealRules`.
