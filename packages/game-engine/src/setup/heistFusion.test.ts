/**
 * Heist parse (WP-865 / D-24808).
 *
 * Ten Ant-Man and the Wasp hero lines carry a Heist ability. Before WP-865, six paid out on every
 * play and four did nothing. These tests parse the COMMITTED data/cards/amwp.json through a getSet
 * stub (the D-24746 playedOtherCardsThreshold.test.ts pattern) and pin the locked hook shapes:
 * the six allowlisted cards fuse into one `heist` hook carrying their inner effects, and the other
 * four Heist lines are honest `heist` hollows with no effect.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from './heroAbility.setup.js';
import type { MatchConfiguration } from '../types.js';
import type { HeroAbilityHook, HeroEffectDescriptor } from '../rules/heroAbility.types.js';

/** Every amwp hero deck that prints a Heist line. */
const HEIST_HERO_DECKS = ['amwp/scott-lang-cat-burglar', 'amwp/ant-man', 'amwp/wasp', 'amwp/ant-army'];

/** One allowlisted card: its first-copy prefix, its Heist line index, and its locked inner effects. */
interface FusedCard {
  cardPrefix: string;
  heistLineIndex: number;
  heistEffects: HeroEffectDescriptor[];
}

const FUSED_CARDS: readonly FusedCard[] = [
  { cardPrefix: 'amwp/scott-lang-cat-burglar/petty-larceny#', heistLineIndex: 0, heistEffects: [{ type: 'recruit', magnitude: 2 }] },
  { cardPrefix: 'amwp/scott-lang-cat-burglar/anything-for-cassie#', heistLineIndex: 1, heistEffects: [{ type: 'rescue', magnitude: 1 }] },
  { cardPrefix: 'amwp/scott-lang-cat-burglar/shocking-support#', heistLineIndex: 0, heistEffects: [{ type: 'attack', magnitude: 2 }] },
  { cardPrefix: 'amwp/wasp/infiltrate#', heistLineIndex: 2, heistEffects: [{ type: 'attack', magnitude: 3 }] },
  { cardPrefix: 'amwp/ant-man/tiny-little-risk#', heistLineIndex: 1, heistEffects: [{ type: 'draw', magnitude: 2 }] },
  { cardPrefix: 'amwp/ant-army/up-the-ante#', heistLineIndex: 0, heistEffects: [{ type: 'draw', magnitude: 1 }] },
];

/** One non-allowlisted Heist line: its first-copy prefix and its Heist line index. */
interface HollowCard {
  cardPrefix: string;
  heistLineIndex: number;
}

const HOLLOW_CARDS: readonly HollowCard[] = [
  { cardPrefix: 'amwp/scott-lang-cat-burglar/the-big-score#', heistLineIndex: 0 },
  { cardPrefix: 'amwp/scott-lang-cat-burglar/putting-a-crew-together#', heistLineIndex: 0 },
  { cardPrefix: 'amwp/scott-lang-cat-burglar/x-con-security-van#', heistLineIndex: 0 },
  { cardPrefix: 'amwp/ant-army/revolutionary-anthem#', heistLineIndex: 2 },
];

/**
 * Builds every hook for the four Heist hero decks from the committed amwp card data.
 *
 * @returns The hooks buildHeroAbilityHooks produces.
 */
function buildAmwpHooks(): HeroAbilityHook[] {
  // why: resolve the repo-root data file from this test's own location (the
  // playedOtherCardsThreshold.test.ts precedent), so the test parses what ships.
  const here = dirname(fileURLToPath(import.meta.url));
  const setData = JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', 'amwp.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'amwp' ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: HEIST_HERO_DECKS } as unknown as MatchConfiguration);
}

/**
 * Returns the hooks of a card's first copy, in line order.
 *
 * @param hooks - Every built hook.
 * @param cardPrefix - The card's id prefix (`{set}/{hero}/{card}#`).
 * @returns The first copy's hooks.
 */
function firstCopyHooks(hooks: HeroAbilityHook[], cardPrefix: string): HeroAbilityHook[] {
  const firstCopyId = hooks.find((hook) => hook.cardId.startsWith(cardPrefix))?.cardId;
  assert.ok(firstCopyId !== undefined, `${cardPrefix} must build at least one hook`);
  return hooks.filter((hook) => hook.cardId === firstCopyId);
}

/**
 * Whether a list of effects holds a 'heist' descriptor at any depth of heistEffects.
 *
 * @param effects - The effects to scan.
 * @returns true when a nested 'heist' descriptor exists.
 */
function containsHeistDescriptor(effects: readonly HeroEffectDescriptor[]): boolean {
  for (const effect of effects) {
    if (effect.type === 'heist') {
      return true;
    }
    if (effect.heistEffects !== undefined && containsHeistDescriptor(effect.heistEffects)) {
      return true;
    }
  }
  return false;
}

describe('WP-865 heist parse: the six allowlisted cards fuse into one heist hook', () => {
  const hooks = buildAmwpHooks();

  for (const card of FUSED_CARDS) {
    it(`${card.cardPrefix} line ${card.heistLineIndex} is one heist hook carrying the locked inner effects`, () => {
      const cardHooks = firstCopyHooks(hooks, card.cardPrefix);
      // why: the Heist hook is emitted at the Heist line's own index, so hook order follows line order.
      const heistHook = cardHooks[card.heistLineIndex];
      assert.ok(heistHook !== undefined, 'a hook exists at the Heist line index');
      assert.equal(heistHook.timing, 'onPlay');
      assert.deepEqual(heistHook.keywords, ['heist']);
      assert.deepEqual(heistHook.effects, [{ type: 'heist', heistEffects: card.heistEffects }]);
      assert.equal(heistHook.unresolvedMarkers, undefined, 'the fused hook is not hollow');
      assert.equal(containsHeistDescriptor(card.heistEffects), false, 'heistEffects never holds a heist descriptor');
    });

    it(`${card.cardPrefix} grants nothing at play from any other hook`, () => {
      const cardHooks = firstCopyHooks(hooks, card.cardPrefix);
      for (const hook of cardHooks) {
        if (hook.keywords.includes('heist')) {
          continue;
        }
        for (const effect of hook.effects ?? []) {
          assert.notEqual(effect.type, 'heist', 'only the fused hook carries heist');
        }
      }
      const heistHooks = cardHooks.filter((hook) => hook.keywords.includes('heist'));
      assert.equal(heistHooks.length, 1, 'exactly one heist hook per copy');
    });
  }
});

describe('WP-865 heist parse: the other four Heist lines are honest hollows', () => {
  const hooks = buildAmwpHooks();

  for (const card of HOLLOW_CARDS) {
    it(`${card.cardPrefix} line ${card.heistLineIndex} has no effect, no keyword and a heist marker`, () => {
      const hollowHook = firstCopyHooks(hooks, card.cardPrefix)[card.heistLineIndex];
      assert.ok(hollowHook !== undefined, 'a hook exists at the Heist line index');
      assert.deepEqual(hollowHook.keywords, []);
      assert.equal(hollowHook.effects, undefined, 'the hollow grants nothing at play');
      assert.deepEqual(hollowHook.unresolvedMarkers, ['heist']);
    });
  }

  it("Revolutionary Anthem's Antics line keeps its conditional +2 attack", () => {
    const anthemHooks = firstCopyHooks(hooks, 'amwp/ant-army/revolutionary-anthem#');
    const anticsHook = anthemHooks[1];
    assert.ok(anticsHook !== undefined, 'the Antics line builds a hook');
    assert.deepEqual(anticsHook.keywords, ['attack', 'conditional']);
    assert.deepEqual(anticsHook.effects, [{ type: 'attack', magnitude: 2 }]);
    assert.equal(anticsHook.conditions?.length, 1, 'the Antics line keeps its condition');
  });
});
