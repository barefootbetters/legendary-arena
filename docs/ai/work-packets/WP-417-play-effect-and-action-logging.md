# WP-417 — Every Played Card Prints Its Effect and the Action Taken

**User-Visible Surface:** play.legendary-arena.com (the Game Log panel + WP-322 export).
Every card play now prints (a) the card's printed effect as clean prose — with the
engine's machine effect-markers stripped — plus its base recruit/attack icons for
starters, and (b) the action the ability actually took (drew N cards, gained +N
attack/recruit, KO'd itself, and the realized result of a reveal branch). Answers the
field complaint that the log said only "played Keen Senses — Instinct: Draw a card.
draw:1." and never whether the draw happened.

## Goal

Close the remaining silent / leaky log paths on a card play:

1. **Strip engine effect-markers** from the printed-effect clause. The card pipeline's
   `apply-effect-markers` pass appends machine markers (`[keyword:draw:1]`,
   `[keyword:ko-wound-reward:attack:2]`) to the printed `abilities` lines; these leaked
   into the player-facing log as "Draw a card. draw:1." A printed keyword ("Undercover",
   "What If…?", "Danger Sense 2") is kept — the two are told apart by **shape**
   (all-lowercase kebab/`:` = marker; Title Case / punctuation = printed keyword).
2. **Print the base-icon economy on the play line** so a starter (S.H.I.E.L.D. Agent /
   Trooper — no ability text) states the `+1 recruit` / `+1 attack` it just added
   instead of nothing.
3. **Log the four previously-silent onPlay handlers** — draw (naming the realized
   amount, and naming a shortfall when the deck+discard ran dry), attack, recruit, and
   self-KO.
4. **Reveal realized results** (the deferred WP-B.2 slice of D-24111): when a matched
   reveal branch's action was guard-blocked (empty deck, missing turnEconomy), the line
   states it "could not be applied" instead of reporting the claimed success.

Message text only — no engine state/logic/RNG change; `G.messages` is hash-excluded
(D-24081) so this is replay-safe.

## Assumes

- The play line is emitted by `applyCardPlay` in
  `packages/game-engine/src/moves/coreMoves.impl.ts` via `formatPlayedCardLabel`;
  `heroAttack` / `heroRecruit` (the base card stats just added to `turnEconomy`) are in
  scope at that call. Baseline `origin/main` @ `5a885079`.
- `formatPlayedCardLabel` / `abilityTextToPlainText` / `formatCardRef` live in
  `packages/game-engine/src/log/logDisplay.ts` (WP-323/324); `abilityTextToPlainText`
  humanizes `[type:value]` tokens.
- The printed `abilities` lines carry both printed text and the pipeline's appended
  machine markers; every lowercase-kebab marker matches
  `^[a-z0-9]+(?:-[a-z0-9]+)*(?::…)*$` and every printed keyword does not (verified against
  the 41-set card corpus: markers `draw:1`, `attack-per-count:victory-bystanders:1`,
  `reveal-multi-take`, `demolish`; printed `Undercover`, `What If...?`, `Danger Sense 2`,
  `Artifact -`).
- `heroEffectDraw` / `heroEffectAttack` / `heroEffectRecruit` / `heroEffectKo` in
  `hero/heroEffects.execute.ts` are silent today; `drawFromPlayerDeck` returns `void`.
- `applyRevealRules` (WP-325) already emits one reveal-outcome line via
  `formatRevealOutcomeLine` (`hero/revealLog.ts`); `applyRevealRuleActions` returns `void`
  and knows per-action which mutated.
- `G.messages` is excluded from `finalStateHash` (D-24081); every push guards
  `Array.isArray(G.messages)`.

## Context (Read First)

- `packages/game-engine/src/log/logDisplay.ts` — `formatPlayedCardLabel`,
  `abilityTextToPlainText`, the token replacer.
- `packages/game-engine/src/moves/coreMoves.impl.ts` — `applyCardPlay` play line + the
  discard-to-play reject line; `playFromUndercover.ts` — the "from face-down" annotation
  line (both call `formatPlayedCardLabel`).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — the four silent handlers,
  `drawFromPlayerDeck`, `applyRevealRules` / `applyRevealRuleActions`.
- `packages/game-engine/src/hero/revealLog.ts` — the reveal-outcome composer.
- `docs/ai/DECISIONS.md` — D-24111 (reveal test-result logging; names WP-B.2 as the
  deferred realized-results slice), D-24081 (`G.messages` hash-excluded), D-24017 /
  D-24082 (observable-no-op + play/skip logging posture).
- `docs/ai/REFERENCE/00.6-code-style.md`.

**Why now:** WP-323/324/325 named every log line and closed the reveal test-result gap,
but a play still leaked the raw effect-marker into prose, said nothing for a starter, and
said nothing about what the draw/attack/recruit/KO handlers did. This is the direct
completion of that arc and answers a live field report (the Magneto match log).

## Scope (In)

- **`log/logDisplay.ts`:**
  - `isEngineEffectMarker(tokenValue): boolean` — the shape test (exported for the unit
    test).
  - `abilityTextToPlainText` — a `[keyword:…]` token whose value is an engine marker
    becomes a bare space (dropped), not a humanized word.
  - `formatBaseEconomyClause(attack, recruit): string` — `+N attack` / `+N recruit`
    joined, empty when the card prints neither.
  - `formatPlayedCardLabel(cardDisplayData, extId, economyClause)` — new third param
    inserts ` ({economyClause})` after the card ref; drops one trailing `.` from the
    printed-effect clause (the caller supplies terminal punctuation, so it would
    otherwise double).
- **`moves/coreMoves.impl.ts`** — pass `formatBaseEconomyClause(heroAttack, heroRecruit)`
  on the play line; pass `''` on the discard-to-play reject line (no economy granted).
- **`moves/playFromUndercover.ts`** — pass `''` on the annotation line (the base economy
  is already reported by `applyCardPlay`'s own line).
- **`hero/heroEffects.execute.ts`:**
  - `drawFromPlayerDeck` returns the realized draw count.
  - `heroEffectDraw` logs the realized amount and, when short, the deck+discard-empty
    shortfall.
  - `heroEffectAttack` / `heroEffectRecruit` log the grant.
  - `heroEffectKo` logs the self-KO.
  - `applyRevealRuleActions` returns the matched action kinds that did **not** apply;
    `applyRevealRules` threads them into the reveal-outcome line.
- **`hero/revealLog.ts`** — `describeUnappliedRevealActions(kinds): string` + an optional
  `unappliedActionsText` on `RevealOutcome`; `formatRevealOutcomeLine` appends
  "… but {X} could not be applied." when present.
- **Tests** — new/extended unit tests in `log/logDisplay.test.ts`,
  `hero/revealLog.test.ts`, and handler-log assertions in
  `hero/heroEffects.execute.test.ts`; re-record the `sentinel-core-doom-2p` fixture
  (starter play lines now carry the base-icon clause; **`finalStateHash` unchanged** —
  message oracle only).

## Out of Scope

- **The structured `outcome` field on log entries** (`G.messages` `string[]` → records) +
  colour-coding — the deep **WP-B.3** contract initiative (needs its own design review).
  Deferred; recorded per D-24111 / this WP's D-24237.
- **`move-card` / `sequence` empty-source no-op logging** — the remaining B.2 fill-in
  slivers beyond reveal realized results; low marginal value, deferred.
- **Replacing the client `effectProvenance` heuristic** — untouched.
- **Any gameplay behavior change** — economy, draw, KO, reveal predicate/action/offset are
  byte-identical; log text and one `void→number` / `void→kind[]` return-type change only.
- **Client / `apps/arena-client`** — renders `UIState.log` verbatim; untouched.
- **The already-logged outcomes** (condition-gate skip, rescue, count-scaled attack, hollow
  records, pending-choice parks) — unchanged.

## Files Expected to Change

| File | Action |
|------|--------|
| `packages/game-engine/src/log/logDisplay.ts` | **Modified** — `isEngineEffectMarker`, marker-drop, `formatBaseEconomyClause`, `formatPlayedCardLabel` third param + trailing-period trim |
| `packages/game-engine/src/log/logDisplay.test.ts` | **Modified** — marker-drop, shape-test, economy-clause, and label boundary tests |
| `packages/game-engine/src/moves/coreMoves.impl.ts` | **Modified** — play line economy clause; reject line `''` |
| `packages/game-engine/src/moves/playFromUndercover.ts` | **Modified** — annotation line `''` |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | **Modified** — realized-draw count + 4 handler log lines + reveal unapplied-action threading |
| `packages/game-engine/src/hero/heroEffects.execute.test.ts` | **Modified** — draw/attack/recruit/self-KO log assertions + draw-shortfall test |
| `packages/game-engine/src/hero/revealLog.ts` | **Modified** — `describeUnappliedRevealActions` + `unappliedActionsText` |
| `packages/game-engine/src/hero/revealLog.test.ts` | **Modified** — unapplied-action clause tests |
| `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` | **Modified** — re-recorded (message oracle only; `finalStateHash` unchanged) |
| `docs/05-ROADMAP-MINDMAP.md` | **Modified** — flip the WP-B.2 node `📦 → ✅` + `roadmap-counts --write` |
| `docs/ai/DECISIONS.md` | **Modified** — D-24237 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-417 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-452 row |

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new/modified file — no diffs or snippets.
- ESM only (explicit `.js` on relative imports, incl. `import type`); Node v22+.
- Human-style code per `00.6-code-style.md`; no `.reduce()`; explicit `if`/`for...of`.

**Packet-specific:**
- **Message text only.** No change to `G` economy/zone state, draw/KO/reveal behavior,
  RNG, or turn flow. The only deltas are authored log lines and the two return-type
  widenings that feed them (`drawFromPlayerDeck` → `number`, `applyRevealRuleActions` →
  `RevealActionKind[]`).
- **Determinism:** `G.messages` is hash-excluded (D-24081) — no replay-outcome change; the
  fixture is re-pinned by **regeneration** (`record-game-fixture.mjs`), never hand-edited,
  and its `finalStateHash` MUST be unchanged.
- **Marker vs printed keyword by shape, not allowlist** — an allowlist would silently keep
  leaking markers for mechanics that are not yet `HeroKeyword` members.
- **Guard the push:** `Array.isArray(G.messages)` before pushing.
- **Defensive naming:** every card resolves via `formatCardRef` (`?? extId` fallback).

**Locked contract values:**
- Marker shape: `^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)*$`.
- Play line: `Player {id} played {Name} ({ext-id})[ ({+A attack, +R recruit})][ — {effect}].`
- Draw: `Player {id} drew {N} card(s) from {ref}.` / `… drew {n} of {N} card(s) from {ref}
  — their deck and discard pile were empty.`
- Attack/recruit: `Player {id} gained +{N} attack|recruit from {ref}.`
- Self-KO: `Player {id} KO'd {ref} via its own ability.`
- Reveal unapplied: `… matched: {actions}, but {unapplied} could not be applied.`
- Reserved decision: **D-24237**.

## Vision Alignment

- **Vision clauses touched:** §14 (observability — the effect + action a player could not
  see), §11 (read-only projection). **Conflict assertion:** `No conflict.` **Non-Goal
  proximity:** none of NG-1..7 crossed. **Determinism:** `G.messages` hash-excluded
  (D-24081); replay-faithful (`finalStateHash` byte-identical; log text only).

## Acceptance Criteria

1. `isEngineEffectMarker` returns `true` for machine markers (`draw:1`,
   `ko-wound-reward:attack:2`, `reveal-multi-take`) and `false` for printed keywords
   (`Undercover`, `What If...?`, `Danger Sense 2`, `Artifact -`).
2. `abilityTextToPlainText` drops engine markers and keeps printed keywords + icons
   (e.g. `Draw a card. [keyword:draw:1]` → `Draw a card.`).
3. `formatBaseEconomyClause` renders only the icons the card prints; empty for `(0,0)`.
4. `formatPlayedCardLabel` inserts the economy clause after the ref, before the effect,
   and drops one trailing `.` from the effect clause (no `..` on the play line).
5. `heroEffectDraw` logs the realized count and a distinct shortfall line when the deck +
   discard are empty; `heroEffectAttack` / `heroEffectRecruit` / `heroEffectKo` each log
   their grant / removal.
6. A matched reveal branch whose action was guard-blocked appends "… could not be
   applied." (asserted); a fully-applied branch does not.
7. The `sentinel-core-doom-2p` fixture is re-recorded with the base-icon clause on starter
   plays and an **unchanged `finalStateHash`**.
8. `pnpm --filter @legendary-arena/game-engine test` green; `pnpm -r --no-bail test` green
   repo-wide; `pnpm -r build` clean.
9. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
pnpm -r build                                       # succeeds
pnpm --filter @legendary-arena/game-engine test     # 0 fail
pnpm -r --no-bail test                              # 0 fail repo-wide
git diff --numstat -- packages/lagn-spec/schemas/lagn-v1.json   # empty (no schema drift)
git diff --name-only                                # only ## Files Expected to Change
```

## Definition of Done

- [x] All acceptance criteria pass
- [x] `pnpm --filter @legendary-arena/game-engine test` green; `pnpm -r build` clean;
      whole-repo `--no-bail` test green (0 fail; server DB-gated tests skip)
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):** after
      merge + deploy, a match's log shows the printed effect (markers stripped), the
      base-icon clause on a starter play, and the draw/attack/recruit/KO action lines;
      STATUS.md records the test evidence until then.
- [x] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24237 Active; `WORK_INDEX.md` WP-417
      `[x]`; `EC_INDEX.md` EC-452 Done
- [x] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All sections present; Out of Scope ≥2 exclusions; single layer (game-engine) |
| 2 | ✅ PASS | Engine-wide + packet-specific + locked values present |
| 3 | ✅ PASS | §Assumes: the play line, marker shape, silent handlers, hash-exclusion, baseline @ 5a885079 |
| 4 | ✅ PASS | §Context cites the log helpers, handlers, reveal composer, D-entries |
| 5 | ✅ PASS | §Files lists the log helper + moves + handlers + reveal + fixture + governance |
| 6 | ✅ PASS | Canonical `cardDisplayData` / `CardExtId`; marker shape verified against the corpus |
| 7 | ✅ N/A | No new npm dependency |
| 8 | ✅ PASS | Engine-internal; `logDisplay.ts` / `revealLog.ts` pure (no boardgame.io); no layer crossing |
| 9 | ✅ N/A | No shell scripts introduced |
| 10 | ✅ N/A | No environment variables |
| 11 | ✅ N/A | No authentication surface |
| 12 | ✅ PASS | `node:test`; pure helpers unit-tested; fixture re-pinned by regeneration (hash unchanged) |
| 13 | ✅ PASS | Verification uses `pnpm --filter` / `-r --no-bail`; + schema-drift + `git diff --name-only` |
| 14 | ✅ PASS | 9 binary, observable, function/line-specific acceptance criteria |
| 15 | ✅ PASS | DoD includes STATUS/DECISIONS/WORK_INDEX + scope check; User-Visible Surface + live D-24026 item |
| 16 | ✅ PASS | Explicit control flow (no `.reduce()`); descriptive names; JSDoc + `// why:` |
| 17 | ✅ PASS | `## Vision Alignment` — §14/§11; no conflict; determinism (hash-excluded) |
| 18 | ✅ N/A | Verification greps `git diff --name-only`, not forbidden tokens |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface — engine log text |
| 21 | ✅ N/A | No HTTP endpoint / `apps/server` library function — game-engine only |

**Verdict: 21/21 resolved (13 PASS, 8 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Single layer (game-engine). Everything needed is in scope at each
site (`heroAttack`/`heroRecruit` at the play line; the peeked card + per-action applied
flags in the reveal loop). The new work is pure describers + log lines + two return-type
widenings that carry no behavior; economy/draw/KO/reveal behavior is byte-identical
(hash-safe, D-24081). Marker-vs-keyword is decided by a corpus-verified shape test, not a
brittle allowlist. This completes the WP-323/324/325 log-enrichment arc and the deferred
WP-B.2 reveal realized-results slice.

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (engine-internal, pure helpers), no monetization/identity/RNG/
multiplayer-sync, no new contract, no engine-state or `finalStateHash` impact (log text
only, hash-excluded; fixture re-recorded with an unchanged hash). Scope bounded; the
structured-outcome contract (B.3) and the remaining move-card/sequence no-op slivers are
explicitly deferred. No BLOCK modes.
