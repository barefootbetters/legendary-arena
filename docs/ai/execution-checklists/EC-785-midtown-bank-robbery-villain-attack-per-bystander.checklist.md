# EC-785 — Midtown Bank Robbery family: +1 attack per Bystander a Villain has (Execution Checklist)

**Source:** docs/ai/work-packets/WP-748-midtown-bank-robbery-villain-attack-per-bystander.md
**Layer:** Game Engine (`economy/economy.resolve.{ts,test.ts}` + `moves/fightVillain.test.ts`)
**Status:** Pending

## Before Starting
- [ ] Fresh worktree off `origin/main`. Run `pnpm install`, then `pnpm -r build`; confirm the tail has no `Failed`. Record the engine suite baseline (4124/4124 at `3b879f71`).
- [ ] Read:
  - `economy/economy.resolve.ts` (whole)
  - `economy.resolve.test.ts:244+` (the Portals block)
  - `fightVillain.test.ts:35–137`
  - `types.ts:2191–2196` (`attachedBystanders`)
- [ ] Confirm WP-750 (client fightCost gating, EC-787) is `[x]` in WORK_INDEX. If not, STOP. This WP ships behind it.
- [ ] Confirm `resolveFightCost`'s production callers are still exactly `fightVillain.ts`, `ai.legalMoves.ts` and `uiState.build.ts`.
- [ ] If WP-747 has already landed, this is the second of the pair: re-run the hash oracles, `sim:coverage --check` and `sim:runtime-observed:check` on the merged tree.
- [ ] Scope lock: exactly the 3 files in Files to Produce. Any other edit → STOP.

## Locked Values (do not re-derive)
- **Scheme ids** (verbatim, one `ReadonlySet<string>` constant `VILLAIN_ATTACK_PER_BYSTANDER_SCHEME_IDS`):
  - `'core/midtown-bank-robbery'`
  - `'co2e/bank-robbery-hostage-crisis'`
  - `'msp1/destroy-the-cities-of-earth'`
- **Helper:** private `bystanderVillainAttackBonus(G: LegendaryGameState, villainCardId: CardExtId): number`.
  - Returns `0` unless the set has `G.selection?.schemeId`.
  - Otherwise returns `G.attachedBystanders?.[villainCardId]?.length ?? 0`.
- **Composition:** `resolveFightCost` returns `resolveBaseFightCost(G, villainCardId) + darkPortalVillainBonus(G, villainCardId) + bystanderVillainAttackBonus(G, villainCardId)`.
- **Rule text:** "Each Villain gets +1[icon:attack] for each Bystander it has."

## Guardrails
- **One site only.** No bonus in `fightVillain`, `ai.legalMoves`, `uiState.build`, or anywhere else.
- **`resolveMastermindFightCost` is untouched.** The Mastermind is not a Villain.
- **The helper is not exported.** No new `G` field, UIState field, canonical array, move or effect.
- **No existing test is edited.** The scaffold broke none; a red existing test is a finding to STOP on, not something to edit.
- **Determinism:** if the sentinel `finalStateHash` or `PRE_WP080_HASH` moves, STOP, confirm the fixture plays a family scheme, and re-pin honestly with the evidence. Never force green.
- **`data/par/**` stays untouched.** The profile re-pin is a separate `INFRA:` follow-up.
- **Printed-attack readers (`getPrintedAttackForDefeatTarget`, D-24499) stay unchanged.**
- **No client edit.** WP-750 (the prerequisite) switched the client to `fightCost`. This WP changes only the engine value it displays.
- **`fightVillain.test.ts` fixture:** spread `selection` with the Midtown `schemeId` and assign `attachedBystanders` after `createMockGameState`. Never edit the helper; `'test-scheme'` is the control.

## Required `// why:` Comments
- The scheme-id constant: name the Special Rule, the three sets **in prose** (core Midtown, co2e Hostage Crisis, msp1 Destroy the Cities — never an ext_id, or the one-match grep breaks), and WP-748 / D-24572.
- The `resolveFightCost` composition: scheme bonuses (Portals, Midtown family) stack on the resolved static/dynamic/converted cost.
- No comment or JSDoc writes the helper in call form (with parenthesized arguments). Bare name only, so the call-site grep stays at exactly one.

## Files to Produce
- `packages/game-engine/src/economy/economy.resolve.ts` — **modified** — id set + private helper + composition; header/JSDoc sentence updated
- `packages/game-engine/src/economy/economy.resolve.test.ts` — **modified** — 3 family schemes, non-family control, dynamic stack, missing-map no-throw, Mastermind isolation (`resolveMastermindFightCost` unchanged with Midtown Bystanders under its key)
- `packages/game-engine/src/moves/fightVillain.test.ts` — **modified** — Midtown 3-cost + 3 Bystanders: refused at 3, defeated at 6 with exactly 6 spent; control scheme defeated at 3

## After Completing
- [ ] Rebase onto `origin/main`. If WP-747 (EC-784) merged since this session started, re-run the sentinel `finalStateHash`, `PRE_WP080_HASH`, `pnpm sim:coverage --check` and `pnpm sim:runtime-observed:check` on the rebased tree before committing.
- [ ] `pnpm -r build` exits 0 (no `Failed` in the tail).
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 at baseline + the new cases; record the counts in the commit body.
- [ ] `pnpm sim:coverage --check` and `pnpm sim:runtime-observed:check` exit 0.
- [ ] The Verification greps pass: each scheme id matches once; the composition call matches once.
- [ ] `git diff --name-only` for the `EC-785:` commit lists the 3 files.
- [ ] Live (D-24026): in a Midtown match, a City villain holding N Bystanders shows `city[i].fightCost` = printed + N in the Play Diagnostics `uiStateSnapshot` and on the tile (via WP-750), and the Fight control stays disabled at printed attack. Record it in STATUS.
- [ ] Governance:
  - STATUS updated
  - DECISIONS D-24572 Active
  - WORK_INDEX `[x]`; EC_INDEX Done
  - mindmap `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- **`TypeError: Cannot read properties of undefined` in the Portals tests.** `attachedBystanders` was read without optional chaining.
- **The Mastermind gets harder under Midtown.** The bonus leaked into `resolveMastermindFightCost`, or its key was used.
- **`fightCost` in the diagnostics disagrees with the fight gate.** The bonus was added outside `resolveFightCost`.
- **The bot FAULTs on Midtown.** `ai.legalMoves` was given its own cost math (the legalMoves↔guard divergence class).
