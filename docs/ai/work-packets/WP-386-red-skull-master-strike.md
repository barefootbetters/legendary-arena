# WP-386 — Red Skull Master Strike: "Each player KOs a Hero from their hand" (Game Engine)

**User-Visible Surface:** play.legendary-arena.com

## Goal

Red Skull's printed Master Strike — *"Each player KOs a Hero from their hand."* — actually fires. Today the per-mastermind dispatcher in `mastermindHandlers.ts` implements only Magneto; a Red Skull strike performs the generic bookkeeping (strike counter, D-15401 bystander capture, WP-200 emission) and silently skips the card text, so the mastermind applies zero pressure. A reviewed live game (match `TYB2-jQuUc_`, 2026-07-16) revealed three strikes with six player-KOs that never happened. After this WP, every Red Skull Master Strike KOs one Hero from each player's hand (deterministic auto-pick, MVP semantics per reserved D-24188), with one durable log line per player.

## Assumes

- WP-024 complete — `mastermindStrikeHandler` dispatcher exists in
  `packages/game-engine/src/rules/mastermindHandlers.ts`, branching on
  `G.selection.mastermindId`; `resolveMagnetoStrike` is the per-mastermind
  precedent (mutates `G` directly inside the handler).
- WP-200 complete — the `mastermindStrikeResolved` emission is the handler's
  final step; this WP must not reorder or alter it.
- D-15401 — the generic `captureBystanderOntoMastermind` runs for every
  strike; unchanged by this WP.
- `WOUND_EXT_ID` (`'pile-wound'`) is exported from
  `packages/game-engine/src/setup/pilesInit.ts`.
- `LegendaryGameState.ko: CardExtId[]` exists (`types.ts`) — the global KO
  pile WP-382's `ko-wound-reward` also appends to.
- `G.cardStats[extId]?.cost` is the recruit-cost lookup; S.H.I.E.L.D.
  starters have no `cardStats` entry (D-21502) and are treated as cost 0.
- `G.selection.mastermindId` carries the qualified id (`core/red-skull` /
  `co2e/red-skull`); mastermind setup picks the **first non-tactic face**,
  so `co2e/red-skull` resolves to the base 2nd-edition face whose strike
  text is byte-identical to core's (`data/cards/co2e.json` verified
  2026-07-16). The epic face (`epic-red-skull`, different strike text) is
  not engine-selectable.
- Engine suite green on `main` at session start (baseline recorded in the
  EC's Before Starting; 1981 pass / 463 suites / 0 fail at draft baseline
  `a7a1150d`).

If any assumption is false, this packet is BLOCKED and must not proceed.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §The Rule Execution Pipeline (handlers never live
  in `G`; `applyRuleEffects` applies returned effects; per-mastermind text
  effects mutate `G` inline in the handler per the Magneto precedent)
- `.claude/rules/architecture.md` §Rule Execution Pipeline, §Prohibited AI
  Failure Patterns
- `packages/game-engine/src/rules/mastermindHandlers.ts` — the dispatcher,
  the Magneto branch, and the WP-200 emission ordering
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — the Magneto
  describe-block is the test template
- `docs/ai/DECISIONS.md` — scan for D-15401 (strike bystander capture),
  D-21502 (statless starters), D-20001/D-20008 (notable-event emission)
- `data/cards/core.json` + `data/cards/co2e.json` red-skull base faces —
  the printed strike text this WP implements

## Scope (In)

- Add a Red Skull match constant set beside `MASTERMIND_MAGNETO` in
  `mastermindHandlers.ts` covering `core/red-skull` and `co2e/red-skull`
  (identical printed strike text).
- Add `resolveRedSkullStrike(gameState)` mirroring `resolveMagnetoStrike`:
  for each player (sorted `Object.keys(gameState.playerZones)`), KO one
  Hero from their hand per the Locked Values selection rule; append the
  KO'd card to `gameState.ko`; push one durable log line per player
  (KO line naming the card, or a no-Hero no-op line).
- Wire the branch into `mastermindStrikeHandler` in the existing
  per-mastermind dispatch slot (after `captureBystanderOntoMastermind`,
  before the WP-200 emission — the Magneto ordering).
- New tests in `mastermindHandlers.test.ts` mirroring the Magneto
  describe-block (see Acceptance Criteria).

## Out of Scope

- Other masterminds' strike texts (core Dr. Doom, core Loki, and all other
  co2e faces including `epic-red-skull` — each is its own future WP).
- Red Skull tactic Fight: effects (Endless Resources / Negablast Grenades /
  Ruthless Dictator / HYDRA Conspiracy) — unimplemented per the
  `fightMastermind.ts` MVP note; separate WP.
- The stale `// why: … tactic text effects are WP-024` comment in
  `fightMastermind.ts` (WP-024 closed without them) — observation only,
  not touched here.
- Hollow HYDRA villain Fight: markers (Endless Armies / Viper / Kidnappers
  / Supreme HYDRA) — separate data+engine WP.
- A player-facing KO-target choice (pending-choice UX) — future
  faithfulness upgrade; MVP is the deterministic auto-pick (D-24188).
- Any card JSON, marker map, or registry change.
- Any change to the `mastermindStrikeResolved` notable event, its payload,
  or its narrative composer.
- Any new `RuleEffect` type, G field, move, or phase.

## Files Expected to Change

- `packages/game-engine/src/rules/mastermindHandlers.ts` — modified — Red
  Skull constant set + `resolveRedSkullStrike` + dispatch branch
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — modified —
  new `mastermindStrikeHandler — Red Skull Master Strike` describe-block
- `docs/ai/STATUS.md` — modified — session close-out entry
- `docs/ai/DECISIONS.md` — modified — D-24188 lands (reserved at draft)
- `docs/ai/work-packets/WORK_INDEX.md` — modified — checkbox flip
- `docs/ai/execution-checklists/EC_INDEX.md` — modified — status flip

## Contract

> **Output contract for this session:**
> - Full file contents for every new or modified file (no diffs, no snippets)
> - ESM only, Node v22+
> - Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`
> - No `Math.random()`; no wall-clock reads; no new dependency
> - No `boardgame.io` import in `mastermindHandlers.ts` (it has none today)
> - Moves never throw; the handler never throws — a malformed or empty hand
>   degrades to a logged no-op

**Locked contract values (do not re-derive):**

- Red Skull mastermind ids: `'core/red-skull'` and `'co2e/red-skull'`
  (readonly array constant beside `MASTERMIND_MAGNETO`; epic face excluded)
- Hero eligibility: a hand card is a Hero **iff** `extId !== WOUND_EXT_ID`
  (import from `../setup/pilesInit.js`; Wounds are the only non-Hero hand
  cards the engine currently produces)
- Selection rule: the eligible card with the **lowest recruit cost**
  (`gameState.cardStats[extId]?.cost ?? 0`); tie → lowest hand index
- Destination: append to `gameState.ko` (global KO pile — the WP-382
  destination), removed from the player's hand
- Zone mutation idiom (the WP-382 / D-24183 KO idiom — zoneOps discipline):
  select the ext id by the cost/tie rule, then
  `moveCardFromZone(playerZones.hand, [], selectedExtId)` to remove it and
  `koCard(gameState.ko, selectedExtId)` to append (duplicate ext ids are
  fungible tokens, so first-match removal is observationally identical to
  index removal)
- Player iteration order: `Object.keys(gameState.playerZones).sort()`
  (the Magneto pattern)
- Log lines (via `pushLog` + `formatCardRef(G.cardDisplayData, cardId)`):
  - KO: `[Red Skull Master Strike] Player ${playerId} KO'd <cardRef> from their hand.`
  - no Hero: `[Red Skull Master Strike] Player ${playerId} has no Hero in hand to KO.`
- Handler ordering unchanged: `captureBystanderOntoMastermind` → per-
  mastermind branch (Red Skull joins Magneto's slot) → WP-200 emission →
  return `buildGenericStrikeEffects()`

## Vision Alignment

- **Vision clauses touched:** §1 (Faithful Legendary rules), §2 (Real card
  content behaves as printed), §22 (Deterministic Eval).
- **Conflict assertion:** No conflict: this WP preserves all touched
  clauses — it makes printed card text faithful where it was silently
  skipped.
- **Non-Goal proximity check:** N/A — WP touches no monetization,
  identity, or competitive-scoring surface. None of NG-1..7 are crossed.
- **Determinism preservation:** The auto-pick is fully deterministic (cost
  then hand-index ordering; no RNG, no `ctx.random.*` needed) and
  replay-faithful (Vision §22). No scoring, PAR, or replay-verification
  change. The recorded sentinel fixture and `PRE_WP080_HASH` oracle use
  `core/dr-doom` (no Red Skull strike is recorded), and the
  runtime-observed sim matrix pins `core/dr-doom` — all committed hash and
  artifact surfaces are expected byte-identical; any drift is a STOP-and-
  investigate, never a silent re-pin.

## Funding Surface Gate

N/A — engine gameplay fidelity only; no UI funding affordances, no
user-visible funding copy, no funding channels referenced (§20.1 surfaces
absent).

## API Catalog Update

N/A — no HTTP endpoint added, modified, or re-statused; no
`apps/server/src/**` library surface touched (§21.1 surfaces absent).

## Acceptance Criteria

- [ ] A Red Skull strike KOs exactly one card from each player's hand when
      every player has at least one Hero in hand.
- [ ] Each KO'd card is appended to `G.ko` and removed from that player's
      hand (hand length −1, ko length +1 per player).
- [ ] The lowest-cost eligible Hero is picked; a cost tie picks the lowest
      hand index (test with two equal-cost heroes at different indices).
- [ ] A statless starter (no `cardStats` entry) is treated as cost 0 and
      is picked over a cost-3 hero.
- [ ] Wounds are never KO'd: a hand of only Wounds produces no KO, no hand
      mutation, and the no-Hero log line.
- [ ] An empty hand produces no KO and the no-Hero log line.
- [ ] A non-Red-Skull mastermind does not take the branch (existing Magneto
      and generic tests pass unchanged); both `core/red-skull` and
      `co2e/red-skull` do take it.
- [ ] Generic strike behavior is preserved: bystander capture (D-15401),
      `masterStrikeCount` counter effect, and exactly one
      `mastermindStrikeResolved` emission still occur on a Red Skull strike.
- [ ] Full engine suite green; sentinel `finalStateHash` and
      `PRE_WP080_HASH` byte-identical; `pnpm sim:runtime-observed:check`
      exits 0 with no regeneration.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine build
# Expected: exit 0

pnpm --filter @legendary-arena/game-engine test
# Expected: baseline (1981 / 463 suites at draft) + new Red Skull tests, 0 fail
# (record exact counts; sentinel finalStateHash + PRE_WP080_HASH unchanged)

pnpm -r build
# Expected: exit 0

pnpm sim:runtime-observed:check
# Expected: exit 0, no regeneration performed (artifact stays byte-current;
# the matrix mastermind is core/dr-doom). Drift here = STOP and investigate.

git diff --name-only
# Expected: exactly the six files in "Files Expected to Change"
```

## Definition of Done

This packet is complete when ALL of the following are true:
- [ ] All acceptance criteria pass
- [ ] `docs/ai/STATUS.md` updated with what changed
- [ ] `docs/ai/DECISIONS.md` updated — D-24188 (Red Skull MVP auto-KO
      semantics) lands as Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has this packet checked off
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` row flipped to Done
- [ ] No files outside the "Files Expected to Change" list were modified
- [ ] Live-on-surface verification (D-24026): in a deployed Red Skull match
      on play.legendary-arena.com, a Master Strike reveal KOs a hero from
      each player's hand and the per-player log lines appear in the HUD log
      (operator-pending on deploy is acceptable at merge; record it)

## Reserved Decision (lands at execution)

**D-24188 — Red Skull Master Strike MVP: deterministic auto-KO of the
lowest-cost Hero.** The printed text gives each player the choice of which
Hero to KO. MVP auto-picks the lowest-cost Hero (tie → lowest hand index)
because the rational tabletop pick is the cheapest card (starters thin the
deck), so the auto-pick tracks player-optimal play; it avoids a blocking
multi-player pending-choice (the engine's pending-choice cluster is
single-player-blocking, and a strike fires outside any player's main
stage). Wounds are not Heroes and are never taken. A future WP may upgrade
to a per-player choice prompt. Precedent: the Magneto MVP strike branch
(WP-024) — the same "text effect without choice UX" simplification class.

## Lint Gate Self-Review (00.3)

- §1 Structure: PASS — all ten required sections present and non-empty.
- §2 Constraints: PASS — engine-wide (full files, no diffs, ESM, Node 22+,
  00.6 style) + packet-specific + session protocol + locked values present.
- §3 Assumes: PASS — prior WPs, files with exports, data state, and the
  BLOCKED clause are explicit.
- §4 Context: PASS — specific docs and sections listed; DECISIONS scan
  named; no data-shape surface beyond `G` internals (00.2 not touched —
  no setup-payload or persisted field named; canonical `G` field names
  verified against `types.ts`).
- §5 Files: PASS — every file listed with new/modified and a description;
  six files, bounded.
- §6 Naming: PASS — `ext_id` semantics respected (`CardExtId` strings);
  no 00.2 §8.1 payload fields touched.
- §7 Dependencies: PASS — no new npm dependency; forbidden packages not
  reachable from this scope.
- §8 Boundaries: PASS — engine-layer only; no DB, no registry import, no
  boardgame.io import in the touched files; randomness not used.
- §9 Windows: PASS — all commands are `pnpm` scripts; no shell assumptions.
- §10 Env vars: PASS — none required; none introduced.
- §11 Auth: N/A — packet does not touch authentication.
- §12 Test quality: PASS — `node:test` only; no boardgame.io/testing; no
  network/DB; tests extend an existing engine test file.
- §13 Verification: PASS — exact pnpm commands with expected outcomes.
- §14 Acceptance criteria: PASS — 9 binary, observable, specific items.
- §15 DoD: PASS — STATUS/DECISIONS/WORK_INDEX/scope-boundary checkboxes
  present; §15.1 User-Visible Surface declared with a live-on-surface item.
- §16 Code style: PASS — no new abstractions beyond the per-mastermind
  resolver (the established pattern); explicit control flow; full-word
  names; functions under 30 lines; `// why:` comments required by the EC.
- §17 Vision Alignment: PASS — section present with clause numbers,
  conflict assertion, NG proximity, determinism line.
- §18 Prose-vs-grep: PASS — no literal-token grep gates in Verification
  Steps (the runtime-observed check is script-behavior-pinned, not
  string-pinned).
- §19 Bridge-vs-HEAD: noted — commit-time discipline; baseline SHA cited.
- §20 Funding gate: N/A with named justification (see section above).
- §21 API catalog: N/A with named justification (see section above).
