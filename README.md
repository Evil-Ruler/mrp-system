# Enterprise Material Requirements Planning (MRP) System

Production-ready Material Requirements Planning (MRP) system built with Node.js, Express, Prisma ORM, and PostgreSQL following a strict Clean Architecture pattern.

## Overview

The MRP module processes sales order demand through a 6-stage deterministic planning pipeline to calculate material requirements, net inventory shortages, and actionable purchase/production recommendations.

### Key Domain Capabilities

- **BOM Ambiguity Validation**: Guarantees exactly one BOM header per finished good. Rejects planning runs with a `ValidationError` if multiple BOM headers exist for any parent item.
- **Context-Aware BOM Line Validation**: Validates that all parent items participating in the active planning graph contain component lines. Unused BOM headers in master data are safely ignored.
- **Deterministic Repository Queries**: All Prisma ORM `findMany()` queries execute with explicit `orderBy` clauses (never relying on database default sorting).
- **Finite Number Validation**: Enforces `Number.isFinite()` on numeric planning quantities (`demand.quantity`, `bomLine.qtyPerParent`) in the domain validation layer, rejecting `NaN`, `Infinity`, and `-Infinity`.
- **Pure Header-Based BOM Graph Construction**: Constructs BOM graphs using `BOMHeader` $\rightarrow$ `BOMLine` relations while preserving pure engine execution decoupled from business validation logic.

## Architecture Flow

```
Route (Express)
  ↓
HTTP Validation (Query Parsing)
  ↓
Controller (Thin Request Adapter)
  ↓
Service (Orchestrator)
  ↓
Planning Validation (Domain Invariants)
  ↓
Engine (Pure Functions: Explosion -> Netting -> Allocation -> Recommendation)
  ↓
Repository (Data Access Only)
  ↓
Prisma ORM (PostgreSQL)
```

## Quick Start

```bash
cd backend
npm install
npm test
```
