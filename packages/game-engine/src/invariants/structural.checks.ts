/**
 * Structural invariant checks for the Legendary Arena game engine.
 *
 * Pure check functions that read G and assert structural invariants
 * via assertInvariant. None of these functions mutate G, perform I/O,
 * or import the game framework. Each function has a single responsibility
 * and short-circuits on the first violation via assertInvariant
 * throwing.
 */

import type { LegendaryGameState } from '../types.js';
import { assertInvariant } from './assertInvariant.js';

/**
 * Asserts that the City zone has exactly five spaces.
 *
 * The CityZone type is a fixed 5-tuple at the type level, but a
 * runtime mutation that bypassed the type system (test pollution,
 * accidental array push, type cast) could break the invariant. This
 * check guards against that.
 */
// why: prevents board-layout corruption — a 4-space or 6-space City
// would break pushVillainIntoCity, the escape-edge index, and every
// City rendering downstream. Catches type-bypass and accidental-push
// bugs at the structural layer before gameRules checks rely on the
// fixed shape.
export function checkCitySize(G: LegendaryGameState): void {
  assertInvariant(
    G.city.length === 5,
    'structural',
    `The City zone must contain exactly 5 spaces (CityZone is a fixed 5-tuple). Found length: ${G.city.length}. Inspect buildInitialGameState and any code that mutates G.city for an out-of-bounds push, slice, or assignment.`,
  );
}

/**
 * Asserts that every PlayerZones field on every player is an array.
 *
 * The PlayerZones interface declares every field as Zone (= CardExtId[]),
 * but a runtime type-bypass (e.g., `(G.playerZones['0'] as any).deck = null`)
 * would break every move that iterates the zone. This check guards
 * against that.
 */
// why: prevents zone-shape corruption that would crash the move
// system before any meaningful gameRules check could fire. Each
// player zone is asserted independently so the error message
// identifies the offender. The canonical zone field names are
// `deck`, `hand`, `discard`, `inPlay`, `victory` (per Amendment
// A-031-02 — the WP draft text said "victoryPile" but the engine
// type is `victory`).
export function checkZoneArrayTypes(G: LegendaryGameState): void {
  // why: deterministic error reproducibility — fail-fast must identify
  // the same offending player on every run against the same broken G.
  const playerIds = Object.keys(G.playerZones).sort();

  for (const playerId of playerIds) {
    const zones = G.playerZones[playerId];
    assertInvariant(
      zones !== undefined,
      'structural',
      `PlayerZones entry for player '${playerId}' is missing. G.playerZones must contain an entry for every player ID returned by Object.keys. Inspect buildInitialGameState player loop for a missing assignment.`,
    );
    if (zones === undefined) return;

    assertInvariant(
      Array.isArray(zones.deck),
      'structural',
      `Player '${playerId}' deck must be an array of CardExtId strings. Found: ${typeof zones.deck} (${String(zones.deck)}). Inspect PlayerZones construction in buildInitialGameState.`,
    );
    assertInvariant(
      Array.isArray(zones.hand),
      'structural',
      `Player '${playerId}' hand must be an array of CardExtId strings. Found: ${typeof zones.hand} (${String(zones.hand)}). Inspect PlayerZones construction in buildInitialGameState.`,
    );
    assertInvariant(
      Array.isArray(zones.discard),
      'structural',
      `Player '${playerId}' discard must be an array of CardExtId strings. Found: ${typeof zones.discard} (${String(zones.discard)}). Inspect PlayerZones construction in buildInitialGameState.`,
    );
    assertInvariant(
      Array.isArray(zones.inPlay),
      'structural',
      `Player '${playerId}' inPlay must be an array of CardExtId strings. Found: ${typeof zones.inPlay} (${String(zones.inPlay)}). Inspect PlayerZones construction in buildInitialGameState.`,
    );
    assertInvariant(
      Array.isArray(zones.victory),
      'structural',
      `Player '${playerId}' victory must be an array of CardExtId strings. Found: ${typeof zones.victory} (${String(zones.victory)}). Inspect PlayerZones construction in buildInitialGameState.`,
    );
  }
}

/**
 * Asserts that every value in G.counters is a finite number.
 *
 * NaN, Infinity, and -Infinity are JSON-incompatible (NaN and
 * Infinity serialize to null, breaking determinism). Non-numeric
 * counter values would also break evaluateEndgame. This check
 * guards against both.
 */
// why: prevents endgame-evaluation corruption and serialization
// drift. evaluateEndgame compares counters against ESCAPE_LIMIT and
// other thresholds — a NaN counter would silently mis-evaluate and
// either trigger a false win/loss or never fire endgame at all.
export function checkCountersAreFinite(G: LegendaryGameState): void {
  // why: deterministic error reproducibility — fail-fast must identify
  // the same offending key on every run against the same broken G.
  const counterKeys = Object.keys(G.counters).sort();

  for (const counterKey of counterKeys) {
    const counterValue = G.counters[counterKey];
    assertInvariant(
      typeof counterValue === 'number' && Number.isFinite(counterValue),
      'structural',
      `Counter '${counterKey}' must be a finite number (int or float, not NaN, Infinity, or -Infinity). Found: ${String(counterValue)} (type: ${typeof counterValue}). Inspect any modifyCounter rule effect that writes this counter.`,
    );
  }
}

/**
 * Asserts that JSON.stringify(G) does not throw.
 *
 * Detects circular references, BigInts, Symbols, and other
 * JSON-incompatible values that would break replay reconstruction
 * and snapshot persistence. This is the structural variant of the
 * serialization check — it asserts that the operation succeeds.
 * The determinism variant (checkSerializationRoundtrip) asserts
 * that the operation is identity-preserving. Both checks are
 * non-overlapping and both are required (RS-7).
 */
// why: structural — operation succeeds. Roundtrip identity is
// determinism's concern (see checkSerializationRoundtrip in
// determinism.checks.ts). Splitting them lets each category own
// its own failure mode without false-attribution.
export function checkGIsSerializable(G: LegendaryGameState): void {
  let stringifySucceeded = false;
  try {
    JSON.stringify(G);
    stringifySucceeded = true;
  } catch {
    // why: catching is intentional — the throw outcome is the signal,
    // not an exception we want to propagate. We convert it to a
    // boolean for assertInvariant's contract.
    stringifySucceeded = false;
  }
  assertInvariant(
    stringifySucceeded,
    'structural',
    'G must be JSON-serializable at all times — JSON.stringify(G) threw during structural invariant check. Inspect G for circular references, BigInts, Symbols, or other JSON-incompatible values. Functions are caught separately by checkNoFunctionsInG (determinism category).',
  );
}
