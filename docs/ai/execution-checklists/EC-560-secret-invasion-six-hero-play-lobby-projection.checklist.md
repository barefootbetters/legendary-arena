# EC-560 — Secret Invasion "6 Heroes" — Scheme-Aware Play-Lobby Requirement Projection

**WP:** WP-525 · **Layer:** Server + arena-client · **Baseline:** `origin/main` @ `c5cfa21b`
(+ WP-524 landed) · **Lane:** Standard two-session. **Epic:** ship as a set with WP-524
(hard-dep).

Authoritative execution contract for WP-525. The WP is the design authority; on conflict the
WP wins. Subordinate to ARCHITECTURE.md + `.claude/rules/*`.

> **Hard-dep WP-524.** `resolveEffectiveHeroCount` must already exist in
> `@legendary-arena/registry`. This WP makes the scheme-blind play lobby AGREE with the
> engine WP-524 enforces. The two are NOT deployed with the engine change live and this
> absent (the un-creatable-scheme regression the split avoids) — merge them as a set.

## Before Starting

- [ ] `git pull --ff-only origin main` clean; WP-524 merged (`resolveEffectiveHeroCount`
      exists + exported from `@legendary-arena/registry`). Fresh branch off that base.
- [ ] Read `matchGate.routes.ts` (`GET /api/match/setup-requirements` `:228-232`,
      `{ requirements: PLAYER_COUNT_SETUP }`, `Cache-Control: public, max-age=3600`; stale
      header JSDoc `:28-29` claims no registry import — already false, correct it),
      `lobbyApi.ts` (`fetchSetupRequirements` `:136`), `playerCountRequirements.ts`
      (`computePlayerCountMismatches` `:51` — pure, UNCHANGED), `LobbyView.vue` (mismatch
      computeds `:195-230`, `canSubmitCreate`/`canSubmitFromJson` gate `:239-250`,
      `fetchSetupRequirements` call `:697`).
- [ ] Autoplay is **Out of Scope** (`autoplay.mjs`'s default pool is a fixed
      non-Secret-Invasion scheme, so SI never reaches it — pre-flight RS-1/RS-2). Do NOT
      touch `autoplay.mjs`.

## Locked Values (do not re-derive)

- Scheme id: **`core/secret-invasion-of-the-skrull-shapeshifters`**; effective hero count
  from **`resolveEffectiveHeroCount`** (WP-524 — single source; no re-hardcode of "6").
- Endpoint: `GET /api/match/setup-requirements` gains an **optional `schemeId` query**;
  absent → base table (byte-identical to today); present → per-scheme `heroCount` projection.
- Cache: keep **`public, max-age=3600`**; the `schemeId` query is part of the URL cache key,
  so per-scheme responses cache independently.
- `playerCountRequirements.ts` is **UNCHANGED** — scheme-awareness is in the row values only.

## Guardrails

- [ ] Backward compatible: no `schemeId` → response byte-identical to pre-WP-525; a
      non-Secret-Invasion `schemeId` → base counts.
- [ ] Server projects via the WP-524 registry resolver — no copy of "6" server- or
      client-side.
- [ ] arena-client does NOT import `@legendary-arena/registry` at runtime — the scheme-aware
      count arrives as server data; the client only threads the id + consumes the row.
- [ ] The play-lobby Create gate now agrees with the engine (SI: 6 enables, 5 flagged).
- [ ] `api-endpoints.md` whole-row replace (D-11804; §21); `Auth` stays `guest`, `Status`
      unchanged; canonical field names.
- [ ] No engine / registry / determinism surface touched — server + client wiring only.

## Required Comments (`// why:`)

- [ ] `matchGate.routes.ts`: why the optional `schemeId` projection + why the base table is
      preserved when absent (backward compatibility for un-updated callers).
- [ ] `lobbyApi.ts` / `LobbyView.vue`: why re-fetch on scheme change (mismatch must reflect
      the selected scheme).

## Files to Produce (allowlist — see WP §Files Expected to Change)

- [ ] Server: `matchGate.routes.ts` (optional `schemeId` projection + header JSDoc fix) +
      route test.
- [ ] arena-client: `lobbyApi.ts` (`fetchSetupRequirements(schemeId?)`), `LobbyView.vue`
      (thread id + re-fetch) + lobby test.
- [ ] `docs/ai/REFERENCE/api-endpoints.md`: `/api/match/setup-requirements` whole-row.
- [ ] NOT touched: `playerCountRequirements.ts` (pure comparator), `autoplay.mjs`
      (out of scope), registry, engine, registry-viewer (WP-524).
- [ ] Governance: `WORK_INDEX` `[x]`, `EC_INDEX` Done, `DECISIONS` D-24338 Active, mindmap
      `✅` + `roadmap:counts:write`, `STATUS`, `NUMBER-LEDGER`.

## After Completing

- [ ] `pnpm --filter @legendary-arena/{server,arena-client} build && test` green (record delta).
- [ ] `pnpm -r --no-bail test` exits 0 (whole workspace).
- [ ] Control-revert non-vacuous: drop the server `schemeId` projection → the SI-6 route test
      + the arena-client Create-gate test fail; no-param + other-scheme tests stay green.
- [ ] `pnpm -r build` 0; api-catalog / `docs:check` gate green; `git diff --name-only` =
      allowlist + governance.
- [ ] Two-commit topology: `EC-560:` impl + `SPEC:` govern-close.
- [ ] Shipped as a set with WP-524.
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Common Failure Smells

- Re-hardcoding "6" in the server or client instead of calling the WP-524 resolver.
- Caching the no-param and `schemeId` responses under the same key (stale cross-scheme rows).
- Changing `playerCountRequirements.ts` (it must stay a pure comparator).
- Forgetting the `api-endpoints.md` whole-row → the §21 catalog gate fails.
- An arena-client runtime import of `@legendary-arena/registry` (layer violation).
