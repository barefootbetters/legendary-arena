/**
 * App-level section registration for the registry viewer.
 *
 * This file is side-effect imported from `main.ts` BEFORE the Pinia app
 * instance is created, so the section registry is populated by the time
 * the store factory first composes its Zod envelope.
 *
 * WP-068 registers the three shared-tier sections only:
 *   - appearance
 *   - accessibility
 *   - advancedBase
 *
 * App-specific sections (Display, Filters, DataSource, Advanced) are
 * registered in later packets:
 *   - WP-071: Display
 *   - WP-072: Filters
 *   - WP-074: DataSource
 *   - WP-077: Advanced (app-tier)
 */

import { registerSection } from "./shared/registry/sectionRegistry";
import { AppearancePrefsSchema } from "./shared/schema/appearance.schema";
import { AccessibilityPrefsSchema } from "./shared/schema/accessibility.schema";
import { AdvancedBasePrefsSchema } from "./shared/schema/advancedBase.schema";

// why: the third argument is `null` because no UI primitives exist yet —
// WP-070 introduces PreferenceToggle / PreferenceSelect / PreferenceSlider /
// PreferenceColor, and WP-075 / WP-076 / WP-077 attach the concrete
// Appearance / Accessibility / AdvancedBase section components. Until
// then the registry carries schemas only and nothing renders.
registerSection("appearance", AppearancePrefsSchema, null);
registerSection("accessibility", AccessibilityPrefsSchema, null);
registerSection("advancedBase", AdvancedBasePrefsSchema, null);
