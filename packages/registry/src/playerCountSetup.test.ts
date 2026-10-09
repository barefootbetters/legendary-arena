/**
 * playerCountSetup.test.ts — WP-370 / D-24165.
 *
 * Drift-locks the canonical per-player-count setup table against the Marvel
 * Legendary rules and covers the pure lookup + composition-check helpers.
 * node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PLAYER_COUNT_SETUP,
  getPlayerCountSetup,
  checkPlayerCountComposition,
  resolveEffectiveHeroCount,
  resolveEffectiveHenchmenCount,
  SCHEMES_WITH_EXTRA_HENCHMAN_GROUP,
  SCHEME_HERO_COUNT_RULES,
} from './playerCountSetup.js';

/** The core scheme whose printed setup says "Add an extra Henchman group" (D-24666). */
const NEGATIVE_ZONE_PRISON_BREAKOUT = 'core/negative-zone-prison-breakout';

/** A scheme with no Henchman-count override. */
const MIDTOWN_BANK_ROBBERY = 'core/midtown-bank-robbery';

/** The scheme whose printed setup requires 6 heroes (D-24337). */
const SECRET_INVASION = 'core/secret-invasion-of-the-skrull-shapeshifters';

/** The scheme whose printed setup requires only 4 heroes at 2 players (D-24385). */
const CIVIL_WAR = 'core/super-hero-civil-war';

describe('PLAYER_COUNT_SETUP table', () => {
  it('locks the exact rules values for player counts 1–5', () => {
    // why: literal drift-lock — the numbers here ARE the rules table. If the
    // constant drifts, this test fails loudly rather than shipping a wrong
    // board. villain groups / henchmen groups / villain-deck bystanders / heroes.
    assert.deepEqual(PLAYER_COUNT_SETUP, {
      1: { villainGroupCount: 1, henchmenGroupCount: 1, villainDeckBystanderCount: 1, heroCount: 3 },
      2: { villainGroupCount: 2, henchmenGroupCount: 1, villainDeckBystanderCount: 2, heroCount: 5 },
      3: { villainGroupCount: 3, henchmenGroupCount: 1, villainDeckBystanderCount: 8, heroCount: 5 },
      4: { villainGroupCount: 3, henchmenGroupCount: 2, villainDeckBystanderCount: 8, heroCount: 5 },
      5: { villainGroupCount: 4, henchmenGroupCount: 2, villainDeckBystanderCount: 12, heroCount: 6 },
    });
  });

  it('has exactly the player counts 1 through 5', () => {
    assert.deepEqual(Object.keys(PLAYER_COUNT_SETUP), ['1', '2', '3', '4', '5']);
  });
});

describe('getPlayerCountSetup', () => {
  it('returns the row for each supported player count', () => {
    assert.equal(getPlayerCountSetup(3)?.villainDeckBystanderCount, 8);
    assert.equal(getPlayerCountSetup(5)?.heroCount, 6);
    assert.equal(getPlayerCountSetup(1)?.villainGroupCount, 1);
  });

  it('returns undefined for a player count outside 1–5', () => {
    assert.equal(getPlayerCountSetup(0), undefined);
    assert.equal(getPlayerCountSetup(6), undefined);
    assert.equal(getPlayerCountSetup(2.5), undefined);
  });
});

describe('checkPlayerCountComposition', () => {
  it('returns no mismatches when the composition matches the player count', () => {
    const mismatches = checkPlayerCountComposition({
      playerCount: 2,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5'],
    });
    assert.deepEqual(mismatches, []);
  });

  it('reports each wrong count with required and actual values', () => {
    const mismatches = checkPlayerCountComposition({
      playerCount: 3,
      villainGroupIds: ['a', 'b'],          // requires 3
      henchmanGroupIds: ['h'],              // requires 1 — ok
      heroDeckIds: ['1', '2', '3'],         // requires 5
    });
    const byField = Object.fromEntries(mismatches.map((each) => [each.field, each]));
    assert.equal(mismatches.length, 2);
    assert.deepEqual(
      { required: byField.villainGroupIds.required, actual: byField.villainGroupIds.actual },
      { required: 3, actual: 2 },
    );
    assert.deepEqual(
      { required: byField.heroDeckIds.required, actual: byField.heroDeckIds.actual },
      { required: 5, actual: 3 },
    );
    assert.equal(byField.henchmanGroupIds, undefined);
  });

  it('returns no mismatches when the player count is out of range (cannot be judged)', () => {
    const mismatches = checkPlayerCountComposition({
      playerCount: 9,
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    });
    assert.deepEqual(mismatches, []);
  });

  it('requires 6 heroes for Secret Invasion — a 5-hero loadout is a mismatch', () => {
    // why: D-24337 — the scheme's "6 Heroes" clause. A standard 5-hero 2p loadout
    // is correct for every OTHER scheme but wrong for Secret Invasion.
    const mismatches = checkPlayerCountComposition({
      playerCount: 2,
      schemeId: SECRET_INVASION,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5'], // requires 6 for this scheme
    });
    const byField = Object.fromEntries(mismatches.map((each) => [each.field, each]));
    assert.deepEqual(
      { required: byField.heroDeckIds.required, actual: byField.heroDeckIds.actual },
      { required: 6, actual: 5 },
    );
  });

  it('passes a 6-hero Secret Invasion loadout', () => {
    const mismatches = checkPlayerCountComposition({
      playerCount: 2,
      schemeId: SECRET_INVASION,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5', '6'],
    });
    assert.deepEqual(mismatches, []);
  });

  it('requires only 4 heroes for Super Hero Civil War at 2p — a 5-hero loadout is a mismatch', () => {
    // why: D-24385 — the scheme's "4 Heroes at 2p" clause lowers the base 5 to 4. A
    // standard 5-hero 2p loadout is correct for every OTHER scheme but wrong here.
    const mismatchAt5 = checkPlayerCountComposition({
      playerCount: 2,
      schemeId: CIVIL_WAR,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5'], // requires 4 for this scheme at 2p
    });
    const byField = Object.fromEntries(mismatchAt5.map((each) => [each.field, each]));
    assert.deepEqual(
      { required: byField.heroDeckIds.required, actual: byField.heroDeckIds.actual },
      { required: 4, actual: 5 },
    );
    // A 4-hero 2p Civil War loadout has no mismatch.
    const cleanAt4 = checkPlayerCountComposition({
      playerCount: 2,
      schemeId: CIVIL_WAR,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4'],
    });
    assert.deepEqual(cleanAt4, []);
  });

  it('leaves the 5-hero requirement intact for a non-Secret-Invasion scheme (and when no schemeId is given)', () => {
    const withOtherScheme = checkPlayerCountComposition({
      playerCount: 2,
      schemeId: 'core/some-other-scheme',
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5'],
    });
    assert.deepEqual(withOtherScheme, []);
    const withoutScheme = checkPlayerCountComposition({
      playerCount: 2,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5'],
    });
    assert.deepEqual(withoutScheme, []);
  });
});

describe('resolveEffectiveHeroCount', () => {
  it('returns 6 for Secret Invasion at every player count (flat "6 Heroes")', () => {
    // why: 2/3/4p base 5 → 6; 5p base 6 → 6 (unchanged); solo-1p base 3 → 6.
    assert.equal(resolveEffectiveHeroCount(SECRET_INVASION, 1, 3), 6);
    assert.equal(resolveEffectiveHeroCount(SECRET_INVASION, 2, 5), 6);
    assert.equal(resolveEffectiveHeroCount(SECRET_INVASION, 3, 5), 6);
    assert.equal(resolveEffectiveHeroCount(SECRET_INVASION, 4, 5), 6);
    assert.equal(resolveEffectiveHeroCount(SECRET_INVASION, 5, 6), 6);
  });

  it('returns 4 for Super Hero Civil War at exactly 2 players only (its "4 Heroes at 2p")', () => {
    // why: D-24385 — the printed "If only 2 players, use only 4 Heroes". A per-count
    // override: exactly 4 at 2p (base 5 → 4), but the base is unchanged at every other
    // count (1p 3; 3p/4p 5; 5p 6). Exactly 4, not a range — a 5-hero 2p loadout is invalid.
    assert.equal(resolveEffectiveHeroCount(CIVIL_WAR, 2, 5), 4);
    assert.equal(resolveEffectiveHeroCount(CIVIL_WAR, 1, 3), 3);
    assert.equal(resolveEffectiveHeroCount(CIVIL_WAR, 3, 5), 5);
    assert.equal(resolveEffectiveHeroCount(CIVIL_WAR, 4, 5), 5);
    assert.equal(resolveEffectiveHeroCount(CIVIL_WAR, 5, 6), 6);
  });

  it('returns the base count unchanged for any other scheme', () => {
    assert.equal(resolveEffectiveHeroCount('core/some-other-scheme', 2, 5), 5);
    assert.equal(resolveEffectiveHeroCount('', 1, 3), 3);
    assert.equal(resolveEffectiveHeroCount('core/legacy-virus-the', 5, 6), 6);
  });

  it('never mutates the base PLAYER_COUNT_SETUP table', () => {
    resolveEffectiveHeroCount(SECRET_INVASION, 2, PLAYER_COUNT_SETUP[2].heroCount);
    assert.equal(PLAYER_COUNT_SETUP[2].heroCount, 5);
  });
});

describe('SCHEMES_WITH_EXTRA_HENCHMAN_GROUP (D-24666)', () => {
  it('lists exactly the three "Add an extra Henchman group" schemes, in order', () => {
    // why: D-24372 runtime drift pin — the closed list is a locked value.
    assert.deepEqual(
      [...SCHEMES_WITH_EXTRA_HENCHMAN_GROUP],
      [
        'core/negative-zone-prison-breakout',
        'msp1/asgard-under-siege',
        'vnom/invasion-of-the-venom-symbiotes',
      ],
    );
  });
});

describe('resolveEffectiveHenchmenCount (D-24666)', () => {
  it('returns base + 1 (2/2/2/3/3) for every listed scheme at 1–5 players', () => {
    for (const schemeId of SCHEMES_WITH_EXTRA_HENCHMAN_GROUP) {
      const effectiveCounts: number[] = [];
      for (const playerCount of [1, 2, 3, 4, 5] as const) {
        effectiveCounts.push(
          resolveEffectiveHenchmenCount(
            schemeId,
            playerCount,
            PLAYER_COUNT_SETUP[playerCount].henchmenGroupCount,
          ),
        );
      }
      assert.deepEqual(effectiveCounts, [2, 2, 2, 3, 3], `wrong effective counts for ${schemeId}`);
    }
  });

  it('returns the base count unchanged for an unlisted or empty scheme', () => {
    assert.equal(resolveEffectiveHenchmenCount(MIDTOWN_BANK_ROBBERY, 1, 1), 1);
    assert.equal(resolveEffectiveHenchmenCount(MIDTOWN_BANK_ROBBERY, 4, 2), 2);
    assert.equal(resolveEffectiveHenchmenCount('', 5, 2), 2);
    assert.equal(resolveEffectiveHenchmenCount(SECRET_INVASION, 2, 1), 1);
  });

  it('never mutates the base PLAYER_COUNT_SETUP table', () => {
    resolveEffectiveHenchmenCount(NEGATIVE_ZONE_PRISON_BREAKOUT, 1, PLAYER_COUNT_SETUP[1].henchmenGroupCount);
    assert.equal(PLAYER_COUNT_SETUP[1].henchmenGroupCount, 1);
  });
});

/**
 * The 26 printed Hero Deck count rows (D-24672), in source order, each with its
 * locked effective hero count at 1..5 players (base 3/5/5/5/6). Written-out
 * literals — never computed from the rule under test.
 */
const EXPECTED_HERO_COUNTS_BY_SCHEME: readonly (readonly [string, readonly number[]])[] = [
  ['core/secret-invasion-of-the-skrull-shapeshifters', [6, 6, 6, 6, 6]],
  ['core/super-hero-civil-war', [3, 4, 5, 5, 6]],
  ['msp1/enslave-minds-with-the-chitauri-scepter', [6, 6, 6, 6, 6]],
  ['msp1/super-hero-civil-war', [3, 4, 5, 5, 6]],
  ['co2e/super-hero-civil-war', [3, 4, 5, 5, 6]],
  ['co2e/secret-invasion-of-the-skrull-shapeshifters', [4, 6, 6, 6, 7]],
  ['2099/subjugate-earth-with-mega-corporations', [4, 6, 6, 6, 7]],
  ['2099/befoul-earth-into-a-polluted-wasteland', [4, 6, 6, 6, 7]],
  ['cosm/contest-of-champions-the', [4, 6, 6, 6, 7]],
  ['cosm/annihilation-conquest', [4, 6, 6, 6, 7]],
  ['shld/hydra-helicarriers-hunt-heroes', [4, 6, 6, 6, 7]],
  ['wpnx/go-after-heroes-loved-ones', [4, 6, 6, 6, 7]],
  ['mdns/wager-at-blackjack-for-heroes-souls', [5, 7, 7, 7, 8]],
  ['antm/age-of-ultron', [3, 5, 5, 6, 7]],
  ['bkwd/frame-heroes-for-murder', [6, 6, 6, 6, 6]],
  ['dkcy/detonate-the-helicarrier', [6, 6, 6, 6, 6]],
  ['rvlt/house-of-m', [6, 6, 6, 6, 6]],
  ['cvwr/avengers-vs-x-men', [6, 6, 6, 6, 6]],
  ['chmp/divide-and-conquer', [7, 7, 7, 7, 7]],
  ['cvwr/reveal-heroes-secret-identities', [7, 7, 7, 7, 7]],
  ['wwhk/break-the-planet-asunder', [7, 7, 7, 7, 7]],
  ['mgtg/star-lords-awesome-mix-tape', [7, 7, 7, 7, 7]],
  ['ca75/go-back-in-time-to-slay-heroes-ancestors', [8, 8, 8, 8, 8]],
  ['dead/deadpool-kills-the-marvel-universe', [3, 4, 5, 5, 6]],
  ['cvwr/epic-super-hero-civil-war', [4, 5, 5, 5, 6]],
  ['cosm/destroy-the-nova-corps', [5, 5, 5, 5, 6]],
];

/**
 * Returns a scheme's effective hero counts at 1..5 players from the base table.
 *
 * @param schemeId - The scheme ext_id to resolve.
 * @returns The five effective hero counts, 1p first.
 */
function effectiveHeroCountsAtEveryPlayerCount(schemeId: string): number[] {
  const effectiveCounts: number[] = [];
  for (const playerCount of [1, 2, 3, 4, 5] as const) {
    effectiveCounts.push(
      resolveEffectiveHeroCount(schemeId, playerCount, PLAYER_COUNT_SETUP[playerCount].heroCount),
    );
  }
  return effectiveCounts;
}

describe('SCHEME_HERO_COUNT_RULES (D-24672)', () => {
  it('holds exactly the 26 printed Hero Deck count rows, in order', () => {
    // why: D-24372 runtime drift pin — the closed table is a locked value.
    assert.deepEqual(
      Object.keys(SCHEME_HERO_COUNT_RULES),
      EXPECTED_HERO_COUNTS_BY_SCHEME.map((entry) => entry[0]),
    );
    assert.equal(Object.keys(SCHEME_HERO_COUNT_RULES).length, 26);
  });

  it('names only schemes that exist in data/cards', () => {
    // why: fail-loud against a scheme-id typo — a mistyped key would silently
    // resolve to the base count and the printed rule would never apply.
    const cardsDirectory = join(process.cwd(), '..', '..', 'data', 'cards');
    for (const schemeId of Object.keys(SCHEME_HERO_COUNT_RULES)) {
      const [setAbbr, schemeSlug] = schemeId.split('/');
      const setData = JSON.parse(
        readFileSync(join(cardsDirectory, `${setAbbr}.json`), 'utf8'),
      ) as { schemes?: { slug: string }[] };
      const schemeSlugs = (setData.schemes ?? []).map((scheme) => scheme.slug);
      assert.ok(
        schemeSlugs.includes(schemeSlug ?? ''),
        `SCHEME_HERO_COUNT_RULES names "${schemeId}", which is not a scheme in data/cards/${setAbbr}.json (typo?).`,
      );
    }
  });
});

describe('resolveEffectiveHeroCount — printed Hero Deck count rows (D-24672)', () => {
  it('returns each row\'s locked effective count at 1–5 players', () => {
    for (const [schemeId, expectedCounts] of EXPECTED_HERO_COUNTS_BY_SCHEME) {
      assert.deepEqual(
        effectiveHeroCountsAtEveryPlayerCount(schemeId),
        expectedCounts,
        `wrong effective hero counts for ${schemeId}`,
      );
    }
  });

  it('returns the base count for an unlisted scheme and for an empty id', () => {
    assert.deepEqual(effectiveHeroCountsAtEveryPlayerCount('core/midtown-bank-robbery'), [3, 5, 5, 5, 6]);
    assert.deepEqual(effectiveHeroCountsAtEveryPlayerCount(''), [3, 5, 5, 5, 6]);
  });

  it('keeps msis The Time Heist at the base count (deliberately not a row)', () => {
    assert.deepEqual(effectiveHeroCountsAtEveryPlayerCount('msis/the-time-heist'), [3, 5, 5, 5, 6]);
  });

  it('resolves prototype keys such as constructor and __proto__ to the base count', () => {
    // why: guards the own-property lookup — an inherited Object.prototype member
    // must never be read as a rule.
    assert.deepEqual(effectiveHeroCountsAtEveryPlayerCount('constructor'), [3, 5, 5, 5, 6]);
    assert.deepEqual(effectiveHeroCountsAtEveryPlayerCount('__proto__'), [3, 5, 5, 5, 6]);
    assert.deepEqual(effectiveHeroCountsAtEveryPlayerCount('toString'), [3, 5, 5, 5, 6]);
  });
});

describe('checkPlayerCountComposition — printed Hero Deck counts (D-24672)', () => {
  /**
   * Builds a composition input with the given scheme, player count and hero count.
   */
  function heroInput(schemeId: string, playerCount: number, heroCount: number) {
    const heroDeckIds: string[] = [];
    for (let index = 0; index < heroCount; index += 1) {
      heroDeckIds.push(`hero${index}`);
    }
    const villainGroupIds: string[] = [];
    const villainGroupCount = getPlayerCountSetup(playerCount)?.villainGroupCount ?? 0;
    for (let index = 0; index < villainGroupCount; index += 1) {
      villainGroupIds.push(`v${index}`);
    }
    return { playerCount, schemeId, villainGroupIds, henchmanGroupIds: ['h'], heroDeckIds };
  }

  it('reports one heroDeckIds mismatch (required 6) for a 2p Annihilation: Conquest loadout with 5 heroes', () => {
    assert.deepEqual(checkPlayerCountComposition(heroInput('cosm/annihilation-conquest', 2, 5)), [
      { field: 'heroDeckIds', label: 'heroes', required: 6, actual: 5 },
    ]);
  });

  it('passes a 2p Annihilation: Conquest loadout with 6 heroes', () => {
    assert.deepEqual(checkPlayerCountComposition(heroInput('cosm/annihilation-conquest', 2, 6)), []);
  });

  it('reports one heroDeckIds mismatch (required 8) for a 1p Go Back in Time loadout with 3 heroes', () => {
    assert.deepEqual(
      checkPlayerCountComposition(heroInput('ca75/go-back-in-time-to-slay-heroes-ancestors', 1, 3)),
      [{ field: 'heroDeckIds', label: 'heroes', required: 8, actual: 3 }],
    );
  });
});

describe('checkPlayerCountComposition — extra Henchman group (D-24666)', () => {
  /**
   * Builds a 1-player composition input with the given scheme and Henchman-group count.
   */
  function soloInput(schemeId: string, henchmenGroupCount: number) {
    const henchmanGroupIds: string[] = [];
    for (let index = 0; index < henchmenGroupCount; index += 1) {
      henchmanGroupIds.push(`h${index}`);
    }
    return {
      playerCount: 1,
      schemeId,
      villainGroupIds: ['a'],
      henchmanGroupIds,
      heroDeckIds: ['1', '2', '3'],
    };
  }

  it('reports one henchmen mismatch (required 2) for a 1p NZPB loadout with 1 group', () => {
    const mismatches = checkPlayerCountComposition(soloInput(NEGATIVE_ZONE_PRISON_BREAKOUT, 1));
    assert.deepEqual(mismatches, [
      { field: 'henchmanGroupIds', label: 'henchmen groups', required: 2, actual: 1 },
    ]);
  });

  it('passes a 1p NZPB loadout with 2 groups', () => {
    assert.deepEqual(checkPlayerCountComposition(soloInput(NEGATIVE_ZONE_PRISON_BREAKOUT, 2)), []);
  });

  it('rejects a 1p NZPB loadout with 3 groups (exactly base + 1)', () => {
    const mismatches = checkPlayerCountComposition(soloInput(NEGATIVE_ZONE_PRISON_BREAKOUT, 3));
    assert.deepEqual(mismatches, [
      { field: 'henchmanGroupIds', label: 'henchmen groups', required: 2, actual: 3 },
    ]);
  });

  it('leaves a 1p Midtown loadout with 1 group clean', () => {
    assert.deepEqual(checkPlayerCountComposition(soloInput(MIDTOWN_BANK_ROBBERY, 1)), []);
  });
});
