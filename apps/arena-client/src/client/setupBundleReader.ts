/**
 * Plain-data card reader for the WP-890 local match spike (D-24842).
 *
 * `Game.setup()` reads card data through the engine's structural
 * `CardRegistryReader`. arena-client may not import the registry package at
 * runtime, so this module serves the same reads from a setup bundle that
 * `scripts/build-local-spike-bundle.mjs` recorded against the real registry.
 * The bundle is plain JSON; this file imports no engine runtime code.
 */

import type {
  CardRegistryReader,
  MatchConfiguration,
} from '@legendary-arena/game-engine';

/** The per-player-count table the engine reads off the reader. */
export type LocalSpikePlayerCountSetup = NonNullable<CardRegistryReader['playerCountSetup']>;

/** One recorded call to an optional reader function. */
export interface LocalSpikeRecordedAnswer {
  readonly args: readonly unknown[];
  readonly result: unknown;
}

/** Setup bundle v1: everything one match's setup read, recorded. */
export interface LocalSpikeSetupBundle {
  readonly schemaVersion: 1;
  readonly bundleKind: 'local-spike-setup-bundle';
  readonly numPlayers: number;
  readonly matchConfiguration: MatchConfiguration;
  readonly seed: string;
  readonly matchCardImageUrlCount: number;
  readonly initialStateHash: string;
  readonly cards: Array<{ key: string }>;
  readonly sets: Array<{ abbr: string }>;
  readonly setData: Readonly<Record<string, unknown>>;
  readonly playerCountSetup: LocalSpikePlayerCountSetup | null;
  readonly answers: Readonly<Record<string, readonly LocalSpikeRecordedAnswer[]>>;
}

/** The marker string every setup bundle carries in `bundleKind`. */
export const LOCAL_SPIKE_BUNDLE_KIND = 'local-spike-setup-bundle';

/**
 * Narrows an unknown value to a plain (non-array) object.
 *
 * @param value - Any value.
 * @returns True when the value is a non-null, non-array object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Narrows an unknown value to an array of strings.
 *
 * @param value - Any value.
 * @returns True when every element is a string.
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Narrows an unknown value to the nine-field match configuration.
 *
 * @param value - Any value.
 * @returns True when every composition field has the right type.
 */
function isMatchConfiguration(value: unknown): value is MatchConfiguration {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    typeof value.schemeId === 'string' &&
    typeof value.mastermindId === 'string' &&
    isStringArray(value.villainGroupIds) &&
    isStringArray(value.henchmanGroupIds) &&
    isStringArray(value.heroDeckIds) &&
    typeof value.bystandersCount === 'number' &&
    typeof value.woundsCount === 'number' &&
    typeof value.officersCount === 'number' &&
    typeof value.sidekicksCount === 'number'
  );
}

/**
 * Narrows an unknown value to an array of records that each carry a string field.
 *
 * @param value - Any value.
 * @param fieldName - The field every element must carry as a string.
 * @returns True when every element is an object with that string field.
 */
function isKeyedRecordArray<FieldName extends string>(
  value: unknown,
  fieldName: FieldName,
): value is Array<Record<FieldName, string>> {
  return (
    Array.isArray(value) &&
    value.every((item) => isPlainObject(item) && typeof item[fieldName] === 'string')
  );
}

/**
 * Narrows an unknown value to the per-player-count setup table.
 *
 * @param value - Any value.
 * @returns True when every row holds the four numeric counts.
 */
function isPlayerCountSetup(value: unknown): value is LocalSpikePlayerCountSetup {
  if (!isPlainObject(value)) {
    return false;
  }
  return Object.values(value).every(
    (row) =>
      isPlainObject(row) &&
      typeof row.villainGroupCount === 'number' &&
      typeof row.henchmenGroupCount === 'number' &&
      typeof row.villainDeckBystanderCount === 'number' &&
      typeof row.heroCount === 'number',
  );
}

/**
 * Narrows an unknown value to the recorded-answers map.
 *
 * @param value - Any value.
 * @returns True when every entry is an array of `{ args, result }`.
 */
function isAnswerMap(value: unknown): value is Record<string, LocalSpikeRecordedAnswer[]> {
  if (!isPlainObject(value)) {
    return false;
  }
  return Object.values(value).every(
    (entries) =>
      Array.isArray(entries) &&
      entries.every((entry) => isPlainObject(entry) && Array.isArray(entry.args) && 'result' in entry),
  );
}

/**
 * Throws a full-sentence error naming the bundle field that failed to parse.
 *
 * @param fieldName - The field.
 * @param expectation - What the field should have been.
 */
function failField(fieldName: string, expectation: string): never {
  throw new Error(
    `The local spike setup bundle's ${fieldName} field must be ${expectation}. ` +
      'Re-run pnpm spike:local-bundle to regenerate the bundle.',
  );
}

/**
 * Checks the bundle's version and kind marker.
 *
 * @param candidate - The top-level bundle object.
 */
function assertBundleHeader(candidate: Record<string, unknown>): void {
  if (candidate.schemaVersion !== 1) {
    throw new Error(
      `The local spike setup bundle has schemaVersion ${String(candidate.schemaVersion)}, but this ` +
        'client reads only schemaVersion 1. Regenerate the bundle with pnpm spike:local-bundle.',
    );
  }
  if (candidate.bundleKind !== LOCAL_SPIKE_BUNDLE_KIND) {
    throw new Error(
      `The value is not a local spike setup bundle: its bundleKind is ${String(candidate.bundleKind)}, ` +
        `not ${LOCAL_SPIKE_BUNDLE_KIND}. Check that the right file was loaded.`,
    );
  }
}

/**
 * Validates an unknown value (the imported JSON) as setup bundle v1.
 *
 * @param value - The parsed bundle JSON.
 * @returns The typed bundle; nested data is shared, not copied.
 * @throws When the version, kind marker or any field is wrong.
 */
export function parseLocalSpikeSetupBundle(value: unknown): LocalSpikeSetupBundle {
  if (!isPlainObject(value)) {
    throw new Error(
      'The local spike setup bundle must be a JSON object at the top level. ' +
        'Check that the right file was loaded.',
    );
  }
  assertBundleHeader(value);
  const { numPlayers, matchConfiguration, seed, matchCardImageUrlCount, initialStateHash } = value;
  const { cards, sets, setData, playerCountSetup, answers } = value;
  if (typeof numPlayers !== 'number') failField('numPlayers', 'a number');
  if (!isMatchConfiguration(matchConfiguration)) failField('matchConfiguration', 'a nine-field match configuration');
  if (typeof seed !== 'string') failField('seed', 'a string');
  if (typeof matchCardImageUrlCount !== 'number') failField('matchCardImageUrlCount', 'a number');
  if (typeof initialStateHash !== 'string') failField('initialStateHash', 'a string');
  if (!isKeyedRecordArray(cards, 'key')) failField('cards', 'an array of cards with a string key');
  if (!isKeyedRecordArray(sets, 'abbr')) failField('sets', 'an array of sets with a string abbr');
  if (!isPlainObject(setData)) failField('setData', 'an object keyed by set abbr');
  if (playerCountSetup !== null && !isPlayerCountSetup(playerCountSetup)) {
    failField('playerCountSetup', 'null or a table of per-player-count rows');
  }
  if (!isAnswerMap(answers)) failField('answers', 'an object of recorded { args, result } arrays');
  return {
    schemaVersion: 1,
    bundleKind: LOCAL_SPIKE_BUNDLE_KIND,
    numPlayers,
    matchConfiguration,
    seed,
    matchCardImageUrlCount,
    initialStateHash,
    cards,
    sets,
    setData,
    playerCountSetup,
    answers,
  };
}

/**
 * Formats a call for the unrecorded-answer error, e.g. `name("a", 1)`.
 *
 * @param functionName - The reader function.
 * @param args - Its arguments.
 * @returns The call text.
 */
function formatCall(functionName: string, args: readonly unknown[]): string {
  const argumentTexts = args.map((argument) => JSON.stringify(argument));
  return `${functionName}(${argumentTexts.join(', ')})`;
}

/**
 * Answers an optional reader call from the bundle's recorded answers.
 *
 * @param bundle - The setup bundle.
 * @param functionName - The reader function called.
 * @param args - Its arguments.
 * @returns The recorded numeric result.
 * @throws When the call was never recorded or its result isn't a number.
 */
function answerFromBundle(
  bundle: LocalSpikeSetupBundle,
  functionName: string,
  args: readonly unknown[],
): number {
  const argumentsKey = JSON.stringify(args);
  const entries = bundle.answers[functionName] ?? [];
  const entry = entries.find((candidate) => JSON.stringify(candidate.args) === argumentsKey);
  if (entry === undefined) {
    throw new Error(
      `The local spike setup bundle has no recorded answer for ${formatCall(functionName, args)}. ` +
        'Re-run pnpm spike:local-bundle for this setup.',
    );
  }
  if (typeof entry.result !== 'number') {
    throw new Error(
      `The local spike setup bundle's recorded answer for ${formatCall(functionName, args)} is not ` +
        'a number. Re-run pnpm spike:local-bundle for this setup.',
    );
  }
  return entry.result;
}

/**
 * Adds a reader function for each optional function the bundle recorded a call to.
 *
 * @param bundle - The setup bundle.
 * @param reader - The reader being built.
 */
function addRecordedFunctions(bundle: LocalSpikeSetupBundle, reader: CardRegistryReader): void {
  // why: a function never called during recording stays off the reader, so
  // the engine's own `?.` fallback applies exactly as it did during recording.
  if (bundle.answers.resolveEffectiveHeroCount !== undefined) {
    reader.resolveEffectiveHeroCount = (...args) =>
      answerFromBundle(bundle, 'resolveEffectiveHeroCount', args);
  }
  if (bundle.answers.resolveEffectiveHenchmenCount !== undefined) {
    reader.resolveEffectiveHenchmenCount = (...args) =>
      answerFromBundle(bundle, 'resolveEffectiveHenchmenCount', args);
  }
  if (bundle.answers.resolveEffectiveVillainGroupCount !== undefined) {
    reader.resolveEffectiveVillainGroupCount = (...args) =>
      answerFromBundle(bundle, 'resolveEffectiveVillainGroupCount', args);
  }
}

/**
 * Builds a `CardRegistryReader` that serves a setup bundle's recorded reads.
 *
 * @param bundle - A parsed setup bundle.
 * @returns A reader `Game.setup()` and `validateMatchSetup` can use.
 */
export function createSetupBundleReader(bundle: LocalSpikeSetupBundle): CardRegistryReader {
  const reader: CardRegistryReader = {
    // why: a new shallow copy per call, as the registry's listCards() rebuilds
    // its array per call, so a caller sorting or pushing never edits the bundle.
    listCards: () => bundle.cards.slice(),
    listSets: () => bundle.sets,
    getSet: (abbr) => (Object.hasOwn(bundle.setData, abbr) ? bundle.setData[abbr] : undefined),
    // why: conditional construction; under exactOptionalPropertyTypes the
    // property is omitted, never set to null or undefined, when the bundle has none.
    ...(bundle.playerCountSetup !== null ? { playerCountSetup: bundle.playerCountSetup } : {}),
  };
  addRecordedFunctions(bundle, reader);
  return reader;
}
