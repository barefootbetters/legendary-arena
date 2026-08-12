/**
 * Accessibility preferences — shared tier.
 *
 * Defaults are calibrated to the viewer's current hardcoded behavior so that
 * a fresh visitor with no stored preferences sees bit-identical UI to what
 * ships today (plan §2.3, §5.7 "defaults-match-today" property).
 *
 * Pure Zod + TypeScript — no Vue imports, no DOM references. Enforced by
 * the companion `_schema-purity.test.ts`.
 */

import { z } from "zod";

export const AccessibilityPrefsSchema = z.object({
  reduceMotion: z.enum(["auto", "on", "off"]).default("auto"),
  smoothScroll: z.boolean().default(true),
  focusRingBold: z.boolean().default(false),
  glossaryShortcut: z.string().default("Mod+K"),
  escapeClosesLightboxFirst: z.boolean().default(true),
  showFloatingGlossaryFab: z
    .enum(["auto", "always", "never"])
    .default("auto"),
});

export type AccessibilityPrefs = z.infer<typeof AccessibilityPrefsSchema>;
