# EC-483 — Composition→Match Launch Primitive (Execution Checklist)

**Source:** docs/ai/work-packets/WP-448-composition-to-match-launch-primitive.md
**Layer:** App (`apps/arena-client`)

## Before Starting
- [ ] Baseline `origin/main` @ `71a90213`; hard-dep none (parallel-safe with the epic).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (clean baseline).
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 — record the baseline count.
- [ ] Target file set is EXACTLY: `useCreateMatchFromComposition.ts` (new) + `useCreateMatchFromComposition.test.ts` (new) + `LobbyView.vue` (modified). Any edit outside this set (except the governance ledgers) is a FAIL — surface it as a blocker, do not improvise.

## Locked Values (do not re-derive)
- Module: `apps/arena-client/src/lobby/useCreateMatchFromComposition.ts`.
- Exported fn: `export async function launchMatchFromComposition(input: LaunchMatchInput): Promise<LaunchMatchResult>`.
- Input: `{ config: MatchSetupConfig; playerCount: number; playerName: string; authToken: string }` (`playerName` already trimmed by the caller; `MatchSetupConfig` imported **type-only** from `@legendary-arena/game-engine`).
- Result: `type LaunchMatchResult = { ok: true; matchID: string } | { ok: false; message: string }`.
- Extracted sequence (exact order, seat `'0'` locked):
  1. `const created = await createMatch(config, playerCount, authToken)`
  2. `persistMatchSetup(created.matchID, config)`
  3. `const joined = await joinMatch(created.matchID, '0', playerName, authToken)`
  4. `` window.location.search = `?match=${encodeURIComponent(created.matchID)}&player=0&credentials=${encodeURIComponent(joined.playerCredentials)}` ``
  5. `return { ok: true, matchID: created.matchID }`
- Failure return (verbatim message): `` { ok: false, message: `Failed to create and join the match. ${cause}` } `` where `cause = error instanceof Error ? error.message : String(error)`.
- Imports allowed in the module: `createMatch`, `joinMatch` from `./lobbyApi`; `persistMatchSetup` from `../diagnostics/matchSetupSession`; `type MatchSetupConfig` from `@legendary-arena/game-engine`. Nothing else.

## Guardrails
- BEHAVIOR-PRESERVING: identical inputs → identical lobby behavior. The existing arena-client lobby suite passes **UNCHANGED** — editing any existing test so it still passes = behavior changed = FAIL.
- SINGLE SOURCE: after extraction the `createMatch → persist → join(seat 0) → nav` chain lives ONLY in the module; no inline duplicate remains in `submitFromJson` OR `submitCreate`.
- NEVER-THROW: the module never throws; returns the typed result. The failure message is byte-identical to today's `Failed to create and join the match. ${cause}`.
- `submitCreate` keeps `buildConfig()` + `parsePositiveInteger(numPlayers.value, 'numPlayers')` INSIDE its own try (they can throw) so throw→catch parity holds; the module receives already-resolved `(config, playerCount)`.
- OUT OF SCOPE — do NOT touch: `createWithBotAlly` (bot endpoint, different message), `joinExisting` (join-only), `startAutoplay` (autoplay endpoint). No `?loadout=` deep-link.
- LAYER: no runtime `@legendary-arena/registry` / `apps/server` / `pg` import added; no new npm dependency; `MatchSetupConfig` passed through — zero field renames.
- `LobbyView.vue` stays a `defineComponent({ setup(){…} })` SFC (D-6512); the module is a plain `.ts` with no reactive state.

## Required `// why:` Comments
- Module navigation line: why seat `'0'` + percent-encoded `matchID`/`credentials` (the human always joins their own seat 0 with the authed join; mirrors the two former inline chains).
- Module catch block: why it swallows and returns a typed `{ ok: false }` instead of throwing (never-throw parity so the caller sets `errorMessage` exactly as before).
- `submitCreate` rewire: why `buildConfig()` + the player-count parse stay inside the try (preserve the pre-launch throw→catch message parity).

## Files to Produce
- `apps/arena-client/src/lobby/useCreateMatchFromComposition.ts` — **new** — never-throw `launchMatchFromComposition` + `LaunchMatchInput` / `LaunchMatchResult` types.
- `apps/arena-client/src/lobby/useCreateMatchFromComposition.test.ts` — **new** — stubbed-`fetch` isolation tests: success (create → join `'0'` → nav → `{ ok: true }`) and create-fails (`{ ok: false }` with the locked message, no join issued).
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — `submitFromJson` + `submitCreate` consume the module; both inline chains removed; nothing else changed.

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0; `git diff origin/main -- apps/arena-client/src/lobby/LobbyView.test.ts apps/arena-client/src/lobby/lobbyApi.test.ts` is EMPTY (existing tests unchanged).
- [ ] `git grep -n "joinMatch(" -- apps/arena-client/src/lobby/LobbyView.vue` returns only the `joinExisting` call site.
- [ ] `git diff --name-only` shows no file outside the allowlist + governance ledgers.
- [ ] Live-on-surface: **N/A / inverted** — `User-Visible Surface = none — infrastructure`; STATUS.md states "No user-observable change — infrastructure only".
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` D-24268 flipped to Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-448 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` — N/A (no endpoint / catalogued Library-only fn touched).

## Common Failure Smells
- A required edit to `LobbyView.test.ts` / `lobbyApi.test.ts` to make the suite pass → behavior changed; the extraction is wrong, not the test.
- `submitCreate` calling the module with an unbuilt config, or moving `buildConfig()` outside the try → loses the pre-launch throw→catch message parity.
- The module throwing (e.g. re-throwing the caught error) instead of returning `{ ok: false }` → never-throw parity broken.
- A `matchId` (bot-API casing) instead of `matchID` in the module → wrong field; `createMatch` returns `{ matchID }`.
- A runtime `@legendary-arena/registry` import sneaking in via a barrel → layer violation; keep the engine import type-only.
