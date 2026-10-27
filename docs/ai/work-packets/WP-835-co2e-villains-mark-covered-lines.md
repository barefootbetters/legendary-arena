# WP-835 — co2e Villains and Henchmen: Mark the Timing Lines Existing Primitives Already Express

**User-Visible Surface:** `play.legendary-arena.com` — any match that uses a **co2e**
(Legendary Core 2nd edition) Villain or Henchman group. Twenty printed Ambush / Fight /
Escape lines that do nothing today start doing what the card says, by reusing villain-effect
primitives that already ship. **D-24026 live-verification applies** (operator-pending,
post-deploy).

**Lane:** Standard (two-session). Card data only, but it marks 20 lines across 6 groups and
locks one interpretation call (the KO-or-gift collapse and the Hand Ninjas "otherwise" gate),
so it is not lightweight-lane material (01.0a §Lightweight Lane, any ambiguity → standard).

## User-Visible Impact

A 2-player match on 2026-10-25 (`cfWSKCGr0ZL`) showed the co2e Brotherhood of Mutants firing
nothing: every Ambush / Fight / Escape line logged the D-24266 `unmarked-ability` `no-handler`
breadcrumb. Six of the seven in-scope co2e Villain groups have **zero** marked timing lines
and the seventh (Skulls) has one. WP-834 keeps the ranked gauntlet from filling out-of-set
slots with these groups, but a casual player who picks them still fights hollow villains.

This WP is the first slice of the co2e villain-fidelity epic (WP-835..840): the 20 lines whose
printed effect reduces **exactly** to an existing primitive get their `[effect:]` marker. The
other 24 hollow lines need new engine behavior and are scoped in WP-836..840 (§Out of Scope).

## Goal

Add curated `[effect:…]` markers to the 20 co2e timing lines listed in §Contract, flipping each
from `unmarked` to `executable` in the villain mechanic ledger, so fighting / revealing /
escaping those cards resolves the printed effect and logs it, with no `no-handler` breadcrumb.
Card data + regenerated coverage artifacts only. **No engine change, no new primitive, no test
change.** Locks **D-24768**.

## Assumes

- Baseline: `origin/main` @ `f260d148` plus the reserve commit for WP-835..840 / EC-873..878 /
  D-24768..24773 (PR #3010), or later. Working tree clean.
- **Every marker token below already parses** on this baseline. Draft-time scaffold
  (2026-10-25, throwaway worktree off `5e045fa9`, docs-only ahead of `f260d148`): the 23 tokens were added to a copy of the
  marker map, `apply-effect-markers.mjs` reported `co2e.json — 23 new marker(s)` and `0` for
  every other set, a second run reported `0` (idempotent), and `buildVillainAbilityHooks`
  over every co2e group produced the descriptors in §Contract with **no** `unresolvedMarkers`.
  With the regenerated data in place, `pnpm -r --no-bail test` exited 0 (game-engine
  5729 / 0 fail, arena-client 2437 / 0, server 1631 pass / 0 fail, every other package 0 fail),
  and `cards:check`, `mechanics:metadata:check`, `cards:count-markers:check`,
  `gauntlet:loadouts:check`, `gauntlet:configs:check`, `sim:runtime-observed:check` and
  `sim:coverage -- --check` stayed green with no regeneration. Only `ledger:villains` and
  `effect-index` went stale (regenerated; then green).
- Primitive owners (each line inherits its owning WP / decision; no new provenance row):
  `ko-hero` (WP-252 / D-24023, magnitude grammar WP-492 / D-24298, each-player split
  D-24669, "your Heroes" = hand + play D-24687), `gain-wound` `each-other` (D-24295),
  universal `@<space>` location gate (WP-489 / D-24295), `reveal-or-wound` (WP-469 /
  D-24281), `become-scheme-twist` (WP-481 / D-24287), `play-villain-deck-cards` (WP-542 /
  D-24351), `gain-wound-unless-victory-villain-group` (WP-494 / D-24299),
  `ko-heroes-current-count-by-trait` (WP-544 / D-24353), `capture-hq-hero` legacy keywords
  (WP-214 / D-21401), `gain-attached-hero` (WP-450 / D-24270; the award itself is the generic
  WP-431 `awardAttachedHeroes` at the fight site), `gain-recruit-current` (WP-541 / D-24350),
  `koHeroCurrentPlayer` / `koHeroEachPlayer` legacy keywords (WP-185 / WP-189).
- **Dynamic fight cost.** co2e Skrull Queen Veranke (`vAttack "2+"`) and Skrull Shapeshifter
  (`"1+"`) are dynamic villains; `resolveFightCost` (`economy/economy.resolve.ts`) returns the
  base plus the captured Hero's recruit cost, which is exactly the printed "+Attack equal to
  its cost". The capture marker is all that is missing.
- **The marker pipeline** — `scripts/convert-cards/apply-effect-markers.mjs` reads
  `scripts/convert-cards/inputs/villain-effect-markers.json` (`villains → co2e → <group> →
  <card> → { ambush?, fight?, escape? }`; `henchmen → co2e → <group> → { fight? }`) and appends
  each listed token (legacy keywords first in `VILLAIN_EFFECT_KEYWORDS` order, then
  parameterized tokens in list order) to the matched line of `data/cards/co2e.json`. The `co2e`
  villain block exists today (`masters-of-evil`, `skulls`); the `co2e` henchman block exists
  (`doombot-legion`).
- **D-24266** — the `unmarked-ability` breadcrumb these lines emit today; marking removes it.
- WP-834 (PR #3009, core-first gauntlet fill) is independent: it changes which groups the
  gauntlet picks, not what the cards do. Either order.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, §Registry Layer. Card-data curation,
  not engine work.
- `.claude/rules/*.md`; `.claude/skills/legendary-registry/SKILL.md`.
- Precedents: WP-520 (co2e Masters of Evil, the curatable-subset pattern), WP-533 (co2e Paibok
  twin), the `_notes` block of `villain-effect-markers.json` (conservatism over coverage).
- `docs/03-DATA-PIPELINE.md` §1 (regen order; `cards:check` excludes the hand-authored co2e
  but must stay green).
- The full 44-line inventory and the WP-835..840 split live in this WP's §Out of Scope table.
  `docs/ai/coverage/villain-mechanic-ledger.csv` lists every in-scope card as `unmarked` today.

**Split decision.** One card-data WP for every line the vocabulary already expresses, and one
engine WP per new-behavior family (WP-836 grey / trait-count effects, WP-837 each-player
discard and gated Ambushes, WP-838 captures, WP-839 City movement, WP-840 The Blob). Marking
here first closes 20 lines with zero engine risk; bundling a primitive would cross into the
engine layer.

## Scope (In)

1. `scripts/convert-cards/inputs/villain-effect-markers.json` — under `villains.co2e`, add the
   groups `brotherhood-of-mutants`, `hydra`, `radiation`, `sinister-spider-foes`,
   `sinister-syndicate`, and add three cards to the existing `skulls` group; under
   `henchmen.co2e`, add `hand-ninjas`. Exactly the rows in §Contract. Edit by hand, keeping the
   file's existing formatting (do not re-serialize the whole file). If a sibling packet landed
   first, its rows already sit in the same card objects (WP-837 Juggernaut / Mystique /
   Scorpion Ambush, WP-836 Beetle Fight, WP-838 / WP-839 HYDRA, Spider-Foes, Syndicate rows):
   merge into the existing objects, never replace them.
2. `data/cards/co2e.json` — regenerated by `apply-effect-markers.mjs`: 20 lines gain 23 markers.
3. Regenerated coverage: `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` (`pnpm
   ledger:villains`) and `data/metadata/effect-implementation-index.json` (`pnpm
   effect-index`). The scaffold showed these two are the only derived artifacts that go stale.

## Out of Scope

- **No engine change, no new primitive, no test change, no `mechanic-provenance.json` row.**
- **The 24 lines that need new behavior** (each owned by a drafted WP):

| Card (co2e) | Line | Why it is not here | WP |
|---|---|---|---|
| Destroyer | Ambush, Fight, Escape | grey / non-grey discard-pile KO filters | 836 |
| Frost Giant Warrior, Ymir | Fight | "you may KO a grey Hero from your discard pile" | 836 |
| Abomination | Fight | +1 Recruit per [hc:strength] Hero | 836 |
| Beetle | Fight | draw one card per [hc:covert] Hero | 836 |
| Savage Land Mutates (henchmen) | Fight | reveal deck top: grey → KO, Strength/Instinct → draw | 836 |
| Mystique | Ambush | each player discards an X-Men Hero (Ambush-timed choice) | 837 |
| Frost Giant Warrior | Ambush | discard a Ranged Hero or gain a Wound | 837 |
| Juggernaut | Ambush | discard cards named like HQ Heroes; HQ to the Hero Deck bottom | 837 |
| Scorpion | Ambush | Wounds only if another Spider-Foes Villain is in the City | 837 |
| The Leader | Ambush | reveal a Strength Hero or play a Villain Deck card | 837 |
| Enchantress | Ambush | capture a Bystander from each Victory Pile too | 838 |
| HYDRA Kidnappers | Ambush, Fight | capture an Officer / Sidekick; the Fight returns it | 838 |
| Venom | Ambush, Fight | capture a Sidekick + cheap HQ Heroes; gain one, rest to the bottom | 838 |
| Baron Strucker | Fight | shuffle four Bystanders into the Villain Deck, then play two | 838 |
| Green Goblin, Speed Demon, Ymir | Ambush | move to the Bridge / two extra spaces / re-enter from a Victory Pile | 839 |
| Boomerang | Fight | takes a revealed Villain's place on the Villain Deck | 839 |
| The Blob | Ambush | sits left of the Mastermind and blocks the Mastermind fight | 840 |

- **Variable-Attack passives.** Not timing lines, so they do not trip the D-24266 detector;
  they are the `resolveFightCost` mechanic class (Abomination's shipped in WP-815).
  WP-838 owns Venom's and Enchantress's (its captures would otherwise price them wrongly) and
  co2e Baron Zemo's "+1 per Bystander". Baron Strucker, Paibok, Super-Skrull ("+N Attack for
  each …") and Hydro-Man's location bonus ("+2 Attack in the Sewers and Bridge"; he fights for
  a flat 4 today) are owned by no WP in WP-835..840 — a follow-up.
- The `skulls` group slug (it holds Skrulls; a slug fix re-keys ext ids). Left alone.
- PAR: `data/par/profile/v1/**` covers Core groups only and is diagnostic (`authoritative:
  false`); seed PAR is not regenerated by this WP.

## Files Expected to Change

- `scripts/convert-cards/inputs/villain-effect-markers.json` (modified)
- `data/cards/co2e.json` (regenerated)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`
  (regenerated)
- `data/metadata/effect-implementation-index.json` (regenerated)
- Governance: `docs/ai/DECISIONS.md` (D-24768), `docs/ai/NUMBER-LEDGER.md` (LANDED note),
  `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## Contract

**The 23 markers on 20 lines (D-24768).** Group / card slugs are `data/cards/co2e.json`
verbatim. A list with two tokens appends both. The script emits legacy-keyword tokens first,
then parameterized tokens in list order; for every row here that is the listed order.

| # | Group / card | Timing | Tokens | Parsed descriptor (scaffold) |
|---|---|---|---|---|
| 1 | brotherhood-of-mutants / juggernaut | fight | `ko-hero:current:2` | ko-hero current, magnitude 2 |
| 2 | brotherhood-of-mutants / mystique | escape | `become-scheme-twist` | become-scheme-twist |
| 3 | brotherhood-of-mutants / sabretooth | ambush | `reveal-or-wound:hc:instinct` | reveal-or-wound hero-class instinct |
| 4 | brotherhood-of-mutants / sabretooth | escape | `reveal-or-wound:hc:instinct` | same |
| 5 | hydra / endless-armies-of-hydra | fight | `koHeroEachPlayer`, `play-villain-deck-cards:2` | ko-hero each ×1; play-villain-deck-cards 2 |
| 6 | hydra / viper | fight | `gain-wound-unless-victory-villain-group:hydra` | victoryVillainGroup hydra |
| 7 | hydra / viper | escape | `gain-wound-unless-victory-villain-group:hydra` | same |
| 8 | radiation / maestro-wasteland-hulk | fight | `ko-heroes-current-count-by-trait:hc:strength` | count-by-trait hero-class strength |
| 9 | radiation / zzzax | fight | `reveal-or-wound:hc:strength` | reveal-or-wound hero-class strength |
| 10 | radiation / zzzax | escape | `reveal-or-wound:hc:strength` | same |
| 11 | sinister-spider-foes / scorpion | fight | `koHeroCurrentPlayer` | ko-hero current |
| 12 | sinister-spider-foes / the-lizard | fight | `ko-hero:current@sewers`, `gain-wound:each-other@sewers` | both gated `requireCitySpaces: [sewers]` |
| 13 | sinister-syndicate / beetle | escape | `reveal-or-wound:hc:covert` | reveal-or-wound hero-class covert |
| 14 | sinister-syndicate / hydro-man | fight | `ko-hero:current@sewers+bridge` | ko-hero current, gated sewers + bridge |
| 15 | skulls / skrull-queen-veranke | ambush | `captureHqHeroHighestCost` | capture-hq-hero highest-cost |
| 16 | skulls / skrull-queen-veranke | fight | `gain-attached-hero` | gain-attached-hero |
| 17 | skulls / skrull-shapeshifter | ambush | `captureHqHeroRightmost` | capture-hq-hero rightmost |
| 18 | skulls / skrull-shapeshifter | fight | `gain-attached-hero` | gain-attached-hero |
| 19 | skulls / super-skrull | fight | `koHeroCurrentPlayer` | ko-hero current |
| 20 | henchmen hand-ninjas | fight | `ko-hero:current@sewers+rooftops`, `gain-recruit-current:1@bank+streets+bridge` | KO gated sewers + rooftops; +1 Recruit gated bank + streets + bridge |

**Locked interpretations (D-24768):**

- **Magnitude 1 is the bare form.** "KO one of your Heroes" is `koHeroCurrentPlayer` /
  `ko-hero:current` (never `ko-hero:current:1`, which the parser rejects per D-24298).
  Juggernaut's "KO two" is `ko-hero:current:2`.
- **KO-or-gift collapses to the gift.** Veranke / Shapeshifter "Either KO that Hero or choose
  a player to gain it" resolve as the fighting player gains it, via the generic
  `awardAttachedHeroes`; the same co-op-dominant collapse D-24335 locked for co2e Ultron's
  Fight. `gain-attached-hero` exists only to classify the line as handled (D-24270).
- **Hand Ninjas "Otherwise".** The complement of Sewers + Rooftops is the three remaining
  named spaces (Bank, Streets, Bridge), expressed with the existing `@` gate. Residual: an
  unnamed sixth City space (only in a City resized by WP-831 / WP-832) satisfies neither gate,
  so a Hand Ninjas fought there does nothing. Documented, not fixed here.
- **Endless Armies ordering.** The each-player KO runs in the executor and the two Villain
  Deck plays fire afterwards from the `fightVillain.ts` fire site (D-24351). When the current
  player has a real KO choice it parks (D-24669) and resolves after the two cards are played;
  the other players' KOs happen first. This is the existing pending-choice ordering; accepted.
- **Viper** uses group slug `hydra`. The handler builds its match prefix from the fought
  card's own set (`${setAbbr}-villain-hydra-`, D-24299 Path B), so co2e Viper counts only
  **co2e** HYDRA Villains as "another HYDRA Villain". Residual: in a match that mixes Core
  and co2e HYDRA, a Core HYDRA Villain in a Victory Pile does not spare its holder.
  Accepted (a mixed same-name group match is rare); not changed here.

**Determinism.** Adding markers changes the setup-built `villainAbilityHooks` for any match
whose config includes these co2e groups. At execution, confirm no hashed oracle
(`finalStateHash` via `record-game-fixture.mjs`, `PRE_WP080_HASH` in
`replay.execute.test.ts`, the sentinel replay fixture) uses an in-scope co2e group; the
draft-time grep found none (references exist only in gauntlet / PAR-key tests, which do not
hash card effects). If any hash shifts, re-record via the canonical tool, never hand-edit.
Setup-only change: stored matches replay from their bgio `initialState`, which already holds
the setup-built `villainAbilityHooks`, so pre-deploy matches play and replay exactly as
before; no migration. Only matches created after the deploy get the markers.

## Acceptance Criteria

1. `node scripts/convert-cards/apply-effect-markers.mjs` reports `co2e.json — 23 new
   marker(s)` and `0` for every other set; a second run reports `0`.
2. The 20 lines carry exactly the tokens in §Contract, in that order, and nothing else in
   `data/cards/co2e.json` changes.
3. `buildVillainAbilityHooks` over the co2e groups yields the §Contract descriptors with no
   `unresolvedMarkers` (checked by a throwaway probe or the setup suite; no test file added).
4. The regenerated villain ledger (one row per card × mechanic, not per line) removes 15
   `(unmarked)` rows and adds 20 `executable` rows (18 villain rows over 14 cards + 2 Hand
   Ninjas rows), each attributed to the owning primitive's WP / D (no new provenance row).
   The 13 cards whose lines are all out of scope, plus Savage Land Mutates, keep their
   `(unmarked)` row. The 4 mixed cards (Juggernaut, Mystique, Scorpion, Beetle) read
   `executable` while their remaining hollow line still logs the D-24266 breadcrumb and is
   owned by WP-837 (Juggernaut, Mystique, Scorpion Ambush) / WP-836 (Beetle Fight).
   Counts are for this packet landing first: for each of those 4 mixed cards already
   `executable` because WP-836 / WP-837 landed earlier, the removed count drops by one.
5. `pnpm -r build` exits 0; `pnpm -r --no-bail test` exits 0 with no test changed.
6. `pnpm cards:check`, `ledger:villains:check`, `effect-index:check`,
   `mechanics:metadata:check`, `cards:count-markers:check`, `gauntlet:loadouts:check`,
   `gauntlet:configs:check`, `sim:runtime-observed:check`, `sim:coverage -- --check`,
   `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`,
   `workindex:executed:check` all exit 0.
7. Hashed oracles unchanged (or re-recorded via the canonical tool, with the reason in the
   commit).

## Verification Steps

1. `node scripts/convert-cards/apply-effect-markers.mjs` → `co2e.json — 23 new marker(s)`; run
   again → `0 new`.
2. `pnpm ledger:villains` and `pnpm effect-index`; then `git diff --stat` shows only the
   §Files paths (revert any CRLF-only churn).
3. `pnpm -r build` → 0.
4. `pnpm -r --no-bail test` → 0 fail.
5. The gate list in Acceptance 6 → all 0.
6. `git diff docs/ai/coverage/villain-mechanic-ledger.csv` shows 15 `(unmarked)` rows
   removed and 20 `executable` rows added (18 villain + 2 co2e `henchman-hand-ninjas`); one
   fewer removed per mixed card WP-836 / WP-837 already flipped (AC 4).
7. Live-verify (D-24026, operator, post-deploy): a co2e match **created after the deploy**
   (an older match keeps its setup-time hooks) with Brotherhood of Mutants +
   HYDRA + Skulls (and Hand Ninjas; Radiation in a second match) — fight Juggernaut (KO two),
   let Sabretooth ambush (Instinct reveal-or-Wound), fight Endless Armies of HYDRA (each
   player KOs one Hero, then two Villain Deck cards play; the fighter's KO prompt may resolve
   after the plays — expected), fight Viper (Wound unless another co2e HYDRA Villain is in
   your Victory Pile), let a Skrull Shapeshifter capture and then fight it (gain the Hero;
   cost matched the capture), fight Hand Ninjas off Sewers/Rooftops (+1 Recruit) — each logs
   its effect and no `no-handler` breadcrumb appears. Fought on the Sewers or Rooftops, the
   Hand Ninjas "Otherwise" half logs that its location gate was not met; that is expected,
   not a bug.

## Definition of Done

- Every Acceptance Criterion passes and every Verification Step is green.
- Two-commit topology: `EC-873:` implementation + `SPEC:` governance close. D-24768 landed
  Active in `DECISIONS.md`; `STATUS.md` updated; `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done;
  mindmap `📝` → `✅` + `pnpm roadmap:counts:write`; NUMBER-LEDGER lines marked LANDED.
- `git diff --name-only` matches §Files Expected to Change.
- D-24026 live-verify recorded as operator-pending until the deploy is checked.

## Non-Negotiable Constraints

- Card data only. No `packages/**` source or test change. If a token fails to parse, or a line
  turns out not to reduce to its primitive, STOP: that line moves to the engine WP named in
  §Out of Scope; do not invent a token.
- Mark only the 20 lines in §Contract. Do not touch Core entries or any other set's block.
- Regenerate derived artifacts with their canonical scripts; commit only real diffs.
- **Engine-wide:** no engine change. ESM only, Node v22+; human-style code per
  `docs/ai/REFERENCE/00.6-code-style.md` (applies to any throwaway probe; no code is
  committed); full file contents for every modified file, no diffs, no snippets.
- **Session protocol:** stop and ask on any unclear item; never guess a token or an
  interpretation.
- Execution waits for Jeff's go (he merges execution PRs).

**Locked contract values:** see §Contract and `EC-873` Locked Values.

## Vision Alignment

- **Vision clauses touched:** §1, §2, §10 (faithful card behavior for a shipped set).
- **Conflict assertion:** No conflict: this WP preserves all touched clauses.
- **Non-Goal proximity check:** none of NG-1..7 crossed (no monetization surface, no
  pay-to-win; card-data fidelity only).
- **Determinism preservation:** no engine change; the only surface is the hashed
  `villainAbilityHooks` for a match including these co2e groups — none of the committed
  hashed oracles do (verify at execution). Replay compatibility: the hooks are built at setup
  and stored in bgio `initialState`, so pre-deploy matches play and replay exactly as before;
  live-verify uses a match created after the deploy.

## Gate Record (drafting session, 2026-10-25, independent subagents)

- **01.4 pre-flight:** NOT READY → two blocking text fixes (PS-1 Viper is set-scoped per
  D-24299 Path B; PS-2 ledger is card × mechanic, so 15 rows removed / 20 added) and
  clarifiers RS-1/2/3/5 applied → **READY TO EXECUTE** (reviewer: re-run not required for
  text-only fixes). Scaffold re-verified by the reviewer: 20 lines / 23 markers, no
  `unresolvedMarkers`, 10 gates green.
- **01.7 copilot:** **RISK** (scope-neutral): #28 replay-compatibility statement added
  (§Contract Determinism + Verification 7 "created after the deploy"); #30 AC4 owners and the
  token-order wording corrected. Accepted residuals: Hand Ninjas sixth-space gap; Viper
  mixed-set HYDRA; Endless Armies KO-choice ordering.
- **00.3 lint:** §2 FAIL (no 00.6 / ESM / session-protocol line) → fixed in §Non-Negotiable
  Constraints → PASS.

## Lint Gate Self-Review (00.3)

All 21 sections resolved at draft:

- **§1 Structure / §2 Constraints** — PASS: all required sections present; card-data-only
  constraints and the STOP rule are explicit.
- **§3 Assumes** — PASS: baseline SHA, every primitive owner cited to its WP / D, the scaffold
  evidence, the pipeline shape.
- **§4 Context** — PASS: ARCHITECTURE sections, precedents WP-520 / WP-533, pipeline doc.
- **§5 Files** — PASS: exact paths, each marked modified / regenerated; governance listed.
- **§6 Naming** — PASS: tokens and slugs verbatim from the parser grammar and `co2e.json`.
- **§7 Dependencies** — PASS: no hard dependency; WP-834 independent; no new npm package.
- **§8 Architecture** — PASS: Registry-layer card data only; no engine / server reach.
- **§9 Windows / §10 Env** — N/A: existing node / pnpm scripts only; no env var.
- **§11 Auth** — N/A: no auth surface.
- **§12 Test Quality** — PASS: no new test — every reused handler is already covered; the
  parse is proved by the scaffold probe and re-checked at execution.
- **§13 Verification** — PASS: exact commands with expected output (`23 new marker(s)`,
  idempotent re-run, gate exits).
- **§14 Acceptance** — PASS: 7 binary, observable items.
- **§15 / §15.1 Definition of Done** — PASS: governance close, `**User-Visible Surface:**` +
  `## User-Visible Impact`, D-24026 item present.
- **§16 Code Style** — N/A: no code; the JSON edit keeps the file's existing shape.
- **§17 Vision Alignment** — PASS: section present with clauses, conflict assertion, NG check,
  determinism line.
- **§18 Prose-vs-Grep** — PASS: no forbidden-token grep in Verification.
- **§19 Bridge staleness** — N/A.
- **§20 Funding Surface** — N/A: no funding UI.
- **§21 API Catalog** — N/A: no HTTP endpoint, no `apps/server/src/**` change.
