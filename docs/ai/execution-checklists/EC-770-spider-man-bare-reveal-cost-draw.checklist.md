# EC-770 — Spider-Man bare-`[keyword:reveal]` → `[keyword:reveal:2]` cost-draw parity (Execution Checklist)

**Source:** docs/ai/work-packets/WP-733-spider-man-bare-reveal-cost-draw.md
**Layer:** Card Data (curated marker map + generated `data/cards/*.json`) + one engine test

## Before Starting
- [ ] Baseline: `origin/main` @ `e7976c04` (or later); working tree clean, synced. Reserve line WP-733/EC-770 already on `main` (PR #2238).
- [ ] Collapsed reveal handler landed (WP-253/D-24024): `revealRulesForLegacyKeyword('reveal', 2)` → `[{ predicate:{kind:'cost-lte', threshold:2}, actions:[{kind:'draw'}] }]`; `('reveal', undefined)` → `[]` (empty = no-op) via `isValidRevealMagnitude` (`rules/revealRule.ts` ~150/196/211). Documented at `rules/heroAbility.setup.test.ts:855`.
- [ ] `[keyword:reveal:2]`'s `:2` parses to the effect magnitude (D-21503, `setup/heroAbility.setup.ts` ~121). The cards' plain-prose "costs 2 or less" is NOT machine-readable (only `N[icon:vp] or less` is) → the `:2` parameter is the sole threshold source.
- [ ] The 7 sibling cards already carry `[keyword:reveal:2]` and work (`ssw1/ultimate-spider-man/leaping-spider`, `smhc/peter-parker-homecoming/heightened-senses`, `cvwr/peter-parker/conflicted-loyalties`, `ssw2/…`).
- [ ] `apply-hero-ability-markers.mjs` is APPEND-ONLY with an exact-substring idempotence guard (`abilityLine.includes(markupToken)`, ~329/335) — a plain re-run cannot rewrite an existing `[keyword:reveal]` (it would double the token).
- [ ] `cards:check` (`check-card-data-regen.mjs`) regenerates the 40 source-backed sets and semantic-diffs vs committed; **co2e is EXCLUDED** (hand-authored, no source).
- [ ] `pnpm -r build` 0; engine test + `cards:check` + `effect-index:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` + `sim:coverage --check` green.
- [ ] Scope lock — target files = `Files to Produce`. Anything else (esp. other `data/cards/*.json` from a full regen) is a FAIL; surface it as a blocker.

## Locked Values (do not re-derive)
- Token change: `[keyword:reveal]` → `[keyword:reveal:2]` (NOTHING else on the line changes).
- The 5 cards (idx confirmed at scaffold): `core/spider-man/astonishing-strength#0`, `core/spider-man/great-responsibility#0`, `core/spider-man/web-shooters#1` (after `[keyword:rescue:1]` at idx 0); `co2e/spider-man/web-shooters#0`, `co2e/spider-man/astonishing-strength#0`.
- Core path: edit the 3 `core`-section rows in `scripts/convert-cards/inputs/hero-ability-markers.json` `[keyword:reveal]`→`[keyword:reveal:2]` AND surgically edit the same 3 `core.json` ability lines — TOGETHER (so `cards:check`'s from-map regen matches committed).
- co2e path: DIRECT hand-edit of the 2 `co2e.json` lines only. co2e is regen-excluded and the 2 cards are NOT in the marker map — do NOT add map rows (append-only apply would double the token).
- Translation target (what the new test pins): `revealRules === [{ predicate:{kind:'cost-lte', threshold:2}, actions:[{kind:'draw'}] }]` (non-empty) for at least `core/spider-man/great-responsibility`.
- NO new D (D-24024 reveal grammar / D-21601 token closed-set / D-21503 `:N` magnitude already own it). NO engine/keyword/canonical-array/`VALID_TOKEN_PATTERN` change.

## Guardrails
- **SURGICAL only. A full-pipeline regen (`convert-cards-v15.mjs` + apply passes into `data/cards`) is FORBIDDEN** — it re-expands ~38 hand-compacted sets to `JSON.stringify(null,2)`, a massive spurious git diff. Edit only the specific ability lines.
- Marker edits touch ONLY the 5 cards' `abilities[i]` text — no other field, card, or set.
- NO derived-feed regen: `effect-index` / `mechanics:metadata` / `ledger:heroes` / `sim:runtime-observed` / `sim:coverage` are keyword-level and stay current under the marker change. Confirm each `:check` is 0; regenerate + commit ONLY a feed that actually flags.
- **Determinism (3 CORE cards):** the fix makes these cards draw a revealed cost-≤2 card → `finalStateHash` may move for a committed fixture that plays one. If a pin moves, confirm it is one of the 3 core Spider-Man cards (not a regression) and re-pin the affected fixture HONESTLY (`reference_hashed_g_field_dual_repin`). NEVER edit a test/snapshot/pin to force green; NEVER re-route to dodge a pin.
- Revert any `lagn-v1.json` CRLF build churn before commit; `git diff --name-only` must be the 4-file allowlist.

## Required `// why:` Comments
- The new regression test: `// why:` WP-733 — bare `[keyword:reveal]` yielded empty revealRules (a silent no-op, `heroAbility.setup.test.ts:855`); `:2` restores the cost-lte-2 draw. Pin it non-empty so a bare-reveal reintroduction fails loudly.

## Files to Produce
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 3 core Spider-Man rows `[keyword:reveal]` → `[keyword:reveal:2]`
- `data/cards/core.json` — **modified (surgical)** — 3 Spider-Man reveal lines re-marked
- `data/cards/co2e.json` — **modified (surgical hand-edit)** — 2 Spider-Man reveal lines re-marked
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — one non-empty-revealRules regression test

## After Completing
- [ ] `pnpm cards:check` 0; `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all 0 (no regen); `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes incl. the new non-empty-revealRules test; full repo `pnpm -r --no-bail test` green
- [ ] `grep -c '\[keyword:reveal\]' data/cards/core.json data/cards/co2e.json` on the 5 lines = 0 remaining bare; 5 lines now carry `[keyword:reveal:2]`
- [ ] `finalStateHash` outcome recorded: unchanged, or re-pinned honestly with the core-Spider-Man reason — never hand-edited
- [ ] `git diff --name-only` = the 4-file allowlist only (no cross-set regen churn); `lagn-v1.json` CRLF churn reverted
- [ ] Live-on-surface verification — REQUIRED post-merge (surface = `play.legendary-arena.com`, D-24026): playing Great Responsibility / Astonishing Strength / Web-Shooters reveals the top card and draws it at cost ≤ 2
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` WP-733 checked; `EC_INDEX.md` Done; mindmap `✅`; `roadmap:counts:check` 0; `ledger:numbers:check` 0

## Common Failure Smells
- A double token `[keyword:reveal] [keyword:reveal:2]` on a line → the apply script was re-run against already-marked JSON instead of a surgical edit (append-only cannot rewrite).
- `cards:check` red → the `core.json` line and the marker-map row disagree (edit BOTH together), or a full regen reformatted other sets.
- Dozens of `data/cards/*.json` in `git diff` → a full-pipeline regen ran (forbidden); revert and edit surgically.
- co2e added to the marker map / regenerated → co2e is regen-excluded and hand-authored; edit `co2e.json` directly, leave the map alone.
- A hash/replay/PAR fixture went red and was "fixed" by editing the pin → reward-integrity violation; re-pin the fixture honestly only after confirming it is one of the 3 core cards.
- A `:check` feed gate red → a feed actually shifted; regenerate + commit that one feed (do not blanket-regen).
