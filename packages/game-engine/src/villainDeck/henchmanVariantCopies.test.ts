/**
 * Tests for henchman groups printed as variant cards (D-24803).
 *
 * amwp Tardigrade and wtif Ultron Sentries print 5 class variants x 2 copies; rvlt
 * Mandarin's Rings prints 10 unique rings (rules v23 p.53). henchmanCopyVariant maps the 10
 * `henchman-{group}-NN` copies onto the printed variants in contiguous blocks, and every
 * per-copy lookup (ability hooks, display data, Size-Changing fight discount) reads it. A
 * group of identical copies is untouched.
 *
 * Reads the committed card data. Uses node:test only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HENCHMAN_COPIES_PER_GROUP, henchmanCopyVariant } from './villainDeck.setup.js';
import { buildFightSizeChanging } from '../setup/buildFightSizeChanging.js';
import { buildCardDisplayData } from '../setup/buildCardDisplayData.js';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { resolveFightPrice } from '../economy/economy.resolve.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { LegendaryGameState } from '../types.js';

// why: resolve the repo-root data directory from this test's own location (the
// amwpWaspSizeChanging.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const SET_DATA: Record<string, unknown> = {};
for (const setAbbr of ['amwp', 'rvlt', 'wtif', 'core']) {
  SET_DATA[setAbbr] = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
}

/** A registry reader exposing the committed sets above (no flat cards). */
const REGISTRY = {
  listCards: () => [],
  listSets: () => [{ abbr: 'amwp' }, { abbr: 'rvlt' }, { abbr: 'wtif' }, { abbr: 'core' }],
  getSet: (abbr: string) => SET_DATA[abbr],
};

/**
 * Finds a henchman group entry in the loaded set data.
 *
 * @param setAbbr - The set abbreviation.
 * @param groupSlug - The henchman group slug.
 * @returns The raw group entry.
 */
function findGroup(setAbbr: string, groupSlug: string): Record<string, unknown> {
  const henchmen = (SET_DATA[setAbbr] as { henchmen: Array<Record<string, unknown>> }).henchmen;
  const group = henchmen.find((entry) => entry.slug === groupSlug);
  assert.ok(group !== undefined, `${setAbbr}/${groupSlug} is in the committed data`);
  return group;
}

/**
 * A setup config selecting the given henchman groups.
 *
 * @param henchmanGroupIds - The `<setAbbr>/<groupSlug>` henchman groups.
 * @returns The config.
 */
function makeConfig(henchmanGroupIds: string[]): MatchSetupConfig {
  return {
    schemeId: 'core/midtown-bank-robbery',
    mastermindId: 'core/dr-doom',
    villainGroupIds: ['core/brotherhood'],
    henchmanGroupIds,
    heroDeckIds: ['core/spider-man'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };
}

/**
 * The copy ext_id for one henchman copy.
 *
 * @param groupSlug - The henchman group slug.
 * @param copyIndex - The copy index, 0 to 9.
 * @returns `henchman-{groupSlug}-{NN}`.
 */
function copyId(groupSlug: string, copyIndex: number): CardExtId {
  return `henchman-${groupSlug}-${String(copyIndex).padStart(2, '0')}`;
}

describe('henchmanCopyVariant (D-24803)', () => {
  it('maps Tardigrade\'s 10 copies onto its 5 class variants two at a time, in printed order', () => {
    const tardigrade = findGroup('amwp', 'tardigrade');
    const variantSlugs: unknown[] = [];
    for (let copyIndex = 0; copyIndex < HENCHMAN_COPIES_PER_GROUP; copyIndex++) {
      variantSlugs.push(henchmanCopyVariant(tardigrade, copyIndex)?.slug);
    }
    assert.deepStrictEqual(variantSlugs, [
      'tardigrade-covert', 'tardigrade-covert',
      'tardigrade-instinct', 'tardigrade-instinct',
      'tardigrade-ranged', 'tardigrade-ranged',
      'tardigrade-strength', 'tardigrade-strength',
      'tardigrade-tech', 'tardigrade-tech',
    ]);
  });

  it('gives each Mandarin\'s Ring copy its own ring', () => {
    const rings = findGroup('rvlt', 'mandarins-rings');
    const ringCards = rings.cards as Array<{ slug: string }>;
    for (let copyIndex = 0; copyIndex < HENCHMAN_COPIES_PER_GROUP; copyIndex++) {
      assert.equal(henchmanCopyVariant(rings, copyIndex)?.slug, ringCards[copyIndex]!.slug);
    }
  });

  it('is null for a group of identical copies, an uneven variant list and an out-of-range copy', () => {
    assert.equal(henchmanCopyVariant(findGroup('core', 'doombot-legion'), 0), null);
    assert.equal(henchmanCopyVariant({ slug: 'uneven', cards: [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }] }, 0), null);
    assert.equal(henchmanCopyVariant(findGroup('amwp', 'tardigrade'), HENCHMAN_COPIES_PER_GROUP), null);
    assert.equal(henchmanCopyVariant(null, 0), null);
  });

  // why: a variant list that does not divide 10 falls back to the group-level fields
  // silently, so a data change that broke the even split would quietly drop the variants.
  it('every committed henchman group with variant cards splits its 10 copies evenly', () => {
    const variantGroups: string[] = [];
    for (const fileName of readdirSync(CARDS_DIRECTORY).filter((name) => name.endsWith('.json')).sort()) {
      const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, fileName), 'utf8')) as { henchmen?: unknown[] };
      for (const entry of setData.henchmen ?? []) {
        const group = entry as { slug?: string; cards?: unknown[] };
        if (!Array.isArray(group.cards)) continue;
        variantGroups.push(`${fileName.replace('.json', '')}/${group.slug}`);
        assert.equal(
          HENCHMAN_COPIES_PER_GROUP % group.cards.length,
          0,
          `${fileName} henchman group "${group.slug}" has ${group.cards.length} variant cards, which do not split 10 copies evenly`,
        );
      }
    }
    assert.deepStrictEqual(variantGroups, ['amwp/tardigrade', 'rvlt/mandarins-rings', 'wtif/ultron-sentries']);
  });
});

describe('per-copy lookups read the variant (D-24803)', () => {
  it('buildFightSizeChanging keys each Tardigrade copy with its own three Microscopic icons', () => {
    const fightSizeChanging = buildFightSizeChanging(REGISTRY, makeConfig(['amwp/tardigrade']), 'core/dr-doom', []);
    const classesByCopy = ['covert', 'covert', 'instinct', 'instinct', 'ranged', 'ranged', 'strength', 'strength', 'tech', 'tech'];
    assert.equal(Object.keys(fightSizeChanging).length, HENCHMAN_COPIES_PER_GROUP);
    for (let copyIndex = 0; copyIndex < HENCHMAN_COPIES_PER_GROUP; copyIndex++) {
      const heroClass = classesByCopy[copyIndex]!;
      assert.deepStrictEqual(fightSizeChanging[copyId('tardigrade', copyIndex)], {
        classes: [],
        microscopicIcons: [heroClass, heroClass, heroClass],
      });
    }
  });

  it('buildFightSizeChanging adds nothing for henchmen without Size-Changing', () => {
    const config = makeConfig(['rvlt/mandarins-rings', 'wtif/ultron-sentries', 'core/doombot-legion']);
    assert.deepStrictEqual(buildFightSizeChanging(REGISTRY, config, 'core/dr-doom', []), {});
  });

  it('buildCardDisplayData names and pictures each copy as its variant; identical groups keep the group fields', () => {
    const config = makeConfig(['amwp/tardigrade', 'rvlt/mandarins-rings', 'core/doombot-legion']);
    const displayData = buildCardDisplayData(REGISTRY, config, 2);
    assert.equal(displayData[copyId('tardigrade', 0)]?.name, 'Tardigrade (Covert)');
    assert.equal(displayData[copyId('tardigrade', 9)]?.name, 'Tardigrade (Tech)');
    assert.equal(
      displayData[copyId('tardigrade', 9)]?.imageUrl,
      'https://images.legendary-arena.com/amwp/amwp-hm-tardigrade-tech.webp',
    );
    assert.equal(displayData[copyId('tardigrade', 9)]?.cost, 4, 'the printed Attack stays group-level');
    assert.equal(displayData[copyId('mandarins-rings', 0)]?.name, 'Daimonic, The White Light');
    assert.equal(displayData[copyId('mandarins-rings', 9)]?.name, 'Zero, The Ice Blast');
    const doombotGroup = findGroup('core', 'doombot-legion');
    for (let copyIndex = 0; copyIndex < HENCHMAN_COPIES_PER_GROUP; copyIndex++) {
      assert.equal(displayData[copyId('doombot-legion', copyIndex)]?.name, doombotGroup.name);
      assert.equal(displayData[copyId('doombot-legion', copyIndex)]?.imageUrl, doombotGroup.imageUrl);
    }
  });

  it('buildVillainAbilityHooks reads each copy\'s own Fight line; identical groups keep one hook per copy', () => {
    const hooks = buildVillainAbilityHooks(REGISTRY, makeConfig(['amwp/tardigrade', 'core/doombot-legion']));
    const tardigradeHooks = hooks.filter((hook) => hook.cardId.startsWith('henchman-tardigrade-'));
    // why: line 0 is the bare Microscopic line (no timing), line 1 is "Fight: KO one of your
    // Heroes." — one onFight hook per copy, from the variant's own lines.
    assert.equal(tardigradeHooks.length, HENCHMAN_COPIES_PER_GROUP);
    for (const hook of tardigradeHooks) {
      assert.equal(hook.timing, 'onFight');
      assert.deepStrictEqual(hook.keywords, ['koHeroCurrentPlayer'], `${hook.cardId} KOs one of your Heroes`);
    }
    const doombotHooks = hooks.filter((hook) => hook.cardId.startsWith('henchman-doombot-legion-'));
    assert.equal(doombotHooks.length, HENCHMAN_COPIES_PER_GROUP);
    for (const hook of doombotHooks) {
      assert.ok(hook.keywords.length + hook.effects.length > 0, `${hook.cardId} keeps its group-level Fight effect`);
    }
  });
});

describe('variant Fight markers (D-24803)', () => {
  it('each Mandarin\'s Ring copy fires its own ring\'s Fight effect, and an unmarked ring fires none', () => {
    const hooks = buildVillainAbilityHooks(REGISTRY, makeConfig(['rvlt/mandarins-rings']));
    /**
     * The resolved keyword names and effect primitives of one copy's hooks.
     *
     * @param copyIndex - The ring's copy index.
     * @returns The sorted names.
     */
    function resolvedFor(copyIndex: number): string[] {
      const names: string[] = [];
      for (const hook of hooks.filter((candidate) => candidate.cardId === copyId('mandarins-rings', copyIndex))) {
        for (const keyword of hook.keywords) names.push(keyword);
        for (const descriptor of hook.effects) names.push(descriptor.primitive);
      }
      return names.sort();
    }
    assert.deepStrictEqual(resolvedFor(0), ['draw-cards-current'], 'Daimonic draws a card');
    assert.deepStrictEqual(resolvedFor(1), ['ko-up-to-from-discard-current'], 'Incandescence may KO from the discard pile');
    assert.deepStrictEqual(resolvedFor(2), ['gain-recruit-current'], 'Influence gives +1 Recruit');
    // why: WP-872 / D-24817 — Liar, Nightbringer and Remaker are marked now (an intentional
    // behavior change: their Fight lines do what they print).
    assert.deepStrictEqual(resolvedFor(3), ['look-other-player-deck-top-claim-current'], 'Liar looks at another player\'s deck top and claims');
    assert.deepStrictEqual(resolvedFor(5), ['reveal-villain-deck-defeat-low-vp-current'], 'Nightbringer may defeat a revealed Villain Deck Villain');
    assert.deepStrictEqual(resolvedFor(6), ['give-card-to-right-player-current'], 'Remaker gives a card to the player on the right');
    // why: a legacy keyword resolves to both its name and its ko-hero descriptor.
    assert.deepStrictEqual(resolvedFor(7), ['ko-hero', 'koHeroCurrentPlayer'], 'Spectral KOs one of your Heroes');
  });

  it('every Ultron Sentries copy KOs one of your Heroes', () => {
    const hooks = buildVillainAbilityHooks(REGISTRY, makeConfig(['wtif/ultron-sentries'])).filter((hook) =>
      hook.cardId.startsWith('henchman-ultron-sentries-'),
    );
    assert.equal(hooks.length, HENCHMAN_COPIES_PER_GROUP);
    for (const hook of hooks) {
      assert.deepStrictEqual(hook.keywords, ['koHeroCurrentPlayer'], `${hook.cardId} KOs one of your Heroes`);
    }
  });
});

describe('Tardigrade fight price end to end (D-24802 + D-24803)', () => {
  /**
   * Setup with Tardigrade, then player 0 has the given classes in play.
   *
   * @param playedClasses - One hero class per card in play.
   * @returns The game state.
   */
  function setupWithPlayed(playedClasses: string[]): LegendaryGameState {
    const gameState = buildInitialGameState(
      makeConfig(['amwp/tardigrade']),
      makeCardRegistryReader({ listSets: REGISTRY.listSets, getSet: REGISTRY.getSet }),
      makeMockCtx({ numPlayers: 2 }),
    );
    const inPlay: CardExtId[] = [];
    for (let cardIndex = 0; cardIndex < playedClasses.length; cardIndex++) {
      const cardId = `played-${cardIndex}`;
      inPlay.push(cardId);
      gameState.cardTraits[cardId] = { heroClass: playedClasses[cardIndex], team: null } as never;
    }
    gameState.playerZones['0']!.inPlay = inPlay;
    return gameState;
  }

  it('a Tech Tardigrade costs 2 less per Tech card played, up to three, and goes below 0', () => {
    const techCopy = copyId('tardigrade', 8);
    assert.equal(resolveFightPrice(setupWithPlayed([]), techCopy, '0'), 4);
    assert.equal(resolveFightPrice(setupWithPlayed(['tech']), techCopy, '0'), 2);
    assert.equal(resolveFightPrice(setupWithPlayed(['tech', 'tech', 'tech', 'tech']), techCopy, '0'), -2);
  });

  it('a Covert Tardigrade ignores Tech cards', () => {
    assert.equal(resolveFightPrice(setupWithPlayed(['tech', 'tech']), copyId('tardigrade', 0), '0'), 4);
    assert.equal(resolveFightPrice(setupWithPlayed(['covert', 'tech']), copyId('tardigrade', 1), '0'), 2);
  });
});
