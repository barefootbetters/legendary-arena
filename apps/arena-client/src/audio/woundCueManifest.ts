/**
 * woundCueManifest.ts
 *
 * The single CC0-posture clip URL for the "wound gained" damage thud (WP-650) —
 * the audio half of the wound-gained damage vignette, played when the local
 * player's `woundCount` increases. Unlike `sfxManifest` (a Record over the nine
 * notable-event types), a Wound is NOT a notable event, so it carries no manifest
 * Record — just this one clip URL the `useWoundCue` consumer plays.
 *
 * The clip is ORIGINAL synthesis (no third-party / CC0 obligation — the cleanest
 * commercial posture), generated deterministically by
 * `ewiki/sound-effects/wound-gained.py`. Audio bytes are NOT committed to git —
 * the clip is hosted on R2 and served via `images.legendary-arena.com` under the
 * `audio/sound-effects/` prefix (the ewiki hosting rule); this module carries the
 * URL only.
 *
 * @see apps/arena-client/src/audio/comboCueManifest.ts (the sibling clip manifest)
 * @see DECISIONS.md D-24462 (the wound-gained damage vignette + thud)
 */

// why: audio bytes live on R2, served via images.legendary-arena.com under the
// audio/sound-effects/ prefix (the ewiki hosting rule) — never in git. Clip
// filenames use hyphens, not underscores (the repo image-URL convention). A
// not-yet-uploaded clip 404s on preload and no-ops, so the vignette + code ship
// complete and the thud starts once the byte lands (the sfxManifest posture).
const SFX_BASE_URL = 'https://images.legendary-arena.com/audio/sound-effects/';

/** The dull damage-thud clip URL played when the local player gains a Wound. */
export const WOUND_GAINED_CLIP = `${SFX_BASE_URL}wound-gained.mp3`;
