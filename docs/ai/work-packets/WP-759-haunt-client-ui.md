# WP-759 — Haunt client UI: haunted HQ cards, Exorcise action, and the haunting-Mastermind tile (Arena Client)

**Status:** Draft 2026-09-25 — **BLOCKED on WP-757** (reads its UIState fields and submits its move)
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:**
- **WP-757 / D-24587** — `UIHQState.haunters?`, `UIHQHaunter`, `UIMastermindState.isHaunting?`, and the move `exorciseHauntedHero`.
- WP-129 / EC-132 — HQRow, `useCardCostGating`, `useTurnActions`, and the stage → resource → structural tooltip precedence.
- WP-648 — the `recruitOfficer` client move-name precedent.
- WP-738 / D-24561 — `gateForFight` / `showEvFight` in MastermindTile.

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It is a single app, but it has more than 4 files and adds a new move affordance. Any ambiguity routes to standard.
**Arc:** 3 of 3. It runs after WP-757 and is parallel-safe with WP-758 (the two touch disjoint files). No D-entry: it consumes D-24587.

> Baseline: `origin/main` at `02769e98`, plus reserve commit #2356. At execution, re-baseline on the WP-757 merge commit.

---

## Goal

After this session, `HQRow.vue` shows each haunted slot's haunter:
- A Villain haunter shows its card art and name, from the `display` that WP-757 embeds in `UIHQHaunter`.
- A Mastermind haunter shows the Mastermind's name.

On a haunted slot:
- Recruit is disabled, with the tooltip "Haunted — exorcise it first".
- An **Exorcise (N)** button is gated exactly like the engine guard.
- Clicking Exorcise opens an in-flow chooser with **KO the Hero** or **Give it to:**, followed by one button per seat. The viewer comes first, labelled "You".
- The chooser submits `exorciseHauntedHero`.

`MastermindTile.vue` blocks Fight while `mastermind.isHaunting`, and shows a "Haunting" badge.

## User-Visible Impact

Players can see which HQ Heroes are possessed and by whom. They cannot mis-click a Recruit or a Fight the engine will refuse, which is the dead-button class from auto-memory `reference_client_fight_gating_ignores_fightcost`. Exorcise is a single click followed by an explicit KO-or-give decision, matching rulebook v23 p.27.

---

## Assumes

1. **WP-757 is merged**, with these exact shapes:
   - `UIHQHaunter = { kind: 'villain'; extId: string; display: UICardDisplay } | { kind: 'mastermind' }`, exported from `@legendary-arena/game-engine`.
   - `UIHQState.haunters?: (UIHQHaunter | null)[]`, index-aligned to `slots`.
   - `UIMastermindState.isHaunting?: true`.
   - `exorciseHauntedHero({ hqIndex, outcome: 'ko' | 'gain', recipientPlayerId? })`.
2. `components/play/HQRow.vue`:
   - `gateForCell` (~70-86): stage via `useTurnActions(...).canRecruitHero()`, a stage-only fallback when `display === null` (~82), then `useCardCostGating(economy).canRecruit`.
   - `onRecruit` (~88) submits `submitMove('recruitHero', { hqIndex })`.
   - The recruit control is the whole-card `<button>` (~126).
   - `.hq-slots` is `overflow-x: auto`.
3. `composables/useHqRow.ts`: `HqCell` hero variant (~29-31). No existing test deep-compares whole cells.
4. `components/play/MastermindTile.vue`:
   - `gateForFight` (~87-117) checks stage (92), then cost (96).
   - The Excessive-Violence fight button is **hidden** via `v-if="showEvFight()"` (~248), and `showEvFight` calls `gateForFight` (~155-162).
5. `components/play/uiMoveName.types.ts`:
   - `UiMoveName` union (~43-144).
   - `SubmitMove` takes `args: unknown` (~151).
   - `bgioClient` dispatches `moves[name]` generically, so there is no payload type map to update.
   - `moveSfxManifest` is a `Partial<Record>`, so it needs no entry.
6. `composables/useTurnActions.ts` declares an **explicit return type** (~275-286). A new predicate is added to that type and to the returned object.
7. `UIState.players: UIPlayerState[]` carries `playerId` only; there is **no display name** (`uiState.types.ts` ~429). `seatIdentities` is null until game over. Labels come from `playerLabel(playerId, undefined)` → "Player N" (`vfx/scoreCalcDisplay.ts` ~393).
8. `pages/PlayDesktop.vue` (~879) and `pages/PlayMobile.vue` (~575) are the only HQRow + MastermindTile mounts. Desktop's HQRow mounts **outside** `v-if="viewer !== null"` (~879 vs ~893); Mobile's is inside it (~532). The new props stay optional for Desktop. `UIState.game.hasHealedThisTurn` exists (`uiState.types.ts:62`).
9. Fixtures are registered in `fixtures/uiState/index.ts` (`FixtureName` union, `KNOWN_FIXTURE_NAMES`, switch) and `fixtures/uiState/typed.ts`. They are served by the `?fixture=<name>&play=1` dev route. `mid-turn.json` is shared by many tests and has no `hq.slotDisplay`.
10. The client's `PendingSeatChoicePrompt.vue` renders WP-758's seat choices generically (no work here).
11. `pnpm --filter @legendary-arena/arena-client typecheck` (`vue-tsc --noEmit`) and `test` exit 0 on baseline.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `.claude/rules/architecture.md §UIState Projection Integrity`. WP-757 owns the five-step; this packet only consumes the fields.
- `docs/ai/DECISIONS.md` D-24587 (landed by WP-757): haunt semantics, and the fact that "gain" / "put bottom" still reach haunted Heroes.
- The files in Assumes 2–9, plus `components/play/SharedDecks.vue` (the `recruitOfficer` button + gating precedent) and `components/play/AbilityText.vue` (all rules text routes through it).
- User memory:
  - `reference_play_fixture_dev_route`
  - `reference_clipboard_verify_and_preview_block` (verify in the preview)
  - `feedback_verify_cross_surface_link_landing` (drive it; unit tests alone are not enough)
  - `project_playmat_spatial_rebuild_d24502` (1280×720 lock)

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`:
  - full-word names;
  - JSDoc on every function;
  - `// why:` comments;
  - no nested ternaries;
  - no `import *` or barrel imports.
- Layer boundary: arena-client imports only Runtime-Safe Engine Surface **types**. No registry, server, preplan or `pg` import.
- Determinism: no engine file is touched.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile by updating this WP before coding. One WP per session.

**Packet-specific:**
- **The client decides nothing.** Gating mirrors the engine guard, and the engine stays authoritative. No optimistic state change.
- Absent `haunters` / `isHaunting` (every non-Haunt match) → HQRow and MastermindTile render **byte-identically** to today. Existing tests are not edited to pass.
- **Recruit precedence on a haunted slot** (locked): stage → **Haunted** → resource. Haunted outranks resource because recruiting is impossible at any budget.
- **Exorcise gating** (locked):
  - Order: `canExorciseHauntedHero()` (viewer's turn ∧ `play.main`), then the heal lock (`hasHealedThisTurn === false`, reason `You healed this turn — you can't exorcise`, mirroring WP-757's `hasHealedThisTurn` guard), then `useCardCostGating(economy).canRecruit(display)`. This is the same cost source the engine's recruit path uses.
  - When `display === null`, fall back to stage-only, labelled "Exorcise" with no cost (the ~82 precedent).
  - Haunted null slot (hero deck ran dry): the haunter strip shows in the empty cell with **no** Exorcise button.
- **Mastermind lock** (locked): inside `gateForFight`, after the stage check and before the cost check, return `{ allowed: false, reason: \`${mastermind.display.name} is haunting a Hero in the HQ — exorcise it to fight\` }` when `isHaunting`. That same gate hides the EV button through `showEvFight`, so the EV button needs no separate gating.
- **DOM placement** (locked):
  - The Exorcise button is a **sibling** of the card `<button>` inside the `<li>`, never nested.
  - The chooser renders **in-flow below `<ol class="hq-slots">`**, never absolute/fixed. Absolute or fixed placement would break on the `overflow-x` clip, the mobile `--scroll-x` band, and the fit-stage scale transform.
- **Recipients** (locked):
  - The viewer's seat comes first, labelled "You". The others follow in `UIState.players` order, labelled `playerLabel(playerId, undefined)`.
  - Give submits `{ hqIndex, outcome: 'gain', recipientPlayerId }`.
  - KO submits `{ hqIndex, outcome: 'ko' }` with **no** `recipientPlayerId`.
  - When `viewerPlayerId` is null (spectator), no Exorcise renders.
- New HQRow props are **optional**: `players` (default `[]`), `viewerPlayerId: string | null` (default `null`), `mastermindName: string` (default `''`) and `hasHealedThisTurn: boolean` (default `false`). Callers pass `snapshot.players`, `viewer?.playerId ?? null`, `snapshot.mastermind.display.name` and `snapshot.game.hasHealedThisTurn`.
- The chooser is keyboard-accessible: buttons only, Escape closes it, and focus returns to the Exorcise button. It uses `defineComponent({ setup() { … } })` per D-6512 / EC-132 §2, and fits the 1280×720 play-mat and PlayMobile.

## Locked Values

- Client move name: `'exorciseHauntedHero'`.
- `HqCell` hero variant gains `haunter: UIHQHaunter | null`, computed as `hq.haunters?.[index] ?? null`.
- Recruit tooltip: `Haunted — exorcise it first`.
- Heal-lock tooltip on Exorcise: `You healed this turn — you can't exorcise`.
- Mastermind tooltip: `` `${name} is haunting a Hero in the HQ — exorcise it to fight` ``.
- Test ids:
  - `play-hq-haunter` (with `data-haunter-kind`, and `data-haunter-ext-id` when the haunter is a villain);
  - `play-hq-exorcise` (`data-hq-index`);
  - `play-exorcise-ko`;
  - `play-exorcise-give` (`data-recipient-id`);
  - `play-mastermind-haunting`.
- New fixture name: `haunted-hq`. It has one Villain-haunted slot, one Mastermind-haunted slot, `hq.slotDisplay` with costs, `mastermind.isHaunting: true`, and two players.

---

## Scope (In)

- **A) `composables/useHqRow.ts`** (+ `useHqRow.test.ts`): add the `haunter` field to the hero cell.
- **B) `components/play/HQRow.vue`** (+ `HQRow.test.ts`):
  - the haunter strip;
  - Recruit precedence;
  - the Exorcise button and gating;
  - the chooser mount (in-flow);
  - the four optional props.
- **C) `components/play/HauntedExorciseChooser.vue`** (new, + test): the KO button, Give buttons and Escape handling. It emits `choose(payload)` and `close`.
- **D) `components/play/MastermindTile.vue`** (+ test): the haunting lock in `gateForFight` and the badge.
- **E) `components/play/uiMoveName.types.ts`**: add `'exorciseHauntedHero'`.
- **F) `composables/useTurnActions.ts`** (+ test): `canExorciseHauntedHero()`, added to both the return type and the object.
- **G) `pages/PlayDesktop.vue`, `pages/PlayMobile.vue`**: pass the four props.
- **H) Fixture:**
  - `fixtures/uiState/haunted-hq.json` (new);
  - register it in `fixtures/uiState/index.ts` and `typed.ts`;
  - add a case to `fixtures/uiState/index.test.ts`.

## Out of Scope

- Any engine change (that is WP-757 / WP-758).
- Seat-choice prompts for Zarathos's tactics (the generic prompt covers them).
- Give-HQ-hero and put-bottom-HQ prompts: they correctly keep listing haunted Heroes, per the rulebook.
- The notable-event card lookup for haunting Villains.
- Haunt VFX/SFX (a possible later feel-layer beat).
- Registry-viewer and ewiki copy.
- Editing `mid-turn.json`.

## Files Expected to Change

- `apps/arena-client/src/composables/useHqRow.ts` — modified: `haunter` on the hero cell.
- `apps/arena-client/src/composables/useHqRow.test.ts` — modified: haunter derivation.
- `apps/arena-client/src/components/play/HQRow.vue` — modified: strip, precedence, Exorcise, chooser mount, props.
- `apps/arena-client/src/components/play/HQRow.test.ts` — modified: new cases; existing cases untouched.
- `apps/arena-client/src/components/play/HauntedExorciseChooser.vue` — **new**.
- `apps/arena-client/src/components/play/HauntedExorciseChooser.test.ts` — **new**.
- `apps/arena-client/src/components/play/MastermindTile.vue` — modified: `gateForFight` haunting lock + badge.
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — modified: new cases.
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — modified: union member.
- `apps/arena-client/src/composables/useTurnActions.ts` — modified: predicate + return type.
- `apps/arena-client/src/composables/useTurnActions.test.ts` — modified: predicate case.
- `apps/arena-client/src/pages/PlayDesktop.vue` — modified: HQRow props.
- `apps/arena-client/src/pages/PlayMobile.vue` — modified: HQRow props.
- `apps/arena-client/src/fixtures/uiState/haunted-hq.json` — **new**.
- `apps/arena-client/src/fixtures/uiState/index.ts` — modified: registration.
- `apps/arena-client/src/fixtures/uiState/typed.ts` — modified: typed export.
- `apps/arena-client/src/fixtures/uiState/index.test.ts` — modified: fixture case.
- Governance: `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

That is 17 code/test files against the ~8 guideline. The count is justified: seven are tests or fixture registration, and the rest is the minimum surface for one new move affordance across two mounts.

## Contract

- Client move `'exorciseHauntedHero'`, with payload `{ hqIndex, outcome: 'ko' }` or `{ hqIndex, outcome: 'gain', recipientPlayerId }`.
- `HqCell.haunter: UIHQHaunter | null`.
- HQRow optional props: `players`, `viewerPlayerId`, `mastermindName`, `hasHealedThisTurn`.
- The fixture name, test ids and tooltips listed under Locked Values.

## Vision Alignment

**Vision clauses touched:** §17 (accessibility: a keyboard-operable chooser) and NG-1 (no pay-to-win).
**Conflict assertion:** none.
**Non-Goal proximity:** NG-1..7 are not crossed. This is display plus intent submission only; the engine decides every outcome.
**Determinism preservation:** no engine file changes, so `finalStateHash` and replays are untouched by construction.

## Funding Surface Gate

§20 **N/A**: in-match HQ / Mastermind gameplay UI only. No nav, profile, funding copy or funding channel.

## API Catalog

§21 **N/A**: arena-client only. No HTTP endpoint and no `apps/server/src/**` surface. D-11804 does not apply.

---

## Acceptance Criteria

1. With no `haunters` / `isHaunting`, HQRow and MastermindTile render as before, and existing tests stay untouched and green.
2. A Villain-haunted slot:
   - shows `play-hq-haunter` with the Villain's `display.name` and art;
   - disables Recruit with "Haunted — exorcise it first" (even when Recruit is affordable);
   - shows `play-hq-exorcise` with the Hero's cost.

   A Mastermind-haunted slot does the same, with the strip labelled `mastermindName`.
3. Exorcise is disabled with the stage reason when it is not the viewer's turn or not `main`, with the heal-lock reason after a Heal this turn, and with the resource reason when `availableRecruit` is less than the cost. It is absent when `viewerPlayerId` is null or the slot is null.
4. The chooser works as follows:
   - KO submits `('exorciseHauntedHero', { hqIndex, outcome: 'ko' })`.
   - Give to X submits `{ hqIndex, outcome: 'gain', recipientPlayerId: X }`.
   - The viewer is listed first as "You".
   - Escape closes the chooser and returns focus.
5. With `isHaunting`, Mastermind Fight is disabled with the haunting tooltip, the EV button is not rendered, and `play-mastermind-haunting` is visible.
6. `?fixture=haunted-hq&play=1` loads, and the fixture registry test passes.
7. `pnpm --filter @legendary-arena/arena-client typecheck` and `test` exit 0, and `pnpm -r build && pnpm -r --no-bail test` has 0 failures.
8. The preview check on `haunted-hq` matches criteria 2–5 at desktop 1280×720 and on mobile, with screenshots.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0.
3. `pnpm --filter @legendary-arena/arena-client test` → all pass.
4. `pnpm -r --no-bail test` → 0 failures.
5. Start the arena-client preview (`.claude/launch.json`) and open `?fixture=haunted-hq&play=1`. Drive the strip, Recruit, Exorcise states and chooser, and read the submitted move in the console or network log. Screenshot desktop and mobile.
6. `git diff --name-only` ⊆ Files Expected to Change.

## Definition of Done

- [ ] Every Acceptance Criterion passes, and the diff is allowlist-only.
- [ ] `docs/ai/STATUS.md` is updated.
- [ ] `DECISIONS.md`: no new entry. This packet consumes D-24587, and that is recorded in the STATUS line.
- [ ] `WORK_INDEX.md` WP-759 is `[x]`, `EC_INDEX.md` EC-796 is Done, the mindmap node is `✅`, and `pnpm roadmap:counts:check` is 0.
- [ ] Two-commit topology: `EC-796:` implementation, then a `SPEC:` governance close.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED, shared with WP-757). In a live Zarathos / Fallen match on `play.legendary-arena.com`, with the deployed `/api/version` gitSha checked:
  - a haunted Hero shows its haunter;
  - Exorcise → KO works, and Exorcise → give works;
  - the Villain appears in the City.

  This is recorded as operator-pending until it is seen live.

---

## Lint Gate Self-Review (00.3)

**Round 1: FAIL.** The gate subagent found the following, all fixed in this revision:
- missing §2 boilerplate and session protocol;
- a false display-name claim (§3);
- missing architecture / D-24587 context (§4);
- 4 fixture files missing from the allowlist (§5);
- no STATUS / DECISIONS DoD lines (§15);
- no §17 / §20 / §21 sections;
- `## Scope` not split into `## Scope (In)` + `## Out of Scope` (§1).

**Round 2: PASS.**
- **§1:** all sections present.
- **§2:** boilerplate and session protocol present.
- **§3/§4:** Assumes verified against `apps/arena-client/src` by the gate subagent.
- **§5:** 17 files, justified.
- **§6:** test ids are locked.
- **§7:** no new dependency.
- **§8:** client-only; engine types only.
- **§9:** pnpm and git only.
- **§10/§11:** N/A (no env vars, no auth).
- **§12:** `node:test` + vue-sfc-loader; no network.
- **§13:** exact commands plus the preview drive.
- **§14:** 8 binary acceptance criteria.
- **§15:** STATUS, DECISIONS-none, the three indexes, mindmap and live-verify.
- **§16:** D-6512 `setup()`.
- **§17:** satisfied.
- **§18:** N/A.
- **§19:** N/A.
- **§20:** N/A.
- **§21:** N/A.

## Gate Record

**Pre-flight (01.4):** run by an independent subagent against live code. The verdict was **DO NOT EXECUTE YET**, for two reasons:
- WP-757 is not merged. This is a dependency block; the packet lands as a BLOCKED `[ ]` placeholder per 01.0a §Blocking drafts.
- The contract had gaps. **PS-1..6 are resolved in this revision:**
  - PS-1: the haunter `display` was moved into WP-757's contract;
  - PS-2: the player-label source;
  - PS-3: the `mastermindName` prop and tooltip;
  - PS-4: optional props;
  - PS-5: the fixture files;
  - PS-6: EV hide-via-`gateForFight`.

  RS-1..5 are locked under Constraints.

**Scope verdict:** READY TO EXECUTE once WP-757 is merged and its shipped contract matches Assumes 1. The executor re-confirms that at session start.

**Copilot (01.7):** RISK (HOLD). The flagged modes were #4 / #21, #9, #12, #26, #5 and #30, and every one maps to a PS/RS item above. **Re-run (round 2, independent subagent):**
- All of PS-1..6 are confirmed resolved against live code, and the contract matches WP-757 verbatim.
- Two new findings, both fixed in this revision:
  - PS-7: Exorcise ignored the engine's heal lock (a dead button). Fixed with the `hasHealedThisTurn` prop and gate.
  - PS-8: the mobile mount wording.
- Verdicts: pre-flight **READY TO EXECUTE once WP-757 merges**; copilot **RISK (documented)**.
- Residual risk: the in-flow chooser inside the fixed-height desktop HQ zone. AC-8's 1280×720 screenshot covers it.

**Round 3 CONFIRM (independent subagent):** CONFIRM. Every recorded fix is consistent across WP, EC and session prompt, code facts were re-verified, the cross-packet contract matches verbatim, and the stale-text sweep came back clean.
