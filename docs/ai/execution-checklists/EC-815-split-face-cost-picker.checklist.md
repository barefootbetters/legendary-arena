# EC-815 — Split-face cost picker (Execution Checklist)

**Source:** docs/ai/work-packets/WP-778-split-face-cost-picker.md
**Layer:** Arena Client (App)

## Before Starting
- [ ] The EC-814 commit is on `main` and `UISplitFaceOption` carries `isSelectable?` + `discardToPlayCost?`; else STOP
- [ ] `pnpm --filter "@legendary-arena/arena-client^..." build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (Before)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (record the baseline count)
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- Disabled iff `isSubmitting || option.isSelectable === false`; `aria-disabled` mirrors it.
- Cost line when `(option.discardToPlayCost ?? 0) > 0`: cost 1 → `Discard a card to play this side`;
  cost N > 1 → `Discard ${N} cards to play this side`; `data-testid="split-face-${face}-cost"`.
- Unselectable hint (rendered when `option.isSelectable === false`): `No card in hand to discard`
  when `(option.discardToPlayCost ?? 0) <= 1`, else `Not enough cards in hand to discard`, with
  `data-testid="split-face-${face}-blocked"`.
- `@click="onChoose(entry)"`; `onChoose(entry)` FIRST line: `if (isFaceDisabled(entry.option)) return;` — before the `isSubmitting` latch.
- Reuse the existing `.split-face-prompt__btn:disabled` rule. Exactly +5 tests in the existing `describe` (9 tests / 1 suite / 0 fail → 14 / 1 / 0), enumerated in WP-778 §Scope.
- Absent `isSelectable` ≡ selectable; absent `discardToPlayCost` ≡ 0 (today's render).

## Guardrails
- Client-only; no `packages/**` / server change. Render served fields verbatim (D-20105) — never count the hand.
- A disabled face never calls `submitMove` (the `onChoose` guard as well as `:disabled`).
- `leftFace` order, the `isSubmitting` latch, `AbilityText` routing, and the existing `data-testid`s are unchanged.
- Existing picker tests stay green WITHOUT edits.
- No nested ternaries; JSDoc on each new helper; full-word names.

## Required `// why:` Comments
- `isFaceDisabled`: the engine rejects an unselectable face (D-24615), so the button must not offer it.
- The absent-field fallback: the fields are optional in the engine type; absent renders as before WP-778.

## Files to Produce
- `apps/arena-client/src/components/play/SplitFaceChoicePrompt.vue` — **modified**
- `apps/arena-client/src/components/play/SplitFaceChoicePrompt.test.ts` — **modified**
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] vue-tsc exits 0 (After); arena-client suite 0 failures; before/after counts recorded
- [ ] The 5 tests: (1) cost 1 line; (2) cost 2 + unselectable → plural line + `Not enough…` hint; (3) absent / cost 0 → today's
      render; (4) cost 1 unselectable → disabled + hint + guard proof (`removeAttribute` → `trigger` → no submit);
      (5) own wrapper: force-click blocked face, then other face → exactly one `{ face: 'b' }` call
- [ ] `git status --porcelain` ⊆ Files to Produce
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — no new entry (consumes D-24615)
- [ ] Live (D-24026, post-deploy): Attune disabled with hint on an empty hand; cost line with a card in hand; matchId in STATUS.md
- [ ] WORK_INDEX WP-778 `[x]` with date; EC_INDEX EC-815 → Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write` + `:check` exit 0

## Common Failure Smells
- Every Falcon picker shows a disabled Attune → reading `!option.isSelectable` (treats absent as false).
- Clicking the disabled face still logs a move → only `:disabled` was bound; the `onChoose` guard is missing.
- Atone dead after tapping a greyed Attune → the latch is set before the disabled guard.
- vue-tsc red on the test → a fixture typed as `UISplitFaceOption` gained a required field; the fields must stay optional.
