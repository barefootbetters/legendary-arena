# EC-375 — Header username is the profile link (Execution Checklist)

**Source:** docs/ai/work-packets/WP-346-header-username-is-profile-link.md
**Layer:** arena-client only (`Header.vue` + its test). **Lane:** Lightweight (template + test).

## Before Starting
- [ ] Fresh branch/worktree off `origin/main`, clean, synced.
- [ ] Confirm `Header.vue` signed-in branch has `auth-nav-display` (name) + `auth-nav-profile-link` ("My profile" → ?route=me) + `auth-nav-sign-out`.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values
- Merged element: `<a class="brand-nav-link auth-nav-display" href="?route=me" data-testid="auth-nav-display" title="Your profile">{{ displayLabel }}</a>`.
- Remove `auth-nav-profile-link` entirely. Keep `auth-nav-sign-out` + the signed-out / bootstrapping branches. Reserved decision: **D-24136**.

## Guardrails
- Do NOT touch `useAuthNav` / `displayLabel` / the WP-330 fallback chain — template + CSS-class only.
- Do NOT change `MyProfilePage.vue` (already defers identity/sign-out to the header, D-24118).
- Keep `.auth-nav-display` CSS (it keeps the name's primary color + weight 500; `.brand-nav-link` adds hover/focus + no-underline).
- No new endpoint / contract / server change; no cross-layer import.

## Required `// why:` Comments
- On the merged name-link (why: WP-346 — the username IS the profile link; the separate "My profile" link was redundant, both targeted ?route=me).

## Files to Produce
- `apps/arena-client/src/components/branding/Header.vue`.
- `apps/arena-client/src/components/branding/Header.test.ts`.
- Governance: `DECISIONS.md` (D-24136), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` / `test` / `build` all 0.
- [ ] `Select-String … "auth-nav-profile-link"` on `Header.vue` → no output.
- [ ] `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24136 Active) / WORK_INDEX (WP-346 `[x]`) / EC_INDEX (EC-375 Done) / mindmap node.
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (header reads Home · Cards · <name> · Sign out; name links to ?route=me; no "My profile" link).

## Common Failure Smells
- Dropping `data-testid="auth-nav-display"` (tests key on it).
- Touching `useAuthNav` (out of scope — label source is unchanged).
- Removing the signed-out `auth-nav-sign-in` branch (only the signed-in branch changes).
- Leaving the old `auth-nav-profile-link` test asserting "My profile" → it must assert the display link + absence of the standalone link.
