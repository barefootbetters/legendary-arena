/**
 * Next-hand extra draw (WP-866 / EC-904 / D-24809).
 *
 * Twelve hero lines print "When you draw a new hand (of cards at the end of) this turn, draw an
 * extra card" (or "two" / "three extra cards"): amwp Wasp's Infiltrate, ssw2 Captain Britain's
 * Lead the Captain Britain Corps, and ten more. The curated `[keyword:next-hand-extra-draw:N]`
 * marker rides the generic parser path, and the `next-hand-extra-draw` handler adds N to the
 * playing player's `G.handSizeOverrides` entry (the D-24352 additive write). The shipped
 * end-of-turn cleanup (D-24520) draws to that target and deletes the entry.
 *
 * Parser cases (T1-T5, T11) build hooks with buildHeroAbilityHooks from the COMMITTED
 * data/cards/*.json, so they fail on data without the marker. Handler cases dispatch through
 * executeSingleEffect so the magnitude pre-gate is exercised (T10).
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeSingleEffect } from './heroEffects.execute.js';
import { applyEndOfTurnCleanup } from '../moves/endOfTurnCleanup.logic.js';
import { formatCardRef } from '../log/logDisplay.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroAbilityHook, HeroEffectDescriptor } from '../rules/heroAbility.types.js';

// why: resolve the repo-root data directory from this test's own location (the
// amwpWaspSizeChanging.test.ts precedent), so the parser cases read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const INFILTRATE = 'amwp/wasp/infiltrate#0' as CardExtId;

/** A ShuffleProvider whose Shuffle reverses (the endOfTurnCleanup.logic.test.ts shape). */
const reverseShuffle = { random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() } };

const mockCtx = {
  ctx: { turn: 1 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

// ---------------------------------------------------------------------------
// Parser harness
// ---------------------------------------------------------------------------

/**
 * Builds the real hooks for one hero deck from the committed card data of one set.
 *
 * @param setAbbr - The set abbreviation (the data/cards file name).
 * @param heroSlug - The hero slug within that set.
 * @returns Every hook the hero deck produces.
 */
function buildCommittedHeroHooks(setAbbr: string, heroSlug: string): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: [`${setAbbr}/${heroSlug}`] } as unknown as MatchConfiguration);
}

/**
 * Returns every hook built for the first physical copy of one card.
 *
 * @param hooks - The hero deck's hooks.
 * @param heroSlug - The hero slug.
 * @param cardSlug - The card slug.
 * @returns The first copy's hooks, one per parsed ability line.
 */
function firstCopyHooks(hooks: HeroAbilityHook[], heroSlug: string, cardSlug: string): HeroAbilityHook[] {
  const cardHooks = hooks.filter((hook) => hook.cardId.includes(`/${heroSlug}/${cardSlug}#`));
  assert.ok(cardHooks.length > 0, `the committed data builds a hook for ${heroSlug}/${cardSlug}`);
  const firstCardId = cardHooks[0]!.cardId;
  return cardHooks.filter((hook) => hook.cardId === firstCardId);
}

/**
 * Returns the single first-copy hook that carries a next-hand-extra-draw effect.
 *
 * @param setAbbr - The set abbreviation.
 * @param heroSlug - The hero slug.
 * @param cardSlug - The card slug.
 * @returns The hook built from the marked line.
 */
function nextHandHook(setAbbr: string, heroSlug: string, cardSlug: string): HeroAbilityHook {
  const copyHooks = firstCopyHooks(buildCommittedHeroHooks(setAbbr, heroSlug), heroSlug, cardSlug);
  const marked = copyHooks.filter((hook) =>
    (hook.effects ?? []).some((effect) => effect.type === 'next-hand-extra-draw'),
  );
  assert.equal(marked.length, 1, `${setAbbr}/${heroSlug}/${cardSlug}: exactly one line carries next-hand-extra-draw`);
  return marked[0]!;
}

// ---------------------------------------------------------------------------
// Handler harness
// ---------------------------------------------------------------------------

/**
 * A minimal game state for the handler and cleanup cases (the endOfTurnCleanup.logic.test.ts
 * shape: player "0" zones, notable events, messages, empty display data).
 *
 * @param deck - Player 0's deck.
 * @param hand - Player 0's hand.
 * @returns The state, with no handSizeOverrides container.
 */
function makeState(deck: CardExtId[] = [], hand: CardExtId[] = []): LegendaryGameState {
  return {
    playerZones: {
      '0': { deck: [...deck], hand: [...hand], discard: [], inPlay: [], victory: [] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    notableEvents: [],
    messages: [],
    cardDisplayData: {},
    heroAbilityHooks: [],
  } as unknown as LegendaryGameState;
}

/**
 * The locked `applied` log text.
 *
 * @param G - The state (its display data renders the card reference).
 * @param nextHandSize - The new fill target.
 * @param extraCards - The magnitude just added.
 * @returns The expected log line.
 */
function appliedLine(G: LegendaryGameState, nextHandSize: number, extraCards: number): string {
  const card = formatCardRef(G.cardDisplayData, INFILTRATE);
  return `Player 0 will draw ${String(nextHandSize)} cards on their next hand (+${String(extraCards)} extra, ${card}).`;
}

const EXTRA_ONE: HeroEffectDescriptor = { type: 'next-hand-extra-draw', magnitude: 1 };
const EXTRA_TWO: HeroEffectDescriptor = { type: 'next-hand-extra-draw', magnitude: 2 };

// ---------------------------------------------------------------------------
// Parser (T1-T5, T11)
// ---------------------------------------------------------------------------

describe('next-hand-extra-draw parser on the committed data (WP-866 / D-24809)', () => {
  it('T1: amwp Wasp Infiltrate line 1 is an onPlay next-hand-extra-draw:1 with no gate and no hollow', () => {
    const hook = nextHandHook('amwp', 'wasp', 'infiltrate');

    assert.equal(hook.timing, 'onPlay');
    assert.deepStrictEqual(hook.effects, [{ type: 'next-hand-extra-draw', magnitude: 1 }]);
    assert.equal(
      (hook.conditions ?? []).some((condition) => condition.type === 'heroClassMatch'),
      false,
      'no heroClassMatch gate',
    );
    assert.deepStrictEqual(hook.unresolvedMarkers ?? [], [], 'unresolvedMarkers absent or empty');
  });

  it('T2: amwp Freedom Fighters Mystics line 0 emits the same effect, magnitude 1', () => {
    const hook = nextHandHook('amwp', 'freedom-fighters', 'mystics');

    assert.deepStrictEqual(hook.effects, [{ type: 'next-hand-extra-draw', magnitude: 1 }]);
  });

  it('T3: "two" / "three extra cards" lines carry magnitude 3, 2 and 2', () => {
    const lines: { setAbbr: string; heroSlug: string; cardSlug: string; magnitude: number }[] = [
      { setAbbr: 'ssw2', heroSlug: 'captain-britain', cardSlug: 'lead-the-captain-britain-corps', magnitude: 3 },
      { setAbbr: 'cosm', heroSlug: 'adam-warlock', cardSlug: 'regenerative-cocoon', magnitude: 2 },
      { setAbbr: 'msmc', heroSlug: 'warpath', cardSlug: 'endless-endurance', magnitude: 2 },
    ];
    for (const line of lines) {
      const hook = nextHandHook(line.setAbbr, line.heroSlug, line.cardSlug);
      assert.deepStrictEqual(
        hook.effects,
        [{ type: 'next-hand-extra-draw', magnitude: line.magnitude }],
        `${line.cardSlug} reads magnitude ${String(line.magnitude)} from its marker`,
      );
    }
  });

  it('T4: chmp Viv Vision Expanding Neural Network keeps its [hc:tech] gate', () => {
    const hook = nextHandHook('chmp', 'viv-vision', 'expanding-neural-network');

    assert.deepStrictEqual(hook.effects, [{ type: 'next-hand-extra-draw', magnitude: 1 }]);
    assert.ok(
      (hook.conditions ?? []).some((condition) => condition.type === 'heroClassMatch' && condition.value === 'tech'),
      'a heroClassMatch / tech condition gates the effect',
    );
  });

  it('T5: wwhk Bruce Banner Solve the Impossible keeps its Outwit gate', () => {
    const hook = nextHandHook('wwhk', 'bruce-banner', 'solve-the-impossible');

    assert.deepStrictEqual(hook.effects, [{ type: 'next-hand-extra-draw', magnitude: 1 }]);
    assert.ok(
      (hook.conditions ?? []).some(
        (condition) => condition.type === 'distinctHeroCostsAtLeast' && condition.value === '3',
      ),
      'a distinctHeroCostsAtLeast / 3 (Outwit) condition gates the effect',
    );
  });

  it('T11: dead Slapstick Surprise Chainsaw stays unmarked (its Excessive Violence gate is allowlist-only)', () => {
    // why: D-24556 — [keyword:Excessive Violence]: gates only EXCESSIVE_VIOLENCE_CARDS, and
    // Slapstick is not on it; a marker would fire on play with no gate. Green on today's data
    // too: this is a regression guard that keeps the card out until its allowlist enrolment.
    const copyHooks = firstCopyHooks(buildCommittedHeroHooks('dead', 'slapstick'), 'slapstick', 'surprise-chainsaw');
    for (const hook of copyHooks) {
      assert.equal(
        (hook.effects ?? []).some((effect) => effect.type === 'next-hand-extra-draw'),
        false,
        'no next-hand-extra-draw effect on any Surprise Chainsaw hook',
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Handler (T6-T8, T10) and consumer (T9)
// ---------------------------------------------------------------------------

describe('next-hand-extra-draw handler (WP-866 / D-24809)', () => {
  it('T6: magnitude 1 on an empty state lazily creates the container at HAND_SIZE + 1 and logs it', () => {
    const G = makeState();

    const isHandled = executeSingleEffect(G, mockCtx, '0', INFILTRATE, EXTRA_ONE);

    assert.equal(isHandled, true);
    assert.deepStrictEqual(G.handSizeOverrides, { '0': 7 });
    assert.equal(G.messages.length, 1, 'exactly one log line');
    assert.equal(G.messages[0]!.text, appliedLine(G, 7, 1));
    assert.equal(G.messages[0]!.outcome, 'applied');
    assert.equal(G.messages[0]!.card, INFILTRATE);
  });

  it('T7: a second copy stacks additively (7 then 9)', () => {
    const G = makeState();

    executeSingleEffect(G, mockCtx, '0', INFILTRATE, EXTRA_ONE);
    executeSingleEffect(G, mockCtx, '0', INFILTRATE, EXTRA_TWO);

    assert.deepStrictEqual(G.handSizeOverrides, { '0': 9 });
    assert.equal(G.messages.length, 2);
    assert.equal(G.messages[1]!.text, appliedLine(G, 9, 2));
  });

  it('T8: adds to an existing target and leaves other seats untouched', () => {
    const G = makeState();
    G.handSizeOverrides = { '0': 8, '1': 6 };

    executeSingleEffect(G, mockCtx, '0', INFILTRATE, EXTRA_ONE);

    assert.deepStrictEqual(G.handSizeOverrides, { '0': 9, '1': 6 });
  });

  it('T9: the end-of-turn cleanup draws the extra card once and consumes the entry', () => {
    const deck = Array.from({ length: 10 }, (_, i) => `d${String(i)}` as CardExtId);
    const G = makeState(deck, ['h1', 'h2'] as CardExtId[]);
    executeSingleEffect(G, mockCtx, '0', INFILTRATE, EXTRA_ONE);

    applyEndOfTurnCleanup(G, '0', reverseShuffle);

    assert.equal(G.playerZones['0']!.hand.length, 7, 'the new hand has the extra card');
    assert.equal(G.handSizeOverrides?.['0'], undefined, 'the one-shot entry was consumed');
  });

  it('T10: control — an effect with no magnitude is dropped by the pre-gate', () => {
    const G = makeState();

    const isHandled = executeSingleEffect(G, mockCtx, '0', INFILTRATE, { type: 'next-hand-extra-draw' });

    assert.equal(isHandled, false);
    assert.equal(G.handSizeOverrides, undefined, 'no handSizeOverrides container created');
  });
});
