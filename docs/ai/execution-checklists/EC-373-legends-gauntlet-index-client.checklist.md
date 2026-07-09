# EC-373 — Legends-Board Gauntlet Index + Board Panel, Client (Execution Checklist)

> Pairs with [WP-343](../work-packets/WP-343-legends-gauntlet-index-client.md)
> (authoritative design) and D-24131 §8a. WP wins on conflict.

## Before Starting

- [ ] Read WP-343 in full, then D-24131 §7/§8a, then this file.
- [ ] Confirm baseline: `origin/main` @ `b3e0f2d2`;
      `pnpm --filter @legendary-arena/legends-board build` exits 0.
- [ ] Read `App.vue`, `snapshotClient.ts`, `AttractCycler.vue`, and the five
      panels end to end before editing.

## Locked Values (do not re-derive)

- Routes: `''`/`'#/'` → attract; `#/gauntlet/<board>` where `<board>` matches
  `^gauntlet-[a-z0-9-]+$` → gauntlet view; anything else → attract fallback.
  Plain `<a href>` navigation; no History API; `_redirects` untouched.
- Display: `formatAverageScore(centis)` → `(centis/100).toFixed(1)` with an
  explicit leading `+` for positive, natural `-` for negative, and the exact
  string `E` for zero (golf convention). Negative styles gold (under PAR).
- Index grouping: group by `setAbbr` preserving artifact order (publisher
  emits setAbbr ASC, mastermind ASC); `entryCount: 0` rows are NON-links
  rendering the compact unclaimed CTA; populated rows link through.
- Kiosk/attract: exactly ONE extra slide (`gauntlet-index`) appended to the
  cycle list when the manifest carries `gauntletIndex`; per-gauntlet boards
  never cycle. Cycle-list composition lives in a PURE helper
  (`buildAttractBoardList(boardNames, hasGauntletIndex)` in
  `gauntletDisplay.ts`) so AC-7 is unit-testable.
- Gauntlet snapshot fetch paths: `legends/v1/gauntlet-index.json` and
  `legends/v1/<board>.json`; caching + `generatedAt` invalidation mirror the
  existing `fetchBoard` discipline (gauntlet cache cleared by
  `invalidateBoardCache`).
- Type mirroring: hand-mirror from `apps/server/src/legends/legends.types.ts`
  with a source-naming comment; no cross-package import.
- **Test-posture reconciliation (WP addendum):** the SPA's fetch functions
  read Vite's `import.meta.env` and are NOT runnable under node:test (the
  established `snapshotClient.test.ts` posture); Vue components have no
  mount harness. Unit tests therefore cover the PURE surface only —
  `parseHashRoute`, `formatAverageScore`, set grouping,
  `buildAttractBoardList`, and URL/key derivation helpers. Rendering and
  fetch behavior are verified by `vue-tsc`, the local dev smoke
  (Verification Step 4), and the D-24026 live-on-surface DoD item. WP ACs
  2 / 4 / 5 / 6 are satisfied through that split, per the WP addendum.

## Guardrails

- `package.json` untouched — `vue` stays the sole runtime dependency; any
  dependency addition is a HARD FAIL.
- No engine / registry / preplan / server import; no server API call; no
  cookies or localStorage; built bundle carries no server-API hostname
  (grep `dist/assets/*.js` for `onrender` / `api.legendary-arena`).
- Existing panels' POPULATED-state markup byte-compatible — only the
  zero-entries branch changes; `prefers-reduced-motion` handling untouched.
- No wall-clock reads or randomness in new modules (see D-3701 for the
  forbidden-surface list); panels are pure functions of fetched snapshots.
- Empty/unclaimed copy: competitive call-to-action + play link only — no
  pricing, no account-benefit claims.

## Required `// why:` Comments

- `parseHashRoute` fallback: why malformed hashes degrade to the attract
  view (a public display must never render a broken route).
- `formatAverageScore` zero case: why `E` (the golf even-with-PAR
  convention the scoring model is built on, VISION §20).
- Index unclaimed rows: why zero-entry boards get no link (WP-342 writes no
  board file below 1 entry — a link would 404; D-24131 §7).
- Cycle-list helper: why exactly one slide and never per-gauntlet boards
  (105 boards would starve the classic slides).

## Files to Produce

Per WP-343 §Files Expected to Change — 13 files (8 new incl. 3 tests +
5 modified incl. 1 test), `App.vue` included; no others.

## After Completing

- [ ] `pnpm --filter @legendary-arena/legends-board build` + `typecheck` +
      `test` all exit 0; zero-API bundle grep clean.
- [ ] Local dev smoke against the live manifest (WP Verification Step 4).
- [ ] Governance close: D-24132 written; WORK_INDEX check-off; STATUS
      (user-visible change); EC_INDEX row; wiki §Edge Cases header-only-table
      finding annotated as fixed.
- [ ] D-24026 live-on-surface verification recorded as deploy-dependent
      (CF Pages builds on merge; verify the index + a deep link + the
      unclaimed CTA on legends.legendary-arena.com post-merge).

## Common Failure Smells

- vue-tsc errors on the panel props ⇒ the mirrored types drifted from
  `legends.types.ts` — reconcile against the server file, never loosen types.
- The attract view flashing on a gauntlet deep link ⇒ route parsed after
  mount instead of from `location.hash` at setup.
- Existing panel tests/snapshots failing ⇒ the populated branch changed;
  only the empty branch may.

## Rules

Commit prefix `EC-373:` for implementation commits; `SPEC:` for governance
(never `WP-343:`). Bug handling per `01.2-bug-handling-under-ec-mode.md`.
