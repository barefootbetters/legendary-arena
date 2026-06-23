# EC-314 — WP-282 Session 2: Keyword + Parser + Full Integration

**Status:** Drafted 2026-06-23  
**WP:** [WP-282](../work-packets/WP-282-undercover-face-down-zone.md)  
**Session Focus:** Game Engine + data recognition  
**Depends On:** EC-313 (Session 1) merged to main  
**Scope:** Add `undercover` keyword, parser recognition, effect integration  

---

## Locked Values (Do Not Change)

| Item | Value | Authority |
|------|-------|-----------|
| Keyword Name | `undercover` | WP-282 §Session 2 |
| Keyword Marker | `[keyword:Undercover]` | card data (2099, bkwd, shld sets) |
| Parser Target | `heroEffects.execute.ts` conditional-hook system | WP-282 §Session 2 |
| Pilot Cards | 5×Black Widow, 5×Ghost Rider, 5×Doctor Doom (all from 2099) | WP-282 §Session 2 |
| Test Count Minimum | 15+ new integration tests | WP-282 §Acceptance Criteria |
| Test Match Scope | Full hero match (setup → gameover) | WP-282 §Acceptance Criteria |

---

## Hard Dependency

- ✅ **EC-313 must be merged to main first** (Session 1 provides the moves)
- ✅ **WP-021 / EC-057** (hero abilities exist)
- ✅ **WP-067** (zone types exist)

---

## Implementation Checklist

### Keyword Registration
- [ ] Add `undercover` to `HERO_KEYWORDS` array in `packages/game-engine/src/keywords.ts`
- [ ] Verify drift test: `keywords.drift.test.ts` updated to include `undercover` in expected array (7 keywords → 8)
- [ ] Update drift test file to assert new count
- [ ] **Lock hook timing:** keyword triggers on `onPlay` ONLY (Session 1 scope) ← D-24062

### Parser: Recognize `[keyword:Undercover]` in Ability Text
- [ ] Hero ability parser recognizes `[keyword:Undercover]` marker (uses existing `parseKeyword` pattern)
  - [ ] **Case-sensitive:** only `[keyword:Undercover]` (capital U) matches
  - [ ] Fails gracefully on malformed markers (`[keyword:undercover]`, `[undercover]`)
- [ ] Creates a parsed `HeroAbility` with `keyword: 'undercover'` in its metadata
- [ ] Test: parse a 2099 hero ability containing `[keyword:Undercover]` and verify keyword is recognized
- [ ] Test: parser is case-sensitive (rejects lowercase or malformed)

### Effect Integration: Wire into `heroEffects.execute.ts`
- [ ] Add handler for `keyword: 'undercover'` to fire on `onPlay` ONLY (locked scope)
- [ ] Handler logic: (minimal, no state mutation)
  - [ ] Detect that a hero has the undercover keyword
  - [ ] Log to `G.messages`: "Hero played with undercover ability active"
  - [ ] Do NOT execute moves automatically (player chooses when to call `sendUndercover`)
  - [ ] Do NOT mutate state directly (IC-282-10)
- [ ] Test: hero with undercover keyword is played, hook fires, message is logged
- [ ] Test: hook fires once per hero (no duplication on multiple undercover heroes)

### Full Integration Test: 2099 Heroes
- [ ] Test scenario: play a 2099 Black Widow with undercover ability
  - [ ] Draw the card
  - [ ] Play the card
  - [ ] Verify undercover keyword is recognized
  - [ ] Verify effect hook fires (message logged)
  - [ ] Verify `sendUndercover` move is legal (can be called)
  - [ ] Call `sendUndercover` with a card from hand
  - [ ] Verify card moves to face-down store (snapshot: `faceDownCards.length` increments)
  - [ ] Later, call `playFromUndercover` and verify card plays (snapshot: card is now in played zone)

- [ ] Test scenario: Edge case — no valid card to send
  - [ ] Play undercover hero with empty hand
  - [ ] Verify no error; move simply returns silently

- [ ] Test scenario: Multiple undercover heroes
  - [ ] Play two undercover heroes in sequence
  - [ ] Verify hook fires twice (no duplication bugs)
  - [ ] Each can independently send cards

- [ ] Test scenario: Spider-Friends team interaction
  - [ ] Play multiple Black Widow cards (team:[spider-friends])
  - [ ] Send a card undercover
  - [ ] Trigger Spider-Friends effect
  - [ ] Verify the undercover card can be played via the team effect

### Match-Level Determinism Test (Load-Bearing)
- [ ] Full match: 5 Black Widow + 5 Ghost Rider + 5 Doctor Doom 2099 in player 1's hero deck
- [ ] Opponent has a standard deck (no undercover mechanics)
- [ ] Run match to completion (gameover or 200 turns)
- [ ] Replay with **identical seed**
- [ ] **Explicit assertions** (not narrative):
  - [ ] `G.playerZones[player1].faceDownCards.length` is identical in both runs
  - [ ] Every `instanceId` in `faceDownCards` is identical in order
  - [ ] Final state hash matches (or re-pinned if sentinel includes the zone)
  - [ ] Identical sequence of moves executed in both replays
  - [ ] No non-deterministic shuffles or random choices

### Tests (20+ new)
- [ ] Create `packages/game-engine/src/keywords/__tests__/undercover.test.ts`:
  - [ ] Parser recognizes `[keyword:Undercover]` marker
  - [ ] Keyword is in the parsed ability metadata
  - [ ] **Case-sensitive: rejects `[keyword:undercover]` (lowercase)**
  - [ ] **Case-sensitive: rejects `[undercover]` (malformed)**
  - (4+ tests)

- [ ] Create `packages/game-engine/src/heroes/__tests__/2099-undercover-integration.test.ts`:
  - [ ] Black Widow card can be played
  - [ ] Undercover keyword hook fires on play
  - [ ] Hook message is logged to `G.messages`
  - [ ] `sendUndercover` move is legal after hook fires
  - [ ] Card moves from hand to face-down
  - [ ] `playFromUndercover` retrieves the card
  - [ ] **Edge case: undercover hero played with empty hand (silent success)**
  - [ ] **Multiple undercover heroes: hooks fire without duplication**
  - [ ] Spider-Friends team interaction works with undercover
  - (9+ tests)

- [ ] Create full-match integration test `packages/game-engine/src/__tests__/undercover-full-match.integration.test.ts`:
  - [ ] Match setup: 5BW + 5GR + 5DD2099 vs standard deck
  - [ ] Match runs to completion without error
  - [ ] Undercover cards are sent and played during match
  - [ ] **Explicit assertion: `faceDownCards` count matches between runs**
  - [ ] **Explicit assertion: `instanceId` ordering is identical**
  - [ ] Determinism: replay with same seed produces same final state
  - [ ] No regressions: existing cards/mechanics work unchanged
  - (7+ tests)

- [ ] Update `packages/game-engine/src/__tests__/game.test.ts`:
  - [ ] Keyword array includes `undercover` (7 → 8)
  - [ ] Move count includes both undercover moves (unchanged from EC-313)

### Engine Test Baseline
- [ ] Run full test suite: `pnpm test` (from `packages/game-engine/`)
- [ ] Capture baseline: ~406 → ~421 tests (15+ new)
- [ ] Verify: all tests pass, no regressions

### Determinism Verification (Critical)
- [ ] Run sentinel hash test: replay with same seed
- [ ] Verify: final state hash is unchanged (face-down identities are deterministic)
- [ ] Verify: display strings vary per render (if UI is implemented), but identity is fixed

### Code Style Compliance
- [ ] No `Math.random()` anywhere (only `ctx.random.*` — no changes needed, inherited from EC-313)
- [ ] No `try/catch` in moves or hooks (return silently instead)
- [ ] Comments: every effect hook includes `// why:` explaining when it fires
- [ ] No `.reduce()` in effect application

### Layer Boundary Compliance
- [ ] **Only** in `packages/game-engine/src/` (no server, no dashboard changes in Session 2)
- [ ] No imports from `registry` runtime code
- [ ] No imports from `preplan`, `server`, or `apps/*`

---

## Merge Checklist (Before Commit)

- [ ] Tests pass: `pnpm test` (0 failures, 421+ total)
- [ ] Typecheck passes: `pnpm -r typecheck`
- [ ] No style drift: no commented-out code, no `TODO`s
- [ ] WORK_INDEX.md prepared for status update (not updated yet — that's the governance close)
- [ ] No orphaned code: every helper is tested

---

## Expected Artifacts

After this session completes:

**Files Created/Modified:**
- `packages/game-engine/src/keywords.ts` (add `undercover` to `HERO_KEYWORDS` array)
- `packages/game-engine/src/keywords/__tests__/keywords.drift.test.ts` (update assertion: 7 → 8 keywords)
- `packages/game-engine/src/keywords/__tests__/undercover.test.ts` (new, 2+ tests)
- `packages/game-engine/src/heroes/__tests__/2099-undercover-integration.test.ts` (new, 6+ tests)
- `packages/game-engine/src/__tests__/undercover-full-match.integration.test.ts` (new, 5+ tests)
- `packages/game-engine/src/__tests__/game.test.ts` (update keyword count assertion, verify move count)

**Commit Message Format:**
```
EC-314: Undercover keyword + parser recognition + full integration

- Add undercover to HERO_KEYWORDS array (recognize [keyword:Undercover])
- Wire into heroEffects.execute conditional-hook system
- 15+ new tests: parser, keyword hook, 2099 full match, determinism
- Full match determinism verified: 5×Black Widow + Ghost Rider + Doctor Doom 2099
- D-24059 / D-24060 / D-24061 confirmed (per-player zone, stored identity, no UI changes)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## Governance Close (After Session 2 Lands)

Once this session's PR is merged:
- Update WP-282 status: `Session 1 Complete` → `Done`
- Update EC-314 status: `Drafted` → `Done`
- Update WORK_INDEX.md: WP-282 line changes to `Done (EC-313 & EC-314 merged)`
- Log post-session D-24026 live-verify gate (if applicable)

---

## Failure Modes & Recovery

**If `sendUndercover` move does not work:**
- Verify EC-313 is actually merged to main (check `git log`)
- Verify move is registered in `Game.moves` (check game.ts registration)
- Run determinism test; if it fails, the zone type may not be serializing correctly

**If parser doesn't recognize `[keyword:Undercover]`:**
- Check that the marker is EXACTLY `[keyword:Undercover]` (case-sensitive)
- Verify the parser is using the same `parseKeyword` pattern as other keywords
- Check test input cards (2099 set) for marker presence

**If full match runs but determinism fails:**
- Check that face-down card identities are stored (not randomized) in G
- Verify replay uses same seed
- Run a simpler determinism test (just `sendUndercover` + `playFromUndercover`, no full match)

---

## See Also

- [WP-282](../work-packets/WP-282-undercover-face-down-zone.md) (parent work packet)
- [EC-313](EC-313-wp282-session1-face-down-architecture.md) (Session 1: provides the moves)
- [D-24059, D-24060, D-24061](../DECISIONS.md) (locked decisions)
- [2099 card data](../../packages/registry/data/cards/2099.json) (source of undercover mechanics)
