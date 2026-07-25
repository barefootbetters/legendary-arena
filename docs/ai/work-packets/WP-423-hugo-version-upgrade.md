# WP-423 — Coordinated Hugo Version Upgrade (ewiki build surface)

**Status:** Ready
**Primary Layer:** Shared Tooling / Infrastructure (CI + Render deploy + `apps/wiki-viewer` Hugo build)
**Dependencies:** none (WP-139 / D-13808 / D-13811 / D-13813 established the ewiki build; all landed)
**User-Visible Surface:** none — infrastructure (the ewiki must render the same pages and the same visible content after the bump; the payoff is version currency, local↔CI↔deploy lockstep, and a new CI page-presence guard — no user-observable difference)

> Pick exactly one. This is `none — infrastructure`: a Hugo version bump that keeps
> the rendered wiki content-equivalent. If the executor observes a rendered-**content**
> change (a missing page, changed visible text, changed structure), that is a
> regression to investigate (see §Non-Negotiable Constraints), not an accepted
> user-visible feature. Cosmetic minifier/whitespace drift across a 26-minor-version
> jump is possible and acceptable only if content is unchanged; it is judged from a
> pre-bump-vs-post-bump `public/` diff, NOT from the same-version determinism gate. (D-24026)

---

## Session Context

WP-139 (D-13808 framework = Hugo Extended; D-13811 hosting = Render Static Site; D-13813 CI-driven deterministic deploy) established the engineering wiki (`apps/wiki-viewer`), pinned Hugo at `apps/wiki-viewer/.hugo-version` and made the `wiki-viewer.yml` CI workflow the sole gated deploy trigger. This packet bumps that pin and adds a build-output page-presence guard without touching wiki content, the projection pipeline, or the determinism/JS-free gates.

---

## Goal

After this session the engineering wiki (`apps/wiki-viewer`) builds and deploys on a **single, current Hugo Extended version** pinned identically for every surface that consumes it — CI (`.github/workflows/wiki-viewer.yml`), the Render Static Site build (`render.yaml`), and local developer builds (`pnpm wiki-viewer:build` / `:dev`) — with the pin held in lockstep by the existing single-source-of-truth file `apps/wiki-viewer/.hugo-version`, and with a **new CI step that fails the build if expected pages are missing from the rendered output**, so a silent page-drop (the class of failure that took the sibling `legendary-arena-lab` site down in production) becomes a red check instead of a shipped 404. The rendered wiki **content** is unchanged — verified by the pre-bump baseline diff (§Verification Step 2), not by the determinism gate; the determinism and JS-free gates continue to pass but prove only intra-version reproducibility.

---

## User-Visible Impact

**None — infrastructure. No user-observable change; this packet's payoff is a current, drift-protected Hugo toolchain plus a regression gate (a page-presence assertion) that turns a silent sub-page drop into a failed CI build.** The wiki reader sees the same pages, same content, same styling. The value lands for operators and future sessions: the build tooling is current, the three build surfaces can never disagree on version, and a whole class of silent deploy breakage now fails loudly in CI.

---

## Assumes

- WP-139 complete. Specifically:
  - `apps/wiki-viewer/.hugo-version` exists and is the single version pin read by both CI and the Render build (currently `0.135.0`).
  - `apps/wiki-viewer/hugo.toml` exists (single-directory `content/` projection; **no** Hugo Modules, **no** `module.mounts`, **no** `files` glob, **no** top-level `locale` key — verified at draft on `origin/main`).
  - `.github/workflows/wiki-viewer.yml` reads the pin (`peaceiris/actions-hugo@v3`, `extended: true`) and runs the projection → link-check → build → **determinism check** → **JS-free check** → Render deploy-hook chain (D-13813).
  - `render.yaml` service `legendary-arena-wiki` (`autoDeploy: false`) builds by `curl`-downloading `hugo_extended_$(cat apps/wiki-viewer/.hugo-version)` — i.e. it reads the **same repo file** as CI (D-13811).
- `pnpm install --frozen-lockfile` succeeds; `pnpm wiki-viewer:build` runs locally against a locally-installed Hugo binary.
- Baseline: `origin/main` @ `eb315666` (this packet drafted against that commit).
- `docs/ai/DECISIONS.md` and `docs/ai/ARCHITECTURE.md` exist.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the **Shared Tooling** layer (`apps/wiki-viewer` is a read-only projection of `wiki/`; it imports no engine/registry/server code). This packet stays inside that layer: it touches CI config, deploy config, the version pin, and generated/reference docs only.
- `apps/wiki-viewer/.hugo-version` — the single version pin. Read it; it is the one value this packet changes.
- `apps/wiki-viewer/hugo.toml` — read entirely. Confirm the target Hugo version renders it without new deprecation warnings or errors (determinism knobs `enableGitInfo=false`, `disableKinds`, `markup.highlight.codeFences=false`/`noClasses`, `markup.goldmark` are the surfaces most likely to shift output across a version bump).
- `.github/workflows/wiki-viewer.yml` — read entirely. The new page-presence assertion is added here, after the existing **Build site** step, alongside the determinism and JS-free checks. Do **not** alter those existing gates.
- `render.yaml` (service `legendary-arena-wiki`, ~lines 243–273) — confirm the `buildCommand` reads `apps/wiki-viewer/.hugo-version` and carries **no** literal Hugo version to update.
- `docs/ai/DECISIONS.md §D-13808 / §D-13811 / §D-13813` — the framework, hosting, and CI-deploy decisions this packet extends; the new D-entry cross-references them and does not supersede them.
- `docs/ai/REFERENCE/00.6-code-style.md` — for the CI shell step (`// why:`-equivalent comments in YAML explaining the assertion; full-sentence failure messages; POSIX `sh` in `runs-on: ubuntu-latest`, not PowerShell — this is CI, not a local Windows script).
- The precedent this packet is modeled on (cite in the D-entry): sibling repo `legendary-arena/legendary-arena-lab` PRs **#13** (compat revert + CI page-assertion guard), **#14** (CI pin → 0.161.1), **#15** (modernize config after all targets ≥ floor), **#12** (Pages `_headers`). See §Context — Precedent below.

### Context — Precedent (why this packet exists)

The sibling `legendary-arena-lab` Hugo docs site (Cloudflare Pages) had a **production outage from Hugo version drift**: CI and the Pages dashboard `HUGO_VERSION` were pinned to `0.149.0` while local dev ran `0.161.1`. A config change adopting the newer module-mount `files = ['! INDEX.md']` glob and top-level `locale` (to clear deprecation warnings that only appear on Hugo ≥ 0.153/0.158) made the `files` key **unknown** on `0.149.0`, so the `wiki → content/wiki` mount was silently dropped: every sub-page 404'd in production while the section index still rendered. `hugo --minify` exited 0, CI stayed green, local builds (0.161.1) looked correct — the breakage surfaced only on the deployed site. The fix aligned CI + Pages + local on one pinned version, kept them in lockstep, and added a CI step that fails the build when expected pages are missing from the output.

**How this repo differs (discovered, not assumed — this is the spine of the WP):**

1. **One Hugo site, not several.** The only Hugo build surface in this engine monorepo is `apps/wiki-viewer` (the ewiki). Grep of `.github/workflows/**`, `render.yaml`, `hugo.toml`/config files, `package.json`, `.tool-versions`, `netlify.toml`, and `wrangler*` at draft found no second Hugo site and no `.tool-versions`/`netlify.toml`/`wrangler` Hugo build here.
2. **CI and deploy are already in lockstep.** Both `.github/workflows/wiki-viewer.yml` and `render.yaml`'s `buildCommand` read the **same** `apps/wiki-viewer/.hugo-version` file. The lab's exact CI-vs-dashboard drift **cannot** occur between CI and deploy in this repo — there is no dashboard-set `HUGO_VERSION` for the ewiki. **The only drift surface here is local dev**, whose Hugo binary is installed out-of-band and is not pinned by the repo.
3. **No Cloudflare Pages Hugo build in this repo.** The Cloudflare Pages / dashboard-`HUGO_VERSION` / `floor 0.146.0` material in `wiki/hugo-onboarding.md` documents the **marketing site** (`www.legendary-arena.com`), which lives in the **separate** repo `C:\www\legendary-arena-com` (dual-repo governance). Its Hugo/Pages upgrade is a **different repo → different WP** and is Out of Scope here (see §Out of Scope).
4. **This config cannot hit the lab's silent-mount-drop.** `apps/wiki-viewer/hugo.toml` uses a single-directory `content/` projection with **no** Hugo Modules and **no** `files`/`module.mounts` keys, so the unknown-`files`-key failure mode is structurally absent. The page-presence guard is still added as **defense-in-depth** — the ewiki's existing gates check determinism and JS-freeness, not that the expected set of pages actually rendered.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+ — any new script uses `import`/`export`, never `require()`; `node:` prefix on Node built-ins.
- Full file contents for every new or modified file in the output — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Test files (if any) use `.test.ts` — never `.test.mjs`.

**Packet-specific:**
- **Single target version, pinned identically everywhere.** The chosen Hugo Extended version is written once to `apps/wiki-viewer/.hugo-version`; CI and Render both read that file. No Hugo version literal may be introduced anywhere else (no `hugo-version:` literal in the workflow, no version literal in `render.yaml`).
- **Lockstep is the invariant.** CI, the Render `buildCommand`, and the documented local-dev pin move together via `.hugo-version`. Changing one path's effective version without the file is the exact failure mode this packet exists to prevent.
- **Rendered content is unchanged; verified by a pre-bump baseline diff, not by the determinism gate.** Before bumping the pin, capture a baseline hash + a saved copy of `apps/wiki-viewer/public/` built on `0.135.0`. After bumping, rebuild on the target and **diff against that baseline** (§Verification Step 2). The existing determinism check (two consecutive builds byte-identical) and JS-free check MUST still pass on the target version, but note they only prove **intra-version** reproducibility — they do NOT compare the two versions, so they cannot on their own prove "output unchanged." Accept only **cosmetic minifier/whitespace/attribute-ordering drift** (plausible across a 26-minor-version jump) where the visible content, page set, and structure are identical. **Any content change — a missing page, changed rendered text, altered structure — is a STOP-and-investigate**, not an accepted change; do not weaken or delete any gate to make it pass.
- **Config modernization is deferred, not bundled.** Do **not** adopt newer `files`/`locale`/module-mount syntax. This repo has one build target; there is no multi-target floor to clear, and the current `hugo.toml` needs no such syntax. Any config modernization is a separate future WP with its own compat check.
- **Extended stays Extended.** The pin is Hugo **Extended** (`extended: true` in CI; `hugo_extended_*` tarball in Render). Never drop to non-extended.
- **The target must be a real released Hugo Extended build**, confirmed against `github.com/gohugoio/hugo/releases` **before** the first edit (mirrors the WP-400/WP-401 Node discipline: verify the version exists, then edit).

**Session protocol:**
- If any config key, gate, or path is unclear, stop and ask before proceeding — never guess.

**Locked contract values (verbatim; do not re-derive):**
- **Version pin file:** `apps/wiki-viewer/.hugo-version` (single source of truth; current value `0.135.0`).
- **Recommended target:** `0.161.1` (Hugo **Extended**) — matches the sibling `legendary-arena-lab` production pin for cross-repo consistency and clears every known threshold (the `baseof.html` floor `0.146.0`, and the `0.153`/`0.158` deprecation thresholds). The executor MUST confirm `0.161.1` is a real released Extended build before editing, and MAY select a newer verified stable Extended release instead — recording the chosen pin and the reason in the D-entry and STATUS.md (the WP-400/401 pattern).
- **CI action:** `peaceiris/actions-hugo@v3`, `extended: true`, `hugo-version` sourced from the pin file (unchanged).
- **Render tarball pattern (unchanged):** `hugo_extended_$(cat apps/wiki-viewer/.hugo-version)_linux-amd64.tar.gz`.

---

## Debuggability & Diagnostics

- The upgrade is fully reproducible: given the pinned `.hugo-version`, the projected `wiki/` content, and `hugo --source apps/wiki-viewer --minify`, the output is deterministic. The existing byte-identical determinism gate proves **intra-version** reproducibility (two consecutive builds on the *same* version match); **cross-version content-equivalence** (target output vs the `0.135.0` output) is a separate check — the pre-bump baseline diff in §Verification Step 2 — because the determinism gate never compares the two versions.
- The new page-presence assertion is externally observable: it exits non-zero with a full-sentence message naming the missing expected page(s), and exits zero (printing the count of pages checked) when all are present.
- No runtime game state, `G`, or `ctx` is touched — this packet is build/deploy tooling only.
- Failures are localizable: a determinism-gate red = rendered output shifted on the new version (investigate goldmark/minify/Chroma); a page-presence red = a page the projection expected did not render.

---

## Scope (In)

### A) Bump the version pin
- **`apps/wiki-viewer/.hugo-version`** — modified:
  - Replace `0.135.0` with the confirmed target (recommended `0.161.1`), single line + trailing newline, matching the current file shape.

### B) Add the CI page-presence guard
- **`.github/workflows/wiki-viewer.yml`** — modified:
  - Add one new step in the `build` job **after** the existing **Build site** step and near the existing **Determinism check** / **Production output is JS-free** steps: **"Assert wiki pages rendered"**.
  - The step fails the build (`exit 1`) with a full-sentence message if the rendered output under `apps/wiki-viewer/public/` is missing expected pages. Two acceptable implementations (executor picks one, records which in the EC/D-entry):
    - (i) **preferred** — assert a representative **explicit set** of known page paths exist under `public/` (the home index, each top-level section index, and a sample of deep sub-pages), OR
    - (ii) assert the rendered `*.html` count under `public/` **equals** the projected source page count computed **at build time** (count the projected `.md` pages that Hugo renders to HTML in the same run, then require equality). A static `≥ floor` is **not acceptable** — it goes vacuous (a drop masked by an addition) and drifts stale-low as the wiki grows; use build-time equality with a `# why:` comment, or use variant (i).
  - A YAML `# why:` comment explains that this guard turns a silent sub-page drop into a red build (the `legendary-arena-lab` precedent), and why the chosen assertion shape was picked.
  - Do **not** modify the existing projection, link-check, build, determinism, JS-free, artifact-upload, or deploy steps.

### C) Reconcile version references in docs
- **`apps/wiki-viewer/README.md`** — modified: update every `0.135.0` reference to the new pin (grep the file; the AC below enforces zero stragglers).
- **`wiki/wiki-viewer.md`** — modified: update the `currently 0.135.0` reference.
- **`wiki/development-workflow.md`** — modified: update the Hugo `0.135.0 Extended` row to the new pin.
- **`wiki/architecture-inventory.md`** — **regenerated, not hand-edited**: `scripts/architecture-inventory.mjs` reads `.hugo-version` at runtime, so run `pnpm wiki-viewer:inventory` after the pin bump to refresh the pinned-version row(s). Commit the regenerated file only if it diffs.

### D) Governance close (see Definition of Done)
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (land the reserved D-entry), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

---

## Out of Scope

- **The marketing site (`www.legendary-arena.com`) Hugo/Cloudflare-Pages upgrade** — it lives in the **separate** repo `C:\www\legendary-arena-com` (dual-repo governance). Its dashboard-set `HUGO_VERSION`, PaperMod theme, Snipcart, and Pagefind are that repo's concern; standardizing both repos on the same Hugo version is a companion **WP in that repo**, sequenced separately. `wiki/hugo-onboarding.md` merely *documents* that site and is not edited here.
- **Config modernization** — no adoption of `files`/`locale`/`module.mounts` syntax; the current `hugo.toml` needs none and this repo has a single build target.
- **The projection pipeline** — `project-wiki.mjs`, `check-links.mjs`, and the `wiki/` content are untouched.
- **The determinism gate, the JS-free gate, the deploy-hook step** — left exactly as-is (the new guard is added beside them, not in place of them).
- **Any Render dashboard action** — the ewiki's Hugo version is repo-driven (Render reads `.hugo-version`); there is no dashboard `HUGO_VERSION` to change for this service.
- **Node version, `render.yaml` `NODE_VERSION`, `peaceiris/actions-hugo` major version** — not this packet.
- Refactors, cleanups, or "while I'm here" improvements outside the list above.

---

## Files Expected to Change

- `apps/wiki-viewer/.hugo-version` — **modified** — bump the single version pin (`0.135.0` → target).
- `.github/workflows/wiki-viewer.yml` — **modified** — add the "Assert wiki pages rendered" page-presence guard step.
- `apps/wiki-viewer/README.md` — **modified** — update every `0.135.0` reference.
- `wiki/wiki-viewer.md` — **modified** — update the `currently 0.135.0` reference.
- `wiki/development-workflow.md` — **modified** — update the Hugo pin row.
- `wiki/architecture-inventory.md` — **modified (regenerated)** — refreshed pinned-version row via `pnpm wiki-viewer:inventory`; commit only if it diffs.
- `docs/ai/STATUS.md` — **modified** — governance close.
- `docs/ai/DECISIONS.md` — **modified** — land the reserved D-entry.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-423.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — flip EC-458 → Done.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip the WP-423 node `📝` → `✅`; regenerate counts.

No other files may be modified. In particular, `render.yaml` is **not** changed (it reads the pin file and carries no version literal — confirm this at execution as a verification step, and only if a literal is unexpectedly present does it enter scope, which would be surfaced as a blocker).

---

## Acceptance Criteria

### A) Version pin
- [ ] `apps/wiki-viewer/.hugo-version` contains exactly the confirmed target version (recommended `0.161.1`) on one line with a trailing newline.
- [ ] The target was confirmed to be a real released Hugo **Extended** build on `github.com/gohugoio/hugo/releases` before the edit (evidence recorded in STATUS.md / the D-entry).
- [ ] No Hugo version literal exists anywhere other than `.hugo-version` (confirmed with `Select-String`/grep across `.github/workflows/` and `render.yaml`).

### B) CI page-presence guard
- [ ] `.github/workflows/wiki-viewer.yml` has a new **"Assert wiki pages rendered"** step in the `build` job, after **Build site**.
- [ ] The step exits non-zero with a full-sentence message when an expected page is absent from `apps/wiki-viewer/public/`, and exits zero (printing the checked count) when all expected pages are present.
- [ ] The step carries a `# why:` comment citing the silent-page-drop precedent.
- [ ] The existing **Determinism check**, **Production output is JS-free**, **Upload artifact**, and **deploy** steps are unchanged (confirmed with `git diff`).

### C) Docs reconciled
- [ ] No stale `0.135.0` Hugo reference remains in `apps/wiki-viewer/README.md`, `wiki/wiki-viewer.md`, or `wiki/development-workflow.md` (confirmed with a repo grep for `0.135.0`, allowing only unrelated non-Hugo matches).
- [ ] `wiki/architecture-inventory.md` was **regenerated** (not hand-edited) and either diffs to the new version or is confirmed byte-current.

### Build / content-equivalence (the check that matters)
- [ ] `pnpm wiki-viewer:build` exits 0 locally on the target Hugo version.
- [ ] **Cross-version content-equivalence:** a `public/` baseline was captured on `0.135.0` **before** the bump, and the post-bump `public/` diff against it shows **no content change** (same page set, same visible text, same structure). Only cosmetic minifier/whitespace/attribute-ordering drift is accepted; any content/page/structure change is a STOP. (The same-version determinism gate does NOT establish this — it never compares the two versions.)
- [ ] The CI **determinism check** still passes on the target version (two consecutive builds byte-identical — proves intra-version reproducibility).
- [ ] The CI **JS-free** check still passes.
- [ ] The new page-presence guard passes on a good build and is proven to fail on a synthetic missing-page (a negative check the executor runs once locally — deleting one expected file from `public/` before re-running the assertion — so the guard is non-vacuous).

### Scope enforcement
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`); `render.yaml` is unchanged.

---

## Verification Steps

```pwsh
# Step 0 — confirm the target is a real released Hugo Extended build BEFORE editing
#   (browser/curl to github.com/gohugoio/hugo/releases/tag/v0.161.1 — Extended asset present)

# Step 1 — capture the PRE-BUMP baseline on 0.135.0, BEFORE editing .hugo-version
#   with the local Hugo at 0.135.0: pnpm wiki-viewer:build
#   then save a manifest of public/ content: relative path + sha256 for every *.html and *.css
#   (e.g. Get-ChildItem -Recurse apps/wiki-viewer/public -Include *.html,*.css |
#         Get-FileHash -Algorithm SHA256) — keep it as the baseline to diff against.

# Step 2 — after bumping the pin (and installing the target Hugo), rebuild and DIFF vs baseline
pnpm wiki-viewer:build
# Expected: exits 0; then diff the new public/ manifest against the Step-1 baseline.
#   PASS = no content change (same page set, same visible text, same structure);
#   only cosmetic minifier/whitespace/attribute-ordering drift is acceptable.
#   Any missing page / changed rendered text / structural change = STOP and investigate.

# Step 2b — determinism (intra-version, mirrors CI): two consecutive target-version builds byte-identical
pnpm run wiki-viewer:project; hugo --source apps/wiki-viewer --minify
#   capture a hash of public/*.html + *.css, rebuild, compare — must match (CI does this)

# Step 3 — regenerate the architecture inventory (reads .hugo-version)
pnpm wiki-viewer:inventory
git diff --stat wiki/architecture-inventory.md
# Expected: the pinned-version row reflects the new version (or no diff if already current)

# Step 4 — no Hugo version literal outside the pin file
Select-String -Path ".github\workflows\wiki-viewer.yml","render.yaml" -Pattern "0\.1[0-9][0-9]\.[0-9]"
# Expected: no Hugo version literal (only the $(cat .hugo-version) reference in render.yaml)

# Step 5 — no stale 0.135.0 Hugo reference remains
Select-String -Path "apps\wiki-viewer\README.md","wiki\wiki-viewer.md","wiki\development-workflow.md" -Pattern "0\.135\.0"
# Expected: no output

# Step 6 — page-presence guard is non-vacuous (negative check, local, throwaway)
#   remove one expected file under apps/wiki-viewer/public/ and re-run the assertion
#   Expected: the assertion exits non-zero naming the missing page; then restore/rebuild

# Step 7 — scope: only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change; render.yaml absent
```

---

## Vision Alignment

**Vision clauses touched:** §17 (accessibility/i18n — N/A here beyond "the wiki keeps rendering"), and the ewiki is an internal engineering surface, not a player/monetization/scoring/replay/identity surface.
**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The wiki renders identically; no scoring, replay, RNG, identity, monetization, or determinism-of-gameplay surface is touched.
**Non-Goal proximity check:** none of NG-1..7 are crossed — this is build tooling for an internal wiki; no user-facing, paid, persuasive, or competitive surface.
**Determinism preservation:** N/A to gameplay determinism (no `G`/RNG/replay). The Hugo *build* determinism is separately guarded by the existing byte-identical CI gate, which this packet keeps green as a hard STOP condition.

---

## Lint Gate Self-Review

Run against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` (21 sections):

- **§1 Structure** — PASS. All required sections present and non-empty; `## Out of Scope` lists ≥ 2 explicit exclusions (marketing repo, config modernization, more).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session protocol + locked values; references `00.6-code-style.md`; forbids diffs/snippets.
- **§3 Assumes** — PASS. Every dependency (pin file, config shape, CI/deploy read paths, baseline SHA) listed; no implicit assumption.
- **§4 Context** — PASS. ARCHITECTURE.md §Layer Boundary + specific files/decisions cited; no vague references. (Data-shape §00.2 N/A — no card data / setup fields touched.)
- **§5 Files Expected to Change** — PASS. Every file `new`/`modified` with a one-line description; bounded (11 files, all config/docs/governance); no ambiguous "update this section" language.
- **§6 Naming** — PASS. No canonical field names touched; version pin path spelled exactly.
- **§7 Dependency Discipline** — PASS. No new npm dependency (page-guard is a POSIX-`sh` CI step; no `axios`/ORM/Jest introduced).
- **§8 Architectural Boundaries** — PASS. Stays in Shared Tooling; no engine/registry/server/PG import; no `G`/`ctx`/DB touched.
- **§9 Windows Compatibility** — PASS with note: local verification steps use `pwsh`/`Select-String`; the CI step is POSIX `sh` because `runs-on: ubuntu-latest` (correct for that surface, called out explicitly).
- **§10 Env Vars** — PASS. No new env var; `RENDER_WIKI_DEPLOY_HOOK` unchanged; no secret in output.
- **§11 Authentication** — **N/A** — this packet does not touch authentication.
- **§12 Test Quality** — **N/A** — no `node:test` produced (the guard is a CI shell assertion; the negative-check is a manual throwaway step). The determinism/page-presence gates are the executable checks.
- **§13 Commands & Verification** — PASS. `pnpm` commands, exact, with expected output.
- **§14 Acceptance Criteria** — PASS. 6–12 binary, observable, file/step-specific items; aligned to deliverables.
- **§15 Definition of Done** — PASS. STATUS.md / DECISIONS.md / WORK_INDEX.md + scope-boundary check present; §15.1 — surface declared `none — infrastructure` with STATUS.md "No user-observable change" requirement.
- **§16 Code Style** — PASS. No abstraction/HOF; CI step is a small explicit shell assertion with a `# why:` and a full-sentence failure message.
- **§17 Vision Alignment** — PASS (section present; internal-tooling, no trigger surface — asserted with clause reasoning, not silent omission).
- **§18 Prose-vs-Grep** — PASS. The grep Verification Steps target version literals (`0.135.0`, `0.1NN.N`), which appear intentionally in this WP as the values being changed; the WP is not itself under any of those greps' file scope (`.github/workflows/`, `render.yaml`, the three docs) — no false-positive risk.
- **§19 Bridge-vs-HEAD** — N/A at draft (commit-time discipline; the executor reconciles STATUS/WORK_INDEX against HEAD at govern-close).
- **§20 Funding Surface Gate** — **N/A** — docs/CI/deploy-tooling update; no navigation/registry/profile funding affordance, no "donate/support" user-visible copy, no funding-channel integration.
- **§21 API Catalog** — **N/A** — no HTTP endpoint and no `apps/server/src/**` library function is added, modified, removed, or re-statused; this packet touches CI config, deploy config, a version pin, and docs only.

**Verdict: PASS** — all 21 sections resolved (17 PASS, 4 explicit N/A with justification).

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `none — infrastructure`):** `docs/ai/STATUS.md` states plainly **"No user-observable change — infrastructure only"** (payoff named: current Hugo pin, local↔CI↔deploy lockstep, new page-presence CI guard). The rendered wiki content is confirmed unchanged by the **pre-bump baseline diff** (§Verification Step 2), not by the same-version determinism gate; a post-deploy spot-check that the live ewiki still renders its sections is the safety net the new guard automates.
- [ ] All acceptance criteria above pass.
- [ ] `pnpm wiki-viewer:build` exits 0 on the target version; the pre-bump baseline diff shows no content change; the determinism check and JS-free check pass.
- [ ] The page-presence guard passes on a good build and was proven to fail on a synthetic missing page (non-vacuous).
- [ ] No Hugo version literal outside `apps/wiki-viewer/.hugo-version` (confirmed with grep).
- [ ] No stale `0.135.0` Hugo reference remains in the three docs (confirmed with grep).
- [ ] `render.yaml` is unchanged (confirmed with `git diff`).
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — the ewiki now builds on the current pinned Hugo Extended version across all three surfaces, with a CI page-presence guard.
- [ ] `docs/ai/DECISIONS.md` updated — **D-24243** lands (confirm it is still unclaimed on any in-flight branch before writing), recording the chosen pin, the lockstep-via-`.hugo-version` principle, why no Render dashboard step exists for the ewiki, why "output unchanged" is proven by a pre-bump baseline diff rather than the same-version determinism gate, and why config modernization stays deferred (cross-references D-13808 / D-13811 / D-13813; does not supersede them). **Append note:** the earlier two-`### D-24242`-headings collision (seed-PAR vs ledger-lock) was resolved 2026-07-25 by `infra/dedup-d24242` — the ledger-lock decision is now `### D-24245`; anchor the append on the current DECISIONS frontier tail.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-423 checked off with today's date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-458 flipped to `Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-423 node flipped `📝` → `✅`; `pnpm roadmap:counts:write` run; `pnpm roadmap:counts:check` exits 0.
