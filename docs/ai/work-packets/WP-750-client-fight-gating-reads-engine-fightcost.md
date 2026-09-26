# WP-750 — Client Fight gating reads the engine's projected fight cost (Arena Client + Game Engine UIState)

**Status:** Draft 2026-09-25 — **BLOCKED on WP-762** (null-vAttack card-data fill; operator decision 2026-09-25)
**Primary Layer:** App (`apps/arena-client`) + Game Engine UIState projection (one optional field)
**Dependencies:**
- **WP-762 / EC-799 / D-24594 (hard, sequencing)** — fill the missing printed attack values first. It must be `[x]` before this WP's execution session starts. See §Operator Decision.
- WP-128 / D-12803 (UIState + audience filter)
- WP-129 / EC-132 (`useCardCostGating` + tooltip precedence)
- WP-214 (dynamic `N+` / `*` fight cost; `UICityCard.fightCost`)
- WP-539 / D-24348 (Dark-Portal bonus on villains and the Mastermind)
- WP-513/514 (Killbot / Skrull cost overlays)
- WP-738 / D-24561 (the Excessive-Violence fight button)
- WP-756 / D-24585 (the slash gesture reuses `gateForCell`)

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It touches two layers (an engine UIState field plus the client), so it is not lightweight-eligible.
**Unblocks:** WP-748 (Midtown +1 per Bystander) and WP-760 (Fallen Blood Frenzy). Both raise a villain's cost above its printed value, and each hard-depends on this packet.

> Baseline: `origin/main` at `5de14d5b`. Numbers were reserved in #2300 on 2026-09-22 by the WP-748 drafting session and left undrafted. The operator directed this session to draft WP-750 under that reservation.

---

## Goal

The client stops gating Fight on the card's **printed** cost and gates on the engine's **projected** cost instead.

**Fight buttons**
- City: `CityRow` Fight, and the Excessive-Violence (EV) Fight button, gate on `UICityCard.fightCost`. That value is already computed by the single fight-cost authority `resolveFightCost` and passed through the audience filter.
- Mastermind: `MastermindTile` Fight and EV Fight gate on a new optional `UIMastermindState.fightCost`, computed from `resolveMastermindFightCost`. Its UIState five-step is part of this packet.

**Visible cost**
- Whenever the projected cost differs from the printed cost, the tile shows a **Fight N** badge. Players see the number the engine will actually charge.

## User-Visible Impact

Today the client disagrees with the engine in both directions.

**Dead buttons: the client enables a fight the engine refuses.**
- Dynamic `*` / `N+` villains holding captured Heroes.
- A villain in a Dark-Portal City space (+1).
- A Skrull (the hero's cost + 2).
- The **Mastermind under Portals to the Dark Dimension** once it holds a Dark Portal (+1).

In every one of these cases, clicking Fight with exactly the printed attack silently does nothing.

**False locks: the client blocks a fight the engine allows.**
- A villain with no printed attack. `display.cost` is `null`, but the engine cost is 0, so the client shows "This card cannot be fought."
- A converted Killbot (null display cost; the engine cost is the Killbot counter).

After this WP, Fight is enabled exactly when the engine will accept it on cost, and the tile shows the real number. The two queued cost-raising packets (WP-748, WP-760) can then ship without creating new dead buttons.

---

## Assumes

1. **City cost projection.** `UICityCard.fightCost: number` is **required** (`ui/uiState.types.ts:598`).
   - It is populated as `resolveFightCost(gameState, space)` (`ui/uiState.build.ts:784`): dynamic captured-hero cost, the Dark-Portal bonus, and the Killbot/Skrull overlays.
   - It is copied for every audience (`ui/uiState.filter.ts:98`, `deepCopyCitySpaces`, used at :460).
2. **City fight guard.** The engine's City fight guard (`moves/fightVillain.ts:147-155`) requires `resolveFightCost + getPatrolModifier` against `getSpendableAttack`.
   - **Patrol and Guard are never set.** `setup/buildCardKeywords.ts` skips both because they have no data source (D-2504, :140-141, :308), so `getPatrolModifier` is 0 in every real match and `fightCost` equals the guard's cost term.
   - Bot parity (`simulation/ai.legalMoves.ts:926-930`) uses the same terms.
3. **Mastermind cost.** `fightMastermind.ts:145` requires `resolveMastermindFightCost(G)` (`economy/economy.resolve.ts:196-203`: the base `cardStats.fightCost` plus the Dark-Portal bonus when `onMastermind`).
   - `UIMastermindState` (`ui/uiState.types.ts:651-676`) has **no** cost field.
   - Its optional fields use the conditional-spread pass-through at `uiState.filter.ts:~495-507` (the `finalBlowPending` precedent).
4. **Spendable attack.** `UITurnEconomyState.availableAttack` = `getSpendableAttack(...)` (`uiState.build.ts:933`), so it already includes recruit-as-attack.
5. **Client gating** (`apps/arena-client/src/composables/useCardCostGating.ts`):
   - `canFight(villain: UICardDisplay, economy)` (:80-98) and `canFightWithExcessiveViolence(target: UICardDisplay, economy)` (:114-127) read `display.cost`.
   - `null` → "This card cannot be fought." Short → `Needs X attack, you have Y.` EV needs `availableAttack >= cost + 1`.
6. **City row** (`components/play/CityRow.vue`):
   - `gateForCell` (:89-102) calls `canFight(cell.card.display)`.
   - `showEvFight` (:108-121) calls `canFightWithExcessiveViolence(cell.card.display)`.
   - `gateForCityIndex` (:138-145) reuses `gateForCell` for the WP-756 slash gesture (`composables/useSlashGesture.ts` only calls the injected gate).
   - The city tile renders `<CardTile :display="cell.card.display" …>` (:249-254), which shows the **printed** cost.
   - A `.city-space__cost` CSS rule exists (:431) but is unused in the template.
7. **Mastermind tile** (`components/play/MastermindTile.vue`): `gateForFight` (:87-117) calls `canFight(props.mastermind.display)` at :96, and `showEvFight` (:155-165) calls `canFightWithExcessiveViolence(props.mastermind.display)`. The mobile play surface renders the same `CityRow` / `MastermindTile` (`PlayMobile.vue:542/570`); there are no separate mobile SFCs.
8. **Tests and fixtures.**
   - `CityRow.test.ts`'s `villain(extId, cost)` helper (:34-50) sets `display.cost = cost` and `fightCost: 0`.
   - `useCardCostGating.test.ts` passes `UICardDisplay` objects.
   - `MastermindTile.test.ts` has no `fightCost`.
   - Fixtures in `fixtures/uiState/*.json` carry City `display.cost: null`, `fightCost: 0`, and Mastermind `display.cost: null`.
9. **Scaffold result (observed 2026-09-25, this worktree).** The prototype of this exact change ran as follows:
   - Engine: build 0, suite **4231 / 0**; the new optional field breaks no keyset pin.
   - arena-client: typecheck errors **only** in `useCardCostGating.test.ts`. The suite went from baseline **2084 / 0** to **2077 / 7**, and all 7 failures are in `useCardCostGating.test.ts` (the API change) and `CityRow.test.ts` (the `fightCost: 0` helper).
   - `MastermindTile.test.ts` and every fixture-driven test passed unchanged.
   - The scaffold was reverted.
10. `pnpm -r build` exits 0; the engine and arena-client suites and the arena-client typecheck are green on baseline.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `.claude/rules/architecture.md` §UIState Projection Integrity: the five-step, and the EC-206 filter-drop failure mode.
- `.claude/rules/architecture.md` §Engine Owns Truth: the client never re-derives a rule. It must not add the Dark-Portal bonus or captured-Hero costs itself; it reads the engine's number.
- `docs/ai/DECISIONS.md`: D-12803, D-11104 (`UICardDisplay.cost`), D-24348, D-24561, D-24585, D-2504. D-24574 is reserved and lands at execution.
- `docs/ai/work-packets/WP-748-midtown-bank-robbery-villain-attack-per-bystander.md` and `WP-760-fallen-fight-side.md`: the two consumers. WP-748 AC-4 expects "the tile shows `fightCost` (printed + N) through WP-750".
- User memory: `reference_client_fight_gating_ignores_fightcost`, `reference_uistate_filter_whitelist_drops_fields`, `reference_play_fixture_dev_route`, `feedback_verify_cross_surface_link_landing`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no nested ternaries, no `import *`.
- Determinism: UIState is a projection, not `G`. No move, no `G` field, and no hashed surface changes, so `finalStateHash` is untouched by construction.
- Layers: the engine change is confined to `ui/uiState.{types,build,filter}.ts` plus tests. The client imports engine **types** only.

**Session protocol:** if any Assumes item is false, or the scope is unclear, STOP and reconcile (update this WP and D-24574) before coding. One WP per session.

**Packet-specific:**
- **One cost source per target.** City gating reads `cell.card.fightCost`. Mastermind gating reads `mastermind.fightCost ?? mastermind.display.cost`. The fallback exists only for snapshots that predate the field. The client never adds bonuses itself.
- **`canFight` / `canFightWithExcessiveViolence` take a number.** Signatures become `(cost: number | null, economy)`. Messages are unchanged: `This card cannot be fought.` for null, `Needs X attack, you have Y.` when short, and EV `availableAttack >= cost + 1`. `canRecruit` is **unchanged**; HQ is out of scope.
- **`UIMastermindState.fightCost?: number`** is populated as `resolveMastermindFightCost(gameState)` in `buildUIState`, the same authority the move guard uses. It is optional in the type, so existing typed fixtures compile. The filter passes it through with a conditional spread (never a `fightCost: undefined` literal), the `finalBlowPending` precedent. It is public shared-board data for every audience.
- **Fight N badge.**
  - **City rule:** CityRow renders the badge only when `cell.card.fightCost !== cell.card.display.cost` (a `null` printed cost counts as different).
  - **Mastermind rule:** MastermindTile renders it only when `mastermind.fightCost !== undefined && mastermind.fightCost !== mastermind.display.cost`. It **never** renders from the `display.cost` fallback, so old snapshots and fixtures without the field show no badge.
  - **Placement (1280×720 play-mat):** the badge renders **inside** the `play-city-villain` / `play-mastermind-button` button, absolutely positioned at the **bottom** of the tile; the button gets `position: relative`. It is not a new flex child of `.city-space`, which would widen every space and shrink the scale-to-fit board (D-24505). It stays out of the top band, where the Dark-Portal marker (`.city-space__portal`) and CardTile's printed-cost badge sit.
  - **CSS:** new rules live in CityRow.vue / MastermindTile.vue under their own class (`city-space__fight-cost` / `mastermind__fight-cost`). The shared `.city-space__cost` rule is left unchanged.
  - The printed card art and label are untouched, so a matching cost renders byte-identically.
- **Tooltip precedence is unchanged:** stage → resource → structural (EC-132 §3). Only the resource number changes source.
- **Test migration is not reward-hacking.** The two failing test files encode the *old* intended behavior (gate on printed cost). This WP intentionally changes that behavior, so they are migrated:
  - the `CityRow.test.ts` helper sets `fightCost: cost`;
  - `useCardCostGating.test.ts` passes numbers.
  - New assertions pin the new behavior: fightCost above printed disables, fightCost below or with a null printed cost enables.
  - No other existing assertion may be edited. The commit body states the intentional change.

## Locked Values

- `canFight(cost: number | null, economy: UITurnEconomyState): GatingResult`
- `canFightWithExcessiveViolence(cost: number | null, economy: UITurnEconomyState): boolean`
- `useCardCostGating(economy)` returns `canFight: (cost: number | null) => GatingResult` and `canFightWithExcessiveViolence: (cost: number | null) => boolean`.
- CityRow: `canFight(cell.card.fightCost)`, `canFightWithExcessiveViolence(cell.card.fightCost)`.
- MastermindTile: `const mastermindFightCost = props.mastermind.fightCost ?? props.mastermind.display.cost;`, then passed to both predicates.
- `UIMastermindState.fightCost?: number`, built as `resolveMastermindFightCost(gameState)`.
- Badge test ids: `play-city-fight-cost`, `play-mastermind-fight-cost`. Badge text: `Fight N`. Classes: `city-space__fight-cost`, `mastermind__fight-cost`.
- City badge condition: `fightCost !== display.cost`. Mastermind badge condition: `fightCost !== undefined && fightCost !== display.cost`.

---

## Scope (In)

- **A) Engine UIState five-step:**
  - `ui/uiState.types.ts`: `fightCost?` on `UIMastermindState`, with a `// why:` naming the EC-206 drop.
  - `ui/uiState.build.ts`: populate it.
  - `ui/uiState.filter.ts`: conditional-spread pass-through.
  - `ui/uiState.filter.test.ts`: the field survives every audience.
  - `ui/uiState.build.test.ts`: equals `resolveMastermindFightCost`, including a Dark-Portal-on-Mastermind case that yields printed + 1.
  - Diagnostics `uiStateSnapshot` presence is verified in the Verification Steps.
- **B) `useCardCostGating.ts`** (+ test): numeric signatures. The test migrates to numbers and keeps every message and EV case.
- **C) `CityRow.vue`** (+ `CityRow.test.ts`):
  - gate and EV gate on `fightCost`;
  - the Fight N badge;
  - helper `fightCost: cost`;
  - new cases: fightCost > printed disables with "Needs {fightCost} attack…"; printed null with fightCost 0 enables; the badge appears only on mismatch.
  - The slash gesture inherits through `gateForCityIndex`, with no change to `useSlashGesture.ts`.
- **D) `MastermindTile.vue`** (+ `MastermindTile.test.ts`):
  - gate and EV via `mastermindFightCost`;
  - the Fight N badge;
  - new cases: `fightCost` = printed + 1 with attack = printed disables Fight and hides EV; `fightCost` absent falls back to `display.cost`.

## Out of Scope

- **Null printed attack in card data.** 32 of 50 henchman groups, 24 of 664 villain cards and 14 Mastermind base cards (e.g. `gotg:thanos`, `dstr:dormammu`) have no `vAttack`. The engine already charges 0 for them, and the bot already fights them free. The client's false lock currently hides that from humans. Removing the lock without fixing the data would expose free fights (a leaderboard / gauntlet integrity risk). Sequencing is the operator decision recorded under §Operator Decision.

- **Defeat requirements** (`villainDefeatRequirement.logic.ts`: Blob, Venom, Zombie Venom). The engine refuses these fights for a non-cost reason the client doesn't see yet. This is a separate dead-button class, and a named follow-up (it needs a projected requirement flag).
- **Patrol / Guard.** No data source (D-2504). If a future data pass sets Patrol, `resolveFightCost`'s projection must absorb it; a note goes in D-24574.
- **Bot Final Blow enumeration.** `ai.legalMoves.ts:935-939` never offers a Final Blow fight. A separate engine gap, noted only.
- HQ recruit gating (`canRecruit`), fixture edits, CardTile redesign, `useSlashGesture.ts` changes, and any engine move, guard or `G` change.

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — modified
- `packages/game-engine/src/ui/uiState.build.ts` — modified
- `packages/game-engine/src/ui/uiState.build.test.ts` — modified
- `packages/game-engine/src/ui/uiState.filter.ts` — modified
- `packages/game-engine/src/ui/uiState.filter.test.ts` — modified
- `apps/arena-client/src/composables/useCardCostGating.ts` — modified
- `apps/arena-client/src/composables/useCardCostGating.test.ts` — modified (migrated)
- `apps/arena-client/src/components/play/CityRow.vue` — modified
- `apps/arena-client/src/components/play/CityRow.test.ts` — modified (helper migrated plus new cases)
- `apps/arena-client/src/components/play/MastermindTile.vue` — modified
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — modified (new cases)
- Governance: `docs/ai/DECISIONS.md` (D-24574), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 11 code/test files, over the ~8 guideline. It is justified: the change is two layers × (source + test), plus the two consuming tiles.

## Contract

- The Locked Values above.
- The client's **sole** fight-cost source for a City villain is `UICityCard.fightCost`. For the Mastermind it is `UIMastermindState.fightCost` (falling back to `display.cost` only when absent).
- WP-748 and WP-760 rely on this: any new cost term added to `resolveFightCost` reaches the client with no client change.

## Vision Alignment

**Vision clauses touched:** §1 (the game behaves as printed and as the engine rules), §17 (honest UX: no dead or false-disabled controls), NG-1.
**Conflict assertion:** none.
**Non-Goal proximity:** NG-1..7 not crossed. The engine stays the sole authority; the client mirrors it.
**Determinism preservation:** a UIState-only projection field, so no `G`, hash or replay change.

## Funding Surface Gate

§20 **N/A**: in-match Fight affordances only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` surface.

---

## Test Expectations (01.4)

| File | New tests (minimum) |
|---|---|
| `uiState.filter.test.ts` | +1 |
| `uiState.build.test.ts` | +2 |
| `useCardCostGating.test.ts` | +2 |
| `CityRow.test.ts` | +3 |
| `MastermindTile.test.ts` | +3 |

The arena-client total ends at 2084 + 8 or more. No test is deleted.

## Operator Decision (2026-09-25)

**Risk found at pre-flight (RS-1).** Removing the client's accidental "cannot be fought" lock exposes free fights on every card with no printed attack in data:
- 14 Mastermind base cards, 13 of them in a gauntlet loadout (Thanos, Dormammu, Killmonger, Carnage, Mysterio, …);
- 24 villain cards;
- 32 henchman groups.

The engine already charges 0 for these cards, and the bot already fights them for free.

**Options offered:**
- (a) ship first, data later;
- (b) data fill first;
- (c) keep a client lock for null printed cost.

**Jeff chose (b):** WP-762 fills the values from the printed cards first, and WP-750 hard-depends on it. Option (c) was rejected because it would re-derive a rule client-side, against Engine Owns Truth.

**Consequence for this packet.**
- AC-2's `fightCost` 0 case now describes a genuinely 0-cost card, the `mid-turn` fixture (a synthetic `null` display cost), **and** the WP-762 / D-24594 residual list (Indestructible Man, Killmonger, Jameson, the three pttr `""` villains and noir kraven-animal-trainer (`"*"`)). That residual list becomes reachable to humans once this WP ships. See §Residual Acceptance.
- Converted Killbots keep a real engine cost (the Killbot counter) and are correctly unlocked by this WP.

## Residual Acceptance (2026-09-25)

After WP-762 fills the data, seven cards still fight free or at the wrong cost, because their printed attack depends on an unmodelled engine rule:
- `bkwd/indestructible-man`: printed 0; you fight him by shuffling Elite Assassins.
- `bkpt/killmonger`: can't be fought while above 0; you spend attack to Wound him.
- `dims/j-jonah-jameson`: can't be fought while he has Angry Mobs.
- `pttr/sinister-six` doppelganger, kraven-the-hunter and sandman: variable printed attack (`""`).
- `noir/kraven-animal-trainer`: `"*"` is parsed as captured-Hero cost, so it fights for 0 with no captures. Same class as the three above. The gate review found it after the operator decision; it is recorded here as covered by that decision, and surfaced to Jeff in the drafting summary.

The bot already exploits all seven today. The remaining null-attack villain cards are Traps or genuinely attack-less (WP-762 §Out of Scope) and are correct as data. This WP makes them reachable by humans.

**Jeff accepted this residual (2026-09-25).** Each card is queued as a named engine follow-up, recorded in D-24594 and D-24574. It does not block this WP. Executing this WP does not re-open the decision.

## Acceptance Criteria

1. A City villain whose `fightCost` exceeds its printed cost (a Dark-Portal space, captured Heroes, a Skrull) shows Fight **disabled** with `Needs {fightCost} attack, you have {n}.` when attack = printed. The EV button is hidden. The Fight N badge shows `fightCost`.
2. A City villain with a `null` printed cost and `fightCost` 0 shows Fight **enabled** (it previously said "This card cannot be fought."). The badge shows `Fight 0`.
3. A City villain whose `fightCost` equals its printed cost renders exactly as before, with no badge. Existing CityRow assertions still pass after only the helper migration.
4. The WP-756 slash-gesture gate (`gateForCityIndex`) returns the same verdict as the Fight button for every case above.
5. `UIMastermindState.fightCost` equals `resolveMastermindFightCost` for every audience (filter test), and is printed + 1 with a Dark Portal on the Mastermind (build test). It is present in the diagnostics `uiStateSnapshot`.
6. MastermindTile with `fightCost` = printed + 1 and attack = printed shows Fight **disabled** and EV hidden, with the badge showing. With `fightCost` absent it falls back to `display.cost`, **no badge renders**, and the existing tests pass unchanged.
7. `useCardCostGating` keeps its exact message strings and EV `cost + 1` semantics with numeric input.
8. Suites and checks:
   - `pnpm -r build` exits 0.
   - The engine suite, the arena-client suite and `pnpm --filter @legendary-arena/arena-client typecheck` are green.
   - `pnpm -r --no-bail test` has 0 failures.
   - The arena-client count grows from the 2084 baseline, with no test deleted.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass.
3. `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
4. `pnpm --filter @legendary-arena/arena-client test` → all pass.
5. `pnpm -r --no-bail test` → 0 fail.
6. Run `preview_start` with the arena-client launch config, then navigate to `/?fixture=mid-turn&play=1`. Expected:
   - three `[data-testid=play-city-fight-cost]` with text `Fight 0`, and three enabled `play-city-villain` buttons;
   - the Mastermind button titled `This card cannot be fought.` (null fallback: the fixture predates the field), with no `play-mastermind-fight-cost`;
   - the badge inside the tile at the bottom, the board scale unchanged, no overlap with the portal marker.

   Screenshot at 1280×720.
7. `git diff --name-only` ⊆ Files Expected to Change. Revert `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] All Acceptance Criteria pass; the diff is allowlist-only.
- [ ] D-24574 appended as Active; `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] The WP-748 and WP-760 rows still name WP-750 as a hard dependency. This WP flipping to `[x]` unblocks them, so no edit is needed.
- [ ] Two-commit topology: `EC-787:`, then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a live Portals to the Dark Dimension match on `play.legendary-arena.com` (deployed gitSha checked), with a Dark Portal on a City space or the Mastermind:
  - the tile shows `Fight printed+1`;
  - Fight stays disabled at exactly printed attack;
  - Fight enables at printed + 1, and the fight succeeds.

  Recorded as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24574 — client-fight-gating-reads-engine-fightcost.** It locks the following:
- **Fight-cost source.** The client's fight-cost source is the engine projection only:
  - City: `UICityCard.fightCost`.
  - Mastermind: `UIMastermindState.fightCost`, optional, with a `display.cost` fallback for old snapshots.
- **Engine additions.** Any future fight-cost term is added engine-side in `resolveFightCost` / `resolveMastermindFightCost`, and flows through with no client change.
- **Gating signature.** `canFight` / `canFightWithExcessiveViolence` take a number.
- **Badge rule.** The Fight N badge shows only on mismatch.
- **Patrol note.** Patrol/Guard are unset (D-2504). If a future data pass sets Patrol, it must be absorbed into the projection.
- **Named follow-up.** The defeat-requirement dead-button.
- **Null-vAttack data gap.** WP-762 fills it before this packet executes; recorded under §Operator Decision.

---

## Lint Gate Self-Review (00.3)

- **§1:** all sections present.
- **§2:** boilerplate + session protocol.
- **§3:** Assumes verified by a research subagent and by the observed scaffold run (Assumes 9).
- **§4:** architecture, DECISIONS and consumer WPs cited.
- **§5:** 11 files, justified.
- **§6:** canonical names (`fightCost`, `UICityCard`, `UIMastermindState`).
- **§7:** hard dependency WP-762 (sequencing, operator decision); all others ✅.
- **§8:** layers declared; engine change confined to the UIState projection.
- **§9:** pnpm only.
- **§10–§11:** N/A.
- **§12:** `node:test` + vue-sfc-loader.
- **§13:** exact commands + preview.
- **§14:** 8 binary ACs.
- **§15:** STATUS, DECISIONS, indexes, live-verify.
- **§16:** human-style.
- **§17:** satisfied.
- **§18–§21:** N/A, each justified.

**Verdict:** PASS, pending the independent gates below.

## Gate Record

**Scaffold (01.4 §Empirical Scaffold):** observed; see Assumes 9.
**Pre-flight (01.4), round 1 (independent subagent).** Every Assumes claim was verified. The allowlist is complete: only CityRow and MastermindTile call the fight predicates, no engine test pins the `UIMastermindState` keyset, and the diagnostics snapshot is the whole store. Both consumers are satisfied (WP-748 AC "tile shows fightCost"; WP-760 city gating).

Findings, all fixed in this revision:
- **PS-1:** Mastermind badge rule — never render from the fallback.
- **PS-2:** badge placement — inside the tile button, bottom, not a flex child.
- **PS-3:** D-2302 → **D-2504** (the Patrol/Guard safe-skip; `buildCardKeywords.ts`'s own comment carries the same mis-citation, left for a future hygiene pass).
- **PS-4:** EC failure smell corrected.
- **RS-2:** test expectations locked.
- **RS-3:** the tile shows both the printed and the Fight cost, by design.
- **Lint:** §13 exact preview command, §14 AC-6 fallback case, §19 stale consumer rows updated.

**RS-1** (null-vAttack free fights) was escalated to the operator. Jeff chose to fill the data first (WP-762 hard dependency); see §Operator Decision. **Scope verdict: READY TO EXECUTE once WP-762 merges.**

**Copilot (01.7), round 1: RISK (HOLD)** on #5, #27 and honest-UX/product. #5 and #27 are fixed above; the product risk is RS-1.

**Operator decisions:** (1) fill the data first (WP-762 hard dependency); (2) accept the residual list as engine follow-ups.

**Final CONFIRM (independent subagent, round 2).** All round-1 fixes are verified. The six text defects it found were fixed in this revision (see WP-762 Gate Record). No design change.

**Scope verdict: READY TO EXECUTE once WP-762 merges.** Copilot: RISK (documented).
