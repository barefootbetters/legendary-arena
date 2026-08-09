# EC-548 — Killbots: Converted-Bystander Villains + Escape Loss

**WP:** WP-513 · **Layer:** Game Engine (`packages/game-engine`) · **Baseline:**
`origin/main` @ `3a51b63d` · **Lane:** Standard two-session.

Authoritative execution contract for WP-513. The WP is the design authority; on
conflict the WP wins. Subordinate to ARCHITECTURE.md + `.claude/rules/*`.

> **Gates ruled — ONE WP, ~11 files (do NOT split).** Pre-flight verified the true
> surface is smaller than the draft implied (display already exists for
> `bystander-villain-deck-NN`; attack rides the existing `fightCost` projection;
> fightability/defeat are free) and returned READY. Folded RS items (locked below):
> **RS-1** lazy-materialize `convertedVillainOrigins` (Killbots-only → no hash re-pin);
> **RS-2** widen `applyEscapedPileResourceLoss` in-place (reveal.ts untouched);
> **RS-3** overlay-first attack in `resolveFightCost` (no `economy.logic.ts`);
> **RS-4** attack rides the existing `fightCost` projection (no new UIState field);
> Killbot display-label deferred (cosmetic).

## Before Starting

- [ ] `git pull --ff-only origin main` clean; fresh branch off `3a51b63d`.
- [ ] WP-508 merged (`resourceLossCondition` framework + `schemeResourceLoss.ts` +
      the escape-branch call site).
- [ ] Read `villainDeck/villainDeck.setup.ts` (deck build + typing),
      `villainDeck/villainDeck.reveal.ts` (routing + escape call site),
      `economy/economy.resolve.ts` (dynamic fightCost), `rules/schemeResourceLoss.ts`.

## Locked Values (do not re-derive)

- Killbots scheme id: **`core/replace-earths-leaders-with-killbots`**.
- Converted origin: **`'killbot'`**; overlay field **`G.convertedVillainOrigins`**.
- Converted cards typed **`'villain'`** in `villainDeckCardTypes` (native routing);
  `RevealedCardType` (closed 5-value union) is **NOT** extended.
- Per-scheme twist counter: seeded **3** at setup; **+1** per `'killbots'` twist;
  Killbot attack **= that counter**.
- Loss: **`escaped-converted-count`** / origin `'killbot'` / threshold **5**.
- `lossThreshold: 5` retained but inert (proxy suppressed).

## Guardrails

- [ ] Do NOT extend `RevealedCardType` / its drift guard / reveal-routing switches.
      Converted cards route via `'villain'`; identity lives in `convertedVillainOrigins`.
- [ ] The escaped count reads the **origin overlay** (`'killbot'`), never `'villain'`.
- [ ] Killbot attack is engine-resolved in `resolveFightCost`; the UI consumes the
      resolved value (never recomputes).
- [ ] Per-scheme twist counter is a new `G.counters` key (integer); no new counter
      type; `evaluateEndgame` stays counter-only.
- [ ] New `UIState` field (converted-villain projection) MUST pass the audience
      filter (Board-Visible Field Rule — 5-step contract).
- [ ] No `.reduce()`; no `ctx.random.*` added at setup; no `boardgame.io`/registry
      import in pure helpers.
- [ ] Determinism: new `G.convertedVillainOrigins` + counter key are hashed. No
      Killbots fixture exists → sentinel + `PRE_WP080_HASH` expected byte-identical.
      Any shift → STOP, apply the dual re-pin rule deliberately (never blind).

## Required Comments (`// why:`)

- [ ] `villainDeck.setup.ts`: why converted bystanders are typed `'villain'` (native
      routing) + recorded in the origin overlay (identity for count/attack/display).
- [ ] `economy.resolve.ts`: why the killbot attack reads the per-scheme twist counter.
- [ ] `schemeTwistConfigs.ts` Killbots entry: why `resourceLossCondition` suppresses
      the twist-count proxy.

## Files to Produce (allowlist — see WP §Files Expected to Change)

- [ ] `types.ts` (`convertedVillainOrigins?` optional field); `villainDeck/villainDeck.setup.ts`;
      `setup/buildInitialGameState.ts` (Killbots-only seed); `rules/schemeTwistConfig.types.ts`;
      `rules/schemeResourceLoss.ts` (widen in-place); `rules/schemeTwistResolvers.ts`;
      `rules/schemeTwistConfigs.ts`; `economy/economy.resolve.ts` (overlay-first).
- [ ] Tests: `schemeResourceLoss.test.ts`, `schemeTwistResolvers.test.ts`,
      `economy/economy.resolve.test.ts`, `setup/*.test.ts`, `schemeHandlers.test.ts`.
- [ ] NOT touched (RS-3/RS-4): `economy.logic.ts`, `ui/uiState.build.ts`,
      `ui/uiState.filter.ts`, `villainDeck/villainDeck.reveal.ts`.
- [ ] Governance: `WORK_INDEX` `[x]`, `EC_INDEX` Done, `DECISIONS` D-24324 + D-24325
      Active, mindmap `✅` + `roadmap:counts:write`, `STATUS`, `NUMBER-LEDGER`.

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green (record delta).
- [ ] `pnpm -r --no-bail test` exits 0 (whole workspace — the WP-508 lesson).
- [ ] Control-revert non-vacuous: drop Killbots config → AC-4/AC-5 fail; drop the
      converted-attack mode → AC-3 fails. Restore.
- [ ] Sentinel + `PRE_WP080_HASH` byte-identical (or deliberate dual re-pin);
      `sim:runtime-observed:check` current; `pnpm -r build` 0.
- [ ] Two-commit topology: `EC-548:` impl + `SPEC:` govern-close.
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Common Failure Smells

- Counting escaped `'villain'` (includes real villains) instead of the origin overlay.
- Extending `RevealedCardType` (the whole point of the overlay is to avoid that).
- A new `UIState` field that stops at `buildUIState` and is dropped at the audience
  filter (Board-Visible Field Rule — a known shipped failure mode).
- Killbot attack recomputed client-side instead of read from the engine.
