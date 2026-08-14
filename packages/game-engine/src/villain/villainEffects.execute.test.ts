/**
 * Executor tests for executeVillainAbilities.
 *
 * Covers each MVP effect keyword, koHeroCurrentPlayer zone-priority + ext_id
 * ordering + wound exclusion, captureBystander onFight immediate-award (no
 * stranded bystander), safe-skip on empty piles / empty effects /
 * out-of-vocabulary, deterministic replay, and the missing-hooks guard.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  executeVillainAbilities,
  selectDefaultKoTarget,
  selectScryKoTarget,
  buildKoEligibleTargets,
} from './villainEffects.execute.js';
import { resolveKoHeroChoice } from '../moves/koHeroChoice.resolve.js';
import { resolveDiscardChoice } from '../moves/discardChoice.resolve.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId, PlayerZones } from '../state/zones.types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import { LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR } from '../rules/villainAbility.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';

const WOUND = 'pile-wound' as CardExtId;
const CTX = { currentPlayer: '0' };

interface MakeGOptions {
  hooks?: VillainAbilityHook[];
  playerZones?: Record<
    string,
    {
      deck: CardExtId[];
      hand: CardExtId[];
      discard: CardExtId[];
      inPlay: CardExtId[];
      victory: CardExtId[];
    }
  >;
  wounds?: CardExtId[];
  bystanders?: CardExtId[];
  // why: WP-541 — gain-officer-current moves an Officer from G.piles.officers to the
  // current player's discard; supplied only by its tests so other tests keep the
  // prior empty-pile shape.
  officers?: CardExtId[];
  heroDeck?: CardExtId[];
  escapedPile?: CardExtId[];
  attachedBystanders?: Record<CardExtId, CardExtId[]>;
  ko?: CardExtId[];
  hq?: (CardExtId | null)[];
  villainAttachedHeroes?: Record<string, CardExtId[]>;
  cardStats?: Record<string, { cost: number }>;
  // why: WP-447 — scry-ko-own-deck self-narrates via pushLog; a test asserting
  // that log line supplies `messages: []` so pushLog records instead of no-oping,
  // and `cardDisplayData` so the KO'd card resolves to a display name.
  messages?: { text: string; outcome: string; card?: CardExtId }[];
  cardDisplayData?: Record<string, { name: string }>;
  // why: WP-469 — reveal-or-wound reads G.cardTraits for the hand-only trait
  // predicate; supplied only by reveal-or-wound tests so other tests keep the
  // prior shape (the handler is the sole reader).
  cardTraits?: Record<string, { heroClass: string | null; team: string | null }>;
}

/**
 * Builds a minimal LegendaryGameState exercising only the fields the executor
 * reads. Cast through unknown because the executor never touches the rest.
 */
function makeG(options: MakeGOptions): LegendaryGameState {
  const playerZones =
    options.playerZones ??
    {
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    };
  return {
    villainAbilityHooks: options.hooks ?? [],
    playerZones,
    piles: {
      bystanders: options.bystanders ?? [],
      wounds: options.wounds ?? [],
      officers: options.officers ?? [],
      sidekicks: [],
      horrors: [],
    },
    ko: options.ko ?? [],
    attachedBystanders: options.attachedBystanders ?? {},
    villainAttachedHeroes: options.villainAttachedHeroes ?? {},
    hq: (options.hq ?? [null, null, null, null, null]) as LegendaryGameState['hq'],
    heroDeck: options.heroDeck ?? [],
    escapedPile: options.escapedPile ?? [],
    cardStats: options.cardStats ?? {},
    // why: WP-447 — only present when a scry-ko test needs pushLog to record /
    // a name to resolve; absent otherwise so unrelated tests keep the prior
    // shape (pushLog guards on Array.isArray(G.messages), resolveCardDisplayName
    // on optional chaining).
    ...(options.messages !== undefined ? { messages: options.messages } : {}),
    ...(options.cardDisplayData !== undefined
      ? { cardDisplayData: options.cardDisplayData }
      : {}),
    ...(options.cardTraits !== undefined ? { cardTraits: options.cardTraits } : {}),
    turnEconomy: {
      attack: 0,
      recruit: 0,
      spentAttack: 0,
      spentRecruit: 0,
      piercing: 0,
      woundsDrawn: 0,
    },
  } as unknown as LegendaryGameState;
}

/**
 * Builds a single hook for one card/timing/effect set.
 */
function hook(
  cardId: string,
  timing: 'onAmbush' | 'onFight' | 'onEscape',
  effects: string[],
): VillainAbilityHook {
  // why: WP-252 — the helper takes legacy keyword strings. keywords[] is that
  // string array; effects[] is the translated descriptor array, mirroring the
  // parser's dual output for hand-built fixtures. Unknown strings (safe-skip
  // tests) translate to {} (no primitive) → the executor's handler lookup
  // misses → safe-skip, exactly as before.
  const keywords = effects as VillainAbilityHook['keywords'];
  const descriptors: VillainAbilityHook['effects'] = [];
  for (const keyword of keywords) {
    descriptors.push({ ...LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR[keyword] });
  }
  return {
    cardId: cardId as CardExtId,
    timing,
    keywords,
    effects: descriptors,
  };
}

describe('executeVillainAbilities — gainWoundEachPlayer', () => {
  it('gives every player one wound and projects only the current player', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onAmbush', ['gainWoundEachPlayer'])],
      wounds: ['w0', 'w1', 'w2'] as CardExtId[],
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onAmbush');

    assert.equal(G.playerZones['0']!.discard.length, 1, 'player 0 gains a wound');
    assert.equal(G.playerZones['1']!.discard.length, 1, 'player 1 gains a wound');
    assert.equal(G.piles.wounds.length, 1, 'wound pile decreased by 2');
    assert.equal(G.turnEconomy.woundsDrawn, 1, 'only current player projected');
  });
});

describe('executeVillainAbilities — gainWoundCurrentPlayer', () => {
  it('gives only the current player a wound', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['gainWoundCurrentPlayer'])],
      wounds: ['w0', 'w1'] as CardExtId[],
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.equal(G.playerZones['0']!.discard.length, 1, 'current player gains a wound');
    assert.equal(G.playerZones['1']!.discard.length, 0, 'other player unaffected');
    assert.equal(G.piles.wounds.length, 1);
    assert.equal(G.turnEconomy.woundsDrawn, 1);
  });
});

describe('executeVillainAbilities — koHeroCurrentPlayer (WP-242 park → resolve)', () => {
  // why: WP-242 / D-24006 — koHeroCurrentPlayer is now INTERACTIVE for the
  // current player. 0 eligible → no-op + no append; exactly 1 eligible →
  // auto-KO + no append (decision C); ≥2 eligible → append a pending choice
  // and KO nothing (the player picks via resolveKoHeroChoice). The legacy
  // auto-pick now applies only to the each-player variants (unchanged).
  it('≥2 eligible (discard + hand) → appends one pending choice and KOs nothing', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroCurrentPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: ['core-hero-z-00'] as CardExtId[],
          discard: ['core-hero-b-00', 'core-hero-a-00', WOUND] as CardExtId[],
          inPlay: [],
          victory: [],
        },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(G.ko, [], 'nothing KOd yet — the player must choose');
    assert.equal(G.pendingKoHeroChoices?.length, 1, 'one pending choice appended');
    assert.deepStrictEqual(
      G.pendingKoHeroChoices?.[0],
      { choiceType: 'ko-hero', playerID: '0' },
      'pending entry records the current player',
    );
    assert.deepStrictEqual(
      G.playerZones['0']!.discard,
      ['core-hero-b-00', 'core-hero-a-00', WOUND],
      'discard untouched while pending',
    );
    assert.deepStrictEqual(
      G.playerZones['0']!.hand,
      ['core-hero-z-00'],
      'hand untouched while pending',
    );
  });

  it('≥2 eligible in hand only → appends one pending choice (no auto-KO)', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroCurrentPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: ['core-hero-m-00', 'core-hero-a-00'] as CardExtId[],
          discard: [WOUND, WOUND] as CardExtId[],
          inPlay: [],
          victory: [],
        },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(G.ko, [], 'wounds are not eligible; the two hand heroes are a choice');
    assert.equal(G.pendingKoHeroChoices?.length, 1, 'one pending choice appended');
    assert.equal(G.playerZones['0']!.hand.length, 2, 'hand untouched while pending');
  });

  it('exactly 1 eligible → auto-KOs that card and appends nothing (decision C)', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroCurrentPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: [WOUND] as CardExtId[],
          discard: ['core-hero-a-00', WOUND] as CardExtId[],
          inPlay: [],
          victory: [],
        },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(G.ko, ['core-hero-a-00'], 'the single eligible hero is auto-KOd');
    assert.equal(
      G.pendingKoHeroChoices === undefined || G.pendingKoHeroChoices.length === 0,
      true,
      'no pending choice appended when exactly 1 eligible',
    );
    assert.equal(
      G.playerZones['0']!.discard.includes('core-hero-a-00' as CardExtId),
      false,
      'auto-KO target removed from discard',
    );
  });

  it('0 eligible (wounds only) → no-op, no KO, no append', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroCurrentPlayer'])],
      playerZones: {
        '0': { deck: [], hand: [], discard: [WOUND] as CardExtId[], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.ko, [], 'no KO when no hero is available');
    assert.equal(
      G.pendingKoHeroChoices === undefined || G.pendingKoHeroChoices.length === 0,
      true,
      'no pending choice appended when 0 eligible',
    );
  });

  it('a single move firing koHeroCurrentPlayer twice appends TWO pending entries (multi-KO queue)', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroCurrentPlayer', 'koHeroCurrentPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: ['core-hero-a-00', 'core-hero-b-00'] as CardExtId[],
          discard: [],
          inPlay: [],
          victory: [],
        },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');
    assert.equal(G.pendingKoHeroChoices?.length, 2, 'two pending entries (one per firing)');
    assert.deepStrictEqual(G.ko, [], 'nothing KOd while both choices are pending');
  });
});

describe('buildKoEligibleTargets (WP-242)', () => {
  it('spans discard → hand → inPlay in array index order, excluding wounds', () => {
    const zones = {
      deck: [],
      hand: ['core-hand-a' as CardExtId, WOUND],
      discard: ['core-disc-a' as CardExtId, WOUND, 'core-disc-b' as CardExtId],
      inPlay: ['core-play-a' as CardExtId],
      victory: [],
    } as unknown as PlayerZones;

    assert.deepStrictEqual(buildKoEligibleTargets(zones), [
      { zone: 'discard', cardId: 'core-disc-a' },
      { zone: 'discard', cardId: 'core-disc-b' },
      { zone: 'hand', cardId: 'core-hand-a' },
      { zone: 'inPlay', cardId: 'core-play-a' },
    ]);
  });

  it('dedupes the same ext_id within a zone (one option) but keeps it across zones (two options)', () => {
    const zones = {
      deck: [],
      hand: ['dup' as CardExtId],
      discard: ['dup' as CardExtId, 'dup' as CardExtId],
      inPlay: [],
      victory: [],
    } as unknown as PlayerZones;

    assert.deepStrictEqual(buildKoEligibleTargets(zones), [
      { zone: 'discard', cardId: 'dup' },
      { zone: 'hand', cardId: 'dup' },
    ]);
  });

  it('returns an empty list when only wounds are present', () => {
    const zones = {
      deck: [],
      hand: [WOUND],
      discard: [WOUND],
      inPlay: [],
      victory: [],
    } as unknown as PlayerZones;
    assert.deepStrictEqual(buildKoEligibleTargets(zones), []);
  });
});

describe('koHeroCurrentPlayer eligible-collapse (WP-242)', () => {
  it('a 2-entry queue whose first resolution drops the eligible set to 1 still leaves the second entry (resolve never auto-resolves the collapse)', () => {
    // why: D-24007 — only the parker auto-resolves. After the first
    // resolveKoHeroChoice the second pending entry remains even though only
    // one eligible card is left; it STILL requires an explicit resolve.
    const G = makeG({
      playerZones: {
        '0': {
          deck: [],
          hand: ['hero-a' as CardExtId, 'hero-b' as CardExtId],
          discard: [],
          inPlay: [],
          victory: [],
        },
      },
    });
    G.pendingKoHeroChoices = [
      { choiceType: 'ko-hero', playerID: '0' },
      { choiceType: 'ko-hero', playerID: '0' },
    ];

    // Resolve the first choice — KO hero-a, leaving hero-b as the only eligible.
    resolveKoHeroChoice(
      { G, playerID: '0' } as unknown as Parameters<typeof resolveKoHeroChoice>[0],
      { zone: 'hand', cardId: 'hero-a' as CardExtId },
    );

    assert.deepStrictEqual(G.ko, ['hero-a'], 'first resolve KOs hero-a');
    assert.equal(G.pendingKoHeroChoices.length, 1, 'second entry still pending — no auto-resolve');
    assert.deepStrictEqual(G.playerZones['0']!.hand, ['hero-b'], 'hero-b NOT auto-KOd');
  });
});

describe('executeVillainAbilities — starting-SHIELD KO priority (D-20602)', () => {
  // why: D-20602 amends D-18503's lex-asc tie-break. Pure lex-asc always KOs
  // recruited heroes ('core/...' < 'starting-shield-...' lexically), which
  // defeats deck-thinning. The amended heuristic prefers starting-shield
  // ext_ids first so auto-resolution KOs the worst cards instead of the
  // best. These tests pin the new priority across both zones and both
  // dispatch cases (current-player and each-player).
  const SHIELD_AGENT = 'starting-shield-agent' as CardExtId;
  const SHIELD_TROOPER = 'starting-shield-trooper' as CardExtId;

  // why: WP-242 — the starter-first / zone-priority selection now lives in the
  // bot default pick `selectDefaultKoTarget` (reused for auto-1 and the sim
  // bot). These tests assert that selection directly (the human-facing choice
  // shows ALL eligible targets; the priority only governs the auto-resolution).
  it('selectDefaultKoTarget prefers starting SHIELD card over a recruited hero in discard', () => {
    const zones = {
      deck: [],
      hand: [],
      // why: 'core/spider-man/...' lex-sorts before 'starting-shield-...';
      // pure lex-asc would have picked the recruited hero (pre-D-20602).
      discard: ['core/spider-man/strike' as CardExtId, SHIELD_AGENT, SHIELD_TROOPER],
      inPlay: [],
      victory: [],
    } as unknown as PlayerZones;

    assert.deepStrictEqual(
      selectDefaultKoTarget(zones),
      { zone: 'discard', cardId: SHIELD_AGENT },
      'auto-pick selects the lex-first starting SHIELD card, NOT the recruited hero',
    );
  });

  it('selectDefaultKoTarget prefers starting SHIELD card in hand (discard had only wounds)', () => {
    const zones = {
      deck: [],
      hand: ['core/hulk/smash' as CardExtId, SHIELD_TROOPER, SHIELD_AGENT],
      discard: [WOUND],
      inPlay: [],
      victory: [],
    } as unknown as PlayerZones;

    assert.deepStrictEqual(
      selectDefaultKoTarget(zones),
      { zone: 'hand', cardId: SHIELD_AGENT },
      'falls through to hand and picks the lex-first starting SHIELD card',
    );
  });

  it('selectDefaultKoTarget falls back to lex-asc among recruited heroes when no starting SHIELD cards present', () => {
    const zones = {
      deck: [],
      hand: [],
      discard: [
        'core/wolverine/claws' as CardExtId,
        'core/black-widow/spy' as CardExtId,
      ],
      inPlay: [],
      victory: [],
    } as unknown as PlayerZones;

    assert.deepStrictEqual(
      selectDefaultKoTarget(zones),
      { zone: 'discard', cardId: 'core/black-widow/spy' },
      'lex-asc tie-break still applies among non-starting cards (D-18503 preserved)',
    );
  });

  it('selectDefaultKoTarget discard zone priority is preserved even when only the hand holds a starting card', () => {
    // why: starting-first tier ordering does NOT override the zone-priority
    // (discard before hand) lock from D-18503. A recruited hero in discard
    // is the auto-pick before a starting card in hand.
    const zones = {
      deck: [],
      hand: [SHIELD_AGENT],
      discard: ['core/spider-man/strike' as CardExtId],
      inPlay: [],
      victory: [],
    } as unknown as PlayerZones;

    assert.deepStrictEqual(
      selectDefaultKoTarget(zones),
      { zone: 'discard', cardId: 'core/spider-man/strike' },
      'discard always beats hand, regardless of starting-card tier',
    );
  });

  it('koHeroEachPlayer applies starting-first priority per player', () => {
    // why: per-player resolver is shared (D-18902), so each-player dispatch
    // inherits the new priority. Player 0 has both a recruited hero AND a
    // starting card in discard — starting wins. Player 1 has only a recruited
    // hero — falls back to lex-asc.
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroEachPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: [],
          discard: ['core/spider-man/strike' as CardExtId, SHIELD_AGENT],
          inPlay: [],
          victory: [],
        },
        '1': {
          deck: [],
          hand: [],
          discard: ['core/hulk/smash' as CardExtId, 'core/wolverine/claws' as CardExtId],
          inPlay: [],
          victory: [],
        },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      G.ko,
      [SHIELD_AGENT, 'core/hulk/smash'],
      'player 0 KOs starting SHIELD; player 1 KOs lex-first recruited hero',
    );
  });

  it('determinism: selectDefaultKoTarget starting-first priority is stable across two identical calls', () => {
    const build = () =>
      ({
        deck: [],
        hand: ['core/wolverine/claws' as CardExtId],
        discard: [SHIELD_TROOPER, 'core/spider-man/strike' as CardExtId, SHIELD_AGENT, WOUND],
        inPlay: [],
        victory: [],
      } as unknown as PlayerZones);

    const first = selectDefaultKoTarget(build());
    const second = selectDefaultKoTarget(build());

    assert.deepStrictEqual(first, second, 'identical pick across two calls');
    assert.deepStrictEqual(
      first,
      { zone: 'discard', cardId: SHIELD_AGENT },
      'lex-first starting card wins',
    );
  });
});

describe('executeVillainAbilities — heroDeckTopToEscape', () => {
  it('moves the top hero-deck card to the escaped pile', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onAmbush', ['heroDeckTopToEscape'])],
      heroDeck: ['h0', 'h1'] as CardExtId[],
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onAmbush');

    assert.deepStrictEqual(G.heroDeck, ['h1']);
    assert.deepStrictEqual(G.escapedPile, ['h0']);
  });

  it('no-ops on an empty hero deck', () => {
    const G = makeG({ hooks: [hook('v-x', 'onAmbush', ['heroDeckTopToEscape'])] });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onAmbush');
    assert.deepStrictEqual(G.escapedPile, []);
  });
});

describe('executeVillainAbilities — captureBystander', () => {
  it('onAmbush attaches a bystander to the revealed villain', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onAmbush', ['captureBystander'])],
      bystanders: ['b0', 'b1'] as CardExtId[],
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onAmbush');

    assert.deepStrictEqual(G.attachedBystanders['v-x' as CardExtId], ['b0']);
    assert.deepStrictEqual(G.piles.bystanders, ['b1']);
    assert.deepStrictEqual(G.playerZones['0']!.victory, [], 'not awarded on ambush');
  });

  it('onFight attaches AND immediately awards (no stranded bystander)', () => {
    const G = makeG({
      hooks: [hook('v-y', 'onFight', ['captureBystander'])],
      bystanders: ['b0'] as CardExtId[],
    });
    executeVillainAbilities(G, CTX, 'v-y' as CardExtId, 'onFight');

    assert.equal(
      G.attachedBystanders['v-y' as CardExtId],
      undefined,
      'no bystander left stranded on the defeated villain',
    );
    assert.deepStrictEqual(G.playerZones['0']!.victory, ['b0'], 'bystander awarded to current player');
    assert.deepStrictEqual(G.piles.bystanders, []);
  });

  it('no-ops when the bystander pile is empty', () => {
    const G = makeG({ hooks: [hook('v-y', 'onFight', ['captureBystander'])], bystanders: [] });
    executeVillainAbilities(G, CTX, 'v-y' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.playerZones['0']!.victory, []);
    assert.deepStrictEqual(G.attachedBystanders, {});
  });
});

describe('executeVillainAbilities — Tier-B city-space gate (WP-489 / D-24295)', () => {
  // why: Abomination "Fight: If you fight Abomination on the Streets or Bridge,
  // rescue three Bystanders." — a counted, location-gated capture-bystander.
  const abominationHook: VillainAbilityHook = {
    cardId: 'v-abomination' as CardExtId,
    timing: 'onFight',
    keywords: [],
    effects: [{ primitive: 'capture-bystander', magnitude: 3, requireCitySpaces: ['streets', 'bridge'] }],
  };
  // why: the Lizard "Fight: If you fight the Lizard in the Sewers, each other
  // player gains a Wound." — a location-gated gain-wound:each-other.
  const lizardHook: VillainAbilityHook = {
    cardId: 'v-lizard' as CardExtId,
    timing: 'onFight',
    keywords: [],
    effects: [{ primitive: 'gain-wound', target: 'each-other', magnitude: 1, requireCitySpaces: ['sewers'] }],
  };

  it('Abomination rescues exactly 3 Bystanders when fought on the Streets (index 3)', () => {
    const G = makeG({
      hooks: [abominationHook],
      bystanders: ['b0', 'b1', 'b2', 'b3'] as CardExtId[],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-abomination' as CardExtId, 'onFight', undefined, 3);
    assert.deepStrictEqual(G.playerZones['0']!.victory, ['b0', 'b1', 'b2'], '3 rescued to current player');
    assert.deepStrictEqual(G.piles.bystanders, ['b3'], 'one bystander left in the supply');
    assert.equal(G.attachedBystanders['v-abomination' as CardExtId], undefined, 'none left stranded');
    assert.match(G.messages.at(-1)!.text, /rescued 3 Bystander/);
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'gated-pass is not hollow');
  });

  it('Abomination also fires on the Bridge (index 4)', () => {
    const G = makeG({ hooks: [abominationHook], bystanders: ['b0', 'b1', 'b2', 'b3'] as CardExtId[] });
    executeVillainAbilities(G, CTX, 'v-abomination' as CardExtId, 'onFight', undefined, 4);
    assert.deepStrictEqual(G.playerZones['0']!.victory, ['b0', 'b1', 'b2']);
  });

  it('Abomination rescue is supply-bounded (rescues what the supply holds)', () => {
    const G = makeG({ hooks: [abominationHook], bystanders: ['b0'] as CardExtId[], messages: [] });
    executeVillainAbilities(G, CTX, 'v-abomination' as CardExtId, 'onFight', undefined, 3);
    assert.deepStrictEqual(G.playerZones['0']!.victory, ['b0'], 'rescues only the one available');
    assert.deepStrictEqual(G.piles.bystanders, []);
    assert.match(G.messages.at(-1)!.text, /rescued 1 Bystander/);
  });

  it('Abomination rescues nothing when fought off the gated spaces (Sewers, index 0)', () => {
    const G = makeG({ hooks: [abominationHook], bystanders: ['b0', 'b1', 'b2'] as CardExtId[], messages: [] });
    executeVillainAbilities(G, CTX, 'v-abomination' as CardExtId, 'onFight', undefined, 0);
    assert.deepStrictEqual(G.playerZones['0']!.victory, [], 'no rescue off-space');
    assert.deepStrictEqual(G.piles.bystanders, ['b0', 'b1', 'b2'], 'supply untouched');
    assert.match(G.messages.at(-1)!.text, /not fought on the Streets or Bridge; no effect/);
  });

  it('Abomination fails closed on an undefined cityIndex (non-fight fire site)', () => {
    const G = makeG({ hooks: [abominationHook], bystanders: ['b0', 'b1', 'b2'] as CardExtId[] });
    executeVillainAbilities(G, CTX, 'v-abomination' as CardExtId, 'onFight', undefined, undefined);
    assert.deepStrictEqual(G.playerZones['0']!.victory, [], 'no rescue without a fought space');
    assert.deepStrictEqual(G.piles.bystanders, ['b0', 'b1', 'b2']);
  });

  it('the Lizard wounds each OTHER player (never the current) in the Sewers (index 0)', () => {
    const G = makeG({
      hooks: [lizardHook],
      wounds: ['w0', 'w1'] as CardExtId[],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-lizard' as CardExtId, 'onFight', undefined, 0);
    assert.equal(G.playerZones['1']!.discard.length, 1, 'the other player gained a Wound');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'the current player is never wounded');
    assert.equal(G.turnEconomy.woundsDrawn, 0, 'woundsDrawn tracks the current player only');
    assert.match(G.messages.at(-1)!.text, /each other player gained a Wound/);
  });

  it('the Lizard wounds no one when fought off the Sewers (Streets, index 3)', () => {
    const G = makeG({ hooks: [lizardHook], wounds: ['w0', 'w1'] as CardExtId[], messages: [] });
    executeVillainAbilities(G, CTX, 'v-lizard' as CardExtId, 'onFight', undefined, 3);
    assert.equal(G.playerZones['1']!.discard.length, 0, 'no wound off-space');
    assert.deepStrictEqual(G.piles.wounds, ['w0', 'w1'], 'wound supply untouched');
    assert.match(G.messages.at(-1)!.text, /not fought on the Sewers; no effect/);
  });
});

describe('executeVillainAbilities — Whirlwind magnitude-2 current KO (WP-492 / D-24298)', () => {
  // why: Whirlwind "Fight: If you fight Whirlwind on the Rooftops or Bridge, KO two
  // of your Heroes." — a location-gated magnitude-2 interactive current-player KO.
  const whirlwindHook = (): VillainAbilityHook => ({
    cardId: 'v-whirlwind' as CardExtId,
    timing: 'onFight',
    keywords: [],
    effects: [
      { primitive: 'ko-hero', target: 'current', magnitude: 2, requireCitySpaces: ['rooftops', 'bridge'] },
    ],
  });
  const zonesWith = (hand: string[]) => ({
    '0': { deck: [], hand: hand as CardExtId[], discard: [], inPlay: [], victory: [] },
    '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
  });

  it('parks a magnitude-2 interactive choice on the Rooftops (index 2) with > 2 distinct heroes', () => {
    const G = makeG({ hooks: [whirlwindHook()], playerZones: zonesWith(['h-a', 'h-b', 'h-c']), messages: [] });
    executeVillainAbilities(G, CTX, 'v-whirlwind' as CardExtId, 'onFight', undefined, 2);
    assert.deepStrictEqual(G.pendingKoHeroChoices, [
      { choiceType: 'ko-hero', playerID: '0', remaining: 2 },
    ]);
    assert.deepStrictEqual(G.ko, [], 'no hero KO’d yet — the player chooses which two');
    assert.match(G.messages.at(-1)!.text, /KO 2 of your Heroes — choose which/);
  });

  it('auto-KOs both on the Bridge (index 4) with exactly 2 distinct heroes — no prompt', () => {
    const G = makeG({ hooks: [whirlwindHook()], playerZones: zonesWith(['h-a', 'h-b']), messages: [] });
    executeVillainAbilities(G, CTX, 'v-whirlwind' as CardExtId, 'onFight', undefined, 4);
    assert.equal(G.pendingKoHeroChoices?.length ?? 0, 0, 'no park — both die, no meaningful choice');
    assert.deepStrictEqual([...G.ko].sort(), ['h-a', 'h-b']);
    assert.match(G.messages.at(-1)!.text, /KO'd 2 of your Heroes/);
  });

  it('auto-KOs the only eligible hero when just 1 exists (KO fewer than 2)', () => {
    const G = makeG({ hooks: [whirlwindHook()], playerZones: zonesWith(['h-a']), messages: [] });
    executeVillainAbilities(G, CTX, 'v-whirlwind' as CardExtId, 'onFight', undefined, 2);
    assert.deepStrictEqual(G.ko, ['h-a']);
    assert.equal(G.pendingKoHeroChoices?.length ?? 0, 0);
    assert.match(G.messages.at(-1)!.text, /KO'd 1 of your Heroes/);
  });

  it('is a reachable no-op (not hollow) with zero eligible heroes', () => {
    const G = makeG({ hooks: [whirlwindHook()], messages: [] });
    executeVillainAbilities(G, CTX, 'v-whirlwind' as CardExtId, 'onFight', undefined, 2);
    assert.deepStrictEqual(G.ko, []);
    assert.equal(G.pendingKoHeroChoices?.length ?? 0, 0);
    assert.match(G.messages.at(-1)!.text, /no Heroes to KO/);
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'reachable no-op, not a hollow record');
  });

  it('auto-KOs both identical copies (physical 2, one distinct option) — no prompt', () => {
    const G = makeG({ hooks: [whirlwindHook()], playerZones: zonesWith(['h-a', 'h-a']), messages: [] });
    executeVillainAbilities(G, CTX, 'v-whirlwind' as CardExtId, 'onFight', undefined, 4);
    assert.deepStrictEqual(G.ko, ['h-a', 'h-a']);
    assert.equal(G.pendingKoHeroChoices?.length ?? 0, 0);
  });

  it('the WP-489 location gate denies the effect off the Rooftops/Bridge (Sewers, index 0)', () => {
    const G = makeG({ hooks: [whirlwindHook()], playerZones: zonesWith(['h-a', 'h-b', 'h-c']), messages: [] });
    executeVillainAbilities(G, CTX, 'v-whirlwind' as CardExtId, 'onFight', undefined, 0);
    assert.deepStrictEqual(G.ko, [], 'no KO off-space');
    assert.equal(G.pendingKoHeroChoices?.length ?? 0, 0);
    assert.match(G.messages.at(-1)!.text, /not fought on the Rooftops or Bridge; no effect/);
  });
});

describe('executeVillainAbilities — Viper gain-wound-unless-victory-villain-group (WP-494 / D-24299)', () => {
  // why: Viper "Fight/Escape: Each player without another HYDRA Villain in their
  // Victory Pile gains a Wound." — a conditional each-player wound gated on a
  // Victory-Pile villain-group predicate; the group prefix derives from the fought
  // Viper's own ext_id (Path B).
  const VIPER = 'core-villain-hydra-viper-00' as CardExtId;
  const KIDNAPPERS = 'core-villain-hydra-hydra-kidnappers-00' as CardExtId; // another HYDRA villain
  const WHIRLWIND = 'core-villain-masters-of-evil-whirlwind-00' as CardExtId; // NOT hydra
  const BYSTANDER = 'bystander-villain-deck-07' as CardExtId; // carries `-villain-` but not the anchored prefix
  const viperHook: VillainAbilityHook = {
    cardId: VIPER,
    timing: 'onFight',
    keywords: [],
    effects: [{ primitive: 'gain-wound-unless-victory-villain-group', victoryVillainGroup: 'hydra' }],
  };
  const zones = (p0victory: string[], p1victory: string[]) => ({
    '0': { deck: [], hand: [], discard: [], inPlay: [], victory: p0victory as CardExtId[] },
    '1': { deck: [], hand: [], discard: [], inPlay: [], victory: p1victory as CardExtId[] },
  });

  it('wounds a player with no other HYDRA villain; spares one who holds another', () => {
    // P0 victory = only the fought Viper (excluded as "another") → wounded.
    // P1 victory = a HYDRA Kidnappers (another HYDRA villain) → NOT wounded.
    const G = makeG({
      hooks: [viperHook],
      playerZones: zones([VIPER], [KIDNAPPERS]),
      wounds: ['w0', 'w1'] as CardExtId[],
      messages: [],
    });
    executeVillainAbilities(G, CTX, VIPER, 'onFight');
    assert.equal(G.playerZones['0']!.discard.length, 1, 'P0 (only the fought Viper) gains a Wound');
    assert.equal(G.playerZones['1']!.discard.length, 0, 'P1 (holds another HYDRA villain) is spared');
    assert.equal(G.turnEconomy.woundsDrawn, 1, 'woundsDrawn tracks the current player only');
    assert.match(G.messages.at(-1)!.text, /had no other hydra Villain in their Victory Pile and gained a Wound/);
  });

  it('a non-HYDRA villain (masters-of-evil) in the Victory Pile does NOT spare a player', () => {
    const G = makeG({ hooks: [viperHook], playerZones: zones([VIPER], [WHIRLWIND]), wounds: ['w0', 'w1'] as CardExtId[] });
    executeVillainAbilities(G, CTX, VIPER, 'onFight');
    assert.equal(G.playerZones['1']!.discard.length, 1, 'a Masters-of-Evil villain is not HYDRA — P1 still wounded');
  });

  it('a victory-pile bystander (bystander-villain-deck-NN) does NOT false-match the prefix', () => {
    // BYSTANDER carries the `-villain-` substring but starts `bystander-`, so it must
    // NOT count as a HYDRA villain — the player still gets wounded.
    const G = makeG({ hooks: [viperHook], playerZones: zones([VIPER], [BYSTANDER]), wounds: ['w0', 'w1'] as CardExtId[] });
    executeVillainAbilities(G, CTX, VIPER, 'onFight');
    assert.equal(G.playerZones['1']!.discard.length, 1, 'a bystander is not a HYDRA villain — P1 wounded');
  });

  it('a player holding ANOTHER HYDRA villain beside the fought Viper is spared', () => {
    const G = makeG({ hooks: [viperHook], playerZones: zones([VIPER, KIDNAPPERS], []), wounds: ['w0', 'w1'] as CardExtId[] });
    executeVillainAbilities(G, CTX, VIPER, 'onFight');
    assert.equal(G.playerZones['0']!.discard.length, 0, 'P0 has another HYDRA villain (Kidnappers) → spared');
    assert.equal(G.playerZones['1']!.discard.length, 1, 'P1 has none → wounded');
  });

  it('fires identically at the Escape site (Viper in escapedPile, no victory exclusion needed)', () => {
    const escapeHook: VillainAbilityHook = { ...viperHook, timing: 'onEscape' };
    const G = makeG({ hooks: [escapeHook], playerZones: zones([], [KIDNAPPERS]), wounds: ['w0', 'w1'] as CardExtId[], messages: [] });
    executeVillainAbilities(G, CTX, VIPER, 'onEscape');
    assert.equal(G.playerZones['0']!.discard.length, 1, 'P0 (empty victory) wounded on escape');
    assert.equal(G.playerZones['1']!.discard.length, 0, 'P1 (holds a HYDRA villain) spared on escape');
    assert.match(G.messages.at(-1)!.text, /Escape effect:/);
  });

  it('is supply-bounded and self-narrates blocked when every player is safe', () => {
    const G = makeG({ hooks: [viperHook], playerZones: zones([VIPER, KIDNAPPERS], [KIDNAPPERS]), wounds: ['w0'] as CardExtId[], messages: [] });
    executeVillainAbilities(G, CTX, VIPER, 'onFight');
    assert.equal(G.playerZones['0']!.discard.length, 0);
    assert.equal(G.playerZones['1']!.discard.length, 0);
    assert.match(G.messages.at(-1)!.text, /every player had another hydra Villain/);
  });
});

describe('executeVillainAbilities — scry-ko-own-deck (WP-447 / D-24267)', () => {
  const WOUND = 'pile-wound' as CardExtId;
  const AGENT = 'starting-shield-agent' as CardExtId;
  const TROOPER = 'starting-shield-trooper' as CardExtId;

  // why: scry-ko is not a legacy keyword, so the `hook()` helper (which reads
  // LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR) cannot build it — construct the
  // descriptor hook directly.
  function scryHook(cardId: string): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onFight',
      keywords: [],
      effects: [{ primitive: 'scry-ko-own-deck' }],
    };
  }

  function scryG(deck: CardExtId[]): LegendaryGameState {
    return makeG({
      hooks: [scryHook('hm-doombot')],
      playerZones: {
        '0': { deck, hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
  }

  it('WP-470: with ≥2 cards PARKS a choice with the top-2 ext_ids and KOs nothing yet', () => {
    const hero = 'core/spider-man/spider-man#0' as CardExtId;
    const G = scryG([WOUND, hero, 'core/x/deep#0' as CardExtId]);
    executeVillainAbilities(G, CTX, 'hm-doombot' as CardExtId, 'onFight');
    // why: WP-470 / D-24282 — the ≥2 branch now parks an interactive choice; nothing
    // is KO'd until resolveScryKoChoice, and the deck is untouched (block-all freeze).
    assert.deepStrictEqual(G.ko, [], 'nothing KO’d yet — the choice is parked');
    assert.deepStrictEqual(
      G.playerZones['0']!.deck,
      [WOUND, hero, 'core/x/deep#0' as CardExtId],
      'the deck is frozen (no card removed) until the player resolves',
    );
    assert.equal(G.pendingScryKoChoices?.length, 1, 'exactly one pending scry-KO choice');
    const front = G.pendingScryKoChoices![0]!;
    assert.equal(front.choiceType, 'scry-ko');
    assert.equal(front.playerID, '0');
    assert.deepStrictEqual(
      front.revealedCardIds,
      [WOUND, hero],
      'the top two ext_ids are snapshotted onto the pending entry, in deck order',
    );
  });

  it('with a single-card deck KOs that card and empties the deck', () => {
    const only = 'core/x/only#0' as CardExtId;
    const G = scryG([only]);
    executeVillainAbilities(G, CTX, 'hm-doombot' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.ko, [only]);
    assert.deepStrictEqual(G.playerZones['0']!.deck, [], 'no "other" to return');
  });

  it('no-ops on an empty deck and records NO hollow breadcrumb (reachable no-op)', () => {
    const G = scryG([]);
    executeVillainAbilities(G, CTX, 'hm-doombot' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.ko, [], 'nothing KO’d');
    // why: the handler ran (a descriptor was present) — an empty deck is a
    // reachable no-op, never a hollow record. AC-4.
    assert.equal(
      G.diagnostics?.hollowEffects?.length ?? 0,
      0,
      'no hollow record for a reachable no-op',
    );
  });

  it('WP-470: the single-card auto-KO still self-narrates a "Fight effect:" line naming the KO’d card', () => {
    const G = makeG({
      hooks: [scryHook('hm-doombot')],
      playerZones: {
        '0': { deck: [WOUND], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
      cardDisplayData: { [WOUND]: { name: 'Wound' } },
    });
    executeVillainAbilities(G, CTX, 'hm-doombot' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.ko, [WOUND], 'the sole card auto-KO’d (nothing to choose)');
    assert.equal(G.messages!.length, 1, 'exactly one log line pushed');
    assert.match(
      G.messages![0]!.text,
      /Fight effect: KO'd "Wound" from the top of your deck\./,
      'log line names the KO’d card',
    );
  });

  it('WP-470: the ≥2 park self-narrates a "look at the top two" line and KOs nothing', () => {
    const hero = 'core/spider-man/spider-man#0' as CardExtId;
    const G = makeG({
      hooks: [scryHook('hm-doombot')],
      playerZones: {
        '0': { deck: [WOUND, hero], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
      cardDisplayData: { [WOUND]: { name: 'Wound' } },
    });
    executeVillainAbilities(G, CTX, 'hm-doombot' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.ko, [], 'nothing KO’d — the choice is parked');
    assert.equal(G.messages!.length, 1, 'exactly one log line pushed');
    assert.match(
      G.messages![0]!.text,
      /Fight effect: look at the top two cards of your deck — choose one to KO\./,
      'log line describes the parked choice',
    );
  });

  it('WP-470: selectScryKoTarget (the bot/sim default) preserves the WP-447 worst-first pick', () => {
    // why: selectScryKoTarget is unchanged and now the bot/sim default (ai.legalMoves).
    // These pin the auto-pick determinism: Wound-first → starting S.H.I.E.L.D. (lex-lowest)
    // → lex-lowest ext_id, so a bot game fighting a Doombot KOs the SAME card as WP-447.
    const hero = 'core/spider-man/spider-man#0' as CardExtId;
    assert.equal(selectScryKoTarget([WOUND, hero]), WOUND, 'Wound is KO-preferred');
    assert.equal(selectScryKoTarget([hero, AGENT]), AGENT, 'starting S.H.I.E.L.D. over a recruited hero');
    assert.equal(selectScryKoTarget([TROOPER, AGENT]), AGENT, 'lex-lowest S.H.I.E.L.D. card');
    assert.equal(
      selectScryKoTarget(['core/zzz/zzz#0' as CardExtId, 'core/aaa/aaa#0' as CardExtId]),
      'core/aaa/aaa#0' as CardExtId,
      'lex-lowest recruited hero',
    );
    assert.equal(selectScryKoTarget([]), null, 'empty reveal → null');
  });

  it('records NO unmarked-ability breadcrumb for a marked Doombot Fight (D-24266 closed)', () => {
    // why: AC-5 — the hook now carries a scry-ko descriptor, so the D-24266
    // "printed-but-unmarked" detector must NOT fire; the effect is implemented.
    const hero = 'core/spider-man/spider-man#0' as CardExtId;
    const G = makeG({
      hooks: [scryHook('henchman-doombot-legion-00')],
      playerZones: {
        '0': { deck: [WOUND, hero], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'henchman-doombot-legion-00' as CardExtId, 'onFight');
    // why: WP-470 — the ≥2 branch now PARKS instead of auto-KOing, but the effect still
    // "fired" (a descriptor was present and ran), so the D-24266 unmarked-ability detector
    // must NOT record a hollow breadcrumb. Assert the park rather than a KO.
    assert.equal(G.pendingScryKoChoices?.length, 1, 'the scry-ko fired (a choice was parked)');
    assert.deepStrictEqual(G.ko, [], 'nothing KO’d yet — the choice is parked');
    assert.equal(
      G.diagnostics?.hollowEffects?.length ?? 0,
      0,
      'no unmarked-ability breadcrumb — the line is now handled',
    );
  });

  // why: WP-478 / D-24285 — a short deck reshuffles the discard to top up toward the
  // look-2, per the standard Legendary reveal-reshuffle rule (reversing WP-447's
  // "scry never reshuffles" stance). The reverse-shuffle proves the reshuffle ran.
  const reverseShuffle: ShuffleProvider = {
    random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
  };

  it('WP-478: reshuffles the discard into an empty deck, then parks a look-2 choice', () => {
    const heroA = 'core/x/a#0' as CardExtId;
    const heroB = 'core/x/b#0' as CardExtId;
    const heroC = 'core/x/c#0' as CardExtId;
    const G = makeG({
      hooks: [scryHook('hm-doombot')],
      playerZones: {
        '0': { deck: [], hand: [], discard: [heroA, heroB, heroC], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'hm-doombot' as CardExtId, 'onFight', reverseShuffle);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'discard reshuffled into the deck');
    assert.deepStrictEqual(
      G.playerZones['0']!.deck,
      [heroC, heroB, heroA],
      'deck formed from the reversed discard (was a silent no-op pre-WP-478)',
    );
    assert.equal(G.pendingScryKoChoices?.length, 1, 'a look-2 choice is now parked');
    assert.deepStrictEqual(
      G.pendingScryKoChoices![0]!.revealedCardIds,
      [heroC, heroB],
      'the top two of the reshuffled deck',
    );
    assert.deepStrictEqual(G.ko, [], 'nothing KO’d yet — the player chooses');
  });

  it('WP-478: tops up a single-card deck from the discard to a real look-2 park', () => {
    const soleCard = 'core/x/sole#0' as CardExtId;
    const fromDiscard = 'core/x/disc#0' as CardExtId;
    const G = makeG({
      hooks: [scryHook('hm-doombot')],
      playerZones: {
        '0': { deck: [soleCard], hand: [], discard: [fromDiscard], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'hm-doombot' as CardExtId, 'onFight', reverseShuffle);
    // why: pre-WP-478 a 1-card deck auto-KO'd the sole card; now it tops up to a real
    // look-2 (the retained card stays on top, the reshuffled card slides in beneath).
    assert.equal(G.pendingScryKoChoices?.length, 1, 'now a real look-2 choice, not a sole-card auto-KO');
    assert.deepStrictEqual(
      G.pendingScryKoChoices![0]!.revealedCardIds,
      [soleCard, fromDiscard],
      'the retained card plus the reshuffled one',
    );
    assert.deepStrictEqual(G.ko, [], 'nothing auto-KO’d — the player now chooses');
  });

  it('WP-478: still a reachable no-op when deck AND discard are both empty', () => {
    const G = makeG({
      hooks: [scryHook('hm-doombot')],
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'hm-doombot' as CardExtId, 'onFight', reverseShuffle);
    assert.deepStrictEqual(G.ko, [], 'nothing KO’d');
    assert.equal(G.pendingScryKoChoices?.length ?? 0, 0, 'no choice parked — nothing anywhere to look at');
  });
});

describe('executeVillainAbilities — ko-cullable-each-deck-top (WP-519 / D-24332)', () => {
  const WOUND_TOP = 'pile-wound' as CardExtId;
  const AGENT = 'starting-shield-agent' as CardExtId;
  const TROOPER = 'starting-shield-trooper' as CardExtId;
  const OFFICER = 'pile-shield-officer' as CardExtId;
  const HERO_A = 'core/spider-man/spider-man#0' as CardExtId;
  const HERO_B = 'core/iron-man/iron-man#0' as CardExtId;

  // why: ko-cullable-each-deck-top is keyword-less, so the hook() helper (which reads
  // LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR) cannot build it — construct the descriptor
  // hook directly, mirroring scryHook.
  function melterHook(cardId: string): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onFight',
      keywords: [],
      effects: [{ primitive: 'ko-cullable-each-deck-top' }],
    };
  }

  // why: a deterministic reverse "shuffle" so the reshuffle-on-empty path is testable
  // (matches the scry / draw-cards reshuffle test doubles).
  const reverseShuffle: ShuffleProvider = {
    random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
  };

  it("KOs each player's cullable deck top (Wound / basic starter) and keeps real Heroes (AC-1/AC-2)", () => {
    const G = makeG({
      hooks: [melterHook('v-melter')],
      playerZones: {
        '0': { deck: [WOUND_TOP, HERO_A], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [HERO_B, TROOPER], hand: [], discard: [], inPlay: [], victory: [] },
        '2': { deck: [AGENT], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-melter' as CardExtId, 'onFight');
    // P0: Wound top culled, Hero kept beneath. P1: real-Hero top kept — only the TOP
    // card is revealed, so the buried Trooper is untouched. P2: basic Agent culled.
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A], 'P0 Wound culled, Hero kept');
    assert.deepStrictEqual(
      G.playerZones['1']!.deck,
      [HERO_B, TROOPER],
      'P1 real-Hero top kept; only the top card is revealed',
    );
    assert.deepStrictEqual(G.playerZones['2']!.deck, [], 'P2 basic Agent culled');
    assert.deepStrictEqual(G.ko, [WOUND_TOP, AGENT], 'culled cards go to G.ko in sorted-player order');
  });

  it('keeps the recruited S.H.I.E.L.D. Officer (not a basic starter)', () => {
    const G = makeG({
      hooks: [melterHook('v-melter')],
      playerZones: {
        '0': { deck: [OFFICER], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-melter' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [OFFICER], 'the Officer is kept, never culled');
    assert.deepStrictEqual(G.ko, [], 'nothing culled');
  });

  it('reveals every player deck top and reshuffles an empty deck first (AC-3)', () => {
    const G = makeG({
      hooks: [melterHook('v-melter')],
      playerZones: {
        // why: P0 deck empty with a Wound in discard — the reshuffle must bring it up.
        '0': { deck: [], hand: [], discard: [WOUND_TOP], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-melter' as CardExtId, 'onFight', reverseShuffle);
    // reverseShuffle([WOUND]) === [WOUND] appended under the empty deck → top = Wound → culled.
    assert.deepStrictEqual(G.ko, [WOUND_TOP], 'the reshuffled Wound is revealed and culled');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [], 'deck empty after culling the sole reshuffled card');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'discard consumed by the reshuffle');
  });

  it('no-ops for a player with empty deck AND empty discard — no crash, no hollow (AC-3)', () => {
    const G = makeG({
      hooks: [melterHook('v-melter')],
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-melter' as CardExtId, 'onFight', reverseShuffle);
    assert.deepStrictEqual(G.ko, [], 'nothing to reveal or cull');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'reachable no-op, not a hollow');
  });

  it('self-narrates an applied line naming the culled cards and records NO hollow (AC-1/AC-6)', () => {
    const G = makeG({
      hooks: [melterHook('v-melter')],
      playerZones: {
        '0': { deck: [WOUND_TOP, HERO_A], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
      cardDisplayData: { [WOUND_TOP]: { name: 'Wound' } },
    });
    executeVillainAbilities(G, CTX, 'v-melter' as CardExtId, 'onFight');
    const last = G.messages![G.messages!.length - 1]!;
    assert.match(last.text, /Fight effect: KO'd 1 card\(s\)/, 'names the culled count');
    assert.match(last.text, /Wound/, 'names the culled card');
    assert.equal(last.outcome, 'applied');
    // why: the marked line now carries a descriptor, so the D-24266 unmarked-ability
    // detector records NO `no-handler` hollow — the live-surfaced breadcrumb is gone.
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'marked line → no unmarked-ability hollow');
  });

  it('self-narrates a blocked no-op when no deck top is cullable (real Heroes only)', () => {
    const G = makeG({
      hooks: [melterHook('v-melter')],
      playerZones: {
        '0': { deck: [HERO_A], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [HERO_B], hand: [], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-melter' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.ko, [], 'no real Hero is ever culled');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A], 'P0 Hero kept on top');
    assert.deepStrictEqual(G.playerZones['1']!.deck, [HERO_B], 'P1 Hero kept on top');
    const last = G.messages![G.messages!.length - 1]!;
    assert.match(last.text, /nothing worth KO/);
    assert.equal(last.outcome, 'blocked');
  });
});

describe('executeVillainAbilities — reveal-or-wound (WP-469 / D-24281)', () => {
  const XMEN = 'core/wolverine/wolverine#0' as CardExtId; // team x-men
  const RANGED = 'core/hawkeye/hawkeye#0' as CardExtId; // hero-class ranged
  const PLAIN = 'core/spider-man/spider-man#0' as CardExtId; // matches neither predicate

  const TRAITS: Record<string, { heroClass: string | null; team: string | null }> = {
    [XMEN]: { heroClass: 'covert', team: 'x-men' },
    [RANGED]: { heroClass: 'ranged', team: 'avengers' },
    [PLAIN]: { heroClass: 'covert', team: 'spider-friends' },
  };

  /** A player-zone with only hand + inPlay populated (the two the test varies). */
  function zone(hand: CardExtId[] = [], inPlay: CardExtId[] = []) {
    return { deck: [], hand, discard: [], inPlay, victory: [] };
  }

  // why: reveal-or-wound is not a legacy keyword, so the `hook()` helper cannot
  // build it — construct the predicate-bearing descriptor hook directly.
  function rowHook(
    cardId: string,
    timing: 'onAmbush' | 'onFight' | 'onEscape',
    requireKind: 'team' | 'hero-class',
    requireValue: string,
  ): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing,
      keywords: [],
      effects: [{ primitive: 'reveal-or-wound', requireKind, requireValue }],
    };
  }

  it('AC-3 team predicate (D-24281 amended): an X-Men Hero in HAND or IN PLAY avoids the Wound; none anywhere gains one', () => {
    const G = makeG({
      hooks: [rowHook('v-sabretooth', 'onFight', 'team', 'x-men')],
      playerZones: {
        '0': zone([XMEN]), // X-Men in hand → no wound
        '1': zone([], [XMEN]), // X-Men ONLY in play → now counts → no wound (the bug fix)
        '2': zone([PLAIN]), // no X-Men in hand or play → wounded
      },
      wounds: [WOUND, 'w1' as CardExtId],
      cardTraits: TRAITS,
    });
    executeVillainAbilities(G, CTX, 'v-sabretooth' as CardExtId, 'onFight');
    assert.equal(G.playerZones['0']!.discard.length, 0, 'hand X-Men avoids the wound');
    assert.equal(G.playerZones['1']!.discard.length, 0, 'in-play X-Men now satisfies the reveal — no wound');
    assert.equal(G.playerZones['2']!.discard.length, 1, 'no X-Men in hand or play → wounded');
    assert.equal(G.piles.wounds.length, 1, 'exactly one wound left the pile');
  });

  it('AC-4 hero-class predicate over two players wounds only the one lacking a Ranged Hero (sorted order)', () => {
    const G = makeG({
      hooks: [rowHook('v-frost', 'onFight', 'hero-class', 'ranged')],
      playerZones: {
        '0': zone([RANGED]), // reveals
        '1': zone([PLAIN]), // no ranged → wounded
      },
      wounds: [WOUND, 'w1' as CardExtId],
      cardTraits: TRAITS,
    });
    executeVillainAbilities(G, CTX, 'v-frost' as CardExtId, 'onFight');
    assert.equal(G.playerZones['0']!.discard.length, 0, 'ranged-holder unaffected');
    assert.equal(G.playerZones['1']!.discard.length, 1, 'ranged-less player wounded');
    assert.equal(G.piles.wounds.length, 1);
  });

  it('AC-5 empty wound pile → a no-match player takes no wound and no hollow is recorded', () => {
    const G = makeG({
      hooks: [rowHook('v-x', 'onFight', 'team', 'x-men')],
      playerZones: { '0': zone([PLAIN]), '1': zone([XMEN]) },
      wounds: [],
      cardTraits: TRAITS,
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');
    assert.equal(G.playerZones['0']!.discard.length, 0, 'no wound gained from an empty pile');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'reachable no-op, never hollow');
  });

  it('AC-5 woundsDrawn bumps only when the CURRENT player is the wounded one', () => {
    // current player (0) has no match → wounded → woundsDrawn +1
    const currentWounded = makeG({
      hooks: [rowHook('v-x', 'onFight', 'team', 'x-men')],
      playerZones: { '0': zone([PLAIN]), '1': zone([XMEN]) },
      wounds: [WOUND, 'w1' as CardExtId],
      cardTraits: TRAITS,
    });
    executeVillainAbilities(currentWounded, CTX, 'v-x' as CardExtId, 'onFight');
    assert.equal(currentWounded.playerZones['0']!.discard.length, 1);
    assert.equal(currentWounded.turnEconomy.woundsDrawn, 1, 'current-player wound is projected');

    // only the non-current player (1) is wounded → woundsDrawn stays 0
    const otherWounded = makeG({
      hooks: [rowHook('v-x', 'onFight', 'team', 'x-men')],
      playerZones: { '0': zone([XMEN]), '1': zone([PLAIN]) },
      wounds: [WOUND, 'w1' as CardExtId],
      cardTraits: TRAITS,
    });
    executeVillainAbilities(otherWounded, CTX, 'v-x' as CardExtId, 'onFight');
    assert.equal(otherWounded.playerZones['1']!.discard.length, 1);
    assert.equal(otherWounded.turnEconomy.woundsDrawn, 0, 'a non-current wound is NOT projected');
  });

  it('AC-6 a marked reveal-or-wound line records NO unmarked-ability breadcrumb at Fight AND at Escape', () => {
    for (const timing of ['onFight', 'onEscape'] as const) {
      const G = makeG({
        hooks: [rowHook('brotherhood-sabretooth', timing, 'team', 'x-men')],
        playerZones: { '0': zone([XMEN]), '1': zone([XMEN]) },
        wounds: [WOUND],
        cardTraits: TRAITS,
      });
      executeVillainAbilities(G, CTX, 'brotherhood-sabretooth' as CardExtId, timing);
      assert.equal(
        G.diagnostics?.hollowEffects?.length ?? 0,
        0,
        `no unmarked-ability breadcrumb at ${timing} — the line is handled`,
      );
    }
  });

  it('AC-7 narrates the wounded template naming players and records no keyword result', () => {
    const G = makeG({
      hooks: [rowHook('v-x', 'onFight', 'team', 'x-men')],
      playerZones: { '0': zone([PLAIN]), '1': zone([PLAIN]) }, // both wounded
      wounds: [WOUND, 'w1' as CardExtId, 'w2' as CardExtId],
      cardTraits: TRAITS,
      messages: [],
    });
    const results = executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');
    assert.equal(G.messages!.length, 1, 'exactly one log line pushed');
    assert.match(
      G.messages![0]!.text,
      /Fight effect: 2 player\(s\) had no matching Hero and gained a Wound \(Player 0, Player 1\)\./,
    );
    assert.equal(G.messages![0]!.outcome, 'applied', 'the villain effect landed → applied');
    // why: AC-7 — reveal-or-wound is keyword-less, so it self-narrates and emits
    // NO VillainEffectResult (descriptorToLegacyKeyword → undefined).
    assert.deepStrictEqual(results, [], 'no keyword-typed result recorded');
  });

  it('AC-7 narrates the all-revealed template when every player reveals (nobody wounded)', () => {
    const G = makeG({
      hooks: [rowHook('v-x', 'onEscape', 'hero-class', 'ranged')],
      playerZones: { '0': zone([RANGED]), '1': zone([RANGED]) },
      wounds: [WOUND],
      cardTraits: TRAITS,
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onEscape');
    assert.equal(G.playerZones['0']!.discard.length, 0);
    assert.equal(G.playerZones['1']!.discard.length, 0);
    assert.equal(G.messages!.length, 1, 'exactly one log line pushed');
    assert.match(G.messages![0]!.text, /Escape effect: every player revealed a matching Hero\./);
    assert.equal(G.messages![0]!.outcome, 'blocked', 'no wound landed → blocked');
    assert.equal(G.piles.wounds.length, 1, 'wound pile untouched');
  });
});

describe('executeVillainAbilities — draw-cards-current (WP-485 / D-24290)', () => {
  const reverseShuffle: ShuffleProvider = {
    random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
  };

  function drawHook(cardId: string, drawCount: number): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onFight',
      keywords: [],
      effects: [{ primitive: 'draw-cards-current', drawCount }],
    };
  }

  it('AC-1 the current player draws N cards from their deck and the log records it', () => {
    const a = 'core/x/a#0' as CardExtId;
    const b = 'core/x/b#0' as CardExtId;
    const c = 'core/x/c#0' as CardExtId;
    const d = 'core/x/d#0' as CardExtId;
    const G = makeG({
      hooks: [drawHook('v-enchantress', 3)],
      playerZones: {
        '0': { deck: [a, b, c, d], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
    });
    const results = executeVillainAbilities(G, CTX, 'v-enchantress' as CardExtId, 'onFight', reverseShuffle);
    assert.deepStrictEqual(G.playerZones['0']!.hand, [a, b, c], 'drew the top three cards');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [d], 'the fourth stays on the deck');
    assert.equal(G.playerZones['1']!.hand.length, 0, 'only the current player draws');
    assert.equal(G.messages!.length, 1, 'one self-narrated log line');
    assert.match(G.messages![0]!.text, /Fight effect: drew 3 card\(s\)\./);
    assert.equal(G.messages![0]!.outcome, 'applied');
    // why: draw-cards-current is keyword-less → no VillainEffectResult recorded.
    assert.deepStrictEqual(results, [], 'no keyword-typed result recorded');
  });

  it('reshuffles the discard when the deck runs short mid-draw (deterministic)', () => {
    const top = 'core/x/top#0' as CardExtId;
    const disc1 = 'core/x/d1#0' as CardExtId;
    const disc2 = 'core/x/d2#0' as CardExtId;
    const G = makeG({
      hooks: [drawHook('v-enchantress', 3)],
      playerZones: {
        '0': { deck: [top], hand: [], discard: [disc1, disc2], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-enchantress' as CardExtId, 'onFight', reverseShuffle);
    // why: draws `top`, then the empty deck reshuffles the reversed discard
    // [disc2, disc1] and draws both — proving the reshuffle ran deterministically.
    assert.deepStrictEqual(G.playerZones['0']!.hand, [top, disc2, disc1], 'drew across the reshuffle');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'discard consumed by the reshuffle');
  });

  it('draws fewer than N (never throws) when deck + discard run dry', () => {
    const only = 'core/x/only#0' as CardExtId;
    const G = makeG({
      hooks: [drawHook('v-enchantress', 3)],
      playerZones: {
        '0': { deck: [only], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-enchantress' as CardExtId, 'onFight', reverseShuffle);
    assert.deepStrictEqual(G.playerZones['0']!.hand, [only], 'drew the one available card');
    assert.match(G.messages![0]!.text, /Fight effect: drew 1 card\(s\)\./);
  });

  it('no-ops (never throws) when no shuffleContext is threaded (EC-520 guard)', () => {
    const a = 'core/x/a#0' as CardExtId;
    const G = makeG({
      hooks: [drawHook('v-enchantress', 3)],
      playerZones: {
        '0': { deck: [a], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
    });
    // why: EC-520 — omitting shuffleContext must no-op, not throw (drawCardsIntoHand
    // requires a ShuffleProvider; the handler guards rather than loosening it).
    assert.doesNotThrow(() =>
      executeVillainAbilities(G, CTX, 'v-enchantress' as CardExtId, 'onFight'),
    );
    assert.deepStrictEqual(G.playerZones['0']!.hand, [], 'nothing drawn without a shuffle source');
  });
});

describe('executeVillainAbilities — ko-heroes-current-by-trait (WP-485 / D-24290)', () => {
  const SHIELD_A = 'core/shield/a#0' as CardExtId;
  const SHIELD_B = 'core/shield/b#0' as CardExtId;
  const OTHER = 'core/x-men/wolverine#0' as CardExtId;
  const TRAITS: Record<string, { heroClass: string | null; team: string | null }> = {
    [SHIELD_A]: { heroClass: 'covert', team: 'shield' },
    [SHIELD_B]: { heroClass: 'ranged', team: 'shield' },
    [OTHER]: { heroClass: 'covert', team: 'x-men' },
  };

  function kotHook(cardId: string): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onFight',
      keywords: [],
      effects: [
        { primitive: 'ko-heroes-current-by-trait', requireKind: 'team', requireValue: 'shield' },
      ],
    };
  }

  it('AC-2 KOs every matching hero from BOTH hand and in-play, leaving non-matching', () => {
    const G = makeG({
      hooks: [kotHook('v-destroyer')],
      playerZones: {
        '0': {
          deck: [],
          hand: [SHIELD_A, OTHER],
          discard: [SHIELD_B], // discard is NOT scanned — this must survive
          inPlay: [SHIELD_B, OTHER],
          victory: [],
        },
        '1': { deck: [], hand: [SHIELD_A], discard: [], inPlay: [], victory: [] },
      },
      cardTraits: TRAITS,
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-destroyer' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.playerZones['0']!.hand, [OTHER], 'SHIELD hero KO’d from hand');
    assert.deepStrictEqual(G.playerZones['0']!.inPlay, [OTHER], 'SHIELD hero KO’d from in-play');
    assert.deepStrictEqual(
      G.playerZones['0']!.discard,
      [SHIELD_B],
      'discard is out of scope — its SHIELD hero survives',
    );
    assert.deepStrictEqual(G.ko, [SHIELD_A, SHIELD_B], 'both SHIELD heroes KO’d (hand then in-play order)');
    assert.deepStrictEqual(
      G.playerZones['1']!.hand,
      [SHIELD_A],
      'only the current player is affected',
    );
    assert.match(G.messages![0]!.text, /Fight effect: KO'd 2 of your shield Hero\(es\)\./);
    assert.equal(G.messages![0]!.outcome, 'applied');
  });

  it('AC-2 a player with no matching hero no-ops cleanly (no KO, no hollow)', () => {
    const G = makeG({
      hooks: [kotHook('v-destroyer')],
      playerZones: {
        '0': { deck: [], hand: [OTHER], discard: [], inPlay: [OTHER], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      cardTraits: TRAITS,
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-destroyer' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.ko, [], 'nothing KO’d');
    assert.deepStrictEqual(G.playerZones['0']!.hand, [OTHER], 'non-matching hero stays');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'reachable no-op, never hollow');
    assert.match(G.messages![0]!.text, /Fight effect: KO'd 0 of your shield Hero\(es\)\./);
    assert.equal(G.messages![0]!.outcome, 'blocked');
  });
});

describe('executeVillainAbilities — ko-heroes-current-by-trait basic-S.H.I.E.L.D. widening (WP-490 / D-24296)', () => {
  // why: the three basic S.H.I.E.L.D. cards are synthetic game components with NO
  // G.cardTraits entry, so the generic team predicate misses them — the live
  // Loki/Thor 2p bug (2026-08-03) where Destroyer KO'd 0 despite the player holding
  // S.H.I.E.L.D. Agents/Troopers. The KO handler is widened to name them for a
  // team:shield predicate ONLY.
  const AGENT = 'starting-shield-agent' as CardExtId;
  const TROOPER = 'starting-shield-trooper' as CardExtId;
  const OFFICER = 'pile-shield-officer' as CardExtId;
  const REGISTRY_SHIELD = 'core/shield/nick-fury#0' as CardExtId;
  const OTHER = 'core/x-men/wolverine#0' as CardExtId;
  // why: NO entry for the three basic-S.H.I.E.L.D. ext_ids — exactly the live data
  // shape (teamless). REGISTRY_SHIELD carries a real team:shield trait; OTHER does not.
  const TRAITS: Record<string, { heroClass: string | null; team: string | null }> = {
    [REGISTRY_SHIELD]: { heroClass: 'covert', team: 'shield' },
    [OTHER]: { heroClass: 'covert', team: 'x-men' },
  };

  function destroyerHook(cardId: string): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onFight',
      keywords: [],
      effects: [
        { primitive: 'ko-heroes-current-by-trait', requireKind: 'team', requireValue: 'shield' },
      ],
    };
  }

  it('KOs the teamless basic S.H.I.E.L.D. cards (Agent/Trooper/Officer) from hand + in-play', () => {
    const G = makeG({
      hooks: [destroyerHook('v-destroyer')],
      playerZones: {
        '0': {
          deck: [],
          hand: [AGENT, OTHER],
          discard: [TROOPER], // discard out of scope — survives
          inPlay: [TROOPER, OFFICER, OTHER],
          victory: [],
        },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      cardTraits: TRAITS,
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-destroyer' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.playerZones['0']!.hand, [OTHER], 'Agent KO’d from hand');
    assert.deepStrictEqual(G.playerZones['0']!.inPlay, [OTHER], 'Trooper + Officer KO’d from in-play');
    assert.deepStrictEqual(
      G.playerZones['0']!.discard,
      [TROOPER],
      'discard is out of scope — its S.H.I.E.L.D. card survives',
    );
    assert.deepStrictEqual(G.ko, [AGENT, TROOPER, OFFICER], 'all three basic S.H.I.E.L.D. cards KO’d');
    assert.match(G.messages![0]!.text, /Fight effect: KO'd 3 of your shield Hero\(es\)\./);
    assert.equal(G.messages![0]!.outcome, 'applied');
  });

  it('KOs registry team:shield heroes AND basic S.H.I.E.L.D. cards together', () => {
    const G = makeG({
      hooks: [destroyerHook('v-destroyer')],
      playerZones: {
        '0': { deck: [], hand: [REGISTRY_SHIELD, AGENT], discard: [], inPlay: [OTHER], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      cardTraits: TRAITS,
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-destroyer' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.playerZones['0']!.hand, [], 'both S.H.I.E.L.D. heroes KO’d from hand');
    assert.deepStrictEqual(G.playerZones['0']!.inPlay, [OTHER], 'the x-men hero stays');
    assert.deepStrictEqual(G.ko, [REGISTRY_SHIELD, AGENT], 'registry + basic S.H.I.E.L.D. both KO’d');
  });

  it('the widening is team:shield ONLY — a hero-class predicate never KOs basic S.H.I.E.L.D. cards', () => {
    const G = makeG({
      hooks: [
        {
          cardId: 'v-hc' as CardExtId,
          timing: 'onFight',
          keywords: [],
          effects: [
            // why: a hero-class predicate must NOT rescue the teamless basic
            // S.H.I.E.L.D. cards — only a team:shield predicate does.
            { primitive: 'ko-heroes-current-by-trait', requireKind: 'hero-class', requireValue: 'shield' },
          ],
        },
      ],
      playerZones: {
        '0': { deck: [], hand: [AGENT, TROOPER, OFFICER], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      cardTraits: TRAITS,
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-hc' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.ko, [], 'no basic S.H.I.E.L.D. card KO’d under a hero-class predicate');
    assert.deepStrictEqual(
      G.playerZones['0']!.hand,
      [AGENT, TROOPER, OFFICER],
      'all three basic S.H.I.E.L.D. cards survive a hero-class predicate',
    );
  });
});

describe('executeVillainAbilities — rescue-bystanders-current-by-trait-count (WP-485 / D-24290)', () => {
  const AV_A = 'core/avengers/cap#0' as CardExtId;
  const AV_B = 'core/avengers/thor#0' as CardExtId;
  const OTHER = 'core/x-men/wolverine#0' as CardExtId;
  const TRAITS: Record<string, { heroClass: string | null; team: string | null }> = {
    [AV_A]: { heroClass: 'strength', team: 'avengers' },
    [AV_B]: { heroClass: 'ranged', team: 'avengers' },
    [OTHER]: { heroClass: 'covert', team: 'x-men' },
  };

  function zemoHook(cardId: string): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onFight',
      keywords: [],
      effects: [
        {
          primitive: 'rescue-bystanders-current-by-trait-count',
          requireKind: 'team',
          requireValue: 'avengers',
        },
      ],
    };
  }

  it('AC-3 rescues one Bystander per matching hero (hand + in-play) into the victory pile', () => {
    const bystanders = ['bys0', 'bys1', 'bys2'] as CardExtId[];
    const G = makeG({
      hooks: [zemoHook('v-zemo')],
      playerZones: {
        '0': { deck: [], hand: [AV_A, OTHER], discard: [], inPlay: [AV_B], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      bystanders,
      messages: [],
      cardTraits: TRAITS,
    });
    executeVillainAbilities(G, CTX, 'v-zemo' as CardExtId, 'onFight');
    assert.equal(G.playerZones['0']!.victory.length, 2, 'two Avengers → two Bystanders rescued');
    assert.equal(G.piles.bystanders.length, 1, 'the supply dropped by two');
    assert.deepStrictEqual(G.attachedBystanders, {}, 'no stranded attachment left on the villain');
    assert.match(G.messages![0]!.text, /Fight effect: rescued 2 Bystander\(s\) \(one per your avengers Hero\)\./);
    assert.equal(G.messages![0]!.outcome, 'applied');
  });

  it('AC-3 is bounded by the Bystander supply', () => {
    const G = makeG({
      hooks: [zemoHook('v-zemo')],
      playerZones: {
        '0': { deck: [], hand: [AV_A, AV_B], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      bystanders: ['bys0'] as CardExtId[], // supply of 1, two Avengers
      messages: [],
      cardTraits: TRAITS,
    });
    executeVillainAbilities(G, CTX, 'v-zemo' as CardExtId, 'onFight');
    assert.equal(G.playerZones['0']!.victory.length, 1, 'only one Bystander available to rescue');
    assert.equal(G.piles.bystanders.length, 0, 'supply exhausted');
    assert.match(G.messages![0]!.text, /Fight effect: rescued 1 Bystander\(s\)/);
  });

  it('AC-3 zero matching heroes rescues nothing (no error)', () => {
    const G = makeG({
      hooks: [zemoHook('v-zemo')],
      playerZones: {
        '0': { deck: [], hand: [OTHER], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      bystanders: ['bys0', 'bys1'] as CardExtId[],
      messages: [],
      cardTraits: TRAITS,
    });
    executeVillainAbilities(G, CTX, 'v-zemo' as CardExtId, 'onFight');
    assert.equal(G.playerZones['0']!.victory.length, 0, 'no Avengers → no rescue');
    assert.equal(G.piles.bystanders.length, 2, 'supply untouched');
    assert.match(G.messages![0]!.text, /Fight effect: rescued 0 Bystander\(s\)/);
    assert.equal(G.messages![0]!.outcome, 'blocked');
  });
});

describe('executeVillainAbilities — gain-attached-hero no-op (WP-450 / D-24270)', () => {
  // why: gain-attached-hero is a deliberate no-op — the real hero return is the
  // generic awardAttachedHeroes at the fight site (WP-431). Build the descriptor
  // hook directly (it is not a legacy keyword, so the `hook()` helper can't).
  function gainAttachedHeroHook(cardId: string): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onFight',
      keywords: [],
      effects: [{ primitive: 'gain-attached-hero' }],
    };
  }

  it('fires the no-op handler: no G mutation and NO hollow record (classified applied)', () => {
    const G = makeG({
      hooks: [gainAttachedHeroHook('core-villain-skrulls-skrull-queen-veranke-00')],
      wounds: ['w0'] as CardExtId[],
      ko: ['k0'] as CardExtId[],
    });
    executeVillainAbilities(
      G,
      CTX,
      'core-villain-skrulls-skrull-queen-veranke-00' as CardExtId,
      'onFight',
    );
    // why: the handler mutates nothing — the award is the generic WP-431 path.
    assert.deepStrictEqual(G.ko, ['k0'], 'KO pile unchanged');
    assert.equal(G.piles.wounds.length, 1, 'wound pile unchanged');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'no zone mutation');
    // why: AC-3/AC-4 — the marked line is a recognized reachable effect, so the
    // D-24266 detector records NO breadcrumb (neither unmarked-ability nor
    // no-handler). The false positive is closed.
    assert.equal(
      G.diagnostics?.hollowEffects?.length ?? 0,
      0,
      'no hollow record for a recognized, applied effect',
    );
  });

  it('records NO unmarked-ability breadcrumb (the D-24266 false positive is gone)', () => {
    // why: before WP-450 this same fired hook (empty effects) recorded a
    // no-handler unmarked-ability breadcrumb; with the gain-attached-hero
    // descriptor present the detector must stay silent. AC-4.
    const G = makeG({
      hooks: [gainAttachedHeroHook('rvlt-villain-army-of-evil-klaw-00')],
    });
    executeVillainAbilities(G, CTX, 'rvlt-villain-army-of-evil-klaw-00' as CardExtId, 'onFight');
    const hollow = G.diagnostics?.hollowEffects ?? [];
    assert.equal(hollow.length, 0, 'no unmarked-ability breadcrumb for the marked Fight line');
  });
});

describe('executeVillainAbilities — ko-hero:each:N:zone (WP-463 / D-24280)', () => {
  const WOUND = 'pile-wound' as CardExtId;
  const AGENT = 'starting-shield-agent' as CardExtId;

  // why: zone-restricted each KO is a parameterized descriptor, not a legacy
  // keyword — build the hook directly (the `hook()` helper reads legacy keywords).
  function zoneHook(cardId: string, timing: 'onAmbush' | 'onEscape', zone: 'discard' | 'hand'): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing,
      keywords: [],
      effects: [{ primitive: 'ko-hero', target: 'each', magnitude: 2, zone }],
    };
  }

  it('discard zone: KOs two worst heroes from discard only, leaving the hand untouched (AC-3)', () => {
    const heroDisc = 'core/x/deep#0' as CardExtId;
    const heroHand = 'core/x/hand#0' as CardExtId;
    const G = makeG({
      hooks: [zoneHook('v-jugg', 'onAmbush', 'discard')],
      playerZones: {
        '0': { deck: [], hand: [heroHand], discard: [WOUND, AGENT, heroDisc], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-jugg' as CardExtId, 'onAmbush');
    // why: AC-3 — Wound excluded, starter-first (AGENT), then the recruited hero;
    // magnitude 2 KOs AGENT + heroDisc, leaving the Wound on the discard.
    assert.deepStrictEqual(G.ko, [AGENT, heroDisc], 'the two worst discard heroes KOd, in order');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [WOUND], 'Wound stays — not a Hero');
    assert.deepStrictEqual(G.playerZones['0']!.hand, [heroHand], 'hand untouched (no cross-zone fallback)');
  });

  it('hand zone: KOs from hand only, leaving a non-empty discard byte-unchanged (AC-8 no-crossover)', () => {
    // why: the direction mirror — the legacy resolver checks discard FIRST, so a
    // naive zone-lock could still drain discard on the Escape line. This pins it.
    const heroHandA = 'core/x/a#0' as CardExtId;
    const heroHandB = 'core/x/b#0' as CardExtId;
    const heroDisc = 'core/x/keep#0' as CardExtId;
    const G = makeG({
      hooks: [zoneHook('v-jugg', 'onEscape', 'hand')],
      playerZones: {
        '0': { deck: [], hand: [heroHandB, heroHandA], discard: [heroDisc], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-jugg' as CardExtId, 'onEscape');
    assert.deepStrictEqual(G.ko, [heroHandA, heroHandB], 'both hand heroes KOd (lex-asc), from hand only');
    assert.deepStrictEqual(G.playerZones['0']!.hand, [], 'hand emptied of heroes');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [heroDisc], 'discard byte-unchanged — no crossover');
  });

  it('magnitude cap + reachable no-op: short/empty zone KOs fewer/none and records NO hollow (AC-4)', () => {
    const only = 'core/x/only#0' as CardExtId;
    const shortG = makeG({
      hooks: [zoneHook('v-jugg', 'onAmbush', 'discard')],
      playerZones: {
        '0': { deck: [], hand: [], discard: [only], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(shortG, CTX, 'v-jugg' as CardExtId, 'onAmbush');
    assert.deepStrictEqual(shortG.ko, [only], 'a 1-hero discard KOs one and stops (no fallback)');

    const emptyG = makeG({
      hooks: [zoneHook('v-jugg', 'onAmbush', 'discard')],
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(emptyG, CTX, 'v-jugg' as CardExtId, 'onAmbush');
    assert.deepStrictEqual(emptyG.ko, [], 'empty discard → nothing KOd');
    assert.equal(
      emptyG.diagnostics?.hollowEffects?.length ?? 0,
      0,
      'a reachable no-op records NO hollow effect',
    );
  });

  it('each-player: KOs from EVERY player’s named zone, not just the current player (AC-5)', () => {
    const h0 = 'core/x/p0#0' as CardExtId;
    const h1 = 'core/x/p1#0' as CardExtId;
    const G = makeG({
      hooks: [zoneHook('v-jugg', 'onAmbush', 'discard')],
      playerZones: {
        '0': { deck: [], hand: [], discard: [h0], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [h1], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'v-jugg' as CardExtId, 'onAmbush');
    // why: AC-5 — sorted player order '0' then '1'; each loses their discard hero.
    assert.deepStrictEqual(G.ko, [h0, h1]);
    assert.deepStrictEqual(G.playerZones['0']!.discard, []);
    assert.deepStrictEqual(G.playerZones['1']!.discard, []);
  });

  it('narrates as koHeroEachPlayerMag2 with the KO’d ext_ids as targets (AC-7)', () => {
    const hero = 'core/x/deep#0' as CardExtId;
    const G = makeG({
      hooks: [zoneHook('v-jugg', 'onAmbush', 'discard')],
      playerZones: {
        '0': { deck: [], hand: [], discard: [AGENT, hero], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    const results = executeVillainAbilities(G, CTX, 'v-jugg' as CardExtId, 'onAmbush');
    // why: AC-7 — the zone-bearing descriptor reverse-maps to the frozen keyword so
    // the fire site narrates per-target; no new narration path.
    assert.equal(results.length, 1);
    assert.equal(results[0]!.keyword, 'koHeroEachPlayerMag2');
    assert.deepStrictEqual(results[0]!.targets, [AGENT, hero]);
  });

  it('records NO unmarked-ability breadcrumb for the marked Juggernaut Ambush (AC-6)', () => {
    const hero = 'core/x/deep#0' as CardExtId;
    const G = makeG({
      hooks: [zoneHook('core-villain-brotherhood-juggernaut-00', 'onAmbush', 'discard')],
      playerZones: {
        '0': { deck: [], hand: [], discard: [hero], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    executeVillainAbilities(G, CTX, 'core-villain-brotherhood-juggernaut-00' as CardExtId, 'onAmbush');
    assert.deepStrictEqual(G.ko, [hero], 'the Ambush KO fired (a discard hero moved to KO)');
    assert.equal(
      G.diagnostics?.hollowEffects?.length ?? 0,
      0,
      'no unmarked-ability breadcrumb — the line is now handled',
    );
  });
});

describe('executeVillainAbilities — safe-skip paths', () => {
  it('no-ops (no mutation) a hook with empty effects but records a breadcrumb (D-24266)', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', [])],
      wounds: ['w0'] as CardExtId[],
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');
    assert.equal(G.piles.wounds.length, 1, 'no mutation from an empty-effects hook');
    // why: D-24266 — a printed timing line with no `[effect:]` marker is an
    // un-implemented mechanic; it mutates nothing but now leaves a `no-handler`
    // hollow breadcrumb rather than vanishing silently.
    assert.equal(G.diagnostics?.hollowEffects.length, 1, 'one hollow breadcrumb recorded');
    assert.equal(G.diagnostics?.hollowEffects[0]!.reason, 'no-handler');
    assert.equal(G.diagnostics?.hollowEffects[0]!.mechanic, 'unmarked-ability');
  });

  it('silently skips an out-of-vocabulary effect without throwing', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['notARealKeyword'])],
      wounds: ['w0'] as CardExtId[],
    });
    assert.doesNotThrow(() =>
      executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight'),
    );
    assert.equal(G.piles.wounds.length, 1, 'unknown effect causes no mutation');
  });

  it('no-ops when G.villainAbilityHooks is undefined (defensive guard)', () => {
    const G = makeG({});
    // why: simulate a pre-WP-185 / narrow test mock missing the field.
    (G as { villainAbilityHooks?: unknown }).villainAbilityHooks = undefined;
    assert.doesNotThrow(() =>
      executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight'),
    );
  });

  it('no-ops when no hook matches the cardId/timing', () => {
    const G = makeG({
      hooks: [hook('v-other', 'onFight', ['gainWoundCurrentPlayer'])],
      wounds: ['w0'] as CardExtId[],
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');
    assert.equal(G.piles.wounds.length, 1, 'non-matching cardId fires nothing');
  });
});

describe('executeVillainAbilities — onEscape dispatch (WP-186)', () => {
  it('gainWoundEachPlayer fires via onEscape dispatch (hook lookup by timing)', () => {
    // why: the executor is timing-agnostic and dispatches by per-card hook
    // lookup (`getVillainHooksForCard(cardId, timing)`); adding the onEscape
    // timing must reach the same effect-apply path with no executor-side
    // branching. Hook for 'v-escapee' onEscape with gainWoundEachPlayer →
    // every player gets one wound from the pool.
    const G = makeG({
      hooks: [hook('v-escapee', 'onEscape', ['gainWoundEachPlayer'])],
      wounds: ['w0', 'w1', 'w2'] as CardExtId[],
    });
    executeVillainAbilities(G, CTX, 'v-escapee' as CardExtId, 'onEscape');

    assert.equal(G.playerZones['0']!.discard.length, 1, 'player 0 gains a wound');
    assert.equal(G.playerZones['1']!.discard.length, 1, 'player 1 gains a wound');
    assert.equal(G.piles.wounds.length, 1, 'wound pile decreased by 2');
    assert.equal(G.turnEconomy.woundsDrawn, 1, 'only current player projected');
  });

  it('does not fire onAmbush or onFight hooks for the same card when called with onEscape', () => {
    // why: timing filter must isolate dispatch — the same card may carry
    // onAmbush and onFight hooks (from other ability lines); onEscape must
    // execute only the onEscape hooks.
    const G = makeG({
      hooks: [
        hook('v-x', 'onAmbush', ['gainWoundEachPlayer']),
        hook('v-x', 'onFight', ['koHeroCurrentPlayer']),
        hook('v-x', 'onEscape', ['gainWoundCurrentPlayer']),
      ],
      wounds: ['w0', 'w1'] as CardExtId[],
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onEscape');

    assert.equal(G.playerZones['0']!.discard.length, 1, 'current player gains a wound');
    assert.equal(G.playerZones['1']!.discard.length, 0, 'other player unaffected');
    assert.equal(G.piles.wounds.length, 1);
    assert.equal(G.turnEconomy.woundsDrawn, 1);
    assert.deepStrictEqual(G.ko, [], 'no KO — onFight hook did not fire');
  });

  it('captureBystander under onEscape attaches to the escaped card and does NOT auto-award (D-18603)', () => {
    // why: the executor auto-awards a captured bystander only on 'onFight'
    // (the Fight fire site runs post-award and would otherwise strand the
    // bystander). Under 'onEscape' the bystander attaches to the escaped
    // card now in G.escapedPile and follows it out of the city; the reveal
    // fire site calls executeVillainAbilities AFTER carryEscapedBystandersToPile
    // has carried the escaping card's pre-escape attachments into the escaped
    // pile, so this new attachment is to a clean slot.
    const G = makeG({
      hooks: [hook('v-escaped', 'onEscape', ['captureBystander'])],
      bystanders: ['b0', 'b1'] as CardExtId[],
    });
    executeVillainAbilities(G, CTX, 'v-escaped' as CardExtId, 'onEscape');

    assert.deepStrictEqual(
      G.attachedBystanders['v-escaped' as CardExtId],
      ['b0'],
      'captured bystander attaches to the escaped card (D-18603)',
    );
    assert.deepStrictEqual(G.piles.bystanders, ['b1'], 'one bystander drawn from supply');
    assert.deepStrictEqual(
      G.playerZones['0']!.victory,
      [],
      'no auto-award under onEscape — only onFight awards (timing branch)',
    );
  });

  it('does not mutate on an onEscape hook with empty effects, but records a breadcrumb (WP-188 line → D-24266)', () => {
    // why: WP-188 leaves unmarked escape lines marker-free with
    // reason:"no-vocabulary-keyword" (e.g. the each-player-KO pattern; D-18802).
    // The parser still emits a hook with effects:[] so the timing is recorded.
    // The executor touches no state (mutation-free), but D-24266 now records a
    // `no-handler` hollow breadcrumb so the deferred printed effect is visible in
    // the operator log instead of being silently dropped.
    const G = makeG({
      hooks: [hook('v-unmarked', 'onEscape', [])],
      wounds: ['w0'] as CardExtId[],
      bystanders: ['b0'] as CardExtId[],
    });
    executeVillainAbilities(G, CTX, 'v-unmarked' as CardExtId, 'onEscape');
    assert.equal(G.piles.wounds.length, 1, 'no mutation from an empty-effects hook');
    assert.equal(G.piles.bystanders.length, 1, 'bystander pile untouched');
    assert.deepStrictEqual(G.attachedBystanders, {});
    // why: D-24266 — the marker-free escape line is now observed as hollow.
    assert.equal(G.diagnostics?.hollowEffects.length, 1, 'one hollow breadcrumb recorded');
    assert.equal(G.diagnostics?.hollowEffects[0]!.reason, 'no-handler');
    assert.equal(G.diagnostics?.hollowEffects[0]!.timing, 'onEscape');
  });
});

describe('executeVillainAbilities — determinism', () => {
  it('produces identical state across two identical runs', () => {
    const build = () =>
      makeG({
        hooks: [hook('v-x', 'onFight', ['koHeroCurrentPlayer'])],
        playerZones: {
          '0': {
            deck: [],
            hand: [],
            discard: ['core-hero-b-00', 'core-hero-a-00'] as CardExtId[],
            inPlay: [],
            victory: [],
          },
          '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
        },
      });

    const first = build();
    executeVillainAbilities(first, CTX, 'v-x' as CardExtId, 'onFight');
    const second = build();
    executeVillainAbilities(second, CTX, 'v-x' as CardExtId, 'onFight');

    assert.equal(JSON.stringify(first), JSON.stringify(second));
  });
});

// ---------------------------------------------------------------------------
// WP-189: koHeroEachPlayer dispatch
// ---------------------------------------------------------------------------

describe('executeVillainAbilities — koHeroEachPlayer (WP-189)', () => {
  it('KOs exactly one hero from every player with ≥1 eligible hero; skips players with zero eligible heroes', () => {
    // why: 3-player fixture exercises the eligible-hero split per the
    // hardened §AC. Player 0: hero in discard (KO target). Player 1: hero
    // only in hand (KO falls through to hand). Player 2: wounds only (zero
    // eligible — silent skip). Expected: G.ko = [p0-discard-hero,
    // p1-hand-hero] in iteration order; player 2 unchanged.
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroEachPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: ['core-hero-p0-hand-z' as CardExtId],
          discard: ['core-hero-p0-disc-b' as CardExtId, 'core-hero-p0-disc-a' as CardExtId, WOUND],
          inPlay: [],
          victory: [],
        },
        '1': {
          deck: [],
          hand: ['core-hero-p1-hand-m' as CardExtId, 'core-hero-p1-hand-a' as CardExtId],
          discard: [WOUND],
          inPlay: [],
          victory: [],
        },
        '2': {
          deck: [],
          hand: [],
          discard: [WOUND],
          inPlay: [],
          victory: [],
        },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      G.ko,
      ['core-hero-p0-disc-a', 'core-hero-p1-hand-a'],
      'KOs in sorted-player order: player 0 from discard (lex-first non-wound), player 1 from hand (lex-first)',
    );
    assert.equal(
      G.playerZones['0']!.discard.includes('core-hero-p0-disc-a' as CardExtId),
      false,
      "player 0's chosen discard hero removed",
    );
    assert.equal(
      G.playerZones['1']!.hand.includes('core-hero-p1-hand-a' as CardExtId),
      false,
      "player 1's chosen hand hero removed",
    );
    assert.deepStrictEqual(
      G.playerZones['2']!.hand,
      [],
      'player 2 hand untouched (zero eligible heroes)',
    );
    assert.deepStrictEqual(
      G.playerZones['2']!.discard,
      [WOUND],
      'player 2 discard untouched (wound-only is zero eligible heroes)',
    );
  });

  it('player iteration is lexically sorted ascending (D-18902 — not insertion order)', () => {
    // why: the locked iteration contract uses Object.keys(G.playerZones).sort()
    // (default JavaScript string compare). For 1-5-player boardgame.io
    // string ids the orderings coincide observationally, but the explicit
    // sort is the auditable determinism contract. This test inserts the
    // players in REVERSED order ('2', '1', '0') to prove the dispatch
    // iterates in sorted order regardless of insertion order.
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroEachPlayer'])],
      playerZones: {
        '2': {
          deck: [],
          hand: [],
          discard: ['core-hero-z-z2' as CardExtId],
          inPlay: [],
          victory: [],
        },
        '1': {
          deck: [],
          hand: [],
          discard: ['core-hero-z-z1' as CardExtId],
          inPlay: [],
          victory: [],
        },
        '0': {
          deck: [],
          hand: [],
          discard: ['core-hero-z-z0' as CardExtId],
          inPlay: [],
          victory: [],
        },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      G.ko,
      ['core-hero-z-z0', 'core-hero-z-z1', 'core-hero-z-z2'],
      'G.ko mutation order matches sorted player ids (0, 1, 2), not insertion order (2, 1, 0)',
    );
  });

  it('bot-parity: legacy auto-resolution (koHeroEachPlayer) and the new selectDefaultKoTarget→resolve KO the SAME cardId (load-bearing)', () => {
    // why: WP-242 / D-24009 — the bot's KO target MUST be byte-identical to
    // today's auto-resolution. (a) Run the legacy resolver on a single-player
    // G via koHeroEachPlayer (it delegates to koOneHeroForPlayer) and capture
    // the KO'd cardId. (b) Run the new flow — selectDefaultKoTarget then
    // resolveKoHeroChoice with its result — and capture the KO'd cardId. The
    // two cardIds MUST be identical (the bot-determinism anchor).
    const buildZones = () => ({
      deck: ['core-hero-deck-d' as CardExtId],
      hand: ['core-hero-hand-h' as CardExtId, 'core-hero-hand-z' as CardExtId],
      discard: ['core-hero-disc-b' as CardExtId, 'core-hero-disc-a' as CardExtId, WOUND],
      inPlay: ['core-hero-play-p' as CardExtId],
      victory: ['core-hero-vict-v' as CardExtId],
    });

    // (a) legacy auto-resolution path
    const gLegacy = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroEachPlayer'])],
      playerZones: { '0': buildZones() },
    });
    executeVillainAbilities(gLegacy, CTX, 'v-x' as CardExtId, 'onFight');
    assert.equal(gLegacy.ko.length, 1, 'legacy resolver KOs exactly one card');
    const legacyKoId = gLegacy.ko[0];

    // (b) new selectDefaultKoTarget → resolveKoHeroChoice path
    const gNew = makeG({ playerZones: { '0': buildZones() } });
    gNew.pendingKoHeroChoices = [{ choiceType: 'ko-hero', playerID: '0' }];
    const defaultTarget = selectDefaultKoTarget(gNew.playerZones['0']!);
    assert.ok(defaultTarget !== null, 'a default target exists');
    resolveKoHeroChoice(
      { G: gNew, playerID: '0' } as unknown as Parameters<typeof resolveKoHeroChoice>[0],
      defaultTarget!,
    );
    assert.equal(gNew.ko.length, 1, 'new flow KOs exactly one card');
    const newKoId = gNew.ko[0];

    assert.equal(newKoId, legacyKoId, 'bot KO target is byte-identical to legacy auto-resolution');
    assert.equal(gNew.pendingKoHeroChoices.length, 0, 'new flow front-pops the resolved choice');
  });

  it('determinism (audit-exact): two identical dispatches produce identical KO targets, mutation order, and messages', () => {
    // why: the hardened §AC determinism criterion enumerates three deep-
    // equality classes: per-player KO target ext_ids, G.ko mutation order,
    // G.messages sequence. This test snapshots all three across two runs of
    // identical input G.
    const buildG = () =>
      makeG({
        hooks: [hook('v-x', 'onFight', ['koHeroEachPlayer'])],
        playerZones: {
          '0': {
            deck: [],
            hand: ['core-hero-p0-hand' as CardExtId],
            discard: ['core-hero-p0-d2' as CardExtId, 'core-hero-p0-d1' as CardExtId],
            inPlay: [],
            victory: [],
          },
          '1': {
            deck: [],
            hand: ['core-hero-p1-hand-m' as CardExtId, 'core-hero-p1-hand-a' as CardExtId],
            discard: [],
            inPlay: [],
            victory: [],
          },
        },
      });

    const first = buildG();
    executeVillainAbilities(first, CTX, 'v-x' as CardExtId, 'onFight');

    const second = buildG();
    executeVillainAbilities(second, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      first.ko,
      second.ko,
      'G.ko targets identical across two runs (mutation order pinned)',
    );
    assert.deepStrictEqual(
      first.playerZones['0']!.discard,
      second.playerZones['0']!.discard,
      'player 0 discard identical across runs',
    );
    assert.deepStrictEqual(
      first.playerZones['1']!.hand,
      second.playerZones['1']!.hand,
      'player 1 hand identical across runs',
    );
    assert.deepStrictEqual(
      (first as { messages?: unknown }).messages,
      (second as { messages?: unknown }).messages,
      'G.messages identical sequence across runs',
    );
  });

  it('koHeroCurrentPlayer non-regression: on multi-player G, only the current player is targeted', () => {
    // why: WP-189 only adds the koHeroEachPlayer keyword; the
    // koHeroCurrentPlayer semantics (current-player only) MUST be unchanged
    // post-shared-resolver-rename. This regression test confirms invoking
    // koHeroCurrentPlayer from a multi-player G targets ONLY currentPlayer.
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroCurrentPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: [],
          discard: ['core-hero-p0-a' as CardExtId],
          inPlay: [],
          victory: [],
        },
        '1': {
          deck: [],
          hand: [],
          discard: ['core-hero-p1-a' as CardExtId],
          inPlay: [],
          victory: [],
        },
        '2': {
          deck: [],
          hand: [],
          discard: ['core-hero-p2-a' as CardExtId],
          inPlay: [],
          victory: [],
        },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      G.ko,
      ['core-hero-p0-a'],
      'only current player 0 is targeted; other players untouched',
    );
    assert.deepStrictEqual(
      G.playerZones['1']!.discard,
      ['core-hero-p1-a'],
      'player 1 discard untouched',
    );
    assert.deepStrictEqual(
      G.playerZones['2']!.discard,
      ['core-hero-p2-a'],
      'player 2 discard untouched',
    );
  });

  it('safe-skips when G.playerZones is empty (no throw)', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroEachPlayer'])],
      playerZones: {},
    });
    assert.doesNotThrow(() =>
      executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight'),
    );
    assert.deepStrictEqual(G.ko, [], 'no KO when there are no players');
  });
});

// ---------------------------------------------------------------------------
// WP-202: koHeroEachPlayerMag2 dispatch
// ---------------------------------------------------------------------------

describe('executeVillainAbilities — koHeroEachPlayerMag2 (WP-202)', () => {
  it('multi-player magnitude-2: each player with ≥2 eligible heroes loses exactly 2 in discard-then-hand ext_id-lexical order', () => {
    // why: WP-202 §AC Behavior — a 2-player fixture where each player has
    // both discard and hand heroes. Per the locked rule: discard priority
    // ascending by ext_id, then hand ascending by ext_id, two iterations
    // per player. Player 0: discard ['p0-d-b', 'p0-d-a'] → iteration 1
    // picks 'p0-d-a', iteration 2 picks 'p0-d-b' (still in discard before
    // hand). Player 1: discard ['p1-d-c'] → iteration 1 picks 'p1-d-c',
    // iteration 2 falls through to hand and picks 'p1-h-a'. G.ko order
    // follows iteration order (player 0 twice, then player 1 twice).
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroEachPlayerMag2'])],
      playerZones: {
        '0': {
          deck: [],
          hand: ['core-hero-p0-h-z' as CardExtId],
          discard: [
            'core-hero-p0-d-b' as CardExtId,
            'core-hero-p0-d-a' as CardExtId,
            WOUND,
          ],
          inPlay: [],
          victory: [],
        },
        '1': {
          deck: [],
          hand: [
            'core-hero-p1-h-b' as CardExtId,
            'core-hero-p1-h-a' as CardExtId,
          ],
          discard: ['core-hero-p1-d-c' as CardExtId],
          inPlay: [],
          victory: [],
        },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      G.ko,
      [
        'core-hero-p0-d-a',
        'core-hero-p0-d-b',
        'core-hero-p1-d-c',
        'core-hero-p1-h-a',
      ],
      'G.ko mutation order: player 0 discard×2, then player 1 discard then hand',
    );
    assert.deepStrictEqual(
      G.playerZones['0']!.discard,
      [WOUND],
      "player 0 discard heroes removed; wound stays",
    );
    assert.deepStrictEqual(
      G.playerZones['0']!.hand,
      ['core-hero-p0-h-z'],
      'player 0 hand untouched (both iterations satisfied from discard)',
    );
    assert.deepStrictEqual(
      G.playerZones['1']!.discard,
      [],
      'player 1 discard consumed (only 1 hero there)',
    );
    assert.deepStrictEqual(
      G.playerZones['1']!.hand,
      ['core-hero-p1-h-b'],
      "player 1 hand: 'a' removed, 'b' retained",
    );
  });

  it('partial-eligibility per player: 1 eligible loses 1; 0 eligible loses 0; 3+ eligible loses exactly 2', () => {
    // why: WP-202 §AC Behavior — the silent-no-op-per-iteration semantics
    // and the strict 2-cap. Player 0 has 1 eligible hero (second iteration
    // no-ops). Player 1 has 0 eligible heroes (both iterations no-op).
    // Player 2 has 3 eligible heroes (third is not touched).
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroEachPlayerMag2'])],
      playerZones: {
        '0': {
          deck: [],
          hand: ['core-hero-p0-h-a' as CardExtId],
          discard: [WOUND],
          inPlay: [],
          victory: [],
        },
        '1': {
          deck: [],
          hand: [],
          discard: [WOUND],
          inPlay: [],
          victory: [],
        },
        '2': {
          deck: [],
          hand: [],
          discard: [
            'core-hero-p2-d-c' as CardExtId,
            'core-hero-p2-d-b' as CardExtId,
            'core-hero-p2-d-a' as CardExtId,
          ],
          inPlay: [],
          victory: [],
        },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      G.ko,
      [
        'core-hero-p0-h-a',
        'core-hero-p2-d-a',
        'core-hero-p2-d-b',
      ],
      'G.ko: p0 loses 1 (only hero), p1 loses 0 (silent), p2 loses exactly 2 of 3',
    );
    assert.deepStrictEqual(
      G.playerZones['0']!.hand,
      [],
      "player 0 hand empty (its sole hero KO'd on iteration 1)",
    );
    assert.deepStrictEqual(
      G.playerZones['1']!.discard,
      [WOUND],
      'player 1 untouched (zero eligible)',
    );
    assert.deepStrictEqual(
      G.playerZones['2']!.discard,
      ['core-hero-p2-d-c'],
      "player 2 retains the lex-largest hero ('c'); 'a' and 'b' KO'd",
    );
  });

  it('mixed eligibility across players: one player loses 2, another loses 1, another loses 0 in the same dispatch', () => {
    // why: WP-202 §AC Behavior — verifies per-player iteration is
    // independent (no cross-player coupling). Player 0 has 2 eligible
    // heroes (loses 2), player 1 has 1 eligible (loses 1), player 2 has 0
    // eligible (loses 0). All in a single dispatch.
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroEachPlayerMag2'])],
      playerZones: {
        '0': {
          deck: [],
          hand: [],
          discard: [
            'core-hero-p0-d-b' as CardExtId,
            'core-hero-p0-d-a' as CardExtId,
          ],
          inPlay: [],
          victory: [],
        },
        '1': {
          deck: [],
          hand: ['core-hero-p1-h-a' as CardExtId],
          discard: [],
          inPlay: [],
          victory: [],
        },
        '2': {
          deck: [],
          hand: [WOUND],
          discard: [],
          inPlay: [],
          victory: [],
        },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      G.ko,
      ['core-hero-p0-d-a', 'core-hero-p0-d-b', 'core-hero-p1-h-a'],
      'G.ko: p0 loses 2 from discard, p1 loses 1 from hand, p2 loses 0',
    );
    assert.deepStrictEqual(
      G.playerZones['2']!.hand,
      [WOUND],
      'player 2 untouched (wound is not a hero)',
    );
  });

  it('single-player parity (load-bearing): koHeroEachPlayerMag2(G) ≡ koHeroEachPlayer(koHeroEachPlayer(G)) byte-identical', () => {
    // why: WP-202 §AC Behavior — the load-bearing magnitude-2-equals-
    // magnitude-1-twice parity guard. On a single-player G with ≥2
    // eligible heroes, dispatching koHeroEachPlayerMag2 once must produce
    // byte-identical post-state to dispatching koHeroEachPlayer twice in
    // sequence. The deep-equality classes covered: G.ko, every player
    // zone (hand/discard/inPlay/victory/deck), G.attachedBystanders,
    // G.messages. This pins D-18902's shared-resolver mutation-location
    // lock and D-20201's literal-2-equals-twice-magnitude-1 semantics.
    const buildG = (effect: 'koHeroEachPlayer' | 'koHeroEachPlayerMag2') =>
      makeG({
        hooks: [hook('v-x', 'onFight', [effect])],
        playerZones: {
          '0': {
            deck: ['core-hero-deck-d' as CardExtId],
            hand: [
              'core-hero-hand-h' as CardExtId,
              'core-hero-hand-z' as CardExtId,
            ],
            discard: [
              'core-hero-disc-b' as CardExtId,
              'core-hero-disc-a' as CardExtId,
              WOUND,
            ],
            inPlay: ['core-hero-play-p' as CardExtId],
            victory: ['core-hero-vict-v' as CardExtId],
          },
        },
        attachedBystanders: {
          ['v-other' as CardExtId]: ['by-1' as CardExtId],
        },
      });

    // Run koHeroEachPlayer twice in sequence against a fresh G.
    const gTwice = buildG('koHeroEachPlayer');
    executeVillainAbilities(gTwice, CTX, 'v-x' as CardExtId, 'onFight');
    executeVillainAbilities(gTwice, CTX, 'v-x' as CardExtId, 'onFight');

    // Run koHeroEachPlayerMag2 once against an identically-shaped fresh G.
    const gMag2 = buildG('koHeroEachPlayerMag2');
    executeVillainAbilities(gMag2, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(gMag2.ko, gTwice.ko, 'G.ko deep-equal');
    assert.deepStrictEqual(
      gMag2.playerZones['0']!.discard,
      gTwice.playerZones['0']!.discard,
      'player 0 discard deep-equal',
    );
    assert.deepStrictEqual(
      gMag2.playerZones['0']!.hand,
      gTwice.playerZones['0']!.hand,
      'player 0 hand deep-equal',
    );
    assert.deepStrictEqual(
      gMag2.playerZones['0']!.inPlay,
      gTwice.playerZones['0']!.inPlay,
      'player 0 inPlay deep-equal',
    );
    assert.deepStrictEqual(
      gMag2.playerZones['0']!.victory,
      gTwice.playerZones['0']!.victory,
      'player 0 victory deep-equal',
    );
    assert.deepStrictEqual(
      gMag2.playerZones['0']!.deck,
      gTwice.playerZones['0']!.deck,
      'player 0 deck deep-equal',
    );
    assert.deepStrictEqual(
      gMag2.attachedBystanders,
      gTwice.attachedBystanders,
      'G.attachedBystanders deep-equal',
    );
    // why: messages is a separate JSON array; the shared resolver pushes
    // none today, but deep equality pins it so a future per-branch
    // message divergence (which would violate the mutation-location
    // lock) fails this test.
    assert.deepStrictEqual(
      (gMag2 as { messages?: unknown }).messages,
      (gTwice as { messages?: unknown }).messages,
      'G.messages deep-equal',
    );
  });

  it('determinism (audit-exact): two identical dispatches produce identical KO targets, mutation order, and messages', () => {
    // why: WP-202 §AC Behavior — three deep-equality classes per the
    // determinism criterion: per-player KO target ext_ids, G.ko mutation
    // order, G.messages sequence. Snapshots all three across two runs of
    // identical input G.
    const buildG = () =>
      makeG({
        hooks: [hook('v-x', 'onFight', ['koHeroEachPlayerMag2'])],
        playerZones: {
          '0': {
            deck: [],
            hand: ['core-hero-p0-h' as CardExtId],
            discard: [
              'core-hero-p0-d2' as CardExtId,
              'core-hero-p0-d1' as CardExtId,
            ],
            inPlay: [],
            victory: [],
          },
          '1': {
            deck: [],
            hand: [
              'core-hero-p1-h-m' as CardExtId,
              'core-hero-p1-h-a' as CardExtId,
            ],
            discard: [],
            inPlay: [],
            victory: [],
          },
        },
      });

    const first = buildG();
    executeVillainAbilities(first, CTX, 'v-x' as CardExtId, 'onFight');

    const second = buildG();
    executeVillainAbilities(second, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      first.ko,
      second.ko,
      'G.ko targets identical across two runs (mutation order pinned)',
    );
    assert.deepStrictEqual(
      first.playerZones['0']!.discard,
      second.playerZones['0']!.discard,
      'player 0 discard identical across runs',
    );
    assert.deepStrictEqual(
      first.playerZones['1']!.hand,
      second.playerZones['1']!.hand,
      'player 1 hand identical across runs',
    );
    assert.deepStrictEqual(
      (first as { messages?: unknown }).messages,
      (second as { messages?: unknown }).messages,
      'G.messages identical sequence across runs',
    );
  });

  it('koHeroEachPlayer non-regression: magnitude-1 dispatch still produces exactly one KO per eligible player', () => {
    // why: WP-202 §AC Behavior — adding the magnitude-2 branch must NOT
    // change the magnitude-1 branch's behavior. A two-player G with ≥1
    // eligible hero per player should yield exactly 2 KOs (one per
    // player), not 4.
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroEachPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: [],
          discard: [
            'core-hero-p0-d-b' as CardExtId,
            'core-hero-p0-d-a' as CardExtId,
          ],
          inPlay: [],
          victory: [],
        },
        '1': {
          deck: [],
          hand: [
            'core-hero-p1-h-b' as CardExtId,
            'core-hero-p1-h-a' as CardExtId,
          ],
          discard: [],
          inPlay: [],
          victory: [],
        },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      G.ko,
      ['core-hero-p0-d-a', 'core-hero-p1-h-a'],
      'magnitude-1 still produces exactly one KO per player (not two)',
    );
    assert.deepStrictEqual(
      G.playerZones['0']!.discard,
      ['core-hero-p0-d-b'],
      "player 0 retains lex-larger discard hero",
    );
    assert.deepStrictEqual(
      G.playerZones['1']!.hand,
      ['core-hero-p1-h-b'],
      "player 1 retains lex-larger hand hero",
    );
  });

  it('koHeroCurrentPlayer non-regression: only the current player is targeted (single KO)', () => {
    // why: WP-202 §AC Behavior — the current-player branch must remain
    // single-target. A 3-player G dispatched via koHeroCurrentPlayer
    // produces exactly 1 KO on the current player, leaving the other two
    // untouched. This pins that the magnitude-2 addition did not bleed
    // into the current-player branch.
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroCurrentPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: [],
          discard: ['core-hero-p0-a' as CardExtId],
          inPlay: [],
          victory: [],
        },
        '1': {
          deck: [],
          hand: [],
          discard: ['core-hero-p1-a' as CardExtId],
          inPlay: [],
          victory: [],
        },
        '2': {
          deck: [],
          hand: [],
          discard: ['core-hero-p2-a' as CardExtId],
          inPlay: [],
          victory: [],
        },
      },
    });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      G.ko,
      ['core-hero-p0-a'],
      'only current player 0 is targeted; other players untouched',
    );
    assert.deepStrictEqual(
      G.playerZones['1']!.discard,
      ['core-hero-p1-a'],
      'player 1 discard untouched',
    );
    assert.deepStrictEqual(
      G.playerZones['2']!.discard,
      ['core-hero-p2-a'],
      'player 2 discard untouched',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-200 → WP-316 — return-shape assertions (keyword surface byte-identity)
//
// WP-316 widens the return from VillainEffectKeyword[] to VillainEffectResult[].
// These tests keep pinning the WP-200 keyword surface via
// `results.map((r) => r.keyword)` — the projection MUST be byte-identical so the
// fightResolved/ambushResolved appliedEffects field + finalStateHash are
// unchanged. Per-target assertions live in the WP-316 block further down.
// ---------------------------------------------------------------------------

describe('executeVillainAbilities — WP-200/WP-316 return shape (keyword surface)', () => {
  it('returns the applied keywords in dispatch order for a multi-effect hook', () => {
    const G = makeG({
      hooks: [
        hook('v-x', 'onFight', ['captureBystander', 'gainWoundCurrentPlayer']),
      ],
      bystanders: ['b0'] as CardExtId[],
      wounds: ['w0'] as CardExtId[],
    });
    const results = executeVillainAbilities(
      G,
      CTX,
      'v-x' as CardExtId,
      'onFight',
    );
    assert.deepStrictEqual(
      results.map((result) => result.keyword),
      ['captureBystander', 'gainWoundCurrentPlayer'],
    );
  });

  it('returns [] when no hooks match the (cardId, timing)', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onAmbush', ['captureBystander'])],
      bystanders: ['b0'] as CardExtId[],
    });
    const results = executeVillainAbilities(
      G,
      CTX,
      'v-x' as CardExtId,
      'onFight',
    );
    assert.deepStrictEqual(results, []);
  });

  it('returns [] when villainAbilityHooks is empty (guard path)', () => {
    const G = makeG({ hooks: [] });
    const results = executeVillainAbilities(
      G,
      CTX,
      'v-x' as CardExtId,
      'onFight',
    );
    assert.deepStrictEqual(results, []);
  });

  it('post-safe-skip: out-of-vocab effects are NOT in the returned array', () => {
    // why: WP-200 D-20003 — the executor's results list only effects whose case
    // branch ran. Parsed-but-unknown keywords (default branch) are excluded.
    // Constructing a hook with an out-of-vocab token via the `as` cast simulates
    // the malformed-hook code path that the safe-skip default branch handles.
    const G = makeG({
      hooks: [
        hook('v-x', 'onFight', [
          'captureBystander',
          'totallyMadeUpKeyword',
        ]),
      ],
      bystanders: ['b0'] as CardExtId[],
    });
    const results = executeVillainAbilities(
      G,
      CTX,
      'v-x' as CardExtId,
      'onFight',
    );
    assert.deepStrictEqual(
      results.map((result) => result.keyword),
      ['captureBystander'],
    );
  });

  it('mutation-guarded short-circuit still appears in the applied array', () => {
    // why: WP-200 — empty-pile / missing-zone guards short-circuit the case
    // body but the keyword was attempted; emissions sites need to know which
    // effect tokens fired their dispatch branch (so the narrative reflects
    // intent, not whether the mutation succeeded). Empty wound pile must
    // still surface `gainWoundCurrentPlayer` in the applied array.
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['gainWoundCurrentPlayer'])],
      wounds: [],
    });
    const results = executeVillainAbilities(
      G,
      CTX,
      'v-x' as CardExtId,
      'onFight',
    );
    assert.deepStrictEqual(
      results.map((result) => result.keyword),
      ['gainWoundCurrentPlayer'],
    );
  });
});

// ---------------------------------------------------------------------------
// WP-316 — per-effect result targets + pending
// ---------------------------------------------------------------------------

describe('executeVillainAbilities — WP-316 result targets', () => {
  it('koHeroCurrentPlayer auto-KO (exactly 1 eligible) reports the KO\'d hero as the target', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroCurrentPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: [WOUND] as CardExtId[],
          discard: ['core-hero-a-00', WOUND] as CardExtId[],
          inPlay: [],
          victory: [],
        },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    const results = executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');
    assert.deepStrictEqual(results, [
      { keyword: 'koHeroCurrentPlayer', targets: ['core-hero-a-00'] },
    ]);
  });

  it('koHeroCurrentPlayer with ≥2 eligible reports pending: true and no targets', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroCurrentPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: ['core-hero-z-00'] as CardExtId[],
          discard: ['core-hero-b-00', 'core-hero-a-00'] as CardExtId[],
          inPlay: [],
          victory: [],
        },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    const results = executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');
    assert.deepStrictEqual(results, [
      { keyword: 'koHeroCurrentPlayer', targets: [], pending: true },
    ]);
  });

  it('koHeroCurrentPlayer with 0 eligible (wounds only) reports empty targets, no pending', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroCurrentPlayer'])],
      playerZones: {
        '0': { deck: [], hand: [], discard: [WOUND] as CardExtId[], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
    const results = executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');
    assert.deepStrictEqual(results, [
      { keyword: 'koHeroCurrentPlayer', targets: [] },
    ]);
  });

  it('koHeroEachPlayer reports every KO\'d hero across players in mutation order', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onFight', ['koHeroEachPlayer'])],
      playerZones: {
        '0': {
          deck: [],
          hand: [],
          discard: ['core-hero-p0-a' as CardExtId],
          inPlay: [],
          victory: [],
        },
        '1': {
          deck: [],
          hand: ['core-hero-p1-a' as CardExtId],
          discard: [WOUND],
          inPlay: [],
          victory: [],
        },
        '2': { deck: [], hand: [], discard: [WOUND], inPlay: [], victory: [] },
      },
    });
    const results = executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');
    assert.deepStrictEqual(results, [
      { keyword: 'koHeroEachPlayer', targets: ['core-hero-p0-a', 'core-hero-p1-a'] },
    ]);
  });

  it('capture-hq-hero reports the captured hero; gain-wound + capture-bystander report []', () => {
    const G = makeG({
      hooks: [
        hook('v-x', 'onAmbush', [
          'captureHqHeroRightmost',
          'gainWoundEachPlayer',
          'captureBystander',
        ]),
      ],
      hq: [null, null, null, null, 'h4' as CardExtId],
      wounds: ['w0', 'w1'] as CardExtId[],
      bystanders: ['b0'] as CardExtId[],
    });
    const results = executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onAmbush');
    assert.deepStrictEqual(results, [
      { keyword: 'captureHqHeroRightmost', targets: ['h4'] },
      { keyword: 'gainWoundEachPlayer', targets: [] },
      { keyword: 'captureBystander', targets: [] },
    ]);
  });

  it('capture-hq-hero on an empty HQ reports empty targets (reachable no-op)', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onAmbush', ['captureHqHeroRightmost'])],
      hq: [null, null, null, null, null],
    });
    const results = executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onAmbush');
    assert.deepStrictEqual(results, [
      { keyword: 'captureHqHeroRightmost', targets: [] },
    ]);
  });

  it('hero-deck-top-to-escape reports the escaped card as the target', () => {
    const G = makeG({
      hooks: [hook('v-x', 'onEscape', ['heroDeckTopToEscape'])],
      heroDeck: ['h0', 'h1'] as CardExtId[],
    });
    const results = executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onEscape');
    assert.deepStrictEqual(results, [
      { keyword: 'heroDeckTopToEscape', targets: ['h0'] },
    ]);
  });

  it('hero-deck-top-to-escape on an empty hero deck reports empty targets', () => {
    const G = makeG({ hooks: [hook('v-x', 'onEscape', ['heroDeckTopToEscape'])] });
    const results = executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onEscape');
    assert.deepStrictEqual(results, [
      { keyword: 'heroDeckTopToEscape', targets: [] },
    ]);
  });
});

// ---------------------------------------------------------------------------
// WP-214: captureHqHero* keyword dispatch
// ---------------------------------------------------------------------------

describe('executeVillainAbilities — captureHqHeroRightmost (WP-214)', () => {
  it('captures the rightmost non-null HQ hero and attaches to the villain', () => {
    const G = makeG({
      hooks: [hook('v-skrull', 'onAmbush', ['captureHqHeroRightmost'])],
      hq: ['h0' as CardExtId, null, 'h2' as CardExtId, null, 'h4' as CardExtId],
    });
    executeVillainAbilities(G, CTX, 'v-skrull' as CardExtId, 'onAmbush');

    assert.deepStrictEqual(
      G.villainAttachedHeroes['v-skrull'],
      ['h4'],
      'h4 at index 4 is the rightmost non-null slot',
    );
    assert.equal(G.hq[4], null, 'HQ slot 4 vacated after capture');
  });

  it('no-op when HQ is entirely null — returns safely without throw', () => {
    const G = makeG({
      hooks: [hook('v-skrull', 'onAmbush', ['captureHqHeroRightmost'])],
      hq: [null, null, null, null, null],
    });
    assert.doesNotThrow(() =>
      executeVillainAbilities(G, CTX, 'v-skrull' as CardExtId, 'onAmbush'),
    );
    assert.deepStrictEqual(G.villainAttachedHeroes, {});
  });

  it('appears in the applied array when HQ has a target', () => {
    const G = makeG({
      hooks: [hook('v-skrull', 'onAmbush', ['captureHqHeroRightmost'])],
      hq: [null, null, null, null, 'h4' as CardExtId],
    });
    const results = executeVillainAbilities(G, CTX, 'v-skrull' as CardExtId, 'onAmbush');
    assert.deepStrictEqual(
      results.map((result) => result.keyword),
      ['captureHqHeroRightmost'],
    );
  });
});

describe('executeVillainAbilities — captureHqHeroHighestCost (WP-214)', () => {
  it('captures the highest-cost HQ hero and attaches to the villain', () => {
    const G = makeG({
      hooks: [hook('v-skrull', 'onAmbush', ['captureHqHeroHighestCost'])],
      hq: ['h0' as CardExtId, 'h1' as CardExtId, 'h2' as CardExtId, null, null],
      cardStats: { h0: { cost: 3 }, h1: { cost: 7 }, h2: { cost: 2 } },
    });
    executeVillainAbilities(G, CTX, 'v-skrull' as CardExtId, 'onAmbush');

    assert.deepStrictEqual(G.villainAttachedHeroes['v-skrull'], ['h1'], 'h1 has cost 7 — highest');
    assert.equal(G.hq[1], null, 'HQ slot 1 vacated');
  });

  it('appears in the applied array', () => {
    const G = makeG({
      hooks: [hook('v-skrull', 'onAmbush', ['captureHqHeroHighestCost'])],
      hq: [null, 'h1' as CardExtId, null, null, null],
      cardStats: { h1: { cost: 4 } },
    });
    const results = executeVillainAbilities(G, CTX, 'v-skrull' as CardExtId, 'onAmbush');
    assert.deepStrictEqual(
      results.map((result) => result.keyword),
      ['captureHqHeroHighestCost'],
    );
  });
});

describe('executeVillainAbilities — captureHqHeroLowestCost (WP-214)', () => {
  it('captures the lowest-cost HQ hero and attaches to the villain', () => {
    const G = makeG({
      hooks: [hook('v-skrull', 'onAmbush', ['captureHqHeroLowestCost'])],
      hq: ['h0' as CardExtId, 'h1' as CardExtId, 'h2' as CardExtId, null, null],
      cardStats: { h0: { cost: 3 }, h1: { cost: 7 }, h2: { cost: 1 } },
    });
    executeVillainAbilities(G, CTX, 'v-skrull' as CardExtId, 'onAmbush');

    assert.deepStrictEqual(G.villainAttachedHeroes['v-skrull'], ['h2'], 'h2 has cost 1 — lowest');
    assert.equal(G.hq[2], null, 'HQ slot 2 vacated');
  });

  it('appears in the applied array', () => {
    const G = makeG({
      hooks: [hook('v-skrull', 'onAmbush', ['captureHqHeroLowestCost'])],
      hq: ['h0' as CardExtId, null, null, null, null],
      cardStats: { h0: { cost: 2 } },
    });
    const results = executeVillainAbilities(G, CTX, 'v-skrull' as CardExtId, 'onAmbush');
    assert.deepStrictEqual(
      results.map((result) => result.keyword),
      ['captureHqHeroLowestCost'],
    );
  });
});

// ---------------------------------------------------------------------------
// WP-257 — hollow-effect detection (D-24033 + D-24034)
//
// Villain detection writes at the executor's existing out-of-vocab skip site +
// for each unresolved [effect:X] marker. The VillainEffectKeyword[] applied
// return stays byte-unchanged (detection is purely additive). cardType is
// resolved from G.villainDeckCardTypes (henchman vs villain).
// ---------------------------------------------------------------------------

describe('executeVillainAbilities — hollow-effect detection (WP-257)', () => {
  /** Reads the lazy-init diagnostics records (empty array when never written). */
  function records(G: LegendaryGameState) {
    return G.diagnostics?.hollowEffects ?? [];
  }

  /** Attaches a messages array + cardType map so the record + message line surface. */
  function withDiagnosticsFields(
    G: LegendaryGameState,
    cardTypes?: Record<string, 'villain' | 'henchman'>,
  ): LegendaryGameState {
    (G as { messages?: unknown }).messages = [];
    if (cardTypes !== undefined) {
      (G as { villainDeckCardTypes?: unknown }).villainDeckCardTypes = cardTypes;
    }
    return G;
  }

  it('an out-of-vocabulary descriptor records a hollow record (cardType villain)', () => {
    // why: the hook helper maps 'notARealKeyword' through the empty
    // LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR entry → a {} descriptor with no
    // primitive → applyVillainEffect reaches no handler → no-handler hollow.
    const G = withDiagnosticsFields(
      makeG({ hooks: [hook('v-x', 'onAmbush', ['notARealKeyword'])] }),
    );
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onAmbush');

    assert.equal(records(G).length, 1, 'exactly one hollow record');
    assert.equal(records(G)[0]!.reason, 'no-handler');
    assert.equal(records(G)[0]!.cardType, 'villain');
    assert.equal(records(G)[0]!.timing, 'onAmbush');
  });

  it('resolves cardType henchman from G.villainDeckCardTypes', () => {
    const G = withDiagnosticsFields(
      makeG({ hooks: [hook('henchman-doombot-00', 'onFight', ['notARealKeyword'])] }),
      { 'henchman-doombot-00': 'henchman' },
    );
    executeVillainAbilities(G, CTX, 'henchman-doombot-00' as CardExtId, 'onFight');

    assert.equal(records(G).length, 1);
    assert.equal(records(G)[0]!.cardType, 'henchman');
  });

  it('a recognized ambush descriptor that no-ops records NO hollow event', () => {
    // why: captureHqHeroRightmost with an all-null HQ reaches its real handler and
    // intentionally no-ops — a reachable outcome, NOT hollow (the keystone).
    const G = withDiagnosticsFields(
      makeG({
        hooks: [hook('v-skrull', 'onAmbush', ['captureHqHeroRightmost'])],
        hq: [null, null, null, null, null],
      }),
    );
    executeVillainAbilities(G, CTX, 'v-skrull' as CardExtId, 'onAmbush');

    assert.equal(records(G).length, 0, 'a reachable handler that no-ops is not hollow');
  });

  it('an empty-wound-pile gainWound records NO hollow event (reachable no-op)', () => {
    const G = withDiagnosticsFields(
      makeG({ hooks: [hook('v-x', 'onFight', ['gainWoundCurrentPlayer'])], wounds: [] }),
    );
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.equal(records(G).length, 0, 'empty wound pile is a reachable no-op, not hollow');
  });

  it('an unresolved [effect:X] marker records a parse-unrecognized hollow event', () => {
    const G = withDiagnosticsFields(makeG({ hooks: [] }));
    // why: hand-build a hook carrying an unresolvedMarkers field (the parser
    // surfaces these; the hook helper does not).
    (G as { villainAbilityHooks: VillainAbilityHook[] }).villainAbilityHooks = [
      {
        cardId: 'v-x' as CardExtId,
        timing: 'onFight',
        keywords: [],
        effects: [],
        unresolvedMarkers: ['mind-control'],
      },
    ];
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.equal(records(G).length, 1, 'exactly one hollow record');
    assert.equal(records(G)[0]!.reason, 'parse-unrecognized');
    assert.equal(records(G)[0]!.mechanic, 'mind-control');
  });

  it('D-24266: a printed timing line with no [effect:] marker records a no-handler breadcrumb (the Doombot Legion case)', () => {
    // why: the production bug Jeff reported. Doombot Legion's printed
    // "Fight: Look at the top two cards of your deck. KO one of them and put the
    // other back." carries no `[effect:]` marker, so the parser emits a hook with
    // effects:[] and no unresolvedMarkers. Before D-24266 the executor dropped it
    // silently — no record, no log line — so the operator could not tell an
    // un-implemented printed effect from a card with no Fight effect at all.
    const G = withDiagnosticsFields(
      makeG({ hooks: [hook('henchman-doombot-legion-05', 'onFight', [])] }),
      { 'henchman-doombot-legion-05': 'henchman' },
    );
    executeVillainAbilities(G, CTX, 'henchman-doombot-legion-05' as CardExtId, 'onFight');

    assert.equal(records(G).length, 1, 'exactly one hollow record');
    assert.equal(records(G)[0]!.reason, 'no-handler');
    assert.equal(records(G)[0]!.mechanic, 'unmarked-ability');
    assert.equal(records(G)[0]!.cardType, 'henchman');
    assert.equal(records(G)[0]!.timing, 'onFight');
    // why: the operator-visible breadcrumb — the whole point of D-24266 — must
    // reach G.messages (the log projection), not just the structured channel.
    // Log entries are LogEntry objects ({ text, outcome, card }) per WP-434, so
    // read `.text` rather than treating the entry as a bare string.
    const messages = (G as unknown as { messages: { text: string; outcome?: string }[] }).messages;
    const breadcrumb = messages.find((entry) => entry.text.includes('Unhandled effect observed'));
    assert.ok(breadcrumb, 'the hollow breadcrumb surfaces in the operator log');
    assert.equal(breadcrumb.text.includes('henchman-doombot-legion-05'), true, 'the log line names the card');
    // why: WP-434 — a hollow effect (declared mechanic, no handler) is `blocked` (red).
    assert.equal(breadcrumb.outcome, 'blocked', 'the breadcrumb is coloured blocked');
  });

  it('a fully-marked hook that applies records NO breadcrumb (the negative case)', () => {
    // why: D-24266 must fire ONLY for genuinely un-marked lines. A recognized
    // captureBystander line reaches its handler and applies — no breadcrumb.
    const G = withDiagnosticsFields(
      makeG({
        hooks: [hook('v-sentinel', 'onFight', ['captureBystander'])],
        bystanders: ['b0'] as CardExtId[],
      }),
    );
    executeVillainAbilities(G, CTX, 'v-sentinel' as CardExtId, 'onFight');
    assert.equal(records(G).length, 0, 'an applied effect is never a breadcrumb');
  });

  it('the VillainEffectKeyword[] applied return is byte-unchanged when an unhandled effect is present', () => {
    // why: detection is purely additive — a hook mixing a real keyword and an
    // out-of-vocab one returns ONLY the real applied keyword (post-safe-skip
    // contract), identical to before WP-257.
    const G = withDiagnosticsFields(
      makeG({
        hooks: [hook('v-x', 'onFight', ['captureBystander', 'totallyMadeUpKeyword'])],
        bystanders: ['b0'] as CardExtId[],
      }),
    );
    const results = executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');

    assert.deepStrictEqual(
      results.map((result) => result.keyword),
      ['captureBystander'],
      'applied keyword surface byte-unchanged',
    );
    assert.equal(records(G).length, 1, 'the unhandled effect still flags hollow');
  });

  it('does not throw when recording with a non-array G.messages (the makeG default)', () => {
    // why: makeG builds G without a messages array; the writer must no-op the
    // message push without throwing while still storing the record.
    const G = makeG({ hooks: [hook('v-x', 'onAmbush', ['notARealKeyword'])] });
    assert.doesNotThrow(() =>
      executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onAmbush'),
    );
    assert.equal(records(G).length, 1, 'record stored even with non-array messages');
  });
});

// ---------------------------------------------------------------------------
// override-next-hand-size (WP-503 / D-24307) — the core spider-foes Doctor
// Octopus villain Fight: draw 8 next hand instead of 6.
// ---------------------------------------------------------------------------

/**
 * Builds a single onFight hook carrying the parameterized override-next-hand-size
 * descriptor (the `hook` helper above only translates legacy keyword strings, so a
 * parameterized descriptor is constructed directly, mirroring the parser output).
 */
function overrideHandSizeHook(cardId: string, magnitude: number): VillainAbilityHook {
  return {
    cardId: cardId as CardExtId,
    timing: 'onFight',
    keywords: [],
    effects: [{ primitive: 'override-next-hand-size', magnitude }],
  };
}

describe('executeVillainAbilities — override-next-hand-size (WP-503 / D-24307)', () => {
  it('sets the current player next-hand override to the magnitude, self-narrates, and records no hollow', () => {
    const G = makeG({
      hooks: [overrideHandSizeHook('v-docock', 8)],
      playerZones: {
        '0': { deck: [], hand: ['a', 'b', 'c', 'd', 'e', 'f'] as CardExtId[], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-docock' as CardExtId, 'onFight');

    // why: AC-1 — the villain-side writer sets the WP-497-owned field for the
    // fighting (current) player only, to the absolute magnitude (8).
    assert.deepEqual(G.handSizeOverrides, { '0': 8 });
    // why: the override is consumed later at the play-phase onBegin fill (WP-497),
    // NOT now — the hand is untouched at Fight time.
    assert.equal(G.playerZones['0']!.hand.length, 6, 'hand unchanged at Fight time');
    // why: keyword-less self-narration (D-24266 breadcrumb removed by marking).
    assert.equal(G.messages!.length, 1, 'one self-narrated Fight-effect line');
    assert.match(G.messages![0]!.text, /next hand draws 8 cards instead of 6/);
    // why: no `no-handler` hollow — the handler was reached and fired.
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'no hollow record when the handler fires');
  });

  it('is a no-op (writes no override) when the descriptor lacks a magnitude', () => {
    // why: a malformed hook (reachable only via a hand-built fixture — the parser
    // always sets magnitude) must not write an undefined override that the WP-497
    // onBegin fill would then read as `?? HAND_SIZE`.
    const G = makeG({
      hooks: [{ cardId: 'v-bad' as CardExtId, timing: 'onFight', keywords: [], effects: [{ primitive: 'override-next-hand-size' }] }],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-bad' as CardExtId, 'onFight');
    assert.equal(G.handSizeOverrides, undefined, 'no override written without a magnitude');
  });
});

// ---------------------------------------------------------------------------
// add-next-hand-size (WP-543 / D-24352) — Savage Land Mutates "draw an extra card"
// (ADDITIVE — stacks per defeat, unlike the absolute override-next-hand-size).
// ---------------------------------------------------------------------------

/**
 * Builds a single onFight hook carrying the parameterized add-next-hand-size descriptor
 * (the `hook` helper above only translates legacy keyword strings).
 */
function addHandSizeHook(cardId: string, magnitude: number): VillainAbilityHook {
  return {
    cardId: cardId as CardExtId,
    timing: 'onFight',
    keywords: [],
    effects: [{ primitive: 'add-next-hand-size', magnitude }],
  };
}

describe('executeVillainAbilities — add-next-hand-size (WP-543 / D-24352)', () => {
  it('a single defeat adds magnitude to the base HAND_SIZE (6 + 1 = 7), self-narrates, no hollow', () => {
    const G = makeG({ hooks: [addHandSizeHook('v-savage', 1)], messages: [] });
    executeVillainAbilities(G, CTX, 'v-savage' as CardExtId, 'onFight');
    // why: AC-2 — the additive writer sets HAND_SIZE (6) + 1 = 7 for the fighting player.
    assert.deepEqual(G.handSizeOverrides, { '0': 7 });
    assert.equal(G.playerZones['0']!.hand.length, 0, 'hand untouched at Fight time (consumed at onBegin)');
    assert.equal(G.messages!.length, 1, 'one self-narrated Fight-effect line');
    assert.match(G.messages![0]!.text, /your next hand draws 7 cards \(\+1 extra\)/);
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'no hollow when the handler fires');
  });

  it('TWO defeats in one turn ACCUMULATE to 8 (the WP-541 fidelity gap this WP fixes)', () => {
    // why: AC-2 — two Savage Land Mutates hooks fire in one executor pass on the same
    // player; the additive writes stack (6 + 1 + 1 = 8), which the absolute
    // override-next-hand-size:7 could NOT do (it would cap at 7). This is the whole point.
    const G = makeG({
      hooks: [addHandSizeHook('v-savage', 1)],
      messages: [],
    });
    // first defeat
    executeVillainAbilities(G, CTX, 'v-savage' as CardExtId, 'onFight');
    assert.deepEqual(G.handSizeOverrides, { '0': 7 }, 'first defeat → 7');
    // second defeat, same turn, same player (handSizeOverrides not yet consumed/cleared)
    executeVillainAbilities(G, CTX, 'v-savage' as CardExtId, 'onFight');
    assert.deepEqual(G.handSizeOverrides, { '0': 8 }, 'second defeat accumulates → 8, not capped at 7');
    assert.match(G.messages!.at(-1)!.text, /your next hand draws 8 cards \(\+1 extra\)/);
  });

  it('stacks on top of a prior absolute override (Doc Ock 8 then Savage Land +1 = 9)', () => {
    // why: coexistence — an absolute override-next-hand-size:8 already set 8; the additive
    // reads the current value (8) and adds 1 → 9. (The reverse order is the documented
    // out-of-scope edge; this asserts the additive-on-current behavior.)
    const G = makeG({
      hooks: [
        { cardId: 'v-docock' as CardExtId, timing: 'onFight', keywords: [], effects: [{ primitive: 'override-next-hand-size', magnitude: 8 }] },
        addHandSizeHook('v-savage', 1),
      ],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-docock' as CardExtId, 'onFight'); // absolute → 8
    executeVillainAbilities(G, CTX, 'v-savage' as CardExtId, 'onFight'); // additive → 9
    assert.deepEqual(G.handSizeOverrides, { '0': 9 }, 'additive stacks on the absolute base');
  });

  it('is a no-op (writes no override) when the descriptor lacks a magnitude', () => {
    const G = makeG({
      hooks: [{ cardId: 'v-bad' as CardExtId, timing: 'onFight', keywords: [], effects: [{ primitive: 'add-next-hand-size' }] }],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-bad' as CardExtId, 'onFight');
    assert.equal(G.handSizeOverrides, undefined, 'no bonus written without a magnitude (never NaN)');
  });
});

describe('override-next-hand-size ⟂ Magneto discard-to-limit (WP-503 / D-24307, AC-5)', () => {
  // why: AC-5 — the two effects are ORTHOGONAL lifecycles with no shared merge
  // point. Doc Ock's override governs the play-phase onBegin fill (WP-497's field);
  // Magneto's MAGNETO_HAND_SIZE_LIMIT is a Master-Strike-time discard-to-4 reaction
  // that parks a `discard-to-limit` pending choice. This asserts neither touches the
  // other, using the REAL discard-to-limit resolve move (the move a Magneto park
  // flows into).
  it('the Doc Ock override write does not touch a parked Magneto discard-to-limit choice', () => {
    const G = makeG({
      hooks: [overrideHandSizeHook('v-docock', 8)],
      playerZones: {
        '0': { deck: [], hand: ['a', 'b', 'c', 'd', 'e', 'f'] as CardExtId[], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
    });
    // why: pre-park a Magneto-shaped discard-to-4 choice (exactly what
    // resolveMagnetoStrike parks for the current player).
    G.pendingDiscardChoices = [{ choiceType: 'discard-to-limit', playerID: '0', limit: 4 }];

    executeVillainAbilities(G, CTX, 'v-docock' as CardExtId, 'onFight');

    // why: the override was written, but the Magneto park is byte-unchanged and the
    // hand is NOT trimmed by the override (no shared merge point).
    assert.deepEqual(G.handSizeOverrides, { '0': 8 });
    assert.deepEqual(G.pendingDiscardChoices, [{ choiceType: 'discard-to-limit', playerID: '0', limit: 4 }]);
    assert.equal(G.playerZones['0']!.hand.length, 6, 'the override does not trim the hand');
  });

  it('resolving the Magneto discard-to-4 trims the hand to 4 and leaves the Doc Ock override intact', () => {
    const G = makeG({
      playerZones: {
        '0': { deck: [], hand: ['a', 'b', 'c', 'd', 'e', 'f'] as CardExtId[], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
    });
    // why: the fighting player already carries a Doc Ock override (fought Doc Ock
    // earlier this turn) AND is now hit by a Magneto Master Strike discard-to-4.
    G.handSizeOverrides = { '0': 8 };
    G.pendingDiscardChoices = [{ choiceType: 'discard-to-limit', playerID: '0', limit: 4 }];

    // why: resolve the parked discard-to-4 (drop 2 of 6) — the real move a Magneto
    // strike flows into. The hand trims to 4.
    resolveDiscardChoice({ G, playerID: '0' } as unknown as Parameters<typeof resolveDiscardChoice>[0], {
      cardIds: ['a', 'b'] as CardExtId[],
    });

    assert.equal(G.playerZones['0']!.hand.length, 4, 'Magneto strike trims the current hand to 4');
    // why: the Master-Strike-time trim does NOT touch the Doc Ock override — it
    // survives for the fighting player's next onBegin fill (WP-497 consumes it there).
    assert.deepEqual(G.handSizeOverrides, { '0': 8 }, 'the override is untouched by the discard');
  });
});

// ---------------------------------------------------------------------------
// ko-wounds-current-hand-and-discard (WP-516 / D-24329) — Ymir, Frost Giant
// King Fight: the current player KOs every Wound from their hand + discard.
// ---------------------------------------------------------------------------

/**
 * Builds a single onFight hook carrying the parameterized no-param
 * ko-wounds-current-hand-and-discard descriptor (the `hook` helper above only
 * translates legacy keyword strings, so a parameterized descriptor is constructed
 * directly, mirroring the parser output).
 */
function koWoundsHook(cardId: string): VillainAbilityHook {
  return {
    cardId: cardId as CardExtId,
    timing: 'onFight',
    keywords: [],
    effects: [{ primitive: 'ko-wounds-current-hand-and-discard' }],
  };
}

describe('executeVillainAbilities — ko-wounds-current-hand-and-discard (WP-516 / D-24329)', () => {
  const CARD_A = 'core/x-men/wolverine#0' as CardExtId;
  const CARD_B = 'core/shield/a#0' as CardExtId;

  it('AC-1 KOs every Wound from the current player hand + discard, leaving non-Wounds, and self-narrates', () => {
    const G = makeG({
      hooks: [koWoundsHook('v-ymir')],
      playerZones: {
        '0': {
          deck: [],
          hand: [WOUND, CARD_A, WOUND],
          discard: [CARD_B, WOUND],
          inPlay: [WOUND], // in-play is NOT scanned — Wounds are never played there
          victory: [],
        },
        '1': { deck: [], hand: [WOUND], discard: [WOUND], inPlay: [], victory: [] },
      },
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-ymir' as CardExtId, 'onFight');

    // why: AC-1 — every Wound leaves the current player's hand + discard; non-Wounds stay.
    assert.deepStrictEqual(G.playerZones['0']!.hand, [CARD_A], 'Wounds KO’d from hand, non-Wound stays');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [CARD_B], 'Wound KO’d from discard, non-Wound stays');
    // why: in-play is deliberately out of scope (the printed text names hand + discard only).
    assert.deepStrictEqual(G.playerZones['0']!.inPlay, [WOUND], 'in-play Wound is untouched');
    // why: all three KO’d Wounds land in the general KO pile (hand-order then discard-order).
    assert.deepStrictEqual(G.ko, [WOUND, WOUND, WOUND], 'three Wounds KO’d to the KO pile');
    // why: AC-3 — the non-current player's Wounds are untouched (single-target).
    assert.deepStrictEqual(G.playerZones['1']!.hand, [WOUND], 'non-current player hand untouched');
    assert.deepStrictEqual(G.playerZones['1']!.discard, [WOUND], 'non-current player discard untouched');
    // why: keyword-less self-narration (D-24266 breadcrumb removed by marking).
    assert.equal(G.messages!.length, 1, 'one self-narrated Fight-effect line');
    assert.match(G.messages![0]!.text, /Fight effect: KO'd 3 Wound\(s\) from your hand and discard pile\./);
    assert.equal(G.messages![0]!.outcome, 'applied');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'no hollow record when the handler fires');
  });

  it('AC-2 a player with zero Wounds is a reachable no-op (blocked, no crash, no hollow)', () => {
    const G = makeG({
      hooks: [koWoundsHook('v-ymir')],
      playerZones: {
        '0': { deck: [], hand: [CARD_A], discard: [CARD_B], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-ymir' as CardExtId, 'onFight');

    assert.deepStrictEqual(G.ko, [], 'nothing KO’d');
    assert.deepStrictEqual(G.playerZones['0']!.hand, [CARD_A], 'non-Wound hand stays');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [CARD_B], 'non-Wound discard stays');
    assert.match(G.messages![0]!.text, /Fight effect: KO'd 0 Wound\(s\) from your hand and discard pile\./);
    assert.equal(G.messages![0]!.outcome, 'blocked');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'reachable no-op, never hollow');
  });
});

describe('executeVillainAbilities — capture-bystanders-plus-per-hq-hero-by-trait (WP-521 / D-24334)', () => {
  const AVENGER_A = 'core/avengers/iron-man#0' as CardExtId;
  const AVENGER_B = 'core/avengers/captain-america#0' as CardExtId;
  const XMEN = 'core/x-men/wolverine#0' as CardExtId;
  const TRAITS: Record<string, { heroClass: string | null; team: string | null }> = {
    [AVENGER_A]: { heroClass: 'tech', team: 'avengers' },
    [AVENGER_B]: { heroClass: 'strength', team: 'avengers' },
    [XMEN]: { heroClass: 'covert', team: 'x-men' },
  };

  // why: capture-bystanders-plus-per-hq-hero-by-trait is predicate-parameterized and
  // keyword-less, so the hook() helper (which reads LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR)
  // can't build it — construct the descriptor hook directly.
  function zemoHook(cardId: string): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onAmbush',
      keywords: [],
      effects: [
        {
          primitive: 'capture-bystanders-plus-per-hq-hero-by-trait',
          requireKind: 'team',
          requireValue: 'avengers',
        },
      ],
    };
  }

  it('AC-1 attaches 1 + (HQ Avengers) Bystanders to the villain, attach-only at Ambush (no award)', () => {
    const G = makeG({
      hooks: [zemoHook('v-zemo')],
      hq: [AVENGER_A, XMEN, AVENGER_B, null, null],
      cardTraits: TRAITS,
      bystanders: ['b0', 'b1', 'b2', 'b3'] as CardExtId[],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-zemo' as CardExtId, 'onAmbush');
    // 1 base + 2 HQ Avengers (AVENGER_A, AVENGER_B) = 3 attached to Baron Zemo.
    assert.deepStrictEqual(
      G.attachedBystanders['v-zemo'],
      ['b0', 'b1', 'b2'],
      '3 Bystanders attached to the villain',
    );
    assert.deepStrictEqual(G.piles.bystanders, ['b3'] as CardExtId[], 'supply reduced by 3');
    // why: attach-only at Ambush — no award to any player's victory pile (the award
    // is deferred to Baron Zemo's defeat, D-18506).
    assert.deepStrictEqual(G.playerZones['0']!.victory, [], 'no award at Ambush (player 0)');
    assert.deepStrictEqual(G.playerZones['1']!.victory, [], 'no award at Ambush (player 1)');
    assert.match(G.messages![0]!.text, /Ambush effect: captured 3 Bystander\(s\)/);
    assert.equal(G.messages![0]!.outcome, 'applied');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'no hollow — the marked line is handled');
  });

  it('AC-2 with zero HQ Avengers attaches exactly the base 1', () => {
    const G = makeG({
      hooks: [zemoHook('v-zemo')],
      hq: [XMEN, null, null, null, null],
      cardTraits: TRAITS,
      bystanders: ['b0', 'b1'] as CardExtId[],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-zemo' as CardExtId, 'onAmbush');
    assert.deepStrictEqual(G.attachedBystanders['v-zemo'], ['b0'], 'base 1 Bystander only');
    assert.deepStrictEqual(G.piles.bystanders, ['b1'] as CardExtId[], 'supply reduced by 1');
  });

  it('AC-2 empty Bystander supply is a reachable no-op (blocked, no hollow)', () => {
    const G = makeG({
      hooks: [zemoHook('v-zemo')],
      hq: [AVENGER_A, AVENGER_B, null, null, null],
      cardTraits: TRAITS,
      bystanders: [],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-zemo' as CardExtId, 'onAmbush');
    assert.equal(G.attachedBystanders['v-zemo'] ?? undefined, undefined, 'nothing attached');
    assert.match(G.messages![0]!.text, /Ambush effect: captured 0 Bystander\(s\)/);
    assert.equal(G.messages![0]!.outcome, 'blocked');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'reachable no-op, never hollow');
  });

  it('AC-3 counts HQ heroes only — player-zone Avengers are never counted', () => {
    const G = makeG({
      hooks: [zemoHook('v-zemo')],
      hq: [AVENGER_A, null, null, null, null],
      // why: the player holds Avengers in hand + in-play — the HQ scan must ignore them
      // (the printed count is "for each [team:avengers] Hero in the HQ").
      playerZones: {
        '0': { deck: [], hand: [AVENGER_B], discard: [], inPlay: [AVENGER_B], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      cardTraits: TRAITS,
      bystanders: ['b0', 'b1', 'b2', 'b3'] as CardExtId[],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-zemo' as CardExtId, 'onAmbush');
    // 1 base + 1 HQ Avenger (AVENGER_A) = 2; the player-zone Avengers are ignored.
    assert.deepStrictEqual(
      G.attachedBystanders['v-zemo'],
      ['b0', 'b1'],
      'only the HQ Avenger is counted (2 total)',
    );
  });
});

describe('executeVillainAbilities — give-hq-hero-by-trait-to-current (WP-522 / D-24335)', () => {
  const TECH_LOW = 'co2e/heroes/tech-low#0' as CardExtId;
  const TECH_HIGH = 'co2e/heroes/tech-high#0' as CardExtId;
  const NON_TECH = 'co2e/heroes/strength-guy#0' as CardExtId;
  const TECH_A = 'co2e/heroes/tech-a#0' as CardExtId;
  const TECH_B = 'co2e/heroes/tech-b#0' as CardExtId;
  const REFILL = 'core/heroes/refill#0' as CardExtId;
  const TRAITS: Record<string, { heroClass: string | null; team: string | null }> = {
    [TECH_LOW]: { heroClass: 'tech', team: null },
    [TECH_HIGH]: { heroClass: 'tech', team: null },
    [NON_TECH]: { heroClass: 'strength', team: null },
    [TECH_A]: { heroClass: 'tech', team: null },
    [TECH_B]: { heroClass: 'tech', team: null },
  };

  // why: give-hq-hero-by-trait-to-current is predicate-parameterized and keyword-less, so
  // the hook() helper (which reads LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR) can't build it —
  // construct the descriptor hook directly.
  function ultronHook(cardId: string): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onFight',
      keywords: [],
      effects: [
        {
          primitive: 'give-hq-hero-by-trait-to-current',
          requireKind: 'hero-class',
          requireValue: 'tech',
        },
      ],
    };
  }

  it('AC-1 gifts the highest-cost tech HQ Hero to the current player discard, refills the slot', () => {
    const G = makeG({
      hooks: [ultronHook('v-ultron')],
      hq: [TECH_LOW, NON_TECH, TECH_HIGH, null, null],
      cardStats: { [TECH_LOW]: { cost: 3 }, [NON_TECH]: { cost: 9 }, [TECH_HIGH]: { cost: 5 } },
      cardTraits: TRAITS,
      heroDeck: [REFILL] as CardExtId[],
      cardDisplayData: { [TECH_HIGH]: { name: 'Ultron Drone' } },
      messages: [],
    });
    const results = executeVillainAbilities(G, CTX, 'v-ultron' as CardExtId, 'onFight');
    // why: highest-cost TECH is TECH_HIGH (cost 5 vs TECH_LOW's 3); NON_TECH's cost 9 is
    // ignored because it fails the [hc:tech] predicate.
    assert.deepStrictEqual(G.playerZones['0']!.discard, [TECH_HIGH], 'gifted Hero in current player discard');
    assert.equal(G.hq[2], REFILL, 'vacated HQ slot refilled from the hero deck');
    assert.deepStrictEqual(G.heroDeck, [] as CardExtId[], 'hero deck reservoir consumed');
    // why: keyword-less → no VillainEffectResult recorded (the log line is the surface).
    assert.deepStrictEqual(results, []);
    assert.match(G.messages![0]!.text, /Fight effect: gave Ultron Drone from the HQ to Player 0's discard/);
    assert.equal(G.messages![0]!.outcome, 'applied');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'no hollow — the marked line is handled');
  });

  it('AC-2 with no tech Hero in the HQ is a reachable no-op (blocked, HQ unchanged)', () => {
    const G = makeG({
      hooks: [ultronHook('v-ultron')],
      hq: [NON_TECH, null, null, null, null],
      cardStats: { [NON_TECH]: { cost: 9 } },
      cardTraits: TRAITS,
      heroDeck: [REFILL] as CardExtId[],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-ultron' as CardExtId, 'onFight');
    assert.equal(G.hq[0], NON_TECH, 'HQ unchanged — no tech Hero to remove');
    assert.deepStrictEqual(G.heroDeck, [REFILL] as CardExtId[], 'hero deck untouched');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [] as CardExtId[], 'no Hero gifted');
    assert.match(G.messages![0]!.text, /Fight effect: no tech Hero in the HQ; no effect/);
    assert.equal(G.messages![0]!.outcome, 'blocked');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'reachable no-op, never hollow');
  });

  it('AC-3 breaks a cost tie to the rightmost HQ index', () => {
    const G = makeG({
      hooks: [ultronHook('v-ultron')],
      hq: [TECH_A, null, TECH_B, null, null],
      cardStats: { [TECH_A]: { cost: 5 }, [TECH_B]: { cost: 5 } },
      cardTraits: TRAITS,
      heroDeck: [] as CardExtId[],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-ultron' as CardExtId, 'onFight');
    // why: equal cost 5 → the RIGHTMOST index wins (TECH_B at index 2), matching
    // captureHeroFromHq's highestCost tie rule.
    assert.deepStrictEqual(G.playerZones['0']!.discard, [TECH_B], 'rightmost equal-cost tech Hero gifted');
    assert.equal(G.hq[0], TECH_A, 'the left equal-cost tech Hero stays in the HQ');
    // why: empty reservoir → the vacated slot is left null (refillHqSlot empty branch).
    assert.equal(G.hq[2], null, 'vacated slot null when the hero deck is empty');
  });

  it('AC-4 the gift lands in discard, never victory, and no other player zone changes', () => {
    const G = makeG({
      hooks: [ultronHook('v-ultron')],
      hq: [TECH_HIGH, null, null, null, null],
      cardStats: { [TECH_HIGH]: { cost: 5 } },
      cardTraits: TRAITS,
      heroDeck: [REFILL] as CardExtId[],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-ultron' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [TECH_HIGH], 'gift in current player discard');
    assert.deepStrictEqual(G.playerZones['0']!.victory, [] as CardExtId[], 'never the victory pile (D-24327)');
    assert.deepStrictEqual(
      G.playerZones['1']!,
      { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      'no other player zone changes',
    );
  });
});

describe('executeVillainAbilities — swap-two-city-villains (WP-523 / D-24336)', () => {
  const V_LOW = 'co2e-villain-masters-of-evil-whirlwind-00' as CardExtId;
  const V_MID = 'co2e-villain-radiation-the-leader-00' as CardExtId;
  const V_HIGH = 'co2e-villain-brotherhood-of-mutants-juggernaut-00' as CardExtId;
  const HENCH = 'henchman-hand-ninjas-00' as CardExtId;

  // why: swap-two-city-villains is a no-param, keyword-less primitive, so the hook() helper
  // (which reads LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR) can't build it — construct directly.
  function swapHook(cardId: string): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onAmbush',
      keywords: [],
      effects: [{ primitive: 'swap-two-city-villains' }],
    };
  }

  // why: makeG does not model G.city / G.villainDeckCardTypes — attach them post-build via
  // cast (the same pattern the WP-257 hollow tests use for villainDeckCardTypes).
  function makeCityG(
    city: (CardExtId | null)[],
    cardTypes: Record<string, 'villain' | 'henchman'>,
  ): LegendaryGameState {
    const G = makeG({ hooks: [swapHook('v-whirl')], messages: [] });
    (G as { city?: unknown }).city = city;
    (G as { villainDeckCardTypes?: unknown }).villainDeckCardTypes = cardTypes;
    return G;
  }

  it('AC-1 swaps the lowest-index and highest-index villain-occupied City spaces (Rule B)', () => {
    const G = makeCityG(
      [V_LOW, null, HENCH, null, V_HIGH],
      { [V_LOW]: 'villain', [V_HIGH]: 'villain', [HENCH]: 'henchman' },
    );
    const results = executeVillainAbilities(G, CTX, 'v-whirl' as CardExtId, 'onAmbush');
    assert.equal(G.city[0], V_HIGH, 'entrance (index 0) now holds the former escape-side Villain');
    assert.equal(G.city[4], V_LOW, 'escape edge (index 4) now holds the former entrance Villain');
    assert.equal(G.city[2], HENCH, 'the henchman space is untouched');
    // why: keyword-less → no VillainEffectResult recorded (the log line is the surface).
    assert.deepStrictEqual(results, []);
    assert.match(G.messages![0]!.text, /swapped City spaces/);
    assert.equal(G.messages![0]!.outcome, 'applied');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'no hollow — the marked line is handled');
  });

  it('AC-2 fewer than two City Villains is a reachable no-op (blocked, City unchanged)', () => {
    const G = makeCityG(
      [V_LOW, HENCH, null, null, null],
      { [V_LOW]: 'villain', [HENCH]: 'henchman' },
    );
    executeVillainAbilities(G, CTX, 'v-whirl' as CardExtId, 'onAmbush');
    assert.equal(G.city[0], V_LOW, 'the lone Villain stays put');
    assert.equal(G.city[1], HENCH, 'the henchman stays put');
    assert.match(G.messages![0]!.text, /fewer than two Villains in the City; no swap/);
    assert.equal(G.messages![0]!.outcome, 'blocked');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'reachable no-op, never hollow');
  });

  it('AC-3 never selects a henchman even when it sits at an extreme index', () => {
    // why: a henchman occupies index 0 (the lowest occupied space); the two swapped spaces
    // must be the villain-occupied indices 1 and 3, leaving the henchman at 0 in place.
    const G = makeCityG(
      [HENCH, V_LOW, null, V_HIGH, null],
      { [HENCH]: 'henchman', [V_LOW]: 'villain', [V_HIGH]: 'villain' },
    );
    executeVillainAbilities(G, CTX, 'v-whirl' as CardExtId, 'onAmbush');
    assert.equal(G.city[0], HENCH, 'the henchman at the lowest index is never selected');
    assert.equal(G.city[1], V_HIGH, 'the two Villain spaces (1 and 3) swap');
    assert.equal(G.city[3], V_LOW, 'the two Villain spaces (1 and 3) swap');
  });

  it('AC-4 swaps only the two extreme Villains — a middle Villain and other spaces are unchanged', () => {
    const G = makeCityG(
      [V_LOW, V_MID, null, null, V_HIGH],
      { [V_LOW]: 'villain', [V_MID]: 'villain', [V_HIGH]: 'villain' },
    );
    executeVillainAbilities(G, CTX, 'v-whirl' as CardExtId, 'onAmbush');
    assert.equal(G.city[0], V_HIGH, 'lowest villain index gets the highest occupant');
    assert.equal(G.city[4], V_LOW, 'highest villain index gets the lowest occupant');
    assert.equal(G.city[1], V_MID, 'the middle Villain is untouched');
    assert.equal(G.city[2], null, 'empty spaces stay empty');
    assert.equal(G.city[3], null, 'empty spaces stay empty');
  });
});

// ---------------------------------------------------------------------------
// WP-532 / D-24343: give-hq-hero-each-player (Paibok the Power Skrull Fight)
// ---------------------------------------------------------------------------

describe('executeVillainAbilities — give-hq-hero-each-player (WP-532 / D-24343)', () => {
  const paibokHook: VillainAbilityHook = {
    cardId: 'v-paibok' as CardExtId,
    timing: 'onFight',
    keywords: [],
    effects: [{ primitive: 'give-hq-hero-each-player' }],
  };

  // why: a 3-player G so non-current auto-gain (players 1 & 2) is observable alongside
  // the current player (0) parking; empty player zones so the discards start clean.
  function make3pG(
    hq: (CardExtId | null)[],
    heroDeck: CardExtId[],
    cardStats: Record<string, { cost: number }>,
  ): LegendaryGameState {
    return makeG({
      hooks: [paibokHook],
      hq: hq as LegendaryGameState['hq'],
      heroDeck,
      cardStats,
      messages: [],
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
        '2': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });
  }

  it('non-current players auto-gain the highest-cost HQ Hero (sorted, refilling), then the current player parks (≥ 2 HQ Heroes)', () => {
    const G = make3pG(
      ['h0', 'h1', 'h2', 'h3', 'h4'] as CardExtId[],
      ['r0', 'r1', 'r2', 'r3'] as CardExtId[],
      { h0: { cost: 3 }, h1: { cost: 7 }, h2: { cost: 2 }, h3: { cost: 5 }, h4: { cost: 1 }, r0: { cost: 9 }, r1: { cost: 9 }, r2: { cost: 0 }, r3: { cost: 0 } },
    );
    const results = executeVillainAbilities(G, CTX, 'v-paibok' as CardExtId, 'onFight');
    // player 1 (first non-current, sorted) gains highest-cost h1(7); slot refills r0(9).
    // player 2 then gains the new highest-cost r0(9); slot refills r1.
    assert.deepStrictEqual(G.playerZones['1']!.discard, ['h1'], 'player 1 gained highest-cost h1');
    assert.deepStrictEqual(G.playerZones['2']!.discard, ['r0'], 'player 2 gained the new highest-cost r0');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'current player has NOT gained yet (parked)');
    assert.deepStrictEqual(G.playerZones['1']!.victory, [], 'gain routes to discard, never victory');
    assert.equal(G.pendingGiveHqHeroChoices?.length, 1, 'current player parked exactly one choice');
    assert.deepStrictEqual(G.pendingGiveHqHeroChoices![0], { choiceType: 'give-hq-hero', playerID: '0' });
    // keyword-less primitive → no VillainEffectResult recorded (self-narrates instead).
    assert.deepStrictEqual(results, []);
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'handler ran — never a hollow');
  });

  it('current player AUTO-gains (no park) when exactly 1 HQ Hero remains', () => {
    // heroDeck empty → no refill; player 1 takes h4, leaving exactly h3 for player 0.
    const G = make3pG(
      [null, null, null, 'h3', 'h4'] as CardExtId[],
      [] as CardExtId[],
      { h3: { cost: 1 }, h4: { cost: 1 } },
    );
    executeVillainAbilities(G, CTX, 'v-paibok' as CardExtId, 'onFight');
    // player 1 gains the tie-break rightmost h4; player 2 then gains h3 (the last one);
    // the current player 0 finds an empty HQ → no-op.
    assert.deepStrictEqual(G.playerZones['1']!.discard, ['h4'], 'tie → rightmost (h4)');
    assert.deepStrictEqual(G.playerZones['2']!.discard, ['h3'], 'player 2 gains the remaining h3');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'no HQ Hero left for the current player');
    assert.equal(G.pendingGiveHqHeroChoices?.length ?? 0, 0, 'no park (nothing to choose)');
  });

  it('current player auto-gains the sole remaining Hero when the HQ has exactly one at their turn', () => {
    // 2-player G, heroDeck empty: player 1 takes h4, leaving exactly h0 for the current player 0.
    const G = makeG({
      hooks: [paibokHook],
      hq: ['h0', null, null, null, 'h4'] as LegendaryGameState['hq'],
      heroDeck: [] as CardExtId[],
      cardStats: { h0: { cost: 5 }, h4: { cost: 8 } },
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-paibok' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.playerZones['1']!.discard, ['h4'], 'player 1 gained highest-cost h4');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['h0'], 'current player AUTO-gained the sole remaining h0');
    assert.equal(G.pendingGiveHqHeroChoices?.length ?? 0, 0, 'exactly-1 is forced → no park');
  });

  it('full no-op (blocked) when the HQ is entirely empty — no gains, no park, no hollow', () => {
    const G = makeG({
      hooks: [paibokHook],
      hq: [null, null, null, null, null] as LegendaryGameState['hq'],
      heroDeck: [] as CardExtId[],
      cardStats: {},
      messages: [],
    });
    assert.doesNotThrow(() => executeVillainAbilities(G, CTX, 'v-paibok' as CardExtId, 'onFight'));
    assert.deepStrictEqual(G.playerZones['0']!.discard, []);
    assert.deepStrictEqual(G.playerZones['1']!.discard, []);
    assert.equal(G.pendingGiveHqHeroChoices?.length ?? 0, 0, 'no park on an empty HQ');
    assert.match(G.messages.at(-1)!.text, /no Hero in the HQ to gain/, 'self-narrates the blocked no-op');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'handler ran — never a hollow');
  });
});

// ---------------------------------------------------------------------------
// WP-541 / D-24350: gain-recruit-current (Hand Ninjas Fight-reward)
// ---------------------------------------------------------------------------

describe('executeVillainAbilities — gain-recruit-current (WP-541 / D-24350)', () => {
  function recruitHook(cardId: string, magnitude: number): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onFight',
      keywords: [],
      effects: [{ primitive: 'gain-recruit-current', magnitude }],
    };
  }

  it('adds the magnitude to the current player recruit economy, self-narrates, and records no hollow', () => {
    const G = makeG({ hooks: [recruitHook('v-hand-ninjas', 1)], messages: [] });
    G.turnEconomy.recruit = 2; // why: proves the gain ACCUMULATES onto existing recruit.
    const results = executeVillainAbilities(G, CTX, 'v-hand-ninjas' as CardExtId, 'onFight');
    assert.equal(G.turnEconomy.recruit, 3, 'gained +1 recruit on top of the existing 2');
    assert.equal(G.messages!.length, 1, 'one self-narrated Fight-effect line');
    assert.match(G.messages![0]!.text, /Fight effect: gained \+1 recruit\./);
    assert.equal(G.messages![0]!.outcome, 'applied');
    // why: gain-recruit-current is keyword-less → no VillainEffectResult recorded.
    assert.deepStrictEqual(results, [], 'no keyword-typed result recorded');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'no hollow when the handler fires');
  });

  it('adds a larger magnitude (proves N is honored, not hardcoded 1)', () => {
    const G = makeG({ hooks: [recruitHook('v-x', 3)], messages: [] });
    executeVillainAbilities(G, CTX, 'v-x' as CardExtId, 'onFight');
    assert.equal(G.turnEconomy.recruit, 3, 'gained +3 recruit');
    assert.match(G.messages![0]!.text, /gained \+3 recruit/);
  });

  it('defaults to +1 when a hand-built hook omits the magnitude (never adds NaN)', () => {
    const G = makeG({
      hooks: [{ cardId: 'v-bad' as CardExtId, timing: 'onFight', keywords: [], effects: [{ primitive: 'gain-recruit-current' }] }],
      messages: [],
    });
    executeVillainAbilities(G, CTX, 'v-bad' as CardExtId, 'onFight');
    assert.equal(G.turnEconomy.recruit, 1, 'absent magnitude defaults to +1');
  });
});

// ---------------------------------------------------------------------------
// WP-541 / D-24350: gain-officer-current (HYDRA Kidnappers Fight-reward)
// ---------------------------------------------------------------------------

describe('executeVillainAbilities — gain-officer-current (WP-541 / D-24350)', () => {
  const OFFICER = 'pile-shield-officer' as CardExtId;

  function officerHook(cardId: string): VillainAbilityHook {
    return {
      cardId: cardId as CardExtId,
      timing: 'onFight',
      keywords: [],
      effects: [{ primitive: 'gain-officer-current' }],
    };
  }

  it('moves one Officer from the supply pile to the current player discard, self-narrates, no hollow', () => {
    const G = makeG({
      hooks: [officerHook('v-hydra-kidnappers')],
      officers: [OFFICER, OFFICER, OFFICER],
      messages: [],
    });
    const results = executeVillainAbilities(G, CTX, 'v-hydra-kidnappers' as CardExtId, 'onFight');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [OFFICER], 'current player gained one Officer');
    assert.equal(G.piles.officers.length, 2, 'exactly one Officer left the supply pile');
    assert.equal(G.playerZones['1']!.discard.length, 0, 'only the current player gains');
    assert.equal(G.messages!.length, 1, 'one self-narrated Fight-effect line');
    assert.match(G.messages![0]!.text, /Fight effect: gained a S\.H\.I\.E\.L\.D\. Officer\./);
    assert.equal(G.messages![0]!.outcome, 'applied');
    // why: gain-officer-current is keyword-less → no VillainEffectResult recorded.
    assert.deepStrictEqual(results, [], 'no keyword-typed result recorded');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'no hollow when the handler fires');
  });

  it('is a logged no-op (never a throw) when the Officer supply is empty', () => {
    const G = makeG({ hooks: [officerHook('v-hydra-kidnappers')], officers: [], messages: [] });
    assert.doesNotThrow(() => executeVillainAbilities(G, CTX, 'v-hydra-kidnappers' as CardExtId, 'onFight'));
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'nothing gained from an empty pile');
    assert.equal(G.messages!.length, 1, 'the empty-pile no-op still narrates');
    assert.match(G.messages![0]!.text, /Fight effect: no S\.H\.I\.E\.L\.D\. Officer to gain\./);
    assert.equal(G.messages![0]!.outcome, 'blocked');
    assert.equal(G.diagnostics?.hollowEffects?.length ?? 0, 0, 'a reachable no-op is not a hollow');
  });
});
