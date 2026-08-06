/**
 * Villain & henchman ability execution for the Legendary Arena game engine.
 *
 * executeVillainAbilities applies the locked MVP effect vocabulary for a card at
 * a given timing (onAmbush / onFight / onEscape). It mutates G directly via
 * existing zone helpers and returns a `VillainEffectResult[]` in dispatch order
 * (WP-316) — each result carries the reverse-mapped legacy keyword plus the card
 * ext_id targets the effect touched — so the three fire sites can narrate
 * per-target log lines. `results.map((r) => r.keyword)` reproduces the WP-200
 * keyword surface byte-identically. It is deliberately separate from the global
 * rule-hook pipeline (D-18501). Out-of-vocabulary effects safe-skip silently and
 * are NOT included in the return array.
 *
 * Imports no game framework and no registry package. No .reduce().
 * Uses existing helpers only: gainWound, koCard, moveCardFromZone,
 * attachBystanderToVillain, awardAttachedBystanders.
 */

import type { LegendaryGameState, PendingKoHeroChoice } from '../types.js';
import type { CardExtId, PlayerZones } from '../state/zones.types.js';
import type {
  VillainAbilityTiming,
  VillainAbilityHook,
  VillainEffectKeyword,
  VillainEffectResult,
  VillainEffectDescriptor,
  VillainEffectPrimitive,
} from '../rules/villainAbility.types.js';
import {
  getVillainHooksForCard,
  descriptorToLegacyKeyword,
  VILLAIN_EFFECT_PRIMITIVES,
} from '../rules/villainAbility.types.js';
import type { CitySpaceName } from '../board/citySpaceNames.js';
import { citySpaceNameForIndex } from '../board/citySpaceNames.js';
import type { ResolvedEffectResult } from '../events/notableEvents.compose.js';
import type { HollowEffectRecord, EffectTrace, EffectTraceStatus } from '../diagnostics/hollowEffect.types.js';
import { recordHollowEffect } from '../diagnostics/hollowEffect.record.js';
import { recordEffectTrace } from '../diagnostics/effectTrace.record.js';
import { gainWound } from '../board/wounds.logic.js';
import { koCard } from '../board/ko.logic.js';
import {
  attachBystanderToVillain,
  awardAttachedBystanders,
} from '../board/bystanders.logic.js';
import { captureHeroFromHq } from '../board/heroCapture.logic.js';
import type { CaptureHeroResult } from '../board/heroCapture.logic.js';
import { moveCardFromZone } from '../moves/zoneOps.js';
import { reshuffleDiscardIntoDeck, drawCardsIntoHand, HAND_SIZE } from '../moves/drawCards.logic.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { pushLog } from '../log/logPush.js';
import {
  WOUND_EXT_ID,
  SHIELD_AGENT_EXT_ID,
  SHIELD_TROOPER_EXT_ID,
  SHIELD_OFFICER_EXT_ID,
} from '../setup/pilesInit.js';

/**
 * A single KO-a-Hero target: which zone the card sits in and its ext_id.
 *
 * Used by the interactive KO flow (WP-242) — the eligible-target builder, the
 * bot default-pick, and the auto-1 / single-target mutator all speak this
 * shape. The zone union matches resolveKoHeroChoice's payload (D-24006).
 */
export interface KoHeroTarget {
  zone: 'discard' | 'hand' | 'inPlay';
  cardId: CardExtId;
}

// ---------------------------------------------------------------------------
// executeVillainAbilities — main entry point
// ---------------------------------------------------------------------------

/**
 * Applies villain/henchman ability effects for a card at a given timing.
 *
 * Called from the Fight fire site (fightVillain.ts, 'onFight'), the Ambush
 * fire site (villainDeck.reveal.ts, 'onAmbush'), and the Escape fire site
 * (villainDeck.reveal.ts, 'onEscape' — WP-186). Looks up the card's hooks
 * for the timing and applies each effect in left-to-right array order.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param ctx - framework context passed as unknown to avoid a game-framework
 *   import. Only ctx.currentPlayer is read.
 * @param cardId - The villain/henchman card-instance ext_id that triggered.
 * @param timing - Which timing fired ('onAmbush', 'onFight', or 'onEscape').
 * @returns The applied effect results in dispatch order (post-safe-skip).
 *   WP-316 widening (D-24102): each result carries the reverse-mapped legacy
 *   `keyword` plus the card ext_id `targets` the effect touched (and `pending`
 *   for a parked interactive KO), so the three fire sites can narrate per-target
 *   log lines. `results.map((r) => r.keyword)` reproduces the WP-200
 *   `VillainEffectKeyword[]` return byte-identically, so the fightResolved /
 *   ambushResolved keyword surface is unchanged. Out-of-vocabulary effects
 *   safe-skip and are NOT included.
 */
export function executeVillainAbilities(
  G: LegendaryGameState,
  ctx: unknown,
  cardId: CardExtId,
  timing: VillainAbilityTiming,
  // why: WP-478 / D-24285 — the deterministic shuffle source, threaded down to the
  // scry handler so it can reshuffle the current player's discard when their deck
  // runs dry mid-look (the Legendary reveal-reshuffle rule). Optional: only the
  // fire sites that can trigger a deck-reveal effect need supply it, and the scry
  // handler no-ops the reshuffle on an empty discard before touching it. `ctx` does
  // NOT carry `random` (it is the bare bgio ctx), so the provider is a separate arg.
  shuffleContext?: ShuffleProvider,
  // why: WP-489 / D-24295 — the 0-based City index the villain was fought on, for
  // the universal location gate (Abomination / the Lizard). Trailing-optional
  // (mirroring shuffleContext?): only the Fight fire site knows a fought space;
  // the Ambush/Escape reveal sites pass undefined, and the gate FAILS CLOSED on
  // undefined so a location-gated effect never fires without a fought space.
  cityIndex?: number,
): VillainEffectResult[] {
  // why: WP-316 — accumulator captures a result per effect whose handler ran,
  // in dispatch order. Each result pairs the reverse-mapped legacy keyword with
  // the ext_ids the effect touched. Out-of-vocab effects (no handler) are NOT
  // appended; the fire sites see only effects whose mutation was attempted.
  const results: VillainEffectResult[] = [];

  // why: guard against older test mocks (and pre-WP-185 G states) that lack
  // villainAbilityHooks — mirrors the WP-022 heroAbilityHooks guard. No hooks
  // means no effects.
  if (!G.villainAbilityHooks || G.villainAbilityHooks.length === 0) {
    return results;
  }

  // why: ctx is typed `unknown` and narrowed via `as` to the one field this
  // executor reads — the active player id. The executor is barred from
  // importing the framework's Ctx / FnContext types, exactly as
  // heroEffects.execute.ts narrows `ctx as ShuffleProvider`. All other
  // iteration derives from G.
  const currentPlayer = (ctx as { currentPlayer: string }).currentPlayer;

  // why: WP-257 — the turn number for any hollow record, read off the
  // unknown-typed ctx defensively. boardgame.io's ctx carries `turn`; the
  // villain test CTX object ({ currentPlayer }) does not, so a missing /
  // non-numeric value falls back to 0 — never a throw.
  const turn = readTurnNumber(ctx);
  // why: WP-257 — cardType for the record: a card classified `henchman` in
  // G.villainDeckCardTypes records as `henchman`, everything else (including an
  // absent classification in narrow test mocks) records as `villain`.
  const cardType = resolveVillainCardType(G, cardId);

  const hooks = getVillainHooksForCard(G.villainAbilityHooks, cardId, timing);
  for (const hook of hooks) {
    for (const descriptor of hook.effects) {
      // why: WP-489 / D-24295 — the universal location gate, checked BEFORE handler
      // dispatch. A descriptor carrying `requireCitySpaces` fires only when the
      // villain was fought on a listed space; otherwise skip + self-narrate "no
      // effect". This is NOT hollow (the handler exists — the location blocked it),
      // so it records neither a hollow nor an EffectTrace: the descriptor was never
      // dispatched. Fails CLOSED on an undefined / out-of-range cityIndex (the
      // Ambush/Escape fire sites, which have no fought space).
      if (
        descriptor.requireCitySpaces !== undefined &&
        !isCityGateSatisfied(descriptor.requireCitySpaces, cityIndex)
      ) {
        narrateCityGateBlocked(G, timing, descriptor.requireCitySpaces);
        continue;
      }
      const application = applyVillainEffect(G, currentPlayer, cardId, timing, descriptor, shuffleContext, cityIndex);
      if (application !== null) {
        // why: D-24023 — each result's `keyword` stays VillainEffectKeyword
        // (reverse-mapped from the dispatched descriptor) so notableEvents,
        // EFFECT_KEYWORD_LABELS, the replay state-hash, and the arena-client
        // projection are byte-identical (WP-316 adds only the hash-excluded
        // targets). Every dispatched descriptor came from a legacy marker, so
        // the reverse-map always resolves; an unresolvable descriptor (none in
        // this WP) is simply not recorded.
        const legacyKeyword = descriptorToLegacyKeyword(descriptor);
        if (legacyKeyword !== undefined) {
          const result: VillainEffectResult = {
            keyword: legacyKeyword,
            targets: application.targets,
          };
          // why: WP-316 — carry `pending` only when the handler parked an
          // interactive KO, so the omit-when-absent shape matches the type's
          // optional field (no `pending: undefined` noise).
          if (application.pending === true) {
            result.pending = true;
          }
          results.push(result);
        }
      } else {
        // why: WP-257 / D-24033 — `application === null` is the out-of-vocabulary
        // skip site: applyVillainEffect reached NO handler for this descriptor.
        // Classify on handler REACHABILITY (never state-diff) and record a hollow
        // event. This is purely additive — results is byte-unchanged (a
        // non-applied descriptor was never recorded there).
        recordHollowEffect(G, buildVillainDescriptorHollowRecord(cardId, cardType, timing, descriptor, turn));
      }
      // why: WP-488 / D-24294 — emit a runtime EffectTrace for EVERY villain descriptor
      // dispatch (both the applied and the null/no-handler branch), from THIS caller loop
      // — it carries `turn` + `timing` + `cardId` + the descriptor + the dispatch result
      // together, which the inner applyVillainEffect does not. Inert + hash-excluded; a
      // no-handler dispatch now produces BOTH a hollow record (above, unchanged) and a trace.
      recordEffectTrace(G, buildVillainEffectTrace(cardType, cardId, timing, descriptor, application, turn));
    }
    // why: WP-257 / D-24034 — an unresolved `[effect:X]` marker the parser saw
    // but could not turn into a descriptor is `parse-unrecognized` hollow. These
    // never produced a descriptor, so they are not in hook.effects above.
    detectVillainUnresolvedMarkers(G, cardId, cardType, hook, turn);
    // why: D-24266 — the printed-but-unmarked gap. This hook exists ONLY because
    // its source ability line began with a recognized timing prefix
    // (Fight:/Ambush:/Escape:), which in Legendary always denotes a mechanical
    // effect — flavor text never carries those prefixes. A hook with zero
    // descriptors AND zero unresolved markers therefore means the data pipeline
    // never annotated the line with any `[effect:]` marker at all, so the printed
    // mechanic is entirely un-implemented (e.g. Doombot Legion's "Fight: Look at
    // the top two cards of your deck. KO one of them and put the other back.").
    // The WP-257 detector only classified markered/descriptored lines, so this
    // whole class fell through silently. Recording it as `no-handler` hollow gives
    // the operator log a breadcrumb instead of nothing. This supersedes WP-188's
    // implicit "marker-free line = silent safe-skip" for villain/henchman timing
    // lines (the parser still emits the hook; the difference is that we now
    // observe it rather than dropping it on the floor).
    detectVillainUnmarkedTimingLine(G, cardId, cardType, hook, turn);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Fire-site name resolution (WP-316)
// ---------------------------------------------------------------------------

/**
 * Resolves each effect result's target ext_ids to display names for the log.
 *
 * Shared by all three fire sites (Fight / Ambush / Escape) — extracted at the
 * third identical copy per the duplicate-first rule. Reads `G.cardDisplayData`
 * (the fire site's to read, D-11106 pattern) so the pure composer stays free of
 * any `G` dependency. The returned `ResolvedEffectResult[]` feeds
 * `composeEffectResultLogLine`.
 *
 * @param G - Game state (read-only here; only `G.cardDisplayData` is consulted).
 * @param results - The executor's per-effect results in dispatch order.
 * @returns The results with each target ext_id resolved to a display name.
 */
export function resolveEffectResultNames(
  G: LegendaryGameState,
  results: VillainEffectResult[],
): ResolvedEffectResult[] {
  const resolved: ResolvedEffectResult[] = [];
  for (const result of results) {
    const targetNames: string[] = [];
    for (const targetId of result.targets) {
      targetNames.push(resolveCardDisplayName(G, targetId));
    }
    const resolvedResult: ResolvedEffectResult = {
      keyword: result.keyword,
      targetNames,
    };
    if (result.pending === true) {
      resolvedResult.pending = true;
    }
    resolved.push(resolvedResult);
  }
  return resolved;
}

/**
 * Resolves a single card ext_id to its display name, falling back to the raw
 * ext_id when `G.cardDisplayData` has no usable entry.
 *
 * Defensive access mirrors the fightResolved / ambushResolved name resolution:
 * legacy test G states may leave `cardDisplayData` undefined; production setup
 * always builds it.
 *
 * @param G - Game state.
 * @param extId - The card-instance ext_id to name.
 * @returns The display name, or the raw ext_id when none is available.
 */
function resolveCardDisplayName(G: LegendaryGameState, extId: CardExtId): string {
  const display = G.cardDisplayData?.[extId];
  if (display && typeof display.name === 'string' && display.name.length > 0) {
    return display.name;
  }
  return extId;
}

// ---------------------------------------------------------------------------
// Hollow-effect detection (WP-257 / D-24033 + D-24034)
// ---------------------------------------------------------------------------

/**
 * Reads the boardgame.io turn number off the (unknown-typed) ctx, defaulting to
 * 0 when absent.
 *
 * Sibling of the helper in heroEffects.execute.ts, but NOT identical: this one
 * reads `ctx.turn` directly because executeVillainAbilities receives the BARE
 * boardgame.io Ctx (its top-level `turn` / `currentPlayer`), whereas the hero
 * executor receives the FnContext wrapper and must read the nested `ctx.ctx.turn`.
 * Duplicate-first per §16.1 — the two executors are independent dispatch surfaces;
 * a third appearance would justify extracting a shape-aware reader. The villain CTX
 * test object carries no `turn`, so a missing / non-numeric value falls back to 0,
 * never a throw.
 *
 * @param ctx - The boardgame.io context, typed unknown to avoid a framework import.
 * @returns The turn number, or 0 when unavailable.
 */
function readTurnNumber(ctx: unknown): number {
  if (ctx !== null && typeof ctx === 'object') {
    const turn = (ctx as { turn?: unknown }).turn;
    if (typeof turn === 'number' && Number.isFinite(turn)) {
      return turn;
    }
  }
  return 0;
}

/**
 * Resolves the HollowEffectRecord cardType for a villain/henchman card.
 *
 * Reads G.villainDeckCardTypes: a card classified `henchman` records as
 * `henchman`; everything else — `villain`, or an absent classification (narrow
 * test mocks build G without the map) — records as `villain`. Never throws.
 *
 * @param G - Game state.
 * @param cardId - The triggering card-instance ext_id.
 * @returns The record cardType ('villain' or 'henchman').
 */
function resolveVillainCardType(
  G: LegendaryGameState,
  cardId: CardExtId,
): 'villain' | 'henchman' {
  const types = G.villainDeckCardTypes;
  if (types !== undefined && types[cardId] === 'henchman') {
    return 'henchman';
  }
  return 'villain';
}

/**
 * Builds the HollowEffectRecord for a villain/henchman descriptor whose handler
 * was unreachable.
 *
 * Classifies the reason by REACHABILITY: a descriptor carrying a non-primitive
 * `primitive` value is `unsupported-keyword` (dispatch cannot execute it); a
 * descriptor with no primitive at all (an out-of-vocab legacy marker that
 * produced an empty descriptor) is `no-handler`. Never diffs G.
 *
 * @param cardId - The triggering card-instance ext_id.
 * @param cardType - The resolved record cardType.
 * @param timing - The timing that fired.
 * @param descriptor - The descriptor whose handler was unreachable.
 * @param turn - The turn number for the record.
 * @returns The hollow-effect record.
 */
function buildVillainDescriptorHollowRecord(
  cardId: CardExtId,
  cardType: 'villain' | 'henchman',
  timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
  turn: number,
): HollowEffectRecord {
  // why: descriptor.primitive is typed VillainEffectPrimitive but a malformed
  // hook (or test cast) can carry an unknown string or none at all; read it
  // defensively to classify the reason.
  const primitiveValue = (descriptor as { primitive?: string }).primitive;
  let reason: HollowEffectRecord['reason'];
  let mechanic: string;
  if (typeof primitiveValue === 'string' && primitiveValue.length > 0) {
    // why: a present-but-unrecognized primitive is `unsupported-keyword`; a
    // recognized primitive would have had a handler and never reached here.
    reason = isVillainEffectPrimitive(primitiveValue) ? 'no-handler' : 'unsupported-keyword';
    mechanic = primitiveValue;
  } else {
    // why: no primitive on the descriptor — an out-of-vocab legacy marker that
    // produced an empty descriptor. No executable handler exists for it.
    reason = 'no-handler';
    mechanic = 'unknown';
  }
  return { cardId, cardType, timing, mechanic, reason, turn };
}

/**
 * Records a `parse-unrecognized` hollow event for each unresolved `[effect:X]`
 * marker on a villain/henchman hook.
 *
 * The parser surfaces markers it saw but could not resolve into a descriptor on
 * hook.unresolvedMarkers (WP-257 / D-24034). A line with no effect marker at all
 * leaves the field absent, so it never reaches here.
 *
 * @param G - Game state (mutated under Immer draft only via recordHollowEffect).
 * @param cardId - The triggering card-instance ext_id.
 * @param cardType - The resolved record cardType.
 * @param hook - The villain ability hook that fired.
 * @param turn - The turn number for the record.
 */
function detectVillainUnresolvedMarkers(
  G: LegendaryGameState,
  cardId: CardExtId,
  cardType: 'villain' | 'henchman',
  hook: VillainAbilityHook,
  turn: number,
): void {
  const unresolvedMarkers = hook.unresolvedMarkers ?? [];
  for (const marker of unresolvedMarkers) {
    recordHollowEffect(G, {
      cardId,
      cardType,
      timing: hook.timing,
      mechanic: marker,
      reason: 'parse-unrecognized',
      turn,
    });
  }
}

/**
 * Records a `no-handler` hollow event for a hook whose ability line carried a
 * recognized timing prefix but no machine-readable effect at all (D-24266).
 *
 * A villain/henchman hook is built only for an ability line that begins with
 * `Fight:` / `Ambush:` / `Escape:`, and those prefixes always denote a
 * mechanical effect. When the parser produced neither a descriptor nor an
 * unresolved `[effect:X]` marker, the line was never annotated — the printed
 * mechanic is un-implemented (e.g. Doombot Legion's deck-scry-and-KO Fight). The
 * `mechanic` label is `'unmarked-ability'` because there is no marker token to
 * name. A hook that DID carry an unresolved marker is handled by
 * detectVillainUnresolvedMarkers (`parse-unrecognized`) and is excluded here so a
 * single line never double-records.
 *
 * @param G - Game state (mutated under Immer draft only via recordHollowEffect).
 * @param cardId - The triggering card-instance ext_id.
 * @param cardType - The resolved record cardType.
 * @param hook - The villain ability hook that fired.
 * @param turn - The turn number for the record.
 */
function detectVillainUnmarkedTimingLine(
  G: LegendaryGameState,
  cardId: CardExtId,
  cardType: 'villain' | 'henchman',
  hook: VillainAbilityHook,
  turn: number,
): void {
  const hasDescriptor = hook.effects.length > 0;
  const hasUnresolvedMarker = (hook.unresolvedMarkers?.length ?? 0) > 0;
  if (hasDescriptor || hasUnresolvedMarker) {
    return;
  }
  recordHollowEffect(G, {
    cardId,
    cardType,
    timing: hook.timing,
    mechanic: 'unmarked-ability',
    reason: 'no-handler',
    turn,
  });
}

/**
 * Returns whether a string is a valid VillainEffectPrimitive.
 *
 * Splits `no-handler` (a recognized primitive that somehow lacks a handler —
 * unreachable in practice but future-proof) from `unsupported-keyword` (an
 * unrecognized primitive token).
 *
 * @param value - The candidate primitive string.
 * @returns Whether the value is a member of VILLAIN_EFFECT_PRIMITIVES.
 */
function isVillainEffectPrimitive(value: string): value is VillainEffectPrimitive {
  for (const primitive of VILLAIN_EFFECT_PRIMITIVES) {
    if (primitive === value) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// City-space location gate (WP-489 / D-24295)
// ---------------------------------------------------------------------------

/**
 * Returns whether the fought City index satisfies a descriptor's location gate.
 *
 * Fails CLOSED: an undefined / out-of-range `cityIndex` (the Ambush/Escape fire
 * sites, which have no fought space) resolves to `undefined` and matches no
 * listed space, so a location-gated effect never fires without a fought space.
 *
 * @param requireCitySpaces - The named spaces the effect is gated on.
 * @param cityIndex - The 0-based City index fought, or undefined at a non-fight site.
 * @returns True when the fought space is one of the listed spaces.
 */
function isCityGateSatisfied(
  requireCitySpaces: readonly CitySpaceName[],
  cityIndex: number | undefined,
): boolean {
  const foughtSpace = citySpaceNameForIndex(cityIndex);
  if (foughtSpace === undefined) {
    return false;
  }
  for (const required of requireCitySpaces) {
    if (required === foughtSpace) {
      return true;
    }
  }
  return false;
}

/**
 * Self-narrates a "no effect — wrong space" line when a location-gated effect is
 * skipped (WP-489 / D-24295).
 *
 * The gated effect is keyword-less and never dispatched, so without this push the
 * skip would be invisible in the log. `G.messages` is hash-excluded (D-24081), so
 * this adds no replay surface. Outcome `blocked` per the WP-434 contract (the
 * effect touched no one).
 *
 * @param G - Game state (mutated only via the hash-excluded message log).
 * @param timing - The timing that fired (for the "<Fight|Ambush|Escape> effect:" label).
 * @param requireCitySpaces - The spaces the effect required (named in the line).
 */
function narrateCityGateBlocked(
  G: LegendaryGameState,
  timing: VillainAbilityTiming,
  requireCitySpaces: readonly CitySpaceName[],
): void {
  const label = villainEffectTimingLabel(timing);
  pushLog(
    G,
    `${label} effect: not fought on ${formatCitySpaceList(requireCitySpaces)}; no effect.`,
    'blocked',
  );
}

/**
 * Formats a City-space list into readable prose with a single leading "the"
 * (e.g. `['streets','bridge']` → "the Streets or Bridge"; `['sewers']` → "the
 * Sewers").
 *
 * @param spaces - The named City spaces (already validated at parse time).
 * @returns The prose list for a log line.
 */
function formatCitySpaceList(spaces: readonly CitySpaceName[]): string {
  const capitalized: string[] = [];
  for (const space of spaces) {
    capitalized.push(space.charAt(0).toUpperCase() + space.slice(1));
  }
  if (capitalized.length === 1) {
    return `the ${capitalized[0]}`;
  }
  const last = capitalized[capitalized.length - 1]!;
  const rest = capitalized.slice(0, capitalized.length - 1).join(', ');
  return `the ${rest} or ${last}`;
}

// ---------------------------------------------------------------------------
// Effect-trace emission (WP-488 / D-24294)
// ---------------------------------------------------------------------------

// why: WP-488 / D-24294 — the FIXED allowlist of villain primitives whose handlers are
// DELIBERATE no-ops that mutate nothing (become-scheme-twist, D-24287 — the real twist
// fires at the escape site; gain-attached-hero, D-24270 — the award is the generic
// WP-431 awardAttachedHeroes at the fight site). A trace for either must read `no-op`,
// decided by PRIMITIVE IDENTITY — NEVER by `targets.length`, because many real-firing
// handlers (gain-wound, capture-bystander, reveal-or-wound, draw-cards-current,
// rescue-bystanders-current, scry-ko-own-deck) legitimately return empty `targets` and
// MUST read as `fired`. Adding a future deliberate-no-op handler requires adding it here,
// or its trace mislabels as `fired`.
const DELIBERATE_NO_OP_VILLAIN_PRIMITIVES: ReadonlySet<VillainEffectPrimitive> =
  new Set<VillainEffectPrimitive>(['become-scheme-twist', 'gain-attached-hero']);

/**
 * Builds the per-dispatch `EffectTrace` for one villain/henchman descriptor
 * (WP-488 / D-24294).
 *
 * Status is decided by handler reachability + the fixed no-op allowlist, never by
 * mutation: a `null` application → `no-handler` (co-recorded as a hollow); a
 * deliberate-no-op primitive → `no-op`; any other handler that ran → `fired`. The
 * `handler` label is the primitive token (the VILLAIN_EFFECT_HANDLERS map key) when a
 * handler ran, `""` when none — a STRING label, never a function reference (G forbids
 * functions). `effect` is the primitive token verbatim, read defensively so a malformed
 * descriptor cannot throw before the guarded writer runs.
 *
 * @param cardType - The resolved scope ('villain' | 'henchman').
 * @param cardId - The triggering card-instance ext_id.
 * @param timing - The timing that fired ('onAmbush' | 'onFight' | 'onEscape').
 * @param descriptor - The dispatched descriptor.
 * @param application - The dispatch result (null when no handler was reached).
 * @param turn - The turn number for the trace (0 on the reveal path, per readTurnNumber).
 * @returns The effect trace to record.
 */
function buildVillainEffectTrace(
  cardType: 'villain' | 'henchman',
  cardId: CardExtId,
  timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
  application: VillainEffectApplication | null,
  turn: number,
): EffectTrace {
  // why: descriptor.primitive is typed but a malformed hook / test cast can carry a
  // non-string; read it defensively so the trace build never throws (the emit is
  // best-effort — a trace bug must never break an ability execution).
  const primitiveValue = (descriptor as { primitive?: unknown }).primitive;
  const effectToken = typeof primitiveValue === 'string' ? primitiveValue : '';
  let status: EffectTraceStatus;
  let handler: string;
  if (application === null) {
    // why: applyVillainEffect reached no handler for this primitive.
    status = 'no-handler';
    handler = '';
  } else if (
    typeof primitiveValue === 'string' &&
    DELIBERATE_NO_OP_VILLAIN_PRIMITIVES.has(primitiveValue as VillainEffectPrimitive)
  ) {
    // why: a deliberate-no-op handler ran — decided by primitive identity, never targets.length.
    status = 'no-op';
    handler = effectToken;
  } else {
    status = 'fired';
    handler = effectToken;
  }
  return {
    cardId,
    scope: cardType,
    timing,
    effect: effectToken,
    handler,
    status,
    fireSite: 'villain-executor',
    params: buildVillainEffectTraceParams(descriptor),
    turn,
  };
}

/**
 * Copies a villain descriptor's own SCALAR parameter fields into a trace `params`
 * snapshot, omitting `undefined` keys (WP-488 / D-24294).
 *
 * Explicit field-by-field copy — NEVER a spread-and-cast of the raw descriptor, which
 * would leak the non-scalar `primitive` (and break `exactOptionalPropertyTypes`). Every
 * copied value is `string | number | boolean`; the `primitive` token is carried as the
 * trace's `effect`, not here.
 *
 * @param descriptor - The dispatched descriptor.
 * @returns A shallow scalar snapshot of the descriptor's parameter fields.
 */
function buildVillainEffectTraceParams(
  descriptor: VillainEffectDescriptor,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (descriptor.target !== undefined) {
    params.target = descriptor.target;
  }
  if (descriptor.magnitude !== undefined) {
    params.magnitude = descriptor.magnitude;
  }
  if (descriptor.selector !== undefined) {
    params.selector = descriptor.selector;
  }
  if (descriptor.drawCount !== undefined) {
    params.drawCount = descriptor.drawCount;
  }
  if (descriptor.requireKind !== undefined) {
    params.requireKind = descriptor.requireKind;
  }
  if (descriptor.requireValue !== undefined) {
    params.requireValue = descriptor.requireValue;
  }
  if (descriptor.zone !== undefined) {
    params.zone = descriptor.zone;
  }
  return params;
}

// ---------------------------------------------------------------------------
// Single effect dispatch
// ---------------------------------------------------------------------------

/**
 * The per-effect outcome a handler reports (WP-316): the card ext_ids it
 * affected, and whether it parked an interactive choice instead of acting now.
 *
 * The executor pairs this with the reverse-mapped legacy keyword to build a
 * `VillainEffectResult`. A handler that ran but touched nothing (empty pile,
 * no eligible hero) returns `{ targets: [] }` — still "applied" (the dispatcher
 * decides applied by handler presence, not by mutation).
 */
interface VillainEffectApplication {
  targets: CardExtId[];
  pending?: boolean;
}

/**
 * Handler signature for one villain effect primitive (WP-252 / D-24023).
 *
 * Mirrors the WP-251 HeroEffectHandler shape. Handlers mutate G directly and
 * return the effect's targets (WP-316); the dispatcher decides "applied" by
 * primitive presence.
 */
type VillainEffectHandler = (
  G: LegendaryGameState,
  currentPlayer: string,
  cardId: CardExtId,
  timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
  // why: WP-478 / D-24285 — the shuffle source for a handler that reveals/looks at
  // the player's own deck and must reshuffle the discard when it runs dry (only
  // `villainEffectScryKoOwnDeck` reads it). Optional + trailing so the seven handlers
  // that never touch the deck-reveal path keep their existing 5-param signatures
  // (a shorter function is structurally assignable to this wider type).
  shuffleContext?: ShuffleProvider,
  // why: WP-489 / D-24295 — the fought City index, threaded uniform with
  // shuffleContext so the handler signature carries the full fire-site context. No
  // current handler reads it (the location gate runs in the executor loop BEFORE
  // dispatch); a shorter handler stays structurally assignable to this wider type.
  cityIndex?: number,
) => VillainEffectApplication;

/**
 * gain-wound primitive — every player or the current player gains 1 wound.
 *
 * `target: 'each'` is verbatim from the former gainWoundEachPlayer case;
 * `target: 'current'` is verbatim from gainWoundCurrentPlayer (WP-185 / WP-200).
 * Only the dispatch shape changed (WP-252).
 */
function villainEffectGainWound(
  G: LegendaryGameState,
  currentPlayer: string,
  _cardId: CardExtId,
  timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  // why: WP-489 / D-24295 — the Lizard "each OTHER player gains a Wound": wound
  // every player EXCEPT the current one. Sorted iteration (D-18902 determinism),
  // supply-bounded, `magnitude` repetitions (default 1) mirroring ko-hero:each so a
  // future N-wound each-other line is data-only. Keyword-less (no legacy reverse-
  // map, see descriptorKey), so it MUST self-narrate — the generic
  // "<timing> effect:" line never fires for it.
  if (descriptor.target === 'each-other') {
    const repetitions = descriptor.magnitude ?? 1;
    const woundedPlayerIds: string[] = [];
    for (const playerId of Object.keys(G.playerZones).sort()) {
      // why: "each OTHER player" — the current player is never wounded by this effect.
      if (playerId === currentPlayer) continue;
      const zones = G.playerZones[playerId];
      if (!zones) continue;
      let woundedThisPlayer = false;
      for (let iteration = 0; iteration < repetitions; iteration++) {
        // why: supply-bounded — stop once the shared Wound pile is empty (a
        // reachable no-op, never a hollow record).
        if (G.piles.wounds.length === 0) break;
        const woundResult = gainWound(G.piles.wounds, zones.discard);
        G.piles.wounds = woundResult.woundsPile;
        zones.discard = woundResult.playerDiscard;
        woundedThisPlayer = true;
      }
      if (woundedThisPlayer) {
        woundedPlayerIds.push(playerId);
      }
    }
    // why: self-narrate (keyword-less). `G.messages` is hash-excluded (D-24081).
    // Honest outcome per the WP-434 contract: a wound landed → `applied`; no other
    // player could be wounded (solo, or empty supply) → `blocked`. woundsDrawn is
    // NOT bumped — the current player is never wounded by each-other.
    const label = villainEffectTimingLabel(timing);
    if (woundedPlayerIds.length > 0) {
      const names = woundedPlayerIds.map((playerId) => `Player ${playerId}`).join(', ');
      pushLog(G, `${label} effect: each other player gained a Wound (${names}).`, 'applied');
    } else {
      pushLog(G, `${label} effect: no other player gained a Wound.`, 'blocked');
    }
    return { targets: [] };
  }
  // why: WP-316 — wounds narrate via the generic keyword label, not a card
  // name; targets stays [] for both branches.
  if (descriptor.target === 'each') {
    // why: every player gains 1 wound (subject to wound-pile availability),
    // mirroring the existing escape-wound no-op-on-empty semantics.
    for (const playerId of Object.keys(G.playerZones)) {
      const zones = G.playerZones[playerId];
      if (!zones) continue;
      if (G.piles.wounds.length === 0) continue;
      const result = gainWound(G.piles.wounds, zones.discard);
      G.piles.wounds = result.woundsPile;
      zones.discard = result.playerDiscard;
      if (playerId === currentPlayer) {
        // why: woundsDrawn projects the current player's wounds only (UI
        // economy), matching escape-wound and the deleted Ambush loop.
        G.turnEconomy.woundsDrawn += 1;
      }
    }
    return { targets: [] };
  }
  // why: target === 'current'. WP-200 — mutation-guarded short-circuit still
  // counts as "applied" per the post-safe-skip contract (the dispatcher records
  // applied by primitive presence, not by mutation). The empty-pile /
  // missing-zone guards short-circuit body work, not the dispatch.
  const zones = G.playerZones[currentPlayer];
  if (!zones) return { targets: [] };
  if (G.piles.wounds.length === 0) return { targets: [] };
  const result = gainWound(G.piles.wounds, zones.discard);
  G.piles.wounds = result.woundsPile;
  zones.discard = result.playerDiscard;
  G.turnEconomy.woundsDrawn += 1;
  return { targets: [] };
}

/**
 * ko-hero primitive — KO a hero for the current player (interactive) or for
 * every player (auto-resolved, magnitude-many).
 *
 * `target: 'current'` is verbatim from the former koHeroCurrentPlayer case (the
 * WP-242 interactive park). `target: 'each'` is the koHeroEachPlayer (magnitude
 * 1) and koHeroEachPlayerMag2 (magnitude 2) cases generalized to
 * descriptor.magnitude (WP-252 / D-24023).
 */
function villainEffectKoHero(
  G: LegendaryGameState,
  currentPlayer: string,
  _cardId: CardExtId,
  timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  if (descriptor.target === 'current') {
    // why: WP-492 / D-24298 — magnitude-M interactive current-player KO. M = 1 is
    // the byte-identical WP-242 path (0 eligible → no-op; exactly 1 distinct option
    // → auto-KO, D-24007 decision C; ≥ 2 → park ONE bare {choiceType,playerID}
    // entry). M ≥ 2 (Whirlwind "KO two of your Heroes") KOs up to M: auto-KO every
    // FORCED step (distinct-eligible options O ≤ 1) and, once a genuine choice
    // remains (O ≥ 2), park ONE entry carrying the owed count — the resolve move
    // auto-resolves any later forced remainder, so a single-option pick is never
    // shown. Because a KO never GROWS O, one call is either all-auto (O ≤ 1
    // throughout) or an immediate park (O ≥ 2 at the first step).
    const zones = G.playerZones[currentPlayer];
    if (!zones) return { targets: [] };
    const magnitude = descriptor.magnitude ?? 1;

    const targets: CardExtId[] = [];
    let owed = magnitude;
    while (owed > 0) {
      const eligible = buildKoEligibleTargets(zones);
      if (eligible.length === 0) break; // why: no heroes left to KO.
      // why: a genuine choice of WHICH heroes to KO exists only when the player has
      // MORE KO-able heroes than the count owed (they get to spare some) AND ≥ 2
      // distinct options exist. Otherwise the KO is forced (every hero dies, or all
      // copies are identical), so auto-resolve it with no prompt.
      if (countKoableHeroes(zones) > owed && eligible.length >= 2) break;
      const koedId = koSingleTarget(G, zones, eligible[0]!);
      if (koedId === null) break; // why: defensive — an unexpected move miss stops progress.
      targets.push(koedId);
      owed -= 1;
    }

    let parked = false;
    if (owed > 0 && countKoableHeroes(zones) > owed && buildKoEligibleTargets(zones).length >= 2) {
      if (!G.pendingKoHeroChoices) G.pendingKoHeroChoices = [];
      const entry: PendingKoHeroChoice = { choiceType: 'ko-hero', playerID: currentPlayer };
      // why: WP-492 / D-24298 — OMIT `remaining` when owed === 1 (absent ≡ 1), so
      // the M=1 park is the exact {choiceType,playerID} object the WP-242 shape
      // tests pin (byte-identical). It carries the owed count only for a M ≥ 2 park.
      if (owed >= 2) {
        entry.remaining = owed;
      }
      G.pendingKoHeroChoices.push(entry);
      parked = true;
    }

    // why: WP-492 / D-24298 — M ≥ 2 is keyword-less (descriptorKey includes
    // magnitude → no LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR entry → reverse-maps to
    // undefined) so it self-narrates; M = 1 keeps the koHeroCurrentPlayer keyword
    // and narrates via the generic Fight-effect line — it MUST NOT self-narrate
    // (that would double-log). `G.messages` is hash-excluded (D-24081).
    if (magnitude >= 2) {
      const label = villainEffectTimingLabel(timing);
      if (parked) {
        pushLog(G, `${label} effect: KO ${String(owed)} of your Heroes — choose which.`, 'neutral');
      } else if (targets.length > 0) {
        const names = targets.map((koedId) => resolveCardDisplayName(G, koedId)).join(', ');
        pushLog(G, `${label} effect: KO'd ${String(targets.length)} of your Heroes (${names}).`, 'applied');
      } else {
        pushLog(G, `${label} effect: no Heroes to KO.`, 'blocked');
      }
    }

    // why: WP-316 / D-24102 — pending: true marks a parked interactive KO (targets
    // stays whatever was auto-KO'd before the park — none, since a park is immediate).
    return parked ? { targets, pending: true } : { targets };
  }
  // why: target === 'each'. Iteration order is Object.keys(G.playerZones).sort()
  // — default JavaScript string compare → lexical ascending (D-18902), NOT
  // insertion order and NOT a numeric sort. The shared per-player resolver owns
  // target selection AND the koCard mutation; this caller MUST NOT post-process
  // or modify the resolver's output (D-18902 mutation-location lock).
  // descriptor.magnitude drives the per-player repetition: 1 == the former
  // koHeroEachPlayer, 2 == koHeroEachPlayerMag2. The literal-2 inner loop is now
  // a descriptor param (D-24023 retiring D-20201's closed-union-per-magnitude);
  // a future Mag3 is data-only (magnitude: 3), no code change. Per-iteration
  // semantics inherit D-18503 (discard→hand→inPlay, starter-first tie-break,
  // silent no-op for zero eligible). Magnitude-N ≡ magnitude-1 N times — pinned
  // by the shared-resolver parity test on a single-player G.
  const repetitions = descriptor.magnitude ?? 1;
  const playerIds = Object.keys(G.playerZones).sort();
  // why: WP-316 — collect the KO'd ext_ids across every player/iteration in the
  // same order the resolver mutates G.ko; a zero-eligible iteration returns null
  // and contributes no target. This only reads the resolver's return — it does
  // NOT post-process the mutation (D-18902 mutation-location lock preserved).
  const targets: CardExtId[] = [];
  for (const playerId of playerIds) {
    // why: D-24280 — a `zone`-bearing descriptor (Juggernaut's discard/hand
    // source-restricted KO) uses the zone-locked resolver, which KOs `repetitions`
    // heroes from ONLY that zone (no discard→hand→inPlay fallback). Absent zone is
    // the byte-unchanged legacy path (koOneHeroForPlayer, per-iteration).
    if (descriptor.zone !== undefined) {
      const koedIds = koHeroesFromZoneForPlayer(G, playerId, descriptor.zone, repetitions);
      for (const koedId of koedIds) {
        targets.push(koedId);
      }
    } else {
      for (let iteration = 0; iteration < repetitions; iteration++) {
        const koedId = koOneHeroForPlayer(G, playerId);
        if (koedId !== null) {
          targets.push(koedId);
        }
      }
    }
  }
  return { targets };
}

/**
 * capture-hq-hero primitive — capture one HQ hero by the descriptor's selector.
 *
 * Verbatim from the former captureHqHeroRightmost / captureHqHeroHighestCost /
 * captureHqHeroLowestCost cases. The hyphenated descriptor selector maps to
 * captureHeroFromHq's camelCase selector union.
 */
function villainEffectCaptureHqHero(
  G: LegendaryGameState,
  _currentPlayer: string,
  cardId: CardExtId,
  _timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  if (descriptor.selector === 'rightmost') {
    // why: captures the rightmost non-null hero from the HQ (index 4 → 0)
    return applicationFromCapture(captureHeroFromHq(G, cardId, 'rightmost'));
  }
  if (descriptor.selector === 'highest-cost') {
    // why: captures the highest-cost hero from the HQ; ties resolved by
    // rightmost index per selector determinism contract (WP-214)
    return applicationFromCapture(captureHeroFromHq(G, cardId, 'highestCost'));
  }
  if (descriptor.selector === 'lowest-cost') {
    // why: captures the lowest-cost hero from the HQ; ties resolved by
    // rightmost index per selector determinism contract (WP-214)
    return applicationFromCapture(captureHeroFromHq(G, cardId, 'lowestCost'));
  }
  // why: an unknown selector matched no branch — the handler ran but touched
  // nothing (no capture). Still "applied" per the post-safe-skip contract.
  return { targets: [] };
}

/**
 * Builds the effect application from a `captureHeroFromHq` result: the captured
 * hero ext_id is the log target, or `targets: []` when the HQ was empty (null).
 *
 * @param captureResult - The `captureHeroFromHq` return, or null on empty HQ.
 * @returns The effect application carrying the captured hero, if any.
 */
function applicationFromCapture(
  captureResult: CaptureHeroResult | null,
): VillainEffectApplication {
  if (captureResult === null) {
    return { targets: [] };
  }
  return { targets: [captureResult.capturedHeroId] };
}

/**
 * hero-deck-top-to-escape primitive — move the top hero-deck card to escaped.
 *
 * Verbatim from the former heroDeckTopToEscape case (WP-185).
 */
function villainEffectHeroDeckTopToEscape(
  G: LegendaryGameState,
  _currentPlayer: string,
  _cardId: CardExtId,
  _timing: VillainAbilityTiming,
  _descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  // why: WP-185 §Scope wrote "G.piles.heroDeck[0]" but the engine's hero
  // reservoir is the top-level G.heroDeck (GlobalPiles has no heroDeck); this
  // moves the top of that reservoir to the escaped pile. Silent no-op when the
  // reservoir is empty.
  if (G.heroDeck.length === 0) return { targets: [] };
  const topCard = G.heroDeck[0]!;
  G.heroDeck = G.heroDeck.slice(1);
  G.escapedPile = [...G.escapedPile, topCard];
  // why: WP-316 — the escaped hero-deck card is the log target.
  return { targets: [topCard] };
}

/**
 * capture-bystander primitive — attach a bystander to the triggering card,
 * awarding immediately on the Fight fire site.
 *
 * Verbatim from the former captureBystander case (WP-185 / D-18506).
 */
function villainEffectCaptureBystander(
  G: LegendaryGameState,
  currentPlayer: string,
  cardId: CardExtId,
  timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  const rescueCount = descriptor.magnitude;
  if (rescueCount === undefined) {
    // why: the un-counted variant — verbatim WP-185 / D-18506 behavior. This
    // descriptor reverse-maps to the `captureBystander` legacy keyword, so it
    // narrates via the generic "<timing> effect:" line and MUST NOT self-narrate
    // (that would double-log). Attach one bystander; award it immediately on Fight.
    const attachResult = attachBystanderToVillain(
      G.piles.bystanders,
      cardId,
      G.attachedBystanders,
    );
    G.piles.bystanders = attachResult.bystandersPile;
    G.attachedBystanders = attachResult.attachedBystanders;
    if (timing === 'onFight') {
      // why: the Fight fire site is post-award, so a bystander attached now
      // to a card already in the victory pile would be stranded (never
      // awarded). Award it immediately to preserve tabletop "rescue on
      // defeat" semantics (D-18506). No-op when the pile was empty (nothing
      // was attached).
      const zones = G.playerZones[currentPlayer];
      if (zones) {
        const awardResult = awardAttachedBystanders(
          cardId,
          G.attachedBystanders,
          zones.victory,
        );
        G.attachedBystanders = awardResult.attachedBystanders;
        zones.victory = awardResult.playerVictory;
      }
    }
    // why: WP-316 — a captured bystander narrates via the generic keyword label,
    // not a card name; targets stays [].
    return { targets: [] };
  }
  // why: WP-489 / D-24295 — the COUNTED variant (Abomination: rescue three). Its
  // magnitude-bearing descriptor has NO legacy reverse-map entry (descriptorKey
  // includes magnitude), so it is keyword-less and self-narrates; the generic
  // "Fight effect:" line never fires, and fightVillain's `bystandersRescued` was
  // snapshotted BEFORE effects ran, so there is no double-count. Mirrors
  // rescue-bystanders-current-by-trait-count's attach+award loop; supply-bounded.
  const zones = G.playerZones[currentPlayer];
  let rescued = 0;
  for (let rescueIndex = 0; rescueIndex < rescueCount; rescueIndex++) {
    if (G.piles.bystanders.length === 0) {
      // why: the supply ran dry — stop (rescue is bounded by the Bystander supply).
      break;
    }
    const attachResult = attachBystanderToVillain(
      G.piles.bystanders,
      cardId,
      G.attachedBystanders,
    );
    G.piles.bystanders = attachResult.bystandersPile;
    G.attachedBystanders = attachResult.attachedBystanders;
    if (timing === 'onFight' && zones) {
      // why: award immediately on Fight (post-award fire site) so the rescued
      // bystander is not stranded on a card already in the victory pile (D-18506).
      const awardResult = awardAttachedBystanders(cardId, G.attachedBystanders, zones.victory);
      G.attachedBystanders = awardResult.attachedBystanders;
      zones.victory = awardResult.playerVictory;
    }
    rescued += 1;
  }
  // why: self-narrate the actual count (keyword-less). `G.messages` is hash-
  // excluded (D-24081). Zero rescued (empty supply) is a reachable no-op → `blocked`.
  const label = villainEffectTimingLabel(timing);
  pushLog(
    G,
    `${label} effect: rescued ${String(rescued)} Bystander(s).`,
    rescued > 0 ? 'applied' : 'blocked',
  );
  // why: WP-316 — rescued bystanders narrate by count, not by name; targets stays [].
  return { targets: [] };
}

/**
 * scry-ko-own-deck primitive — look at the top two cards of the current
 * (defeating) player's own deck, KO exactly one (the deterministically-worst
 * card), and leave the other on top in its original position (D-24267 /
 * WP-447). Doombot Legion's Fight: "Look at the top two cards of your deck. KO
 * one of them and put the other back."
 *
 * Self-narrates via `pushLog` naming the KO'd card, because `scry-ko-own-deck`
 * is not a legacy keyword — `descriptorToLegacyKeyword` returns undefined, so
 * the executor records no `VillainEffectResult` for it and the generic
 * `fightVillain.ts` "Fight effect:" line never fires. The returned `targets`
 * (the KO'd ext_id) are for parity with the other handlers; the log line is the
 * user-visible surface.
 */
function villainEffectScryKoOwnDeck(
  G: LegendaryGameState,
  currentPlayer: string,
  _cardId: CardExtId,
  _timing: VillainAbilityTiming,
  _descriptor: VillainEffectDescriptor,
  shuffleContext?: ShuffleProvider,
): VillainEffectApplication {
  const zones = G.playerZones[currentPlayer];
  if (!zones) return { targets: [] };
  // why: WP-478 / D-24285 — "look at the top two cards" is a reveal, so a short
  // deck reshuffles the discard to top up toward two, per the standard Legendary
  // rule (superseding WP-447's "scry never reshuffles" stance FOR THIS HANDLER).
  // Runs BEFORE the 0/1/≥2 branch so the branch decides on the post-reshuffle deck.
  // No-ops on an empty discard, so a genuinely exhausted deck+discard still falls
  // through to the reachable no-op below.
  if (zones.deck.length < 2) {
    reshuffleDiscardIntoDeck(zones, shuffleContext);
  }
  // why: empty deck (after any reshuffle) is a reachable no-op, never a hollow
  // record — the handler ran, there was simply nothing to look at.
  if (zones.deck.length === 0) return { targets: [] };

  // why: WP-470 / D-24282 — a single-card deck still AUTO-KOs (unchanged from
  // WP-447). There is only one card to look at, so there is nothing to choose —
  // parking a choice with one option would freeze the board for a no-decision.
  // Look at 1, KO it, no "other" to return.
  if (zones.deck.length === 1) {
    const soleCard = zones.deck[0]!;
    const moveResult = moveCardFromZone(zones.deck, [], soleCard);
    if (!moveResult.found) return { targets: [] };
    zones.deck = moveResult.from;
    G.ko = koCard(G.ko, soleCard);
    // why: scry-ko self-narrates — the keyword-less descriptor is dropped by the
    // result-recording path (descriptorToLegacyKeyword → undefined), so the
    // generic Fight-effect log line does not fire. `G.messages` is hash-excluded
    // (D-24081), so this adds no replay surface.
    const koName = resolveCardDisplayName(G, soleCard);
    pushLog(G, `Fight effect: KO'd "${koName}" from the top of your deck.`, 'neutral', soleCard);
    return { targets: [soleCard] };
  }

  // why: WP-470 / D-24282 — with ≥2 cards the interactive upgrade PARKS a choice
  // and KOs nothing yet. The player looks at the top two and picks which to KO
  // (the other stays on top); the auto-pick (selectScryKoTarget) is now only the
  // bot/sim default (ai.legalMoves) so par/replay stay byte-identical, while live
  // human play gets real agency (the Jeff-reported missing-agency bug — the
  // auto-resolve KO'd a real hero when both top cards were heroes). The pending
  // state ships WITH its block-all guard + UIState projection + client prompt
  // (project_pending_choice_no_ux_freeze). The top-2 ext_ids are snapshotted onto
  // the pending entry (D-24282): the block-all guard freezes the deck top, so the
  // snapshot cannot drift, and KO-by-ext_id is outcome-identical.
  const revealedCardIds = zones.deck.slice(0, 2);
  if (!G.pendingScryKoChoices) G.pendingScryKoChoices = [];
  G.pendingScryKoChoices.push({
    choiceType: 'scry-ko',
    playerID: currentPlayer,
    revealedCardIds,
  });
  // why: self-narrate the park so the log records that the choice opened; the
  // resolve move narrates the actual KO. Outcome 'neutral' — nothing has landed
  // yet. `G.messages` is hash-excluded (D-24081), so this adds no replay surface.
  pushLog(G, 'Fight effect: look at the top two cards of your deck — choose one to KO.', 'neutral');
  // why: WP-316 — pending: true marks the parked interactive KO; no card is KO'd
  // yet, so no target name is known. targets stays []. (This result is dropped by
  // the recording path anyway — scry-ko is keyword-less — but the shape is kept
  // parallel to the ko-hero parker for consistency.)
  return { targets: [], pending: true };
}

/**
 * Selects the deterministically-worst card to KO from the revealed scry cards.
 *
 * Priority (D-24267): (1) the first Wound in reveal order, else (2) the first
 * starting S.H.I.E.L.D. card (Trooper / Agent), lex-lowest, else (3) the
 * lexically-lowest ext_id among the revealed cards.
 *
 * @param revealed - The looked-at cards (the top `min(2, deck.length)` of the deck).
 * @returns The ext_id to KO, or null when `revealed` is empty.
 */
// why: Wounds are KO-PREFERRED here because this thins the player's own deck —
// removing a Wound from your deck is strictly good. This is the OPPOSITE of
// selectKoHeroTarget (the KO-a-Hero pool), which EXCLUDES Wounds because there a
// Wound is not a Hero and KOing one would invert the penalty into a benefit.
// Different pool, different rule — do NOT merge the two selectors. Membership
// uses closed enums (WOUND_EXT_ID, SHIELD_*_EXT_ID), so the pick reads no
// registry and stays deterministic (no ctx.random).
export function selectScryKoTarget(revealed: CardExtId[]): CardExtId | null {
  for (const candidate of revealed) {
    if (candidate === WOUND_EXT_ID) {
      return candidate;
    }
  }
  let startingSelected: CardExtId | null = null;
  for (const candidate of revealed) {
    if (candidate === SHIELD_AGENT_EXT_ID || candidate === SHIELD_TROOPER_EXT_ID) {
      if (startingSelected === null || candidate < startingSelected) {
        startingSelected = candidate;
      }
    }
  }
  if (startingSelected !== null) {
    return startingSelected;
  }
  let lowestSelected: CardExtId | null = null;
  for (const candidate of revealed) {
    if (lowestSelected === null || candidate < lowestSelected) {
      lowestSelected = candidate;
    }
  }
  return lowestSelected;
}

/**
 * gain-attached-hero primitive — a deliberate NO-OP (WP-450 / D-24270).
 *
 * The captured-hero return on defeat ("Fight: Gain that Hero" — Skrull Queen
 * Veranke, Skrull Shapeshifters, Klaw) is already performed GENERICALLY at the
 * fight site by `awardAttachedHeroes` (WP-431), which runs BEFORE this executor
 * and is not gated on the card text. This handler mutates nothing and returns
 * `{ targets: [] }`.
 */
function villainEffectGainAttachedHero(
  _G: LegendaryGameState,
  _currentPlayer: string,
  _cardId: CardExtId,
  _timing: VillainAbilityTiming,
  _descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  // why: D-24270 — the handler exists ONLY to make `Fight: Gain that Hero` a
  // recognized, reachable effect so the D-24266 detector classifies the line
  // applied rather than falsely recording an `unmarked-ability` breadcrumb (the
  // award itself is the generic WP-431 `awardAttachedHeroes` at the fight site).
  // It deliberately performs no mutation — driving the award from here would move
  // a hashed `G` mutation into the executor (an ordering + finalStateHash risk)
  // for no behaviour gain, so that refactor is out of scope. Reachable no-op,
  // never hollow.
  return { targets: [] };
}

/**
 * become-scheme-twist primitive — a deliberate NO-OP in the executor (WP-481 /
 * D-24287).
 *
 * The handler exists ONLY to make Mystique's `Escape: … becomes a Scheme Twist`
 * a recognized, reachable effect so the D-24266 detector classifies the line
 * applied rather than falsely recording an `unmarked-ability` breadcrumb, and the
 * WP-257 hollow detector sees a handler was reached. It deliberately performs no
 * mutation: triggering the twist needs the scheme-twist RULE pipeline
 * (executeRuleHooks('onSchemeTwistRevealed') + applyRuleEffects), which requires
 * the hookRegistry + implementationMap + RevealContext the executor does NOT
 * receive — so the actual twist is fired from the escape fire site in
 * villainDeck.reveal.ts (villainCardEscapeTriggersSchemeTwist), where all three
 * are in scope. Reachable no-op, never hollow.
 */
function villainEffectBecomeSchemeTwist(
  _G: LegendaryGameState,
  _currentPlayer: string,
  _cardId: CardExtId,
  _timing: VillainAbilityTiming,
  _descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  return { targets: [] };
}

/**
 * Whether the given card carries a `become-scheme-twist` onEscape descriptor —
 * i.e. its escape should trigger the active scheme's Scheme Twist (WP-481 /
 * D-24287). Read at the escape fire site (villainDeck.reveal.ts) to decide
 * whether to run the onSchemeTwistRevealed rule pipeline after the escape's
 * villain abilities resolve. Pure lookup over G.villainAbilityHooks; no mutation.
 *
 * @param G - Game state (read-only).
 * @param cardId - The escaped card's zone-instance ext_id.
 * @returns true when an onEscape hook for the card declares `become-scheme-twist`.
 */
export function villainCardEscapeTriggersSchemeTwist(
  G: LegendaryGameState,
  cardId: CardExtId,
): boolean {
  // why: guard against G states / test mocks lacking villainAbilityHooks (mirrors
  // the executeVillainAbilities guard) — getVillainHooksForCard would throw on
  // undefined. No hooks means no become-scheme-twist escape.
  if (!G.villainAbilityHooks || G.villainAbilityHooks.length === 0) {
    return false;
  }
  const hooks = getVillainHooksForCard(G.villainAbilityHooks, cardId, 'onEscape');
  for (const hook of hooks) {
    for (const descriptor of hook.effects ?? []) {
      if (descriptor.primitive === 'become-scheme-twist') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Maps a villain ability timing to its human log-label ('Fight' / 'Ambush' /
 * 'Escape') for a self-narrated effect line.
 *
 * The three fire sites hardcode "Fight effect:" / "Ambush effect:" / "Escape
 * effect:" per site; several keyword-less handlers self-narrate from one handler
 * that fires at more than one timing (reveal-or-wound at all three; the WP-489
 * gain-wound:each-other / counted capture-bystander / city-gate lines), so they
 * need the label from the timing they received.
 *
 * @param timing - The timing that fired ('onFight' | 'onAmbush' | 'onEscape').
 * @returns The capitalized label matching the per-site convention.
 */
function villainEffectTimingLabel(timing: VillainAbilityTiming): string {
  if (timing === 'onAmbush') {
    return 'Ambush';
  }
  if (timing === 'onFight') {
    return 'Fight';
  }
  // why: only 'onEscape' remains — the VillainAbilityTiming union is closed to
  // the three values, so this is total without a default-throw.
  return 'Escape';
}

/**
 * Returns whether a player HAS a Hero — in hand OR in play — whose trait matches
 * the predicate.
 *
 * Scans the passed card ext_ids (the player's hand + in-play zones) via the
 * setup-time `G.cardTraits` snapshot: a `team` predicate needs a card whose
 * `trait.team` equals the (normalized) value, a `hero-class` predicate needs
 * `trait.heroClass`.
 *
 * @param cardIds - The player's hand + in-play card ext_ids.
 * @param cardTraits - The setup-time `{ team, heroClass }` trait snapshot.
 * @param kind - The predicate kind ('team' | 'hero-class').
 * @param value - The normalized trait slug to match.
 * @returns True when the player has at least one matching Hero in hand or in play.
 */
// why: D-24290 — the per-card trait match, extracted at the third caller
// (playerHasHeroMatchingTrait, countPlayerHeroesMatchingTrait, and the
// ko-heroes-current-by-trait handler) per the duplicate-first / abstract-on-third
// rule (§Abstraction). A `team` predicate matches `trait.team`; a `hero-class`
// predicate matches `trait.heroClass`. `value` is normalized at parse time, so
// `===` is casing/whitespace-safe.
function cardTraitMatches(
  cardTraits: LegendaryGameState['cardTraits'],
  cardId: CardExtId,
  kind: 'team' | 'hero-class',
  value: string,
): boolean {
  const trait = cardTraits[cardId];
  if (trait === undefined) {
    return false;
  }
  if (kind === 'team') {
    return trait.team === value;
  }
  // why: the kind union is closed to 'team' | 'hero-class', so the remaining case
  // is 'hero-class' — total without a default branch.
  return trait.heroClass === value;
}

// why: D-24281 (AMENDED 2026-07-31) — scans HAND + IN-PLAY, matching the D-24076
// defeat-requirement's `playerMeetsDefeatRequirement` scope. WP-469 originally
// shipped this HAND-ONLY ("the printed reveal is a hand action"), but the
// Fight/Ambush/Escape effect resolves AFTER the play phase, so a Hero the player
// already played this turn sits in `inPlay`, not `hand` — hand-only then wounded a
// player who plainly HAS a qualifying Hero (live Magneto match, 2026-07-31: fought
// Sabretooth having already played Wolverine → wrongly wounded). Counting in-play
// too makes "you have an X-Men Hero" satisfy the reveal, as the operator ruled.
// Discard + deck stay excluded (only hand + play are "revealable"). No `.reduce()`.
function playerHasHeroMatchingTrait(
  cardIds: readonly CardExtId[],
  cardTraits: LegendaryGameState['cardTraits'],
  kind: 'team' | 'hero-class',
  value: string,
): boolean {
  for (const cardId of cardIds) {
    if (cardTraitMatches(cardTraits, cardId, kind, value)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns HOW MANY of a player's Heroes — in hand OR in play — match the trait
 * predicate (the count sibling of `playerHasHeroMatchingTrait`, D-24290).
 *
 * Same hand+in-play scope and same `G.cardTraits` snapshot as its boolean sibling;
 * used by `rescue-bystanders-current-by-trait-count` (Baron Zemo) to size the
 * rescue by the number of matching Heroes rather than a mere has/has-not.
 *
 * @param cardIds - The player's hand + in-play card ext_ids.
 * @param cardTraits - The setup-time `{ team, heroClass }` trait snapshot.
 * @param kind - The predicate kind ('team' | 'hero-class').
 * @param value - The normalized trait slug to match.
 * @returns The number of matching Heroes across hand + in-play.
 */
function countPlayerHeroesMatchingTrait(
  cardIds: readonly CardExtId[],
  cardTraits: LegendaryGameState['cardTraits'],
  kind: 'team' | 'hero-class',
  value: string,
): number {
  let count = 0;
  for (const cardId of cardIds) {
    if (cardTraitMatches(cardTraits, cardId, kind, value)) {
      count += 1;
    }
  }
  return count;
}

/**
 * reveal-or-wound primitive — each player either reveals (from hand OR play) a Hero
 * whose trait matches the descriptor's predicate, or — only when they have no match —
 * gains a Wound (D-24281 / WP-469; amended 2026-07-31 to count in-play Heroes).
 * Sabretooth's "Fight: Each player reveals an X-Men Hero or gains a Wound." and the
 * core siblings (Frost Giant, Ymir, Ultron, Zzzax) across Fight / Ambush / Escape timings.
 *
 * Auto-resolved (a Wound-averse player always reveals when able, so no player
 * choice is parked) and deterministic — each player in
 * `Object.keys(G.playerZones).sort()`, the hand+in-play trait predicate, one Wound on
 * no match. Self-narrates via `pushLog` (like scry-ko, reveal-or-wound is not a
 * legacy keyword — `descriptorToLegacyKeyword` returns undefined, so no
 * `VillainEffectResult` is recorded and the generic `<timing> effect:` line never
 * fires). Returns `{ targets: [] }`; the log line is the user-visible surface.
 */
function villainEffectRevealOrWound(
  G: LegendaryGameState,
  currentPlayer: string,
  _cardId: CardExtId,
  timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  const requireKind = descriptor.requireKind;
  const requireValue = descriptor.requireValue;
  // why: defensive — a well-formed reveal-or-wound descriptor always carries both
  // predicate fields (parseParameterizedEffect sets them together, D-24281).
  // A malformed hook lacking them cannot evaluate the predicate, so no player is
  // wounded and the handler no-ops (never wounds everyone on an empty predicate).
  // Reachable only via a hand-built test hook, never from the parser.
  if (requireKind === undefined || requireValue === undefined) {
    return { targets: [] };
  }

  // why: sorted player-id iteration for replay determinism (D-18902), matching
  // the each-player gain-wound / ko-hero paths.
  const woundedPlayerIds: string[] = [];
  for (const playerId of Object.keys(G.playerZones).sort()) {
    const zones = G.playerZones[playerId];
    if (!zones) {
      continue;
    }
    if (
      playerHasHeroMatchingTrait(
        [...zones.hand, ...zones.inPlay],
        G.cardTraits,
        requireKind,
        requireValue,
      )
    ) {
      // why: the player HAS a matching Hero in hand or in play — no Wound, no
      // mutation (D-24281 amended: in-play Heroes count, see the helper).
      continue;
    }
    // why: no matching Hero in hand or in play — gain one Wound. Empty pile is a reachable
    // no-op (mirrors gain-wound:each): the player is NOT counted as wounded, so
    // the narration below stays honest.
    if (G.piles.wounds.length === 0) {
      continue;
    }
    const woundResult = gainWound(G.piles.wounds, zones.discard);
    G.piles.wounds = woundResult.woundsPile;
    zones.discard = woundResult.playerDiscard;
    if (playerId === currentPlayer) {
      // why: woundsDrawn projects the CURRENT player's wounds only (UI economy) —
      // bump it only for the current player, parity with gain-wound:each and the
      // escape-wound path; a non-current wounded player must not move it.
      G.turnEconomy.woundsDrawn += 1;
    }
    woundedPlayerIds.push(playerId);
  }

  // why: self-narrate ONE line with the pinned templates (D-24281). reveal-or-wound
  // is keyword-less so the result-recording path drops it; without this push the
  // effect would land silently. `G.messages` is hash-excluded (D-24081), so this
  // adds no replay surface. Outcome colour is honest per the WP-434 contract: the
  // wound landed on ≥1 player → `applied`; every player revealed (the villain
  // effect touched no one) → `blocked`.
  const label = villainEffectTimingLabel(timing);
  if (woundedPlayerIds.length > 0) {
    const names = woundedPlayerIds.map((playerId) => `Player ${playerId}`).join(', ');
    pushLog(
      G,
      `${label} effect: ${String(woundedPlayerIds.length)} player(s) had no matching Hero and gained a Wound (${names}).`,
      'applied',
    );
  } else {
    pushLog(G, `${label} effect: every player revealed a matching Hero.`, 'blocked');
  }
  return { targets: [] };
}

/**
 * draw-cards-current primitive — the current (defeating) player draws `drawCount`
 * cards via the shared `drawCardsIntoHand` path (Enchantress "Fight: Draw three
 * cards.", D-24290 / WP-485).
 *
 * Self-narrates via `pushLog`: like `scry-ko` / `reveal-or-wound`,
 * draw-cards-current is keyword-less (`descriptorToLegacyKeyword` returns
 * undefined), so the executor records no `VillainEffectResult` and the generic
 * `<timing> effect:` line never fires — this push is the user-visible surface.
 * Returns `{ targets: [] }` (drawn cards narrate by count, not by name).
 */
function villainEffectDrawCardsCurrent(
  G: LegendaryGameState,
  currentPlayer: string,
  _cardId: CardExtId,
  _timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
  shuffleContext?: ShuffleProvider,
): VillainEffectApplication {
  const drawCount = descriptor.drawCount;
  // why: EC-520 — guard BOTH optional inputs defensively rather than loosen
  // `drawCardsIntoHand`'s required `count` / `ShuffleProvider` params (that helper
  // is out of the allowlist). A malformed hook lacking `drawCount` (reachable only
  // via a hand-built test hook — the parser always sets it) no-ops; an absent
  // `shuffleContext` no-ops because a draw can reshuffle the discard and we never
  // reach for a non-deterministic fallback (determinism invariant). The Fight fire
  // site always threads `{ random }`, so live play always has one.
  if (drawCount === undefined) {
    return { targets: [] };
  }
  if (shuffleContext === undefined) {
    return { targets: [] };
  }
  const zones = G.playerZones[currentPlayer];
  if (!zones) {
    return { targets: [] };
  }
  const handSizeBefore = zones.hand.length;
  drawCardsIntoHand(zones, drawCount, shuffleContext);
  const drawn = zones.hand.length - handSizeBefore;
  // why: D-24290 — all three Tier-A primitives are Fight-timed (the markers are
  // authored under `.fight`), so the label is hardcoded "Fight effect:" as the
  // scry-ko handler does for the Fight-only Doombot; a draw that moved 0 cards
  // (empty deck + discard) is honestly `blocked`, else `applied`.
  pushLog(G, `Fight effect: drew ${String(drawn)} card(s).`, drawn > 0 ? 'applied' : 'blocked');
  return { targets: [] };
}

/**
 * override-next-hand-size primitive — set the current (defeating) player's next
 * `onBegin` hand-fill target to the descriptor `magnitude` (the core spider-foes
 * Doctor Octopus villain Fight: "draw eight cards instead of six", D-24307 /
 * WP-503).
 *
 * Writes the WP-497-owned shared `G.handSizeOverrides[currentPlayer]`; the
 * play-phase `onBegin` fill (game.ts) consumes and clears it on the fighting
 * player's next turn. This handler adds NO new `G` field and NO second
 * consumption point (WP-497 owns both).
 *
 * Self-narrates via `pushLog`: like `draw-cards-current`, override-next-hand-size
 * is keyword-less (`descriptorToLegacyKeyword` returns undefined), so the executor
 * records no `VillainEffectResult` and the generic `<timing> effect:` line never
 * fires — this push is the user-visible surface. Returns `{ targets: [] }` (the
 * override touches no card).
 */
function villainEffectOverrideNextHandSize(
  G: LegendaryGameState,
  currentPlayer: string,
  _cardId: CardExtId,
  timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  const targetHandSize = descriptor.magnitude;
  // why: EC-538 — a malformed hook lacking `magnitude` (reachable only via a
  // hand-built test hook — the parser always sets it) no-ops rather than writing an
  // undefined override, which the WP-497 `onBegin` fill would then read as `??
  // HAND_SIZE` (a silent wrong fill). Guard it here.
  if (targetHandSize === undefined) {
    return { targets: [] };
  }
  // why: D-24307 — the villain-side WRITER of the WP-497-owned field. Lazy-init the
  // container with WP-497's exact idiom (never seeded in buildInitialGameState);
  // WP-497's game.ts `onBegin` reads `handSizeOverrides[player] ?? HAND_SIZE` and
  // deletes the entry after one fill. NO new `G` field, NO second consumption site.
  if (G.handSizeOverrides === undefined) {
    G.handSizeOverrides = {};
  }
  G.handSizeOverrides[currentPlayer] = targetHandSize;
  // why: self-narrate (keyword-less; the D-24266 unmarked-ability breadcrumb is
  // removed by marking the card). `G.messages` is hash-excluded (D-24081), so this
  // adds no replay surface. The label is derived from the fired timing (Doc Ock is
  // Fight-timed) for correctness at any fire site.
  const label = villainEffectTimingLabel(timing);
  pushLog(
    G,
    `${label} effect: your next hand draws ${String(targetHandSize)} cards instead of ${String(HAND_SIZE)}.`,
    'applied',
  );
  return { targets: [] };
}

// why: D-24296 — the basic S.H.I.E.L.D. cards (starting Agents + Troopers, and the
// recruited S.H.I.E.L.D. Officer) ARE team S.H.I.E.L.D. physically, so the Destroyer
// "KO all your [team:shield] Heroes" is meant to wipe them — but they are synthetic
// game-component cards with no `G.cardTraits` entry (cardTraits is built only from
// registry hero entries, buildCardTraits.ts), so the generic team predicate misses
// them and the Fight KO'd zero (live Loki/Thor 2p, 2026-08-03). This set names the
// three teamless basic-S.H.I.E.L.D. ext_ids for the KO handler ONLY.
const BASIC_SHIELD_EXT_IDS: ReadonlySet<CardExtId> = new Set([
  SHIELD_AGENT_EXT_ID,
  SHIELD_TROOPER_EXT_ID,
  SHIELD_OFFICER_EXT_ID,
]);

/**
 * Whether a card matches the ko-heroes-current-by-trait predicate — the shared
 * `cardTraitMatches`, WIDENED so a `team:shield` predicate also matches the three
 * teamless basic-S.H.I.E.L.D. cards (D-24296).
 *
 * Deliberately local to the Destroyer KO handler: the shared `cardTraitMatches`,
 * `playerHasHeroMatchingTrait`, and `countPlayerHeroesMatchingTrait` are LEFT
 * UNCHANGED, so the corpus-wide `[team:shield]` synergies and Baron Zemo's
 * rescue-by-count are unaffected (narrow fix — operator ruling 2026-08-03).
 *
 * @param cardTraits - The setup-time `{ team, heroClass }` trait snapshot.
 * @param cardId - The card being tested.
 * @param kind - The predicate kind ('team' | 'hero-class').
 * @param value - The normalized trait slug to match.
 * @returns True if the card matches the trait, or is a basic S.H.I.E.L.D. card
 *   under a `team:shield` predicate.
 */
function koHeroMatchesTraitOrBasicShield(
  cardTraits: LegendaryGameState['cardTraits'],
  cardId: CardExtId,
  kind: 'team' | 'hero-class',
  value: string,
): boolean {
  if (cardTraitMatches(cardTraits, cardId, kind, value)) {
    return true;
  }
  // why: only a team:shield predicate rescues the teamless basic-S.H.I.E.L.D. cards;
  // a hero-class predicate (or any other team value) never matches them.
  return kind === 'team' && value === 'shield' && BASIC_SHIELD_EXT_IDS.has(cardId);
}

/**
 * ko-heroes-current-by-trait primitive — KO EVERY current-player Hero matching the
 * trait predicate, from hand + in-play (the Destroyer "Fight: KO all your
 * [team:shield] Heroes.", D-24290 / WP-485).
 *
 * Auto-resolved (KO all matching — no player choice) and deterministic. Scans hand
 * then in-play in array order; a card matching the predicate is KO'd, the rest stay.
 * Self-narrates via `pushLog` (keyword-less — no `VillainEffectResult`); returns the
 * KO'd ext_ids as `targets` for parity (dropped by the recording path).
 */
function villainEffectKoHeroesCurrentByTrait(
  G: LegendaryGameState,
  currentPlayer: string,
  _cardId: CardExtId,
  _timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  const requireKind = descriptor.requireKind;
  const requireValue = descriptor.requireValue;
  // why: defensive — a well-formed descriptor always carries both predicate fields
  // (parseParameterizedEffect sets them together). A malformed hook lacking them
  // cannot evaluate the predicate, so nothing is KO'd (reachable only via a
  // hand-built test hook, never from the parser).
  if (requireKind === undefined || requireValue === undefined) {
    return { targets: [] };
  }
  const zones = G.playerZones[currentPlayer];
  if (!zones) {
    return { targets: [] };
  }
  // why: operator ruling 2026-08-01 — "your Heroes" includes Heroes played this
  // turn, which sit in `inPlay` (the Fight effect resolves after the play phase),
  // so the KO scans hand + in-play. This is the Destroyer's own zones, NOT the
  // discard→hand→inPlay per-player KO helper (koOneHeroForPlayer), whose zones +
  // starter-first selection are wrong for a "KO ALL matching" effect.
  const targets: CardExtId[] = [];
  const remainingHand: CardExtId[] = [];
  for (const cardId of zones.hand) {
    if (koHeroMatchesTraitOrBasicShield(G.cardTraits, cardId, requireKind, requireValue)) {
      targets.push(cardId);
    } else {
      remainingHand.push(cardId);
    }
  }
  const remainingInPlay: CardExtId[] = [];
  for (const cardId of zones.inPlay) {
    if (koHeroMatchesTraitOrBasicShield(G.cardTraits, cardId, requireKind, requireValue)) {
      targets.push(cardId);
    } else {
      remainingInPlay.push(cardId);
    }
  }
  zones.hand = remainingHand;
  zones.inPlay = remainingInPlay;
  for (const koedId of targets) {
    G.ko = koCard(G.ko, koedId);
  }
  // why: D-24290 — Fight-timed self-narration (see draw-cards-current). Zero
  // matching Heroes is a reachable no-op (`blocked`), never a hollow record.
  pushLog(
    G,
    `Fight effect: KO'd ${String(targets.length)} of your ${requireValue} Hero(es).`,
    targets.length > 0 ? 'applied' : 'blocked',
  );
  return { targets };
}

/**
 * rescue-bystanders-current-by-trait-count primitive — the current player rescues
 * one Bystander per Hero matching the trait predicate (hand + in-play), bounded by
 * the Bystander supply (Baron Zemo "Fight: For each of your [team:avengers] Heroes,
 * rescue a Bystander.", D-24290 / WP-485).
 *
 * Auto-resolved and deterministic. Self-narrates via `pushLog` (keyword-less — no
 * `VillainEffectResult`); returns `{ targets: [] }` (rescued Bystanders narrate by
 * count, not by name — the capture-bystander precedent).
 */
function villainEffectRescueBystandersCurrentByTraitCount(
  G: LegendaryGameState,
  currentPlayer: string,
  cardId: CardExtId,
  _timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  const requireKind = descriptor.requireKind;
  const requireValue = descriptor.requireValue;
  // why: defensive — same guard as ko-heroes-current-by-trait (a hand-built test
  // hook could omit the predicate; the parser never does).
  if (requireKind === undefined || requireValue === undefined) {
    return { targets: [] };
  }
  const zones = G.playerZones[currentPlayer];
  if (!zones) {
    return { targets: [] };
  }
  const rescueCount = countPlayerHeroesMatchingTrait(
    [...zones.hand, ...zones.inPlay],
    G.cardTraits,
    requireKind,
    requireValue,
  );
  // why: D-24290 — "rescue a Bystander" = award one from the supply to the current
  // player's Victory Pile, reusing the `capture-bystander` onFight player-award
  // mechanism (attach one to the triggering card, then award it). At the Fight fire
  // site the card's attached-bystander entry was already awarded + cleared (Step 3b,
  // fightVillain.ts) BEFORE this handler runs, so each iteration attaches exactly
  // one and awards exactly one. `attachBystanderToVillain` no-ops on an empty
  // supply, so the rescue is naturally bounded by the Bystander supply.
  let rescued = 0;
  for (let rescueIndex = 0; rescueIndex < rescueCount; rescueIndex++) {
    if (G.piles.bystanders.length === 0) {
      // why: the supply ran dry — stop (rescue is bounded by the Bystander supply).
      break;
    }
    const attachResult = attachBystanderToVillain(
      G.piles.bystanders,
      cardId,
      G.attachedBystanders,
    );
    G.piles.bystanders = attachResult.bystandersPile;
    G.attachedBystanders = attachResult.attachedBystanders;
    const awardResult = awardAttachedBystanders(cardId, G.attachedBystanders, zones.victory);
    G.attachedBystanders = awardResult.attachedBystanders;
    zones.victory = awardResult.playerVictory;
    rescued += 1;
  }
  // why: D-24290 — Fight-timed self-narration (see draw-cards-current). Zero
  // matching Heroes (or an empty supply) is a reachable no-op (`blocked`).
  pushLog(
    G,
    `Fight effect: rescued ${String(rescued)} Bystander(s) (one per your ${requireValue} Hero).`,
    rescued > 0 ? 'applied' : 'blocked',
  );
  return { targets: [] };
}

/**
 * Whether a player's Victory Pile holds a villain of the target group OTHER than
 * the just-defeated/escaped card (WP-494 / D-24299).
 *
 * Matches on the FULL anchored ext_id prefix `${setAbbr}-villain-${group}-` — a bare
 * `.includes('-villain-')` would false-match villain-deck bystanders
 * (`bystander-villain-deck-NN`, which carry the substring but start `bystander-`) and
 * would not scope to the group. The fought card is excluded ("*another*").
 *
 * @param victory - The player's Victory Pile ext_ids.
 * @param groupPrefix - The anchored prefix `${setAbbr}-villain-${group}-`.
 * @param foughtCardId - The Viper being resolved (excluded from the scan).
 * @returns True when the pile holds another group villain.
 */
function victoryPileHasOtherGroupVillain(
  victory: readonly CardExtId[],
  groupPrefix: string,
  foughtCardId: CardExtId,
): boolean {
  for (const victoryId of victory) {
    if (victoryId !== foughtCardId && victoryId.startsWith(groupPrefix)) {
      return true;
    }
  }
  return false;
}

/**
 * gain-wound-unless-victory-villain-group primitive — each player gains a Wound
 * UNLESS their Victory Pile holds another villain of the descriptor's group (Viper
 * "Fight/Escape: Each player without another HYDRA Villain in their Victory Pile
 * gains a Wound.", D-24299 / WP-494).
 *
 * Auto-resolved (no player choice) and deterministic — the reveal-or-wound skeleton
 * with the predicate swapped from a hand/play hero-trait to a Victory-Pile
 * villain-group membership test. Self-narrates via `pushLog` (keyword-less —
 * `descriptorToLegacyKeyword` returns undefined, so no `VillainEffectResult` is
 * recorded and the generic `<timing> effect:` line never fires). Returns
 * `{ targets: [] }`.
 */
function villainEffectGainWoundUnlessVictoryVillainGroup(
  G: LegendaryGameState,
  currentPlayer: string,
  cardId: CardExtId,
  timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
): VillainEffectApplication {
  const group = descriptor.victoryVillainGroup;
  // why: defensive — a well-formed descriptor always carries the group (the parser
  // sets it, D-24299). A malformed hook lacking it cannot evaluate the predicate, so
  // no player is wounded (never wounds everyone on an empty predicate). Reachable
  // only via a hand-built test hook, never from the parser.
  if (group === undefined) {
    return { targets: [] };
  }
  // why: D-24299 Path B — derive the villain group ext_id prefix from the fought
  // card's OWN ext_id rather than a villain-group `G` map (a new hashed setup field
  // would re-pin every committed fixture). The `-villain-` infix is unambiguous
  // (`setAbbr` has no hyphens); the match anchors on the FULL prefix
  // `${setAbbr}-villain-${group}-` (a bare `.includes('-villain-')` would false-match
  // villain-deck bystanders `bystander-villain-deck-NN`). A `cardId` lacking the infix
  // (a non-villain fire site) → no wound.
  const villainInfix = '-villain-';
  const infixIndex = cardId.indexOf(villainInfix);
  if (infixIndex < 0) {
    return { targets: [] };
  }
  const setAbbr = cardId.slice(0, infixIndex);
  const groupPrefix = `${setAbbr}${villainInfix}${group}-`;

  // why: sorted player-id iteration for replay determinism (D-18902), matching
  // reveal-or-wound / gain-wound:each.
  const woundedPlayerIds: string[] = [];
  for (const playerId of Object.keys(G.playerZones).sort()) {
    const zones = G.playerZones[playerId];
    if (!zones) {
      continue;
    }
    if (victoryPileHasOtherGroupVillain(zones.victory, groupPrefix, cardId)) {
      // why: the player HAS another group villain in their Victory Pile — no Wound.
      continue;
    }
    // why: no other group villain — gain one Wound. Empty pile is a reachable no-op
    // (mirrors gain-wound:each): the player is NOT counted as wounded, so the
    // narration below stays honest.
    if (G.piles.wounds.length === 0) {
      continue;
    }
    const woundResult = gainWound(G.piles.wounds, zones.discard);
    G.piles.wounds = woundResult.woundsPile;
    zones.discard = woundResult.playerDiscard;
    if (playerId === currentPlayer) {
      // why: woundsDrawn projects the CURRENT player's wounds only (UI economy) —
      // parity with reveal-or-wound / gain-wound:each; a non-current wounded player
      // must not move it.
      G.turnEconomy.woundsDrawn += 1;
    }
    woundedPlayerIds.push(playerId);
  }

  // why: self-narrate ONE line (keyword-less — the result-recording path drops it).
  // `G.messages` is hash-excluded (D-24081). Honest colour per the WP-434 contract:
  // a wound landed → `applied`; every player was safe → `blocked`.
  const label = villainEffectTimingLabel(timing);
  if (woundedPlayerIds.length > 0) {
    const names = woundedPlayerIds.map((playerId) => `Player ${playerId}`).join(', ');
    pushLog(
      G,
      `${label} effect: ${String(woundedPlayerIds.length)} player(s) had no other ${group} Villain in their Victory Pile and gained a Wound (${names}).`,
      'applied',
    );
  } else {
    pushLog(
      G,
      `${label} effect: every player had another ${group} Villain in their Victory Pile.`,
      'blocked',
    );
  }
  return { targets: [] };
}

// why: D-24023 — the ImplementationMap keyed by primitive (mirrors WP-251's
// HERO_EFFECT_HANDLERS). Full Record over the 14 primitives; the drift test
// asserts the key set equals VILLAIN_EFFECT_PRIMITIVES. Replaces the former
// 10-arm switch on VillainEffectKeyword. `scry-ko-own-deck` appended by WP-447
// (D-24267); `gain-attached-hero` (no-op) appended by WP-450 (D-24270);
// `reveal-or-wound` appended by WP-469 (D-24281); `become-scheme-twist` (no-op —
// the twist fires from the escape fire site) appended by WP-481 (D-24287);
// `draw-cards-current`, `ko-heroes-current-by-trait`, and
// `rescue-bystanders-current-by-trait-count` (auto-resolve) appended by WP-485
// (D-24290); `gain-wound-unless-victory-villain-group` (auto-resolve, conditional
// each-player wound on a Victory-Pile group predicate) appended by WP-494 (D-24299).
// `override-next-hand-size` (auto-resolve — writes the WP-497 `handSizeOverrides`
// field) appended by WP-503 (D-24307 — the core spider-foes Doctor Octopus villain
// Fight: draw 8 next hand instead of 6).
/** Villain effect handlers keyed by primitive. Single dispatch source. */
const VILLAIN_EFFECT_HANDLERS: Record<VillainEffectPrimitive, VillainEffectHandler> = {
  'ko-hero': villainEffectKoHero,
  'gain-wound': villainEffectGainWound,
  'capture-hq-hero': villainEffectCaptureHqHero,
  'hero-deck-top-to-escape': villainEffectHeroDeckTopToEscape,
  'capture-bystander': villainEffectCaptureBystander,
  'scry-ko-own-deck': villainEffectScryKoOwnDeck,
  'gain-attached-hero': villainEffectGainAttachedHero,
  'reveal-or-wound': villainEffectRevealOrWound,
  'become-scheme-twist': villainEffectBecomeSchemeTwist,
  'draw-cards-current': villainEffectDrawCardsCurrent,
  'ko-heroes-current-by-trait': villainEffectKoHeroesCurrentByTrait,
  'rescue-bystanders-current-by-trait-count': villainEffectRescueBystandersCurrentByTraitCount,
  'gain-wound-unless-victory-villain-group': villainEffectGainWoundUnlessVictoryVillainGroup,
  'override-next-hand-size': villainEffectOverrideNextHandSize,
};

/**
 * Applies one villain effect descriptor deterministically by dispatching to its
 * primitive handler.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param currentPlayer - The active player id.
 * @param cardId - The triggering villain/henchman card-instance ext_id.
 * @param timing - The timing that fired (changes capture-bystander behavior).
 * @param descriptor - The parameterized effect descriptor to apply.
 * @returns The handler's `VillainEffectApplication` (its targets + optional
 *   pending flag) when an in-vocab primitive handler ran (regardless of whether
 *   mutation guards short-circuited inside it); `null` only when no handler
 *   exists for the primitive (the former out-of-vocab default). WP-200 D-20003
 *   carries forward: drives the reverse-mapped results array — only descriptors
 *   whose handler ran are recorded (post-safe-skip contract).
 */
function applyVillainEffect(
  G: LegendaryGameState,
  currentPlayer: string,
  cardId: CardExtId,
  timing: VillainAbilityTiming,
  descriptor: VillainEffectDescriptor,
  shuffleContext?: ShuffleProvider,
  cityIndex?: number,
): VillainEffectApplication | null {
  const handler = VILLAIN_EFFECT_HANDLERS[descriptor.primitive];
  if (handler === undefined) {
    // why: out-of-vocabulary primitives safe-skip silently — moves never throw,
    // no console output, no message push (matches the WP-022 hero-effects
    // precedent). Reachable only via a malformed hook; the parser validates
    // markers before building descriptors. Returning null excludes the
    // descriptor from the executor's results[] (post-safe-skip contract).
    return null;
  }
  // why: WP-478 / D-24285 — forward the shuffle source so a deck-reveal handler
  // (scry) can reshuffle the discard on exhaustion; the other handlers ignore it.
  // WP-489 / D-24295 — forward the fought City index for signature uniformity (the
  // location gate already ran in the executor loop; no handler reads it today).
  return handler(G, currentPlayer, cardId, timing, descriptor, shuffleContext, cityIndex);
}

// ---------------------------------------------------------------------------
// Shared per-player KO resolver
// ---------------------------------------------------------------------------

/**
 * KOs one hero card from the given player's discard (priority) then hand.
 *
 * Shared per-player resolver called by BOTH the `koHeroCurrentPlayer` and
 * `koHeroEachPlayer` effect cases — the latter iterates every player in
 * `Object.keys(G.playerZones).sort()` order and calls this helper once per
 * player. There is no duplicated KO logic anywhere else in the executor
 * (D-18902); the per-player KO semantics live here and nowhere else.
 *
 * Originally introduced as `koHeroForCurrentPlayer` by WP-185 with a
 * misleading name (the parameter is any player id, not specifically the
 * current player); WP-189 renamed it to make the shared-helper intent
 * obvious and added the `koHeroEachPlayer` second call site.
 *
 * The resolver performs the `koCard` mutation itself — callers MUST NOT
 * post-process or modify its output. Both branches reach byte-identical
 * post-state on a single-player G (pinned by the shared-resolver parity
 * test).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerId - The target player id (any player; for the
 *   `koHeroCurrentPlayer` case this is `ctx.currentPlayer`, for the
 *   `koHeroEachPlayer` case it is each entry of the sorted player-ids
 *   iteration).
 */
// why: deterministic auto-resolution — zone priority is discard → hand →
// inPlay per D-20603 (which adds the third tier on top of D-18503's
// original discard-then-hand contract; the third tier closes the
// turn-1 autoplay no-op where every starter card the bot just played
// sits in inPlay while hand and discard are both empty). Within each
// tier, the D-20602 two-tier ext_id rule applies: starting SHIELD
// cards (`starting-shield-trooper`, `starting-shield-agent`) ahead of
// everything else, with ext_id lexical ascending as the tie-break.
// Starting-first preserves replay determinism and remains NOT VP-based
// — the starter set is a closed enum, no registry read (D-18503
// carries forward). The printed card grants player choice; interactive
// targeting is deferred to a future UI WP (WP-185 §Out of Scope). This
// function owns the `koCard` mutation site for the per-player KO —
// callers in both the `koHeroCurrentPlayer` and `koHeroEachPlayer`
// dispatch cases delegate to it and do not post-process its output, so
// the mutation site is uniform across branches (D-18902
// mutation-location lock; single source of truth for KO targeting +
// replay determinism).
function koOneHeroForPlayer(
  G: LegendaryGameState,
  playerId: string,
): CardExtId | null {
  const zones = G.playerZones[playerId];
  if (!zones) return null;

  const discardTarget = selectKoHeroTarget(zones.discard);
  if (discardTarget !== null) {
    const moveResult = moveCardFromZone(zones.discard, [], discardTarget);
    if (moveResult.found) {
      zones.discard = moveResult.from;
      G.ko = koCard(G.ko, discardTarget);
      // why: WP-316 — return the KO'd ext_id for the log target.
      return discardTarget;
    }
    // why: discard has strict priority — once a discard hero is chosen we stop
    // and never fall through to hand or inPlay.
    return null;
  }

  const handTarget = selectKoHeroTarget(zones.hand);
  if (handTarget !== null) {
    const moveResult = moveCardFromZone(zones.hand, [], handTarget);
    if (moveResult.found) {
      zones.hand = moveResult.from;
      G.ko = koCard(G.ko, handTarget);
      // why: WP-316 — return the KO'd ext_id for the log target.
      return handTarget;
    }
    // why: hand wins over inPlay once a hand hero is chosen.
    return null;
  }

  // why: D-20603 — inPlay is the third tier. The autoplay flow runs
  // `playCard` for every hand card (hand → inPlay) BEFORE the spend
  // phase that calls `fightVillain`, so on turn 1 (when nothing has
  // cycled into discard yet) both hand and discard are empty while
  // inPlay holds every starter SHIELD card the bot just played.
  // Without this third tier, a Sentinel Fight: KO no-ops silently
  // even though the printed text "KO one of your Heroes" clearly has
  // 6 eligible targets sitting in inPlay. Same starter-first priority
  // applies (D-20602 carries forward via selectKoHeroTarget).
  const inPlayTarget = selectKoHeroTarget(zones.inPlay);
  if (inPlayTarget !== null) {
    const moveResult = moveCardFromZone(zones.inPlay, [], inPlayTarget);
    if (moveResult.found) {
      zones.inPlay = moveResult.from;
      G.ko = koCard(G.ko, inPlayTarget);
      // why: WP-316 — return the KO'd ext_id for the log target.
      return inPlayTarget;
    }
  }
  // why: WP-316 — no eligible hero in any zone (or the move missed); no KO,
  // no target.
  return null;
}

/**
 * KOs up to `magnitude` heroes from ONE named source zone of a single player,
 * with NO cross-zone fallback (D-24280). Returns the KO'd ext_ids in KO order.
 *
 * The source-zone-restricted sibling of `koOneHeroForPlayer`: used for the
 * each-player `ko-hero` effect when the printed text names a single zone
 * (Juggernaut's "from their discard pile" / "from their hand"). Reuses
 * `selectKoHeroTarget` each iteration (Wounds excluded, starter S.H.I.E.L.D.
 * first, then ext_id lex-asc) and re-selects over the shortened zone, so
 * `magnitude` KOs the `magnitude` worst heroes in that zone.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerId - The target player id (any player; the each-player caller
 *   iterates `Object.keys(G.playerZones).sort()`).
 * @param zone - The single source zone to KO from ('discard' or 'hand').
 * @param magnitude - The maximum number of heroes to KO from that zone.
 * @returns The KO'd card ext_ids in KO order (WP-316 log targets).
 */
// why: D-24280 — unlike koOneHeroForPlayer (discard→hand→inPlay), this KOs ONLY
// from `zones[zone]` because the printed effect is source-restricted — it cannot
// reach the player's other zones, so a zone with fewer than `magnitude` heroes
// yields fewer KOs and an empty zone yields none, a reachable no-op (never
// hollow). Owns its own koCard mutation site so callers do not post-process
// (D-18902 mutation-location lock). No `ctx.random`, no `.reduce()`.
function koHeroesFromZoneForPlayer(
  G: LegendaryGameState,
  playerId: string,
  zone: 'discard' | 'hand',
  magnitude: number,
): CardExtId[] {
  const zones = G.playerZones[playerId];
  if (!zones) return [];
  const koedIds: CardExtId[] = [];
  for (let iteration = 0; iteration < magnitude; iteration++) {
    const target = selectKoHeroTarget(zones[zone]);
    if (target === null) {
      // why: the zone holds no more heroes — stop (no fallback to another zone).
      break;
    }
    const moveResult = moveCardFromZone(zones[zone], [], target);
    if (!moveResult.found) {
      break;
    }
    zones[zone] = moveResult.from;
    G.ko = koCard(G.ko, target);
    koedIds.push(target);
  }
  return koedIds;
}

/**
 * Selects the highest-priority hero card ext_id in a zone, or null.
 *
 * Priority (D-20602 amends D-18503):
 *   1. Starting SHIELD cards (Trooper / Agent) — KO the worst cards first
 *      so auto-resolution acts as deck-thinning, not as a penalty.
 *   2. Among non-starting non-wound cards, fall back to ext_id lexical
 *      ascending (the original D-18503 tie-break).
 *
 * @param zone - A player's hand or discard zone.
 * @returns The KO target ext_id, or null when the zone has no hero card.
 */
// why: a "hero card" for KO purposes is any card that is NOT a wound token.
// Wounds are not Heroes — KO-a-Hero must not remove a wound (that would
// invert the penalty into a benefit). Starting SHIELD cards (cost 0, +1
// attack OR +1 recruit each) are the worst cards in any deck; preferring
// them first turns the auto-resolution into deck-thinning instead of
// silently KO-ing the player's best recruited heroes (recruited ext_ids
// like 'core/spider-man/...' sort lex-before 'starting-shield-...' under
// pure lex-asc, so the pre-D-20602 heuristic always picked good cards).
// Membership check uses a closed enum, so the rule remains NOT VP-based
// and reads no registry at runtime (D-18503 carries forward).
function selectKoHeroTarget(zone: CardExtId[]): CardExtId | null {
  let startingSelected: CardExtId | null = null;
  let otherSelected: CardExtId | null = null;
  for (const candidate of zone) {
    if (candidate === WOUND_EXT_ID) continue;
    if (candidate === SHIELD_AGENT_EXT_ID || candidate === SHIELD_TROOPER_EXT_ID) {
      if (startingSelected === null || candidate < startingSelected) {
        startingSelected = candidate;
      }
    } else {
      if (otherSelected === null || candidate < otherSelected) {
        otherSelected = candidate;
      }
    }
  }
  return startingSelected ?? otherSelected;
}

// ---------------------------------------------------------------------------
// Interactive KO-a-Hero helpers (WP-242)
// ---------------------------------------------------------------------------

/**
 * Builds the deduped eligible KO-a-Hero targets across a player's zones.
 *
 * Scans discard, then hand, then inPlay — each in array index order — emitting
 * one target per non-wound card. Deduped by `(zone, cardId)` keeping the first
 * occurrence: two copies of the same ext_id in the same zone collapse to one
 * option (KOing either is outcome-identical), but the same ext_id in two
 * different zones stays two options (a discard-KO and an inPlay-KO differ).
 *
 * Used by the parker (count), resolveKoHeroChoice has no need of it, and the
 * WP-243 projection. Fresh recompute every call — no snapshot (D-24007).
 *
 * @param zones - The player's card zones.
 * @returns The eligible KO targets in deterministic scan order.
 */
export function buildKoEligibleTargets(zones: PlayerZones): KoHeroTarget[] {
  // why: per-zone (zone, cardId) dedupe — the same ext_id can legitimately
  // appear twice within one zone (e.g., two starting-shield-agent in discard);
  // KOing any copy of that ext_id in that zone is outcome-identical, so one
  // option is shown per (zone, cardId) rather than N identical entries. Dedupe
  // is per-zone: the same ext_id in two zones stays two distinct options.
  const targets: KoHeroTarget[] = [];
  const seen = new Set<string>();
  const orderedZones: KoHeroTarget['zone'][] = ['discard', 'hand', 'inPlay'];
  for (const zoneName of orderedZones) {
    for (const cardId of zones[zoneName]) {
      // why: a wound is never a "hero" for KO purposes (D-18503 carries
      // forward); wounds are excluded even when sitting in an otherwise-valid zone.
      if (cardId === WOUND_EXT_ID) continue;
      const key = `${zoneName}:${cardId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({ zone: zoneName, cardId });
    }
  }
  return targets;
}

/**
 * Counts a player's PHYSICAL KO-able heroes — every non-wound card across discard,
 * hand, and inPlay, WITHOUT the per-(zone, cardId) dedupe `buildKoEligibleTargets`
 * applies (WP-492 / D-24298).
 *
 * The magnitude-N current-player KO (Whirlwind) parks an interactive choice only
 * when the player has MORE KO-able heroes than the count owed (a genuine choice of
 * WHICH to spare); when the physical count is ≤ the count owed the KO is forced
 * (every hero dies), so it auto-resolves with no prompt. Distinct from the deduped
 * option count: two identical copies are one option but two physical heroes.
 *
 * @param zones - The player's card zones.
 * @returns The number of non-wound cards across discard + hand + inPlay.
 */
export function countKoableHeroes(zones: PlayerZones): number {
  let count = 0;
  const orderedZones: KoHeroTarget['zone'][] = ['discard', 'hand', 'inPlay'];
  for (const zoneName of orderedZones) {
    for (const cardId of zones[zoneName]) {
      // why: a wound is never a "hero" for KO purposes (D-18503) — excluded here too.
      if (cardId === WOUND_EXT_ID) continue;
      count += 1;
    }
  }
  return count;
}

/**
 * Selects the single default KO target the legacy auto-resolution would pick.
 *
 * Runs selectKoHeroTarget over discard, then hand, then inPlay, returning the
 * first non-null pick with its zone, or null when no zone has an eligible hero.
 *
 * This is the bot default pick AND the auto-1 pick, and it is the determinism
 * anchor (reuses the unchanged selectKoHeroTarget so the bot's KO target is
 * byte-identical to today's koOneHeroForPlayer resolution — D-24009).
 *
 * @param zones - The player's card zones.
 * @returns The default KO target, or null when no eligible hero exists.
 */
export function selectDefaultKoTarget(zones: PlayerZones): KoHeroTarget | null {
  // why: zone priority is discard → hand → inPlay (D-20603), identical to
  // koOneHeroForPlayer. selectKoHeroTarget owns the within-zone starter-first
  // tie-break (D-20602); reusing it verbatim keeps the bot KO target
  // byte-identical to the prior auto-resolution (D-24009 replay determinism).
  const discardTarget = selectKoHeroTarget(zones.discard);
  if (discardTarget !== null) {
    return { zone: 'discard', cardId: discardTarget };
  }
  const handTarget = selectKoHeroTarget(zones.hand);
  if (handTarget !== null) {
    return { zone: 'hand', cardId: handTarget };
  }
  const inPlayTarget = selectKoHeroTarget(zones.inPlay);
  if (inPlayTarget !== null) {
    return { zone: 'inPlay', cardId: inPlayTarget };
  }
  return null;
}

/**
 * KOs a single target card out of the named zone (the auto-1 mutation).
 *
 * The two-line mutation resolveKoHeroChoice also performs: moveCardFromZone the
 * cardId out of the zone, then koCard it on `found`. One copy here, one in the
 * move (§16.1 duplicate-twice — a third appearance would justify extracting it).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param zones - The player's card zones (the source zone is shortened in place).
 * @param target - The { zone, cardId } to KO.
 * @returns The KO'd card ext_id (WP-316 log target), or null when the move
 *   found no matching card.
 */
function koSingleTarget(
  G: LegendaryGameState,
  zones: PlayerZones,
  target: KoHeroTarget,
): CardExtId | null {
  const moveResult = moveCardFromZone(zones[target.zone], [], target.cardId);
  if (moveResult.found) {
    zones[target.zone] = moveResult.from;
    G.ko = koCard(G.ko, target.cardId);
    return target.cardId;
  }
  return null;
}
