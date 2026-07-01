# WP-300 — Public Profile Link-Preview Meta (Open Graph / Twitter Card via Cloudflare Pages Function)

**Status:** Ready
**Primary Layer:** Client App (`apps/arena-client/` — Cloudflare Pages Functions edge subsurface)
**Dependencies:** WP-102, WP-152, WP-101, WP-161, WP-007a
**User-Visible Surface:** play.legendary-arena.com

---

## Session Context

WP-102 shipped the read-only public profile (`GET /api/players/:handle/profile`, guest) rendered by `PlayerProfilePage.vue` at the query-string route `?profile=<handle>`; WP-152 wired the route; WP-007a/EC-148 locked the static `index.html` meta-description + the brand-token cascade contract; WP-161 introduced the API base URL helper. This packet adds an edge presentation layer on top of those without changing the profile contract.

---

## Goal

After this packet, `apps/arena-client` ships its first **Cloudflare Pages Function** (`functions/_middleware.ts`) that intercepts requests whose response is the SPA HTML shell and whose URL carries `?profile=<handle>`. The function fetches the existing public profile from the server API and injects per-player **Open Graph** and **Twitter Card** `<meta>` tags into the served `<head>` via `HTMLRewriter`, so a shared profile link (`https://play.legendary-arena.com/?profile=<handle>`) renders a rich preview card in Discord, X, iMessage, Slack, and other crawlers (which do not run the SPA's JavaScript). Requests without `?profile=`, non-HTML responses, malformed handles, and any API failure serve the **existing shell unchanged** (fail-soft). No server code, no profile contract, and no static `index.html` content changes.

---

## User-Visible Impact

When a player shares their profile link, the paste **unfurls** into a preview card — title = the player's display name, a short description naming what's on the profile (badges earned, team affiliations, public replays), and a Legendary Arena brand image — instead of the current generic "Legendary Arena — the arena awaits" shell. Normal in-browser use is unchanged (the SPA still renders the human-facing page). The change is verified by pasting a profile URL into a link-preview debugger (or Discord/Slack) and observing the card. (D-24026 live-verify: user-visible surface is play.legendary-arena.com.)

---

## Assumes

- WP-102 complete. Specifically:
  - `GET /api/players/:handle/profile` returns `PublicProfileView` `{ handleCanonical, displayHandle, displayName, publicReplays[], teamAffiliations[], badges[] }` (guest auth), 200/404/500 (`apps/server/src/profile/profile.types.ts`, `profile.routes.ts`).
- WP-152 complete — the profile route is wired (`registerProfileRoutes`) and reachable in production.
- WP-101 complete — handle grammar `^[a-z][a-z0-9_]{2,23}$` (`HANDLE_REGEX`).
- WP-161 complete — the API host is available to client code as `VITE_API_BASE_URL`; the edge function needs the same API origin (see Risk R2 — env exposure at the edge).
- WP-007a / EC-148 shipped the static `index.html` head (charset, viewport, `meta[name=description]`, `title`) and the brand-token `<link>` cascade contract; this packet must not modify that file's content or the cascade order.
- The public profile URL is **query-string** based (`/?profile=<handle>`), not path-based (`/players/<handle>`) — confirmed 2026-06-30. The edge function keys on the `profile` query param, not the path.
- The Cloudflare Pages project for arena-client is configured so its **root directory** is `apps/arena-client/` (so a top-level `functions/` directory is discovered and compiled). This is external CF-project config, not in the repo — see Risk R1 (operator must confirm at execution/deploy).
- Baseline `origin/main` @ `de702e70d1e1d1a6953ddd8c0ebf2c6d3092e9cb`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary` — the `client-app` layer may read the server API over HTTP but may not import engine/registry/server code; the edge function is a subsurface of `client-app`.
- `.claude/rules/architecture.md §Import Rules` — `apps/arena-client` may not import `registry` (runtime), `server`, `pg`, or engine runtime; the edge function inherits these prohibitions.
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md §client-app` — the category this directory extends (D-6511); this packet registers `apps/arena-client/functions/` under it (D-24085).
- `docs/01-VISION.md §3, §11, §23, §25, NG-1..7` — identity/visibility + the competitive-surface language the description text must respect (no combat/PvP framing). See `## Vision Alignment`.
- `apps/arena-client/index.html` — the static shell the function transforms at serve time; read the brand-token cascade comment (lines 8–28). The function inserts `<meta>` into `<head>` only; it must never reorder or touch the `<link rel="stylesheet">` elements or modify this file.
- `apps/server/src/profile/profile.types.ts` — the exact `PublicProfileView` field shape the function reads (do not add fields; `avatarUrl` is intentionally absent — see Out of Scope).
- `apps/arena-client/public/_redirects` — the SPA fallback (`/*  /index.html  200`); the `_middleware` runs ahead of static serving and must pass non-matching requests through untouched.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations), 6 (`// why:` comments), 11 (full-sentence errors), 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide items (N/A rationale):** This packet adds no engine code, no boardgame.io moves, no `G`/`ctx` access, no `Math.random()` in the gameplay path, and no persistence of `UIState`. The determinism constraints that bind the browser render path do **not** bind this edge presentation transform (it is not gameplay, not replay-bearing) — but the edge function still may not import engine runtime, registry, `boardgame.io`, or compute game outcomes (D-24085).

**Packet-specific:**
- The edge function transforms the **response** only; it must never modify the `apps/arena-client/index.html` source file or the brand-token `<link>` cascade order (EC-148 / WP-007a locked).
- Only `<meta>` (and optionally `<title>`) elements are inserted into `<head>`. No stylesheet, script, or `<link>` element is added, removed, or reordered.
- The default (no `?profile=`) response and every non-HTML response are byte-identical pass-throughs of the static asset — the function adds nothing to normal page loads.
- All injected attribute values are **HTML-attribute-escaped** — `displayName`/`displayHandle` are user-controlled; unescaped injection is an HTML-injection defect. This is the load-bearing safety property.
- The description text is composed only from `§23`-compliant facts (counts of badges, teams, public replays). It must never contain win/loss, "win rate", "rank", "opponent", "challenge", or any player-vs-player combat framing (Vision §23; see Vision Alignment).
- Fail-soft: any non-200 status, timeout, network error, malformed handle, or parse failure returns the unmodified shell. The function never returns 5xx to the visitor for a profile-meta failure.
- The pure meta-composition logic lives in a **framework-free, I/O-free helper** (`functions/lib/buildProfileMeta.ts`) that is unit-tested; the middleware is thin fetch + `HTMLRewriter` wiring covered by live-verify.

**Session protocol:** If any contract, field name, or CF-Pages behavior is unclear, stop and ask before proceeding — never guess field names, the functions-directory discovery rule, or the API origin.

**Locked contract values (verbatim):**
- **Public profile endpoint:** `GET /api/players/:handle/profile` (guest); response `{ handleCanonical, displayHandle, displayName, publicReplays[], teamAffiliations[], badges[] }`.
- **Handle grammar:** `^[a-z][a-z0-9_]{2,23}$`.
- **Query param:** `profile` (canonical profile URL `https://play.legendary-arena.com/?profile=<handle>`).
- **Fetch timeout:** `1500` ms (bounded; fail-soft on expiry). `// why:` a shared human profile load must not stall on a slow API — 1.5 s caps added latency and degrades to the plain shell.
- **OG image (v1):** static brand card served from the arena-client origin at `/og/profile-card.png` (1200×630). No per-player/avatar image in v1 (see Out of Scope).
- **Injected tags:** `og:type=profile`, `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`.

---

## Debuggability & Diagnostics

- The meta-composition helper is **deterministic** given a `PublicProfileView` input — fully reproducible and unit-tested (no time, randomness, or ambient state).
- The edge wiring's behavior is externally observable: request `/?profile=<handle>` and inspect the served HTML `<head>` for the injected tags; request `/` (no param) and confirm the shell is byte-unchanged.
- Failure is localizable: a preview that does not unfurl means either the profile fetch failed (fail-soft path taken — expected for unknown handles) or the CF Pages project did not discover `functions/` (Risk R1). Both are checkable at the edge without logs.

---

## Scope (In)

### A) Pure meta-composition helper — `apps/arena-client/functions/lib/buildProfileMeta.ts` (new)
- `buildProfileMeta(profile: PublicProfileMetaInput, handle: string): ProfileMetaTags` — deterministic, no I/O, no framework import.
  - Returns the locked tag set with values derived from the profile: `og:title`/`twitter:title` = `displayName` (fallback `displayHandle`); description = a `§23`-compliant composed sentence from `badges.length`, `teamAffiliations.length`, `publicReplays.length`; `og:image`/`twitter:image` = the locked static brand OG URL; `og:url` = the canonical profile URL for `handle`.
  - **HTML-attribute-escapes every value** via a small local `escapeHtmlAttribute` helper (escapes `&`, `<`, `>`, `"`, `'`). Add a `// why:` comment: display fields are user-controlled; escaping prevents HTML injection into the served head.
- `PublicProfileMetaInput` is a **local structural interface** mirroring only the `PublicProfileView` fields this helper reads (engine/server isolation — the client re-declares the read-shape rather than importing server types; same pattern as `profileApi.ts`).

### B) Edge middleware — `apps/arena-client/functions/_middleware.ts` (new)
- A Cloudflare Pages Functions `onRequest` handler. Steps, in order:
  1. `const response = await context.next()` to obtain the static asset response.
  2. Guard: return `response` unchanged unless the request method is `GET`, the response `Content-Type` includes `text/html`, and the URL has a non-empty `profile` param matching `HANDLE_REGEX`. Add a `// why:` comment on the guard (asset requests and paramless loads must be zero-cost pass-throughs).
  3. Fetch `GET {apiBase}/api/players/<handle>/profile` with a `1500` ms bounded timeout (`AbortSignal.timeout`).
  4. On non-200 / timeout / error / parse failure: return the original `response` unchanged (fail-soft). Wrap in try/catch with a `// why:` comment (a profile-meta failure must never break the page).
  5. On 200: call `buildProfileMeta(...)`, then use `HTMLRewriter` to append the tags to `<head>`. Return the rewritten response.
- Resolve the API origin from the Pages environment (see Risk R2). Do not hardcode a production host in source without an env fallback.

### C) Functions typecheck config
- `apps/arena-client/functions/tsconfig.json` (new) — references `@cloudflare/workers-types` so `HTMLRewriter`/`EventContext` type-check.
- `apps/arena-client/package.json` (modified) — add `@cloudflare/workers-types` as a **devDependency**; add a `typecheck:functions` script (`tsc -p functions/tsconfig.json --noEmit`) and confirm the existing `test` script discovers `functions/**/*.test.ts` (extend the glob if it does not — in scope).

### D) Static OG image asset
- `apps/arena-client/public/og/profile-card.png` (new) — a 1200×630 Legendary Arena brand card. A brand-appropriate image is required (design asset); it deploys as a static file served at `/og/profile-card.png`.

### E) Tests — `apps/arena-client/functions/lib/buildProfileMeta.test.ts` (new, `node:test`)
- Title falls back to `displayHandle` when `displayName` is empty.
- Description composition is correct for representative counts and contains **no** forbidden combat terms (assert absence of `win`, `rank`, `opponent`, `challenge` — a `§23` guard).
- HTML-attribute escaping: a `displayName` containing `"><script>` and `&`/`'` is fully escaped in every value (the load-bearing safety test).
- `og:url` is the canonical profile URL for the given handle.
- Does not import `boardgame.io`, `@legendary-arena/registry`, or engine runtime.

---

## Out of Scope

- **No per-player / avatar OG image.** `PublicProfileView` has no `avatarUrl` (accountId is server-internal, WP-052 D-5201). A composed avatar card is a follow-up that first requires adding `avatarUrl` to the public contract (the deferred "WP-α"). v1 uses the static brand image.
- **No server / contract change.** `PublicProfileView`, `profile.routes.ts`, and `api-endpoints.md` are untouched (§21 API-catalog = N/A).
- **No change to `PlayerProfilePage.vue` or any human-render path.**
- **No conversion CTA, banner, prestige styling, or progression stats** — that is the separate public-profile marketing-UI packet ("WP-γ").
- **No crawler user-agent sniffing.** The function injects for all matching requests with fail-soft (rationale in Vision Alignment / Risk R3); UA-gating is explicitly rejected for v1.
- **No path-based routing migration** — the URL stays `?profile=`.
- **No modification of `index.html`, `robots.txt`, or the brand-token cascade.**
- Refactors or "while I'm here" changes are out of scope unless listed above.

---

## Files Expected to Change

- `apps/arena-client/functions/_middleware.ts` — **new** — edge fetch + `HTMLRewriter` wiring (thin).
- `apps/arena-client/functions/lib/buildProfileMeta.ts` — **new** — pure, deterministic meta-composition + attribute escaping.
- `apps/arena-client/functions/lib/buildProfileMeta.test.ts` — **new** — `node:test` coverage (escaping, fallback, §23 guard).
- `apps/arena-client/functions/tsconfig.json` — **new** — workers-types typecheck config.
- `apps/arena-client/package.json` — **modified** — add `@cloudflare/workers-types` devDep + `typecheck:functions` script; confirm/extend test glob.
- `apps/arena-client/public/og/profile-card.png` — **new** — static 1200×630 brand OG image.
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — **modified** — extend `client-app` to register the `functions/` edge subsurface (D-24085).
- `docs/ai/DECISIONS.md` — **modified** — land D-24085.
- `docs/ai/STATUS.md` — **modified** — record the capability.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-300.

No other files may be modified.

---

## Acceptance Criteria

### A) Meta composition
- [ ] `buildProfileMeta` returns exactly the locked tag set (`og:type/title/description/image/url` + `twitter:card/title/description/image`).
- [ ] Every returned value is HTML-attribute-escaped (verified by a test feeding `"><script>` + `&`/`'`).
- [ ] Description contains none of: `win`, `rank`, `opponent`, `challenge` (case-insensitive) — §23 guard test passes.
- [ ] Title falls back to `displayHandle` when `displayName` is empty.

### B) Edge middleware
- [ ] Requests without a `profile` param, non-HTML responses, and non-GET methods return the asset response unchanged (pass-through).
- [ ] A `profile` param not matching `^[a-z][a-z0-9_]{2,23}$` is treated as no match (pass-through).
- [ ] Profile fetch uses a 1500 ms bounded timeout and fails soft (unmodified shell) on non-200 / timeout / error.
- [ ] On 200, the injected tags appear in the served `<head>`; the brand-token `<link>` elements are unchanged and in original order.

### C) Config / boundaries
- [ ] `pnpm --filter arena-client typecheck` exits 0 and `typecheck:functions` exits 0.
- [ ] No import of `boardgame.io`, `@legendary-arena/registry`, `@legendary-arena/game-engine` runtime, or `pg` in `functions/**` (confirmed with `Select-String`).
- [ ] `index.html`, `robots.txt`, and `_redirects` are unmodified (confirmed with `git diff`).

### Tests
- [ ] `pnpm --filter arena-client test` exits 0 and discovers `functions/lib/buildProfileMeta.test.ts`.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter arena-client build
# Expected: exits 0

# Step 2 — tests (must discover functions/lib/buildProfileMeta.test.ts)
pnpm --filter arena-client test
# Expected: all passing, includes the buildProfileMeta suite

# Step 3 — typechecks
pnpm --filter arena-client typecheck
pnpm --filter arena-client typecheck:functions
# Expected: both exit 0

# Step 4 — no forbidden imports at the edge
Select-String -Path "apps\arena-client\functions" -Pattern "boardgame.io|@legendary-arena/registry|@legendary-arena/game-engine|from 'pg'" -Recurse
# Expected: no output

# Step 5 — locked files untouched
git diff --name-only
# Expected: only files listed in ## Files Expected to Change; NOT index.html / robots.txt / _redirects

# Step 6 — live-verify after deploy (D-24026)
#   Paste https://play.legendary-arena.com/?profile=<a-real-handle> into a link-preview
#   debugger (or Discord). Expected: rich card (display name + description + brand image).
#   Paste https://play.legendary-arena.com/ (no param). Expected: unchanged generic shell.
```

---

## Vision Alignment

- **Vision clauses touched:** §3 (trust & fairness — surfaces only already-public data), §11 (player identity / accounts / visibility), §23 (competitive surfaces — the profile shows badges + public replays; this packet only re-presents them for crawlers and adds **no** new competitive framing), §25 (badges are verifiable claims — unchanged).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The function re-presents data already returned by the guest `GET /api/players/:handle/profile` endpoint; it exposes nothing not already public.
- **Non-Goal proximity (NG-1..7):** This is a user-facing marketing surface, so the check is explicit: **none of NG-1..7 are crossed.** No monetization, no paid/cosmetic gating, no pay-to-win (NG-1), no dark pattern. The description text is constrained to §23-compliant facts (badge/team/replay counts) and is **forbidden** from win/loss, rank, opponent, or challenge framing — enforced by a test guard (Scope E).
- **Determinism preservation:** `N/A — WP touches no determinism-bearing surface.` The edge transform is presentation only; it is not scoring, replay, RNG, or simulation. (The pure helper is nonetheless deterministic and tested.)

---

## Gate Verdicts (Drafting)

- **Pre-flight (01.4):** READY TO EXECUTE (2026-06-30). Class: Infrastructure & Verification (edge presentation; no `G` mutation, no `game.ts` wiring). Dependencies WP-102/152/101/161/007a all complete; contract field names verified against `profile.types.ts`; scope locked; risks R1–R3 resolved below.
- **Copilot check (01.7):** PASS with two RISK notes documented and mitigated inline — Issue 1/29 (engine-vs-app boundary: mitigated by the forbidden-import grep in Verification Step 4 + D-24085), Issue 22 (loud-vs-soft failure: locked to fail-soft with a bounded timeout in Non-Negotiable Constraints).
- **Lint gate (00.3):** see `## Lint Gate Self-Review`.

### Risk & Ambiguity (locked for execution)
- **R1 — CF Pages functions discovery (impact HIGH).** The function only activates if the CF Pages project root is `apps/arena-client/` so `functions/` is compiled. This is external project config. Mitigation: the executor confirms the deployed URL injects tags in the D-24026 live-verify step; if not, the CF Pages project's root/build-output settings need adjustment (operator action, recorded in STATUS). Locked decision: do not attempt to encode CF project settings in the repo.
- **R2 — API origin at the edge (impact MEDIUM).** `VITE_API_BASE_URL` is a Vite build-time client var, not automatically present in the Pages Functions runtime. Mitigation: resolve the API origin from a Pages environment binding, with a documented fallback; lock the variable name in the EC at execution once the Pages env is confirmed. If unavailable, this is a blocker, not an improvisation.
- **R3 — inject-for-all vs UA-gating (impact LOW).** Injecting for every matching request adds one bounded API fetch to human profile loads too. Decision: accept it for v1 (no UA list to maintain; meta is harmless to humans; fail-soft + 1.5 s cap bound the cost). UA-gating is a future optimization if edge latency becomes a concern.

---

## Lint Gate Self-Review

All 21 sections of `00.3-prompt-lint-checklist.md`:

- §1 Structure — PASS (all mandatory sections present, template order).
- §2 Non-Negotiable Constraints — PASS (engine items marked N/A with rationale; packet-specific items present).
- §3 Assumes — PASS (each dependency cites a source; baseline SHA recorded).
- §4 Context — PASS (ARCHITECTURE §Layer Boundary first; local paths only, no external URLs).
- §5 Output Completeness — PASS (`## Files Expected to Change` is a closed list; "No other files").
- §6 Naming Consistency — PASS (field names copied verbatim from `profile.types.ts`; full words, no abbreviations).
- §7 Dependency Discipline — PASS (all hard-deps complete; verified in Assumes).
- §8 Architectural Boundaries — PASS (edge subsurface of `client-app`; forbidden imports enumerated + grep-gated).
- §9 Windows Compatibility — PASS (Verification uses `Select-String`; POSIX paths avoided in commands).
- §10 Env Var Hygiene — PASS (API origin resolved via Pages env with fallback; R2 locks the risk).
- §11 Authentication Clarity — PASS (endpoint is guest; the function sends no token).
- §12 Test Quality — PASS (`node:test`; the escaping + §23 guard tests are non-vacuous negative assertions).
- §13 Commands & Verification — PASS (build + test first; per-constraint greps; D-24026 live-verify step).
- §14 Acceptance Criteria — PASS (binary, grouped by sub-task).
- §15 / §15.1 Definition of Done + user-visible verification — PASS (surface = play; D-24026 live-verify gated in DoD).
- §16 Code Style — PASS (pure helper split out; explicit control flow; `// why:` on timeout, guard, catch, escaping).
- §17 Vision Alignment — PASS (§17 triggered on identity/visibility; `## Vision Alignment` block present with clause numbers + NG check + determinism line).
- §18 Prose-vs-Grep Discipline — PASS (no `// why:` comment echoes a count-bounded grep literal; the forbidden-import grep targets import specifiers not present in prose).
- §19 Bridge-vs-HEAD Staleness — PASS (all field shapes verified against HEAD source, not WP text alone; baseline SHA recorded).
- §20 Funding Surface Gate — N/A (no funding/payment surface).
- §21 API Catalog Update — N/A (no `apps/server` endpoint or library-function change; the function reads the existing guest endpoint).

**Result:** All applicable sections PASS; §20 and §21 explicit N/A. Lint gate satisfied.

---

## Definition of Done

- [ ] **User-visible verification (D-24026):** the change is confirmed **live on play.legendary-arena.com** — a shared `?profile=<handle>` URL unfurls into a rich preview card in a link-preview debugger / Discord, with the evidence captured; a paramless `/` load is unchanged. Green tests + merged PR are necessary but not sufficient.
- [ ] All acceptance criteria pass.
- [ ] `pnpm --filter arena-client build` exits 0.
- [ ] `pnpm --filter arena-client test` exits 0 (discovers the new suite).
- [ ] `pnpm --filter arena-client typecheck` and `typecheck:functions` exit 0.
- [ ] No forbidden imports in `functions/**` (confirmed with `Select-String`).
- [ ] `index.html`, `robots.txt`, `_redirects` unmodified (confirmed with `git diff`).
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).
- [ ] `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` `client-app` entry extended to cover `functions/` (D-24085).
- [ ] `docs/ai/STATUS.md` updated — link-preview meta now available on the public profile surface.
- [ ] `docs/ai/DECISIONS.md` updated — D-24085 landed (Active).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-300 checked off with the date.
