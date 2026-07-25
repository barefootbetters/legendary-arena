# EC-458 — Coordinated Hugo Version Upgrade (ewiki build surface) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-423-hugo-version-upgrade.md
**Layer:** Shared Tooling / Infrastructure (CI + Render deploy + `apps/wiki-viewer` Hugo build)

## Before Starting
- [ ] WP-139 landed: `apps/wiki-viewer/.hugo-version` (currently `0.135.0`), `hugo.toml`, `wiki-viewer.yml`, and the `legendary-arena-wiki` Render service all exist on `main`.
- [ ] `public/` baseline captured on `0.135.0` (path+sha256 for every `*.html`/`*.css`) BEFORE editing the pin — the cross-version content-equivalence check depends on it.
- [ ] `D-24243` confirmed unclaimed on any in-flight branch before landing it; anchor the `DECISIONS.md` append on the current frontier tail (the earlier duplicate `D-24242` heading was resolved 2026-07-25 by `infra/dedup-d24242` — the ledger-lock decision is now `### D-24245`).
- [ ] `hugo.toml` confirmed to use a single-directory projection — no Hugo Modules, no `module.mounts`, no `files` glob, no top-level `locale` (the lab silent-mount-drop is structurally absent here).
- [ ] Target version confirmed a **real released Hugo Extended** build on `github.com/gohugoio/hugo/releases` BEFORE any edit (recommended `0.161.1`).
- [ ] `pnpm install --frozen-lockfile` succeeds; a local Hugo Extended binary at the target version is installed for local build/determinism verification.
- [ ] Exact target file set (this list == Files to Produce) locked; any modification outside it is a FAIL, surfaced as a blocker before touching the file.

## Locked Values (do not re-derive)
- Version pin file: `apps/wiki-viewer/.hugo-version` — the ONLY place a Hugo version may appear.
- Recommended target: `0.161.1` (Hugo **Extended**) — matches sibling `legendary-arena-lab` prod pin; clears the `0.146.0` `baseof.html` floor and the `0.153`/`0.158` deprecation thresholds. A newer verified Extended stable is permitted if recorded in the D-entry + STATUS.md.
- CI action (unchanged): `peaceiris/actions-hugo@v3`, `extended: true`, `hugo-version` from the pin file.
- Render tarball (unchanged): `hugo_extended_$(cat apps/wiki-viewer/.hugo-version)_linux-amd64.tar.gz`.
- New CI step name: **"Assert wiki pages rendered"**, placed after **Build site**.

## Guardrails
- **Pin lives in exactly one file.** No `hugo-version:` literal in the workflow; no version literal in `render.yaml` (it reads `$(cat .hugo-version)`) — verify, don't touch.
- **Rendered content unchanged — proven by a pre-bump baseline diff, NOT the determinism gate.** Capture a `public/` baseline (path+sha256 for every `*.html`/`*.css`) on `0.135.0` BEFORE editing the pin; after the bump, diff against it. PASS = same page set, same visible text, same structure; accept ONLY cosmetic minifier/whitespace/attribute-ordering drift. Any missing page / changed rendered text / structural change = **STOP and investigate**. The same-version determinism check must still pass but only proves intra-version reproducibility — it never compares the two versions, so it cannot prove "output unchanged" on its own. Do NOT weaken/delete any gate to make it pass.
- **Extended stays Extended;** never drop to non-extended.
- **Do not modify** the projection, link-check, build, determinism, JS-free, artifact-upload, or deploy steps — the new guard is added BESIDE them.
- **No config modernization** — do not adopt `files`/`locale`/`module.mounts` syntax (single build target; deferred to a separate WP).
- **`render.yaml` is out of scope** — confirm it's unchanged; a stray literal there is a blocker to surface, not a silent edit.
- **CI step is POSIX `sh`** (`runs-on: ubuntu-latest`), NOT PowerShell; local verification steps are `pwsh`.
- The page-presence guard MUST be non-vacuous: proven to FAIL for a synthetic missing page (delete one expected `public/` file, re-run, confirm non-zero exit + naming) before it is trusted. Prefer the explicit-known-page-set assertion; if a count is used, require **equality** against the build-time projected `.md` page count, never a static `≥ floor` (a floor goes vacuous when a drop is masked by an addition and drifts stale-low as the wiki grows).

## Required `// why:` Comments
- `.github/workflows/wiki-viewer.yml` new step: a `# why:` comment stating the guard turns a silent sub-page drop into a red build (the `legendary-arena-lab` precedent) and why the chosen assertion shape (explicit-set vs count-floor) was picked.
- If a count-floor is used: a `# why:` on the magic floor value.

## Files to Produce
- `apps/wiki-viewer/.hugo-version` — **modified** — `0.135.0` → target.
- `.github/workflows/wiki-viewer.yml` — **modified** — add "Assert wiki pages rendered" guard step after Build site.
- `apps/wiki-viewer/README.md` — **modified** — update every `0.135.0` ref (grep-enforced).
- `wiki/wiki-viewer.md` — **modified** — update `currently 0.135.0` ref.
- `wiki/development-workflow.md` — **modified** — update the Hugo pin row.
- `wiki/architecture-inventory.md` — **modified (regenerated)** — `pnpm wiki-viewer:inventory`; commit only if it diffs.
- `docs/ai/STATUS.md` — **modified** — governance close ("No user-observable change — infrastructure only").
- `docs/ai/DECISIONS.md` — **modified** — land D-24243.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-423.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — flip EC-458 → Done.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-423 node `📝` → `✅`; regenerate counts.

## After Completing
- [ ] `pnpm wiki-viewer:build` exits 0 on the target version; the pre-bump baseline diff shows no content change; determinism + JS-free checks pass.
- [ ] Page-presence guard passes on a good build AND was proven to fail on a synthetic missing page.
- [ ] `Select-String` finds no Hugo version literal outside `.hugo-version`, and no stale `0.135.0` in the three docs.
- [ ] `git diff` confirms `render.yaml` unchanged and no out-of-allowlist files touched.
- [ ] Live-on-surface: surface is `none — infrastructure` → STATUS.md states "No user-observable change — infrastructure only"; a post-deploy spot-check that the live ewiki still renders its sections is the safety net (the CI guard automates it).
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24243 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-458 → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- Pre-bump baseline diff shows changes → goldmark/Chroma/minifier output shifted on the new Hugo. Cosmetic whitespace/attribute-ordering drift with identical content is acceptable; a missing page / changed visible text / structural change is a STOP. The same-version determinism gate can stay green while this diff is non-empty — that is expected, they measure different things; never treat green determinism as proof of "unchanged".
- A version literal reappears in `render.yaml`/the workflow → the pin's single-source-of-truth invariant is broken; the pin must stay in `.hugo-version` only.
- The page-presence guard passes even with a page deleted → it's vacuous (bad glob/path or checking the wrong directory); fix until the negative check fails.
- `wiki/architecture-inventory.md` hand-edited instead of regenerated → it's a generated artifact; run `pnpm wiki-viewer:inventory`.
