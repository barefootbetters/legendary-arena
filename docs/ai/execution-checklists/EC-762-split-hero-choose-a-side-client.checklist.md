# EC-762 — Split / dual-faced hero "choose a side": arena-client picker (Execution Checklist)

**Source:** docs/ai/work-packets/WP-725-split-hero-choose-a-side-client.md
**Layer:** Arena Client (App)

## Before Starting
- [ ] **WP-724 merged** — the engine serves `UIPendingSplitFaceChoice` (chooser-redacted) and accepts
      `resolveSplitFaceChoice({ face: 'a' | 'b' })`. Confirm the served shape matches WP-724 §Contract.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (vue-tsc — esbuild/tsx do NOT type-check)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (record the baseline count)
- [ ] `CoveringFireChoicePrompt.vue` + `AbilityText.vue` present (the model + the ability renderer).
- [ ] EXACT target file set = `## Files to Produce`; any file outside it (esp. any `packages/**` file) is a FAIL.

## Locked Values (do not re-derive)
- Consume `UIPendingSplitFaceChoice = { playerID; faceA; faceB }`, each face
  `{ extId; name; abilityText?; cost: number|null; attack: number; recruit: number }` — verbatim from WP-724.
- Submit `resolveSplitFaceChoice({ face: 'a' | 'b' })`; `UiMoveName` gains `'resolveSplitFaceChoice'`.
- Render gate: `pendingSplitFaceChoice !== undefined && viewerPlayerId === playerID`.
- `data-testid="arena-hud-split-face-choice"`.

## Guardrails
- **Client-only** — no engine / server / `packages/**` change; consume the served field verbatim (D-20105:
  the client re-evaluates no rule and composes no game text).
- Ability text renders through `AbilityText.vue` — NEVER raw marker syntax (`[hc:…]` / `[icon:…]` / `[keyword:…]`).
- The prompt renders only for the chooser (double-gate on top of the server-side chooser-redaction).
- `boardgame.io/react` is never imported; dispatch through the existing move-submission path.
- While the choice is pending, the End-Turn / Pass action is gated via `useTurnActions` `anyPendingChoice()`.

## Required `// why:` Comments
- The chooser double-gate — why the client re-checks `viewerPlayerId === playerID` though the field is
  already server-redacted.
- The `useTurnActions` gate addition — why an unresolved split-face choice blocks End-Turn/Pass.

## Files to Produce
- `apps/arena-client/src/components/play/SplitFaceChoicePrompt.vue` — **new** — the picker
- `apps/arena-client/src/components/play/SplitFaceChoicePrompt.test.ts` — **new** — component tests
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — `UiMoveName` union member
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified** — End-Turn/Pass gate + aggregate
- `apps/arena-client/src/components/play/TurnActionBar.vue` — **modified** — gate prop
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — mount + prop pass
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — mount + prop pass

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (vue-tsc clean)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (incl. new SplitFaceChoicePrompt tests)
- [ ] `pnpm -r build` exits 0
- [ ] **D-24026 live-verify (REQUIRED):** on deployed `play.legendary-arena.com`, play `cvwr/peter-parker`'s
      split card, confirm the picker appears, pick each face, confirm correct economy + ability + no freeze —
      observable evidence captured (closes the WP-724→WP-725 arc)
- [ ] `git diff --name-only` = the 7-file allowlist; no `packages/**`, no `apps/server`
- [ ] `docs/ai/STATUS.md` updated (split-hero "choose a side" complete on-screen)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-725 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-725 node `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- `vue-tsc` errors ship to `main` → the `typecheck` gate was skipped (build + test do not type-check the SFC).
- Raw `[hc:…]` / `[keyword:…]` text shown to the player → ability text was not routed through `AbilityText.vue`.
- Opponents see the prompt → the chooser double-gate was omitted (rely on server redaction alone is a smell).
- Board freezes with no picker → the prompt was not mounted in one of PlayDesktop / PlayMobile, or the
  `hasPendingSplitFaceChoice` computed was not passed through.
