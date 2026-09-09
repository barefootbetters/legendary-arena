/**
 * Hero effect execution for the Legendary Arena game engine.
 *
 * Executes a safe MVP subset of hero ability keywords when a hero card
 * is played. Only unconditional effects with valid magnitude are executed.
 * Conditional effects and unsupported keywords are safely skipped.
 *
 * Dispatch is data-driven (WP-251 / D-24022): each keyword maps to a handler
 * in HERO_EFFECT_HANDLERS (an ImplementationMap mirroring WP-009B) instead of a
 * switch. Handlers hold no state and live outside G.
 *
 * No boardgame.io imports. No registry imports. No .reduce().
 * Uses existing helpers only: moveCardFromZone, moveAllCards, shuffleDeck,
 * addResources, koCard.
 */

import type { LegendaryGameState, PendingHeroChoice, PendingUndercoverChoice } from '../types.js';
import { cardHasTeamWhenPlayed } from './effectiveTeams.logic.js';
import type { CardExtId, PlayerZones } from '../state/zones.types.js';
import type { CardStatEntry } from '../economy/economy.types.js';
import type { HeroKeyword } from '../rules/heroKeywords.js';
import { HERO_KEYWORDS } from '../rules/heroKeywords.js';
import type { HeroAbilityHook, HeroEffectDescriptor, InvestigateCriterion, InvestigateCandidate } from '../rules/heroAbility.types.js';
import { getHooksForCard, investigateCandidateMatches } from '../rules/heroAbility.types.js';
import type { EffectExecutionReason, EffectTrace, EffectTraceStatus } from '../diagnostics/hollowEffect.types.js';
import { isHollowReason, DEFERRED_BY_DESIGN_MECHANICS } from '../diagnostics/hollowEffect.types.js';
import { recordHollowEffect } from '../diagnostics/hollowEffect.record.js';
import { recordEffectTrace } from '../diagnostics/effectTrace.record.js';
import type { EffectNode } from '../rules/effectPrimitive.types.js';
import type { RevealRule, RevealAction, RevealPredicate, RevealActionKind } from '../rules/revealRule.js';
import {
  evaluateAllConditions,
  findFailedCondition,
  describeFailedCondition,
} from './heroConditions.evaluate.js';
import {
  isWaitAndSeeCondition,
  recordDeferredConditionalGrant,
  resolveDeferredConditionalGrants,
  REPEATABLE_DEFEAT_CONDITION_TYPE,
} from './deferredConditionalGrants.js';
import type { HeroEffectResult } from './heroEffects.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { shuffleDeck } from '../setup/shuffle.js';
import { moveCardFromZone, moveAllCards } from '../moves/zoneOps.js';
import { reshuffleDiscardIntoDeck } from '../moves/drawCards.logic.js';
import { addResources, enableRecruitSpendableAsAttack } from '../economy/economy.logic.js';
import { koCard } from '../board/ko.logic.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { gainWound } from '../board/wounds.logic.js';
import { resolveCountSource } from './heroCountSource.resolve.js';
import { interpretHeroPrimitiveEffect } from './effectPrimitive.interpret.js';
import { getEligibleVictoryVillains } from '../moves/resolveVictoryPileCardPick.js';
import { getEligibleZeroCostDiscardCards } from '../moves/resolveReturnZeroCostDiscard.js';
import { getEligibleDiscardToPlayCards } from '../moves/resolveDiscardToPlay.js';
import {
  buildDefeatWithBystanderTargets,
  dispatchDefeatWithBystanderTarget,
} from '../moves/defeatChoice.resolve.js';
import { formatCardRef } from '../log/logDisplay.js';
import {
  describeRevealPredicate,
  describeRevealActions,
  describeUnappliedRevealActions,
  formatRevealOutcomeLine,
} from './revealLog.js';
import { pushLog } from '../log/logPush.js';
import type { LogOutcome } from '../log/logOutcome.types.js';
import { composeTransformNarrative } from '../events/notableEvents.compose.js';

// ---------------------------------------------------------------------------
// MVP keyword set
// ---------------------------------------------------------------------------

// why: WP-215 adds 'rescue' and 'reveal' to the executed set. WP-217 adds
// 'reveal-ko' and 'reveal-min'. WP-218 adds 'reveal-ko-or-draw' (D-21802).
// WP-219 adds 'reveal-cost-attack' (D-21901) and 'reveal-odd-draw' (D-21902).
// WP-220 adds 'reveal-attack-choose' (D-22003).
// WP-223 adds 'reveal-ko-attack' (D-22301).
// WP-247 adds 'attack-per-count' (D-24016) — count-scaled attack.
// WP-248 adds 'optional-ko-reward' (D-24019) — parks a "you may KO a card; if
// you do, <reward>" interactive choice.
// 'wound' and 'conditional' remain deferred — they require targeting UI or
// additional game systems not yet implemented.
//
// why (WP-251 / re-spec WP-253 D-24024): the registry-drift test splits into two
// concerns. HANDLED_KEYWORDS is the keywords with a HERO_EFFECT_HANDLERS entry — the
// single handler-completeness authority (the drift test asserts the handler keys
// deep-equal it bidirectionally). After the reveal collapse there are 8 handlers:
// the 7 legacy reveal-* keywords lost their dedicated handlers (folded into the one
// 'reveal' handler) but stay executable via revealRulesForLegacyKeyword translation.
export const HANDLED_KEYWORDS = new Set<HeroKeyword>([
  'draw', 'attack', 'recruit', 'ko', 'rescue', 'reveal', 'attack-per-count', 'recruit-per-count', 'optional-ko-reward', 'optional-put-bottom-hq', 'put-any-number-bottom-hq', 'put-bottom-hq-icon-reward', 'victory-villain-attack', 'draw-or-empowered', 'count-scaled-choose', 'return-zero-cost-discard',
  // why: D-24156 — the plain "gain a Wound" family; each has a HERO_EFFECT_HANDLERS entry (heroEffectGainWound), so it belongs in HANDLED_KEYWORDS (the bidirectional handler-completeness authority).
  'gain-wound-self', 'gain-wound-each',
  // why: D-24148 — mandatory immediate empty-discard-reward-or-shuffle (Jocasta's Reprocess / Electromagnetic Eyebeams); has a HERO_EFFECT_HANDLERS entry, so it belongs here.
  'shuffle-discard-empty-reward',
  // why: WP-382 / D-24183 — auto-resolving Wound-restricted KO-a-Wound-then-reward (Healing Factor family); has a HERO_EFFECT_HANDLERS entry (heroEffectKoWoundReward), so it belongs here.
  'ko-wound-reward',
  // why: WP-383 / D-24184 — mandatory discard-to-play COST; has a HERO_EFFECT_HANDLERS entry (heroEffectDiscardToPlay) that parks the PendingDiscardToPlay, so it belongs here.
  'discard-to-play',
  // why: WP-486 / D-24291 — Silent Sniper's "Defeat a Villain or Mastermind that has a Bystander."; has a HERO_EFFECT_HANDLERS entry (heroEffectDefeatWithBystander) that defeats one eligible target via the shared fight-defeat path or parks a PendingDefeatChoice, so it belongs here.
  'defeat-with-bystander',
  // why: WP-535 / D-24345 — Rogue's Copy Powers "Play this card as a copy of another Hero you played this turn."; has a HERO_EFFECT_HANDLERS entry (heroEffectCopyPowers) that re-fires the chosen Hero's ability via the reentrant executeHeroEffects (or parks a PendingCopyPowersChoice when ≥2 qualify), so it belongs here.
  'copy-powers',
  // why: WP-580 / D-24389 — God of Thunder's "You can use Recruit as Attack this turn."; has a HERO_EFFECT_HANDLERS entry (heroEffectRecruitAsAttack) that sets the turn-scoped conversion flag, so it belongs here.
  'recruit-as-attack',
  // why: WP-592 / D-24401 — Rogue's Steal Abilities "Each player discards the top card of their deck. Play a copy of each of those cards."; has a HERO_EFFECT_HANDLERS entry (heroEffectStealAbilities) that runs the deterministic discard-then-copy phases, so it belongs here.
  'steal-abilities',
  // why: WP-564 / D-24373 — "Investigate for <criterion>" (static-criterion + draw); has a
  // HERO_EFFECT_HANDLERS entry (heroEffectInvestigate) that looks at the top N, draws the
  // first matching card, and bottoms the rest, so it belongs here.
  'investigate',
  // why: WP-658 / D-24469 — "[keyword:Transform] this into <second-form>" (wwhk); has a
  // HERO_EFFECT_HANDLERS entry (heroEffectTransform) that pulls the matching second-form out
  // of G.transformDeck into play, routes the base card back to the side deck, and applies the
  // second-form's printed attack/recruit, so it belongs here. The setup parser only emits a
  // transform effect for SUPPORTED_TRANSFORM_BASES cards; held-back cards never reach here.
  'transform',
  // why: WP-659 / D-24470 — "Each player may reveal another Hero → draw" (Psychic Link); has a
  // HERO_EFFECT_HANDLERS entry (heroEffectRevealFromHand) that draws for each player holding a
  // criterion match, so it belongs here (the bidirectional handler-completeness authority).
  'reveal-from-hand',
  // why: WP-663 / D-24474 — Shadowed Thoughts' "play the top Villain-Deck card → +2 Attack";
  // has a HERO_EFFECT_HANDLERS entry (heroEffectOptionalPlayVillainTop) that parks the
  // pending choice, so it belongs here. (Carries magnitude 2 → NOT in NO_MAGNITUDE_KEYWORDS.)
  'optional-play-villain-top',
  // why: WP-667 / D-24480 — Radioactive Riot's "you may KO a card from your hand or discard
  // pile" (no reward); has a HERO_EFFECT_HANDLERS entry (heroEffectOptionalKoHandDiscard) that
  // parks a no-reward entry into the shared optional-ko-reward pending queue, so it belongs
  // here. Carries NO magnitude → also in NO_MAGNITUDE_KEYWORDS.
  'optional-ko-hand-discard',
  // why: WP-668 / D-24481 — Jade Giantess' reveal-Hero-Deck-per-2-Recruit → gain printed
  // attack; has a HERO_EFFECT_HANDLERS entry (heroEffectRevealHeroDeckAttack), so it belongs
  // here. Carries magnitude (the divisor) → NOT in NO_MAGNITUDE_KEYWORDS.
  'reveal-herodeck-attack',
  // why: WP-676 / D-24492 — the Smash keyword ("you may discard another card from your hand;
  // if you do, +N attack"); has a HERO_EFFECT_HANDLERS entry (heroEffectSmash) that parks a
  // PendingSmashDiscard, so it belongs here. Carries a magnitude (the +N Attack) → NOT in
  // NO_MAGNITUDE_KEYWORDS.
  'smash',
  // why: WP-678 / D-24494 (supersedes D-24060) — the two Undercover source-shape keywords.
  // Each has a HERO_EFFECT_HANDLERS entry that sends the sourced card to the Victory Pile
  // (worth 1 VP, tracked in G.playerZones[pid].undercover). 'undercover-hand-shield-hero' parks
  // a PendingUndercoverChoice when ≥2 hand Heroes qualify; 'undercover-officer-stack' is
  // deterministic. Both carry NO magnitude → also in NO_MAGNITUDE_KEYWORDS. (The BARE
  // 'undercover' token is NOT here — it is an honest hollow, no source zone → no handler.)
  'undercover-hand-shield-hero',
  'undercover-officer-stack',
]);

// why: the 7 frozen legacy reveal keywords (REVEAL_KEYWORDS minus 'reveal') keep NO
// handler — they translate to a 'reveal' descriptor at parse time. They remain in
// the executable-coverage set so the drift test still recognizes them as reachable.
const FROZEN_REVEAL_TRANSLATED: readonly HeroKeyword[] = [
  'reveal-ko', 'reveal-min', 'reveal-ko-or-draw', 'reveal-cost-attack', 'reveal-odd-draw', 'reveal-attack-choose', 'reveal-ko-attack',
];

// why: D-24049 — wall-crawl executes at RECRUIT time (the recruitHero deck-top
// placement), so it has NO HERO_EFFECT_HANDLERS entry and is NOT in HANDLED_KEYWORDS.
// It still joins MVP_KEYWORDS via this recruit-time category for two load-bearing
// reasons: (a) the hero mechanic ledger classifies an MVP_KEYWORDS member `executable`;
// (b) classifyHeroEffectReason returns `applied` for it, so the onRecruit hook that
// executeHeroEffects visits at PLAY time (it does not filter by timing) classifies
// not-hollow instead of firing a `no-handler` hollow — without this membership the
// now-recognized keyword would trade the old parse-unrecognized hollow for a fresh
// no-handler one (a regression). NOT added to HANDLED_KEYWORDS (that demands a handler
// and would break the HERO_EFFECT_HANDLERS-keys ↔ HANDLED_KEYWORDS bidirectional test).
export const RECRUIT_TIME_EXECUTED_KEYWORDS: readonly HeroKeyword[] = ['wall-crawl'];

// why: D-24051 — dodge executes from the dodgeCard hand-discard-to-draw MOVE (the player
// discards a Dodge card from hand to draw a replacement), so — like wall-crawl — it has NO
// HERO_EFFECT_HANDLERS entry and is NOT in HANDLED_KEYWORDS. It still joins MVP_KEYWORDS via
// this hand-action category for two load-bearing reasons: (a) the hero mechanic ledger
// classifies an MVP_KEYWORDS member `executable`; (b) classifyHeroEffectReason returns
// `applied` for it, so the onPlay hook that executeHeroEffects visits at PLAY time (it does
// not filter by timing) classifies not-hollow instead of firing a `no-handler` hollow —
// without this membership the now-recognized keyword would trade the old parse-unrecognized
// hollow for a fresh no-handler one (a regression). Kept a SEPARATE set from
// RECRUIT_TIME_EXECUTED_KEYWORDS (duplicate-first per §16.1 — the two categories execute at
// different times and a premature merge would blur that); NOT added to HANDLED_KEYWORDS
// (that demands a handler and would break the HERO_EFFECT_HANDLERS-keys ↔ HANDLED_KEYWORDS
// bidirectional test).
export const HAND_ACTION_EXECUTED_KEYWORDS: readonly HeroKeyword[] = ['dodge'];

// why: WP-678 / D-24494 (supersedes D-24060) — the WP-282 face-down-execution category is
// retired. Undercover no longer executes via a face-down store (that model was dead code —
// removed with the sendUndercover/playFromUndercover moves + the faceDownCards zone). Its two
// real, handler-bearing source-shape keywords (undercover-hand-shield-hero /
// undercover-officer-stack) are in HANDLED_KEYWORDS; the bare 'undercover' token is now an
// honest hollow (no source zone → no handler), so it is intentionally NOT in MVP_KEYWORDS.

// why: D-24074 — size-changing's effect is a class-grant realized at class-read time (no onPlay handler); membership keeps the play-time hook visit not-hollow (the wall-crawl pattern)
// Size-Changing ("when you play this card, it has the [Class] class") has NO
// HERO_EFFECT_HANDLERS entry and is NOT in HANDLED_KEYWORDS — like wall-crawl / dodge /
// undercover. Its effect is realized by the class-condition reads (heroClassMatch /
// distinctHeroClassesAtLeast) consulting cardSizeChangingClasses, not by an onPlay action.
// It still joins MVP_KEYWORDS via this class-grant category for two load-bearing reasons:
// (a) the hero mechanic ledger classifies an MVP_KEYWORDS member `executable`; (b)
// classifyHeroEffectReason returns `applied` for it, so the onPlay hook that
// executeHeroEffects visits at PLAY time classifies not-hollow instead of firing a
// `no-handler` hollow — without this membership the now-recognized keyword would trade the
// old parse-unrecognized hollow for a fresh no-handler one (a regression). Kept a SEPARATE
// set from the recruit-/hand-/face-down-action categories (duplicate-first per §16.1 — they
// execute at different sites); NOT added to HANDLED_KEYWORDS (that demands a handler and
// would break the HERO_EFFECT_HANDLERS-keys ↔ HANDLED_KEYWORDS bidirectional test).
export const CLASS_GRANT_KEYWORDS: readonly HeroKeyword[] = ['size-changing'];

// why: WP-498 / D-24301 — return-on-discard executes REACTIVELY at the discardFromHand
// chokepoint (checkReturnOnDiscard parks a pending choice when a card effect discards the
// marked card from hand), so — like wall-crawl / dodge / undercover / size-changing — it has
// NO HERO_EFFECT_HANDLERS entry and is NOT in HANDLED_KEYWORDS. It still joins MVP_KEYWORDS
// via this discard-time category for two load-bearing reasons: (a) the hero mechanic ledger
// classifies an MVP_KEYWORDS member `executable`; (b) classifyHeroEffectReason returns
// `applied` for it, so the onDiscard hook that executeHeroEffects visits at PLAY time (it does
// not filter by timing) classifies not-hollow instead of firing a `no-handler` hollow —
// without this membership the now-recognized keyword would trade the old parse-unrecognized
// hollow for a fresh no-handler one (a regression). Kept a SEPARATE set from the
// recruit-/hand-/face-down-/class-grant categories (duplicate-first per §16.1 — they execute
// at different sites); NOT added to HANDLED_KEYWORDS (that demands a handler and would break
// the HERO_EFFECT_HANDLERS-keys ↔ HANDLED_KEYWORDS bidirectional test).
export const DISCARD_TIME_EXECUTED_KEYWORDS: readonly HeroKeyword[] = ['return-on-discard'];

// why (WP-251 / D-24024; D-24049; D-24051; D-24060): MVP_KEYWORDS = HANDLED_KEYWORDS ∪ the
// frozen-translated reveal keywords ∪ the recruit-time-executed keywords ∪ the
// hand-action-executed keywords ∪ the face-down-action-executed keywords — the set of
// keywords that execute (directly via a handler, via reveal translation, at recruit time via
// the recruitHero placement, via a hand-action move like dodgeCard, or via the face-down
// send/play moves). The executeSingleEffect pre-gate keys on it; the coverage drift test
// asserts every member is handled directly, reveal-translated, recruit-time-executed,
// hand-action-executed, OR face-down-executed. Do not duplicate this set elsewhere (the
// coverage probe's EXECUTED_KEYWORDS is a separate, informational copy).
export const MVP_KEYWORDS = new Set<string>([
  ...HANDLED_KEYWORDS,
  ...FROZEN_REVEAL_TRANSLATED,
  ...RECRUIT_TIME_EXECUTED_KEYWORDS,
  ...HAND_ACTION_EXECUTED_KEYWORDS,
  ...CLASS_GRANT_KEYWORDS,
  ...DISCARD_TIME_EXECUTED_KEYWORDS,
]);

// why: D-24019 — the reward of an optional-ko-reward effect is dispatched to an
// ALREADY-BUILT reward executor; only these four are seeded. Defensive guard at
// the park site: the parser already filters unseeded rewards, so an unseeded
// type here is a logged no-op that never reaches the pending queue. Mirrors the
// same constant in setup/heroAbility.setup.ts (two copies, per duplicate-first).
const OPTIONAL_KO_REWARD_SEEDED_REWARDS: ReadonlySet<HeroKeyword> = new Set<HeroKeyword>([
  'rescue',
  'draw',
  'attack',
  'recruit',
]);

// why: WP-382 / D-24183 — the ko-wound-reward reward is dispatched to an
// ALREADY-BUILT reward executor; only these three are seeded for the family's
// core vocabulary (draw / attack / recruit — the no-reward and Berserk members
// stay hollow, Honest-Partial). Mirrors the same constant in
// setup/heroAbility.setup.ts (two copies, per duplicate-first).
const KO_WOUND_REWARD_SEEDED_REWARDS: ReadonlySet<HeroKeyword> = new Set<HeroKeyword>([
  'draw',
  'attack',
  'recruit',
]);

// why: these keywords bypass the executeSingleEffect pre-check magnitude gate.
// 'rescue' defaults its magnitude to 1. 'reveal' is here because the collapsed
// reveal handler (D-24024) routes ALL 8 legacy reveal-* variants — including the
// no-magnitude ones (reveal-ko / reveal-odd-draw / reveal-cost-attack) and the
// M=0-valid ones (reveal / reveal-min) — so ALL reveal magnitude gating now lives
// in revealRulesForLegacyKeyword + the per-rule predicates, NEVER at this top-level
// gate. The 7 legacy reveal-* keywords no longer reach the pre-gate (they are
// translated to 'reveal' at parse time), so their former entries are dropped.
// (D-24024 / pre-flight PS-1)
const NO_MAGNITUDE_KEYWORDS = new Set<string>([
  'rescue', 'reveal',
  // why: D-24156 — "gain a Wound" is exactly one Wound; the tokens carry no
  // magnitude segment, so the magnitude pre-gate must not drop them.
  'gain-wound-self', 'gain-wound-each',
  // why: victory-villain-attack parks a pending pick; the attack amount is read
  // from the chosen villain's fightCost at resolve time, not from a static magnitude
  'victory-villain-attack',
  // why: draw-or-empowered parks a pending choice carrying empoweredClass (not a magnitude);
  // the draw or the empowered grant is applied at resolve time, not at play time (D-24069)
  'draw-or-empowered',
  // why: WP-675 / D-24490 — count-scaled-choose parks a pending choice carrying two options
  // (each with its own per-unit magnitude), not a top-level magnitude; the chosen grant is
  // applied at resolve time, so the pre-gate must not drop it.
  'count-scaled-choose',
  // why: WP-486 / D-24291 — defeat-with-bystander carries no magnitude (it defeats one
  // eligible target); the target set is computed from G at play time, so the magnitude
  // pre-gate must not drop it.
  'defeat-with-bystander',
  // why: WP-535 / D-24345 — copy-powers carries no magnitude (it copies exactly one Hero);
  // the eligible-Hero set is computed from inPlay at play time, so the magnitude pre-gate
  // must not drop it.
  'copy-powers',
  // why: WP-580 / D-24389 — recruit-as-attack carries no magnitude (it sets a turn-scoped
  // conversion flag, grants no resource total); the magnitude pre-gate must not drop it,
  // or the handler never fires and the flag is never set (the live-verify defect).
  'recruit-as-attack',
  // why: WP-592 / D-24401 — steal-abilities carries no magnitude (it discards each deck top
  // and copies each discarded card); the target set is computed from G at play time, so the
  // magnitude pre-gate must not drop it, or the handler never fires (the silent-no-op defect).
  'steal-abilities',
  // why: WP-564 / D-24373 — investigate carries no magnitude (the look count and criterion
  // ride dedicated descriptor fields, not the magnitude); the magnitude pre-gate must not
  // drop it, or the handler never fires.
  'investigate',
  // why: WP-658 / D-24469 — transform carries no magnitude (the second-form target is read
  // from G.transformTargets, and the pulled instance's printed attack/recruit come from
  // G.cardStats); the magnitude pre-gate must not drop it, or the swap never fires.
  'transform',
  // why: WP-659 / D-24470 — reveal-from-hand carries no magnitude (each matching player draws
  // exactly one card; the set of drawing players is computed from each hand at play time), so
  // the magnitude pre-gate must not drop it, or the reveal-draw never fires.
  'reveal-from-hand',
  // why: WP-667 / D-24480 — optional-ko-hand-discard carries NO magnitude (no reward — it parks
  // an optional KO of one hand/discard card); the eligible set is computed from G at play time,
  // so the magnitude pre-gate must not drop it, or the KO choice never parks.
  'optional-ko-hand-discard',
  // why: WP-678 / D-24494 — the two Undercover source-shape keywords carry NO magnitude ("send
  // a Hero/Officer Undercover" — always one card); the eligible source is read from G at play
  // time, so the magnitude pre-gate must not drop them, or the send never fires / the pick never parks.
  'undercover-hand-shield-hero',
  'undercover-officer-stack',
]);

// ---------------------------------------------------------------------------
// Magnitude validation
// ---------------------------------------------------------------------------

/**
 * Returns true if magnitude is a finite integer >= 0.
 *
 * @param magnitude - The magnitude value from a HeroEffectDescriptor.
 * @returns Whether the magnitude is valid for execution.
 */
function isValidMagnitude(magnitude: number | undefined): magnitude is number {
  if (magnitude === undefined) {
    return false;
  }
  if (!Number.isFinite(magnitude)) {
    return false;
  }
  if (magnitude < 0) {
    return false;
  }
  if (!Number.isInteger(magnitude)) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Draw helper (extracted from drawCards move logic)
// ---------------------------------------------------------------------------

/**
 * Draws cards from a player's deck into their hand.
 *
 * Replicates the draw algorithm from drawCards (coreMoves.impl.ts:52-76)
 * without the move validation and stage gating — those are the move's
 * responsibility, already handled by playCard before this function runs.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerID - Active player whose zones to modify.
 * @param count - Number of cards to draw.
 * @param shuffleContext - ShuffleProvider for deterministic reshuffle.
 * @returns How many cards were actually drawn (WP-417 — fewer than `count` when
 *   the deck and discard pile both ran dry; the caller logs the realized amount).
 */
function drawFromPlayerDeck(
  G: LegendaryGameState,
  playerID: string,
  count: number,
  shuffleContext: ShuffleProvider,
): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return 0;
  }

  let drawnCount = 0;
  for (let cardsDrawn = 0; cardsDrawn < count; cardsDrawn++) {
    // If deck is empty, attempt reshuffle from discard
    if (playerZones.deck.length === 0) {
      if (playerZones.discard.length === 0) {
        // No cards available anywhere — stop drawing
        return drawnCount;
      }

      // why: Reshuffling discard into deck is the standard Legendary rule
      // when the draw pile is exhausted. Uses ShuffleProvider for
      // deterministic shuffling — same pattern as drawCards move.
      const reshuffled = moveAllCards(playerZones.discard, []);
      playerZones.discard = reshuffled.from;
      playerZones.deck = shuffleDeck(reshuffled.to, shuffleContext);
    }

    const topCard = playerZones.deck[0];
    if (!topCard) {
      return drawnCount;
    }

    const result = moveCardFromZone(playerZones.deck, playerZones.hand, topCard);
    playerZones.deck = result.from;
    playerZones.hand = result.to;
    drawnCount++;
  }
  return drawnCount;
}

// ---------------------------------------------------------------------------
// executeHeroEffects — main entry point
// ---------------------------------------------------------------------------

/**
 * Applies one hook's effects and records its traces + hollow classification.
 *
 * why: WP-568 — extracted from executeHeroEffects' loop body so the DEFERRED
 * re-check fires a hook through exactly the same path the immediate play does. A
 * second dispatch copy would be free to drift, which is the class of defect the
 * hero-effect arc has already paid for. Callers must have confirmed the hook's
 * conditions pass; this function does not re-gate.
 *
 * @param G - The game state, mutated in place.
 * @param ctx - Move context (carries `random` for draws/reveals).
 * @param playerID - The acting player.
 * @param cardId - The played card that owns the hook.
 * @param hook - The hook whose effects to apply.
 * @param turn - Turn number stamped into each emitted EffectTrace.
 * @returns How many effects reached a handler.
 */
function runHookEffects(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  hook: HeroAbilityHook,
  turn: number,
): number {
  let firedEffectCount = 0;
  if (hook.effects !== undefined) {
    for (const effect of hook.effects) {
      const fired = executeSingleEffect(G, ctx, playerID, cardId, effect);
      if (fired) {
        firedEffectCount++;
      }
      // why: WP-488 / D-24294 — emit a trace per legacy hero effect dispatch from THIS
      // caller loop (it carries turn + hook.timing + cardId + the descriptor + the
      // dispatch boolean together). `fired` maps to `fired`/`no-handler`. Inert +
      // hash-excluded.
      recordEffectTrace(G, buildHeroLegacyEffectTrace(cardId, hook.timing, effect, fired, turn));
    }
  }

  // why: D-24031 / RISK-2 — primitiveEffects run AFTER the legacy `effects` loop, in
  // array order, inside the same conditions-passed gate. The legacy-then-primitive
  // order is locked for determinism: a line carrying both a legacy effect (e.g. an
  // [icon:recruit]) and the Berserk composition applies them in a fixed order. Each
  // top-level node gets its own fresh, never-persisted execution context.
  if (hook.primitiveEffects !== undefined) {
    for (const primitiveEffect of hook.primitiveEffects) {
      // why: WP-317 — pass the hook's source card so a composable gain-resource grant
      // (Empowered / Berserk) logs which card granted, mirroring the card-named
      // `did not activate` line above.
      const fired = interpretHeroPrimitiveEffect(G, ctx, playerID, primitiveEffect, cardId);
      if (fired) {
        firedEffectCount++;
      }
      // why: WP-488 / D-24294 — emit a trace per primitive-composition hero effect
      // dispatch (hero-primitive), so composed hero effects are not untraced. `fired`
      // maps to `fired`/`no-handler` by interpretHeroPrimitiveEffect's boolean.
      recordEffectTrace(G, buildHeroPrimitiveEffectTrace(cardId, hook.timing, primitiveEffect, fired, turn));
    }
  }

  // why: WP-257 / D-24033 — AFTER the hook ran, classify whether the whole hook was
  // hollow (per-hook rule, NOT state-diff): the detector asks "did any declared
  // mechanic on this line reach an executable handler?" — never whether G changed.
  // recordHollowEffect fires only when NO declared effect was reachable AND ≥1 was a
  // hollow reason (mixed-hook lines with ≥1 reachable effect never flag).
  detectHollowHeroHook(G, ctx, cardId, hook);
  return firedEffectCount;
}

/**
 * Executes hero ability effects for a played card.
 *
 * Called from playCard after the card is placed in inPlay and base stats
 * are applied. Iterates hooks in registration order, effects in descriptor
 * array order. Hooks with conditions are evaluated via evaluateAllConditions
 * (WP-023) — effects execute only when ALL conditions pass. Unsupported
 * keywords and invalid magnitudes are skipped.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param ctx - boardgame.io context passed as unknown to avoid importing
 *   boardgame.io. Narrowed to ShuffleProvider at the draw call site.
 * @param playerID - Active player ID (plain string, no framework import).
 * @param cardId - The CardExtId of the hero card that was just played.
 * @returns The count of hero effects that fired for this play (WP-409 / D-24221) —
 *   observability only, stashed on G.lastPlayEffectsFired by applyCardPlay.
 */
export function executeHeroEffects(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  cardId: CardExtId,
): number {
  // why: guard against G states that predate WP-021 (e.g., older test
  // mocks that don't include heroAbilityHooks). No hooks means no effects.
  if (!G.heroAbilityHooks || G.heroAbilityHooks.length === 0) {
    return 0;
  }

  const hooks = getHooksForCard(G.heroAbilityHooks, cardId);

  // why: WP-409 / D-24221 — tally the hero effects that FIRED for this play (each
  // executeSingleEffect / interpretHeroPrimitiveEffect that reached a handler).
  // Condition-gated hooks `continue` below and contribute nothing, so a
  // synergy-unlocked hook raises the count — the honest "how much did this play do"
  // signal for the future combo cue. Explicit counter, not .reduce() (effect
  // application). Returned to applyCardPlay; NOT read by any rule.
  let firedEffectCount = 0;

  // why: WP-488 / D-24294 — the turn stamped on every EffectTrace this play emits, read
  // once from the FnContext wrapper (readTurnNumber reads the nested bgio ctx.turn). Reused
  // for both hero sub-paths below rather than re-read per effect.
  const turn = readTurnNumber(ctx);

  for (const hook of hooks) {
    // why: cardId is threaded through to condition evaluation so heroClassMatch
    // and requiresTeam can exclude the triggering card from their inPlay scan
    // (self-exclusion rule — a card's own class/team does not satisfy its own
    // superpower).
    if (!evaluateAllConditions(G, playerID, hook.conditions, cardId)) {
      // why: WP-257 — a hook whose conditions failed reached a real (condition)
      // handler and intentionally did not execute — a `condition-failed` reachable
      // outcome, NOT hollow. No hollow-detection record is emitted (the WP-257
      // detector channel is untouched by this branch).
      // why: WP-295 / D-24082 — but DO surface a human-readable log line so a
      // class/team-synergy gate that suppressed the ability is observable in the
      // game log (G.messages -> UIState.log) instead of a silent skip — the
      // exact "the effect did nothing" confusion from the live diagnostic.
      // why: WP-434 — a class/synergy-gated ability that did not fire is `blocked`
      // (the effect was suppressed and nothing happened) per the LOG_OUTCOMES taxonomy.
      // why: WP-566 / D-24375 — name the condition that ACTUALLY failed. The
      // previous single string claimed "Hero class or team synergy" for every
      // failure; it was right for 2 of 4 constructed types and wrong for both
      // numeric-threshold ones, so it fired 8 times on Surge of Power (a recruit
      // gate with no class or team component) in one observed match while being
      // simultaneously correct for three class-gated cards.
      // why: findFailedCondition is a SIBLING of evaluateAllConditions and walks
      // the same short-circuit order, so the reported condition is the one that
      // stopped the ability. The guard covers the unreachable case where the
      // conditions pass on the second walk; the generic clause keeps the line
      // present, because D-24082 requires a gated ability to stay observable.
      const failedCondition = findFailedCondition(G, playerID, hook.conditions, cardId);
      const reason = failedCondition === undefined
        ? 'a play condition was not met'
        : describeFailedCondition(G, playerID, failedCondition);
      // why: WP-568 / D-24377 — a NUMERIC-THRESHOLD gate is a whole-turn window,
      // not a snapshot. Record it and say so; the per-move re-check fires it if the
      // threshold is reached later this turn. This is a THIRD log state and must not
      // reuse the "did not activate" wording above: not-yet-met is not the same as
      // failed, and a player who reads "did not activate" stops trying.
      // why: `neutral`, not `blocked`. LOG_OUTCOMES has no waiting member and adding
      // one is a canonical-array change out of scope here; `blocked` means the effect
      // was suppressed and nothing happened, which is wrong for an ability that may
      // still fire this turn.
      if (failedCondition !== undefined && isWaitAndSeeCondition(failedCondition)) {
        recordDeferredConditionalGrant(G, playerID, cardId, G.heroAbilityHooks.indexOf(hook));
        pushLog(G,
          `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, cardId)} ability is waiting — ${reason}. It will apply if you reach it this turn.`,
          'neutral',
          cardId,
        );
        continue;
      }

      pushLog(G,
        `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, cardId)} ability did not activate — ${reason}.`,
        'blocked',
        cardId, // why: WP-438 — the played card whose ability was gated (drives the diagnostic's conditionNotMet association).
      );
      continue;
    }

    // why: effects is optional on HeroAbilityHook. A hook may carry legacy `effects`,
    // composition `primitiveEffects`, or both — run whichever are present. (The former
    // early-`continue` on absent `effects` is gone because it would skip a Berserk hook,
    // which carries only primitiveEffects.)
    // why: WP-568 — same dispatch path the deferred re-check uses (runHookEffects).
    firedEffectCount += runHookEffects(G, ctx, playerID, cardId, hook, turn);
  }

  return firedEffectCount;
}

// ---------------------------------------------------------------------------
// Hollow-effect detection (WP-257 / D-24033 + D-24034)
// ---------------------------------------------------------------------------

/**
 * Reads the boardgame.io turn number for a HollowEffectRecord, defaulting to 0
 * when unavailable.
 *
 * executeHeroEffects is called with the move's FnContext WRAPPER — playCard's
 * `...context` rest (`{ ctx, random, events, ... }` minus G/playerID), NOT the
 * bare boardgame.io Ctx. The turn lives on the NESTED bgio ctx
 * (`moveContext.ctx.turn`); a former top-level `.turn` read was always undefined,
 * so every hero hollow record stamped turn 0 regardless of the real turn. (The
 * draw handler reads the wrapper's top-level `.random`, which is why the wrapper —
 * not the bare ctx — is what gets passed; the sibling villain executor receives
 * the bare Ctx and reads `ctx.turn` directly.) Test wrappers (makeMockCtx) and any
 * non-numeric value fall back to 0 — never a throw.
 *
 * @param moveContext - The boardgame.io FnContext wrapper, typed unknown to avoid
 *   a framework import.
 * @returns The turn number, or 0 when unavailable.
 */
function readTurnNumber(moveContext: unknown): number {
  if (moveContext !== null && typeof moveContext === 'object') {
    const innerCtx = (moveContext as { ctx?: unknown }).ctx;
    if (innerCtx !== null && typeof innerCtx === 'object') {
      const turn = (innerCtx as { turn?: unknown }).turn;
      if (typeof turn === 'number' && Number.isFinite(turn)) {
        return turn;
      }
    }
  }
  return 0;
}

/**
 * Classifies one declared hero effect by handler REACHABILITY (never by diffing
 * G). Returns the EffectExecutionReason the per-hook rule aggregates.
 *
 * Mirrors executeSingleEffect's gating, but answers "is a handler reachable for
 * this mechanic?" rather than mutating: a deferred-by-design mechanic is
 * `deferred`; any MVP keyword (a direct handler OR a reveal translation exists)
 * is reachable (`applied`); a recognized HeroKeyword with no handler is
 * `no-handler`; a token that is not even a recognized keyword is
 * `unsupported-keyword`. Magnitude validity is a within-handler concern, not a
 * missing handler, so it does not change reachability.
 *
 * @param effect - The declared hero effect descriptor.
 * @returns The reachability classification reason.
 */
function classifyHeroEffectReason(effect: HeroEffectDescriptor): EffectExecutionReason {
  const keyword: string = effect.type;
  // why: D-24033 — the explicit deferred allowlist is consulted BEFORE the
  // MVP/handler check. `wound`/`conditional` have no handler today (absent from
  // MVP_KEYWORDS), so without this they would classify `no-handler` → hollow even
  // though they are implemented-as-deferred by design.
  if (DEFERRED_BY_DESIGN_MECHANICS.has(keyword)) {
    return 'deferred';
  }
  // why: any MVP keyword has a reachable handler — either a direct
  // HERO_EFFECT_HANDLERS entry or a reveal translation (revealRulesForLegacyKeyword).
  // Reaching a handler is the not-hollow condition; the magnitude pre-gate inside
  // executeSingleEffect is internal handler logic, not a missing handler.
  if (MVP_KEYWORDS.has(keyword)) {
    return 'applied';
  }
  // why: a recognized HeroKeyword with neither a handler nor a deferred entry is
  // `no-handler` (recognized-but-unimplemented). A token that is not even a valid
  // HeroKeyword (only reachable via a malformed hook / test cast) is
  // `unsupported-keyword` — dispatch cannot execute it.
  if (isValidHeroKeyword(keyword)) {
    return 'no-handler';
  }
  return 'unsupported-keyword';
}

/**
 * Returns whether a string is a valid HeroKeyword.
 *
 * Local copy of the setup-parser guard (duplicate-first per §16.1; a third
 * appearance would justify extracting it). Used to split `no-handler`
 * (recognized keyword) from `unsupported-keyword` (unrecognized token).
 *
 * @param value - The candidate keyword string.
 * @returns Whether the value is a member of HERO_KEYWORDS.
 */
function isValidHeroKeyword(value: string): value is HeroKeyword {
  for (const keyword of HERO_KEYWORDS) {
    if (keyword === value) {
      return true;
    }
  }
  return false;
}

/**
 * Records a HollowEffectRecord for a hero hook iff the whole hook is hollow.
 *
 * Per-hook rule (D-24033): a hook flags hollow when (1) it declared ≥1 effect
 * (a legacy effect, a composition primitive, or an unresolved marker), AND
 * (2) NO declared effect reached a handler (no `applied`/`handler-noop`/
 * `condition-failed`/`deferred` outcome), AND (3) ≥1 declared effect resolved to
 * a hollow reason. A mixed hook with even one reachable effect never flags.
 *
 * Conditions are evaluated by the caller; this runs only for a conditions-passed
 * hook, so a failed-condition hook is already excluded (it `continue`d, a
 * `condition-failed` reachable outcome). primitiveEffects always reach the
 * interpreter (a recognized composition), so they count as reachable.
 *
 * @param G - Game state (mutated under Immer draft only via recordHollowEffect).
 * @param ctx - The boardgame.io context (read for the turn number only).
 * @param cardId - The played hero card's CardExtId.
 * @param hook - The hero ability hook that just ran.
 */
function detectHollowHeroHook(
  G: LegendaryGameState,
  ctx: unknown,
  cardId: CardExtId,
  hook: HeroAbilityHook,
): void {
  const effects = hook.effects ?? [];
  const primitiveEffects = hook.primitiveEffects ?? [];
  const unresolvedMarkers = hook.unresolvedMarkers ?? [];

  // why: "declared ≥1 effect" — a hook with no legacy effect, no composition, and
  // no unresolved marker declares nothing executable (e.g. a keyword-only or
  // empty hook), so it can never be hollow.
  if (effects.length === 0 && primitiveEffects.length === 0 && unresolvedMarkers.length === 0) {
    return;
  }

  // why: a composition primitive always reaches the interpreter (a recognized
  // open-mechanic handler), so its presence makes the hook reachable — it is
  // never hollow. Short-circuit before classifying the legacy effects.
  if (primitiveEffects.length > 0) {
    return;
  }

  let hasReachable = false;
  let firstHollow: { reason: EffectExecutionReason; mechanic: string } | null = null;

  for (const effect of effects) {
    const reason = classifyHeroEffectReason(effect);
    if (!isHollowReason(reason)) {
      hasReachable = true;
    } else if (firstHollow === null) {
      firstHollow = { reason, mechanic: effect.type };
    }
  }

  // why: each unresolved marker is a `parse-unrecognized` hollow reason (the
  // parser saw a marker token and resolved it to nothing). Flavor text leaves
  // unresolvedMarkers empty, so it never reaches here.
  for (const marker of unresolvedMarkers) {
    if (firstHollow === null) {
      firstHollow = { reason: 'parse-unrecognized', mechanic: marker };
    }
  }

  // why: per-hook rule — flag ONLY when no declared effect was reachable AND ≥1
  // was hollow. A mixed hook (≥1 reachable) is not hollow even if another effect
  // is unhandled.
  if (hasReachable || firstHollow === null) {
    return;
  }

  // why: the reason field is one of the three hollow reasons (isHollowReason
  // gated firstHollow). The cast narrows EffectExecutionReason to the
  // HollowEffectRecord.reason subset for the record contract.
  recordHollowEffect(G, {
    cardId,
    cardType: 'hero',
    timing: hook.timing,
    mechanic: firstHollow.mechanic,
    reason: firstHollow.reason as 'parse-unrecognized' | 'no-handler' | 'unsupported-keyword',
    turn: readTurnNumber(ctx),
  });
}

// ---------------------------------------------------------------------------
// Effect-trace emission (WP-488 / D-24294)
// ---------------------------------------------------------------------------

/**
 * Builds the per-dispatch `EffectTrace` for one legacy hero effect
 * (`hook.effects` → `executeSingleEffect`, WP-488 / D-24294).
 *
 * `fired` (executeSingleEffect's boolean) maps to `fired`; a false return (unsupported
 * keyword, failed magnitude pre-gate, or an undefined handler) maps to `no-handler`.
 * The `handler` label is the keyword token (the HERO_EFFECT_HANDLERS map key) when a
 * handler ran, `""` when none — a STRING label, never the function. `effect` is the
 * keyword token verbatim.
 *
 * @param cardId - The played hero card's CardExtId.
 * @param timing - The hook timing label.
 * @param effect - The dispatched hero effect descriptor.
 * @param fired - Whether executeSingleEffect reached a handler and ran.
 * @param turn - The turn number for the trace.
 * @returns The effect trace to record.
 */
function buildHeroLegacyEffectTrace(
  cardId: CardExtId,
  timing: string,
  effect: HeroEffectDescriptor,
  fired: boolean,
  turn: number,
): EffectTrace {
  // why: effect.type is typed HeroKeyword but read defensively so a malformed hook /
  // test cast cannot throw before the guarded writer runs.
  const keywordValue = (effect as { type?: unknown }).type;
  const effectToken = typeof keywordValue === 'string' ? keywordValue : '';
  const status = heroLegacyTraceStatus(effect, fired);
  return {
    cardId,
    scope: 'hero',
    timing,
    effect: effectToken,
    // why: label the mechanic for a reachable dispatch (fired OR reachable no-op);
    // only a genuine no-handler leaves the label empty.
    handler: status === 'no-handler' ? '' : effectToken,
    status,
    fireSite: 'hero-executor',
    params: buildHeroEffectTraceParams(effect),
    turn,
  };
}

/**
 * Decides the trace status for one legacy hero dispatch (WP-488 / D-24294).
 *
 * A `false` return from `executeSingleEffect` is NOT necessarily a missing handler:
 * a keyword whose handler is reachable — a direct `HERO_EFFECT_HANDLERS` entry, a
 * reveal translation, or an execute-at-another-site MVP keyword (`return-on-discard`
 * at the discard chokepoint, `wall-crawl` at recruit, `dodge`/`undercover` at their
 * moves, `size-changing` at class-read) — that simply did not mutate at THIS dispatch
 * (a magnitude pre-gate, or the real work fires at its own site) is a reachable
 * **no-op**, not a hollow. Only a recognized-but-unimplemented or an unsupported
 * keyword is a genuine `no-handler`.
 *
 * Reuses `classifyHeroEffectReason` — the SAME classifier the hollow detector uses —
 * so the trace status can no longer disagree with the hollow record (the disagreement
 * that made a real match's Unending Energy / Surge of Power read as phantom hollows).
 * Mirrors the villain executor's `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` treatment,
 * which likewise reads `no-op`, never `no-handler`.
 *
 * @param effect - The dispatched hero effect descriptor.
 * @param fired - Whether executeSingleEffect reached a handler and ran.
 * @returns The trace status.
 */
function heroLegacyTraceStatus(effect: HeroEffectDescriptor, fired: boolean): EffectTraceStatus {
  if (fired) {
    return 'fired';
  }
  const reason = classifyHeroEffectReason(effect);
  if (reason === 'applied' || reason === 'deferred') {
    return 'no-op';
  }
  return 'no-handler';
}

/**
 * Builds the per-dispatch `EffectTrace` for one primitive-composition hero effect
 * (`hook.primitiveEffects` → `interpretHeroPrimitiveEffect`, WP-488 / D-24294).
 *
 * `fired` (the interpreter's boolean — false only for an unknown top-level node) maps
 * to `fired`/`no-handler`. The `handler` label and `effect` token are the composition's
 * top-level node `type` (the EFFECT_NODE_HANDLERS map key, e.g. `sequence`), read
 * defensively. `params` stays `{}` — a composition is a nested AST with no flat scalar
 * descriptor fields to copy, and spreading the tree would leak non-scalar nodes into G.
 *
 * @param cardId - The played hero card's CardExtId.
 * @param timing - The hook timing label.
 * @param node - The top-level composition effect node.
 * @param fired - Whether the interpreter dispatched to a real handler.
 * @param turn - The turn number for the trace.
 * @returns The effect trace to record.
 */
function buildHeroPrimitiveEffectTrace(
  cardId: CardExtId,
  timing: string,
  node: EffectNode,
  fired: boolean,
  turn: number,
): EffectTrace {
  const nodeType = (node as { type?: unknown }).type;
  const effectToken = typeof nodeType === 'string' ? nodeType : '';
  return {
    cardId,
    scope: 'hero',
    timing,
    effect: effectToken,
    handler: fired ? effectToken : '',
    status: fired ? 'fired' : 'no-handler',
    fireSite: 'hero-primitive',
    params: {},
    turn,
  };
}

/**
 * Copies a hero descriptor's own SCALAR parameter fields into a trace `params`
 * snapshot, omitting `undefined` keys (WP-488 / D-24294).
 *
 * Explicit field-by-field copy — NEVER a spread-and-cast (which would leak the
 * `type` keyword and the non-scalar `empoweredClasses` / `revealRules` arrays and
 * break `exactOptionalPropertyTypes`). Every copied value is `string | number |
 * boolean`; the `type` token is carried as the trace's `effect`, not here.
 *
 * @param effect - The dispatched hero effect descriptor.
 * @returns A shallow scalar snapshot of the descriptor's parameter fields.
 */
function buildHeroEffectTraceParams(
  effect: HeroEffectDescriptor,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (effect.magnitude !== undefined) {
    params.magnitude = effect.magnitude;
  }
  if (effect.countSource !== undefined) {
    params.countSource = effect.countSource;
  }
  if (effect.rewardType !== undefined) {
    params.rewardType = effect.rewardType;
  }
  if (effect.empoweredClass !== undefined) {
    params.empoweredClass = effect.empoweredClass;
  }
  if (effect.revealCount !== undefined) {
    params.revealCount = effect.revealCount;
  }
  if (effect.reorderRemainder !== undefined) {
    params.reorderRemainder = effect.reorderRemainder;
  }
  // why: empoweredClasses (string[]) and revealRules (RevealRule[]) are non-scalar —
  // deliberately omitted; params carries only string | number | boolean per D-24294.
  return params;
}

// ---------------------------------------------------------------------------
// Effect handlers + ImplementationMap (WP-251 / D-24022)
// ---------------------------------------------------------------------------

/**
 * A single hero effect handler — the per-keyword contract that was formerly one
 * `switch` arm. Mutates G for one effect; returns void. `ctx` is narrowed to
 * ShuffleProvider only where deck reshuffle is needed (the `draw` handler).
 */
type HeroEffectHandler = (
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
) => void;

function heroEffectDraw(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  // why: ctx is narrowed to ShuffleProvider here because deck reshuffle
  // needs ctx.random.Shuffle. boardgame.io ctx satisfies ShuffleProvider
  // structurally — this is the established pattern from WP-005B/008B.
  const requestedCount = effect.magnitude as number;
  const drawnCount = drawFromPlayerDeck(G, playerID, requestedCount, ctx as ShuffleProvider);
  // why: WP-665 / D-24476 — count the REALIZED effect-draw toward the current
  // player's per-turn draw total, which the `cardsDrawnThisTurnAtLeast` gate reads
  // ("if you drew two cards this turn", Gamma-Draining Nanites). heroEffectDraw is
  // the `draw:N` keyword path and always runs for the current player, so this is the
  // single count site; the start-of-turn hand refill (drawCardsIntoHand) is a
  // different helper and is deliberately NOT counted (else the gate is trivially met).
  G.turnEconomy.cardsDrawn += drawnCount;
  // why: WP-417 / D-24237 — the draw handler was silent, so "Draw a card." on the
  // play line was the ONLY evidence the ability existed and a short draw (deck and
  // discard both empty) was indistinguishable from a full one. Name the realized
  // amount, and say so explicitly when it fell short of the printed amount.
  if (drawnCount < requestedCount) {
    // why: WP-434 — a short draw (fewer than requested; deck + discard empty) is
    // `partial` — the ability fired but the source ran dry mid-way.
    pushLog(G,
      `Player ${playerID} drew ${drawnCount} of ${requestedCount} card(s) from ${formatCardRef(G.cardDisplayData, cardId)} — their deck and discard pile were empty.`,
      'partial',
      cardId, // why: WP-438.
    );
    return;
  }
  // why: WP-434 — a full realized draw is `applied` (green).
  pushLog(G,
    `Player ${playerID} drew ${drawnCount} card(s) from ${formatCardRef(G.cardDisplayData, cardId)}.`,
    'applied',
    cardId, // why: WP-438.
  );
}

function heroEffectAttack(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const attackGrant = effect.magnitude as number;
  G.turnEconomy = addResources(G.turnEconomy, attackGrant, 0);
  // why: WP-417 / D-24237 — an ability-granted attack was silent; only the
  // count-scaled variant (attack-per-count) logged. Both now report the grant.
  // why: WP-434 — an ability-granted attack economy is `applied` (green).
  pushLog(G,
    `Player ${playerID} gained +${attackGrant} attack from ${formatCardRef(G.cardDisplayData, cardId)}.`,
    'applied',
    cardId, // why: WP-438.
  );
}

function heroEffectRecruit(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const recruitGrant = effect.magnitude as number;
  G.turnEconomy = addResources(G.turnEconomy, 0, recruitGrant);
  // why: WP-417 / D-24237 — mirrors the attack grant above; an ability-granted
  // recruit was previously invisible in the game log.
  // why: WP-434 — an ability-granted recruit economy is `applied` (green).
  pushLog(G,
    `Player ${playerID} gained +${recruitGrant} recruit from ${formatCardRef(G.cardDisplayData, cardId)}.`,
    'applied',
    cardId, // why: WP-438.
  );
}

function heroEffectKo(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  // why: MVP KO targets the played card itself. This models "KO this
  // card" text found on some heroes. No player choice — target selection
  // is deferred to future WPs. The card must be removed from inPlay
  // before being added to the KO pile.
  const playerZones = G.playerZones[playerID];
  if (playerZones) {
    const moveResult = moveCardFromZone(playerZones.inPlay, [], cardId);
    if (moveResult.found) {
      playerZones.inPlay = moveResult.from;
      G.ko = koCard(G.ko, cardId);
      // why: WP-417 / D-24237 — a self-KO removes the card the player just played
      // from the board; a silent removal reads as the card vanishing. Name it.
      // why: WP-434 — a self-KO ability that removed the played card is `applied`.
      pushLog(G,
        `Player ${playerID} KO'd ${formatCardRef(G.cardDisplayData, cardId)} via its own ability.`,
        'applied',
        cardId, // why: WP-438.
      );
    }
  }
}

function heroEffectRescue(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  _cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const rescueMagnitude = effect.magnitude ?? 1;
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }
  if (G.piles.bystanders.length === 0) {
    // why: D-24017 — an empty Bystander supply is a legitimate no-op, but a
    // silent skip reads as "the hero card did nothing" (player confusion,
    // per the live diagnostic). Log it so the reason is observable in the
    // game log (UIState.log), mirroring how fight rescues are logged.
    pushLog(G, 
      `Player ${playerID} could not rescue a Bystander via a hero ability — the Bystander supply is empty.`,
    );
    return;
  }
  const rescueCount = Math.min(rescueMagnitude, G.piles.bystanders.length);
  let rescuedCount = 0;
  for (let rescued = 0; rescued < rescueCount; rescued++) {
    // why: top-of-pile convention — pile[0] is the first available bystander (D-21501)
    const topBystander = G.piles.bystanders[0];
    if (!topBystander) {
      break;
    }
    const moveResult = moveCardFromZone(G.piles.bystanders, playerZones.victory, topBystander);
    G.piles.bystanders = moveResult.from;
    playerZones.victory = moveResult.to;
    rescuedCount++;
  }
  // why: D-24017 — surface the hero-ability rescue in the game log the same
  // way fight rescues are (fightVillain/fightMastermind), so a successful
  // rescue is observable to the player rather than a silent zone move.
  pushLog(G,
    `Player ${playerID} rescued ${rescuedCount} bystander(s) via a hero ability.`,
  );
}

/**
 * Hero handler for the `gain-wound-self` / `gain-wound-each` keywords (D-24156).
 *
 * The active player (`gain-wound-self`) or every player (`gain-wound-each`)
 * gains one Wound from the shared supply into their discard pile. Reuses the
 * WP-017 `gainWound` helper and mirrors the WP-316 villain per-target loop
 * (`villainEffectGainWound`): a missing zone or empty supply is a legitimate
 * no-op per target, and the active player's `woundsDrawn` UI economy bumps when
 * they gain. No targeting, no magnitude, no randomness — the Wound is drawn
 * top-of-pile deterministically.
 */
function heroEffectGainWound(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  // why: D-24156 — `each` iterates a sorted key order (matching scoring.logic.ts)
  // so the wound distribution replays identically; `self` targets the active
  // player only.
  const targetPlayerIds =
    effect.type === 'gain-wound-each'
      ? Object.keys(G.playerZones).sort()
      : [playerID];

  let anyWoundGained = false;
  for (const targetPlayerId of targetPlayerIds) {
    const targetZones = G.playerZones[targetPlayerId];
    if (!targetZones) {
      continue;
    }
    if (G.piles.wounds.length === 0) {
      // why: D-24017 — an empty Wound supply is a legitimate no-op, but a silent
      // skip reads as "the card did nothing"; log it so the reason is observable
      // (mirrors the heroEffectRescue empty-supply logging).
      pushLog(G,
        `Player ${targetPlayerId} could not gain a Wound — the Wound supply is empty.`,
      );
      continue;
    }
    const result = gainWound(G.piles.wounds, targetZones.discard);
    G.piles.wounds = result.woundsPile;
    targetZones.discard = result.playerDiscard;
    anyWoundGained = true;
    if (targetPlayerId === playerID) {
      // why: woundsDrawn projects the active player's wounds only (UI economy),
      // matching the villain gain-wound path (villainEffectGainWound).
      G.turnEconomy.woundsDrawn += 1;
    }
  }

  // why: D-24017 — surface the wound gain in the game log so a printed penalty
  // that actually landed is observable, not a silent zone move.
  if (anyWoundGained) {
    pushLog(G,
      effect.type === 'gain-wound-each'
        ? `Each player gained a Wound (${formatCardRef(G.cardDisplayData, cardId)}).`
        : `Player ${playerID} gained a Wound (${formatCardRef(G.cardDisplayData, cardId)}).`,
    );
  }
}

// ---------------------------------------------------------------------------
// Parameterized reveal handler + per-action helpers (WP-253 / D-24024)
//
// The 8 legacy reveal-* handlers collapsed into ONE 'reveal' handler that peeks
// the deck top (× revealCount, =1 today) and evaluates an ordered RevealRule
// branch-list. The per-action helpers hold the verbatim zone-mutation bodies the
// legacy handlers used; revealRulesForLegacyKeyword (rules/revealRule.ts) maps the
// 8 card markers onto these rules, so behavior is byte-identical.
// ---------------------------------------------------------------------------

function heroEffectReveal(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  _cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }
  const rules = effect.revealRules ?? [];
  // why: reveal-attack-choose's reject-second guard (D-22001) aborts the WHOLE
  // effect — no peek, no attack, no second park — when a choice is already pending.
  // Only the choose action parks a choice, so the guard is hoisted above the peek
  // loop; other reveal rules never read pendingHeroChoice. (D-24024)
  if (revealRulesContainAnyAction(rules, ['choose-discard-or-return']) && G.pendingHeroChoice !== undefined) {
    return;
  }
  // why: reveal-cost-attack / reveal-attack-choose / reveal-ko-attack all guarded
  // G.turnEconomy BEFORE any mutation (including reveal-ko-attack's KO). Reproduce
  // that: when the rules grant attack and turnEconomy is undefined the whole effect
  // no-ops, never partially KOing first. (D-24024 / D-22003 AC-9 / D-22301)
  if (revealRulesContainAnyAction(rules, ['attack-by-cost', 'attack-fixed']) && !G.turnEconomy) {
    return;
  }
  const revealCount = effect.revealCount ?? 1;
  // why (D-24024 → D-24027): this is the multi-peek WP-253 deferred. peekOffset indexes
  // the live deck; peekIndex counts iterations. DUAL BOUND — iterate at most revealCount
  // times (peekIndex) AND stop at the deck end (peekOffset >= deck.length); an offset-only
  // loop would reveal the WHOLE deck. count=1 is BYTE-IDENTICAL to the WP-253 deck[0] peek:
  // a single iteration runs at offset 0, and the skip-and-advance + the deck-end stop both
  // reduce to the WP-253 no-op `return`.
  let peekOffset = 0;
  for (let peekIndex = 0; peekIndex < revealCount; peekIndex++) {
    // why: re-read the live deck each iteration (do NOT snapshot) — a prior draw/ko shifts
    // the deck. When the offset overruns the deck end, a reveal still owes a card, so
    // reshuffle the discard into the deck and retry — the standard Legendary rule that a
    // reveal (like a draw) reshuffles an exhausted deck mid-effect (D-24285, superseding
    // D-21502's no-op FOR THIS HANDLER; the D-24200 reveal-eight strike keeps its
    // deliberate no-top-up). ctx narrows to ShuffleProvider exactly as the draw handler
    // does — reshuffle needs ctx.random.Shuffle.
    if (peekOffset >= playerZones.deck.length) {
      reshuffleDiscardIntoDeck(playerZones, ctx as ShuffleProvider);
      // why: still short after the reshuffle means the discard was empty too — nothing
      // remains anywhere, so stop the loop. `break` (not `return`) so the post-loop
      // reorder park (WP-479 / D-24286) still runs on this deck-exhausted exit — a
      // fully-expensive ≥2 remainder with an empty discard must still offer the reorder.
      if (peekOffset >= playerZones.deck.length) {
        break;
      }
    }
    const topCardId = playerZones.deck[peekOffset];
    // why: a peek with no card id OR no cardStats entry (a S.H.I.E.L.D. starter has no
    // G.cardStats entry, D-21502) SKIPS-AND-ADVANCES — leave the card on the deck and peek
    // the next — it MUST NOT `return`/abort the rest of the reveal (copilot #22). At count=1
    // this is observably the same no-op as the WP-253 `return`; at count>1 it stops one
    // starter in the top N from silently killing the reveal of the cards beneath it (the
    // exact "the card did nothing" failure D-24017 exists to stamp out). A cost-0 starter in
    // the window is therefore revealed-but-not-drawn (no stats to evaluate its cost) — the
    // accepted MVP limitation; aborting would be far worse.
    if (!topCardId) {
      peekOffset++;
      continue;
    }
    const cardStats = G.cardStats[topCardId];
    if (cardStats === undefined) {
      peekOffset++;
      continue;
    }
    const deckLengthBeforeRules = playerZones.deck.length;
    applyRevealRules(G, playerID, playerZones, topCardId, cardStats.cost, rules);
    // why: advance the offset ONLY when the deck length is unchanged (the card stayed on the
    // deck). A draw/ko shrank the deck and slid the next card into the same index, so the
    // offset must NOT advance — this is what keeps the WP-253 count=2 test (each iteration
    // re-reads deck[0] after a draw) byte-identical.
    if (playerZones.deck.length === deckLengthBeforeRules) {
      peekOffset++;
    }
  }

  // why: WP-479 / D-24286 — "Put the rest back in any order". The revealed-but-not-drawn
  // cards are the top `peekOffset` of the deck (drawn/KO'd cards were removed; non-drawn
  // cards, incl. skipped no-stats starters, stayed on top in order and each bumped
  // peekOffset). When the reveal is marked `reorderRemainder` and ≥2 remained, park an
  // interactive reorder choice over them — the current player picks their top-of-deck
  // order via resolveReorderChoice; the block-all guard freezes the deck top until then.
  // A remainder of 0 or 1 has no order to choose, so it auto-skips (no park). peekOffset
  // is clamped to deck.length defensively (it cannot structurally exceed it — the loop
  // guard stops at the deck end).
  if (effect.reorderRemainder === true) {
    const remainderCount = Math.min(peekOffset, playerZones.deck.length);
    if (remainderCount >= 2) {
      const cardIds = playerZones.deck.slice(0, remainderCount);
      if (!G.pendingReorderChoices) {
        G.pendingReorderChoices = [];
      }
      G.pendingReorderChoices.push({
        choiceType: 'reorder-deck-top',
        playerID,
        cardIds,
      });
    }
  }
}

/**
 * Evaluates a reveal branch-list against one peeked card's cost. Applies the first
 * matching rule's actions and stops, unless the matched rule sets `continue: true`,
 * in which case it keeps evaluating later rules.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerID - Active player ID.
 * @param playerZones - The active player's zones (resolved once by the handler).
 * @param topCardId - The peeked deck-top card's CardExtId.
 * @param cost - The peeked card's cost (the predicate input).
 * @param rules - The ordered RevealRule branch-list.
 */
function applyRevealRules(
  G: LegendaryGameState,
  playerID: string,
  playerZones: PlayerZones,
  topCardId: CardExtId,
  cost: number,
  rules: RevealRule[],
): void {
  // why: WP-325 — accumulate the reveal outcome so ONE line summarizes the peeked
  // card (a `continue: true` chain matches more than one rule). The first matched
  // predicate + every matched rule's actions compose the line after the loop.
  let matchedPredicateText: string | undefined;
  const matchedActionPhrases: string[] = [];
  // why: WP-417 / D-24237 — WP-B.2's realized-result item. `describeRevealActions`
  // states what the branch CLAIMED; these are the action kinds whose helper guard
  // fired and mutated nothing, so the line can say what did not actually happen.
  const unappliedActionKinds: RevealActionKind[] = [];
  for (const rule of rules) {
    if (!revealPredicateMatches(G, rule.predicate, cost)) {
      continue;
    }
    if (matchedPredicateText === undefined) {
      matchedPredicateText = describeRevealPredicate(rule.predicate);
    }
    matchedActionPhrases.push(describeRevealActions(rule.actions));
    for (const unappliedKind of applyRevealRuleActions(G, playerID, playerZones, topCardId, cost, rule.actions)) {
      unappliedActionKinds.push(unappliedKind);
    }
    // why: first-match-wins unless the rule opts into `continue` — the
    // reveal-attack-choose attack rule sets continue so the always→choose rule still
    // parks the choice after the attack. (D-24024) `break` (not `return`) so the
    // reveal-outcome line below still emits; the reveal behavior is unchanged — the
    // same rules are applied in the same order with the same stop condition.
    if (rule.continue !== true) {
      break;
    }
  }
  // why: WP-325 — one reveal-outcome line per peeked card, naming the revealed card +
  // cost + predicate result + action(s), so a conditional "What If…?" effect is no
  // longer silent (the last silent effect path). G.messages is excluded from
  // finalStateHash (D-24081), so this is replay-safe; the Array.isArray guard tolerates
  // a narrow reveal-test fixture G that omits the messages array.
  if (Array.isArray(G.messages)) {
    const outcome =
      matchedPredicateText === undefined
        ? { matched: false }
        : {
            matched: true,
            predicateText: matchedPredicateText,
            actionsText: matchedActionPhrases.join(', '),
            unappliedActionsText: describeUnappliedRevealActions(unappliedActionKinds),
          };
    // why: WP-434 — project the reveal result onto a LOG_OUTCOMES colour: no branch
    // matched → `blocked` (the What-If test failed); matched but some action was
    // guard-blocked → `partial`; matched and fully applied → `applied`.
    let revealLogOutcome: LogOutcome;
    if (matchedPredicateText === undefined) {
      revealLogOutcome = 'blocked';
    } else if (unappliedActionKinds.length > 0) {
      revealLogOutcome = 'partial';
    } else {
      revealLogOutcome = 'applied';
    }
    pushLog(
      G,
      formatRevealOutcomeLine(G.cardDisplayData, playerID, topCardId, cost, outcome),
      revealLogOutcome,
      topCardId, // why: WP-438 — the REVEALED deck-top card (NOT the played What-If card), so the diagnostic does not attribute a reveal to the played card (preserves B.3c non-attribution structurally).
    );
  }
}

/**
 * Returns whether the peeked card's cost satisfies a reveal predicate.
 *
 * @param G - Game state (for logging an unknown/malformed predicate; never throws).
 * @param predicate - The RevealPredicate to test.
 * @param cost - The peeked card's cost.
 * @returns Whether the predicate matches.
 */
function revealPredicateMatches(
  G: LegendaryGameState,
  predicate: RevealPredicate,
  cost: number,
): boolean {
  if (predicate.kind === 'always') {
    return true;
  }
  if (predicate.kind === 'cost-zero') {
    return cost === 0;
  }
  if (predicate.kind === 'cost-odd') {
    return cost % 2 !== 0;
  }
  if (predicate.kind === 'cost-lte') {
    // why: a threshold of 0 is legitimate (reveal M=0 → cost-lte 0), so test for
    // undefined explicitly rather than a falsy `?? default`.
    if (predicate.threshold === undefined) {
      pushLog(G, 'A reveal rule used a cost-lte predicate with no threshold and was skipped. Check the reveal rule markup.');
      return false;
    }
    return cost <= predicate.threshold;
  }
  if (predicate.kind === 'cost-gte') {
    if (predicate.threshold === undefined) {
      pushLog(G, 'A reveal rule used a cost-gte predicate with no threshold and was skipped. Check the reveal rule markup.');
      return false;
    }
    return cost >= predicate.threshold;
  }
  // why: unknown predicate kind → warn to G.messages and do not match, never throw
  // (the rule-execution-pipeline unknown-effect posture). (D-24024)
  pushLog(G, `A reveal rule used an unknown predicate kind "${String(predicate.kind)}" and was skipped. Check the reveal rule markup.`);
  return false;
}

/**
 * Applies a matched rule's actions in order. Stops the rule early when a
 * deck-mutating action (draw / ko) reports it did not apply, so a follow-on action
 * (reveal-ko-attack's fixed attack) fires only after the KO succeeded.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerID - Active player ID.
 * @param playerZones - The active player's zones.
 * @param topCardId - The peeked deck-top card's CardExtId.
 * @param cost - The peeked card's cost (for attack-by-cost).
 * @param actions - The matched rule's actions, applied in order.
 * @returns The action kinds that did NOT realize their mutation (WP-417 /
 *   D-24237) — read only to compose the reveal-outcome log line. Behavior
 *   (which actions run, and the deck-mutating abort) is unchanged.
 */
function applyRevealRuleActions(
  G: LegendaryGameState,
  playerID: string,
  playerZones: PlayerZones,
  topCardId: CardExtId,
  cost: number,
  actions: RevealAction[],
): RevealActionKind[] {
  const unappliedActionKinds: RevealActionKind[] = [];
  for (const action of actions) {
    const applied = applyRevealAction(G, playerID, playerZones, topCardId, cost, action);
    if (!applied) {
      unappliedActionKinds.push(action.kind);
    }
    // why: only a deck-mutating action (ko / draw) gates the rest of the rule —
    // reveal-ko-attack's [ko, attack-fixed] grants the fixed attack ONLY after the
    // KO move returned found (no partial mutation). A non-mutating action that
    // no-ops (e.g. attack with no turnEconomy) does NOT abort the rule. (D-24024 / D-22301)
    if (!applied && isDeckMutatingRevealAction(action.kind)) {
      return unappliedActionKinds;
    }
  }
  return unappliedActionKinds;
}

/**
 * Dispatches one reveal action to its helper. Returns whether the action applied
 * its intended mutation (true for non-deck actions that succeeded; false when a
 * helper's guard fired). Unknown action kinds warn and return true (not a
 * deck-mutation failure, so they do not break the rule).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerID - Active player ID.
 * @param playerZones - The active player's zones.
 * @param topCardId - The peeked deck-top card's CardExtId.
 * @param cost - The peeked card's cost (for attack-by-cost).
 * @param action - The RevealAction to apply.
 * @returns Whether the action applied.
 */
function applyRevealAction(
  G: LegendaryGameState,
  playerID: string,
  playerZones: PlayerZones,
  topCardId: CardExtId,
  cost: number,
  action: RevealAction,
): boolean {
  if (action.kind === 'draw') {
    return applyRevealDraw(playerZones, topCardId);
  }
  if (action.kind === 'ko') {
    return applyRevealKo(G, playerZones, topCardId);
  }
  if (action.kind === 'attack-by-cost') {
    return applyRevealAttackByCost(G, cost);
  }
  if (action.kind === 'attack-fixed') {
    return applyRevealAttackFixed(G, action.amount);
  }
  if (action.kind === 'choose-discard-or-return') {
    return applyRevealChoose(G, playerID, topCardId);
  }
  // why: unknown action kind → warn to G.messages and skip, never throw. Treated as
  // a no-op that is NOT a deck-mutation failure, so it does not break the rule. (D-24024)
  pushLog(G, `A reveal rule used an unknown action kind "${String(action.kind)}" and was skipped. Check the reveal rule markup.`);
  return true;
}

/**
 * Returns whether a reveal action mutates the deck (draw / ko). Only these gate the
 * rest of a rule's action list when they fail to apply.
 *
 * @param kind - The reveal action kind.
 * @returns Whether the action is deck-mutating.
 */
function isDeckMutatingRevealAction(kind: RevealActionKind): boolean {
  return kind === 'draw' || kind === 'ko';
}

/**
 * Returns whether any rule's action list contains one of the given action kinds.
 * Used to hoist the reject-second (choose) and turnEconomy (attack) guards above
 * the peek loop, reproducing the legacy handlers' whole-effect guard ordering.
 *
 * @param rules - The reveal branch-list.
 * @param kinds - The action kinds to look for.
 * @returns Whether any action in any rule matches one of the kinds.
 */
function revealRulesContainAnyAction(rules: RevealRule[], kinds: RevealActionKind[]): boolean {
  for (const rule of rules) {
    for (const action of rule.actions) {
      for (const kind of kinds) {
        if (action.kind === kind) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Draw action — moves the peeked deck-top card into the player's hand. Verbatim
 * from the legacy reveal / reveal-min / reveal-odd-draw draw bodies.
 *
 * @param playerZones - The active player's zones.
 * @param topCardId - The peeked deck-top card's CardExtId.
 * @returns Whether the card was found and moved (false leaves zones unchanged).
 */
function applyRevealDraw(playerZones: PlayerZones, topCardId: CardExtId): boolean {
  const moveResult = moveCardFromZone(playerZones.deck, playerZones.hand, topCardId);
  if (!moveResult.found) {
    return false;
  }
  playerZones.deck = moveResult.from;
  playerZones.hand = moveResult.to;
  return true;
}

/**
 * KO action — removes the peeked deck-top card from the deck and adds it to the KO
 * pile. Verbatim from the legacy reveal-ko / reveal-ko-or-draw / reveal-ko-attack
 * KO bodies (card removed from deck before being added to KO — D-21801 zone integrity).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerZones - The active player's zones.
 * @param topCardId - The peeked deck-top card's CardExtId.
 * @returns Whether the card was found and KO'd (false leaves zones unchanged).
 */
function applyRevealKo(G: LegendaryGameState, playerZones: PlayerZones, topCardId: CardExtId): boolean {
  const moveResult = moveCardFromZone(playerZones.deck, [], topCardId);
  if (!moveResult.found) {
    return false;
  }
  playerZones.deck = moveResult.from;
  G.ko = koCard(G.ko, topCardId);
  return true;
}

/**
 * Attack-by-cost action — grants attack equal to the peeked card's cost; no zone
 * mutation (the card stays on the deck). Verbatim from reveal-cost-attack /
 * reveal-attack-choose; keeps the turnEconomy guard (D-21901 / D-22003).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param cost - The peeked card's cost.
 * @returns Whether the grant applied (false when turnEconomy is undefined).
 */
function applyRevealAttackByCost(G: LegendaryGameState, cost: number): boolean {
  if (!G.turnEconomy) {
    return false;
  }
  G.turnEconomy.attack += cost;
  return true;
}

/**
 * Attack-fixed action — grants a fixed attack amount (the reveal-ko-attack
 * magnitude). Verbatim from reveal-ko-attack's `G.turnEconomy.attack += magnitude`.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param amount - The fixed attack grant.
 * @returns Whether the grant applied (false when turnEconomy is undefined or amount
 *   is missing).
 */
function applyRevealAttackFixed(G: LegendaryGameState, amount: number | undefined): boolean {
  if (!G.turnEconomy) {
    return false;
  }
  if (amount === undefined) {
    return false;
  }
  G.turnEconomy.attack += amount;
  return true;
}

/**
 * Choose-discard-or-return action — parks the existing PendingHeroChoice the player
 * resolves via resolveHeroChoice. Verbatim from reveal-attack-choose: the
 * turnEconomy guard fires BEFORE the park (an undefined turnEconomy means NO park);
 * the reject-second (a choice already pending) is hoisted to the handler top, so a
 * pending choice aborts the whole effect. (D-22001 / D-22003)
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerID - Active player ID.
 * @param topCardId - The peeked deck-top card's CardExtId.
 * @returns Whether the choice was parked (false when turnEconomy is undefined).
 */
function applyRevealChoose(G: LegendaryGameState, playerID: string, topCardId: CardExtId): boolean {
  if (!G.turnEconomy) {
    return false;
  }
  const pendingChoice: PendingHeroChoice = {
    choiceType: 'discard-or-return',
    cardId: topCardId,
    playerID,
  };
  G.pendingHeroChoice = pendingChoice;
  return true;
}

function heroEffectAttackPerCount(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  // why: D-24016 — magnitude is the per-unit rate; resolveCountSource resolves
  // the count it scales by, so the grant is magnitude × count. The resolver is
  // pure/total (unknown source → 0), so the grant is deterministic at play time.
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  if (!G.turnEconomy) { return; }
  // why: a count-scaled attack effect with no count source is a skipped no-op
  // (mirrors the magnitude gate) — there is nothing to scale by.
  if (effect.countSource === undefined) { return; }
  // why: WP-673 / D-24488 — pass the triggering card so an "each OTHER card"
  // source (worthy-cards-played-this-turn) can exclude this card from its own
  // count. Sources reading a zone this card is never in (victory-bystanders)
  // ignore it.
  const count = resolveCountSource(G, playerID, effect.countSource, cardId);
  const grant = (effect.magnitude as number) * count;
  G.turnEconomy = addResources(G.turnEconomy, grant, 0);
  // why: record the source, count, and grant so the count-scaled attack is
  // observable in replay inspection (no implicit side effects).
  pushLog(G, `Count-scaled attack: +${grant} (${effect.magnitude as number} per ${effect.countSource}, count ${count}).`);
}

/**
 * Count-scaled recruit (WP-674 / D-24489). The recruit sibling of
 * heroEffectAttackPerCount: "+N recruit for each other card you played this turn
 * that costs 4 or more" (noir's Follow Big Leads). The grant is
 * `magnitude × resolveCountSource(...)`, added to G.turnEconomy.recruit instead
 * of attack. Same pure/total contract as the attack variant.
 *
 * @param G - Game state (mutated: recruit added to the turn economy).
 * @param _ctx - Unused (framework parity).
 * @param playerID - The active player.
 * @param cardId - The triggering card, passed to resolveCountSource so an "each
 *   OTHER card" source can exclude this card from its own count.
 * @param effect - The recruit-per-count effect descriptor (magnitude + countSource).
 */
function heroEffectRecruitPerCount(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  // why: WP-674 / D-24489 — magnitude is the per-unit rate; resolveCountSource
  // resolves the count it scales by, so the grant is magnitude × count. Mirrors
  // heroEffectAttackPerCount exactly, granting recruit rather than attack.
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  if (!G.turnEconomy) { return; }
  // why: a count-scaled recruit effect with no count source is a skipped no-op
  // (mirrors the magnitude gate) — there is nothing to scale by.
  if (effect.countSource === undefined) { return; }
  // why: WP-674 / D-24489 — pass the triggering card so an "each OTHER card"
  // source (cost-four-plus-played-this-turn) can exclude this card from its own count.
  const count = resolveCountSource(G, playerID, effect.countSource, cardId);
  const grant = (effect.magnitude as number) * count;
  G.turnEconomy = addResources(G.turnEconomy, 0, grant);
  // why: record the source, count, and grant so the count-scaled recruit is
  // observable in replay inspection (no implicit side effects).
  pushLog(G, `Count-scaled recruit: +${grant} (${effect.magnitude as number} per ${effect.countSource}, count ${count}).`);
}

/**
 * Sends one card Undercover (WP-678 / D-24494, supersedes D-24060).
 *
 * Moves `cardId` from `fromZone` into the acting player's Victory Pile and records
 * it in the per-player `undercover` tracker (worth 1 VP each; universal-rules-v23
 * §Undercover). Undercover'd cards live in `victory` (so S.H.I.E.L.D. Level and
 * presence count them) AND in `undercover` (so scoring awards 1 VP per entry without
 * inferring from card type). Returns the new `fromZone` array (the caller assigns it);
 * a no-op (card not found) returns `fromZone` unchanged.
 *
 * @param G - Game state (mutates the player's `victory` + `undercover`).
 * @param playerID - The acting player.
 * @param cardId - The card to send Undercover.
 * @param fromZone - The source array the card is removed from (hand, or G.piles.officers).
 * @returns The new source array with `cardId` removed.
 */
export function sendCardUndercover(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
  fromZone: CardExtId[],
): CardExtId[] {
  const zones = G.playerZones[playerID];
  if (!zones) { return fromZone; }
  const moveResult = moveCardFromZone(fromZone, zones.victory, cardId);
  if (!moveResult.found) { return fromZone; }
  zones.victory = moveResult.to;
  // why: `?? []` guards a reconstructed/legacy state that predates the tracker (see the
  // scoring guard); a live match always has it (playerInit).
  zones.undercover = [...(zones.undercover ?? []), cardId];
  pushLog(G, `Player ${playerID} sent ${cardId} Undercover (into the Victory Pile, +1 VP).`);
  return moveResult.from;
}

/**
 * Undercover from the hand: "send a [team:shield] Hero from your hand Undercover"
 * (WP-678 / D-24494). Eligible targets are hand cards counting as team `shield`.
 * 0 eligible → legal no-op; 1 → auto-send; ≥2 → park a PendingUndercoverChoice
 * resolved by resolveUndercoverChoice. Carries no magnitude.
 *
 * @param G - Game state (mutated).
 * @param _ctx - Unused (framework parity).
 * @param playerID - The acting player.
 * @param cardId - The triggering (played) card, recorded on the pending entry.
 * @param _effect - Unused (the source shape is fixed by the keyword).
 */
function heroEffectUndercoverHandShieldHero(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  const zones = G.playerZones[playerID];
  if (!zones) { return; }
  // why: eligible = hand cards counting as team `shield` (the printed team; copied teams
  // are an in-play concept and never apply to a hand card). The triggering card is in
  // inPlay when its onPlay fires, so it is not in hand — no self-exclusion needed.
  const eligible = zones.hand.filter((handCardId) =>
    cardHasTeamWhenPlayed(G, handCardId, 'shield'),
  );
  if (eligible.length === 0) {
    // why: a legal no-op — the option was taken but no [team:shield] Hero is in hand.
    return;
  }
  if (eligible.length === 1) {
    // why: exactly one eligible target — auto-send (no prompt), mirroring the shipped
    // single-candidate auto-resolve pattern (optional-ko-reward / copy-powers).
    zones.hand = sendCardUndercover(G, playerID, eligible[0]!, zones.hand);
    return;
  }
  // why: ≥2 eligible — park an interactive pick resolved by resolveUndercoverChoice
  // (D-24494). Lazy-init at the park site (never in Game.setup); absent = no pending choice.
  if (!G.pendingUndercoverChoice) { G.pendingUndercoverChoice = []; }
  const pending: PendingUndercoverChoice = {
    playerID,
    cardId,
    source: 'hand-shield-hero',
    eligibleTargets: [...eligible],
  };
  G.pendingUndercoverChoice.push(pending);
}

/**
 * Undercover from the S.H.I.E.L.D. Officer Stack: "send a card from the S.H.I.E.L.D.
 * Officer Stack Undercover" (WP-678 / D-24494). Deterministic — the Officer Stack is
 * homogeneous, so this sends the top Officer (no player choice). Empty stack → no-op.
 * Carries no magnitude.
 *
 * @param G - Game state (mutated).
 * @param _ctx - Unused (framework parity).
 * @param playerID - The acting player.
 * @param _cardId - Unused (the sent card comes from the Officer Stack, not the played card).
 * @param _effect - Unused (the source shape is fixed by the keyword).
 */
function heroEffectUndercoverOfficerStack(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  _cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  const zones = G.playerZones[playerID];
  if (!zones) { return; }
  const officers = G.piles?.officers;
  if (!officers || officers.length === 0) {
    // why: a legal no-op — the Officer Stack is empty.
    return;
  }
  // why: the Officer Stack is homogeneous (identical S.H.I.E.L.D. Officers), so "a card"
  // is deterministically the top one — no interactive choice.
  G.piles.officers = sendCardUndercover(G, playerID, officers[0]!, officers);
}

/**
 * Reveal-Hero-Deck-attack (WP-668 / D-24481). Jade Giantess's "For every 2
 * Recruit you made this turn, Reveal the top card of the Hero Deck, put it on
 * the bottom of that deck, and you get that card's printed Attack."
 *
 * A deterministic SYNCHRONOUS onPlay effect — the reveals are forced and pure
 * upside (no player decision), so it resolves in place rather than through the
 * pending-choice machinery (the investigate / reveal-from-hand pattern). The
 * only G mutations are the attack grant and the G.heroDeck reorder; no new zone,
 * no new G field.
 *
 * Timing: iterations are a SNAPSHOT of Recruit-made-so-far at play time —
 * `Math.floor(G.turnEconomy.recruit / divisor)`, read once here. This is the
 * faithful tabletop resolution (an ability counts Recruit generated by cards
 * resolved before it this turn), deliberately NOT the WP-568 recruit-threshold
 * wait-and-see: a scaling factor cannot re-fire cleanly (re-running the loop each
 * move would multi-count the reveals).
 *
 * Bottoming keeps the shared Hero Deck non-depleting, so N reveals proceed as
 * long as the deck is non-empty (a deck shorter than N simply re-reveals cycled
 * cards — faithful to the printed instruction repeated N times). An empty Hero
 * Deck reveals nothing.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param _ctx - Unused (no RNG — a top-of-deck read is deterministic).
 * @param playerID - The acting player.
 * @param cardId - The played Jade Giantess card (for the log reference).
 * @param effect - The effect descriptor; `magnitude` is the "for every N Recruit" divisor.
 */
function heroEffectRevealHeroDeckAttack(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  if (!G.turnEconomy) {
    return;
  }
  // why: magnitude carries the "for every N Recruit" divisor (2 for Jade Giantess).
  // A non-positive divisor is a defensive skip — the parser only emits [1-9]\d*,
  // so this is unreachable in practice, but guards against a division by zero.
  const divisor = effect.magnitude as number;
  if (divisor <= 0) {
    return;
  }
  // why: SNAPSHOT of Recruit made so far this turn — the faithful tabletop count
  // (G.turnEconomy.recruit is the gross recruit-made accumulator the
  // recruitMadeThisTurnAtLeast gate reads). Read once; not re-checked later.
  const iterations = Math.floor(G.turnEconomy.recruit / divisor);
  if (iterations === 0) {
    // why: below the per-N-Recruit threshold nothing is revealed — a `neutral`
    // line so the player sees WHY the ability produced no Attack (the "did
    // nothing" confusion the hero-effect arc keeps paying for), without claiming
    // the ability failed (it resolved correctly at 0 scale).
    pushLog(G,
      `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, cardId)} revealed no Hero-Deck cards — they made fewer than ${divisor} Recruit this turn.`,
      'neutral',
      cardId,
    );
    return;
  }
  if (!G.heroDeck || G.heroDeck.length === 0) {
    // why: WP-434 — an empty Hero Deck (rare, near game end) is `blocked` — the
    // ability would fire but there is nothing to reveal. The `!G.heroDeck` guard
    // tolerates older/stripped mocks that predate the zone (mirrors the !G.turnEconomy
    // guard above); the real G always carries heroDeck.
    pushLog(G,
      `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, cardId)} could not reveal a Hero-Deck card — the Hero Deck is empty.`,
      'blocked',
      cardId,
    );
    return;
  }

  // why: reveal the top card, add its PRINTED attack (G.cardStats[id].attack —
  // the setup-injected stat, the same value investigate reads), then rotate it to
  // the BOTTOM of G.heroDeck by rebinding the array (front = top; NEVER .shift()).
  let totalAttack = 0;
  let revealedCount = 0;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const topCardId = G.heroDeck[0];
    if (topCardId === undefined) {
      break;
    }
    const cardStat = G.cardStats[topCardId];
    // why: a card with no stat entry contributes 0 — never a fabricated value.
    const printedAttack = cardStat !== undefined ? cardStat.attack : 0;
    totalAttack += printedAttack;
    revealedCount++;
    // why: rotate top → bottom by rebind (front-slice + append), so the shared
    // Hero Deck keeps its length and a deck shorter than N re-reveals cycled cards.
    G.heroDeck = [...G.heroDeck.slice(1), topCardId];
  }

  G.turnEconomy = addResources(G.turnEconomy, totalAttack, 0);
  // why: WP-434 — a realized count-scaled reveal is `applied` (green); name the
  // reveal count and the total Attack so the scaled grant is observable.
  pushLog(G,
    `Player ${playerID} revealed ${revealedCount} card(s) from the Hero Deck via ${formatCardRef(G.cardDisplayData, cardId)} and gained +${totalAttack} attack.`,
    'applied',
    cardId,
  );
}

function heroEffectOptionalKoReward(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  // why: D-24019 — parks an interactive choice (mirrors WP-242); the reward
  // is granted on resolve (resolveOptionalKoReward), not at play time. The
  // player either declines (no KO, no reward) or KOs exactly one card from
  // their hand or discard pile, in which case the reward fires.
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  // why: eligible = discard ∪ hand, ANY card INCLUDING wounds (the printed
  // text is "a card", not "a Hero") — no type/cost/keyword filtering. 0
  // eligible (both zones empty) → skipped no-op + a G.messages line (mirrors
  // the D-24017 empty-supply rescue logging), so the player can see why the
  // ability did nothing.
  // why: D-24442 — the KO source is hand ∪ discard ∪ inPlay (cards played this
  // turn), so the ability parks whenever ANY of the three has a card. Counting
  // inPlay is what lets a player who has emptied hand+discard (e.g. after a
  // within-turn reshuffle) still KO a card they played this turn. NOTE: at this
  // onPlay dispatch the triggering card itself is already in inPlay, so
  // eligibleCount is ≥ 1 in normal play — the zero-branch below is now a
  // defensive no-op (reachable only via a direct/unit dispatch with an empty
  // inPlay), kept so a genuinely empty state parks nothing rather than dangling.
  const eligibleCount =
    playerZones.discard.length + playerZones.hand.length + playerZones.inPlay.length;
  if (eligibleCount === 0) {
    pushLog(G,
      `Player ${playerID} could not KO a card for a hero ability — hand, discard pile, and in-play cards are all empty, so no reward was granted.`,
    );
    return;
  }
  // why: defensive — the parser only emits a seeded rewardType, but an
  // unseeded reward here is a logged no-op that never reaches the queue
  // (no reward executor exists for it).
  const rewardType = effect.rewardType;
  if (rewardType === undefined || !OPTIONAL_KO_REWARD_SEEDED_REWARDS.has(rewardType)) {
    pushLog(G, 
      `Player ${playerID} played a hero ability whose optional-KO reward is not yet supported, so the choice was skipped.`,
    );
    return;
  }
  // why: lazy-init at the park site (mirrors villainEffects.execute.ts:190
  // pendingKoHeroChoices) — NEVER in Game.setup; the optional field tolerates
  // older snapshots. The park itself is SILENT (no G.messages line), mirroring
  // the WP-242 park; the reward grant is logged by the dispatched executor.
  if (!G.pendingOptionalKoRewards) { G.pendingOptionalKoRewards = []; }
  G.pendingOptionalKoRewards.push({
    playerID,
    rewardType,
    rewardMagnitude: effect.magnitude ?? 1,
    sourceCardId: cardId,
  });
}

/**
 * Park handler for the `optional-ko-hand-discard` hero keyword (WP-667 / D-24480).
 *
 * Radioactive Riot's "you may KO a card from your hand or discard pile" — the
 * NO-REWARD, hand+discard-only variant of optional-ko-reward. It parks a no-reward
 * entry (`rewardType: 'none'`, `koZones: ['hand','discard']`) into the SAME
 * `G.pendingOptionalKoRewards` queue, so the block-all guard, getLegalMoves
 * short-circuit, resolve move, projection, and client prompt are all reused. The
 * recruit-threshold:6 gate is evaluated on the hook BEFORE this handler runs (the
 * wait-and-see window), so this runs only when the player has made ≥6 Recruit.
 *
 * KO source = hand ∪ discard ONLY (the printed text; NOT inPlay — unlike the
 * D-24442 wide set the rewarded variant uses). 0 eligible (both empty) → a logged
 * no-op that parks nothing (never a throw), so the player can see why nothing
 * happened.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param _ctx - Unused (the KO happens at resolve time).
 * @param playerID - The player who played the card.
 * @param cardId - The played card (recorded for the resolve-move log).
 * @param _effect - The `{ type: 'optional-ko-hand-discard' }` descriptor (no magnitude).
 */
function heroEffectOptionalKoHandDiscard(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  // why: WP-667 — eligible = hand ∪ discard ONLY (Radioactive Riot excludes in-play
  // cards, unlike the D-24442 wide set). 0 eligible → skipped no-op + a log line so the
  // player sees why the ability did nothing (mirrors the optional-ko-reward empty branch).
  const eligibleCount = playerZones.hand.length + playerZones.discard.length;
  if (eligibleCount === 0) {
    pushLog(G,
      `Player ${playerID} could not KO a card for ${formatCardRef(G.cardDisplayData, cardId)}'s ability — their hand and discard pile are both empty.`,
    );
    return;
  }
  // why: WP-667 / D-24480 — park a NO-REWARD entry into the shared optional-ko-reward
  // queue; rewardType 'none' makes the resolve skip the reward dispatch, koZones
  // ['hand','discard'] makes the resolve reject an in-play KO + the projection list an
  // empty inPlay set. Lazy-init the queue (mirrors the reward park); the park is SILENT.
  if (!G.pendingOptionalKoRewards) { G.pendingOptionalKoRewards = []; }
  G.pendingOptionalKoRewards.push({
    playerID,
    rewardType: 'none',
    rewardMagnitude: 0,
    sourceCardId: cardId,
    koZones: ['hand', 'discard'],
  });
}

/**
 * Park handler for the `smash` hero keyword (WP-676 / D-24492).
 *
 * Per universal-rules-v23 §Smash, "Smash N" = "You may discard another card from
 * your hand. If you do, you get +N attack." — an interactive OPTIONAL per-instance
 * choice. This parks ONE `PendingSmashDiscard { playerID, magnitude }` per Smash
 * hook onto the FIFO `G.pendingSmashDiscards` queue; the +N Attack is granted at
 * resolve time (resolveSmashDiscard), never at play time. She-Hulk's Hurl Trucks
 * prints two "Smash 2" as two separate abilities[] entries → two hooks → two parks,
 * resolved independently (+0 / +2 / +4).
 *
 * // why: D-24492 — `smash` is NOT in NO_MAGNITUDE_KEYWORDS, so executeSingleEffect's
 * magnitude pre-gate has already confirmed a valid +N magnitude before this runs
 * (the +N Attack rides the effect magnitude). A bare magnitude-less `[keyword:Smash]`
 * verb token (the co-printed conditional-KO clauses on Korg / Namora) never reaches
 * here — it fails that pre-gate and safe-skips (no park, no freeze).
 *
 * // why: an empty hand parks NOTHING (nothing to discard → the "you may discard
 * another card" has no legal target), logged as a neutral no-op so the player can
 * see why the ability granted no Attack. The played Smash card is already in inPlay,
 * so the hand holds only "another card"; an empty hand means no eligible discard.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param _ctx - Unused (the discard + Attack grant happen at resolve time).
 * @param playerID - The player who played the Smash card.
 * @param cardId - The played card (recorded for the no-op log line).
 * @param effect - The effect descriptor carrying the Attack magnitude.
 */
function heroEffectSmash(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  // why: D-24492 — "discard ANOTHER card from your hand": the eligible set is the
  // whole current hand (the played Smash card is already in inPlay). An empty hand
  // means nothing to discard, so park nothing and log the no-op (mirrors the
  // optional-ko-reward empty branch), so the player sees why the ability did nothing.
  if (playerZones.hand.length === 0) {
    pushLog(G,
      `Player ${playerID} could not Smash for ${formatCardRef(G.cardDisplayData, cardId)} — their hand had no other card to discard, so no Attack was granted.`,
    );
    return;
  }
  // why: D-24492 — lazy-init at the park site (mirrors the optional-ko-reward park) —
  // NEVER in Game.setup, so a game that never plays a Smash card carries no new field and
  // both hash oracles stay byte-unchanged. The park is SILENT (no G.messages line); the
  // resolve move logs the discard/decline outcome. The magnitude is the +N Attack granted
  // iff the player discards; effect.magnitude is pre-gate-validated (smash NOT in
  // NO_MAGNITUDE_KEYWORDS), the ?? 1 is a defensive default for a direct unit dispatch.
  if (!G.pendingSmashDiscards) { G.pendingSmashDiscards = []; }
  G.pendingSmashDiscards.push({
    playerID,
    magnitude: effect.magnitude ?? 1,
  });
}

/**
 * Handler for the `optional-play-villain-top` hero keyword (WP-663 / D-24474).
 *
 * Shadowed Thoughts' "[hc:covert]: You may play the top card of the Villain Deck. If you
 * do, +2 Attack." Parks an interactive PendingPlayVillainTopChoice; the +Attack reward is
 * granted on resolve (resolvePlayVillainTopChoice), NOT at play time — playing the top
 * Villain-Deck card has a real downside (a Villain enters the city, or a Master Strike /
 * Scheme Twist fires), so the player genuinely chooses (contrast the auto-resolving
 * reveal-from-hand). The covert gate already gated the hook, so this runs only when the
 * Covert synergy is met.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param _ctx - Unused (the reward + villain-deck play happen at resolve time).
 * @param playerID - The player who played the card.
 * @param cardId - The played card (recorded for the resolve-move log).
 * @param effect - The effect descriptor carrying the Attack reward magnitude.
 */
function heroEffectOptionalPlayVillainTop(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  // why: WP-663 / D-24474 — lazy-init at the park site (mirrors the optional-ko-reward
  // park) — NEVER in Game.setup, so a game that never parks one carries no new G field. The
  // park is SILENT (no G.messages line); the resolve move logs the accept/decline outcome.
  if (!G.pendingPlayVillainTopChoices) { G.pendingPlayVillainTopChoices = []; }
  G.pendingPlayVillainTopChoices.push({
    playerID,
    cardId,
    // why: the parser emits magnitude 2 from the [keyword:optional-play-villain-top:2]
    // marker (validated by the executeSingleEffect pre-gate — this keyword is NOT in
    // NO_MAGNITUDE_KEYWORDS); the ?? 2 is a defensive default for a direct unit dispatch.
    attackReward: effect.magnitude ?? 2,
  });
}

/**
 * Handler for the `ko-wound-reward` hero keyword (WP-382 / D-24183).
 *
 * The auto-resolving, Wound-restricted variant of `optional-ko-reward` (the
 * Healing Factor family, "you may KO a Wound from your hand or discard pile; if
 * you do, <reward>"). It immediately KOs one Wound to `G.ko` — preferring hand,
 * else discard — and grants the reward by REUSING `executeSingleEffect`; with no
 * Wound in either zone it logs a no-op (D-24017) and returns.
 *
 * The player choice / decline is intentionally NOT modeled (unlike
 * `optional-ko-reward`): a Wound is a fungible dead card and KO-plus-reward is
 * strictly beneficial, so an auto-resolve captures optimal play. Moves/effects
 * never throw.
 *
 * @param G - Game state (mutated: KOs a Wound, grants the reward).
 * @param ctx - Move context; carries `ctx.random` for the draw reward's reshuffle.
 * @param playerID - The player who played the card.
 * @param cardId - The source hero card's ext_id (passed to the reward executor).
 * @param effect - The descriptor carrying `rewardType` + `magnitude`.
 */
function heroEffectKoWoundReward(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }

  // why: D-24183 — KO a Wound, hand first (removes the currently-held Wound),
  // else discard. The KO target is filtered to WOUND_EXT_ID — a valuable Hero is
  // never KO'd (the reason this family could not reuse the KO-any-card keyword).
  let targetZone: 'hand' | 'discard' | null = null;
  if (playerZones.hand.includes(WOUND_EXT_ID)) {
    targetZone = 'hand';
  } else if (playerZones.discard.includes(WOUND_EXT_ID)) {
    targetZone = 'discard';
  }
  if (targetZone === null) {
    // why: D-24017 — no Wound to KO means the optional effect does nothing; log
    // the no-op so the player and the replay inspector can see why the ability
    // granted no reward.
    pushLog(G,
      `Player ${playerID} had no Wound in hand or discard pile to KO for a hero ability, so no reward was granted.`,
    );
    return;
  }

  // why: defensive — the parser only emits a seeded rewardType, but an unseeded
  // reward here is a logged no-op (no reward executor exists for it).
  const rewardType = effect.rewardType;
  if (rewardType === undefined || !KO_WOUND_REWARD_SEEDED_REWARDS.has(rewardType)) {
    pushLog(G,
      `Player ${playerID} played a hero ability whose KO-a-Wound reward is not yet supported, so it was skipped.`,
    );
    return;
  }

  // why: D-24183 — remove exactly one Wound from the chosen zone and KO it.
  // moveCardFromZone removes the first matching WOUND_EXT_ID; koCard appends it.
  const moveResult = moveCardFromZone(playerZones[targetZone], [], WOUND_EXT_ID);
  if (!moveResult.found) { return; }
  playerZones[targetZone] = moveResult.from;
  G.ko = koCard(G.ko, WOUND_EXT_ID);
  pushLog(G,
    `Player ${playerID} KO'd a Wound from their ${targetZone} via a hero ability.`,
  );

  // why: D-24183 — THEN grant the reward by REUSING the existing executor — no
  // re-implementation of draw / attack / recruit. `ctx` carries `ctx.random` for
  // the draw reward's deck-exhaustion reshuffle.
  executeSingleEffect(G, ctx, playerID, cardId, {
    type: rewardType,
    magnitude: effect.magnitude ?? 1,
  });
}

/**
 * Park handler for the `optional-put-bottom-hq` hero keyword.
 *
 * Checks whether there are any cards in the HQ. If yes, parks a
 * `PendingOptionalPutBottomHQ` on `G.pendingOptionalPutBottomHQ[]` (lazy-init).
 * If the HQ is empty, logs a no-op message and returns without touching the queue.
 *
 * The card move itself happens at resolve time (resolveOptionalPutBottomHQ), NOT
 * here — the player must first choose which HQ card (if any) to move to the deck bottom.
 */
function heroEffectOptionalPutBottomHq(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  // why: check if there are any cards in the HQ to move. HQ is the shared board zone
  // (not per-player). If empty, the ability has no valid targets.
  const hqZone = G.hq;
  const eligibleCards = hqZone.filter(slot => slot !== null).length;
  if (eligibleCards === 0) {
    pushLog(G,
      `Player ${playerID} could not move a card from the HQ — the HQ is empty, so no card was moved.`,
    );
    return;
  }
  // why: lazy-init at the park site (mirrors optional-ko-reward pattern) — NEVER in
  // Game.setup. The park itself is SILENT (no G.messages line); the move is silent too.
  if (!G.pendingOptionalPutBottomHQ) { G.pendingOptionalPutBottomHQ = []; }
  G.pendingOptionalPutBottomHQ.push({
    playerID,
    sourceCardId: cardId,
  });
}

/**
 * Park handler for the `put-bottom-hq-icon-reward` hero keyword (D-24133).
 *
 * The MANDATORY, icon-reward sibling of `heroEffectOptionalPutBottomHq`. The printed
 * "Put a card from the HQ on the bottom of the Hero Deck. If that card had a recruit
 * icon, you get +N recruit. If that card had an attack icon, you get +N attack."
 * (Wonder Man's Absorb Ambient Power). Parks onto the SAME single-card queue
 * (`G.pendingOptionalPutBottomHQ`) with `mandatory: true` (no Decline) and the reward
 * magnitude, so resolveOptionalPutBottomHQ applies the icon reward after the move.
 *
 * If the HQ is empty the mandatory choice cannot be made — logged no-op, parks nothing.
 */
function heroEffectPutBottomHqIconReward(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const hqZone = G.hq;
  const eligibleCards = hqZone.filter(slot => slot !== null).length;
  if (eligibleCards === 0) {
    pushLog(G,
      `Player ${playerID} could not move a card from the HQ — the HQ is empty, so no card was moved.`,
    );
    return;
  }
  // why: the reward magnitude rides on the descriptor magnitude ([keyword:put-bottom-hq-icon-reward:N]);
  // default to 3 (Absorb Ambient Power's printed value) if a magnitude somehow did not parse.
  const iconRewardMagnitude = effect.magnitude !== undefined && effect.magnitude > 0 ? effect.magnitude : 3;
  if (!G.pendingOptionalPutBottomHQ) { G.pendingOptionalPutBottomHQ = []; }
  G.pendingOptionalPutBottomHQ.push({
    playerID,
    sourceCardId: cardId,
    mandatory: true,
    iconRewardMagnitude,
  });
}

/**
 * Park handler for the `put-any-number-bottom-hq` hero keyword (D-24132).
 *
 * The MULTI-select sibling of `heroEffectOptionalPutBottomHq`. Checks whether there are any
 * cards in the HQ. If yes, parks a `PendingPutAnyNumberBottomHQ` on
 * `G.pendingPutAnyNumberBottomHQ[]` (lazy-init), recording any trailing "Then you get
 * Empowered by [classes]" grant parsed onto the effect (applied AFTER the moves at resolve
 * time). If the HQ is empty, logs a no-op message and returns without touching the queue.
 *
 * The card moves and the Empowered grant both happen at resolve time
 * (resolvePutAnyNumberBottomHQ), NOT here — the player must first choose which HQ cards (if
 * any) to move to the deck bottom.
 */
function heroEffectPutAnyNumberBottomHq(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  // why: check if there are any cards in the HQ to move. HQ is the shared board zone
  // (not per-player). If empty, the ability has no valid targets.
  const hqZone = G.hq;
  const eligibleCards = hqZone.filter(slot => slot !== null).length;
  if (eligibleCards === 0) {
    pushLog(G,
      `Player ${playerID} could not move cards from the HQ — the HQ is empty, so no cards were moved.`,
    );
    return;
  }
  // why: lazy-init at the park site (mirrors optional-put-bottom-hq) — NEVER in Game.setup.
  // The park itself is SILENT (no G.messages line); the moves + Empowered grant are logged at
  // resolve time. empoweredClasses is recorded only when the parsed effect carries a non-empty
  // tail (omit-when-empty keeps Empyreal Force / Colliding-Dreams-line-1 entries minimal).
  if (!G.pendingPutAnyNumberBottomHQ) { G.pendingPutAnyNumberBottomHQ = []; }
  const empoweredClasses = effect.empoweredClasses;
  G.pendingPutAnyNumberBottomHQ.push({
    playerID,
    sourceCardId: cardId,
    ...(empoweredClasses !== undefined && empoweredClasses.length > 0 ? { empoweredClasses } : {}),
  });
}

/**
 * Park handler for the `return-zero-cost-discard` hero keyword (D-24139).
 *
 * The printed "Return a 0-cost card from your discard pile to your hand"
 * (Black Knight's Defend the Weak). Checks whether the chooser's discard pile
 * holds at least one 0-cost card (the shared isZeroCostCard predicate via
 * getEligibleZeroCostDiscardCards). If yes, parks a PendingReturnZeroCostDiscard
 * on `G.pendingReturnZeroCostDiscard[]` (lazy-init). If no eligible card exists,
 * logs a no-op message and returns without touching the queue.
 *
 * The card move itself happens at resolve time (resolveReturnZeroCostDiscard),
 * NOT here — the player must first choose which eligible card to take back.
 * The choice is mandatory (no decline): the printed text has no "you may".
 */
function heroEffectReturnZeroCostDiscard(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  const eligibleCards = getEligibleZeroCostDiscardCards(G, playerID);
  if (eligibleCards.length === 0) {
    pushLog(G,
      `Player ${playerID} could not return a 0-cost card from their discard pile — it holds no 0-cost card, so nothing was returned.`,
    );
    return;
  }
  // why: lazy-init at the park site (mirrors optional-put-bottom-hq) — NEVER in
  // Game.setup. The park itself is SILENT (no G.messages line); the return is
  // logged at resolve time.
  if (!G.pendingReturnZeroCostDiscard) { G.pendingReturnZeroCostDiscard = []; }
  G.pendingReturnZeroCostDiscard.push({
    playerID,
    sourceCardId: cardId,
  });
}

/**
 * Park handler for the `discard-to-play` hero card cost (WP-383 / D-24184).
 *
 * The printed "To play this card, you must discard a card from your hand"
 * (Cyclops Determination/Optic Blast + siblings). Parks a mandatory
 * PendingDiscardToPlay on `G.pendingDiscardToPlay[]` (lazy-init) with
 * `remaining` set to the cost magnitude, resolved by resolveDiscardToPlay.
 *
 * // why: payability (hand holds ≥ magnitude cards after the played card moved
 * to inPlay) is pre-guaranteed by the D-24185 pre-commit precondition in
 * playCard — an unpayable play never commits, so this handler never runs
 * without enough cards. The eligibility re-check below is defensive only (a
 * fail-closed against a future play path that skips the precondition); it must
 * NOT be relied on to prevent the base-power leak — that is the precondition's
 * job, before commit. The card move itself happens at resolve time.
 */
function heroEffectDiscardToPlay(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  const remaining = effect.magnitude ?? 1;
  if (getEligibleDiscardToPlayCards(G, playerID).length < remaining) {
    // why: defensive fail-closed — the precondition should have blocked this,
    // so reaching here means an unexpected play path; log and skip the park
    // rather than create an unpayable pending choice that would freeze the turn.
    pushLog(G,
      `Player ${playerID} could not pay the discard-to-play cost — not enough cards in hand, so no discard was required.`,
    );
    return;
  }
  // why: lazy-init at the park site (mirrors return-zero-cost-discard) — NEVER
  // in Game.setup. The park itself is SILENT; each discard is logged at resolve.
  if (!G.pendingDiscardToPlay) { G.pendingDiscardToPlay = []; }
  G.pendingDiscardToPlay.push({
    playerID,
    sourceCardId: cardId,
    remaining,
  });
}

/**
 * Park handler for the `victory-villain-attack` hero keyword (WP-285 / D-24067).
 *
 * Checks whether the player has at least one eligible villain in their victory pile
 * at play time. If yes, parks a `PendingVictoryPileCardPick` on
 * `G.pendingVictoryPileCardPick[]` (lazy-init). If no eligible villain exists, logs
 * a hollow-style no-op message (D-24067) and returns without touching the queue.
 *
 * The attack grant itself happens at resolve time (resolveVictoryPileCardPick), NOT
 * here — the player must first pick which villain to use.
 */
function heroEffectVictoryVillainAttack(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  _cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  const eligibleVillains = getEligibleVictoryVillains(G, playerID);
  if (eligibleVillains.length === 0) {
    // why: no eligible villains in victory pile at play time — no pending pick parked, logged as no-op (D-24067)
    pushLog(G, 
      `Player ${playerID} played a victory-villain-attack hero ability but had no eligible villains in their victory pile — no pick was queued.`,
    );
    return;
  }
  // why: lazy-init at the park site (never in Game.setup); absent field = no pending pick. Mirrors pendingOptionalKoRewards (D-24019).
  if (!G.pendingVictoryPileCardPick) { G.pendingVictoryPileCardPick = []; }
  G.pendingVictoryPileCardPick.push({ rewardType: 'attack', playerID });
}

/**
 * Park handler for the `draw-or-empowered` hero keyword (WP-286 / D-24069).
 *
 * Parks a `PendingDrawOrEmpowered` on `G.pendingDrawOrEmpowered[]` (lazy-init) carrying the
 * player and the empowered hero class the parser extracted from the "Empowered by [hc:X]" tail.
 * The draw or the empowered grant happens at resolve time (resolveDrawOrEmpowered), NOT here —
 * the player (or bot) must first pick which half of the printed "Choose one" to take.
 *
 * A descriptor with no empoweredClass (should never happen post-parse — the parser only emits a
 * draw-or-empowered effect with a parsed class) is a logged no-op that parks nothing.
 */
function heroEffectDrawOrEmpowered(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  _cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const empoweredClass = effect.empoweredClass;
  if (empoweredClass === undefined || empoweredClass.length === 0) {
    // why: defensive — the parser always emits draw-or-empowered with a parsed empoweredClass; a
    // missing class here is a logged no-op that parks nothing (mirrors the optional-ko-reward
    // unseeded-reward guard). Unreachable post-parse, but never throw and never park a broken entry.
    pushLog(G, 
      `Player ${playerID} played a draw-or-empowered hero ability with no empowered class, so the choice was skipped.`,
    );
    return;
  }
  // why: parks an interactive draw-or-empowered choice resolved by resolveDrawOrEmpowered (D-24069)
  // why: lazy-init at the park site (never in Game.setup); absent field = no pending choice. Mirrors pendingVictoryPileCardPick (D-24067).
  if (!G.pendingDrawOrEmpowered) { G.pendingDrawOrEmpowered = []; }
  G.pendingDrawOrEmpowered.push({ playerID, empoweredClass });
}

/**
 * Park handler for the `count-scaled-choose` hero keyword (WP-675 / D-24490).
 *
 * Parks a `PendingCountScaledChoice` on `G.pendingCountScaledChoice[]` (lazy-init,
 * FIFO) carrying the two printed options. The grant happens at resolve time
 * (resolveCountScaledChoice), NOT here — the counts are resolved from `G` when the
 * player picks, so a card played after this one but before the choice resolves is
 * counted correctly (the draw-or-empowered pattern of carrying the descriptor).
 *
 * A missing/short options list (should never happen post-parse — the pre-pass emits
 * exactly two options) is a logged no-op that parks nothing.
 */
function heroEffectCountScaledChoose(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const options = effect.countScaledChoiceOptions;
  if (options === undefined || options.length < 2) {
    // why: defensive — the parser always emits count-scaled-choose with two options; a
    // missing/short list here parks nothing (mirrors the draw-or-empowered guard). Never throw.
    pushLog(G,
      `Player ${playerID} played a count-scaled-choose hero ability with no options, so the choice was skipped.`,
    );
    return;
  }
  // why: parks an interactive count-scaled choice resolved by resolveCountScaledChoice (D-24490)
  // why: lazy-init at the park site (never in Game.setup); absent field = no pending choice.
  if (!G.pendingCountScaledChoice) { G.pendingCountScaledChoice = []; }
  // why: record the triggering card so the icon count sources exclude it at resolve time
  // (vnom's card shows both icons and would otherwise count itself). Fresh copy of the
  // options array — no aliasing of the parsed descriptor into G.
  G.pendingCountScaledChoice.push({ playerID, cardId, options: options.map((option) => ({ ...option })) });
}

/**
 * Executor for the `shuffle-discard-empty-reward` hero keyword (D-24148).
 *
 * The printed "If your discard pile is empty, you get +N[recruit|attack].
 * Otherwise, shuffle your discard pile into your deck." (Jocasta's Reprocess is
 * the recruit variant, Electromagnetic Eyebeams the attack variant). Mandatory
 * and immediate — the printed text offers no choice, so nothing is parked and
 * no move is blocked.
 *
 * Empty-discard branch: grants the descriptor's magnitude of the descriptor's
 * rewardType via addResources on G.turnEconomy. Played cards live in inPlay
 * until cleanup, so they never count toward the emptiness check (tabletop
 * rule).
 *
 * Non-empty branch: the ENTIRE discard pile is shuffled INTO the deck as one
 * combined deterministic shuffle — new deck = shuffle(deck + discard),
 * discard = []. Both branches append one G.messages line.
 *
 * A rewardType outside the seeded pair (should never happen post-parse — the
 * parser's seeded-set gate filters it) is a silent no-op. The upstream
 * magnitude pre-gate in executeSingleEffect already drops zero/missing
 * magnitudes.
 */
function heroEffectShuffleDiscardEmptyReward(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  const rewardType = effect.rewardType;
  if (rewardType !== 'attack' && rewardType !== 'recruit') {
    // why: defensive mirror of the parser's seeded-set gate (D-24148) — an
    // unseeded reward never grants or shuffles; unreachable post-parse.
    return;
  }
  const magnitude = effect.magnitude as number;
  if (magnitude < 1) {
    // why: D-24148 — the build gate ([1-9]\d*) and the parser's n >= 1 check
    // keep zero out of real data; this executor-level guard is the D-24019
    // downstream convention (isValidMagnitude deliberately admits 0 for
    // reveal-family semantics, so each executor owns its own n >= 1 floor).
    return;
  }

  if (playerZones.discard.length === 0) {
    if (rewardType === 'attack') {
      G.turnEconomy = addResources(G.turnEconomy, magnitude, 0);
    } else {
      G.turnEconomy = addResources(G.turnEconomy, 0, magnitude);
    }
    pushLog(G,
      `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, cardId)} found an empty discard pile and granted +${magnitude} ${rewardType}.`,
    );
    return;
  }

  const shuffledInCount = playerZones.discard.length;
  const combined = moveAllCards(playerZones.discard, playerZones.deck);
  playerZones.discard = combined.from;
  // why: ctx is narrowed to ShuffleProvider because the combined discard-into-
  // deck shuffle needs ctx.random.Shuffle — the only permitted randomness
  // source, so the result replays identically from the seed (D-24148; the
  // established heroEffectDraw pattern).
  playerZones.deck = shuffleDeck(combined.to, ctx as ShuffleProvider);
  pushLog(G,
    `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, cardId)} shuffled their ${shuffledInCount}-card discard pile into their deck (deck is now ${playerZones.deck.length} cards).`,
  );
}

// why: D-24022 — the hero-effect ImplementationMap (mirrors WP-009B's pattern).
// Handlers are plain functions held OUTSIDE G; a new effect is a registry entry
// + a drift-test entry, not a `switch` edit. Keyed by HeroKeyword and `Partial`
// because 'wound'/'conditional' are intentionally unmapped (the deferred set);
// the union therefore stays typed + drift-detected. Exported so the registry
// drift test can assert its keys == HANDLED_KEYWORDS bidirectionally.
// why: WP-253 / D-24024 — the 7 legacy reveal-* entries are gone; ALL 8 reveal
// keywords now dispatch through the single parameterized `reveal` handler (their
// markers are translated to a `reveal` descriptor with revealRules at parse time).
/**
 * Hero handler for the `defeat-with-bystander` keyword (WP-486 / D-24291).
 *
 * Silent Sniper's "Defeat a Villain or Mastermind that has a Bystander." Builds the
 * deterministic eligible-target set (City Villains holding a Bystander, ascending;
 * then the Mastermind when it holds one), then resolves by cardinality:
 * 0 → a self-narrated no-op (NEVER a hollow record — the keyword is in MVP_KEYWORDS,
 * so it reached its handler); exactly 1 → auto-defeat via the shared fight-defeat
 * core (no prompt); ≥2 → park a PendingDefeatChoice (block-all until resolved) so
 * the current player picks which target.
 *
 * why (D-24291): the defeat REUSES the shared fight-defeat cores (a documented
 * internal invocation), so the onFight/onDefeat hooks and Bystander/hero award run
 * in exactly one place. It spends NO attack and sets NO acted-this-turn flag —
 * Silent Sniper is a card play, not a fight — so `spendAttack` + `G.hasActedThisTurn`
 * stay in the fight moves and are excluded from the shared cores.
 *
 * why (ctx): executeHeroEffects is called with the move-context WRAPPER (playCard's
 * `...context` = `{ ctx, random, events, ... }`), so the bare bgio ctx (currentPlayer
 * + turn, read by the shared cores + the villain executor) is `ctx.ctx`, and the
 * ShuffleProvider for a villain Fight scry is the wrapper's `.random`.
 */
function heroEffectDefeatWithBystander(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  const targets = buildDefeatWithBystanderTargets(G);

  // why: 0 eligible targets is a REACHABLE self-narrated no-op — the printed
  // ability had no legal target this play. It records NO hollow event (the handler
  // ran; the keyword is in MVP_KEYWORDS → classifyHeroEffectReason returns
  // `applied`), matching the D-24017 "surface the reason, don't fail silently" rule.
  if (targets.length === 0) {
    // why: WP-434 — nothing happened because the board offered no legal target, so
    // the outcome is `blocked` (the ability was suppressed, not partially applied).
    pushLog(G,
      `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, cardId)} found no Villain or Mastermind holding a Bystander to defeat.`,
      'blocked',
      cardId, // why: WP-438 — the played card whose ability found no target.
    );
    return;
  }

  // why: executeHeroEffects receives the move-context WRAPPER; the shared cores +
  // the villain executor read the BARE bgio ctx (currentPlayer + `.turn`), which is
  // the wrapper's nested `.ctx`. The Fight scry ShuffleProvider is the wrapper's
  // top-level `.random` (the same narrowing the draw handler uses).
  const bareCtx = (ctx as { ctx: unknown }).ctx;
  const shuffleContext: ShuffleProvider = { random: (ctx as ShuffleProvider).random };

  // why: exactly 1 eligible target → auto-defeat with no prompt (mandatory-if-able).
  // The dispatch routes through the shared core; a villain's onFight may park its
  // own nested pending, which the block-all guards then serialize.
  if (targets.length === 1) {
    dispatchDefeatWithBystanderTarget(G, bareCtx, targets[0]!, shuffleContext);
    return;
  }

  // why: ≥2 eligible targets → park a PendingDefeatChoice; the current player must
  // pick which to defeat. Lazily initialize the FIFO queue (never in Game.setup);
  // snapshots stay counts-only, so it is never persisted. Shipped WITH its UIState
  // projection + client prompt + block-all guard (pending_choice_no_ux_freeze).
  if (!G.pendingDefeatChoices) {
    G.pendingDefeatChoices = [];
  }
  G.pendingDefeatChoices.push({
    choiceType: 'defeat-with-bystander',
    playerID,
    targets,
  });
  // why: WP-434 — parking a mandatory choice is `neutral` (the effect is mid-flight,
  // neither applied nor blocked); the applied/blocked outcome is logged at resolve.
  pushLog(G,
    `Player ${playerID} must choose which Villain or Mastermind to defeat with ${formatCardRef(G.cardDisplayData, cardId)}.`,
    'neutral',
    cardId, // why: WP-438 — the played card that parked the defeat choice.
  );
}

// why: WP-535 / D-24345 — the ext_id of every Rogue Copy Powers copy. Excluding this
// ext_id (not just the one played instance) from the eligible-Hero set means a Copy
// Powers can never copy itself OR another Copy Powers, which neutralizes copy-of-copy
// recursion when two Copy Powers are played the same turn (Finding 5).
export const COPY_POWERS_EXT_ID = 'core/rogue/copy-powers' as CardExtId;

// why: WP-592 / D-24401 — the base ext_id of Rogue's Steal Abilities card. The copy phase
// re-fires each discarded card's ability EXCEPT a discarded Steal Abilities or Copy Powers,
// which are economy-only (the recursion guard in heroEffectStealAbilities): both are
// reentrant-copy keywords that can re-target the in-play Steal Abilities card and recurse to
// a stack overflow. Zones store INSTANCE ids (`<base>#<copyIndex>`), so strip the `#N` suffix
// before comparing to this base — exactly as buildCopyPowersTargets does for COPY_POWERS_EXT_ID.
export const STEAL_ABILITIES_EXT_ID = 'core/rogue/steal-abilities' as CardExtId;

/**
 * The Heroes the given player may copy for a Copy Powers play — the real Heroes in that
 * player's `inPlay` (deduplicated, in play order), excluding the Copy Powers ext_id.
 *
 * "Real Hero" = a card with a non-null printed `heroClass`. S.H.I.E.L.D. starters,
 * Sidekicks, and Wounds carry `heroClass: null` (no class to copy, no Hero ability to
 * re-fire), so a non-null class is the Hero discriminant (the same test
 * heroConditions.evaluate.ts uses for distinct-class scans).
 *
 * // why: shared by the park-time handler, the UIState projection, the resolve
 * validation, and the bot default (the round-trip rule) so the client can only submit a
 * Hero the resolve move accepts. Deduplicated because two copies of the same Hero card
 * are the same ability + class — one choice, not two.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose in-play Heroes are the copy candidates.
 * @returns The copyable Hero ext_ids in play order, or [] when the player has none.
 */
export function buildCopyPowersTargets(
  G: LegendaryGameState,
  playerID: string,
): CardExtId[] {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return [];
  }
  const targets: CardExtId[] = [];
  const seenBaseIds = new Set<string>();
  for (const playedCardId of playerZones.inPlay) {
    const candidate = playedCardId as CardExtId;
    // why: zones store INSTANCE ids (`<base>#<copyIndex>`, e.g. core/rogue/copy-powers#0),
    // never the bare base — so strip the `#N` suffix to a base id for BOTH the copy-of-copy
    // exclusion and the dedup. Without the strip the exclusion (bare COPY_POWERS_EXT_ID)
    // never matched a real instance id, so Copy Powers counted ITSELF as an eligible target
    // → the 1-eligible auto path re-fired executeHeroEffects on Copy Powers → unbounded
    // recursion → stack overflow → the server crash Jeff saw as a ~30s "connection lost —
    // reconnecting" whenever Copy Powers was the only Hero in play. The trait lookup below
    // keeps the full instance id (cardTraits is instance-keyed); only exclusion + dedup use
    // the base, and two instances of one Hero collapse to a single choice.
    const hashIndex = candidate.indexOf('#');
    const baseCandidate = hashIndex === -1 ? candidate : candidate.slice(0, hashIndex);
    if (baseCandidate === COPY_POWERS_EXT_ID) {
      continue;
    }
    if (seenBaseIds.has(baseCandidate)) {
      continue;
    }
    const traitEntry = G.cardTraits[candidate];
    if (traitEntry !== undefined && typeof traitEntry.heroClass === 'string' && traitEntry.heroClass.length > 0) {
      seenBaseIds.add(baseCandidate);
      targets.push(candidate);
    }
  }
  return targets;
}

/**
 * Applies a resolved Copy Powers copy: re-fires the chosen Hero's on-play ability and
 * grants Copy Powers the copied Hero's class.
 *
 * Used by BOTH re-fire paths — the 1-eligible in-handler auto path and the ≥2 resolve
 * move — so the copy behaves identically however it was selected.
 *
 * // why (ctx): the copied ability may draw / reshuffle, so this threads the FULL
 * move-context WRAPPER (`{ ctx, random, events, ... }`) straight into
 * executeHeroEffects — the only resolve-time re-fire in the engine that needs
 * `ctx.random`. Passing `{G, playerID}` alone (the shape other resolve moves use) would
 * crash a copied draw. executeHeroEffects is REENTRANT and visits only the chosen Hero's
 * hooks; it does NOT re-append inPlay or re-add base attack/recruit economy (Fork 2 —
 * ability only; base economy belongs to applyCardPlay, off the copy path).
 *
 * // why (dual-class): Copy Powers "is both covert and the color you copy." Covert is
 * already baked in card data (core.json `hc:covert`); this writes the copied class into
 * the EXISTING runtime `cardSizeChangingClasses` map (D-24074 reuse — no new G field), so
 * every downstream `[hc:<copied>]` gate counts Copy Powers as that class too. cardTraits
 * is never mutated. The class is granted BEFORE the re-fire so Copy Powers already counts
 * as the copied class if the copied ability itself reads classes.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param ctx - The move-context wrapper (its `.ctx` is the bare bgio ctx, `.random` the shuffle source).
 * @param playerID - The player copying (the Copy Powers owner).
 * @param sourceCardId - The Copy Powers card ext_id receiving the copied class.
 * @param chosenHeroId - The Hero whose ability is re-fired and whose class is copied.
 */
export function applyCopyPowers(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  sourceCardId: CardExtId,
  chosenHeroId: CardExtId,
): void {
  pushLog(G,
    `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, sourceCardId)} copied ${formatCardRef(G.cardDisplayData, chosenHeroId)}.`,
    'neutral',
    sourceCardId, // why: WP-438 — the Copy Powers card that produced the copy.
  );

  // Grant the copied class into the existing runtime dual-class map (D-24074 reuse).
  const copiedClass = G.cardTraits[chosenHeroId]?.heroClass;
  if (typeof copiedClass === 'string' && copiedClass.length > 0) {
    if (!G.cardSizeChangingClasses) {
      G.cardSizeChangingClasses = {};
    }
    const existingClasses = G.cardSizeChangingClasses[sourceCardId];
    if (existingClasses === undefined) {
      G.cardSizeChangingClasses[sourceCardId] = [copiedClass];
    } else if (!existingClasses.includes(copiedClass)) {
      existingClasses.push(copiedClass);
    }
  }

  // why: D-24391 — Copy Powers is a full duplicate of the copied Hero, so it adds the
  // copied card's PRINTED attack + recruit. The copied Hero was already played this turn
  // (Copy Powers copies "a Hero you played this turn"), so this is a SECOND instance — a
  // genuine duplicate legitimately DOUBLES the stat. A null-stat copied Hero adds 0/0.
  // G.cardStats is keyed by the same copy-suffixed instance ext_id as chosenHeroId.
  const copiedStats = G.cardStats[chosenHeroId];
  if (copiedStats) {
    G.turnEconomy = addResources(G.turnEconomy, copiedStats.attack, copiedStats.recruit);
    if (copiedStats.attack > 0 || copiedStats.recruit > 0) {
      pushLog(G,
        `Player ${playerID} gained +${copiedStats.attack} attack and +${copiedStats.recruit} recruit from copying ${formatCardRef(G.cardDisplayData, chosenHeroId)}.`,
        'applied',
        sourceCardId, // why: WP-582 — the Copy Powers card that produced the duplicated economy.
      );
    }
  }

  // why: D-24391 — Copy Powers counts as the copied Hero's TEAM, the runtime team-grant
  // sibling to the class grant above, via the lazy cardCopiedTeams map read by the
  // effectiveTeams.logic.ts helper. cardTraits.team is string|null — a teamless copied
  // Hero grants nothing. cardTraits is never mutated.
  const copiedTeam = G.cardTraits[chosenHeroId]?.team;
  if (typeof copiedTeam === 'string' && copiedTeam.length > 0) {
    if (!G.cardCopiedTeams) {
      G.cardCopiedTeams = {};
    }
    const existingTeams = G.cardCopiedTeams[sourceCardId];
    if (existingTeams === undefined) {
      G.cardCopiedTeams[sourceCardId] = [copiedTeam];
    } else if (!existingTeams.includes(copiedTeam)) {
      existingTeams.push(copiedTeam);
    }
  }

  // Re-fire the copied Hero's on-play ability. The count return is observability only.
  executeHeroEffects(G, ctx, playerID, chosenHeroId);
}

/**
 * Hero handler for the `copy-powers` keyword (WP-535 / D-24345).
 *
 * Rogue's "Copy Powers": "Play this card as a copy of another Hero you played this
 * turn." Builds the eligible-Hero set (the player's real in-play Heroes minus Copy
 * Powers), then resolves by cardinality:
 * 0 → a self-narrated no-op (NEVER a hollow record — the keyword is in MVP_KEYWORDS, so
 * it reached its handler); exactly 1 → auto-copy (no prompt); ≥2 → park a
 * PendingCopyPowersChoice (block-all until resolved) so the current player picks which
 * Hero to copy.
 *
 * // why (ctx): executeHeroEffects is called with the move-context WRAPPER, so this
 * handler received that same wrapper and threads it unchanged into applyCopyPowers →
 * executeHeroEffects for the auto path (the copied ability may draw via `ctx.random`).
 */
function heroEffectCopyPowers(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  const targets = buildCopyPowersTargets(G, playerID);

  // why: 0 eligible Heroes is a REACHABLE self-narrated no-op — Copy Powers was the only
  // Hero played (or only S.H.I.E.L.D./Wounds alongside it). It records NO hollow event
  // (the handler ran; the keyword is in MVP_KEYWORDS → classifyHeroEffectReason returns
  // `applied`). WP-434 — nothing happened, so the outcome is `blocked`.
  if (targets.length === 0) {
    pushLog(G,
      `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, cardId)} found no other Hero played this turn to copy.`,
      'blocked',
      cardId, // why: WP-438 — the played card whose ability found no Hero to copy.
    );
    return;
  }

  // why: exactly 1 eligible Hero → auto-copy with no prompt (mandatory-if-able). The
  // re-fire threads the same move-context wrapper this handler received.
  if (targets.length === 1) {
    applyCopyPowers(G, ctx, playerID, cardId, targets[0]!);
    return;
  }

  // why: ≥2 eligible Heroes → park a PendingCopyPowersChoice; the current player must
  // pick which Hero to copy. Lazily initialize the FIFO queue (never in Game.setup); an
  // undefined field stays out of canonical JSON, keeping the hash oracles from re-pinning.
  // Shipped WITH its UIState projection + client prompt + block-all guard
  // (pending_choice_no_ux_freeze).
  if (!G.pendingCopyPowersChoices) {
    G.pendingCopyPowersChoices = [];
  }
  G.pendingCopyPowersChoices.push({
    choiceType: 'copy-powers',
    playerID,
    sourceCardId: cardId,
  });
  // why: WP-434 — parking a mandatory choice is `neutral` (the effect is mid-flight,
  // neither applied nor blocked); the applied/blocked outcome is logged at resolve.
  pushLog(G,
    `Player ${playerID} must choose which Hero to copy with ${formatCardRef(G.cardDisplayData, cardId)}.`,
    'neutral',
    cardId, // why: WP-438 — the played card that parked the Copy Powers choice.
  );
}

/**
 * Hero handler for the `steal-abilities` keyword (WP-592 / D-24401).
 *
 * Rogue's "Steal Abilities": "Each player discards the top card of their deck. Play a
 * copy of each of those cards." Two deterministic, synchronous phases:
 *
 * 1. Discard phase — for each player in `Object.keys(G.playerZones).sort()` seat order,
 *    discard the top card of their deck to their own discard pile (reshuffling their
 *    discard into their deck first when the deck is empty, D-24285); a player with no
 *    cards anywhere discards nothing.
 * 2. Copy phase — the Steal Abilities player plays a copy of each discarded card in that
 *    order: add the card's printed `G.cardStats` attack/recruit to `G.turnEconomy`, then
 *    re-fire its on-play ability via the reentrant `executeHeroEffects`.
 *
 * A copy is EPHEMERAL — it feeds economy + re-fires the ability only. It enters no zone,
 * never calls `applyCardPlay`, never mutates `cardTraits`, and grants Steal Abilities NO
 * class/team (the deliberate D-24401 bounding — unlike Copy Powers' full-duplicate merge,
 * "a copy of each card" is not a merge into the source). The real discarded cards stay in
 * their owners' discard piles.
 *
 * Recursion guard — a discarded card whose base ext_id is `STEAL_ABILITIES_EXT_ID` OR
 * `COPY_POWERS_EXT_ID` is economy-only (NOT re-fired). Both are reentrant-copy keywords: a
 * re-fired Copy Powers auto-copies the in-play Steal Abilities card (the sole eligible Rogue
 * Hero) and re-fires it, recursing to the `COPY_POWERS_EXT_ID` stack-overflow class.
 *
 * // why (ctx): `executeHeroEffects` is called with the move-context WRAPPER, so this handler
 * received that same wrapper and threads it unchanged into every re-fire AND the reshuffle —
 * a copied draw / an empty-deck reshuffle needs `ctx.random`. Passing `{ G, playerID }` alone
 * would crash a copied draw / reshuffle.
 */
function heroEffectStealAbilities(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  // why: WP-592 / D-24401 — iterate a SORTED key order (matching gain-wound-each /
  // scoring.logic.ts) so the "each player discards" distribution replays identically, and so
  // ALL players are targeted, not just the active one. Deterministic — the only randomness is
  // an empty-deck reshuffle via the threaded ctx.random.
  const seatOrder = Object.keys(G.playerZones).sort();

  // Phase 1 — each player discards the top card of their deck.
  const discardedCardIds: CardExtId[] = [];
  for (const ownerPlayerId of seatOrder) {
    const ownerZones = G.playerZones[ownerPlayerId];
    if (!ownerZones) {
      continue;
    }
    if (ownerZones.deck.length === 0) {
      // why: D-24285 — the standard empty-deck reshuffle: when a player must discard the top
      // of an empty deck, shuffle their discard into a fresh deck first, via the threaded
      // ctx.random (ctx as ShuffleProvider, exactly as heroEffectReveal does) — never
      // Math.random(). A player whose discard is also empty stays empty (no-op).
      reshuffleDiscardIntoDeck(ownerZones, ctx as ShuffleProvider);
    }
    const topCardId = ownerZones.deck[0];
    if (!topCardId) {
      // why: D-24017 — no cards anywhere for this player is a legitimate no-op, but a silent
      // skip reads as "the card did nothing"; log it so the reason is observable.
      pushLog(G,
        `Player ${ownerPlayerId} had no card to discard for ${formatCardRef(G.cardDisplayData, cardId)}.`,
      );
      continue;
    }
    const moveResult = moveCardFromZone(ownerZones.deck, ownerZones.discard, topCardId);
    ownerZones.deck = moveResult.from;
    ownerZones.discard = moveResult.to;
    discardedCardIds.push(topCardId as CardExtId);
    pushLog(G,
      `Player ${ownerPlayerId} discarded ${formatCardRef(G.cardDisplayData, topCardId as CardExtId)} for ${formatCardRef(G.cardDisplayData, cardId)}.`,
    );
  }

  // Phase 2 — the Steal Abilities player plays a copy of each discarded card.
  for (const discardedCardId of discardedCardIds) {
    // why: D-24391 economy pattern reused WITHOUT the class/team grant — a Steal Abilities
    // copy feeds economy + re-fires the ability only (the D-24401 bounding). A null-stat
    // copied card (a Wound) adds 0/0. Written inline rather than extracted (duplicate-first,
    // code-style Rule 1 — this is only the second copy of the economy block).
    const copiedStats = G.cardStats[discardedCardId];
    if (copiedStats) {
      G.turnEconomy = addResources(G.turnEconomy, copiedStats.attack, copiedStats.recruit);
      if (copiedStats.attack > 0 || copiedStats.recruit > 0) {
        pushLog(G,
          `Player ${playerID} gained +${copiedStats.attack} attack and +${copiedStats.recruit} recruit from copying ${formatCardRef(G.cardDisplayData, discardedCardId)}.`,
          'applied',
          cardId, // why: WP-438 — the Steal Abilities card that produced the copy.
        );
      }
    }

    // why: WP-592 / D-24401 — the recursion guard. Zones store INSTANCE ids
    // (`<base>#<copyIndex>`), so strip the `#N` suffix before comparing to the base ext_ids
    // (mirrors buildCopyPowersTargets). A discarded Steal Abilities OR Copy Powers is
    // economy-only, NOT re-fired: both are reentrant-copy keywords that can re-target the
    // just-played, in-play Steal Abilities card, and re-firing them recurses to the
    // COPY_POWERS_EXT_ID stack-overflow class (the ~30s "connection lost" crash). Nothing
    // decreases monotonically (reshuffle-on-empty recycles the discards back to deck-top),
    // so excluding BOTH — not just steal-abilities — is what bounds the mutual re-fire.
    const hashIndex = discardedCardId.indexOf('#');
    const baseDiscardedId = hashIndex === -1 ? discardedCardId : discardedCardId.slice(0, hashIndex);
    if (baseDiscardedId === STEAL_ABILITIES_EXT_ID || baseDiscardedId === COPY_POWERS_EXT_ID) {
      pushLog(G,
        `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, cardId)} copied the economy of ${formatCardRef(G.cardDisplayData, discardedCardId)} but did not re-fire its ability (copy-of-copy guard).`,
        'neutral',
        cardId, // why: WP-438 — the Steal Abilities card whose copy was economy-only.
      );
      continue;
    }

    // Re-fire the discarded card's on-play ability for the Steal Abilities player. The count
    // return is observability only; the wrapper is threaded so a copied draw/reshuffle replays.
    executeHeroEffects(G, ctx, playerID, discardedCardId);
  }
}

/**
 * Hero handler for the `recruit-as-attack` keyword (WP-580 / D-24389).
 *
 * God of Thunder's "You can use Recruit as Attack this turn." Sets the
 * turn-scoped conversion flag on `G.turnEconomy`; the fight moves, the bot
 * affordability projection (`ai.legalMoves.ts`), and the UIState economy
 * projection then fund fight costs from unspent recruit (attack first). No
 * magnitude, no pending choice, no resource total moved at play time.
 */
function heroEffectRecruitAsAttack(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  G.turnEconomy = enableRecruitSpendableAsAttack(G.turnEconomy);
  // why: WP-434 — the conversion is `applied` (green): it changed turn state
  // (recruit may now fund fights) even though no resource total moved yet.
  pushLog(G,
    `Player ${playerID} can spend Recruit as Attack this turn (${formatCardRef(G.cardDisplayData, cardId)}).`,
    'applied',
    cardId, // why: WP-438.
  );
}

// ---------------------------------------------------------------------------
// Investigate handler (static-criterion + draw subset; WP-564 / D-24373)
// ---------------------------------------------------------------------------

/**
 * Investigate handler — looks at the top `investigateLookCount` (default 2) cards of the
 * acting player's own deck, draws the FIRST card in look order that matches the static
 * `investigateCriteria`, and puts the non-selected looked-at cards on the BOTTOM of the
 * deck in look order. A deck shorter than the look count reshuffles the discard via the
 * shared `reshuffleDiscardIntoDeck` helper first (D-24285). Deterministic — first-match,
 * no `ctx.random` in selection, no pending choice. All three outcomes are narrated.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param ctx - Context (narrowed to ShuffleProvider for the short-deck reshuffle).
 * @param playerID - Active player ID.
 * @param _cardId - The played hero card's CardExtId (unused; investigate reads the deck).
 * @param effect - The investigate effect descriptor (criteria + look count).
 */
function heroEffectInvestigate(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  _cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }
  const criteria = effect.investigateCriteria ?? [];
  // why: WP-564 / D-24373 — default 2 (the printed look count); the descriptor field lets
  // the deferred look-at-three modifier set it without reshaping the effect.
  const lookCount = effect.investigateLookCount ?? INVESTIGATE_HANDLER_DEFAULT_LOOK_COUNT;
  // why: defensive — the parser only emits an investigate descriptor with a resolved
  // criterion, so an empty criteria list is unreachable in practice; no-op if it happens.
  if (criteria.length === 0) {
    return;
  }
  const criterionText = describeInvestigateCriteria(criteria);

  // why: D-24285 — looking at the top of a deck shorter than the look count reshuffles the
  // discard into the deck first (the standard Legendary rule that a look/reveal, like a
  // draw, reshuffles an exhausted deck mid-effect), via the SHARED helper — never a second
  // reshuffle path. ctx narrows to ShuffleProvider exactly as the draw / reveal handlers do.
  if (playerZones.deck.length < lookCount) {
    reshuffleDiscardIntoDeck(playerZones, ctx as ShuffleProvider);
  }

  const windowSize = Math.min(lookCount, playerZones.deck.length);
  if (windowSize === 0) {
    // why: an empty deck (and discard) is a legal, narrated outcome — nothing to look at.
    pushLog(
      G,
      `Player ${playerID} Investigated for ${criterionText} but had no cards to look at.`,
      'blocked',
    );
    return;
  }

  // why: look order is top-first; the FIRST matching card (deterministic) is drawn.
  const lookWindow = playerZones.deck.slice(0, windowSize);
  let drawnCardId: CardExtId | undefined;
  for (const candidateId of lookWindow) {
    if (investigateCardMatchesCriteria(G, candidateId, criteria)) {
      drawnCardId = candidateId;
      break;
    }
  }

  if (drawnCardId !== undefined) {
    const moveResult = moveCardFromZone(playerZones.deck, playerZones.hand, drawnCardId);
    playerZones.deck = moveResult.from;
    playerZones.hand = moveResult.to;
  }

  // why: WP-564 / D-24373 — put the non-selected looked-at cards on the BOTTOM in look
  // order (look order preserved so replay is reproducible). After removing the drawn card
  // (if any) from the deck, the top `nonDrawnCount` cards are exactly the non-drawn
  // looked-at cards in look order; move that block to the bottom in one splice.
  const nonDrawnCount = windowSize - (drawnCardId !== undefined ? 1 : 0);
  const toBottom = playerZones.deck.slice(0, nonDrawnCount);
  const rest = playerZones.deck.slice(nonDrawnCount);
  playerZones.deck = [...rest, ...toBottom];

  if (drawnCardId !== undefined) {
    pushLog(
      G,
      `Player ${playerID} Investigated for ${criterionText} and drew ${formatCardRef(G.cardDisplayData, drawnCardId)}.`,
      'applied',
      drawnCardId, // why: WP-438 — the drawn card, so the diagnostic attributes the reveal to it.
    );
  } else {
    // why: naming the criterion (not a bare "nothing happened") is the WP-550 fidelity
    // precedent — a zero-match draw with no context reads as a broken card.
    pushLog(
      G,
      `Player ${playerID} Investigated for ${criterionText} but found no matching card in the top ${windowSize}; put ${windowSize === 1 ? 'it' : 'them'} on the bottom.`,
      'blocked',
    );
  }
}

// why: WP-564 / D-24373 — the printed default look count, mirrored here from the setup
// parser's INVESTIGATE_DEFAULT_LOOK_COUNT (duplicate-first — two files, one value; a third
// appearance would justify extracting a shared const).
const INVESTIGATE_HANDLER_DEFAULT_LOOK_COUNT = 2;

/**
 * Reveal-from-hand → draw (WP-659 / D-24470). Psychic Link's "Each player may reveal
 * another [team]/[hc] Hero. Each player who does draws a card."
 *
 * For every player in deterministic seat order (`Object.keys(G.playerZones).sort()` — the
 * gain-wound-each / steal-abilities precedent), if that player's hand holds a card matching
 * the reveal criterion, they draw one card. The printed "may" is auto-taken: revealing costs
 * nothing and yields a draw, so declining is strictly dominated — no pending-choice park
 * (D-24470). Reveal is state-neutral (the matched card STAYS in hand — the only mutation is
 * the draw). "another" needs no self-exclusion — the played card has already left the hand.
 *
 * Deterministic: fixed seat order; the draw reshuffles the discard through the single
 * `ctx.random` shuffle envelope on an empty deck (drawFromPlayerDeck). Never throws — an
 * empty hand or a no-match player is simply skipped.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param ctx - Context narrowed to ShuffleProvider for the draw reshuffle.
 * @param _playerID - The playing player (unused — the effect touches every player).
 * @param cardId - The played card (for the log reference).
 * @param effect - The effect descriptor carrying the single revealCriterion.
 */
function heroEffectRevealFromHand(
  G: LegendaryGameState,
  ctx: unknown,
  _playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): void {
  const criterion = effect.revealCriterion;
  // why: defensive — the parser only emits a reveal-from-hand effect once its criterion
  // resolves (the Honest-Partial branch); a criterion-less effect is unreachable, no-op here.
  if (criterion === undefined) {
    return;
  }
  for (const eachPlayerId of Object.keys(G.playerZones).sort()) {
    const playerZones = G.playerZones[eachPlayerId];
    if (!playerZones) {
      continue;
    }
    let handHasMatch = false;
    for (const handCardId of playerZones.hand) {
      // why: reuse investigateCardMatchesCriteria (zone-agnostic — projects the card's
      // stats/traits and matches) with the single criterion wrapped in a 1-element list, the
      // OR-combined form the shared matcher takes.
      if (investigateCardMatchesCriteria(G, handCardId, [criterion])) {
        handHasMatch = true;
        break;
      }
    }
    if (!handHasMatch) {
      continue;
    }
    const drawnCount = drawFromPlayerDeck(G, eachPlayerId, 1, ctx as ShuffleProvider);
    if (drawnCount > 0) {
      pushLog(G,
        `Player ${eachPlayerId} revealed a matching Hero for ${formatCardRef(G.cardDisplayData, cardId)} and drew a card.`,
        'applied',
        cardId, // why: WP-438 — attribute the reveal-draw to the played card.
      );
    } else {
      // why: WP-434 — a match with an empty deck AND discard is `partial` (the ability fired,
      // the source ran dry) — distinct from a no-match player, who is silently skipped.
      pushLog(G,
        `Player ${eachPlayerId} revealed a matching Hero for ${formatCardRef(G.cardDisplayData, cardId)} but their deck and discard pile were empty.`,
        'partial',
        cardId,
      );
    }
  }
}

/**
 * Returns whether a deck card matches an investigate criterion list, projecting the card's
 * runtime facts from `G.cardStats` (icon / cost) and `G.cardTraits` (hero-class / team).
 * A card with no stat / trait entry yields `undefined` for the missing facts, so the
 * criteria needing them do not match (no draw on a fabricated 0) — mirroring the reveal
 * handler's skip-a-no-stats-card posture.
 *
 * @param G - Game state (read-only).
 * @param cardId - The deck card to evaluate.
 * @param criteria - The effect's static criteria (INCLUSIVE OR).
 * @returns Whether the card satisfies at least one criterion.
 */
function investigateCardMatchesCriteria(
  G: LegendaryGameState,
  cardId: CardExtId,
  criteria: InvestigateCriterion[],
): boolean {
  const stats = G.cardStats[cardId];
  const traits = G.cardTraits ? G.cardTraits[cardId] : undefined;
  const candidate: InvestigateCandidate = {
    attack: stats?.attack,
    recruit: stats?.recruit,
    cost: stats?.cost,
    heroClass: traits?.heroClass,
    team: traits?.team,
  };
  return investigateCandidateMatches(criteria, candidate);
}

/**
 * Builds the player-facing criterion phrase for an investigate log line (e.g. "a card with
 * an attack icon", "a card that costs 3 or less", "a strength card or an x-factor-
 * investigations card"). Multiple criteria are joined with " or " (the printed inclusive OR).
 *
 * @param criteria - The effect's static criteria.
 * @returns The criterion phrase for the log line.
 */
function describeInvestigateCriteria(criteria: InvestigateCriterion[]): string {
  const parts: string[] = [];
  for (const criterion of criteria) {
    parts.push(describeInvestigateCriterion(criterion));
  }
  return parts.join(' or ');
}

/**
 * Describes a single investigate criterion in player-facing English.
 *
 * @param criterion - The criterion to describe.
 * @returns The criterion phrase.
 */
function describeInvestigateCriterion(criterion: InvestigateCriterion): string {
  if (criterion.kind === 'icon') {
    return criterion.icon === 'attack' ? 'a card with an attack icon' : 'a card with a recruit icon';
  }
  if (criterion.kind === 'cost') {
    if (criterion.comparison === 'eq') {
      return `a card that costs ${criterion.value}`;
    }
    if (criterion.comparison === 'lte') {
      return `a card that costs ${criterion.value} or less`;
    }
    return `a card that costs ${criterion.value} or more`;
  }
  if (criterion.kind === 'hero-class') {
    return `a ${criterion.heroClass} card`;
  }
  return `a ${criterion.team} card`;
}

/**
 * Hero handler for the `transform` keyword (WP-658 / D-24469).
 *
 * She-Hulk's "[keyword:Transform] this into Hurl Trucks" (the wwhk mechanic): swaps
 * the played base card for its stronger second-form, pulled out of the G.transformDeck
 * side deck (D-24468). The condition gate ("made ≥6 Recruit this turn") is the shipped
 * recruit-threshold condition (D-24354), evaluated by evaluateAllConditions BEFORE this
 * handler runs — so this handler only executes when the gate passed.
 *
 * Placement (Jeff-confirmed permanent-upgrade rule): the second-form leaves the side
 * deck and enters play in the base card's slot; the base card goes BACK to the side
 * deck (set aside). The second-form then follows the normal played-card cleanup to the
 * discard pile, so it cycles through the player's deck henceforth — a permanent deck
 * upgrade, with no net card gained (the base leaves the deck as the second-form joins it).
 *
 * Applies the second-form's printed attack/recruit (playing a card applies its printed
 * icons imperatively — applyCardPlay — and the transform makes the second-form the card
 * now in play). The base's already-applied recruit is NOT refunded — you keep the recruit
 * you made to meet the gate.
 *
 * why (deferred, Honest-Partial): the second-form's OWN ability hooks are not re-fired
 * here. Hurl Trucks' only ability is `[keyword:Smash]`, a keyword unsupported engine-wide,
 * so firing it would add nothing but a hollow record; when a future transform target
 * carries a supported onPlay ability, a follow-up can re-fire via the copy-powers
 * reentrant executeHeroEffects pattern.
 *
 * Soft no-op (AC-5): if the side deck holds no matching second-form copy (multi-player
 * contention exhausted it), the transform does not happen — logged, base stays in play,
 * never a throw (moves never throw).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param _ctx - Move context (unused — the swap needs no randomness/reshuffle).
 * @param playerID - Active player ID.
 * @param cardId - The played base card's CardExtId (e.g. `wwhk/she-hulk/hurl-legal-objections#3`).
 * @param _effect - The `{ type: 'transform' }` descriptor (no parameters).
 */
function heroEffectTransform(
  G: LegendaryGameState,
  _ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  _effect: HeroEffectDescriptor,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }

  // why: guard against G states that predate WP-658 (older test mocks with no
  // transformTargets / transformDeck). A real match always seeds both at setup;
  // an absent map/side deck is a silent no-op, never a throw (mirrors the
  // executeHeroEffects heroAbilityHooks guard).
  if (!G.transformTargets || !G.transformDeck) {
    return;
  }

  // why: strip the `#copy` suffix so the played base instance ext_id
  // (`wwhk/she-hulk/hurl-legal-objections#3`) resolves to the copy-agnostic card
  // key (`wwhk/she-hulk/hurl-legal-objections`) buildTransformTargets stored.
  const hashIndex = cardId.indexOf('#');
  const baseKey = (hashIndex === -1 ? cardId : cardId.slice(0, hashIndex)) as CardExtId;
  const targetKey = G.transformTargets[baseKey];
  if (targetKey === undefined) {
    // why: defensive — the setup parser only emits an executable transform for a
    // SUPPORTED_TRANSFORM_BASES card, every one of which is in transformTargets, so a
    // missing key is unreachable in practice. A silent no-op, never a throw.
    return;
  }

  // why: find the FIRST matching second-form copy still in the side deck. Instance
  // ids are `{targetKey}#{copy}`; the appended `#` stops a target key prefix-matching
  // a longer sibling slug. Front-of-zone, deterministic — no ctx.random.
  const targetPrefix = `${targetKey}#`;
  let targetInstanceId: CardExtId | undefined;
  for (const sideDeckId of G.transformDeck) {
    if (sideDeckId.startsWith(targetPrefix)) {
      targetInstanceId = sideDeckId;
      break;
    }
  }
  if (targetInstanceId === undefined) {
    // why: AC-5 — the side deck ran out of this second-form copy (multi-player
    // contention). The transform simply does not happen: log and continue. WP-434 —
    // nothing happened, so the outcome is `blocked`.
    pushLog(G,
      `Player ${playerID} could not Transform ${formatCardRef(G.cardDisplayData, cardId)} — no matching second-form copy remained in the transform side deck.`,
      'blocked',
      cardId, // why: WP-438 — the played base card whose transform could not resolve.
    );
    return;
  }

  // Route the base card back to the side deck (set aside): a permanent deck upgrade —
  // the player's deck loses the base as it gains the second-form, no net card change.
  const baseMove = moveCardFromZone(playerZones.inPlay, G.transformDeck, cardId);
  playerZones.inPlay = baseMove.from;
  G.transformDeck = baseMove.to;

  // Bring the second-form into play in the base card's slot.
  const targetMove = moveCardFromZone(G.transformDeck, playerZones.inPlay, targetInstanceId);
  G.transformDeck = targetMove.from;
  playerZones.inPlay = targetMove.to;

  // why: apply the second-form's printed attack/recruit — the transform makes it the
  // card now in play, and printed icons are applied imperatively at play time
  // (applyCardPlay). The base's already-applied recruit is intentionally NOT refunded.
  const targetStats = G.cardStats[targetInstanceId];
  const targetAttack = targetStats ? targetStats.attack : 0;
  const targetRecruit = targetStats ? targetStats.recruit : 0;
  G.turnEconomy = addResources(G.turnEconomy, targetAttack, targetRecruit);

  // why: WP-434 — a completed transform that applied the second-form is `applied` (green).
  pushLog(G,
    `Player ${playerID} Transformed ${formatCardRef(G.cardDisplayData, cardId)} into ${formatCardRef(G.cardDisplayData, targetInstanceId)}${formatTransformEconomyClause(targetAttack, targetRecruit)}.`,
    'applied',
    targetInstanceId, // why: WP-438 — the second-form now in play is the play identity the log associates.
  );

  // why: WP-672 / D-24487 — emit the transformResolved notable event LAST (after the
  // swap settled and the applied log pushed), observing final state — the healWounds /
  // bystanderRevealed emission precedent. G.messages is not projected to clients, so this
  // event is what drives the arena-client "Transformed!" overlay + the transform VFX beat.
  // Names resolve HERE via G.cardDisplayData (the composer stays pure), with a defensive
  // raw-ext_id fallback when display data is absent (legacy test states may omit it).
  // Guarded push: the minimal heroEffects test builder omits G.notableEvents; a real match
  // always seeds it at setup ([] in buildInitialGameState). Handlers never throw, so an
  // absent array is a silent skip, mirroring the transformTargets / transformDeck guards.
  if (Array.isArray(G.notableEvents)) {
    const baseName = resolveTransformCardName(G, cardId);
    const secondFormName = resolveTransformCardName(G, targetInstanceId);
    G.notableEvents.push({
      type: 'transformResolved',
      playerId: playerID,
      narrative: composeTransformNarrative(baseName, secondFormName),
    });
  }
}

/**
 * Resolves a card's display name from `G.cardDisplayData` for the transform
 * narrative, falling back to the raw ext_id when no display entry exists (WP-672).
 * Mirrors the `villainDeck.reveal.ts` bystanderRevealed name-resolution so the
 * `composeTransformNarrative` composer keeps its no-`G` purity.
 *
 * @param G - Game state (read-only here).
 * @param cardId - The card ext_id to resolve to a display name.
 * @returns The card's display name, or the raw ext_id when display data is absent.
 */
function resolveTransformCardName(G: LegendaryGameState, cardId: CardExtId): string {
  const display = G.cardDisplayData?.[cardId];
  if (display && typeof display.name === 'string' && display.name.length > 0) {
    return display.name;
  }
  return cardId;
}

/**
 * Builds the trailing " (+N attack, +M recruit)" clause for a transform log line,
 * omitting either half that is zero and the whole clause when the second-form has no
 * printed economy (WP-658 / D-24469). Mirrors the intent of formatBaseEconomyClause but
 * is local to keep heroEffects.execute.ts free of a moves-layer import (avoids a cycle).
 *
 * @param attack - The second-form's printed attack (>= 0).
 * @param recruit - The second-form's printed recruit (>= 0).
 * @returns The clause including a leading space, or an empty string when both are zero.
 */
function formatTransformEconomyClause(attack: number, recruit: number): string {
  const parts: string[] = [];
  if (attack > 0) {
    parts.push(`+${attack} attack`);
  }
  if (recruit > 0) {
    parts.push(`+${recruit} recruit`);
  }
  if (parts.length === 0) {
    return '';
  }
  return ` (${parts.join(', ')})`;
}

export const HERO_EFFECT_HANDLERS: Partial<Record<HeroKeyword, HeroEffectHandler>> = {
  draw: heroEffectDraw,
  attack: heroEffectAttack,
  recruit: heroEffectRecruit,
  ko: heroEffectKo,
  rescue: heroEffectRescue,
  reveal: heroEffectReveal,
  'attack-per-count': heroEffectAttackPerCount,
  'recruit-per-count': heroEffectRecruitPerCount,
  'optional-ko-reward': heroEffectOptionalKoReward,
  'optional-ko-hand-discard': heroEffectOptionalKoHandDiscard,
  'ko-wound-reward': heroEffectKoWoundReward,
  'optional-put-bottom-hq': heroEffectOptionalPutBottomHq,
  'put-any-number-bottom-hq': heroEffectPutAnyNumberBottomHq,
  'put-bottom-hq-icon-reward': heroEffectPutBottomHqIconReward,
  'victory-villain-attack': heroEffectVictoryVillainAttack,
  'draw-or-empowered': heroEffectDrawOrEmpowered,
  'count-scaled-choose': heroEffectCountScaledChoose,
  'return-zero-cost-discard': heroEffectReturnZeroCostDiscard,
  'discard-to-play': heroEffectDiscardToPlay,
  // why: D-24156 — one shared handler under both keys; it branches on effect.type
  // (self = active player, each = every player).
  'gain-wound-self': heroEffectGainWound,
  'gain-wound-each': heroEffectGainWound,
  'shuffle-discard-empty-reward': heroEffectShuffleDiscardEmptyReward,
  // why: WP-486 / D-24291 — Silent Sniper's "Defeat a Villain or Mastermind that
  // has a Bystander." (defeats one eligible target via the shared fight-defeat core,
  // or parks a PendingDefeatChoice when ≥2 qualify).
  'defeat-with-bystander': heroEffectDefeatWithBystander,
  // why: WP-535 / D-24345 — Rogue's Copy Powers "Play this card as a copy of another
  // Hero you played this turn." (re-fires the chosen Hero's ability + grants the copied
  // class, or parks a PendingCopyPowersChoice when ≥2 Heroes qualify).
  'copy-powers': heroEffectCopyPowers,
  // why: WP-580 / D-24389 — God of Thunder's "You can use Recruit as Attack this turn."
  // (sets the turn-scoped conversion flag; fights then draw on unspent recruit).
  'recruit-as-attack': heroEffectRecruitAsAttack,
  // why: WP-592 / D-24401 — Rogue's Steal Abilities "Each player discards the top card of
  // their deck. Play a copy of each of those cards." (each player discards their deck top,
  // then the Steal Abilities player copies each = economy + reentrant executeHeroEffects
  // re-fire; recursion guard excludes a discarded steal-abilities OR copy-powers).
  'steal-abilities': heroEffectStealAbilities,
  // why: WP-564 / D-24373 — "Investigate for <criterion>" (static-criterion + draw): looks
  // at the top N, draws the first matching card in look order, bottoms the rest.
  investigate: heroEffectInvestigate,
  // why: WP-658 / D-24469 — "[keyword:Transform] this into <second-form>" (wwhk): pulls the
  // matching second-form out of G.transformDeck into play, routes the base card back to the
  // side deck (permanent upgrade), and applies the second-form's printed attack/recruit.
  transform: heroEffectTransform,
  // why: WP-659 / D-24470 — "Each player may reveal another [team]/[hc] Hero. Each player who
  // does draws a card." (Psychic Link): each player holding a criterion-matching Hero in hand
  // draws 1 (auto-reveal, seat order). The co-located token is captured as the reveal
  // criterion at setup, not read as a play-gate.
  'reveal-from-hand': heroEffectRevealFromHand,
  // why: WP-663 / D-24474 — Shadowed Thoughts' "You may play the top Villain-Deck card →
  // +2 Attack": parks a PendingPlayVillainTopChoice resolved by resolvePlayVillainTopChoice.
  'optional-play-villain-top': heroEffectOptionalPlayVillainTop,
  // why: WP-668 / D-24481 — Jade Giantess' "For every 2 Recruit you made this turn,
  // Reveal the top card of the Hero Deck, put it on the bottom of that deck, and you
  // get that card's printed Attack": a synchronous count-scaled reveal — floor(recruit
  // / divisor) reveals of G.heroDeck[0], each granting its printed attack and rotating
  // to the bottom. No pending choice; magnitude carries the divisor.
  'reveal-herodeck-attack': heroEffectRevealHeroDeckAttack,
  // why: WP-676 / D-24492 — the Smash keyword ("you may discard another card from your
  // hand; if you do, +N attack"): parks a PendingSmashDiscard resolved by
  // resolveSmashDiscard (discard a hand card for +magnitude Attack, or decline).
  smash: heroEffectSmash,
  // why: WP-678 / D-24494 (supersedes D-24060) — the two Undercover source-shape effects
  // send a card to the Victory Pile (worth 1 VP). 'undercover-hand-shield-hero' auto-sends /
  // parks a PendingUndercoverChoice (≥2 eligible); 'undercover-officer-stack' is deterministic.
  'undercover-hand-shield-hero': heroEffectUndercoverHandShieldHero,
  'undercover-officer-stack': heroEffectUndercoverOfficerStack,
};

// ---------------------------------------------------------------------------
// Single effect dispatch
// ---------------------------------------------------------------------------

/**
 * Executes a single hero effect descriptor.
 *
 * Validates magnitude, checks keyword support, then dispatches to the
 * registered handler in HERO_EFFECT_HANDLERS. Returns without mutation for
 * unsupported keywords or invalid magnitudes.
 *
 * // why: WP-409 / D-24221 — returns whether the effect FIRED (reached its
 * // HERO_EFFECT_HANDLERS dispatch). `false` on any safe skip (unsupported
 * // keyword, invalid magnitude, or the unreachable undefined-handler guard);
 * // `true` after the handler runs. executeHeroEffects tallies these into the
 * // observability-only lastPlayEffectsFired count. Existing callers that ignore
 * // the return are unaffected (void -> boolean is backward-compatible).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param ctx - Context (narrowed to ShuffleProvider for draw).
 * @param playerID - Active player ID.
 * @param cardId - The played hero card's CardExtId.
 * @param effect - The effect descriptor to execute.
 * @returns `true` if the effect reached its handler and fired; `false` if safe-skipped.
 */
// why: D-24019 — exported so resolveOptionalKoReward can dispatch the reward to
// the existing executor (rescue / draw / attack / recruit) instead of
// re-implementing it. The KO-then-reward path passes a synthesized
// { type: rewardType, magnitude: rewardMagnitude } descriptor.
export function executeSingleEffect(
  G: LegendaryGameState,
  ctx: unknown,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): boolean {
  const keyword = effect.type;

  // why: unsupported keywords are safely ignored in MVP. Only the keywords in
  // MVP_KEYWORDS execute; 'wound' and 'conditional' are deferred.
  if (!MVP_KEYWORDS.has(keyword)) {
    return false;
  }

  // why: 'ko' and NO_MAGNITUDE_KEYWORDS members ('rescue', 'reveal') bypass the
  // pre-check magnitude gate — 'ko' targets the played card (no magnitude), 'rescue'
  // defaults its magnitude to 1, and 'reveal' moves ALL its magnitude gating into the
  // translation (revealRulesForLegacyKeyword) + the per-rule predicates, so the
  // no-magnitude and M=0-valid reveals still fire (D-24024 / pre-flight PS-1). Every
  // other MVP keyword requires a valid magnitude here.
  if (keyword !== 'ko' && !NO_MAGNITUDE_KEYWORDS.has(keyword)) {
    if (!isValidMagnitude(effect.magnitude)) {
      return false;
    }
  }

  // why: data-driven dispatch (WP-251 / D-24022). An undefined handler reproduces
  // the former `default` arm exactly — a silent skip with no throw. Because the
  // pre-gate above already filters to MVP_KEYWORDS and the drift test pins the
  // registry keys == MVP_KEYWORDS, this branch is unreachable in practice.
  const handler = HERO_EFFECT_HANDLERS[keyword];
  if (handler === undefined) {
    return false;
  }
  handler(G, ctx, playerID, cardId, effect);
  return true;
}

// ---------------------------------------------------------------------------
// Deterministic bot/sim default for an optional-KO-reward choice (WP-248)
// ---------------------------------------------------------------------------

/**
 * A single optional-KO-reward default target: the zone and the card ext_id.
 *
 * The zone union is discard | hand | inPlay (D-24442 widened the KO source to
 * include cards played this turn). The bot reaches an `inPlay` target ONLY via
 * the empty-hand+discard fallback in selectDefaultOptionalKoTarget below.
 */
export interface OptionalKoTarget {
  zone: 'discard' | 'hand' | 'inPlay';
  cardId: CardExtId;
}

/**
 * Selects the card the deterministic bot/sim KOs when an optional-KO-reward
 * choice is pending.
 *
 * Tie-break ORDER (D-24019, extended by D-24442 — its OWN policy, NOT a reuse of
 * WP-242's selectDefaultKoTarget; it does not exclude wounds and does not prefer
 * S.H.I.E.L.D. cards): (1) lowest cost; then (2) discard-zone before hand-zone;
 * then (3) lowest array index within the chosen zone. ANY card is eligible
 * (the printed text says "a card", not "a Hero").
 *
 * why: D-24442 — `inPlay` (cards played this turn) is a valid KO source, but the
 * bot scans it ONLY as a last-resort fallback when hand AND discard are both
 * empty. This is the determinism keystone: every choice that parked under the
 * pre-D-24442 code did so because hand ∪ discard was non-empty, so the discard→
 * hand scan below returns the identical card for every recorded choice — pinned
 * hashes stay byte-stable. The inPlay branch only fires in the new empty-hand+
 * discard park (e.g. after a within-turn reshuffle), which no pre-D-24442 game
 * reached.
 *
 * The bot ALWAYS returns a target and NEVER declines — decline is a human-only
 * option. Returns null only when all three zones are empty (an engine-invariant
 * violation while a choice is pending, since the park requires ≥1 eligible card
 * and the block-all guard freezes the board).
 *
 * @param zones - The player's card zones (discard + hand first; inPlay only as
 *   the empty-hand+discard fallback).
 * @param cardStats - Card stat lookup for the cost tie-break (?.cost ?? 0).
 * @returns The default KO target, or null when all three zones are empty.
 */
export function selectDefaultOptionalKoTarget(
  zones: PlayerZones,
  cardStats: Record<CardExtId, CardStatEntry>,
): OptionalKoTarget | null {
  // why: iterate discard fully (index ascending) then hand (index ascending),
  // replacing the candidate ONLY on a STRICTLY lower cost. Because the scan
  // order is discard-before-hand and lowest-index-first, the retained candidate
  // for the minimum cost is automatically the discard-before-hand, lowest-index
  // one — exactly the locked tie-break, without an explicit rank comparison.
  // This block is byte-identical to the pre-D-24442 scan (pick preservation).
  let bestZone: 'discard' | 'hand' | null = null;
  let bestCardId: CardExtId | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  const orderedZones: ('discard' | 'hand')[] = ['discard', 'hand'];
  for (const zoneName of orderedZones) {
    const zoneArray = zones[zoneName];
    for (let cardIndex = 0; cardIndex < zoneArray.length; cardIndex++) {
      const cardId = zoneArray[cardIndex]!;
      const cost = cardStats[cardId]?.cost ?? 0;
      if (cost < bestCost) {
        bestCost = cost;
        bestZone = zoneName;
        bestCardId = cardId;
      }
    }
  }
  if (bestZone !== null && bestCardId !== null) {
    return { zone: bestZone, cardId: bestCardId };
  }

  // why: D-24442 fallback — hand AND discard are both empty, so scan inPlay
  // (lowest cost, then lowest index). Reached only in the new empty-hand+discard
  // park, so it never perturbs a pre-D-24442 recorded pick.
  let fallbackCardId: CardExtId | null = null;
  let fallbackCost = Number.POSITIVE_INFINITY;
  for (let cardIndex = 0; cardIndex < zones.inPlay.length; cardIndex++) {
    const cardId = zones.inPlay[cardIndex]!;
    const cost = cardStats[cardId]?.cost ?? 0;
    if (cost < fallbackCost) {
      fallbackCost = cost;
      fallbackCardId = cardId;
    }
  }
  if (fallbackCardId !== null) {
    return { zone: 'inPlay', cardId: fallbackCardId };
  }
  return null;
}

/**
 * Selects the hand card the deterministic bot/sim discards when a Smash choice is
 * pending (WP-676 / D-24492).
 *
 * Tie-break ORDER: (1) lowest `cost`; then (2) lowest `CardExtId` (ascending
 * string compare). Only the HAND is eligible ("discard another card from your
 * hand"), so — unlike selectDefaultOptionalKoTarget — there is no discard/inPlay
 * scan. The bot ALWAYS discards when the hand is non-empty and NEVER declines
 * (decline is a human-only option; +N Attack is strictly beneficial to a bot with
 * cards to spare), returning null ONLY when the hand is empty — in which case the
 * caller declines. This is deterministic and replay-faithful (no RNG).
 *
 * @param G - The game state to read (not mutated).
 * @param playerID - The choosing player whose hand is scanned.
 * @returns The CardExtId to discard, or null when the hand is empty (→ decline).
 */
export function selectDefaultSmashDiscardTarget(
  G: LegendaryGameState,
  playerID: string,
): CardExtId | null {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return null; }
  // why: scan the hand once, replacing the candidate on a strictly lower cost, or on
  // an equal cost with a strictly lower CardExtId (the ascending-string tie-break). An
  // explicit for loop, never .reduce() (effect/selection code, code-style §Patterns).
  let bestCardId: CardExtId | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (const cardId of playerZones.hand) {
    const cost = G.cardStats[cardId]?.cost ?? 0;
    if (
      cost < bestCost ||
      (cost === bestCost && bestCardId !== null && cardId < bestCardId)
    ) {
      bestCost = cost;
      bestCardId = cardId;
    }
  }
  return bestCardId;
}

/**
 * Re-checks every deferred conditional grant and fires those now satisfied.
 *
 * why: WP-568 / D-24377 — invoked from the play-phase `turn.onMove` hook, the same
 * per-move cadence `latchFinalTurnIfDeckExhausted` and
 * `applyPileDepletionResourceLoss` already use: it observes the state each move
 * leaves behind, which is exactly when a recruit total can cross a threshold.
 *
 * An entry fires through `runHookEffects` — the same dispatch path the immediate
 * play uses — and is removed as it fires, so a threshold crossed, dropped and
 * re-crossed within one turn grants EXACTLY ONCE.
 *
 * @param G - The game state, mutated in place.
 * @param ctx - Move context (carries `random` for draws/reveals).
 */
export function resolveDeferredHeroGrants(
  G: LegendaryGameState,
  ctx: unknown,
): void {
  // why: derive the turn through readTurnNumber, the same narrowing
  // executeHeroEffects uses - it returns 0 rather than throwing when a
  // hand-built context omits the nested ctx, keeping the never-throw contract.
  const turn = readTurnNumber(ctx);
  if (!G.heroAbilityHooks) {
    return;
  }

  resolveDeferredConditionalGrants(
    G,
    (entry) => {
      const hook = G.heroAbilityHooks[entry.hookIndex];
      if (hook === undefined) {
        return false;
      }
      // why: re-evaluate ALL of the hook's conditions, not just the deferred one —
      // a hook can carry an out-of-scope gate too, and it must still hold at the
      // moment the effect actually applies.
      return evaluateAllConditions(G, entry.playerId, hook.conditions, entry.cardId);
    },
    (entry) => {
      const hook = G.heroAbilityHooks[entry.hookIndex];
      if (hook === undefined) {
        return;
      }
      // why: WP-656 / D-24467 log-polish — runHookEffects already emits the concrete
      // grant line ("… gained +N recruit from <card>"), so a separate "ability applied —
      // its condition was met later this turn" confirmation was pure duplication (two lines
      // per grant; a multi-copy Diamond Form turn logged a wall of them). The grant line is
      // self-sufficient — the on-play "… is waiting …" line already told the player the
      // ability was deferred — so the confirmation is dropped.
      runHookEffects(G, ctx, entry.playerId, entry.cardId, hook, turn);
      // why: WP-656 / D-24467 — a defeat-gated grant (Diamond Form) is EDGE-TRIGGERED
      // per defeat, not one-shot. resolveDeferredConditionalGrants removed this entry
      // as it fired (the numeric-threshold one-shot contract, unchanged); RE-ARM it by
      // re-recording so it survives to credit the NEXT Villain/Mastermind defeat this
      // turn. This uses the documented "a fire callback that defers a new grant appends
      // to the surviving list" support. Over-fire on non-defeat moves is prevented not
      // by removal but by the edge flag being consumed below — a re-armed grant reads a
      // cleared flag and stays put. The turn boundary drops it (clearDeferredConditionalGrants).
      if (hookHasRepeatableDefeatCondition(hook)) {
        recordDeferredConditionalGrant(G, entry.playerId, entry.cardId, entry.hookIndex);
      }
    },
  );

  // why: WP-656 / D-24467 — consume the per-move defeat EDGE. The fight sites set
  // G.villainOrMastermindDefeatedSinceResolve (gated on a pending grant) and the
  // `defeatedVillainOrMastermindThisTurn` condition read it above; deleting it after
  // this move's resolution makes the grant fire exactly once per defeat and never on a
  // subsequent non-defeat move (the resolution runs after EVERY play-phase move). The
  // guarded delete is a no-op when unset, so a game with no such grant is byte-unchanged.
  if (G.villainOrMastermindDefeatedSinceResolve !== undefined) {
    delete G.villainOrMastermindDefeatedSinceResolve;
  }
}

/**
 * Reports whether a hook carries the edge-triggered defeat condition (Diamond Form),
 * so its fired grant is re-armed rather than left one-shot (WP-656 / D-24467).
 *
 * @param hook - The deferred grant's hook.
 * @returns True when a condition of type REPEATABLE_DEFEAT_CONDITION_TYPE is present.
 */
function hookHasRepeatableDefeatCondition(hook: HeroAbilityHook): boolean {
  if (hook.conditions === undefined) {
    return false;
  }
  for (const condition of hook.conditions) {
    if (condition.type === REPEATABLE_DEFEAT_CONDITION_TYPE) {
      return true;
    }
  }
  return false;
}
