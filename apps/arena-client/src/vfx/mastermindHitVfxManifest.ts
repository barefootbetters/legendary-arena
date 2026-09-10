/**
 * mastermindHitVfxManifest.ts
 *
 * The mastermind-hit beat's visual model — the escalating juice for each blow a
 * player lands on the Mastermind. Every successful `fightMastermind` defeats one
 * of the Mastermind's four Tactics, and the play board projects the running
 * count as `UIState.mastermind.tacticsDefeated`. `useMastermindHitVfx` watches
 * that count and, on each increase, asks this manifest for the beat that fits the
 * hit number so a later blow reads bigger than the first — hit 1 is a spark, hit
 * 4 is a screen-shaking impact.
 *
 * This rides the WP-556 VFX foundation with ZERO engine change: `tacticsDefeated`
 * is an already-projected board count, so the beat is a pure count-delta consumer
 * exactly like the shipped wound vignette (`useWoundVfx`) — no new notable event,
 * no new engine field.
 *
 * Thematically these are strikes landing ON the villain (heroic aggression), so
 * they get a hot amber/gold/ember palette — distinct from every existing effect
 * (Master Strike red, shield-block threat colours, transform gamma-green, wound
 * dull-red, combo default multicolor) so a mastermind hit reads as its own moment.
 *
 * No visual bytes are committed — the burst is generated at runtime by
 * `canvas-confetti`; this module carries only the per-tier spec.
 *
 * @see apps/arena-client/src/vfx/comboVfxManifest.ts — the tiered-spec precedent
 * @see apps/arena-client/src/composables/useWoundVfx.ts — the count-delta consumer this pairs with
 * @see wiki/visual-effects.md §Priority tiers (fightResolved impact burst)
 * @see DECISIONS.md D-24365 (the WP-556 VFX foundation + the VFX determinism exemption)
 */

/**
 * The escalating tiers for the four mastermind hits. Named for the hit number so
 * a later blow maps to a bigger beat. A fifth Final-Blow fight (WP-687, future)
 * does NOT increment `tacticsDefeated` — it awards the Mastermind card and fires
 * the victory finale instead — so the ladder is bounded at four by design.
 */
export type MastermindHitTier = 'hit1' | 'hit2' | 'hit3' | 'hit4';

/** One mastermind-hit beat: how big the burst, whether it shakes, and its word. */
export interface MastermindHitVfxSpec {
  /** Particle count for this hit's ember burst — ascending across the ladder. */
  readonly particleCount: number;
  /**
   * The call-out word, or `null` for no word. Hit 1 is a wordless spark
   * (contrast-through-restraint, mirroring the combo `small` tier), and hit 4 is
   * wordless too so the victory finale's own banner owns the vanquish moment when
   * the fourth Tactic is the killing blow (normal rules). The heaviest PHYSICAL
   * beat (burst + shake) still lands on hit 4.
   */
  readonly word: string | null;
  /** Whether this hit fires the screen-shake impact pulse (the heavier blows only). */
  readonly shake: boolean;
}

/**
 * The hot ember palette shared by every mastermind-hit burst — molten amber
 * through gold to a red-orange ember. Distinct from every other effect's colours
 * so a strike on the Mastermind reads as its own beat.
 */
const MASTERMIND_HIT_COLORS: readonly string[] = ['#ff9d2e', '#ffd34e', '#ff5a3c'];

/** The palette every mastermind-hit burst throws (re-exported for the overlay). */
export const MASTERMIND_HIT_BURST_COLORS = MASTERMIND_HIT_COLORS;

/**
 * Maps a `tacticsDefeated` count to its hit tier, or `null` when nothing has been
 * defeated yet (`<= 0`). Bounded at `hit4` so a count of four or more (defensive)
 * still renders the top beat.
 *
 * @param tacticsDefeated - the projected `UIState.mastermind.tacticsDefeated` count.
 * @returns the hit tier, or `null` for a pre-fight count.
 */
export function mastermindHitTierForCount(
  tacticsDefeated: number,
): MastermindHitTier | null {
  if (tacticsDefeated <= 0) return null;
  if (tacticsDefeated === 1) return 'hit1';
  if (tacticsDefeated === 2) return 'hit2';
  if (tacticsDefeated === 3) return 'hit3';
  // why: >= 4 — the fourth (last) Tactic and any defensive over-count map to the
  // top beat; there is no fifth Tactic, so the ladder never grows past hit4.
  return 'hit4';
}

/**
 * The four mastermind-hit beats, ascending: a wordless spark, a "STAGGERED!"
 * burst, a shaking "RECKONING!", and a wordless screen-shaking top impact whose
 * word is ceded to the victory finale when this hit is the vanquish.
 */
export const MASTERMIND_HIT_VFX: Record<MastermindHitTier, MastermindHitVfxSpec> = {
  hit1: { particleCount: 50, word: null, shake: false },
  hit2: { particleCount: 90, word: 'STAGGERED!', shake: false },
  hit3: { particleCount: 130, word: 'RECKONING!', shake: true },
  hit4: { particleCount: 175, word: null, shake: true },
};
