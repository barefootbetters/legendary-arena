# EC-851 — Play a Saved Loadout from the Profile (Execution Checklist)

**Source:** docs/ai/work-packets/WP-303-play-saved-loadout.md
**Layer:** App: `apps/arena-client` (one pure helper + test + one planned profile-page edit; 01.5 not invoked)

## Before Starting
- [ ] `GET /api/me/loadouts` rows carry `lagn` (`SavedLoadoutView.lagn: unknown`, `lib/api/loadoutLibraryApi.ts`).
- [ ] `lobby/useCreateMatchFromComposition.ts` exports the never-throw
      `launchMatchFromComposition({ config, playerCount, playerName, authToken })`.
- [ ] `lobby/lagnLoadout.ts` exports `convertLagnUpload`; `lobby/parseLoadoutJson.ts`
      exports `parseLoadoutJson` (rejects unqualified ext_ids, `playerCount` 1..5).
- [ ] `MyProfilePage.vue` `playLeg` already calls the primitive with the
      `displayName ?? handleCanonical ?? ''` seat name and a `readAuthToken()` guard.
- [ ] Fresh worktree off `origin/main`; capture the SHA (WP baseline `3072ec685`).
- [ ] Scope lock: EXACTLY 3 code files (§Files to Produce). Any other edit means STOP.
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/arena-client typecheck` 0; `test` green.

## Locked Values (do not re-derive)
- `planSavedLoadoutLaunch(lagn: unknown): SavedLoadoutLaunchPlan`, where
  `SavedLoadoutLaunchPlan = { ok: true; config: MatchConfiguration; playerCount: number } | { ok: false; message: string }`.
- Read order: `JSON.stringify(lagn)` → `convertLagnUpload` → on `ok`, `parseLoadoutJson(documentJson)`.
  A non-string stringify result (`undefined`) returns the not-LAGN copy directly (`// why:`).
- `config` = `parsed.composition` + `finalBlow: true` only when the conversion's
  `finalBlow` is true (omit-when-off). `playerCount` = `parsed.playerCount`.
- Unreadable prefix: `"This saved loadout can't be played. "` + the reader's message verbatim.
- Not-LAGN copy (`not_lagn`, `null`, missing): "This saved loadout can't be
  played. It is not a LAGN document; delete it and save it again from the loadout builder."
- Button **Play this loadout**, `data-testid="my-profile-loadout-play-<id>"`,
  the **first child** of `.profile-loadout-controls` (before the visibility label `<span>`),
  disabled while `loadoutLaunchInFlight`.
- Error line `<p class="profile-upload-error" data-testid="my-profile-loadout-play-error">`
  under the list, shown while `loadoutPlayError !== ''`.
- Signed out: "You are not signed in. Sign in to play a saved loadout."
  Launch failure: the primitive's `message` verbatim.
- Seat name: `view.value?.displayName ?? view.value?.handleCanonical ?? ''`, trimmed. Empty →
  "Your profile hasn't finished loading, so your seat has no name yet. Reload the page and try again." and NO launch.
- Unreadable-loadout and launch-failure messages are row-named: `` `${row.view.name} — ${message}` ``.
- In-flight: set before the launch call; cleared ONLY on `ok: false`; on success left set until navigation.
  A `pageshow` listener (`event.persisted`) resets it after a back/forward-cache restore
  (`resetLaunchOnPageRestore`, added in the existing `onMounted`, removed in a new `onBeforeUnmount`).
- Help sentence appended: "Press Play this loadout to start a match with that lineup."
- Test floor: `savedLoadoutLaunch.test.ts` has at least 10 tests (the WP §Scope (In) B cases), one
  `describe`, qualified ids, each case narrowing the plan union (`vue-tsc` checks tests).

## Guardrails
- Full file contents for every new or modified file. ESM, Node v22+, `node:test`, `.test.ts`. No new npm dependency.
- **Session protocol:** an Assumes item false, an out-of-allowlist edit needed, or a value unclear → STOP and ask.
- **No server, engine, registry, or lobby change.** `lagnLoadout.ts`, `parseLoadoutJson.ts`,
  `useCreateMatchFromComposition.ts`, and `LobbyView.vue` stay byte-identical.
- **No LAGN validator import** (D-24722): no `@legendary-arena/lagn` / `registry` /
  `game-engine/setup` / `apps/server`. Only the type-only `MatchConfiguration`.
- **One primitive** (D-24268): the launch is one `launchMatchFromComposition` call; no `createMatch(` / `joinMatch(` in new code.
- **No new server read.** Use the `lagn` already in `loadoutRows`.
- **Decorative lock** (§19a): launching writes nothing to the loadout.
- The helper never throws; `playSavedLoadout` never throws. Step order: in-flight guard → clear error →
  auth guard → empty-name guard → plan → launch. On success in-flight stays set until navigation.
- `MyProfilePage.vue` keeps `defineComponent({ setup() { return {...} } })` (D-6512).

## Required Comments
- File-level comment in `savedLoadoutLaunch.ts` citing WP-303 / D-24087 / D-24268 / D-24722: why the lobby readers, not a validator import.
- `// why:` on the `finalBlow` spread (D-24658 omit-when-off, mirrors `submitFromJson`).
- `// why:` in `playSavedLoadout` on the launch call (D-24268: one primitive, no new chain), and on
  the success path (in-flight stays set until navigation; prevents a second match), and in
  `resetLaunchOnPageRestore` (back/forward-cache restore re-enables Play).
- Updated `<!-- why: -->` on the Saved Loadouts section citing WP-303 / D-24722 ("Load into lobby" still out).

## Files to Produce
- `apps/arena-client/src/lib/savedLoadoutLaunch.ts` — **new** — `planSavedLoadoutLaunch`
- `apps/arena-client/src/lib/savedLoadoutLaunch.test.ts` — **new** — at least 10 helper tests
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — button, `playSavedLoadout`, two refs, error line, help sentence, `pageshow` reset, `why` comment (planned in-allowlist edit)
- Governance (SPEC govern-close commit): `docs/05-ROADMAP-MINDMAP.md` (`📝` → `✅` + counts) and the other After Completing ledgers

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/arena-client typecheck` 0; suite green.
- [ ] Absence greps, **import lines and code-call lines only, never comments** (the WP
      §Verification Steps `$importPattern` / `$callPattern`): no match in the two new
      files or in the added lines of the `MyProfilePage.vue` diff.
- [ ] Wiring grep: `@click="playSavedLoadout(row)"` and `:disabled="loadoutLaunchInFlight"` both present.
- [ ] `git show --name-only --format= <EC-851 sha>`: exactly the 3 files.
- [ ] **Live-on-surface (D-24026):** signed in as `jefferyjjensen` on
      `play.legendary-arena.com/?route=me`, Play this loadout on a saved 1-seat
      loadout lands on `?match=<id>&player=0…` with that mastermind and scheme.
      A fast double-click creates exactly one match; Back from the match to `?route=me`
      leaves Play this loadout enabled. Record the match id and deployed SHA in STATUS.
- [ ] Governance (SPEC commit): `docs/ai/STATUS.md`; `docs/ai/DECISIONS.md` lands D-24722 Active.
- [ ] `WORK_INDEX.md`: WP-303 checked with the date. `EC_INDEX.md`: EC-851 Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md`: node `📝` → `✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` 0.
- [ ] `wiki/profile-login.md` (cite WP-303 / D-24722): the Saved loadouts table
      row, the grind-loop "What exists today" + "Reload last try" cells, and the
      "Likely decomposition" step (1) say the profile launch shipped.
