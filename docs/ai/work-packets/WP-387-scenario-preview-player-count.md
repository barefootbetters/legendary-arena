# WP-387 — Scenario Preview Deep-Link: Carry Player Count (Leaderboard → Loadout Builder)

**Status:** Drafted 2026-07-17; **execution-ready + executing 2026-07-17** (EC-416 drafted at execution-prep; folded exec-prep + execution, one worktree/PR)
**Primary Layer:** Client — registry-viewer (`apps/registry-viewer/**`) + legends-board (`apps/legends-board/**`)
**Dependencies:** WP-114 ✅ (URL-parameterized setup preview + `?schemeId&mastermindId` challenge target; **explicitly deferred URL-bound `playerCount` as the "future-extension hook"** — `setupUrlParams.ts:111`, `serializeSetupToUrl` JSDoc), WP-372 ✅ (loadout builder player-count required-counts readout via `getPlayerCountSetup` / `setPlayerCount`), WP-345 ✅ (the gauntlet board's per-leg challenge links + the active player-count tab), D-24165 (PLAYER_COUNT_SETUP)
**EC:** [EC-416](../execution-checklists/EC-416-scenario-preview-player-count.checklist.md) (drafted 2026-07-17 at execution-prep)
**Baseline:** `origin/main` at `3936e2d5` (2026-07-17)
**User-Visible Surface:** cards.legendary-arena.com (the loadout builder pre-sized to the gauntlet entry's player count) via a link from legends.legendary-arena.com

> **Execution addendum (2026-07-17, EC-416 draft).** Reconciliations against
> the shipped WP-114 / WP-345 / WP-372 code, discovered while drafting the EC:
> (1) **The slot sizing is in the EDITOR, not the preview.** `useSetupFromUrl`
> is a **read-only preview** composable that hardcodes
> `playerCount: DEFAULT_PLAYER_COUNT` (`useSetupFromUrl.ts:113`); the villain/
> henchman required-count guidance the player sees when filling slots lives in
> the **editor** (`useLoadoutDraft`, WP-372: `getPlayerCountSetup(draft.playerCount)`
> + the "For an N-player match: …" readout). So the URL player count must reach
> the editor draft (via `setPlayerCount`), not only the preview.
> (2) **`App.vue` owns both surfaces** — it instantiates the shared
> `useLoadoutDraft` (`App.vue:350`) and reads the URL for the preview
> (`:366`), so seeding the editor draft's player count at mount (an explicit
> `setPlayerCount(urlPlayerCount)` right after draft creation) is deterministic
> and independent of the preview→"Edit this loadout"→editor promote path. The
> preview composable is also updated so the preview header agrees.
> (3) **`parseSetupUrl` returns `Partial<SetupCompositionInput>`** (composition
> only); `playerCount` is an **envelope** field, not composition, so it is
> parsed by a **separate** `parsePlayerCountFromUrl(search)` returning
> `number | null` (1..5, else null — never throws), keeping the composition
> parser's type contract intact.
> (4) **The board's challenge link is per-leg but the player count is per-board.**
> The board panel's `activePlayerCount` (WP-385) is the source; the index
> panel's unclaimed-CTA challenge link has no routed count and therefore omits
> `playerCount` (falls back to the builder default — the "absent = unchanged"
> AC). So `buildChallengeUrl` gains an OPTIONAL `playerCount` param.
> (5) **8 files** (4 code + 3 test across two apps + this WP is client-only);
> above WP-114's original 1–2-file estimate because the value target is the
> editor, not the preview. No new dependency, no server/engine/registry change,
> no LAGN involvement, no D-entry (this is the WP-114-named future-extension
> hook, a minor additive URL-key extension of D-114XX).

---

## Goal

A player browsing a gauntlet board on legends.legendary-arena.com clicks
"Challenge this leg" and lands in the cards.legendary-arena.com loadout
builder with the scheme + mastermind pinned (WP-114, already live) **and the
player-count selector pre-set to the gauntlet board they came from**, so the
"For an N-player match: 3 villain groups / 2 henchmen / 5 heroes" required-count
guidance (WP-372) matches that specific count-keyed board. The player fills
villains + heroes and plays. This is Shape A of the "play this scenario from the
leaderboard" flow: extend the existing partial-preview link, **not** switch to
`?lagn=` (a valid LAGN requires ≥1 villain / henchman / hero, so a scenario seed
cannot be a LAGN — the reason the preview link is partial in the first place).

---

## Assumes

- WP-114 is live: `cards.legendary-arena.com/?schemeId=<set>/<slug>&mastermindId=<set>/<slug>`
  renders a setup preview via `useSetupFromUrl` / `parseSetupUrl`, and
  "Edit this loadout" promotes it into the editor draft.
- WP-372 is live: the editor (`useLoadoutDraft`) exposes `setPlayerCount(n)`
  and drives a required-counts readout from `getPlayerCountSetup(playerCount)`
  (the D-24165 `PLAYER_COUNT_SETUP` table).
- WP-345 is live: the gauntlet board panel builds per-leg challenge links via
  `buildChallengeUrl(setAbbr, schemeSlug, mastermindSlug)` and knows the active
  player count (`activePlayerCount`, WP-385).
- Registry viewer: Vue 3 + Vite, zero-auth read-only card browser; tests
  `node:test` under tsx; `vue-tsc --noEmit` typecheck.
- Legends board: Vue 3 + Vite, zero-API; tests `node:test`; `vue-tsc` typecheck.
- `pnpm --filter registry-viewer build` and
  `pnpm --filter @legendary-arena/legends-board build` exit 0 on `main`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/registry-viewer/src/lib/setupUrlParams.ts` — the URL parse/serialize
  boundary; the JSDoc naming `playerCount` as the future-extension hook.
- `apps/registry-viewer/src/composables/useSetupFromUrl.ts` — the read-only
  preview composable (hardcodes `playerCount: DEFAULT_PLAYER_COUNT`).
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — the editor draft
  (`setPlayerCount`, `getPlayerCountSetup`, `DEFAULT_PLAYER_COUNT = 2`).
- `apps/registry-viewer/src/App.vue` — owns the shared draft (`:350`) + the URL
  preview read (`:366`); the seeding site.
- `apps/legends-board/src/panels/gauntletDisplay.ts` — `buildChallengeUrl`.
- `apps/legends-board/src/panels/GauntletBoardPanel.vue` — `activePlayerCount`
  + `challengeLegs`.
- `docs/ai/DECISIONS.md` — D-24165 (PLAYER_COUNT_SETUP counts), D-114XX
  (WP-114 URL-key contract this additively extends).
- `wiki/leaderboard.md` §Gauntlets — the descriptive companion (challenge links).

---

## Scope (In)

- `setupUrlParams.ts`: a new pure `parsePlayerCountFromUrl(search): number | null`
  — reads a `playerCount` query param, returns an integer 1..5 or `null`
  (absent / non-numeric / out-of-range), never throws. (Composition parser
  and its `Partial<SetupCompositionInput>` return are unchanged.)
- `useSetupFromUrl.ts`: use the parsed player count (when present) in the
  preview document's `playerCount` instead of the hardcoded default, so the
  preview header reflects the count.
- `App.vue`: after the shared editor draft is created, seed its player count
  from the URL (`setPlayerCount(urlPlayerCount)`) when present, so the editor's
  required-count slots match the linked gauntlet board regardless of the
  preview→promote path.
- `gauntletDisplay.ts`: `buildChallengeUrl` gains an OPTIONAL trailing
  `playerCount?: number` — when provided, append `&playerCount=<n>`; when
  absent, byte-identical to today (the two-key URL).
- `GauntletBoardPanel.vue`: pass `activePlayerCount` into the per-leg challenge
  URLs so a board's challenge links carry that board's player count.
- Tests for the new parser, the preview count, and the challenge-URL param.

## Out of Scope

- **Switching to `?lagn=`** — the seed is partial; a valid LAGN is complete
  (Shape A's whole premise).
- **Any snapshot / publisher change** — the board already knows the routed
  count; no new snapshot field, no server work.
- **Any save-to-profile / auth change (Shape B)** — the builder stays
  auth-less; save lives on play.legendary-arena.com (deferred, needs a design
  lock).
- **The index panel's unclaimed-CTA challenge link** — no routed count there;
  it omits `playerCount` (default preserved). Not modified beyond the optional
  param being absent.
- **`serializeSetupToUrl`** — the viewer's own share button; extending it to
  emit `playerCount` is a symmetry nicety not needed for this packet (the board
  constructs the URL directly). Left for a future extension.
- **Villain / hero pre-selection** — villains stay the player's strategy space
  (D-24131 §4); only the count is carried.
- **Any arena-client change** — the "start a match" leg is unchanged.

---

## Files Expected to Change

> 8 files — 4 code + 3 test across two apps (registry-viewer + legends-board),
> at the 00.3 §5 soft cap; client-only.

1. `apps/registry-viewer/src/lib/setupUrlParams.ts` — **modified** — add
   `parsePlayerCountFromUrl`.
2. `apps/registry-viewer/src/lib/setupUrlParams.test.ts` — **modified** — parse
   coverage (present valid 1..5; absent → null; non-numeric → null; out-of-range
   → null; the composition parser unaffected).
3. `apps/registry-viewer/src/composables/useSetupFromUrl.ts` — **modified** —
   preview `playerCount` uses the parsed value when present.
4. `apps/registry-viewer/src/composables/useSetupFromUrl.test.ts` — **modified**
   — preview reflects the URL count; absent → `DEFAULT_PLAYER_COUNT`.
5. `apps/registry-viewer/src/App.vue` — **modified** — seed the editor draft's
   player count from the URL at mount.
6. `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified** —
   `buildChallengeUrl` optional `playerCount` param.
7. `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified** —
   URL with / without the count param (pinned strings).
8. `apps/legends-board/src/panels/GauntletBoardPanel.vue` — **modified** — pass
   `activePlayerCount` into the challenge URLs.

Governance files (`STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`,
`05-ROADMAP-MINDMAP.md`) updated at close per the Definition of Done.

---

## Contract

- **Param name + range (locked):** `playerCount`, integer **1..5** (the
  D-24165 supported range). `parsePlayerCountFromUrl` returns `number | null`;
  any absent / non-integer / out-of-range value → `null` (never throws, never
  coerces to a default inside the parser — the default lives in the composables).
- **Absent = unchanged (locked):** a challenge URL without `playerCount`
  produces byte-identical behavior to today — preview `playerCount` =
  `DEFAULT_PLAYER_COUNT`, editor draft unseeded. The `gauntletDisplay`
  `buildChallengeUrl` output for a call without the optional arg is
  byte-identical to the current two-key URL.
- **Editor is the value target (locked):** the slot-sizing guidance (WP-372
  required counts) is driven by the **editor draft** player count; the URL
  count seeds it via `setPlayerCount` at `App.vue` mount. The preview header
  is updated for consistency but is not the functional target.
- **Board source (locked):** the board panel's per-leg challenge URLs carry
  `activePlayerCount`; the index panel's unclaimed-CTA link omits the param.
- **Zero-API / zero-auth invariant:** neither the legends board nor the
  registry viewer gains a server call or auth surface; the board stays a static
  R2 consumer; the builder stays a read-only card browser (no
  `/api/me/loadouts`).
- **URL discipline:** `URLSearchParams` builds the param (`&playerCount=4`);
  set-qualified id encoding (the existing `%2F`) is unchanged.

---

## Non-Negotiable Constraints

**Engine-wide:** ESM only, Node v22+. Human-style code — see
`docs/ai/REFERENCE/00.6-code-style.md` (full English names, `is/has/can`
booleans, JSDoc on every function, ≤30-line functions, `// why:` on non-obvious
decisions, full-sentence error messages). Full file contents for every modified
file — no diffs, no snippets. Tests `.test.ts` with `node:test` +
`node:assert`; no network / DB in tests.

**Packet-specific:**
- **No new npm dependency**; any `package.json` change is a FAIL.
- No server / engine / preplan import; no `pg`; no server API call; no
  cookies/localStorage; no auth.
- No `?lagn=` change, no snapshot change, no publisher change.
- `parsePlayerCountFromUrl` is a **pure** helper (no Vue, no DOM beyond the
  passed search string, no clock, no randomness) and **never throws**.
- The composition parser (`parseSetupUrl`) and `serializeSetupToUrl` are
  byte-unchanged.
- `buildChallengeUrl` without the optional arg is byte-identical to today
  (a pinned drift test asserts it).

**Session protocol:** stop and ask on any unclear item; if the editor-draft
seeding cannot be made deterministic at `App.vue` mount (e.g., the draft is
created after the URL read in a way that reorders), reconcile against the
WP-114/WP-362 mount ordering before proceeding.

**Locked contract values:** the Contract section above; `playerCount` param
name; the 1..5 range; absent → `DEFAULT_PLAYER_COUNT` / unseeded; the
board-panel-only URL source.

---

## Vision Alignment

**Vision clauses touched:** §1/§2 (faithful setup — the required counts match
the rules for the chosen player count); §10a (Registry Viewer public surface);
NG-1 proximity (none crossed).

**Conflict assertion:** No conflict: this WP preserves all touched clauses. It
carries an existing, rules-derived value (the D-24165 player-count counts) from
the gauntlet board into the builder so the guidance is correct; it introduces
no new persuasion, paid, or competitive surface.

**Non-Goal proximity check:** none of NG-1..7 are crossed — a display/guidance
convenience link, no paid or persuasive surface, no gameplay-affecting reward.

**Determinism preservation:** N/A to scoring/replay/RNG — this is a client URL
convenience with no engine, scoring, or replay surface. The pure parser is
deterministic (same string → same result).

## Funding Surface Gate

N/A — a client deep-link convenience; no funding affordances, no donate/support
copy, no payment channels (§20.1 trigger surfaces absent).

## API Catalog (§21)

N/A — client-only; no HTTP endpoint added, modified, removed, or re-statused,
and no `apps/server/src/**` library surface touched.

---

## Acceptance Criteria

1. `parsePlayerCountFromUrl` returns the integer for `?playerCount=1`..`=5`,
   and `null` for absent, `?playerCount=0`, `=6`, `=abc`, `=3.5`, and `=` —
   never throwing.
2. The composition parser `parseSetupUrl` and `serializeSetupToUrl` are
   byte-unchanged (their existing tests pass unmodified).
3. `useSetupFromUrl`'s preview document carries the URL player count when
   present, and `DEFAULT_PLAYER_COUNT` when absent.
4. On mount with a `?playerCount=N` URL, the shared editor draft's player count
   is `N` (so the WP-372 required-count readout matches); with no param, the
   draft keeps `DEFAULT_PLAYER_COUNT`.
5. `buildChallengeUrl('core', 'midtown-bank-robbery', 'dr-doom', 4)` produces
   `…?schemeId=core%2Fmidtown-bank-robbery&mastermindId=core%2Fdr-doom&playerCount=4`;
   the same call without the 4th arg is byte-identical to the current two-key
   URL.
6. The gauntlet board panel's per-leg challenge links carry the board's active
   player count; the index panel's unclaimed CTA link omits `playerCount`.
7. `pnpm --filter registry-viewer build` + `typecheck` + `test` and
   `pnpm --filter @legendary-arena/legends-board build` + `typecheck` + `test`
   all exit 0 / green.
8. Both built bundles remain server-call-free (the legends-board zero-API grep
   passes; the registry viewer gains no `/api/me/*` call).
9. `git diff --name-only` shows only the 8 listed files (plus governance).

---

## Verification Steps

```bash
# 1. Registry viewer (expect all exit 0)
pnpm --filter registry-viewer build
pnpm --filter registry-viewer typecheck
pnpm --filter registry-viewer test

# 2. Legends board (expect all exit 0)
pnpm --filter @legendary-arena/legends-board build
pnpm --filter @legendary-arena/legends-board typecheck
pnpm --filter @legendary-arena/legends-board test

# 3. Zero-API bundle check on the board (expect: no matches)
#    PowerShell: Select-String -Path apps/legends-board/dist/assets/*.js -Pattern "onrender|api\.legendary-arena"

# 4. Scope check (expect: exactly the 8 listed files + governance)
git diff --name-only

# 5. Local visual pass (vite dev, registry viewer):
pnpm --filter registry-viewer dev
#    - open ?schemeId=core/legacy-virus-the&mastermindId=core/red-skull&playerCount=4
#    - the builder's required-count readout shows the 4-player counts
#    - the same URL without &playerCount shows the 2-player default
```

---

## Definition of Done

- [ ] All Acceptance Criteria pass (1–9 above).
- [ ] **Live-on-surface verification (D-24026):** on deployed
      cards.legendary-arena.com, a `?schemeId&mastermindId&playerCount=N` link
      opens the builder with the N-player required counts, and the same link
      without `playerCount` shows the default — observed, not inferred from
      green tests. (Operator-pending on the CF Pages deploy acceptable at
      merge; record it.)
- [ ] `docs/ai/STATUS.md` updated with the user-visible change.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — this packet checked off.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-416 → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-387 node + `pnpm roadmap:counts:write`.
- [ ] No files outside `## Files Expected to Change` (plus governance) modified.
