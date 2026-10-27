# WP-843 — co2e Crazed Rampage: Each Player Reveals Another Strength Hero or Gains a Wound (Game Engine + card data)

**Status:** Draft — pending execution
**Primary Layer:** Game Engine (+ card-data-derived feeds)
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

`co2e/hulk/crazed-rampage` prints *"Each player reveals another [hc:strength] Hero
or gains a Wound."* Today it does nothing. The setup parser reads the mid-sentence
`[hc:strength]` as a `heroClassMatch` **play-gate**, so the card logs *"did not
activate — it needs another Strength Hero played this turn"*; and when another
Strength Hero happened to be played first, the line still has no effect marker, so
the hollow-effects panel reports it `gate-only` / `parse-unrecognized`. After this WP
the gate is gone and the printed effect fires: every player who cannot reveal another
Strength Hero gains a Wound, and every player who can does not.

## User-Visible Impact

Playing co2e Crazed Rampage now wounds each player (including the player who played
it) who has no other Strength Hero to reveal, and the game log names each player who
gained a Wound, or says so when every player revealed. No more spurious "needs another Strength Hero" block, no
`gate-only` hollow on the panel. Core / 3dtc / msp1 Crazed Rampage (which print the
different line "Each player gains a Wound.") are untouched.

## Assumes

- **Baseline:** `origin/main` @ `7d6d82c39cd95e268d8cc8aa0b1a5e14b20a7a4f`
  (2026-10-26). Re-baseline at execution.
- **The mis-parse is real and observed live.** Match `27l38-Qb17h` (server
  `26cf298b`) and match `qj12dWK_y3v` (server `68ea7cea`, log at
  `C:\pcloud\matches\co2e\Magneto\Magneto-BankRobberyHostage-LOG-2p-hulk.txt`):
  11.2.7 / 15.2.5 / 29.2.2 `[blocked] … it needs another Strength Hero played this
  turn. Its effect is not supported yet.`; 21.2.9 / 30.2.4 `Unhandled effect
  observed: … declared a "gate-only" mechanic at onPlay, but no executable handler was
  reached (parse-unrecognized).` A draft-time probe of `buildHeroAbilityHooks` on the
  current line returned `keywords: ['conditional']`, `conditions: [{ type:
  'heroClassMatch', value: 'strength' }]`, `unresolvedMarkers: ['gate-only']`, no
  `effects`. ✅
- **Only one hero line in the corpus prints this shape.** A scan of every
  `data/cards/*.json` hero ability for `reveals? … or gains? a Wound` returns exactly
  `co2e/hulk/crazed-rampage` ability 0. `co2e.json` is hand-authored (CLAUDE.md §Card
  Data), so the marker is applied by `apply-hero-ability-markers.mjs` against
  `data/cards/co2e.json` like every other `co2e` entry in the curated map. ✅
- **No hero primitive expresses it today.** `gain-wound-each` (WP-364 / D-24156)
  wounds every player unconditionally; WP-364 / D-24156 explicitly deferred the
  hero "reveal-or-gain" wound forms as "two NEW keywords, never a loosening". The
  villain `reveal-or-wound` primitive (WP-469 / D-24281) is villain-layer
  (`villainEffects.execute.ts`) and has no "another" self-exclusion. ✅
- **The pieces to compose exist on `main`:**
  `tryResolveRevealFromHandCriterion` + the `lineHasRevealFromHand` Step 1a/1b
  suppression (`setup/heroAbility.setup.ts`, WP-659 / D-24470);
  `playerCanRevealMatch` (`hero/heroEffects.execute.ts`) — hand for every player,
  plus played-this-turn-and-still-in-play for the playing player, never the resolving
  card itself (D-24731, D-24692); `gainWoundWithOutcome` (`board/wounds.logic.js`, the
  Diving Block / Flying Shield Block chokepoint, WP-682 / WP-827) and
  `composeWoundOutcomeClause` as used by `heroEffectGainWound`. ✅
- **`HeroEffectDescriptor` already carries `revealCriterion?: InvestigateCriterion`**
  (`rules/heroAbility.types.ts`), and `type: HeroKeyword` — so the new effect needs no
  contract-file edit. ✅
- **The client already hides the marker.** `apps/arena-client/src/lib/abilityMarkers.ts`
  `isEngineOnlyKeyword` drops any lowercase hyphenated `[keyword:…]` slug. ✅
- **No migration.** Hero hooks are captured in a match's `initialState` at setup, so
  in-flight matches and stored replays keep the old gated hook; only matches created
  after the deploy get the new effect (memory `reference_setup_hook_change_replay_compat`).
- **Current lockstep pin values** (read again at execution — they go stale if another
  hero-keyword WP lands first): `HERO_KEYWORDS.length` = 83 at THREE sites —
  `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` (which also holds the
  ordered `expectedKeywords` array, last entry `'grant-out-of-time'`) and
  `setup/heroAbility.setup.test.ts` (count only, the X-Gene test);
  `Object.keys(HERO_EFFECT_HANDLERS).length` = 65 at both sites in
  `hero/heroEffects.execute.test.ts`.

## Context (Read First)

- `packages/game-engine/src/setup/heroAbility.setup.ts` — **AUTHORITATIVE for** Step
  1a/1b token→condition extraction, the reveal-from-hand criterion resolver and
  suppression, Step 2 keyword recognition, and the effect builder. The new marker's
  recognition, suppression and effect emission live here.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **AUTHORITATIVE for**
  `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`,
  `heroEffectRevealFromHand` / `playerCanRevealMatch` and `heroEffectGainWound`. The new
  handler lives here.
- `packages/game-engine/src/rules/heroKeywords.ts` — the `HeroKeyword` union +
  `HERO_KEYWORDS` array.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`) +
  `scripts/convert-cards/inputs/hero-ability-markers.json` (the curated `co2e` list).
- `scripts/coverage/mechanic-provenance.json` — fills the WP / Decision columns of the
  hero ledger row the new mechanic produces (WP-493 lesson).
- `docs/ai/ARCHITECTURE.md` §The Rule Execution Pipeline and §Layer Boundary — the
  hook/handler split this WP stays inside (engine-only, no layer crossing).
- `docs/ai/DECISIONS.md` — D-24156, D-24281, D-24470, D-24731 (precedents); the
  reserved **D-24777** below.
- Auto-memory `reference_hero_keyword_lockstep_sites` — the six lockstep sites a
  handler-bearing keyword touches (the NO_MAGNITUDE_KEYWORDS one is the silent miss).

## Design Rationale

**Lane.** Not the Lightweight Lane (D-24028): a new handler-bearing `HeroKeyword`
touches eight engine code/test files (criterion #2's ≤ 4 budget) and is a gameplay
surface (criterion #6). Standard two-session lane.

**Compose, don't rewrite.** The line is "reveal-from-hand's reveal check" + "gain-wound-
each's wound", inverted: the reveal *avoids* a Wound instead of earning a draw. So:

1. **Marker** `[keyword:reveal-or-gain-wound-each]` on the line. Single segment, no
   magnitude; the criterion is the co-located `[hc:strength]` token.
2. **Parser.** The reveal-from-hand criterion resolver accepts this marker too (the
   criterion read is identical — the line's first `[hc:X]` / `[team:X]`). Because the
   resolved criterion is what sets `lineHasRevealFromHand`, the existing Step 1a / 1b
   suppression drops the spurious `heroClassMatch` with **no new suppression flag**
   (the D-24530 family fix, by reuse). Step 2 pushes `reveal-or-gain-wound-each` only
   when the criterion resolves (Honest-Partial: no token → `unresolvedMarkers`), and the
   effect builder emits `{ type: 'reveal-or-gain-wound-each', revealCriterion }`. The
   Step 2 `reveal-from-hand` branch must keep keying on its own keyword, so a
   reveal-or-wound line never also emits a reveal-from-hand draw.
3. **Handler** `heroEffectRevealOrGainWoundEach`: for each player in
   `Object.keys(G.playerZones).sort()`, if `playerCanRevealMatch(...)` is true they
   reveal (no mutation); otherwise they gain one Wound through `gainWoundWithOutcome`
   (so Diving Block / Flying Shield Block still intercept), the empty-supply no-op is
   logged, and only the playing player's `turnEconomy.woundsDrawn` bumps.
4. **Auto-reveal (documented simplification, D-24281 precedent).** A player who can
   reveal always does. Rules v23 "Revealing a Card" (L3196-3200) lets a player decline
   and take the Wound, and co2e Hulk's own Don't Make Me Angry ("You may KO a Wound…")
   makes declining strictly better for a player with no other Wound to KO. A per-seat
   choice needs the multi-seat `pendingSeatChoice` wave and is deferred with D-24281's
   interactive choice. No pending choice, no UI.
5. **Seat order.** `Object.keys(G.playerZones).sort()` is the engine's each-player
   convention (D-24156 `gain-wound-each`, D-24281). It differs from rules v23 L2247
   ("start with the current player, then go clockwise") only in who misses the last
   Wound when the supply runs short, and in prompt / log order. Aligning every
   each-player loop is a separate follow-up, not this WP.

**"Another" is already right.** `playerCanRevealMatch` never counts the resolving card
(`resolvingCardId`), counts a second Crazed Rampage in hand, lets only the playing
player reveal a card played this turn (D-24731), and skips Out-of-Time cards (D-24692).
Effective class (Copy Powers, Size-Changing) comes through `playedCardMatchesRevealCriterion`.

**Determinism.** No RNG (top-of-pile Wound), no new `G` field, fixed seat order. The
marker only reaches real `co2e` Hulk games.

## Scope (In)

- **New `reveal-or-gain-wound-each` HeroKeyword** — union + `HERO_KEYWORDS` (append),
  `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`, `HERO_EFFECT_HANDLERS`, and the five
  runtime pins (three `HERO_KEYWORDS`-length pins + the `rules/heroAbility.setup.test.ts`
  order array, two handler-count pins).
- **Handler** `heroEffectRevealOrGainWoundEach` in `heroEffects.execute.ts`, reusing
  `playerCanRevealMatch`, `gainWoundWithOutcome`, `composeWoundOutcomeClause`,
  `formatCardRef`, `pushLog`.
- **Parser** (`heroAbility.setup.ts`): marker pattern; the criterion resolver accepts it;
  Step 2 Honest-Partial branch; effect-builder branch.
- **Card data**: `VALID_TOKEN_PATTERN` branch + the curated `co2e` entry
  (`hulk` / `crazed-rampage` / ability 0); `data/cards/co2e.json` regenerated by the pass.
- **Derived feeds**: `scripts/coverage/mechanic-provenance.json` key
  `reveal-or-gain-wound-each → { wp: WP-843, decision: D-24777 }`; regenerated hero
  ledger, effect index, mechanics metadata.
- **Tests** — new `hero/crazedRampage.revealOrGainWound.test.ts` (parser + handler, see
  ACs) and the lockstep pin bumps.

## Out of Scope

- Core / 3dtc / msp1 Crazed Rampage (`gain-wound-each`, different printed text).
- The villain `reveal-or-wound` primitive and any villain/mastermind line.
- The general mid-sentence-token extractor (Step 1a/1b) — only this marker's line.
- Any choose-to-take-the-Wound prompt (deferred simplification, Design Rationale 4).
- Rotating the each-player seat order to start at the current player (Design Rationale 5).
- Any `G.notableEvents` push — `strikeBlocked` is villain-threat-only; this handler only logs.
- Other co2e Hulk cards (Growing Rage's printed `Strength:` gate is a faithful gate;
  Hulk Smash! "You may gain a Wound" is a separate optional-wound line).
- `rules/heroAbility.types.ts` (no edit — the descriptor already carries the field). Its
  `revealCriterion` comment (L185-190, "Other keywords ignore it") goes stale; D-24777
  records that, and the next types-touching WP fixes the comment.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified**
- `packages/game-engine/src/rules/heroKeywords.test.ts` — **modified** (count pin)
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified**
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (count pin + `expectedKeywords` order array append)
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** (count pin only, the X-Gene test)
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified**
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** (handler-count pins)
- `packages/game-engine/src/hero/crazedRampage.revealOrGainWound.test.ts` — **new**
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** (`VALID_TOKEN_PATTERN` + `// why:`)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** (one `co2e` entry)
- `data/cards/co2e.json` — **regenerated** (one line)
- `scripts/coverage/mechanic-provenance.json` — **modified** (one key)
- `scripts/coverage/hero-effect-coverage.baseline.json` — **regenerated** via
  `pnpm sim:coverage --update-baseline`, after confirming the only delta is co2e
  `noEffect` −1 and no set's `executable` fell (memory `reference_sim_coverage_baseline_gate_distinct`)
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json` — **regenerated** (whichever show a real diff)
- Governance close: `docs/ai/DECISIONS.md` (D-24777), `docs/ai/STATUS.md`,
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED annotation),
  `docs/ai/coverage/live-verify.json` (live-verify record, or operator-pending)

Any file outside the EC allowlist is a FAIL unless amended inline per `01.0b`. The list
exceeds 00.3 §5's ~8-file guide only through the lockstep test pins and regenerated
feeds; the hand-written code is three engine files, one new test, and three script/data inputs.

## Non-Negotiable Constraints

> - Full file contents for every new or modified file — no diffs, no snippets; human-style
>   code per `docs/ai/REFERENCE/00.6-code-style.md`; ESM; Node v22+; no `.reduce()`; every
>   new function has JSDoc; full-sentence log/error text.
> - Determinism: no RNG, no wall-clock; fixed `Object.keys(G.playerZones).sort()` order;
>   moves never throw — the handler safe-skips a missing criterion / missing zones.
> - No new `G` field; `heroAbility.types.ts` byte-unchanged.
> - The new keyword joins all six lockstep sites (memory
>   `reference_hero_keyword_lockstep_sites`), each pin a **runtime** assertion (D-24372).
> - `data/cards/co2e.json` is regenerated by `apply-hero-ability-markers.mjs`, never
>   hand-edited; a re-run applies 0 new markers.
> - Marker-scoped: the suppression applies only to a line carrying the marker.
> - On any ambiguity the WP + EC do not resolve, STOP and surface it.

## Contract

- **Keyword** `reveal-or-gain-wound-each` (union + `HERO_KEYWORDS`, no magnitude).
- **Marker** `[keyword:reveal-or-gain-wound-each]`.
- **Effect** `{ type: 'reveal-or-gain-wound-each', revealCriterion: InvestigateCriterion }`.
- **Behaviour** per player in sorted seat order: can reveal another matching Hero
  (`playerCanRevealMatch`) → no change; else gain one Wound via `gainWoundWithOutcome`
  (empty supply → logged no-op). Auto-reveal, no pending choice.

## Vision Alignment

- **Vision clauses touched:** §1, §2, §22.
- **Conflict assertion:** No conflict — a printed hero ability fires faithfully where it
  did nothing; no RNG, no paid advantage (NG-1 untouched).
- **Non-Goal proximity check:** N/A — none of NG-1..7 crossed.
- **Determinism preservation:** no RNG, no `G` field, fixed seat order; hash oracles
  unchanged (no sentinel match plays co2e Hulk).

## Funding Surface Gate

§20 N/A — engine gameplay + card data; no funding affordance or copy.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint or server-reachable library function.

## Acceptance Criteria

- **AC-1** Parser: on a 1-copy synthetic registry (the `psychicLink.revealFromHand.test.ts`
  shape), the marked line yields one hook whose `effects` deep-equal
  `[{ type: 'reveal-or-gain-wound-each', revealCriterion: { kind: 'hero-class',
  heroClass: 'strength' } }]`, with **no** `heroClassMatch` / `requiresTeam` condition,
  no `gate-only` / `conditional`, and no `reveal-from-hand` effect.
- **AC-2** Honest-Partial: the marker on a line with no `[hc:X]` / `[team:X]` token
  emits no effect and records `reveal-or-gain-wound-each` in `unresolvedMarkers`.
- **AC-3** 2-player (the playing player is seat `0`): the playing player has no other Strength Hero (hand empty of
  Strength, only Crazed Rampage in play) and the other player holds a Strength Hero in
  hand → only the playing player gains a Wound (wound pile −1, their discard +1,
  `woundsDrawn` +1); the other player's zones are unchanged; and exactly one log line
  `Each player without another Strength Hero gained a Wound ({card}): Player 0.` with
  outcome `applied`, attributed to the resolving card id.
- **AC-4** "Another": a second Strength Hero **played earlier this turn** (still in play)
  lets the playing player avoid the Wound; the resolving Crazed Rampage alone does not;
  a Strength Hero in a **non-playing** player's play area does not count for them. A
  second Crazed Rampage copy counts as another Strength Hero, both in the playing
  player's hand and played earlier this turn. Fixtures use per-copy ids
  (`co2e/hulk/crazed-rampage#0` resolving, `#1` the other copy); a bare id shared by two
  copies is forbidden.
- **AC-5** Every player reveals → no Wound gained, one `blocked` "Every player revealed
  another Strength Hero…" line. Empty Wound supply with a player lacking a match → no
  throw, that player's empty-supply line is logged, no `woundsDrawn` bump, and the
  "Every player revealed" line is **absent** (the D-24686 bug class).
- **AC-6** A non-playing player who gains the Wound does **not** move the playing
  player's `turnEconomy.woundsDrawn`.
- **AC-7** Lockstep: the keyword is in the union, `HERO_KEYWORDS`, `HANDLED_KEYWORDS`,
  `NO_MAGNITUDE_KEYWORDS` and `HERO_EFFECT_HANDLERS`; all three `HERO_KEYWORDS`-length
  pins and both handler-count pins move +1 from their execution-time values; the
  `rules/heroAbility.setup.test.ts` order array gains the new value last. A behaviour test (AC-3) proves the handler is
  actually reached (the `NO_MAGNITUDE_KEYWORDS` silent-drop guard).
- **AC-8** Card data: `co2e.json` `hulk/crazed-rampage` ability 0 ends with
  ` [keyword:reveal-or-gain-wound-each]`; a pass re-run applies 0 markers; no other
  set changes.
- **AC-9** Determinism: no new `G` field; hash oracles / sentinels byte-unchanged;
  `sim:runtime-observed:check` and `sim:coverage --check` exit 0.
- **AC-10** Diving Block parity (the playing player, seat `0`, reveals another Strength
  Hero): a wounded non-playing player holding Diving Block gets a
  `G.pendingDivingBlockWounds` entry, and the line reads `Each player without another
  Strength Hero gains a Wound ({card}): Player 1 would gain a Wound — Diving Block can
  prevent it.` with outcome `applied` (fixture pattern: `villain/villainEffects.execute.test.ts`).

## Verification Steps

1. `pnpm -r build` exits 0; then `pnpm --filter @legendary-arena/game-engine test`
   exits 0 (record the pass-count delta).
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` reports one new `co2e`
   marker; a second run reports 0.
3. `pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata`, then
   `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`,
   `pnpm mechanics:metadata:check`, `pnpm cards:count-markers:check`,
   `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check` all exit 0.
4. `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` and
   `run prebuild:effect-index` (refresh the gitignored data copies), then
   `pnpm -r --no-bail test` — 0 failures across packages.
5. **Control run:** remove `'reveal-or-gain-wound-each'` from `NO_MAGNITUDE_KEYWORDS`
   only → AC-3 fails (no Wound lands); restore.
6. Probe `buildHeroAbilityHooks` on the regenerated `co2e/hulk` deck: Crazed Rampage's
   hook has the effect and no conditions.
7. `git diff --name-only` equals the EC allowlist; `git status` clean of CRLF-only churn.

## Definition of Done

- [ ] AC-1..AC-10 satisfied; Verification Steps green, including the control run.
- [ ] No files outside the finalised EC allowlist.
- [ ] `docs/ai/DECISIONS.md` **D-24777 Active** (text below).
- [ ] `docs/ai/STATUS.md` close-out line.
- [ ] **D-24026 live-on-surface:** a `play.legendary-arena.com` match created after the
      deploy plays co2e Crazed Rampage — once with no other Strength Hero (the playing
      player is wounded, no "needs another Strength Hero" block) and once with one (no
      Wound for them; other seats wounded per their hands); recorded in STATUS /
      DECISIONS and `docs/ai/coverage/live-verify.json`, or operator-pending.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`.

## Reserved Decision (lands at execution)

**D-24777 — co2e Crazed Rampage's "Each player reveals another [hc:strength] Hero or
gains a Wound" is a new hero keyword `reveal-or-gain-wound-each`.** Records: the live
root cause (the mid-sentence `[hc:strength]` became a `heroClassMatch` play-gate and the
line had no effect marker → blocked / `gate-only`); the fix reuses the reveal-from-hand
criterion resolver so the existing D-24470 suppression drops the spurious gate (the
D-24530 family, no new flag); the reveal check is `playerCanRevealMatch` (hand for every
player, plus played-this-turn for the playing player, never the resolving card —
D-24731 / D-24692); the Wound goes through `gainWoundWithOutcome` (Diving Block / Flying
Shield Block parity) with the empty-supply no-op logged; auto-reveal with no pending
choice as a documented simplification (rules v23 L3196-3200 allow declining; Don't Make
Me Angry makes it matter; deferred with D-24281's interactive choice); seat order
`Object.keys(G.playerZones).sort()`, the engine's each-player convention, not rules
L2247's current-player-first (follow-up); no `G` field, no contract-file change — the
`heroAbility.types.ts` `revealCriterion` comment ("Other keywords ignore it") is now
stale and is fixed on the next types-touching WP. Fulfils D-24156's "un-defer is a NEW keyword" clause
for this one hero reveal-or-gain form.

## Lint Gate Self-Review (00.3)

Completed at draft against all 21 sections, after both gates.

- **PASS:** §1 (every required section present; Out of Scope names seven exclusions);
  §2 (engine-wide full-file / no-diffs / ESM / Node v22 / `00.6` constraints, packet-specific
  determinism and lockstep constraints, session protocol, locked values in §Contract and
  the EC); §3 (dependencies WP-364 / WP-469 / WP-659 / WP-682 Done; every reused helper
  named with its file; no-migration stated); §5 (every file marked new / modified /
  regenerated with its change; the count above ~8 is justified under §Files); §6 (canonical
  names; no 00.2 field touched); §7 (no new dependency); §8 (engine-only; no `G` field,
  no RNG, no persistence); §9 (all commands are `pnpm` / `node`, no shell-specific syntax);
  §12 (`node:test`, no boardgame.io import, no network / DB; the control run is mandatory);
  §13 (exact commands, expected counts); §14 (ten binary ACs naming files, values and
  log text); §15 / §15.1 (STATUS, DECISIONS, WORK_INDEX, scope-boundary check;
  `play.legendary-arena.com` declared with a live-on-surface DoD item); §16 (`00.6` cited;
  duplicate-first label helper; no `.reduce()`); §17 (clauses §1 / §2 / §22, conflict
  assertion, NG check, determinism line); §19 (baseline SHA cited; re-baseline at execution).
- **§4:** Context is specific (files, ARCHITECTURE.md sections, D-entries). The card-data
  touch is a prose-marker append to one ability line, not a `00.2 §8.1` schema or field
  change, so 00.2 is not a required reference (the WP-659 disposition).
- **N/A, with reason:** §10 (no environment variables); §11 (no authentication);
  §18 (no literal-string forbidden-token grep step); §20 (engine gameplay and card data, no
  funding affordance or copy); §21 (no HTTP endpoint or server-reachable library function,
  per D-11804).

## Gate Record

- **01.4 pre-flight:** NOT READY → READY TO EXECUTE. PS-1: there are three
  `HERO_KEYWORDS`-length pins, not two, and the ordered `expectedKeywords` array lives in
  `rules/heroAbility.setup.test.ts`, which was off the allowlist. Folded in. RS-1 to RS-4
  folded: the empty-supply case never prints "Every player revealed"; a local title-case
  helper; dashboard prebuild before the workspace test run; AC-1 on a 1-copy registry.
  Re-flight confirmed all fixes landed correctly.
- **01.7 copilot:** RISK (HOLD) → PASS. Folded: auto-reveal recorded as a documented
  simplification (rules v23 L3196-3200); the sorted-keys seat order documented, with
  rotation to current-player-first as a follow-up; AC-10 for Diving Block; the
  second-copy case and per-copy ids in AC-4; the control run now removes the keyword
  from `NO_MAGNITUDE_KEYWORDS`, and tests dispatch through `executeSingleEffect`; log
  lines pinned with outcome and card attribution; the coverage baseline and
  `live-verify.json` added to the allowlist; the stale `heroAbility.types.ts` comment
  recorded; no `notableEvents` push; no migration. The re-run confirmed every fix.
- **00.3 lint:** self-review above, all 21 sections resolved.
