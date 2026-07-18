# EC-417 — Legends-Board Brand-Tokens Integration (Execution Checklist)

**Source:** Operator-directed. Extends the cross-site brand-tokens
contract established by `WP-007a` (play.*) and `WP-007b` (cards.*) to
its **third and final** public consumer, `legends.legendary-arena.com`.
Per the EC-154 posture, a marketing-side contract extension that touches
engine-repo code cites the originating WPs rather than spawning a
duplicate engine WP; this EC is the engine-side execution contract.

**Layer:** `apps/legends-board/**` only. No engine, registry, preplan,
or server runtime change. No package boundary crossed. No new runtime
npm dependencies. `pnpm-lock.yaml` untouched.

## Provenance breadcrumb

`legends-board` shipped under WP-143 / EC-164 with a self-contained dark
stylesheet (no brand tokens). WP-007a closed the `play.*` half of the v1
cross-site carve-out on 2026-05-10 and WP-007b the `cards.*` half on
2026-05-11; `legends.*` was never wired, leaving it the only public
surface off the brand system and drifting by hand (most recently the
2026-07-17 header-link restyle, PR #809, which had to inline literal
values precisely because tokens were unavailable). EC-417 closes that
gap. Next free slot above the latest landed (EC-416) at draft time.

## Locked Values (do not re-derive)

- **Cross-origin URL:** `https://www.legendary-arena.com/brand-tokens.css`
- **Local fallback path:** `apps/legends-board/public/brand-tokens.local.css`
- **`<link>` order:** local fallback FIRST, cross-origin live URL
  SECOND. Reverse order silently breaks the fallback path. `@import`
  is forbidden. `crossorigin` attribute intentionally OMITTED (live URL
  responds `Access-Control-Allow-Origin: *`). No JavaScript-driven
  token loading.
- **SHA-256 hash parity at lock:**
  `70C11CEB75A993F2806056DB8D955D5D3133362D97C03A51EFB6719C575713FF`
  — the **git blob** (LF-normalized, `text=auto`) with the **4-line**
  SNAPSHOT header stripped. Note: the Windows working-tree copy is CRLF
  and will NOT hash to this value; verify against `git show` output or a
  `tail -n +5` of the LF form. Same v1 hash as WP-007a / WP-007b.
- **Theme pin: `<html lang="en" data-theme="dark">`.** THIS EC DIVERGES
  FROM PRECEDENT AND THE DIVERGENCE IS DELIBERATE. The v1 dark token
  values apply only under `html[data-theme="dark"]`; `play.*` and
  `cards.*` set no attribute and therefore render the LIGHT default
  (verified 2026-07-18: `cards.legendary-arena.com` computes
  `background-color: rgb(253, 252, 248)`). legends-board is an
  unattended kiosk / big-screen / Twitch attract board (WP-143) whose
  dark cinematic base is a product requirement, so it pins dark. The
  attribute is **static** — there is no theme toggle and none is in
  scope.
- **Token mapping (dark set).** `#0a0a0f`→`bg-primary`;
  `#e0e0e0`→`text-primary`; `#888`,`#aaa`→`text-secondary`;
  `#666`→`text-muted`; `#1a1a2e`,`#2a2a3a`,`#333`→`border-subtle`;
  `#555`→`border-strong`; `#8c8`→`success`; `#fc8`→`warning`;
  `#f88`→`error` (see AA carve-out below); `#ffd700`→**`gold-bright`**
  (`#f0c94a`), NOT base `gold` (`#d4af37`) — `gold-bright` is far closer
  to the board's signature `#ffd700` and scores 12:1 on the dark base.
- **Title gradient:** `135deg` direction PRESERVED (the diagonal gold
  sweep is the Hall of Legends' identity); only the stops move onto
  tokens (`gold-bright` → `gold-muted`). Deliberately NOT
  `var(--la-gradient-gold)`, which is `90deg`.

## Deliberate carve-outs (do not "fix" these later without reading this)

- **`rgba()` alpha tints stay literal.** The v1 palette has no
  alpha/tint tokens, so the ~20 `rgba(255, 215, 0, …)` gold washes and
  `rgba(0, 0, 0, …)` scrims keep literal values. Mirrors EC-154's
  identical carve-out for `TYPE_COLOR` / `RARITY_DOT` / `TAG_COLOR`
  ("no v1 token coverage; v1 → v2 bump questions, out of scope"). A
  consequence: tinted gold washes still derive from the pre-token
  `#ffd700` while solid gold is now `#f0c94a`.
- **WCAG AA carve-out on error text — `color-mix`, not the bare token.**
  `--la-color-error` (`#dc2626`) scores **3.97:1** against
  `--la-color-bg-primary` (`#0b0f19`), below AA 4.5:1;
  `--la-color-red-bright` is worse at **3.85:1**. The v1 dark palette
  has NO AA-passing red for text on this base — a real palette gap, not
  an authoring mistake. The two error surfaces therefore use
  `color-mix(in srgb, var(--la-color-error) 55%, var(--la-color-text-primary))`
  → `#e78486` at **7.33:1**, restoring the 8.33:1 the pre-token `#f88`
  had while keeping hue and v1 → v2 lineage. Failure mode is safe: if
  `color-mix` is unsupported the declaration drops and the element
  inherits `--la-color-text-primary` — legible, never invisible.
  **Raise this gap if a v2 palette is ever cut.**
- **`index.html` inline `var()` fallbacks carry literal values**, unlike
  the strict "no raw hex outside the snapshot" rule EC-154 locked. This
  surface runs unattended; a both-stylesheets-failed state would paint
  default-white and blow out a dark room. The fallbacks mirror the dark
  set and are dead code whenever either stylesheet loads.

## Guardrails

- **No engine/registry/server change for branding reasons.**
  legends-board's zero-API posture (WP-143 / D-14301: reads R2
  snapshots only, no game-server call, no auth) is UNCHANGED — a
  stylesheet `<link>` is not an API call, and it carries a same-origin
  fallback. Re-verify the zero-API bundle grep.
- **No new runtime npm dependencies.** `pnpm-lock.yaml` modification is
  a failure condition.
- **Out-of-scope legends-board paths:** `src/main.ts`,
  `src/snapshots/**`, `src/router/**`, `src/attract/kioskMode.ts`,
  `src/panels/gauntletDisplay.ts`, any `.test.ts`, `package.json`,
  `tsconfig*.json`, `vite.config.ts`. Styling only — zero behavior
  change, which is why the 71-test suite must pass untouched.
- **Out-of-scope cross-package paths:** `packages/**`, `apps/server/**`,
  `apps/arena-client/**`, `apps/registry-viewer/**`, `apps/dashboard/**`,
  `data/**`.
- **No silent fixes.** Manual edits to `dist/**`, DevTools overrides, or
  CF dashboard file edits are NOT valid fixes. Every fix survives a
  clean `pnpm --filter legends-board build`.

## Required `// why:` Comments

- `index.html` `<html>` tag: why `data-theme="dark"` is pinned (kiosk
  surface; light default would white-out an unattended board)
- `index.html` `<head>` block: (a) cascade contract (equal specificity →
  source order; live wins; fallback under outage), (b) SHA-256
  byte-parity contract, (c) deliberate `crossorigin` omission
- `index.html` inline `<style>`: why the `var()` fallbacks carry literals
- `public/brand-tokens.local.css` SNAPSHOT header: canonical source URL,
  refresh date, future-v2-bump obligation
- `App.vue` `.app-title` + `index.html` `.static-fallback h1`: why 135deg
  is preserved rather than adopting `--la-gradient-gold`
- `App.vue` `.app-home-link`: why hover is gold rather than
  `--la-color-cta` (cta is a light-theme value; invisible on dark)
- `App.vue` `.error-content h2` + `FreshnessBadge.vue`
  `.freshness-badge.error`: the AA carve-out rationale

## Files to Produce

**Created:**
- `apps/legends-board/public/brand-tokens.local.css` — v1 fallback
  snapshot with 4-line SNAPSHOT header
- `docs/ai/execution-checklists/EC-417-legends-board-brand-integration.checklist.md`
  (this file)

**Modified:**
- `apps/legends-board/index.html` — `data-theme="dark"`; two `<link>`
  tags + contractual comment block; inline styles routed through tokens
- `apps/legends-board/src/App.vue` — `.legends-app` background/color,
  header border, title gradient, home-link, error/state colors
- `apps/legends-board/src/attract/AttractCycler.vue`
- `apps/legends-board/src/components/EmptyBoardCta.vue`
- `apps/legends-board/src/components/VersionBadge.vue`
- `apps/legends-board/src/freshness/FreshnessBadge.vue`
- `apps/legends-board/src/panels/BySchemePanel.vue`
- `apps/legends-board/src/panels/GauntletBoardPanel.vue`
- `apps/legends-board/src/panels/GauntletIndexPanel.vue`
- `apps/legends-board/src/panels/NowPlayingPanel.vue`
- `apps/legends-board/src/panels/OverallPanel.vue`
- `apps/legends-board/src/panels/RecentAchievementsPanel.vue`
- `apps/legends-board/src/panels/WeeklyPanel.vue`
- `docs/ai/execution-checklists/EC_INDEX.md` — Phase 7 row added

## After Completing

- [ ] `pnpm --filter legends-board build` exits 0
- [ ] `pnpm --filter legends-board test` exits 0 (**71/71** — styling-only
      change, so any test delta means behavior moved and is a FAIL)
- [ ] `pnpm --filter legends-board typecheck` (vue-tsc) exits 0
- [ ] `dist/brand-tokens.local.css` exists; first lines show the SNAPSHOT
      header + `Version: v1`
- [ ] SHA-256 parity: `tail -n +5` of the LF snapshot ==
      `70C11CEB…13FF` == live URL body
- [ ] `dist/index.html` contains both `<link>` tags in contractual order
      AND `data-theme="dark"` on `<html>`
- [ ] Zero raw hex remains under `apps/legends-board/src` outside
      comments (`#default` slot syntax is not a color)
- [ ] `pnpm-lock.yaml` byte-identical to HEAD
- [ ] `git diff --stat packages/ apps/server/ apps/arena-client/
      apps/registry-viewer/ apps/dashboard/ data/` empty
- [ ] Dev-server render: `--la-color-bg-primary` computes `#0b0f19`
      (dark set ACTIVE, not the light default)
- [ ] Local fallback ALONE carries the dark set — fetch
      `/brand-tokens.local.css`, strip comments, confirm the
      `html[data-theme="dark"]` rule block contains `#0b0f19`
- [ ] Contrast audit on `--la-color-bg-primary`: every foreground token
      in use ≥ 4.5:1 (gold-bright 12:1, text-secondary 8.81:1, warning
      8.92:1, success 8.4:1, error-mix 7.33:1)
- [ ] Zero-API posture re-verified against the built bundle (no
      `api.legendary-arena.com` / `/api/` strings)
- [ ] Post-deploy on `https://legends.legendary-arena.com`: board renders
      dark, cross-origin `brand-tokens.css` returns `200` + ACAO `*`,
      same-origin `/brand-tokens.local.css` returns `200` + SNAPSHOT
      header, console clean

## Common Failure Smells

- **Board renders warm off-white after deploy** → `data-theme="dark"`
  lost from `<html>` (a Vite HTML transform or a hand-edit dropped it).
  The tokens loaded fine; the light default is being applied. This is
  the single highest-consequence regression in this EC.
- **SHA-256 parity fails on Windows** → almost always CRLF. `text=auto`
  stores LF in the index but checks out CRLF; hash the `git show` blob
  or `tail -n +5` of an LF copy, not the working-tree file.
- **Parity fails with an LF copy** → snapshot is genuinely stale vs the
  live URL. Re-copy from
  `C:\www\legendary-arena-com\static\brand-tokens.css`, re-add the
  4-line header, re-hash. If it is a real v1 → v2 bump on www, STOP and
  surface — all three consumers refresh together.
- **A `var(--la-*)` renders transparent/black** → the token name does not
  exist in v1 (typo, or a v2-only name). Check against the
  `html[data-theme="dark"]` block in the snapshot; unknown custom
  properties fail silently.
- **Test count moves off 71** → this EC is styling-only; a behavior
  change slipped in. Revert and re-scope.
