# WP-282 — Undercover: Face-Down Zone Architecture + Send/Play Moves

**Status:** Drafted 2026-06-23  
**Baseline:** `origin/main` at commit `e08d9446` (WP-281 governance close)  
**Paired with:** EC-313 (Session 1: architecture + core moves), EC-314 (Session 2: keyword + integration)  
**Scope Pattern:** Ambitious (multi-session, architectural foundation)

---

## Context

The **undercover** mechanic (*"send a card face-down; play it later from face-down state"*) is the **second-highest in-play hollow** (20 observations across 3 sets: 2099, bkwd, shld). Unlike dodge/wall-crawl, undercover requires a **new zone type** — a face-down card store that hides card identity until retrieval.

This WP establishes the architectural foundation that will unlock face-down mechanics for future WPs (cloaking devices, hidden reveals, etc.). The pattern applies beyond undercover: any mechanic requiring hidden information or pending player state needs this zone architecture.

---

## Scope (Two-WP Sequence)

### Session 1 (EC-313): Architecture + Core Moves
**Layer:** Game Engine only (`packages/game-engine/`)

Deliverables:
- Add `FaceDownZone` type to `G.playerZones` (per-player face-down card store)
- Add `sendUndercover(cardId, sourceZone)` move
  - Source zones: `hand`, `hq`, `revealed`
  - Validates source, removes from source, adds to player's face-down store
  - Returns silently on invalid state (Move Validation Contract)
- Add `playFromUndercover(cardId)` move
  - Retrieves from face-down store, plays as if from hand
  - Returns silently if card not found
- Add `lookAtUndercover(cardId)` helper (for debugging/tests)
  - Reveals identity to console only (no G mutation)
- **Determinism rule:** identity stored in engine state, display randomized per UI render
- Engine tests: setup, send from 3 sources, play from undercover, identity contract, determinism

**Tests:** 30+ new; engine test baseline preserved

### Session 2 (EC-314): Keyword + Parser + Full Integration
**Layer:** Game Engine + Data

Depends on Session 1 moves landing first.

Deliverables:
- Add `undercover` as a `HeroKeyword` in `HERO_KEYWORDS` array
- Parser recognizes `[keyword:Undercover]` in ability text
- Wire into `heroEffects.execute.ts` conditional-hook system
- Test: play a 2099 hero with undercover text, send a card, play it back via team:[spider-friends]
- Full match test: 5 Black Widow + 5 Ghost Rider + 5 Doctor Doom 2099 cards in a pilot game

**Tests:** 15+ new integration tests

---

## Hard Dependencies

- **WP-021 / EC-057** ✅: Hero abilities + effect hooks (already exist)
- **WP-067** ✅: Zone types infrastructure (already exist)
- **WP-128** ✅: G shape contracts (already exist)
- **None on WP-166+:** The zone is engine-internal; no UI changes in Session 1

---

## Technical Design (Locked)

### FaceDownZone Structure

```typescript
interface FaceDownCard {
  cardId: CardExtId; // The real card identity (stored deterministically)
  ownerPlayerId: string; // Who owns this face-down card
}

interface PlayerZones {
  // ... existing zones ...
  faceDownCards: readonly FaceDownCard[]; // Per-player face-down store (immutable snapshot)
}
```

### Determinism Rule (Load-Bearing)

- **Identity is stored:** `FaceDownCard.cardId` holds the real CardExtId
- **Display is randomized:** UI generates "Undercover Card A", "Undercover Card B", etc. on render
- **Randomization is per-render:** Replay shows the same display string (uses same seed/render path)
- **Opponent projection:** Never exposes real identity via `UIState` (projection layer enforcement)
- **Rewind-safe:** Stored identity is deterministic → rewind is transparent → sentinel hash unchanged

### Move Contract

```typescript
// Send a card face-down from a source zone
sendUndercover({
  cardId: CardExtId,
  sourceZone: 'hand' | 'hq' | 'revealed' // Where the card is now
}): void
// Silently returns on invalid state (Move Validation Contract)

// Play a card from face-down state (retrieve & play)
playFromUndercover({
  cardId: CardExtId // The stored identity (not displayed name)
}): void
// Silently returns if card not in face-down store

// Debugging helper (no G mutation, no UI side-effect)
lookAtUndercover({
  cardId: CardExtId
}): string
// Returns: "<real cardId identity>" (for test assertions)
```

---

## Out of Scope (Honest-Partial)

- ❌ **UI rendering of face-down cards** (Session 2 follow-up: visual treatment, card flipping animations)
- ❌ **Spy mechanics** (opponent-can-peek-face-down interactions — future WP, requires opponent-visible hidden state)
- ❌ **Bind mechanics** (soulbind + face-down state interactions — future WP, requires cross-card state)
- ❌ **Multi-copy shuffling** (if hero has multiple copies sent undercover, randomize which plays — future WP, requires probabilistic move choice)

---

## Reserved Decisions

- **D-24059** — Face-down zone is **per-player** (not global); owned-card semantics (each card tracks owner for security)
- **D-24060** — Identity **stored but display randomized per render** (enables determinism + hidden-information contract)
- **D-24061** — **No UI changes Session 1** (pure engine contract); visual rendering added Session 2

---

## Acceptance Criteria (Binary)

**Session 1 (EC-313):**
- ✅ `G.playerZones.faceDownCards` initialized empty per player at setup
- ✅ `sendUndercover` move validates source zone and transfers card
- ✅ `playFromUndercover` move retrieves correct hidden card and plays it
- ✅ Identity is hidden from opponent `UIState` projections
- ✅ Determinism test: replay with same seed shows identical face-down sequence
- ✅ Engine tests: **30+ new** (setup 2, send from 3 sources ×2, play ×2, opponent projection ×2, determinism ×3, multi-player scenarios ×10)
- ✅ Sentinel replay hash unchanged (zone is transparent to final state)
- ✅ No new contracts (zone type added to existing `PlayerZones` interface)

**Session 2 (EC-314):**
- ✅ `undercover` keyword recognized in hero ability text
- ✅ 2099 Spider-Friends card successfully sends & plays from undercover
- ✅ Full hero match: Black Widow + Ghost Rider + Doctor Doom 2099 undercover mechanics work end-to-end
- ✅ Determinism test: replayed match shows same identity for face-down cards (display varies, identity does not)
- ✅ Engine tests: **15+ new** (parser ×3, move integration ×5, full match ×7)

---

## User-Visible Surface

**Session 1:** `none — infrastructure`  
**Session 2:** `play.legendary-arena.com` (D-24026 gate applies to full integration test with real 2099 heroes)

---

## See Also

- [WP-273](WP-273-wall-crawl-onrecruit-keyword.md) (recruitment-side mechanics pattern)
- [WP-275](WP-275-dodge-hand-discard-move.md) (new move pattern)
- [WP-280](WP-280-spectrum-conditional-keyword.md) (conditional gates)
- [D-12803](../DECISIONS.md) (UIState projection safety)
- [D-14102](../DECISIONS.md) (per-card instance generation precedent)
- [DESIGN-HOLLOW-EFFECT-DETECTION.md](../DESIGN-HOLLOW-EFFECT-DETECTION.md) (reporting integration pattern)
