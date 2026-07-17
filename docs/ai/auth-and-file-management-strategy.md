# Legendary Arena — Auth & File-Management Strategy (Grounded Review)

> **Status:** Draft strategy brief, **not** a governed artifact (not a WP, EC,
> or DECISION). It exists so a future Claude Code session has a reality-checked
> starting point. Relocate / commit / discard freely.
>
> **Date:** 2026-06-29. Every "current state" claim below is grounded in the
> actual codebase with file paths — not generic best-practice. Verify paths
> still hold before acting; code moves.

---

## Why this brief exists

A voice conversation produced a draft "Authentication and File Management
Strategy." That draft was written **without looking at the repo** and gave
generic advice. Some of it is already built, some contradicts a locked
decision, and some duplicates a different working subsystem. This brief keeps
the good ideas, corrects the rest, and points at the two things actually worth
building.

**Status legend:**

| Mark | Meaning |
|---|---|
| ✅ | Already implemented — no work needed |
| ⚠️ | Partially implemented — a real gap remains |
| ❌ | Not implemented — net-new feature decision |
| 🚫 | Contradicts a locked decision / wrong for this stack |

---

## 1. Current state (ground truth)

### Authentication

- **Broker: Hanko.** The app stores **no passwords** — no password/hash/salt
  columns, no bcrypt/argon2. Hanko owns all credential storage; the server
  trusts Hanko's RS256-signed JWTs.
  Proof: `data/migrations/004_create_players_table.sql`,
  `apps/server/src/auth/hanko/hankoVerifier.logic.ts`.
- **Providers are locked to three values:**
  ```ts
  export type AuthProvider = 'email' | 'google' | 'discord';
  export const AUTH_PROVIDERS = ['email', 'google', 'discord'] as const;
  ```
  Proof: `apps/server/src/identity/identity.types.ts`. The Hanko method →
  provider map confirms native email (password/passkey/otp/totp/security_key)
  plus federated `ext:google` and `ext:discord`:
  `apps/server/src/auth/hanko/hankoVerifier.types.ts`
  (`HANKO_IDP_TO_AUTH_PROVIDER`).
- **Facebook is not supported anywhere.** Adding it means changing the
  `auth_provider` enum, which is guarded by the F-1 replacement-safety gate
  (the literal `'hanko'` and any new provider value are governance-controlled).
- **Login UI is Hanko's web component.** `LoginPage.vue` mounts
  `<hanko-auth>`; the buttons a user sees (email, Google, Discord, passkey)
  are configured in the **Hanko tenant dashboard**, not in repo code.
  Proof: `apps/arena-client/src/pages/LoginPage.vue`,
  `apps/arena-client/src/auth/hankoClient.ts` (sole broker-import file).

### Email capture for marketing

- **Email is captured automatically on first sign-in** from the Hanko JWT
  claim and written to `legendary.players.email` (UNIQUE).
  Proof: `apps/server/src/auth/accountResolver.logic.ts`,
  `apps/server/src/auth/accountProvisioning.logic.ts` (WP-174;
  `INSERT ... ON CONFLICT DO NOTHING` + re-SELECT for race-safety).
- **But the no-email path is a hard reject, not a graceful prompt.** If a
  provider returns no email claim, provisioning is skipped → resolver returns
  `null` → orchestrator answers `unknown_account` (**401**). The user simply
  can't get in. There is **no** "you signed in with Discord, now add an email"
  linking screen.
- **Duplicate email from a different provider is rejected** (`duplicate_email`)
  — account linking is deliberately not implemented.
- **Brevo marketing is not wired.** It's a not-started roadmap item
  (`au-email-capture`, target 2026-07-15) in
  `apps/dashboard/src/data/buildRoadmap.ts`. Emails sit in Postgres; nothing
  pushes them to a list or sends a welcome series yet.

### Profile data model

- **Immutable `AccountId`** = UUID v4 via `node:crypto.randomUUID()`, stored as
  `legendary.players.ext_id`. Generated once at signup; never changes.
  `display_name` is **mutable**; `handle` is **immutable after first claim**
  (global-unique, WP-101). Renaming a display name breaks nothing — all file
  paths key off the immutable `AccountId`.
  Proof: `apps/server/src/identity/identity.logic.ts`, `handle.logic.ts`.
- **Owner profile already has social links** — a 6-provider closed set:
  `twitter, github, twitch, discord, youtube, website`.
  Proof: `data/migrations/009_create_player_profiles_and_links.sql`,
  `apps/server/src/profile/ownerProfile.types.ts`.
  > Note: this Discord **link** (a display field) is separate from Discord
  > **OAuth login**. Two different Discord integrations.
- **Absent** from every profile table: "most recent game played," a
  playlist/series, blog comments, ranked-highlight / scoreboard fields. These
  are net-new.

### File storage (R2) and the database split

- **The metadata-in-Postgres / binaries-in-R2 split already exists and is the
  right architecture.** Proof: `docs/02-ARCHITECTURE.md` (R2 = static asset
  host), avatar pipeline below.
- **Avatars already upload to R2.** `POST /api/me/avatar` — server-proxied
  multipart (`@koa/multer`, 5 MB cap), **magic-byte** MIME check
  (jpeg/png/webp, not header-trust), EXIF strip + 256×256 WebP via `sharp`,
  1-upload-per-60s rate limit, R2 key `avatars/{accountId}.webp`, CDN
  `https://images.legendary-arena.com/avatars/...`, DB write to
  `player_profiles.avatar_url`, and a **compensating R2 delete** if the DB
  write fails. Proof: `apps/server/src/profile/avatarUpload.{logic,routes,types}.ts`.
  > This is a **server-proxied** upload, not the "signed-URL direct-to-R2"
  > pattern the dictated doc described. Server-proxied is the better default
  > for small validated files — you keep validation server-side.
- **R2 key conventions are documented.** Card images:
  `{setAbbr}/{setAbbr}-{ribbon}-{slug}.webp` (`wiki/r2-image-naming-convention.md`).
  Avatars: `avatars/{accountId}.webp`. Plus `themes/` and `metadata/` prefixes.

### LAGN and replays

- **LAGN already exists as a published, versioned spec** —
  `@legendary-arena/lagn@1.0.0` (`packages/lagn-spec/`), Zod-validated, 3
  tiers (Tier 1 setup = required; Tier 2 card catalog + Tier 3 replay log =
  optional). It is **Legendary Arena Game Notation**, a JSON format.
- **There is no LAGN file-upload feature today.** Loadouts get into a match by
  paste-or-load-in-browser → **client-side** parse (`parseLoadoutJson.ts`,
  `lagnLoadout.ts`) → submit the 9-field composition in a plain POST body. No
  multipart, no signed URL, no per-player LAGN store.
- **Replays are already persisted — but content-addressed in Postgres, not
  per-player files in R2.** `legendary.replay_blobs` keyed by SHA-256
  (`apps/server/src/replay/replay.logic.ts`, migration 006). The client
  `ReplayFileLoader.vue` is a **local** browser-File-API inspector, not an
  upload. So "where do finished games go" is already solved a different way
  than the dictated doc assumed.

---

## 2. Verdict on the dictated document

| Dictated recommendation | Verdict | Reality |
|---|---|---|
| Email + password as primary login | ⚠️ | Email login exists **via Hanko**; you don't own/hash passwords. The intent (own the email relationship) is right; the mechanism is Hanko, not your own password table. |
| "Hash password and store server-side" | 🚫 | You store no passwords. Hanko does. Delete this section. |
| Offer Discord + Google OAuth | ✅ | Both wired via Hanko federated OAuth. Just confirm they're enabled in the **Hanko tenant dashboard**. |
| Offer Facebook | 🚫 | Not in the locked `auth_provider` enum; would need a governance change. Your own instinct (Discord > Facebook for this audience) is correct anyway. |
| Capture email even for OAuth signups | ⚠️ | Captured when the provider returns it. **Gap:** no-email path hard-rejects (401) instead of prompting to link an email. **This is the one real auth enhancement.** |
| Require email link before dashboard access | ⚠️ | Effectively enforced by fail-closed today, but with zero UX — the user just can't log in. A graceful linking screen is net-new. |
| Account linking (same email, 2 providers) | ❌ | Deliberately not implemented (`duplicate_email` reject). Decide if you want it. |
| Marketing automation (Brevo welcome series) | ❌ | Not wired. Roadmap `au-email-capture`, not-started. **Your actual marketing gap.** |
| Profile pictures → R2 | ✅ | Already done, hardened, at `avatars/{accountId}.webp`. |
| Signed-URL direct-to-R2 upload pattern | ⚠️ | Works, but you already have a **better** server-proxied pattern (avatar). Reuse it for any new upload rather than introducing a second pattern. |
| Per-player LAGN file store in R2 `/players/{uuid}/...` | ❌ | Net-new. And note finished-game replays already persist in Postgres `replay_blobs` — reconcile the two before building a parallel store. |
| DB metadata + R2 binaries split | ✅ | Already the architecture. |
| Profile: Discord/social links | ✅ | 6-provider link set already in the schema. |
| Profile: most-recent-game / playlist / blog comments / ranked highlights | ❌ | All absent. Each is a net-new feature (blog comments need a comment system that doesn't exist yet). |
| Immutable UUID, mutable name | ✅ | Exactly how it works (`ext_id` UUID + mutable `display_name`). |
| "Virus-scan uploaded files" | ⚠️ | For small JSON, schema/magic-byte validation is the real control; AV scanning of JSON is mostly theater. Keep the avatar-style validation; skip the AV ceremony unless you accept arbitrary binaries. |

---

## 3. Recommended login strategy (grounded)

You already have the stack you'd want. The recommendation is **keep it**, plus
one enhancement:

1. **Keep Hanko as the broker** with native email + Google + Discord. Confirm
   Google and Discord are toggled on in the Hanko tenant dashboard, and that
   the Discord OAuth app requests the `email` scope so Hanko receives it.
2. **Treat a captured, verified email as mandatory** — it already is, by
   fail-closed behavior. The business reason is sound and standard: the email
   is your direct channel for tournaments, releases, and newsletters.
3. **Build the one missing piece: a graceful email-link step** (see §4).

No Facebook. No self-managed passwords. Those parts of the dictated doc are
dead ends for this stack.

---

## 4. The real auth gap — graceful email linking (candidate WP)

**Problem:** today, a federated sign-in with no email claim is a silent 401.
That's both a conversion leak (a willing player bounces) and a support
mystery ("I can't log in with Discord").

**Proposed behavior:**
- When Hanko authenticates a user but the JWT carries no email, **provision a
  pending account** (or hold the session) and route the client to a
  "Add your email to finish signup" screen.
- Collect + verify the email (Hanko can drive the verification), then complete
  provisioning.
- Decide the **account-linking** policy at the same time: if the entered email
  already exists under another provider, either (a) link the two providers to
  one account, or (b) keep rejecting with a clear message. Today it's (b)
  silently; pick deliberately.

**Touchpoints:** `accountResolver.logic.ts` / `accountProvisioning.logic.ts`
(server), `LoginPage.vue` / auth store (client). This is a genuine WP with a
DECISION attached (the linking policy).

---

## 5. The real marketing gap — wire Brevo (candidate WP)

Emails are captured but go nowhere. To actually market:
- On successful provisioning, enqueue the new email to a Brevo list
  (double-opt-in if you want clean deliverability).
- Trigger the welcome series; thereafter use the list for tournament
  announcements.
- This is the not-started `au-email-capture` roadmap item — it's the
  highest-leverage revenue-adjacent piece here, not the login UI.

---

## 6. LAGN file management — if you want it (net-new)

The dictated "file manager + signed URLs + DELETE + per-player R2 folders"
is a **new subsystem**, not a config check. Before building, reconcile it with
what exists:

- **Two distinct things:** (a) **system-generated replays** of matches —
  already persisted in `replay_blobs`; (b) **user-uploaded LAGN files** — a
  player's personal library of setups/replays they bring in. Only (b) is
  missing. Don't rebuild (a).
- **Reuse the avatar pattern, not a new one.** Server-proxied multipart →
  validate with the existing `@legendary-arena/lagn` Zod schema (you already
  have authoritative validation!) → store to R2 under a per-account key like
  `lagn/{accountId}/{fileId}.lagn.json` (mirrors `avatars/{accountId}.webp`) →
  record metadata (filename, size, sha256, uploadedAt) in a new
  `legendary.lagn_files` table. Delete = DB row delete + R2 `deleteObject`
  (the avatar code already shows the compensating-delete shape).
- **Gameplay read path:** the engine/replay viewer fetches by the R2 URL
  resolved from the DB row — same metadata-in-Postgres / blob-in-R2 split you
  already use. LAGN is content the engine can already parse via the spec
  package.
- **No FTP.** Correct call. FTP isn't part of this architecture and shouldn't
  be.

If you want this, it's 1–2 WPs (server upload+list+delete; client file
manager) and a DECISION on storage layout + quotas.

---

## 7. Profile expansion items (net-new, ranked by dependency)

- **Most-recent-game / ranked highlights** — feasible; you have match results
  and badges. Needs a new read that joins recent matches + rankings to the
  profile projection. Medium.
- **Game playlist ("games I want to play next")** — new table + UI. Small/medium.
- **Blog comments on profile** — **blocked**: there is no comment system. The
  marketing blog (`www`) has posts but no comments. This is a whole subsystem
  (auth'd comments, moderation, storage) before it can surface on a profile.

---

## 8. Suggested order of operations

1. **(Config, 10 min)** Confirm Discord + Google are enabled in the Hanko
   tenant dashboard and Discord requests the `email` scope.
2. **(WP) Brevo wiring** — turn captured emails into an actual marketing
   channel. Highest revenue leverage.
3. **(WP + DECISION) Graceful email-linking flow** — close the silent-401 gap
   and decide the account-linking policy.
4. **(WP, optional) LAGN file manager** — only if players actually need to
   bring their own LAGN libraries; reuse the avatar pattern.
5. **(Later) Profile expansion** — recent game / playlist first; blog comments
   only after a comment system exists.

---

## Source map (for the executing session)

- Auth providers: `apps/server/src/identity/identity.types.ts`,
  `apps/server/src/auth/hanko/hankoVerifier.types.ts`
- Email capture / provisioning: `apps/server/src/auth/accountResolver.logic.ts`,
  `accountProvisioning.logic.ts` (WP-174)
- Client sign-in: `apps/arena-client/src/pages/LoginPage.vue`,
  `apps/arena-client/src/auth/hankoClient.ts`, `src/stores/auth.ts`
- Profile model: `apps/server/src/profile/{profile,ownerProfile}.types.ts`,
  `data/migrations/009_create_player_profiles_and_links.sql`
- Avatar/R2: `apps/server/src/profile/avatarUpload.{logic,routes,types}.ts`,
  `wiki/r2-image-naming-convention.md`
- LAGN: `packages/lagn-spec/`, `apps/arena-client/src/lobby/{parseLoadoutJson,lagnLoadout}.ts`
- Replays: `apps/server/src/replay/replay.logic.ts`,
  `data/migrations/006_create_replay_blobs_table.sql`
- Marketing roadmap: `apps/dashboard/src/data/buildRoadmap.ts` (`au-email-capture`)
- Wiki overview page: `wiki/profile-login.md`
