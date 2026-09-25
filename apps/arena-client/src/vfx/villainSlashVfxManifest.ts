/**
 * villainSlashVfxManifest.ts
 *
 * The villain-slash beat's visual model (WP-755) — the Fruit Ninja-style juice
 * for every villain or henchman defeat in the City, riding the WP-556 VFX
 * foundation. When the engine emits a `fightResolved` notable event, the overlay
 * slices the defeated card: a bright streak crosses its City space, the card's
 * art splits into two halves that tumble away, a villain-purple droplet spray
 * flies along the cut, and brief stains fade from the mat. Same-player defeats in
 * quick succession raise a takedown-streak word.
 *
 * This module carries only the locked spec (colours, counts, angles, durations,
 * limits) plus two pure streak helpers. It reads no clock and no randomness: the
 * overlay (the D-24365-exempt `VfxOverlay.vue`) reads `performance.now()` once
 * per beat and hands the value to `nextTakedownStreak`.
 *
 * @see WP-755 §A "the manifest" + §Locked Values
 * @see apps/arena-client/src/vfx/excessiveViolenceVfxManifest.ts — the single-spec manifest precedent
 * @see DECISIONS.md D-24584 (the villain-slash beat) + D-24365 (the VFX determinism exemption)
 */

/** The single spec for the villain-slash beat. */
export interface VillainSlashVfxSpec {
  /** The villain-ink droplet spray palette (lead = `--color-villain`). */
  readonly colors: readonly string[];
  /** Spray particle count at full intensity (under the WP-556 200-particle ceiling). */
  readonly fullParticleCount: number;
  /** Spray particle count at low intensity. */
  readonly lowParticleCount: number;
  /** The streak's bright core colour. */
  readonly streakCoreColor: string;
  /** The streak's glow colour. */
  readonly streakGlowColor: string;
  /** Slash angles in degrees (screen convention: y down, clockwise positive), chosen by `seq % length`. */
  readonly angles: readonly number[];
  /** How long each half flies before it is removed. */
  readonly halfFlightMs: number;
  /** How long the streak shows before it is removed. */
  readonly streakMs: number;
  /** How long each stain lingers before it is removed. */
  readonly stainMs: number;
  /** How many stains a full-intensity slice leaves. */
  readonly stainCount: number;
  /** The most slice halves that may be live at once (the oldest is removed first). */
  readonly maxLiveHalves: number;
}

/**
 * The villain-slash beat. The spray lead `#7b1fa2` is the `--color-villain`
 * accent (`styles/base.css`), distinct from every other effect's lead, so a
 * defeat reads as villain ink rather than any hero or threat colour. 28 / 10
 * droplets keep the spray a short accent next to the halves, far under the
 * 200-particle ceiling.
 */
export const VILLAIN_SLASH_VFX: VillainSlashVfxSpec = {
  colors: ['#7b1fa2', '#4a0d67', '#b44fd6'],
  fullParticleCount: 28,
  lowParticleCount: 10,
  streakCoreColor: '#ffffff',
  streakGlowColor: '#d6c2ff',
  // why: a small fixed set of cut angles, picked by `seq % 4`, so consecutive
  // slices vary without any randomness (deterministic presentation).
  angles: [-28, 22, -16, 34],
  halfFlightMs: 900,
  streakMs: 260,
  stainMs: 2400,
  stainCount: 5,
  maxLiveHalves: 10,
};

/** Card width / height — the `CardTile` 5:7 ratio, used when no reference tile can be measured. */
export const CARD_ASPECT = 5 / 7;

/** Same-player defeats within this window extend the takedown streak. */
export const TAKEDOWN_STREAK_WINDOW_MS = 4000;

/** The locked takedown words, in escalation order (streak 2, 3, 4+). */
export const TAKEDOWN_WORDS: readonly string[] = [
  'DOUBLE TAKEDOWN!',
  'TRIPLE TAKEDOWN!',
  'RAMPAGE!',
];

/** The running takedown streak the overlay keeps between beats. */
export interface TakedownStreakState {
  readonly playerId: string;
  readonly atMs: number;
  readonly streak: number;
}

/**
 * Maps a takedown streak length to its call-out word.
 *
 * @param streak - consecutive same-player defeats (1 = a single defeat).
 * @returns the word, or `null` for a single defeat.
 */
export function takedownWordForStreak(streak: number): string | null {
  if (streak >= 4) return 'RAMPAGE!';
  if (streak === 3) return 'TRIPLE TAKEDOWN!';
  if (streak === 2) return 'DOUBLE TAKEDOWN!';
  return null;
}

/**
 * Whether a word is one of the locked takedown words.
 *
 * @param word - the word currently in the overlay's shared word slot.
 * @returns true when the slot holds a takedown word (which a takedown may replace).
 */
export function isTakedownWord(word: string | null): boolean {
  if (word === null) return false;
  return TAKEDOWN_WORDS.includes(word);
}

/**
 * Advances the takedown streak for a new defeat. Pure: the caller supplies the
 * time, so this never reads a clock.
 *
 * @param previous - the prior streak state, or `null` before the first defeat.
 * @param playerId - the defeating player.
 * @param nowMs - the caller's current time in milliseconds.
 * @returns the new streak state.
 */
export function nextTakedownStreak(
  previous: TakedownStreakState | null,
  playerId: string,
  nowMs: number,
): TakedownStreakState {
  if (
    previous !== null &&
    previous.playerId === playerId &&
    nowMs - previous.atMs <= TAKEDOWN_STREAK_WINDOW_MS
  ) {
    return { playerId, atMs: nowMs, streak: previous.streak + 1 };
  }
  return { playerId, atMs: nowMs, streak: 1 };
}

/**
 * Picks the slash angle for a beat from its sequence id.
 *
 * @param seq - the beat's monotonic sequence id.
 * @returns the cut angle in degrees (screen convention).
 */
export function villainSlashAngleForSeq(seq: number): number {
  const count = VILLAIN_SLASH_VFX.angles.length;
  // why: a double modulo keeps the index in range even for a negative seq, so
  // the lookup can never return undefined.
  const index = ((seq % count) + count) % count;
  return VILLAIN_SLASH_VFX.angles[index] ?? 0;
}
