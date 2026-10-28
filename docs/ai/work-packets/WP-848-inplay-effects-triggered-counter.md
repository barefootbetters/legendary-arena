# WP-848 — In-play "Effects triggered" counter in Your Victory Pile (Game Engine projection + Arena Client)

**Status:** Draft 2026-10-27 (EC-886; D-24784 reserved)
**Primary Layer:** Game Engine (`UIState` per-player projection) + Arena Client (render) — cross-layer, standard two-session lane
**Dependencies:** WP-708 (Synergy Rate tally, D-24531) ✅, WP-712 (`countsTowardRate`, D-24535) ✅, WP-715 (endgame `synergyContributions` projection, D-24538) ✅, WP-803 (`outOfTimeCards` public per-player field, D-24692) ✅ — all on `main`.
**User-Visible Surface:** `play.legendary-arena.com` (Your Victory Pile panel, desktop + mobile)

> Baseline: `origin/main` at `23a77459` (PR #3062). Numbers reserved by PR #3065.

---

## Goal

During a match, the **Your Victory Pile** panel (today: `Your Victory Pile — 0 cards / 0 VP`)
shows a live line counting how many of the player's triggerable card effects have triggered so
far, out of how many they have played, with the percentage:

```
Effects triggered: 3 / 5 (60%)
```

The count updates as cards are played. At game over it equals the endgame report card's Synergy
Rate for that seat ("assembled 3 of 5 synergy clauses"), because both read the same tally.

## User-Visible Impact

On play.legendary-arena.com, desktop and mobile, the player's own Victory Pile panel gains one
line under its header. It starts at `Effects triggered: 0 / 0` and moves each time the player
plays a hero ability that has a play condition (a class, team, keyword or similar check the
engine evaluates on play). Nothing else on the board changes. It does not move for a this-turn
threshold gate (e.g. Recruit made, cards drawn or Villains defeated this turn) that is unmet when
the card is played, since the WP-708 wait-and-see branch records nothing, nor for an ability
whose effect is not supported yet.

## Assumes

- WP-708 / D-24531 is complete: `G.diagnostics.conditionalClauses[playerId]` holds a live
  per-seat `{ played, assembled, potentialValue, realizedValue }` tally, written at play time by
  `recordConditionalClause` (`packages/game-engine/src/diagnostics/synergyCount.record.ts`) at
  the `evaluateAllConditions` chokepoint in `packages/game-engine/src/hero/heroEffects.execute.ts`.
  The type is `GameDiagnostics.conditionalClauses?` in
  `packages/game-engine/src/diagnostics/hollowEffect.types.ts`.
- WP-712 / D-24535 is complete: `played` / `assembled` move only for boolean-gated conditional
  clauses (`[hc:X]`, `[team:X]`, keyword gates). Pure count-scaled clauses pass
  `countsTowardRate: false`, so an entry can exist with `played === 0`. D-24649: magnitude-less
  icon lines are not counted.
- `G.diagnostics` is excluded from both hash oracles (D-24271; channel origin D-24034).
- WP-715 / D-24538 is complete: `buildUIState` (`packages/game-engine/src/ui/uiState.build.ts`
  §14) already reads `gameState.diagnostics?.conditionalClauses` to build
  `gameOver.synergyContributions`. Reading it in the per-player loop is the same read, earlier.
- `UIPlayerState` (`packages/game-engine/src/ui/uiState.types.ts`) is rebuilt field-by-field by
  two functions in `packages/game-engine/src/ui/uiState.filter.ts`: `redactHandCards` (other
  player / spectator) and `preserveHandCards` (owner). WP-803 / D-24692 `outOfTimeCards` is the
  newest public, optional, omit-when-absent per-player field: declared in the types file, set
  in the build loop (~L847), passed in both filter functions, pinned by the
  `outOfTimeCards public pass-through` describe in `uiState.filter.test.ts` (~L3650).
- `apps/arena-client/src/components/play/YourVictoryPile.vue` takes props `victoryCards` and
  `victoryVp` and is mounted in exactly two places, `apps/arena-client/src/pages/PlayDesktop.vue`
  (~L994) and `apps/arena-client/src/pages/PlayMobile.vue` (~L679), both bound from the computed
  `viewer: UIPlayerState | null`.
- The arena-client imports `UIPlayerState` from the engine `dist` (no client mirror type), so
  `pnpm -r build` must run before arena-client `typecheck`.
- The arena-client Play Diagnostics `uiStateSnapshot` (`apps/arena-client/src/diagnostics/diagnostics.ts`)
  serializes the whole projected `UIState`, so a passed-through field appears in it with no
  diagnostics-code change.

## Context (Read First)

- `.claude/rules/architecture.md` §UIState Projection Integrity (the five-step Board-Visible
  Field Rule) and §Layer Boundary.
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #2 (Engine Owns Truth) and §Package Import
  Rules (arena-client may import only the `.` engine surface).
- **AUTHORITATIVE for what is counted:** D-24531 and `diagnostics/synergyCount.record.ts`.
  **AUTHORITATIVE for audience dispositions:** `ui/uiState.filter.ts`.
- `docs/ai/DECISIONS.md`: D-24531 (WP-708 tally), D-24535 (`countsTowardRate`), D-24538 (WP-715
  endgame projection), D-24692 (WP-803 public per-player field), D-12803 (Board-Visible rule),
  D-20105 (no effect semantics in the client), D-24271 (hash-excluded diagnostics). Scan for any
  newer entry touching `conditionalClauses` or `UIPlayerState`.
- `docs/ai/work-packets/WP-708-synergy-realization-report-card.md` §Contract (what is counted)
  and `docs/ai/work-packets/WP-803-out-of-time.md` (the pass-through pattern).
- `docs/ai/DESIGN-SYNERGY-REALIZATION.md` — the two-vocabulary rule: player copy never says
  whiff / failed / missed / wasted / error.
- `docs/ai/REFERENCE/00.6-code-style.md`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — not touched: no card data, schema or setup
  field changes.

Jeff asked for an in-play counter of triggered card effects and the percentage against cards
played with triggerable effects, added to the Your Victory Pile panel.

**This is the in-play view of a number the engine already keeps.** The Synergy Realization arc
(WP-708 → 720) built the exact tally — per seat, conditional hero clauses played vs. assembled —
but projects it only at game over and on the coach / score surfaces. Nothing new is detected or
counted here; the WP projects the live tally onto `UIPlayerState` and renders it.

**Unit = conditional clause, not card.** A "triggerable effect" is a hero ability with a
condition the engine evaluates when the card is played. A card with two conditional clauses
adds two to the denominator. Unconditional abilities (`+2 Attack`) always fire, so counting them
would pin the rate near 100% and tell the player nothing. Reusing the clause tally keeps the
in-play number identical to the endgame Synergy Rate; a second per-card counter would disagree
with it.

**Why public.** The tally counts every non-day/night play condition on a clause whose effect is
supported, including hand-reading ones (e.g. `heroCostAtLeastInHandOrPlay`), so "face-up plays"
is not the reason. The reason is
that every outcome is already in the public game log: an assembled clause shows its effect, and
an unassembled one pushes the public `blocked` "ability did not activate" line
(`hero/heroEffects.execute.ts` ~L986), which the filter copies to every audience.

**Why one WP across two layers.** The engine half is a five-step Board-Visible field (5 files)
and the client half is one component, its test, its two mount sites and their two page tests
(6 files). Neither half is useful or live-verifiable alone, and the WP-717 server-only precedent
shipped a figure nothing rendered until WP-718. 11 files is over the §5 ~8 guideline; splitting
would produce an engine WP with `User-Visible Surface: none` and a client WP blocked on it, for no
reduction in risk. The two page tests are there because a mis-bound prop renders `0 / 0` silently
and that exact failure already shipped once (`victoryVp`, see the `YourVictoryPile.vue` props
comment); WP-803 added the same page-level assertions. Not Lightweight Lane: two layers and a
`.types.ts` contract edit (01.0a eligibility #1, #4). A 01.6 post-mortem is mandatory (new
projection field consumed by future WPs).

**Supersession check (01.0a Step 2):** `git log --all --grep`, `ls` and `gh pr list` for the
slug found no prior work. Near-matches, not overlaps: WP-409 (`lastPlayEffectsFired`, a per-play
fired count for an audio cue, not cumulative); WP-715 (the same tally, endgame only).

## Scope (In)

1. **Engine — declare `UIPlayerState.conditionalClauses?: { played: number; assembled: number }`**
   in `uiState.types.ts`, with JSDoc and a `// why:` citing WP-848 / D-24784.
2. **Engine — populate in `buildUIState`'s per-player loop**, beside the `outOfTimeCards`
   assignment: when `gameState.diagnostics?.conditionalClauses?.[playerId]` exists, assign a
   fresh `{ played: entry.played, assembled: entry.assembled }`. Omit the key when there is no
   entry. Only these two fields; `potentialValue` / `realizedValue` stay endgame-only.
3. **Engine — pass through `redactHandCards` and `preserveHandCards`** as a public field for every
   audience, copied into a fresh object, omitted when absent.
4. **Engine tests (locked counts):** `uiState.build.test.ts` gains one new `describe` with one
   `it` (values match the tally; key absent when no entry; mutating the projection leaves
   `G.diagnostics` unchanged). `uiState.filter.test.ts` gains one new `describe` with exactly 3
   `it`s, modelled on the WP-803 `outOfTimeCards public pass-through` describe: (1) present and
   deep-equal to `{ played, assembled }` for owner, other player and spectator; (2) each filtered
   object is a different reference from the built one; (3) key absent in all three audiences for
   a seat with no entry.
5. **Client — `YourVictoryPile.vue`:** props `conditionalClausesPlayed` and
   `conditionalClausesAssembled` (Number, default 0) and one line directly under the header,
   `<p class="your-victory-pile__effects" data-testid="play-your-victory-effects">`, with the
   locked copy (see Non-Negotiable Constraints). The copy / percentage helper is a named function
   returned from `setup()` (like `buildComposition`), so the template binding resolves under the
   vue-sfc-loader separate compile (P6-46).
6. **Client — bind the props at both mount sites** in `PlayDesktop.vue` and `PlayMobile.vue`:
   `:conditional-clauses-played="viewer.conditionalClauses?.played ?? 0"` and
   `:conditional-clauses-assembled="viewer.conditionalClauses?.assembled ?? 0"`.
7. **Client tests (locked counts):** `YourVictoryPile.test.ts` gains exactly 4 tests (3 / 5 (60%),
   2 / 3 (67%), 0 / 0, copy lint). `PlayDesktop.test.ts` and `PlayMobile.test.ts` each gain 1 test:
   a frame whose viewer has `conditionalClauses: { played: 5, assembled: 3 }` renders
   `Effects triggered: 3 / 5 (60%)` in `play-your-victory-effects` (the WP-803 page-test pattern).

## Out of Scope

- Any change to what is counted: the recorder, `countsTowardRate`, the chokepoint, wait-and-see
  or deferred grants, hollow handling. The line shows the WP-708 tally exactly.
- Per-card counting, unconditional abilities, villain / mastermind / scheme effects.
- Rendering other seats' counts (the field is public, but only the viewer's own panel shows it).
- Realized Value % in play (`potentialValue` / `realizedValue` are not projected).
- Any scoring, PAR, grade or leaderboard input. Display only.
- The endgame report card, coach panel and `gameOver.synergyContributions` — unchanged.
- A per-turn view or per-turn reset; the count is cumulative for the match.
- The Victory Pile header text, composition counters and browse button — unchanged.

## Files Expected to Change

1. `packages/game-engine/src/ui/uiState.types.ts` — modified — declare `UIPlayerState.conditionalClauses?`
2. `packages/game-engine/src/ui/uiState.build.ts` — modified — populate it in the per-player loop
3. `packages/game-engine/src/ui/uiState.filter.ts` — modified — pass it through `redactHandCards` and `preserveHandCards`
4. `packages/game-engine/src/ui/uiState.build.test.ts` — modified — projection test
5. `packages/game-engine/src/ui/uiState.filter.test.ts` — modified — audience pass-through describe
6. `apps/arena-client/src/components/play/YourVictoryPile.vue` — modified — two props + the effects line
7. `apps/arena-client/src/components/play/YourVictoryPile.test.ts` — modified — render + copy-lint tests
8. `apps/arena-client/src/pages/PlayDesktop.vue` — modified — bind the two props
9. `apps/arena-client/src/pages/PlayMobile.vue` — modified — bind the two props
10. `apps/arena-client/src/pages/PlayDesktop.test.ts` — modified — one mount-binding test
11. `apps/arena-client/src/pages/PlayMobile.test.ts` — modified — one mount-binding test

Post-mortem (mandatory per 01.6, new projection field): `docs/ai/post-mortems/01.6-WP-848-inplay-effects-triggered-counter.md` — new.

Governance (execution close, `SPEC:` commit): `docs/ai/DECISIONS.md` (D-24784), `docs/ai/STATUS.md`,
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md` (+ `pnpm roadmap:counts:write`), `docs/ai/NUMBER-LEDGER.md` (LANDED marks).

## Non-Negotiable Constraints

**Engine-wide:**
- Full file contents for every new or modified file; no diffs, no snippets, no "show only the
  changed section".
- ESM only, Node v22+. `node:test` only.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (JSDoc on every function, full-word
  names, no nested ternaries, `// why:` on non-obvious decisions).

**Packet-specific:**
- No `G` write. The build reads `G.diagnostics.conditionalClauses` only; no move, rule, `endIf`,
  bot or scoring path reads the new field.
- No hashed state touched; sentinel `finalStateHash` and `PRE_WP080_HASH` stay byte-identical.
  A hash or fixture re-pin means the change touched something it should not — STOP.
- All five Board-Visible steps (declare, populate, pass through both filter functions, audience
  test, diagnostics snapshot). A field set in build but missing from either filter function is
  silently dropped for that audience.
- The client renders the two integers and computes only the display percentage; no condition
  evaluation or effect logic in the client (D-20105).
- Display only: never enters `finalScore`, `rawScore`, PAR, grade or leaderboards (NG-1).
- No new dependencies.
- No migration: the field is optional and omit-when-absent, so a pre-WP-848 client ignores it,
  and replays and stored matches are unchanged (the source channel already exists on every
  post-WP-708 match). A new client against a pre-WP-848 server shows `Effects triggered: 0 / 0`
  until the server deploys, so run the D-24026 check only after both the server and arena-client
  deploys are live.

**Locked contract values:**
- Engine field: `UIPlayerState.conditionalClauses?: { played: number; assembled: number }` —
  public to every audience; present iff `G.diagnostics.conditionalClauses[playerId]` exists.
- Client props: `conditionalClausesPlayed`, `conditionalClausesAssembled` (Number, default 0).
- Test id: `play-your-victory-effects`.
- Copy when `played > 0`: `Effects triggered: {assembled} / {played} ({percent}%)`, with
  `percent = Math.round((100 * assembled) / played)`.
- Copy when `played === 0`: `Effects triggered: 0 / 0` (no percentage).
- Forbidden words in the panel copy (case-insensitive): `whiff`, `failed`, `missed`, `wasted`,
  `error`.

**Session protocol:** if any assumption above does not hold on `main` at execution time, or a
change outside the eleven files (plus post-mortem and governance) seems needed, stop and ask — do not improvise.

## Vision Alignment

**Vision clauses touched:** §20–26 (Scoring & Skill Measurement — a skill signal shown to the
player), NG-1 (no pay-to-win).

**Conflict assertion:** No conflict: this WP preserves all touched clauses.

**Non-Goal proximity check:** user-facing display only. It shows the player their own play; no
purchase, cosmetic or paid surface can change it, and it feeds no ranking. NG-1..7 not crossed.

**Determinism preservation:** the projection reads only the hash-excluded `G.diagnostics`
channel and writes nothing to `G`; replay and hash outputs are unchanged (AC 8).

**Funding Surface Gate (§20):** N/A — the line reports gameplay counts; it shows no tournament
funding, donation or paid-tier copy and proposes none.

## Acceptance Criteria

1. After a seat plays a conditional clause, the built `UIState.players[seat].conditionalClauses`
   deep-equals `{ played, assembled }` from `G.diagnostics.conditionalClauses[seat]`.
2. For a seat with no tally entry, `'conditionalClauses' in player` is false in the built state
   and in every filtered view.
3. `filterUIStateForAudience` keeps the field for the owner, another player and a spectator, and
   each filtered object is a different reference from the built one.
4. Mutating the built `conditionalClauses` object leaves `G.diagnostics.conditionalClauses`
   unchanged.
5. `YourVictoryPile` renders `Effects triggered: 3 / 5 (60%)` for played 5 / assembled 3 and
   `Effects triggered: 2 / 3 (67%)` for played 3 / assembled 2.
6. `YourVictoryPile` renders `Effects triggered: 0 / 0` with no `%` for played 0.
7. The text of `play-your-victory-effects` contains none of the forbidden words (case-insensitive).
8. Sentinel `finalStateHash` and `PRE_WP080_HASH` byte-identical; no fixture file changes.
9. `PlayDesktop.test.ts` and `PlayMobile.test.ts` each render `Effects triggered: 3 / 5 (60%)`
   for a viewer with `conditionalClauses: { played: 5, assembled: 3 }` (proves both mount bindings).
10. game-engine and arena-client suites pass with 0 failures; `pnpm -r build` exits 0;
    arena-client `typecheck` exits 0.

## Verification Steps

```pwsh
pnpm -r build                                              # exits 0
pnpm --filter @legendary-arena/game-engine test            # "fail 0"
pnpm --filter @legendary-arena/arena-client test           # "fail 0"
pnpm --filter @legendary-arena/arena-client typecheck      # exits 0
git status --short                                         # only the 11 allowlisted files (+ post-mortem, governance at close)
git diff --name-only origin/main -- '*.test.ts'            # exactly the 5 allowlisted test files: no sentinel / hash re-pin
pnpm ledger:numbers:check; pnpm workindex:rows:check; pnpm workindex:executed:check   # each exits 0 (at close)
```

Browser preview, one of two methods: (a) a local server match — play a class-gated hero with no
partner in play, then one with its partner; the line moves `Effects triggered: 0 / 0` →
`0 / 1 (0%)` → `1 / 2 (50%)` (a failed class gate records played +1 / assembled +0 at play time,
`heroEffects.execute.ts` ~L972); or (b) on the `?fixture=mid-turn&play=1` route, push three
snapshots into the UI-state store with `players[n].conditionalClauses` absent,
`{ played: 1, assembled: 0 }`, `{ played: 2, assembled: 1 }` and read the
`play-your-victory-effects` text with a DOM query (avoid screenshots there: external card images
stall them). Real in-match movement is covered by the D-24026 step.

D-24026 after deploy: in a real match on play.legendary-arena.com the line moves as conditional
heroes are played, and the exported Play Diagnostics `uiStateSnapshot.players[n].conditionalClauses`
matches the panel (Board-Visible step 5).

## Definition of Done

- [ ] Acceptance Criteria 1–10 pass; command output tails pasted in the execution PR.
- [ ] No files outside `## Files Expected to Change` and the listed governance files were modified
      (`git diff --name-only` checked).
- [ ] 01.6 post-mortem written (before the `EC-886:` commit).
- [ ] `docs/ai/DECISIONS.md` — D-24784 landed Active.
- [ ] `pnpm ledger:numbers:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check` exit 0.
- [ ] `docs/ai/STATUS.md` updated with what changed.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date; EC_INDEX row `Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node 📝 → ✅; `pnpm roadmap:counts:write`, then
      `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/NUMBER-LEDGER.md` WP-848 / EC-886 / D-24784 marked LANDED.
- [ ] Two-commit topology (`EC-886:` implementation + `SPEC:` governance close); PR squash-merged.
- [ ] Live-on-surface verification (D-24026): a real match on play.legendary-arena.com shows the
      line moving, with the diagnostics snapshot as evidence — or flagged operator-pending in
      WORK_INDEX.

## Reserved Decision (lands at execution)

**D-24784** — `UIPlayerState.conditionalClauses` projects the per-seat `{ played, assembled }`
WP-708 tally during play, public to every audience (every outcome is already in the public game
log: an assembled effect, or the `blocked` "ability did not activate" line), omit-when-absent,
display-only; the client
labels it "Effects triggered" (unit = conditional clause, identical to the endgame Synergy Rate).
Reads only the hash-excluded `G.diagnostics` channel; no re-pin.

## Lint Gate Self-Review (00.3)

| § | Result |
|---|---|
| §1 Structure | PASS — all ten required sections present and non-empty; Out of Scope lists 8 exclusions |
| §2 Constraints | PASS — engine-wide (full files, no diffs, ESM, Node 22, 00.6), packet-specific, session protocol, locked values |
| §3 Assumes | PASS — prior WPs, every file and shape the packet reads, build-order dependency |
| §4 Context | PASS — architecture rule, ARCHITECTURE.md sections, D-entries, prior WPs; 00.2 named as untouched |
| §5 Files | PASS — 11 code/test files + 1 new post-mortem, each marked with a description; over ~8, justified in Context |
| §6 Naming | PASS — reuses canonical `conditionalClauses` / `played` / `assembled` (D-24531) |
| §7 Dependencies | PASS — none added |
| §8 Boundaries | PASS — engine projects, client renders; arena-client uses only the `.` engine surface |
| §9 Windows | PASS — `pwsh` commands, `pnpm` only |
| §10 Env vars | N/A — none used |
| §11 Auth | N/A — no auth surface |
| §12 Tests | PASS — `node:test`, no boardgame.io import, no network/DB |
| §13 Verification | PASS — exact commands with expected output |
| §14 AC | PASS — 10 binary items naming files, fields and strings |
| §15 DoD | PASS — STATUS, DECISIONS, WORK_INDEX, scope-boundary check, D-24026 live-verify item |
| §16 Code style | PASS — enforced through Constraints and the EC; no new helper (two pass-through sites copy inline, the `victoryVP` precedent) |
| §17 Vision | PASS — §20–26, NG-1 cited; no conflict; determinism line present |
| §18 Prose-vs-grep | N/A — no literal-token grep in Verification Steps (the copy lint is a unit test, not a repo grep) |
| §19 Staleness | Applied at commit (baseline re-checked against `origin/main`) |
| §20 Funding | N/A — reports gameplay counts only; no funding copy proposed |
| §21 API catalog | N/A — no `apps/server` endpoint or catalog function touched |
