# Design Constraints: Pre-Planning System

## Problem Statement

Multiplayer games of Marvel Legendary experience increasing downtime as the game progresses. Each player's turn becomes noticeably slower due to:

- Decks growing larger and more complex as heroes are recruited
- An expanding decision space created by card effects, Mastermind tactics, Scheme twists, and villain interactions

In a typical 4-player game, mid-to-late game turns often take 60–90+ seconds per player. With three players waiting, this results in 3–4.5 minutes of idle time per round, compounding further as disruptive effects and conditional decisions increase. This slowdown is perceptible and directly impacts player engagement.

To mitigate perceived downtime, players naturally attempt to pre-plan their upcoming turn while waiting. This pre-planning commonly includes:

- Which cards to play and in what order
- Which heroes to recruit or villains to fight
- Which optional effects to trigger (card draw, KO, discard, resource conversion, etc.)

This strategy works well in isolation or single-player contexts. However, it consistently breaks down in multiplayer games because other players' turns can mutate a waiting player's future state, invalidating the pre-plan.

Common disruptive effects include:

- "Discard a non-grey hero from your hand."
- "Each player discards a card."
- "KO a hero from each player's hand."

These disruptions are asymmetric: the active player proceeds without disruption, while non-active players experience backtracking and cognitive churn.

When such an effect resolves, the waiting player must mentally rewind to their prior hand and board state, determine what changed, and reconstruct their turn plan. This backtracking is:

- **Mentally taxing** — requiring state reconstruction under time pressure
- **Error-prone** — increasing the risk of missed triggers or illegal plays
- **Counterproductive** — negating the benefit of pre-planning and slowing the game for everyone

As a result, the game feels progressively slower and more frustrating over time, despite players actively trying to optimize their use of waiting time.

---

## Goal

Design and implement a first-class pre-planning system in Legendary Arena that enables players to safely and confidently plan their upcoming turn while waiting, even in the presence of disruptive inter-player effects.

The system must:

- Allow pre-plans to exist concurrently with other players' turns
- Handle inter-player disruptions gracefully and transparently
- Minimize or eliminate manual backtracking
- Preserve correctness and fairness:
  - No hidden information is revealed
  - No player can commit actions before their turn
  - Pre-plans are advisory only, never binding
- Improve perceived pacing as game complexity increases

### Acceptance Scenario (Illustrative)

1. Player B pre-plans their turn while waiting.
2. Player A's Mastermind tactic forces Player B to discard a hero from their hand.
3. The system must:
   - Notify Player B that their plan has been disrupted
   - Identify which parts of the pre-plan are invalidated
   - Preserve any still-valid portions of the plan
   - Allow Player B to continue planning without reconstructing their hand from memory

### Non-Goals

This system explicitly does not:

- Automate turn execution or remove player agency
- Suggest or optimize plays via AI
- Allow binding pre-commitments that constrain future choices
- Prevent opponents from disrupting plans

Success is defined by reducing perceived downtime without increasing cognitive load or rules errors, keeping multiplayer Legendary fast, fair, and mentally sustainable.

---

## Design Constraints

The following constraints are properties that must hold for any solution to satisfy the stated problem and goal. They are not implementation choices.

### 1. Pre-plan State Must Be Explicitly Represented

**Constraint:** The system must represent a player's pre-planned turn as a first-class, structured object, not as implicit UI state or player memory.

**Why:**
- The core pain is mental backtracking
- If the system cannot see the plan, it cannot detect when a disruption requires rewind
- Rewind, notification, and reshuffle are impossible without explicit representation

**Definition — Speculatively revealed:** any card drawn, peeked, or otherwise exposed to the planning player outside of the real game state, including draws from their deck, shared supply piles, or any effect-generated reveals performed during pre-planning.

**Implication:**
- A pre-plan cannot be "queued clicks" or visual highlights alone
- It must track which cards were speculatively revealed and from which sources

---

### 2. Pre-plans Must Be Advisory and Non-Binding

**Constraint:** A pre-plan must never commit game actions, reserve cards, or lock in choices. It operates on a speculative copy of the player's state, not on actual game state.

**Why:**
- Fairness: no locking in actions before your turn
- Non-goals explicitly forbid binding pre-commitments
- Turn authority belongs exclusively to the active player's turn window

**Implication:**
- Pre-plans may be rewound or discarded at any time without affecting the real game
- The system must tolerate plan destruction by design

---

### 3. Disruption Triggers Full Rewind to Clean Hand

**Constraint:** When a disruption invalidates a pre-plan, the system must rewind the player's planning state to their clean starting hand (typically the cards held at the end of their previous turn). Any cards speculatively revealed during pre-planning — from the player's deck, shared piles, or any other source — must be reshuffled back into their respective sources. The player must not be responsible for performing or tracking this rewind manually.

**Why:**
- Full rewind is simpler and more predictable than surgical partial preservation
- The original problem is that players must mentally reconstruct state — the system must own that reconstruction entirely
- Speculative reveals are the most error-prone element; mechanical reshuffle eliminates information leakage

**Implication:**
- The system must track every speculative reveal: card, source, and order
- Reshuffle must restore all speculative sources to a state indistinguishable from one in which pre-planning never occurred, both to the planning player and to all other players
- Full rewind is the baseline; partial plan survival is a future optimization, not a requirement

---

### 4. Disruptions Must Be Detectable Per Player

**Constraint:** The system must be able to determine, for any inter-player effect, whether a waiting player's state has been mutated. If yes, that player's pre-plan is invalidated and rewind is triggered.

**Why:**
- The acceptance scenario requires notifying Player B that their plan was disrupted
- Without detection, the system cannot trigger rewind or notification
- Not all inter-player effects affect all waiting players — detection must be per-player

**Implication:**
- The system needs a way to observe state mutations that touch waiting players
- Detection granularity is binary per player (affected or not), not per plan step
- "Did anything change for this player?" is sufficient; "what exactly changed?" is informational, not structural

---

### 5. Plan Validity Must Be Locally Determinable

**Constraint:** The system must be able to determine plan validity using only: the current public game state, the player's own private state, and the plan itself.

**Why:**
- Hidden information must never be revealed
- Validity checks cannot depend on future draws or unknown opponent choices
- Multiplayer fairness requires symmetry

**Implication:**
- Plans cannot speculate on deck order beyond cards already speculatively drawn
- Any plan step that depends on unknown future state must be marked as conditional or unresolved

---

### 6. The Active Player Must Remain Unburdened

**Constraint:** The solution must not add cognitive or mechanical overhead to the active player's turn.

**Why:**
- The asymmetry: only waiting players suffer the problem
- Slowing the active player worsens total downtime for everyone

**Implication:**
- No acknowledgment, confirmation, or special sequencing is required from the active player
- All plan disruption handling happens independently of the active turn
- The active player's experience is identical whether or not other players are pre-planning

---

### 7. Plan Disruption Must Be Communicated Immediately

**Constraint:** When a disruption invalidates a pre-plan, the affected player must be notified before they are permitted to make any further planning interactions. The notification must state what happened, not just that something changed.

**Why:**
- Late notification forces the player to act on stale state
- The goal is confidence while waiting, not surprise at turn start
- "Your hand changed" without explanation recreates the original confusion

**Implication:**
- Notification must include what effect occurred (e.g., "Player A's Mastermind tactic forced you to discard Iron Man from your hand")
- Notification must precede any resumed planning interaction
- The mechanism for delivery (push, interrupt, modal) is a design decision

---

### 8. The System Must Support Zero, Partial, or Full Pre-Planning

**Constraint:** A player may pre-plan nothing, part of a turn, or an entire turn. All modes must be equally supported.

**Why:**
- Players differ in confidence, speed, and familiarity
- Forcing full plans recreates cognitive load
- Some players will prefer to wait and plan only when their turn starts

**Implication:**
- Pre-plans must be composable and optional
- The system cannot assume plan completeness
- A player who never pre-plans must have the same game experience as one who always does

---

### 9. Speculative Reveals Must Not Leak Information

**Constraint:** Cards speculatively revealed during pre-planning must not be visible to any other player. After a rewind, the planning player must not retain knowledge of reshuffled card positions or identities beyond what they would know without pre-planning.

**Why:**
- Fairness: pre-planning must not create an information advantage
- If a player sees the top 2 cards of their deck during pre-planning, then a disruption triggers rewind and reshuffle, those cards must be treated as unknown
- Other players must never see pre-plan contents or speculative state

**Implication:**
- Speculative draws happen in a sandboxed planning context, never in the real game state
- After reshuffle, deck order must be re-randomized, not merely restored
- No network message may transmit pre-plan contents to other clients
- Plan existence itself (whether a player is pre-planning) should not be broadcast

---

### 10. Pre-plan Is Scoped to a Single Upcoming Turn

**Constraint:** A pre-plan is scoped to the player's next turn only. It is consumed or discarded when the player's turn begins and never persists beyond that turn boundary.

**Why:**
- Multi-turn planning introduces compounding speculation that cannot be validated
- Turn boundaries are the natural lifecycle for pre-plans
- Consuming the plan at turn start transitions it from advisory to actionable in a clean, well-defined moment

**Implication:**
- When a player's turn begins, the pre-plan is either executed as a starting point or cleared
- No plan state carries over into subsequent turns
- "Plan for two turns from now" is not supported

---

### 11. Failure Modes Must Be Understandable, Not Silent

**Constraint:** When a plan is invalidated and rewound, the system must explain what disrupted the plan and what changed in the player's hand or board state.

**Why:**
- Silent disappearance recreates mental backtracking — the original problem
- Transparency is required for player trust in the system
- Players must understand why their plan was rewound to avoid frustration with the system itself

**Implication:**
- "Your plan was reset because Player A's effect discarded [Card Name] from your hand" is the baseline
- The system must track the causal link between the disruptive effect and the rewind
- Vague notifications ("something changed") are insufficient

---

### 12. No Net Increase in Cognitive Load

**Constraint:** Using the pre-planning system must never be more mentally expensive than not using it.

**Why:**
- The success criteria explicitly require this
- A powerful but opaque system will not be adopted
- The system exists to absorb complexity, not redistribute it

**Implication:**
- The planning interface must feel like "playing your turn early," not "operating a second system"
- Rewind and notification must feel like the game helping, not interrupting
- Additional structure must reduce effort, not require learning

---

## Constraint Groups by Concern

| Concern | Constraints |
|---|---|
| Representation | #1 |
| Semantics | #2, #5, #10 |
| Disruption handling | #3, #4, #7 |
| Fairness & privacy | #9 |
| Player experience | #6, #8, #11, #12 |

---

## How to Use This List

These constraints are strong enough to:

- Gate architectural proposals ("does this satisfy Constraint #9?")
- Reject tempting shortcuts early ("partial rewind is an optimization, not a requirement per #3")
- Drive WP acceptance criteria directly
- Explain why certain complexity is unavoidable
- Scope future WPs — each constraint that requires non-trivial implementation may anchor its own work packet or acceptance criterion
