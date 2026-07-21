# EC-445 — Card-Image Working-Set Prefetch at Match Start (Execution Checklist)

**Source:** docs/ai/work-packets/WP-410-card-image-setup-prefetch.md
**Layer:** Game Engine (projects the manifest) → App (`apps/arena-client`, prefetches it)

## Before Starting
- [ ] On `main`, clean, `git pull --ff-only origin main` exits 0; baseline `879fa78a` or later
- [ ] `G.cardDisplayData` builds a per-card `imageUrl` at setup (`packages/game-engine/src/setup/buildCardDisplayData.ts`) — the sole in-`G` URL source
- [ ] `apps/arena-client/src/stores/uiState.ts` imports `UIState` from `@legendary-arena/game-engine` (new field flows without a client type fork)
- [ ] `apps/arena-client` has **no** runtime `@legendary-arena/registry` import (layer boundary) — keep it that way
- [ ] EXACT target file set = §Files to Produce below; any file outside it is a FAIL, surfaced as a blocker before editing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; `pnpm --filter arena-client typecheck` exits 0 (baseline green)

## Locked Values (do not re-derive)
- `UIState.matchCardImageUrls?: string[]` — optional in the type; **always populated** by `uiState.build.ts` (empty `[]` for an empty match); deduped; non-empty entries only
- `PREFETCH_CONCURRENCY = 6` — max in-flight warms
- Manifest = the deduped, non-empty set of `imageUrl` across `G.cardDisplayData` (order-independent)

## Guardrails
- **The field must pass through `filterUIStateForAudience` (`uiState.filter.ts`), the SOLE engine→client boundary, as PUBLIC for every audience** — it rebuilds `UIState` from an explicit whitelist, so a field it does not copy is silently dropped and the feature ships green-but-dead. `uiState.filter.test.ts` proves survival for player + spectator.
- Engine PRODUCES, client CONSUMES — Engine→App only; client constructs no URL and adds no registry import
- Projection-only: `matchCardImageUrls` derives from `G.cardDisplayData`; NEVER write it to `G`; do not touch the state-hash surface (no sentinel re-pin — else STOP and investigate why a hash moved)
- Optional field: existing hand-written `UIState` fixtures MUST NOT need a backfill; if any fixture fails to typecheck, the field was made REQUIRED — fix the type, do not edit fixtures
- Prefetch is fire-and-forget: never throws, never blocks render, idempotent (a `Set` of warmed URLs); a failed image is skipped (covered by the `CardTile.vue` lazy `<img>` fallback)
- Information-safe: a flat deduped image-URL set only — no ordering, no per-player hidden state
- No new npm dependency; browser `fetch`/`Image` only
- Wiring is limited to `PlayViewport.vue` (the D-16501 match root, `01.5`); a second wiring file demotes/blocks

## Required `// why:` Comments
- `uiState.build.ts` manifest population: why deduped-from-`cardDisplayData` and why always-populated-but-type-optional (the WP-179 fixture-safety pattern)
- `useCardImagePrefetch.ts` `PREFETCH_CONCURRENCY = 6`: why bounded (HTTP/2 multiplexing; avoid saturating the connection / head-of-line stalls)
- `useCardImagePrefetch.ts` idempotency `Set`: why warmed URLs are tracked (reconnect / re-render must not refetch)

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — optional `matchCardImageUrls?: string[]` on `UIState`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate the deduped non-empty manifest
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — pass `matchCardImageUrls` through `filterUIStateForAudience` (public, value-identical for every audience; aliasing-safe copy; conditional-assign for `exactOptionalPropertyTypes`)
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — manifest assertions (deduped, non-empty, order-independent)
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — field survives filtering for a player AND a spectator audience, value-equal
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — additive `Pick<UIState, 'matchCardImageUrls'> satisfies` drift pin (the `pendingKoHeroChoice` precedent; NO exhaustive top-level keyset exists — do not fabricate one)
- `apps/arena-client/src/composables/useCardImagePrefetch.ts` — **new** — bounded, fail-soft, idempotent warm; no-op on absent/empty manifest
- `apps/arena-client/src/composables/useCardImagePrefetch.test.ts` — **new** — fetch-once / fail-soft / idempotent / empty-manifest-no-op
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount the composable once (`01.5` wiring)

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` 0; `pnpm --filter @legendary-arena/game-engine test` 0 (sentinel hashes byte-unchanged — AC-4)
- [ ] `pnpm --filter arena-client typecheck` 0; `pnpm --filter arena-client test` 0; `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] AC-8 grep gate: zero `@legendary-arena/registry` and zero `images.legendary-arena.com` in `useCardImagePrefetch.ts`
- [ ] Live-on-surface (D-24026, REQUIRED — surface ≠ `none`): on `play.legendary-arena.com`, network warms the set at setup and a later-revealed card paints from cache (AC-10)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24222 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` — glyph → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- Green engine + composable tests but NO image warmed on the live client ⇒ the field was not passed through `filterUIStateForAudience` — it's dropped at the boundary (AC-2 exists to catch this)
- An executor hunting for a "top-level UIState keyset assertion" to edit ⇒ none exists; add the additive `Pick<UIState, ...> satisfies` pin instead
- A vue-tsc error in an existing `UIState` fixture ⇒ the field was made REQUIRED, not optional — fix the type
- A moved sentinel `finalStateHash` ⇒ something wrote to `G` — the manifest must stay a projection; STOP
- Prefetch refetching on reconnect ⇒ the idempotency `Set` is scoped per-render, not per-match — hoist it
