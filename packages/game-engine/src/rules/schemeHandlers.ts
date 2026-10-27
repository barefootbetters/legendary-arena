/**
 * Scheme twist handler dispatcher for the ImplementationMap.
 *
 * The exported `schemeTwistHandler` is a config-driven dispatcher that
 * looks up the active scheme in SCHEME_TWIST_CONFIGS, resolves the
 * matching SchemeTwistResolver, and delegates twist behavior. The
 * generic counter-increment runs for every scheme BEFORE the resolver (or
 * fallback), so a resolver reads its own Twist number as
 * G.counters.schemeTwistCount (D-24775); the scheme-loss threshold check runs
 * after it completes.
 *
 * No boardgame.io imports. No registry imports.
 */

import type { RuleEffect } from './ruleHooks.types.js';
import type { ImplementationMap } from './ruleRuntime.execute.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { SCHEME_TWIST_RESOLVERS } from './schemeTwistResolvers.js';
import { SCHEME_TWIST_CONFIGS } from './schemeTwistConfigs.js';
import {
  resolveTwistLossThreshold,
  isTwistLossSuppressed,
} from './schemeLossProgress.js';
import { pushLog } from '../log/logPush.js';

/**
 * Counts THIS Twist and logs its "Scheme Twist #N revealed" line, before its
 * resolver runs (D-24775).
 *
 * @param gameState - Current game state (mutated: the twist counter and the log).
 * @param threshold - Twist count at which the doom-clock proxy loss triggers.
 * @param suppressTwistLoss - When true, the doom-clock clause is omitted because
 *   the scheme declares a real resourceLossCondition (D-24315).
 * @returns THIS Twist's number (1 for the first Twist of the match).
 */
function countAndAnnounceTwist(
  gameState: LegendaryGameState,
  threshold: number,
  suppressTwistLoss: boolean,
): number {
  // why: D-24775 — the count is raised HERE, before the resolver, not as a returned
  // modifyCounter effect applied after it. A resolver can play cards from the Villain
  // Deck, and a Twist among them re-enters this dispatcher before the outer one
  // returns; with the old post-resolver increment the nested Twist read the outer
  // Twist's number and the "#N revealed" lines came out in the order the Twists
  // finished. Raised first, each Twist is numbered in the order it was revealed, and
  // every resolver reads its own number as G.counters.schemeTwistCount. The final
  // count is the same; only the moment it rises moved.
  const twistNumber = (gameState.counters.schemeTwistCount ?? 0) + 1;
  gameState.counters.schemeTwistCount = twistNumber;

  // why: WP-643-follow-up — the doom-clock line names THIS twist's number and,
  // when the twist-threshold proxy is active, how close it is to Evil Wins, so a
  // player reads the pressure at a glance instead of a bare "count incremented".
  // The literal substring "twist count incremented" is PRESERVED verbatim because
  // scripts/extract-par-anchors.mjs counts twists by matching it in the log text —
  // changing it would silently zero the par-anchor twist count. Coloured `threat`
  // (villain-purple): a Scheme Twist is the board advancing on the players.
  const doomClockClause = suppressTwistLoss
    ? ''
    : ` (${twistNumber} of ${threshold} to Evil Wins)`;
  pushLog(
    gameState,
    `Scheme Twist #${twistNumber} revealed — the Scheme advances; twist count incremented${doomClockClause}.`,
    'threat',
  );
  return twistNumber;
}

/**
 * Builds the twist-threshold scheme-loss effects for one Twist, applied after its
 * resolver.
 *
 * @param twistNumber - THIS Twist's number (from countAndAnnounceTwist).
 * @param threshold - Twist count at which the doom-clock proxy loss triggers.
 * @param suppressTwistLoss - When true, no SCHEME_LOSS effect is emitted because
 *   the scheme declares a real resourceLossCondition (D-24315) whose loss is
 *   signalled from the escape path instead.
 * @returns The loss effects, or an empty array below the threshold.
 */
function buildTwistLossEffects(
  twistNumber: number,
  threshold: number,
  suppressTwistLoss: boolean,
): RuleEffect[] {
  const effects: RuleEffect[] = [];

  // why: scheme-loss is mediated through counters, not direct endgame calls. The
  // endgame evaluator reads G.counters to determine loss. D-24315 — a scheme that
  // declares a resourceLossCondition loses on that real condition, so the
  // doom-clock proxy is suppressed for it; only this loss push is gated.
  if (!suppressTwistLoss && twistNumber >= threshold) {
    effects.push({
      type: 'modifyCounter',
      counter: ENDGAME_CONDITIONS.SCHEME_LOSS,
      delta: 1,
    });

    effects.push({
      type: 'queueMessage',
      message: 'Scheme loss triggered — twist threshold reached.',
      // why: WP-643-follow-up — the villains reaching the doom-clock threshold is
      // the strongest board-adversity signal; colour it `threat` (villain-purple).
      outcome: 'threat',
    });
  }

  return effects;
}

/**
 * Scheme twist handler dispatcher.
 *
 * Looks up the active scheme in SCHEME_TWIST_CONFIGS. If a config exists,
 * resolves the matching SchemeTwistResolver and calls it with config params.
 * If no config exists, runs the generic fallback (counter increment plus the
 * D-24595 last-twist loss check).
 *
 * @param gameState - Current game state (mutated by resolvers).
 * @param ctx - boardgame.io context (passed through to chained reveals).
 * @param payload - Trigger payload `{ cardId }` from `villainDeck.reveal.ts`.
 *   WP-200: previously unused (`_payload`); now read to thread the
 *   twist cardId to the resolver so the resolver can push a
 *   `schemeTwistResolved` event with the correct `twistCardId`. The
 *   cardId is in-flight between deck removal (step 4 of
 *   `performVillainReveal`) and twist-pile routing (step 7); the
 *   resolver runs in step 5 inside `executeRuleHooks`, so the trigger
 *   payload is the only path that carries the cardId.
 * @param implementationMap - Handler map threaded through chained reveals.
 * @returns Array of RuleEffect descriptions to apply.
 */
export function schemeTwistHandler(
  gameState: LegendaryGameState,
  ctx: unknown,
  payload: unknown,
  implementationMap: ImplementationMap,
): RuleEffect[] {
  const schemeId = gameState.selection.schemeId;
  const config = SCHEME_TWIST_CONFIGS.get(schemeId);

  // why: WP-200 — the trigger payload is shaped `{ cardId }` by
  // `villainDeck.reveal.ts` (step 5 — `executeRuleHooks('onSchemeTwistRevealed',
  // { cardId }, ...)`). Narrowed defensively because the rule pipeline's
  // payload param is typed `unknown`; an empty / malformed payload falls
  // back to the empty string so the resolver still emits a well-typed
  // event rather than throwing (moves never throw, per architecture
  // rules). The fallback is observably impossible in production flow but
  // protects tests that call the handler directly with a stub payload.
  const twistCardId = (() => {
    if (payload === null || payload === undefined) return '' as CardExtId;
    if (typeof payload !== 'object') return '' as CardExtId;
    const candidate = (payload as { cardId?: unknown }).cardId;
    if (typeof candidate !== 'string') return '' as CardExtId;
    return candidate as CardExtId;
  })();

  // why: the D-24178 threshold-resolution order and the D-24315
  // resourceLossCondition suppression live in schemeLossProgress.ts, so the
  // UIState menace projection (D-24366) reads the same rule this dispatcher acts
  // on instead of carrying a second copy that could drift from it. D-24595: the
  // threshold for a scheme with no printed count (and for the twist half of a
  // compound scheme) is the last twist in its Villain Deck, not a flat 7, and a
  // compound scheme is not suppressed despite declaring a resource condition.
  // Both are fixed for the match (config + setup), so reading them before the
  // resolver gives the same values as after it.
  const effectiveThreshold = resolveTwistLossThreshold(gameState);
  const suppressTwistLoss = isTwistLossSuppressed(gameState);
  const twistNumber = countAndAnnounceTwist(gameState, effectiveThreshold, suppressTwistLoss);

  if (config) {
    const resolver = SCHEME_TWIST_RESOLVERS[config.resolverId];

    if (resolver) {
      // why: ctx satisfies RevealContext structurally — boardgame.io's
      // FnContext exposes both `random` and `ctx.currentPlayer`. Cast is
      // safe because executeRuleHooks always forwards the engine-supplied
      // FnContext, and performVillainReveal only reads the narrow shape.
      resolver(
        gameState,
        ctx as RevealContext,
        implementationMap,
        config.params,
        twistCardId,
      );
    } else {
      pushLog(gameState, 
        `[Scheme Twist] Resolver "${config.resolverId}" not found in registry for scheme "${schemeId}".`,
      );
    }
  } else {
    // why: config-not-found is safe because the generic counter-increment
    // (above) and loss-check (below) still run. Unconfigured schemes get no card-specific
    // effects, and lose at the D-24595 last-twist fallback threshold.
    pushLog(gameState, 
      `[Scheme Twist] No resolver configured for scheme "${schemeId}" — counter increment only.`,
    );
  }

  return buildTwistLossEffects(twistNumber, effectiveThreshold, suppressTwistLoss);
}
