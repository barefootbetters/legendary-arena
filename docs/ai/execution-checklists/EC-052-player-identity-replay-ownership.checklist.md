# EC-052 — Player Identity & Replay Ownership (Execution Checklist)

**Source:** docs/ai/work-packets/WP-052-player-identity-replay-ownership.md
**Layer:** Server / Identity + Storage

**Execution Authority:**
This EC is the authoritative execution checklist for WP-052.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-052.

---

## Before Starting

- [ ] WP-004 complete: server startup sequence exists (`apps/server/src/index.mjs`)
- [ ] WP-027 complete: `ReplayInput`, `replayGame`, `computeStateHash` exported
- [ ] WP-051 complete: `checkParPublished(scenarioKey)` exists at server layer
- [ ] `docs/13-REPLAYS-REFERENCE.md` exists and read in full
- [ ] `docs/ai/ARCHITECTURE.md` §Layer Boundary read
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-052.

- `PlayerId` maps to `legendary.players.ext_id` — never to `player_id bigint`
- `PlayerId` is distinct from boardgame.io's `playerID` (engine-local turn identifier)
- `AuthProvider`: `'email' | 'google' | 'discord'` — no other values
- `ReplayVisibility`: `'private' | 'link' | 'public'` — default `'private'`
- `DEFAULT_RETENTION_POLICY`: `{ minimumDays: 30, defaultDays: 90, extendedDays: null }`
- `PlayerAccount` fields: `playerId`, `email`, `displayName`, `authProvider`, `authProviderId`, `createdAt`, `updatedAt`
- `GuestIdentity` fields: `guestSessionId`, `createdAt`, `isGuest: true`
- `legendary.*` schema namespace; PKs use `bigserial`; cross-service IDs use `ext_id text`
- `UNIQUE (player_id, replay_hash)` on `legendary.replay_ownership`

---

## Guardrails

- Identity never affects gameplay, RNG, scoring, matchmaking, or engine execution
- The game engine must never receive, compute, store, or serialize a `PlayerId` value
- Identity types live **only** in `apps/server/src/identity/` — never in `packages/game-engine/`
- Guest play is fully functional and ungated; local replay export is immediate and unconditional
- Guest-to-account migration requires explicit user-initiated replay import — never silent server attach
- Replay ownership is metadata only; no UPDATE path may exist for any field except `visibility`
- Retention expiration affects storage eligibility only — never replay validity or score verification
- Extended retention (Supporter tier) is convenience only, never a gameplay advantage
- Adding an `AuthProvider` is a governance event requiring `DECISIONS.md` — not a config change

---

## Required `// why:` Comments

- `PlayerId` type: UUID v4 avoids sequential ID enumeration attacks
- `AuthProvider` type: trust surface; additions require DECISIONS.md entry
- `PlayerIdentity` union: guests are a policy variant, not a degraded account
- `ReplayOwnershipRecord` immutability: all fields except `visibility` are immutable after creation
- `ReplayOwnershipRecord.expiresAt`: storage eligibility only, not validity
- `assignReplayOwnership`: idempotent to handle network retries safely
- `deletePlayerData`: GDPR erasure; blob removal is asynchronous and separate
- Migration `ext_id`: cross-service identifier per `00.2-data-requirements.md`

---

## Files to Produce

- `apps/server/src/identity/identity.types.ts` — **new** — PlayerId, PlayerAccount, GuestIdentity, PlayerIdentity, AuthProvider, AUTH_PROVIDERS, isGuest
- `apps/server/src/identity/replayOwnership.types.ts` — **new** — ReplayVisibility, REPLAY_VISIBILITY_VALUES, ReplayOwnershipRecord, ReplayRetentionPolicy, DEFAULT_RETENTION_POLICY
- `apps/server/src/identity/identity.logic.ts` — **new** — createPlayerAccount, findPlayerByEmail, findPlayerById, createGuestIdentity
- `apps/server/src/identity/replayOwnership.logic.ts` — **new** — assignReplayOwnership, updateReplayVisibility, listPlayerReplays, findReplayOwnership, deletePlayerData
- `data/migrations/NNN_create_players_table.sql` — **new** — legendary.players
- `data/migrations/NNN_create_replay_ownership_table.sql` — **new** — legendary.replay_ownership
- `apps/server/src/identity/identity.logic.test.ts` — **new** — 8 tests
- `apps/server/src/identity/replayOwnership.logic.test.ts` — **new** — 4 tests

---

## After Completing

- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (DB tests may skip with reason)
- [ ] No identity types leaked into `packages/game-engine/src/`; no `boardgame.io`, `@legendary-arena/game-engine`, or `require()` in `apps/server/src/identity/` (Select-String confirms all)
- [ ] Migrations use `legendary.*` namespace, `bigserial` PKs, `DEFAULT 'private'`
- [ ] Replay expiration does not invalidate ability to re-execute or verify scores
- [ ] WP-027 and WP-051 contract files unmodified; no files outside scope changed (`git diff` confirms)
- [ ] `STATUS.md` updated; `DECISIONS.md` updated (UUID v4, ephemeral guest, ownership immutability, private default, 30-day minimum, server-only identity, GDPR blob purge separate); `WORK_INDEX.md` WP-052 checked off

---

## Common Failure Smells

- Identity type appears in `packages/game-engine/` → layer boundary violation
- `player_id bigint` exposed in API payloads or outside SQL queries → PlayerId mapping violated; use `ext_id`
- Guest replay appears in `legendary.replay_ownership` without account → silent attach; migration must be explicit import
- `updateReplayVisibility` touches fields besides `visibility` → ownership immutability violated
- `AUTH_PROVIDERS` array length differs from `AuthProvider` union members → drift-detection test missing or broken
