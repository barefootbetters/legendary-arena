# EC-796 — Haunt client UI (Execution Checklist)

**Source:** docs/ai/work-packets/WP-759-haunt-client-ui.md
**Layer:** App (arena-client)

> **Executed 2026-11-10 on `f609ddff` with WP-759 §Execution Amendments A-1..A-5**, which override the Locked Values below where they differ: three new props (`hasHealedThisTurn` already existed), Recruit precedence stage → heal → Haunted → resource, and Exorcise at the printed cost.

## Before Starting
- [x] WP-757 merged. `UIHQHaunter` (`{ kind: 'villain'; extId; display: UICardDisplay } | { kind: 'mastermind' }`), `UIHQState.haunters?` and `UIMastermindState.isHaunting?` are all exported from `@legendary-arena/game-engine`. Move `exorciseHauntedHero` is registered. On any mismatch, STOP.
- [x] `pnpm -r build` exits 0 (the client reads the engine's built `dist`).
- [x] `pnpm --filter @legendary-arena/arena-client typecheck` and `test` exit 0 on baseline.
- [x] The WP Assumes 2–9 anchors are unchanged (re-baselined; drift recorded as WP-759 A-1..A-5): HQRow `gateForCell`, MastermindTile `gateForFight` / `showEvFight`, `useTurnActions` explicit return type, fixture registry, and the HQRow mount outside `viewer !== null`.

## Locked Values (do not re-derive)
- Move: `'exorciseHauntedHero'`. Payloads: `{ hqIndex, outcome: 'ko' }` (no recipient) or `{ hqIndex, outcome: 'gain', recipientPlayerId }`.
- `HqCell` hero variant gets `haunter: UIHQHaunter | null` = `hq.haunters?.[index] ?? null`.
- Optional HQRow props, and what the caller passes:
  - `players` — default `[]`; pass `snapshot.players`.
  - `viewerPlayerId: string | null` — default `null`; pass `viewer?.playerId ?? null`.
  - `mastermindName` — default `''`; pass `snapshot.mastermind.display.name`.
  - `hasHealedThisTurn` — default `false`; pass `snapshot.game.hasHealedThisTurn`.
- Recruit precedence on a haunted slot: stage → `Haunted — exorcise it first` → resource.
- Exorcise gating:
  1. `canExorciseHauntedHero()` (viewer's turn ∧ `play.main`), then the heal lock (`You healed this turn — you can't exorcise`), then `useCardCostGating(economy).canRecruit(display)`.
  2. If `display === null`, gate on stage only and label the button "Exorcise" with no cost.
  3. A null slot or a null `viewerPlayerId` renders no button.
- Mastermind lock: **already shipped by PR #3207; do not move or reword it.** Inside `gateForFight`, after the cost check and before the all-tactics-defeated check, reason `The Mastermind is haunting a Hero in the HQ. Exorcise that Hero first.`. It also hides the EV button through `showEvFight` and keeps the Enigma picker closed. This packet adds only the `play-mastermind-haunting` badge.
- Recipients: the viewer first ("You"), then the others in `players` order, labelled `playerLabel(playerId, undefined)`.
- Test ids:
  - `play-hq-haunter`, with `data-haunter-kind` and `data-haunter-ext-id`;
  - `play-hq-exorcise`, with `data-hq-index`;
  - `play-exorcise-ko`;
  - `play-exorcise-give`, with `data-recipient-id`;
  - `play-mastermind-haunting`.
- Fixture `haunted-hq`: one Villain-haunted slot, one Mastermind-haunted slot, `slotDisplay` with costs, `isHaunting: true`, two players.

## Guardrails
- The client decides nothing. No optimistic mutation; the engine stays authoritative.
- Absent `haunters` / `isHaunting` → byte-identical render. Never edit an existing assertion to pass.
- The Exorcise button is a sibling of the card `<button>`, never nested inside it. The chooser renders in-flow below `<ol class="hq-slots">`, never absolute or fixed (overflow clip, mobile scroll band, fit-stage transform).
- Keep `mid-turn.json` unchanged; the haunt state lives only in the new `haunted-hq` fixture.
- The chooser uses `defineComponent({ setup() {...} })` (D-6512). It is keyboard-operable: Escape closes it and focus returns to the Exorcise button.
- Add `canExorciseHauntedHero` to `useTurnActions`' explicit return type as well as the returned object.

## Required `// why:` Comments
- The HqCell haunter derivation: D-24587's index-aligned optional array.
- The Haunted-before-resource precedence: recruiting is impossible at any budget.
- Mirroring the engine predicates, including the heal lock, so there are no dead buttons (the WP-750 lesson).
- KO sends no `recipientPlayerId`.
- The in-flow chooser placement: why not absolute or fixed.

## Files to Produce
- `apps/arena-client/src/composables/useHqRow.ts` + `useHqRow.test.ts` — **modified**
- `apps/arena-client/src/components/play/HQRow.vue` + `HQRow.test.ts` — **modified**
- `apps/arena-client/src/components/play/HauntedExorciseChooser.vue` + `.test.ts` — **new**
- `apps/arena-client/src/components/play/MastermindTile.vue` + `MastermindTile.test.ts` — **modified**
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified**
- `apps/arena-client/src/composables/useTurnActions.ts` + `useTurnActions.test.ts` — **modified**
- `apps/arena-client/src/pages/PlayDesktop.vue`, `apps/arena-client/src/pages/PlayMobile.vue` — **modified**
- `apps/arena-client/src/fixtures/uiState/haunted-hq.json` — **new**
- `apps/arena-client/src/fixtures/uiState/index.ts`, `typed.ts`, `index.test.ts` — **modified**

## After Completing
- [x] `pnpm -r build` exits 0.
- [x] arena-client `typecheck` exits 0 and `test` passes (2610 / 0).
- [x] `pnpm -r --no-bail test` has 0 failures.
- [x] Preview `?fixture=haunted-hq&play=1` shows the strip, Recruit disabled, the Exorcise states and the chooser payloads, at desktop 1280×720 and mobile 375×812.
- [x] `STATUS.md` updated. `WORK_INDEX.md` `[x]`. `EC_INDEX.md` Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [x] Allowlist-only diff.
- [x] Two-commit topology.
- [x] Live-verify (D-24026) recorded as operator-pending in STATUS, shared with WP-757 / WP-758 / #3207.

## Common Failure Smells
- Villain strip shows a hyphenated id instead of a name → reading `extId` instead of the embedded `display`.
- Existing HQRow tests fail on missing props → the new props were made required.
- Chooser clipped or offset on mobile → it was positioned absolute or fixed.
- EV fight button still shows while haunting, or an existing `Haunt blocks the Fight` test fails → the PR #3207 lock in `gateForFight` was moved, reworded or removed.
- Exorcise enabled after a Heal but the engine refuses it → the heal-lock gate is missing.
- Exorcise click does nothing → wrong payload (a recipient sent on KO, or a numeric seat id).
