/**
 * strikeBlockedVfxManifest.ts
 *
 * The `strikeBlocked` shield-block beat's `threatKind` → visual model (WP-647) —
 * the juice the ewiki `#surface-block` mock (`block-shield.svg`, PR #1797)
 * proposed, riding the WP-556 VFX foundation. When a player reveals a Hero to
 * avoid a threat (a Magneto/Doom Master Strike, a reveal-or-punish Scheme Twist,
 * or a villain Ambush), the engine's `strikeBlocked` notable event carries a
 * `threatKind`; this manifest maps each to the deflection-burst's colours (the
 * energy thrown back off Cap's shield — red / purple / green).
 *
 * No visual bytes are committed — the burst is generated at runtime by
 * `canvas-confetti`; this module carries only the per-threat colour spec and the
 * constant call-out word. `threatKind` drives ONLY these colours (the sole
 * client use of the field); the shield glyph and the word are constant.
 *
 * @see WP-647 §A "the manifest"
 * @see apps/arena-client/src/vfx/comboVfxManifest.ts — the manifest precedent
 * @see DECISIONS.md D-24459 (the shield-block VfxOverlay burst) + D-24365 (the VFX determinism exemption)
 */

import type { NotableGameEvent } from '../composables/useNotableEventStream';

/**
 * The threat class a `strikeBlocked` event carries. Derived from the engine
 * event variant (NOT a deep engine import) so the `STRIKE_BLOCKED_VFX` Record
 * below is a compile-time exhaustiveness pin: a future `threatKind` value fails
 * `vue-tsc` at the Record until mapped — the same discipline as `sfxManifest`'s
 * exhaustive key. (`'fight'` / `'escape'` shipped in WP-651.)
 */
export type StrikeBlockThreatKind = Extract<
  NotableGameEvent,
  { type: 'strikeBlocked' }
>['threatKind'];

/** The per-threat burst spec: the deflection-burst colours `canvas-confetti` throws. */
export interface StrikeBlockedVfxSpec {
  /** Non-empty palette for the threat-coloured deflection burst. */
  readonly colors: readonly string[];
}

/** The constant call-out word for every shield-block beat (no per-threat variance). */
export const BLOCKED_WORD = 'BLOCKED!';

/**
 * `threatKind` → the deflection-burst colours. The
 * `Record<StrikeBlockThreatKind, StrikeBlockedVfxSpec>` type is the
 * exhaustiveness pin — every threat kind must map, and a new one fails
 * `vue-tsc` here until it earns a palette. Colours: Master Strike red, Scheme
 * Twist purple, Ambush green, Fight amber, Escape teal (WP-651).
 */
export const STRIKE_BLOCKED_VFX: Record<StrikeBlockThreatKind, StrikeBlockedVfxSpec> = {
  masterStrike: { colors: ['#e23046', '#ff6b6b', '#ffffff'] },
  schemeTwist: { colors: ['#8a4dff', '#b57bff', '#ffffff'] },
  ambush: { colors: ['#3bd16f', '#7be0a0', '#ffffff'] },
  fight: { colors: ['#ff9d2e', '#ffc061', '#ffffff'] },
  escape: { colors: ['#2ec5c5', '#7fe3e3', '#ffffff'] },
};
