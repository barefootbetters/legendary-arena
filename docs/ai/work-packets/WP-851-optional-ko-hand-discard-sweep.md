# WP-851 — Bare "You may KO a card from your hand or discard pile." executes (marker-only sweep)

**User-Visible Surface:** play.legendary-arena.com (in-match hero ability)

## Goal

After this session, the bare hero clause *"You may KO a card from your hand or
discard pile."* (no reward attached) opens the existing optional-KO prompt on
**11 more hero lines across 9 sets**, wherever its gate already executes. The
operator's case is `dkcy/bishop/whatever-the-cost` ("[hc:covert]: You may KO a
card from your hand or discard pile."): today the line has no effect, so every
play logs "Its effect is not supported yet" (match `Ps0Hg_m5B-H`, 2026-10-28, log
lines 186 / 259 / 373). After this WP, a Bishop played after another Covert Hero
parks the hand-or-discard KO choice, and a Bishop played without one draws its card
and logs that its KO ability did not activate because "it needs another Covert Hero
played this turn", with no "not supported yet" tail. The fix is **marker-only**: the
no-reward keyword `optional-ko-hand-discard` (WP-667 / D-24480) already exists,
already runs on three cards, and already reuses the shared optional-KO pending
queue, prompt, and resolve move. No new engine handler, no new keyword.

## Assumes

- **WP-667 / D-24480 is on `main`.** `optional-ko-hand-discard` is in
  `HERO_KEYWORDS` (`packages/game-engine/src/rules/heroKeywords.ts`) and in
  `NO_MAGNITUDE_KEYWORDS`. `heroEffectOptionalKoHandDiscard`
  (`hero/heroEffects.execute.ts`) parks `{ rewardType: 'none', rewardMagnitude: 0,
  koZones: ['hand','discard'] }` on `G.pendingOptionalKoRewards`, and logs a no-op
  when hand and discard are both empty. `resolveOptionalKoReward` and
  `OptionalKoRewardPrompt.vue` already handle the no-reward, hand-plus-discard form.
  It is live on `vnom/venom-rocket/serious-overkill`, `wwhk/she-hulk/radioactive-riot`
  and `xmen/x-23/bioengineered-assassin`.
- **Every in-scope gate already resolves to an executable condition.** `[hc:X]:` →
  `heroClassMatch`, `[team:X]:` → `requiresTeam` (WP-179). `[keyword:Antics]` →
  `cheapOrSizeChangingAtLeast:3` and `[keyword:Outwit]` → `distinctHeroCostsAtLeast:3`
  (WP-653 / D-24464). `[keyword:draw-threshold:2]` → `cardsDrawnThisTurnAtLeast:2`
  (WP-665 / D-24476), a wait-and-see whole-turn gate (D-24377). All are branches in
  `setup/heroAbility.setup.ts`. The ledger shows `antics`, `outwit` and
  `draw-threshold` as `condition`.
- **`apply-hero-ability-markers.mjs` appends several tokens to one line, in map
  order** (the WP-667 Radioactive Riot and WP-722 precedent). Both token forms
  (`[keyword:optional-ko-hand-discard]`, `[keyword:draw-threshold:N]`) already pass
  `VALID_TOKEN_PATTERN`, so no script change is needed.
- **Baseline:** `origin/main` @ `452956c5` (includes the #3074 WP-850 reserve and the
  #3075 WP-851 / EC-889 / D-24787 reserve). Parallel WP-850 (Bishop Firepower from the
  Future, a different card) also edits the dkcy marker array, `dkcy.json`, the hero ledger,
  the runtime-observed feed and the dashboard pin, so whichever lands second re-derives
  the feed numbers (see the regen-shape constraint).

## Context (Read First)

- `docs/ai/DECISIONS.md`: **D-24480** (the reused no-reward keyword); **D-24464**
  (Antics / Outwit conditions); **D-24476** + **D-24377** (draw-threshold, wait-and-see);
  **D-24606** (Focus has no handler); **D-24019** (the rewarded `optional-ko-reward`
  sibling, not used here).
- `docs/ai/REFERENCE/00.2-data-requirements.md`: the card ability field names.
- `.claude/rules/architecture.md`: the Rule Execution Pipeline, and the guardrail
  against parallel trigger contracts (the reason a new handler is out of scope).
- `scripts/convert-cards/inputs/hero-ability-markers.json` + `apply-hero-ability-markers.mjs`.
- `packages/game-engine/src/hero/ca75OptionalKoShield.test.ts`: the primary test pattern.
  It reads the committed `data/cards/*.json`, drives `executeHeroEffects` and
  `resolveOptionalKoReward`, and its `makeState` seeds `cardTraits` for a prior same-class
  Hero. `returnOnDiscardReprints.test.ts` (7be98ad9) is a secondary example.

### Why one WP, marker-only

The brief asked whether the no-reward form can reuse the `optional-ko-reward`
handler or needs a new keyword. It needs neither. A dedicated no-reward keyword was
built for Radioactive Riot (WP-667) with exactly this printed text and zones. The
gap is curation: three cards carry the marker, and the other copies of the same
clause were never swept. One layer (card data plus an engine test), no contract
file, no `01.6` trigger.

### Corpus scan (every hero line containing the clause)

A scan of `data/cards/*.json` hero `abilities[]` for "you may KO a card from your
hand or discard pile" finds 35 lines (11 in scope, 3 already marked, 13 excluded, 8 variants). The draft session's scaffold appended the
marker in a scratch copy and parsed every candidate through the real
`buildHeroAbilityHooks`. That probe produced the gate column below.

**In scope: 11 lines, 12 tokens.**

| # | Card (`set/hero/card`) | idx | Printed gate | Parsed condition |
|---|---|---|---|---|
| 1 | `amwp/ant-man/bug-swarm` | 1 | `[keyword:Antics]:` | `cheapOrSizeChangingAtLeast:3` |
| 2 | `asrd/warriors-three-the/hogun-the-grim` | 0 | `[hc:strength]:` | `heroClassMatch:strength` |
| 3 | `chmp/ms-marvel/need-to-stretch-my-legs` | 1 | `[team:champions]:` | `requiresTeam:champions` |
| 4 | `cvwr/storm-black-panther/tsunami-of-justice` | 0 | `[hc:covert]:` | `heroClassMatch:covert` |
| 5 | `dead/stingray/phd-in-oceanography` | 0 | none | (none) |
| 6 | `dkcy/bishop/whatever-the-cost` | 1 | `[hc:covert]:` | `heroClassMatch:covert` |
| 7 | `dkcy/professor-x/class-dismissed` | 1 | `[hc:instinct]:` | `heroClassMatch:instinct` |
| 8 | `dkcy/wolverine/no-mercy` | 1 | none | (none) |
| 9 | `mgtg/gamora/stolen-necroblaster` | 0 | "If you drew at least two cards this turn," | `cardsDrawnThisTurnAtLeast:2` (via `[keyword:draw-threshold:2]`) |
| 10 | `wwhk/caiera/focus-the-old-power` | 0 | `[keyword:Outwit]:` | `distinctHeroCostsAtLeast:3` |
| 11 | `xmen/phoenix/life-death-incarnate` | 1 | none | (none) |

Each parses to `effects: [{ type: 'optional-ko-hand-discard' }]` with no
`unresolvedMarkers`.

**Already marked (3, untouched):** `vnom/venom-rocket/serious-overkill`,
`wwhk/she-hulk/radioactive-riot`, `xmen/x-23/bioengineered-assassin`.

**Excluded: gate mechanic not implemented (13 lines).** The probe shows why these
must stay unmarked. When the gate token is dropped or left unresolved, the marked
KO fires on every play, which is a phantom grant and worse than today's honest hollow.

| Card | idx | Gate | Probe result if marked |
|---|---|---|---|
| `anni/super-skrull/transparent-motives` | 1 | Focus (D-24606: no Focus handler) | ungated KO, `focus` unresolved |
| `anni/fantastic-four-united/invisible-woman` | 1 | Focus + compound rescue (already `_deferred`) | n/a |
| `ff04/invisible-woman/disappearing-act` | 0 | Focus | ungated KO, `focus` unresolved |
| `wtif/star-lord-tchalla/unexpected-exit` | 0 | What If...? (`what-if` unsupported) | gate dropped, ungated KO |
| `wtif/uatu-the-watcher/another-dimension-crumbles` | 0 | What If...? | gate dropped, ungated KO |
| `msis/bruce-banner/burst-of-rage` | 0 | Sacrifice (unsupported) + compound +3 Attack | KO and +3 under `sacrifice` unresolved |
| `msis/wanda-vision/we-have-to-destroy-it` | 0 | Sacrifice + compound +3 Recruit | same class |
| `msis/wanda-vision/let-go` | 0 | Sacrifice + compound draw 3 | same class |
| `msmc/multiple-man/reabsorb-duplicates` | 0 | Tactical Formation (unsupported) | gate dropped, ungated KO |
| `ssw2/captain-and-the-devil-the/feeding-grounds` | 0 | Patrol the Streets, hero form (unsupported) | gate dropped, ungated KO |
| `bkpt/white-wolf/command-the-hatut-zeraze` | 1 | "If any Villain or Mastermind has any Wounds" (unsupported) | team gate kept, Wounds gate dropped |
| `asrd/lady-sif/golden-apples-of-idunn` | 0 | Thrown Artifact (unsupported) + compound +4 Attack | n/a |
| `smhc/happy-hogan/watchful-eye` | 0 | Danger Sense (unsupported) + compound KO-the-Strikes | n/a |

**Not this clause (rewarded or scaled variants, out of scope):**
`3dtc|msp1/black-widow/dangerous-rescue` (rescue reward, hand-or-discard only; the
core copy's marker uses the wider D-24442 zone set, so these reprints need a
zone-scope decision before they can be marked), `co2e/thor/spark-of-the-divine`
(+3 Attack), `cosm/phyla-vell/avatar-of-oblivion` and `gotg/groot/prune-the-growths`
(Shards), `ssw1/old-man-logan/last-survivor` (draw if a Wound), `vill/enchantress/soul-sacrifice`
(Recruit equal to cost), and `vill/loki/all-humans-are-expendable` (New Recruit).

### Scaffold (observed at draft, then reverted)

The draft session ran the change end to end against the baseline with a freshly
built `registry` + `game-engine` dist:

- `apply-hero-ability-markers.mjs`: `Updated: 12 lines`, `Skipped: 398`. Nine set files
  changed (`amwp, asrd, chmp, cvwr, dead, dkcy, mgtg, wwhk, xmen`), with dkcy carrying 3 lines.
- `cards:check` passed (clean regen reproduces). `sim:coverage --check` passed.
  `effect-index:check` and `mechanics:metadata:check` passed only because they ran against
  the pre-regen ledger. Both mirror hero-ledger rows (including wp / decision), so both go
  stale once `ledger:heroes` is regenerated, and both are regenerated in scope (pre-flight PS-2).
- `ledger:heroes:check` went **stale**. The regen adds 11 `optional-ko-hand-discard,executable`
  rows plus `mgtg/gamora,draw-threshold,condition`, and replaces `dkcy/professor-x`'s
  `(unmarked)` row.
- `sim:runtime-observed:check` went **stale**. The regen moves `totalObservations` 7765 → 7743
  (−22), drops `gate-only` 439 → 411 (−28, these lines), keeps `distinctMechanics` at 78 and
  `dropped` at 0, with ±1–2 trajectory ripples elsewhere.
- The dashboard in-play pin (`apps/dashboard/src/composables/useInPlayCoverage.test.ts`,
  the "real committed seed + ledger" test) went **red**: `totalObs` 8686 → 8662.
  `resolvedObs` holds at 1091 and `percentResolved` holds at 12.6. This is a denominator
  re-pin of the kind recorded in that test's history. The pin falls 24 while the raw feed falls
  22, because `totalObs` sums per-mechanic max(baseline, live) peaks rather than the raw total.
  The dashboard reads gitignored copies in `apps/dashboard/src/data/`, which only
  `prebuild:coverage` refreshes, so that runs before the dashboard test.
- Game-engine suite: **6031 / 0**. No sentinel or `finalStateHash` moved.

The same probe surfaced a papercut: `scripts/coverage/mechanic-provenance.json` has
no `optional-ko-hand-discard` row, so all of the mechanic's ledger rows (the 3 existing
and the 11 new) print a blank WP / decision. It is in scope (one line, same mechanic).

## Scope (In)

1. `hero-ability-markers.json`: add **12 apply entries** (the 11 lines; Gamora
   gets `[keyword:draw-threshold:2]` then `[keyword:optional-ko-hand-discard]`, in that
   order), appended to each set's existing array. Add **one `_notes` line** recording the
   sweep, the in-scope list, and the 13 excluded lines with their gates (the D-24620
   sweep-note precedent).
2. Run `apply-hero-ability-markers.mjs` to regenerate the 9 `data/cards/*.json` files.
3. `scripts/coverage/mechanic-provenance.json`: add
   `"optional-ko-hand-discard": { "wp": "WP-667", "decision": "D-24480" }`.
4. Regenerate `ledger:heroes` (json + csv), `effect-index`, `mechanics:metadata` and
   `sim:runtime-observed`. Re-pin the dashboard
   in-play `totalObs` with a dated history comment (the test's existing convention).
5. Add one focused engine test, `packages/game-engine/src/hero/optionalKoHandDiscardSweep.test.ts`,
   that parses the real marked lines and drives Bishop's gate both ways.

## Out of Scope

- **No new engine handler, keyword, condition type, drift-array change, or
  `packages/game-engine/src/**` source edit** other than the new test. The mechanism exists.
- **The 13 excluded lines** stay unmarked until their gate mechanic (Focus, What If...?,
  Sacrifice, Tactical Formation, Patrol the Streets hero form, Villain-has-Wounds, Thrown
  Artifact, Danger Sense) ships. Each is that mechanic's own WP.
- **The rewarded and scaled variants** listed above, including the 3dtc/msp1 Dangerous
  Rescue reprints (a zone-scope question for a follow-up).
- **No arena-client change.** `OptionalKoRewardPrompt.vue` already renders the no-reward
  hand-plus-discard form (WP-667).
- **Unrelated hollows on the same cards** (Ant-Man `microscopic-size-changing`, Ms. Marvel
  `cheering-crowds`, Phoenix `KO this card.`, Professor X's HQ-bottom line) are not touched.

## Files Expected to Change

- `scripts/convert-cards/inputs/hero-ability-markers.json`: modified. +12 apply entries, +1 `_notes` line.
- `data/cards/amwp.json`, `asrd.json`, `chmp.json`, `cvwr.json`, `dead.json`, `dkcy.json`,
  `mgtg.json`, `wwhk.json`, `xmen.json`: modified (generated by the apply script).
- `scripts/coverage/mechanic-provenance.json`: modified. +1 provenance row.
- `docs/ai/coverage/hero-mechanic-ledger.json` / `.csv`: modified (generated).
- `docs/ai/coverage/runtime-observed-hollows.json`: modified (generated).
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts`: modified. `totalObs` re-pin
  plus a history comment.
- `packages/game-engine/src/hero/optionalKoHandDiscardSweep.test.ts`: new.
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`:
  modified (generated from the regenerated ledger).
- Governance: `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/DECISIONS.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/STATUS.md`.

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new or modified authored file. No diffs, no snippets.
- ESM only, Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- Marker-only plus regen. If any line appears to need an engine handler, STOP: the WP is mis-scoped.
- Card data is **regenerated, not hand-edited**. Run the apply script and never type a marker
  into `data/cards/*.json`. Edit `hero-ability-markers.json` with targeted inserts that keep the
  existing key order and line endings. Do **not** round-trip it through `JSON.stringify`: the
  scaffold showed that reorders the `"2099"` key ahead of `_notes`.
- Never mark an excluded line. A marker whose gate the parser drops is a phantom grant (D-24787).
- No `Math.random()`. `finalStateHash` and every sentinel stay byte-unchanged (the scaffold
  observed none move). If one moves, STOP.
- The runtime-observed and dashboard re-pins are behavior-driven refreshes. Their diff must
  match the scaffold's deltas: raw `totalObservations` −22, `gate-only` −28, dashboard
  `totalObs` −24, `resolvedObs` and `distinctMechanics` held, `dropped` 0. If a feed-moving PR
  (for example WP-850) lands first, re-derive the deltas by regenerating on the new baseline
  with and without this WP's markers. An unexplained mechanic loss is a STOP.
- Test: `node:test` + `node:assert` only. No `boardgame.io` import, no network or DB.

**Session protocol:** stop and ask on any unclear item, and never guess a marker form.

**Locked contract values:**
- Token: `[keyword:optional-ko-hand-discard]`. Gamora also gets `[keyword:draw-threshold:2]`,
  placed first.
- Bishop marked line: `[hc:covert]: You may KO a card from your hand or discard pile. [keyword:optional-ko-hand-discard]`
- Gamora marked line: `If you drew at least two cards this turn, you may KO a card from your hand or discard pile. [keyword:draw-threshold:2] [keyword:optional-ko-hand-discard]`
- Parsed hook for each of the 11: `effects: [{ type: 'optional-ko-hand-discard' }]`, the
  condition from the in-scope table (none for #5, #8, #11), and no `unresolvedMarkers`.
- Parked entry: `{ rewardType: 'none', rewardMagnitude: 0, koZones: ['hand','discard'] }`.
- Provenance row: `"optional-ko-hand-discard": { "wp": "WP-667", "decision": "D-24480" }`.

## Acceptance Criteria

1. `hero-ability-markers.json` holds the 12 apply entries and the sweep `_notes` line. The
   diff touches nothing else (no key reorder).
2. The 11 lines in `data/cards/*.json` read exactly as their printed text plus the token(s);
   the Bishop and Gamora lines match the Locked values. `cards:check` exits 0.
3. The new test asserts the Locked hook shape for all 11 real cards (parsed from the
   committed data through `buildHeroAbilityHooks`).
4. Bishop played with **no** prior Covert Hero parks nothing on `G.pendingOptionalKoRewards`.
5. Bishop played **after** a Covert Hero parks exactly one entry with the Locked parked shape.
6. Resolving that entry KOs the chosen hand or discard card. An in-play card is rejected
   (hand and discard only).
7. Gamora played with fewer than 2 cards drawn this turn parks nothing; it parks once the
   draw total reaches 2 (wait-and-see, D-24377). The test sets `G.turnEconomy.cardsDrawn` to 2
   and calls the exported `resolveDeferredHeroGrants`, which `turn.onMove` runs after every
   move. Hooks are selected by `effects[0].type === 'optional-ko-hand-discard'`, because
   several of these cards carry more than one hook.
8. `ledger:heroes:check`, `sim:runtime-observed:check`, `effect-index:check`,
   `mechanics:metadata:check`, `cards:count-markers:check`, `sim:coverage --check` all exit 0. The ledger's
   `optional-ko-hand-discard` rows show `WP-667,D-24480`.
9. The game-engine suite goes 6031 → 6031 + N / 0 fail (N = the tests in the new file, one
   `describe`), and the dashboard suite passes with 0 fail. No sentinel or `finalStateHash`
   is re-pinned.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/registry --filter @legendary-arena/game-engine build     # dist current
node scripts/convert-cards/apply-hero-ability-markers.mjs                                # Updated: 12 lines
node scripts/check-card-data-regen.mjs --check                                           # clean regen == committed
pnpm ledger:heroes; pnpm effect-index; pnpm mechanics:metadata; pnpm sim:runtime-observed  # regenerate the stale feeds
node --import tsx --test packages/game-engine/src/hero/optionalKoHandDiscardSweep.test.ts # all pass
pnpm --filter @legendary-arena/game-engine test                                          # 0 fail
pnpm --filter @legendary-arena/dashboard run prebuild:coverage                          # refresh the gitignored src/data copies the pin reads
pnpm --filter @legendary-arena/dashboard test                                            # 0 fail after the re-pin
pnpm -s ledger:heroes:check; pnpm -s effect-index:check; pnpm -s mechanics:metadata:check; pnpm -s cards:count-markers:check
node scripts/hero-effect-coverage.mjs --check                                            # exit 0
node scripts/runtime-observed-hollows.mjs --check                                        # exit 0
pnpm roadmap:counts:check; pnpm -s ledger:numbers:check                                  # exit 0
```

## Vision Alignment

**Vision clauses touched:** §1, §2, §10 (card data and content semantics: 11 hero
abilities now execute as printed); NG-1 (no pay-to-win).

**Conflict assertion:** No conflict. The cards execute their printed text, and nothing is
gated on payment or cosmetics.

**Non-Goal proximity check:** NG-1..7 are not crossed. These are free hero-deck abilities that
now work as printed, with no monetization, cosmetic, or paid surface.

**Determinism preservation:** deterministic and replay-faithful. The KO rides the existing
WP-667 pending queue, and no RNG source is added. `finalStateHash` is byte-unchanged (no
committed fixture plays these cards). The fixed-seed sweep artifact moves and is regenerated
(the behavior-driven refresh noted above). Old matches replay unchanged, because hooks live in
`initialState`.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `docs/ai/STATUS.md` updated with what changed.
- [ ] `docs/ai/DECISIONS.md` D-24787 landed (Active): mark a bare optional-KO line only when
      its gate resolves to an executable condition; a dropped or unresolved gate keeps it unmarked.
- [ ] `WORK_INDEX.md` WP-851 checked off; `EC_INDEX.md` row `Done`; mindmap node `✅`;
      `pnpm roadmap:counts:check` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] **Live-on-surface (D-24026):** operator-pending after deploy. In a real match on
      `play.legendary-arena.com`, Bishop's Whatever the Cost played after a Covert Hero opens
      the KO prompt (hand + discard). Played without one, it draws its card and logs that its KO
      ability needs another Covert Hero, with no "not supported yet" tail.

## Lint Gate Self-Review (00.3)

All 21 sections resolved:
- §1 structure: all sections present, including a non-empty `## Out of Scope`. PASS.
- §2 constraints: engine-wide, packet-specific, protocol, and locked values all present. PASS.
- §3 assumes: WP-667/D-24480, the gate conditions, multi-token apply support, and the baseline SHA. PASS.
- §4 context: 00.2, DECISIONS (by id), architecture.md, and the test precedent cited. PASS.
- §5 files: every file listed new/modified with a reason, including all five regenerated feeds. PASS.
- §6 naming: canonical card ids, keyword names, and condition type names, matching the parser. PASS.
- §7 dependencies: none added. PASS.
- §8 boundaries: registry data plus an engine test; no layer crossing, no server, client, or DB. PASS.
- §9 Windows: pwsh-compatible pnpm/node commands. PASS.
- §10 env: none. PASS.
- §11 auth: **N/A**, no authentication surface.
- §12 tests: `node:test`/`node:assert`, real parsed hooks, no boardgame.io, no network. PASS.
- §13 verification: exact commands with expected results. PASS.
- §14 acceptance: 9 binary, card-specific checks aligned to scope. PASS.
- §15 DoD: STATUS/DECISIONS/WORK_INDEX, scope boundary, `**User-Visible Surface:**`, D-24026 item. PASS.
- §16 code style: the test follows 00.6 (full words, JSDoc, `// why:`, no reduce, no nested ternaries). PASS.
- §17 vision: **triggered** (card content semantics); `## Vision Alignment` present with the determinism line. PASS.
- §18 grep-prose: no literal-string grep verification step next to forbidden-token prose. PASS.
- §19 bridge-staleness: re-checked against `origin/main` @ `452956c5` after #3075 merged; `ledger:numbers:check` passes. PASS.
- §20 funding: **N/A**, no funding surface.
- §21 API catalog: **N/A**, no HTTP endpoint and no `apps/server/src/**` function touched.

**Pre-flight verdict (01.4):** READY TO EXECUTE (2026-10-28, run as an independent subagent).
The first pass was conditional on three fixes, all now made:
- PS-1: the reservation was not yet on `main`. Fixed when #3075 merged and the branch rebased.
- PS-2: effect-index and card-mechanics were mislabeled conditional. They are now required outputs.
- PS-3: the dashboard `prebuild:coverage` step was missing before the test. It is added.

RS-1 to RS-5 (the test precedent, the AC7 mechanism, the locked test count, the delta-locked
regen shape, the corpus count) are folded in.

**Copilot check verdict (01.7):** PASS on re-run 2026-10-28 (disposition CONFIRM). The first pass was RISK, held for fixes. Five findings map to PS-1..3 and RS-2..4, and
all are fixed in this text: #12 (allowlist), #30 (pre-session governance), #11 (test invariants),
#4 (absolute numbers drift against WP-850) and #8 (local dashboard false-green). The remaining 25
modes PASS. Residual risk, documented: the feed and pin deltas are re-derived if WP-850 lands first.
