/**
 * Drift-detection tests for the WP-067 UIState additions.
 *
 * These tests pin the field names of `UIProgressCounters` and `UIParBreakdown`
 * via `satisfies` against literal fixtures. A future renamer of any of the six
 * field names (`bystandersRescued`, `escapedVillains`, `rawScore`, `parScore`,
 * `finalScore`, `scoringConfigVersion`) fails typecheck here before any
 * runtime test could catch it. WP-062's HUD aria-labels bind to these
 * names verbatim — the contract is non-negotiable.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  UIProgressCounters,
  UIParBreakdown,
  UICardDisplay,
  UIHQCard,
  UICityCard,
  UIHQState,
  UIPlayerState,
  UIMastermindState,
} from './uiState.types.js';

describe('UIState type drift (WP-067)', () => {
  it('UIProgressCounters field names match the locked WP-048/WP-062 contract', () => {
    // why: literal fixture spelled exactly as the contract requires. Any
    // rename of `bystandersRescued` or `escapedVillains` fails this
    // `satisfies` check at compile time.
    const fixture = {
      bystandersRescued: 4,
      escapedVillains: 1,
    } satisfies UIProgressCounters;

    // Runtime keyset assertion mirrors the type-level pin so a future
    // contributor cannot silently widen the interface and skip the gate.
    assert.deepStrictEqual(Object.keys(fixture).sort(), [
      'bystandersRescued',
      'escapedVillains',
    ]);
  });

  it('UIParBreakdown field names mirror WP-048 ScoreBreakdown verbatim', () => {
    // why: literal fixture spelled exactly as the contract requires. Any
    // rename of `rawScore`, `parScore`, `finalScore`, or
    // `scoringConfigVersion` fails this `satisfies` check at compile time.
    const fixture = {
      rawScore: 100,
      parScore: 80,
      finalScore: 20,
      scoringConfigVersion: 1,
    } satisfies UIParBreakdown;

    assert.deepStrictEqual(Object.keys(fixture).sort(), [
      'finalScore',
      'parScore',
      'rawScore',
      'scoringConfigVersion',
    ]);
  });
});

describe('UIState type drift (WP-111 / EC-118)', () => {
  it('UICardDisplay has exactly the four locked fields', () => {
    // why: WP-111 §Locked Values — UICardDisplay shape is `extId`,
    // `name`, `imageUrl`, `cost: number | null`. Adding any field
    // (e.g., `team`, `cardType`, `keywords`) is scope creep — separate
    // WP required. The `satisfies` check fails at compile time on
    // unexpected fields; the runtime keyset assertion catches widening
    // that escapes type narrowing.
    const fixture = {
      extId: 'core-hero-black-widow-1',
      name: 'Mission Accomplished',
      imageUrl: 'https://images.barefootbetters.com/core/core-hero-black-widow-1.webp',
      cost: 2,
    } satisfies UICardDisplay;

    assert.deepStrictEqual(Object.keys(fixture).sort(), [
      'cost',
      'extId',
      'imageUrl',
      'name',
    ]);
  });

  it('UICardDisplay.cost accepts null (registry "no cost shown")', () => {
    // why: PS-4 lock — null preserves the UX distinction from `0` ("free").
    const fixture: UICardDisplay = {
      extId: 'core-bystander-noop',
      name: 'No-Cost Card',
      imageUrl: '',
      cost: null,
    };
    assert.equal(fixture.cost, null);
  });

  it('UIHQCard has exactly the two locked fields', () => {
    // why: WP-111 §Locked Values — UIHQCard shape is `extId` (canonical
    // join key, repeated for UI convenience and drift-detection sanity)
    // plus `display: UICardDisplay`.
    const fixture = {
      extId: 'core-hero-black-widow-1',
      display: {
        extId: 'core-hero-black-widow-1',
        name: 'Mission Accomplished',
        imageUrl: 'https://images.barefootbetters.com/core/core-hero-black-widow-1.webp',
        cost: 2,
      },
    } satisfies UIHQCard;

    assert.deepStrictEqual(Object.keys(fixture).sort(), ['display', 'extId']);
  });

  it('UICityCard retains existing fields AND has additive display', () => {
    // why: WP-111 — additive extension of UICityCard; existing extId /
    // type / keywords preserved verbatim.
    const fixture = {
      extId: 'core-villain-brotherhood-magneto',
      type: 'villain',
      keywords: ['ambush'],
      display: {
        extId: 'core-villain-brotherhood-magneto',
        name: 'Magneto',
        imageUrl: '',
        cost: 5,
      },
    } satisfies UICityCard;

    assert.deepStrictEqual(Object.keys(fixture).sort(), [
      'display',
      'extId',
      'keywords',
      'type',
    ]);
  });

  it('UIHQState retains slots: (string | null)[] AND has optional slotDisplay', () => {
    // why: pre-flight 2026-04-29 PS-6 fallback — `slots` shape preserved
    // verbatim (Q3 audit blocked the breaking-change form). `slotDisplay`
    // is an optional parallel array.
    const withDisplay = {
      slots: ['core-hero-black-widow-1', null] as (string | null)[],
      slotDisplay: [
        {
          extId: 'core-hero-black-widow-1',
          display: {
            extId: 'core-hero-black-widow-1',
            name: 'Mission Accomplished',
            imageUrl: '',
            cost: 2,
          },
        },
        null,
      ] as (UIHQCard | null)[],
    } satisfies UIHQState;

    // slotDisplay is optional — the without-display form must also satisfy.
    const withoutDisplay = {
      slots: ['core-hero-black-widow-1', null] as (string | null)[],
    } satisfies UIHQState;

    assert.equal(withDisplay.slots.length, withDisplay.slotDisplay.length);
    assert.equal(withoutDisplay.slots.length, 2);
  });

  it('UIPlayerState retains handCards? AND has optional handDisplay', () => {
    // why: WP-111 — additive parallel-array; handCards: string[] (already
    // optional) preserved verbatim, handDisplay added optional.
    const withDisplay = {
      playerId: '0',
      deckCount: 8,
      handCount: 2,
      discardCount: 0,
      inPlayCount: 0,
      victoryCount: 0,
      woundCount: 0,
      handCards: ['starting-shield-agent', 'starting-shield-agent'],
      handDisplay: [
        {
          extId: 'starting-shield-agent',
          name: 'S.H.I.E.L.D. Agent',
          imageUrl: '',
          cost: null,
        },
        {
          extId: 'starting-shield-agent',
          name: 'S.H.I.E.L.D. Agent',
          imageUrl: '',
          cost: null,
        },
      ],
    } satisfies UIPlayerState;

    // both optional fields may be omitted (redacted form).
    const redacted = {
      playerId: '1',
      deckCount: 8,
      handCount: 4,
      discardCount: 0,
      inPlayCount: 0,
      victoryCount: 0,
      woundCount: 0,
    } satisfies UIPlayerState;

    assert.equal(withDisplay.handCards.length, withDisplay.handDisplay.length);
    assert.equal(redacted.handCount, 4);
  });

  it('UIMastermindState retains existing fields AND has display', () => {
    // why: WP-111 — additive extension; existing id / tacticsRemaining /
    // tacticsDefeated preserved verbatim.
    const fixture = {
      id: 'core/dr-doom',
      tacticsRemaining: 4,
      tacticsDefeated: 0,
      display: {
        extId: 'core-mastermind-dr-doom-doctor-doom',
        name: 'Dr. Doom',
        imageUrl: '',
        cost: 9,
      },
    } satisfies UIMastermindState;

    assert.deepStrictEqual(Object.keys(fixture).sort(), [
      'display',
      'id',
      'tacticsDefeated',
      'tacticsRemaining',
    ]);
  });
});
