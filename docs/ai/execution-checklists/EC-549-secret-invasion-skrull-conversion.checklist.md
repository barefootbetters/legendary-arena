# EC-549 — Secret Invasion: Cross-Deck Hero Conversion + Escape Loss

**WP:** WP-514 · **Layer:** Game Engine (`packages/game-engine`) · **Baseline:**
`origin/main` @ `6a735274` · **Lane:** Standard two-session.

Authoritative execution contract for WP-514. The WP is the design authority; on
conflict the WP wins. Subordinate to ARCHITECTURE.md + `.claude/rules/*`.

> **GATES MUST RULE ON SIZE FIRST (~17 files, self-flagged over-size).** Four
> coupled net-new mechanics + a change to the **shared** `defeatCityVillainCore`.
> Presented as ONE WP (a split ships an incoherent half-scheme). Proposed split axis
> if pre-flight rules over-size: **514a** = setup cross-deck conversion + cost-proxy
> attack + escaped-converted loss; **514b** = defeat-to-gain + HQ→Sewers twist.
> **Do not start coding until pre-flight has ruled one-WP vs split.**

## Before Starting

- [ ] `git pull --ff-only origin main` clean; fresh branch off `6a735274`.
- [ ] WP-513 merged (converted-card overlay `G.convertedVillainOrigins` +
      `ConvertedVillainOrigin` + `escaped-converted-count` +
      `countEscapedByConvertedOrigin`).
- [ ] WP-508 merged (escaped-pile carry + `resourceLossCondition` + escape-branch
      call site in `villainDeck.reveal.ts`).
- [ ] Read `setup/buildInitialGameState.ts` (hero reservoir `shuffledHeroDeck`
      before `fillHqFromDeck`; villain-deck build; shuffle order),
      `setup/buildHeroDeck.ts` (last shuffle), `villainDeck/villainDeck.setup.ts`,
      `economy/economy.resolve.ts` (overlay-first pattern + dynamic cost reads
      `cardStats.cost`), `moves/fightVillain.ts` (`defeatCityVillainCore` reward
      routing ~`:200-300`), `board/heroCapture.logic.ts` (`awardAttachedHeroes`),
      `board/city.logic.ts` (`pushVillainIntoCity` space 0 = Sewers; `refillHqSlot`),
      `rules/schemeTwistResolvers.ts` (`koFromHq` cost-selection),
      `rules/schemeResourceLoss.ts` (`countEscapedByConvertedOrigin` origin param).

## Locked Values (do not re-derive)

- Secret Invasion scheme id: **`core/secret-invasion-of-the-skrull-shapeshifters`**.
- Converted origin: **`'skrull'`**; overlay field **`G.convertedVillainOrigins`**
  (reused from WP-513; type extended `'killbot' | 'skrull'`).
- Heroes shuffled into the villain deck at setup: **12**, drawn from the **top of
  the shuffled hero reservoir** (`shuffledHeroDeck` before `fillHqFromDeck`).
- Converted cards typed **`'villain'`** in `villainDeckCardTypes`; `RevealedCardType`
  (closed 5-value union) **NOT** extended.
- Skrull attack: **`(G.cardStats[id]?.cost ?? 0) + 2`** — a **documented PROXY** for
  the printed "Hero's VP + 2" (hero VP absent from all data; operator-chosen). Swap
  seam: `G.cardVictoryPoints[id] + 2` if hero VP ever lands.
- Defeat-to-gain: a defeated **`'skrull'`**-origin city card → push the fought
  `cardId` **directly** to the defeating player's **discard** (replace the
  `victory.push` at `fightVillain.ts:221`) + clear its `convertedVillainOrigins`
  entry + **emit a `pushLog` naming the gained Hero** (mirror the attached-hero log
  at `:269-278` — copilot #2). Do **NOT** call `awardAttachedHeroes(cardId)` — it
  routes a villain's *attached* heroes (`G.villainAttachedHeroes`), not the fought
  card (RS-2).
- Twist resolver id **`'secret-invasion'`**; narrative key **`'secretInvasion'`**;
  moves the **highest-cost** HQ Hero into the Sewers (`pushVillainIntoCity`,
  space 0), refills via `refillHqSlot`; ties break by **lowest slot index**
  (ascending, matching `koFromHq`'s comparator — pin the direction in the test, RS-3).
- Loss: **`escaped-converted-count`** / origin `'skrull'` / threshold **6**.
- `lossThreshold` retained but inert (proxy suppressed; 8 twists = deck count, not
  a loss).

## Guardrails

- [ ] Do NOT extend `RevealedCardType` / its drift guard / reveal-routing switches.
- [ ] Do NOT change `schemeResourceLoss.ts` — `countEscapedByConvertedOrigin` is
      origin-parametric; `{ origin: 'skrull', threshold: 6 }` works once the type is
      extended.
- [ ] Do NOT change `buildCardVictoryPoints` / add `G.cardVictoryPoints` entries —
      the attack proxy reads existing `G.cardStats.cost`.
- [ ] The escaped count reads the **origin overlay** (`'skrull'`), never `'villain'`.
- [ ] Defeat-to-gain is a **guarded** branch: only `'skrull'` origin routes to
      discard; every non-Skrull defeat is byte-unchanged (assert BOTH halves).
- [ ] The cross-deck re-shuffle is a **single new `ctx.random.Shuffle`**, gated to
      Secret Invasion, and the **LAST** random draw in setup. No other new
      randomness. The conversion helper is pure (`ctx.random` + resolved data passed
      in; no `boardgame.io`/registry import).
- [ ] Skrull attack is engine-resolved in `resolveFightCost` overlay-first (before
      the `cardStats → 0` guard); the UI consumes the resolved value.
- [ ] New twist resolver touches `SchemeTwistResolverKey` union + `SCHEME_TWIST_RESOLVER_KEYS`
      drift array + `RESOLVER_KEY_PHRASES` record (all three — TS-enforced); update
      the resolver-count drift test (`notableEvents.types.test.ts` "exactly six" → 7)
      **and** correct **every** stale "five" resolver-key reference in the same edit
      (copilot #1): `notableEvents.types.ts` `:75`, `:90-92`, `:156-157`, `:164`
      (all already wrong — array is 6) + `notableEvents.types.test.ts:5-6`.
- [ ] No `.reduce()`; `evaluateEndgame` stays counter-only.
- [ ] Determinism: no committed SI fixture → sentinel + `PRE_WP080_HASH` expected
      **byte-identical**. Any shift → STOP (SI-gated draw/overlay leaked into a non-SI
      game); apply the dual re-pin rule only if deliberate, never blind.

## Required Comments (`// why:`)

- [ ] `buildInitialGameState.ts` (or the conversion helper): why the villain-deck
      re-shuffle is the last `ctx.random` draw and gated to Secret Invasion
      (determinism — non-SI byte-identical).
- [ ] `economy.resolve.ts` skrull branch: `// PROXY:` — hero VP absent from data;
      cost approximates; swap seam to `G.cardVictoryPoints` when VP lands.
- [ ] `fightVillain.ts` defeat-to-gain branch: why a Skrull routes to discard
      (printed "you gain it") + clears the overlay; and the `pushLog` `why:` (a hero
      in the deck with no log trail is a papercut — the `:269-273` precedent).
- [ ] `schemeTwistConfigs.ts` SI entry: why `resourceLossCondition` suppresses the
      twist-count proxy.
- [ ] any `ctx.random.*` use (per code-style).

## Files to Produce (allowlist — see WP §Files Expected to Change)

- [ ] `types.ts` (`ConvertedVillainOrigin` += `'skrull'`);
      `rules/schemeTwistConfig.types.ts` (`SchemeTwistResolverId` += `'secret-invasion'`);
      `setup/buildInitialGameState.ts` + `setup/convertHeroesToSkrulls.ts` (new pure
      helper); `rules/schemeTwistResolvers.ts`; `rules/schemeTwistConfigs.ts`;
      `economy/economy.resolve.ts`; `moves/fightVillain.ts`;
      `events/notableEvents.types.ts`; `events/notableEvents.compose.ts`.
- [ ] Tests: `setup/*.test.ts`, `economy/economy.resolve.test.ts`,
      `moves/fightVillain.test.ts`, `rules/schemeTwistResolvers.test.ts`,
      `rules/schemeResourceLoss.test.ts`, `rules/schemeHandlers.test.ts`,
      `events/notableEvents.types.test.ts`.
- [ ] NOT touched: `schemeResourceLoss.ts` (origin-parametric), `villainDeck.reveal.ts`
      (escape call site reused), `buildCardVictoryPoints`, `economy.logic.ts`,
      `ui/uiState.*` (attack rides existing `fightCost` projection), `game.test.ts`
      (no new bgio move).
- [ ] Governance: `WORK_INDEX` `[x]`, `EC_INDEX` Done, `DECISIONS` D-24326 + D-24327
      Active, mindmap `✅` + `roadmap:counts:write`, `STATUS`, `NUMBER-LEDGER`.

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green (record delta).
- [ ] `pnpm -r --no-bail test` exits 0 (whole workspace — the WP-508 lesson;
      outcome shifts are invisible to the engine suite alone).
- [ ] Control-revert non-vacuous: drop SI config → AC-5/AC-6 fail; drop skrull
      attack mode → AC-3 fails; drop defeat-to-gain → AC-4 skrull-half fails,
      non-skrull half green. Restore.
- [ ] Sentinel + `PRE_WP080_HASH` byte-identical (or deliberate dual re-pin
      documented); `sim:runtime-observed:check` current; `pnpm -r build` 0.
- [ ] Two-commit topology: `EC-549:` impl + `SPEC:` govern-close.
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Common Failure Smells

- The re-shuffle placed BEFORE the hero shuffle (or an extra `ctx.random` draw for
  non-SI games) → every fixture re-pins.
- Counting escaped `'villain'` (includes the scheme's real villains) instead of the
  `'skrull'` origin overlay.
- Defeat-to-gain applied unconditionally → non-Skrull villains wrongly land in
  discard (assert the non-skrull half stays victory-pile).
- Skrull gained into discard with **no log line** → a hero appears in the player's
  deck with no trail (the exact papercut `fightVillain.ts:269-273` guards against);
  assert the `pushLog` fires.
- Twist selecting the lowest-cost HQ hero (un-flipped `koFromHq` comparator).
- Adding the resolver key to the union but forgetting the drift array or the phrase
  record (TS will flag two of the three; the count drift test catches the rest).
- Reading a non-existent `G.cardVictoryPoints`/`G.cardCosts` for the attack instead
  of `G.cardStats[id].cost`.
