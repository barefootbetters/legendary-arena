/**
 * Four mastermind tactics whose printed Fight reads "When you draw a new hand of cards at
 * the end of this turn, draw N extra cards." grow the defeating player's next hand (D-24813).
 *
 * cvwr Baron Helmut Zemo "Cursed Dynasty", mgtg Ego "I'm a Celestial, Sweetheart" and msis
 * Ebony Maw "Hear Me and Rejoice" print +2; co2e Doctor Doom "Treasures of Latveria" prints +3.
 * Only core's Treasures of Latveria ext_id was dispatched (WP-691 / D-24508), so these four
 * resolved to nothing.
 *
 * Builds each mastermind's real tactics deck from the committed data/cards/<set>.json, so the
 * dispatched ext_id is the one a live match carries. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { buildMastermindState } from '../mastermind/mastermind.setup.js';
import { dispatchTacticOnFight } from './tacticHandlers.js';

// why: resolve the repo-root data directory from this test's own location (the
// cvwrBigBerthaRevealOrWound.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

// why: the default HAND_SIZE (6) is duplicated rather than imported, so a drift in the
// engine base fails these assertions instead of being silently tracked.
const DEFAULT_HAND_SIZE = 6;

// why: identity shuffle — these tests look tactics up by id, so deck order is irrelevant.
const IDENTITY_SETUP_CONTEXT = {
  ctx: { numPlayers: 2 },
  random: { Shuffle: <T,>(items: T[]): T[] => [...items] },
};

const DISPATCH_SHUFFLE = { random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() } };

interface NextHandTacticCase {
  readonly setAbbr: string;
  readonly mastermindSlug: string;
  readonly tacticSlug: string;
  readonly tacticName: string;
  readonly printedWord: string;
  readonly extraCards: number;
}

const NEXT_HAND_TACTIC_CASES: readonly NextHandTacticCase[] = [
  { setAbbr: 'cvwr', mastermindSlug: 'baron-helmut-zemo', tacticSlug: 'cursed-dynasty', tacticName: 'Cursed Dynasty', printedWord: 'two', extraCards: 2 },
  { setAbbr: 'mgtg', mastermindSlug: 'ego-the-living-planet', tacticSlug: 'im-a-celestial-sweetheart', tacticName: "I'm a Celestial, Sweetheart", printedWord: 'two', extraCards: 2 },
  { setAbbr: 'msis', mastermindSlug: 'ebony-maw', tacticSlug: 'hear-me-and-rejoice', tacticName: 'Hear Me and Rejoice', printedWord: 'two', extraCards: 2 },
  { setAbbr: 'co2e', mastermindSlug: 'doctor-doom', tacticSlug: 'treasures-of-latveria', tacticName: 'Treasures of Latveria', printedWord: 'three', extraCards: 3 },
];

/**
 * Reads one committed set file.
 *
 * @param setAbbr - The set abbreviation.
 * @returns The parsed set data.
 */
function readSetData(setAbbr: string): { masterminds: Array<{ slug: string; cards: Array<{ slug: string; abilities?: string[] }> }> } {
  return JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
}

/**
 * Builds the mastermind's real tactics deck from the committed card data.
 *
 * @param setAbbr - The set abbreviation.
 * @param mastermindSlug - The mastermind's slug.
 * @returns The tactic ext_ids a live match would carry.
 */
function buildTacticsDeck(setAbbr: string, mastermindSlug: string): CardExtId[] {
  const setData = readSetData(setAbbr);
  const registry = {
    listSets: () => [{ abbr: setAbbr }],
    getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined),
  };
  const state = buildMastermindState(`${setAbbr}/${mastermindSlug}`, registry, IDENTITY_SETUP_CONTEXT, {});
  return state.tacticsDeck;
}

/**
 * Returns the printed Fight line of one tactic from the committed card data.
 *
 * @param testCase - The tactic under test.
 * @returns The tactic's first ability line.
 */
function readPrintedFightLine(testCase: NextHandTacticCase): string {
  const mastermind = readSetData(testCase.setAbbr).masterminds.find(
    (entry) => entry.slug === testCase.mastermindSlug,
  );
  const tactic = mastermind?.cards.find((card) => card.slug === testCase.tacticSlug);
  return tactic?.abilities?.[0] ?? '';
}

/**
 * Minimal state: the resolver touches only handSizeOverrides and messages.
 *
 * @returns A fresh game state.
 */
function makeState(): LegendaryGameState {
  return { messages: [] } as unknown as LegendaryGameState;
}

describe('next-hand extra-card mastermind tactics (D-24813)', () => {
  for (const testCase of NEXT_HAND_TACTIC_CASES) {
    const tacticId = `${testCase.setAbbr}-mastermind-${testCase.mastermindSlug}-${testCase.tacticSlug}`;

    it(`${tacticId} prints "draw ${testCase.printedWord} extra cards" as its Fight line`, () => {
      assert.equal(
        readPrintedFightLine(testCase),
        `Fight: When you draw a new hand of cards at the end of this turn, draw ${testCase.printedWord} extra cards.`,
      );
    });

    it(`${tacticId} is in the tactics deck built from the committed card data`, () => {
      assert.ok(buildTacticsDeck(testCase.setAbbr, testCase.mastermindSlug).includes(tacticId));
    });

    it(`${tacticId} adds +${String(testCase.extraCards)} to the defeating player's next hand`, () => {
      const G = makeState();
      dispatchTacticOnFight(G, { currentPlayer: '1' }, tacticId, DISPATCH_SHUFFLE);
      assert.deepEqual(G.handSizeOverrides, { '1': DEFAULT_HAND_SIZE + testCase.extraCards });
      assert.equal(G.messages.length, 1);
      assert.equal(G.messages[0]!.outcome, 'applied');
      assert.equal(
        G.messages[0]!.text,
        `Fight effect: Player 1 will draw ${String(DEFAULT_HAND_SIZE + testCase.extraCards)} cards on their next hand (+${String(testCase.extraCards)} extra, ${testCase.tacticName}).`,
      );
    });

    it(`${tacticId} stacks on an existing next-hand override instead of replacing it`, () => {
      const G = makeState();
      G.handSizeOverrides = { '0': 8, '1': 7 };
      dispatchTacticOnFight(G, { currentPlayer: '0' }, tacticId, DISPATCH_SHUFFLE);
      assert.deepEqual(G.handSizeOverrides, { '0': 8 + testCase.extraCards, '1': 7 });
    });
  }
});
