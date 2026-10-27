# WP-303 — Play a Saved Loadout from the Profile

**Status:** Draft 2026-10-14
**Primary Layer:** `apps/arena-client` (one pure helper + its test + one planned profile-page edit)
**Dependencies:** WP-302 / EC-333 / D-24087 (Saved Loadouts section, opaque `lagn`), WP-301 / D-24086 (`GET /api/me/loadouts` returns each row's `lagn`), WP-448 / EC-483 / D-24268 (`launchMatchFromComposition`), WP-449 / D-24269 (the profile-page "Play this leg" launch precedent), D-24018 (`convertLagnUpload`, the INFRA fix that taught the lobby LAGN; WP-244 is the LAGN spec), WP-092 / WP-254 (`parseLoadoutJson`), WP-687 / D-24658 (Final Blow on the loadout path), WP-305 / D-24089 (`displayName` / `handleCanonical` on the owner view)
**User-Visible Surface:** `play.legendary-arena.com` (`?route=me`, signed in)

> Baseline: `origin/main` at commit `3072ec685` (INFRA: ewiki Profile Login — saved loadouts as a per-mastermind grind loop, #2807).
> Numbers: WP-303 is the grandfathered placeholder named in WP-302's row (below the WP ledger high-water, so it needs no ledger line). EC-851 and D-24722 were reserved first in #2811.

---

## Session Context

WP-302 shipped the profile "Saved Loadouts" library: paste a LAGN, then list,
rename, make public, delete, or share. It deferred the hand-off into play to a
WP-303 placeholder (D-24087). WP-448 then extracted the create-and-join chain
into `launchMatchFromComposition` and D-24268 narrowed WP-303 to a call site:
wire a saved composition into that primitive, don't build a new chain. The
ewiki *Profile Login* §"Saved loadouts as a working surface — the mastermind
grind loop" (#2807) makes this step 1 of four: load last try's lineup, play it
again, many times a session. Grouping by mastermind, the won/lost join, and the
public showcase are later WPs.

---

## Goal

Each row in the Saved Loadouts section of `?route=me` gets a **Play this
loadout** button. One click creates a match from that loadout's stored LAGN,
seats the player in seat 0, and opens the play surface. That's the
mastermind grind loop's fast path: reload a lineup in one click instead of
re-pasting it into the lobby. No server, engine, or lobby change.

---

## User-Visible Impact

A signed-in player can start a match straight from any saved loadout on their
profile. A loadout that can't be read, or a launch that fails, shows a
full-sentence error under the list. Nothing changes for signed-out visitors:
`?route=me` already sends them to sign-in.

---

## Assumes

- WP-301 on `main`: `GET /api/me/loadouts` returns `{ loadouts:
  SavedLoadoutView[] }`, and each row carries the stored LAGN as `lagn`. Every
  write runs the server's LAGN validator (D-24086), so stored `lagn` is a LAGN
  document. The client mirror types it `unknown`
  (`apps/arena-client/src/lib/api/loadoutLibraryApi.ts`, `SavedLoadoutView`).
- WP-302 on `main`: `MyProfilePage.vue` renders `loadoutRows` (from
  `listLoadouts`) as `<li data-testid="my-profile-loadout-row-<id>">` rows with
  rename, visibility, delete, and share controls (around line 1480).
- WP-448 on `main`:
  `apps/arena-client/src/lobby/useCreateMatchFromComposition.ts` exports
  `launchMatchFromComposition({ config, playerCount, playerName, authToken })`.
  It never throws. It runs create → persist setup → join seat `'0'` → navigate
  and returns `{ ok: true, matchID } | { ok: false, message }`. `config` is a
  `MatchConfiguration` (the 9 composition fields plus optional `finalBlow`).
- WP-449 on `main`: `MyProfilePage.vue` already imports and calls
  `launchMatchFromComposition` in `playLeg` (around line 816), with
  `playerName = view.value?.displayName ?? view.value?.handleCanonical ?? ''`
  and a signed-out guard on `readAuthToken()`.
- D-24018 on `main` (#314): `apps/arena-client/src/lobby/lagnLoadout.ts` exports
  `convertLagnUpload(input: string)`. It returns `not_lagn`, `error` with a
  full-sentence `message`, or `ok` with `documentJson` (a MATCH-SETUP document
  using `player_count` as `playerCount`) and `finalBlow` (true only for a
  literal `setup.final_blow === true`). It ignores `setup.hero_alternates`.
- WP-092 / WP-254 on `main`: `apps/arena-client/src/lobby/parseLoadoutJson.ts`
  exports `parseLoadoutJson(input)`, returning `{ ok: true, value:
  ParsedLoadout }` (`composition`, `playerCount` 1..5, `heroSelectionMode`) or
  `{ ok: false, error: { code, message } }`, and rejects unqualified ext_ids.
- The chain was scaffolded at draft (2026-10-14, `tsx` against `src/` on the
  baseline): a 1.6.0 LAGN with `hero_alternates` and `final_blow: true`
  converted to `ok` with `finalBlow: true`, and `parseLoadoutJson` returned
  the 9-field composition with `playerCount: 1` and the alternate absent from
  `heroDeckIds`. `null` and `{ "a": 1 }` both returned `not_lagn`.
- `pnpm -r build` exits 0, and on the baseline
  `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 and `test`
  passes.

If any of these is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` D-24087 (opaque `lagn`, WP-303 deferral), D-24268
  (the primitive and the WP-303 narrowing), D-24269 (the profile launch
  precedent), D-24658 (Final Blow on the loadout path).
- `wiki/profile-login.md` §"Saved loadouts as a working surface — the
  mastermind grind loop" — the design direction; this packet is its "Reload
  last try in one click" row.
- `apps/arena-client/src/lobby/LobbyView.vue` — `applyParseResult` and
  `submitFromJson` (around lines 892 and 989). That's the existing
  LAGN → composition → launch path. This packet reuses the same two readers
  and the same launch call, with the same Final Blow omit-when-off spread.
- `apps/arena-client/src/pages/MyProfilePage.vue` — the Saved Loadouts state
  block (around line 378), `loadLoadouts` (around line 641), `playLeg` (around
  line 816), and the Saved Loadouts template (around line 1415).

**How the composition and player count are obtained (no server read, no
validator import).** The list response already carries each row's `lagn`, so
no new read is needed. The client doesn't import `@legendary-arena/lagn`.
Instead the new helper does what the lobby does with a pasted LAGN:
`JSON.stringify(lagn)` → `convertLagnUpload` → `parseLoadoutJson`. Those are
the lobby's existing hand-rolled shape readers (D-24018 / WP-092), and both
are already in arena-client. The server stays the LAGN validation authority
and `Game.setup()` stays the ext_id authority. D-24722 records this as a
narrow refinement of D-24087's opaque posture.

**Why a helper, not inline code.** `MyProfilePage.vue` has no test harness.
Putting the read in a pure `lib/savedLoadoutLaunch.ts` makes it unit-testable
and keeps the page edit small. `LobbyView.vue` keeps its own
`applyParseResult` (it also drives the upload preview), so this is the second
consumer of the reader pair, not a third copy to abstract.

**Direct launch, not "Load into lobby".** The button starts the match. It
doesn't hand the loadout to the lobby for a preview. One click is the grind
loop's point, and a lobby hand-off would need cross-page state that nothing
carries today. See Out of Scope.

**Lane.** Standard two-session lane. The change is single-app and three files,
but it adds a match-creating action, not narrow validation or UX copy
(D-24028 eligibility #6). Ambiguity resolves against the lightweight lane.

`MyProfilePage.vue` is a **planned, in-allowlist edit**. 01.5 is **not
invoked**.

---

## Non-Negotiable Constraints

**Always apply:**
- Output the full file contents for every new or modified file: no diffs, no
  snippets. ESM only, Node v22+; tests use `node:test` / `node:assert` in
  `.test.ts` files. No new npm dependency.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`. Every function
  has JSDoc. No nested ternaries, no `.reduce()` with branching, full English
  names.
- `MyProfilePage.vue` keeps its `defineComponent({ setup() { return {...} } })`
  shape (D-6512).
- Full-sentence user-facing error copy (00.6 Rule 11). Never show a raw error
  code.

**Packet-specific:**
- **No server, engine, registry, or lobby change.** `lagnLoadout.ts`,
  `parseLoadoutJson.ts`, `useCreateMatchFromComposition.ts`, and
  `LobbyView.vue` are consumed unchanged.
- **No LAGN validator import.** No `@legendary-arena/lagn`,
  `@legendary-arena/registry`, `@legendary-arena/game-engine/setup`, or
  `apps/server` import anywhere in the new or modified files. The only engine
  import is a type-only `MatchConfiguration` in the new helper (the page needs no new engine import) (D-24722).
- **No new create-and-join chain.** The launch is exactly one
  `launchMatchFromComposition` call (D-24268). No direct `createMatch` /
  `joinMatch` call in the new code.
- **No new server read.** Launch from the `lagn` already in `loadoutRows`.
- **Loadouts stay decorative** (§19b / §19a, D-24086 / D-24087). Launching
  writes nothing to the loadout: no PATCH, no "last played" stamp, no score
  link.
- **The helper never throws** for any `lagn` value a JSON response can carry,
  `null` and missing included.

**Locked values:**
- Helper module: `apps/arena-client/src/lib/savedLoadoutLaunch.ts`, exporting
  `planSavedLoadoutLaunch(lagn: unknown): SavedLoadoutLaunchPlan` and
  `type SavedLoadoutLaunchPlan = { ok: true; config: MatchConfiguration;
  playerCount: number } | { ok: false; message: string }`.
- Read order: `JSON.stringify(lagn)` → `convertLagnUpload` → on `ok`,
  `parseLoadoutJson(documentJson)`. If `JSON.stringify` returns a non-string
  (`undefined` input), return the not-LAGN copy directly, with a `// why:`,
  rather than relying on the reader's parse catch.
- `config` = `parsed.composition`, plus `finalBlow: true` only when the
  conversion's `finalBlow` is true (omit-when-off, the D-24658
  `submitFromJson` spread). `playerCount` = `parsed.playerCount`.
- Unreadable-loadout prefix: `"This saved loadout can't be played. "`, then
  the reader's message verbatim (for a `convertLagnUpload` `error` or a
  `parseLoadoutJson` failure).
- Not-LAGN copy (for `not_lagn`, including `null` / missing `lagn`): "This
  saved loadout can't be played. It is not a LAGN document; delete it and save
  it again from the loadout builder."
- Button: label **Play this loadout**, `data-testid="my-profile-loadout-play-<id>"`,
  inside the row's `.profile-loadout-controls`, as its **first child — before the
  visibility label `<span>`**. Disabled
  while any saved-loadout launch is in flight.
- Error line: one `<p class="profile-upload-error"
  data-testid="my-profile-loadout-play-error">` under the loadout list, shown
  only while `loadoutPlayError !== ''`.
- Signed-out copy: "You are not signed in. Sign in to play a saved loadout."
- Seat name: `view.value?.displayName ?? view.value?.handleCanonical ?? ''`
  (the `playLeg` precedent), trimmed. If it is empty (the owner profile failed
  to load), show "Your profile hasn't finished loading, so your seat has no
  name yet. Reload the page and try again." and **do not launch**. Without
  this guard the primitive creates the match and then boardgame.io refuses the
  nameless join with a 403, which orphans the match.
- Row-named failures: an unreadable-loadout message and a launch failure are
  shown as `` `${row.view.name} — ${message}` ``, so the single error line
  says which of up to 50 rows failed. The signed-out and empty-name copy are
  not row-named.
- Launch failure: the primitive's `message`, verbatim after the row-name
  prefix.
- In-flight lifecycle: `loadoutLaunchInFlight` is set just before the launch
  call, cleared only on `ok: false`, and on success left set until the page
  navigates (the primitive sets `window.location.search` and returns before
  unload, so clearing it would re-enable the button for a second match).
  If the browser later restores the page from its back/forward cache (the
  grind loop's "finish, press Back to `?route=me`"), a `pageshow` listener
  with `event.persisted === true` resets it to `false`. Otherwise every Play
  button would stay disabled until a reload.
- Help copy: append one sentence to the section's existing help paragraph:
  "Press Play this loadout to start a match with that lineup."
- Test floor: `savedLoadoutLaunch.test.ts` has at least 10 tests.

**Session protocol:** STOP and ask, never guess, if any of these happens:
- an Assumes item is false;
- a file outside `## Files Expected to Change` would need to change;
- a locked value is unclear.

---

## Scope (In)

### A) `apps/arena-client/src/lib/savedLoadoutLaunch.ts` (**new**)
- `SavedLoadoutLaunchPlan` and `planSavedLoadoutLaunch(lagn: unknown)`, per
  the locked values.
- Imports only `convertLagnUpload` (`../lobby/lagnLoadout`),
  `parseLoadoutJson` (`../lobby/parseLoadoutJson`), and `type
  MatchConfiguration` (`@legendary-arena/game-engine`, type-only).
- A file-level comment cites WP-303, D-24087, D-24268, and D-24722, and says
  why the lobby readers are reused instead of a validator import.

### B) `apps/arena-client/src/lib/savedLoadoutLaunch.test.ts` (**new** — at least 10 tests)
Plain `node:test`, no DOM, no fetch, in one `describe('planSavedLoadoutLaunch')`
block. Fixtures are LAGN objects (not strings), the shape `GET /api/me/loadouts`
delivers, with every ext_id set-qualified unless a case says otherwise (the
qualified-id check runs before the player-count check). `vue-tsc` type-checks
test files, so each case narrows the plan union (`if (plan.ok !== true)` guard
or `assert.ok`) before reading `config` / `message`:
- A valid 1-seat LAGN → `ok: true`. `config` deep-equals the 9-field
  composition, and `playerCount` is 1.
- `setup.final_blow: true` → `config.finalBlow === true`.
- No `final_blow` → `'finalBlow' in config` is false.
- `final_blow: "yes"` (not a literal `true`) → `'finalBlow' in config` is
  false.
- `setup.hero_alternates` present → none of its ids appear in
  `config.heroDeckIds`.
- `player_count: 3` → `playerCount` is 3.
- LAGN missing `setup.mastermind` → `ok: false`, and the message starts with
  the locked prefix and contains `setup.mastermind`.
- An unqualified hero id (`spider-man`) → `ok: false`, and the message starts
  with the locked prefix and contains `set-qualified`.
- `player_count: 9` → `ok: false`, and the message starts with the locked
  prefix and contains `1..5`.
- A non-LAGN object (`{ a: 1 }`) → the locked not-LAGN copy.
- `null` and `undefined` → the locked not-LAGN copy, with no throw.

### C) `apps/arena-client/src/pages/MyProfilePage.vue` (**modified — planned in-allowlist edit**)
- Import `planSavedLoadoutLaunch` from `../lib/savedLoadoutLaunch`.
- Add two refs to the Saved Loadouts state block: `loadoutPlayError`
  (string, `''`) and `loadoutLaunchInFlight` (boolean, `false`), with the
  block's `// why:` extended to cover them.
- Add `playSavedLoadout(row: LoadoutRow): Promise<void>` with JSDoc. In order:
  1. Return if a launch is in flight.
  2. Clear `loadoutPlayError`.
  3. If `readAuthToken()` is null, set the signed-out copy and return.
  4. Resolve the trimmed seat name. If it is empty, set the empty-name copy
     and return.
  5. Run `planSavedLoadoutLaunch(row.view.lagn)`. On `ok: false`, set the
     row-named message and return.
  6. Set in-flight, then call `launchMatchFromComposition({ config,
     playerCount, playerName, authToken })`. On `ok: false`, set the
     row-named message and clear in-flight. On success, leave in-flight set.
  It never throws. Two `// why:` comments: one on the launch call citing
  D-24268 (one primitive, no new chain), and one on the success path saying
  why in-flight stays set until navigation.
- Add `resetLaunchOnPageRestore(event: PageTransitionEvent): void` with JSDoc.
  It sets `loadoutLaunchInFlight` to `false` when `event.persisted` is true,
  with a `// why:` about the back/forward-cache restore. Register it with
  `window.addEventListener('pageshow', resetLaunchOnPageRestore)` inside the
  existing `onMounted`. Remove it in a new `onBeforeUnmount`, adding
  `onBeforeUnmount` to the existing `vue` import.
- Return `playSavedLoadout`, `loadoutPlayError`, and `loadoutLaunchInFlight`
  from `setup()`.
- Template: add the button and the error line per the locked values. Append
  the help sentence. Update the section's `<!-- why: -->` comment: it now
  says the lobby hand-off is deferred to WP-303. Make it cite WP-303 /
  D-24722 as the shipped play action, with "Load into lobby" still out.
- Nothing else on the page changes.

---

## Out of Scope

- **"Load into lobby"** — handing a saved loadout to the lobby's upload
  preview instead of launching. It needs cross-page state; the grind loop
  wants one click. A future WP may add it.
- **"Save this loadout" from the lobby or the end-game screen.** The create
  path stays paste-LAGN (D-24087).
- **Swapping a hero on the profile before launching.** Swapping stays in the
  cards-site builder (the WP-404 alternates bench). The ewiki grind loop lists
  it as a later step.
- **Grouping the library by mastermind / scheme, the won/lost join to
  `competitive_scores`, and the public "masterminds beaten" showcase.** These
  are ewiki grind-loop steps 2–4, each its own WP. The grouping read belongs
  on the server.
- **Bot-ally or autoplay launch from a loadout.** A multi-seat loadout opens
  an N-seat match with the player in seat 0, exactly as the lobby's loadout
  path does today.
- **Player-count requirement warnings** (the lobby's WP-371 preview
  warnings). A mismatched loadout fails at create with the primitive's
  message.
- **Rewording `convertLagnUpload` / `parseLoadoutJson` copy** ("The uploaded
  LAGN file…"). Those modules are locked lobby contracts. See Limitations.
- **Refactoring `LobbyView.vue`'s `applyParseResult` onto the new helper.**
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `apps/arena-client/src/lib/savedLoadoutLaunch.ts` — **new** — `planSavedLoadoutLaunch` (stored LAGN → launch config + seat count)
- `apps/arena-client/src/lib/savedLoadoutLaunch.test.ts` — **new** — helper tests (≥ 10)
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — Play this loadout button, `playSavedLoadout`, `pageshow` reset, error line, help sentence, updated `why` comment (planned in-allowlist edit; 01.5 not invoked)

- Governance, in the separate `SPEC:` govern-close commit:
  - `docs/ai/STATUS.md`
  - `docs/ai/DECISIONS.md` (D-24722)
  - `docs/ai/work-packets/WORK_INDEX.md`
  - `docs/ai/execution-checklists/EC_INDEX.md`
  - `docs/05-ROADMAP-MINDMAP.md`
  - `wiki/profile-login.md`

No other **code** files may be modified. The `EC-851:` implementation commit
touches exactly these 3.

---

## Contract

Client-side only. Consumes `GET /api/me/loadouts` (WP-301) and
`launchMatchFromComposition` (WP-448) unchanged. New client-internal exports:
`planSavedLoadoutLaunch` and `SavedLoadoutLaunchPlan`
(`lib/savedLoadoutLaunch.ts`). No contract file (`.types.ts` /
`.validate.ts` / `.gating.ts`) is created.

---

## Limitations

- **Reader copy is lobby-worded.** A malformed loadout shows, for example,
  "This saved loadout can't be played. The uploaded LAGN file is missing…".
  "Uploaded" is the lobby's wording, and rewording would touch locked lobby
  modules and their tests. Server validation on every write makes this path
  rare.
- **Loadouts saved before the qualified-ext_id fix fail to launch** with the
  WP-254 "re-export it" message. That's the same as pasting them into the
  lobby. The fix is to re-save from the builder.
- **A multi-seat loadout opens a match that waits for more players.** A
  loadout saved with `player_count: 3` creates a 3-seat match with only the
  player in seat 0. Play stalls at seat 1's turn until someone joins through
  an invite or a guest seat, as with the lobby's loadout path. The lobby shows
  the seat count before Create; the profile row doesn't. A seat-count hint on
  the row is a follow-on.
- **No player-count preview.** A loadout whose hero count doesn't fit its
  seat count fails at create, with the primitive's message carrying the
  engine's reason.
- **The profile edit has no component test.** `MyProfilePage.vue` has no
  test file. The read logic is unit-tested in the helper; the wiring is
  covered by the presence grep and the live check. Adding a page-level
  harness would exceed the packet (the WP-813 precedent).

---

## Vision Alignment

Touches the account-local saved-content surface (Vision §19b) and its
decorative-not-merit lock (§19a), plus §3 *Player Trust & Fairness*. The
launch creates an ordinary match through the same create/join contract as the
lobby. A saved loadout gets no new standing: launching writes nothing onto it
and never makes it a competitive submission. Any score comes from the match
itself, exactly as for a lobby-launched match. No scoring, PAR, leaderboard,
RNG, replay, card-data, or monetization surface. No engine, `G`, `ctx`, or
hash surface.

**Vision clauses touched:** §3, §19a, §19b.

**No conflict:** this WP preserves all touched clauses.

**Non-Goal proximity:** no monetization surface, so NG-1..7 are not engaged.
No social signal is added (NG-8 not engaged).

## Funding Surface Gate

N/A — no funding affordance, channel, or donate/support copy.

## API Catalog

N/A. No endpoint is added or changed. The packet reads `GET /api/me/loadouts`
and reaches `POST /api/match/create` / join only through existing client
helpers, all already `Wired`. A new client consumer is not a catalog column
(D-11801).

---

## Acceptance Criteria

All binary pass/fail.

- [ ] Each Saved Loadouts row renders a **Play this loadout** button
  (`my-profile-loadout-play-<id>`) as the first child of
  `.profile-loadout-controls`, before the visibility label.
- [ ] `planSavedLoadoutLaunch` returns the 9-field composition and the LAGN's
  `player_count` for a valid stored LAGN, with `finalBlow: true` only for a
  literal `setup.final_blow === true`, and never includes `hero_alternates`
  ids.
- [ ] A malformed, non-LAGN, `null`, or missing `lagn` returns `ok: false`
  with the locked copy, and the helper never throws.
ACs 4–6 have no page-level test (no `MyProfilePage.vue` harness). They are
checked by reading `playSavedLoadout` against the locked step order, by the
wiring grep in Verification Steps, and by the live check.

- [ ] Clicking the button with a readable loadout calls
  `launchMatchFromComposition` exactly once, with the helper's `config` and
  `playerCount`, the `displayName` → `handleCanonical` seat name, and the
  bearer token.
- [ ] A signed-out click, an empty seat name (no launch call), an unreadable
  loadout, and a failed launch each show their locked full-sentence message
  (the last two row-named) in `my-profile-loadout-play-error`, and
  no raw code is shown.
- [ ] The button is disabled while a launch is in flight. In-flight is
  cleared only on a failed launch; after a successful launch it stays set
  until the page navigates.
- [ ] `savedLoadoutLaunch.test.ts` has at least 10 tests, all green.
- [ ] The absence greps (import lines and code-call lines only — comments may
  name these modules) find no import of `@legendary-arena/lagn`,
  `@legendary-arena/registry`, `@legendary-arena/game-engine/setup`, or
  `apps/server`, and no `createMatch(` / `joinMatch(` call, in the two new
  files or in the added lines of the `MyProfilePage.vue` diff.
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/arena-client typecheck` 0;
  the arena-client suite is green.
- [ ] The `EC-851:` implementation commit (`git show --name-only <sha>`) is
  exactly the 3 files in §Files Expected to Change.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: all exit 0; savedLoadoutLaunch tests pass (>= 10)

Select-String -Path "apps\arena-client\src\pages\MyProfilePage.vue" -Pattern "planSavedLoadoutLaunch|playSavedLoadout|my-profile-loadout-play"
# Expected: the import, the function, its return, the button, and the error line

Select-String -Path "apps\arena-client\src\pages\MyProfilePage.vue" -Pattern '@click="playSavedLoadout\(row\)"',':disabled="loadoutLaunchInFlight"'
# Expected: both match on the Play this loadout button (wiring, not just presence)

# Absence greps match import lines and code-call lines only, never comments
# (01.4 binary-grep rule): the required comments may name these modules.
$importPattern = '^\s*(import\b.*|\}\s*)from\s+[''"](@legendary-arena/(lagn|registry)|@legendary-arena/game-engine/setup|[^''"]*apps/server)'
$callPattern = '^\s*[^/*\s].*\b(createMatch|joinMatch)\('
Select-String -Path "apps\arena-client\src\lib\savedLoadoutLaunch.ts","apps\arena-client\src\lib\savedLoadoutLaunch.test.ts" -Pattern $importPattern,$callPattern
# Expected: no matches (layer boundary; one primitive)

git diff <baseline>..<EC-851 sha> -- apps/arena-client/src/pages/MyProfilePage.vue | Select-String -Pattern '^\+[^+]' | ForEach-Object { $_.Line.Substring(1) } | Select-String -Pattern $importPattern,$callPattern
# Expected: no matches (added lines only)

git show --name-only --format= <EC-851 sha>
# Expected: exactly the 3 files above
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
  D-24026).** On the deployed client, signed in as the operator account
  (`jefferyjjensen`):
  - `?route=me` shows **Play this loadout** on each saved loadout row. If none
    exist, paste a 1-seat LAGN and save it first.
  - Clicking it lands on `?match=<id>&player=0&credentials=…`, and the board
    shows that loadout's mastermind and scheme.
  - A fast double-click creates exactly one match: the lobby match list
    shows one new match, not two.
  - From that match, press Back to `?route=me`. **Play this loadout** is
    enabled again, with no reload.
  - Record the match id and the deployed SHA in STATUS.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/arena-client typecheck` 0; suites green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md`: land D-24722 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md`: WP-303 checked off with the date.
  `docs/ai/execution-checklists/EC_INDEX.md`: EC-851 Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md`: node `📝` → `✅`, then `pnpm roadmap:counts:write`;
  `pnpm roadmap:counts:check` exits 0.
- [ ] `wiki/profile-login.md`, citing WP-303 / D-24722:
  - The "Saved loadouts" feature-table row says Play this loadout shipped
    (WP-303). The lobby hand-off is no longer described as deferred.
  - In the grind-loop section, "What exists today" and the "Reload last try
    in one click" gap cell say the profile launch is shipped.
  - The "Likely decomposition" step (1) ("the overdue WP-303") says it
    shipped as WP-303.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all 21 sections, plus the EC against `EC-TEMPLATE.md`) as an
**independent subagent** (2026-10-14).

**Round 1: PASS**, with three optional fixes, two applied:
- `$importPattern` now also catches the `} from '…'` line of a multi-line
  import (checked in `pwsh`);
- EC Files to Produce gains the governance mindmap line.
- The third, the EC heading "Required Comments", is kept as is, matching
  passed EC-850.

**Rounds 2 and 3 (deltas after the copilot fixes): PASS.** §2, §12, §13,
§14, §15, §18, and the EC template were re-checked.

- §1 Structure — PASS. All required sections present; Out of Scope has 9
  bullets; 10 ACs.
- §2 Constraints — PASS. Full-file output, ESM, Node v22+, 00.6, the
  packet-specific rules, locked values, and the session protocol.
- §3 Assumes — PASS. Every line was verified in code (`loadoutLibraryApi.ts:44`,
  `useCreateMatchFromComposition.ts:35/59`, `lagnLoadout.ts:184/222`,
  `MyProfilePage.vue:163/454/816/1019`).
- §4 Context — PASS. Anchors accurate (1415 / 1479 / 1517).
- §5 Files — PASS. 3 code files plus 6 governance files by path; 01.5 not
  invoked.
- §6 Naming — PASS. The 9-field composition and `heroDeckIds` match 00.2;
  testids and classes are consistent with the page.
- §7 Deps — PASS. No new npm dependency (stated).
- §8 Boundaries — PASS. Type-only `MatchConfiguration` from the engine `.`
  surface; no validator, registry, setup, or server import.
- §9 Windows — PASS. pwsh `Select-String` with `\` paths.
- §10 Env — N/A. No env var.
- §11 Auth — PASS. Existing bearer via `readAuthToken()`, a signed-out
  guard, and `## Limitations` present.
- §12 Tests — PASS. `node:test`, no DOM; 11 listed cases against a floor of
  10; the substrings and the check order match the readers.
- §13 Verification — PASS. Exact commands with expected output; the
  `typecheck` script exists.
- §14 Acceptance — PASS. 10 binary items. ACs 4–6 are labelled code-read
  plus wiring grep plus live check.
- §15 / §15.1 — PASS. Surface header, User-Visible Impact, and a D-24026
  live step (including double-click and Back-restore).
- §16 Code style — PASS.
- §17 Vision — PASS. §3, §19a, §19b; no conflict; NG proximity stated.
- §18 Prose-vs-grep — PASS. The absence greps match import and call lines
  only, so comments can't trip them.
- §19 Bridge-vs-HEAD — N/A. Commit-time rule.
- §20 Funding — N/A, reason given.
- §21 API catalog — N/A. `GET /api/me/loadouts` and `POST /api/match/create`
  are already `Wired`; a new client consumer is not a §21.1 trigger
  (D-11801 column set).

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-10-14, independent subagent; two passes).**

- **Pass 1: NOT READY.** Two PS-items, both fixed in place:
  - PS-1: the absence greps scanned whole files, so the required comments
    (which naturally name `@legendary-arena/lagn` and `createMatch`) would
    trip them. They now match import lines and code-call lines only
    (`$importPattern` / `$callPattern`), and the diff grep reads added lines
    only. The patterns were checked in `pwsh` against a sample: they match an
    import and a call, and skip `//` and ` *` comment lines.
  - PS-2: "first in `.profile-loadout-controls`" was ambiguous, because the
    group's first child is the visibility `<span>`. It now says first child,
    before the visibility label.
  - RS-items applied:
    - the helper (not the page) carries the type-only `MatchConfiguration`;
    - `convertLagnUpload` is credited to D-24018 (#314), not WP-244;
    - the wiki "Likely decomposition" step (1) was added to the DoD;
    - tests sit in one `describe`, use qualified ids, and narrow the union
      for `vue-tsc`;
    - WP-092 was added to the WORK_INDEX deps;
    - an explicit non-string `JSON.stringify` guard was added.
  - RS-5 (quote D-24722 verbatim in the session prompt) is carried into the
    prompt.
- **Pass 2: READY TO EXECUTE.** It confirmed the fixes and found nothing new.
  It noted one thing: don't put a literal `createMatch(` in a test name.
- **Passes 3 and 4 (after the copilot deltas): READY TO EXECUTE.** These
  passes covered the empty-name guard, the in-flight lifecycle, row-named
  errors, the wiring grep, and the `pageshow` reset. Scope and the 3-file
  allowlist are unchanged.
  - Step order is consistent between the WP and the EC.
  - `onBeforeUnmount` is the only import change.
  - The DOM lib types the `pageshow` handler as `PageTransitionEvent`.
  - The primitive's full-page navigation makes the Back-restore live check
    meaningful.
  - Noted, not blocking: a whitespace-only `displayName` takes the
    empty-name copy rather than falling back to `handleCanonical`. That's
    acceptable as written.
- **Dependencies verified against code:**
  - `SavedLoadoutView.lagn` (`loadoutLibraryApi.ts:44`).
  - The primitive (`useCreateMatchFromComposition.ts:59-94`).
  - `playLeg` (`MyProfilePage.vue:816`), `readAuthToken` (:454), and the
    `setup()` return (:1019).
  - The locked message substrings: `lagnLoadout.ts:149`, and
    `parseLoadoutJson.ts:70` / `:466`.
  - `MatchConfiguration` on the engine `.` surface (`index.ts:7`).
  - WP-092/244/254/301/302/305/448/449/687 all `[x]`.
  - Nothing outside the allowlist is forced to change: `App.test.ts` only
    stubs `MyProfilePage`.
- **Baseline:** observed by the drafting session on this branch (`3072ec685`
  plus the reserve #2811 and draft docs): `pnpm -r build` 0, arena-client
  `typecheck` 0, arena-client `test` 2351 / 2351 pass, and no generated
  artifact churn after the build.

---

## Copilot Check (01.7)

**Verdict: PASS (2026-10-14, independent subagent; three rounds).**

**Round 1: RISK / HOLD.** Nothing architectural:
- D-24722 is an honest, minimal refinement. D-24087 already allowed
  defensive `setup` reads.
- Direct launch is the right call for the grind loop.
- The §19a lock is preserved, and the greps are comment-safe.

Findings applied in place:
1. **Empty seat name** (#22). If the owner profile failed to load, the seat
   name is `''`. The primitive creates the match and boardgame.io refuses the
   nameless join with a 403, orphaning the match. Added the empty-name guard
   and its locked copy as step 4, before any launch.
2. **In-flight cleared on success** (#22 / #18). The primitive returns
   before the page unloads, so a second click could create a second match.
   In-flight is now cleared only on `ok: false`.
3. **No page wiring test** (#11). Added a wiring grep
   (`@click="playSavedLoadout(row)"` and `:disabled="loadoutLaunchInFlight"`),
   labelled ACs 4–6 as code-read plus grep plus live check, and added a live
   double-click check.
4. **Multi-seat loadouts stall at seat 1** (#26). Added a Limitations
   bullet. A seat-count hint on the row is a follow-on.
5. **Precedent creep** (#29). D-24722 now says it licenses no client-side
   LAGN interpretation beyond launch.
6. **Error doesn't name the row** (#26). Failures are now row-named.
7. The lint record is filled.

**Round 2 (delta): PASS, with one low risk.** Leaving in-flight set on
success would strand every Play button after a back/forward-cache restore,
the grind loop's "press Back" step. Fixed with the `pageshow`
(`event.persisted`) reset and a live Back-restore check.

**Round 3: PASS.**

**Accepted for v1:**
- the reader copy is lobby-worded;
- multi-seat loadouts open a waiting match;
- there is no page-level component test.

See `## Limitations`.

**Follow-up spotted:** `playLeg` (the gauntlet launch, `MyProfilePage.vue`
around line 854) has the same empty-seat-name bug. It is proposed as its own
small fix, outside this packet.

---

## Reserved Decisions (land at execution)

- **D-24722 (reserved 2026-10-14 in #2811; not yet landed).** "Play this
  loadout" on a profile Saved Loadouts row launches a match directly through
  `launchMatchFromComposition` (D-24268), with no lobby hand-off. The row's
  opaque `lagn` reaches the launch through the lobby's existing hand-rolled
  reader pair (`convertLagnUpload` → `parseLoadoutJson`). This narrowly
  refines D-24087 for the launch path only:
  - arena-client still imports no LAGN validator and sends `lagn` verbatim
    on writes;
  - the server stays the LAGN validation authority, and `Game.setup()` the
    ext_id authority;
  - no new server read is added.

  The seat name is the owner view's `displayName`, falling back to
  `handleCanonical` (the D-24269 precedent). This refinement licenses no client-side LAGN
  interpretation beyond launch: grouping by mastermind, the won/lost join,
  and the showcase stay server-side reads (the ewiki grind-loop posture).
  Launching writes nothing to the
  loadout (§19a decorative lock unchanged).

---

## See Also

- [WP-302](WP-302-profile-loadout-library-client.md) / D-24087 — the Saved Loadouts section
- [WP-448](WP-448-composition-to-match-launch-primitive.md) / D-24268 — the launch primitive
- [WP-449](WP-449-profile-gauntlet-tracker-ui.md) / D-24269 — the profile launch precedent
- ewiki [Profile Login](../../../wiki/profile-login.md) §the mastermind grind loop — the design direction
