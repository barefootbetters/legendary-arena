# WP-382 — `ko-wound-reward` Hero Keyword (auto-resolve "you may KO a Wound → reward"; Engine + Data)

**Status:** Ready
**Primary Layer:** Game Engine / Implementation + Card Data
**Dependencies:** WP-248 / D-24019 (`optional-ko-reward` — the near-exact template), WP-017 (`WOUND_EXT_ID`, `G.ko`, `koCard`), WP-021/022/023 (the hero-effect keyword + parser + executor substrate), WP-364 (the gain-wound hero-keyword precedent + marker pipeline)
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `f7cfe14a` (WP-381 heal overlay).

---

## Session Context

`optional-ko-reward` (WP-248 / D-24019) already implements *"you may KO **a card** from hand or discard; if you do, `<reward>`"* as an interactive parked choice, KO'ing **any** card. **Healing Factor** (`core/wolverine/healing-factor`) and a family of 11 sibling cards print the **Wound-restricted** form *"You may KO **a Wound** from your hand or discard pile. If you do, `<reward>`."* — which the existing keyword cannot express (it would let the player KO a valuable Hero). These cards are currently **hollow**: unmarked prose that logs its text and does nothing (confirmed in a live Red Skull game 2026-07-15 where Healing Factor was played ~10 times with no Wound KO'd and no card drawn). This packet adds a Wound-restricted, **auto-resolving** keyword `ko-wound-reward` and marks the family.

---

## Goal

After this session, `@legendary-arena/game-engine` recognizes a new hero keyword `ko-wound-reward` carrying a `rewardType` + magnitude. When a hero card with `[keyword:ko-wound-reward:<rewardType>:<n>]` is played, the engine **immediately** KOs one Wound from the player's hand (preferring hand, else discard) to `G.ko` and grants the reward (`draw` / `attack` / `recruit`, magnitude `n`) by reusing `executeSingleEffect`; if the player holds no Wound in either zone, nothing happens (a `G.messages` no-op line, per D-24017). The nine core-vocabulary family cards (rewards `draw` / `attack` / `recruit`) are marked so they stop being hollow. Healing Factor's *"KO a Wound → draw a card"* now works.

---

## User-Visible Impact

A player who plays **Healing Factor** (or eight sibling cards) with a Wound in hand or discard now sees the Wound removed to the KO pile and the printed reward applied (a drawn card / added attack / added recruit) — where today the card visibly does nothing. With scheme twists handing out Wounds regularly, these cards become the deck-thinning tool they are meant to be.

---

## Assumes

- WP-248 / D-24019 complete: `optional-ko-reward` exists — the keyword, its parser token `[keyword:optional-ko-reward:<rewardType>(:<n>)?]` (`heroAbility.setup.ts`), and its executor's reward-dispatch idiom `executeSingleEffect(G, ctx, playerID, sourceCardId, { type: rewardType, magnitude })` (`optionalKoReward.resolve.ts:134`).
- WP-017 complete: `WOUND_EXT_ID = 'pile-wound'` (`setup/pilesInit.ts`); `koCard(koPile, cardId)` (`board/ko.logic.ts`); `moveCardFromZone(zone, [], cardId)` removes a specific card from a zone (`moves/zoneOps.ts`).
- The hero-effect substrate exists: the `HeroKeyword` union + `HERO_KEYWORDS` array (`rules/heroKeywords.ts`); the executor's `HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS`, `NO_MAGNITUDE_KEYWORDS`, `MVP_KEYWORDS` sets + the `executeSingleEffect` / `heroEffectDraw` helpers (`hero/heroEffects.execute.ts`); the drift tests asserting union↔array and handler-map↔`HANDLED_KEYWORDS` parity.
- The marker pipeline exists: `scripts/convert-cards/apply-hero-ability-markers.mjs` (+ `VALID_TOKEN_PATTERN`) reads `scripts/convert-cards/inputs/hero-ability-markers.json` and appends tokens to `data/cards/*.json`.
- `pnpm -r build` exits 0; engine test + the `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` gates green on `f7cfe14a`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `packages/game-engine/src/hero/heroEffects.execute.ts` — read `heroEffectOptionalKoReward` (~line 1137, the park handler + the `OPTIONAL_KO_REWARD_SEEDED_REWARDS` gate + the empty-zone no-op log) and `heroEffectDraw` (~line 557, `drawFromPlayerDeck`). The new handler is a **non-parking** combination of this + the resolve move's KO step.
- `packages/game-engine/src/moves/optionalKoReward.resolve.ts` — read Steps 4-6 (~line 113-137): `moveCardFromZone(zone, [], cardId)` → `koCard` → `executeSingleEffect(G, context, playerID, sourceCardId, { type: rewardType, magnitude })`. The new handler does exactly this inline (with the Wound filter).
- `packages/game-engine/src/rules/heroKeywords.ts` — the `HeroKeyword` union + `HERO_KEYWORDS` array; add `'ko-wound-reward'` to both (in lockstep — the drift test asserts parity).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — read the `OPTIONAL_KO_REWARD_PATTERN` (~line 201) + its Step-2 extraction (~line 724) + the `OPTIONAL_KO_REWARD_SEEDED_REWARDS` gate (~line 280). Mirror them for the `ko-wound-reward` token.
- `packages/game-engine/src/setup/pilesInit.ts` / `board/ko.logic.ts` / `moves/zoneOps.ts` — confirm `WOUND_EXT_ID`, `koCard`, `moveCardFromZone` signatures verbatim.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — the `VALID_TOKEN_PATTERN` (~line 59) that gates legal marker tokens.
- `docs/ai/work-packets/WP-364-hero-gain-wound-keyword.md` — the effect-authoring precedent (marker rows, the three `:check` regen obligations, the Honest-Partial deferral convention).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — hero card `abilities` shape; the marker appends to an existing ability line, changing no canonical field.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`), Rule 7/8 (no `.reduce()`; explicit `for...of`), Rule 13 (ESM).
- `docs/ai/DECISIONS.md` — scan D-24019 (`optional-ko-reward`), D-24017 (empty-supply no-op logging), D-24156 (gain-wound keywords), and the reserved D-24183 at the tail of this WP.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness via `ctx.random.*` (only the draw reward's deck-exhaustion reshuffle, via the engine's deterministic shuffle)
- Moves/effects never throw — the executor returns `void`; unknown/unseeded rewards log a no-op and continue (never throw)
- Never persist `G`/`ctx`; `G` stays JSON-serializable
- ESM only, Node v22+; `node:` prefix on Node built-ins; test files `.test.ts`
- No `.reduce()` in zone operations — explicit `for...of`
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- The KO target is filtered to `WOUND_EXT_ID` **only** (imported from `pilesInit.ts`, never the `'pile-wound'` literal). Hand is preferred; if no Wound in hand, KO from discard; if neither, no-op.
- The keyword **auto-resolves immediately** in the executor — it does **not** park a `Pending*` choice, add a resolve move, a `UIState` projection, or a client prompt (see Out of Scope for the rationale and the explicit scope boundary).
- The reward is dispatched by **reusing `executeSingleEffect`** with `{ type: rewardType, magnitude }` — no re-implementation of draw/attack/recruit. Reward vocabulary for this WP: `draw` | `attack` | `recruit` (the `KO_WOUND_REWARD_SEEDED_REWARDS` closed set).
- Adding `'ko-wound-reward'` requires updating **both** the `HeroKeyword` union **and** the `HERO_KEYWORDS` array (drift-checked); and registering the handler in **both** `HANDLED_KEYWORDS` **and** `HERO_EFFECT_HANDLERS` (drift-checked). Never one without the other.
- The keyword **carries a magnitude** (the reward magnitude) → it is **NOT** in `NO_MAGNITUDE_KEYWORDS` (mirroring `optional-ko-reward`).
- Marker tokens use the form `[keyword:ko-wound-reward:<rewardType>:<magnitude>]` and must pass `VALID_TOKEN_PATTERN`. Marking touches only `abilities[i]` text — no other card-data field.
- After any card-data marker change, **regenerate all derived artifacts** (`mechanics:metadata`, `ledger:heroes`, `sim:runtime-observed`) and commit them — a stale derived artifact fails its `:check` gate.

**Session protocol:**
- If a card's ability text or `abilityIndex` is ambiguous, stop and confirm against `data/cards/*.json` — never guess a marker row.

**Locked contract values (do not re-derive):**
- **New keyword:** `'ko-wound-reward'`
- **Wound ext_id:** `WOUND_EXT_ID = 'pile-wound'` (import from `setup/pilesInit.ts`)
- **Reward vocabulary (this WP):** `draw` | `attack` | `recruit`
- **Marker token form:** `[keyword:ko-wound-reward:<rewardType>:<magnitude>]`
- **Reward dispatch:** `executeSingleEffect(G, ctx, playerID, sourceCardId, { type: rewardType, magnitude })`

---

## Debuggability & Diagnostics

- The effect is deterministic and observable: playing a marked card with a Wound present removes exactly one `WOUND_EXT_ID` from hand (or discard) into `G.ko` and applies the reward; with no Wound present it appends a `G.messages` no-op line and mutates nothing else.
- Reproducible from identical setup + ordered plays; the only randomness is the draw reward's deterministic reshuffle on deck exhaustion.
- A `G.messages` line is appended on both the KO+reward path and the no-Wound no-op path (D-24017 pattern), so the hollow-effect diagnostics and the replay inspector show why the ability did or did not fire.

---

## Scope (In)

### A) Keyword union + array — `packages/game-engine/src/rules/heroKeywords.ts` (**modified**)
- Add `'ko-wound-reward'` to the `HeroKeyword` union and the `HERO_KEYWORDS` array (lockstep). `// why:` cites D-24183: Wound-restricted, auto-resolving variant of `optional-ko-reward`.

### B) Executor handler — `packages/game-engine/src/hero/heroEffects.execute.ts` (**modified**)
- Add `heroEffectKoWoundReward(G, ctx, playerID, cardId, effect)`: locate a Wound (hand first, else discard) by scanning for `WOUND_EXT_ID`; if none, `pushLog` a no-op and return; if the `rewardType` is absent or not in `KO_WOUND_REWARD_SEEDED_REWARDS`, `pushLog` an "unsupported reward, skipped" line and return; else `moveCardFromZone(zone, [], WOUND_EXT_ID)` → `G.ko = koCard(G.ko, WOUND_EXT_ID)` → `pushLog` the KO line → `executeSingleEffect(G, ctx, playerID, cardId, { type: rewardType, magnitude: effect.magnitude ?? 1 })`.
- Add the `KO_WOUND_REWARD_SEEDED_REWARDS = new Set(['draw', 'attack', 'recruit'])` closed set.
- Register the handler in `HERO_EFFECT_HANDLERS` and add `'ko-wound-reward'` to `HANDLED_KEYWORDS` (lockstep). Do **not** add it to `NO_MAGNITUDE_KEYWORDS`.

### C) Parser token + extraction — `packages/game-engine/src/setup/heroAbility.setup.ts` (**modified**)
- Add a `KO_WOUND_REWARD_PATTERN = /\[keyword:ko-wound-reward:([a-z][a-z-]*)(?::(\d+))?\]/g` (mirror `OPTIONAL_KO_REWARD_PATTERN`) + a Step-2 extraction block that pushes the `ko-wound-reward` keyword with `rewardType` (capture 1) and `magnitude` (capture 2, default 1), gated by a `KO_WOUND_REWARD_SEEDED_REWARDS` set (mirror the optional-ko-reward seeded-reward gate).

### D) Marker build-gate — `scripts/convert-cards/apply-hero-ability-markers.mjs` (**modified**)
- Extend `VALID_TOKEN_PATTERN` to accept `[keyword:ko-wound-reward:<rewardType>:<magnitude>]`.

### E) Marker data + regenerated card data — `scripts/convert-cards/inputs/hero-ability-markers.json` (**modified**) + `data/cards/*.json` (**modified, regenerated**)
- Add one marker row per the **nine core-vocabulary family cards** (the printed *"you may KO a Wound from your hand or discard pile"* whose reward is `draw` / `attack` / `recruit`): **draw** — Healing Factor (`core`), 1 in `dstr`; **attack** — 1 in `core`, `cvwr`, `3dtc`, `msp1`, `mdns`; **recruit** — 1 in `ff04`, `msis`. Each row `{ heroSlug, cardSlug, abilityIndex, markupToken: "[keyword:ko-wound-reward:<rewardType>:<n>]" }` with the magnitude read from the printed reward. Run `apply-hero-ability-markers.mjs` to append the tokens; the regenerated `data/cards/*.json` for the affected sets are committed.

### F) Derived artifacts — **regenerated**
- Run `pnpm mechanics:metadata`, `pnpm ledger:heroes`, and `pnpm sim:runtime-observed` (or the repo's canonical regen scripts) and commit the updated artifacts, so the nine cards move out of the hollow/unhandled columns and each `:check` gate passes.

### G) Tests
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` (**modified**): a marked play KOs a Wound from hand (reward granted); from discard when hand has none; a play with no Wound in either zone is a no-op (nothing KO'd, no reward, a `G.messages` line); an unseeded reward logs+skips; the KO'd card is `WOUND_EXT_ID` and a valuable Hero in hand is never KO'd; `JSON.stringify(G)` succeeds.
- Keyword drift is covered by the existing `HERO_KEYWORDS` / handler-map parity tests (they now include `ko-wound-reward`) — extend the pinned expected sets if the drift test enumerates them literally.

---

## Out of Scope

- **No pending-choice / prompt UX.** The effect **auto-resolves** (always KO a Wound when one is present; hand-first). Rationale (the explicit scope boundary): unlike `optional-ko-reward` (which KOs *any* card, so *decline* and *which card* are strategically meaningful), a Wound is a fungible dead card and KO-plus-reward is pure upside — a rational player never declines and never cares hand-vs-discard, so an auto-resolve captures ~100% of play. The literal "you may" decline and the hand/discard choice are deliberately dropped; a richer pending-choice variant (decline / hand / discard prompt, ~+6 files: `Pending*` field, resolve move, `game.ts` registration, block-all guards, `UIState` projection, client prompt + bot) is a possible future WP, not this one.
- **No reward-vocabulary beyond `draw` / `attack` / `recruit`.** The three deferred family cards — **no-reward** (`cvwr`, `xmen`: KO a Wound with no reward) and **Berserk-again** (`wpnx`) — stay hollow (Honest-Partial); a bare-KO reward and a Berserk reward are separate follow-ups.
- **No change to `optional-ko-reward`** or any other existing keyword/move — the new keyword is additive.
- **No Enraging-Wound variants** and **no universal Healing move change** (WP-379).
- **No client / UIState change** — auto-resolve produces no pending state to project.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — `ko-wound-reward` union + array
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — handler + seeded-reward set + registration
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — handler tests
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — parser token + extraction
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — `VALID_TOKEN_PATTERN`
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — nine marker rows
- `data/cards/core.json`, `data/cards/dstr.json`, `data/cards/cvwr.json`, `data/cards/3dtc.json`, `data/cards/msp1.json`, `data/cards/mdns.json`, `data/cards/ff04.json`, `data/cards/msis.json` — **modified (regenerated)** — the appended tokens
- The regenerated derived artifacts for `mechanics:metadata`, `ledger:heroes`, `sim:runtime-observed` (the committed `--check` targets) — **modified (regenerated)**
- (conditional) sentinel/golden replay fixtures — **regenerated** only if a recorded game plays a newly-marked card (see Acceptance Criteria); via the canonical record tool, never hand-edited

No other files may be modified.

---

## Vision Alignment

**Vision clauses touched:** §1/§2 (faithful card rules — implementing a printed hero ability), §8/§22 (determinism / replay-faithful simulation — the effect changes what the balance sweep observes).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` Implementing a hollow printed ability makes the engine more faithful (§1/§2).

**Non-Goal proximity check:** none of NG-1..7 crossed — a core co-op/solo hero effect; no monetization, no pay-to-win, no PvP.

**Determinism preservation:** the effect is deterministic (Wound KO + reward; only the draw reward's deck-exhaustion reshuffle uses the engine's deterministic shuffle). It **does** change simulation outcomes for the newly-marked cards, so the `sim:runtime-observed` artifact regenerates (a derived, deterministic record), and if the sentinel replay plays a marked card its `finalStateHash` is re-pinned via the canonical record tool (never hand-edited). Given identical setup + moves the game replays identically.

## Funding Surface Gate

N/A — no funding affordance / channel / user-visible donate-support copy. An engine hero-effect + card-data change.

## API Catalog

N/A — no HTTP endpoint / `apps/server/src/**` library function; the effect runs inside a hero-play move over the boardgame.io state push.

---

## Acceptance Criteria

All items are binary pass/fail.

### Keyword + executor
- [ ] `'ko-wound-reward'` is in both the `HeroKeyword` union and `HERO_KEYWORDS`; the handler is in both `HERO_EFFECT_HANDLERS` and `HANDLED_KEYWORDS`; it is NOT in `NO_MAGNITUDE_KEYWORDS`; the drift tests pass.
- [ ] Playing a marked card with a Wound in hand KOs exactly one `WOUND_EXT_ID` from hand to `G.ko` and applies the reward (`draw` draws 1 card, `attack`/`recruit` add to `G.turnEconomy`); a Hero in hand is never KO'd.
- [ ] With no Wound in hand but one in discard, it KOs from discard; with no Wound in either zone, it is a no-op (nothing KO'd, no reward) plus a `G.messages` line.
- [ ] An unseeded/absent reward logs an "unsupported, skipped" line and KOs nothing.
- [ ] `JSON.stringify(G)` succeeds after the effect.

### Data + artifacts
- [ ] The nine core-vocabulary family cards carry `[keyword:ko-wound-reward:<rewardType>:<n>]`; `apply-hero-ability-markers.mjs --validate` passes; no non-ability card-data field changed.
- [ ] `pnpm mechanics:metadata:check`, `pnpm ledger:heroes:check`, and `pnpm sim:runtime-observed:check` all pass (artifacts regenerated in this commit); the nine cards are no longer hollow/unhandled.
- [ ] Sentinel/golden replay verification passes: either unchanged, or re-pinned via the canonical record tool (never hand-edited) if a recorded game plays a marked card.

### Build / scope
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` passes.
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass (new handler + drift)

# Step 3 — marker validation
node scripts/convert-cards/apply-hero-ability-markers.mjs --validate
# Expected: no drift

# Step 4 — derived-artifact gates
pnpm mechanics:metadata:check
pnpm ledger:heroes:check
pnpm sim:runtime-observed:check
# Expected: all exit 0 (artifacts regenerated + committed)

# Step 5 — the executor identifies a Wound by the imported constant, not a literal
Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "'pile-wound'"
# Expected: no NEW output introduced by this WP (WOUND_EXT_ID is imported)

# Step 6 — scope check
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):** in a **real deployed match**, playing Healing Factor with a Wound in hand KOs the Wound and draws a card (observable via the hand/KO pile + the game log), on the deployed bundle (green tests + merge alone do NOT satisfy it).
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` passes.
- [ ] `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` all pass with regenerated artifacts.
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — Healing Factor's family (9 cards) now KO a Wound + reward instead of no-op'ing.
- [ ] `docs/ai/DECISIONS.md` updated — land D-24183 (the `ko-wound-reward` auto-resolve keyword) as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-382 checked off with today's date.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All 10 required sections present; `Out of Scope` lists ≥2 excluded items (pending-choice UX, the no-reward/Berserk family members, `optional-ko-reward` changes, Enraging Wounds).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session protocol + locked values; references 00.6.
- **§3 Assumes** — PASS. WP-248/017/021-023/364 named with exact exports/helpers + green baseline.
- **§4 Context (Read First)** — PASS. Specific files + the `optional-ko-reward` template + `00.2` (hero `abilities` shape) + `00.6`.
- **§5 Files** — PASS. ~8 named files + 8 regenerated `data/cards/*.json` + the three derived artifacts — a large but standard effect-authoring data footprint (the WP-364 precedent); the regenerated files are a tooling category, not hand edits.
- **§6 Naming** — PASS. `ko-wound-reward`, `WOUND_EXT_ID`, `rewardType`, canonical `draw`/`attack`/`recruit`; no abbreviations.
- **§7 Dependency discipline** — PASS. No new npm dependency.
- **§8 Architectural boundaries** — PASS. Engine effect + card data only; no registry import in the executor; no `.reduce()` in the zone op; `G` JSON-serializable; deterministic.
- **§9 Windows** — PASS. `pwsh` `Select-String` + `pnpm` verification.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. Engine `node:test`; no `boardgame.io/testing`; covers KO-from-hand/discard, no-Wound no-op, Hero-never-KO'd, unseeded-reward skip, JSON-roundtrip.
- **§13 Verification** — PASS. Exact `pnpm` + marker-validate + the three `:check` commands with expected output.
- **§14 Acceptance criteria** — PASS. Binary, grouped, observable.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX + scope check; `User-Visible Surface = play.legendary-arena.com`; §15.1 live-on-surface (D-24026).
- **§16 Code style** — PASS. Explicit `for...of`/`moveCardFromZone` (no `.reduce()`), reuse of `executeSingleEffect`, JSDoc, `// why:` on the Wound filter + reward dispatch + `NO_MAGNITUDE` omission.
- **§17 Vision Alignment** — PASS (triggered: card data/content semantics §1/§2 + determinism/simulation §8/§22). Section present with clause numbers, no-conflict, NG check, and the determinism-preservation line (the sim-outcome cascade + conditional sentinel re-pin).
- **§18 Prose-vs-grep** — PASS. Verification Step 5 greps `heroEffects.execute.ts` for `'pile-wound'` (source-file scoped); the WP's mention of the literal in Locked Values is out of the grep's file scope; the executor imports `WOUND_EXT_ID`.
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding affordance/channel/copy — an engine hero-effect + card data.
- **§21 API Catalog** — N/A. No HTTP endpoint / `apps/server/src/**` library function; the effect runs inside a hero-play move.

**Lint verdict: PASS (all 21 resolved; 5 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-07-15).**

- **Sequencing / dependencies:** WP-248 ✅ (`optional-ko-reward` template), WP-017 ✅ (`WOUND_EXT_ID`/`koCard`/`moveCardFromZone`), WP-021/022/023 ✅ (hero-effect substrate), WP-364 ✅ (marker pipeline) — all landed; verified by direct source read of the executor, resolve move, keyword arrays, and parser.
- **Green baseline:** `main @ f7cfe14a` (measured this session): `pnpm -r build` exits 0; engine suite **1957 / 0**.
- **Scope lock:** the `Files Expected to Change` allowlist is closed; `git diff --name-only` is a DoD gate. The regenerated `data/cards/*.json` + derived artifacts are named as the tooling category.
- **Contract fidelity:** the handler is a non-parking combination of `heroEffectOptionalKoReward`'s empty-zone/seeded-reward guards + the resolve move's `moveCardFromZone`→`koCard`→`executeSingleEffect` step, with the sole addition of the `WOUND_EXT_ID` filter; the parser token mirrors `OPTIONAL_KO_REWARD_PATTERN`.
- **RS-1 (clarification, non-blocking):** the exact nine marker rows (`heroSlug`/`cardSlug`/`abilityIndex`) are curated at execution against `data/cards/*.json` — the WP fixes the set (draw ×2, attack ×5, recruit ×2) and the token form; the executor confirms each row's index (the WP-364 curation precedent).
- **RS-2 (clarification, non-blocking):** whether the sentinel replay re-pins is resolved at execution by running the suite — likely only the `runtime-observed` sweep artifact changes (the sentinel's short recorded game may not play a marked card).
- **PS items (blocking):** none.

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (2026-07-15).** The pre-flight READY verdict stands; all 30 issues scan PASS. This is a well-precedented effect-authoring WP (a Wound-restricted clone of `optional-ko-reward`) with a clearly documented auto-resolve boundary.

Selected findings:
- **#2 (determinism)** — PASS. The effect is deterministic (only the draw reward's deterministic reshuffle touches RNG). The sim-outcome cascade is explicit: regenerate `runtime-observed`; re-pin the sentinel via the canonical record tool only if a recorded game plays a marked card (the AC/EC flag any hash shift as a STOP-and-investigate).
- **#4 (contract drift)** — PASS. `ko-wound-reward` added to the union + `HERO_KEYWORDS` + `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS` in lockstep; the parity drift tests enforce it.
- **#12 (scope creep)** — PASS. Large data footprint but a closed allowlist + `git diff --name-only` gate; the reward vocabulary and card family are explicitly bounded (Honest-Partial deferral of no-reward/Berserk).
- **#22 (silent vs loud)** — PASS. Empty-zone and unseeded-reward paths `pushLog` a no-op (D-24017) and return; effects never throw.
- **#26 (implicit content semantics)** — PASS. The auto-resolve boundary (dropping the "you may" decline + hand/discard choice) is documented as an explicit, decided scope boundary with its rationale.

**Disposition: CONFIRM** — session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24183 (reserved; Drafted 2026-07-15, not yet landed)** — A new hero keyword `ko-wound-reward` implements the printed *"you may KO a Wound from your hand or discard pile; if you do, `<reward>`"* family (Healing Factor and 8 siblings). It is a **Wound-restricted, auto-resolving** variant of `optional-ko-reward` (D-24019): the executor immediately KOs one `WOUND_EXT_ID` (hand-preferred, else discard) to `G.ko` and grants the reward by reusing `executeSingleEffect({ type: rewardType, magnitude })`, with `rewardType ∈ {draw, attack, recruit}`; no Wound in either zone → a `G.messages` no-op (D-24017). It **auto-resolves** rather than parking a pending choice because a Wound is a fungible dead card and KO-plus-reward is strictly beneficial, so the "you may" decline and the hand/discard choice are strategically inert (unlike `optional-ko-reward`, which KOs any card). The keyword carries the reward magnitude (not in `NO_MAGNITUDE_KEYWORDS`). Marker token `[keyword:ko-wound-reward:<rewardType>:<n>]`. Deferred (Honest-Partial): the no-reward and Berserk-reward family members, and a richer pending-choice variant.

---

## See Also

- [WP-248](WP-248-optional-ko-reward-framework.md) / [D-24019](../DECISIONS.md) — `optional-ko-reward`, the near-exact template
- [WP-364](WP-364-hero-gain-wound-keyword.md) — the gain-wound hero-keyword + marker-pipeline precedent
- [WP-379](WP-379-wound-healing-ability.md) — the universal Wound Healing move (distinct: KO **all** Wounds from hand, not a hero-card effect)
- `docs/legendary-universal-rules-v23.md` — Wound / Healing rules
