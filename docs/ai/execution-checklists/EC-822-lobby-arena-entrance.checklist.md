# EC-822 — Lobby Arena entrance (Execution Checklist)

**Source:** docs/ai/work-packets/WP-785-lobby-arena-entrance.md
**Layer:** Arena Client (App)

## Before Starting
- [ ] `launchMatchFromComposition(input)` returns `{ ok: true, matchID } | { ok: false, message }` and never throws; else STOP
- [ ] `data/cards/core.json` Magneto `alwaysLeads` is `["brotherhood"]`; else STOP
- [ ] `pnpm --filter "@legendary-arena/arena-client^..." build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (Before)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (baseline 2175 / 360 suites / 0 fail at `da4d3a2c`)
- [ ] EXACT target files: `featuredTable.ts`, `featuredTable.test.ts`, `ArenaEntrance.vue`, `ArenaEntrance.test.ts`, `App.vue`,
      `bgioClient.test.ts`, `LobbyView.vue` + governance; anything else is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- `FEATURED_TABLE: MatchConfiguration` — `schemeId: 'core/midtown-bank-robbery'`, `mastermindId: 'core/magneto'`,
  `villainGroupIds: ['core/brotherhood']`, `henchmanGroupIds: ['core/sentinel']`,
  `heroDeckIds: ['core/spider-man', 'core/hulk', 'core/wolverine']`, `bystandersCount: 30`, `woundsCount: 30`,
  `officersCount: 30`, `sidekicksCount: 12`. `FEATURED_PLAYER_COUNT = 1`.
- `FEATURED_TABLE_LABELS` — `mastermind: 'Magneto'`, `scheme: 'Midtown Bank Robbery'`, `villainGroup: 'Brotherhood'`,
  `henchmanGroup: 'Sentinel'`, `heroes: ['Spider-Man', 'Hulk', 'Wolverine']`,
  `artUrl: 'https://images.legendary-arena.com/core/core-mm-magneto.webp'`. Player name `'Player'`.
- Copy: `Featured table` · `The Arena Awaits` · `Magneto and the Brotherhood are robbing Midtown Bank.` ·
  `Spider-Man, Hulk, and Wolverine answer the call.` · `Enter Arena` / `Entering…` ·
  `Sign in to take your seat. Your account is free.` · `Arena Workshop` ·
  `Loadouts, bot allies, watching bots, and joining by match ID.` · art `alt="Magneto"`.
- Test ids: `arena-entrance`, `arena-enter`, `arena-enter-error`, `arena-workshop-link`, `arena-featured-art`.
- **Routing:** `ParsedQuery` gains `workshopRoute: boolean` (`routeParam === 'workshop' || routeParam === 'lobby'`,
  following the `meRoute` / `loginRoute` sibling naming) and `hasMatchParam: boolean`
  (`readQueryParam(params, 'match') !== null`, so an empty `?match=` counts as absent). Setup returns
  `showWorkshop = parsed.workshopRoute || parsed.hasMatchParam`. The template's final `v-else` becomes
  `<template v-else-if="showWorkshop"><LobbyView /></template><template v-else><ArenaEntrance /></template>`;
  `ArenaEntrance` is imported eagerly and added to `components`. `AppRoute` is unchanged.
- **Latch:** `isEntering` blocks a second click. On `ok: true` it stays set (the page is navigating).
  On `ok: false` it clears and `result.message` shows in `arena-enter-error`.
- **Stage colour:** the stage is dark in both themes. Its root declares `--arena-stage-bg: #0b0f19`,
  `--arena-stage-text: #f5f7fb`, and `--arena-stage-accent: #d4af37` (the brand dark values) with a CSS
  `/* why: */` comment; the button uses `var(--la-color-cta)`.
- `LobbyView.vue` `<h1>`: `Arena Workshop` (the only change in that file).

## Guardrails
- Client-only; no `packages/**` / `apps/server/**`; no runtime `@legendary-arena/registry` import. 01.5 NOT INVOKED.
- `ArenaEntrance` makes no request on mount; Enter Arena goes only through `launchMatchFromComposition`.
- Signed out (`token === null`) → `window.location.search = '?route=login'`, no request.
- Every `LobbyView` id / `data-testid` / control survives; `LobbyView.test.ts` and `App.test.ts` pass WITHOUT edits (no ArenaEntrance stub).
- featuredTable test: exactly 5 `test()` calls, reads `core.json` via `new URL('../../../../data/cards/core.json', import.meta.url)`,
  compares `alwaysLeads` slugs to `villainGroupIds` with `core/` stripped.
- No nested ternaries; JSDoc on every function; full-word names.

## Required `// why:` Comments
- `FEATURED_TABLE`: Brotherhood is Magneto's printed Always Leads; the engine does not enforce it, the test does.
- featuredTable test count assertion: pins `PLAYER_COUNT_SETUP[1]` (D-24165); live create's `validateSetupData` is authoritative.
- Stage colours (a CSS `/* why: */`, not `//`): the entrance is an art stage and stays dark in both themes (brand dark values).
- `workshopRoute` accepting `lobby` and `hasMatchParam`: WP-369 invite links and stale `?match=` leftovers keep landing on the Workshop.
- `playerName: 'Player'`: the auth store carries no handle (Play Again precedent).

## Files to Produce
- `apps/arena-client/src/lobby/featuredTable.ts` — **new** (featured composition, player count, labels)
- `apps/arena-client/src/lobby/featuredTable.test.ts` — **new** (5 core.json legality pins)
- `apps/arena-client/src/lobby/ArenaEntrance.vue` — **new** (entrance stage + Enter Arena launch)
- `apps/arena-client/src/lobby/ArenaEntrance.test.ts` — **new** (7 tests)
- `apps/arena-client/src/App.vue` — **modified** (parse fields + lobby-route branch)
- `apps/arena-client/src/client/bgioClient.test.ts` — **modified** (empty-query retarget; +2 tests)
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** (`<h1>` only)
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] vue-tsc exits 0 (After); arena-client 2175 → 2189 / 0 fail (`ArenaEntrance` 7, `featuredTable` 5, bgioClient +2: `?route=workshop`, `?route=lobby`)
- [ ] The empty-query assertion change is named in the commit body as an intentional product change
- [ ] `git status --porcelain` ⊆ Files to Produce
- [ ] D-24633 flipped to Active in `docs/ai/DECISIONS.md`; `docs/ai/STATUS.md` updated
- [ ] Live (D-24026, post-deploy): signed-in Enter Arena → solo Magneto / Brotherhood / Midtown match; signed out → login;
      `?route=workshop` → full old lobby; entrance dark in both themes; matchId in STATUS.md
- [ ] WORK_INDEX WP-785 `[x]` with date; EC_INDEX EC-822 → Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write` + `:check` exit 0

## Common Failure Smells
- `?route=lobby` alone shows the entrance → `route=lobby` not folded into `workshopRoute`.
- `?match=m1` alone shows the entrance → `hasMatchParam` missing (the partial-params test fails).
- Entrance goes cream in day mode → the stage used `--la-color-bg-primary` instead of the locked stage values.
- featuredTable test reads `mastermind.imageUrl` → undefined; the art lives on the base card in `cards[]`.
- Test 3 asserts `location.search === '?route=login'` → jsdom never navigates; assert no request instead.
- A signed-in click bounces to login on first paint → session still hydrating; record it, do not work around it here.
