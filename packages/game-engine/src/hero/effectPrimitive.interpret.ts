/**
 * Effect primitive interpreter (D-24030).
 *
 * Walks the homogeneous effect-descriptor AST (`rules/effectPrimitive.types.ts`) and
 * mutates `G` deterministically. Dispatch is data-driven: each node type maps to a
 * handler in EFFECT_NODE_HANDLERS and each value-expression type to an evaluator in
 * VALUE_EXPRESSION_EVALUATORS — both ImplementationMaps held OUTSIDE `G` (the WP-251
 * HERO_EFFECT_HANDLERS pattern). The interpreter is mechanic-agnostic: Berserk lives
 * only in the `HERO_COMPOSITION_MARKERS` data row, never in an `if` here.
 *
 * The transient `bind`/`ref` execution context is created fresh per top-level effect
 * evaluation and NEVER written to `G`/`ctx` (D-24029 §9 — the load-bearing replay
 * invariant). Nothing throws: a missing zone/binding/stat or a malformed node warns to
 * `G.messages` (best-effort) and defaults (skip / 0).
 *
 * No boardgame.io imports. No registry imports. No .reduce(). Uses zoneOps +
 * addResources only (the same helper surface as heroEffects.execute.ts).
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId, PlayerZones } from '../state/zones.types.js';
import type {
  EffectNode,
  EffectNodeType,
  ValueExpression,
  ValueExpressionType,
  SequenceNode,
  MoveCardNode,
  GainResourceNode,
  CardPrintedStatExpression,
  CountCardsByClassInZoneExpression,
  MaxClassCountInZoneExpression,
  TopDeckCardClassCountInZoneExpression,
  EffectZoneKind,
  EffectExecutionContext,
} from '../rules/effectPrimitive.types.js';
import { moveCardFromZone } from '../moves/zoneOps.js';
import { addResources } from '../economy/economy.logic.js';
import { formatCardRef } from '../log/logDisplay.js';

// ---------------------------------------------------------------------------
// Best-effort warning (non-throwing)
// ---------------------------------------------------------------------------

/**
 * Appends a warning to `G.messages` when it is a writable array. Best-effort: a minimal
 * test `G` without a `messages` array must still skip/default deterministically rather
 * than throwing while warning.
 *
 * @param G - Game state (mutated under Immer draft when messages is present).
 * @param message - The full-sentence warning to record.
 */
function pushPrimitiveWarning(G: LegendaryGameState, message: string): void {
  // why: best-effort — a missing/non-array G.messages (a narrow unit fixture) must not
  // turn a safe default into a thrown execution error (D-24029 §9 / EC §Warning).
  if (Array.isArray(G.messages)) {
    G.messages.push(message);
  }
}

// ---------------------------------------------------------------------------
// Zone resolution (explicit branches — no dynamic property access)
// ---------------------------------------------------------------------------

/**
 * Resolves a zone kind to the player's live zone array. Explicit branches per
 * EFFECT_ZONE_KINDS member (code-style: no dynamic property access for known keys).
 *
 * @param playerZones - The active player's zones.
 * @param zone - The EFFECT_ZONE_KINDS member to resolve.
 * @returns The live zone array for that kind.
 */
function getZoneArray(playerZones: PlayerZones, zone: EffectZoneKind): CardExtId[] {
  if (zone === 'deck') {
    return playerZones.deck;
  }
  // why: 'discard' is the only other EFFECT_ZONE_KIND (closed union)
  return playerZones.discard;
}

/**
 * Writes a new array back to the player's zone for a zone kind. Explicit branches per
 * EFFECT_ZONE_KINDS member (code-style: no dynamic property access for known keys).
 *
 * @param playerZones - The active player's zones (mutated under Immer draft).
 * @param zone - The EFFECT_ZONE_KINDS member to write.
 * @param cards - The new zone array (from moveCardFromZone).
 */
function setZoneArray(playerZones: PlayerZones, zone: EffectZoneKind, cards: CardExtId[]): void {
  if (zone === 'deck') {
    playerZones.deck = cards;
    return;
  }
  // why: 'discard' is the only other EFFECT_ZONE_KIND (closed union)
  playerZones.discard = cards;
}

// ---------------------------------------------------------------------------
// Value-expression evaluators + ImplementationMap (D-24030)
// ---------------------------------------------------------------------------

/**
 * Evaluates one value expression to a number. Mirrors HeroEffectHandler's shape: takes
 * `G` (for cardStats + best-effort warnings), the context (for `ref` resolution), and
 * `playerID` (for per-player zone access, e.g. deck-peek evaluators).
 */
type ValueExpressionEvaluator = (
  G: LegendaryGameState,
  expression: ValueExpression,
  context: EffectExecutionContext,
  playerID: string,
) => number;

/**
 * `card-printed-stat` — resolves `card.ref` from the context to a card id and returns
 * that card's printed `attack`/`recruit` from `G.cardStats`. A missing ref (unbound) or
 * a missing `cardStats` entry resolves to 0, warns, and never throws.
 *
 * @param G - Game state (read-only for cardStats; warns to messages).
 * @param expression - The card-printed-stat value expression.
 * @param context - The transient bind/ref store.
 * @returns The printed stat value, or 0 when unresolved.
 */
function evaluateCardPrintedStat(
  G: LegendaryGameState,
  expression: ValueExpression,
  context: EffectExecutionContext,
  _playerID: string,
): number {
  const statExpression = expression as CardPrintedStatExpression;
  const cardId = context.get(statExpression.card.ref);
  if (cardId === undefined) {
    // why: an unbound ref (e.g. an empty-deck move bound nothing, or a binding from a
    // separate top-level effect that is not visible here) resolves to 0 — deterministic.
    pushPrimitiveWarning(
      G,
      `A card-printed-stat value expression referenced the unbound binding "${statExpression.card.ref}" and resolved to 0. Check the effect composition.`,
    );
    return 0;
  }
  const cardStats = G.cardStats[cardId];
  if (cardStats === undefined) {
    // why: a card with no G.cardStats entry (a S.H.I.E.L.D. starter, D-21502) resolves
    // to 0 — the same accepted MVP limitation the reveal handler's skip-and-advance takes.
    pushPrimitiveWarning(
      G,
      `A card-printed-stat value expression read card "${cardId}" which has no cardStats entry and resolved to 0. This is the accepted starter-card limitation (D-21502).`,
    );
    return 0;
  }
  // why: stat ∈ {attack, recruit} (EffectResourceKind); read the named field explicitly
  // (code-style: no dynamic property access for known keys).
  if (statExpression.stat === 'attack') {
    return cardStats.attack;
  }
  // why: 'recruit' is the only other EffectResourceKind (closed union)
  return cardStats.recruit;
}

/**
 * `count-cards-by-class-in-zone` — counts the cards of a given hero class in a shared board
 * zone (the HQ) and returns that count. The Empowered mechanic composes it into a
 * `gain-resource` (+Attack per class card in the HQ). A missing HQ / missing `cardTraits`
 * resolves to 0, warns, and never throws.
 *
 * @param G - Game state (reads `G.hq` + `G.cardTraits`; warns to messages).
 * @param expression - The count-cards-by-class-in-zone value expression.
 * @param _context - The transient bind/ref store (unused — this count needs no bindings).
 * @returns The number of matching cards in the HQ, or 0 when unresolved.
 */
function evaluateCountCardsByClassInZone(
  G: LegendaryGameState,
  expression: ValueExpression,
  _context: EffectExecutionContext,
  _playerID: string,
): number {
  const countExpression = expression as CountCardsByClassInZoneExpression;
  // why: D-24044 — reads the SHARED `G.hq` board zone (not a per-player zone) + the same
  // `G.cardTraits[id].heroClass` map the WP-179 heroClassMatch evaluator reads. No
  // self-exclusion: Empowered counts ALL HQ cards of the class. A missing/non-array `G.hq`
  // or missing `G.cardTraits` (a minimal fixture) → 0 deterministically, never throws —
  // the same tolerant posture as the card-printed-stat starter limitation.
  const hqZone = G.hq;
  if (!Array.isArray(hqZone) || !G.cardTraits) {
    pushPrimitiveWarning(
      G,
      'A count-cards-by-class-in-zone value expression found no HQ zone or no card traits and resolved to 0. This is a setup invariant the count tolerates.',
    );
    return 0;
  }
  // why: 'hq' is the only EffectCountZoneKind (closed union) → read `G.hq` directly, no
  // dynamic property access. Iteration is index-ordered over the 5 HQ slots (deterministic).
  let matchCount = 0;
  for (const slotCardId of hqZone) {
    if (slotCardId === null) {
      continue;
    }
    const traitEntry = G.cardTraits[slotCardId];
    if (traitEntry !== undefined && traitEntry.heroClass === countExpression.heroClass) {
      matchCount += 1;
    }
  }
  return matchCount;
}

/**
 * `max-class-count-in-zone` — scans a shared board zone (HQ) and returns the maximum
 * per-class card count across candidate classes. When `classes === 'all'`, every class
 * present in the HQ is a candidate; when `classes` is a `string[]`, only the listed
 * classes are considered. Empty HQ, missing cardTraits, or no candidate class in the HQ
 * resolves to 0, warns, and never throws. The oracle-max evaluator for player-choice
 * Empowered forms (D-24063 + D-24064).
 *
 * @param G - Game state (reads `G.hq` + `G.cardTraits`; warns to messages).
 * @param expression - The max-class-count-in-zone value expression.
 * @param _context - The transient bind/ref store (unused — this count needs no bindings).
 * @returns The maximum class count, or 0 when unresolved.
 */
function evaluateMaxClassCountInZone(
  G: LegendaryGameState,
  expression: ValueExpression,
  _context: EffectExecutionContext,
  _playerID: string,
): number {
  // why: D-24063 — implementation of the oracle-max strategy; 'all' = scan all HQ classes,
  // string[] = enumerate only the listed candidate classes, return the highest count.
  const maxExpression = expression as MaxClassCountInZoneExpression;
  const hqZone = G.hq;
  // why: 'hq' is the only EffectCountZoneKind (closed union) → read G.hq directly; no
  // dynamic property access. A missing/non-array G.hq or missing G.cardTraits (minimal
  // fixture) → 0 deterministically — the same tolerant posture as count-cards-by-class.
  if (!Array.isArray(hqZone) || !G.cardTraits) {
    pushPrimitiveWarning(
      G,
      'A max-class-count-in-zone value expression found no HQ zone or no card traits and resolved to 0. This is a setup invariant the count tolerates.',
    );
    return 0;
  }
  // Build a per-class count map over the HQ (for...of only, no .reduce()).
  const classCountMap = new Map<string, number>();
  for (const slotCardId of hqZone) {
    if (slotCardId === null) {
      continue;
    }
    const traitEntry = G.cardTraits[slotCardId];
    if (traitEntry === undefined || typeof traitEntry.heroClass !== 'string') {
      continue;
    }
    const heroClass = traitEntry.heroClass;
    const existingCount = classCountMap.get(heroClass) ?? 0;
    classCountMap.set(heroClass, existingCount + 1);
  }
  // Find the maximum count among candidate classes (for...of only, no .reduce()).
  let maxCount = 0;
  if (maxExpression.classes === 'all') {
    // All classes present in the HQ are candidates.
    for (const count of classCountMap.values()) {
      if (count > maxCount) {
        maxCount = count;
      }
    }
  } else {
    // Only the enumerated classes are candidates.
    for (const candidateClass of maxExpression.classes) {
      const classCount = classCountMap.get(candidateClass) ?? 0;
      if (classCount > maxCount) {
        maxCount = classCount;
      }
    }
  }
  return maxCount;
}

/**
 * `top-deck-card-class-count-in-zone` — peeks the top card of the active player's deck
 * (no zone mutation), reads its hero class from `G.cardTraits`, and counts HQ cards of
 * that class. Empty deck, null heroClass, or classless top card → 0, warns, never throws.
 * The deck-peek evaluator for the dynamic Empowered form (D-24065 + D-24066).
 *
 * @param G - Game state (reads `G.playerZones[playerID].deck[0]`, `G.hq`, `G.cardTraits`; warns).
 * @param _expression - The top-deck-card-class-count-in-zone value expression (zone: 'hq').
 * @param _context - The transient bind/ref store (unused — this count needs no bindings).
 * @param playerID - The active player ID used to access the player's deck.
 * @returns The number of HQ cards sharing the top deck card's class, or 0 when unresolved.
 */
// why: D-24065 — peek-only; deck[0] class → HQ count; empty deck or classless card → 0;
// no zone move (determinism guarantee). Reads G.hq (shared board zone) for the count,
// consistent with count-cards-by-class-in-zone and max-class-count-in-zone evaluators.
function evaluateTopDeckCardClassCountInZone(
  G: LegendaryGameState,
  _expression: ValueExpression,
  _context: EffectExecutionContext,
  playerID: string,
): number {
  const topDeckExpression = _expression as TopDeckCardClassCountInZoneExpression;
  // why: 'hq' is the only EffectCountZoneKind (closed union) → read G.hq directly; no
  // dynamic property access. The expression carries zone for type completeness only.
  void topDeckExpression;
  const playerZones = G.playerZones[playerID];
  if (playerZones === undefined) {
    pushPrimitiveWarning(
      G,
      `A top-deck-card-class-count-in-zone value expression found no player zones for "${playerID}" and resolved to 0. Check the active player ID.`,
    );
    return 0;
  }
  // why: peek only — read deck[0] without splicing, moving, or modifying the array.
  const topCardId = playerZones.deck[0];
  if (topCardId === undefined) {
    // Empty deck → grant +0 deterministically; no reshuffle (D-24065 scope boundary).
    return 0;
  }
  if (!G.cardTraits) {
    pushPrimitiveWarning(
      G,
      'A top-deck-card-class-count-in-zone value expression found no card traits and resolved to 0. This is a setup invariant the evaluator tolerates.',
    );
    return 0;
  }
  const traitEntry = G.cardTraits[topCardId];
  const heroClass = traitEntry?.heroClass;
  // why: single-class MVP (D-24065) — null, empty string, or non-string heroClass → 0.
  if (typeof heroClass !== 'string' || heroClass === '') {
    return 0;
  }
  const hqZone = G.hq;
  if (!Array.isArray(hqZone)) {
    pushPrimitiveWarning(
      G,
      'A top-deck-card-class-count-in-zone value expression found no HQ zone and resolved to 0. This is a setup invariant the evaluator tolerates.',
    );
    return 0;
  }
  // why: 'hq' is the only EffectCountZoneKind (closed union) → iterate G.hq directly.
  // for...of only — no .reduce() (code-style §Patterns to Avoid).
  let matchCount = 0;
  for (const slotCardId of hqZone) {
    if (slotCardId === null) {
      continue;
    }
    const slotTraitEntry = G.cardTraits[slotCardId];
    if (slotTraitEntry !== undefined && slotTraitEntry.heroClass === heroClass) {
      matchCount += 1;
    }
  }
  return matchCount;
}

// why: D-24030 — value-expression ImplementationMap (mirrors HERO_EFFECT_HANDLERS), held
// OUTSIDE G. Partial so the runtime dispatch guard typechecks and the drift test pins its
// keys == VALUE_EXPRESSION_TYPES bidirectionally (the WP-251 HANDLED_KEYWORDS pattern).
export const VALUE_EXPRESSION_EVALUATORS: Partial<Record<ValueExpressionType, ValueExpressionEvaluator>> = {
  'card-printed-stat': evaluateCardPrintedStat,
  'count-cards-by-class-in-zone': evaluateCountCardsByClassInZone,
  'max-class-count-in-zone': evaluateMaxClassCountInZone,
  'top-deck-card-class-count-in-zone': evaluateTopDeckCardClassCountInZone,
};

/**
 * Resolves a value expression to a number via the guarded evaluator registry. An unknown
 * expression type warns and returns 0 (never throws) — closed TS unions are compile-time
 * only; the AST is data and a regenerated/loaded artifact may be malformed.
 *
 * @param G - Game state (warns to messages).
 * @param expression - The value expression to evaluate.
 * @param context - The transient bind/ref store.
 * @returns The resolved number, or 0 when the type is unknown.
 */
function evaluateValueExpression(
  G: LegendaryGameState,
  expression: ValueExpression,
  context: EffectExecutionContext,
  playerID: string,
): number {
  const evaluator = VALUE_EXPRESSION_EVALUATORS[expression.type];
  // why: runtime dispatch guard — confirm the key resolves BEFORE indexing (mirror
  // executeSingleEffect). An unknown value-expression type → warn + return 0, never throw.
  if (evaluator === undefined) {
    pushPrimitiveWarning(
      G,
      `A gain-resource amount used an unknown value-expression type "${String((expression as { type?: unknown }).type)}" and resolved to 0. Check the effect composition.`,
    );
    return 0;
  }
  return evaluator(G, expression, context, playerID);
}

// ---------------------------------------------------------------------------
// Node handlers + ImplementationMap (D-24030)
// ---------------------------------------------------------------------------

/**
 * A single effect-node handler. Mutates `G` for one node; returns void. `ctx` is threaded
 * for signature parity (boardgame.io ctx, passed as unknown to avoid the import) but is
 * unused by Berserk's primitives. `context` is the transient bind/ref store.
 *
 * `sourceCardId` (WP-317) is the card whose composition is running, or undefined when the
 * caller has no source card (the draw-or-empowered resolve path). It is execution
 * provenance for the `gain-resource` grant log only — never written to `G`, `ctx`, a
 * binding, or `context` (the D-24029 §9 replay invariant).
 */
type EffectNodeHandler = (
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  node: EffectNode,
  context: EffectExecutionContext,
  sourceCardId: CardExtId | undefined,
) => void;

/**
 * `sequence` — interprets each step in array order, threading the SAME context so a later
 * step's `ref` reads an earlier step's `bind`.
 */
function interpretSequenceNode(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  node: EffectNode,
  context: EffectExecutionContext,
  sourceCardId: CardExtId | undefined,
): void {
  const sequenceNode = node as SequenceNode;
  for (const step of sequenceNode.steps) {
    // why: WP-317 — forward the source card so a nested gain-resource (e.g. Berserk's
    // discard-then-gain sequence) attributes its grant log to the composition's card.
    dispatchEffectNode(G, ctx, playerID, step, context, sourceCardId);
  }
}

/**
 * `move-card` — moves the top card of `from` to `to` and, when `bind` is present AND a
 * card was found, records the moved card id in the context. An empty source zone is a
 * deterministic no-op: no move, no bind, no reshuffle.
 */
function interpretMoveCardNode(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  node: EffectNode,
  context: EffectExecutionContext,
  _sourceCardId: CardExtId | undefined,
): void {
  const moveNode = node as MoveCardNode;
  // why: EFFECT_OWNER_KINDS is closed to 'current-player' — both endpoints resolve to
  // the active player's own zones.
  const playerZones = G.playerZones[playerID];
  if (playerZones === undefined) {
    return;
  }
  const fromZone = getZoneArray(playerZones, moveNode.from.zone);
  // why: position 'top' = index 0 (EFFECT_CARD_POSITIONS is closed to 'top').
  const topCardId = fromZone[0];
  // why: empty source zone → no move, no bind, NO reshuffle — mirrors the reveal handler's
  // D-21502 empty-deck no-op; a reshuffle would need ctx.random + an interaction model out
  // of scope for the bootstrap.
  if (topCardId === undefined) {
    return;
  }
  const moveResult = moveCardFromZone(
    getZoneArray(playerZones, moveNode.from.zone),
    getZoneArray(playerZones, moveNode.to.zone),
    topCardId,
  );
  setZoneArray(playerZones, moveNode.from.zone, moveResult.from);
  setZoneArray(playerZones, moveNode.to.zone, moveResult.to);
  // why: bind the moved card id only when `bind` is present AND the move found a card —
  // an unbound ref then resolves to 0 (the empty-deck +0 path).
  if (moveNode.bind !== undefined && moveResult.found) {
    context.set(moveNode.bind, topCardId);
  }
}

/**
 * `gain-resource` — evaluates `amount` and adds it to the turn economy as `attack` or
 * `recruit`. An undefined turn economy warns and skips (mirrors the reveal attack guard).
 */
function interpretGainResourceNode(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  node: EffectNode,
  context: EffectExecutionContext,
  sourceCardId: CardExtId | undefined,
): void {
  const gainNode = node as GainResourceNode;
  // why: an undefined turn economy → warn + skip before evaluating, mirroring the reveal
  // handler's turnEconomy guard (no partial mutation).
  if (!G.turnEconomy) {
    pushPrimitiveWarning(
      G,
      'A gain-resource node ran with no turn economy present and was skipped. This is a setup invariant violation.',
    );
    return;
  }
  const amount = evaluateValueExpression(G, gainNode.amount, context, playerID);
  if (gainNode.resource === 'attack') {
    G.turnEconomy = addResources(G.turnEconomy, amount, 0);
  } else {
    // why: 'recruit' is the only other EffectResourceKind (closed union)
    G.turnEconomy = addResources(G.turnEconomy, 0, amount);
  }
  // why: WP-317 / D-24103 — the composable grant is otherwise silent, so every mechanic
  // on the D-24029/D-24044 substrate (Empowered, Berserk) added resources with no trace in
  // the play log — the "Empowered looks broken" confusion in the 2026-07-06 prod
  // diagnostic. This extends WP-295's per-play/skip logging with the per-grant amount it
  // deferred. `G.messages` is excluded from finalStateHash (D-24081/WP-294), so the log is
  // hash-safe.
  pushGainResourceLog(G, playerID, sourceCardId, amount, gainNode.resource);
}

/**
 * Appends the WP-317 grant-observability line for a composable `gain-resource` grant.
 *
 * Names the source card (when known), the granted amount, and the resource so a
 * composition-marker mechanic (Empowered, Berserk) is visible in the play log instead of
 * granting silently. Emitted for EVERY grant including `+0` — a `+0` line distinguishes a
 * composition that ran but counted zero matching cards (a correct no-op) from a
 * class/team-synergy gate that suppressed the ability (WP-295's `did not activate`, a
 * different cause). Reuses the `Array.isArray` guard so a narrow fixture `G` without a
 * `messages` array never throws.
 *
 * @param G - Game state (mutated under Immer draft when messages is present).
 * @param playerID - Active player ID.
 * @param sourceCardId - The card whose composition granted, or undefined (resolve path).
 * @param amount - The granted amount (may be 0).
 * @param resource - The granted resource ('attack' or 'recruit').
 */
function pushGainResourceLog(
  G: LegendaryGameState,
  playerID: string,
  sourceCardId: CardExtId | undefined,
  amount: number,
  resource: GainResourceNode['resource'],
): void {
  // why: mechanic-agnostic — the interpreter does not know Empowered vs Berserk, so the
  // copy names only the card + amount + resource, never the mechanic. ext-id form matches
  // WP-295's `… did not activate …` line and the `recruited <ext-id>` convention.
  const message =
    sourceCardId !== undefined
      ? `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, sourceCardId)} gained +${amount} ${resource}.`
      : `Player ${playerID} gained +${amount} ${resource}.`;
  if (Array.isArray(G.messages)) {
    G.messages.push(message);
  }
}

// why: D-24030 — node-type ImplementationMap (mirrors HERO_EFFECT_HANDLERS), held OUTSIDE
// G. Partial so the runtime dispatch guard typechecks and the drift test pins its keys ==
// EFFECT_NODE_TYPES bidirectionally (the WP-251 HANDLED_KEYWORDS pattern).
export const EFFECT_NODE_HANDLERS: Partial<Record<EffectNodeType, EffectNodeHandler>> = {
  'sequence': interpretSequenceNode,
  'move-card': interpretMoveCardNode,
  'gain-resource': interpretGainResourceNode,
};

// ---------------------------------------------------------------------------
// Dispatch + entry point
// ---------------------------------------------------------------------------

/**
 * Dispatches one node to its handler via the guarded registry. An unknown node type warns
 * and skips (never throws) — closed TS unions are compile-time only; the AST is data and a
 * regenerated/loaded artifact may carry a malformed `node.type`.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param ctx - boardgame.io context (unused by Berserk's primitives; threaded for parity).
 * @param playerID - Active player ID.
 * @param node - The effect node to interpret.
 * @param context - The transient bind/ref store (threaded down the recursion).
 * @param sourceCardId - The card whose composition is running, or undefined; forwarded to
 *   the handler for the WP-317 grant log (provenance only, never state).
 */
function dispatchEffectNode(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  node: EffectNode,
  context: EffectExecutionContext,
  sourceCardId: CardExtId | undefined,
): void {
  const handler = EFFECT_NODE_HANDLERS[node.type];
  // why: runtime dispatch guard — confirm the key resolves BEFORE indexing the
  // ImplementationMap (mirror executeSingleEffect's `if (handler === undefined) return;`).
  // A malformed node.type must not crash via MAP[type](...) on undefined.
  if (handler === undefined) {
    pushPrimitiveWarning(
      G,
      `A hero primitive effect used an unknown node type "${String((node as { type?: unknown }).type)}" and was skipped. Check the effect composition.`,
    );
    return;
  }
  handler(G, ctx, playerID, node, context, sourceCardId);
}

/**
 * Interprets one top-level hero primitive effect, mutating `G` deterministically.
 *
 * Called by executeHeroEffects per element of `hook.primitiveEffects`, inside the hook's
 * conditions-passed gate. Creates a FRESH execution context per call — bindings are not
 * shared across top-level effects.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param ctx - boardgame.io context (passed as unknown; unused by Berserk's primitives).
 * @param playerID - Active player ID (plain string, no framework import).
 * @param node - The top-level effect node (a composition's root, typically a `sequence`).
 * @param sourceCardId - The card whose composition is running (WP-317), used only to
 *   attribute the `gain-resource` grant log. Optional: the draw-or-empowered resolve path
 *   has no source card and passes it undefined (the grant log then omits the card). It is
 *   never written to `G`, `ctx`, or the execution context — provenance only.
 */
export function interpretHeroPrimitiveEffect(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  node: EffectNode,
  sourceCardId?: CardExtId,
): void {
  // why: D-24029 §9 / D-24030 — a FRESH EffectExecutionContext per top-level effect
  // evaluation, lexically scoped to this call and NEVER written to G/ctx. Transient
  // interpreter state, re-derived identically on replay, not game state — a persisted
  // binding would break the persistence boundary and risk replay double-application.
  const context: EffectExecutionContext = new Map<string, CardExtId>();
  dispatchEffectNode(G, ctx, playerID, node, context, sourceCardId);
}
