# EC-386 — `shuffle-discard-empty-reward` Hero Keyword (Execution Checklist)

**Source:** docs/ai/work-packets/WP-356-shuffle-discard-empty-reward.md
**Layer:** Game Engine (+ card-data pipeline)

## Before Starting
- [ ] WP-356 + D-24148 (reserved) merged on `main` (PR #689); EC-386 confirmed free on latest `EC_INDEX.md`
- [ ] Baseline refresh (value-only, WP back-synced at close): `origin/main @ e38f0314` — WP-364 landed two gain-wound keywords after the draft, moving the engine suite from 1877/438 to **1903/444/0**
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 at **1903/444/0** — else STOP
- [ ] Scope lock — the EXACT target file set is the `Files to Produce` list below; any other modification is a FAIL, surface it as a blocker before touching the file

## Locked Values (do not re-derive)
- Keyword slug (union + array + token + handler key): `shuffle-discard-empty-reward`
- Token grammar: `[keyword:shuffle-discard-empty-reward:<reward>:<n>]`; `<reward>` ∈ `recruit | attack`; build gate `[1-9]\d*`, engine parser captures `(\d+)` (D-24019 split)
- Marker rows (antm, both `abilityIndex: 0`): jocasta/`reprocess` → `[keyword:shuffle-discard-empty-reward:recruit:2]`; jocasta/`electromagnetic-eyebeams` → `[keyword:shuffle-discard-empty-reward:attack:2]`
- Descriptor: `{ type: 'shuffle-discard-empty-reward', magnitude: <n>, rewardType: <reward> }` — `heroAbility.types.ts` untouched
- Seeded rewards set: exactly `'recruit'`, `'attack'` (narrower than D-24019's four)
- Executor branches: `discard.length === 0` → `addResources(G.turnEconomy, magnitude, 0)` for attack / `addResources(G.turnEconomy, 0, magnitude)` for recruit; otherwise `moveAllCards(discard, deck)` then `deck = shuffleDeck(combined, ctx as ShuffleProvider)`, discard `[]`
- Test delta: 1903/444 → **1914/447/0** (+11 tests in exactly 3 new `describe()` blocks: 1 registration + 4 parser + 6 executor)

## Guardrails
- `heroAbility.types.ts` is NOT modified; no new move, no pending queue, no projection, no client change
- `HANDLED_KEYWORDS` and `HERO_EFFECT_HANDLERS` updated TOGETHER (bidirectional drift test); keyword joins `MVP_KEYWORDS` via the `HANDLED_KEYWORDS` spread — do not add it to any other category set
- Do NOT add the keyword to `NO_MAGNITUDE_KEYWORDS` — the token carries `<n>`; the executor owns its own `magnitude >= 1` floor (the D-24019 downstream convention — `isValidMagnitude` deliberately admits 0)
- Handler guards: missing player zones or a rewardType outside the seeded pair → silent no-op; both REAL branches push exactly one `G.messages` line
- The only randomness is `shuffleDeck` via `ctx` narrowed to `ShuffleProvider` — no `Math.random`, no hand-rolled shuffle; `// why:` on the narrowing
- No `.reduce()` in any changed file; new tests wrapped in `describe()` blocks (bare `test()` calls would land 1914/444 and FAIL the locked suite count)
- Marker regen is the apply script's job — never hand-edit `data/cards/antm.json`; second run must be a zero-diff
- After the engine change lands, run ALL FOUR card-data gates (`ledger:heroes:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `roadmap:counts:check`) and regenerate any stale artifact in the same commit

## Required `// why:` Comments
- `heroKeywords.ts` union + array entries: cite D-24148, mandatory immediate two-branch semantics
- `heroAbility.setup.ts` pattern declaration + extraction step: 3-segment token unreachable by KEYWORD_PATTERN (D-24019 precedent); seeded-set gate keeps unseeded rewards hollow-detectable
- `heroEffects.execute.ts` ShuffleProvider narrowing: deterministic replay, established heroEffectDraw pattern
- `apply-hero-ability-markers.mjs` VALID_TOKEN_PATTERN line: D-24148, strict `[1-9]\d*` build gate

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — union + array (29 → 30)
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — pattern + seeded set + extraction step + effect-builder branch
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — handler + HANDLED_KEYWORDS + HERO_EFFECT_HANDLERS
- `packages/game-engine/src/rules/heroKeywords.test.ts` — **modified** — +1 registration describe
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — +4 parser tests (1 describe)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — +6 executor tests (1 describe)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 2 antm rows
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — VALID_TOKEN_PATTERN branch
- `data/cards/antm.json` — **modified** — regenerated (exactly 2 lines)
- `docs/ai/coverage/hero-mechanic-ledger.csv` — **modified** — regenerated
- Governance close (SPEC commit): `STATUS.md`, `DECISIONS.md` (D-24148 → Active), `WORK_INDEX.md`, `EC_INDEX.md` (EC-386 row), `05-ROADMAP-MINDMAP.md` (📝 → ✅ + counts), WP-356 body (baseline back-sync 1877/438→1903/444 + EC refs)

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 at **1914/447/0**
- [ ] All four card-data gates exit 0; apply-script re-run is a zero-diff
- [ ] `git diff origin/main -- packages/game-engine/src/rules/heroAbility.types.ts` is empty
- [ ] `git diff --name-only origin/main` matches the Files to Produce list exactly
- [ ] D-24026 live-verify recorded as operator-pending on deploy (a real match: Reprocess with a non-empty discard shows the shuffle log line + counts)
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24148 Active; `WORK_INDEX.md` checked off; `EC_INDEX.md` row added; mindmap node flipped + counts current

## Common Failure Smells
- Suite count lands 1914/444 → bare top-level `test()` calls; wrap in `describe()`
- Drift test fails on handler keys → `HANDLED_KEYWORDS` and `HERO_EFFECT_HANDLERS` edited separately
- Executor never fires in tests → keyword missing from `MVP_KEYWORDS` (check the HANDLED_KEYWORDS spread) or magnitude absent from the descriptor
- A verification grep trips on prose → a comment restated a policed literal; paraphrase it (grep-gate discipline)
