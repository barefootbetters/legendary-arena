/**
 * resolveDefeatChoice move + the defeat-with-a-Bystander eligible-target builder
 * and shared dispatcher (WP-486 / D-24291).
 *
 * Called by the current player after Silent Sniper's `defeat-with-bystander` hero
 * effect ("Defeat a Villain or Mastermind that has a Bystander.") found ≥2
 * eligible targets and parked a PendingDefeatChoice. The player picks which
 * Villain (by City space index) or the Mastermind to defeat for free; this move
 * validates the chosen target is in the parked eligible set, front-pops the
 * pending entry, THEN dispatches the defeat via the shared fight-defeat core.
 *
 * why (D-24291): the front-pop happens BEFORE the defeat dispatch so that a
 * villain's onFight ability that parks its OWN pending choice (KO-a-hero, scry-KO,
 * capture-bystander) lands BEHIND the now-removed defeat entry in FIFO order — the
 * defeat resolves first, its consequence resolves next, no board freeze.
 *
 * The defeat spends NO attack and sets NO acted-this-turn flag (Silent Sniper is a
 * card play, not a fight): the shared cores (defeatCityVillainCore /
 * defeatMastermindTacticCore) exclude both by construction.
 *
 * All invalid states are silent no-ops (moves never throw). The queue is left
 * byte-identical on every no-op so the player can resubmit a valid target — the
 * block-all guard guarantees the parked targets still exist while pending.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState, DefeatWithBystanderTarget } from '../types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { defeatCityVillainCore } from './fightVillain.js';
import { defeatMastermindTacticCore } from './fightMastermind.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveDefeatChoice move.
 *
 * targetKind — which store the chosen target lives in. When `'villain'`,
 * `cityIndex` selects the City space (its unique, block-all-frozen selector);
 * `cityIndex` is ignored for `'mastermind'`.
 */
export interface ResolveDefeatChoiceArgs {
  targetKind: 'villain' | 'mastermind';
  cityIndex?: number;
}

/**
 * Whether any defeat-with-a-Bystander choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards. `undefined` and
 * `[]` both mean no pending choice (mirrors hasPendingReorderChoice, D-24286).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-defeat queue holds at least one entry.
 */
export function hasPendingDefeatChoice(G: LegendaryGameState): boolean {
  return (G.pendingDefeatChoices?.length ?? 0) > 0;
}

/**
 * Builds the deterministic list of eligible `defeat-with-bystander` targets.
 *
 * A target is eligible when it holds ≥1 captured Bystander: a City Villain whose
 * ext_id has a non-empty `G.attachedBystanders` entry, or the Mastermind when
 * `G.mastermind.attachedBystanders` is non-empty AND at least one tactic remains
 * (an already-vanquished Mastermind cannot be re-defeated).
 *
 * why (D-24291): the order is pinned — City spaces ascending (NOT the
 * `attachedBystanders` map, whose key order is not a stable contract), Mastermind
 * appended last — because this exact order feeds BOTH the UIState projection and
 * the `ai.legalMoves` bot/sim default; a drift there would flip a seeded decision.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns The eligible targets in the pinned order (City ascending, Mastermind last).
 */
export function buildDefeatWithBystanderTargets(
  G: LegendaryGameState,
): DefeatWithBystanderTarget[] {
  const targets: DefeatWithBystanderTarget[] = [];

  // why: iterate City spaces by ascending index (a stable contract) — NOT the
  // attachedBystanders map key order — so the target list replays identically.
  for (let cityIndex = 0; cityIndex < G.city.length; cityIndex++) {
    const cardId = G.city[cityIndex];
    if (cardId === null || cardId === undefined) {
      continue;
    }
    const attachedBystanders = G.attachedBystanders[cardId];
    if (attachedBystanders !== undefined && attachedBystanders.length > 0) {
      targets.push({ kind: 'villain', cityIndex, cardId });
    }
  }

  // why: the Mastermind's captured Bystanders live in a DIFFERENT store
  // (G.mastermind.attachedBystanders), so it is checked separately and appended
  // LAST. Require a remaining tactic — defeating "the Mastermind" defeats one
  // tactic, so a mastermind with no tactics left is not a defeatable target.
  const mastermindBystanders = G.mastermind.attachedBystanders ?? [];
  if (mastermindBystanders.length > 0 && G.mastermind.tacticsDeck.length > 0) {
    targets.push({ kind: 'mastermind', cardId: G.mastermind.baseCardId });
  }

  return targets;
}

/**
 * Dispatches a chosen defeat-with-a-Bystander target through the shared
 * fight-defeat core — a City Villain via defeatCityVillainCore (fires the
 * villain's onFight abilities), or the Mastermind tactic via
 * defeatMastermindTacticCore (no onFight). Spends no attack (the cores exclude it).
 *
 * why (D-24291): both the exactly-1 auto-defeat path (heroEffectDefeatWithBystander)
 * and the ≥2 resolve path (resolveDefeatChoice) route through this one dispatcher,
 * so the free defeat can never drift between the two cardinalities.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param ctx - The bare boardgame.io ctx (currentPlayer + turn), typed unknown to
 *   avoid a framework import; forwarded to the shared cores.
 * @param target - The eligible target to defeat.
 * @param shuffleContext - ShuffleProvider ({ random }) for a villain Fight scry reshuffle.
 */
export function dispatchDefeatWithBystanderTarget(
  G: LegendaryGameState,
  ctx: unknown,
  target: DefeatWithBystanderTarget,
  shuffleContext: ShuffleProvider,
): void {
  if (target.kind === 'mastermind') {
    defeatMastermindTacticCore(G, ctx);
    return;
  }
  // why: a villain target always carries its City space index; guard defensively
  // (a malformed target with no index is a silent no-op rather than a bad read).
  if (typeof target.cityIndex === 'number') {
    defeatCityVillainCore(G, ctx, target.cityIndex, shuffleContext);
  }
}

/**
 * Finds the parked eligible target that matches the resolve payload, or undefined
 * when the payload names no parked target.
 *
 * @param targets - The parked eligible targets (the front pending entry snapshot).
 * @param args - The submitted { targetKind, cityIndex }.
 * @returns The matching parked target, or undefined.
 */
function findChosenTarget(
  targets: DefeatWithBystanderTarget[],
  args: ResolveDefeatChoiceArgs,
): DefeatWithBystanderTarget | undefined {
  for (const target of targets) {
    if (args.targetKind === 'mastermind' && target.kind === 'mastermind') {
      return target;
    }
    if (
      args.targetKind === 'villain' &&
      target.kind === 'villain' &&
      target.cityIndex === args.cityIndex
    ) {
      return target;
    }
  }
  return undefined;
}

/**
 * Resolves the FRONT pending defeat-with-a-Bystander choice by defeating the
 * chosen target for free.
 *
 * Validate args → validate the front pending entry → the chosen target must be in
 * the parked eligible set → FRONT-POP the entry → dispatch the defeat via the
 * shared core. Silent no-ops: bad targetKind; a `villain` target with a
 * non-integer cityIndex; empty queue; front.playerID mismatch; front.choiceType
 * mismatch; a target not in the parked set (queue intact — resubmit).
 *
 * @param context - boardgame.io move context with G, ctx, playerID, random.
 * @param args - the chosen { targetKind, cityIndex }.
 */
export function resolveDefeatChoice(
  { G, ctx, playerID, random }: MoveContext,
  args: ResolveDefeatChoiceArgs,
): void {
  // Step 1: Validate args
  if (args.targetKind !== 'villain' && args.targetKind !== 'mastermind') {
    return;
  }
  if (args.targetKind === 'villain') {
    if (
      typeof args.cityIndex !== 'number' ||
      !Number.isInteger(args.cityIndex)
    ) {
      return;
    }
  }

  // Step 2: Validate the front pending entry — front-only resolution (no index in
  // the payload, so a non-front entry can never be targeted)
  const queue = G.pendingDefeatChoices;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }
  if (front.choiceType !== 'defeat-with-bystander') {
    return;
  }

  // Step 3: The chosen target must be one of the parked eligible targets. The
  // block-all guard froze the board since park time, so the snapshot still holds.
  const chosenTarget = findChosenTarget(front.targets, args);
  if (chosenTarget === undefined) {
    return;
  }

  // Step 4: FRONT-POP before the defeat dispatch — a villain's onFight ability can
  // park its OWN pending choice (KO-a-hero / scry-KO); popping the defeat entry
  // first makes that nested park land BEHIND it in FIFO order (D-24291), so the
  // defeat resolves before its consequence and the board never freezes.
  queue.shift();

  // Step 5: Dispatch the free defeat via the shared core (no attack spend). `ctx`
  // is the bare bgio ctx (currentPlayer); { random } supplies a villain Fight scry.
  dispatchDefeatWithBystanderTarget(G, ctx, chosenTarget, { random });
}
