# EC-110 — Validate Registry CI Path Fix (Execution Checklist)

**Source:** Ad-hoc INFRA session (no WP) — fix `Validate Registry` CI job
**Layer:** Cross-cutting (Registry build tooling + CI workflow)

**Execution Authority:**
This EC is the authoritative execution contract for the infrastructure
fix that unblocks the `CI → Build → Deploy / Validate Registry` job,
which has been failing on every PR since the script began running
under `pnpm --filter`.

---

## Before Starting

- [ ] Current branch is NOT `main` and NOT `wp-036-pr`
- [ ] `pnpm install --frozen-lockfile` succeeds in the worktree
- [ ] `pnpm registry:validate` reproduces the pre-fix failure
      (`sets.json — file not found` / `No set abbreviations found`)

---

## Locked Values (do not re-derive)

- **Default resolution anchor:** the script's own location via
  `fileURLToPath(import.meta.url)` → `dirname()` → `resolve(..., "../../..")`.
  Never `process.cwd()` as the default.
- **Env var names the script reads (do not rename):**
  `METADATA_DIR`, `SETS_DIR`, `HEALTH_OUT`, `R2_BASE_URL`, `SKIP_IMAGES`,
  `IMAGE_DELAY_MS`. The script does **not** read `CARDS_DIR` or `DATA_VERSION`.
- **Path layout (repo-root-relative):**
  `data/metadata/` (METADATA_DIR default), `data/cards/` (SETS_DIR default).
- **HEALTH_OUT stays CWD-relative** (`dist/registry-health.json`) so the
  existing `actions/upload-artifact` path `packages/registry/dist/registry-health.json`
  keeps working under `pnpm --filter`.

---

## Guardrails

- Env var overrides must still win over the new script-relative defaults
- Do not modify `packages/registry/src/schema.ts` (schema is authoritative)
- Do not add `--no-verify` bypasses for commit hygiene hooks
- Do not touch `upload-r2.ts` — `DATA_VERSION` lives there, not in validate

---

## Required `// why:` Comments

- `packages/registry/scripts/validate.ts` near the `REPO_ROOT` constant:
  explain that CWD-relative defaults broke under `pnpm --filter` which
  changes CWD to `packages/registry/`

---

## Files to Produce

- `packages/registry/scripts/validate.ts` — **modified** — defaults resolve
  via `import.meta.url`; imports `dirname` + `fileURLToPath`
- `.github/workflows/ci.yml` — **modified** — remove the bogus
  `CARDS_DIR` / `DATA_VERSION` env block from the validate step
- `docs/ai/execution-checklists/EC-110-validate-registry-ci-path-fix.checklist.md` — **new** — this file
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — register EC-110

## After Completing

- [ ] `pnpm registry:validate` exits 0 from repo root
- [ ] `cd packages/registry && pnpm validate` exits 0 (simulates CI filter CWD)
- [ ] `pnpm -r build` succeeds
- [ ] `pnpm -r --if-present test` shows 0 failures (baseline preserved)
- [ ] CI `Validate Registry` check turns green on the pushed branch

## Common Failure Smells

- `SETS_JSON_MISSING` / `No set abbreviations found` → defaults still
  CWD-relative (the fix was reverted or never applied)
- `SET_SCHEMA_INVALID` → data errors were previously masked by the path
  bug; address in a separate data-repair commit, not by loosening schema
