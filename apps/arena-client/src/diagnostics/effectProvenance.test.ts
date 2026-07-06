import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEffectProvenance,
  RECENTLY_PLAYED_CARDS_CAP,
  type EffectProvenance,
} from './effectProvenance';

/**
 * Builds a minimal snapshot-like object for the pure builder. Only the fields the
 * builder reads are populated; everything else the exported snapshot carries is
 * irrelevant here (the builder reads structurally).
 */
function snapshotWith(fields: Record<string, unknown>): unknown {
  return fields;
}

describe('buildEffectProvenance — awaitingPlayerInput', () => {
  test('reports the victory-pile pending pick with its chooser', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({ pendingVictoryPileCardPick: { playerID: '0' } }),
    );
    assert.deepEqual(provenance.awaitingPlayerInput, {
      kind: 'victoryPileCardPick',
      playerID: '0',
    });
  });

  test('maps each pending field to its awaiting-input kind', () => {
    const cases: Array<[string, string]> = [
      ['pendingVictoryPileCardPick', 'victoryPileCardPick'],
      ['pendingOptionalKoReward', 'optionalKoReward'],
      ['pendingDrawOrEmpowered', 'drawOrEmpowered'],
      ['pendingKoHeroChoice', 'koHeroChoice'],
    ];
    for (const [field, expectedKind] of cases) {
      const provenance = buildEffectProvenance(
        snapshotWith({ [field]: { playerID: '1' } }),
      );
      assert.equal(provenance.awaitingPlayerInput?.kind, expectedKind);
      assert.equal(provenance.awaitingPlayerInput?.playerID, '1');
    }
  });

  test('is null when nothing is pending', () => {
    const provenance = buildEffectProvenance(snapshotWith({ log: [] }));
    assert.equal(provenance.awaitingPlayerInput, null);
  });

  test('degrades playerID to null when the pending field carries none', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({ pendingOptionalKoReward: {} }),
    );
    assert.deepEqual(provenance.awaitingPlayerInput, {
      kind: 'optionalKoReward',
      playerID: null,
    });
  });
});

describe('buildEffectProvenance — recentlyPlayedCards', () => {
  test('parses ext_ids from "played …" log lines in order', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          'Player 0 played antm/captain-america/perfect-teamwork#0.',
          "Player 0 recruited a card.",
          'Player 0 played antm/black-knight/the-ebony-blade#1.',
        ],
      }),
    );
    assert.deepEqual(
      provenance.recentlyPlayedCards.map((card) => card.extId),
      [
        'antm/captain-america/perfect-teamwork#0',
        'antm/black-knight/the-ebony-blade#1',
      ],
    );
  });

  test('caps the list at RECENTLY_PLAYED_CARDS_CAP, keeping the last N', () => {
    const log: string[] = [];
    for (let index = 0; index < RECENTLY_PLAYED_CARDS_CAP + 2; index += 1) {
      log.push(`Player 0 played set/hero/card#${index}.`);
    }
    const provenance = buildEffectProvenance(snapshotWith({ log }));
    assert.equal(provenance.recentlyPlayedCards.length, RECENTLY_PLAYED_CARDS_CAP);
    // why: the FIRST two plays (#0, #1) are dropped; the last N are retained.
    assert.equal(provenance.recentlyPlayedCards[0]!.extId, 'set/hero/card#2');
    assert.equal(
      provenance.recentlyPlayedCards.at(-1)!.extId,
      `set/hero/card#${RECENTLY_PLAYED_CARDS_CAP + 1}`,
    );
  });

  test('outcome defaults to resolved with no negative signal', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({ log: ['Player 0 played set/hero/basic#0.'] }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'resolved');
  });

  test('outcome is hollow when the ext_id has a hollowEffects record', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: ['Player 0 played set/hero/hollow#0.'],
        hollowEffects: [{ cardId: 'set/hero/hollow#0', mechanic: 'phase' }],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'hollow');
  });

  test('outcome is conditionNotMet when a "did not activate" line follows', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          'Player 0 played antm/gambit/card#0.',
          "Player 0's antm/gambit/card#0 ability did not activate — no X-Men in play.",
        ],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'conditionNotMet');
  });

  test('outcome is awaitingChoice for the most-recent play when a choice is pending', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: ['Player 0 played antm/black-knight/the-ebony-blade#0.'],
        pendingVictoryPileCardPick: { playerID: '0' },
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'awaitingChoice');
  });

  test('a pending choice does NOT retro-tag an earlier (non-most-recent) play', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          'Player 0 played set/hero/earlier#0.',
          'Player 0 played antm/black-knight/the-ebony-blade#0.',
        ],
        pendingVictoryPileCardPick: { playerID: '0' },
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'resolved');
    assert.equal(provenance.recentlyPlayedCards[1]!.outcome, 'awaitingChoice');
  });

  test('conditionNotMet wins over a pending choice for the most-recent play', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          'Player 0 played antm/gambit/card#0.',
          "Player 0's antm/gambit/card#0 ability did not activate — no X-Men in play.",
        ],
        pendingOptionalKoReward: { playerID: '0' },
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'conditionNotMet');
  });
});

describe('buildEffectProvenance — abilityText (injected resolver)', () => {
  test('is null when the snapshot carries no display text for the card', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({ log: ['Player 0 played set/hero/card#0.'] }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.abilityText, null);
  });

  test('uses an injected resolver when supplied', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({ log: ['Player 0 played set/hero/card#0.'] }),
      (extId) => `TEXT:${extId}`,
    );
    assert.equal(
      provenance.recentlyPlayedCards[0]!.abilityText,
      'TEXT:set/hero/card#0',
    );
  });

  test('fail-soft: a throwing resolver degrades to null, never throws', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({ log: ['Player 0 played set/hero/card#0.'] }),
      () => {
        throw new Error('registry unavailable');
      },
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.abilityText, null);
  });
});

describe('buildEffectProvenance — abilityText from the snapshot display (WP-315)', () => {
  test('reads the printed text from a projected display entry for the played card', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: ['Player 0 played antm/black-knight/the-ebony-blade#0.'],
        // the engine projects abilityText onto the played card's inPlay display entry
        players: {
          '0': {
            inPlayDisplay: [
              {
                extId: 'antm/black-knight/the-ebony-blade#0',
                name: 'The Ebony Blade',
                abilityText: '[keyword:Empowered] by the color of your choice.',
              },
            ],
          },
        },
      }),
    );
    assert.equal(
      provenance.recentlyPlayedCards[0]!.abilityText,
      '[keyword:Empowered] by the color of your choice.',
    );
  });

  test('finds display entries nested inside { extId, display } shapes', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: ['Player 0 played set/hero/card#0.'],
        victoryCards: [
          {
            extId: 'set/hero/card#0',
            display: { extId: 'set/hero/card#0', abilityText: 'Draw a card.' },
          },
        ],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.abilityText, 'Draw a card.');
  });

  test('a card with no display entry in the snapshot stays null (e.g. an opponent play)', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          'Player 0 played set/hero/mine#0.',
          'Player 1 played set/hero/theirs#0.',
        ],
        players: {
          '0': {
            inPlayDisplay: [
              { extId: 'set/hero/mine#0', abilityText: 'My text.' },
            ],
          },
        },
      }),
    );
    const mine = provenance.recentlyPlayedCards.find(
      (card) => card.extId === 'set/hero/mine#0',
    );
    const theirs = provenance.recentlyPlayedCards.find(
      (card) => card.extId === 'set/hero/theirs#0',
    );
    assert.equal(mine!.abilityText, 'My text.');
    assert.equal(theirs!.abilityText, null);
  });

  test('an explicit resolver override wins over the snapshot display', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: ['Player 0 played set/hero/card#0.'],
        players: {
          '0': {
            inPlayDisplay: [
              { extId: 'set/hero/card#0', abilityText: 'From snapshot.' },
            ],
          },
        },
      }),
      () => 'From override.',
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.abilityText, 'From override.');
  });
});

describe('buildEffectProvenance — fail-soft on malformed input', () => {
  test('null snapshot yields empty provenance', () => {
    const provenance: EffectProvenance = buildEffectProvenance(null);
    assert.deepEqual(provenance, {
      awaitingPlayerInput: null,
      recentlyPlayedCards: [],
    });
  });

  test('non-object snapshot yields empty provenance', () => {
    assert.deepEqual(buildEffectProvenance('frozen'), {
      awaitingPlayerInput: null,
      recentlyPlayedCards: [],
    });
  });

  test('a non-array log yields no recently-played cards', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({ log: 'not-an-array' }),
    );
    assert.deepEqual(provenance.recentlyPlayedCards, []);
  });

  test('non-string log entries are skipped without throwing', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({ log: [42, null, 'Player 0 played set/hero/card#0.', {}] }),
    );
    assert.equal(provenance.recentlyPlayedCards.length, 1);
    assert.equal(provenance.recentlyPlayedCards[0]!.extId, 'set/hero/card#0');
  });

  test('a malformed hollowEffects entry is ignored', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: ['Player 0 played set/hero/card#0.'],
        hollowEffects: [null, { notCardId: 'x' }, 7],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'resolved');
  });
});
