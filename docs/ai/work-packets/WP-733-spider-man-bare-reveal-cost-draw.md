# WP-733 — Spider-Man bare-`[keyword:reveal]` → `[keyword:reveal:2]` cost-draw parity (Card Data)

**Status:** Ready
**Primary Layer:** Card Data (curated hero-ability marker map + generated `data/cards/*.json`)
**Dependencies:** WP-253 / D-24024 (the collapsed parameterized `reveal` handler + `revealRulesForLegacyKeyword`), WP-215/WP-216 / D-21503 + D-21601 (the `[keyword:reveal(:N)?]` marker token + curated-map apply pipeline), WP-633 / D-24443 (the 5-stage card-data regen reproducibility gate)
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Lightweight-eligible (data-only: 3 files, no engine/keyword/canonical-array change, no new D). Determinism still verified empirically because 3 of the 5 cards are CORE.

> Baseline: `origin/main` at commit `e7976c04` (reserve WP-733 / EC-770), fetched 2026-09-21. Reserve line landed on `main` via the reserve-first SPEC PR #2238.

---

## Goal

After this session, the five core+co2e Spider-Man hero cards that print "**Reveal the top card of your deck. If it costs 2 or less, draw it.**" actually draw a revealed cost-≤2 card, by carrying the parameterized `[keyword:reveal:2]` marker their seven correctly-working siblings already use instead of the bare `[keyword:reveal]` marker that resolves to a silent no-op. No engine change: the `[keyword:reveal:2]` grammar and its `{predicate: cost-lte 2, actions:[draw]}` translation already ship (WP-253 / D-24024) and are proven live by the sibling cards.

---

## User-Visible Impact

A player who plays **Great Responsibility**, **Astonishing Strength**, or **Web-Shooters** (core), or **Astonishing Strength** / **Web-Shooters** (co2e), now reveals the top card of their deck and draws it when it costs 2 or less — the printed effect. Today all five reveal the card and then leave it on top, drawing nothing even at cost 0–2 (a silent dead half-ability). Confirmed live in a 2p Magneto / "Portals to the Dark Dimension" match: Great Responsibility and Astonishing Strength revealed cost-0 S.H.I.E.L.D. and cost-2 hero cards and left them all on top, logging `[blocked] no branch matched`.

---

## Assumes

- **The collapsed parameterized `reveal` handler exists** (WP-253 / D-24024): `revealRulesForLegacyKeyword(keyword, magnitude)` (`packages/game-engine/src/rules/revealRule.ts` ~196) translates `('reveal', 2)` → `[{ predicate: { kind:'cost-lte', threshold: 2 }, actions: [{ kind:'draw' }] }]`, and `('reveal', undefined)` → `[]` (empty rules = no-op) because `isValidRevealMagnitude(undefined)` is false (~150/211). The bare marker on the five cards yields exactly this empty-rules no-op — the documented behavior at `packages/game-engine/src/rules/heroAbility.setup.test.ts:855` ("a bare VP icon yields empty reveal rules (no draw threshold)").
- **The parser reads `[keyword:reveal:2]`'s `:2` as the effect magnitude** (`setup/heroAbility.setup.ts` ~121, D-21503 "optional :N suffix carries magnitude for rescue/reveal effects"). The threshold is NOT recoverable from the cards' plain-prose "costs 2 or less" text — only the `VP_COST_THRESHOLD_PATTERN` matches the parameterized `N[icon:vp] or less` form, which these cards do not print — so the `:2` marker parameter is the sole reliable source of the threshold.
- **The seven sibling cards already carry `[keyword:reveal:2]` and work**: `ssw1/ultimate-spider-man/leaping-spider`, `smhc/peter-parker-homecoming/heightened-senses` (×2), `cvwr/peter-parker/conflicted-loyalties`, `ssw2/…`, all printing the same "If it costs 2 or less, draw it." text.
- **The curated marker pipeline exists**: `apply-hero-ability-markers.mjs` reads `inputs/hero-ability-markers.json` and APPENDS tokens to `data/cards/*.json`; `check-card-data-regen.mjs --check` (`cards:check`) regenerates the 40 source-backed sets into a scratch dir and semantic-diffs against committed (co2e EXCLUDED — hand-authored, no converter source).
- `pnpm -r build` exits 0; engine test + `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` green on `e7976c04`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

The bug is a marker-parity defect, not a missing mechanic. `[keyword:reveal:2]` (reveal top; if cost ≤ 2, draw it) has shipped since WP-253/WP-255 and is exercised faithfully by seven Spider-Man-family cards. Five cards that print the identical ability were left carrying the **bare** `[keyword:reveal]` marker (threshold written only in plain prose). Because the reveal-rule translator derives the cost threshold solely from the marker's `:N` parameter (or a `N[icon:vp] or less` token, which these cards do not use), the bare marker produces empty `revealRules` — the reveal handler runs, peeks the deck top, matches no branch, and draws nothing. The hollow-effect detector does NOT flag it because a `reveal` effect IS emitted (with empty rules), so the card looks implemented.

Read before writing:

- `data/cards/core.json` — `spider-man` hero: `astonishing-strength` (idx 0), `great-responsibility` (idx 0), `web-shooters` (idx 1, after `[keyword:rescue:1]`). Each reveal line ends `… draw it. [keyword:reveal]`.
- `data/cards/co2e.json` — `spider-man` hero: `web-shooters` (idx 0), `astonishing-strength` (idx 0). Each reveal line ends `… draw it. [keyword:reveal]`.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — the `core` section carries the 3 core rows currently as `[keyword:reveal]`; the two co2e Spider-Man cards are NOT in the map (their markers were hand-authored directly into `co2e.json`).
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — the apply script is **append-only** (`markedLine = `${abilityLine} ${markupToken}``, ~335) with an exact-substring idempotence guard (`abilityLine.includes(markupToken)`, ~329). A plain re-run against a line that already carries `[keyword:reveal]` would APPEND a second token, not replace — so the fix is SURGICAL, not a plain re-run (see Non-Negotiable Constraints).
- `scripts/check-card-data-regen.mjs` — the `cards:check` reproducibility gate: semantic (whitespace-ignoring) diff of a from-source+map regen vs committed; co2e excluded.
- `packages/game-engine/src/rules/revealRule.ts` — `revealRulesForLegacyKeyword` (~196) + `isValidRevealMagnitude` (~150).
- Auto-memories `reference_hero_ability_marker_curated_map`, `reference_card_data_pipeline`, `feedback_card_data_derived_ci_gates`, `reference_crlf_status_vs_diff`.

---

## Non-Negotiable Constraints

- **The fix is SURGICAL — a full-pipeline regen is FORBIDDEN.** Committed `data/cards/*.json` are hand-compacted (aligned single-line entries); re-running `convert-cards-v15.mjs` + the apply passes into `data/cards` re-expands ~38 sets to `JSON.stringify(null,2)` formatting, producing a massive spurious diff (the `cards:check` gate is semantic and ignores it, but the git diff is not). Edit only the specific ability lines.
- **Core (3 cards): change the marker map AND `core.json` together.** Edit the 3 `core`-section rows in `hero-ability-markers.json` from `[keyword:reveal]` → `[keyword:reveal:2]`, AND surgically edit the same 3 `core.json` ability lines `… draw it. [keyword:reveal]` → `… draw it. [keyword:reveal:2]`. Both must change together so `cards:check` (which regenerates `core.json` from the updated map) stays semantically identical to committed.
- **co2e (2 cards): direct hand-edit of `co2e.json` only.** co2e is hand-authored, has no converter source, and is EXCLUDED from `cards:check`; the two Spider-Man cards are absent from the marker map. Edit the two `co2e.json` ability lines `… draw it. [keyword:reveal]` → `… draw it. [keyword:reveal:2]` directly; do NOT add them to the marker map (an append-only apply pass would double the token on the already-marked line).
- **No engine change, no new keyword, no canonical-array change, no new D.** `[keyword:reveal:2]` and its cost-lte-2-draw translation already exist (D-24024 / D-21601 / D-21503). Adding an engine file, a keyword, or a drift-array entry is out of scope and a FAIL.
- **Marker edits touch only the five cards' `abilities[i]` text** — no other card field, no other card, no other set.
- **Determinism (3 CORE cards):** the change makes these cards draw a revealed cost-≤2 card, altering deck/hand and therefore `finalStateHash` for any committed fixture/replay/sentinel that plays one of the three core cards. Run the full engine suite + the hash/replay/PAR fixture tests; if a pinned hash moves, confirm it is one of these three core Spider-Man cards (not an unrelated regression) and re-pin the affected fixture HONESTLY per `reference_hashed_g_field_dual_repin` — never edit a test/snapshot to force green.

---

## Scope

### In

- **`scripts/convert-cards/inputs/hero-ability-markers.json`** — the 3 `core` Spider-Man rows: `spider-man/astonishing-strength` idx 0, `spider-man/great-responsibility` idx 0, `spider-man/web-shooters` idx 1 → `markupToken` `[keyword:reveal]` becomes `[keyword:reveal:2]`.
- **`data/cards/core.json`** — surgically edit the same 3 ability lines to `… draw it. [keyword:reveal:2]`.
- **`data/cards/co2e.json`** — surgically hand-edit the 2 Spider-Man reveal lines (`spider-man/web-shooters` idx 0, `spider-man/astonishing-strength` idx 0) to `… draw it. [keyword:reveal:2]`.
- **`packages/game-engine/src/setup/heroAbility.setup.test.ts`** (or the nearest existing reveal-setup test) — a small regression test that building hero-ability hooks for at least one of the five cards (e.g. `core/spider-man/great-responsibility`) yields a `reveal` effect whose `revealRules` is `[{ predicate: { kind:'cost-lte', threshold: 2 }, actions:[{ kind:'draw' }] }]` (non-empty) — pinning the bug closed so a future bare-reveal reintroduction fails loudly.

### Out

- No engine source / keyword / `RevealPredicateKind` / `RevealActionKind` / `HERO_KEYWORDS` / `HERO_EFFECT_HANDLERS` change; no `apply-hero-ability-markers.mjs` / `VALID_TOKEN_PATTERN` change (`[keyword:reveal:N]` is already an admitted token).
- No derived-feed regeneration: `effect-index` / `mechanics:metadata` / `ledger:heroes` / `sim:runtime-observed` / `sim:coverage` all stay current under the marker change (the feeds are keyword-level; `reveal` was already present). Confirm each `:check` is green; regenerate only if one flags.
- No full-pipeline card regen (forbidden — reformats hand-compacted sets).
- No client / UIState / pending-choice / scoring / PAR / RNG-config / persistence / identity surface. "The Amazing Spider-Man" (core, `reveal-count:3`) and "With Great Power…" (co2e, `reveal:cost-lte-2:draw`) already work and are untouched.

---

## Files Expected to Change

- `scripts/convert-cards/inputs/hero-ability-markers.json` — 3 core Spider-Man rows `[keyword:reveal]` → `[keyword:reveal:2]`
- `data/cards/core.json` — 3 Spider-Man reveal lines re-marked (surgical)
- `data/cards/co2e.json` — 2 Spider-Man reveal lines re-marked (surgical hand-edit)
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — one non-empty-revealRules regression test

(Determinism: 3 of the 5 cards are CORE, so a committed fixture that plays one may move `finalStateHash`. Empirically at scaffold, the full committed replay/hash/PAR/fixture suite stays green with the fix in place — NO re-pin — but the executor MUST confirm on the whole engine suite and re-pin honestly if a pin shifts.)

---

## Contract

- Marker grammar (unchanged, already shipped): `[keyword:reveal:2]` parses to a `reveal` effect with `magnitude` 2, which `revealRulesForLegacyKeyword('reveal', 2)` translates to a single branch `{ predicate: cost-lte threshold 2, actions:[draw] }`. Non-match disposition is leave-on-top (unchanged). The bare `[keyword:reveal]` remains a valid (empty-rules) form for any card that intentionally reveals nothing — this WP does not remove or alter it.
- Resolved cards (idx confirmed at scaffold): `core/spider-man/{astonishing-strength#0, great-responsibility#0, web-shooters#1}`, `co2e/spider-man/{web-shooters#0, astonishing-strength#0}`.
- Core edits flow through the curated map + `cards:check` reproducibility; co2e edits are a direct hand-edit (co2e is regen-excluded).

---

## Acceptance Criteria

1. Building hero-ability hooks for each of the five cards yields a `reveal` effect whose `revealRules` is the non-empty `[{ predicate: cost-lte threshold 2, actions:[draw] }]` (asserted for at least `core/spider-man/great-responsibility` by a new test; the other four verified by the shared marker + `cards:check`).
2. `data/cards/core.json` and `data/cards/co2e.json` carry `[keyword:reveal:2]` on the five lines; no bare `[keyword:reveal]` remains on any of the five (grep).
3. The 3 `core` marker-map rows read `[keyword:reveal:2]`; `cards:check` exits 0 (committed `core.json` is semantically reproducible from source + updated map). co2e is excluded and unaffected.
4. `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all exit 0 with no regeneration required (the marker change is keyword-neutral).
5. Full `@legendary-arena/game-engine` suite green; `pnpm -r build` 0. `finalStateHash` verified: unchanged, or re-pinned honestly with the reason recorded if a committed fixture plays one of the three core cards.
6. `git diff --name-only` shows only the four allowlist files (no full-regen churn across other `data/cards/*.json`); any `lagn-v1.json` CRLF build churn reverted.

---

## Verification Steps

1. Apply the surgical edits (3 map rows + 3 `core.json` lines + 2 `co2e.json` lines) + the regression test.
2. `pnpm cards:check` → 0 (regen reproducibility; co2e excluded). Then `pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && node scripts/hero-effect-coverage.mjs --check` → all 0 (no feed regen needed; regenerate + commit only a feed that actually flags).
3. `pnpm --filter @legendary-arena/game-engine build` → 0; `pnpm --filter @legendary-arena/game-engine test` → all pass, including the new non-empty-revealRules regression test.
4. `pnpm -r build && pnpm -r --no-bail test` → repo-green (build before test; stale `dist` fakes failures).
5. Determinism: run the hash/replay/PAR fixture tests (`replay/replay.hash.test.ts`, `test/fixtures/hashGameState.test.ts`, `test/fixtures/replayFixtures.test.ts`, `scoring/parScoring.keys.test.ts`, `game.test.ts`). If any pinned hash moved, confirm it is one of the three core Spider-Man cards and re-pin the affected fixture with a `// why:` note — never hand-edit to force green.
6. `git diff --name-only` = the four allowlist files only; revert any `lagn-v1.json` CRLF churn.

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` = the four allowlist files (no cross-set regen churn).
- [ ] WORK_INDEX row checked; EC_INDEX Done; mindmap node `✅`; `roadmap:counts:check` 0; `ledger:numbers:check` 0. (No D to flip — none reserved.)
- [ ] **D-24026 live-verify (post-merge, REQUIRED):** in a live match on `play.legendary-arena.com`, playing Great Responsibility / Astonishing Strength / Web-Shooters reveals the top card and draws it when it costs 2 or less. Verified against the deployed `/api/version` gitSha; recorded as a follow-up STATUS-flip, not a merge blocker.

---

## Vision Alignment

- **Vision clauses touched:** §1/§2/§10 (card content semantics — faithful implementation of a printed ability); §3/§8 (determinism — the reveal reads the hashed deck and `draw` shuffles via `ctx.random`; no `Math.random`).
- **How honored:** the mechanic already exists in its faithful home (the parameterized reveal-rule handler, leave-on-top); this WP only corrects five cards' marker so they use it, matching the seven working siblings. No pay-to-win surface (NG-1) — a card draw is gameplay, not a purchasable advantage.

## §20 Funding Surface — N/A

This WP touches none of the §20.1 trigger surfaces: it is a card-data marker-parity correction with no monetization, entitlement, checkout, pricing, Legendary Pass, or revenue-reporting surface.

## API Catalog Update — N/A

No HTTP endpoint or `apps/server` library-surface change (D-11804 not triggered).

## Lint Gate Self-Review (00.3)

All 21 sections resolved:

- **§1–3 (identity / status / layer):** `## Goal`, `## Assumes`, `## Context (Read First)` present; `**User-Visible Surface:**` + `## User-Visible Impact` present. Layer = Card Data (marker map + generated JSON) + one engine test.
- **§4 (scope closed):** `## Scope (In / Out)` is a closed enumeration; the allowlist matches EC-770 `Files to Produce`.
- **§5 (output completeness):** `## Files Expected to Change` lists all four touched files; explicitly asserts NO derived-feed regen and NO full-pipeline regen.
- **§6 (naming):** card slugs (`astonishing-strength`, `great-responsibility`, `web-shooters`) and field names (`abilities`, `markupToken`) match `00.2` / the marker-map schema; `revealRules` / `cost-lte` match the engine contract.
- **§7 (dependencies):** WP-253/D-24024, WP-215/216/D-21503+D-21601, WP-633/D-24443 all landed on `e7976c04` (verified — the reveal handler, the marker pipeline, and the regen gate are all present; the seven sibling cards prove the token works).
- **§8 (architecture):** data-only marker correction + one pure-setup test; no I/O, no layer crossing, no persistence.
- **§9–10 (Windows / env):** no shell, no env vars, no OS-specific path.
- **§11 (auth):** N/A — no endpoint / auth surface.
- **§12 (tests):** `node:test`, `.test.ts`; the new regression test fails loudly on a re-empty `revealRules`.
- **§13–15 (verification / AC / DoD):** present and testable; §15 D-24026 live-verify item present.
- **§16 (code style):** the fix is a data edit; the one test uses full-word names + a `// why:` note on the bug it pins.
- **§17 (Vision):** triggered (card semantics + determinism) → `## Vision Alignment` present.
- **§18 (prose-vs-grep):** verification uses runnable commands (§Verification Steps), not prose claims.
- **§19 (bridge-vs-HEAD):** baseline `e7976c04` cited; no stale-bridge artifacts.
- **§20 (funding):** `## §20 Funding Surface — N/A` with justification present.
- **§21 (API catalog / D-11804):** `## API Catalog Update — N/A` — no HTTP endpoint or `apps/server` library-surface change.

**Verdict:** all sections PASS or justified N/A.

## Pre-flight (01.4)

- **Dependencies complete on `main`:** verified at `e7976c04` — `revealRulesForLegacyKeyword('reveal', 2)` → cost-lte-2-draw and `('reveal', undefined)` → `[]` confirmed by reading `revealRule.ts`; the seven `[keyword:reveal:2]` siblings confirmed in `ssw1`/`smhc`/`cvwr`/`ssw2`; the append-only apply script + exact-substring idempotence guard confirmed; the `cards:check` co2e exclusion confirmed.
- **Scope locked:** the allowlist is closed (3 data files + 1 engine test); no engine/keyword/drift/D change; the SURGICAL recipe is mandated and the full-pipeline regen is forbidden (empirically shown to reformat ~38 hand-compacted sets).
- **Validation-tightening?** No — the change is additive card-semantics resolution (a bare marker gains a threshold parameter); it makes no previously-accepted input newly-rejected. The five cards begin drawing; nothing else changes. Scaffold-first was nonetheless run: the surgical edit + `cards:check` + all `:check` gates + the hash/replay/PAR/fixture suite were exercised and are green, and the full-regen blast radius was measured and rejected.
- **Ambiguities resolved:** the co2e path (direct hand-edit, not marker-map, because co2e is regen-excluded and the apply script is append-only) is decided and recorded; the exact five cards + indices are locked; no new D is needed (existing D-24024/D-21601/D-21503 own the token + behavior).

**Verdict: READY TO EXECUTE.**

## Copilot (01.7) — self-review

- **Reward integrity:** no test/gate is weakened. The new regression test asserts the FAITHFUL behavior (non-empty cost-lte-2-draw `revealRules`), so the five cards fire *for the right reason*; the fix is proven against the real committed corpus (`cards:check`) and the real hash/replay fixtures, not a fixture that always passes.
- **Faithfulness over convenience:** the fix routes the five cards through the already-shipped faithful reveal handler (matching the seven working siblings), rather than inventing a new mechanic; the bare `[keyword:reveal]` form is left intact for cards that intentionally reveal nothing.
- **Determinism honesty:** 3 CORE cards → the WP does NOT pre-assert "hash unchanged" as a guarantee; it records the empirical scaffold result (green, no re-pin) AND mandates the executor re-verify on the full suite and re-pin honestly if a pin shifts — never edit a pin.
- **Recipe safety:** the append-only apply script cannot rewrite an existing marker, so the WP mandates the surgical map+`core.json` edit (gated by `cards:check`) and forbids the full-pipeline regen (measured to reformat ~38 sets). The co2e branch is handled correctly for a regen-excluded hand-authored set.
- **Layer/scope:** data-only + one test; no cross-layer wiring; no new D (matches the WP-224/WP-225/D-24551 marker-sweep precedent of minimal decision surface).

**Verdict: PASS.**
