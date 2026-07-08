# WP-329 — Remove the Redundant `<ol>` Ordinal from the HUD Game Log

**User-Visible Surface:** play.legendary-arena.com (the Game Log panel + WP-322 export).
The Game Log panel renders entries in an `<ol>`, so the browser prepended its own
ordinal (`1.` … `167.`) in front of every line. Since WP-328 gave each line its own
`{turn}.{step}.{action}` number, that ordinal was a redundant double-number
(`167. 16.2.8 …`). This hides the `<ol>` marker so only the in-text number shows.

## Goal

Add `list-style: none` + `padding-left: 0` to the shared `.entries` rule in
`GameLogPanel.vue` so the compact panel and the WP-322 expand overlay stop rendering the
browser ordinal. The `<ol>` element stays (the log is semantically ordered); only its
marker is hidden. Pure client CSS.

## Assumes

- `apps/arena-client/src/components/log/GameLogPanel.vue` (WP-318/321/322) renders both the
  compact panel and the expand overlay as `<ol class="entries">`, with `.entries` lacking a
  `list-style` (so `<ol>` defaults to `decimal`). Baseline `origin/main` @ `d8576c79`.
- WP-328 (D-24114) added the in-text `{turn}.{step}.{action}` number to each `G.messages`
  line, which is the number the operator wants to keep.

## Context (Read First)

- `apps/arena-client/src/components/log/GameLogPanel.vue` — the `.entries` CSS rule + the two
  `<ol class="entries">` (compact + overlay).
- `docs/ai/DECISIONS.md` — D-24114 (the in-text numbering that stays).

## Scope (In)

- **`GameLogPanel.vue`** — `.entries` gains `list-style: none;` + `padding-left: 0;` (was
  `padding-left: 1.5rem` for the marker indent). No markup/structure change.

## Out of Scope

- **The WP-328 in-text `{turn}.{step}.{action}` number** — kept (that is what the operator
  wants; the browser ordinal is what is removed).
- **Changing `<ol>` → `<ul>`** — the `<ol>` stays (semantically ordered; render tests assert
  `<ol>`); only its marker is suppressed via CSS.
- **The save/export path or the engine log** — untouched (the ordinal was only the browser's
  `<ol>` rendering; the raw log + Save text never had it).

## Files Expected to Change

| File | Action |
|------|--------|
| `apps/arena-client/src/components/log/GameLogPanel.vue` | **Modified** — `.entries` `list-style: none` + `padding-left: 0` |
| `docs/ai/DECISIONS.md` | **Modified** — D-24115 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-329 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-359 row |
| `docs/05-ROADMAP-MINDMAP.md` | **Modified** — WP-329 node + `roadmap-counts --write` |

No other files may be modified.

## Non-Negotiable Constraints

**Engine-wide:** full file contents; ESM; human-style code per `00.6-code-style.md`.

**Packet-specific:**
- Pure client CSS — no markup/structure change (the `<ol>`/`<li>`/`aria-live` stay), no
  engine/server change, no new dependency.
- Keep the in-text WP-328 number; only the browser `<ol>` marker is hidden.

**Session protocol:** stop and ask on any ambiguity.

**Locked contract values:** `.entries { list-style: none; padding-left: 0; }`. Reserved
decision: **D-24115**.

## Vision Alignment

- **Vision clauses touched:** §14 (observability / readable feed), §11 (read-only projection).
  **Conflict:** `No conflict.` **Determinism:** N/A (client display).

## Acceptance Criteria

1. `.entries` carries `list-style: none` and `padding-left: 0` (asserted by inspection).
2. `GameLogPanel` still renders an `<ol class="entries">` with one `<li>` per entry and
   `aria-live="polite"` — the existing render tests pass unchanged (no structure change).
3. `pnpm --filter @legendary-arena/arena-client run test` green; `pnpm -r build` clean.
4. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client run test   # 0 fail (render tests unchanged)
pnpm -r build                                          # succeeds
git diff --name-only                                   # only ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] arena-client `test` green; `pnpm -r build` clean
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):** after merge
      + deploy, the live HUD Game Log shows lines with only the in-text number (e.g. `16.2.8
      All tactics defeated — mastermind Magneto is vanquished!`) — no leading `167.` ordinal;
      STATUS.md records the evidence until then (jsdom does not render list markers).
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24115 Active; `WORK_INDEX.md` WP-329 `[x]`;
      `EC_INDEX.md` EC-359 Done; roadmap-mindmap node (`--check` green)
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3)

21/21 resolved. §1 sections present + ≥2 Out-of-Scope; §2 constraints + 00.6; §5 single client
file + governance; §14 four binary criteria; §15 DoD + User-Visible Surface + live D-24026 item;
§16 pure CSS; §17 Vision §14/§11 no conflict; §12/§13 arena-client `test` + build; §21 N/A
(no HTTP/`apps/server`). §4/§6/§7/§8/§9/§10/§11/§18/§19/§20 N/A or PASS (client CSS, no
deps/env/auth/funding/forbidden-token/state-artifact).

## Pre-Flight Verdict (01.4)

**READY / lightweight lane.** Single client file, pure CSS, additive (a display rule), no
contract/determinism/persistence surface. Suppresses a redundant browser `<ol>` ordinal now
that WP-328 numbers each line in-text; the `<ol>` stays so render tests are unchanged. The
visual is inherently D-24026 live-verify (jsdom renders no list markers).

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing, no monetization/identity/RNG, no contract, no determinism/hash
surface. Operator-directed UI polish. No BLOCK modes.
