# EC-310 — Cards Tab "Add to Loadout" (Execution Checklist)

**Source:** docs/ai/work-packets/WP-279-cards-tab-add-to-loadout.md
**Layer:** Registry Viewer (`apps/registry-viewer`)

## Before Starting (Hard Gate)
- [ ] WP-091 landed: `test -f apps/registry-viewer/src/composables/useLoadoutDraft.ts` → OK (the draft API this consumes)
- [ ] Worktree built once (`pnpm -r build`) so the viewer typechecks against the registry dist
- [ ] Baseline green: `pnpm --filter registry-viewer typecheck` 0; `test` 0 (note the count to preserve)

## Locked Values (do not re-derive)
- Composition slots ↔ card types: `scheme`→schemeId, `mastermind`→mastermindId, `villain`→villainGroupIds, `henchman`→henchmanGroupIds, `hero`→heroDeckIds; any other cardType → no button / `null`
- Canonical field names verbatim (00.2 §8.1): `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `extId`
- The add id is `card.extId` (the set-qualified group ext_id, D-24018) — NOT `card.key`
- Add/remove uses ONLY existing `UseLoadoutDraftApi` methods: `setScheme`/`setMastermind` (`""` clears), `addHeroGroup`/`removeHeroGroup`, `addVillainGroup`/`removeVillainGroup`, `addHenchmanGroup`/`removeHenchmanGroup`
- Single shared draft: exactly ONE `useLoadoutDraft` instance, owned by `App.vue`, instantiated in `onMounted` AFTER the registry resolves (validation computed dereferences `registry`) — mirrors `useSetupFromUrl(reg)`
- Always-Leads safety: `toggleCardInLoadout` is a no-op when removing a group in `requiredVillainGroupIds`
- Tray hidden when the draft has 0 picks AND when `activeView === 'loadout'`; pill is bottom-LEFT (glossary FAB is bottom-right)

## Guardrails
- `LoadoutBuilder.vue` MUST stop calling `useLoadoutDraft` — it receives the API as a prop (`grep -c "useLoadoutDraft(" LoadoutBuilder.vue` → 0)
- Children call named API methods only; NEVER mutate the shared reactive arrays / props directly
- No engine / contract / draft-logic change: do NOT edit `useLoadoutDraft` mutation/validation, `setupContract`, any `.types.ts`/`.validate.ts`/`.gating.ts`, or `MatchSetupConfig`
- No forbidden import in `CardDetail.vue` / `LoadoutTray.vue` / `loadoutCardActions.ts` (`game-engine`/`server`/`dashboard`/`boardgame.io`/`scripts/`); helper is boardgame.io-free
- No game logic in components; no direct R2 fetch (data flows from the loaded registry)
- `for...of` / explicit `if/else` (no branching `.reduce()`); full-word names; `is*`/`has*` booleans
- Do NOT touch the Loadout tab picker, `LoadoutPreview.vue`, `useSetupFromUrl`, or the Cards filters (WP-278)

## Required `// why:` Comments
- On the post-load `useLoadoutDraft(reg)` instantiation in `App.vue` (deferred because the validation computed dereferences `registry` — same reason as `useSetupFromUrl`)
- On the Always-Leads removal no-op in `toggleCardInLoadout`
- On any non-obvious cardType→slot routing in the helper

## Files to Produce
- `App.vue` (modified — lift instance; pass API; `inLoadout` + `toggle-loadout`; render `LoadoutTray`)
- `components/LoadoutBuilder.vue` (modified — accept draft API as a prop)
- `components/CardDetail.vue` (modified — contextual add/remove button)
- `components/LoadoutTray.vue` (new — floating pill)
- `lib/loadoutCardActions.ts` (new — `resolveLoadoutSlot`/`isCardInLoadout`/`toggleCardInLoadout`)
- `lib/loadoutCardActions.test.ts` (new — node:test coverage)
- `DECISIONS.md` (D-24054) + `WORK_INDEX.md` + `EC_INDEX.md` + `STATUS.md` (governance close)

## After Completing
- [ ] One `useLoadoutDraft` instance in App.vue; 0 in LoadoutBuilder; button for the 5 types only; tray ships
- [ ] Helper tests cover add / remove / single-slot clear / Always-Leads-locked no-op / non-composition → null
- [ ] No forbidden import; helper boardgame.io-free; no draft-logic/contract edit
- [ ] `typecheck` 0; `test` 0 (count preserved + new helper tests); `build` 0
- [ ] LIVE: add hero from Cards → appears in Loadout `heroDeckIds`; remove; scheme set/clear; villain add/remove; tray counts + jump; bystander shows no button; existing export/picker unchanged
- [ ] D-24054 lands; WORK_INDEX/EC_INDEX/STATUS flipped
- [ ] Commit prefix `EC-310:` (code) + `SPEC:` (governance); D-24026 live-verify post-deploy

## Common Failure Smells
- Loadout tab blank/crashes after the lift → the draft was instantiated before `registry` loaded; defer to onMounted (post-fetch)
- Two draft instances drift (add from Cards not visible in the tab) → LoadoutBuilder still calls `useLoadoutDraft`; make it consume the prop
- Hero won't add / HTTP-500-shaped id stored → used `card.key` not `card.extId`
- A required villain group can be removed via the button → missing the `requiredVillainGroupIds` no-op guard
- Button shows on bystander/wound/other → `resolveLoadoutSlot` not gating to the 5 composition types
- Tray overlaps the glossary FAB or shows on a blank draft → bottom-left + hide-when-empty/on-loadout-tab
