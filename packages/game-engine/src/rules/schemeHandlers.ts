/**
 * Scheme twist handler dispatcher for the ImplementationMap.
 *
 * The exported `schemeTwistHandler` is a config-driven dispatcher that
 * looks up the active scheme in SCHEME_TWIST_CONFIGS, resolves the
 * matching SchemeTwistResolver, and delegates twist behavior. The
 * generic counter-increment + scheme-loss threshold check runs for
 * every scheme after the resolver (or fallback) completes.
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
 * Builds the shared counter-increment + scheme-loss effects that fire for
 * every scheme twist regardless of the card-specific text.
 *
 * @param gameState - Current game state (read-only).
 * @param threshold - Twist count at which the doom-clock proxy loss triggers.
 * @param suppressTwistLoss - When true, the twist-threshold SCHEME_LOSS effect
 *   is NOT emitted because the scheme declares a real resourceLossCondition
 *   (D-24315) whose loss is signalled from the escape path instead. The twist
 *   count increment still fires unconditionally.
 * @returns Generic RuleEffect[] applied to every twist.
 */
function buildGenericTwistEffects(
  gameState: LegendaryGameState,
  threshold: number,
  suppressTwistLoss: boolean,
): RuleEffect[] {
  const effects: RuleEffect[] = [];

  effects.push({
    type: 'modifyCounter',
    counter: 'schemeTwistCount',
    delta: 1,
  });

  effects.push({
    type: 'queueMessage',
    message: 'Scheme twist revealed — twist count incremented.',
  });

  // why: scheme-loss is mediated through counters, not direct endgame
  // calls. The endgame evaluator reads G.counters to determine loss.
  // We predict the post-effect count by adding 1 to the current value
  // because applyRuleEffects has not yet applied the increment above.
  const predictedTwistCount =
    (gameState.counters.schemeTwistCount ?? 0) + 1;

  // why: D-24315 — a scheme that declares a resourceLossCondition loses on that
  // real condition (signalled from the escape path), so the twist-count
  // doom-clock proxy is suppressed for it. The twist count still increments
  // above; only this loss push is gated.
  if (!suppressTwistLoss && predictedTwistCount >= threshold) {
    effects.push({
      type: 'modifyCounter',
      counter: ENDGAME_CONDITIONS.SCHEME_LOSS,
      delta: 1,
    });

    effects.push({
      type: 'queueMessage',
      message: 'Scheme loss triggered — twist threshold reached.',
    });
  }

  return effects;
}

/**
 * Scheme twist handler dispatcher.
 *
 * Looks up the active scheme in SCHEME_TWIST_CONFIGS. If a config exists,
 * resolves the matching SchemeTwistResolver and calls it with config params.
 * If no config exists, runs the generic fallback (counter increment only).
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
    // and loss-check still run below. Unconfigured schemes simply get the
    // counter-only behavior — no card-specific effects.
    pushLog(gameState, 
      `[Scheme Twist] No resolver configured for scheme "${schemeId}" — counter increment only.`,
    );
  }

  // why: the D-24178 threshold-resolution order and the D-24315
  // resourceLossCondition suppression now live in schemeLossProgress.ts, so the
  // UIState menace projection (D-24366) reads the same rule this dispatcher acts
  // on instead of carrying a second copy that could drift from it. Behavior is
  // unchanged — the helper is the same priority order that was inline here.
  const effectiveThreshold = resolveTwistLossThreshold(gameState);
  const suppressTwistLoss = isTwistLossSuppressed(gameState);

  return buildGenericTwistEffects(gameState, effectiveThreshold, suppressTwistLoss);
}
