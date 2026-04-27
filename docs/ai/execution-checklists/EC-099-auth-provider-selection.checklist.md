# EC-099 — Auth Provider Selection (Execution Checklist)

**Source:** docs/ai/work-packets/WP-099-auth-provider-selection.md
**Layer:** Governance / Policy (docs-only; no engine, app, or registry touch)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-099.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-099.

---

## Before Starting

- [ ] WP-099 status flipped Draft → Executing; pre-flight bundle registered
- [ ] WP-052 complete; `auth_provider` enum at `'email' | 'google' | 'discord'`; migrations 004 and 005 applied
- [ ] `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §7` contains the existing `No Passport / Auth0 / Clerk — use jsonwebtoken or credentials-only` line verbatim (verified with grep at session start)
- [ ] `docs/ai/DECISIONS.md` does not yet contain `D-9901..D-9905` (verified by `grep -nE "^## D-990[1-5] " docs/ai/DECISIONS.md` returning zero matches). The file's last decision before `## Final Note` is `D-9701` (WP-097, commit `c5344cc`); D-10001..D-10014 (WP-100 cluster) sit higher in the file because decisions are appended chronologically, not in numeric order — D-9901..D-9905 will land **after** D-9701 in the same chronological-append slot.
- [ ] `docs/ai/STATUS.md` and `docs/ai/work-packets/WORK_INDEX.md` exist
- [ ] `git diff --name-only packages/ apps/ data/migrations/` empty at start

## Locked Values (do not re-derive)

- Selected provider: `Hanko` (open-source; OIDC-compliant; self-hostable)
- Forbidden providers (preserved): `Auth0`, `Clerk`, `Passport`, password-based credential storage
- `authProvider` enum (preserved from WP-052, unchanged): `'email' | 'google' | 'discord'`
- `AccountId` source (preserved from WP-052 D-5201): `node:crypto.randomUUID()`, server-side
- Decision IDs to land: `D-9901`, `D-9902`, `D-9903`, `D-9904`, `D-9905`
- Lint-checklist amendment target: `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §7`
- Hanko module path (locked for future implementation WP, NOT created here): `apps/server/src/auth/hanko/`
- Forbidden literal in code/fixtures: the string `'hanko'` MUST NOT appear as an `auth_provider` enum value anywhere under `apps/`, `packages/`, or `data/migrations/`

## Guardrails

- Docs-only. No `packages/`, `apps/`, or `data/migrations/` files modified. No `docs/01-VISION.md`, `docs/ai/ARCHITECTURE.md`, or `.claude/` files modified.
- §7 amendment is a surgical append ONLY — preserve every existing forbidden-package bullet (axios, ORMs, Jest/Vitest/Mocha, Passport/Auth0/Clerk) byte-for-byte, **including the inline backticks around package names** (`` `axios` ``, `` `node-fetch` ``, `` `pg` ``, `` `node:test` ``, `` `jsonwebtoken` ``). Do NOT re-paste the existing bullets in the diff — apply the change as a pure append. The new Hanko bullet immediately follows the `No Passport / Auth0 / Clerk — use \`jsonwebtoken\` or credentials-only` line.
- D-9901..D-9905 are inserted as a contiguous numeric-order block (`D-9901` → `D-9902` → `D-9903` → `D-9904` → `D-9905`) **immediately before `## Final Note`** at the foot of `DECISIONS.md`. This matches the WP-097 / D-9701 placement precedent (commit `c5344cc`): chronological-append at the foot, NOT strict numeric ordering. Do not attempt to interleave with D-10001..D-10014.
- WP-099 implements zero auth surfaces. `grep -rE "@teamhanko|hanko\.io" apps/ packages/` MUST return zero matches at execution time.
- Hanko-specific code does not exist anywhere in the repo at WP-099 close. The §A/§B surfaces in WP-099 are policy authorizations for *future* WPs (WP-112 — renumbered from "WP-100" per D-10002 — and a future implementation WP), not deliverables.
- "Auth broker" vs "identity authority" terminology is canonical (per WP-099 §Authorized Future Surfaces opening Definitions). Do not coin synonyms ("auth provider" is acceptable in narrative; "identity provider"/"IdP" must refer to the federated provider behind Hanko, not Hanko itself).

## Required `// why:` Comments

- N/A — no executable code is created or modified by EC-099.

## Files to Produce

### Commit A (EC-099 execution — lint-checklist amendment)

- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — **modified** — surgical §7 append: new bullet `Hanko is permitted as an authentication broker only — governed by docs/ai/work-packets/WP-099-auth-provider-selection.md and D-9901..D-9905. Hanko-specific code MUST live under apps/server/src/auth/hanko/; the broker MUST NOT appear as an auth_provider value in legendary.players; AccountId MUST remain server-generated. Auth0 / Clerk / Passport remain forbidden.` All other §7 content and all other sections byte-identical.

### Commit B (SPEC governance close — not EC-099)

- `docs/ai/DECISIONS.md` — **modified** — `D-9901` through `D-9905` inserted in numeric order at foot
- `docs/ai/STATUS.md` — **modified** — `### WP-099 / EC-099 Executed — Auth Provider Selection ({YYYY-MM-DD}, EC-099)` block at top of `## Current State`
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-099 row flipped `[ ]` → `[x]` with today's date and SPEC commit hash
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-099 row flipped `Draft` → `Done {YYYY-MM-DD}`

## After Completing

- [ ] WP-099 acceptance criteria AC-1 through AC-8 all pass
- [ ] `grep -nE "Hanko is permitted as an authentication broker only" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returns exactly one match
- [ ] `grep -nE "^- \[ \] No Passport / Auth0 / Clerk" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returns exactly one match (existing ban preserved)
- [ ] `grep -nE "^## D-990[1-5] " docs/ai/DECISIONS.md` returns exactly five matches in numeric order
- [ ] `grep -A 30 "^## D-9901 " docs/ai/DECISIONS.md | grep -E "Hanko|replacement-safety|apps/server/src/auth/hanko"` returns at least three matches
- [ ] `grep -nE "WP-099 / EC-099 Executed" docs/ai/STATUS.md` returns exactly one match
- [ ] `grep -nE "\[x\] WP-099" docs/ai/work-packets/WORK_INDEX.md` returns exactly one match
- [ ] `grep -rE "'hanko'|\"hanko\"" apps/ packages/ data/migrations/` returns no output (broker invisible at rest)
- [ ] `grep -rE "@teamhanko|hanko\.io" apps/ packages/` returns no output (no implementation leaked)
- [ ] `git diff --name-only packages/ apps/ docs/01-VISION.md docs/ai/ARCHITECTURE.md .claude/ data/migrations/` returns empty
- [ ] `git diff --name-only` limited to the files listed in `## Files to Produce`
- [ ] EC-099 commit body includes a `Vision: §3, §11, §14, §15, NG-1, NG-3, NG-6` trailer per `01.3-commit-hygiene-under-ec-mode.md`
- [ ] EC_INDEX EC-099 row updated `Draft` → `Done {YYYY-MM-DD}`

## Common Failure Smells

- §7 amendment is a rewrite instead of a surgical append — STOP; existing Auth0/Clerk/Passport ban must be byte-preserved. Re-read WP-099 §Scope §A; the Hanko bullet immediately follows the existing line.
- §7 amendment silently strips inline backticks from sibling bullets (e.g., `` `jsonwebtoken` `` → `jsonwebtoken`, `` `pg` `` → `pg`) — STOP; the four existing forbidden-package bullets at lines 165–168 use inline backticks around package names. The pre-flight review log calls this out explicitly. Re-run Verification §Step 1 — both grep checks must match the backtick-bearing form.
- D-9901..D-9905 inserted in strict numeric order (e.g., between D-9601 and D-10001) instead of chronological append before `## Final Note` — STOP; the convention established by WP-097 / D-9701 (commit `c5344cc`) is **chronological at the foot, before `## Final Note`**, regardless of numeric value. D-9701 itself sits below D-10001..D-10014 in the file because of this convention; D-9901..D-9905 join the same chronological tail.
- D-9901..D-9905 added but `'hanko'` appears as a code literal somewhere in `apps/` or `data/migrations/` — STOP; the broker is invisible at rest by D-9902 and the F-1 gate item. Re-read WP-099 Non-Negotiable Constraints "Hanko is invisible at rest" and remove the literal.
- A future implementation WP cited in WP-099 §Authorized Future Surfaces appears to be drafted as part of this session — STOP; WP-099 is policy-only. WP-112 (renumbered from "WP-100" per D-10002) and the Hanko-implementation WP are separate sessions.
- §7 carve-out is rephrased as category-wide ("managed auth providers are permitted") — STOP; the carve-out is Hanko-specific by D-9903. Auth0 / Clerk / Passport remain forbidden. Re-read the locked carve-out wording verbatim from WP-099 §Scope §A.
- D-9904's locked module path is changed to `apps/server/src/identity/hanko/` or similar — STOP; the path `apps/server/src/auth/hanko/` is locked precisely to keep `identity/` Hanko-free (structural replacement-safety, F-2 gate item).
