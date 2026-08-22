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

import type { LegendaryGameState, PendingHeroChoice } from '../types.js';
import type { CardExtId, PlayerZones } from '../state/zones.types.js';
import type { CardStatEntry } from '../economy/economy.types.js';
import type { HeroKeyword } from '../rules/heroKeywords.js';
import { HERO_KEYWORDS } from '../rules/heroKeywords.js';
import type { HeroAbilityHook, HeroEffectDescriptor } from '../rules/heroAbility.types.js';
import { getHooksForCard } from '../rules/heroAbility.types.js';
import type { EffectExecutionReason, EffectTrace } from '../diagnostics/hollowEffect.types.js';
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
  'draw', 'attack', 'recruit', 'ko', 'rescue', 'reveal', 'attack-per-count', 'optional-ko-reward', 'optional-put-bottom-hq', 'put-any-number-bottom-hq', 'put-bottom-hq-icon-reward', 'victory-villain-attack', 'draw-or-empowered', 'return-zero-cost-discard',
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

// why: D-24060 / WP-282 — undercover executes from the sendUndercover + playFromUndercover
// MOVES (the player sends a card face-down, then later plays it from face-down state), so —
// like wall-crawl and dodge — it has NO HERO_EFFECT_HANDLERS entry and is NOT in
// HANDLED_KEYWORDS. It still joins MVP_KEYWORDS via this face-down-action category for two
// load-bearing reasons: (a) the hero mechanic ledger classifies an MVP_KEYWORDS member
// `executable`; (b) classifyHeroEffectReason returns `applied` for it, so the onPlay hook
// that executeHeroEffects visits at PLAY time (it does not filter by timing) classifies
// not-hollow instead of firing a `no-handler` hollow — without this membership the
// now-recognized keyword would trade the old parse-unrecognized hollow for a fresh
// no-handler one (a regression). Kept a SEPARATE set from RECRUIT_TIME_EXECUTED_KEYWORDS /
// HAND_ACTION_EXECUTED_KEYWORDS (duplicate-first per §16.1 — the three categories execute
// at different times and a premature merge would blur that); NOT added to HANDLED_KEYWORDS
// (that demands a handler and would break the HERO_EFFECT_HANDLERS-keys ↔ HANDLED_KEYWORDS
// bidirectional test).
export const FACE_DOWN_EXECUTED_KEYWORDS: readonly HeroKeyword[] = ['undercover'];

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
  ...FACE_DOWN_EXECUTED_KEYWORDS,
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
  return {
    cardId,
    scope: 'hero',
    timing,
    effect: effectToken,
    handler: fired ? effectToken : '',
    status: fired ? 'fired' : 'no-handler',
    fireSite: 'hero-executor',
    params: buildHeroEffectTraceParams(effect),
    turn,
  };
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
  _cardId: CardExtId,
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
  const count = resolveCountSource(G, playerID, effect.countSource);
  const grant = (effect.magnitude as number) * count;
  G.turnEconomy = addResources(G.turnEconomy, grant, 0);
  // why: record the source, count, and grant so the count-scaled attack is
  // observable in replay inspection (no implicit side effects).
  pushLog(G, `Count-scaled attack: +${grant} (${effect.magnitude as number} per ${effect.countSource}, count ${count}).`);
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
  const eligibleCount = playerZones.discard.length + playerZones.hand.length;
  if (eligibleCount === 0) {
    pushLog(G, 
      `Player ${playerID} could not KO a card for a hero ability — both hand and discard pile are empty, so no reward was granted.`,
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

export const HERO_EFFECT_HANDLERS: Partial<Record<HeroKeyword, HeroEffectHandler>> = {
  draw: heroEffectDraw,
  attack: heroEffectAttack,
  recruit: heroEffectRecruit,
  ko: heroEffectKo,
  rescue: heroEffectRescue,
  reveal: heroEffectReveal,
  'attack-per-count': heroEffectAttackPerCount,
  'optional-ko-reward': heroEffectOptionalKoReward,
  'ko-wound-reward': heroEffectKoWoundReward,
  'optional-put-bottom-hq': heroEffectOptionalPutBottomHq,
  'put-any-number-bottom-hq': heroEffectPutAnyNumberBottomHq,
  'put-bottom-hq-icon-reward': heroEffectPutBottomHqIconReward,
  'victory-villain-attack': heroEffectVictoryVillainAttack,
  'draw-or-empowered': heroEffectDrawOrEmpowered,
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
 * Unlike WP-242's KoHeroTarget, the zone union is only discard | hand — the
 * optional-ko-reward effect KOs from hand or discard, never inPlay.
 */
export interface OptionalKoTarget {
  zone: 'discard' | 'hand';
  cardId: CardExtId;
}

/**
 * Selects the card the deterministic bot/sim KOs when an optional-KO-reward
 * choice is pending.
 *
 * Tie-break ORDER (D-24019, locked — its OWN policy, NOT a reuse of WP-242's
 * selectDefaultKoTarget; it does not exclude wounds and does not prefer
 * S.H.I.E.L.D. cards): (1) lowest cost; then (2) discard-zone before hand-zone;
 * then (3) lowest array index within the chosen zone. ANY card is eligible
 * (the printed text says "a card", not "a Hero").
 *
 * The bot ALWAYS returns a target and NEVER declines — decline is a human-only
 * option. Returns null only when both zones are empty (an engine-invariant
 * violation while a choice is pending, since the park requires ≥1 eligible
 * card and the block-all guard freezes the board).
 *
 * @param zones - The player's card zones (only discard + hand are scanned).
 * @param cardStats - Card stat lookup for the cost tie-break (?.cost ?? 0).
 * @returns The default KO target, or null when both zones are empty.
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
  if (bestZone === null || bestCardId === null) {
    return null;
  }
  return { zone: bestZone, cardId: bestCardId };
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
      runHookEffects(G, ctx, entry.playerId, entry.cardId, hook, turn);
      pushLog(G,
        `Player ${entry.playerId}'s ${formatCardRef(G.cardDisplayData, entry.cardId)} ability applied — its condition was met later this turn.`,
        'applied',
        entry.cardId,
      );
    },
  );
}
