/**
 * card-output-dir.mjs
 *
 * Single source of truth for the card-data corpus directory shared by all five
 * pipeline stages (convert-cards-v15, apply-card-counts, apply-hero-ability-markers,
 * apply-effect-markers, apply-defeat-requirement-markers). Each stage imports
 * CARD_OUTPUT_DIR and uses it for BOTH its corpus read and its corpus write.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

// why: one env-overridable constant feeds all five stages' corpus read AND
// write. It defaults to the committed data/cards (two levels up from this
// script), but the cards:check gate (scripts/check-card-data-regen.mjs) sets
// CARD_DATA_OUT_DIR to a throwaway scratch directory so a full regen can be
// diffed against committed WITHOUT ever clobbering the committed corpus — that
// non-destructive property is the whole point of the gate. The gate itself
// fail-fasts if CARD_DATA_OUT_DIR is unset or resolves to the real data/cards,
// so a wiring bug can never overwrite the canonical files.
export const CARD_OUTPUT_DIR =
  process.env.CARD_DATA_OUT_DIR ?? join(currentDir, '..', '..', 'data', 'cards');
