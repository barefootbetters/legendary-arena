# WP-592 — Rogue "Steal Abilities": Discard-Top-and-Copy Hero Ability (Game Engine + Card Data)

**Status:** Ready
**Layer:** Game Engine (primary) + Card Data · **Lane:** Standard two-session (a
reentrant re-execution over a heterogeneous card set + `ctx.random` reshuffle —
determinism surface; the card-data marker restages `G.heroAbilityHooks`) ·
**Baseline:** `origin/main` @ `09baeef7` (WP-592 reservation) · **User-Visible
Surface:** play.legendary-arena.com

## Session Context

WP-535/D-24345 established the reentrant re-fire pattern (`applyCopyPowers` →
`executeHeroEffects` threading the full move-context wrapper) and the
`COPY_POWERS_EXT_ID` self-exclusion that fixed copy-of-copy recursion; WP-582/D-24391
extended Copy Powers to a full duplicate (copied economy + team). WP-535 explicitly
deferred **Steal Abilities** as "a related, harder copy mechanic; a separate follow-up
WP." This is that WP.

## Goal

Rogue's **Steal Abilities** (`core/rogue/steal-abilities`) is unimplemented — surfaced
from Jeff's live 2-player Red Skull / Midtown Bank Robbery game (turn 24). The card
prints *"Each player discards the top card of their deck. Play a copy of each of those
cards."* (cost 8, printed +4 attack, `hc:strength`). Playing it today applies only the
printed +4 attack — the discard-and-copy ability is a **silent no-op** (match log line
`24.2.9`: `"… (+4 attack) — Each player discards the top card of their deck. Play a copy
of each of those cards."` with no follow-on discard/copy lines). Root cause (grep-confirmed,
RS-1): there is **no `[keyword:…]` marker** for `steal-abilities` in
`hero-ability-markers.json` and **no handler** in `heroEffects.execute.ts`, so the ability
text is a keyword-less descriptor that is silently dropped (the D-24266 pattern). This WP
adds a new `steal-abilities` HeroKeyword and a handler that: (a) makes **each player**
discard the top card of their deck, then (b) has the Steal Abilities player **play a copy
of each discarded card** — its printed economy plus a re-fire of its on-play ability.

## User-Visible Impact

On `play.legendary-arena.com`, playing Steal Abilities makes every player discard the top
card of their deck (logged per player), and the Steal Abilities player then gains the
printed attack/recruit of each discarded card and re-fires each card's on-play ability
(e.g. a discarded S.H.I.E.L.D. Agent → +1 recruit; a discarded draw hero → its draw fires;
a discarded Wound → nothing). Any interactive choice raised by a copied ability (e.g. an
optional-KO) prompts through that ability's existing prompt. Every other card is unchanged.

## Assumes

- WP-535 complete. Specifically:
  - `packages/game-engine/src/hero/heroEffects.execute.ts` exports the reentrant
    `executeHeroEffects(G, ctx, playerID, cardId)` (`:440`) and `applyCopyPowers` (`:2195`),
    which threads the **full move-context wrapper** into the re-fire so a copied
    draw/reshuffle replays from `ctx.random`.
  - `COPY_POWERS_EXT_ID` self-exclusion (`:2109`) is the precedent for the recursion guard.
- WP-251/D-24022 complete — `HANDLED_KEYWORDS` (`:89`) → `MVP_KEYWORDS` (`:197`) →
  `HERO_EFFECT_HANDLERS` (`:2352`) is the keyword-dispatch spine.
- `reshuffleDiscardIntoDeck(playerZones, ctx)` (`moves/drawCards.logic.ts`, used at
  `heroEffects.execute.ts:1115`) is the D-24285 standard empty-deck reshuffle.
- `pnpm -r build` and `pnpm --filter @legendary-arena/game-engine test` exit 0 on baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Rule Execution Pipeline` + `§Zone & Pile Structure` — zones
  store `CardExtId` strings only; effect application uses `for`/`for...of`, never `.reduce()`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — read entirely. Key facts:
  - **Reentrant executor** — `executeHeroEffects(G, ctx, playerID, cardId)` (`:440`) resolves
    *any* card's hooks for an arbitrary `cardId`. A discarded card in another player's deck
    still has its hooks in `G.heroAbilityHooks` (built at setup for all decks), so a re-fire
    with the discarded card's ext_id works.
  - **Economy + re-fire precedent** — `applyCopyPowers` (`:2195`): adds the copied card's
    `G.cardStats` attack/recruit to `G.turnEconomy`, then calls `executeHeroEffects` with the
    **full move-context wrapper** (`:2257`). Steal Abilities reuses this economy+re-fire core
    but grants **no class/team** (D-24391 dual-class/team is Copy-Powers-specific) and points
    the `sourceCardId` at the Steal Abilities card.
  - **"Each player" iteration** — `heroEffectGainWound` (`gain-wound-each`, `:1010`) iterates
    `Object.keys(G.playerZones).sort()`; the discard phase reuses this deterministic seat order.
  - **Reshuffle-on-empty** — `heroEffectReveal` (`:1114-1116`) calls
    `reshuffleDiscardIntoDeck(playerZones, ctx as ShuffleProvider)` when the deck is exhausted
    mid-effect (D-24285). The discard phase does the same before taking a top card.
  - **Self-exclusion** — `COPY_POWERS_EXT_ID` (`:2109`) + `buildCopyPowersTargets` (`:2129`)
    strip the `#N` instance suffix to compare base ext_ids; the recursion guard mirrors this.
- `packages/game-engine/src/setup/buildInitialGameState.ts:450-451` — S.H.I.E.L.D. starters
  DO carry `G.cardStats` entries (Agent `+1 recruit`, Trooper `+1 attack`) under their bare
  ext_ids; `pile-wound` carries none → a copied Wound adds `0/0` and has no hooks.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — the closed `markupToken` set
  (D-21601); `scripts/convert-cards/apply-hero-ability-markers.mjs` regenerates the marker into
  `data/cards/core.json`.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`),
  Rule 8 (no `.reduce()` in effect application), Rule 9 (`node:` prefix), Rule 13 (ESM).

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Never use `Math.random()` — `ctx.random.*` only (here: `ctx.random.Shuffle` via
  `reshuffleDiscardIntoDeck`, reached through the threaded move-context wrapper).
- Never throw inside a move — the handler returns `void` on any missing zone/state.
- Never persist `G`/`ctx`; `G` stays JSON-serializable (no new field is added at all).
- ESM only; `node:` prefix on built-ins; test files `.test.ts`.
- No `.reduce()` in zone operations or effect application — explicit `for...of`.

**Packet-specific:**
- **No new pending-choice type, no new `G` field, no new move.** The handler is deterministic
  and synchronous; it does NOT park a `Pending*Choice` of its own. Therefore there is **no**
  block-all-guard change, **no** `game.ts` move registration, **no** `game.test.ts` move-count
  change, **no** `ai.legalMoves.ts` change, **no** `uiState.*` change, and **no** arena-client
  change. Any interactive choice comes only from a *copied* card's existing keyword handler,
  which already owns its pending type / projection / prompt / guard.
- **Copies are ephemeral** — the copy adds economy + re-fires the ability; it enters **no
  zone** and grants Steal Abilities **no class/team**. The real discarded cards stay in their
  owners' discard piles.
- **Recursion guard** — a discarded card whose base ext_id is **either** `core/rogue/steal-abilities`
  **or** `core/rogue/copy-powers` is never re-fired (economy only, logged). Both are reentrant-copy
  keywords that can re-target the just-played Steal Abilities card in the steal player's `inPlay`;
  excluding both bounds the Steal-Abilities ↔ Copy-Powers mutual re-fire. Mirror the
  `COPY_POWERS_EXT_ID` base-ext_id compare (strip `#N` before comparing).
- The `steal-abilities` union member and the `HERO_KEYWORDS` array entry are added **together**
  (drift test); adding the keyword requires the D-24401 entry.

**Session protocol:** if any field name, ext_id, or dispatch path is unclear, STOP and ask —
never guess.

## Debuggability & Diagnostics

- Fully reproducible from identical setup + seed + move order (the only randomness is the
  empty-deck reshuffle via the threaded `ctx.random`).
- Every discard and every copy appends a human-readable `G.messages` line (per-player discard;
  per-copy economy; the recursion-guard skip note), so a replay shows exactly what fired — the
  fix for the exact "the ability did nothing" confusion that surfaced this WP.
- Runtime state stays JSON-serializable; no cross-packet state is mutated.

## Design (fork locked-to-recommendation — operator confirms at review)

**Deterministic core (not a fork).** The handler runs two synchronous phases:

1. **Discard phase** — for each player in `Object.keys(G.playerZones).sort()` order: if the
   deck is empty, `reshuffleDiscardIntoDeck` first; if still empty, that player discards
   nothing; else move the top card to that player's discard pile and record `(playerID,
   discardedCardId)`. Log per player.
2. **Copy phase** — for each recorded discarded card in seat order, the Steal Abilities player
   "plays a copy": add its `G.cardStats` attack/recruit to `G.turnEconomy`, then re-fire its
   on-play ability via `executeHeroEffects(G, ctx, stealPlayerID, discardedCardId)` — threading
   the full move-context wrapper (the re-fire may draw/reshuffle). Log per copy.

**Recursion guard (not a fork).** In the copy phase, a discarded card whose base ext_id is
**either** `core/rogue/steal-abilities` **or** `core/rogue/copy-powers` gets its economy but is
**not** re-fired (logged skip). Excluding `steal-abilities` bounds the direct self-chain;
excluding `copy-powers` bounds the **mutual** re-fire the copilot gate surfaced — a re-fired
Copy Powers builds its targets from the steal player's `inPlay`, where the just-played Steal
Abilities card sits (a Rogue Hero, non-null class), so at exactly-one-eligible it auto-copies
Steal Abilities and re-fires it synchronously; nothing decreases monotonically (reshuffle-on-empty
recycles discards to deck-top), so it recurses to a stack overflow — the exact ~30s "connection
lost" server crash the `COPY_POWERS_EXT_ID` self-exclusion was written to kill. Both reentrant-copy
keywords are therefore economy-only when discarded-and-copied. **Two** termination tests: (a) a
Steal Abilities seeded on top of a deck; (b) a **Copy Powers** seeded on top of a deck with Steal
Abilities the only in-play Hero — each asserts the handler returns without unbounded recursion.

**Fork — cascade of copies whose abilities park an interactive choice.** A copied card's
ability may itself want to park a pending choice (optional-KO, defeat-with-bystander, copy
powers, …). Because the copy phase is one synchronous handler, it cannot pause mid-loop to
await a UI choice (pending choices resolve via *separate* later moves).

- **Fork A — FIFO-cascade (RECOMMEND).** Re-fire every copied ability fully through
  `executeHeroEffects`; a parked choice lands in that keyword's **existing** pending queue and
  the copy loop continues (all economies apply, choices resolve after the move via the existing
  block-all guards, FIFO). Faithful for the common case and requires no new machinery. **Risk
  to validate at scaffold:** `G.pendingHeroChoice` (from `reveal-attack-choose`) is the **only**
  single-slot pending type — every other pending field is a `[]` FIFO queue (verified in
  `types.ts`), so it is the concrete collision probe. The scaffold cascade matrix MUST exercise:
  (i) two copies that both park `reveal-attack-choose` (the single-slot collision); (ii) a copied
  `discard-to-play` card (Cyclops Determination/Optic Blast — the copy phase re-fires via
  `executeHeroEffects`, bypassing `playCard`'s D-24185 pre-commit precondition, so it parks its
  array-queue `PendingDiscardToPlay` directly — FIFO-safe, but confirm); (iii) a copied
  **purchased** hero (not just a starter) re-fires its ability via the reservoir-wide hooks. If
  the `reveal-attack-choose` collision corrupts the single slot, fall back to Fork B **for that
  keyword only**.
- **Fork B — economy-only for parking keywords (fallback).** Always apply economy; re-fire only
  keywords that resolve immediately; a parking keyword applies economy-only with a logged note.
  Safer and fully deterministic, but suppresses part of the copied ability.
- **Out of scope (future fidelity WP):** a strictly-serialized resumable copy sequence (park
  the "remaining copies" and resume after each nested choice) — that needs a new pending type
  and is a larger mechanic than this WP.

**Determinism.** No new `G` field is added, so the field-shape hash oracles cannot move for
that reason. The card-data marker DOES restage `G.heroAbilityHooks` for any game whose loadout
includes Rogue, and the new log lines feed the replay hash (`computeStateHash` keeps
`G.messages`, unlike `hashGameState`/`finalStateHash`). **Scaffold-first:** confirm whether any
committed fixture / sentinel plays Steal Abilities (or merely includes Rogue) and whether
`finalStateHash` / `PRE_WP080_HASH` / `sim:runtime-observed` need a documented re-pin; a re-pin
is a deliberate, documented change, never a silent re-baseline.

## Scope (In)

### A) New `steal-abilities` HeroKeyword
- `rules/heroKeywords.ts` — add `steal-abilities` to the `HeroKeyword` union (`:26`) **and**
  the `HERO_KEYWORDS` array (`:71`), together, with a `// why: WP-592 / D-24401` comment.

### B) Handler + dispatch registration
- `hero/heroEffects.execute.ts`:
  - `export const STEAL_ABILITIES_EXT_ID = 'core/rogue/steal-abilities' as CardExtId;` beside
    `COPY_POWERS_EXT_ID` (which is already exported).
  - `heroEffectStealAbilities(G, ctx, playerID, cardId, effect)` — the two-phase handler above,
    threading the move-context wrapper into `executeHeroEffects` for each re-fire; the copy phase
    skips the re-fire (economy-only) for a discarded card whose base ext_id is
    `STEAL_ABILITIES_EXT_ID` **or** `COPY_POWERS_EXT_ID`.
  - Register in `HERO_EFFECT_HANDLERS` (`:2352`) and add `steal-abilities` to
    `HANDLED_KEYWORDS` (`:89`) (→ `MVP_KEYWORDS` via the existing union).
  - A small shared economy helper (or reuse of the `applyCopyPowers` economy block) that adds
    `G.cardStats[cardId]` attack/recruit to `G.turnEconomy` **without** the class/team grant.

### C) Card data
- `scripts/convert-cards/inputs/hero-ability-markers.json` — marker `[keyword:steal-abilities]`
  on `rogue/steal-abilities` (abilityIndex 0), extending the closed `markupToken` set (D-21601).
- Regen `data/cards/core.json` via `apply-hero-ability-markers.mjs`, then regenerate **all**
  card-data-derived artifacts (see Verification): mechanic ledger (`ledger:heroes`), coverage,
  keyword feeds, and `sim:runtime-observed`.

### D) Tests (`hero/heroEffects.execute.test.ts` + `rules/heroAbility.setup.test.ts`)
- Discard phase: each player's top card moves to their own discard, seat order deterministic;
  empty-deck path reshuffles first (via a mock shuffle context); no-cards-anywhere discards nothing.
- Copy phase: a copied starter adds its printed economy; a copied hero re-fires its ability
  (a copied draw actually draws via the threaded `ctx.random`); a copied Wound adds `0/0`.
- Recursion guard: a discarded Steal Abilities AND a discarded Copy Powers are each economy-only
  and do not recurse — two termination tests: (a) Steal Abilities on top of a deck; (b) Copy Powers
  on top of a deck with Steal Abilities the only in-play Hero — neither loops unbounded.
- Fork A cascade (or Fork B, per operator): a copied optional-KO parks its existing pending
  type; a copied `discard-to-play` parks its array-queue directly; two copies parking
  `reveal-attack-choose` do not corrupt the single-slot `pendingHeroChoice`.
- Drift: `HERO_KEYWORDS` array === `HeroKeyword` union (non-vacuous — a synthetic bad member
  fails); `HANDLED_KEYWORDS` keys === `HERO_EFFECT_HANDLERS` keys.
- `JSON.stringify(G)` succeeds after the handler; no `boardgame.io` import; `makeMockCtx` only.

## Out of Scope

- **Any new pending-choice type / `G` field / move / arena-client change** — the handler is
  deterministic and reuses copied cards' existing prompts.
- **Strictly-serialized resumable copy sequence** (the Fork-A "single-slot collision" full fix)
  — a future fidelity WP.
- Copy Powers / give-HQ-Hero or any other existing pending choice — unchanged.
- Any refactor of `applyCopyPowers`, `executeHeroEffects`, or the reshuffle helper beyond
  extracting a shared economy helper if one is warranted.

## Files Expected to Change

*(Allowlist finalized at pre-flight; provisional from the surface map.)*

| File | Change |
|---|---|
| `packages/game-engine/src/rules/heroKeywords.ts` | `steal-abilities` in union + array |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | `heroEffectStealAbilities` + `STEAL_ABILITIES_EXT_ID` + `HERO_EFFECT_HANDLERS`/`HANDLED_KEYWORDS` |
| `packages/game-engine/src/hero/heroEffects.execute.test.ts` | handler / discard / copy / recursion / cascade / drift tests |
| `packages/game-engine/src/rules/heroAbility.setup.test.ts` | keyword union↔array drift pin update (runtime assertion) |
| `scripts/convert-cards/inputs/hero-ability-markers.json` | `[keyword:steal-abilities]` marker |
| `data/cards/core.json` | regenerated (marker) |
| card-data-derived artifacts | regenerated (`ledger:heroes`, coverage, keyword feeds, `sim:runtime-observed`) |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24401 Active at execution), `NUMBER-LEDGER.md`, `STATUS.md`.

No other files may be modified.

## Contract

- **`steal-abilities` HeroKeyword** — `onPlay`. The handler: (1) each player, in
  `Object.keys(G.playerZones).sort()` order, discards the top card of their deck to their own
  discard pile (reshuffle-on-empty via `reshuffleDiscardIntoDeck`; no-cards → discards nothing);
  (2) the Steal Abilities player plays a copy of each discarded card in that order — adds
  `G.cardStats[discardedCardId]` attack/recruit to `G.turnEconomy`, then re-fires
  `executeHeroEffects(G, fullMoveContext, stealPlayerID, discardedCardId)`.
- **Recursion guard** — a discarded card whose base ext_id === `STEAL_ABILITIES_EXT_ID` **or**
  `COPY_POWERS_EXT_ID` is economy-only (no re-fire), logged. Both are reentrant-copy keywords that
  can re-target the in-play Steal Abilities card; excluding both bounds the mutual re-fire.
- **ctx threading** — the handler receives the move-context WRAPPER (the same shape
  `executeHeroEffects`/`applyCopyPowers` require) and threads it unchanged into every re-fire
  and the reshuffle; passing `{G, playerID}` alone would crash a copied draw / reshuffle.
- **No mutation of `cardTraits`, no new `G` field.** Zones store `CardExtId` only. The copies
  do not enter `inPlay` and grant no class/team.

## Acceptance Criteria

1. Playing Steal Abilities makes every player discard the top of their deck (each logged); an
   empty deck reshuffles first; a player with no cards anywhere discards nothing.
2. The Steal Abilities player gains each discarded card's printed attack/recruit (a copied
   S.H.I.E.L.D. Agent → +1 recruit; a copied Wound → +0/0) and re-fires each card's on-play
   ability (a copied draw actually draws via the threaded `ctx.random`).
3. A discarded Steal Abilities AND a discarded Copy Powers are each economy-only and do not
   recurse — both termination tests (Steal Abilities on top; Copy Powers on top with Steal
   Abilities the only in-play Hero) complete without unbounded recursion.
4. A copied ability that parks an interactive choice reuses its existing pending type + prompt
   (Fork A), or applies economy-only for that keyword (Fork B) — per operator confirmation;
   no single-slot pending type is corrupted by a two-copy multi-park.
5. Drift: `HERO_KEYWORDS` === `HeroKeyword` union (non-vacuous); `HANDLED_KEYWORDS` ===
   `HERO_EFFECT_HANDLERS` keys.
6. Determinism: engine suite + `pnpm -r --no-bail test` green; no new `G` field; any
   `finalStateHash` / `PRE_WP080_HASH` / `sim:runtime-observed` shift is a deliberate,
   documented re-pin (scaffold-confirmed), never a silent re-baseline; all card-data `:check`
   gates current.

## Verification Steps

```pwsh
# Step 1 — build after all changes (rebuild packages before cross-package tests)
pnpm -r build
# Expected: exits 0

# Step 2 — engine + whole-workspace tests
pnpm --filter @legendary-arena/game-engine test
pnpm -r --no-bail test
# Expected: all green

# Step 3 — card-data regen chain, then confirm gates current
pnpm ledger:heroes
# Expected: ledger:heroes:check exits 0; sim:runtime-observed:check exits 0; card-data :check gates exit 0

# Step 4 — no Math.random in new/modified files
Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "Math.random"
# Expected: no output

# Step 5 — control-revert non-vacuous: neuter heroEffectStealAbilities (skip copy phase)
#          → the discard/copy tests fail; unrelated tests stay green

# Step 6 — scope
git diff --name-only
# Expected: only the allowlist + governance files; card-data diff is a real marker diff, not CRLF churn
```

## Definition of Done

- [ ] All ACs met; engine + whole-workspace + card-data `:check` gates green.
- [ ] No new `G` field / pending type / move; `game.test.ts` move-count unchanged.
- [ ] `finalStateHash` / `PRE_WP080_HASH` / `sim:runtime-observed` byte-identical, or a
      deliberate documented re-pin (scaffold-confirmed).
- [ ] `git diff --name-only` matches the allowlist; `pnpm -r build` 0.
- [ ] D-24401 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`;
      `roadmap:counts:check` 0; STATUS updated.
- [ ] Two-commit topology (`EC-627:` impl + `SPEC:` close).
- [ ] D-24026 live-verify (operator-pending): play Steal Abilities in a real match →
      each player discards; the copies' economy + abilities fire; the log shows it.
- [ ] Cascade fork (A FIFO vs B economy-only) confirmed by operator at review.

## Reserved Decisions (land at execution)

**D-24401** — Rogue "Steal Abilities" mechanic (full locked text in `NUMBER-LEDGER.md` §D):
deterministic synchronous handler (no new pending type / `G` field / move / arena-client
change); each player discards the top of their deck in `Object.keys(G.playerZones).sort()`
seat order (reshuffle-on-empty, D-24285); the Steal Abilities player plays a copy of each
discarded card = printed economy + a reentrant `executeHeroEffects` re-fire threading the full
move-context wrapper; copies are ephemeral and grant no class/team (a **deliberate** bounding —
a copy feeds economy + re-fires the ability only; unlike D-24391's full-duplicate merge, "a copy
of each card" is not a merge into the source card); recursion guard excludes **both** the
`steal-abilities` **and** `copy-powers` self/mutual re-fire (economy-only), mirroring
`COPY_POWERS_EXT_ID` — both are reentrant-copy keywords that can re-target the in-play Steal
Abilities card. New `steal-abilities` keyword (append-only). Cascade fork (A FIFO-cascade vs B
economy-only-for-parking-keywords) flagged operator-review. Hard-dep WP-535/D-24345 +
WP-251/D-24022.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1–§2 Structure / Constraints** — PASS.
- **§3 Assumes** — PASS (reentrant executor `:440`; `applyCopyPowers` economy+re-fire `:2195`;
  `COPY_POWERS_EXT_ID` self-exclusion `:2109`; `reshuffleDiscardIntoDeck` D-24285; all at source).
- **§4 Context** — PASS (surface map; starters-have-cardStats fact `:450-451`; the cascade fork
  with recommendation + risk; determinism/no-new-field analysis).
- **§5 Files** — PASS (small allowlist — engine + card-data only; no client, no pending-choice
  touch-point set, precisely because no new pending type is introduced).
- **§6 Naming** — PASS (`steal-abilities`, `heroEffectStealAbilities`, `STEAL_ABILITIES_EXT_ID`).
- **§7 Dependency** — PASS (WP-535 ✅, WP-251 ✅).
- **§8 Architecture** — PASS (engine decides; zones store `CardExtId` only; no `.reduce()` in
  effect application; `ctx.random` only via the threaded wrapper for reshuffle; no
  server/registry import in engine; no new `G` field).
- **§9 Cross-repo** — N/A. **§10 Conflict** — PASS (no in-flight edits to `heroEffects.execute.ts`
  keyword spine; reserve-first path taken for parallel safety). **§11 Migration** — N/A.
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-revert + non-vacuous drift;
  discard/copy/recursion/cascade coverage; termination test).
- **§13 Commands** — PASS (`pnpm -r build` before tests; whole-workspace + card-data `:check`
  gates; hash re-pin is scaffold-confirmed + documented, never silent).
- **§14 Acceptance Criteria** — PASS (6 testable ACs incl. determinism + recursion termination).
- **§15 Definition of Done** — PASS (incl. cascade-fork confirmation + D-24026 live-verify).
- **§16 Code Style** — PASS. **§17 Vision Alignment** — PASS (faithful card semantics; NG-1..7
  not crossed; fixes a silent-no-op the operator hit in a real game).
- **§18 Prose-vs-Grep** — PASS (file:line anchors from the surface map). **§19 Bridge-vs-HEAD** —
  PASS (baseline `09baeef7`).
- **§20 Funding Surface** — N/A. **§21 API Catalog** — N/A (no HTTP endpoint or server-import
  library-function change).

Determinism note (§17/§22): **no new `G` field**, so the field-shape oracles cannot move for
that reason; the card-data marker restages `G.heroAbilityHooks` for Rogue loadouts and the new
log lines feed the replay hash (`computeStateHash` keeps `G.messages`), so any
`finalStateHash` / `PRE_WP080_HASH` / `sim:runtime-observed` shift is scaffold-confirmed and
documented as a deliberate re-pin — never a silent re-baseline.

Pre-flight verdict (independent subagent, all load-bearing claims verified at source):
**READY TO EXECUTE**, no blocking PS. Three RS folded: RS-1 (a stale in-code comment at
`heroEffects.execute.ts:1125` claims starters have no `cardStats` — false since D-24237; noted as
a future hygiene fix, out of scope here); RS-2 (the scaffold must confirm a copied **purchased**
hero re-fires via reservoir-wide hooks, not just a starter — folded into the cascade matrix);
RS-3 (the copy phase bypasses `playCard`'s D-24185 pre-commit precondition, so a copied
`discard-to-play` parks its array-queue directly — folded into the cascade matrix). Confirmed
sound at source: the reentrant executor + full-wrapper threading, the `applyCopyPowers`
economy+re-fire precedent, the id-space (starters bare-keyed, hero-deck `#N`-keyed), the
dispatch spine, and the no-new-pending/field/move/client claim.

Copilot verdict (independent subagent): **BLOCK → resolved inline (scope-neutral, HOLD-class)**.
**Finding 1 (BLOCK, folded):** the recursion guard as first drafted excluded only the
`steal-abilities` self-copy and missed the **Steal-Abilities ↔ Copy-Powers mutual re-fire** — a
discarded Copy Powers, re-fired, auto-copies the in-play Steal Abilities card (a Rogue Hero, the
sole eligible target) and re-fires it, recursing to the `COPY_POWERS_EXT_ID` stack-overflow class;
the original single-vector termination test would have passed while the crash shipped. Fixed by
widening the guard to **both** reentrant-copy ext_ids (economy-only) and adding a second
termination test (Copy Powers on top of a deck) — no new `G` field/move, so no pre-flight re-run
required. Finding 2 (RISK, folded): the no-class/team bounding is now documented as deliberate in
D-24401. Findings 3–4 (nits, folded): the EC names the regen set as exactly what `ledger:heroes` +
the regen chain touch (each `:check`-gated), and names `reveal-attack-choose` as the concrete
single-slot collision probe. Confirmed sound: id-space correctness, the determinism/hash posture,
the non-vacuous drift + control-revert tests, and the EC line budget (84 lines).
