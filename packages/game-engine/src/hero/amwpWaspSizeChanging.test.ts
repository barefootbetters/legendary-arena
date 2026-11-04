/**
 * amwp Wasp + Janet van Dyne Size-Changing lines parse like the rest of the corpus.
 *
 * Every other Size-Changing line (the other amwp heroes, antm, chmp, cvwr) carries the
 * `[keyword:Size-Changing]` marker, which the parser (D-24074) turns into a granted-class list.
 * Wasp's and Janet van Dyne's lines were plain text ("Size-Changing [hc:ranged]"), so the bare
 * `[hc:ranged]` parsed as a class gate with no effect: an `onPlay` `gate-only` hollow, logged in
 * Jeff's 2026-11-02 match on Follow my Lead and Flitting Sting. The committed amwp base now
 * carries the marker on those lines.
 *
 * "Microscopic Size-Changing" is a separate rulebook keyword whose per-icon recruit discount is
 * unimplemented (deferred in D-24074). Those lines now carry `[keyword:Microscopic Size-Changing]`
 * like the other amwp heroes, and so record the honest `microscopic-size-changing` marker
 * instead of a misleading `gate-only` class gate.
 *
 * Builds the real hooks from the committed data/cards/amwp.json. No boardgame.io imports.
 * node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import type { MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';

// why: resolve the repo-root data directory from this test's own location (the
// ca75CountScaledHeroLines.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

/**
 * Builds the real hooks for one amwp hero deck from the committed card data.
 *
 * @param heroSlug - The amwp hero slug.
 * @returns Every hook the hero deck produces.
 */
function buildAmwpHeroHooks(heroSlug: string): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'amwp.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'amwp' ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: [`amwp/${heroSlug}`] } as unknown as MatchConfiguration);
}

/**
 * Returns the hook built from the first ability line of a card's first copy.
 *
 * @param hooks - The hero deck's hooks.
 * @param cardSlug - The card slug.
 * @returns The first copy's abilities[0] hook.
 */
function firstLineHook(hooks: HeroAbilityHook[], cardSlug: string): HeroAbilityHook {
  const firstHook = hooks.find((hook) => hook.cardId.includes(`/${cardSlug}#`));
  assert.ok(firstHook !== undefined, `the amwp data builds a hook for ${cardSlug}`);
  return firstHook;
}

const SIZE_CHANGING_LINES: { heroSlug: string; cardSlug: string; grantedClass: string }[] = [
  { heroSlug: 'wasp', cardSlug: 'follow-my-lead', grantedClass: 'ranged' },
  { heroSlug: 'wasp', cardSlug: 'flitting-sting', grantedClass: 'ranged' },
  { heroSlug: 'wasp', cardSlug: 'master-physicist', grantedClass: 'tech' },
  { heroSlug: 'wasp', cardSlug: 'positive-ions', grantedClass: 'ranged' },
  { heroSlug: 'janet-van-dyne', cardSlug: 'wasp-of-another-generation', grantedClass: 'covert' },
];

const MICROSCOPIC_LINES: { heroSlug: string; cardSlug: string }[] = [
  { heroSlug: 'wasp', cardSlug: 'infiltrate' },
  { heroSlug: 'wasp', cardSlug: 'hope-returns' },
  { heroSlug: 'janet-van-dyne', cardSlug: 'subatomic-size' },
];

describe('amwp Wasp / Janet van Dyne Size-Changing lines (D-24074 marker parity)', () => {
  for (const line of SIZE_CHANGING_LINES) {
    it(`${line.heroSlug}/${line.cardSlug} line 0 grants ${line.grantedClass} with no class gate and no hollow`, () => {
      const hook = firstLineHook(buildAmwpHeroHooks(line.heroSlug), line.cardSlug);
      assert.deepEqual(hook.sizeChangingClasses, [line.grantedClass], 'the [hc:X] token is the granted class');
      assert.ok((hook.keywords ?? []).includes('size-changing'), 'size-changing resolves as a keyword');
      assert.equal(
        (hook.conditions ?? []).some((condition) => condition.type === 'heroClassMatch'),
        false,
        'the [hc:X] token is not parsed as a play gate',
      );
      assert.equal(hook.unresolvedMarkers, undefined, 'no gate-only / parse-unrecognized hollow');
    });
  }

  for (const line of MICROSCOPIC_LINES) {
    it(`${line.heroSlug}/${line.cardSlug} line 0 records the honest microscopic-size-changing marker`, () => {
      const hook = firstLineHook(buildAmwpHeroHooks(line.heroSlug), line.cardSlug);
      assert.deepEqual(hook.unresolvedMarkers, ['microscopic-size-changing']);
      assert.equal(hook.effects, undefined, 'no effect is fabricated for the unimplemented keyword');
    });
  }
});
