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
          { text: 'Player 0 played antm/captain-america/perfect-teamwork#0.', outcome: 'neutral' },
          { text: "Player 0 recruited a card.", outcome: 'neutral' },
          { text: 'Player 0 played antm/black-knight/the-ebony-blade#1.', outcome: 'neutral' },
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

  test('WP-328: extracts the ext_id from a prefixed, enriched "played" line', () => {
    // why: WP-323/324 render the label "{Name} ({ext-id}) — {effect}" and WP-328 prefixes
    // the line "{turn}.{step}.{action} " — the parser must strip the prefix and pull the
    // real ext-id from the parens, not capture the whole label (the diagnostics regression).
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          { text: '10.2.1 Player 0 played Interstellar Adventures (wtif/star-lord-tchalla/interstellar-adventures#2) — What If...?: You get +3 recruit.', outcome: 'neutral' },
          { text: '10.2.2 Player 0 played S.H.I.E.L.D. Agent (starting-shield-agent).', outcome: 'neutral' },
          { text: 'Player 0 played antm/black-knight/the-ebony-blade#0.', outcome: 'neutral' },
        ],
      }),
    );
    assert.deepEqual(
      provenance.recentlyPlayedCards.map((card) => card.extId),
      [
        'wtif/star-lord-tchalla/interstellar-adventures#2',
        'starting-shield-agent',
        // why: a legacy raw-id line (no parens) still classifies via the fallback.
        'antm/black-knight/the-ebony-blade#0',
      ],
    );
  });

  test('WP-417 regression: pulls the ext-id, not the "(+N recruit)" economy clause', () => {
    // why: WP-417 (D-24237) appends a printed-icon clause "(+1 recruit)" and a second
    // "(+2 attack)" plus an effect clause to the played label. The prior end-anchored regex
    // captured the LAST parenthesized group, so it reported extId "+1 recruit" / "+1 attack"
    // (observed live in a freeze diagnostic). The ext-id-shaped match must skip the economy
    // clause and any effect-text parens and return the real ext-id.
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          { text: '1.2.1 Player 1 played S.H.I.E.L.D. Agent (starting-shield-agent) (+1 recruit).', outcome: 'neutral' },
          { text: '11.2.3 Player 1 played Quick Draw (core/hawkeye/quick-draw#2) (+1 attack) — Draw a card.', outcome: 'neutral' },
          { text: '5.2.1 Player 1 played Growing Anger (core/hulk/growing-anger#0) (+2 attack) — Strength: You get +1 attack.', outcome: 'neutral' },
        ],
      }),
    );
    assert.deepEqual(
      provenance.recentlyPlayedCards.map((card) => card.extId),
      [
        'starting-shield-agent',
        'core/hawkeye/quick-draw#2',
        'core/hulk/growing-anger#0',
      ],
    );
  });

  test('caps the list at RECENTLY_PLAYED_CARDS_CAP, keeping the last N', () => {
    const log: Array<{ text: string; outcome: 'neutral' }> = [];
    for (let index = 0; index < RECENTLY_PLAYED_CARDS_CAP + 2; index += 1) {
      log.push({ text: `Player 0 played set/hero/card#${index}.`, outcome: 'neutral' });
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
      snapshotWith({ log: [{ text: 'Player 0 played set/hero/basic#0.', outcome: 'neutral' }] }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'resolved');
  });

  test('outcome is hollow when the ext_id has a hollowEffects record (hollow-first: its own blocked line does not flip it)', () => {
    // why: WP-B.3c / RS-3 — a hollow effect ALSO logs a `blocked` "Unhandled effect
    // observed" line naming the card; the structured hollowEffects read must win, so
    // this case seeds that real line and still expects `hollow` (guards the PS-1 order).
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          { text: 'Player 0 played Hollow Card (set/hero/hollow#0).', outcome: 'neutral' },
          {
            text: 'Unhandled effect observed: card "set/hero/hollow#0" declared a "phase" mechanic at onPlay, but no executable handler was reached (no-handler).',
            outcome: 'blocked',
          },
        ],
        hollowEffects: [{ cardId: 'set/hero/hollow#0', mechanic: 'phase' }],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'hollow');
  });

  test('outcome is conditionNotMet from an authoritative blocked line naming the card', () => {
    // why: WP-B.3c — the engine authors the condition-fail line as `blocked` in the
    // real card-ref form `{Name} ({ext-id})`; the classifier reads `.outcome === 'blocked'`
    // + the `(ext-id)` ref (NOT a "did not activate" string).
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          { text: 'Player 0 played Gambit Card (antm/gambit/card#0).', outcome: 'neutral', card: 'antm/gambit/card#0' },
          { text: "Player 0's Gambit Card (antm/gambit/card#0) ability did not activate — no X-Men in play.", outcome: 'blocked', card: 'antm/gambit/card#0' },
        ],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'conditionNotMet');
  });

  test('outcome is awaitingChoice for the most-recent play when a choice is pending', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [{ text: 'Player 0 played antm/black-knight/the-ebony-blade#0.', outcome: 'neutral' }],
        pendingVictoryPileCardPick: { playerID: '0' },
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'awaitingChoice');
  });

  test('a pending choice does NOT retro-tag an earlier (non-most-recent) play', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          { text: 'Player 0 played set/hero/earlier#0.', outcome: 'neutral' },
          { text: 'Player 0 played antm/black-knight/the-ebony-blade#0.', outcome: 'neutral' },
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
          { text: 'Player 0 played Gambit Card (antm/gambit/card#0).', outcome: 'neutral', card: 'antm/gambit/card#0' },
          { text: "Player 0's Gambit Card (antm/gambit/card#0) ability did not activate — no X-Men in play.", outcome: 'blocked', card: 'antm/gambit/card#0' },
        ],
        pendingOptionalKoReward: { playerID: '0' },
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'conditionNotMet');
  });

  test('outcome is resolved when a following line confirms the effect applied (positive, not absence-of-string)', () => {
    // why: WP-B.3c — `resolved` now follows an authoritative `applied` line, not merely
    // the absence of a "did not activate" string.
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          { text: 'Player 0 played Quick Draw (core/hawkeye/quick-draw#2).', outcome: 'neutral' },
          { text: 'Player 0 drew 1 card(s) from Quick Draw (core/hawkeye/quick-draw#2).', outcome: 'applied' },
        ],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'resolved');
  });

  test('RS-2: a reveal "no branch matched" line (blocked, names the REVEALED card) does not flip the played card to conditionNotMet', () => {
    // why: WP-B.3c / RS-2 — the reveal line is `blocked` but names the deck-top card by a
    // DIFFERENT ext-id; the `(ext-id)` ref match on the PLAYED card must not match it.
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          { text: 'Player 0 played What If Card (wtif/star-lord/what-if#3).', outcome: 'neutral' },
          { text: 'Player 0 revealed S.H.I.E.L.D. Agent (starting-shield-agent) (cost 0) — no branch matched (left on top).', outcome: 'blocked' },
        ],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'resolved');
  });

  test('RS-2: a later card\'s blocked line is not attributed to an earlier card (play-window bound)', () => {
    // why: WP-B.3c / RS-2 — the earlier card's window ends at the next "played" line, so
    // the second card's blocked condition-fail line cannot leak back onto the first.
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          { text: 'Player 0 played Early Card (set/hero/early#0).', outcome: 'neutral', card: 'set/hero/early#0' },
          { text: 'Player 0 played Late Card (set/hero/late#1).', outcome: 'neutral', card: 'set/hero/late#1' },
          { text: "Player 0's Late Card (set/hero/late#1) ability did not activate — no synergy.", outcome: 'blocked', card: 'set/hero/late#1' },
        ],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.extId, 'set/hero/early#0');
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'resolved');
    assert.equal(provenance.recentlyPlayedCards[1]!.extId, 'set/hero/late#1');
    assert.equal(provenance.recentlyPlayedCards[1]!.outcome, 'conditionNotMet');
  });

  test('WP-438: identification comes from the structured card, not the label prose', () => {
    // why: the played line's LABEL carries an economy clause that the old
    // PLAYED_LABEL_EXTID could mis-grab; `card` is the authoritative id and is used.
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          {
            text: 'Player 1 played Quick Draw (core/hawkeye/quick-draw#2) (+1 attack) — Draw a card.',
            outcome: 'neutral',
            card: 'core/hawkeye/quick-draw#2',
          },
        ],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.extId, 'core/hawkeye/quick-draw#2');
  });

  test('WP-438: a reveal "no branch matched" line (card = the REVEALED card) is not attributed to the played card', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          { text: 'Player 0 played What If Card (wtif/star-lord/what-if#3).', outcome: 'neutral', card: 'wtif/star-lord/what-if#3' },
          { text: 'Player 0 revealed S.H.I.E.L.D. Agent (starting-shield-agent) (cost 0) — no branch matched (left on top).', outcome: 'blocked', card: 'starting-shield-agent' },
        ],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'resolved');
  });

  test('WP-438 (AC-2): a card-less LEGACY snapshot still identifies via the label; condition-fail downgrades to resolved', () => {
    // why: a pre-WP-438 saved diagnostic blob has no `card`. Identification falls back
    // to the label; the condition-fail association (which needs `card`) does not match,
    // so it downgrades to `resolved` — the accepted, documented legacy behavior.
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [
          { text: 'Player 0 played Gambit Card (antm/gambit/card#0).', outcome: 'neutral' },
          { text: "Player 0's Gambit Card (antm/gambit/card#0) ability did not activate — no X-Men in play.", outcome: 'blocked' },
        ],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.extId, 'antm/gambit/card#0'); // label fallback
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'resolved'); // association downgrades without card
  });
});

describe('buildEffectProvenance — abilityText (injected resolver)', () => {
  test('is null when the snapshot carries no display text for the card', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({ log: [{ text: 'Player 0 played set/hero/card#0.', outcome: 'neutral' }] }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.abilityText, null);
  });

  test('uses an injected resolver when supplied', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({ log: [{ text: 'Player 0 played set/hero/card#0.', outcome: 'neutral' }] }),
      (extId) => `TEXT:${extId}`,
    );
    assert.equal(
      provenance.recentlyPlayedCards[0]!.abilityText,
      'TEXT:set/hero/card#0',
    );
  });

  test('fail-soft: a throwing resolver degrades to null, never throws', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({ log: [{ text: 'Player 0 played set/hero/card#0.', outcome: 'neutral' }] }),
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
        log: [{ text: 'Player 0 played antm/black-knight/the-ebony-blade#0.', outcome: 'neutral' }],
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
        log: [{ text: 'Player 0 played set/hero/card#0.', outcome: 'neutral' }],
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
          { text: 'Player 0 played set/hero/mine#0.', outcome: 'neutral' },
          { text: 'Player 1 played set/hero/theirs#0.', outcome: 'neutral' },
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
        log: [{ text: 'Player 0 played set/hero/card#0.', outcome: 'neutral' }],
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
      snapshotWith({ log: [42, null, { text: 'Player 0 played set/hero/card#0.', outcome: 'neutral' }, {}] }),
    );
    assert.equal(provenance.recentlyPlayedCards.length, 1);
    assert.equal(provenance.recentlyPlayedCards[0]!.extId, 'set/hero/card#0');
  });

  test('a malformed hollowEffects entry is ignored', () => {
    const provenance = buildEffectProvenance(
      snapshotWith({
        log: [{ text: 'Player 0 played set/hero/card#0.', outcome: 'neutral' }],
        hollowEffects: [null, { notCardId: 'x' }, 7],
      }),
    );
    assert.equal(provenance.recentlyPlayedCards[0]!.outcome, 'resolved');
  });
});
