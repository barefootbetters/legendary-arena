/**
 * Advanced-base preferences — shared tier.
 *
 * Only the truly cross-app advanced controls live here. App-specific advanced
 * keys (`debugPanelOnLoad`, `showRawCardJson`, `experimentalFeatures`) ship
 * in WP-077 under the viewer's own Advanced section schema (plan §2.8).
 *
 * Pure Zod + TypeScript — no Vue imports, no DOM references. Enforced by
 * the companion `_schema-purity.test.ts`.
 */

import { z } from "zod";

export const AdvancedBasePrefsSchema = z.object({
  verboseDevLog: z.boolean().default(false),
});

export type AdvancedBasePrefs = z.infer<typeof AdvancedBasePrefsSchema>;
