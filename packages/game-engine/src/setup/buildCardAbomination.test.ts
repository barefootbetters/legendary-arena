/**
 * Tests for buildCardAbomination (WP-815 / D-24747).
 *
 * Covers T15-T18: the exact key sets for the ca75, rlmk and co2e Abomination
 * cards, the negatives (Primus, Maestro, The Leader, Zzzax, every tactic, and the
 * second non-tactic face `epic-maximus-the-mad`), and the empty map for a core
 * match or a registry without getSet (so setup omits G.cardAbomination), plus the
 * positive setup path that keys G.mastermind.baseCardId.
 *
 * Uses node:test only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCardAbomination } from './buildCardAbomination.js';
import { buildInitialGameState } from './buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';

// why: every ability line below is copied verbatim from data/cards/ca75.json
// (villains zolas-creations, masterminds arnim-zola), so the builder is tested
// against the printed text, not a transcription.
const CA75_SET = {
  villains: [
    {
      slug: 'zolas-creations',
      cards: [
        { slug: 'captain-zolandia', copies: 2, abilities: ['[keyword:Abomination]', 'Fight: You get +1[icon:recruit] for each Hero Class you have.'] },
        { slug: 'doughboy', copies: 2, abilities: ['[keyword:Abomination]', 'Fight: KO one of your Heroes. [effect:koHeroCurrentPlayer]'] },
        { slug: 'man-fish', copies: 2, abilities: ['[keyword:Abomination]', 'Fight: If you fought Man-Fish in the Sewers or Bridge, then each other player gains a Wound.', 'Escape: Each player gains a Wound. [effect:gainWoundEachPlayer]'] },
        { slug: 'primus', copies: 2, abilities: ['To fight Primus, you must also discard a card that costs 2, 3, 5, or 7.', 'Escape: each player discards a Hero that costs 2, 3, 5, or 7.'] },
      ],
    },
  ],
  masterminds: [
    {
      slug: 'arnim-zola',
      cards: [
        { slug: 'arnim-zola', tactic: false, abilities: ['[keyword:Ultimate Abomination]', "Always Leads: Zola's Creations", "Master Strike: For each Hero in the HQ that has less than 2 printed [icon:attack], put that Hero on the bottom of the Hero Deck, and each player discards a card of that Hero's cost."] },
        { slug: 'dominate-the-weak', tactic: true, abilities: ['Fight: The player of your choice gains a Hero from the HQ that has less than 2 printed [icon:attack].'] },
        { slug: 'computer-uploaded-genius', tactic: true, abilities: ['Fight: Each other player reveals a [hc:tech] Hero or discards a card.'] },
        { slug: 'pet-projects', tactic: true, abilities: ["Fight: Each other player reveals a Zola's Creations Villain from their Victory Pile or gains a Wound."] },
        { slug: 'crush-pacifist-resistance', tactic: true, abilities: ['Fight: KO up to two of your Heroes that have less than 2 printed [icon:attack].'] },
      ],
    },
  ],
};

// why: copied verbatim from data/cards/rlmk.json (villains inhuman-rebellion,
// masterminds maximus-the-mad). epic-maximus-the-mad is the SECOND non-tactic face
// and also prints Double Highest Abomination; it must not produce a key.
const RLMK_SET = {
  villains: [
    {
      slug: 'inhuman-rebellion',
      cards: [
        { slug: 'lineage', copies: 2, abilities: ['[keyword:Abomination]', 'Fight: Rescue Bystanders equal to the printed [icon:attack] of the Hero in the HQ space under Lineage.'] },
        { slug: 'omega', copies: 2, abilities: ['[keyword:Abomination]', 'Fight: Choose "Alpha" or "Omega." Then reveal the top card of your deck:', '[keyword:Alpha]: If that card costs 0, KO it. [keyword:Omega]: If that card costs 1 or more, draw it.'] },
        { slug: 'lash', copies: 2, abilities: ['[keyword:Abomination]', "Ambush: Choose a Hero from the HQ that doesn't have a printed [icon:attack] of 2 or more. Put it on the bottom of the HQ.", 'Fight: Gain a Hero from the HQ with no [icon:attack] icon that costs 4 or less.'] },
        { slug: 'the-unspoken', copies: 2, abilities: ['[keyword:Double Abomination]', "Ambush: Choose a Hero from the HQ that doesn't have a printed [icon:attack] of 2 or more. Put it on the bottom of the HQ.", 'Fight: KO one of your Heroes with no [icon:attack] icon.'] },
      ],
    },
  ],
  masterminds: [
    {
      slug: 'maximus-the-mad',
      cards: [
        { slug: 'maximus-the-mad', tactic: false, abilities: ['[keyword:Double Highest Abomination]', 'Always Leads: Inhuman Rebellion', "Master Strike: Reveal one of Maximus' remaining Mastermind Tactics at random. Use its Fight effect, then shuffle it back into the remaining Tactics."] },
        { slug: 'epic-maximus-the-mad', tactic: false, abilities: ['[keyword:Double Highest Abomination]', 'Always Leads: Inhuman Rebellion', "Master Strike: Reveal two different Tactics at random from Maximus' remaining Mastermind Tactics. Then use each of those Fight effects, then shuffle them back."] },
        { slug: 'echo-tech-chorus-sentries', tactic: true, abilities: ['Fight: Each player KOs one of their [hc:tech] or [team:inhumans] Heroes or gains a Wound.'] },
        { slug: 'sieve-of-secrets', tactic: true, abilities: ['Fight: Each player reveals the top 6 cards of their deck, discards all the non-grey Heroes revealed, and puts the rest back in any order.'] },
        { slug: 'seize-the-inhuman-throne', tactic: true, abilities: ['Fight: Each player discards down to 4 cards. Maximus gains the [keyword:Thrones Favor]. If he already has it, he spends it and each player discards down to 3 cards.'] },
        { slug: 'terrigen-bomb', tactic: true, abilities: ["Fight: Put each Hero from the HQ that doesn't have a printed [icon:attack] of 2 or more on the bottom of the Hero Deck. Maximus gains the [keyword:Thrones Favor]. If he already had it, he spends it and each player KOs one of their non-grey Heroes with an [icon:attack] icon."] },
      ],
    },
  ],
};

// why: copied verbatim from data/cards/co2e.json (villains radiation, masterminds
// doctor-doom). The co2e Abomination prints its rule as a sentence with no keyword
// token; Maestro, The Leader and Zzzax are the negatives.
const CO2E_SET = {
  villains: [
    {
      slug: 'radiation',
      cards: [
        { slug: 'abomination', copies: 2, abilities: ['Abomination gets +[icon:attack] equal to the printed [icon:attack] of the Hero in the HQ space under his current city space.', 'Fight: You get +1[icon:recruit] for each of your [hc:strength] Heroes.'] },
        { slug: 'maestro-wasteland-hulk', copies: 2, abilities: ['Fight: Count your [hc:strength] Heroes. KO that many of your Heroes.'] },
        { slug: 'the-leader', copies: 2, abilities: ['Ambush: Reveal a [hc:strength] Hero or play a card from the Villain Deck.'] },
        { slug: 'zzzax', copies: 2, abilities: ['Fight: Each player reveals a [hc:strength] Hero or gains a Wound.', 'Escape: Same effect.'] },
      ],
    },
  ],
  masterminds: [
    {
      slug: 'doctor-doom',
      cards: [
        { slug: 'doctor-doom', tactic: false, abilities: ['If there is at least one Omen of Doom, all Doombot Legions get +1[icon:attack]. If there are at least four Omens, then instead Doctor Doom and all Doombot Legions get +2[icon:attack].', 'Always Leads: Doombot Legions', 'Master Strike: Stack this Strike next to Doctor Doom as "Omen of Doom." Then each player discards cards equal to the number of Omens or gains a Wound.'] },
        { slug: 'epic-doctor-doom', tactic: false, abilities: ['All Doombot Legions get +2[icon:attack]. If there are at least four Omens of Doom, then instead Doctor Doom and all Doombot Legions get +4[icon:attack].', 'Always Leads: Doombot Legions', 'Master Strike: Stack this Strike next to Doctor Doom as an "Omen of Doom." Then each player discards cards equal to one plus the number of Omens or gains a Wound.'] },
        { slug: 'dark-technology', tactic: true, abilities: ['Fight: You may recruit a [hc:tech] or [hc:ranged] Hero from the HQ for free.'] },
        { slug: 'monarchs-decree', tactic: true, abilities: ['Fight: Choose one: each other player draws a card or each other player discards a card.'] },
        { slug: 'secrets-of-time-travel', tactic: true, abilities: ['Fight: Take another turn after this one.'] },
        { slug: 'treasures-of-latveria', tactic: true, abilities: ['Fight: When you draw a new hand of cards at the end of this turn, draw three extra cards.'] },
      ],
    },
  ],
};

// why: copied verbatim from data/cards/core.json — the core sentinel config
// (core/brotherhood + core/dr-doom), which prints no Abomination.
const CORE_SET = {
  villains: [
    {
      slug: 'brotherhood',
      cards: [
        { slug: 'blob', copies: 2, abilities: ["You can't defeat Blob unless you have an [team:x-men] Hero. [require-to-defeat:team:x-men]"] },
        { slug: 'juggernaut', copies: 2, abilities: ['Ambush: Each player KOs two Heroes from their discard pile. [effect:ko-hero:each:2:discard]', 'Escape: Each player KOs two Heroes from their hand. [effect:ko-hero:each:2:hand]'] },
        { slug: 'mystique', copies: 2, abilities: ['Escape: Mystique becomes a Scheme Twist that takes effect immediately. [effect:become-scheme-twist]'] },
        { slug: 'sabretooth', copies: 2, abilities: ['Fight: Each player reveals an [team:x-men] Hero or gains a Wound. [effect:reveal-or-wound:team:x-men]', 'Escape: Same effect. [effect:reveal-or-wound:team:x-men]'] },
      ],
    },
  ],
  masterminds: [
    {
      slug: 'dr-doom',
      cards: [
        { slug: 'dr-doom', tactic: false, abilities: ['Always Leads: Doombot Legion', 'Master Strike: Each player with exactly 6 cards in hand reveals a [hc:tech] Hero or puts 2 cards from their hand on top of their deck.'] },
        { slug: 'dark-technology', tactic: true, abilities: ['Fight: You may recruit a [hc:tech] or [hc:ranged] Hero from the HQ for free.'] },
        { slug: 'monarchs-decree', tactic: true, abilities: ['Fight: Choose one: each other player draws a card or each other player discards a card.'] },
        { slug: 'secrets-of-time-travel', tactic: true, abilities: ['Fight: Take another turn after this one.'] },
        { slug: 'treasures-of-latveria', tactic: true, abilities: ['Fight: When you draw a new hand of cards at the end of this turn, draw three extra cards.'] },
      ],
    },
  ],
};

/** A registry reader exposing the four mock sets above. */
const REGISTRY = {
  getSet: (abbr: string) => {
    if (abbr === 'ca75') {
      return CA75_SET;
    }
    if (abbr === 'rlmk') {
      return RLMK_SET;
    }
    if (abbr === 'co2e') {
      return CO2E_SET;
    }
    if (abbr === 'core') {
      return CORE_SET;
    }
    return undefined;
  },
};

/**
 * A setup config selecting the given villain groups and mastermind.
 *
 * @param villainGroupIds - The `<setAbbr>/<groupSlug>` villain groups.
 * @param mastermindId - The `<setAbbr>/<mastermindSlug>` mastermind.
 */
function makeConfig(villainGroupIds: string[], mastermindId: string): MatchSetupConfig {
  return {
    schemeId: 'core/midtown-bank-robbery',
    mastermindId,
    villainGroupIds,
    henchmanGroupIds: ['core/doombot-legion'],
    heroDeckIds: ['core/spider-man'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };
}

describe('buildCardAbomination (WP-815 / D-24747)', () => {
  it('T15: ca75 Zola setup flags Zolandia / Doughboy / Man-Fish copies and Arnim Zola — exactly 7 keys', () => {
    const result = buildCardAbomination(
      REGISTRY,
      makeConfig(['ca75/zolas-creations'], 'ca75/arnim-zola'),
      'ca75/arnim-zola',
      'ca75-mastermind-arnim-zola-arnim-zola' as CardExtId,
    );
    assert.deepStrictEqual(result, {
      'ca75-villain-zolas-creations-captain-zolandia-00': 'abomination',
      'ca75-villain-zolas-creations-captain-zolandia-01': 'abomination',
      'ca75-villain-zolas-creations-doughboy-00': 'abomination',
      'ca75-villain-zolas-creations-doughboy-01': 'abomination',
      'ca75-villain-zolas-creations-man-fish-00': 'abomination',
      'ca75-villain-zolas-creations-man-fish-01': 'abomination',
      'ca75-mastermind-arnim-zola-arnim-zola': 'ultimate-abomination',
    });
    assert.equal(Object.keys(result).length, 7);
  });

  it('T16: rlmk Inhuman Rebellion + Maximus — 9 keys, The Unspoken doubled, no epic face', () => {
    const result = buildCardAbomination(
      REGISTRY,
      makeConfig(['rlmk/inhuman-rebellion'], 'rlmk/maximus-the-mad'),
      'rlmk/maximus-the-mad',
      'rlmk-mastermind-maximus-the-mad-maximus-the-mad' as CardExtId,
    );
    assert.deepStrictEqual(result, {
      'rlmk-villain-inhuman-rebellion-lineage-00': 'abomination',
      'rlmk-villain-inhuman-rebellion-lineage-01': 'abomination',
      'rlmk-villain-inhuman-rebellion-omega-00': 'abomination',
      'rlmk-villain-inhuman-rebellion-omega-01': 'abomination',
      'rlmk-villain-inhuman-rebellion-lash-00': 'abomination',
      'rlmk-villain-inhuman-rebellion-lash-01': 'abomination',
      'rlmk-villain-inhuman-rebellion-the-unspoken-00': 'double-abomination',
      'rlmk-villain-inhuman-rebellion-the-unspoken-01': 'double-abomination',
      'rlmk-mastermind-maximus-the-mad-maximus-the-mad': 'double-highest-abomination',
    });
    assert.equal(Object.keys(result).length, 9);
  });

  it('T17: co2e Radiation + Doctor Doom — exactly the 2 sentence-printed Abomination copies', () => {
    const result = buildCardAbomination(
      REGISTRY,
      makeConfig(['co2e/radiation'], 'co2e/doctor-doom'),
      'co2e/doctor-doom',
      'co2e-mastermind-doctor-doom-doctor-doom' as CardExtId,
    );
    assert.deepStrictEqual(result, {
      'co2e-villain-radiation-abomination-00': 'abomination',
      'co2e-villain-radiation-abomination-01': 'abomination',
    });
  });

  it('keys the mastermind only by the baseCardId it is given (an epic base id flags only that face)', () => {
    const result = buildCardAbomination(
      REGISTRY,
      makeConfig([], 'rlmk/maximus-the-mad'),
      'rlmk/maximus-the-mad',
      'rlmk-mastermind-maximus-the-mad-epic-maximus-the-mad' as CardExtId,
    );
    assert.deepStrictEqual(result, {
      'rlmk-mastermind-maximus-the-mad-epic-maximus-the-mad': 'double-highest-abomination',
    });
  });

  it('T18: the core sentinel config and a registry without getSet yield an empty map', () => {
    assert.deepStrictEqual(
      buildCardAbomination(
        REGISTRY,
        makeConfig(['core/brotherhood'], 'core/dr-doom'),
        'core/dr-doom',
        'core-mastermind-dr-doom-dr-doom' as CardExtId,
      ),
      {},
    );
    assert.deepStrictEqual(
      buildCardAbomination(
        {},
        makeConfig(['ca75/zolas-creations'], 'ca75/arnim-zola'),
        'ca75/arnim-zola',
        'ca75-mastermind-arnim-zola-arnim-zola' as CardExtId,
      ),
      {},
    );
  });

  it('T18: setup omits G.cardAbomination when the builder returns an empty map', () => {
    const gameState = buildInitialGameState(
      makeConfig(['core/brotherhood'], 'core/dr-doom'),
      makeCardRegistryReader(),
      makeMockCtx({ numPlayers: 2 }),
    );
    assert.equal(Object.prototype.hasOwnProperty.call(gameState, 'cardAbomination'), false);
  });

  // why: buildCardAbomination builds the mastermind key from its own id template, while
  // setup passes it buildMastermindState's baseCardId. Running the real setup path (with
  // listSets + getSet, so buildMastermindState resolves the ca75 base face instead of
  // falling back to the qualified id) catches drift between the two templates.
  it('setup populates G.cardAbomination for ca75 Zola and keys G.mastermind.baseCardId as ultimate-abomination', () => {
    const gameState = buildInitialGameState(
      makeConfig(['ca75/zolas-creations'], 'ca75/arnim-zola'),
      makeCardRegistryReader({ listSets: () => [{ abbr: 'ca75' }], getSet: REGISTRY.getSet }),
      makeMockCtx({ numPlayers: 2 }),
    );
    assert.equal(gameState.mastermind.baseCardId, 'ca75-mastermind-arnim-zola-arnim-zola');
    assert.ok(gameState.cardAbomination !== undefined, 'G.cardAbomination is present');
    assert.equal(Object.keys(gameState.cardAbomination).length, 7);
    assert.equal(gameState.cardAbomination[gameState.mastermind.baseCardId], 'ultimate-abomination');
  });
});
