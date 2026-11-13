/**
 * Records the setup bundle for the WP-890 local match spike (D-24842).
 *
 * Loads the real card registry, wraps it in a recording reader, and runs the
 * featured table's match setup through it exactly as the server would
 * (`validateMatchSetup`, then `Game.setup()` via boardgame.io's
 * `InitializeGame`). Every read setup makes is written to
 * `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json`, the
 * plain-data input the arena-client's bundle reader serves in the browser.
 *
 * Usage:
 *   node scripts/build-local-spike-bundle.mjs           write the bundle
 *   node scripts/build-local-spike-bundle.mjs --check   exit 1 if the committed
 *                                                       bundle differs
 *
 * Needs `pnpm -r build` first: it imports the engine and registry `dist`.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import {
  LegendaryGame,
  computeStateHash,
  setRegistryForSetup,
  validateMatchSetup,
} from '@legendary-arena/game-engine';
import { createRegistryFromLocalFiles } from '@legendary-arena/registry';

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE_PATH = join(
  REPOSITORY_ROOT,
  'apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json',
);
const FEATURED_TABLE_SOURCE_PATH = join(
  REPOSITORY_ROOT,
  'apps/arena-client/src/lobby/featuredTable.ts',
);

// why: boardgame.io isn't a root dependency and ships `internal.js` as CJS
// only; createRequire anchored at the engine's package.json reaches the copy
// the engine itself resolves (the matchSeed.mjs bridge, WP §Assumes 16).
const engineRequire = createRequire(
  join(REPOSITORY_ROOT, 'packages/game-engine/package.json'),
);
const { InitializeGame } = engineRequire('boardgame.io/dist/cjs/internal.js');

/** The spike's fixed seed; mirrors `LOCAL_SPIKE_DEFAULT_SEED` in localSpikeClient.ts. */
const LOCAL_SPIKE_DEFAULT_SEED = 'local-spike-0001';

/** The featured table's seat count (`FEATURED_PLAYER_COUNT`). */
const FEATURED_PLAYER_COUNT = 1;

// why: a root script can't import an arena-client `.ts` module, so the nine
// FEATURED_TABLE fields are copied here and checked against featuredTable.ts's
// source text on every run (assertFeaturedTableMatchesSource).
const FEATURED_TABLE = {
  schemeId: 'core/midtown-bank-robbery',
  mastermindId: 'core/magneto',
  villainGroupIds: ['core/brotherhood'],
  henchmanGroupIds: ['core/sentinel'],
  heroDeckIds: ['core/spider-man', 'core/hulk', 'core/wolverine'],
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 12,
};

/**
 * Formats one FEATURED_TABLE value the way featuredTable.ts writes it.
 *
 * @param {string | number | string[]} value - A field value.
 * @returns {string} The TypeScript literal text.
 */
function formatSourceLiteral(value) {
  if (Array.isArray(value)) {
    const quotedItems = value.map((item) => `'${item}'`);
    return `[${quotedItems.join(', ')}]`;
  }
  if (typeof value === 'string') {
    return `'${value}'`;
  }
  return String(value);
}

/**
 * Exits 1 when the copied FEATURED_TABLE no longer matches featuredTable.ts.
 */
async function assertFeaturedTableMatchesSource() {
  let sourceText;
  try {
    sourceText = await readFile(FEATURED_TABLE_SOURCE_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      `Could not read ${FEATURED_TABLE_SOURCE_PATH} to check the featured table: ${error.message}`,
    );
  }
  const expectedLines = [`export const FEATURED_PLAYER_COUNT = ${FEATURED_PLAYER_COUNT};`];
  for (const [fieldName, value] of Object.entries(FEATURED_TABLE)) {
    expectedLines.push(`${fieldName}: ${formatSourceLiteral(value)},`);
  }
  for (const expectedLine of expectedLines) {
    if (!sourceText.includes(expectedLine)) {
      console.error(
        `The recorder's copy of FEATURED_TABLE differs from featuredTable.ts: "${expectedLine}" ` +
          'was not found. Update scripts/build-local-spike-bundle.mjs to match the featured table.',
      );
      process.exit(1);
    }
  }
}

/**
 * Compares two card records by `key` in code-unit order.
 *
 * @param {{ key: string }} left - First card.
 * @param {{ key: string }} right - Second card.
 * @returns {number} Sort order.
 */
function compareCardsByKey(left, right) {
  if (left.key < right.key) {
    return -1;
  }
  if (left.key > right.key) {
    return 1;
  }
  return 0;
}

/**
 * Wraps the registry in a reader that records every read setup makes.
 *
 * @param {object} registry - The real CardRegistry.
 * @returns {{ reader: object, sortedCards: object[], setData: Map<string, unknown>,
 *   answers: Map<string, Array<{ args: unknown[], result: unknown }>> }}
 */
function createRecordingReader(registry) {
  // why: readdir order differs between Windows and Linux, so the cards are
  // sorted by key; otherwise `--check` would depend on the machine. The sorted
  // array is what validation and setup see, so the bundle reproduces it.
  // why: the whole listCards() result and every set are kept because setup
  // reads them all (WP §Context); trimming the bundle is slice 3's problem.
  const sortedCards = [...registry.listCards()].sort(compareCardsByKey);
  const setData = new Map();
  const answers = new Map();
  const reader = {
    listCards: () => sortedCards.slice(),
    listSets: () => registry.listSets(),
    getSet: (abbr) => {
      const result = registry.getSet(abbr);
      setData.set(abbr, result);
      return result;
    },
  };
  if (registry.playerCountSetup !== undefined) {
    reader.playerCountSetup = registry.playerCountSetup;
  }
  addRecordedFunctions(registry, reader, answers);
  return { reader, sortedCards, setData, answers };
}

/**
 * Records one optional-function call, deduplicated by its arguments.
 *
 * @param {Map<string, Array<{ args: unknown[], result: unknown }>>} answers - The answer log.
 * @param {string} functionName - The reader function called.
 * @param {unknown[]} args - Its arguments.
 * @param {unknown} result - Its result.
 */
function recordAnswer(answers, functionName, args, result) {
  const entries = answers.get(functionName) ?? [];
  const argumentsKey = JSON.stringify(args);
  const isAlreadyRecorded = entries.some((entry) => JSON.stringify(entry.args) === argumentsKey);
  if (!isAlreadyRecorded) {
    entries.push({ args, result });
  }
  answers.set(functionName, entries);
}

/**
 * Adds a recording wrapper for each optional `resolve*` function the registry has.
 *
 * @param {object} registry - The real CardRegistry.
 * @param {object} reader - The recording reader being built.
 * @param {Map<string, Array<{ args: unknown[], result: unknown }>>} answers - The answer log.
 */
function addRecordedFunctions(registry, reader, answers) {
  if (typeof registry.resolveEffectiveHeroCount === 'function') {
    reader.resolveEffectiveHeroCount = (...args) => {
      const result = registry.resolveEffectiveHeroCount(...args);
      recordAnswer(answers, 'resolveEffectiveHeroCount', args, result);
      return result;
    };
  }
  if (typeof registry.resolveEffectiveHenchmenCount === 'function') {
    reader.resolveEffectiveHenchmenCount = (...args) => {
      const result = registry.resolveEffectiveHenchmenCount(...args);
      recordAnswer(answers, 'resolveEffectiveHenchmenCount', args, result);
      return result;
    };
  }
  if (typeof registry.resolveEffectiveVillainGroupCount === 'function') {
    reader.resolveEffectiveVillainGroupCount = (...args) => {
      const result = registry.resolveEffectiveVillainGroupCount(...args);
      recordAnswer(answers, 'resolveEffectiveVillainGroupCount', args, result);
      return result;
    };
  }
}

/**
 * Runs validation and setup through the recording reader.
 *
 * @param {object} reader - The recording reader.
 * @returns {object} boardgame.io's initial match state.
 */
function runRecordedSetup(reader) {
  const validation = validateMatchSetup(FEATURED_TABLE, reader, FEATURED_PLAYER_COUNT);
  if (!validation.ok) {
    const firstMessage = validation.errors[0]?.message ?? 'an unknown error';
    throw new Error(`The featured table failed match-setup validation: ${firstMessage}`);
  }
  setRegistryForSetup(reader);
  // why: this mirrors createLocalSpikeGame in localSpikeClient.ts, inlined
  // because a root script can't import an arena-client `.ts` module.
  const game = {
    ...LegendaryGame,
    seed: LOCAL_SPIKE_DEFAULT_SEED,
    setup: (context) => LegendaryGame.setup(context, FEATURED_TABLE),
    validateSetupData: () => undefined,
  };
  return InitializeGame({ game, numPlayers: FEATURED_PLAYER_COUNT });
}

/**
 * Turns a Map into a plain object with keys in code-unit order.
 *
 * @param {Map<string, unknown>} map - The map.
 * @returns {Record<string, unknown>} A plain object.
 */
function toSortedObject(map) {
  const sortedObject = {};
  for (const key of [...map.keys()].sort()) {
    sortedObject[key] = map.get(key);
  }
  return sortedObject;
}

/**
 * Builds the setup bundle v1 object, keys in the locked order.
 *
 * @param {object} recording - The recording reader's logs.
 * @param {object} registry - The real CardRegistry.
 * @param {object} initialState - boardgame.io's initial match state.
 * @returns {object} The bundle.
 */
function buildBundle(recording, registry, initialState) {
  const playerView = LegendaryGame.playerView({
    G: initialState.G,
    ctx: initialState.ctx,
    playerID: '0',
  });
  const imageUrls = playerView.matchCardImageUrls ?? [];
  return {
    schemaVersion: 1,
    bundleKind: 'local-spike-setup-bundle',
    numPlayers: FEATURED_PLAYER_COUNT,
    matchConfiguration: FEATURED_TABLE,
    seed: LOCAL_SPIKE_DEFAULT_SEED,
    matchCardImageUrlCount: new Set(imageUrls).size,
    initialStateHash: computeStateHash(initialState.G),
    cards: recording.sortedCards,
    sets: registry.listSets(),
    setData: toSortedObject(recording.setData),
    playerCountSetup: registry.playerCountSetup ?? null,
    answers: toSortedObject(recording.answers),
  };
}

/**
 * Reads the committed bundle, or null when there is none yet.
 *
 * @returns {Promise<string | null>} The file text.
 */
async function readCommittedBundle() {
  try {
    return await readFile(BUNDLE_PATH, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Could not read the committed bundle at ${BUNDLE_PATH}: ${error.message}`);
  }
}

/**
 * Prints the four locked summary lines.
 *
 * @param {object} bundle - The bundle.
 * @param {string} bundleText - Its file text.
 */
function printSummary(bundle, bundleText) {
  const bundleBytes = Buffer.from(bundleText, 'utf8');
  const gzipBytes = gzipSync(bundleBytes, { level: 9 });
  const answerCount = Object.values(bundle.answers).reduce((total, entries) => total + entries.length, 0);
  console.log(
    `cards ${bundle.cards.length}, sets ${bundle.sets.length}, ` +
      `setData ${Object.keys(bundle.setData).length}, answers ${answerCount}`,
  );
  console.log(`bundle bytes ${bundleBytes.length}, gzip ${gzipBytes.length}`);
  console.log(`matchCardImageUrls ${bundle.matchCardImageUrlCount} unique`);
  console.log(`initialStateHash ${bundle.initialStateHash}`);
}

/**
 * Entry point: record, then write or check the bundle.
 */
async function main() {
  const isCheckMode = process.argv.includes('--check');
  await assertFeaturedTableMatchesSource();
  const registry = await createRegistryFromLocalFiles({
    metadataDir: join(REPOSITORY_ROOT, 'data/metadata'),
    cardsDir: join(REPOSITORY_ROOT, 'data/cards'),
  });
  const recording = createRecordingReader(registry);
  const initialState = runRecordedSetup(recording.reader);
  const bundle = buildBundle(recording, registry, initialState);
  const bundleText = `${JSON.stringify(bundle)}\n`;
  if (isCheckMode) {
    const committedText = await readCommittedBundle();
    printSummary(bundle, bundleText);
    if (committedText !== bundleText) {
      console.error(
        `The committed bundle at ${BUNDLE_PATH} differs from a fresh recording. ` +
          'Run pnpm spike:local-bundle and commit the result.',
      );
      process.exit(1);
    }
    return;
  }
  try {
    await mkdir(dirname(BUNDLE_PATH), { recursive: true });
    await writeFile(BUNDLE_PATH, bundleText, 'utf8');
  } catch (error) {
    throw new Error(`Could not write the bundle to ${BUNDLE_PATH}: ${error.message}`);
  }
  printSummary(bundle, bundleText);
}

main().catch((error) => {
  console.error(`build-local-spike-bundle failed: ${error.message}`);
  process.exit(1);
});
