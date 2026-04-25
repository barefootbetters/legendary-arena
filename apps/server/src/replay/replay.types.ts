/**
 * Server-Side Replay Storage — Type Re-exports (WP-103)
 *
 * Single canonical re-export pair consumed by `replay.logic.ts` and any
 * future `replay.*.ts` siblings under `apps/server/src/replay/`. The
 * pair is:
 *
 * - `ReplayInput` — sourced from `@legendary-arena/game-engine`'s public
 *   contract (`packages/game-engine/src/replay/replay.types.ts`); the
 *   canonical Class 2 Configuration shape `storeReplay` accepts and
 *   `loadReplay` returns. Type-only — zero engine runtime crosses the
 *   server-layer import boundary.
 * - `DatabaseClient` — sourced from sibling `../identity/identity.types.js`
 *   (a `pg.Pool` alias introduced by WP-052 / D-5202). Type-only — `pg`
 *   itself is never imported here, so the server bundle pulls no
 *   additional driver weight from this module.
 *
 * Layer-boundary contract: this module imports nothing runtime from
 * `boardgame.io`, `@legendary-arena/game-engine`, registry, preplan,
 * `vue-sfc-loader`, or any UI / client / replay-producer package. The
 * single `@legendary-arena/game-engine` reference below uses
 * `export type { … }` so TypeScript emits zero runtime code for it.
 *
 * Authority: WP-103 §Locked Contract Values; EC-111 §Locked Values;
 * D-10301 (`apps/server/src/replay/` server-category classification —
 * mirrors WP-052's D-5202 for `apps/server/src/identity/`); the
 * `replay/` directory naming-collision note covers the three sibling
 * directories engine D-2706, arena-client D-6511, and server D-10301
 * — function-name overlap is zero across them.
 */

// why: a single canonical pair of type re-exports keeps replay.logic.ts
// and any future replay.*.ts siblings referencing one source for both
// types. The `export type { … }` form keeps both re-exports type-only
// by construction — TypeScript emits no runtime binding even when
// `verbatimModuleSyntax` is off — preventing accidental engine-runtime
// or `pg` driver coupling through this surface. Mirrors the WP-052
// identity.types.ts re-export precedent (which inlines the
// `pg.Pool` → `DatabaseClient` alias once and re-uses it across five
// identity source files).

export type { ReplayInput } from '@legendary-arena/game-engine';
export type { DatabaseClient } from '../identity/identity.types.js';
