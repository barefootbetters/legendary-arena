# WP-099 — Auth Provider Selection (Governance)

**Status:** Draft (drafted 2026-04-25; lint-gate self-review complete — see §Lint Self-Review below; pre-flight + copilot-check applied 2026-04-27 against `01.4-pre-flight-invocation.md` and `01.7-copilot-check.md` — see §Pre-Flight & Copilot Check Review Log at foot)
**Primary Layer:** Governance / Policy (no code; no engine, registry, server, or app touch)
**Dependencies:** WP-052 (identity model exists; provider-agnostic envelope established)

---

## Session Context

WP-052 (executed 2026-04-25, commit `fd769f1`) established the
project's identity model: `AccountId` (server-generated UUID v4),
`PlayerAccount` with `authProvider: 'email' | 'google' | 'discord'`
and `authProviderId` (the external IdP subject), and the
`legendary.players` table with idempotent migration. The model was
deliberately **provider-agnostic** — the server records *who* the user
is, not *which vendor* issued the proof. WP-101 (drafted 2026-04-25)
extended this with handle uniqueness while preserving full
provider-agnosticism via caller-injected `requireAuthenticatedSession`.

This packet closes the remaining provider question: **selects Hanko as
the authentication broker** for Legendary Arena, locks the integration
boundary so Hanko remains invisible to the data model and the engine,
and amends `00.3-prompt-lint-checklist.md §7` (which currently bans
Auth0 / Clerk / Passport) to permit Hanko under the explicit boundary
constraints recorded here. The packet does no code work; it produces
governance artifacts that future implementation WPs (WP-112 session
validation — renumbered from "WP-100" per D-10002; a future
"WP-1XX External Authentication Integration — Hanko" wiring
packet) cite as their authority.

No engine, registry, server, app, or test code is touched. No new npm
dependencies. No Vue / TypeScript / SQL files modified. The Hanko SDK
packages will be installed by the future implementation WP, not here.

---

## Goal

After this session, Legendary Arena has a **governance-anchored
authentication-provider decision** with the following explicit
boundaries locked in `docs/ai/DECISIONS.md` and the lint checklist:

- **Hanko is selected** as the authentication broker (open-source,
  self-hostable, passkey-first, OIDC-compliant). Auth0, Clerk, and
  Passport remain forbidden under `00.3 §7`.
- **Hanko is invisible to the data model.** The
  `legendary.players.auth_provider` column continues to record only
  `'email' | 'google' | 'discord'` (the WP-052 enum is unchanged).
  Hanko-mediated users appear in the database under whichever
  federated identity Hanko exposes via OIDC claims — Google
  federation → `'google'`, Discord federation → `'discord'`,
  email-and-passkey direct → `'email'`. No `'hanko'` value is added
  anywhere.
- **The server is the identity authority; Hanko is the broker.**
  `AccountId` remains server-generated via `node:crypto.randomUUID()`
  per WP-052 D-5201. Hanko's `sub` becomes `authProviderId` (one of
  the existing recorded values), not a primary identity.
- **Replacement-safe.** The integration must be confined to the
  session-validation middleware layer. Replacing Hanko with another
  OIDC-compliant broker (or rolling our own with `jsonwebtoken`)
  must require zero migrations of `legendary.players` data and zero
  changes to the engine, registry, or game-state surface.
- **Guests are never gated.** Hanko adoption does not change the
  guest policy from WP-052 / `13-REPLAYS-REFERENCE.md`. Core
  gameplay and immediate local replay export remain unconditional.
- **`00.3 §7` is amended** to add an explicit Hanko carve-out with
  the boundary conditions enumerated here. The amendment is
  surgical: Auth0 / Clerk / Passport remain forbidden; the carve-out
  is for Hanko specifically, not for managed-auth providers in
  general.
- **`D-9901` through `D-9905`** anchor the decision in
  `DECISIONS.md`. Future amendments to the auth model require new
  `D-NNNN` entries citing these.

This WP itself contains no Hanko SDK installation, no middleware code,
no environment configuration, and no UI changes. Implementation is
deferred to WP-112 (session token validation — the
`requireAuthenticatedSession` provider; renumbered from "WP-100"
per D-10002) and a future Hanko-wiring WP.

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`. This WP
> touches identity, authentication, and the platform's posture toward
> third-party services; a Vision Alignment block is mandatory.

**Vision clauses touched:** §3 (Player Trust & Fairness), §11
(Stateless Client Philosophy), §14 (Explicit Decisions, No Silent
Drift), §15 (Built for Contributors), Non-Goals NG-1, NG-3, NG-6.

**Conflict assertion:** **No conflict: this WP preserves all touched
clauses.**

- **§3 Player Trust & Fairness.** Selecting a passkey-first,
  passwordless authentication broker *strengthens* trust by
  removing the password-storage / phishing / credential-stuffing
  vulnerability class entirely. Authentication failure modes are
  observable (Hanko's flow API is server-authoritative); identity
  is auditable via the `legendary.players` row, which records the
  federated IdP — not the broker — keeping the audit trail
  vendor-agnostic.
- **§11 Stateless Client Philosophy.** The client carries Hanko's
  short-lived session credential only. Authoritative identity
  (`AccountId`, replay ownership) lives server-side. Refresh,
  reconnect, and multi-device flows are unaffected.
- **§14 Explicit Decisions, No Silent Drift.** This WP exists
  precisely to make the auth-broker selection explicit rather than
  letting it emerge from "whatever the implementation WP author
  picks." `D-9901..D-9905` are the explicit decision record.
- **§15 Built for Contributors.** Hanko is open-source and
  self-hostable; the project does not surrender architectural
  sovereignty to a closed vendor. Contributors can run the full
  stack locally. The boundary constraint (§"Replacement-safe" in
  the Goal) keeps the door open for future contributors to swap
  brokers without rewriting identity.

**Non-Goal proximity check:** Confirmed clear.

- **NG-1 (pay-to-win):** Authentication never gates gameplay,
  scoring, or competitive surfaces. Guest play remains
  unconditional. No conflict.
- **NG-3 (content withheld):** Authentication unlocks account-only
  conveniences (server-side replay storage, leaderboard
  submission, profile pages); it does not gate any content,
  hero, scenario, or rule. No conflict.
- **NG-6 (dark patterns):** Hanko's Flow API is
  server-authoritative; login progresses only when the backend
  allows. There are no FOMO timers, manipulative re-prompts, or
  upsell surfaces in the authentication flow. No conflict.
- **NG-2, NG-4, NG-5, NG-7:** N/A — this WP introduces no
  randomized purchases, energy systems, advertising, or
  apologetic monetization.

**Determinism preservation:** **N/A.** This WP touches no engine,
registry, scoring, replay, RNG, or simulation surface. Authentication
is a server-layer access concern, never an input to deterministic
gameplay state. Replay determinism (Vision §22, §24) is unaffected by
construction.

---

## Assumes

- WP-052 complete. Specifically:
  - `apps/server/src/identity/identity.types.ts` exports
    `AccountId`, `PlayerAccount`, `authProvider: 'email' | 'google' |
    'discord'`, `authProviderId`, `Result<T>`, `IdentityErrorCode`
  - `apps/server/src/identity/identity.logic.ts` exports
    `createPlayerAccount`, `findPlayerByEmail`,
    `findPlayerByAccountId`
  - `data/migrations/004_create_players_table.sql` is applied with
    the current `auth_provider` and `auth_provider_id` columns
  - D-5201 (server `AccountId` rename), D-5202 (identity directory
    classification), D-5203 (identity persistence taxonomy) recorded
- `docs/01-VISION.md` exists. Specifically:
  - §3 (Player Trust & Fairness), §11 (Stateless Client Philosophy),
    §14 (Explicit Decisions), §15 (Built for Contributors), and the
    Non-Goals block (NG-1..NG-7) are present
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §7` exists and
  currently states: "No Passport / Auth0 / Clerk — use jsonwebtoken
  or credentials-only" (verified at draft time)
- `docs/ai/DECISIONS.md` exists; `D-9901` through `D-9905` are not
  yet present (verified by `grep -nE "^## D-990[1-5] " docs/ai/DECISIONS.md`
  returning zero matches). The file currently contains entries through
  the WP-100 cluster (D-10001..D-10014, drafted chronologically before
  D-9701 from WP-097) and D-9701 (WP-097, the most recent governance
  decision, sitting immediately before `## Final Note`). The highest
  numeric ID is **not** the same as the last entry in the file —
  decisions are appended in **chronological** order at the foot,
  immediately before `## Final Note`, regardless of numeric value
  (precedent: D-9701 inserted after D-10014 at WP-097 close, commit
  `c5344cc`)
- `docs/ai/work-packets/WORK_INDEX.md` exists; the auth/identity
  area near WP-052 is the appropriate insertion point
- `.claude/rules/work-packets.md` is the governing rules file for
  WP discipline
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` is the lint
  contract this WP must satisfy
- The user's design intent is to adopt Hanko as the authentication
  broker; this WP records that decision rather than re-litigating it

If any of the above is false, this packet is **BLOCKED** and must not
proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §"Document override hierarchy"` —
  establishes that VISION.md is authority #3; WPs are authority #6.
  This WP must not override anything in VISION.md; it adds a
  subordinate auth-provider policy that VISION.md does not currently
  address.
- `docs/01-VISION.md §3, §11, §14, §15` — vision clauses touched by
  this decision (see Vision Alignment block above).
- `docs/01-VISION.md §"Non-Goals: Exploitative Monetization"`
  (NG-1..NG-7) — the seven monetization non-goals; this WP must not
  introduce a path that crosses any of them.
- `docs/ai/work-packets/WP-052-player-identity-replay-ownership.md
  §Scope (In) A` — read the `PlayerAccount` shape and the
  `'email' | 'google' | 'discord'` enum verbatim. This WP locks in
  that those values are unchanged by the Hanko adoption.
- `docs/ai/work-packets/WP-052-player-identity-replay-ownership.md
  §Non-Negotiable Constraints "AccountId mapping"` — read the
  server-side UUID generation contract. This WP locks that Hanko
  does not affect this contract: `AccountId` is still server-side,
  not Hanko's `sub`.
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §7` — read the
  current forbidden-package wording verbatim. The amendment in this
  WP is surgical; existing bans on Auth0 / Clerk / Passport remain.
- `docs/ai/DECISIONS.md` (scan recent entries D-9601, D-9201, D-9001
  through D-9005) — to see the format and granularity of recent
  governance decisions; D-9901..D-9905 must match that format.
- `.claude/rules/work-packets.md` — single packet per session,
  dependency discipline, no historical edits, status updated only
  on full DoD completion, conventions are locked.
- `.claude/rules/architecture.md "Authority Hierarchy"` — confirms
  VISION.md (#3) wins over WPs (#6) on conflict.
- `docs/ai/work-packets/WP-097-tournament-funding-policy.md` — read
  for the governance-WP precedent: how a doc-only governance packet
  structures Scope, Files Expected to Change, and the §Authorized
  Future Surfaces block. This WP mirrors WP-097's structural shape.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents required for every new or modified file. No
  diffs, no snippets, no "show only the changed section."
- ESM only, Node v22+ (N/A here — no code; constraint preserved for
  template completeness).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` —
  applies to any markdown / governance file authored under this
  packet (no clever phrasing, no abbreviations, no inline jargon).

**Packet-specific:**
- **Read-only against `packages/` and `apps/`.** No engine,
  registry, server, app, or test files may be touched. Verified by
  `git diff --name-only packages/ apps/` returning empty after each
  commit in this packet.
- **No modification to `docs/01-VISION.md`.** The Vision is
  authority #3; this WP is authority #6 and may not edit it. If a
  conflict surfaces during execution, **STOP** and escalate.
- **No modification to `docs/ai/ARCHITECTURE.md` or
  `.claude/rules/*.md`.** This WP introduces no new layer rule,
  no new architectural constraint, and no new authority.
- **No modification to WP-052 contract files.**
  `apps/server/src/identity/identity.types.ts`,
  `apps/server/src/identity/identity.logic.ts`,
  `data/migrations/004_create_players_table.sql`, and
  `data/migrations/005_create_replay_ownership_table.sql` are
  locked. If the implementation WP needs to extend the
  `authProvider` enum, that is a separate code WP, not WP-099.
  WP-099 explicitly locks that no such extension is required.
- **No new npm dependencies.** The `@teamhanko/*` SDK packages will
  be installed by the future implementation WP, not here. WP-099
  produces no `package.json` changes.
- **No environment configuration.** No `.env` keys, no
  `render.yaml` modifications, no Hanko tenant URLs, no API keys.
  Configuration is the implementation WP's deliverable.
- **Hanko is invisible at rest.** The
  `legendary.players.auth_provider` column records only `'email'`,
  `'google'`, or `'discord'` — never `'hanko'`. Hanko's role is
  confined to the session-validation middleware layer (introduced
  by WP-112 — renumbered from "WP-100" per D-10002 — and the
  future Hanko-wiring WP).
- **`AccountId` remains server-generated.** Hanko's `sub` is the
  `authProviderId` value, never the `AccountId`. Per WP-052 D-5201,
  `AccountId` is generated via `node:crypto.randomUUID()` by the
  server.
- **Replacement-safety is structural, not aspirational.** Any
  future implementation WP touching Hanko must keep all
  Hanko-specific code in a single named module
  (path locked at implementation time; see §Authorized Future
  Surfaces §B). `apps/server/src/identity/`, the engine, the
  registry, and any game-state surface MUST remain free of
  Hanko-specific imports.
- **Carve-out is Hanko-specific, not category-wide.** The
  `00.3 §7` amendment names Hanko explicitly. It does not
  reopen the door for Auth0, Clerk, Passport, or any future
  managed-credential provider. Each new vendor would require its
  own WP-NNN governance packet.
- **No silent enum extension.** `authProvider` may not be extended
  to include `'hanko'`, `'oidc'`, or any other broker-level value
  by any future WP without a new `D-NNNN` decision and an explicit
  WP that justifies the extension. WP-099 locks the existing
  three-value enum.
- **Guest policy is sacred.** Hanko-mediated authentication
  unlocks account-only conveniences (server-side replay
  persistence, leaderboard submission, profile pages). It NEVER
  gates core gameplay, immediate local replay export, or any
  feature available to guests under WP-052 / `13-REPLAYS-REFERENCE.md`.

**Session protocol:**
- If during execution any phrase, term, or boundary in the auth
  policy cannot be reconciled with WP-052 contracts or Vision
  §3 / §11 / §14, **STOP** and ask the human before proceeding.
  Never silently paraphrase or "smooth over" a conflict — log it
  explicitly.
- If the user objects to the Hanko selection or any of the
  D-9901..D-9905 framing, the WP must be re-drafted; do not ship
  ambiguous or partially-locked governance.

**Locked contract values:**
- Selected provider: `Hanko` (open-source backend AGPL; frontend MIT;
  self-hostable; OIDC-compliant)
- Forbidden providers (preserved from `00.3 §7`): `Auth0`, `Clerk`,
  `Passport`, plus password-based credential storage in general
- `authProvider` enum (preserved from WP-052, unchanged):
  `'email' | 'google' | 'discord'`
- `AccountId` source (preserved from WP-052 D-5201):
  `node:crypto.randomUUID()`, server-side
- Decision IDs: `D-9901`, `D-9902`, `D-9903`, `D-9904`, `D-9905`
- Lint-checklist amendment target:
  `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §7`
- Hanko-implementation module path (locked here for the future
  implementation WP to honor; not created in WP-099):
  `apps/server/src/auth/hanko/` (siblings to `identity/`, not
  inside it — keeps Hanko-specific code physically separable from
  the provider-agnostic identity layer)

---

## Authorized Future Surfaces (Policy)

**Definition — auth broker.** A third-party service that issues a
proof-of-authentication artifact (typically an OIDC ID token or
session JWT) for the server to validate. Hanko is the project's
**sole approved auth broker** as of `D-9901`.

**Definition — identity authority.** The system of record for *who a
user is* across sessions, devices, and time. The identity authority
for Legendary Arena is the project itself, materialized as
`legendary.players` rows keyed on server-generated `AccountId`. The
identity authority is **never** delegated to a broker.

This section is **policy-only**. WP-099 implements none of the
surfaces described here. Each surface, when built, ships as its own
scoped WP that cites WP-099 and the relevant `D-99NN`. The policy
below exists so those future WPs land against a fixed semantic
contract rather than re-litigating "should we put Hanko here?" at
execution time.

### A) Session Validation Middleware (Future WP-112)

A future WP-112 — "Session Token Validation" (renumbered from
"WP-100" per D-10002 because the WP-100 slot was reassigned to
Interactive Gameplay Surface on 2026-04-26) — implements the
caller-injected `requireAuthenticatedSession(req): Promise<AccountId>`
contract referenced by WP-101 and any future authenticated endpoint.

Constraints (locked here; WP-112 must honor):

- WP-112 MAY validate either Hanko-issued tokens directly OR a
  server-issued downstream session token bound to an `AccountId`.
  The choice is WP-112's design decision; either path satisfies the
  contract.
- WP-112 MUST resolve the verified caller to an `AccountId`. The
  intermediate Hanko `sub` may appear in middleware-local variables
  but must never leak into the `Result<T>` returned to handlers.
- WP-112 MAY introduce one or more cryptographic-key fetch paths
  (Hanko JWKS endpoint, etc.). Those paths MUST be cached in-memory
  with a documented refresh policy and MUST NOT involve `G`, `ctx`,
  or any engine surface.
- WP-112 MUST NOT modify WP-052 contract files.

### B) Hanko Wiring Module (Future Implementation WP)

A future implementation WP — provisional name "WP-1XX External
Authentication Integration (Hanko)" — installs the Hanko SDK,
configures Hanko-specific environment variables, and wires the
broker's claims into a `PlayerAccount` row.

Constraints (locked here; the future WP must honor):

- All Hanko-specific code MUST live under `apps/server/src/auth/hanko/`
  (path locked by `D-9904`). This includes the SDK initialization,
  JWT validation against Hanko's JWKS, claim extraction, and any
  Hanko-specific error mapping.
- `apps/server/src/identity/` MUST remain Hanko-free. No
  Hanko-specific import, type, or string literal may appear there.
  This is the structural enforcement of replacement-safety.
- The federated-IdP claim from Hanko's token (Google / Discord /
  email) is the value written to `legendary.players.auth_provider`.
  The `'hanko'` string MUST NOT appear as an `auth_provider` value
  in any database row, test fixture, or seed.
- `authProviderId` is set to Hanko's `sub` claim (a stable,
  per-user identifier within the Hanko tenant). This satisfies
  WP-052's "external IdP subject identifier" definition.
- The Hanko tenant URL, API key, and JWKS URL are configured via
  environment variables only — never hardcoded. The future WP's
  `## Files Expected to Change` will include `render.yaml` and an
  `.env.example` update.
- New npm dependencies (Hanko SDK packages) MUST be declared in
  the future WP's `## Files Expected to Change` with exact version
  pins. Per `00.3 §7`, the WP body MUST justify each new dependency.
- The implementation WP MUST satisfy the §C Future-Auth Gate below.

### C) Future-Auth Gate (Pre-Merge Checklist for Downstream WPs)

Future WPs that implement any auth-broker integration (Hanko or any
later replacement) MUST satisfy every item below before merging.
Failures are hard governance stops. Escalation is via a Vision
amendment or a new `D-NNNN` carve-out — never via "we'll fix it
post-merge" or silent exceptions.

**§C is a verification gate only.** All normative constraints are
defined in §A through §B above and the Non-Negotiable Constraints
section. F-1 through F-7 introduce no new policy; they reference
existing constraints for auditability. If a future amendment
changes a constraint, it amends §A–§B — the gate items are
re-derived from the new policy, never edited in isolation.

**Applicability is declared, never inferred.** Every server-touching
or auth-touching WP MUST contain an explicit applicability line:
either *"This WP touches §A / §B and runs the gate below."* or
*"This WP does not touch any §A / §B surface — gate is N/A: <one-line
justification>."* The N/A path requires the justification line; a
bare "N/A" is a §17 lint FAIL.

**Gate items — all MUST PASS before merge.**

- [ ] **F-1 No `'hanko'` enum value.** `auth_provider` rows, fixtures,
  seeds, and TypeScript union types contain only `'email'`, `'google'`,
  or `'discord'`. Per Non-Negotiable Constraints "Hanko is invisible
  at rest" and "No silent enum extension".
- [ ] **F-2 Hanko code is contained.** All Hanko-specific imports,
  types, and string literals live under `apps/server/src/auth/hanko/`.
  `apps/server/src/identity/`, `packages/game-engine/`,
  `packages/registry/`, `apps/registry-viewer/`, and
  `apps/arena-client/` are Hanko-free. Verified with
  `grep -rE "@teamhanko|hanko\.io" apps/server/src/identity packages apps/registry-viewer apps/arena-client`
  returning zero matches.
- [ ] **F-3 `AccountId` is server-generated.** The implementation
  produces `AccountId` via `node:crypto.randomUUID()` — never via
  Hanko's `sub`, never via a UUID derived from Hanko data. Per
  WP-052 D-5201 and WP-099 D-9902.
- [ ] **F-4 Guests still play.** No request path that did not require
  authentication before the WP requires it after. Verified by an
  integration smoke test that completes a full game without ever
  invoking the Hanko middleware.
- [ ] **F-5 No package-list expansion beyond Hanko.** The WP adds
  `@teamhanko/*` packages only. Auth0, Clerk, Passport, bcrypt,
  argon2, scrypt, or any password-hashing library MUST NOT appear
  in `package.json`. Per `00.3 §7` post-amendment.
- [ ] **F-6 Replacement-safety smoke check.** A documented
  thought-experiment in the WP body: "If we removed Hanko tomorrow,
  what would change?" The answer must be confined to
  `apps/server/src/auth/hanko/`, `render.yaml`, and `.env.example`.
  Anything beyond that is a layering violation.
- [ ] **F-7 Vision Alignment.** §17 Vision Alignment block lists
  §3, §11, §14, NG-1, NG-3, NG-6 with no-conflict assertion and
  N/A determinism line.

**Audit discipline.** A WP that implements any §A or §B surface
MUST map each implemented surface to its F-1 through F-7 disposition,
either inside its `## Vision Alignment` block or as a dedicated
`## Future-Auth Gate` subsection. Silent omission is a §17 lint
FAIL.

**No silent exceptions.** Any deviation from F-1 through F-7
requires a successor WP that either (a) amends WP-099 with a new
`D-NNNN` entry, or (b) records the deviation as a deliberate
carve-out in `docs/ai/DECISIONS.md` with explicit rationale, scope
limits, and a sunset condition. Implementing an auth surface that
doesn't satisfy this gate is a direct violation of `D-9901..D-9905`
and is grounds for revert.

---

## Scope (In)

### A) `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — modified

Surgical amendment to **§7 Dependency Discipline**, "Forbidden
packages are explicitly excluded where relevant" subsection.

Required modifications:

- **Leave the existing four forbidden-package bullets unchanged
  byte-for-byte.** They live at lines 165–168 of
  `00.3-prompt-lint-checklist.md` (verified at draft time) and use
  inline backticks around package names (`` `axios` ``, `` `node-fetch` ``,
  `` `pg` ``, `` `node:test` ``, `` `jsonwebtoken` ``). Do **not**
  re-paste them in the diff and do **not** strip or alter the
  backtick formatting. The §7 amendment is an *append*, not a
  rewrite.
- **Append a new bullet** immediately after the existing
  `No Passport / Auth0 / Clerk — use \`jsonwebtoken\` or credentials-only`
  line. The new bullet uses the same checklist-bullet pattern
  (`- [ ]`) and the same indentation as its siblings:
  - `Hanko is permitted as an authentication broker only —
    governed by docs/ai/work-packets/WP-099-auth-provider-selection.md
    and D-9901..D-9905. Hanko-specific code MUST live under
    apps/server/src/auth/hanko/; the broker MUST NOT appear as an
    auth_provider value in legendary.players; AccountId MUST remain
    server-generated. Auth0 / Clerk / Passport remain forbidden.`
- **No other lint-checklist sections modified.** Existing §1–§6,
  §8–§19 wording is byte-identical. The byte-identity check at
  AC-1 covers this.

### B) `docs/ai/DECISIONS.md` — modified

Add five new decision entries as a contiguous block in numeric order
(`D-9901` → `D-9902` → `D-9903` → `D-9904` → `D-9905`), inserted
**immediately before `## Final Note`** at the foot of the file. This
matches the WP-097 precedent (commit `c5344cc`) — D-9701 was inserted
in the same slot at WP-097 close, even though numerically it sits
below D-10001..D-10014 which were drafted earlier in chronological
time. The placement convention is **chronological at the foot, before
the Final Note**, not strict numeric ordering. Each entry follows the
format used by recent decisions (D-9701, D-9601).

- **D-9901 — Hanko selected as the project's authentication broker.**
  Body: rationale (passkey-first, open-source, self-hostable, OIDC
  compliance, no password storage); explicit non-selection of Auth0
  / Clerk / Passport; reference to the structural-vs-aspirational
  replacement-safety constraint; status `Active`; amendment rule
  (new `D-NNNN` + WP-099 amendment required).
- **D-9902 — `AccountId` remains server-generated; Hanko's `sub`
  is `authProviderId` only.** Body: per WP-052 D-5201, `AccountId`
  is server-side UUID v4; Hanko `sub` becomes `authProviderId` in
  the existing schema; this preserves replacement-safety because
  swapping Hanko for another broker requires no `legendary.players`
  data migration.
- **D-9903 — `00.3 §7` amended to permit Hanko (carve-out, not
  category-wide).** Body: cites the surgical amendment in §A above;
  notes that Auth0 / Clerk / Passport remain forbidden; future
  vendors require their own WP-NNN governance packet.
- **D-9904 — Hanko-specific code is confined to
  `apps/server/src/auth/hanko/`.** Body: structural
  replacement-safety; `apps/server/src/identity/`,
  `packages/game-engine/`, and all UI packages remain Hanko-free;
  enforced by the §C Future-Auth Gate F-2 verification.
- **D-9905 — Guest policy preserved; Hanko never gates gameplay.**
  Body: explicit reaffirmation that core gameplay, immediate local
  replay export, and any feature available to guests under WP-052 /
  `13-REPLAYS-REFERENCE.md` remains unchanged. Hanko unlocks
  account-only conveniences only.

Each entry cites WP-099 and the relevant cross-references
(WP-052 D-5201, `13-REPLAYS-REFERENCE.md` §Account and Guest Policy,
the §C Future-Auth Gate).

### C) `docs/ai/STATUS.md` — modified

Add a `### WP-099 / EC-099 Executed — Auth Provider Selection
({YYYY-MM-DD}, EC-099)` block at the top of `## Current State`,
mirroring the format used by WP-097 / WP-096 / WP-092 / WP-091
STATUS blocks. Required content:

- One-paragraph summary of what is now governed (Hanko selected as
  broker; identity model unchanged; `00.3 §7` amended;
  `D-9901..D-9905` anchor the decision).
- Scope statement: docs-only; `git diff --name-only packages/ apps/`
  returns empty.
- Vision alignment: §3, §11, §14, NG-1, NG-3, NG-6 (no conflict).
- 01.5 NOT INVOKED — N/A; engine untouched.

### D) `docs/ai/work-packets/WORK_INDEX.md` — modified

- Add a `WP-099` row in the auth/identity area (immediately after
  the WP-052 row), following the conventions established by
  WP-052 / WP-097 / WP-098 entries. Required content: dependencies
  (WP-052), Vision clauses touched (§3, §11, §14, NG-1, NG-3, NG-6),
  link to `WP-099-auth-provider-selection.md`, link to
  `EC-099-auth-provider-selection.checklist.md`, and references to
  `D-9901..D-9905`.
- Flip `[ ]` to `[x]` on completion with today's date and the SPEC
  commit hash.
- EC reference: EC-099 is the authoritative execution checklist for
  this WP. The WORK_INDEX row links to it; the EC_INDEX row is
  flipped from `Draft` to `Done {YYYY-MM-DD}` in the same SPEC
  commit.

### E) `docs/ai/execution-checklists/EC_INDEX.md` — modified

Add an EC-099 row in the appropriate section, status `Draft` at
draft time, flipped `Draft` → `Done {YYYY-MM-DD}` at execution close.

---

## Out of Scope

- **No code changes.** No `.ts`, `.vue`, `.mjs`, `.sql`, `.json`
  files modified. No new npm dependencies installed.
- **No middleware implementation.** Session token validation is
  WP-112 (renumbered from "WP-100" per D-10002). Hanko SDK wiring
  is the future implementation WP.
- **No Hanko tenant configuration.** No environment variables, no
  `render.yaml` modifications, no JWKS URL hardcoded, no API keys.
- **No engine, registry, server, app, Vision, Architecture, or
  rules files modified.** Only the four governance docs listed in
  §Files Expected to Change, plus the lint checklist and EC_INDEX.
- **No modification to WP-052 contract files.**
  `auth_provider` enum stays at `'email' | 'google' | 'discord'`.
  Migrations 004 and 005 remain unchanged.
- **No `'hanko'` enum value.** Per Non-Negotiable Constraints and
  D-9902, the broker is invisible at rest.
- **No leaderboard, scoring, replay, or PAR changes.** WP-027,
  WP-048, WP-049, WP-050, WP-051, WP-052, WP-053, WP-054 contracts
  are untouched.
- **No UI changes.** Login screens, account-creation flows, and
  the `/account` surface are future work — likely the
  Hanko-implementation WP, possibly a separate UI WP.
- **No alternative-vendor evaluation.** The decision is locked in
  D-9901; revisiting requires a new `D-NNNN` and a successor WP.
- **No legal, compliance, or GDPR-specific language.** Hanko's
  data-processing posture is a future operational concern; this WP
  defines architectural boundaries only.
- **No category-wide auth-vendor permission.** The §7 carve-out is
  Hanko-specific. Other managed-credential providers remain
  forbidden.
- Refactors, cleanups, or "while I'm here" improvements are **out of
  scope** unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — **modified** —
  surgical §7 amendment appending the Hanko carve-out bullet
  immediately after the existing Auth0 / Clerk / Passport line; all
  other §7 content and all other sections byte-identical.
- `docs/ai/DECISIONS.md` — **modified** — add `D-9901` through
  `D-9905` entries; format matches recent decisions (D-9601 etc.).
- `docs/ai/STATUS.md` — **modified** — add
  `### WP-099 / EC-099 Executed` block at top of `## Current State`.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — add
  `WP-099` row in the auth/identity area; flip `[ ]` → `[x]` on
  completion.
- `docs/ai/work-packets/WP-099-auth-provider-selection.md` —
  **new** — this file (created at draft time, before execution).
- `docs/ai/execution-checklists/EC-099-auth-provider-selection.checklist.md` —
  **new** — execution checklist (created at draft time, before
  execution; follows the EC-097 / EC-TEMPLATE governance-EC pattern).
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — add
  EC-099 row at draft time; flip `Draft` → `Done {YYYY-MM-DD}` at
  execution close.

No other files may be modified. Verified by `git diff --name-only`
after each commit.

---

## Acceptance Criteria

### AC-1 — Lint-checklist amendment

- [ ] `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §7` contains
      the new Hanko carve-out bullet immediately after the existing
      `No Passport / Auth0 / Clerk` line.
- [ ] The carve-out bullet names Hanko explicitly, references
      WP-099 and `D-9901..D-9905`, and reaffirms the
      Auth0 / Clerk / Passport ban.
- [ ] All other §7 content (axios, ORMs, Jest/Vitest/Mocha,
      Passport / Auth0 / Clerk lines) is byte-identical to the
      pre-execution state.
- [ ] All other §1–§19 sections are byte-identical (verified with
      a checksum or character-level diff against the pre-execution
      copy).

### AC-2 — DECISIONS anchors

- [ ] `docs/ai/DECISIONS.md` contains five new entries: `D-9901`,
      `D-9902`, `D-9903`, `D-9904`, `D-9905` — in that order, as a
      contiguous block, inserted **immediately before `## Final Note`**
      (per the WP-097 / D-9701 placement precedent at commit `c5344cc`).
- [ ] Each entry follows the format used by `D-9701` / `D-9601`
      (header `## D-99NN — Title`, body, status, amendment rule).
- [ ] `D-9901` cites WP-099 and the structural replacement-safety
      constraint.
- [ ] `D-9902` cites WP-052 D-5201 and explicitly states
      `AccountId` is server-generated.
- [ ] `D-9903` cites the `00.3 §7` amendment landed under AC-1.
- [ ] `D-9904` names `apps/server/src/auth/hanko/` as the locked
      module path.
- [ ] `D-9905` cites `13-REPLAYS-REFERENCE.md §Account and Guest
      Policy` and reaffirms guests-never-gated.
- [ ] Each entry's status is `Active` and the amendment rule is
      stated (new `D-NNNN` + WP citation required).

### AC-3 — STATUS and WORK_INDEX governance close

- [ ] `docs/ai/STATUS.md` has a new `### WP-099 / EC-099 Executed`
      block at the top of `## Current State` matching the format of
      WP-097 / WP-096.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has a `[x] WP-099` row
      in the auth/identity area with today's date, the SPEC commit
      hash, dependencies (WP-052), Vision clauses touched, and
      links to `WP-099-auth-provider-selection.md`,
      `EC-099-auth-provider-selection.checklist.md`, and
      `D-9901..D-9905`.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has an EC-099 row,
      status flipped `Draft` → `Done {YYYY-MM-DD}` at execution close.

### AC-4 — Scope enforcement (no engine touch)

- [ ] `git diff --name-only packages/ apps/` returns empty.
- [ ] `git diff --name-only docs/01-VISION.md docs/ai/ARCHITECTURE.md`
      returns empty (Vision and Architecture untouched).
- [ ] `git diff --name-only .claude/` returns empty (rules
      untouched).
- [ ] `git diff --name-only data/migrations/004_create_players_table.sql data/migrations/005_create_replay_ownership_table.sql`
      returns empty (WP-052 migrations untouched).
- [ ] No new files outside `## Files Expected to Change`.

### AC-5 — Vision Alignment self-compliance

- [ ] WP-099 contains a `## Vision Alignment` block citing §3,
      §11, §14, §15, NG-1, NG-3, NG-6 with an explicit no-conflict
      assertion and an N/A determinism line.
- [ ] D-9905's "guest policy preserved" body matches WP-099's
      Non-Negotiable Constraints "Guest policy is sacred" item
      semantically (paraphrasing permitted; the no-gating
      invariant is byte-identical).

### AC-6 — Lint gate

- [ ] WP-099 passes `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`
      self-review (see §Lint Self-Review at the foot of this WP).
      Sections N/A: §11 (auth — N/A because this WP defines auth
      policy without implementing it), §12 (tests), §16 (code style
      — markdown only).

### AC-7 — Authorized Future Surfaces (Policy Authorization Present)

- [ ] WP-099 contains an `## Authorized Future Surfaces (Policy)`
      section listing two authorized surface classes: §A Session
      Validation Middleware and §B Hanko Wiring Module.
- [ ] §A Session Validation Middleware names WP-112 as the
      implementing packet (renumbered from "WP-100" per D-10002)
      and locks the `requireAuthenticatedSession` contract
      referenced by WP-101.
- [ ] §B Hanko Wiring Module locks `apps/server/src/auth/hanko/`
      as the module path (per `D-9904`).
- [ ] §B explicitly forbids Hanko-specific imports in
      `apps/server/src/identity/`, `packages/game-engine/`,
      `packages/registry/`, and any UI app.
- [ ] §B locks that the federated-IdP claim (Google / Discord /
      email) is the value written to `legendary.players.auth_provider`
      — never `'hanko'`.

### AC-8 — Future-Auth Gate (Verification Layer Present)

- [ ] §C Future-Auth Gate is present, contains exactly seven gate
      items labelled F-1 through F-7, and includes the **Audit
      discipline**, **Applicability is declared**, and **No silent
      exceptions** sub-blocks.
- [ ] §C opens with a `**§C is a verification gate only.**` framing
      paragraph stating that F-1..F-7 introduce no new policy and
      only reference §A–§B.
- [ ] §C F-N items each end with a "Per §A/§B bullet N" or
      "Per WP-052 D-NNNN" or "Per WP-099 D-NNNN" citation rather
      than re-deriving constraints.
- [ ] §C "Applicability is declared, never inferred" clause
      appears **before** the gate items (F-1..F-7) so that WP
      authors classify applicability before encountering the
      checklist.
- [ ] §C "No silent exceptions" clause names `D-9901..D-9905` as
      the violated authority.

---

## Verification Steps

```bash
# Step 1 — confirm the §7 amendment landed (Hanko bullet present, prior bullets preserved)
grep -nE "^  - \[ \] No Passport / Auth0 / Clerk — use \`jsonwebtoken\` or credentials-only$" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: exactly one match — the existing ban, byte-identical INCLUDING the
# inline backticks around `jsonwebtoken`. A match without backticks indicates
# the §7 amendment silently rewrote the existing line — STOP and revert.

grep -cE "^  - \[ \] No \`(axios|node-fetch)\`|^  - \[ \] No ORMs — use \`pg\` only|^  - \[ \] No Jest / Vitest / Mocha — use \`node:test\` only" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: 3 — the three sibling forbidden-package bullets are also
# byte-preserved with their inline backticks intact.

grep -nE "Hanko is permitted as an authentication broker only" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: exactly one match (the new carve-out bullet)

grep -nE "WP-099|D-9901" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: at least two matches inside the §7 carve-out bullet

# Step 2 — confirm the five DECISIONS anchors landed
grep -nE "^## D-990[1-5] " docs/ai/DECISIONS.md
# Expected: exactly five matches (D-9901 through D-9905)

# Step 3 — confirm D-9901 names Hanko and the structural replacement-safety constraint
grep -A 30 "^## D-9901 " docs/ai/DECISIONS.md | grep -E "Hanko|replacement-safety|apps/server/src/auth/hanko"
# Expected: at least three matches

# Step 4 — confirm D-9902 names WP-052 D-5201 and AccountId server-generation
grep -A 20 "^## D-9902 " docs/ai/DECISIONS.md | grep -E "D-5201|node:crypto|randomUUID"
# Expected: at least two matches

# Step 5 — confirm D-9903 names the §7 amendment
grep -A 20 "^## D-9903 " docs/ai/DECISIONS.md | grep -E "00\.3.*§7|prompt-lint-checklist"
# Expected: at least one match

# Step 6 — confirm D-9904 names the locked module path
grep -A 20 "^## D-9904 " docs/ai/DECISIONS.md | grep -E "apps/server/src/auth/hanko"
# Expected: at least one match

# Step 7 — confirm D-9905 cites guest policy
grep -A 20 "^## D-9905 " docs/ai/DECISIONS.md | grep -E "13-REPLAYS-REFERENCE|guest|never gates"
# Expected: at least two matches

# Step 8 — confirm STATUS block landed
grep -nE "WP-099 / EC-099 Executed" docs/ai/STATUS.md
# Expected: exactly one match in the Current State section

# Step 9 — confirm WORK_INDEX row landed
grep -nE "\[x\] WP-099" docs/ai/work-packets/WORK_INDEX.md
# Expected: exactly one match

# Step 10 — confirm EC_INDEX row landed and is flipped to Done
grep -nE "EC-099" docs/ai/execution-checklists/EC_INDEX.md
# Expected: exactly one match with `Done {YYYY-MM-DD}` status

# Step 11 — confirm scope (no engine, no app, no Vision, no architecture, no rules, no migrations)
git diff --name-only packages/ apps/ docs/01-VISION.md docs/ai/ARCHITECTURE.md .claude/ data/migrations/
# Expected: no output

# Step 12 — confirm 'hanko' is NOT introduced as an auth_provider value
grep -rE "'hanko'|\"hanko\"" apps/ packages/ data/migrations/
# Expected: no output (the string 'hanko' must not appear as a code-level enum value)

# Step 13 — confirm only the seven expected files changed
git diff --name-only
# Expected: exactly the seven files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in
> `## Verification Steps` before checking any item below. Reading
> the doc is not sufficient — run the commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §7` contains
      the Hanko carve-out bullet, all prior bans preserved
- [ ] `docs/ai/DECISIONS.md` contains `D-9901` through `D-9905` in
      the locked format
- [ ] `docs/ai/STATUS.md` has a `### WP-099 / EC-099 Executed`
      block at the top of `## Current State`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has a `[x] WP-099` row
      with today's date and the SPEC commit hash
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-099 row
      flipped to `Done {YYYY-MM-DD}`
- [ ] No engine, registry, server, app, Vision, Architecture,
      rules, or migration files modified (verified with
      `git diff --name-only` against the four scope guards)
- [ ] No string `'hanko'` appears as an auth_provider enum value in
      any code or fixture (verified with `grep -rE "'hanko'|\"hanko\""
      apps/ packages/ data/migrations/`)
- [ ] No files outside `## Files Expected to Change` were modified

---

## Lint Self-Review (00.3 §1–§19)

> Performed at draft time; re-confirm before execution.

| § | Item | Status |
|---|---|---|
| §1 | All required WP sections present | PASS |
| §1 | `## Out of Scope` non-empty (≥2 items) | PASS (12 items listed) |
| §2 | Non-Negotiable Constraints with engine-wide + packet-specific + session protocol + locked values | PASS |
| §2 | Constraints reference `00.6-code-style.md` | PASS (Engine-wide bullet 3) |
| §2 | Full file contents required, no diffs/snippets | PASS |
| §3 | `## Assumes` lists prior state and dependency files | PASS |
| §4 | `## Context (Read First)` is specific (no "read the docs") | PASS |
| §4 | Architectural sections cited where relevant | PASS (ARCHITECTURE.md authority hierarchy + .claude/rules/architecture.md) |
| §4 | DECISIONS.md scan instruction included | PASS (Context bullet 8) |
| §5 | Every file is `new` or `modified` with one-line description | PASS |
| §5 | No ambiguous "update this section" language | PASS |
| §6 | Naming consistency (no abbreviations, canonical paths) | PASS |
| §7 | No new npm dependencies | PASS (doc-only; the WP is itself the §7 amendment) |
| §8 | Layer boundaries respected (no engine import; no Vision edit; no WP-052 contract edit) | PASS |
| §9 | Cross-platform commands (verification uses `bash`/`grep`/`git diff`; no shell-specific constructs) | PASS |
| §10 | Env vars: N/A — no code; explicitly out of scope | N/A |
| §11 | Auth: this WP DEFINES auth policy without implementing it; the §7 amendment is itself the auth governance | PASS (governance-mode) |
| §12 | Tests: N/A — doc-only WP, no test deliverables | N/A |
| §13 | Verification commands are exact with expected output | PASS |
| §14 | Acceptance criteria are 6–12 binary observable items grouped by sub-task | PASS (8 AC groups, ~38 items total — exceeds 12 because of the §C gate sub-checks across AC-7 and AC-8; each is binary) |
| §15 | DoD includes STATUS.md + DECISIONS.md + WORK_INDEX.md + scope-boundary check | PASS |
| §16 | Code style: N/A — markdown deliverables; no executable code | N/A (markdown) |
| §17 | Vision Alignment block present with cited clauses + no-conflict assertion + determinism line | PASS |
| §18 | Prose-vs-grep discipline: forbidden tokens not enumerated verbatim near literal-string greps | PASS (the `'hanko'` grep at Step 12 targets a forbidden literal; the prose nearby uses prose framing rather than the literal token) |
| §19 | Bridge-vs-HEAD staleness: N/A — this WP is not a repo-state-summarizing artifact | N/A |

**Final Gate verdict:** PASS at draft time. Re-confirm before
execution by re-running the §1–§19 walkthrough against the
post-amendment state of `00.3-prompt-lint-checklist.md`.

---

## Pre-Flight & Copilot Check Review Log

> Applied 2026-04-27 against
> `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` and
> `docs/ai/REFERENCE/01.7-copilot-check.md`. This block captures
> the verdict in the WP body so future readers do not need to
> reconstruct it from WORK_INDEX or commit history.

### 01.4 Pre-Flight (Governance / Policy class)

- **Authority chain (must read):** `.claude/CLAUDE.md`,
  `docs/ai/ARCHITECTURE.md`, `docs/01-VISION.md`,
  `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`, `EC-099`,
  `WP-099`. All confirmed present and consulted.
- **Vision sanity check:** clauses §3 / §11 / §14 / §15 +
  NG-1 / NG-3 / NG-6 cited in §Vision Alignment with explicit
  no-conflict assertion. Determinism N/A (no engine/replay
  surface). NG proximity confirmed clear. PASS.
- **Dependency & sequencing:** WP-052 complete (commit
  `fd769f1`); `apps/server/src/identity/identity.types.ts`
  exports `authProvider: 'email' | 'google' | 'discord'` at
  line 91 (verified). WP-097 complete (commit `c5344cc`) —
  D-9701 placement convention available as precedent. PASS.
- **Dependency contract verification:**
  `00.3-prompt-lint-checklist.md` line 168 contains the
  forbidden-package bullet with inline backticks
  (`` `jsonwebtoken` ``); WP-099 §Scope §A revised to lock
  the byte-identity (no re-paste of existing bullets).
  `legendary.players.auth_provider` enum at WP-052 source
  unchanged (`'email' | 'google' | 'discord'`). PASS.
- **Input data traceability:** N/A — governance WP, no
  runtime data inputs.
- **Structural readiness:** N/A — no types/contracts touched.
- **Runtime readiness:** N/A — no runtime wiring.
- **Code category boundary:** `apps/server/` is classified
  `server` category at `02-CODE-CATEGORIES.md:44`; future
  `apps/server/src/auth/hanko/` inherits the classification.
  No new directory classification needed. PASS.
- **Scope lock:** seven files in §Files Expected to Change;
  `git diff --name-only packages/ apps/ docs/01-VISION.md
  docs/ai/ARCHITECTURE.md .claude/ data/migrations/` must
  return empty. PASS.
- **Test expectations:** N/A — no test deliverables
  (governance WP, doc-only).
- **Mutation boundary:** N/A — no `G` mutation.
- **Risks resolved:** (RS-1) D-9601 staleness in §Assumes
  fixed — replaced with verifiable "D-9901..D-9905 not
  present" claim plus accurate description of file state
  (D-9701 + D-10001..D-10014 present). (RS-2) Backtick
  byte-identity bug in §Scope §A fixed — instruction
  rewritten to forbid re-paste, with byte-identity
  verification step added at Verification §Step 1.
  (RS-3) Placement convention in §Scope §B and AC-2
  clarified — "immediately before `## Final Note`" per
  WP-097 / D-9701 precedent.

**Verdict: READY TO EXECUTE.** No PS-# items outstanding.

### 01.7 Copilot Check (30-issue lens)

| # | Category | Verdict |
|---|---|---|
| 1, 9, 16, 29 | Boundary / Lifecycle | N/A — governance WP, no engine touch |
| 2, 8, 23 | Determinism | N/A — no engine/replay surface (locked at §Vision Alignment) |
| 3, 17 | Mutation discipline | N/A — no executable code |
| 4, 5, 6, 10, 21 | Type / contract integrity | N/A — no types touched; WP-052 enum byte-locked |
| 7, 19, 24 | Persistence | PASS — WP-099 explicitly forbids `'hanko'` from `auth_provider` rows + fixtures + types (D-9902 / F-1 gate) |
| 11 | Test invariants | N/A — no tests |
| 12 | Scope creep | PASS — explicit allowlist + four `git diff --name-only` guards at AC-4 |
| 13 | Unclassified directories | PASS — `apps/server/` already classified `server` per `02-CODE-CATEGORIES.md:44`; subdirs inherit |
| 14, 28 | Extension / upgrade story | PASS — replacement-safety locked structurally (§B + F-2 + F-6) |
| 15 | Why for invariants | PASS — every constraint carries rationale |
| 18, 22 | Failure semantics | N/A — no executable code |
| 20 | Authority chain | PASS — explicit hierarchy citation in §Context (Read First) |
| 25 | Single responsibility | N/A — no functions |
| 26 | Implicit semantics | PASS — auth-broker / identity-authority / federated-IdP terminology locked in §Authorized Future Surfaces opening Definitions |
| 27 | Naming discipline | PASS — `apps/server/src/auth/hanko/` path locked; `'hanko'` literal forbidden as enum value |
| 30 | Pre-session governance | PASS — three RS items resolved in §Pre-Flight Review Log above; no PS-# residue |

**Disposition: CONFIRM.** No `RISK` or `BLOCK` findings.
Pre-flight `READY TO EXECUTE` verdict stands. Session
prompt generation authorized when an executor is assigned.
