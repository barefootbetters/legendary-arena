/**
 * Game rules invariant checks for the Legendary Arena game engine.
 *
 * Pure check functions that read G and assert game-rules invariants
 * via assertInvariant. None of these functions mutate G, perform I/O,
 * or import the game framework. The cross-zone duplicate scan
 * (checkNoCardInMultipleZones) follows the fungible-exclusion
 * semantics locked by Amendment A-031-01 and D-3103.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  SHIELD_AGENT_EXT_ID,
  SHIELD_TROOPER_EXT_ID,
  BYSTANDER_EXT_ID,
  WOUND_EXT_ID,
  SHIELD_OFFICER_EXT_ID,
  SIDEKICK_EXT_ID,
} from '../setup/buildInitialGameState.js';
import { assertInvariant } from './assertInvariant.js';

// why: D-3103 fungible token exclusion set. CardExtIds are card-type
// identifiers, not per-instance identifiers. The MVP engine reuses
// six well-known token strings inside piles and starting decks
// (8 copies of starting-shield-agent in every player's deck, 30
// copies of pile-bystander in G.piles.bystanders, etc.). A literal
// "no CardExtId in multiple zones" check would throw on every valid
// G produced by buildInitialGameState.
//
// why: the set is built from the canonical setup-layer constants
// (re-exported from buildInitialGameState.ts, where pilesInit.ts
// constants are also re-exported), not from inline string literals.
// This eliminates the drift risk: if a future setup-layer refactor
// renames any of the six constants, this Set follows automatically
// because it imports the same names. The post-mortem (01.6) flagged
// the original inline-literal form as a hidden-coupling risk; the
// setup-layer import is the WP-031 §Amendments A-031-01 item 1
// preferred form and matches the engine's existing convention of
// importing constants rather than duplicating their values.
const FUNGIBLE_TOKEN_EXT_IDS: ReadonlySet<CardExtId> = new Set<CardExtId>([
  SHIELD_AGENT_EXT_ID,
  SHIELD_TROOPER_EXT_ID,
  BYSTANDER_EXT_ID,
  WOUND_EXT_ID,
  SHIELD_OFFICER_EXT_ID,
  SIDEKICK_EXT_ID,
]);

/**
 * Asserts that no non-fungible CardExtId appears in more than one
 * distinct zone simultaneously.
 *
 * Per Amendment A-031-01 and D-3103, the six fungible token strings
 * (starting-shield-agent, starting-shield-trooper, pile-bystander,
 * pile-wound, pile-shield-officer, pile-sidekick) are excluded from
 * the dedup scan. All other CardExtIds (villain cards, henchmen,
 * scheme twists, virtual bystanders, mastermind strikes/tactics,
 * future hero-deck entries) are scanned: if the same string appears
 * in two distinct zone-name keys, the invariant fires.
 *
 * Scan order is deterministic: player zones (sorted by player id)
 * followed by global piles, city, hq, ko, villain deck, mastermind
 * tactics. attachedBystanders is excluded per D-1703 attachment
 * semantics.
 */
// why: detects the canonical "move forgot to remove from source zone"
// bug class for non-fungible cards. A move that adds a villain to
// G.city without removing it from G.villainDeck.deck would leave the
// same CardExtId in both zones — the check catches this. Fungible
// tokens are excluded because their cross-zone duplication is
// structurally legitimate (D-3103). A "no duplicates within one
// zone" check is a separate invariant and is deferred.
export function checkNoCardInMultipleZones(G: LegendaryGameState): void {
  // First-seen zone name per non-fungible CardExtId. Stored in an
  // object literal (not Map) so the check itself stays inside the
  // engine's "no Maps in any data structure" preference, even though
  // the local is not part of G.
  const firstSeenZone: Record<CardExtId, string> = {};

  // why: deterministic error reproducibility — fail-fast must identify
  // the same offending player on every run against the same broken G.
  const playerIds = Object.keys(G.playerZones).sort();

  for (const playerId of playerIds) {
    const zones = G.playerZones[playerId];
    if (zones === undefined) continue;

    scanZone(zones.deck, `playerZones[${playerId}].deck`, firstSeenZone);
    scanZone(zones.hand, `playerZones[${playerId}].hand`, firstSeenZone);
    scanZone(zones.discard, `playerZones[${playerId}].discard`, firstSeenZone);
    scanZone(zones.inPlay, `playerZones[${playerId}].inPlay`, firstSeenZone);
    scanZone(zones.victory, `playerZones[${playerId}].victory`, firstSeenZone);
  }

  scanZone(G.piles.bystanders, 'piles.bystanders', firstSeenZone);
  scanZone(G.piles.wounds, 'piles.wounds', firstSeenZone);
  scanZone(G.piles.officers, 'piles.officers', firstSeenZone);
  scanZone(G.piles.sidekicks, 'piles.sidekicks', firstSeenZone);

  for (let cityIndex = 0; cityIndex < G.city.length; cityIndex += 1) {
    const cardId = G.city[cityIndex];
    if (cardId === null || cardId === undefined) continue;
    visitCardId(cardId, `city[${cityIndex}]`, firstSeenZone);
  }

  for (let hqIndex = 0; hqIndex < G.hq.length; hqIndex += 1) {
    const cardId = G.hq[hqIndex];
    if (cardId === null || cardId === undefined) continue;
    visitCardId(cardId, `hq[${hqIndex}]`, firstSeenZone);
  }

  scanZone(G.ko, 'ko', firstSeenZone);
  scanZone(G.villainDeck.deck, 'villainDeck.deck', firstSeenZone);
  scanZone(G.villainDeck.discard, 'villainDeck.discard', firstSeenZone);
  scanZone(G.mastermind.tacticsDeck, 'mastermind.tacticsDeck', firstSeenZone);
  scanZone(G.mastermind.tacticsDefeated, 'mastermind.tacticsDefeated', firstSeenZone);

  // why: G.attachedBystanders is excluded from the cross-zone scan per
  // D-1703 attachment semantics. A bystander attached to a villain
  // simultaneously appears via the villain's City space (the villain
  // CardExtId is in G.city[N]) and via attachedBystanders[villainId]
  // (the bystander CardExtId is the captured one). These are not
  // duplicates — they are an attachment relationship, not a zone
  // membership.
}

/**
 * Scans a single zone array, visiting each non-fungible CardExtId
 * and either recording or flagging it.
 */
function scanZone(
  cards: readonly CardExtId[],
  zoneName: string,
  firstSeenZone: Record<CardExtId, string>,
): void {
  for (const cardId of cards) {
    visitCardId(cardId, zoneName, firstSeenZone);
  }
}

/**
 * Visits a single CardExtId. Skips fungibles. For non-fungibles,
 * either records the first sighting or asserts cross-zone duplication.
 */
function visitCardId(
  cardId: CardExtId,
  zoneName: string,
  firstSeenZone: Record<CardExtId, string>,
): void {
  if (FUNGIBLE_TOKEN_EXT_IDS.has(cardId)) return;

  const previousZone = firstSeenZone[cardId];
  if (previousZone === undefined) {
    firstSeenZone[cardId] = zoneName;
    return;
  }
  if (previousZone === zoneName) {
    // Same zone, same id — current check does not flag intra-zone
    // duplicates (deferred to a future "no duplicates within one
    // zone" invariant). Silent.
    return;
  }
  assertInvariant(
    false,
    'gameRules',
    `CardExtId '${cardId}' appears in more than one zone simultaneously (first seen in '${previousZone}', also found in '${zoneName}'). This is a game rules invariant violation — each non-fungible card must exist in exactly one zone at a time. Fungible token CardExtIds (starting-shield-agent, starting-shield-trooper, pile-bystander, pile-wound, pile-shield-officer, pile-sidekick) are excluded from this check per D-3103. Inspect any move that moved this card for a missing zoneOps.removeFromZone call.`,
  );
}

/**
 * Asserts that every zone and pile is an array of length >= 0.
 *
 * JavaScript arrays cannot have negative length at runtime, but this
 * check guards against type-bypass corruption that would assign a
 * non-array (undefined, null, number, object) to a zone field. Most
 * such corruption would already be caught by checkZoneArrayTypes for
 * player zones; this check extends the same guard to global piles,
 * city, hq, ko, villain deck, and mastermind tactics.
 */
// why: complements checkZoneArrayTypes (player zones) by guarding
// the global pile / city / hq / villain deck / mastermind containers
// against type-bypass corruption. Each container is asserted
// independently so the error message identifies the offender.
export function checkZoneCountsNonNegative(G: LegendaryGameState): void {
  assertNonNegativeArray(G.piles.bystanders, 'piles.bystanders');
  assertNonNegativeArray(G.piles.wounds, 'piles.wounds');
  assertNonNegativeArray(G.piles.officers, 'piles.officers');
  assertNonNegativeArray(G.piles.sidekicks, 'piles.sidekicks');
  assertNonNegativeArray(G.ko, 'ko');
  assertNonNegativeArray(G.villainDeck.deck, 'villainDeck.deck');
  assertNonNegativeArray(G.villainDeck.discard, 'villainDeck.discard');
  assertNonNegativeArray(G.mastermind.tacticsDeck, 'mastermind.tacticsDeck');
  assertNonNegativeArray(G.mastermind.tacticsDefeated, 'mastermind.tacticsDefeated');

  // why: deterministic error reproducibility — fail-fast must identify
  // the same offending player on every run against the same broken G.
  const playerIds = Object.keys(G.playerZones).sort();
  for (const playerId of playerIds) {
    const zones = G.playerZones[playerId];
    if (zones === undefined) continue;
    assertNonNegativeArray(zones.deck, `playerZones[${playerId}].deck`);
    assertNonNegativeArray(zones.hand, `playerZones[${playerId}].hand`);
    assertNonNegativeArray(zones.discard, `playerZones[${playerId}].discard`);
    assertNonNegativeArray(zones.inPlay, `playerZones[${playerId}].inPlay`);
    assertNonNegativeArray(zones.victory, `playerZones[${playerId}].victory`);
  }
}

function assertNonNegativeArray(value: unknown, location: string): void {
  assertInvariant(
    Array.isArray(value) && value.length >= 0,
    'gameRules',
    `Zone or pile '${location}' must be an array with length >= 0. Found: ${String(value)} (type: ${typeof value}). Inspect any assignment to this zone/pile for type corruption.`,
  );
}

/**
 * Asserts that every counter key is a non-empty string.
 *
 * Per RS-4 narrowing, this check does NOT enforce strict
 * ENDGAME_CONDITIONS membership. Runtime hooks may legitimately
 * introduce scheme-specific or mastermind-specific counter keys
 * beyond the canonical three. Strict membership would false-positive
 * on valid state. Value-finiteness is asserted independently by
 * checkCountersAreFinite (structural category).
 */
// why: strict ENDGAME_CONDITIONS membership is deferred until the
// canonical custom-key list is written (future WP). Current check
// asserts shape only — checkCountersAreFinite asserts value
// validity. References WP-023 safe-skip precedent (D-2302).
export function checkCountersUseConstants(G: LegendaryGameState): void {
  // why: deterministic error reproducibility — fail-fast must identify
  // the same offending key on every run against the same broken G.
  const counterKeys = Object.keys(G.counters).sort();

  for (const counterKey of counterKeys) {
    assertInvariant(
      typeof counterKey === 'string' && counterKey.length > 0,
      'gameRules',
      `Counter key must be a non-empty string (canonical ENDGAME_CONDITIONS or documented custom key per rule hook). Found: '${String(counterKey)}'. Inspect any modifyCounter effect that created this counter.`,
    );
  }
}
