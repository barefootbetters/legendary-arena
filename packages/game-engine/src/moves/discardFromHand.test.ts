/**
 * Tests for the forced-discard chokepoint + return-on-discard reaction
 * (WP-498 / D-24301) and the drift-guard that keeps hand→discard mutations
 * funnelled through the single chokepoint.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import {
  discardFromHand,
  checkReturnOnDiscard,
  cardCarriesReturnOnDiscard,
} from './discardFromHand.js';

const UNENDING_ENERGY = 'core/cyclops';
const PLAIN_CARD = 'core/spider-man';

/**
 * Builds a minimal game state with one player, the given hand/discard, and a
 * heroAbilityHooks list marking UNENDING_ENERGY with return-on-discard.
 */
function makeState(hand: string[], discard: string[]): LegendaryGameState {
  const hooks: HeroAbilityHook[] = [
    { cardId: UNENDING_ENERGY, timing: 'onDiscard', keywords: ['return-on-discard'] },
  ];
  return {
    playerZones: { '0': { deck: [], hand: [...hand], discard: [...discard], inPlay: [], victory: [] } },
    heroAbilityHooks: hooks,
  } as unknown as LegendaryGameState;
}

describe('cardCarriesReturnOnDiscard (WP-498 / D-24301)', () => {
  it('true for a card marked return-on-discard, false otherwise', () => {
    const G = makeState([], []);
    assert.equal(cardCarriesReturnOnDiscard(G, UNENDING_ENERGY), true);
    assert.equal(cardCarriesReturnOnDiscard(G, PLAIN_CARD), false);
  });

  it('false (no throw) when heroAbilityHooks is absent', () => {
    const G = { playerZones: {} } as unknown as LegendaryGameState;
    assert.equal(cardCarriesReturnOnDiscard(G, UNENDING_ENERGY), false);
  });
});

describe('discardFromHand (WP-498 / D-24301)', () => {
  it('moves the card hand→discard and parks a pending return for a marked card', () => {
    const G = makeState([UNENDING_ENERGY, PLAIN_CARD], []);
    const found = discardFromHand(G, '0', UNENDING_ENERGY);
    assert.equal(found, true);
    assert.deepEqual(G.playerZones['0']!.hand, [PLAIN_CARD]);
    assert.deepEqual(G.playerZones['0']!.discard, [UNENDING_ENERGY]);
    assert.deepEqual(G.pendingReturnOnDiscard, [{ playerID: '0', cardId: UNENDING_ENERGY }]);
  });

  it('moves the card but parks NOTHING for an unmarked card (lazy-init stays undefined)', () => {
    const G = makeState([PLAIN_CARD], []);
    const found = discardFromHand(G, '0', PLAIN_CARD);
    assert.equal(found, true);
    assert.deepEqual(G.playerZones['0']!.discard, [PLAIN_CARD]);
    // why: lazy-init — an untriggered discard must leave the queue undefined so the
    // empty-replay hash oracles never see the field (no re-pin).
    assert.equal(G.pendingReturnOnDiscard, undefined);
  });

  it('returns false and mutates nothing when the card is not in hand', () => {
    const G = makeState([PLAIN_CARD], []);
    const found = discardFromHand(G, '0', UNENDING_ENERGY);
    assert.equal(found, false);
    assert.deepEqual(G.playerZones['0']!.hand, [PLAIN_CARD]);
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.equal(G.pendingReturnOnDiscard, undefined);
  });

  it('checkReturnOnDiscard alone parks without moving zones (reaction is separable)', () => {
    const G = makeState([], [UNENDING_ENERGY]);
    checkReturnOnDiscard(G, '0', UNENDING_ENERGY);
    assert.deepEqual(G.pendingReturnOnDiscard, [{ playerID: '0', cardId: UNENDING_ENERGY }]);
  });
});

// ---------------------------------------------------------------------------
// Drift-guard: no hand→discard zoneOps mutation outside the chokepoint
// ---------------------------------------------------------------------------

// why: WP-498 / D-24301 — the reactive ability only fires for discards routed
// through discardFromHand, so a NEW forced-discard site that mutates hand→discard
// itself would silently re-break the ability (the exact bug this WP fixes). This
// guard scans the engine source for the canonical hand→discard zoneOps idioms and
// asserts every occurrence lives in an allowlisted file. Allowlist:
//   - discardFromHand.ts — the chokepoint itself (the one legal home).
//   - coreMoves.impl.ts  — the normal end-of-turn CLEANUP discard, which is turn
//     structure, NOT "a card effect", so it must NOT trigger the return (WP §Out
//     of Scope) and legitimately keeps its own moveAllCards(hand, discard).
const ALLOWLISTED_BASENAMES = new Set(['discardFromHand.ts', 'coreMoves.impl.ts']);

// Matches moveCardFromZone(X.hand, Y.discard  and  moveAllCards(X.hand, Y.discard
// — the two zoneOps idioms that move a card OUT of hand INTO discard. A deck→discard
// or supply→discard move (no `.hand` first arg) does not match.
const HAND_TO_DISCARD_IDIOM = /move(?:CardFromZone|AllCards)\([^,)]*\.hand[^,)]*,[^,)]*\.discard/;

const SRC_ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Recursively lists every non-test .ts file under a directory. */
function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

describe('hand→discard chokepoint drift-guard (WP-498 / D-24301)', () => {
  it('every hand→discard zoneOps idiom lives in an allowlisted file', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC_ROOT)) {
      if (!new RegExp(HAND_TO_DISCARD_IDIOM, 'g').test(readFileSync(file, 'utf8'))) {
        continue;
      }
      if (!ALLOWLISTED_BASENAMES.has(path.basename(file))) {
        offenders.push(path.relative(SRC_ROOT, file));
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `hand→discard mutations must route through discardFromHand (the chokepoint). ` +
        `Offending files: ${offenders.join(', ')}`,
    );
  });

  it('is non-vacuous: the idiom matches a synthetic hand→discard mutation (cheat-proof)', () => {
    // why: prove the guard actually catches a violation in EACH of the four idioms
    // the five routed sites used, so a re-introduction in any shape fails the check.
    assert.match('moveCardFromZone(playerZones.hand, playerZones.discard, cardId)', HAND_TO_DISCARD_IDIOM);
    assert.match('moveAllCards(zones.hand, zones.discard)', HAND_TO_DISCARD_IDIOM);
    assert.match('moveCardFromZone(gameState.playerZones[playerId]!.hand, gameState.playerZones[playerId]!.discard, x)', HAND_TO_DISCARD_IDIOM);
    // a deck→discard move (heroChoice.resolve) must NOT match — the reaction is hand-only
    assert.doesNotMatch('moveCardFromZone(playerZones.deck, playerZones.discard, cardId)', HAND_TO_DISCARD_IDIOM);
  });
});
