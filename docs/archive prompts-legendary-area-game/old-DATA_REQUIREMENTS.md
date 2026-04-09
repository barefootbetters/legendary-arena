# DATA_REQUIREMENTS.md
Legendary Arena – Canonical Data Contract

## Purpose
This document defines **all required data** for the Legendary Arena Single‑Page Application (SPA).  
It serves as the authoritative reference for:
- data packages (`@master-strike/data`, `@legendary-arena/data`)
- Zod / TypeScript schemas
- UI mockups and real implementation parity
- validation, filtering, and search behavior

The SPA is **data‑driven**: all UI behavior derives from canonical card data and metadata lookups.

---

## 1. Core Card Data

### 1.1 Card Definition (`Card`)
Cards are the atomic gameplay entities.

**Source**
C:\pcloud\BB\DEV\legendary-arena\*


**Required fields**
- `id: string`  
  Stable, unique identifier
- `name: string`
- `cardTypeId: string` → CardType
- `setId: string` → Set
- `rulesText: string`
- `keywords: string[]` → Keyword IDs
- `imageKey: string`
- `victoryPoints: number | null`

**Common optional flags**
- `isEpic?: boolean`
- `alwaysLeads?: boolean`

**Conditional fields (by card type)**
| Field | Applies To |
|-----|-----------|
| `cost: number` | Heroes / Allies |
| `attack: number` | Heroes, Villains, Henchmen |
| `recruit: number` | Heroes |
| `teamId: string` | Heroes, Villains, Masterminds |
| `heroClassId: string` | Heroes |
| `bystanders: number` | Masterminds / Schemes |
| `twistCount: number` | Schemes |
| `specialRules?: string` | Schemes / Masterminds |

---

## 2. Metadata Lookups

All metadata is loaded **before cards are rendered** and used for filtering, display labels, icons, and validation.

**Source**
C:\pcloud\BB\DEV\legendary-arena\data\metadata

### 2.1 Card Types (`CardType`)
- `id: string`
- `name: string`
- `category: string`
- `uiOrder: number`
- `iconKey: string`

Examples:
Hero, Villain, Henchman, Mastermind, Scheme, Bystander, Wound, Officer, Sidekick

---

### 2.2 Sets (`Set`)
- `id: string`
- `name: string`
- `releaseOrder: number`
- `year: number`
- `boxType: "Core" | "Expansion" | "Promo"`
- `iconKey: string`

---

### 2.3 Teams (`Team`)
- `id: string`
- `name: string`
- `abbr: string`
- `iconKey: string`

---

### 2.4 Hero Classes (`HeroClass`)
- `id: string`
- `name: string`
- `color: string`
- `iconKey: string`

---

### 2.5 Rarities (`Rarity`)
- `id: string`
- `name: string`
- `color: string`
- `weight: number`

---

### 2.6 Keywords (`Keyword`)
- `id: string`
- `name: string`
- `rulesText: string`
- `iconKey: string`

Used for:
- rule parsing
- filtering
- tooltips
- card detail modals

---

### 2.7 Rules / Glossary (`Rule`)
- `id: string`
- `title: string`
- `rulesText: string`
- `relatedKeywords: string[]`

---

## 3. Search & Derived Data

Search and filtering are **derived**, not authored manually.

**Source**
src/lib/master-strike-data/dist/search/*


### 3.1 Search Index
Derived per runtime:
- normalized card fields
- tokenized rules text
- keyword expansion
- numeric stat ranges (cost, attack, recruit)

### 3.2 Filter State
- active set filters
- card type filters
- team filters
- hero class filters
- keyword multi‑select
- numeric ranges (cost / attack / recruit)
- sort mode

---

## 4. Image & Asset Data

Images are fetched on demand.

**Source**
https://dash.cloudflare.com/a1e9255402b3d778a06b56fda38eee85/r2/default/buckets/legendary-images
example - https://images.barefootbetters.com/antm/antm-hr-ant-man-4c1.webp

### 4.1 Card Images
- thumbnail
- standard
- hi‑resolution (optional)

Resolved via:
{set}-{slug}.webp

### 4.2 UI Icons
- card type icons
- team icons
- hero class icons
- rarity indicators
- keyword icons

---

## 5. Deck Data (User‑Generated)

### 5.1 Deck (`Deck`)
- `id: string`
- `name: string`
- `createdAt: string (ISO)`
- `updatedAt: string (ISO)`
- `cards: { cardId: string; count: number }[]`

### 5.2 Derived Deck Validation
- total card count
- counts by card type
- scheme / mastermind legality
- rule violations (warnings only)

---

## 6. Match & Game Setup Data

### 6.1 Match Configuration
- `schemeId: string`
- `mastermindId: string`
- `villainGroupIds: string[]`
- `henchmanGroupIds: string[]`
- `heroDeckIds: string[]`
- `bystandersCount: number`
- `woundsCount: number`
- `officersCount: number`
- `sidekicksCount: number`

### 6.2 Match Runtime State (SPA)
- phase:
  - Lobby
  - Setup
  - In Progress
  - Completed
- players
- readiness flags
- progress timeline

---

## 7. User & Preferences Data

### 7.1 User Profile
- `userId: string`
- `displayName: string`

### 7.2 Preferences
- theme
- accessibility options
- persisted filters
- animation toggles

Authentication is **out of scope** for the SPA mockup.

---

## 8. Application Configuration

### 8.1 Feature Flags
- enable hi‑res images
- enable animations
- enable experimental filters

### 8.2 Data Source Indicator
- `"local-modules"`
- `"fallback-sample"`

Used for diagnostics and mock mode.

---

## 9. Export & Interoperability

### 9.1 JSON Exports
- card export
- deck export
- match setup export

Used for:
- save/share
- debugging
- future multiplayer synchronization

---

## 10. Design Principles

- **IDs + lookups only** (no duplicated display strings)
- **Derived data is not persisted**
- **All UI must be reproducible from data**
- **Mock data must match real schemas exactly**

---

## Summary

Legendary Arena depends on:
- canonical card definitions
- shared metadata lookups
- derived search/filter indexes
- user‑generated decks and match setup

This document is the **single source of truth** for all Legendary Arena data modeling.
