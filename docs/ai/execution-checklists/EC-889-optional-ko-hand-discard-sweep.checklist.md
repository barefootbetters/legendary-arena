# EC-889 — Bare "You may KO a card from your hand or discard pile." executes (marker-only sweep)

**WP:** WP-851 · **Decision:** D-24787 (reserved; lands at execution) · **Lane:** standard two-session

**Pre-flight (01.4):** READY TO EXECUTE (2026-10-28; PS-1..3 fixed, RS-1..5 folded in)
**Copilot (01.7):** PASS on re-run 2026-10-28 (CONFIRM); the first pass was RISK, held for fixes. Residual: the feed and pin deltas are re-derived if WP-850 lands first.

## Before Starting

- [ ] WP-667 / D-24480 on `main`: `optional-ko-hand-discard` ∈ `HERO_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`;
      `heroEffectOptionalKoHandDiscard` parks `rewardType 'none'`, `koZones ['hand','discard']`.
- [ ] The `antics` / `outwit` / `draw-threshold` marker→condition branches exist in `setup/heroAbility.setup.ts`.
- [ ] Each of the 11 lines in `data/cards/*.json` is still unmarked and reads as in WP §Corpus scan.
- [ ] `pnpm --filter @legendary-arena/registry --filter @legendary-arena/game-engine build`.

## Locked Values

- 12 apply entries (set → `heroSlug` / `cardSlug` / `abilityIndex` → token), each appended to its set's array:
  `amwp` ant-man/bug-swarm/1 · `asrd` warriors-three-the/hogun-the-grim/0 ·
  `chmp` ms-marvel/need-to-stretch-my-legs/1 · `cvwr` storm-black-panther/tsunami-of-justice/0 ·
  `dead` stingray/phd-in-oceanography/0 · `dkcy` bishop/whatever-the-cost/1 ·
  `dkcy` professor-x/class-dismissed/1 · `dkcy` wolverine/no-mercy/1 ·
  `mgtg` gamora/stolen-necroblaster/0 (`[keyword:draw-threshold:2]` FIRST, then the KO token) ·
  `wwhk` caiera/focus-the-old-power/0 · `xmen` phoenix/life-death-incarnate/1.
  The KO token on all 11 is `[keyword:optional-ko-hand-discard]`.
- Bishop line: `[hc:covert]: You may KO a card from your hand or discard pile. [keyword:optional-ko-hand-discard]`
- Gamora line: `If you drew at least two cards this turn, you may KO a card from your hand or discard pile. [keyword:draw-threshold:2] [keyword:optional-ko-hand-discard]`
- Parsed hook: `effects [{type:'optional-ko-hand-discard'}]`, no `unresolvedMarkers`. Conditions:
  `cheapOrSizeChangingAtLeast:3` (Ant-Man), `heroClassMatch:strength` (Hogun), `requiresTeam:champions`
  (Ms. Marvel), `heroClassMatch:covert` (Tsunami, Bishop), `heroClassMatch:instinct` (Professor X),
  `cardsDrawnThisTurnAtLeast:2` (Gamora), `distinctHeroCostsAtLeast:3` (Caiera), none (Stingray, Wolverine, Phoenix).
- Parked entry: `{ rewardType:'none', rewardMagnitude:0, koZones:['hand','discard'] }`.
- Provenance: `"optional-ko-hand-discard": { "wp": "WP-667", "decision": "D-24480" }`.
- Expected regen shape (scaffold): `apply` reports `Updated: 12 lines`. Deltas:
  - raw `totalObservations` −22 (7765 → 7743)
  - `gate-only` −28
  - dashboard `totalObs` −24 (8686 → 8662)
  - held: `resolvedObs` (1091), `percentResolved` (12.6), `distinctMechanics` (78)
  - `dropped` 0

  If a feed-moving PR (for example WP-850) lands first, re-derive the deltas on the new baseline.
- Engine suite: 6031 → 6031 + N / 0 (N = the new file's tests, one `describe`).

## Guardrails

- [ ] NO `packages/game-engine/src/**` source edit except the new test file. No new handler, keyword, condition, or drift array.
- [ ] NEVER mark any of the 13 excluded lines (Focus, What If...?, Sacrifice, Tactical Formation, Patrol,
      Villain-has-Wounds, Thrown Artifact, Danger Sense). A dropped gate means a phantom ungated KO (D-24787).
- [ ] Card data comes from `apply-hero-ability-markers.mjs` only, never hand-typed.
- [ ] Edit `hero-ability-markers.json` with targeted inserts. Never `JSON.stringify` it (that reorders `"2099"`).
- [ ] `finalStateHash` and every sentinel stay byte-unchanged. If one moves, STOP.
- [ ] The sweep and dashboard re-pin must match the Locked regen shape. An unexplained mechanic loss means STOP.
- [ ] Test: `node:test`/`node:assert` only; no boardgame.io; parses the real committed lines.

## Required Comments (`// why:`)

- [ ] Test: why the hooks come from the committed card data, not a fixture (the marker is the change under test).
- [ ] Test: why Bishop parks nothing without a prior Covert Hero (heroClassMatch counts other Heroes played this turn).
- [ ] Test: why Gamora waits instead of whiffing (D-24377 whole-turn window; the test calls `resolveDeferredHeroGrants`, as `turn.onMove` does).
- [ ] Dashboard re-pin: a dated history line (WP-851, the 8686 → 8662 denominator shift, resolved held;
      −24 vs the raw −22 because `totalObs` sums per-mechanic max(baseline, live) peaks).

## Files to Produce

- [ ] `scripts/convert-cards/inputs/hero-ability-markers.json`: +12 apply entries, +1 `_notes` line.
- [ ] `data/cards/{amwp,asrd,chmp,cvwr,dead,dkcy,mgtg,wwhk,xmen}.json`: generated.
- [ ] `scripts/coverage/mechanic-provenance.json`: +1 row.
- [ ] `docs/ai/coverage/hero-mechanic-ledger.json` / `.csv`, `docs/ai/coverage/runtime-observed-hollows.json`: generated.
- [ ] `apps/dashboard/src/composables/useInPlayCoverage.test.ts`: `totalObs` re-pin + comment.
- [ ] `packages/game-engine/src/hero/optionalKoHandDiscardSweep.test.ts`: new.
- [ ] `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`: generated from the new ledger.

## After Completing

- [ ] `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` before the dashboard test (gitignored copies).
- [ ] `cards:check`, `cards:count-markers:check`, `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`,
      `sim:coverage --check`, `sim:runtime-observed:check`, `roadmap:counts:check`, `ledger:numbers:check` all exit 0.
- [ ] Game-engine and dashboard suites 0 fail; `git diff --name-only` ⊆ Files to Produce + governance.
- [ ] STATUS.md; DECISIONS.md D-24787 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap `✅`.
- [ ] Two-commit topology: `EC-889:` implementation, then `SPEC:` governance close.
- [ ] D-24026 live-verify operator-pending (Bishop after a Covert Hero opens the hand+discard KO prompt).

## Common Failure Smells

- A hook with `unresolvedMarkers` after regen → token typo, or an excluded line got marked.
- `cards:check` fails → a line was hand-edited; re-run the apply script.
- A `hero-ability-markers.json` diff far over ~90 lines → the file was re-serialized; redo with targeted inserts.
- Gamora's KO fires on play with 0 draws → the `[keyword:draw-threshold:2]` entry is missing.
- Ledger rows still show a blank WP / decision → the provenance row is missing.
