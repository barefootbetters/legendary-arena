# WP-248 — Optional-KO-then-Reward Hero Effect Framework (`optional-ko-reward`)

> **Status:** DRAFT — pending review (do not execute until reviewed per
> `.claude/rules/work-packets.md` Review Gate).
> **Reserves:** D-24019.
> **Paired WP:** WP-249 (UX projection + client prompt) — **co-release locked**
> (the prompt cannot render without this engine packet; this engine packet has
> no player-facing choice surface without WP-249).
> **Paired EC:** EC-279.
> **Depends on:** WP-021, WP-022, WP-023, WP-215, WP-242 (all landed).

---

## Session Context

> WP-022 established the `executeHeroEffects` `onPlay` switch dispatch and the
> `attack`/`recruit`/`draw` reward executors; WP-215 added the `rescue`
> executor; WP-023 added conditional hero effects (`[hc:X]` self-exclusion
> evaluation via `evaluateAllConditions`); **WP-242** built the
> park→resolve→bot-auto-resolve pattern for an interactive KO-a-card choice
> (`G.pendingKoHeroChoices` FIFO, the `resolveKoHeroChoice` move, block-all +
> turn-end guards, deterministic bot auto-resolve via `getLegalMoves`
> short-circuit). This packet builds the **general** "you may KO a card, then
> get a reward" mechanism on top of all of them, reusing WP-242's choice infra.

---

## Goal

After this session, the hero-ability family **"You may KO a card from your
hand or discard pile. If you do, `<reward>`"** is executable through a SINGLE
general mechanism rather than a keyword per card. Concretely: a new
`optional-ko-reward` `HeroKeyword`; `HeroEffectDescriptor` gains
`rewardType?: HeroKeyword` (the reward granted **iff** the player KOs a card);
a new FIFO pending-choice queue `G.pendingOptionalKoRewards`; a new
`resolveOptionalKoReward` move (decline, or KO a named hand/discard card →
dispatch the reward to the existing reward executor); block-all + turn-end
guards while a choice is pending; and deterministic bot/sim auto-resolution.
The mechanism is **marked on only `core/black-widow/dangerous-rescue`**
(reward = `rescue`), fixing the reported bug (Dangerous Rescue does nothing
today — match `qxiY97A0m2J` diagnostic).

**Why general, not per-card.** The card corpus has **~15** lines of the form
`You may KO a card from your hand or discard pile. If you do, <reward>` across
10+ sets, where `<reward>` varies (`+attack`/`+recruit`, rescue, draw, gain a
Shard, gain a New Recruit). A keyword per reward-variant would multiply
keywords + WPs. Instead the family is one parameterized effect
(`optional-ko-reward` + a `rewardType` field), the reward dispatches to the
**already-built** `rescue`/`draw`/`attack`/`recruit` executors, each new card
is a data marker, and marking the corpus is a single follow-up **sweep** WP
(the WP-225 pattern).

---

## Assumes

> **Drafting baseline (01.0a Step 2):** drafted against `origin/main` after the
> WP-247 / EC-278 execution + D-24017 + the #312 mindmap backfill + #313
> hero-rescue logging. Supersession check (slug grep `--all`, WORK_INDEX/EC_INDEX
> scan, in-flight `claude/lagn-upload-extid-roundtrip` D-number check) returned
> no collision — no optional-KO-then-reward mechanism exists; the pattern appears
> only as `_deferred` notes (WP-218/224, which are *deck-reveal* optional-KOs, a
> different shape). D-24018 is reserved on the in-flight `#314` branch, so this
> packet reserves D-24019.

- **WP-022 complete.** `hero/heroEffects.execute.ts` exports
  `executeHeroEffects` + the private `executeSingleEffect(G, ctx, playerID,
  cardId, effect)` switch; the `attack`/`recruit`/`draw` reward cases exist and
  gate on `MVP_KEYWORDS` + `isValidMagnitude`.
- **WP-215 complete.** The `rescue` case exists (top-of-pile bystander → victory;
  empty-supply + success now log via D-24017).
- **WP-023 complete.** `evaluateAllConditions(G, playerID, conditions, cardId)`
  evaluates `[hc:X]` with self-exclusion. Dangerous Rescue's `[hc:covert]`
  condition is already parsed + evaluated.
- **WP-242 complete.** The interactive-choice infra exists:
  `G.pendingKoHeroChoices` FIFO, `resolveKoHeroChoice` (front-pop, `client:false`),
  block-all guard across action moves + `advanceStage`, dual turn-end guards,
  `getLegalMoves` short-circuit for bot auto-resolve, `selectDefaultKoTarget`.
  This packet **extends that pattern** (a second pending-choice type that
  coexists with `pendingKoHeroChoices` and `pendingHeroChoice`).
- `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` + §The Move
  Validation Contract + §Phase & Turn Transitions — the resolve move follows
  the validate-args → stage/pending gate → mutate-via-helpers → return-void
  contract; moves never throw.
- `packages/game-engine/src/moves/fightVillain.ts` + the WP-242 KO-hero choice
  files (`G.pendingKoHeroChoices`, `resolveKoHeroChoice`, the block-all guard,
  `selectDefaultKoTarget`, the `getLegalMoves` short-circuit) — the exact infra
  this packet mirrors. **Do not re-invent it — extend it.**
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `executeSingleEffect`
  switch; the `rescue`/`draw`/`attack`/`recruit` cases the reward dispatches to.
- `packages/game-engine/src/types.ts` — `LegendaryGameState` (add the new
  `pendingOptionalKoRewards` field next to `pendingKoHeroChoices` /
  `pendingHeroChoice`); `PendingKoHeroChoice` is the shape precedent.
- `packages/game-engine/src/rules/heroKeywords.ts` — closed union + array.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — the marker-token
  parser; the new 3-segment reward token needs a parse block + descriptor build.
- `packages/game-engine/src/game.ts` — move registration + `getLegalMoves`.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` +
  `inputs/hero-ability-markers.json` + `data/cards/core.json` — the marker.
- `docs/ai/DECISIONS.md` — D-22001/D-22003 (pendingHeroChoice reject-second),
  D-24006..D-24011 (WP-242 KO-hero choice) before reserving D-24019.
- `.claude/rules/code-style.md` + `00.6` + `.claude/skills/legendary-game-engine/SKILL.md`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new/modified file. Diffs/snippets forbidden.
- No `Math.random()`; **moves never throw** (only `Game.setup()` may); `G` stays
  JSON-serializable (the pending queue holds strings + numbers only — no
  functions/Maps/Sets).
- ESM only, Node v22+; `node:` prefix; test files `.test.ts`; no `.reduce()` in
  move/effect logic — use `for...of`.
- Every `ctx.events.*` call (none expected here) needs a `// why:`; `// why:` on
  non-obvious decisions; full-sentence error/log messages.

**Packet-specific:**
- **Parameterized, not per-card.** Exactly ONE keyword `optional-ko-reward`; the
  reward variation lives entirely in `rewardType` + the reward dispatch. Never
  add a per-reward or per-card keyword.
- **Reward reuse (no duplication).** The KO-then-reward path MUST dispatch to the
  existing `rescue`/`draw`/`attack`/`recruit` executor logic (e.g., via
  `executeSingleEffect` with a synthesized `{ type: rewardType, magnitude }`
  descriptor), NOT a re-implementation. Seeded reward set: `rescue`, `draw`,
  `attack`, `recruit` (the already-built executors). `rewardType` values outside
  that set are a skipped no-op (defensive; the marker map only uses seeded ones).
- **Optional + player-choice (the whole point).** On play, the effect PARKS a
  choice; it never auto-KOs for a human. The player either declines (no KO, no
  reward) or KOs exactly one named hand/discard card (→ reward). Mirrors WP-242.
- **KO target = ANY card** in `playerZones[pid].hand` ∪ `playerZones[pid].discard`
  (the text says "a card", not "a Hero"). 0 eligible (both zones empty) → the
  effect is a skipped no-op with a `G.messages` line (mirrors D-24017).
- **FIFO queue + coexistence.** Use `G.pendingOptionalKoRewards: PendingOptionalKoReward[]`
  (append on park, front-pop on resolve), mirroring `G.pendingKoHeroChoices`. It
  coexists with `pendingKoHeroChoices` + `pendingHeroChoice`; the block-all +
  turn-end guards exempt ALL THREE resolve moves.
- **Reward fires only on KO (atomic).** Decline → no KO, no reward. KO → remove
  the card from its zone, add to `G.ko`, THEN dispatch the reward. The reward is
  never granted without the KO.
- **Deterministic bot/sim auto-resolve.** `getLegalMoves` short-circuits to
  `resolveOptionalKoReward` when a choice is pending; the default policy KOs the
  lowest-cost eligible card (discard-preferred over hand; ties broken
  deterministically by zone order then array index) and takes the reward — a pure
  selector `selectDefaultOptionalKoTarget`, no RNG. (Decline is a human-only
  option; the bot always takes the reward.)
- **Determinism preserved.** Parking + resolution are pure over `G`; the only RNG
  is the existing `draw` reward's reshuffle (`ctx.random.Shuffle`), reached via
  the dispatched executor — unchanged. Re-pin the sentinel/`PRE_WP080_HASH` ONLY
  if a fixture diverges (no fixture plays Dangerous Rescue).

**Locked Contract Values:**
- Keyword: `'optional-ko-reward'` (`HeroKeyword` union + `HERO_KEYWORDS` array,
  before `'conditional'`).
- Descriptor: `HeroEffectDescriptor.rewardType?: HeroKeyword`; reward magnitude
  reuses the existing `magnitude` field.
- Pending shape: `PendingOptionalKoReward = { playerID: string; rewardType:
  HeroKeyword; rewardMagnitude: number; sourceCardId: CardExtId }` (eligible
  cards are recomputed fresh from hand+discard at projection + validated at
  resolve — no snapshot, mirrors WP-242 "eligible recomputed fresh").
- State field: `G.pendingOptionalKoRewards?: PendingOptionalKoReward[]` (FIFO,
  optional `| undefined` to mirror `pendingKoHeroChoices?`; initialized `[]` at setup).
- Move: `resolveOptionalKoReward` (new `moves/optionalKoReward.resolve.ts`,
  mirroring `moves/koHeroChoice.resolve.ts`), args `{ decline: true }` OR
  `{ zone: 'hand' | 'discard', cardId: CardExtId }`; registered `client: false`
  in `game.ts` (next to `resolveKoHeroChoice` at game.ts:304). The module also
  exports a `hasPendingOptionalKoReward(G)` predicate (mirrors the exported
  `hasPendingKoHeroChoice`) that the board-freeze guard consumes.
- Bot default + getLegalMoves: `getLegalMoves` lives in
  `simulation/ai.legalMoves.ts` (NOT `game.ts`); the short-circuit returns
  `resolveOptionalKoReward` with `selectDefaultOptionalKoTarget(...)`, a new pure
  selector in `hero/heroEffects.execute.ts` (mirrors `selectDefaultKoTarget`,
  which lives in `villain/villainEffects.execute.ts`).
- Marker token: `[keyword:optional-ko-reward:<reward>:<n>]`, `<reward>` ∈ the
  seeded reward set, `<n>` ≥ 1. Dangerous Rescue: `setAbbr: 'core'`,
  `heroSlug: 'black-widow'`, `cardSlug: 'dangerous-rescue'`, `abilityIndex: 0`,
  `markupToken: '[keyword:optional-ko-reward:rescue:1]'`.
- Token regex addition (`VALID_TOKEN_PATTERN`):
  `^\[keyword:optional-ko-reward:[a-z][a-z-]*:[1-9]\d*\]$`.
- Timing: `onPlay` (the choice is parked at play; resolved before turn end).

**Session protocol:** if the WP-242 infra's actual shape (queue field name,
guard list, `getLegalMoves` short-circuit site) differs from what this WP
assumes, **stop and ask** — do not fork a parallel choice system.

---

## Scope (In)

### A) `rules/heroKeywords.ts` — modified
- Add `'optional-ko-reward'` to the union + array (before `'conditional'`),
  `// why: D-24019`.

### B) `rules/heroAbility.types.ts` — modified
- Add `rewardType?: HeroKeyword` to `HeroEffectDescriptor`, `// why: D-24019`.

### C) `types.ts` — modified
- Add `PendingOptionalKoReward` interface + `pendingOptionalKoRewards?:
  PendingOptionalKoReward[] | undefined` to `LegendaryGameState` (next to the
  WP-242 `pendingKoHeroChoices?`). **Lazily initialized** at the park site (not at
  setup) — mirrors WP-242's `villainEffects.execute.ts:190`
  `if (!G.pendingKoHeroChoices) G.pendingKoHeroChoices = []` pattern; the optional
  field tolerates older snapshots without it.

### D) `setup/heroAbility.setup.ts` — modified
- Add a reward-token regex `\[keyword:optional-ko-reward:([a-z][a-z-]*):(\d+)\]`
  + a parse block emitting `{ type: 'optional-ko-reward', rewardType, magnitude:
  n }` when `rewardType ∈` the seeded reward set. `// why: D-24019`.

### E) `hero/heroEffects.execute.ts` — modified
- Add `'optional-ko-reward'` to `MVP_KEYWORDS`; add the `case`:
  guard `playerZones`; compute eligible = hand ∪ discard; 0 eligible → log +
  no-op; else **lazy-init** (`if (!G.pendingOptionalKoRewards) G.pendingOptionalKoRewards = []`)
  + append a `PendingOptionalKoReward` + log. `// why:` parks an interactive
  choice (mirrors WP-242); the reward is granted on resolve, not here.
- Add the pure `selectDefaultOptionalKoTarget(zones)` selector (lowest-cost,
  discard-preferred) used by `getLegalMoves` for bot/sim auto-resolve (mirrors
  `selectDefaultKoTarget`).

### F) `moves/optionalKoReward.resolve.ts` — **new** (move impl) + registration in `game.ts`
- `resolveOptionalKoReward(G, ctx, args)` — validate front-of-queue belongs to
  the player; `{decline}` → front-pop, no KO/reward; `{zone,cardId}` → card must
  be in that zone → KO (move to `G.ko`) → dispatch reward via the existing
  executor → front-pop. Move count N→N+1. `client: false`.

### G) Block-all + turn-end guards (`game.ts` / move-gating) + bot auto-resolve (`simulation/ai.legalMoves.ts`)
- Extend the WP-242 block-all guard (consuming a new exported
  `hasPendingOptionalKoReward(G)`) so a pending `optional-ko-reward` freezes the
  board, exempting all three resolve moves; extend the turn-end guards.
- Extend `getLegalMoves` (`simulation/ai.legalMoves.ts`) to short-circuit to
  `resolveOptionalKoReward` with `selectDefaultOptionalKoTarget(...)` (new pure
  selector in `hero/heroEffects.execute.ts`, mirroring `selectDefaultKoTarget`
  in `villain/villainEffects.execute.ts`).

### I) `scripts/convert-cards/apply-hero-ability-markers.mjs` — modified
- Add `^\[keyword:optional-ko-reward:[a-z][a-z-]*:[1-9]\d*\]$` to
  `VALID_TOKEN_PATTERN` + the `assertValidToken` message. `// why: D-24019`.

### J) `scripts/convert-cards/inputs/hero-ability-markers.json` — modified
- Add the `core` dangerous-rescue entry (locked marker values).

### K) `data/cards/core.json` — modified (regenerated)
- Run the apply script; ONLY the dangerous-rescue line gains the token.

### L) Tests
- `moves/optionalKoReward.resolve.test.ts` — **new**: decline (no KO/reward);
  KO-from-hand → reward; KO-from-discard → reward; invalid card/zone → no-op;
  front-pop ordering; atomicity (no reward without KO).
- `hero/heroEffects.execute.test.ts` — **modified**: play parks a choice when
  hand/discard non-empty; 0 eligible → no-op + log; reward dispatch grants the
  named reward on resolve.
- Drift test — `optional-ko-reward` in both union + array (extend the existing
  HERO_KEYWORDS drift test count).
- A `getLegalMoves`/bot test — pending choice short-circuits to the default
  (deterministic target).

### M) Required `// why:` annotations
- keyword (`heroKeywords.ts`) — `// why: D-24019`.
- descriptor + state field — `// why: D-24019`.
- parser reward-token block — `// why: D-24019`.
- executor park case — `// why:` parks an interactive choice; reward on resolve.
- resolve move — `// why:` reward fires only on KO (atomic); front-pop FIFO.
- bot default — `// why:` deterministic default; decline is human-only.

---

## Out of Scope

- **The rest of the ~15-card family.** ONLY `dangerous-rescue` is marked here;
  the corpus sweep is a follow-up **sweep** WP (the WP-225 pattern).
- **Not-yet-built rewards** (`gain a Shard`, `gain a New Recruit`) — those reward
  executors do not exist; their cards stay deferred until a reward-executor WP.
- **The UX** (projection, redaction, client prompt, page mount, turn-action
  gating) — that is the co-release-locked **WP-249** (this engine packet parks +
  resolves + bot-auto-resolves, but ships no human-facing prompt on its own).
- **Multi-card / repeat KO**, KO-from-other-zones (deck/inPlay), and conditional
  rewards beyond the seeded set — later WPs.
- **Any registry, server, preplan, or other-app change.**

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified**.
- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified**.
- `packages/game-engine/src/types.ts` — **modified**.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified**.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified**.
- `packages/game-engine/src/moves/optionalKoReward.resolve.ts` — **new** (move + `hasPendingOptionalKoReward` predicate).
- `packages/game-engine/src/game.ts` — **modified** (move registration + block-all/turn-end guards).
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** (bot short-circuit).
- `packages/game-engine/src/moves/optionalKoReward.resolve.test.ts` — **new**.
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified**.
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (drift + parse).
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — **modified** (bot default).
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified**.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified**.
- `data/cards/core.json` — **modified** (regenerated).
- `docs/ai/DECISIONS.md` — **modified** — D-24019 Reserved → Active.
- `docs/ai/STATUS.md` — **modified**.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-248 `[x]`.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-279 → Done.

**Total: 19 files** (15 engine/data + 4 governance: STATUS / DECISIONS /
WORK_INDEX / EC_INDEX). Over the lint §5 ~8 guideline — justified inline: a new
interactive-move subsystem (pending state + move + registration + guards + bot
path + their tests) is irreducible end-to-end; it reuses WP-242's infra rather
than duplicating it, and it is the LAST multi-file engine WP for this family
(subsequent cards are data markers). The block-all guard site (game.ts vs a
shared move-gating helper) is confirmed at pre-flight; the count flexes ±1 only
if the guard lives in its own module.

---

## Vision Alignment

**Vision clauses touched:** §1 (faithful card behavior), §2 (card data), §22
(determinism). **No conflict.** Makes a printed ability execute as written;
invents no card text; deterministic (pure park/resolve + a deterministic bot
default; the only RNG is the existing draw-reward reshuffle). Non-Goals NG-1..7:
none crossed.

## Funding Surface Gate

**N/A — justified.** No funding affordance, copy, or channel.

## API Catalog (§21)

**N/A — justified.** No HTTP endpoint or `apps/server/src/**` library function
added/modified/removed; the new move is an engine move (boardgame.io), not an
HTTP endpoint, and `getLegalMoves`/move registration are engine-internal.

---

## Acceptance Criteria

> **Binary — PASS requires ALL TRUE. Any single FALSE = failed execution
> (STOP, do not interpret).**

1. `HeroKeyword` union + `HERO_KEYWORDS` array each contain
   `'optional-ko-reward'` (same index; the ONLY optional-KO-reward keyword); the
   parity drift test passes.
2. `HeroEffectDescriptor` has `rewardType?: HeroKeyword`; `LegendaryGameState`
   has `pendingOptionalKoRewards: PendingOptionalKoReward[]`, initialized `[]` at
   setup; `G` stays JSON-serializable.
3. Parsing the marked dangerous-rescue line yields exactly one effect
   `{ type: 'optional-ko-reward', rewardType: 'rescue', magnitude: 1 }` (+ the
   existing `[hc:covert]` condition/`conditional` keyword).
4. Playing the marked card with ≥1 card in hand/discard PARKS a
   `PendingOptionalKoReward` (no auto-KO); with 0 eligible it is a no-op + a
   `G.messages` line; the reward is NOT granted at play time.
5. `resolveOptionalKoReward({decline:true})` front-pops with no KO and no reward;
   `resolveOptionalKoReward({zone,cardId})` KOs that card (zone→`G.ko`) and grants
   the reward via the existing executor; an invalid card/zone is a no-op (move
   never throws); the reward never fires without the KO.
6. While `G.pendingOptionalKoRewards` is non-empty, action moves + turn-end are
   blocked (board freeze), exempting `resolveOptionalKoReward`,
   `resolveKoHeroChoice`, `resolveHeroChoice`; `getLegalMoves` short-circuits to
   `resolveOptionalKoReward`, and the bot default is the deterministic
   `selectDefaultOptionalKoTarget` (lowest-cost, discard-preferred) + reward.
7. `apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` gains EXACTLY
   `^\[keyword:optional-ko-reward:[a-z][a-z-]*:[1-9]\d*\]$`; re-running it changes
   EXACTLY 1 file (`core.json`) in EXACTLY 1 hunk affecting ONLY the
   dangerous-rescue line.
8. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 with the
   net-new cases; no pre-existing test regresses; sentinel unchanged (no fixture
   plays Dangerous Rescue) OR re-pinned per WP-236 discipline.
9. `git diff --name-only` lists exactly the files in `## Files Expected to Change`
   (final count locked in EC-279).

---

## Definition of Done

- [ ] All Acceptance Criteria (1–9) pass.
- [ ] `build` + `test` exit 0; apply-script single-hunk; drift greps pass.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` D-24019 Reserved → Active (byte-identical to the
      EC-279 §Verbatim Block).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-248 checked off; `EC_INDEX.md`
      EC-279 → Done.
- [ ] Paired EC-279 satisfied; WP-249 (UX) co-released (not merged engine-only
      into a player-visible release without the prompt).
- [ ] No files outside `## Files Expected to Change` modified.

---

## Pre-Flight & Copilot Verdicts (01.0a Step 5)

Gate order (pre-flight → copilot → lint), run in this drafting session against
`origin/main` (post WP-247 / D-24017 / #313 / #314):

- **Pre-flight (01.4): READY TO EXECUTE** (2026-06-13). Class: Behavior / State
  Mutation + new interactive move. The WP-242 infra reuse points were verified
  live: `G.pendingKoHeroChoices?` (`types.ts`), `resolveKoHeroChoice` +
  `hasPendingKoHeroChoice` (`moves/koHeroChoice.resolve.ts`), registration
  (`game.ts:304`), the `getLegalMoves` short-circuit (`simulation/ai.legalMoves.ts`),
  `selectDefaultKoTarget` (`villain/villainEffects.execute.ts`), lazy-init at
  point of use (`villainEffects.execute.ts:190`). Deps WP-021/022/023/215/242 ✅.
  Open pin: the board-freeze guard module (game.ts vs a shared helper) → ±1 file,
  resolved at execution pre-flight.
- **Copilot check (01.7): PASS** (2026-06-13). The three load-bearing risks are
  locked with HARD gates in EC-279: reward-reuse (dispatch, no re-impl),
  atomicity (reward only on KO), and three-choice coexistence (guards exempt all
  three resolve moves). No RISK/BLOCK.
- **Lint gate (00.3): PASS** (2026-06-13). §1 structure complete; §2 constraints
  (parameterized-not-per-card, reuse-not-fork, atomic, deterministic bot) present;
  §5 19-file count over-8 justified inline; §8 boundaries (no registry import in
  resolver/move; engine-only); §17 Vision; §20 Funding N/A; §21 API N/A — all
  satisfied or reasoned-N/A. No Final-Gate FAIL.
