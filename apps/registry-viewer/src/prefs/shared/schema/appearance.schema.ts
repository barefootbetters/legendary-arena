/**
 * Appearance preferences — shared tier.
 *
 * Defaults are calibrated to the viewer's current hardcoded behavior so that
 * a fresh visitor with no stored preferences sees bit-identical UI to what
 * ships today (plan §2.3, §5.7 "defaults-match-today" property).
 *
 * This file is intentionally pure Zod + TypeScript: no Vue imports, no DOM
 * references. The schema may be consumed from Node-only tooling (future CLI
 * validation, server-side shareable-link rendering) without pulling in a UI
 * framework. The companion `_schema-purity.test.ts` guards this invariant so
 * the eventual Option-A → Option-B hoist to `packages/ui-preferences/` stays
 * a pure file-move.
 */

import { z } from "zod";

export const AppearancePrefsSchema = z.object({
  themeMode: z.enum(["dark", "light", "system"]).default("dark"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#7070e0"),
  fontScale: z.number().min(0.75).max(1.5).default(1.0),
  fontFamily: z
    .enum(["system", "sans", "serif", "mono"])
    .default("system"),
});

export type AppearancePrefs = z.infer<typeof AppearancePrefsSchema>;
