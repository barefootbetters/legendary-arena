# EC-101 — Viewer CI Hardening (Execution Checklist)

**Source:** Ad-hoc — no backing WP (opens the viewer-scoped EC series, 101+).
**Layer:** Cross-cutting (CI) + Registry Viewer (tooling scaffold)

**Execution Authority:**
This EC is the authoritative execution contract for the one-shot viewer
CI hardening change. Compliance is binary.

---

## Before Starting

- [ ] Root CI workflow `.github/workflows/ci.yml` exists
- [ ] `apps/registry-viewer/package.json` exists with Vue 3 + Vite + TS
- [ ] `pnpm --filter registry-viewer build` exits 0

---

## Locked Values (do not re-derive)

- Merged `on:` block:
  ```yaml
  on:
    push:
      branches: [main]
      tags: ["v*.*.*"]
    pull_request:
      branches: [main]
  ```
- Viewer `typecheck` script: `vue-tsc --noEmit`
- Viewer `lint` script: `eslint "src/**/*.{ts,vue}"`
- ESLint extends (in order): `plugin:vue/vue3-recommended`,
  `plugin:vuejs-accessibility/recommended`, `@vue/eslint-config-typescript`
- `App.vue` loading region attributes: `role="status"`,
  `aria-live="polite"`, `:aria-busy="loading"`
- CI gating steps (lint/typecheck) are **deferred** — not wired into
  `build-viewer` job by this EC.

---

## Guardrails

- No changes to `apps/registry-viewer/src/registry/**` (out of scope —
  pre-existing typecheck/lint errors live there and are deferred to a
  follow-up).
- No `--no-verify` on commit; hook must pass cleanly.
- No new steps in `.github/workflows/ci.yml` `build-viewer` job.
- No scope expansion: only the 4 items below.

---

## Required `// why:` Comments

- `.github/workflows/ci.yml` `on:` block: explain duplicate-key collision
  and why the merge preserves tag-gated publish semantics.
- `.eslintrc.cjs`: explain the a11y-regression pairing with existing
  ARIA work in the viewer.

---

## Files to Produce

- `.github/workflows/ci.yml` — **modified** — merge duplicate `on.push:` keys
- `apps/registry-viewer/package.json` — **modified** — add `typecheck`, `lint`
  scripts; add ESLint + `eslint-plugin-vuejs-accessibility` +
  `@vue/eslint-config-typescript` + TS-ESLint devDeps
- `apps/registry-viewer/.eslintrc.cjs` — **new** — Vue 3 + a11y ESLint config
- `apps/registry-viewer/src/App.vue` — **modified** — add `role="status"`,
  `aria-live="polite"`, `:aria-busy` on the loading region
- `pnpm-lock.yaml` — **modified** — reflect new devDeps

## After Completing

- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] `pnpm --filter registry-viewer typecheck` runnable (may emit
      pre-existing errors — deferred to follow-up; not a blocker here)
- [ ] `pnpm --filter registry-viewer lint` runnable (may emit pre-existing
      errors/warnings — deferred to follow-up; not a blocker here)
- [ ] `EC_INDEX.md` has EC-101 registered

## Common Failure Smells

- Commit attempting `INFRA:` prefix with `apps/` files staged → hook
  blocks. Use `EC-101:` prefix.
- Adding a `Typecheck viewer` or `Lint viewer` step to
  `.github/workflows/ci.yml` in this commit → out of scope; CI will
  fail due to pre-existing `shared.ts` errors.
