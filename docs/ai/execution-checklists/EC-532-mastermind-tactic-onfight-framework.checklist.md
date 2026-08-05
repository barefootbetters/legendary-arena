# EC-532 — Mastermind Tactic onFight Framework + Octet (Execution Checklist)

**Source:** docs/ai/work-packets/WP-497-mastermind-tactic-onfight-framework.md
**Layer:** Game Engine

## Before Starting
- [ ] Baseline `origin/main` @ `0fc7d129` (co2e Octet draw count is **8**, #1214).
      Record the observed engine-suite pass count before editing; if it moved,
      re-record — do not force the number.
- [ ] Confirm the gap: `defeatMastermindTacticCore` (`moves/fightMastermind.ts`)
      fires **no** onFight today. The `// tactic text effects are WP-024`
      comment is STALE — WP-024 did strikes/schemes; retire it.
- [ ] Confirm the dispatch key (`mastermind.setup.ts:240`) = tactic ext_id
      `${setAbbr}-mastermind-${slug}-${tacticSlug}`; `defeatedTacticId` is
      captured at `fightMastermind.ts:157` **before** `defeatTopTactic` — reuse
      it. Confirm the sole hand-fill site = `game.ts` play-phase `onBegin`
      (no end-of-turn cleanup draw). On any structural miss, STOP and report.
- [ ] Check the onBegin **parity** binding: if a test ties
      `simulation/onBeginParity.ts` (or the `simulation.runner.ts` /
      `par.aggregator.ts` copies) to `game.ts`'s draw → mirror the override read
      there (in allowlist); else parity files are OUT — note the known PAR-sim
      gap, do not silently touch them.

## Locked Values (do not re-derive)
- `OCTET_HAND_SIZE = 8` (new constant in `tacticHandlers.ts`); `HAND_SIZE = 6`
  (existing, `drawCards.logic.ts`) — the only two hand-size literals. Read the
  8 from the constant; cross-check the co2e Octet card text says 8.
- Octet tactic id: `co2e-mastermind-doctor-octopus-octet-of-valence-electrons`
  (its own named constant).
- Field: `handSizeOverrides?: Record<string, number>` on `LegendaryGameState`
  — **optional**, **NOT** seeded in `buildInitialGameState` (lazy create).
- Defeating player = `ctx.currentPlayer` (narrow `ctx` via `unknown`, mirroring
  `defeatMastermindTacticCore` — no `boardgame.io` import).
- Container init: `G.handSizeOverrides ??= {}` **before** the first per-player
  write (absent by default — index-assign would throw). Read
  `?.[current] ?? HAND_SIZE`; after drawing, `delete`-the-entry guarded by presence.
- Dispatch placement = final step of `defeatMastermindTacticCore`, after the
  bystander-rescue award and the all-tactics-defeated block.

## Guardrails
- Never throws — unknown/unimplemented tactic id → **silent no-op** (every
  non-Octet tactic stays as inert as today; strictly additive).
- `handSizeOverrides` is lazily created — do NOT add it to
  `buildInitialGameState`; this is what preserves PRE_WP080 + sentinel
  byte-identity.
- No RNG in the Octet path — it reveals/shuffles nothing; `ctx` used only for
  `currentPlayer`. No `Math.random()`, `.Shuffle`, or wall-clock.
- No `.reduce()`; no new zone / `RuleEffect` / move / phase; no layer crossing;
  no `boardgame.io` or registry import in `tacticHandlers.ts`.
- Do NOT touch `resolveMagnetoStrike` / `MAGNETO_HAND_SIZE_LIMIT` — a different
  mastermind, a post-draw trim; no interaction (one mastermind per match).
- Existing `fightMastermind` / bystander-rescue / endgame behavior stays
  byte-identical for every non-Octet defeat.
- Determinism gates binary: sentinel `finalStateHash`, `PRE_WP080_HASH`, and
  `sim:runtime-observed:check` pass with **no regeneration** — no committed
  fixture defeats a Doc Ock Octet, so **no re-pin is expected**; drift = STOP,
  never blind-re-pin.

## Required `// why:` Comments
- `handSizeOverrides` lazy-create rationale: gameplay-affecting so it MUST be
  hashed, but not seeded in `buildInitialGameState` (the `lastPlayEffectsFired`
  hygiene pattern) so no committed fixture creates the key → no re-pin.
- `OCTET_HAND_SIZE = 8` not self-evident: it is Doc Ock Octet's printed draw
  count (co2e, corrected 9→8 in #1214), distinct from `HAND_SIZE`.
- The onBegin override read + delete: "your next new hand" (tabletop) ≡ this
  player's next `onBegin` fill (no end-of-turn cleanup draw here); consume once.
- Dispatch = silent no-op on unknown id (moves never throw; unimplemented
  tactics stay inert — D-24300 arc-additivity); and the retire-comment at the
  old `// tactic text effects are WP-024` site (WP-024 did strikes/schemes;
  tactic Fight lands in WP-497 / D-24300).

## Files to Produce
- `packages/game-engine/src/types.ts` — **modified** — `+ handSizeOverrides?`.
- `packages/game-engine/src/rules/tacticHandlers.ts` — **NEW** —
  `dispatchTacticOnFight` + `resolveOctetOfValenceElectrons` + `OCTET_HAND_SIZE`
  + the Octet id constant.
- `packages/game-engine/src/rules/tacticHandlers.test.ts` — **NEW** — dispatch
  (Octet + unknown-id no-op) + resolver unit tests.
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — wire the
  dispatch; retire the stale comment. `game.ts` — **modified** — onBegin
  override read + clear at the fill site.
- `packages/game-engine/src/moves/fightMastermind.test.ts` — **modified** —
  AC-1/AC-4/AC-5 (Octet sets override; non-Octet byte-unchanged; unknown no-op).
- `packages/game-engine/src/game.test.ts` — **modified** — AC-2/AC-3 (onBegin
  honours + clears; no persistence beyond one fill).
- `packages/game-engine/src/simulation/onBeginParity.ts` — **conditional** —
  only if a parity test binds it (see Before Starting).
- Governance: `docs/ai/DECISIONS.md` (D-24300 Drafted→Active, edit in place);
  `WORK_INDEX.md` checkbox; `EC_INDEX.md` status; `docs/05-ROADMAP-MINDMAP.md`
  `📝`→`✅` + `pnpm roadmap:counts:write`; `docs/ai/STATUS.md` close-out.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` 0; `pnpm -r build` 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` 0 — baseline + new
      tests; record the delta.
- [ ] Control run: stub the dispatch to no-op → the Octet/onBegin assertions
      FAIL (non-vacuous); restore.
- [ ] `pnpm sim:runtime-observed:check` 0, **no regeneration**; sentinel
      `finalStateHash` + `PRE_WP080_HASH` byte-identical.
- [ ] `git diff --name-only` on STAGED = the allowlist (± the conditional
      parity file) + governance (CRLF-only unstaged diff is not a violation).
- [ ] D-24300 Active; `WORK_INDEX` + `EC_INDEX` flipped with date; mindmap
      `✅` + counts refreshed; `STATUS.md` updated.
- [ ] D-24026 live-verify (operator-pending): a deployed Doc Ock match where
      defeating Octet draws the next hand to 8 + the Fight log line shows.

## Common Failure Smells
- Sentinel/PRE_WP080 hash shifts → `handSizeOverrides` got seeded in
  `buildInitialGameState` (or excluded-hash mistake); it must be lazy-created.
- Next hand draws 8 two turns running → the override entry was not deleted
  after consumption.
- A non-Octet tactic defeat changes behavior → the dispatch is not a clean
  no-op on unknown ids.
- A determinism gate regenerates → the override read leaked into a fixture
  path (matrix mastermind is `core/dr-doom`, which never defeats Octet);
  investigate, never re-pin.
- onBegin parity test goes red → the sim-harness copy diverged from `game.ts`;
  either mirror the read (bound) or confirm it is genuinely unbound.
