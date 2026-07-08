# EC-359 — Remove the Redundant `<ol>` Ordinal from the HUD Game Log (Execution Checklist)

**Source:** docs/ai/work-packets/WP-329-remove-hud-log-ol-ordinal.md
**Layer:** arena-client only (`GameLogPanel.vue` CSS). **Lane:** Lightweight (single session; pure client CSS).

## Before Starting
- [ ] On `main`, clean, synced; baseline `origin/main` @ `d8576c79`.
- [ ] Confirm `.entries` (shared by the compact panel + WP-322 overlay) lacks a `list-style` (so `<ol>` shows a decimal ordinal).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values
- `.entries { list-style: none; padding-left: 0; }` (was `padding-left: 1.5rem`).
- Keep the `<ol>` element + the in-text WP-328 `{turn}.{step}.{action}` number. Reserved decision: **D-24115**.

## Guardrails
- Pure CSS — no markup/structure change (the `<ol>`/`<li>`/`aria-live` stay so render tests pass).
- Do NOT touch the save/export path, the engine log, or the WP-328 in-text number.
- No new dependency; no `<ol>`→`<ul>` swap.

## Required `// why:` Comments
- The `list-style: none` (why: WP-329 — each line self-numbers via WP-328, so the browser `<ol>` ordinal was a redundant double-number; hide the marker, keep the semantic `<ol>`).

## Files to Produce
- `apps/arena-client/src/components/log/GameLogPanel.vue` [`.entries` CSS].
- Governance: `DECISIONS.md` (D-24115), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md` (+ `roadmap-counts --write`).

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client run test` 0 fail (render tests unchanged); `pnpm -r build` clean.
- [ ] `git diff --name-only` = the allowlist; `roadmap-counts --check` 0.
- [ ] STATUS / DECISIONS (D-24115 Active) / WORK_INDEX (WP-329 `[x]`) / EC_INDEX (EC-359 Done) / mindmap node.
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (lines show only the in-text number, no leading `167.`).

## Common Failure Smells
- Swapping `<ol>`→`<ul>` → breaks the render tests that assert `<ol>`.
- Removing the in-text WP-328 number (that stays; only the browser marker goes).
- Trying to unit-test the marker in jsdom → jsdom renders no list markers; the visual is D-24026 live-verify.
