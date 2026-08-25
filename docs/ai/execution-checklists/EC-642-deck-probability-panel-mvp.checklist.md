# EC-642 — Deck Probability Panel MVP (Execution Checklist)

**Source:** docs/ai/work-packets/WP-607-deck-probability-panel-mvp.md
**Layer:** App — arena-client

## Before Starting
- [ ] WP-606 / D-24417 on `main`: `UIState.players[i].deckComposition?`
      (owner-only) + `UIState.decks.villainDeckComposition?` (public) populated,
      reachable client-side via the `@legendary-arena/game-engine` barrel.
- [ ] Baseline clean + synced; capture `git rev-parse origin/main`.
- [ ] Scope lock — EXACTLY these 5 files: `components/play/deckProbability.ts`,
      `components/play/DeckProbabilityPanel.vue`, `pages/PlayViewport.vue`,
      `components/play/deckProbability.test.ts`,
      `components/play/DeckProbabilityPanel.test.ts` (all under
      `apps/arena-client/src/`). Any edit outside → STOP.
- [ ] Read `HollowEffectsPanel.vue` (+ `.test.ts`) and `YourDeckDiscardZone.vue`
      (the `isExpanded` toggle) before writing.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; `pnpm --filter arena-client test` green.

## Locked Values (do not re-derive)
- Component `DeckProbabilityPanel.vue` + pure helper `deckProbability.ts`, both
  in `apps/arena-client/src/components/play/`; mounted once in `PlayViewport.vue`.
- Prefix map (villain LAST): `master-strike-` → `mastermind-strike`;
  `scheme-twist-` → `scheme-twist`; `bystander-villain-deck-` → `bystander`;
  `henchman-` → `henchman`; else → `villain`.
- `nextDrawOdds(count, deckSize)` = `count / deckSize`, `deckSize === 0 → 0`.
- `atLeastOneInNextN` = `1 − C(deckSize−count, n) / C(deckSize, n)`, guarded
  (`n >= deckSize` → `1` when `count > 0`; `count === 0` → `0`).
- Own-player select: `players.find(p => p.handCards !== undefined)`.
- `RevealedCardType` union imported **type-only** from the engine barrel.

## Guardrails
- **Client-side advisory only** — all math in `deckProbability.ts` from the
  UIState projection; NEVER `ctx.random`, NEVER an engine/`boardgame.io`/registry
  RUNTIME import (type-only `import type` is allowed), NEVER a store/game-state write.
- **No engine / `G` / projection change** — render WP-606's fields only. A
  seeming need for a new field (own-deck names, face-up-top) is a follow-on WP.
- **Categorize by prefix, villain LAST** — order checks so `villain` is the
  fallback; a mis-order silently miscounts.
- **Killbots caveat documented, not fixed** — `bystander-villain-deck-*`
  rewritten to `villain` by Killbots (`G.convertedOrigins`, unprojected)
  miscounts as Bystander; accepted Phase-1 limit, pinned by a test.
- **Self-hide, never throw on `undefined`** — both fields optional; `v-if`
  guards; no `.length`/index on a possibly-undefined field.
- **No `.reduce()` with branching** — `summarizeVillainDeck` uses `for...of`.
- **`vue-tsc` gates** — `vite build` (esbuild) + `node:test` (tsx) do NOT
  type-check; only `pnpm --filter arena-client typecheck` does. Run it.

## Required `// why:` Comments
- `deckProbability.ts` categorizer: villain-fallback ordering + the Killbots
  `bystander→villain` unprojected miscount (Phase-1 limit) + cite
  `villainDeck.setup.ts` as the ext_id-grammar source of truth (constants not
  exported; the test pins hand-written ext_ids).
- `deckProbability.ts` `nextDrawOdds` / `atLeastOneInNextN`: the `deckSize 0` /
  `n >= deckSize` / `count 0` guards.
- `DeckProbabilityPanel.vue`: own-player select via the `handCards` redaction
  marker; self-hide when fields absent.

## Files to Produce
- `apps/arena-client/src/components/play/deckProbability.ts` — **new** — pure categorizer + odds
- `apps/arena-client/src/components/play/DeckProbabilityPanel.vue` — **new** — collapsible panel
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — register + mount (01.5 wiring)
- `apps/arena-client/src/components/play/deckProbability.test.ts` — **new** — util tests (each prefix + fallback + Killbots pin + odds guards)
- `apps/arena-client/src/components/play/DeckProbabilityPanel.test.ts` — **new** — component test (rows render; hides when absent)

## After Completing
- [ ] `pnpm -r build` 0.
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) 0.
- [ ] `pnpm --filter arena-client test` green.
- [ ] **Live-on-surface (D-24026):** on deployed `play.legendary-arena.com`, in
      a real match, the panel shows villain remaining-per-type + next-draw odds
      and the own draw-pool count, and collapses/expands.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — land D-24418 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-607 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — node `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `roadmap:counts:check` 0.
- [ ] `git diff --name-only` — only the 5 files above.

## Common Failure Smells (Optional)
- Villain rows all count as `villain` → the prefix checks ran with `villain`
  not last, or the ext_id grammar drifted.
- Panel throws on load → indexing a possibly-`undefined` field without the
  `v-if`/optional guard (spectator or pre-populate frame).
- `vite build` green but CI later red → you skipped `pnpm --filter arena-client
  typecheck`; esbuild/tsx don't type-check.
- A runtime `@legendary-arena/game-engine` import (not `import type`) → not a
  layer violation per se (arena-client MAY import the runtime-safe engine
  surface, WP-090), but unnecessary here — this presentational panel needs
  engine types only.
