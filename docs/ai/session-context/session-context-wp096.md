# Session Context — WP-096 (Registry Viewer: Grid Data View Mode)

> **Authored:** 2026-04-25 as a step-0 bridge for the EC-096 execution
> session. **Purpose:** surface the conversation-level context that
> produced WP-096 + EC-096 + the pre-flight + the copilot check + the
> session prompt, so the executor does not re-derive design decisions
> from git log alone.
>
> **This file is not authoritative.** If conflict arises, the priority
> chain in §8 wins.
>
> **No execution is performed by reading this file.** The two production
> files (`CardGrid.vue` modification + new `CardDataTile.vue`) and the
> four governance edits belong to the EC-096 execution session itself,
> per `docs/ai/invocations/session-wp096-registry-viewer-grid-data-view.md`.

---

## 1. State on `main` (as of authoring)

`main` HEAD: **`26e4584`** (`SPEC: session-context-wp091 — fill gap per
invocation artifact policy`).

Recent landed history relevant to WP-096:

- WP-066 — Registry Viewer: Card Image-to-Data Toggle — Done 2026-04-22 at `8c5f28f` (sidebar-only). Established `useCardViewMode` composable, `ViewModeToggle.vue`, `CardDataDisplay.vue`, and the `localStorage.cardViewMode` key. Post-mortem at `docs/ai/post-mortems/01.6-WP-066-registry-viewer-data-toggle.md` confirms `CardGrid.vue` exclusion was deliberate per EC-066 §Guardrails ("CardGrid.vue NOT modified — do NOT touch unless necessary").
- WP-094 — Viewer Hero FlatCard Key Uniqueness — Reviewed; Executed 2026-04-24 at `eac678c`. Pattern reference for single-component registry-viewer fixes; no contract dependency on WP-096.
- WP-091 / WP-092 / WP-093 — all Done 2026-04-24. Arena-client side; no surface overlap with WP-096.
- WP-090 — `⬜ Ready` (not executed). Arena-client lobby wiring; irrelevant to WP-096 scope.

### Uncommitted artifacts in the working tree at authoring time

WP-096 was drafted, lint-conformed (`PACKET-TEMPLATE.md` + `EC-TEMPLATE.md`),
pre-flighted (01.4), copilot-checked (01.7), PS-resolved, and prompt-generated
in a single drafting session. **None of the WP-096 governance bundle is
committed yet at `26e4584`.** The executor will encounter the following
untracked / modified files at session start (verify their presence with
`git status` before proceeding):

- `docs/ai/work-packets/WP-096-registry-viewer-grid-data-view.md` (untracked)
- `docs/ai/execution-checklists/EC-096-registry-viewer-grid-data-view.checklist.md` (untracked, 54 non-empty content lines, ≤ 60 cap)
- `docs/ai/invocations/preflight-wp096-registry-viewer-grid-data-view.md` (untracked)
- `docs/ai/invocations/copilot-check-wp096.md` (untracked)
- `docs/ai/invocations/session-wp096-registry-viewer-grid-data-view.md` (untracked)
- `docs/ai/work-packets/WORK_INDEX.md` (modified: §FIX 4 backlog tracker line at L1771 for the deferred `02-CODE-CATEGORIES.md` classification of `apps/registry-viewer/`)
- `docs/ai/session-context/session-context-wp096.md` (this file, untracked)

The drafting session also produced and left uncommitted other unrelated
artifacts (per the initial `git status` snapshot for that session) — those
are out of scope for WP-096 and should not be staged into either Commit A
or Commit B.

**Pre-execution staging plan:** the user's standard pattern is to land the
governance bundle (WP + EC + pre-flight + copilot check + session prompt
+ session-context + WORK_INDEX backlog line) as one or more SPEC commits
on `main` **before** cutting the WP-096 execution branch. The session
prompt's §4 Branch Strategy assumes the executor cuts a fresh branch from
a `main` that already contains those artifacts. If the executor finds the
artifacts only as untracked files at session start, **STOP and escalate**
— the governance bundle should be committed to `main` first, otherwise
the branch loses the audit trail.

---

## 2. Workflow Position (per `01.4 §Work Packet Execution Workflow`)

Steps completed for WP-096 (in the drafting session):

| Step | Gate | Status |
|---|---|---|
| 0 | Session context | **This file.** |
| 1 | Pre-flight (`01.4`) | DONE 2026-04-25 — READY TO EXECUTE post-PS-1..PS-3 + FIX 4 resolution. Report at `docs/ai/invocations/preflight-wp096-registry-viewer-grid-data-view.md`. |
| 1b | Copilot check (`01.7`) | DONE 2026-04-25 — CONFIRM (Re-run, post-resolution). 30 of 30 issues PASS. Report at `docs/ai/invocations/copilot-check-wp096.md`. |
| 2 | Session prompt | DONE 2026-04-25. Saved at `docs/ai/invocations/session-wp096-registry-viewer-grid-data-view.md` (484 lines, 18 sections, declares 01.5 NOT INVOKED with the four-criteria table). |
| 3 | Execution | **Next.** Run in a new Claude Code session against the session prompt. |
| 4 | Post-mortem | OPTIONAL (per WP-030 / WP-066 / WP-094 precedent for single-feature client-UI WPs). |
| 5 | Pre-commit review | Pending — separate session. |
| 6 | Commit (Commit A code, Commit B governance) | Pending. |
| 7 | Lessons learned | Pending — likely no template updates needed (this is a corrective follow-up, not a novel pattern). |
| 8 | Session context for next WP | Pending — author after step 7 if a clear next WP exists in the chain. |

The executor opens a new Claude Code session, reads the session prompt
+ WP-096 + EC-096 + the four `.claude/` rule files + `apps/registry-viewer/CLAUDE.md`,
runs the baseline (§3 below), then proceeds to Commit A.

---

## 3. Test & Build Baseline (LOCKED)

Captured against `main` at `26e4584`:

| Surface | Expected on baseline | Notes |
|---|---|---|
| `pnpm --filter registry-viewer typecheck` | exits 0 | `vue-tsc` silent on success |
| `pnpm --filter registry-viewer lint` | 0 errors (warnings acceptable) | WP-066 baseline at completion was 184 warnings; WP-094 baseline expected unchanged. Record the actual count in execution summary; warnings are not gating. |
| `pnpm --filter registry-viewer build` | exits 0 | Vite production build |
| Repo-wide `pnpm -r test` | `696 / 130 / 0` | Per WP-092 pre-flight close-out at HEAD `61316a6`; WP-094 (commit `eac678c`) landed without changing the count; WP-096 must not change it either (no engine touch, no test added). |
| Registry-viewer test harness | **None — by design** | `apps/registry-viewer/` has no Vue component-test harness at baseline. Verification is `typecheck` + `lint` + `build` + manual smoke. Adding a harness is a separate WP. |

The executor must record the actual `lint` warning count in the
execution summary. If `typecheck` or `lint` shows any **error** (not
warning), STOP — do not edit against an unknown baseline.

Engine-side / arena-client-side builds (`pnpm -r build`, `pnpm -r test`)
are **out of scope** for WP-096. Running them is optional but neither
required nor part of the success criteria.

---

## 4. PS Resolution Log (what changed from initial draft → post-resolution)

The pre-flight and copilot check together surfaced four scope-neutral
findings. All four were resolved in the drafting session via direct
edits to WP-096, EC-096, and WORK_INDEX.md. The session prompt's
§7 Locked Values reflects the post-resolution state.

### PS-1 — Display-label drift (Option A, per user direction)

- **Original:** WP-096 §Locked Values said `setAbbr → label "Set"` AND claimed labels were "byte-identical" to `CardDataDisplay.vue`. The two locks contradicted: the sidebar at `CardDataDisplay.vue:78` actually uses `Edition` rendering `setName` with `setAbbr` parenthesized.
- **Resolution (Option A):** Keep `Set` / `setAbbr` for tile compactness. Soften the byte-identity claim to "six of seven labelled rows are byte-identical" — `Type`, `Class`, `Cost`, `Attack`, `Recruit`, `Rarity`. The `Set` row is the deliberate tile-compaction divergence, captured under D-9601 at execution close.
- **Reason:** the 130px-min `.img-wrap` 3:4 box cannot accommodate full `setName` strings like "Marvel Studios: What If…?" without ellipsis defenses or grid reflow.
- **Where applied:** WP-096 §Non-Negotiable Constraints, §Locked Values rows 3 + 8, §Scope (In) B, §Acceptance Criteria B6, §Files Expected to Change DECISIONS line, §Definition of Done D-9601 line; EC-096 §Locked Values labels line, §Required `// why:` Comments JSDoc bullet, §After Completing DECISIONS line.
- **Executor risk:** see §5.1 below.

### PS-2 — Forbidden-imports overstatement

- **Original:** WP-096 forbade `@legendary-arena/registry` outright; this contradicted the layer rule, which permits narrow Zod-schema subpaths from registry-viewer (just not the Node-bearing barrel).
- **Resolution:** Distinguish the Node-bearing barrel (forbidden) from narrow Zod-schema subpaths (permitted by the layer rule, not needed in this scope).
- **Where applied:** WP-096 §Non-Negotiable Constraints "No layer leaks" bullet; EC-096 §Guardrails imports line; session prompt §11 grep gates (the `@legendary-arena/registry['\"]` pattern matches only the bare-barrel form).
- **Executor risk:** in practice, neither WP-096 file should import from `@legendary-arena/registry` at all — `FlatCard` flows via `../registry/browser`. The grep gate is a safety net.

### PS-3 — Session-context misframing

- **Original:** WP-096 §Session Context said WP-066's scope was "implicitly sidebar-only despite the 'global' framing." The WP-066 post-mortem at `01.6-WP-066-registry-viewer-data-toggle.md:66` shows the scope was *deliberately* sidebar-only.
- **Resolution:** Reframe to "WP-066 was deliberately scoped to the sidebar — its `CardGrid.vue` exclusion was an explicit EC-066 §Guardrails item, not an oversight. The user-visible bug is the gap between that deliberate scope and the public-facing 'global toggle' framing the user expected: a toggle labelled 'Data view' / 'Image view' implies coverage of the main grid, not just the sidebar."
- **Where applied:** WP-096 §Session Context (replaced); §Context (Read First) post-mortem entry rewritten.
- **Executor risk:** none. Cosmetic / audit-trail fix only.

### FIX 4 — Code-category gap (third inheritance pass)

- **Original:** `apps/registry-viewer/` has no row in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`. Surfaced as WP-066 copilot finding #13; inherited silently by WP-094; would have been inherited again by WP-096.
- **Resolution:** Append a "(deferred placeholder)" tracker line to `WORK_INDEX.md` immediately after the existing CLI-credentials placeholder, enumerating two acceptable resolution paths: (a) extend `client-app` (D-6511) to cover both `apps/arena-client/` and `apps/registry-viewer/`; (b) add a new `client-app-viewer` row with its own DECISIONS entry. Either path is a future docs-housekeeping WP — **out of scope for WP-096**.
- **Where applied:** `docs/ai/work-packets/WORK_INDEX.md:1771`.
- **Executor risk:** see §5.6 below.

---

## 5. Active Risks for the Executor

### 5.1 PS-1 Option A drift

The deliberate `Set` / `setAbbr` divergence is the most likely
mid-execution mistake — the executor reads `CardDataDisplay.vue` for
guard-form parity and unconsciously copies the `Edition` / `setName`
label too. **The session prompt's §7.3 row 3 explicitly forbids this.**
If `CardDataTile.vue` ends up rendering `setName` under `Edition`, the
tile will overflow the 3:4 box on long-set-name cards, reflowing the
grid. Any deviation from Option A requires escalation — do not switch
to Option B mid-execution; that is scope expansion, not implementation.

### 5.2 Conditional placement inside `.img-wrap`

The `viewMode` branch lives **inside** `.img-wrap`, not as a sibling.
`.img-wrap` itself stays in the DOM in both modes. If the executor
hoists the conditional to wrap `.img-wrap` rather than placing it
inside, CSS selectors and sizing rules attached to `.img-wrap` (the
3:4 aspect ratio at `CardGrid.vue:83`, the bg / overflow rules) may
silently break in data mode. Per §7.6 of the session prompt and
EC-096 §Locked Values "Conditional placement" line.

### 5.3 `.tile-info` footer and `.selected` glow

The `.tile-info` footer (lines 47-55 in baseline `CardGrid.vue`)
renders **unconditionally** in both modes — no template, structural,
or style change. The `.selected` rule (line 82) remains on the **outer**
`.card-tile` button, never moved into a conditional branch. If the
executor refactors either of these into the `viewMode` conditional, the
selection-glow disappears after toggle and `.tile-info` may render
twice or zero times. EC-096 §Common Failure Smells lists both as known
symptoms.

### 5.4 AND-semantics guard form for `cost`

`cost` is a number that may legitimately be `0` (a zero-cost card is
valid and present in the data). The guard form must be
`v-if="card.cost !== undefined && card.cost !== null"`, **not**
`v-if="card.cost"` — the latter would hide every legitimate zero-cost
card. EC-096 §Common Failure Smells flags this.

### 5.5 `attack` / `recruit` empty-string guard form

The `FlatCard` type declares `attack?: string | null` and
`recruit?: string | null` (verified at `apps/registry-viewer/src/registry/types/index.ts:51-52`),
but real card JSON sometimes carries empty string `''` for these
fields. The guard form must be
`v-if="card.X !== undefined && card.X !== null && card.X !== ''"` —
matching `CardDataDisplay.vue:105, 110` exactly. Omitting the empty-string
clause produces blank `Attack` / `Recruit` rows on cards with no fight
or recruit value.

### 5.6 No fix to the code-category gap

The `(deferred placeholder)` tracker at `WORK_INDEX.md:1771` is a
**future** docs-housekeeping WP, not part of WP-096. Do **not**
add a row to `02-CODE-CATEGORIES.md` in this session. Do **not**
add a D-entry classifying `apps/registry-viewer/`. The WP-066 +
WP-094 precedent is to inherit the gap implicitly via
`apps/registry-viewer/CLAUDE.md` — WP-096 follows the same path.

### 5.7 No test harness

The viewer has no Vue component-test harness at baseline. **Do not
add one mid-session.** If the executor strongly believes a regression
test is warranted (e.g., for the AND-semantics guards), raise it as
a follow-up WP — do not expand WP-096 scope. EC-096 §Guardrails:
"No tests added; no test config changes."

### 5.8 D-9601 does not exist yet

D-9601 is **scheduled to be authored at Commit B** by the executor.
At session start it does not exist in `docs/ai/DECISIONS.md`. The WP,
EC, pre-flight, copilot check, and session prompt all reference D-9601
forward; the reference resolves to a real entry only after Commit B.
This is the standard pattern for governance commits — the entry is
authored at close-out, not at packet draft time.

### 5.9 Manual smoke is the ONLY behavioral verification

`pnpm --filter registry-viewer typecheck` proves type correctness
but not visual correctness. `pnpm build` proves the bundle compiles.
Neither catches a tile that overflows the 3:4 box in real Chrome,
or a `cardViewMode` localStorage value that fails to persist across
reload. The session prompt's §12 manual smoke a–h must be run
end-to-end before declaring Commit A ready. Skipping a–h is the
fastest way to ship a regression.

---

## 6. Patterns Still in Effect

- **Sidebar-cousin component pattern** (WP-066 precedent). `CardDataTile.vue` mirrors `CardDataDisplay.vue` AND-semantics, label vocabulary (six of seven rows), and `@media print` block. New SFC; not a refactor of the sidebar.
- **Module-scoped composable as single source of truth** (WP-066). `useCardViewMode` is read by `App.vue` (for prop flow into `CardDetail.vue`) and now by `CardGrid.vue` directly. No `view-mode` prop on the grid. No `setViewMode` exposure.
- **Inside-`.img-wrap` conditional placement** (introduced by WP-096). User-supplied quality lock during the template-conformance review pass; preserves CSS selectors and sizing rules attached to `.img-wrap`.
- **AND-semantics guard form parity** with `CardDataDisplay.vue`. Three guard families locked at §7.5 of the session prompt — copy them verbatim.
- **Local literal color tokens** (existing registry-viewer pattern). No new shared theme module; `lib/theme.ts` is reserved for color constants used in multiple components.
- **Single-WP, single-feature scope-lock discipline** (WP-094 / WP-066). Two production files (one new, one modified). Governance files explicitly listed in §6 of the session prompt to prevent the "files limited to two" / governance-update contradiction.
- **Manual-smoke verification in lieu of test harness** (WP-066 / WP-094 / EC-103 precedent).
- **01.5 NOT INVOKED declaration** (WP-030 / WP-066). Session prompt §3 enumerates the four criteria and marks each absent.
- **Staging by exact filename**, never `git add .` / `-A` / `-u` (P6-27 / P6-44).
- **Code-category gap inheritance** (WP-066 §13 / WP-094). WP-096 inherits the same standing risk; FIX 4 indexes it as a future docs WP.

---

## 7. Relevant Decisions

- **D-66xx range** — WP-066 toggle UX semantics. `D-9601` must not contradict any prior D-66xx entry. Scan that range before authoring D-9601 at Commit B.
- **D-6511** — `apps/arena-client/` classified `client-app` in `02-CODE-CATEGORIES.md:45`. The registry viewer is unclassified; WP-096 inherits via `apps/registry-viewer/CLAUDE.md` per WP-066 / WP-094 precedent.
- **D-9601** — **scheduled** for authorship at Commit B. Captures: (a) locked field set on `CardDataTile.vue`; (b) composable-vs-prop choice; (c) AND-semantics parity with `CardDataDisplay.vue`; (d) ability-text omission rationale; (e) the `Set` / `setAbbr` tile-compaction divergence from sidebar `Edition` / `setName`. Does not exist in `DECISIONS.md` at session start.

---

## 8. Authoritative References

This file is **not authoritative**. If conflict arises:

- On execution contract → **EC-096** wins (`docs/ai/execution-checklists/EC-096-registry-viewer-grid-data-view.checklist.md`)
- On design intent → **WP-096** wins (`docs/ai/work-packets/WP-096-registry-viewer-grid-data-view.md`)
- On layer boundary → **`docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)`** wins
- On vision clauses → **`docs/01-VISION.md`** wins (§10a is the touched clause)
- On EC-mode rules → **`.claude/CLAUDE.md`** wins
- On commit hygiene → **`docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`** wins
- On runtime-wiring allowance → **`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`** (NOT INVOKED for this WP)

This bridge file exists to surface the *why* behind the *what*. It will
be effectively superseded once WP-096 lands and D-9601 captures the
design rationale in `DECISIONS.md` (Commit B).

---

**Next action:** open a new Claude Code session, read
`docs/ai/invocations/session-wp096-registry-viewer-grid-data-view.md`
end-to-end, run baselines per §3 above, then proceed to Commit A.
