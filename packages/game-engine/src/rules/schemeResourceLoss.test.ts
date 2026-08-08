/**
 * Tests for scheme escaped-pile resource-loss evaluation (WP-508 / D-24315).
 *
 * Verifies countEscapedPileByType (including supply-bystander classification)
 * and applyEscapedPileResourceLoss (threshold latch, no-op without a
 * resourceLossCondition, idempotency), plus an in-file evaluateEndgame
 * composition assertion (AC-6): SCHEME_LOSS set at threshold maps to
 * scheme-wins; below threshold the game continues.
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countEscapedPileByType,
  applyEscapedPileResourceLoss,
  applyPileDepletionResourceLoss,
} from './schemeResourceLoss.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState } from '../types.js';
import type { RevealedCardType } from '../villainDeck/villainDeck.types.js';

const MIDTOWN = 'core/midtown-bank-robbery';

/**
 * Builds a minimal state carrying only the fields the resource-loss functions
 * and evaluateEndgame read. Cast because node:test runs under tsx (no
 * typecheck) — the functions never touch other LegendaryGameState fields.
 */
function makeState(
  schemeId: string,
  escapedPile: string[],
  villainDeckCardTypes: Record<string, RevealedCardType>,
  counters: Record<string, number> = {},
): LegendaryGameState {
  return {
    selection: {
      schemeId,
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    escapedPile,
    villainDeckCardTypes,
    counters,
    messages: [],
  } as unknown as LegendaryGameState;
}

describe('countEscapedPileByType', () => {
  it('counts only entries whose type matches, ignoring other card types', () => {
    const state = makeState(MIDTOWN, [
      'bystander-villain-deck-00',
      'core-villain-brotherhood-blob-00',
      'bystander-villain-deck-01',
      'henchman-doombot-legion-00',
    ], {
      'bystander-villain-deck-00': 'bystander',
      'core-villain-brotherhood-blob-00': 'villain',
      'bystander-villain-deck-01': 'bystander',
      'henchman-doombot-legion-00': 'henchman',
    });

    assert.equal(countEscapedPileByType(state, 'bystander'), 2);
    assert.equal(countEscapedPileByType(state, 'villain'), 1);
    assert.equal(countEscapedPileByType(state, 'henchman'), 1);
  });

  it('classifies supply bystanders (BYSTANDER_EXT_ID) as bystander despite no villainDeckCardTypes entry', () => {
    // why: Midtown's twist captures from the shared supply (pile-bystander),
    // which is NOT a villain-deck card — it must still count as a bystander,
    // else Midtown undercounts the bystanders carried away.
    const state = makeState(MIDTOWN, [
      BYSTANDER_EXT_ID,
      BYSTANDER_EXT_ID,
      'bystander-villain-deck-00',
    ], {
      'bystander-villain-deck-00': 'bystander',
      // NOTE: BYSTANDER_EXT_ID deliberately absent from the map.
    });

    assert.equal(countEscapedPileByType(state, 'bystander'), 3);
  });

  it('returns 0 for an empty escaped pile', () => {
    const state = makeState(MIDTOWN, [], {});
    assert.equal(countEscapedPileByType(state, 'bystander'), 0);
  });
});

describe('applyEscapedPileResourceLoss', () => {
  /** An escaped pile holding `count` supply bystanders. */
  function bystanderPile(count: number): string[] {
    const pile: string[] = [];
    for (let i = 0; i < count; i++) pile.push(BYSTANDER_EXT_ID);
    return pile;
  }

  it('sets SCHEME_LOSS when Midtown reaches 8 bystanders in the escaped pile', () => {
    const state = makeState(MIDTOWN, bystanderPile(8), {});
    applyEscapedPileResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
  });

  it('does NOT set SCHEME_LOSS at 7 bystanders (below threshold)', () => {
    const state = makeState(MIDTOWN, bystanderPile(7), {});
    applyEscapedPileResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], undefined);
  });

  it('is a no-op for a scheme with no resourceLossCondition', () => {
    // Cosmic Cube is a true twist-loss scheme — no resourceLossCondition.
    const state = makeState(
      'core/unleash-the-power-of-the-cosmic-cube',
      bystanderPile(20),
      {},
    );
    applyEscapedPileResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], undefined);
    assert.equal(state.messages.length, 0, 'no log line for an unconfigured resource loss');
  });

  it('is idempotent once the loss is latched (does not re-log or re-set)', () => {
    const state = makeState(MIDTOWN, bystanderPile(9), {}, {
      [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1,
    });
    applyEscapedPileResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
    assert.equal(state.messages.length, 0, 'no duplicate loss log once latched');
  });
});

describe('AC-6 — evaluateEndgame composition', () => {
  it('scheme-wins at 8 escaped bystanders (via the resource-loss latch)', () => {
    const state = makeState(
      MIDTOWN,
      Array.from({ length: 8 }, () => BYSTANDER_EXT_ID),
      {},
    );
    applyEscapedPileResourceLoss(state);
    const result = evaluateEndgame(state);
    assert.ok(result, 'endgame must have resolved');
    assert.equal(result!.outcome, 'scheme-wins');
  });

  it('continues (null) at 7 escaped bystanders with no other ending condition', () => {
    const state = makeState(
      MIDTOWN,
      Array.from({ length: 7 }, () => BYSTANDER_EXT_ID),
      {},
    );
    applyEscapedPileResourceLoss(state);
    assert.equal(evaluateEndgame(state), null);
  });
});

describe('escaped-pile-count villain — Negative Zone (WP-509 / D-24316)', () => {
  const NEG_ZONE = 'core/negative-zone-prison-breakout';

  /** An escaped pile with `villains` villain cards plus optional non-villains. */
  function negZoneState(
    villains: number,
    others: { henchmen?: number; bystanders?: number } = {},
    counters: Record<string, number> = {},
  ): LegendaryGameState {
    const escapedPile: string[] = [];
    const types: Record<string, RevealedCardType> = {};
    for (let i = 0; i < villains; i++) {
      const id = `core-villain-negzone-${i}`;
      escapedPile.push(id);
      types[id] = 'villain';
    }
    for (let i = 0; i < (others.henchmen ?? 0); i++) {
      const id = `henchman-doombot-legion-${i}`;
      escapedPile.push(id);
      types[id] = 'henchman';
    }
    for (let i = 0; i < (others.bystanders ?? 0); i++) {
      escapedPile.push(BYSTANDER_EXT_ID); // supply bystander (no type entry)
    }
    return makeState(NEG_ZONE, escapedPile, types, counters);
  }

  it('counts villains only — henchmen and bystanders in the pile are excluded', () => {
    const state = negZoneState(3, { henchmen: 4, bystanders: 5 });
    assert.equal(countEscapedPileByType(state, 'villain'), 3);
  });

  it('sets SCHEME_LOSS when 12 villains have escaped', () => {
    const state = negZoneState(12);
    applyEscapedPileResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
  });

  it('does NOT set SCHEME_LOSS at 11 villains (below threshold)', () => {
    const state = negZoneState(11);
    applyEscapedPileResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], undefined);
  });

  it('11 villains + 6 henchmen does NOT lose — henchmen never count toward the 12 (villains-only, D-24316)', () => {
    // why: the faithfulness guard. 17 escaped adversaries (over the retired
    // ESCAPE_LIMIT 8) but only 11 villains — Negative Zone loses on villains
    // only per Universal Rules v23 §Escaped Villains.
    const state = negZoneState(11, { henchmen: 6 });
    applyEscapedPileResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], undefined);
  });
});

describe('applyPileDepletionResourceLoss — Super Hero Civil War (WP-510 / D-24318)', () => {
  const CIVIL_WAR = 'core/super-hero-civil-war';

  /** A minimal state whose hero deck holds `heroDeckLength` cards. */
  function civilWarState(
    heroDeckLength: number,
    counters: Record<string, number> = {},
  ): LegendaryGameState {
    const heroDeck: string[] = [];
    for (let i = 0; i < heroDeckLength; i++) {
      heroDeck.push(`core-hero-card-${i}`);
    }
    return {
      selection: {
        schemeId: CIVIL_WAR,
        mastermindId: 'test-mastermind',
        villainGroupIds: [],
        henchmanGroupIds: [],
        heroDeckIds: [],
      },
      heroDeck,
      counters,
      messages: [],
    } as unknown as LegendaryGameState;
  }

  it('sets SCHEME_LOSS when the hero deck is empty (pile-depleted / heroDeck)', () => {
    const state = civilWarState(0);
    applyPileDepletionResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
  });

  it('does NOT set SCHEME_LOSS while the hero deck holds ≥ 1 card', () => {
    const state = civilWarState(1);
    applyPileDepletionResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], undefined);
  });

  it('is idempotent once the loss is latched (does not re-log)', () => {
    const state = civilWarState(0, { [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1 });
    applyPileDepletionResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
    assert.equal(state.messages.length, 0, 'no duplicate loss log once latched');
  });

  it('is a no-op for an escaped-pile-count scheme (kind guard — does not read heroDeck)', () => {
    // why: Midtown declares an 'escaped-pile-count' condition, NOT 'pile-depleted';
    // applyPileDepletionResourceLoss must ignore it even with an empty hero deck.
    const state = civilWarState(0);
    (state.selection as { schemeId: string }).schemeId = MIDTOWN;
    applyPileDepletionResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], undefined);
  });

  it('is a no-op for a scheme with no resourceLossCondition', () => {
    // Cosmic Cube is a true twist-loss scheme — no resourceLossCondition.
    const state = civilWarState(0);
    (state.selection as { schemeId: string }).schemeId =
      'core/unleash-the-power-of-the-cosmic-cube';
    applyPileDepletionResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], undefined);
  });

  it('AC-3 composition — evaluateEndgame returns scheme-wins once the loss latches', () => {
    const state = civilWarState(0);
    applyPileDepletionResourceLoss(state);
    const result = evaluateEndgame(state);
    assert.ok(result, 'endgame must have resolved');
    assert.equal(result!.outcome, 'scheme-wins');
  });
});

describe('applyPileDepletionResourceLoss — Legacy Virus wounds (WP-511 / D-24320)', () => {
  const LEGACY_VIRUS = 'core/legacy-virus-the';

  /** A minimal state whose Wound stack holds `woundsRemaining` cards. */
  function legacyVirusState(
    woundsRemaining: number,
    counters: Record<string, number> = {},
  ): LegendaryGameState {
    const wounds: string[] = [];
    for (let i = 0; i < woundsRemaining; i++) {
      wounds.push('pile-wound');
    }
    return {
      selection: {
        schemeId: LEGACY_VIRUS,
        mastermindId: 'test-mastermind',
        villainGroupIds: [],
        henchmanGroupIds: [],
        heroDeckIds: [],
      },
      piles: { wounds },
      counters,
      messages: [],
    } as unknown as LegendaryGameState;
  }

  it('sets SCHEME_LOSS when the Wound stack is empty (pile-depleted / wounds)', () => {
    const state = legacyVirusState(0);
    applyPileDepletionResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
  });

  it('does NOT set SCHEME_LOSS while the Wound stack holds ≥ 1 card', () => {
    const state = legacyVirusState(1);
    applyPileDepletionResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], undefined);
  });

  it('is idempotent once the loss is latched (does not re-log)', () => {
    const state = legacyVirusState(0, { [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1 });
    applyPileDepletionResourceLoss(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
    assert.equal(state.messages.length, 0, 'no duplicate loss log once latched');
  });

  it('AC-7 composition — evaluateEndgame returns scheme-wins once the wound-depletion loss latches', () => {
    const state = legacyVirusState(0);
    applyPileDepletionResourceLoss(state);
    const result = evaluateEndgame(state);
    assert.ok(result, 'endgame must have resolved');
    assert.equal(result!.outcome, 'scheme-wins');
  });
});
