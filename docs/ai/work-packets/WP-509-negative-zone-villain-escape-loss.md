# WP-509 — Negative Zone Prison Breakout Villain-Escape Loss + Retire the Generic ESCAPE_LIMIT Proxy (Game Engine)

**Layer:** Game Engine · **Lane:** Standard two-session (removes an
`evaluateEndgame` loss branch — outcome/determinism surface; lightweight-lane
ineligible per 01.0a #6/#8) · **Baseline:** `origin/main` @ `1b5dd42e`
(WP-508 merged) · **User-Visible Surface:** play.legendary-arena.com

## Goal

Negative Zone Prison Breakout's printed **Evil Wins** — *"If 12 Villains
escape"* — is not modeled: the scheme rides the twist-count doom-clock proxy
(D-24178), and a **generic** `escapedVillains >= ESCAPE_LIMIT (8)` loss in
`evaluateEndgame` ends **every** match at 8 escaped adversaries — an MVP proxy
that both fires before Negative Zone's real 12 and is simply wrong for every
scheme whose Evil-Wins is not villain-escape-count. This WP wires Negative Zone
to the WP-508 escaped-pile resource-loss framework counting **villains only**
(`{ kind: 'escaped-pile-count', cardType: 'villain', threshold: 12 }`), and
**retires the generic `ESCAPE_LIMIT` loss** from `evaluateEndgame` so
villain-escape losses are per-scheme. After it lands, only a scheme that declares
a villain-escape condition loses on escapes — Negative Zone at 12; the
`ESCAPED_VILLAINS` counter is retained for stats and the co-op loss-cause
breakdown.

## User-Visible Impact

On `play.legendary-arena.com`, a Negative Zone Prison Breakout match ends for
evil when **12 Villains have escaped** the city — not at the eighth twist, and
not at the old generic 8-escape cap. Other schemes no longer end merely because
8 adversaries escaped (that was never their printed Evil-Wins); their real loss
conditions govern.

## Assumes

- **WP-508 / D-24314 + D-24315 (✅ merged, `1b5dd42e`).** This WP reuses the
  framework WP-508 shipped **as-is**: `SchemeTwistConfig.resourceLossCondition`
  with kind `'escaped-pile-count'`, `countEscapedPileByType` +
  `applyEscapedPileResourceLoss` (called at the end of the escape branch of
  `villainDeck.reveal.ts`), and the twist-proxy suppression keyed on
  `resourceLossCondition != null`. **No new condition kind, no change to
  `schemeResourceLoss.ts` or `schemeTwistConfig.types.ts`.**
- **Escaped villains are classified `'villain'`.** `villainDeck.setup.ts` types
  every villain-deck villain as `'villain'` in `G.villainDeckCardTypes`; the
  escaped villain card is pushed to `G.escapedPile` (WP-153). So
  `countEscapedPileByType(G, 'villain')` counts exactly the escaped villains —
  henchmen (typed `'henchman'`) and carried bystanders (typed `'bystander'`) are
  excluded.
- **Rulebook — villains only.** Universal Rules v23 §"Schemes that Count Escaped
  Villains" (`docs/legendary-universal-rules-v23.md`): *"These count only the
  Villain cards currently in the Escape Pile."* Henchmen are **not** counted.
  Counting the escaped **pile by `'villain'` type** is the faithful model;
  reading the `ESCAPED_VILLAINS` counter (which increments per escaped
  adversary, villain **or** henchman — `villainDeck.reveal.ts`) would wrongly
  include henchmen and is **not** used for the loss condition.
- **`ESCAPE_LIMIT = 8`** (`endgame/endgame.types.ts`) — the MVP escape cap this
  WP retires as a *game-loss* trigger. The constant is **retained** (still a
  `coopOutcome.ts` heuristic threshold and a `sweep.analyze.ts` diagnostic);
  only its use in `evaluateEndgame` is removed.
- **`evaluateEndgame`** stays **counter-only**; removing its escape branch does
  not change that invariant.

## Context (Read First)

**Why the generic escape loss must go.** It fires for every scheme at 8 escaped
adversaries. For Negative Zone it preempts the real 12; for bystander/deck-loss
schemes it is unrelated to their Evil-Wins. The source comment already flags it
MVP: *"becomes part of MatchSetupConfig in a later packet when scheme-specific
limits are implemented."* This is that packet. There is no way for Negative Zone
to reach 12 while the generic 8 stands, so removal is required, not optional.

**`coopOutcome` keeps its category — the branch stays, the comment is corrected.**
`classifyCoopOutcome` (`simulation/coopOutcome.ts`) labels a co-op loss's *cause*
for the WP-452 balance breakdown; for a `scheme-wins` loss it returns
`'loss-villains-escaped'` when `record.escapedVillains >= ESCAPE_LIMIT`, else
`'loss-scheme-completed'`. Today its comment claims a **load-bearing invariant**:
"at a scheme-wins terminal `escapedVillains >= ESCAPE_LIMIT` iff escape-overrun
was the trigger, because `evaluateEndgame` ends on the first condition." After
this WP that invariant is **false** — escape-overrun is no longer a distinct
`evaluateEndgame` condition; a Negative Zone loss arrives via `SCHEME_LOSS`. But
the classifier still labels correctly: a Negative Zone loss carries
`escapedVillains >= 12 >= ESCAPE_LIMIT`, so it still resolves to
`'loss-villains-escaped'`. The branch and the category are **kept**; only the
comment is rewritten to describe the check as a **loss-cause heuristic** (a
scheme-wins loss with a high escaped-villain count is almost certainly
escape-driven), no longer tied to a removed engine condition. The pre-existing
"same-turn double-trip" approximation the comment already accepted is unchanged
in spirit. **`CoopGameRecord` is not enriched and `COOP_OUTCOME_CATEGORIES` is
not changed** — no dead category, no closed-set churn.

**Determinism.** No `G` shape change, no new counter. `evaluateEndgame` is a pure
read of `G.counters` and is **not** part of the hashed state, so removing its
escape branch does not move `finalStateHash` / `PRE_WP080_HASH`. It CAN change a
match *outcome* — a game that previously lost at 8 escaped villains now continues
— so any committed replay/sentinel/simulation fixture whose result depended on
the 8-escape loss must be re-checked at execution (`sim:runtime-observed:check` +
the fixture replay suite). The WP-508 engine-runner Midtown scenario is
unaffected (it wins with 0 escapes; verified post-WP-508). **STOP on any hash
drift, never blind-re-pin** (`reference_hashed_g_field_dual_repin`).

## Design Rationale

**Reuse `escaped-pile-count`, do not add a kind.** Negative Zone counts a card
type in the escaped pile — exactly WP-508's `'escaped-pile-count'` with
`cardType: 'villain'`. This is villains-only by construction (henchmen/bystanders
carry other types), which is both the faithful reading and simpler than a new
counter-reading kind. `applyEscapedPileResourceLoss` already runs at the end of
every escape branch, so adding the config row is all the engine needs.

**Retire, don't reparameterize, the evaluator branch.** Making `evaluateEndgame`
read a per-scheme escape limit would break its counter-only invariant; the
escape-loss decision already lives in the escape path (the WP-508 resource
check), so the evaluator's branch is simply deleted.

## Scope (In)

- `packages/game-engine/src/rules/schemeTwistConfigs.ts`: add
  `resourceLossCondition: { kind: 'escaped-pile-count', cardType: 'villain',
  threshold: 12 }` to `core/negative-zone-prison-breakout` (its `lossThreshold:
  8` stays but is inert for loss — proxy suppressed); update its comment.
- `packages/game-engine/src/endgame/endgame.evaluate.ts`: remove the
  `escapedVillainCount >= ESCAPE_LIMIT` branch, the now-unused
  `escapedVillainCount` local, and the `ESCAPE_LIMIT` import. Other branches
  (matchEndedEarly, schemeLoss, mastermindDefeated, finalTurnTie) and their order
  are untouched.
- `packages/game-engine/src/simulation/coopOutcome.ts`: rewrite the stale
  "load-bearing invariant" comment on the `escapedVillains >= ESCAPE_LIMIT`
  branch to describe it as a loss-cause heuristic (escape-overrun is no longer a
  distinct `evaluateEndgame` condition; a high escaped-villain count at a
  scheme-wins terminal indicates an escape-driven loss such as Negative Zone).
  **Keep** the branch, the `ESCAPE_LIMIT` import, and the `'loss-villains-escaped'`
  category.
- Tests:
  - `rules/schemeResourceLoss.test.ts`: an `'escaped-pile-count'` with `cardType:
    'villain'` fires at the threshold and not below; a mixed escaped pile counts
    villains only (henchmen + bystanders excluded).
  - `rules/schemeHandlers.test.ts`: replace the current "Negative Zone runs its
    full 8-twist stack" test — Negative Zone now **suppresses** the twist proxy
    (it declares a `resourceLossCondition`), matching Midtown.
  - `endgame/endgame.evaluate.test.ts`: replace the "scheme-wins when
    escapedVillains >= ESCAPE_LIMIT" test — escapes alone no longer end the game
    (returns `null`); drop the now-inert `ESCAPED_VILLAINS: ESCAPE_LIMIT` line
    from the MATCH_ENDED_EARLY-priority test.

## Out of Scope

- Any new `resourceLossCondition` kind; `schemeResourceLoss.ts` and
  `schemeTwistConfig.types.ts` are **not** touched (reuse `escaped-pile-count`).
- `simulation/coopWinRate.ts` (`CoopGameRecord` is **not** enriched) and
  `COOP_OUTCOME_CATEGORIES` (the `'loss-villains-escaped'` category is **kept**).
- `simulation/sweep.analyze.ts` — its `escaped-villain-cap` classification is a
  read-only diagnostic over the retained `ESCAPED_VILLAINS` counter; it does not
  decide a loss and needs no change.
- Removing the `ESCAPE_LIMIT` constant or its `index.ts` export (retained for
  `coopOutcome.ts` + `sweep.analyze.ts`).
- Stack-depletion (Legacy Virus, Civil War — WP-510) and conversion schemes
  (Secret Invasion, Killbots — WP-511). Any new `G` field; card-data changes.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/schemeTwistConfigs.ts` | Negative Zone `resourceLossCondition` (escaped-pile-count, villain, 12) |
| `packages/game-engine/src/endgame/endgame.evaluate.ts` | remove the `escapedVillains >= ESCAPE_LIMIT` loss branch + unused local + import |
| `packages/game-engine/src/simulation/coopOutcome.ts` | reword the stale invariant comment → loss-cause heuristic (branch kept) |
| `packages/game-engine/src/rules/schemeResourceLoss.test.ts` | villain escaped-pile-count threshold / villains-only tests |
| `packages/game-engine/src/rules/schemeHandlers.test.ts` | Negative Zone proxy-suppressed (replaces the 8-twist-stack test) |
| `packages/game-engine/src/endgame/endgame.evaluate.test.ts` | escapes alone no longer end the game; drop inert escape line |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24316 + D-24317 Active at execution), `NUMBER-LEDGER.md`
(reserved), `STATUS.md`.

## Non-Negotiable Constraints

- Villains only: the loss counts `'villain'`-typed escaped-pile entries — never
  the `ESCAPED_VILLAINS` counter (which includes henchmen).
- `evaluateEndgame` stays **counter-only**; the escape-loss decision lives in the
  escape path (WP-508), never re-reads config in the evaluator.
- The `ESCAPED_VILLAINS` counter keeps incrementing per escaped adversary
  (unchanged); only its role as a *loss trigger* is removed.
- `coopOutcome`'s `'loss-villains-escaped'` category and its
  `escapedVillains >= ESCAPE_LIMIT` heuristic branch are **kept** (comment
  corrected); no `COOP_OUTCOME_CATEGORIES` / `CoopGameRecord` change.
- No new `resourceLossCondition` kind, no new `G` field, no `.reduce()`, no
  `ctx.random.*`; no `boardgame.io`/registry import added.
- Determinism: sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical (no
  `G` shape change); any drift STOPs execution. Outcome changes (matches that
  previously hit the 8-escape proxy) are expected only in outcome/simulation
  fixtures, never in the state hashes.

**Engine-wide (standing) constraints.** Honor `.claude/rules/code-style.md` +
`docs/ai/REFERENCE/00.6-code-style.md` (human-style, JSDoc, `// why:` on the
villain-only choice and the evaluator-branch removal); ESM-only, `.test.ts` on
`node:test`, Node v22+. Work from full file contents.

## Contract

**Negative Zone** — `resourceLossCondition: { kind: 'escaped-pile-count',
cardType: 'villain', threshold: 12 }`; loses when `G.escapedPile` holds ≥ 12
`'villain'`-typed entries; the twist-count proxy is suppressed.

**`evaluateEndgame`** — no longer returns `scheme-wins` for
`escapedVillains >= ESCAPE_LIMIT`; escape losses arrive via `SCHEME_LOSS`.

**`classifyCoopOutcome`** — unchanged behavior; `escapedVillains >= ESCAPE_LIMIT`
→ `'loss-villains-escaped'` is retained as a documented loss-cause heuristic.

## Vision Alignment

§3 (faithful Legendary rules) — models a printed Evil-Wins (villains only, per
the rulebook) and removes an unfaithful global proxy. NG-1..7 not crossed.
**Determinism preserved (§8/§22):** no `G` shape change, no RNG/wall-clock/IO;
`evaluateEndgame` is a pure counter read outside the hashed state, so hashes are
byte-identical; outcome changes are confined to matches that previously hit the
8-escape proxy.

## Funding Surface Gate

N/A — no pricing/checkout/account surface.

## API Catalog Update

N/A — no `apps/server` endpoint or `Library-only` export change (`ESCAPE_LIMIT`
export retained).

## Acceptance Criteria

1. `countEscapedPileByType(G, 'villain')` counts only `'villain'`-typed
   escaped-pile entries; a mixed pile (villains + henchmen + bystanders) counts
   villains only.
2. Negative Zone (config escaped-pile-count / villain / 12) latches
   `SCHEME_LOSS` when the escaped pile holds ≥ 12 villains, not at 8, and not on
   the twist count (proxy suppressed — verified via `schemeTwistHandler`).
3. `evaluateEndgame` returns `null` for a state with `escapedVillains = 8` (or
   `ESCAPE_LIMIT`) and no other ending condition; still `scheme-wins` when
   `SCHEME_LOSS >= 1`.
4. `classifyCoopOutcome` still returns `'loss-villains-escaped'` for a
   scheme-wins record with `escapedVillains >= ESCAPE_LIMIT` (heuristic retained).
5. Midtown (`escaped-pile-count` / bystander) behavior from WP-508 is unchanged.
6. Determinism: full engine suite green; sentinel `finalStateHash` +
   `PRE_WP080_HASH` byte-identical; any drift STOPs.
7. `ESCAPED_VILLAINS` counter still increments per escape; `sweep.analyze.ts`
   diagnostics unaffected.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → green; record delta.
3. **Whole-workspace** `pnpm -r --no-bail test` → green (the WP-508 lesson: an
   engine change with cross-package consumers must run the full workspace, not
   just the engine package).
4. Control check: revert the Negative Zone config row → the AC-2 assertions FAIL
   (non-vacuous); restore.
5. Sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged; `pnpm
   sim:runtime-observed:check` current.
6. `pnpm -r build` → 0; `git diff --name-only` = the six-file allowlist +
   governance.
7. **D-24026 live-verify (operator-pending):** on play.legendary-arena.com, a
   Negative Zone match continues past 8 escaped villains and ends `scheme-wins`
   at 12.

## Definition of Done

- [ ] All Acceptance Criteria met; engine suite + whole-workspace green.
- [ ] Sentinel + PRE_WP080 hashes byte-identical (or drift diagnosed +
      documented — not expected).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] D-24316 + D-24317 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap
      `📝`→`✅`; `roadmap:counts:check` 0; STATUS close-out.
- [ ] Two-commit topology (EC-544 impl + SPEC close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decisions (land at execution)

**D-24316** — Negative Zone Prison Breakout loses via
`SchemeTwistConfig.resourceLossCondition` `{ kind: 'escaped-pile-count',
cardType: 'villain', threshold: 12 }` (reusing the WP-508 kind), counting
`'villain'`-typed entries in `G.escapedPile` — **villains only**, per Universal
Rules v23 §"Schemes that Count Escaped Villains" (henchmen excluded). The
twist-count proxy is suppressed for Negative Zone.

**D-24317** — The generic `escapedVillains >= ESCAPE_LIMIT` loss is removed from
`evaluateEndgame`; villain-escape losses are per-scheme via `'escaped-pile-count'`
(villain). The `ESCAPED_VILLAINS` counter and the `ESCAPE_LIMIT` constant are
retained (counter still increments; `ESCAPE_LIMIT` remains the `coopOutcome.ts`
loss-cause heuristic threshold and a `sweep.analyze.ts` diagnostic). `coopOutcome`
keeps its `'loss-villains-escaped'` category and its `escapedVillains >=
ESCAPE_LIMIT` branch as a documented heuristic (Negative Zone losses carry
escapedVillains ≥ 12 ≥ 8, so the label stays correct); `evaluateEndgame` stays
counter-only.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS. **§2 Non-Negotiable Constraints** — PASS.
- **§3 Assumes** — PASS (WP-508 merged; villains-only rulebook citation corrected).
- **§4 Context** — PASS (proxy retirement, coopOutcome heuristic reframe, determinism).
- **§5 Files Expected to Change** — PASS (closed six-file allowlist + governance).
- **§6 Naming Consistency** — PASS (`ESCAPED_VILLAINS`, `ESCAPE_LIMIT`, `SCHEME_LOSS`, `resourceLossCondition`, `escaped-pile-count`).
- **§7 Dependency Discipline** — PASS (WP-508 ✅ on main).
- **§8 Architectural Boundaries** — PASS (game-engine only; evaluateEndgame counter-only preserved; no `.reduce()`).
- **§9–§11** — N/A (no shell/env/auth surface).
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-revert; villains-only mixed-pile assertion).
- **§13 Commands & Verification** — PASS (whole-workspace test mandated).
- **§14 Acceptance Criteria** — PASS (7 testable ACs).
- **§15 Definition of Done** — PASS (binary gates + two-commit topology).
- **§16 Code Style** — PASS. **§17 Vision Alignment** — PASS (§3; determinism line).
- **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — PASS (baseline `1b5dd42e` cited).
- **§20 Funding Surface** — N/A. **§21 API Catalog** — N/A (export retained).

Pre-flight verdict: READY (RS-1 folded — `endgame.evaluate.test.ts` had four
escape touch-points, not two; the endedEarly-marker loop and the vacuous
JSON.stringify block were corrected). Copilot verdict: PASS (NIT #1 folded — the
`coopOutcome.ts` `classifyCoopOutcome` JSDoc parenthetical reworded
"escape overrun" → "escape-driven heuristic").
