# WP-486 — Instant-Defeat-With-Bystander (Silent Sniper hero keyword)

**User-Visible Surface:** `play.legendary-arena.com` — playing **Silent Sniper**
(`core/msp1/3dtc black-widow/silent-sniper`) now actually *defeats* a Villain or the
Mastermind tactic that holds a Bystander, instead of playing as a vanilla +4-attack
card whose printed ability silently does nothing. **D-24026 live-verification applies**
(operator-pending: play Silent Sniper in a live match with a qualifying target present;
the defeat resolves — with a target prompt when ≥2 qualify — and the game log shows it).

## Goal

Implement Silent Sniper's currently-**unimplemented** printed ability, *"Defeat a Villain
or Mastermind that has a Bystander."*, by adding a new HERO effect keyword
`defeat-with-bystander`. When the card is played, it defeats — **without spending attack**
— one eligible target: a Villain in the city that has ≥1 captured Bystander attached, **or**
the Mastermind (its current tactic) when the Mastermind holds a captured Bystander. The
defeat reuses the existing villain / mastermind-tactic defeat path (victory-pile move +
onFight/onDefeat hooks + captured-Bystander rescue) — it does **not** re-implement it.
Target selection is **mandatory-if-able**: 0 eligible targets → a self-narrated no-op,
exactly 1 → auto-defeat (no prompt), ≥2 → an interactive `PendingDefeatChoice` the current
player resolves. Lands **D-24291**.

## User-Visible Impact

Silent Sniper stops being a hollow vanilla card. In a game where the Mastermind or a city
Villain is hoarding Bystanders (the common Loki / bystander-scheme case — see §Context),
playing Silent Sniper removes that target from the board for free and rescues its
Bystander(s), exactly as the card reads. Casual and gauntlet play both benefit; the gap
was surfaced by a live Magneto/Thor 2p game (2026-08-01) and corroborated by a Loki/Thor
2p game where Silent Sniper sat in the HQ against a Bystander-hoarding Loki and its ability
was invisible (no log line, no breadcrumb — see §Context).

## Assumes

- **On `origin/main` @ `169dc419`** (baseline; WP-486/EC-521/D-24291 reserved via the
  reserve-first ledger commit #1160). game-engine + registry card-data + arena-client
  build/test green.
- **The hero keyword vocabulary + marker pipeline exist and are the extension surface:**
  `HeroKeyword` union + `HERO_KEYWORDS` drift array (`packages/game-engine/src/rules/heroKeywords.ts`),
  `MVP_KEYWORDS` + `HERO_EFFECT_HANDLERS` (`packages/game-engine/src/hero/heroEffects.execute.ts`),
  and the marker generator `scripts/convert-cards/apply-hero-ability-markers.mjs`
  (`VALID_TOKEN_PATTERN`, line 59) authoring `[keyword:X]` markers from
  `scripts/convert-cards/inputs/hero-ability-markers.json` into `data/cards/*.json`
  (WP-485 / D-24290 is the most recent keyword-vocab precedent).
- **The pending-choice pattern exists end-to-end and is the template**, most recently
  `pendingReorderChoices` (WP-479 / D-24286) and `pendingScryKoChoices` (WP-470 / D-24282):
  a hashed FIFO `G.pending*Choices` field (lazily initialized, never persisted — snapshots
  stay counts-only), a `*.resolve.ts` move, a block-all guard at every action fire site, a
  `uiState.build.ts` projection with the **D-24011 private-pending filter**, a deterministic
  bot/sim default in `ai.legalMoves.ts`, and an arena-client prompt component. The full
  touch-site list is enumerated in §Files Expected to Change.
- **The defeat path exists** in `packages/game-engine/src/moves/fightVillain.ts` (villain
  → victory pile + `awardAttachedBystanders` + `awardAttachedHeroes` + `executeVillainAbilities`
  onFight) and `packages/game-engine/src/moves/fightMastermind.ts` (mastermind tactic defeat).
  This WP **reuses** that path from the hero-effect context; it does not duplicate the
  onFight/onDefeat hook execution.
- **`pending_choice_no_ux_freeze` invariant** — an engine block-all pending state without a
  matching UIState projection + client prompt hard-freezes the board; the projection, the
  prompt, and the gate ship **together** in this WP.

## Context (Read First)

**Why now:** Silent Sniper (`black-widow/silent-sniper`, reprinted in `core`, `msp1`, `3dtc`
— all three carry the identical plain text `"Defeat a Villain or Mastermind that has a
Bystander."` with no `[keyword:]` marker) has never been wired. Confirmed at every layer:
plain `abilities` text, no `hero-ability-markers.json` entry, no keyword in the vocabulary,
no `HERO_EFFECT_HANDLERS` handler, no hero-mechanic-ledger row. **Unmarked hero abilities
leave NO runtime breadcrumb** (unlike villain abilities, D-24266): the hero effect pipeline
only dispatches on a `[keyword:X]` marker, so an unmarked hero line is pure display data and
fails silently — which is exactly why the Loki/Thor 2p game log shows Silent Sniper loaded
into the HQ (image fetched) against a Loki repeatedly capturing Bystanders, yet no play-line
and no hollow record. The hero-mechanic ledger *also* cannot surface it: it groups by hero
`extId` and emits an `(unmarked)` row only when the hero has zero marked cards — Black Widow
has rescue/draw/attack-per-count/optional-ko-reward marked, so Silent Sniper's unmarked line
leaves no trace. Marking the card (the keyword + generator token) is therefore the WP's first
slice, not a separate "log" commit.

**Read before executing:** `docs/ai/ARCHITECTURE.md §Layer Boundary` (Game Engine owns effect
handlers + the defeat path; Registry card data is generated input; arena-client is read-only
projection + intent submission), `.claude/rules/code-style.md`,
`.claude/skills/legendary-game-engine/SKILL.md`, and the templates:
**WP-479 / EC-513** (`pendingReorderChoices` — the pending-choice vertical template) and
**WP-485 / EC-520** (the keyword-vocab + marker-generator extension pattern).

**Central design risk (executor must resolve, invariant locked below):** the defeat must
**reuse** the villain / mastermind-tactic defeat path, not re-implement onFight/onDefeat hook
execution or the Bystander/attached-hero award. The two fight moves (`fightVillain.ts`,
`fightMastermind.ts`) currently inline that logic. The executor extracts a shared
defeat-core helper both the fight moves and the new hero handler call (the defeat logic then
lives in exactly one place), OR invokes the existing path through a documented internal entry
— but MUST NOT duplicate the onFight/award sequence. This is the load-bearing scope decision;
it is why this is a full two-session-lane WP, not lightweight.

## Scope (In)

- **`packages/game-engine/src/rules/heroKeywords.ts`** — append `defeat-with-bystander` to the
  `HeroKeyword` union AND the `HERO_KEYWORDS` drift array (append-only; the drift test moves
  with it). Bare token, no magnitude.
- **`packages/game-engine/src/hero/heroEffects.execute.ts`** — add `defeat-with-bystander` to
  `MVP_KEYWORDS`, to `HANDLED_KEYWORDS`, AND a handler in `HERO_EFFECT_HANDLERS` (onPlay). The
  `HERO_EFFECT_HANDLERS`-keys-equal-`HANDLED_KEYWORDS` bidirectional drift test goes red unless
  BOTH are extended together. The handler builds the eligible-target set, then: 0 →
  self-narrated no-op; 1 → auto-defeat via the shared defeat path (no attack spend); ≥2 → park a
  `PendingDefeatChoice`.
- **`packages/game-engine/src/types.ts`** — add the hashed FIFO `pendingDefeatChoices?:
  PendingDefeatChoice[] | undefined` field + the `PendingDefeatChoice` shape (lazily
  initialized at the park site, never persisted — snapshots stay counts-only), mirroring
  `pendingReorderChoices`.
- **`packages/game-engine/src/moves/defeatChoice.resolve.ts` (+ `.test.ts`)** — the
  `resolveDefeatChoice` move: validates the chosen target is in the parked eligible set,
  **front-pops the pending entry, THEN** defeats the target via the shared path (so a nested
  onFight park lands behind it in FIFO). Mirrors `reorderChoice.resolve.ts`; it is **NOT** a
  `CORE_MOVE_NAME` (mirrors `resolveReorderChoice`). Registered in `game.ts` + `index.ts` +
  `coreMoves.impl.ts` and the move-set/count assertions in `game.test.ts` — the move count
  goes **24 → 25** (the WP-479 baseline was 23→24).
- **The shared defeat path — reused, NOT relocated (two asymmetric cores).** There are two
  distinct defeat sequences, and they differ: **villain** defeat (`fightVillain.ts`) = remove
  from city + `awardAttachedBystanders` (the `G.attachedBystanders` map, keyed by cardId) +
  `awardAttachedHeroes` + `executeVillainAbilities(..., 'onFight')` + `fightResolved`;
  **mastermind-tactic** defeat (`fightMastermind.ts`) = `defeatTopTactic` + rescue
  `G.mastermind.attachedBystanders` + `areAllTacticsDefeated`→endgame + `mastermindDefeated`,
  with **no** onFight dispatch. Prefer a **documented internal invocation** of the existing
  path over physically relocating the ~200-line bodies (caps blast radius; guarantees
  byte-identical fight behavior). The shared surface **excludes** `spendAttack` and
  `G.hasActedThisTurn` — both stay in the fight moves: Silent Sniper spends no attack and is a
  card *play* (it must not set the acted-this-turn flag that bars post-play healing).
- **Nested-pending ordering (a defeat is not a permutation).** A villain defeat fires
  `onFight` abilities that can park their OWN pending choice (KO-hero, scry-KO, capture-bystander)
  — the reorder template never does this. Lock: `resolveDefeatChoice` front-pops the
  `PendingDefeatChoice` entry **before** dispatching the defeat (so any nested park lands behind
  it in FIFO), and the onPlay exactly-1 auto-defeat path must correctly propagate a nested park
  (block-all stays consistent). A test asserts "defeat a villain whose onFight parks a KO-hero →
  both pendings resolve in order, no freeze."
- **Block-all guard** — a `hasPendingDefeatChoice(G)` guard added at **exactly the span the
  `hasPendingReorderChoice` guard occupies** (grep-authoritative): the 8 action-fire sites
  `fightVillain.ts`, `fightMastermind.ts`, `recruitHero.ts`, `healWounds.ts`, `dodgeCard.ts`,
  `playFromUndercover.ts`, `coreMoves.impl.ts`, `villainDeck.reveal.ts` — **NOT** the sibling
  `*.resolve.ts` moves (the reorder guard is in none of them). Mirror that span, do not
  blanket-guard all resolve moves.
- **`packages/game-engine/src/ui/uiState.build.ts` + `uiState.types.ts`** — project the
  pending defeat choice (eligible targets + prompt text) into UIState, applying the **D-24011
  private-pending filter** (only the choosing player sees it).
- **`packages/game-engine/src/simulation/ai.legalMoves.ts`** — a deterministic bot/sim default
  target pick so par/replay stay byte-identical.
- **arena-client** — a `PendingDefeatChoicePrompt.vue` component + wiring in `TurnActionBar.vue`,
  `useTurnActions.ts` (+ `.test.ts`), `PlayDesktop.vue`, `PlayMobile.vue` — mirroring
  `PendingReorderChoicePrompt.vue`.
- **`scripts/convert-cards/inputs/hero-ability-markers.json`** — add the
  `[keyword:defeat-with-bystander]` marker for `black-widow/silent-sniper` under `core`, `msp1`,
  and `3dtc`.
- **`scripts/convert-cards/apply-hero-ability-markers.mjs`** — extend `VALID_TOKEN_PATTERN`
  (line 59) to accept the single-segment `^\[keyword:defeat-with-bystander\]$` token form.
- **`data/cards/core.json` + `msp1.json` + `3dtc.json`** — regenerated by
  `apply-hero-ability-markers.mjs` (the three Silent Sniper lines gain the marker). Generated
  output, not hand-edited.
- **Card-data-derived CI feeds** — regenerate ALL: the hero mechanic ledger
  (`pnpm ledger:heroes`), the effect-implementation index (`pnpm effect-index`), and add the
  `defeat-with-bystander` → `{ wp: 'WP-486', decision: 'D-24291' }` entry to
  `scripts/coverage/mechanic-provenance.json` (see `feedback_card_data_derived_ci_gates`).
- **Tests** — handler cases (0/1/≥2 eligible; villain vs mastermind target; no attack spend;
  Bystander rescued on defeat) in `heroEffects.execute.test.ts`; `resolveDefeatChoice` move
  cases; drift assertions extended in the hero-keyword drift test; a move-registration update
  in `game.test.ts`; arena-client `useTurnActions.test.ts`.
- **`docs/ai/DECISIONS.md`** — land **D-24291**.

## Out of Scope

- **The markerless-hero-ability runtime breadcrumb** (the hero mirror of D-24266) — a real
  observability gap surfaced while diagnosing this, but its own follow-on. This WP closes the
  Silent Sniper gap by *marking* the card, not by adding the breadcrumb.
- Any other unimplemented hero ability; any villain-effect work; any change to the fight moves'
  **behavior** (the shared-core extraction is behavior-preserving).
- No new scheme/mastermind mechanics; no change to how Bystanders are captured/attached.
- No `ci.yml` change beyond what the regenerated card-data feeds already gate.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` (+ its drift test)
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ `.test.ts`)
- `packages/game-engine/src/types.ts` (`PendingDefeatChoice` + `pendingDefeatChoices`)
- `packages/game-engine/src/moves/defeatChoice.resolve.ts` (+ `.test.ts`)
- `packages/game-engine/src/moves/fightVillain.ts` + `fightMastermind.ts` (shared-core extraction + block-all guard)
- `packages/game-engine/src/moves/{recruitHero,healWounds,dodgeCard,playFromUndercover}.ts` + `coreMoves.impl.ts` + `villainDeck/villainDeck.reveal.ts` (block-all guard only — the exact `hasPendingReorderChoice` span; NOT the sibling `*.resolve.ts` moves)
- `packages/game-engine/src/game.ts` + `index.ts` + `game.test.ts` (move registration + move-set/count)
- `packages/game-engine/src/ui/uiState.build.ts` + `uiState.types.ts` (projection + D-24011 filter)
- `packages/game-engine/src/simulation/ai.legalMoves.ts` (deterministic default)
- `apps/arena-client/src/components/play/PendingDefeatChoicePrompt.vue` (new) + `TurnActionBar.vue` + `composables/useTurnActions.ts` (+ `.test.ts`) + `pages/PlayDesktop.vue` + `pages/PlayMobile.vue`
- `scripts/convert-cards/inputs/hero-ability-markers.json`
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`)
- `data/cards/core.json` + `msp1.json` + `3dtc.json` — regenerated (marker applied)
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` — regenerated (`pnpm ledger:heroes`, CI-gated)
- `data/metadata/effect-implementation-index.json` — regenerated (`pnpm effect-index`, CI-gated)
- `scripts/coverage/mechanic-provenance.json` — 1 new mechanic → WP-486 / D-24291
- `docs/ai/DECISIONS.md` — land D-24291

## Contract

> Full file contents (no diffs); ESM/Node v22+; `00.6`; game-engine imports Node built-ins
> only; handlers pure + deterministic (`for...of`, no `.reduce()`); the closed `HeroKeyword`
> union is append-only; markers authored in the inputs overlay and applied by the generator
> (never hand-edited into the set JSON); arena-client is read-only projection + intent, never
> engine logic.

**Locked — new hero keyword + token:**
- `defeat-with-bystander` — a bare, no-magnitude `HeroKeyword`; marker token
  `[keyword:defeat-with-bystander]` (single-segment, `VALID_TOKEN_PATTERN`).

**Locked — eligible-target semantics:** the target set is every **city Villain with ≥1
attached Bystander** PLUS the **Mastermind** (its current tactic) when the Mastermind holds a
captured Bystander. The two live in **different stores** — a city Villain's Bystanders are in
the `G.attachedBystanders` map (keyed by cardId); the Mastermind's are in
`G.mastermind.attachedBystanders` (length `> 0`). **Build order is deterministic:** iterate
`G.city` by ascending space index (NOT the `attachedBystanders` map, whose key order is not a
stable contract), then append the Mastermind last — this order feeds both the UIState
projection and the `ai.legalMoves.ts` default, so it must be pinned (assert it). Defeat spends
**no attack**. Defeat reuses the existing path (victory-pile move + onFight/onDefeat hooks +
attached-Bystander/hero award). Mandatory-if-able: **0 → self-narrated no-op** (never a hollow);
**exactly 1 → auto-defeat, no prompt**; **≥2 → `PendingDefeatChoice` parked** (block-all until
resolved). The pending entry carries `choiceType: 'defeat-with-bystander'` (the discriminant
literal, mirroring reorder's `choiceType: 'reorder-deck-top'`).

**Locked — pending-choice contract:** hashed FIFO `G.pendingDefeatChoices` (lazily
initialized, never persisted); `resolveDefeatChoice` move; block-all guard at every sibling
fire site; `uiState.build.ts` projection under the D-24011 private filter; deterministic
bot/sim default in `ai.legalMoves.ts`; arena-client prompt. The projection + prompt + gate
ship together (no-UX-freeze invariant).

**Determinism:** a new **hashed** `G` field → `finalStateHash` + `PRE_WP080_HASH` **dual re-pin
ONLY if** a committed fixture plays Silent Sniper into a qualifying board (confirm empirically;
re-pin with a note if so). The defeat itself introduces no new `ctx.random` draw.

## Acceptance Criteria

- [ ] Playing Silent Sniper with exactly one eligible target auto-defeats it (a Villain with a
      Bystander, or the Mastermind tactic when the Mastermind holds a Bystander), spends no
      attack, rescues the attached Bystander(s), and the log records it.
- [ ] With ≥2 eligible targets, a `PendingDefeatChoice` is parked, the board is blocked until
      resolved, the choosing player (only) sees the prompt (D-24011), and `resolveDefeatChoice`
      defeats exactly the chosen target.
- [ ] With 0 eligible targets, the handler self-narrates a no-op and records **no** hollow event.
- [ ] The defeat reuses the shared defeat path — `fightVillain` / `fightMastermind` behavior is
      byte-unchanged (their existing tests pass without modification beyond the block-all guard);
      the shared surface excludes `spendAttack` + `G.hasActedThisTurn`.
- [ ] Nested pending resolves in order: defeating a Villain whose `onFight` parks a KO-hero (or
      scry-KO) choice leaves both pendings and they resolve FIFO with no board freeze (the
      `PendingDefeatChoice` is front-popped before the defeat dispatch).
- [ ] `apply-hero-ability-markers.mjs` leaves `core.json` / `msp1.json` / `3dtc.json` with the
      three `[keyword:defeat-with-bystander]` markers and no other card drift (`git diff` shows
      only the three Silent Sniper lines).
- [ ] `HeroKeyword` union ↔ `HERO_KEYWORDS` drift test passes with the new entry.
- [ ] `pnpm ledger:heroes:check` + `pnpm effect-index:check` exit 0 (Silent Sniper flips to an
      executable `defeat-with-bystander` row; provenance carries WP-486 / D-24291).
- [ ] game-engine `test` + arena-client `test` + `pnpm -r build` + `pnpm -r --no-bail test`
      exit 0. `finalStateHash` / `PRE_WP080` re-pin only if a committed fixture plays it
      (confirm empirically; re-pin with note if so).
- [ ] `D-24291` landed. No file outside the allowlist (+ governance) is modified.

## Verification Steps

```bash
node scripts/convert-cards/apply-hero-ability-markers.mjs   # regenerate markers
git diff --stat data/cards/core.json data/cards/msp1.json data/cards/3dtc.json  # only 3 lines
pnpm -r build && pnpm ledger:heroes && pnpm effect-index
pnpm ledger:heroes:check && pnpm effect-index:check          # CI gates current
pnpm --filter @legendary-arena/game-engine test
pnpm --filter @legendary-arena/arena-client test
pnpm -r build && pnpm -r --no-bail test
# Post-deploy (D-24026): play Silent Sniper in a live match with a Bystander-holding
# Villain and/or Mastermind present — the defeat resolves (prompt when ≥2), no hollow.
```

## Vision Alignment

**Clauses:** §1-9 (faithful game implementation — cards do what they say). **Conflict:** *No
conflict* — closes a faithfulness gap; no scoring/PAR surface; the only determinism touch is a
new hashed pending field (dual re-pin gated on a fixture reaching it). Locks the new keyword +
pending-choice contract under **D-24291**. **NG:** none.

## Definition of Done

- [ ] All AC pass; game-engine + arena-client test + `pnpm -r build` + `pnpm -r --no-bail test` green.
- [ ] **D-24291 Active.**
- [ ] **D-24026 live-verify (operator-pending):** Silent Sniper defeats live (prompt when ≥2).
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-521 Done.
- [ ] No files outside the list.

## Lint Gate Self-Review

- §1/§15: header + `## User-Visible Impact`; D-24026 present. PASS.
- §2: Contract full-file / no-diffs / `00.6`. PASS. §4: Context read-list (WP-479, WP-485). PASS.
- §5: game-engine (keyword + handler + pending contract + shared defeat-core + UIState + sim) +
  card-data (marker generator + 3 generated sets) + arena-client (prompt vertical) + the
  CI-gated ledger/effect-index (regenerated) + provenance + DECISIONS. Two layer edges — Registry
  card-data input → Game Engine consumer (the established marker pattern), and Game Engine →
  arena-client (read-only projection + intent, the pending-choice vertical). Both downward,
  allowed. This crosses a layer boundary → **full two-session lane, not lightweight** (D-24028).
  PASS.
- §8: game-engine Node-only, pure handler; card data via generator; arena-client no engine logic. PASS.
- §17: §1-9, No conflict, D-24291. PASS. §20 N/A — no funding/pricing/copy/channel.
  §21 N/A — a new bgio move (`resolveDefeatChoice`) is not an `apps/server` HTTP endpoint or a
  `Library-only` catalog function; the API catalog is unaffected.
- New keyword + new pending-choice contract + new hashed `G` field → reserves/lands **D-24291**.

## Gate Verdicts (drafting session)

Run as independent subagents against this WP + EC-521 (2026-08-02):
- **Pre-flight (01.4): READY TO EXECUTE** — zero fabricated symbols/paths, all deps landed
  (WP-479/D-24286, WP-485/D-24290, D-24011), allowlist covers the full `pendingReorderChoices`
  span, Silent Sniper confirmed unmarked in all 3 reprints. 3 RS clarifications folded
  (`HANDLED_KEYWORDS`; the 8-site guard span; move-count 24→25).
- **Copilot (01.7): PASS** — initial verdict RISK/HOLD with 5 grounded findings (nested-pending
  ordering; guard-site list correction; two-asymmetric-cores boundary + exclude
  spendAttack/hasActedThisTurn; deterministic eligible-target order; choiceType literal +
  two-store detection); all 5 folded in-place and re-checked → PASS.
- **Lint (00.3): PASS** — all 21 sections PASS/N/A (§20 N/A funding; §21 N/A — `resolveDefeatChoice`
  is a bgio move, not an `apps/server` endpoint); WP/EC file lists match; EC at 97 content lines
  (≤100 ceiling).
