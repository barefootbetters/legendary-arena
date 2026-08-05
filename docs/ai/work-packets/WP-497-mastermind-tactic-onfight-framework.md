# WP-497 — Mastermind Tactic onFight Execution Framework + Doc Ock "Octet of Valence Electrons" (Game Engine)

**Layer:** Game Engine · **Lane:** Standard two-session (new hashed `G`
field + determinism surface — lightweight-lane ineligible per 01.0a
eligibility #6/#8) · **Baseline:** `origin/main` @ `0fc7d129` ·
**User-Visible Surface:** play.legendary-arena.com

## Goal

Defeating a Mastermind tactic currently fires **none** of the tactic's
printed **Fight:** ability — `defeatMastermindTacticCore` moves the tactic
to the victory pile, rescues bystanders, and (on the final tactic) sets the
endgame counter, but runs no tactic text. This WP adds the missing
capability: a **per-tactic onFight dispatch** invoked at tactic-defeat time,
plus the first faithful resolver — co2e Doctor Octopus **"Octet of Valence
Electrons"** ("When you draw a new hand this turn, draw 8 cards instead of
6"). The defeating player's next hand fill draws 8 instead of `HAND_SIZE`.
This is the foundational WP of the Mastermind-Tactic-Fight arc; the other
three Doc Ock tactics are follow-on WPs that hard-dep this one.

## User-Visible Impact

On `play.legendary-arena.com`, a player who defeats Doctor Octopus's "Octet
of Valence Electrons" tactic draws **8 cards** on their next new hand instead
of 6, and the play-by-play log records the tactic's Fight effect firing.
Today that tactic (and every other mastermind tactic) is inert — the live
co-op match `KdHnMXaOPin` (2026-08-04) defeated all four Doc Ock tactics and
none produced any effect.

## Assumes

- **WP-019** (Mastermind Fight & Tactics MVP, ✅) — `defeatTopTactic`,
  `tacticsDeck`/`tacticsDefeated`, the `fightMastermind` move.
- **WP-024** (Scheme & Mastermind Ability Execution, ✅) — the
  `ImplementationMap` dispatch precedent (strike handlers).
- **WP-386 / D-24188** (Red Skull strike, ✅) and **WP-388 / D-24192** (co2e
  strike texts, ✅) — the **per-mastermind resolver dispatch** pattern this WP
  mirrors for tactics (`rules/mastermindHandlers.ts`), and the deterministic
  auto-resolution stance for "may/or" clauses. Operator ruling 2026-08-04:
  tactics use the **per-mastermind/per-tactic resolver** pattern, **not** a
  data-driven marker vocabulary (extract a shared vocabulary later, once ≥3
  tactics reveal common primitives — the repo's "abstract on the third copy"
  rule).
- **WP-236** — the play-phase `onBegin` auto-draw to `HAND_SIZE` in
  `game.ts` (the single hand-fill site this WP's override reads through).
- The `// tactic text effects are WP-024` comment in `fightMastermind.ts` is
  **stale/misleading** — WP-024 implemented scheme + mastermind **strike**
  execution; tactic **Fight** effects were explicitly scoped **out** of
  WP-316, WP-386, and WP-388. No shipped WP owns tactic Fight execution. This
  WP retires that comment.
- co2e Doc Ock tactic data (`data/cards/co2e.json`, corrected 9→8 in #1214) —
  the Octet draw count is **8**, read from card data, not hardcoded blindly.

## Context (Read First)

**Where the "new hand" is drawn.** This engine has **no end-of-turn cleanup
draw.** The hand fills once per turn at the **play-phase `onBegin`**
(`game.ts:636`): `drawCardsIntoHand(zones, HAND_SIZE - hand.length, …)`. The
tabletop card says "draw a new hand **this turn**" — tabletop draws that hand
at the *end* of your turn; in this engine the equivalent is the defeating
player's **next `onBegin` fill**. So Octet must:

1. be recorded when the tactic is defeated (during the current player's
   `main` stage), and
2. survive across the intervening opponents' turns until **that same player's
   next `onBegin`**, where it raises the fill target to 8, then clears.

This forces a **per-player** override, not a scalar: the defeating player is
recorded, and only *their* next fill is affected. (Original framing assumed a
same-turn cleanup draw; there is none — corrected here.)

**Determinism (the re-pin question).** The override is gameplay-affecting, so
it **must** live in the hashed `G` (not excluded like `lastPlayEffectsFired`).
But following the `lastPlayEffectsFired` hygiene pattern, the field is
**optional and lazily created** — **not** seeded in `buildInitialGameState`,
only written when an Octet tactic is actually defeated. Consequence: the
empty-registry PRE_WP080 replay and the core/dr-doom recorded sentinel fixture
**never create the key** (neither defeats a Doc Ock Octet tactic), so their
serialized `G` is byte-unchanged and **no re-pin is expected**. Only a real
Octet-defeat game gains the field — and that game's hash *should* differ,
because its behavior changed. Verify both oracles at execution; **STOP on any
drift, never blind-re-pin** (`reference_hashed_g_field_dual_repin`).

**No Magneto composition concern.** `MAGNETO_HAND_SIZE_LIMIT` (`= 4`) is
Magneto's hand cap — it fires only when Magneto is the mastermind (its Master
Strike / turn-start hand trim). Octet applies only when Doctor Octopus is the
mastermind. A match has exactly one mastermind, so the two never co-occur —
no interaction to reconcile, regardless of the exact site each reads.

## Design Rationale

**Per-tactic resolver, keyed by tactic ext_id.** `defeatMastermindTacticCore`
already captures `defeatedTacticId` (the `${setAbbr}-mastermind-${slug}-${tacticSlug}`
string, e.g. `co2e-mastermind-doctor-octopus-octet-of-valence-electrons`)
before `defeatTopTactic` moves it. A new dispatcher branches on that id →
resolver, mirroring `mastermindStrikeHandler`. Unknown/unimplemented tactic
ids are a **silent no-op** (moves never throw) — every unimplemented tactic
stays exactly as inert as today, so this WP is strictly additive for all
non-Octet tactics.

**Dispatch fires on every tactic defeat**, on the current player, **after**
the tactic + bystanders are awarded, regardless of whether it was the final
(vanquishing) tactic — each tactic's Fight fires when *that* tactic is
defeated (Universal Rules v23: tactic Fight effects resolve on defeat).

**A dedicated `rules/tacticHandlers.ts`** houses the dispatcher + resolvers
(sibling to `rules/mastermindHandlers.ts`), so the arc's later resolvers have
one home. Same layer, same "rule handler" category as the strike handlers —
no new code category.

## Scope (In)

- Add optional hashed field `handSizeOverrides?: Record<string, number>` to
  `LegendaryGameState` (per-player next-fill override; **not** seeded in
  `buildInitialGameState`; lazily created).
- New `packages/game-engine/src/rules/tacticHandlers.ts`:
  - `dispatchTacticOnFight(G, ctx, defeatedTacticId)` — per-tactic-id branch;
    unknown id → silent no-op.
  - `resolveOctetOfValenceElectrons(G, currentPlayer)` — sets
    `G.handSizeOverrides[currentPlayer] = OCTET_HAND_SIZE (8)`; pushes one log
    line naming the tactic's Fight effect.
- Wire the dispatch as the final step of `defeatMastermindTacticCore`
  (`moves/fightMastermind.ts`), after the bystander-rescue award and the
  all-tactics-defeated block, passing `defeatedTacticId` + `currentPlayer`.
- `game.ts` play-phase `onBegin`: compute the fill target as
  `G.handSizeOverrides?.[ctx.currentPlayer] ?? HAND_SIZE`, draw to it, then
  delete the consumed per-player entry.
- Retire the stale `// tactic text effects are WP-024` comment in
  `fightMastermind.ts` (replace with a `// why:` pointing at this WP).
- Tests: `rules/tacticHandlers.test.ts` (new) + extensions to
  `fightMastermind.test.ts` (dispatch fires; Octet sets the override; a
  non-Octet tactic defeat is byte-unchanged) + a `game.test.ts` assertion
  that `onBegin` honours and clears a set override.
- **onBegin parity:** if a parity test binds `simulation/onBeginParity.ts`
  (and/or the `simulation.runner.ts` / `par.aggregator.ts` onBegin copies) to
  `game.ts`'s draw, apply the same override read there to keep parity green;
  confirm the binding at execution (see Out of Scope if unbound).

## Out of Scope

- The other three Doc Ock tactics — **Octal Octyls** (look at top 8 of your
  deck, draw 1, discard rest), **High Octane** (reveal top 8 of Hero Deck,
  gain one costing 8, shuffle rest — needs `ctx.random.*`), **Absolute
  Octarchy** (each other player reveals a cost-8 card or gains a Wound). Each
  is a separate follow-on WP hard-dep on this one.
- Any other mastermind's tactics (Doom's, Loki's, etc.).
- A data-driven tactic effect-marker vocabulary / effect-index feed (operator
  ruled per-mastermind for now).
- Card-data changes (Octet's count is already correct at 8 after #1214).
- Rich per-effect narration beyond one log line; UIState/overlay work.
- If no parity test binds the sim-harness onBegin copies, they are **out**
  for this WP. The sim harness *can* structurally set the override (it registers
  and invokes `fightMastermind`), but **no committed sim/PAR sweep uses co2e
  Doctor Octopus as mastermind**, so no committed sim path exercises it — noted
  as a known parity gap for a follow-up, not silently skipped.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/types.ts` | `+ handSizeOverrides?: Record<string, number>` on `LegendaryGameState` |
| `packages/game-engine/src/rules/tacticHandlers.ts` | **NEW** — dispatcher + Octet resolver + `OCTET_HAND_SIZE` |
| `packages/game-engine/src/rules/tacticHandlers.test.ts` | **NEW** — dispatch + resolver unit tests |
| `packages/game-engine/src/moves/fightMastermind.ts` | wire dispatch into `defeatMastermindTacticCore`; retire stale comment |
| `packages/game-engine/src/game.ts` | `onBegin` reads/clears the per-player override at the fill site |
| `packages/game-engine/src/moves/fightMastermind.test.ts` | dispatch-fires + Octet + non-Octet-unchanged assertions |
| `packages/game-engine/src/game.test.ts` | `onBegin` honours + clears a set override |
| `packages/game-engine/src/simulation/onBeginParity.ts` | *(conditional)* mirror the override read **iff** a parity test binds it |

Governance (not counted in the code allowlist): `WORK_INDEX.md`,
`EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`, `DECISIONS.md` (D-24300 flips Active
at execution), `NUMBER-LEDGER.md` (already reserved).

## Non-Negotiable Constraints

- Moves never throw; unknown tactic id → silent no-op.
- `handSizeOverrides` is **not** seeded in `buildInitialGameState` (lazy
  create) — preserves PRE_WP080 + sentinel byte-identity.
- No `ctx.random.*` in the Octet path (it reveals/shuffles nothing).
- `OCTET_HAND_SIZE = 8` and `HAND_SIZE = 6` are the only hand-size literals;
  no other file hardcodes them. Read the count from the constant, cross-check
  against the co2e card text (8).
- The dispatch reads `defeatedTacticId` captured **before** `defeatTopTactic`
  moves the card (already captured at `fightMastermind.ts:157`).
- No layer crossing; no boardgame.io import in `tacticHandlers.ts` (pure
  handler; `ctx` narrowed via `unknown` like `defeatMastermindTacticCore`).
- No `.reduce()` in the resolver / dispatch.

**Engine-wide (standing) constraints.** The executing session must also honor
the repo-wide rules that apply to every engine change: `.claude/rules/code-style.md`
and `docs/ai/REFERENCE/00.6-code-style.md` (human-style, junior-readable code;
full English names; every function JSDoc'd; `// why:` on non-obvious constants
and every `ctx.random.*`); ESM-only with `node:`-prefixed built-ins, `.test.ts`
tests on `node:test`, Node v22+. The executor works from **full file contents**,
never diffs or elided snippets, and outputs complete files.

## Contract

**`LegendaryGameState.handSizeOverrides?: Record<string, number>`** — keyed by
`PlayerID`; value = that player's next-`onBegin` hand-fill target. Absent by
default. Written only by a tactic resolver; read-and-deleted only at the
play-phase `onBegin` fill for the keyed player.

**`dispatchTacticOnFight(G, ctx, defeatedTacticId: CardExtId): void`** — pure
handler; branches on `defeatedTacticId`; unknown id → no-op. Fires on
`ctx.currentPlayer`.

**Octet resolution** — on defeat of
`co2e-mastermind-doctor-octopus-octet-of-valence-electrons`, set
`G.handSizeOverrides[currentPlayer] = OCTET_HAND_SIZE` (8) and log one Fight
line. That player's next `onBegin` draws to 8, then clears the entry.

**`onBegin` fill (game.ts)** — `target = G.handSizeOverrides?.[current] ??
HAND_SIZE`; `drawCardsIntoHand(zones, max(0, target - hand.length), …)`; then
`delete G.handSizeOverrides[current]` when present.

## Vision Alignment

§3 (faithful Legendary rules) — implements printed tactic text currently
inert. NG-1..7 not crossed. No monetization / PvP / identity surface.
**Determinism preserved (§8 / §22):** the resolver uses no `ctx.random.*`, no
wall-clock, and no I/O; the sole new state is a hashed, gameplay-affecting
`G` field that replays identically given the same setup + moves, and (being
lazily created) leaves every committed replay/sentinel oracle byte-identical —
no persistence-boundary or re-pin impact expected.

## Funding Surface Gate

N/A — no pricing, checkout, or account surface.

## API Catalog Update

N/A — no `apps/server` HTTP endpoint or `Library-only` export changes.

## Acceptance Criteria

1. Defeating `co2e-mastermind-doctor-octopus-octet-of-valence-electrons` sets
   `G.handSizeOverrides[<defeatingPlayer>] = 8`.
2. That player's next play-phase `onBegin` fills their hand to **8** (from a
   ≥2-card deck), and the override entry is **deleted** after.
3. A subsequent turn with no override draws to `HAND_SIZE` (6) — override
   does not persist beyond one fill.
4. Defeating a **non-Octet** tactic leaves `handSizeOverrides` absent and is
   otherwise byte-identical to current `defeatMastermindTacticCore` behavior
   (existing `fightMastermind` tests unchanged and green).
5. Unknown/unimplemented tactic id → dispatch is a silent no-op (no throw, no
   state change).
6. Determinism: full engine suite green; sentinel `finalStateHash` +
   `PRE_WP080_HASH` **byte-identical** (no committed fixture defeats a Doc Ock
   Octet) — any drift STOPs execution.
7. The Octet Fight effect emits exactly one play-by-play log line naming the
   effect.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all green; note the
   pass delta.
3. Control check: temporarily stub the dispatch to a no-op → the new Octet /
   onBegin-override assertions FAIL (non-vacuous), restore.
4. Confirm sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged (sweep +
   full run); `pnpm sim:runtime-observed:check` current with no regeneration.
5. `pnpm -r build` → 0.
6. `git diff --name-only` = the allowlist above (± the conditional parity
   file) + governance only.
7. **D-24026 live-verify (operator-pending, post-deploy):** on
   `play.legendary-arena.com`, defeat Doc Ock's Octet tactic → next hand
   draws 8 + the log shows the Fight line.

## Definition of Done

- [ ] All Acceptance Criteria met; engine suite green (pass delta recorded).
- [ ] Sentinel + PRE_WP080 hashes byte-identical (or drift diagnosed + a
      deliberate, documented re-pin — not expected).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] D-24300 flipped Active; WORK_INDEX row → `[x]`; EC_INDEX → `Done`;
      mindmap `📝`→`✅`; `roadmap:counts:check` 0; `docs/ai/STATUS.md`
      close-out entry added.
- [ ] Two-commit topology (EC-532 impl + SPEC close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decision (lands at execution)

**D-24300** — Mastermind-Tactic-onFight execution contract: per-tactic
resolver dispatch (per-mastermind pattern, not a marker vocabulary); the
optional lazily-created hashed `G.handSizeOverrides` per-player next-fill
override; Octet resolution = set 8, consume-and-clear at `onBegin`; the
no-end-of-turn-cleanup-draw modeling ("your next hand fill" ≡ tabletop
"new hand this turn").

## Lint Gate Self-Review (00.3)

Completed at Step 5 (Pre-flight + Copilot + 00.3) below — all 21 sections
PASS or justified N/A; recorded in the drafting-commit body.
