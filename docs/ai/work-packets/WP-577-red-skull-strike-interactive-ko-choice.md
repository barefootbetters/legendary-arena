# WP-577 — Red Skull Master Strike: Interactive KO Choice for the Active Player

**Status:** Draft 2026-08-19 — awaiting execution. **Reserves WP-577 / EC-612 / D-24386.**
**User-Visible Surface:** `play.legendary-arena.com` — when Red Skull's Master Strike fires on your turn and you have two or more Heroes in hand, you now **choose** which Hero is KO'd (a prompt), instead of the engine auto-picking your cheapest. D-24026 live-verification applies.
**Primary Layer:** Game Engine (`packages/game-engine`) — the strike resolver + the reused `ko-hero` pending-choice — with the arena-client prompt (already player-agnostic) surfacing it (cross-layer).
**Dependencies:** WP-386 / D-24188 (the current auto-pick MVP this supersedes); WP-532 / D-24284 + D-24343 (the current-parks / non-current-auto interactive split this mirrors); the shipped `ko-hero` interactive cluster (`PendingKoHeroChoice`, `resolveKoHeroChoice`, `UIPendingKoHeroChoice`, `PendingKoHeroChoicePrompt.vue`, the `ai.legalMoves` bot fallback). All landed. Baseline `origin/main` at draft: `754b1c5c`.

---

## Goal

Red Skull's Master Strike prints **"Each player KOs a Hero from their hand."** In Legendary that is an owning-player choice — the player decides *which* Hero to lose. WP-386 / D-24188 shipped a deterministic **auto-pick** (each player's lowest-cost hand Hero) as an explicit MVP, "to avoid a blocking multi-player pending-choice," and D-24188's own text names the follow-up: *"A future WP may upgrade to a per-player KO-target prompt."* This is that WP.

It upgrades the strike to the **D-24284 split** the engine already uses for every "each player" effect: the **active player** (whose turn the strike fired on) gets an interactive prompt to pick their KO'd Hero; **non-active allies auto-pick** the lowest-cost hand Hero (unchanged). Full every-player-including-non-active interactivity is deliberately **out of scope** — it is the first non-active-player interactive choice in the engine and needs `activePlayers` turn-engine restructuring (see §Out of Scope); this WP delivers the fidelity gain that reuses the shipped, freeze-safe `ko-hero` infrastructure end to end.

## User-Visible Impact

On a turn where Red Skull's Master Strike fires and the **active** player holds **two or more** Heroes in hand, that player sees the existing KO-a-Hero prompt (hand cards only) and clicks the Hero to KO. With exactly one eligible Hero it auto-KOs (no prompt — forced). With none, the no-op line is unchanged. Non-active allies are auto-KO'd exactly as before. Every other mastermind, and Red Skull's strike bookkeeping (bystander capture D-15401 / WP-574, `masterStrikeCount`), are unchanged.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

```bash
# A. The current auto-pick resolver exists (both players auto-KO'd, no player context)
grep -q "function resolveRedSkullStrike" packages/game-engine/src/rules/mastermindHandlers.ts && grep -q "selectRedSkullKoTarget" packages/game-engine/src/rules/mastermindHandlers.ts && echo "A_OK"
# B. The reusable ko-hero interactive cluster is present
grep -q "resolveKoHeroChoice" packages/game-engine/src/moves/koHeroChoice.resolve.ts && grep -q "PendingKoHeroChoice" packages/game-engine/src/types.ts && grep -q "PendingKoHeroChoicePrompt" apps/arena-client/src/components/play/PendingKoHeroChoicePrompt.vue && echo "B_OK"
# C. No committed complete-game fixture uses Red Skull (sentinel is core/dr-doom) — hash surfaces unaffected
! grep -rl "red-skull" packages/game-engine/src/**/*.replay.json 2>/dev/null && echo "C_OK"
```

---

## Context (Read First)

- `packages/game-engine/src/rules/mastermindHandlers.ts` — `mastermindStrikeHandler` (the dispatcher; threads the current player to Magneto and core Dr. Doom already) and `resolveRedSkullStrike` (today: loops all players, auto-KOs lowest-cost via `selectRedSkullKoTarget`, no player context).
- The shipped `ko-hero` interactive cluster (the pattern to reuse verbatim): `PendingKoHeroChoice` (`types.ts`), the block-all guard (`game.ts`), `resolveKoHeroChoice` + `hasPendingKoHeroChoice` (`moves/koHeroChoice.resolve.ts`), the `UIPendingKoHeroChoice` projection (`ui/uiState.{types,build,filter}.ts` — the filter already keys on the **chooser's** `playerID`, not the active player), `PendingKoHeroChoicePrompt.vue` (renders for `viewerPlayerId === playerID`), and the `ai.legalMoves.ts` bot short-circuit (returns the resolve move for a parked choice).
- `WP-532` (`villainEffectGiveHqHeroEachPlayer`) is the reference for the D-24284 split: non-current players resolved synchronously inside the effect, the current player parked only when ≥ 2 genuine options remain.
- **Red Skull is "from their hand"** — hand-only, unlike the villain `ko-hero` effect which spans hand/discard/inPlay. The parked choice must restrict eligibility to **hand**.

---

## Scope (In)

- **`packages/game-engine/src/rules/mastermindHandlers.ts`** — `resolveRedSkullStrike` gains the current-player id (threaded from `mastermindStrikeHandler`, exactly as Magneto / core Dr. Doom already are). Non-current players are auto-KO'd lowest-cost from hand (the existing `selectRedSkullKoTarget`, unchanged). For the **current** player: if ≥ 2 eligible Heroes in hand, **park** a hand-scoped `ko-hero` pending choice; if exactly 1, auto-KO it (forced, no prompt); if 0, the existing no-op line. Strike bookkeeping (capture, count) byte-unchanged.
- **`packages/game-engine/src/types.ts`** — `PendingKoHeroChoice` gains an additive optional hand-scope marker (`zones?: readonly ('hand'|'discard'|'inPlay')[]`, or an equivalent `handOnly?: true`) so the Red-Skull park restricts eligibility to hand. Absent ⇒ the existing all-zone behaviour (villain effects unchanged). Additive-optional; no drift-array or five-step UIState field addition (the eligible list already carries per-card `zone`).
- **`packages/game-engine/src/moves/koHeroChoice.resolve.ts`** (+ wherever `buildKoEligibleTargets` / `selectDefaultKoTarget` live) — respect the hand-scope: the resolve rejects a non-hand zone when the front entry is hand-scoped, and the bot default picks the lowest-cost **hand** Hero (so a bot current player's auto-resolution is **byte-identical to the old `selectRedSkullKoTarget`** — sims and any Red-Skull path stay hash-stable).
- **`packages/game-engine/src/ui/uiState.build.ts`** — the `UIPendingKoHeroChoice` eligible list respects the hand-scope (hand-only for a Red-Skull park). No new `UIState` field; the filter pass-through is unchanged (already chooser-keyed).
- **Engine tests** — `mastermindHandlers` (Red Skull strike: active human with ≥2 hand Heroes parks a hand-scoped choice; ally auto-KO'd; exactly-1 forced; 0 no-op), `koHeroChoice.resolve` (a hand-scoped resolve rejects discard/inPlay and KOs the chosen hand Hero), `ai.legalMoves` (bot default = hand lowest-cost). No move-count change (the existing `resolveKoHeroChoice` is reused).
- **`apps/arena-client`** — the `PendingKoHeroChoicePrompt.vue` renders the Red-Skull hand-scoped choice unchanged (it is already player-agnostic + eligible-driven). A component/fixture test asserting a hand-only eligible list renders + dispatches the resolve. `vue-tsc` typecheck is the load-bearing gate if a fixture adds a required field.

## Out of Scope

- **Non-active-player interactivity** (every player, including the one whose turn it is not, choosing). That is the first non-active-player interactive choice in the engine and needs the play phase's `activePlayers` restructured (boardgame.io rejects a non-active player's move today) + a multi-entry projection — a determinism-sensitive turn-engine change. Deferred to a later WP; this WP keeps the D-24284 split (non-active allies auto-pick).
- **Any other mastermind's auto-pick** (the other D-24188-style auto-picks). Reuse this WP's pattern later if desired.
- **Red Skull's bookkeeping** — bystander capture (D-15401 / WP-574), `masterStrikeCount`, WP-200 emission — byte-unchanged.
- **`co2e/red-skull`** epic-face divergence — the base face (`core/red-skull` + `co2e/red-skull`) shares the strike; the epic face is untouched.

---

## Files Expected to Change

- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** (strike parks for the current player)
- `packages/game-engine/src/types.ts` — **modified** (`PendingKoHeroChoice` hand-scope, additive optional)
- `packages/game-engine/src/moves/koHeroChoice.resolve.ts` (+ eligible/default helpers) — **modified** (respect hand-scope)
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** (hand-scoped eligible list)
- `packages/game-engine/src/rules/ai.legalMoves.ts` — **modified** (bot default hand-scope, byte-identical pick)
- Engine tests (`mastermindHandlers`, `koHeroChoice.resolve`, `ai.legalMoves` suites) — **modified**
- `apps/arena-client/src/components/play/PendingKoHeroChoicePrompt.*` (test/fixture) — **modified** (Red-Skull hand-only render)
- `docs/ai/DECISIONS.md` (**D-24386**), `WORK_INDEX.md`, `EC_INDEX.md`, `STATUS.md`, `docs/05-ROADMAP-MINDMAP.md` — governance (at execution)

Cross-layer (engine resolver + reused interactive cluster + client prompt); standard lane.

---

## Contract (Locked by D-24386)

- **Active player chooses; allies auto-pick (the D-24284 split).** Red Skull's strike parks a hand-scoped `ko-hero` choice for the **current** player when ≥ 2 Heroes are in hand; exactly 1 auto-KOs (forced); 0 is a no-op. Non-current players auto-KO the lowest-cost hand Hero (unchanged). Supersedes D-24188's both-players-auto-pick.
- **Hand-only.** The prompt (and the bot default) offer only **hand** Heroes — the printed "from their hand." A hand-scope marker on `PendingKoHeroChoice` enforces it; absent ⇒ unchanged all-zone `ko-hero` for villain effects.
- **Byte-identical bot pick.** A bot current player's auto-resolution KOs the same card the old `selectRedSkullKoTarget` did (lowest-cost hand Hero, tie → lowest hand index), so all-bot sims and hash surfaces are unchanged.
- **Reuse, don't fork.** No new move (the existing `resolveKoHeroChoice` is reused → no move-count drift), no new pending-choice kind, no new UIState field, no new prompt component.

### Determinism / persistence

Deterministic. No committed complete-game fixture uses Red Skull (the sentinel is `core/dr-doom` / Legacy Virus), so `finalStateHash` / `PRE_WP080` are **byte-unchanged** — verify, re-pin only on a real diff (none expected). The bot default is pinned byte-identical to the old auto-pick so any Red-Skull sim path is stable. No `ctx.random`, no new persistent shape.

---

## Acceptance Criteria

1. On a Red Skull strike, an **active** player with ≥ 2 Heroes in hand gets a parked hand-scoped `ko-hero` choice (no immediate KO for that player); the prompt offers **hand** Heroes only.
2. The active player's `resolveKoHeroChoice` KOs the **chosen** hand Hero; a discard/inPlay zone is rejected (no-op, queue intact) for a hand-scoped entry.
3. An active player with exactly 1 hand Hero auto-KOs it (forced, no prompt); with 0, the existing no-op line fires.
4. **Non-active allies** are auto-KO'd the lowest-cost hand Hero, exactly as before.
5. A **bot** current player auto-resolves to the same card the old `selectRedSkullKoTarget` picked (byte-identical); all-bot sims and both hash oracles are unchanged.
6. Reuse only — no new move (move-count unchanged), no new pending-choice kind, no new UIState field. Red Skull bookkeeping (capture, count) byte-unchanged.
7. `pnpm -r build` + `pnpm -r --no-bail test` green (engine + arena-client incl. `vue-tsc`).

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–C passed before the edit
- [ ] All 7 Acceptance Criteria pass
- [ ] Active player parks a hand-scoped choice (≥2) / forced (1) / no-op (0); allies auto; bot pick byte-identical
- [ ] No new move / pending kind / UIState field; Red Skull bookkeeping byte-unchanged; hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] Engine + arena-client green; `vue-tsc` clean
- [ ] `docs/ai/STATUS.md` Done entry; `docs/ai/DECISIONS.md` **D-24386** landed (supersedes D-24188 → D-24188 Status annotated); WORK_INDEX + EC_INDEX rows flipped; mindmap `📝` → `✅` + `pnpm roadmap:counts:write`
- [ ] Commit prefix `EC-612:` (code) + `SPEC:` (governance)
- [ ] D-24026 live-verification confirmed in a deployed match (operator-pending)

---

## Vision Alignment

**Clauses touched:** §10 (card/setup fidelity — enforces the printed "each player KOs a Hero from their hand" as an owning-player choice for the active player). **Conflict assertion:** No conflict — raises fidelity without altering determinism, loss conditions, or any other mastermind. **Non-Goal proximity:** none. **Determinism preservation:** bot pick byte-identical; no fixture reaches Red Skull → no re-pin expected.

## Funding Surface Gate

**N/A** — a gameplay-fidelity fix on the play surface; no §20.1 trigger.

## API Catalog Update

**N/A** — no HTTP endpoint or `apps/server/src/**` library change.

## Gate Verdicts (drafter self-review, standard lane)

**Pre-Flight: READY.** Deps all on `main` — the `ko-hero` interactive cluster (`PendingKoHeroChoice` / `resolveKoHeroChoice` / `UIPendingKoHeroChoice` / `PendingKoHeroChoicePrompt.vue` / `ai.legalMoves` fallback) is shipped and battle-tested; `resolveRedSkullStrike` + the dispatcher exist; Magneto / core Dr. Doom already thread the current player through the same dispatcher. Baseline `origin/main` `754b1c5c`. **Pattern-mapped (not assumed):** a subagent traced the full six-stage interactive lifecycle and confirmed the current-player reuse is freeze-safe end to end; the two blockers it surfaced (non-active-player move-eligibility + multi-entry projection) apply ONLY to the deferred full-interactivity variant, not this active-player split. **Mutation boundary** — engine resolver + additive-optional pending-choice marker + client-render reuse; no `ctx.random`, no new persistent shape; bot pick byte-identical → engine hash surfaces byte-unchanged (no Red Skull fixture).

**Copilot: PASS.** Layer boundary (engine authority; the client prompt already renders any `ko-hero` choice) — clean. Determinism (bot pick byte-identical to `selectRedSkullKoTarget`; no fixture reaches Red Skull → no re-pin) — clean. Contract fidelity (printed "KO a Hero from their hand" enforced as an active-player choice, hand-only) — clean. Scope (active-player split only; allies + bots auto; full non-active interactivity explicitly deferred with the `activePlayers` rationale) — clean. RISK considered and resolved with the operator: active-player-only (D-24284 split) vs full every-player interactivity — chose the split (reuses shipped freeze-safe infra; the full variant is a determinism-sensitive turn-engine WP), locked in D-24386.

**Lint Gate (00.3): SATISFIED.** §1 Structure PASS. §5 Files PASS (closed allowlist; reuse-only, no new move/kind/field). §8 Boundaries PASS (engine + reused client prompt). §12 Test Quality PASS (`node:test`; strike-parks + resolve-KOs-chosen + ally-auto + bot-byte-identical). §14 AC PASS (7 binary). §15 DoD PASS (STATUS + D-24386 + indices + mindmap + D-24026). §16 Code Style PASS (reuse the shipped idiom; `// why:` on the park + hand-scope + bot default). §17 Vision present. §20 N/A. §21 N/A. No ❌ FAIL triggers.

## Decision (reserved, lands at execution)

Reserves **D-24386**: Red Skull's Master Strike upgrades from the D-24188 both-players-auto-pick to the **D-24284 split** — the active player interactively chooses their KO'd Hero (a hand-scoped reuse of the shipped `ko-hero` pending choice), non-active allies auto-pick the lowest-cost hand Hero, bot current players auto-resolve byte-identically to the old pick. Supersedes the interactive half of D-24188 (its auto-pick stays the ally + bot fallback); full non-active-player interactivity remains deferred (needs `activePlayers` restructuring). Drafted 2026-08-19; lands at execution.
