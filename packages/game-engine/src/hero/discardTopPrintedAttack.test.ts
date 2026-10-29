/**
 * Bishop's Firepower from the Future (WP-850 / EC-888 / D-24786).
 *
 * dkcy prints two lines: "Discard the top four cards of your deck. You get +[icon:attack] equal
 * to those cards' printed [icon:attack]." and "[team:x-men]: KO any number of those cards."
 * The curated markers `[keyword:discard-top-printed-attack:4]` and `[keyword:ko-discarded-this-way]`
 * turn them into two hooks. Line 1 discards the deck top one card at a time (D-24285 reshuffle),
 * grants the summed printed Attack and records the discarded ids in `G.lastDeckTopDiscard`;
 * line 2 (X-Men gate) parks the WP-693 KO-from-discard choice limited by `eligibleCardIds`.
 *
 * The play cases build their hooks with the setup parser from the real generated ability text
 * (never a hook-less fixture, which would return early and pass vacuously) and assert the grant
 * positively. Handler edge cases dispatch through executeSingleEffect so the magnitude pre-gate
 * runs.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects, executeSingleEffect } from './heroEffects.execute.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { resolveKoDiscardChoice } from '../moves/koDiscardChoice.resolve.js';
import { selectDefaultKoDiscardCardIds } from '../simulation/ai.legalMoves.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makeCardStatEntry } from '../test/fixtureBuilders.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { HeroAbilityHook, HeroEffectDescriptor } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

// why: the exact generated ability lines, verified against data/cards/dkcy.json
// (bishop/firepower-from-the-future) after the WP-850 marker regen.
const DISCARD_LINE =
  "Discard the top four cards of your deck. You get +[icon:attack] equal to those cards' printed [icon:attack]. [keyword:discard-top-printed-attack:4]";
const KO_LINE = '[team:x-men]: KO any number of those cards. [keyword:ko-discarded-this-way]';

const FIREPOWER = 'dkcy/bishop/firepower-from-the-future#0' as CardExtId;
const ALLY = 'ally-x-men-hero' as CardExtId;
const HERO_TWO = 'hero-two' as CardExtId;
const HERO_THREE = 'hero-three' as CardExtId;
const HERO_FOUR = 'hero-four' as CardExtId;
const KEPT_IN_DECK = 'kept-in-deck' as CardExtId;

const DISCARD_FOUR: HeroEffectDescriptor = { type: 'discard-top-printed-attack', magnitude: 4 };
const KO_THOSE: HeroEffectDescriptor = { type: 'ko-discarded-this-way' };

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** Parses the two printed + marked lines into Firepower's hooks, in line order. */
function buildFirepowerHooks(): HeroAbilityHook[] {
  const setData = {
    abbr: 'dkcy',
    heroes: [{
      slug: 'bishop',
      cards: [{ slug: 'firepower-from-the-future', rarityLabel: 'Rare', abilities: [DISCARD_LINE, KO_LINE] }],
      physicalCards: [{ id: 'p0', count: 1, sides: ['firepower-from-the-future'] }],
    }],
    villains: [], henchmen: [], schemes: [], masterminds: [], bystanders: [], wounds: [], other: [],
  };
  const registry = {
    listCards: () => [],
    listSets: () => [{ abbr: 'dkcy' }],
    getSet: (abbr: string) => (abbr === 'dkcy' ? setData : undefined),
  };
  const config: MatchSetupConfig = {
    schemeId: 'test/scheme', mastermindId: 'test/mm',
    villainGroupIds: ['test/vg'], henchmanGroupIds: ['test/hg'],
    heroDeckIds: ['dkcy/bishop'],
    bystandersCount: 0, woundsCount: 0, officersCount: 0, sidekicksCount: 0,
  };
  const hooks = buildHeroAbilityHooks(registry, config).filter((hook) => hook.cardId === FIREPOWER);
  assert.equal(hooks.length, 2, 'Firepower from the Future parses to one hook per printed line');
  return hooks;
}

/**
 * A one-player state with Firepower in play, the given deck and discard, and printed Attack
 * for the hero cards (a Wound has no stats entry, so it counts 0). With `hasXMenAlly` a second
 * X-Men Hero is in play, so line 2's team gate passes.
 */
function makeState(deck: CardExtId[], discard: CardExtId[], hasXMenAlly: boolean): LegendaryGameState {
  const gameState = buildInitialGameState(
    {
      schemeId: 'test-scheme', mastermindId: 'test-mastermind',
      villainGroupIds: [], henchmanGroupIds: [], heroDeckIds: [],
      bystandersCount: 0, woundsCount: 0, officersCount: 0, sidekicksCount: 0,
    },
    {},
    makeMockCtx(),
  );
  const zones = gameState.playerZones['0']!;
  zones.deck = [...deck];
  zones.discard = [...discard];
  zones.inPlay = hasXMenAlly ? [FIREPOWER, ALLY] : [FIREPOWER];
  gameState.cardTraits = {
    [FIREPOWER]: { heroClass: 'tech', team: 'x-men' },
    [ALLY]: { heroClass: 'covert', team: 'x-men' },
  };
  // why: G.cardStats already holds the printed base (the trailing `+` of "4+" is dropped when
  // stats are built); a Firepower copy in the deck therefore carries attack 4.
  gameState.cardStats = {
    [FIREPOWER]: makeCardStatEntry({ attack: 4 }),
    [HERO_TWO]: makeCardStatEntry({ attack: 2 }),
    [HERO_THREE]: makeCardStatEntry({ attack: 3 }),
    [HERO_FOUR]: makeCardStatEntry({ attack: 4 }),
    [KEPT_IN_DECK]: makeCardStatEntry({ attack: 9 }),
  };
  gameState.heroAbilityHooks = buildFirepowerHooks();
  return gameState;
}

/** Whether any log line reports an unhandled (hollow) effect. */
function hasUnhandledEffectLine(gameState: LegendaryGameState): boolean {
  return gameState.messages.some((entry) => entry.text.includes('Unhandled effect observed'));
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

describe('Firepower from the Future parses to two executable hooks (WP-850)', () => {
  it('line 1 is the discard-top-printed-attack effect with no stray plain attack', () => {
    const [discardHook] = buildFirepowerHooks();
    assert.deepEqual(discardHook!.effects, [{ type: 'discard-top-printed-attack', magnitude: 4 }]);
    assert.ok(!discardHook!.keywords.includes('attack'), 'both [icon:attack] icons are the keyword\'s own grant');
    assert.equal(discardHook!.conditions, undefined, 'line 1 is unconditional');
    assert.equal(discardHook!.unresolvedMarkers, undefined);
  });

  it('line 2 is the ko-discarded-this-way effect behind an X-Men requiresTeam gate', () => {
    const [, koHook] = buildFirepowerHooks();
    assert.deepEqual(koHook!.conditions, [{ type: 'requiresTeam', value: 'x-men' }]);
    assert.deepEqual(koHook!.effects, [{ type: 'ko-discarded-this-way' }]);
    assert.equal(koHook!.unresolvedMarkers, undefined, 'no gate-only hollow');
  });
});

// ---------------------------------------------------------------------------
// Real-hook plays
// ---------------------------------------------------------------------------

describe('playing Firepower from the Future (WP-850)', () => {
  it('without another X-Men Hero: grants the printed sum, KO line gated, no hollow', () => {
    const gameState = makeState([FIREPOWER, HERO_TWO, WOUND_EXT_ID, HERO_THREE, KEPT_IN_DECK], [], false);
    const attackBefore = gameState.turnEconomy.attack;
    executeHeroEffects(gameState, makeMockCtx(), '0', FIREPOWER);

    const zones = gameState.playerZones['0']!;
    assert.deepEqual(zones.discard, [FIREPOWER, HERO_TWO, WOUND_EXT_ID, HERO_THREE]);
    assert.deepEqual(zones.deck, [KEPT_IN_DECK]);
    assert.equal(gameState.turnEconomy.attack - attackBefore, 4 + 2 + 0 + 3,
      'the base 4 is applyCardPlay\'s; this play adds the four printed values');
    assert.ok(gameState.messages.some((entry) => entry.text.includes('did not activate one of its abilities')),
      'the gated KO line is logged');
    assert.equal(gameState.pendingKoDiscardChoices, undefined, 'nothing parks without the X-Men Hero');
    assert.equal(gameState.diagnostics?.hollowEffects?.length ?? 0, 0, 'no hollow recorded');
    assert.ok(!hasUnhandledEffectLine(gameState), 'no Unhandled effect observed line');
  });

  it('with another X-Men Hero: parks a KO choice limited to the four discarded cards', () => {
    const gameState = makeState([HERO_TWO, HERO_THREE, WOUND_EXT_ID, HERO_FOUR], [WOUND_EXT_ID], true);
    const attackBefore = gameState.turnEconomy.attack;
    executeHeroEffects(gameState, makeMockCtx(), '0', FIREPOWER);

    assert.equal(gameState.turnEconomy.attack - attackBefore, 2 + 3 + 0 + 4);
    const parked = gameState.pendingKoDiscardChoices ?? [];
    assert.equal(parked.length, 1, 'one KO choice parks');
    assert.deepEqual(parked[0], {
      choiceType: 'ko-from-discard',
      playerID: '0',
      maxCount: 4,
      sourceCardId: FIREPOWER,
      // why: discard order — Wounds share one ext_id (D-24682), so the one Wound allowance is
      // spent on the first Wound in the discard; either copy is the same card to KO.
      eligibleCardIds: [WOUND_EXT_ID, HERO_TWO, HERO_THREE, HERO_FOUR],
    });
    assert.ok(!Object.hasOwn(gameState, 'lastDeckTopDiscard'), 'the hand-off record is consumed');
    assert.equal(gameState.diagnostics?.hollowEffects?.length ?? 0, 0, 'no hollow recorded');
    assert.ok(!hasUnhandledEffectLine(gameState), 'no Unhandled effect observed line');
  });
});

// ---------------------------------------------------------------------------
// Handler edge cases
// ---------------------------------------------------------------------------

describe('discard-top-printed-attack edge cases (WP-850)', () => {
  it('a short deck reshuffles the discard mid-effect and keeps discarding', () => {
    // why: deck [two], discard [three, four]; after `two` the deck is empty, the discard
    // [three, four, two] reshuffles (makeMockCtx reverses) into [two, four, three].
    const gameState = makeState([HERO_TWO], [HERO_THREE, HERO_FOUR], false);
    executeSingleEffect(gameState, makeMockCtx(), '0', FIREPOWER, DISCARD_FOUR);
    const record = gameState.lastDeckTopDiscard!;
    assert.deepEqual(record.cardIds, [HERO_TWO, HERO_TWO, HERO_FOUR, HERO_THREE],
      'a card the reshuffle brings back is discarded (and counted) again');
    assert.equal(gameState.turnEconomy.attack, 2 + 2 + 4 + 3);
  });

  it('deck and discard both empty: stops, writes an empty record over a stale one', () => {
    const gameState = makeState([], [], false);
    gameState.lastDeckTopDiscard = { playerID: '0', sourceCardId: FIREPOWER, cardIds: [HERO_FOUR] };
    executeSingleEffect(gameState, makeMockCtx(), '0', FIREPOWER, DISCARD_FOUR);
    assert.deepEqual(gameState.lastDeckTopDiscard, { playerID: '0', sourceCardId: FIREPOWER, cardIds: [] },
      'the stale record from an earlier play of this card instance is overwritten');
    assert.ok(gameState.messages.some((entry) => entry.outcome === 'blocked' && entry.text.includes('no cards')));

    // why: an unrelated card reaches the discard before line 2 runs; it was never one of
    // "those cards", so nothing may be offered.
    gameState.playerZones['0']!.discard = [HERO_FOUR];
    executeSingleEffect(gameState, makeMockCtx(), '0', FIREPOWER, KO_THOSE);
    assert.equal(gameState.pendingKoDiscardChoices, undefined,
      'line 2 never offers a card an earlier play discarded');
    // why: nothing was discarded, so the line says so (live match lvYv7o56JLr 11.2.6 read "none of
    // the discarded cards left", which implied some had been discarded).
    const koLine = gameState.messages.find((entry) => entry.outcome === 'neutral' && entry.text.includes('nothing to KO'));
    assert.ok(koLine !== undefined, 'an empty discard says there is nothing to KO');
    assert.ok(koLine.text.includes('discarded no cards'));
    assert.ok(!gameState.messages.some((entry) => entry.text.includes('none of the discarded cards')));
  });

  it('cards discarded but all reshuffled back: says none of them are left to KO', () => {
    const gameState = makeState([], [HERO_FOUR], true);
    gameState.lastDeckTopDiscard = { playerID: '0', sourceCardId: FIREPOWER, cardIds: [HERO_TWO, HERO_THREE] };
    executeSingleEffect(gameState, makeMockCtx(), '0', FIREPOWER, KO_THOSE);
    assert.equal(gameState.pendingKoDiscardChoices, undefined);
    assert.ok(gameState.messages.some((entry) => entry.outcome === 'neutral' && entry.text.includes('none of the discarded cards left')));
  });

  it('a one-card deck re-discards that card after each reshuffle', () => {
    const gameState = makeState([HERO_TWO], [], false);
    executeSingleEffect(gameState, makeMockCtx(), '0', FIREPOWER, DISCARD_FOUR);
    // why: D-24285 — the discarded card refills the empty deck each time, so all four discards
    // are the same card and each counts its printed Attack.
    assert.deepEqual(gameState.lastDeckTopDiscard!.cardIds, [HERO_TWO, HERO_TWO, HERO_TWO, HERO_TWO]);
    assert.equal(gameState.turnEconomy.attack, 8);
  });
});

describe('ko-discarded-this-way edge cases (WP-850)', () => {
  it('an absent or mismatched record parks nothing and logs blocked', () => {
    const gameState = makeState([], [HERO_TWO], true);
    executeSingleEffect(gameState, makeMockCtx(), '0', FIREPOWER, KO_THOSE);
    assert.equal(gameState.pendingKoDiscardChoices, undefined);

    gameState.lastDeckTopDiscard = { playerID: '0', sourceCardId: 'other-card#0' as CardExtId, cardIds: [HERO_TWO] };
    executeSingleEffect(gameState, makeMockCtx(), '0', FIREPOWER, KO_THOSE);
    assert.equal(gameState.pendingKoDiscardChoices, undefined);
    assert.ok(!Object.hasOwn(gameState, 'lastDeckTopDiscard'), 'the record is deleted on every branch');
    const blockedLines = gameState.messages.filter((entry) => entry.outcome === 'blocked');
    assert.equal(blockedLines.length, 2);
  });

  it('offers each id once per copy actually in the discard', () => {
    // why: the record lists HERO_TWO twice (a reshuffle re-discard), but the discard holds it once.
    const gameState = makeState([], [HERO_TWO, WOUND_EXT_ID, WOUND_EXT_ID], true);
    gameState.lastDeckTopDiscard = {
      playerID: '0', sourceCardId: FIREPOWER, cardIds: [HERO_TWO, HERO_TWO, WOUND_EXT_ID],
    };
    executeSingleEffect(gameState, makeMockCtx(), '0', FIREPOWER, KO_THOSE);
    const parked = gameState.pendingKoDiscardChoices![0]!;
    assert.deepEqual(parked.eligibleCardIds, [HERO_TWO, WOUND_EXT_ID],
      'one HERO_TWO (one copy present) and one Wound (one recorded, two present)');
    assert.equal(parked.maxCount, 2);
  });
});

// ---------------------------------------------------------------------------
// The filtered KO choice: resolve and bot
// ---------------------------------------------------------------------------

describe('the filtered KO-from-discard choice (WP-850)', () => {
  /** A parked Firepower choice over [two, Wound]; the discard also holds an unrelated Wound. */
  function makeParkedState(): LegendaryGameState {
    const gameState = makeState([], [WOUND_EXT_ID, HERO_TWO, WOUND_EXT_ID], true);
    gameState.pendingKoDiscardChoices = [{
      choiceType: 'ko-from-discard', playerID: '0', maxCount: 2,
      sourceCardId: FIREPOWER, eligibleCardIds: [HERO_TWO, WOUND_EXT_ID],
    }];
    return gameState;
  }

  it('accepts a subset, including none, and front-pops', () => {
    const emptyPick = makeParkedState();
    resolveKoDiscardChoice(makeMockMoveContext(emptyPick), { cardIds: [] });
    assert.equal(emptyPick.pendingKoDiscardChoices!.length, 0, 'KO nothing is legal');

    const gameState = makeParkedState();
    resolveKoDiscardChoice(makeMockMoveContext(gameState), { cardIds: [HERO_TWO] });
    assert.equal(gameState.pendingKoDiscardChoices!.length, 0);
    assert.ok(gameState.ko.includes(HERO_TWO));
    assert.deepEqual(gameState.playerZones['0']!.discard, [WOUND_EXT_ID, WOUND_EXT_ID]);
  });

  it('rejects a card outside the filter, or more copies than it allows, queue intact', () => {
    const outside = makeParkedState();
    resolveKoDiscardChoice(makeMockMoveContext(outside), { cardIds: [HERO_THREE] });
    assert.equal(outside.pendingKoDiscardChoices!.length, 1);

    const tooMany = makeParkedState();
    resolveKoDiscardChoice(makeMockMoveContext(tooMany), { cardIds: [WOUND_EXT_ID, WOUND_EXT_ID] });
    assert.equal(tooMany.pendingKoDiscardChoices!.length, 1,
      'two Wounds are in the discard but only one was discarded by this play');
    assert.deepEqual(tooMany.playerZones['0']!.discard, [WOUND_EXT_ID, HERO_TWO, WOUND_EXT_ID]);
  });

  it('the bot picks only eligible cards and its pick resolves', () => {
    const gameState = makeParkedState();
    gameState.pendingKoDiscardChoices![0]!.eligibleCardIds = [HERO_TWO];
    gameState.pendingKoDiscardChoices![0]!.maxCount = 1;
    const pick = selectDefaultKoDiscardCardIds(gameState);
    assert.deepEqual(pick, [], 'the discard\'s Wounds are not "those cards", and a Hero is kept');
    resolveKoDiscardChoice(makeMockMoveContext(gameState), { cardIds: pick });
    assert.equal(gameState.pendingKoDiscardChoices!.length, 0, 'the bot\'s pick front-pops');

    const withWound = makeParkedState();
    const woundPick = selectDefaultKoDiscardCardIds(withWound);
    assert.deepEqual(woundPick, [WOUND_EXT_ID], 'exactly the one discarded Wound');
    resolveKoDiscardChoice(makeMockMoveContext(withWound), { cardIds: woundPick });
    assert.equal(withWound.pendingKoDiscardChoices!.length, 0);
  });
});
