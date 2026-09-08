# WP-667 — Radioactive Riot: optional "KO a card from hand or discard" (recruit-threshold-gated, no reward) (Game Engine + Arena Client + card-data)

**Status:** Draft — pending execution
**Primary Layer:** Game Engine (a new no-reward optional-KO keyword reusing the optional-ko-reward pending queue) + Arena Client + card-data
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

`wwhk/she-hulk/radioactive-riot` prints *"Once this turn, if you made at least 6
Recruit this turn, you may KO a card from your hand or discard pile."* WP-660
removed its phantom recruit, but its optional-KO ability was left an unmodeled
hollow: playing it grants only the printed +3 Attack and never offers the KO
(live-observed — no waiting/prompt line at all). This WP models the ability: gate
it on the shipped `recruit-threshold:6` wait-and-see condition, and when the
threshold is met, offer an **optional** interactive choice to KO one card from the
player's **hand or discard pile** (no reward — the KO is deck-thinning), reusing the
optional-ko-reward (D-24019) pending-choice infrastructure.

## User-Visible Impact

A player who plays Radioactive Riot after making ≥6 Recruit this turn is now offered
a prompt: *"You may KO a card from your hand or discard pile"* — pick a card to KO,
or decline. Below 6 Recruit the ability waits (the wait-and-see window) and offers
the choice later in the turn if the threshold is reached. The printed +3 Attack is
unchanged.

## Assumes

- **Baseline:** `origin/main` @ `2d3e0f09` (2026-09-07). Re-baseline at execution.
- **The optional-ko-reward pending-choice stack is shipped** (WP-248/249 / D-24019):
  `G.pendingOptionalKoRewards` + `resolveOptionalKoReward` + `hasPendingOptionalKoReward`
  (the block-all guard placed at every play-phase move) + `getLegalMoves` short-circuit
  + the `UIPendingOptionalKoReward` projection + `OptionalKoRewardPrompt.vue`. This WP
  **reuses that queue**, so it does NOT re-thread the ~25 block-all-guard sites — a
  new keyword parks a **no-reward** entry into the SAME queue. ✅ on `main`.
- **The KO source of optional-ko-reward is hand ∪ discard ∪ inPlay (D-24442).**
  Radioactive Riot is narrower — **hand or discard only** — so this WP adds a
  per-entry `koZones` scope: the projection lists inPlay only when the entry permits
  it, and the resolve validates the submitted zone against it. ✅ on `main`.
- **The `recruit-threshold:6` wait-and-see condition is shipped** (D-24354 / WP-568).
  A `[keyword:recruit-threshold:6]` marker pushes `recruitMadeThisTurnAtLeast:6` onto
  the hook; below-threshold defers, re-firing when Recruit reaches 6 (the same
  mechanism Hurl Legal Objections' transform uses). The hook's only effect is the
  optional-KO park (the +3 Attack is a printed stat, not a hook effect), so deferring
  the whole hook defers exactly the KO offer. ✅ on `main`.

## Context (Read First)

- `data/cards/wwhk.json` (`radioactive-riot`) — the printed ability (no marker today).
- `packages/game-engine/src/hero/heroEffects.execute.ts` (`heroEffectOptionalKoReward`
  @ ~L1626 — the park model; `HERO_EFFECT_HANDLERS`; `HANDLED_KEYWORDS`;
  `NO_MAGNITUDE_KEYWORDS`; the keyword-lockstep sites per the
  `reference_hero_keyword_lockstep_sites` catalogue) — **AUTHORITATIVE for** the park
  handler + the handler-bearing keyword lockstep.
- `packages/game-engine/src/moves/optionalKoReward.resolve.ts` (`resolveOptionalKoReward`,
  `hasPendingOptionalKoReward`) — **AUTHORITATIVE for** the shared resolve; this WP adds
  a no-reward branch (skip the Step-6 reward dispatch when `rewardType === 'none'`) + a
  `koZones` validation.
- `packages/game-engine/src/types.ts` (`PendingOptionalKoReward`) — **AUTHORITATIVE for**
  the pending entry; this WP adds an optional `koZones` field.
- `packages/game-engine/src/ui/uiState.build.ts` (`deriveOptionalKoRewardLabel` @ ~L216;
  the `pendingOptionalKoReward` projection @ ~L1207) — **AUTHORITATIVE for** the label +
  the eligible-lists projection; this WP projects `eligibleInPlay: []` when `koZones`
  excludes inPlay, and a no-reward label.
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` — the client prompt;
  it renders the projected eligible lists + label, so an empty inPlay list + a no-reward
  label need **no structural change** (verify at execution).
- `packages/game-engine/src/setup/heroAbility.setup.ts` (the `recruit-threshold` marker arm
  @ ~L938; `SUPPORTED_TRANSFORM_BASES` is unrelated) — **AUTHORITATIVE for** the new
  keyword's marker arm.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`) +
  `scripts/convert-cards/inputs/hero-ability-markers.json` — the marker grammar + authoring.
- `docs/ai/DECISIONS.md` — the reserved **D-24480**; scan **D-24019** (optional-ko-reward),
  **D-24442** (KO source zones), **D-24354** (recruit-threshold), **D-24377** (wait-and-see).

## Design Rationale

**Reuse the optional-ko-reward pending queue; add a no-reward, hand+discard variant.**
Radioactive Riot is the optional-ko-reward shape minus the reward and minus the inPlay
KO source. Rather than stand up a parallel pending queue (which would re-thread the ~25
block-all-guard sites, `getLegalMoves`, and the projection), a new `optional-ko-hand-discard`
keyword parks a **no-reward** entry (`rewardType: 'none'`, `koZones: ['hand','discard']`)
into `G.pendingOptionalKoRewards`. The guard, `getLegalMoves`, resolve, projection, and
client prompt are all reused; the only additions are localized:

1. `PendingOptionalKoReward` gains an optional `koZones` scope (default = the D-24442 wide
   set, so existing entries are byte-unchanged).
2. `resolveOptionalKoReward` skips the reward dispatch for `rewardType: 'none'` and
   validates the submitted zone against `koZones`.
3. The projection lists `eligibleInPlay: []` when `koZones` excludes inPlay, and the label
   derives a no-reward string.

**The gate rides the shipped wait-and-see.** A `[keyword:recruit-threshold:6]` marker
gates the hook; the optional-KO park is the hook's only effect (the +3 Attack is the
card's printed Attack stat). Below 6 Recruit the hook defers and re-fires when Recruit
reaches 6 — parking the KO offer then (the Hurl Legal Objections / Gamma-Draining Nanites
precedent). No new deferral machinery.

## Scope (In)

- **New `optional-ko-hand-discard` HeroKeyword** across the handler-bearing lockstep:
  union + `HERO_KEYWORDS` + both length pins + `HERO_EFFECT_HANDLERS` + handler-count pin
  + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS` (it carries NO magnitude — no reward) +
  the setup-parser marker arm (per the `reference_hero_keyword_lockstep_sites` catalogue).
- **Park handler** `heroEffectOptionalKoHandDiscard` — parks
  `{ playerID, rewardType: 'none', rewardMagnitude: 0, sourceCardId, koZones: ['hand','discard'] }`
  into `G.pendingOptionalKoRewards` (reusing the shared queue); a logged no-op (never a
  throw) when both hand and discard are empty.
- **`PendingOptionalKoReward.koZones?: ('hand'|'discard'|'inPlay')[]`** — additive optional;
  absent = the D-24442 wide set (existing entries unchanged).
- **`resolveOptionalKoReward`** — skip the reward dispatch when `rewardType === 'none'`;
  validate the submitted `zone` is in `front.koZones` (when set).
- **UIState projection** — `eligibleInPlay: []` when `koZones` excludes inPlay;
  `deriveOptionalKoRewardLabel` returns a no-reward label for `rewardType: 'none'`
  ("You may KO a card from your hand or discard pile").
- **Client prompt** — verify `OptionalKoRewardPrompt.vue` renders the no-reward label +
  the hand/discard lists with an empty inPlay list (no structural change expected;
  a component test for the no-reward shape).
- **Card data** — `radioactive-riot` gets `[keyword:recruit-threshold:6]` +
  `[keyword:optional-ko-hand-discard]` via `hero-ability-markers.json` (regenerated);
  `VALID_TOKEN_PATTERN += optional-ko-hand-discard`.
- **Regenerated hero card-data-derived artifacts** + their `:check` gates; the ledger
  flips `radioactive-riot`'s optional-KO to executable.
- **Tests** — park on recruit-threshold pass, defers below; the no-reward resolve KOs from
  hand + from discard, grants nothing; a submitted `inPlay` zone is rejected (koZones);
  decline pops the queue; the projection lists hand+discard, empty inPlay, no-reward label;
  the keyword lockstep; the client prompt renders + dispatches.

## Out of Scope

- **`co2e/spark-of-the-divine`** ("if ≥8 Recruit … KO a card … if you do +3 Attack") — the
  **rewarded** recruit-threshold sibling; it is `optional-ko-reward:attack:3` gated on the
  shipped `recruit-threshold:8`, plus the same hand+discard `koZones`. A near-identical
  follow-up; noted for a same-pattern pass, not built here.
- **The 90+ other "KO a card from hand or discard" cards** — gated by covert/class/team/etc.,
  a different gate per card; each is its own marker on the shared machinery this WP extends.
- **Changing optional-ko-reward's existing wide-zone (inPlay) behaviour** — untouched; the
  `koZones` default preserves it byte-for-byte.
- **A new pending queue / new block-all guard** — deliberately avoided (reuse).

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` (+ both length-pin tests) — the keyword.
- `packages/game-engine/src/types.ts` — `PendingOptionalKoReward.koZones?`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ handler-count/keyset tests) —
  the park handler + `HERO_EFFECT_HANDLERS` + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — the marker arm.
- `packages/game-engine/src/moves/optionalKoReward.resolve.ts` — the no-reward + koZones branches.
- `packages/game-engine/src/ui/uiState.build.ts` (+ `uiState.types.ts` if the label/eligible
  shape needs a note) — the projection + label.
- `packages/game-engine/src/**/*.test.ts` — the coverage above.
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` (+ `.test.ts`) — the
  no-reward render (verify; add a test).
- `scripts/convert-cards/apply-hero-ability-markers.mjs` + `inputs/hero-ability-markers.json`
  + `data/cards/wwhk.json` (regenerated) + the hero derived artifacts + the ledger.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24480), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/ai/NUMBER-LEDGER.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

The exact allowlist is finalised at execution; any file outside it is a FAIL.

## Non-Negotiable Constraints

> - Full file contents; ESM only, Node v22+; human-style code per `00.6-code-style.md`.
> - Determinism: `ctx.random.*` only; moves never throw; the park handler + resolve
>   safe-skip malformed state.
> - **Pending-choice UX integrity:** the parked choice MUST have a `UIState` projection
>   that survives `filterUIStateForAudience` (it reuses the shipped chooser-only
>   redaction) AND a client prompt (reused). A block-all guard with no projection freezes
>   the human (the shipped failure mode) — here both are reused, so verify the no-reward
>   variant renders.
> - **koZones default is the wide set** — existing optional-ko-reward entries serialize
>   byte-identically (no hash surface; the pending field is lazily materialized already).
> - New keyword ↔ the full lockstep (per `reference_hero_keyword_lockstep_sites`), incl.
>   `NO_MAGNITUDE_KEYWORDS` (this keyword carries no magnitude). Runtime drift pins
>   (engine tests are not typechecked — D-24372).
> - The card-data marker is regenerated by the pipeline, never hand-edited (WP-633).
> - Session protocol: on any ambiguity not resolved by the WP + EC, STOP and surface it.

## Contract

- **Keyword** — `optional-ko-hand-discard`, no magnitude (no reward).
- **Pending** — reuses `G.pendingOptionalKoRewards`; the parked entry carries
  `rewardType: 'none'`, `rewardMagnitude: 0`, `koZones: ['hand','discard']`.
- **Resolve** — `resolveOptionalKoReward` KOs the chosen hand/discard card and grants
  nothing for `rewardType: 'none'`; rejects an `inPlay` submission (koZones); decline pops.
- **Markers** — `[keyword:recruit-threshold:6]` + `[keyword:optional-ko-hand-discard]` on
  `radioactive-riot`.

## Vision Alignment

- **Vision clauses touched:** §1 (faithful card behavior), §2 (client renders a read-only
  prompt, engine decides), §22 (determinism).
- **Conflict assertion:** No conflict — a printed hero ability made faithful; interactive
  choice is deterministic (no RNG; the KO is a zone move), replay-faithful, buys no game
  outcome (NG-1 untouched).
- **Non-Goal proximity check:** N/A.
- **Determinism preservation:** the park + resolve are deterministic; `koZones` is additive
  and lazily present, so a game that never parks a no-reward KO is byte-unchanged (no hash
  re-pin — the pending queue is already a lazily-materialized non-hashed... it IS hashed as
  part of G; confirm at execution whether an existing sentinel parks one — expected NOT, so
  no re-pin; if a sentinel does, re-pin deliberately).

## Funding Surface Gate

§20 N/A — engine gameplay + card data + a gameplay client prompt.

## API Catalog Update

§21 N/A per D-11804 — a boardgame.io move (the resolve is reused; no new HTTP endpoint).

## Acceptance Criteria

- **AC-1** Playing Radioactive Riot with ≥6 Recruit made this turn parks a no-reward
  optional-KO choice (a `pendingOptionalKoReward` entry with `rewardType: 'none'`,
  `koZones: ['hand','discard']`); the printed +3 Attack still applies.
- **AC-2** Below 6 Recruit the hook WAITS (the wait-and-see log line) and parks the choice
  later the same turn once Recruit reaches 6; if the turn ends below 6, no choice is parked.
- **AC-3** Resolving with `{ zone: 'hand'|'discard', cardId }` KOs that card and grants
  **nothing**; resolving with `{ decline: true }` KOs nothing; both pop the queue.
- **AC-4** A submitted `{ zone: 'inPlay', … }` is rejected (koZones excludes it); the
  existing rewarded optional-ko-reward cards STILL accept inPlay (the default wide set).
- **AC-5** The `UIPendingOptionalKoReward` projection lists the chooser's hand + discard,
  an **empty** inPlay list, and a no-reward label; it survives `filterUIStateForAudience`
  for the chooser only.
- **AC-6** `OptionalKoRewardPrompt.vue` renders the no-reward prompt (label + hand/discard,
  no inPlay) and dispatches KO / decline; its component test passes.
- **AC-7** `optional-ko-hand-discard` is wired across the keyword lockstep incl.
  `NO_MAGNITUDE_KEYWORDS`; the runtime drift pins pass.
- **AC-8** `data/cards/wwhk.json` `radioactive-riot` encodes both markers; a clean regen
  reproduces the committed bytes; every `:check` is green; the ledger flips the card's
  optional-KO to executable.
- **AC-9** Determinism: existing optional-ko-reward entries are byte-unchanged (koZones
  default); the hash oracles are handled deliberately (expected no re-pin — the sentinel
  parks no no-reward KO; confirm).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` + `pnpm -r build` exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; record the pass count.
3. `pnpm --filter @legendary-arena/arena-client test` exits 0.
4. The card-data regen chain reproduces committed `data/cards/*.json` + every `:check`.
5. `pnpm sim:runtime-observed:check` exits 0 (no regen, or a recorded re-pin).
6. **Control run:** remove the `optional-ko-hand-discard` marker from Radioactive Riot;
   confirm AC-1 fails (the KO is no longer offered) — non-vacuous.
7. `git diff --name-only` = the finalised EC allowlist.

## Definition of Done

- [ ] AC-1..AC-9 satisfied.
- [ ] All Verification Steps green, incl. the Step-6 control run.
- [ ] No files outside the finalised EC allowlist were modified.
- [ ] `docs/ai/DECISIONS.md` — **D-24480 Active**, recording: the new `optional-ko-hand-discard`
      keyword reusing the optional-ko-reward pending queue; the `koZones` scope + no-reward
      resolve; Radioactive Riot's two markers; and the reused guard/getLegalMoves/prompt.
- [ ] `docs/ai/STATUS.md` close-out.
- [ ] **D-24026 live-on-surface:** on `play.legendary-arena.com`, a real match plays
      Radioactive Riot after ≥6 Recruit and is offered the KO choice; recorded or operator-pending.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap node `📝`→`✅` + counts regenerated.

## Reserved Decision (lands at execution)

**D-24480 — Radioactive Riot's optional "KO a card from hand or discard" (recruit-threshold-gated,
no reward) is a new `optional-ko-hand-discard` keyword that REUSES the optional-ko-reward
(D-24019) pending queue with a no-reward entry (`rewardType: 'none'`) and a new per-entry
`koZones` scope (`['hand','discard']`, no inPlay).** Records: the keyword parks into
`G.pendingOptionalKoRewards`, so the block-all guard, `getLegalMoves` short-circuit, resolve
move, audience-filtered projection, and client prompt are reused (no parallel queue, no
re-threading of the ~25 guard sites); the resolve skips the Step-6 reward dispatch for
`rewardType: 'none'` and validates the submitted zone against `koZones`; the projection lists
an empty inPlay set and a no-reward label; `koZones` is additive-optional and defaults to the
D-24442 wide set so existing entries are byte-unchanged; the gate is the shipped
`recruit-threshold:6` wait-and-see (the +3 Attack is the card's printed stat, so the hook's
only effect is the KO park); and the rewarded sibling `co2e/spark-of-the-divine` is a noted
follow-up (`optional-ko-reward:attack:3` + `recruit-threshold:8` + the same `koZones`).

## Lint Gate Self-Review (00.3)

Completed inline at draft against all 21 sections (recorded in the `SPEC:` draft commit body).
§1–§9 PASS (Context authoritative; §4 the card-data change is a prose-marker append, not a 00.2
schema change; §8 engine decides, client renders a read-only prompt that dispatches a move).
§12–§17 PASS (control run mandated; §16 human-style; §17 Vision block carries clause numbers +
conflict assertion + determinism line; §15.1 declares `play.legendary-arena.com` with the D-24026
gate). §10, §11, §18, §20, §21 resolve N/A with named justifications. **Gate verdicts finalised at
execution** (pre-flight + copilot recorded in the draft commit body).
