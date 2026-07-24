/**
 * moveSfxManifest.ts
 *
 * Maps each player-action move the click-to-play surface dispatches to the CC0
 * sound-effect clip played the moment that move is dispatched locally — the
 * WP-419 **Surface 2** tactile-feedback layer. Unlike Surface 1
 * (`sfxManifest.ts`, keyed on resolved `NotableGameEvent`s) and the tiered
 * combo cue (`comboCueManifest.ts`, keyed on a played-effect count), this
 * manifest is keyed on the client's own `UiMoveName` dispatch — so the sound
 * fires on the local action for immediate tactile feedback, **independent of**
 * (and ahead of) the authoritative engine result.
 *
 * Audio bytes are NOT committed to git — the clips are hosted on R2 and served
 * via `images.legendary-arena.com` under the `audio/sound-effects/` prefix (the
 * ewiki hosting rule, shared with the WP-412 / WP-413 clips). This module
 * carries URLs only.
 *
 * @see WP-419 §A "Move-SFX manifest"
 * @see apps/arena-client/src/audio/sfxManifest.ts (the Surface-1 sibling)
 * @see DECISIONS.md D-24239 (Surface-2 action-move tactile SFX; dispatch-keyed)
 */

import type { UiMoveName } from '../components/play/uiMoveName.types';

// why: move clips are CC0 audio hosted on R2 and served via
// images.legendary-arena.com under the audio/sound-effects/ prefix (the ewiki
// hosting rule) — never committed to git. Clip filenames use hyphens, not
// underscores (the repo image-URL convention).
const MOVE_SFX_BASE_URL = 'https://images.legendary-arena.com/audio/sound-effects/';

/**
 * The player-action moves that get a Surface-2 tactile cue → their CC0 clip
 * URL. Deliberately a **partial** map over `UiMoveName`, NOT exhaustive: only
 * the moves that represent a felt player action carry a sound. Lobby moves
 * (`setPlayerReady` / `startMatchIfReady`), stage plumbing (`advanceStage` /
 * `revealVillainCard`), the Mastermind fight (`fightMastermind` — its outcome
 * already fires a Surface-1 `mastermindStrikeResolved` / `mastermindDefeated`
 * clip), and the `resolve*` pending-choice moves are intentionally silent here.
 *
 * The `Partial<Record<UiMoveName, string>>` type is the load-bearing drift pin:
 * renaming a move in the `UiMoveName` union fails `vue-tsc` here until this map
 * is updated, and `moveSfxManifest.test.ts` fails if any mapped clip is empty or
 * uses an underscore in place of a hyphen.
 *
 * // why: the ewiki Surface-2 table also lists a `dodgeCard` → `dodge.mp3` row,
 * but `dodgeCard` is an engine-only move (packages/game-engine/src/moves/
 * dodgeCard.ts) — it is NOT in the `UiMoveName` union and the click-to-play
 * surface has no dispatch path for it, so it CANNOT fire a Surface-2 cue today.
 * It is deliberately absent here (mapping it would not typecheck) and is tracked
 * as an unfired-clip gap for a later UI-affordance WP — see WP-419 Out of Scope.
 */
export const moveSfxManifest: Partial<Record<UiMoveName, string>> = {
  // why: a card is played from hand — a card whoosh / place.
  playCard: `${MOVE_SFX_BASE_URL}play-card.mp3`,
  // why: a hero is recruited from HQ — a positive "purchase" chime.
  recruitHero: `${MOVE_SFX_BASE_URL}recruit-hero.mp3`,
  // why: a City villain is attacked — a sword / impact swing. The filename is
  // `attack-villain.mp3` (not `fight-villain.mp3`) per the locked ewiki table.
  fightVillain: `${MOVE_SFX_BASE_URL}attack-villain.mp3`,
  // why: start-of-turn draw / any draw — a card draw / short shuffle.
  drawCards: `${MOVE_SFX_BASE_URL}draw-cards.mp3`,
  // why: the player ends their turn — a soft confirm / pass-turn notification.
  endTurn: `${MOVE_SFX_BASE_URL}end-turn.mp3`,
};
