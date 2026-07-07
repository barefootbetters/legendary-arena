# WP-323 — Game Log Name Enrichment: Card Plays + Mastermind Tactics

**User-Visible Surface:** play.legendary-arena.com (the in-match Game Log panel)
and the exported/saved log (WP-322). The two most jarring log lines gain display
names: a **card play** reads `played {Name} ({ext-id}) — {plain-text effect}`, and
a **mastermind fight** reads `fought {Mastermind} and defeated the tactic
"{Tactic}"` instead of raw ids and a generic "a tactic". Introduces two reusable
pure helpers (`resolveCardName`, `abilityTextToPlainText`) that WP-324 reuses to
name the remaining log sites.

## Goal

Enrich three engine log lines with display names resolved from `G.cardDisplayData`
(already in scope in moves), and — for card plays — append the card's ext-id and
its printed effect in plain text. Add a new pure module `src/log/logDisplay.ts`
with `resolveCardName(cardDisplayData, extId)`, `abilityTextToPlainText(abilityText)`,
and `formatPlayedCardLabel(cardDisplayData, extId)`. No engine state/logic change —
only the authored message strings change.

## Assumes

- `G.cardDisplayData: Readonly<Record<CardExtId, UICardDisplay>>` is populated at
  setup by `buildCardDisplayData` and is in scope in moves. `UICardDisplay` carries
  `name: string` and optional `abilityText?: string` (WP-315). Baseline
  `origin/main` @ `d00f3613`.
- `fightMastermind.ts` already resolves the mastermind name via
  `G.cardDisplayData?.[G.mastermind.baseCardId]?.name` (line ~148, notableEvent
  narrative) and captures the defeated tactic's ext-id at line ~83
  (`const defeatedTacticId = G.mastermind.tacticsDeck[0]!`).
- The canonical defensive resolution pattern is `cardDisplayData?.[extId]?.name ?? extId`
  (`fightVillain.ts:198`).
- `G.messages` is **excluded from `finalStateHash`** (D-24081) and from replay
  determinism — enriching message text does not change replay outcome. The replay
  **message oracle** (`fixtureSchema.ts:71`, `replayFixtures.test.ts`) does compare
  message text and must be re-pinned; `scripts/record-game-fixture.mjs` regenerates
  fixtures.
- `vue-tsc` is N/A (engine); `pnpm --filter @legendary-arena/game-engine test` and
  `pnpm -r build` pass on baseline.

## Context (Read First)

- `apps/arena-client` game log (WP-318/321/322) — the consumer surface; the log is
  now a HUD panel + a copy/save export (WP-322), so readability matters on both.
- `packages/game-engine/src/moves/coreMoves.impl.ts` (~155), `playFromUndercover.ts`
  (~121), `fightMastermind.ts` (~83, ~88, ~148) — the three sites to enrich.
- `packages/game-engine/src/moves/fightVillain.ts` (~198) — the canonical
  `cardDisplayData?.[extId]?.name ?? extId` resolution pattern to mirror.
- `packages/game-engine/src/setup/buildCardDisplayData.ts` — where `name` /
  `abilityText` come from (do not change its shape).
- `packages/game-engine/src/test/fixtures/fixtureSchema.ts` (~71),
  `replayFixtures.test.ts`, `scripts/record-game-fixture.mjs` — the message-oracle
  re-pin path.
- `docs/ai/DECISIONS.md` — scan D-24081 (`G.messages` hash-excluded), D-20002 (log
  authorship / chronological), WP-315 (`abilityText` on `UICardDisplay`).
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code; `.reduce()` bans;
  `for...of` in effect/zone code.

**Why now:** a real match log (Magneto, 2026-07-07) showed the two worst cases:
`played wtif/star-lord-tchalla/interstellar-adventures#0` (raw id, no effect) and
four identical `fought mastermind "core/magneto" and defeated a tactic` lines. The
engine already carries every name/effect needed; this is a string-authoring change.

## Scope (In)

- **`src/log/logDisplay.ts`** (new, pure — no `boardgame.io` import):
  - `resolveCardName(cardDisplayData, extId): string` — `cardDisplayData?.[extId]?.name ?? extId`.
  - `abilityTextToPlainText(abilityText: string | undefined): string` — converts the
    markup tokens `[icon:X]`, `[keyword:X]`, `[hc:X]` (and any `[type:value]`) to
    readable words and collapses all whitespace/newlines to single spaces (a log
    line is single-line); empty/undefined → `''`. Best-effort readability transform.
  - `formatPlayedCardLabel(cardDisplayData, extId): string` — `{Name} ({extId})`,
    plus ` — {plain effect}` when `abilityText` is present and non-empty (starters
    have none → no suffix).
- **`coreMoves.impl.ts` (~155)** — `played ${cardId}.` → `played ${formatPlayedCardLabel(...)}.`.
- **`playFromUndercover.ts` (~121)** — same label + ` from face-down`.
- **`fightMastermind.ts` (~88)** — `fought mastermind "${G.mastermind.id}" and defeated a tactic.`
  → `fought ${resolveCardName(G.cardDisplayData, G.mastermind.baseCardId)} and defeated
  the tactic "${resolveCardName(G.cardDisplayData, defeatedTacticId)}".`
- **Tests** — `src/log/logDisplay.test.ts` (helper boundaries: each token family,
  multi-token, newline collapse, no-markup, undefined, name fallback); update the
  existing move tests that assert these three lines; re-pin the replay fixture
  message oracle via `record-game-fixture.mjs`.

## Out of Scope

- **The other ~37 `G.messages.push` sites** (recruit, fight-villain, villain-deck
  reveals/captures, empower/grant lines, dodge, undercover) — **WP-324** applies the
  same two helpers there. This WP builds the machinery + the two cited cases only.
- **Effect OUTCOME logging** — whether a played card's effect actually fired, the
  "What If…?" test result, or the realized grant. That is the silent-hero-effect gap
  (WP-294/295 arc) and a **separate WP-B**; this WP prints the *printed* effect only.
- **Any change to `G.cardDisplayData` shape / `buildCardDisplayData`**, to engine
  state, move logic, RNG, or turn flow. Message text only.
- **Any client change** — `apps/arena-client` renders `UIState.log` verbatim
  (WP-318/321/322) and is untouched.
- **`notableEvents` narratives** — already named; not re-authored here.

## Files Expected to Change

| File | Action |
|------|--------|
| `packages/game-engine/src/log/logDisplay.ts` | **New** — `resolveCardName`, `abilityTextToPlainText`, `formatPlayedCardLabel` (pure) |
| `packages/game-engine/src/log/logDisplay.test.ts` | **New** — helper boundary tests |
| `packages/game-engine/src/moves/coreMoves.impl.ts` | **Modified** — card-play line uses `formatPlayedCardLabel` |
| `packages/game-engine/src/moves/playFromUndercover.ts` | **Modified** — face-down play line uses the label |
| `packages/game-engine/src/moves/fightMastermind.ts` | **Modified** — mastermind + tactic names |
| `packages/game-engine/src/moves/coreMoves.integration.test.ts` | **Modified** — re-pin the enriched play line (scaffold-confirmed: the only unit test asserting a changed line) |
| `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` | **Modified** — re-pin the `messages` oracle via `record-game-fixture.mjs --input` (messages-only diff; hash/meta/seed unchanged) |
| `docs/ai/DECISIONS.md` | **Modified** — D-24109 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-323 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-353 row |

No other files may be modified. Exact test/fixture file names are confirmed by the
scaffold run (below) and folded into this allowlist before execution completes.

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new/modified file — no diffs or snippets.
- ESM only; Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — explicit control
  flow, descriptive names, JSDoc on every function, `// why:` on non-obvious code.
  No `.reduce()` in the converter; use `for...of` / explicit `.replace` steps.

**Packet-specific:**
- **Message text only.** No change to `G` state, move logic, RNG, turn flow, or
  `G.cardDisplayData` shape. The only behavioral delta is the authored string.
- **Determinism:** `G.messages` is hash-excluded (D-24081) and not part of replay
  determinism, so this does not change any replay outcome; but the replay **message
  oracle** must be re-pinned (regenerate, do not hand-edit divergent lines).
- **Pure helpers:** `logDisplay.ts` imports **no `boardgame.io`** and performs no
  I/O; it takes `cardDisplayData` + `extId` as arguments (no `G` reach-through).
- **Single-line output:** `abilityTextToPlainText` collapses every run of
  whitespace/newline to a single space and trims, so no effect suffix can break the
  one-entry-per-line log.
- **Defensive resolution:** an absent `cardDisplayData` entry falls back to the raw
  ext-id (`?? extId`) — never throws, never emits `undefined`.
- Do NOT touch `apps/arena-client`, `notableEvents`, or the other ~37 push sites.

**Session protocol:** if any scope/format/fixture question is ambiguous, STOP and
ask — do not guess or widen scope.

**Locked contract values:**
- Card-play label: `{Name} ({extId})` + ` — {plain effect}` iff `abilityText` present.
- Mastermind line: `fought {Mastermind} and defeated the tactic "{Tactic}".`
- `abilityTextToPlainText`: `[type:value]` → space-padded humanized `value` (hero
  classes title-cased; hyphens → spaces), then whitespace-collapse + trim +
  tidy spaces before `.,;:`; empty/undefined → `''`.
- Name fallback: `cardDisplayData?.[extId]?.name ?? extId`.
- Reserved decision: **D-24109**.

## Vision Alignment

- **Vision clauses touched:** §14 (observability — a readable, self-describing log),
  §11 (UI consumes read-only projections). **Conflict assertion:** `No conflict.`
  The engine authors a richer human-readable string over data it already holds; no
  clause weakened. **Non-Goal proximity:** none of NG-1..7 crossed. **Determinism:**
  `G.messages` is hash-excluded (D-24081) and not part of replay state — the change
  is replay-faithful (same outcomes; only message text differs).

## Acceptance Criteria

1. `resolveCardName(cardDisplayData, extId)` returns the display name when present
   and the raw `extId` when absent (asserted, both branches).
2. `abilityTextToPlainText('[keyword:What If...?]: You get +3[icon:recruit].')`
   returns `What If...?: You get +3 recruit.` (asserted); a `\n`-containing ability
   collapses to a single line; `undefined` → `''`.
3. `formatPlayedCardLabel` returns `{Name} ({extId})` for a starter (no ability) and
   `{Name} ({extId}) — {plain effect}` for a card with `abilityText` (asserted).
4. The card-play log line reads `Player 0 played Interstellar Adventures
   (wtif/star-lord-tchalla/interstellar-adventures#0) — What If...?: You get +3
   recruit.` for that card (asserted in the move test).
5. The mastermind line reads `Player 0 fought Magneto and defeated the tactic
   "{Tactic}".` — mastermind id resolved to name, tactic named (asserted).
6. No engine state / move-logic change: the only diff at each move site is the
   message string; existing non-message assertions in the touched move tests pass
   unchanged.
7. `pnpm --filter @legendary-arena/game-engine test` green (helper tests + re-pinned
   move tests + re-pinned fixture oracle); `pnpm -r build` clean.
8. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine test    # 0 fail (incl. re-pinned fixtures)
pnpm -r build                                       # succeeds
# spot-check the enriched lines exist:
git -C . grep -n "defeated the tactic" packages/game-engine/src/moves/fightMastermind.ts
git diff --name-only                                # only ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/game-engine test` green; `pnpm -r build` clean
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):**
      after merge + deploy, a live match's Game Log shows `played {Name} ({ext-id}) —
      {effect}` and `fought {Mastermind} and defeated the tactic "{Tactic}"`; until
      then STATUS.md records the test evidence.
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24109 Active; `WORK_INDEX.md`
      WP-323 `[x]`; `EC_INDEX.md` EC-353 Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All required sections present; Out of Scope lists ≥2 exclusions; single layer (game-engine) |
| 2 | ✅ PASS | Engine-wide (full files/ESM/Node22/00.6) + packet-specific + session protocol + locked values present |
| 3 | ✅ PASS | §Assumes cites cardDisplayData/WP-315, the fightMastermind precedent lines, the fixture oracle + regen path, baseline @ d00f3613 |
| 4 | ✅ PASS | §Context (Read First) cites specific files + line ranges + D-entries |
| 5 | ✅ PASS | §Files lists helper + 3 moves + tests + fixtures + governance, each with an action; scaffold confirms exact test/fixture names |
| 6 | ✅ PASS | Canonical names: `cardDisplayData`, `abilityText`, `baseCardId`, `CardExtId`; no 00.2 field renamed |
| 7 | ✅ N/A | No new npm dependency |
| 8 | ✅ PASS | Engine-internal; pure helper imports no boardgame.io; no layer crossing (no registry/server/client import added) |
| 9 | ✅ N/A | No shell scripts introduced (Verification uses pnpm on pwsh) |
| 10 | ✅ N/A | No environment variables |
| 11 | ✅ N/A | No authentication surface |
| 12 | ✅ PASS | `node:test`; helper is pure (no boardgame.io import), no network/DB; boundary assertions on token conversion + name fallback; fixture oracle re-pinned deterministically |
| 13 | ✅ PASS | Verification uses `pnpm --filter`; exact commands + expected output + `git diff --name-only` |
| 14 | ✅ PASS | 8 binary, observable, function/line-specific acceptance criteria |
| 15 | ✅ PASS | DoD includes STATUS/DECISIONS/WORK_INDEX + scope-boundary check; User-Visible Surface declared + live D-24026 item |
| 16 | ✅ PASS | Explicit control flow (no `.reduce()` in the converter); descriptive names; JSDoc + `// why:`; helpers extracted for reuse (WP-324) + testability |
| 17 | ✅ PASS | `## Vision Alignment` present — §14/§11; no conflict; determinism line (messages hash-excluded) |
| 18 | ✅ N/A | Verification greps a literal string (`defeated the tactic`) that is the intended enriched output, not a forbidden token; no forbidden-token grep |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface — engine log text; no donate/support copy or channel |
| 21 | ✅ N/A | No HTTP endpoint and no `apps/server/src/**` library function touched — game-engine only |

**Verdict: 21/21 resolved (13 PASS, 8 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Single layer (game-engine). The name resolver is already in
scope at all three sites (`fightMastermind.ts:148` resolves the mastermind name
today; `fightVillain.ts:198` is the canonical pattern), so name enrichment is
string-authoring, not new plumbing. The one genuinely new piece — the markup→plain
converter — is a pure, fully unit-tested helper. The one real cost is the replay
**message oracle** re-pin, which is mechanical (`record-game-fixture.mjs`) and
determinism-safe (`G.messages` is hash-excluded, D-24081). Standard two-session lane
(too many files + a message-oracle change for the lightweight lane). Scaffold step
confirms the exact move-test and fixture file names before completion.

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (engine-internal; pure helper imports no boardgame.io),
no monetization/identity/RNG/multiplayer-sync, no new contract, no engine state or
`finalStateHash` impact (message text only, hash-excluded). Scope deliberately
bounded to two cited cases + the reusable helpers; the remaining sites and effect
outcomes are explicitly deferred (WP-324 / WP-B). No BLOCK modes.
