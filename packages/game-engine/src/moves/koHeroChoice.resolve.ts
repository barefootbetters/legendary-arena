/**
 * resolveKoHeroChoice move — resolves a pending KO-a-Hero player choice (WP-242).
 *
 * Called by the active player after a koHeroCurrentPlayer effect with ≥2
 * eligible targets appended a PendingKoHeroChoice to G.pendingKoHeroChoices.
 * The player selects which hero to KO from their discard, hand, or inPlay
 * zone; this move validates the selection against the current zone contents,
 * moves the chosen card to the KO pile, and front-pops the queue.
 *
 * All invalid states are silent no-ops (moves never throw). The queue is left
 * byte-identical on every no-op so the player can resubmit a valid target —
 * the block-all guard guarantees a valid target still exists while pending.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { koCard } from '../board/ko.logic.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';
// why: WP-492 / D-24298 — a magnitude-N KO entry (Whirlwind) owes more than one KO.
// After the player's pick, the resolve move auto-resolves any now-FORCED remainder,
// which needs the chooser's fresh distinct-eligible options. buildKoEligibleTargets
// is the SAME recompute the parker + the UIState projection use (no snapshot,
// D-24007); imported here so the forced remainder shares one eligibility source.
import { buildKoEligibleTargets, countKoableHeroes } from '../villain/villainEffects.execute.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveKoHeroChoice move.
 *
 * zone — which of the player's zones to KO from (discard | hand | inPlay).
 * cardId — the ext_id to KO (first matching occurrence in the named zone).
 */
export interface ResolveKoHeroChoiceArgs {
  zone: 'discard' | 'hand' | 'inPlay';
  cardId: CardExtId;
}

/**
 * Whether any KO-a-Hero choice is currently pending.
 *
 * Single predicate imported by the turn-end guards (endTurn, advanceStage)
 * and the block-all action-move guards. `undefined` and `[]` both mean no
 * pending choice (D-24007).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-KO queue holds at least one entry.
 */
export function hasPendingKoHeroChoice(G: LegendaryGameState): boolean {
  return (G.pendingKoHeroChoices?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending KO-a-Hero choice by KOing the selected card.
 *
 * Validate args → validate the front pending entry → KO against current G →
 * front-pop on success. Silent no-ops: invalid zone; empty / wound cardId;
 * empty queue; front.playerID mismatch; front.choiceType mismatch; cardId
 * absent from the named zone (queue intact — resubmit). It NEVER auto-resolves
 * a later entry whose eligible set collapsed to 1 (only the parker auto-KOs).
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the selected { zone, cardId } to KO.
 */
export function resolveKoHeroChoice({ G, playerID }: MoveContext, args: ResolveKoHeroChoiceArgs): void {
  // Step 1: Validate args — unknown zone, empty cardId, or a wound is a no-op
  if (args.zone !== 'discard' && args.zone !== 'hand' && args.zone !== 'inPlay') { return; }
  if (typeof args.cardId !== 'string' || args.cardId.length === 0) { return; }
  // why: a wound is never a "hero" for KO purposes (D-18503 carries forward);
  // selecting one is rejected so the printed "KO a Hero" can never remove a wound.
  if (args.cardId === WOUND_EXT_ID) { return; }

  // Step 2: Validate the front pending entry — front-only resolution (no index
  // in the payload, so a non-front entry can never be targeted)
  const queue = G.pendingKoHeroChoices;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }
  if (front.choiceType !== 'ko-hero') { return; }
  // why: WP-577 — a hand-scoped entry (Red Skull's strike parks `zones: ['hand']`)
  // may only KO from an allowed zone; a client or bot submitting another zone is a
  // silent no-op leaving the queue intact (resubmit). Absent `zones` ⇒ all zones
  // (the WP-242 villain ko-hero, byte-identical).
  if (front.zones !== undefined && !front.zones.includes(args.zone)) { return; }

  // Step 3: Resolve against CURRENT G — the chosen cardId must be present in
  // the named zone right now (no eligible snapshot is stored; eligibility is
  // recomputed fresh every time per D-24007)
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  const zoneArray = playerZones[args.zone];
  const moveResult = moveCardFromZone(zoneArray, [], args.cardId);
  if (!moveResult.found) {
    // why: invalid/stale target is a no-op that leaves the queue intact so the
    // player resubmits; the board-freeze guard guarantees a valid target exists
    return;
  }

  // Step 4: Mutate — shorten the source zone and KO the chosen card
  playerZones[args.zone] = moveResult.from;
  G.ko = koCard(G.ko, args.cardId);

  // Step 5: Narrate the resolved KO in the game log so the player sees WHICH
  // hero they KO'd. The fight-time line only says "the active player must KO a
  // hero" for this interactive (>=2-eligible) path — resolve-time naming was a
  // WP-316 §Scope Out deferral; this completes it. (The exactly-1 auto-KO path
  // already names its target at fight time.) `G.messages` is hash-excluded
  // (D-24081), so this adds no determinism / sentinel impact.
  const koHeroName = resolveCardName(G.cardDisplayData, args.cardId);
  pushLog(G, `Player ${playerID} KO'd ${koHeroName} (${args.cardId}).`);

  // Step 6: Decrement the front entry's remaining KOs owed (WP-492 / D-24298).
  // why: a bare entry (remaining absent) owes 1 → decrement to 0 → front-pop,
  // byte-identical to WP-242. A magnitude entry (Whirlwind) owes N; after this KO it
  // owes N-1.
  const owedAfterPick = (front.remaining ?? 1) - 1;
  if (owedAfterPick <= 0) {
    // why: this entry is fully resolved — front-pop (Array.shift, D-24007/D-24008).
    queue.shift();
    return;
  }

  // why: WP-492 / D-24298 — this entry still owes KOs. Auto-resolve any now-FORCED
  // remainder so the player is never shown a single-option pick: while exactly one
  // distinct eligible option remains, KO it (no decision) and decrement. Once a
  // genuine choice remains (≥ 2 options), keep the decremented entry so the player
  // picks again. A KO never grows the option count, so this terminates.
  let owed = owedAfterPick;
  while (owed > 0) {
    // why: WP-577 — honour the entry's zone allowlist (a hand-scoped Red Skull entry
    // stays hand-only through the forced remainder too). Absent ⇒ all zones.
    const eligible = buildKoEligibleTargets(playerZones, front.zones);
    if (eligible.length === 0) break; // why: nothing left to KO (fewer heroes than owed).
    // why: a genuine choice still remains only when the player has MORE KO-able
    // heroes than the count owed AND ≥ 2 distinct options — mirror the parker. Once
    // the KO is forced (physical ≤ owed, or all copies identical) auto-resolve it.
    if (countKoableHeroes(playerZones, front.zones) > owed && eligible.length >= 2) break;
    const forced = eligible[0]!;
    const forcedMove = moveCardFromZone(playerZones[forced.zone], [], forced.cardId);
    if (!forcedMove.found) break; // why: defensive — an unexpected move miss stops progress.
    playerZones[forced.zone] = forcedMove.from;
    G.ko = koCard(G.ko, forced.cardId);
    const forcedName = resolveCardName(G.cardDisplayData, forced.cardId);
    pushLog(G, `Player ${playerID} KO'd ${forcedName} (${forced.cardId}).`);
    owed -= 1;
  }

  if (owed <= 0) {
    // why: the forced remainder finished the entry — front-pop.
    queue.shift();
    return;
  }
  // why: a genuine choice still remains — persist the decremented owed count so the
  // player (or bot) makes the next pick and the UIState projects the right remaining.
  front.remaining = owed;
}
