/**
 * cvwr Squirrel Girl and Colleen Wing fortify on Escape (WP-873 / D-24818).
 *
 * Squirrel Girl prints "Escape: [keyword:Fortify] the Sidekick Stack. While it's fortified,
 * [rule:Sidekicks] can't be recruited or gained." and Colleen Wing "Escape: [keyword:Fortify]
 * the Mastermind. While it's fortified, the Mastermind can't be fought." Both lines now carry a
 * `[effect:fortify:<place>:<lock>]` marker. The escaped Villain leaves the Escape Pile and is
 * recorded in G.fortifications; the escape still counts.
 *
 * Builds the real hooks from the committed card data (run the marker overlay first) and drives
 * the escapes through performVillainReveal with a full City. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { performVillainReveal } from '../villainDeck/villainDeck.reveal.js';
import { executeVillainAbilities } from './villainEffects.execute.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { isMastermindFortified, isSidekickStackFortified } from '../board/fortify.logic.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader, makePlayerZones } from '../test/fixtureBuilders.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';

// why: resolve the repo-root data directory from this test's own location (the
// reenterSewers.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const EMPTY_REGISTRY: CardRegistryReader = { ...makeCardRegistryReader(), listCards: () => [] };
const ENTERING_VILLAIN = 'test-villain-entering-00' as CardExtId;
const CARRIED_BYSTANDER = 'test-bystander-carried-00' as CardExtId;
const FILLER = ['test-villain-a-00', 'test-villain-b-00', 'test-villain-c-00', 'test-villain-d-00'] as CardExtId[];
const SQUIRREL_GIRL_PREFIX = 'cvwr-villain-great-lakes-avengers-squirrel-girl-';
const COLLEEN_WING_PREFIX = 'cvwr-villain-heroes-for-hire-colleen-wing-';

/**
 * Builds the real villain hooks for cvwr Great Lakes Avengers and Heroes for Hire.
 *
 * @returns Every hook the two villain groups produce.
 */
function buildHooks(): VillainAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'cvwr.json'), 'utf8'));
  const registry = { getSet: (abbr: string) => (abbr === 'cvwr' ? setData : undefined) };
  const config = {
    villainGroupIds: ['cvwr/great-lakes-avengers', 'cvwr/heroes-for-hire'],
    henchmanGroupIds: [],
  } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(registry, config);
}

const HOOKS = buildHooks();

/**
 * Lists the distinct card instances whose id starts with a prefix, in hook order.
 *
 * @param prefix - The card-instance ext_id prefix.
 * @returns The distinct instance ids.
 */
function instancesOf(prefix: string): CardExtId[] {
  const ids: CardExtId[] = [];
  for (const hook of HOOKS) {
    if (hook.cardId.startsWith(prefix) && !ids.includes(hook.cardId)) {
      ids.push(hook.cardId);
    }
  }
  return ids;
}

const SQUIRREL_GIRLS = instancesOf(SQUIRREL_GIRL_PREFIX);
const COLLEEN_WINGS = instancesOf(COLLEEN_WING_PREFIX);

/**
 * A one-seat state whose City is full with `escaping` in the escape space and a Villain on top
 * of the Villain Deck, so the next reveal pushes `escaping` out.
 *
 * @param escaping - The Villain in the last City space.
 * @returns The game state.
 */
function makeState(escaping: CardExtId): LegendaryGameState {
  const config: MatchConfiguration = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 0,
  };
  const G = buildInitialGameState(config, EMPTY_REGISTRY, makeMockCtx({ numPlayers: 1 }));
  G.playerZones = { '0': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] } };
  G.city = [FILLER[0]!, FILLER[1]!, FILLER[2]!, FILLER[3]!, escaping];
  G.hq = [null, null, null, null, null];
  G.escapedPile = [];
  G.notableEvents = [];
  G.villainAttachedHeroes = {};
  G.attachedBystanders = {};
  G.villainAbilityHooks = HOOKS;
  G.villainDeck = { deck: [ENTERING_VILLAIN], discard: [] };
  G.villainDeckCardTypes = { [ENTERING_VILLAIN]: 'villain' };
  G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] = 0;
  const display: LegendaryGameState['cardDisplayData'] = { ...G.cardDisplayData };
  for (const squirrelGirl of SQUIRREL_GIRLS) {
    display[squirrelGirl] = { extId: squirrelGirl, name: 'Squirrel Girl', imageUrl: '', cost: 0 };
  }
  for (const colleenWing of COLLEEN_WINGS) {
    display[colleenWing] = { extId: colleenWing, name: 'Colleen Wing', imageUrl: '', cost: 0 };
  }
  G.cardDisplayData = display;
  return G;
}

/**
 * Builds the reveal context for the one seat.
 *
 * @returns The reveal context.
 */
function makeRevealContext(): RevealContext {
  return { random: makeMockCtx({ numPlayers: 1 }).random, ctx: { currentPlayer: '0', turn: 4 } };
}

/**
 * Returns every log line's text.
 *
 * @param G - The game state.
 * @returns The message texts in order.
 */
function logTexts(G: LegendaryGameState): string[] {
  const texts: string[] = [];
  for (const message of G.messages) {
    texts.push(message.text);
  }
  return texts;
}

const SQUIRREL_GIRL_FORTIFY_LINE =
  "Squirrel Girl fortifies the Sidekick Stack: Sidekicks can't be recruited or gained until a player fights Squirrel Girl.";

describe('WP-873 Fortify on Escape (real cvwr data, D-24818)', () => {
  it('the fixture has two copies of each Villain with a fortify onEscape hook', () => {
    assert.equal(SQUIRREL_GIRLS.length, 2);
    assert.equal(COLLEEN_WINGS.length, 2);
    for (const squirrelGirl of SQUIRREL_GIRLS) {
      const escapeHook = HOOKS.find((hook) => hook.cardId === squirrelGirl && hook.timing === 'onEscape');
      assert.ok(escapeHook !== undefined);
      assert.deepStrictEqual(escapeHook.effects, [
        { primitive: 'fortify', fortifyPlace: 'sidekick-stack', fortifyLock: 'no-recruit-or-gain' },
      ]);
    }
  });

  it('T9: Squirrel Girl escapes and fortifies the Sidekick Stack; the escape still counts', () => {
    const squirrelGirl = SQUIRREL_GIRLS[0]!;
    const G = makeState(squirrelGirl);
    performVillainReveal(G, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP);
    assert.deepStrictEqual(G.fortifications, {
      'sidekick-stack': { villainCardId: squirrelGirl, lock: 'no-recruit-or-gain' },
    });
    assert.equal(G.escapedPile.includes(squirrelGirl), false, 'she left the Escape Pile');
    assert.equal(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], 1, 'the escape counter still counts her');
    assert.equal(G.pendingEscapeProcedures?.length, 1, 'the owed HQ-KO procedure is still enqueued');
    assert.ok(logTexts(G).includes(SQUIRREL_GIRL_FORTIFY_LINE), logTexts(G).join(' | '));
    assert.equal(isSidekickStackFortified(G), true);
    const hollowsForHer = (G.diagnostics?.hollowEffects ?? []).filter(
      (record) => JSON.stringify(record).includes(squirrelGirl),
    );
    assert.deepStrictEqual(hollowsForHer, [], 'no unmarked-ability hollow is recorded for her');
  });

  it('T10: Colleen Wing escapes and fortifies the Mastermind', () => {
    const colleenWing = COLLEEN_WINGS[0]!;
    const G = makeState(colleenWing);
    performVillainReveal(G, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP);
    assert.deepStrictEqual(G.fortifications, {
      mastermind: { villainCardId: colleenWing, lock: 'no-fight' },
    });
    assert.equal(isMastermindFortified(G), true);
    assert.equal(G.escapedPile.includes(colleenWing), false);
    assert.ok(
      logTexts(G).includes(
        "Colleen Wing fortifies the Mastermind: the Mastermind can't be fought until a player fights Colleen Wing.",
      ),
    );
  });

  it('T11: the second copy escapes while the first fortifies and stays in the Escape Pile', () => {
    const first = SQUIRREL_GIRLS[0]!;
    const second = SQUIRREL_GIRLS[1]!;
    const G = makeState(second);
    G.fortifications = { 'sidekick-stack': { villainCardId: first, lock: 'no-recruit-or-gain' } };
    G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] = 1;
    performVillainReveal(G, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP);
    assert.deepStrictEqual(G.fortifications, {
      'sidekick-stack': { villainCardId: first, lock: 'no-recruit-or-gain' },
    });
    assert.ok(G.escapedPile.includes(second), 'the second copy stays in the Escape Pile');
    assert.equal(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], 2);
    assert.ok(
      logTexts(G).includes(
        "Squirrel Girl can't fortify the Sidekick Stack: Squirrel Girl already fortifies it, so Squirrel Girl stays in the Escape Pile.",
      ),
      logTexts(G).join(' | '),
    );
  });

  it('T12: a Bystander she carried stays in the Escape Pile; she does not', () => {
    const squirrelGirl = SQUIRREL_GIRLS[0]!;
    const G = makeState(squirrelGirl);
    G.attachedBystanders = { [squirrelGirl]: [CARRIED_BYSTANDER] };
    performVillainReveal(G, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP);
    assert.deepStrictEqual(G.escapedPile, [CARRIED_BYSTANDER]);
    assert.equal(G.fortifications?.['sidekick-stack']?.villainCardId, squirrelGirl);
  });

  it('T13: the handler fired at onFight or onAmbush is a no-op even with her in the Escape Pile', () => {
    const squirrelGirl = SQUIRREL_GIRLS[0]!;
    for (const timing of ['onFight', 'onAmbush'] as const) {
      const G = makeState(squirrelGirl);
      G.escapedPile = [squirrelGirl];
      // why: the real onEscape hook's effects re-bound to the tested timing, so the handler —
      // not a missing hook — is what refuses.
      const escapeHook = HOOKS.find((hook) => hook.cardId === squirrelGirl && hook.timing === 'onEscape')!;
      G.villainAbilityHooks = [{ ...escapeHook, timing }];
      const messagesBefore = G.messages.length;
      executeVillainAbilities(G, { currentPlayer: '0', turn: 4 }, squirrelGirl, timing, { random: makeMockCtx({ numPlayers: 1 }).random }, undefined);
      assert.deepStrictEqual(G.escapedPile, [squirrelGirl], `${timing}: the pile is unchanged`);
      assert.equal(G.fortifications, undefined, `${timing}: no table`);
      assert.equal(G.messages.length, messagesBefore, `${timing}: no log line`);
    }
  });
});
