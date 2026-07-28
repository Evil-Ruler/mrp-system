# Enterprise Material Requirements Planning (MRP) System

Production-ready Material Requirements Planning (MRP) system built with Node.js, Express, Prisma ORM, and PostgreSQL following a strict Clean Architecture pattern.

## Overview

The MRP module processes sales order demand through a 6-stage deterministic planning pipeline to calculate material requirements, net inventory shortages, and actionable purchase/production recommendations.

### Key Domain Capabilities

- **BOM Ambiguity Validation**: Guarantees exactly one BOM header per finished good. Rejects planning runs with a `ValidationError` if multiple BOM headers exist for any parent item.
- **Context-Aware BOM Line Validation**: Validates that every *directly demanded* finished good has a non-empty BOM. Reachable sub-assemblies are traversed (and cycle-checked) by the planning engine, not the validation layer. Unused BOM headers in master data are safely ignored.
- **Deterministic Repository Queries**: All Prisma ORM `findMany()` queries execute with explicit `orderBy` clauses (never relying on database default sorting).
- **Finite Number Validation**: Enforces `Number.isFinite()` on numeric planning quantities (`demand.quantity`, `bomLine.qtyPerParent`) in the domain validation layer, rejecting `NaN`, `Infinity`, and `-Infinity`.
- **Procurement Type Resolution (Phase 4)**: Resolves item procurement strategy (`PURCHASE` vs `PRODUCTION`) through a dedicated pure policy resolver (`procurementTypeResolver.js`), enforcing persistence integrity in the repository layer while isolating the planning engine from item categories.

## Quick Start

```bash
cd backend
npm install
npm test
```

The self-contained test suite runs with Node's built-in test runner and currently contains 179 passing tests; it does not require a running PostgreSQL instance.

## Migration note

The Prisma migration chain supports fresh installations, empty development databases, and fresh CI databases. Do not apply `20260704111810_add_remaining_tables` directly to a populated database that has only the initial migration: it replaces `items.item_id` while changing its type. Migration history is retained unchanged; use an operator-reviewed one-time upgrade plan for that legacy state. See [the migration notes](backend/prisma/MIGRATION_NOTES.md).
