/**
 * Tests for the unresolved Master Strike hollow flag (WP-867 / D-24810).
 *
 * A Master Strike whose Mastermind reaches no per-Mastermind arm in
 * `mastermindStrikeHandler` records one `master-strike` hollow effect through
 * `recordHollowEffect` (structured record + the standard `blocked` log line).
 * Resolved Masterminds — including General Ross's partial arm — never do. The
 * overlay-parity case checks every `executable` / `deferred` row of
 * scripts/coverage/strike-provenance.json against the real dispatcher.
 *
 * New cases use the synthetic id 'test/no-strike-resolver', never a real
 * unresolved Mastermind, so implementing any strike never breaks this file.
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mastermindStrikeHandler } from './mastermindHandlers.js';
import { applyRuleEffects } from './ruleRuntime.effects.js';
import type { LegendaryGameState } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { HollowEffectRecord } from '../diagnostics/hollowEffect.types.js';
import { HOLLOW_EFFECTS_CAP } from '../diagnostics/hollowEffect.types.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UNRESOLVED_MASTERMIND_ID = 'test/no-strike-resolver';
const BASE_CARD_ID = 'test-no-strike-resolver-base';
const STRIKE_COUNT_LINE = 'Mastermind strike revealed — strike count incremented.';
const HOLLOW_LINE =
  `Unhandled effect observed: card "${BASE_CARD_ID}" declared a "master-strike" mechanic at ` +
  'onMastermindStrikeRevealed, but no executable handler was reached (no-handler).';

/**
 * Builds a complete LegendaryGameState from the mock registry and selects the
 * given Mastermind for the strike dispatcher.
 *
 * @param mastermindId - The `${setAbbr}/${slug}` Mastermind id the dispatcher branches on.
 * @returns A complete LegendaryGameState with that Mastermind selected.
 */
function makeTestState(mastermindId: string): LegendaryGameState {
  // why: built by the real setup (as ui/uiState.filter.test.ts does) rather than
  // the hand-rolled mastermindHandlers.test.ts fixture, which predates required
  // G fields (heroDeck, escapedPile, ...): Fin Fang Foom's arm (WP-864) reads
  // them in the parity case, and a complete state keeps this file type-clean
  // under typecheck:tests (D-24372).
  const setupConfig: MatchSetupConfig = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
  const registry: CardRegistryReader = { ...makeCardRegistryReader(), listCards: () => [] };
  const built = buildInitialGameState(setupConfig, registry, makeMockCtx());
  return {
    ...built,
    selection: { ...built.selection, mastermindId },
    mastermind: { ...built.mastermind, id: mastermindId, baseCardId: BASE_CARD_ID },
  };
}

/**
 * Returns the `master-strike` hollow records in the state's diagnostics channel.
 *
 * @param gameState - The game state after a strike.
 * @returns The `master-strike` records (empty when the channel is absent).
 */
function masterStrikeHollows(gameState: LegendaryGameState): HollowEffectRecord[] {
  const records = gameState.diagnostics?.hollowEffects ?? [];
  return records.filter((record) => record.mechanic === 'master-strike');
}

// ---------------------------------------------------------------------------
// Overlay parity inputs (test-only node:fs reads)
// ---------------------------------------------------------------------------

// why: the parity case reads the committed overlay and the card data to map each
// overlay row to its engine Mastermind id. Paths resolve from THIS file via
// import.meta.url (never process.cwd()), four levels up to the repo root from
// packages/game-engine/src/rules/ — the rules/effectRulings.test.ts and
// hero/deckCardKoTrigger.test.ts precedent. These reads are test-only; engine
// source performs no I/O.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
const STRIKE_PROVENANCE_PATH = path.join(REPO_ROOT, 'scripts', 'coverage', 'strike-provenance.json');
const CARD_DATA_DIRECTORY = path.join(REPO_ROOT, 'data', 'cards');

/**
 * Reads the committed strike provenance overlay's `strikes` map.
 *
 * @returns The overlay rows keyed by strike ext_id.
 */
function readStrikeOverlay(): Record<string, { status: string }> {
  const parsed = JSON.parse(readFileSync(STRIKE_PROVENANCE_PATH, 'utf8')) as {
    strikes: Record<string, { status: string }>;
  };
  return parsed.strikes;
}

/**
 * Maps every Mastermind's strike ext_id (`${abbr}-mastermind-${slug}-master-strike`)
 * to its engine Mastermind id (`${abbr}/${slug}`), from the card data.
 *
 * @returns The strike ext_id -> engine id map.
 */
function readStrikeExtIdToMastermindId(): Map<string, string> {
  const mapping = new Map<string, string>();
  const fileNames = readdirSync(CARD_DATA_DIRECTORY)
    .filter((name) => name.endsWith('.json'))
    .sort();
  for (const fileName of fileNames) {
    const setData = JSON.parse(readFileSync(path.join(CARD_DATA_DIRECTORY, fileName), 'utf8')) as {
      abbr?: unknown;
      masterminds?: { slug?: unknown; name?: unknown }[];
    };
    if (typeof setData.abbr !== 'string' || !Array.isArray(setData.masterminds)) {
      continue;
    }
    for (const mastermind of setData.masterminds) {
      // why: mirror the index builder's enumeration (readMastermindStrikes needs a
      // non-empty slug AND name), so the two Mastermind sets cannot diverge.
      if (
        typeof mastermind.slug !== 'string' ||
        mastermind.slug.length === 0 ||
        typeof mastermind.name !== 'string' ||
        mastermind.name.length === 0
      ) {
        continue;
      }
      mapping.set(
        `${setData.abbr}-mastermind-${mastermind.slug}-master-strike`,
        `${setData.abbr}/${mastermind.slug}`,
      );
    }
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mastermindStrikeHandler — unresolved Master Strike is a hollow effect (WP-867 / D-24810)', () => {
  it('records exactly one master-strike hollow and one blocked line for a Mastermind with no arm', () => {
    const gameState = makeTestState(UNRESOLVED_MASTERMIND_ID);
    const messagesBefore = gameState.messages.length;

    mastermindStrikeHandler(gameState, { ctx: { currentPlayer: '0', turn: 7 } }, { cardId: 'test-strike' }, {});

    assert.deepStrictEqual(gameState.diagnostics?.hollowEffects, [
      {
        cardId: BASE_CARD_ID,
        cardType: 'mastermind',
        timing: 'onMastermindStrikeRevealed',
        mechanic: 'master-strike',
        reason: 'no-handler',
        turn: 7,
      },
    ]);
    assert.equal(gameState.messages.length, messagesBefore + 1, 'exactly one new message');
    const appended = gameState.messages[messagesBefore];
    assert.ok(appended !== undefined);
    assert.equal(appended.text, HOLLOW_LINE);
    assert.equal(appended.outcome, 'blocked');
    assert.equal(appended.card, BASE_CARD_ID);
  });

  it('records turn 0 for a stub context with no ctx', () => {
    const gameState = makeTestState(UNRESOLVED_MASTERMIND_ID);

    mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' }, {});

    const records = masterStrikeHollows(gameState);
    assert.equal(records.length, 1);
    assert.equal(records[0]!.turn, 0);
  });

  it('still returns the generic strike effects and pushes the mastermindStrikeResolved notable event', () => {
    const gameState = makeTestState(UNRESOLVED_MASTERMIND_ID);

    const notableEventsBefore = gameState.notableEvents.length;

    const effects = mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' }, {});

    assert.deepStrictEqual(effects, [
      { type: 'modifyCounter', counter: 'masterStrikeCount', delta: 1 },
      { type: 'queueMessage', message: STRIKE_COUNT_LINE },
    ]);
    assert.equal(gameState.notableEvents.length, notableEventsBefore + 1);
    assert.equal(gameState.notableEvents[notableEventsBefore]!.type, 'mastermindStrikeResolved');
  });

  it('records no master-strike hollow for core Magneto or General Ross (an arm was reached)', () => {
    for (const mastermindId of ['core/magneto', 'wwhk/general-thunderbolt-ross']) {
      const gameState = makeTestState(mastermindId);

      mastermindStrikeHandler(gameState, { ctx: { currentPlayer: '0', turn: 2 } }, { cardId: 'test-strike' }, {});

      assert.deepStrictEqual(
        masterStrikeHollows(gameState),
        [],
        `${mastermindId} has a strike arm and must not be flagged hollow`,
      );
    }
  });

  it('drops the record and counts it once the hollow channel is at HOLLOW_EFFECTS_CAP', () => {
    const gameState = makeTestState(UNRESOLVED_MASTERMIND_ID);
    const filler: HollowEffectRecord[] = [];
    for (let i = 0; i < HOLLOW_EFFECTS_CAP; i += 1) {
      filler.push({
        cardId: `filler-${i}`,
        cardType: 'hero',
        timing: 'onPlay',
        mechanic: 'filler',
        reason: 'no-handler',
        turn: 1,
      });
    }
    gameState.diagnostics = { hollowEffects: filler, hollowEffectsDropped: 0 };
    const messagesBefore = gameState.messages.length;

    mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' }, {});

    assert.equal(gameState.diagnostics.hollowEffects.length, HOLLOW_EFFECTS_CAP);
    assert.deepStrictEqual(masterStrikeHollows(gameState), []);
    assert.equal(gameState.diagnostics.hollowEffectsDropped, 1);
    assert.equal(gameState.messages.length, messagesBefore, 'a dropped record writes no log line');
  });

  it('overlay parity: every executable / deferred strike-provenance row resolves through a real dispatcher arm', () => {
    const overlay = readStrikeOverlay();
    const overlayKeys = Object.keys(overlay);
    // why: lower bound — an empty or unread overlay must fail, not pass vacuously.
    assert.ok(overlayKeys.length >= 12, `expected at least 12 overlay rows, read ${overlayKeys.length}`);

    const extIdToMastermindId = readStrikeExtIdToMastermindId();
    let checkedCount = 0;
    for (const extId of overlayKeys) {
      const mastermindId = extIdToMastermindId.get(extId);
      assert.ok(mastermindId !== undefined, `overlay row "${extId}" maps to no Mastermind in the card data`);
      const row = overlay[extId]!;
      if (row.status !== 'executable' && row.status !== 'deferred') {
        continue;
      }
      const gameState = makeTestState(mastermindId);

      mastermindStrikeHandler(gameState, { ctx: { currentPlayer: '0', turn: 2 } }, { cardId: 'test-strike' }, {});

      assert.deepStrictEqual(
        masterStrikeHollows(gameState),
        [],
        `overlay row "${extId}" claims status "${row.status}" but ${mastermindId} reached no dispatcher arm`,
      );
      checkedCount += 1;
    }
    // why: 11 executable + General Ross deferred, plus Fin Fang Foom (WP-864 / D-24807,
    // on main at execution) = 13, plus The Mandarin (WP-875 / D-24822) = 14, plus Zarathos
    // (WP-758 / D-24588) = 15. A misspelled status filter would check fewer.
    assert.equal(checkedCount, 15);
  });

  it('logs the hollow line, then the strike-count line, once the pipeline applies the returned effects', () => {
    const gameState = makeTestState(UNRESOLVED_MASTERMIND_ID);

    const effects = mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' }, {});
    applyRuleEffects(gameState, {}, effects);

    const texts = gameState.messages.map((message) => message.text);
    assert.ok(texts.length >= 2);
    assert.deepStrictEqual(texts.slice(-2), [HOLLOW_LINE, STRIKE_COUNT_LINE]);
  });
});
