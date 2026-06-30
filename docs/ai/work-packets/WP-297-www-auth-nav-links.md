# WP-297 — `www` Auth Navigation Links (Link to `play`; No Second Sign-In Surface)

**Status:** Draft — ready to execute (drafted 2026-06-30) · **Lightweight Lane** (D-24028) · **Cross-repo: executes in the marketing repo** `C:\www\legendary-arena-com`
**Primary Layer:** Marketing site (Hugo) — `C:\www\legendary-arena-com` (separate repo; not part of this monorepo)
**User-Visible Surface:** `www.legendary-arena.com` (header nav — a "Sign in" link, and a "My account" link, both pointing at `play`)
**Dependencies:** D-24084 (the policy this executes) ✅ drafted alongside; WP-160 (the `play` `?route=login` sign-in surface) ✅; WP-104 (the `play` `?route=me` owner profile) ✅; WP-019 (the existing Snipcart cart button in `header.html`) ✅.
**Baseline:** marketing repo `C:\www\legendary-arena-com` `header.html` + `hugo.toml` as read 2026-06-30 (the `[[menu.main]]` block already carries a `Play` external link to `https://play.legendary-arena.com/`).

---

## Goal

`www.legendary-arena.com` gains two header-nav affordances that send visitors to the existing Hanko sign-in and profile surfaces on `play` — a **"Sign in"** link to `https://play.legendary-arena.com/?route=login` and a **"My account"** link to `https://play.legendary-arena.com/?route=me` — added as `[[menu.main]]` entries in `hugo.toml`. No sign-in form, broker SDK, session handling, or authenticated API call is added to `www`; the marketing site stays a static Hugo bundle. After this packet, a visitor on the marketing site can reach sign-in / their account in one click instead of having to know the `play` URL, and the ewiki "Login on `www`" open question is closed by D-24084.

---

## User-Visible Impact

On `www.legendary-arena.com`, the header menu shows a "Sign in" item and a "My account" item alongside the existing About / Posts / Shop / Brand / Play items. Clicking either navigates (cross-site, with the existing outbound-link icon the header already renders for external menu items) to the live `play` sign-in or profile page. Nothing else on the marketing site changes; no login form renders on `www` itself.

---

## Assumes

- **The header nav is config-driven from `hugo.toml`.** `layouts/_partials/header.html` iterates `site.Menus.main` and renders each entry; external entries (matched by `findRE "://" .URL`) get an outbound-link SVG icon automatically. So adding a nav link is a `hugo.toml` `[[menu.main]]` edit, not a partial edit. (Verified at `C:\www\legendary-arena-com\layouts\_partials\header.html` `<ul id="menu">` range block + `hugo.toml` `[[menu.main]]` entries, 2026-06-30.)
- **An external `Play` menu entry already exists** at `url = "https://play.legendary-arena.com/"` with the `://`-triggered outbound icon — the two new entries mirror its exact shape. (Verified at `hugo.toml` `[[menu.main]]`, 2026-06-30.)
- **The `play` targets exist and are live.** `?route=login` is the WP-160 sign-in surface and `?route=me` is the WP-104 owner profile, both shipped on `play.legendary-arena.com`. (Verified at `apps/arena-client/src/pages/LoginPage.vue` + `MyProfilePage.vue` on `origin/main`.)
- **Hugo builds the marketing repo with `hugo --minify`** (per `docs/ops/DOMAINS.md §www`).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/DECISIONS.md` — **D-24084** (the policy this packet executes: `www` does not own auth; it links to `play`; passwordless copy guidance). This packet implements only the link affordance D-24084 authorizes.
- `wiki/profile-login.md` — the "Open Questions → Login on `www`" item this closes, and the `play`-vs-`www` split it documents.
- `C:\www\legendary-arena-com\layouts\_partials\header.html` — read the `<ul id="menu" class="menu">` range block to confirm external menu items render correctly (the `findRE "://"` icon branch). **Do not modify this partial** — the change is config-only.
- `C:\www\legendary-arena-com\hugo.toml` — read the `[[menu.main]]` block (the `Play` external entry is the template to copy) and the menu-ordering comments.
- `docs/ops/DOMAINS.md §www` — confirms `www` is "Pure static content; no API calls from marketing pages" — the boundary this packet must preserve.
- `.claude/CLAUDE.md` (this repo) and the marketing repo's own `README.md` — the marketing site is a separate repo; the Co-Authored-By trailer differs per repo (per `reference_dual_repo_layout`).

---

## Non-Negotiable Constraints

**Always apply:**
- `www` SHALL NOT gain a sign-in form, a broker SDK import (`@teamhanko/*`), session-cookie/token handling, or any authenticated API call. The two additions are plain anchor links emitted by Hugo from menu config.
- `www` SHALL NOT call `api.legendary-arena.com` or any authenticated endpoint as part of this change.
- The change is **config-only** (`hugo.toml`); `header.html` and every other partial stay byte-identical.
- The marketing site must still build and deploy as static content with `hugo --minify` and no new secret/env dependency.
- Human-style markup/config per `docs/ai/REFERENCE/00.6-code-style.md` (this repo's style guide governs the WP/governance edits; the Hugo config follows the surrounding `[[menu.main]]` conventions).

**Packet-specific:**
- Use the exact `play` URLs: `https://play.legendary-arena.com/?route=login` and `https://play.legendary-arena.com/?route=me` (trailing slash before `?` matches the live routes; the existing `Play` entry's `/` form is the precedent).
- Menu copy: **"Sign in"** and **"My account"** — passwordless-compatible per D-24084; do NOT use "Log in / Log out" toggling or "Change password" copy (the site is static and cannot know auth state).
- Menu placement and `weight` ordering follow the existing `[[menu.main]]` comment guidance in `hugo.toml`; the two new external entries sit with the other external items (`Play`).

**Session protocol:**
- If the exact menu-ordering / `weight` convention in `hugo.toml` is unclear, stop and confirm against the existing entries — do not guess a new ordering scheme.

---

## Scope (In)

### A) Two `[[menu.main]]` entries in `hugo.toml`
- A **"Sign in"** entry: `name = "Sign in"`, `url = "https://play.legendary-arena.com/?route=login"`, with a `weight` placing it among the external items, mirroring the existing `Play` entry's shape exactly (so the header's `findRE "://"` outbound-icon branch applies).
- A **"My account"** entry: `name = "My account"`, `url = "https://play.legendary-arena.com/?route=me"`, same shape.
- A short `# why:` config comment noting these link to `play`'s Hanko surface per D-24084 — `www` owns no sign-in.

---

## Out of Scope

- **No `header.html` / `footer.html` / any partial edit** — the change is `hugo.toml` config only.
- **No sign-in form, Hanko SDK, or auth-state-aware nav on `www`** — the site is static and cannot render "signed in as …"; that lives on `play` (D-24084).
- **No change to the Snipcart cart button** (WP-019) or any commerce/checkout flow — cart login is Snipcart's concern, not Hanko's (D-24084).
- **No change to the `play` arena-client** — the targets already exist; this packet only links to them.
- **No engine / server / registry / `apps/*` change in this monorepo** — the only code change is in the marketing repo's `hugo.toml`.
- Refactors, menu re-orderings of existing items, or "while I'm here" nav cleanups are out of scope.

---

## Files Expected to Change

**Marketing repo (`C:\www\legendary-arena-com`):**
- `hugo.toml` — **modified** — two new `[[menu.main]]` entries ("Sign in", "My account") + a `# why:` comment.

**This monorepo (governance):**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-297 checked off with date on execution.
- `docs/ai/STATUS.md` — **modified** — entry noting the `www` auth-nav links + D-24084.
- `docs/ai/DECISIONS.md` — **modified** — D-24084 (drafted with this packet).
- `wiki/profile-login.md` — **modified** — Open Questions item marked resolved by D-24084.

**1 marketing-repo config file + governance.** Lightweight-lane eligible. (Per `reference_dual_repo_layout`, the WP is tracked in this monorepo's `WORK_INDEX.md` while the code change lands in the marketing repo; the marketing-repo commit carries that repo's own Co-Authored-By trailer.)

No other files may be modified.

---

## Vision Alignment

**Vision clauses touched:** §3, §11 (player identity / accounts — the nav points at the account surface). No scoring / PAR / replay / RNG / determinism / simulation surface.

**Conflict assertion:** No conflict — this WP preserves all touched clauses. It adds discoverability to the existing identity surface without changing identity, ownership, or visibility semantics.

**Non-Goal proximity check:** Touches a user-facing surface but crosses none of NG-1..7. It is not pay-to-win (NG-1), not a paid surface, and not persuasive/dark-pattern copy — two plain navigation links to an existing sign-in. Commerce is unchanged (Snipcart / Stripe untouched). **PvP terminology (§23(b)):** "Sign in" / "My account" carry no player-interaction (match/opponent/win-loss) framing.

**Determinism preservation:** N/A — no scoring, replay, RNG, or simulation surface.

---

## Acceptance Criteria

1. `hugo.toml` contains a `[[menu.main]]` entry with `name = "Sign in"` and `url = "https://play.legendary-arena.com/?route=login"` (**AC-1**).
2. `hugo.toml` contains a `[[menu.main]]` entry with `name = "My account"` and `url = "https://play.legendary-arena.com/?route=me"` (**AC-2**).
3. A built `www` artifact (`hugo --minify`) renders both as header-nav anchors with the external outbound-link icon (the `findRE "://"` branch), identical in shape to the existing `Play` item (**AC-3**).
4. `layouts/_partials/header.html` and every other partial are **byte-identical** to baseline — the change is config-only (`git diff --name-only` in the marketing repo shows only `hugo.toml`) (**AC-4**).
5. No Hanko SDK import, no `@teamhanko/*`, no `api.legendary-arena.com` call, and no session/token handling appears anywhere in the marketing repo as a result of this change (grep) (**AC-5**).
6. `wiki/profile-login.md` Open Questions item is marked resolved by D-24084; `WORK_INDEX.md` + `STATUS.md` updated (**AC-6**).
7. The marketing site still builds (`hugo --minify` exits 0) and requires no new env var or secret (**AC-7**).

---

## Verification Steps

```pwsh
# Step 1 — build the marketing site
cd C:\www\legendary-arena-com
hugo --minify
# Expected: exits 0; public/ regenerated

# Step 2 — confirm both menu entries are present in config
Select-String -Path "C:\www\legendary-arena-com\hugo.toml" -Pattern "route=login|route=me"
# Expected: two matches (Sign in -> ?route=login, My account -> ?route=me)

# Step 3 — confirm both links render in the built header
Select-String -Path "C:\www\legendary-arena-com\public\index.html" -Pattern "play.legendary-arena.com/\?route=(login|me)"
# Expected: both URLs present in the rendered nav

# Step 4 — confirm config-only change (no partial edits)
cd C:\www\legendary-arena-com
git diff --name-only
# Expected: only hugo.toml

# Step 5 — confirm no auth wiring leaked onto www
Select-String -Path "C:\www\legendary-arena-com" -Pattern "@teamhanko|hankoClient|api.legendary-arena.com/api" -Recurse
# Expected: no NEW matches attributable to this change
```

---

## Definition of Done

- [ ] `hugo.toml` carries the two `[[menu.main]]` entries ("Sign in" → `?route=login`, "My account" → `?route=me`) + `# why:` comment citing D-24084
- [ ] `header.html` and all partials byte-identical; marketing-repo `git diff --name-only` shows only `hugo.toml`
- [ ] No Hanko SDK / `@teamhanko/*` / authenticated-API / session-handling added to `www` (grep)
- [ ] `hugo --minify` exits 0; both links render with the external-link icon in `public/index.html`
- [ ] D-24084 Active; `wiki/profile-login.md` Open Questions resolved; `WORK_INDEX.md` + `STATUS.md` updated
- [ ] Commit prefix `SPEC:` for this monorepo's governance; the marketing-repo commit uses that repo's convention + its Co-Authored-By trailer
- [ ] **D-24026 live-verify** post-deploy on `www.legendary-arena.com`: the header shows "Sign in" + "My account"; each click lands on the live `play` `?route=login` / `?route=me` page

---

## Lightweight-Lane Eligibility (D-24028)

**Structural (provisional):** (1) single layer — marketing-site config only ✓; (2) 1 config file, no runtime-wiring file ✓; (3) no `01.6` trigger — adding menu entries is not a new code category/abstraction ✓; (4) no new contract file ✓; (5) one scoped D-entry (D-24084) ✓; (6) narrow UX surface (two nav links) — no scoring/identity-semantics/RNG/determinism/monetization change ✓.
**Empirical (confirmed at govern-close):** (7) strictly additive — no existing menu item or partial changed ✓; (8) zero determinism/persistence/hash impact (static site) ✓; (9) file budget holds at final `git diff --name-only` (only `hugo.toml`) ✓.
**Scaffold:** add the two entries and run `hugo --minify`; confirm the built `public/index.html` renders both links before confirming eligibility. Not a validation-tightening change (purely additive nav).

## Lint Gate Self-Review (00.3)

- §1 Structure — PASS: all required sections present; `## Out of Scope` lists ≥2 excluded items (Snipcart cart, `header.html` edits, auth-state nav).
- §2 Non-Negotiable Constraints — PASS: forbids sign-in form / broker SDK / authenticated API on `www`; references `00.6`.
- §3 Assumes — PASS: header is config-driven, the `Play` external entry precedent, the live `play` targets, the Hugo build — all listed with sources.
- §4 Context — PASS: cites D-24084, `wiki/profile-login.md`, the real `header.html` + `hugo.toml`, `DOMAINS.md §www`.
- §5 Output Completeness — PASS: 1 marketing-repo config file + governance, each marked modified with a one-line role; bounded.
- §6 Naming — PASS: menu names "Sign in" / "My account"; URLs verbatim; no canonical-field surface touched.
- §7 Dependency Discipline — PASS: no new npm dependency; no SDK added (the WP explicitly forbids it).
- §8 Architectural Boundaries — PASS (Frontend / static site): no game logic, no R2/API fetch, no broker import; the `www`-stays-static boundary is the packet's core constraint.
- §9 Windows Compatibility — PASS: Verification Steps use `pwsh` + `Select-String`; marketing-repo path uses `\` separators.
- §10 Env Var Hygiene — N/A: no new env vars; no secret in output.
- §11 Authentication Clarity — N/A: this packet adds **no** authentication to `www` — it links to the existing `play` Hanko surface (the identity model is unchanged and owned entirely by `play`).
- §12 Test Quality — N/A: no automated tests (static-site nav config); verification is build + grep + live-verify.
- §13 Commands & Verification — PASS: exact `hugo` + `Select-String` commands with expected output.
- §14 Acceptance Criteria — PASS: 7 binary, observable items naming real files / URLs.
- §15 Definition of Done — PASS: binary checkboxes incl. STATUS / DECISIONS / WORK_INDEX + commit-prefix.
- §15.1 User-Visible Verification (D-24026) — PASS: surface declared `www.legendary-arena.com`; `## User-Visible Impact` present; DoD includes a live-on-surface verify item.
- §16 Code Style — PASS: config-only; `# why:` comment on the menu additions citing D-24084.
- §17 Vision Alignment — PASS: `## Vision Alignment` present; cites §3/§11; NG-proximity none; determinism N/A.
- §18 Prose-vs-Grep — N/A: verification greps target URL/SDK tokens, not a count-bounded literal echoed verbatim in adjacent prose.
- §19 Bridge-vs-HEAD — N/A: no repo-state-snapshot artifact authored.
- §20 Funding Surface Gate — N/A: header auth-nav links; no donate/support copy, no funding affordance, no tournament-funding channel.
- §21 API Catalog Update — N/A: no HTTP endpoint or `apps/server/src/**` library function added or modified (the change is in the marketing repo's `hugo.toml`).

## Decision — D-24084

`www` does not own an authentication surface; it links to `play`'s existing Hanko sign-in (`?route=login`) and profile (`?route=me`). Hanko stays the sole game-account identity provider; commerce checkout (Snipcart on `www`, Stripe-on-Hanko on `play`) needs no `www`-owned sign-in. Passwordless product guidance: avoid "change password" copy. Full text in `DECISIONS.md`.
