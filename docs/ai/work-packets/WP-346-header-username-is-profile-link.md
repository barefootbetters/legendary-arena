# WP-346 — The header username is the profile link (drop the separate "My profile")

**Status:** Ready
**Primary Layer:** Client (`apps/arena-client`)
**Dependencies:** WP-175 (global BrandHeader auth nav), WP-330 (header username label)
**User-Visible Surface:** play.legendary-arena.com

> The signed-in global header showed the player's name **and** a separate
> "My profile" link side by side — two affordances both pointing at `?route=me`.
> A player sees the header change (one fewer link), so the D-24026 gate applies.

---

## Session Context

WP-175 built the global `BrandHeader` auth nav; WP-330 (D-24116) made its
`auth-nav-display` element show the player's actual name. Alongside it sat a
separate `auth-nav-profile-link` reading "My profile" → `?route=me`. With the
name now shown, the header carried two profile affordances (`jeff` + `My profile`)
that both target the same route — redundant. Operator asked to merge them.

---

## Goal

The signed-in global header reads `Home · Cards · <name> · Sign out`, where the
**name itself is the link** to `?route=me`. The standalone "My profile" link is
removed. The name-link keeps the `auth-nav-display` styling (primary color,
weight 500) and gains link affordance (`brand-nav-link` hover/focus) plus a
`title="Your profile"` for accessibility.

---

## User-Visible Impact

A signed-in player sees their name in the header as before, but it is now
clickable (→ their profile), and the separate "My profile" text link is gone.
Signed-out (`Sign in`) and bootstrapping states are unchanged; "Sign out"
is unchanged.

---

## Assumes

- WP-175 / WP-330 complete: `Header.vue` renders, in the signed-in branch, an
  `auth-nav-display` element (the name), an `auth-nav-profile-link` ("My
  profile" → `?route=me`), and an `auth-nav-sign-out` button; `useAuthNav`
  supplies `displayLabel`.
- `pnpm --filter @legendary-arena/arena-client typecheck` / `test` / `build` exit 0.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — arena-client only.
- `apps/arena-client/src/components/branding/Header.vue` — the signed-in
  `<template v-else>` block + the `.auth-nav-display` / `.brand-nav-link` CSS.
- `apps/arena-client/src/components/branding/Header.test.ts` — the signed-in
  describe block (the "My profile" link test must be rewritten).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 6 (`// why:`).

---

## Non-Negotiable Constraints

- Do NOT touch `useAuthNav` / `displayLabel` — the label source is unchanged;
  this is a template + CSS-class change only.
- Keep `data-testid="auth-nav-display"` on the name element (now an `<a>`),
  keep `data-testid="auth-nav-sign-out"`. Remove `auth-nav-profile-link`.
- Keep the signed-out (`auth-nav-sign-in`) and bootstrapping branches unchanged.
- No import of `apps/server/**`, registry runtime, or `boardgame.io`.
- No new endpoint / contract / server change.

---

## Reserves

- **D-24136** — the signed-in header shows the player's name as the single
  profile affordance: the name element is an `<a href="?route=me">`
  (`auth-nav-display`), and there is NO separate "My profile" link. Guards
  against re-adding a standalone profile link beside the name.

---

## Scope (In)

### `apps/arena-client/src/components/branding/Header.vue` — modified
- In the signed-in `<template v-else>`: replace the `auth-nav-display` `<span>` +
  the `auth-nav-profile-link` `<a>` with a single `<a class="brand-nav-link
  auth-nav-display" href="?route=me" data-testid="auth-nav-display"
  title="Your profile">{{ displayLabel }}</a>`. Add a `// why:` (WP-346).
- Leave `.auth-nav-display` CSS as-is (it wins the shared props over
  `.brand-nav-link`, keeping the name's primary color + weight 500 while
  inheriting the link hover/focus + no-underline).

### `apps/arena-client/src/components/branding/Header.test.ts` — modified
- Rewrite the "renders a 'My profile' link" test to assert the display element is
  an `<a>` with `href="?route=me"` and that no `auth-nav-profile-link` exists.
  Keep the display-label and sign-out tests.

---

## Out of Scope

- No change to `useAuthNav` / `displayLabel` / the fallback chain (WP-330).
- No change to the signed-out or bootstrapping header branches.
- No change to `MyProfilePage.vue` (the page already defers identity + sign-out
  to the global header per D-24118).
- No avatar or dropdown menu in the header.

---

## Files Expected to Change

- `apps/arena-client/src/components/branding/Header.vue` — **modified**.
- `apps/arena-client/src/components/branding/Header.test.ts` — **modified**.
- `docs/ai/DECISIONS.md` (D-24136) / `WORK_INDEX.md` / `EC_INDEX.md` /
  `STATUS.md` / `05-ROADMAP-MINDMAP.md` — **modified** — governance.

No other files may be modified.

---

## Acceptance Criteria

- [ ] Signed-in header renders the name as an `<a href="?route=me">`
      (`auth-nav-display`); no `auth-nav-profile-link` element exists.
- [ ] Signed-out (`auth-nav-sign-in`) + bootstrapping + `auth-nav-sign-out`
      branches unchanged.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` / `test` / `build`
      all exit 0.
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client typecheck   # 0
pnpm --filter @legendary-arena/arena-client test        # all pass
pnpm --filter @legendary-arena/arena-client build       # 0
Select-String -Path "apps\arena-client\src\components\branding\Header.vue" -Pattern "auth-nav-profile-link"
# Expected: no output
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification (surface = play.legendary-arena.com, D-24026):**
      after deploy, the signed-in header reads `Home · Cards · <name> · Sign out`
      with the name clickable to `?route=me` and no separate "My profile" link —
      confirmed live with observable evidence.
- [ ] All acceptance criteria pass; typecheck / test / build exit 0.
- [ ] `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24136 Active), `WORK_INDEX.md`,
      `EC_INDEX.md`, mindmap updated.

---

## Lane note (D-24028)

**Lightweight-lane-eligible.** Single layer (arena-client), two files (template +
its test), no contract/endpoint/server change, no cross-layer import. The `useAuthNav`
label source is untouched.

> **Numbering note:** originally drafted as WP-344 / D-24134, but both were claimed
> on `main` by concurrent sessions while the PR was open (WP-344 = player-count
> gauntlet boards; D-24134 taken). Renumbered to WP-346 / D-24136; EC-375 was
> uncontested and retained.
