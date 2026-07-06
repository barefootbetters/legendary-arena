# EC-347 — Composable `gain-resource` Grant Observability Logging (Empowered / Berserk) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-317-composable-grant-observability-logging.md
**Layer:** Game Engine only (hero interpreter + its two call sites; no client/server/registry change)
**Lane:** Standard two-session (D-24028 — exported-signature thread across three call sites)

## Before Starting
- [ ] On `main`, clean, synced; baseline `origin/main` @ `6c64d920` recorded.
- [ ] Fresh worktree → `pnpm --filter @legendary-arena/game-engine build` BEFORE the suite.
- [ ] Confirm on `main`: `interpretGainResourceNode` (`hero/effectPrimitive.interpret.ts`) grants via
      `addResources` and pushes NOTHING on success; `gain-resource` nodes come ONLY from
      `HERO_COMPOSITION_MARKERS` (Berserk) + `buildEmpowered*Composition` (Empowered).
- [ ] Confirm the two `interpretHeroPrimitiveEffect` call sites: `heroEffects.execute.ts:329`
      (`hook.cardId` in scope) and `moves/drawOrEmpowered.resolve.ts:112`.
- [ ] D-24081: `G.messages` excluded / `G.notableEvents` included in `finalStateHash`.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL (except the stated in-scope
      test-amendment rule for a composition test that asserts an exact `G.messages` array).

## Locked Values (do not re-derive)
- Grant line (card known): `` `Player ${playerID}'s ${sourceCardId} gained +${amount} ${resource}.` ``
- Grant line (card unknown): `` `Player ${playerID} gained +${amount} ${resource}.` ``
- `${resource}` ∈ { `attack`, `recruit` } (closed `EffectResourceKind`); ext-id form for the card, never a display name.
- Emit for EVERY `gain-resource` run, **including `amount === 0`** (a `+0` line explains a zero-count composition — distinct from WP-295's `did not activate`).
- `sourceCardId: CardExtId | undefined` is a plain function argument (provenance) — NEVER written to `G`, `ctx`, a binding, or the `EffectExecutionContext` map.
- Reuse the `Array.isArray(G.messages)` guard (the `pushPrimitiveWarning` pattern) — no throw on a missing `messages`.
- Sentinel `finalStateHash` (unchanged): `7bb990fc36f7d9d0c954a28022fa402b51b3cba05e55a844c07d85c1f8e253d0`.
- Reserved decision: **D-24103**.

## Guardrails
- **Hash is load-bearing.** If the sentinel `finalStateHash` changes, or `hashGameState.ts` /
  `replay.hash.ts` need editing — STOP (WP-294 owns the hash surface).
- **Mechanic-agnostic.** The copy names NO mechanic ("(Empowered)" is forbidden — the interpreter
  doesn't know which composition it is).
- **Provenance only.** Thread `sourceCardId` as an argument; if it seems to need a change to
  `EffectExecutionContext`'s type or to `G`, STOP and re-scope.
- Additive + read-side: NO gameplay/move/phase/zone-op/RNG change; the grant amount + economy
  mutation are UNCHANGED (only the log line is new). Legacy `HeroEffectDescriptor` handlers untouched.
- Layer boundary: `effectPrimitive.interpret.ts` imports no `boardgame.io`, no `@legendary-arena/registry`.
- No `.reduce()`.

## Required `// why:` Comments
- The new `sourceCardId` param (why: execution provenance for the grant log only; never enters `G` /
  a binding — preserves the D-24029 §9 replay invariant).
- The grant `G.messages` push (why: WP-317 / D-24103 — makes the composable grant observable; extends
  WP-295 per-effect amount logging to the composable substrate; mechanic-agnostic copy).
- The `amount === 0` still logs (why: a `+0` line explains a zero-count composition ran — a cause the
  WP-295 `did not activate` condition-skip line does not cover).

## Files to Produce
- `hero/effectPrimitive.interpret.ts` [`sourceCardId` on `EffectNodeHandler` + `interpretHeroPrimitiveEffect`;
  grant log in `interpretGainResourceNode` (both attack + recruit branches); forward through
  `interpretSequenceNode`; `interpretMoveCardNode` ignores it].
- `hero/heroEffects.execute.ts` [pass `hook.cardId` at the `interpretHeroPrimitiveEffect` call].
- `moves/drawOrEmpowered.resolve.ts` [pass the source cardId or `undefined` at the resolve-path call].
- `hero/effectPrimitive.interpret.test.ts` [attack / recruit / no-card / `+0` / Berserk-sequence /
  no-throw-on-missing-`messages` assertions].
- `test/fixtures/games/sentinel-core-doom-2p.replay.json` [**ONLY IF** the trajectory contains a
  composition card — re-pin `messages` + `snapshotPerTurn[].messages`; hash unchanged; expected NO change].
- Governance: `docs/ai/DECISIONS.md` (D-24103), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] `hashGameState.ts` + `replay.hash.ts` byte-identical (`git diff` empty); sentinel
      `finalStateHash` byte-unchanged.
- [ ] `git diff --name-only` = the allowlist (engine-only; zero client/server/registry files).
- [ ] STATUS / DECISIONS (D-24103 Active) / WORK_INDEX (WP-317 `[x]`) / EC_INDEX (EC-347 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (play an
      Empowered / Berserk card → the log panel shows a `… gained +N attack.` line).

## Common Failure Smells
- Sentinel `finalStateHash` drift, or a `hashGameState.ts` / `replay.hash.ts` edit → the log leaked
  into the hash surface (STOP — it must be `G.messages`-only).
- Naming the mechanic in the copy → the interpreter is mechanic-agnostic.
- Threading `sourceCardId` into `G` / the bind map / `EffectExecutionContext`'s type → replay-invariant
  breach; it is a plain argument.
- Suppressing the `+0` line "to reduce noise" → the `+0` case is the whole point (explains a zero-count
  composition no-op).
- Suppressing the grant log to keep an existing composition test green → add the line to that test's
  expectation instead (in-scope amendment; record the file in the EC).
- Editing a legacy `HeroEffectDescriptor` handler (`heroEffects.execute.ts` grant path) → out of scope
  (they already log where they log).
- Any `apps/*`, `packages/registry`, or `boardgame.io` import in the touched engine files → breach.
- Engine edited but suite run without `pnpm --filter … build` first (fresh worktree) → false "still green".
