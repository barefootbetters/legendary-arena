# EC-392 — Loadout Tab: Open a LAGN From the URL (`?lagn=`) (WP-362)

**Pairs with:** WP-362 · **Reserves:** D-24154 · **Lane:** standard two-session · **Status:** executed 2026-07-12
**Layer:** Registry Viewer (`apps/registry-viewer`).

## Before Starting
- [x] Baseline `origin/main` @ `48ac707f` (WP-361 merged). WP-291 (`parseLagnLoadout` + the `applyLagnImport` setter sequence), WP-114 (`useSetupFromUrl` + one-shot auto-switch) on `main`.
- [x] Isolated worktree off `origin/main`; `pnpm install` + `pnpm --filter @legendary-arena/lagn build` + `--filter @legendary-arena/registry build` (viewer imports their dist).

## Locked Values
- **URL param:** `?lagn=<base64url(UTF-8 LAGN JSON)>`. Present-but-empty = a decode error (not absent). Max length cap `8192` (over-cap → decode error before `atob`).
- **Encoding:** `base64url(UTF-8 JSON)` — decode contract owned by WP-362; WP-363's encoder is its exact inverse.
- **Validation:** the decoder is **decode-only** (no `JSON.parse`/validate, never throws); `parseLagnLoadout` (WP-291) is the **sole** validator, called **once** in `useLagnFromUrl`.
- **Atomic apply:** `resetDraft()` + the WP-291 setters (`setScheme`/`setMastermind`/`addVillainGroup`/`addHenchmanGroup`/`addHeroGroup`/`setCount`×4/`setPlayerCount`) run **only** on `ok:true`; a decode error or invalid LAGN leaves the draft untouched.
- **Precedence:** `?lagn=` present ⇒ the WP-114 five-field setup preview is **not computed/rendered** (`useSetupFromUrl` gated on `!hasLagnParam`).
- **Auto-switch:** one-shot via `hasAppliedUrlAutoSwitch` (WP-114), fired by `hasLagnParam || setupHasUrlParams`.
- **Fail-visible:** a bad link opens the Loadout tab and shows full-sentence errors in a dismissible banner — never a blank/partial builder, never an uncaught exception.

## Guardrails
- [x] No new dependency (browser `atob` + `TextDecoder`, no `Buffer`/npm).
- [x] `lagnUrlParam.ts` pure (no Vue/network/DOM beyond `atob`), never throws; `parseLagnLoadout`/`loadoutLagnImport.ts` + the WP-114 `setupUrlParams.ts`/`useSetupFromUrl.ts` **unmodified**.
- [x] `+`→space `URLSearchParams` pitfall handled (base64url has no `+`) — documented `// why:`.
- [x] `TextDecoder('utf-8', { fatal: true })` so invalid UTF-8 → decode error (not replacement chars).

## Required Comments (`// why:`)
- [x] `atob` Latin-1 → UTF-8 step (multi-byte names) + the `+`-pitfall note.
- [x] `resetDraft` deferred to the `ok:true` path (atomic apply); the setter-sequence duplication of `LoadoutBuilder.applyLagnImport` (2nd call site, rule-of-three).
- [x] `?lagn=` precedence / suppression of the setup preview.

## Files Produced
- `apps/registry-viewer/src/lib/lagnUrlParam.ts` (pure decoder) + `lagnUrlParam.test.ts`
- `apps/registry-viewer/src/composables/useLagnFromUrl.ts` (read-once + atomic apply) + `useLagnFromUrl.test.ts`
- `apps/registry-viewer/src/App.vue` (draft-first reorder + `useLagnFromUrl` + gated setup preview + combined auto-switch + error banner + scoped CSS)

## After Completing
- [x] `pnpm --filter registry-viewer build` 0; `typecheck` (vue-tsc) 0; `test` **123 pass / 0 fail** (110 baseline + 13 new).
- [x] D-24154 → Active; WORK_INDEX WP-362 `[x]`; EC_INDEX + STATUS + `wiki/lagn-v1.md`.
- [ ] **D-24026:** APPLIES — operator-pending on deploy: open `https://cards…/?lagn=<a real Tier-1 export>` → the Loadout tab opens pre-filled; a truncated `?lagn=` → the tab opens with the decode-error banner.
