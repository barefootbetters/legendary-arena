# WP-724 — Split / dual-faced hero "choose a side": engine + setup

**Status:** Draft 2026-09-21 · **EC:** EC-761 · **Reserves:** D-24545, D-24546
**Primary Layer:** Game Engine + Setup (Registry-adjacent, no schema change)
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (cross-layer arc with WP-725; new pending-choice contract + hashed-map surface + determinism-adjacent — NOT lightweight-eligible)

## Goal

Un-defer **D-14101** so a **split / dual-faced hero card** — one physical card whose
`physicalCards[].sides` carries two face slugs (e.g. `cvwr/peter-parker` `p1` =
`["hot-bowl-of-soup","protect-my-family"]`) — is playable as **either face, chosen when
the card is PLAYED** (faithful Marvel Legendary "choose a side"). After this packet the
engine enumerates BOTH faces' economy / ability-hooks / display into `G` at setup, parks
a block-all `PendingSplitFaceChoice` for the active player on play, and a server-only
`resolveSplitFaceChoice` move binds the chosen face — granting **that face's** attack /
recruit and firing **that face's** ability, with the other face doing nothing. Verified via
tests + the Play Diagnostics `uiStateSnapshot`; the player-facing picker is **WP-725**.

## User-Visible Impact

A player who plays a split hero card (39 such cards across 5 sets — cvwr / mgtg / xmen /
msis / bkwd, 26 heroes) is offered the two halves and picks one; the chosen half's
resources and ability resolve. Today the second half is unreachable — operator-confirmed
live on deployed `gitSha df9291f`: Peter Parker's Hot Bowl of Soup / Protect My Family
card **always** resolved Hot Bowl of Soup and Protect My Family could never be played. This
packet ships the engine half (the choice is observable in Play Diagnostics + drives the
correct economy/ability); the on-screen picker lands in WP-725, which carries the D-24026
live-verify for the combined arc.

## Assumes

- **D-14101 / D-14102 / D-13502 / D-13804** (`docs/ai/DECISIONS.md`) — the `physicalCards[].sides`
  model: each side is a full `cards[]` entry; the per-side instance ext_id grammar
  `<setAbbr>/<heroSlug>/<cardSlug>#<copyIndex>` is unchanged; today `sides[0]` is the sole
  stand-in (the deferral this packet lifts).
- **Registry carries both faces already** — `packages/registry/src/schema.ts` `HeroCardSchema`
  gives each side its own `cards[]` entry, and the `HeroSchema` `superRefine` orphan-side check
  guarantees every `physicalCards[].sides[]` slug resolves to a `cards[].slug`. **No registry
  schema change and no card-data regen** — both faces are authored.
- **WP-719 / D-24541 ✅** — the block-all pending-choice pattern (park a choice, resolve via a
  server-only `resolve*` move, replicate the block-all guard across every action move + the sim
  short-circuit + both `MOVE_MAP`s). The file-set model.
- **WP-702 / D-24521 ✅**, **WP-286 / D-24069 ✅** — additional pending-choice precedents.
- **WP-476 / D-24284 ✅** — an interactive choice is ALWAYS active-player-scoped; the split-face
  choice is the active player's alone.
- The existing **Transform** machinery (`buildTransformTargets` + `G.transformTargets` +
  `heroEffects.execute.ts` strip-`#copyIndex`-to-base-key lookup) — the strip-and-map idiom this
  packet mirrors for the face swap.
- `pnpm -r build` exits 0 and the engine + arena-client suites are green on `origin/main`.

## Context (Read First)

- `docs/ai/DECISIONS.md` D-14101 / D-14102 / D-13804 / D-13502 (the deferral + the ext_id/deck-size
  model this lifts), and the new reservations D-24545 / D-24546.
- `.claude/rules/architecture.md` §Zone Contents (CardExtId strings only), §UIState Projection
  Integrity (Board-Visible Field Rule — 5-step), §Move Validation Contract.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (engine decides; client submits intent), §Rule
  Execution Pipeline, §Persistence Boundaries (`G` runtime-only).
- `packages/game-engine/src/setup/buildHeroDeck.ts` — `heroCardInstanceExtIds` (~L446–534, the
  single deck/stats/hooks emitter, `sides[0]` at L479), `buildHeroDeckCards`, `buildTransformTargets`
  (~L787–831, the strip-and-map model).
- `packages/game-engine/src/economy/economy.logic.ts` `buildCardStats` §1b (~L286–333),
  `packages/game-engine/src/setup/buildCardDisplayData.ts` §1b (~L388–460, its own inline `sides[0]`
  walk), `packages/game-engine/src/setup/buildCardTraits.ts` (~L195–215), and
  `packages/game-engine/src/setup/heroAbility.setup.ts` `buildHeroAbilityHooks` (~L2744–2880) — the
  four sibling maps keyed by the instance ext_id.
- `packages/game-engine/src/moves/coreMoves.impl.ts` `playCardCore` (~L269–316) — where economy is
  granted and `executeHeroEffects` fires, all keyed off the played `cardId`.
- WP-719 as the pending-choice reference: `moves/coveringFireChoice.resolve.ts`, `game.ts` move
  registration + `game.test.ts` moves-count pin, `simulation/ai.legalMoves.ts` `SIMULATION_MOVE_NAMES`,
  `simulation/simulation.runner.ts` + `simulation/par.aggregator.ts` `MOVE_MAP`s, `ui/uiState.{types,build,filter}.ts`,
  `index.ts`.
- `docs/ai/REFERENCE/00.6-code-style.md` (no abbreviations, `// why:` comments, ESM, `node:` prefix,
  full-sentence errors), `docs/ai/REFERENCE/00.2-data-requirements.md` §physicalCards/sides.

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- Never `Math.random()` — randomness via `ctx.random.*` only; no I/O in moves/helpers.
- Moves never throw (return void on invalid input); only `Game.setup()` may throw.
- `G` stays JSON-serializable (no functions/Maps/Sets/classes); `G`/`ctx` never persisted.
- All zones store `CardExtId` strings only; zone mutations go through `zoneOps.ts`.
- ESM only, Node v22+, `node:` prefix; test files `.test.ts`; full file contents, no diffs.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; no `.reduce()` in zone/effect ops.

**Packet-specific:**
- `G.heroDeck` composition is **UNCHANGED** — still `count` copies of the `sides[0]` instance per
  physical card (no deck-build order/hash change). Alternate-face instances are added ONLY to the
  sibling maps (`cardStats` / `heroAbilityHooks` / `cardDisplayData` / `cardTraits`) + `G.splitFaces`,
  never to the reservoir.
- The per-side ext_id grammar (D-13502) is unchanged — alternate faces reuse
  `<setAbbr>/<heroSlug>/<sides[1]>#<copyIndex>`.
- `G.pendingSplitFaceChoices` is runtime-only, lazy-initialised, and **never** written in
  `Game.setup()` (the WP-719 pending-queue rule).
- The split-face choice is **active-player-scoped** (D-24284); no non-active seat ever chooses.
- No new `HeroKeyword`, no new `HeroEffect` handler — split is a **structural** property of a
  physical card (`sides.length === 2`), detected at setup, not a `[keyword:…]` marker. `HERO_KEYWORDS`
  / `HERO_EFFECT_HANDLERS` drift counts are UNCHANGED.
- Every `ctx.events.*` call (none expected) and every determinism-relevant decision carries a `// why:`.

**Session protocol:** if any field name, ext_id shape, or hash surface is unclear, STOP and ask —
never guess.

**Locked contract values:** `PendingSplitFaceChoice = { playerID: string; sourceCardId: CardExtId;
faceA: CardExtId; faceB: CardExtId }`; `resolveSplitFaceChoice({ face: 'a' | 'b' })`, server-only
(`client: false`); `UIPendingSplitFaceChoice = { playerID: string; faceA: {...}; faceB: {...} }`
(per-face name / abilityText / cost / attack / recruit, chooser-redacted).

## Scope (In)

### A) Setup — enumerate both faces (buildHeroDeck.ts + the three sibling builders)
- Extend `heroCardInstanceExtIds` so a split physical card (`sides.length === 2`) yields, per copy,
  a **primary-face** instance (`sides[0]`, `isPrimaryFace: true`) AND an **alternate-face** instance
  (`sides[1]`, `isPrimaryFace: false`), each with its own `<setAbbr>/<heroSlug>/<cardSlug>#<copyIndex>`
  ext_id. Solo cards (`sides.length === 1`) are unchanged (one primary instance).
- `buildHeroDeckCards` (the reservoir) includes **primary-face instances only** — deck composition
  and copy counts are byte-unchanged (D-14102 `physicalCards[].count` arithmetic preserved).
- `economy.logic.ts:buildCardStats` §1b + `heroAbility.setup.ts:buildHeroAbilityHooks` (both already
  consume `heroCardInstanceExtIds`) now key **all** instances (primary + alternate) — each resolved
  from its own `cards[]` entry by `instance.cardSlug`.
- `buildCardDisplayData.ts` §1b + `buildCardTraits.ts` (their own inline `sides[0]` walks) gain the
  parallel alternate-face pass so the second face has a display + traits entry keyed by its ext_id.
  `imageUrl` reuses `physicalCard.imageUrl` (one whole-card image shows both halves).

### B) Setup — the split-face map (buildHeroDeck.ts, mirroring buildTransformTargets)
- New `buildSplitFaces(...)` producing `G.splitFaces`: a copy-agnostic base→alternate map
  `<setAbbr>/<heroSlug>/<sides[0]>` → `<setAbbr>/<heroSlug>/<sides[1]>` for every 2-sided physical
  card, wired into `buildInitialGameState`. Data-only, JSON-serializable, immutable.

### C) Play-time park (coreMoves.impl.ts `playCardCore`)
- Before granting economy or firing hooks, strip `#copyIndex` from the played `cardId` to the base
  key; if it is in `G.splitFaces`, the card enters `inPlay` as its primary-face instance, economy +
  ability are **deferred**, and ONE `PendingSplitFaceChoice { playerID, sourceCardId: cardId,
  faceA: cardId, faceB: <alternate base>#<copyIndex> }` is pushed (lazy-init). Non-split plays are
  unchanged.

### D) Resolve move (new `moves/splitFaceChoice.resolve.ts`)
- `resolveSplitFaceChoice({ face })`: validate a pending choice exists for the active player; if
  `face === 'b'`, relabel the `inPlay` entry from `faceA` to `faceB` (zoneOps); grant the CHOSEN
  face's `G.cardStats[chosenExtId]` attack/recruit to `G.turnEconomy`; fire the chosen face's
  ability via `executeHeroEffects(G, context, playerID, chosenExtId)`; append a `G.messages` line;
  pop the queue. Invalid / wrong-player / empty-queue → silent no-op. Server-only.

### E) Block-all guard + sim dispatch
- `hasPendingSplitFaceChoice(G)` predicate; replicate the block-all guard across every action move
  (the WP-719 set: `coreMoves.impl.ts` ×3, `fightVillain`, `fightMastermind`, `recruitHero`,
  `recruitOfficer`, `dodgeCard`, `healWounds`, `villainDeck/villainDeck.reveal.ts`) + `game.ts`.
- `SIMULATION_MOVE_NAMES` + both `MOVE_MAP`s (`simulation.runner.ts` + `par.aggregator.ts`) +
  the `ai.legalMoves.ts` short-circuit emitting `resolveSplitFaceChoice` with a deterministic bot
  default (`{ face: 'a' }`).

### F) UIState projection + audience filter + re-export
- `UIPendingSplitFaceChoice` on `ui/uiState.types.ts`; populate in `ui/uiState.build.ts` (front of
  the queue, both faces' display fields); pass through `ui/uiState.filter.ts` chooser-redacted (only
  the seat matching `playerID` receives it — Board-Visible Field Rule 5-step); re-export the type
  from `index.ts`.

### G) Drift pins + versioning
- Bump the moves-count RUNTIME assertion in `game.test.ts` (+1 for `resolveSplitFaceChoice`).
- Handle the two new `G` fields (`splitFaces`, `pendingSplitFaceChoices`) consistently with their
  siblings (`transformTargets`, `pendingCoveringFireChoices`) in `versioning.migrate.ts` and any
  state-hash inclusion/exclusion (see determinism below).

### H) Tests (`node:test`, `makeMockCtx`, no boardgame.io import)
- Setup: a split hero yields both faces in `cardStats`/`heroAbilityHooks`/`cardDisplayData`/`cardTraits`
  and `G.splitFaces`; `G.heroDeck` copy count is unchanged (regression pin).
- Play: playing a split instance parks a choice and grants NO economy / fires NO ability until resolve.
- Resolve: `face: 'a'` grants faceA economy + fires faceA ability; `face: 'b'` swaps + grants faceB
  economy + fires faceB ability; invalid/wrong-player/empty-queue no-op; queue pops.
- Block-all: an action move is a no-op while a split-face choice is pending.
- `JSON.stringify(G)` succeeds after each mutation.

## Out of Scope

- The player-facing picker component + client wiring — **WP-725** (`SplitFaceChoicePrompt.vue`,
  `UiMoveName`, End-Turn gate, PlayDesktop/PlayMobile).
- Any change to the per-side ext_id grammar (D-13502) or the deck-size arithmetic (D-14102).
- Any registry schema change or card-data regeneration (both faces are already authored).
- Recruit-time side selection — the side is bound at PLAY time only (D-24546).
- The Transform mechanic (base→second-form side deck) — unrelated and unchanged.
- A per-physical-instance identity channel (`physicalInstanceId`) — explicitly deferred by D-13804.

## Files Expected to Change

Engine: `setup/buildHeroDeck.ts` — **modified** (both-face emit + `buildSplitFaces`);
`economy/economy.logic.ts` — **modified** (both-face stats); `setup/buildCardDisplayData.ts` —
**modified** (alternate-face display); `setup/buildCardTraits.ts` — **modified** (alternate-face
traits); `setup/heroAbility.setup.ts` — **modified** (both-face hooks); `setup/buildInitialGameState.ts`
— **modified** (`G.splitFaces` + `G.pendingSplitFaceChoices` init wiring); `types.ts` — **modified**
(`PendingSplitFaceChoice`, `G.splitFaces`, `G.pendingSplitFaceChoices`); `moves/splitFaceChoice.resolve.ts`
— **new**; `moves/coreMoves.impl.ts` — **modified** (play-time park + block-all ×3); `moves/fightVillain.ts`,
`moves/fightMastermind.ts`, `moves/recruitHero.ts`, `moves/recruitOfficer.ts`, `moves/dodgeCard.ts`,
`moves/healWounds.ts`, `villainDeck/villainDeck.reveal.ts` — **modified** (block-all guard); `game.ts`
— **modified** (register move + guard); `hero/heroEffects.execute.ts` — **modified** (resolve dispatch
if needed); `versioning.migrate.ts` — **modified** (two new fields); `simulation/ai.legalMoves.ts`,
`simulation/simulation.runner.ts`, `simulation/par.aggregator.ts` — **modified** (sim dispatch);
`ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` — **modified** (projection +
filter); `index.ts` — **modified** (re-export).
Engine tests: `moves/splitFaceChoice.resolve.test.ts` — **new**; `game.test.ts`,
`setup/buildHeroDeck.test.ts`, `economy/economy.logic.test.ts`, `setup/heroAbility.setup.test.ts`,
`setup/buildCardDisplayData.test.ts` — **modified**.

No other files may be modified. No card-data (`data/cards/*.json`) change.

## Contract

- `PendingSplitFaceChoice = { playerID: string; sourceCardId: CardExtId; faceA: CardExtId; faceB: CardExtId }`;
  `G.pendingSplitFaceChoices?: PendingSplitFaceChoice[]` FIFO (lazy-init, never in setup).
- `G.splitFaces?: Record<CardExtId, CardExtId>` — copy-agnostic base(sides[0])→alternate(sides[1]),
  setup-built, immutable, JSON-serializable.
- `resolveSplitFaceChoice({ face: 'a' | 'b' })` — server-only (`client: false`).
- `UIPendingSplitFaceChoice = { playerID: string; faceA: UISplitFaceOption; faceB: UISplitFaceOption }`
  where `UISplitFaceOption = { extId: CardExtId; name: string; abilityText?: string; cost: number | null;
  attack: number; recruit: number }`, chooser-redacted.
- Drift pin: moves count +1 (RUNTIME assertion, `game.test.ts`). `HERO_KEYWORDS` /
  `HERO_EFFECT_HANDLERS` UNCHANGED (no keyword/handler added).

## Acceptance Criteria

- A split hero (e.g. `cvwr/peter-parker`) produces, per copy, entries for **both** faces in
  `G.cardStats`, `G.heroAbilityHooks`, `G.cardDisplayData`, and `G.cardTraits`; `G.splitFaces` maps
  each split base to its alternate.
- `G.heroDeck` copy count for that hero is **byte-identical** to before this packet (deck composition
  unchanged; regression-pinned).
- Playing a split instance grants NO attack/recruit and fires NO ability until the choice resolves.
- `resolveSplitFaceChoice({ face: 'a' })` grants the sides[0] face's economy + fires its ability;
  `{ face: 'b' }` swaps the inPlay ext_id to the sides[1] face and grants/fires **that** face.
- While a split-face choice is pending, every action move (play/fight/recruit/dodge/heal/reveal) is a
  no-op; the choice surfaces in the Play Diagnostics `uiStateSnapshot`, chooser-redacted for opponents.
- Solo (single-side) cards are entirely unaffected (regression-pinned).
- `pnpm --filter @legendary-arena/game-engine build` + engine suite green; moves-count pin bumped;
  `sim:runtime-observed:check` current; `finalStateHash` unchanged (sentinel plays no split hero — CONFIRM).

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/registry --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass, moves-count pin reflects +1

# Step 3 — no new HeroKeyword / handler drift
Select-String -Path "packages\game-engine\src\rules\heroKeywords.ts" -Pattern "split"
# Expected: no output (split is structural, not a keyword)

# Step 4 — determinism gate
pnpm sim:runtime-observed:check
# Expected: exits 0, artifact byte-current (no regen)

# Step 5 — sentinel hash
#   confirm the core-2p-Doom sentinel finalStateHash is byte-identical (no split hero in the sentinel)
pnpm --filter @legendary-arena/game-engine test -- --test-name-pattern "finalStateHash"
# Expected: pin green, unchanged

# Step 6 — scope
git diff --name-only
# Expected: only the ## Files Expected to Change allowlist; no data/cards/*.json
```

## Definition of Done

- [ ] **User-visible verification (CONDITIONAL):** surface is `play.legendary-arena.com`; the live
      D-24026 verification is carried by **WP-725** (the arc's on-screen picker). This engine packet's
      done-state is proven by the engine suite + the `uiStateSnapshot` diagnostic showing the pending
      choice — recorded in STATUS.md, with the live-on-surface check explicitly deferred to WP-725.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; engine suite green; moves-count pin bumped in `game.test.ts`.
- [ ] `G.heroDeck` copy-count regression pin green (composition unchanged).
- [ ] `sim:runtime-observed:check` exits 0; `finalStateHash` unchanged (CONFIRM; honest re-pin only if
      a committed split-hero fixture is added).
- [ ] No files outside `## Files Expected to Change`; no `data/cards/*.json` change (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — the engine can now resolve a chosen split-hero face; picker is WP-725.
- [ ] `docs/ai/DECISIONS.md` — D-24545 + D-24546 flipped to Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-724 checked off with date; `docs/05-ROADMAP-MINDMAP.md`
      node flipped `📝`→`✅` + `pnpm roadmap:counts:write`, `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:** §1 / §2 (card content semantics — split cards now faithful), §3 / §8 / §22
  (determinism), NG-1 (no pay-to-win).
- **Conflict assertion:** No conflict — this preserves all touched clauses; it makes existing printed
  card behavior faithful (the second face was inert), affects no monetization surface, and is off-ranking.
- **Non-Goal proximity:** NG-1 not crossed — the choice is a gameplay decision, never buyable.
- **Determinism preservation:** the pending queue + `splitFaces` are runtime-only / setup-derived;
  seat iteration is deterministic; no `Math.random()`; `G.heroDeck` order unchanged. The sentinel
  (core-2p-Doom) plays no split hero, so `finalStateHash` is unchanged — CONFIRMED at execution via the
  hash pin + `sim:runtime-observed:check`; a split-hero PAR/simulation-corpus loadout would shift and be
  re-pinned honestly.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1–4:** all required sections present (Goal/Assumes/Context/Scope In+Out/Files/Constraints/AC/
  Verification/DoD).
- **§5–7:** closed file allowlist; no new npm deps; no forbidden packages.
- **§6/§12/§8 field names:** `MatchSetupConfig` untouched; new field names (`splitFaces`,
  `pendingSplitFaceChoices`, `PendingSplitFaceChoice`, `faceA/faceB`) are new engine/UI names consistent
  with sibling pending choices; canonical `physicalCards`/`sides`/`ext_id` spellings preserved.
- **§8 layer boundary:** engine + setup only; client submits intent (WP-725); no upward imports; registry
  unchanged.
- **§9 Windows:** verification uses `pwsh` / `Select-String`.
- **§11 auth:** N/A — no authentication surface.
- **§12 tests:** `node:test` + `makeMockCtx`, no boardgame.io import, deterministic; a `G.heroDeck`
  copy-count regression pin + a setup golden.
- **§13 verification:** exact `pnpm` commands with expected output above.
- **§16 code style:** small functions, `// why:` on the play-time park branch + the swap + determinism
  notes, no `.reduce()` in zone/effect ops, full-sentence errors.
- **§17 Vision Alignment:** present above (card semantics + determinism).
- **§18 prose-vs-grep:** Step 3 greps `split` in `heroKeywords.ts`; no prose in that file enumerates it.
- **§20 Funding Surface Gate:** N/A — no funding affordance, navigation, profile, or donate copy is
  touched; engine + setup only.
- **§21 API Catalog:** N/A — no `apps/server` HTTP endpoint or `Library-only` function added or changed.

**Pre-flight:** READY (dependencies all ✅ on `main`; scope locked; the pending-choice + Transform
strip-and-map patterns are established precedents; the deck-composition-unchanged constraint keeps the
determinism surface minimal). **Copilot:** PASS (the historically under-scoped pieces — the four sibling
builders keyed off the emitter, the sim three-site lockstep, the audience-filter pass-through, and the
two-new-`G`-field versioning — are all in the allowlist and covered by drift + setup + suite tests).
