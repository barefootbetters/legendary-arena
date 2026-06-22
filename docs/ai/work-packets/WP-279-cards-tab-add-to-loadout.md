# WP-279 — Cards Tab "Add to Loadout" (Shared Draft + Detail Button + Loadout Tray)

**Status:** Draft — ready to execute (drafted 2026-06-22)
**Primary Layer:** Registry Viewer (`apps/registry-viewer`)
**User-Visible Surface:** `cards.legendary-arena.com` (Registry Viewer — Cards tab + a new floating Loadout tray)
**Dependencies:** WP-091 (Loadout Builder + `useLoadoutDraft`) ✅ Done 2026-04-24; WP-114 (URL-preview composable instantiation precedent) ✅; WP-278 (current Cards filter surface) ✅. All landed.
**Baseline:** `origin/main` @ `3f2f4153` (2026-06-22).

---

## Session Context

The registry viewer is the tool players use to build a MATCH-SETUP / LAGN file
and share it so others can play the same game (per `apps/registry-viewer/CLAUDE.md`
+ the Loadout tab shipped in WP-091). Today the Cards tab and the Loadout tab are
**two disjoint surfaces**:

- The **Cards tab** is the rich discovery surface — Set · Class · Type · Mechanics ·
  Effects · Patterns filters (WP-278). Clicking a card opens `CardDetail.vue`, whose
  only emit is `close` ([CardDetail.vue:23](../../../apps/registry-viewer/src/components/CardDetail.vue)).
  Nothing connects a browsed card to a loadout.
- The **Loadout tab's** picker re-lists the registry filtered by the active slot but
  offers **only a name search** ([LoadoutBuilder.vue:689](../../../apps/registry-viewer/src/components/LoadoutBuilder.vue)) —
  none of the Cards-tab filters. So a player who finds "all Tech heroes" in the Cards
  tab must re-find each one by name in the impoverished picker.

The structural blocker is that `useLoadoutDraft` is instantiated **inside**
`LoadoutBuilder.vue` ([line 54](../../../apps/registry-viewer/src/components/LoadoutBuilder.vue)),
so the draft is private to that component and the Cards surface (App.vue level) has no
handle to it. This WP lifts the draft to `App.vue` (shared state) and adds an
"add to loadout" affordance to the Cards surface plus a persistent tray for feedback.

The data already supports this with no contract change: a hero card's `FlatCard.extId`
**is** the set-qualified group ext_id the loadout stores (`core/wolverine`, shared
across all of that hero's member cards — [types-index.ts:49](../../../apps/registry-viewer/src/registry/types/types-index.ts)),
and `addHeroGroup` / `addVillainGroup` / `addHenchmanGroup` already dedup. So
"add from Cards" is the existing `addHeroGroup(card.extId)` etc. — no new id-space,
no engine work, no `MatchSetupConfig` change.

---

## Goal

From the Cards tab, a player can add the card they're viewing to their loadout with one
click: `CardDetail.vue` gains a contextual button — hero → add the hero group, scheme /
mastermind → set that slot, villain / henchman → add the group — that toggles to a
"✓ in loadout — remove" state. A small persistent **Loadout tray** pill (visible from any
tab) shows the current pick counts and jumps to the Loadout tab. To make one shared draft
reachable from both surfaces, `useLoadoutDraft` is lifted from `LoadoutBuilder.vue` up to
`App.vue` and passed down. Filtering, validation, export, and the Loadout tab's own picker
are all unchanged. `pnpm --filter registry-viewer typecheck`, `test`, and `build` exit 0.

---

## User-Visible Impact

On `cards.legendary-arena.com`: (1) the card detail panel shows an Add/Remove-to-loadout
button for the five composition card types; (2) a floating "🧰 Loadout" tray appears once a
draft has at least one pick, showing counts and a "Go to loadout →" jump, on the Cards and
Themes tabs. No change for bystander / wound / other cards, and no change to the Loadout
tab's existing builder, picker, validation, or export controls.

## Vision Alignment

Affirmatively on-vision per **Vision §10a** (the registry viewer is a public tool that
helps players inspect cards and build/share game setups). Lowering the friction of turning
card discovery into a shareable MATCH-SETUP/LAGN file directly serves adoption and the
"build a game and share it with others" flow this app exists for. **Non-Goal proximity:**
none — no monetization, identity, competitive/PvP, scoring, RNG, or determinism surface is
touched; "loadout"/"setup" framing is hero-vs-villain authoring (no player-interaction
terminology per §23(b)). Determinism line: N/A (no scoring/replay/RNG).

---

## Locked Design Decisions (operator, 2026-06-22)

1. **MVP scope = shared-draft lift + the `CardDetail` button + the tray.** Bulk
   "add all filtered heroes" and a reverse "view in Cards" cross-link from loadout chips
   are explicitly a **fast-follow** (out of scope here; named in §Out of Scope).
2. **The draft is lifted, not made a singleton.** `useLoadoutDraft` stays a
   per-invocation composable (its own contract — "no module-level state, no singletons");
   `App.vue` instantiates exactly one instance and shares it. No singleton/global store.
3. **The add affordance lives in `CardDetail.vue`** (one card at a time — unambiguous
   which entity), not on every grid tile. A tile-hover "+" is a possible later add, not now.
4. **The button is a toggle** keyed by the card's `cardType`: single slots (scheme,
   mastermind) set/clear; group slots (hero, villain, henchman) add/remove. Bystander /
   wound / other show no button.

---

## Contract

### A. Lift the draft to `App.vue` (shared instance)

- `App.vue` instantiates `useLoadoutDraft(reg)` **once, inside `onMounted` after the
  registry resolves** — mirroring the existing `useSetupFromUrl(reg)` instantiation
  ([App.vue:307](../../../apps/registry-viewer/src/App.vue)) — and holds the returned
  `UseLoadoutDraftApi` in a ref (`loadoutDraftApi`). `useLoadoutDraft`'s validation
  computed calls `validateMatchSetupDocument(draft, registry)`, so the instance must not
  be created while `registry.value` is `null`; post-load instantiation is the locked
  approach (same reason `useSetupFromUrl` defers).
  - **Instantiation precondition (HARD, binary):** `registry.value` MUST be non-null at the
    `useLoadoutDraft(reg)` call site. This is enforced **structurally by placement** — the
    call lives **only** inside the post-resolve `onMounted` block (the `useSetupFromUrl`
    precedent), never at `setup()` top level. No runtime `throw` guard is added: a pre-load
    instantiation is a construction-time error prevented by where the call lives, not a
    defensive runtime check — consistent with how `useSetupFromUrl` defers rather than
    guards, and avoiding a terse non-sentence error string the code-style rule forbids.
- `LoadoutBuilder.vue` **receives the draft API as a prop** instead of calling
  `useLoadoutDraft` itself. Its `useLoadoutLagnExport(draftApi.draft)` and every existing
  control bind to the passed instance unchanged. The Loadout tab renders only when
  `registry` (and thus `loadoutDraftApi`) is present — already gated by the existing
  `v-if="activeView === 'loadout' && registry"`.

### B. `CardDetail.vue` add/remove button

- New prop `inLoadout: boolean` — whether this card's slot currently holds this card's
  `extId` (computed by `App.vue` from the shared draft for the selected card).
- New emit `toggle-loadout` (no payload — `App.vue` owns `selectedCard`).
- The button renders **only** when `card.cardType` ∈ `{ hero, scheme, mastermind, villain,
  henchman }`. Label is contextual and reflects `inLoadout`:
  - hero: `➕ Add {groupName} to loadout` ⇄ `✓ {groupName} in loadout — remove`
  - scheme: `➕ Set as Scheme` ⇄ `✓ Scheme — clear`
  - mastermind: `➕ Set as Mastermind` ⇄ `✓ Mastermind — clear`
  - villain / henchman: `➕ Add group to loadout` ⇄ `✓ In loadout — remove`
- `App.vue` handles `toggle-loadout` by routing on `selectedCard.cardType` to the existing
  draft methods via the pure helper in §C. No new draft mutation logic is added to the
  composable.

### C. Pure helper `loadoutCardActions.ts` (new) — the testable invariant

A small boardgame.io-free helper module so the cardType→draft-method mapping is unit-tested
without a Vue component harness:

- `resolveLoadoutSlot(cardType: string): 'scheme' | 'mastermind' | 'villain' | 'henchman' | 'hero' | null`
  — the five composition types map to their slot; everything else → `null`.
- `isCardInLoadout(composition, card): boolean` — true when the card's `extId` occupies its
  slot (scheme/mastermind by equality; the three group slots by array membership).
- `toggleCardInLoadout(api: UseLoadoutDraftApi, card): void` — adds when absent, removes /
  clears when present, using only the **existing** `UseLoadoutDraftApi` methods
  (`setScheme`/`setMastermind` with `""` to clear; `addHeroGroup`/`removeHeroGroup`;
  `addVillainGroup`/`removeVillainGroup`; `addHenchmanGroup`/`removeHenchmanGroup`).
  A villain group the selected mastermind Always Leads is locked (`missingRequiredVillainGroupIds`
  / the chip-lock already enforce this in the builder); `toggleCardInLoadout` MUST NOT remove
  a required villain group — removal is a no-op when `requiredVillainGroupIds` includes it.
  The guard lives **inside the helper** (`toggleCardInLoadout`), never only in the component,
  so a future caller cannot bypass it; it is unit-tested (AC-6).

**Helper truth table (authoritative — the executor implements exactly this):**

| `card.cardType` | slot (`composition` field) | add / set | remove / clear | collision semantics |
|---|---|---|---|---|
| `scheme`        | `schemeId`        | `setScheme(extId)`        | `setScheme("")`              | overwrite (single)  |
| `mastermind`    | `mastermindId`    | `setMastermind(extId)`    | `setMastermind("")`          | overwrite (single)  |
| `hero`          | `heroDeckIds`     | `addHeroGroup(extId)`     | `removeHeroGroup(extId)`     | deduped set         |
| `villain`       | `villainGroupIds` | `addVillainGroup(extId)`  | `removeVillainGroup(extId)` — **no-op if `requiredVillainGroupIds` includes `extId`** | deduped set |
| `henchman`      | `henchmanGroupIds`| `addHenchmanGroup(extId)` | `removeHenchmanGroup(extId)` | deduped set         |
| anything else   | — (`resolveLoadoutSlot` → `null`) | no-op | no-op | no button rendered |

Every add/remove row routes through the **existing** `UseLoadoutDraftApi` only;
`toggleCardInLoadout` never writes `draft.composition.*` or any reactive array directly.

### D. `LoadoutTray.vue` (new) — floating pill

- Props: a read-only summary `{ schemeSet: boolean; mastermindSet: boolean; heroes: number;
  villains: number; henchmen: number; issues: number }` (derived by `App.vue` from the draft
  composition + `errors.length`). Emit: `open` (App.vue sets `activeView = 'loadout'`).
- Renders a fixed-position pill (bottom-**left**, to avoid the bottom-right glossary FAB).
  Shows `🧰 Loadout` + a compact summary (e.g. `4 heroes · 1 scheme · ⚠ 2 issues`, or
  `ready` when `isValid`). Hidden when the draft has zero composition picks, and hidden while
  `activeView === 'loadout'` (redundant there). Never throws.

**Tray visibility (deterministic — both conditions binary):**

- SHOW ⟺ (total composition picks `> 0`) AND (`activeView !== 'loadout'`).
- HIDE ⟺ (total composition picks `=== 0`) OR (`activeView === 'loadout'`).
- POSITION: fixed bottom-**left** — MUST NOT overlap the bottom-right glossary FAB.

---

## Out of Scope

- **Bulk "Add all N filtered heroes" from the Cards filter bar** — the highest-value
  fast-follow, deliberately deferred to keep this MVP small.
- **Reverse "View in Cards" cross-link** from a loadout chip — fast-follow.
- A tile-hover "+" quick-add on `CardGrid.vue` tiles — not now (button lives in detail).
- Any change to `useLoadoutDraft`'s draft mutation logic, validation, theme prefill, JSON
  import/export, LAGN export, or the Always-Leads requirement logic (consumed as-is).
- Any change to the Loadout tab's existing picker, `LoadoutPreview.vue`, the URL-preview /
  "Edit this loadout" round-trip (`useSetupFromUrl`), or the Cards-tab filters (WP-278).
- Any engine / registry-package / server / `data/cards` / feed / contract-file
  (`.types.ts` / `.validate.ts` / `.gating.ts`) change; no `MatchSetupConfig` change; no new
  HTTP endpoint; no persistence/determinism surface.

---

## Files Expected to Change

- `apps/registry-viewer/src/App.vue` — **modified** — instantiate `useLoadoutDraft(reg)` post-load; pass the API to `LoadoutBuilder` + compute `inLoadout` for `CardDetail` + handle `toggle-loadout`; render `LoadoutTray` + handle its `open`.
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — accept the draft API as a prop instead of calling `useLoadoutDraft`.
- `apps/registry-viewer/src/components/CardDetail.vue` — **modified** — add the contextual add/remove button (`inLoadout` prop + `toggle-loadout` emit) for the five composition types.
- `apps/registry-viewer/src/components/LoadoutTray.vue` — **new** — floating Loadout tray pill (counts + jump-to-loadout).
- `apps/registry-viewer/src/lib/loadoutCardActions.ts` — **new** — pure helper: `resolveLoadoutSlot` / `isCardInLoadout` / `toggleCardInLoadout` (no boardgame.io).
- `apps/registry-viewer/src/lib/loadoutCardActions.test.ts` — **new** — `node:test` coverage for the three helpers (add / remove / clear / Always-Leads-locked / non-composition → null).
- `docs/ai/DECISIONS.md` — **modified** (D-24054).
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/ai/STATUS.md` — **modified** (governance close).

**~10 files (4 code modified/new + 1 new helper + 1 new test viewer; 4 governance).**

---

## Assumes

- WP-091 shipped `useLoadoutDraft` with the `UseLoadoutDraftApi` surface this WP consumes verbatim: `draft`, `errors`, `isValid`, `requiredVillainGroupIds`, `missingRequiredVillainGroupIds`, `setScheme`, `setMastermind`, `addVillainGroup`/`removeVillainGroup`, `addHenchmanGroup`/`removeHenchmanGroup`, `addHeroGroup`/`removeHeroGroup` (verified at `apps/registry-viewer/src/composables/useLoadoutDraft.ts`).
- `FlatCard.extId` is the set-qualified group ext_id for the five composition types and `card.groupName` is the entity display name (verified at `apps/registry-viewer/src/registry/types/types-index.ts`; D-24018 / D-10014).
- `App.vue` already instantiates a registry-dependent composable (`useSetupFromUrl(reg)`) inside `onMounted` after the R2 fetch resolves — the precedent this WP follows for the draft lift.
- `LoadoutBuilder.vue` and `CardDetail.vue` exist at the paths above and are rendered by `App.vue` (`LoadoutBuilder` at the Loadout tab; `CardDetail` in the shared body when `selectedCard` is set).

## Context (Read First)

- `apps/registry-viewer/CLAUDE.md` — viewer architecture, data flow, layer boundary.
- `.claude/rules/architecture.md` §Layer Boundary — `apps/registry-viewer` may import `registry` + UI framework; MUST NOT import `game-engine` / `preplan` / `server` / `pg`.
- `.claude/rules/code-style.md` + `docs/ai/REFERENCE/00.6-code-style.md` — human-style code; `// why:` discipline; no `.reduce()` for branching; full-word names.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 — canonical composition field names (`schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`) the helper reads — spelled exactly, never renamed.
- `docs/01-VISION.md` §10a — registry viewer public surface (Vision Alignment above).
- `docs/ai/DECISIONS.md` — D-24018 (`FlatCard.extId` id-space), D-9301 (`heroSelectionMode` envelope), D-24028 (lightweight-lane eligibility — why this WP is NOT in it).

---

## Non-Negotiable Constraints

- **Layer / package:** `apps/registry-viewer` only. No engine / registry-package / server / `apps/*` cross-imports. `CardDetail.vue`, `LoadoutTray.vue`, and `loadoutCardActions.ts` MUST NOT import `@legendary-arena/game-engine`, `apps/server`, `apps/dashboard`, `boardgame.io`, or repo-root `scripts/` (grep gate).
- **No contract change:** no edit to `useLoadoutDraft`'s draft mutation/validation logic, `setupContract`, or any `.types.ts`/`.validate.ts`/`.gating.ts`; no `MatchSetupConfig` field change. The new code calls only the **existing** `UseLoadoutDraftApi` methods.
- **Single shared instance:** exactly one `useLoadoutDraft` instance per page, owned by `App.vue`; `LoadoutBuilder` consumes it. No second instantiation, no module-level/global store. Binary check: `grep -c "useLoadoutDraft(" App.vue` ≥ 1 and the same grep on `LoadoutBuilder.vue` === 0.
- **Mutation discipline:** `toggleCardInLoadout` and the components mutate the shared draft **only** through `UseLoadoutDraftApi` methods — never by writing `draft.composition.*`, `draft.*`, or any reactive array/prop directly.
- **Canonical field names** (`schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `extId`) spelled exactly per `00.2 §8.1` — never abbreviated or renamed.
- **Always-Leads safety:** `toggleCardInLoadout` MUST NOT remove a villain group in `requiredVillainGroupIds` (mirrors the chip-lock the builder already enforces).
- **Non-fatal / pure:** the tray and the helper never throw; the tray hides on an empty draft and on the Loadout tab. No game logic in components; no direct R2 fetch (data flows from the already-loaded registry).
- ESM only; Vue 3 `<script setup>`; `// why:` on the post-load draft instantiation, the Always-Leads no-op guard, and any non-obvious slot routing.

---

## Acceptance Criteria

1. `App.vue` instantiates exactly one `useLoadoutDraft` instance (post-registry-load) and passes it to `LoadoutBuilder`; `LoadoutBuilder` no longer calls `useLoadoutDraft` itself (**AC-1**).
2. `CardDetail.vue` shows an add/remove-to-loadout button for `hero`/`scheme`/`mastermind`/`villain`/`henchman` cards and **no** button for `bystander`/`wound`/`other` (**AC-2**).
3. Clicking the button on a hero adds that hero group (`addHeroGroup(card.extId)`) to the shared draft; the Loadout tab's `heroDeckIds` reflects it; the button flips to the "✓ … — remove" state (**AC-3**).
4. Scheme / mastermind buttons set the single slot (and clear it on re-click); villain / henchman buttons add/remove the group; a required (Always-Leads) villain group is not removable via the button (**AC-4**).
5. The `LoadoutTray` pill appears once the draft has ≥1 pick, shows correct counts + an issues/ready indicator, jumps to the Loadout tab on click, and is hidden on a blank draft and while on the Loadout tab (**AC-5**).
6. `loadoutCardActions.ts` helpers (`resolveLoadoutSlot`, `isCardInLoadout`, `toggleCardInLoadout`) are unit-tested: add, remove, single-slot clear, Always-Leads-locked no-op, and non-composition → `null`/no-op (**AC-6**).
7. The Loadout tab's existing builder, picker, validation, theme prefill, JSON/LAGN export, and the URL-preview flow behave identically to before (no regression) (**AC-7**).
8. No forbidden import (`game-engine`/`server`/`dashboard`/`boardgame.io`/`scripts/`) in the touched files; helper is boardgame.io-free (grep) (**AC-8**).
9. `pnpm --filter registry-viewer typecheck` 0; `test` 0 (prior count preserved + the new helper tests); `build` 0 (no `__vite-browser-external`) (**AC-9**).

---

## Verification Steps

```bash
# 1. Single shared instance: App.vue instantiates the draft; LoadoutBuilder does not
grep -c "useLoadoutDraft(" apps/registry-viewer/src/App.vue                       # >= 1
grep -c "useLoadoutDraft(" apps/registry-viewer/src/components/LoadoutBuilder.vue # 0 (receives it as a prop)

# 2. New files present
test -f apps/registry-viewer/src/components/LoadoutTray.vue && echo OK
test -f apps/registry-viewer/src/lib/loadoutCardActions.ts && echo OK
test -f apps/registry-viewer/src/lib/loadoutCardActions.test.ts && echo OK

# 3. CardDetail emits the toggle + takes inLoadout
grep -F "toggle-loadout" apps/registry-viewer/src/components/CardDetail.vue && echo OK
grep -F "inLoadout"      apps/registry-viewer/src/components/CardDetail.vue && echo OK

# 4. No forbidden import / no game logic / no boardgame.io in the new+touched files
grep -RInE "(@legendary-arena/game-engine|apps/server|apps/dashboard|boardgame\.io|(^|/|\.\./)scripts/)" \
  apps/registry-viewer/src/components/CardDetail.vue \
  apps/registry-viewer/src/components/LoadoutTray.vue \
  apps/registry-viewer/src/lib/loadoutCardActions.ts && echo "FAIL: forbidden import" || echo OK

# 5. typecheck / test / build
pnpm --filter registry-viewer typecheck && pnpm --filter registry-viewer test && pnpm --filter registry-viewer build
```

Live (preview against the live R2 feed): open a hero card → "➕ Add … to loadout" → switch
to the Loadout tab and confirm the hero group is in `heroDeckIds`; return to Cards, re-open
the same hero → button reads "✓ … — remove" → click to remove. Repeat for a scheme
(set/clear), a villain group (add/remove), and confirm the tray pill shows counts + jumps to
the Loadout tab. Confirm a bystander card shows no button and the Loadout tab's existing
download/upload/LAGN controls are unchanged.

---

## Definition of Done (Binary Gate)

- [ ] Draft lifted to `App.vue` (one instance, post-load); `LoadoutBuilder` consumes it via prop
- [ ] `CardDetail` add/remove button for the five composition types (none for the rest); `LoadoutTray` shipped
- [ ] `loadoutCardActions.ts` + tests cover add / remove / single-slot clear / Always-Leads-locked / non-composition
- [ ] No forbidden import; helper boardgame.io-free; no game logic in components
- [ ] `typecheck` + `test` + `build` exit 0 (prior test count preserved + new helper tests)
- [ ] No regression to the Loadout tab builder / picker / validation / export / URL-preview
- [ ] D-24054 lands; WORK_INDEX + EC_INDEX + STATUS updated
- [ ] Commit prefix `EC-310:` for code, `SPEC:` for governance
- [ ] **D-24026 live-verify** post-deploy on `cards.legendary-arena.com` (add-from-Cards reflected in the Loadout tab; tray works)

---

## Decision — D-24054

Establishes that the registry-viewer's loadout draft is owned by `App.vue` as a single
shared `useLoadoutDraft` instance (lifted from `LoadoutBuilder.vue`, not made a singleton),
so the Cards surface can add the viewed card to the loadout, and adds a persistent Loadout
tray. Pure registry-viewer UX; consumes the existing `UseLoadoutDraftApi` and `FlatCard.extId`
id-space (D-24018) with no draft-logic, contract, or card-data change. Bulk filter-add and
the reverse Cards cross-link are named fast-follows, out of scope.

---

## Lint Gate Self-Review (00.3 — all 21 sections resolved)

- §1 WP Structure — PASS: all required sections present; Out of Scope lists ≥2 excluded items.
- §2 Non-Negotiable Constraints — PASS: block present; references `00.6`; forbids cross-layer imports + contract edits; no body contradiction.
- §3 Prerequisites (`## Assumes`) — PASS: WP-091 API surface, `FlatCard.extId`, and the `useSetupFromUrl` precedent listed with sources.
- §4 Context References — PASS: cites viewer CLAUDE.md, architecture layer rule, `00.6`, `00.2 §8.1`, Vision §10a, DECISIONS.
- §5 Output Completeness — PASS: ~10 files, each marked new/modified with a one-line role; ≤~8 code/test.
- §6 Naming Consistency — PASS: canonical `schemeId`/`mastermindId`/`villainGroupIds`/`henchmanGroupIds`/`heroDeckIds`/`extId` per `00.2 §8.1`; descriptive full-word names.
- §7 Dependency Discipline — PASS: no new npm dependency; built-in/existing imports only.
- §8 Architectural Boundaries — PASS (Frontend): new components carry no game logic, no direct R2 fetch (registry-sourced), no `boardgame.io`; grep-gated forbidden imports. Backend/Game-Logic/Scripts sub-lists N/A.
- §9 Windows Compatibility — N/A: no shell scripts authored; verification uses `pnpm` + POSIX grep only.
- §10 Environment Variable Hygiene — N/A: no new env vars introduced.
- §11 Authentication Clarity — N/A: no authentication touched.
- §12 Test Quality — PASS: new `node:test` coverage for `loadoutCardActions.ts`; no boardgame.io import, no network/DB. (Engine-specific `makeMockCtx`/golden-deck items N/A.)
- §13 Commands & Verification — PASS: `## Verification Steps` uses exact `pnpm` commands; `pnpm check`/`pnpm validate` (conn/R2) N/A.
- §14 Acceptance Criteria Quality — PASS: 9 binary, observable items naming real files/methods.
- §15 Definition of Done — PASS: binary checkboxes incl. governance + commit-prefix.
- §15.1 User-Visible Verification (D-24026) — PASS: `User-Visible Surface` declared (`cards.legendary-arena.com`); `## User-Visible Impact` present; DoD includes a live-on-surface verify item.
- §16 Code Style — PASS: small pure helpers + JSDoc; explicit `if/else`/`for...of` (no branching `.reduce()`); `is*` booleans; `// why:` on the post-load instantiation + Always-Leads no-op; no barrels.
- §17 Vision Alignment — PASS: `## Vision Alignment` block present, cites §10a affirmatively + NG-proximity none; determinism line N/A (no scoring/replay/RNG).
- §18 Prose-vs-Grep — N/A: verification greps target component/import tokens, not a count-bounded literal echoed in adjacent prose.
- §19 Bridge-vs-HEAD — N/A: WP authors no repo-state-snapshot artifact; not a pre-execution lint rule.
- §20 Funding Surface Gate — N/A: loadout-authoring UX; introduces no donate/support copy, no funding channel, and no WP-097 §A/§B/§C funding affordance.
- §21 API Catalog Update — N/A: no HTTP endpoints touched, no `apps/server/src/**` library functions added or modified.

## Lint / Pre-Flight / Copilot

**Re-run (2026-06-22, post-hardening SPEC):** the WP + EC were hardened after the initial
draft — an authoritative helper truth table (§C), deterministic tray-visibility conditions
(§D), a binary instantiation precondition (§A, placement-enforced — explicitly **no** runtime
`throw`), an in-helper Always-Leads-guard clause, and a mutation-discipline constraint; the EC
gained a required test matrix, a file→responsibility map, and a baseline-count lock. All edits
are **strictly additive clarity** — no new scope, files, contract surface, locked values, or
forbidden patterns — so per the `01.0a §Step 5` re-run rule all three gates re-run **identical**:
Lint PASS / Pre-flight READY / Copilot PASS. Detail below unchanged.

**Lint (00.3): PASS** — all 21 sections resolved above; the two hard triggers (§15.1
D-24026 + §17 Vision) are satisfied with real blocks, not N/A dodges; §20/§21 N/A carry
non-tautological reasons.

**Pre-flight (01.4): READY TO EXECUTE** — Class = Runtime Wiring (single layer, app UI:
additive components + one rewire lifting `useLoadoutDraft` to `App.vue`). Dependencies
complete (WP-091 ✅; the consumed `UseLoadoutDraftApi` methods, `FlatCard.extId`, and the
`useSetupFromUrl` post-load instantiation precedent all verified against source). **Not a
validation-tightening WP** — it adds no parser/guard/schema that newly-rejects
previously-accepted input, so `01.4 §Empirical Scaffold` does **not** apply. No new contract,
no determinism/persistence/sentinel surface. RS-1 (locked): the draft must be instantiated
**after** registry load (validation computed dereferences `registry`) — mitigated by the
onMounted-instantiation lock (the `useSetupFromUrl` precedent). RS-2 (locked): if the new
tray/`CardDetail` edits are exercised by a future `vue-sfc-loader` component test, the
`defineComponent({ setup })` authoring form is required — but this WP's tests target the
pure `loadoutCardActions.ts` helper (no `.vue` under test), so it does not arise here.

**Copilot (01.7): PASS** — scanned all 30 modes. Addressed: **#1 Engine/UI boundary** (grep
gate + no engine import — the loadout is pure client draft state); **#3/#17 mutation /
aliasing** (children call named `UseLoadoutDraftApi` methods only — never mutate the shared
reactive arrays/props directly; `toggleCardInLoadout` routes through the existing add/remove
methods); **#12 scope creep** (explicit allowlist + `git diff --name-only` close check; bulk-add
and reverse-link explicitly deferred); **#11 invariant tests** (the cardType→slot mapping +
add/remove/clear/Always-Leads-locked are unit-tested via the pure helper, not just "button
works"). Determinism/persistence/engine-contract modes are N/A for a client-only viewer
feature.

## Vision / Funding / API

**Vision:** on-vision per §10a (see `## Vision Alignment`). **Funding:** N/A — no funding
affordance. **API:** N/A — no HTTP endpoint or `apps/server` library function touched.
