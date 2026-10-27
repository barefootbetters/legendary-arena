import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, type DOMWrapper } from '@vue/test-utils';
import CityRow from './CityRow.vue';
import HQRow from './HQRow.vue';
import type {
  UICityCard,
  UICityState,
  UIDecksState,
  UIHQCard,
  UIHQState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import type { SubmitMove } from './uiMoveName.types';

/**
 * Tests that a column-aligned CityRow and HQRow put each HQ slot under the City
 * space Abomination pairs it with (D-24747).
 *
 * jsdom has no layout, so these pin the structure the shared column widths act
 * on: the cells pair up by position, each pair has the same column kind (edge
 * or space), and every HQ slot sits under its paired City space.
 */

const DECKS: UIDecksState = { villainDeckCount: 14, heroDeckCount: 42 };

const ECONOMY: UITurnEconomyState = {
  attack: 0,
  recruit: 0,
  availableAttack: 0,
  availableRecruit: 0,
  piercing: 0,
  woundsDrawn: 0,
};

const NO_MOVES: SubmitMove = () => {};

/**
 * A city card with the given id and cost.
 *
 * @param extId - The card id.
 * @param cost - The printed and projected fight cost.
 * @returns The city card.
 */
function villain(extId: string, cost: number): UICityCard {
  return {
    extId,
    type: 'villain',
    keywords: [],
    display: { extId, name: extId, imageUrl: '', cost },
    attachedHeroes: [],
    attachedHeroDisplay: [],
    attachedBystanderCount: 0,
    fightCost: cost,
  };
}

/**
 * An HQ hero with the given id.
 *
 * @param extId - The card id.
 * @returns The HQ card.
 */
function hero(extId: string): UIHQCard {
  return { extId, display: { extId, name: extId, imageUrl: '', cost: 3 } };
}

/** A city with villains in two of the five spaces (engine index 0 = Sewers). */
const CITY: UICityState = {
  spaces: [villain('doom-bot', 3), null, villain('electro', 5), null, null],
  escapedPile: [],
};

/** A full five-slot HQ. */
const HQ: UIHQState = {
  slots: ['hero-a', 'hero-b', 'hero-c', 'hero-d', 'hero-e'],
  slotDisplay: [hero('hero-a'), hero('hero-b'), hero('hero-c'), hero('hero-d'), hero('hero-e')],
};

/**
 * Mounts both rows with the given alignment flag and returns their cells.
 *
 * @param isColumnAligned - The flag passed to both rows.
 * @returns The City cells and HQ cells in left-to-right order, plus both sections.
 */
function mountRows(isColumnAligned: boolean) {
  const city = mount(CityRow, {
    props: { city: CITY, decks: DECKS, currentStage: 'main', economy: ECONOMY, submitMove: NO_MOVES, isColumnAligned },
  });
  const hq = mount(HQRow, {
    props: { hq: HQ, decks: DECKS, currentStage: 'main', economy: ECONOMY, submitMove: NO_MOVES, isColumnAligned },
  });
  return {
    citySection: city.find('[data-testid="play-city-row"]'),
    hqSection: hq.find('[data-testid="play-hq-row"]'),
    cityCells: city.findAll('li.city-space'),
    hqCells: hq.findAll('li.hq-slot'),
  };
}

/**
 * The cell at a position, failing the test when the row is shorter.
 *
 * @param cells - A row's cells in left-to-right order.
 * @param position - The 0-based column position.
 * @returns The cell.
 */
function cellAt(cells: DOMWrapper<Element>[], position: number): DOMWrapper<Element> {
  const cell = cells[position];
  assert.ok(cell, `Expected a cell at column ${position}, but the row has ${cells.length} cells.`);
  return cell;
}

/**
 * The column kind a cell's class gives it.
 *
 * @param cell - A City or HQ cell.
 * @returns 'edge', 'space', or 'none'.
 */
function columnKind(cell: DOMWrapper<Element>): string {
  const classes = cell.classes();
  if (classes.some((name) => name.endsWith('--edge-column'))) {
    return 'edge';
  }
  if (classes.some((name) => name.endsWith('--space-column'))) {
    return 'space';
  }
  return 'none';
}

describe('City / HQ column alignment (D-24747)', () => {
  test('aligned rows have the same number of cells and the same column kind at each position', () => {
    const { citySection, hqSection, cityCells, hqCells } = mountRows(true);
    assert.equal(citySection.classes().includes('city-row--column-aligned'), true);
    assert.equal(hqSection.classes().includes('hq-row--column-aligned'), true);
    assert.equal(cityCells.length, 7);
    assert.equal(hqCells.length, 7);
    const cityKinds = cityCells.map(columnKind);
    const hqKinds = hqCells.map(columnKind);
    assert.deepEqual(cityKinds, ['edge', 'space', 'space', 'space', 'space', 'space', 'edge']);
    assert.deepEqual(hqKinds, cityKinds);
  });

  test('the blank HQ cell sits under the Escaped Pile and the Hero Deck under the Villain Deck', () => {
    const { cityCells, hqCells } = mountRows(true);
    assert.equal(cellAt(cityCells, 0).find('[data-testid="play-escaped-pile"]').exists(), true);
    assert.equal(cellAt(hqCells, 0).attributes('data-testid'), 'play-hq-spacer');
    assert.equal(cellAt(hqCells, 0).attributes('aria-hidden'), 'true');
    assert.equal(cellAt(hqCells, 0).text(), '');
    assert.equal(cellAt(cityCells, 6).find('[data-testid="play-city-villain-deck"]').exists(), true);
    assert.equal(cellAt(hqCells, 6).find('[data-testid="play-hq-hero-deck"]').exists(), true);
  });

  test('each HQ slot sits under the City space Abomination pairs it with', () => {
    // why: the engine's pairing is hqSlotIndexUnderCitySpace (board/citySpaceNames.ts):
    // hq[4 - cityIndex], so Sewers (engine 0) is over the 5th HQ slot and Bridge
    // (engine 4) over the 1st. Written out here, not imported, so a change to
    // either side fails this test.
    const { cityCells, hqCells } = mountRows(true);
    const pairs: string[] = [];
    for (let position = 1; position <= 5; position += 1) {
      const cityIndex = Number(cellAt(cityCells, position).find('[data-city-index]').attributes('data-city-index'));
      const hqIndex = Number(cellAt(hqCells, position).find('[data-hq-index]').attributes('data-hq-index'));
      assert.equal(hqIndex, 4 - cityIndex, `column ${position}: HQ slot ${hqIndex} is under city index ${cityIndex}`);
      pairs.push(`${cellAt(cityCells, position).find('[data-slot-name]').attributes('data-slot-name')}:${hqIndex}`);
    }
    assert.deepEqual(pairs, ['Bridge:0', 'Streets:1', 'Rooftops:2', 'Bank:3', 'Sewers:4']);
  });

  test('without the flag neither row changes: no spacer and no column classes on the sections', () => {
    const { citySection, hqSection, cityCells, hqCells } = mountRows(false);
    assert.equal(citySection.classes().includes('city-row--column-aligned'), false);
    assert.equal(hqSection.classes().includes('hq-row--column-aligned'), false);
    assert.equal(cityCells.length, 7);
    assert.equal(hqCells.length, 6);
    assert.equal(cellAt(hqCells, 0).find('[data-hq-index]').attributes('data-hq-index'), '0');
  });
});
