# EC-012 — Match Listing, Join & Reconnect (Execution Checklist)

**Source:** docs/ai/work-packets/WP-012-match-list-join-reconnect.md
**Layer:** Server / Match Access

**Execution Authority:**
This EC is the authoritative execution checklist for WP-012.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-012.

---

## Before Starting

- [ ] WP-011 complete: `create-match.mjs` exists, lobby moves wired, server running
- [ ] `apps/server/src/server.mjs` running with health endpoint responding (WP-004)
- [ ] `G.lobby` has `requiredPlayers`, `ready`, `started` in `LegendaryGameState` (WP-011)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-012.
If formatting, spelling, or ordering differs, the implementation is invalid.

- boardgame.io default endpoint paths (exact -- do not invent alternates):
  List matches: `GET /games/legendary-arena`
  Join match: `POST /games/legendary-arena/<matchID>/join`
  Body for join: `{ playerName: string }`
- boardgame.io join response shape:
  `{ playerID: string, credentials: string }`
  (include `matchID` if present in response)

---

## Guardrails

- Both scripts use Node v22 built-in `fetch` -- no axios, no node-fetch
- Both scripts exit 1 on failure with a full-sentence message to stderr
- Unit tests stub `fetch` -- no live server required for tests
- No game engine files (`packages/game-engine/`) may be modified
- No `apps/server/src/` files modified unless bug-justified in DECISIONS.md
- Credentials printed to stdout -- never stored to disk or logged to a file
- No custom REST or WebSocket routes -- use boardgame.io defaults only

---

## Required `// why:` Comments

- Any non-obvious boardgame.io API choices in the CLI scripts

---

## Files to Produce

- `apps/server/scripts/list-matches.mjs` -- **new** -- CLI match listing
- `apps/server/scripts/join-match.mjs` -- **new** -- CLI join and credentials
- `apps/server/scripts/list-matches.test.ts` -- **new** -- `node:test` CLI tests
- `apps/server/scripts/join-match.test.ts` -- **new** -- `node:test` CLI tests

---

## Common Failure Smells (Optional)

- Scripts import axios or node-fetch instead of built-in `fetch`
  -> Node v22 built-in requirement violated
- Tests spin up a real server instead of stubbing `fetch`
  -> test isolation violated
- Credentials written to a file or environment variable
  -> security boundary violated

---

## After Completing

- [ ] `pnpm --filter server test` exits 0
- [ ] Both scripts use no external HTTP packages
- [ ] No game engine files modified (`git diff --name-only`)
- [ ] No `require()` in any generated file
- [ ] Steps 3-6 of Verification Steps verified manually against running server
- [ ] `docs/ai/STATUS.md` updated (minimum viable multiplayer loop complete)
- [ ] `docs/ai/DECISIONS.md` updated (built-in endpoints over custom routes; stubbed fetch in tests; credentials to stdout not disk)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-012 checked off with date
