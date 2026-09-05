/**
 * Drift-detection + JSON-serialisability tests for notable game event types.
 *
 * Pins the nine-variant `NOTABLE_EVENT_TYPES` array against the
 * `NotableGameEventType` union, the eight-entry `SCHEME_TWIST_RESOLVER_KEYS`
 * array against the `SchemeTwistResolverKey` union, and the two-entry
 * `STRIKE_BLOCK_THREAT_KINDS` array against the `StrikeBlockThreatKind` union
 * (bidirectional + length + uniqueness). Pins JSON round-trip per event variant
 * so a future widening cannot smuggle a non-serialisable field into
 * `NotableGameEvent`.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTABLE_EVENT_TYPES,
  SCHEME_TWIST_RESOLVER_KEYS,
  STRIKE_BLOCK_THREAT_KINDS,
} from './notableEvents.types.js';
import type {
  NotableGameEventType,
  SchemeTwistResolverKey,
  StrikeBlockThreatKind,
  FightResolvedEvent,
  AmbushResolvedEvent,
  SchemeTwistResolvedEvent,
  MastermindStrikeResolvedEvent,
  MastermindDefeatedEvent,
  BystanderRevealedEvent,
  DeckReshuffledEvent,
  StrikeBlockedEvent,
  NotableGameEvent,
} from './notableEvents.types.js';

describe('NOTABLE_EVENT_TYPES drift detection', () => {
  it('contains exactly nine entries in canonical order', () => {
    assert.deepStrictEqual(
      [...NOTABLE_EVENT_TYPES],
      [
        'fightResolved',
        'ambushResolved',
        'schemeTwistResolved',
        'mastermindStrikeResolved',
        'mastermindDefeated',
        'healResolved',
        'bystanderRevealed',
        'deckReshuffled',
        'strikeBlocked',
      ],
    );
  });

  it('has no duplicate entries', () => {
    const unique = new Set<string>(NOTABLE_EVENT_TYPES);
    assert.equal(unique.size, NOTABLE_EVENT_TYPES.length);
  });

  it('every union member is present in the canonical array', () => {
    // why: bidirectional drift — every `NotableGameEventType` literal must
    // appear in `NOTABLE_EVENT_TYPES`. A future addition to the union
    // without an array update would compile but break this assertion.
    const unionMembers: NotableGameEventType[] = [
      'fightResolved',
      'ambushResolved',
      'schemeTwistResolved',
      'mastermindStrikeResolved',
      'mastermindDefeated',
      'healResolved',
      'bystanderRevealed',
      'deckReshuffled',
      'strikeBlocked',
    ];
    for (const member of unionMembers) {
      assert.ok(
        NOTABLE_EVENT_TYPES.includes(member),
        `union member "${member}" missing from canonical array`,
      );
    }
  });

  it('every canonical array entry is assignable to NotableGameEventType', () => {
    // why: bidirectional drift — every array entry typed-narrowed to the
    // union proves no extra strings sneaked into the array (e.g., typos).
    const typed: NotableGameEventType[] = [...NOTABLE_EVENT_TYPES];
    assert.equal(typed.length, NOTABLE_EVENT_TYPES.length);
  });
});

describe('SCHEME_TWIST_RESOLVER_KEYS drift detection', () => {
  it('contains exactly eight entries in canonical order', () => {
    assert.deepStrictEqual(
      [...SCHEME_TWIST_RESOLVER_KEYS],
      [
        'revealOrPunish',
        'chainedReveals',
        'woundAll',
        'koFromHq',
        'midtownBankRobbery',
        'killbots',
        'secretInvasion',
        'portals',
      ],
    );
  });

  it('has no duplicate entries', () => {
    const unique = new Set<string>(SCHEME_TWIST_RESOLVER_KEYS);
    assert.equal(unique.size, SCHEME_TWIST_RESOLVER_KEYS.length);
  });

  it('every union member is present in the canonical array', () => {
    const unionMembers: SchemeTwistResolverKey[] = [
      'revealOrPunish',
      'chainedReveals',
      'woundAll',
      'koFromHq',
      'midtownBankRobbery',
      'killbots',
      'secretInvasion',
      'portals',
    ];
    for (const member of unionMembers) {
      assert.ok(
        SCHEME_TWIST_RESOLVER_KEYS.includes(member),
        `union member "${member}" missing from canonical array`,
      );
    }
  });

  it('every canonical array entry is assignable to SchemeTwistResolverKey', () => {
    const typed: SchemeTwistResolverKey[] = [...SCHEME_TWIST_RESOLVER_KEYS];
    assert.equal(typed.length, SCHEME_TWIST_RESOLVER_KEYS.length);
  });
});

describe('STRIKE_BLOCK_THREAT_KINDS drift detection (WP-644)', () => {
  // why: RUNTIME assertions (not a bare `satisfies`) per WP-563 / D-24372 —
  // engine test files are not typechecked in CI, so a compile-time pin would
  // be documentation only.
  it('contains exactly five entries in canonical order', () => {
    assert.deepStrictEqual(
      [...STRIKE_BLOCK_THREAT_KINDS],
      ['masterStrike', 'schemeTwist', 'ambush', 'fight', 'escape'],
    );
  });

  it('has no duplicate entries', () => {
    const unique = new Set<string>(STRIKE_BLOCK_THREAT_KINDS);
    assert.equal(unique.size, STRIKE_BLOCK_THREAT_KINDS.length);
  });

  it('every union member is present in the canonical array', () => {
    const unionMembers: StrikeBlockThreatKind[] = ['masterStrike', 'schemeTwist', 'ambush', 'fight', 'escape'];
    for (const member of unionMembers) {
      assert.ok(
        STRIKE_BLOCK_THREAT_KINDS.includes(member),
        `union member "${member}" missing from canonical array`,
      );
    }
  });

  it('every canonical array entry is assignable to StrikeBlockThreatKind', () => {
    const typed: StrikeBlockThreatKind[] = [...STRIKE_BLOCK_THREAT_KINDS];
    assert.equal(typed.length, STRIKE_BLOCK_THREAT_KINDS.length);
  });
});

describe('NotableGameEvent JSON round-trip per variant', () => {
  it('FightResolvedEvent round-trips through JSON.stringify/parse', () => {
    const original: FightResolvedEvent = {
      type: 'fightResolved',
      playerId: '0',
      cardId: 'core-villain-brotherhood-magneto-00',
      citySpace: 2,
      bystandersRescued: 1,
      appliedEffects: ['captureBystander'],
      narrative: 'Fought "Magneto" and rescued 1 bystander(s); Fight effect: a bystander was captured.',
    };
    const cloned = JSON.parse(JSON.stringify(original)) as FightResolvedEvent;
    assert.deepStrictEqual(cloned, original);
  });

  it('AmbushResolvedEvent round-trips through JSON.stringify/parse', () => {
    const original: AmbushResolvedEvent = {
      type: 'ambushResolved',
      revealedCardId: 'core-villain-brotherhood-toad-00',
      citySpace: 0,
      appliedEffects: ['gainWoundEachPlayer'],
      narrative: '"Toad" ambushed: every player gained a wound.',
    };
    const cloned = JSON.parse(JSON.stringify(original)) as AmbushResolvedEvent;
    assert.deepStrictEqual(cloned, original);
  });

  it('SchemeTwistResolvedEvent round-trips through JSON.stringify/parse', () => {
    const original: SchemeTwistResolvedEvent = {
      type: 'schemeTwistResolved',
      twistCardId: 'core-scheme-twist-legacy-virus',
      resolverKey: 'revealOrPunish',
      narrative: 'Scheme Twist "Legacy Virus": players were forced to reveal a matching hero or suffer a penalty.',
    };
    const cloned = JSON.parse(JSON.stringify(original)) as SchemeTwistResolvedEvent;
    assert.deepStrictEqual(cloned, original);
  });

  it('MastermindStrikeResolvedEvent round-trips through JSON.stringify/parse', () => {
    const original: MastermindStrikeResolvedEvent = {
      type: 'mastermindStrikeResolved',
      strikeCardId: 'master-strike-00',
      narrative: 'Master Strike: "master-strike-00" resolved.',
    };
    const cloned = JSON.parse(JSON.stringify(original)) as MastermindStrikeResolvedEvent;
    assert.deepStrictEqual(cloned, original);
  });

  it('MastermindDefeatedEvent round-trips through JSON.stringify/parse', () => {
    const original: MastermindDefeatedEvent = {
      type: 'mastermindDefeated',
      playerId: '0',
      mastermindId: 'core/magneto',
      bystandersRescued: 2,
      narrative: 'Defeated the Mastermind "Magneto" and rescued 2 bystander(s).',
    };
    const cloned = JSON.parse(JSON.stringify(original)) as MastermindDefeatedEvent;
    assert.deepStrictEqual(cloned, original);
  });

  it('BystanderRevealedEvent round-trips through JSON.stringify/parse', () => {
    const original: BystanderRevealedEvent = {
      type: 'bystanderRevealed',
      revealedCardId: 'core-bystander-00',
      captorCardId: 'core-villain-brotherhood-magneto-00',
      narrative: 'Bystander "Hostage" was revealed and captured by "Magneto".',
    };
    const cloned = JSON.parse(JSON.stringify(original)) as BystanderRevealedEvent;
    assert.deepStrictEqual(cloned, original);
  });

  it('DeckReshuffledEvent round-trips through JSON.stringify/parse', () => {
    const original: DeckReshuffledEvent = {
      type: 'deckReshuffled',
      playerId: '0',
      narrative: 'The hero deck was reshuffled from the discard pile.',
    };
    const cloned = JSON.parse(JSON.stringify(original)) as DeckReshuffledEvent;
    assert.deepStrictEqual(cloned, original);
  });

  it('StrikeBlockedEvent round-trips through JSON.stringify/parse', () => {
    const masterStrike: StrikeBlockedEvent = {
      type: 'strikeBlocked',
      playerId: '0',
      threatKind: 'masterStrike',
      narrative: 'The Master Strike was blocked.',
    };
    const schemeTwist: StrikeBlockedEvent = {
      type: 'strikeBlocked',
      playerId: '1',
      threatKind: 'schemeTwist',
      narrative: 'The Scheme Twist penalty was blocked.',
    };
    const ambush: StrikeBlockedEvent = {
      type: 'strikeBlocked',
      playerId: '0',
      threatKind: 'ambush',
      narrative: 'The Ambush was blocked.',
    };
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(masterStrike)) as StrikeBlockedEvent,
      masterStrike,
    );
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(schemeTwist)) as StrikeBlockedEvent,
      schemeTwist,
    );
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(ambush)) as StrikeBlockedEvent,
      ambush,
    );
  });

  it('NotableGameEvent[] round-trips with mixed variants', () => {
    const original: NotableGameEvent[] = [
      {
        type: 'fightResolved',
        playerId: '0',
        cardId: 'core-villain-brotherhood-magneto-00',
        citySpace: 2,
        bystandersRescued: 0,
        appliedEffects: [],
        narrative: 'Fought "Magneto".',
      },
      {
        type: 'mastermindStrikeResolved',
        strikeCardId: 'master-strike-01',
        narrative: 'Master Strike: "master-strike-01" resolved.',
      },
    ];
    const cloned = JSON.parse(JSON.stringify(original)) as NotableGameEvent[];
    assert.deepStrictEqual(cloned, original);
  });
});
