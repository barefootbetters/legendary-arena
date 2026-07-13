# WP-356 — `shuffle-discard-empty-reward` Hero Keyword (Jocasta Reprocess + Electromagnetic Eyebeams)

**Status:** Done 2026-07-12 (EC-386; D-24148 Active) · Standard two-session lane. **Baseline back-sync:** drafted against `origin/main @ 07099fd4` (engine 1877/438); executed against `e38f0314` after WP-364 landed two gain-wound keywords (engine 1903/444) — the locked +11/+3 delta held exactly (1914/447/0). See `## Amendments`.
**Primary Layer:** Game Engine / Implementation (+ card-data pipeline)
**Dependencies:** WP-021, WP-022 (hero ability hook pipeline); D-24019 (rewardType descriptor field); D-24139 (return-zero-cost-discard precedent shape)
**User-Visible Surface:** play.legendary-arena.com

---

## Session Context

WP-021/022 established the hero ability hook pipeline (`heroAbility.setup.ts` marker parsing → `HeroEffectDescriptor` → `HERO_EFFECT_HANDLERS` executors); D-24019 locked the 3-segment reward token grammar and the `rewardType` descriptor field; D-24139 shipped the sibling Defend-the-Weak keyword — this packet adds one new immediate (no-pending-choice) keyword on that substrate without modifying any of their outputs.

---

## Goal

After this session, `@legendary-arena/game-engine` executes the printed ability shared by Jocasta's **Reprocess** ("If your discard pile is empty, you get +2[icon:recruit]. Otherwise, shuffle your discard pile into your deck.") and **Electromagnetic Eyebeams** (same shape, +2[icon:attack]). Concretely: a new `'shuffle-discard-empty-reward'` member of `HeroKeyword`, a dedicated 3-segment marker extraction step in `heroAbility.setup.ts`, an immediate executor `heroEffectShuffleDiscardEmptyReward` registered in `HERO_EFFECT_HANDLERS`, marker rows for the two antm Jocasta cards in the card-data pipeline, and the regenerated `data/cards/antm.json` + hero-mechanic ledger. Both cards stop being hollow effects (diagnosed 2026-07-11 from a live game log: at 13.2.7 Reprocess failed to shuffle an 8-card discard, provable from the turn-14 deck cycle).

---

## User-Visible Impact

A player who plays Reprocess with a non-empty discard pile sees their discard pile actually shuffle into their deck (discard count drops to 0, deck count rises) and a game-log line reporting it; with an empty discard pile they see +2 recruit in the turn economy. Electromagnetic Eyebeams does the same with +2 attack. Today both cards visibly do nothing beyond their printed stat line.

---

## Assumes

- WP-021/WP-022 complete. Specifically:
  - `packages/game-engine/src/rules/heroKeywords.ts` exports `HeroKeyword` union + `HERO_KEYWORDS` canonical array
  - `packages/game-engine/src/rules/heroAbility.types.ts` exports `HeroEffectDescriptor` with optional `magnitude` and `rewardType` fields (D-24019) — this contract file is NOT modified by this packet
  - `packages/game-engine/src/setup/heroAbility.setup.ts` implements the marker-extraction pipeline with the `OPTIONAL_KO_REWARD_PATTERN` 3-segment precedent (its extraction step and seeded-rewards gate are the shape this packet mirrors)
  - `packages/game-engine/src/hero/heroEffects.execute.ts` exports the `HERO_EFFECT_HANDLERS` registry; handlers receive `(G, ctx, playerID, cardId, effect)`; the `heroEffectDraw` handler demonstrates narrowing `ctx` to `ShuffleProvider`
  - `packages/game-engine/src/setup/shuffle.ts` exports `shuffleDeck(cards: string[], context: ShuffleProvider): string[]` and `ShuffleProvider`
  - `packages/game-engine/src/moves/zoneOps.ts` exports `moveAllCards`
  - `packages/game-engine/src/economy/economy.logic.ts` exports `addResources` (signature order: attack, then recruit — verified against `heroEffectAttack`)
- `scripts/convert-cards/apply-hero-ability-markers.mjs` + `scripts/convert-cards/inputs/hero-ability-markers.json` exist (WP-216 pipeline); the two Jocasta ability lines are at `abilityIndex: 0` (verified 2026-07-11 against `data/cards/antm.json`)
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0 — baseline **1877 tests / 438 suites / 0 fail** at `origin/main @ 07099fd4` (2026-07-11)
- `docs/ai/DECISIONS.md` exists; D-24148 is reserved for this packet
- `docs/ai/ARCHITECTURE.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Architectural Principles` — read "Determinism" and "The Rule Execution Pipeline". The shuffle branch introduces a new `ctx.random.*` consumer; every use needs a `// why:` comment and replay-faithfulness.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` and `.claude/rules/architecture.md §Layer Boundary` — the engine edit must not import registry or boardgame.io in pure-helper files.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — read the `OPTIONAL_KO_REWARD_PATTERN` declaration, the `OPTIONAL_KO_REWARD_SEEDED_REWARDS` set, and extraction "Step 2e" entirely before adding the sibling step. This packet's parser mirrors that code path exactly.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — read `heroEffectDraw` (ShuffleProvider narrowing), `heroEffectAttack` / `heroEffectRecruit` (`addResources` argument order), and the `HERO_EFFECT_HANDLERS` registration block.
- `packages/game-engine/src/moves/drawCards.logic.ts` — read `drawCardsIntoHand`'s empty-deck reshuffle (the `moveAllCards` + `shuffleDeck` composition this packet reuses for the combined shuffle).
- `docs/ai/DECISIONS.md` — scan D-24019 (reward token grammar), D-24139 (sibling keyword), D-24029 (composable primitive substrate), D-24081 (G.messages hash exclusion).
- `docs/ai/REFERENCE/00.2-data-requirements.md §Hero card fields` — ability text and marker conventions for card data.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable constraints: no DB queries in move functions; all moves deterministic; `ctx.random.*` is the only permitted randomness source.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations), Rule 6 (`// why:` comments), Rule 9 (`node:` prefix), Rule 11 (full-sentence error messages), Rule 13 (ESM only), Rule 14 (field names match data contract).
- `data/cards/antm.json` — confirm the two Jocasta ability lines verbatim before editing the marker map.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Persistence Boundaries
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `packages/game-engine/src/rules/heroAbility.types.ts` must NOT be modified — the descriptor reuses the existing `magnitude` + `rewardType` fields (D-24019); adding a descriptor field is out of scope
- The effect is **mandatory and immediate**: no pending-choice queue, no new move, no UIState projection, no client prompt. The printed text offers no choice. (This deliberately avoids the pending-choice hard-freeze class — the block-all/projection/prompt trio is not needed because nothing blocks.)
- The empty-discard check reads `G.playerZones[playerID].discard.length === 0` at execution time — played cards are in `inPlay` and never count (tabletop rule: played cards stay in play until cleanup)
- Shuffle semantics locked: new deck = deterministic shuffle of (existing deck + entire discard) combined; discard becomes `[]`. Compose with `moveAllCards(discard, deck)` then `shuffleDeck(combined, ctx as ShuffleProvider)` — do not hand-roll a shuffle
- Reward grant goes through `addResources` on `G.turnEconomy` — `attack` adds `(magnitude, 0)`, `recruit` adds `(0, magnitude)`; never mutate economy fields directly
- Both branches append one human-readable line to `G.messages` (D-24081: messages are hash-excluded, so log lines are replay-safe)
- The seeded-rewards gate for this token accepts exactly `'recruit'` and `'attack'` — narrower than the D-24019 set; an unrecognized reward segment means the keyword is NOT emitted (the line stays a hollow-detectable no-op)
- Zero or missing magnitude → executor no-op (mirror `isValidMagnitude` usage in existing executors)
- Every `ctx.random.*`-reaching call (`shuffleDeck`) carries a `// why:` comment
- No `.reduce()` anywhere in the changed files

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human before proceeding — never guess or invent field names, type shapes, or file paths

**Locked contract values:**

- **Keyword slug (union + canonical array + marker token):** `shuffle-discard-empty-reward`
- **Marker token grammar (3-segment, mirrors D-24019):** `[keyword:shuffle-discard-empty-reward:<reward>:<n>]` where `<reward>` ∈ `recruit | attack` and `<n>` matches `[1-9]\d*` at build time (parser captures `(\d+)`; the n ≥ 1 gate is enforced downstream, same split as D-24019)
- **The two data rows (verbatim tokens):**
  - `antm` / heroSlug `jocasta` / cardSlug `reprocess` / abilityIndex `0` → `[keyword:shuffle-discard-empty-reward:recruit:2]`
  - `antm` / heroSlug `jocasta` / cardSlug `electromagnetic-eyebeams` / abilityIndex `0` → `[keyword:shuffle-discard-empty-reward:attack:2]`
- **Descriptor emitted by the parser:** `{ type: 'shuffle-discard-empty-reward', magnitude: <n>, rewardType: <reward> }` — no new `HeroEffectDescriptor` fields
- **PlayerZones keys:** `deck` | `hand` | `discard` | `inPlay` | `victory`
- **TurnStage values:** `'start'` | `'main'` | `'cleanup'`

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via deterministic reproduction and state inspection.

- Behavior is fully reproducible given identical setup configuration, RNG seed, and ordered moves — the shuffle consumes `ctx.random.Shuffle` only.
- Execution is externally observable: the empty-discard branch changes `G.turnEconomy`; the shuffle branch changes `G.playerZones[playerID].deck` / `.discard`; both branches append a `G.messages` line naming the card and the branch taken.
- Runtime state remains JSON-serializable; no cross-packet state is mutated outside declared scope.
- The pre-existing hollow-effect detector (WP-257) stops flagging these two cards once the handler is reachable — the runtime-observed hollows artifact is re-checked at close.

---

## Scope (In)

### A) Keyword contract (`packages/game-engine/src/rules/heroKeywords.ts` — modified)
- Add `'shuffle-discard-empty-reward'` to the `HeroKeyword` union AND to `HERO_KEYWORDS`, both with a `// why: D-24148` comment describing the mandatory immediate two-branch semantics (empty discard → reward via rewardType; otherwise combined deterministic shuffle of discard into deck).

### B) Marker parser (`packages/game-engine/src/setup/heroAbility.setup.ts` — modified)
- Add `SHUFFLE_DISCARD_EMPTY_REWARD_PATTERN = /\[keyword:shuffle-discard-empty-reward:([a-z][a-z-]*):(\d+)\]/g` with a `// why: D-24148` comment citing the D-24019 3-segment precedent (KEYWORD_PATTERN stops at the second colon).
- Add `SHUFFLE_DISCARD_EMPTY_REWARD_SEEDED_REWARDS: ReadonlySet<HeroKeyword>` containing exactly `'recruit'` and `'attack'`.
- Add a dedicated extraction step (sibling of Step 2e): on match, when the reward candidate is in the seeded set and magnitude ≥ 1, push the keyword, record the magnitude, and record the rewardType (same `rewardTypes` map mechanism as `optional-ko-reward`); the effect builder emits `{ type, magnitude, rewardType }`.

### C) Executor (`packages/game-engine/src/hero/heroEffects.execute.ts` — modified)
- `heroEffectShuffleDiscardEmptyReward(G, ctx, playerID, cardId, effect): void` —
  - guard: player zones exist; magnitude valid (≥ 1); `effect.rewardType` is `'recruit'` or `'attack'` — else silent no-op;
  - if `playerZones.discard.length === 0`: grant the reward via `addResources(G.turnEconomy, magnitude, 0)` for attack / `addResources(G.turnEconomy, 0, magnitude)` for recruit; `pushLog` one line naming the card, the empty-discard condition, and the grant;
  - otherwise: `moveAllCards(playerZones.discard, playerZones.deck)`, assign `discard` from the emptied source, assign `deck = shuffleDeck(combined, ctx as ShuffleProvider)`; `// why:` comment on the ShuffleProvider narrowing (deterministic replay; established `heroEffectDraw` pattern); `pushLog` one line naming the card and the counts shuffled.
- Register the handler under `'shuffle-discard-empty-reward'` in `HERO_EFFECT_HANDLERS`.

### D) Card-data pipeline
- **`scripts/convert-cards/inputs/hero-ability-markers.json`** — modified: append the two antm rows from Locked Values.
- **`scripts/convert-cards/apply-hero-ability-markers.mjs`** — modified: extend `VALID_TOKEN_PATTERN` with `^\[keyword:shuffle-discard-empty-reward:[a-z][a-z-]*:[1-9]\d*\]$` plus a `// why: D-24148` comment line (3-segment token, strict `[1-9]\d*` build gate, engine parser captures `(\d+)`).
- **`data/cards/antm.json`** — modified by running the apply script (exactly 2 ability lines gain a trailing marker; scaffold-verified 2026-07-11: "Processed: 139 entries / Updated: 2 lines", idempotent re-run is a zero-diff).
- **`docs/ai/coverage/hero-mechanic-ledger.csv`** — regenerated via `pnpm ledger:heroes` (scaffold-verified: the marker change stales `ledger:heroes:check`).

### E) Tests
Add `node:test` tests (each new group wrapped in exactly one `describe()` block — suite count is locked):
- **`packages/game-engine/src/rules/heroKeywords.test.ts`** — modified: one new `describe` asserting `'shuffle-discard-empty-reward'` is registered in `HERO_KEYWORDS` (1 test).
- **`packages/game-engine/src/rules/heroAbility.setup.test.ts`** — modified: one new `describe` with 4 parser tests: (1) recruit token → descriptor `{ type, magnitude: 2, rewardType: 'recruit' }`; (2) attack token → `rewardType: 'attack'`; (3) unrecognized reward segment (e.g. `:rescue:`) → keyword NOT emitted; (4) the marker text does not leak into the parsed condition/keyword set beyond the one effect.
- **`packages/game-engine/src/hero/heroEffects.execute.test.ts`** — modified: one new `describe` with 6 executor tests: (1) empty discard + recruit → turnEconomy recruit +2, zones unchanged; (2) empty discard + attack → turnEconomy attack +2; (3) non-empty discard → discard `[]`, deck length = prior deck + prior discard, order proves the mock shuffle ran (makeMockCtx reverse-shuffle), turnEconomy unchanged; (4) both branches append a `G.messages` line; (5) magnitude 0 → no-op (no zone change, no economy change); (6) `JSON.stringify(G)` succeeds after each branch.
- All tests use `makeMockCtx` / plain structural mocks; no `boardgame.io` imports in test files.

---

## Out of Scope

- No optional-shuffle variants — `dead` Electroplasmic Insanity ("you may shuffle…", compound with free-recruit) and `ssw2` Shuffling Footwork (class-gated "you may shuffle…") are different shapes (player choice → pending-queue + projection + prompt) and are explicitly deferred to a future WP
- No changes to `packages/game-engine/src/rules/heroAbility.types.ts` (locked contract; descriptor fields reused per D-24019)
- No new move, no pending-choice queue, no UIState projection, no arena-client changes
- No Flying Steed implementation (the other hollow flagged 2026-07-11 — master-strike reaction timing, separate WP)
- No changes to `drawCardsIntoHand` or the cleanup/draw pipeline
- No database, network, or filesystem access in any helper
- No server changes
- Refactors, cleanups, or "while I'm here" improvements are **out of scope** unless explicitly listed in Scope (In)

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — union + canonical array entry
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — 3-segment pattern, seeded-rewards set, extraction step
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — executor + registration
- `packages/game-engine/src/rules/heroKeywords.test.ts` — **modified** — drift/registration test
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — 4 parser tests
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — 6 executor tests
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 2 antm rows
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — VALID_TOKEN_PATTERN branch + `// why:`
- `data/cards/antm.json` — **modified** — regenerated (2 ability lines gain markers)
- `docs/ai/coverage/hero-mechanic-ledger.csv` + `hero-mechanic-ledger.json` — **modified** — regenerated (`pnpm ledger:heroes` writes both)
- `data/metadata/card-mechanics.json` — **modified** — regenerated (`pnpm mechanics:metadata`; the new keyword adds mechanics rows)
- `docs/ai/STATUS.md` — **modified** — session close
- `docs/ai/DECISIONS.md` — **modified** — D-24148 flips from reserved to Active
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-356 checked off
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-386 row (authored at execution-prep, per the live SPEC-draft convention)
- `docs/05-ROADMAP-MINDMAP.md` + roadmap counts artifact — **modified** — node added, `pnpm roadmap:counts --write` (close ritual; prevents the known orphan drift)

No other files may be modified. If `pnpm mechanics:metadata:check` or `pnpm sim:runtime-observed:check` report stale after the engine change lands, their artifacts are regenerated in the same commit (run all four card-data-derived checks before pushing).

---

## Vision Alignment

- **Vision clauses touched:** §1 (faithful card content semantics), §2 (content fidelity), §3 (trust & fairness), §8 (determinism/RNG sourcing), §22 (deterministic eval).
- **Conflict assertion:** No conflict: this WP preserves all touched clauses.
- **Non-Goal proximity check:** N/A — WP touches no monetization or competitive surface (no scoring, leaderboard, identity, or paid surface changes).
- **Determinism preservation:** the shuffle branch consumes `ctx.random.Shuffle` exclusively via the `ShuffleProvider` narrowing; given identical seed and move order the resulting deck order replays identically (Vision §22). `G.messages` additions are hash-excluded per D-24081.

## Funding Surface Gate

N/A — engine keyword + card-data change only; no UI funding affordances, no user-visible funding copy, no funding channels referenced (per §20.1, none of the trigger surfaces are present).

## API Catalog (00.3 §21)

N/A — no HTTP endpoints added, modified, removed, or re-statused; no `apps/server/src/**` library functions touched (engine + card-data pipeline only).

---

## Acceptance Criteria

### Keyword contract
- [ ] `HeroKeyword` union and `HERO_KEYWORDS` both contain `'shuffle-discard-empty-reward'`; drift test passes
- [ ] `heroAbility.types.ts` is byte-identical to `origin/main` (confirmed with `git diff`)

### Parser
- [ ] Recruit token on a synthetic ability line yields exactly one effect `{ type: 'shuffle-discard-empty-reward', magnitude: 2, rewardType: 'recruit' }`
- [ ] Attack token yields `rewardType: 'attack'`
- [ ] A token with an unrecognized reward segment emits NO `shuffle-discard-empty-reward` effect

### Executor
- [ ] Empty discard + recruit reward → `G.turnEconomy` recruit rises by the magnitude; deck and discard unchanged
- [ ] Non-empty discard → discard becomes `[]`, deck contains all prior deck + discard cards, mock reverse-shuffle order observed, economy unchanged
- [ ] Both branches append one `G.messages` line
- [ ] Magnitude 0 is a silent no-op
- [ ] No `throw` in the executor (confirmed with `Select-String`)

### Card data
- [ ] `node scripts/convert-cards/apply-hero-ability-markers.mjs` reports exactly 2 updated lines on first run and 0 on re-run (idempotent)
- [ ] `pnpm ledger:heroes:check`, `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm roadmap:counts:check` all exit 0 at close

### Tests
- [x] `pnpm --filter @legendary-arena/game-engine test` exits 0 — **1914 tests / 447 suites / 0 fail** (1903 + 11 new; 444 + 3 new describes; baseline refreshed by WP-364, delta unchanged)
- [ ] New tests use `node:test` + `node:assert` only; no `boardgame.io` imports

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: 1914 tests, 447 suites, 0 fail (WP-364-refreshed baseline + the locked +11/+3)

# Step 3 — marker application is idempotent
node scripts/convert-cards/apply-hero-ability-markers.mjs
git diff --stat -- data/cards/antm.json
# Expected: second run reports 0 updated lines; diff shows exactly the 2 marked ability lines vs origin/main

# Step 4 — card-data-derived gates are current
pnpm ledger:heroes:check; pnpm mechanics:metadata:check; pnpm sim:runtime-observed:check; pnpm roadmap:counts:check
# Expected: all exit 0

# Step 5 — no wall-clock or ambient randomness in changed engine files (see D-3701 for the forbidden list)
Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts","packages\game-engine\src\setup\heroAbility.setup.ts" -Pattern "Math\.random"
# Expected: no output

# Step 6 — locked contract file untouched
git diff origin/main -- packages/game-engine/src/rules/heroAbility.types.ts
# Expected: no output

# Step 7 — no files outside scope were changed
git diff --name-only origin/main
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = play.legendary-arena.com):** after deploy, a real match with Jocasta in the loadout shows Reprocess played with a non-empty discard pile producing a game-log shuffle line and an observed discard→deck count change (diagnostics JSON or log capture as evidence). Green tests + merged PR alone do NOT satisfy this item. (D-24026)
- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [x] `pnpm --filter @legendary-arena/game-engine test` exits 0 at 1914/447/0
- [ ] All four card-data-derived `:check` gates exit 0
- [ ] No `Math.random` in any new or modified file (confirmed with `Select-String`)
- [ ] `heroAbility.types.ts` not modified (confirmed with `git diff`)
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — Reprocess + Electromagnetic Eyebeams now execute; hollow count reduced by 2
- [ ] `docs/ai/DECISIONS.md` updated — D-24148 flipped to Active (post-execution)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-356 checked off with the execution date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node added + `pnpm roadmap:counts --write` regenerated in the close commit

---

## Lint Gate Self-Review

Recorded per `00.3-prompt-lint-checklist.md` (drafted 2026-07-11):

- §1 Structure — PASS (all ten required sections present and non-empty; Out of Scope lists seven exclusions)
- §2 Constraints — PASS (engine-wide block intact, full-file output rule, 00.6 referenced, packet-specific + session protocol + locked values present)
- §3 Assumes — PASS (every consumed export named with file path; baseline recorded; blocking clause present)
- §4 Context — PASS (ARCHITECTURE.md sections named; 00.2 referenced for card-data shape; DECISIONS scan list named)
- §5 Output completeness — PASS (every file marked modified with one-line description; no diff/patch language; 10 code/data files + governance, above the ~8 guidance but each entry is a one-line mechanical touch — split not warranted because the marker/ledger rows are regenerated artifacts of the same single mechanic)
- §6 Naming — PASS (ext_id, heroDeckIds spellings; no new field names introduced)
- §7 Dependencies — PASS (no new npm packages; forbidden packages not touchable by scope)
- §8 Boundaries — PASS (engine-only mutation via move-context handlers; no registry import; randomness via ctx.random)
- §9 Windows — PASS (pwsh Select-String verification steps)
- §10 Env vars — PASS (none required; none introduced)
- §11 Auth — N/A (packet does not touch authentication)
- §12 Test quality — PASS (node:test only, makeMockCtx reverse-shuffle proves shuffle ran, no boardgame.io imports, no network/DB)
- §13 Verification — PASS (exact pnpm/node commands with expected output)
- §14 Acceptance — PASS (binary, observable, specific; aligned to scope)
- §15 DoD — PASS (STATUS/DECISIONS/WORK_INDEX + scope-boundary check + D-24026 live-on-surface item; surface declared in header)
- §16 Code style — PASS (constraints encode no-abbreviations, `// why:` requirements, full-sentence errors, no reduce)
- §17 Vision — PASS (section present with clause numbers, no-conflict assertion, NG proximity, determinism line)
- §18 Prose-vs-grep — PASS (Step 5 grep pattern token appears only inside the verification block itself; prose cites D-3701 instead of enumerating forbidden tokens)
- §19 Bridge staleness — N/A at draft (commit-time discipline; baseline SHA re-checked at commit)
- §20 Funding — N/A with justification (see §Funding Surface Gate block)
- §21 API catalog — N/A with justification (see §API Catalog block)

---

## Amendments (execution session, 2026-07-12 — scope-neutral)

1. **Icon-suppression (load-bearing correctness fix).** The parser's icon step (Steps 2b/3) was already emitting a flat **unconditional** `+2` effect from the printed `+2[icon:X]` on both target lines — the cards were never fully hollow; they over-granted on every play, and this explains the +2-recruit anomaly observed in the diagnosis trace (turn 9). Without suppression, the new conditional effect would double-grant on the empty-discard branch and phantom-grant on the shuffle branch. Resolution: a suppression mirroring the D-24016 count-scaled precedent drops the plain icon keyword matching the seeded rewardType whenever a `shuffle-discard-empty-reward` effect is emitted. Test-pinned: both parser tests assert exactly one effect per line.
2. **Executor-level magnitude floor.** `isValidMagnitude` deliberately admits 0 (reveal-family semantics), so the WP's "magnitude 0 → no-op" acceptance criterion is enforced by an explicit `magnitude >= 1` floor inside the executor, per the D-24019 downstream convention — not by the upstream pre-gate as drafted.
3. **Regen-output allowlist additions (mechanical).** `pnpm ledger:heroes` writes a `.json` sibling next to the `.csv`, and the new keyword stales `data/metadata/card-mechanics.json` (144 mechanics) — both regenerated artifacts folded into `## Files Expected to Change`.

Same keyword, token grammar, descriptor shape, executor semantics, file allowlist shape, and locked test delta as drafted. D-24148 records amendments 1–2.
