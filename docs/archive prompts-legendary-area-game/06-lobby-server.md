# Prompt 06 — Lobby Server

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. ESM only. Node v22+. No in-memory lobby state — all state
> in PostgreSQL. No WebSocket logic. No auth in this prompt.
> Human-style code: explicit, readable, junior-maintainable. See `00.6-code-style.md`.

## Assumes
- Prompts 01–05 complete
- `src/server.mjs` exists and already configures CORS
- `game_sessions` table exists (from migration 003) but may need lobby columns
- boardgame.io v0.50.x is installed

---

## Role
You are implementing a minimal lobby for a multiplayer boardgame.io server.
The lobby handles match creation, join, and start. All turn state remains
managed by boardgame.io.

---

## Decision Rule — HTTP framework
- If Express is already installed and used in `src/server.mjs`, use Express.
- Otherwise, implement using Node.js `http` module only (no new dependency).
- Either way, routes and behavior must be identical.

---

## Lobby Responsibilities (and boundaries)

**Lobby DOES:**
- Create a boardgame.io match programmatically
- Persist lobby metadata to PostgreSQL (`game_sessions`)
- Allow players to join seats and record display names
- Start the game (transition waiting → active)

**Lobby does NOT:**
- Store `G`/`ctx` in database
- Implement any WebSocket logic
- Implement authentication (Prompt 07 is separate)

---

## Code Style Mandate

All output must follow `00.6-code-style.md`. Key rules for this prompt:

- **Each route handler is a named function** — declare `async function handleCreateGame(request, response)`
  and reference it in the router. Do not write anonymous arrow functions inline.
- **Database queries are explicit** — write the full SQL string in the route handler
  where it is used. Do not extract a `queryGameSession()` helper unless the same
  query appears in three or more routes.
- **Validation is step-by-step** — check each precondition in its own `if` block
  with a full-sentence error response:
  ```js
  if (playerCount < 1 || playerCount > 5) {
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      error: 'playerCount must be between 1 and 5. Received: ' + playerCount
    }));
    return;
  }
  ```
- **Readable names** — `matchIdentifier`, `joinCode`, `filledSeatCount`,
  `gameSessionRow`, not `id`, `code`, `count`, `row`.
- **No generic route dispatcher** — do not build a router factory or middleware
  chain abstraction. Map each route explicitly.
- **`// why:` comments** on the join code retry loop, the UNIQUE constraint
  explanation, and the boardgame.io server API calls.

---

## Deliverables

### 1. Lobby API routes (`src/lobby/routes.mjs`)

#### `POST /lobby/games`
Body: `{ mastermindsSlug?: string|null, schemeSlug?: string|null, playerCount: number (1–5) }`

Behavior:
- Create a boardgame.io match programmatically
- Generate `joinCode` = 6-char uppercase alphanumeric
- Insert `game_sessions` row with:
  `status='waiting'`, `join_code`, `player_count`, `masterminds_slug`,
  `scheme_slug`, `filled_seats=0`, `seats='{}'::jsonb`

Return: `{ matchID, joinCode }`

#### `POST /lobby/games/:matchID/join`
Body: `{ playerName: string, playerID: number }` (0-based seat)

Behavior:
- Validate match exists in `game_sessions`
- Validate `playerID` is within `0..player_count-1`
- Validate seat not already filled
- Call boardgame.io to join that `playerID` → obtain `playerCredentials`
- Update DB: `seats[playerID] = playerName`, increment `filled_seats`

Return: `{ playerCredentials }`

#### `POST /lobby/games/:matchID/start`
Body: `{}` (no payload required)

Behavior:
- Validate match exists
- Idempotent: if already active, return active without error
- Update DB: `status='active'`

Return: `{ status: 'active' }`

#### `GET /lobby/games`
Return waiting games: `[{ matchID, joinCode, playerCount, filledSeats, mastermindsSlug, schemeSlug }]`

#### `GET /lobby/games/:matchID`
Return: `{ matchID, joinCode, status, playerCount, filledSeats, mastermindsSlug, schemeSlug, seats }`
404 if not found.

---

### 2. boardgame.io Server API integration

Show EXACTLY how to:
- Create a match programmatically using boardgame.io v0.50.x server API
- Join a player programmatically and obtain their credentials
- Read match metadata for sanity checks

Do not invent unsupported APIs — use only the server surface that exists on
the running boardgame.io server instance.

---

### 3. Update `src/server.mjs`

Show the minimal diff (as full file) needed to mount lobby routes alongside
the boardgame.io WebSocket server on the same port.

Add `GET /health` returning `{ status: 'ok', uptime: process.uptime() }` if
not already present.

---

### 4. Migration if needed (`db/migrations/005_lobby_columns.sql`)

If `game_sessions` doesn't already have these columns, add them:
- `join_code TEXT NOT NULL UNIQUE`
- `status TEXT NOT NULL DEFAULT 'waiting'`
- `player_count INT NOT NULL`
- `filled_seats INT NOT NULL DEFAULT 0`
- `masterminds_slug TEXT NULL`
- `scheme_slug TEXT NULL`
- `seats JSONB NOT NULL DEFAULT '{}'::jsonb`

Include indexes supporting:
- Listing waiting games quickly (index on `status`)
- Lookup by `join_code` quickly (index on `join_code` — already unique, so index is implicit)

---

## Operational Notes (answer directly)

1. **Join code collisions**: What prevents duplicate join codes? Is a UNIQUE
   constraint sufficient, or is a retry loop needed? (Implement both — UNIQUE
   constraint + retry loop on conflict.)

2. **Stale rooms**: How long should waiting rooms persist? What is the tradeoff
   of not adding a cleanup job at this stage?

3. **Source of truth**: PostgreSQL is the lobby truth; boardgame.io is the gameplay
   truth. Describe the sync boundary — what happens to the boardgame.io match if
   the `game_sessions` row is deleted manually?

---

## Hard Constraints

- ESM only
- No module-level in-memory lobby state — everything in PostgreSQL
- No WebSocket logic
- No auth in this prompt
- Do not duplicate CORS logic already in `server.mjs`
- **Each route handler is a named function declaration** — no inline anonymous handlers
- **Database queries written inline** in each route handler — no query helper abstraction
  unless the same query appears 3+ times
- **Each validation check is its own `if` block** with a full-sentence JSON error body
- **No abbreviated variable names** — full English words throughout
- **No generic router factory** — map routes explicitly
- **No nested ternaries**
- **No function longer than 30 lines** — break route handlers into named helper steps
  if needed (e.g., `async function insertGameSessionRow(...)`)
- **`// why:` comments** on retry loop, UNIQUE constraint, boardgame.io API calls
- **All error response bodies include a full-sentence `error` field**
