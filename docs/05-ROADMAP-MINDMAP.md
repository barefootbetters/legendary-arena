
---

### 2. Improved `docs/roadmap-mindmap.md`

```markdown
# Legendary Arena — Development Roadmap (Mindmap)

```mermaid
mindmap
  root((Legendary Arena))
    ["Multiplayer Deck-Builder\nboardgame.io + TypeScript + R2"]

      Foundation
        ["FP-00.4 ✅\nEnvironment Check"]
        ["FP-00.5 ✅\nR2 Validation"]
        ["FP-01 ⬜\nRender.com Backend"]
        ["FP-02 ⬜\nDatabase Migrations"]

      Phase 0–1
        ["WP-001 ✅\nCoordination System"]
        ["WP-002–004 ⬜\nGame Skeleton + Registry + Server"]
        ["WP-005A/B ⬜\nMatch Setup & Determinism"]
        ["WP-006A/B ⬜\nPlayer Zones & Global Piles"]

      Phase 2
        ["WP-007A/B ⬜\nTurn Structure & Loop"]
        ["WP-008A/B ⬜\nCore Moves"]

      Phase 3
        ["WP-009A/B ⬜\nRule Hooks"]
        ["WP-010 ⬜\nVictory & Loss"]
        ["WP-011–013 ⬜\nLobby + Persistence"]

      Phase 4
        ["WP-014–020 ⬜\nCore Gameplay Loop\n(Villain • City • Fight • Economy • VP)"]

      Phase 5
        ["WP-021–026 ⬜\nCard Mechanics & Abilities\n(Hero • Scheme • Mastermind)"]

      Phase 6
        ["WP-027–035 ⬜\nVerification • UI • Production\n(Replay • Hardening • Versioning)"]

      Phase 7
        ["WP-036–041 ⬜\nBeta • Launch • Live Ops\n(AI Testing • Metrics • Governance)"]

      Governance
        [".claude/CLAUDE.md\nRoot coordination"]
        ["51 Execution Checklists\nEC-mode active"]
        ["7 Rule Files\n(.claude/rules/)"]
        ["24 Immutable Decisions\nDECISIONS.md"]